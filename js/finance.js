'use strict';
/* Финансы кампании: бюджет клуба, руководство, спонсоры, зарплаты, призовые, рекламные сделки игроков,
   контракты (со скрытой требовательностью игрока), свободные агенты и межсезонье.
   Деньги — в тысячах («к»). Зарплата и доходы указываются за сезон, начисляются по турам. */

const MGMT_STYLES = {
  results: { name: 'Победы любой ценой', desc: 'платит за силу состава, охотно усиливается' },
  youth: { name: 'Ставка на молодёжь', desc: 'ценит молодых и перспективных, бережёт деньги на ветеранах' },
  profit: { name: 'Экономия и прибыль', desc: 'держит зарплаты низкими, продаёт дорогих' },
  media: { name: 'Звёзды и медиа', desc: 'платит за популярность: звёзды приводят спонсоров' },
};
const MGMT_NAMES = ['Р. Остров', 'Э. Вайс', 'Д. Корнилов', 'М. Лаэрн', 'С. Брандт', 'И. Велес', 'А. Морено', 'Т. Хольм', 'Г. Сарин', 'Л. Ветров', 'Ф. Рейн', 'О. Дракс', 'Н. Ульм', 'В. Ксандер', 'П. Тарн', 'Ж. Ривьер'];
const SPONSORS = ['Кристалл-Энерджи', 'Лунный Банк', 'Небесные Авиалинии', 'Северный Чай', 'Гром-Моторс', 'Звёздная Связь', 'Пиксель Девайс', 'Огненный Соус', 'Ледяная Вода', 'Тёмный Шоколад', 'Ветер-Телеком', 'Медведь Страхование'];
const AD_BRANDS = ['кроссовки «Рысь»', 'энергетик «Вспышка»', 'наушники «Эхо»', 'кресло «Трон»', 'мышь «Коготь»', 'чипсы «Хруст»', 'часы «Миг»', 'клавиатура «Удар»', 'газировка «Пузырь»', 'очки «Сокол»', 'стрим-платформа «Поток»', 'одежда «Ущелье»'];
const PRIZES = [1200, 850, 650, 500, 420, 360, 310, 270, 230, 200, 170, 150, 130, 110, 100, 90];
const WIN_BONUS = 18, DRAW_BONUS = 6;
const money = v => `${Math.round(v)}к`;
/* Генератор случайных чисел с методами pick/ri (нужен генератору игроков) */
const frng = () => U.seeded(Math.floor(Math.random() * 1e9));

/* Рыночная стоимость игрока (зарплата за сезон): сила + популярность */
function playerValue(p) {
  return Math.round(40 + 16 * Math.pow(Math.max(0, playerOvr(p) - 7), 1.5) + 2 * (p.popularity || 0));
}
/* Требование игрока: стоимость × требовательность (скрытая) × форма */
function playerDemand(p) {
  const greed = p.greed || 10;
  return Math.round(playerValue(p) * (1 + (greed - 10) * 0.035) * (1 + (playerFormAvg(p) - 6.5) * 0.05));
}
const payroll = (L, c) => U.sum(rosterOf(L, c).filter(Boolean), p => (p.contract ? p.contract.salary : 0));

/* ---------- Создание и совместимость ---------- */
function initFinance(L, rng = frng()) {
  const ranked = L.clubs.slice().sort((a, b) => b.level - a.level);
  L.clubs.forEach((c, i) => {
    const rank = ranked.indexOf(c);
    const styles = Object.keys(MGMT_STYLES);
    c.mgmt = c.mgmt || {
      name: MGMT_NAMES[i % MGMT_NAMES.length],
      style: styles[Math.floor(rng() * styles.length)],
      // амбиции: целевое место; сильные клубы метят выше, но бывают и амбициозные середняки
      target: U.clamp(Math.round(1 + rank * 0.7 + (rng() - 0.5) * 6), 1, 14),
    };
    c.budget = c.budget != null ? c.budget : Math.round(700 + (c.level - 10) * 500 + rng() * 300);
    c.sponsor = c.sponsor || { name: SPONSORS[i % SPONSORS.length], perSeason: Math.round(900 + (15 - rank) * 30 + rng() * 150) };
    c.ledger = c.ledger || [];
  });
  for (const p of Object.values(L.players)) initPlayerFinance(L, p, rng);
  L.free = L.free || [];
  if (!L.freeInit) { refillFreeAgents(L, rng, 16); L.freeInit = true; }
}
function initPlayerFinance(L, p, rng = frng()) {
  if (p.greed == null) p.greed = Math.round(U.clamp(10 + (rng() + rng() + rng() - 1.5) * 6, 1, 20));   // скрытая требовательность
  if (p.popularity == null) p.popularity = Math.round(U.clamp(8 + (playerOvr(p) - 9) * 6 + (p.talent === 'star' ? 12 : 0) + rng() * 10, 1, 90));
  if (!p.ads) p.ads = [];
  if (!p.contract) p.contract = { salary: Math.round(playerValue(p) * (0.85 + rng() * 0.3)), until: L.season + Math.floor(rng() * 3) };
}
function upgradeFinance(L) { if (!L.clubs[0].mgmt || !L.free) initFinance(L, U.seeded(L.seed + 777)); }

