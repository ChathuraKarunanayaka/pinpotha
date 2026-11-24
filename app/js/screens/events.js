// Events (poya and anniversary), parcel list, task plan with budget, and delivery.
import { S, batch, all, userName, canManage, byId, put, remove, isAdmin } from '../store.js';
import { html, rs, fmtDateLong, fmtDate, today, daysTo, inDays, uid, byName, waNumber } from '../util.js';
import { FUNDS, fundLedger, eventStats, parcelTotals, plannedParcels, taskSpend, lastDelivered } from '../calc.js';
import { icon, on, toast, formSheet, sheet, empty, stat, bar, confirmBox } from '../ui.js';
import { POYA, poyaId } from '../poya.js';
import { activeEvent, eventBar, wireEventBar, chooseEvent, addPoya } from './home.js';
import { expenseForm } from './money.js';
import { mapLink } from './people.js';
import { shareText, shopListText } from '../messages.js';
import { go, render } from '../main.js';

const closed = ev => ev.status === 'closed';
const noEvent = (title, ic) => ({ title, back: 'more', body: empty(ic, 'තවම පින්කමක් නැහැ.', html`<a class="btn primary" href="#/events">පින්කම් බලන්න</a>`) });

/* ---------------- list + detail ---------------- */
export function events() {
  const list = all('events').sort((a, b) => a.date.localeCompare(b.date));
  const up = list.filter(e => e.date >= today() || e.status === 'open'), past = list.filter(e => !up.includes(e)).reverse();
  const have = new Set(list.map(e => e.id)), dates = new Set(list.filter(e => e.type === 'poya').map(e => e.date));
  const missing = POYA.filter(([d]) => d >= today() && !have.has(poyaId(d)) && !dates.has(d));
  const row = e => html`<a class="row" href="#/event?id=${e.id}">${icon(e.type === 'poya' ? 'calendar' : 'lotus', 'lead-i')}<span class="grow"><b>${e.title}</b><small>${fmtDateLong(e.date)}${closed(e) ? ' · වසා ඇත' : ` · ${inDays(daysTo(e.date))}`}</small></span>${icon('next')}</a>`;
  return {
    title: 'පින්කම්', back: 'more',
    body: html`${isAdmin() ? html`<div class="stack">${missing.length ? html`<button type="button" class="btn primary" data-poya>${icon('calendar')} ඉදිරි පොහොය දින ${missing.length}ක් එක් කරන්න</button>` : ''}<button type="button" class="btn ghost" data-add>${icon('plus')} සංවත්සර / වෙනත් පින්කමක්</button></div>` : ''}
      ${up.length ? html`<h2 class="sec">ඉදිරි / විවෘත</h2><div class="list card0">${up.map(row)}</div>` : empty('calendar', 'තවම පින්කම් නැහැ.')}
      ${past.length ? html`<h2 class="sec">අවසන් වූ</h2><div class="list card0">${past.map(row)}</div>` : ''}`,
    mount(el) {
      on(el, 'click', '[data-poya]', async () => { await batch(async () => { for (const p of missing) await addPoya(p); }); toast(`පොහොය දින ${missing.length}ක් එක් කළා`); });
      on(el, 'click', '[data-add]', () => eventForm());
    },
  };
}
function eventForm(e = {}) {
  return formSheet({
    title: e.id ? 'පින්කම වෙනස් කරන්න' : 'අලුත් පින්කමක්', value: e,
    fields: [
      { key: 'type', label: 'වර්ගය', type: 'choice', required: true, options: [['annual', 'සංවත්සර පින්කම'], ['poya', 'පොහොය පින්කම'], ['other', 'වෙනත්']], value: 'annual' },
      { key: 'title', label: 'නම', required: true, placeholder: 'උදා: සංවත්සර ධර්ම දේශනාව 2027' },
      { key: 'date', label: 'දිනය', type: 'date', required: true },
      { key: 'fund', label: 'අරමුදල', type: 'choice', required: true, options: Object.entries(FUNDS), value: 'annual' },
      { key: 'parcels', label: 'මලු ගණන', type: 'number', hint: 'හිස්ව තැබුවොත් බෙදාහැරීමේ ලැයිස්තුවෙන් ගණන් ගනී.' },
      { key: 'note', label: 'සටහන', type: 'textarea', rows: 2 },
    ],
    onSave: async v => { const id = await put('events', e.id, { status: 'open', ...(e.id ? { status: e.status } : {}), ...v }); chooseEvent(id); toast('සුරැකුණා'); },
    onDelete: e.id ? async () => {
      if (!(await confirmBox('මකන්නද?', e.title, { ok: 'මකන්න', danger: true }))) return false;
      if (all('donations').some(d => d.eventId === e.id) || all('expenses').some(x => x.eventId === e.id)) { toast('මුදල් සටහන් ඇති නිසා මැකිය නොහැක.', { bad: true }); return false; }
      go('events', true);
      await remove('events', e.id);
      toast('මැකුවා', { undo: () => put('events', e.id, { deleted: false }) });
      return true;
    } : null,
  });
}
export function eventDetail({ id }) {
  const ev = byId('events', id);
  if (!ev || ev.deleted) return null;
  const row = fundLedger(S.db, ev.fund).find(r => r.event.id === id);
  const st = eventStats(S.db, id);
  const tasksN = all('tasks').filter(t => t.eventId === id), dl = all('deliveries').filter(d => d.eventId === id);
  const links = [
    ['collection', 'coins', 'එකතු වූ මුදල්', `${st.donors.size} දෙනෙක්`], ['expenses', 'bill', 'වියදම්', rs(st.spent)], ['pledges', 'gift', 'පොරොන්දු', ''],
    ['tasks', 'check', 'කාර්යයන් සහ අයවැය', tasksN.length ? `${tasksN.filter(t => t.status === 'done').length}/${tasksN.length} අවසන්` : ''],
    ['parcels', 'bag', 'මල්ලේ ලැයිස්තුව', plannedParcels(S.db, ev) ? `මලු ${plannedParcels(S.db, ev)}` : ''], ['delivery', 'truck', 'බෙදාහැරීම', dl.length ? `${dl.filter(d => d.status === 'done').length}/${dl.length}` : ''],
    ['report', 'report', 'PDF වාර්තාව', ''], ['photos', 'camera', 'ඡායාරූප එකතුව', ''],
  ];
  return {
    title: 'පින්කම', back: 'events',
    body: html`<section class="card detail"><h2>${ev.title}</h2><p class="lead">${fmtDateLong(ev.date)}${closed(ev) ? html` <span class="tag">${icon('lock')} වසා ඇත</span>` : ''}</p>${ev.note ? html`<p class="sub">${ev.note}</p>` : ''}
        <table class="ledger"><tr><td>පෙර ශේෂය</td><td>${rs(row.brought)}</td></tr>${row.transfer ? html`<tr><td>අරමුදල් මාරු</td><td>${rs(row.transfer)}</td></tr>` : ''}<tr><td>+ එකතු වූ මුදල</td><td>${rs(row.income)}</td></tr><tr><td>− වියදම</td><td>${rs(row.spent)}</td></tr><tr class="sum"><td>ඉදිරියට ගෙන යන ඉතිරිය</td><td>${rs(row.balance)}</td></tr></table><p class="sub">${FUNDS[ev.fund]}</p></section>
      <div class="list card0">${links.map(([r, ic, t, s]) => html`<button type="button" class="row" data-open="${r}">${icon(ic, 'lead-i')}<span class="grow"><b>${t}</b></span><small>${s}</small>${icon('next')}</button>`)}</div>
      <a class="btn wa" href="#/group?e=${id}&t=finance">${icon('share')} ගිණුම් සාරාංශය group එකට</a>
      ${isAdmin() ? html`<div class="stack">${closed(ev) ? html`<button type="button" class="btn ghost" data-reopen>${icon('lock')} නැවත විවෘත කරන්න</button>` : html`<button type="button" class="btn ghost" data-edit>${icon('edit')} වෙනස් කරන්න</button><button type="button" class="btn ghost" data-close-ev>${icon('lock')} ගිණුම් වසන්න</button>`}</div>` : ''}`,
    mount(el) {
      on(el, 'click', '[data-open]', b => { chooseEvent(id); go(b.dataset.open); });
      on(el, 'click', '[data-edit]', () => eventForm(ev));
      on(el, 'click', '[data-close-ev]', async () => {
        const warn = [];
        const held = Object.entries(eventStats(S.db, id).byCollector).filter(([, v]) => v > 0);
        if (held.length) warn.push(`මෙම මුදල් පොදු අරමුදලට ලැබී ඇතිදැයි බලන්න: ${held.map(([u, v]) => `${userName(u)} ${rs(v)}`).join(', ')}.`);
        const left = dl.filter(d => d.status === 'planned').length;
        if (left) warn.push(`තවම භාර නොදුන් පවුල් ${left}ක් ඇත.`);
        if (!(await confirmBox('ගිණුම් වසන්නද?', `${warn.join(' ')} වැසූ පසු මෙම පින්කමේ මුදල් වෙනස් කළ නොහැක. ඉතිරි ${rs(row.balance)} පොදු අරමුදලේ ඊළඟ පින්කමට යයි.`, { ok: 'වසන්න', cancel: 'තවම නැහැ' }))) return;
        await put('events', id, { status: 'closed' });
        toast('ගිණුම් වැසුවා', { undo: () => put('events', id, { status: 'open' }) });
      });
      on(el, 'click', '[data-reopen]', async () => { await put('events', id, { status: 'open' }); toast('නැවත විවෘත කළා'); });
    },
  };
}

