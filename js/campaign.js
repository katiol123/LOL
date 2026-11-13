'use strict';
/* Интерфейс кампании: создание игрока, выбор клуба, центр лиги, профили, просчёт туров */

const HEADLESS_UI = new Proxy({}, { get: (t, k) => (k === 'askSignal' ? undefined : () => {}) });
const STAT_BUDGET = 80, STAT_MIN0 = 4, STAT_MAX0 = 16;
const statCost = v => (v <= 14 ? v : 14 + (v - 14) * 2);
const PRESETS = {
  'Сбалансированный': { rea: 10, mech: 10, read: 10, farm: 10, map: 10, agr: 10, calm: 10, team: 10 },
  'Механик': { rea: 14, mech: 14, read: 11, farm: 10, map: 8, agr: 9, calm: 8, team: 6 },
  'Стратег': { read: 14, map: 14, team: 11, calm: 10, rea: 8, mech: 8, farm: 8, agr: 7 },
  'Капитан': { team: 14, calm: 14, map: 11, read: 10, rea: 8, mech: 8, farm: 8, agr: 7 },
  'Фармер': { farm: 14, calm: 13, mech: 11, read: 10, rea: 9, map: 8, agr: 8, team: 7 },
  'Агрессор': { agr: 14, rea: 14, mech: 11, farm: 10, calm: 8, read: 8, map: 8, team: 7 },
};
const statColor = v => (v >= 16 ? '#5fe08a' : v >= 13 ? '#a8e05f' : v >= 9 ? '#e0d25f' : v >= 6 ? '#e0a05f' : '#ff6b6b');
const clubColors = c => [c.color, c.color2, c.emblem];

/* ---------- Общие блоки ---------- */
function statBars(stats, opts = {}) {
  return `<div class="statbars">${STATS.map(s => {
    const v = stats[s.key];
    const cmp = opts.cmp ? opts.cmp[s.key] : null;
    return `<div class="sb-row" title="${U.esc(s.desc)}"><span class="sb-n">${s.icon} ${s.name}</span><span class="sb-bar"><i style="width:${v / 20 * 100}%;background:${statColor(v)}"></i>${cmp != null ? `<em style="left:${cmp / 20 * 100}%"></em>` : ''}</span><b style="color:${statColor(v)}">${typeof v === 'number' && v % 1 ? v.toFixed(1) : v}</b></div>`;
  }).join('')}</div>`;
}
function ratingChips(p, n = 5) {
  const r = p.ratings.slice(-n);
  return r.length ? r.map(x => `<span class="rchip" style="background:${ratingColor(x)}">${x.toFixed(1)}</span>`).join('') : '<small class="muted">нет матчей</small>';
}
function masteryList(p, n = 8) {
  const ms = topMastery(p, n);
  if (!ms.length) return '<small class="muted">нет мастерства ни на одном герое</small>';
  return ms.map(([id, v]) => { const d = HEROES.find(h => h.id === id); return `<span class="mchip ${v >= 15 ? 'star' : ''}" title="${d.name}: мастерство ${v} (+${(v / 4).toFixed(1)} ко всем характеристикам на этом герое)">${d.emoji} ${d.name} <b>${v}</b></span>`; }).join('');
}
function playerRow(L, p, opts = {}) {
  const club = p.club && clubById(L, p.club);
  return `<div class="prow ${p.human ? 'me' : ''}" data-pid="${p.id}">
    ${faceHTML(p, club ? clubColors(club) : null, 'pr-face')}
    <div class="pr-name"><b>${U.esc(p.nick)}${p.human ? ' <span class="you">ВЫ</span>' : ''}${p.talent === 'star' ? ' <span title="Восходящая звезда">🌟</span>' : ''}</b><small>${ROLES[p.role].icon} ${ROLES[p.role].name}${opts.club && club ? ' · ' + club.emblem + ' ' + club.tag : ''}</small></div>
    <div class="pr-ovr" title="Общий рейтинг (среднее 8 характеристик)">${playerOvr(p).toFixed(1)}</div>
    <div class="pr-form" style="color:${formColor(p)}" title="Форма: средняя оценка за 5 матчей ${playerFormAvg(p).toFixed(2)}">${formArrow(p)}</div>
    ${opts.last ? `<div class="pr-last">${ratingChips(p, 3)}</div>` : ''}
  </div>`;
}

