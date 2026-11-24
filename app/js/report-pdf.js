// Lays out the colour Sinhala report on A4 canvases and packs them into a PDF.
import { S, all, userName } from './store.js';
import { money, rs, fmtDateLong, fmtDate, today } from './util.js';
import { eventStats, fundLedger, parcelTotals, plannedParcels, areaCounts, reportRows } from './calc.js';
import { eventLabel, orgName } from './messages.js';
import { SERIF, SANS, fontsReady, night, stars, fullMoon, bough, leaf, lotus, roundRect, wrap, fitText } from './art.js';
import { imagesToPdf } from './pdf.js';

const W = 1240, H = 1754, SCALE = 1.5, M = 70, IN = W - M * 2, BOTTOM = H - 110;
const C = { night: '#16204f', gold: '#f3c85b', goldD: '#8a5a00', ink: '#171c33', mut: '#596080', line: '#dfe3f0', zebra: '#f5f7fd', green: '#0b6b4a', red: '#a5321f', blue: '#2a347c', pink: '#a8345c' };
const ANON = 'නම සඳහන් නොකරන පින්වතෙක්';

class Doc {
  constructor(ev) { this.ev = ev; this.pages = []; this.newPage(true); }
  newPage(first) {
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const c = cv.getContext('2d');
    c.scale(SCALE, SCALE);
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    this.c = c; this.pages.push(cv);
    first ? this.cover() : this.runningHead();
  }
  cover() {
    const { c, ev } = this, h = 400;
    c.save(); c.beginPath(); c.rect(0, 0, W, h); c.clip();
    night(c, 0, 0, W, h); stars(c, W, h, 60);
    fullMoon(c, 165, 190, 105, 300);
    bough(c, 78, 62, 1.45);
    bough(c, W + 40, 34, 1.45, { flip: true });
    c.restore();
    c.fillStyle = C.gold; c.fillRect(0, h, W, 8);
    const mid = 665, max = 600;
    fitText(c, orgName(), mid, 112, { size: 78, font: SERIF, weight: 700, color: C.gold, max, lines: 1 });
    let y = fitText(c, eventLabel(ev), mid, 190, { size: 50, font: SERIF, weight: 700, color: '#fff', max, lines: 2, gap: 1.15 });
    fitText(c, fmtDateLong(ev.date), mid, y + 4, { size: 30, font: SANS, color: '#dbe1ff', max, lines: 1 });
    fitText(c, 'පරිත්‍යාග සහ ගිණුම් වාර්තාව', mid, 350, { size: 32, font: SANS, weight: 600, color: C.gold, max, lines: 1 });
    this.y = h + 44;
  }
  runningHead() {
    const { c } = this;
    c.fillStyle = C.night; c.fillRect(0, 0, W, 70);
    c.fillStyle = C.gold; c.fillRect(0, 70, W, 5);
    c.font = `700 32px ${SERIF}`; c.textAlign = 'left'; c.fillText(orgName(), M, 47);
    c.font = `400 24px ${SANS}`; c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(`${eventLabel(this.ev)} — ${this.ev.date.slice(0, 4)} ${fmtDate(this.ev.date)}`, W - M, 45);
    this.y = 120;
  }
  room(h) { if (this.y + h > BOTTOM) { this.newPage(); return true; } return false; }

