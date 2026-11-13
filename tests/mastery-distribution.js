'use strict';
/* Тест: стартовое мастерство в лиге соответствует заданию.
   60% игроков — мастерство на 2–5 героях, 20% — на 0–1, 20% — на 5–8; ~4% — коронный герой 18–20. */
const { load } = require('./harness');
const ctx = load();
const seeds = +(process.argv[2] || 50);
let tot = 0, A = 0, B = 0, C = 0, star = 0, small = 0, smallN = 0, bad = 0;
for (let s = 0; s < seeds; s++) {
  const L = ctx.createLeague(9000 + s);
  for (const p of Object.values(L.players)) {
    tot++;
    const ms = Object.entries(p.mastery);
    const regular = ms.filter(([id]) => id !== p.signature);
    const n = regular.length;
    if (p.masteryGroup === 'A') { A++; if (n > 1) bad++; }
    if (p.masteryGroup === 'B') { B++; if (n < 2 || n > 5) bad++; }
    if (p.masteryGroup === 'C') { C++; if (n < 5 || n > 8) bad++; }
    if (p.signature) { star++; if (p.mastery[p.signature] < 18) bad++; }
    for (const [, v] of regular) { small += v; smallN++; }
  }
}
const pc = x => (x / tot * 100).toFixed(1) + '%';
console.log(`Игроков: ${tot} (${seeds} лиг)`);
console.log(`0–1 героев: ${pc(A)} (цель 20%) · 2–5: ${pc(B)} (60%) · 5–8: ${pc(C)} (20%) · коронный герой: ${pc(star)} (4%)`);
console.log(`Среднее стартовое мастерство (без коронных): ${(small / smallN).toFixed(2)} — «небольшое»`);
console.log(`Нарушений правил: ${bad} → ${bad === 0 ? 'OK' : 'ПРОВАЛ'}`);
process.exit(bad === 0 ? 0 : 1);
