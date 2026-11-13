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
    if (id === 'selena' || id === 'nia') w[T_VIS] += 0.4;
    if (id === 'morven' && h.lvl >= 6) w[T_HEAL] += 0.5;
    if (id === 'granitor') w[T_DEF] += 0.5;
    // Тактика: насколько ИИ учитывает ситуацию (здоровье, ману, событие, роль); слабый тактик играет «по шаблону»
    const k = U.clamp((iqOf(h, 'tactic') - 2) / 12, 0, 1.25);
    const flat = [1.6, 0.8, 0.8, 0.8, 1.1, 0.8];
    // слабый тактик ещё и «плывёт» в приоритетах от хода к ходу
    const drift = U.clamp((12 - iqOf(h, 'tactic')) / 10, 0, 1) * 0.9;
    for (let t = 0; t < 6; t++) w[t] = Math.max(0.05, (flat[t] + k * (w[t] - flat[t])) * (1 + U.rand(-drift, drift)));
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
    const c = (pl.iq && pl.iq.team) || 10, ck = U.clamp((c - 2) / 12, 0, 1.3);
    const need = { tank: 2.5 * ck, heal: 1.8 * ck, control: 1.2 * ck };
    for (const t of def.tags) {
      if (need[t] && !tags.includes(t)) s += need[t];
      if (tags.filter(x => x === t).length >= 2) s -= 1.5;
    }
    const steal = Math.max(0, ...enemyPlayers.map(p => masteryOf(p, def.id)));
    if (steal >= 15) s += 3 * ck;
    return s + rng() * (3.5 + (20 - c) * 0.35);
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

  /* ---------- Закупка предметов ----------
     Любой герой может купить любой предмет. Ценность предмета = сумма его свойств × важность свойства
     для этого героя (набор умений, роль, теги), состава врагов и стадии игры. Тактика решает, насколько разумно
     игрок закупается: сильный тактик берёт лучшее для ситуации и меняет слабые предметы на сильные,
     слабый — покупает почти что попало. */
  ITEM_UNIT: { atk: 95, arm: 16, hp: 1.9, sp: 21, mana: 3.5, ls: 4000, crit: 7000, pen: 6000, thorns: 4000, dodge: 9500, regen: 27000, manaRegen: 32, goldPow: 6500, towerPow: 3200, cascPow: 9000, shieldPow: 2200, healPow: 2200, visPow: 900 },
  PROFILE: {
    top: { atk: 0.9, sp: 0.3, hp: 1.0, arm: 1.0, mana: 0.2, ls: 0.8, crit: 0.3, pen: 0.5, thorns: 0.8, dodge: 0.6, regen: 1.0, manaRegen: 0.2, goldPow: 0.4, towerPow: 0.7, cascPow: 0.4, shieldPow: 0.2, healPow: 0.2, visPow: 0.1 },
    jng: { atk: 1.0, sp: 0.3, hp: 0.8, arm: 0.8, mana: 0.2, ls: 0.8, crit: 0.6, pen: 0.8, thorns: 0.4, dodge: 0.6, regen: 0.6, manaRegen: 0.3, goldPow: 0.5, towerPow: 0.5, cascPow: 0.5, shieldPow: 0.1, healPow: 0.1, visPow: 0.6 },
    mid: { atk: 0.2, sp: 1.3, hp: 0.5, arm: 0.4, mana: 0.8, ls: 0.1, crit: 0.2, pen: 1.0, thorns: 0.1, dodge: 0.7, regen: 0.3, manaRegen: 1.0, goldPow: 0.5, towerPow: 0.3, cascPow: 1.0, shieldPow: 0.1, healPow: 0.1, visPow: 0.3 },
    adc: { atk: 1.4, sp: 0.1, hp: 0.4, arm: 0.3, mana: 0.1, ls: 1.0, crit: 1.4, pen: 1.0, thorns: 0.1, dodge: 0.6, regen: 0.2, manaRegen: 0.1, goldPow: 0.7, towerPow: 1.0, cascPow: 0.6, shieldPow: 0, healPow: 0, visPow: 0.1 },
    sup: { atk: 0.1, sp: 0.8, hp: 0.8, arm: 0.7, mana: 0.6, ls: 0, crit: 0, pen: 0.2, thorns: 0.5, dodge: 0.4, regen: 0.4, manaRegen: 0.8, goldPow: 0.3, towerPow: 0.1, cascPow: 0.4, shieldPow: 1.4, healPow: 1.4, visPow: 1.4 },
  },
  heroProfile(G, h) {
    const a = this.PROFILE[h.def.main || h.role], b = this.PROFILE[h.role], m = h.def.mod || {}, tags = h.def.tags || [];
    const p = {};
    for (const k in this.ITEM_UNIT) p[k] = (a[k] + b[k]) / 2;
    p.atk *= m.atk || 1; p.sp *= m.sp || 1;
    // маги и поддержка, которым не хватает маны, ценят ману выше
    if (h.maxMana && h.mana / h.maxMana < 0.4 && ['mid', 'sup'].includes(h.def.main)) { p.mana *= 1.6; p.manaRegen *= 1.6; }
    if (tags.includes('tank')) { p.hp += 0.4; p.arm += 0.4; p.thorns += 0.3; }
    if (tags.includes('heal')) p.healPow += 0.6;
    if (tags.includes('vision')) p.visPow += 0.4;
    if (tags.includes('dps')) p.crit += 0.3;
    if (tags.includes('sustain')) { p.ls += 0.4; p.regen += 0.3; }
    // против кого играем: много физического урона у врагов — броня ценнее
    const foes = G.teams[h.enemyTeam].heroes;
    const phys = U.sum(foes, f => (['adc', 'top', 'jng'].includes(f.def.main) ? 1 : 0) + ((f.def.mod || {}).atk > 1 ? 0.3 : 0)) / foes.length;
    p.arm *= 0.6 + phys; p.thorns *= 0.6 + phys;
    // стадия игры: доход ценен рано, осада и легендарные предметы — поздно
    p.goldPow *= Math.max(0, 1 - G.minute / 25);
    p.towerPow *= G.minute > 15 ? 1.3 : 0.6;
    return p;
  },
  itemValue(G, h, id, prof) {
    const it = ITEMS[id]; prof = prof || this.heroProfile(G, h);
    let v = 0;
    for (const k in this.ITEM_UNIT) if (it[k]) v += it[k] * this.ITEM_UNIT[k] * prof[k];
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
        if (smart) {
          const slotsLeft = 6 - inv.length;
          const eff = id => val(id) / ITEMS[id].cost;
          const okTier = id => ITEMS[id].tier < 4 || G.minute >= 18;
          if (slotsLeft >= 3) {
            // слотов много: берём лучшее из доступного по соотношению «польза/цена», но не мусор
            const ok = cands.filter(id => okTier(id) && eff(id) >= 0.8);
            if (!ok.length) break;
            pick = this.pickNear(ok, id => val(id) * Math.sqrt(eff(id)));
          } else {
            // слотов мало: каждый на счету — копим на крупный предмет
            const pool = Object.keys(ITEMS).filter(id => allowed(id) && okTier(id) && ITEMS[id].tier >= 2);
            const goal = this.pickNear(pool, id => val(id) * Math.pow(eff(id), 0.6));
            if (ITEMS[goal].cost <= gold) pick = goal; else break;
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
        if (smart && val(best) < val(worst) * 1.35) break;
        if (!smart && U.chance(0.5)) break;
        acts.push({ sell: worst, refund }); inv.splice(inv.indexOf(worst), 1); gold += refund;
        acts.push({ buy: best }); inv.push(best); gold -= ITEMS[best].cost;
      }
    }
    return acts;
  },
  /* Сколько золота нужно, чтобы поход на базу имел смысл */
  shopTarget(G, h) { return h.items.length < 6 ? (G.minute < 10 ? 450 : G.minute < 20 ? 1300 : 1900) : 2600; },
};
