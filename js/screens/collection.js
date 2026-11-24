// Who has given, who has not, and one donation in detail.
import { S, all, me, byId, put, remove, isAdmin, memberName, userName, activeUsers } from '../store.js';
import { html, rs, norm, byName, fmtDateLong, prettyPhone, today } from '../util.js';
import { eventStats } from '../calc.js';
import { icon, on, toast, formSheet, empty, stat, confirmBox } from '../ui.js';
import { activeEvent, eventBar, wireEventBar } from './home.js';
import { messageButtons, wireMessageButtons } from './donate.js';
import { pendingFor } from '../messages.js';
import { go, render } from '../main.js';

let view = 'given', query = '';

export function collection() {
  const ev = activeEvent();
  if (!ev) return { title: 'එකතුව', body: empty('coins', 'තවම පින්කමක් නැහැ.') };
  const st = eventStats(S.db, ev.id);
  const dons = all('donations').filter(d => d.eventId === ev.id).sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const waiting = all('members').filter(m => !m.inactive && !st.donors.has(m.id)).sort(byName);
  const by = Object.entries(st.byCollector).sort((a, b) => b[1] - a[1]);
  return {
    title: 'එකතුව',
    body: html`${eventBar(ev)}
      <div class="stats">${stat('මුළු එකතුව', st.total, 'in')}${stat('දායකයන්', `${st.donors.size} දෙනෙක්`)}${st.bank ? stat('අතට මුදල්', st.cash) : ''}${st.bank ? stat('බැංකුවට', st.bank) : ''}</div>
      ${by.length > 1 ? html`<p class="sub">${by.map(([u, a]) => `${userName(u)}: ${rs(a)}`).join(' · ')}</p>` : ''}
      <div class="seg"><button type="button" data-v="given" class="${view === 'given' ? 'on' : ''}">දුන් අය (${dons.length})</button><button type="button" data-v="wait" class="${view === 'wait' ? 'on' : ''}">තවම නැති අය (${waiting.length})</button></div>
      <div class="search">${icon('search')}<input type="search" placeholder="නම සොයන්න" value="${query}" aria-label="නම සොයන්න"></div>
      <div class="list card0" data-list></div>
      ${view === 'given' && dons.length ? html`<a class="btn wa" href="#/group?e=${ev.id}">${icon('share')} Group එකට ලැයිස්තුව දමන්න</a>` : ''}
      ${view === 'wait' && waiting.length && ev.status !== 'closed' ? html`<a class="btn wa" href="#/queue?kind=remind&e=${ev.id}">${icon('chat')} මතක් කිරීම් යවන්න</a>` : ''}`,
    mount(el) {
      wireEventBar(el, render);
      const list = el.querySelector('[data-list]');
      const draw = () => {
        const q = norm(query);
        const rows = view === 'given'
          ? dons.filter(d => !q || norm(memberName(d.memberId)).includes(q)).map(d => html`<a class="row" href="#/donation?id=${d.id}"><span class="ava ${d.kind}">${icon(d.kind === 'goods' ? 'box' : d.kind === 'bank' ? 'bank' : 'cash')}</span><span class="grow"><b>${memberName(d.memberId)}</b><small>${[d.payerId && `ගෙව්වේ ${memberName(d.payerId)}${d.settled ? ' ✓' : ''}`, userName(d.collectorId), pendingFor(d).length ? 'පණිවිඩය යවා නැත' : ''].filter(Boolean).join(' · ')}</small></span><strong>${d.kind === 'goods' ? d.goods : rs(d.amount)}</strong></a>`)
          : waiting.filter(m => !q || norm(m.name).includes(q)).map(m => html`<a class="row" href="${ev.status === 'closed' ? '#/members' : `#/donate?m=${m.id}`}"><span class="ava">${[...m.name][0]}</span><span class="grow"><b>${m.name}</b><small>${[m.area, prettyPhone(m.phone)].filter(Boolean).join(' · ')}</small></span>${icon('plus')}</a>`);
        list.innerHTML = rows.length ? html`${rows}` : empty('coins', query ? 'හමු වුණේ නැහැ.' : view === 'given' ? 'තවම මුදල් සටහන් කර නැහැ.' : 'සියලු දෙනා දායක වී ඇත. සාදු!');
      };
      draw();
      el.querySelector('input').addEventListener('input', e => { query = e.target.value; draw(); });
      on(el, 'click', '[data-v]', b => { view = b.dataset.v; query = ''; render({ keepScroll: true }); });
    },
  };
}

export function donationDetail({ id }) {
  const d = byId('donations', id);
  if (!d || d.deleted) return null;
  const ev = byId('events', d.eventId);
  const can = ev?.status !== 'closed' && (isAdmin() || d.collectorId === me().id);
  const KIND = { cash: 'අතට මුදල්', bank: 'බැංකුවට', goods: 'භාණ්ඩ' };
  return {
    title: 'පරිත්‍යාගය',
    body: html`
      <section class="card detail"><h2>${d.kind === 'goods' ? d.goods : rs(d.amount)}</h2><p class="lead">${memberName(d.memberId)}</p>
        <dl><dt>පින්කම</dt><dd>${ev?.title}</dd><dt>වර්ගය</dt><dd>${KIND[d.kind]}${d.kind === 'goods' && d.amount ? ` (දළ ${rs(d.amount)})` : ''}</dd><dt>දිනය</dt><dd>${fmtDateLong(d.date)}</dd><dt>එකතු කළේ</dt><dd>${userName(d.collectorId)}</dd>${d.payerId ? html`<dt>වෙනුවෙන් ගෙව්වේ</dt><dd>${memberName(d.payerId)}</dd><dt>පියවීම</dt><dd>${d.settled ? '✓ පියවා ඇත' : 'තවම පියවා නැත'}</dd>` : ''}${d.note ? html`<dt>සටහන</dt><dd>${d.note}</dd>` : ''}</dl>
        ${d.payerId ? html`<button type="button" class="btn ${d.settled ? 'ghost' : 'primary'}" data-settle>${d.settled ? 'පියවා නැත ලෙස වෙනස් කරන්න' : `${memberName(d.payerId)}ට මුදල ලැබුණා`}</button>` : ''}
      </section>
      <section><h2 class="sec">පණිවිඩ</h2><div class="stack">${messageButtons(d)}</div></section>
      ${can ? html`<div class="stack"><button type="button" class="btn ghost" data-edit>${icon('edit')} වෙනස් කරන්න</button><button type="button" class="btn link danger" data-del>${icon('trash')} මකන්න</button></div>` : html`<p class="sub center">${ev?.status === 'closed' ? 'මෙම පින්කමේ ගිණුම් වසා ඇති නිසා වෙනස් කළ නොහැක.' : 'මෙය වෙනස් කළ හැක්කේ එකතු කළ අයට හෝ ප්‍රධාන අයට පමණි.'}</p>`}`,
    mount(el) {
      wireMessageButtons(el, d, render);
      on(el, 'click', '[data-settle]', async () => {
        await put('donations', d.id, d.settled ? { settled: false, settledAt: '' } : { settled: true, settledAt: today() });
        toast(d.settled ? 'වෙනස් කළා' : 'පියවූ බව සටහන් කළා', { undo: () => put('donations', d.id, { settled: d.settled, settledAt: d.settledAt || '' }) });
      });
      on(el, 'click', '[data-del]', async () => {
        if (!(await confirmBox('මකන්නද?', `${memberName(d.memberId)} — ${d.kind === 'goods' ? d.goods : rs(d.amount)}`, { ok: 'මකන්න', danger: true }))) return;
        go('collection', true);
        await remove('donations', d.id);
        toast('මැකුවා', { undo: () => put('donations', d.id, { deleted: false }) });
      });
      on(el, 'click', '[data-edit]', () => editDonation(d));
    },
  };
}
const goodsOn = v => v.kind === 'goods';
function editDonation(d) {
  return formSheet({
    title: 'වෙනස් කරන්න', value: { ...d, value: d.kind === 'goods' ? d.amount : '', behalf: !!d.payerId },
    fields: [
      { key: 'memberId', label: 'සාමාජිකයා', type: 'member', required: true },
      { key: 'kind', label: 'වර්ගය', type: 'choice', required: true, options: [['cash', 'අතට මුදල්'], ['bank', 'බැංකුවට'], ['goods', 'භාණ්ඩ']] },
      { key: 'amount', label: 'මුදල', type: 'money', required: true, when: v => !goodsOn(v) },
      { key: 'goods', label: 'භාණ්ඩය', required: true, when: goodsOn },
      { key: 'value', label: 'දළ වටිනාකම', type: 'money', when: goodsOn },
      { key: 'behalf', label: 'වෙන කෙනෙක් වෙනුවෙන් ගෙව්වා', type: 'toggle', when: v => !goodsOn(v) },
      { key: 'payerId', label: 'මුදල් දුන්නේ', type: 'member', required: true, when: v => !goodsOn(v) && v.behalf, check: (v, o) => (v && v === o.memberId ? 'වෙනත් කෙනෙක් තෝරන්න.' : '') },
      { key: 'date', label: 'දිනය', type: 'date', required: true },
      ...(isAdmin() ? [{ key: 'collectorId', label: 'එකතු කළේ', type: 'select', required: true, options: activeUsers().map(u => [u.id, u.name]) }] : []),
      { key: 'note', label: 'සටහන' },
    ],
    onSave: async v => {
      const { value, behalf, ...r } = v;
      if (goodsOn(v)) r.amount = value; else r.goods = '';
      if (!behalf || goodsOn(v)) r.payerId = '';
      if (r.payerId !== d.payerId) { r.settled = false; r.settledAt = ''; }
      await put('donations', d.id, r);
      toast('සුරැකුණා');
    },
  });
}
