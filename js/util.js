'use strict';
/* Общие утилиты и игровые часы */

const U = {
  rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  ri: n => Math.floor(Math.random() * n),
  pick: a => a[Math.floor(Math.random() * a.length)],
  chance: p => Math.random() < p,
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  sum: (a, f = x => x) => a.reduce((s, x) => s + f(x), 0),
  minBy(a, f) { let best = null, bv = Infinity; for (const x of a) { const v = f(x); if (v < bv) { bv = v; best = x; } } return best; },
  maxBy(a, f) { let best = null, bv = -Infinity; for (const x of a) { const v = f(x); if (v > bv) { bv = v; best = x; } } return best; },
  fmtTime(min) { const m = Math.floor(min); const s = Math.round((min - m) * 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; },
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },
};

/* Игровые часы: скорость, пауза и режим без отрисовки (для симуляций) */
const Clock = { speed: 1, paused: false, headless: false };

function wait(ms) {
  if (Clock.headless || ms <= 0) return Promise.resolve();
  return new Promise(res => {
    let left = ms;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(100, now - last);
      last = now;
      if (!Clock.paused) left -= dt * Clock.speed;
      if (left <= 0) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