/* ---------- Популярность и реклама ---------- */
function updatePopularity(p, rating, mvp, won) {
  const gain = (rating - 6.5) * 1.1 + (mvp ? 1.5 : 0) + (won ? 0.3 : 0);
  const media = 1 + 0.15 * ((p.fac && p.fac.media) || 0);
  // популярность тянется к «естественному» уровню игрока: без ярких матчей не растёт сама по себе
  const base = U.clamp(15 + (playerOvr(p) - 9) * 7, 3, 80);
  p.popularity = U.clamp((p.popularity || 10) + (gain > 0 ? gain * media : gain) - 0.03 * ((p.popularity || 10) - base), 1, 100);
}
/* Рекламная сделка: чем популярнее игрок, тем вероятнее и прибыльнее. Деньги идут в бюджет клуба */
function rollAds(L, p, rng = frng()) {
  if (!p.club || p.ads.length >= 2) return null;
  if (rng() > p.popularity / 750 * (1 + 0.2 * ((p.fac && p.fac.media) || 0))) return null;
  const ad = { brand: AD_BRANDS[Math.floor(rng() * AD_BRANDS.length)], perSeason: Math.round(20 + p.popularity * (1 + rng() * 1.5)), until: L.season };
  if (p.ads.some(a => a.brand === ad.brand)) return null;
  p.ads.push(ad);
  return ad;
}

/* ---------- Финансы тура ---------- */
function financeTour(L, tourFixtures, rng = frng()) {
  const news = [];
  const tours = L.schedule.length;
  for (const c of L.clubs) {
    const roster = rosterOf(L, c).filter(Boolean);
    const sponsor = c.sponsor.perSeason / tours;
    const ads = U.sum(roster, p => U.sum(p.ads, a => a.perSeason)) / tours;
    let bonus = 0;
    const f = tourFixtures.find(x => x.home === c.id || x.away === c.id);
    if (f && f.score) { const [h, a] = f.score; const mine = f.home === c.id ? h : a, their = f.home === c.id ? a : h; bonus = mine > their ? WIN_BONUS : mine === their ? DRAW_BONUS : 0; }
    const wages = payroll(L, c) / tours;
    const net = sponsor + ads + bonus - wages;
    c.budget = Math.round((c.budget + net) * 10) / 10;
    c.ledger.push({ tour: L.tour + 1, season: L.season, sponsor, ads, bonus, wages, net });
    if (c.ledger.length > 40) c.ledger.shift();
    for (const p of roster) {
      if (p.human && p.contract) p.wallet = (p.wallet || 0) + p.contract.salary / tours;   // зарплата игрока-человека — на личный счёт
      const ad = rollAds(L, p, rng);
      if (ad) news.push({ club: c.id, text: `📺 ${p.nick} подписывает рекламу: ${ad.brand} (+${money(ad.perSeason)} за сезон в бюджет клуба)` });
    }
  }
  return news;
}

/* ---------- Переговоры ---------- */
/* Сколько руководство готово платить игроку: зависит от стиля, амбиций и денег клуба */
function mgmtMaxOffer(L, c, p) {
  const m = c.mgmt, val = playerValue(p);
  const roster = rosterOf(L, c).filter(x => x && x !== p);
  const avgOvr = roster.length ? U.sum(roster, playerOvr) / roster.length : 10;
  let w = 1 + (14 - m.target) * 0.012;
  if (m.style === 'results') w += U.clamp((playerOvr(p) - avgOvr) * 0.08, -0.2, 0.25);
  if (m.style === 'youth') w += (p.age || 22) <= 21 ? 0.15 : (p.age || 22) >= 27 ? -0.12 : 0;
  if (m.style === 'profit') w -= 0.15;
  if (m.style === 'media') w += (p.popularity || 0) / 100 * 0.3;
  // денег мало — руководство осторожнее
  const after = c.budget + c.sponsor.perSeason - (payroll(L, c) - (p.contract && p.club === c.id ? p.contract.salary : 0) + val);
  if (after < 0) w *= U.clamp(1 + after / 1500, 0.6, 1);
  return Math.round(val * w);
}
/* Сила игрока для конкретного руководства (кого предпочесть) */
function mgmtScore(c, p) {
  const o = playerOvr(p), m = c.mgmt.style;
  if (m === 'youth') return o + (22 - (p.age || 22)) * 0.25 + (p.talent === 'star' ? 1.5 : 0);
  if (m === 'profit') return o - playerDemand(p) / 150;
  if (m === 'media') return o * 0.75 + (p.popularity || 0) / 12;
  return o + playerMasteryTop(p) * 0.03;
}
const playerMasteryTop = p => Math.max(0, ...Object.values(p.mastery || {}));
function signPlayer(L, c, p, salary, years, news, why) {
  const role = p.role;
  const old = c.roster[role] && L.players[c.roster[role]];
  if (old && old !== p) releasePlayer(L, c, old, news, 'освобождает место');
  if (L.free.includes(p)) L.free.splice(L.free.indexOf(p), 1);
  if (old && old.human) { old.club = null; L.humanFree = true; }
  p.club = c.id; L.players[p.id] = p; c.roster[role] = p.id;
  p.contract = { salary: Math.round(salary), until: L.season + years };
  pickCaptain(L, c);
  if (news) news.push({ club: c.id, text: `✍ ${c.emblem} ${c.name} подписывает ${p.nick} (${ROLES[role].name.toLowerCase()}) — ${money(salary)} за сезон до конца сезона ${L.season + years}${why ? ' · ' + why : ''}` });
}
function releasePlayer(L, c, p, news, why) {
  if (p.human) return;
  if (c.roster[p.role] === p.id) c.roster[p.role] = null;
  p.club = null; p.captain = false; p.ads = [];
  delete L.players[p.id];
  if (!L.free.includes(p)) L.free.push(p);
  if (news) news.push({ club: c.id, text: `↪ ${p.nick} покидает ${c.emblem} ${c.name} и становится свободным агентом${why ? ' (' + why + ')' : ''}` });
}

