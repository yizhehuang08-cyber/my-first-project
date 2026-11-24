# trove

校园生活分享 App：发一条帖子，可以给出"值得 / 不值得"的结论，其他同学可以点同意或不同意。按照 Claude 里的 "生活分享 App 原型" 设计稿实现。

## 功能

- **首页**：双列瀑布流，可按 全部 / Worth it / Not worth it 筛选；直接在卡片上点同意（有结论的帖子）或点赞（纯分享帖）
- **搜索**：按标题、内容、地点、作者搜索，带快捷分类（Dorm、Food、Travel…）
- **发帖**：最多 4 张照片（自动压缩）、标题、正文、可选结论、地点、价格
- **详情**：同意 / 不同意投票和百分比条、关注作者、向作者提问、点赞、收藏
- **我的**：收藏的帖子、自己发的帖子、切换用户
- 跟随手机系统的深色模式；可以在手机上"添加到主屏幕"当 App 用

## 运行

需要 Node.js 18 或更高版本。

```bash
npm install
npm start          # 打开 http://localhost:3000
npm test           # 运行接口测试
```

数据保存在 `data/db.json`，照片在 `data/uploads/`（可以用环境变量 `DATA_DIR` 换位置，`PORT` 换端口）。第一次启动会放入设计稿里的 7 条示例帖子。

## 结构

```
server.js          启动入口
src/app.js         后端 API（Express）
src/store.js       JSON 文件数据库
src/seed.js        示例数据
public/            前端（HTML / CSS / 原生 JS）
test/              接口测试
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/notes?filter=all\|yes\|no&q=` | 帖子列表 |
| GET | `/api/notes/:id` | 单条帖子 |
| POST | `/api/notes` | 发帖 |
| POST | `/api/notes/:id/vote` | `{value: 1 \| -1 \| 0}` 同意 / 不同意 / 取消 |
| POST | `/api/notes/:id/like` | 点赞（切换） |
| POST | `/api/notes/:id/save` | 收藏（切换） |
| POST | `/api/notes/:id/questions` | 向作者提问 `{text}` |
| POST | `/api/users/:name/follow` | 关注（切换） |
| GET | `/api/me` | 我的收藏和帖子 |

写操作需要请求头 `X-User: 用户名`。

## 目前的限制（下一步可以做）

- 只有用户名、没有密码，任何人都能用别人的名字登录，不适合正式上线
- 作者还不能回答问题，也收不到通知
- 数据存在一个 JSON 文件里，适合原型和少量用户；用户多了要换成真正的数据库（如 SQLite / Postgres）
