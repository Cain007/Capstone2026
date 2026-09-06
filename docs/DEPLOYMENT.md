# Deployment Guide

This project is provider-neutral. A production deployment needs a PostgreSQL database, a backend host, and a frontend host.

## Backend Environment

Set:

```text
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-production-secret"
PORT=5000
FRONTEND_URL="https://your-frontend-host"
```

Do not enable `DEMO_SEED` in production.

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
npm install
npm run build
npm start
```

## Frontend Build

```powershell
npm install
npm run build
```

Deploy the generated `dist` output to the frontend host.

## CORS

`FRONTEND_URL` on the backend must match the hosted frontend origin. If it does not match, browser requests will fail.

## Demo Data

Use demo seed only on disposable demo databases. Do not seed demo users, demo sales, demo forecasts, or demo purchase orders into a real production database.