/* ---------- Пул свободных агентов ---------- */
function refillFreeAgents(L, rng, min = 16) {
  const used = new Set([...Object.values(L.players), ...L.free].map(p => p.nick.toLowerCase()));
  const roles = ROLE_ORDER;
  let i = 0;
  while (L.free.length < min) {
    const role = roles[(L.free.length + i++) % roles.length];
    const p = genLeaguePlayer(rng, used, role, 8.3 + rng() * 3.2);
    p.club = null; p.age = 17 + Math.floor(rng() * 9);
    assignMastery(rng, [p]);
    initPlayerFinance(L, p, rng);
    p.contract = null;
    L.free.push(p);
  }
}

/* ---------- Межсезонье ---------- */
/* humanStay: игрок-человек уже решил свой контракт (true) — его не трогаем. Возвращает новости */
function offseason(L, rng = frng()) {
  const news = [];
  const table = leagueTable(L);
  // призовые и спонсоры по итогам сезона
  table.forEach((r, i) => {
    const c = clubById(L, r.id);
    c.budget += PRIZES[i];
    c.lastPlace = i + 1;
    const diff = c.mgmt.target - (i + 1);
    const pop = U.sum(rosterOf(L, c).filter(Boolean), p => p.popularity) / 5;
    const old = c.sponsor.perSeason;
    c.sponsor.perSeason = Math.round(U.clamp(old * (1 + diff * 0.015) + (pop - 30) * 2 + (rng() - 0.5) * 80, 500, 2500));
    news.push({ club: c.id, text: `🏆 ${c.emblem} ${c.name}: ${i + 1}-е место — призовые ${money(PRIZES[i])}; спонсор «${c.sponsor.name}» ${c.sponsor.perSeason >= old ? 'повышает' : 'снижает'} выплаты до ${money(c.sponsor.perSeason)} за сезон` });
    // руководство пересматривает амбиции
    if (diff >= 3) c.mgmt.target = Math.max(1, c.mgmt.target - 1);
    if (diff <= -4) c.mgmt.target = Math.min(14, c.mgmt.target + 1);
  });
  facUpkeepAll(L, news);
  for (const c of L.clubs) boardReview(L, c, news, rng);
  // развитие игроков: рост и спад характеристик (до переговоров — новые требования считаются от новой силы)
  // кто растёт, а кто сдаёт, решает успешность сезона (место в рейтинге), а не случай
  const devKinds = assignDevelopment([...Object.values(L.players), ...L.free], L.schedule.length * 2, p => clubOvr(L, clubById(L, p.club)));
  for (const p of [...Object.values(L.players), ...L.free]) {
    const dv = developPlayer(p, rng, devKinds.get(p)); dv.season = L.season;
    const c = p.club && clubById(L, p.club);
    if (dv.kind === 'boom' || dv.kind === 'crash' || (p.human && dv.delta)) news.push({ club: c ? c.id : null, text: `${dv.delta > 0 ? '📈' : '📉'} ${p.nick}${c ? ' (' + c.tag + ')' : ''}: ${dv.kind === 'boom' ? 'резкий рост' : dv.kind === 'crash' ? 'резкий спад' : dv.delta > 0 ? 'прибавил' : 'сдал'} — ${dv.delta > 0 ? '+' : ''}${dv.delta} к сумме характеристик` });
  }
  // реклама кончается, игроки взрослеют
  for (const p of [...Object.values(L.players), ...L.free]) { p.ads = (p.ads || []).filter(a => a.until > L.season); p.age = (p.age || 20) + 1; }
  mgmtReview(L, news, rng);
  // завершение карьеры: с 30 лет шанс растёт с возрастом и при слабой игре (игрок-человек решает сам)
  for (const c of L.clubs) for (const role of ROLE_ORDER) {
    const p = L.players[c.roster[role]];
    if (!p || p.human || (p.age || 20) < 30) continue;
    const ch = 0.15 + 0.12 * (p.age - 30) + (avgRating(p) < 6 ? 0.15 : 0);
    if (rng() < ch) { c.roster[role] = null; delete L.players[p.id]; news.push({ club: c.id, text: `🎓 ${p.nick} (${c.tag}, ${p.age} лет) завершает карьеру` }); }
  }
  // продление контрактов (кроме игрока-человека — он решает сам)
  for (const c of L.clubs) for (const role of ROLE_ORDER) {
    const p = L.players[c.roster[role]];
    if (!p || p.human || !p.contract || p.contract.until > L.season) continue;
    const demand = playerDemand(p), offer = mgmtMaxOffer(L, c, p);
    if (offer >= demand) {
      p.contract = { salary: demand, until: L.season + 1 + Math.floor(rng() * 3) };
      news.push({ club: c.id, text: `🖊 ${p.nick} продлевает контракт с ${c.emblem} ${c.name}: ${money(demand)} за сезон` });
    } else releasePlayer(L, c, p, news, `просил ${money(demand)}, руководство предлагало ${money(offer)}`);
  }
  // амбициозные клубы усиливаются: свободный агент заметно сильнее своего игрока
  for (const c of L.clubs.slice().sort((a, b) => a.mgmt.target - b.mgmt.target)) {
    if (c.mgmt.target > 6 || c.budget < 500) continue;
    for (const role of U.shuffle(ROLE_ORDER.slice())) {
      const cur = L.players[c.roster[role]];
      if (!cur || cur.human) continue;
      const cand = L.free.filter(p => p.role === role && playerOvr(p) >= playerOvr(cur) + 1.2 && playerDemand(p) <= mgmtMaxOffer(L, c, p));
      if (!cand.length) continue;
      const p = U.maxBy(cand, x => mgmtScore(c, x));
      signPlayer(L, c, p, playerDemand(p), 2, news, 'усиление состава');
      break;
    }
  }
  // пустые места: трансфер из другого клуба, свободный агент или выпускник академии
  for (const c of U.shuffle(L.clubs.slice())) for (const role of ROLE_ORDER) fillVacancy(L, c, role, news, rng);
  for (const c of L.clubs) mgmtInvest(L, c, news);
  // пул свободных агентов: ветераны уходят, приходят новички
  L.free = L.free.filter(p => p.age <= 31).sort((a, b) => playerOvr(b) - playerOvr(a)).slice(0, 28);
  refillFreeAgents(L, rng, 16);
  for (const c of L.clubs) pickCaptain(L, c);
  syncFacilities(L);
  return news;
}

