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
  adc: { hp: 510, hpG: 72, atk: 19, atkG: 3.0, arm: 17, armG: 2.2, mana: 100, sp: 20, spG: 4 },
  sup: { hp: 560, hpG: 80, atk: 12, atkG: 1.6, arm: 24, armG: 2.8, mana: 140, sp: 35, spG: 6 },
};

const ITEMS = {
  sword: { name: 'Длинный клинок', icon: '🗡', cost: 400, atk: 6 },
  vest: { name: 'Кольчуга', icon: '🥋', cost: 350, arm: 14 },
  ruby: { name: 'Рубин жизни', icon: '♥', cost: 400, hp: 160 },
  tome: { name: 'Том чар', icon: '📘', cost: 435, sp: 22, mana: 30 },
  cleaver: { name: 'Секира Раскола', icon: '🪓', cost: 1300, atk: 14, hp: 250 },
  thirst: { name: 'Жаждущий клинок', icon: '🩸', cost: 1400, atk: 16, ls: 0.15 },
  bastion: { name: 'Латы Бастиона', icon: '🏰', cost: 1300, arm: 38, hp: 250 },
  titan: { name: 'Сердце Титана', icon: '💗', cost: 1500, hp: 650 },
  abyss: { name: 'Посох Бездны', icon: '🔮', cost: 1500, sp: 65, mana: 40 },
  crown: { name: 'Корона Мудреца', icon: '👑', cost: 1250, sp: 40, mana: 90 },
  bow: { name: 'Лук Гиперзвука', icon: '🏹', cost: 1500, atk: 22 },
  reaper: { name: 'Коса Жнеца', icon: '⚰', cost: 1650, atk: 26, hp: 150 },
  aegis: { name: 'Эгида Союза', icon: '🔰', cost: 1100, arm: 24, hp: 200, shieldPow: 0.25 },
  censer: { name: 'Кадило Света', icon: '🕯', cost: 1100, sp: 28, healPow: 0.3 },
  ward: { name: 'Око Стража', icon: '👁', cost: 600, hp: 120, visPow: 0.5 },
};
const ELIXIR = { atk: 4, hp: 70, sp: 9, arm: 3 };
const BUILDS = {
  top: ['sword', 'ruby', 'cleaver', 'vest', 'bastion', 'titan', 'reaper', 'thirst'],
  jng: ['sword', 'vest', 'thirst', 'ruby', 'cleaver', 'bastion', 'reaper', 'titan'],
  mid: ['tome', 'ruby', 'crown', 'abyss', 'vest', 'abyss', 'titan', 'bastion'],
  adc: ['sword', 'sword', 'thirst', 'bow', 'vest', 'reaper', 'bow', 'bastion'],
  sup: ['ward', 'tome', 'aegis', 'censer', 'ruby', 'bastion', 'titan', 'crown'],
};

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
    id: 'granitor', name: 'Гранитор', title: 'Каменный Колосс', role: 'top', emoji: '🗿', color: '#9c8466',
    mod: { hp: 1.12, arm: 1.25, atk: 1.0 },
    lore: 'Ожившая скала с перевала, что принимает удары за всю команду.',
    passive: { name: 'Гранитная кожа', desc: 'Щиты от 🛡 на 60% сильнее.', effects(G, h, c) { c.m.def *= 1.6; } },
    q: {
      name: 'Сотрясение', icon: '💥', cost: 50, cd: 2, need: 'enemy',
      desc: 'Подрывает два нижних ряда своего поля (камни срабатывают) и превращает 3 камня на поле врага в булыжники.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => b.convert(b.pick(g => b.plain(g), 3), T_STONE), '#b79c7a');
        await G.blast(h, [...rowKeys(N - 2), ...rowKeys(N - 1)]);
      },
    },
    r: {
      name: 'Несокрушимость', icon: '🏔', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Обрушивает скалу на цель (урон растёт от числа ⚔ на поле), затем все ⚔ становятся 🛡, а союзники в событии получают мощный щит.',
      async cast(G, h) {
        const n = h.board.count(T_ATK);
        await G.skillDamage(h, G.target(h), G.sp(h, 60, 1.0) + n * h.power * 1.2, 'phys', '#b79c7a');
        await G.selfBoard(h, b => b.convert(b.keysOf(T_ATK), T_DEF));
        for (const a of G.alliesIn(h)) G.shieldHero(h, a, G.sp(h, 140, 1.4));
      },
    },
  },
  {
    id: 'veila', name: 'Вейла', title: 'Клинок Ветра', role: 'top', emoji: '🌪', color: '#5fd3c6',
    mod: { atk: 1.0, hp: 0.95 },
    lore: 'Странствующая мечница, чьи удары подхватывает горный ветер.',
    passive: {
      name: 'Танец стали', desc: 'Совпадение из 4+ ⚔ создаёт на поле дополнительную линейную бомбу.',
      effects(G, h, c) { if (c.info.atkRuns.some(l => l >= 4)) c.after.push(() => G.selfBoardQuiet(h, b => b.pick(g => b.plain(g), 1).map(k => (b.convert([k], b.at(k).t, U.pick(['h', 'v'])), k)))); },
    },
    q: {
      name: 'Вихрь', icon: '🌀', cost: 70, cd: 4, need: 'none',
      desc: 'Подрывает ряд или столбец своего поля, где больше всего ⚔.',
      async cast(G, h) {
        const b = h.board;
        const lines = [...Array(N).keys()].flatMap(i => [rowKeys(i), colKeys(i)]);
        await G.blast(h, U.maxBy(lines, l => l.filter(x => b.at(x) && b.at(x).t === T_ATK).length));
      },
    },
    r: {
      name: 'Буря клинков', icon: '⚔', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Превращает 5 камней своего поля в ⚔, затем наносит цели урон за каждый ⚔ на поле.',
      async cast(G, h, t) {
        await G.selfBoardQuiet(h, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_ATK, 5), T_ATK));
        const n = h.board.count(T_ATK);
        await G.skillDamage(h, t, (8 + h.lvl * 1.5 + h.sp * 0.08) * n + h.power * 1.3, 'phys', '#5fd3c6');
        await G.settle(h, true);
      },
    },
  },
  {
    id: 'morven', name: 'Морвен', title: 'Кровавый Шип', role: 'top', emoji: '🩸', color: '#c2304a',
    mod: { hp: 1.15, atk: 1.15 },
    lore: 'Рыцарь проклятого сада, питающийся чужой жизнью.',
    passive: { name: 'Жажда крови', desc: '35% урона от ⚔ восстанавливает ему здоровье.', effects(G, h, c) { c.lifesteal += 0.35; } },
    q: {
      name: 'Шипастые лозы', icon: '🌹', cost: 50, cd: 2, need: 'enemy',
      desc: 'Все ✚ на поле врага превращаются в булыжники — враг теряет лечение.',
      ai: (G, h) => { const t = G.target(h); return t && t.board.count(T_HEAL) >= 3; },
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.convert(b.keysOf(T_HEAL).filter(k => !b.at(k).sp), T_STONE), '#c2304a'); },
    },
    r: {
      name: 'Кровавая жатва', icon: '🩸', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Поглощает все ✚ на своём поле: каждый наносит цели урон и лечит Морвена.',
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
    id: 'xar', name: 'Ксар', title: 'Теневой Охотник', role: 'jng', emoji: '🗡', color: '#6b4fa3',
    mod: { atk: 1.1, hp: 0.92 },
    lore: 'Убийца из сумеречных чащ. Его не видно, пока не стало слишком поздно.',
    passive: { name: 'Охотничий инстинкт', desc: 'Шкала ганга заполняется от ◉ на 80% быстрее.', effects(G, h, c) { c.gankMul *= 1.8; } },
    q: {
      name: 'Дымовая завеса', icon: '🌫', cost: 40, cd: 2, need: 'enemy',
      desc: 'Покрывает туманом 10 клеток поля цели: ИИ врага не видит камни под туманом.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.fogify(b.pick(g => !g.fog, 10)), '#8d7bb5'); },
    },
    r: {
      name: 'Казнь из тени', icon: '☠', cost: 100, cd: 4, lvl: 6, need: 'enemy',
      desc: 'Чистый урон: 120 + 45% недостающего здоровья цели. Убийство восстанавливает всю ману.',
      ai: (G, h) => { const t = G.target(h); return t && t.hp / t.maxHp < 0.55; },
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 120, 0.8) + (t.maxHp - t.hp) * 0.45, 'true', '#a77bff');
        if (t.dead) { h.mana = h.maxMana; G.ui.float(h, 'Мана восстановлена', '#3fe0f0'); }
      },
    },
  },
  {
    id: 'lira', name: 'Лира', title: 'Хранительница Рощ', role: 'jng', emoji: '🌿', color: '#4caf50',
    mod: { hp: 1.0, sp: 1.2 },
    lore: 'Дриада, которой подчиняются корни и лесные звери.',
    passive: {
      name: 'Дары леса', desc: 'Лесные лагеря дают на 40% больше золота; ✚ лечат на 25% сильнее.',
      effects(G, h, c) { c.m.heal *= 1.25; }, campGold: 1.4,
    },
    q: {
      name: 'Корни', icon: '🌱', cost: 45, cd: 2, need: 'enemy',
      desc: 'Сковывает льдом-корнями 7 камней поля цели: их нельзя двигать.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 7)), '#7bd97f'); },
    },
    r: {
      name: 'Цветение', icon: '🌸', cost: 110, cd: 5, lvl: 6, need: 'none',
      desc: 'Булыжники, лёд и туман на полях союзников в событии расцветают в ✚. Лечит всех союзников в событии.',
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
    id: 'bronn', name: 'Бронн', title: 'Громовой Кабан', role: 'jng', emoji: '🐗', color: '#d9902b',
    mod: { hp: 1.1, arm: 1.1 },
    lore: 'Гигантский кабан, несущий на клыках грозовые разряды.',
    passive: { name: 'Гроза эпиков', desc: 'Урон по Дракону, Барону и лесным монстрам +50%.', npcMul: 1.5 },
    q: {
      name: 'Таран', icon: '🐗', cost: 45, cd: 2, need: 'enemy',
      desc: 'Сносит поле цели: перемешивает все камни и добавляет 3 булыжника.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => { b.shuffleGems(); return b.convert(b.pick(g => b.plain(g), 3), T_STONE); }, '#d9902b');
      },
    },
    r: {
      name: 'Громовой рывок', icon: '⚡', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Оглушает цель (она пропускает ход) и наносит урон. Вокруг Бронна взрывается 3×3 своего поля.',
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
    id: 'eira', name: 'Эйра', title: 'Ледяная Чародейка', role: 'mid', emoji: '❄', color: '#7fd6ff',
    mod: { sp: 1.15 },
    lore: 'Волшебница вечной мерзлоты, замораживающая само время.',
    passive: { name: 'Холодный разум', desc: '◆ дают на 50% больше маны.', effects(G, h, c) { c.m.mana *= 1.5; } },
    q: {
      name: 'Ледяное копьё', icon: '🧊', cost: 50, cd: 2, need: 'enemy',
      desc: 'Наносит урон и замораживает целый столбец поля цели.',
      async cast(G, h, t) {
        await G.skillDamage(h, t, G.sp(h, 50, 0.6), 'magic', '#7fd6ff');
        await G.enemyBoard(h, t, b => b.freeze(colKeys(U.ri(N)).filter(k => b.at(k) && b.at(k).t !== T_STONE)), '#bdf3ff');
      },
    },
    r: {
      name: 'Вечная зима', icon: '❄', cost: 120, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Замораживает 12 клеток поля цели, затем наносит урон за каждую замороженную клетку.',
      async cast(G, h, t) {
        await G.enemyBoard(h, t, b => b.freeze(b.pick(g => !g.ice && g.t !== T_STONE, 12)), '#bdf3ff');
        const n = t.board.keys(g => g.ice).length;
        await G.skillDamage(h, t, n * G.sp(h, 12, 0.15), 'magic', '#7fd6ff');
      },
    },
  },
  {
    id: 'piro', name: 'Пиро', title: 'Огненный Шут', role: 'mid', emoji: '🔥', color: '#ff7b2e',
    mod: { sp: 1.1 },
    lore: 'Безумный фокусник, для которого взрыв — лучшая шутка.',
    passive: { name: 'Пиромания', desc: 'Каждая взорванная бомба на его поле наносит цели доп. урон.', effects(G, h, c) { c.bombDmg += c.info.bombs * G.sp(h, 25, 0.25); } },
    q: {
      name: 'Фейерверк', icon: '🎆', cost: 50, cd: 3, need: 'none',
      desc: 'Создаёт 2 бомбы на своём поле.',
      async cast(G, h) { await G.selfBoard(h, b => b.pick(g => b.plain(g), 2).map(k => (b.convert([k], b.at(k).t, 'bomb'), k))); },
    },
    r: {
      name: 'Инферно', icon: '☄', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Создаёт 4 бомбы на своём поле и мгновенно подрывает их все.',
      async cast(G, h) {
        const ks = h.board.pick(g => h.board.plain(g), 4);
        await G.selfBoardQuiet(h, b => b.convert(ks, T_ATK, 'bomb'));
        await G.blast(h, ks);
      },
    },
  },
  {
    id: 'nox', name: 'Нокс', title: 'Вестник Пустоты', role: 'mid', emoji: '🌀', color: '#7a3cff',
    mod: { sp: 1.15, hp: 1.05 },
    lore: 'Существо из-за грани, пожирающее чужую магию.',
    passive: {
      name: 'Пожиратель', desc: 'Каждое совпадение ◆ крадёт 6 маны у цели.',
      effects(G, h, c) { if (c.counts[T_MANA] > 0) { const t = G.target(h); if (t) { const s = Math.min(t.mana, 6); t.mana -= s; h.mana = Math.min(h.maxMana, h.mana + s); } } },
    },
    q: {
      name: 'Разлом', icon: '🕳', cost: 50, cd: 2, need: 'enemy',
      desc: 'Наносит урон и даёт Ноксу щит; все ◆ на поле цели обращаются в булыжники; Нокс крадёт по 4 маны за каждый.',
      ai: (G, h) => { const t = G.target(h); return t && t.board.count(T_MANA) >= 3; },
      async cast(G, h, t) {
        const n = t.board.keysOf(T_MANA).length;
        await G.skillDamage(h, t, G.sp(h, 40, 0.5), 'magic', '#a070ff');
        G.shieldHero(h, h, G.sp(h, 50, 0.5));
        await G.enemyBoard(h, t, b => b.convert(b.keysOf(T_MANA).filter(k => !b.at(k).sp), T_STONE), '#7a3cff');
        const s = Math.min(t.mana, n * 4); t.mana -= s; G.addMana(h, s);
      },
    },
    r: {
      name: 'Коллапс', icon: '⚫', cost: 120, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Стирает центр 3×3 поля цели (без эффекта) — там остаются булыжники. Мощный урон.',
      async cast(G, h, t) {
        const ks = []; for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) ks.push(y * N + x);
        await G.enemyBoard(h, t, b => b.convert(ks, T_STONE), '#7a3cff');
        await G.skillDamage(h, t, G.sp(h, 190, 1.2), 'magic', '#a070ff');
      },
    },
  },
  {
    id: 'selena', name: 'Селена', title: 'Звёздная Провидица', role: 'mid', emoji: '✨', color: '#ffd86b',
    mod: { sp: 1.05 },
    lore: 'Читает судьбы по звёздам и направляет союзников.',
    passive: { name: 'Звёздный взор', desc: '◉ также дают ману (+3 за камень).', effects(G, h, c) { c.manaFlat += c.counts[T_VIS] * 3; } },
    q: {
      name: 'Звездопад', icon: '🌠', cost: 50, cd: 3, need: 'none',
      desc: 'Превращает 3 случайных камня своего поля в линейные бомбы.',
      async cast(G, h) { await G.selfBoard(h, b => { const ks = b.pick(g => b.plain(g), 3); ks.forEach(k => b.convert([k], b.at(k).t, U.pick(['h', 'v']))); return ks; }); },
    },
    r: {
      name: 'Созвездие', icon: '💫', cost: 100, cd: 5, lvl: 6, need: 'none',
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
    id: 'rian', name: 'Риан', title: 'Меткий Глаз', role: 'adc', emoji: '🎯', color: '#e0a64a',
    mod: { atk: 1.1 },
    lore: 'Снайпер из пограничного гарнизона. Не промахивается.',
    passive: { name: 'Критический выстрел', desc: 'Совпадения из 4+ ⚔ наносят ×1.6 урона.', effects(G, h, c) { if (c.info.atkRuns.some(l => l >= 4)) { c.m.atk *= 1.6; c.label = 'КРИТ!'; } } },
    q: {
      name: 'Пронзающий выстрел', icon: '➶', cost: 40, cd: 2, need: 'none',
      desc: 'Подрывает ряд своего поля, в котором больше всего ⚔.',
      async cast(G, h) { await G.blast(h, rowKeys(bestRowOf(h.board, T_ATK))); },
    },
    r: {
      name: 'Выстрел за горизонт', icon: '🎯', cost: 100, cd: 5, lvl: 6, need: 'global',
      desc: 'Глобальный чистый урон по врагу с наименьшим здоровьем — в любой точке карты.',
      ai: (G, h) => G.allEnemies(h).some(e => e.hp / e.maxHp < 0.4),
      async cast(G, h) {
        const t = U.minBy(G.allEnemies(h), e => e.hp / e.maxHp);
        if (t) await G.skillDamage(h, t, G.sp(h, 100, 0.5) + h.power * 3.2, 'true', '#ffcf6b');
      },
    },
  },
  {
    id: 'mira', name: 'Мира', title: 'Стрела Рассвета', role: 'adc', emoji: '🏹', color: '#ff9fb3',
    mod: { atk: 1.05 },
    lore: 'Лучница солнечного ордена, чьи стрелы рассекают тьму.',
    passive: {
      name: 'Ритм', desc: 'Каждый третий ход с совпадением ⚔ наносит ×1.3 урона.',
      effects(G, h, c) { if (c.counts[T_ATK] > 0 && c.info.cascade === 0) { h.mem.rhythm = (h.mem.rhythm || 0) + 1; if (h.mem.rhythm % 3 === 0) { c.m.atk *= 1.3; c.label = 'РИТМ ×1.3'; } } },
    },
    q: {
      name: 'Рассветный выстрел', icon: '☀', cost: 60, cd: 3, need: 'none',
      desc: 'До 3 ● золота на своём поле становятся ⚔.',
      ai: (G, h) => h.board.count(T_GOLD) >= 5,
      async cast(G, h) { await G.selfBoard(h, b => b.convert(U.shuffle(b.keysOf(T_GOLD).filter(k => !b.at(k).sp)).slice(0, 3), T_ATK)); },
    },
    r: {
      name: 'Залп рассвета', icon: '🌅', cost: 110, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Урон всем врагам в событии, а каждый союзник в событии получает бомбу ⚔ на поле.',
      async cast(G, h) {
        for (const e of G.enemiesIn(h)) await G.skillDamage(h, e, G.sp(h, 50, 0.4) + h.power * 1.8, 'phys', '#ffb4c4');
        for (const a of G.alliesIn(h)) await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g), 1), T_ATK, 'bomb'), '#ffb4c4');
      },
    },
  },
  {
    id: 'korvin', name: 'Корвин', title: 'Механист', role: 'adc', emoji: '⚙', color: '#9aa7b8',
    mod: { atk: 1.18, hp: 1.15, arm: 1.15 },
    lore: 'Изобретатель, сражающийся армией самодельных устройств.',
    passive: { name: 'Инженерия', desc: '● золото приносит на 35% больше, а ⚔ бьют на 18% сильнее.', effects(G, h, c) { c.m.gold *= 1.35; c.m.atk *= 1.18; } },
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
      name: 'Ракетный залп', icon: '🚀', cost: 110, cd: 5, lvl: 6, need: 'enemy',
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
    id: 'auriel', name: 'Ауриэль', title: 'Светлая Жрица', role: 'sup', emoji: '🕊', color: '#fff0a8',
    mod: { sp: 1.1 },
    lore: 'Жрица рассвета, чья молитва поднимает павших на ноги.',
    passive: { name: 'Милосердие', desc: '✚ также лечат самого раненого союзника в событии (100%).', effects(G, h, c) { c.healAlly += 1.0; } },
    q: {
      name: 'Благословение', icon: '🙏', cost: 40, cd: 1, need: 'none',
      desc: 'Сразу лечит самого раненого союзника в событии и превращает 5 камней на его поле в ✚.',
      ai: (G, h) => G.alliesIn(h).some(a => a.hp / a.maxHp < 0.75),
      async cast(G, h) {
        const a = U.minBy(G.alliesIn(h), x => x.hp / x.maxHp);
        G.healHero(h, a, G.sp(h, 90, 0.7));
        await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_HEAL, 5), T_HEAL), '#fff0a8');
      },
    },
    r: {
      name: 'Небесный свет', icon: '☀', cost: 110, cd: 5, lvl: 6, need: 'none',
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
    id: 'garrok', name: 'Гаррок', title: 'Цепной Страж', role: 'sup', emoji: '⛓', color: '#6f8fa8',
    mod: { hp: 1.15, arm: 1.2 },
    lore: 'Тюремщик из подземных бастионов, чей крюк достаёт любого.',
    passive: { name: 'Защитник', desc: '🛡 также дают щит самому раненому союзнику в событии (40%).', effects(G, h, c) { c.shieldAlly += 0.4; } },
    q: {
      name: 'Крюк', icon: '🪝', cost: 55, cd: 3, need: 'enemy',
      desc: 'Выдёргивает 3 ⚔ с поля цели (там остаются булыжники) и переносит их на своё поле.',
      ai: (G, h) => { const t = G.target(h); return t && t.board.count(T_ATK) >= 3; },
      async cast(G, h, t) {
        const ks = t.board.pick(g => g.t === T_ATK && !g.sp, 3);
        await G.enemyBoard(h, t, b => b.convert(ks, T_STONE), '#6f8fa8');
        await G.selfBoard(h, b => b.convert(b.pick(g => b.plain(g) && g.t !== T_ATK, ks.length), T_ATK));
      },
    },
    r: {
      name: 'Цепи судьбы', icon: '⛓', cost: 110, cd: 5, lvl: 6, need: 'enemy',
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
    id: 'nia', name: 'Ниа', title: 'Иллюзионистка', role: 'sup', emoji: '🦋', color: '#ff7ce0',
    mod: { sp: 1.05 },
    lore: 'Фея снов, сплетающая миражи из пыльцы.',
    passive: { name: 'Пыльца', desc: '◉ дают щит всем союзникам в событии.', effects(G, h, c) { c.visShield += c.counts[T_VIS] * (6 + h.lvl * 2); } },
    q: {
      name: 'Морок', icon: '🎭', cost: 40, cd: 2, need: 'enemy',
      desc: 'Перемешивает поле цели и скрывает 6 клеток туманом.',
      async cast(G, h, t) { await G.enemyBoard(h, t, b => { b.shuffleGems(); return b.fogify(b.pick(g => !g.fog, 6)); }, '#ff7ce0'); },
    },
    r: {
      name: 'Зеркальный мир', icon: '🪞', cost: 100, cd: 5, lvl: 6, need: 'enemy',
      desc: 'Каждый союзник в событии получает Призму на поле и +35 маны.',
      async cast(G, h) {
        for (const a of G.alliesIn(h)) {
          await G.allyBoard(h, a, b => b.convert(b.pick(g => b.plain(g), 1), T_PRISM, 'prism'), '#ffc6f2');
          G.addMana(a, 35);
        }
      },
    },
  },
];


