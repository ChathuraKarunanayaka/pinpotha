// Draws the small thank-you certificate as a PNG, on the phone, with no server.
import { money, fmtDateLong } from './util.js';
import { eventLabel, orgName } from './messages.js';
import { byId, memberName, setting } from './store.js';
import { SERIF, SANS, fontsReady, bough, fullMoon, lotus, stars, night, fitText } from './art.js';

export const CARD_TEXT = 'ඔබටත්, ඔබේ පවුලේ සැමටත්, ඔබ නමින් මියපරලොව ගිය සැම දෙනාටමත් මෙම පින් අනුමෝදන් වේවා! සියලු දෙවිවරුන්ගේ රැකවරණය ලැබේවා!';
export const CARD_VERSE = 'ඉදං මේ ඤාතීනං හෝතු - සුඛිතා හොන්තු ඤාතයෝ';

const W = 1080, H = 1350, GOLD = '#f3c85b', IVORY = '#fff8e6', PALE = '#cfd6ff';

export async function drawCard(donation, { forMember } = {}) {
  await fontsReady();
  const ev = byId('events', donation.eventId);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const t = (s, y, o) => fitText(c, s, W / 2, y, { max: W - 200, color: IVORY, ...o });

  night(c, 0, 0, W, H);
  stars(c, W, 760);
  fullMoon(c, W / 2, 250, 138);
  lotus(c, W / 2, 312, 1.15);
  bough(c, 40, 92, 2.1);
  bough(c, W - 40, 92, 2.1, { flip: true });

  c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(40, 40, W - 80, H - 80);
  c.lineWidth = 1; c.strokeRect(54, 54, W - 108, H - 108);

  t('පින් අනුමෝදනාව', 500, { size: 96, font: SERIF, weight: 700, color: GOLD, lines: 1 });
  t('මෙම පරිත්‍යාගය වෙනුවෙන් අපගේ හෘදයාංගම ස්තුතිය', 562, { size: 34, font: SANS, color: PALE, lines: 1 });
  let y = t(memberName(forMember || donation.memberId), 672, { size: 96, font: SERIF, weight: 700, lines: 2, gap: 1.12 });
  c.strokeStyle = 'rgba(243,200,91,.55)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(W / 2 - 170, y - 66); c.lineTo(W / 2 + 170, y - 66); c.stroke();

  const showAmount = setting('cardAmount', '1') === '1';
  const what = donation.kind === 'goods' ? donation.goods : showAmount ? `රු. ${money(donation.amount)}` : '';
  y = t(eventLabel(ev), y - 2, { size: 44, font: SANS, weight: 500 });
  if (what) y = t(what, y + 18, { size: 64, font: SANS, weight: 700, color: GOLD });
  y = t(setting('cardText', CARD_TEXT), Math.max(y + 10, 930), { size: 37, font: SANS, lines: 4, gap: 1.42 });
  t(setting('cardVerse', CARD_VERSE), Math.max(y + 12, 1120), { size: 44, font: SERIF, weight: 700, color: GOLD, lines: 2 });
  t(orgName(), 1226, { size: 54, font: SERIF, weight: 700, color: GOLD, lines: 1 });
  t(fmtDateLong(donation.date || ev?.date), 1272, { size: 27, font: SANS, color: PALE, lines: 1 });

  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { url: URL.createObjectURL(blob), file: new File([blob], 'pin-anumodana.png', { type: 'image/png' }) };
}
