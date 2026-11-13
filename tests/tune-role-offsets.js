'use strict';
/* Третий шаг калибровки оценок: прогоняет несколько полных сезонов кампании и поправляет
   сдвиг оценок каждой роли (RATING_NORMS.off), чтобы средние по ролям совпали именно в лиге,
   где форма и мастерство меняются по ходу сезона. Запуск: node tests/tune-role-offsets.js [сезонов] */
const { fork } = require('child_process');
const fs = require('fs'), path = require('path');
const SEASONS = +(process.argv[2] || 8);
if (process.env.SEASON_SEED) {
  const { load } = require('./harness');
  const ctx = load();
  (async () => {
    const L = ctx.createLeague(+process.env.SEASON_SEED);
    for (let t = 0; t < L.schedule.length; t++) { for (const f of L.schedule[t]) await ctx.simFixture(L, f, ctx.NOOP_UI); L.tour++; }
    const sum = {}, cnt = {};
    for (const f of L.schedule.flat()) for (const g of f.games) for (const p of g.players) { const r = L.players[p.id].role; sum[r] = (sum[r] || 0) + p.rating; cnt[r] = (cnt[r] || 0) + 1; }
    process.send(Object.fromEntries(Object.keys(sum).map(r => [r, sum[r] / cnt[r]])));
  })();
} else {
  const res = []; let next = 0, running = 0;
  const run = () => {
    if (next >= SEASONS) { if (!running) done(); return; }
    const seed = 60000 + next++; running++;
    const w = fork(__filename, [], { env: Object.assign({}, process.env, { SEASON_SEED: seed }) });
    w.on('message', m => res.push(m)); w.on('exit', () => { running--; run(); });
  };
  for (let i = 0; i < require('os').cpus().length; i++) run();
  function done() {
    const roles = Object.keys(res[0]);
    const mean = Object.fromEntries(roles.map(r => [r, res.reduce((s, x) => s + x[r], 0) / res.length]));
    const overall = roles.reduce((s, r) => s + mean[r], 0) / roles.length;
    console.log('Средние по ролям за', res.length, 'сезонов:', roles.map(r => `${r} ${mean[r].toFixed(3)}`).join(' · '));
    const file = path.join(__dirname, '..', 'js', 'norms.js');
    let src = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
    for (const r of roles) json.off[r] = +((json.off[r] || 0) + (6.5 - mean[r]) + (overall - 6.5) * 0).toFixed(3);
    src = src.slice(0, src.indexOf('var RATING_NORMS')) + 'var RATING_NORMS = ' + JSON.stringify(json, null, 1) + ';\n';
    fs.writeFileSync(file, src);
    console.log('Новые сдвиги off:', JSON.stringify(json.off));
  }
}
