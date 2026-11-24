const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { FileStore, PgStore } = require('../src/store');

// 设置了 TEST_DATABASE_URL 就用数据库跑这一整套测试，否则用本地文件
const PG_URL = process.env.TEST_DATABASE_URL;
let server, base, dir, store;

async function openTestStore() {
  if (PG_URL) return PgStore.open(PG_URL);
  return new FileStore(path.join(dir, 'db.json'), path.join(dir, 'uploads'));
}

// 存下来的原始数据（用来确认密码没有明文保存）
async function rawSaved() {
  if (!PG_URL) return fs.readFileSync(path.join(dir, 'db.json'), 'utf8');
  const r = await store.pool.query('select data::text as t from trove_state where id = 1');
  return r.rows[0].t;
}

// 假的 Google：只认 code=good
const fakeGoogle = async (url) => {
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  if (url.startsWith('https://oauth2.googleapis.com/token')) return json(200, { access_token: 'at' });
  if (url.startsWith('https://openidconnect.googleapis.com')) return json(200, { sub: 'g-123', email: 'Ryan@Gmail.com', email_verified: true });
  return json(404, {});
};

async function listen(app) {
  return new Promise((r) => { const s = app.listen(0, () => r(s)); });
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-test-'));
  if (PG_URL) {
    // 每次从空数据库开始
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: PG_URL });
    await pool.query('drop table if exists trove_state, trove_photos');
    await pool.end();
  }
  store = await openTestStore();
  server = await listen(createApp({
    store,
    google: { clientId: 'cid', clientSecret: 'secret' },
    fetchImpl: fakeGoogle
  }));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  if (store.close) await store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { status: res.status, data, headers: res.headers };
}

const signup = (body) => call('POST', '/api/auth/signup', { body });
let amy; // amy 的登录令牌

// ---------- 注册 / 登录 ----------
test('sign up with email, password is stored hashed', async () => {
  const r = await signup({ username: 'amy', email: 'Amy@Illinois.edu', password: 'correct horse' });
  assert.strictEqual(r.status, 201);
  assert.ok(r.data.token);
  assert.strictEqual(r.data.account.email, 'amy@illinois.edu');
  assert.strictEqual(r.data.account.hasPassword, true);
  amy = r.data.token;
  const raw = await rawSaved();
  assert.ok(!raw.includes('correct horse'), 'plain password must never be saved');
  assert.match(raw, /scrypt\$/);
});

test('sign up with phone', async () => {
  const r = await signup({ username: 'ben_2', phone: '+1 (217) 555-0123', password: '12345678' });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.account.phone, '+12175550123');
});

test('sign up rejects bad or taken details', async () => {
  assert.strictEqual((await signup({ username: 'amy', email: 'x@y.com', password: '12345678' })).status, 409);
  assert.strictEqual((await signup({ username: 'maya.c', email: 'x@y.com', password: '12345678' })).status, 409, 'seed author names are taken');
  assert.strictEqual((await signup({ username: 'cat', email: 'amy@illinois.edu', password: '12345678' })).status, 409);
  assert.strictEqual((await signup({ username: 'cat', email: 'not-an-email', password: '12345678' })).status, 400);
  assert.strictEqual((await signup({ username: 'cat', phone: '12', password: '12345678' })).status, 400);
  assert.strictEqual((await signup({ username: 'cat', email: 'c@y.com', password: 'short' })).status, 400);
  assert.strictEqual((await signup({ username: 'cat', password: '12345678' })).status, 400);
  assert.strictEqual((await signup({ username: 'Bad Name', email: 'c@y.com', password: '12345678' })).status, 400);
});

test('log in with email, phone or username', async () => {
  for (const id of ['AMY@illinois.edu', 'amy']) {
    const r = await call('POST', '/api/auth/login', { body: { id, password: 'correct horse' } });
    assert.strictEqual(r.status, 200, id);
  }
  const p = await call('POST', '/api/auth/login', { body: { id: '217-555-0123'.replace(/^/, '+1 '), password: '12345678' } });
  assert.strictEqual(p.status, 200);
  assert.strictEqual(p.data.account.username, 'ben_2');
  const bad = await call('POST', '/api/auth/login', { body: { id: 'amy', password: 'wrong password' } });
  assert.strictEqual(bad.status, 401);
});

