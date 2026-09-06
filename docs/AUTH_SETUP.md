# Authentication Setup

The application uses Admin-managed accounts. There is no public signup endpoint or signup page.

## Flow

1. User signs in with email or username and password.
2. Backend validates the bcrypt password hash.
3. Backend issues a JWT.
4. Frontend stores the token in local storage or session storage.
5. Frontend calls `/api/auth/me` to restore the session.
6. Role-based routing sends Admin users to Dashboard and Staff users to POS.

## Accounts

Admins create employee accounts in User Management. New users can be given a temporary password and `mustChangePassword = true`.

When `mustChangePassword` is true, the frontend requires the user to change the password before entering the dashboard workspace.

## Roles

- Admin: full system access.
- Staff: POS, sales history, read-only product/category reference, and account settings.

## Account Status

- `ACTIVE`: user can sign in.
- `INACTIVE`: sign-in is denied.
- `SUSPENDED`: sign-in is denied.

## Required Backend Environment

```text
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
PORT=5000
FRONTEND_URL="http://localhost:5173"
```

## Useful Local Checks

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:5000/api/health
```

```powershell
$body = @{
  identifier = "admin.demo@example.invalid"
  password = "<local-demo-password>"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:5000/api/auth/login `
  -ContentType "application/json" `
  -Body $body
```

Do not commit real credentials, password hashes, JWTs, or production database URLs.
