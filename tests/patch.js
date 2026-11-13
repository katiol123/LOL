'use strict';
/* Патчи и мета: сезон(ы) лиги, патч каждые 10 туров.
   Проверяет: (1) разброс винрейтов героев уменьшается после патчей,
   (2) мета влияет на драфт — сильные в мете герои чаще берутся и банятся.
   Запуск: node tests/patch.js [сезонов] */
const { load } = require('./harness');
const ctx = load();
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb || 1); };
(async () => {
  const seasons = +(process.argv[2] || 1);
  const L = ctx.createLeague(4242);
  ctx.applyLeagueMeta(L);
  const rows = [], agg = {};
  for (let s = 0; s < seasons; s++) {
    if (s > 0) { L.season++; L.tour = 0; L.schedule = ctx.doubleRoundRobin(L.clubs.map(c => c.id), ctx.U.seeded(L.seed + L.season)); }
    while (L.tour < L.schedule.length) {
      for (const f of L.schedule[L.tour]) await ctx.simFixture(L, f, ctx.NOOP_UI);
      L.tour++;
      if (ctx.patchDue(L)) {
        const P = L.patch, st = Object.values(P.stats).filter(x => x.g >= 8);
        const wrs = st.map(x => x.w / x.g);
        const sd = Math.sqrt(wrs.reduce((a, w) => a + (w - 0.5) ** 2, 0) / wrs.length);
        // связь меты (на начало патча) с тем, как часто героя брали и банили
        let mc = null;
        const ids = Object.keys(P.meta || {});
        if (ids.length) mc = corr(ids.map(id => P.meta[id].score), ids.map(id => { const x = P.stats[id] || { g: 0, b: 0 }; return (x.g + x.b) / P.games; }));
        const maxDev = Math.max(...wrs.map(w => Math.abs(w - 0.5)));
        rows.push({ патч: P.name, игр: P.games, 'разброс WR, п.п.': +(sd * 100).toFixed(1), 'макс. отклонение, п.п.': +(maxDev * 100).toFixed(1), 'мета↔пики/баны': mc == null ? '—' : +mc.toFixed(2) });
        for (const [id, x] of Object.entries(P.stats)) { const a = agg[id] = agg[id] || { g: 0, w: 0 }; a.g += x.g; a.w += x.w; }
        if (process.env.NOPATCH) { L.patch.stats = {}; L.patch.games = 0; L.patch.atTour = L.season * 100 + L.tour; continue; }
        const np = ctx.applyPatch(L);
        console.log(`Патч ${np.name}: ` + np.notes.map(n => `${n.id}${n.key === 'stat' ? '' : '.' + n.key} ${n.delta > 0 ? '+' : ''}${Math.round(n.delta * 100)}% (WR ${Math.round(n.wr * 100)}%)`).join(', '));
      }
    }
  }
  console.table(rows);
  // итоговый разброс винрейтов героев за всё время за вычетом статистического шума
  const a = Object.values(agg).filter(x => x.g >= 30);
  const v = a.reduce((s, x) => s + (x.w / x.g - 0.5) ** 2, 0) / a.length, noise = a.reduce((s, x) => s + 0.25 / x.g, 0) / a.length;
  console.log(`${process.env.NOPATCH ? 'БЕЗ патчей' : 'С патчами'}: реальный разброс силы героев ≈ ${(Math.sqrt(Math.max(0, v - noise)) * 100).toFixed(1)} п.п. (сырой ${(Math.sqrt(v) * 100).toFixed(1)}, шум ${(Math.sqrt(noise) * 100).toFixed(1)})`);
})().catch(e => { console.error(e); process.exit(1); });
