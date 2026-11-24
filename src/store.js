// 数据文件：所有数据存在一个 JSON 文件里，写入时先写临时文件再改名，避免写坏。
const fs = require('fs');
const path = require('path');
const seed = require('./seed');

class Store {
  constructor(file) {
    this.file = file;
    this.data = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : seed();
    if (!file || !fs.existsSync(file)) this.save();
  }

  save() {
    if (!this.file) return; // 内存模式
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = Store;
