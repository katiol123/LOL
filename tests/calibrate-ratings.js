'use strict';
/* Калибровка норм оценок: средние и разбросы показателей ДЛЯ КАЖДОЙ РОЛИ.
   Запуск: node tests/calibrate-ratings.js [матчей]  → перезаписывает js/norms.js */
const { load } = require('./harness');
const fs = require('fs'), path = require('path');
const ctx = load(`Object.assign(globalThis, { applyGame, finishFixture, setNorms: n => { RATING_NORMS = n; } });`);
const n = +(process.argv[2] || 1000);
const meanStd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; return [+m.toFixed(3), +Math.max(1e-3, Math.sqrt(v)).toFixed(3)]; };
(async () => {
  // матчи берутся из настоящих сезонов: форма и мастерство меняются так же, как в кампании
  async function* seasonGames(seed, count) {
    let L = ctx.createLeague(seed), made = 0;
    while (made < count) {
      if (L.tour >= L.schedule.length) L = ctx.createLeague(++seed);
      for (const f of L.schedule[L.tour]) {
        for (let gi = 0; gi < 2; gi++) {
          const hs = gi === 0 ? 'blue' : 'red', as = hs === 'blue' ? 'red' : 'blue';
          const home = ctx.clubById(L, f.home), away = ctx.clubById(L, f.away);
          const pl = { [hs]: ctx.rosterOf(L, home), [as]: ctx.rosterOf(L, away) };
          const g = await ctx.playMatch(pl.blue, pl.red);
          ctx.applyGame(L, f, g, hs);
          made++;
          yield g;
        }
        ctx.finishFixture(L, f);
      }
      L.tour++;
    }
  }
  const samples = {}; // role -> [{metrics, minutes, hero}]
  for await (const g of seasonGames(1000, n)) {
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
  // второй проход: на новых матчах подобрать для каждой роли масштаб и сдвиг (одинаковые среднее и разброс)
  ctx.setNorms(Object.assign({}, norms, { k: null, off: null })); // второй проход — сезоны развиваются по новым нормам
  const raw = {};
  for await (const g of seasonGames(300000, n)) {
    for (const h of g.heroes) {
      const [mu, s] = norms.P[h.role];
      const z = (ctx.ratingRaw(h, g.minute, norms) - mu) / s;
      (raw[h.role] = raw[h.role] || []).push(0.95 * z + (h.team === g.winner ? 0.35 : -0.35));
    }
  }
  const target = 1.15;
  norms.k = {}; norms.off = {};
  for (const r in raw) { const [m, s] = meanStd(raw[r]); norms.k[r] = +(target / s).toFixed(3); norms.off[r] = +(-m * norms.k[r]).toFixed(3); }
  const out = `'use strict';\n/* Нормы оценок по ролям. Файл генерируется скриптом tests/calibrate-ratings.js (${n} матчей) — не править вручную. */\nvar RATING_NORMS = ${JSON.stringify(norms, null, 1)};\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'norms.js'), out);
  console.log('Записано js/norms.js по', n, 'матчам');
})().catch(e => { console.error(e); process.exit(1); });
