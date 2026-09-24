import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import bcrypt from 'bcrypt';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import {
  EnvironmentValidationError,
  loadBackendEnvironment,
} from '../src/config/env.js';

const databaseTestsEnabled = process.env.RUN_DATABASE_SECURITY_TESTS === '1';

function productionEnvironment(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@database.example.test/app',
    JWT_SECRET: 'test-only-secret-that-is-longer-than-32-characters',
    FRONTEND_URL: 'https://frontend.example.test',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    PORT: '5000',
    ...overrides,
  };
}

test('production environment validation requires safe critical configuration', () => {
  const parsed = loadBackendEnvironment(productionEnvironment());
  assert.equal(parsed.isProduction, true);
  assert.equal(parsed.frontendOrigin, 'https://frontend.example.test');
  assert.equal(parsed.trustProxy, 1);

  const missingJwt = productionEnvironment();
  delete missingJwt.JWT_SECRET;
  assert.throws(
    () => loadBackendEnvironment(missingJwt),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /JWT_SECRET/);
      assert.doesNotMatch(error.message, /test-only-secret/);
      return true;
    },
  );
  assert.throws(
    () =>
      loadBackendEnvironment(
        productionEnvironment({ FRONTEND_URL: 'http://localhost:5173' }),
      ),
    /FRONTEND_URL/,
  );
  assert.throws(
    () =>
      loadBackendEnvironment(
        productionEnvironment({ JWT_SECRET: 'too-short' }),
      ),
    /JWT_SECRET/,
  );
});

test('bootstrap variables are not required for production server configuration', () => {
  const environment = productionEnvironment();
  for (const key of [
    'BOOTSTRAP_ADMIN_EMAIL',
    'BOOTSTRAP_ADMIN_USERNAME',
    'BOOTSTRAP_ADMIN_PASSWORD',
    'BOOTSTRAP_ADMIN_NAME',
  ]) {
    delete environment[key];
  }
  assert.doesNotThrow(() => loadBackendEnvironment(environment));
});

test('production server exits before listening when critical configuration is missing', () => {
  const environment = { ...process.env, ...productionEnvironment() };
  environment.JWT_SECRET = '';
  const result = spawnSync(
    process.execPath,
    [resolve('node_modules/tsx/dist/cli.mjs'), 'src/server.ts'],
    {
      cwd: resolve('.'),
      env: environment,
      encoding: 'utf8',
      timeout: 15_000,
    },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /JWT_SECRET/);
  assert.doesNotMatch(output, /test-only-secret/);
  assert.doesNotMatch(output, /API running/);
});

