// trove 前端：一个不依赖框架的单页应用。
(() => {
  'use strict';

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  // 有些环境（比如嵌在别的页面里）不允许用 localStorage，出错时就当没有
  const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  let pushed = false; // 打开详情时是否往浏览器历史里加了一条

  const state = {
    token: storage.get('trove.token') || '',
    account: null, // 登录后的账号信息
    config: { google: false },
    // 未登录时的页面
    auth: 'welcome', // welcome | signup | login
    authMethod: 'email', // email | phone
    authForm: { username: '', email: '', phone: '', id: '', password: '' },
    authError: '',
    showPassword: false,
    // 登录后的页面
    tab: 'home', // home | search | post | me | account
    filter: 'all',
    query: '',
    notes: [],
    me: null,
    unread: 0, // 未读通知数
    inbox: null, // 通知列表
    detail: null,
    replyTo: null, // { id, author } 正在回复的评论
    askText: '',
    draft: emptyDraft(),
    sheet: null, // 账号设置里弹出的面板：email | phone | password | google-off
    sheetForm: {},
    sheetError: '',
    busy: false
  };

  function emptyDraft() {
    return { title: '', body: '', worth: null, place: '', price: '', photos: [] };
  }

  // ---------- 小工具 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tint = (n) => `var(--t${(n.tint ?? 0) % 6})`;
  const nameTint = (name) => `var(--t${[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6})`;
  const bgStyle = (n) => n.photos && n.photos.length
    ? `background-color:${tint(n)};background-image:url('${esc(n.photos[0])}')`
    : `background-color:${tint(n)}`;
  const heights = [220, 210, 170, 230, 190, 200, 160];
  const verdictLabel = (n) => n.worth === true ? 'Worth it' : n.worth === false ? 'Not worth it' : '';
  const meta = (n) => [n.price, n.place].filter(Boolean).join(' · ');
  const me = () => (state.account ? state.account.username : '');
  const ago = (iso) => {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  };

  const icon = {
    check: (s = 12, w = 3) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>`,
    x: (s = 12, w = 3) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    up: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
    heart: (fill = 'currentColor', s = 12) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg>`,
    bookmark: (fill) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>`,
    search: (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${s < 24 ? 2 : 1.8}" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`,
    plus: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    user: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
    back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
    send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
    chevron: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
    gear: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
    mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
    phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`,
    lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    eye: (open) => open
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
    reply: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>`,
    google: `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`
  };

  let toastTimer;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2400);
  }

  async function api(path, opts = {}) {
    const method = opts.method || 'GET';
    let data;
    try {
      if (window.TROVE_LOCAL_API) {
        // 演示版：没有服务器，交给浏览器里的本地后端处理
        data = await window.TROVE_LOCAL_API(path, { method, token: state.token, body: opts.body });
      } else {
        const res = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
          body: opts.body ? JSON.stringify(opts.body) : undefined
        });
        data = await res.json().catch(() => ({}));
        if (!res.ok) { const e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
      }
    } catch (e) {
      // 登录过期：回到登录页
      if (e.status === 401 && state.token && !opts.noLogout) {
        signedOut('Please log in again');
      }
      throw e;
    }
    return data;
  }

  // ---------- 登录状态 ----------
  function signedIn(r) {
    state.token = r.token;
    state.account = r.account;
    storage.set('trove.token', r.token);
    state.authForm = { username: '', email: '', phone: '', id: '', password: '' };
    state.authError = '';
    state.showPassword = false;
    state.draft = emptyDraft();
    state.filter = 'all';
    go('home');
  }

  function signedOut(message) {
    state.token = '';
    state.account = null;
    state.me = null;
    state.detail = null;
    state.sheet = null;
    storage.remove('trove.token');
    state.auth = message ? 'login' : 'welcome';
    state.authError = message || '';
    render();
  }

  async function startGoogle(mode) {
    if (!state.config.google) {
      const msg = window.TROVE_LOCAL_API
        ? 'Google sign-in needs the server version. In this demo, use email or phone.'
        : 'Google sign-in is not set up on this server yet. Use email or phone for now.';
      if (mode === 'link') toast(msg); else { state.authError = msg; render(); }
      return;
    }
    try {
      const r = await api('/api/auth/google/start', { method: 'POST', body: { mode } });
      window.location.href = r.url;
    } catch (e) { toast(e.message); }
  }

  // ---------- 数据 ----------
  async function loadNotes() {
    const p = new URLSearchParams();
    if (state.tab === 'home' && state.filter !== 'all') p.set('filter', state.filter);
    if (state.tab === 'search' && state.query.trim()) p.set('q', state.query.trim());
    state.notes = await api('/api/notes?' + p);
  }

  async function loadMe() {
    state.me = await api('/api/me');
    state.account = state.me.account;
  }

  // 用服务器返回的新数据替换本地缓存里的同一条帖子
  function replaceNote(n) {
    state.notes = state.notes.map((x) => (x.id === n.id ? n : x));
    if (state.detail && state.detail.id === n.id) state.detail = n;
    if (state.me) {
      state.me.saved = n.saved
        ? (state.me.saved.some((x) => x.id === n.id) ? state.me.saved.map((x) => (x.id === n.id ? n : x)) : [n, ...state.me.saved])
        : state.me.saved.filter((x) => x.id !== n.id);
      state.me.mine = state.me.mine.map((x) => (x.id === n.id ? n : x));
    }
  }

  // ---------- 未登录：欢迎 / 注册 / 登录 ----------
  const googleBtn = (label) => `<button type="button" class="btn-social" data-google="login">${icon.google}${label}</button>`;
  const errBox = (msg) => `<div class="err" role="alert">${esc(msg)}</div>`;

  function passwordField(name, label, autocomplete, value) {
    return `<label class="field">${label}
      <span class="pw">
        <input type="${state.showPassword ? 'text' : 'password'}" data-af="${name}" value="${esc(value)}" autocomplete="${autocomplete}" maxlength="200" required>
        <button type="button" class="pw-eye" data-toggle-pw aria-label="${state.showPassword ? 'Hide password' : 'Show password'}">${icon.eye(!state.showPassword)}</button>
      </span>
    </label>`;
  }

  function viewWelcome() {
    return `<main class="auth">
      <div class="auth-hero">
        <div class="auth-logo">trove</div>
        <p>Campus notes with a verdict. Share a find, say if it was worth it, and see if people agree.</p>
      </div>
      <div class="auth-actions">
        ${googleBtn('Continue with Google')}
        <button type="button" class="btn-social" data-auth-go="signup" data-method="email">${icon.mail}Sign up with email</button>
        <button type="button" class="btn-social" data-auth-go="signup" data-method="phone">${icon.phone}Sign up with phone</button>
        ${state.authError ? errBox(state.authError) : ''}
        <p class="auth-switch">Already have an account? <button type="button" class="link" data-auth-go="login">Log in</button></p>
      </div>
    </main>`;
  }

  function viewSignup() {
    const f = state.authForm;
    const isEmail = state.authMethod === 'email';
    return `<form class="auth" data-form="signup" novalidate>
      <button type="button" class="back-plain" data-auth-go="welcome" aria-label="Back">${icon.back}</button>
      <h1 class="auth-title">Create your account</h1>
      <div class="seg" role="group" aria-label="Sign up with">
        <button type="button" data-method="email" aria-pressed="${isEmail}">Email</button>
        <button type="button" data-method="phone" aria-pressed="${!isEmail}">Phone</button>
      </div>
      <label class="field">Username
        <span class="at"><span aria-hidden="true">@</span><input data-af="username" value="${esc(f.username)}" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="your.name" required></span>
        <span class="hint">2–20 characters: lowercase letters, numbers, . or _</span>
      </label>
      ${isEmail
        ? `<label class="field">Email<input type="email" data-af="email" value="${esc(f.email)}" autocomplete="email" autocapitalize="none" placeholder="e.g. you@illinois.edu" required></label>`
        : `<label class="field">Phone number<input type="tel" data-af="phone" value="${esc(f.phone)}" autocomplete="tel" placeholder="e.g. +1 217 555 0123" required></label>`}
      ${passwordField('password', 'Password', 'new-password', f.password)}
      <span class="hint" style="margin-top:-14px">At least 8 characters</span>
      ${state.authError ? errBox(state.authError) : ''}
      <button type="submit" class="btn-big" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Creating…' : 'Create account'}</button>
      <div class="or"><span>or</span></div>
      ${googleBtn('Continue with Google')}
      <p class="auth-switch">Already have an account? <button type="button" class="link" data-auth-go="login">Log in</button></p>
    </form>`;
  }

  function viewLogin() {
    const f = state.authForm;
    return `<form class="auth" data-form="login" novalidate>
      <button type="button" class="back-plain" data-auth-go="welcome" aria-label="Back">${icon.back}</button>
      <h1 class="auth-title">Welcome back</h1>
      <label class="field">Email, phone or username
        <input data-af="id" value="${esc(f.id)}" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@illinois.edu" required>
      </label>
      ${passwordField('password', 'Password', 'current-password', f.password)}
      ${state.authError ? errBox(state.authError) : ''}
      <button type="submit" class="btn-big" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Logging in…' : 'Log in'}</button>
      <div class="or"><span>or</span></div>
      ${googleBtn('Continue with Google')}
      <p class="auth-switch">New to trove? <button type="button" class="link" data-auth-go="signup">Create an account</button></p>
    </form>`;
  }

  // ---------- 首页 ----------
  function card(n, i) {
    const has = n.worth !== null;
    const h = n.photos.length ? heights[i % heights.length] + 20 : heights[n.id % heights.length];
    return `<div class="card">
      <button class="card-open" data-open="${n.id}" aria-label="${esc(n.title)}">
        <div class="thumb" style="height:${h}px;${bgStyle(n)}">
          ${has ? `<span class="pill ${n.worth ? 'yes' : 'no'}">${n.worth ? icon.check() : icon.x()}${verdictLabel(n)}</span>` : ''}
        </div>
        <div class="card-title">${esc(n.title)}</div>
        ${meta(n) ? `<div class="card-meta">${esc(meta(n))}</div>` : ''}
      </button>
      <div class="card-foot">
        <span class="who"><span class="dot" style="background:${nameTint(n.author)}"></span>${esc(n.author)}</span>
        ${has
          ? `<button class="chip-btn" data-agree="${n.id}" aria-pressed="${n.myVote === 1}" aria-label="Agree with this verdict">${icon.up}${n.agree}</button>`
          : `<button class="chip-btn" data-like="${n.id}" aria-pressed="${n.liked}" aria-label="Like this note">${icon.heart()}${n.likes}</button>`}
      </div>
    </div>`;
  }

  function viewHome() {
    const f = [['all', 'All'], ['yes', 'Worth it'], ['no', 'Not worth it']];
    const left = state.notes.filter((_, i) => i % 2 === 0);
    const right = state.notes.filter((_, i) => i % 2 === 1);
    return `<main class="screen">
      <div class="top"><div class="logo">trove</div><div class="sub" style="font-size:13px">Champaign, IL</div></div>
      <div class="seg" role="group" aria-label="Filter notes">
        ${f.map(([k, l]) => `<button data-filter="${k}" aria-pressed="${state.filter === k}">${l}</button>`).join('')}
      </div>
      ${state.notes.length
        ? `<div class="feed"><div class="col">${left.map((n, i) => card(n, i * 2)).join('')}</div><div class="col">${right.map((n, i) => card(n, i * 2 + 1)).join('')}</div></div>`
        : `<div class="empty">${state.filter === 'all' ? 'No notes yet. Tap + to post the first one, and invite friends to join.' : 'No notes with this verdict yet.'}</div>`}
    </main>`;
  }

  // ---------- 搜索 ----------
  function resultRows() {
    if (!state.notes.length) return `<div class="empty">${state.query.trim() ? 'Nothing matches yet. Try another word, or post the first note about it.' : 'No notes yet. Tap + to post the first one.'}</div>`;
    return state.notes.map((n) => {
      const m = n.worth !== null ? `${verdictLabel(n)} · ${n.pct}% agree` : `Shared${n.place ? ' · ' + esc(n.place) : ''}`;
      return `<button class="row" data-open="${n.id}">
        <div class="row-thumb" style="${bgStyle(n)}"></div>
        <div style="min-width:0"><div class="row-title">${esc(n.title)}</div><div class="row-meta">${m}</div></div>
      </button>`;
    }).join('');
  }

  function viewSearch() {
    const chips = { Dorm: 'dorm', Food: 'food', Travel: 'travel', Winter: 'winter', Shopping: 'shop' };
    return `<main class="screen">
      <label class="search">${icon.search(18)}
        <input type="search" data-input="query" value="${esc(state.query)}" aria-label="Search notes" placeholder="Is it worth it?">
      </label>
      <div class="chips">${Object.entries(chips).map(([l, q]) => `<button data-chip="${esc(q)}">${l}</button>`).join('')}</div>
      <div class="label-caps" data-results-label>${state.query.trim() ? 'Results' : 'Latest'}</div>
      <div data-results>${resultRows()}</div>
    </main>`;
  }

  // ---------- 发帖 ----------
  function viewPost() {
    const d = state.draft;
    return `<form class="screen post" data-form="post" style="padding-bottom:32px">
      <div class="post-head">
        <button type="button" class="btn-text" data-cancel>Cancel</button>
        <h1>New note</h1>
        <button type="submit" class="btn-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Posting…' : 'Post'}</button>
      </div>
      <div class="photos">
        ${d.photos.map((p, i) => `<div class="photo" style="background-image:url('${p}')"><button type="button" data-rm-photo="${i}" aria-label="Remove photo">${icon.x(14, 2.4)}</button></div>`).join('')}
        ${d.photos.length < 4 ? `<label class="photo-add" style="cursor:pointer;position:relative">${icon.plus(24)}Photos
          <input type="file" accept="image/*" multiple data-photos style="position:absolute;width:1px;height:1px;opacity:0"></label>` : ''}
      </div>
      <label class="field">Title
        <input class="big" data-draft="title" value="${esc(d.title)}" maxlength="120" placeholder="What do you want to share?">
      </label>
      <label class="field">Your story
        <textarea rows="5" data-draft="body" maxlength="5000" placeholder="A moment, a find, a tip. Anything worth sharing.">${esc(d.body)}</textarea>
      </label>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="sub" style="font-size:13px">Add a verdict <span style="opacity:.8">· optional</span></div>
        <div class="two" role="group" aria-label="Your verdict">
          <button type="button" class="verdict-btn" data-worth="yes" aria-pressed="${d.worth === true}">${icon.check(16, 2.6)}Worth it</button>
          <button type="button" class="verdict-btn" data-worth="no" aria-pressed="${d.worth === false}">${icon.x(16, 2.6)}Not worth it</button>
        </div>
      </div>
      <div class="two wide">
        <label class="field">Place · optional<input data-draft="place" value="${esc(d.place)}" maxlength="80" placeholder="Where?"></label>
        <label class="field">Price · optional<input data-draft="price" value="${esc(d.price)}" maxlength="20" placeholder="$" inputmode="decimal"></label>
      </div>
    </form>`;
  }

  // ---------- 我的 ----------
  function miniGrid(list, emptyText) {
    if (!list.length) return `<div class="empty" style="padding:16px 0 28px">${emptyText}</div>`;
    return `<div class="grid2">${list.map((n) => `<button class="card-open" data-open="${n.id}">
      <div class="thumb" style="${bgStyle(n)}"></div>
      <div class="card-title">${esc(n.title)}</div>
      ${meta(n) ? `<div class="card-meta">${esc(meta(n))}</div>` : ''}
    </button>`).join('')}</div>`;
  }

  function viewMe() {
    const m = state.me || { saved: [], mine: [], following: [] };
    return `<main class="screen">
      <div class="me-top"><button class="icon-btn" data-tab="account" aria-label="Account settings">${icon.gear}</button></div>
      <div class="profile">
        <div class="avatar" style="background:${nameTint(me())}">${esc(me()[0].toUpperCase())}</div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
          <div style="font-size:22px;font-weight:700">@${esc(me())}</div>
          <div class="sub" style="font-size:14px">${m.mine.length} notes · following ${m.following.length}</div>
        </div>
      </div>
      <div class="links">
        <button class="row-link" data-tab="inbox">${icon.bell}<span>Notifications</span>
          ${state.unread ? `<span class="count" aria-label="${state.unread} unread">${state.unread}</span>` : '<span class="sub">All caught up</span>'}${icon.chevron}</button>
        <button class="row-link" data-tab="account">${icon.lock}<span>Account &amp; sign-in</span><span class="sub">${linkedSummary()}</span>${icon.chevron}</button>
      </div>
      <div class="label-caps" style="margin-top:24px">Saved · ${m.saved.length}</div>
      ${miniGrid(m.saved, 'Tap the bookmark on any note to keep it here.')}
      <div class="label-caps">My notes · ${m.mine.length}</div>
      ${miniGrid(m.mine, 'You have not posted yet.')}
    </main>`;
  }

  function linkedSummary() {
    const a = state.account;
    if (!a) return '';
    return [a.email && 'Email', a.phone && 'Phone', a.google && 'Google'].filter(Boolean).join(' · ');
  }

  // ---------- 通知 ----------
  function viewInbox() {
    const items = state.inbox ? state.inbox.items : null;
    const line = (n) => n.kind === 'reply'
      ? `<b>${esc(n.from)}</b> replied to your comment`
      : `<b>${esc(n.from)}</b> commented on your note`;
    return `<main class="screen">
      <div class="bar-head">
        <button class="icon-btn" data-tab="me" aria-label="Back">${icon.back}</button>
        <h1>Notifications</h1>
        <span style="width:44px"></span>
      </div>
      ${!items ? '<div class="empty">Loading…</div>'
        : !items.length ? '<div class="empty">No notifications yet. When someone replies to your comment or asks about your note, it shows up here.</div>'
        : `<div class="inbox">${items.map((n) => `<button class="notif${n.unread ? ' unread' : ''}" data-notif="${n.noteId}" data-comment="${n.id}">
            <span class="dot" style="background:${nameTint(n.from)};width:36px;height:36px"></span>
            <span class="notif-main">
              <span class="notif-line">${line(n)}<span class="sub"> · ${ago(n.createdAt)}</span></span>
              <span class="notif-text">${esc(n.text)}</span>
              ${n.yourText ? `<span class="notif-quote">You: ${esc(n.yourText)}</span>` : ''}
              <span class="notif-note">${esc(n.noteTitle)}</span>
            </span>
            <span class="notif-thumb" style="${bgStyle({ tint: n.tint, photos: n.photo ? [n.photo] : [] })}"></span>
            ${n.unread ? '<span class="unread-dot" aria-label="Unread"></span>' : ''}
          </button>`).join('')}</div>`}
    </main>`;
  }

  // 后台刷新未读数，用来显示红点
  async function refreshUnread() {
    try {
      const r = await api('/api/notifications/count');
      if (r.unread !== state.unread) { state.unread = r.unread; render(); }
    } catch (e) { /* 不影响使用 */ }
  }

  // ---------- 账号设置 ----------
  function viewAccount() {
    const a = state.account;
    const row = (ic, label, value, btn, attr) => `<div class="acct-row">
      <span class="acct-icon">${ic}</span>
      <span class="acct-text"><span>${label}</span><span class="sub">${value}</span></span>
      <button class="btn-outline small" ${attr}>${btn}</button>
    </div>`;
    return `<main class="screen">
      <div class="bar-head">
        <button class="icon-btn" data-tab="me" aria-label="Back">${icon.back}</button>
        <h1>Account</h1>
        <span style="width:44px"></span>
      </div>
      <div class="acct-card">
        <div class="avatar" style="width:56px;height:56px;font-size:22px;background:${nameTint(a.username)}">${esc(a.username[0].toUpperCase())}</div>
        <div><div style="font-size:18px;font-weight:700">@${esc(a.username)}</div>
        <div class="sub" style="font-size:13px">Member since ${new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div></div>
      </div>
      <div class="label-caps">Sign-in methods</div>
      <div class="acct-list">
        ${row(icon.mail, 'Email', a.email ? esc(a.email) : 'Not added', a.email ? 'Change' : 'Add', 'data-sheet="email"')}
        ${row(icon.phone, 'Phone', a.phone ? esc(a.phone) : 'Not added', a.phone ? 'Change' : 'Add', 'data-sheet="phone"')}
        ${row(icon.google, 'Google', a.google ? esc(a.google.email) : 'Not connected', a.google ? 'Disconnect' : 'Connect', a.google ? 'data-sheet="google-off"' : 'data-google="link"')}
        ${row(icon.lock, 'Password', a.hasPassword ? '••••••••' : 'Not set', a.hasPassword ? 'Change' : 'Set', 'data-sheet="password"')}
      </div>
      <p class="sub" style="font-size:13px;line-height:1.5;margin:12px 0 28px">You can log in with your email, phone number or username, plus your password${a.google ? ', or with Google' : ''}.</p>
      <button class="btn-big danger-outline" data-logout>Log out</button>
      ${window.TROVE_LOCAL_RESET ? `<button class="btn-big ghost" data-reset style="margin-top:10px">Reset demo</button>
        <p class="sub" style="font-size:13px;margin-top:12px">Demo version: everything you post stays on this device only.</p>` : ''}
    </main>`;
  }

  function viewSheet() {
    const s = state.sheet;
    const a = state.account;
    const f = state.sheetForm;
    const current = a.hasPassword
      ? `<label class="field">Current password<input type="password" data-sf="currentPassword" value="${esc(f.currentPassword || '')}" autocomplete="current-password" required></label>`
      : '';
    let title, body, submit = 'Save', extra = '';
    if (s === 'email') {
      title = a.email ? 'Change email' : 'Add email';
      body = `<label class="field">Email<input type="email" data-sf="email" value="${esc(f.email ?? a.email ?? '')}" autocomplete="email" autocapitalize="none" placeholder="you@illinois.edu"></label>${current}`;
      if (a.email) extra = `<button type="button" class="btn-big ghost" data-sheet-remove="email">Remove email</button>`;
    } else if (s === 'phone') {
      title = a.phone ? 'Change phone' : 'Add phone';
      body = `<label class="field">Phone number<input type="tel" data-sf="phone" value="${esc(f.phone ?? a.phone ?? '')}" autocomplete="tel" placeholder="+1 217 555 0123"></label>${current}`;
      if (a.phone) extra = `<button type="button" class="btn-big ghost" data-sheet-remove="phone">Remove phone</button>`;
    } else if (s === 'password') {
      title = a.hasPassword ? 'Change password' : 'Set a password';
      body = `${current}<label class="field">New password<input type="password" data-sf="newPassword" value="${esc(f.newPassword || '')}" autocomplete="new-password" required><span class="hint">At least 8 characters. Other devices will be logged out.</span></label>`;
    } else if (s === 'google-off') {
      title = 'Disconnect Google?';
      body = `<p class="sub" style="margin:0;line-height:1.5">You will no longer be able to log in with ${esc(a.google.email)}. ${a.hasPassword ? 'You can still log in with your password.' : 'Set a password first so you can still log in.'}</p>`;
      submit = 'Disconnect';
    }
    return `<div class="sheet-wrap" data-sheet-close>
      <form class="sheet" data-form="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate>
        <div class="sheet-grip" aria-hidden="true"></div>
        <h2>${esc(title)}</h2>
        ${body}
        ${state.sheetError ? errBox(state.sheetError) : ''}
        <button type="submit" class="btn-big" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Saving…' : submit}</button>
        ${extra}
        <button type="button" class="btn-big ghost" data-sheet-cancel>Cancel</button>
      </form>
    </div>`;
  }

  // ---------- 帖子详情 + 评论回复 ----------
  // 把评论整理成"楼"：每条顶层评论下面跟着它的所有回复（按时间）
  function threads(questions) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const rootOf = (q) => { let r = q; const seen = new Set(); while (r.replyTo && byId.has(r.replyTo) && !seen.has(r.id)) { seen.add(r.id); r = byId.get(r.replyTo); } return r; };
    const roots = questions.filter((q) => !q.replyTo || !byId.has(q.replyTo));
    return roots.map((root) => ({
      root,
      replies: questions.filter((q) => q !== root && rootOf(q) === root).map((q) => ({ ...q, parent: byId.get(q.replyTo) }))
    }));
  }

  function comment(q, isReply) {
    const active = state.replyTo && state.replyTo.id === q.id;
    const to = isReply && q.parent && q.parent.replyTo ? `<span class="to">@${esc(q.parent.author)}</span> ` : '';
    return `<button class="cmt${isReply ? ' reply' : ''}${active ? ' active' : ''}" data-reply="${q.id}" data-reply-author="${esc(q.author)}" aria-label="Reply to ${esc(q.author)}">
      <span class="dot" style="background:${nameTint(q.author)};width:${isReply ? 24 : 28}px;height:${isReply ? 24 : 28}px"></span>
      <span class="cmt-main">
        <span class="cmt-head"><b>${esc(q.author)}</b>${q.isAuthor ? '<span class="badge">Author</span>' : ''}<span class="sub">${ago(q.createdAt)}</span></span>
        <span class="cmt-text">${to}${esc(q.text)}</span>
        <span class="cmt-reply">${icon.reply}Reply</span>
      </span>
    </button>`;
  }

  function viewDetail() {
    const n = state.detail;
    const has = n.worth !== null;
    const mine = n.author === me();
    const hero = n.photos.length > 1
      ? `<div class="hero-strip">${n.photos.map((p) => `<div style="background-image:url('${esc(p)}')" role="img" aria-label="Photo"></div>`).join('')}</div>`
      : '';
    const th = threads(n.questions);
    const placeholder = state.replyTo ? `Reply to @${state.replyTo.author}…` : mine ? 'Add a comment…' : 'Ask the author…';
    return `<div class="detail" role="dialog" aria-modal="true" aria-label="${esc(n.title)}">
      <div class="detail-inner">
        <div class="hero" style="${n.photos.length > 1 ? `background:${tint(n)}` : bgStyle(n)}">
          ${hero}
          <button class="back" data-close aria-label="Back">${icon.back}</button>
        </div>
        <div class="detail-body">
          <div class="author-row">
            <span class="who"><span class="dot" style="background:${nameTint(n.author)}"></span>${esc(n.author)}</span>
            ${mine ? '' : `<button class="btn-outline" data-follow="${esc(n.author)}" aria-pressed="${n.following}">${n.following ? 'Following' : 'Follow'}</button>`}
          </div>
          <h2 class="d-title">${esc(n.title)}</h2>
          ${has ? `<div class="verdict-box"><span class="pill ${n.worth ? 'yes' : 'no'}">${verdictLabel(n)}</span><span style="font-size:15px;font-weight:600">${esc(meta(n))}</span></div>`
            : n.place ? `<div class="place">${icon.pin}${esc(n.place)}</div>` : ''}
          ${n.body ? `<div class="d-text">${esc(n.body)}</div>` : ''}
          ${has ? `<div class="agree-box">
            <div style="font-size:15px;font-weight:600">Do you agree?</div>
            <div class="bar"><div style="width:${n.pct}%"></div></div>
            <div class="sub" style="font-size:13px">${n.total ? `${n.pct}% of ${n.total} people agree` : 'No votes yet'}</div>
            <div class="two">
              <button class="vote-btn" data-vote="1" aria-pressed="${n.myVote === 1}">Agree</button>
              <button class="vote-btn" data-vote="-1" aria-pressed="${n.myVote === -1}">Disagree</button>
            </div>
          </div>` : ''}
          <div>
            <div class="cmt-title">
              <span class="label-caps">Questions &amp; answers · ${n.questions.length}</span>
              ${n.questions.length ? '<span class="sub" style="font-size:12px">Tap a comment to reply</span>' : ''}
            </div>
            ${th.length
              ? th.map((t) => `<div class="thread">${comment(t.root, false)}${t.replies.map((r) => comment(r, true)).join('')}</div>`).join('')
              : `<div class="sub" style="font-size:14px;padding:12px 0">${mine ? 'No questions yet. People can ask you about this below.' : `No questions yet. Ask ${esc(n.author)} below.`}</div>`}
          </div>
        </div>
      </div>
      <div class="ask">
        ${state.replyTo ? `<div class="replying"><span>Replying to <b>@${esc(state.replyTo.author)}</b></span><button type="button" class="icon-btn" data-cancel-reply aria-label="Cancel reply">${icon.x(14, 2.4)}</button></div>` : ''}
        <form data-form="ask">
          <label><input name="q" data-ask value="${esc(state.askText)}" aria-label="${esc(placeholder)}" maxlength="500" placeholder="${esc(placeholder)}" autocomplete="off"></label>
          <button type="submit" class="icon-btn" aria-label="Send">${icon.send}</button>
          <button type="button" class="icon-btn" data-like-detail aria-label="Like" aria-pressed="${n.liked}">${icon.heart(n.liked ? 'currentColor' : 'none', 23)}</button>
          <button type="button" class="icon-btn" data-save aria-label="Save" aria-pressed="${n.saved}">${icon.bookmark(n.saved ? 'currentColor' : 'none')}</button>
        </form>
      </div>
    </div>`;
  }

  function viewTabs() {
    const cur = state.tab === 'account' || state.tab === 'inbox' ? 'me' : state.tab;
    const t = (k, label, svg, dot) => `<button data-tab="${k}" aria-label="${label}${dot ? ', new notifications' : ''}" ${cur === k ? 'aria-current="page"' : ''}>${svg}${dot ? '<span class="tab-dot"></span>' : ''}</button>`;
    return `<div class="tabs"><nav aria-label="Main">
      ${t('home', 'Home', icon.home)}
      ${t('search', 'Search', icon.search())}
      <button class="new" data-tab="post" aria-label="New note">${icon.plus()}</button>
      ${t('me', 'Profile', icon.user, state.unread > 0)}
    </nav></div>`;
  }

  function render() {
    if (!state.account) {
      $app.innerHTML = { welcome: viewWelcome, signup: viewSignup, login: viewLogin }[state.auth]();
      document.body.style.overflow = '';
      return;
    }
    const screen = { home: viewHome, search: viewSearch, post: viewPost, me: viewMe, account: viewAccount, inbox: viewInbox }[state.tab]();
    $app.innerHTML = screen
      + (state.tab !== 'post' ? viewTabs() : '')
      + (state.detail ? viewDetail() : '')
      + (state.sheet ? viewSheet() : '');
    document.body.style.overflow = state.detail || state.sheet ? 'hidden' : '';
  }

  // 重新渲染后把光标放回原来的输入框
  function renderKeepFocus() {
    const el = document.activeElement;
    const sel = el && (el.dataset.af ? `[data-af="${el.dataset.af}"]` : el.dataset.sf ? `[data-sf="${el.dataset.sf}"]` : null);
    render();
    if (sel) { const x = $app.querySelector(sel); if (x) x.focus(); }
  }

  // ---------- 动作 ----------
  async function go(tab) {
    state.tab = tab;
    state.detail = null;
    state.sheet = null;
    render();
    window.scrollTo(0, 0);
    try {
      if (tab === 'home' || tab === 'search') await loadNotes();
      if (tab === 'me' || tab === 'account') { await loadMe(); state.unread = state.me.unread; }
      if (tab === 'inbox') {
        state.inbox = null;
        render();
        state.inbox = await api('/api/notifications');
        // 打开通知页 = 全部已读（列表里这次仍然标出哪些是新的）
        if (state.inbox.unread) { await api('/api/notifications/read', { method: 'POST' }); state.unread = 0; }
      }
      render();
      if (tab !== 'me' && tab !== 'account' && tab !== 'inbox') refreshUnread();
    } catch (e) { if (state.account) toast(e.message); }
  }

  async function openNote(id, commentId) {
    try {
      state.detail = await api('/api/notes/' + id);
      state.replyTo = null;
      state.askText = '';
      render();
      if (commentId) {
        // 从通知点进来：滚到那条评论，并闪一下
        const el = $app.querySelector(`[data-reply="${Number(commentId)}"]`);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.classList.add('flash');
        } else toast('That comment was removed');
      }
      try { history.pushState({ note: id }, ''); pushed = true; } catch (e) { pushed = false; }
    } catch (e) { toast(e.message); }
  }

  function closeNote() {
    state.detail = null;
    state.replyTo = null;
    render();
  }

  // 关闭详情：如果打开时加过历史记录，就用"返回"关掉，这样手机的返回手势也一致
  function leaveDetail() {
    if (pushed) { pushed = false; history.back(); } else closeNote();
  }

  async function act(path, body) {
    try {
      const n = await api(path, { method: 'POST', body: body || {} });
      replaceNote(n);
      render();
      return n;
    } catch (e) { toast(e.message); }
  }

  function openSheet(kind) {
    state.sheet = kind;
    state.sheetForm = {};
    state.sheetError = '';
    render();
    const first = $app.querySelector('.sheet input');
    if (first) first.focus();
  }

  async function saveSheet(remove) {
    const s = state.sheet;
    const f = state.sheetForm;
    const a = state.account;
    state.busy = true;
    state.sheetError = '';
    render();
    try {
      if (s === 'email' || s === 'phone') {
        const value = remove ? '' : (f[s] ?? a[s] ?? '').trim();
        if (!remove && !value) throw new Error(s === 'email' ? 'Enter an email' : 'Enter a phone number');
        state.account = await api('/api/account', { method: 'PATCH', body: { [s]: value || null, currentPassword: f.currentPassword }, noLogout: true });
        toast(remove ? (s === 'email' ? 'Email removed' : 'Phone removed') : (s === 'email' ? 'Email saved' : 'Phone saved'));
      } else if (s === 'password') {
        state.account = await api('/api/account/password', { method: 'POST', body: { currentPassword: f.currentPassword, newPassword: f.newPassword }, noLogout: true });
        toast('Password saved');
      } else if (s === 'google-off') {
        state.account = await api('/api/account/google', { method: 'DELETE', noLogout: true });
        toast('Google disconnected');
      }
      state.sheet = null;
    } catch (e) {
      state.sheetError = e.message;
    }
    state.busy = false;
    render();
  }

  // 把选的照片缩小到最长边 1280px 再上传，省流量
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
      img.src = url;
    });
  }

  let searchTimer;
  $app.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.draft) state.draft[el.dataset.draft] = el.value;
    // 开始改输入框了，旧的错误提示就收起来
    if (el.dataset.af) { state.authForm[el.dataset.af] = el.value; if (state.authError) { state.authError = ''; $app.querySelectorAll('.err').forEach((x) => x.remove()); } }
    if (el.dataset.sf) { state.sheetForm[el.dataset.sf] = el.value; if (state.sheetError) { state.sheetError = ''; $app.querySelectorAll('.sheet .err').forEach((x) => x.remove()); } }
    if ('ask' in el.dataset) state.askText = el.value;
    if (el.dataset.input === 'query') {
      state.query = el.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        try {
          await loadNotes();
          const box = $app.querySelector('[data-results]');
          const lbl = $app.querySelector('[data-results-label]');
          if (box) box.innerHTML = resultRows();
          if (lbl) lbl.textContent = state.query.trim() ? 'Results' : 'Latest';
        } catch (err) { toast(err.message); }
      }, 200);
    }
  });

  $app.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-photos]')) return;
    const files = [...e.target.files].slice(0, 4 - state.draft.photos.length);
    try {
      for (const f of files) state.draft.photos.push(await shrink(f));
    } catch (err) { toast(err.message); }
    render();
  });

  $app.addEventListener('click', async (e) => {
    // 点面板外面的灰色区域 = 关闭
    if (e.target.matches('[data-sheet-close]')) { state.sheet = null; return render(); }
    const el = e.target.closest('button');
    if (!el) return;
    const d = el.dataset;

    // ----- 未登录页面 -----
    if (d.authGo) {
      state.auth = d.authGo;
      if (d.method) state.authMethod = d.method;
      state.authError = '';
      return render();
    }
    if (d.method) { state.authMethod = d.method; state.authError = ''; return renderKeepFocus(); }
    if ('togglePw' in d) { state.showPassword = !state.showPassword; return renderKeepFocus(); }
    if (d.google) return startGoogle(d.google);

    // ----- 登录后 -----
    if (d.tab) return go(d.tab);
    if (d.open) return openNote(Number(d.open));
    if (d.notif) return openNote(Number(d.notif), Number(d.comment));
    if ('close' in d) return leaveDetail();
    if (d.filter) { state.filter = d.filter; return go('home'); }
    if (d.chip) {
      state.query = d.chip;
      render();
      try { await loadNotes(); render(); } catch (err) { toast(err.message); }
      return;
    }
    if (d.agree) {
      const n = state.notes.find((x) => x.id === Number(d.agree));
      return act(`/api/notes/${d.agree}/vote`, { value: n && n.myVote === 1 ? 0 : 1 });
    }
    if (d.like) return act(`/api/notes/${d.like}/like`);
    if (d.vote) {
      const v = Number(d.vote);
      return act(`/api/notes/${state.detail.id}/vote`, { value: state.detail.myVote === v ? 0 : v });
    }
    if ('likeDetail' in d) return act(`/api/notes/${state.detail.id}/like`);
    if ('save' in d) {
      const n = await act(`/api/notes/${state.detail.id}/save`);
      if (n) toast(n.saved ? 'Saved to your profile' : 'Removed from saved');
      return;
    }
    if (d.reply) {
      // 点评论 = 回复它；再点一次取消
      const id = Number(d.reply);
      state.replyTo = state.replyTo && state.replyTo.id === id ? null : { id, author: d.replyAuthor };
      render();
      if (state.replyTo) $app.querySelector('[data-ask]').focus();
      return;
    }
    if ('cancelReply' in d) { state.replyTo = null; return render(); }
    if (d.follow) {
      try {
        const r = await api(`/api/users/${encodeURIComponent(d.follow)}/follow`, { method: 'POST' });
        state.detail.following = r.following;
        state.notes.forEach((n) => { if (n.author === d.follow) n.following = r.following; });
        render();
      } catch (err) { toast(err.message); }
      return;
    }
    if (d.worth) {
      const want = d.worth === 'yes';
      state.draft.worth = state.draft.worth === want ? null : want;
      return render();
    }
    if (d.rmPhoto) { state.draft.photos.splice(Number(d.rmPhoto), 1); return render(); }
    if ('cancel' in d) {
      // 不弹确认框：草稿保留着，下次点 + 还能接着写
      const dr = state.draft;
      if (dr.title || dr.body || dr.photos.length) toast('Draft kept');
      return go('home');
    }
    if (d.sheet) return openSheet(d.sheet);
    if ('sheetCancel' in d) { state.sheet = null; return render(); }
    if (d.sheetRemove) return saveSheet(true);
    if ('logout' in d) {
      try { await api('/api/auth/logout', { method: 'POST', noLogout: true }); } catch (err) { /* 本地照样退出 */ }
      return signedOut();
    }
    if ('reset' in d) {
      window.TROVE_LOCAL_RESET();
      state.draft = emptyDraft();
      toast('Demo data reset');
      return signedOut();
    }
  });

  $app.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const kind = form.dataset.form;
    const f = state.authForm;

    if (kind === 'signup' || kind === 'login') {
      if (state.busy) return;
      let body;
      if (kind === 'signup') {
        const username = f.username.trim().toLowerCase().replace(/^@/, '');
        if (!username) { state.authError = 'Choose a username'; return renderKeepFocus(); }
        if (!/^[a-z0-9._]{2,20}$/.test(username)) { state.authError = 'Username: 2–20 characters, lowercase letters, numbers, . or _'; return renderKeepFocus(); }
        if (state.authMethod === 'email' && !f.email.trim()) { state.authError = 'Enter your email'; return renderKeepFocus(); }
        if (state.authMethod === 'phone' && !f.phone.trim()) { state.authError = 'Enter your phone number'; return renderKeepFocus(); }
        if (f.password.length < 8) { state.authError = 'Password must be at least 8 characters'; return renderKeepFocus(); }
        body = { username, password: f.password, [state.authMethod]: f[state.authMethod].trim() };
      } else {
        if (!f.id.trim() || !f.password) { state.authError = 'Enter your login and password'; return renderKeepFocus(); }
        body = { id: f.id.trim(), password: f.password };
      }
      state.busy = true;
      state.authError = '';
      render();
      try {
        const r = await api(kind === 'signup' ? '/api/auth/signup' : '/api/auth/login', { method: 'POST', body, noLogout: true });
        state.busy = false;
        signedIn(r);
        toast(kind === 'signup' ? 'Welcome to trove, @' + r.account.username : 'Welcome back');
      } catch (err) {
        state.busy = false;
        state.authError = err.message;
        render();
      }
      return;
    }

    if (kind === 'sheet') return saveSheet(false);

    if (kind === 'post') {
      if (state.busy) return;
      if (!state.draft.title.trim()) { toast('Add a title first'); return; }
      state.busy = true;
      render();
      try {
        await api('/api/notes', { method: 'POST', body: state.draft });
        state.draft = emptyDraft();
        state.filter = 'all';
        state.busy = false;
        toast('Posted');
        return go('home');
      } catch (err) {
        state.busy = false;
        render();
        toast(err.message);
      }
    }

    if (kind === 'ask') {
      const text = state.askText.trim();
      if (!text) return;
      const replying = state.replyTo;
      const n = await act(`/api/notes/${state.detail.id}/questions`, { text, replyTo: replying ? replying.id : null });
      if (n) {
        state.askText = '';
        state.replyTo = null;
        render();
        toast(replying ? 'Reply sent' : 'Sent');
      }
    }
  });

  // 手机上的"返回"手势关闭详情页
  window.addEventListener('popstate', () => { pushed = false; if (state.detail) closeNote(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.sheet) { state.sheet = null; render(); } else if (state.detail) leaveDetail();
  });

  // ---------- 启动 ----------
  async function boot() {
    // Google 登录回来时，结果放在网址 # 后面
    const h = new URLSearchParams(location.hash.slice(1));
    let after = null;
    if (h.get('auth')) { state.token = h.get('auth'); storage.set('trove.token', state.token); }
    if (h.get('auth_error')) state.authError = h.get('auth_error');
    if (h.get('linked')) after = 'linked';
    if ([...h.keys()].some((k) => ['auth', 'auth_error', 'linked'].includes(k))) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }

    try { state.config = await api('/api/config'); } catch (e) { /* 用默认值 */ }

    if (state.token) {
      try {
        state.account = await api('/api/account', { noLogout: true });
      } catch (e) {
        state.token = '';
        storage.remove('trove.token');
      }
    }
    if (!state.account) return render();
    if (after === 'linked') { toast('Google connected'); return go('account'); }
    go('home');
  }

  boot();
})();
