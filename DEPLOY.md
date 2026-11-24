# 把 trove 放到网上（免费：Render + Neon）

做完以后你会得到一个 `https://trove-xxxx.onrender.com` 这样的网址，发给同学，用手机打开就能注册使用。

大约需要 15 分钟。网站上的按钮名字可能和这里写的略有不同，找意思相近的就行。

---

## 第 0 步：代码要在 `main` 分支上

Render 默认从 `main` 分支部署。如果代码还在 `claude/...` 分支上，先在 GitHub 上把它合并到 `main`（可以让 Claude 帮你开一个 Pull Request，你点 **Merge** 就行）。

---

## 第 1 步：在 Neon 创建数据库（存账号、帖子、照片）

1. 打开 **https://neon.tech** ，点 **Sign up**，选 **Continue with GitHub**
2. 创建项目（Create project）：
   - Project name：`trove`
   - Postgres version：默认即可
   - Region：选 **AWS US East 2 (Ohio)**（和下面 Render 的机房在同一个地方，速度最快）
3. 创建好后，在项目首页点 **Connect**（或 "Connection string"）
4. 复制那一长串以 `postgresql://` 开头的地址，它大概长这样：

   ```
   postgresql://neondb_owner:一串密码@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

> ⚠️ 这串地址里含有数据库密码。**不要发到群里，不要写进代码**，只粘贴到下一步 Render 的设置里。

---

## 第 2 步：在 Render 部署 App

1. 打开 **https://render.com** ，点 **Get Started**，选 **GitHub** 登录
2. 右上角点 **New +** → **Blueprint**
3. 第一次会让你连接 GitHub：授权 Render 访问 `my-first-project` 这个仓库
4. 选择 `my-first-project` 仓库，分支选 `main`
5. Render 会读到仓库里的 `render.yaml`，显示要创建一个叫 **trove** 的 Web Service（Free）
6. 它会让你填 **DATABASE_URL**：把第 1 步复制的那串地址粘贴进去
7. 点 **Apply**（或 Deploy Blueprint）
8. 等 2–5 分钟。在 trove 服务的 **Logs** 里看到这行就说明成功了：

   ```
   trove 已启动：http://localhost:10000（数据存在数据库里）
   ```

   一定要是 **"数据库"**。如果写的是"本地文件"，说明 DATABASE_URL 没填上，数据会在重启时丢失，回到服务的 **Environment** 里补上。

9. 页面上方会显示网址，比如 `https://trove-abcd.onrender.com`，点开就是你的 App 🎉

---

## 第 3 步：自己先试一下

1. 用手机打开网址，注册一个账号（比如 `ryan.h`），发一条带照片的帖子
2. 换另一个浏览器或让同学注册，互相评论、回复，看通知红点
3. iPhone：Safari 打开网址 → 分享按钮 → **添加到主屏幕**，桌面上就有 trove 图标了

---

## 以后

- **更新**：代码每次合并到 `main`，Render 会自动重新部署，几分钟后大家刷新就是新版本
- **第一次打开很慢？** 免费版 15 分钟没人用会"睡着"，下一个人打开要等 30–60 秒，之后就正常了
- **看数据**：Neon 网站上点 **Tables** 可以看到 `trove_state`（所有数据）和 `trove_photos`（照片）
- **出问题**：先看 Render 里 trove 服务的 **Logs**，把最后几行红字发给 Claude

## 下一步可以做

- **Google 登录**：有了正式网址就可以开通，步骤在 README 的"开通 Google 登录"。重定向地址填 `https://你的网址/api/auth/google/callback`，然后把 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 加到 Render 服务的 **Environment** 里
- **自己的域名**（比如 trove.app）：Render 服务的 **Settings → Custom Domains**
