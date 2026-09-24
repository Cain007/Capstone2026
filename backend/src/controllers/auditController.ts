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
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logError } from '../utils/safeLogger.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const auditActorSelect = {
  id: true,
  email: true,
  fullName: true,
  username: true,
  role: { select: { name: true } },
} as const satisfies Prisma.UserSelect;

const auditEventSelect = {
  id: true,
  eventType: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  status: true,
  actorUserIdSnapshot: true,
  actorEmailSnapshot: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  before: true,
  after: true,
  metadata: true,
  createdAt: true,
  actor: { select: auditActorSelect },
} as const satisfies Prisma.AuditEventSelect;

const loginHistorySelect = {
  id: true,
  eventType: true,
  status: true,
  failureReason: true,
  actorUserIdSnapshot: true,
  actorEmailSnapshot: true,
  attemptedEmail: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  createdAt: true,
  user: { select: auditActorSelect },
} as const satisfies Prisma.LoginHistorySelect;

function parsePositiveInteger(value: unknown, field: string, defaultValue: number) {
  if (value === undefined) return { ok: true as const, value: defaultValue };
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return { ok: false as const, message: `${field} must be a positive integer` };
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { ok: false as const, message: `${field} must be a positive integer` };
  }

  return { ok: true as const, value: parsed };
}

function parsePagination(request: Request) {
  const page = parsePositiveInteger(request.query.page, 'page', DEFAULT_PAGE);
  if (!page.ok) return page;

  const limit = parsePositiveInteger(request.query.limit, 'limit', DEFAULT_LIMIT);
  if (!limit.ok) return limit;

  if (limit.value > MAX_LIMIT) {
    return {
      ok: false as const,
      message: `limit must be less than or equal to ${MAX_LIMIT}`,
    };
  }

  return { ok: true as const, page: page.value, limit: limit.value };
}

function parseEnumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
) {
  if (value === undefined) return { ok: true as const, value: undefined };
  if (
    typeof value !== 'string' ||
    !values.includes(value as T)
  ) {
    return { ok: false as const, message: `Invalid ${field}` };
  }

  return { ok: true as const, value: value as T };
}

function parseDateBoundary(value: unknown, field: 'from' | 'to') {
  if (value === undefined) return { ok: true as const, value: undefined };
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false as const, message: `${field} must be a valid date` };
  }

  const trimmed = value.trim();
  const parsed = DATE_ONLY_PATTERN.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return { ok: false as const, message: `${field} must be a valid date` };
  }

  if (field === 'to' && DATE_ONLY_PATTERN.test(trimmed)) {
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return { ok: true as const, value: parsed, exclusive: true };
  }

  return { ok: true as const, value: parsed, exclusive: false };
}