/** Events of the same type before this one, newest first — the source for "copy last time". */
const previous = ev => all('events').filter(e => e.id !== ev.id && e.type === ev.type && e.date < ev.date).sort((a, b) => b.date.localeCompare(a.date));
const lastWith = (ev, table) => previous(ev).find(e => all(table).some(r => r.eventId === e.id));

/* ---------------- parcels ---------------- */
export function parcels() {
  const ev = activeEvent();
  if (!ev) return noEvent('මල්ලේ ලැයිස්තුව', 'bag');
  const n = plannedParcels(S.db, ev);
  const t = parcelTotals(S.db, ev.id, n);
  const can = canManage() && !closed(ev);
  const src = lastWith(ev, 'parcelItems');
  const edit = (i = {}) => formSheet({
    title: i.id ? 'බඩුව' : 'බඩුවක් එක් කරන්න', value: i,
    fields: [{ key: 'name', label: 'බඩුව', required: true, placeholder: 'උදා: හාල්', list: all('parcelItems').map(x => x.name) }, { key: 'qty', label: 'එක මල්ලකට ප්‍රමාණය', type: 'number', required: true }, { key: 'unit', label: 'ඒකකය', placeholder: 'kg / පැකට් / කැට', list: ['kg', 'පැකට්', 'කැට', 'බෝතල්', 'ටින්', 'g'] }, { key: 'price', label: 'එක ඒකකයක මිල', type: 'money' }],
    onSave: async v => { await put('parcelItems', i.id, { ...v, eventId: ev.id, sort: i.sort ?? t.items.length, bought: i.bought || false }); toast('සුරැකුණා'); },
    onDelete: i.id ? async () => { await remove('parcelItems', i.id); toast('මැකුවා', { undo: () => put('parcelItems', i.id, { deleted: false }) }); return true; } : null,
  });
  return {
    title: 'මල්ලේ ලැයිස්තුව', back: 'more',
    body: html`${eventBar(ev)}
      <div class="stats">${stat('මලු ගණන', String(n || 0))}${stat('එක මල්ලක්', t.perParcel)}${stat('මුළු ඇස්තමේන්තුව', t.total, 'out')}${stat('එකතු වූ මුදල + ශේෂය', fundLedger(S.db, ev.fund).find(r => r.event.id === ev.id).brought + eventStats(S.db, ev.id).total, 'in')}</div>
      ${can ? html`<div class="two"><button type="button" class="btn primary" data-add>${icon('plus')} බඩුවක්</button><button type="button" class="btn ghost" data-count>${icon('edit')} මලු ගණන</button></div>` : ''}
      ${t.items.length ? html`<div class="list card0">${t.items.map(({ item, qty, cost }) => html`<div class="row"><label class="tick"><input type="checkbox" data-b="${item.id}" ${item.bought ? 'checked' : ''} ${closed(ev) ? 'disabled' : ''} aria-label="${item.name} ගත්තා"><span></span></label><button type="button" class="rowbtn ${item.bought ? 'struck' : ''}" data-i="${item.id}" ${can ? '' : 'disabled'}><b>${item.name}</b><small>මල්ලකට ${item.qty} ${item.unit}${item.price ? ` · ${rs(item.price)}` : ''}</small></button><span class="right"><strong>${qty} ${item.unit}</strong><small>${cost ? rs(cost) : ''}</small></span></div>`)}</div>
        <button type="button" class="btn wa" data-share>${icon('share')} කඩේට ලැයිස්තුව යවන්න</button>`
        : empty('bag', 'තවම බඩු එක් කර නැහැ.', can && src ? html`<button type="button" class="btn ghost" data-copy>${icon('copy')} ${src.title} ලැයිස්තුව පිටපත් කරන්න</button>` : '')}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-add]', () => edit());
      if (can) on(el, 'click', '[data-i]', b => edit(byId('parcelItems', b.dataset.i)));
      on(el, 'change', '[data-b]', b => put('parcelItems', b.dataset.b, { bought: b.checked }));
      on(el, 'click', '[data-count]', () => formSheet({ title: 'මලු ගණන', value: ev, fields: [{ key: 'parcels', label: 'මලු කීයක් සූදානම් කරනවාද?', type: 'number', hint: 'හිස්ව තැබුවොත් බෙදාහැරීමේ ලැයිස්තුවෙන් ගණන් ගනී.' }], onSave: v => put('events', ev.id, { parcels: v.parcels }) }));
      on(el, 'click', '[data-copy]', async () => { for (const i of all('parcelItems').filter(x => x.eventId === src.id)) await put('parcelItems', uid(), { eventId: ev.id, name: i.name, unit: i.unit, qty: i.qty, price: i.price, sort: i.sort, bought: false }); toast('පිටපත් කළා. මිල ගණන් පරීක්ෂා කරන්න.'); });
      on(el, 'click', '[data-share]', async () => { if ((await shareText(shopListText(ev, t, n))) === 'copied') toast('Copy කළා. WhatsApp එකේ paste කරන්න.'); });
    },
  };
}

/* ---------------- tasks + budget ---------------- */
const TASK_STATUS = { todo: 'තවම නැහැ', doing: 'කරමින්', done: 'අවසන්' };
/** Starting points only — any task can be added, renamed or removed. */
const TASK_TEMPLATES = {
  'ධර්ම දේශනාව': ['ස්වාමින් වහන්සේට ආරාධනා කිරීම', 'ධර්ම මණ්ඩපය සූදානම් කිරීම', 'සැරසිලි කටයුතු', 'ශබ්ද විකාශන යන්ත්‍ර', 'වාහන පහසුකම්', 'ගිලන්පස පූජාව', 'ආසන සහ මඩු', 'පිරිකර පූජාව'],
  'දන්සැල': ['අමුද්‍රව්‍ය මිලදී ගැනීම', 'පිසීම', 'පිඟන් කෝප්ප / ඇසුරුම්', 'ජල පහසුකම්', 'සේවක කණ්ඩායම්', 'පිරිසිදු කිරීම', 'අවසර ලබා ගැනීම (PHI)'],
  'සංඝගත දානය': ['ස්වාමින් වහන්සේලාට ආරාධනා කිරීම', 'දානය පිළියෙල කිරීම', 'පිරිකර', 'ප්‍රවාහනය'],
  'පොදු': ['ප්‍රචාරණය / ආරාධනා පත්', 'ඡායාරූප', 'ස්තුති කිරීම', 'පිරිසිදු කිරීම'],
};
export function tasks() {
  const ev = activeEvent();
  if (!ev) return noEvent('කාර්යයන් සහ අයවැය', 'check');
  const can = canManage() && !closed(ev);
  const list = all('tasks').filter(t => t.eventId === ev.id).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due || '9').localeCompare(b.due || '9'));
  const budget = list.reduce((s, t) => s + Number(t.budget || 0), 0), st = eventStats(S.db, ev.id);
  const src = lastWith(ev, 'tasks');
  const edit = (t = {}) => formSheet({
    title: t.id ? 'කාර්යය' : 'අලුත් කාර්යයක්', value: t,
    fields: [{ key: 'title', label: 'කාර්යය', required: true }, { key: 'owner', label: 'භාර අය', list: [...S.users.map(u => u.name), ...all('members').map(m => m.name)] }, { key: 'budget', label: 'වෙන් කළ මුදල (අයවැය)', type: 'money' }, { key: 'due', label: 'අවසන් කළ යුතු දිනය', type: 'date' }, { key: 'status', label: 'තත්ත්වය', type: 'choice', required: true, options: Object.entries(TASK_STATUS), value: 'todo' }, { key: 'note', label: 'සටහන', type: 'textarea', rows: 2 }],
    onSave: async v => { await put('tasks', t.id, { ...v, eventId: ev.id }); toast('සුරැකුණා'); },
    onDelete: t.id ? async () => {
      if (all('expenses').some(x => x.taskId === t.id)) { toast('වියදම් සටහන් ඇති නිසා මැකිය නොහැක.', { bad: true }); return false; }
      await remove('tasks', t.id); toast('මැකුවා', { undo: () => put('tasks', t.id, { deleted: false }) }); return true;
    } : null,
  });
  const copyFrom = async () => { for (const t of all('tasks').filter(x => x.eventId === src.id)) await put('tasks', uid(), { eventId: ev.id, title: t.title, owner: t.owner, budget: t.budget, due: '', status: 'todo', note: t.note }); toast('පිටපත් කළා'); };
  return {
    title: 'කාර්යයන් සහ අයවැය', back: 'more',
    body: html`${eventBar(ev)}
      <div class="stats">${stat('අයවැය', budget)}${stat('වියදම', st.spent, 'out')}${stat('එකතු වූ මුදල', st.total, 'in')}${stat('කාර්යයන්', `${list.filter(t => t.status === 'done').length}/${list.length}`)}</div>
      ${can ? html`<div class="two"><button type="button" class="btn primary" data-add>${icon('plus')} කාර්යයක්</button><button type="button" class="btn ghost" data-tpl>${icon('copy')} සැකිල්ලෙන්</button></div>` : ''}
      ${list.length ? list.map(t => { const sp = taskSpend(S.db, t.id), over = t.budget && sp > t.budget, late = t.status !== 'done' && t.due && t.due < today(); return html`<section class="card task ${t.status}"><div class="top"><button type="button" class="rowbtn" data-t="${t.id}" ${can ? '' : 'disabled'}><b>${t.title}</b><small>${[t.owner && `භාර: ${t.owner}`, t.due && `${fmtDate(t.due)}${late ? ' — පමා වී ඇත' : ''}`].filter(Boolean).join(' · ')}</small></button><button type="button" class="tag st-${t.status}" data-st="${t.id}" ${closed(ev) ? 'disabled' : ''}>${TASK_STATUS[t.status]}</button></div>
        ${t.budget || sp ? html`<div class="budget ${over ? 'over' : ''}">${bar(sp, Number(t.budget) || sp)}<small>${rs(sp)} / ${t.budget ? rs(t.budget) : 'අයවැයක් නැත'}${over ? ' — අයවැය ඉක්මවා ඇත' : ''}</small></div>` : ''}
        ${can ? html`<button type="button" class="btn mini" data-exp="${t.id}">${icon('plus')} වියදමක්</button>` : ''}</section>`; })
        : empty('check', 'කළ යුතු දේ මෙහි එක් කරන්න — ධර්ම දේශනා, දන්සැල්, සැරසිලි ආදිය.', can && src ? html`<button type="button" class="btn ghost" data-copy>${icon('copy')} ${src.title} සැලසුම පිටපත් කරන්න</button>` : '')}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-add]', () => edit());
      if (can) on(el, 'click', '[data-t]', b => edit(byId('tasks', b.dataset.t)));
      on(el, 'click', '[data-st]', b => { const t = byId('tasks', b.dataset.st); put('tasks', t.id, { status: { todo: 'doing', doing: 'done', done: 'todo' }[t.status] }); });
      on(el, 'click', '[data-exp]', b => expenseForm(ev, {}, { taskId: b.dataset.exp, title: byId('tasks', b.dataset.exp).title }));
      on(el, 'click', '[data-copy]', copyFrom);
      on(el, 'click', '[data-tpl]', () => sheet({
        title: 'සැකිල්ලෙන් එක් කරන්න', cls: 'tall',
        body: html`<p class="lead">අවශ්‍ය ඒවා තෝරන්න. පසුව වෙනස් කළ හැක.</p>${Object.entries(TASK_TEMPLATES).map(([g, ts]) => html`<h2 class="sec">${g}</h2><div class="chips wrap">${ts.map(x => html`<label class="chip"><input type="checkbox" value="${x}"><span>${x}</span></label>`)}</div>`)}<div class="stack sticky"><button type="button" class="btn primary" data-ok>එක් කරන්න</button></div>`,
        mount: (b, close) => on(b, 'click', '[data-ok]', async () => {
          const picked = [...b.querySelectorAll('input:checked')].map(i => i.value).filter(x => !list.some(t => t.title === x));
          for (const title of picked) await put('tasks', null, { eventId: ev.id, title, owner: '', budget: '', due: '', status: 'todo', note: '' });
          close(); if (picked.length) toast(`කාර්යයන් ${picked.length}ක් එක් කළා`);
        }),
      }));
    },
  };
}

