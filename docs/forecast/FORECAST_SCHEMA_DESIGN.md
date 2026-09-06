# Forecast Prisma Schema Design

## Prisma Schema

The forecast module is implemented in `backend/prisma/schema.prisma` with these enums and models:

```prisma
enum ForecastScope {
  GLOBAL
  CATEGORY
  PRODUCT
}

enum ForecastMethod {
  MOVING_AVERAGE
  EXPONENTIAL_SMOOTHING
  LINEAR_REGRESSION
}

enum ForecastGranularity {
  DAILY
  WEEKLY
  MONTHLY
}

enum ForecastRunStatus {
  DRAFT
  APPROVED
  PUBLISHED
}

model ForecastRun {
  id               String              @id @default(cuid())
  scope            ForecastScope
  targetKey        String              @db.VarChar(128)
  productId        String?
  categoryId       String?
  method           ForecastMethod
  granularity      ForecastGranularity
  sourceStartDate  DateTime            @db.Date
  sourceEndDate    DateTime            @db.Date
  horizonStartDate DateTime            @db.Date
  horizonEndDate   DateTime            @db.Date
  horizonPeriods   Int
  parameters       Json?
  status           ForecastRunStatus   @default(DRAFT)
  version          Int                 @default(1)
  modelVersion     String?             @db.VarChar(64)
  generatedById    String?
  generatedAt      DateTime            @default(now())
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  product     Product?        @relation("ProductForecastRuns", fields: [productId], references: [id], onDelete: Restrict)
  category    Category?       @relation("CategoryForecastRuns", fields: [categoryId], references: [id], onDelete: Restrict)
  generatedBy User?           @relation("ForecastRunGeneratedBy", fields: [generatedById], references: [id], onDelete: SetNull)
  points      ForecastPoint[]

  @@unique([scope, targetKey, method, granularity, sourceStartDate, sourceEndDate, horizonStartDate, horizonEndDate, horizonPeriods, version])
  @@index([scope, targetKey, method, granularity, horizonStartDate, horizonEndDate, version])
  @@index([scope, productId, generatedAt])
  @@index([scope, categoryId, generatedAt])
  @@index([method, generatedAt])
  @@index([status, generatedAt])
  @@index([generatedById, generatedAt])
  @@index([generatedAt])
}

model ForecastPoint {
  id                String   @id @default(cuid())
  forecastRunId     String
  periodStart       DateTime @db.Date
  periodEnd         DateTime @db.Date
  predictedQuantity Decimal  @db.Decimal(14, 4)
  confidenceLower   Decimal? @db.Decimal(14, 4)
  confidenceUpper   Decimal? @db.Decimal(14, 4)
  createdAt         DateTime @default(now())

  forecastRun ForecastRun @relation(fields: [forecastRunId], references: [id], onDelete: Cascade)

  @@unique([forecastRunId, periodStart])
  @@index([forecastRunId, periodStart])
  @@index([periodStart, periodEnd])
}
```

Related additive relation fields:

- `User.generatedForecastRuns @relation("ForecastRunGeneratedBy")`
- `Product.forecastRuns @relation("ProductForecastRuns")`
- `Category.forecastRuns @relation("CategoryForecastRuns")`
- `AuditEntityType.FORECAST_RUN`

## Rationale

`ForecastRun` stores the reproducible forecast configuration: scope, target, method, source sales window, forecast horizon, granularity, parameters, version, status, generator, and timestamps.

`ForecastPoint` stores one generated prediction per forecast period. Keeping points separate avoids duplicating run configuration across every horizon period and gives trend queries their own indexes.

`ForecastScope` keeps target design controlled. Product-level forecasts work now through `productId`; category and global forecasts are supported without inventing separate tables. `targetKey` is stored in addition to nullable target IDs because PostgreSQL composite unique constraints do not treat `NULL` as equal. The app should set:

- `GLOBAL`: `targetKey = "GLOBAL"`, `productId = null`, `categoryId = null`
- `CATEGORY`: `targetKey = categoryId`, `categoryId` set, `productId = null`
- `PRODUCT`: `targetKey = productId`, `productId` set, `categoryId = null`

`ForecastMethod` is an enum. The schema includes `MOVING_AVERAGE`, `EXPONENTIAL_SMOOTHING`, and `LINEAR_REGRESSION` now so the known next methods do not require another enum migration.

## Relations And Delete Rules

