import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import bcrypt from 'bcrypt';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapAdminError,
  bootstrapInitialAdmin,
  readBootstrapAdminInput,
} from '../src/services/adminBootstrap.js';

const databaseTestsEnabled = process.env.RUN_DATABASE_BOOTSTRAP_TESTS === '1';

function bootstrapEnvironment(overrides: NodeJS.ProcessEnv = {}) {
  return {
    BOOTSTRAP_ADMIN_EMAIL: 'initial.admin@example.invalid',
    BOOTSTRAP_ADMIN_USERNAME: 'initial-admin',
    BOOTSTRAP_ADMIN_PASSWORD: 'temporary-password',
    BOOTSTRAP_ADMIN_NAME: 'Initial Administrator',
    ...overrides,
  };
}

test('bootstrap environment validation uses the current account rules', () => {
  const parsed = readBootstrapAdminInput(
    bootstrapEnvironment({
      BOOTSTRAP_ADMIN_EMAIL: ' ADMIN@EXAMPLE.INVALID ',
      BOOTSTRAP_ADMIN_USERNAME: ' Initial-Admin ',
    }),
  );
  assert.equal(parsed.email, 'admin@example.invalid');
  assert.equal(parsed.username, 'initial-admin');
  assert.equal(parsed.password, 'temporary-password');
  assert.equal(parsed.fullName, 'Initial Administrator');

  assert.throws(
    () => readBootstrapAdminInput({}),
    (error: unknown) => {
      assert.ok(error instanceof BootstrapAdminError);
      assert.match(error.message, /BOOTSTRAP_ADMIN_EMAIL/);
      assert.match(error.message, /BOOTSTRAP_ADMIN_USERNAME/);
      assert.match(error.message, /BOOTSTRAP_ADMIN_PASSWORD/);
      assert.doesNotMatch(error.message, /temporary-password/);
      return true;
    },
  );
  assert.throws(
    () =>
      readBootstrapAdminInput(
        bootstrapEnvironment({ BOOTSTRAP_ADMIN_EMAIL: 'invalid-email' }),
      ),
    /valid email address/,
  );
  assert.throws(
    () =>
      readBootstrapAdminInput(
        bootstrapEnvironment({ BOOTSTRAP_ADMIN_PASSWORD: 'short' }),
      ),
    /at least 8 characters/,
  );
});

