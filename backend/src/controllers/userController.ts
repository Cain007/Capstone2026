import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  recordAuditEvent,
  recordAuditEventBestEffort,
  userEntityLabel,
} from '../utils/audit.js';
import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HASH_ROUNDS,
} from '../utils/accountValidation.js';
import { logError } from '../utils/safeLogger.js';

const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
const USER_ROLES = ['Admin', 'Staff'] as const;
type UserStatus = (typeof USER_STATUSES)[number];
type UserRole = (typeof USER_ROLES)[number];
type UserAuditField = 'fullName' | 'username' | 'email' | 'role';

type PublicUser = {
  id: string;
  fullName: string | null;
  username: string | null;
  email: string;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: { name: string };
};

type UserAuditSnapshot = Record<UserAuditField, string | null>;

const publicUserSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} as const;

function serializeUser(user: PublicUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    role: user.role.name,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function auditSnapshot(user: PublicUser): UserAuditSnapshot {
  return {
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    role: user.role.name,
  };
}

function changedUserFields(
  before: UserAuditSnapshot,
  after: UserAuditSnapshot,
): UserAuditField[] {
  return (Object.keys(before) as UserAuditField[]).filter(
    (field) => before[field] !== after[field],
  );
}

function pickAuditFields(
  snapshot: UserAuditSnapshot,
  fields: UserAuditField[],
): Partial<UserAuditSnapshot> {
  return fields.reduce<Partial<UserAuditSnapshot>>((selected, field) => {
    selected[field] = snapshot[field];
    return selected;
  }, {});
}

function getUserId(request: Request): string {
  const raw = request.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
}

function isUniqueConstraint(error: unknown, field: 'username' | 'email') {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes(field)
  );
}

export async function listUsers(_request: Request, response: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: publicUserSelect,
    });

    response.json({ users: users.map(serializeUser) });
  } catch (error) {
    logError('Listing users failed', error);
    response.status(500).json({ message: 'Unable to load users' });
  }
}

export async function getUser(request: Request, response: Response) {
  const id = getUserId(request);

  if (!id) {
    response.status(404).json({ message: 'User not found' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      response.status(404).json({ message: 'User not found' });
      return;
    }

    response.json({ user: serializeUser(user) });
  } catch (error) {
    logError('Loading user failed', error);
    response.status(500).json({ message: 'Unable to load user' });
  }
}

export async function createUser(request: Request, response: Response) {
  const fullName =
    typeof request.body?.fullName === 'string' ? request.body.fullName.trim() : '';
  const username =
    typeof request.body?.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
  const temporaryPassword =
    typeof request.body?.temporaryPassword === 'string'
      ? request.body.temporaryPassword
      : '';
  const status =
    typeof request.body?.status === 'string' ? request.body.status : 'ACTIVE';

  if (!fullName) {
    response.status(400).json({ message: 'Full name is required' });
    return;
  }

  if (!username) {
    response.status(400).json({ message: 'Username is required' });
    return;
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    response.status(400).json({ message: 'Enter a valid email address' });
    return;
  }

  if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
    response.status(400).json({
      message: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  if (!USER_STATUSES.includes(status as UserStatus)) {
    response.status(400).json({ message: 'Invalid account status' });
    return;
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const actorUserId = request.authUser.id;

  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const user = await prisma.$transaction(async (transaction) => {
      const staffRole = await transaction.role.findUnique({
        where: { name: 'Staff' },
        select: { id: true },
      });

      if (!staffRole) {
        throw new Error('Staff role is not configured');
      }

      const createdUser = await transaction.user.create({
        data: {
          fullName,
          username,
          email,
          passwordHash,
          roleId: staffRole.id,
          status: status as UserStatus,
          mustChangePassword: true,
          createdById: actorUserId,
        },
        select: publicUserSelect,
      });

      await recordAuditEvent(
        {
          request,
          eventType: AuditEventType.ADMIN_ACTION,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.USER,
          entityId: createdUser.id,
          entityLabel: userEntityLabel(createdUser),
          actorUserId,
          after: {
            fullName: createdUser.fullName,
            username: createdUser.username,
            email: createdUser.email,
            role: createdUser.role.name,
            status: createdUser.status,
            mustChangePassword: createdUser.mustChangePassword,
          },
          metadata: {
            operation: 'USER_CREATED',
            role: createdUser.role.name,
            status: createdUser.status,
            mustChangePassword: createdUser.mustChangePassword,
          },
        },
        transaction,
      );

      return createdUser;
    });

    response.status(201).json({ user: serializeUser(user) });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Staff role is not configured'
    ) {
      response.status(500).json({ message: 'Staff role is not configured' });
      return;
    }

    if (isUniqueConstraint(error, 'username')) {
      response.status(409).json({ message: 'Username is already in use.' });
      return;
    }

    if (isUniqueConstraint(error, 'email')) {
      response.status(409).json({ message: 'Email is already in use.' });
      return;
    }

    logError('Creating user failed', error);
    response.status(500).json({ message: 'Unable to create user' });
  }
}

export async function updateUser(request: Request, response: Response) {
  const id = getUserId(request);
  const fullName =
    typeof request.body?.fullName === 'string' ? request.body.fullName.trim() : '';
  const username =
    typeof request.body?.username === 'string'
      ? request.body.username.trim().toLowerCase()
      : '';
  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : '';
  const roleName = typeof request.body?.role === 'string' ? request.body.role : '';

  if (!fullName) {
    response.status(400).json({ message: 'Full name is required' });
    return;
  }

  if (!username) {
    response.status(400).json({ message: 'Username is required' });
    return;
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    response.status(400).json({ message: 'Enter a valid email address' });
    return;
  }

  if (!USER_ROLES.includes(roleName as UserRole)) {
    response.status(400).json({ message: 'Invalid role' });
    return;
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const actorUserId = request.authUser.id;

  try {
    const user = await prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id },
          select: publicUserSelect,
        });

        if (!target) return null;

        const targetRole = await transaction.role.findUnique({
          where: { name: roleName },
          select: { id: true },
        });

        if (!targetRole) {
          throw new Error('Requested role is not configured');
        }

        if (
          target.status === 'ACTIVE' &&
          target.role.name === 'Admin' &&
          roleName === 'Staff'
        ) {
          const activeAdminCount = await transaction.user.count({
            where: { status: 'ACTIVE', role: { name: 'Admin' } },
          });

          if (activeAdminCount <= 1) return 'LAST_ACTIVE_ADMIN' as const;
        }

        const before = auditSnapshot(target);
        const updatedUser = await transaction.user.update({
          where: { id },
          data: { fullName, username, email, roleId: targetRole.id },
          select: publicUserSelect,
        });
        const after = auditSnapshot(updatedUser);
        const changedFields = changedUserFields(before, after);

        if (changedFields.length > 0) {
          await recordAuditEvent(
            {
              request,
              eventType: AuditEventType.ADMIN_ACTION,
              action: AuditAction.UPDATE,
              entityType: AuditEntityType.USER,
              entityId: updatedUser.id,
              entityLabel: userEntityLabel(updatedUser),
              actorUserId,
              before: pickAuditFields(before, changedFields),
              after: pickAuditFields(after, changedFields),
              metadata: {
                operation: 'USER_UPDATED',
                changedFields,
              },
            },
            transaction,
          );
        }

        return updatedUser;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (user === null) {
      response.status(404).json({ message: 'User not found' });
      return;
    }

    if (user === 'LAST_ACTIVE_ADMIN') {
      response.status(409).json({
        message: 'At least one active Admin account must remain.',
      });
      return;
    }

    response.json({ user: serializeUser(user) });
  } catch (error) {
    if (isUniqueConstraint(error, 'username')) {
      response.status(409).json({ message: 'Username is already in use.' });
      return;
    }

    if (isUniqueConstraint(error, 'email')) {
      response.status(409).json({ message: 'Email is already in use.' });
      return;
    }

    logError('Updating user failed', error);
    response.status(500).json({ message: 'Unable to update user' });
  }
}

