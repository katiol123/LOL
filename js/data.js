'use strict';
/* Игровые данные: камни, роли, предметы, драконы и 16 героев */

const GEMS = [
  { key: 'atk', name: 'Атака', icon: '⚔', color: '#ff5468', desc: 'Урон по цели текущего события: миньонам, лесным монстрам, героям, башням, Дракону и Барону.' },
  { key: 'def', name: 'Защита', icon: '🛡', color: '#4ea8ff', desc: 'Щит, поглощающий входящий урон. Слабеет в конце каждой минуты.' },
  { key: 'heal', name: 'Лечение', icon: '✚', color: '#45e07a', desc: 'Восстанавливает здоровье героя.' },
  { key: 'mana', name: 'Мана', icon: '◆', color: '#3fe0f0', desc: 'Заряжает ману для активных умений.' },
  { key: 'gold', name: 'Золото', icon: '●', color: '#ffc93c', desc: 'Золото на предметы. На базе герой покупает снаряжение.' },
  { key: 'vis', name: 'Обзор', icon: '◉', color: '#b86bff', desc: 'Варды: защищают от гангов, копят давление на Дракона/Барона, заряжают ганг лесника.' },
];
const GEM_COLORS = [...GEMS.map(g => g.color), '#8b8f98', '#ffffff'];

const ROLES = {
  top: { name: 'Верхняя линия', short: 'TOP', icon: '⛰' },
  jng: { name: 'Лес', short: 'JNG', icon: '🌲' },
  mid: { name: 'Средняя линия', short: 'MID', icon: '✦' },
  adc: { name: 'Стрелок', short: 'ADC', icon: '🏹' },
  sup: { name: 'Поддержка', short: 'SUP', icon: '❖' },
};
const ROLE_ORDER = ['top', 'jng', 'mid', 'adc', 'sup'];
const ROLE_LANE = { top: 'top', jng: null, mid: 'mid', adc: 'bot', sup: 'bot' };

const BASE_STATS = {
  top: { hp: 640, hpG: 92, atk: 16, atkG: 2.4, arm: 28, armG: 3.2, mana: 100, sp: 25, spG: 5 },
  jng: { hp: 600, hpG: 86, atk: 17, atkG: 2.5, arm: 24, armG: 2.8, mana: 100, sp: 25, spG: 5 },
  mid: { hp: 520, hpG: 74, atk: 14, atkG: 2.0, arm: 18, armG: 2.2, mana: 140, sp: 40, spG: 8 },
  adc: { hp: 370, hpG: 50, atk: 16, atkG: 4.3, arm: 10, armG: 1.2, mana: 100, sp: 20, spG: 4 },   // «стеклянная пушка»: слаб в начале, растёт быстрее всех
  sup: { hp: 600, hpG: 70, atk: 21, atkG: 0.9, arm: 28, armG: 2.2, mana: 140, sp: 52, spG: 3.5 },   // силён на старте, медленно растёт
};

/* Предметы: любой герой может купить любой предмет. tier: 1 — дешёвые, 2 — средние, 3 — крупные, 4 — легендарные поздние.
   Особые свойства: ls вампиризм, crit шанс крита ⚔ (совпадение 4+), pen пробивание брони, thorns отражение физ. урона,
   dodge уклонение от умений, regen восстановление здоровья в минуту, manaRegen мана в минуту, goldPow доход от ●,
   towerPow урон по строениям, cascPow сила каскадов, shieldPow/healPow сила щитов/лечения, visPow сила ◉, physRed снижение получаемого физ. урона. */
