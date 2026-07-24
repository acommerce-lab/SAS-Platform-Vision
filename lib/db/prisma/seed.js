/**
 * Database seed — creates a default admin account.
 * Run: pnpm --filter @workspace/db run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ─── Admin user ───────────────────────────────────────────────────────────
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@sas-platform.com' },
    update: {},
    create: {
      name: 'SAS Admin',
      email: 'admin@sas-platform.com',
    },
  });
  console.log('Admin seeded:', admin.id);

  // ─── Demo carrier ─────────────────────────────────────────────────────────
  const carrier = await prisma.carrier.upsert({
    where: { email: 'carrier@demo.com' },
    update: {},
    create: {
      name: 'Al-Haramain Logistics',
      email: 'carrier@demo.com',
      phone: '+966501234567',
      status: 'ACTIVE',
      vehicles: {
        create: [
          { vehicle_type: 'FLATBED', vehicle_category: 'SINGLE_TRUCK', plate_number: 'ABC-1234' },
          { vehicle_type: 'REFRIGERATED', vehicle_category: 'TRAILER', plate_number: 'XYZ-5678' },
        ],
      },
      drivers: {
        create: [
          { name: 'Ahmed Al-Rashidi', phone: '+966509876543', status: 'ACTIVE' },
          { name: 'Khalid Al-Mutairi', phone: '+966501112233', status: 'ACTIVE' },
        ],
      },
    },
  });
  console.log('Carrier seeded:', carrier.id);

  // ─── Demo shipper ─────────────────────────────────────────────────────────
  const shipper = await prisma.shipper.upsert({
    where: { email: 'shipper@demo.com' },
    update: {},
    create: {
      name: 'Saudi Steel Co.',
      email: 'shipper@demo.com',
      phone: '+966502223344',
      status: 'ACTIVE',
    },
  });
  console.log('Shipper seeded:', shipper.id);

  console.log('\nSeed complete. Demo credentials (dev only — Firebase not yet configured):');
  console.log('  Admin:   admin@sas-platform.com');
  console.log('  Carrier: carrier@demo.com');
  console.log('  Shipper: shipper@demo.com');
  console.log('  Password: any (Firebase auth disabled in dev mode)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
