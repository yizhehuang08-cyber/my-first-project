// trove 的核心业务逻辑：账号、登录、帖子、投票、评论回复……
// 这个文件服务器（Node）和浏览器演示版共用，所以不直接依赖 Node 或浏览器的功能，
// 密码加密、生成随机令牌、保存照片这些都由外面传进来。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TroveCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAME_RE = /^[a-z0-9._]{2,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+?\d{7,15}$/;
  const SESSION_MS = 60 * 24 * 3600 * 1000; // 登录 60 天有效
  const MAX_FAILS = 5; // 连续输错几次锁定
  const LOCK_MS = 15 * 60 * 1000;
  const MIN_PASSWORD = 8;

  class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const fail = (status, message) => { throw new HttpError(status, message); };

  const normEmail = (v) => String(v || '').trim().toLowerCase();
  const normPhone = (v) => String(v || '').trim().replace(/[\s\-().]/g, '');
  const isEmail = (e) => e.length <= 254 && EMAIL_RE.test(e);
  const isPhone = (p) => PHONE_RE.test(p);

  // 旧数据文件可能缺一些字段，补齐
  function upgrade(db) {
    db.notes = db.notes || [];
    db.users = db.users || {};
    db.sessions = db.sessions || {};
    for (const u of Object.values(db.users)) {
      u.email = u.email || null;
      u.phone = u.phone || null;
      u.pass = u.pass || null;
      u.google = u.google || null;
      u.saved = u.saved || [];
      u.following = u.following || [];
      if (u.notifSeenAt === undefined) u.notifSeenAt = null; // 上次看通知的时间
    }
    for (const n of db.notes) {
      n.questions = (n.questions || []).map((q) => ({ replyTo: null, ...q }));
    }
    return db;
  }

  function createCore(opts) {
    const { save, hashPassword, verifyPassword, randomToken } = opts;
    const savePhoto = opts.savePhoto || ((p) => p);
    const now = opts.now || (() => Date.now());
    const googleEnabled = !!opts.googleEnabled;
    const db = upgrade(opts.db);
    const fails = new Map(); // 登录失败计数（只在内存里）

    const iso = () => new Date(now()).toISOString();
    const nextId = () => (db.lastId = (db.lastId || 0) + 1);
    const users = () => Object.values(db.users);
    const byEmail = (e) => users().find((u) => u.email === e) || null;
    const byPhone = (p) => users().find((u) => u.phone === p) || null;
    const sorted = () => [...db.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    function account(u) {
      return {
        username: u.name,
        email: u.email,
        phone: u.phone,
        google: u.google ? { email: u.google.email } : null,
        hasPassword: !!u.pass,
        createdAt: u.createdAt
      };
    }

    function newUser(name, fields) {
      const u = { name, email: null, phone: null, pass: null, google: null, saved: [], following: [], notifSeenAt: null, createdAt: iso(), ...fields };
      db.users[name] = u;
      return u;
    }

    async function startSession(u) {
      const token = await randomToken();
      db.sessions[token] = { user: u.name, expires: now() + SESSION_MS };
      save();
      return { token, account: account(u) };
    }

    function userFromToken(token) {
      const s = token && db.sessions[token];
      if (!s) return null;
      if (s.expires < now()) { delete db.sessions[token]; save(); return null; }
      return db.users[s.user] || null;
    }

    function checkUsername(name) {
      if (!NAME_RE.test(name)) fail(400, 'Username: 2–20 characters, lowercase letters, numbers, . or _');
      if (db.users[name]) fail(409, 'That username is taken');
    }

    function checkPassword(p) {
      if (typeof p !== 'string' || p.length < MIN_PASSWORD) fail(400, `Password must be at least ${MIN_PASSWORD} characters`);
      if (p.length > 200) fail(400, 'Password is too long');
    }

    async function requireCurrentPassword(u, current) {
      if (!u.pass) return; // 只用 Google 登录、还没设密码的账号
      if (!current || !(await verifyPassword(String(current), u.pass))) fail(403, 'Current password is wrong');
    }

    // 用户名不能和 Google 名字冲突：从邮箱前缀生成一个可用的
    function freeUsername(base) {
      let stem = String(base || 'user').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 16);
      if (stem.length < 2) stem = 'user';
      let name = stem;
      for (let i = 2; db.users[name]; i++) name = stem + i;
      return name;
    }

    // ---------- Google（服务器拿到 Google 资料后调用） ----------
    async function googleSignIn(profile) {
      if (!profile || !profile.sub) fail(400, 'Google did not return an account');
      let u = users().find((x) => x.google && x.google.sub === profile.sub);
      const email = normEmail(profile.email);
      if (!u && email && profile.email_verified) {
        // 已经用同一个邮箱注册过：直接关联
        u = byEmail(email);
        if (u) u.google = { sub: profile.sub, email };
      }
      if (!u) {
        u = newUser(freeUsername(email.split('@')[0]), {
          email: email && profile.email_verified && !byEmail(email) ? email : null,
          google: { sub: profile.sub, email }
        });
      }
      return startSession(u);
    }

    function linkGoogle(u, profile) {
      const other = users().find((x) => x.google && x.google.sub === profile.sub);
      if (other && other !== u) fail(409, 'That Google account is already linked to @' + other.name);
      u.google = { sub: profile.sub, email: normEmail(profile.email) };
      save();
      return account(u);
    }

    // ---------- 通知 ----------
    // 不单独存通知，直接从评论里算出来：
    //   reply    = 有人回复了我的评论
    //   question = 有人在我的帖子下发了新评论（不是回复别人的）
    function notifications(usr) {
      const items = [];
      for (const note of db.notes) {
        const byId = new Map(note.questions.map((q) => [q.id, q]));
        for (const q of note.questions) {
          if (q.author === usr.name) continue; // 自己发的不提醒自己
          const parent = q.replyTo ? byId.get(q.replyTo) : null;
          let kind = null;
          if (parent && parent.author === usr.name) kind = 'reply';
          else if (!q.replyTo && note.author === usr.name) kind = 'question';
          if (!kind) continue;
          items.push({
            id: q.id, kind, from: q.author, text: q.text, createdAt: q.createdAt,
            noteId: note.id, noteTitle: note.title, tint: note.tint, photo: note.photos[0] || null,
            yourText: parent ? parent.text : null,
            unread: !usr.notifSeenAt || q.createdAt > usr.notifSeenAt
          });
        }
      }
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const unreadCount = (usr) => notifications(usr).filter((n) => n.unread).length;

    // ---------- 帖子展示 ----------
    function view(note, me) {
      const votes = Object.values(note.votes);
      const agree = note.baseAgree + votes.filter((v) => v === 1).length;
      const disagree = note.baseDisagree + votes.filter((v) => v === -1).length;
      const total = agree + disagree;
      return {
        id: note.id, author: note.author, title: note.title, body: note.body, worth: note.worth,
        place: note.place, price: note.price, photos: note.photos, tint: note.tint,
        agree, disagree, total, pct: total ? Math.round((agree * 100) / total) : 0,
        likes: note.baseLikes + note.likes.length,
        questions: note.questions.map((q) => ({ ...q, isAuthor: q.author === note.author })),
        createdAt: note.createdAt,
        myVote: me ? note.votes[me.name] || 0 : 0,
        liked: me ? note.likes.includes(me.name) : false,
        saved: me ? me.saved.includes(note.id) : false,
        following: me ? me.following.includes(note.author) : false
      };
    }

    // ---------- 路由 ----------
    async function handle(method, url, { token, body } = {}) {
      const u = new URL(url, 'http://local');
      const path = u.pathname.replace(/\/+$/, '');
      const parts = path.split('/').filter(Boolean); // ['api', 'notes', '3', 'vote']
      const b = body && typeof body === 'object' ? body : {};
      const me = userFromToken(token);
      const needUser = () => me || fail(401, 'Please log in');
      const ok = (data, status = 200) => ({ status, data });
      const key = method + ' ' + path;

      // ----- 账号 -----
      if (key === 'GET /api/config') return ok({ google: googleEnabled });

      if (key === 'POST /api/auth/signup') {
        const name = String(b.username || '').trim().toLowerCase();
        checkUsername(name);
        const email = b.email ? normEmail(b.email) : null;
        const phone = b.phone ? normPhone(b.phone) : null;
        if (!email && !phone) fail(400, 'Enter an email or a phone number');
        if (email && !isEmail(email)) fail(400, 'That email does not look right');
        if (phone && !isPhone(phone)) fail(400, 'Phone number: 7–15 digits, can start with +');
        if (email && byEmail(email)) fail(409, 'That email already has an account. Log in instead');
        if (phone && byPhone(phone)) fail(409, 'That phone number already has an account. Log in instead');
        checkPassword(b.password);
        const u = newUser(name, { email, phone, pass: await hashPassword(b.password) });
        const r = await startSession(u);
        return ok(r, 201);
      }

      if (key === 'POST /api/auth/login') {
        const raw = String(b.id || '').trim();
        if (!raw || !b.password) fail(400, 'Enter your email, phone or username, and your password');
        const lockKey = raw.toLowerCase();
        const f = fails.get(lockKey);
        if (f && f.count >= MAX_FAILS && f.until > now()) {
          fail(429, `Too many tries. Wait ${Math.ceil((f.until - now()) / 60000)} min and try again`);
        }
        let user;
        if (raw.includes('@')) user = byEmail(normEmail(raw));
        else if (isPhone(normPhone(raw))) user = byPhone(normPhone(raw));
        else user = db.users[raw.toLowerCase()] || null;
        const good = user && user.pass && (await verifyPassword(String(b.password), user.pass));
        if (!good) {
          const cur = f && f.until > now() ? f : { count: 0 };
          fails.set(lockKey, { count: cur.count + 1, until: now() + LOCK_MS });
          if (user && !user.pass && user.google) fail(401, 'This account uses Google. Continue with Google instead');
          fail(401, 'Wrong login or password');
        }
        fails.delete(lockKey);
        return ok(await startSession(user));
      }

      if (key === 'POST /api/auth/logout') {
        if (token) { delete db.sessions[token]; save(); }
        return ok({ ok: true });
      }

      if (key === 'GET /api/account') return ok(account(needUser()));

      if (key === 'PATCH /api/account') {
        const usr = needUser();
        await requireCurrentPassword(usr, b.currentPassword);
        if ('email' in b) {
          const email = b.email ? normEmail(b.email) : null;
          if (email && !isEmail(email)) fail(400, 'That email does not look right');
          const other = email && byEmail(email);
          if (other && other !== usr) fail(409, 'That email is used by another account');
          if (!email && !usr.pass && !usr.google) fail(400, 'You need at least one way to log in');
          usr.email = email;
        }
        if ('phone' in b) {
          const phone = b.phone ? normPhone(b.phone) : null;
          if (phone && !isPhone(phone)) fail(400, 'Phone number: 7–15 digits, can start with +');
          const other = phone && byPhone(phone);
          if (other && other !== usr) fail(409, 'That phone number is used by another account');
          usr.phone = phone;
        }
        save();
        return ok(account(usr));
      }

      if (key === 'POST /api/account/password') {
        const usr = needUser();
        await requireCurrentPassword(usr, b.currentPassword);
        checkPassword(b.newPassword);
        usr.pass = await hashPassword(b.newPassword);
        // 改密码后，其他设备上的登录全部失效
        for (const [t, s] of Object.entries(db.sessions)) if (s.user === usr.name && t !== token) delete db.sessions[t];
        save();
        return ok(account(usr));
      }

      if (key === 'DELETE /api/account/google') {
        const usr = needUser();
        if (!usr.pass) fail(400, 'Set a password first, so you can still log in without Google');
        usr.google = null;
        save();
        return ok(account(usr));
      }

      // ----- 帖子 -----
      if (key === 'GET /api/notes') {
        const filter = u.searchParams.get('filter') || 'all';
        const q = (u.searchParams.get('q') || '').trim().toLowerCase();
        let notes = sorted();
        if (filter === 'yes') notes = notes.filter((n) => n.worth === true);
        if (filter === 'no') notes = notes.filter((n) => n.worth === false);
        if (q) notes = notes.filter((n) => [n.title, n.body, n.place, n.author].join(' ').toLowerCase().includes(q));
        return ok(notes.map((n) => view(n, me)));
      }

      if (key === 'GET /api/notifications') {
        const usr = needUser();
        const items = notifications(usr);
        return ok({ unread: items.filter((n) => n.unread).length, items });
      }

      if (key === 'GET /api/notifications/count') return ok({ unread: unreadCount(needUser()) });

      if (key === 'POST /api/notifications/read') {
        const usr = needUser();
        usr.notifSeenAt = iso();
        save();
        return ok({ unread: 0 });
      }

      if (key === 'GET /api/me') {
        const usr = needUser();
        return ok({
          name: usr.name,
          account: account(usr),
          unread: unreadCount(usr),
          following: usr.following,
          saved: usr.saved.map((id) => db.notes.find((n) => n.id === id)).filter(Boolean).map((n) => view(n, usr)),
          mine: sorted().filter((n) => n.author === usr.name).map((n) => view(n, usr))
        });
      }

      if (key === 'POST /api/notes') {
        const usr = needUser();
        const title = String(b.title || '').trim();
        const text = String(b.body || '').trim();
        if (!title) fail(400, 'Add a title first');
        if (title.length > 120) fail(400, 'Title: 120 characters at most');
        if (text.length > 5000) fail(400, 'Story: 5000 characters at most');
        const photosIn = Array.isArray(b.photos) ? b.photos : [];
        if (photosIn.length > 4) fail(400, '4 photos at most');
        const photos = [];
        for (const p of photosIn) photos.push(await savePhoto(p));
        const note = {
          id: nextId(), author: usr.name, title, body: text,
          worth: b.worth === true ? true : b.worth === false ? false : null,
          place: String(b.place || '').trim().slice(0, 80), price: String(b.price || '').trim().slice(0, 20),
          photos, tint: Math.floor(Math.random() * 6), votes: {}, likes: [],
          baseAgree: 0, baseDisagree: 0, baseLikes: 0, questions: [], createdAt: iso()
        };
        db.notes.push(note);
        save();
        return ok(view(note, usr), 201);
      }

      if (parts[1] === 'users' && parts[3] === 'follow' && method === 'POST' && parts.length === 4) {
        const usr = needUser();
        const target = decodeURIComponent(parts[2]).toLowerCase();
        if (!NAME_RE.test(target)) fail(400, 'Unknown user');
        if (target === usr.name) fail(400, 'You cannot follow yourself');
        const i = usr.following.indexOf(target);
        if (i >= 0) usr.following.splice(i, 1); else usr.following.push(target);
        save();
        return ok({ following: i < 0 });
      }

      if (parts[1] === 'notes' && parts.length >= 3) {
        const note = db.notes.find((n) => n.id === Number(parts[2]));
        if (!note) fail(404, 'Note not found');
        if (method === 'GET' && parts.length === 3) return ok(view(note, me));
        const action = method === 'POST' && parts.length === 4 ? parts[3] : null;
        const usr = action ? needUser() : null;

        if (action === 'vote') {
          if (note.worth === null) fail(400, 'This note has no verdict to vote on');
          const v = Number(b.value);
          if (![1, -1, 0].includes(v)) fail(400, 'value must be 1, -1 or 0');
          if (v === 0) delete note.votes[usr.name]; else note.votes[usr.name] = v;
        } else if (action === 'like') {
          const i = note.likes.indexOf(usr.name);
          if (i >= 0) note.likes.splice(i, 1); else note.likes.push(usr.name);
        } else if (action === 'save') {
          const i = usr.saved.indexOf(note.id);
          if (i >= 0) usr.saved.splice(i, 1); else usr.saved.push(note.id);
        } else if (action === 'questions') {
          const text = String(b.text || '').trim();
          if (!text) fail(400, 'Write something first');
          if (text.length > 500) fail(400, '500 characters at most');
          let replyTo = null;
          if (b.replyTo != null) {
            const parent = note.questions.find((q) => q.id === Number(b.replyTo));
            if (!parent) fail(400, 'That comment no longer exists');
            replyTo = parent.id;
          }
          note.questions.push({ id: nextId(), author: usr.name, text, replyTo, createdAt: iso() });
          save();
          return ok(view(note, usr), 201);
        } else {
          fail(404, 'Not found');
        }
        save();
        return ok(view(note, usr));
      }

      fail(404, 'Not found');
    }

    return { handle, userFromToken, googleSignIn, linkGoogle, account };
  }

  return { createCore, HttpError, upgrade, NAME_RE };
});
