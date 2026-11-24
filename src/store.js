// 数据存储。有两种：
//   FileStore —— 存在本地 JSON 文件里（自己电脑上运行时用）
//   PgStore   —— 存在 Postgres 数据库里（上线时用，比如 Neon）
// 两种对外的用法一样：
//   store.data          所有数据（core.js 直接读写它）
//   store.save()        标记"有改动"，安排写入
//   store.flush()       等所有改动真正写完
//   store.savePhoto()   保存照片，返回照片网址
//   store.getPhoto()    读取照片（只有数据库版需要）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('./seed');

const newPhotoName = (ext) => crypto.randomBytes(12).toString('hex') + '.' + ext;

class FileStore {
  constructor(file, uploadDir) {
    this.file = file;
    this.uploadDir = uploadDir;
    const exists = file && fs.existsSync(file);
    this.data = exists ? JSON.parse(fs.readFileSync(file, 'utf8')) : seed();
    if (!exists) this.save();
    if (uploadDir) fs.mkdirSync(uploadDir, { recursive: true });
  }

  save() {
    if (!this.file) return; // 内存模式
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // 先写临时文件再改名，避免写一半断电把文件写坏
  }

  async flush() {}

  async savePhoto(buf, mime, ext) {
    if (!this.uploadDir) throw new Error('Photo storage is not set up');
    const name = newPhotoName(ext);
    fs.writeFileSync(path.join(this.uploadDir, name), buf);
    return '/uploads/' + name;
  }
}

class PgStore {
  static async open(databaseUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: databaseUrl, max: 4 });
    await pool.query(`
      create table if not exists trove_state (
        id int primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      create table if not exists trove_photos (
        id text primary key,
        mime text not null,
        data bytea not null,
        created_at timestamptz not null default now()
      );
    `);
    const r = await pool.query('select data from trove_state where id = 1');
    const store = new PgStore(pool, r.rows.length ? r.rows[0].data : seed());
    if (!r.rows.length) {
      store.save();
      await store.flush();
    }
    return store;
  }

  constructor(pool, data) {
    this.pool = pool;
    this.data = data;
    this.dirty = false;
    this.pending = Promise.resolve();
  }

  // 改动排队依次写入；连续多次改动只写最新的一份
  save() {
    this.dirty = true;
    this.pending = this.pending.catch(() => {}).then(() => this.write());
  }

  async write() {
    if (!this.dirty) return;
    this.dirty = false;
    const json = JSON.stringify(this.data);
    try {
      await this.pool.query(
        `insert into trove_state (id, data, updated_at) values (1, $1, now())
         on conflict (id) do update set data = excluded.data, updated_at = now()`,
        [json]
      );
    } catch (e) {
      this.dirty = true; // 下次再试
      throw e;
    }
  }

  flush() {
    return this.pending;
  }

  async savePhoto(buf, mime, ext) {
    const name = newPhotoName(ext);
    await this.pool.query('insert into trove_photos (id, mime, data) values ($1, $2, $3)', [name, mime, buf]);
    return '/photos/' + name;
  }

  async getPhoto(name) {
    const r = await this.pool.query('select mime, data from trove_photos where id = $1', [name]);
    return r.rows[0] || null;
  }

  close() {
    return this.pool.end();
  }
}

// 有 DATABASE_URL 就用数据库，否则用本地文件
async function openStore({ databaseUrl, dataFile, uploadDir }) {
  if (databaseUrl) return PgStore.open(databaseUrl);
  return new FileStore(dataFile, uploadDir);
}

module.exports = { FileStore, PgStore, openStore };
