'use strict';
/* Кампания: 16 клубов, двухкруговой турнир (30 туров), серии из двух игр (Bo2): победа 3, ничья 1. */

const CLUB_DEFS = [
  { name: 'Северные Волки', tag: 'СВЛ', color: '#2b5f9e', color2: '#d9e6f5', emblem: '🐺' },
  { name: 'Кристальные Драконы', tag: 'КДР', color: '#6b3fa0', color2: '#e8c66e', emblem: '🐲' },
  { name: 'Багровый Рассвет', tag: 'БГР', color: '#9e2235', color2: '#ffcf8a', emblem: '🌅' },
  { name: 'Стальные Грифоны', tag: 'СТГ', color: '#56606e', color2: '#f0f0f0', emblem: '🦅' },
  { name: 'Теневые Лисы', tag: 'ТЛС', color: '#3a2a52', color2: '#ff8a3d', emblem: '🦊' },
  { name: 'Громовые Медведи', tag: 'ГРМ', color: '#6b4a2b', color2: '#ffe066', emblem: '🐻' },
  { name: 'Ледяные Фениксы', tag: 'ЛФН', color: '#1f7a99', color2: '#c8f2ff', emblem: '🔥' },
  { name: 'Золотые Скорпионы', tag: 'ЗСК', color: '#a87b12', color2: '#2a1c06', emblem: '🦂' },
  { name: 'Изумрудные Змеи', tag: 'ИЗМ', color: '#1f7a4d', color2: '#c6f7d8', emblem: '🐍' },
  { name: 'Небесные Ястребы', tag: 'НЯС', color: '#3d7fd1', color2: '#ffffff', emblem: '🪶' },
  { name: 'Огненные Саламандры', tag: 'ОСЛ', color: '#c4461f', color2: '#ffe0a3', emblem: '🦎' },
  { name: 'Лунные Тигры', tag: 'ЛТГ', color: '#2c3e75', color2: '#f5d76e', emblem: '🐯' },
  { name: 'Пурпурные Вороны', tag: 'ПВР', color: '#7a2c7a', color2: '#e0b3ff', emblem: '🐦' },
  { name: 'Каменные Титаны', tag: 'КТТ', color: '#5a5048', color2: '#d4b483', emblem: '🗿' },
  { name: 'Штормовые Акулы', tag: 'ШАК', color: '#1b4f6b', color2: '#7fe0ff', emblem: '🦈' },
  { name: 'Призрачные Рыси', tag: 'ПРС', color: '#3b4a4f', color2: '#b6fff0', emblem: '🐈' },
];
const LEAGUE_NAME = 'Высшая лига Ущелья';

/* ---------- Создание лиги ---------- */
function createLeague(seed = Math.floor(Math.random() * 1e9)) {
  const rng = U.seeded(seed);
  // уровни клубов: от сильных к слабым, порядок случайный
  const levels = Array.from({ length: 16 }, (_, i) => 11.5 - i * 0.2).sort(() => rng() - 0.5);
  const L = { seed, name: LEAGUE_NAME, season: 1, tour: 0, clubs: [], players: {}, schedule: [], results: [], humanId: null, humanClub: null, version: 1 };
  const used = new Set();
  CLUB_DEFS.forEach((d, i) => {
    const club = Object.assign({ id: 'c' + i, level: levels[i], roster: {} }, d);
    for (const role of ROLE_ORDER) {
      const p = genLeaguePlayer(rng, used, role, club.level);
      p.club = club.id;
      L.players[p.id] = p;
      club.roster[role] = p.id;
    }
    L.clubs.push(club);
  });
  assignMastery(rng, Object.values(L.players));
  L.schedule = doubleRoundRobin(L.clubs.map(c => c.id), rng);
  return L;
}

/* Игрок клуба: среднее зависит от уровня клуба, но у каждого есть бросок на талант,
   поэтому сильный игрок может появиться и в слабом клубе (и наоборот). */
