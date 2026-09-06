import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const roles = [
  {
    name: 'Admin',
    description: 'Full system access, including users, settings, reports, and audit logs.',
  },
  {
    name: 'Staff',
    description: 'Daily operations access for inventory viewing and sales recording.',
  },
];

const demoCategories = [
  { name: 'Demo Vape Devices', slug: 'demo-vape-devices', sortOrder: 1 },
  { name: 'Demo E-Liquids', slug: 'demo-e-liquids', sortOrder: 2 },
  { name: 'Demo Accessories', slug: 'demo-accessories', sortOrder: 3 },
];

const demoProducts = [
  {
    sku: 'DEMO-001',
    slug: 'demo-cloud-bar-mint',
    name: 'Demo Cloud Bar Mint',
    categorySlug: 'demo-vape-devices',
    unitType: 'PIECE' as const,
    priceCents: 55000,
    costCents: 36000,
    reorderPoint: 20,
    currentStock: 12,
  },
  {
    sku: 'DEMO-002',
    slug: 'demo-pod-kit-pro',
    name: 'Demo Pod Kit Pro',
    categorySlug: 'demo-vape-devices',
    unitType: 'PIECE' as const,
    priceCents: 145000,
    costCents: 90000,
    reorderPoint: 15,
    currentStock: 48,
  },
  {
    sku: 'DEMO-003',
    slug: 'demo-mango-eliquid',
    name: 'Demo Mango E-Liquid',
    categorySlug: 'demo-e-liquids',
    unitType: 'BOTTLE' as const,
    priceCents: 32000,
    costCents: 18000,
    reorderPoint: 12,
    currentStock: 8,
  },
  {
    sku: 'DEMO-004',
    slug: 'demo-coil-pack',
    name: 'Demo Coil Pack',
    categorySlug: 'demo-accessories',
    unitType: 'PACK' as const,
    priceCents: 28000,
    costCents: 14000,
    reorderPoint: 10,
    currentStock: 2,
  },
  {
    sku: 'DEMO-005',
    slug: 'demo-empty-clearance',
    name: 'Demo Empty Clearance Item',
    categorySlug: 'demo-accessories',
    unitType: 'PIECE' as const,
    priceCents: 12000,
    costCents: 6000,
    reorderPoint: 5,
    currentStock: 0,
  },
];

const demoSupplier = {
  supplierCode: 'DEMO-SUP-001',
  name: 'Demo Cloud Supply Co.',
  email: 'orders@example.invalid',
  phone: '+63 900 000 0000',
  city: 'Davao City',
  province: 'Davao del Sur',
};

const sourceDemand = [4, 6, 5, 7, 5, 4, 6, 5, 5, 7, 4, 6, 5, 5];
const evaluationActuals = [4, 6, 5, 3, 5];
const forecastPredictions = [5, 5, 5, 5, 5];

