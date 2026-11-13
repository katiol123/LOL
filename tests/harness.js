'use strict';
/* Общая обвязка для тестов: загружает игровую логику в изолированный контекст без браузера */
const vm = require('vm'), fs = require('fs'), path = require('path');
const FILES = ['util', 'board', 'data', 'players', 'rating', 'norms', 'ai', 'game', 'faces', 'league'];

function load(extra) {
  const ctx = { console, Math, performance: { now: () => Date.now() }, setTimeout, clearTimeout };
  vm.createContext(ctx);
  for (const f of FILES) {
    const p = path.join(__dirname, '..', 'js', f + '.js');
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f + '.js' });
  }
  vm.runInContext(`
    Clock.headless = true;
    var NOOP_UI = new Proxy({}, { get: (t, k) => k === 'askSignal' ? undefined : () => {} });
    async function playMatch(bluePlayers, redPlayers, opts = {}) {
      const { picks } = AI.draft({ blue: bluePlayers, red: redPlayers });
      const g = new Game(picks.blue, picks.red, NOOP_UI, opts);
      await g.run();
      computeRatings(g);
      return g;
    }
    function teamOf(stats, roles = ROLE_ORDER) { return roles.map(r => neutralPlayer(r, { stats: Object.assign(Object.fromEntries(STAT_KEYS.map(k => [k, 10])), stats) })); }
  `, ctx);
  // константы верхнего уровня не видны снаружи контекста — пробрасываем нужные имена
  vm.runInContext(`Object.assign(globalThis, { U, Clock, ROLE_IMPACT, HEROES, ROLE_ORDER, STAT_KEYS, STAT_SCALE, AI, Game, computeRatings, ratingMetrics, ratingRaw,
    RATING_METRICS, neutralPlayer, NOOP_UI, makePlayer, effStat, masteryOf, playerOvr,
    createLeague: typeof createLeague !== 'undefined' ? createLeague : null, rosterOf: typeof rosterOf !== 'undefined' ? rosterOf : null,
    simFixture: typeof simFixture !== 'undefined' ? simFixture : null, leagueTable: typeof leagueTable !== 'undefined' ? leagueTable : null,
    clubById: typeof clubById !== 'undefined' ? clubById : null });`, ctx);
  if (extra) vm.runInContext(extra, ctx);
  return ctx;
}
module.exports = { load };