function genLeaguePlayer(rng, used, role, clubLevel) {
  const idn = genIdentity(rng, used);
  let level = clubLevel + (rng() + rng() - 1) * 1.6;
  const roll = rng();
  let talent = null;
  if (roll < 0.08) { level += 3 + rng() * 2.5; talent = 'star'; }       // восходящая звезда — в любом клубе
  else if (roll < 0.14) { level -= 2 + rng() * 1.5; talent = 'weak'; } // слабое звено — тоже в любом
  const p = makePlayer({ nick: idn.nick, first: idn.first, last: idn.last, role, stats: genStats(rng, role, level), talent });
  p.face = genFace(rng, { female: idn.female });
  p.age = 17 + rng.ri(12);
  return p;
}

/* Двухкруговой турнир по «методу круга» */
function doubleRoundRobin(ids, rng) {
  const n = ids.length, arr = ids.slice().sort(() => rng() - 0.5), first = [];
  for (let r = 0; r < n - 1; r++) {
    const tour = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      tour.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    first.push(tour);
    arr.splice(1, 0, arr.pop());
  }
  const second = first.map(t => t.map(f => ({ home: f.away, away: f.home })));
  return [...first, ...second].map((t, i) => t.map(f => Object.assign(f, { tour: i, done: false, games: [] })));
}

/* ---------- Доступ ---------- */
const clubById = (L, id) => L.clubs.find(c => c.id === id);
const rosterOf = (L, club) => ROLE_ORDER.map(r => L.players[club.roster[r]]);
const clubOvr = (L, club) => U.sum(rosterOf(L, club), playerOvr) / 5;
function clubStatAvg(L, club) { const ps = rosterOf(L, club); return Object.fromEntries(STAT_KEYS.map(k => [k, U.sum(ps, p => p.stats[k]) / 5])); }
function clubForm(L, club) { return U.sum(rosterOf(L, club), playerFormAvg) / 5; }
function nextFixture(L, clubId) {
  const t = L.schedule[L.tour];
  return t ? t.find(f => f.home === clubId || f.away === clubId) : null;
}

/* ---------- Человек в лиге ---------- */
function joinClub(L, human, clubId) {
  const club = clubById(L, clubId);
  const old = L.players[club.roster[human.role]];
  if (old) delete L.players[old.id];        // вытесненный игрок удаляется из игры
  human.club = club.id; human.human = true;
  L.players[human.id] = human;
  club.roster[human.role] = human.id;
  L.humanId = human.id; L.humanClub = club.id;
  return old;
}

/* ---------- Результаты ---------- */
/* Применяет результат одной игры: оценки, форма, мастерство (растёт только за высокую оценку) */
function applyGame(L, fixture, game, homeSide) {
  const homeWon = game.winner === homeSide;
  const rec = { winner: homeWon ? 'home' : 'away', min: game.minute, kills: { home: game.teams[homeSide].kills, away: game.teams[homeSide === 'blue' ? 'red' : 'blue'].kills }, players: [] };
  for (const h of game.heroes) {
    const p = h.pl; if (!p || !L.players[p.id]) continue;
    p.ratings.push(h.rating); if (p.ratings.length > 12) p.ratings.shift();
    const s = p.season; s.games++; if (h.team === game.winner) s.wins++; s.k += h.k; s.d += h.d; s.a += h.a; s.ratingSum += h.rating; if (h.mvp) s.mvp++;
    const before = masteryOf(p, h.def.id);
    let gain = h.rating >= 9.5 ? 2 : h.rating >= 8 ? 1 : 0;
    // чем выше мастерство, тем труднее расти дальше: шанс роста 1 − M/21 (случайность — от сида лиги)
    const rng = U.seeded((L.seed * 31 + fixture.tour * 997 + fixture.games.length * 131 + [...p.id].reduce((x, ch) => (x * 33 + ch.charCodeAt(0)) >>> 0, 7) + Math.round(h.rating * 10)) >>> 0);
    if (gain && rng() > 1 - before / 21) gain = 0;
    if (gain) p.mastery[h.def.id] = Math.min(MASTERY_MAX, before + gain);
    rec.players.push({ id: p.id, hero: h.def.id, rating: h.rating, k: h.k, d: h.d, a: h.a, mvp: h.mvp, gain });
  }
  fixture.games.push(rec);
  return rec;
}
function finishFixture(L, fixture) {
  const h = fixture.games.filter(g => g.winner === 'home').length, a = fixture.games.length - h;
  fixture.score = [h, a];
  fixture.done = true;
  L.results.push(fixture);
}

