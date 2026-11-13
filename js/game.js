'use strict';
/* Ядро матча: герои, события, бой, цели, башни */

const XP_NEED = l => 90 + 30 * l;
const TOWER_HP = [1100, 1300, 1500];
const NEXUS_HP = 2600;
const ATK_MUL = 2.6;
const HERO_DMG = 1.45;
const LANES = ['top', 'mid', 'bot'];
const EV_INFO = {
  lane: { name: 'Фарм линии', color: '#58d68d', icon: '🗡', desc: '⚔ делится: 55% — миньонам (золото, толкание волны), 45% — сопернику по линии.' },
  jungle: { name: 'Фарм леса', color: '#2ec4b6', icon: '🌲', desc: '⚔ бьёт лесной лагерь. ◉ заряжает шкалу ганга. Убитый лагерь даёт золото и опыт.' },
  gank: { name: 'Ганг!', color: '#ff9f43', icon: '⚡', desc: 'Лесник пришёл на линию. Весь ⚔ бьёт по врагам. Варды соперника могли раскрыть ганг заранее.' },
  dragon: { name: 'Битва за Дракона', color: '#ff6b3d', icon: '🐉', desc: '⚔ бьёт Дракона (и врагов, если они оспаривают). Последний удар забирает бафф.' },
  baron: { name: 'Битва за Барона', color: '#b46bff', icon: '👾', desc: 'Барон даёт команде мощное усиление осады. Оспаривающие враги делят урон.' },
  siege: { name: 'Осада башни', color: '#ffd166', icon: '🏰', desc: '⚔ бьёт башню (или Нексус). Башня стреляет в ответ, если рядом нет своих миньонов.' },
  defend: { name: 'Защита башни', color: '#7ec8ff', icon: '🛡', desc: 'Защитники бьют осаждающих. Башня помогает им стрельбой.' },
  recall: { name: 'На базе', color: '#5dade2', icon: '🏠', desc: 'Полное восстановление и покупка предметов.' },
  dead: { name: 'Погиб', color: '#7f8c8d', icon: '☠', desc: 'Ожидание возрождения.' },
};

class Hero {
  constructor(def, team, game, role, pl) {
    this.def = def; this.team = team; this.game = game;
    this.id = `${team}-${def.id}`;
    this.role = role || def.main || def.role; this.name = def.name;
    this.pl = pl || neutralPlayer(this.role);
    this.fit = def.fit ? def.fit[this.role] : 3;
    this.ms = masteryOf(this.pl, def.id);
    // бонус ко всем характеристикам: мастерство/4 + форма (пригодность героя к роли — только подсказка для ИИ, без штрафа)
    this.bonusAll = this.ms / 4 + playerFormBonus(this.pl);
    this.tilt = 0; this.sdmg = 0; this.obj = 0; this.shielded = 0; this.vis = 0;
    this.lvl = 1; this.xp = 0;
    this.items = []; this.buildIdx = 0;
    this.gold = 500; this.totalGold = 500;
    this.k = 0; this.d = 0; this.a = 0; this.dmg = 0; this.healed = 0; this.cs = 0;
    this.cd = { q: 0, r: 0 };
    this.stunned = 0; this.dead = 0; this.ev = null; this.gank = 0;
    this.mem = {}; this.streak = 0;
    this.recalc();
    this.hp = this.maxHp; this.mana = this.maxMana * 0.6; this.shield = 0;
    this.board = new Board(this);
    this.ctrl = 'ai';
  }
  get enemyTeam() { return this.team === 'blue' ? 'red' : 'blue'; }
  get lane() { return ROLE_LANE[this.role]; }
  get nick() { return this.pl ? this.pl.nick : this.name; }
  get alive() { return this.dead <= 0; }
  itemStat(k) { return U.sum(this.items, it => ITEMS[it][k] || 0) + (this.elix || 0) * (ELIXIR[k] || 0); }
  recalc() {
    const b = BASE_STATS[this.def.main || this.def.role], m = this.def.mod || {}, L = this.lvl - 1;
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round((b.hp + L * b.hpG) * (m.hp || 1) + this.itemStat('hp'));
    this.power = (b.atk + L * b.atkG) * (m.atk || 1) + this.itemStat('atk');
    this.armor = (b.arm + L * b.armG) * (m.arm || 1) + this.itemStat('arm');
    this.maxMana = Math.round(b.mana + L * 8 + this.itemStat('mana'));
    this.sp = (b.sp + L * b.spG) * (m.sp || 1) + this.itemStat('sp');
    this.lifesteal = this.itemStat('ls');
    if (this.hp != null) this.hp = Math.min(this.maxHp, Math.max(1, Math.round(this.maxHp * ratio)));
  }
}

function mkTeam(id) {
  return {
    id, name: id === 'blue' ? 'Синие' : 'Красные', heroes: [], kills: 0,
    towers: { top: [...TOWER_HP], mid: [...TOWER_HP], bot: [...TOWER_HP] },
    nexus: NEXUS_HP, nexusMax: NEXUS_HP,
    dragons: [], soul: null, baron: 0, pressure: 0, river: 0, momentum: 0, momentumLane: null,
  };
}

class Game {
  /* lineup: массив из 5 { def, role, pl } (или просто 5 героев — тогда игроки «по 10») */
  constructor(blueLineup, redLineup, ui, opts = {}) {
    this.ui = ui;
    this.opts = opts;
    this.signals = [];
    this.minute = 1; this.round = 0; this.over = false; this.winner = null;
    this.teams = { blue: mkTeam('blue'), red: mkTeam('red') };
    for (const t of ['blue', 'red']) {
      let lu = t === 'blue' ? blueLineup : redLineup;
      if (lu[0] && lu[0].q) lu = lu.map(d => ({ def: d, role: d.main || d.role, pl: null }));
      this.teams[t].heroes = ROLE_ORDER.map(r => { const x = lu.find(e => e.role === r); return new Hero(x.def, t, this, r, x.pl); });
      if (opts.names && opts.names[t]) this.teams[t].name = opts.names[t];
    }
    this.heroes = [...this.teams.blue.heroes, ...this.teams.red.heroes];
    this.lanes = {};
    for (const l of LANES) this.lanes[l] = { id: l, push: 0, ward: { blue: 0, red: 0 }, farm: { blue: 0, red: 0 } };
    this.dragonQueue = U.shuffle(DRAGONS.slice());
    this.dragon = { kind: 'dragon', alive: false, spawnAt: 6, hp: 0, max: 0, type: this.dragonQueue[0], retryAt: 0 };
    this.baron = { kind: 'baron', alive: false, spawnAt: 20, hp: 0, max: 0, retryAt: 0 };
    this.persist = [];
    this.events = [];
    this.active = null;
    this.firstBlood = false;
    this.roundKills = [];
    this.evSeq = 1;
  }

  /* ---------------- Запросы ---------------- */
  team(h) { return this.teams[h.team]; }
  enemyOf(t) { return t === 'blue' ? 'red' : 'blue'; }
  hero(team, role) { return this.teams[team].heroes.find(h => h.role === role); }
  enemiesIn(h) { const ev = h.ev; if (!ev || !ev.sides) return []; return ev.sides[h.enemyTeam].filter(x => x.alive); }
  alliesIn(h) { const ev = h.ev; if (!ev || !ev.sides) return [h]; return ev.sides[h.team].filter(x => x.alive); }
  allTeam(h) { return this.teams[h.team].heroes.filter(x => x.alive); }
  allEnemies(h) { return this.teams[h.enemyTeam].heroes.filter(x => x.alive && !(x.ev && x.ev.type === 'recall')); }
  target(h) {
    const e = this.enemiesIn(h);
    if (!e.length) return null;
    if (e.length === 1) return e[0];
    const ev = h.ev;
    // Командное мышление: бить ту же цель, что и союзники (фокус)
    const f = ev && ev.focus && ev.focus[h.team];
    if (f && f.alive && e.includes(f) && U.chance(U.clamp((iqOf(h, 'team') - 3) / 14, 0, 0.95))) return f;
    // Тактика: выбрать цель, которую реально добить (наименьший запас здоровья), иначе — кого попало
    const t = U.chance(U.clamp((iqOf(h, 'tactic') - 2) / 14, 0.05, 0.98)) ? U.minBy(e, x => x.hp + x.shield) : U.pick(e);
    if (ev) { ev.focus = ev.focus || {}; if (!ev.focus[h.team] || !ev.focus[h.team].alive) ev.focus[h.team] = t; }
    return t;
  }
  sp(h, base, ratio) { return base + h.sp * ratio + h.lvl * 4; }
  teamBuffs(t) {
    const tm = this.teams[t]; const b = { atk: 1, arm: 0, regen: 0, mana: 0 };
    for (const d of tm.dragons) {
      if (d === 'fire') b.atk += 0.08; if (d === 'earth') b.arm += 8; if (d === 'ocean') b.regen += 0.02; if (d === 'cloud') b.mana += 6;
    }
    if (tm.soul === 'fire') b.atk += 0.25; if (tm.soul === 'earth') b.arm += 40; if (tm.soul === 'ocean') b.regen += 0.08; if (tm.soul === 'cloud') b.mana += 25;
    return b;
  }
  firstTower(team, lane) {
    const arr = this.teams[team].towers[lane];
    const i = arr.findIndex(hp => hp > 0);
    return i;
  }
  nexusOpen(team) { return LANES.some(l => this.teams[team].towers[l].every(hp => hp <= 0)); }

