'use strict';
/* Слой игроков: 8 характеристик, мастерство на героях, форма, тильт, генерация */

const STATS = [
  { key: 'rea', name: 'Реакция', icon: '⚡', desc: 'Кто ходит первым; уклонение от умений, меняющих поле; борьба за последний удар по эпикам.' },
  { key: 'mech', name: 'Механика', icon: '🎯', desc: 'Сила каскадов и спецкамней, шанс крита у ⚔ при совпадении 4+.' },
  { key: 'read', name: 'Чтение игры', icon: '🧠', desc: 'Сколько следующих падающих камней видно, видимость сквозь туман, эффективность маны.' },
  { key: 'farm', name: 'Фарм', icon: '🌾', desc: 'Золото с миньонов и лагерей, толкание волны, доход от ●.' },
  { key: 'map', name: 'Карта', icon: '🗺', desc: 'Сила вардов и обзора реки, раскрытие гангов, замечать попытки взять эпика.' },
  { key: 'agr', name: 'Агрессия', icon: '🔥', desc: 'Урон по героям и в гангах, чаще ганги и размены. Цена: позже уходит на базу и сам получает больше урона.' },
  { key: 'calm', name: 'Хладнокровие', icon: '❄', desc: 'Нет штрафов под давлением (мало здоровья, отставание), устойчивость к тильту.' },
  { key: 'team', name: 'Командная игра', icon: '🤝', desc: 'Сила лечения и щитов союзникам, золото за помощь, отклик на сигналы и скорость прибытия.' },
];
const STAT_KEYS = STATS.map(s => s.key);
const STAT_CAP_BASE = 20;   // предел «чистой» характеристики
const STAT_CAP_TOTAL = 30;  // предел вместе с бонусами формы и мастерства
const MASTERY_MAX = 20;

/* Сила эффекта каждой характеристики. Подбирается тестом равнозначности
   (tests/stat-equivalence.js), чтобы +1 к любой характеристике давал одинаковый прирост винрейта. */
const STAT_SCALE = { rea: 0.3, mech: 0.95, read: 1.5, farm: 1.65, map: 5.5, agr: 2.8, calm: 1.25, team: 2.5 };


/* ---------- Модель игрока ---------- */
let _pid = 1;
function makePlayer(o) {
  const p = Object.assign({
    id: 'p' + (_pid++) + '-' + Math.floor(Math.random() * 1e6).toString(36), nick: '', first: '', last: '', role: 'mid', human: false,
    stats: Object.fromEntries(STAT_KEYS.map(k => [k, 10])),
    mastery: {}, ratings: [], club: null, face: null,
    season: { games: 0, wins: 0, k: 0, d: 0, a: 0, ratingSum: 0, mvp: 0 },
  }, o);
  return p;
}
const playerOvr = p => U.sum(STAT_KEYS, k => p.stats[k]) / STAT_KEYS.length;
/* Форма: средняя оценка за последние 5 матчей → бонус −2…+2 ко всем характеристикам */
function playerFormAvg(p) { const r = p.ratings.slice(-5); return r.length ? U.sum(r) / r.length : 6.5; }
function playerFormBonus(p) { return U.clamp((playerFormAvg(p) - 6.5) * 1.0, -1.5, 1.5); }
function formArrow(p) { const b = playerFormBonus(p); return b >= 1.2 ? '⬆' : b >= 0.4 ? '↗' : b > -0.4 ? '➡' : b > -1.2 ? '↘' : '⬇'; }
function formColor(p) { const b = playerFormBonus(p); return b >= 0.4 ? '#5fe08a' : b > -0.4 ? '#c8cbd6' : '#ff7b7b'; }
function ratingColor(r) { return r >= 8 ? '#5fe08a' : r >= 7 ? '#a8e05f' : r >= 6 ? '#e0d25f' : r >= 5 ? '#e0a05f' : '#ff6b6b'; }

/* Базовый игрок «всё по 10» — для быстрых матчей без лиги и для тестов */
function neutralPlayer(role, over = {}) {
  return makePlayer(Object.assign({ role, nick: ROLES[role].short + '-' + _pid, stats: Object.fromEntries(STAT_KEYS.map(k => [k, 10])) }, over));
}

