import {
  AuditAction,
  AuditEntityType,
  AuditEventType,
  Prisma,
  PrismaClient,
  RoleStatus,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  PASSWORD_HASH_ROUNDS,
} from '../utils/accountValidation.js';

export const BOOTSTRAP_ENV_NAMES = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_USERNAME',
  'BOOTSTRAP_ADMIN_PASSWORD',
] as const;

const ADMIN_ROLE_NAME = 'Admin';
const ADMIN_ROLE_DESCRIPTION =
  'Full system access, including users, settings, reports, and audit logs.';
const BOOTSTRAP_LOCK_KEY = 12_026_001;
const SERIALIZABLE_RETRY_LIMIT = 3;

export type BootstrapAdminInput = {
  email: string;
  username: string;
  password: string;
  fullName: string | null;
};

export type BootstrapAdminResult =
  | {
      outcome: 'created';
      admin: { id: string; email: string; username: string | null };
    }
  | {
      outcome: 'skipped';
      admin: { id: string; email: string; username: string | null };
    };

export class BootstrapAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapAdminError';
  }
}

function requiredValue(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function readBootstrapAdminInput(
  environment: NodeJS.ProcessEnv,
): BootstrapAdminInput {
  const missing = BOOTSTRAP_ENV_NAMES.filter(
    (name) => requiredValue(environment, name) === null,
  );

  if (missing.length) {
    throw new BootstrapAdminError(
      `Missing required bootstrap variables:\n${missing.join('\n')}`,
    );
  }

  const email = requiredValue(environment, 'BOOTSTRAP_ADMIN_EMAIL')!
    .trim()
    .toLowerCase();
  const username = requiredValue(environment, 'BOOTSTRAP_ADMIN_USERNAME')!
    .trim()
    .toLowerCase();
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD!;
  const fullName = environment.BOOTSTRAP_ADMIN_NAME?.trim() || null;

  if (!EMAIL_PATTERN.test(email)) {
    throw new BootstrapAdminError(
      'BOOTSTRAP_ADMIN_EMAIL must be a valid email address.',
    );
  }

  if (!username) {
    throw new BootstrapAdminError(
      'BOOTSTRAP_ADMIN_USERNAME must be a non-empty username.',
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BootstrapAdminError(
      `BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  return { email, username, password, fullName };
}

function isTransactionConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function uniqueConflictField(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return null;
  }

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(',')
    : String(error.meta?.target ?? '');

  if (target.includes('email')) return 'email';
  if (target.includes('username')) return 'username';
  return null;
}

async function runBootstrapTransaction(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
  passwordHash: string,
): Promise<BootstrapAdminResult> {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;

      const caseInsensitiveAdminRole = await transaction.role.findFirst({
        where: { name: { equals: ADMIN_ROLE_NAME, mode: 'insensitive' } },
        select: { name: true },
      });

      if (
        caseInsensitiveAdminRole &&
        caseInsensitiveAdminRole.name !== ADMIN_ROLE_NAME
      ) {
        throw new BootstrapAdminError(
          `The Admin role exists with unexpected casing (${caseInsensitiveAdminRole.name}). Bootstrap stopped without changing roles.`,
        );
      }

      const adminRole = await transaction.role.upsert({
        where: { name: ADMIN_ROLE_NAME },
        update: { status: RoleStatus.ACTIVE },
        create: {
          name: ADMIN_ROLE_NAME,
          description: ADMIN_ROLE_DESCRIPTION,
          status: RoleStatus.ACTIVE,
        },
        select: { id: true },
      });

      const existingAdmin = await transaction.user.findFirst({
        where: { role: { name: ADMIN_ROLE_NAME } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, username: true },
      });

      if (existingAdmin) {
        return { outcome: 'skipped', admin: existingAdmin };
      }

      const identityConflict = await transaction.user.findFirst({
        where: {
          OR: [{ email: input.email }, { username: input.username }],
        },
        select: { email: true, username: true },
      });

      if (identityConflict?.email === input.email) {
        throw new BootstrapAdminError(
          'BOOTSTRAP_ADMIN_EMAIL is already used by another account.',
        );
      }

      if (identityConflict?.username === input.username) {
        throw new BootstrapAdminError(
          'BOOTSTRAP_ADMIN_USERNAME is already used by another account.',
        );
      }

      const admin = await transaction.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          username: input.username,
          passwordHash,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
        },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          status: true,
          mustChangePassword: true,
        },
      });

      await transaction.auditEvent.create({
        data: {
          eventType: AuditEventType.SYSTEM,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.USER,
          entityId: admin.id,
          entityLabel: admin.fullName ?? admin.username ?? admin.email,
          after: {
            fullName: admin.fullName,
            username: admin.username,
            email: admin.email,
            role: ADMIN_ROLE_NAME,
            status: admin.status,
            mustChangePassword: admin.mustChangePassword,
          },
          metadata: { operation: 'INITIAL_ADMIN_BOOTSTRAP' },
        },
      });

      return {
        outcome: 'created',
        admin: { id: admin.id, email: admin.email, username: admin.username },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function bootstrapInitialAdmin(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> {
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS);

  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await runBootstrapTransaction(prisma, input, passwordHash);
    } catch (error) {
      if (isTransactionConflict(error) && attempt < SERIALIZABLE_RETRY_LIMIT) {
        continue;
      }

      const conflictField = uniqueConflictField(error);
      if (conflictField === 'email') {
        throw new BootstrapAdminError(
          'BOOTSTRAP_ADMIN_EMAIL is already used by another account.',
        );
      }
      if (conflictField === 'username') {
        throw new BootstrapAdminError(
          'BOOTSTRAP_ADMIN_USERNAME is already used by another account.',
        );
      }

      throw error;
    }
  }

  throw new BootstrapAdminError(
    'Admin bootstrap could not complete due to concurrent database activity.',
  );
}