  /* ---------------- Главный цикл ---------------- */
  async run() {
    this.ui.log(`<b>Матч начался!</b> Добро пожаловать в Ущелье Кристаллов.`, 'sys');
    while (!this.over) {
      this.round++;
      this.assignEvents();
      this.ui.roundStart(this);
      await wait(500);
      // порядок ходов: чем выше Реакция, тем раньше герой ходит в минуте
      const order = this.heroes.slice().sort((a, b) => (sd(b, 'rea') + U.rand(2.5)) - (sd(a, 'rea') + U.rand(2.5)));
      for (const h of order) {
        if (this.over) break;
        await this.heroTurn(h);
      }
      if (this.over) break;
      await this.endRound();
      if (this.round > 70) this.finish(this.teams.blue.nexus >= this.teams.red.nexus ? 'blue' : 'red');
    }
    this.ui.gameOver(this);
  }

  async heroTurn(h) {
    if (!h.alive || h.ev.type === 'recall') return;
    this.active = h;
    this.ui.focus(h);
    await wait(380);
    if (h.stunned > 0) {
      h.stunned--;
      this.ui.float(h, 'ОГЛУШЁН', '#ffe066');
      this.ui.log(`${this.tag(h)} оглушён и пропускает ход.`);
      await wait(500);
      return;
    }
    await this.trySkills(h);
    if (this.over || !h.alive) return;
    let moves = 1;
    let guard = 0;
    while (moves > 0 && h.alive && !this.over && guard++ < 4) {
      moves--;
      const mv = await this.chooseMove(h);
      if (!mv) {
        this.ui.float(h, 'Нет ходов — перемешивание', '#ccc');
        h.board.shuffleGems();
        await wait(500);
        moves++;
        continue;
      }
      const res = await this.doSwap(h, mv);
      if (res.bonus && guard < 3) { moves++; this.ui.float(h, 'ДОП. ХОД!', '#fff'); }
    }
    if (h.alive && !this.over) await this.trySkills(h, true);
    await wait(150);
  }

  async chooseMove(h) {
    if (h.ctrl === 'ai') return AI.chooseMove(this, h);
    return this.ui.awaitHumanMove(h);
  }

  async trySkills(h, after) {
    // человек выберет умение сам (точка входа интерфейса), ИИ — по своим правилам
    const key = h.ctrl !== 'ai' && this.ui.awaitHumanSkill ? await this.ui.awaitHumanSkill(h, after) : AI.chooseSkill(this, h, after);
    if (key) await this.castSkill(h, key);
  }

  canCast(h, key) {
    const s = h.def[key];
    if (!s || h.cd[key] > 0 || h.mana < s.cost || (s.lvl && h.lvl < s.lvl)) return false;
    if (!h.alive || h.ev.type === 'recall') return false;
    if (s.need === 'enemy' && !this.target(h)) return false;
    if (s.need === 'global' && !this.allEnemies(h).length) return false;
    return true;
  }

  async castSkill(h, key) {
    const s = h.def[key];
    if (!this.canCast(h, key)) return false;
    h.mana -= s.cost;
    h.cd[key] = s.cd;
    const t = this.target(h);
    this.ui.cast(h, s, key);
    this.ui.log(`${this.tag(h)} применяет <b class="skn">${s.icon} ${s.name}</b>${t && s.need === 'enemy' ? ` на ${this.tag(t)}` : ''}.`);
    await wait(650);
    await s.cast(this, h, t);
    await wait(200);
    return true;
  }

  /* ---------------- Разрешение поля ---------------- */
  async doSwap(h, mv) {
    const b = h.board;
    const k1 = mv.r * N + mv.c, k2 = mv.r2 * N + mv.c2;
    b.hint = { k1, k2, t: 1 };
    await wait(260);
    b.swap(mv.r, mv.c, mv.r2, mv.c2);
    sfx('swap');
    await wait(200);
    b.hint = null;
    if (mv.prism) {
      const a = b.g[mv.r2][mv.c2], o = b.g[mv.r][mv.c]; // после обмена
      const extra = new Set([k1, k2]);
      if (a.t === T_PRISM && o.t === T_PRISM) for (let k = 0; k < N * N; k++) extra.add(k);
      else {
        const color = a.t === T_PRISM ? o.t : a.t;
        b.forEach((g, k) => { if (g && g.t === color) extra.add(k); });
      }
      b.rings.push({ x: mv.c, y: mv.r, t: 0, max: 8, color: '#fff' });
      this.ui.float(h, 'ПРИЗМА!', '#fff');
      return this.resolve(h, { extra, prefer: [k1, k2] });
    }
    return this.resolve(h, { prefer: [k1, k2] });
  }

  /* Каскадное разрешение поля. effects=false — для полей врагов после умений */
  async resolve(h, opts = {}) {
    const b = h.board;
    let cascade = opts.cascadeStart || 0;
    let extra = opts.extra || null;
    let prefer = opts.prefer || null;
    let bonus = false;
    const effects = opts.effects !== false;
    let total = 0;
    for (let iter = 0; iter < 25; iter++) {
      const st = b.step(prefer, extra);
      if (!st.clear.size) break;
      if (st.maxLen >= 5) bonus = true;
      const info = { cascade, atkRuns: st.atkRuns, bombs: st.acts.filter(a => a.sp === 'bomb').length, maxLen: st.maxLen, acts: st.acts.length };
      b.applyStep(st);
      this.stepSound(st, cascade);
      if (st.acts.length) b.shake = Math.min(1, 0.3 + st.acts.length * 0.2);
      if (cascade >= 1 && effects) this.ui.combo(h, cascade + 1);
      await wait(230);
      if (effects) await this.applyGems(h, st.counts, info);
      total += st.clear.size;
      const fall = b.gravity();
      await wait(Math.min(520, 120 + Math.sqrt(Math.max(0, fall)) * 150));
      cascade++;
      extra = null; prefer = null;
      if (this.over) break;
    }
    if (!b.hasMoves()) { b.shuffleGems(); await wait(400); }
    return { bonus, total, cascade };
  }

  stepSound(st, cascade) {
    const top = st.counts.indexOf(Math.max(...st.counts));
    sfx('match', { type: top, cascade });
    if (st.acts.some(a => a.sp === 'prism')) sfx('prism');
    else if (st.acts.some(a => a.sp === 'bomb')) sfx('bomb');
    else if (st.acts.some(a => a.sp === 'h' || a.sp === 'v')) sfx('line');
    if (st.stones) sfx('stone');
  }

  async settle(h, effects) {
    if (h.board.hasAnyMatch()) return this.resolve(h, { effects, cascadeStart: 1 });
    if (!h.board.hasMoves()) { h.board.shuffleGems(); await wait(300); }
  }

  async blast(h, keys) {
    h.board.glow = 1;
    return this.resolve(h, { extra: new Set(keys), cascadeStart: 0 });
  }

