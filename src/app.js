// trove 的服务器：托管前端页面，把 /api 请求交给 core.js，另外处理照片保存和 Google 登录。
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { FileStore } = require('./store');
const { createCore, HttpError } = require('./core');
const seed = require('./seed');

const scrypt = promisify(crypto.scrypt);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const GOOGLE_STATE_MS = 10 * 60 * 1000;

// 密码用 scrypt 加盐加密，数据文件里只存加密结果
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
 * @param {object} [o.store]     已经打开的数据存储（见 store.js）；不填就用 dataFile / uploadDir 建一个本地文件存储
 * @param {string} [o.dataFile]  数据文件路径（不填 = 只在内存里）
 * @param {string} [o.uploadDir] 照片目录
 * @param {{clientId: string, clientSecret: string, redirectUri?: string}} [o.google] Google 登录配置
 * @param {typeof fetch} [o.fetchImpl] 测试时可以换成假的 fetch
 */
function createApp({ store, dataFile, uploadDir, google, fetchImpl = fetch } = {}) {
  store = store || new FileStore(dataFile, uploadDir);
  const googleOn = !!(google && google.clientId && google.clientSecret);

  function savePhoto(dataUrl) {
    const m = /^data:([a-z/]+);base64,(.+)$/.exec(String(dataUrl));
    if (!m || !PHOTO_TYPES[m[1]]) throw new HttpError(400, 'Photos must be JPG, PNG or WebP');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_PHOTO_BYTES) throw new HttpError(400, 'Each photo must be under 2 MB');
    return store.savePhoto(buf, m[1], PHOTO_TYPES[m[1]]);
  }

  const core = createCore({
    db: store.data,
    save: () => store.save(),
    hashPassword,
    verifyPassword,
    randomToken: () => crypto.randomBytes(32).toString('hex'),
    savePhoto,
    googleEnabled: googleOn,
    samples: { notes: seed.SAMPLE_NOTES, authors: seed.SAMPLE_AUTHORS } // 旧数据里的示例帖子会被清理
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '12mb' }));
  if (store.uploadDir) app.use('/uploads', express.static(store.uploadDir, { maxAge: '7d' }));
  if (store.getPhoto) {
    // 数据库版：照片从数据库里读
    app.get('/photos/:name', async (req, res, next) => {
      try {
        const photo = await store.getPhoto(req.params.name);
        if (!photo) return res.status(404).end();
        res.set('Content-Type', photo.mime);
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 照片不会变，浏览器可以一直缓存
        res.send(photo.data);
      } catch (e) { next(e); }
    });
  }
  // 健康检查：部署平台用它判断服务是否正常
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const tokenOf = (req) => {
    const m = /^Bearer (\S+)$/.exec(req.get('Authorization') || '');
    return m ? m[1] : null;
  };

  // ---------- Google 登录（OAuth） ----------
  const googleStates = new Map(); // state -> { mode, user, expires }
  const redirectUri = (req) => (google && google.redirectUri) || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

  app.post('/api/auth/google/start', (req, res) => {
    if (!googleOn) return res.status(501).json({ error: 'Google sign-in is not set up on this server yet' });
    const mode = req.body && req.body.mode === 'link' ? 'link' : 'login';
    let user = null;
    if (mode === 'link') {
      user = core.userFromToken(tokenOf(req));
      if (!user) return res.status(401).json({ error: 'Please log in' });
    }
    const state = crypto.randomBytes(16).toString('hex');
    googleStates.set(state, { mode, user: user && user.name, expires: Date.now() + GOOGLE_STATE_MS });
    const q = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: redirectUri(req),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account'
    });
    res.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + q });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const back = (hash) => res.redirect('/#' + new URLSearchParams(hash));
    const st = googleStates.get(String(req.query.state || ''));
    googleStates.delete(String(req.query.state || ''));
    if (!st || st.expires < Date.now()) return back({ auth_error: 'Google sign-in expired. Try again' });
    if (req.query.error || !req.query.code) return back({ auth_error: 'Google sign-in was cancelled' });
    try {
      const tokRes = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: google.clientId,
          client_secret: google.clientSecret,
          redirect_uri: redirectUri(req),
          grant_type: 'authorization_code'
        })
      });
      const tok = await tokRes.json();
      if (!tokRes.ok || !tok.access_token) throw new HttpError(502, 'Google did not accept the sign-in');
      const infoRes = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: 'Bearer ' + tok.access_token }
      });
      const profile = await infoRes.json();
      if (!infoRes.ok || !profile.sub) throw new HttpError(502, 'Could not read your Google account');

      if (st.mode === 'link') {
        const u = store.data.users[st.user];
        if (!u) throw new HttpError(401, 'Please log in again');
        core.linkGoogle(u, profile);
        await store.flush();
        return back({ linked: 'google' });
      }
      const r = await core.googleSignIn(profile);
      await store.flush();
      back({ auth: r.token });
    } catch (e) {
      back({ auth_error: e instanceof HttpError ? e.message : 'Google sign-in failed' });
    }
  });

  // ---------- 其他所有 API ----------
  app.all('/api/*', async (req, res) => {
    try {
      const r = await core.handle(req.method, req.originalUrl, { token: tokenOf(req), body: req.body });
      await store.flush(); // 确认数据已经存好再回应
      res.status(r.status).json(r.data);
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Something went wrong on the server' });
    }
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Upload is too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  return app;
}

module.exports = { createApp, hashPassword, verifyPassword };
