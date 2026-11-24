// Sinhala message wording and the WhatsApp / share plumbing.
import { S, setting, memberName, byId, put, all, isDemo } from './store.js';
import { money, fmtDate, daysTo, waNumber, inDays } from './util.js';
import { eventStats, fundLedger, areaCounts, plannedParcels } from './calc.js';

/** Editable in Settings. {placeholders} are filled in fill(). */
export const TEMPLATES = {
  thanks: ['ස්තුති පණිවිඩය', `තෙරුවන් සරණයි {නම},

{පින්කම} වෙනුවෙන් ඔබ පරිත්‍යාග කළ රු. {මුදල} අප වෙත ලැබුණු බව ඉතා කෘතඥතාවෙන් දන්වා සිටිමු. 🙏

මෙම පින්කමෙන් රැස්වන සියලු පින් ඔබටත් ඔබේ පවුලේ සැමටත් අත්වේවා! සාදු! සාදු! සාදු!

— {සංසදය}`],
  thanksGoods: ['ස්තුති පණිවිඩය (භාණ්ඩ)', `තෙරුවන් සරණයි {නම},

{පින්කම} වෙනුවෙන් ඔබ පරිත්‍යාග කළ {භාණ්ඩය} අප වෙත ලැබුණු බව ඉතා කෘතඥතාවෙන් දන්වා සිටිමු. 🙏

මෙම පින්කමෙන් රැස්වන සියලු පින් ඔබටත් ඔබේ පවුලේ සැමටත් අත්වේවා! සාදු! සාදු! සාදු!

— {සංසදය}`],
  remind: ['මතක් කිරීමේ පණිවිඩය', `තෙරුවන් සරණයි {නම},

{දිනය} දිනට යෙදෙන {පින්කම} සඳහා {ඉතිරි}. 🌕

අඩු ආදායම්ලාභී පවුල් සඳහා බඩු මලු පිරිනැමීමේ මෙම පින්කමට ඔබටත් කැමති පරිදි දායක විය හැකියි. සහභාගී වීමට කැමති නම් අප දැනුවත් කරන්න.

පින් සිදු වේවා! 🙏
— {සංසදය}`],
  remindGroup: ['Group එකට මතක් කිරීම', `🌕 *{පින්කම}* 🌕

තෙරුවන් සරණයි සැමට,
{දිනය} දිනට යෙදෙන අපේ පින්කමට {ඉතිරි}. කැමති පරිදි දායක වන්න. මුදල් භාර දිය හැක්කේ:
{එකතුකරන්නන්}

පින් සිදු වේවා! 🙏
— {සංසදය}`],
  pledge: ['පොරොන්දුව මතක් කිරීම', `තෙරුවන් සරණයි {නම},

{පින්කම} වෙනුවෙන් ඔබ පොරොන්දු වූ රු. {මුදල} පිළිබඳව කාරුණිකව මතක් කරමු. ඔබට පහසු වෙලාවක ලබා දෙන්න.

පින් සිදු වේවා! 🙏
— {සංසදය}`],
  behalfAsk: ['වෙනුවෙන් ගෙවූ බව (ඉල්ලූ අයට)', `තෙරුවන් සරණයි {නම},

{පින්කම} වෙනුවෙන් ඔබ නමින් රු. {මුදල} ක මුදලක් {ගෙවූකෙනා} විසින් යොදවා ඇත. ඔබේ පරිත්‍යාගයට බොහොම පින්! 🙏

කරුණාකර එම මුදල මතක් කර {ගෙවූකෙනා} වෙත ලබා දෙන්න.

— {සංසදය}`],
  behalfPay: ['වෙනුවෙන් ගෙවූ බව (ගෙවූ අයට)', `තෙරුවන් සරණයි {නම},

{පින්කම} වෙනුවෙන් {ඉල්ලූකෙනා} නමින් ඔබ රු. {මුදල} ක මුදලක් යෙදවීම ගැන බොහොම පින්! 🙏

කරුණාකර එම මුදල {ඉල්ලූකෙනා} වෙතින් ලබා ගන්න. ඔවුන්ටත් ඒ බව දන්වා ඇත.

— {සංසදය}`],
  behalfRemind: ['පියවීම මතක් කිරීම', `තෙරුවන් සරණයි {නම},

{පින්කම} දිනයේ ඔබ නමින් {ගෙවූකෙනා} යෙදවූ රු. {මුදල} තවම පියවා නැති බව කාරුණිකව මතක් කරමු. ඔබට පහසු වෙලාවක {ගෙවූකෙනා} වෙත ලබා දෙන්න. 🙏

— {සංසදය}`],
};
export const template = k => setting('tpl_' + k) || TEMPLATES[k][1];
export const orgName = () => setting('orgName', 'අප මිත්‍ර සංසදය');
export const eventLabel = ev => !ev ? 'පින්කම' : ev.type === 'poya' ? `${ev.title} පින්කම` : ev.title;

