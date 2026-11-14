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
    pickCaptain(L, club);
    L.clubs.push(club);
  });
  assignMastery(rng, Object.values(L.players));
  L.patch = newPatchState('1.0', {}, [], {});
  L.schedule = doubleRoundRobin(L.clubs.map(c => c.id), rng);
  if (typeof initFinance !== 'undefined') { initFinance(L, rng); syncFacilities(L); }
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
  // скрытый игровой интеллект: в сильных клубах в среднем выше, но у каждого свой разброс
  let iqBase = 10 + (clubLevel - 10) * 0.9 + (talent === 'star' ? 1.5 : talent === 'weak' ? -1.5 : 0);
  if (rng() < 0.08) iqBase += 4.5;   // «прирождённый стратег» — может оказаться в любом клубе
  p.iq = Object.fromEntries(IQ_KEYS.map(k => [k, Math.round(U.clamp(iqBase + (rng() + rng() + rng() - 1.5) * 2.6, 3, 18))]));
  p.age = 17 + rng.ri(12);
  p.perks = rollPerks(rng);
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
const clubPs = (L, club) => rosterOf(L, club).filter(Boolean);
const clubOvr = (L, club) => { const ps = clubPs(L, club); return ps.length ? U.sum(ps, playerOvr) / ps.length : 0; };
function clubStatAvg(L, club) { const ps = clubPs(L, club); return Object.fromEntries(STAT_KEYS.map(k => [k, ps.length ? U.sum(ps, p => p.stats[k]) / ps.length : 10])); }
function clubForm(L, club) { const ps = clubPs(L, club); return ps.length ? U.sum(ps, playerFormAvg) / ps.length : 6.5; }
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
  if (typeof initPlayerFinance !== 'undefined') { initPlayerFinance(L, human); human.contract = { salary: Math.round(playerValue(human) * 0.9), until: L.season + 1 }; syncFacilities(L); }
  pickCaptain(L, club);
  return old;
}

/* ---------- Результаты ---------- */
/* Применяет результат одной игры: оценки, форма, мастерство (растёт только за высокую оценку) */
function applyGame(L, fixture, game, homeSide) {
  const homeWon = game.winner === homeSide;
  const rec = { winner: homeWon ? 'home' : 'away', min: game.minute, kills: { home: game.teams[homeSide].kills, away: game.teams[homeSide === 'blue' ? 'red' : 'blue'].kills }, players: [] };
  recordHeroStats(L, game);
  for (const h of game.heroes) {
    const p = h.pl; if (!p || !L.players[p.id]) continue;
    p.ratings.push(h.rating); if (p.ratings.length > 12) p.ratings.shift();
    const s = p.season; s.games++; if (h.team === game.winner) s.wins++; s.k += h.k; s.d += h.d; s.a += h.a; s.ratingSum += h.rating; if (h.mvp) s.mvp++;
    const before = masteryOf(p, h.def.id);
    let gain = h.rating >= 9.5 ? 2 : h.rating >= 8 ? 1 : 0;
    // чем выше мастерство, тем труднее расти дальше: шанс роста 1 − M/21 (случайность — от сида лиги)
    const rng = U.seeded((L.seed * 31 + fixture.tour * 997 + fixture.games.length * 131 + [...p.id].reduce((x, ch) => (x * 33 + ch.charCodeAt(0)) >>> 0, 7) + Math.round(h.rating * 10)) >>> 0);
    // буткемп клуба повышает шанс роста мастерства
    if (gain && rng() > (1 - before / 21) * (1 + 0.15 * ((p.fac && p.fac.bootcamp) || 0))) gain = 0;
    if (typeof updatePopularity !== 'undefined') updatePopularity(p, h.rating, h.mvp, h.team === game.winner);
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
    const { picks, bans } = AI.draft(players);
    const g = new Game(picks.blue, picks.red, ui, { bans, names: { [homeSide]: home.name, [homeSide === 'blue' ? 'red' : 'blue']: away.name } });
    await g.run();
    computeRatings(g);
    applyGame(L, fixture, g, homeSide);
  }
  finishFixture(L, fixture);
}

/* ---------- Капитан ----------
   Капитан драфтит за команду: им становится игрок с лучшим командным мышлением, тактикой и чтением игры. */
function pickCaptain(L, club) {
  const ps = rosterOf(L, club).filter(Boolean);
  if (!ps.length) return null;
  for (const p of ps) p.captain = false;
  const cap = AI.captainOf(ps.map(p => Object.assign({}, p, { captain: false })));
  const real = ps.find(p => p.id === cap.id);
  real.captain = true; club.captain = real.id;
  return real;
}

/* ---------- Патчи и мета ----------
   Каждые 10 туров выходит патч: герои со слишком высоким винрейтом ослабляются, слишком слабые — усиливаются.
   После патча складывается мета: ожидаемая сила героя = винрейт прошлого патча (сглаженный) + эффект правки. */
