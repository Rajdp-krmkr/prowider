# Prowider — Mini Lead Distribution System

A full-stack Next.js application implementing a fair, concurrent-safe lead distribution system with real-time dashboard updates.

---

## Live Demo

> Add your Vercel/Render URL here after deployment.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Real-time | Server-Sent Events (SSE) |
| Styling | Tailwind CSS |

---

## Local Setup

```bash
# 1. Clone
git clone <your-repo-url>
cd prowider

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string

# 4. Push schema and seed data
npx prisma db push
npm run db:seed

# 5. Start dev server
npm run dev
```

Open http://localhost:3000

---

## Pages

| Route | Purpose |
|---|---|
| `/request-service` | Customer lead submission form |
| `/dashboard` | Provider dashboard with real-time updates |
| `/test-tools` | Internal testing panel (webhook, concurrency) |

---

## Allocation Algorithm

### Rules

| Service | Mandatory Providers | Optional Pool | Slots from Pool |
|---|---|---|---|
| Service 1 | P1 | P2, P3, P4 | 2 |
| Service 2 | P5 | P6, P7, P8 | 2 |
| Service 3 | P1, P4 | P2, P3, P5, P6, P7, P8 | 1 |

### Round-Robin (Fair Allocation)

A **persisted pointer** (`AllocationState.nextIndex`) is stored in PostgreSQL for each service. When a lead arrives:

1. Mandatory providers are resolved first (skipped if over quota).
2. The optional pool is filtered to providers with remaining quota.
3. Starting at `nextIndex`, we walk the pool array and pick the required number of slots.
4. `nextIndex` is advanced by the number of slots consumed and persisted immediately.
5. On server restart the pointer is read from the database — no state is lost.

This ensures deterministic rotation: Provider 2 → 3 → 4 → 2 → 3 → 4… for Service 1, never favouring the same provider twice in a row.

---

## Concurrency Handling

Two layers of protection:

### 1. PostgreSQL Advisory Lock (`pg_advisory_xact_lock`)
Called at the start of every allocation transaction, keyed by `serviceId`. This serialises concurrent lead creations for the **same service**, preventing two transactions from reading the same `nextIndex` simultaneously.

### 2. Serializable Transaction Isolation
The entire allocation (read state → compute → write assignments → advance pointer) runs in a `Serializable` transaction. Any conflicting concurrent transaction is automatically retried by Prisma.

### 3. Unique Database Constraint
`@@unique([phone, serviceId])` on `Lead` ensures duplicate leads are rejected at the database level even under race conditions.

---

## Webhook Idempotency

Every webhook call must include an `Idempotency-Key` header (a UUID or any unique string from the caller).

**Flow:**
1. On receipt, look up `WebhookEvent` by `id = Idempotency-Key`.
2. If found → return `{ status: "already_processed" }` immediately. No side effects.
3. If not found → execute business logic + insert `WebhookEvent` record atomically in a single transaction.

This guarantees exactly-once processing even if the payment gateway retries the webhook.

```
POST /api/webhook
Idempotency-Key: <uuid>
Content-Type: application/json

{ "action": "reset_quota" }
```

---

## Real-Time Updates

Uses **Server-Sent Events** (`/api/events`).

- The dashboard opens a persistent SSE connection on mount.
- When a lead is created, the API broadcasts a `lead_assigned` event.
- When quota is reset via webhook, a `quota_reset` event is broadcast.
- The dashboard listens for both events and re-fetches provider data automatically.
- A 25-second ping keeps the connection alive through proxies/firewalls.

---

## Database Schema

```
Service          Provider
───────          ────────
id               id
name             name
                 monthlyQuota
                 leadsReceived

Lead                     LeadAssignment
────                     ──────────────
id                       id
name                     leadId  → Lead
phone                    providerId → Provider
city                     assignedAt
serviceId → Service      [unique: leadId + providerId]
description
createdAt
[unique: phone + serviceId]

AllocationState          WebhookEvent
───────────────          ────────────
serviceId (unique)       id (idempotency key)
nextIndex                action
updatedAt                processedAt
```

---

## What We Tested

- ✅ Duplicate lead rejection (same phone + same service)
- ✅ Exactly 3 providers assigned per lead
- ✅ Mandatory providers always assigned (within quota)
- ✅ Round-robin pool rotation persisted across restarts
- ✅ 10 simultaneous leads created without corruption (concurrency test)
- ✅ Webhook called 5 times with same key → quota reset only once
- ✅ Dashboard updates within ~1 second of new lead creation
- ✅ Monthly quota enforced — no provider exceeds 10 leads
