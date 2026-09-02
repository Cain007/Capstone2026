# Sale And SaleItem Prisma Schema Design

## Prisma Schema

The sales module is implemented in `backend/prisma/schema.prisma` with these enums and models:

```prisma
enum SaleStatus {
  DRAFT
  COMPLETED
  CANCELLED
}

enum SalePaymentStatus {
  PENDING
  PAID
  FAILED
  CANCELLED
}

enum SalePaymentMethod {
  CASH
  CARD
  E_WALLET
  BANK_TRANSFER
  OTHER
}

model Sale {
  id                    String            @id @default(cuid())
  saleNumber            String            @unique
  soldAt                DateTime          @default(now())
  status                SaleStatus        @default(DRAFT)
  cashierId             String?
  cashierUserIdSnapshot String
  cashierEmailSnapshot  String
  customerReference     String?
  customerNameSnapshot  String?
  paymentStatus         SalePaymentStatus @default(PENDING)
  paymentMethod         SalePaymentMethod
  subtotalCents         Int               @default(0)
  discountCents         Int               @default(0)
  taxCents              Int               @default(0)
  grandTotalCents       Int               @default(0)
  notes                 String?
  completedAt           DateTime?
  cancelledAt           DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  cashier User?      @relation("SaleCashier", fields: [cashierId], references: [id], onDelete: SetNull)
  items   SaleItem[]

  @@index([soldAt])
  @@index([cashierId, soldAt])
  @@index([status, soldAt])
  @@index([paymentStatus, soldAt])
}

model SaleItem {
  id                  String   @id @default(cuid())
  saleId              String
  productId           String
  lineNumber          Int
  productNameSnapshot String
  skuSnapshot         String
  unitPriceCents      Int
  quantity            Decimal  @db.Decimal(14, 4)
  discountCents       Int      @default(0)
  taxCents            Int      @default(0)
  lineTotalCents      Int
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  sale    Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product Product @relation("ProductSaleItems", fields: [productId], references: [id], onDelete: Restrict)

  @@unique([saleId, lineNumber])
  @@index([saleId])
  @@index([productId])
  @@index([productId, createdAt])
}
```

Related additive relation fields:

- `User.cashierSales @relation("SaleCashier")`
- `Product.saleItems @relation("ProductSaleItems")`

## Rationale

`Sale` is the transaction header. It stores the transaction number, checkout timestamp, status, cashier, optional customer reference, payment state, payment method, and checkout totals.

`SaleItem` is the immutable line-level sales record. It references the sold product and stores required product snapshots: `productNameSnapshot`, `skuSnapshot`, and `unitPriceCents`.

The cashier relation is nullable in the database because it uses `SetNull` when a user is deleted. The cashier is still required at sale creation in the service layer. `cashierUserIdSnapshot` and `cashierEmailSnapshot` keep completed sales readable after user deletion.

All sale money uses integer minor units (`Cents`) to avoid floating-point rounding errors. This intentionally differs from the current `Product.price` and `Product.cost` decimal fields in the existing schema; sale records use snapshots and should not depend on live product pricing.

`quantity` uses `Decimal(14,4)` instead of `Int` so the model can support piece-based items now and weighted/liquid units later.

## Stock Deduction Integration

Sales must not store stock balances or stock-deducted quantities outside the inventory ledger.

On `Sale` completion:

1. Validate the sale is still `DRAFT`.
2. Validate all items and totals.
3. Create one append-only stock-out `InventoryMovement` per `SaleItem`.
4. Link each movement back to its source sale item, for example with future `InventoryMovement.sourceSaleItemId`.
5. Update `StockLevel` through the inventory service/transaction, not through fields on `Sale` or `SaleItem`.
6. Mark the sale `COMPLETED`.

Cancelling a `DRAFT` sale must not touch inventory because no stock was deducted.

