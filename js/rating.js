'use strict';
/* Оценки за матч по 10-балльной шкале (как в футболе) с нормировкой по ролям.
   Каждый показатель сравнивается со средним и разбросом ДЛЯ ЭТОЙ РОЛИ (RATING_NORMS из norms.js),
   поэтому саппорт не получает меньше мидера только из-за того, что наносит меньше урона. */

const RATING_METRICS = ['k', 'd', 'a', 'dmg', 'sup', 'vis', 'gold', 'obj', 'sdmg'];
const RATING_W = { k: 0.8, d: -0.9, a: 0.6, dmg: 0.7, sup: 0.6, vis: 0.5, gold: 0.6, obj: 0.4, sdmg: 0.4 };
const RATING_BASE = 6.5, RATING_WIN = 0.35, RATING_SPREAD = 0.95;

function ratingMetrics(h, minutes) {
  const per = 30 / Math.max(10, minutes);
  return {
    k: h.k, d: h.d, a: h.a,
    dmg: h.dmg * per, sup: (h.healed + (h.shielded || 0)) * per, vis: (h.vis || 0) * per,
    gold: h.totalGold * per, obj: h.obj || 0, sdmg: (h.sdmg || 0) * per,
  };
}
/* «Сырой» показатель игры: взвешенная сумма отклонений от норм роли */
function ratingRaw(h, minutes, norms = (typeof RATING_NORMS !== 'undefined' ? RATING_NORMS : null)) {
  const m = ratingMetrics(h, minutes);
  if (!norms || !norms[h.role]) return 0;
  const nr = norms[h.role];
  let s = 0;
  for (const k of RATING_METRICS) { const [mu, sdv] = nr[k]; s += RATING_W[k] * (m[k] - mu) / (sdv || 1); }
  return s;
}
function computeRatings(G) {
  const norms = typeof RATING_NORMS !== 'undefined' ? RATING_NORMS : null;
  for (const h of G.heroes) {
    let z = 0;
    if (norms && norms.P && norms.P[h.role]) { const [mu, sdv] = norms.P[h.role]; z = (ratingRaw(h, G.minute, norms) - mu) / (sdv || 1); }
    const r = RATING_BASE + RATING_SPREAD * z + (h.team === G.winner ? RATING_WIN : -RATING_WIN);
    h.rating = Math.round(U.clamp(r, 3, 10) * 10) / 10;
  }
  const best = U.maxBy(G.heroes, h => h.rating);
  for (const h of G.heroes) h.mvp = h === best;
  return G.heroes.map(h => h.rating);
}
