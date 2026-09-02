# Login History And Audit Trail Prisma Schema Design

## Prisma Schema

The audit module is implemented in `backend/prisma/schema.prisma` with these enums and models:

```prisma
enum AuthEventType {
  LOGIN
  LOGOUT
  PASSWORD_CHANGE
  PASSWORD_RESET_REQUEST
  PASSWORD_RESET_COMPLETE
  SESSION_EXPIRED
}

enum AuthEventStatus {
  SUCCESS
  FAILURE
  DENIED
}

enum AuthFailureReason {
  INVALID_CREDENTIALS
  ACCOUNT_NOT_FOUND
  ACCOUNT_DISABLED
  TOKEN_EXPIRED
  TOKEN_INVALID
  RATE_LIMITED
  PASSWORD_POLICY
  USER_NOT_AUTHENTICATED
  UNKNOWN
}

enum AuditEventType {
  DATA_CHANGE
  ADMIN_ACTION
  ACCESS_CONTROL
  SECURITY
  REPORTING
  SYSTEM
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  ARCHIVE
  RESTORE
  ACTIVATE
  DEACTIVATE
  ASSIGN_ROLE
  REVOKE_ROLE
  GRANT_PERMISSION
  REVOKE_PERMISSION
  EXPORT
  IMPORT
  VIEW
  APPROVE
  CANCEL
}

enum AuditEntityType {
  USER
  ROLE
  PERMISSION
  PRODUCT
  CATEGORY
  SUPPLIER
  PURCHASE_ORDER
  INVENTORY
  SALE
  REPORT
  SYSTEM
}

enum AuditEventStatus {
  SUCCESS
  FAILURE
  DENIED
}

model LoginHistory {
  id                  String             @id @default(cuid())
  eventType           AuthEventType
  status              AuthEventStatus
  failureReason       AuthFailureReason?
  userId              String?
  actorUserIdSnapshot String?
  actorEmailSnapshot  String?
  attemptedEmail      String?
  ipAddress           String?            @db.VarChar(45)
  userAgent           String?            @db.VarChar(512)
  metadata            Json?
  createdAt           DateTime           @default(now())

  user User? @relation("LoginHistoryUser", fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([actorUserIdSnapshot, createdAt])
  @@index([attemptedEmail, createdAt])
  @@index([ipAddress, createdAt])
  @@index([eventType, createdAt])
  @@index([status, createdAt])
  @@index([createdAt])
}

model AuditEvent {
  id                  String           @id @default(cuid())
  eventType           AuditEventType
  action              AuditAction
  entityType          AuditEntityType
  entityId            String?
  entityLabel         String?
  status              AuditEventStatus @default(SUCCESS)
  actorUserId         String?
  actorUserIdSnapshot String?
  actorEmailSnapshot  String?
  ipAddress           String?          @db.VarChar(45)
  userAgent           String?          @db.VarChar(512)
  requestId           String?
  before              Json?
  after               Json?
  metadata            Json?
  createdAt           DateTime         @default(now())

  actor User? @relation("AuditEventActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([actorUserId, createdAt])
  @@index([actorUserIdSnapshot, createdAt])
  @@index([entityType, entityId])
  @@index([eventType, createdAt])
  @@index([action, createdAt])
  @@index([status, createdAt])
  @@index([requestId])
  @@index([createdAt])
}
```

## Rationale

Two models are used.

`LoginHistory` is dedicated to authentication activity because auth events have different volume, retention, and query patterns from normal admin actions. Security checks need fast lookup by attempted email, IP address, status, event type, and time window for brute-force and rate-limit analysis.

`AuditEvent` is a single generic event table for admin and data-change actions. A generic table avoids creating one audit table per entity, keeps reporting queries consistent, and lets new modules such as inventory, sales, and forecasting write events without adding new tables.

Audit rows are append-only. Neither model has `updatedAt`; rows should be written once and never edited in normal application code.

The schema uses a hybrid actor strategy: nullable `User` relations with `onDelete: SetNull`, plus denormalized actor snapshots. The relation supports live joins while the user still exists. The snapshots preserve who performed the action after account deletion.

## Relations And Delete Rules

