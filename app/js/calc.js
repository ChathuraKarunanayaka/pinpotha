// Pure money maths. No DOM, no storage: everything here is unit-tested.
// `db` is { tableName: [records] }. Sums run in cents so 0.1 + 0.2 stays exact.

export const FUNDS = { poya: 'මාසික පොහොය අරමුදල', annual: 'සංවත්සර අරමුදල' };
export const BANK = 'BANK';
/** The common fund: what is left once an event's accounts are closed. */
export const POOL = 'POOL';

const cents = n => Math.round(Number(n || 0) * 100);
const live = rows => (rows || []).filter(r => !r.deleted);
const sum = (rows, f) => rows.reduce((s, r) => s + cents(f(r)), 0);
const isMoney = d => d.kind !== 'goods';

export const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);

/** Ledger line per event of a fund, oldest first, each carrying the previous balance. */
export function fundLedger(db, fund) {
  const transfersUpTo = date => sum(live(db.transfers).filter(t => t.date <= date && t.toFund === fund), t => t.amount)
    - sum(live(db.transfers).filter(t => t.date <= date && t.fromFund === fund), t => t.amount);
  let run = sum(live(db.openings).filter(o => o.fund === fund), o => o.amount);
  let moved = 0;
  return live(db.events).filter(e => e.fund === fund).sort(byDateAsc).map(event => {
    const income = sum(live(db.donations).filter(d => d.eventId === event.id && isMoney(d)), d => d.amount);
    const spent = sum(live(db.expenses).filter(x => x.eventId === event.id), x => x.amount);
    const tr = transfersUpTo(event.date);
    const brought = run, transfer = tr - moved;
    moved = tr;
    run = brought + transfer + income - spent;
    return { event, brought: brought / 100, transfer: transfer / 100, income: income / 100, spent: spent / 100, balance: run / 100 };
  });
}

/** Everything in a fund right now, including transfers dated after its last event. */
export function fundBalance(db, fund) {
  const ids = new Set(live(db.events).filter(e => e.fund === fund).map(e => e.id));
  return (sum(live(db.openings).filter(o => o.fund === fund), o => o.amount)
    + sum(live(db.donations).filter(d => ids.has(d.eventId) && isMoney(d)), d => d.amount)
    - sum(live(db.expenses).filter(x => ids.has(x.eventId)), x => x.amount)
    + sum(live(db.transfers).filter(t => t.toFund === fund), t => t.amount)
    - sum(live(db.transfers).filter(t => t.fromFund === fund), t => t.amount)) / 100;
}

/**
 * Cash each person (or the bank) is holding, worked out from what they collected and paid.
 * Open events: money stays with whoever collected it. Once an event's accounts are closed the
 * rest belongs to the common fund, so nobody has to record passing money on.
 */
export function holdings(db, userIds) {
  const h = {};
  [...userIds, POOL, BANK].forEach(id => { h[id] = 0; });
  const add = (id, c) => { h[id] = (h[id] || 0) + c; };
  const evs = Object.fromEntries(live(db.events).map(e => [e.id, e]));
  const at = (id, ev) => (id !== BANK && (!ev || ev.status === 'closed') ? POOL : id);
  live(db.openings).forEach(o => add(at(o.holder), cents(o.amount)));
  live(db.donations).filter(d => isMoney(d) && evs[d.eventId]).forEach(d => add(d.kind === 'bank' ? BANK : at(d.collectorId, evs[d.eventId]), cents(d.amount)));
  live(db.expenses).filter(x => evs[x.eventId]).forEach(x => add(at(x.paidBy, evs[x.eventId]), -cents(x.amount)));
  Object.keys(h).forEach(k => { h[k] /= 100; });
  return h;
}

export function eventStats(db, eventId) {
  const dons = live(db.donations).filter(d => d.eventId === eventId);
  const money = dons.filter(isMoney);
  const exps = live(db.expenses).filter(x => x.eventId === eventId);
  const byCollector = {};
  money.forEach(d => { const k = d.collectorId; byCollector[k] = (byCollector[k] || 0) + cents(d.amount); });
  Object.keys(byCollector).forEach(k => { byCollector[k] /= 100; });
  return {
    total: sum(money, d => d.amount) / 100,
    cash: sum(money.filter(d => d.kind === 'cash'), d => d.amount) / 100,
    bank: sum(money.filter(d => d.kind === 'bank'), d => d.amount) / 100,
    count: dons.length,
    goods: dons.filter(d => !isMoney(d)),
    donors: new Set(dons.map(d => d.memberId)),
    spent: sum(exps, x => x.amount) / 100,
    byCollector,
  };
}

/** Pledges of an event with what each person has given so far. */
export function pledgeStatus(db, eventId) {
  const given = {};
  live(db.donations).filter(d => d.eventId === eventId && isMoney(d)).forEach(d => { given[d.memberId] = (given[d.memberId] || 0) + cents(d.amount); });
  const left = { ...given };
  return live(db.pledges).filter(p => p.eventId === eventId && !p.cancelled).map(p => {
    const used = Math.min(left[p.memberId] || 0, cents(p.amount));
    left[p.memberId] = (left[p.memberId] || 0) - used;
    return { pledge: p, given: used / 100, due: (cents(p.amount) - used) / 100 };
  });
}

