import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { id: "asc" },
      include: {
        assignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 },
    );
  }
}