Voiding a `COMPLETED` sale must create reversing inventory movements. Never delete the original movements and never delete the completed sale.

The current workspace does not yet contain `InventoryMovement` or `StockLevel`, so this schema does not add foreign keys to missing models. When the inventory ledger is added, `InventoryMovement.sourceSaleItemId` should point to `SaleItem` and completed sales should remain hard-delete protected at the service layer.

## Relations And Delete Rules

| Relation | Rule | Reason |
| --- | --- | --- |
| `Sale.cashier -> User` | `SetNull` | Losing a user account must never delete or block sales history. Snapshots preserve cashier identity. |
| `SaleItem.sale -> Sale` | `Cascade` | A draft sale item has no independent meaning without its sale header. Completed sales should not be hard-deleted by application code. |
| `SaleItem.product -> Product` | `Restrict` | A product with sale history cannot be deleted; archive products instead. |

Completed `Sale` records should never be hard-deleted at the application layer. Cancellation and voiding are status transitions plus ledger movements, not deletes.

## Unique Constraints, Checks, And Indexes

Unique constraints:

- `Sale.saleNumber`: stable receipt/transaction lookup.
- `SaleItem [saleId, lineNumber]`: preserves receipt line ordering without preventing the same product from appearing multiple times.

Indexes:

- `Sale [soldAt]`: daily, weekly, monthly sales reports.
- `Sale [cashierId, soldAt]`: sales-by-cashier reports.
- `Sale [status, soldAt]`: completed/cancelled/draft queues and reports.
- `Sale [paymentStatus, soldAt]`: payment reconciliation.
- `SaleItem [saleId]`: loading receipt lines.
- `SaleItem [productId]`: top-selling-product queries.
- `SaleItem [productId, createdAt]`: product sales trend queries.

Prisma has no native `@check` attribute. Add check constraints manually after `prisma migrate dev --create-only`, then edit the generated SQL:

```sql
ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_amounts_nonnegative_check"
CHECK (
  "subtotalCents" >= 0
  AND "discountCents" >= 0
  AND "taxCents" >= 0
  AND "grandTotalCents" >= 0
);

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_completed_cancelled_dates_check"
CHECK (
  ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL)
  AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
);

ALTER TABLE "SaleItem"
ADD CONSTRAINT "SaleItem_values_check"
CHECK (
  "lineNumber" > 0
  AND "quantity" > 0
  AND "unitPriceCents" >= 0
  AND "discountCents" >= 0
  AND "taxCents" >= 0
  AND "lineTotalCents" >= 0
);
```

The service layer should also validate that `grandTotalCents = subtotalCents - discountCents + taxCents` if no additional charges are introduced later.

## Financial Integrity

Snapshots are required because a completed sale must remain readable after product edits:

- Product name can change.
- SKU can change.
- Product price can change.
- Product can be archived.

Checkout totals are computed once and persisted as the source of truth. Reports should read stored sale totals, not recompute live from current product data.

A reconciliation query can compare `sum(SaleItem.lineTotalCents)` against `Sale.subtotalCents` to detect drift. The stored checkout values still remain the official transaction record.

## Reporting

Compute these at query time from `Sale` and `SaleItem`:

- Daily, weekly, and monthly totals.
- Top products.
- Sales by cashier.
- Tax summaries.
- Discount summaries.
- Product/category sales trends.

Do not store pre-aggregated report totals for the MVP. Add rollup tables later only if query volume or data size requires it.

## Tradeoffs

Duplicate product lines are allowed. A POS may scan the same product twice under different discounts, corrections, or scan events. The schema preserves this by using `lineNumber` rather than a unique `[saleId, productId]` constraint.

Refunds and returns are intentionally out of scope. Add a separate return/refund model later so the completed sale remains immutable.

Void-vs-delete recommendation: never delete completed sales. Use status transitions and reversing inventory movements. Hard delete is acceptable only for abandoned draft cleanup before inventory has been touched.