/* ---------- Предложения игроку-человеку ---------- */
function humanOffer(L, c, p) {
  const max = mgmtMaxOffer(L, c, p), base = playerValue(p);
  return { salary: Math.round(Math.min(max, base * (0.95 + (p.popularity || 0) / 400))), max, years: 2 };
}
/* Какие клубы предложат контракт свободному игроку-человеку: те, где он сильнее их игрока на этой роли */
function humanOffersFrom(L, p) {
  const out = [];
  for (const c of L.clubs) {
    if (c.id === p.club) continue;
    const cur = L.players[c.roster[p.role]];
    if (cur && mgmtScore(c, cur) > mgmtScore(c, p) + 0.6) continue;
    const off = humanOffer(L, c, p);
    if (off.salary < playerValue(p) * 0.7) continue;
    out.push({ club: c.id, salary: off.salary, years: 1 + (U.ri(2)) });
  }
  return out.sort((a, b) => b.salary - a.salary).slice(0, 5);
}
/* Переход человека в другой клуб: его место в новом клубе освобождается (тот игрок — в свободные агенты) */
function moveHuman(L, p, toId, salary, years, news) {
  const from = p.club && clubById(L, p.club);
  if (from && from.roster[p.role] === p.id) from.roster[p.role] = null;
  L.humanFree = false;
  const to = clubById(L, toId);
  signPlayer(L, to, p, salary, years, news, 'переход игрока');
  L.humanClub = toId;
  // старый клуб закроет дыру из свободных агентов в межсезонье
}

/* ---------- Развитие клуба руководством ----------
   Отделы клуба (уровни 0–5): во что вкладываться, решает стиль руководства.
   Каждый уровень стоит денег при постройке и требует содержания каждый сезон. */
