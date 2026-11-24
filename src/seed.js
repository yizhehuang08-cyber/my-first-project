// 新数据库的初始内容：空的，没有示例帖子。
function seed() {
  return { lastId: 0, notes: [], users: {}, sessions: {}, samplesRemoved: true };
}

// 早期版本放过的示例帖子和示例作者（作者 + 标题）。
// 旧数据库启动时会按这份名单把它们清理掉，见 core.js 的 removeSamples。
const SAMPLE_NOTES = [
  ['maya.c', 'Mattress topper for the Allen Hall beds'],
  ['sofia.p', 'First snow on the Main Quad'],
  ['jt.eats', 'Late-night ramen on Green St'],
  ['noah.k', 'A wool coat alone for a Champaign winter'],
  ['kev.z', 'My Allen Hall desk setup'],
  ['ryan.h', 'A carry-on that fits United'],
  ['ana.m', 'Sawgrass Mills on the way to FLL']
];
const SAMPLE_AUTHORS = ['maya.c', 'sofia.p', 'jt.eats', 'noah.k', 'kev.z', 'ana.m', 'amy.l'];

seed.SAMPLE_NOTES = SAMPLE_NOTES;
seed.SAMPLE_AUTHORS = SAMPLE_AUTHORS;
module.exports = seed;
