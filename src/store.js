// 简单的 JSON 文件数据库：所有数据存在一个文件里，写入时先写临时文件再改名，避免写坏。
const fs = require('fs');
const path = require('path');
const seed = require('./seed');

class Store {
  constructor(file) {
    this.file = file;
    if (file && fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      this.data = seed();
      this.save();
    }
  }

  save() {
    if (!this.file) return; // 内存模式（测试用）
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  nextId() {
    this.data.lastId = (this.data.lastId || 0) + 1;
    return this.data.lastId;
  }

  // ---- 帖子 ----
  listNotes() {
    return [...this.data.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getNote(id) {
    return this.data.notes.find((n) => n.id === id) || null;
  }

  addNote({ author, title, body, worth, place, price, photos }) {
    const note = {
      id: this.nextId(),
      author,
      title,
      body,
      worth, // true = 值得, false = 不值得, null = 纯分享
      place: place || '',
      price: price || '',
      photos: photos || [],
      tint: Math.floor(Math.random() * 6),
      votes: {}, // 用户名 -> 1 同意 / -1 不同意
      likes: [], // 点赞的用户名
      baseAgree: 0,
      baseDisagree: 0,
      baseLikes: 0,
      questions: [],
      createdAt: new Date().toISOString()
    };
    this.data.notes.push(note);
    this.save();
    return note;
  }

  vote(note, user, value) {
    if (value === 0) delete note.votes[user];
    else note.votes[user] = value;
    this.save();
  }

  toggleLike(note, user) {
    const i = note.likes.indexOf(user);
    if (i >= 0) note.likes.splice(i, 1);
    else note.likes.push(user);
    this.save();
    return i < 0;
  }

  addQuestion(note, user, text) {
    const q = { id: this.nextId(), author: user, text, createdAt: new Date().toISOString() };
    note.questions.push(q);
    this.save();
    return q;
  }

  // ---- 用户 ----
  getUser(name) {
    if (!this.data.users[name]) {
      this.data.users[name] = { name, saved: [], following: [], createdAt: new Date().toISOString() };
      this.save();
    }
    return this.data.users[name];
  }

  toggleSave(user, noteId) {
    const u = this.getUser(user);
    const i = u.saved.indexOf(noteId);
    if (i >= 0) u.saved.splice(i, 1);
    else u.saved.push(noteId);
    this.save();
    return i < 0;
  }

  toggleFollow(user, target) {
    const u = this.getUser(user);
    const i = u.following.indexOf(target);
    if (i >= 0) u.following.splice(i, 1);
    else u.following.push(target);
    this.save();
    return i < 0;
  }
}

module.exports = Store;