const FACILITIES = {
  bootcamp: { name: 'Буткемп', icon: '🏋', desc: 'мастерство на героях растёт быстрее (+15% шанса за уровень)' },
  analytics: { name: 'Аналитический отдел', icon: '📊', desc: 'капитан драфтит грамотнее (+0.7 к интеллекту драфта за уровень)' },
  psych: { name: 'Спортивный психолог', icon: '🧘', desc: 'игроки реже тильтуют (−8% за уровень)' },
  media: { name: 'Медиа-студия', icon: '🎥', desc: 'популярность растёт быстрее, рекламные сделки чаще (+15–20% за уровень)' },
  academy: { name: 'Академия', icon: '🎓', desc: 'выпускники академии сильнее (+0.25 к уровню за уровень)' },
};
const FAC_PRIORITY = {
  results: ['analytics', 'bootcamp', 'psych', 'media', 'academy'],
  youth: ['academy', 'bootcamp', 'psych', 'analytics', 'media'],
  profit: ['media', 'academy', 'analytics', 'bootcamp', 'psych'],
  media: ['media', 'psych', 'bootcamp', 'analytics', 'academy'],
};
const facCost = lvl => 280 * lvl;          // постройка уровня lvl
const facUpkeep = lvl => 25 * lvl * lvl;   // содержание за сезон (растёт быстрее уровня)
const facLevel = (c, k) => (c.fac && c.fac[k]) || 0;
/* Игроки «видят» отделы своего клуба в матче (аналитика, психолог) */
function syncFacilities(L) { for (const c of L.clubs) for (const p of rosterOf(L, c)) if (p) p.fac = Object.assign({}, c.fac || {}); }
/* Решения руководства об отделах: в межсезонье и в середине сезона */
function mgmtInvest(L, c, news) {
  c.fac = c.fac || {};
  const style = c.mgmt.style;
  // экономное руководство держит запас; амбициозное — тратит смелее
  const reserve = style === 'profit' ? 900 : 350 + c.mgmt.target * 30;
  let built = 0;
  for (const k of FAC_PRIORITY[style]) {
    const next = facLevel(c, k) + 1;
    if (next > 5 || built >= 2) continue;
    if (c.budget - facCost(next) < reserve) continue;
    c.budget -= facCost(next); c.fac[k] = next; built++;
    news.push({ club: c.id, text: `🏗 ${c.emblem} ${c.name}: руководство вкладывает ${money(facCost(next))} — ${FACILITIES[k].icon} ${FACILITIES[k].name} до уровня ${next}` });
  }
}
/* Совет директоров: два сезона подряд заметно хуже амбиций — руководство меняется (новый стиль) */
function boardReview(L, c, news, rng = frng()) {
  const miss = (c.lastPlace || 8) - c.mgmt.target;
  c.mgmt.strikes = miss >= 4 ? (c.mgmt.strikes || 0) + 1 : 0;
  if (c.budget < -300) c.mgmt.strikes = (c.mgmt.strikes || 0) + 1;
  if (c.mgmt.strikes >= 2) {
    const styles = Object.keys(MGMT_STYLES).filter(s => s !== c.mgmt.style);
    const name = MGMT_NAMES[Math.floor(rng() * MGMT_NAMES.length)];
    const st = styles[Math.floor(rng() * styles.length)];
    news.push({ club: c.id, text: `🔄 ${c.emblem} ${c.name}: совет директоров увольняет руководство (${c.mgmt.name}). Новый глава — ${name}, курс: «${MGMT_STYLES[st].name}»` });
    c.mgmt = { name, style: st, target: U.clamp(c.lastPlace - 2, 1, 14), strikes: 0 };
  }
}
/* Содержание отделов за сезон */
function facUpkeepAll(L, news) {
  for (const c of L.clubs) {
    const up = U.sum(Object.keys(FACILITIES), k => facUpkeep(facLevel(c, k)));
    if (up) c.budget -= up;
  }
}

/* ---------- Пересмотр состава по ходу сезона ----------
   Клуб сильно ниже своих амбиций: руководство может досрочно расторгнуть контракт с самым слабым
   игроком (по средней оценке за сезон, а не по характеристикам), заплатив неустойку, и взять свободного агента. */
