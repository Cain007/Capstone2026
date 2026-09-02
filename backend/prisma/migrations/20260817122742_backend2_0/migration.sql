-- CreateEnum
CREATE TYPE "ForecastScope" AS ENUM ('GLOBAL', 'CATEGORY', 'PRODUCT');

-- CreateEnum
CREATE TYPE "ForecastMethod" AS ENUM ('MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING', 'LINEAR_REGRESSION');

-- CreateEnum
CREATE TYPE "ForecastGranularity" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ForecastRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalePaymentMethod" AS ENUM ('CASH', 'CARD', 'E_WALLET', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_RECEIPT', 'SALE_DEDUCTION', 'STOCK_ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT', 'DAMAGE', 'LOSS', 'INITIAL_STOCK');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'FORECAST_RUN';

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "scope" "ForecastScope" NOT NULL,
    "targetKey" VARCHAR(128) NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "method" "ForecastMethod" NOT NULL,
    "granularity" "ForecastGranularity" NOT NULL,
    "sourceStartDate" DATE NOT NULL,
    "sourceEndDate" DATE NOT NULL,
    "horizonStartDate" DATE NOT NULL,
    "horizonEndDate" DATE NOT NULL,
    "horizonPeriods" INTEGER NOT NULL,
    "parameters" JSONB,
    "status" "ForecastRunStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "modelVersion" VARCHAR(64),
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastPoint" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "predictedQuantity" DECIMAL(14,4) NOT NULL,
    "confidenceLower" DECIMAL(14,4),
    "confidenceUpper" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "cashierId" TEXT,
    "cashierUserIdSnapshot" TEXT NOT NULL,
    "cashierEmailSnapshot" TEXT NOT NULL,
    "customerReference" TEXT,
    "customerNameSnapshot" TEXT,
    "paymentStatus" "SalePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "SalePaymentMethod" NOT NULL,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "grandTotalCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "unitCostCents" INTEGER,
    "performedById" TEXT,
    "saleItemId" TEXT,
    "reversesMovementId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForecastRun_scope_targetKey_method_granularity_horizonStart_idx" ON "ForecastRun"("scope", "targetKey", "method", "granularity", "horizonStartDate", "horizonEndDate", "version");

-- CreateIndex
CREATE INDEX "ForecastRun_scope_productId_generatedAt_idx" ON "ForecastRun"("scope", "productId", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_scope_categoryId_generatedAt_idx" ON "ForecastRun"("scope", "categoryId", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_method_generatedAt_idx" ON "ForecastRun"("method", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_status_generatedAt_idx" ON "ForecastRun"("status", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_generatedById_generatedAt_idx" ON "ForecastRun"("generatedById", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_generatedAt_idx" ON "ForecastRun"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastRun_scope_targetKey_method_granularity_sourceStartD_key" ON "ForecastRun"("scope", "targetKey", "method", "granularity", "sourceStartDate", "sourceEndDate", "horizonStartDate", "horizonEndDate", "horizonPeriods", "version");

-- CreateIndex
CREATE INDEX "ForecastPoint_forecastRunId_periodStart_idx" ON "ForecastPoint"("forecastRunId", "periodStart");

-- CreateIndex
CREATE INDEX "ForecastPoint_periodStart_periodEnd_idx" ON "ForecastPoint"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastPoint_forecastRunId_periodStart_key" ON "ForecastPoint"("forecastRunId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Sale_cashierId_soldAt_idx" ON "Sale"("cashierId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_status_soldAt_idx" ON "Sale"("status", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_paymentStatus_soldAt_idx" ON "Sale"("paymentStatus", "soldAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_createdAt_idx" ON "SaleItem"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_lineNumber_key" ON "SaleItem"("saleId", "lineNumber");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_performedById_idx" ON "InventoryMovement"("performedById");

-- CreateIndex
CREATE INDEX "InventoryMovement_saleItemId_idx" ON "InventoryMovement"("saleItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_reversesMovementId_idx" ON "InventoryMovement"("reversesMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_productId_key" ON "StockLevel"("productId");

-- CreateIndex
CREATE INDEX "StockLevel_currentQuantity_idx" ON "StockLevel"("currentQuantity");

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastRun" ADD CONSTRAINT "ForecastRun_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastPoint" ADD CONSTRAINT "ForecastPoint_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "InventoryMovement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
