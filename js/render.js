'use strict';
/* Отрисовка: спрайты камней, поля, мини-карта */

const Sprites = {
  cache: new Map(),
  get(t, s) {
    s = Math.max(8, Math.round(s));
    const key = t + '_' + s;
    let c = this.cache.get(key);
    if (!c) { c = this.make(t, s); this.cache.set(key, c); }
    return c;
  },
  make(t, s) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const cx = s / 2, R = s * 0.42;
    const grad = (c1, c2, c3) => {
      const g = x.createRadialGradient(cx - R * 0.35, cx - R * 0.45, R * 0.1, cx, cx, R * 1.25);
      g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c3);
      return g;
    };
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = s * 0.08; x.shadowOffsetY = s * 0.04;
    const path = () => {
      x.beginPath();
      switch (t) {
        case T_ATK: x.moveTo(cx, cx - R); x.lineTo(cx + R, cx); x.lineTo(cx, cx + R); x.lineTo(cx - R, cx); x.closePath(); break;
        case T_DEF:
          x.moveTo(cx - R * 0.85, cx - R * 0.8); x.quadraticCurveTo(cx, cx - R * 1.05, cx + R * 0.85, cx - R * 0.8);
          x.lineTo(cx + R * 0.8, cx - R * 0.1); x.quadraticCurveTo(cx + R * 0.7, cx + R * 0.7, cx, cx + R);
          x.quadraticCurveTo(cx - R * 0.7, cx + R * 0.7, cx - R * 0.8, cx - R * 0.1); x.closePath(); break;
        case T_HEAL: case T_GOLD: x.arc(cx, cx, R * 0.92, 0, Math.PI * 2); break;
        case T_MANA: for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; const px = cx + Math.cos(a) * R, py = cx + Math.sin(a) * R; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); break;
        case T_VIS: { const r = R * 0.3, w = R * 0.85; x.moveTo(cx - w + r, cx - w); x.arcTo(cx + w, cx - w, cx + w, cx + w, r); x.arcTo(cx + w, cx + w, cx - w, cx + w, r); x.arcTo(cx - w, cx + w, cx - w, cx - w, r); x.arcTo(cx - w, cx - w, cx + w, cx - w, r); x.closePath(); break; }
        case T_STONE: { const pts = [[-0.8, -0.3], [-0.4, -0.85], [0.35, -0.8], [0.85, -0.2], [0.7, 0.6], [0.1, 0.9], [-0.65, 0.7]]; pts.forEach(([a, b], i) => i ? x.lineTo(cx + a * R, cx + b * R) : x.moveTo(cx + a * R, cx + b * R)); x.closePath(); break; }
        case T_PRISM: for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2; const rr = i % 2 ? R * 0.45 : R; const px = cx + Math.cos(a) * rr, py = cx + Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); break;
      }
    };
    const fills = {
      [T_ATK]: grad('#ffb3b3', '#e8213a', '#5c0612'),
      [T_DEF]: grad('#c4e2ff', '#2f7fe0', '#0d2a5c'),
      [T_HEAL]: grad('#c8ffd6', '#22b955', '#064d1d'),
      [T_MANA]: grad('#d0fdff', '#16b6d0', '#05475a'),
      [T_GOLD]: grad('#fff4c2', '#f0b315', '#6e4600'),
      [T_VIS]: grad('#ecd0ff', '#9446e6', '#34105e'),
      [T_STONE]: grad('#c9cbd1', '#6c7079', '#2a2c31'),
    };
    path();
    if (t === T_PRISM) {
      let g;
      if (x.createConicGradient) { g = x.createConicGradient(0, cx, cx); ['#ff5468', '#ffc93c', '#45e07a', '#3fe0f0', '#4ea8ff', '#b86bff', '#ff5468'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c)); }
      else g = grad('#fff', '#ffd', '#b8f');
      x.fillStyle = g;
    } else x.fillStyle = fills[t];
    x.fill();
    x.shadowColor = 'transparent';
    x.lineWidth = Math.max(1, s * 0.035);
    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.stroke();
    // символы
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.strokeStyle = 'rgba(255,255,255,0.92)';
    x.lineWidth = Math.max(1.2, s * 0.06);
    switch (t) {
      case T_ATK: // меч
        x.beginPath(); x.moveTo(cx - R * 0.42, cx + R * 0.42); x.lineTo(cx + R * 0.38, cx - R * 0.38); x.stroke();
        x.beginPath(); x.moveTo(cx - R * 0.42, cx + R * 0.05); x.lineTo(cx - R * 0.05, cx + R * 0.42); x.stroke();
        break;
      case T_DEF:
        x.globalAlpha = 0.8; x.beginPath(); x.moveTo(cx, cx - R * 0.6); x.lineTo(cx, cx + R * 0.6); x.moveTo(cx - R * 0.45, cx - R * 0.15); x.lineTo(cx + R * 0.45, cx - R * 0.15); x.stroke(); x.globalAlpha = 1;
        break;
      case T_HEAL: { const a = R * 0.48, b = R * 0.17; x.fillRect(cx - b, cx - a, b * 2, a * 2); x.fillRect(cx - a, cx - b, a * 2, b * 2); break; }
      case T_MANA:
        x.beginPath(); x.moveTo(cx, cx - R * 0.5); x.quadraticCurveTo(cx + R * 0.42, cx + R * 0.05, cx, cx + R * 0.45); x.quadraticCurveTo(cx - R * 0.42, cx + R * 0.05, cx, cx - R * 0.5); x.fill();
        break;
      case T_GOLD:
        x.globalAlpha = 0.5; x.beginPath(); x.arc(cx, cx, R * 0.68, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
        x.beginPath(); for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2; const rr = i % 2 ? R * 0.18 : R * 0.42; const px = cx + Math.cos(a) * rr, py = cx + Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill();
        break;
      case T_VIS:
        x.beginPath(); x.moveTo(cx - R * 0.6, cx); x.quadraticCurveTo(cx, cx - R * 0.55, cx + R * 0.6, cx); x.quadraticCurveTo(cx, cx + R * 0.55, cx - R * 0.6, cx); x.stroke();
        x.beginPath(); x.arc(cx, cx, R * 0.18, 0, Math.PI * 2); x.fill();
        break;
      case T_STONE:
        x.strokeStyle = 'rgba(20,20,25,0.6)'; x.lineWidth = Math.max(1, s * 0.03);
        x.beginPath(); x.moveTo(cx - R * 0.3, cx - R * 0.6); x.lineTo(cx, cx - R * 0.1); x.lineTo(cx - R * 0.2, cx + R * 0.3); x.moveTo(cx, cx - R * 0.1); x.lineTo(cx + R * 0.45, cx + R * 0.1); x.stroke();
        break;
    }
    // блик
    if (t !== T_STONE) {
      x.globalCompositeOperation = 'source-atop';
      const gl = x.createLinearGradient(0, cx - R, 0, cx);
      gl.addColorStop(0, 'rgba(255,255,255,0.45)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gl;
      x.beginPath(); x.ellipse(cx - R * 0.15, cx - R * 0.45, R * 0.6, R * 0.32, -0.3, 0, Math.PI * 2); x.fill();
      x.globalCompositeOperation = 'source-over';
    }
    return cv;
  },
};

