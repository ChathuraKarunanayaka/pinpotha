// Cash in hand and handovers, expenses, pledges, and money given on someone's behalf.
import { S, all, me, byId, put, remove, isAdmin, memberName, userName, activeUsers } from '../store.js';
import { html, rs, fmtDate, today } from '../util.js';
import { holdings, fundBalance, FUNDS, BANK, pledgeStatus, openDebts, eventStats } from '../calc.js';
import { icon, on, toast, formSheet, empty, stat, confirmBox, dateField } from '../ui.js';
import { activeEvent, eventBar, wireEventBar } from './home.js';
import { render } from '../main.js';

const holders = () => [...activeUsers().map(u => [u.id, u.name]), [BANK, 'බැංකු ගිණුම']];
const delWithUndo = async (table, r, what) => {
  if (!(await confirmBox('මකන්නද?', what, { ok: 'මකන්න', danger: true }))) return false;
  await remove(table, r.id);
  toast('මැකුවා', { undo: () => put(table, r.id, { deleted: false }) });
  return true;
};

/* ---------------- cash ---------------- */
export function cash() {
  const h = holdings(S.db, S.users.map(u => u.id));
  const mine = h[me().id] || 0;
  const pend = all('handovers').filter(x => x.status === 'pending');
  const inbox = pend.filter(x => x.toId === me().id || (isAdmin() && x.toId === BANK));
  const rest = pend.filter(x => !inbox.includes(x));
  const done = all('handovers').filter(x => x.status === 'confirmed').sort((a, b) => b.date.localeCompare(a.date));
  const people = Object.entries(h).filter(([id, v]) => v !== 0 || id === BANK || S.users.find(u => u.id === id)?.active);
  const total = Object.values(h).reduce((s, v) => s + Math.round(v * 100), 0) / 100;
  const funds = Object.keys(FUNDS).map(f => [f, fundBalance(S.db, f)]);
  const ok = Math.round(total * 100) === Math.round(funds.reduce((s, [, v]) => s + v, 0) * 100);
  return {
    title: 'මුදල් භාරදීම', back: 'more',
    body: html`
      <section class="card mine tall"><div class="grow"><small>දැනට මා අත ඇති මුදල</small><b class="${mine < 0 ? 'neg' : ''}">${rs(mine)}</b>${mine < 0 ? html`<p class="sub">ඔබ අතින් වියදම් කළ මුදලක් ලැබීමට ඇත.</p>` : ''}</div><button type="button" class="btn primary" data-give>${icon('hand')} භාර දෙන්න</button></section>
      ${inbox.length ? html`<h2 class="sec">ඔබ තහවුරු කළ යුතුයි</h2>${inbox.map(x => html`<section class="card confirm"><p><b>${userName(x.fromId)}</b> → <b>${userName(x.toId)}</b></p><h2>${rs(x.amount)}</h2><p class="sub">${fmtDate(x.date)}${x.note ? ` · ${x.note}` : ''}</p><button type="button" class="btn primary huge" data-ok="${x.id}">${icon('check')} මුදල ලැබුණා</button></section>`)}` : ''}
      ${rest.length ? html`<h2 class="sec">තහවුරු කරන තුරු</h2><div class="list card0">${rest.map(x => row(x, true))}</div>` : ''}
      <h2 class="sec">මුදල් තිබෙන තැන්</h2>
      <div class="list card0">${people.map(([id, v]) => html`<div class="row">${icon(id === BANK ? 'bank' : 'people', 'lead-i')}<span class="grow"><b>${userName(id)}</b></span><strong class="${v < 0 ? 'neg' : ''}">${rs(v)}</strong></div>`)}<div class="row total"><span class="grow"><b>එකතුව</b></span><strong>${rs(total)}</strong></div></div>
      <h2 class="sec">අරමුදල්</h2>
      <div class="stats">${funds.map(([f, v]) => stat(FUNDS[f], v, 'bal'))}</div>
      <p class="banner ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'alert')}<span>${ok ? 'අත ඇති මුදල් සහ අරමුදල් ගිණුම් හරියටම ගැළපේ.' : 'ගිණුම් ගැළපෙන්නේ නැහැ. ඉතිහාසය පරීක්ෂා කරන්න.'}</span></p>
      ${isAdmin() ? html`<div class="stack"><button type="button" class="btn ghost" data-opening>${icon('plus')} මුල් ඉතිරිය (පොතේ තිබූ මුදල)</button><button type="button" class="btn ghost" data-transfer>${icon('swap')} අරමුදල් අතර මාරු කරන්න</button><button type="button" class="btn ghost" data-withdraw>${icon('bank')} බැංකුවෙන් මුදල් ගත්තා</button></div>` : ''}
      ${listOf('මුල් ඉතිරි', all('openings'), x => `${FUNDS[x.fund]} · ${userName(x.holder)}`, 'openings')}
      ${listOf('අරමුදල් මාරු', all('transfers'), x => `${FUNDS[x.fromFund]} → ${FUNDS[x.toFund]}`, 'transfers')}
      ${done.length ? html`<details class="more"><summary>පසුගිය භාරදීම් (${done.length})</summary><div class="list card0">${done.map(x => row(x, isAdmin()))}</div></details>` : ''}`,
    mount(el) {
      on(el, 'click', '[data-give]', () => give(mine));
      on(el, 'click', '[data-ok]', async b => {
        const x = byId('handovers', b.dataset.ok);
        if (!(await confirmBox('මුදල ලැබුණාද?', `${userName(x.fromId)} වෙතින් ${rs(x.amount)}`, { ok: 'ඔව්, ලැබුණා' }))) return;
        await put('handovers', x.id, { status: 'confirmed' });
        toast('තහවුරු කළා');
      });
      on(el, 'click', '[data-ho]', async b => { const x = byId('handovers', b.dataset.ho); delWithUndo('handovers', x, `${userName(x.fromId)} → ${userName(x.toId)} ${rs(x.amount)}`); });
      on(el, 'click', '[data-x]', b => { const [t, id] = b.dataset.x.split(':'); const x = byId(t, id); delWithUndo(t, x, rs(x.amount)); });
      on(el, 'click', '[data-opening]', () => formSheet({
        title: 'මුල් ඉතිරිය', intro: 'App එක පටන් ගන්නා විට පොතේ තිබූ මුදල මෙහි එක් වරක් ඇතුළත් කරන්න.',
        fields: [{ key: 'fund', label: 'අරමුදල', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'poya' }, { key: 'holder', label: 'මුදල් තිබෙන්නේ කා ළඟද?', type: 'select', required: true, options: holders(), value: me().id }, { key: 'amount', label: 'මුදල', type: 'money', required: true }, dateField(), { key: 'note', label: 'සටහන' }],
        onSave: async v => { await put('openings', null, v); toast('සුරැකුණා'); },
      }));
      on(el, 'click', '[data-transfer]', () => formSheet({
        title: 'අරමුදල් මාරුව',
        fields: [{ key: 'fromFund', label: 'මෙයින්', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'poya' }, { key: 'toFund', label: 'මෙයට', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'annual', check: (v, o) => (v === o.fromFund ? 'වෙනත් අරමුදලක් තෝරන්න.' : '') }, { key: 'amount', label: 'මුදල', type: 'money', required: true }, dateField(), { key: 'note', label: 'හේතුව' }],
        onSave: async v => { await put('transfers', null, v); toast('සුරැකුණා'); },
      }));
      on(el, 'click', '[data-withdraw]', () => formSheet({
        title: 'බැංකුවෙන් මුදල් ගත්තා',
        fields: [{ key: 'toId', label: 'ගත්තේ කවුද?', type: 'select', required: true, options: activeUsers().map(u => [u.id, u.name]), value: me().id }, { key: 'amount', label: 'මුදල', type: 'money', required: true }, dateField(), { key: 'note', label: 'සටහන' }],
        onSave: async v => { await put('handovers', null, { ...v, fromId: BANK, status: 'confirmed' }); toast('සුරැකුණා'); },
      }));
    },
  };
}
const row = (x, del) => html`<div class="row"><span class="grow"><b>${userName(x.fromId)} → ${userName(x.toId)}</b><small>${fmtDate(x.date)}${x.status === 'pending' ? ' · තහවුරු කර නැත' : ''}${x.note ? ` · ${x.note}` : ''}</small></span><strong>${rs(x.amount)}</strong>${del && (isAdmin() || (x.status === 'pending' && x.fromId === me().id)) ? html`<button type="button" class="iconbtn" data-ho="${x.id}" aria-label="මකන්න">${icon('trash')}</button>` : ''}</div>`;
const listOf = (title, rows, sub, table) => rows.length ? html`<details class="more"><summary>${title} (${rows.length})</summary><div class="list card0">${rows.map(x => html`<div class="row"><span class="grow"><b>${rs(x.amount)}</b><small>${sub(x)} · ${fmtDate(x.date)}${x.note ? ` · ${x.note}` : ''}</small></span>${isAdmin() ? html`<button type="button" class="iconbtn" data-x="${table}:${x.id}" aria-label="මකන්න">${icon('trash')}</button>` : ''}</div>`)}</div></details>` : '';