export function fill(tpl, vars) {
  return tpl.replace(/\{([^{}]+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}
function vars(ev, extra) {
  const d = ev ? daysTo(ev.date) : 0;
  return { පින්කම: eventLabel(ev), දිනය: fmtDate(ev?.date), ඉතිරි: d > 1 ? `තව දින ${d}යි` : d >= 0 ? inDays(d) : '', සංසදය: orgName(), ...extra };
}

/** Build the text for one message to one member. */
export function compose(kind, { eventId, memberId, donation, amount }) {
  const ev = byId('events', eventId);
  const d = donation || {};
  const key = kind === 'thanks' && d.kind === 'goods' ? 'thanksGoods' : kind;
  return fill(template(key), vars(ev, {
    නම: memberName(memberId),
    මුදල: money(amount ?? d.amount),
    භාණ්ඩය: d.goods || '',
    ගෙවූකෙනා: d.payerId ? memberName(d.payerId) : '',
    ඉල්ලූකෙනා: d.memberId ? memberName(d.memberId) : '',
  }));
}

/* ---- sent log ---- */
// A fixed id per (kind, subject, person) so the same message marked on two phones stays one record.
export const msgId = (kind, refId, memberId) => `m-${kind}-${refId}-${memberId}`.slice(0, 80).replace(/[^\w.-]/g, '_');
export const wasSent = (kind, refId, memberId) => { const m = byId('messages', msgId(kind, refId, memberId)); return m && !m.deleted ? m : null; };
export const markSent = (kind, refId, memberId, eventId) => put('messages', msgId(kind, refId, memberId), { kind, refId, memberId, eventId, at: new Date().toISOString(), deleted: false });
export const unmarkSent = (kind, refId, memberId) => put('messages', msgId(kind, refId, memberId), { deleted: true });

/** All thank-you style messages a donation still needs. */
export function pendingFor(d) {
  if (d.deleted) return [];
  const want = d.payerId ? [['behalfAsk', d.memberId], ['behalfPay', d.payerId]] : [['thanks', d.memberId]];
  return want.filter(([k, m]) => !wasSent(k, d.id, m)).map(([kind, memberId]) => ({ kind, memberId, donation: d, eventId: d.eventId }));
}

/* ---- sending ---- */
export const canWhatsApp = memberId => !!waNumber(byId('members', memberId)?.phone);
export function openWhatsApp(phone, text) {
  const n = isDemo() ? '' : waNumber(phone); // the demo must never message a real number
  // Must run directly inside the tap, or phones block the pop-up.
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.style.cssText = 'position:fixed;opacity:0';
    (document.querySelector('dialog[open]') || document.body).append(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}
/** Share text to a group. Long Sinhala text breaks wa.me links, so use the share sheet or the clipboard. */
export async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/* ---- group reports ---- */
const line = '━━━━━━━━━━━━';
const publicName = id => (byId('members', id)?.anon ? 'නම සඳහන් නොකරන පින්වතෙක්' : memberName(id));

export function donationListText(ev, { amounts = true } = {}) {
  const dons = all('donations').filter(d => d.eventId === ev.id).sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const cash = dons.filter(d => d.kind !== 'goods'), goods = dons.filter(d => d.kind === 'goods');
  const st = eventStats(S.db, ev.id);
  const out = [`🌕 *${eventLabel(ev)}*`, fmtDate(ev.date), line, '*පරිත්‍යාග කළ පින්වත්හු*', ''];
  cash.forEach((d, i) => out.push(`${i + 1}. ${publicName(d.memberId)}${amounts ? ` — රු. ${money(d.amount)}` : ''}`));
  if (goods.length) { out.push('', '*භාණ්ඩ පරිත්‍යාග*'); goods.forEach((d, i) => out.push(`${i + 1}. ${publicName(d.memberId)} — ${d.goods}`)); }
  out.push(line, `*මුළු එකතුව: රු. ${money(st.total)}*`, '', 'සියලු දෙනාටම බොහොම පින්! 🙏', `— ${orgName()}`);
  return out.join('\n');
}

export function financeText(ev) {
  const row = fundLedger(S.db, ev.fund).find(r => r.event.id === ev.id);
  const st = eventStats(S.db, ev.id);
  const exps = all('expenses').filter(x => x.eventId === ev.id);
  const out = [`🌕 *${eventLabel(ev)} — ගිණුම් සාරාංශය*`, fmtDate(ev.date), line,
    `පෙර ශේෂය: රු. ${money(row.brought)}`, `මුදල් එකතුව: රු. ${money(st.total)} (පින්වත්හු ${new Set(all('donations').filter(d => d.eventId === ev.id && d.kind !== 'goods').map(d => d.memberId)).size})`];
  if (row.transfer) out.push(`අරමුදල් මාරු: රු. ${money(row.transfer)}`);
  if (exps.length) { out.push('', '*වියදම්*'); exps.forEach(x => out.push(`• ${x.title}: රු. ${money(x.amount)}`)); }
  out.push(`මුළු වියදම: රු. ${money(st.spent)}`, line, `*ඉදිරියට ගෙන යන ඉතිරිය: රු. ${money(row.balance)}*`);
  const done = all('deliveries').filter(d => d.eventId === ev.id && d.status === 'done');
  if (done.length) {
    out.push('', `*බඩු මලු පිරිනැමූ පවුල් ගණන: ${done.length}*`);
    areaCounts(S.db, ev.id).forEach(([a, n]) => out.push(`• ${a}: පවුල් ${n}`));
  } else if (ev.type === 'poya' && plannedParcels(S.db, ev)) out.push('', `සැලසුම් කළ බඩු මලු: ${plannedParcels(S.db, ev)}`);
  out.push('', 'දායක වූ සැමට පින් සිදු වේවා! 🙏', `— ${orgName()}`);
  return out.join('\n');
}

export function groupReminderText(ev) {
  const who = S.users.filter(u => u.active).map(u => `• ${u.name}${u.phone ? ` — ${u.phone}` : ''}`).join('\n');
  const bank = setting('bankDetails');
  return fill(template('remindGroup'), vars(ev, { එකතුකරන්නන්: who + (bank ? `\n\n🏦 ${bank}` : '') }));
}

export function shopListText(ev, totals, parcels) {
  return [`*${eventLabel(ev)} — බඩු ලැයිස්තුව*`, `මලු ${parcels}ක් සඳහා`, line,
    ...totals.items.map(({ item, qty }) => `• ${item.name}: ${qty} ${item.unit || ''}`.trim()), '', `— ${orgName()}`].join('\n');
}

