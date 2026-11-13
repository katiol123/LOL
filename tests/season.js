'use strict';
/* Тест полного сезона: 30 туров Bo2. Проверяет разброс очков, рост мастерства, форму и оценки.
   Запуск: node tests/season.js [сид] */
const { load } = require('./harness');
const ctx = load(`Object.assign(globalThis, { applyGame, finishFixture, playerFormBonus, topMastery });`);
const seed = +(process.argv[2] || 7);
(async () => {
  const L = ctx.createLeague(seed);
  const best0 = Object.values(L.players).map(p => Math.max(0, ...Object.values(p.mastery)));
  let high8 = 0, total = 0;
  const byRole = {};
  for (let t = 0; t < L.schedule.length; t++) {
    for (const f of L.schedule[t]) await ctx.simFixture(L, f, ctx.NOOP_UI);
    L.tour++;
  }
  for (const f of L.schedule.flat()) for (const g of f.games) for (const p of g.players) { total++; if (p.rating >= 8) high8++; const role = L.players[p.id].role; (byRole[role] = byRole[role] || []).push(p.rating); }
  const table = ctx.leagueTable(L);
  const best1 = Object.values(L.players).map(p => Math.max(0, ...Object.values(p.mastery)));
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const levels = Object.fromEntries(L.clubs.map(c => [c.id, c.level]));
  const pts = table.map(r => r.pts), lv = table.map(r => levels[r.id]);
  const mp = avg(pts), ml = avg(lv);
  const corr = pts.reduce((s, p, i) => s + (p - mp) * (lv[i] - ml), 0) / Math.sqrt(pts.reduce((s, p) => s + (p - mp) ** 2, 0) * lv.reduce((s, l) => s + (l - ml) ** 2, 0));
  console.log(`Очки: от ${Math.min(...pts)} до ${Math.max(...pts)} (из 90); корреляция с уровнем клуба ${corr.toFixed(2)}`);
  console.log(`Лучшее мастерство игрока: в начале ${avg(best0).toFixed(1)}, в конце ${avg(best1).toFixed(1)}; игроков с мастерством ≥18: ${best0.filter(x => x >= 18).length} → ${best1.filter(x => x >= 18).length} из ${best1.length}`);
  console.log(`Оценок ≥ 8.0: ${(high8 / total * 100).toFixed(1)}%`);
  console.log('Средняя оценка по ролям:', Object.entries(byRole).map(([r, a]) => `${r} ${avg(a).toFixed(2)}`).join(' · '));
  const fb = Object.values(L.players).map(p => Math.abs(ctx.playerFormBonus(p)));
  console.log(`Средний |бонус формы|: ${avg(fb).toFixed(2)} из 5; у предела (±4.5+): ${fb.filter(x => x >= 4.5).length} из ${fb.length}`);
})().catch(e => { console.error(e); process.exit(1); });
