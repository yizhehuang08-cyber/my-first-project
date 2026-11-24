// KaiHei 核心业务逻辑：账号、陪玩师资料、下单、订单状态、聊天、评价、举报、后台审核。
// 不直接依赖 Express，密码加密、随机令牌、保存照片由外面传进来，方便测试。
'use strict';

const { msg } = require('./messages');

// ---------- 常量 ----------
const NAME_RE = /^[a-z0-9._]{2,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISCORD_RE = /^[a-z0-9._]{2,32}$/; // Discord 新版用户名
const SESSION_MS = 60 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PASSWORD = 8;
const MIN_AGE = 18;

const HOUR = 3600 * 1000;
const ACCEPT_WINDOW_MS = 24 * HOUR; // 陪玩师 24 小时内不接单 → 自动退款
const CONFIRM_WINDOW_MS = 48 * HOUR; // 陪玩师标记完成后 48 小时买家没操作 → 自动确认
const ONLINE_MS = 6 * HOUR; // "在线"状态 6 小时后自动失效

const MIN_PRICE = 300; // 每小时最低 $3（单位：美分）
const MAX_PRICE = 20000; // 每小时最高 $200
const MAX_HOURS = 10;

// 游戏和段位。只是文字，没有用任何游戏官方的图片或标志。
const GAMES = {
  valorant: {
    name: 'Valorant',
    ranks: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant']
  },
  cs2: {
    name: 'CS2',
    ranks: ['Premier <5000', 'Premier 5000–9999', 'Premier 10000–14999', 'Premier 15000–19999', 'Premier 20000–24999', 'Premier 25000+', 'FACEIT 1–3', 'FACEIT 4–7', 'FACEIT 8–10']
  }
};
const STYLES = ['skilled', 'chill', 'coach']; // 技术陪玩 / 娱乐陪玩 / 教学
const LANGS = ['zh', 'en', 'yue']; // 普通话 / 英语 / 粤语
const REGIONS = ['na-west', 'na-central', 'na-east'];

// 订单状态
//   paid      买家已付款（钱由平台托管），等陪玩师接单
//   accepted  陪玩师已接单，双方加 Discord 开始玩
//   delivered 陪玩师标记"已完成"，等买家确认
//   completed 已完成，钱结算给陪玩师
//   disputed  买家申请售后，等后台处理
//   refunded  已退款（陪玩师拒绝 / 买家取消 / 超时 / 后台判退款）
const ACTIVE = ['paid', 'accepted', 'delivered', 'disputed'];

class HttpError extends Error {
  constructor(status, code, params) {
    super(msg(code, 'en', params));
    this.status = status;
    this.code = code;
    this.params = params;
  }
}
const fail = (status, code, params) => { throw new HttpError(status, code, params); };

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const normEmail = (v) => String(v || '').trim().toLowerCase();

function upgrade(db) {
  db.users = db.users || {};
  db.sessions = db.sessions || {};
  db.companions = db.companions || {};
  db.orders = db.orders || [];
  db.reports = db.reports || [];
  db.lastId = db.lastId || 0;
  // 旧版每款游戏只有一个段位（rank），新版可以多选（ranks）
  for (const c of Object.values(db.companions)) {
    for (const g of Object.values(c.games || {})) {
      if (!g.ranks) g.ranks = g.rank ? [g.rank] : [];
      delete g.rank;
    }
  }
  return db;
}

function createCore(opts) {
  const { save, hashPassword, verifyPassword, randomToken } = opts;
  const savePhoto = opts.savePhoto || ((p) => p);
  const now = opts.now || (() => Date.now());
  const feeRate = opts.feeRate ?? 0.15; // 平台抽成
  const admins = new Set((opts.admins || []).map((a) => String(a).trim().toLowerCase()).filter(Boolean));
  const db = upgrade(opts.db);
  const fails = new Map();

  const iso = (t = now()) => new Date(t).toISOString();
  const nextId = () => (db.lastId += 1);
  const users = () => Object.values(db.users);
  const isAdmin = (u) => !!u && admins.has(u.name);

  // ---------- 账号 ----------
  function account(u) {
    const c = db.companions[u.name];
    return {
      username: u.name,
      email: u.email,
      discord: u.discord || null,
      isAdmin: isAdmin(u),
      companionStatus: c ? c.status : null,
      createdAt: u.createdAt
    };
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
    const u = db.users[s.user];
    return u && !u.banned ? u : null;
  }

  function checkPassword(p) {
    if (typeof p !== 'string' || p.length < MIN_PASSWORD) fail(400, 'password_short', { n: MIN_PASSWORD });
    if (p.length > 200) fail(400, 'password_long');
  }

  function checkDiscord(v) {
    const d = String(v || '').trim().toLowerCase().replace(/^@/, '');
    if (!d) return null;
    if (!DISCORD_RE.test(d)) fail(400, 'bad_discord');
    return d;
  }

  async function signup(b) {
    const name = String(b.username || '').trim().toLowerCase();
    const email = normEmail(b.email);
    if (!NAME_RE.test(name)) fail(400, 'bad_username');
    if (db.users[name]) fail(409, 'username_taken');
    if (!(email.length <= 254 && EMAIL_RE.test(email))) fail(400, 'bad_email');
    if (users().some((u) => u.email === email)) fail(409, 'email_taken');
    checkPassword(b.password);
    // 生日（YYYY-MM-DD），按完整日期算年龄，必须满 18 岁
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.birthDate || ''));
    const born = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!born || born.getUTCMonth() !== +m[2] - 1 || born.getUTCDate() !== +m[3] || +m[1] < 1900 || born.getTime() > now()) fail(400, 'bad_birth_date');
    const today = new Date(now());
    let age = today.getUTCFullYear() - born.getUTCFullYear();
    if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age -= 1;
    if (age < MIN_AGE) fail(403, 'too_young', { n: MIN_AGE });
    if (b.agree !== true) fail(400, 'must_agree');
    const u = {
      name, email, pass: await hashPassword(b.password), birthDate: m[0],
      discord: null, banned: false, agreedAt: iso(), createdAt: iso()
    };
    db.users[name] = u;
    return startSession(u);
  }

  async function login(b) {
    const id = String(b.id || '').trim().toLowerCase();
    if (!id || !b.password) fail(400, 'login_missing');
    const lock = fails.get(id);
    if (lock && lock.until > now()) fail(429, 'login_locked', { m: Math.ceil((lock.until - now()) / 60000) });
    const u = db.users[id] || users().find((x) => x.email === id);
    const okPass = u && (await verifyPassword(String(b.password), u.pass));
    if (!okPass) {
      const f = fails.get(id) || { n: 0, until: 0 };
      f.n += 1;
      if (f.n >= MAX_FAILS) { f.n = 0; f.until = now() + LOCK_MS; }
      fails.set(id, f);
      fail(401, 'login_wrong');
    }
    if (u.banned) fail(403, 'banned');
    fails.delete(id);
    return startSession(u);
  }

  // ---------- 陪玩师 ----------
  function isOnline(c) {
    return !!c.online && now() - Date.parse(c.onlineAt) < ONLINE_MS;
  }

  function stats(name) {
    const done = db.orders.filter((o) => o.companion === name && o.status === 'completed');
    const reviews = done.filter((o) => o.review);
    const sum = reviews.reduce((a, o) => a + o.review.stars, 0);
    return {
      orders: done.length,
      reviews: reviews.length,
      rating: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : null
    };
  }

  const minPrice = (c) => Math.min(...Object.values(c.games).map((g) => g.price));

  function publicCompanion(c, full) {
    const out = {
      name: c.name,
      displayName: c.displayName,
      avatar: c.avatar,
      headline: c.headline,
      languages: c.languages,
      region: c.region,
      styles: c.styles,
      games: c.games,
      fromPrice: minPrice(c),
      online: isOnline(c),
      status: c.status,
      ...stats(c.name),
      createdAt: c.createdAt
    };
    if (full) {
      out.bio = c.bio;
      out.reviews = db.orders
        .filter((o) => o.companion === c.name && o.status === 'completed' && o.review)
        .sort((a, b) => b.review.at.localeCompare(a.review.at))
        .slice(0, 30)
        .map((o) => ({ by: o.buyer, game: o.game, stars: o.review.stars, text: o.review.text, at: o.review.at }));
    }
    return out;
  }

  async function saveCompanion(u, b) {
    const old = db.companions[u.name];
    if (old && old.status === 'suspended') fail(403, 'companion_suspended');

    const displayName = str(b.displayName, 24);
    if (!displayName) fail(400, 'need_display_name');
    const headline = str(b.headline, 60);
    const bio = str(b.bio, 1000);

    const games = {};
    for (const [key, g] of Object.entries(b.games || {})) {
      if (!GAMES[key] || !g) continue;
      // 可陪段位可以多选，按游戏里的段位顺序保存
      const picked = Array.isArray(g.ranks) ? g.ranks : [];
      const ranks = GAMES[key].ranks.filter((r) => picked.includes(r));
      if (!ranks.length || ranks.length !== new Set(picked).size) fail(400, 'bad_rank', { game: GAMES[key].name });
      const price = Math.round(Number(g.price));
      if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
        fail(400, 'bad_price', { min: MIN_PRICE / 100, max: MAX_PRICE / 100 });
      }
      games[key] = { ranks, price };
    }
    if (!Object.keys(games).length) fail(400, 'need_game');

    const languages = [...new Set((b.languages || []).filter((l) => LANGS.includes(l)))];
    if (!languages.length) fail(400, 'need_language');
    const styles = [...new Set((b.styles || []).filter((s) => STYLES.includes(s)))];
    if (!styles.length) fail(400, 'need_style');
    const region = REGIONS.includes(b.region) ? b.region : fail(400, 'bad_region');

    const discord = checkDiscord(b.discord);
    if (!discord) fail(400, 'need_discord');

    let avatar = old ? old.avatar : null;
    if (b.avatar && String(b.avatar).startsWith('data:')) avatar = await savePhoto(b.avatar);
    else if (b.avatar === null) avatar = null;

    u.discord = discord;
    const c = {
      name: u.name,
      // 新申请或被拒后重新提交 → 待审核；已通过的修改资料保持通过
      status: old && old.status === 'approved' ? 'approved' : 'pending',
      rejectReason: null,
      online: old ? old.online : false,
      onlineAt: old ? old.onlineAt : iso(),
      createdAt: old ? old.createdAt : iso(),
      displayName, headline, bio, games, languages, styles, region, avatar,
      updatedAt: iso()
    };
    db.companions[u.name] = c;
    save();
    return c;
  }

  // ---------- 订单 ----------
  // 每次处理请求前先把到期的订单推进一下（没有定时任务也能用）
  function tick() {
    let changed = false;
    const t = now();
    for (const o of db.orders) {
      if (o.status === 'paid' && t - Date.parse(o.createdAt) > ACCEPT_WINDOW_MS) {
        setStatus(o, 'refunded', 'system', 'expired');
        changed = true;
      } else if (o.status === 'delivered' && t - Date.parse(o.deliveredAt) > CONFIRM_WINDOW_MS) {
        setStatus(o, 'completed', 'system', 'auto_confirm');
        changed = true;
      }
    }
    if (changed) save();
  }

  function setStatus(o, status, by, reason) {
    o.status = status;
    o[status + 'At'] = iso();
    if (status === 'refunded') o.payment.status = 'refunded';
    if (status === 'completed') o.payment.status = 'released';
    o.history.push({ status, by, reason: reason || null, at: iso() });
    // 系统消息放进聊天里，双方都能看到进度
    o.messages.push({ id: nextId(), from: null, event: status, reason: reason || null, at: iso() });
  }

  function orderView(o, viewer) {
    const role = viewer.name === o.buyer ? 'buyer' : viewer.name === o.companion ? 'companion' : 'admin';
    const c = db.companions[o.companion];
    const buyer = db.users[o.buyer];
    // 接单后才互相显示 Discord
    const reveal = ['accepted', 'delivered', 'disputed'].includes(o.status) || role === 'admin';
    return {
      id: o.id,
      role,
      buyer: o.buyer,
      companion: o.companion,
      companionName: c ? c.displayName : o.companion,
      companionAvatar: c ? c.avatar : null,
      game: o.game,
      hours: o.hours,
      unitPrice: o.unitPrice,
      total: o.total,
      fee: role === 'buyer' ? undefined : o.fee,
      payout: role === 'buyer' ? undefined : o.payout,
      note: o.note,
      status: o.status,
      payment: { provider: o.payment.provider, status: o.payment.status },
      discord: reveal ? {
        companion: (db.users[o.companion] || {}).discord || null,
        buyer: (buyer || {}).discord || null
      } : null,
      review: o.review,
      dispute: o.dispute || null,
      messages: o.messages,
      history: o.history,
      createdAt: o.createdAt,
      acceptBy: o.status === 'paid' ? iso(Date.parse(o.createdAt) + ACCEPT_WINDOW_MS) : null,
      autoConfirmAt: o.status === 'delivered' ? iso(Date.parse(o.deliveredAt) + CONFIRM_WINDOW_MS) : null
    };
  }

  function createOrder(u, b) {
    const c = db.companions[String(b.companion || '').toLowerCase()];
    if (!c || c.status !== 'approved') fail(404, 'companion_not_found');
    if (c.name === u.name) fail(400, 'order_self');
    const game = c.games[b.game] ? b.game : fail(400, 'game_not_offered');
    const hours = Number(b.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) fail(400, 'bad_hours', { max: MAX_HOURS });
    const open = db.orders.filter((o) => o.buyer === u.name && o.companion === c.name && ['paid', 'accepted', 'delivered'].includes(o.status));
    if (open.length >= 2) fail(409, 'too_many_open');
    const unitPrice = c.games[game].price;
    const total = unitPrice * hours;
    const fee = Math.round(total * feeRate);
    const o = {
      id: nextId(), buyer: u.name, companion: c.name, game, hours,
      unitPrice, total, fee, payout: total - fee,
      note: str(b.note, 300),
      status: 'paid',
      // 第一版是"测试支付"：不扣真钱，流程和真支付一样（托管 → 结算 / 退款）
      payment: { provider: opts.paymentProvider || 'demo', status: 'held' },
      review: null, messages: [], history: [], createdAt: iso()
    };
    o.history.push({ status: 'paid', by: u.name, reason: null, at: iso() });
    o.messages.push({ id: nextId(), from: null, event: 'paid', reason: null, at: iso() });
    db.orders.push(o);
    save();
    return o;
  }

  function orderAction(o, u, action, b) {
    const isBuyer = u.name === o.buyer;
    const isComp = u.name === o.companion;
    const need = (cond) => { if (!cond) fail(403, 'not_allowed'); };
    const from = (...st) => { if (!st.includes(o.status)) fail(409, 'bad_state'); };

    switch (action) {
      case 'accept':
        need(isComp); from('paid');
        if (!u.discord) fail(400, 'need_discord');
        setStatus(o, 'accepted', u.name);
        break;
      case 'decline':
        need(isComp); from('paid');
        setStatus(o, 'refunded', u.name, 'declined');
        break;
      case 'cancel': // 买家在接单前可以随时取消，全额退款
        need(isBuyer); from('paid');
        setStatus(o, 'refunded', u.name, 'cancelled');
        break;
      case 'deliver':
        need(isComp); from('accepted');
        setStatus(o, 'delivered', u.name);
        break;
      case 'confirm':
        need(isBuyer); from('accepted', 'delivered');
        setStatus(o, 'completed', u.name);
        break;
      case 'dispute': {
        need(isBuyer); from('accepted', 'delivered');
        const reason = str(b.reason, 500);
        if (!reason) fail(400, 'need_reason');
        o.dispute = { reason, at: iso(), resolution: null };
        setStatus(o, 'disputed', u.name);
        break;
      }
      case 'review': {
        need(isBuyer); from('completed');
        if (o.review) fail(409, 'already_reviewed');
        const stars = Number(b.stars);
        if (![1, 2, 3, 4, 5].includes(stars)) fail(400, 'bad_stars');
        o.review = { stars, text: str(b.text, 500), at: iso() };
        break;
      }
      case 'messages': {
        need(isBuyer || isComp);
        if (!['paid', 'accepted', 'delivered', 'disputed'].includes(o.status)) fail(409, 'chat_closed');
        const text = str(b.text, 1000);
        if (!text) fail(400, 'empty_message');
        o.messages.push({ id: nextId(), from: u.name, text, at: iso() });
        if (o.messages.length > 500) o.messages.splice(0, o.messages.length - 500);
        break;
      }
      default:
        fail(404, 'not_found');
    }
    save();
  }

  function earnings(name) {
    const mine = db.orders.filter((o) => o.companion === name);
    const sum = (list) => list.reduce((a, o) => a + o.payout, 0);
    return {
      settled: sum(mine.filter((o) => o.status === 'completed')),
      pending: sum(mine.filter((o) => ['accepted', 'delivered', 'disputed'].includes(o.status)))
    };
  }

  // ---------- 路由 ----------
  async function handle(method, url, { token, body }) {
    tick();
    const u = new URL(url, 'http://x');
    const parts = u.pathname.split('/').filter(Boolean); // ['api', ...]
    const key = method + ' ' + u.pathname;
    const b = body || {};
    const me = userFromToken(token);
    const needUser = () => me || fail(401, 'login_required');
    const needAdmin = () => (isAdmin(needUser()) ? me : fail(403, 'not_allowed'));
    const ok = (data, status = 200) => ({ status, data });

    if (key === 'GET /api/config') {
      return ok({
        games: GAMES, styles: STYLES, languages: LANGS, regions: REGIONS,
        feeRate, minPrice: MIN_PRICE, maxPrice: MAX_PRICE, maxHours: MAX_HOURS, minAge: MIN_AGE,
        payment: opts.paymentProvider || 'demo'
      });
    }

    // ----- 登录 -----
    if (key === 'POST /api/auth/signup') return ok(await signup(b), 201);
    if (key === 'POST /api/auth/login') return ok(await login(b));
    if (key === 'POST /api/auth/logout') {
      if (token && db.sessions[token]) { delete db.sessions[token]; save(); }
      return ok({ ok: true });
    }

    if (key === 'GET /api/me') {
      const usr = needUser();
      const c = db.companions[usr.name];
      const mine = db.orders.filter((o) => o.buyer === usr.name || o.companion === usr.name);
      return ok({
        account: account(usr),
        companion: c ? { ...publicCompanion(c, true), discord: usr.discord, rejectReason: c.rejectReason, online: isOnline(c) } : null,
        earnings: c ? earnings(usr.name) : null,
        // 需要我处理的订单数（红点）
        todo: mine.filter((o) => (o.companion === usr.name && o.status === 'paid') || (o.buyer === usr.name && o.status === 'delivered')).length
      });
    }

    if (key === 'PATCH /api/account') {
      const usr = needUser();
      if ('discord' in b) usr.discord = checkDiscord(b.discord);
      save();
      return ok(account(usr));
    }

    // ----- 浏览陪玩师 -----
    if (key === 'GET /api/companions') {
      const q = u.searchParams;
      const game = q.get('game');
      const lang = q.get('lang');
      const style = q.get('style');
      const rank = q.get('rank');
      const max = Number(q.get('max')) || 0;
      const onlineOnly = q.get('online') === '1';
      let list = Object.values(db.companions).filter((c) => c.status === 'approved');
      if (game && GAMES[game]) list = list.filter((c) => c.games[game]);
      if (lang && LANGS.includes(lang)) list = list.filter((c) => c.languages.includes(lang));
      if (style && STYLES.includes(style)) list = list.filter((c) => c.styles.includes(style));
      // 按段位筛选（需要先选游戏）：只显示能陪这个段位的陪玩师
      if (rank && game && GAMES[game]) list = list.filter((c) => c.games[game].ranks.includes(rank));
      const priceOf = (c) => (game && c.games[game] ? c.games[game].price : minPrice(c));
      if (max) list = list.filter((c) => priceOf(c) <= max);
      let views = list.map((c) => publicCompanion(c));
      if (onlineOnly) views = views.filter((c) => c.online);
      const sort = q.get('sort') || 'recommended';
      const p = (c) => (game && c.games[game] ? c.games[game].price : c.fromPrice);
      const sorters = {
        price_asc: (a, b) => p(a) - p(b),
        price_desc: (a, b) => p(b) - p(a),
        rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviews - a.reviews,
        new: (a, b) => b.createdAt.localeCompare(a.createdAt),
        // 推荐：在线的在前，然后按评分和单数
        recommended: (a, b) => (b.online - a.online) || ((b.rating || 0) - (a.rating || 0)) || (b.orders - a.orders)
      };
      views.sort(sorters[sort] || sorters.recommended);
      return ok(views);
    }

    if (parts[1] === 'companions' && parts.length === 3 && method === 'GET') {
      const c = db.companions[decodeURIComponent(parts[2]).toLowerCase()];
      const visible = c && (c.status === 'approved' || (me && (me.name === c.name || isAdmin(me))));
      if (!visible) fail(404, 'companion_not_found');
      return ok(publicCompanion(c, true));
    }

    // ----- 我的陪玩师资料 -----
    if (key === 'PUT /api/companion') {
      const c = await saveCompanion(needUser(), b);
      return ok(publicCompanion(c, true));
    }

    if (key === 'POST /api/companion/online') {
      const usr = needUser();
      const c = db.companions[usr.name];
      if (!c || c.status !== 'approved') fail(403, 'not_approved');
      c.online = b.online === true;
      c.onlineAt = iso();
      save();
      return ok({ online: isOnline(c) });
    }

    // ----- 订单 -----
    if (key === 'POST /api/orders') return ok(orderView(createOrder(needUser(), b), me), 201);

    if (key === 'GET /api/orders') {
      const usr = needUser();
      const role = u.searchParams.get('role') === 'companion' ? 'companion' : 'buyer';
      const list = db.orders
        .filter((o) => o[role] === usr.name)
        .sort((a, b) => (ACTIVE.includes(b.status) - ACTIVE.includes(a.status)) || b.createdAt.localeCompare(a.createdAt))
        .map((o) => { const v = orderView(o, usr); delete v.messages; delete v.history; return v; });
      return ok(list);
    }

    if (parts[1] === 'orders' && parts.length >= 3) {
      const usr = needUser();
      const o = db.orders.find((x) => x.id === Number(parts[2]));
      if (!o || (o.buyer !== usr.name && o.companion !== usr.name && !isAdmin(usr))) fail(404, 'order_not_found');
      if (method === 'GET' && parts.length === 3) return ok(orderView(o, usr));
      if (method === 'POST' && parts.length === 4) {
        orderAction(o, usr, parts[3], b);
        return ok(orderView(o, usr));
      }
      fail(404, 'not_found');
    }

    // ----- 举报 -----
    if (key === 'POST /api/reports') {
      const usr = needUser();
      const target = String(b.target || '').toLowerCase();
      if (!db.users[target] || target === usr.name) fail(400, 'bad_report_target');
      const reason = str(b.reason, 500);
      if (!reason) fail(400, 'need_reason');
      const orderId = b.orderId ? Number(b.orderId) : null;
      db.reports.push({ id: nextId(), from: usr.name, target, orderId, reason, status: 'open', at: iso() });
      save();
      return ok({ ok: true }, 201);
    }

    // ----- 后台 -----
    if (key === 'GET /api/admin/overview') {
      needAdmin();
      const all = Object.values(db.companions);
      return ok({
        pending: all.filter((c) => c.status === 'pending').map((c) => ({ ...publicCompanion(c, true), discord: (db.users[c.name] || {}).discord })),
        companions: all.filter((c) => c.status !== 'pending').map((c) => publicCompanion(c)),
        disputes: db.orders.filter((o) => o.status === 'disputed').map((o) => orderView(o, me)),
        reports: db.reports.filter((r) => r.status === 'open'),
        totals: {
          users: users().length,
          orders: db.orders.length,
          gmv: db.orders.filter((o) => o.status === 'completed').reduce((a, o) => a + o.total, 0),
          revenue: db.orders.filter((o) => o.status === 'completed').reduce((a, o) => a + o.fee, 0)
        }
      });
    }

    if (parts[1] === 'admin' && parts[2] === 'companions' && parts.length === 4 && method === 'POST') {
      needAdmin();
      const c = db.companions[decodeURIComponent(parts[3])];
      if (!c) fail(404, 'companion_not_found');
      const actions = { approve: 'approved', reject: 'rejected', suspend: 'suspended', restore: 'approved' };
      if (!actions[b.action]) fail(400, 'bad_action');
      c.status = actions[b.action];
      c.rejectReason = b.action === 'reject' || b.action === 'suspend' ? str(b.reason, 300) || null : null;
      if (c.status !== 'approved') c.online = false;
      save();
      return ok(publicCompanion(c, true));
    }

    if (parts[1] === 'admin' && parts[2] === 'orders' && parts[4] === 'resolve' && method === 'POST') {
      needAdmin();
      const o = db.orders.find((x) => x.id === Number(parts[3]));
      if (!o) fail(404, 'order_not_found');
      if (o.status !== 'disputed') fail(409, 'bad_state');
      if (!['refund', 'release'].includes(b.outcome)) fail(400, 'bad_action');
      o.dispute.resolution = { outcome: b.outcome, note: str(b.note, 300), by: me.name, at: iso() };
      setStatus(o, b.outcome === 'refund' ? 'refunded' : 'completed', me.name, 'admin_' + b.outcome);
      save();
      return ok(orderView(o, me));
    }

    if (parts[1] === 'admin' && parts[2] === 'reports' && parts[4] === 'close' && method === 'POST') {
      needAdmin();
      const r = db.reports.find((x) => x.id === Number(parts[3]));
      if (!r) fail(404, 'not_found');
      r.status = 'closed';
      r.closedBy = me.name;
      if (b.ban === true && db.users[r.target] && !isAdmin(db.users[r.target])) {
        db.users[r.target].banned = true;
        const c = db.companions[r.target];
        if (c) { c.status = 'suspended'; c.online = false; }
        for (const [t, s] of Object.entries(db.sessions)) if (s.user === r.target) delete db.sessions[t];
      }
      save();
      return ok({ ok: true });
    }

    fail(404, 'not_found');
  }

  return { handle, userFromToken, account };
}

module.exports = { createCore, HttpError, GAMES, STYLES, LANGS, REGIONS, ACCEPT_WINDOW_MS, CONFIRM_WINDOW_MS };
