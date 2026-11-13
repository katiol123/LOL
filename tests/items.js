'use strict';
/* Тест предметов: что покупают роли, когда появляются легендарные, и вклад правильной закупки (Тактика).
   Запуск: node tests/items.js [матчей] */
const { load } = require('./harness');
const ctx = load(`
  Object.assign(globalThis, { ITEMS });
  const _shop = AI.shop.bind(AI);
  AI.shop = function (G, h) {
    if (h.pl.shopIq == null) return _shop(G, h);
    const save = h.pl.iq; h.pl.iq = Object.assign({ board: 10, tactic: 10, team: 10 }, save || {}, { tactic: h.pl.shopIq });
    const r = _shop(G, h); h.pl.iq = save; return r;
  };
`);
const N = +(process.argv[2] || 200);
(async () => {
  const byRole = {}, legendMin = [], counts = [];
  let smartWins = 0;
  for (let i = 0; i < N; i++) {
    const a = ctx.teamOf({}), b = ctx.teamOf({});
    a.forEach(p => p.shopIq = 18); b.forEach(p => p.shopIq = 2);   // только закупка отличается
    const side = i % 2 === 0;
    const g = await ctx.playMatch(side ? a : b, side ? b : a);
    if (g.winner === (side ? 'blue' : 'red')) smartWins++;
    for (const h of g.heroes) {
      if (h.pl.shopIq !== 18) continue;
      const r = byRole[h.role] = byRole[h.role] || {};
      for (const it of h.items) r[it] = (r[it] || 0) + 1;
      counts.push(h.items.length);
      if (h.items.some(it => ctx.ITEMS[it].tier === 4)) legendMin.push(g.minute);
    }
  }
  console.log(`Команда с правильной закупкой (Тактика 18) против случайной (Тактика 2): ${(smartWins / N * 100).toFixed(1)}% побед (±${(2 * Math.sqrt(0.25 / N) * 100).toFixed(1)})`);
  console.log(`Предметов к концу матча в среднем: ${(counts.reduce((x, y) => x + y, 0) / counts.length).toFixed(1)}; легендарный предмет у ${(legendMin.length / counts.length * 100).toFixed(0)}% героев`);
  for (const r of Object.keys(byRole)) {
    const top = Object.entries(byRole[r]).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([id, n]) => `${ctx.ITEMS[id].name} ${n}`);
    console.log(`${r.toUpperCase()}: ${top.join(' · ')}`);
  }
  const used = new Set(Object.values(byRole).flatMap(o => Object.keys(o)));
  console.log(`Покупается разных предметов: ${used.size} из ${Object.keys(ctx.ITEMS).length}`);
})().catch(e => { console.error(e); process.exit(1); });
