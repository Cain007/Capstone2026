# Defense Demo Guide

Target duration: 10-15 minutes.

## Before The Demo

1. Use a disposable demo database.
2. Apply migrations.
3. Run the demo seed with `DEMO_SEED=true` and local demo credential env vars.
4. Start backend and frontend.
5. Verify `GET http://localhost:5000/api/health`.

## Reset Demo Data

Development / disposable demo database only:

```powershell
cd D:\Capstone\backend
npx prisma migrate reset
```

The reset command is destructive. Do not run it against production or a real business database.

For a safer rehearsal reset, rerun:

```powershell
npx prisma db seed
```

The demo seed cleans and recreates only records with deterministic `DEMO-*` identifiers and configured demo account emails/usernames.

## Walkthrough

### 1. Health Check

Click or call `/api/health`.

Observe: backend returns `{ "status": "ok" }`.

Demonstrates: the API service is running.

### 2. Admin Login

Sign in with the configured demo Admin account.

Observe: Admin opens the dashboard and full navigation.

Demonstrates: JWT login and Admin RBAC.

### 3. Dashboard Overview

Open Dashboard.

Observe: sales, inventory, procurement, predictive, and audit summary cards.

Demonstrates: management visibility.

### 4. Catalog And Inventory

Open Products, Categories, and Inventory.

Observe: demo products, reorder points, and stock health examples.

Demonstrates: catalog and inventory monitoring.

### 5. Staff Login

Log out and sign in with the configured demo Staff account.

Observe: Staff sees POS-focused navigation, not Admin modules.

Demonstrates: role-specific access.

### 6. Cash POS Sale

Open POS, add an in-stock demo product, choose cash, enter cash received, and complete the sale.

Observe: sale completes, change due is shown, and stock decreases.

Demonstrates: sales processing integrated with inventory.

### 7. Sales History

Open Sales History.

Observe: the completed cash sale and line details.

Demonstrates: transaction traceability.

### 8. Return To Admin

Log back in as Admin.

Observe: full operations/planning/admin navigation returns.

Demonstrates: RBAC switch.

### 9. Inventory Deduction

Open Inventory and Stock Movements.

Observe: stock reflects the sale and movement history includes sale deduction.

Demonstrates: append-only inventory ledger behavior.

### 10. Forecast Evaluation

Open Forecasting and select `Demo Cloud Bar Mint`.

Observe: seeded forecast evaluation is READY with MAE, WAPE, bias, and daily comparison rows.

Demonstrates: predictions are measured against later completed sales.

### 11. Moving Average Forecast

Generate a new Moving Average forecast if desired.

Observe: the new forecast predicts future daily demand. Its evaluation will normally be NOT_READY because forecast days have not elapsed.

Demonstrates: predictive analysis without claiming immediate accuracy for future periods.

### 12. Predictive Reorder

Review Inventory Decision Support.

Observe: current stock, demand, risk, and predictive reorder recommendation.

Demonstrates: forecasting supports procurement decisions.

### 13. Purchase Order

Open Purchase Orders. Create a new draft PO or use the demo draft as reference.

Observe: supplier and product line items are selected.

Demonstrates: procurement planning.

### 14. Mark Ordered

Mark a draft PO as Ordered.

Observe: status changes to Ordered.

Demonstrates: procurement lifecycle control.

### 15. Receive PO

Receive full or partial quantity.

Observe: purchase receipt movement is created and stock increases.

Demonstrates: receiving updates inventory.

### 16. Audit Logs

Open Audit Logs and Login History.

Observe: demo actions and login events.

Demonstrates: accountability and security traceability.

### 17. Reports

Open Reports.

Observe: sales trend, top products, inventory snapshot, and predictive summary.

Demonstrates: evaluator-facing reporting.

## Forecast Talking Point

Moving Average calculates average completed daily demand over a selected historical window, such as 7, 14, or 30 days. The selected horizon, such as 7, 14, or 30 days, receives persisted daily predictions based on that average. This is statistical forecasting, not machine learning.

## Forecast Evaluation Talking Point

Forecast Evaluation compares persisted predicted quantities with actual completed sales for forecast dates that have already ended. MAE is average quantity error per evaluated day. WAPE is absolute error relative to total actual demand. Bias shows whether the forecast tends to over-forecast or under-forecast.

Do not describe WAPE as an accuracy percentage.

## Limitations

- Moving Average only.
- Latest forecast evaluation only.
- Newly generated forecasts require elapsed days before evaluation.
- WAPE is unavailable when evaluated actual demand totals zero.
- No refunds/void workflow.
- No multi-warehouse inventory.
- No accounting ledger.
- No automatic procurement.
- No complex approval workflow.