  /* Применение эффектов совпавших камней */
  async applyGems(h, counts, info) {
    if (!h.alive) return;
    const c = { counts, info, m: { atk: 1, def: 1, heal: 1, mana: 1, gold: 1, vis: 1 }, after: [], lifesteal: h.lifesteal, gankMul: 1, bombDmg: 0, label: null, manaFlat: 0, healAlly: 0, shieldAlly: 0, visShield: 0 };
    const p = h.def.passive;
    if (p.effects) p.effects(this, h, c);
    const buff = this.teamBuffs(h.team);
    // Механика: каскады и общая точность; Хладнокровие: штраф под давлением
    const casc = 1 + 0.25 * info.cascade * (sm(0.04, h, 'mech')) * (1 + 4 * h.itemStat('cascPow'));
    const inFight = h.ev && h.ev.sides && this.enemiesIn(h).length > 0;
    const allies = this.alliesIn(h).length;
    const gm = (sm(0.012, h, 'mech')) * this.pressureFactor(h)
      * (inFight && this.persist.includes(h.ev) ? sm(0.012, h, 'calm') : 1)   // хладнокровие в затяжных боях
      * (allies >= 2 ? sm(0.012, h, 'team') : 1);                              // слаженность с союзниками
    for (const k in c.m) c.m[k] *= gm;
    if (info.atkRuns.some(l => l >= 4) && U.chance(U.clamp(0.1 + 0.02 * sd(h, 'mech') + h.itemStat('crit'), 0.01, 0.8))) { c.m.atk *= 1.5; c.label = c.label || 'КРИТ!'; }
    c.m.mana *= sm(0.045, h, 'read');
    c.m.gold *= sm(0.02, h, 'farm') * (1 + h.itemStat('goldPow'));
    const healPow = 1 + this.itemsOf(h, 'healPow');
    const shieldPow = 1 + this.itemsOf(h, 'shieldPow');
    const visPow = 1 + this.itemsOf(h, 'visPow');

    if (counts[T_ATK] > 0) {
      const dmg = counts[T_ATK] * h.power * ATK_MUL * c.m.atk * casc * buff.atk;
      if (c.label) this.ui.float(h, c.label, '#ff5468');
      this.routeAttack(h, dmg, c);
    }
    if (c.bombDmg > 0) { const t = this.target(h); if (t) { this.ui.projectile(h, t, '#ff9a3c'); this.dealDamage(h, t, c.bombDmg, 'magic'); } }
    if (counts[T_DEF] > 0) {
      const amt = counts[T_DEF] * (10 + h.lvl * 3) * c.m.def * casc * shieldPow;
      this.shieldHero(h, h, amt, true);
      if (c.shieldAlly > 0) { const a = this.weakestAlly(h, true); if (a) this.shieldHero(h, a, amt * c.shieldAlly); }
    }
    if (counts[T_HEAL] > 0) {
      const amt = counts[T_HEAL] * (11 + h.lvl * 3) * c.m.heal * casc * healPow;
      this.healHero(h, h, amt, true);
      if (c.healAlly > 0) { const a = this.weakestAlly(h, true); if (a) this.healHero(h, a, amt * c.healAlly); }
    }
    if (counts[T_MANA] > 0 || c.manaFlat) {
      const amt = counts[T_MANA] * 10 * c.m.mana * casc + c.manaFlat;
      this.addMana(h, amt, true);
    }
    if (counts[T_GOLD] > 0) {
      const amt = Math.round(counts[T_GOLD] * 13 * c.m.gold * casc);
      this.addGold(h, amt);
      this.ui.burstTo(h, 'gold', '#ffc93c', amt);
    }
    if (counts[T_VIS] > 0) {
      this.vision(h, counts[T_VIS] * c.m.vis * casc * visPow, c);
      if (c.visShield > 0) for (const a of this.alliesIn(h)) this.shieldHero(h, a, c.visShield);
    }
    const gems = U.sum(counts);
    this.gainXp(h, gems * 3);
    for (const fn of c.after) await fn();
  }
  itemsOf(h, k) { return h.itemStat(k); }
  /* Под давлением (мало здоровья или команда отстаёт по золоту) эффекты слабеют; Хладнокровие это гасит */
  pressureFactor(h) {
    const behind = U.sum(this.teams[h.enemyTeam].heroes, x => x.totalGold) - U.sum(this.teams[h.team].heroes, x => x.totalGold) > 1500;
    if (h.hp / h.maxHp >= 0.4 && !behind) return 1;
    return 1 - U.clamp(0.16 - 0.02 * sd(h, 'calm'), -0.1, 0.35);
  }
  weakestAlly(h, excludeSelf) {
    const list = this.alliesIn(h).filter(a => !excludeSelf || a !== h);
    return list.length ? U.minBy(list, a => a.hp / a.maxHp) : null;
  }

  /* Куда уходит урон от ⚔ в зависимости от события */
  routeAttack(h, dmg, c) {
    const ev = h.ev;
    const enemies = this.enemiesIn(h);
    const toHero = (amt) => {
      if (amt <= 0 || !enemies.length) return 0;
      const t = this.target(h);
      this.ui.projectile(h, t, '#ff5468');
      const d = this.dealDamage(h, t, amt * (sm(0.03, h, 'agr')), 'phys');
      if (c.lifesteal > 0) this.healHero(h, h, d * c.lifesteal, true);
      return d;
    };
    const type = ev.type === 'siege' && h.team !== ev.att ? 'defend' : ev.type;
    switch (type) {
      case 'lane': {
        const share = enemies.length ? U.clamp(0.55 - 0.015 * sd(h, 'agr'), 0.3, 0.75) : 1;
        this.farmWave(h, dmg * share);
        toHero(dmg * (1 - share));
        break;
      }
      case 'jungle': this.hitNpc(h, ev, dmg); break;
      case 'gank': toHero(dmg * (h.team === ev.att ? 1.35 * (sm(0.03, h, 'agr')) : 1)); break;
      case 'defend': toHero(dmg); break;
      case 'dragon': case 'baron': {
        if (enemies.length) { this.hitNpc(h, ev, dmg * 0.45); toHero(dmg * 0.55); }
        else this.hitNpc(h, ev, dmg);
        break;
      }
      case 'siege': {
        if (enemies.length) { this.hitStructure(h, ev, dmg * 0.45); toHero(dmg * 0.55); }
        else this.hitStructure(h, ev, dmg);
        break;
      }
    }
  }

  farmWave(h, amt) {
    const lane = this.lanes[h.ev.lane];
    const fm = sm(0.05, h, 'farm');
    lane.farm[h.team] += amt * (sm(0.04, h, 'farm'));
    const gold = Math.round(amt * 0.32 * fm);
    const cs = Math.max(1, Math.round(amt / 45));
    h.cs += cs;
    this.addGold(h, gold);
    this.gainXp(h, Math.round(amt * 0.12));
    this.ui.projectileTo(h, { kind: 'wave', ev: h.ev }, '#ff5468');
    this.ui.float(h, `+${gold}💰`, '#ffc93c', true);
  }

  hitNpc(h, ev, amt) {
    const npc = ev.npc;
    if (!npc || npc.hp <= 0) return;
    const mul = h.def.passive.npcMul || 1;
    const d = Math.round(amt * mul);
    npc.hp -= d;
    h.dmg += d;
    this.ui.projectileTo(h, { kind: 'npc', ev }, '#ff5468');
    this.ui.npcHit(ev, d);
    if (npc.hp <= 0) {
      let taker = h;
      if (npc.kind === 'dragon' || npc.kind === 'baron') {
        const foes = ev.sides[h.enemyTeam].filter(x => x.alive);
        if (foes.length) {
          const clutch = x => sd(x, 'rea') + 0.5 * sd(x, 'calm');
          const best = U.maxBy(foes, clutch);
          const own = Math.max(...this.alliesIn(h).map(clutch));
          if (U.chance(U.clamp(0.12 + 0.03 * (clutch(best) - own), 0.02, 0.55))) {
            taker = best;
            this.ui.log(`🫳 ${this.tag(best)} перехватывает последний удар у ${this.tag(h)} — эпик украден! (Реакция)`, best.team);
            this.ui.banner('КРАЖА!', `${best.nick} забирает последний удар`, best.team, true);
            for (const x of this.alliesIn(h)) this.tryTilt(x, 1, 'украденного эпика');
          }
        }
      }
      this.npcKilled(taker, ev);
    }
  }

  hitStructure(h, ev, amt) {
    const st = ev.structure;
    const tm = this.teams[st.team];
    const baron = this.teams[h.team].baron > 0 ? 1.8 : 1;
    const d = Math.round(amt * 0.9 * baron * (1 + h.itemStat('towerPow')));
    h.dmg += d; h.sdmg += d;
    this.ui.projectileTo(h, { kind: 'structure', ev }, '#ffd166');
    this.ui.npcHit(ev, d);
    this.damageStructure(st.team, st.lane, st.idx, d, h);
  }

