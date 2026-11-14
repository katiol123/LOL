'use strict';
/* Экономика кампании на несколько сезонов: бюджеты, контракты, свободные агенты, расторжения, вложения, смена руководства.
   Запуск: node tests/finance.js [сезонов] */
const { load } = require('./harness');
const ctx = load(`Object.assign(globalThis, { financeTour, mgmtReview, mgmtInvest, offseason, FACILITIES, facLevel, money, playerValue });`);
(async () => {
  const seasons = +(process.argv[2] || 3);
  const L = ctx.createLeague(2024);
  const count = {};
  const tally = news => { for (const n of news) { const k = n.text.slice(0, 2); count[k] = (count[k] || 0) + 1; } };
  for (let s = 0; s < seasons; s++) {
    while (L.tour < L.schedule.length) {
      for (const f of L.schedule[L.tour]) await ctx.simFixture(L, f, ctx.NOOP_UI);
      const news = ctx.financeTour(L, L.schedule[L.tour]);
      if ([10, 20].includes(L.tour + 1)) ctx.mgmtReview(L, news);
      if (L.tour + 1 === 15) for (const c of L.clubs) ctx.mgmtInvest(L, c, news);
      tally(news); L.tour++;
    }
    const b = L.clubs.map(c => Math.round(c.budget)).sort((a, b) => a - b);
    const news = ctx.offseason(L); tally(news);
    L.season++; L.tour = 0; L.results = [];
    L.schedule = ctx.doubleRoundRobin(L.clubs.map(c => c.id), ctx.U.seeded(L.seed + L.season));
    for (const p of [...Object.values(L.players), ...L.free]) p.season = { games: 0, wins: 0, k: 0, d: 0, a: 0, ratingSum: 0, mvp: 0 };
    const fac = L.clubs.map(c => ctx.U.sum(Object.keys(ctx.FACILITIES), k => ctx.facLevel(c, k)));
    console.log(`Сезон ${s + 1}: бюджеты к концу ${b[0]}…${b[b.length - 1]} (медиана ${b[8]}), в минусе ${b.filter(x => x < 0).length}; уровней отделов у клубов ${Math.min(...fac)}…${Math.max(...fac)}; свободных агентов ${L.free.length}`);
  }
  const names = { '🤝': 'отказов продать игрока', '📈': 'резких ростов', '📉': 'резких спадов', '📺': 'рекламных сделок', '✂': 'досрочных расторжений', '🖊': 'продлений', '↪': 'уходов в свободные агенты', '✍': 'подписаний', '🏗': 'вложений в отделы', '🔄': 'смен руководства', '🏆': 'итогов сезона' };
  console.log(Object.entries(count).map(([k, v]) => `${names[k] || k} ${v}`).join(' · '));
  const ps = Object.values(L.players);
  console.log('популярность игроков:', Math.round(Math.min(...ps.map(p => p.popularity))), '…', Math.round(Math.max(...ps.map(p => p.popularity))), '; все составы полные:', L.clubs.every(c => ctx.ROLE_ORDER.every(r => L.players[c.roster[r]])));
})().catch(e => { console.error(e); process.exit(1); });
