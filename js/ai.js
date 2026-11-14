'use strict';
/* ИИ героя: выбор хода на поле и применение умений */

const AI = {
  weights(G, h) {
    const ev = h.ev;
    const hp = h.hp / h.maxHp;
    const enemies = G.enemiesIn(h).length > 0;
    let w;
    switch (ev.type) {
      case 'lane': w = [1.7, 0.6, 0.5, 0.7, 1.5, 0.9]; break;
      case 'jungle': w = [1.9, 0.4, 0.6, 0.6, 1.3, 1.5]; break;
      case 'siege': w = enemies ? [2.6, 1.1, 0.7, 0.8, 0.5, 0.3] : [2.6, 0.4, 0.4, 0.6, 0.8, 0.4]; break;
      case 'dragon': case 'baron': w = enemies ? [2.6, 1.1, 0.7, 0.8, 0.4, 0.3] : [2.8, 0.4, 0.5, 0.6, 0.5, 0.3]; break;
      default: w = [2.6, 1.1, 0.7, 0.8, 0.4, 0.3];
    }
    // здоровье
    const base = w.slice();
    w[T_HEAL] = hp > 0.95 ? 0.1 : w[T_HEAL] + (1 - hp) * 4;
    if (enemies) w[T_DEF] += (1 - hp) * 1.8;
    // мана для умений
    const q = h.def.q, r = h.def.r;
    const need = Math.min(q.cost, h.lvl >= 6 ? r.cost : 999);
    if (h.mana >= h.maxMana * 0.95) w[T_MANA] = 0.1;
    else if (h.mana < need) w[T_MANA] += 0.9;
    // роли
    if (h.role === 'sup') { w[T_VIS] += 0.7; w[T_HEAL] += 0.2; w[T_GOLD] *= 0.7; }
    if (h.role === 'jng' && !enemies) w[T_VIS] += 0.4;
    if (h.role === 'mid') w[T_MANA] += 0.25;
    if (h.role === 'adc') w[T_ATK] += 0.3;
    // если эпик-монстр жив — обзор ценнее
    if ((G.dragon.alive || G.baron.alive) && !enemies) w[T_VIS] += 0.4;
    // пассивки
    const id = h.def.id;
    if (id === 'windmage' || id === 'smuggler') w[T_VIS] += 0.4;
    if (id === 'berserk' && h.lvl >= 6) w[T_HEAL] += 0.5;
    if (id === 'frostgolem') w[T_DEF] += 0.5;
    // перк «Игрок лейта»: до 25-й минуты копит золото
    // Тактика: насколько ИИ учитывает ситуацию (здоровье, ману, событие, роль); слабый тактик играет «по шаблону»
    const k = U.clamp((iqOf(h, 'tactic') - 2) / 12, 0, 1.25);
    const flat = [1.6, 0.8, 0.8, 0.8, 1.1, 0.8];
    // слабый тактик ещё и «плывёт» в приоритетах от хода к ходу
    const drift = U.clamp((12 - iqOf(h, 'tactic')) / 10, 0, 1) * 0.9;
    for (let t = 0; t < 6; t++) w[t] = Math.max(0.05, (flat[t] + k * (w[t] - flat[t])) * (1 + U.rand(-drift, drift)));
    if (hasPerk(h, 'late') && G.minute < 25) w[T_GOLD] *= 2.2;   // «Игрок лейта» копит золото на поздние предметы
    return w;
  },

  scoreSim(sim, w, h) {
    let s = 0;
    for (let t = 0; t < 6; t++) s += sim.counts[t] * w[t];
    const cm = hasPerk(h, 'combo') ? 1.6 : 1;   // «Комбинатор» выше ценит особые камни и их срабатывание
    for (const c of sim.creates) s += (c.sp === 'prism' ? 7 : c.sp === 'bomb' ? 4.5 : 3.2) * cm;
    s += sim.stones * 0.9;
    s += sim.acts.length * 1.2 * cm;
    return s;
  },

  /* Чтение игры: сколько следующих камней видно в каждом столбце и видно ли сквозь туман */
  preview(h) { return U.clamp(Math.floor((effStat(h, 'read') - 6) / 4), 0, 4); },
  seesFog(h) { return effStat(h, 'read') >= 16; },

  chooseMove(G, h) {
    const blind = !this.seesFog(h);
    const preview = this.preview(h);
    const moves = h.board.listMoves(blind);
    if (!moves.length) {
      // всё видимое заблокировано туманом — пробуем вслепую
      const all = h.board.listMoves(false);
      return all.length ? U.pick(all) : null;
    }
    const w = this.weights(G, h);
    const iq = iqOf(h, 'board');
    if (U.chance(Math.max(0, 8 - iq) * 0.03)) return U.pick(moves);   // «зевок»: случайный ход
    const noise = 0.4 + (20 - iq) * 0.26;
    const depth = iq >= 14 ? 3 : iq >= 8 ? 1 : 0;
    let best = null, bs = -Infinity;
    for (const mv of moves) {
      let s;
      if (mv.prism) {
        const a = h.board.g[mv.r][mv.c], b = h.board.g[mv.r2][mv.c2];
        if (a.t === T_PRISM && b.t === T_PRISM) s = 40;
        else {
          const color = a.t === T_PRISM ? b.t : a.t;
          s = h.board.count(color) * w[color] + 4;
        }
      } else {
        s = this.scoreSim(depth ? h.board.simulateDeep(mv, blind, preview, depth) : h.board.simulate(mv, blind), w, h);
      }
      // предпочтение ходов внизу поля (больше шансов на каскад)
      s += Math.max(mv.r, mv.r2) * 0.12 * (iq >= 10 ? 1 : 0) + Math.random() * noise;
      if (s > bs) { bs = s; best = mv; }
    }
    return best;
  },

  chooseSkill(G, h, after) {
    // слабый тактик тратит умения как попало
    if (U.chance(U.clamp((14 - iqOf(h, 'tactic')) / 16, 0, 0.8))) { for (const k of ['r', 'q']) if (G.canCast(h, k) && U.chance(0.55)) return k; return null; }
    const enemies = G.enemiesIn(h);
    for (const key of ['r', 'q']) {
      if (!G.canCast(h, key)) continue;
      const s = h.def[key];
      if (s.ai && !s.ai(G, h)) continue;
      // экономия маны на ульту
      if (key === 'q' && h.lvl >= 6 && h.cd.r <= 1 && h.mana - s.cost < h.def.r.cost && G.enemiesIn(h).length) continue;
      // ульты — в основном в драках, ганге, у объектов
      if (key === 'r' && s.need === 'enemy' && !G.enemiesIn(h).length && !['dragon', 'baron'].includes(h.ev.type)) continue;
      if (key === 'r' && s.need === 'none' && !s.ai && !G.enemiesIn(h).length) continue;
      if (after && U.chance(0.4)) continue;
      // сильный тактик: урон по врагам — когда враги рядом; ульта — по раненой цели или в бою за эпика
      if (iqOf(h, 'tactic') >= 12 && s.need === 'enemy' && key === 'r') {
        const t = G.target(h);
        if (t && t.hp / t.maxHp > 0.7 && enemies.length <= 1 && !['dragon', 'baron'].includes(h.ev.type)) continue;
      }
      return key;
    }
    return null;
  },

  /* ---------- Отклик на сигнал (решение ИИ; человек решает сам, но скорость прибытия у всех от Командной игры) ---------- */
  respondSignal(G, h, sig) {
    if (!h.alive || (h.ev && (h.ev.type === 'recall' || h.ev.type === 'dead'))) return { accept: false, fast: false };
    const hp = h.hp / h.maxHp;
    // «Одиночка» не идёт на помощь, «Фармила» часто игнорирует призывы на объекты и о помощи
    if (sig.type === 'help' && hasPerk(h, 'loner')) return { accept: false, fast: false };
    if ((sig.type === 'help' || sig.type === 'obj') && hasPerk(h, 'farmer') && U.chance(0.5)) return { accept: false, fast: false };
    let p;
    if (sig.type === 'retreat') p = 0.45 + 0.04 * sd(h, 'team') + (hp < 0.4 ? 0.3 : 0) - 0.02 * sd(h, 'agr');
    else p = 0.4 + 0.035 * sd(h, 'team') + 0.015 * sd(sig.from, 'team') - (hp < 0.4 ? 0.25 : 0);
    // Командное мышление: умный игрок оценивает, полезен ли отклик сейчас
    const c = iqOf(h, 'team');
    if (U.chance(U.clamp((c - 2) / 16, 0, 1))) {
      const ev = G.events.find(e => e.id === sig.data.ev) || sig.from.ev;
      const own = ev && ev.sides ? ev.sides[h.team].filter(x => x.alive).length : 1;
      const foe = ev && ev.sides ? ev.sides[h.enemyTeam].filter(x => x.alive).length : 0;
      let useful;
      if (sig.type === 'retreat') useful = hp < 0.55 || own < foe;
      else if (sig.type === 'help') useful = hp > 0.45 && (h.role === 'jng' || h.role === 'mid' || h.lane === sig.data.lane);
      else if (sig.type === 'obj') useful = hp > 0.5 && G.allTeam(h).length >= G.allEnemies(h).length - 1;
      else useful = hp > 0.5;
      p = useful ? 0.55 + 0.035 * sd(h, 'team') + 0.25 : 0.12;
    }
    if (hasPerk(sig.from, 'caller')) p += 0.2;   // «Голос команды»
    if (sig.type === 'retreat' && hasPerk(h, 'reckless')) p -= 0.3;
    if (sig.type === 'retreat' && hasPerk(h, 'cautious')) p += 0.2;
    const accept = U.chance(U.clamp(p, 0.03, 0.97));
    return { accept, fast: accept && (AI.arrivesFast(h) || (hasPerk(sig.from, 'caller') && U.chance(0.35))) };
  },
  arrivesFast(h) { return U.chance(U.clamp(0.45 + 0.05 * sd(h, 'team'), 0.05, 0.95)); },

  /* ---------- Драфт ----------
     Драфтит капитан команды. Его скрытый интеллект (командное мышление + тактика) и «Чтение игры»
     определяют, сколько нюансов он учитывает: нужды состава, мету, контрпики, связки, угрозы от соперников.
     Каждое решение раскладывается на причины, которые показываются на экране драфта. */
  captainOf(list) {
    return list.find(p => p.captain) || U.maxBy(list, p => ((p.iq && p.iq.team) || 10) + ((p.iq && p.iq.tactic) || 10) + 0.3 * ((p.stats && p.stats.read) || 10));
  },
  draftIq(cap) {
    if (!cap) return 10;
    const iq = cap.iq || {};
    // аналитический отдел клуба помогает капитану с драфтом
    return U.clamp(((iq.team || 10) + (iq.tactic || 10)) / 2 + 0.2 * (((cap.stats && cap.stats.read) || 10) - 10) + 0.7 * ((cap.fac && cap.fac.analytics) || 0), 1, 24);
  },
  metaOf(id) { return (typeof HERO_META !== 'undefined' && HERO_META[id]) || null; },
  patchOf(id) { return patchMod(id, 'stat'); },
  /* Связки и контрпики выверены на симуляциях (tests/draft-fit.js и замеры составов):
     в этой игре решает постоянный урон, танк держит стрелка, против лечения и танков есть явные ответы. */
  SYNERGY: [
    ['tank', 'dps', 'танк прикроет стрелка'],
    ['control', 'dps', 'контроль даёт стрелку бить безнаказанно'],
    ['dps', 'dps', 'два источника постоянного урона'],
    ['vision', 'dps', 'обзор держит стрелка в безопасности'],
  ],
  COUNTER: [
    ['heal', 'burst', 'против лекарей нужен взрывной урон'],
    ['tank', 'dps', 'танков пробивает постоянный урон'],
    ['sustain', 'dps', 'живучих перебивает постоянный урон'],
  ],
  /* Оценка героя для игрока: число + причины. ctx: { D — грамотность капитана, enemyPicks, pickNo } */
  draftEval(pl, role, def, mine, enemyPlayers, rng = Math.random, ctx = {}) {
    const D = ctx.D != null ? ctx.D : 10, ck = U.clamp((D - 2) / 12, 0, 1.3), aw = U.clamp((D - 2) / 12, 0.1, 1.3);
    const parts = [];
    const add = (v, ic, t, cls) => { if (v) parts.push({ v, ic, t, cls }); return v; };
    const fit = def.fit[role];
    let s = add([-7, -1.5, 6.5, 9][fit], fit >= 3 ? '🎯' : fit === 2 ? '✓' : '⚠', fit >= 3 ? 'родная роль' : fit === 2 ? 'хорошо подходит на роль' : 'не по профилю', fit >= 2 ? 'fit' : 'bad');
    const m = masteryOf(pl, def.id);
    s += add(m * 0.9, '✦', m >= 15 ? `коронный герой игрока (✦${m})` : m >= 8 ? `высокое мастерство (✦${m})` : `знакомый герой (✦${m})`, 'mastery');
    const tags = mine.flatMap(d => d.tags);
    const need = { tank: [1.0, 'команде нужна передовая'], vision: [0.6, 'не хватает обзора'] };
    for (const t of def.tags) {
      if (need[t] && !tags.includes(t)) s += add(need[t][0] * ck, '🧩', need[t][1], 'comp');
    }
    // постоянный урон — главное в составе
    const dpsN = tags.filter(t => t === 'dps').length;
    if (def.tags.includes('dps')) s += add((dpsN === 0 ? 3.2 : dpsN === 1 ? 1.6 : 0) * ck, '⚔', dpsN === 0 ? 'составу нужен постоянный урон' : 'второй источник урона', 'comp');
    // перебор однотипных: два лекаря, три контроля, много взрывного урона — составы, которые проигрывают
    if (def.tags.includes('heal') && tags.includes('heal')) s += add(-2.5 * (0.4 + ck), '⧉', 'второй лекарь — мало урона', 'bad');
    if (def.tags.includes('control') && tags.filter(t => t === 'control').length >= 2) s += add(-1.6 * (0.4 + ck), '⧉', 'контроля уже в избытке', 'bad');
    if (def.tags.includes('burst') && tags.filter(t => t === 'burst').length >= 2) s += add(-1.2 * (0.4 + ck), '⧉', 'взрывного урона уже в избытке', 'bad');
    if (def.tags.includes('utility') && tags.includes('utility')) s += add(-1.0 * (0.4 + ck), '⧉', 'вторая поддержка — мало урона', 'bad');
    if (mine.length >= 3 && !tags.some(t => t === 'dps' || t === 'burst') && def.tags.some(t => t === 'dps' || t === 'burst')) s += add(2 * ck, '⚔', 'составу не хватает урона', 'comp');
    // связки с уже взятыми союзниками
    for (const [a, b, txt] of this.SYNERGY) {
      if ((def.tags.includes(a) && tags.includes(b)) || (def.tags.includes(b) && tags.includes(a))) { s += add(1.0 * ck, '🔗', txt, 'syn'); break; }
    }
    // контрпик: ответ на героев соперника
    const eTags = (ctx.enemyPicks || []).flatMap(d => d.tags);
    for (const [their, ours, txt] of this.COUNTER) {
      if (eTags.includes(their) && def.tags.includes(ours)) { s += add(1.4 * ck, '🛡', `контрпик: ${txt}`, 'counter'); break; }
    }
    // перехват коронного героя соперника
    const thief = U.maxBy(enemyPlayers, p => masteryOf(p, def.id));
    const steal = thief ? masteryOf(thief, def.id) : 0;
    if (steal >= 15) s += add(3 * ck, '✋', `перехват: коронный герой ${thief.nick} (✦${steal})`, 'steal');
    else if (steal >= 10 && D >= 13) s += add(1.2 * ck, '✋', `не отдать ${thief.nick} (✦${steal})`, 'steal');
    // мета и патч: умный капитан смотрит на винрейт, слабый — на популярность
    const mt = this.metaOf(def.id);
    if (mt) {
      if (D >= 9) { if (Math.abs(mt.score) > 0.012) s += add(mt.score * 70 * aw, mt.score > 0 ? '📈' : '📉', mt.score > 0 ? `мета ${mt.tier}-тир · винрейт ${Math.round(mt.wr * 100)}%` : `вне меты (${mt.tier}-тир)`, mt.score > 0 ? 'meta' : 'bad'); }
      else if (mt.pr > 0.5) s += add(1.5, '🔥', 'популярный герой', 'meta');
      const pd = mt.lastDelta || 0;
      const pk = mt.lastKey && mt.lastKey !== 'stat' ? ` (${{ q: 'Q', r: 'ульта', p: 'пассивка' }[mt.lastKey]})` : '';
      if (pd >= 0.02 && D >= 7) s += add(1.2 * aw, '⬆', `усилен в патче ${mt.patch}${pk}`, 'patch');
      if (pd <= -0.02 && D >= 7) s += add(-1.2 * aw, '⬇', `ослаблен в патче ${mt.patch}${pk}`, 'bad');
    }
    // гибкий пик в начале драфта прячет роли от соперника
    if ((ctx.pickNo || 0) < 3 && D >= 12) { const flex = ROLE_ORDER.filter(r => def.fit[r] >= 2).length; if (flex >= 3) s += add(1.0 * ck, '🔀', 'гибкий пик: скрывает роль', 'flex'); }
    const noise = rng() * (3.5 + (20 - D) * 0.35);
    s += noise;
    if (noise > 5) parts.push({ v: noise * 0.4, ic: '💭', t: 'интуиция капитана', cls: 'gut' });
    return { s, parts };
  },
  draftScore(pl, role, def, mine, enemyPlayers, rng = Math.random, ctx = {}) { return this.draftEval(pl, role, def, mine, enemyPlayers, rng, ctx).s; },
  /* Главные причины: сначала содержательные (мета, связки, угрозы…), «подходит на роль» и «интуиция» — в конце */
  topReasons(parts, n = 3) {
    const rank = p => p.v * (p.cls === 'fit' ? 0.1 : p.cls === 'gut' ? 0.15 : 1);
    return parts.filter(p => p.v > 0).sort((a, b) => rank(b) - rank(a)).slice(0, n).concat(parts.filter(p => p.v < -1).slice(0, 1));
  },
  draftReason(pl, role, def, mine) { return this.topReasons(this.draftEval(pl, role, def, mine, [], () => 0).parts, 1).map(p => p.t).join(', '); },
  BAN_ORDER: ['blue', 'red', 'blue', 'red'],
  PICK_ORDER: ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'],
  /* Полный драфт без интерфейса: баны капитанов, затем пики */
  draft(players, rng = Math.random) {
    const picks = { blue: [], red: [] }, bans = { blue: [], red: [] }, taken = new Set();
    const steps = [];
    for (const t of this.BAN_ORDER) { const b = this.draftBan(players, picks, taken, t, rng); bans[t].push(b); taken.add(b.def.id); steps.push(b); }
    for (const t of this.PICK_ORDER) {
      const res = this.draftPick(players, picks, taken, t, rng);
      picks[t].push(res); taken.add(res.def.id); steps.push(res);
    }
    return { picks, steps, bans };
  },
  /* Бан: угроза от соперников (их мастерство и роли) + мета, минус то, что любят свои */
  draftBan(players, picks, taken, t, rng = Math.random) {
    const et = t === 'blue' ? 'red' : 'blue';
    const cap = this.captainOf(players[t]), D = this.draftIq(cap), ck = U.clamp((D - 2) / 12, 0, 1.3), aw = U.clamp((D - 2) / 12, 0.1, 1.3);
    let best = null;
    for (const d of HEROES) {
      if (taken.has(d.id)) continue;
      const parts = [];
      const add = (v, ic, tx, cls) => { if (v) parts.push({ v, ic, t: tx, cls }); return v; };
      let s = 0;
      // насколько соперник силён на этом герое
      const thr = players[et].map(p => ({ p, v: (d.fit[p.role] >= 2 ? [0, 0, 3, 5][d.fit[p.role]] : -4) + masteryOf(p, d.id) * 0.9 }));
      const top = U.maxBy(thr, x => x.v);
      if (top && top.v > 6) {
        const m = masteryOf(top.p, d.id);
        s += add((top.v - 6) * (0.5 + 0.6 * ck), m >= 15 ? '👑' : '🎯', m >= 15 ? `коронный герой ${top.p.nick} (✦${m})` : m >= 6 ? `${top.p.nick} силён на нём (✦${m})` : `удобный герой для ${{ top: 'топера', jng: 'лесника', mid: 'мидера', adc: 'стрелка', sup: 'саппорта' }[top.p.role]} соперника ${top.p.nick}`, 'threat');
      }
      if (thr.filter(x => x.v > 8).length >= 2 && D >= 11) s += add(1.5 * ck, '♟', 'сразу двое соперников могут на нём играть', 'threat');
      const mt = this.metaOf(d.id);
      if (mt) {
        if (D >= 9) { if (mt.score > 0.012) s += add(mt.score * 90 * aw, '📈', `мета ${mt.tier}-тир · винрейт ${Math.round(mt.wr * 100)}%`, 'meta'); }
        else if (mt.pr > 0.45) s += add(mt.pr * 5, '🔥', 'все его берут', 'meta');
        if ((mt.lastDelta || 0) >= 0.02 && D >= 8) s += add(1.5 * aw, '⬆', `только что усилен (патч ${mt.patch}${mt.lastKey && mt.lastKey !== 'stat' ? ', ' + { q: 'Q', r: 'ульта', p: 'пассивка' }[mt.lastKey] : ''})`, 'patch');
      }
      // не банить то, на чём играют свои
      const love = Math.max(0, ...players[t].map(p => d.fit[p.role] >= 2 ? masteryOf(p, d.id) : 0));
      if (love >= 6) s += add(-love * 0.45 * (0.4 + ck), '💙', 'на нём играет наш игрок', 'bad');
      const noise = rng() * (2 + (20 - D) * 0.3);
      s += noise;
      if (noise > 4 && !parts.some(p => p.v > 2)) parts.push({ v: noise * 0.3, ic: '💭', t: D < 8 ? 'капитан банит наугад' : 'интуиция капитана', cls: 'gut' });
      if (!best || s > best.s) best = { s, def: d, parts };
    }
    return { ban: true, team: t, def: best.def, cap, parts: this.topReasons(best.parts, 3), reason: this.topReasons(best.parts, 1).map(p => p.t).join(', ') };
  },
  draftPick(players, picks, taken, t, rng = Math.random) {
    const et = t === 'blue' ? 'red' : 'blue';
    const done = new Set(picks[t].map(p => p.pl));
    const left = players[t].filter(p => !done.has(p));
    const enemyLeft = players[et].filter(p => !picks[et].some(x => x.pl === p));
    const mine = picks[t].map(p => p.def);
    const cap = this.captainOf(players[t]), D = this.draftIq(cap);
    const ctx = { D, enemyPicks: picks[et].map(p => p.def), pickNo: picks.blue.length + picks.red.length };
    let best = null;
    for (const pl of left) {
      const cands = HEROES.filter(d => !taken.has(d.id)).map(d => Object.assign({ d }, this.draftEval(pl, pl.role, d, mine, enemyLeft, rng, ctx))).sort((a, b) => b.s - a.s);
      // кто сильнее рискует потерять лучшего героя, тот выбирает раньше
      const urgency = cands[0].s - (cands[1] ? cands[1].s : 0) + cands[0].s * 0.3;
      if (!best || urgency > best.urgency) best = { pl, def: cands[0].d, parts: cands[0].parts, urgency };
    }
    const parts = this.topReasons(best.parts, 4);
    return { pl: best.pl, role: best.pl.role, def: best.def, team: t, cap, parts, reason: parts.map(p => p.t).join(', ') };
  },

  /* ---------- Закупка предметов ----------
     Любой герой может купить любой предмет. Ценность предмета = сумма его свойств × важность свойства
     для этого героя (набор умений, роль, теги), состава врагов и стадии игры. Тактика решает, насколько разумно
     игрок закупается: сильный тактик берёт лучшее для ситуации и меняет слабые предметы на сильные,
     слабый — покупает почти что попало. */
  ITEM_UNIT: { atk: 95, arm: 16, hp: 1.9, sp: 21, mana: 3.5, ls: 4000, crit: 7000, pen: 4200, thorns: 4000, dodge: 9500, regen: 27000, manaRegen: 32, goldPow: 6500, towerPow: 3200, cascPow: 9000, shieldPow: 2200, healPow: 2200, visPow: 900, physRed: 5200, magRed: 5200, antiHeal: 2600, tenacity: 2600 },
  PROFILE: {
    top: { atk: 0.9, sp: 0.3, hp: 1.0, arm: 1.0, mana: 0.2, ls: 0.8, crit: 0.3, pen: 0.5, thorns: 0.8, dodge: 0.6, regen: 1.0, manaRegen: 0.2, goldPow: 0.4, towerPow: 0.7, cascPow: 0.4, shieldPow: 0.2, healPow: 0.2, visPow: 0.1, physRed: 0.9, magRed: 0.7, antiHeal: 0.5, tenacity: 0.8 },
    jng: { atk: 1.0, sp: 0.3, hp: 0.8, arm: 0.8, mana: 0.2, ls: 0.8, crit: 0.6, pen: 0.8, thorns: 0.4, dodge: 0.6, regen: 0.6, manaRegen: 0.3, goldPow: 0.5, towerPow: 0.5, cascPow: 0.5, shieldPow: 0.1, healPow: 0.1, visPow: 0.6, physRed: 0.6, magRed: 0.5, antiHeal: 0.6, tenacity: 0.6 },
    mid: { atk: 0.2, sp: 1.3, hp: 0.5, arm: 0.4, mana: 0.8, ls: 0.1, crit: 0.2, pen: 1.0, thorns: 0.1, dodge: 0.7, regen: 0.3, manaRegen: 1.0, goldPow: 0.5, towerPow: 0.3, cascPow: 1.0, shieldPow: 0.1, healPow: 0.1, visPow: 0.3, physRed: 0.4, magRed: 0.5, antiHeal: 0.5, tenacity: 0.6 },
    adc: { atk: 1.4, sp: 0.1, hp: 0.4, arm: 0.3, mana: 0.1, ls: 1.0, crit: 1.4, pen: 1.0, thorns: 0.1, dodge: 0.6, regen: 0.2, manaRegen: 0.1, goldPow: 0.7, towerPow: 1.0, cascPow: 0.6, shieldPow: 0, healPow: 0, visPow: 0.1, physRed: 0.3, magRed: 0.3, antiHeal: 0.7, tenacity: 0.5 },
    sup: { atk: 0.1, sp: 0.8, hp: 0.8, arm: 0.7, mana: 0.6, ls: 0, crit: 0, pen: 0.2, thorns: 0.5, dodge: 0.4, regen: 0.4, manaRegen: 0.8, goldPow: 0.3, towerPow: 0.1, cascPow: 0.4, shieldPow: 1.4, healPow: 1.4, visPow: 1.4, physRed: 0.7, magRed: 0.6, antiHeal: 0.3, tenacity: 0.5 },
  },
  heroProfile(G, h) {
    const a = this.PROFILE[h.def.main || h.role], b = this.PROFILE[h.role], m = h.def.mod || {}, tags = h.def.tags || [];
    const p = {};
    for (const k in this.ITEM_UNIT) p[k] = (a[k] + b[k]) / 2;
    p.atk *= m.atk || 1; p.sp *= m.sp || 1;
    // маги и поддержка, которым не хватает маны, ценят ману выше
    if (h.maxMana && h.mana / h.maxMana < 0.4 && ['mid', 'sup'].includes(h.def.main)) { p.mana *= 1.6; p.manaRegen *= 1.6; }
    if (tags.includes('tank')) { p.hp += 0.4; p.arm += 0.4; p.thorns += 0.3; p.physRed += 0.4; }
    if (tags.includes('heal')) p.healPow += 0.6;
    if (tags.includes('vision')) p.visPow += 0.4;
    if (tags.includes('dps')) p.crit += 0.3;
    if (tags.includes('sustain')) { p.ls += 0.4; p.regen += 0.3; }
    // против кого играем: много физического урона у врагов — броня ценнее
    const foes = G.teams[h.enemyTeam].heroes;
    const phys = U.sum(foes, f => (['adc', 'top', 'jng'].includes(f.def.main) ? 1 : 0) + (f.def.tags.includes('dps') ? 0.4 : 0)) / foes.length;
    // против почти чисто физического состава броня — главный ответ (как в LoL)
    const over = Math.max(0, phys - 0.85);
    p.arm *= (0.6 + phys) * (1 + 5 * over); p.thorns *= (0.6 + phys) * (1 + 4 * over); p.physRed *= (0.4 + phys) * (1 + 5 * over);
    // остальные перекосы состава: чем больше однотипных врагов сверх обычного, тем ценнее ответ
    const ex = this.enemyStacks(G, h);
    p.magRed *= 0.5 + 1.5 * ex.magic; p.antiHeal *= 0.4 + 1.6 * ex.heal; p.tenacity *= 0.5 + 1.5 * ex.control; p.dodge *= 1 + 0.6 * ex.control;
    p.pen *= 1 + 0.8 * ex.tank;
    // стадия игры: доход ценен рано, осада и легендарные предметы — поздно
    p.goldPow *= Math.max(0, 1 - G.minute / 25);
    p.towerPow *= G.minute > 15 ? 1.3 : 0.6;
    return p;
  },
  /* Ответные предметы на каждый тип врагов и «обычное» число таких врагов в составе */
  COUNTERS: {
    phys: { items: ['stoneskin', 'spikes', 'mirror'], start: ['vest', 'cloth'], norm: 3, name: 'физический урон' },
    magic: { items: ['mantle'], start: ['nullcloak'], norm: 2, name: 'магия' },
    heal: { items: ['blight', 'blightstaff'], start: ['shiv'], norm: 1, name: 'лечение и живучесть' },
    tank: { items: ['spear', 'grimoire'], start: ['awl'], norm: 1, name: 'танки' },
    control: { items: ['tenacity', 'boots'], start: ['charmband'], norm: 2, name: 'контроль' },
  },
  /* Сколько врагов каждого типа (сверх обычного, в долях: 1 = на одного больше нормы) */
  enemyStacks(G, h) {
    const foes = G.teams[h.enemyTeam].heroes.map(f => f.def), out = {};
    const n = {
      phys: foes.filter(f => ['adc', 'top', 'jng'].includes(f.main) || f.tags.includes('dps')).length,
      magic: foes.filter(f => ['mid', 'sup'].includes(f.main) && !f.tags.includes('dps')).length,
      heal: foes.filter(f => f.tags.includes('heal') || f.tags.includes('sustain')).length,
      tank: foes.filter(f => f.tags.includes('tank')).length,
      control: foes.filter(f => f.tags.includes('control')).length,
    };
    for (const k in this.COUNTERS) out[k] = Math.max(0, n[k] - this.COUNTERS[k].norm);
    out.count = n;
    return out;
  },
  /* План закупки ответа: выбранный предмет или null. Решение принимается раз за визит на базу */
  counterPlan(G, h, inv) {
    if (G.minute < 4) return null;
    const ex = this.enemyStacks(G, h), tq = U.clamp((iqOf(h, 'tactic') - 2) / 14, 0, 1.2);
    h.mem.counterDone = h.mem.counterDone || {};
    const types = Object.keys(this.COUNTERS).filter(k => ex[k] > 0 && !h.mem.counterDone[k]).sort((a, b) => ex[b] - ex[a]);
    for (const k of types) {
      const C = this.COUNTERS[k];
      // при сильном перекосе (двое и больше лишних однотипных врагов) — до двух ответных предметов
      const want = ex[k] >= 2 ? 2 : 1;
      if (inv.filter(id => C.items.includes(id)).length >= want) { h.mem.counterDone[k] = true; continue; }
      // решение «копить на ответ» принимается один раз за визит: шанс растёт с перекосом и умом игрока
      const key = 'cp_' + k + '_' + G.round;
      if (h.mem[key] == null) h.mem[key] = U.chance(U.clamp(ex[k] * 0.4 * tq, 0, 0.95));
      if (!h.mem[key]) continue;
      const opts = C.items.filter(id => !inv.includes(id));
      if (!opts.length) { h.mem.counterDone[k] = true; continue; }
      return this.pickNear(opts, id => this.itemValue(G, h, id));
    }
    return null;
  },
  /* Стартовая закупка (первая минута): дешёвый ответ на перекос состава врага — если игрок его заметил
     (чем больше однотипных врагов и выше Тактика, тем вероятнее), иначе — зелья здоровья */
  startShop(G, h) {
    const ex = this.enemyStacks(G, h), tq = U.clamp((iqOf(h, 'tactic') - 2) / 14, 0, 1.2);
    const types = Object.keys(this.COUNTERS).filter(k => ex[k] > 0).sort((a, b) => ex[b] - ex[a]);
    let gold = h.gold; const buy = [];
    for (const k of types) {
      if (!U.chance(U.clamp(ex[k] * 0.45 * tq, 0, 0.95))) continue;
      const opts = this.COUNTERS[k].start.filter(id => ITEMS[id].cost <= gold);
      if (!opts.length) continue;
      const id = this.pickNear(opts, x => this.itemValue(G, h, x));
      buy.push(id); gold -= ITEMS[id].cost; h.mem.counterStart = k;
      break;
    }
    const potions = Math.min(POTION.max, Math.floor((buy.length ? gold : Math.min(gold, 220)) / POTION.cost));
    return { buy, potions };
  },
  /* Насколько состав врага перекошен в физический урон: >0 — больше обычного (обычный состав ≈ 0) */
  physThreat(G, h) {
    const foes = G.teams[h.enemyTeam].heroes;
    return U.sum(foes, f => (['adc', 'top', 'jng'].includes(f.def.main) ? 1 : 0) + (f.def.tags.includes('dps') ? 0.4 : 0)) / foes.length - 0.85;
  },
  itemValue(G, h, id, prof) {
    const it = ITEMS[id]; prof = prof || this.heroProfile(G, h);
    let v = 0;
    const owned = h.items.includes(id);   // второй такой же предмет: особые эффекты не складываются (кроме крита и уклонения)
    for (const k in this.ITEM_UNIT) if (it[k] && !(owned && !ITEM_STACKING.has(k))) v += it[k] * this.ITEM_UNIT[k] * prof[k];
    if (it.tier === 4 && G.minute > 22) v *= 1.15;
    v *= this.taste(h.pl, id);
    if (it.tier === 1 && G.minute > 20) v *= 0.7;    // в поздней игре слоты дороже дешёвых предметов
    return v;
  },
  /* Личный «вкус» игрока: небольшие предпочтения отдельных предметов (±20%), постоянные для игрока */
  taste(pl, id) {
    if (!pl) return 1;
    if (!pl.itemTaste) {
      let seed = 7; for (const ch of String(pl.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const r = U.seeded(seed);
      pl.itemTaste = Object.fromEntries(Object.keys(ITEMS).map(k => [k, +(0.88 + r() * 0.24).toFixed(2)]));
    }
    return pl.itemTaste[id] || 1;
  },
  /* Выбор среди почти равных вариантов (в пределах 12% от лучшего), а не всегда один и тот же */
  pickNear(list, f) {
    const sc = list.map(id => [id, f(id)]); const best = Math.max(...sc.map(x => x[1]));
    const near = sc.filter(x => x[1] >= best * 0.92);
    return U.pick(near)[0];
  },
  canOwn(h, id) { const n = h.items.filter(x => x === id).length; return ITEMS[id].tier === 1 ? n < 2 : n < 1; },
  /* Решения на базе: что продать и что купить */
  shop(G, h) {
    const smart = U.chance(U.clamp((iqOf(h, 'tactic') - 2) / 14, 0.05, 1));
    const prof = this.heroProfile(G, h);
    const val = id => this.itemValue(G, h, id, prof);
    const score = id => { const v = val(id); return v / ITEMS[id].cost * Math.sqrt(v); };
    const acts = [];
    let gold = h.gold;
    const inv = h.items.slice();
    const allowed = id => inv.filter(x => x === id).length < (ITEMS[id].tier === 1 ? 2 : 1);
    for (let guard = 0; guard < 8; guard++) {
      const cands = Object.keys(ITEMS).filter(id => ITEMS[id].cost <= gold && allowed(id));
      if (inv.length < 6) {
        if (!cands.length) break;
        let pick;
        // ответ на перекос состава врага: чем больше однотипных врагов и чем выше Тактика, тем вероятнее
        // игрок первым делом копит на контрящий предмет (на каждый тип — один раз)
        const cnt = this.counterPlan(G, h, inv);
        if (cnt) {
          if (ITEMS[cnt].cost <= gold && allowed(cnt)) { acts.push({ buy: cnt }); inv.push(cnt); gold -= ITEMS[cnt].cost; continue; }
          break;
        }
        if (smart) {
          const slotsLeft = 6 - inv.length;
          const eff = id => val(id) / ITEMS[id].cost;
          const okTier = id => ITEMS[id].tier < 4 || G.minute >= 18;
          // умный игрок тратит золото сразу: берёт лучшее по пользе (с учётом цены) из доступного прямо сейчас;
          // копит только если крупная цель почти по карману (не хватает меньше ~300)
          const pool = Object.keys(ITEMS).filter(id => allowed(id) && okTier(id) && ITEMS[id].tier >= (slotsLeft >= 3 ? 1 : 2));
          const goal = this.pickNear(pool, id => val(id) * Math.pow(eff(id), 0.6));
          if (ITEMS[goal].cost <= gold) pick = goal;
          else if (ITEMS[goal].cost - gold < 300 && slotsLeft < 3) break;
          else {
            const ok = cands.filter(id => okTier(id) && (slotsLeft >= 3 || ITEMS[id].tier >= 2));
            if (!ok.length) break;
            pick = this.pickNear(ok, id => val(id) * Math.sqrt(eff(id)));
          }
        } else pick = U.pick(cands);
        acts.push({ buy: pick }); inv.push(pick); gold -= ITEMS[pick].cost;
      } else {
        // полный инвентарь: заменить самый слабый предмет
        const worst = smart ? U.minBy(inv, val) : U.pick(inv);
        const refund = Math.round(ITEMS[worst].cost * 0.6);
        const up = Object.keys(ITEMS).filter(id => ITEMS[id].cost <= gold + refund && !inv.includes(id) && ITEMS[id].cost > ITEMS[worst].cost);
        if (!up.length) break;
        const best = smart ? this.pickNear(up, val) : U.pick(up);
        if (smart && val(best) < val(worst) * 1.15) break;
        if (!smart && U.chance(0.5)) break;
        acts.push({ sell: worst, refund }); inv.splice(inv.indexOf(worst), 1); gold += refund;
        acts.push({ buy: best }); inv.push(best); gold -= ITEMS[best].cost;
      }
    }
    return acts;
  },
  /* Сколько золота нужно, чтобы поход на базу имел смысл */
  /* С каким запасом золота имеет смысл идти на базу: раньше — чтобы деньги не лежали без дела */
  shopTarget(G, h) { return h.items.length < 6 ? (G.minute < 10 ? 400 : G.minute < 20 ? 850 : 1250) : 2600; },
};
