'use strict';
/* Точка входа: экраны, переходы, главный цикл отрисовки */

const App = {
  game: null,
  async show(id) {
    const fade = $('#fade');
    fade.classList.add('on');
    await new Promise(r => setTimeout(r, 450));
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    await new Promise(r => setTimeout(r, 60));
    fade.classList.remove('on');
  },

  init() {
    FX.init();
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
    $('#codex-list').innerHTML = ROLE_ORDER.flatMap(r => HEROES.filter(h => h.role === r)).map(d => Draft.heroCard(d)).join('');
    $('#btn-codex').onclick = () => $('#codex').classList.add('open');
    $('#codex-close').onclick = () => $('#codex').classList.remove('open');
    $('#codex').onclick = e => { if (e.target.id === 'codex') $('#codex').classList.remove('open'); };
    $('#btn-start').onclick = () => this.start();
    $('#btn-again').onclick = () => this.start();
    $('#btn-menu').onclick = () => this.show('screen-title');
    document.querySelectorAll('.speed button').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.speed));
    addEventListener('keydown', e => {
      if (!this.game) return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(Clock.paused ? (this.lastSpeed || 1) : 0); }
      const map = { Digit1: 1, Digit2: 2, Digit3: 4, Digit4: 10 };
      if (map[e.code]) this.setSpeed(map[e.code]);
    });
    addEventListener('resize', () => UI.resize());
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
    document.querySelectorAll('.speed button').forEach(b => b.classList.toggle('on', +b.dataset.speed === (Clock.paused ? 0 : Clock.speed)));
  },

  async start() {
    if (this.running) return;
    this.running = true;
    this.setSpeed(1);
    await this.show('screen-draft');
    const picks = await Draft.run();
    // VS
    for (const t of ['blue', 'red']) {
      $('#vs-' + t).innerHTML = ROLE_ORDER.map(r => picks[t].find(p => p.role === r)).map((d, i) =>
        `<div class="vs-card" style="--hc:${d.color};transition-delay:${i * 0.12}s"><div class="vp">${d.emoji}</div><b>${d.name}</b><small>${ROLES[d.role].short} · ${d.title}</small></div>`).join('');
    }
    $('#screen-vs').classList.remove('go');
    await this.show('screen-vs');
    await new Promise(r => setTimeout(r, 100));
    $('#screen-vs').classList.add('go');
    await new Promise(r => setTimeout(r, 2800));
    // Матч
    this.game = new Game(picks.blue, picks.red, UI);
    await this.show('screen-game');
    UI.init(this.game);
    requestAnimationFrame(() => UI.resize());
    await new Promise(r => setTimeout(r, 400));
    UI.banner('ДОБРО ПОЖАЛОВАТЬ', 'в Ущелье Кристаллов', 'sys');
    this.running = false;
    try { await this.game.run(); } catch (e) { console.error(e); UI.log('Ошибка симуляции: ' + U.esc(e.message), 'sys'); }
  },

  showEnd(G) {
    const w = G.winner;
    $('#end-title').textContent = w === 'blue' ? 'Победа Синих' : 'Победа Красных';
    $('#end-title').className = w;
    $('#end-sub').textContent = `Длительность ${U.fmtTime(G.minute)} · Убийства ${G.teams.blue.kills} : ${G.teams.red.kills} · Драконы ${G.teams.blue.dragons.length} : ${G.teams.red.dragons.length}`;
    const score = h => h.k * 3 + h.a * 1.5 - h.d * 1.2 + h.dmg / 1500 + h.totalGold / 2000;
    const mvp = U.maxBy(G.teams[w].heroes, score);
    $('#end-table').innerHTML = ['blue', 'red'].map(t => `
      <div class="panel et ${t}"><h3>${G.teams[t].name}${t === w ? ' — победа' : ''}</h3>
      <table><tr><th>Герой</th><th>Ур.</th><th>У/С/П</th><th>Урон</th><th>Золото</th><th>Предметы</th></tr>
      ${G.teams[t].heroes.map(h => `<tr><td class="${h === mvp ? 'mvp' : ''}">${h.def.emoji} ${h.name}${h === mvp ? ' ★MVP' : ''}</td><td>${h.lvl}</td><td>${h.k}/${h.d}/${h.a}</td><td>${Math.round(h.dmg)}</td><td>${h.totalGold}</td><td>${h.items.map(i => ITEMS[i].icon).join('')}</td></tr>`).join('')}
      </table></div>`).join('');
    this.show('screen-end');
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