test('too many wrong passwords locks the login', async () => {
  await signup({ username: 'locky', email: 'l@y.com', password: '12345678' });
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { body: { id: 'locky', password: 'nope' } });
  const r = await call('POST', '/api/auth/login', { body: { id: 'locky', password: '12345678' } });
  assert.strictEqual(r.status, 429);
});

test('log out ends the session', async () => {
  const r = await call('POST', '/api/auth/login', { body: { id: 'amy', password: 'correct horse' } });
  const t = r.data.token;
  assert.strictEqual((await call('GET', '/api/account', { token: t })).status, 200);
  await call('POST', '/api/auth/logout', { token: t });
  assert.strictEqual((await call('GET', '/api/account', { token: t })).status, 401);
});

// ---------- 账号设置 ----------
test('add phone and change email need the current password', async () => {
  assert.strictEqual((await call('PATCH', '/api/account', { token: amy, body: { phone: '2175559999' } })).status, 403);
  const r = await call('PATCH', '/api/account', { token: amy, body: { phone: '2175559999', currentPassword: 'correct horse' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.phone, '2175559999');
  const taken = await call('PATCH', '/api/account', { token: amy, body: { phone: '+12175550123', currentPassword: 'correct horse' } });
  assert.strictEqual(taken.status, 409);
});

test('change password logs out other devices', async () => {
  const other = (await call('POST', '/api/auth/login', { body: { id: 'amy', password: 'correct horse' } })).data.token;
  const r = await call('POST', '/api/account/password', { token: amy, body: { currentPassword: 'correct horse', newPassword: 'new secret pw' } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await call('GET', '/api/account', { token: other })).status, 401);
  assert.strictEqual((await call('GET', '/api/account', { token: amy })).status, 200);
  assert.strictEqual((await call('POST', '/api/auth/login', { body: { id: 'amy', password: 'new secret pw' } })).status, 200);
});

// ---------- Google ----------
async function googleRoundTrip(token, mode) {
  const start = await call('POST', '/api/auth/google/start', { token, body: { mode } });
  assert.strictEqual(start.status, 200);
  const state = new URL(start.data.url).searchParams.get('state');
  const cb = await call('GET', `/api/auth/google/callback?code=good&state=${state}`);
  assert.strictEqual(cb.status, 302);
  return new URLSearchParams(cb.headers.get('location').split('#')[1]);
}

test('continue with Google creates an account', async () => {
  const h = await googleRoundTrip(null, 'login');
  const token = h.get('auth');
  assert.ok(token, h.toString());
  const acct = (await call('GET', '/api/account', { token })).data;
  assert.strictEqual(acct.username, 'ryan');
  assert.strictEqual(acct.google.email, 'ryan@gmail.com');
  assert.strictEqual(acct.hasPassword, false);
  // 第二次用同一个 Google 账号 = 同一个用户
  const again = await googleRoundTrip(null, 'login');
  assert.strictEqual((await call('GET', '/api/account', { token: again.get('auth') })).data.username, 'ryan');
  // 没设密码时不能解除 Google
  assert.strictEqual((await call('DELETE', '/api/account/google', { token })).status, 400);
});

test('Google state cannot be reused or faked', async () => {
  const cb = await call('GET', '/api/auth/google/callback?code=good&state=made-up');
  assert.match(cb.headers.get('location'), /auth_error=/);
});

test('linking a Google account already used by someone else is refused', async () => {
  const h = await googleRoundTrip(amy, 'link');
  assert.match(h.get('auth_error') || '', /already linked/);
});

// ---------- 帖子 ----------
test('lists seeded notes and filters by verdict', async () => {
  const all = await call('GET', '/api/notes');
  assert.strictEqual(all.data.length, 7);
  const no = await call('GET', '/api/notes?filter=no');
  assert.deepStrictEqual(no.data.map((n) => n.worth), [false]);
  const r = await call('GET', '/api/notes?q=ramen');
  assert.deepStrictEqual(r.data.map((n) => n.title), ['Late-night ramen on Green St']);
});

test('writing needs a login', async () => {
  assert.strictEqual((await call('POST', '/api/notes', { body: { title: 'x' } })).status, 401);
  assert.strictEqual((await call('POST', '/api/notes', { token: 'fake', body: { title: 'x' } })).status, 401);
});

test('post a note with a verdict and a photo', async () => {
  const png = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
  const r = await call('POST', '/api/notes', {
    token: amy,
    body: { title: 'Ice skates from Marketplace', body: 'Cheap, barely used.', worth: true, price: '$25', place: 'Urbana', photos: [png] }
  });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.author, 'amy');
  assert.match(r.data.photos[0], /^\/(uploads|photos)\/[a-f0-9]+\.png$/);
  const img = await fetch(base + r.data.photos[0]);
  assert.strictEqual(img.status, 200);
  assert.strictEqual(Buffer.from(await img.arrayBuffer()).toString(), 'fakepng');
  assert.strictEqual((await call('GET', '/api/notes')).data[0].id, r.data.id, 'newest first');
  const bad = await call('POST', '/api/notes', { token: amy, body: { title: 'x', photos: ['data:text/html;base64,PGI+'] } });
  assert.strictEqual(bad.status, 400);
});

test('agree / disagree / undo vote', async () => {
  const before = (await call('GET', '/api/notes/1')).data;
  let r = await call('POST', '/api/notes/1/vote', { token: amy, body: { value: 1 } });
  assert.strictEqual(r.data.agree, before.agree + 1);
  r = await call('POST', '/api/notes/1/vote', { token: amy, body: { value: -1 } });
  assert.strictEqual(r.data.disagree, before.disagree + 1);
  r = await call('POST', '/api/notes/1/vote', { token: amy, body: { value: 0 } });
  assert.strictEqual(r.data.agree, before.agree);
  assert.strictEqual((await call('POST', '/api/notes/2/vote', { token: amy, body: { value: 1 } })).status, 400);
});

test('like, save, follow and profile', async () => {
  let r = await call('POST', '/api/notes/2/like', { token: amy });
  assert.strictEqual(r.data.likes, 343);
  r = await call('POST', '/api/notes/2/save', { token: amy });
  assert.strictEqual(r.data.saved, true);
  const f = await call('POST', '/api/users/jt.eats/follow', { token: amy });
  assert.strictEqual(f.data.following, true);
  const me = (await call('GET', '/api/me', { token: amy })).data;
  assert.deepStrictEqual(me.saved.map((n) => n.id), [2]);
  assert.deepStrictEqual(me.following, ['jt.eats']);
  assert.strictEqual(me.account.username, 'amy');
});

// ---------- 评论和回复 ----------
test('ask a question, the author replies, someone replies to the reply', async () => {
  const author = (await signup({ username: 'cook', email: 'cook@y.com', password: '12345678' })).data.token;
  const note = (await call('POST', '/api/notes', { token: author, body: { title: 'Best dumplings', worth: true } })).data;

  let r = await call('POST', `/api/notes/${note.id}/questions`, { token: amy, body: { text: 'Where exactly?' } });
  assert.strictEqual(r.status, 201);
  const q = r.data.questions[0];
  assert.strictEqual(q.replyTo, null);
  assert.strictEqual(q.isAuthor, false);

  r = await call('POST', `/api/notes/${note.id}/questions`, { token: author, body: { text: 'Next to the bookstore', replyTo: q.id } });
  const a = r.data.questions[1];
  assert.strictEqual(a.replyTo, q.id);
  assert.strictEqual(a.isAuthor, true, 'author replies are marked');

  r = await call('POST', `/api/notes/${note.id}/questions`, { token: amy, body: { text: 'Thanks!', replyTo: a.id } });
  assert.strictEqual(r.data.questions[2].replyTo, a.id);

  const bad = await call('POST', `/api/notes/${note.id}/questions`, { token: amy, body: { text: 'x', replyTo: 99999 } });
  assert.strictEqual(bad.status, 400);
});

test('seed has a sample question with an author reply', async () => {
  const ramen = (await call('GET', '/api/notes?q=ramen')).data[0];
  assert.strictEqual(ramen.questions.length, 2);
  assert.strictEqual(ramen.questions[1].isAuthor, true);
});

test('data survives a restart', async () => {
  // 模拟服务器重启：重新打开存储，再起一个服务
  const store2 = await openTestStore();
  const s2 = await listen(createApp({ store: store2 }));
  const b2 = `http://127.0.0.1:${s2.address().port}`;
  const login = await fetch(b2 + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'amy', password: 'new secret pw' }) });
  assert.strictEqual(login.status, 200);
  const g = await fetch(b2 + '/api/auth/google/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.strictEqual(g.status, 501, 'Google is off without client id');
  s2.close();
  if (store2.close) await store2.close();
});