export function parcelTotals(db, eventId, parcels) {
  const items = live(db.parcelItems).filter(i => i.eventId === eventId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const perParcel = items.reduce((s, i) => s + Math.round(Number(i.qty || 0) * Number(i.price || 0) * 100), 0) / 100;
  return {
    items: items.map(i => ({ item: i, qty: Math.round(Number(i.qty || 0) * parcels * 1000) / 1000, cost: Math.round(Number(i.qty || 0) * parcels * Number(i.price || 0) * 100) / 100 })),
    perParcel,
    total: items.reduce((s, i) => s + Math.round(Number(i.qty || 0) * parcels * Number(i.price || 0) * 100), 0) / 100,
  };
}

export function plannedParcels(db, event) {
  const planned = live(db.deliveries).filter(d => d.eventId === event.id).reduce((s, d) => s + Number(d.parcels || 1), 0);
  return Number(event.parcels) || planned;
}

/** Date of the last delivered parcel per family id. */
export function lastDelivered(db) {
  const date = Object.fromEntries((db.events || []).map(e => [e.id, e.date]));
  const out = {};
  live(db.deliveries).filter(d => d.status === 'done').forEach(d => { const dt = date[d.eventId] || ''; if (!out[d.familyId] || out[d.familyId] < dt) out[d.familyId] = dt; });
  return out;
}

export function taskSpend(db, taskId) {
  return sum(live(db.expenses).filter(x => x.taskId === taskId), x => x.amount) / 100;
}

/** [[area, count], ...] for families covered by an event — used in public reports instead of names. */
export function areaCounts(db, eventId) {
  const fam = Object.fromEntries((db.families || []).map(f => [f.id, f]));
  const m = {};
  live(db.deliveries).filter(d => d.eventId === eventId && d.status === 'done').forEach(d => { const a = (fam[d.familyId]?.area || '').trim() || 'වෙනත්'; m[a] = (m[a] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

/** The event people most likely mean "now": next open one, allowing a week after its date to finish up. */
export function currentEvent(db, today) {
  const grace = new Date(Date.parse(today + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  const open = live(db.events).filter(e => e.status !== 'closed').sort(byDateAsc);
  const next = open.filter(e => e.date >= grace);
  return next.find(e => e.type === 'poya') || next[0] || open[open.length - 1] || null;
}

/* ---------------- checking names and amounts before a report goes out ---------------- */
const tidy = s => String(s || '').toLowerCase().replace(/[\s.\u200c\u200d]+/g, '');

/** Donations of an event with the facts printed in the report, oldest first. */
export function reportRows(db, eventId) {
  const mem = Object.fromEntries((db.members || []).map(m => [m.id, m]));
  return live(db.donations).filter(d => d.eventId === eventId).map(d => ({ d, m: mem[d.memberId] || { name: '', area: '' } }))
    .sort((a, b) => String(a.m.name).localeCompare(String(b.m.name), 'si') || byDateAsc(a.d, b.d));
}
/** { donationId: [problem, ...] } — things a person should look at before the names are published. */
export function reviewIssues(rows) {
  const out = {}, add = (r, t) => { (out[r.d.id] ||= []).push(t); };
  const perMember = {}, perName = {};
  rows.forEach(r => { (perMember[r.d.memberId] ||= []).push(r); (perName[tidy(r.m.name)] ||= new Set()).add(r.d.memberId); });
  const amounts = rows.filter(r => isMoney(r.d)).map(r => Number(r.d.amount)).sort((a, b) => a - b);
  const mid = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  rows.forEach(r => {
    if (!String(r.m.name).trim()) add(r, 'නම නැත');
    if (!String(r.m.area || '').trim()) add(r, 'ගම සඳහන් නැත');
    if (/[0-9]/.test(r.m.name)) add(r, 'නමේ ඉලක්කම් ඇත');
    if (perMember[r.d.memberId].filter(x => isMoney(x.d) === isMoney(r.d)).length > 1) add(r, 'මෙම අයගේ සටහන් එකකට වඩා ඇත');
    if (perName[tidy(r.m.name)].size > 1) add(r, 'එකම නමින් දෙදෙනෙක් ඇත');
    if (isMoney(r.d) && amounts.length >= 5 && Number(r.d.amount) >= mid * 20) add(r, 'මුදල ඉතා වැඩියි — බිංදු ගණන බලන්න');
    if (isMoney(r.d) && Number(r.d.amount) < 20) add(r, 'මුදල ඉතා අඩුයි');
  });
  return out;
}
/** Changes whenever any printed fact changes, so an edited line must be checked again. */
export function rowSignature({ d, m }) {
  const s = [m.name, m.area, m.anon ? 1 : 0, d.kind, d.amount, d.goods, d.collectorId].join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
