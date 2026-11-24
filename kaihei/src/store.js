// 数据存储（和 trove 一样的做法）：
//   FileStore —— 本地 JSON 文件（自己电脑上运行时用）
//   PgStore   —— Postgres 数据库（上线时用，比如 Neon）
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const newPhotoName = (ext) => crypto.randomBytes(12).toString('hex') + '.' + ext;

class FileStore {
  constructor(file, uploadDir) {
    this.file = file;
    this.uploadDir = uploadDir;
    const exists = file && fs.existsSync(file);
    this.data = exists ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    if (uploadDir) fs.mkdirSync(uploadDir, { recursive: true });
  }

  save() {
    if (!this.file) return; // 内存模式
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  async flush() {}

  async savePhoto(buf, mime, ext) {
    if (!this.uploadDir) return `data:${mime};base64,${buf.toString('base64')}`; // 内存模式（测试）
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
      create table if not exists kaihei_state (
        id int primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      create table if not exists kaihei_photos (
        id text primary key,
        mime text not null,
        data bytea not null,
        created_at timestamptz not null default now()
      );
    `);
    const r = await pool.query('select data from kaihei_state where id = 1');
    return new PgStore(pool, r.rows.length ? r.rows[0].data : {});
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
    try {
      await this.pool.query(
        `insert into kaihei_state (id, data, updated_at) values (1, $1, now())
         on conflict (id) do update set data = excluded.data, updated_at = now()`,
        [JSON.stringify(this.data)]
      );
    } catch (e) {
      this.dirty = true;
      throw e;
    }
  }

  flush() { return this.pending; }

  async savePhoto(buf, mime, ext) {
    const name = newPhotoName(ext);
    await this.pool.query('insert into kaihei_photos (id, mime, data) values ($1, $2, $3)', [name, mime, buf]);
    return '/photos/' + name;
  }

  async getPhoto(name) {
    const r = await this.pool.query('select mime, data from kaihei_photos where id = $1', [name]);
    return r.rows[0] || null;
  }

  close() { return this.pool.end(); }
}

async function openStore({ databaseUrl, dataFile, uploadDir }) {
  if (databaseUrl) return PgStore.open(databaseUrl);
  return new FileStore(dataFile, uploadDir);
}

module.exports = { FileStore, PgStore, openStore };