  heading(text, color = C.night, need = 170) {
    this.room(need);
    const { c } = this;
    leaf(c, M + 20, this.y + 2, 18, 0.5, color, 'rgba(255,255,255,.6)');
    c.font = `700 42px ${SERIF}`; c.fillStyle = color; c.textAlign = 'left';
    c.fillText(text, M + 54, this.y + 38);
    c.fillStyle = C.gold; c.fillRect(M, this.y + 58, IN, 3);
    this.y += 78;
  }
  tiles(list) {
    const { c } = this, n = 3, gap = 18, w = (IN - gap * (n - 1)) / n, h = 112;
    list.forEach(([label, value, color], i) => {
      const x = M + (i % n) * (w + gap), y = this.y + Math.floor(i / n) * (h + gap);
      roundRect(c, x, y, w, h, 16); c.fillStyle = color + '14'; c.fill();
      c.fillStyle = color; c.fillRect(x, y + 14, 7, h - 28);
      c.textAlign = 'left'; c.fillStyle = C.mut; c.font = `500 24px ${SANS}`; c.fillText(label, x + 24, y + 42);
      let px = 38; do { c.font = `700 ${px}px ${SANS}`; px -= 2; } while (c.measureText(value).width > w - 40 && px > 18);
      c.fillStyle = color; c.fillText(value, x + 24, y + 90);
    });
    this.y += Math.ceil(list.length / n) * (h + gap) + 24;
  }
  /** cols: [{ t, w, right?, bold? }] (w = share of the width); rows: [[text, ...]]; total: [text, ...] */
  table(cols, rows, { color = C.night, total } = {}) {
    const PX = 26, LH = 37, PAD = 14;
    const sum = cols.reduce((s, k) => s + k.w, 0), ws = cols.map(k => (k.w / sum) * IN);
    const xs = ws.map((_, i) => M + ws.slice(0, i).reduce((s, w) => s + w, 0));
    const font = (b = 400, px = PX) => `${b} ${px}px ${SANS}`;
    const cell = (txts, i, y, color2) => {
      const c = this.c; // a row may have opened a new page
      c.fillStyle = color2; c.textAlign = cols[i].right ? 'right' : 'left';
      txts.forEach((t, k) => c.fillText(t, cols[i].right ? xs[i] + ws[i] - 14 : xs[i] + 14, y + PAD + 27 + k * LH));
    };
    const head = () => {
      this.c.font = font(600, 24);
      const lines = cols.map((k, i) => wrap(this.c, k.t, ws[i] - 24)), h = Math.max(...lines.map(l => l.length)) * LH + PAD * 2 - 8;
      roundRect(this.c, M, this.y, IN, h, 12); this.c.fillStyle = color; this.c.fill();
      lines.forEach((l, i) => cell(l, i, this.y - 3, '#fff'));
      this.y += h;
    };
    const line = (r, n, bold) => {
      const lines = r.map((t, i) => { this.c.font = font(bold || cols[i].bold ? 700 : 400); return wrap(this.c, t, ws[i] - 24); });
      const h = Math.max(...lines.map(l => l.length)) * LH + PAD * 2 - 6;
      if (this.room(h)) { head(); }
      const k = this.c;
      if (bold) { k.fillStyle = C.gold + '55'; k.fillRect(M, this.y, IN, h); } else if (n % 2) { k.fillStyle = C.zebra; k.fillRect(M, this.y, IN, h); }
      k.fillStyle = bold ? color : C.line; k.fillRect(M, this.y + h - (bold ? 3 : 1), IN, bold ? 3 : 1);
      lines.forEach((l, i) => { k.font = font(bold || cols[i].bold ? 700 : 400); cell(l, i, this.y, bold ? color : C.ink); });
      this.y += h;
    };
    head();
    rows.forEach((r, n) => line(r, n));
    if (total) line(total, 0, true);
    this.y += 44;
  }
  para(text, { size = 28, color = C.ink, weight = 400 } = {}) {
    this.c.font = `${weight} ${size}px ${SANS}`;
    const rows = wrap(this.c, text, IN);
    this.room(rows.length * size * 1.5);
    this.c.textAlign = 'left';
    rows.forEach(r => { this.c.font = `${weight} ${size}px ${SANS}`; this.c.fillStyle = color; this.c.fillText(r, M, this.y + size); this.y += size * 1.5; });
  }
  blessing() {
    if (this.y + 220 > BOTTOM) return; // never open a page just for this
    const c = this.c, h = 220;
    roundRect(c, M, this.y, IN, h, 22); c.save(); c.clip(); night(c, M, this.y, IN, h); c.restore();
    lotus(c, W / 2, this.y + 86, 0.6);
    fitText(c, 'දායක වූ සියලු පින්වතුන්ට පින් සිදු වේවා! තෙරුවන් සරණයි!', W / 2, this.y + 138, { size: 36, font: SERIF, weight: 700, color: C.gold, max: IN - 80, lines: 1 });
    fitText(c, orgName(), W / 2, this.y + 190, { size: 30, font: SANS, color: '#dbe1ff', max: IN - 80, lines: 1 });
    this.y += h;
  }
  footers() {
    this.pages.forEach((cv, i) => {
      const c = cv.getContext('2d');
      c.fillStyle = C.line; c.fillRect(M, H - 80, IN, 2);
      c.font = `400 22px ${SANS}`; c.fillStyle = C.mut;
      c.textAlign = 'left'; c.fillText(`සකස් කළ දිනය: ${today().slice(0, 4)} ${fmtDate(today())}`, M, H - 44);
      c.textAlign = 'right'; c.fillText(`පිටුව ${i + 1} / ${this.pages.length}`, W - M, H - 44);
    });
  }
}

