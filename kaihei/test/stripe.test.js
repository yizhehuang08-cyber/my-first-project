'use strict';
// Stripe 流程测试：用一个假的 Stripe 记录调用，不会连接真正的 Stripe。
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { FileStore } = require('../src/store');
const { signWebhook, verifyWebhook, encode } = require('../src/stripe');

const WHSEC = 'whsec_test';
let server, base, store;
let clock = Date.parse('2026-11-24T12:00:00Z');

// ---------- 假的 Stripe ----------
const calls = [];
const fake = {
  failTransfers: 0,
  failCheckout: false,
  account: { payouts_enabled: false, capabilities: { transfers: 'inactive' }, details_submitted: false },
  n: 0
};
const log = (name, args) => { calls.push({ name, args }); };
const stripeClient = {
  async createCheckout(p) {
    log('createCheckout', p);
    if (fake.failCheckout) throw new Error('boom');
    const id = 'cs_' + (++fake.n);
    return { id, url: 'https://checkout.stripe.test/' + id };
  },
  async expireCheckout(id) { log('expireCheckout', id); return {}; },
  async getPaymentIntent(id) { log('getPaymentIntent', id); return { id, latest_charge: 'ch_for_' + id }; },
  async createAccount(p) { log('createAccount', p); return { id: 'acct_' + p.metadata.username }; },
  async getAccount(id) { log('getAccount', id); return { id, ...fake.account }; },
  async createAccountLink(p) { log('createAccountLink', p); return { url: 'https://connect.stripe.test/' + p.account }; },
  async createLoginLink(id) { log('createLoginLink', id); return { url: 'https://dashboard.stripe.test/' + id }; },
  async createTransfer(p, key) {
    log('createTransfer', { ...p, key });
    if (fake.failTransfers > 0) { fake.failTransfers--; throw new Error('insufficient funds'); }
    return { id: 'tr_' + p.metadata.order_id };
  },
  async createRefund(p, key) { log('createRefund', { ...p, key }); return { id: 're_' + p.metadata.order_id }; }
};
const lastCall = (name) => [...calls].reverse().find((c) => c.name === name);
const countCalls = (name) => calls.filter((c) => c.name === name).length;

