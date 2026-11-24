import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from '../tools/gas-mock.mjs';
import { fundLedger, fundBalance, holdings } from '../app/js/calc.js';

function world() {
  const be = createBackend();
  be.setup('භාණ්ඩාගාරික', '1234');
  const key = be.key();
  const admin = be.call({ key, action: 'hello' }).users[0];
  const a = be.call({ key, action: 'login', userId: admin.id, pin: '1234' });
  be.call({ key, action: 'userSave', token: a.token, user: { name: 'නිමල්', role: 'collector', pin: '5678' } });
  const coll = be.call({ key, action: 'hello' }).users[1];
  const c = be.call({ key, action: 'login', userId: coll.id, pin: '5678' });
  let n = 0;
  const op = (token, table, id, patch) => {
    const r = be.call({ key, token, action: 'sync', since: 0, ops: [{ opId: 'o' + n++, table, id, patch }] });
    assert.equal(r.ok, true, r.error);
    return r.results[0];
  };
  const A = (...x) => op(a.token, ...x), C = (...x) => op(c.token, ...x);
  const ok = r => assert.equal(r.ok, true, r.error);
  const no = r => assert.equal(r.ok, false, 'should have been rejected');
  ok(A('events', 'ev1', { type: 'poya', title: 'උඳුවප් පොහොය', date: '2026-12-23', fund: 'poya', status: 'open' }));
  ok(A('members', 'mem1', { name: 'සුනිල්', phone: '0771234567' }));
  ok(A('members', 'mem2', { name: 'කමලා' }));
  const don = (id, p) => ({ eventId: 'ev1', memberId: 'mem1', kind: 'cash', amount: 1000, collectorId: coll.id, date: '2026-12-20', ...p });
  const pull = () => be.call({ key, token: a.token, action: 'sync', since: 0, ops: [] });
  return { be, key, a, c, admin, coll, A, C, ok, no, don, pull };
}

test('wrong key, wrong PIN, lock-out, tampered token', () => {
  const { be, key, coll, a } = world();
  assert.equal(be.call({ key: 'x', action: 'hello' }).code, 'key');
  for (let i = 0; i < 5; i++) assert.equal(be.call({ key, action: 'login', userId: coll.id, pin: '0000' }).code, 'pin');
  assert.equal(be.call({ key, action: 'login', userId: coll.id, pin: '5678' }).code, 'locked');
  assert.equal(be.call({ key, token: a.token.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), action: 'sync' }).code, 'auth');
  const hello = JSON.stringify(be.call({ key, action: 'hello' }));
  assert.ok(!/pinHash|salt/.test(hello));
});

test('PINs never reach clients; deactivated users and changed PINs lose access', () => {
  const { be, key, a, c, coll, pull } = world();
  assert.ok(!/pinHash|"salt"/.test(JSON.stringify(pull())));
  const r = be.call({ key, token: c.token, action: 'changePin', oldPin: '5678', newPin: '9999' });
  assert.equal(r.ok, true);
  assert.equal(be.call({ key, token: c.token, action: 'sync' }).code, 'auth');
  assert.equal(be.call({ key, token: r.token, action: 'sync' }).ok, true);
  be.call({ key, token: a.token, action: 'userSave', user: { id: coll.id, name: 'නිමල්', role: 'collector', active: false } });
  assert.equal(be.call({ key, token: r.token, action: 'sync' }).code, 'auth');
});

test('last admin cannot be removed; collectors cannot manage users', () => {
  const { be, key, a, c, admin } = world();
  assert.equal(be.call({ key, token: a.token, action: 'userSave', user: { id: admin.id, name: 'x', role: 'collector' } }).code, 'invalid');
  assert.equal(be.call({ key, token: c.token, action: 'userSave', user: { name: 'y', role: 'admin', pin: '1111' } }).code, 'denied');
});

test('text survives the sheet: leading zeros, dates, formulas, apostrophes', () => {
  const { A, ok, pull } = world();
  ok(A('members', 'mem9', { name: '=1+1', phone: '0712345678', note: "'quoted" }));
  const m = pull().changes.members.find(x => x.id === 'mem9');
  assert.equal(m.name, '=1+1');
  assert.equal(m.phone, '0712345678');
  assert.equal(pull().changes.events[0].date, '2026-12-23');
});