const ITEMS = {
  // ---- уровень 1: дешёвые компоненты ----
  dagger: { name: 'Кинжал новичка', icon: '🔪', cost: 250, tier: 1, atk: 3 },
  cloth: { name: 'Стёганая куртка', icon: '🧥', cost: 220, tier: 1, arm: 8 },
  amulet: { name: 'Амулет здоровья', icon: '📿', cost: 300, tier: 1, hp: 110 },
  shard: { name: 'Осколок маны', icon: '💎', cost: 280, tier: 1, mana: 60, manaRegen: 4 },
  charm: { name: 'Оберег удачи', icon: '🍀', cost: 350, tier: 1, crit: 0.05 },
  lantern: { name: 'Фонарь следопыта', icon: '🏮', cost: 300, tier: 1, visPow: 0.25 },
  purse: { name: 'Кошель торговца', icon: '👛', cost: 400, tier: 1, goldPow: 0.12 },
  bandage: { name: 'Целебная повязка', icon: '🩹', cost: 300, tier: 1, regen: 0.012 },
  sword: { name: 'Длинный клинок', icon: '🗡', cost: 400, tier: 1, atk: 6 },
  vest: { name: 'Кольчуга', icon: '🥋', cost: 350, tier: 1, arm: 14 },
  ruby: { name: 'Рубин жизни', icon: '♥', cost: 400, tier: 1, hp: 160 },
  tome: { name: 'Том чар', icon: '📘', cost: 435, tier: 1, sp: 22, mana: 30 },
  // ---- уровень 2: средние ----
  ward: { name: 'Око Стража', icon: '👁', cost: 600, tier: 2, hp: 120, visPow: 0.5 },
  boots: { name: 'Сапоги ловкача', icon: '👢', cost: 800, tier: 2, dodge: 0.06, hp: 80 },
  spear: { name: 'Копьё пробивания', icon: '🔱', cost: 900, tier: 2, atk: 8, pen: 0.12 },
  focus: { name: 'Фокусирующая линза', icon: '🔍', cost: 950, tier: 2, sp: 25, cascPow: 0.08 },
  mirror: { name: 'Зеркальный щит', icon: '🪞', cost: 1000, tier: 2, arm: 22, thorns: 0.12 },
  chalice: { name: 'Чаша прилива', icon: '🏆', cost: 1000, tier: 2, manaRegen: 12, sp: 15, healPow: 0.1 },
  aegis: { name: 'Эгида Союза', icon: '🔰', cost: 1100, tier: 2, arm: 24, hp: 200, shieldPow: 0.25 },
  censer: { name: 'Кадило Света', icon: '🕯', cost: 1100, tier: 2, sp: 28, healPow: 0.3 },
  banner: { name: 'Знамя осады', icon: '🚩', cost: 1100, tier: 2, atk: 6, towerPow: 0.3 },
  crown: { name: 'Корона Мудреца', icon: '👑', cost: 1250, tier: 2, sp: 40, mana: 90 },
  // ---- уровень 3: крупные ----
  cleaver: { name: 'Секира Раскола', icon: '🪓', cost: 1300, tier: 3, atk: 14, hp: 250 },
  bastion: { name: 'Латы Бастиона', icon: '🏰', cost: 1300, tier: 3, arm: 38, hp: 250 },
  thirst: { name: 'Жаждущий клинок', icon: '🩸', cost: 1400, tier: 3, atk: 16, ls: 0.15 },
  titan: { name: 'Сердце Титана', icon: '💗', cost: 1500, tier: 3, hp: 760, regen: 0.006 },
  abyss: { name: 'Посох Бездны', icon: '🔮', cost: 1500, tier: 3, sp: 65, mana: 40 },
  bow: { name: 'Лук Гиперзвука', icon: '🏹', cost: 1500, tier: 3, atk: 22 },
  reaper: { name: 'Коса Жнеца', icon: '⚰', cost: 1650, tier: 3, atk: 26, hp: 150 },
  stormblade: { name: 'Клинок Грома', icon: '⚡', cost: 1800, tier: 3, atk: 18, crit: 0.1 },
  wall: { name: 'Крепостная стена', icon: '🧱', cost: 1900, tier: 3, arm: 45, hp: 300 },
  grimoire: { name: 'Гримуар бездны', icon: '📕', cost: 1900, tier: 3, sp: 55, pen: 0.15 },
  // ответ на физический урон: против составов из стрелков и бойцов
  spikes: { name: 'Колючий панцирь', icon: '🦔', cost: 1700, tier: 3, arm: 60, hp: 200, thorns: 0.35 },
  stoneskin: { name: 'Плащ каменной кожи', icon: '🪨', cost: 1800, tier: 3, arm: 40, hp: 300, physRed: 0.25 },
  // ответы на другие перекосы состава: магию, лечение, контроль
  mantle: { name: 'Мантия чародея', icon: '🧙', cost: 1500, tier: 3, hp: 250, magRed: 0.25, manaRegen: 6 },
  blight: { name: 'Клинок скверны', icon: '🦠', cost: 1200, tier: 2, atk: 10, antiHeal: 0.4 },
  blightstaff: { name: 'Посох скверны', icon: '☠', cost: 1300, tier: 2, sp: 30, antiHeal: 0.4 },
  tenacity: { name: 'Амулет стойкости', icon: '🧿', cost: 1000, tier: 2, hp: 150, tenacity: 0.45 },
  // ---- уровень 4: легендарные поздние ----
  serpent: { name: 'Сердце древнего змея', icon: '🐉', cost: 3000, tier: 4, hp: 850, arm: 30, regen: 0.03 },
  stars: { name: 'Венец звёздного пламени', icon: '🌟', cost: 3300, tier: 4, sp: 90, mana: 120, cascPow: 0.15 },
  eclipse: { name: 'Затмение', icon: '🌑', cost: 3400, tier: 4, atk: 32, crit: 0.15, ls: 0.1 },
};
const ITEM_EFFECTS = {
  atk: v => `+${v} к атаке`, arm: v => `+${v} брони`, hp: v => `+${v} здоровья`, sp: v => `+${v} к силе умений`, mana: v => `+${v} маны`,
  ls: v => `вампиризм ${Math.round(v * 100)}%`, crit: v => `+${Math.round(v * 100)}% шанс крита ⚔`, pen: v => `пробивание брони ${Math.round(v * 100)}%`,
  thorns: v => `отражает ${Math.round(v * 100)}% физ. урона`, dodge: v => `+${Math.round(v * 100)}% уклонения от умений`, regen: v => `+${(v * 100).toFixed(1)}% здоровья в минуту`,
  manaRegen: v => `+${v} маны в минуту`, goldPow: v => `+${Math.round(v * 100)}% золота от ●`, towerPow: v => `+${Math.round(v * 100)}% урона по строениям`,
  cascPow: v => `каскады сильнее на ${Math.round(v * 100)}%`, shieldPow: v => `щиты сильнее на ${Math.round(v * 100)}%`, healPow: v => `лечение сильнее на ${Math.round(v * 100)}%`,
  visPow: v => `◉ сильнее на ${Math.round(v * 100)}%`, physRed: v => `−${Math.round(v * 100)}% получаемого физ. урона`, magRed: v => `−${Math.round(v * 100)}% получаемого магического урона`,
  antiHeal: v => `попадания режут лечение цели на ${Math.round(v * 100)}%`, tenacity: v => `${Math.round(v * 100)}% шанс стряхнуть оглушение, немоту, провокацию и якорь`,
};
const itemDesc = id => Object.entries(ITEMS[id]).filter(([k]) => ITEM_EFFECTS[k]).map(([k, v]) => ITEM_EFFECTS[k](v)).join(', ');
const ITEM_TIER_NAMES = ['', 'Простой', 'Средний', 'Крупный', 'Легендарный'];
const ELIXIR = { atk: 4, hp: 70, sp: 9, arm: 3 };

const DRAGONS = [
  { id: 'fire', name: 'Огненный дракон', icon: '🔥', color: '#ff6a3d', buff: '+8% урона от ⚔', soul: 'Душа пламени: +25% урона от ⚔' },
  { id: 'earth', name: 'Горный дракон', icon: '⛰', color: '#c79a5b', buff: '+8 брони', soul: 'Душа гор: +40 брони' },
  { id: 'ocean', name: 'Океанский дракон', icon: '🌊', color: '#3ec7ff', buff: '+2% здоровья в минуту', soul: 'Душа океана: +8% здоровья в минуту' },
  { id: 'cloud', name: 'Облачный дракон', icon: '🌪', color: '#d6e6ff', buff: '+6 маны в минуту', soul: 'Душа ветра: +25 маны в минуту' },
];

/* ---------- Вспомогательные функции умений ---------- */
const bestRowOf = (b, t) => U.maxBy([...Array(N).keys()], r => rowKeys(r).filter(k => b.at(k) && b.at(k).t === t).length);
const enemyNeeded = (G, h) => G.enemiesIn(h).length > 0;