before(async () => {
  store = new FileStore(null, null);
  const app = createApp({ store, admins: ['boss'], now: () => clock, stripe: { webhookSecret: WHSEC + ', whsec_connect' }, stripeClient, publicUrl: 'https://kaihei.test' });
  server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

async function webhook(type, object, { secret = WHSEC } = {}) {
  const raw = JSON.stringify({ id: 'evt_' + Math.random(), type, data: { object } });
  const res = await fetch(base + '/api/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signWebhook(raw, secret, clock) },
    body: raw
  });
  return res.status;
}

const paid = (orderId, pi = 'pi_' + orderId) => webhook('checkout.session.completed', {
  id: 'cs_x', payment_status: 'paid', payment_intent: pi, metadata: { order_id: String(orderId) }
});

async function signup(username) {
  const r = await call('POST', '/api/auth/signup', { body: { username, email: username + '@example.com', password: 'password123', birthDate: '2000-01-01', agree: true } });
  return r.data.token;
}

const PROFILE = {
  displayName: 'Deer', games: { valorant: { ranks: ['Gold', 'Immortal'], price: 1500 } },
  languages: ['zh'], styles: ['chill'], region: 'na-west', discord: 'deer.gg'
};

let boss, deer, amy;

test('webhook signature: good passes, bad or old is rejected', async () => {
  const raw = '{"type":"x"}';
  assert.deepStrictEqual(verifyWebhook(raw, signWebhook(raw, WHSEC, clock), WHSEC, clock), { type: 'x' });
  assert.strictEqual(verifyWebhook(raw, signWebhook(raw, 'whsec_other', clock), WHSEC, clock), null);
  assert.strictEqual(verifyWebhook(raw + ' ', signWebhook(raw, WHSEC, clock), WHSEC, clock), null);
  assert.strictEqual(verifyWebhook(raw, signWebhook(raw, WHSEC, clock - 10 * 60 * 1000), WHSEC, clock), null, '超过 5 分钟的旧签名');
  assert.strictEqual(await webhook('account.updated', { id: 'acct_x' }, { secret: 'whsec_wrong' }), 400);
  assert.strictEqual(await webhook('account.updated', { id: 'acct_x' }, { secret: 'whsec_connect' }), 200, '第二个密钥也认');
  assert.strictEqual(encode({ a: { b: [{ c: 1 }] }, d: 'x y' }), 'a%5Bb%5D%5B0%5D%5Bc%5D=1&d=x%20y');
});

test('companion is listed only after admin approval AND Stripe payouts are ready', async () => {
  boss = await signup('boss');
  deer = await signup('deer');
  amy = await signup('amy');
  assert.strictEqual((await call('GET', '/api/config')).data.payment, 'stripe');

  await call('PUT', '/api/companion', { token: deer, body: PROFILE });
  await call('POST', '/api/admin/companions/deer', { token: boss, body: { action: 'approve' } });
  let r = await call('GET', '/api/companions');
  assert.deepStrictEqual(r.data, [], '没设置收款账户前不出现在首页');
  r = await call('GET', '/api/me', { token: deer });
  assert.deepStrictEqual(r.data.payouts, { enabled: true, account: false, ready: false, detailsSubmitted: false });
  assert.strictEqual(r.data.companion.listed, false);

  r = await call('POST', '/api/companion/payouts/onboard', { token: deer });
  assert.strictEqual(r.data.url, 'https://connect.stripe.test/acct_deer');
  const acct = lastCall('createAccount').args;
  assert.strictEqual(acct.type, 'express');
  assert.strictEqual(acct.email, 'deer@example.com');
  assert.deepStrictEqual(acct.capabilities, { transfers: { requested: true } });
  assert.strictEqual(lastCall('createAccountLink').args.return_url, 'https://kaihei.test/go/me');
  // 再点一次不会重复建账户
  await call('POST', '/api/companion/payouts/onboard', { token: deer });
  assert.strictEqual(countCalls('createAccount'), 1);

  // 陪玩师填完资料回来：刷新状态
  fake.account = { payouts_enabled: true, capabilities: { transfers: 'active' }, details_submitted: true };
  r = await call('GET', '/api/companion/payouts', { token: deer });
  assert.strictEqual(r.data.ready, true);
  r = await call('GET', '/api/companions');
  assert.deepStrictEqual(r.data.map((c) => c.name), ['deer']);

  // Stripe 通知账户被限制 → 下架
  assert.strictEqual(await webhook('account.updated', { id: 'acct_deer', payouts_enabled: false, capabilities: { transfers: 'inactive' } }), 200);
  assert.deepStrictEqual((await call('GET', '/api/companions')).data, []);
  await webhook('account.updated', { id: 'acct_deer', payouts_enabled: true, capabilities: { transfers: 'active' } });
  assert.strictEqual((await call('GET', '/api/companions')).data.length, 1);

  r = await call('POST', '/api/companion/payouts/dashboard', { token: deer });
  assert.strictEqual(r.data.url, 'https://dashboard.stripe.test/acct_deer');
});

let orderId;

test('order waits for Stripe payment, then flows to a transfer on completion', async () => {
  let r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 2 } });
  assert.strictEqual(r.status, 201);
  orderId = r.data.id;
  assert.strictEqual(r.data.status, 'pending_payment');
  assert.match(r.data.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);
  const co = lastCall('createCheckout').args;
  assert.strictEqual(co.line_items[0].price_data.unit_amount, 3000);
  assert.strictEqual(co.line_items[0].price_data.currency, 'usd');
  assert.strictEqual(co.success_url, `https://kaihei.test/go/o/${orderId}`);
  assert.strictEqual(co.metadata.order_id, String(orderId));
  assert.strictEqual(co.customer_email, 'amy@example.com');

  // 没付款前陪玩师看不到，也不能接
  r = await call('GET', '/api/orders?role=companion', { token: deer });
  assert.deepStrictEqual(r.data, []);
  r = await call('POST', `/api/orders/${orderId}/accept`, { token: deer });
  assert.strictEqual(r.status, 404);

  // 继续付款：付款页没过期就复用
  r = await call('POST', `/api/orders/${orderId}/checkout`, { token: amy });
  assert.strictEqual(r.data.url, co && 'https://checkout.stripe.test/cs_1');
  assert.strictEqual(countCalls('createCheckout'), 1);

  // 付款成功的通知
  assert.strictEqual(await paid(orderId), 200);
  r = await call('GET', `/api/orders/${orderId}`, { token: amy });
  assert.strictEqual(r.data.status, 'paid');
  assert.strictEqual(r.data.payment.status, 'held');
  // Stripe 有时会重复通知：不会出错，也不会重复处理
  assert.strictEqual(await paid(orderId), 200);
  assert.strictEqual(countCalls('getPaymentIntent'), 1);

  await call('POST', `/api/orders/${orderId}/accept`, { token: deer });
  await call('POST', `/api/orders/${orderId}/deliver`, { token: deer });
  r = await call('POST', `/api/orders/${orderId}/confirm`, { token: amy });
  assert.strictEqual(r.data.status, 'completed');
  assert.strictEqual(r.data.payment.status, 'released');
  const tr = lastCall('createTransfer').args;
  assert.deepStrictEqual(
    { amount: tr.amount, destination: tr.destination, source_transaction: tr.source_transaction, key: tr.key },
    { amount: 2550, destination: 'acct_deer', source_transaction: 'ch_for_pi_' + orderId, key: 'kaihei-release-' + orderId }
  );
  r = await call('GET', '/api/me', { token: deer });
  assert.deepStrictEqual(r.data.earnings, { settled: 2550, pending: 0 });
});

