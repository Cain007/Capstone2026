import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  AuthEventStatus,
  AuthEventType,
  AuthFailureReason,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  getLoginIdentifierType,
  recordAuditEventBestEffort,
  recordLoginHistoryBestEffort,
  userEntityLabel,
} from '../utils/audit.js';

const MIN_PASSWORD_LENGTH = 8;

type PublicUserRecord = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
  status: string;
  mustChangePassword: boolean;
  role: { name: string };
};

function publicUser(user: PublicUserRecord) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    role: user.role.name,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
  };
}

function defaultRoute(roleName: string) {
  return roleName === 'Admin' ? 'Dashboard' : 'POS';
}

function accountStatusError(status: string) {
  if (status === 'INACTIVE') {
    return 'This account is inactive. Contact an administrator.';
  }

  if (status === 'SUSPENDED') {
    return 'This account is suspended. Contact an administrator.';
  }

  return null;
}

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  username: true,
  status: true,
  mustChangePassword: true,
  role: { select: { name: true } },
} as const;

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

function readCredentials(request: Request) {
  const identifier =
    typeof request.body?.identifier === 'string'
      ? request.body.identifier.trim()
      : typeof request.body?.username === 'string'
        ? request.body.username.trim()
        : typeof request.body?.email === 'string'
          ? request.body.email.trim()
          : '';
  const password =
    typeof request.body?.password === 'string' ? request.body.password : '';
  const confirmPassword =
    typeof request.body?.confirmPassword === 'string'
      ? request.body.confirmPassword
      : '';

  return { identifier, password, confirmPassword };
}

export async function login(request: Request, response: Response) {
  const { identifier, password } = readCredentials(request);

  if (!identifier || !password) {
    response.status(400).json({ message: 'Email or username and password are required' });
    return;
  }

  try {
    const normalizedIdentifier = identifier.toLowerCase();
    const loginMetadata = {
      identifierType: getLoginIdentifierType(normalizedIdentifier),
      loginMethod: 'IDENTIFIER',
    };
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: identifier },
        ],
      },
      select: {
        ...publicUserSelect,
        passwordHash: true,
      },
    });

    if (!user) {
      void recordLoginHistoryBestEffort({
        request,
        eventType: AuthEventType.LOGIN,
        status: AuthEventStatus.FAILURE,
        failureReason: AuthFailureReason.ACCOUNT_NOT_FOUND,
        userId: null,
        attemptedIdentifier: normalizedIdentifier,
        metadata: loginMetadata,
      });

      response.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      void recordLoginHistoryBestEffort({
        request,
        eventType: AuthEventType.LOGIN,
        status: AuthEventStatus.FAILURE,
        failureReason: AuthFailureReason.INVALID_CREDENTIALS,
        userId: user.id,
        actorUserIdSnapshot: user.id,
        actorEmailSnapshot: user.email,
        attemptedIdentifier: normalizedIdentifier,
        metadata: loginMetadata,
      });

      response.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const statusMessage = accountStatusError(user.status);
    if (statusMessage) {
      void recordLoginHistoryBestEffort({
        request,
        eventType: AuthEventType.LOGIN,
        status: AuthEventStatus.DENIED,
        failureReason: AuthFailureReason.ACCOUNT_DISABLED,
        userId: user.id,
        actorUserIdSnapshot: user.id,
        actorEmailSnapshot: user.email,
        attemptedIdentifier: normalizedIdentifier,
        metadata: {
          ...loginMetadata,
          accountStatus: user.status,
        },
      });

      response.status(403).json({ message: statusMessage });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: publicUserSelect,
    });

    void recordLoginHistoryBestEffort({
      request,
      eventType: AuthEventType.LOGIN,
      status: AuthEventStatus.SUCCESS,
      userId: updatedUser.id,
      actorUserIdSnapshot: updatedUser.id,
      actorEmailSnapshot: updatedUser.email,
      attemptedIdentifier: normalizedIdentifier,
      metadata: loginMetadata,
    });

    response.json({
      token: createToken(updatedUser.id),
      user: publicUser(updatedUser),
      defaultRoute: defaultRoute(updatedUser.role.name),
    });
  } catch (error) {
    console.error('Login failed:', error);
    response.status(500).json({ message: 'Unable to sign in' });
  }
}

export async function getCurrentUser(request: Request, response: Response) {
  if (!request.userId) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: publicUserSelect,
    });

    if (!user) {
      response.status(401).json({ message: 'User no longer exists' });
      return;
    }

    const statusMessage = accountStatusError(user.status);
    if (statusMessage) {
      response.status(403).json({ message: statusMessage });
      return;
    }

    response.json({
      user: publicUser(user),
      defaultRoute: defaultRoute(user.role.name),
    });
  } catch (error) {
    console.error('Loading current user failed:', error);
    response.status(500).json({ message: 'Unable to load user' });
  }
}

export async function changePassword(request: Request, response: Response) {
  if (!request.userId) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }

  const currentPassword =
    typeof request.body?.currentPassword === 'string'
      ? request.body.currentPassword
      : '';
  const newPassword =
    typeof request.body?.newPassword === 'string' ? request.body.newPassword : '';
  const confirmPassword =
    typeof request.body?.confirmPassword === 'string'
      ? request.body.confirmPassword
      : '';

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    response.status(400).json({
      message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    response.status(400).json({ message: 'New passwords do not match' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { ...publicUserSelect, passwordHash: true },
    });

    if (!user) {
      response.status(401).json({ message: 'User no longer exists' });
      return;
    }

    const statusMessage = accountStatusError(user.status);
    if (statusMessage) {
      response.status(403).json({ message: statusMessage });
      return;
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      response.status(401).json({ message: 'Current password is incorrect.' });
      return;
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      response.status(400).json({
        message: 'New password must be different from the current password.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
      select: publicUserSelect,
    });

    void recordAuditEventBestEffort({
      request,
      eventType: AuditEventType.SECURITY,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.USER,
      entityId: updatedUser.id,
      entityLabel: userEntityLabel(updatedUser),
      actorUserId: updatedUser.id,
      actorUserIdSnapshot: updatedUser.id,
      actorEmailSnapshot: updatedUser.email,
      metadata: { operation: 'PASSWORD_CHANGED' },
    });

    response.json({
      message: 'Password changed successfully.',
      user: publicUser(updatedUser),
      defaultRoute: defaultRoute(updatedUser.role.name),
    });
  } catch (error) {
    console.error('Changing password failed:', error);
    response.status(500).json({ message: 'Unable to change password' });
  }
}
