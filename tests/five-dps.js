'use strict';
/* Эксперимент: 5 дамагеров (герои с меткой dps) против сбалансированного состава
   (танк, лекарь/поддержка, контроль, один стрелок). Игроки одинаковые (все характеристики 10).
   Запуск: node tests/five-dps.js [матчей] */
const { load } = require('./harness');
const ctx = load();
const { HEROES, ROLE_ORDER, U } = ctx;
// эксперименты: ABL=pass — у дамагеров нет пассивок, ABL=skill — нет умений
const ABL = process.env.ABL || '';
const clones = new Map();
function ablate(d) {
  if (!ABL) return d;
  if (!clones.has(d.id)) { const c = Object.assign({}, d); if (ABL.includes('pass')) c.passive = { name: '-', desc: '' }; if (ABL.includes('skill')) { c.q = Object.assign({}, d.q, { cost: 9999 }); c.r = Object.assign({}, d.r, { cost: 9999 }); } clones.set(d.id, c); }
  return clones.get(d.id);
}
// лучшая расстановка набора героев по ролям (максимум пригодности)
function assign(defs) {
  let best = null, bs = -1;
  const perm = (a, i = 0) => { if (i === a.length) { const s = a.reduce((x, d, j) => x + d.fit[ROLE_ORDER[j]], 0); if (s > bs) { bs = s; best = a.slice(); } return; } for (let j = i; j < a.length; j++) { [a[i], a[j]] = [a[j], a[i]]; perm(a, i + 1); [a[i], a[j]] = [a[j], a[i]]; } };
  perm(defs.slice());
  return { lu: best, fit: bs };
}
const { fork } = require('child_process');
if (!process.env.FD_WORKER) {
  const n = +(process.argv[2] || 400), W = require('os').cpus().length, parts = [];
  let left = W;
  for (let i = 0; i < W; i++) {
    const w = fork(__filename, [String(Math.ceil(n / W))], { env: Object.assign({}, process.env, { FD_WORKER: '1' }) });
    w.on('message', m => parts.push(m));
    w.on('exit', () => { if (--left) return; const S = k => parts.reduce((s, p) => s + p[k], 0), N = S('n');
      console.log(`5 дамагеров против сбалансированных: побед ${(100 * S('win') / N).toFixed(1)}% из ${N} (погрешность ±${(200 * Math.sqrt(0.25 / N)).toFixed(1)} п.п.)`);
      console.log(`пригодность к ролям: дамагеры ${(S('fitA') / N).toFixed(1)} из 15, сбалансированные ${(S('fitB') / N).toFixed(1)}`);
      console.log(`за матч: убийств ${(S('ka') / N).toFixed(1)} / ${(S('kb') / N).toFixed(1)}, драконов ${(S('da') / N).toFixed(2)} / ${(S('db') / N).toFixed(2)}, Баронов ${(S('ba') / N).toFixed(2)} / ${(S('bb') / N).toFixed(2)}, башен снесено ${(S('ta') / N).toFixed(1)} / ${(S('tb') / N).toFixed(1)} (дамагеры / сбалансированные); длина ${(S('min') / N).toFixed(1)} мин`);
      console.log(`предметы против физ. урона за матч: у дамагеров ${(S('ia') / N).toFixed(2)}, у сбалансированных ${(S('ib') / N).toFixed(2)}; средняя броня сбалансированных к концу ${(S('ar') / S('arN')).toFixed(0)}`);
      console.log(`победы дамагеров по длине матча: до 35 мин ${(100 * S('w35') / S('s35')).toFixed(0)}% (${S('s35')}), 35–45 мин ${(100 * S('w45') / S('s45')).toFixed(0)}% (${S('s45')}), дольше ${(100 * S('wl') / S('l45')).toFixed(0)}% (${S('l45')})`);
    });
  }
} else (async () => {
  const n = +(process.argv[2] || 400);
  const dps = HEROES.filter(h => h.tags.includes('dps'));
  let win = 0, fitA = 0, fitB = 0, minSum = 0, kills = { a: 0, b: 0 }, early = 0, earlyN = 0;
  const X = { ia: 0, ib: 0, ar: 0, arN: 0, da: 0, db: 0, ba: 0, bb: 0, ta: 0, tb: 0, s35: 0, w35: 0, s45: 0, w45: 0, l45: 0, wl: 0 };
  for (let i = 0; i < n; i++) {
    const A = assign(U.shuffle(dps.slice()).slice(0, 5));
    // сбалансированный состав: танк, лекарь или поддержка, контроль, стрелок и ещё один герой — все на подходящих ролях
    const rest = HEROES.filter(h => !A.lu.includes(h));
    let B;
    for (let t = 0; t < 200; t++) {
      const picks = ROLE_ORDER.map(r => U.pick(rest.filter(h => h.fit[r] >= 2)));
      if (new Set(picks).size < 5) continue;
      const tags = picks.flatMap(h => h.tags);
      if (!tags.includes('tank') || !(tags.includes('heal') || tags.includes('utility')) || !tags.includes('control')) continue;
      if (tags.filter(x => x === 'dps').length !== 1) continue;
      B = { lu: picks, fit: picks.reduce((x, d, j) => x + d.fit[ROLE_ORDER[j]], 0) }; break;
    }
    if (!B) { i--; continue; }
    fitA += A.fit; fitB += B.fit;
    const side = i % 2 === 0;
    const mk = L => L.lu.map((d, j) => ({ def: d, role: ROLE_ORDER[j], pl: ctx.neutralPlayer(ROLE_ORDER[j]) }));
    const mA = mk(A).map(x => Object.assign(x, { def: ablate(x.def) }));
    const g = new ctx.Game(side ? mA : mk(B), side ? mk(B) : mA, ctx.NOOP_UI);
    if (process.env.ARMB) for (const h of g.heroes) if (h.team !== (side ? 'blue' : 'red')) { const rc = h.recalc.bind(h); h.recalc = () => { rc(); h.armor *= +process.env.ARMB; }; h.recalc(); }
    await g.run();
    const at = side ? 'blue' : 'red';
    if (g.winner === at) { win++; if (g.minute < 30) early++; }
    if (g.minute < 30) earlyN++;
    minSum += g.minute; kills.a += g.teams[at].kills; kills.b += g.teams[at === 'blue' ? 'red' : 'blue'].kills;
    const bt = at === 'blue' ? 'red' : 'blue', fallen = t => ['top', 'mid', 'bot'].reduce((s, l) => s + g.teams[t].towers[l].filter(x => x <= 0).length, 0);
    X.da += g.teams[at].dragons.length; X.db += g.teams[bt].dragons.length; X.ba += g.teams[at].baronsTaken || 0; X.bb += g.teams[bt].baronsTaken || 0;
    X.ta += fallen(bt); X.tb += fallen(at);
    for (const h of g.heroes) { const cnt = h.items.filter(i => i === 'spikes' || i === 'stoneskin').length; if (h.team === at) X.ia += cnt; else { X.ib += cnt; X.ar += h.armor; X.arN++; } }
    const won = g.winner === at ? 1 : 0; if (g.minute < 35) { X.s35++; X.w35 += won; } else if (g.minute < 45) { X.s45++; X.w45 += won; } else { X.l45++; X.wl += won; }
  }
  process.send(Object.assign({ n, win, fitA, fitB, ka: kills.a, kb: kills.b, min: minSum }, X));
})().catch(e => { console.error(e); process.exit(1); });
