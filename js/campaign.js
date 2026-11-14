'use strict';
/* Интерфейс кампании: создание игрока, выбор клуба, центр лиги, профили, просчёт туров */

const HEADLESS_UI = new Proxy({}, { get: (t, k) => (k === 'askSignal' ? undefined : () => {}) });
const STAT_BUDGET = 80, STAT_MIN0 = 6, STAT_MAX0 = 16;
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
  return ms.map(([id, v]) => { const d = HEROES.find(h => h.id === id); return `<span class="mchip ${v >= 15 ? 'star' : ''}" title="${d.name}: мастерство ${v} (+${(v / 4).toFixed(1)} ко всем характеристикам на этом герое)"><span class="mface">${heroFace(d)}</span>${d.name} <b>${v}</b></span>`; }).join('');
}
function playerRow(L, p, opts = {}) {
  const club = p.club && clubById(L, p.club);
  return `<div class="prow ${p.human ? 'me' : ''}" data-pid="${p.id}">
    ${faceHTML(p, club ? clubColors(club) : null, 'pr-face')}
    <div class="pr-name"><b>${U.esc(p.nick)}${p.captain ? ' <span class="capt" title="Капитан: драфтит за команду (баны и выбор героев)">C</span>' : ''}${p.human ? ' <span class="you">ВЫ</span>' : ''}${p.talent === 'star' ? ' <span title="Восходящая звезда">🌟</span>' : ''}${perkHTML(p)}${(() => { const at = typeof mgmtAttitude !== 'undefined' && L.clubs[0].mgmt ? mgmtAttitude(L, p) : null; return at && at !== ATTITUDES.ok ? ` <span class="att-i ${at.cls}" title="Руководство: ${at.name}">${at.icon}</span>` : ''; })()}</b><small>${ROLES[p.role].icon} ${ROLES[p.role].name}${opts.club && club ? ' · ' + club.emblem + ' ' + club.tag : ''}</small></div>
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
    const sw = (key, pal) => `<div class="fc-row"><span>${{ skin: 'Кожа', hairColor: 'Волосы', eyeColor: 'Глаза', lip: 'Губы' }[key]}</span><div class="swatches" style="grid-template-columns:repeat(${pal.length > 8 ? Math.ceil(pal.length / 2) : pal.length}, 18px)">${pal.map((c, i) => `<i data-k="${key}" data-v="${i}" class="${cs.face[key] === i ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div></div>`;
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
    $('#cr-hero-list').innerHTML = list.map(d => `<div class="cr-hero ${cs.heroes.has(d.id) ? 'on' : ''}" data-id="${d.id}" style="--hc:${d.color}"><span class="ch-e">${heroFace(d)}</span><span><b>${d.name}</b><small>${ROLES[cs.role].short} ${fitStars(d.fit[cs.role])} · ${d.tags.map(t => TAG_NAMES[t]).join(', ')}</small></span>${cs.heroes.has(d.id) ? '<em>✦4</em>' : ''}</div>`).join('');
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
    const p = makePlayer({ nick: cs.nick.trim() || 'Игрок', first: cs.first.trim() || 'Игрок', last: cs.last.trim(), role: cs.role, stats: Object.assign({}, cs.stats), face: cs.face, human: true, age: 19, iq: { board: 10, tactic: 10, team: 10 }, perks: rollPerks(Math.random) });
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
      <div>${c.mgmt ? this.clubFinHTML(c) : ''}<div class="cr-label">Состав</div>${rosterOf(L, c).filter(Boolean).map(p => `<div class="cd-pl ${replaced === p ? 'out' : ''}">${playerRow(L, p, { last: true })}<div class="cd-ms">${masteryList(p, 4)}</div>${replaced === p ? '<div class="cd-out">Покинет игру, если вы выберете этот клуб</div>' : ''}</div>`).join('')}</div></div>
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
  bindRows(root) {
    root.querySelectorAll('.prow[data-pid]').forEach(e => e.onclick = ev => { ev.stopPropagation(); this.showProfile(e.dataset.pid); });
    root.querySelectorAll('[data-club-link]').forEach(e => e.onclick = ev => { ev.stopPropagation(); this.showClubModal(e.dataset.clubLink); });
  },

  /* =================== Профиль =================== */
  /* ---------- Окна с историей: крестик возвращает к предыдущему окну ---------- */
  modal: [],
  isModalOpen() { return $('#profile').classList.contains('open'); },
  openView(view) {
    if (!this.isModalOpen()) this.modal = [];
    const top = this.modal[this.modal.length - 1];
    if (!top || top.type !== view.type || top.id !== view.id) this.modal.push(view);
    this.renderView();
  },
  renderView() {
    const v = this.modal[this.modal.length - 1];
    if (!v) { this.closeAll(); return; }
    const body = $('#profile-body');
    if (v.type === 'club') body.innerHTML = this.clubDetailHTML(clubById(this.L, v.id), false);
    else if (v.type === 'patch') body.innerHTML = this.patchHTML(true);
    else if (v.type === 'agents') body.innerHTML = this.agentsHTML();
    else if (v.type === 'news') body.innerHTML = this.newsHTML(v.id);
    else if (v.type === 'facilities') body.innerHTML = this.facHTML();
    else if (v.type === 'contract') { body.innerHTML = this.contractHTML(); this.bindContract(body); }
    else body.innerHTML = this.playerHTML(v.id);
    this.bindRows(body);
    const prev = this.modal[this.modal.length - 2];
    const btn = $('#profile-close');
    if (prev) {
      const name = ['agents', 'news', 'facilities', 'contract'].includes(prev.type) ? 'назад' : prev.type === 'patch' ? `Патч ${this.L.patch.name}` : prev.type === 'club' ? clubById(this.L, prev.id).name : (this.L.players[prev.id] || {}).nick;
      btn.textContent = '← Назад'; btn.title = `Вернуться: ${name}`; btn.classList.add('back');
    } else { btn.textContent = '✕'; btn.title = 'Закрыть'; btn.classList.remove('back'); }
    $('#profile').classList.add('open');
    body.parentElement.scrollTop = 0;
    body.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  },
  closeView() { this.modal.pop(); if (this.modal.length) this.renderView(); else this.closeAll(); },
  closeAll() { this.modal = []; $('#profile').classList.remove('open'); },
  showClubModal(id) { this.openView({ type: 'club', id }); },

  findPlayer(pid) { const L = this.L; return L.players[pid] || (L.free || []).find(p => p.id === pid) || (this.human && this.human.id === pid ? this.human : null); },
  showProfile(pid) { if (this.findPlayer(pid)) this.openView({ type: 'player', id: pid }); },
  playerHTML(pid) {
    const L = this.L, p = this.findPlayer(pid);
    if (!p) return '';
    const club = p.club && clubById(L, p.club);
    const s = p.season;
    return `<div class="prof">
      <div class="prof-l">${faceHTML(p, club ? clubColors(club) : null, 'big')}
        <h2>${U.esc(p.nick)}</h2><div class="muted">${U.esc(p.first)} ${U.esc(p.last)}${p.age ? ' · ' + p.age + ' лет' : ''}</div>
        <div>${ROLES[p.role].icon} ${ROLES[p.role].name}${club ? ` · ${club.emblem} ${club.name}` : ''}</div>
        ${(p.perks || []).length ? `<div class="perks">${perkHTML(p, true)}</div>` : '<div class="perks none">Особенностей менталитета нет</div>'}
        ${p.lastDev && p.lastDev.delta ? `<div class="dev ${p.lastDev.delta > 0 ? 'pos' : 'neg'}">${p.lastDev.delta > 0 ? '📈' : '📉'} За межсезонье ${p.lastDev.season}→${p.lastDev.season + 1}: ${p.lastDev.delta > 0 ? '+' : ''}${p.lastDev.delta} к сумме характеристик</div>` : ''}
        <div class="prof-ovr">Рейтинг <b>${playerOvr(p).toFixed(1)}</b> · Форма <b style="color:${formColor(p)}">${formArrow(p)} ${playerFormAvg(p).toFixed(2)}</b> (${playerFormBonus(p) >= 0 ? '+' : ''}${playerFormBonus(p).toFixed(1)} ко всем)</div>
        ${(() => { const at = mgmtAttitude(L, p); return at ? `<div class="att ${at.cls}">${at.icon} Руководство клуба: <b>${at.name}</b></div>` : ''; })()}
        <div class="cr-label">Контракт и популярность</div>
        <div class="fin-box">${p.contract ? `<div>📝 <b>${money(p.contract.salary)}</b> за сезон · до конца сезона ${p.contract.until}</div>` : `<div>🆓 <b>Свободный агент</b> · просит около ${money(playerDemand(p))} за сезон</div>`}
          <div class="pop-row">⭐ Популярность <span class="bar"><i style="width:${Math.round(p.popularity || 0)}%"></i></span> <b>${Math.round(p.popularity || 0)}</b></div>
          ${(p.ads || []).length ? `<div class="muted">📺 Реклама: ${p.ads.map(a => `${a.brand} (${money(a.perSeason)}/сезон)`).join(', ')}</div>` : '<div class="muted">📺 Рекламных сделок нет</div>'}</div>
        <div class="cr-label">Последние оценки</div><div>${ratingChips(p, 8)}</div>
        <div class="cr-label">Сезон</div><div class="muted">Игр ${s.games} · побед ${s.wins} · У/С/П ${s.k}/${s.d}/${s.a} · средняя оценка ${s.games ? (s.ratingSum / s.games).toFixed(2) : '—'} · MVP ${s.mvp}</div>
      </div>
      <div class="prof-r"><div class="cr-label">Характеристики</div>${statBars(p.stats)}
        <div class="cr-label">Мастерство на героях</div><div class="mlist">${masteryList(p, 10)}</div>
        <p class="cd-note">Мастерство растёт только за матчи с оценкой 8.0+ (+1) и 9.5+ (+2). На герое с мастерством M все характеристики получают +M/4, форма даёт от −5 до +5: в матче характеристика может подняться выше 20 — до 30.</p>
        ${club ? `<button class="btn small" data-club-link="${club.id}">${club.emblem} Открыть клуб «${club.name}»</button>` : ''}
      </div></div>`;
  },

  /* =================== Центр лиги =================== */
  async openHub() {
    App.setSpeed(1);
    upgradeLeague(this.L);
    applyLeagueMeta(this.L);
    this.renderHub();
    await App.show('screen-hub');
  },
  myClub() { return clubById(this.L, this.L.humanClub); },
  renderHub() {
    const L = this.L, me = L.players[L.humanId], club = this.myClub();
    const table = leagueTable(L);
    const pos = table.findIndex(r => r.id === club.id) + 1;
    const over = L.tour >= L.schedule.length;
    $('#hub-title').innerHTML = L.humanFree ? `<span class="hub-em">🆓</span><div><b>Свободный агент</b><small>${L.name} · Сезон ${L.season} · тур ${L.tour + 1} из ${L.schedule.length} · бывший клуб: ${club.name}</small></div>` : `<span class="hub-em" style="--cc:${club.color}">${club.emblem}</span><div><b>${club.name}</b><small>${L.name} · Сезон ${L.season} · ${over ? 'сезон завершён' : `тур ${L.tour + 1} из ${L.schedule.length}`} · место ${pos}</small></div>`;
    // следующий матч
    const f = L.humanFree ? null : nextFixture(L, club.id);
    if (L.humanFree && !over) {
      $('#hub-next').innerHTML = this.freeAgentHTML();
      this.bindFreeAgent($('#hub-next'));
    } else if (over) {
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
        <div class="cr-label">Другие серии тура — отметьте, какие посмотреть</div>
        <div class="tour-list">${L.schedule[L.tour].map((x, i) => { if (x === f) return ''; const h = clubById(L, x.home), a = clubById(L, x.away);
          return `<label class="tl-row"><input type="checkbox" data-fx="${i}" ${this.watchSet && this.watchSet.has(i) ? 'checked' : ''}><span>${h.emblem} ${h.name}</span><b>vs</b><span>${a.name} ${a.emblem}</span></label>`; }).join('')}</div>
        <p class="cd-note">Отмеченные серии вы посмотрите целиком (драфт и игру) — до или после своей. Остальные просчитываются автоматически.</p>`;
      this.watchSet = this.watchSet || new Set();
      $('#hub-next').querySelectorAll('input[data-fx]').forEach(cb => cb.onchange = () => { const i = +cb.dataset.fx; if (cb.checked) this.watchSet.add(i); else this.watchSet.delete(i); });
      $('#hub-watch').onclick = () => this.playTour(true);
      $('#hub-sim').onclick = () => this.playTour(false);
    }
    // финансы и руководство
    $('#hub-fin').innerHTML = this.clubFinHTML(club, true);
    $('#hub-fin').querySelectorAll('[data-view]').forEach(b => b.onclick = () => this.openView({ type: b.dataset.view, id: b.dataset.id || 'x' }));
    // патч и мета
    $('#hub-meta').innerHTML = this.patchHTML(false);
    $('#hub-meta').onclick = () => this.openView({ type: 'patch', id: this.L.patch.name });
    // мой игрок
    $('#hub-me').innerHTML = `<div class="panel-title">Ваш игрок</div>${playerRow(L, me, { last: true })}${(me.perks || []).length ? `<div class="perks">${perkHTML(me, true)}</div>` : ''}${statBars(me.stats)}<div class="cr-label">Мастерство</div><div class="mlist">${masteryList(me, 6)}</div>`;
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
    $('#hub-table').innerHTML = `<div class="panel-title">Турнирная таблица</div><table class="ltable"><tr><th>#</th><th></th><th>Клуб</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Игры</th><th>О</th><th>Форма</th></tr>${table.map((r, i) => {
      const c = clubById(L, r.id);
      return `<tr class="${c.id === club.id ? 'mine' : ''} ${i < 3 ? 'top3' : ''}" data-club="${c.id}"><td>${i + 1}</td><td class="mv"></td><td>${c.emblem} ${c.name}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gw}:${r.gl}</td><td><b class="pts" data-pts="${r.pts}">${r.pts}</b></td><td>${r.last.slice(-5).map(x => `<i class="fm ${x}">${{ W: 'В', D: 'Н', L: 'П' }[x]}</i>`).join('')}</td></tr>`;
    }).join('')}</table>`;
    if (this.prevTable) { const prev = this.prevTable; this.prevTable = null; setTimeout(() => this.animateTable(prev), 650); }
    $('#hub-table').querySelectorAll('tr[data-club]').forEach(tr => tr.onclick = () => this.showClubModal(tr.dataset.club));
    // лучшие игроки
    const tops = Object.values(L.players).filter(p => p.season.games >= 2).sort((a, b) => b.season.ratingSum / b.season.games - a.season.ratingSum / a.season.games).slice(0, 8);
    $('#hub-top').innerHTML = `<div class="panel-title">Лучшие игроки сезона</div>${tops.length ? tops.map(p => `<div class="top-row">${playerRow(L, p, { club: true })}<b class="avg" style="color:${ratingColor(p.season.ratingSum / p.season.games)}">${(p.season.ratingSum / p.season.games).toFixed(2)}</b></div>`).join('') : '<small class="muted">После двух сыгранных игр</small>'}`;
    this.bindRows($('#screen-hub'));
  },

  /* Анимация пересортировки таблицы после тура (FLIP): строки стартуют с прежних мест и едут на новые,
     очки досчитываются, у сменивших место — стрелка ▲/▼ с числом позиций */
  animateTable(prev) {
    const rows = [...document.querySelectorAll('#hub-table tr[data-club]')];
    if (!rows.length) return;
    const oldIdx = Object.fromEntries(prev.map((r, i) => [r.id, i]));
    const oldPts = Object.fromEntries(prev.map(r => [r.id, r.pts]));
    const hgt = rows[0].getBoundingClientRect().height;
    rows.forEach((tr, i) => {
      const id = tr.dataset.club, from = oldIdx[id];
      if (from == null) return;
      tr.style.transition = 'none';
      tr.style.transform = `translateY(${(from - i) * hgt}px)`;
      const b = tr.querySelector('.pts');
      const p0 = oldPts[id], p1 = +b.dataset.pts;
      b.textContent = p0;
      tr._anim = { from, to: i, p0, p1, b };
    });
    void document.body.offsetWidth;
    sfx('whoosh');
    rows.forEach((tr, i) => {
      const a = tr._anim; if (!a) return;
      const delay = Math.abs(a.from - a.to) ? 60 + i * 25 : 0;
      tr.style.transition = `transform 1.3s cubic-bezier(.2,.85,.25,1) ${delay}ms`;
      tr.style.transform = '';
      if (a.from !== a.to) tr.classList.add(a.to < a.from ? 'moved-up' : 'moved-down');
      // досчёт очков
      if (a.p1 !== a.p0) {
        tr.classList.add('pts-up');
        const t0 = performance.now() + delay, dur = 900;
        const step = now => { const k = U.clamp((now - t0) / dur, 0, 1); a.b.textContent = Math.round(a.p0 + (a.p1 - a.p0) * k); if (k < 1) requestAnimationFrame(step); else a.b.classList.add('bump'); };
        requestAnimationFrame(step);
      }
      // стрелка смены места
      const mv = tr.querySelector('.mv');
      const d = a.from - a.to;
      if (d) setTimeout(() => { mv.innerHTML = `<span class="mvb ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>`; }, 900 + delay);
      setTimeout(() => tr.classList.remove('moved-up', 'moved-down', 'pts-up'), 2600 + delay);
    });
  },

  /* Тур: своя серия (смотреть или просчитать) + все остальные серии */
  /* Просмотр одной серии целиком (своей или чужой) */
  async watchFixture(f, last) {
    const L = this.L;
    const home = clubById(L, f.home), away = clubById(L, f.away);
    for (let gi = f.games.length; gi < 2; gi++) {
      const homeSide = gi === 0 ? 'blue' : 'red', awaySide = homeSide === 'blue' ? 'red' : 'blue';
      const players = { [homeSide]: rosterOf(L, home), [awaySide]: rosterOf(L, away) };
      const meta = {
        names: { [homeSide]: home.name, [awaySide]: away.name }, colors: { [homeSide]: clubColors(home), [awaySide]: clubColors(away) },
        series: { idx: gi, homeName: home.name, awayName: away.name, homeSide, prev: f.games.map(g => g.winner) },
        onResult: g => applyGame(L, f, g, homeSide),
        continueLabel: gi === 0 ? 'Игра 2 серии →' : last ? 'Итоги тура →' : 'Следующая серия →',
        control: [home, away].some(c => rosterOf(L, c).some(p => p && p.human)),   // ручное управление своим игроком
      };
      await App.playMatch(players, meta);
    }
    finishFixture(L, f);
  },
  async playTour(watch) {
    const L = this.L, club = this.myClub();
    this.prevTable = leagueTable(L).map(r => ({ id: r.id, pts: r.pts }));
    const f = L.humanFree ? null : nextFixture(L, club.id);
    if (!f && !L.humanFree) return;
    // какие серии смотреть: своя (если выбран просмотр) и отмеченные чужие
    const list = L.schedule[L.tour].filter((x, i) => (x === f && watch) || (x !== f && this.watchSet && this.watchSet.has(i)));
    for (let i = 0; i < list.length; i++) await this.watchFixture(list[i], i === list.length - 1);
    this.watchSet = new Set();
    await this.simRest(null);
    const news = financeTour(L, L.schedule[L.tour]);
    if ([10, 20].includes(L.tour + 1)) mgmtReview(L, news);
    if (L.tour + 1 === 15) for (const c of L.clubs) mgmtInvest(L, c, news);
    if (L.humanFree) humanOfferTick(L, news);
    this.addNews(news, `Тур ${L.tour + 1}`);
    L.tour++;
    L.newsOut = '';
    const patched = patchDue(L) ? applyPatch(L) : null;
    saveLeague(L);
    await this.openHub();
    if (patched) setTimeout(() => this.openView({ type: 'patch', id: patched.name }), 900);
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
  /* Патч: список правок и мета (тир-лист). full — для окна, иначе компактная панель хаба */
  patchHTML(full) {
    const L = this.L, P = L.patch;
    const next = Math.ceil((L.tour + 1) / PATCH_EVERY) * PATCH_EVERY;
    const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const hd = id => HEROES.find(h => h.id === id);
    const what = n => !n.key || n.key === 'stat' ? 'сила' : `${{ q: 'Q', r: 'R', p: 'пассивка' }[n.key]} «${n.skill}»`;
    const note = n => { const d = hd(n.id); return `<div class="pn-row ${n.delta > 0 ? 'buff' : 'nerf'} ${n.key && n.key !== 'stat' ? 'skill' : ''}"><span class="pn-face">${heroFace(d)}</span><b>${d.name}</b><span class="pn-d">${n.delta > 0 ? '▲' : '▼'} ${U.esc(what(n))} ${pct(n.delta)}</span>${full ? `<small>винрейт ${Math.round(n.wr * 100)}% в ${n.g} играх · ${n.key && n.key !== 'stat' ? 'меняется урон, лечение и щиты умения' : 'здоровье, атака и сила умений'} · итого ${pct(n.total)}</small>` : ''}</div>`; };
    const tiers = ['S', 'A', 'B', 'C', 'D'];
    const metaList = Object.entries(P.meta || {});
    const tierRows = metaList.length ? tiers.map(t => {
      const hs = metaList.filter(([, m]) => m.tier === t).sort((a, b) => b[1].score - a[1].score);
      if (!hs.length || (!full && !['S', 'A'].includes(t))) return '';
      return `<div class="tier"><span class="tl t${t}">${t}</span><div class="th">${hs.map(([id, m]) => { const d = hd(id); return `<span class="tface" title="${d.name}: ожидаемый винрейт ${Math.round((0.5 + m.score) * 100)}% · брали/банили в ${Math.round(m.pr * 100)}% игр${m.lastKey ? ' · правка: ' + (m.lastKey === 'stat' ? 'сила' : { q: 'Q', r: 'R', p: 'пассивка' }[m.lastKey]) + (m.lastDelta > 0 ? ' ▲' : ' ▼') : ''}">${heroFace(d)}${m.lastDelta ? `<i class="${m.lastDelta > 0 ? 'up' : 'dn'}">${m.lastDelta > 0 ? '▲' : '▼'}</i>` : ''}${full ? `<em>${d.name}</em>` : ''}</span>`; }).join('')}</div></div>`;
    }).join('') : `<p class="cd-note">Мета ещё не сложилась: первый патч выйдет после ${PATCH_EVERY}-го тура, когда наберётся статистика.</p>`;
    // текущая статистика патча (живые винрейты)
    const live = Object.entries(P.stats || {}).filter(([, s]) => s.g >= 4).sort((a, b) => heroWr(b[1]) - heroWr(a[1]));
    const liveHTML = full && live.length ? `<div class="cr-label">Статистика текущего патча (${P.games} игр)</div><div class="pn-live">${live.map(([id, s]) => { const d = hd(id), wr = s.w / s.g; return `<div class="lv"><span class="pn-face">${heroFace(d)}</span><b>${d.name}</b><span class="bar"><i style="width:${wr * 100}%;background:${wr > 0.53 ? 'var(--green, #45e07a)' : wr < 0.47 ? '#ff5468' : '#8aa0c8'}"></i></span><span>${Math.round(wr * 100)}%</span><small>${s.g} игр · ${s.b} банов</small></div>`; }).join('')}</div>` : '';
    if (!full) return `<div class="panel-title">Патч ${P.name} · мета <span class="pt-more">подробнее →</span></div>
      ${P.notes.length ? `<div class="pn-list">${P.notes.slice(0, 2).map(note).join('')}${P.notes.length > 4 ? '' : ''}${P.notes.slice(-2).filter(n => !P.notes.slice(0, 2).includes(n)).map(note).join('')}</div>` : ''}
      ${tierRows}<p class="cd-note">${L.tour >= L.schedule.length ? 'Следующий патч — к новому сезону.' : `Следующий патч — после ${next}-го тура.`} Капитаны учитывают мету при пиках и банах — чем умнее капитан, тем точнее.</p>`;
    return `<div class="patch-full"><h2>Патч ${P.name}</h2>
      <p class="muted">${P.prev ? `Правки по итогам патча ${P.prev}: герои со слишком высоким винрейтом ослаблены, слабые — усилены. Обычно меняется сила героя (здоровье, атака, сила умений), примерно в трети случаев — отдельное умение: Q, ульта или пассивка.` : 'Стартовый патч сезона: правок нет.'}</p>
      ${P.notes.length ? `<div class="cr-label">Изменения</div><div class="pn-list">${P.notes.map(note).join('')}</div>` : P.prev ? '<p class="cd-note">Баланс в порядке — правок нет.</p>' : ''}
      <div class="cr-label">Мета (ожидаемая сила героев в этом патче)</div>${tierRows}${liveHTML}</div>`;
  },
  /* =================== Финансы, руководство, новости =================== */
  addNews(list, label) {
    const L = this.L;
    L.news = L.news || [];
    if (list.length) L.news.unshift({ label, items: list });
    if (L.news.length > 30) L.news.length = 30;
  },
  clubFinHTML(c, hub) {
    const L = this.L, m = c.mgmt, st = MGMT_STYLES[m.style];
    const last = (c.ledger || [])[c.ledger.length - 1];
    const fac = Object.keys(FACILITIES).map(k => `<span class="fac ${facLevel(c, k) ? 'on' : ''}" title="${FACILITIES[k].name}: ${FACILITIES[k].desc}">${FACILITIES[k].icon}<b>${facLevel(c, k)}</b></span>`).join('');
    const pay = payroll(L, c);
    return `${hub ? '<div class="panel-title">Клуб: финансы и руководство</div>' : '<div class="cr-label">Руководство и финансы</div>'}
      <div class="fin-box">
        <div class="fin-top"><span>💰 Бюджет</span><b class="${c.budget < 0 ? 'neg' : ''}">${money(c.budget)}</b>${last ? `<small class="${last.net >= 0 ? 'pos' : 'neg'}">${last.net >= 0 ? '+' : ''}${money(last.net)} за тур</small>` : ''}</div>
        <div class="muted">Спонсор «${c.sponsor.name}»: ${money(c.sponsor.perSeason)}/сезон · зарплаты ${money(pay)}/сезон</div>
        <div class="mgmt">👔 <b>${m.name}</b> — «${st.name}» <small>(${st.desc})</small><br><span class="muted">Цель руководства: ${m.target <= 1 ? 'чемпионство' : `топ-${m.target}`}${m.strikes ? ' · ⚠ совет директоров недоволен' : ''}</span></div>
        <div class="facs">${fac}</div>
        ${hub ? `<div class="title-actions"><button class="btn small" data-view="news" data-id="all">📰 Новости</button><button class="btn small" data-view="agents">🆓 Свободные агенты</button><button class="btn small" data-view="facilities">🏗 Отделы клуба</button></div>` : ''}
      </div>`;
  },
  agentsHTML() {
    const L = this.L;
    const list = (L.free || []).slice().sort((a, b) => playerOvr(b) - playerOvr(a));
    return `<div class="patch-full"><h2>Свободные агенты</h2><p class="muted">Игроки без клуба. Руководство клубов берёт их, когда освобождается место: по своим предпочтениям (сила, молодость, цена, популярность) и деньгам.</p>
      ${ROLE_ORDER.map(r => { const ps = list.filter(p => p.role === r); return ps.length ? `<div class="cr-label">${ROLES[r].icon} ${ROLES[r].name}</div>` + ps.map(p => `<div class="fa-row">${playerRow(L, p)}<small>${p.age} лет · просит ~${money(playerDemand(p))}</small></div>`).join('') : ''; }).join('')}</div>`;
  },
  newsHTML(which) {
    const L = this.L, mine = this.myClub().id;
    const blocks = which === 'last' ? (L.news || []).slice(0, 1) : (L.news || []);
    return `<div class="patch-full"><h2>Новости</h2>${blocks.length ? blocks.map(b => `<div class="cr-label">${U.esc(b.label)}</div>` + b.items.map(n => `<div class="news-row ${n.club === mine ? 'mine' : ''}">${U.esc(n.text)}</div>`).join('')).join('') : '<p class="muted">Пока новостей нет.</p>'}</div>`;
  },
  facHTML() {
    const c = this.myClub();
    return `<div class="patch-full"><h2>Отделы клуба «${c.name}»</h2><p class="muted">Руководство само решает, во что вкладывать бюджет: это зависит от его курса («${MGMT_STYLES[c.mgmt.style].name}») и запаса денег. Каждый уровень стоит денег при постройке и требует содержания каждый сезон.</p>
      ${Object.entries(FACILITIES).map(([k, f]) => `<div class="fac-row"><span class="fac-ic">${f.icon}</span><div><b>${f.name}</b> — уровень ${facLevel(c, k)} из 5<br><small class="muted">${f.desc}. Следующий уровень: ${facLevel(c, k) < 5 ? money(facCost(facLevel(c, k) + 1)) : '—'}, содержание ${money(facUpkeep(facLevel(c, k)))}/сезон</small></div></div>`).join('')}</div>`;
  },
  /* Переговоры игрока-человека о новом контракте */
  contractHTML() {
    const L = this.L, me = L.players[L.humanId], c = this.myClub();
    if (!this.nego) this.nego = Object.assign(humanOffer(L, c, me), { asked: false, msg: '' });
    const n = this.nego;
    return `<div class="patch-full"><h2>Новый контракт</h2>
      <p>Ваш контракт с «${c.name}» истекает. Руководство (${c.mgmt.name}, курс «${MGMT_STYLES[c.mgmt.style].name}») предлагает:</p>
      <div class="offer-big">${money(n.salary)} <small>за сезон · на ${n.years} сезона</small></div>
      <p class="muted">Ваша популярность ${Math.round(me.popularity)}, рыночная стоимость около ${money(playerValue(me))}.</p>
      ${n.msg ? `<p class="cd-note">${n.msg}</p>` : ''}
      <div class="title-actions"><button class="btn primary" id="ct-sign">✍ Подписать</button>${n.asked ? '' : '<button class="btn" id="ct-more">💬 Потребовать +15%</button>'}<button class="btn" id="ct-leave">🚪 Уйти в свободные агенты</button></div></div>`;
  },
  bindContract(root) {
    const L = this.L, me = L.players[L.humanId], n = this.nego;
    root.querySelector('#ct-sign').onclick = () => { me.contract = { salary: n.salary, until: L.season + n.years }; this.addNews([{ club: me.club, text: `🖊 ${me.nick} продлевает контракт с клубом: ${money(n.salary)} за сезон` }], 'Ваш контракт'); this.finishOffseason(); };
    const more = root.querySelector('#ct-more');
    if (more) more.onclick = () => {
      n.asked = true;
      const want = Math.round(n.salary * 1.15);
      if (want <= n.max || Math.random() < me.popularity / 200) { n.salary = want; n.msg = '✅ Руководство соглашается на ваши условия.'; }
      else n.msg = '❌ Руководство отказывается поднимать сумму: это их последнее слово.';
      this.renderView();
    };
    root.querySelector('#ct-leave').onclick = () => {
      const c = this.myClub();
      if (c.roster[me.role] === me.id) c.roster[me.role] = null;
      me.club = null; me.contract = null; me.captain = false; pickCaptain(L, c); L.humanFree = true; L.humanFreeTours = 0; L.humanOffers = [];
      this.finishOffseason();
    };
  },
  /* Игрок-человек — свободный агент: смотрит турнир и ждёт предложений */
  freeAgentHTML() {
    const L = this.L, offers = L.humanOffers || [];
    return `<div class="panel-title">Вы — свободный агент · тур ${L.tour + 1}</div>
      <p class="muted">Пока у вас нет клуба, вы смотрите турнир со стороны. Клубы присылают предложения — чем вы сильнее их игрока на вашей роли, тем охотнее. Предложение действует несколько туров.</p>
      ${offers.length ? offers.map((o, i) => { const c = clubById(L, o.club); return `<div class="offer-row" style="--cc:${c.color}"><span class="cc-em">${c.emblem}</span><div><b>${c.name}</b><br><small class="muted">рейтинг ${clubOvr(L, c).toFixed(1)} · «${MGMT_STYLES[c.mgmt.style].name}»</small></div><div class="offer-sum">${money(o.salary)}<small>/сезон · ${o.years} с.</small></div><button class="btn primary small" data-hoffer="${i}">Подписать</button></div>`; }).join('') : '<p class="cd-note">📭 Предложений пока нет.</p>'}
      <div class="title-actions"><button class="btn primary" id="hub-sim">⏩ Ждать: просчитать тур</button></div>
      <div class="cr-label">Серии тура — отметьте, какие посмотреть</div>
      <div class="tour-list">${L.schedule[L.tour].map((x, i) => { const h = clubById(L, x.home), a = clubById(L, x.away);
        return `<label class="tl-row"><input type="checkbox" data-fx="${i}" ${this.watchSet && this.watchSet.has(i) ? 'checked' : ''}><span>${h.emblem} ${h.name}</span><b>vs</b><span>${a.name} ${a.emblem}</span></label>`; }).join('')}</div>`;
  },
  bindFreeAgent(root) {
    const L = this.L, me = L.players[L.humanId];
    this.watchSet = this.watchSet || new Set();
    root.querySelectorAll('input[data-fx]').forEach(cb => cb.onchange = () => { const i = +cb.dataset.fx; if (cb.checked) this.watchSet.add(i); else this.watchSet.delete(i); });
    root.querySelector('#hub-sim').onclick = () => this.playTour(false);
    root.querySelectorAll('[data-hoffer]').forEach(b => b.onclick = () => {
      const o = L.humanOffers[+b.dataset.hoffer];
      const news = []; moveHuman(L, me, o.club, o.salary, o.years, news); syncFacilities(L);
      L.humanOffers = []; L.humanFreeTours = 0;
      this.addNews(news, 'Переход'); saveLeague(L); this.openHub();
    });
  },
  newSeason() {
    const L = this.L, me = L.players[L.humanId];
    // контракт игрока-человека истёк — переговоры с руководством
    if (me.contract && me.contract.until <= L.season && !L.humanFree) { this.nego = null; this.openView({ type: 'contract', id: 'x' }); return; }
    this.finishOffseason();
  },
  finishOffseason() {
    const L = this.L;
    this.closeAll();
    const news = offseason(L);
    if (L.humanFree) humanOfferTick(L, news, 2.5);
    this.addNews(news, `Межсезонье ${L.season}→${L.season + 1}`);
    this.offseasonPending = false;
    L.season++; L.tour = 0; L.results = [];
    L.schedule = doubleRoundRobin(L.clubs.map(c => c.id), U.seeded(L.seed + L.season));
    for (const p of [...Object.values(L.players), ...(L.free || [])]) p.season = { games: 0, wins: 0, k: 0, d: 0, a: 0, ratingSum: 0, mvp: 0 };
    saveLeague(L);
    this.openHub().then(() => setTimeout(() => this.openView({ type: 'news', id: 'last' }), 500));
  },
  continueSaved() {
    const L = loadLeague();
    if (!L) return;
    upgradeLeague(L);
    this.L = L; this.human = L.players[L.humanId];
    this.openHub();
  },
};
