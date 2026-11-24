'use strict';
const path = require('path');
const { createApp } = require('./src/app');
const { openStore } = require('./src/store');

async function main() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const store = await openStore({
    databaseUrl: process.env.DATABASE_URL,
    dataFile: path.join(dataDir, 'db.json'),
    uploadDir: path.join(dataDir, 'uploads')
  });

  const admins = String(process.env.ADMIN_USERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const feeRate = process.env.FEE_RATE ? Number(process.env.FEE_RATE) : undefined;
  const app = createApp({ store, admins, feeRate });
  app.set('trust proxy', 1);

  const port = Number(process.env.PORT) || 3001;
  const server = app.listen(port, () => {
    console.log(`KaiHei 已启动：http://localhost:${port}（数据存在${process.env.DATABASE_URL ? '数据库' : '本地文件'}里）`);
    if (!admins.length) console.log('（还没设置 ADMIN_USERS，没有人能进后台审核陪玩师）');
  });

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