| Relation | Rule | Reason |
| --- | --- | --- |
| `ForecastRun.product -> Product` | `Restrict` | Product forecast history must not silently disappear. Archive products instead of deleting them. |
| `ForecastRun.category -> Category` | `Restrict` | Category forecast history must not silently disappear. Archive categories instead of deleting them. |
| `ForecastRun.generatedBy -> User` | `SetNull` | Losing a user account must never delete or block forecast history. |
| `ForecastPoint.forecastRun -> ForecastRun` | `Cascade` | Points have no independent meaning without their run. |

The workspace has `Sale`, `SaleItem`, `InventoryMovement`, and `StockLevel` models. Forecast evaluation compares persisted `ForecastPoint` predictions against completed `Sale`/`SaleItem` actual demand for matured Manila business dates.

## Unique Constraints And Indexes

- `ForecastRun` unique key on `[scope, targetKey, method, granularity, sourceStartDate, sourceEndDate, horizonStartDate, horizonEndDate, horizonPeriods, version]`: prevents duplicate versions for the same run definition.
- `ForecastRun [scope, targetKey, method, granularity, horizonStartDate, horizonEndDate, version]`: supports "latest forecast for this product/category/global scope" by ordering `version desc` or `generatedAt desc`.
- `ForecastRun [scope, productId, generatedAt]`: supports product forecast timelines.
- `ForecastRun [scope, categoryId, generatedAt]`: supports category forecast timelines.
- `ForecastRun [method, generatedAt]`: supports method performance review.
- `ForecastRun [status, generatedAt]`: supports approval and publication queues.
- `ForecastRun [generatedById, generatedAt]`: supports admin accountability reports.
- `ForecastPoint` unique key on `[forecastRunId, periodStart]`: one prediction per period per run.
- `ForecastPoint [forecastRunId, periodStart]`: supports charting one run over time.
- `ForecastPoint [periodStart, periodEnd]`: supports horizon/date-range trend queries.

## Versioning Strategy

Regeneration preserves history. For the same scope, target, method, source window, horizon, and granularity, the app creates a new `ForecastRun` with `version = previous version + 1`.

The latest forecast query should order by `version desc` and then `generatedAt desc` for the same run definition. Keeping every version is safer for defense, reporting, and auditability than overwriting old runs.

`ForecastRun` and `ForecastPoint` are write-once after generation. The only post-creation field that should change is `ForecastRun.status`, through controlled transitions:

`DRAFT -> APPROVED -> PUBLISHED`

Do not edit points or parameters after generation. Regenerate a new version instead.

## Computed Vs Persisted

Persist:

- Forecast run configuration.
- Forecast method and parameters.
- Source window and horizon.
- Generated forecast points.
- Generated-by user and timestamp.
- Approval/publication status.

Compute at query time:

- Trend deltas between forecast runs.
- Forecast evaluation against realized sales totals.
- Forecast MAE, WAPE, and bias.
- Product/category aggregate summaries.
- Inventory reorder recommendations.

Do not persist denormalized accuracy scores yet. Add a separate accuracy workflow later only if admins need to filter, approve, or compare runs by measured accuracy.

## SQL Constraints For Migration

Prisma cannot express conditional scope/target checks directly. Add these checks manually in the migration that creates the forecast tables:

```sql
ALTER TABLE "ForecastRun"
ADD CONSTRAINT "ForecastRun_scope_target_check"
CHECK (
  ("scope" = 'GLOBAL' AND "targetKey" = 'GLOBAL' AND "productId" IS NULL AND "categoryId" IS NULL)
  OR
  ("scope" = 'CATEGORY' AND "categoryId" IS NOT NULL AND "productId" IS NULL AND "targetKey" = "categoryId")
  OR
  ("scope" = 'PRODUCT' AND "productId" IS NOT NULL AND "categoryId" IS NULL AND "targetKey" = "productId")
);

ALTER TABLE "ForecastRun"
ADD CONSTRAINT "ForecastRun_window_check"
CHECK (
  "sourceStartDate" <= "sourceEndDate"
  AND "horizonStartDate" <= "horizonEndDate"
  AND "horizonPeriods" > 0
);

ALTER TABLE "ForecastPoint"
ADD CONSTRAINT "ForecastPoint_period_check"
CHECK ("periodStart" <= "periodEnd");
```

## Tradeoffs

The recommended strategy is two tables, run version history, and scoped nullable targets with `targetKey`. A single flattened table is simpler at first, but it duplicates configuration data and makes approval/versioning awkward.

`ForecastMethod` is an enum rather than a lookup table. This keeps code branches explicit and avoids a runtime method registry table. The tradeoff is that unknown future methods still require an enum migration, so the known near-future methods are included now.

Product and category relations use `Restrict`, not `SetNull`, because forecast history should remain tied to the exact business target. Archive product/category records instead of hard-deleting them.
