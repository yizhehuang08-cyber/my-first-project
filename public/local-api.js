// 演示版用的“本地后端”：不需要服务器，把数据存在浏览器里。
// 接口和 src/app.js 一样，前端的 app.js 不用改就能用。
// 需要在它之前定义 window.TROVE_SEED（示例数据函数）。
(() => {
  'use strict';
  const KEY = 'trove.demo.db';
  const NAME_RE = /^[a-z0-9._]{2,20}$/;
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db) db = window.TROVE_SEED();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 存不下就只保留在内存里 */ }
  }
  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

  const nextId = () => (db.lastId = (db.lastId || 0) + 1);
  const getUser = (name) => db.users[name] || (db.users[name] = { name, saved: [], following: [], createdAt: new Date().toISOString() });
  const sorted = () => [...db.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function view(note, me) {
    const votes = Object.values(note.votes);
    const agree = note.baseAgree + votes.filter((v) => v === 1).length;
    const disagree = note.baseDisagree + votes.filter((v) => v === -1).length;
    const total = agree + disagree;
    const u = me ? getUser(me) : null;
    return {
      id: note.id, author: note.author, title: note.title, body: note.body, worth: note.worth,
      place: note.place, price: note.price, photos: note.photos, tint: note.tint,
      agree, disagree, total, pct: total ? Math.round((agree * 100) / total) : 0,
      likes: note.baseLikes + note.likes.length, questions: note.questions, createdAt: note.createdAt,
      myVote: me ? note.votes[me] || 0 : 0,
      liked: me ? note.likes.includes(me) : false,
      saved: u ? u.saved.includes(note.id) : false,
      following: u ? u.following.includes(note.author) : false
    };
  }

  function handle(method, url, user, body) {
    const u = new URL(url, 'http://local');
    const parts = u.pathname.split('/').filter(Boolean); // ['api', 'notes', '3', 'vote']
    const me = NAME_RE.test(user || '') ? user : null;
    const needUser = () => { if (!me) throw new HttpError(401, 'Pick a username first'); };
    const findNote = () => {
      const n = db.notes.find((x) => x.id === Number(parts[2]));
      if (!n) throw new HttpError(404, 'Note not found');
      return n;
    };

    if (method === 'GET' && u.pathname === '/api/notes') {
      const filter = u.searchParams.get('filter') || 'all';
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      let notes = sorted();
      if (filter === 'yes') notes = notes.filter((n) => n.worth === true);
      if (filter === 'no') notes = notes.filter((n) => n.worth === false);
      if (q) notes = notes.filter((n) => [n.title, n.body, n.place, n.author].join(' ').toLowerCase().includes(q));
      return notes.map((n) => view(n, me));
    }
    if (method === 'GET' && parts[1] === 'notes' && parts.length === 3) return view(findNote(), me);
    if (method === 'GET' && u.pathname === '/api/me') {
      needUser();
      const usr = getUser(me);
      return {
        name: me, following: usr.following,
        saved: usr.saved.map((id) => db.notes.find((n) => n.id === id)).filter(Boolean).map((n) => view(n, me)),
        mine: sorted().filter((n) => n.author === me).map((n) => view(n, me))
      };
    }

    if (method !== 'POST') throw new HttpError(404, 'Not found');
    needUser();
    const b = body || {};

    if (u.pathname === '/api/notes') {
      const title = String(b.title || '').trim();
      if (!title) throw new HttpError(400, 'Add a title first');
      const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 4);
      const note = {
        id: nextId(), author: me, title, body: String(b.body || '').trim().slice(0, 5000),
        worth: b.worth === true ? true : b.worth === false ? false : null,
        place: String(b.place || '').trim().slice(0, 80), price: String(b.price || '').trim().slice(0, 20),
        photos, tint: Math.floor(Math.random() * 6), votes: {}, likes: [],
        baseAgree: 0, baseDisagree: 0, baseLikes: 0, questions: [], createdAt: new Date().toISOString()
      };
      db.notes.push(note);
      save();
      return view(note, me);
    }
    if (parts[1] === 'users' && parts[3] === 'follow') {
      const target = decodeURIComponent(parts[2]);
      if (target === me) throw new HttpError(400, 'You cannot follow yourself');
      const usr = getUser(me);
      const i = usr.following.indexOf(target);
      if (i >= 0) usr.following.splice(i, 1); else usr.following.push(target);
      save();
      return { following: i < 0 };
    }

    const note = findNote();
    const action = parts[3];
    if (action === 'vote') {
      if (note.worth === null) throw new HttpError(400, 'This note has no verdict to vote on');
      const v = Number(b.value);
      if (v === 0) delete note.votes[me]; else note.votes[me] = v;
    } else if (action === 'like') {
      const i = note.likes.indexOf(me);
      if (i >= 0) note.likes.splice(i, 1); else note.likes.push(me);
    } else if (action === 'save') {
      const usr = getUser(me);
      const i = usr.saved.indexOf(note.id);
      if (i >= 0) usr.saved.splice(i, 1); else usr.saved.push(note.id);
    } else if (action === 'questions') {
      const text = String(b.text || '').trim();
      if (!text) throw new HttpError(400, 'Write a question first');
      note.questions.push({ id: nextId(), author: me, text: text.slice(0, 500), createdAt: new Date().toISOString() });
    } else {
      throw new HttpError(404, 'Not found');
    }
    save();
    return view(note, me);
  }

  window.TROVE_LOCAL_API = async (path, { method = 'GET', user, body } = {}) => handle(method, path, user, body);
  window.TROVE_LOCAL_RESET = () => {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    db = window.TROVE_SEED();
  };
})();
