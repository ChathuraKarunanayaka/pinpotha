// Small helpers shared by every screen.

/* ---- safe HTML ---- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(s);
const part = v => v === false || v === null || v === undefined ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : esc(v);
/** Tagged template: interpolations are escaped unless they are html`` / raw(). */
export const html = (st, ...vs) => new Raw(st.reduce((o, s, i) => o + s + (i < vs.length ? part(vs[i]) : ''), ''));

/* ---- ids, money ---- */
export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
export const money = n => {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
export const rs = n => 'රු. ' + money(n);

/* ---- dates (all 'YYYY-MM-DD', local) ---- */
const MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];
const DAYS = ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා'];
const p2 = n => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const utc = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const daysTo = s => Math.round((utc(s) - utc(today())) / 864e5);
export const fmtDate = s => /^\d{4}-\d\d-\d\d/.test(s || '') ? `${MONTHS[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}` : '';
export const fmtDateLong = s => /^\d{4}-\d\d-\d\d/.test(s || '') ? `${s.slice(0, 4)} ${fmtDate(s)} ${DAYS[new Date(utc(s)).getUTCDay()]}` : '';
export const fmtStamp = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const inDays = n => n === 0 ? 'අද' : n === 1 ? 'හෙට' : n > 1 ? `තව දින ${n}යි` : n === -1 ? 'ඊයේ' : `දින ${-n}කට පෙර`;

/* ---- phone numbers ---- */
/** Sri Lankan or international number → digits for wa.me, or '' when unusable. */
export function waNumber(phone) {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '94' + d.slice(1);
  else if (d.length === 9) d = '94' + d;
  d = d.replace(/\D/g, '');
  if (d.startsWith('94') && d[2] === '0') d = '94' + d.slice(3);
  return d.startsWith('94') ? (d.length === 11 ? d : '') : d.length >= 8 && d.length <= 15 ? d : '';
}
export const prettyPhone = phone => {
  const d = waNumber(phone);
  return d.startsWith('94') ? `0${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : phone || '';
};

/** Parse pasted lines like "නිමල් පෙරේරා, 0771234567, කොළඹ" / "Nimal 077-123 4567" into members. */
export function parseMemberLines(text) {
  return String(text || '').split(/\r?\n/).map(line => {
    const l = line.replace(/^\s*\d{1,3}[.)]\s+/, '').trim();
    if (!l) return null;
    const m = /(\+?\d[\d\s-]{7,16}\d)/.exec(l);
    const phone = m && waNumber(m[1]) ? m[1].replace(/[\s-]/g, '') : '';
    const rest = (phone ? l.replace(m[1], '|') : l).split(/[,\t|;]+/).map(s => s.replace(/^[\s\-–:]+|[\s\-–:]+$/g, '')).filter(Boolean);
    return rest[0] ? { name: rest[0], phone, area: rest[1] || '' } : null;
  }).filter(Boolean);
}

export const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
export const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'si');
export const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
