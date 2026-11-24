// 演示版用的"本地后端"：不需要服务器，用和服务器同一份 core.js，数据存在浏览器里。
// 需要先加载 window.TROVE_SEED（示例数据）和 window.TroveCore（core.js）。
(() => {
  'use strict';
  const KEY = 'trove.demo.db';
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

  // 浏览器里用 PBKDF2 加密密码
  async function pbkdf2(password, salt) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 }, key, 256);
  }
  async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2$${hex(salt)}$${hex(await pbkdf2(password, salt))}`;
  }
  async function verifyPassword(password, stored) {
    const [algo, salt, hash] = String(stored).split('$');
    if (algo !== 'pbkdf2') return false;
    return hex(await pbkdf2(password, unhex(salt))) === hash;
  }

  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) { /* ignore */ }
    return window.TROVE_SEED();
  }

  let core;
  function boot(db) {
    core = window.TroveCore.createCore({
      db,
      save: () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 存不下就只留在内存里 */ } },
      hashPassword,
      verifyPassword,
      randomToken: () => hex(crypto.getRandomValues(new Uint8Array(32))),
      googleEnabled: false,
      samples: { notes: window.TROVE_SEED.SAMPLE_NOTES, authors: window.TROVE_SEED.SAMPLE_AUTHORS }
    });
  }
  boot(load());

  window.TROVE_LOCAL_API = async (path, { method = 'GET', token, body } = {}) => {
    try {
      // 走一遍 JSON，和真的网络请求一样拿到的是拷贝
      const r = await core.handle(method, path, { token, body: body ? JSON.parse(JSON.stringify(body)) : undefined });
      return JSON.parse(JSON.stringify(r.data));
    } catch (e) {
      if (e instanceof window.TroveCore.HttpError) { const err = new Error(e.message); err.status = e.status; throw err; }
      throw e;
    }
  };
  window.TROVE_LOCAL_RESET = () => {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    boot(window.TROVE_SEED());
  };
})();