function give(mine) {
  const admins = activeUsers().filter(u => u.role === 'admin' && u.id !== me().id);
  const opts = holders().filter(([id]) => id !== me().id);
  return formSheet({
    title: 'මුදල් භාර දෙන්න', intro: 'මුදල ලැබෙන කෙනා app එකෙන් තහවුරු කරන තුරු එය ඔබ අත ඇති ලෙස පෙනේ.', saveLabel: 'භාර දුන්නා',
    fields: [
      { key: 'toId', label: 'කාටද දෙන්නේ?', type: 'select', required: true, options: opts, value: admins[0]?.id || opts[0]?.[0] },
      { key: 'amount', label: 'මුදල', type: 'money', required: true, quick: mine > 0 ? [mine] : undefined },
      dateField(), { key: 'note', label: 'සටහන' },
    ],
    onSave: async v => {
      if (v.amount > mine && !(await confirmBox('මුදල වැඩියි', `ඔබ අත ඇත්තේ ${rs(mine)} පමණි. එහෙත් ${rs(v.amount)} භාර දෙනවාද?`))) return false;
      await put('handovers', null, { ...v, fromId: me().id, status: 'pending' });
      toast('සටහන් කළා. ලබන්නා තහවුරු කළ යුතුයි.');
    },
  });
}

