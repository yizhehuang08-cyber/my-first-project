// 和 Stripe 打交道的部分：直接调用 Stripe 的 HTTP 接口（不需要额外安装 SDK）。
// 用到的功能：
//   Checkout        买家付款页面（信用卡 / Apple Pay / 支付宝 / 微信支付，在 Stripe 后台开关）
//   Connect Express 陪玩师的收款账户
//   Transfers       订单完成后把钱转给陪玩师
//   Refunds         退款
'use strict';
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';
const API_VERSION = '2023-10-16'; // 固定接口版本，避免 Stripe 升级后返回格式变化
const SIGNATURE_TOLERANCE_S = 300;

// Stripe 接口要求 form 格式，嵌套对象写成 a[b][c]=1
function encode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}

class StripeError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

function createStripe({ secretKey, fetchImpl = fetch }) {
  async function call(method, path, params, idempotencyKey) {
    const headers = { Authorization: 'Bearer ' + secretKey, 'Stripe-Version': API_VERSION };
    let url = API + path;
    let body;
    if (params && method === 'GET') url += '?' + encode(params);
    else if (params) {
      body = encode(params);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    // 同一个 key 重试时 Stripe 不会重复转账 / 退款
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(url, { method, headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data.error || {};
      throw new StripeError(e.message || `Stripe error ${res.status}`, res.status, e.code);
    }
    return data;
  }

  return {
    createCheckout: (p) => call('POST', '/checkout/sessions', p),
    expireCheckout: (id) => call('POST', `/checkout/sessions/${id}/expire`),
    getPaymentIntent: (id) => call('GET', `/payment_intents/${id}`),
    createAccount: (p) => call('POST', '/accounts', p),
    getAccount: (id) => call('GET', `/accounts/${id}`),
    createAccountLink: (p) => call('POST', '/account_links', p),
    createLoginLink: (id) => call('POST', `/accounts/${id}/login_links`),
    createTransfer: (p, key) => call('POST', '/transfers', p, key),
    createRefund: (p, key) => call('POST', '/refunds', p, key)
  };
}

// 验证 Webhook 确实来自 Stripe（用 STRIPE_WEBHOOK_SECRET 做 HMAC 签名校验）
function verifyWebhook(rawBody, header, secret, nowMs = Date.now()) {
  const parts = Object.fromEntries(String(header || '').split(',').map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
  }).filter(([k]) => k));
  const sigs = String(header || '').split(',').filter((kv) => kv.trim().startsWith('v1=')).map((kv) => kv.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length) return null;
  if (Math.abs(nowMs / 1000 - t) > SIGNATURE_TOLERANCE_S) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const ok = sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) return null;
  try { return JSON.parse(rawBody); } catch (e) { return null; }
}

function signWebhook(rawBody, secret, nowMs = Date.now()) {
  const t = Math.floor(nowMs / 1000);
  return `t=${t},v1=` + crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
}

module.exports = { createStripe, verifyWebhook, signWebhook, StripeError, encode };
