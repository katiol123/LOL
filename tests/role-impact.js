'use strict';
/* Тест ролевой отдачи: один игрок роли R с +BOOST ко всем характеристикам против команды «всё по 10».
   Цель — близкий прирост винрейта для всех ролей (чтобы сильный стрелок не значил намного больше сильного саппорта).
   Запуск: node tests/role-impact.js [матчей] [прибавка] */
const { fork } = require('child_process');
const N = +(process.argv[2] || 400), BOOST = +(process.argv[3] || 5);
const ROLES = ['top', 'jng', 'mid', 'adc', 'sup'];
if (process.env.ROLE_WORKER) {
  const { load } = require('./harness');
  const ctx = load(process.env.EXTRA || '');
  const role = process.env.ROLE_WORKER;
  (async () => {
    let win = 0;
    const plus = Object.fromEntries(ctx.STAT_KEYS.map(k => [k, 10 + BOOST]));
    for (let i = 0; i < N; i++) {
      const team = ctx.teamOf({}); team[ROLES.indexOf(role)] = ctx.neutralPlayer(role, { stats: Object.assign({}, plus) });
      const side = i % 2 === 0;
      const g = await ctx.playMatch(side ? team : ctx.teamOf({}), side ? ctx.teamOf({}) : team);
      if (g.winner === (side ? 'blue' : 'red')) win++;
    }
    process.send({ role, wr: win / N });
  })();
} else {
  const res = {}; let idx = 0, running = 0;
  const next = () => {
    if (idx >= ROLES.length) { if (!running) report(); return; }
    const role = ROLES[idx++]; running++;
    const w = fork(__filename, process.argv.slice(2), { env: Object.assign({}, process.env, { ROLE_WORKER: role }) });
    w.on('message', m => { res[m.role] = m.wr; }); w.on('exit', () => { running--; next(); });
  };
  for (let i = 0; i < require('os').cpus().length; i++) next();
  function report() {
    console.table(ROLES.map(r => ({ роль: r, 'винрейт %': +(res[r] * 100).toFixed(1) })));
    const v = ROLES.map(r => res[r] * 100); const se = 2 * Math.sqrt(0.25 / N) * 100;
    console.log(`Разброс ${(Math.max(...v) - Math.min(...v)).toFixed(1)} п.п. (погрешность ±${se.toFixed(1)} на роль)`);
    console.log('JSON', JSON.stringify(res));
  }
}