test(
  'production Admin bootstrap PostgreSQL and auth regression',
  { skip: !databaseTestsEnabled, timeout: 120_000 },
  async (t) => {
    const sourceUrl = process.env.DATABASE_URL;
    assert.ok(sourceUrl, 'DATABASE_URL is required');

    const parsedUrl = new URL(sourceUrl);
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname),
      'Use a local PostgreSQL database for bootstrap integration tests',
    );

    const schemaName = `bootstrap_qa_${randomUUID().replaceAll('-', '')}`;
    const testUrl = new URL(sourceUrl);
    testUrl.searchParams.set('schema', schemaName);
    const administrator = new PrismaClient({ datasourceUrl: sourceUrl });
    let isolatedPrisma: PrismaClient | null = null;
    let applicationPrisma: PrismaClient | null = null;

    await administrator.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

    try {
      const prismaCli = resolve('node_modules/prisma/build/index.js');
      const migration = spawnSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy'],
        {
          cwd: resolve('.'),
          env: { ...process.env, DATABASE_URL: testUrl.toString() },
          encoding: 'utf8',
        },
      );
      assert.equal(
        migration.status,
        0,
        `Disposable-schema migration failed: ${migration.stderr || migration.stdout}`,
      );

      isolatedPrisma = new PrismaClient({ datasourceUrl: testUrl.toString() });
      const prisma = isolatedPrisma;

      async function resetDatabase() {
        await prisma.auditEvent.deleteMany();
        await prisma.loginHistory.deleteMany();
        await prisma.user.deleteMany();
        await prisma.role.deleteMany();
      }

      async function createRole(name: string) {
        return prisma.role.create({ data: { name, status: 'ACTIVE' } });
      }

      await t.test('fresh state creates one active forced-change Admin and audit', async () => {
        const input = readBootstrapAdminInput(bootstrapEnvironment());
        const result = await bootstrapInitialAdmin(prisma, input);
        assert.equal(result.outcome, 'created');

        const admin = await prisma.user.findUniqueOrThrow({
          where: { email: input.email },
          include: { role: true },
        });
        assert.equal(admin.role.name, 'Admin');
        assert.equal(admin.role.status, 'ACTIVE');
        assert.equal(admin.status, 'ACTIVE');
        assert.equal(admin.mustChangePassword, true);
        assert.notEqual(admin.passwordHash, input.password);
        assert.equal(await bcrypt.compare(input.password, admin.passwordHash), true);
        assert.equal(await prisma.user.count({ where: { role: { name: 'Admin' } } }), 1);

        const audit = await prisma.auditEvent.findFirstOrThrow({
          where: { entityId: admin.id },
        });
        assert.equal(audit.eventType, 'SYSTEM');
        assert.equal(audit.action, 'CREATE');
        assert.equal(audit.actorUserId, null);
        assert.deepEqual(audit.metadata, { operation: 'INITIAL_ADMIN_BOOTSTRAP' });
        assert.doesNotMatch(JSON.stringify(audit), /temporary-password/);
      });

      await t.test('second run skips and leaves the existing Admin untouched', async () => {
        const before = await prisma.user.findFirstOrThrow({
          where: { role: { name: 'Admin' } },
        });
        const result = await bootstrapInitialAdmin(
          prisma,
          readBootstrapAdminInput(
            bootstrapEnvironment({
              BOOTSTRAP_ADMIN_PASSWORD: 'different-temporary-password',
              BOOTSTRAP_ADMIN_NAME: 'Different Name',
            }),
          ),
        );
        const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
        assert.equal(result.outcome, 'skipped');
        assert.deepEqual(after, before);
        assert.equal(await prisma.user.count({ where: { role: { name: 'Admin' } } }), 1);
      });

      await t.test('a different bootstrap identity skips when an Admin exists', async () => {
        const result = await bootstrapInitialAdmin(
          prisma,
          readBootstrapAdminInput(
            bootstrapEnvironment({
              BOOTSTRAP_ADMIN_EMAIL: 'another.admin@example.invalid',
              BOOTSTRAP_ADMIN_USERNAME: 'another-admin',
            }),
          ),
        );
        assert.equal(result.outcome, 'skipped');
        assert.equal(await prisma.user.count({ where: { role: { name: 'Admin' } } }), 1);
      });

      await t.test('username conflict fails without overwrite or role promotion', async () => {
        await resetDatabase();
        const staffRole = await createRole('Staff');
        const staff = await prisma.user.create({
          data: {
            email: 'staff-one@example.invalid',
            username: 'initial-admin',
            passwordHash: 'unchanged-hash',
            roleId: staffRole.id,
          },
        });
        await assert.rejects(
          bootstrapInitialAdmin(
            prisma,
            readBootstrapAdminInput(bootstrapEnvironment()),
          ),
          /BOOTSTRAP_ADMIN_USERNAME is already used/,
        );
        assert.deepEqual(
          await prisma.user.findUniqueOrThrow({ where: { id: staff.id } }),
          staff,
        );
        assert.equal(await prisma.role.count({ where: { name: 'Admin' } }), 0);
      });

      await t.test('email conflict fails without overwrite or role promotion', async () => {
        await resetDatabase();
        const staffRole = await createRole('Staff');
        const staff = await prisma.user.create({
          data: {
            email: 'initial.admin@example.invalid',
            username: 'staff-two',
            passwordHash: 'unchanged-hash',
            roleId: staffRole.id,
          },
        });
        await assert.rejects(
          bootstrapInitialAdmin(
            prisma,
            readBootstrapAdminInput(bootstrapEnvironment()),
          ),
          /BOOTSTRAP_ADMIN_EMAIL is already used/,
        );
        assert.deepEqual(
          await prisma.user.findUniqueOrThrow({ where: { id: staff.id } }),
          staff,
        );
        assert.equal(await prisma.role.count({ where: { name: 'Admin' } }), 0);
      });

      await t.test('case-mismatched Admin role is not duplicated or renamed', async () => {
        await resetDatabase();
        const legacyRole = await createRole('admin');
        await assert.rejects(
          bootstrapInitialAdmin(
            prisma,
            readBootstrapAdminInput(bootstrapEnvironment()),
          ),
          /unexpected casing/,
        );
        assert.deepEqual(
          await prisma.role.findUniqueOrThrow({ where: { id: legacyRole.id } }),
          legacyRole,
        );
        assert.equal(await prisma.role.count(), 1);
      });

      await t.test('concurrent commands create exactly one Admin', async () => {
        await resetDatabase();
        const firstInput = readBootstrapAdminInput(bootstrapEnvironment());
        const secondInput = readBootstrapAdminInput(
          bootstrapEnvironment({
            BOOTSTRAP_ADMIN_EMAIL: 'concurrent.admin@example.invalid',
            BOOTSTRAP_ADMIN_USERNAME: 'concurrent-admin',
          }),
        );
        const results = await Promise.all([
          bootstrapInitialAdmin(prisma, firstInput),
          bootstrapInitialAdmin(prisma, secondInput),
        ]);
        assert.deepEqual(
          results.map((result) => result.outcome).sort(),
          ['created', 'skipped'],
        );
        assert.equal(await prisma.user.count({ where: { role: { name: 'Admin' } } }), 1);
      });

      await t.test('real API enforces password change and grants Admin authorization', async () => {
        await resetDatabase();
        const input = readBootstrapAdminInput(bootstrapEnvironment());
        await bootstrapInitialAdmin(prisma, input);

        process.env.DATABASE_URL = testUrl.toString();
        process.env.JWT_SECRET = randomUUID();
        const [{ authRouter }, { userRouter }, prismaModule] = await Promise.all([
          import('../src/routes/authRoutes.js'),
          import('../src/routes/userRoutes.js'),
          import('../src/lib/prisma.js'),
        ]);
        applicationPrisma = prismaModule.prisma;

        const app = express();
        app.use(express.json());
        app.use('/api/auth', authRouter);
        app.use('/api/users', userRouter);
        const server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        const request = (path: string, body?: unknown, token?: string) =>
          fetch(`${origin}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          });

        try {
          const login = await request('/api/auth/login', {
            identifier: input.username,
            password: input.password,
          });
          assert.equal(login.status, 200, await login.clone().text());
          const loginBody = await login.json() as {
            token: string;
            user: { mustChangePassword: boolean };
          };
          assert.equal(loginBody.user.mustChangePassword, true);

          const newPassword = 'replacement-password';
          const changed = await request(
            '/api/auth/change-password',
            {
              currentPassword: input.password,
              newPassword,
              confirmPassword: newPassword,
            },
            loginBody.token,
          );
          assert.equal(changed.status, 200, await changed.clone().text());
          assert.equal((await changed.json()).user.mustChangePassword, false);

          const oldLogin = await request('/api/auth/login', {
            identifier: input.email,
            password: input.password,
          });
          assert.equal(oldLogin.status, 401);

          const newLogin = await request('/api/auth/login', {
            identifier: input.email,
            password: newPassword,
          });
          assert.equal(newLogin.status, 200, await newLogin.clone().text());
          const newLoginBody = await newLogin.json() as {
            token: string;
            user: { mustChangePassword: boolean };
          };
          assert.equal(newLoginBody.user.mustChangePassword, false);

          const users = await request('/api/users', undefined, newLoginBody.token);
          assert.equal(users.status, 200, await users.clone().text());
        } finally {
          await new Promise<void>((resolveClose, rejectClose) =>
            server.close((error) => error ? rejectClose(error) : resolveClose()),
          );
        }
      });
    } finally {
      if (applicationPrisma) await applicationPrisma.$disconnect();
      if (isolatedPrisma) await isolatedPrisma.$disconnect();
      process.env.DATABASE_URL = sourceUrl;
      await administrator.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
      );
      await administrator.$disconnect();
    }
  },
);