test('cancel after paying refunds through Stripe', async () => {
  let r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const id = r.data.id;
  await paid(id);
  r = await call('POST', `/api/orders/${id}/cancel`, { token: amy });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(r.data.payment.status, 'refunded');
  assert.deepStrictEqual({ pi: lastCall('createRefund').args.payment_intent, key: lastCall('createRefund').args.key }, { pi: 'pi_' + id, key: 'kaihei-refund-' + id });
});

test('failed transfer is shown to admin and retried later', async () => {
  let r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const id = r.data.id;
  await paid(id);
  await call('POST', `/api/orders/${id}/accept`, { token: deer });
  fake.failTransfers = 1;
  r = await call('POST', `/api/orders/${id}/confirm`, { token: amy });
  assert.strictEqual(r.data.status, 'completed');
  assert.strictEqual(r.data.payment.status, 'release_pending');
  r = await call('GET', '/api/admin/overview', { token: boss });
  assert.strictEqual(r.data.paymentIssues[0].id, id);
  assert.strictEqual(r.data.paymentIssues[0].error, 'insufficient funds');

  const before = countCalls('createTransfer');
  await call('GET', '/api/companions'); // 还没到重试时间
  assert.strictEqual(countCalls('createTransfer'), before);
  clock += 3 * 60 * 1000;
  await call('GET', '/api/companions');
  assert.strictEqual(countCalls('createTransfer'), before + 1);
  assert.strictEqual(lastCall('createTransfer').args.key, 'kaihei-release-' + id, '重试用同一个 Idempotency-Key');
  r = await call('GET', `/api/orders/${id}`, { token: amy });
  assert.strictEqual(r.data.payment.status, 'released');
  r = await call('GET', '/api/admin/overview', { token: boss });
  assert.deepStrictEqual(r.data.paymentIssues, []);
});

test('unpaid orders: cancel, expiry, timeout, late payment refund', async () => {
  // 买家付款前取消 → 作废，关闭付款页，不出现在列表
  let r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const a = r.data.id;
  r = await call('POST', `/api/orders/${a}/cancel`, { token: amy });
  assert.strictEqual(r.data.status, 'unpaid');
  assert.strictEqual(lastCall('expireCheckout').args, 'cs_' + fake.n);
  r = await call('GET', '/api/orders', { token: amy });
  assert.ok(!r.data.some((o) => o.id === a));
  // 取消后钱还是到了 → 自动退款
  await paid(a);
  assert.strictEqual(lastCall('createRefund').args.payment_intent, 'pi_' + a);
  r = await call('GET', `/api/orders/${a}`, { token: amy });
  assert.strictEqual(r.data.status, 'unpaid');
  assert.strictEqual(r.data.payment.status, 'refunded');

  // 付款页过期的通知
  r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const b = r.data.id;
  await webhook('checkout.session.expired', { id: 'cs_' + fake.n, metadata: { order_id: String(b) } });
  assert.strictEqual((await call('GET', `/api/orders/${b}`, { token: amy })).data.status, 'unpaid');

  // 没收到通知也会在 1 小时后作废
  r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const c = r.data.id;
  clock += 61 * 60 * 1000;
  assert.strictEqual((await call('GET', `/api/orders/${c}`, { token: amy })).data.status, 'unpaid');

  // Stripe 出错 → 不留下半个订单
  fake.failCheckout = true;
  const count = store.data.orders.length;
  r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  assert.strictEqual(r.status, 502);
  assert.strictEqual(r.data.code, 'stripe_error');
  assert.strictEqual(store.data.orders.length, count);
  fake.failCheckout = false;
});

test('accept window counts from payment time, not order time', async () => {
  let r = await call('POST', '/api/orders', { token: amy, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const id = r.data.id;
  clock += 20 * 60 * 1000; // 下单 20 分钟后才付款
  await paid(id);
  clock += 24 * 3600 * 1000 - 10 * 60 * 1000; // 付款后 23 小时 50 分
  r = await call('GET', `/api/orders/${id}`, { token: deer });
  assert.strictEqual(r.data.status, 'paid');
  clock += 20 * 60 * 1000;
  r = await call('GET', `/api/orders/${id}`, { token: deer });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(lastCall('createRefund').args.payment_intent, 'pi_' + id);
});
