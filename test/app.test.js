const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server, base, token;
test.before(async () => {
  process.env.ADMIN_EMAIL = '';
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (method, path, body, tok) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
const valid = { name: 'Veera Chari', email: 'veera@example.com', password: 'secret123', phone: '9876543210' };

test('GET /health returns UP', async () => {
  const res = await call('GET', '/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, 'UP');
});

test('registers a customer and never returns the password', async () => {
  const res = await call('POST', '/api/customers/register', valid);
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.email, 'veera@example.com');
  assert.ok(body.id);
  assert.strictEqual(body.password, undefined);
  assert.strictEqual(body.passwordHash, undefined);
});

test('rejects a duplicate email with 409', async () => {
  const res = await call('POST', '/api/customers/register', { ...valid, name: 'Someone Else' });
  assert.strictEqual(res.status, 409);
});

test('rejects invalid registration data with 400', async () => {
  const res = await call('POST', '/api/customers/register', { name: 'A', email: 'bad', password: 'short' });
  assert.strictEqual(res.status, 400);
  assert.ok((await res.json()).errors.length >= 3);
});

test('login fails with a wrong password (401) and works with the right one', async () => {
  const bad = await call('POST', '/api/auth/login', { email: valid.email, password: 'wrongpass1' });
  assert.strictEqual(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { email: valid.email, password: valid.password });
  assert.strictEqual(ok.status, 200);
  token = (await ok.json()).token;
  assert.ok(token);
});

test('customer details require login', async () => {
  assert.strictEqual((await call('GET', '/api/customers/1')).status, 401);
  const res = await call('GET', '/api/customers/1', null, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).name, 'Veera Chari');
  assert.strictEqual((await call('GET', '/api/me', null, token)).status, 200);
});

test('a customer cannot see other customers or the admin list', async () => {
  await call('POST', '/api/customers/register', { name: 'Other Person', email: 'other@example.com', password: 'password99' });
  assert.strictEqual((await call('GET', '/api/customers/2', null, token)).status, 403);
  assert.strictEqual((await call('GET', '/api/customers', null, token)).status, 403);
});

test('updates own details', async () => {
  const res = await call('PUT', '/api/customers/1', { address: 'Vijayawada, Andhra Pradesh' }, token);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).address, 'Vijayawada, Andhra Pradesh');
});

test('logout invalidates the session', async () => {
  assert.strictEqual((await call('POST', '/api/auth/logout', null, token)).status, 204);
  assert.strictEqual((await call('GET', '/api/me', null, token)).status, 401);
});