test('collector rules', () => {
  const { A, C, ok, no, don, admin, coll } = world();
  ok(C('donations', 'don1', don()));
  no(C('donations', 'don2', don('', { collectorId: admin.id })));
  ok(A('donations', 'don3', don('', { collectorId: admin.id })));
  no(C('donations', 'don3', { amount: 5 }));
  no(C('donations', 'don1', { collectorId: admin.id }));
  no(C('expenses', 'exp1', { eventId: 'ev1', title: 'x', amount: 5, paidBy: coll.id }));
  no(C('members', 'mem1', { deleted: true }));
  no(C('settings', 'orgName', { value: 'x' }));
  no(C('families', 'fam1', { name: 'x', status: 'approved' }));
  ok(C('families', 'fam1', { name: 'x', status: 'candidate' }));
  no(C('families', 'fam1', { status: 'approved' }));
  ok(C('donations', 'don3', { settled: true }));
});

test('validation', () => {
  const { A, C, ok, no, don } = world();
  no(C('donations', 'd1a', don('', { amount: 0 })));
  no(C('donations', 'd1b', don('', { amount: -50 })));
  no(C('donations', 'd1c', don('', { memberId: 'nope' })));
  no(C('donations', 'd1d', don('', { kind: 'goods', amount: '' })));
  ok(C('donations', 'd1e', don('', { kind: 'goods', amount: '', goods: 'හාල් කිලෝ 10' })));
  no(C('donations', 'd1f', don('', { payerId: 'mem1' })));
  ok(C('donations', 'd1g', don('', { payerId: 'mem2' })));
  no(A('members', 'mem2', { deleted: true }));
  no(A('events', 'ev1', { deleted: true }));
  no(A('bogus', 'b1x', {}));
});

test('closed event is frozen, but a debt can still be settled', () => {
  const { A, C, ok, no, don } = world();
  ok(C('donations', 'don1', don('', { payerId: 'mem2' })));
  ok(A('events', 'ev1', { status: 'closed' }));
  no(C('donations', 'don1', { amount: 5 }));
  no(A('donations', 'don2', don()));
  ok(C('donations', 'don1', { settled: true, settledAt: '2026-12-30' }));
  ok(A('events', 'ev1', { status: 'open' }));
  ok(C('donations', 'don1', { amount: 1500 }));
});

test('handover: only the receiver confirms; bank needs an admin', () => {
  const { A, C, ok, no, admin, coll } = world();
  const h = p => ({ fromId: coll.id, toId: admin.id, amount: 500, date: '2026-12-21', status: 'pending', ...p });
  no(C('handovers', 'h01', h({ status: 'confirmed' })));
  no(C('handovers', 'h01', h({ fromId: admin.id, toId: coll.id })));
  ok(C('handovers', 'h01', h()));
  no(C('handovers', 'h01', { status: 'confirmed' }));
  ok(A('handovers', 'h01', { status: 'confirmed' }));
  no(C('handovers', 'h01', { amount: 1 }));
  ok(C('handovers', 'h02', h({ toId: 'BANK' })));
  no(C('handovers', 'h02', { status: 'confirmed' }));
  ok(A('handovers', 'h02', { status: 'confirmed' }));
});

test('replaying the same op is harmless, patches merge by field, pulls are incremental', () => {
  const { be, key, a, C, A, ok, don, pull } = world();
  ok(C('donations', 'don1', don()));
  const audits = be.sheet('db_audit').getLastRow();
  ok(C('donations', 'don1', don()));
  assert.equal(be.sheet('db_audit').getLastRow(), audits);
  const rev = pull().rev;
  ok(A('donations', 'don1', { note: 'n' }));
  ok(C('donations', 'don1', { amount: 1200 }));
  const r = be.call({ key, token: a.token, action: 'sync', since: rev, ops: [] });
  assert.deepEqual(Object.keys(r.changes), ['donations']);
  assert.equal(r.changes.donations.length, 1);
  assert.equal(r.changes.donations[0].note, 'n');
  assert.equal(r.changes.donations[0].amount, 1200);
  assert.equal(be.sheet('db_donations').getLastRow(), 3);
});

test('a rejected op returns the stored record and does not block the others', () => {
  const { be, key, c, admin, coll, don, A, ok } = world();
  ok(A('donations', 'don1', don('', { collectorId: admin.id })));
  const r = be.call({ key, token: c.token, action: 'sync', since: 0, ops: [
    { opId: '1', table: 'donations', id: 'don1', patch: { amount: 9 } },
    { opId: '2', table: 'donations', id: 'don2', patch: don('', { collectorId: coll.id }) },
  ] });
  assert.equal(r.results[0].ok, false);
  assert.equal(r.results[0].rec.amount, 1000);
  assert.equal(r.results[1].ok, true);
});

