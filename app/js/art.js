// Shared drawings — bodhi (bo) leaves, lotus, moon — used as SVG on screen and on canvas
// for the thank-you card, the PDF and the photo collage.

/** Heart-shaped leaf with the long drip tip. Stalk joins at 0,0; the tip points down at about 0,82. */
const LEAF = 'M0 0C-6 -9-27 -10-32 7C-36 25-18 41-8 53C-4 59-2 68 2 82C3 68 5 59 9 53C20 41 37 25 32 7C27 -10 6 -9 0 0Z';
const VEINS = 'M0 2C0 26 0 48 1.5 74M0 12C-9 11-18 14-25 20M0 12C9 11 18 14 25 20M0 26C-7 26-14 30-19 36M0 26C7 26 14 30 19 36M0 39C-4 40-8 43-10 47M0 39C4 40 8 43 11 47';

// One branch: [x, y, turn°, size, tone] per leaf, along a curved twig. Tone 0 = silhouette, 1 = moonlit.
const TWIGS = ['M-70 -38C-30 -22 8 -6 52 2C92 9 128 2 176 14', 'M26 -3C40 14 44 30 42 46', 'M92 5C104 20 110 30 112 44', 'M140 5C152 14 160 22 166 34'];
const LEAVES = [
  [-34, -24, 24, 0.5, 1], [-6, -12, -20, 0.62, 1], [42, 44, 8, 0.66, 0], [30, 8, 38, 0.5, 0], [58, 3, -24, 0.56, 0],
  [112, 42, -8, 0.64, 0], [84, 6, 20, 0.48, 0], [124, 4, -40, 0.46, 1], [166, 32, -16, 0.6, 1], [176, 14, -58, 0.5, 1], [148, 6, 14, 0.42, 1],
];
const TONE = ['#0b1433', '#2f5d4a'];

