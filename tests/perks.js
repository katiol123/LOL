'use strict';
/* Перки менталитета: команда, где у всех 5 игроков перк, против обычной команды (характеристики у всех 10).
   Показывает винрейт и показатели, по которым видно, что перк работает. Запуск: node tests/perks.js [матчей] */
const { fork } = require('child_process');
const N = +(process.argv[2] || 200);
if (process.env.PERK) {
  const { load } = require('./harness');
  const ctx = load(`var PS = { tilt: { a: 0, b: 0 }, deaths: { a: 0, b: 0 }, help: { a: 0, b: 0 }, roam: { a: 0, b: 0 }, gold25: { a: 0, b: 0 }, rev: 0, hunt: 0, hits: 0 };
    const TT = Game.prototype.tryTilt; Game.prototype.tryTilt = function (h, ...r) { const b = h.tilt; const res = TT.call(this, h, ...r); if (h.tilt > b) PS.tilt[h.pl.perks && h.pl.perks.length ? 'a' : 'b']++; return res; };
    const AN = Game.prototype.answer; Game.prototype.answer = function (sig, h) { const r = AN.call(this, sig, h); if (sig.type === 'help' && r.accept) PS.help[h.pl.perks && h.pl.perks.length ? 'a' : 'b']++; return r; };
    const ER = Game.prototype.endRound; Game.prototype.endRound = async function () { if (this.minute === 25) for (const h of this.heroes) PS.gold25[h.pl.perks && h.pl.perks.length ? 'a' : 'b'] += h.totalGold; return ER.call(this); };
    globalThis.PS = PS;`);
  const k = process.env.PERK;
  (async () => {
    let win = 0;
    for (let i = 0; i < N; i++) {
      const a = ctx.teamOf({}), b = ctx.teamOf({});
      a.forEach(p => p.perks = k === 'none' ? [] : [k]); b.forEach(p => p.perks = []);
      const side = i % 2 === 0;
      const g = await ctx.playMatch(side ? a : b, side ? b : a);
      const at = side ? 'blue' : 'red';
      if (g.winner === at) win++;
      for (const h of g.heroes) { const s = h.team === at ? 'a' : 'b'; ctx.PS.deaths[s] += h.d; ctx.PS.roam[s] += h.roams; }
    }
    const P = ctx.PS, r = (o, d = 1) => `${(o.a / N / d).toFixed(1)} / ${(o.b / N / d).toFixed(1)}`;
    process.send({ k, wr: win / N, tilt: r(P.tilt), deaths: r(P.deaths), help: r(P.help), roam: r(P.roam), gold25: r(P.gold25, 5) });
  })();
} else {
  const keys = (process.env.KEYS || 'stress,vengeful,loner,late,stubborn,leader,hunter,cautious,reckless,toxic,caller,farmer,bigstage,slow,combo').split(',');
  const res = []; let idx = 0, running = 0;
  const next = () => {
    if (idx >= keys.length) { if (!running) { res.sort((x, y) => keys.indexOf(x.k) - keys.indexOf(y.k)); console.table(res.map(x => ({ перк: x.k, 'винрейт %': +(x.wr * 100).toFixed(1), 'тильтов (с перком / без)': x.tilt, 'смертей': x.deaths, 'откликов на помощь': x.help, 'роумов': x.roam, 'золото к 25 мин на игрока': x.gold25 }))); console.log(`Погрешность ±${(2 * Math.sqrt(0.25 / N) * 100).toFixed(1)} п.п.`); } return; }
    const k = keys[idx++]; running++;
    const w = fork(__filename, process.argv.slice(2), { env: Object.assign({}, process.env, { PERK: k }) });
    w.on('message', m => res.push(m)); w.on('exit', () => { running--; next(); });
  };
  for (let i = 0; i < require('os').cpus().length; i++) next();
}