const PATCH_EVERY = 10;
const PATCH_WR_PER_PCT = 1.1;   // ≈ сколько п.п. винрейта даёт 1% силы героя (замер на тестах)
function newPatchState(name, mods, notes, meta) {
  return { name, mods: Object.assign({}, mods), notes, meta, stats: {}, games: 0 };
}
function recordHeroStats(L, game) {
  if (!L.patch) return;
  const st = L.patch.stats;
  L.patch.games++;
  for (const h of game.heroes) {
    const s = st[h.def.id] = st[h.def.id] || { g: 0, w: 0, b: 0 };
    s.g++; if (h.team === game.winner) s.w++;
  }
  const bans = game.opts && game.opts.bans;
  if (bans) for (const t of ['blue', 'red']) for (const b of bans[t] || []) { const s = st[b.def.id] = st[b.def.id] || { g: 0, w: 0, b: 0 }; s.b++; }
}
/* Сглаженный винрейт: к результатам героя добавляются 24 «средние» игры, чтобы случайные серии не дёргали баланс */
function heroWr(s) { return s ? (s.w + 12) / (s.g + 24) : 0.5; }
function patchDue(L) { return L.tour > 0 && L.tour % PATCH_EVERY === 0 && (!L.patch || L.patch.atTour !== L.season * 100 + L.tour); }
function applyPatch(L) {
  const old = L.patch || newPatchState('1.0', {}, [], {});
  const games = Math.max(1, old.games);
  const k = L.tour >= L.schedule.length ? 0 : Math.round(L.tour / PATCH_EVERY);
  const name = L.tour >= L.schedule.length ? `${L.season + 1}.0` : `${L.season}.${k}`;
  const rng = U.seeded((L.seed * 7 + L.season * 1009 + L.tour * 31) >>> 0);
  const mods = {};
  for (const id in old.mods) mods[id] = typeof old.mods[id] === 'number' ? { stat: old.mods[id] } : Object.assign({}, old.mods[id]);
  const notes = [], meta = {};
  for (const d of HEROES) {
    const s = old.stats[d.id] || { g: 0, w: 0, b: 0 };
    const wr = heroWr(s);
    let eff = 0, key = null, delta = 0;
    if (s.g >= 12 && Math.abs(wr - 0.5) > 0.03) {
      // нужная правка в «силе героя»: перекос винрейта с запасом на случайность, от 2 до 6%
      let need = -U.clamp((wr - 0.5) * 70 / PATCH_WR_PER_PCT, -6, 6) / 100;
      if (Math.abs(need) < 0.02) need = 0.02 * Math.sign(need);
      // в ~30% случаев правят не базовые характеристики, а Q, ульту или пассивку (часть набора — шаг крупнее)
      key = rng() < 0.7 ? 'stat' : ['q', 'r', 'p'][Math.floor(rng() * 3)];
      const mult = key === 'stat' ? 1 : key === 'p' ? 2.5 : 3;
      const cap = key === 'stat' ? 0.25 : 0.45;
      const m = mods[d.id] = mods[d.id] || {};
      const before = m[key] || 0;
      m[key] = U.clamp(Math.round((before + need * mult) * 100) / 100, -cap, cap);
      delta = Math.round((m[key] - before) * 100) / 100;
      eff = delta / mult;
      if (delta) {
        const skill = key === 'q' ? d.q.name : key === 'r' ? d.r.name : key === 'p' ? d.passive.name : null;
        notes.push({ id: d.id, key, skill, delta, eff, wr: s.w / Math.max(1, s.g), g: s.g, total: m[key] });
      } else key = null;
    }
    // мета: ожидаемый винрейт в новом патче
    const score = (wr - 0.5) + eff * PATCH_WR_PER_PCT;
    const pr = (s.g + s.b) / games;     // доля игр, где героя взяли или забанили
    meta[d.id] = { score: Math.round(score * 1000) / 1000, wr, g: s.g, pr: Math.round(pr * 100) / 100, lastDelta: Math.round(eff * 1000) / 1000, lastKey: key, patch: name };
  }
  const order = Object.entries(meta).sort((a, b) => b[1].score - a[1].score);
  order.forEach(([id, m], i) => { m.rank = i + 1; m.tier = m.score >= 0.04 ? 'S' : m.score >= 0.015 ? 'A' : m.score > -0.015 ? 'B' : m.score > -0.04 ? 'C' : 'D'; });
  notes.sort((a, b) => a.eff - b.eff);
  L.patchHistory = L.patchHistory || [];
  L.patchHistory.push({ name: old.name, games: old.games, stats: old.stats });
  if (L.patchHistory.length > 8) L.patchHistory.shift();
  L.patch = newPatchState(name, mods, notes, meta);
  L.patch.atTour = L.season * 100 + L.tour;
  L.patch.prev = old.name;
  applyLeagueMeta(L);
  return L.patch;
}
/* Включить патч и мету лиги в игре (null — сбросить для быстрых матчей) */
function applyLeagueMeta(L) {
  HERO_PATCH = {}; HERO_META = {};
  if (!L || !L.patch) return;
  Object.assign(HERO_PATCH, L.patch.mods);
  Object.assign(HERO_META, L.patch.meta);
}
/* Совместимость со старыми сохранениями */
function upgradeLeague(L) {
  if (typeof upgradeFinance !== 'undefined') { upgradeFinance(L); syncFacilities(L); }
  if (!L.perksDone) { const r = U.seeded(L.seed + 555); for (const p of Object.values(L.players)) if (!p.perks) p.perks = rollPerks(r); L.perksDone = true; }
  if (!L.patch) L.patch = newPatchState('1.0', {}, [], {});
  for (const c of L.clubs) if (!c.captain || !L.players[c.captain]) pickCaptain(L, c);
  return L;
}

/* ---------- Сохранение ---------- */
const SAVE_KEY = 'lk-campaign-v3';  // v3: финансы, контракты, 28 героев
function saveLeague(L) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(L)); return true; } catch (e) { return false; } }
function loadLeague() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearLeague() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