/* ---------- Генерация имён и ников ---------- */
const NAME_POOL = {
  first: ['Алексей', 'Мирон', 'Тимур', 'Даниил', 'Артём', 'Илья', 'Лев', 'Роман', 'Егор', 'Марк', 'Никита', 'Глеб', 'Кирилл', 'Ярослав', 'Савва', 'Фёдор',
    'Алина', 'Вера', 'Дарья', 'Ева', 'Злата', 'Кира', 'Мила', 'Ника', 'Полина', 'Соня', 'Ульяна', 'Яна',
    'Лукас', 'Матео', 'Ноа', 'Оскар', 'Хуго', 'Элиас', 'Каи', 'Рен', 'Тео', 'Юки', 'Аарон', 'Свен', 'Ингрид', 'Лейла', 'Майя', 'Сара'],
  last: ['Орлов', 'Вершинин', 'Громов', 'Ковалёв', 'Ленский', 'Морозов', 'Нестеров', 'Полозов', 'Рябинин', 'Седов', 'Туманов', 'Яровой', 'Белов', 'Зорин', 'Карпов', 'Лисин',
    'Ховард', 'Нильсен', 'Мартен', 'Фальк', 'Сантос', 'Ривера', 'Танака', 'Ким', 'Новак', 'Варга', 'Линд', 'Остин', 'Брандт', 'Коста', 'Халлер', 'Ито'],
  fem: new Set(['Алина', 'Вера', 'Дарья', 'Ева', 'Злата', 'Кира', 'Мила', 'Ника', 'Полина', 'Соня', 'Ульяна', 'Яна', 'Ингрид', 'Лейла', 'Майя', 'Сара']),
  nickA: ['Ka', 'Vor', 'Zen', 'Ryn', 'Mor', 'Tal', 'Nyx', 'Ark', 'Vel', 'Dra', 'Sol', 'Kor', 'Ix', 'Lum', 'Fen', 'Gry', 'Sha', 'Tor', 'Vex', 'Kry', 'Ren', 'Zar', 'Qui', 'Bly', 'Oro', 'Hex', 'Pyr', 'Syl', 'Ulm', 'Wyn'],
  nickB: ['ex', 'is', 'on', 'ar', 'yx', 'en', 'or', 'ix', 'us', 'ka', 'ro', 'in', 'el', 'ax', 'eth', 'ia', 'um', 'ok', 'ash', 'ra'],
  nickW: ['Shade', 'Frost', 'Ember', 'Rook', 'Viper', 'Lynx', 'Comet', 'Drift', 'Fable', 'Glint', 'Haze', 'Jolt', 'Mirage', 'Nova', 'Onyx', 'Pulse', 'Quill', 'Rune', 'Spark', 'Tide', 'Vale', 'Wisp', 'Zephyr', 'Ash', 'Bolt', 'Cinder'],
};
function feminize(last) { return /(ов|ев|ин|ёв)$/.test(last) ? last + 'а' : last.endsWith('ий') ? last.slice(0, -2) + 'ая' : last; }
function genIdentity(rng, used) {
  for (let i = 0; i < 200; i++) {
    const first = rng.pick(NAME_POOL.first);
    let last = rng.pick(NAME_POOL.last);
    if (NAME_POOL.fem.has(first)) last = feminize(last);
    const nick = rng() < 0.55 ? rng.pick(NAME_POOL.nickA) + rng.pick(NAME_POOL.nickB) : rng.pick(NAME_POOL.nickW) + (rng() < 0.4 ? rng.ri(99) : '');
    if (used.has(nick.toLowerCase())) continue;
    used.add(nick.toLowerCase());
    return { first, last, nick, female: NAME_POOL.fem.has(first) };
  }
  return { first: 'Игрок', last: '' + rng.ri(1e6), nick: 'Player' + rng.ri(1e6), female: false };
}

