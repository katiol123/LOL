'use strict';
/* Проверка драфта: герои берутся на любые роли, но в основном по профилю; непрофильные — с причиной. */
const { load } = require('./harness');
const ctx = load();
const n = +(process.argv[2] || 400);
const fitCount = [0, 0, 0, 0], reasons = {}, heroRoles = {};
let L = ctx.createLeague(4242);
for (let i = 0; i < n; i++) {
  if (i % 50 === 0) L = ctx.createLeague(70000 + i);
  const [a, b] = ctx.U.shuffle(L.clubs.slice()).slice(0, 2);
  const { picks } = ctx.AI.draft({ blue: ctx.rosterOf(L, a), red: ctx.rosterOf(L, b) });
  for (const p of [...picks.blue, ...picks.red]) {
    const f = p.def.fit[p.role]; fitCount[f]++;
    if (f < 3) { const r = p.reason.replace(/\d+/g, 'N'); reasons[r] = (reasons[r] || 0) + 1; }
    (heroRoles[p.def.id] = heroRoles[p.def.id] || new Set()).add(p.role);
  }
}
const tot = fitCount.reduce((x, y) => x + y, 0);
console.log('Пригодность выбранных героев к роли:', ['плохо', 'терпимо', 'хорошо', 'родная'].map((t, i) => `${t} ${(fitCount[i] / tot * 100).toFixed(1)}%`).join(' · '));
console.log('Причины непрофильных выборов:'); console.table(Object.entries(reasons).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([r, c]) => ({ причина: r, раз: c })));
console.log('На скольких ролях появлялся каждый герой:', Object.entries(heroRoles).map(([h, s]) => `${h}:${s.size}`).join(' '));
