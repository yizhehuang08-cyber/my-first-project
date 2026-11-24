const path = require('path');
const { createApp } = require('./src/app');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const app = createApp({
  dataFile: path.join(dataDir, 'db.json'),
  uploadDir: path.join(dataDir, 'uploads')
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`trove 已启动：http://localhost:${port}`);
});
