'use strict';
/* Процедурный генератор лиц игроков (SVG).
   genFace(rng, {female}) — параметры лица; faceSVG(face, {jersey, jersey2}) — готовая картинка. */

const FACE_PAL = {
  skin: ['#f8dcc8', '#f1c7a8', '#e5b08c', '#d29a72', '#b97d55', '#9a6342', '#7b4a2f', '#5e3823', '#f4d0b5', '#c48a63'],
  hair: ['#17120f', '#2e2019', '#4a3020', '#6b4428', '#8d5a2f', '#b98448', '#d8b46e', '#ecdcb4', '#9e3423', '#c75a26', '#7d838c', '#e8e8ea', '#3657d6', '#c23a8c', '#2aa37a', '#7b4fd6'],
  eye: ['#4a3426', '#6a4a2c', '#2d5e8a', '#3e7d5a', '#6f7682', '#2a211c', '#8a6d2f'],
  lip: ['#c97b74', '#b8655f', '#a65a52', '#d48b86', '#8d4b44'],
};
const HAIR_STYLES = ['лысый', 'ёжик', 'короткая', 'с пробором', 'колючки', 'длинные', 'хвост', 'пучок', 'ирокез', 'кудри', 'андеркат', 'каре'];
const BEARDS = ['нет', 'щетина', 'усы', 'эспаньолка', 'борода'];
const ACCS = ['нет', 'очки', 'тёмные очки', 'гарнитура', 'серьга', 'шрам', 'повязка'];

function genFace(rng, o = {}) {
  const f = !!o.female;
  const pick = (arr, w) => { if (!w) return rng.ri(arr.length); let s = rng() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { s -= w[i]; if (s <= 0) return i; } return w.length - 1; };
  const dyed = rng() < 0.12;
  return {
    skin: rng.ri(FACE_PAL.skin.length),
    rx: rng.range(20.5, 24.5), ry: rng.range(26, 30), jaw: f ? rng.range(0, 0.45) : rng.range(0.2, 1),
    eyeType: rng.ri(4), eyeSize: rng.range(2.5, 3.5) + (f ? 0.25 : 0), eyeGap: rng.range(8.6, 10.6), eyeColor: rng.ri(FACE_PAL.eye.length),
    brow: rng.range(1.2, f ? 2 : 3), browTilt: rng.range(-12, 14), nose: rng.ri(3), noseLen: rng.range(5, 8.5),
    mouth: rng.ri(4), mouthW: rng.range(6.5, 10.5), lip: rng.ri(FACE_PAL.lip.length),
    hair: f ? pick(HAIR_STYLES, [0.1, 0.3, 1, 1, 0.3, 4, 3, 2.5, 0.4, 1.5, 0.8, 3]) : pick(HAIR_STYLES, [1.2, 2, 3, 2.5, 1.5, 0.8, 0.6, 0.4, 0.6, 1, 1.5, 0.3]),
    hairColor: dyed ? 12 + rng.ri(4) : rng.ri(12),
    beard: f ? 0 : pick(BEARDS, [5, 2, 1, 1, 1.2]),
    acc: pick(ACCS, [6, 1.4, 0.8, 1.6, f ? 1.5 : 0.6, 0.5, 0.6]),
    freckles: rng() < 0.18, blush: f ? rng() < 0.6 : rng() < 0.1,
    female: f,
  };
}

