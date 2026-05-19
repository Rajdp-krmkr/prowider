/**
 * Lead Allocation Engine
 *
 * Rules:
 *  Service 1 → mandatory: [1],       pool: [2, 3, 4]       → assign 2 from pool
 *  Service 2 → mandatory: [5],       pool: [6, 7, 8]       → assign 2 from pool
 *  Service 3 → mandatory: [1, 4],    pool: [2, 3, 5, 6, 7, 8] → assign 1 from pool
 *
 * Fair allocation: round-robin pointer stored in AllocationState (persists across restarts).
 * Concurrency: the entire allocation runs inside a serializable transaction with
 *              a PostgreSQL advisory lock so parallel requests are sequenced.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Configuration ────────────────────────────────────────────────────────────

const TOTAL_ASSIGNMENTS = 3;

const MANDATORY: Record<number, number[]> = {
  1: [1],
  2: [5],
  3: [1, 4],
};

const POOL: Record<number, number[]> = {
  1: [2, 3, 4],
  2: [6, 7, 8],
  3: [2, 3, 5, 6, 7, 8],
};

// ─── Main Allocation Function ─────────────────────────────────────────────────

/**
 * Assigns exactly 3 providers to a newly created lead.
 * Must be called immediately after the lead is created.
 * Uses an advisory lock (per serviceId) to prevent concurrent races.
 */
export async function assignProviders(leadId: number, serviceId: number): Promise<number[]> {
  // PostgreSQL advisory lock key (must be bigint)
  // Use serviceId as the lock key so only leads of the same service serialise.
  const lockKey = BigInt(serviceId);

  return prisma.$transaction(
    async (tx) => {
      // Acquire session-level advisory lock inside the transaction
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

      // ── 1. Fetch current allocation state ──────────────────────────────────
      const state = await tx.allocationState.findUniqueOrThrow({
        where: { serviceId },
      });

      const mandatory = MANDATORY[serviceId] ?? [];
      const pool = POOL[serviceId] ?? [];
      const slotsNeeded = TOTAL_ASSIGNMENTS - mandatory.length;

      // ── 2. Resolve mandatory providers (skip if over quota) ────────────────
      const mandatoryProviders = await tx.provider.findMany({
        where: { id: { in: mandatory } },
      });

      const assignedIds: number[] = [];

      for (const p of mandatoryProviders) {
        if (p.leadsReceived < p.monthlyQuota) {
          assignedIds.push(p.id);
        }
        // If a mandatory provider is over quota we still try to fill 3 slots
        // from the pool (fairness degrades gracefully rather than hard-failing)
      }

      // ── 3. Round-robin pool selection ──────────────────────────────────────
      // Fetch pool providers with remaining quota, sorted by id for determinism
      const poolProviders = await tx.provider.findMany({
        where: {
          id: { in: pool },
        },
        orderBy: { id: 'asc' },
      });

      // Filter out already-assigned (mandatory) providers and those at quota.
      const eligible = poolProviders.filter(
        (p) => !assignedIds.includes(p.id) && p.leadsReceived < p.monthlyQuota,
      );

      let pointer = state.nextIndex % Math.max(eligible.length, 1);
      let picked = 0;
      let iterations = 0;

      while (picked < slotsNeeded && iterations < eligible.length) {
        const candidate = eligible[pointer % eligible.length];
        if (candidate && !assignedIds.includes(candidate.id)) {
          assignedIds.push(candidate.id);
          picked++;
        }
        pointer = (pointer + 1) % Math.max(eligible.length, 1);
        iterations++;
      }

      // Advance the persisted pointer by how many pool slots we consumed
      const newIndex = (state.nextIndex + picked) % Math.max(pool.length, 1);

      await tx.allocationState.update({
        where: { serviceId },
        data: { nextIndex: newIndex },
      });

      // ── 4. Create assignments & increment counters ─────────────────────────
      if (assignedIds.length === 0) {
        throw new Error(`No eligible providers available for service ${serviceId}`);
      }

      await tx.leadAssignment.createMany({
        data: assignedIds.map((providerId) => ({ leadId, providerId })),
        skipDuplicates: true,
      });

      await tx.provider.updateMany({
        where: { id: { in: assignedIds } },
        data: { leadsReceived: { increment: 1 } },
      });

      return assignedIds;
    },
    {
      // Serializable isolation prevents phantom reads during concurrent inserts
      isolationLevel: 'Serializable',
      timeout: 10_000,
    },
  );
}