/* Турнирная таблица: очки → личные встречи → разница игр → разница убийств */
function leagueTable(L) {
  const rows = Object.fromEntries(L.clubs.map(c => [c.id, { id: c.id, p: 0, w: 0, d: 0, l: 0, gw: 0, gl: 0, kd: 0, pts: 0, last: [] }]));
  const sorted = L.schedule.flat().filter(f => f.done).sort((x, y) => x.tour - y.tour);
  for (const f of sorted) {
    const H = rows[f.home], A = rows[f.away], [sh, sa] = f.score;
    H.p++; A.p++; H.gw += sh; H.gl += sa; A.gw += sa; A.gl += sh;
    const kd = U.sum(f.games, g => g.kills.home - g.kills.away); H.kd += kd; A.kd -= kd;
    if (sh > sa) { H.w++; A.l++; H.pts += 3; H.last.push('W'); A.last.push('L'); }
    else if (sh < sa) { A.w++; H.l++; A.pts += 3; H.last.push('L'); A.last.push('W'); }
    else { H.d++; A.d++; H.pts++; A.pts++; H.last.push('D'); A.last.push('D'); }
  }
  const h2h = (a, b) => {
    let pa = 0, pb = 0;
    for (const f of sorted) {
      if (!((f.home === a && f.away === b) || (f.home === b && f.away === a))) continue;
      const [sh, sa] = f.score; const ha = f.home === a;
      const sA = ha ? sh : sa, sB = ha ? sa : sh;
      if (sA > sB) pa += 3; else if (sB > sA) pb += 3; else { pa++; pb++; }
    }
    return pb - pa;
  };
  // при равенстве очков — мини-таблица личных встреч внутри группы равных клубов
  const all = Object.values(rows);
  const groupPts = {};
  for (const r of all) {
    const group = all.filter(x => x.pts === r.pts).map(x => x.id);
    let pts = 0;
    for (const o of group) if (o !== r.id) pts += hp(r.id, o);
    groupPts[r.id] = pts;
  }
  function hp(a, b) {
    let p = 0;
    for (const f of sorted) {
      if (!((f.home === a && f.away === b) || (f.home === b && f.away === a))) continue;
      const [sh, sa] = f.score; const sA = f.home === a ? sh : sa, sB = f.home === a ? sa : sh;
      p += sA > sB ? 3 : sA === sB ? 1 : 0;
    }
    return p;
  }
  return all.sort((x, y) => (y.pts - x.pts) || (groupPts[y.id] - groupPts[x.id]) || ((y.gw - y.gl) - (x.gw - x.gl)) || (y.kd - x.kd) || x.id.localeCompare(y.id));
}

/* Игра одной серии без графики (для чужих матчей и быстрого просчёта) */
async function simFixture(L, fixture, ui) {
  const home = clubById(L, fixture.home), away = clubById(L, fixture.away);
  for (let gi = fixture.games.length; gi < 2; gi++) {
    const homeSide = gi === 0 ? 'blue' : 'red';
    const players = { [homeSide]: rosterOf(L, home), [homeSide === 'blue' ? 'red' : 'blue']: rosterOf(L, away) };
    const { picks } = AI.draft(players);
    const g = new Game(picks.blue, picks.red, ui, { names: { [homeSide]: home.name, [homeSide === 'blue' ? 'red' : 'blue']: away.name } });
    await g.run();
    computeRatings(g);
    applyGame(L, fixture, g, homeSide);
  }
  finishFixture(L, fixture);
}

/* ---------- Сохранение ---------- */
const SAVE_KEY = 'lk-campaign-v1';
function saveLeague(L) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(L)); return true; } catch (e) { return false; } }
function loadLeague() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearLeague() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