  damageStructure(team, lane, idx, d, by) {
    const tm = this.teams[team];
    if (idx === 3) {
      tm.nexus = Math.max(0, tm.nexus - d);
      if (tm.nexus <= 0 && !this.over) this.finish(this.enemyOf(team));
      return;
    }
    if (tm.towers[lane][idx] <= 0) return;
    tm.towers[lane][idx] = Math.max(0, tm.towers[lane][idx] - d);
    if (tm.towers[lane][idx] <= 0) {
      const other = this.teams[this.enemyOf(team)];
      for (const x of other.heroes) this.addGold(x, 120);
      const names = ['внешняя', 'внутренняя', 'башня ингибитора'];
      this.ui.log(`🏰 Пала ${names[idx]} ${idx < 2 ? 'башня' : ''} ${tm.name.toLowerCase()} на линии <b>${lane.toUpperCase()}</b>${by ? ` — добил ${this.tag(by)}` : ''}. +120💰 всей команде.`, this.enemyOf(team));
      sfx('tower');
      this.ui.banner('БАШНЯ РАЗРУШЕНА', `${other.name} разрушают ${lane.toUpperCase()} · ${['T1', 'T2', 'T3'][idx]}`, this.enemyOf(team));
      if (by) this.gainXp(by, 80);
      for (const x of tm.heroes) if (x.lane === lane && x.alive) this.tryTilt(x, 1, 'потери башни');
    }
  }

  npcKilled(h, ev) {
    const npc = ev.npc;
    const tm = this.teams[h.team];
    if (npc.kind === 'camp') {
      const gm = h.def.passive.campGold || 1;
      const gold = Math.round(npc.gold * gm * (sm(0.05, h, 'farm')));
      this.addGold(h, gold); this.gainXp(h, npc.xp); h.cs += 4;
      h.gank += 8;
      this.ui.float(h, `${npc.icon} +${gold}💰`, '#ffc93c');
      ev.npc = this.newCamp(h);
    } else if (npc.kind === 'dragon') {
      npc.alive = false; npc.hp = 0;
      const type = npc.type;
      tm.dragons.push(type.id);
      for (const x of ev.sides[h.team]) if (x.alive) x.obj++;
      this.ui.log(`🐉 ${this.tag(h)} добивает: <b>${type.name}</b> достаётся команде ${tm.name}! (${type.buff})`, h.team);
      sfx('roar');
      this.ui.banner(`${type.icon} ${type.name.toUpperCase()}`, `${tm.name} получают: ${type.buff}`, h.team);
      for (const x of tm.heroes) { this.addGold(x, 60); this.gainXp(x, 60); }
      if (tm.dragons.length === 4 && !tm.soul) {
        tm.soul = type.id;
        this.ui.banner('ДУША ДРАКОНА', `${tm.name}: ${type.soul}`, h.team);
        this.ui.log(`✨ ${tm.name} получают <b>душу дракона</b>: ${type.soul}`, h.team);
      }
      this.dragonQueue.push(this.dragonQueue.shift());
      npc.type = this.dragonQueue[0];
      npc.spawnAt = this.minute + 5;
      tm.pressure = 0;
      ev.done = true;
    } else if (npc.kind === 'baron') {
      npc.alive = false; npc.hp = 0;
      tm.baron = 4;
      for (const x of ev.sides[h.team]) if (x.alive) x.obj += 2;
      npc.spawnAt = this.minute + 7;
      for (const x of tm.heroes) { this.addGold(x, 300); this.gainXp(x, 150); }
      this.ui.log(`👾 ${this.tag(h)} добивает <b>Барона</b>! ${tm.name} усиливают осаду на 4 минуты, +300💰 каждому.`, h.team);
      sfx('roar');
      this.ui.banner('👾 БАРОН ПОВЕРЖЕН', `${tm.name} получают Длань Барона`, h.team);
      tm.pressure = 0;
      tm.momentum = Math.max(tm.momentum, 2);
      ev.done = true;
    }
  }

  newCamp(h) {
    const camps = [
      { name: 'Каменные големы', icon: '🪨' }, { name: 'Волчья стая', icon: '🐺' }, { name: 'Призрачные вороны', icon: '🐦' },
      { name: 'Синий страж', icon: '💠' }, { name: 'Красный страж', icon: '🔴' }, { name: 'Жабоглот', icon: '🐸' },
    ];
    const c = U.pick(camps);
    const hp = Math.round(170 + this.minute * 32);
    return { kind: 'camp', name: c.name, icon: c.icon, hp, max: hp, atk: 14 + this.minute * 3.2, gold: 80 + this.minute * 3, xp: 70 + this.minute * 4 };
  }

  /* ---------------- Бой ---------------- */
  dealDamage(src, tgt, amt, kind = 'phys') {
    if (!tgt || !tgt.alive || amt <= 0) return 0;
    let arm = (tgt.armor + this.teamBuffs(tgt.team).arm) * (1 - Math.min(0.6, src ? src.itemStat('pen') : 0));
    if (kind === 'magic') arm *= 0.5;
    if (kind === 'true') arm = 0;
    let d = amt * HERO_DMG * 100 / (100 + arm) * (1 + 0.008 * Math.max(0, sd(tgt, 'agr')));
    const ev = tgt.ev;
    // Карта: осведомлённость (позиционирование) снижает получаемый урон, особенно когда бой начал враг
    const ambushed = ev && ev.att && ev.att !== tgt.team && (ev.type === 'gank' || ev.type === 'dragon' || ev.type === 'baron' || ev.type === 'siege');
    d *= U.clamp(1 - (ambushed ? 0.02 : 0.01) * sd(tgt, 'map'), 0.3, 1.7);
    const abs = Math.min(tgt.shield, d);
    tgt.shield -= abs; d -= abs;
    tgt.hp -= d;
    if (src) src.dmg += d + abs;
    const th = kind === 'phys' && src && src !== tgt ? tgt.itemStat('thorns') : 0;
    if (th > 0 && src.alive) { src.hp -= (d + abs) * th; tgt.dmg += (d + abs) * th; if (src.hp <= 0) this.kill(tgt, src); }
    this.ui.damage(tgt, Math.round(d + abs), abs > 0 && d < 1);
    if (tgt.hp <= 0) this.kill(src, tgt);
    return d + abs;
  }

  dodges(src, tgt) {
    if (!src || !tgt || src.team === tgt.team) return false;
    const ok = U.chance(U.clamp(0.06 + 0.025 * (sd(tgt, 'rea') - sd(src, 'mech')) + tgt.itemStat('dodge'), 0, 0.55));
    if (ok) { this.ui.float(tgt, 'УВОРОТ!', '#9fe8ff'); tgt.dodged = (tgt.dodged || 0) + 1; }
    return ok;
  }
  async skillDamage(src, tgt, amt, kind, color) {
    if (!tgt || !tgt.alive) return 0;
    this.ui.projectile(src, tgt, color || '#fff', true);
    await wait(380);
    if (this.dodges(src, tgt)) amt *= 0.5;
    return this.dealDamage(src, tgt, amt, kind);
  }

  healHero(src, tgt, amt, quiet) {
    if (!tgt.alive || amt <= 0) return;
    if (src !== tgt) amt *= sm(0.08, src, 'team');
    const before = tgt.hp;
    tgt.hp = Math.min(tgt.maxHp, tgt.hp + amt);
    const d = tgt.hp - before;
    src.healed += d;
    if (d >= 1) {
      if (d > 30) sfx('heal');
      if (src !== tgt) this.ui.projectile(src, tgt, '#45e07a');
      this.ui.float(tgt, `+${Math.round(d)}`, '#45e07a');
    }
  }
  shieldHero(src, tgt, amt, quiet) {
    if (!tgt.alive || amt <= 0) return;
    if (src !== tgt) amt *= sm(0.08, src, 'team');
    tgt.shield = Math.min(tgt.maxHp * 0.7, tgt.shield + amt);
    src.shielded = (src.shielded || 0) + amt;
    if (amt > 30) sfx('shield');
    if (src !== tgt) this.ui.projectile(src, tgt, '#4ea8ff');
    this.ui.float(tgt, `🛡${Math.round(amt)}`, '#4ea8ff');
  }
  addMana(h, amt, quiet) {
    h.mana = Math.min(h.maxMana, h.mana + amt);
    if (!quiet) this.ui.float(h, `+${Math.round(amt)} маны`, '#3fe0f0');
    else this.ui.burstTo(h, 'mana', '#3fe0f0');
  }
  addGold(h, amt) { h.gold += amt; h.totalGold += amt; }
  stun(src, tgt) {
    if (!tgt.alive) return;
    tgt.stunned = 1;
    sfx('stun');
    this.ui.float(tgt, 'ОГЛУШЕНИЕ', '#ffe066');
  }

