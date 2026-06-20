# Local Login Setup

The source code is connected, but PostgreSQL still needs your local password and
the backend packages must be installed before the first run.

## 1. Create the database

Open **SQL Shell (psql)** from the Windows Start menu. Accept the default
server, database, port, and username, then enter the PostgreSQL password you
chose during installation.

Run:

```sql
CREATE DATABASE capstone_db;
```

You can confirm it exists with:

```sql
\l
```

Then leave psql:

```sql
\q
```

## 2. Set the database password

Open `backend/.env` and replace `YOUR_PASSWORD` with your PostgreSQL password.

If the password contains characters such as `@`, `:`, `/`, `?`, or `#`, URL
encode it before placing it in the connection string.

Also replace `JWT_SECRET` with a long private random value before deploying the
application anywhere public.

## 3. Install and prepare the backend

Install Node.js LTS if `node --version` does not work in a new terminal.

Then run:

```powershell
cd D:\Capstone\backend
npm install
npx prisma generate
npx prisma migrate dev --name init_auth
npm run dev
```

The backend should print:

```text
API running at http://localhost:5000
```

Check it in a browser at `http://localhost:5000/api/health`.

## 4. Start the frontend

Open a second terminal:

```powershell
cd D:\Capstone\frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

Choose **Sign up here**, create an account with a password of at least eight
characters, log out, and then sign in with the same account.

## 5. Inspect saved users

From the backend folder:

```powershell
npx prisma studio
```

Open the `User` table. The `passwordHash` value should be a bcrypt hash and
must never contain the original password.

## Useful API checks

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:5000/api/health
```

```powershell
$body = @{
  email = "beginner@example.com"
  password = "password123"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/auth/signup `
  -ContentType "application/json" `
  -Body $body
```
