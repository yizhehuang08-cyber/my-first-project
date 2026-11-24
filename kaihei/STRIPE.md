# 给 KaiHei 接上 Stripe

做完以后：
- 买家下单 → 跳到 Stripe 付款页（信用卡 / Apple Pay / Google Pay / 支付宝 / 微信支付）→ 付款后订单变成“等待接单”
- 陪玩师在“我的”里点 **设置收款账户**，在 Stripe 填一次身份信息和银行卡，之后才会出现在首页
- 买家确认完成 → 自动把 85% 转给陪玩师；取消、超时、客服判退款 → 自动退款

**先用测试模式（Sandbox / Test mode）把整个流程跑通，不会扣真钱。** 网站上的按钮名字可能和这里写的略有不同，找意思相近的就行。

> ⚠️ 所有 `sk_...`、`whsec_...` 开头的密钥：**只粘贴到 Render 的 Environment 里**，不要发到聊天里、不要截图、不要写进代码。

---

## 第 1 步：注册 Stripe

1. 打开 **https://dashboard.stripe.com/register** 注册
2. 注册好后确认左上角或右上角是 **Sandbox / Test mode**（测试模式）。先不用点 “Activate account”

## 第 2 步：开通 Connect（陪玩师收款用）

1. 左边菜单找 **Connect**（找不到就在顶部搜索框搜 "Connect"）→ **Get started**
2. 问你是什么平台时，选 **Marketplace**（买家付款给平台，平台再分给卖家）
3. 账户类型选 **Express**
4. 如果让你填 **Platform profile**（平台资料），照实填：线上游戏陪玩撮合平台，陪玩师是独立个人，平台代收款并在服务完成后分账
5. **Connect → Settings → Branding**：填上平台名字 `KaiHei` 和图标、颜色（陪玩师设置收款时会看到）

## 第 3 步：打开付款方式

**Settings → Payment methods**（付款方式），打开你想支持的：
- Cards（信用卡，默认开着）
- Apple Pay / Google Pay
- **Alipay（支付宝）**、**WeChat Pay（微信支付）**

付款页会自动显示开着的方式。

## 第 4 步：把密钥放进 Render

1. Stripe：**Developers → API keys**，复制 **Secret key**（`sk_test_` 开头）
2. Render → **kaihei** → **Environment** → **Edit** → 加一行：
   - `STRIPE_SECRET_KEY` = 刚才复制的
3. 保存，等重新部署。Logs 里应该看到 `Stripe 已开启（测试模式）`

## 第 5 步：Webhook（让 Stripe 通知网站“付款成功了”）

Stripe：**Developers → Webhooks**（也可能叫 **Event destinations**）→ **Add endpoint / Add destination**

**A. 平台自己的事件**
- 事件来源选 **Your account**
- 地址（Endpoint URL）：`https://kaihei-v4nx.onrender.com/api/stripe/webhook`
- 要监听的事件（Select events）勾这 4 个：
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
- 创建后，在这个 endpoint 页面点 **Signing secret → Reveal**，复制 `whsec_` 开头的那串

**B. 陪玩师收款账户的事件**（可选，但建议加：陪玩师账户被 Stripe 限制时会自动下架）
- 再加一个，事件来源选 **Connected accounts**
- 地址一样：`https://kaihei-v4nx.onrender.com/api/stripe/webhook`
- 事件勾 `account.updated`
- 同样复制它的 `whsec_` 签名密钥

**放进 Render：** kaihei → Environment → 加一行
- `STRIPE_WEBHOOK_SECRET` = A 的密钥；如果也做了 B，写成 `A的密钥,B的密钥`（中间英文逗号，不要空格也行）

保存，等重新部署。Logs 里不再出现“还没设置 STRIPE_WEBHOOK_SECRET”就对了。

---

## 第 6 步：测试一遍

1. **陪玩师**：登录 → 我的 → **设置收款账户** → 跳到 Stripe。测试模式下可以用 Stripe 给的测试资料：
   - 手机验证码填 `000000`
   - SSN 填 `000-00-0000`，地址随便填一个美国地址
   - 银行账户选 **Use test account**（测试银行账户）
   - 填完回到网站，“我的”里显示 **收款账户已开通 ✓**，首页就能看到你了
2. **买家**：换一个账号（或用手机），找到陪玩师 → 下单 → 在 Stripe 付款页用测试卡：
   - 卡号 `4242 4242 4242 4242`，有效期填任何未来日期（比如 `12/34`），CVC 随便 3 位，邮编随便
3. 付款后回到订单页，几秒内变成 **等待接单**（如果一直是“待付款”，多半是 Webhook 没设置好，见下面）
4. 陪玩师接单 → 标记完成 → 买家确认 → Stripe 后台 **Connect → Transfers**（或 Balances）能看到转给陪玩师的钱
5. 再下一单，付款后在接单前点 **取消订单** → Stripe 后台 **Payments** 里能看到退款

**付款后订单一直是“待付款”？**
- Stripe → Webhooks → 点你的 endpoint，看最近的事件是不是失败（红色）
  - `400 Bad signature`：`STRIPE_WEBHOOK_SECRET` 填错了（注意是这个 endpoint 自己的 `whsec_`，不是 API key）
  - `400 Webhook secret is not set`：Render 里没填 `STRIPE_WEBHOOK_SECRET`
- 改好后在 Stripe 的事件详情里点 **Resend**，订单会自动更新

---

## 正式收钱（切换到 Live）

**先做完这些再切换：**
1. 确认你的签证身份允许经营（F-1 学生务必先问学校国际学生办公室）
2. 联系 Stripe 确认他们接受这个业务类型（游戏陪玩 / 教学撮合平台）
3. Stripe 里点 **Activate account**，按要求填个人（或公司）信息和你自己的银行账户（平台抽成会打到这里）
4. 写好用户协议和隐私政策

**然后：**
1. Stripe 切到 **Live mode**，Connect 和付款方式在 Live 模式下也要再确认一遍
2. 复制 **Live** 的 Secret key（`sk_live_`），在 Live 模式下**重新建一遍**第 5 步的 Webhook（Live 和测试的 Webhook 是分开的，签名密钥也不同）
3. Render 里把 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET` 换成 Live 的
4. Logs 里看到 `Stripe 已开启（正式模式，会扣真钱）`
5. 测试模式下设置的陪玩师收款账户在 Live 里不存在，陪玩师需要**重新设置一次**收款账户（他们会暂时从首页下架，设置好就回来）

## 钱的细节

- Stripe 手续费（比如信用卡大约 2.9% + 30¢）从平台的 15% 里出，陪玩师拿到的是订单金额的 85%
- 订单完成时，转账会关联到这笔付款（`source_transaction`），所以即使买家的钱还在 Stripe 的结算等待期，也能转给陪玩师，陪玩师到账时间跟着这笔付款走
- 转账 / 退款失败（比如 Stripe 临时出错）会自动重试（2、4、8…分钟，最多每小时一次），后台管理页面的“转账 / 退款出错”里能看到原因；同一笔不会重复转
- 如果买家在订单完成后找信用卡公司拒付（chargeback），钱已经转给陪玩师了，这部分损失由平台承担。Stripe 后台会通知你，可以在那里提交证据（订单聊天记录等）
