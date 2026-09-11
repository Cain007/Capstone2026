import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import test, { mock } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../src/lib/prisma.js';
import { productRouter } from '../src/routes/productRoutes.js';
import { requireAuth } from '../src/middleware/authMiddleware.js';
import { inventoryRouter } from '../src/routes/inventoryRoutes.js';
import { forecastRouter } from '../src/routes/forecastRoutes.js';
import { reportRouter } from '../src/routes/reportRoutes.js';
import { salesRouter } from '../src/routes/salesRoutes.js';

// Explicit opt-in: this suite creates and removes only its own records in a local DB.
const enabled = process.env.RUN_DATABASE_IMAGE_TESTS === '1';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64');
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==', 'base64');

test('product image HTTP + PostgreSQL regression (mock Cloudinary)', { skip: !enabled }, async t => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Use a local development/test database');
  const prefix = `image-qa-${randomUUID()}`;
  const envKeys = ['JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const oldEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  process.env.JWT_SECRET = randomUUID();
  for (const key of envKeys.slice(1)) delete process.env[key];
  const userIds: string[] = [], productIds: string[] = [];
  const uploads: { publicId: string; bytes: Buffer; options: Record<string, unknown> }[] = [];
  const deletes: string[] = [];
  const referencesAtDeletion = new Map<string, number>();
  let failUpload = false, failDelete = false, missingAsset = false;
  let beforeUploadCallback: (() => Promise<void>) | undefined;
  let adminToken = '', staffToken = '', categoryId = '', counter = 0;
  const app = express();
  app.use(express.json());
  app.use('/api/products', requireAuth, productRouter);
  app.use('/api/inventory', requireAuth, inventoryRouter);
  app.use('/api/forecasts', requireAuth, forecastRouter);
  app.use('/api/reports', requireAuth, reportRouter);
  app.use('/api/sales', requireAuth, salesRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const uploadMock = mock.method(cloudinary.uploader, 'upload_stream', (options: Record<string, unknown>, callback: (error: { message: string } | null, result?: { public_id: string; secure_url: string }) => void) => {
    const chunks: Buffer[] = [];
    return new Writable({
      write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
      final(done) {
        void (async () => {
          if (beforeUploadCallback) await beforeUploadCallback();
          if (failUpload) callback({ message: 'provider-secret-must-not-leak' });
          else {
            const publicId = `king-of-clouds/products/${prefix}-${++counter}`;
            uploads.push({ publicId, bytes: Buffer.concat(chunks), options });
            callback(null, { public_id: publicId, secure_url: `https://res.cloudinary.com/qa/image/upload/${publicId}.png` });
          }
          done();
        })().catch(done);
      },
    });
  });
  const destroyMock = mock.method(cloudinary.uploader, 'destroy', async (id: string) => {
    deletes.push(id);
    referencesAtDeletion.set(id, await prisma.product.count({ where: { imagePublicId: id } }));
    if (failDelete) throw new Error('provider-secret-must-not-leak');
    return { result: missingAsset ? 'not found' : 'ok' };
  });
  const warnings: string[] = [];
  const warnMock = mock.method(console, 'warn', (...args: unknown[]) => warnings.push(JSON.stringify(args)));
  async function token(roleName: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@image-qa.invalid`, passwordHash: 'not-a-login-credential', roleId: role.id } });
    userIds.push(user.id);
    return jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '5m' });
  }
  async function request(path: string, method = 'GET', body?: BodyInit, auth = adminToken, json = false) {
    return fetch(`${origin}/api${path}`, { method, body, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) } });
  }
  function form(bytes = png, mime = 'image/png', field = 'image') {
    const body = new FormData();
    body.append(field, new Blob([new Uint8Array(bytes)], { type: mime }), 'untrusted-filename.txt');
    return body;
  }
  async function product() {
    const name = `${prefix}-${randomUUID()}`;
    const res = await request('/products', 'POST', JSON.stringify({ name, sku: name, price: 15, categoryId, status: 'ACTIVE', imageUrl: 'https://attacker.invalid', imagePublicId: 'attacker' }), adminToken, true);
    assert.equal(res.status, 201, await res.clone().text());
    const row = (await res.json()).product;
    productIds.push(row.id);
    assert.equal(row.imageUrl, null);
    assert.equal('imagePublicId' in row, false);
    return row.id as string;
  }
  async function upload(id: string) {
    const res = await request(`/products/${id}/image`, 'POST', form());
    assert.equal(res.status, 200, await res.clone().text());
    return prisma.product.findUniqueOrThrow({ where: { id } });
  }
  t.beforeEach(async () => { adminToken = await token('Admin'); failUpload = failDelete = missingAsset = false; beforeUploadCallback = undefined; });
  try {
    const category = await prisma.category.create({ data: { name: prefix, slug: prefix } });
    categoryId = category.id;
    staffToken = await token('Staff');
    await t.test('missing configuration is 503; non-image JSON CRUD remains available', async () => {
      const id = await product();
      const res = await request(`/products/${id}/image`, 'POST', form());
      assert.equal(res.status, 503);
      assert.match(await res.text(), /not configured/);
      assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 204);
      process.env.CLOUDINARY_CLOUD_NAME = 'qa'; process.env.CLOUDINARY_API_KEY = 'qa'; process.env.CLOUDINARY_API_SECRET = 'mock-only';
    });
    for (const [mime, bytes] of [['image/jpeg', jpeg], ['image/png', png], ['image/webp', webp]] as const) {
      await t.test(`valid ${mime}: buffer, DB metadata, public response, audit`, async () => {
        const id = await product();
        const res = await request(`/products/${id}/image`, 'POST', form(bytes, mime));
        assert.equal(res.status, 200);
        const stored = await prisma.product.findUniqueOrThrow({ where: { id } });
        assert.deepEqual(await res.json(), { imageUrl: stored.imageUrl });
        assert.equal(stored.imagePublicId, uploads.at(-1)!.publicId);
        assert.deepEqual(uploads.at(-1)!.bytes, bytes);
        assert.equal(uploads.at(-1)!.options.folder, 'king-of-clouds/products');
        const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: id, action: 'UPDATE' } });
        assert.deepEqual(audit.metadata, { operation: 'PRODUCT_IMAGE_UPLOADED' });
      });
    }
    await t.test('invalid inputs, oversize, duplicate field, metadata fields, missing product', async () => {
      const id = await product();
      for (const body of [new FormData(), JSON.stringify({ imageUrl: 'https://attacker.invalid' })]) assert.equal((await request(`/products/${id}/image`, 'POST', body)).status, 400);
      for (const mime of ['text/plain', 'image/svg+xml', 'text/html', 'application/pdf', 'image/gif', 'application/octet-stream']) assert.equal((await request(`/products/${id}/image`, 'POST', form(png, mime))).status, 415);
      assert.equal((await request(`/products/${id}/image`, 'POST', form(Buffer.from('not an image'), 'image/png'))).status, 415);
      assert.equal((await request(`/products/${id}/image`, 'POST', form(Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 413);
      assert.equal((await request(`/products/${id}/image`, 'POST', form(png, 'image/png', 'other'))).status, 400);
      const duplicate = form(); duplicate.append('image', new Blob([png], { type: 'image/png' }), 'two.png');
      assert.equal((await request(`/products/${id}/image`, 'POST', duplicate)).status, 400);
      const metadata = form(); metadata.append('imageUrl', 'https://attacker.invalid');
      assert.equal((await request(`/products/${id}/image`, 'POST', metadata)).status, 400);
      assert.equal((await request('/products/missing/image', 'POST', form())).status, 404);
      assert.equal((await request('/products/missing/image', 'DELETE')).status, 404);
    });
    await t.test('JWT/RBAC: Staff reads only; unauthenticated and Staff mutations denied', async () => {
      const id = await product();
      for (const method of ['POST', 'DELETE']) {
        assert.equal((await request(`/products/${id}/image`, method, method === 'POST' ? form() : undefined, '')).status, 401);
        assert.equal((await request(`/products/${id}/image`, method, method === 'POST' ? form() : undefined, staffToken)).status, 403);
      }
      const res = await request('/products', 'GET', undefined, staffToken);
      assert.equal(res.status, 200);
      for (const row of (await res.json()).products) { assert.ok('imageUrl' in row); assert.equal('imagePublicId' in row, false); }
    });
    await t.test('replacement order and old asset cleanup', async () => {
      const id = await product(), old = await upload(id), replacement = await upload(id);
      assert.notEqual(old.imagePublicId, replacement.imagePublicId);
      assert.ok(deletes.includes(old.imagePublicId!));
      assert.equal(referencesAtDeletion.get(old.imagePublicId!), 0);
      assert.equal(deletes.includes(replacement.imagePublicId!), false);
    });
    await t.test('provider upload failure preserves old image and uses safe errors', async () => {
      const id = await product(), old = await upload(id);
      failUpload = true;
      const res = await request(`/products/${id}/image`, 'POST', form());
      assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /provider-secret/);
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imagePublicId, old.imagePublicId);
      assert.equal(deletes.includes(old.imagePublicId!), false);
    });
    await t.test('DB failure compensates new upload; old metadata and asset remain', async () => {
      const id = await product(), old = await upload(id);
      const original = prisma.$transaction;
      prisma.$transaction = async () => { throw new Error('test DB failure'); };
      try { assert.equal((await request(`/products/${id}/image`, 'POST', form())).status, 500); } finally { prisma.$transaction = original; }
      assert.ok(deletes.includes(uploads.at(-1)!.publicId));
      assert.equal(deletes.includes(old.imagePublicId!), false);
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imagePublicId, old.imagePublicId);
    });
    await t.test('old cleanup failure succeeds without reverting new authoritative metadata', async () => {
      const id = await product(); await upload(id); failDelete = true;
      const replacement = await upload(id);
      assert.equal(replacement.imagePublicId, uploads.at(-1)!.publicId);
      assert.ok(warnings.some(message => message.includes(id)));
      assert.ok(warnings.every(message => !message.includes('provider-secret')));
    });
    await t.test('audit failure rolls back metadata and compensates uploaded asset', async () => {
      const id = await product(), old = await upload(id);
      const original = prisma.$transaction;
      prisma.$transaction = ((callback: (tx: unknown) => Promise<unknown>) => original.call(prisma, async tx => {
        tx.auditEvent.create = () => { throw new Error('injected audit failure'); };
        return callback(tx);
      })) as typeof original;
      try { assert.equal((await request(`/products/${id}/image`, 'POST', form())).status, 500); } finally { prisma.$transaction = original; }
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imagePublicId, old.imagePublicId);
      assert.ok(deletes.includes(uploads.at(-1)!.publicId));
    });
    await t.test('concurrent replacement does not overwrite newer metadata', async () => {
      const id = await product(); await upload(id);
      beforeUploadCallback = async () => { await prisma.product.update({ where: { id }, data: { imageUrl: 'https://res.cloudinary.com/qa/newer.png', imagePublicId: `${prefix}-newer` } }); };
      assert.equal((await request(`/products/${id}/image`, 'POST', form())).status, 409);
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imagePublicId, `${prefix}-newer`);
      assert.ok(deletes.includes(uploads.at(-1)!.publicId));
    });
    await t.test('remove, already missing remote asset, and repeated remove are safe', async () => {
      const id = await product(), old = await upload(id); missingAsset = true;
      assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 204);
      assert.ok(deletes.includes(old.imagePublicId!));
      assert.equal(referencesAtDeletion.get(old.imagePublicId!), 1);
      const row = await prisma.product.findUniqueOrThrow({ where: { id } });
      assert.equal(row.imageUrl, null); assert.equal(row.imagePublicId, null);
      assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 204);
    });
    await t.test('failed remote deletion keeps metadata for retry', async () => {
      const id = await product(), old = await upload(id); failDelete = true;
      assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 502);
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imagePublicId, old.imagePublicId);
    });
    await t.test('transient DB failure after remote removal retries metadata reconciliation', async () => {
      const id = await product(); await upload(id);
      const original = prisma.$transaction; let attempts = 0;
      prisma.$transaction = ((...args: Parameters<typeof original>) => { if (++attempts === 1) throw new Error('transient'); return original.apply(prisma, args); }) as typeof original;
      try { assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 204); } finally { prisma.$transaction = original; }
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id } })).imageUrl, null);
    });
    await t.test('JSON detail/edit, referenced delete protection, successful delete cleanup', async () => {
      const id = await product(), old = await upload(id);
      const detail = await request(`/products/${id}`); assert.equal(detail.status, 200);
      assert.equal((await detail.json()).product.imageUrl, old.imageUrl);
      const edit = await request(`/products/${id}`, 'PUT', JSON.stringify({ price: 20, imageUrl: 'https://attacker.invalid' }), adminToken, true);
      assert.equal(edit.status, 200); assert.equal((await edit.json()).product.imageUrl, old.imageUrl);
      // StockLevel is an existing restricted reference created by normal Product creation.
      assert.equal((await request(`/products/${id}`, 'DELETE')).status, 409);
      assert.equal(deletes.includes(old.imagePublicId!), false);
      await prisma.stockLevel.delete({ where: { productId: id } });
      assert.equal((await request(`/products/${id}`, 'DELETE')).status, 204);
      assert.ok(deletes.includes(old.imagePublicId!));
      assert.equal(referencesAtDeletion.get(old.imagePublicId!), 0);
    });
    await t.test('product deletion succeeds even when remote cleanup fails; normal null-image delete', async () => {
      for (const withImage of [true, false]) {
        const id = await product(); if (withImage) await upload(id);
        await prisma.stockLevel.delete({ where: { productId: id } }); failDelete = true;
        assert.equal((await request(`/products/${id}`, 'DELETE')).status, 204);
        assert.equal(await prisma.product.findUnique({ where: { id } }), null);
      }
    });
    await t.test('POS reads, sales, forecast and report query regression', async () => {
      const id = await product(); await upload(id);
      for (const path of ['/products', '/inventory', '/sales']) assert.equal((await request(path, 'GET', undefined, staffToken)).status, 200);
      assert.equal((await request(`/forecasts/products/${id}/insights`)).status, 200);
      const reports = await request('/reports/summary?from=2026-09-01&to=2026-09-09');
      assert.equal(reports.status, 200, await reports.clone().text());
    });
    await t.test('mutation limiter rejects request 21 before parsing/provider work', async () => {
      const id = await product();
      for (let i = 0; i < 20; i++) assert.equal((await request(`/products/${id}/image`, 'DELETE')).status, 204);
      const res = await request(`/products/${id}/image`, 'POST', form());
      assert.equal(res.status, 429); assert.ok(Number(res.headers.get('retry-after')) > 0);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    uploadMock.mock.restore(); destroyMock.mock.restore(); warnMock.mock.restore();
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.stockLevel.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
  }
});