function envFlag(name: string) {
  return process.env[name]?.toLowerCase() === 'true';
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when DEMO_SEED=true`);
  }
  return value;
}

function requireDemoCredentials() {
  const credentials = {
    adminEmail: requiredEnv('DEMO_ADMIN_EMAIL').toLowerCase(),
    adminUsername: requiredEnv('DEMO_ADMIN_USERNAME').toLowerCase(),
    adminPassword: requiredEnv('DEMO_ADMIN_PASSWORD'),
    staffEmail: requiredEnv('DEMO_STAFF_EMAIL').toLowerCase(),
    staffUsername: requiredEnv('DEMO_STAFF_USERNAME').toLowerCase(),
    staffPassword: requiredEnv('DEMO_STAFF_PASSWORD'),
  };

  if (credentials.adminPassword.length < 8 || credentials.staffPassword.length < 8) {
    throw new Error('Demo passwords must be at least eight characters');
  }

  return credentials;
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDays(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dateOnly(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function manilaNoonUtc(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4));
}

function centsToDecimal(cents: number) {
  return new Prisma.Decimal(cents).div(100);
}

function saleNumber(index: number) {
  return `DEMO-SALE-${String(index).padStart(3, '0')}`;
}

async function seedRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, status: 'ACTIVE' },
      create: role,
    });
  }
}

async function clearDemoData(credentials: ReturnType<typeof requireDemoCredentials>) {
  const demoProductRecords = await prisma.product.findMany({
    where: { sku: { in: demoProducts.map((product) => product.sku) } },
    select: { id: true },
  });
  const demoProductIds = demoProductRecords.map((product) => product.id);
  const demoPurchaseOrders = await prisma.purchaseOrder.findMany({
    where: { poNumber: { startsWith: 'DEMO-PO-' } },
    select: { id: true },
  });
  const demoPurchaseOrderIds = demoPurchaseOrders.map((purchaseOrder) => purchaseOrder.id);
  const demoPurchaseOrderItems = demoPurchaseOrderIds.length
    ? await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: { in: demoPurchaseOrderIds } },
        select: { id: true },
      })
    : [];
  const demoSaleItems = await prisma.saleItem.findMany({
    where: { sale: { saleNumber: { startsWith: 'DEMO-SALE-' } } },
    select: { id: true },
  });
  const movementScopes: Prisma.InventoryMovementWhereInput[] = [];

  if (demoProductIds.length) movementScopes.push({ productId: { in: demoProductIds } });
  if (demoSaleItems.length) movementScopes.push({ saleItemId: { in: demoSaleItems.map((item) => item.id) } });
  if (demoPurchaseOrderItems.length) {
    movementScopes.push({
      purchaseOrderItemId: { in: demoPurchaseOrderItems.map((item) => item.id) },
    });
  }

  if (movementScopes.length) {
    await prisma.inventoryMovement.deleteMany({ where: { OR: movementScopes } });
  }
  if (demoProductIds.length) {
    await prisma.forecastRun.deleteMany({ where: { productId: { in: demoProductIds } } });
  }
  await prisma.sale.deleteMany({ where: { saleNumber: { startsWith: 'DEMO-SALE-' } } });
  if (demoPurchaseOrderIds.length) {
    await prisma.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: { in: demoPurchaseOrderIds } },
    });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: demoPurchaseOrderIds } } });
  }
  if (demoProductIds.length) {
    await prisma.stockLevel.deleteMany({ where: { productId: { in: demoProductIds } } });
    await prisma.product.deleteMany({ where: { id: { in: demoProductIds } } });
  }
  await prisma.supplier.deleteMany({ where: { supplierCode: demoSupplier.supplierCode } });
  await prisma.category.deleteMany({
    where: { slug: { in: demoCategories.map((category) => category.slug) } },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: [credentials.adminEmail, credentials.staffEmail] } },
        { username: { in: [credentials.adminUsername, credentials.staffUsername] } },
      ],
    },
  });
}

async function createDemoUsers(credentials: ReturnType<typeof requireDemoCredentials>) {
  const [adminRole, staffRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } }),
    prisma.role.findUniqueOrThrow({ where: { name: 'Staff' } }),
  ]);
  const [adminHash, staffHash] = await Promise.all([
    bcrypt.hash(credentials.adminPassword, 12),
    bcrypt.hash(credentials.staffPassword, 12),
  ]);

  const admin = await prisma.user.create({
    data: {
      fullName: 'Demo Administrator',
      username: credentials.adminUsername,
      email: credentials.adminEmail,
      passwordHash: adminHash,
      roleId: adminRole.id,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  const staff = await prisma.user.create({
    data: {
      fullName: 'Demo Staff',
      username: credentials.staffUsername,
      email: credentials.staffEmail,
      passwordHash: staffHash,
      roleId: staffRole.id,
      status: 'ACTIVE',
      mustChangePassword: false,
      createdById: admin.id,
    },
  });

  return { admin, staff };
}

async function createDemoCatalog() {
  const categories = new Map<string, { id: string }>();
  for (const category of demoCategories) {
    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    categories.set(category.slug, created);
  }

  const products = new Map<string, { id: string; sku: string; name: string; priceCents: number }>();
  for (const product of demoProducts) {
    const category = categories.get(product.categorySlug);
    if (!category) throw new Error(`Missing demo category ${product.categorySlug}`);

    const created = await prisma.product.create({
      data: {
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        status: 'ACTIVE',
        unitType: product.unitType,
        price: centsToDecimal(product.priceCents),
        cost: centsToDecimal(product.costCents),
        reorderPoint: product.reorderPoint,
        categoryId: category.id,
        stockLevel: { create: { currentQuantity: product.currentStock } },
      },
      select: { id: true, sku: true, name: true },
    });
    products.set(product.sku, { ...created, priceCents: product.priceCents });

    await prisma.inventoryMovement.create({
      data: {
        productId: created.id,
        quantityChange: product.currentStock,
        movementType: 'INITIAL_STOCK',
        unitCostCents: product.costCents,
        note: 'Demo opening stock fixture',
      },
    });
  }

  return products;
}

async function createDemoSupplier() {
  return prisma.supplier.create({
    data: {
      ...demoSupplier,
      status: 'ACTIVE',
      contacts: {
        create: {
          fullName: 'Demo Purchasing Contact',
          position: 'Account Representative',
          email: demoSupplier.email,
          phone: demoSupplier.phone,
          isPrimary: true,
        },
      },
    },
  });
}

async function createCompletedSale(
  index: number,
  product: { id: string; sku: string; name: string; priceCents: number },
  quantity: number,
  soldAtKey: string,
  staff: { id: string; email: string },
) {
  const lineTotalCents = product.priceCents * quantity;
  const soldAt = manilaNoonUtc(soldAtKey);
  const sale = await prisma.sale.create({
    data: {
      saleNumber: saleNumber(index),
      soldAt,
      status: 'COMPLETED',
      cashierId: staff.id,
      cashierUserIdSnapshot: staff.id,
      cashierEmailSnapshot: staff.email,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      subtotalCents: lineTotalCents,
      grandTotalCents: lineTotalCents,
      cashReceivedCents: lineTotalCents + 5000,
      changeDueCents: 5000,
      completedAt: soldAt,
      notes: 'Demo historical sales fixture',
    },
  });
  const saleItem = await prisma.saleItem.create({
    data: {
      saleId: sale.id,
      productId: product.id,
      lineNumber: 1,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPriceCents: product.priceCents,
      quantity: new Prisma.Decimal(quantity),
      lineTotalCents,
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      productId: product.id,
      quantityChange: -quantity,
      movementType: 'SALE_DEDUCTION',
      saleItemId: saleItem.id,
      note: 'Demo sale stock deduction fixture',
    },
  });
}

async function createSalesHistory(
  products: Map<string, { id: string; sku: string; name: string; priceCents: number }>,
  staff: { id: string; email: string },
) {
  const primary = products.get('DEMO-001');
  const secondary = products.get('DEMO-002');
  if (!primary || !secondary) throw new Error('Missing demo sales products');

  const today = dateKey();
  const sourceStart = addDays(today, -19);
  let index = 1;

  for (const [offset, quantity] of [...sourceDemand, ...evaluationActuals].entries()) {
    await createCompletedSale(index, primary, quantity, addDays(sourceStart, offset), staff);
    index += 1;
  }

  for (let offset = 0; offset < 5; offset += 1) {
    await createCompletedSale(index, secondary, 1 + (offset % 2), addDays(today, -10 + offset), staff);
    index += 1;
  }
}

async function createForecastFixture(
  products: Map<string, { id: string; sku: string; name: string; priceCents: number }>,
  admin: { id: string },
) {
  const primary = products.get('DEMO-001');
  if (!primary) throw new Error('Missing primary demo product');

  const today = dateKey();
  const horizonStart = addDays(today, -5);
  const horizonEnd = addDays(today, -1);
  const sourceStart = addDays(horizonStart, -14);
  const sourceEnd = addDays(horizonStart, -1);

  await prisma.forecastRun.create({
    data: {
      scope: 'PRODUCT',
      targetKey: primary.id,
      productId: primary.id,
      method: 'MOVING_AVERAGE',
      granularity: 'DAILY',
      sourceStartDate: dateOnly(sourceStart),
      sourceEndDate: dateOnly(sourceEnd),
      horizonStartDate: dateOnly(horizonStart),
      horizonEndDate: dateOnly(horizonEnd),
      horizonPeriods: forecastPredictions.length,
      parameters: {
        windowDays: 14,
        horizonDays: forecastPredictions.length,
        aggregation: 'DAILY',
        timezone: 'Asia/Manila',
        historyDaysUsed: 14,
        isLimitedHistory: false,
        averageDailyDemand: 5,
      },
      status: 'DRAFT',
      version: 1,
      modelVersion: 'moving-average-v1-demo',
      generatedById: admin.id,
      generatedAt: manilaNoonUtc(sourceEnd),
      points: {
        create: forecastPredictions.map((quantity, index) => ({
          periodStart: dateOnly(addDays(horizonStart, index)),
          periodEnd: dateOnly(addDays(horizonStart, index)),
          predictedQuantity: new Prisma.Decimal(quantity),
        })),
      },
    },
  });
}

async function createPurchaseOrderFixture(
  products: Map<string, { id: string; sku: string; name: string; priceCents: number }>,
  supplier: { id: string },
  admin: { id: string },
) {
  const product = products.get('DEMO-003');
  if (!product) throw new Error('Missing demo PO product');

  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'DEMO-PO-DRAFT-001',
      supplierId: supplier.id,
      status: 'DRAFT',
      expectedDeliveryDate: dateOnly(addDays(dateKey(), 5)),
      subtotalCents: 18000 * 20,
      createdById: admin.id,
      notes: 'Demo draft PO fixture for defense walkthrough',
      items: {
        create: {
          productId: product.id,
          quantityOrdered: 20,
          unitCostCents: 18000,
          lineTotalCents: 18000 * 20,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
        },
      },
    },
  });
}

async function seedDemoData() {
  const credentials = requireDemoCredentials();
  await clearDemoData(credentials);
  const users = await createDemoUsers(credentials);
  const products = await createDemoCatalog();
  const supplier = await createDemoSupplier();
  await createSalesHistory(products, users.staff);
  await createForecastFixture(products, users.admin);
  await createPurchaseOrderFixture(products, supplier, users.admin);

  console.log('Demo seed completed.');
  console.log(`Roles: ${roles.length}`);
  console.log('Users: 2');
  console.log(`Categories: ${demoCategories.length}`);
  console.log(`Products: ${demoProducts.length}`);
  console.log(`Historical sales: ${sourceDemand.length + evaluationActuals.length + 5}`);
  console.log('Forecast fixture: ready');
  console.log('Purchase order fixtures: 1');
}

async function main() {
  await seedRoles();

  if (!envFlag('DEMO_SEED')) {
    console.log('Base seed completed. Roles are ready.');
    console.log('Set DEMO_SEED=true with demo credential env vars to load defense demo data.');
    return;
  }

  await seedDemoData();
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
