'use strict';
/* Быстрая проверка: N матчей между нейтральными командами, без ошибок */
const { load } = require('./harness');
const ctx = load();
(async () => {
  const n = +(process.argv[2] || 20);
  let blue = 0, min = 0, kills = 0, sig = 0, tilt = 0, steals = 0;
  const roles = {};
  for (let i = 0; i < n; i++) {
    const g = await ctx.playMatch(ctx.teamOf({}), ctx.teamOf({}));
    if (g.winner === 'blue') blue++;
    min += g.minute; kills += g.teams.blue.kills + g.teams.red.kills; sig += g.signals.length;
    for (const h of g.heroes) { (roles[h.role] = roles[h.role] || []).push(h.rating); }
  }
  console.log(`матчей ${n}: синие ${blue}, мин ${(min / n).toFixed(1)}, убийств ${(kills / n).toFixed(1)}, сигналов ${(sig / n).toFixed(1)}`);
  for (const r in roles) console.log(r, (roles[r].reduce((a, b) => a + b, 0) / roles[r].length).toFixed(2));
})().catch(e => { console.error(e); process.exit(1); });
