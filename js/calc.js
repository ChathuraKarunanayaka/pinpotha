// Pure money maths. No DOM, no storage: everything here is unit-tested.
// `db` is { tableName: [records] }. Sums run in cents so 0.1 + 0.2 stays exact.

export const FUNDS = { poya: 'මාසික පොහොය අරමුදල', annual: 'සංවත්සර අරමුදල' };
export const BANK = 'BANK';

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

/** Cash each person (or the bank) should be holding. Unconfirmed handovers stay with the giver. */
export function holdings(db, userIds) {
  const h = {};
  [...userIds, BANK].forEach(id => { h[id] = 0; });
  const add = (id, c) => { h[id] = (h[id] || 0) + c; };
  const evs = new Set(live(db.events).map(e => e.id));
  live(db.openings).forEach(o => add(o.holder, cents(o.amount)));
  live(db.donations).filter(d => isMoney(d) && evs.has(d.eventId)).forEach(d => add(d.kind === 'bank' ? BANK : d.collectorId, cents(d.amount)));
  live(db.expenses).filter(x => evs.has(x.eventId)).forEach(x => add(x.paidBy, -cents(x.amount)));
  live(db.handovers).filter(v => v.status === 'confirmed').forEach(v => { add(v.fromId, -cents(v.amount)); add(v.toId, cents(v.amount)); });
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

/** Donations someone else paid for and has not been paid back. */
export const openDebts = db => live(db.donations).filter(d => d.payerId && !d.settled && isMoney(d));

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
