# Architecture

```text
React + Vite frontend
        |
        v
Express REST API
        |
        v
Prisma ORM
        |
        v
PostgreSQL
```

## Authentication And Authorization

Users sign in with an email or username and password. Passwords are hashed with bcrypt. The backend issues a JWT, and protected routes require that token.

Authorization is role-based:

- Admin: full system access.
- Staff: POS, sales history, read-only catalog reference, and account settings.

Accounts are created by Admin users. There is no public signup route.

## Major Domains

- Auth: login, session lookup, password change.
- Users: Admin-managed accounts and status changes.
- Catalog: products and categories.
- Suppliers: supplier records and contacts.
- Inventory: stock levels and append-only stock movements.
- Sales: POS sale headers and line items.
- Forecasting: Moving Average forecast runs, forecast points, predictive insight, and evaluation.
- Procurement: purchase orders, purchase order items, order transition, receiving.
- Reports: sales trend, top products, inventory summary, predictive summary.
- Audit: audit events and login history.
- Dashboard: management summaries.

## Core Domain Flow

Sale -> SaleItem -> InventoryMovement `SALE_DEDUCTION` -> StockLevel decrease.

ForecastRun -> ForecastPoint -> predictive insight -> forecast evaluation.

PurchaseOrder -> PurchaseOrderItem -> InventoryMovement `PURCHASE_RECEIPT` -> StockLevel increase.

AuditEvent records meaningful mutations. LoginHistory records authentication activity.

## ERD Highlights

- User belongs to Role.
- Product belongs to Category.
- Product has StockLevel, SaleItems, InventoryMovements, PurchaseOrderItems, and ForecastRuns.
- Sale has SaleItems.
- Supplier has PurchaseOrders.
- PurchaseOrder has PurchaseOrderItems.
- ForecastRun has ForecastPoints.
- AuditEvent and LoginHistory preserve actor/account history.
