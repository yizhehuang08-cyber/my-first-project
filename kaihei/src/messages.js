// 服务器返回的错误提示：中文 / 英文两份。前端请求头带 X-Lang: zh 或 en。
'use strict';

const M = {
  password_short: ['密码至少 {n} 位', 'Password must be at least {n} characters'],
  password_long: ['密码太长了', 'Password is too long'],
  bad_discord: ['Discord 用户名格式不对（2–32 位小写字母、数字、. 或 _）', 'Discord username: 2–32 lowercase letters, numbers, . or _'],
  bad_username: ['用户名：2–20 位小写字母、数字、. 或 _', 'Username: 2–20 lowercase letters, numbers, . or _'],
  username_taken: ['这个用户名已经被用了', 'That username is taken'],
  bad_email: ['邮箱格式不对', 'That email does not look right'],
  email_taken: ['这个邮箱已经注册过了', 'That email already has an account'],
  bad_birth_date: ['请填写正确的生日', 'Enter a valid date of birth'],
  too_young: ['需要年满 {n} 岁才能使用', 'You must be at least {n} to use KaiHei'],
  must_agree: ['请先阅读并同意平台规则', 'Please read and agree to the rules'],
  login_missing: ['请输入账号和密码', 'Enter your username or email and password'],
  login_locked: ['输错次数太多，请 {m} 分钟后再试', 'Too many tries. Try again in {m} min'],
  login_wrong: ['账号或密码不对', 'Wrong username/email or password'],
  login_required: ['请先登录', 'Please log in'],
  banned: ['这个账号已被封禁', 'This account has been banned'],
  companion_suspended: ['你的陪玩资格已被暂停，请联系客服', 'Your companion profile is suspended. Contact support'],
  need_display_name: ['请填写昵称', 'Add a display name'],
  bad_rank: ['请选择 {game} 可陪段位（可多选）', 'Pick the {game} ranks you can play (one or more)'],
  bad_price: ['价格需要在每小时 ${min}–${max} 之间', 'Price must be ${min}–${max} per hour'],
  need_game: ['至少选择一款游戏', 'Pick at least one game'],
  need_language: ['至少选择一种语言', 'Pick at least one language'],
  need_style: ['至少选择一种陪玩类型', 'Pick at least one play style'],
  bad_region: ['请选择服务器地区', 'Pick your server region'],
  need_discord: ['请先填写 Discord 用户名', 'Add your Discord username first'],
  not_approved: ['资料审核通过后才能接单', 'Your profile must be approved first'],
  companion_not_found: ['找不到这位陪玩师', 'Companion not found'],
  order_self: ['不能给自己下单', 'You cannot order yourself'],
  game_not_offered: ['这位陪玩师不陪这款游戏', 'This companion does not offer that game'],
  bad_hours: ['时长：1–{max} 小时', 'Hours: 1–{max}'],
  too_many_open: ['和这位陪玩师还有未完成的订单', 'You already have open orders with this companion'],
  order_not_found: ['找不到这个订单', 'Order not found'],
  not_allowed: ['没有权限', 'Not allowed'],
  bad_state: ['订单状态已经变了，请刷新', 'The order has changed. Refresh and try again'],
  need_reason: ['请写一下原因', 'Please describe the reason'],
  already_reviewed: ['已经评价过了', 'You already left a review'],
  bad_stars: ['请选择 1–5 星', 'Pick 1–5 stars'],
  chat_closed: ['订单已结束，不能再发消息', 'This order is closed'],
  empty_message: ['写点什么吧', 'Write something first'],
  bad_report_target: ['找不到要举报的用户', 'Unknown user'],
  bad_action: ['操作不对', 'Unknown action'],
  bad_photo: ['照片需要是 JPG、PNG 或 WebP', 'Photos must be JPG, PNG or WebP'],
  photo_big: ['照片需要小于 2 MB', 'Photo must be under 2 MB'],
  not_found: ['找不到', 'Not found'],
  server_error: ['服务器出错了，请稍后再试', 'Something went wrong on the server'],
  bad_request: ['请求格式不对', 'Bad request']
};

function msg(code, lang, params = {}) {
  const pair = M[code] || M.server_error;
  const text = pair[lang === 'zh' ? 0 : 1];
  return text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}

module.exports = { msg, CODES: Object.keys(M) };
