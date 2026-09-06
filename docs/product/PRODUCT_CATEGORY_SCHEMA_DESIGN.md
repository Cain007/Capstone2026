# Product And Category Prisma Schema Design

## Prisma Schema

The product and category module is implemented in `backend/prisma/schema.prisma` with these enums and models:

```prisma
enum CategoryStatus {
  ACTIVE
  ARCHIVED
}

enum ProductStatus {
  DRAFT
  ACTIVE
  DISCONTINUED
  ARCHIVED
}

enum ProductUnitType {
  PIECE
  PACK
  BOX
  BOTTLE
  CARTON
  GRAM
  MILLILITER
}

model Category {
  id          String         @id @default(cuid())
  name        String
  slug        String         @unique
  description String?
  status      CategoryStatus @default(ACTIVE)
  parentId    String?
  sortOrder   Int            @default(0)
  createdById String?
  updatedById String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  parent    Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryHierarchy")
  products  Product[]
  createdBy User?      @relation("CategoryCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedBy User?      @relation("CategoryUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([name])
  @@index([parentId])
  @@index([sortOrder])
  @@index([createdById])
  @@index([updatedById])
}

model Product {
  id          String          @id @default(cuid())
  sku         String          @unique
  slug        String          @unique
  name        String
  description String?
  status      ProductStatus   @default(DRAFT)
  unitType    ProductUnitType @default(PIECE)
  price       Decimal         @db.Decimal(12, 2)
  cost        Decimal?        @db.Decimal(12, 2)
  reorderPoint Int?
  categoryId  String
  createdById String?
  updatedById String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  category  Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdBy User?    @relation("ProductCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedBy User?    @relation("ProductUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([categoryId])
  @@index([status])
  @@index([unitType])
  @@index([name])
  @@index([createdById])
  @@index([updatedById])
}
```

## Rationale

`Product` is the master catalog entity. Inventory, purchase-order items, sales items, reports, and forecasting records should reference `Product.id` later instead of duplicating product details.

`Category` is a single-category assignment for each product. This is simpler for CRUD, reporting, and inventory filters than many-to-many tagging. A category tree is supported with `parentId`, but products still belong to one category only.

`ProductStatus` and `CategoryStatus` provide soft delete through `ARCHIVED`. Hard delete should be rare because products and categories become part of historical business records once inventory, purchasing, and sales are added.

`ProductUnitType` avoids inconsistent unit labels such as `pcs`, `piece`, and `PC`.

Audit fields are nullable and use `SetNull` so deleting a user never deletes or blocks products/categories. They are useful for later admin permissions and reporting without forcing RBAC into the schema today.

## Relations And Delete Rules

| Relation | Rule | Reason |
| --- | --- | --- |
| `Product.category -> Category` | `Restrict` | A category with products should not disappear and orphan catalog records. Archive it instead. |
| `Category.parent -> Category` | `Restrict` | Parent categories with children should be reorganized or archived, not silently deleted. |
| `Product.createdBy/updatedBy -> User` | `SetNull` | Historical product records survive deleted user accounts. |
| `Category.createdBy/updatedBy -> User` | `SetNull` | Historical category records survive deleted user accounts. |

## Indexes And Unique Constraints

- `Product.sku` is unique because SKU is the stable operational identifier.
- `Product.slug` is unique for URL-safe frontend routes and lookup.
- `Category.slug` is unique for URL-safe category routes and lookup.
- `Product.categoryId` supports product listing by category.
- `Product.status` supports active/draft/discontinued/archive filters.
- `Product.unitType` supports reporting and inventory grouping by unit.
- `Product.name` and `Category.name` support basic search and ordered listing.
- `Category.parentId` and `Category.sortOrder` support category navigation.
- Audit foreign keys are indexed for future reporting.

## Computed Vs Stored

Store source data: SKU, slug, name, description, status, unit type, price, cost, and category.

The current implementation also stores an optional integer `reorderPoint` on Product. Inventory screens use it with `StockLevel.currentQuantity` to classify stock health and recommend static reorder quantities.

Compute these in queries or reports:

- Stock on hand from future inventory transactions.
- Reserved stock from future orders or allocations.
- Total sales quantity from future sale items.
- Revenue and margin from future sales, product price, and cost snapshots.
- Reorder status from future stock levels and reorder rules.

Do not store aggregates yet. The capstone dataset should be small enough to compute them directly, and storing aggregates too early creates consistency risk.

## Tradeoffs

The recommended choice is single category per product, plus optional category hierarchy. Many-to-many categories are more flexible, but they complicate CRUD, filtering, reporting, and future inventory summaries. If marketing tags are needed later, add a separate `ProductTag` model instead of turning categories into tags.

Product variants are intentionally omitted. They should only be added if the real shop needs variant-level inventory, such as flavor, nicotine strength, size, or color tracked under one parent product. Until then, each sellable item should be its own `Product` row with its own SKU.
