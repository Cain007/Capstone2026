# Backend

Express API for the Sales and Inventory System Implementing Predictive Analysis.

## Responsibilities

- JWT authentication and role authorization.
- Admin-managed users and forced password-change flow.
- Product, category, supplier, inventory, sales, forecast, purchase order, report, dashboard, and audit APIs.
- Prisma access to PostgreSQL.

## Environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_URL`

Optional local demo seed variables are documented in `.env.example`. Keep `DEMO_SEED=false` for normal role-only seeding.

## Install

```powershell
npm install
npx prisma generate
```

## Database

For a clean local database with committed migrations:

```powershell
npx prisma migrate deploy
```

Use `npx prisma migrate dev` only when developing schema changes.

## Seed

```powershell
npm run prisma:seed
```

or:

```powershell
npx prisma db seed
```

Normal seed creates/updates only the Admin and Staff roles. Set `DEMO_SEED=true` with demo credential env vars to load the defense dataset.

## Development

```powershell
npm run dev
```

Health check:

```text
GET http://localhost:5000/api/health
```

## Production

```powershell
npm run build
npm start
```

## Route Groups

- `/api/auth`
- `/api/users`
- `/api/categories`
- `/api/products`
- `/api/suppliers`
- `/api/inventory`
- `/api/sales`
- `/api/forecasts`
- `/api/purchase-orders`
- `/api/dashboard`
- `/api/reports`
- `/api/audit-events`
- `/api/security/login-history`
