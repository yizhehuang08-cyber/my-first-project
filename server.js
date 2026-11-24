const path = require('path');
const { createApp } = require('./src/app');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const app = createApp({
  dataFile: path.join(dataDir, 'db.json'),
  uploadDir: path.join(dataDir, 'uploads'),
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
app.listen(port, () => {
  console.log(`trove 已启动：http://localhost:${port}`);
  if (!process.env.GOOGLE_CLIENT_ID) console.log('（还没设置 GOOGLE_CLIENT_ID，Google 登录按钮会提示未开通）');
});
