'use strict';
/* Модель игрового поля «три в ряд» */

const N = 7;
const T_ATK = 0, T_DEF = 1, T_HEAL = 2, T_MANA = 3, T_GOLD = 4, T_VIS = 5, T_STONE = 6, T_PRISM = 7;
let _gid = 1;
const sfx = (n, a) => { if (typeof Sound !== 'undefined' && !Clock.headless) Sound.play(n, a); };

function newGem(t, sp = null) {
  return { id: _gid++, t, sp, ice: 0, fog: 0, x: 0, y: 0, vy: 0, flash: 0 };
}
const rowKeys = r => Array.from({ length: N }, (_, c) => r * N + c);
const colKeys = c => Array.from({ length: N }, (_, r) => r * N + c);
const kr = k => (k / N) | 0;
const kc = k => k % N;

function runAt(T, r, c) {
  const t = T[r][c];
  if (t < 0 || t > 5) return false;
  let h = 1;
  for (let x = c - 1; x >= 0 && T[r][x] === t; x--) h++;
  for (let x = c + 1; x < N && T[r][x] === t; x++) h++;
  if (h >= 3) return true;
  let v = 1;
  for (let y = r - 1; y >= 0 && T[y][c] === t; y--) v++;
  for (let y = r + 1; y < N && T[y][c] === t; y++) v++;
  return v >= 3;
}

/* Поиск групп совпадений: ряды по 3+ одного цвета, объединённые при пересечении (L/T) */
function findGroups(T) {
  const runs = [];
  for (let r = 0; r < N; r++) {
    let c = 0;
    while (c < N) {
      const t = T[r][c]; let e = c + 1;
      if (t >= 0 && t <= 5) {
        while (e < N && T[r][e] === t) e++;
        if (e - c >= 3) runs.push({ t, dir: 'h', len: e - c, cells: Array.from({ length: e - c }, (_, i) => r * N + c + i) });
      }
      c = e;
    }
  }
  for (let c = 0; c < N; c++) {
    let r = 0;
    while (r < N) {
      const t = T[r][c]; let e = r + 1;
      if (t >= 0 && t <= 5) {
        while (e < N && T[e][c] === t) e++;
        if (e - r >= 3) runs.push({ t, dir: 'v', len: e - r, cells: Array.from({ length: e - r }, (_, i) => (r + i) * N + c) });
      }
      r = e;
    }
  }
  const groups = [];
  const owner = new Map();
  for (const run of runs) {
    const hit = new Set();
    for (const k of run.cells) if (owner.has(k)) hit.add(owner.get(k));
    let g;
    if (!hit.size) { g = { t: run.t, cells: new Set(), runs: [], dead: false }; groups.push(g); }
    else {
      const list = [...hit]; g = list[0];
      for (const o of list.slice(1)) { o.cells.forEach(k => { g.cells.add(k); owner.set(k, g); }); g.runs.push(...o.runs); o.dead = true; }
    }
    g.runs.push(run);
    run.cells.forEach(k => { g.cells.add(k); owner.set(k, g); });
  }
  return groups.filter(g => !g.dead).map(g => {
    const maxLen = Math.max(...g.runs.map(r => r.len));
    const lt = g.runs.some(r => r.dir === 'h') && g.runs.some(r => r.dir === 'v');
    let cross = null;
    if (lt) {
      const hs = new Set(); g.runs.filter(r => r.dir === 'h').forEach(r => r.cells.forEach(k => hs.add(k)));
      cross = g.runs.filter(r => r.dir === 'v').flatMap(r => r.cells).find(k => hs.has(k));
    }
    return { t: g.t, cells: [...g.cells], runs: g.runs, maxLen, lt, cross };
  });
}

/* Чистый анализ шага: что будет уничтожено, какие спецкамни созданы.
   T – матрица типов (-1 = неизвестно/пусто), SP – матрица спецсвойств */
