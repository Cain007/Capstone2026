# Deployment Guide

This project is provider-neutral. A production deployment needs a PostgreSQL database, a backend host, and a frontend host.

## Deployment Source

The initial production deployment uses `feature/FrontendModernRefactor` without
merging to `main` in the deployment-preparation phases.

### Railway Backend

```text
Branch: feature/FrontendModernRefactor
Root: /backend
Node: 24.x
Install: npm ci
Build: npm run prisma:generate && npm run build
Pre-deploy: npx prisma migrate deploy
Start: npm start
Health path: /api/health
```

Connect Railway PostgreSQL through `DATABASE_URL`; do not create production
tables manually. After migrations, run `npm run bootstrap:admin` as a controlled
one-off command for the first Admin.

### Vercel Frontend

```text
Production branch: feature/FrontendModernRefactor
Root: frontend
Framework: Vite
Node: 24.x
Install: npm ci
Build: npm run build
Output: dist
VITE_API_URL: https://<railway-backend-domain>
```

After Vercel assigns the production origin, set Railway `FRONTEND_URL` to that
exact HTTPS origin and redeploy/restart the backend. Do not use a wildcard.

## Backend Environment

Set:

```text
DATABASE_URL="postgresql://..."
JWT_SECRET="at-least-32-characters-of-random-secret"
PORT=5000
FRONTEND_URL="https://your-frontend-host"
NODE_ENV=production
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

Production startup rejects missing values, a JWT secret shorter than 32
characters, non-PostgreSQL database URLs, and a local or non-HTTPS frontend
origin. Product images are a production capability, so all three Cloudinary
variables are required. Bootstrap variables are not required for normal startup.
Do not enable `DEMO_SEED` in production.

For the one-time initial Admin bootstrap, temporarily set:

```text
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_USERNAME="admin"
BOOTSTRAP_ADMIN_PASSWORD="temporary-password"
BOOTSTRAP_ADMIN_NAME="Optional display name"
```

Use deployment secrets, never committed values. The name is optional.

## Frontend Environment

Set:

```text
VITE_API_URL="https://your-backend-host"
```

This must be the backend origin. The frontend code appends `/api/...`.

## Database Migration

Production migration flow:

```powershell
npx prisma generate
npx prisma migrate deploy
```

Do not use `prisma migrate dev` in production. It is for schema development and migration creation.

## Backend Build And Start

```powershell
npm ci
npm run build
npm start
```

## Initial Production Admin

After the first production migration and backend build, run the bootstrap as a
Railway one-off command against the backend service environment:

```powershell
npx prisma migrate deploy
npm run bootstrap:admin
npm start
```

Alternatively, run `railway run npm run bootstrap:admin` from the backend root
after migrations. Do not add the bootstrap command to recurring deploys or the
application start command. It is idempotent and skips when an Admin exists, but
should remain an intentional operator action.

Sign in with the temporary Admin password and complete the existing forced
password-change flow. Then remove `BOOTSTRAP_ADMIN_PASSWORD`; the email,
username, and optional name variables can also be removed. Environment cleanup
does not change the stored account.

## Frontend Build

```powershell
npm install
npm run build
```

Deploy the generated `dist` output to the frontend host.

## CORS

`FRONTEND_URL` must be the exact HTTPS Vercel production origin, with no path or
wildcard. Matching requests and preflight are allowed; other browser origins
receive a controlled `403` JSON response.

## Railway Proxy And Login Protection

Production trusts one proxy hop so Express and the login limiter use the client
address supplied by Railway's edge proxy without trusting an arbitrary proxy
chain. The login endpoint permits five failed attempts per client IP in 15
minutes, removes successful responses from the count, and returns `429` with
`Retry-After` when blocked.

The limiter is held in process memory and is suitable for the initial
single-instance Railway service. It is not shared between horizontally scaled
instances; add a shared rate-limit store before scaling beyond one instance.

## Demo Data

Use demo seed only on disposable demo databases. Do not seed demo users, demo sales, demo forecasts, or demo purchase orders into a real production database.