const BoardView = {
  draw(ctx, b, x0, y0, size, time, opts = {}) {
    const cell = size / N;
    ctx.save();
    if (b.shake > 0) ctx.translate((Math.random() - 0.5) * b.shake * cell * 0.25, (Math.random() - 0.5) * b.shake * cell * 0.25);
    // фон
    const team = b.owner && b.owner.team;
    const tc = team === 'red' ? '255,77,94' : '63,167,255';
    ctx.fillStyle = 'rgba(8,12,24,0.92)';
    roundRect(ctx, x0, y0, size, size, cell * 0.25); ctx.fill();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x0 + c * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2);
    }
    if (b.glow > 0) {
      ctx.fillStyle = `rgba(${tc},${b.glow * 0.18})`;
      roundRect(ctx, x0, y0, size, size, cell * 0.25); ctx.fill();
    }
    ctx.save();
    roundRect(ctx, x0, y0, size, size, cell * 0.25); ctx.clip();
    // подсказка обмена
    if (b.hint) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, cell * 0.06);
      for (const k of [b.hint.k1, b.hint.k2]) { roundRect(ctx, x0 + kc(k) * cell + 2, y0 + kr(k) * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.fill(); ctx.stroke(); }
    }
    if (opts.select != null) {
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = Math.max(2, cell * 0.08);
      roundRect(ctx, x0 + kc(opts.select) * cell + 2, y0 + kr(opts.select) * cell + 2, cell - 4, cell - 4, cell * 0.2); ctx.stroke();
    }
    const gs = cell * 0.92;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = b.g[r][c];
      if (!g) continue;
      const px = x0 + g.x * cell + cell / 2, py = y0 + g.y * cell + cell / 2;
      if (py < y0 - cell) continue;
      this.gem(ctx, g, px, py, gs, time, cell);
    }
    for (const d of b.dying) {
      const px = x0 + d.c * cell + cell / 2, py = y0 + d.r * cell + cell / 2;
      ctx.globalAlpha = 1 - d.t;
      const sc = 1 + d.t * 0.6;
      const sp = Sprites.get(d.g.t, gs);
      ctx.drawImage(sp, px - gs * sc / 2, py - gs * sc / 2, gs * sc, gs * sc);
      ctx.globalAlpha = 1;
    }
    // лучи линейных бомб
    for (const bm of b.beams) {
      const a = 1 - bm.t;
      ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      ctx.shadowColor = bm.color; ctx.shadowBlur = cell * 0.8;
      const th = cell * (0.25 + bm.t * 0.6);
      if (bm.dir === 'h') ctx.fillRect(x0, y0 + bm.i * cell + cell / 2 - th / 2, size, th);
      else ctx.fillRect(x0 + bm.i * cell + cell / 2 - th / 2, y0, th, size);
      ctx.shadowBlur = 0;
    }
    if (b.flashFx > 0) { ctx.fillStyle = `rgba(255,240,210,${b.flashFx * 0.35})`; ctx.fillRect(x0, y0, size, size); }
    for (const rg of b.rings) {
      if (rg.t < 0) continue;
      ctx.strokeStyle = rg.color; ctx.globalAlpha = 1 - rg.t;
      ctx.lineWidth = Math.max(1, cell * 0.12 * (1 - rg.t));
      ctx.beginPath(); ctx.arc(x0 + rg.x * cell + cell / 2, y0 + rg.y * cell + cell / 2, cell * rg.max * rg.t + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of b.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      const sz = Math.max(1, p.size * cell * (0.5 + p.life * 0.5));
      ctx.fillRect(x0 + p.x * cell - sz / 2, y0 + p.y * cell - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // рамка
    ctx.strokeStyle = `rgba(${tc},${0.35 + (opts.active ? 0.5 + Math.sin(time * 5) * 0.15 : 0)})`;
    ctx.lineWidth = opts.active ? Math.max(2, size * 0.012) : 1;
    roundRect(ctx, x0 + 0.5, y0 + 0.5, size - 1, size - 1, cell * 0.25); ctx.stroke();
    if (opts.fade) { ctx.fillStyle = 'rgba(5,8,15,0.42)'; roundRect(ctx, x0, y0, size, size, cell * 0.25); ctx.fill(); }
    if (opts.dim) { ctx.fillStyle = 'rgba(5,8,15,0.6)'; roundRect(ctx, x0, y0, size, size, cell * 0.25); ctx.fill(); }
    ctx.restore();
  },

  gem(ctx, g, px, py, gs, time, cell) {
    let s = gs;
    if (g.flash > 0) s *= 1 + Math.sin(g.flash * Math.PI) * 0.18;
    const sp = Sprites.get(g.t, gs);
    if (g.t === T_PRISM) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(time * 1.5);
      ctx.shadowColor = '#fff'; ctx.shadowBlur = cell * 0.4;
      ctx.drawImage(sp, -s / 2, -s / 2, s, s); ctx.restore();
    } else ctx.drawImage(sp, px - s / 2, py - s / 2, s, s);
    if (g.sp === 'h' || g.sp === 'v') {
      ctx.save(); ctx.translate(px, py);
      if (g.sp === 'v') ctx.rotate(Math.PI / 2);
      const pulse = 0.6 + Math.sin(time * 6) * 0.3;
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      for (const o of [-0.17, 0.17]) ctx.fillRect(-gs * 0.42, o * gs - gs * 0.035, gs * 0.84, gs * 0.07);
      ctx.restore();
    } else if (g.sp === 'bomb') {
      ctx.save();
      ctx.strokeStyle = `rgba(255,190,80,${0.6 + Math.sin(time * 7) * 0.35})`;
      ctx.lineWidth = Math.max(1.5, gs * 0.08);
      ctx.shadowColor = '#ffb347'; ctx.shadowBlur = cell * 0.35;
      ctx.beginPath(); ctx.arc(px, py, gs * (0.46 + Math.sin(time * 7) * 0.03), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (g.ice) {
      ctx.save();
      ctx.fillStyle = 'rgba(190,240,255,0.42)'; ctx.strokeStyle = 'rgba(230,252,255,0.9)'; ctx.lineWidth = Math.max(1, gs * 0.04);
      roundRect(ctx, px - gs * 0.48, py - gs * 0.48, gs * 0.96, gs * 0.96, gs * 0.15); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - gs * 0.3, py - gs * 0.4); ctx.lineTo(px - gs * 0.1, py - gs * 0.1); ctx.lineTo(px + gs * 0.25, py - gs * 0.25); ctx.stroke();
      ctx.restore();
    }
    if (g.fog) {
      ctx.save();
      const wob = Math.sin(time * 2 + g.id) * gs * 0.05;
      const fg = ctx.createRadialGradient(px + wob, py, gs * 0.1, px, py, gs * 0.65);
      fg.addColorStop(0, 'rgba(150,130,190,0.98)'); fg.addColorStop(0.7, 'rgba(90,75,130,0.95)'); fg.addColorStop(1, 'rgba(60,50,95,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(px, py, gs * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = `bold ${gs * 0.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', px, py + gs * 0.02);
      ctx.restore();
    }
  },
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- Мини-карта ---------- */
const MapGeo = {
  base: { blue: [0.09, 0.91], red: [0.91, 0.09] },
  lanePath: {
    top: [[0.09, 0.91], [0.09, 0.09], [0.91, 0.09]],
    mid: [[0.09, 0.91], [0.91, 0.09]],
    bot: [[0.09, 0.91], [0.91, 0.91], [0.91, 0.09]],
  },
  towerS: { blue: [0.36, 0.25, 0.14], red: [0.64, 0.75, 0.86] },
  dragon: [0.68, 0.7],
  baron: [0.32, 0.3],
  jungle: {
    blue: [[0.27, 0.55], [0.42, 0.72], [0.22, 0.4], [0.5, 0.82]],
    red: [[0.73, 0.45], [0.58, 0.28], [0.78, 0.6], [0.5, 0.18]],
  },
  point(lane, s) {
    const p = this.lanePath[lane];
    if (p.length === 2) return [U.lerp(p[0][0], p[1][0], s), U.lerp(p[0][1], p[1][1], s)];
    if (s < 0.5) { const t = s * 2; return [U.lerp(p[0][0], p[1][0], t), U.lerp(p[0][1], p[1][1], t)]; }
    const t = (s - 0.5) * 2; return [U.lerp(p[1][0], p[2][0], t), U.lerp(p[1][1], p[2][1], t)];
  },
  structurePos(st) {
    if (st.idx === 3) return this.base[st.team];
    return this.point(st.lane, this.towerS[st.team][st.idx]);
  },
  heroTarget(G, h, i) {
    const ev = h.ev;
    const jitter = [(i % 3 - 1) * 0.025, ((i / 3 | 0) % 3 - 1) * 0.025];
    let p;
    if (!ev || ev.type === 'dead' || ev.type === 'recall') p = this.base[h.team];
    else if (ev.type === 'lane') {
      const push = G.lanes[ev.lane].push;
      p = this.point(ev.lane, 0.5 + push * 0.22 + (h.team === 'blue' ? -0.03 : 0.03));
    } else if (ev.type === 'gank') p = this.point(ev.lane, 0.5 + G.lanes[ev.lane].push * 0.22);
    else if (ev.type === 'jungle') p = this.jungle[h.team][ev.spot || 0];
    else if (ev.type === 'dragon') p = this.dragon;
    else if (ev.type === 'baron') p = this.baron;
    else if (ev.type === 'siege') {
      const sp = this.structurePos(ev.structure);
      const bp = this.base[ev.att];
      p = [U.lerp(sp[0], bp[0], 0.08), U.lerp(sp[1], bp[1], 0.08)];
    } else p = [0.5, 0.5];
    return [p[0] + jitter[0], p[1] + jitter[1]];
  },
};

const Minimap = {
  pos: new Map(),
  bg: null,
  drawBg(s) {
    const cv = document.createElement('canvas'); cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#0f2a22'); g.addColorStop(0.5, '#17352a'); g.addColorStop(1, '#0f2a22');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    // лес — пятна
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${20 + U.ri(20)},${60 + U.ri(40)},${35 + U.ri(20)},0.35)`; x.beginPath(); x.arc(U.rand(s), U.rand(s), U.rand(s * 0.02, s * 0.06), 0, Math.PI * 2); x.fill(); }
    // река
    x.strokeStyle = 'rgba(70,150,210,0.55)'; x.lineWidth = s * 0.07; x.lineCap = 'round';
    x.beginPath(); x.moveTo(s * 0.12, s * 0.12); x.quadraticCurveTo(s * 0.55, s * 0.45, s * 0.88, s * 0.88); x.stroke();
    // линии
    x.strokeStyle = 'rgba(214,190,140,0.55)'; x.lineWidth = s * 0.035;
    for (const l of LANES) { const p = MapGeo.lanePath[l]; x.beginPath(); x.moveTo(p[0][0] * s, p[0][1] * s); for (const q of p.slice(1)) x.lineTo(q[0] * s, q[1] * s); x.stroke(); }
    // базы
    for (const [t, c] of [['blue', '63,167,255'], ['red', '255,77,94']]) {
      const [bx, by] = MapGeo.base[t];
      const rg = x.createRadialGradient(bx * s, by * s, 0, bx * s, by * s, s * 0.16);
      rg.addColorStop(0, `rgba(${c},0.5)`); rg.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = rg; x.beginPath(); x.arc(bx * s, by * s, s * 0.16, 0, Math.PI * 2); x.fill();
    }
    return cv;
  },
  draw(ctx, G, s, time, dt) {
    if (!this.bg || this.bg.width !== s) this.bg = this.drawBg(s);
    ctx.drawImage(this.bg, 0, 0);
    // нексусы
    for (const t of ['blue', 'red']) {
      const tm = G.teams[t]; const [bx, by] = MapGeo.base[t];
      const col = t === 'blue' ? '#3fa7ff' : '#ff4d5e';
      ctx.save(); ctx.translate(bx * s, by * s); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = tm.nexus > 0 ? col : '#444'; ctx.shadowColor = col; ctx.shadowBlur = tm.nexus > 0 ? 10 : 0;
      ctx.fillRect(-s * 0.03, -s * 0.03, s * 0.06, s * 0.06); ctx.restore();
      // башни
      for (const l of LANES) tm.towers[l].forEach((hp, i) => {
        const [px, py] = MapGeo.point(l, MapGeo.towerS[t][i]);
        ctx.fillStyle = hp > 0 ? col : 'rgba(80,80,80,0.6)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
        const w = s * 0.026;
        ctx.fillRect(px * s - w / 2, py * s - w / 2, w, w); ctx.strokeRect(px * s - w / 2, py * s - w / 2, w, w);
        if (hp > 0 && hp < TOWER_HP[i]) { ctx.fillStyle = '#000'; ctx.fillRect(px * s - w / 2, py * s + w * 0.7, w, 2); ctx.fillStyle = '#7CFC00'; ctx.fillRect(px * s - w / 2, py * s + w * 0.7, w * hp / TOWER_HP[i], 2); }
      });
    }
    // волны миньонов
    for (const l of LANES) {
      const [px, py] = MapGeo.point(l, 0.5 + G.lanes[l].push * 0.22);
      ctx.fillStyle = G.lanes[l].push > 0.05 ? 'rgba(120,190,255,0.9)' : G.lanes[l].push < -0.05 ? 'rgba(255,120,130,0.9)' : 'rgba(230,230,230,0.8)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(px * s + (i - 1) * 3, py * s + (i % 2) * 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
    }
    // эпики
    for (const [npc, p, icon, col] of [[G.dragon, MapGeo.dragon, '🐉', '#ff6b3d'], [G.baron, MapGeo.baron, '👾', '#b46bff']]) {
      ctx.save();
      ctx.globalAlpha = npc.alive ? 1 : 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(p[0] * s, p[1] * s, s * 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `${s * 0.055}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, p[0] * s, p[1] * s + 1);
      ctx.restore();
    }
    // места схваток
    for (const ev of G.events) {
      if (!ev.sides || !ev.sides.blue.some(h => h.alive) || !ev.sides.red.some(h => h.alive)) continue;
      if (ev.type === 'dead' || ev.type === 'recall') continue;
      const h0 = [...ev.sides.blue, ...ev.sides.red][0];
      const p = MapGeo.heroTarget(G, h0, 4);
      const pr = (time * 1.5) % 1;
      ctx.strokeStyle = `rgba(255,220,120,${1 - pr})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p[0] * s, p[1] * s, s * (0.03 + pr * 0.06), 0, Math.PI * 2); ctx.stroke();
    }
    // герои
    G.heroes.forEach((h, i) => {
      const tgt = MapGeo.heroTarget(G, h, i % 5);
      let cur = this.pos.get(h.id);
      if (!cur) { cur = [...MapGeo.base[h.team]]; this.pos.set(h.id, cur); }
      const k = Math.min(1, dt * 2.5);
      cur[0] += (tgt[0] - cur[0]) * k; cur[1] += (tgt[1] - cur[1]) * k;
      if (!h.alive) return;
      const r = s * 0.032;
      const active = G.active === h;
      ctx.save();
      ctx.beginPath(); ctx.arc(cur[0] * s, cur[1] * s, r * (active ? 1.25 : 1), 0, Math.PI * 2);
      ctx.fillStyle = h.def.color; ctx.fill();
      ctx.lineWidth = active ? 3 : 2; ctx.strokeStyle = h.team === 'blue' ? '#3fa7ff' : '#ff4d5e';
      if (active) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = `${r * 1.15}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h.def.emoji, cur[0] * s, cur[1] * s + 1);
      ctx.restore();
    });
  },
  heroPos(h, s) { const p = this.pos.get(h.id); return p ? [p[0] * s, p[1] * s] : null; },
};
