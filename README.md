# Setup Guide

This guide prepares a local development or disposable demo environment.

## 1. Prerequisites

- Node.js LTS
- npm
- PostgreSQL
- Git

Check Node and npm:

```powershell
node --version
npm --version
```

## 2. PostgreSQL Setup

Create a local database:

```sql
CREATE DATABASE capstone_db;
```

Use a database user/password you control locally.

## 3. Clone Repository

```powershell
git clone <repository-url>
cd Capstone
```

## 4. Backend Install

```powershell
cd backend
npm install
```

## 5. Backend Environment

Copy the example:

```powershell
Copy-Item .env.example .env
```

Set:

```text
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/capstone_db?schema=public"
JWT_SECRET="replace_this_with_a_long_random_secret"
PORT=5000
FRONTEND_URL="http://localhost:5173"
```

Do not commit `.env`.

## 6. Prisma Generate

```powershell
npx prisma generate
```

## 7. Apply Migrations

For a clean setup using committed migrations:

```powershell
npx prisma migrate deploy
```

Use `npx prisma migrate dev` only when developing schema changes and creating new migrations.

## 8. Seed

Base roles only:

```powershell
npm run prisma:seed
```

Defense/demo dataset:

```powershell
$env:DEMO_SEED="true"
$env:DEMO_ADMIN_EMAIL="admin.demo@example.invalid"
$env:DEMO_ADMIN_USERNAME="demo-admin"
$env:DEMO_ADMIN_PASSWORD="<local-demo-password>"
$env:DEMO_STAFF_EMAIL="staff.demo@example.invalid"
$env:DEMO_STAFF_USERNAME="demo-staff"
$env:DEMO_STAFF_PASSWORD="<local-demo-password>"
npx prisma db seed
```

Use only a disposable local/demo database for demo seeding.

## 9. Backend Start

```powershell
npm run dev
```

Expected:

```text
API running at http://localhost:5000
```

## 10. Frontend Install

Open a second terminal:

```powershell
cd D:\Capstone\frontend
npm install
```

## 11. Frontend Environment

Copy the example:

```powershell
Copy-Item .env.example .env
```

Set:

```text
VITE_API_URL="http://localhost:5000"
```

## 12. Frontend Start

```powershell
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## 13. Health Check

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:5000/api/health
```

Expected:

```json
{ "status": "ok" }
```

## 14. Login

There is no public signup. Use a seeded demo account or ask an Admin to create an account in User Management.