export async function updateUserStatus(request: Request, response: Response) {
  const id = getUserId(request);
  const status = typeof request.body?.status === 'string' ? request.body.status : '';

  if (!USER_STATUSES.includes(status as UserStatus)) {
    response.status(400).json({ message: 'Invalid account status' });
    return;
  }

  if (!request.authUser) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const actorUserId = request.authUser.id;

  try {
    const user = await prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({
          where: { id },
          select: publicUserSelect,
        });

        if (!target) return null;

        if (
          target.status === 'ACTIVE' &&
          status !== 'ACTIVE' &&
          target.role.name === 'Admin'
        ) {
          const activeAdminCount = await transaction.user.count({
            where: { status: 'ACTIVE', role: { name: 'Admin' } },
          });

          if (activeAdminCount <= 1) return 'LAST_ACTIVE_ADMIN' as const;
        }

        const updatedUser = await transaction.user.update({
          where: { id },
          data: { status: status as UserStatus },
          select: publicUserSelect,
        });

        if (target.status !== updatedUser.status) {
          await recordAuditEvent(
            {
              request,
              eventType: AuditEventType.ADMIN_ACTION,
              action: AuditAction.UPDATE,
              entityType: AuditEntityType.USER,
              entityId: updatedUser.id,
              entityLabel: userEntityLabel(updatedUser),
              actorUserId,
              before: { status: target.status },
              after: { status: updatedUser.status },
              metadata: {
                operation: 'USER_STATUS_CHANGED',
                fromStatus: target.status,
                toStatus: updatedUser.status,
              },
            },
            transaction,
          );
        }

        return updatedUser;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (user === null) {
      response.status(404).json({ message: 'User not found' });
      return;
    }

    if (user === 'LAST_ACTIVE_ADMIN') {
      response.status(409).json({
        message: 'At least one active Admin account must remain.',
      });
      return;
    }

    response.json({ user: serializeUser(user) });
  } catch (error) {
    logError('Updating user status failed', error);
    response.status(500).json({ message: 'Unable to update user status' });
  }
}

export async function resetUserPassword(request: Request, response: Response) {
  const id = getUserId(request);
  const temporaryPassword =
    typeof request.body?.temporaryPassword === 'string'
      ? request.body.temporaryPassword
      : '';
  const confirmTemporaryPassword =
    typeof request.body?.confirmTemporaryPassword === 'string'
      ? request.body.confirmTemporaryPassword
      : '';

  if (temporaryPassword.length < MIN_PASSWORD_LENGTH) {
    response.status(400).json({
      message: `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  if (temporaryPassword !== confirmTemporaryPassword) {
    response.status(400).json({ message: 'Temporary passwords do not match' });
    return;
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
      },
    });

    if (!target) {
      response.status(404).json({ message: 'User not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
      select: publicUserSelect,
    });

    void recordAuditEventBestEffort({
      request,
      eventType: AuditEventType.SECURITY,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: userEntityLabel(user),
      actorUserId: request.authUser?.id ?? null,
      metadata: {
        operation: 'USER_PASSWORD_RESET',
        mustChangePassword: true,
      },
    });

    response.json({
      message: 'Password reset successfully.',
      user: serializeUser(user),
    });
  } catch (error) {
    logError('Resetting user password failed', error);
    response.status(500).json({ message: 'Unable to reset user password' });
  }
}
