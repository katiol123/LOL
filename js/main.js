'use strict';
/* Точка входа: экраны, переходы, главный цикл отрисовки */

const App = {
  game: null,
  async show(id) {
    const fade = $('#fade');
    fade.classList.add('on');
    await new Promise(r => setTimeout(r, 450));
    document.querySelectorAll('.screen').forEach(s => { s.style.transition = 'none'; s.classList.toggle('active', s.id === id); });
    void document.body.offsetWidth;
    document.querySelectorAll('.screen').forEach(s => { s.style.transition = ''; s.scrollTop = 0; s.scrollLeft = 0; });
    const app = $('#app'); app.scrollTop = 0; app.scrollLeft = 0;
    if (innerWidth > 900) { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
    await new Promise(r => setTimeout(r, 120));
    fade.classList.remove('on');
  },

  init() {
    FX.init();
    Sound.init();
    addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
    addEventListener('keydown', () => Sound.unlock(), { capture: true });
    const syncSnd = () => document.querySelectorAll('.snd-toggle').forEach(b => b.classList.toggle('off', b.dataset.snd === 'sfx' ? !Sound.enabled : !Sound.music));
    document.querySelectorAll('.snd-toggle').forEach(b => b.onclick = e => {
      e.stopPropagation(); Sound.unlock();
      if (b.dataset.snd === 'sfx') Sound.setEnabled(!Sound.enabled); else Sound.setMusic(!Sound.music);
      syncSnd(); Sound.play('click');
    });
    syncSnd();
    document.addEventListener('click', e => { if (e.target.closest('.btn, .speed button, .pool-card')) Sound.play('click'); });
    // легенда камней
    const lg = $('#gem-legend');
    GEMS.forEach((g, t) => {
      const row = el('div', 'gem-row');
      const cv = document.createElement('canvas'); cv.width = cv.height = 60;
      cv.getContext('2d').drawImage(Sprites.get(t, 60), 0, 0);
      row.appendChild(cv);
      row.appendChild(el('div', '', `<b style="color:${g.color}">${g.name}</b><span>${g.desc}</span>`));
      lg.appendChild(row);
    });
    const sp = el('div', 'gem-row');
    const cv = document.createElement('canvas'); cv.width = cv.height = 60;
    cv.getContext('2d').drawImage(Sprites.get(T_STONE, 60), 0, 0);
    sp.appendChild(cv);
    sp.appendChild(el('div', '', `<b style="color:#aab">Булыжник</b><span>Помеха от умений врага: не двигается и не совпадает. Раскалывается от соседнего совпадения.</span>`));
    lg.appendChild(sp);
    // кодекс
    const codex = role => { $('#codex-list').innerHTML = ROLE_ORDER.filter(r => !role || r === role).flatMap(r => HEROES.filter(h => h.role === r)).map(d => Draft.heroCard(d)).join(''); };
    codex(null);
    const cf = $('#codex-filter');
    cf.innerHTML = `<button class="on" data-r="">Все</button>` + ROLE_ORDER.map(r => `<button data-r="${r}">${ROLES[r].icon} ${ROLES[r].name}</button>`).join('');
    cf.querySelectorAll('button').forEach(b => b.onclick = () => { cf.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); codex(b.dataset.r || null); });
    this.titleGems();
    $('#btn-codex').onclick = () => $('#codex').classList.add('open');
    $('#codex-close').onclick = () => $('#codex').classList.remove('open');
    $('#codex').onclick = e => { if (e.target.id === 'codex') $('#codex').classList.remove('open'); };
    $('#btn-start').onclick = () => this.start();
    $('#btn-again').onclick = () => (this.endAction ? this.endAction() : this.start());
    $('#btn-menu').onclick = () => { this.endAction = null; this.show('screen-title'); this.refreshTitle(); };
    $('#btn-campaign').onclick = () => { if (loadLeague() && !confirm('Начать новую кампанию? Сохранённая будет заменена.')) return; Campaign.openCreate(); };
    $('#btn-continue').onclick = () => Campaign.continueSaved();
    $('#hub-menu').onclick = () => { this.show('screen-title'); this.refreshTitle(); };
    $('#profile-close').onclick = () => $('#profile').classList.remove('open');
    $('#profile').onclick = e => { if (e.target.id === 'profile') $('#profile').classList.remove('open'); };
    this.refreshTitle();
    document.querySelectorAll('.speed button[data-speed]').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.speed));
    addEventListener('keydown', e => {
      if (!this.game) return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(Clock.paused ? (this.lastSpeed || 1) : 0); }
      const map = { Digit1: 1, Digit2: 2, Digit3: 4, Digit4: 10 };
      if (map[e.code]) this.setSpeed(map[e.code]);
    });
    addEventListener('resize', () => UI.resize());
    // пересчёт размеров при любом изменении раскладки (шрифты, панели)
    let rsT = null, lastBox = '';
    const ro = new ResizeObserver(() => {
      const b = $('#feature-box'); const k = b.clientWidth + 'x' + b.clientHeight + ':' + $('#col-blue').clientHeight;
      if (k === lastBox) return; lastBox = k;
      clearTimeout(rsT); rsT = setTimeout(() => UI.resize(), 60);
    });
    ro.observe($('#game-grid')); ro.observe($('#feature-box'));
    // главный цикл
    let last = performance.now();
    const loop = now => {
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dt = Clock.paused ? 0 : real * Math.min(Clock.speed, 4);
      if ($('#screen-game').classList.contains('active')) UI.frame(dt, now / 1000);
      FX.update(real * Math.min(2.5, Math.max(1, Clock.speed)));
      FX.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  setSpeed(s) {
    if (s === 0) { Clock.paused = true; }
    else { Clock.paused = false; Clock.speed = s; this.lastSpeed = s; }
    document.querySelectorAll('.speed button[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === (Clock.paused ? 0 : Clock.speed)));
  },

  refreshTitle() { $('#btn-continue').hidden = !loadLeague(); },

  /* Быстрый матч: два случайных клуба из свежесгенерированной лиги */
  async start() {
    if (this.running) return;
    const L = createLeague();
    const [a, b] = U.shuffle(L.clubs.slice()).slice(0, 2);
    Campaign.L = L;
    await this.playMatch({ blue: rosterOf(L, a), red: rosterOf(L, b) }, {
      names: { blue: a.name, red: b.name }, colors: { blue: clubColors(a), red: clubColors(b) }, quick: true,
    });
  },

  /* Общий запуск матча: драфт → VS → игра → итоги. Возвращает игру, когда игрок нажмёт «Продолжить». */
  async playMatch(players, meta) {
    this.running = true;
    this.setSpeed(this.lastSpeed && !meta.quick ? this.lastSpeed : 1);
    Clock.headless = false;
    this.meta = meta;
    await this.show('screen-draft');
    const picks = await Draft.run(players, meta);
    for (const t of ['blue', 'red']) {
      const col = meta.colors ? meta.colors[t] : null;
      $('#vs-' + t).innerHTML = `<div class="vs-team">${U.esc(meta.names ? meta.names[t] : t)}</div>` + ROLE_ORDER.map(r => picks[t].find(p => p.role === r)).map((p, i) =>
        `<div class="vs-card" style="--hc:${p.def.color};transition-delay:${i * 0.12}s"><div class="vp">${faceHTML(p.pl, col)}<span class="hero-badge" style="--hc:${p.def.color}">${p.def.emoji}</span></div><b>${U.esc(p.pl.nick)}</b><small>${p.def.name} · ${ROLES[p.role].short}</small></div>`).join('');
    }
    $('#screen-vs').classList.remove('go');
    await this.show('screen-vs');
    await new Promise(r => setTimeout(r, 100));
    $('#screen-vs').classList.add('go');
    await new Promise(r => setTimeout(r, 3400));
    this.game = new Game(picks.blue, picks.red, UI, { names: meta.names, colors: meta.colors });
    await this.show('screen-game');
    UI.init(this.game);
    requestAnimationFrame(() => UI.resize());
    await new Promise(r => setTimeout(r, 400));
    UI.banner('ДОБРО ПОЖАЛОВАТЬ', `${meta.names ? meta.names.blue + ' — ' + meta.names.red : 'в Ущелье Кристаллов'}`, 'sys');
    this.running = false;
    const done = new Promise(res => { this.matchDone = res; });
    try { await this.game.run(); } catch (e) { console.error(e); UI.log('Ошибка симуляции: ' + U.esc(e.message), 'sys'); }
    return done;
  },

  showEnd(G) {
    const meta = this.meta || {};
    computeRatings(G);
    const rec = meta.onResult ? meta.onResult(G) : null;
    const gains = rec ? Object.fromEntries(rec.players.map(x => [x.id, x.gain])) : {};
    const w = G.winner;
    $('#end-title').textContent = `Победа: ${G.teams[w].name}`;
    $('#end-title').className = w;
    let sub = `Длительность ${U.fmtTime(G.minute)} · Убийства ${G.teams.blue.kills} : ${G.teams.red.kills} · Драконы ${G.teams.blue.dragons.length} : ${G.teams.red.dragons.length} · Башни ${this.towersDown(G, 'red')} : ${this.towersDown(G, 'blue')}`;
    if (meta.series) {
      const ws = [...meta.series.prev, rec ? rec.winner : null].filter(Boolean);
      const h = ws.filter(x => x === 'home').length, a = ws.length - h;
      sub += ` · Серия: ${meta.series.homeName} ${h} : ${a} ${meta.series.awayName}${ws.length === 2 ? (h === a ? ' — ничья (по 1 очку)' : ` — победа ${h > a ? meta.series.homeName : meta.series.awayName} (3 очка)`) : ''}`;
    }
    $('#end-sub').textContent = sub;
    const all = G.heroes;
    const mvp = all.find(h => h.mvp);
    const row = h => `<tr class="${h.pl && h.pl.human ? 'me' : ''}"><td class="${h === mvp ? 'mvp' : ''}"><span class="pt pface-s">${faceHTML(h.pl, UI.teamColors(h.team))}</span>${U.esc(h.nick)}${h.pl && h.pl.human ? ' <span class="you">ВЫ</span>' : ''}${h === mvp ? ' ★ MVP' : ''}<br><small class="muted">${h.def.emoji} ${h.name} · ${ROLES[h.role].short}${h.fit < 3 ? ' ' + fitStars(h.fit) : ''}</small></td>
      <td><span class="rbadge" style="background:${ratingColor(h.rating)}">${h.rating.toFixed(1)}</span>${gains[h.pl.id] ? `<span class="gain" title="Мастерство на герое выросло за высокую оценку"> ✦+${gains[h.pl.id]}</span>` : ''}</td>
      <td>${h.lvl}</td><td>${h.k}/${h.d}/${h.a}</td><td>${Math.round(h.dmg)}</td><td>${Math.round(h.healed + (h.shielded || 0))}</td><td>${Math.round(h.vis || 0)}</td><td>${h.totalGold}</td><td>${h.items.map(i => `<span title="${ITEMS[i].name}">${ITEMS[i].icon}</span>`).join('') || '—'}</td></tr>`;
    $('#end-table').innerHTML = ['blue', 'red'].map(t => `
      <div class="panel et ${t} ${t === w ? 'win' : ''}"><h3>${U.esc(G.teams[t].name)}${G.teams[t].heroes.some(h => h.pl && h.pl.human) ? ' <span class="you">ВАШ КЛУБ</span>' : ''}${t === w ? ' — победа' : ''}</h3>
      <table><tr><th>Игрок</th><th>Оценка</th><th>Ур.</th><th>У/С/П</th><th>Урон</th><th>Леч./щит</th><th>Обзор</th><th>Золото</th><th>Предметы</th></tr>
      ${G.teams[t].heroes.map(row).join('')}</table></div>`).join('');
    const aw = [
      ['★ Лучшая оценка', mvp, h => h.rating.toFixed(1)],
      ['⚔ Больше всего урона', U.maxBy(all, h => h.dmg), h => Math.round(h.dmg)],
      ['☠ Больше всего убийств', U.maxBy(all, h => h.k * 100 + h.a), h => `${h.k} уб.`],
      ['✚ Лучший целитель', U.maxBy(all, h => h.healed + (h.shielded || 0)), h => Math.round(h.healed + (h.shielded || 0))],
      ['◉ Мастер обзора', U.maxBy(all, h => h.vis || 0), h => `${Math.round(h.vis || 0)} ◉`],
    ];
    let awards = $('#awards');
    if (!awards) { awards = el('div', 'awards'); awards.id = 'awards'; $('#end-table').after(awards); const g = document.createElement('canvas'); g.id = 'end-graph'; awards.after(g); }
    awards.innerHTML = aw.map(([t, h, f]) => `<div class="award"><small>${t}</small><b class="tag ${h.team}">${h.def.emoji} ${U.esc(h.nick)}</b><div class="aw-v">${f(h)}</div></div>`).join('');
    // кнопки
    const again = $('#btn-again');
    if (meta.quick) { again.textContent = '⚔ Новый матч'; this.endAction = null; }
    else { again.textContent = meta.continueLabel || 'Продолжить →'; this.endAction = () => { this.endAction = null; const r = this.matchDone; this.matchDone = null; if (r) r(G); }; }
    $('#btn-menu').hidden = !meta.quick;
    this.show('screen-end').then(() => {
      const g = $('#end-graph'); const d = DPR();
      g.width = g.clientWidth * d; g.height = g.clientHeight * d;
      this.drawGoldGraph(g, UI.advHist, G, true);
    });
  },
  towersDown(G, t) { return LANES.reduce((s, l) => s + G.teams[t].towers[l].filter(x => x <= 0).length, 0); },

  /* График разницы золота (синие сверху, красные снизу) */
  drawGoldGraph(cv, hist, G, big) {
    const c = cv.getContext('2d'), d = DPR();
    const W = cv.width / d, H = cv.height / d;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, W, H);
    const pad = 6, mid = H / 2;
    const max = Math.max(1500, ...hist.map(Math.abs));
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(pad, mid); c.lineTo(W - pad, mid); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.font = '9px Inter, sans-serif'; c.fillText('0', pad + 2, mid - 3);
    if (hist.length > 1) { c.fillStyle = 'rgba(255,255,255,.35)'; for (let m = 5; m < hist.length; m += 5) { const xx = pad + (W - pad * 2) * m / (hist.length - 1); c.fillRect(xx, mid - 3, 1, 6); c.fillText(m + 'м', xx + 2, mid + 12); } }
    if (hist.length < 2) { c.clearRect(0, 0, W, H); c.fillStyle = '#8c93a8'; c.font = '11px Inter, sans-serif'; c.fillText('График появится после первой минуты', pad + 4, mid - 6); return; }
    const x = i => pad + (W - pad * 2) * i / (hist.length - 1);
    const y = v => mid - (H / 2 - pad) * v / max;
    for (const [sign, col] of [[1, 'rgba(63,167,255,'], [-1, 'rgba(255,77,94,']]) {
      c.save();
      c.beginPath(); c.rect(0, sign > 0 ? 0 : mid, W, mid); c.clip();
      const gr = c.createLinearGradient(0, sign > 0 ? 0 : H, 0, mid);
      gr.addColorStop(0, col + '.55)'); gr.addColorStop(1, col + '.05)');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(x(0), mid); hist.forEach((v, i) => c.lineTo(x(i), y(v))); c.lineTo(x(hist.length - 1), mid); c.closePath(); c.fill();
      c.strokeStyle = col + '1)'; c.lineWidth = 2;
      c.beginPath(); hist.forEach((v, i) => i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))); c.stroke();
      c.restore();
    }
    c.fillStyle = '#7cc4ff'; c.font = `${big ? 12 : 10}px Inter, sans-serif`;
    c.fillText('Синие', pad + 2, pad + 10);
    c.fillStyle = '#ff8c95'; c.fillText('Красные', pad + 2, H - pad - 2);
    const last = hist[hist.length - 1];
    if (big) { c.fillStyle = last >= 0 ? '#7cc4ff' : '#ff8c95'; c.textAlign = 'right'; c.fillText(`${last >= 0 ? '+' : '−'}${(Math.abs(last) / 1000).toFixed(1)}k`, W - pad - 2, last >= 0 ? H - pad - 2 : pad + 10); c.textAlign = 'left'; }
    else { const t = document.querySelector('.adv-panel .panel-title'); if (t) t.innerHTML = `Преимущество по золоту <span style="float:right;color:${last >= 0 ? '#7cc4ff' : '#ff8c95'}">${last >= 0 ? 'Синие +' : 'Красные +'}${(Math.abs(last) / 1000).toFixed(1)}k</span>`; }
  },

  /* Медленно плывущие кристаллы на титульном экране */
  titleGems() {
    const cv = $('#title-gems'); const c = cv.getContext('2d');
    const gems = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: U.rand(18, 46), t: U.ri(6), v: U.rand(0.008, 0.025), r: Math.random() * 6, vr: U.rand(-0.4, 0.4) }));
    let last = performance.now();
    const step = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if ($('#screen-title').classList.contains('active')) {
        const d = DPR(), W = cv.clientWidth, H = cv.clientHeight;
        if (cv.width !== Math.round(W * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
        c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
        for (const g of gems) {
          g.y -= g.v * dt; g.r += g.vr * dt;
          if (g.y < -0.1) { g.y = 1.1; g.x = Math.random(); }
          c.save(); c.translate(g.x * W, g.y * H); c.rotate(g.r);
          c.globalAlpha = 0.35 + 0.25 * Math.sin(now / 900 + g.x * 10);
          c.drawImage(Sprites.get(g.t, g.s), -g.s / 2, -g.s / 2, g.s, g.s);
          c.restore();
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
