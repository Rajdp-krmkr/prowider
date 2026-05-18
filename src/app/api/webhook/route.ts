// Webhook endpoint for payment gateway simulation.
// Idempotency: every request must carry an `Idempotency-Key` header.
// If the key has already been processed, return 200 immediately
// without re-executing business logic.

// Supported actions:
//  - reset_quota → reset all provider leadsReceived to 0, quota to 10

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcast } from '@/lib/sse';

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Idempotency-Key header is required' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? 'reset_quota';

  // ── Idempotency check ──────────────────────────────────────────────────────
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: idempotencyKey },
  });

  if (existing) {
    return NextResponse.json(
      { status: 'already_processed', action: existing.action, processedAt: existing.processedAt },
      { status: 200 },
    );
  }

  // ── Process action ─────────────────────────────────────────────────────────
  if (action === 'reset_quota') {
    await prisma.$transaction([
      prisma.provider.updateMany({
        data: { leadsReceived: 0, monthlyQuota: 10 },
      }),
      prisma.webhookEvent.create({
        data: { id: idempotencyKey, action },
      }),
    ]);

    broadcast('quota_reset', { message: 'All provider quotas have been reset to 10.' });

    return NextResponse.json({ status: 'processed', action }, { status: 200 });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
