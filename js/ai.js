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
    if (id === 'korvin') w[T_GOLD] += 0.4;
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

  chooseMove(G, h) {
    const moves = h.board.listMoves(true);
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
        s = this.scoreSim(h.board.simulate(mv, true), w, h);
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
      if (key === 'r' && s.need !== 'global' && !G.enemiesIn(h).length && !['dragon', 'baron'].includes(h.ev.type)) continue;
      if (after && U.chance(0.4)) continue;
      return key;
    }
    return null;
  },
};
