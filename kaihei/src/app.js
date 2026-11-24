// KaiHei 服务器：托管前端页面，把 /api 请求交给 core.js，另外处理照片保存。
'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { FileStore } = require('./store');
const { createCore, HttpError } = require('./core');
const { msg } = require('./messages');

const scrypt = promisify(crypto.scrypt);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * @param {object} o
 * @param {object} [o.store]   打开好的数据存储；不填就只存在内存里（测试用）
 * @param {string[]} [o.admins] 管理员用户名（环境变量 ADMIN_USERS）
 * @param {number} [o.feeRate] 平台抽成，默认 0.15
 * @param {() => number} [o.now] 测试时可以换成假的时钟
 */
function createApp({ store, admins = [], feeRate, now } = {}) {
  store = store || new FileStore(null, null);

  function savePhoto(dataUrl) {
    const m = /^data:([a-z/]+);base64,(.+)$/.exec(String(dataUrl));
    if (!m || !PHOTO_TYPES[m[1]]) throw new HttpError(400, 'bad_photo');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_PHOTO_BYTES) throw new HttpError(400, 'photo_big');
    return store.savePhoto(buf, m[1], PHOTO_TYPES[m[1]]);
  }

  const core = createCore({
    db: store.data,
    save: () => store.save(),
    hashPassword,
    verifyPassword,
    randomToken: () => crypto.randomBytes(32).toString('hex'),
    savePhoto,
    admins,
    feeRate,
    now
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));
  if (store.uploadDir) app.use('/uploads', express.static(store.uploadDir, { maxAge: '7d' }));
  if (store.getPhoto) {
    app.get('/photos/:name', async (req, res, next) => {
      try {
        const photo = await store.getPhoto(req.params.name);
        if (!photo) return res.status(404).end();
        res.set('Content-Type', photo.mime);
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(photo.data);
      } catch (e) { next(e); }
    });
  }
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const langOf = (req) => (String(req.get('X-Lang') || '').startsWith('zh') ? 'zh' : 'en');
  const tokenOf = (req) => {
    const m = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
    return m ? m[1] : null;
  };

  app.all('/api/*', async (req, res) => {
    try {
      const r = await core.handle(req.method, req.originalUrl, { token: tokenOf(req), body: req.body });
      await store.flush(); // 确认数据已经存好再回应
      res.status(r.status).json(r.data);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: msg(e.code, langOf(req), e.params), code: e.code });
      console.error(e);
      res.status(500).json({ error: msg('server_error', langOf(req)), code: 'server_error' });
    }
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: msg('photo_big', langOf(req)), code: 'photo_big' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: msg('bad_request', langOf(req)), code: 'bad_request' });
    console.error(err);
    res.status(500).json({ error: msg('server_error', langOf(req)), code: 'server_error' });
  });

  return app;
}

module.exports = { createApp, hashPassword, verifyPassword };
