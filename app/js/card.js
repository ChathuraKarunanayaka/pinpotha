// Draws the small thank-you certificate as a PNG, on the phone, with no server.
import { money, fmtDateLong } from './util.js';
import { eventLabel, orgName } from './messages.js';
import { byId, memberName, setting } from './store.js';

const W = 1080, H = 1080;
const SERIF = '"Abhaya Libre", "Noto Serif Sinhala", "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", serif';
const SANS = '"Noto Sans Sinhala", "Sinhala Sangam MN", "Nirmala UI", "Iskoola Pota", sans-serif';
const GOLD = '#f3c85b', IVORY = '#fff8e6', NIGHT = '#16204f';

function petal(c, x, y, len, wid, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(-wid, -len * 0.35, -wid * 0.55, -len * 0.85, 0, -len);
  c.bezierCurveTo(wid * 0.55, -len * 0.85, wid, -len * 0.35, 0, 0);
  c.fill(); c.stroke(); c.restore();
}
function lotus(c, x, y, s) {
  c.lineWidth = 2; c.strokeStyle = '#c9788f';
  [[-1.25, 0.78], [1.25, 0.78], [-0.85, 0.92], [0.85, 0.92], [-0.45, 1], [0.45, 1], [0, 1.06]].forEach(([a, l], i) => {
    const g = c.createLinearGradient(x, y, x, y - 120 * s);
    g.addColorStop(0, i % 2 ? '#f7c3d0' : '#f2b0c1'); g.addColorStop(1, '#fff2f5');
    c.fillStyle = g;
    petal(c, x, y, 118 * s * l, 40 * s, a);
  });
}
/** Wrap on spaces; shrink until the text fits the given lines. */
function text(c, str, y, { size, font, weight = 400, color = IVORY, max = W - 200, lines = 2, gap = 1.35 }) {
  let rows, px = size;
  for (; px > 20; px -= 2) {
    c.font = `${weight} ${px}px ${font}`;
    rows = [];
    let cur = '';
    str.split(/\s+/).forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (c.measureText(t).width > max && cur) { rows.push(cur); cur = w; } else cur = t;
    });
    rows.push(cur);
    if (rows.length <= lines && rows.every(r => c.measureText(r).width <= max)) break;
  }
  c.fillStyle = color;
  rows.forEach((r, i) => c.fillText(r, W / 2, y + i * px * gap));
  return y + rows.length * px * gap;
}

export async function drawCard(donation, { forMember } = {}) {
  // Make sure web fonts are ready, or the first card would use a fallback face.
  if (document.fonts) await Promise.race([
    Promise.all([document.fonts.load('700 60px "Abhaya Libre"', 'ස්තුතියි'), document.fonts.load('400 30px "Noto Sans Sinhala"', 'ස්තුතියි')]).catch(() => {}),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  const ev = byId('events', donation.eventId);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';

  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f1740'); bg.addColorStop(0.55, NIGHT); bg.addColorStop(1, '#2a2f74');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);

  // stars — fixed positions so the card always looks the same
  for (let i = 0; i < 70; i++) { c.globalAlpha = 0.15 + (i % 5) * 0.12; c.fillStyle = '#fff'; c.beginPath(); c.arc((i * 197) % W, (i * 331) % 620, 1 + (i % 3) * 0.7, 0, 7); c.fill(); }
  c.globalAlpha = 1;

  // full moon
  const glow = c.createRadialGradient(W / 2, 215, 60, W / 2, 215, 330);
  glow.addColorStop(0, 'rgba(255,236,170,.55)'); glow.addColorStop(1, 'rgba(255,236,170,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, 560);
  c.fillStyle = '#ffeeb8'; c.beginPath(); c.arc(W / 2, 215, 118, 0, 7); c.fill();
  lotus(c, W / 2, 268, 1);

  // frame
  c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(40, 40, W - 80, H - 80);
  c.lineWidth = 1; c.strokeRect(54, 54, W - 108, H - 108);

  text(c, 'පින් අනුමෝදනාව', 432, { size: 92, font: SERIF, weight: 700, color: GOLD, lines: 1 });
  text(c, 'මෙම පරිත්‍යාගය වෙනුවෙන් අපගේ හෘදයාංගම ස්තුතිය', 492, { size: 34, font: SANS, color: '#cfd6ff', lines: 1 });
  let y = text(c, memberName(forMember || donation.memberId), 600, { size: 96, font: SERIF, weight: 700, lines: 2, gap: 1.15 });
  c.strokeStyle = 'rgba(243,200,91,.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(W / 2 - 170, y - 72); c.lineTo(W / 2 + 170, y - 72); c.stroke();

  const showAmount = setting('cardAmount', '1') === '1';
  const what = donation.kind === 'goods' ? donation.goods : showAmount ? `රු. ${money(donation.amount)}` : '';
  y = text(c, eventLabel(ev), y - 8, { size: 44, font: SANS, weight: 500, lines: 2 });
  if (what) y = text(c, what, y + 16, { size: 62, font: SANS, weight: 700, color: GOLD, lines: 2 });
  text(c, 'මෙම පින්කමෙන් රැස්වන සියලු පින් ඔබටත් ඔබේ පවුලේ සැමටත් අත්වේවා!', Math.max(y - 4, 868), { size: 34, gap: 1.3, font: SANS, color: IVORY, lines: 2 });
  text(c, orgName(), 974, { size: 46, font: SERIF, weight: 700, color: GOLD, lines: 1 });
  text(c, fmtDateLong(donation.date || ev?.date), 1012, { size: 26, font: SANS, color: '#cfd6ff', lines: 1 });

  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { blob, url: URL.createObjectURL(blob), file: new File([blob], 'pin-anumodana.png', { type: 'image/png' }) };
}

export const canShareFiles = file => !!(navigator.canShare && navigator.canShare({ files: [file] }));
export async function shareCard(card) {
  if (canShareFiles(card.file)) {
    try { await navigator.share({ files: [card.file] }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  // Desktop: put the picture on the clipboard so it can be pasted into WhatsApp Web.
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': card.blob })]); return 'copied'; } catch { /* fall through to a download */ }
  const a = document.createElement('a');
  a.href = card.url; a.download = card.file.name; a.click();
  return 'saved';
}
