'use strict';
/* Мастерство на длинной дистанции (патчи + естественное забывание). LOSS/DECAY — переопределить параметры: сезоны кампании с патчами (каждые 10 туров), финансами и межсезоньем.
   Проверяет, что среднее мастерство по лиге не растёт к потолку. LOSS — доля потери мастерства на изменённом герое.
   Запуск: LOSS=0.25 node tests/mastery-drift.js [сезонов] */
const { load } = require('./harness');
const ctx = load(`Object.assign(globalThis, { financeTour, mgmtReview, mgmtInvest, offseason }); ${process.env.LOSS != null ? 'PATCH_MASTERY_LOSS = ' + process.env.LOSS + ';' : ''} ${process.env.DECAY != null ? 'MASTERY_DECAY = ' + process.env.DECAY + ';' : ''} ${process.env.POW != null ? 'MASTERY_GAIN_POW = ' + process.env.POW + ';' : ''}`);
(async () => {
  const seasons = +(process.argv[2] || 4);
  const L = ctx.createLeague(+(process.env.SEED || 4242));
  ctx.applyLeagueMeta(L);
  const stat = () => {
    const ps = Object.values(L.players);
    const sum = ps.map(p => Object.values(p.mastery || {}).reduce((a, b) => a + b, 0));
    const top = ps.map(p => Math.max(0, ...Object.values(p.mastery || {})));
    return { sum: sum.reduce((a, b) => a + b, 0) / ps.length, top: top.reduce((a, b) => a + b, 0) / ps.length, capped: ps.filter(p => Object.values(p.mastery || {}).some(m => m >= 18)).length };
  };
  const rows = [Object.assign({ сезон: 'старт' }, fmt(stat()))];
  function fmt(s) { return { 'сумма мастерства на игрока': +s.sum.toFixed(1), 'лучший герой в среднем': +s.top.toFixed(1), 'игроков с мастерством 18+': s.capped }; }
  for (let s = 0; s < seasons; s++) {
    while (L.tour < L.schedule.length) {
      for (const f of L.schedule[L.tour]) await ctx.simFixture(L, f, ctx.NOOP_UI);
      const news = ctx.financeTour(L, L.schedule[L.tour]);
      if ([10, 20].includes(L.tour + 1)) ctx.mgmtReview(L, news);
      L.tour++;
      if (ctx.patchDue(L)) ctx.applyPatch(L);
    }
    ctx.offseason(L);
    L.season++; L.tour = 0; L.results = [];
    L.schedule = ctx.doubleRoundRobin(L.clubs.map(c => c.id), ctx.U.seeded(L.seed + L.season));
    for (const p of [...Object.values(L.players), ...L.free]) p.season = { games: 0, wins: 0, k: 0, d: 0, a: 0, ratingSum: 0, mvp: 0 };
    rows.push(Object.assign({ сезон: s + 1 }, fmt(stat())));
  }
  console.log(`Потеря на изменённом герое: ${process.env.LOSS || 'по умолчанию'}; забывание за 10 туров без игр: ${process.env.DECAY || 'по умолчанию'}; трудность роста: ${process.env.POW || 'по умолчанию'}`);
  console.table(rows);
})().catch(e => { console.error(e); process.exit(1); });
