# trove

校园生活分享 App：发一条帖子，可以给出"值得 / 不值得"的结论，其他同学可以点同意或不同意。按照 Claude 里的 "生活分享 App 原型" 设计稿实现。

## 功能

- **注册 / 登录**：用户名 + 邮箱或手机号 + 密码注册；登录时邮箱、手机号、用户名都可以；也支持 "Continue with Google"（需要配置，见下文）
- **密码安全**：密码加盐加密（scrypt）保存，从不存明文；连续输错 5 次锁 15 分钟；改密码后其他设备自动退出
- **账号设置**（我的 → 齿轮 / Account & sign-in）：添加或修改邮箱、手机号，修改或设置密码，关联 / 解除 Google，退出登录
- **评论回复**：在帖子下提问；点任何一条评论就能回复它，回复会挂在那条评论下面，作者的回复带 "Author" 标记

- **首页**：双列瀑布流，可按 全部 / Worth it / Not worth it 筛选；直接在卡片上点同意（有结论的帖子）或点赞（纯分享帖）
- **搜索**：按标题、内容、地点、作者搜索，带快捷分类（Dorm、Food、Travel…）
- **发帖**：最多 4 张照片（自动压缩）、标题、正文、可选结论、地点、价格
- **详情**：同意 / 不同意投票和百分比条、关注作者、提问和回复、点赞、收藏
- **我的**：收藏的帖子、自己发的帖子、账号设置
- 跟随手机系统的深色模式；可以在手机上"添加到主屏幕"当 App 用

## 运行

需要 Node.js 18 或更高版本。

```bash
npm install
npm start          # 打开 http://localhost:3000
npm test           # 运行接口测试
```

### iPad / 手机上直接看（演示版）

`npm run build:demo` 会生成 `dist/trove-demo.html`：一个不需要服务器的单文件版本，逻辑和服务器完全一样（共用 `src/core.js`），数据存在浏览器里。

### 开通 Google 登录

1. 在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 创建 "OAuth 客户端 ID"（类型选 Web application）
2. "已获授权的重定向 URI" 填 `https://你的域名/api/auth/google/callback`（本地测试填 `http://localhost:3000/api/auth/google/callback`）
3. 启动时带上环境变量：

```bash
GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npm start
```

没配置时，Google 按钮会提示"还没开通"，邮箱和手机号登录不受影响。

数据保存在 `data/db.json`，照片在 `data/uploads/`（可以用环境变量 `DATA_DIR` 换位置，`PORT` 换端口）。第一次启动会放入设计稿里的 7 条示例帖子。

## 结构

```
server.js          启动入口
src/core.js        核心逻辑：账号、登录、帖子、投票、评论（服务器和演示版共用）
src/app.js         服务器（Express）：照片保存、Google 登录、把 /api 交给 core
src/store.js       JSON 文件读写
src/seed.js        示例数据
public/            前端（HTML / CSS / 原生 JS）；local-api.js 是演示版的浏览器内后端
scripts/           生成演示版
test/              接口测试
```

## API

需要登录的接口带请求头 `Authorization: Bearer <token>`（注册或登录时返回）。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/signup` | `{username, email 或 phone, password}` 注册 |
| POST | `/api/auth/login` | `{id: 邮箱/手机号/用户名, password}` 登录 |
| POST | `/api/auth/logout` | 退出 |
| POST | `/api/auth/google/start` | `{mode: "login" \| "link"}` 返回 Google 登录地址 |
| GET | `/api/account` | 账号信息 |
| PATCH | `/api/account` | `{email?, phone?, currentPassword}` 修改邮箱 / 手机号（传 null 删除） |
| POST | `/api/account/password` | `{currentPassword, newPassword}` 改密码 |
| DELETE | `/api/account/google` | 解除 Google |
| GET | `/api/notes?filter=all\|yes\|no&q=` | 帖子列表 |
| GET | `/api/notes/:id` | 单条帖子 |
| POST | `/api/notes` | 发帖 |
| POST | `/api/notes/:id/vote` | `{value: 1 \| -1 \| 0}` 同意 / 不同意 / 取消 |
| POST | `/api/notes/:id/like` | 点赞（切换） |
| POST | `/api/notes/:id/save` | 收藏（切换） |
| POST | `/api/notes/:id/questions` | `{text, replyTo?}` 提问，或回复某条评论 |
| POST | `/api/users/:name/follow` | 关注（切换） |
| GET | `/api/me` | 我的收藏、帖子和账号 |

## 目前的限制（下一步可以做）

- 邮箱和手机号还没有验证码验证（发邮件 / 短信需要接 SendGrid、Twilio 之类的服务），所以也还没有"忘记密码"
- 有人回复你时还没有通知
- 数据存在一个 JSON 文件里，适合原型和少量用户；用户多了要换成真正的数据库（如 SQLite / Postgres）
