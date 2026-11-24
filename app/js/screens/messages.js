// Personal messages one after another, plus posts for the WhatsApp group.
import { S, all, me, byId, memberName } from '../store.js';
import { html, rs, prettyPhone, waNumber, fmtDate } from '../util.js';
import { pledgeStatus, eventStats } from '../calc.js';
import { icon, waIcon, on, toast, empty, bar } from '../ui.js';
import { activeEvent, eventBar, wireEventBar, chooseEvent } from './home.js';
import { compose, openWhatsApp, markSent, unmarkSent, wasSent, pendingFor, shareText, copyText, donationListText, financeText, groupReminderText } from '../messages.js';
import { render } from '../main.js';

/**
 * One entry per kind of personal message. `items(ev)` returns everybody it concerns:
 * { kind, refId, memberId, eventId, owner, donation?, amount?, note? }
 */
export const QUEUES = {
  remind: {
    title: 'මතක් කිරීම්', icon: 'chat', hint: 'තවම මුදල් නොදුන් අයට',
    items: ev => { const given = eventStats(S.db, ev.id).donors; return all('members').filter(m => !m.inactive && !m.noRemind && !given.has(m.id)).map(m => ({ kind: 'remind', refId: ev.id, memberId: m.id, eventId: ev.id, owner: m.collectorId, note: m.area })); },
  },
  thanks: {
    title: 'ස්තුති පණිවිඩ', icon: 'promise', hint: 'මුදල් දුන් අයට',
    items: ev => all('donations').filter(d => d.eventId === ev.id).flatMap(d => [...pendingFor(d), ...sentFor(d)]).map(x => ({ ...x, refId: x.donation.id, owner: x.donation.collectorId, note: x.donation.kind === 'goods' ? x.donation.goods : rs(x.donation.amount) })),
  },
  pledge: {
    title: 'පොරොන්දු මතක් කිරීම්', icon: 'gift', hint: 'පොරොන්දු වූ මුදල තවම නොදුන් අයට',
    items: ev => pledgeStatus(S.db, ev.id).filter(p => p.due > 0).map(p => ({ kind: 'pledge', refId: p.pledge.id, memberId: p.pledge.memberId, eventId: ev.id, owner: byId('members', p.pledge.memberId)?.collectorId, amount: p.due, note: rs(p.due) })),
  },
};
const sentFor = d => (wasSent('thanks', d.id, d.memberId) ? [{ kind: 'thanks', memberId: d.memberId, donation: d, eventId: d.eventId }] : []);
const split = list => ({
  todo: list.filter(x => !wasSent(x.kind, x.refId, x.memberId) && waNumber(byId('members', x.memberId)?.phone)),
  noPhone: list.filter(x => !waNumber(byId('members', x.memberId)?.phone)),
  sent: list.filter(x => wasSent(x.kind, x.refId, x.memberId) && waNumber(byId('members', x.memberId)?.phone)),
});

