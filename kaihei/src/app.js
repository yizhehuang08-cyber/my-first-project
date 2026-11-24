// KaiHei 服务器：托管前端页面，把 /api 请求交给 core.js，另外处理照片保存。
'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { FileStore } = require('./store');
const { createCore, HttpError } = require('./core');
const { msg } = require('./messages');
const { createStripe, verifyWebhook } = require('./stripe');

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
 * @param {object} [o.stripe] Stripe 设置 { secretKey, webhookSecret }；不填就用"测试支付"
 * @param {object} [o.stripeClient] 测试时可以换成假的 Stripe
 * @param {string} [o.publicUrl] 网站地址（Stripe 付款后跳回来用），不填就按请求自动判断
 */
function createApp({ store, admins = [], feeRate, now, stripe, stripeClient, publicUrl } = {}) {
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
    now,
    stripe: stripeClient || (stripe && stripe.secretKey ? createStripe({ secretKey: stripe.secretKey }) : null)
  });
  // 可以填多个（逗号隔开）：平台账户事件和陪玩师账户（Connected accounts）事件各有一个签名密钥
  const webhookSecrets = String((stripe && stripe.webhookSecret) || '').split(',').map((x) => x.trim()).filter(Boolean);

  const app = express();
  app.disable('x-powered-by');

  // Stripe Webhook：要用原始请求内容验证签名，所以放在 express.json() 前面
  app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
    if (!webhookSecrets.length) return res.status(400).json({ error: 'Webhook secret is not set' });
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    const t = now ? now() : Date.now();
    let event = null;
    for (const sec of webhookSecrets) if (!event) event = verifyWebhook(raw, req.get('Stripe-Signature'), sec, t);
    if (!event) return res.status(400).json({ error: 'Bad signature' });
    try {
      await core.stripeEvent(event);
      await store.flush();
      res.json({ received: true });
    } catch (e) {
      console.error('Stripe webhook failed:', e.message);
      res.status(500).json({ error: 'Webhook handling failed' }); // Stripe 会自动重发
    }
  });

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
  // 从 Stripe 付款页 / 收款设置页跳回来
  app.get('/go/o/:id', (req, res) => res.redirect('/#/o/' + encodeURIComponent(req.params.id)));
  app.get('/go/me', (req, res) => res.redirect('/#/me'));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const langOf = (req) => (String(req.get('X-Lang') || '').startsWith('zh') ? 'zh' : 'en');
  const tokenOf = (req) => {
    const m = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
    return m ? m[1] : null;
  };

  app.all('/api/*', async (req, res) => {
    try {
      const origin = publicUrl || `${req.protocol}://${req.get('host')}`;
      const r = await core.handle(req.method, req.originalUrl, { token: tokenOf(req), body: req.body, origin });
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