const avgRating = p => (p.season && p.season.games ? p.season.ratingSum / p.season.games : 6.5);
function mgmtReview(L, news, rng = frng()) {
  const table = leagueTable(L);
  let humanCut = false;
  for (const c of L.clubs) {
    const place = table.findIndex(r => r.id === c.id) + 1;
    const miss = place - c.mgmt.target;
    if (miss < 4 || rng() > 0.3 + 0.08 * (miss - 4)) continue;
    const roster = rosterOf(L, c).filter(p => p && p.season && p.season.games >= 4);
    if (!roster.length) continue;
    const weak = U.minBy(roster, avgRating);
    if (avgRating(weak) > 6.3) continue;
    // неустойка: половина оставшейся до конца контракта зарплаты (не больше сезона)
    const left = Math.min(1, (L.schedule.length - L.tour) / L.schedule.length + Math.max(0, weak.contract.until - L.season));
    const fee = Math.round(weak.contract.salary * left * 0.5);
    c.budget -= fee;
    news.push({ club: c.id, text: `✂ ${c.emblem} ${c.name} (${place}-е место при цели ${c.mgmt.target}) досрочно расторгает контракт с ${weak.nick}: средняя оценка ${avgRating(weak).toFixed(2)}, неустойка ${money(fee)}` });
    if (weak.human) { c.roster[weak.role] = null; weak.club = null; weak.contract = null; weak.captain = false; L.humanFree = true; L.humanFreeTours = 0; L.humanOffers = []; humanCut = true; }
    else releasePlayer(L, c, weak, null);
    // замена: трансфер, свободный агент или академия
    fillVacancy(L, c, weak.role, news, rng, true, 'замена посреди сезона');
  }
  syncFacilities(L);
  return humanCut;
}

/* ---------- Отношение руководства к игроку ----------
   Считается по тем же правилам, по которым руководство продлевает и расторгает контракты. */
const ATTITUDES = {
  admire: { name: 'восхищается', icon: '🤩', cls: 'att-admire' },
  hopes: { name: 'возлагает надежды', icon: '🌱', cls: 'att-hopes' },
  ok: { name: 'удовлетворительно', icon: '🙂', cls: 'att-ok' },
  disappointed: { name: 'разочаровано', icon: '😒', cls: 'att-bad' },
  firing: { name: 'рассматривает вариант увольнения', icon: '⚠', cls: 'att-fire' },
};
const _tableCache = new WeakMap();
function cachedTable(L) {
  const key = L.season + ':' + L.tour + ':' + L.schedule.flat().filter(f => f.done).length;
  const hit = _tableCache.get(L);
  if (hit && hit.key === key) return hit.t;
  const t = leagueTable(L); _tableCache.set(L, { key, t }); return t;
}
function mgmtAttitude(L, p) {
  const c = p.club && clubById(L, p.club);
  if (!c || !c.mgmt) return null;
  const games = p.season ? p.season.games : 0, r = avgRating(p);
  const table = cachedTable(L), place = table.findIndex(x => x.id === c.id) + 1;
  const miss = place - c.mgmt.target;
  const roster = rosterOf(L, c).filter(x => x && x.season && x.season.games >= 4);
  const weakest = roster.length ? U.minBy(roster, avgRating) : null;
  if (games >= 4 && miss >= 4 && weakest === p && r <= 6.3) return ATTITUDES.firing;
  if (games >= 4 && (r >= 7.6 || (p.season.mvp >= 3 && r >= 7))) return ATTITUDES.admire;
  if (games >= 4 && r < 6.0) return ATTITUDES.disappointed;
  const young = (p.age || 22) <= 21 || p.talent === 'star' || (c.mgmt.style === 'media' && (p.popularity || 0) >= 50);
  if (young && (games < 4 || r >= 6.4)) return ATTITUDES.hopes;
  return ATTITUDES.ok;
}

/* ---------- Развитие игроков в межсезонье ----------
   65% — сумма характеристик почти не меняется (лёгкое перераспределение), 15% — немного растут, 15% — немного падают,
   5% — резкий рост или спад. Кто растёт, а кто падает — зависит от возраста (молодые чаще растут, ветераны сдают).
   Скрытые параметры (интеллект и требовательность) меняются слабее, обычно в ту же сторону. */
/* Успешность сезона: насколько средняя оценка выше ожидаемой для уровня силы игрока (вес растёт с числом сыгранных матчей), MVP,
   небольшая поправка на возраст (молодые прогрессируют быстрее, ветераны быстрее сдают) */
function seasonSuccess(p, tours, expected = 6.5) {
  const g = p.season ? p.season.games : 0;
  const age = p.age || 22;
  // молодые прогрессируют быстрее; после 28 лет спад ускоряется
  const ageAdj = U.clamp((23 - age) * 0.04 - Math.max(0, age - 28) * 0.08, -0.7, 0.25);
  if (!g) return -0.2 + ageAdj;                                   // не играл — без практики
  const conf = Math.min(1, g / Math.max(8, tours * 1.2));         // мало игр — результат весит меньше
  return (avgRating(p) - expected) * conf + ageAdj;
}
/* Место в рейтинге успешности → тип развития: лучшие 2.5% — резкий рост, следующие 15% — рост,
   середина 65% — стабильно, 15% снизу — спад, худшие 2.5% — резкий спад */
