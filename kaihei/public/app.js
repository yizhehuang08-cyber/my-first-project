// KaiHei 前端：不依赖框架的单页应用，网址用 # 区分页面（#/c/小鹿、#/o/12 ……）。
(() => {
  'use strict';

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');
  const storage = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  // ---------- 中英文 ----------
  const T = {
    tagline: ['北美服务器游戏陪玩', 'Game companions on NA servers'],
    nav_find: ['找陪玩', 'Find'],
    nav_orders: ['订单', 'Orders'],
    nav_me: ['我的', 'Me'],
    login: ['登录', 'Log in'],
    signup: ['注册', 'Sign up'],
    logout: ['退出登录', 'Log out'],
    hero_title: ['找个靠谱队友，今晚一起开黑', 'Find a teammate for tonight'],
    hero_sub: ['Valorant · CS2 · 北美服务器 · 中文 / English 陪玩师。付款由平台托管，玩完确认才结算。', 'Valorant · CS2 · NA servers · Chinese & English companions. Payment is held until you confirm.'],
    all_games: ['全部游戏', 'All games'],
    any_lang: ['任何语言', 'Any language'],
    any_style: ['任何类型', 'Any style'],
    any_price: ['任何价格', 'Any price'],
    under: ['$%s/小时以内', 'Under $%s/hr'],
    online_only: ['只看在线', 'Online now'],
    sort_recommended: ['推荐', 'Recommended'],
    sort_rating: ['评分最高', 'Top rated'],
    sort_price_asc: ['价格从低到高', 'Price: low to high'],
    sort_price_desc: ['价格从高到低', 'Price: high to low'],
    sort_new: ['最新入驻', 'Newest'],
    no_companions: ['还没有符合条件的陪玩师', 'No companions match yet'],
    be_first: ['成为第一位陪玩师 →', 'Be the first companion →'],
    lang_zh: ['普通话', 'Mandarin'],
    lang_en: ['英语', 'English'],
    lang_yue: ['粤语', 'Cantonese'],
    style_skilled: ['技术陪玩', 'Skilled duo'],
    style_chill: ['娱乐陪玩', 'Chill'],
    style_coach: ['教学', 'Coaching'],
    'region_na-west': ['美西', 'NA West'],
    'region_na-central': ['美中', 'NA Central'],
    'region_na-east': ['美东', 'NA East'],
    per_hour: ['/小时', '/hr'],
    from: ['起', 'from'],
    online: ['在线', 'Online'],
    new_badge: ['新人', 'New'],
    orders_n: ['%s 单', '%s orders'],
    reviews_n: ['%s 条评价', '%s reviews'],
    about: ['介绍', 'About'],
    games_prices: ['游戏和价格', 'Games & prices'],
    reviews: ['评价', 'Reviews'],
    no_reviews: ['还没有评价', 'No reviews yet'],
    book: ['下单', 'Book'],
    game: ['游戏', 'Game'],
    hours: ['时长（小时）', 'Hours'],
    note: ['给陪玩师留言（可选）', 'Note for your companion (optional)'],
    note_ph: ['比如：想练 Jett / 想找人一起打 Premier', 'e.g. want to practice Jett / need a Premier duo'],
    total: ['合计', 'Total'],
    pay_demo: ['下单并付款（测试支付）', 'Book & pay (test payment)'],
    demo_notice: ['测试版：现在不会扣真钱。正式上线后会接 Stripe（信用卡 / Apple Pay / 支付宝 / 微信支付）。付款由平台托管：陪玩师 24 小时内没接单自动退款；玩完你确认后才结算给陪玩师。', 'Test mode: no real money is charged yet. Live version will use Stripe (cards, Apple Pay, Alipay, WeChat Pay). Payment is held: refunded if not accepted within 24h, paid out only after you confirm.'],
    login_to_book: ['登录后下单', 'Log in to book'],
    own_profile: ['这是你自己的主页', 'This is your own profile'],
    report: ['举报', 'Report'],
    report_ph: ['请描述发生了什么（比如要求线下见面、代练、骚扰）', 'What happened? (e.g. asked to meet offline, account sharing, harassment)'],
    report_sent: ['已提交，我们会尽快处理', 'Report sent. We will review it soon'],
    send: ['发送', 'Send'],
    cancel: ['取消', 'Cancel'],
    username: ['用户名', 'Username'],
    username_ph: ['小写字母和数字，比如 xiaolu', 'lowercase, e.g. xiaolu'],
    email: ['邮箱', 'Email'],
    password: ['密码', 'Password'],
    password_ph: ['至少 8 位', 'At least 8 characters'],
    id_ph: ['用户名或邮箱', 'Username or email'],
    birth: ['生日（需年满 18 岁）', 'Date of birth (18+ only)'],
    agree: ['我已年满 18 岁，并同意%s', 'I am 18 or older and agree to the %s'],
    rules: ['平台规则', 'Rules'],
    have_account: ['已经有账号？', 'Have an account?'],
    no_account: ['还没有账号？', 'New here?'],
    welcome_back: ['欢迎回来', 'Welcome back'],
    create_account: ['创建账号', 'Create your account'],
    my_orders: ['我下的单', 'I booked'],
    my_jobs: ['我接的单', 'My jobs'],
    no_orders: ['还没有订单', 'No orders yet'],
    go_find: ['去找陪玩 →', 'Find a companion →'],
    st_paid: ['等待接单', 'Waiting to accept'],
    st_accepted: ['进行中', 'In progress'],
    st_delivered: ['待确认', 'To confirm'],
    st_completed: ['已完成', 'Completed'],
    st_disputed: ['售后处理中', 'In dispute'],
    st_refunded: ['已退款', 'Refunded'],
    ev_paid: ['买家已付款，钱由平台托管。等待陪玩师接单（24 小时内）', 'Paid. Funds held by KaiHei. Waiting for the companion (24h)'],
    ev_accepted: ['陪玩师已接单。互相加 Discord 开始吧！', 'Accepted! Add each other on Discord and play'],
    ev_delivered: ['陪玩师标记已完成，等待买家确认（48 小时后自动确认）', 'Marked done. Waiting for buyer to confirm (auto in 48h)'],
    ev_completed: ['订单完成，已结算给陪玩师', 'Completed. Paid out to the companion'],
    ev_disputed: ['买家申请了售后，客服会介入处理', 'Buyer opened a dispute. Support will step in'],
    ev_refunded: ['已全额退款', 'Fully refunded'],
    why_declined: ['陪玩师拒绝了订单', 'Companion declined'],
    why_cancelled: ['买家取消了订单', 'Buyer cancelled'],
    why_expired: ['24 小时内没人接单', 'Not accepted within 24h'],
    why_auto_confirm: ['48 小时自动确认', 'Auto-confirmed after 48h'],
    why_admin_refund: ['客服判定退款', 'Support refunded'],
    why_admin_release: ['客服判定结算给陪玩师', 'Support released payment'],
    accept: ['接单', 'Accept'],
    decline: ['拒绝', 'Decline'],
    cancel_order: ['取消订单（全额退款）', 'Cancel (full refund)'],
    deliver: ['我已陪玩完成', 'Mark as done'],
    confirm: ['确认完成', 'Confirm done'],
    dispute: ['申请售后', 'Open dispute'],
    dispute_ph: ['说明一下问题（比如对方没上线、时长不够）', 'Describe the problem (no-show, cut short…)'],
    sure_decline: ['确定拒绝？买家会收到全额退款', 'Decline? The buyer gets a full refund'],
    sure_cancel: ['确定取消？会全额退款', 'Cancel this order? You get a full refund'],
    sure_confirm: ['确认后钱会结算给陪玩师，不能撤回', 'Confirm? Payment will be released to the companion'],
    discord_of: ['%s 的 Discord', "%s's Discord"],
    copy: ['复制', 'Copy'],
    copied: ['已复制', 'Copied'],
    buyer_no_discord: ['买家还没填 Discord，可以在聊天里问一下', 'Buyer has no Discord yet, ask in chat'],
    chat: ['订单聊天', 'Order chat'],
    chat_ph: ['发消息…', 'Message…'],
    chat_closed: ['订单已结束', 'Chat closed'],
    you_earn: ['你的收入（扣除 %s%% 平台服务费）', 'You earn (after %s%% fee)'],
    accept_by: ['请在 %s 前接单', 'Accept before %s'],
    leave_review: ['给这次陪玩打个分', 'Rate this session'],
    review_ph: ['说说体验（可选）', 'How was it? (optional)'],
    submit: ['提交', 'Submit'],
    thanks_review: ['感谢评价！', 'Thanks for the review!'],
    account: ['账号', 'Account'],
    my_discord: ['我的 Discord 用户名', 'My Discord username'],
    discord_hint: ['接单后才会显示给对方，方便一起开黑', 'Shown to the other side only after an order is accepted'],
    save: ['保存', 'Save'],
    saved: ['已保存', 'Saved'],
    become: ['成为陪玩师', 'Become a companion'],
    become_sub: ['设置自己的价格，接单赚钱。平台收取 %s%% 服务费。', 'Set your own price and earn. KaiHei keeps a %s%% fee.'],
    apply_now: ['申请入驻 →', 'Apply →'],
    cs_pending: ['审核中', 'Under review'],
    cs_pending_sub: ['资料审核通过后就会出现在首页，一般 24 小时内', 'You will appear on the home page once approved (usually within 24h)'],
    cs_rejected: ['未通过', 'Not approved'],
    cs_suspended: ['已暂停', 'Suspended'],
    cs_approved: ['已上架', 'Live'],
    edit_profile: ['修改资料', 'Edit profile'],
    view_page: ['查看我的主页', 'View my page'],
    go_online: ['我现在在线，可以接单', "I'm online and taking orders"],
    earnings: ['收入', 'Earnings'],
    settled: ['已结算', 'Settled'],
    pending_money: ['进行中', 'In progress'],
    payout_note: ['提现功能会在接入 Stripe 后开放', 'Payouts open once Stripe is connected'],
    admin: ['后台管理', 'Admin'],
    apply_title: ['陪玩师资料', 'Companion profile'],
    display_name: ['昵称', 'Display name'],
    headline: ['一句话介绍', 'Headline'],
    headline_ph: ['比如：Immortal 陪你上分，声音好听', 'e.g. Immortal duo, calm comms'],
    bio: ['详细介绍', 'About you'],
    bio_ph: ['常在线时间、擅长位置/英雄、性格…', 'When you play, roles/agents, vibe…'],
    avatar: ['头像', 'Photo'],
    pick_photo: ['选择照片', 'Choose photo'],
    offer_game: ['我陪 %s', 'I offer %s'],
    rank: ['可陪段位（可多选）', 'Ranks you can play (pick any)'],
    any_rank: ['任何段位', 'Any rank'],
    price_hr: ['价格（美元 / 小时）', 'Price (USD / hour)'],
    languages: ['语言', 'Languages'],
    styles: ['陪玩类型', 'Play style'],
    region: ['服务器地区', 'Server region'],
    discord_req: ['Discord 用户名（必填，接单后显示给买家）', 'Discord username (required, shown to buyers after accept)'],
    apply_submit: ['提交审核', 'Submit for review'],
    apply_rules: ['提交即表示你同意：只陪玩、不代练、不共享账号、不线下见面。违规会被永久封号。', 'By submitting you agree: duo only, no boosting or account sharing, no offline meetups. Violations mean a permanent ban.'],
    pick: ['请选择', 'Select'],
    admin_pending: ['待审核陪玩师', 'Pending companions'],
    admin_disputes: ['售后订单', 'Disputes'],
    admin_reports: ['举报', 'Reports'],
    admin_companions: ['所有陪玩师', 'All companions'],
    approve: ['通过', 'Approve'],
    reject: ['拒绝', 'Reject'],
    suspend: ['暂停', 'Suspend'],
    restore: ['恢复', 'Restore'],
    refund: ['退款给买家', 'Refund buyer'],
    release: ['结算给陪玩师', 'Pay companion'],
    close: ['关闭', 'Close'],
    ban: ['封号并关闭', 'Ban & close'],
    reason_ph: ['原因（会显示给对方）', 'Reason (shown to them)'],
    nothing: ['暂无', 'Nothing here'],
    users: ['用户', 'Users'],
    orders_total: ['订单', 'Orders'],
    gmv: ['成交额', 'GMV'],
    revenue: ['平台收入', 'Revenue'],
    not_found: ['页面不存在', 'Page not found'],
    back_home: ['回到首页', 'Back home'],
    loading: ['加载中…', 'Loading…'],
    buyer: ['买家', 'Buyer'],
    companion_title: ['我的陪玩主页', 'My companion profile'],
    footer: ['KaiHei 与 Riot Games、Valve 无关。平台只提供陪玩，不提供代练或账号交易。', 'KaiHei is not affiliated with Riot Games or Valve. Duo play only: no boosting or account trading.']
  };

  const RULES = {
    zh: [
      '必须年满 18 岁才能注册和下单、接单。',
      '平台只提供"陪玩"：陪玩师用自己的账号和你一起玩。<b>禁止代练、代打、共享或买卖账号</b>，这会违反游戏条款并导致封号。',
      '<b>禁止线下见面</b>，禁止任何色情、擦边或与游戏无关的服务。',
      '所有付款必须在平台内完成，<b>禁止私下转账</b>（私下交易出现纠纷平台无法保障）。',
      '付款由平台托管：陪玩师 24 小时内没接单自动全额退款；接单前买家可随时取消；陪玩师标记完成后 48 小时内买家没有操作视为确认。',
      '遇到问题可以在订单里"申请售后"，客服会查看聊天记录并判定退款或结算。',
      '尊重对方：禁止辱骂、歧视、骚扰。可以在陪玩师主页或订单里举报。',
      '违反规则会被暂停或永久封号，未结算的收入可能被冻结。'
    ],
    en: [
      'You must be 18 or older to sign up, book or take orders.',
      'KaiHei is for <b>duo play only</b>: companions play on their own accounts with you. <b>No boosting, piloting, or sharing/selling accounts</b>. It breaks game rules and gets accounts banned.',
      '<b>No offline meetups</b> and no adult or non-gaming services of any kind.',
      'All payments stay on KaiHei. <b>No off-platform payments</b>. We cannot protect you outside the platform.',
      'Payments are held: full refund if a companion does not accept within 24h; buyers can cancel any time before acceptance; an order auto-confirms 48h after the companion marks it done.',
      'If something goes wrong, open a dispute on the order. Support reviews the chat and decides refund or payout.',
      'Be respectful: no abuse, discrimination or harassment. Report from a profile or an order.',
      'Breaking the rules leads to suspension or a permanent ban, and unsettled earnings may be frozen.'
    ]
  };

  const state = {
    lang: storage.get('kaihei.lang') || (String(navigator.language || '').startsWith('zh') ? 'zh' : 'en'),
    token: storage.get('kaihei.token') || '',
    me: null, // /api/me
    config: null,
    filters: { game: '', rank: '', lang: '', style: '', max: '', online: false, sort: 'recommended' },
    page: null // 当前页面的数据
  };

  const t = (key, ...args) => {
    const pair = T[key];
    if (!pair) return key;
    let s = pair[state.lang === 'zh' ? 0 : 1];
    for (const a of args) s = s.replace('%s', a);
    return s;
  };

  // ---------- 小工具 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents) => '$' + (cents / 100).toFixed(cents % 100 ? 2 : 0);
  const gameName = (g) => (state.config && state.config.games[g] ? state.config.games[g].name : g);
  const COLORS = ['#FF8A8E', '#7CF4C4', '#FFC861', '#8EA8FF', '#E59CFF', '#7FD8FF'];
  const colorOf = (name) => COLORS[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const avatar = (url, name, size = '') => url
    ? `<div class="avatar ${size}" style="background-image:url('${esc(url)}')"></div>`
    : `<div class="avatar ${size}" style="background-color:${colorOf(name)}">${esc([...String(name || '?')][0].toUpperCase())}</div>`;
  const when = (iso) => new Date(iso).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const stars = (r) => (r ? `<span class="stars">★ ${r.toFixed(1)}</span>` : `<span class="chip">${t('new_badge')}</span>`);
  const loggedIn = () => !!state.me;
  // 可陪段位：连续 3 个以上合并成 "Gold ~ Immortal"，其余用 / 隔开
  function rankText(game, ranks) {
    const all = state.config.games[game] ? state.config.games[game].ranks : [];
    const idx = (ranks || []).map((r) => all.indexOf(r)).filter((i) => i >= 0).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      if (j - i >= 2) out.push(all[idx[i]] + ' ~ ' + all[idx[j]]);
      else for (let k = i; k <= j; k++) out.push(all[idx[k]]);
      i = j + 1;
    }
    return out.join(' / ');
  }
  const pct = () => Math.round((state.config ? state.config.feeRate : 0.15) * 100);

  let toastTimer;
  function toast(m) {
    $toast.textContent = m;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Lang': state.lang,
        ...(state.token ? { Authorization: 'Bearer ' + state.token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && state.token) { setToken(''); state.me = null; }
      const e = new Error(data.error || 'Error');
      e.status = res.status;
      throw e;
    }
    return data;
  }

  function setToken(tok) {
    state.token = tok;
    if (tok) storage.set('kaihei.token', tok); else storage.remove('kaihei.token');
  }

  async function loadMe() {
    if (!state.token) { state.me = null; return; }
    try { state.me = await api('/api/me'); } catch (e) { state.me = null; }
  }

  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  // ---------- 外框 ----------
  const ICON = {
    find: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    orders: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    me: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
  };

  function shell(section, body) {
    const todo = state.me && state.me.todo ? `<span class="badge">${state.me.todo}</span>` : '';
    const link = (href, key, name, icon) => `<a href="${href}" class="${section === name ? 'on' : ''}">${icon || ''}${t(key)}${name === 'orders' ? todo : ''}</a>`;
    return `
      <header class="top"><div class="wrap">
        <a class="logo" href="#/"><img src="/icon.svg" alt="">KaiHei <small>开黑</small></a>
        <nav class="nav">${link('#/', 'nav_find', 'find')}${link('#/orders', 'nav_orders', 'orders')}${link('#/me', 'nav_me', 'me')}</nav>
        <div class="spacer"></div>
        <button class="lang" data-act="lang" aria-label="Language">${state.lang === 'zh' ? 'EN' : '中文'}</button>
        ${loggedIn() ? '' : `<a class="btn sm primary" href="#/login">${t('login')}</a>`}
      </div></header>
      <main class="wrap">${body}
        <p class="footer">${t('footer')} · <a class="link" href="#/rules">${t('rules')}</a></p>
      </main>
      <nav class="tabbar">${link('#/', 'nav_find', 'find', ICON.find)}${link('#/orders', 'nav_orders', 'orders', ICON.orders)}${link('#/me', 'nav_me', 'me', ICON.me)}</nav>`;
  }

  // ---------- 首页：找陪玩 ----------
  async function pageHome() {
    const f = state.filters;
    const q = new URLSearchParams();
    for (const k of ['game', 'rank', 'lang', 'style', 'max', 'sort']) if (f[k]) q.set(k, f[k]);
    if (f.online) q.set('online', '1');
    const list = await api('/api/companions?' + q);
    const games = state.config.games;
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;

    const card = (c) => {
      const gameRows = Object.entries(c.games)
        .filter(([g]) => !f.game || g === f.game)
        .map(([g, x]) => `<div><span>${esc(gameName(g))} · ${esc(rankText(g, x.ranks))}</span><b>${money(x.price)}</b></div>`).join('');
      const shown = f.game && c.games[f.game] ? c.games[f.game].price : c.fromPrice;
      return `<a class="card" href="#/c/${encodeURIComponent(c.name)}">
        <div class="card-head">${avatar(c.avatar, c.displayName)}
          <div style="min-width:0">
            <div class="card-name">${esc(c.displayName)} ${c.online ? '<span class="dot-online" title="online"></span>' : ''}</div>
            <div class="card-line">${esc(c.headline || '')}</div>
          </div></div>
        <div class="row" style="gap:6px">${c.languages.map((l) => `<span class="chip">${t('lang_' + l)}</span>`).join('')}<span class="chip">${t('region_' + c.region)}</span></div>
        <div class="card-games">${gameRows}</div>
        <div class="card-foot">
          <span class="price">${money(shown)}<small>${t('per_hour')}${f.game ? '' : ' ' + t('from')}</small></span>
          <span class="row" style="gap:6px">${stars(c.rating)}<span class="sub small">${t('orders_n', c.orders)}</span></span>
        </div></a>`;
    };

    return shell('find', `
      <section class="hero"><h1>${t('hero_title')}</h1><p>${t('hero_sub')}</p></section>
      <div class="games">
        <button data-act="game" data-v="" aria-pressed="${!f.game}">${t('all_games')}</button>
        ${Object.entries(games).map(([k, g]) => `<button data-act="game" data-v="${k}" aria-pressed="${f.game === k}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="filters">
        ${f.game ? `<select data-filter="rank">${opt('', t('any_rank'), f.rank)}${games[f.game].ranks.map((r) => opt(r, r, f.rank)).join('')}</select>` : ''}
        <select data-filter="lang">${opt('', t('any_lang'), f.lang)}${state.config.languages.map((l) => opt(l, t('lang_' + l), f.lang)).join('')}</select>
        <select data-filter="style">${opt('', t('any_style'), f.style)}${state.config.styles.map((s) => opt(s, t('style_' + s), f.style)).join('')}</select>
        <select data-filter="max">${opt('', t('any_price'), f.max)}${[1000, 1500, 2000, 3000].map((c) => opt(c, t('under', c / 100), f.max)).join('')}</select>
        <select data-filter="sort">${['recommended', 'rating', 'price_asc', 'price_desc', 'new'].map((s) => opt(s, t('sort_' + s), f.sort)).join('')}</select>
        <label><input type="checkbox" data-filter="online" ${f.online ? 'checked' : ''}> ${t('online_only')}</label>
      </div>
      ${list.length ? `<div class="cards">${list.map(card).join('')}</div>`
        : `<div class="empty panel">${t('no_companions')}<br><br><a class="link" href="#/apply">${t('be_first')}</a></div>`}
    `);
  }

  // ---------- 陪玩师主页 + 下单 ----------
  async function pageCompanion(name) {
    const c = await api('/api/companions/' + encodeURIComponent(name));
    const p = state.page = { c, game: Object.keys(c.games)[0], hours: 1, note: '', reporting: false };
    return renderCompanion(p);
  }

  function renderCompanion(p) {
    const c = p.c;
    const isMe = state.me && state.me.account.username === c.name;
    const unit = c.games[p.game].price;
    const orderBox = isMe
      ? `<div class="panel"><p class="sub">${t('own_profile')}</p><a class="btn block" href="#/apply">${t('edit_profile')}</a></div>`
      : `<form class="panel stack order-box" data-form="order">
          <h2>${t('book')}</h2>
          <label class="f"><span>${t('game')}</span>
            <select class="i" name="game" data-live="game">${Object.entries(c.games).map(([g, x]) => `<option value="${g}" ${g === p.game ? 'selected' : ''}>${esc(gameName(g))} · ${money(x.price)}${t('per_hour')}</option>`).join('')}</select></label>
          <div class="f"><span class="sub small" style="display:block;margin-bottom:6px;font-weight:600">${t('hours')}</span>
            <div class="stepper"><button type="button" data-act="hours" data-v="-1">−</button><span>${p.hours}</span><button type="button" data-act="hours" data-v="1">+</button></div></div>
          <label class="f"><span>${t('note')}</span><textarea class="i" name="note" maxlength="300" placeholder="${esc(t('note_ph'))}" data-live="note">${esc(p.note)}</textarea></label>
          <div class="total"><span>${t('total')}</span><b>${money(unit * p.hours)}</b></div>
          <button class="btn primary block" ${c.status !== 'approved' ? 'disabled' : ''}>${loggedIn() ? t('pay_demo') : t('login_to_book')}</button>
          <p class="err" data-err></p>
          <div class="notice">${t('demo_notice')}</div>
        </form>`;

    return shell('find', `
      <div class="grid2">
        <div class="stack">
          <section class="panel">
            <div class="profile-head">${avatar(c.avatar, c.displayName, 'lg')}
              <div class="stack" style="--g:6px">
                <h1 style="margin:0">${esc(c.displayName)}</h1>
                <div class="sub">${esc(c.headline || '')}</div>
                <div class="row" style="gap:6px">
                  ${c.online ? `<span class="chip on"><span class="dot-online"></span>${t('online')}</span>` : ''}
                  ${stars(c.rating)} <span class="sub small">${t('reviews_n', c.reviews.length)} · ${t('orders_n', c.orders)}</span>
                </div>
              </div></div>
            <div class="row" style="gap:6px;margin-top:14px">
              ${c.languages.map((l) => `<span class="chip">${t('lang_' + l)}</span>`).join('')}
              ${c.styles.map((s) => `<span class="chip hot">${t('style_' + s)}</span>`).join('')}
              <span class="chip">${t('region_' + c.region)}</span>
            </div>
          </section>
          <section class="panel"><h2>${t('games_prices')}</h2>
            <table class="games-table">${Object.entries(c.games).map(([g, x]) => `<tr><td><b>${esc(gameName(g))}</b> <span class="sub">· ${esc(rankText(g, x.ranks))}</span></td><td>${money(x.price)}${t('per_hour')}</td></tr>`).join('')}</table>
          </section>
          ${c.bio ? `<section class="panel"><h2>${t('about')}</h2><div class="bio">${esc(c.bio)}</div></section>` : ''}
          <section class="panel"><h2>${t('reviews')}</h2>
            ${c.reviews.length ? c.reviews.map((r) => `<div class="review"><div class="row between"><span class="stars">${'★'.repeat(r.stars)}<span style="color:var(--line)">${'★'.repeat(5 - r.stars)}</span></span><span class="sub small">${esc(gameName(r.game))} · ${when(r.at)}</span></div>${r.text ? `<div style="margin-top:4px">${esc(r.text)}</div>` : ''}<div class="sub small">— ${esc(r.by)}</div></div>`).join('') : `<p class="sub">${t('no_reviews')}</p>`}
          </section>
          ${loggedIn() && !isMe ? reportBox(c.name, p.reporting) : ''}
        </div>
        ${orderBox}
      </div>`);
  }

  function reportBox(target, open, orderId) {
    if (!open) return `<div><button class="link small" data-act="report-open">${t('report')}</button></div>`;
    return `<form class="panel stack" data-form="report" data-target="${esc(target)}" data-order="${orderId || ''}">
      <h3>${t('report')} ${esc(target)}</h3>
      <textarea class="i" name="reason" maxlength="500" required placeholder="${esc(t('report_ph'))}"></textarea>
      <div class="row"><button class="btn primary sm">${t('send')}</button><button type="button" class="btn sm" data-act="report-close">${t('cancel')}</button></div>
      <p class="err" data-err></p></form>`;
  }

  // ---------- 登录 / 注册 ----------
  function pageAuth(mode) {
    const signup = mode === 'signup';
    return shell('me', `
      <div class="auth panel">
        <form class="stack" data-form="${mode}">
          <h1>${signup ? t('create_account') : t('welcome_back')}</h1>
          ${signup ? `
            <label class="f"><span>${t('username')}</span><input class="i" name="username" autocomplete="username" required placeholder="${esc(t('username_ph'))}" autocapitalize="none"></label>
            <label class="f"><span>${t('email')}</span><input class="i" name="email" type="email" autocomplete="email" required></label>
            <label class="f"><span>${t('password')}</span><input class="i" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="${esc(t('password_ph'))}"></label>
            <label class="f"><span>${t('birth')}</span><input class="i" name="birthDate" type="date" required max="${new Date().toISOString().slice(0, 10)}"></label>
            <label class="agree"><input type="checkbox" name="agree" required><span>${t('agree', `<a class="link" href="#/rules" target="_blank">${t('rules')}</a>`)}</span></label>
          ` : `
            <label class="f"><span>${t('id_ph')}</span><input class="i" name="id" autocomplete="username" required autocapitalize="none"></label>
            <label class="f"><span>${t('password')}</span><input class="i" name="password" type="password" autocomplete="current-password" required></label>
          `}
          <button class="btn primary block">${signup ? t('signup') : t('login')}</button>
          <p class="err" data-err></p>
          <p class="sub small" style="text-align:center">${signup ? t('have_account') : t('no_account')} <a class="link" href="#/${signup ? 'login' : 'signup'}">${signup ? t('login') : t('signup')}</a></p>
        </form>
      </div>`);
  }

  // ---------- 订单列表 ----------
  async function pageOrders(role) {
    if (!loggedIn()) return needLogin();
    const isComp = !!state.me.companion;
    role = role === 'companion' && isComp ? 'companion' : 'buyer';
    const list = await api('/api/orders?role=' + role);
    const item = (o) => {
      const other = role === 'buyer' ? o.companionName : o.buyer;
      const needsMe = (role === 'companion' && o.status === 'paid') || (role === 'buyer' && o.status === 'delivered');
      return `<a class="oitem" href="#/o/${o.id}">
        ${avatar(role === 'buyer' ? o.companionAvatar : null, other, 'sm')}
        <div class="grow"><div class="row between"><b>${esc(other)}</b>${statusChip(o.status)}</div>
          <div class="sub small">${esc(gameName(o.game))} · ${o.hours}h · ${money(role === 'buyer' ? o.total : o.payout)} · ${when(o.createdAt)}</div></div>
        ${needsMe ? '<span class="badge" style="position:static">!</span>' : ''}</a>`;
    };
    return shell('orders', `
      <h1>${t('nav_orders')}</h1>
      ${isComp ? `<div class="seg"><a href="#/orders" class="${role === 'buyer' ? 'on' : ''}">${t('my_orders')}</a><a href="#/orders/companion" class="${role === 'companion' ? 'on' : ''}">${t('my_jobs')}</a></div>` : ''}
      ${list.length ? `<div class="olist">${list.map(item).join('')}</div>`
        : `<div class="empty panel">${t('no_orders')}<br><br>${role === 'buyer' ? `<a class="link" href="#/">${t('go_find')}</a>` : ''}</div>`}`);
  }

  const statusChip = (s) => {
    const cls = { paid: 'warn', accepted: 'on', delivered: 'warn', completed: '', disputed: 'bad', refunded: '' }[s];
    return `<span class="chip ${cls}">${t('st_' + s)}</span>`;
  };

  // ---------- 订单详情 ----------
  async function pageOrder(id) {
    if (!loggedIn()) return needLogin();
    const o = await api('/api/orders/' + id);
    state.page = { o, stars: 0, disputing: false, reporting: false };
    return renderOrder(state.page);
  }

  function msgsHtml(o) {
    const mine = state.me.account.username;
    return o.messages.map((m) => {
      if (!m.from) return `<div class="msg sys">${t('ev_' + m.event)}${m.reason && T['why_' + m.reason] ? ' · ' + t('why_' + m.reason) : ''}<time>${when(m.at)}</time></div>`;
      return `<div class="msg ${m.from === mine ? 'mine' : ''}">${esc(m.text)}<time>${m.from === mine ? '' : esc(m.from) + ' · '}${when(m.at)}</time></div>`;
    }).join('');
  }

  function renderOrder(p) {
    const o = p.o;
    const role = o.role;
    const order = ['paid', 'accepted', 'delivered', 'completed'];
    const stepN = o.status === 'disputed' ? 2 : order.indexOf(o.status);
    const chatOpen = ['paid', 'accepted', 'delivered', 'disputed'].includes(o.status);
    const other = role === 'buyer' ? o.companion : o.buyer;

    const actions = [];
    if (role === 'companion' && o.status === 'paid') actions.push(`<button class="btn ok" data-act="o" data-v="accept">${t('accept')}</button>`, `<button class="btn danger" data-act="o" data-v="decline" data-confirm="sure_decline">${t('decline')}</button>`);
    if (role === 'companion' && o.status === 'accepted') actions.push(`<button class="btn ok" data-act="o" data-v="deliver">${t('deliver')}</button>`);
    if (role === 'buyer' && o.status === 'paid') actions.push(`<button class="btn danger" data-act="o" data-v="cancel" data-confirm="sure_cancel">${t('cancel_order')}</button>`);
    if (role === 'buyer' && ['accepted', 'delivered'].includes(o.status)) actions.push(`<button class="btn ok" data-act="o" data-v="confirm" data-confirm="sure_confirm">${t('confirm')}</button>`, `<button class="btn danger" data-act="dispute-open">${t('dispute')}</button>`);

    const discord = o.discord ? `
      <div class="discord"><div><div class="sub small">${t('discord_of', esc(o.companion))}</div><code>${esc(o.discord.companion || '—')}</code></div>${o.discord.companion ? `<button class="btn sm" data-act="copy" data-v="${esc(o.discord.companion)}">${t('copy')}</button>` : ''}</div>
      <div class="discord"><div><div class="sub small">${t('discord_of', esc(o.buyer))}</div><code>${esc(o.discord.buyer || '—')}</code></div>${o.discord.buyer ? `<button class="btn sm" data-act="copy" data-v="${esc(o.discord.buyer)}">${t('copy')}</button>` : `<span class="sub small">${t('buyer_no_discord')}</span>`}</div>` : '';

    const review = role === 'buyer' && o.status === 'completed' && !o.review ? `
      <form class="panel stack" data-form="review"><h3>${t('leave_review')}</h3>
        <div class="starpick">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-act="star" data-v="${n}" class="${n <= p.stars ? 'on' : ''}">★</button>`).join('')}</div>
        <textarea class="i" name="text" maxlength="500" placeholder="${esc(t('review_ph'))}"></textarea>
        <button class="btn primary">${t('submit')}</button><p class="err" data-err></p></form>` : '';

    const dispute = p.disputing ? `
      <form class="panel stack" data-form="dispute"><h3>${t('dispute')}</h3>
        <textarea class="i" name="reason" maxlength="500" required placeholder="${esc(t('dispute_ph'))}"></textarea>
        <div class="row"><button class="btn primary sm">${t('submit')}</button><button type="button" class="btn sm" data-act="dispute-close">${t('cancel')}</button></div>
        <p class="err" data-err></p></form>` : '';

    return shell('orders', `
      <div class="grid2">
        <div class="stack">
          <section class="panel stack">
            <div class="row between"><h1 style="margin:0">#${o.id} · ${esc(gameName(o.game))}</h1>${statusChip(o.status)}</div>
            ${o.status !== 'refunded' ? `<div class="steps">${order.map((s, i) => `<i class="${i <= stepN ? 'done' : ''}"></i>`).join('')}</div>` : ''}
            <div class="row" style="gap:12px">${avatar(o.companionAvatar, o.companionName, 'sm')}<div><b><a href="#/c/${encodeURIComponent(o.companion)}">${esc(o.companionName)}</a></b><div class="sub small">${o.hours}h × ${money(o.unitPrice)} · ${t('buyer')}: ${esc(o.buyer)}</div></div></div>
            ${o.note ? `<div class="notice">${esc(o.note)}</div>` : ''}
            <div class="total"><span>${role === 'buyer' ? t('total') : t('you_earn', pct())}</span><b>${money(role === 'buyer' ? o.total : o.payout)}</b></div>
            ${o.acceptBy && role === 'companion' ? `<p class="sub small" style="margin:0">${t('accept_by', when(o.acceptBy))}</p>` : ''}
            ${o.dispute ? `<div class="notice"><b>${t('dispute')}:</b> ${esc(o.dispute.reason)}${o.dispute.resolution ? `<br>→ ${t('why_admin_' + o.dispute.resolution.outcome)}${o.dispute.resolution.note ? ': ' + esc(o.dispute.resolution.note) : ''}` : ''}</div>` : ''}
            ${discord}
            ${actions.length ? `<div class="row">${actions.join('')}</div>` : ''}
          </section>
          ${dispute}${review}
          ${o.review ? `<section class="panel"><span class="stars">${'★'.repeat(o.review.stars)}</span> ${esc(o.review.text || '')}</section>` : ''}
          ${role !== 'admin' ? reportBox(other, p.reporting, o.id) : ''}
        </div>
        <section class="panel chat"><h2>${t('chat')}</h2>
          <div class="msgs" data-msgs>${msgsHtml(o)}</div>
          ${chatOpen && role !== 'admin' ? `<form class="composer" data-form="msg"><input class="i" name="text" maxlength="1000" autocomplete="off" placeholder="${esc(t('chat_ph'))}"><button class="btn primary">${t('send')}</button></form>` : `<p class="sub small" style="text-align:center">${t('chat_closed')}</p>`}
        </section>
      </div>`);
  }

  // 订单页每 4 秒刷新一次：只更新聊天记录，状态变了才整页重画（不打断正在输入的内容）
  let pollTimer;
  function startPoll(id) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!state.page || !state.page.o || state.page.o.id !== id || document.hidden) return;
      try {
        const o = await api('/api/orders/' + id);
        const old = state.page.o;
        state.page.o = o;
        if (o.status !== old.status) { paint(renderOrder(state.page)); return; }
        if (o.messages.length !== old.messages.length) {
          const box = $app.querySelector('[data-msgs]');
          if (box) { box.innerHTML = msgsHtml(o); box.scrollTop = box.scrollHeight; }
        }
      } catch (e) { /* 网络抖动，下次再试 */ }
    }, 4000);
  }

  // ---------- 我的 ----------
  async function pageMe() {
    if (!loggedIn()) return needLogin();
    await loadMe();
    const m = state.me;
    const c = m.companion;
    let comp;
    if (!c) {
      comp = `<section class="panel stack"><h2>${t('become')}</h2><p class="sub" style="margin:0">${t('become_sub', pct())}</p><a class="btn primary" href="#/apply">${t('apply_now')}</a></section>`;
    } else {
      const chip = { pending: 'warn', rejected: 'bad', suspended: 'bad', approved: 'on' }[c.status];
      comp = `<section class="panel stack">
        <div class="row between"><h2 style="margin:0">${t('companion_title')}</h2><span class="chip ${chip}">${t('cs_' + c.status)}</span></div>
        ${c.status === 'pending' ? `<p class="sub" style="margin:0">${t('cs_pending_sub')}</p>` : ''}
        ${c.rejectReason ? `<div class="notice">${esc(c.rejectReason)}</div>` : ''}
        ${c.status === 'approved' ? `
          <label class="agree" style="color:var(--fg)"><input type="checkbox" data-act="online" ${c.online ? 'checked' : ''}> ${t('go_online')}</label>
          <div class="stats" style="grid-template-columns:repeat(2,1fr)">
            <div class="stat"><span class="sub small">${t('settled')}</span><b>${money(m.earnings.settled)}</b></div>
            <div class="stat"><span class="sub small">${t('pending_money')}</span><b>${money(m.earnings.pending)}</b></div>
          </div><p class="sub small" style="margin:0">${t('payout_note')}</p>` : ''}
        <div class="row">${c.status !== 'suspended' ? `<a class="btn sm" href="#/apply">${t('edit_profile')}</a>` : ''}<a class="btn sm" href="#/c/${encodeURIComponent(c.name)}">${t('view_page')}</a></div>
      </section>`;
    }
    return shell('me', `
      <h1>${esc(m.account.username)}</h1>
      <div class="grid2"><div class="stack">${comp}
        <form class="panel stack" data-form="account"><h2>${t('account')}</h2>
          <div class="sub small">${esc(m.account.email)}</div>
          <label class="f"><span>${t('my_discord')}</span><input class="i" name="discord" value="${esc(m.account.discord || '')}" autocapitalize="none" placeholder="discord.name"></label>
          <p class="sub small" style="margin:0">${t('discord_hint')}</p>
          <div class="row"><button class="btn sm primary">${t('save')}</button></div><p class="err" data-err></p>
        </form></div>
        <div class="stack">
          ${m.account.isAdmin ? `<a class="btn block" href="#/admin">${t('admin')}</a>` : ''}
          <a class="btn block" href="#/rules">${t('rules')}</a>
          <button class="btn block danger" data-act="logout">${t('logout')}</button>
        </div></div>`);
  }

  // ---------- 陪玩师资料表单 ----------
  async function pageApply() {
    if (!loggedIn()) return needLogin();
    await loadMe();
    const c = state.me.companion || {};
    const cfg = state.config;
    state.page = { avatar: c.avatar || null, avatarNew: null };
    const box = (name, value, label, checked) => `<label><input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}> ${label}</label>`;
    const gameBlock = ([key, g]) => {
      const cur = (c.games || {})[key];
      return `<fieldset class="panel stack" style="border-color:var(--line);margin:0">
        <label class="agree" style="color:var(--fg);font-weight:700"><input type="checkbox" name="offer_${key}" ${cur || !c.name ? 'checked' : ''}> ${t('offer_game', esc(g.name))}</label>
        <div class="f"><span class="sub small" style="display:block;font-weight:600;margin-bottom:6px">${t('rank')}</span>
          <div class="checks">${g.ranks.map((r) => box('rank_' + key, r, esc(r), cur && cur.ranks.includes(r))).join('')}</div></div>
        <div class="row" style="align-items:flex-start">
          <label class="f" style="width:150px"><span>${t('price_hr')}</span><input class="i" name="price_${key}" type="number" min="${cfg.minPrice / 100}" max="${cfg.maxPrice / 100}" step="0.5" value="${cur ? cur.price / 100 : ''}" placeholder="12"></label>
        </div></fieldset>`;
    };
    return shell('me', `
      <form class="stack" data-form="apply" style="max-width:640px">
        <h1>${t('apply_title')}</h1>
        <section class="panel stack">
          <div class="row" style="gap:14px"><span data-avatar>${avatar(state.page.avatar, c.displayName || state.me.account.username, 'lg')}</span>
            <label class="btn sm">${t('pick_photo')}<input type="file" accept="image/*" data-act="photo" hidden></label></div>
          <label class="f"><span>${t('display_name')}</span><input class="i" name="displayName" maxlength="24" required value="${esc(c.displayName || '')}"></label>
          <label class="f"><span>${t('headline')}</span><input class="i" name="headline" maxlength="60" value="${esc(c.headline || '')}" placeholder="${esc(t('headline_ph'))}"></label>
          <label class="f"><span>${t('bio')}</span><textarea class="i" name="bio" maxlength="1000" placeholder="${esc(t('bio_ph'))}">${esc(c.bio || '')}</textarea></label>
        </section>
        ${Object.entries(cfg.games).map(gameBlock).join('')}
        <section class="panel stack">
          <div class="f"><span class="sub small" style="display:block;font-weight:600;margin-bottom:6px">${t('languages')}</span><div class="checks">${cfg.languages.map((l) => box('languages', l, t('lang_' + l), (c.languages || ['zh']).includes(l))).join('')}</div></div>
          <div class="f"><span class="sub small" style="display:block;font-weight:600;margin-bottom:6px">${t('styles')}</span><div class="checks">${cfg.styles.map((s) => box('styles', s, t('style_' + s), (c.styles || []).includes(s))).join('')}</div></div>
          <label class="f"><span>${t('region')}</span><select class="i" name="region">${cfg.regions.map((r) => `<option value="${r}" ${c.region === r ? 'selected' : ''}>${t('region_' + r)}</option>`).join('')}</select></label>
          <label class="f"><span>${t('discord_req')}</span><input class="i" name="discord" required autocapitalize="none" value="${esc(state.me.account.discord || '')}" placeholder="discord.name"></label>
        </section>
        <div class="notice">${t('apply_rules')}</div>
        <button class="btn primary block">${t('apply_submit')}</button>
        <p class="err" data-err></p>
      </form>`);
  }

  // 头像：缩小到 512px 的 JPEG 再上传
  function shrinkPhoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 512 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- 后台 ----------
  async function pageAdmin() {
    if (!loggedIn()) return needLogin();
    const a = await api('/api/admin/overview');
    const tt = a.totals;
    const pend = a.pending.map((c) => `<div class="panel stack">
      <div class="row">${avatar(c.avatar, c.displayName, 'sm')}<b>${esc(c.displayName)}</b><span class="sub small">@${esc(c.name)} · Discord: ${esc(c.discord)}</span></div>
      <div class="sub small">${esc(c.headline || '')}</div>
      <div class="small">${Object.entries(c.games).map(([g, x]) => `${esc(gameName(g))} ${esc(rankText(g, x.ranks))} ${money(x.price)}${t('per_hour')}`).join(' · ')}</div>
      ${c.bio ? `<div class="bio small">${esc(c.bio)}</div>` : ''}
      <div class="row"><button class="btn sm ok" data-act="adm-c" data-name="${esc(c.name)}" data-v="approve">${t('approve')}</button><button class="btn sm danger" data-act="adm-c" data-name="${esc(c.name)}" data-v="reject" data-ask="1">${t('reject')}</button></div></div>`).join('');
    const disputes = a.disputes.map((o) => `<div class="panel stack">
      <div class="row between"><a class="link" href="#/o/${o.id}">#${o.id}</a><span class="small">${esc(o.buyer)} → ${esc(o.companion)} · ${money(o.total)}</span></div>
      <div class="notice">${esc(o.dispute.reason)}</div>
      <div class="row"><button class="btn sm" data-act="adm-o" data-id="${o.id}" data-v="refund">${t('refund')}</button><button class="btn sm" data-act="adm-o" data-id="${o.id}" data-v="release">${t('release')}</button></div></div>`).join('');
    const reports = a.reports.map((r) => `<div class="panel stack">
      <div class="small"><b>${esc(r.from)}</b> → <b>${esc(r.target)}</b>${r.orderId ? ` · <a class="link" href="#/o/${r.orderId}">#${r.orderId}</a>` : ''} · ${when(r.at)}</div>
      <div class="notice">${esc(r.reason)}</div>
      <div class="row"><button class="btn sm" data-act="adm-r" data-id="${r.id}">${t('close')}</button><button class="btn sm danger" data-act="adm-r" data-id="${r.id}" data-ban="1">${t('ban')}</button></div></div>`).join('');
    const comps = a.companions.map((c) => `<div class="oitem">${avatar(c.avatar, c.displayName, 'sm')}<div class="grow"><a href="#/c/${encodeURIComponent(c.name)}"><b>${esc(c.displayName)}</b></a> <span class="sub small">@${esc(c.name)} · ${t('orders_n', c.orders)}</span></div>
      <span class="chip">${t('cs_' + c.status)}</span>
      ${c.status === 'approved' ? `<button class="btn sm danger" data-act="adm-c" data-name="${esc(c.name)}" data-v="suspend" data-ask="1">${t('suspend')}</button>` : `<button class="btn sm" data-act="adm-c" data-name="${esc(c.name)}" data-v="restore">${t('restore')}</button>`}</div>`).join('');
    const sec = (title, n, html) => `<section class="stack"><h2>${title} (${n})</h2>${html || `<p class="sub">${t('nothing')}</p>`}</section>`;
    return shell('me', `<h1>${t('admin')}</h1>
      <div class="stats">
        <div class="stat"><span class="sub small">${t('users')}</span><b>${tt.users}</b></div>
        <div class="stat"><span class="sub small">${t('orders_total')}</span><b>${tt.orders}</b></div>
        <div class="stat"><span class="sub small">${t('gmv')}</span><b>${money(tt.gmv)}</b></div>
        <div class="stat"><span class="sub small">${t('revenue')}</span><b>${money(tt.revenue)}</b></div>
      </div>
      <div class="stack" style="margin-top:20px">
        ${sec(t('admin_pending'), a.pending.length, pend)}
        ${sec(t('admin_disputes'), a.disputes.length, disputes)}
        ${sec(t('admin_reports'), a.reports.length, reports)}
        ${sec(t('admin_companions'), a.companions.length, `<div class="olist">${comps}</div>`)}
      </div>`);
  }

  function pageRules() {
    return shell('me', `<div class="panel" style="max-width:720px"><h1>${t('rules')}</h1><ol class="rules">${RULES[state.lang].map((r) => `<li>${r}</li>`).join('')}</ol></div>`);
  }

  function needLogin() {
    state.afterLogin = location.hash;
    return pageAuth('login');
  }

  // ---------- 路由 ----------
  function paint(html) {
    $app.innerHTML = html;
    const box = $app.querySelector('[data-msgs]');
    if (box) box.scrollTop = box.scrollHeight;
  }

  let routeSeq = 0;
  async function route() {
    const seq = ++routeSeq;
    clearInterval(pollTimer);
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/').map(decodeURIComponent);
    state.page = null;
    let html;
    try {
      if (!a) html = await pageHome();
      else if (a === 'c' && b) html = await pageCompanion(b);
      else if (a === 'login' || a === 'signup') html = loggedIn() ? (go('#/me'), null) : pageAuth(a);
      else if (a === 'orders') html = await pageOrders(b);
      else if (a === 'o' && b) { html = await pageOrder(Number(b)); if (state.page) startPoll(Number(b)); }
      else if (a === 'me') html = await pageMe();
      else if (a === 'apply') html = await pageApply();
      else if (a === 'admin') html = await pageAdmin();
      else if (a === 'rules') html = pageRules();
      else throw Object.assign(new Error(t('not_found')), { status: 404 });
    } catch (e) {
      html = shell('', `<div class="empty panel">${esc(e.message)}<br><br><a class="link" href="#/">${t('back_home')}</a></div>`);
    }
    if (seq !== routeSeq || html === null) return; // 用户已经点去别的页面了
    paint(html);
    window.scrollTo(0, 0);
  }

  // ---------- 点击和表单 ----------
  const formData = (form) => Object.fromEntries(new FormData(form));
  const showErr = (form, e) => { const el = form.querySelector('[data-err]'); if (el) el.textContent = e.message; else toast(e.message); };

  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  $app.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const p = state.page;

    if (act === 'lang') {
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      storage.set('kaihei.lang', state.lang);
      document.documentElement.lang = state.lang;
      return route();
    }
    if (act === 'game') { state.filters.game = el.dataset.v; state.filters.rank = ''; return route(); }
    if (act === 'hours') {
      p.hours = Math.max(1, Math.min(state.config.maxHours, p.hours + Number(el.dataset.v)));
      return paint(renderCompanion(p));
    }
    if (act === 'report-open' || act === 'report-close') {
      p.reporting = act === 'report-open';
      return paint(p.o ? renderOrder(p) : renderCompanion(p));
    }
    if (act === 'dispute-open' || act === 'dispute-close') { p.disputing = act === 'dispute-open'; return paint(renderOrder(p)); }
    if (act === 'star') {
      p.stars = Number(el.dataset.v);
      el.parentElement.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i < p.stars));
      return;
    }
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(el.dataset.v); toast(t('copied')); } catch (e) { toast(el.dataset.v); }
      return;
    }
    if (act === 'o') {
      if (el.dataset.confirm && !confirm(t(el.dataset.confirm))) return;
      return busy(el, async () => {
        try {
          p.o = await api(`/api/orders/${p.o.id}/${el.dataset.v}`, { method: 'POST' });
          await loadMe();
          paint(renderOrder(p));
        } catch (e) { toast(e.message); }
      });
    }
    if (act === 'logout') {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
      setToken('');
      state.me = null;
      return go('#/');
    }
    if (act === 'adm-c') {
      const body = { action: el.dataset.v };
      if (el.dataset.ask) { const r = prompt(t('reason_ph')); if (r === null) return; body.reason = r; }
      return busy(el, async () => {
        try { await api('/api/admin/companions/' + encodeURIComponent(el.dataset.name), { method: 'POST', body }); route(); } catch (e) { toast(e.message); }
      });
    }
    if (act === 'adm-o') {
      const note = prompt(t('reason_ph'));
      if (note === null) return;
      return busy(el, async () => {
        try { await api(`/api/admin/orders/${el.dataset.id}/resolve`, { method: 'POST', body: { outcome: el.dataset.v, note } }); route(); } catch (e) { toast(e.message); }
      });
    }
    if (act === 'adm-r') {
      return busy(el, async () => {
        try { await api(`/api/admin/reports/${el.dataset.id}/close`, { method: 'POST', body: { ban: !!el.dataset.ban } }); route(); } catch (e) { toast(e.message); }
      });
    }
  });

  $app.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.dataset.filter) {
      state.filters[el.dataset.filter] = el.type === 'checkbox' ? el.checked : el.value;
      return route();
    }
    if (el.dataset.live === 'game') { state.page.game = el.value; return paint(renderCompanion(state.page)); }
    if (el.dataset.act === 'online') {
      try { await api('/api/companion/online', { method: 'POST', body: { online: el.checked } }); } catch (e) { el.checked = !el.checked; toast(e.message); }
      return;
    }
    if (el.dataset.act === 'photo' && el.files[0]) {
      try {
        state.page.avatarNew = await shrinkPhoto(el.files[0]);
        $app.querySelector('[data-avatar]').innerHTML = avatar(state.page.avatarNew, '', 'lg');
      } catch (e) { toast('Photo error'); }
    }
  });

  $app.addEventListener('input', (ev) => {
    if (ev.target.dataset.live === 'note') state.page.note = ev.target.value;
  });

  $app.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const kind = form.dataset.form;
    const btn = form.querySelector('button:not([type=button])');
    const d = formData(form);
    await busy(btn, async () => {
      try {
        if (kind === 'login' || kind === 'signup') {
          const body = kind === 'signup' ? { ...d, agree: !!d.agree } : d;
          const r = await api('/api/auth/' + kind, { method: 'POST', body });
          setToken(r.token);
          await loadMe();
          const back = state.afterLogin;
          state.afterLogin = null;
          return go(back && !/login|signup/.test(back) ? back : '#/');
        }
        if (kind === 'order') {
          if (!loggedIn()) { state.afterLogin = location.hash; return go('#/login'); }
          const p = state.page;
          const o = await api('/api/orders', { method: 'POST', body: { companion: p.c.name, game: p.game, hours: p.hours, note: p.note } });
          await loadMe();
          return go('#/o/' + o.id);
        }
        if (kind === 'msg') {
          if (!d.text.trim()) return;
          const p = state.page;
          p.o = await api(`/api/orders/${p.o.id}/messages`, { method: 'POST', body: { text: d.text } });
          form.reset();
          const box = $app.querySelector('[data-msgs]');
          box.innerHTML = msgsHtml(p.o);
          box.scrollTop = box.scrollHeight;
          form.querySelector('input').focus();
          return;
        }
        if (kind === 'review') {
          const p = state.page;
          p.o = await api(`/api/orders/${p.o.id}/review`, { method: 'POST', body: { stars: p.stars, text: d.text } });
          toast(t('thanks_review'));
          return paint(renderOrder(p));
        }
        if (kind === 'dispute') {
          const p = state.page;
          p.o = await api(`/api/orders/${p.o.id}/dispute`, { method: 'POST', body: { reason: d.reason } });
          p.disputing = false;
          return paint(renderOrder(p));
        }
        if (kind === 'report') {
          await api('/api/reports', { method: 'POST', body: { target: form.dataset.target, orderId: form.dataset.order || null, reason: d.reason } });
          state.page.reporting = false;
          toast(t('report_sent'));
          return paint(state.page.o ? renderOrder(state.page) : renderCompanion(state.page));
        }
        if (kind === 'account') {
          await api('/api/account', { method: 'PATCH', body: { discord: d.discord } });
          await loadMe();
          return toast(t('saved'));
        }
        if (kind === 'apply') {
          const fd = new FormData(form);
          const games = {};
          for (const key of Object.keys(state.config.games)) {
            if (!fd.get('offer_' + key)) continue;
            games[key] = { ranks: fd.getAll('rank_' + key), price: Math.round(Number(fd.get('price_' + key)) * 100) };
          }
          const body = {
            displayName: d.displayName, headline: d.headline, bio: d.bio, region: d.region, discord: d.discord,
            languages: fd.getAll('languages'), styles: fd.getAll('styles'), games
          };
          if (state.page.avatarNew) body.avatar = state.page.avatarNew;
          await api('/api/companion', { method: 'PUT', body });
          toast(t('saved'));
          return go('#/me');
        }
      } catch (e) { showErr(form, e); }
    });
  });

  window.addEventListener('hashchange', route);

  (async () => {
    document.documentElement.lang = state.lang;
    $app.innerHTML = `<div class="empty">${t('loading')}</div>`;
    state.config = await api('/api/config');
    await loadMe();
    route();
  })();
})();