export function messagesHome() {
  const ev = activeEvent();
  if (!ev) return { title: 'පණිවිඩ', body: empty('chat', 'තවම පින්කමක් නැහැ.') };
  return {
    title: 'පණිවිඩ',
    body: html`${eventBar(ev)}
      <h2 class="sec">පුද්ගලික පණිවිඩ</h2>
      <div class="list card0">${Object.entries(QUEUES).map(([k, q]) => { const { todo } = split(q.items(ev)); return html`<a class="row" href="#/queue?kind=${k}&e=${ev.id}">${icon(q.icon, 'lead-i')}<span class="grow"><b>${q.title}</b><small>${q.hint}</small></span>${todo.length ? html`<span class="badge">${todo.length}</span>` : html`<span class="okmark">✓</span>`}${icon('next')}</a>`; })}</div>
      <h2 class="sec">WhatsApp group එකට</h2>
      <div class="list card0">
        <a class="row" href="#/group?e=${ev.id}&t=remind">${icon('calendar', 'lead-i')}<span class="grow"><b>පින්කම මතක් කිරීම</b><small>සියලු දෙනාට පොදු පණිවිඩය</small></span>${icon('next')}</a>
        <a class="row" href="#/group?e=${ev.id}&t=list">${icon('people', 'lead-i')}<span class="grow"><b>මුදල් දුන් අයගේ ලැයිස්තුව</b><small>නම් සහ මුදල්</small></span>${icon('next')}</a>
        <a class="row" href="#/group?e=${ev.id}&t=finance">${icon('report', 'lead-i')}<span class="grow"><b>ගිණුම් සාරාංශය</b><small>එකතුව, වියදම, ඉතිරිය, ප්‍රදේශ අනුව පවුල් ගණන</small></span>${icon('next')}</a>
        <a class="row" href="#/report?e=${ev.id}">${icon('sheet', 'lead-i')}<span class="grow"><b>PDF වාර්තාව</b><small>නම්, ගම්, මුදල්, ද්‍රව්‍ය සහ බඩු මලු — වර්ණවත් PDF</small></span>${icon('next')}</a>
        <a class="row" href="#/photos?e=${ev.id}">${icon('camera', 'lead-i')}<span class="grow"><b>ඡායාරූප එකතුව</b><small>Camera / gallery ඡායාරූප collage එකක් ලෙස</small></span>${icon('next')}</a>
      </div>`,
    mount: el => wireEventBar(el, render),
  };
}

