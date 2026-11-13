'use strict';
/* Интерфейс матча, эффекты поверх экрана, драфт, итоги */

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const later = (ms, fn) => setTimeout(fn, ms / Math.max(0.5, Clock.speed || 1));

/* ---------- Эффекты на весь экран (снаряды, искры) ---------- */
const FX = {
  cv: null, ctx: null, list: [], parts: [], rings: [],
  init() {
    this.cv = $('#fx'); this.ctx = this.cv.getContext('2d');
    const rs = () => { const d = DPR(); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.cv.style.width = innerWidth + 'px'; this.cv.style.height = innerHeight + 'px'; };
    addEventListener('resize', rs); rs();
  },
  shot(p0, p1, color, big, onHit) {
    if (!p0 || !p1) { if (onHit) onHit(); return; }
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = (Math.random() - 0.5) * Math.min(220, len * 0.5);
    const ctrl = [(p0[0] + p1[0]) / 2 - dy / len * bend, (p0[1] + p1[1]) / 2 + dx / len * bend - len * 0.12];
    if (this.list.length > 60) this.list.shift();
    this.list.push({ p0, p1, ctrl, t: 0, dur: big ? 0.55 : 0.45, color, big, onHit, trail: [] });
  },
  burst(x, y, color, n, spd = 180) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(spd * 0.3, spd);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: U.rand(1.5, 2.6), color, size: U.rand(1.5, 4) });
    }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  },
  update(dt) {
    for (const p of this.list) {
      p.t += dt / p.dur;
      const q = this.at(p, Math.min(1, p.t));
      p.trail.push(q); if (p.trail.length > (p.big ? 16 : 11)) p.trail.shift();
      for (let i = 0; i < (p.big ? 3 : 1); i++) this.parts.push({ x: q[0] + U.rand(-3, 3), y: q[1] + U.rand(-3, 3), vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: 0.7, decay: 2.8, color: p.color, size: p.big ? U.rand(2, 5) : U.rand(1.5, 3) });
      if (p.t >= 1 && !p.hit) { p.hit = true; this.burst(p.p1[0], p.p1[1], p.color, p.big ? 30 : 14, p.big ? 260 : 160); this.ring(p.p1[0], p.p1[1], p.color, p.big ? 46 : 26); if (p.onHit) p.onHit(); }
    }
    this.list = this.list.filter(p => !p.hit);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= p.decay * dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) r.t += dt * 2.6;
    this.rings = this.rings.filter(r => r.t < 1);
  },
  ring(x, y, color, max = 60) { this.rings.push({ x, y, color, max, t: 0 }); if (this.rings.length > 40) this.rings.shift(); },
  at(p, t) {
    const u = 1 - t;
    return [u * u * p.p0[0] + 2 * u * t * p.ctrl[0] + t * t * p.p1[0], u * u * p.p0[1] + 2 * u * t * p.ctrl[1] + t * t * p.p1[1]];
  },
  draw() {
    const c = this.ctx, d = DPR();
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); }
    for (const r of this.rings) {
      c.globalAlpha = 1 - r.t; c.strokeStyle = r.color; c.lineWidth = 3 * (1 - r.t) + 1;
      c.beginPath(); c.arc(r.x, r.y, 6 + r.max * r.t, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
    c.lineCap = 'round';
    for (const p of this.list) {
      const tr = p.trail;
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        c.globalAlpha = k * 0.8; c.strokeStyle = p.color; c.lineWidth = (p.big ? 9 : 5) * k;
        c.beginPath(); c.moveTo(tr[i - 1][0], tr[i - 1][1]); c.lineTo(tr[i][0], tr[i][1]); c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (const p of this.list) {
      const q = this.at(p, Math.min(1, p.t));
      const r = p.big ? 12 : 8;
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 2.2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], r * 2.2, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  },
};

/* ---------- Интерфейс матча ---------- */
const UI = {
  game: null, cards: new Map(), view: null, turnCount: 0,
  lastEp: 0, lastTc: 0, epKey: '', bannerQ: [], stack: {}, advHist: [],

  init(game) {
    this.game = game; this.cards.clear(); this.view = null; this.turnCount = 0; this.advHist = [0]; this.stack = {};
    $('#col-blue').innerHTML = ''; $('#col-red').innerHTML = '';
    $('#log').innerHTML = ''; $('#killfeed').innerHTML = '';
    for (const h of game.heroes) this.buildCard(h);
    const mine = t => game.heroes.some(h => h.team === t && h.pl && h.pl.human);
    $('.hud-team.blue .hud-name').textContent = (mine('blue') ? '★ ' : '') + game.teams.blue.name;
    $('.hud-team.red .hud-name').textContent = (mine('red') ? '★ ' : '') + game.teams.red.name;
    $('.hud-team.blue .hud-name').title = mine('blue') ? 'Ваш клуб' : ''; $('.hud-team.red .hud-name').title = mine('red') ? 'Ваш клуб' : '';
    Minimap.pos.clear();
    this.resize();
    this.view = game.heroes[0];
    this.renderHead(this.view);
  },

  buildCard(h) {
    const c = el('div', 'hero-card');
    c.style.setProperty('--hc', h.def.color);
    c.innerHTML = `
      <div class="hc-info">
        <div class="hc-top">
          <div class="portrait pface">${faceHTML(h.pl, this.teamColors(h.team))}<span class="hero-badge" style="--hc:${h.def.color}" title="${U.esc(h.name)}">${h.def.emoji}</span><span class="lvl">1</span></div>
          <div class="hc-name"><b title="${U.esc(h.pl.first + ' ' + h.pl.last)}">${U.esc(h.nick)}<span class="tilt-badge" title="Тильт: −к Механике, Реакции, Чтению игры"></span></b><small title="${U.esc(h.def.title)}">${ROLES[h.role].icon} ${h.name}${h.fit < 3 ? ` <span class="offrole" title="Герой не по профилю роли: ${FIT_NAMES[h.fit]}">${fitStars(h.fit)}</span>` : ''}${h.ms ? ` <span class="msb" title="Мастерство на герое">✦${h.ms}</span>` : ''}</small></div>
        </div>
        <div class="ev-chip">—</div>
        <div class="bar hp"><i class="lag"></i><i class="fill"></i><i class="shield"></i><span></span></div>
        <div class="bar mp"><i class="fill"></i><span></span></div>
        <div class="hc-stats"><span class="kda">0/0/0</span><span class="cs"></span><span class="gold">500</span></div>
        <div class="hc-row">
          <div class="sk p" title="Пассивное: ${U.esc(h.def.passive.name)} — ${U.esc(h.def.passive.desc)}">✧</div>
          <div class="sk q" title="${U.esc(h.def.q.name)} (${h.def.q.cost} маны, перезарядка ${h.def.q.cd}) — ${U.esc(h.def.q.desc)}">${h.def.q.icon}<i class="cd"></i></div>
          <div class="sk r" title="УЛЬТА ${U.esc(h.def.r.name)} (${h.def.r.cost} маны, с 6 ур.) — ${U.esc(h.def.r.desc)}">${h.def.r.icon}<i class="cd"></i></div>
          <div class="items"></div>
        </div>
      </div>
      <canvas class="mini"></canvas>
      <div class="dead-ov"></div>`;
    c.addEventListener('click', () => { this.view = h; this.renderHead(h); this.epKey = ''; });
    $(h.team === 'blue' ? '#col-blue' : '#col-red').appendChild(c);
    const q = s => c.querySelector(s);
    this.cards.set(h.id, {
      c, portrait: q('.portrait'), lvl: q('.lvl'), chip: q('.ev-chip'),
      hpFill: q('.hp .fill'), hpLag: q('.hp .lag'), hpSh: q('.hp .shield'), hpTx: q('.hp span'),
      mpFill: q('.mp .fill'), mpTx: q('.mp span'), kda: q('.kda'), cs: q('.cs'), gold: q('.gold'),
      skQ: q('.sk.q'), skR: q('.sk.r'), cdQ: q('.sk.q .cd'), cdR: q('.sk.r .cd'), items: q('.items'),
      mini: q('.mini'), dead: q('.dead-ov'), prev: {},
    });
  },

  resize() {
    if (!this.game) return;
    const d = DPR();
    for (const [, r] of this.cards) {
      const hgt = r.c.clientHeight - 12;
      const s = Math.max(60, Math.min(160, hgt));
      r.mini.style.width = r.mini.style.height = s + 'px';
      r.mini.width = r.mini.height = Math.round(s * d);
    }
    const f0 = $('#feature'); f0.style.width = f0.style.height = '10px';
    const box = $('#feature-box');
    const strip = 0.9 / N;  // полоса «следующие камни» над полем
    const fs = Math.max(200, Math.min(box.clientWidth, (box.clientHeight - 4) / (1 + strip)));
    const f = $('#feature');
    this.featStrip = Math.round(fs * strip);
    f.style.width = fs + 'px'; f.style.height = (fs + this.featStrip) + 'px';
    f.width = Math.round(fs * d); f.height = Math.round((fs + this.featStrip) * d);
    const mp = $('#minimap');
    const ms = Math.max(140, Math.min(230, ($('#bottom').clientHeight || 230) - 34));
    mp.style.width = mp.style.height = ms + 'px';
    mp.width = mp.height = Math.round(ms * d);
    Minimap.bg = null;
    const adv = $('#adv'); if (adv) { adv.width = Math.round((adv.clientWidth || 200) * d); adv.height = Math.round((adv.clientHeight || 150) * d); }
  },

  /* ---------- Покадровая отрисовка ---------- */
  frame(dt, time) {
    const G = this.game;
    if (!G) return;
    const d = DPR();
    const aev = G.active && G.active.ev;
    for (const h of G.heroes) {
      h.board.update(dt);
      const inEv = !!(aev && aev.sides && (aev.sides.blue.includes(h) || aev.sides.red.includes(h)));
      const r = this.cards.get(h.id);
      const ctx = r.mini.getContext('2d');
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const s = r.mini.width / d;
      ctx.clearRect(0, 0, s, s);
      BoardView.draw(ctx, h.board, 0, 0, s, time, { active: G.active === h, dim: !h.alive, fade: !!aev && !inEv && h.alive });
      if (r.prev.inEv !== inEv) { r.prev.inEv = inEv; r.c.classList.toggle('inev', inEv && G.active !== h); }
      this.updateCard(h, r);
    }
    // главное поле
    const f = $('#feature'); const fc = f.getContext('2d');
    fc.setTransform(d, 0, 0, d, 0, 0);
    const fs = f.width / d, st = this.featStrip || 0;
    fc.clearRect(0, 0, fs, fs + st);
    if (this.view) {
      BoardView.preview(fc, this.view.board, 0, 0, fs, st, AI.preview(this.view), time);
      BoardView.draw(fc, this.view.board, 0, st, fs, time, { active: G.active === this.view, dim: !this.view.alive, select: this.select });
    }
    // мини-карта
    const m = $('#minimap'); const mc = m.getContext('2d');
    mc.setTransform(d, 0, 0, d, 0, 0);
    Minimap.draw(mc, G, m.width / d, time, dt);
    // HUD
    for (const t of ['blue', 'red']) {
      const tm = G.teams[t];
      this.setText(`#hg-${t}`, (U.sum(tm.heroes, h => h.totalGold) / 1000).toFixed(1) + 'k');
      this.setText(`#ht-${t}`, LANES.reduce((s, l) => s + tm.towers[l].filter(x => x > 0).length, 0));
      this.setText(`#hd-${t}`, tm.dragons.map(id => DRAGONS.find(x => x.id === id).icon).join('') + (tm.baron ? '👾' : ''));
    }
    for (const t of ['blue', 'red']) {
      const e = $('#score-' + t), v = String(G.teams[t].kills);
      if (e.textContent !== v) { e.textContent = v; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    }
    const gd = U.sum(G.teams.blue.heroes, h => h.totalGold) - U.sum(G.teams.red.heroes, h => h.totalGold);
    const gt = Math.abs(gd) < 150 ? 'золото равно' : `${gd > 0 ? 'Синие' : 'Красные'} +${(Math.abs(gd) / 1000).toFixed(1)}k золота`;
    const ge = $('#gdiff'); if (ge.textContent !== gt) { ge.textContent = gt; ge.style.color = Math.abs(gd) < 150 ? '' : gd > 0 ? '#7cc4ff' : '#ff8c95'; }
    this.setText('#clock', U.fmtTime(G.minute - 1 + Math.min(0.98, this.turnCount / 10)));
    const now = performance.now();
    if (now - this.lastEp > 220) { this.lastEp = now; this.renderEvent(); this.renderSkills(); }
    if (now - this.lastTc > 450) { this.lastTc = now; this.renderTactics(); this.drawAdv(); }
  },
  setText(sel, v) { const e = typeof sel === 'string' ? $(sel) : sel; v = String(v); if (e && e.textContent !== v) e.textContent = v; },

  updateCard(h, r) {
    const p = r.prev;
    const set = (k, v, fn) => { if (p[k] !== v) { p[k] = v; fn(v); } };
    const hpP = h.alive ? U.clamp(h.hp / h.maxHp, 0, 1) : 0;
    set('hp', Math.round(hpP * 1000), v => { r.hpFill.style.width = v / 10 + '%'; r.hpLag.style.width = v / 10 + '%'; });
    set('sh', Math.round(Math.min(1, h.shield / h.maxHp) * 1000), v => { r.hpSh.style.left = (hpP * 100) + '%'; r.hpSh.style.width = Math.min(100 - hpP * 100, v / 10) + '%'; });
    set('hpt', `${Math.max(0, Math.round(h.hp))}/${h.maxHp}${h.shield >= 1 ? ' +' + Math.round(h.shield) : ''}`, v => { r.hpTx.textContent = v; });
    set('mp', Math.round(h.mana / h.maxMana * 1000), v => { r.mpFill.style.width = v / 10 + '%'; });
    set('mpt', `${Math.round(h.mana)}/${h.maxMana}`, v => { r.mpTx.textContent = v; });
    set('lvl', h.lvl, v => { r.lvl.textContent = v; });
    set('kda', `${h.k}/${h.d}/${h.a}`, v => { r.kda.textContent = '⚔ ' + v; });
    set('cs', h.cs, v => { r.cs.textContent = '🗡' + v; });
    set('gold', Math.round(h.gold), v => { r.gold.textContent = '💰' + v; });
    set('items', h.items.join(','), () => { r.items.innerHTML = h.items.map(i => `<span class="it" title="${ITEMS[i].name}">${ITEMS[i].icon}</span>`).join(''); });
    const ev = h.ev;
    let evName = '—', evCol = '#888';
    if (ev) {
      let type = ev.type === 'siege' && ev.att !== h.team ? 'defend' : ev.type;
      const info = EV_INFO[type];
      evName = `${info.icon} ${info.name}`; evCol = info.color;
      if (type === 'dead') evName = `☠ Возрождение: ${h.dead}`;
      else if (ev.lane && (type === 'lane' || type === 'gank' || type === 'siege' || type === 'defend')) evName += ' · ' + ev.lane.toUpperCase();
    }
    if (h.stunned) evName = '💫 Оглушён · ' + evName;
    set('ev', evName + evCol, () => { r.chip.textContent = evName; r.chip.style.setProperty('--ec', evCol); });
    set('dead', h.alive ? 0 : h.dead, v => { r.c.classList.toggle('dead', !!v); r.dead.textContent = v ? `☠ ${v}` : ''; });
    for (const k of ['q', 'r']) {
      const sk = k === 'q' ? r.skQ : r.skR, cd = k === 'q' ? r.cdQ : r.cdR;
      const s = h.def[k];
      const locked = s.lvl && h.lvl < s.lvl;
      const st = locked ? 'L' : h.cd[k] > 0 ? 'C' + h.cd[k] : h.mana >= s.cost ? 'R' : 'M';
      set('sk' + k, st, () => {
        sk.classList.toggle('locked', !!locked);
        sk.classList.toggle('ready', st === 'R');
        cd.style.display = st[0] === 'C' ? 'grid' : 'none';
        cd.textContent = st[0] === 'C' ? st.slice(1) : '';
      });
    }
  },

  renderHead(h) {
    if (!h) return;
    const head = $('#feature-head');
    head.style.setProperty('--hc', h.def.color);
    head.innerHTML = `<div class="portrait pface" style="border-color:${h.team === 'blue' ? 'var(--blue)' : 'var(--red)'}">${faceHTML(h.pl, this.teamColors(h.team))}<span class="hero-badge" style="--hc:${h.def.color}">${h.def.emoji}</span></div>
      <div class="fh-name"><b style="color:${h.team === 'blue' ? '#7cc4ff' : '#ff8c95'}">${U.esc(h.nick)} · ${h.name}</b><small>ур. ${h.lvl} · ${U.esc(this.game.teams[h.team].name)} · ${ROLES[h.role].name}${h.ms ? ' · мастерство ' + h.ms : ''}${h.fit < 3 ? ' · не по профилю' : ''}</small></div>`;
    head.animate([{ transform: 'translateX(-8px)', filter: 'brightness(1.6)' }, { transform: 'none', filter: 'none' }], { duration: 260, easing: 'ease-out' });
    $('#feature').animate([{ filter: 'brightness(1.35)', transform: 'scale(0.985)' }, { filter: 'none', transform: 'none' }], { duration: 260, easing: 'ease-out' });
    this.skKey = '';
  },

  renderSkills() {
    const h = this.view; if (!h) return;
    const st = k => { const s = h.def[k]; if (s.lvl && h.lvl < s.lvl) return 'locked'; if (h.cd[k] > 0) return 'cd' + h.cd[k]; return h.mana >= s.cost ? 'ready' : 'mana'; };
    const key = h.id + st('q') + st('r');
    if (key === this.skKey) return;
    this.skKey = key;
    const p = h.def.passive;
    const box = k => { const s = h.def[k], v = st(k); return `<div class="fsk ${v === 'ready' ? 'ready' : v === 'locked' ? 'locked' : ''}" title="${U.esc(s.desc)}"><div class="si">${s.icon}${v.startsWith('cd') ? `<i>${v.slice(2)}</i>` : v === 'locked' ? '<i>6</i>' : ''}</div><div><b>${s.name}</b><small>${k.toUpperCase()} · ${s.cost} маны · ${v === 'ready' ? 'готово' : v === 'mana' ? 'мало маны' : v === 'locked' ? 'с 6 ур.' : 'перезарядка'}</small></div></div>`; };
    $('#feature-skills').innerHTML = `<div class="fsk" title="${U.esc(p.desc)}"><div class="si">✧</div><div><b>${p.name}</b><small>Пассивное умение</small></div></div>${box('q')}${box('r')}`;
  },

  renderEvent() {
    const G = this.game, h = this.view;
    if (!h || !h.ev) return;
    const ev = h.ev;
    const type = ev.type === 'siege' && ev.att !== h.team ? 'defend' : ev.type;
    const info = EV_INFO[type];
    const sideHtml = t => (ev.sides ? ev.sides[t] : []).map(x => `<div class="mini-h ${x.alive ? '' : 'deadh'}"><span class="mp" style="--hc:${x.def.color}">${x.def.emoji}</span><span class="mb"><i style="width:${x.alive ? Math.round(x.hp / x.maxHp * 100) : 0}%"></i></span></div>`).join('') || '<small style="color:var(--muted)">—</small>';
    let npc = '';
    if (ev.npc && (type === 'jungle' || type === 'dragon' || type === 'baron')) {
      const n = ev.npc;
      const dt = ev.dtype || n.type;
      const icon = n.kind === 'dragon' ? dt.icon : n.kind === 'baron' ? '👾' : n.icon;
      const name = (n.kind === 'dragon' ? dt.name : n.kind === 'baron' ? 'Барон Глубин' : n.name) + (n.hp <= 0 ? ' — повержен' : '');
      npc = `<div class="npc-box" data-ev="${ev.id}"><div class="ni">${icon}</div><div class="nn"><b>${name}</b><div class="bar"><i class="fill" style="width:${Math.max(0, n.hp / n.max * 100)}%"></i><span>${Math.max(0, Math.round(n.hp))}/${n.max}</span></div></div></div>`;
    } else if (ev.structure) {
      const [hp, max] = G.structureHp(ev.structure);
      const nm = ev.structure.idx === 3 ? 'Нексус' : ['Внешняя башня', 'Внутренняя башня', 'Башня ингибитора'][ev.structure.idx];
      npc = `<div class="npc-box" data-ev="${ev.id}"><div class="ni">${ev.structure.idx === 3 ? '💎' : '🏰'}</div><div class="nn"><b>${nm} · ${ev.structure.lane.toUpperCase()}</b><div class="bar"><i class="fill" style="width:${Math.max(0, hp / max * 100)}%"></i><span>${Math.round(hp)}/${max}</span></div></div></div>`;
    } else if (type === 'lane') {
      const lane = G.lanes[ev.lane];
      npc = `<div class="npc-box" data-ev="${ev.id}"><div class="ni">👥</div><div class="nn"><b>Волна миньонов · ${ev.lane.toUpperCase()}</b><div class="push" style="margin-top:8px"><i style="left:${50 + lane.push * 50}%"></i></div><div class="tc-sub"><span>к синим</span><span>к красным</span></div></div></div>`;
    }
    let hint = '';
    if (type === 'jungle') hint = `Шкала ганга ${h.name}: <b>${Math.min(100, Math.round(h.gank))}%</b>. При 100% лесник идёт гангать линию с наименьшим обзором врага.`;
    else if (type === 'lane') { const l = G.lanes[ev.lane]; hint = `Обзор на линии: синие ${l.ward.blue.toFixed(1)} · красные ${l.ward.red.toFixed(1)}. Варды раскрывают ганги и дают время подготовиться.`; }
    else if (type === 'dragon' || type === 'baron') hint = 'Урон делится между монстром и врагами, если они оспаривают. Монстр бьёт всех в конце минуты.';
    else if (type === 'siege') hint = G.teams[h.team].baron ? 'Длань Барона: урон по строениям ×1.8!' : 'Свои миньоны рядом (волна продавлена) — башня бьёт вдвое слабее.';
    const key = [h.id, ev.id, ev.type, npc, sideHtml('blue'), sideHtml('red'), hint].join('|');
    if (key === this.epKey) return;
    const sameEv = this.epKey.startsWith(h.id + '|' + ev.id + '|');
    this.epKey = key;
    $('#event-panel').innerHTML = `
      <div class="ep-title" style="color:${info.color}">${info.icon} ${info.name}${ev.lane ? ' · ' + ev.lane.toUpperCase() : ''}</div>
      <div class="ep-desc">${info.desc}</div>
      <div class="ep-sides"><div class="ep-side blue">${sideHtml('blue')}</div><div class="ep-vs">VS</div><div class="ep-side red">${sideHtml('red')}</div></div>
      ${npc}
      ${hint ? `<div class="ep-hint">${hint}</div>` : ''}`;
    if (!sameEv) $('#event-panel').animate([{ transform: 'translateX(8px)', filter: 'brightness(1.4)' }, { transform: 'none', filter: 'none' }], { duration: 260 });
  },

  renderTactics() {
    const G = this.game;
    const tb = G.teams.blue, tr = G.teams.red;
    const dual = (a, b, max) => `<div class="dual"><span class="n b">${Math.round(a)}</span><div class="bar b"><i class="fill" style="width:${U.clamp(a / max * 100, 0, 100)}%"></i></div><div class="bar r"><i class="fill" style="width:${U.clamp(b / max * 100, 0, 100)}%"></i></div><span class="n r">${Math.round(b)}</span></div>`;
    const dr = G.dragon, br = G.baron;
    const drTxt = dr.alive ? `<b style="color:${dr.type.color}">${dr.type.icon} ${dr.type.name}</b> жив` : dr.spawnAt > 200 ? 'душа забрана' : `${dr.type.icon} появится в ${String(dr.spawnAt).padStart(2, '0')}:00`;
    const brTxt = br.alive ? '<b style="color:#b46bff">👾 Барон</b> жив' : `👾 появится в ${br.spawnAt}:00`;
    const jb = G.hero('blue', 'jng'), jr = G.hero('red', 'jng');
    let html = `<div class="panel-title" style="padding:2px 0 4px">Тактический планшет</div>
      <div class="tc-head"><span>${drTxt}</span><span>${brTxt}</span></div>
      <div class="tc-row"><span title="Давление на эпиков: копится от ◉ и от фарма. При 100 команда идёт на Дракона, при 150 — на Барона.">Давление</span>${dual(tb.pressure, tr.pressure, 150)}</div>
      <div class="tc-row"><span title="Обзор реки: шанс заметить чужую попытку взять эпика и оспорить её.">Река</span>${dual(tb.river * 10, tr.river * 10, 100)}</div>
      <div class="tc-row"><span title="Шкала ганга лесников. При 100% — ганг.">Ганг</span>${dual(jb.gank, jr.gank, 100)}</div>`;
    for (const l of LANES) {
      const lane = G.lanes[l];
      html += `<div class="tc-row"><span title="Положение волны и обзор на линии">${l.toUpperCase()}</span><div><div class="push"><i style="left:${50 + lane.push * 50}%"></i></div>${dual(lane.ward.blue * 10, lane.ward.red * 10, 100)}</div></div>`;
    }
    const buffs = t => { const tm = G.teams[t]; const arr = tm.dragons.map(id => DRAGONS.find(d => d.id === id).icon); if (tm.soul) arr.push('✨'); if (tm.baron) arr.push(`👾${tm.baron}м`); if (tm.momentum) arr.push('🚩'); return arr.join(' ') || '—'; };
    html += `<div class="tc-row"><span>Бафы</span><div class="tc-sub"><span style="color:#7cc4ff">${buffs('blue')}</span><span style="color:#ff8c95">${buffs('red')}</span></div></div>`;
    $('#tactics').innerHTML = html;
  },

  /* ---------- Координаты ---------- */
  heroSrc(h) {
    if (h === this.view && $('#screen-game').classList.contains('active')) { const r = $('#feature').getBoundingClientRect(); return { rect: r }; }
    const c = this.cards.get(h.id); if (!c) return null;
    const r = c.mini.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  },
  heroDst(h) {
    const c = this.cards.get(h.id); if (!c) return null;
    const r = c.portrait.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  },
  evPoint(ev) {
    const box = document.querySelector(`.npc-box[data-ev="${ev.id}"] .ni`);
    if (box) { const r = box.getBoundingClientRect(); if (r.width) return [r.left + r.width / 2, r.top + r.height / 2]; }
    const m = $('#minimap').getBoundingClientRect();
    const h0 = [...ev.sides.blue, ...ev.sides.red][0];
    let p = h0 ? MapGeo.heroTarget(this.game, h0, 4) : [0.5, 0.5];
    if (ev.structure) p = MapGeo.structurePos(ev.structure);
    return [m.left + p[0] * m.width, m.top + p[1] * m.height];
  },
  floatAt(p, text, color, cls = '') {
    if (!p) return;
    const f = el('div', 'floater ' + cls, text);
    f.style.left = p[0] + U.rand(-8, 8) + 'px'; f.style.top = p[1] + 'px'; f.style.color = color;
    f.style.animationDuration = (1.2 / Math.max(0.6, Math.min(3, Clock.speed))) + 's';
    $('#floaters').appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    const fl = $('#floaters'); if (fl.children.length > 60) fl.firstChild.remove();
  },

  /* ---------- Интерфейс для Game ---------- */
  log(html, team) {
    const e = el('div', 'le ' + (team || ''), `<time>${U.fmtTime(this.game ? this.game.minute - 1 + Math.min(0.98, this.turnCount / 10) : 0)}</time>${html}`);
    const lg = $('#log'); lg.prepend(e);
    while (lg.children.length > 80) lg.lastChild.remove();
  },
  roundStart(G) { this.turnCount = 0; this.epKey = ''; },
  roundEnd(G) {
    const gd = U.sum(G.teams.blue.heroes, h => h.totalGold) - U.sum(G.teams.red.heroes, h => h.totalGold);
    this.advHist.push(gd);
  },
  drawAdv() {
    const cv = $('#adv'); if (!cv || !cv.width || !cv.offsetParent) return;
    App.drawGoldGraph(cv, this.advHist, this.game);
  },
  focus(h) {
    for (const [, r] of this.cards) r.c.classList.remove('active');
    if (!h) return;
    this.turnCount++;
    this.cards.get(h.id).c.classList.add('active');
    if (this.view !== h) { this.view = h; this.renderHead(h); }
    this.renderEvent();
  },
  floatSlot(h) {
    const c = this.cards.get(h.id); if (!c) return null;
    const r = c.mini.getBoundingClientRect();
    const now = performance.now();
    const st = this.stack[h.id] || (this.stack[h.id] = { n: 0, t: 0 });
    st.n = now - st.t < 450 / Math.max(1, Clock.speed) ? (st.n + 1) % 5 : 0; st.t = now;
    return [r.left + r.width / 2, r.top + r.height * 0.3 + st.n * 17];
  },
  float(h, text, color, small) {
    this.floatAt(this.floatSlot(h), text, color, small ? 'small' : '');
  },
  damage(t, n, shieldOnly) {
    later(330, () => {
      this.floatAt(this.floatSlot(t), `-${n}`, shieldOnly ? '#cfe3ff' : '#ff6b6b', n > 250 ? 'big dmg' : 'dmg');
      sfx(n > 250 ? 'bigHit' : 'hit');
      const c = this.cards.get(t.id).c; c.classList.remove('hit', 'flash'); void c.offsetWidth; c.classList.add('hit', 'flash');
    });
  },
  edgeFrom(src, dst) {
    if (!src || !src.rect) return src;
    const r = src.rect, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (!dst) return [cx, cy];
    const dx = dst[0] - cx, dy = dst[1] - cy;
    const k = Math.min(Math.abs((r.width / 2 + 4) / (dx || 1e-6)), Math.abs((r.height / 2 + 4) / (dy || 1e-6)));
    return [cx + dx * Math.min(1, k), cy + dy * Math.min(1, k)];
  },
  shot(src, dst, color, big) { if (innerWidth < 900) return; FX.shot(this.edgeFrom(src, dst), dst, color, big); },
  projectile(src, tgt, color, big) { this.shot(this.heroSrc(src), this.heroDst(tgt), color, big); },
  projectileTo(h, o, color) { this.shot(this.heroSrc(h), this.evPoint(o.ev), color, false); },
  projectileFrom(o, h, color) { this.shot(this.evPoint(o.ev), this.heroDst(h), color, true); },
  npcHit(ev, d) {
    later(330, () => {
      const p = this.evPoint(ev);
      this.floatAt(p, `-${d}`, '#ffb070', 'small');
      const box = document.querySelector(`.npc-box[data-ev="${ev.id}"]`);
      if (box) { box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit'); }
    });
  },
  burstTo(h, kind, color, amt) {
    if (h !== this.view) return;
    const r = this.cards.get(h.id);
    let p;
    if (kind === 'gold') { const b = r.gold.getBoundingClientRect(); p = b.width ? [b.left + b.width / 2, b.top + b.height / 2] : this.heroDst(h); }
    else if (kind === 'mana') { const b = r.mpFill.parentElement.getBoundingClientRect(); p = [b.left + b.width / 2, b.top + b.height / 2]; }
    else if (kind === 'vision') { const m = $('#minimap').getBoundingClientRect(); const q = Minimap.heroPos(h, m.width); p = q ? [m.left + q[0], m.top + q[1]] : null; }
    this.shot(this.heroSrc(h), p, color, false);
    if (kind === 'gold' && amt) later(400, () => { this.floatAt(p, `+${amt}`, '#ffd76b', 'small'); sfx('coin'); });
  },
  combo(h, n) {
    if (h !== this.view) return;
    const c = $('#combo');
    c.textContent = `КОМБО ×${n}`;
    c.style.setProperty('--cs', (1 + Math.min(6, n) * 0.14).toFixed(2));
    c.style.color = ['#fff', '#fff', '#ffe066', '#ffb347', '#ff7a45', '#ff4d8a', '#d36bff'][Math.min(6, n)];
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  },
  cast(h, s, key) {
    sfx('cast', { ult: key === 'r' });
    const r = this.cards.get(h.id);
    const sk = key === 'q' ? r.skQ : r.skR;
    sk.classList.remove('casting'); void sk.offsetWidth; sk.classList.add('casting');
    const fb = $('#feature').getBoundingClientRect();
    const wrap = $('#cast-banner');
    wrap.style.left = fb.left + fb.width / 2 + 'px'; wrap.style.top = fb.top + Math.min(60, fb.height * 0.14) + 'px';
    wrap.innerHTML = '';
    const b = el('div', 'cast', `<div class="ci">${s.icon}</div><div><b>${s.name}</b><small>${h.def.emoji} ${h.name}${key === 'r' ? ' · УЛЬТА' : ''}</small></div>`);
    b.style.setProperty('--cc', h.def.color);
    b.style.animationDuration = (1.1 / Math.max(0.7, Math.min(3, Clock.speed))) + 's';
    wrap.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
  },
  banner(title, sub, team, small) {
    const col = team === 'blue' ? '#3fa7ff' : team === 'red' ? '#ff4d5e' : '#c8aa6e';
    sfx(small ? 'whoosh' : 'banner');
    if (!small) { const sg = $('#game-grid'); sg.classList.remove('quake'); void sg.offsetWidth; sg.classList.add('quake'); }
    if (!small) { const v = $('#vignette'); v.className = team === 'blue' || team === 'red' ? team : ''; void v.offsetWidth; v.classList.add('on'); v.style.animationDuration = (1.8 / Math.max(0.7, Math.min(3, Clock.speed))) + 's'; }
    const b = el('div', 'banner' + (small ? ' small' : ' major'), `<h2>${title}</h2><p>${sub || ''}</p>`);
    b.style.setProperty('--bc', col);
    b.style.animationDuration = (2.4 / Math.max(0.7, Math.min(3, Clock.speed))) + 's';
    const bs = $('#banners');
    if (bs.children.length >= 2) bs.firstChild.remove();
    bs.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
  },
  killFeed(src, tgt) {
    const e = el('div', 'kf', src ? `<span class="tag ${src.team}">${src.def.emoji} ${U.esc(src.nick)}</span><span class="x">⚔</span><span class="tag ${tgt.team}">${tgt.def.emoji} ${U.esc(tgt.nick)}</span>` : `<span class="x">☠</span><span class="tag ${tgt.team}">${tgt.def.emoji} ${U.esc(tgt.nick)}</span>`);
    if (src) sfx('kill');
    const kf = $('#killfeed'); kf.appendChild(e);
    if (kf.children.length > 4) kf.firstChild.remove();
    setTimeout(() => e.remove(), 4600);
    const p = this.heroDst(tgt); FX.burst(p[0], p[1], '#ff3344', 60, 320); FX.ring(p[0], p[1], '#ff3344');
  },
  levelUp(h) {
    const r = this.cards.get(h.id);
    sfx('levelUp');
    r.portrait.classList.remove('lvlup'); void r.portrait.offsetWidth; r.portrait.classList.add('lvlup');
    this.float(h, `Уровень ${h.lvl}!`, '#ffe066');
    const p = this.heroDst(h); if (p) FX.burst(p[0], p[1], '#ffe066', 16, 120);
  },
  teamColors(t) { return (this.game && this.game.opts.colors && this.game.opts.colors[t]) || (t === 'blue' ? ['#1e5f9e', '#d9e6f5'] : ['#9e2235', '#ffcf8a']); },
  tilt(h) {
    const r = this.cards.get(h.id); if (!r) return;
    r.c.classList.toggle('tilted', h.tilt > 0);
    r.c.querySelector('.tilt-badge').textContent = h.tilt > 0 ? ' 😤' + (h.tilt > 1 ? '×' + h.tilt : '') : '';
    this.float(h, h.tilt > 0 ? `ТИЛЬТ ${h.tilt}` : 'спокоен', h.tilt > 0 ? '#ff8a5c' : '#9fe8ff');
    if (h.tilt > 0) sfx('tilt');
  },
  signal(sig) {
    sfx('ping');
    Minimap.ping(sig.from, sig.type);
    this.float(sig.from, this.game.signalLabel(sig), '#ffe066');
    for (const a of sig.answers) this.float(a.h, a.accept ? (a.fast ? '✔ иду!' : '⏳ позже') : '✖ нет', a.accept ? '#9fe8a0' : '#ff9a9a', true);
  },
  shop(h, items) { sfx('coin'); this.float(h, '🛒 ' + items.map(i => i === 'elixir' ? '🧪' : ITEMS[i].icon).join(''), '#ffd76b'); },
  boardHit(h, color) {
    const r = this.cards.get(h.id);
    const b = r.mini.getBoundingClientRect();
    FX.burst(b.left + b.width / 2, b.top + b.height / 2, color || '#fff', 20, 160);
  },
  gameOver(G) { setTimeout(() => App.showEnd(G), 1800 / Math.max(1, Clock.speed)); },
  awaitHumanMove(h) { return AI.chooseMove(this.game, h); },
};

/* ---------- Драфт ---------- */
/* Лицо игрока в цветах клуба (или стороны) */
function faceHTML(p, colors, cls = '') {
  if (!p || !p.face) return `<div class="face-wrap ${cls}"><div class="face-blank">?</div></div>`;
  return `<div class="face-wrap ${cls}">${faceSVG(p.face, { jersey: colors && colors[0] || '#2b4c7e', jersey2: colors && colors[1] || '#e8c66e', emblem: colors && colors[2] })}</div>`;
}
const fitStars = f => '★'.repeat(f) + '☆'.repeat(3 - f);

const Draft = {
  heroCard(d, pl) {
    const s = BASE_STATS[d.main || d.role], m = d.mod || {};
    const fits = ROLE_ORDER.filter(r => d.fit[r] >= 1).sort((a, b) => d.fit[b] - d.fit[a]).map(r => `<span class="fit f${d.fit[r]}">${ROLES[r].short} ${fitStars(d.fit[r])}</span>`).join('');
    const ms = pl ? masteryOf(pl, d.id) : 0;
    return `<div class="hero-detail" style="--hc:${d.color}">
      <div class="hd-portrait">${d.emoji}</div>
      <div>
        <h3>${d.name}</h3><div class="hd-title">${d.title} · ${d.tags.map(t => TAG_NAMES[t]).join(', ')}</div>
        <div class="hd-fits">${fits}${ms ? `<span class="fit ms">Мастерство ${pl.nick}: ${ms}</span>` : ''}</div>
        <div class="hd-lore">${d.lore}</div>
        <div class="hd-stats"><span>❤ <b>${Math.round(s.hp * (m.hp || 1))}</b></span><span>⚔ <b>${(s.atk * (m.atk || 1)).toFixed(0)}</b></span><span>🛡 <b>${Math.round(s.arm * (m.arm || 1))}</b></span><span>✦ <b>${Math.round(s.sp * (m.sp || 1))}</b></span><span>◆ <b>${s.mana}</b></span></div>
        <div class="skill-line"><div class="si">✧<i>П</i></div><div><b>${d.passive.name}</b> <small>пассивное</small><br>${d.passive.desc}</div></div>
        <div class="skill-line"><div class="si">${d.q.icon}<i>Q</i></div><div><b>${d.q.name}</b> <small>${d.q.cost} маны · КД ${d.q.cd}</small><br>${d.q.desc}</div></div>
        <div class="skill-line"><div class="si">${d.r.icon}<i>R</i></div><div><b>${d.r.name}</b> <small>${d.r.cost} маны · КД ${d.r.cd} · с 6 ур.</small><br>${d.r.desc}</div></div>
      </div></div>`;
  },
  /* players: { blue: [5 игроков], red: [...] }, meta: { names, colors } */
  async run(players, meta = {}) {
    const names = meta.names || { blue: 'Синие', red: 'Красные' };
    const colors = meta.colors || { blue: ['#1e5f9e', '#d9e6f5'], red: ['#9e2235', '#ffcf8a'] };
    $('.draft-team.blue').textContent = names.blue; $('.draft-team.red').textContent = names.red;
    const pool = $('#draft-pool'); pool.innerHTML = '';
    const cards = new Map();
    for (const d of ROLE_ORDER.flatMap(r => HEROES.filter(h => h.main === r))) {
      const c = el('div', 'pool-card', `<div class="pe">${d.emoji}</div><div class="pn">${d.name}</div><div class="pr">${ROLE_ORDER.filter(r => d.fit[r] >= 2).map(r => ROLES[r].short).join(' · ')}</div>`);
      c.style.setProperty('--hc', d.color);
      c.addEventListener('click', () => { $('#draft-detail').innerHTML = this.heroCard(d); });
      pool.appendChild(c); cards.set(d.id, c);
    }
    $('#draft-detail').innerHTML = '<p style="color:var(--muted)">Игроки выбирают героев. Любой герой подходит на любую роль, но звёзды показывают, где он силён. Нажмите на героя, чтобы изучить его.</p>';
    const slots = { blue: new Map(), red: new Map() };
    for (const t of ['blue', 'red']) {
      const col = $('#picks-' + t); col.innerHTML = '';
      for (const p of players[t]) {
        const s = el('div', 'pick-slot', `${faceHTML(p, colors[t], 'pf')}<div class="pp">?</div><div class="pn"><b>${U.esc(p.nick)}</b><small>${ROLES[p.role].icon} ${ROLES[p.role].name}</small><em class="why"></em></div>`);
        col.appendChild(s); slots[t].set(p, s);
      }
    }
    const order = ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'];
    $('#draft-order').innerHTML = order.map(t => `<div class="po ${t}"></div>`).join('');
    const po = [...document.querySelectorAll('#draft-order .po')];
    const picks = { blue: [], red: [] };
    const taken = new Set();
    for (let i = 0; i < order.length; i++) {
      const t = order[i];
      po.forEach((x, j) => { x.classList.toggle('cur', j === i); x.classList.toggle('done', j < i); });
      $('#draft-phase').textContent = `${names[t]} выбирают`;
      $('#draft-phase').style.color = t === 'blue' ? 'var(--blue)' : 'var(--red)';
      const pick = AI.draftPick(players, picks, taken, t);
      const slot = slots[t].get(pick.pl);
      slot.classList.add('picking');
      $('#draft-sub').textContent = `${pick.pl.nick} (${ROLES[pick.role].name}) выбирает героя…`;
      const browse = U.shuffle(HEROES.filter(h => !taken.has(h.id) && h !== pick.def)).slice(0, 3);
      for (const b of browse) { const c = cards.get(b.id); c.classList.add('hover'); sfx('draft', { n: U.ri(8) }); await wait(160); c.classList.remove('hover'); }
      const cc = cards.get(pick.def.id);
      cc.classList.add('hover');
      $('#draft-detail').innerHTML = this.heroCard(pick.def, pick.pl);
      await wait(420);
      cc.classList.remove('hover');
      sfx('lockin');
      cc.classList.add('taken');
      cc.dataset.team = names[t].toUpperCase();
      cc.style.setProperty('--tc', t === 'blue' ? '#1e6fa8' : '#a82a36');
      taken.add(pick.def.id);
      picks[t].push(pick);
      slot.classList.remove('picking'); slot.classList.add('done');
      const pp = slot.querySelector('.pp');
      pp.textContent = pick.def.emoji;
      pp.style.background = `radial-gradient(circle at 35% 30%, ${pick.def.color}, #0b0f1d 85%)`;
      const ms = masteryOf(pick.pl, pick.def.id), off = pick.def.fit[pick.role] < 3;
      slot.querySelector('.pn').innerHTML = `<b>${U.esc(pick.pl.nick)}</b><span class="ph">${pick.def.name}</span><small>${ROLES[pick.role].short} ${fitStars(pick.def.fit[pick.role])}${ms ? ' · ✦' + ms : ''}</small><em class="why ${off ? 'off' : ''}" title="${U.esc(pick.reason)}">${off ? '⚠ не по профилю' : ms >= 15 ? '★ коронный герой' : ''}</em>`;
      slot.title = pick.reason;
      await wait(380);
    }
    po.forEach(x => { x.classList.remove('cur'); x.classList.add('done'); });
    $('#draft-phase').textContent = 'Составы утверждены';
    $('#draft-phase').style.color = 'var(--gold)';
    $('#draft-sub').textContent = 'Загрузка Ущелья Кристаллов…';
    await wait(1100);
    return picks;
  },
};