/* ---------------- expenses ---------------- */
export const CATS = ['බඩු මලු', 'ප්‍රවාහනය', 'දන්සැල', 'සැරසිලි', 'ධර්ම දේශනාව', 'පූජා භාණ්ඩ', 'කුලී', 'වෙනත්'];
export function expenseForm(ev, x = {}, preset = {}) {
  const tasks = all('tasks').filter(t => t.eventId === ev.id);
  return formSheet({
    title: x.id ? 'වියදම' : 'අලුත් වියදමක්', value: { ...preset, ...x },
    fields: [
      { key: 'title', label: 'මොකටද වියදම් කළේ?', required: true, placeholder: 'උදා: හාල් කිලෝ 100' },
      { key: 'amount', label: 'මුදල', type: 'money', required: true },
      { key: 'category', label: 'වර්ගය', type: 'choice', options: CATS.map(c => [c, c]), value: ev.type === 'poya' ? CATS[0] : 'වෙනත්' },
      ...(tasks.length ? [{ key: 'taskId', label: 'අදාළ කාර්යය', type: 'select', options: tasks.map(t => [t.id, t.title]) }] : []),
      { key: 'paidBy', label: 'මුදල් ගෙව්වේ කාගේ අතින්ද?', type: 'select', required: true, options: holders(), value: me().id },
      dateField(),
      { key: 'shop', label: 'කඩය', list: all('expenses').map(e => e.shop) }, { key: 'billNo', label: 'බිල් අංකය' }, { key: 'note', label: 'සටහන' },
    ],
    onSave: async v => { await put('expenses', x.id, { ...v, eventId: ev.id }); toast('සුරැකුණා'); },
    onDelete: x.id ? () => delWithUndo('expenses', x, `${x.title} — ${rs(x.amount)}`) : null,
  });
}
export function expenses() {
  const ev = activeEvent();
  if (!ev) return { title: 'වියදම්', back: 'more', body: empty('bill', 'තවම පින්කමක් නැහැ.') };
  const list = all('expenses').filter(x => x.eventId === ev.id).sort((a, b) => b.date.localeCompare(a.date));
  const st = eventStats(S.db, ev.id);
  const can = isAdmin() && ev.status !== 'closed';
  return {
    title: 'වියදම්', back: 'more',
    body: html`${eventBar(ev)}<div class="stats">${stat('එකතුව', st.total, 'in')}${stat('වියදම', st.spent, 'out')}</div>
      ${can ? html`<button type="button" class="btn primary huge" data-add>${icon('plus')} වියදමක් සටහන් කරන්න</button>` : ''}
      ${list.length ? html`<div class="list card0">${list.map(x => html`<button type="button" class="row" data-x="${x.id}" ${can ? '' : 'disabled'}>${icon('bill', 'lead-i')}<span class="grow"><b>${x.title}</b><small>${[x.category, fmtDate(x.date), userName(x.paidBy), x.shop, x.billNo && `බිල් ${x.billNo}`].filter(Boolean).join(' · ')}</small></span><strong>${rs(x.amount)}</strong></button>`)}</div>` : empty('bill', 'තවම වියදම් සටහන් කර නැහැ.')}
      ${!isAdmin() ? html`<p class="sub center">වියදම් සටහන් කරන්නේ ප්‍රධාන අයයි.</p>` : ''}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-add]', () => expenseForm(ev));
      if (can) on(el, 'click', '[data-x]', b => expenseForm(ev, byId('expenses', b.dataset.x)));
    },
  };
}

/* ---------------- pledges ---------------- */
export function pledges() {
  const ev = activeEvent();
  if (!ev) return { title: 'පොරොන්දු මුදල්', back: 'more', body: empty('gift', 'තවම පින්කමක් නැහැ.') };
  const list = pledgeStatus(S.db, ev.id).sort((a, b) => b.due - a.due);
  const due = list.reduce((s, p) => s + p.due, 0);
  const edit = (p = {}) => formSheet({
    title: p.id ? 'පොරොන්දුව' : 'අලුත් පොරොන්දුවක්', value: p,
    fields: [{ key: 'memberId', label: 'කවුද?', type: 'member', required: true }, { key: 'amount', label: 'පොරොන්දු වූ මුදල', type: 'money', required: true, quick: [500, 1000, 2000, 5000] }, { key: 'note', label: 'සටහන' }],
    onSave: async v => { await put('pledges', p.id, { ...v, eventId: ev.id, cancelled: false }); toast('සුරැකුණා'); },
    onDelete: p.id ? () => delWithUndo('pledges', p, `${memberName(p.memberId)} — ${rs(p.amount)}`) : null,
  });
  return {
    title: 'පොරොන්දු මුදල්', back: 'more',
    body: html`${eventBar(ev)}<div class="stats">${stat('පොරොන්දු', list.reduce((s, p) => s + Number(p.pledge.amount), 0))}${stat('ලැබීමට ඇත', due, due ? 'out' : '')}</div>
      ${ev.status !== 'closed' ? html`<button type="button" class="btn primary huge" data-add>${icon('plus')} පොරොන්දුවක් සටහන් කරන්න</button>` : ''}
      ${list.length ? html`<div class="list card0">${list.map(p => html`<div class="row"><button type="button" class="rowbtn" data-p="${p.pledge.id}"><b>${memberName(p.pledge.memberId)}</b><small>${rs(p.pledge.amount)}${p.given ? ` · දුන්නා ${rs(p.given)}` : ''}</small></button>${p.due > 0 ? html`<a class="btn mini" href="#/donate?m=${p.pledge.memberId}">දුන්නා</a>` : html`<span class="okmark">✓</span>`}</div>`)}</div>
      ${due ? html`<a class="btn wa" href="#/queue?kind=pledge&e=${ev.id}">${icon('chat')} මතක් කිරීම් යවන්න</a>` : ''}` : empty('gift', 'පොරොන්දු වූ අය මෙහි පෙනේවි. මුදල ලැබුණු විට ඉබේම සලකුණු වේ.')}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-add]', () => edit());
      on(el, 'click', '[data-p]', b => edit(byId('pledges', b.dataset.p)));
    },
  };
}