/* ---------------- delivery ---------------- */
let team = '';
export function delivery() {
  const ev = activeEvent();
  if (!ev) return noEvent('බෙදාහැරීම', 'truck');
  const can = canManage() && !closed(ev);
  const teams = all('teams').filter(t => t.eventId === ev.id).sort(byName);
  const list = all('deliveries').filter(d => d.eventId === ev.id);
  if (team && team !== 'none' && !teams.some(t => t.id === team)) team = '';
  const shown = list.filter(d => !team || (team === 'none' ? !d.teamId : d.teamId === team));
  const done = list.filter(d => d.status === 'done').length;
  const src = lastWith(ev, 'deliveries');
  const groups = {};
  shown.forEach(d => { const f = byId('families', d.familyId); if (f) (groups[f.area || 'වෙනත්'] ||= []).push({ d, f }); });
  const tm = teams.find(t => t.id === team);
  const teamForm = (t = {}) => formSheet({
    title: t.id ? 'කණ්ඩායම' : 'අලුත් කණ්ඩායමක්', value: t,
    fields: [{ key: 'name', label: 'කණ්ඩායමේ නම', required: true, value: `කණ්ඩායම ${teams.length + 1}` }, { key: 'people', label: 'යන අය', type: 'textarea', rows: 2 }, { key: 'vehicle', label: 'වාහනය' }, { key: 'note', label: 'සටහන' }],
    onSave: async v => { await put('teams', t.id, { ...v, eventId: ev.id }); toast('සුරැකුණා'); },
    onDelete: t.id ? async () => { for (const d of list.filter(x => x.teamId === t.id)) await put('deliveries', d.id, { teamId: '' }); await remove('teams', t.id); team = ''; toast('මැකුවා'); return true; } : null,
  });
  return {
    title: 'බෙදාහැරීම', back: 'more',
    body: html`${eventBar(ev)}
      ${list.length ? html`<div class="progress"><span><b>${done}</b> / ${list.length} පවුල් සඳහා භාර දී ඇත</span>${bar(done, list.length)}</div>` : ''}
      ${can ? html`<div class="two"><button type="button" class="btn primary" data-fam>${icon('plus')} පවුල් තෝරන්න</button><button type="button" class="btn ghost" data-team>${icon('people')} කණ්ඩායම්</button></div>` : ''}
      ${teams.length ? html`<div class="seg scroll"><button type="button" data-tm="" class="${team ? '' : 'on'}">සියල්ල</button>${teams.map(t => html`<button type="button" data-tm="${t.id}" class="${team === t.id ? 'on' : ''}">${t.name} (${list.filter(d => d.teamId === t.id).length})</button>`)}${list.some(d => !d.teamId) ? html`<button type="button" data-tm="none" class="${team === 'none' ? 'on' : ''}">තවම නැති (${list.filter(d => !d.teamId).length})</button>` : ''}</div>` : ''}
      ${tm ? html`<p class="banner">${icon('truck')}<span><b>${tm.people || 'යන අය සඳහන් නැත'}</b>${tm.vehicle ? ` · ${tm.vehicle}` : ''}</span>${can ? html`<button type="button" class="btn mini" data-tedit>${icon('edit')}</button>` : ''}</p>` : ''}
      ${Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'si')).map(([a, rows]) => html`<h2 class="sec">${icon('pin')} ${a} (${rows.length})</h2>${rows.sort((x, y) => byName(x.f, y.f)).map(({ d, f }) => html`<section class="card drop ${d.status}"><div class="top"><span class="grow"><b>${f.name}</b><small>${[f.address, f.people && `${f.people} දෙනෙක්`, `මලු ${d.parcels || 1}`].filter(Boolean).join(' · ')}</small>${d.teamId && !team ? html`<span class="tag">${byId('teams', d.teamId)?.name}</span>` : ''}${d.note ? html`<small class="note">${d.note}</small>` : ''}</span>${can ? html`<button type="button" class="iconbtn" data-dedit="${d.id}" aria-label="වෙනස් කරන්න">${icon('edit')}</button>` : ''}</div>
          <div class="acts">${mapLink(f) ? html`<a class="btn mini" target="_blank" rel="noopener noreferrer" href="${mapLink(f)}">${icon('pin')} සිතියම</a>` : ''}${waNumber(f.phone) ? html`<a class="btn mini" href="tel:+${waNumber(f.phone)}">${icon('phone')} අමතන්න</a>` : ''}
          ${closed(ev) ? html`<span class="okmark">${d.status === 'done' ? '✓' : ''}</span>` : html`<button type="button" class="btn ${d.status === 'done' ? 'okbtn' : 'primary'} mini grow" data-done="${d.id}">${icon('check')} ${d.status === 'done' ? 'භාර දුන්නා' : 'භාර දුන්නා කියා සලකුණු කරන්න'}</button>`}</div></section>`)}`)}
      ${list.length ? '' : empty('truck', 'මෙම පින්කමට පවුල් තවම තෝරා නැහැ.', can && src ? html`<button type="button" class="btn ghost" data-copy>${icon('copy')} ${src.title} කණ්ඩායම් සහ පවුල් පිටපත් කරන්න</button>` : '')}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-tm]', b => { team = b.dataset.tm; render({ keepScroll: true }); });
      on(el, 'click', '[data-team]', () => teamForm());
      on(el, 'click', '[data-tedit]', () => teamForm(tm));
      on(el, 'click', '[data-fam]', () => chooseFamilies(ev, teams));
      on(el, 'click', '[data-done]', b => {
        const d = byId('deliveries', b.dataset.done), was = { status: d.status, doneAt: d.doneAt || '' };
        put('deliveries', d.id, d.status === 'done' ? { status: 'planned', doneAt: '' } : { status: 'done', doneAt: new Date().toISOString() });
        toast(was.status === 'done' ? 'සලකුණ ඉවත් කළා' : `${byId('families', d.familyId).name} — භාර දුන්නා ✓`, { undo: () => put('deliveries', d.id, was) });
      });
      on(el, 'click', '[data-dedit]', b => { const d = byId('deliveries', b.dataset.dedit); formSheet({
        title: byId('families', d.familyId).name, value: d,
        fields: [{ key: 'teamId', label: 'කණ්ඩායම', type: 'select', options: teams.map(t => [t.id, t.name]) }, { key: 'parcels', label: 'මලු ගණන', type: 'number', required: true, value: 1 }, { key: 'note', label: 'සටහන', placeholder: 'උදා: කිරිපිටි අමතරව' }],
        onSave: async v => { await put('deliveries', d.id, v); toast('සුරැකුණා'); }, deleteLabel: 'මෙම පින්කමෙන් ඉවත් කරන්න',
        onDelete: async () => { await remove('deliveries', d.id); toast('ඉවත් කළා', { undo: () => put('deliveries', d.id, { deleted: false }) }); return true; },
      }); });
      on(el, 'click', '[data-copy]', async () => {
        const map = {};
        for (const t of all('teams').filter(x => x.eventId === src.id)) map[t.id] = await put('teams', uid(), { eventId: ev.id, name: t.name, people: t.people, vehicle: t.vehicle, note: t.note });
        for (const d of all('deliveries').filter(x => x.eventId === src.id && byId('families', x.familyId)?.status === 'approved')) await put('deliveries', dlId(ev, d.familyId), { eventId: ev.id, familyId: d.familyId, teamId: map[d.teamId] || '', parcels: d.parcels || 1, status: 'planned', doneAt: '', note: '', deleted: false });
        toast('පිටපත් කළා');
      });
    },
  };
}
/** One delivery per family per event, whoever adds it. */
const dlId = (ev, familyId) => `dl-${ev.id}-${familyId}`.slice(0, 80);

function chooseFamilies(ev, teams) {
  const last = lastDelivered(S.db);
  const inEv = new Set(all('deliveries').filter(d => d.eventId === ev.id).map(d => d.familyId));
  // Those who have waited longest come first, so nobody is forgotten and nobody is served twice by accident.
  const fams = all('families').filter(f => f.status === 'approved' && !inEv.has(f.id)).sort((a, b) => b.urgent - a.urgent || (last[a.id] || '').localeCompare(last[b.id] || '') || byName(a, b));
  return sheet({
    title: 'පවුල් තෝරන්න', cls: 'tall',
    body: fams.length ? html`<p class="lead">වැඩිම කාලයක් නොලැබූ පවුල් මුලින්ම පෙනේ.</p><div class="list card0">${fams.map(f => html`<label class="row check"><input type="checkbox" value="${f.id}"><span class="box"></span><span class="grow"><b>${f.name}${f.urgent ? html` <span class="tag bad">හදිසි</span>` : ''}</b><small>${[f.area, last[f.id] ? `අවසන් වරට ${fmtDate(last[f.id])}` : 'තවම ලබා දී නැත'].filter(Boolean).join(' · ')}</small></span></label>`)}</div>
      ${teams.length ? html`<div class="field"><label for="tsel">කණ්ඩායම <small>(අවශ්‍ය නම්)</small></label><select id="tsel"><option value="">— පසුව —</option>${teams.map(t => html`<option value="${t.id}">${t.name}</option>`)}</select></div>` : ''}<div class="stack sticky"><button type="button" class="btn primary" data-ok>එක් කරන්න</button></div>` : empty('house', 'එක් කිරීමට අනුමත පවුල් නැහැ.', html`<a class="btn primary" href="#/families" data-close>පවුල් ලේඛනයට</a>`),
    mount(b, close) {
      b.addEventListener('change', () => { const n = b.querySelectorAll('input:checked').length, k = b.querySelector('[data-ok]'); if (k) k.textContent = n ? `පවුල් ${n}ක් එක් කරන්න` : 'එක් කරන්න'; });
      on(b, 'click', '[data-ok]', async () => {
        const ids = [...b.querySelectorAll('input:checked')].map(i => i.value), teamId = b.querySelector('#tsel')?.value || '';
        await batch(async () => { for (const familyId of ids) await put('deliveries', dlId(ev, familyId), { eventId: ev.id, familyId, teamId, parcels: 1, status: 'planned', doneAt: '', note: '', deleted: false }); });
        close(); if (ids.length) toast(`පවුල් ${ids.length}ක් එක් කළා`);
      });
    },
  });
}
