const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');

let server, base, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trove-test-'));
  const app = createApp({ dataFile: path.join(dir, 'db.json'), uploadDir: path.join(dir, 'uploads') });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function call(method, url, { user, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { 'X-User': user } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
}

test('lists seeded notes and filters by verdict', async () => {
  const all = await call('GET', '/api/notes');
  assert.strictEqual(all.status, 200);
  assert.strictEqual(all.data.length, 7);
  const no = await call('GET', '/api/notes?filter=no');
  assert.ok(no.data.every((n) => n.worth === false));
  assert.strictEqual(no.data.length, 1);
});

test('search matches title, place and body', async () => {
  const r = await call('GET', '/api/notes?q=ramen');
  assert.deepStrictEqual(r.data.map((n) => n.title), ['Late-night ramen on Green St']);
});

test('writing requires a valid username', async () => {
  assert.strictEqual((await call('POST', '/api/notes', { body: { title: 'x' } })).status, 401);
  assert.strictEqual((await call('POST', '/api/notes', { user: 'Bad Name!', body: { title: 'x' } })).status, 401);
});

test('post a note with a verdict and a photo', async () => {
  const png = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
  const r = await call('POST', '/api/notes', {
    user: 'ryan.h',
    body: { title: 'Ice skates from Facebook Marketplace', body: 'Cheap, barely used.', worth: true, price: '$25', place: 'Urbana', photos: [png] }
  });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.worth, true);
  assert.match(r.data.photos[0], /^\/uploads\/[a-f0-9]+\.png$/);
  const img = await fetch(base + r.data.photos[0]);
  assert.strictEqual(img.status, 200);
  const list = await call('GET', '/api/notes');
  assert.strictEqual(list.data[0].id, r.data.id, 'newest note comes first');
});

test('rejects empty titles and bad photos', async () => {
  assert.strictEqual((await call('POST', '/api/notes', { user: 'ryan.h', body: { title: '  ' } })).status, 400);
  const bad = await call('POST', '/api/notes', { user: 'ryan.h', body: { title: 'x', photos: ['data:text/html;base64,PGI+'] } });
  assert.strictEqual(bad.status, 400);
});

test('agree / disagree / undo vote', async () => {
  const before = (await call('GET', '/api/notes/1')).data;
  let r = await call('POST', '/api/notes/1/vote', { user: 'amy', body: { value: 1 } });
  assert.strictEqual(r.data.agree, before.agree + 1);
  assert.strictEqual(r.data.myVote, 1);
  r = await call('POST', '/api/notes/1/vote', { user: 'amy', body: { value: -1 } });
  assert.strictEqual(r.data.agree, before.agree);
  assert.strictEqual(r.data.disagree, before.disagree + 1);
  r = await call('POST', '/api/notes/1/vote', { user: 'amy', body: { value: 0 } });
  assert.strictEqual(r.data.disagree, before.disagree);
  // 纯分享帖不能投票
  assert.strictEqual((await call('POST', '/api/notes/2/vote', { user: 'amy', body: { value: 1 } })).status, 400);
});

test('like, save and profile', async () => {
  let r = await call('POST', '/api/notes/2/like', { user: 'amy' });
  assert.strictEqual(r.data.liked, true);
  assert.strictEqual(r.data.likes, 343);
  r = await call('POST', '/api/notes/2/save', { user: 'amy' });
  assert.strictEqual(r.data.saved, true);
  const me = await call('GET', '/api/me', { user: 'amy' });
  assert.deepStrictEqual(me.data.saved.map((n) => n.id), [2]);
  r = await call('POST', '/api/notes/2/save', { user: 'amy' });
  assert.strictEqual(r.data.saved, false);
});

test('ask the author and follow', async () => {
  const r = await call('POST', '/api/notes/3/questions', { user: 'amy', body: { text: 'Is it cash only?' } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.data.questions.at(-1).text, 'Is it cash only?');
  const f = await call('POST', '/api/users/jt.eats/follow', { user: 'amy' });
  assert.strictEqual(f.data.following, true);
  assert.strictEqual((await call('GET', '/api/notes/3', { user: 'amy' })).data.following, true);
});

test('data survives a restart', async () => {
  const app2 = createApp({ dataFile: path.join(dir, 'db.json'), uploadDir: path.join(dir, 'uploads') });
  const s2 = await new Promise((r) => { const s = app2.listen(0, () => r(s)); });
  const res = await fetch(`http://127.0.0.1:${s2.address().port}/api/notes?q=skates`);
  assert.strictEqual((await res.json()).length, 1);
  s2.close();
});