const Campaign = {
  L: null,
  cs: null,       // состояние создания персонажа

  /* =================== Создание игрока =================== */
  openCreate() {
    const rng = U.seeded(Math.floor(Math.random() * 1e9));
    const female = Math.random() < 0.35;
    const idn = genIdentity(rng, new Set());
    this.cs = { first: idn.first, last: idn.last, nick: idn.nick, role: 'mid', female, face: genFace(rng, { female }), stats: Object.assign({}, PRESETS['Сбалансированный']), heroes: new Set() };
    this.L = createLeague();
    $('#cr-first').value = this.cs.first; $('#cr-last').value = this.cs.last; $('#cr-nick').value = this.cs.nick;
    $('#cr-roles').innerHTML = ROLE_ORDER.map(r => `<button class="chip" data-role="${r}">${ROLES[r].icon} ${ROLES[r].name}</button>`).join('');
    $('#cr-roles').querySelectorAll('button').forEach(b => b.onclick = () => { this.cs.role = b.dataset.role; this.cs.heroes.clear(); this.renderCreate(); });
    $('#cr-presets').innerHTML = Object.keys(PRESETS).map(n => `<button class="chip" data-p="${n}">${n}</button>`).join('');
    $('#cr-presets').querySelectorAll('button').forEach(b => b.onclick = () => { this.cs.stats = Object.assign({}, PRESETS[b.dataset.p]); this.renderCreate(); });
    $('#cr-random-face').onclick = () => { this.cs.face = genFace(U.seeded(Math.floor(Math.random() * 1e9)), { female: this.cs.female }); this.renderCreate(); };
    $('#cr-gender').onclick = () => { this.cs.female = !this.cs.female; this.cs.face = genFace(U.seeded(Math.floor(Math.random() * 1e9)), { female: this.cs.female }); this.renderCreate(); };
    for (const id of ['first', 'last', 'nick']) $('#cr-' + id).oninput = e => { this.cs[id] = e.target.value; };
    $('#cr-back').onclick = () => App.show('screen-title');
    $('#cr-next').onclick = () => this.finishCreate();
    this.renderCreate();
    App.show('screen-create');
  },
  spent() { return U.sum(STAT_KEYS, k => statCost(this.cs.stats[k])); },
  renderCreate() {
    const cs = this.cs;
    $('#cr-face-preview').innerHTML = faceHTML({ face: cs.face }, ['#1e5f9e', '#e8c66e'], 'big');
    // внешность
    const sw = (key, pal) => `<div class="fc-row"><span>${{ skin: 'Кожа', hairColor: 'Волосы', eyeColor: 'Глаза', lip: 'Губы' }[key]}</span><div class="swatches">${pal.map((c, i) => `<i data-k="${key}" data-v="${i}" class="${cs.face[key] === i ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div></div>`;
    const sel = (key, label, names) => `<div class="fc-row"><span>${label}</span><select data-k="${key}">${names.map((n, i) => `<option value="${i}" ${cs.face[key] === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
    $('#cr-face-controls').innerHTML = sw('skin', FACE_PAL.skin) + sel('hair', 'Причёска', HAIR_STYLES) + sw('hairColor', FACE_PAL.hair) + sw('eyeColor', FACE_PAL.eye)
      + sel('eyeType', 'Разрез глаз', ['круглые', 'узкие', 'миндалевидные', 'прищур']) + sel('nose', 'Нос', ['прямой', 'округлый', 'широкий']) + sel('mouth', 'Рот', ['улыбка', 'спокойный', 'ухмылка', 'смех'])
      + (cs.female ? '' : sel('beard', 'Борода', BEARDS)) + sel('acc', 'Аксессуар', ACCS);
    $('#cr-face-controls').querySelectorAll('i[data-k]').forEach(i => i.onclick = () => { cs.face[i.dataset.k] = +i.dataset.v; this.renderCreate(); });
    $('#cr-face-controls').querySelectorAll('select').forEach(s => s.onchange = () => { cs.face[s.dataset.k] = +s.value; this.renderCreate(); });
    // роль
    $('#cr-roles').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.role === cs.role));
    $('#cr-presets').querySelectorAll('button').forEach(b => b.classList.toggle('on', STAT_KEYS.every(k => PRESETS[b.dataset.p][k] === cs.stats[k])));
    // характеристики
    const left = STAT_BUDGET - this.spent();
    $('#cr-points').innerHTML = `— осталось очков: <b style="color:${left === 0 ? '#5fe08a' : left < 0 ? '#ff6b6b' : '#ffe066'}">${left}</b>`;
    $('#cr-stats').innerHTML = STATS.map(s => {
      const v = cs.stats[s.key];
      const canUp = v < STAT_MAX0 && statCost(v + 1) - statCost(v) <= left, canDn = v > STAT_MIN0;
      return `<div class="cr-stat"><div class="cs-top"><span>${s.icon} <b>${s.name}</b></span><span class="cs-ctl"><button data-k="${s.key}" data-d="-1" ${canDn ? '' : 'disabled'}>−</button><b class="cs-v" style="color:${statColor(v)}">${v}</b><button data-k="${s.key}" data-d="1" ${canUp ? '' : 'disabled'}>+</button></span></div>
        <div class="sb-bar"><i style="width:${v / 20 * 100}%;background:${statColor(v)}"></i></div><small>${s.desc}</small></div>`;
    }).join('');
    $('#cr-stats').querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { cs.stats[b.dataset.k] += +b.dataset.d; this.renderCreate(); });
    // герои
    const list = HEROES.slice().sort((a, b) => b.fit[cs.role] - a.fit[cs.role]);
    $('#cr-hero-list').innerHTML = list.map(d => `<div class="cr-hero ${cs.heroes.has(d.id) ? 'on' : ''}" data-id="${d.id}" style="--hc:${d.color}"><span class="ch-e">${d.emoji}</span><span><b>${d.name}</b><small>${ROLES[cs.role].short} ${fitStars(d.fit[cs.role])} · ${d.tags.map(t => TAG_NAMES[t]).join(', ')}</small></span>${cs.heroes.has(d.id) ? '<em>✦4</em>' : ''}</div>`).join('');
    $('#cr-hero-list').querySelectorAll('.cr-hero').forEach(e => e.onclick = () => {
      const id = e.dataset.id;
      if (cs.heroes.has(id)) cs.heroes.delete(id); else if (cs.heroes.size < 3) cs.heroes.add(id);
      this.renderCreate();
    });
    $('#cr-next').disabled = left !== 0 || !cs.nick.trim();
    $('#cr-next').title = left !== 0 ? 'Распределите все очки характеристик' : '';
  },
  finishCreate() {
    const cs = this.cs;
    if (STAT_BUDGET - this.spent() !== 0) return;
    const p = makePlayer({ nick: cs.nick.trim() || 'Игрок', first: cs.first.trim() || 'Игрок', last: cs.last.trim(), role: cs.role, stats: Object.assign({}, cs.stats), face: cs.face, human: true, age: 19 });
    for (const id of cs.heroes) p.mastery[id] = 4;
    this.human = p;
    this.openClubs();
  },

  /* =================== Выбор клуба =================== */
  openClubs() {
    const L = this.L;
    const list = L.clubs.slice().sort((a, b) => clubOvr(L, b) - clubOvr(L, a));
    $('#cl-list').innerHTML = list.map(c => `<div class="club-card" data-id="${c.id}" style="--cc:${c.color};--cc2:${c.color2}">
      <div class="cc-em">${c.emblem}</div><div class="cc-n"><b>${c.name}</b><small>${c.tag} · рейтинг ${clubOvr(L, c).toFixed(1)}</small></div>
      <div class="cc-ov">${'★'.repeat(Math.max(1, Math.round((clubOvr(L, c) - 7) / 1.2)))}</div></div>`).join('');
    $('#cl-list').querySelectorAll('.club-card').forEach(e => e.onclick = () => this.showClub(e.dataset.id, true));
    this.showClub(list[0].id, true);
    App.show('screen-clubs');
  },
  clubDetailHTML(c, choosing) {
    const L = this.L;
    const avg = clubStatAvg(L, c);
    const leagueAvg = Object.fromEntries(STAT_KEYS.map(k => [k, U.sum(L.clubs, x => clubStatAvg(L, x)[k]) / L.clubs.length]));
    const strong = STATS.filter(s => avg[s.key] - leagueAvg[s.key] >= 0.8).map(s => s.name), weak = STATS.filter(s => leagueAvg[s.key] - avg[s.key] >= 0.8).map(s => s.name);
    const replaced = choosing && this.human ? L.players[c.roster[this.human.role]] : null;
    return `<div class="cd-head" style="--cc:${c.color};--cc2:${c.color2}"><div class="cc-em big">${c.emblem}</div><div><h2>${c.name}</h2>
      <small>${c.tag} · рейтинг клуба <b>${clubOvr(L, c).toFixed(1)}</b> · средняя форма ${clubForm(L, c).toFixed(2)}</small></div></div>
      <div class="cd-grid"><div><div class="cr-label">Средние характеристики состава <small>(черта — среднее по лиге)</small></div>${statBars(avg, { cmp: leagueAvg })}
      <p class="cd-note">${strong.length ? '💪 Сильные стороны: ' + strong.join(', ') + '. ' : ''}${weak.length ? '⚠ Слабые: ' + weak.join(', ') + '.' : ''}</p></div>
      <div><div class="cr-label">Состав</div>${rosterOf(L, c).map(p => `<div class="cd-pl ${replaced === p ? 'out' : ''}">${playerRow(L, p, { last: true })}<div class="cd-ms">${masteryList(p, 4)}</div>${replaced === p ? '<div class="cd-out">Покинет игру, если вы выберете этот клуб</div>' : ''}</div>`).join('')}</div></div>
      ${choosing ? `<div class="title-actions"><button class="btn" id="cl-back">← Назад к игроку</button><button class="btn primary big" id="cl-sign">✍ Подписать контракт с «${c.name}»</button></div>` : ''}`;
  },
  showClub(id, choosing) {
    const c = clubById(this.L, id);
    document.querySelectorAll('.club-card').forEach(e => e.classList.toggle('on', e.dataset.id === id));
    $('#cl-detail').innerHTML = this.clubDetailHTML(c, choosing);
    this.bindRows($('#cl-detail'));
    if (choosing) {
      $('#cl-back').onclick = () => App.show('screen-create');
      $('#cl-sign').onclick = () => {
        const out = joinClub(this.L, this.human, id);
        this.L.newsOut = out ? `${out.nick} покинул «${c.name}» — его место заняли вы.` : '';
        saveLeague(this.L);
        this.openHub();
      };
    }
  },
  bindRows(root) { root.querySelectorAll('.prow[data-pid]').forEach(e => e.onclick = ev => { ev.stopPropagation(); this.showProfile(e.dataset.pid); }); },

  /* =================== Профиль =================== */
  showProfile(pid) {
    const L = this.L, p = L.players[pid] || (this.human && this.human.id === pid ? this.human : null);
    if (!p) return;
    const club = p.club && clubById(L, p.club);
    const s = p.season;
    $('#profile-body').innerHTML = `<div class="prof">
      <div class="prof-l">${faceHTML(p, club ? clubColors(club) : null, 'big')}
        <h2>${U.esc(p.nick)}</h2><div class="muted">${U.esc(p.first)} ${U.esc(p.last)}${p.age ? ' · ' + p.age + ' лет' : ''}</div>
        <div>${ROLES[p.role].icon} ${ROLES[p.role].name}${club ? ` · ${club.emblem} ${club.name}` : ''}</div>
        <div class="prof-ovr">Рейтинг <b>${playerOvr(p).toFixed(1)}</b> · Форма <b style="color:${formColor(p)}">${formArrow(p)} ${playerFormAvg(p).toFixed(2)}</b> (${playerFormBonus(p) >= 0 ? '+' : ''}${playerFormBonus(p).toFixed(1)} ко всем)</div>
        <div class="cr-label">Последние оценки</div><div>${ratingChips(p, 8)}</div>
        <div class="cr-label">Сезон</div><div class="muted">Игр ${s.games} · побед ${s.wins} · У/С/П ${s.k}/${s.d}/${s.a} · средняя оценка ${s.games ? (s.ratingSum / s.games).toFixed(2) : '—'} · MVP ${s.mvp}</div>
      </div>
      <div class="prof-r"><div class="cr-label">Характеристики</div>${statBars(p.stats)}
        <div class="cr-label">Мастерство на героях</div><div class="mlist">${masteryList(p, 10)}</div>
        <p class="cd-note">Мастерство растёт только за матчи с оценкой 7.5+ (+1) и 8.5+ (+2). На герое с мастерством M все характеристики получают +M/4; с формой и мастерством характеристика может подняться выше 20 — до 30.</p>
      </div></div>`;
    $('#profile').classList.add('open');
  },

  /* =================== Центр лиги =================== */
  async openHub() {
    App.setSpeed(1);
    this.renderHub();
    await App.show('screen-hub');
  },
  myClub() { return clubById(this.L, this.L.humanClub); },
  renderHub() {
    const L = this.L, me = L.players[L.humanId], club = this.myClub();
    const table = leagueTable(L);
    const pos = table.findIndex(r => r.id === club.id) + 1;
    const over = L.tour >= L.schedule.length;
    $('#hub-title').innerHTML = `<span class="hub-em" style="--cc:${club.color}">${club.emblem}</span><div><b>${club.name}</b><small>${L.name} · Сезон ${L.season} · ${over ? 'сезон завершён' : `тур ${L.tour + 1} из ${L.schedule.length}`} · место ${pos}</small></div>`;
    // следующий матч
    const f = nextFixture(L, club.id);
    if (over) {
      const champ = clubById(L, table[0].id);
      $('#hub-next').innerHTML = `<div class="panel-title">Сезон завершён</div><div class="champ"><div class="cc-em big">${champ.emblem}</div><h2>Чемпион: ${champ.name}</h2><p>${champ.id === club.id ? '🏆 Ваш клуб — чемпион!' : `Ваш клуб занял ${pos}-е место.`}</p>
        <button class="btn primary" id="hub-newseason">Новый сезон с тем же игроком</button></div>`;
      $('#hub-newseason').onclick = () => this.newSeason();
    } else {
      const home = clubById(L, f.home), away = clubById(L, f.away);
      const side = c => `<div class="nm-club ${c.id === club.id ? 'mine' : ''}"><div class="cc-em big" style="--cc:${c.color}">${c.emblem}</div><b>${c.name}</b><small>рейтинг ${clubOvr(L, c).toFixed(1)} · форма ${clubForm(L, c).toFixed(1)} · место ${table.findIndex(r => r.id === c.id) + 1}</small></div>`;
      $('#hub-next').innerHTML = `<div class="panel-title">Следующая серия · тур ${L.tour + 1}</div>
        <div class="nm">${side(home)}<div class="nm-vs">VS<small>серия из 2 игр<br>победа 3 · ничья 1</small></div>${side(away)}</div>
        ${L.newsOut ? `<p class="cd-note">📰 ${U.esc(L.newsOut)}</p>` : ''}
        <div class="title-actions"><button class="btn primary big" id="hub-watch">▶ Смотреть серию</button><button class="btn" id="hub-sim">⏩ Быстрый просчёт</button></div>
        <p class="cd-note">Пока ваш игрок играет на автопилоте с вашими характеристиками; ручное управление героем добавим позже. Остальные серии тура просчитываются автоматически.</p>`;
      $('#hub-watch').onclick = () => this.playTour(true);
      $('#hub-sim').onclick = () => this.playTour(false);
    }
    // мой игрок
    $('#hub-me').innerHTML = `<div class="panel-title">Ваш игрок</div>${playerRow(L, me, { last: true })}${statBars(me.stats)}<div class="cr-label">Мастерство</div><div class="mlist">${masteryList(me, 6)}</div>`;
    // состав
    $('#hub-roster').innerHTML = `<div class="panel-title">Состав клуба</div>${rosterOf(L, club).map(p => playerRow(L, p, { last: true })).join('')}`;
    // результаты прошлого тура
    const lastTour = L.tour - 1;
    const cal = L.schedule.slice(L.tour, L.tour + 5).map((t, i) => { const x = t.find(f => f.home === club.id || f.away === club.id); const o = clubById(L, x.home === club.id ? x.away : x.home); return `<div class="res"><span>Тур ${L.tour + i + 1}</span><b>${x.home === club.id ? 'дома' : 'в гостях'}</b><span>${o.emblem} ${o.name}</span></div>`; }).join('');
    $('#hub-results').innerHTML = `<div class="panel-title">${lastTour >= 0 ? `Результаты тура ${lastTour + 1}` : 'Календарь: ближайшие соперники'}</div>` + (lastTour < 0 ? cal : '') + (lastTour >= 0 ? L.schedule[lastTour].map(x => {
      const h = clubById(L, x.home), a = clubById(L, x.away);
      const mine = x.home === club.id || x.away === club.id;
      return `<div class="res ${mine ? 'mine' : ''}"><span>${h.emblem} ${h.tag}</span><b>${x.score[0]} : ${x.score[1]}</b><span>${a.tag} ${a.emblem}</span></div>`;
    }).join('') : '');
    // таблица
    $('#hub-table').innerHTML = `<div class="panel-title">Турнирная таблица</div><table class="ltable"><tr><th>#</th><th>Клуб</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Игры</th><th>О</th><th>Форма</th></tr>${table.map((r, i) => {
      const c = clubById(L, r.id);
      return `<tr class="${c.id === club.id ? 'mine' : ''} ${i < 3 ? 'top3' : ''}" data-club="${c.id}"><td>${i + 1}</td><td>${c.emblem} ${c.name}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gw}:${r.gl}</td><td><b>${r.pts}</b></td><td>${r.last.slice(-5).map(x => `<i class="fm ${x}">${{ W: 'В', D: 'Н', L: 'П' }[x]}</i>`).join('')}</td></tr>`;
    }).join('')}</table>`;
    $('#hub-table').querySelectorAll('tr[data-club]').forEach(tr => tr.onclick = () => { $('#profile-body').innerHTML = this.clubDetailHTML(clubById(L, tr.dataset.club), false); this.bindRows($('#profile-body')); $('#profile').classList.add('open'); });
    // лучшие игроки
    const tops = Object.values(L.players).filter(p => p.season.games >= 2).sort((a, b) => b.season.ratingSum / b.season.games - a.season.ratingSum / a.season.games).slice(0, 8);
    $('#hub-top').innerHTML = `<div class="panel-title">Лучшие игроки сезона</div>${tops.length ? tops.map(p => `<div class="top-row">${playerRow(L, p, { club: true })}<b class="avg" style="color:${ratingColor(p.season.ratingSum / p.season.games)}">${(p.season.ratingSum / p.season.games).toFixed(2)}</b></div>`).join('') : '<small class="muted">После двух сыгранных игр</small>'}`;
    this.bindRows($('#screen-hub'));
  },

  /* Тур: своя серия (смотреть или просчитать) + все остальные серии */
  async playTour(watch) {
    const L = this.L, club = this.myClub();
    const f = nextFixture(L, club.id);
    if (!f) return;
    if (watch) {
      const home = clubById(L, f.home), away = clubById(L, f.away);
      for (let gi = f.games.length; gi < 2; gi++) {
        const homeSide = gi === 0 ? 'blue' : 'red', awaySide = homeSide === 'blue' ? 'red' : 'blue';
        const players = { [homeSide]: rosterOf(L, home), [awaySide]: rosterOf(L, away) };
        const meta = {
          names: { [homeSide]: home.name, [awaySide]: away.name }, colors: { [homeSide]: clubColors(home), [awaySide]: clubColors(away) },
          series: { idx: gi, homeName: home.name, awayName: away.name, homeSide, prev: f.games.map(g => g.winner) },
          onResult: g => applyGame(L, f, g, homeSide),
          continueLabel: gi === 0 ? 'Игра 2 серии →' : 'Итоги тура →',
        };
        await App.playMatch(players, meta);
      }
      finishFixture(L, f);
    }
    await this.simRest(watch ? f : null);
    L.tour++;
    L.newsOut = '';
    saveLeague(L);
    await this.openHub();
  },
  async simRest(skip) {
    const L = this.L;
    const list = L.schedule[L.tour].filter(f => f !== skip && !f.done);
    $('#hub-progress').hidden = false;
    if (!$('#screen-hub').classList.contains('active')) await App.show('screen-hub');
    const wasHeadless = Clock.headless; Clock.headless = true;
    try {
      for (let i = 0; i < list.length; i++) {
        $('#hp-text').textContent = `Просчёт тура ${L.tour + 1}: серия ${i + 1} из ${list.length}`;
        $('#hp-fill').style.width = (i / list.length * 100) + '%';
        await new Promise(r => setTimeout(r, 30));
        await simFixture(L, list[i], HEADLESS_UI);
      }
    } finally { Clock.headless = wasHeadless; $('#hub-progress').hidden = true; }
  },
  newSeason() {
    const L = this.L;
    L.season++; L.tour = 0; L.results = [];
    L.schedule = doubleRoundRobin(L.clubs.map(c => c.id), U.seeded(L.seed + L.season));
    for (const p of Object.values(L.players)) p.season = { games: 0, wins: 0, k: 0, d: 0, a: 0, ratingSum: 0, mvp: 0 };
    saveLeague(L);
    this.openHub();
  },
  continueSaved() {
    const L = loadLeague();
    if (!L) return;
    this.L = L; this.human = L.players[L.humanId];
    this.openHub();
  },
};
