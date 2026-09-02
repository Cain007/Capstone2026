import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  {
    name: 'Admin',
    description: 'Full system access, including users, settings, reports, and audit logs.',
  },
  {
    name: 'Manager',
    description: 'Operational management access for products, suppliers, inventory, sales, and reports.',
  },
  {
    name: 'Staff',
    description: 'Daily operations access for inventory viewing and sales recording.',
  },
  {
    name: 'Viewer',
    description: 'Read-only access for dashboards and reports.',
  },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
