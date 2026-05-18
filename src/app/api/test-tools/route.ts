import { NextRequest, NextResponse } from 'next/server';

/**
 * Test tooling endpoint — NOT accessible from normal user UI.
 * Generates N leads simultaneously to stress-test concurrency & allocation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count: number = Math.min(body.count ?? 10, 50);

  const base = Date.now();
  const services = [1, 2, 3];

  const promises = Array.from({ length: count }, (_, i) => {
    const serviceId = services[i % 3];
    return fetch(`${req.nextUrl.origin}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test User ${base + i}`,
        phone: `TEST${base + i}`,
        city: 'TestCity',
        serviceId,
        description: `Concurrency test lead #${i + 1}`,
      }),
    }).then((r) => r.json());
  });

  const results = await Promise.allSettled(promises);

  const summary = {
    total: count,
    success: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };

  return NextResponse.json(summary);
}