/* ---------------- on someone's behalf ---------------- */
export function behalf() {
  const open = openDebts(S.db).sort((a, b) => a.date.localeCompare(b.date));
  const done = all('donations').filter(d => d.payerId && d.settled).sort((a, b) => b.settledAt.localeCompare(a.settledAt));
  return {
    title: 'වෙනුවෙන් ගෙවීම්', back: 'more',
    body: html`<p class="lead">කෙනෙක් වෙනුවෙන් තව කෙනෙක් දුන් මුදල් — ඒවා එකිනෙකා අතර පියවා ගත යුතුයි. සංසදයේ ගිණුමට මුදල ලැබී ඇත.</p>
      ${open.length ? html`${open.map(d => html`<section class="card debt"><div class="flow"><span><small>දිය යුතු</small><b>${memberName(d.memberId)}</b></span>${icon('next')}<span><small>ලැබිය යුතු</small><b>${memberName(d.payerId)}</b></span></div><h2>${rs(d.amount)}</h2><p class="sub">${byId('events', d.eventId)?.title} · ${fmtDate(d.date)}</p><div class="two"><a class="btn ghost" href="#/donation?id=${d.id}">${icon('chat')} පණිවිඩ</a><button type="button" class="btn primary" data-s="${d.id}">${icon('check')} පියෙව්වා</button></div></section>`)}
      <a class="btn wa" href="#/queue?kind=behalfRemind">${icon('chat')} පියවීම මතක් කරන්න</a>` : empty('check', 'පියවීමට ඇති මුදල් නැහැ.')}
      ${done.length ? html`<details class="more"><summary>පියවූ ඒවා (${done.length})</summary><div class="list card0">${done.map(d => html`<a class="row" href="#/donation?id=${d.id}"><span class="okmark">✓</span><span class="grow"><b>${memberName(d.memberId)} → ${memberName(d.payerId)}</b><small>${fmtDate(d.settledAt)}</small></span><strong>${rs(d.amount)}</strong></a>`)}</div></details>` : ''}`,
    mount(el) {
      on(el, 'click', '[data-s]', async b => {
        const id = b.dataset.s;
        await put('donations', id, { settled: true, settledAt: today() });
        toast('පියවූ බව සටහන් කළා', { undo: () => put('donations', id, { settled: false, settledAt: '' }) });
      });
    },
  };
}

