'use strict';
/* Тест равнозначности характеристик.
   Команда, у всех игроков которой одна характеристика 14 (остальные 10), играет против команды «всё по 10».
   Прирост винрейта должен быть примерно одинаковым для всех 8 характеристик.
   Запуск: node tests/stat-equivalence.js [матчей на характеристику] [прибавка]  (характеристики считаются параллельно) */
const { fork } = require('child_process');
const N = +(process.argv[2] || 600), BOOST = +(process.argv[3] || 4);
if (process.env.STAT_WORKER) {
  const { load } = require('./harness');
  const ctx = load(process.env.SCALE ? `Object.assign(STAT_SCALE, ${process.env.SCALE});` : '');
  const key = process.env.STAT_WORKER;
  (async () => {
    let win = 0;
    for (let i = 0; i < N; i++) {
      const boosted = ctx.teamOf({ [key]: 10 + BOOST }), base = ctx.teamOf({});
      const side = i % 2 === 0; // смена сторон
      const g = await ctx.playMatch(side ? boosted : base, side ? base : boosted);
      if (g.winner === (side ? 'blue' : 'red')) win++;
    }
    process.send({ key: process.env.TAG || key, wr: win / N });
  })();
} else {
  const keys = process.env.KEYS ? process.env.KEYS.split(',') : ['rea', 'mech', 'read', 'farm', 'map', 'agr', 'calm', 'team'];
  const res = {}; let running = 0, idx = 0;
  const par = Math.max(1, require('os').cpus().length);
  const next = () => {
    if (idx >= keys.length) { if (!running) report(); return; }
    const key = keys[idx++]; running++;
    const [sk, tag] = key.split(':');
    const w = fork(__filename, process.argv.slice(2), { env: Object.assign({}, process.env, { STAT_WORKER: sk, TAG: key }) });
    w.on('message', m => { res[m.key] = m.wr; });
    w.on('exit', () => { running--; next(); });
  };
  for (let i = 0; i < par; i++) next();
  function report() {
    const se = Math.sqrt(0.25 / N) * 100;
    const rows = keys.map(k => ({ характеристика: k, 'винрейт %': +(res[k] * 100).toFixed(1) }));
    console.table(rows);
    const v = keys.map(k => res[k] * 100), mean = v.reduce((a, b) => a + b, 0) / v.length;
    const spread = Math.max(...v) - Math.min(...v);
    console.log(`Среднее ${mean.toFixed(1)}%, разброс ${spread.toFixed(1)} п.п. (статистическая погрешность ±${(2 * se).toFixed(1)} п.п. на характеристику)`);
    console.log(`Цель: все в пределах ±${Math.max(3, 2 * se).toFixed(1)} п.п. от среднего → ${v.every(x => Math.abs(x - mean) <= Math.max(3, 2 * se)) ? 'OK' : 'НУЖНА КАЛИБРОВКА'}`);
    console.log('JSON', JSON.stringify(res));
  }
}
