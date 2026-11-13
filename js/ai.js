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
    if (id === 'selena' || id === 'nia') w[T_VIS] += 0.4;
    if (id === 'morven' && h.lvl >= 6) w[T_HEAL] += 0.5;
    if (id === 'granitor') w[T_DEF] += 0.5;
    return w;
  },

  scoreSim(sim, w, h) {
    let s = 0;
    for (let t = 0; t < 6; t++) s += sim.counts[t] * w[t];
    for (const c of sim.creates) s += c.sp === 'prism' ? 7 : c.sp === 'bomb' ? 4.5 : 3.2;
    s += sim.stones * 0.9;
    s += sim.acts.length * 1.2;
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
        s = this.scoreSim(h.board.simulateDeep(mv, blind, preview), w, h);
      }
      // предпочтение ходов внизу поля (больше шансов на каскад)
      s += Math.max(mv.r, mv.r2) * 0.12 + Math.random() * 0.8;
      if (s > bs) { bs = s; best = mv; }
    }
    return best;
  },

  chooseSkill(G, h, after) {
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
      return key;
    }
    return null;
  },

  /* ---------- Отклик на сигнал (решение ИИ; человек решает сам, но скорость прибытия у всех от Командной игры) ---------- */
  respondSignal(G, h, sig) {
    if (!h.alive || (h.ev && (h.ev.type === 'recall' || h.ev.type === 'dead'))) return { accept: false, fast: false };
    const hp = h.hp / h.maxHp;
    let p;
    if (sig.type === 'retreat') p = 0.45 + 0.04 * sd(h, 'team') + (hp < 0.4 ? 0.3 : 0) - 0.02 * sd(h, 'agr');
    else p = 0.4 + 0.035 * sd(h, 'team') + 0.015 * sd(sig.from, 'team') - (hp < 0.4 ? 0.25 : 0);
    const accept = U.chance(U.clamp(p, 0.03, 0.97));
    return { accept, fast: accept && AI.arrivesFast(h) };
  },
  arrivesFast(h) { return U.chance(U.clamp(0.45 + 0.05 * sd(h, 'team'), 0.05, 0.95)); },

  /* ---------- Драфт: оценка героя для игрока ----------
     пригодность к роли, мастерство, нехватка в составе (танк, лекарь, контроль), перехват коронного героя соперника */
  draftScore(pl, role, def, mine, enemyPlayers, rng = Math.random) {
    const fit = def.fit[role];
    let s = [-7, -1.5, 6.5, 9][fit];
    const m = masteryOf(pl, def.id);
    s += m * 0.9;
    const tags = mine.flatMap(d => d.tags);
    const need = { tank: 2.5, heal: 1.8, control: 1.2 };
    for (const t of def.tags) {
      if (need[t] && !tags.includes(t)) s += need[t];
      if (tags.filter(x => x === t).length >= 2) s -= 1.5;
    }
    const steal = Math.max(0, ...enemyPlayers.map(p => masteryOf(p, def.id)));
    if (steal >= 15) s += 3;
    return s + rng() * 3.5;
  },
  draftReason(pl, role, def, mine) {
    const fit = def.fit[role], m = masteryOf(pl, def.id);
    if (fit >= 3) return m >= 15 ? 'коронный герой' : m ? `родная роль, мастерство ${m}` : 'родная роль';
    if (m >= 8) return `не по профилю (${FIT_NAMES[fit]}), но мастерство ${m}`;
    const tags = mine.flatMap(d => d.tags);
    const t = def.tags.find(x => ['tank', 'heal', 'control'].includes(x) && !tags.includes(x));
    if (t) return `не по профилю, но команде нужен ${TAG_NAMES[t]}`;
    return `играбельный вариант (${FIT_NAMES[fit]})`;
  },
  /* Полный драфт без интерфейса: возвращает составы { blue: [{def, role, pl, reason}], red: [...] } */
  draft(players, rng = Math.random) {
    const order = ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'];
    const picks = { blue: [], red: [] }, taken = new Set();
    const steps = [];
    for (const t of order) {
      const res = this.draftPick(players, picks, taken, t, rng);
      picks[t].push(res); taken.add(res.def.id); steps.push(res);
    }
    return { picks, steps };
  },
  draftPick(players, picks, taken, t, rng = Math.random) {
    const et = t === 'blue' ? 'red' : 'blue';
    const done = new Set(picks[t].map(p => p.pl));
    const left = players[t].filter(p => !done.has(p));
    const enemyLeft = players[et].filter(p => !picks[et].some(x => x.pl === p));
    const mine = picks[t].map(p => p.def);
    let best = null;
    for (const pl of left) {
      const cands = HEROES.filter(d => !taken.has(d.id)).map(d => ({ d, s: this.draftScore(pl, pl.role, d, mine, enemyLeft, rng) })).sort((a, b) => b.s - a.s);
      // кто сильнее рискует потерять лучшего героя, тот выбирает раньше
      const urgency = cands[0].s - (cands[1] ? cands[1].s : 0) + cands[0].s * 0.3;
      if (!best || urgency > best.urgency) best = { pl, def: cands[0].d, urgency };
    }
    return { pl: best.pl, role: best.pl.role, def: best.def, team: t, reason: this.draftReason(best.pl, best.pl.role, best.def, mine) };
  },
};
