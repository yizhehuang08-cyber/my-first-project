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
  return { lastId: notes.length, notes, users: {} };
};