let _faceUid = 0;
function faceSVG(F, o = {}) {
  const id = 'fc' + (++_faceUid);
  const skin = FACE_PAL.skin[F.skin], hair = FACE_PAL.hair[F.hairColor], eye = FACE_PAL.eye[F.eyeColor], lip = FACE_PAL.lip[F.lip];
  const jersey = o.jersey || '#2b4c7e', jersey2 = o.jersey2 || '#c8aa6e';
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = x => Math.max(0, Math.min(255, Math.round(x * k))); return `rgb(${c(n >> 16 & 255)},${c(n >> 8 & 255)},${c(n & 255)})`; };
  const cx = 50, cy = 47, rx = F.rx, ry = F.ry, top = cy - ry, bot = cy + ry, j = F.jaw;
  const head = `M${cx} ${top} C${cx + rx * 1.12} ${top} ${cx + rx} ${cy - ry * 0.25} ${cx + rx} ${cy + ry * 0.08} C${cx + rx} ${cy + ry * (0.5 + j * 0.22)} ${cx + rx * (0.42 + j * 0.3)} ${bot} ${cx} ${bot} C${cx - rx * (0.42 + j * 0.3)} ${bot} ${cx - rx} ${cy + ry * (0.5 + j * 0.22)} ${cx - rx} ${cy + ry * 0.08} C${cx - rx} ${cy - ry * 0.25} ${cx - rx * 1.12} ${top} ${cx} ${top}Z`;
  const cap = (lift = 0, fringe = 0.32) => `M${cx - rx - 1.5} ${cy - 1} C${cx - rx - 3} ${top - 7 - lift} ${cx + rx + 3} ${top - 7 - lift} ${cx + rx + 1.5} ${cy - 1} C${cx + rx * 0.75} ${top + ry * fringe} ${cx - rx * 0.75} ${top + ry * fringe} ${cx - rx - 1.5} ${cy - 1}Z`;
  const parts = [];
  // фон и форма клуба
  parts.push(`<defs><clipPath id="${id}c"><circle cx="50" cy="50" r="50"/></clipPath><radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${o.bg || '#3a4766'}"/><stop offset="1" stop-color="#0d1220"/></radialGradient></defs>`);
  parts.push(`<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="url(#${id}g)"/>`);
  // волосы сзади (длинные, хвост, каре)
  if (F.hair === 5) parts.push(`<path d="M${cx - rx - 3} ${cy - 6} C${cx - rx - 6} ${cy + 20} ${cx - rx - 2} ${cy + 36} ${cx - rx + 4} ${cy + 40} L${cx + rx - 4} ${cy + 40} C${cx + rx + 2} ${cy + 36} ${cx + rx + 6} ${cy + 20} ${cx + rx + 3} ${cy - 6}Z" fill="${shade(hair, 0.85)}"/>`);
  if (F.hair === 11) parts.push(`<path d="M${cx - rx - 3} ${cy - 6} L${cx - rx - 3} ${cy + 16} Q${cx} ${cy + 22} ${cx + rx + 3} ${cy + 16} L${cx + rx + 3} ${cy - 6}Z" fill="${shade(hair, 0.85)}"/>`);
  if (F.hair === 6) parts.push(`<path d="M${cx + rx - 2} ${top + 8} C${cx + rx + 14} ${top + 12} ${cx + rx + 12} ${cy + 26} ${cx + rx + 2} ${cy + 34} C${cx + rx + 4} ${cy + 18} ${cx + rx + 2} ${top + 18} ${cx + rx - 4} ${top + 12}Z" fill="${shade(hair, 0.9)}"/>`);
  // тело, шея
  parts.push(`<path d="M8 100 C10 82 28 75 50 75 C72 75 90 82 92 100Z" fill="${jersey}"/>`);
  parts.push(`<path d="M8 100 C10 86 20 80 30 78 L33 100Z" fill="${shade(jersey, 0.75)}"/><path d="M92 100 C90 86 80 80 70 78 L67 100Z" fill="${shade(jersey, 0.75)}"/>`);
  parts.push(`<rect x="${cx - 8}" y="${bot - 8}" width="16" height="16" rx="5" fill="${shade(skin, 0.85)}"/>`);
  parts.push(`<path d="M41 76 L50 86 L59 76" fill="${shade(skin, 0.85)}" stroke="${jersey2}" stroke-width="2.4" stroke-linejoin="round"/>`);
  if (o.emblem) parts.push(`<text x="68" y="94" font-size="9" text-anchor="middle">${o.emblem}</text>`);
  else parts.push(`<rect x="63" y="84" width="10" height="3" rx="1.5" fill="${jersey2}" opacity=".9"/>`);
  // уши и голова
  parts.push(`<ellipse cx="${cx - rx + 0.5}" cy="${cy + 3}" rx="3.6" ry="6" fill="${shade(skin, 0.92)}"/><ellipse cx="${cx + rx - 0.5}" cy="${cy + 3}" rx="3.6" ry="6" fill="${shade(skin, 0.92)}"/>`);
  parts.push(`<path d="${head}" fill="${skin}"/>`);
  parts.push(`<path d="${head}" fill="url(#${id}g)" opacity=".06"/>`);
  // щетина/борода (под чертами лица)
  const jawPath = `M${cx - rx + 1} ${cy + 4} C${cx - rx + 1} ${cy + ry * (0.5 + j * 0.22)} ${cx - rx * (0.42 + j * 0.3)} ${bot} ${cx} ${bot} C${cx + rx * (0.42 + j * 0.3)} ${bot} ${cx + rx - 1} ${cy + ry * (0.5 + j * 0.22)} ${cx + rx - 1} ${cy + 4} C${cx + rx * 0.5} ${cy + ry * 0.62} ${cx - rx * 0.5} ${cy + ry * 0.62} ${cx - rx + 1} ${cy + 4}Z`;
  if (F.beard === 1) parts.push(`<path d="${jawPath}" fill="${hair}" opacity=".22"/>`);
  if (F.beard === 4) parts.push(`<path d="${jawPath}" fill="${hair}" opacity=".95"/>`);
  // румянец и веснушки
  const eyY = cy + 1, g = F.eyeGap, es = F.eyeSize;
  if (F.blush) parts.push(`<ellipse cx="${cx - g - 2}" cy="${eyY + 9}" rx="4.5" ry="2.4" fill="#ff7f8a" opacity=".22"/><ellipse cx="${cx + g + 2}" cy="${eyY + 9}" rx="4.5" ry="2.4" fill="#ff7f8a" opacity=".22"/>`);
  if (F.freckles) for (const [dx, dy] of [[-12, 7], [-9, 9], [-14, 10], [-7, 7], [12, 7], [9, 9], [14, 10], [7, 7]]) parts.push(`<circle cx="${cx + dx}" cy="${eyY + dy}" r=".7" fill="${shade(skin, 0.6)}"/>`);
  // глаза
  for (const s of [-1, 1]) {
    const ex = cx + s * g;
    const ry2 = F.eyeType === 1 ? es * 0.62 : es + 0.6;
    const rot = F.eyeType === 2 ? s * -9 : 0;
    parts.push(`<g transform="rotate(${rot} ${ex} ${eyY})"><ellipse cx="${ex}" cy="${eyY}" rx="${es + 1.4}" ry="${ry2}" fill="#fbfbf8"/><circle cx="${ex}" cy="${eyY + 0.2}" r="${Math.min(es * 0.78, ry2)}" fill="${eye}"/><circle cx="${ex}" cy="${eyY + 0.2}" r="${Math.min(es * 0.36, ry2 * 0.6)}" fill="#111"/><circle cx="${ex + 0.8}" cy="${eyY - 0.6}" r=".7" fill="#fff"/>`);
    if (F.eyeType === 3) parts.push(`<path d="M${ex - es - 1.8} ${eyY - 0.3} Q${ex} ${eyY - ry2 - 1.6} ${ex + es + 1.8} ${eyY - 0.3} L${ex + es + 1.8} ${eyY - ry2 - 2} L${ex - es - 1.8} ${eyY - ry2 - 2}Z" fill="${skin}"/>`);
    parts.push(`<path d="M${ex - es - 1.4} ${eyY - 0.2} Q${ex} ${eyY - ry2 - 1.2} ${ex + es + 1.4} ${eyY - 0.2}" fill="none" stroke="${shade(skin, 0.45)}" stroke-width=".8"/></g>`);
    // брови
    const by = eyY - es - 4.2;
    parts.push(`<path d="M${ex - 5} ${by + 0.8} Q${ex} ${by - 1.2} ${ex + 5} ${by + 0.6}" transform="rotate(${s * F.browTilt * 0.5} ${ex} ${by})" fill="none" stroke="${shade(hair, 0.8)}" stroke-width="${F.brow}" stroke-linecap="round"/>`);
  }
  // нос
  const ny = eyY + F.noseLen + 4;
  if (F.nose === 0) parts.push(`<path d="M${cx + 0.5} ${eyY + 3} Q${cx + 3} ${ny - 1} ${cx} ${ny}" fill="none" stroke="${shade(skin, 0.6)}" stroke-width="1.1" stroke-linecap="round"/>`);
  else if (F.nose === 1) parts.push(`<path d="M${cx - 3} ${ny - 0.5} Q${cx} ${ny + 2.5} ${cx + 3} ${ny - 0.5}" fill="none" stroke="${shade(skin, 0.6)}" stroke-width="1.1" stroke-linecap="round"/><circle cx="${cx - 1.8}" cy="${ny}" r=".7" fill="${shade(skin, 0.55)}"/><circle cx="${cx + 1.8}" cy="${ny}" r=".7" fill="${shade(skin, 0.55)}"/>`);
  else parts.push(`<path d="M${cx - 4} ${ny} Q${cx - 4.5} ${ny - 3} ${cx - 1} ${ny - 4} M${cx + 4} ${ny} Q${cx + 4.5} ${ny - 3} ${cx + 1} ${ny - 4} M${cx - 2.5} ${ny + 0.8} Q${cx} ${ny + 2} ${cx + 2.5} ${ny + 0.8}" fill="none" stroke="${shade(skin, 0.6)}" stroke-width="1.1" stroke-linecap="round"/>`);
  // рот
  const my = ny + 7.5, mw = F.mouthW;
  if (F.mouth === 0) parts.push(`<path d="M${cx - mw} ${my} Q${cx} ${my + 4.5} ${cx + mw} ${my}" fill="none" stroke="${lip}" stroke-width="1.8" stroke-linecap="round"/>`);
  else if (F.mouth === 1) parts.push(`<path d="M${cx - mw * 0.8} ${my + 1} L${cx + mw * 0.8} ${my + 1}" stroke="${lip}" stroke-width="1.8" stroke-linecap="round"/>`);
  else if (F.mouth === 2) parts.push(`<path d="M${cx - mw * 0.8} ${my + 1.5} Q${cx + mw * 0.2} ${my + 2.5} ${cx + mw} ${my - 1}" fill="none" stroke="${lip}" stroke-width="1.8" stroke-linecap="round"/>`);
  else parts.push(`<path d="M${cx - mw} ${my} Q${cx} ${my + 7} ${cx + mw} ${my}Z" fill="#5a1f22"/><path d="M${cx - mw + 1.5} ${my + 0.4} L${cx + mw - 1.5} ${my + 0.4} L${cx + mw - 3} ${my + 2} L${cx - mw + 3} ${my + 2}Z" fill="#fff"/>`);
  // усы, эспаньолка
  if (F.beard === 2 || F.beard === 4) parts.push(`<path d="M${cx - mw - 1} ${my - 0.5} Q${cx - 3} ${my - 4.5} ${cx} ${my - 2.5} Q${cx + 3} ${my - 4.5} ${cx + mw + 1} ${my - 0.5} Q${cx} ${my - 1.8} ${cx - mw - 1} ${my - 0.5}Z" fill="${hair}"/>`);
  if (F.beard === 3) parts.push(`<path d="M${cx - 4} ${my + 3} Q${cx} ${bot + 3} ${cx + 4} ${my + 3} Q${cx} ${my + 5} ${cx - 4} ${my + 3}Z" fill="${hair}"/><path d="M${cx - mw} ${my - 0.5} Q${cx} ${my - 4} ${cx + mw} ${my - 0.5}" fill="none" stroke="${hair}" stroke-width="1.6"/>`);
  // причёска (спереди)
  const H = F.hair;
  if (H === 1) parts.push(`<path d="${cap(-2, 0.22)}" fill="${hair}" opacity=".55"/>`);
  if ([2, 3, 4, 5, 6, 7, 11].includes(H)) parts.push(`<path d="${cap(H === 7 ? 1 : 0, H === 11 ? 0.42 : 0.32)}" fill="${hair}"/>`);
  if (H === 3) parts.push(`<path d="M${cx - rx} ${top + 9} C${cx - 8} ${top - 2} ${cx + 10} ${top + 2} ${cx + rx + 1} ${top + 16} C${cx + 6} ${top + 7} ${cx - 8} ${top + 8} ${cx - rx} ${top + 13}Z" fill="${shade(hair, 1.15)}"/>`);
  if (H === 4) for (let i = -3; i <= 3; i++) parts.push(`<path d="M${cx + i * 6 - 4} ${top + 4} L${cx + i * 6 + i * 0.6} ${top - 9 - (3 - Math.abs(i))} L${cx + i * 6 + 4} ${top + 4}Z" fill="${hair}"/>`);
  if (H === 7) parts.push(`<circle cx="${cx}" cy="${top - 7}" r="7.5" fill="${hair}"/><circle cx="${cx - 2}" cy="${top - 9}" r="2.5" fill="${shade(hair, 1.3)}" opacity=".5"/>`);
  if (H === 8) parts.push(`<path d="M${cx - 5} ${top + 10} C${cx - 7} ${top - 4} ${cx - 3} ${top - 13} ${cx} ${top - 14} C${cx + 3} ${top - 13} ${cx + 7} ${top - 4} ${cx + 5} ${top + 10}Z" fill="${hair}"/><path d="${cap(-3, 0.2)}" fill="${hair}" opacity=".3"/>`);
  if (H === 9) for (let a = 0; a <= 12; a++) { const t = Math.PI + (a / 12) * Math.PI; parts.push(`<circle cx="${cx + Math.cos(t) * (rx + 1)}" cy="${cy - 4 + Math.sin(t) * (ry - 1)}" r="${5.2 + (a % 3)}" fill="${a % 2 ? hair : shade(hair, 1.15)}"/>`); }
  if (H === 10) parts.push(`<path d="${cap(0, 0.28)}" fill="${hair}" opacity=".35"/><path d="M${cx - rx * 0.7} ${top + 9} C${cx - rx * 0.8} ${top - 8} ${cx + rx * 0.8} ${top - 8} ${cx + rx * 0.7} ${top + 9} C${cx + 4} ${top + 3} ${cx - 4} ${top + 3} ${cx - rx * 0.7} ${top + 9}Z" fill="${hair}"/>`);
  if (H === 0) parts.push(`<ellipse cx="${cx - 7}" cy="${top + 7}" rx="6" ry="2.5" fill="#fff" opacity=".18" transform="rotate(-20 ${cx - 7} ${top + 7})"/>`);
  if (H === 5) parts.push(`<path d="M${cx - rx - 2} ${cy - 2} C${cx - rx - 3} ${cy + 10} ${cx - rx} ${cy + 18} ${cx - rx + 2} ${cy + 22} L${cx - rx + 4} ${cy - 4}Z M${cx + rx + 2} ${cy - 2} C${cx + rx + 3} ${cy + 10} ${cx + rx} ${cy + 18} ${cx + rx - 2} ${cy + 22} L${cx + rx - 4} ${cy - 4}Z" fill="${hair}"/>`);
  // аксессуары
  const A = F.acc;
  if (A === 1 || A === 2) {
    const dark = A === 2;
    for (const s of [-1, 1]) parts.push(`<rect x="${cx + s * g - 5.6}" y="${eyY - 4}" width="11.2" height="8" rx="${dark ? 3 : 3.8}" fill="${dark ? '#121418' : 'rgba(255,255,255,.12)'}" stroke="#1d1d22" stroke-width="1.4"/>`);
    parts.push(`<path d="M${cx - g + 5.6} ${eyY - 1} Q${cx} ${eyY - 3} ${cx + g - 5.6} ${eyY - 1}" fill="none" stroke="#1d1d22" stroke-width="1.4"/>`);
    if (dark) parts.push(`<path d="M${cx - g - 3} ${eyY - 2.5} L${cx - g - 0.5} ${eyY - 2.5}" stroke="#fff" stroke-width=".8" opacity=".5"/>`);
  }
  if (A === 3) {
    parts.push(`<path d="M${cx - rx - 2} ${cy + 1} C${cx - rx - 2} ${top - 14} ${cx + rx + 2} ${top - 14} ${cx + rx + 2} ${cy + 1}" fill="none" stroke="#1b1e26" stroke-width="3.2"/>`);
    for (const s of [-1, 1]) parts.push(`<rect x="${cx + s * (rx + 0.5) - 4}" y="${cy - 3}" width="8" height="11" rx="3" fill="#1b1e26" stroke="${jersey2}" stroke-width="1"/>`);
    parts.push(`<path d="M${cx - rx - 1} ${cy + 7} Q${cx - rx + 2} ${my + 2} ${cx - mw - 3} ${my + 1}" fill="none" stroke="#1b1e26" stroke-width="1.6"/><circle cx="${cx - mw - 3}" cy="${my + 1}" r="1.6" fill="#1b1e26"/>`);
  }
  if (A === 4) parts.push(`<circle cx="${cx + rx - 0.5}" cy="${cy + 9}" r="1.6" fill="#ffd34d" stroke="#a87b12" stroke-width=".5"/>`);
  if (A === 5) parts.push(`<path d="M${cx + g - 1} ${eyY + 5} L${cx + g + 4} ${eyY + 12}" stroke="${shade(skin, 0.6)}" stroke-width="1.2"/><path d="M${cx + g} ${eyY + 7} l2 -1 M${cx + g + 1.4} ${eyY + 9} l2 -1 M${cx + g + 2.8} ${eyY + 11} l2 -1" stroke="${shade(skin, 0.6)}" stroke-width=".7"/>`);
  if (A === 6) parts.push(`<path d="M${cx - rx - 1} ${top + 12} Q${cx} ${top + 6} ${cx + rx + 1} ${top + 12} L${cx + rx + 1} ${top + 17} Q${cx} ${top + 11} ${cx - rx - 1} ${top + 17}Z" fill="${jersey2}"/>`);
  parts.push('</g>');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="face">${parts.join('')}</svg>`;
}
