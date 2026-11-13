'use strict';
/* Эксперимент: 5 дамагеров (герои с меткой dps) против сбалансированного состава
   (танк, лекарь/поддержка, контроль, один стрелок). Игроки одинаковые (все характеристики 10).
   Запуск: node tests/five-dps.js [матчей] */
const { load } = require('./harness');
const ctx = load();
const { HEROES, ROLE_ORDER, U } = ctx;
// лучшая расстановка набора героев по ролям (максимум пригодности)
function assign(defs) {
  let best = null, bs = -1;
  const perm = (a, i = 0) => { if (i === a.length) { const s = a.reduce((x, d, j) => x + d.fit[ROLE_ORDER[j]], 0); if (s > bs) { bs = s; best = a.slice(); } return; } for (let j = i; j < a.length; j++) { [a[i], a[j]] = [a[j], a[i]]; perm(a, i + 1); [a[i], a[j]] = [a[j], a[i]]; } };
  perm(defs.slice());
  return { lu: best, fit: bs };
}
(async () => {
  const n = +(process.argv[2] || 400);
  const dps = HEROES.filter(h => h.tags.includes('dps'));
  console.log('Дамагеры в игре:', dps.map(h => h.name).join(', '));
  let win = 0, fitA = 0, fitB = 0, minSum = 0, kills = { a: 0, b: 0 }, early = 0, earlyN = 0;
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
    const g = new ctx.Game(side ? mk(A) : mk(B), side ? mk(B) : mk(A), ctx.NOOP_UI);
    await g.run();
    const at = side ? 'blue' : 'red';
    if (g.winner === at) { win++; if (g.minute < 30) early++; }
    if (g.minute < 30) earlyN++;
    minSum += g.minute; kills.a += g.teams[at].kills; kills.b += g.teams[at === 'blue' ? 'red' : 'blue'].kills;
  }
  console.log(`5 дамагеров против сбалансированных: побед ${(100 * win / n).toFixed(1)}% из ${n} (погрешность ±${(200 * Math.sqrt(0.25 / n)).toFixed(1)} п.п.)`);
  console.log(`средняя пригодность к ролям: дамагеры ${(fitA / n).toFixed(1)} из 15, сбалансированные ${(fitB / n).toFixed(1)}`);
  console.log(`убийств за матч: дамагеры ${(kills.a / n).toFixed(1)}, сбалансированные ${(kills.b / n).toFixed(1)}; длина матча ${(minSum / n).toFixed(1)} мин; быстрые победы (<30 мин) дамагеров ${early} из ${earlyN} быстрых матчей`);
})().catch(e => { console.error(e); process.exit(1); });