/* Профили характеристик по ролям: что у роли обычно развито сильнее */
const ROLE_LEAN = {
  top: { calm: 1.5, farm: 1, mech: 0.5, team: -1, map: -1 },
  jng: { map: 1.5, agr: 1, read: 0.5, farm: -1, calm: -0.5 },
  mid: { mech: 1.5, read: 1, rea: 0.5, team: -1, map: -0.5 },
  adc: { farm: 1.5, mech: 1, rea: 0.5, map: -1, team: -1 },
  sup: { team: 1.5, map: 1.5, calm: 0.5, farm: -2, mech: -0.5 },
};
function genStats(rng, role, level) {
  const s = {};
  for (const k of STAT_KEYS) {
    const v = level + (ROLE_LEAN[role][k] || 0) + (rng() + rng() + rng() - 1.5) * 3.2;
    s[k] = Math.round(U.clamp(v, 3, 18));
  }
  return s;
}

/* ---------- Мастерство на героях ----------
   20% игроков: 0–1 героев; 60%: 2–5; 20%: 5–8. Стартовые значения небольшие (2–7).
   4% игроков дополнительно получают «коронного» героя с мастерством 18–20. */
function heroesForRole(role) {
  return HEROES.map(h => ({ h, w: [0.15, 0.6, 2, 5][h.fit[role]] }));
}
function pickWeighted(rng, list, n) {
  const pool = list.slice(); const out = [];
  while (out.length < n && pool.length) {
    const tot = U.sum(pool, x => x.w);
    let r = rng() * tot, i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool[i].h); pool.splice(i, 1);
  }
  return out;
}
function assignMastery(rng, players) {
  const order = players.slice().sort(() => rng() - 0.5);
  const n = order.length;
  const nA = Math.round(n * 0.2), nC = Math.round(n * 0.2);
  order.forEach((p, i) => {
    const group = i < nA ? 'A' : i < nA + nC ? 'C' : 'B';
    const count = group === 'A' ? rng.ri(2) : group === 'B' ? 2 + rng.ri(4) : 5 + rng.ri(4);
    p.mastery = {};
    for (const h of pickWeighted(rng, heroesForRole(p.role), count)) p.mastery[h.id] = 2 + Math.floor(rng() * rng() * 6);
    p.masteryGroup = group;
  });
  // 4% — коронный герой
  const stars = Math.max(1, Math.round(n * 0.04));
  for (const p of players.slice().sort(() => rng() - 0.5).slice(0, stars)) {
    const h = pickWeighted(rng, heroesForRole(p.role).filter(x => x.h.fit[p.role] >= 2 && !(x.h.id in p.mastery)), 1)[0];
    if (!h) continue;
    p.mastery[h.id] = 18 + rng.ri(3);
    p.signature = h.id;
  }
}
const masteryOf = (p, heroId) => (p && p.mastery[heroId]) || 0;
const topMastery = (p, n = 3) => Object.entries(p.mastery).sort((a, b) => b[1] - a[1]).slice(0, n);

/* ---------- Эффективная характеристика героя в матче ----------
   база (≤20) + мастерство/4 + форма ± тильт; общий предел 30 */
function effStat(h, key) {
  const p = h.pl;
  if (!p) return 10;
  let v = Math.min(STAT_CAP_BASE, p.stats[key]) + (h.bonusAll || 0);
  if (h.tilt) {
    if (key === 'rea' || key === 'mech' || key === 'read') v -= h.tilt;
    if (key === 'agr') v += h.tilt;
  }
  return U.clamp(v, 1, STAT_CAP_TOTAL);
}
/* Отклонение от нормы 10 с учётом силы эффекта характеристики */
/* Ролевой коэффициент: у ролей разный «рычаг» на исход (урон стрелка огромен, у саппорта мал),
   поэтому отдача характеристик выравнивается по ролям одинаково для всех 8 характеристик. */
const ROLE_IMPACT = { top: 1.3, jng: 0.7, mid: 1.2, adc: 0.35, sup: 1.7 };
const sd = (h, key) => (effStat(h, key) - 10) * STAT_SCALE[key] * (ROLE_IMPACT[h.role] || 1);
/* Множитель эффекта характеристики: 1 + k·отклонение, но никогда не отрицательный и не безграничный */
const sm = (k, h, key) => U.clamp(1 + k * sd(h, key), 0.25, 3);
/* Противостояние двух характеристик: 50% ± 3% за пункт разницы */
const opposed = (a, b, base = 0.5, per = 0.03) => U.clamp(base + (a - b) * per, 0.03, 0.97);