test(
  'production HTTP security regression',
  { skip: !databaseTestsEnabled, timeout: 120_000 },
  async (t) => {
    const sourceUrl = process.env.DATABASE_URL;
    assert.ok(sourceUrl, 'DATABASE_URL is required');
    const parsedUrl = new URL(sourceUrl);
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname),
      'Use a local PostgreSQL database for security integration tests',
    );

    const schemaName = `security_qa_${randomUUID().replaceAll('-', '')}`;
    const testUrl = new URL(sourceUrl);
    testUrl.searchParams.set('schema', schemaName);
    const administrator = new PrismaClient({ datasourceUrl: sourceUrl });
    let applicationPrisma: PrismaClient | null = null;
    const changedEnvironmentKeys = [
      'NODE_ENV',
      'DATABASE_URL',
      'JWT_SECRET',
      'FRONTEND_URL',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'PORT',
    ];
    const previousEnvironment = Object.fromEntries(
      changedEnvironmentKeys.map((key) => [key, process.env[key]]),
    );

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

      const runtimeVariables = productionEnvironment({
        DATABASE_URL: testUrl.toString(),
        JWT_SECRET: randomUUID() + randomUUID(),
        PORT: '5000',
      });
      Object.assign(process.env, runtimeVariables);

      const [{ createApp }, { errorHandler }, prismaModule] = await Promise.all([
        import('../src/app.js'),
        import('../src/middleware/errorHandler.js'),
        import('../src/lib/prisma.js'),
      ]);
      applicationPrisma = prismaModule.prisma;
      const prisma = applicationPrisma;
      const [adminRole, staffRole] = await Promise.all([
        prisma.role.findUniqueOrThrow({ where: { name: 'Admin' } }),
        prisma.role.findUniqueOrThrow({ where: { name: 'Staff' } }),
      ]);
      const password = 'temporary-password';
      const passwordHash = await bcrypt.hash(password, 12);
      await Promise.all([
        prisma.user.create({
          data: {
            email: 'admin@security-qa.invalid',
            username: 'security-admin',
            passwordHash,
            roleId: adminRole.id,
            mustChangePassword: true,
          },
        }),
        prisma.user.create({
          data: {
            email: 'staff@security-qa.invalid',
            username: 'security-staff',
            passwordHash,
            roleId: staffRole.id,
          },
        }),
      ]);

      const app = createApp(loadBackendEnvironment(process.env));
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      const frontendOrigin = runtimeVariables.FRONTEND_URL!;
      const request = (
        path: string,
        options: RequestInit = {},
        forwardedFor?: string,
      ) =>
        fetch(`${origin}${path}`, {
          ...options,
          headers: {
            ...(options.headers ?? {}),
            ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
          },
        });
      const login = async (identifier: string, clientIp: string, loginPassword = password) => {
        const response = await request(
          '/api/auth/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password: loginPassword }),
          },
          clientIp,
        );
        return response;
      };

      try {
        await t.test('health and Helmet headers remain available', async () => {
          const response = await request('/api/health');
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { status: 'ok' });
          assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
          assert.ok(response.headers.get('x-frame-options'));
          assert.ok(response.headers.get('referrer-policy'));
          assert.equal(response.headers.get('x-powered-by'), null);
        });

        await t.test('CORS allows exact origin, supports preflight, and rejects others', async () => {
          const allowed = await request('/api/health', {
            headers: { Origin: frontendOrigin },
          });
          assert.equal(allowed.status, 200);
          assert.equal(
            allowed.headers.get('access-control-allow-origin'),
            frontendOrigin,
          );
          assert.notEqual(allowed.headers.get('access-control-allow-origin'), '*');

          const preflight = await request('/api/auth/login', {
            method: 'OPTIONS',
            headers: {
              Origin: frontendOrigin,
              'Access-Control-Request-Method': 'POST',
              'Access-Control-Request-Headers': 'Authorization, Content-Type',
            },
          });
          assert.equal(preflight.status, 204);
          assert.equal(
            preflight.headers.get('access-control-allow-origin'),
            frontendOrigin,
          );
          assert.match(
            preflight.headers.get('access-control-allow-headers') ?? '',
            /Authorization/i,
          );

          const denied = await request('/api/health', {
            headers: { Origin: 'https://attacker.example.test' },
          });
          assert.equal(denied.status, 403);
          assert.deepEqual(await denied.json(), { message: 'Origin is not allowed' });
          assert.equal(denied.headers.get('access-control-allow-origin'), null);
        });

        let adminToken = '';
        let staffToken = '';
        await t.test('Admin and Staff login contracts remain unchanged', async () => {
          const adminLogin = await login('security-admin', '198.51.100.10');
          assert.equal(adminLogin.status, 200, await adminLogin.clone().text());
          const adminBody = await adminLogin.json() as {
            token: string;
            user: { role: string; mustChangePassword: boolean };
          };
          adminToken = adminBody.token;
          assert.equal(adminBody.user.role, 'Admin');
          assert.equal(adminBody.user.mustChangePassword, true);

          const staffLogin = await login('staff@security-qa.invalid', '198.51.100.11');
          assert.equal(staffLogin.status, 200, await staffLogin.clone().text());
          const staffBody = await staffLogin.json() as {
            token: string;
            user: { role: string };
          };
          staffToken = staffBody.token;
          assert.equal(staffBody.user.role, 'Staff');
        });

        await t.test('successful logins are removed from the limiter count', async () => {
          for (let attempt = 0; attempt < 7; attempt += 1) {
            const response = await login('security-staff', '198.51.100.12');
            assert.equal(response.status, 200, await response.clone().text());
          }
        });

        await t.test('forced password change and RBAC still work', async () => {
          const replacementPassword = 'replacement-password';
          const changed = await request('/api/auth/change-password', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              currentPassword: password,
              newPassword: replacementPassword,
              confirmPassword: replacementPassword,
            }),
          });
          assert.equal(changed.status, 200, await changed.clone().text());
          assert.equal((await changed.json()).user.mustChangePassword, false);

          const oldPassword = await login(
            'security-admin',
            '198.51.100.13',
            password,
          );
          assert.equal(oldPassword.status, 401);
          const newPassword = await login(
            'security-admin',
            '198.51.100.14',
            replacementPassword,
          );
          assert.equal(newPassword.status, 200);
          adminToken = (await newPassword.json()).token;

          const adminUsers = await request('/api/users', {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          assert.equal(adminUsers.status, 200, await adminUsers.clone().text());
          const staffUsers = await request('/api/users', {
            headers: { Authorization: `Bearer ${staffToken}` },
          });
          assert.equal(staffUsers.status, 403);
        });

        await t.test('five failed logins are allowed and the sixth is limited by proxy IP', async () => {
          const clientIp = '198.51.100.20';
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await login('missing-user', clientIp, 'wrong-password');
            assert.equal(response.status, 401, await response.clone().text());
            assert.doesNotMatch(await response.text(), /account|username exists/i);
          }
          const limited = await login('missing-user', clientIp, 'wrong-password');
          assert.equal(limited.status, 429);
          assert.deepEqual(await limited.json(), {
            message: 'Too many sign-in attempts. Please try again later.',
          });
          assert.ok(Number(limited.headers.get('retry-after')) > 0);

          const otherClient = await login(
            'missing-user',
            '198.51.100.21',
            'wrong-password',
          );
          assert.equal(otherClient.status, 401);
          assert.equal((await request('/api/health')).status, 200);
          const users = await request('/api/users', {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          assert.equal(users.status, 200);
        });

        await t.test('body parser errors and unknown routes return controlled JSON', async () => {
          const malformed = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"identifier":',
          });
          assert.equal(malformed.status, 400);
          assert.match(malformed.headers.get('content-type') ?? '', /application\/json/);
          assert.deepEqual(await malformed.json(), {
            message: 'Malformed JSON request body',
          });

          const oversized = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ padding: 'x'.repeat(11 * 1024) }),
          });
          assert.equal(oversized.status, 413);
          assert.deepEqual(await oversized.json(), {
            message: 'Request body is too large',
          });

          const missing = await request('/api/not-a-route');
          assert.equal(missing.status, 404);
          assert.deepEqual(await missing.json(), { message: 'Route not found' });
        });

        await t.test('unexpected errors return generic JSON and safe logs', async () => {
          const failureApp = express();
          failureApp.get('/explode', () => {
            throw new Error('sensitive-database-value');
          });
          failureApp.use(errorHandler);
          const failureServer = failureApp.listen(0, '127.0.0.1');
          await once(failureServer, 'listening');
          const failureOrigin = `http://127.0.0.1:${(failureServer.address() as { port: number }).port}`;
          const logCalls: unknown[][] = [];
          const errorMock = mock.method(console, 'error', (...args: unknown[]) => {
            logCalls.push(args);
          });
          try {
            const response = await fetch(`${failureOrigin}/explode`);
            assert.equal(response.status, 500);
            assert.deepEqual(await response.json(), {
              message: 'Internal server error',
            });
            assert.doesNotMatch(JSON.stringify(logCalls), /sensitive-database-value/);
          } finally {
            errorMock.mock.restore();
            await new Promise<void>((resolveClose, rejectClose) =>
              failureServer.close((error) =>
                error ? rejectClose(error) : resolveClose(),
              ),
            );
          }
        });
      } finally {
        await new Promise<void>((resolveClose, rejectClose) =>
          server.close((error) => error ? rejectClose(error) : resolveClose()),
        );
      }
    } finally {
      if (applicationPrisma) await applicationPrisma.$disconnect();
      for (const key of changedEnvironmentKeys) {
        const previous = previousEnvironment[key];
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      }
      await administrator.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
      );
      await administrator.$disconnect();
    }
  },
);