/* ---------- 16 оригинальных героев ---------- */
const HEROES = [
  /* ======== ВЕРХНЯЯ ЛИНИЯ ======== */
  {
    id: 'frostgolem', name: 'Иней', title: 'Хрустальный голем', role: 'top', emoji: '❄', color: '#8fd4ff', img: 'img/heroes/frostgolem',
    mod: { hp: 1.05, arm: 1.12, atk: 0.95 },
    lore: 'Голем из вечного льда горных пиков: в его трещинах звенят кристаллы, о которые ломаются клинки.',
    passive: { name: 'Ледяной панцирь', desc: 'Щиты от 🛡 на 60% сильнее.', effects(G, h, c) { c.m.def *= 1.6; } },
    q: {
      name: 'Ледяной толчок', icon: '🧊', cost: 50, cd: 2, need: 'enemy',
      desc: 'Подрывает нижний ряд своего поля (камни срабатывают) и превращает 3 камня на поле врага в булыжники.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => b.convert(b.pick(g => b.plain(g), 3), T_STONE), '#b79c7a');
        await G.blast(h, rowKeys(N - 1));
      },
    },
    r: {
      name: 'Хрустальная крепость', icon: '💠', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Обрушивает на цель ледяную глыбу (урон растёт от числа ⚔ на поле), затем все ⚔ становятся 🛡, а союзники в событии получают мощный щит.',
      async cast(G, h) {
        const n = h.board.count(T_ATK);
        await G.skillDamage(h, G.target(h), G.sp(h, 60, 1.0) + n * h.power * 0.9, 'phys', '#b79c7a');
        await G.selfBoard(h, b => b.convert(b.keysOf(T_ATK), T_DEF));
        for (const a of G.alliesIn(h)) G.shieldHero(h, a, G.sp(h, 140, 1.4));
      },
    },
  },
  {
    id: 'runeknight', name: 'Торвальд', title: 'Рунный страж', role: 'top', emoji: '🛡', color: '#4a6fa5', img: 'img/heroes/runeknight',
    mod: { atk: 1.0, hp: 0.9, arm: 0.94 },
    lore: 'Закованный в латы страж с рунным мечом: каждая руна на клинке — клятва, которую он не нарушил.',
    passive: {
      name: 'Рунная сталь', desc: 'Совпадение из 4+ ⚔ создаёт на поле дополнительную линейную бомбу.',
      effects(G, h, c) { if (c.info.atkRuns.some(l => l >= 4)) c.after.push(() => G.selfBoardQuiet(h, b => b.pick(g => b.plain(g), 1).map(k => (b.convert([k], b.at(k).t, U.pick(['h', 'v'])), k)))); },
    },
    q: {
      name: 'Рунный разрез', icon: '🗡', cost: 70, cd: 5, need: 'none',
      desc: 'Подрывает ряд или столбец своего поля, где больше всего ⚔.',
      async cast(G, h) {
        const b = h.board;
        const lines = [...Array(N).keys()].flatMap(i => [rowKeys(i), colKeys(i)]);
        await G.blast(h, U.maxBy(lines, l => l.filter(x => b.at(x) && b.at(x).t === T_ATK).length));
      },
    },
    r: {
      name: 'Пламя рун', icon: '🔷', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Превращает 5 камней своего поля в ⚔, затем наносит цели урон за каждый ⚔ на поле.',
      async cast(G, h, t) {
        await G.selfBoardQuiet(h, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_ATK, 5), T_ATK));
        const n = h.board.count(T_ATK);
        await G.skillDamage(h, t, (4.5 + h.lvl * 0.9 + h.sp * 0.05) * n + h.power * 0.9, 'phys', '#5fd3c6');
        await G.settle(h, true);
      },
    },
  },
  {
    id: 'berserk', name: 'Ульв', title: 'Ярый берсерк', role: 'top', emoji: '🪓', color: '#a0522d', img: 'img/heroes/berserk',
    mod: { hp: 1.15, atk: 1.15 },
    lore: 'Северный воин с двумя топорами: чем глубже его раны, тем страшнее он в бою.',
    passive: { name: 'Упоение битвой', desc: '35% урона от ⚔ восстанавливает ему здоровье.', effects(G, h, c) { c.lifesteal += 0.35; } },
    q: {
      name: 'Рваные раны', icon: '🩸', cost: 50, cd: 2, need: 'enemy',
      desc: 'Все ✚ на поле врага превращаются в булыжники — враг теряет лечение.',
      ai: (G, h) => { const t = G.target(h); return t && t.board.count(T_HEAL) >= 3; },
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.convert(b.keysOf(T_HEAL).filter(k => !b.at(k).sp), T_STONE), '#c2304a'); },
    },
    r: {
      name: 'Ярость берсерка', icon: '🪓', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Поглощает все ✚ на своём поле: каждый наносит цели урон и лечит Ульва.',
      ai: (G, h) => h.board.count(T_HEAL) >= 3,
      async cast(G, h, t) {
        const keys = h.board.keysOf(T_HEAL);
        const n = keys.length;
        await G.selfBoardRemove(h, keys);
        await G.skillDamage(h, t, n * G.sp(h, 40, 0.35), 'phys', '#ff3355');
        G.healHero(h, h, n * (12 + h.lvl * 4));
      },
    },
  },

  /* ======== ЛЕС ======== */
  {
    id: 'wraith', name: 'Скорбь', title: 'Призрачный жнец', role: 'jng', emoji: '👻', color: '#4b4b63', img: 'img/heroes/wraith',
    mod: { atk: 1.1, hp: 0.92 },
    lore: 'Безликий жнец в рваном саване. Его ядовитый клинок светится там, где тень гуще всего.',
    passive: { name: 'Шёпот теней', desc: 'Шкала ганга заполняется от ◉ на 80% быстрее.', effects(G, h, c) { c.gankMul *= 1.8; } },
    q: {
      name: 'Саван тьмы', icon: '🌫', cost: 40, cd: 2, need: 'enemy',
      desc: 'Покрывает туманом 10 клеток поля цели: ИИ врага не видит камни под туманом.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.fogify(b.pick(g => !g.fog, 10)), '#8d7bb5'); },
    },
    r: {
      name: 'Ядовитая жатва', icon: '☠', cost: 100, cd: 4, lvl: 6, need: 'enemy',
      desc: 'Чистый урон: 120 + 45% недостающего здоровья цели. Убийство восстанавливает всю ману.',
      ai: (G, h) => { const t = G.target(h); return t && t.hp / t.maxHp < 0.55; },
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 120, 0.8) + (t.maxHp - t.hp) * 0.45, 'true', '#a77bff');
        if (t.dead) { h.mana = h.maxMana; G.ui.float(h, 'Мана восстановлена', '#3fe0f0'); }
      },
    },
  },
  {
    id: 'goblinrider', name: 'Шнырь', title: 'Гоблин-наездник', role: 'jng', emoji: '🐺', color: '#7c8c4a', img: 'img/heroes/goblinrider',
    mod: { hp: 1.08, sp: 1.3 },
    lore: 'Хитрый гоблин верхом на огромном волке: метает копья, ставит сети и лечит зверя травами.',
    passive: {
      name: 'Лесная добыча', desc: 'Лесные лагеря дают на 40% больше золота; ✚ лечат на 25% сильнее.',
      effects(G, h, c) { c.m.heal *= 1.25; }, campGold: 1.4,
    },
    q: {
      name: 'Ловчая сеть', icon: '🕸', cost: 45, cd: 2, need: 'enemy',
      desc: 'Опутывает сетью 7 камней поля цели: их нельзя двигать.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 7)), '#7bd97f'); },
    },
    r: {
      name: 'Шаманское зелье', icon: '🧪', cost: 110, cd: 5, lvl: 6, need: 'none',
      desc: 'Булыжники, лёд и туман на полях союзников в событии превращаются в ✚. Лечит всех союзников в событии.',
      ai: (G, h) => G.alliesIn(h).some(a => a.hp / a.maxHp < 0.6),
      async cast(G, h) {
        for (const a of G.alliesIn(h)) {
          await G.allyBoard(h, a, b => b.cleanse(T_HEAL), '#7bd97f');
          G.healHero(h, a, G.sp(h, 100, 1.0));
        }
      },
    },
  },
  {
    id: 'werewolf', name: 'Варг', title: 'Волчий воитель', role: 'jng', emoji: '🐾', color: '#8b6b4a', img: 'img/heroes/werewolf',
    mod: { hp: 1.1, arm: 1.1 },
    lore: 'Воин-оборотень с тяжёлым мечом. Его вой слышен за милю до того, как он врывается в бой.',
    passive: { name: 'Охотник на чудовищ', desc: 'Урон по Дракону, Барону и лесным монстрам +50%.', npcMul: 1.5 },
    q: {
      name: 'Волчий наскок', icon: '🐾', cost: 45, cd: 2, need: 'enemy',
      desc: 'Сносит поле цели: перемешивает все камни и добавляет 3 булыжника.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => { b.shuffleGems(); return b.convert(b.pick(g => b.plain(g), 3), T_STONE); }, '#d9902b');
      },
    },
    r: {
      name: 'Вой стаи', icon: '🌕', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Оглушает цель (она пропускает ход) и наносит урон. Вокруг Варга взрывается 3×3 своего поля.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 90, 0.8), 'magic', '#ffe066');
        G.stun(h, t);
        const c = U.ri(N - 2) + 1, r = U.ri(N - 2) + 1;
        const ks = []; for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) ks.push(y * N + x);
        await G.blast(h, ks);
      },
    },
  },

  /* ======== СРЕДНЯЯ ЛИНИЯ ======== */
  {
    id: 'sanddancer', name: 'Зарина', title: 'Танцующая с ятаганом', role: 'mid', emoji: '🌙', color: '#c9a86a', img: 'img/heroes/sanddancer',
    mod: { sp: 1.15 },
    lore: 'Пустынная танцовщица: её ятаган рисует в воздухе узоры, и песок сковывает врагов.',
    passive: { name: 'Ритм пустыни', desc: '◆ дают на 50% больше маны.', effects(G, h, c) { c.m.mana *= 1.5; } },
    q: {
      name: 'Песчаный вихрь', icon: '🌪', cost: 50, cd: 2, need: 'enemy',
      desc: 'Наносит урон и сковывает песком целый столбец поля цели.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 50, 0.6), 'magic', '#7fd6ff');
        await G.enemyBoard(h, t, b => b.freeze(colKeys(U.ri(N)).filter(k => b.at(k) && b.at(k).t !== T_STONE)), '#bdf3ff');
      },
    },
    r: {
      name: 'Песчаная буря', icon: '🏜', cost: 120, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Сковывает песком 12 клеток поля цели, затем наносит урон за каждую скованную клетку.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 12)), '#bdf3ff');
        const n = t.board.keys(g => g.ice).length;
        await G.skillDamage(h, t, n * G.sp(h, 12, 0.15), 'magic', '#7fd6ff');
      },
    },
  },
  {
    id: 'monk', name: 'Сун', title: 'Мастер ки', role: 'mid', emoji: '👊', color: '#6b8f7a', img: 'img/heroes/monk',
    mod: { sp: 1.05, hp: 1.0 },
    lore: 'Странствующий монах: его удары собирают внутреннюю силу и взрываются, как гром.',
    passive: { name: 'Вибрация ки', desc: 'Каждая взорванная бомба на его поле наносит цели доп. урон.', effects(G, h, c) { c.bombDmg += c.info.bombs * G.sp(h, 16, 0.17); } },
    q: {
      name: 'Сгусток ки', icon: '🌀', cost: 50, cd: 3, need: 'none',
      desc: 'Создаёт 2 бомбы на своём поле.',
      async cast(G, h) { await G.selfBoard(h, b => b.pick(g => b.plain(g), 2).map(k => (b.convert([k], b.at(k).t, 'bomb'), k))); },
    },
    r: {
      name: 'Сто ударов', icon: '👊', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Создаёт 4 бомбы на своём поле и мгновенно подрывает их все.',
      async cast(G, h) {
        const ks = h.board.pick(g => h.board.plain(g), 4);
        await G.selfBoardQuiet(h, b => b.convert(ks, T_ATK, 'bomb'));
        await G.blast(h, ks);
      },
    },
  },
  {
    id: 'psiblade', name: 'Кзайра', title: 'Псионический клинок', role: 'mid', emoji: '🗡', color: '#9acd32', img: 'img/heroes/psiblade',
    mod: { sp: 1.2, hp: 1.08 },
    lore: 'Воительница из иного мира с клинком, заряженным силой разума. Она питается чужой магией.',
    passive: {
      name: 'Поглощение разума', desc: 'Каждое совпадение ◆ крадёт 6 маны у цели.',
      effects(G, h, c) { if (c.counts[T_MANA] > 0) { const t = G.target(h); if (t) { const s = Math.min(t.mana, 6); t.mana -= s; h.mana = Math.min(h.maxMana, h.mana + s); } } },
    },
    q: {
      name: 'Ментальный разрез', icon: '🧠', cost: 50, cd: 2, need: 'enemy',
      desc: 'Наносит урон и даёт Кзайре щит; все ◆ на поле цели обращаются в булыжники; Кзайра крадёт по 4 маны за каждый.',
      async cast(G, h, t) {
        const n = t.board.keysOf(T_MANA).length;
        await G.skillDamage(h, t, G.sp(h, 65, 0.75), 'magic', '#a070ff');
        G.shieldHero(h, h, G.sp(h, 50, 0.5));
        await G.enemyBoard(h, t, b => b.convert(b.keysOf(T_MANA).filter(k => !b.at(k).sp), T_STONE), '#7a3cff');
        const s = Math.min(t.mana, n * 4); t.mana -= s; G.addMana(h, s);
      },
    },
    r: {
      name: 'Разрыв сознания', icon: '💫', cost: 120, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Стирает центр 3×3 поля цели (без эффекта) — там остаются булыжники. Мощный урон.',
      async cast(G, h, t) {
        const ks = []; for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) ks.push(y * N + x);
        await G.enemyBoard(h, t, b => b.convert(ks, T_STONE), '#7a3cff');
        await G.skillDamage(h, t, G.sp(h, 240, 1.55), 'magic', '#a070ff');
      },
    },
  },
  {
    id: 'windmage', name: 'Аэлла', title: 'Повелительница ветров', role: 'mid', emoji: '🌪', color: '#bcd7f5', img: 'img/heroes/windmage',
    mod: { sp: 1.05 },
    lore: 'Чародейка в белых одеждах: ветра несут ей вести со всей карты и рассеивают любой туман.',
    passive: { name: 'Вести ветра', desc: '◉ также дают ману (+3 за камень).', effects(G, h, c) { c.manaFlat += c.counts[T_VIS] * 3; } },
    q: {
      name: 'Режущие порывы', icon: '💨', cost: 50, cd: 3, need: 'none',
      desc: 'Превращает 3 случайных камня своего поля в линейные бомбы.',
      async cast(G, h) { await G.selfBoard(h, b => { const ks = b.pick(g => b.plain(g), 3); ks.forEach(k => b.convert([k], b.at(k).t, U.pick(['h', 'v']))); return ks; }); },
    },
    r: {
      name: 'Око бури', icon: '🌀', cost: 100, cd: 5, lvl: 6, need: 'none',
      desc: 'Развеивает туман на полях всех союзников и дарит Призму себе и одному союзнику в событии.',
      ai: (G, h) => G.alliesIn(h).length >= 2 || G.enemiesIn(h).length > 0,
      async cast(G, h) {
        for (const a of G.allTeam(h)) {
          const fog = a.board.keys(g => g.fog);
          if (fog.length) await G.allyBoard(h, a, b => { fog.forEach(k => { b.at(k).fog = 0; b.at(k).flash = 1; }); return fog; }, '#ffd86b', true);
        }
        for (const a of G.alliesIn(h).slice(0, 2)) await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g), 1), T_PRISM, 'prism'), '#fff3b0');
      },
    },
  },

  /* ======== СТРЕЛКИ ======== */
  {
    id: 'dwarfhunter', name: 'Бранд', title: 'Гномий охотник', role: 'adc', emoji: '🎯', color: '#8b5a2b', img: 'img/heroes/dwarfhunter',
    mod: { atk: 1.32, hp: 1.0, arm: 1.0 },
    lore: 'Гном-следопыт с тяжёлым арбалетом. Болт из него пробивает и щит, и стену.',
    passive: { name: 'Тяжёлый болт', desc: 'Совпадения из 4+ ⚔ наносят ×1.6 урона.', effects(G, h, c) { if (c.info.atkRuns.some(l => l >= 4)) { c.m.atk *= 1.6; c.label = 'КРИТ!'; } } },
    q: {
      name: 'Пробивной болт', icon: '➶', cost: 40, cd: 2, need: 'none',
      desc: 'Подрывает ряд своего поля, в котором больше всего ⚔.',
      async cast(G, h) { await G.blast(h, rowKeys(bestRowOf(h.board, T_ATK))); },
    },
    r: {
      name: 'Выстрел через полкарты', icon: '🎯', cost: 100, cd: 5, lvl: 6, need: 'global',
      desc: 'Глобальный чистый урон по врагу с наименьшим здоровьем — в любой точке карты.',
      ai: (G, h) => G.allEnemies(h).some(e => e.hp / e.maxHp < 0.4),
      async cast(G, h) {
        const t = U.minBy(G.allEnemies(h), e => e.hp / e.maxHp);
        if (t) await G.skillDamage(h, t, G.sp(h, 100, 0.5) + h.power * 3.2, 'true', '#ffcf6b');
      },
    },
  },
  {
    id: 'elfarcher', name: 'Лиэн', title: 'Изумрудный лучник', role: 'adc', emoji: '🏹', color: '#3c8d3c', img: 'img/heroes/elfarcher',
    mod: { atk: 1.14 },
    lore: 'Эльф-лучник в изумрудном плаще. Ветер и лес помогают его стрелам находить цель.',
    passive: {
      name: 'Лесной ритм', desc: 'Каждый третий ход с совпадением ⚔ наносит ×1.3 урона.',
      effects(G, h, c) { if (c.counts[T_ATK] > 0 && c.info.cascade === 0) { h.mem.rhythm = (h.mem.rhythm || 0) + 1; if (h.mem.rhythm % 3 === 0) { c.m.atk *= 1.3; c.label = 'РИТМ ×1.3'; } } },
    },
    q: {
      name: 'Изумрудная стрела', icon: '🍃', cost: 60, cd: 3, need: 'none',
      desc: 'До 3 ● золота на своём поле становятся ⚔.',
      ai: (G, h) => h.board.count(T_GOLD) >= 5,
      async cast(G, h) { await G.selfBoard(h, b => b.convert(U.shuffle(b.keysOf(T_GOLD).filter(k => !b.at(k).sp)).slice(0, 3), T_ATK)); },
    },
    r: {
      name: 'Ливень стрел', icon: '🌧', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Урон всем врагам в событии, а каждый союзник в событии получает бомбу ⚔ на поле.',
      async cast(G, h) {
        for (const e of G.enemiesIn(h)) await G.skillDamage(h, e, G.sp(h, 50, 0.4) + h.power * 1.8, 'phys', '#ffb4c4');
        for (const a of G.alliesIn(h)) await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g), 1), T_ATK, 'bomb'), '#ffb4c4');
      },
    },
  },
  {
    id: 'ratking', name: 'Шмыг', title: 'Крысиный проныра', role: 'adc', emoji: '🐀', color: '#6b5a3a', img: 'img/heroes/ratking',
    mod: { atk: 1.18, hp: 1.15, arm: 1.15 },
    lore: 'Крыса-проныра с парой кинжалов. Обожает золото, ставит капканы и метает ножи из-за угла.',
    passive: { name: 'Нюх на золото', desc: '● золото приносит на 35% больше, а ⚔ бьют на 18% сильнее.', effects(G, h, c) { c.m.gold *= 1.35; c.m.atk *= 1.18; } },
    q: {
      name: 'Капкан', icon: '🪤', cost: 45, cd: 2, need: 'enemy',
      desc: 'Бьёт цель капканом, сковывает 4 камня на её поле и ставит линейную бомбу на своё поле.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 40, 0.4) + h.power * 2.2, 'phys', '#cfd8e3');
        await G.enemyBoard(h, t, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 4)), '#cfd8e3');
        await G.selfBoard(h, b => { const ks = b.pick(g => b.plain(g), 1); ks.forEach(k => b.convert([k], b.at(k).t, 'h')); return ks; });
      },
    },
    r: {
      name: 'Град ножей', icon: '🔪', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Урон всем врагам в событии и по 4 булыжника на поле каждого из них.',
      async cast(G, h) {
        for (const e of G.enemiesIn(h)) {
          await G.skillDamage(h, e, G.sp(h, 80, 0.7) + h.power * 4, 'phys', '#ffaa33');
          await G.enemyBoard(h, e, b => b.convert(b.pick(g => b.plain(g), 4), T_STONE), '#9aa7b8');
        }
      },
    },
  },

  /* ======== ПОДДЕРЖКА ======== */
  {
    id: 'paladin', name: 'Солара', title: 'Паладин солнца', role: 'sup', emoji: '☀', color: '#e8c66e', img: 'img/heroes/paladin',
    mod: { sp: 1.22, hp: 1.08 },
    lore: 'Рыцарь солнечного ордена в золотых латах. Её щит отражает свет, который исцеляет союзников.',
    passive: { name: 'Свет солнца', desc: '✚ также лечат самого раненого союзника в событии (100%).', effects(G, h, c) { c.healAlly += 1.0; } },
    q: {
      name: 'Солнечное благословение', icon: '🙏', cost: 40, cd: 1, need: 'none',
      desc: 'Сразу лечит самого раненого союзника в событии и превращает 5 камней на его поле в ✚.',
      ai: (G, h) => G.alliesIn(h).some(a => a.hp / a.maxHp < 0.75),
      async cast(G, h) {
        const a = U.minBy(G.alliesIn(h), x => x.hp / x.maxHp);
        G.healHero(h, a, G.sp(h, 90, 0.7));
        await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_HEAL, 5), T_HEAL), '#fff0a8');
      },
    },
    r: {
      name: 'Полуденное сияние', icon: '🌞', cost: 110, cd: 5, lvl: 6, need: 'none',
      desc: 'Обжигает врагов в событии светом, лечит всех союзников на карте и очищает их поля от булыжников, льда и тумана.',
      ai: (G, h) => U.sum(G.allTeam(h), a => 1 - a.hp / a.maxHp) > 0.7,
      async cast(G, h) {
        for (const e of G.enemiesIn(h)) await G.skillDamage(h, e, G.sp(h, 90, 0.7), 'magic', '#fff3a0');
        for (const a of G.allTeam(h)) {
          G.healHero(h, a, G.sp(h, 120, 1.2));
          await G.allyBoard(h, a, b => b.cleanse(null), '#fff7c2', true);
        }
      },
    },
  },
  {
    id: 'ogre', name: 'Грох', title: 'Огр-вышибала', role: 'sup', emoji: '🍖', color: '#8a8a5a', img: 'img/heroes/ogre',
    mod: { hp: 1.15, arm: 1.2 },
    lore: 'Огромный огр с дубиной. Хватает врагов ручищами и вбивает их в землю.',
    passive: { name: 'Широкая спина', desc: '🛡 также дают щит самому раненому союзнику в событии (40%).', effects(G, h, c) { c.shieldAlly += 0.4; } },
    q: {
      name: 'Хватка огра', icon: '✊', cost: 55, cd: 3, need: 'enemy',
      desc: 'Выдёргивает 3 ⚔ с поля цели (там остаются булыжники) и переносит их на своё поле.',
      ai: (G, h) => { const t = G.target(h); return t && t.board.count(T_ATK) >= 3; },
      async cast(G, h, t) {
        const ks = t.board.pick(g => g.t === T_ATK && !g.sp, 3);
        await G.enemyBoard(h, t, b => b.convert(ks, T_STONE), '#6f8fa8');
        await G.selfBoard(h, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_ATK, ks.length), T_ATK));
      },
    },
    r: {
      name: 'Сокрушительный удар', icon: '🏏', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Оглушает главную цель и сковывает по 4 клетки на полях двух врагов в событии.',
      async cast(G, h) {
        for (const [i, e] of G.enemiesIn(h).slice(0, 2).entries()) {
          if (i === 0) G.stun(h, e);
          await G.enemyBoard(h, e, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 4)), '#9fb6c9');
        }
      },
    },
  },
  {
    id: 'smuggler', name: 'Рэйф', title: 'Контрабандист', role: 'sup', emoji: '🎩', color: '#a0623a', img: 'img/heroes/smuggler',
    mod: { sp: 1.05 },
    lore: 'Обаятельный разбойник с саблей. Дымовые шашки, краплёные карты и тайные тропы — всё для команды.',
    passive: { name: 'Тайные тропы', desc: '◉ дают щит всем союзникам в событии.', effects(G, h, c) { c.visShield += c.counts[T_VIS] * (6 + h.lvl * 2); } },
    q: {
      name: 'Дымовая шашка', icon: '💨', cost: 40, cd: 2, need: 'enemy',
      desc: 'Перемешивает поле цели и скрывает 6 клеток туманом.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => { b.shuffleGems(); return b.fogify(b.pick(g => !g.fog, 6)); }, '#ff7ce0'); },
    },
    r: {
      name: 'Козырь в рукаве', icon: '🃏', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Каждый союзник в событии получает Призму на поле и +35 маны.',
      async cast(G, h) {
        for (const a of G.alliesIn(h)) {
          await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g), 1), T_PRISM, 'prism'), '#ffc6f2');
          G.addMana(a, 35);
        }
      },
    },
  },
  {
    id: 'shieldbearer', name: 'Кассиан', title: 'Щитоносец', role: 'top', emoji: '🔰', color: '#8a7a5a', img: 'img/heroes/shieldbearer',
    mod: { hp: 1.15, arm: 1.2, atk: 0.95 },
    lore: 'Ветеран фаланги с ростовым щитом и копьём. Встаёт между врагом и товарищами — и не отступает.',
    passive: { name: 'Фаланга', desc: 'Принимает на себя 25% урона, который получают союзники в его событии.', phalanx: 0.25 },
    q: {
      name: 'Вызов', icon: '📯', cost: 45, cd: 3, need: 'enemy',
      desc: 'Провоцирует всех врагов в событии: до конца следующей минуты они бьют только Кассиана. Сам получает щит.',
      ai: (G, h) => G.enemiesIn(h).length >= 1 && G.alliesIn(h).length >= 2 && h.hp / h.maxHp > 0.45,
      async cast(G, h) {
        G.taunt(h, G.enemiesIn(h), 1);
        G.shieldHero(h, h, G.sp(h, 60, 0.6));
        await G.selfBoardQuiet(h, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_DEF, 3), T_DEF));
      },
    },
    r: {
      name: 'Стена щитов', icon: '🧱', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Союзники в событии на 2 минуты получают зеркальный щит: первое вражеское умение, меняющее их поле, отражается на поле заклинателя.',
      ai: (G, h) => G.alliesIn(h).length >= 2,
      async cast(G, h) {
        for (const a of G.alliesIn(h)) { a.reflect = 3; G.ui.float(a, '🔰 ЗЕРКАЛО', '#ffe9a8'); G.shieldHero(h, a, G.sp(h, 30, 0.3)); }
        await G.selfBoardQuiet(h, b => { b.glow = 1; });
      },
    },
  },
  {
    id: 'spidertinker', name: 'Винтик', title: 'Механический паук', role: 'jng', emoji: '🕷', color: '#b87333', img: 'img/heroes/spidertinker',
    mod: { atk: 1.05 },
    lore: 'Гном-изобретатель верхом на заводном пауке. Из каждого убитого монстра выковыривает детали для брони.',
    passive: { name: 'Металлолом', desc: 'За каждого убитого монстра или эпика: +4 брони и +3 атаки до конца матча.', scrap: true },
    q: {
      name: 'Паучьи мины', icon: '💣', cost: 45, cd: 2, need: 'enemy',
      desc: 'Прячет 3 мины под камнями на поле цели. Когда такой камень уничтожают, мина взрывается: урон владельцу поля и −15 маны.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.mine(b.pick(g => b.plain(g) && !g.mine, 3), h.id), '#ff7a45'); },
    },
    r: {
      name: 'Перегрузка', icon: '⚙', cost: 110, cd: 5, lvl: 6, need: 'none',
      desc: 'Поворачивает своё поле на 90° (до 3 раз, пока не появятся совпадения) и разряжает его с бонусом к каскадам.',
      ai: (G, h) => G.enemiesIn(h).length > 0 || (h.ev && h.ev.type === 'jungle'),
      async cast(G, h) {
        const b = h.board;
        for (let i = 0; i < 3; i++) { b.rotate90(); b.glow = 1; await wait(350); if (b.hasAnyMatch()) break; }
        if (b.hasAnyMatch()) await G.resolve(h, { cascadeStart: 1 });
        else if (!b.hasMoves()) b.shuffleGems();
      },
    },
  },
  {
    id: 'necromancer', name: 'Валдрек', title: 'Некромант', role: 'mid', emoji: '💀', color: '#5a3d6b', img: 'img/heroes/necromancer',
    mod: { sp: 1.18, hp: 1.05 },
    lore: 'Повелитель костей и гнили. Каждая смерть поблизости делает его сильнее, а павших союзников он умеет поднимать.',
    passive: { name: 'Жатва душ', desc: 'Каждая смерть героя в его событии даёт душу: +8 силы умений до конца матча (до 20 душ).', souls: true },
    q: {
      name: 'Порча', icon: '🦠', cost: 50, cd: 2, need: 'enemy',
      desc: 'Бьёт цель и гноит 4 камня на её поле. Гнилые камни не дают эффекта при сборе, а каждую минуту гниль переходит на соседние камни (до 10 на поле).',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 65, 0.8), 'magic', '#7bd36b');
        await G.enemyBoard(h, t, b => b.rot(b.pick(g => b.plain(g) && !g.rot, 4)), '#7bd36b');
      },
    },
    r: {
      name: 'Восстание', icon: '⚰', cost: 120, cd: 6, lvl: 6, need: 'none',
      desc: 'Немедленно поднимает павшего союзника (45% здоровья, на базе). Если павших нет — гноит по 4 камня у всех врагов в событии.',
      ai: (G, h) => G.teams[h.team].heroes.some(x => !x.alive && x.dead >= 2) || G.enemiesIn(h).length >= 2,
      async cast(G, h) {
        const dead = G.teams[h.team].heroes.filter(x => !x.alive);
        if (dead.length) { G.revive(h, U.maxBy(dead, x => x.dead * 10 + x.lvl)); return; }
        for (const e of G.enemiesIn(h)) await G.enemyBoard(h, e, b => b.rot(b.pick(g => b.plain(g) && !g.rot, 4)), '#7bd36b');
      },
    },
  },
  {
    id: 'seawitch', name: 'Ундина', title: 'Морская ведьма', role: 'sup', emoji: '🐙', color: '#3a7bd5', img: 'img/heroes/seawitch',
    mod: { sp: 1.05, hp: 1.05 },
    lore: 'Хозяйка глубин с щупальцами вместо ног. Её водовороты путают камни, а объятия лишают голоса.',
    passive: { name: 'Солёные глубины', desc: 'Враги в её событии получают на 20% больше урона от ⚔.', vuln: 0.2 },
    q: {
      name: 'Водоворот', icon: '🌀', cost: 45, cd: 2, need: 'enemy',
      desc: 'Бьёт цель волной и закручивает кольцо из 8 клеток на её поле так, чтобы сломать ходы; особые камни в кольце смываются.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 45, 0.5), 'magic', '#5ec8ff');
        const sc = t.board.keys(g => g.sp && g.t !== T_PRISM).map(k => [kr(k), kc(k)]).filter(([r, c]) => r > 0 && c > 0 && r < N - 1 && c < N - 1);
        const [r0, c0] = sc.length ? U.pick(sc) : [1 + U.ri(N - 2), 1 + U.ri(N - 2)];
        await G.enemyBoard(h, t, b => b.worstOf([2, 3, 5, 6].map(n => (bb, dry) => bb.ringRotate(r0, c0, n, dry))), '#5ec8ff');
      },
    },
    r: {
      name: 'Объятия глубин', icon: '🐙', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'До 3 врагов в событии получают урон, немеют на 2 минуты (не могут применять умения) и теряют 25% маны.',
      async cast(G, h) {
        for (const e of G.enemiesIn(h).slice(0, 3)) {
          G.ui.projectile(h, e, '#3a7bd5', true); await wait(300);
          if (G.dodges(h, e)) { G.ui.float(e, 'УВЕРНУЛСЯ', '#fff'); continue; }
          G.silence(h, e, 2); e.mana *= 0.75;
          await G.skillDamage(h, e, G.sp(h, 60, 0.5), 'magic', '#3a7bd5');
        }
      },
    },
  },
  {
    id: 'crabpirate', name: 'Клешнир', title: 'Пират-краб', role: 'adc', emoji: '🦀', color: '#d2462e', img: 'img/heroes/crabpirate',
    mod: { atk: 1.12, hp: 1.1, arm: 1.1 },
    lore: 'Капитан-краб с пушкой на клешне. Палит бортовыми залпами, бросает якорь и забирает добычу у павших.',
    passive: { name: 'Абордаж', desc: 'Убийство или помощь отбирает у жертвы 25% её золота. Крабий панцирь: больше здоровья и брони, чем у других стрелков.', plunder: 0.25 },
    q: {
      name: 'Бортовой залп', icon: '💥', cost: 45, cd: 2, need: 'enemy',
      desc: 'Бьёт цель и сдвигает 3 ряда её поля по кругу так, чтобы сломать ей ходы; затем «перезаряжается» — сдвигает один свой ряд в самое выгодное положение.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 40, 0.3) + h.power * 1.8, 'phys', '#d2462e');
        // из 6 случайных залпов выбирается тот, что сильнее всего ломает ходы цели
        const cands = Array.from({ length: 6 }, () => { const rows = U.shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3), sh = rows.map(() => U.pick([1, 2, -1, -2])); return (b, dry) => rows.forEach((r, i) => b.shiftRow(r, sh[i], dry)); });
        await G.enemyBoard(h, t, b => b.worstOf(cands), '#d2462e');
        // перезарядка: свой ряд сдвигается так, чтобы собрать как можно больше ⚔
        const own = [];
        for (let r = 0; r < N; r++) for (const n of [1, 2, 3, -1, -2, -3]) own.push((b, dry) => b.shiftRow(r, n, dry));
        if (h.alive) await G.selfBoard(h, b => b.bestOf(own));
      },
    },
    r: {
      name: 'Якорь', icon: '⚓', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Бросает якорь в цель: 2 минуты она не может покинуть событие или уйти на базу и получает на 20% больше урона.',
      async cast(G, h, t) {
        G.ui.projectile(h, t, '#c8d2e0', true); await wait(350);
        G.anchor(h, t, 2);
        await G.skillDamage(h, t, G.sp(h, 60, 0.5) + h.power * 2.8, 'phys', '#c8d2e0');
      },
    },
  },
  {
    id: 'bonebard', name: 'Ноктюрн', title: 'Скелет-бард', role: 'sup', emoji: '🎻', color: '#7d6aa8', img: 'img/heroes/bonebard',
    mod: { hp: 0.95, sp: 1.05 },
    lore: 'Бард, которого не остановила даже смерть. Его скрипка поднимает дух живых — и задаёт им ритм.',
    passive: { name: 'Похоронный марш', desc: 'Каждые 3 совпадения союзников в его событии — куплет (до 3): +5% к эффектам камней союзников за куплет. Вне боя куплеты затихают.', march: true },
    q: {
      name: 'Баллада вдохновения', icon: '🎵', cost: 50, cd: 3, need: 'none',
      desc: 'Союзник в событии (не сам бард) немедленно делает дополнительный ход.',
      ai: (G, h) => G.alliesIn(h).length >= 2 && G.enemiesIn(h).length > 0,
      async cast(G, h) {
        const al = G.alliesIn(h).filter(a => a !== h);
        if (!al.length) return;
        const a = U.maxBy(al, x => x.power + x.sp * 0.5);
        G.ui.projectile(h, a, '#e0c3ff', true); await wait(300);
        await G.bonusMove(a);
      },
    },
    r: {
      name: 'Реквием', icon: '🎼', cost: 120, cd: 7, lvl: 6, need: 'none',
      desc: 'Сбрасывает перезарядку умений союзников в событии и даёт каждому по 30 маны.',
      ai: (G, h) => G.alliesIn(h).filter(a => a !== h && (a.cd.q > 0 || a.cd.r > 0)).length >= 1,
      async cast(G, h) {
        for (const a of G.alliesIn(h)) {
          if (a !== h) { a.cd.q = 0; a.cd.r = 0; }
          G.addMana(a, 30);
          if (a !== h) G.ui.projectile(h, a, '#e0c3ff');
        }
        G.ui.log(`🎼 ${G.tag(h)} играет Реквием — умения союзников снова готовы!`, h.team);
      },
    },
  },
];