function assignDevelopment(players, tours, L_OF = () => 10) {
  // ожидаемая оценка по силе игрока и силе его клуба (регрессия по всей лиге): в зачёт идёт только превышение ожиданий,
  // иначе сильные игроки и игроки сильных клубов всегда росли бы, а слабые — падали
  const teamOf = p => { const c = p.club && L_OF(p); return c ? c : 10; };
  const pl = players.filter(p => p.season && p.season.games >= 6);
  let coef = [6.5, 0, 0];
  if (pl.length > 12) {
    const X = pl.map(p => [1, playerOvr(p), teamOf(p)]), Y = pl.map(avgRating);
    // нормальные уравнения 3×3
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    X.forEach((x, n) => { for (let i = 0; i < 3; i++) { B[i] += x[i] * Y[n]; for (let k = 0; k < 3; k++) A[i][k] += x[i] * x[k]; } });
    for (let i = 0; i < 3; i++) A[i][i] += 1e-6;
    const M = A.map((r, i) => [...r, B[i]]);
    for (let i = 0; i < 3; i++) { let piv = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r; [M[i], M[piv]] = [M[piv], M[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k < 4; k++) M[r][k] -= f * M[i][k]; } }
    coef = M.map((r, i) => r[3] / r[i]);
  }
  const expected = p => coef[0] + coef[1] * playerOvr(p) + coef[2] * teamOf(p);
  const ranked = players.map(p => ({ p, s: seasonSuccess(p, tours, expected(p)) })).sort((x, y) => y.s - x.s);
  const n = ranked.length, out = new Map();
  ranked.forEach((x, i) => {
    const q = (i + 0.5) / n;
    out.set(x.p, q < 0.025 ? 'boom' : q < 0.175 ? 'up' : q < 0.825 ? 'stable' : q < 0.975 ? 'down' : 'crash');
  });
  return out;
}
function developPlayer(p, rng = frng(), forced) {
  let total = 0, kind = forced || 'stable';
  if (kind === 'boom') total = 6 + Math.floor(rng() * 5);
  else if (kind === 'crash') total = -(6 + Math.floor(rng() * 5));
  else if (kind === 'up') total = 2 + Math.floor(rng() * 3);
  else if (kind === 'down') total = -(2 + Math.floor(rng() * 3));
  const before = U.sum(STAT_KEYS, k => p.stats[k]);
  // перераспределение: у «стабильных» одна характеристика может уйти в другую
  if (kind === 'stable' && rng() < 0.5) {
    const a = U.pick(STAT_KEYS), b = U.pick(STAT_KEYS);
    if (a !== b && p.stats[a] > 1 && p.stats[b] < STAT_CAP_BASE) { p.stats[a]--; p.stats[b]++; }
  }
  for (let i = 0, step = Math.sign(total), guard = 0; i < Math.abs(total) && guard < 60; guard++) {
    const k = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
    const v = p.stats[k] + step;
    if (v < 1 || v > STAT_CAP_BASE) continue;
    p.stats[k] = v; i++;
  }
  const delta = U.sum(STAT_KEYS, k => p.stats[k]) - before;
  // скрытые параметры
  if (p.iq && kind !== 'stable') {
    const n = kind === 'boom' || kind === 'crash' ? 2 : 1;
    const k = IQ_KEYS[Math.floor(rng() * IQ_KEYS.length)];
    p.iq[k] = U.clamp(p.iq[k] + Math.sign(total) * n, 1, 20);
  } else if (p.iq && rng() < 0.15) { const k = IQ_KEYS[Math.floor(rng() * IQ_KEYS.length)]; p.iq[k] = U.clamp(p.iq[k] + (rng() < 0.5 ? 1 : -1), 1, 20); }
  if (p.greed != null && rng() < 0.3) p.greed = U.clamp(p.greed + (kind === 'boom' ? 2 : rng() < 0.5 ? 1 : -1), 1, 20);
  p.lastDev = { season: null, delta, kind };
  return p.lastDev;
}


/* ---------- Трансферы ----------
   Освободилось место — руководство сравнивает лучшего свободного агента с игроками этой роли в других клубах.
   Если чужой игрок заметно лучше и денег хватает, клуб предлагает трансферную сумму. Продавец соглашается тем охотнее,
   чем меньше ценит игрока (отношение руководства) и чем сильнее нуждается в деньгах. Игрок соглашается на прибавку к зарплате. */
