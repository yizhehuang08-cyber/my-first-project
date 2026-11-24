// 生成一个不需要服务器的单文件演示版：dist/trove-demo.html
// 用法：npm run build:demo
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
// 防止脚本内容里出现 </script> 提前结束标签
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

const seed = `window.TROVE_SEED = (function () { const module = {}; ${read('src/seed.js')}; return module.exports; })();`;

let html = read('public/index.html')
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="preconnect"[^>]*>\n/, '')
  .replace('<link rel="stylesheet" href="/app.css">', () => `<style>\n${read('public/app.css')}\n</style>`)
  .replace('<script src="/app.js"></script>', () =>
    `<script>\n${safe(seed)}\n</script>\n<script>\n${safe(read('src/core.js'))}\n</script>\n<script>\n${safe(read('public/local-api.js'))}\n</script>\n<script>\n${safe(read('public/app.js'))}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'trove-demo.html');
fs.writeFileSync(out, html);
console.log('已生成', path.relative(root, out), `(${Math.round(html.length / 1024)} KB)`);
