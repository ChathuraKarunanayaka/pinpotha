// Paints photo collages. Layout maths is pure (and tested); drawing needs a canvas.
import { SERIF, SANS, fontsReady, night, stars, fullMoon, bough, leaf, lotus, roundRect, fitText } from './art.js';

export const W = 1440, H = 1800, FOOT = 250, MAX = 12;

export const THEMES = {
  night: { label: 'පුන් සඳ', bg: ['#0f1740', '#2a347c'], ink: '#fff8e6', accent: '#f3c85b', frame: '#ffffff', leaf: [['#0b1433', '#3a4a7c'], ['#2f5d4a', '#7fb79a']] },
  lotus: { label: 'නෙළුම්', bg: ['#fff0f4', '#f3b8c8'], ink: '#6b1d3a', accent: '#a8345c', frame: '#ffffff', leaf: [['#7fa38c', '#ffffff'], ['#5d8a70', '#ffffff']] },
  bo: { label: 'බෝ පත්', bg: ['#eef6e6', '#9cc48f'], ink: '#173d2b', accent: '#20613f', frame: '#ffffff', leaf: [['#2f6b4a', '#a9d4b5'], ['#4c8a5f', '#cfe9d4']] },
  saffron: { label: 'කහ පැහැය', bg: ['#fff3cf', '#f2a93b'], ink: '#5a2a00', accent: '#9a3d00', frame: '#fffdf5', leaf: [['#8a5a00', '#ffe1a0'], ['#a8760f', '#ffe9ba']] },
};
export const STYLES = { mosaic: 'මොසෙයික්', moon: 'සඳ වටා', polaroid: 'ඡායාරූප කැබලි', hero: 'ප්‍රධාන ඡායාරූපය' };

/* ---------------- layouts: n photos → [{ x, y, w, h, rot?, round? }], the first is the main photo ---------------- */
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Photos per row: never more than three, smaller rows first so the main photo is the largest. */
export function rowsFor(n) {
  if (n <= 3) return n === 3 ? [1, 2] : n === 2 ? [1, 1] : [1];
  const k = Math.round(Math.sqrt(n * 1.1)), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i >= k - extra ? 1 : 0));
}
export function layout(style, n, area, seed = 7) {
  const { x, y, w, h } = area, G = 18, rnd = seeded(seed * 7919 + 13);
  if (style === 'moon') {
    const R = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2, k = n - 1;
    if (!k) return [{ x: cx - R * 0.92, y: cy - R * 0.92, w: R * 1.84, h: R * 1.84, round: true }];
    // Satellites on a ring: as large as they can be without touching each other or leaving the area.
    const big = R * (k > 8 ? 0.5 : 0.48), small = Math.min((R - big) / 2 - G / 2, ((R + big) / 2) * Math.sin(Math.PI / Math.max(k, 2)) - G / 2), ring = R - small;
    return [{ x: cx - big, y: cy - big, w: big * 2, h: big * 2, round: true }, ...Array.from({ length: k }, (_, i) => {
      const a = (i / k) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(a) * ring - small, y: cy + Math.sin(a) * ring - small, w: small * 2, h: small * 2, round: true };
    })];
  }
  if (style === 'hero' && n > 1) {
    const rest = n - 1, rows = rest <= 4 ? 1 : 2, top = h * (rows === 1 ? 0.7 : 0.56), rh = (h - top - G * rows) / rows;
    const cells = [{ x, y, w, h: top }];
    for (let r = 0, left = rest; r < rows; r++) {
      const c = r === rows - 1 ? left : Math.floor(rest / rows), cw = (w - G * (c - 1)) / c;
      for (let i = 0; i < c; i++) cells.push({ x: x + i * (cw + G), y: y + top + G + r * (rh + G), w: cw, h: rh });
      left -= c;
    }
    return cells;
  }
  if (style === 'polaroid') {
    const cols = n === 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), cw = w / cols, ch = h / rows, s = Math.min(cw * 0.94, ch * 0.88);
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols;
      const cx = x + (w - inRow * cw) / 2 + (i % cols) * cw + cw / 2 + (rnd() - 0.5) * cw * 0.05, cy = y + r * ch + ch / 2 + (rnd() - 0.5) * ch * 0.04;
      return { x: cx - s / 2, y: cy - (s * 1.1) / 2, w: s, h: s * 1.1, rot: (rnd() - 0.5) * 0.2 };
    });
  }
  const rows = rowsFor(n), weights = rows.map(c => 1 / Math.pow(c, 0.55)), sum = weights.reduce((a, b) => a + b, 0), avail = h - G * (rows.length - 1);
  const cells = [];
  let yy = y;
  rows.forEach((c, r) => {
    const rh = (weights[r] / sum) * avail, shares = Array.from({ length: c }, () => 1 + (c > 1 ? (rnd() - 0.5) * 0.5 : 0)), tot = shares.reduce((a, b) => a + b, 0);
    let xx = x;
    shares.forEach(sh => { const cw = (sh / tot) * (w - G * (c - 1)); cells.push({ x: xx, y: yy, w: cw, h: rh }); xx += cw + G; });
    yy += rh + G;
  });
  return cells;
}

