# Role And User-With-Role Prisma Schema Design

## Additive Prisma Schema Changes

These are additive changes to the existing `User` model. Do not rename or remove existing `User` fields or relation names from other modules.

```prisma
model User {
  roleId       String
  role         Role   @relation("UserAssignedRole", fields: [roleId], references: [id], onDelete: Restrict)
  createdRoles Role[] @relation("RoleCreatedBy")
  updatedRoles Role[] @relation("RoleUpdatedBy")

  @@index([roleId])
}

enum RoleStatus {
  ACTIVE
  ARCHIVED
}

model Role {
  id          String     @id @default(cuid())
  name        String     @unique
  description String?
  status      RoleStatus @default(ACTIVE)
  createdById String?
  updatedById String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  users     User[] @relation("UserAssignedRole")
  createdBy User?  @relation("RoleCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedBy User?  @relation("RoleUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([createdById])
  @@index([updatedById])
}
```

The actual full schema is in `backend/prisma/schema.prisma`.

## Rationale

`Role` is a table, not an enum. The current application supports the `Admin` and `Staff` roles.

`RoleStatus` is an enum because role lifecycle states should be controlled and predictable.

`User.roleId` is required. A user without a role is invalid in an RBAC system because access checks must always resolve to exactly one role.

Accounts are created by administrators. The current application has no public signup flow. The seed script creates the starting roles, and optional demo seed mode can create demo users from environment-provided credentials.

`createdById` and `updatedById` are included on `Role` because role changes are security-sensitive admin actions. They use `SetNull` so losing a user account never cascades or blocks deletion.

Relation names are unique and do not collide with existing module relations:

- `UserAssignedRole`
- `RoleCreatedBy`
- `RoleUpdatedBy`

## Relations And Delete Rules

| Relation | Rule | Can cascade-delete a `User`? | Can orphan a user without role? | Can collide with existing relation names? | Reason |
| --- | --- | --- | --- | --- | --- |
| `User.role -> Role` | `Restrict` | No | No | No | A role in use cannot be deleted until users are reassigned. |
| `Role.createdBy -> User` | `SetNull` | No | No | No | Role audit metadata survives deleted users. |
| `Role.updatedBy -> User` | `SetNull` | No | No | No | Role audit metadata survives deleted users. |

Deleting a `Role` never cascade-deletes `User` records. Because `User.roleId` is non-nullable and uses `Restrict`, deleting an assigned role is blocked until users are moved to another active role.

## Indexes And Unique Constraints

- `Role.name @unique`: supports role lookup by name and prevents duplicate Admin/Staff-style roles.
- `User.roleId @@index`: supports admin screens listing users by role.
- `Role.status @@index`: supports active/archived role filters.
- `Role.createdById @@index`: supports security/admin reports about who created roles.
- `Role.updatedById @@index`: supports security/admin reports about who last changed roles.

## Default Roles

Seeded roles:

- `Admin`
- `Staff`

Run:

```powershell
cd D:\Capstone\backend
npm run prisma:seed
```

There is no public signup route. Staff accounts are created from User Management by an Admin.

## Migration Note For Existing Users

Because `User.roleId` is required, migrating an existing database that already has users must be done with a backfill:

1. Create the `Role` table and seed `Admin` and `Staff`.
2. Backfill all existing users to a chosen default role, normally `Staff` or `Admin` for the first owner account.
3. Add the non-null `User.roleId` constraint and the `Restrict` foreign key.

Do not apply a migration that adds `roleId` as non-null before assigning roles to existing users.

## Lockout Guard

Preventing the last Admin-capable role or user from being archived/deleted should be enforced in the service layer, not only the schema.

Before archiving or deleting an Admin-capable role:

- Confirm at least one other active Admin-capable role remains.
- Confirm at least one active user is assigned to an Admin-capable role.
- Refuse the operation if it would leave the system without an administrator.

Before changing an Admin user's role:

- Confirm at least one other active Admin user remains.

This is application-level enforcement because "Admin-capable" becomes more nuanced once permissions are added.

## Future Permission-Based Access

The current design does not block fine-grained permissions. Add these later when needed:

```prisma
model Permission {
  id          String @id @default(cuid())
  key         String @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

For now, future modules such as products, suppliers, inventory, sales, reports, and audit logs can perform access checks through `User.role.name` without schema changes.

## Tradeoffs

The recommended choice is one required role per user. Many-to-many user-role assignment is more flexible, but it complicates access checks and admin UI early. Add many-to-many user roles only if the business truly needs users to hold multiple roles at once.

The recommended delete rule is `Restrict` from `Role` to `User`. `SetNull` would violate the required role rule and create unsafe "no role" users.

The recommended default role is `Staff`, assigned by application code. A database default is not appropriate because `roleId` is a generated foreign key that differs between environments.