const SYNODIC = 29.53;
function litPath(days, cx, cy, r) {
  const d = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 + Math.cos((d / SYNODIC) * 2 * Math.PI)) / 2; // 1 = full
  if (lit > 0.985) return '';
  const outer = d < SYNODIC / 2 ? 1 : 0, inner = lit > 0.5 ? outer : 1 - outer, rx = Math.abs(1 - 2 * lit) * r;
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${outer} ${cx} ${cy + r}A${rx.toFixed(2)} ${r} 0 0 ${inner} ${cx} ${cy - r}Z`;
}

/** The moon of the day seen through a bo branch. It fills as poya approaches. */
export function boMoonSvg(days) {
  const p = litPath(days, 80, 92, 66);
  return `<svg class="bomoon" viewBox="0 0 160 170" aria-hidden="true">
    <defs><radialGradient id="mg"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".5"/><stop offset=".62" stop-color="#ffe9a8" stop-opacity=".22"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
    <radialGradient id="ms" cx=".4" cy=".35"><stop offset="0" stop-color="#fff8dd"/><stop offset="1" stop-color="#fbdc88"/></radialGradient></defs>
    <circle cx="80" cy="92" r="108" fill="url(#mg)"/>
    <circle cx="80" cy="92" r="66" fill="${p ? 'rgba(255,255,255,.1)' : 'url(#ms)'}"/>${p ? `<path d="${p}" fill="url(#ms)"/>` : ''}
    ${p ? '' : '<g fill="#e9c871" opacity=".45"><circle cx="62" cy="112" r="11"/><circle cx="106" cy="104" r="8"/><circle cx="92" cy="132" r="6"/><circle cx="58" cy="82" r="5"/></g>'}
    <g class="bough"><g transform="translate(-9 0) scale(.86)"><g fill="none" stroke="#1c1426" stroke-linecap="round">${TWIGS.map((d, i) => `<path d="${d}" stroke-width="${i ? 2 : 4.5}"/>`).join('')}</g>
    ${LEAVES.map(([x, y, a, s, t]) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="${LEAF}" fill="${TONE[t]}"/><path d="${VEINS}" fill="none" stroke="${t ? '#7fb79a' : '#3a4a7c'}" stroke-width="1.3" stroke-linecap="round"/></g>`).join('')}</g></g></svg>`;
}

/* ---------------- canvas ---------------- */
export const SERIF = '"Abhaya Libre", "Noto Serif Sinhala", "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", serif';
export const SANS = '"Noto Sans Sinhala", "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", sans-serif';

/** Web fonts must be ready before drawing, or the first picture would use a fallback face. */
export async function fontsReady() {
  if (!document.fonts) return;
  await Promise.race([
    Promise.all(['700 60px "Abhaya Libre"', '400 30px "Noto Sans Sinhala"', '500 30px "Noto Sans Sinhala"', '700 30px "Noto Sans Sinhala"'].map(f => document.fonts.load(f, 'ස්තුතියි'))).catch(() => {}),
    new Promise(r => setTimeout(r, 2500)),
  ]);
}

export function leaf(c, x, y, deg, scale, fill, vein) {
  c.save(); c.translate(x, y); c.rotate((deg * Math.PI) / 180); c.scale(scale, scale);
  c.fillStyle = fill; c.fill(new Path2D(LEAF));
  if (vein) { c.strokeStyle = vein; c.lineWidth = 1.2; c.lineCap = 'round'; c.stroke(new Path2D(VEINS)); }
  c.restore();
}
export function bough(c, x, y, scale, { flip = false, twig = '#120d1c', tones = [['#0b1433', '#3a4a7c'], ['#2f5d4a', '#7fb79a']] } = {}) {
  c.save(); c.translate(x, y); c.scale(flip ? -scale : scale, scale);
  c.strokeStyle = twig; c.lineCap = 'round';
  TWIGS.forEach((d, i) => { c.lineWidth = i ? 2 : 4.5; c.stroke(new Path2D(d)); });
  LEAVES.forEach(([lx, ly, a, s, t]) => leaf(c, lx, ly, a, s, tones[t][0], tones[t][1]));
  c.restore();
}
export function fullMoon(c, x, y, r, glow = r * 2.6) {
  const g = c.createRadialGradient(x, y, r * 0.5, x, y, glow);
  g.addColorStop(0, 'rgba(255,236,170,.55)'); g.addColorStop(1, 'rgba(255,236,170,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, glow, 0, 7); c.fill();
  const m = c.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  m.addColorStop(0, '#fff8dd'); m.addColorStop(1, '#fbdc88');
  c.fillStyle = m; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
}
function petal(c, x, y, len, wid, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(-wid, -len * 0.35, -wid * 0.55, -len * 0.85, 0, -len);
  c.bezierCurveTo(wid * 0.55, -len * 0.85, wid, -len * 0.35, 0, 0);
  c.fill(); c.stroke(); c.restore();
}
export function lotus(c, x, y, s) {
  c.lineWidth = 2 * s; c.strokeStyle = '#c9788f';
  [[-1.25, 0.78], [1.25, 0.78], [-0.85, 0.92], [0.85, 0.92], [-0.45, 1], [0.45, 1], [0, 1.06]].forEach(([a, l], i) => {
    const g = c.createLinearGradient(x, y, x, y - 120 * s);
    g.addColorStop(0, i % 2 ? '#f7c3d0' : '#f2b0c1'); g.addColorStop(1, '#fff2f5');
    c.fillStyle = g;
    petal(c, x, y, 118 * s * l, 40 * s, a);
  });
}
export function stars(c, w, h, n = 70) {
  // fixed positions, so a picture always comes out the same
  for (let i = 0; i < n; i++) { c.globalAlpha = 0.15 + (i % 5) * 0.12; c.fillStyle = '#fff'; c.beginPath(); c.arc((i * 197) % w, (i * 331) % h, 1 + (i % 3) * 0.7, 0, 7); c.fill(); }
  c.globalAlpha = 1;
}
export function night(c, x, y, w, h) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0f1740'); g.addColorStop(0.55, '#16204f'); g.addColorStop(1, '#2a347c');
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
export function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/** Split text into lines no wider than `max` with the current font. Over-long words are broken by letter cluster. */
export function wrap(c, str, max) {
  const rows = [];
  let cur = '';
  const seg = globalThis.Intl?.Segmenter ? new Intl.Segmenter('si', { granularity: 'grapheme' }) : null;
  String(str ?? '').split(/\s+/).filter(Boolean).forEach(w => {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width <= max) { cur = t; return; }
    if (cur) rows.push(cur);
    cur = w;
    if (seg && c.measureText(w).width > max) {
      cur = '';
      for (const { segment } of seg.segment(w)) { if (cur && c.measureText(cur + segment).width > max) { rows.push(cur); cur = ''; } cur += segment; }
    }
  });
  rows.push(cur);
  return rows;
}
/** Centred text that shrinks until it fits. Returns the y after the last line. */
export function fitText(c, str, x, y, { size, font, weight = 400, color, max, lines = 2, gap = 1.35 }) {
  let rows, px = size;
  for (; px > 18; px -= 2) {
    c.font = `${weight} ${px}px ${font}`;
    rows = wrap(c, str, max);
    if (rows.length <= lines) break;
  }
  c.fillStyle = color; c.textAlign = 'center';
  rows.forEach((r, i) => c.fillText(r, x, y + i * px * gap));
  return y + rows.length * px * gap;
}