function parseDateRange(query: Request['query']) {
  const from = parseDateBoundary(query.from, 'from');
  if (!from.ok) return from;

  const to = parseDateBoundary(query.to, 'to');
  if (!to.ok) return to;

  if (from.value && to.value) {
    const invalidRange = to.exclusive
      ? from.value >= to.value
      : from.value > to.value;

    if (invalidRange) {
      return { ok: false as const, message: 'from must be before to' };
    }
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (from.value) createdAt.gte = from.value;
  if (to.value) {
    if (to.exclusive) createdAt.lt = to.value;
    else createdAt.lte = to.value;
  }

  return {
    ok: true as const,
    value: Object.keys(createdAt).length ? createdAt : undefined,
  };
}

function parseStringFilter(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function paginationResponse(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

function actorResponse(
  user: {
    id: string;
    email: string;
    fullName: string | null;
    username: string | null;
    role: { name: string };
  } | null,
  actorEmailSnapshot: string | null,
) {
  if (user) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      username: user.username,
      role: user.role.name,
    };
  }

  if (actorEmailSnapshot) {
    return {
      id: null,
      email: actorEmailSnapshot,
      fullName: null,
      username: null,
      role: null,
    };
  }

  return null;
}

export async function listAuditEvents(request: Request, response: Response) {
  const pagination = parsePagination(request);
  if (!pagination.ok) {
    response.status(400).json({ message: pagination.message });
    return;
  }

  const eventType = parseEnumValue(
    request.query.eventType,
    Object.values(AuditEventType),
    'eventType',
  );
  const action = parseEnumValue(
    request.query.action,
    Object.values(AuditAction),
    'action',
  );
  const entityType = parseEnumValue(
    request.query.entityType,
    Object.values(AuditEntityType),
    'entityType',
  );
  const status = parseEnumValue(
    request.query.status,
    Object.values(AuditEventStatus),
    'status',
  );
  for (const parsed of [eventType, action, entityType, status]) {
    if (!parsed.ok) {
      response.status(400).json({ message: parsed.message });
      return;
    }
  }

  const dateRange = parseDateRange(request.query);
  if (!dateRange.ok) {
    response.status(400).json({ message: dateRange.message });
    return;
  }

  const actorUserId = parseStringFilter(request.query.actorUserId);
  const search = parseStringFilter(request.query.search);
  const where: Prisma.AuditEventWhereInput = {
    eventType: eventType.value,
    action: action.value,
    entityType: entityType.value,
    status: status.value,
    actorUserId,
    createdAt: dateRange.value,
    ...(search
      ? {
          OR: [
            { entityLabel: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { actorEmailSnapshot: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };

  try {
    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        select: auditEventSelect,
      }),
    ]);

    response.json({
      items: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        entityLabel: event.entityLabel,
        status: event.status,
        actor: actorResponse(event.actor, event.actorEmailSnapshot),
        actorUserIdSnapshot: event.actorUserIdSnapshot,
        actorEmailSnapshot: event.actorEmailSnapshot,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        requestId: event.requestId,
        before: event.before,
        after: event.after,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
      pagination: paginationResponse(pagination.page, pagination.limit, total),
    });
  } catch (error) {
    logError('Listing audit events failed', error);
    response.status(500).json({ message: 'Unable to load audit events' });
  }
}

export async function listLoginHistory(request: Request, response: Response) {
  const pagination = parsePagination(request);
  if (!pagination.ok) {
    response.status(400).json({ message: pagination.message });
    return;
  }

  const eventType = parseEnumValue(
    request.query.eventType,
    Object.values(AuthEventType),
    'eventType',
  );
  const status = parseEnumValue(
    request.query.status,
    Object.values(AuthEventStatus),
    'status',
  );
  const failureReason = parseEnumValue(
    request.query.failureReason,
    Object.values(AuthFailureReason),
    'failureReason',
  );
  for (const parsed of [eventType, status, failureReason]) {
    if (!parsed.ok) {
      response.status(400).json({ message: parsed.message });
      return;
    }
  }

  const dateRange = parseDateRange(request.query);
  if (!dateRange.ok) {
    response.status(400).json({ message: dateRange.message });
    return;
  }

  const userId = parseStringFilter(request.query.userId);
  const search = parseStringFilter(request.query.search);
  const where: Prisma.LoginHistoryWhereInput = {
    eventType: eventType.value,
    status: status.value,
    failureReason: failureReason.value,
    userId,
    createdAt: dateRange.value,
    ...(search
      ? {
          OR: [
            { attemptedEmail: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { actorEmailSnapshot: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };

  try {
    const [total, history] = await Promise.all([
      prisma.loginHistory.count({ where }),
      prisma.loginHistory.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        select: loginHistorySelect,
      }),
    ]);

    response.json({
      items: history.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        status: entry.status,
        failureReason: entry.failureReason,
        user: actorResponse(entry.user, entry.actorEmailSnapshot),
        actorUserIdSnapshot: entry.actorUserIdSnapshot,
        actorEmailSnapshot: entry.actorEmailSnapshot,
        attemptedEmail: entry.attemptedEmail,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      })),
      pagination: paginationResponse(pagination.page, pagination.limit, total),
    });
  } catch (error) {
    logError('Listing login history failed', error);
    response.status(500).json({ message: 'Unable to load login history' });
  }
}
