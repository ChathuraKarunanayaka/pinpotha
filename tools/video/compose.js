// Runs inside the browser: paints one video frame for time t.
import { SERIF, SANS, night, stars, fullMoon, bough, lotus, roundRect, wrap, fitText } from '/js/art.js';

const W = 1080, H = 1920, VW = 390, VH = 780;
// Phone: bezel box, then the screen inside it.
const P = { x: 155, y: 372, w: 770, h: 1512 }, SC = { x: P.x + 18, y: P.y + 52, w: P.w - 36 };
SC.k = SC.w / VW; SC.h = VH * SC.k;
const GOLD = '#f3c85b';
const cv = document.createElement('canvas');
cv.width = W; cv.height = H;
const c = cv.getContext('2d', { alpha: false });

let T, imgs = {}, starts = [], total = 0, bg, totalSec;
export async function init() {
  T = await (await fetch('/shots/timeline.json')).json();
  await Promise.all(['700 60px "Abhaya Libre"', '800 60px "Abhaya Libre"', '400 30px "Noto Sans Sinhala"', '500 30px "Noto Sans Sinhala"', '600 30px "Noto Sans Sinhala"', '700 30px "Noto Sans Sinhala"'].map(f => document.fonts.load(f, 'දනට පින්')));
  for (const s of T) { starts.push(total); total += s.dur; }
  totalSec = Math.max(...T.map(s => s.sec || 0));
  bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const b = bg.getContext('2d');
  night(b, 0, 0, W, H); stars(b, W, H, 160);
  bough(b, -30, 0, 1.5); bough(b, W + 30, 0, 1.5, { flip: true });
  return total;
}
async function img(name) {
  if (!imgs[name]) {
    const i = new Image(); i.src = '/shots/' + name; await i.decode();
    const keys = Object.keys(imgs); if (keys.length > 24) delete imgs[keys[0]];
    imgs[name] = i;
  }
  return imgs[name];
}
const ease = k => (k < 0 ? 0 : k > 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function phone() {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 60; c.shadowOffsetY = 20;
  roundRect(c, P.x, P.y, P.w, P.h, 74); c.fillStyle = '#05070f'; c.fill();
  c.restore();
  roundRect(c, P.x + 3, P.y + 3, P.w - 6, P.h - 6, 71); c.strokeStyle = '#4a5486'; c.lineWidth = 4; c.stroke();
  roundRect(c, W / 2 - 70, P.y + 18, 140, 18, 9); c.fillStyle = '#1d2340'; c.fill();
}
function clipScreen() { roundRect(c, SC.x, SC.y, SC.w, P.y + P.h - 18 - SC.y, 40); c.clip(); }

/** The chat that opens — a plain illustration, labelled as such, with the real message text. */
function chat(s, t) {
  c.fillStyle = '#e9e4da'; c.fillRect(SC.x, SC.y, SC.w, SC.h);
  c.fillStyle = '#0a7a46'; c.fillRect(SC.x, SC.y, SC.w, 130);
  c.fillStyle = '#ffffff33'; c.beginPath(); c.arc(SC.x + 80, SC.y + 65, 40, 0, 7); c.fill();
  c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `600 36px ${SANS}`; c.fillText(s.to, SC.x + 140, SC.y + 62);
  c.font = `400 24px ${SANS}`; c.fillText('WhatsApp (උදාහරණ රූපයක්)', SC.x + 140, SC.y + 102);
  c.font = `400 29px ${SANS}`;
  const rows = s.msg.split('\n').flatMap(l => (l ? wrap(c, l, SC.w - 190) : ['']));
  const h = rows.length * 44 + 50, y = SC.y + 190;
  c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 12; roundRect(c, SC.x + 80, y, SC.w - 110, h, 24); c.fillStyle = '#dcf7cf'; c.fill(); c.restore();
  c.fillStyle = '#15251b';
  rows.forEach((r, i) => c.fillText(r, SC.x + 110, y + 54 + i * 44));
  const by = SC.y + SC.h - 150;
  roundRect(c, SC.x + 24, by, SC.w - 160, 96, 48); c.fillStyle = '#fff'; c.fill();
  c.fillStyle = '#8a8f99'; c.font = `400 28px ${SANS}`; c.fillText('පණිවිඩය සූදානම්', SC.x + 64, by + 60);
  const pulse = 1 + Math.sin(t * 5) * 0.06;
  c.fillStyle = '#0a7a46'; c.beginPath(); c.arc(SC.x + SC.w - 72, by + 48, 52 * pulse, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(SC.x + SC.w - 92, by + 22); c.lineTo(SC.x + SC.w - 44, by + 48); c.lineTo(SC.x + SC.w - 92, by + 74); c.lineTo(SC.x + SC.w - 84, by + 48); c.closePath(); c.fill();
  hand(SC.x + SC.w - 72, by + 48, t, s.dur - 1.1);
}
function hand(x, y, t, at) {
  // slides in, presses at time `at`, sends out a ring
  const k = ease((t - (at - 0.7)) / 0.6);
  if (k <= 0) return;
  const press = t > at ? Math.max(0, 1 - Math.abs(t - at - 0.12) / 0.16) : 0;
  if (t > at) { const r = (t - at) / 0.5; if (r < 1) { c.globalAlpha = 1 - r; c.strokeStyle = '#ffb020'; c.lineWidth = 9; c.beginPath(); c.arc(x, y, 26 + r * 80, 0, 7); c.stroke(); c.globalAlpha = 1; } }
  const hx = x + (1 - k) * 160, hy = y + (1 - k) * 260, s = 1.55 - press * 0.16;
  c.save(); c.globalAlpha = Math.min(1, k * 1.5); c.translate(hx, hy); c.scale(s, s); c.rotate(-0.28);
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 14; c.shadowOffsetY = 5;
  const p = new Path2D('M-9 4a9 9 0 0 1 18 0v34l24 6c9 2 14 9 13 18l-4 30c-1 8-7 13-15 13H4c-6 0-11-3-14-8L-31 66c-4-7 4-15 11-10l11 9Z');
  c.fillStyle = '#fff'; c.fill(p); c.shadowColor = 'transparent'; c.strokeStyle = '#1d2340'; c.lineWidth = 3.2; c.lineJoin = 'round'; c.stroke(p);
  c.restore();
}
function caption(s, alpha) {
  c.save(); c.globalAlpha = alpha;
  const chip = `${s.sec}. ${s.title}`;
  c.font = `700 34px ${SANS}`;
  const extra = s.admin ? '  ප්‍රධාන අයට පමණයි' : '', w1 = c.measureText(chip).width + 56;
  c.font = `600 26px ${SANS}`;
  const w2 = extra ? c.measureText(extra.trim()).width + 44 : 0, x = (W - w1 - (w2 ? w2 + 14 : 0)) / 2;
  roundRect(c, x, 62, w1, 62, 31); c.fillStyle = GOLD; c.fill();
  c.fillStyle = '#1b1500'; c.font = `700 34px ${SANS}`; c.textAlign = 'left'; c.fillText(chip, x + 28, 104);
  if (w2) { roundRect(c, x + w1 + 14, 66, w2, 54, 27); c.strokeStyle = GOLD; c.lineWidth = 3; c.stroke(); c.fillStyle = GOLD; c.font = `600 26px ${SANS}`; c.fillText(extra.trim(), x + w1 + 36, 102); }
  let px = 48, rows;
  do { c.font = `600 ${px}px ${SANS}`; rows = wrap(c, s.cap || '', W - 130); px -= 2; } while (rows.length > 3 && px > 30);
  px += 2;
  c.textAlign = 'center'; c.fillStyle = '#fff';
  const lh = px * 1.36, y0 = 240 - ((rows.length - 1) * lh) / 2 + px * 0.3;
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 12;
  rows.forEach((r, i) => c.fillText(r, W / 2, y0 + i * lh));
  c.restore();
}
function progress(t) {
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(0, H - 12, W, 12);
  c.fillStyle = GOLD; c.fillRect(0, H - 12, (W * t) / total, 12);
}
function intro(t, d) {
  const a = ease(t / 0.9) * ease((d - t) / 0.5);
  c.save(); c.globalAlpha = a;
  fullMoon(c, W / 2, 620, 250); bough(c, W / 2 - 330, 380, 3.2); lotus(c, W / 2, 800, 1.5);
  fitText(c, 'දනට පින් ඇත්තෝ', W / 2, 1090, { size: 130, font: SERIF, weight: 800, color: GOLD, max: W - 120, lines: 1 });
  fitText(c, 'App එක භාවිතා කරන හැටි', W / 2, 1220, { size: 66, font: SANS, weight: 600, color: '#fff', max: W - 120, lines: 1 });
  fitText(c, 'පියවරෙන් පියවර, හැමෝටම තේරෙන විදිහට', W / 2, 1310, { size: 42, font: SANS, color: '#cfd6ff', max: W - 120, lines: 2 });
  fitText(c, 'මෙහි ඇති නම්, මුදල් සහ ඡායාරූප උදාහරණ පමණි', W / 2, 1760, { size: 32, font: SANS, color: '#aeb8ea', max: W - 120, lines: 2 });
  c.restore();
}
function outro(t, d) {
  const a = ease(t / 0.8) * ease((d - t) / 0.8);
  c.save(); c.globalAlpha = a;
  fullMoon(c, W / 2, 560, 210); bough(c, W / 2 - 290, 350, 2.8); lotus(c, W / 2, 720, 1.3);
  fitText(c, 'සටහන් කරන්න • ස්තුති කරන්න • බෙදා දෙන්න', W / 2, 1000, { size: 54, font: SANS, weight: 600, color: '#fff', max: W - 140, lines: 2 });
  fitText(c, 'ගැටලුවක් ඇත්නම් app එකේ “උදව්” බලන්න', W / 2, 1150, { size: 44, font: SANS, color: '#cfd6ff', max: W - 140, lines: 2 });
  fitText(c, 'ඔබ සැමට පින් සිදු වේවා!', W / 2, 1380, { size: 84, font: SERIF, weight: 800, color: GOLD, max: W - 120, lines: 1 });
  fitText(c, 'දනට පින් ඇත්තෝ', W / 2, 1500, { size: 60, font: SERIF, weight: 700, color: '#fff', max: W - 120, lines: 1 });
  c.restore();
}
async function screenOf(s, t) {
  c.save(); clipScreen();
  if (s.kind === 'chat') chat(s, t);
  else if (s.img) c.drawImage(await img(s.img), SC.x, SC.y, SC.w, SC.h);
  c.fillStyle = '#fff'; c.fillRect(SC.x, SC.y + SC.h, SC.w, 60);
  c.restore();
}

export async function frame(t) {
  let i = starts.length - 1;
  while (i > 0 && starts[i] > t) i--;
  const s = T[i], lt = t - starts[i], prev = T[i - 1];
  c.drawImage(bg, 0, 0);
  if (s.kind === 'intro') intro(lt, s.dur);
  else if (s.kind === 'outro') outro(lt, s.dur);
  else if (s.kind === 'title') {
    phone();
    // the next section's first screen waits dimmed behind its title
    const nx = T[i + 1];
    await screenOf(nx, 0);
    c.save(); clipScreen(); c.globalAlpha = 0.82; c.fillStyle = '#0f1740'; c.fillRect(SC.x, SC.y, SC.w, SC.h + 80); c.restore();
    const k = ease(lt / 0.45) * ease((s.dur - lt) / 0.3);
    c.save(); c.globalAlpha = k;
    fullMoon(c, W / 2, 900, 105, 260);
    c.fillStyle = '#1b1500'; c.textAlign = 'center'; c.font = `700 110px ${SANS}`; c.fillText(s.sec, W / 2, 940);
    fitText(c, s.title, W / 2, 1150, { size: 88, font: SERIF, weight: 800, color: '#fff', max: 640, lines: 3, gap: 1.2 });
    if (s.admin) fitText(c, 'ප්‍රධාන අයට පමණයි', W / 2, 1420, { size: 40, font: SANS, weight: 600, color: GOLD, max: 600, lines: 1 });
    c.restore();
    c.save(); c.globalAlpha = k; c.textAlign = 'center'; c.fillStyle = '#cfd6ff'; c.font = `500 36px ${SANS}`; c.fillText(`${s.sec} / ${totalSec}`, W / 2, 230); c.restore();
  } else {
    phone();
    await screenOf(s, lt);
    // soft cross-fade from the previous screen
    if (!s.cut && prev && (prev.img || prev.kind === 'chat') && lt < 0.26) { c.save(); c.globalAlpha = 1 - ease(lt / 0.26); await screenOf(prev, prev.dur); c.restore(); }
    if (s.rect) {
      const r = s.rect, pad = 7, x = SC.x + (r.x - pad) * SC.k, y = SC.y + (r.y - pad) * SC.k, w = (r.w + pad * 2) * SC.k, h = (r.h + pad * 2) * SC.k;
      const at = Math.max(0.55, s.dur - 0.45), a = s.dur < 0.6 ? 1 : ease(lt / 0.35);
      c.save(); clipScreen(); c.globalAlpha = a; roundRect(c, x, y, w, h, Math.min(26, h / 2)); c.lineWidth = 8 + Math.sin(lt * 6) * 2; c.strokeStyle = '#ff9f1a'; c.shadowColor = '#ffb84d'; c.shadowBlur = 22; c.stroke(); c.restore();
      hand(SC.x + Math.min(r.x + r.w / 2, VW - 30) * SC.k, SC.y + (r.y + r.h / 2) * SC.k, s.dur < 0.6 ? 1 + lt : lt, s.dur < 0.6 ? 1.05 : at);
    }
    const fresh = !prev || prev.cap !== s.cap || prev.kind === 'title';
    caption(s, fresh ? ease(lt / 0.3) : 1);
  }
  progress(t);
  return cv;
}

/** Render frames [from, to) and post each as a JPEG, in order. */
export async function render(from, to, fps) {
  for (let f = from; f < to; f++) {
    const el = await frame(f / fps);
    const blob = await new Promise(r => el.toBlob(r, 'image/jpeg', 0.93));
    await fetch('/frame', { method: 'POST', body: blob });
  }
}
