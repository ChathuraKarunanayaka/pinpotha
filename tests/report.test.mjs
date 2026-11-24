import test from 'node:test';
import assert from 'node:assert/strict';
import { reportRows, reviewIssues, rowSignature } from '../app/js/calc.js';
import { imagesToPdf } from '../app/js/pdf.js';
import { layout, rowsFor, STYLES, MAX } from '../app/js/collage.js';

const mem = (id, name, area = 'මහරගම') => ({ id, name, area });

test('review flags missing village, duplicates, same names, odd amounts — and nothing else', () => {
  const db = {
    members: [mem('a', 'සුනිල්'), mem('b', 'කමලා', ''), mem('c', 'ක මලා'), mem('x', 'නිමල් 077'), mem('e', 'රංජිත්'), mem('f', 'අනුලා')],
    donations: [['1', 'a', 1000], ['2', 'a', 500], ['3', 'b', 1000], ['4', 'c', 1000], ['5', 'x', 100000], ['6', 'e', 5], ['7', 'f', 1000], ['8', 'f', '', 'goods']]
      .map(([id, memberId, amount, kind = 'cash']) => ({ id, memberId, amount, kind, eventId: 'e', collectorId: 'u', date: '2026-12-01' })),
  };
  const is = reviewIssues(reportRows(db, 'e')), has = (id, t) => (is[id] || []).some(x => x.includes(t));
  assert.ok(has('1', 'එකකට වඩා') && has('2', 'එකකට වඩා'));
  assert.ok(has('3', 'ගම') && has('3', 'එකම නමින්') && has('4', 'එකම නමින්'));
  assert.ok(has('5', 'වැඩියි') && has('5', 'ඉලක්කම්') && has('6', 'අඩුයි'));
  assert.equal(is['7'], undefined);
  assert.equal(is['8'], undefined);
});

test('deleted gifts never reach the report', () => {
  const db = { members: [mem('a', 'x')], donations: [{ id: '1', memberId: 'a', eventId: 'e', amount: 5, deleted: true }, { id: '2', memberId: 'a', eventId: 'other', amount: 5 }] };
  assert.equal(reportRows(db, 'e').length, 0);
});

test('any printed change un-ticks the line', () => {
  const r = { d: { kind: 'cash', amount: 100, goods: '', collectorId: 'u' }, m: mem('a', 'සුනිල්') }, s = rowSignature(r);
  assert.equal(rowSignature(structuredClone(r)), s);
  const changed = [{ ...r, m: { ...r.m, name: 'සුනිල' } }, { ...r, m: { ...r.m, area: 'ගාල්ල' } }, { ...r, m: { ...r.m, anon: true } }, { ...r, d: { ...r.d, amount: 1000 } }, { ...r, d: { ...r.d, collectorId: 'v' } }];
  for (const x of changed) assert.notEqual(rowSignature(x), s);
});

test('PDF: every object offset is exact', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const s = Buffer.from(imagesToPdf([{ jpeg, w: 2, h: 3 }, { jpeg, w: 2, h: 3 }], 'දනට')).toString('latin1');
  const xref = Number(/startxref\n(\d+)/.exec(s)[1]);
  assert.ok(s.slice(xref).startsWith('xref\n0 10\n'));
  s.slice(xref).split('\n').slice(3, 12).forEach((l, i) => {
    assert.equal(l.length, 19);
    assert.ok(s.slice(Number(l.slice(0, 10))).startsWith(`${i + 1} 0 obj`));
  });
  assert.ok(s.includes('/Count 2') && s.includes('<FEFF0DAF0DB10DA7>') && s.endsWith('%%EOF\n'));
});

test('collage: every photo is placed inside the picture; rings and grids never overlap', () => {
  const area = { x: 50, y: 50, w: 1340, h: 1470 };
  for (const st of Object.keys(STYLES)) for (let n = 1; n <= MAX; n++) for (const seed of [1, 7, 500]) {
    const cells = layout(st, n, area, seed), slack = st === 'polaroid' ? 45 : 0.5;
    assert.equal(cells.length, n, st + n);
    for (const b of cells) {
      assert.ok(b.w > 90 && b.h > 90, `${st} ${n} tiny`);
      assert.ok(b.x >= area.x - slack && b.y >= area.y - slack && b.x + b.w <= area.x + area.w + slack && b.y + b.h <= area.y + area.h + slack, `${st} ${n} outside`);
    }
    if (st === 'polaroid') continue;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const p = cells[i], q = cells[j];
      const hit = p.round ? Math.hypot(p.x + p.w / 2 - q.x - q.w / 2, p.y + p.h / 2 - q.y - q.h / 2) < (p.w + q.w) / 2 - 0.5
        : p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;
      assert.ok(!hit, `${st} ${n}: ${i}/${j} overlap`);
    }
  }
  for (let n = 1; n <= MAX; n++) assert.equal(rowsFor(n).reduce((a, b) => a + b, 0), n);
});
