import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { waNumber, parseMemberLines, money, html, raw } from '../app/js/util.js';
import { pledgeStatus, holdings, parcelTotals, currentEvent, areaCounts, fundLedger } from '../app/js/calc.js';
import { POYA } from '../app/js/poya.js';

test('phone numbers in every way people write them', () => {
  for (const p of ['0771234567', '077 123 4567', '077-1234567', '+94771234567', '94771234567', '0094 77 123 4567', '771234567', '+94 077 123 4567']) assert.equal(waNumber(p), '94771234567', p);
  assert.equal(waNumber('+44 7911 123456'), '447911123456');
  for (const p of ['', 'abc', '07712', null]) assert.equal(waNumber(p), '', String(p));
});

test('pasted member lists', () => {
  assert.deepEqual(parseMemberLines('1. සුනිල් පෙරේරා, 0771234567, මහරගම\n\nNimal\t077-123 4568\nකමලා - 0712345678\nරංජිත්'), [
    { name: 'සුනිල් පෙරේරා', phone: '0771234567', area: 'මහරගම' },
    { name: 'Nimal', phone: '0771234568', area: '' },
    { name: 'කමලා', phone: '0712345678', area: '' },
    { name: 'රංජිත්', phone: '', area: '' },
  ]);
});

test('html escapes everything except raw', () => {
  assert.equal(String(html`<b title="${'"x'}">${'<script>'}</b>${raw('<i>')}${['a', html`<u>`]}`), '<b title="&quot;x">&lt;script&gt;</b><i>a<u>');
});

test('money format', () => { assert.equal(money(1234.5), '1,234.50'); assert.equal(money(0.1 + 0.2), '0.30'); assert.equal(money(-900), '-900'); });

const don = (memberId, amount, p = {}) => ({ id: Math.random() + '', eventId: 'e', memberId, amount, kind: 'cash', collectorId: 'u', ...p });

test('a gift pays off pledges once, even with two pledges', () => {
  const db = { donations: [don('m', 1500), don('m', 9, { kind: 'goods' })], pledges: [{ id: 'a', eventId: 'e', memberId: 'm', amount: 1000 }, { id: 'b', eventId: 'e', memberId: 'm', amount: 1000 }] };
  assert.deepEqual(pledgeStatus(db, 'e').map(p => p.due), [0, 500]);
});

test('goods never count as cash; bank gifts sit in the bank; expenses come off whoever paid', () => {
  const db = { events: [{ id: 'e', status: 'open' }], donations: [don('m', 100), don('m', 50, { kind: 'bank' }), don('m', 999, { kind: 'goods' }), don('m', 7, { deleted: true })], expenses: [{ eventId: 'e', amount: 25, paidBy: 'v' }] };
  assert.deepEqual(holdings(db, ['u', 'v'], 'v'), { u: 100, v: -25, BANK: 50 });
});

test('closing an event moves what is left to the treasurer; bank money and open events stay put', () => {
  const db = {
    events: [{ id: 'e', status: 'closed' }, { id: 'f', status: 'open' }],
    donations: [don('m', 100), don('m', 50, { kind: 'bank' }), don('m', 30, { eventId: 'f' })],
    expenses: [{ eventId: 'e', amount: 25, paidBy: 'v' }, { eventId: 'e', amount: 10, paidBy: 'BANK' }], openings: [{ fund: 'poya', holder: 'u', amount: 5 }],
  };
  assert.deepEqual(holdings(db, ['u', 'v', 't'], 't'), { u: 30, v: 0, t: 80, BANK: 40 });
});

test('parcel totals', () => {
  const t = parcelTotals({ parcelItems: [{ id: 1, eventId: 'e', qty: 2.5, price: 220 }, { id: 2, eventId: 'e', qty: 1, price: 99.99 }] }, 'e', 20);
  assert.equal(t.perParcel, 649.99); assert.equal(t.total, 12999.8); assert.equal(t.items[0].qty, 50);
});

test('current event: next open poya, with a week of grace', () => {
  const ev = (id, date, type = 'poya', status = 'open') => ({ id, date, type, status });
  const db = { events: [ev('old', '2026-11-24'), ev('next', '2026-12-23'), ev('ann', '2026-12-01', 'annual')] };
  assert.equal(currentEvent(db, '2026-11-28').id, 'old');
  assert.equal(currentEvent(db, '2026-12-05').id, 'next');
  db.events[0].status = 'closed';
  assert.equal(currentEvent(db, '2026-11-25').id, 'next');
});

test('late gifts to an earlier event flow into later balances', () => {
  const db = { events: [{ id: 'e', date: '2026-01-01', fund: 'poya' }, { id: 'f', date: '2026-02-01', fund: 'poya' }], donations: [don('m', 10), don('m', 5, { eventId: 'f' })], openings: [{ fund: 'poya', amount: 100, holder: 'u' }] };
  assert.deepEqual(fundLedger(db, 'poya').map(r => [r.brought, r.balance]), [[100, 110], [110, 115]]);
});

test('public area counts hold no names', () => {
  const db = { families: [{ id: 'x', name: 'SECRET', area: 'මහරගම' }, { id: 'y', name: 'SECRET2', area: '' }], deliveries: [{ eventId: 'e', familyId: 'x', status: 'done' }, { eventId: 'e', familyId: 'y', status: 'done' }, { eventId: 'e', familyId: 'x', status: 'planned' }] };
  assert.deepEqual(areaCounts(db, 'e'), [['මහරගම', 1], ['වෙනත්', 1]]);
});

test('poya list is ordered, about a month apart', () => {
  for (let i = 1; i < POYA.length; i++) { const d = (Date.parse(POYA[i][0]) - Date.parse(POYA[i - 1][0])) / 864e5; assert.ok(d >= 28 && d <= 31, POYA[i][0]); }
});

test('service worker lists every app file', () => {
  const sw = fs.readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
  for (const dir of ['', 'screens/']) for (const f of fs.readdirSync(new URL(`../app/js/${dir}`, import.meta.url)).filter(f => f.endsWith('.js'))) assert.ok(sw.includes(`'${dir}${f.replace('.js', '')}'`), f);
});

test('app and backend agree on tables', async () => {
  const gs = fs.readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');
  const store = fs.readFileSync(new URL('../app/js/store.js', import.meta.url), 'utf8');
  const mine = /TABLES = \[(.*?)\]/s.exec(store)[1].match(/\w+/g);
  const theirs = new Function(gs.slice(gs.indexOf('const SCHEMA'), gs.indexOf('const USER_FIELDS')) + 'return Object.keys(SCHEMA)')();
  assert.deepEqual(mine.sort(), theirs.sort());
});
