import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Upsert Services
  const services = await Promise.all([
    prisma.service.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Service 1' } }),
    prisma.service.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Service 2' } }),
    prisma.service.upsert({ where: { id: 3 }, update: {}, create: { id: 3, name: 'Service 3' } }),
  ]);

  // Upsert 8 Providers
  for (let i = 1; i <= 8; i++) {
    await prisma.provider.upsert({
      where: { id: i },
      update: {},
      create: { id: i, name: `Provider ${i}`, monthlyQuota: 10, leadsReceived: 0 },
    });
  }

  // Upsert AllocationState (round-robin pointer per service)
  for (const service of services) {
    await prisma.allocationState.upsert({
      where: { serviceId: service.id },
      update: {},
      create: { serviceId: service.id, nextIndex: 0 },
    });
  }

  console.log('✅ Seed complete: 3 services, 8 providers, allocation state initialized');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
