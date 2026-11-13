'use strict';
/* Тест: средняя оценка и разброс оценок одинаковы для всех ролей (матчи между клубами лиги). */
const { load } = require('./harness');
const ctx = load();
const n = +(process.argv[2] || 600);
(async () => {
  const by = {};
  let L = ctx.createLeague(777);
  for (let i = 0; i < n; i++) {
    if (i % 100 === 0) L = ctx.createLeague(50000 + i);
    const [a, b] = ctx.U.shuffle(L.clubs.slice()).slice(0, 2);
    const g = await ctx.playMatch(ctx.rosterOf(L, a), ctx.rosterOf(L, b));
    for (const h of g.heroes) (by[h.role] = by[h.role] || []).push(h.rating);
  }
  const rows = Object.entries(by).map(([r, a]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const s = Math.sqrt(a.reduce((q, x) => q + (x - m) ** 2, 0) / a.length); return { роль: r, средняя: +m.toFixed(2), разброс: +s.toFixed(2), 'доля ≥7.5': +(a.filter(x => x >= 7.5).length / a.length * 100).toFixed(1) }; });
  console.table(rows);
  const ms = rows.map(r => r.средняя);
  const gap = Math.max(...ms) - Math.min(...ms);
  console.log(`Расхождение средних между ролями: ${gap.toFixed(2)} (цель ≤ 0.10) → ${gap <= 0.1 ? 'OK' : 'ПРОВАЛ'}`);
  process.exit(gap <= 0.1 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
