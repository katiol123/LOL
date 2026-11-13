'use strict';
/* Калибровка норм оценок: средние и разбросы показателей ДЛЯ КАЖДОЙ РОЛИ.
   Запуск: node tests/calibrate-ratings.js [матчей]  → перезаписывает js/norms.js */
const { load } = require('./harness');
const fs = require('fs'), path = require('path');
const ctx = load(`RATING_NORMS = null;`);
const n = +(process.argv[2] || 1000);
const meanStd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; return [+m.toFixed(3), +Math.max(1e-3, Math.sqrt(v)).toFixed(3)]; };
(async () => {
  const samples = {}; // role -> [{metrics, minutes, hero}]
  let L = ctx.createLeague(1);
  for (let i = 0; i < n; i++) {
    if (i % 120 === 0) L = ctx.createLeague(1000 + i);
    const [a, b] = ctx.U.shuffle(L.clubs.slice()).slice(0, 2);
    const g = await ctx.playMatch(ctx.rosterOf(L, a), ctx.rosterOf(L, b));
    for (const h of g.heroes) (samples[h.role] = samples[h.role] || []).push({ m: ctx.ratingMetrics(h, g.minute), h, min: g.minute });
  }
  const norms = {};
  for (const r in samples) {
    norms[r] = {};
    for (const k of ctx.RATING_METRICS) norms[r][k] = meanStd(samples[r].map(s => s.m[k]));
  }
  // второй уровень: распределение «сырого» показателя внутри роли
  norms.P = {};
  for (const r in samples) norms.P[r] = meanStd(samples[r].map(s => ctx.ratingRaw(s.h, s.min, norms)));
  const out = `'use strict';\n/* Нормы оценок по ролям. Файл генерируется скриптом tests/calibrate-ratings.js (${n} матчей) — не править вручную. */\nvar RATING_NORMS = ${JSON.stringify(norms, null, 1)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'norms.js'), out);
  console.log('Записано js/norms.js по', n, 'матчам');
})().catch(e => { console.error(e); process.exit(1); });
