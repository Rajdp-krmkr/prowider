import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assignProviders } from '@/lib/allocation';
import { broadcast } from '@/lib/sse';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  city: z.string().min(1),
  serviceId: z.coerce.number().int().min(1).max(3),
  description: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, phone, city, serviceId, description } = parsed.data;

    // ── Duplicate check (also enforced by DB unique constraint) ────────────────
    const existing = await prisma.lead.findUnique({
      where: { phone_serviceId: { phone, serviceId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This phone number already has a lead for the selected service.' },
        { status: 409 },
      );
    }

    // ── Create lead ────────────────────────────────────────────────────────────
    let lead;
    try {
      lead = await prisma.lead.create({
        data: { name, phone, city, serviceId, description },
      });
    } catch (e: unknown) {
      // Unique constraint violation from concurrent insert
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          { error: 'This phone number already has a lead for the selected service.' },
          { status: 409 },
        );
      }
      throw e;
    }

    // ── Assign providers ───────────────────────────────────────────────────────
    const assignedProviderIds = await assignProviders(lead.id, serviceId);

    // ── Broadcast real-time update to dashboard listeners ─────────────────────
    const fullLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        service: true,
        assignments: { include: { provider: true } },
      },
    });

    broadcast('lead_assigned', {
      lead: fullLead,
      providerIds: assignedProviderIds,
    });

    return NextResponse.json({ lead: fullLead, assignedProviderIds }, { status: 201 });
  } catch (error) {
    console.error('Failed to create lead', error);
    return NextResponse.json(
      { error: 'Failed to create lead. Please try again.' },
      { status: 500 },
    );
  }
}
