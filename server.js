const path = require('path');
const { createApp } = require('./src/app');
const { openStore } = require('./src/store');

async function main() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  // 设置了 DATABASE_URL 就用数据库（上线时），否则存本地文件
  const store = await openStore({
    databaseUrl: process.env.DATABASE_URL,
    dataFile: path.join(dataDir, 'db.json'),
    uploadDir: path.join(dataDir, 'uploads')
  });

  const app = createApp({
    store,
    // 设置了这两个环境变量，"Continue with Google" 才会真正可用（见 README）
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    }
  });

  // 部署在 HTTPS 代理后面时，让 req.protocol 认出 https
  app.set('trust proxy', 1);

  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    console.log(`trove 已启动：http://localhost:${port}（数据存在${process.env.DATABASE_URL ? '数据库' : '本地文件'}里）`);
    if (!process.env.GOOGLE_CLIENT_ID) console.log('（还没设置 GOOGLE_CLIENT_ID，Google 登录按钮会提示未开通）');
  });

  // 平台重启服务时：先把没写完的数据写完再退出
  const shutdown = async () => {
    server.close();
    try { await store.flush(); } catch (e) { console.error('退出前保存失败', e); }
    if (store.close) await store.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error('启动失败：', e.message);
  process.exit(1);
});
