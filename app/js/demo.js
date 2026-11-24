// Made-up sample data for the "try it" mode. Never leaves the phone.
import { POYA, poyaId } from './poya.js';

const NAMES = ['සුනිල් පෙරේරා', 'කමලා විජේසිංහ', 'නිමල් බණ්ඩාර', 'ශ්‍යාමලී ද සිල්වා', 'රංජිත් කුමාර', 'අනුලා මැණිකේ', 'චමින්ද ජයසූරිය', 'දිල්රුක්ෂි ප්‍රනාන්දු', 'ගාමිණී රත්නායක', 'හේමා අබේවර්ධන', 'ඉන්ද්‍රානි සෙනෙවිරත්න', 'ජයන්ත ගුණසේකර', 'කුසුම් රාජපක්ෂ', 'ලාල් විතානගේ', 'මංජුලා ධර්මසේන', 'නදීෂා ලියනගේ', 'ඔෂධී සමරවීර', 'පියල් ගමගේ', 'රුවන් දිසානායක', 'සමන්ති කරුණාරත්න', 'තිලක් හේරත්', 'උපුල් එදිරිසිංහ', 'වසන්ති මුණසිංහ', 'යසෝමා බාලසූරිය'];
const AREAS = ['මහරගම', 'කොට්ටාව', 'හෝමාගම', 'පන්නිපිටිය'];