/* ---------------- drawing ---------------- */
/** Fill the box like CSS cover; focus 0 = keep the top, 1 = keep the bottom. */
function cover(c, img, x, y, w, h, focus = 0.4) {
  const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
  c.drawImage(img, (img.width - sw) / 2, (img.height - sh) * focus, sw, sh, x, y, w, h);
}
/** photos: [{ img, focus }], main photo first. */
export async function drawCollage(cv, photos, { style = 'mosaic', theme = 'night', seed = 7, title = '', date = '', org = '', note = '' }) {
  await fontsReady();
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), T = THEMES[theme], dark = theme === 'night';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (dark) { night(c, 0, 0, W, H); stars(c, W, H, 140); } else {
    c.globalAlpha = 0.16;
    for (let i = 0; i < 16; i++) leaf(c, (i * 389) % W, (i * 577) % H, (i * 67) % 360, 1.1 + (i % 3) * 0.5, T.accent);
    c.globalAlpha = 1;
  }
  const area = { x: 50, y: 50, w: W - 100, h: H - FOOT - 80 };
  const cells = layout(style, photos.length, area, seed);
  if (style === 'moon') fullMoonGlow(c, area, dark);
  // The main photo is drawn last where pieces may overlap.
  const order = style === 'polaroid' ? [...cells.keys()].reverse() : [...cells.keys()];
  order.forEach(i => {
    const b = cells[i], { img, focus } = photos[i];
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2); c.rotate(b.rot || 0);
    const x = -b.w / 2, y = -b.h / 2;
    c.shadowColor = 'rgba(0,0,0,.38)'; c.shadowBlur = 26; c.shadowOffsetY = 10;
    c.fillStyle = T.frame;
    if (style === 'polaroid') {
      const p = b.w * 0.05;
      roundRect(c, x, y, b.w, b.h, 8); c.fill(); c.shadowColor = 'transparent';
      c.beginPath(); c.rect(x + p, y + p, b.w - p * 2, b.h - p * 2 - b.w * 0.08); c.clip();
      cover(c, img, x + p, y + p, b.w - p * 2, b.h - p * 2 - b.w * 0.08, focus);
    } else {
      const f = b.round ? 10 : 7, shape = inset => { if (b.round) { c.beginPath(); c.arc(0, 0, b.w / 2 - inset, 0, 7); } else roundRect(c, x + inset, y + inset, b.w - inset * 2, b.h - inset * 2, 22); };
      if (b.round) c.fillStyle = i ? T.frame : T.accent;
      shape(0); c.fill(); c.shadowColor = 'transparent';
      shape(f); c.clip();
      cover(c, img, x, y, b.w, b.h, focus);
    }
    c.restore();
  });

  // bo branches over the top corners, as if looking out from under the tree
  c.globalAlpha = 0.96;
  bough(c, -10, 0, 1.9, { tones: T.leaf, twig: dark ? '#120d1c' : '#4a3320' });
  bough(c, W + 10, 0, 1.9, { flip: true, tones: T.leaf, twig: dark ? '#120d1c' : '#4a3320' });
  c.globalAlpha = 1;

  const fy = H - FOOT;
  c.fillStyle = T.accent; c.fillRect(W / 2 - 250, fy + 8, 500, 4);
  if (dark) fullMoon(c, 130, fy + 130, 56, 130); else lotus(c, 130, fy + 170, 0.9);
  lotus(c, W - 130, fy + 170, 0.9);
  const t = (s, y, o) => fitText(c, s, W / 2, y, { max: W - 480, color: T.ink, lines: 1, ...o });
  t(title, fy + 82, { size: 64, font: SERIF, weight: 700, color: T.accent });
  t(note || date, fy + 136, { size: 36, font: SANS, weight: 500 });
  if (note) t(date, fy + 178, { size: 28, font: SANS });
  t(org, fy + (note ? 236 : 212), { size: note ? 46 : 62, font: SERIF, weight: 700 });
}
function fullMoonGlow(c, a, dark) {
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2, r = Math.min(a.w, a.h) * 0.46, g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
  g.addColorStop(0, dark ? 'rgba(255,233,168,.75)' : 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,233,168,0)');
  c.fillStyle = g; c.fillRect(a.x, a.y, a.w, a.h);
}
