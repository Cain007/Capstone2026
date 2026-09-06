import {
  AuditAction,
  AuditEntityType,
  AuditEventStatus,
  AuditEventType,
  AuthEventStatus,
  AuthEventType,
  AuthFailureReason,
  Prisma,
} from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';

type AuditClient = Prisma.TransactionClient | typeof prisma;

type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
};

type UserIdentity = {
  id?: string | null;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
};

export type RecordLoginHistoryInput = {
  request: Request;
  eventType: AuthEventType;
  status: AuthEventStatus;
  failureReason?: AuthFailureReason | null;
  userId?: string | null;
  actorUserIdSnapshot?: string | null;
  actorEmailSnapshot?: string | null;
  attemptedIdentifier?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type RecordAuditEventInput = {
  request: Request;
  eventType: AuditEventType;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  status?: AuditEventStatus;
  actorUserId?: string | null;
  actorUserIdSnapshot?: string | null;
  actorEmailSnapshot?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

function trimToNull(value: string | null | undefined, maxLength?: number) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return typeof maxLength === 'number' ? trimmed.slice(0, maxLength) : trimmed;
}

export function getRequestContext(request: Request): RequestContext {
  const requestWithId = request as Request & { requestId?: unknown };
  const requestId =
    typeof requestWithId.requestId === 'string' ? requestWithId.requestId : null;

  return {
    ipAddress: trimToNull(request.ip, 45),
    userAgent: trimToNull(request.get('user-agent'), 512),
    requestId: trimToNull(requestId),
  };
}

export function getLoginIdentifierType(identifier: string) {
  return identifier.includes('@') ? 'EMAIL' : 'USERNAME';
}

export function userEntityLabel(user: UserIdentity) {
  return (
    trimToNull(user.fullName) ??
    trimToNull(user.username) ??
    trimToNull(user.email) ??
    null
  );
}

async function resolveActorEmail(
  client: AuditClient,
  actorUserId: string | null | undefined,
  providedEmail: string | null | undefined,
) {
  if (providedEmail !== undefined) return trimToNull(providedEmail);
  if (!actorUserId) return null;

  const actor = await client.user.findUnique({
    where: { id: actorUserId },
    select: { email: true },
  });

  return actor?.email ?? null;
}

export async function recordLoginHistory(
  input: RecordLoginHistoryInput,
  client: AuditClient = prisma,
) {
  const context = getRequestContext(input.request);
  const actorUserIdSnapshot =
    input.actorUserIdSnapshot ?? input.userId ?? null;
  const actorEmailSnapshot = await resolveActorEmail(
    client,
    actorUserIdSnapshot,
    input.actorEmailSnapshot,
  );

  return client.loginHistory.create({
    data: {
      eventType: input.eventType,
      status: input.status,
      failureReason: input.failureReason ?? null,
      userId: input.userId ?? null,
      actorUserIdSnapshot,
      actorEmailSnapshot,
      attemptedEmail: trimToNull(input.attemptedIdentifier, 320),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: input.metadata,
    },
  });
}

export async function recordLoginHistoryBestEffort(
  input: RecordLoginHistoryInput,
) {
  try {
    await recordLoginHistory(input);
  } catch (error) {
    console.error('Recording login history failed:', error);
  }
}

export async function recordAuditEvent(
  input: RecordAuditEventInput,
  client: AuditClient = prisma,
) {
  const context = getRequestContext(input.request);
  const actorUserIdSnapshot =
    input.actorUserIdSnapshot ?? input.actorUserId ?? null;
  const actorEmailSnapshot = await resolveActorEmail(
    client,
    actorUserIdSnapshot,
    input.actorEmailSnapshot,
  );

  return client.auditEvent.create({
    data: {
      eventType: input.eventType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: trimToNull(input.entityLabel, 512),
      status: input.status ?? AuditEventStatus.SUCCESS,
      actorUserId: input.actorUserId ?? null,
      actorUserIdSnapshot,
      actorEmailSnapshot,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
      before: input.before,
      after: input.after,
      metadata: input.metadata,
    },
  });
}

export async function recordAuditEventBestEffort(input: RecordAuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    console.error('Recording audit event failed:', error);
  }
}
