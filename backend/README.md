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

## Product Image Storage

Optional server-only Cloudinary configuration in `.env`:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Apply committed migrations and regenerate Prisma Client before starting the updated API. Existing products keep null image fields. Missing Cloudinary settings return `503` for storage operations without disabling ordinary Product CRUD. Restart the API after changing storage credentials.

- `POST /api/products/:id/image`: Admin only; multipart field `image`, one JPEG, PNG, or WebP, maximum 5 MiB (5,242,880 bytes). Returns `200 { "imageUrl": "https://..." }`.
- `DELETE /api/products/:id/image`: Admin only; removes the asset and clears metadata; returns `204`, including when an existing product has no image. Missing product returns `404`.
- Product list/detail/create/edit responses include nullable `imageUrl`; `imagePublicId` stays internal. Existing JSON create/edit cannot assign image fields. Staff retains Product read access only.
- File bytes remain in memory and go through Cloudinary `upload_stream` to `king-of-clouds/products`. MIME and signature checks precede upload; Cloudinary also restricts allowed formats. No disk uploads, raw filename IDs, server cropping, or client-supplied remote URLs.
- Missing file/malformed multipart: `400`; unsupported type/signature: `415`; oversize: `413`; unauthenticated: `401`; forbidden: `403`; provider failure: `502`; database failure: `500`; concurrent image change: `409`.
- Image mutations allow 20 attempts per authenticated Admin per 15 minutes per API process (`429` with `Retry-After`). There was no existing shared mutation limiter. Multi-instance deployments should also enforce a shared gateway limit.

Replacement uploads first, conditionally commits new metadata and its audit event, then removes the old asset. Database/audit failure attempts cleanup of the new asset. Cleanup failure after a successful replacement or Product deletion is logged and does not reverse success. Referenced Product deletion retains the existing `409` and never deletes the image.

Explicit image deletion removes storage first; provider `not found` is safe. Metadata/audit clearing retries once on database failure. A persistent database outage after successful remote deletion requires retrying DELETE after recovery; an identifier-only reconciliation error is logged. Cloudinary and PostgreSQL cannot share an atomic transaction. Cleanup is best effort; monitor warnings for orphan reconciliation.

### Image Regression Tests

Tests use real local PostgreSQL with disposable, uniquely named records and a mocked Cloudinary SDK boundary. No provider credentials are needed. They require existing Admin/Staff roles and the image migration. Opt in explicitly:

```powershell
$env:RUN_DATABASE_IMAGE_TESTS='1'
npm run test:images
Remove-Item Env:RUN_DATABASE_IMAGE_TESTS
```

The suite refuses non-local database hosts and removes only its own fixture records. Without the opt-in flag the integration suite is skipped. Live Cloudinary upload/delete verification remains a separate deployment check.