function analyzeStep(T, SP, prefer, extra) {
  const groups = findGroups(T);
  const clear = new Set(extra || []);
  const matched = new Set();
  const creates = [];
  for (const gp of groups) {
    gp.cells.forEach(k => { clear.add(k); matched.add(k); });
    let sp = null;
    if (gp.maxLen >= 5) sp = 'prism';
    else if (gp.lt) sp = 'bomb';
    else if (gp.maxLen === 4) sp = gp.runs.find(r => r.len === 4).dir === 'h' ? 'h' : 'v';
    if (sp) {
      let pos = prefer ? gp.cells.find(k => prefer.includes(k)) : undefined;
      if (pos === undefined) pos = gp.cross != null ? gp.cross : gp.cells[(gp.cells.length / 2) | 0];
      if (!creates.some(c => c.k === pos)) creates.push({ k: pos, t: sp === 'prism' ? T_PRISM : gp.t, sp });
    }
  }
  // Цепные реакции спецкамней
  const acts = [];
  const queue = [...clear];
  const done = new Set();
  const createdAt = new Set(creates.map(c => c.k));
  while (queue.length) {
    const k = queue.pop();
    if (done.has(k)) continue;
    done.add(k);
    const sp = SP[kr(k)][kc(k)];
    if (!sp) continue;
    const r = kr(k), c = kc(k);
    let area = [];
    let color = null;
    if (sp === 'h') area = rowKeys(r);
    else if (sp === 'v') area = colKeys(c);
    else if (sp === 'bomb') { for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < N && x >= 0 && x < N) area.push(y * N + x); }
    else if (sp === 'prism') {
      const cnt = [0, 0, 0, 0, 0, 0];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = T[y][x]; if (t >= 0 && t <= 5) cnt[t]++; }
      color = cnt.indexOf(Math.max(...cnt));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (T[y][x] === color) area.push(y * N + x);
    }
    acts.push({ k, sp, color });
    for (const a of area) { if (!clear.has(a)) clear.add(a); if (!done.has(a)) queue.push(a); }
  }
  // Булыжники рядом с совпадениями раскалываются
  let stonesAdj = 0;
  for (const k of matched) {
    const r = kr(k), c = kc(k);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const y = r + dr, x = c + dc;
      if (y < 0 || y >= N || x < 0 || x >= N) continue;
      if (T[y][x] === T_STONE && !clear.has(y * N + x)) { clear.add(y * N + x); stonesAdj++; }
    }
  }
  const counts = [0, 0, 0, 0, 0, 0];
  let stones = 0;
  for (const k of clear) {
    const t = T[kr(k)][kc(k)];
    if (t >= 0 && t <= 5) counts[t]++;
    else if (t === T_STONE) stones++;
  }
  const atkRuns = groups.filter(g => g.t === T_ATK).map(g => g.maxLen);
  return { clear, creates, createdAt, counts, stones, acts, groups, atkRuns, maxLen: groups.length ? Math.max(...groups.map(g => g.maxLen)) : 0 };
}

