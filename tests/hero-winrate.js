'use strict';
/* Винрейт каждого героя: случайные составы (герой на подходящей ему роли), игроки равной силы.
   Заодно считает, как часто срабатывают особые механики героев. Запуск: node tests/hero-winrate.js [матчей] */
const { load } = require('./harness');
const ctx = load(`
  var MECH = {};
  for (const m of ['mineBlast', 'revive', 'bonusMove', 'taunt', 'silence', 'anchor', 'takeRaw']) {
    const f = Game.prototype[m];
    Game.prototype[m] = function (...a) { MECH[m] = (MECH[m] || 0) + 1; return f.apply(this, a); };
  }
  globalThis.MECH = MECH;
  var RX = Game.prototype.enemyBoard;
  Game.prototype.enemyBoard = function (src, tgt, ...a) { if (tgt && tgt.reflect > 0 && src && src.team !== tgt.team) MECH.reflect = (MECH.reflect || 0) + 1; return RX.call(this, src, tgt, ...a); };
`);
(async () => {
  const n = +(process.argv[2] || 400);
  const st = {};
  let rot = 0, souls = 0, scrap = 0, plunderN = 0;
  for (let i = 0; i < n; i++) {
    const taken = new Set(), lu = { blue: [], red: [] };
    for (const r of ctx.ROLE_ORDER) for (const t of ['blue', 'red']) {
      const pool = ctx.HEROES.filter(h => !taken.has(h.id) && h.fit[r] >= 2);
      const d = ctx.U.pick(pool); taken.add(d.id);
      lu[t].push({ def: d, role: r, pl: ctx.neutralPlayer(r) });
    }
    const g = new ctx.Game(lu.blue, lu.red, ctx.NOOP_UI);
    await g.run();
    for (const h of g.heroes) {
      const s = st[h.def.id] = st[h.def.id] || { n: 0, w: 0 };
      s.n++; if (g.winner === h.team) s.w++;
      souls += h.souls; scrap += h.scrap;
      h.board.forEach(x => { if (x && x.rot) rot++; });
    }
  }
  const rows = Object.entries(st).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
  for (const [id, s] of rows) console.log(id.padEnd(14), String(s.n).padStart(4), (100 * s.w / s.n).toFixed(1) + '%');
  console.log('механики на матч:', Object.entries(ctx.MECH).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(', '));
  console.log(`души к концу ${(souls / n).toFixed(2)}, металлолом ${(scrap / n).toFixed(2)}, гнилых камней на полях ${(rot / n).toFixed(2)}`);
})().catch(e => { console.error(e); process.exit(1); });