/** Sort orders offered to the user. */
export const SORTS = {
  name: ['නම අනුව', () => 0],
  collector: ['එකතු කළ අය අනුව', (a, b) => userName(a.d.collectorId).localeCompare(userName(b.d.collectorId), 'si')],
  area: ['ගම අනුව', (a, b) => String(a.m.area || 'ෆෆ').localeCompare(String(b.m.area || 'ෆෆ'), 'si')],
  amount: ['මුදල අනුව', (a, b) => Number(b.d.amount) - Number(a.d.amount)],
};
/** Optional sections. */
export const PARTS = { accounts: 'ගිණුම් සාරාංශය', expenses: 'වියදම් ලැයිස්තුව', areas: 'පවුල් ගණන (ගම් අනුව)' };

export async function buildReport(ev, { sort = 'name', parts = Object.keys(PARTS) } = {}) {
  await fontsReady();
  const rows = reportRows(S.db, ev.id);
  const cash = rows.filter(r => r.d.kind !== 'goods').sort(SORTS[sort][1]), goods = rows.filter(r => r.d.kind === 'goods');
  const st = eventStats(S.db, ev.id), led = fundLedger(S.db, ev.fund).find(r => r.event.id === ev.id);
  const n = plannedParcels(S.db, ev), par = parcelTotals(S.db, ev.id, n);
  const exps = all('expenses').filter(x => x.eventId === ev.id), areas = areaCounts(S.db, ev.id);
  const name = r => (r.m.anon ? ANON : r.m.name), gama = r => (r.m.anon ? '—' : r.m.area || '—');
  const doc = new Doc(ev);

  doc.tiles([
    ['එකතු වූ මුළු මුදල', rs(st.total), C.green], ['දායක වූ පින්වතුන්', `${st.donors.size}`, C.blue],
    ...(n ? [['බඩු මලු ගණන', `${n}`, C.goldD]] : []), ...(par.perParcel ? [['එක මල්ලක වටිනාකම', rs(par.perParcel), C.goldD]] : []),
    ...(goods.length ? [['ද්‍රව්‍ය ආධාර', `${goods.length}`, C.pink]] : []), ['වියදම', rs(st.spent), C.red],
  ]);

  doc.heading('මුදල් පරිත්‍යාග');
  if (cash.length) doc.table(
    [{ t: '#', w: 6 }, { t: 'නම', w: 33, bold: true }, { t: 'ගම', w: 20 }, { t: 'මුදල (රු.)', w: 18, right: true, bold: true }, { t: 'එකතු කළ අය', w: 21 }],
    cash.map((r, i) => [`${i + 1}`, name(r), gama(r), money(r.d.amount), userName(r.d.collectorId)]),
    { total: ['', 'එකතු වූ මුළු මුදල', '', money(st.total), ''] });
  else { doc.para('මුදල් පරිත්‍යාග නැත.', { color: C.mut }); doc.y += 30; }

  if (goods.length) {
    doc.heading('ද්‍රව්‍ය ආධාර ලබා දුන් අය', C.pink);
    doc.table([{ t: '#', w: 6 }, { t: 'නම', w: 30, bold: true }, { t: 'ගම', w: 18 }, { t: 'ද්‍රව්‍ය', w: 25 }, { t: 'එකතු කළ අය', w: 19 }],
      goods.map((r, i) => [`${i + 1}`, name(r), gama(r), r.d.goods, userName(r.d.collectorId)]), { color: C.pink });
  }

  if (n || par.items.length) {
    doc.heading(`බඩු මලු${n ? ` — ${n}ක්` : ''}`, C.goldD);
    if (par.items.length) doc.table([{ t: 'අන්තර්ගතය', w: 34, bold: true }, { t: 'එක මල්ලකට', w: 20 }, { t: 'ඒකක මිල (රු.)', w: 22, right: true }, { t: 'මල්ලකට වටිනාකම (රු.)', w: 24, right: true }],
      par.items.map(({ item }) => [item.name, `${item.qty} ${item.unit || ''}`, item.price ? money(item.price) : '—', item.price ? money(Number(item.qty) * Number(item.price)) : '—']),
      { color: C.goldD, total: ['එක මල්ලක වටිනාකම', '', '', money(par.perParcel)] });
    if (n && par.total) { doc.y -= 24; doc.para(`මලු ${n} × ${rs(par.perParcel)} = ${rs(par.total)}`, { weight: 700, color: C.goldD, size: 30 }); doc.y += 34; }
  }
  if (parts.includes('areas') && areas.length) {
    doc.heading('බඩු මලු පිරිනැමූ පවුල්', C.green);
    doc.table([{ t: 'ගම / ප්‍රදේශය', w: 70, bold: true }, { t: 'පවුල් ගණන', w: 30, right: true }], areas.map(([a, k]) => [a, `${k}`]), { color: C.green, total: ['එකතුව', `${areas.reduce((s, x) => s + x[1], 0)}`] });
  }
  if (parts.includes('expenses') && exps.length) {
    doc.heading('වියදම්', C.red);
    doc.table([{ t: 'විස්තරය', w: 50, bold: true }, { t: 'වර්ගය', w: 26 }, { t: 'මුදල (රු.)', w: 24, right: true }], exps.map(x => [x.title, x.category || '', money(x.amount)]), { color: C.red, total: ['මුළු වියදම', '', money(st.spent)] });
  }
  if (parts.includes('accounts')) {
    doc.heading('ගිණුම් සාරාංශය', C.blue, 420);
    doc.table([{ t: 'විස්තරය', w: 70 }, { t: 'රු.', w: 30, right: true, bold: true }],
      [['පෙර ශේෂය', money(led.brought)], ...(led.transfer ? [['අරමුදල් මාරු', money(led.transfer)]] : []), ['+ එකතු වූ මුදල', money(led.income)], ['− වියදම', money(led.spent)]],
      { color: C.blue, total: ['ඉදිරියට ගෙන යන ඉතිරිය', money(led.balance)] });
  }
  doc.blessing();
  doc.footers();

  const pages = [], previews = [];
  for (const cv of doc.pages) {
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
    previews.push(URL.createObjectURL(blob));
    cv.width = cv.height = 0; // give the memory back straight away (older phones)
  }
  const bytes = imagesToPdf(pages, `${orgName()} — ${eventLabel(ev)} ${ev.date}`);
  return { file: new File([bytes], `Danata-Pin-Aththo-${ev.date}.pdf`, { type: 'application/pdf' }), previews };
}
