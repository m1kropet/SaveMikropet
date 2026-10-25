// Тест лучшего бота (навык 0.95): все карты × все сложности, несколько сидов и отрядов.
// Запуск: node test/bestbot.js [сиды=3] [макс. волн бесконечного=100]
require('../js/data.js'); require('../js/sim.js'); require('../js/bot.js');
const K = globalThis.KV;
const SEEDS = +(process.argv[2] || 3), ENDLESS_CAP = +(process.argv[3] || 100);
const SQUADS = { 'Бластер·Морозилка·Диномайк·Громовержец': ['blaster', 'ice', 'dragon', 'storm'], 'Реалганер·Громовержец·Морозилка·Диномайк': ['prism', 'storm', 'ice', 'dragon'] };
const DIFFS = ['easy', 'normal', 'hard', 'endless'];
const rows = [];
function run(map, diff, seed, squad) {
  const f = new K.Field({ map, diff, seed, squad, autoWave: true, record: false });
  const b = new K.Bot(f, 0.95); let i = 0;
  const cap = diff === 'endless' ? ENDLESS_CAP : Infinity;
  while (!f.over && f.wavesCleared < cap && i < 60 * 60 * 180) { b.tick(1 / 60); f.step(1 / 60); i++; }
  return { win: f.result === 'win', waves: f.wavesCleared, hp: f.hp, maxHp: f.maxHp, min: Math.round(i / 60 / 60) };
}
for (const [sqName, squad] of Object.entries(SQUADS)) for (const diff of DIFFS) for (const m of K.MAPS) {
  const res = []; for (let s = 1; s <= SEEDS; s++) res.push(run(m.id, diff, 1000 + s * 77, squad));
  rows.push({ squad: sqName, diff, map: m.name, res });
  const txt = res.map(r => diff === 'endless' ? 'в' + r.waves + (r.waves >= ENDLESS_CAP ? '+' : '') : r.win ? 'WIN ♥' + r.hp : 'в' + r.waves).join(' ');
  console.log([sqName, K.DIFFS[diff].name, m.name, txt].join(' | '));
}
require('fs').writeFileSync(process.env.OUT || '/dev/null', JSON.stringify(rows));
