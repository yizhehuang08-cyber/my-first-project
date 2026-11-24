'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { FileStore } = require('../src/store');
const { ACCEPT_WINDOW_MS, CONFIRM_WINDOW_MS } = require('../src/core');

let server, base, store;
let clock = Date.parse('2026-11-24T12:00:00Z');

before(async () => {
  store = new FileStore(null, null); // 只在内存里
  const app = createApp({ store, admins: ['boss'], now: () => clock });
  server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function call(method, path, { token, body, lang } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(lang ? { 'X-Lang': lang } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

const ADULT = '2000-05-01';
async function signup(username, extra = {}) {
  const r = await call('POST', '/api/auth/signup', {
    body: { username, email: username + '@example.com', password: 'password123', birthDate: ADULT, agree: true, ...extra }
  });
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  return r.data.token;
}

const PROFILE = {
  displayName: '小鹿',
  headline: 'Immortal 陪你上分',
  bio: '晚上 8 点后常在线',
  games: { valorant: { rank: 'Immortal', price: 1500 }, cs2: { rank: 'FACEIT 8–10', price: 1200 } },
  languages: ['zh', 'en'],
  styles: ['skilled', 'chill'],
  region: 'na-west',
  discord: 'xiaolu.gg'
};

let boss, deer, alice, bob;

test('signup checks age, rules and duplicates; errors come in Chinese or English', async () => {
  boss = await signup('boss');
  deer = await signup('deer');
  alice = await signup('alice');
  bob = await signup('bob');

  // 2026-11-24 时，2008-11-25 出生的人还差一天满 18 岁
  let r = await call('POST', '/api/auth/signup', { body: { username: 'kid', email: 'kid@example.com', password: 'password123', birthDate: '2008-11-25', agree: true } });
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.data.code, 'too_young');
  r = await call('POST', '/api/auth/signup', { body: { username: 'kid2', email: 'kid2@example.com', password: 'password123', birthDate: '2008-11-24', agree: true } });
  assert.strictEqual(r.status, 201, '刚好满 18 岁可以注册');

  r = await call('POST', '/api/auth/signup', { body: { username: 'x1', email: 'x1@example.com', password: 'password123', birthDate: '2001-02-30', agree: true } });
  assert.strictEqual(r.data.code, 'bad_birth_date');
  r = await call('POST', '/api/auth/signup', { body: { username: 'x2', email: 'x2@example.com', password: 'password123', birthDate: ADULT } });
  assert.strictEqual(r.data.code, 'must_agree');
  r = await call('POST', '/api/auth/signup', { lang: 'zh', body: { username: 'deer', email: 'new@example.com', password: 'password123', birthDate: ADULT, agree: true } });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.data.error, '这个用户名已经被用了');
  r = await call('POST', '/api/auth/signup', { lang: 'en', body: { username: 'new1', email: 'DEER@example.com', password: 'password123', birthDate: ADULT, agree: true } });
  assert.strictEqual(r.data.error, 'That email already has an account');
});

test('login with username or email; password is not stored in plain text', async () => {
  let r = await call('POST', '/api/auth/login', { body: { id: 'ALICE@example.com', password: 'password123' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.account.username, 'alice');
  r = await call('POST', '/api/auth/login', { body: { id: 'alice', password: 'nope' } });
  assert.strictEqual(r.status, 401);
  assert.ok(!JSON.stringify(store.data).includes('password123'));
});

test('companion applies, is hidden until approved by an admin', async () => {
  let r = await call('PUT', '/api/companion', { token: deer, body: { ...PROFILE, games: { valorant: { rank: 'Immortal', price: 100 } } } });
  assert.strictEqual(r.data.code, 'bad_price');
  r = await call('PUT', '/api/companion', { token: deer, body: { ...PROFILE, discord: '' } });
  assert.strictEqual(r.data.code, 'need_discord');

  r = await call('PUT', '/api/companion', { token: deer, body: PROFILE });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.status, 'pending');
  assert.strictEqual(r.data.fromPrice, 1200);

  r = await call('GET', '/api/companions');
  assert.deepStrictEqual(r.data, [], '没审核的不出现在列表里');
  r = await call('GET', '/api/companions/deer');
  assert.strictEqual(r.status, 404);

  // 普通用户不能进后台
  r = await call('GET', '/api/admin/overview', { token: alice });
  assert.strictEqual(r.status, 403);
  r = await call('GET', '/api/admin/overview', { token: boss });
  assert.strictEqual(r.data.pending.length, 1);
  assert.strictEqual(r.data.pending[0].discord, 'xiaolu.gg');

  r = await call('POST', '/api/admin/companions/deer', { token: boss, body: { action: 'approve' } });
  assert.strictEqual(r.data.status, 'approved');

  r = await call('GET', '/api/companions');
  assert.strictEqual(r.data.length, 1);
  assert.strictEqual(r.data[0].bio, undefined, '列表里不带长介绍');
  assert.strictEqual(r.data[0].discord, undefined, '公开资料里不显示 Discord');
});

test('browse filters: game, language, price, online', async () => {
  // 再加一位只陪 CS2、只说英语的陪玩师
  const ken = await signup('ken');
  await call('PUT', '/api/companion', { token: ken, body: { ...PROFILE, displayName: 'Ken', games: { cs2: { rank: 'Premier 20000–24999', price: 800 } }, languages: ['en'], styles: ['coach'], discord: 'kenplays' } });
  await call('POST', '/api/admin/companions/ken', { token: boss, body: { action: 'approve' } });

  const names = async (q) => (await call('GET', '/api/companions?' + q)).data.map((c) => c.name);
  assert.deepStrictEqual(await names('game=valorant'), ['deer']);
  assert.deepStrictEqual((await names('game=cs2&sort=price_asc')), ['ken', 'deer']);
  assert.deepStrictEqual(await names('lang=zh'), ['deer']);
  assert.deepStrictEqual(await names('style=coach'), ['ken']);
  assert.deepStrictEqual(await names('game=cs2&max=1000'), ['ken']);
  assert.deepStrictEqual(await names('online=1'), []);

  let r = await call('POST', '/api/companion/online', { token: ken, body: { online: true } });
  assert.strictEqual(r.data.online, true);
  assert.deepStrictEqual(await names('online=1'), ['ken']);
  assert.deepStrictEqual(await names(''), ['ken', 'deer'], '推荐排序：在线的在前');

  // 在线状态 6 小时后自动失效
  clock += 7 * 3600 * 1000;
  assert.deepStrictEqual(await names('online=1'), []);

  r = await call('POST', '/api/companion/online', { token: alice, body: { online: true } });
  assert.strictEqual(r.data.code, 'not_approved');
});

let orderId;

test('full order: pay → accept → chat → deliver → confirm → review', async () => {
  let r = await call('POST', '/api/orders', { token: deer, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  assert.strictEqual(r.data.code, 'order_self');
  r = await call('POST', '/api/orders', { token: alice, body: { companion: 'deer', game: 'valorant', hours: 11 } });
  assert.strictEqual(r.data.code, 'bad_hours');

  r = await call('POST', '/api/orders', { token: alice, body: { companion: 'deer', game: 'valorant', hours: 2, note: '想练 Jett' } });
  assert.strictEqual(r.status, 201);
  orderId = r.data.id;
  assert.strictEqual(r.data.total, 3000);
  assert.strictEqual(r.data.status, 'paid');
  assert.strictEqual(r.data.payment.status, 'held');
  assert.strictEqual(r.data.fee, undefined, '买家看不到平台抽成');
  assert.strictEqual(r.data.discord, null, '接单前不显示 Discord');

  // 陪玩师看到抽成后的收入
  r = await call('GET', `/api/orders/${orderId}`, { token: deer });
  assert.strictEqual(r.data.fee, 450);
  assert.strictEqual(r.data.payout, 2550);
  assert.strictEqual((await call('GET', '/api/me', { token: deer })).data.todo, 1);

  // 别人看不到这个订单
  r = await call('GET', `/api/orders/${orderId}`, { token: bob });
  assert.strictEqual(r.status, 404);
  // 买家不能替陪玩师接单
  r = await call('POST', `/api/orders/${orderId}/accept`, { token: alice });
  assert.strictEqual(r.status, 403);

  r = await call('POST', `/api/orders/${orderId}/accept`, { token: deer });
  assert.strictEqual(r.data.status, 'accepted');
  assert.strictEqual(r.data.discord.companion, 'xiaolu.gg');

  r = await call('POST', `/api/orders/${orderId}/messages`, { token: alice, body: { text: '我加你了' } });
  assert.strictEqual(r.data.messages.filter((m) => m.from).length, 1);
  r = await call('POST', `/api/orders/${orderId}/messages`, { token: deer, body: { text: '收到 👌' } });
  assert.deepStrictEqual(r.data.messages.filter((m) => m.from).map((m) => m.text), ['我加你了', '收到 👌']);

  r = await call('POST', `/api/orders/${orderId}/review`, { token: alice, body: { stars: 5 } });
  assert.strictEqual(r.data.code, 'bad_state', '完成前不能评价');

  r = await call('POST', `/api/orders/${orderId}/deliver`, { token: deer });
  assert.strictEqual(r.data.status, 'delivered');
  assert.ok(r.data.autoConfirmAt);
  let me = (await call('GET', '/api/me', { token: deer })).data;
  assert.deepStrictEqual(me.earnings, { settled: 0, pending: 2550 });

  r = await call('POST', `/api/orders/${orderId}/confirm`, { token: alice });
  assert.strictEqual(r.data.status, 'completed');
  assert.strictEqual(r.data.payment.status, 'released');
  me = (await call('GET', '/api/me', { token: deer })).data;
  assert.deepStrictEqual(me.earnings, { settled: 2550, pending: 0 });

  r = await call('POST', `/api/orders/${orderId}/messages`, { token: alice, body: { text: 'hi' } });
  assert.strictEqual(r.data.code, 'chat_closed');

  r = await call('POST', `/api/orders/${orderId}/review`, { token: alice, body: { stars: 5, text: '超级耐心！' } });
  assert.strictEqual(r.data.review.stars, 5);
  r = await call('POST', `/api/orders/${orderId}/review`, { token: alice, body: { stars: 4 } });
  assert.strictEqual(r.data.code, 'already_reviewed');

  r = await call('GET', '/api/companions/deer');
  assert.strictEqual(r.data.rating, 5);
  assert.strictEqual(r.data.orders, 1);
  assert.strictEqual(r.data.reviews[0].text, '超级耐心！');
});

test('cancel before accept and decline both refund', async () => {
  let r = await call('POST', '/api/orders', { token: bob, body: { companion: 'deer', game: 'cs2', hours: 1 } });
  r = await call('POST', `/api/orders/${r.data.id}/cancel`, { token: bob });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(r.data.payment.status, 'refunded');

  r = await call('POST', '/api/orders', { token: bob, body: { companion: 'deer', game: 'cs2', hours: 1 } });
  r = await call('POST', `/api/orders/${r.data.id}/decline`, { token: deer });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(r.data.history.at(-1).reason, 'declined');
});

test('timeouts: no accept in 24h → refund; delivered 48h → auto complete', async () => {
  const a = (await call('POST', '/api/orders', { token: bob, body: { companion: 'deer', game: 'cs2', hours: 1 } })).data.id;
  const b = (await call('POST', '/api/orders', { token: bob, body: { companion: 'ken', game: 'cs2', hours: 1 } })).data.id;
  await call('POST', `/api/orders/${b}/accept`, { token: (await call('POST', '/api/auth/login', { body: { id: 'ken', password: 'password123' } })).data.token });
  const ken = (await call('POST', '/api/auth/login', { body: { id: 'ken', password: 'password123' } })).data.token;
  await call('POST', `/api/orders/${b}/deliver`, { token: ken });

  clock += ACCEPT_WINDOW_MS + 1000;
  let r = await call('GET', `/api/orders/${a}`, { token: bob });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(r.data.history.at(-1).reason, 'expired');
  r = await call('GET', `/api/orders/${b}`, { token: bob });
  assert.strictEqual(r.data.status, 'delivered');

  clock += CONFIRM_WINDOW_MS;
  r = await call('GET', `/api/orders/${b}`, { token: bob });
  assert.strictEqual(r.data.status, 'completed');
  assert.strictEqual(r.data.history.at(-1).reason, 'auto_confirm');
});

test('dispute → admin decides refund', async () => {
  let r = await call('POST', '/api/orders', { token: bob, body: { companion: 'deer', game: 'valorant', hours: 1 } });
  const id = r.data.id;
  await call('POST', `/api/orders/${id}/accept`, { token: deer });
  r = await call('POST', `/api/orders/${id}/dispute`, { token: bob, body: {} });
  assert.strictEqual(r.data.code, 'need_reason');
  r = await call('POST', `/api/orders/${id}/dispute`, { token: bob, body: { reason: '对方没上线' } });
  assert.strictEqual(r.data.status, 'disputed');

  r = await call('GET', '/api/admin/overview', { token: boss });
  assert.strictEqual(r.data.disputes.length, 1);
  r = await call('POST', `/api/admin/orders/${id}/resolve`, { token: deer, body: { outcome: 'release' } });
  assert.strictEqual(r.status, 403, '陪玩师自己不能判');
  r = await call('POST', `/api/admin/orders/${id}/resolve`, { token: boss, body: { outcome: 'refund', note: '查实未上线' } });
  assert.strictEqual(r.data.status, 'refunded');
  assert.strictEqual(r.data.dispute.resolution.outcome, 'refund');
});

test('report and ban: banned user is logged out and companion hidden', async () => {
  let r = await call('POST', '/api/reports', { token: alice, body: { target: 'ken', reason: '要求线下见面' } });
  assert.strictEqual(r.status, 201);
  r = await call('GET', '/api/admin/overview', { token: boss });
  const rep = r.data.reports[0];
  assert.strictEqual(rep.target, 'ken');
  await call('POST', `/api/admin/reports/${rep.id}/close`, { token: boss, body: { ban: true } });

  r = await call('POST', '/api/auth/login', { body: { id: 'ken', password: 'password123' } });
  assert.strictEqual(r.data.code, 'banned');
  r = await call('GET', '/api/companions');
  assert.deepStrictEqual(r.data.map((c) => c.name), ['deer']);
});

test('order lists by role; config lists games', async () => {
  let r = await call('GET', '/api/orders', { token: alice });
  assert.strictEqual(r.data.length, 1);
  assert.strictEqual(r.data[0].messages, undefined);
  r = await call('GET', '/api/orders?role=companion', { token: deer });
  assert.ok(r.data.length >= 4);
  r = await call('GET', '/api/config');
  assert.deepStrictEqual(Object.keys(r.data.games), ['valorant', 'cs2']);
  r = await call('GET', '/api/me');
  assert.strictEqual(r.status, 401);
});
