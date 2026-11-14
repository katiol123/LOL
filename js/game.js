'use strict';
/* Ядро матча: герои, события, бой, цели, башни */

const XP_NEED = l => 90 + 30 * l;
const TOWER_HP = [1100, 1600, 2000];
const NEXUS_HP = 3400;
const ATK_MUL = 2.6;
const HERO_DMG = 1.45;
/* Выстрел из барабана Шермана */
const G_SHOT = (G, h) => G.sp(h, 22, 0.25) + h.power * 0.7;
/* Свойства предметов, которые складываются от одинаковых предметов */
const ITEM_STACKING = new Set(['atk', 'arm', 'hp', 'sp', 'mana', 'crit', 'dodge']);
/* Стоимость волны миньонов за минуту (на одну команду): сколько золота вообще можно снять с линии */
const WAVE_GOLD = m => 90 + 5 * m;
/* Запас здоровья волны за минуту: сколько урона по ней вообще толкает линию */
const WAVE_HP = m => 170 + 14 * m;
/* Опыт волны за минуту (на одну команду) */
const WAVE_XP = m => 30 + 2 * m;
/* Умения стрелков слабее: их сила — в ⚔ и предметах */
const ADC_SKILL = 0.75;
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
    // состояния от новых умений: провокация, немота, якорь, отражение, накопления
    this.tauntBy = null; this.taunted = 0; this.silenced = 0; this.anchored = 0; this.reflect = 0; this.scrap = 0; this.souls = 0;
    this.lvl = 1; this.xp = 0;
    this.items = []; this.buildIdx = 0;
    this.gold = 500; this.totalGold = 500;
    this.k = 0; this.d = 0; this.a = 0; this.dmg = 0; this.healed = 0; this.cs = 0;
    this.cd = { q: 0, r: 0 };
    this.stunned = 0; this.dead = 0; this.ev = null; this.gank = 0; this.roam = 0; this.roams = 0; this.potions = 0;
    this.knocked = 0; this.unstoppable = 0; this.water = 0; this.tailUsed = false; this.stealth = 0; this.aim = null; this.duel = null; this.duelLeft = 0; this.oasis = 0;
    this.ammo = def.passive.ammo || 0;
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
  /* Свойства предметов. Обычные характеристики (атака, броня, здоровье, сила умений, мана) складываются всегда;
     особые эффекты двух одинаковых предметов не складываются — кроме шанса крита и уклонения */
  itemStat(k) {
    const list = ITEM_STACKING.has(k) ? this.items : [...new Set(this.items)];
    return U.sum(list, it => ITEMS[it][k] || 0) + (this.elix || 0) * (ELIXIR[k] || 0);
  }
  recalc() {
    const b = BASE_STATS[this.def.main || this.def.role], m = this.def.mod || {}, L = this.lvl - 1;
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round((b.hp + L * b.hpG) * (m.hp || 1) + this.itemStat('hp'));
    this.power = (b.atk + L * b.atkG) * (m.atk || 1) + this.itemStat('atk');
    this.armor = (b.arm + L * b.armG) * (m.arm || 1) + this.itemStat('arm');
    this.maxMana = Math.round(b.mana + L * 8 + this.itemStat('mana'));
    this.sp = (b.sp + L * b.spG) * (m.sp || 1) + this.itemStat('sp') + (this.souls || 0) * 8 * (1 + patchMod(this.def.id, 'p'));
    const sk = (this.scrap || 0) * (1 + patchMod(this.def.id, 'p')); this.armor += sk * 4; this.power += sk * 3;
    // правки баланса из патча кампании
    const pd = patchMod(this.def.id, 'stat');
    if (pd) { this.maxHp = Math.round(this.maxHp * (1 + pd)); this.power *= 1 + pd; this.sp *= 1 + pd; }
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
    // ручное управление: герой игрока-человека (в просмотре матча с интерфейсом)
    if (opts.human) for (const h of this.heroes) if (h.pl && h.pl.human) h.ctrl = 'human';
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
    let e = this.enemiesIn(h);
    if (!e.length) return null;
    // дуэль: дуэлянты бьют только друг друга, остальные их не трогают
    if (h.duel && h.duel.alive && e.includes(h.duel)) return h.duel;
    if (e.some(x => !x.duel)) e = e.filter(x => !x.duel || !x.duel.alive);
    // маскировка: невидим, пока рядом есть другие цели
    if (e.some(x => !(x.stealth > 0))) e = e.filter(x => !(x.stealth > 0));
    // приоритетная цель человека: достаётся с той же вероятностью «нырка», что и у ИИ, иначе удар принимает передовая
    if (h.ctrl === 'human' && !h.autopilot && h.prefTarget && e.includes(h.prefTarget) && e.length > 1 && !(h.taunted > 0 && h.tauntBy && h.tauntBy.alive && e.includes(h.tauntBy))) {
      const front = this.frontline(e);
      if (front === h.prefTarget) return front;
      const noFront = !e.some(x => x.def.tags.includes('tank'));
      return U.chance(this.diveChance(h, e)) ? h.prefTarget : front;
    }
    // провокация: пока действует, враг бьёт только провокатора
    if (h.taunted > 0 && h.tauntBy && h.tauntBy.alive && e.includes(h.tauntBy)) return h.tauntBy;
    if (e.length === 1) return e[0];
    // «Мстительный» бьёт своего последнего убийцу, «Охотник за фрагами» — самого раненого
    if (h.mem.killer && h.mem.killer.alive && e.includes(h.mem.killer) && hasPerk(h, 'vengeful')) return h.mem.killer;
    if (hasPerk(h, 'hunter')) return U.minBy(e, x => (x.hp + x.shield) / x.maxHp);
    const ev = h.ev;
    // Командное мышление: бить ту же цель, что и союзники (фокус)
    const f = ev && ev.focus && ev.focus[h.team];
    if (f && f.alive && e.includes(f) && U.chance(U.clamp((iqOf(h, 'team') - 3) / 14, 0, 0.95) * 0.6)) return f;
    // Тактика: иногда удаётся «нырнуть» за передовую и достать самого слабого (убийцам — чаще)
    // без передовой (ни одного танка у врага в бою) до хрупких бойцов добраться легко
    // Тактика решает, пытаться ли нырнуть к самому слабому; удастся ли — зависит только от ситуации (как и у человека)
    const tries = U.chance(U.clamp((iqOf(h, 'tactic') - 4) / 12, 0.05, 0.95));
    const weak = U.minBy(e, x => x.hp + x.shield);
    const t = tries && U.chance(this.diveChance(h, e)) ? weak : this.frontline(e);
    if (ev) { ev.focus = ev.focus || {}; if (!ev.focus[h.team] || !ev.focus[h.team].alive) ev.focus[h.team] = t; }
    return t;
  }
  /* Шанс пробиться за передовую к выбранной цели: убийцам легче, без танка у врага — намного легче */
  diveChance(h, e) {
    const noFront = !e.some(x => x.def.tags.includes('tank'));
    return 0.18 + (h.def.tags.includes('burst') ? 0.15 : 0) + (noFront ? 0.4 : 0);
  }
  /* Позиционка: удар принимает тот, у кого больше «текущее здоровье + бросок от 1 до X» (+ модификаторы позиции).
     Крепкие бойцы и танки идут вперёд и прикрывают союзников; стрелки держатся сзади. */
  frontline(e) {
    const X = 0.4 * U.sum(e, x => x.maxHp) / e.length;
    return U.maxBy(e, x => x.hp + x.shield * 0.5 + U.rand(1, X) + X * this.posMod(x));
  }
  posMod(x) {
    let m = 0;
    if (x.def.tags.includes('tank')) m += 0.5;
    if ((x.def.main || x.def.role) === 'adc') m -= 0.35;   // стрелок по натуре держится сзади, где бы ни стоял
    if (hasPerk(x, 'reckless')) m += 0.15;
    if (hasPerk(x, 'cautious')) m -= 0.15;
    return m;
  }
  /* Решение игрока-человека: те же варианты, что у ИИ в этой ситуации. Без интерфейса (или на автопилоте) — решение ИИ */
  async decide(h, q) {
    if (h.ctrl !== 'human' || !this.ui.decide || h.autopilot) return q.def;
    return this.ui.decide(h, q);
  }
  /* Уход с линии (на базу, в роум): умный тактик сначала дотолкает волну к вражеской башне —
     линия не теряет ни золото, ни башню; неумный уходит, когда волна давит на его башню */
  leaveLane(h, pushedFirst) {
    const L = this.lanes[h.lane];
    if (!L || !['top', 'mid', 'adc', 'sup'].includes(h.role)) return;
    const dir = h.team === 'blue' ? 1 : -1;
    // волна дотолкана — линия держится; ушёл, когда волна у своей башни, — она давит и бьёт по башне
    if (pushedFirst || dir * L.push > 0.15) return;
    L.push = U.clamp(L.push - dir * 0.3, -1, 1);
    // урон по башне — только если на линии есть живой вражеский лейнер (он и сносит); нексус не трогаем, башню не добиваем
    const foe = this.teams[h.enemyTeam].heroes.find(x => x.alive && x.lane === h.lane);
    const st = this.structureFor(h.team, h.lane);
    if (!foe || !st || st.idx === 3) return;
    const hp = this.teams[h.team].towers[h.lane][st.idx];
    const dmg = Math.min(60 + this.minute * 6, Math.max(0, hp - 1));
    if (dmg > 0) this.damageStructure(st.team, st.lane, st.idx, dmg, foe);
  }
  /* Давление на линии: перекачанный враг рядом мешает фармить — −12% за каждый уровень разницы (не ниже 40%).
     Отставший по уровню (проиграл линию, нет поддержки) с трудом отыгрывается фармом. */
  farmRate(h) {
    const ev = h.ev;
    if (!ev || !ev.sides || !['lane', 'siege'].includes(ev.type)) return 1;
    const foes = ev.sides[h.enemyTeam].filter(x => x.alive);
    if (!foes.length) return 1;
    const gap = Math.max(...foes.map(x => x.lvl)) - h.lvl;
    return gap > 0 ? Math.max(0.4, 1 - 0.12 * gap) : 1;
  }
  /* Числовое значение пассивки с учётом патча */
  pv(h, key) { return (h.def.passive[key] || 0) * (1 + patchMod(h.def.id, 'p')); }
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
    // стартовая закупка: дешёвый ответ на состав врага или зелья
    for (const h of this.heroes) {
      const { buy, potions } = AI.startShop(this, h);
      for (const id of buy) { h.gold -= ITEMS[id].cost; h.items.push(id); }
      h.potions = potions; h.gold -= potions * POTION.cost;
      if (buy.length) h.recalc(), h.hp = h.maxHp;
      const what = [...buy.map(i => ITEMS[i].icon + ' ' + ITEMS[i].name), potions ? `🧪×${potions}` : ''].filter(Boolean).join(', ');
      if (what) this.ui.log(`🛒 ${this.tag(h)} на старте берёт: ${what}${buy.length ? ' — ответ на состав соперника' : ''}.`);
    }
    while (!this.over) {
      this.round++;
      await this.assignEvents();
      this.ui.roundStart(this);
      await wait(500);
      // порядок ходов: чем выше Реакция, тем раньше герой ходит в минуте
      const order = this.heroes.slice().sort((a, b) => (sd(b, 'rea') + U.rand(2.5)) - (sd(a, 'rea') + U.rand(2.5)));
      for (const h of order) {
        if (this.over) break;
        await this.heroTurn(h);
        if (this.ui.afterTurn) this.ui.afterTurn();
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
    if (h.ctrl !== 'human' || h.autopilot || !this.ui.awaitHumanMove) return AI.chooseMove(this, h);
    return this.ui.awaitHumanMove(h);
  }

  async trySkills(h, after) {
    // человек выберет умение сам (точка входа интерфейса), ИИ — по своим правилам
    const key = h.ctrl === 'human' && !h.autopilot && this.ui.awaitHumanSkill ? await this.ui.awaitHumanSkill(h, after) : AI.chooseSkill(this, h, after);
    if (key) await this.castSkill(h, key);
  }

  canCast(h, key) {
    const s = h.def[key];
    if (!s || h.cd[key] > 0 || h.mana < s.cost || (s.lvl && h.lvl < s.lvl)) return false;
    if (!h.alive || h.ev.type === 'recall' || h.silenced > 0) return false;
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
    // стрелок силён автоатаками (⚔) и фармом, а не умениями — как в LoL
    if (key === 'q' && h.ev && h.def.id !== 'reptile') { h.ev.lastQ = h.ev.lastQ || {}; h.ev.lastQ[h.team] = h.def; }
    h.castMul = (1 + patchMod(h.def.id, key)) * ((h.def.main || h.def.role) === 'adc' ? ADC_SKILL : 1);
    try { await s.cast(this, h, t); } finally { h.castMul = 1; }
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
      // гнилые камни не дают эффекта; мины взрываются, когда их камень уходит с поля
      const mines = [], blooms = [];
      for (const k of st.clear) {
        const g = b.at(k); if (!g) continue;
        if (g.rot && g.t <= 5 && st.counts[g.t] > 0) st.counts[g.t]--;
        if (g.mine) mines.push(g.mine);
        if (g.bloom) blooms.push({ stage: g.bloom, by: g.bloomBy });
      }
      b.applyStep(st);
      this.stepSound(st, cascade);
      for (const m of mines) this.mineBlast(h, m);
      for (const bl of blooms) this.bloomBurst(h, bl);
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
    if (p.effects) {
      // правка пассивки в патче масштабирует её вклад
      const pm = patchMod(h.def.id, 'p');
      const NUM = ['lifesteal', 'gankMul', 'bombDmg', 'manaFlat', 'healAlly', 'shieldAlly', 'visShield'];
      const b0 = pm ? { m: Object.assign({}, c.m), n: NUM.map(k => c[k]) } : null;
      p.effects(this, h, c);
      if (pm) { for (const k in c.m) c.m[k] = b0.m[k] + (c.m[k] - b0.m[k]) * (1 + pm); NUM.forEach((k, i) => { c[k] = b0.n[i] + (c[k] - b0.n[i]) * (1 + pm); }); }
    }
    // правка умения в патче: камни, разряженные во время умения, тоже сильнее/слабее
    if (h.castMul && h.castMul !== 1) for (const k in c.m) c.m[k] *= h.castMul;
    // «Похоронный марш» (Ноктюрн): совпадения союзников в его событии копят куплеты, каждый усиливает их камни
    const bard = h.ev && h.ev.sides && h.ev.sides[h.team].find(x => x.alive && x.def.passive.march);
    if (bard) {
      bard.marchHits = (bard.marchHits || 0) + 1;
      if (bard.marchHits >= 3 && (bard.verses || 0) < 3) { bard.marchHits = 0; bard.verses = (bard.verses || 0) + 1; this.ui.float(bard, `🎻 куплет ${bard.verses}`, '#e0c3ff'); }
      for (const k in c.m) c.m[k] *= 1 + 0.05 * (1 + patchMod(bard.def.id, 'p')) * (bard.verses || 0);
    }
    const buff = this.teamBuffs(h.team);
    // Механика: каскады и общая точность; Хладнокровие: штраф под давлением
    const casc = 1 + 0.25 * info.cascade * (sm(0.04, h, 'mech')) * (1 + 4 * h.itemStat('cascPow')) * (hasPerk(h, 'combo') ? 1.1 : 1);
    const inFight = h.ev && h.ev.sides && this.enemiesIn(h).length > 0;
    const allies = this.alliesIn(h).length;
    const gm = (sm(0.012, h, 'mech')) * this.pressureFactor(h)
      * (inFight && this.persist.includes(h.ev) ? sm(0.012, h, 'calm') : 1)   // хладнокровие в затяжных боях
      * (allies >= 2 ? sm(0.012, h, 'team') : 1);                              // слаженность с союзниками
    for (const k in c.m) c.m[k] *= gm;
    if ((h.stealth > 0 && counts[T_ATK] > 0) || (info.atkRuns.some(l => l >= 4) && U.chance(U.clamp(0.1 + 0.02 * sd(h, 'mech') + h.itemStat('crit'), 0.01, 0.8)))) { c.m.atk *= 1.5; c.label = c.label || 'КРИТ!'; }
    // «Барабан на шесть»: каждое совпадение ⚔ — выстрел; пустой барабан — перезарядка вместо выстрела
    if (p.ammo && counts[T_ATK] > 0) {
      if (h.ammo > 0) { h.ammo--; c.bombDmg += G_SHOT(this, h); this.ui.float(h, `🔫 ${h.ammo}/6`, '#ffd36b', true); }
      else { h.ammo = p.ammo; this.ui.float(h, '🔫 перезарядка', '#aaa', true); }
    }
    // «Запас влаги»: ✚ при полном здоровье копят влагу
    if (p.water && counts[T_HEAL] > 0 && h.hp >= h.maxHp * 0.97) { h.water = Math.min(5, h.water + 1); this.ui.float(h, `💧 ${h.water}`, '#7bd3ff', true); }
    c.m.mana *= sm(0.045, h, 'read');
    c.m.gold *= sm(0.02, h, 'farm') * (1 + h.itemStat('goldPow'));
    const healPow = 1 + this.itemsOf(h, 'healPow');
    const shieldPow = 1 + this.itemsOf(h, 'shieldPow');
    const visPow = 1 + this.itemsOf(h, 'visPow');

    if (counts[T_ATK] > 0) {
      const dmg = counts[T_ATK] * h.power * ATK_MUL * c.m.atk * casc * buff.atk;
      if (c.label) this.ui.float(h, c.label, '#ff5468');
      // «Дальний выстрел» (Сыч): если врагов рядом нет, ещё треть урона летит в драку союзников
      const ls = p.longshot && !this.enemiesIn(h).length ? this.longShot(h, dmg * Math.min(0.6, this.pv(h, 'longshot'))) : 0;
      this.routeAttack(h, dmg, c);
    }
    // осколки: особые камни, взорванные рядом с врагами, бьют и по герою (на волне такой выгоды нет)
    if (info.acts > 0 && inFight && !h.knocked) { const t = this.target(h); if (t) { this.ui.projectile(h, t, '#ffb347'); this.dealDamage(h, t, info.acts * (h.power * 1.1 + h.sp * 0.25), 'phys'); } }
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
      const amt = Math.round(counts[T_GOLD] * 13 * c.m.gold * casc * this.farmRate(h));
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
      if (h.knocked > 0) return 0;   // отброшен: до героев не достаёт
      let t = this.target(h);
      if (h.aim && h.aim.round === this.round && h.aim.t.alive && enemies.includes(h.aim.t)) { t = h.aim.t; amt *= 2.5; h.aim = null; this.ui.float(h, '🎯 ВЫСТРЕЛ!', '#ffd36b'); }
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
    // волну можно убить только один раз: урон сверх её запаса здоровья линию дальше не толкает
    if (!lane.waveHp || lane.waveHp.round !== this.round) lane.waveHp = { round: this.round, blue: 0, red: 0 };
    const pushAdd = Math.max(0, Math.min(amt * (sm(0.04, h, 'farm')), WAVE_HP(this.minute) - lane.waveHp[h.team]));
    lane.waveHp[h.team] += pushAdd;
    lane.farm[h.team] += pushAdd;
    let gold = Math.round(amt * 0.32 * fm * (hasPerk(h, 'farmer') ? 1.2 : 1) * this.farmRate(h));
    // волна конечна: за минуту одна команда может снять с линии не больше её стоимости — двое на линии делят золото
    if (!lane.wave || lane.wave.round !== this.round) lane.wave = { round: this.round, blue: 0, red: 0 };
    // хороший фармер (точные добивания) снимает с волны больше
    const cap = WAVE_GOLD(this.minute) * (hasPerk(h, 'farmer') ? 1.1 : 1) * U.clamp(sm(0.04, h, 'farm'), 0.6, 1.6);
    gold = Math.max(0, Math.min(gold, Math.round(cap - lane.wave[h.team])));
    lane.wave[h.team] += gold;
    const cs = Math.max(1, Math.round(amt / 45));
    h.cs += cs;
    this.addGold(h, gold);
    // опыт волны тоже конечен: команда на линии делит его между собой
    if (!lane.waveXp || lane.waveXp.round !== this.round) lane.waveXp = { round: this.round, blue: 0, red: 0 };
    const xp = Math.max(0, Math.min(Math.round(amt * 0.12), Math.round(WAVE_XP(this.minute) - lane.waveXp[h.team])));
    lane.waveXp[h.team] += xp;
    this.gainXp(h, xp);
    this.ui.projectileTo(h, { kind: 'wave', ev: h.ev }, '#ff5468');
    if (gold > 0) this.ui.float(h, `+${gold}💰`, '#ffc93c', true);
  }

  hitNpc(h, ev, amt) {
    const npc = ev.npc;
    if (!npc || npc.hp <= 0) return;
    const mul = 1 + ((h.def.passive.npcMul || 1) - 1) * (1 + patchMod(h.def.id, 'p'));
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
            this.ui.log(`✋ ${this.tag(best)} перехватывает последний удар у ${this.tag(h)} — эпик украден! (Реакция)`, best.team);
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
    // башню в основном сносит волна: важно, сколько ⚔ собрано и каков уровень, а не атака героя (её место — бой)
    const ref = 15 + 2.3 * (h.lvl - 1) + U.sum(h.items, it => ITEMS[it].atk || 0) * 0.6;
    // пока враги мертвы, защищать башни некому: каждый павший защитник ускоряет снос на 50%
    const deadFoes = tm.heroes.filter(x => !x.alive).length;
    const d = Math.round(amt * (ref / Math.max(1, h.power)) * 0.9 * baron * (1 + 0.5 * deadFoes) * (1 + h.itemStat('towerPow')));
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
    if (h.def.passive.scrap) { h.scrap++; h.recalc(); this.ui.float(h, `⚙ металлолом ${h.scrap}`, '#d9a066'); }
    if (npc.kind === 'camp') {
      const gm = 1 + ((h.def.passive.campGold || 1) - 1) * (1 + patchMod(h.def.id, 'p'));
      const gold = Math.round(npc.gold * gm * (sm(0.05, h, 'farm')) * (hasPerk(h, 'farmer') ? 1.2 : 1));
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
      tm.baron = 4; tm.baronsTaken = (tm.baronsTaken || 0) + 1;
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
      { name: 'Каменные големы', icon: '🗿' }, { name: 'Волчья стая', icon: '🐺' }, { name: 'Призрачные вороны', icon: '🐦' },
      { name: 'Синий страж', icon: '💠' }, { name: 'Красный страж', icon: '🔴' }, { name: 'Жабоглот', icon: '🐸' },
    ];
    const c = U.pick(camps);
    const hp = Math.round(170 + this.minute * 32);
    return { kind: 'camp', name: c.name, icon: c.icon, hp, max: hp, atk: 14 + this.minute * 3.2, gold: 80 + this.minute * 3, xp: 70 + this.minute * 4 };
  }

  /* ---------------- Бой ---------------- */
  dealDamage(src, tgt, amt, kind = 'phys', noRedirect) {
    if (!tgt || !tgt.alive || amt <= 0) return 0;
    let arm = (tgt.armor + this.teamBuffs(tgt.team).arm) * (1 - Math.min(0.6, src ? src.itemStat('pen') : 0));
    if (kind === 'magic') arm *= 0.5;
    if (kind === 'true') arm = 0;
    let d = amt * HERO_DMG * 100 / (100 + arm) * (1 + 0.008 * Math.max(0, sd(tgt, 'agr')));
    const ev = tgt.ev;
    // Карта: осведомлённость (позиционирование) снижает получаемый урон, особенно когда бой начал враг
    const ambushed = ev && ev.att && ev.att !== tgt.team && (ev.type === 'gank' || ev.type === 'dragon' || ev.type === 'baron' || ev.type === 'siege');
    d *= U.clamp(1 - (ambushed ? 0.02 : 0.01) * sd(tgt, 'map'), 0.3, 1.7);
    // уязвимость рядом с врагом, у которого она в пассивке (Ундина), и якорь (+20% урона)
    if (kind === 'phys' && ev && ev.sides && ev.sides[tgt.enemyTeam].some(x => x.alive && x.def.passive.vuln)) d *= 1 + this.pv(ev.sides[tgt.enemyTeam].find(x => x.alive && x.def.passive.vuln), 'vuln');
    if (kind === 'phys') d *= 1 - Math.min(0.4, tgt.itemStat('physRed'));   // предметы против физического урона
    if (kind === 'magic') d *= 1 - Math.min(0.4, tgt.itemStat('magRed'));   // и против магического
    if (src && src.itemStat('antiHeal') > 0) tgt.wounded = { until: this.round + 1, k: Math.min(0.6, src.itemStat('antiHeal')) };   // скверна режет лечение
    if (tgt.anchored > 0) d *= 1.2;
    // слаженный фокус: удар по общей цели команды сильнее
    if (src && ev && ev.focus && ev.focus[src.team] === tgt) d *= 1.12;   // фокус: бить общую цель команды выгоднее (одинаково для всех)
    if (tgt.def.passive.hide) d *= 1 - Math.min(0.2, (1 - tgt.hp / tgt.maxHp) * this.pv(tgt, 'hide'));   // «Толстая шкура»
    if (src && hasPerk(src, 'hunter') && tgt.hp / tgt.maxHp < 0.35) d *= 1.2;
    if (src && hasPerk(src, 'reckless')) d *= 1.1;
    if (hasPerk(tgt, 'reckless')) d *= 1.1;
    // защитник (Кассиан) перехватывает часть урона, который получают союзники в его событии
    if (!noRedirect && ev && ev.sides) {
      const guard = ev.sides[tgt.team].find(x => x !== tgt && x.alive && x.def.passive.phalanx);
      if (guard) { const part = d * Math.min(0.6, this.pv(guard, 'phalanx')); d -= part; this.takeRaw(src, guard, part); }
    }
    const abs = src && src.pierce ? 0 : Math.min(tgt.shield, d);   // пике грифона проходит сквозь щит
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
  /* Урон без брони и перехвата: уже посчитанное значение уходит в щит и здоровье */
  takeRaw(src, tgt, d) {
    if (!tgt.alive || d <= 0) return 0;
    const abs = Math.min(tgt.shield, d); tgt.shield -= abs; tgt.hp -= d - abs;
    if (src) src.dmg += d;
    this.ui.damage(tgt, Math.round(d), abs >= d - 0.5);
    if (tgt.hp <= 0) this.kill(src, tgt);
    return d;
  }
  async skillDamage(src, tgt, amt, kind, color) {
    if (src && src.castMul) amt *= src.castMul;
    if (!tgt || !tgt.alive) return 0;
    this.ui.projectile(src, tgt, color || '#fff', true);
    await wait(380);
    if (this.dodges(src, tgt)) amt *= 0.5;
    return this.dealDamage(src, tgt, amt, kind);
  }

  healHero(src, tgt, amt, quiet) {
    if (!tgt.alive || amt <= 0) return;
    if (tgt.wounded && tgt.wounded.until >= this.round) amt *= 1 - tgt.wounded.k;
    if (src && src.castMul) amt *= src.castMul;
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
    if (src && src.castMul) amt *= src.castMul;
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
  // мёртвый герой (в таверне) не получает ни золота, ни опыта
  addGold(h, amt) { if (!h.alive) return; h.gold += amt; h.totalGold += amt; }
  /* Амулет стойкости: шанс стряхнуть контроль */
  shrug(tgt) { if (tgt.unstoppable > 0) { this.ui.float(tgt, 'НЕУДЕРЖИМ', '#ffb36b'); return true; } const t = tgt.itemStat('tenacity'); if (t > 0 && U.chance(t)) { this.ui.float(tgt, 'СТОЙКОСТЬ', '#c9f'); return true; } return false; }
  stun(src, tgt) {
    if (!tgt.alive || this.shrug(tgt)) return;
    tgt.stunned = 1;
    sfx('stun');
    this.ui.float(tgt, 'ОГЛУШЕНИЕ', '#ffe066');
  }

  gainXp(h, x) {
    if (!h.alive) return;
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
    // «Сброс хвоста»: раз за жизнь переживает смертельный удар
    if (tgt.def.passive.tail && !tgt.tailUsed) { tgt.tailUsed = true; tgt.hp = Math.round(tgt.maxHp * 0.15); this.ui.float(tgt, '🦎 СБРОС ХВОСТА', '#b9f0a0'); this.ui.log(`🦎 ${this.tag(tgt)} сбрасывает хвост и уходит от смерти!`, tgt.team); return; }
    // исход дуэли
    if (tgt.duel) { const w = tgt.duel; if (w === src && w.alive) { this.addGold(w, 300); w.mana = w.maxMana; this.ui.float(w, '🤠 ДУЭЛЬ ВЫИГРАНА', '#ffd36b'); this.ui.log(`🤠 ${this.tag(w)} побеждает в дуэли!`, w.team); } w.duel = null; tgt.duel = null; }
    if (src && src.team !== tgt.team) tgt.mem.killer = src;
    // жатва душ (Валдрек): любая смерть рядом с некромантом усиливает его
    if (tgt.ev && tgt.ev.sides) for (const x of [...tgt.ev.sides.blue, ...tgt.ev.sides.red]) if (x !== tgt && x.alive && x.def.passive.souls && x.souls < 20) { x.souls++; x.recalc(); this.ui.float(x, `💀 душа ${x.souls}`, '#7bff9e'); }
    tgt.hp = 0; tgt.shield = 0;
    tgt.dead = 3 + Math.floor(tgt.lvl / 6) + (this.minute >= 28 ? 1 : 0);
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
    let bounty = 500 + Math.min(350, Math.max(0, victimStreak - 1) * 70) + (goldDiff > 1200 ? 200 : 0);
    if (victimStreak >= 3) this.ui.log(`💥 ${this.tag(src)} прерывает серию ${this.tag(tgt)}!`, src.team);
    if (!this.firstBlood) { this.firstBlood = true; bounty += 100; this.ui.banner('ПЕРВАЯ КРОВЬ', `${src.name} убивает ${tgt.name}`, src.team); }
    this.addGold(src, bounty); this.gainXp(src, 200 + tgt.lvl * 25);
    const assists = (ev && ev.sides ? ev.sides[src.team] : []).filter(x => x !== src && x.alive);
    for (const a of assists) { a.a++; this.addGold(a, Math.round(180 * (sm(0.04, a, 'team')))); this.gainXp(a, 80 + tgt.lvl * 10); this.calmDown(a); }
    // команда получает долю: карта открывается, можно спокойно фармить и ставить обзор
    for (const x of tm.heroes) if (x !== src && !assists.includes(x) && x.alive) { this.addGold(x, 80); this.gainXp(x, 20 + tgt.lvl * 4); }
    // темп: за убийство команда копит импульс для натиска; смерть откатывает волну на линии погибшего
    tm.killTempo = (tm.killTempo || 0) + 1;
    if (tm.killTempo >= 2) { tm.momentum = Math.max(tm.momentum, 2); tm.killTempo = 0; }
    if (this.lanes[tgt.lane]) { const L = this.lanes[tgt.lane]; L.push = U.clamp(L.push + (tgt.team === 'blue' ? -0.35 : 0.35), -1, 1); }
    this.calmDown(src);
    this.tryTilt(tgt, assists.length ? 1 : 2, 'гибели');
    // абордаж (Клешнир): убийца или помощник крадёт часть золота жертвы
    const pirate = [src, ...assists].find(x => x.def.passive.plunder);
    if (pirate) { const g = Math.round(tgt.gold * Math.min(0.6, this.pv(pirate, 'plunder'))); if (g > 0) { tgt.gold -= g; this.addGold(pirate, g); this.ui.float(pirate, `🏴‍☠️ +${g}💰`, '#ffc93c'); } }
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
  async answer(sig, h) {
    // человек отвечает через интерфейс; если ответа ещё нет (null), он считается «позже» и прибывает на минуту позже
    // человек решает сам, принять ли призыв; успеет ли сразу — тот же бросок, что у ИИ
    let r = (h.ctrl === 'human' && this.ui.askSignal) ? await this.ui.askSignal(h, sig) : AI.respondSignal(this, h, sig);
    if (r && h.ctrl === 'human' && !r.pending) r.fast = r.accept && AI.arrivesFast(h);
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
    const chance = U.clamp(0.45 - 0.035 * sd(h, 'calm'), 0.05, 0.9) * (hasPerk(h, 'stress') ? 0.5 : 1) * (1 - 0.08 * ((h.pl && h.pl.fac && h.pl.fac.psych) || 0));   // психолог клуба
    if (!U.chance(chance)) return;
    const before = h.tilt;
    h.tilt = Math.min(3, h.tilt + amount);
    h.mem.tiltAt = this.round;
    if (h.tilt > before) { this.ui.tilt(h); this.ui.log(`😤 ${this.tag(h)} тильтует после ${why} (−${h.tilt} к Механике, Реакции и Чтению игры, +${h.tilt} к Агрессии).`); }
    // «Токсичный»: его тильт передаётся союзникам рядом
    if (h.tilt > before && hasPerk(h, 'toxic') && !why.startsWith('токсичности')) for (const a of this.alliesIn(h)) if (a !== h) this.tryTilt(a, 1, `токсичности ${h.nick}`);
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

  async assignEvents() {
    // осады прошлой минуты, у которых не было защитников, — атакуемая команда может отреагировать
    const sieged = { blue: [], red: [] };
    for (const ev of this.events || []) if (ev.type === 'siege' && ev.att && this.structureAlive(ev.structure)) {
      const dt = this.enemyOf(ev.att);
      if (!ev.sides[dt].some(x => x.alive)) sieged[dt].push({ lane: ev.lane, n: ev.sides[ev.att].filter(x => x.alive).length, st: ev.structure });
    }
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
      // человек сам решает выйти из драки (кнопка «Отступить»); ИИ выходит при малом здоровье
      for (const t of ['blue', 'red']) for (const x of ev.sides[t].slice()) if (x.ctrl === 'human' && x.wantLeave && x.anchored <= 0) { ev.sides[t] = ev.sides[t].filter(y => y !== x); x.wantLeave = false; const sig = this.signal(x, 'retreat', { ev: ev.id }); if (sig) { const leave = []; for (const y of ev.sides[t]) { const r = await this.answer(sig, y); if (r.accept && r.fast) leave.push(y); } ev.sides[t] = ev.sides[t].filter(y => !leave.includes(y)); this.announce(sig); } }
      for (const t of ['blue', 'red']) ev.sides[t] = ev.sides[t].filter(x => x.alive && !x.ev && ((x.ctrl === 'human' && !x.autopilot) || x.hp / x.maxHp > (hasPerk(x, 'cautious') ? 0.25 : hasPerk(x, 'reckless') ? 0.04 : 0.12) || x.anchored > 0));
      // сигнал «Отступаем», если команда в событии явно проигрывает
      for (const t of ['blue', 'red']) {
        const own = ev.sides[t], foe = ev.sides[this.enemyOf(t)];
        if (!own.length || !foe.length) continue;
        const avgHp = U.sum(own, x => x.hp / x.maxHp) / own.length;
        if (own.length < foe.length - 1 || (avgHp < 0.35 && own.length <= foe.length)) {
          const sig = this.signal(U.maxBy(own, x => sd(x, 'team') + U.rand(2)), 'retreat', { ev: ev.id });
          if (!sig) continue;
          const leave = [sig.from];
          for (const x of own) if (x !== sig.from) { const r = await this.answer(sig, x); if (r.accept && r.fast) leave.push(x); }
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
      const rich = (h.gold >= AI.shopTarget(this, h) || h.gold >= AI.nextGoalCost(this, h)) && (hpR < 0.92 || U.chance(0.5));
      const pk = hasPerk(h, 'cautious') ? 0.12 : hasPerk(h, 'reckless') ? -0.15 : 0;
      // человек решает сам (кнопка «На базу»), ИИ — по здоровью, мане и деньгам
      const wants = h.ctrl === 'human' && !h.autopilot ? h.wantRecall : (hpR < 0.3 + pk - 0.01 * sd(h, 'agr') || h.mana < 20 && hpR < 0.6 || rich);
      h.wantRecall = false;
      if (h.anchored <= 0 && wants && h.mem.pushRound !== this.round - 1 && h.ev == null && h.lane && this.lanes[h.lane] && ['top', 'mid', 'adc', 'sup'].includes(h.role) && hpR > 0.12) {
        // решение: дотолкать волну и уйти через минуту или уйти сразу (волна останется у своей башни)
        const pushed = (h.team === 'blue' ? 1 : -1) * this.lanes[h.lane].push > 0.15;
        let choice = 'now';
        if (!pushed) {
          if (h.ctrl === 'human' && !h.autopilot) choice = await this.decide(h, { title: '🏠 Уход на базу', text: 'Волна не дотолкана. Если уйти сразу, она будет давить на вашу башню.', options: [{ id: 'push', label: 'Дотолкать и уйти через минуту' }, { id: 'now', label: 'Уйти сейчас' }], def: 'now' });
          // Осторожный уходит сразу уже при меньшей потере здоровья, Безрассудный дотолкает волну и полуживым
          else choice = hpR > 0.3 + pk && U.chance(U.clamp((iqOf(h, 'tactic') - 4) / 12, 0.05, 0.97)) ? 'push' : 'now';
        }
        if (choice === 'push') { h.mem.pushRound = this.round; h.mem.recallNext = true; const L = this.lanes[h.lane]; L.push = U.clamp(L.push + (h.team === 'blue' ? 0.25 : -0.25), -1, 1); continue; }
      }
      const pushedFirst = h.mem.pushRound === this.round - 1;
      if (h.mem.recallNext) { h.mem.recallNext = false; if (h.alive && this.free(h)) { this.leaveLane(h, true); h.ev = this.mkEv('recall', { lane: null }); h.ev.sides[h.team].push(h); continue; } }
      if (h.anchored <= 0 && wants) {
        this.leaveLane(h, pushedFirst);
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

    // 4б. Численный перевес: пока у врага двое и больше на респауне, команда собирается и давит башню.
    // Решает командное мышление того, кто созывает: умные команды используют перевес почти всегда
    for (const t of ['blue', 'red']) {
      const et = this.enemyOf(t);
      const dead = this.teams[et].heroes.filter(h => !h.alive).length;
      if (dead < 2 || this.persist.some(e => e.team && e.att === t)) continue;
      const crew = this.teams[t].heroes.filter(h => this.free(h) && h.hp / h.maxHp > 0.4);
      if (crew.length < 3) continue;
      const caller = U.maxBy(crew, h => iqOf(h, 'team'));
      if (!U.chance(U.clamp((iqOf(caller, 'team') - 2) / 14 + 0.15 * (dead - 2), 0.1, 0.95))) continue;
      const lane = this.bestSiegeLane(et);
      const st = this.structureFor(et, lane);
      if (!st || (st.idx === 3 && !this.nexusOpen(et))) continue;
      const ev = this.mkEv('siege', { lane, att: t, structure: st, left: 2, team: true });
      crew.forEach(h => this.join(ev, h));
      for (const d of this.teams[et].heroes) if (this.free(d) && U.chance(0.75)) this.join(ev, d);
      this.persist.push(ev);
      this.ui.log(`👥 ${this.tag(caller)}: «У них ${dead} на респауне — все на <b>${lane.toUpperCase()}</b>!»`, t);
    }

    // 4a. Сигналы, отправленные человеком (тем же механизмом, что и у ИИ)
    for (const q of (this.humanQueue || []).splice(0)) {
      if (q.type === 'obj') { const npc = q.data.kind === 'baron' ? this.baron : this.dragon; const thr = npc.kind === 'baron' ? 150 : 100;
        if (!npc.alive || this.minute < npc.retryAt || this.teams[q.h.team].pressure < thr * 0.75) { this.ui.float(q.h, npc.alive ? 'Рано: мало давления на карте' : 'Монстра нет', '#aaa'); continue; }
        const sig = this.signal(q.h, 'obj', { kind: npc.kind }); if (sig) { this.teams[q.h.team].pressure += 10 * sm(0.05, q.h, 'team'); for (const x of this.teams[q.h.team].heroes) if (x !== q.h && this.free(x)) { const r = await this.answer(sig, x); if (r.accept) x.mem.call = { kind: npc.kind, fast: r.fast, round: this.round }; } this.announce(sig); } }
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
          const r = await this.answer(sig, x);
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
        for (const x of tm.heroes) if (x !== sig.from && this.free(x)) { const r = await this.answer(sig, x); if (r.accept) x.mem.call = { kind: npc.kind, fast: r.fast, round: this.round }; }
        this.announce(sig);
      }
    }
    if (!this.persist.some(e => e.type === 'dragon') && this.dragon.alive) await this.tryObjective(this.dragon, 100, ['jng', 'adc', 'sup', 'mid']);
    if (!this.persist.some(e => e.type === 'baron') && this.baron.alive) await this.tryObjective(this.baron, 150, ['jng', 'adc', 'sup', 'mid', 'top']);

    // 5б. Реакция на осаду: Карта решает, заметил ли игрок, что его башню бьют; командное мышление — стоит ли идти
    for (const t of ['blue', 'red']) for (const s of sieged[t]) {
      let sent = 0;
      const cands = this.teams[t].heroes.filter(h => this.free(h) && h.alive).sort((a, b) => (a.lane === s.lane ? -2 : a.role === 'jng' || a.role === 'mid' ? -1 : 0) - (b.lane === s.lane ? -2 : b.role === 'jng' || b.role === 'mid' ? -1 : 0));
      for (const h of cands) {
        if (sent >= Math.max(1, s.n)) break;
        if (h.mem.defendRound === this.round) continue;
        if (!U.chance(U.clamp(0.35 + 0.05 * sd(h, 'map') + (s.st.idx >= 2 ? 0.2 : 0), 0.05, 0.95))) continue;   // заметил?
        if (h.ctrl === 'human' && !h.autopilot) {
          const ans = await this.decide(h, { title: '🛡 Башню бьют!', text: `Враги (${s.n}) осаждают вашу башню на ${s.lane.toUpperCase()}. Пойти защищать?`, options: [{ id: 'go', label: 'Защищать' }, { id: 'no', label: 'Остаться' }], def: 'no' });
          if (ans === 'go') { h.mem.defendLane = s.lane; h.mem.defendRound = this.round; sent++; }
          continue;
        }
        const smart = U.chance(U.clamp((iqOf(h, 'team') - 2) / 14, 0.05, 1));
        const go = smart ? h.hp / h.maxHp > 0.45 && sent + 1 >= s.n - 1 + (h.def.tags.includes('tank') ? -1 : 0) || (h.hp / h.maxHp > 0.45 && s.st.idx >= 2) : U.chance(0.5);
        if (!go) continue;
        h.mem.defendLane = s.lane; h.mem.defendRound = this.round; sent++;
      }
      this.defStats = this.defStats || { sieged: 0, sent: 0, answered: 0 }; this.defStats.sieged++; this.defStats.sent += sent; if (sent) this.defStats.answered++;
      if (sent) this.ui.log(`🛡 ${this.teams[t].name} спешат защищать башню на <b>${s.lane.toUpperCase()}</b>.`, t);
    }

    // 6. Ганги
    for (const t of U.shuffle(['blue', 'red'])) {
      const j = this.hero(t, 'jng');
      if (this.free(j) && j.gank >= 100) { if (hasPerk(j, 'loner')) { j.gank = 0; continue; } await this.startGank(j); }
    }
    // 6б. Роумы мидера и саппорта
    if (this.minute >= 4) for (const t of U.shuffle(['blue', 'red'])) for (const r of U.shuffle(['mid', 'sup'])) {
      const h = this.hero(t, r);
      if (this.free(h) && h.roam >= 100) { if (hasPerk(h, 'loner')) { h.roam = 0; continue; } await this.tryRoam(h); }
    }

    // 7. Обычные занятия: линии, лес, свободная осада
    for (const l of LANES) {
      const present = { blue: [], red: [] };
      for (const h of this.heroes) if (this.free(h) && (h.mem.defendRound === this.round ? h.mem.defendLane : h.lane) === l) present[h.team].push(h);
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
    // «Небесный дозор» (Аэрин): свободный грифон перелетает в драку союзников
    for (const h of this.heroes) {
      if (!this.free(h) || !h.def.passive.skyward) continue;
      const fights = this.events.filter(ev => ev.sides && ev.sides[h.team].some(x => x.alive) && ev.sides[h.enemyTeam].some(x => x.alive));
      if (!fights.length) continue;
      const ev = U.maxBy(fights, e => e.sides[h.enemyTeam].filter(x => x.alive).length - e.sides[h.team].filter(x => x.alive).length);
      // ИИ решает «лететь или нет» (куда — всегда туда, где союзникам тяжелее); человек — тот же выбор
      if (h.ctrl === 'human' && !h.autopilot) { if (await this.decide(h, { title: '🦅 Небесный дозор', text: `Союзники дерутся${ev.lane ? ' на ' + ev.lane.toUpperCase() : ''}. Перелететь к ним?`, options: [{ id: 'fly', label: 'Лететь' }, { id: 'no', label: 'Остаться' }], def: 'no' }) !== 'fly') continue; }
      else if (!U.chance(U.clamp((iqOf(h, 'team') - 2) / 14 + 0.2, 0.1, 0.95))) continue;
      this.join(ev, h);
      this.ui.log(`🦅 ${this.tag(h)} перелетает на помощь союзникам${ev.lane ? ' на ' + ev.lane.toUpperCase() : ''}!`, h.team);
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

  async tryObjective(npc, threshold, roles) {
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

  /* Роум: мидер или саппорт оставляет линию и идёт на соседнюю. Командное мышление решает,
     вовремя ли уходить (своя линия не продавлена, напарник не при смерти), куда идти и позвать ли лесника. */
  async tryRoam(h) {
    if (h.ctrl === 'human' && !h.autopilot) return this.startGank(h, { roam: true, smart: true, human: true });
    const smart = U.chance(U.clamp((iqOf(h, 'team') - 2) / 14, 0.05, 1));
    if (smart) {
      const lane = this.lanes[h.lane];
      const push = h.team === 'blue' ? lane.push : -lane.push;      // >0 — волна давит на врага
      const mate = this.teams[h.team].heroes.find(x => x !== h && x.lane === h.lane && x.alive);
      const unsafe = push < -0.35 || (mate && mate.hp / mate.maxHp < 0.35) || h.hp / h.maxHp < 0.5;
      if (unsafe) { h.roam = 70; return; }
    }
    await this.startGank(h, { roam: true, smart });
  }

  async startGank(j, opt = {}) {
    const et = j.enemyTeam;
    const options = [];
    for (const l of LANES) {
      if (opt.roam && l === j.lane) continue;
      const victims = this.teams[et].heroes.filter(h => this.free(h) && h.lane === l);
      if (!victims.length) continue;
      const lane = this.lanes[l];
      const over = j.team === 'blue' ? -lane.push : lane.push; // враг продавил к нам — он «перетянут»
      const hurt = U.sum(victims, v => 1 - v.hp / v.maxHp) / victims.length;
      const score = 30 + hurt * 60 + over * 25 - lane.ward[et] * 6 + U.rand(15) - (victims.length - 1) * 8;
      options.push({ l, victims, score });
    }
    if (!options.length) { if (opt.roam) j.roam = 60; return; }
    if (j.ctrl === 'human' && !j.autopilot) {
      const ans = await this.decide(j, { title: opt.roam ? '🏃 Роум' : '⚡ Ганг', text: opt.roam ? 'Можно уйти с линии и помочь на соседней. Куда?' : 'Шкала ганга заполнена. Куда идти?',
        options: [...options.map(o => ({ id: o.l, label: `${o.l.toUpperCase()}: ${o.victims.map(v => `${v.name} ${Math.round(v.hp / v.maxHp * 100)}%`).join(', ')}` })), { id: 'wait', label: opt.roam ? 'Остаться на линии' : 'Пока фармить' }], def: 'wait' });
      if (ans === 'wait') { if (opt.roam) j.roam = 70; else j.gank = 80; return; }
      opt.lane = ans;
    }
    // Командное мышление: выбрать самую выгодную линию (слабый — почти наугад)
    const best = opt.lane ? options.find(o => o.l === opt.lane) : (opt.roam ? opt.smart : U.chance(U.clamp((iqOf(j, 'team') - 2) / 14, 0.05, 1))) ? U.maxBy(options, o => o.score) : U.pick(options);
    // умный роумер не идёт туда, где ловить нечего, — подождёт момента получше
    if (opt.roam && opt.smart && !opt.human && best.score < 36) { j.roam = 75; return; }
    if (opt.roam) { j.roam = 0; j.roams++; this.leaveLane(j); } else j.gank = 0;
    const lane = this.lanes[best.l];
    const ev = this.mkEv('gank', { lane: best.l, att: j.team, left: 2, roam: !!opt.roam });
    this.join(ev, j);
    // умный роумер зовёт своего лесника, если тот свободен и готов к гангу
    let duo = null;
    if (opt.roam && opt.smart) {
      const jg = this.hero(j.team, 'jng');
      if (this.free(jg) && !hasPerk(jg, 'loner') && jg.gank >= 35 && U.chance(U.clamp(0.25 + 0.04 * sd(jg, 'team'), 0.05, 0.9))) { this.join(ev, jg); jg.gank = 0; duo = jg; }
    }
    this.heroes.filter(h => h.team === j.team && this.free(h) && h.lane === best.l).forEach(h => this.join(ev, h));
    best.victims.forEach(h => this.join(ev, h));
    const bestMap = Math.max(...best.victims.map(v => sd(v, 'map')));
    let spotChance = U.clamp(lane.ward[et] * 0.13 + 0.03 * (bestMap - sd(j, 'agr')), 0, 0.9);
    // роум заметнее ганга: уход с линии видят. Умный роумер уходит под прикрытием волны и тумана, неумелый — у всех на виду
    if (opt.roam) spotChance = U.clamp(spotChance + (opt.smart ? 0.05 : 0.3), 0, 0.9);
    const spotted = U.chance(spotChance);
    let msg = opt.roam ? `🏃 ${this.tag(j)} уходит с линии и роумит на <b>${best.l.toUpperCase()}</b>!${duo ? ` Вместе с ним приходит ${this.tag(duo)}.` : ''}` : `⚡ ${this.tag(j)} гангает <b>${best.l.toUpperCase()}</b>!`;
    if (spotted) {
      ev.left = 1;
      for (const v of best.victims) this.shieldHero(v, v, v.maxHp * 0.25);
      // раскрытый роум: жертвы встречают роумера заранее подготовленным ударом
      if (opt.roam) for (const v of best.victims) this.dealDamage(v, j, v.power * 2.2 + v.sp * 0.6, 'phys');
      msg += ` Варды ${this.teams[et].name.toLowerCase()} раскрыли ганг — жертвы успели подготовиться (щит).`;
    }
    ev.late = [];
    const help = this.signal(best.victims[0], 'help', { lane: best.l });
    if (help) {
      for (const x of this.teams[et].heroes) {
        if (!this.free(x) || best.victims.includes(x)) continue;
        // гангу на другой линии быстрее всего помогает свой лесник и мидер
        if (!(x.role === 'jng' || x.role === 'mid' || x.lane === best.l)) continue;
        const r = await this.answer(help, x);
        if (r.accept) { if (r.fast) { this.join(ev, x); msg += ` ${this.tag(x)} откликается на сигнал и прибегает на помощь!`; } else ev.late.push(x); }
      }
      this.announce(help);
    }
    const ej = this.hero(et, 'jng');
    if (this.free(ej) && !hasPerk(ej, 'loner') && !help && U.chance(spotted ? 0.65 : 0.15 + ej.gank / 250)) {
      this.join(ev, ej);
      ej.gank = Math.max(0, ej.gank - 40);
      msg += ` ${this.tag(ej)} прибегает с контр-гангом!`;
    }
    lane.ward[et] *= 0.4;
    this.persist.push(ev);
    this.ui.log(msg, j.team);
    sfx('gank');
    this.ui.banner(opt.roam ? 'РОУМ!' : 'ГАНГ!', `${j.name} → ${best.l.toUpperCase()}`, j.team, true);
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
            const dmg = (130 + this.minute * 16) * (minions ? 0.5 : 1) * (st.idx === 3 ? 1.3 : 1);   // башня растёт со временем и наказывает осаду без передовой
            const v = this.frontline(att);   // башня бьёт того, кто впереди: танк прикрывает осаду, без него достаётся хрупким
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
        if (h.ev.type === 'recall') await this.atBase(h);
        if (h.role === 'jng' && h.ev.type === 'jungle') h.gank += Math.max(2, 8 + 0.8 * sd(h, 'agr'));
        // мидер и саппорт копят желание сходить на соседнюю линию (роум); быстрее — у агрессивных
        if ((h.role === 'mid' || h.role === 'sup') && h.ev.lane === h.lane && ['lane', 'siege', 'defend'].includes(h.ev.type)) h.roam += Math.max(3, (h.role === 'mid' ? 14 : 12) + 1.2 * sd(h, 'agr'));
      } else {
        h.dead--;
        if (h.dead <= 0) { h.dead = 0; h.tailUsed = false; h.hp = h.maxHp; h.mana = h.maxMana; h.shield = 0; await this.atBase(h, true); this.ui.log(`✨ ${this.tag(h)} возрождается на базе.`); }
      }
      // зелье здоровья: пьёт, когда здоровья мало (умный — вовремя, неумный — с опозданием)
      const drink = h.ctrl === 'human' && !h.autopilot ? h.wantPotion : h.hp / h.maxHp < (iqOf(h, 'tactic') >= 10 ? 0.55 : 0.35);
      h.wantPotion = false;
      if (h.alive && h.potions > 0 && drink && h.hp < h.maxHp && h.ev && h.ev.type !== 'recall') {
        h.potions--; const amt = POTION.heal + POTION.healLvl * h.lvl; h.hp = Math.min(h.maxHp, h.hp + amt); this.ui.float(h, `🧪 +${amt}`, '#45e07a');
      }
      if (h.tilt && this.round - (h.mem.tiltAt || 0) >= 2) this.calmDown(h);
      for (const k of ['q', 'r']) if (h.cd[k] > 0) h.cd[k]--;
      for (const k of ['taunted', 'silenced', 'anchored', 'reflect']) if (h[k] > 0) h[k]--;
      for (const k of ['knocked', 'unstoppable', 'stealth']) if (h[k] > 0) h[k]--;
      if (h.duel) { h.duelLeft--; if (h.duelLeft <= 0 || !h.duel.alive) { if (h.duel.duel === h) h.duel.duel = null; h.duel = null; } }
      if (h.alive && h.oasis > 0) { h.oasis--; for (const a of this.alliesIn(h)) { this.healHero(h, a, a.maxHp * 0.07 + this.sp(h, 20, 0.2)); this.shieldHero(h, a, this.sp(h, 15, 0.15)); this.addMana(a, 12, true); } }
      if (h.alive && h.water > 0 && h.hp < h.maxHp * 0.5) { h.water--; this.healHero(h, h, h.maxHp * 0.08); this.ui.float(h, '💧 влага', '#7bd3ff'); }
      h.board.forEach(g => { if (g && g.bloom && g.bloom < 3) g.bloom++; });
      if (h.verses > 0 && (!h.ev || !h.ev.sides || h.ev.type === 'recall')) h.verses--;
      if (h.board.spreadRot()) this.ui.boardHit(h, '#7bd36b');
      h.board.decayFog();
      if (h.stunned > 1) h.stunned = 1;
      if (h.ev && (h.ev.type === 'recall' || h.ev.type === 'dead')) h.stunned = 0;
    }
    for (const ev of this.persist) { ev.left--; ev.rounds++; if (ev.left <= 0) this.endPersist(ev); }
    this.persist = this.persist.filter(e => e.left > 0 && !e.done);
    for (const t of ['blue', 'red']) {
      const tm = this.teams[t];
      if (tm.momentum > 0) tm.momentum--;
      if (tm.killTempo > 0 && this.round % 3 === 0) tm.killTempo--;
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

  async atBase(h, respawn) {
    h.hp = h.maxHp; h.mana = h.maxMana;
    // человек закупается сам (те же предметы и правила), ИИ — по своей оценке предметов
    const acts = h.ctrl === 'human' && !h.autopilot && this.ui.humanShop ? await this.ui.humanShop(h) : AI.shop(this, h);
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
  mineBlast(owner, srcId) {
    const src = this.heroes.find(x => x.id === srcId);
    if (!owner.alive) return;
    const dmg = src ? this.sp(src, 35, 0.45) : 60;
    this.ui.float(owner, '💥 МИНА!', '#ff7a45');
    this.ui.boardHit(owner, '#ff7a45'); owner.board.shake = 1;
    owner.mana = Math.max(0, owner.mana - 15);
    this.dealDamage(src && src.alive ? src : null, owner, dmg, 'magic');
  }
  taunt(src, foes, rounds = 1) { for (const e of foes) { if (this.shrug(e)) continue; e.taunted = rounds + 1; e.tauntBy = src; this.ui.float(e, '😠 ПРОВОКАЦИЯ', '#ffb36b'); } }
  silence(src, tgt, rounds) { if (this.shrug(tgt)) return; tgt.silenced = rounds + 1; this.ui.float(tgt, '🤐 НЕМОТА', '#9fd3ff'); }
  anchor(src, tgt, rounds) { if (this.shrug(tgt)) return; tgt.anchored = rounds + 1; this.ui.float(tgt, '⚓ ЯКОРЬ', '#c8d2e0'); }
  longShot(h, amt) {
    const evs = this.events.filter(ev => ev.sides && ev !== h.ev && ev.sides[h.team].some(x => x.alive) && ev.sides[h.enemyTeam].some(x => x.alive));
    if (!evs.length) return 0;
    const ev = U.pick(evs), t = this.frontline(ev.sides[h.enemyTeam].filter(x => x.alive && !(x.stealth > 0)).concat([]).filter(Boolean)) || null;
    if (!t) return 0;
    this.ui.projectile(h, t, '#ffd36b');
    this.dealDamage(h, t, amt, 'phys');
    return amt;
  }
  /* Цветок Колюча: лечит и даёт щит союзникам владельца поля, сила — от стадии роста */
  bloomBurst(owner, bl) {
    const src = this.heroes.find(x => x.id === bl.by) || owner;
    const k = [0, 0.9, 1.6, 2.6][bl.stage];
    this.ui.float(owner, `🌼 ЦВЕТОК ×${bl.stage}`, '#ffe066');
    for (const a of this.alliesIn(owner)) { this.healHero(src, a, this.sp(src, 30, 0.3) * k); this.shieldHero(src, a, this.sp(src, 25, 0.25) * k); }
  }
  /* Похищение (Аэрин): цель уносится туда, где союзников похитителя больше всего */
  abduct(h, t) {
    const evs = this.events.filter(ev => ev !== t.ev && ev.sides && ev.type !== 'dead' && ev.type !== 'recall');
    const dest = U.maxBy(evs, ev => ev.sides[h.team].filter(x => x.alive).length - ev.sides[t.team].filter(x => x.alive).length);
    if (!dest || dest.sides[h.team].filter(x => x.alive).length < 1) return;
    const from = t.ev; if (from && from.sides) from.sides[t.team] = from.sides[t.team].filter(x => x !== t);
    dest.sides[t.team].push(t); t.ev = dest;
    this.ui.float(t, '🦅 ПОХИЩЕН', '#e8d9a8');
    this.ui.log(`🦅 ${this.tag(h)} уносит ${this.tag(t)} к своим союзникам${dest.lane ? ' на ' + dest.lane.toUpperCase() : ''}!`, h.team);
  }
  /* Линька (Скинк): снимает с себя контроль и порчу поля */
  molt(h) {
    h.stunned = 0; h.silenced = 0; h.taunted = 0; h.tauntBy = null; h.anchored = 0; h.knocked = 0; h.wounded = null;
    h.board.forEach(g => { if (!g) return; if (g.ice || g.fog || g.rot || g.mine) { g.ice = 0; g.fog = 0; g.rot = 0; g.mine = null; g.flash = 1; } });
    this.ui.float(h, '🐍 ЛИНЬКА', '#b9f0a0');
  }
  /* Дуэль (Шерман) */
  duel(h, t, rounds) {
    if (h.duel && h.duel.duel === h) h.duel.duel = null;
    h.duel = t; t.duel = h; h.duelLeft = t.duelLeft = rounds + 1;
    this.ui.float(t, '🤠 ДУЭЛЬ', '#ffd36b'); this.ui.float(h, '🤠 ДУЭЛЬ', '#ffd36b');
    this.ui.log(`🤠 ${this.tag(h)} вызывает ${this.tag(t)} на дуэль!`, h.team);
  }
  /* Немедленный дополнительный ход союзника (Ноктюрн) */
  async bonusMove(h) {
    if (!h.alive || this.over) return;
    const prev = this.active;
    this.active = h; this.ui.focus(h); await wait(300);
    this.ui.float(h, '🎻 ДОП. ХОД', '#e0c3ff');
    const mv = await this.chooseMove(h);
    if (mv) await this.doSwap(h, mv);
    this.active = prev; if (prev) this.ui.focus(prev);
  }
  /* Воскрешение павшего союзника (Валдрек) */
  revive(src, ally) {
    if (ally.alive) return;
    ally.dead = 0; ally.hp = Math.round(ally.maxHp * 0.45); ally.mana = ally.maxMana * 0.5; ally.shield = 0; ally.tilt = 0;
    this.atBase(ally, true);
    this.ui.float(ally, '💀 ВОССТАЛ!', '#7bff9e');
    this.ui.log(`💀 ${this.tag(src)} поднимает павшего ${this.tag(ally)} — он снова в бою!`, src.team);
  }

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
    // «Стена щитов»: умение, меняющее поле, отражается обратно на поле заклинателя
    if (tgt.reflect > 0 && src && src.team !== tgt.team) {
      tgt.reflect = 0;
      this.ui.projectile(tgt, src, '#ffe9a8', true); await wait(380);
      this.ui.log(`🔰 ${this.tag(tgt)} отражает умение ${this.tag(src)} — оно бьёт по полю самого заклинателя!`, tgt.team);
      this.ui.float(tgt, 'ОТРАЖЕНО!', '#ffe9a8');
      fn(src.board); src.board.shake = 0.8; await wait(450); await this.settle(src, false); return;
    }
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
