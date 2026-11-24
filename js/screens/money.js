// Cash in hand, expenses and pledges.
import { S, all, me, treasurerId, byId, put, remove, isAdmin, memberName, userName, activeUsers } from '../store.js';
import { html, rs, fmtDate } from '../util.js';
import { holdings, fundBalance, FUNDS, BANK, pledgeStatus, eventStats } from '../calc.js';
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

/* ---------------- cash in hand: everybody sees everybody ---------------- */
/** Who holds how much. Shared by the home page and the cash page. */
export function cashList(h) {
  const t = treasurerId();
  const rows = Object.entries(h).filter(([id, v]) => v !== 0 || (id !== BANK && activeUsers().some(u => u.id === id)))
    .sort((x, y) => (x[0] === BANK) - (y[0] === BANK) || (y[0] === t) - (x[0] === t) || y[1] - x[1]);
  const total = rows.reduce((s, [, v]) => s + Math.round(v * 100), 0) / 100;
  return html`<div class="list card0">${rows.map(([id, v]) => html`<div class="row ${id === me().id ? 'mine-row' : ''}">${icon(id === BANK ? 'bank' : 'people', 'lead-i')}<span class="grow"><b>${userName(id)}${id === me().id ? ' (ඔබ)' : ''}</b>${id === t ? html`<small>භාණ්ඩාගාරික</small>` : ''}${v < 0 ? html`<small>තමන් අතින් වියදම් කළ මුදල</small>` : ''}</span><strong class="${v < 0 ? 'neg' : ''}">${rs(v)}</strong></div>`)}<div class="row total"><span class="grow"><b>එකතුව</b></span><strong>${rs(total)}</strong></div></div>`;
}
export function cash() {
  const h = holdings(S.db, S.users.map(u => u.id), treasurerId());
  const total = Object.values(h).reduce((s, v) => s + Math.round(v * 100), 0);
  const funds = Object.keys(FUNDS).map(f => [f, fundBalance(S.db, f)]);
  const ok = total === Math.round(funds.reduce((s, [, v]) => s + v, 0) * 100);
  return {
    title: 'අත ඇති මුදල්', back: 'more',
    body: html`
      ${cashList(h)}
      <p class="sub">එකතු කළ මුදලින් වියදම් අඩු කර ඉබේම ගණනය වේ. පින්කමේ ගිණුම් වැසූ විට ඉතිරිය භාණ්ඩාගාරික${treasurerId() ? ` (${userName(treasurerId())})` : ''} ළඟ ඇති ලෙස පෙනේ.</p>
      <h2 class="sec">අරමුදල්</h2>
      <div class="stats">${funds.map(([f, v]) => stat(FUNDS[f], v, 'bal'))}</div>
      <p class="banner ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'alert')}<span>${ok ? 'අත ඇති මුදල් සහ අරමුදල් ගිණුම් හරියටම ගැළපේ.' : 'ගිණුම් ගැළපෙන්නේ නැහැ. ඉතිහාසය පරීක්ෂා කරන්න.'}</span></p>
      ${isAdmin() ? html`<div class="stack"><button type="button" class="btn ghost" data-opening>${icon('plus')} මුල් ඉතිරිය (පොතේ තිබූ මුදල)</button><button type="button" class="btn ghost" data-transfer>${icon('swap')} අරමුදල් අතර මාරු කරන්න</button></div>` : ''}
      ${listOf('මුල් ඉතිරි', all('openings'), x => `${FUNDS[x.fund]} · ${x.holder === BANK ? 'බැංකු ගිණුම' : 'අතේ'}`, 'openings')}
      ${listOf('අරමුදල් මාරු', all('transfers'), x => `${FUNDS[x.fromFund]} → ${FUNDS[x.toFund]}`, 'transfers')}`,
    mount(el) {
      on(el, 'click', '[data-x]', b => { const [t, id] = b.dataset.x.split(':'); const x = byId(t, id); delWithUndo(t, x, rs(x.amount)); });
      on(el, 'click', '[data-opening]', () => formSheet({
        title: 'මුල් ඉතිරිය', intro: 'App එක පටන් ගන්නා විට පොතේ තිබූ මුදල මෙහි එක් වරක් ඇතුළත් කරන්න.',
        fields: [{ key: 'fund', label: 'අරමුදල', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'poya' }, { key: 'holder', label: 'මුදල් තිබෙන්නේ කොහේද?', type: 'choice', required: true, options: [[treasurerId(), `අතේ (${userName(treasurerId())})`], [BANK, 'බැංකුවේ']], value: treasurerId() }, { key: 'amount', label: 'මුදල', type: 'money', required: true }, dateField(), { key: 'note', label: 'සටහන' }],
        onSave: async v => { await put('openings', null, v); toast('සුරැකුණා'); },
      }));
      on(el, 'click', '[data-transfer]', () => formSheet({
        title: 'අරමුදල් මාරුව',
        fields: [{ key: 'fromFund', label: 'මෙයින්', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'poya' }, { key: 'toFund', label: 'මෙයට', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'annual', check: (v, o) => (v === o.fromFund ? 'වෙනත් අරමුදලක් තෝරන්න.' : '') }, { key: 'amount', label: 'මුදල', type: 'money', required: true }, dateField(), { key: 'note', label: 'හේතුව' }],
        onSave: async v => { await put('transfers', null, v); toast('සුරැකුණා'); },
      }));
    },
  };
}
const listOf = (title, rows, sub, table) => rows.length ? html`<details class="more"><summary>${title} (${rows.length})</summary><div class="list card0">${rows.map(x => html`<div class="row"><span class="grow"><b>${rs(x.amount)}</b><small>${sub(x)} · ${fmtDate(x.date)}${x.note ? ` · ${x.note}` : ''}</small></span>${isAdmin() ? html`<button type="button" class="iconbtn" data-x="${table}:${x.id}" aria-label="මකන්න">${icon('trash')}</button>` : ''}</div>`)}</div></details>` : '';

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
      { key: 'paidBy', label: 'මුදල් ගෙව්වේ කාගේ අතින්ද?', type: 'select', required: true, options: holders(), value: treasurerId() || me().id },
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
