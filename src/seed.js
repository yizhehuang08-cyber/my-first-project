// 第一次启动时放进去的示例帖子（来自设计稿）。
module.exports = function seed() {
  const raw = [
    { title: 'Mattress topper for the Allen Hall beds', author: 'maya.c', worth: true, price: '$35', place: 'Target', agree: 212, disagree: 9, likes: 0, t: 0, body: 'The dorm mattress is thin and hard. A 2-inch topper fixed it on night one. Get the twin XL size, the regular twin is too short.' },
    { title: 'First snow on the Main Quad', author: 'sofia.p', worth: null, price: '', place: 'Main Quad', agree: 0, disagree: 0, likes: 342, t: 1, body: 'Walked out of a 9am and the whole Quad was white. Champaign winters are cold, but mornings like this make up for it.' },
    { title: 'Late-night ramen on Green St', author: 'jt.eats', worth: true, price: '$14', place: 'Green St', agree: 148, disagree: 21, likes: 0, t: 2, body: 'Open past midnight, big portions, quick service. Go spicy miso and add an egg. Expect a short line after 10pm on weekends.' },
    { title: 'A wool coat alone for a Champaign winter', author: 'noah.k', worth: false, price: '', place: 'Main Quad', agree: 175, disagree: 38, likes: 0, t: 3, body: 'It looks great, but the wind on the Quad goes right through it. Worth it only with a thin down layer underneath, plus gloves and a hat.' },
    { title: 'My Allen Hall desk setup', author: 'kev.z', worth: null, price: '', place: 'Allen Hall', agree: 0, disagree: 0, likes: 188, t: 5, body: 'Small double, so everything goes vertical: a monitor arm, a shelf riser and a clip lamp. Total cost was less than one textbook.' },
    { title: 'A carry-on that fits United', author: 'ryan.h', worth: true, price: '$129', place: 'T.J. Maxx', agree: 96, disagree: 4, likes: 0, t: 4, body: 'Check the tag for exterior size including wheels: 22 × 14 × 9 inches or less. Most 20-inch spinners pass. Anything labeled 24 inches is a checked bag.' },
    { title: 'Sawgrass Mills on the way to FLL', author: 'ana.m', worth: true, price: '', place: 'Sunrise, FL', agree: 83, disagree: 6, likes: 0, t: 0, body: 'Huge outlet mall about 20–30 minutes from FLL. Shop with your carry-on, then take a ride straight to the airport.' }
  ];
  const start = Date.parse('2026-11-20T12:00:00Z');
  const notes = raw.map((n, i) => ({
    id: i + 1,
    author: n.author,
    title: n.title,
    body: n.body,
    worth: n.worth,
    place: n.place,
    price: n.price,
    photos: [],
    tint: n.t,
    votes: {},
    likes: [],
    baseAgree: n.agree,
    baseDisagree: n.disagree,
    baseLikes: n.likes,
    questions: [],
    createdAt: new Date(start - i * 3600 * 1000).toISOString()
  }));
  // 示例对话：一个提问 + 作者的回复
  const ramen = notes.find((n) => n.author === 'jt.eats');
  ramen.questions = [
    { id: 8, author: 'amy.l', text: 'Do they take cards or is it cash only?', replyTo: null, createdAt: '2026-11-21T02:00:00.000Z' },
    { id: 9, author: 'jt.eats', text: 'Cards are fine. Tap to pay works too.', replyTo: 8, createdAt: '2026-11-21T02:30:00.000Z' }
  ];
  // 给 ryan.h 准备的示例通知：别人回复了 ryan.h 的评论，以及有人在 ryan.h 的帖子下提问
  const topper = notes.find((n) => n.author === 'maya.c');
  topper.questions = [
    { id: 10, author: 'ryan.h', text: 'Does it fit under a fitted sheet, or does it slide around?', replyTo: null, createdAt: '2026-11-22T18:00:00.000Z' },
    { id: 11, author: 'maya.c', text: 'It stays put with a deep-pocket sheet. A regular one pops off.', replyTo: 10, createdAt: '2026-11-22T19:10:00.000Z' }
  ];
  const carryOn = notes.find((n) => n.author === 'ryan.h');
  carryOn.questions = [
    { id: 12, author: 'amy.l', text: 'Did the T.J. Maxx one have a warranty?', replyTo: null, createdAt: '2026-11-23T15:20:00.000Z' }
  ];
  // 示例作者的用户名先占上（没有任何登录方式，别人不能冒用）。
  // ryan.h 不占：那是你自己的示例帖子，你注册 ryan.h 就能拥有它。
  const users = {};
  for (const name of new Set(notes.map((n) => n.author).concat('amy.l'))) {
    if (name === 'ryan.h') continue;
    users[name] = { name, email: null, phone: null, pass: null, google: null, saved: [], following: [], notifSeenAt: null, createdAt: notes[0].createdAt };
  }
  return { lastId: 12, notes, users, sessions: {} };
};
