/**
 * End-to-end API test: starts the real server on a random port with a
 * temporary database and exercises the main flows.
 *
 * Run: npm test -w server
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 40000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'helio-test-'));

let proc: ChildProcess;
let hookServer: Server;
const hookBodies: Record<string, unknown>[] = [];
let hookPort = 0;

async function api<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: T }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as T };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  hookServer = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try { hookBodies.push(JSON.parse(b)); } catch { /* ignore */ }
      res.end('ok');
    });
  });
  await new Promise<void>((r) => hookServer.listen(0, '127.0.0.1', () => r()));
  hookPort = (hookServer.address() as { port: number }).port;

  proc = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DB_PATH: join(dataDir, 'test.db'),
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      NOTIFICATION_ALLOW_PRIVATE: 'true',
      CLIENT_DIST: join(dataDir, 'no-client'),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/api/v1/live`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('server did not start');
});

after(async () => {
  proc?.kill('SIGTERM');
  await new Promise((r) => proc?.once('exit', r));
  hookServer?.close();
  rmSync(dataDir, { recursive: true, force: true });
});

let adminToken = '';

test('first-run setup creates admin, then is locked', async () => {
  assert.equal((await api('GET', '/api/v1/auth/setup')).json.data.needsSetup, true);

  const setup = await api('POST', '/api/v1/auth/setup', { email: 'Admin@Example.com', password: 'correct-horse' });
  assert.equal(setup.status, 201);
  assert.equal(setup.json.data.user.role, 'admin');
  assert.equal(setup.json.data.user.email, 'admin@example.com');
  adminToken = setup.json.data.accessToken;

  const again = await api('POST', '/api/v1/auth/register', { email: 'evil@example.com', password: 'correct-horse' });
  assert.equal(again.status, 403);
});

test('login + refresh token cannot be used as access token', async () => {
  const bad = await api('POST', '/api/v1/auth/login', { email: 'admin@example.com', password: 'wrong' });
  assert.equal(bad.status, 401);

  const ok = await api('POST', '/api/v1/auth/login', { email: 'admin@example.com', password: 'correct-horse' });
  assert.equal(ok.status, 200);
  const misuse = await api('GET', '/api/v1/monitors', undefined, ok.json.data.refreshToken);
  assert.equal(misuse.status, 401);
});

test('monitor validation', async () => {
  const r = await api('POST', '/api/v1/monitors', { name: 'x', type: 'http', config: { url: 'ftp://nope' } }, adminToken);
  assert.equal(r.status, 400);
  const r2 = await api('POST', '/api/v1/monitors', { name: 'x', type: 'tcp', config: { host: 'localhost' } }, adminToken);
  assert.equal(r2.status, 400);
});

test('status transitions trigger notifications; viewers are read-only', async () => {
  const notif = await api('POST', '/api/v1/notifications', {
    name: 'hook', provider: 'webhook', config: { url: `http://127.0.0.1:${hookPort}/` },
  }, adminToken);
  assert.equal(notif.status, 201);

  const mon = await api('POST', '/api/v1/monitors', {
    name: 'closed port', type: 'tcp', config: { host: '127.0.0.1', port: 1, timeoutMs: 1000 },
    intervalSeconds: 20, notificationIds: [notif.json.data.id],
  }, adminToken);
  assert.equal(mon.status, 201);
  assert.deepEqual(mon.json.data.notificationIds, [notif.json.data.id]);

  for (let i = 0; i < 80 && hookBodies.length === 0; i++) await sleep(100);
  const got = await api('GET', `/api/v1/monitors/${mon.json.data.id}`, undefined, adminToken);
  assert.equal(got.json.data.status, 'DOWN');
  assert.equal(hookBodies[0]?.['status'], 'DOWN');
  assert.equal(hookBodies[0]?.['monitorName'], 'closed port');

  // viewer
  await api('POST', '/api/v1/users', { email: 'viewer@example.com', password: 'viewerpass', role: 'user' }, adminToken);
  const viewer = (await api('POST', '/api/v1/auth/login', { email: 'viewer@example.com', password: 'viewerpass' })).json.data.accessToken;
  assert.equal((await api('GET', '/api/v1/monitors', undefined, viewer)).status, 200);
  assert.equal((await api('DELETE', `/api/v1/monitors/${mon.json.data.id}`, undefined, viewer)).status, 403);
  assert.equal((await api('GET', '/api/v1/users', undefined, viewer)).status, 403);
});

test('push monitor: token generated, push marks UP, unknown token 404', async () => {
  const mon = await api('POST', '/api/v1/monitors', { name: 'cron', type: 'push', config: {}, intervalSeconds: 60 }, adminToken);
  const token = mon.json.data.config.data.token as string;
  assert.match(token, /^[A-Za-z0-9_-]{16,}$/);

  const hit = await fetch(`${base}/api/push/${token}?msg=hello&ping=5`);
  assert.equal(hit.status, 200);
  const after = await api('GET', `/api/v1/monitors/${mon.json.data.id}`, undefined, adminToken);
  assert.equal(after.json.data.status, 'UP');

  const down = await fetch(`${base}/api/push/${token}?status=down&msg=backup%20failed`);
  assert.equal(down.status, 200);
  const hb = await api('GET', `/api/v1/monitors/${mon.json.data.id}/heartbeats?limit=1`, undefined, adminToken);
  assert.equal(hb.json.data[0].status, 'DOWN');
  assert.equal(hb.json.data[0].message, 'backup failed');

  assert.equal((await fetch(`${base}/api/push/does-not-exist`)).status, 404);
});

test('public status page exposes no monitor config', async () => {
  const monitors = (await api('GET', '/api/v1/monitors', undefined, adminToken)).json.data as { id: string }[];
  const page = await api('POST', '/api/v1/status-pages', { title: 'Public', slug: 'public', monitorIds: monitors.map((m) => m.id) }, adminToken);
  assert.equal(page.status, 201);
  const pub = await api('GET', '/api/v1/status-pages/public/public');
  assert.equal(pub.status, 200);
  assert.equal(pub.json.data.monitors.length, monitors.length);
  assert.equal(JSON.stringify(pub.json).includes('127.0.0.1'), false);
  assert.ok(Array.isArray(pub.json.data.monitors[0].beats));
});