let onlyMine = true;
export function queue({ kind, e }) {
  const q = QUEUES[kind];
  if (!q) return null;
  if (e && byId('events', e)) chooseEvent(e);
  const ev = activeEvent();
  if (!ev) return null;
  const everyone = q.items(ev);
  const hasMine = everyone.some(x => x.owner === me().id);
  const mine = onlyMine && hasMine;
  const { todo, noPhone, sent } = split(mine ? everyone.filter(x => x.owner === me().id) : everyone);
  const total = todo.length + sent.length;
  const next = todo[0];
  const nm = next && byId('members', next.memberId);
  return {
    title: q.title, back: 'messages',
    body: html`${eventBar(ev)}
      ${hasMine ? html`<div class="seg"><button type="button" data-mine="1" class="${mine ? 'on' : ''}">මගේ අය</button><button type="button" data-mine="" class="${mine ? '' : 'on'}">සියලු දෙනා</button></div>` : ''}
      ${total ? html`<div class="progress"><span><b>${sent.length}</b> / ${total} යවා ඇත</span>${bar(sent.length, total)}</div>` : ''}
      ${next ? html`<section class="card nextcard"><small>ඊළඟ කෙනා</small><h2>${nm.name}</h2><p class="sub">${[prettyPhone(nm.phone), next.note].filter(Boolean).join(' · ')}</p>
          <details class="more"><summary>පණිවිඩය බලන්න</summary><pre class="msg">${compose(next.kind, next)}</pre></details>
          <button type="button" class="btn wa huge" data-send="0">${waIcon}<span><b>WhatsApp එකෙන් යවන්න</b></span></button>
          <button type="button" class="btn link" data-skip="0">මේ අයට යැවීම අවශ්‍ය නැහැ</button></section>
        <p class="sub center">යවා නැවත මෙතැනට ආ විට ඊළඟ කෙනා සූදානම්.</p>`
        : empty('check', total ? 'සියලු දෙනාටම යවා අවසන්. සාදු!' : 'දැනට යැවීමට කිසිවෙක් නැහැ.')}
      ${todo.length > 1 ? html`<h2 class="sec">පෝලිමේ ඉතිරි අය (${todo.length - 1})</h2><div class="list card0">${todo.slice(1).map((x, i) => html`<button type="button" class="row" data-send="${i + 1}"><span class="ava">${[...memberName(x.memberId)][0]}</span><span class="grow"><b>${memberName(x.memberId)}</b><small>${x.note || ''}</small></span>${waIcon}</button>`)}</div>` : ''}
      ${noPhone.length ? html`<h2 class="sec">අංකය නැති අය (${noPhone.length})</h2><div class="list card0">${noPhone.map(x => html`<a class="row" href="#/members?open=${x.memberId}"><span class="ava">${[...memberName(x.memberId)][0]}</span><span class="grow"><b>${memberName(x.memberId)}</b><small>WhatsApp අංකය එක් කරන්න</small></span>${icon('phone')}</a>`)}</div>` : ''}
      ${sent.length ? html`<details class="more"><summary>යවා ඇති අය (${sent.length})</summary><div class="list card0">${sent.map((x, i) => html`<div class="row"><span class="okmark">✓</span><span class="grow"><b>${memberName(x.memberId)}</b><small>${fmtDate(wasSent(x.kind, x.refId, x.memberId).at)}</small></span><button type="button" class="btn mini" data-unsend="${i}">නැවත යවන්න</button></div>`)}</div></details>` : ''}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-mine]', b => { onlyMine = !!b.dataset.mine; render({ keepScroll: true }); });
      on(el, 'click', '[data-send]', b => {
        const x = todo[b.dataset.send];
        openWhatsApp(byId('members', x.memberId).phone, compose(x.kind, x));
        markSent(x.kind, x.refId, x.memberId, x.eventId);
        toast(`${memberName(x.memberId)} — යැවූ බව සටහන් කළා`, { undo: () => unmarkSent(x.kind, x.refId, x.memberId) });
      });
      on(el, 'click', '[data-skip]', b => { const x = todo[b.dataset.skip]; markSent(x.kind, x.refId, x.memberId, x.eventId); toast('මඟ හැරියා', { undo: () => unmarkSent(x.kind, x.refId, x.memberId) }); });
      on(el, 'click', '[data-unsend]', b => { const x = sent[b.dataset.unsend]; unmarkSent(x.kind, x.refId, x.memberId); });
    },
  };
}

const POSTS = {
  remind: ['පින්කම මතක් කිරීම', ev => groupReminderText(ev)],
  list: ['මුදල් දුන් අය', (ev, o) => donationListText(ev, o)],
  finance: ['ගිණුම් සාරාංශය', ev => financeText(ev)],
};
export function groupPost({ e, t = 'list', a = '1' }) {
  const ev = byId('events', e) || activeEvent();
  if (!ev || !POSTS[t]) return null;
  const text = POSTS[t][1](ev, { amounts: a === '1' });
  return {
    title: 'Group එකට', back: 'messages', keep: true,
    body: html`<div class="seg">${Object.entries(POSTS).map(([k, [l]]) => html`<a href="#/group?e=${ev.id}&t=${k}" class="${k === t ? 'on' : ''}">${l}</a>`)}</div>
      ${t === 'list' ? html`<div class="seg light"><a href="#/group?e=${ev.id}&t=list&a=1" class="${a === '1' ? 'on' : ''}">මුදල් සමඟ</a><a href="#/group?e=${ev.id}&t=list&a=0" class="${a === '1' ? '' : 'on'}">නම් පමණක්</a></div>` : ''}
      <textarea class="msg" rows="14" aria-label="පණිවිඩය">${text}</textarea>
      <div class="stack"><button type="button" class="btn wa huge" data-share>${waIcon}<span><b>WhatsApp group එකට යවන්න</b></span></button><button type="button" class="btn ghost" data-copy>${icon('copy')} Copy කරන්න</button></div>
      <p class="sub center">යැවීමට පෙර පණිවිඩය වෙනස් කළ හැක. පවුල්වල නම් කිසිවිටෙක මෙහි නොයයි — ප්‍රදේශය සහ ගණන පමණි.</p>`,
    mount(el) {
      const ta = el.querySelector('textarea.msg');
      on(el, 'click', '[data-share]', async () => { const r = await shareText(ta.value); if (r === 'copied') toast('Copy කළා. Group එකේ paste කරන්න.'); if (r === 'failed') toast('බැරි වුණා. පණිවිඩය තෝරා copy කරන්න.', { bad: true }); });
      on(el, 'click', '[data-copy]', async () => toast((await copyText(ta.value)) ? 'Copy කළා. Group එකේ paste කරන්න.' : 'බැරි වුණා.'));
    },
  };
}
