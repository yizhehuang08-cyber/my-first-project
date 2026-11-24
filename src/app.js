// trove 的后端：提供帖子、投票、点赞、收藏、提问的 API，并托管前端页面。
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Store = require('./store');

const NAME_RE = /^[a-z0-9._]{2,20}$/;
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function createApp({ dataFile, uploadDir } = {}) {
  const store = new Store(dataFile);
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  if (uploadDir) {
    fs.mkdirSync(uploadDir, { recursive: true });
    app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
  }
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // 用请求头 X-User 识别用户（原型阶段没有密码）
  function user(req, res, next) {
    const name = String(req.get('X-User') || '').trim().toLowerCase();
    if (!NAME_RE.test(name)) {
      return res.status(401).json({ error: '请先设置用户名（2–20 位小写字母、数字、点或下划线）' });
    }
    req.user = name;
    next();
  }

  function findNote(req, res, next) {
    const note = store.getNote(Number(req.params.id));
    if (!note) return res.status(404).json({ error: '帖子不存在' });
    req.note = note;
    next();
  }

  // 给前端看的帖子格式：把投票和点赞算成数字，并标出“我”的状态
  function view(note, me) {
    const votes = Object.values(note.votes);
    const agree = note.baseAgree + votes.filter((v) => v === 1).length;
    const disagree = note.baseDisagree + votes.filter((v) => v === -1).length;
    const total = agree + disagree;
    const u = me ? store.getUser(me) : null;
    return {
      id: note.id,
      author: note.author,
      title: note.title,
      body: note.body,
      worth: note.worth,
      place: note.place,
      price: note.price,
      photos: note.photos,
      tint: note.tint,
      agree,
      disagree,
      total,
      pct: total ? Math.round((agree * 100) / total) : 0,
      likes: note.baseLikes + note.likes.length,
      questions: note.questions,
      createdAt: note.createdAt,
      myVote: me ? note.votes[me] || 0 : 0,
      liked: me ? note.likes.includes(me) : false,
      saved: u ? u.saved.includes(note.id) : false,
      following: u ? u.following.includes(note.author) : false
    };
  }

  function savePhoto(dataUrl) {
    const m = /^data:([a-z/]+);base64,(.+)$/.exec(String(dataUrl));
    if (!m || !PHOTO_TYPES[m[1]]) throw new Error('照片格式只支持 JPG、PNG、WebP');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_PHOTO_BYTES) throw new Error('单张照片不能超过 2MB');
    if (!uploadDir) throw new Error('服务器没有配置照片目录');
    const name = crypto.randomBytes(12).toString('hex') + '.' + PHOTO_TYPES[m[1]];
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return '/uploads/' + name;
  }

  const me = (req) => {
    const name = String(req.get('X-User') || '').trim().toLowerCase();
    return NAME_RE.test(name) ? name : null;
  };

  // ---- 读取 ----
  app.get('/api/notes', (req, res) => {
    const filter = req.query.filter || 'all';
    const q = String(req.query.q || '').trim().toLowerCase();
    let notes = store.listNotes();
    if (filter === 'yes') notes = notes.filter((n) => n.worth === true);
    if (filter === 'no') notes = notes.filter((n) => n.worth === false);
    if (q) {
      notes = notes.filter((n) =>
        [n.title, n.body, n.place, n.author].join(' ').toLowerCase().includes(q)
      );
    }
    const who = me(req);
    res.json(notes.map((n) => view(n, who)));
  });

  app.get('/api/notes/:id', findNote, (req, res) => res.json(view(req.note, me(req))));

  app.get('/api/me', user, (req, res) => {
    const u = store.getUser(req.user);
    const saved = u.saved.map((id) => store.getNote(id)).filter(Boolean).map((n) => view(n, req.user));
    const mine = store.listNotes().filter((n) => n.author === req.user).map((n) => view(n, req.user));
    res.json({ name: u.name, following: u.following, saved, mine });
  });

  // ---- 写入 ----
  app.post('/api/notes', user, (req, res) => {
    const b = req.body || {};
    const title = String(b.title || '').trim();
    const body = String(b.body || '').trim();
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    if (title.length > 120) return res.status(400).json({ error: '标题最多 120 个字' });
    if (body.length > 5000) return res.status(400).json({ error: '内容最多 5000 个字' });
    const worth = b.worth === true ? true : b.worth === false ? false : null;
    const photosIn = Array.isArray(b.photos) ? b.photos : [];
    if (photosIn.length > MAX_PHOTOS) return res.status(400).json({ error: `最多 ${MAX_PHOTOS} 张照片` });
    let photos;
    try {
      photos = photosIn.map(savePhoto);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const note = store.addNote({
      author: req.user,
      title,
      body,
      worth,
      place: String(b.place || '').trim().slice(0, 80),
      price: String(b.price || '').trim().slice(0, 20),
      photos
    });
    res.status(201).json(view(note, req.user));
  });

  app.post('/api/notes/:id/vote', user, findNote, (req, res) => {
    if (req.note.worth === null) return res.status(400).json({ error: '这条是纯分享，没有结论可以投票' });
    const value = Number(req.body && req.body.value);
    if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'value 只能是 1、-1 或 0' });
    store.vote(req.note, req.user, value);
    res.json(view(req.note, req.user));
  });

  app.post('/api/notes/:id/like', user, findNote, (req, res) => {
    store.toggleLike(req.note, req.user);
    res.json(view(req.note, req.user));
  });

  app.post('/api/notes/:id/save', user, findNote, (req, res) => {
    store.toggleSave(req.user, req.note.id);
    res.json(view(req.note, req.user));
  });

  app.post('/api/notes/:id/questions', user, findNote, (req, res) => {
    const text = String((req.body && req.body.text) || '').trim();
    if (!text) return res.status(400).json({ error: '问题不能为空' });
    if (text.length > 500) return res.status(400).json({ error: '问题最多 500 个字' });
    store.addQuestion(req.note, req.user, text);
    res.status(201).json(view(req.note, req.user));
  });

  app.post('/api/users/:name/follow', user, (req, res) => {
    const target = String(req.params.name).toLowerCase();
    if (!NAME_RE.test(target)) return res.status(400).json({ error: '用户名不对' });
    if (target === req.user) return res.status(400).json({ error: '不能关注自己' });
    const following = store.toggleFollow(req.user, target);
    res.json({ following });
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: '上传内容太大' });
    console.error(err);
    res.status(500).json({ error: '服务器出错了' });
  });

  return app;
}

module.exports = { createApp };