/* ---------- Пригодность героев к ролям ----------
   Герой подходит на любую роль; метки подсказывают ИИ, где он силён.
   fit: 3 — родная роль, 2 — хорошо подходит, 1 — терпимо, 0 — плохо.
   tags — роль в составе: tank, heal, control, burst, dps, utility, vision, sustain */
const HERO_FIT = {
  granitor: { fit: { top: 3, jng: 1, mid: 0, adc: 0, sup: 2 }, tags: ['tank', 'control'] },
  veila: { fit: { top: 3, jng: 2, mid: 2, adc: 1, sup: 0 }, tags: ['burst', 'dps'] },
  morven: { fit: { top: 3, jng: 2, mid: 1, adc: 0, sup: 0 }, tags: ['sustain', 'dps'] },
  xar: { fit: { top: 1, jng: 3, mid: 2, adc: 0, sup: 0 }, tags: ['burst', 'vision'] },
  lira: { fit: { top: 1, jng: 3, mid: 1, adc: 0, sup: 2 }, tags: ['heal', 'control'] },
  bronn: { fit: { top: 2, jng: 3, mid: 0, adc: 0, sup: 2 }, tags: ['tank', 'control'] },
  eira: { fit: { top: 0, jng: 0, mid: 3, adc: 1, sup: 2 }, tags: ['control', 'burst'] },
  piro: { fit: { top: 1, jng: 0, mid: 3, adc: 2, sup: 0 }, tags: ['burst'] },
  nox: { fit: { top: 1, jng: 1, mid: 3, adc: 0, sup: 1 }, tags: ['control', 'burst'] },
  selena: { fit: { top: 0, jng: 0, mid: 3, adc: 1, sup: 2 }, tags: ['utility', 'vision'] },
  rian: { fit: { top: 0, jng: 0, mid: 2, adc: 3, sup: 0 }, tags: ['dps'] },
  mira: { fit: { top: 0, jng: 0, mid: 1, adc: 3, sup: 1 }, tags: ['dps'] },
  korvin: { fit: { top: 1, jng: 0, mid: 1, adc: 3, sup: 1 }, tags: ['dps', 'control'] },
  auriel: { fit: { top: 0, jng: 0, mid: 1, adc: 0, sup: 3 }, tags: ['heal', 'utility'] },
  garrok: { fit: { top: 2, jng: 1, mid: 0, adc: 0, sup: 3 }, tags: ['tank', 'control'] },
  nia: { fit: { top: 0, jng: 1, mid: 1, adc: 0, sup: 3 }, tags: ['utility', 'vision'] },
};
const FIT_NAMES = ['плохо', 'терпимо', 'хорошо', 'родная роль'];
const TAG_NAMES = { tank: 'танк', heal: 'лекарь', control: 'контроль', burst: 'взрывной урон', dps: 'постоянный урон', utility: 'поддержка', vision: 'обзор', sustain: 'живучесть' };
for (const h of HEROES) { h.fit = HERO_FIT[h.id].fit; h.tags = HERO_FIT[h.id].tags; h.main = h.role; }