class Board {
  constructor(owner) {
    this.owner = owner;
    this.g = [];
    this.dying = [];
    this.parts = [];
    this.rings = [];
    this.beams = [];
    this.hint = null;
    this.shake = 0;
    this.glow = 0;
    // очередь камней, которые упадут в каждый столбец (видна при высоком «Чтении игры»)
    this.queue = Array.from({ length: N }, () => Array.from({ length: 6 }, () => this.rnd()));
    this.fill();
  }
  rnd() { return U.ri(6); }
  fill() {
    let tries = 0;
    do {
      this.g = [];
      for (let r = 0; r < N; r++) {
        const row = [];
        for (let c = 0; c < N; c++) {
          let t;
          do { t = this.rnd(); } while (
            (c >= 2 && row[c - 1].t === t && row[c - 2].t === t) ||
            (r >= 2 && this.g[r - 1][c].t === t && this.g[r - 2][c].t === t));
          const g = newGem(t); g.x = c; g.y = r - N - 1 - U.rand(0.5); row.push(g);
        }
        this.g.push(row);
      }
    } while (!this.hasMoves() && ++tries < 50);
  }
  at(k) { return this.g[kr(k)][kc(k)]; }
  types(blind) { return this.g.map(row => row.map(g => (!g ? -1 : (blind && g.fog ? -1 : g.t)))); }
  sps(blind) { return this.g.map(row => row.map(g => (!g || (blind && g.fog) ? null : g.sp))); }
  forEach(fn) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) fn(this.g[r][c], r * N + c, r, c); }
  keys(pred) { const out = []; this.forEach((g, k) => { if (g && pred(g, k)) out.push(k); }); return out; }
  keysOf(t) { return this.keys(g => g.t === t); }
  count(t) { return this.keysOf(t).length; }
  pick(pred, n) { return U.shuffle(this.keys(pred)).slice(0, n); }
  plain(g) { return g.t <= 5 && !g.sp; }

  listMoves(blind) {
    const T = this.types(blind);
    const moves = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N) continue;
        const a = this.g[r][c], b = this.g[r2][c2];
        if (!a || !b || a.ice || b.ice || a.t === T_STONE || b.t === T_STONE) continue;
        if (blind && (a.fog || b.fog)) continue;
        if (a.t === T_PRISM || b.t === T_PRISM) { moves.push({ r, c, r2, c2, prism: true }); continue; }
        if (a.t === b.t) continue;
        [T[r][c], T[r2][c2]] = [T[r2][c2], T[r][c]];
        if (runAt(T, r, c) || runAt(T, r2, c2)) moves.push({ r, c, r2, c2 });
        [T[r][c], T[r2][c2]] = [T[r2][c2], T[r][c]];
      }
    }
    return moves;
  }
  hasMoves() { return this.listMoves(false).length > 0; }

  /* Оценка хода без изменения поля (для ИИ) */
  simulate(mv, blind) { return this.firstStep(mv, blind).res; }

  firstStep(mv, blind) {
    const T = this.types(blind), SP = this.sps(blind);
    const k1 = mv.r * N + mv.c, k2 = mv.r2 * N + mv.c2;
    if (mv.prism) {
      const a = T[mv.r][mv.c], b = T[mv.r2][mv.c2];
      const extra = new Set([k1, k2]);
      if (a === T_PRISM && b === T_PRISM) { for (let k = 0; k < N * N; k++) extra.add(k); }
      else {
        const color = a === T_PRISM ? b : a;
        if (color >= 0 && color <= 5) for (let k = 0; k < N * N; k++) if (T[kr(k)][kc(k)] === color) extra.add(k);
      }
      SP[mv.r][mv.c] = null; SP[mv.r2][mv.c2] = null;
      T[mv.r][mv.c] = -1; T[mv.r2][mv.c2] = -1; // призма не порождает обычное совпадение
      const res = analyzeStep(T, SP, null, extra);
      // посчитать цвет, уничтоженный призмой
      const color = a === T_PRISM ? b : a;
      if (color >= 0 && color <= 5) res.counts[color] = Math.max(res.counts[color], 1);
      return { res, T, SP };
    }
    [T[mv.r][mv.c], T[mv.r2][mv.c2]] = [T[mv.r2][mv.c2], T[mv.r][mv.c]];
    [SP[mv.r][mv.c], SP[mv.r2][mv.c2]] = [SP[mv.r2][mv.c2], SP[mv.r][mv.c]];
    return { res: analyzeStep(T, SP, [k1, k2], null), T, SP };
  }

  /* Ход с предсказанием каскадов: падение уже лежащих камней известно всем,
     а новые камни — только первые `preview` из очереди каждого столбца. Остальные неизвестны (-1). */
  simulateDeep(mv, blind, preview) {
    const { res, T, SP } = this.firstStep(mv, blind);
    const total = { counts: res.counts.slice(), stones: res.stones, creates: res.creates.slice(), acts: res.acts.slice(), depth: 0 };
    const used = new Array(N).fill(0);
    let last = res;
    for (let d = 1; d <= 3; d++) {
      for (const k of last.clear) { T[kr(k)][kc(k)] = -9; SP[kr(k)][kc(k)] = null; }
      for (const cr of last.creates) { T[kr(cr.k)][kc(cr.k)] = cr.t; SP[kr(cr.k)][kc(cr.k)] = cr.sp; }
      for (let c = 0; c < N; c++) {
        let w = N - 1;
        for (let r = N - 1; r >= 0; r--) if (T[r][c] !== -9) { T[w][c] = T[r][c]; SP[w][c] = SP[r][c]; w--; }
        for (let r = w; r >= 0; r--) { T[r][c] = used[c] < preview ? this.queue[c][used[c]] : -1; SP[r][c] = null; used[c]++; }
      }
      last = analyzeStep(T, SP, null, null);
      if (!last.clear.size) break;
      const mul = 1 + 0.25 * d;
      for (let t = 0; t < 6; t++) total.counts[t] += last.counts[t] * mul;
      total.stones += last.stones; total.creates.push(...last.creates); total.acts.push(...last.acts); total.depth = d;
    }
    return total;
  }

  swap(r, c, r2, c2) {
    const a = this.g[r][c];
    this.g[r][c] = this.g[r2][c2];
    this.g[r2][c2] = a;
  }

  /* Реальный шаг разрешения поля */
  step(prefer, extra) {
    return analyzeStep(this.types(false), this.sps(false), prefer, extra);
  }

  applyStep(st) {
    for (const k of st.clear) {
      const g = this.at(k);
      if (!g) continue;
      const r = kr(k), c = kc(k);
      this.g[r][c] = null;
      this.dying.push({ g, r, c, t: 0 });
      this.burst(c, r, GEM_COLORS[g.t] || '#999', g.t === T_STONE ? 5 : 7);
    }
    for (const a of st.acts) {
      const r = kr(a.k), c = kc(a.k);
      if (a.sp === 'h') this.beams.push({ dir: 'h', i: r, t: 0, color: GEM_COLORS[this.dying.find(d => d.r === r && d.c === c)?.g.t] || '#fff' });
      else if (a.sp === 'v') this.beams.push({ dir: 'v', i: c, t: 0, color: GEM_COLORS[this.dying.find(d => d.r === r && d.c === c)?.g.t] || '#fff' });
      else if (a.sp === 'bomb') { this.rings.push({ x: c, y: r, t: 0, max: 2.6, color: '#ffb347' }, { x: c, y: r, t: -0.15, max: 1.6, color: '#fff3c4' }); this.burst(c, r, '#ffb347', 18); this.flashFx = 0.7; }
      else if (a.sp === 'prism') { this.rings.push({ x: c, y: r, t: 0, max: 7, color: '#ffffff' }); this.flashFx = 1; }
      if (a.sp === 'h' || a.sp === 'v') this.flashFx = Math.max(this.flashFx || 0, 0.35);
    }
    for (const cr of st.creates) {
      const r = kr(cr.k), c = kc(cr.k);
      const g = newGem(cr.t, cr.sp);
      g.x = c; g.y = r; g.flash = 1.2;
      this.g[r][c] = g;
      this.rings.push({ x: c, y: r, t: 0, max: 1.2, color: '#fff' });
    }
  }

  gravity() {
    let maxFall = 0;
    for (let c = 0; c < N; c++) {
      let write = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        const g = this.g[r][c];
        if (g) {
          if (r !== write) { this.g[write][c] = g; this.g[r][c] = null; maxFall = Math.max(maxFall, write - g.y); }
          write--;
        }
      }
      let k = 0;
      for (let r = write; r >= 0; r--) {
        const g = newGem(this.queue[c].shift());
        this.queue[c].push(this.rnd());
        g.x = c; g.y = -1 - k; k++;
        this.g[r][c] = g;
        maxFall = Math.max(maxFall, r - g.y);
      }
    }
    return maxFall;
  }

  /* --- Операции умений --- */
  convert(keys, t, sp = null) {
    for (const k of keys) {
      const g = this.at(k); if (!g) continue;
      g.t = t; g.sp = t === T_STONE ? null : sp; g.flash = 1.2;
      if (t === T_STONE) g.ice = 0;
      this.burst(kc(k), kr(k), GEM_COLORS[t] || '#ccc', 4);
    }
    if (keys.length) sfx(t === T_STONE ? 'stone' : t === T_PRISM ? 'prism' : 'swap');
    return keys;
  }
  freeze(keys) { if (keys.length) sfx('ice'); for (const k of keys) { const g = this.at(k); if (g) { g.ice = 3; g.flash = 1; this.burst(kc(k), kr(k), '#bdf3ff', 4); } } return keys; }
  fogify(keys) { if (keys.length) sfx('fog'); for (const k of keys) { const g = this.at(k); if (g) { g.fog = 3; g.flash = 0.6; } } return keys; }
  cleanse(toT) {
    const changed = [];
    this.forEach((g, k) => {
      if (!g) return;
      let ch = false;
      if (g.t === T_STONE) { g.t = toT != null ? toT : this.rnd(); ch = true; }
      if (g.ice) { g.ice = 0; ch = true; }
      if (g.fog) { g.fog = 0; ch = true; }
      if (ch) { g.flash = 1.2; changed.push(k); this.burst(kc(k), kr(k), '#fff6c8', 4); }
    });
    return changed;
  }
  shuffleGems() {
    const keys = this.keys(g => g.t !== T_STONE && !g.ice);
    let tries = 0;
    do {
      const gems = U.shuffle(keys.map(k => this.at(k)));
      keys.forEach((k, i) => { this.g[kr(k)][kc(k)] = gems[i]; });
      tries++;
    } while ((this.hasAnyMatch() || !this.hasMoves()) && tries < 60);
    if (!this.hasMoves()) {
      // аварийно: превратить часть камней в обычные
      this.cleanse(null);
      this.forEach(g => { if (g) g.t = g.t > 5 && g.t !== T_PRISM ? this.rnd() : g.t; });
    }
  }
  hasAnyMatch() { return findGroups(this.types(false)).length > 0; }
  decayFog() { this.forEach(g => { if (!g) return; if (g.fog) g.fog--; if (g.ice) { g.ice--; if (!g.ice) g.flash = 0.6; } }); }

  /* --- Визуальные эффекты (координаты в клетках) --- */
  burst(x, y, color, n) {
    if (Clock.headless) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(1.5, 5);
      this.parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 1, decay: U.rand(1.4, 2.4), color, size: U.rand(0.05, 0.12) });
    }
  }
  update(dt) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = this.g[r][c];
      if (!g) continue;
      g.x += (c - g.x) * Math.min(1, dt * 16);
      if (Math.abs(c - g.x) < 0.01) g.x = c;
      if (g.y < r) {
        g.vy += 55 * dt; g.y += g.vy * dt;
        if (g.y >= r) { g.y = r; g.vy = 0; }
      } else if (g.y > r) {
        g.y += (r - g.y) * Math.min(1, dt * 14);
        if (Math.abs(g.y - r) < 0.01) g.y = r;
        g.vy = 0;
      }
      if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2);
    }
    this.dying = this.dying.filter(d => (d.t += dt * 4) < 1);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 9 * dt; p.life -= p.decay * dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    this.rings = this.rings.filter(r => (r.t += dt * 2.5) < 1);
    if (this.shake < 0.5 && this.flashFx > 0.6) this.shake = 0.6;
    this.beams = this.beams.filter(b => (b.t += dt * 2.5) < 1);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
    if (this.glow > 0) this.glow = Math.max(0, this.glow - dt * 1.5);
    if (this.flashFx > 0) this.flashFx = Math.max(0, this.flashFx - dt * 2.5);
  }
  settled() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = this.g[r][c];
      if (g && (Math.abs(g.y - r) > 0.02 || Math.abs(g.x - c) > 0.02)) return false;
    }
    return true;
  }
}
