# Final Readiness Roadmap

## Completed

- Admin/Staff authentication and JWT session restoration.
- Admin-managed user accounts and password-change flow.
- Role-based frontend navigation and backend route protection.
- Product, category, supplier, inventory, stock movement, sales history, POS, purchase order, forecast, report, dashboard, settings, audit log, and login history modules.
- Moving Average forecast generation.
- Predictive reorder recommendations.
- Forecast evaluation with MAE, WAPE, and bias for matured forecast days.
- Cash received and change due for POS cash sales.

## Before Defense

- Use a disposable demo database.
- Apply migrations with `npx prisma migrate deploy`.
- Run base seed or demo seed.
- Confirm Admin and Staff demo accounts.
- Confirm seeded product `DEMO-001` has READY forecast evaluation.
- Rehearse the 10-15 minute flow in `docs/DEFENSE_DEMO.md`.
- Capture build/test command output for `docs/TEST_EVIDENCE.md`.
- Prepare screenshots in case the live environment fails.

## Before Deployment

- Configure production `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `VITE_API_URL`.
- Run `npx prisma migrate deploy`.
- Disable demo seed in production.
- Create real Admin account through a controlled operational process.
- Confirm CORS frontend origin.
- Review audit/log retention policy.

## Future Scope

- Refunds/void workflow.
- Multi-warehouse inventory.
- Accounting ledger integration.
- More forecasting methods.
- Historical forecast-run comparison UI.
- Purchase order cancellation workflow.
- Receipt printing.
- Fine-grained permissions beyond Admin/Staff.