export function seed(day) {
  const shift = n => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const up = POYA.filter(p => p[0] >= day)[0] || [shift(12), 'පොහොය'];
  const cur = { id: poyaId(up[0]), type: 'poya', title: up[1], date: up[0], fund: 'poya', status: 'open', parcels: '', note: '' };
  const old = { id: 'demo-old', type: 'poya', title: 'පසුගිය පොහොය', date: shift(-24), fund: 'poya', status: 'closed', parcels: 20, note: '' };
  const ann = { id: 'demo-ann', type: 'annual', title: 'සංවත්සර ධර්ම දේශනාව', date: shift(75), fund: 'annual', status: 'open', parcels: '', note: '' };
  const users = [
    { id: 'demo-u1', name: 'ප්‍රධාන පාලක (ඔබ)', role: 'admin', phone: '', active: true, collects: false, joined: true },
    { id: 'demo-u2', name: 'සමන්', role: 'coordinator', phone: '', active: true, collects: true, joined: true },
    { id: 'demo-u3', name: 'කුමාරි', role: 'collector', phone: '', active: true, collects: true, joined: true },
    { id: 'demo-u4', name: 'රුවන්', role: 'collector', phone: '', active: true, collects: true, joined: true },
  ];
  const U = users.slice(1).map(u => u.id);
  // 070 000 00xx: deliberately not real numbers
  const members = NAMES.map((name, i) => ({ id: `demo-m${i}`, name, phone: i === 9 ? '' : `07000000${String(i).padStart(2, '0')}`, area: AREAS[i % 4], usual: i % 4 === 0 ? 1000 : '', collectorId: U[i % 3], noRemind: false, anon: i === 5, inactive: false, note: '' }));
  const amt = [1000, 500, 2000, 1500, 1000, 5000, 500, 1000];
  const don = (id, eventId, i, date, p = {}) => ({ id, eventId, memberId: `demo-m${i}`, kind: 'cash', amount: amt[i % 8], goods: '', collectorId: U[i % 3], date, note: '', ...p });
  const donations = [
    ...members.slice(0, 22).map((_, i) => don(`demo-o${i}`, old.id, i, shift(-25))),
    ...[0, 1, 3, 4, 6].map(i => don(`demo-c${i}`, cur.id, i, day)),
    don('demo-c7', cur.id, 7, day, { kind: 'bank', amount: 2500 }),
    don('demo-c8', cur.id, 8, day, { amount: 1000 }),
    don('demo-c10', cur.id, 10, day, { kind: 'goods', amount: '', goods: 'හාල් කිලෝ 25' }),
    don('demo-a0', ann.id, 2, day, { amount: 10000 }),
    don('demo-a1', ann.id, 5, day, { amount: 5000 }),
  ];
  const families = ['පවුල 1', 'පවුල 2', 'පවුල 3', 'පවුල 4', 'පවුල 5', 'පවුල 6'].map((name, i) => ({ id: `demo-f${i}`, name: `${name} (උදාහරණ)`, area: AREAS[i % 4], address: `අංක ${i + 10}, ${AREAS[i % 4]}`, phone: '', people: 3 + (i % 4), children: i % 3, need: ['රැකියාවක් නැත', 'රෝගී', 'වැඩිහිටි', 'තනි මව'][i % 4], urgent: i === 2, referredBy: NAMES[i], status: i === 5 ? 'candidate' : 'approved', map: '', note: '' }));
  const items = [['හාල්', 'kg', 5, 220], ['පරිප්පු', 'kg', 1, 300], ['සීනි', 'kg', 1, 240], ['තේ කොළ', 'පැකට්', 2, 180], ['කිරිපිටි', 'පැකට්', 1, 1050], ['ටින් මාළු', 'ටින්', 2, 420], ['සබන්', 'කැට', 2, 140]];
  return {
    users,
    tables: {
      settings: [],
      events: [old, cur, ann],
      members, donations, families,
      openings: [{ id: 'demo-op', fund: 'poya', holder: 'POOL', amount: 8400, date: shift(-60), note: 'පොතේ ඉතිරිය' }],
      pledges: [{ id: 'demo-p1', eventId: cur.id, memberId: 'demo-m2', amount: 2000, cancelled: false, note: '' }, { id: 'demo-p2', eventId: cur.id, memberId: 'demo-m5', amount: 5000, cancelled: false, note: '' }],
      expenses: [
        { id: 'demo-e1', eventId: old.id, taskId: '', category: 'බඩු', title: 'මලු 20ක් සඳහා වියළි ආහාර', amount: 24500, paidBy: U[0], shop: 'නගරයේ කඩය', billNo: '1042', date: shift(-25), note: '' },
        { id: 'demo-e2', eventId: ann.id, taskId: 'demo-t1', category: 'සැරසිලි', title: 'කොඩි සහ මල්', amount: 3500, paidBy: U[0], shop: '', billNo: '', date: day, note: '' },
      ],
      teams: [{ id: 'demo-tm1', eventId: cur.id, name: 'කණ්ඩායම 1', people: 'සමන්, රංජිත්', vehicle: 'වෑන් රථය', note: '' }],
      deliveries: [
        ...[0, 1, 2].map(i => ({ id: `demo-d${i}`, eventId: cur.id, familyId: `demo-f${i}`, teamId: i < 2 ? 'demo-tm1' : '', parcels: 1, status: 'planned', doneAt: '', note: '' })),
        ...[1, 3].map(i => ({ id: `demo-do${i}`, eventId: old.id, familyId: `demo-f${i}`, teamId: '', parcels: 1, status: 'done', doneAt: '', note: '' })),
      ],
      parcelItems: items.map(([name, unit, qty, price], i) => ({ id: `demo-i${i}`, eventId: cur.id, name, unit, qty, price, bought: false, sort: i })),
      tasks: [['ස්වාමින් වහන්සේට ආරාධනා කිරීම', 5000, 'done'], ['සැරසිලි කටයුතු', 15000, 'doing'], ['ධර්ම මණ්ඩපය සූදානම් කිරීම', 20000, 'todo'], ['දන්සැල', 40000, 'todo']]
        .map(([title, budget, status], i) => ({ id: `demo-t${i}`, eventId: ann.id, title, owner: NAMES[i + 1], budget, due: shift(40 + i * 8), status, note: '' })),
      transfers: [], messages: [],
    },
  };
}
