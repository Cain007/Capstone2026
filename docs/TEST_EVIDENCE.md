# Test Evidence

Use this file to collect repeatable verification commands and manual workflow evidence. Do not mark a check as passed unless it was actually run for the build being submitted.

## Backend Commands

```powershell
cd D:\Capstone\backend
npx prisma generate
npx prisma validate
npx tsc --noEmit
npm run build
```

## Frontend Commands

```powershell
cd D:\Capstone\frontend
npm run lint
npx tsc -p tsconfig.app.json --noEmit --incremental false
npm run build
```

## Seed Checks

On a disposable local/demo database:

```powershell
cd D:\Capstone\backend
npx prisma migrate deploy
npm run prisma:seed
```

For defense fixtures, set `DEMO_SEED=true` and demo credential env vars, then run:

```powershell
npx prisma db seed
```

Run the demo seed twice to confirm idempotency.

## Runtime Workflow Checklist

- Auth: Admin login, Staff login, `/api/auth/me`, password change.
- POS: Staff creates a cash sale with cash received and change due.
- Inventory: completed sale deducts stock and creates stock movement.
- Forecast: Admin generates Moving Average forecast from completed sales.
- Evaluation: seeded primary demo product returns READY evaluation with MAE, WAPE, and bias.
- Purchase Orders: Admin creates PO, marks Ordered, receives quantity.
- Audit: demo actions appear in Audit Logs and login events appear in Login History.
- Reports: sales trend, top products, inventory summary, and predictive summary are non-empty.

## Evidence Package

- Terminal output from the commands above.
- Screenshots of key pages during the defense walkthrough.
- A short note with date/time, branch/commit, and database fixture used.
