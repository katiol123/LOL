'use strict';
/* Тест игрового интеллекта ИИ: команда с высоким параметром против команды с низким (характеристики у всех 10).
   Запуск: node tests/ai-iq.js [матчей] [высокое] [низкое] */
const { fork } = require('child_process');
const N = +(process.argv[2] || 400), HI = +(process.argv[3] || 16), LO = +(process.argv[4] || 6);
const CASES = (process.env.CASES || 'board,tactic,team,draft,all').split(',');
if (process.env.IQ_CASE) {
  const { load } = require('./harness');
  const ctx = load();
  const c = process.env.IQ_CASE;
  const iqFor = v => c === 'all' ? { board: v, tactic: v, team: v } : Object.assign({ board: 10, tactic: 10, team: 10 }, { [c]: v });
  (async () => {
    let win = 0;
    for (let i = 0; i < N; i++) {
      const hi = ctx.teamOf({}), lo = ctx.teamOf({});
      if (c === 'draft') {
        // только капитан (он драфтит) отличается; остальные игроки одинаковые
        hi.forEach(p => p.iq = iqFor(10)); lo.forEach(p => p.iq = iqFor(10));
        hi[2].captain = lo[2].captain = true; hi[2].iq = { board: 10, tactic: HI, team: HI }; lo[2].iq = { board: 10, tactic: LO, team: LO };
      } else { hi.forEach(p => p.iq = iqFor(HI)); lo.forEach(p => p.iq = iqFor(LO)); }
      const side = i % 2 === 0;
      const g = await ctx.playMatch(side ? hi : lo, side ? lo : hi);
      if (g.winner === (side ? 'blue' : 'red')) win++;
    }
    process.send({ c, wr: win / N });
  })();
} else {
  const res = {}; let idx = 0, running = 0;
  const next = () => {
    if (idx >= CASES.length) { if (!running) { console.table(CASES.map(c => ({ параметр: c, [`IQ ${HI} против ${LO}, винрейт %`]: +(res[c] * 100).toFixed(1) }))); console.log(`Погрешность ±${(2 * Math.sqrt(0.25 / N) * 100).toFixed(1)} п.п.`); } return; }
    const c = CASES[idx++]; running++;
    const w = fork(__filename, process.argv.slice(2), { env: Object.assign({}, process.env, { IQ_CASE: c }) });
    w.on('message', m => { res[m.c] = m.wr; }); w.on('exit', () => { running--; next(); });
  };
  for (let i = 0; i < require('os').cpus().length; i++) next();
}