  gainXp(h, x) {
    if (!h.alive && x < 50) return;
    h.xp += x;
    while (h.lvl < 18 && h.xp >= XP_NEED(h.lvl)) {
      h.xp -= XP_NEED(h.lvl);
      h.lvl++;
      const hpBefore = h.maxHp;
      h.recalc();
      h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - hpBefore));
      this.ui.levelUp(h);
      if (h.lvl === 6) this.ui.log(`${this.tag(h)} достигает 6 уровня — открыта ульта <b>${h.def.r.icon} ${h.def.r.name}</b>!`);
    }
  }

  vision(h, v, c) {
    const tm = this.teams[h.team];
    v *= sm(0.05, h, 'map');
    h.vis = (h.vis || 0) + v;
    tm.pressure += v * 2.2;
    const lane = h.ev.lane || h.lane;
    if (lane && this.lanes[lane]) this.lanes[lane].ward[h.team] += v * 0.55;
    if (h.role === 'jng') { h.gank += v * 12 * c.gankMul; tm.river += v * 0.5; }
    if (h.role === 'sup' || h.role === 'mid') tm.river += v * 0.45;
    this.ui.burstTo(h, 'vision', '#b86bff');
  }

  kill(src, tgt) {
    if (tgt.dead > 0) return;
    tgt.hp = 0; tgt.shield = 0;
    tgt.dead = 2 + Math.floor(tgt.lvl / 6) + (this.minute >= 28 ? 1 : 0);
    const victimStreak = tgt.streak;
    tgt.d++; tgt.streak = 0; tgt.stunned = 0;
    const ev = tgt.ev;
    if (ev && src && src.team !== tgt.team) { ev.kills = ev.kills || { blue: 0, red: 0 }; ev.kills[src.team]++; }
    if (!src || src.team === tgt.team) { this.ui.log(`☠ ${this.tag(tgt)} погибает.`); this.ui.killFeed(null, tgt); this.tryTilt(tgt, 1, 'гибели'); return; }
    src.k++; src.streak++;
    const tm = this.teams[src.team];
    tm.kills++;
    // награда: серия жертвы и «камбэк» отстающей команды
    const goldDiff = U.sum(this.teams[tgt.team].heroes, x => x.totalGold) - U.sum(tm.heroes, x => x.totalGold);
    let bounty = 250 + Math.min(350, Math.max(0, victimStreak - 1) * 70) + (goldDiff > 1200 ? 200 : 0);
    if (victimStreak >= 3) this.ui.log(`💥 ${this.tag(src)} прерывает серию ${this.tag(tgt)}!`, src.team);
    if (!this.firstBlood) { this.firstBlood = true; bounty += 100; this.ui.banner('ПЕРВАЯ КРОВЬ', `${src.name} убивает ${tgt.name}`, src.team); }
    this.addGold(src, bounty); this.gainXp(src, 100 + tgt.lvl * 12);
    const assists = (ev && ev.sides ? ev.sides[src.team] : []).filter(x => x !== src && x.alive);
    for (const a of assists) { a.a++; this.addGold(a, Math.round(120 * (sm(0.04, a, 'team')))); this.gainXp(a, 50 + tgt.lvl * 6); this.calmDown(a); }
    this.calmDown(src);
    this.tryTilt(tgt, assists.length ? 1 : 2, 'гибели');
    // мультикиллы за раунд
    src.mem.roundKills = (src.mem.roundKillsRound === this.round ? src.mem.roundKills : 0) + 1;
    src.mem.roundKillsRound = this.round;
    const mk = ['', '', 'ДВОЙНОЕ УБИЙСТВО', 'ТРОЙНОЕ УБИЙСТВО', 'ЧЕТВЕРНОЕ УБИЙСТВО', 'ПЕНТАКИЛЛ!'][Math.min(5, src.mem.roundKills)];
    if (mk) this.ui.banner(mk, src.name, src.team);
    else if (src.streak === 3) this.ui.banner('СЕРИЯ УБИЙСТВ', `${src.name} неудержим`, src.team);
    this.ui.killFeed(src, tgt);
    this.ui.log(`⚔ ${this.tag(src)} убивает ${this.tag(tgt)} (+${bounty}💰)${assists.length ? ', помощь: ' + assists.map(a => this.tag(a)).join(', ') : ''}.`, src.team);
  }

  tag(h) { return `<span class="tag ${h.team}">${h.def.emoji} ${h.nick}</span>`; }

  /* ---------------- Сигналы (одинаковы для ИИ и человека) ---------------- */
  signal(from, type, data = {}) {
    if (!from || !from.alive || (from.mem.sigCd || 0) > this.round) return null;
    from.mem.sigCd = this.round + 2;
    const sig = { id: this.signals.length + 1, type, from, team: from.team, data, round: this.round, answers: [] };
    this.signals.push(sig);
    from.signals = (from.signals || 0) + 1;
    return sig;
  }
  humanSignal(h, type, data = {}) { (this.humanQueue = this.humanQueue || []).push({ h, type, data }); }
  answer(sig, h) {
    // человек отвечает через интерфейс; если ответа ещё нет (null), он считается «позже» и прибывает на минуту позже
    let r = (h.ctrl !== 'ai' && this.ui.askSignal) ? this.ui.askSignal(h, sig) : AI.respondSignal(this, h, sig);
    // молчание на «Отступаем» — уходит сразу (безопаснее), на остальные сигналы — «позже»
    if (!r) r = sig.type === 'retreat' ? { accept: true, fast: true, pending: true } : { accept: true, fast: false, pending: true };
    sig.answers.push(Object.assign({ h }, r));
    if (r.accept) h.answered = (h.answered || 0) + 1;
    return r;
  }
  signalLabel(sig) {
    return { obj: sig.data.kind === 'baron' ? '👾 Сбор на Барона!' : '🐉 Сбор на Дракона!', help: '⚡ Помогите!', push: `🎯 Давим ${String(sig.data.lane || '').toUpperCase()}!`, retreat: '⛔ Отступаем!' }[sig.type];
  }
  announce(sig) {
    const a = sig.answers.map(x => `<span class="nw">${this.tag(x.h)} ${x.accept ? (x.fast ? '✔' : '⏳') : '✖'}</span>`).join(' ');
    this.ui.log(`📣 ${this.tag(sig.from)}: «${this.signalLabel(sig)}»${a ? ' — ' + a : ''}`, sig.team);
    this.ui.signal(sig);
  }

  /* ---------------- Тильт ---------------- */
  tryTilt(h, amount, why) {
    const chance = U.clamp(0.45 - 0.035 * sd(h, 'calm'), 0.05, 0.9);
    if (!U.chance(chance)) return;
    const before = h.tilt;
    h.tilt = Math.min(3, h.tilt + amount);
    h.mem.tiltAt = this.round;
    if (h.tilt > before) { this.ui.tilt(h); this.ui.log(`😤 ${this.tag(h)} тильтует после ${why} (−${h.tilt} к Механике, Реакции и Чтению игры, +${h.tilt} к Агрессии).`); }
  }
  calmDown(h) { if (h.tilt > 0) { h.tilt--; h.mem.tiltAt = this.round; if (!h.tilt) this.ui.log(`😌 ${this.tag(h)} успокаивается.`); this.ui.tilt(h); } }

  finish(winner) {
    if (this.over) return;
    this.over = true;
    this.winner = winner;
    sfx('victory');
    this.ui.log(`🏆 <b>${this.teams[winner].name} уничтожают Нексус и побеждают!</b>`, winner);
  }

  /* ---------------- Режиссёр событий ---------------- */
  mkEv(type, o = {}) {
    const ev = Object.assign({ id: this.evSeq++, type, sides: { blue: [], red: [] }, kills: { blue: 0, red: 0 }, left: 1, rounds: 0 }, o);
    this.events.push(ev);
    return ev;
  }
  join(ev, h) { if (!ev.sides[h.team].includes(h)) ev.sides[h.team].push(h); h.ev = ev; }
  free(h) { return h.alive && !h.ev; }

  assignEvents() {
    this.events = [];
    for (const h of this.heroes) h.ev = null;
    // 1. Погибшие
    for (const h of this.heroes) if (!h.alive) { h.ev = this.mkEv('dead', { lane: null }); h.ev.sides[h.team].push(h); }

    // 2. Продолжающиеся события
    const keep = [];
    for (const ev of this.persist) {
      if (ev.done || ev.left <= 0) continue;
      // откликнувшиеся «позже» прибывают на минуту позже
      for (const x of ev.late || []) if (x.alive && !x.ev && x.hp / x.maxHp > 0.25 && !ev.sides[x.team].includes(x)) ev.sides[x.team].push(x);
      ev.late = [];
      for (const t of ['blue', 'red']) ev.sides[t] = ev.sides[t].filter(x => x.alive && !x.ev && x.hp / x.maxHp > 0.12);
      // сигнал «Отступаем», если команда в событии явно проигрывает
      for (const t of ['blue', 'red']) {
        const own = ev.sides[t], foe = ev.sides[this.enemyOf(t)];
        if (!own.length || !foe.length) continue;
        const avgHp = U.sum(own, x => x.hp / x.maxHp) / own.length;
        if (own.length < foe.length - 1 || (avgHp < 0.35 && own.length <= foe.length)) {
          const sig = this.signal(U.maxBy(own, x => sd(x, 'team') + U.rand(2)), 'retreat', { ev: ev.id });
          if (!sig) continue;
          const leave = [sig.from];
          for (const x of own) if (x !== sig.from) { const r = this.answer(sig, x); if (r.accept && r.fast) leave.push(x); }
          ev.sides[t] = own.filter(x => !leave.includes(x));
          this.announce(sig);
        }
      }
      const att = ev.sides[ev.att], def = ev.sides[this.enemyOf(ev.att)];
      let ok = att.length > 0;
      if (ev.type === 'gank') ok = ok && def.length > 0;
      if (ev.type === 'dragon' || ev.type === 'baron') ok = ok && ev.npc.alive;
      if (ev.type === 'siege') ok = ok && this.structureAlive(ev.structure);
      if (!ok) { this.endPersist(ev); continue; }
      this.events.push(ev);
      for (const t of ['blue', 'red']) for (const x of ev.sides[t]) x.ev = ev;
      keep.push(ev);
    }
    this.persist = keep;

    // 3. Возврат на базу
    for (const h of this.heroes) {
      if (!this.free(h)) continue;
      const hpR = h.hp / h.maxHp;
      const rich = h.gold >= AI.shopTarget(this, h) && (hpR < 0.92 || U.chance(0.5));
      if (hpR < 0.3 - 0.01 * sd(h, 'agr') || h.mana < 20 && hpR < 0.6 || rich) {
        h.ev = this.mkEv('recall', { lane: null }); h.ev.sides[h.team].push(h);
      }
    }

    // 4. Натиск после выигранной драки / Барона
    for (const t of ['blue', 'red']) {
      const tm = this.teams[t];
      if (tm.momentum <= 0) continue;
      const crew = tm.heroes.filter(h => this.free(h) && h.hp / h.maxHp > 0.35);
      if (crew.length < 3) continue;
      const lane = this.bestSiegeLane(this.enemyOf(t));
      const st = this.structureFor(this.enemyOf(t), lane);
      if (!st) continue;
      const ev = this.mkEv('siege', { lane, att: t, structure: st, left: 2, team: true });
      crew.forEach(h => this.join(ev, h));
      for (const d of this.teams[this.enemyOf(t)].heroes) if (this.free(d) && U.chance(0.75)) this.join(ev, d);
      this.persist.push(ev);
      this.ui.log(`🚩 ${tm.name} собираются в натиск на <b>${lane.toUpperCase()}</b>!`, t);
    }

    // 4a. Сигналы, отправленные человеком (тем же механизмом, что и у ИИ)
    for (const q of (this.humanQueue || []).splice(0)) {
      if (q.type === 'obj') { const npc = q.data.kind === 'baron' ? this.baron : this.dragon; const sig = this.signal(q.h, 'obj', { kind: npc.kind }); if (sig) { this.teams[q.h.team].pressure += 10 * sm(0.05, q.h, 'team'); for (const x of this.teams[q.h.team].heroes) if (x !== q.h && this.free(x)) { const r = this.answer(sig, x); if (r.accept) x.mem.call = { kind: npc.kind, fast: r.fast, round: this.round }; } this.announce(sig); } }
    }

    // 4b. Сигнал «Давим линию»: соперники по линии мертвы, башня стоит
    for (const t of ['blue', 'red']) {
      for (const l of LANES) {
        const mine = this.teams[t].heroes.filter(h => this.free(h) && h.lane === l);
        const foes = this.teams[this.enemyOf(t)].heroes.filter(h => h.lane === l);
        if (!mine.length || !foes.length || foes.some(f => f.alive)) continue;
        const st = this.structureFor(this.enemyOf(t), l);
        if (st.idx === 3 && !this.nexusOpen(this.enemyOf(t))) continue;
        const sig = this.signal(mine[0], 'push', { lane: l });
        if (!sig) continue;
        const ev = this.mkEv('siege', { lane: l, att: t, structure: st, left: 2, late: [] });
        mine.forEach(h => this.join(ev, h));
        for (const x of this.teams[t].heroes) {
          if (!this.free(x) || x.lane === l) continue;
          const r = this.answer(sig, x);
          if (r.accept) r.fast ? this.join(ev, x) : ev.late.push(x);
        }
        this.persist.push(ev);
        this.announce(sig);
        break;
      }
    }

    // 5. Эпические монстры
    for (const [npc, thr] of [[this.dragon, 100], [this.baron, 150]]) {
      if (!npc.alive || this.minute < npc.retryAt || this.persist.some(e => e.type === npc.kind)) continue;
      for (const t of ['blue', 'red']) {
        const tm = this.teams[t];
        if (tm.pressure < thr * 0.75) continue;
        const callers = ['jng', 'sup', 'mid'].map(r => this.hero(t, r)).filter(h => this.free(h));
        if (!callers.length) continue;
        const sig = this.signal(U.maxBy(callers, x => sd(x, 'map') + U.rand(2)), 'obj', { kind: npc.kind });
        if (!sig) continue;
        tm.pressure += 10 * (sm(0.05, sig.from, 'team'));
        for (const x of tm.heroes) if (x !== sig.from && this.free(x)) { const r = this.answer(sig, x); if (r.accept) x.mem.call = { kind: npc.kind, fast: r.fast, round: this.round }; }
        this.announce(sig);
      }
    }
    if (!this.persist.some(e => e.type === 'dragon') && this.dragon.alive) this.tryObjective(this.dragon, 100, ['jng', 'adc', 'sup', 'mid']);
    if (!this.persist.some(e => e.type === 'baron') && this.baron.alive) this.tryObjective(this.baron, 150, ['jng', 'adc', 'sup', 'mid', 'top']);

    // 6. Ганги
    for (const t of U.shuffle(['blue', 'red'])) {
      const j = this.hero(t, 'jng');
      if (this.free(j) && j.gank >= 100) this.startGank(j);
    }

    // 7. Обычные занятия: линии, лес, свободная осада
    for (const l of LANES) {
      const present = { blue: [], red: [] };
      for (const h of this.heroes) if (this.free(h) && h.lane === l) present[h.team].push(h);
      if (!present.blue.length && !present.red.length) continue;
      if (present.blue.length && present.red.length) {
        const ev = this.mkEv('lane', { lane: l });
        [...present.blue, ...present.red].forEach(h => this.join(ev, h));
      } else {
        const t = present.blue.length ? 'blue' : 'red';
        const st = this.structureFor(this.enemyOf(t), l);
        const pushT = t === 'blue' ? this.lanes[l].push : -this.lanes[l].push;
        if (st && pushT > -0.2) {
          const ev = this.mkEv('siege', { lane: l, att: t, structure: st });
          present[t].forEach(h => this.join(ev, h));
        } else {
          const ev = this.mkEv('lane', { lane: l });
          present[t].forEach(h => this.join(ev, h));
        }
      }
    }
    for (const t of ['blue', 'red']) {
      const j = this.hero(t, 'jng');
      if (this.free(j)) {
        const ev = this.mkEv('jungle', { lane: null, npc: j.mem.camp && j.mem.camp.hp > 0 ? j.mem.camp : this.newCamp(j), spot: U.ri(4) });
        j.mem.camp = ev.npc;
        this.join(ev, j);
      }
    }
    // защита от «висящих» героев
    for (const h of this.heroes) if (!h.ev) { const ev = this.mkEv('jungle', { npc: this.newCamp(h), spot: U.ri(4) }); this.join(ev, h); }
    for (const h of this.heroes) if (h.ev.type === 'jungle' && h.role === 'jng') h.mem.camp = h.ev.npc;
    // пометить защитников при осаде
    for (const ev of this.events) {
      if (ev.type === 'siege') ev.defType = 'defend';
    }
  }

  tryObjective(npc, threshold, roles) {
    const isBaron = npc.kind === 'baron';
    if (this.minute < npc.retryAt) return;
    const order = ['blue', 'red'].sort((a, b) => this.teams[b].pressure - this.teams[a].pressure);
    for (const t of order) {
      const tm = this.teams[t];
      if (tm.pressure < threshold) continue;
      const called = x => x.mem.call && x.mem.call.kind === npc.kind && x.mem.call.round === this.round;
      const crew = tm.heroes.filter(h => this.free(h) && h.hp / h.maxHp > 0.4 && (roles.includes(h.role) && !called(h) || called(h) && h.mem.call.fast));
      if (crew.length < (isBaron ? 3 : 2)) continue;
      // Командное мышление «капитана» (лучший по этому параметру в составе): начинать бой за эпика только когда это выгодно
      const caller = U.maxBy(crew, x => iqOf(x, 'team'));
      if (U.chance(U.clamp((iqOf(caller, 'team') - 2) / 14, 0, 1))) {
        const foes = this.teams[this.enemyOf(t)].heroes.filter(x => x.alive);
        const avgHp = U.sum(crew, x => x.hp / x.maxHp) / crew.length;
        if (tm.heroes.filter(x => x.alive).length < foes.length || avgHp < 0.55) continue;
      }
      const ev = this.mkEv(npc.kind, { lane: null, att: t, npc, left: 4, dtype: npc.type, late: tm.heroes.filter(h => this.free(h) && called(h) && !h.mem.call.fast) });
      crew.forEach(h => this.join(ev, h));
      tm.pressure -= threshold * 0.7;
      const et = this.enemyOf(t);
      const etm = this.teams[et];
      const mapE = U.sum(etm.heroes, x => sd(x, 'map')) / 5, teamA = U.sum(crew, x => sd(x, 'team')) / crew.length;
      const contest = U.clamp(0.3 + (etm.river - tm.river) * 0.07 + (etm.pressure - tm.pressure * 0.5) / 300 + (isBaron ? 0.15 : 0) + 0.025 * (mapE - teamA), 0.05, 0.92);
      const spotted = U.chance(contest);
      if (spotted) {
        let defs = roles.map(r => this.hero(et, r)).filter(h => this.free(h) && h.hp / h.maxHp > 0.35);
        // Командное мышление защитников: не оспаривать эпика в явном меньшинстве
        const dc = defs.length ? U.maxBy(defs, x => iqOf(x, 'team')) : null;
        if (dc && U.chance(U.clamp((iqOf(dc, 'team') - 2) / 14, 0, 1)) && defs.length < crew.length - 1) defs = [];
        defs.forEach(h => this.join(ev, h));
        etm.river *= 0.5;
      }
      this.persist.push(ev);
      const nm = isBaron ? 'Барона' : npc.type.name.replace('дракон', 'дракона');
      this.ui.log(`${isBaron ? '👾' : '🐉'} ${tm.name} начинают бой за <b>${nm}</b>${spotted && ev.sides[et].length ? ` — ${etm.name} заметили это через обзор и оспаривают!` : ' — без сопротивления.'}`, t);
      this.ui.banner(isBaron ? 'БИТВА ЗА БАРОНА' : 'БИТВА ЗА ДРАКОНА', spotted && ev.sides[et].length ? 'Обе команды у логова!' : `${tm.name} начинают`, t, true);
      return;
    }
  }

  startGank(j) {
    const et = j.enemyTeam;
    const options = [];
    for (const l of LANES) {
      const victims = this.teams[et].heroes.filter(h => this.free(h) && h.lane === l);
      if (!victims.length) continue;
      const lane = this.lanes[l];
      const over = j.team === 'blue' ? -lane.push : lane.push; // враг продавил к нам — он «перетянут»
      const hurt = U.sum(victims, v => 1 - v.hp / v.maxHp) / victims.length;
      const score = 30 + hurt * 60 + over * 25 - lane.ward[et] * 6 + U.rand(15) - (victims.length - 1) * 8;
      options.push({ l, victims, score });
    }
    if (!options.length) return;
    // Командное мышление лесника: выбрать самую выгодную линию для ганга (слабый — почти наугад)
    const best = U.chance(U.clamp((iqOf(j, 'team') - 2) / 14, 0.05, 1)) ? U.maxBy(options, o => o.score) : U.pick(options);
    j.gank = 0;
    const lane = this.lanes[best.l];
    const ev = this.mkEv('gank', { lane: best.l, att: j.team, left: 2 });
    this.join(ev, j);
    this.heroes.filter(h => h.team === j.team && this.free(h) && h.lane === best.l).forEach(h => this.join(ev, h));
    best.victims.forEach(h => this.join(ev, h));
    const bestMap = Math.max(...best.victims.map(v => sd(v, 'map')));
    const spotChance = U.clamp(lane.ward[et] * 0.13 + 0.03 * (bestMap - sd(j, 'agr')), 0, 0.9);
    const spotted = U.chance(spotChance);
    let msg = `⚡ ${this.tag(j)} гангает <b>${best.l.toUpperCase()}</b>!`;
    if (spotted) {
      ev.left = 1;
      for (const v of best.victims) this.shieldHero(v, v, v.maxHp * 0.25);
      msg += ` Варды ${this.teams[et].name.toLowerCase()} раскрыли ганг — жертвы успели подготовиться (щит).`;
    }
    ev.late = [];
    const help = this.signal(best.victims[0], 'help', { lane: best.l });
    if (help) {
      for (const x of this.teams[et].heroes) {
        if (!this.free(x) || best.victims.includes(x)) continue;
        // гангу на другой линии быстрее всего помогает свой лесник и мидер
        if (!(x.role === 'jng' || x.role === 'mid' || x.lane === best.l)) continue;
        const r = this.answer(help, x);
        if (r.accept) { if (r.fast) { this.join(ev, x); msg += ` ${this.tag(x)} откликается на сигнал и прибегает на помощь!`; } else ev.late.push(x); }
      }
      this.announce(help);
    }
    const ej = this.hero(et, 'jng');
    if (this.free(ej) && !help && U.chance(spotted ? 0.65 : 0.15 + ej.gank / 250)) {
      this.join(ev, ej);
      ej.gank = Math.max(0, ej.gank - 40);
      msg += ` ${this.tag(ej)} прибегает с контр-гангом!`;
    }
    lane.ward[et] *= 0.4;
    this.persist.push(ev);
    this.ui.log(msg, j.team);
    sfx('gank');
    this.ui.banner('ГАНГ!', `${j.name} → ${best.l.toUpperCase()}`, j.team, true);
  }

  endPersist(ev) {
    if ((ev.type === 'dragon' || ev.type === 'baron') && ev.npc && ev.npc.alive) { ev.npc.retryAt = this.minute + 2; this.ui.log(`${ev.type === 'baron' ? '👾' : '🐉'} Попытка взять ${ev.type === 'baron' ? 'Барона' : 'Дракона'} сорвалась — команды отступают.`, 'sys'); }
    const t = ev.att;
    if (!t) return;
    const ka = ev.kills[t] || 0, kd = ev.kills[this.enemyOf(t)] || 0;
    if (ev.type !== 'siege' && Math.abs(ka - kd) >= 2) {
      const win = ka > kd ? t : this.enemyOf(t);
      this.teams[win].momentum = Math.max(this.teams[win].momentum, 2);
    }
  }

  bestSiegeLane(team) {
    return U.minBy(LANES, l => {
      const i = this.firstTower(team, l);
      return i < 0 ? -1000 : i * -400 + this.teams[team].towers[l][i];
    });
  }
  structureFor(team, lane) {
    const i = this.firstTower(team, lane);
    if (i >= 0) return { team, lane, idx: i };
    return { team, lane, idx: 3 };
  }
  structureAlive(st) {
    const tm = this.teams[st.team];
    if (st.idx === 3) return tm.nexus > 0;
    return tm.towers[st.lane][st.idx] > 0;
  }
  structureHp(st) {
    const tm = this.teams[st.team];
    return st.idx === 3 ? [tm.nexus, tm.nexusMax] : [tm.towers[st.lane][st.idx], TOWER_HP[st.idx]];
  }

  /* ---------------- Конец минуты ---------------- */
  async endRound() {
    this.active = null;
    this.ui.focus(null);
    // Ответный урон NPC и башен
    for (const ev of this.events) {
      const heroesIn = [...ev.sides.blue, ...ev.sides.red].filter(h => h.alive);
      if ((ev.type === 'jungle' || ev.type === 'dragon' || ev.type === 'baron') && ev.npc && ev.npc.hp > 0) {
        const tgts = heroesIn;
        const atk = ev.type === 'jungle' ? ev.npc.atk : ev.npc.atk;
        for (const h of tgts) { this.ui.projectileFrom({ kind: 'npc', ev }, h, ev.type === 'baron' ? '#b46bff' : '#ff6b3d'); this.dealDamage(null, h, atk * (ev.type === 'jungle' ? 1 : U.rand(0.6, 1)), 'phys'); }
      }
      if (ev.type === 'siege') {
        const st = ev.structure;
        if (this.structureAlive(st)) {
          const att = ev.sides[ev.att].filter(h => h.alive);
          if (att.length) {
            const lane = this.lanes[st.lane];
            const minions = (ev.att === 'blue' ? lane.push : -lane.push) > 0.3;
            const dmg = (90 + this.minute * 9) * (minions ? 0.5 : 1) * (st.idx === 3 ? 1.3 : 1);
            const v = U.pick(att);
            this.ui.projectileFrom({ kind: 'structure', ev }, v, '#ffe9a8');
            this.dealDamage(null, v, dmg, 'true');
          }
        }
      }
    }
    await wait(450);

    // Линии: толкание волн и урон миньонов по башням
    for (const l of LANES) {
      const lane = this.lanes[l];
      const diff = (lane.farm.blue - lane.farm.red) / 180;
      lane.push = U.clamp(lane.push * 0.8 + diff + (this.teams.blue.baron > 0 ? 0.35 : 0) - (this.teams.red.baron > 0 ? 0.35 : 0), -1, 1);
      lane.farm.blue = lane.farm.red = 0;
      for (const t of ['blue', 'red']) lane.ward[t] *= 0.65;
      for (const [t, sgn] of [['red', 1], ['blue', -1]]) {
        if (lane.push * sgn >= 0.7) {
          const st = this.structureFor(t, l);
          const att = this.enemyOf(t);
          if (st.idx === 3 && !this.nexusOpen(t)) continue;
          const dmg = (60 + this.minute * 6) * (this.teams[att].baron > 0 ? 2.5 : 1) * (this.minute > 30 ? 1.6 : 1);
          this.damageStructure(t, l, st.idx, dmg, null);
        }
      }
    }
    // Поздняя игра: супер-миньоны давят команду, у которой открыт Нексус
    for (const t of ['blue', 'red']) if (this.nexusOpen(t) && !this.over) this.damageStructure(t, null, 3, 40 + this.minute * 3, null);

    // Пассивный доход, регенерация, таймеры
    for (const h of this.heroes) {
      const tb = this.teamBuffs(h.team);
      if (h.alive) {
        this.addGold(h, 32);
        const passiveXp = (h.ev.type === 'lane' || h.ev.type === 'jungle') ? 55 : 35;
        this.gainXp(h, passiveXp);
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * (0.015 + tb.regen + h.itemStat('regen')));
        h.mana = Math.min(h.maxMana, h.mana + 6 + tb.mana + h.itemStat('manaRegen'));
        h.shield *= 0.55;
        if (h.ev.type === 'recall') this.atBase(h);
        if (h.role === 'jng' && h.ev.type === 'jungle') h.gank += Math.max(2, 8 + 0.8 * sd(h, 'agr'));
      } else {
        h.dead--;
        if (h.dead <= 0) { h.dead = 0; h.hp = h.maxHp; h.mana = h.maxMana; h.shield = 0; this.atBase(h, true); this.ui.log(`✨ ${this.tag(h)} возрождается на базе.`); }
      }
      if (h.tilt && this.round - (h.mem.tiltAt || 0) >= 2) this.calmDown(h);
      for (const k of ['q', 'r']) if (h.cd[k] > 0) h.cd[k]--;
      h.board.decayFog();
      if (h.stunned > 1) h.stunned = 1;
      if (h.ev && (h.ev.type === 'recall' || h.ev.type === 'dead')) h.stunned = 0;
    }
    for (const ev of this.persist) { ev.left--; ev.rounds++; if (ev.left <= 0) this.endPersist(ev); }
    this.persist = this.persist.filter(e => e.left > 0 && !e.done);
    for (const t of ['blue', 'red']) {
      const tm = this.teams[t];
      if (tm.momentum > 0) tm.momentum--;
      if (tm.baron > 0) { tm.baron--; if (!tm.baron) this.ui.log(`Длань Барона у команды ${tm.name} рассеялась.`, t); }
      tm.river *= 0.85;
      tm.pressure = Math.min(220, tm.pressure);
    }
    this.minute++;
    for (const npc of [this.dragon, this.baron]) {
      if (!npc.alive && this.minute >= npc.spawnAt) {
        npc.alive = true;
        if (npc.kind === 'dragon') {
          npc.max = npc.hp = Math.round(600 + this.minute * 60);
          npc.atk = 35 + this.minute * 4;
          if (this.teams.blue.soul || this.teams.red.soul) { npc.spawnAt = 999; npc.alive = false; continue; }
          this.ui.log(`🐉 Появился <b>${npc.type.name}</b>!`, 'sys');
        } else {
          npc.max = npc.hp = Math.round(1800 + this.minute * 80);
          npc.atk = 70 + this.minute * 6;
          this.ui.log(`👾 В логове пробудился <b>Барон</b>!`, 'sys');
          sfx('roar');
          this.ui.banner('БАРОН ПРОБУДИЛСЯ', 'Логово на верхней реке', 'sys');
        }
      }
    }
    this.ui.roundEnd(this);
    await wait(300);
  }

  atBase(h, respawn) {
    h.hp = h.maxHp; h.mana = h.maxMana;
    const acts = AI.shop(this, h);
    const bought = [], sold = [];
    for (const a of acts) {
      if (a.sell) { const i = h.items.indexOf(a.sell); if (i >= 0) { h.items.splice(i, 1); h.gold += a.refund; sold.push(a.sell); } }
      if (a.buy && h.gold >= ITEMS[a.buy].cost) { h.gold -= ITEMS[a.buy].cost; h.items.push(a.buy); bought.push(a.buy); }
    }
    // полный инвентарь и улучшать нечего — лишнее золото идёт на эликсиры силы
    while (h.items.length >= 6 && h.gold >= 600 && !acts.length) { h.gold -= 600; h.elix = (h.elix || 0) + 1; bought.push('elixir'); }
    if (bought.length || sold.length) {
      h.recalc();
      h.hp = h.maxHp;
      if (bought.length) this.ui.shop(h, bought);
      const nm = i => i === 'elixir' ? '🧪 Эликсир силы' : ITEMS[i].icon + ' ' + ITEMS[i].name;
      this.ui.log(`🛒 ${this.tag(h)} ${sold.length ? 'продаёт ' + sold.map(nm).join(', ') + ' и ' : ''}покупает: ${bought.map(nm).join(', ') || '—'}.`);
    }
  }

  /* ---------------- Операции с полями для умений ---------------- */
  async selfBoard(h, fn) {
    fn(h.board);
    h.board.glow = 1;
    await wait(420);
    await this.settle(h, true);
  }
  async selfBoardQuiet(h, fn) {
    fn(h.board);
    h.board.glow = 1;
    await wait(380);
  }
  async selfBoardRemove(h, keys) {
    const b = h.board;
    for (const k of keys) { const g = b.at(k); if (!g) continue; b.g[kr(k)][kc(k)] = null; b.dying.push({ g, r: kr(k), c: kc(k), t: 0 }); b.burst(kc(k), kr(k), GEM_COLORS[g.t], 6); }
    await wait(250);
    b.gravity();
    await wait(380);
    await this.settle(h, true);
  }
  async enemyBoard(src, tgt, fn, color) {
    if (!tgt || !tgt.alive) return;
    this.ui.projectile(src, tgt, color || '#fff', true);
    await wait(380);
    if (this.dodges(src, tgt)) { this.ui.log(`${this.tag(tgt)} успевает среагировать — умение ${this.tag(src)} не задевает его поле (Реакция).`); return; }
    this.ui.boardHit(tgt, color);
    fn(tgt.board);
    tgt.board.shake = 0.8;
    await wait(450);
    await this.settle(tgt, false);
  }
  async allyBoard(src, a, fn, color) {
    if (!a || !a.alive) return;
    if (a !== src) { this.ui.projectile(src, a, color || '#fff', true); await wait(320); }
    fn(a.board);
    a.board.glow = 1;
    this.ui.boardHit(a, color);
    await wait(400);
    await this.settle(a, true);
  }
}