/* ---------- Пригодность героев к ролям ----------
   Герой подходит на любую роль; метки подсказывают ИИ, где он силён.
   fit: 3 — родная роль, 2 — хорошо подходит, 1 — терпимо, 0 — плохо.
   tags — роль в составе: tank, heal, control, burst, dps, utility, vision, sustain */
const HERO_FIT = {
  frostgolem: { fit: { top: 3, jng: 1, mid: 0, adc: 0, sup: 2 }, tags: ['tank', 'control'] },
  runeknight: { fit: { top: 3, jng: 2, mid: 2, adc: 1, sup: 0 }, tags: ['burst', 'dps'] },
  berserk: { fit: { top: 3, jng: 2, mid: 1, adc: 0, sup: 0 }, tags: ['sustain', 'dps'] },
  wraith: { fit: { top: 1, jng: 3, mid: 2, adc: 0, sup: 0 }, tags: ['burst', 'vision'] },
  goblinrider: { fit: { top: 1, jng: 3, mid: 1, adc: 0, sup: 2 }, tags: ['heal', 'control'] },
  werewolf: { fit: { top: 2, jng: 3, mid: 0, adc: 0, sup: 2 }, tags: ['tank', 'control'] },
  sanddancer: { fit: { top: 0, jng: 0, mid: 3, adc: 1, sup: 2 }, tags: ['control', 'burst'] },
  monk: { fit: { top: 1, jng: 0, mid: 3, adc: 2, sup: 0 }, tags: ['burst'] },
  psiblade: { fit: { top: 1, jng: 1, mid: 3, adc: 0, sup: 1 }, tags: ['control', 'burst'] },
  windmage: { fit: { top: 0, jng: 0, mid: 3, adc: 1, sup: 2 }, tags: ['utility', 'vision'] },
  dwarfhunter: { fit: { top: 0, jng: 0, mid: 2, adc: 3, sup: 0 }, tags: ['dps'] },
  elfarcher: { fit: { top: 0, jng: 0, mid: 1, adc: 3, sup: 1 }, tags: ['dps'] },
  ratking: { fit: { top: 1, jng: 0, mid: 1, adc: 3, sup: 1 }, tags: ['dps', 'control'] },
  paladin: { fit: { top: 0, jng: 0, mid: 1, adc: 0, sup: 3 }, tags: ['heal', 'utility'] },
  ogre: { fit: { top: 2, jng: 1, mid: 0, adc: 0, sup: 3 }, tags: ['tank', 'control'] },
  smuggler: { fit: { top: 0, jng: 1, mid: 1, adc: 0, sup: 3 }, tags: ['utility', 'vision'] },
  shieldbearer: { fit: { top: 3, jng: 1, mid: 0, adc: 0, sup: 2 }, tags: ['tank', 'control'] },
  spidertinker: { fit: { top: 2, jng: 3, mid: 1, adc: 1, sup: 0 }, tags: ['burst', 'control'] },
  necromancer: { fit: { top: 0, jng: 0, mid: 3, adc: 1, sup: 2 }, tags: ['control', 'utility'] },
  seawitch: { fit: { top: 0, jng: 1, mid: 2, adc: 0, sup: 3 }, tags: ['control', 'utility'] },
  crabpirate: { fit: { top: 1, jng: 0, mid: 1, adc: 3, sup: 0 }, tags: ['dps', 'control'] },
  bonebard: { fit: { top: 0, jng: 0, mid: 1, adc: 0, sup: 3 }, tags: ['utility'] },
};
const FIT_NAMES = ['плохо', 'терпимо', 'хорошо', 'родная роль'];
const TAG_NAMES = { tank: 'танк', heal: 'лекарь', control: 'контроль', burst: 'взрывной урон', dps: 'постоянный урон', utility: 'поддержка', vision: 'обзор', sustain: 'живучесть' };
for (const h of HEROES) { h.fit = HERO_FIT[h.id].fit; h.tags = HERO_FIT[h.id].tags; h.main = h.role; }

/* Патч и мета текущей кампании: изменение силы героев (доля, например −0.04) и оценка меты.
   Вне кампании пусты. Заполняются из лиги функцией applyLeagueMeta. */
var HERO_PATCH = {};
var HERO_META = {};
/* Правка героя в патче: stat — сила героя (здоровье, атака, сила умений), q/r — сила умений, p — пассивка */
function patchMod(id, key) { const m = HERO_PATCH[id]; if (!m) return 0; if (typeof m === 'number') return key === 'stat' ? m : 0; return m[key] || 0; }
const PATCH_KEYS = { stat: 'сила героя', q: 'умение Q', r: 'ульта', p: 'пассивка' };