test('audit log keeps before and after, and delete can be undone', () => {
  const { be, key, a, C, ok, don } = world();
  ok(C('donations', 'don1', don()));
  ok(C('donations', 'don1', { amount: 2000 }));
  ok(C('donations', 'don1', { deleted: true }));
  ok(C('donations', 'don1', { deleted: false }));
  const rows = be.call({ key, token: a.token, action: 'history', limit: 10 }).rows;
  assert.deepEqual(rows.slice(0, 4).map(r => r.action), ['restore', 'delete', 'update', 'create']);
  assert.equal(rows[2].before.amount, 1000);
  assert.equal(rows[2].after.amount, 2000);
});

test('sheet summary equals the app maths, and cash held equals fund balances', () => {
  const { be, A, C, ok, don, admin, coll, pull } = world();
  ok(A('openings', 'op1', { fund: 'poya', holder: admin.id, amount: 2500.5 }));
  ok(A('events', 'ev2', { type: 'poya', title: 'දුරුතු පොහොය', date: '2027-01-22', fund: 'poya', status: 'open' }));
  ok(A('events', 'evA', { type: 'annual', title: 'සංවත්සරය', date: '2027-01-10', fund: 'annual', status: 'open' }));
  ok(C('donations', 'don1', don()));
  ok(C('donations', 'don2', don('', { kind: 'bank', amount: 250.25 })));
  ok(C('donations', 'don3', don('', { kind: 'goods', goods: 'හාල්', amount: 900 })));
  ok(C('donations', 'don4', don('', { eventId: 'ev2', amount: 700 })));
  ok(C('donations', 'don5', don('', { eventId: 'evA', amount: 5000 })));
  ok(A('expenses', 'ex1', { eventId: 'ev1', title: 'හාල්', amount: 1800.1, paidBy: admin.id, date: '2026-12-22' }));
  ok(A('transfers', 'tr1', { fromFund: 'annual', toFund: 'poya', amount: 1000, date: '2027-01-15' }));
  ok(A('handovers', 'ha1', { fromId: coll.id, toId: admin.id, amount: 600, date: '2026-12-23', status: 'confirmed' }));
  const db = pull().changes;
  const led = fundLedger(db, 'poya');
  assert.equal(led[0].balance, 1950.65);
  assert.equal(led[1].brought, 1950.65);
  assert.equal(led[1].transfer, 1000);
  assert.equal(led[1].balance, 3650.65);
  const sh = be.sheet('සාරාංශය').cells.slice(1).filter(r => r[0] === 'මාසික පොහොය අරමුදල');
  assert.deepEqual(sh.map(r => r.slice(3, 8)), led.map(l => [l.brought, l.income, l.transfer, l.spent, l.balance]));
  const held = Object.values(holdings(db, [admin.id, coll.id])).reduce((s, x) => s + x, 0);
  assert.equal(Math.round(held * 100), Math.round((fundBalance(db, 'poya') + fundBalance(db, 'annual')) * 100));
  assert.equal(be.sheet('පරිත්‍යාග').getLastRow(), 6);
});

test('daily e-mail only on the configured day', () => {
  const { be, A, ok } = world();
  const in4 = new Date(Date.now() + 5.5 * 36e5 + 4 * 864e5).toISOString().slice(0, 10);
  ok(A('events', 'evT', { type: 'poya', title: 'T', date: in4, fund: 'poya', status: 'open' }));
  be.ctx.dailyReminder();
  assert.equal(be.ctx.MailApp.sent.length, 0);
  ok(A('settings', 'notifyEmails', { value: 'a@example.com' }));
  be.ctx.dailyReminder();
  assert.equal(be.ctx.MailApp.sent.length, 1);
});

test('setup twice keeps users and key; a new schema column is added in place', () => {
  const { be, key, pull, A, ok } = world();
  be.setup('Other', '9999');
  assert.equal(be.key(), key);
  assert.equal(be.call({ key, action: 'hello' }).users.length, 2);
  be.run("SCHEMA.members.birthday = ['s', 'උපන් දිනය']");
  be.setup('Other', '9999');
  ok(A('members', 'mem1', { birthday: '1990-01-01' }));
  const m = pull().changes.members.find(x => x.id === 'mem1');
  assert.equal(m.birthday, '1990-01-01');
  assert.equal(m.phone, '0771234567');
  assert.ok(be.sheets.some(s => !s.hidden));
});

test('1,500 rows grow past the default sheet size', () => {
  const { be, key, a, pull } = world();
  for (let b = 0; b < 4; b++) {
    const ops = Array.from({ length: 400 }, (_, i) => ({ opId: `${b}-${i}`, table: 'members', id: `bulk-${b}-${i}`, patch: { name: 'n' + i } }));
    const r = be.call({ key, token: a.token, action: 'sync', since: 0, ops });
    assert.equal(r.ok, true, r.error);
  }
  assert.equal(pull().changes.members.length, 1602);
});