// ---------- 通知 ----------
test('notifications: replies to my comments and questions on my notes', async () => {
  const author = (await signup({ username: 'baker', email: 'baker@y.com', password: '12345678' })).data.token;
  const fan = (await signup({ username: 'fan', email: 'fan@y.com', password: '12345678' })).data.token;
  const note = (await call('POST', '/api/notes', { token: author, body: { title: 'Croissants on Goodwin', worth: true } })).data;

  assert.deepStrictEqual((await call('GET', '/api/notifications/count', { token: fan })).data, { unread: 0 });

  // fan 提问 → 作者收到 question
  const q = (await call('POST', `/api/notes/${note.id}/questions`, { token: fan, body: { text: 'Open on Sunday?' } })).data.questions[0];
  let inbox = (await call('GET', '/api/notifications', { token: author })).data;
  assert.strictEqual(inbox.unread, 1);
  assert.strictEqual(inbox.items[0].kind, 'question');
  assert.strictEqual(inbox.items[0].noteId, note.id);

  // 作者回复 → fan 收到 reply，带上 fan 原来的话；作者自己不收到自己的回复
  await call('POST', `/api/notes/${note.id}/questions`, { token: author, body: { text: 'Yes, 8 to 2', replyTo: q.id } });
  inbox = (await call('GET', '/api/notifications', { token: fan })).data;
  assert.strictEqual(inbox.unread, 1);
  assert.deepStrictEqual(
    { kind: inbox.items[0].kind, from: inbox.items[0].from, yourText: inbox.items[0].yourText, noteTitle: inbox.items[0].noteTitle },
    { kind: 'reply', from: 'baker', yourText: 'Open on Sunday?', noteTitle: 'Croissants on Goodwin' }
  );
  assert.strictEqual((await call('GET', '/api/notifications', { token: author })).data.items.length, 1);

  // 标记已读
  await call('POST', '/api/notifications/read', { token: fan });
  assert.strictEqual((await call('GET', '/api/notifications/count', { token: fan })).data.unread, 0);
  assert.strictEqual((await call('GET', '/api/notifications', { token: fan })).data.items[0].unread, false);

  // 回复自己的评论不提醒
  const mine = (await call('POST', `/api/notes/${note.id}/questions`, { token: fan, body: { text: 'Also, parking?' } })).data.questions.at(-1);
  await call('POST', `/api/notes/${note.id}/questions`, { token: fan, body: { text: 'Never mind, found it', replyTo: mine.id } });
  assert.strictEqual((await call('GET', '/api/notifications/count', { token: fan })).data.unread, 0);

  assert.strictEqual((await call('GET', '/api/notifications')).status, 401);
});

test('ryan.h gets the two sample notifications after signing up', async () => {
  const t = (await signup({ username: 'ryan.h', email: 'ryanh@y.com', password: '12345678' })).data.token;
  const inbox = (await call('GET', '/api/notifications', { token: t })).data;
  assert.deepStrictEqual(inbox.items.map((n) => [n.kind, n.from]), [['question', 'amy.l'], ['reply', 'maya.c']]);
});