| Relation | Rule | Can cascade-delete a `User`? | Can block deleting a `User`? | Reason |
| --- | --- | --- | --- | --- |
| `LoginHistory.user -> User` | `SetNull` | No | No | Auth history survives account deletion. |
| `AuditEvent.actor -> User` | `SetNull` | No | No | Compliance records survive account deletion. |

No audit model has a foreign key to `Product`, `Category`, `Supplier`, or future business tables. Business targets are captured generically with `entityType`, `entityId`, and `entityLabel` to avoid circular or blocking relations.

## Indexes And Constraints

No unique constraints are used on event rows because repeated events are valid.

`LoginHistory` indexes:

- `[userId, createdAt]`: account login timeline while the user exists.
- `[actorUserIdSnapshot, createdAt]`: account login timeline after user deletion.
- `[attemptedEmail, createdAt]`: failed-login and account-enumeration investigation.
- `[ipAddress, createdAt]`: brute-force and rate-limit detection.
- `[eventType, createdAt]`: login/logout/password-reset reports.
- `[status, createdAt]`: failed and denied auth monitoring.
- `[createdAt]`: retention jobs and date-range reports.

`AuditEvent` indexes:

- `[actorUserId, createdAt]`: admin activity by current user.
- `[actorUserIdSnapshot, createdAt]`: admin activity after user deletion.
- `[entityType, entityId]`: history for one business record.
- `[eventType, createdAt]`: data-change, access-control, and reporting event views.
- `[action, createdAt]`: create/update/delete/export activity reports.
- `[status, createdAt]`: failed or denied admin action monitoring.
- `[requestId]`: trace all audit events from one API request.
- `[createdAt]`: retention jobs and date-range reports.

## Security And Data Minimization

Never store:

- Plaintext passwords.
- Password hashes before or after change.
- JWTs, refresh tokens, reset tokens, session secrets, API keys, or full authorization headers.
- Full payment data or unnecessary customer personal data.

IP address:

- Store full IPs for security investigations in a controlled admin system.
- If privacy rules require minimization, mask IPv4 to `/24` and IPv6 to `/64` before saving, or archive full IPs into a more restricted table.

User agent:

- Store a truncated value, currently `VarChar(512)`, for investigation and device recognition.
- Do not treat the user agent as trusted identity data.

Before/after JSON:

- Log only changed non-sensitive fields.
- Redact fields such as `password`, `passwordHash`, `token`, `secret`, `authorization`, `resetToken`, and private notes before writing.
- Prefer snapshots such as `{ "status": "ACTIVE" }` over dumping full request bodies.

## Computed Vs Stored

Store source event facts: actor snapshot, event type, action, target identity, result, request context, and timestamp.

Compute these in queries or reports:

- Failed-login count per IP or attempted email.
- Last successful login per user.
- Admin action counts per day.
- Product/category change history.
- Denied action rate.
- Security alerts based on thresholds.

Do not store these aggregates yet. They can be queried from indexed source rows until volume justifies rollups.

## Retention And Partitioning

Audit and login tables grow without bound. Plan retention before production use:

- Keep `LoginHistory` for a shorter operational window, such as 90 to 180 days, unless school or business policy requires longer.
- Keep `AuditEvent` longer, such as 1 to 3 years, because it supports accountability and compliance.
- For larger deployments, use PostgreSQL date-based partitioning by `createdAt`, usually monthly partitions.
- Archive old partitions to cheaper storage instead of deleting rows one by one.

Prisma does not model PostgreSQL partitioning directly. Add partitioning and archive jobs through SQL migrations or database operations when volume requires it.

## Tradeoffs

The recommended choice is two tables: `LoginHistory` for auth events and `AuditEvent` for admin/data changes. One table for everything is simpler at first, but it mixes high-volume login attempts with lower-volume compliance events and makes retention harder.

The recommended actor strategy is hybrid relation plus snapshots. A pure `SetNull` relation loses actor identity after deletion. A pure snapshot loses convenient joins while accounts are active. The hybrid approach is slightly more verbose but safer.

The recommended target strategy is generic `entityType` and `entityId`, not foreign keys to every business table. This avoids circular dependencies and prevents audit rows from blocking or cascading product/category deletes.