const ATT_SELL = { firing: 0.95, disappointed: 0.75, ok: 0.45, hopes: 0.25, admire: 0.1 };
function sellChance(L, seller, p, fee) {
  const at = mgmtAttitude(L, p);
  const key = Object.keys(ATTITUDES).find(k => ATTITUDES[k] === at) || 'ok';
  let ch = ATT_SELL[key];
  const b = seller.budget;
  ch += b < 300 ? 0.3 : b < 800 ? 0.15 : b > 2500 ? -0.1 : 0;          // нужда в деньгах
  ch += 0.25 * (fee / Math.max(1, playerValue(p)) - 1);                // щедрость предложения
  if (seller.mgmt.style === 'profit') ch += 0.15;
  if (seller.mgmt.style === 'results') ch -= 0.1;
  return U.clamp(ch, 0.02, 0.97);
}
function fillVacancy(L, c, role, news, rng = frng(), allowBuy = true, why) {
  if (L.players[c.roster[role]]) return;
  const fa = L.free.filter(p => p.role === role);
  const bestFA = fa.length ? U.maxBy(fa, x => mgmtScore(c, x)) : null;
  const faScore = bestFA ? mgmtScore(c, bestFA) : 0;
  if (allowBuy && c.budget > 450) {
    const pool = L.clubs.filter(x => x !== c).map(x => L.players[x.roster[role]]).filter(p => p && !p.human && p.contract && mgmtScore(c, p) > faScore + 0.6);
    for (const p of pool.sort((a, b) => mgmtScore(c, b) - mgmtScore(c, a)).slice(0, 3)) {
      const seller = clubById(L, p.club);
      const years = Math.max(0, p.contract.until - L.season);
      const fee = Math.round(playerValue(p) * (0.9 + 0.3 * years) * (1 + (14 - c.mgmt.target) * 0.01));
      const salary = Math.round(Math.max(p.contract.salary * 1.1, playerDemand(p) * 0.95));
      if (c.budget - fee < 200 || salary > mgmtMaxOffer(L, c, p) * 1.15) continue;
      if (rng() > sellChance(L, seller, p, fee)) { news.push({ club: c.id, text: `🤝 ${c.emblem} ${c.name} предлагает ${money(fee)} за ${p.nick} (${seller.tag}) — ${seller.name} отказывает` }); continue; }
      c.budget -= fee; seller.budget += fee;
      seller.roster[role] = null;
      signPlayer(L, c, p, salary, 2, news, `трансфер из ${seller.emblem} ${seller.name} за ${money(fee)}`);
      fillVacancy(L, seller, role, news, rng, false, 'после продажи игрока');
      return;
    }
  }
  if (bestFA && playerDemand(bestFA) * 0.9 <= mgmtMaxOffer(L, c, bestFA) * 1.1) {
    signPlayer(L, c, bestFA, Math.min(playerDemand(bestFA), mgmtMaxOffer(L, c, bestFA)), 1 + Math.floor(rng() * 2), news, why || 'из свободных агентов');
    return;
  }
  const used = new Set([...Object.values(L.players), ...L.free].map(x => x.nick.toLowerCase()));
  const p = genLeaguePlayer(rng, used, role, 8.4 + 0.25 * facLevel(c, 'academy') + rng() * 1.2);
  p.age = 18; assignMastery(rng, [p]); initPlayerFinance(L, p, rng); L.free.push(p);
  signPlayer(L, c, p, playerValue(p) * 0.8, 2, news, 'выпускник академии');
}


/* ---------- Игрок-человек — свободный агент ----------
   Человек ждёт и смотрит турнир; клубы со временем присылают предложения. Шанс выше, если он сильнее
   их нынешнего игрока на этой роли и у клуба есть деньги. Предложение действует несколько туров. */
function humanOfferTick(L, news, boost = 1, rng = frng()) {
  const me = L.players[L.humanId];
  const now = L.season * 100 + L.tour;
  L.humanOffers = (L.humanOffers || []).filter(o => o.expires >= now);
  L.humanFreeTours = (L.humanFreeTours || 0) + 1;
  for (const c of L.clubs) {
    if (L.humanOffers.some(o => o.club === c.id)) continue;
    const cur = L.players[c.roster[me.role]];
    const interest = mgmtScore(c, me) - (cur ? mgmtScore(c, cur) : 0);
    let ch = U.clamp(0.05 + 0.08 * interest, 0, 0.5) * boost * (c.budget < 300 ? 0.5 : 1);
    if (rng() > ch) continue;
    const off = humanOffer(L, c, me);
    L.humanOffers.push({ club: c.id, salary: off.salary, years: 1 + Math.floor(rng() * 2), expires: now + 3 });
    news.push({ club: c.id, text: `📨 ${c.emblem} ${c.name} предлагает вам контракт: ${money(off.salary)} за сезон` });
  }
  // долго без предложений — самый нуждающийся клуб всё же зовёт
  if (!L.humanOffers.length && L.humanFreeTours >= 4) {
    const c = U.minBy(L.clubs, x => { const p = L.players[x.roster[me.role]]; return p ? avgRating(p) + playerOvr(p) / 10 : 0; });
    L.humanOffers.push({ club: c.id, salary: Math.round(playerValue(me) * 0.8), years: 1, expires: now + 3 });
    news.push({ club: c.id, text: `📨 ${c.emblem} ${c.name} предлагает вам контракт: ${money(Math.round(playerValue(me) * 0.8))} за сезон` });
  }
}
