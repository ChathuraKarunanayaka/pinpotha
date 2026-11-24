import { S, all, me, isAdmin, isDemo, byId, put, setting, memberName, userName, dismissRejected } from '../store.js';
import { html, raw, rs, today, daysTo, inDays, fmtDateLong } from '../util.js';
import { currentEvent, eventStats, fundLedger, holdings, pledgeStatus, openDebts } from '../calc.js';
import { nextPoya, poyaId, moonSvg } from '../poya.js';
import { icon, on, toast, stat, confirmBox, sheet } from '../ui.js';
import { pendingFor, wasSent, orgName } from '../messages.js';
import { statusChip, go, render } from '../main.js';

/* The event people are working on; remembered per phone so switching sticks for the visit. */
let chosen = null;
export const activeEvent = () => {
  const c = chosen && byId('events', chosen);
  return c && !c.deleted ? c : currentEvent(S.db, today());
};
export const chooseEvent = id => { chosen = id; };
export const openEvents = () => all('events').filter(e => e.status !== 'closed').sort((a, b) => a.date.localeCompare(b.date));

export function pickEvent({ closed = true, title = 'පින්කම තෝරන්න' } = {}) {
  const list = all('events').filter(e => closed || e.status !== 'closed').sort((a, b) => Math.abs(daysTo(a.date)) - Math.abs(daysTo(b.date)));
  return sheet({
    title,
    body: html`<div class="list">${list.map(e => html`<button type="button" class="row" data-e="${e.id}">${icon(e.type === 'poya' ? 'calendar' : 'lotus', 'lead-i')}<span class="grow"><b>${e.title}</b><small>${fmtDateLong(e.date)}${e.status === 'closed' ? ' · වසා ඇත' : ''}</small></span>${icon('next')}</button>`)}</div>`,
    mount: (b, close) => on(b, 'click', '[data-e]', x => close(byId('events', x.dataset.e))),
  });
}
/** Small "which event?" bar used at the top of many screens. */
export const eventBar = ev => html`<button type="button" class="evbar" data-evbar>${icon(ev?.type === 'poya' ? 'calendar' : 'lotus')}<span class="grow"><b>${ev?.title || 'පින්කමක් තෝරන්න'}</b>${ev ? html`<small>${fmtDateLong(ev.date)}${ev.status === 'closed' ? ' · වසා ඇත' : ''}</small>` : ''}</span><em>මාරු කරන්න</em></button>`;
export const wireEventBar = (el, done) => on(el, 'click', '[data-evbar]', async () => { const e = await pickEvent(); if (e) { chooseEvent(e.id); done(); } });

export const addPoya = ([date, title]) => put('events', poyaId(date), { type: 'poya', title, date, fund: 'poya', status: 'open', parcels: '', note: '', deleted: false });

/** Members who still have to be reminded for an event. */
export function toRemind(ev, mine) {
  const given = eventStats(S.db, ev.id).donors;
  return all('members').filter(m => !m.inactive && !m.noRemind && m.phone && !given.has(m.id) && (!mine || m.collectorId === me().id) && !wasSent('remind', ev.id, m.id));
}

export function home() {
  const ev = activeEvent();
  const np = nextPoya(today());
  const missing = np && !all('events').some(e => e.date === np[0] && e.type === 'poya') ? np : null;
  const st = ev && eventStats(S.db, ev.id);
  const row = ev && fundLedger(S.db, ev.fund).find(r => r.event.id === ev.id);
  const h = holdings(S.db, S.users.map(u => u.id));
  const mine = h[me().id] || 0;
  const d = ev ? daysTo(ev.date) : null;
  const remindFrom = Number(setting('remindDays', '4'));
  const todo = [];

  if (S.rejected.length) todo.push(['alert', 'bad', `සටහන් ${S.rejected.length}ක් පිළිගත්තේ නැහැ`, 'බලන්න', 'rejected']);
  const inbox = all('handovers').filter(x => x.status === 'pending' && (x.toId === me().id || (isAdmin() && x.toId === 'BANK')));
  if (inbox.length) todo.push(['hand', 'warn', `මුදල් භාරගැනීම් ${inbox.length}ක් තහවුරු කරන්න`, rs(inbox.reduce((s, x) => s + Number(x.amount), 0)), 'go:cash']);
  if (ev && ev.status !== 'closed' && d >= 0 && d <= remindFrom) {
    const r = toRemind(ev, true).length || toRemind(ev, false).length;
    if (r) todo.push(['chat', 'warn', 'මතක් කිරීම් යවන්න', `${r} දෙනෙකුට`, `go:queue?kind=remind&e=${ev.id}`]);
  }
  const thanks = all('donations').filter(x => x.collectorId === me().id && byId('events', x.eventId)?.status !== 'closed').flatMap(pendingFor).length;
  if (thanks) todo.push(['promise', '', 'ස්තුති පණිවිඩ යවන්න', `${thanks}ක් ඉතිරියි`, 'go:queue?kind=thanks']);
  const debts = openDebts(S.db);
  if (debts.length) todo.push(['swap', '', 'වෙනුවෙන් ගෙවූ මුදල් තවම පියවා නැත', `${debts.length}ක් · ${rs(debts.reduce((s, x) => s + Number(x.amount), 0))}`, 'go:behalf']);
  const due = ev ? pledgeStatus(S.db, ev.id).filter(p => p.due > 0) : [];
  if (due.length) todo.push(['gift', '', 'පොරොන්දු මුදල් ලැබීමට ඇත', `${due.length} දෙනෙක් · ${rs(due.reduce((s, p) => s + p.due, 0))}`, 'go:pledges']);
  const cand = isAdmin() ? all('families').filter(f => f.status === 'candidate').length : 0;
  if (cand) todo.push(['house', '', 'අනුමත කිරීමට පවුල්', `${cand}ක්`, 'go:families']);

  const setupNeeded = isAdmin() && !all('members').length;
  return {
    title: '',
    body: html`
      <section class="hero">
        <div class="hero-top"><span class="org">${orgName()}</span>${statusChip()}</div>
        ${ev ? html`<button type="button" class="hero-main" data-evbar>
          ${raw(moonSvg(np ? daysTo(np[0]) : 0))}
          <span class="grow"><small>${d >= 0 ? 'මීළඟ පින්කම' : 'පසුගිය පින්කම'}</small><b>${ev.title}</b><span>${fmtDateLong(ev.date)}</span><em>${inDays(d)}</em></span>
        </button>` : html`<div class="hero-main">${raw(moonSvg(np ? daysTo(np[0]) : 0))}<span class="grow"><small>මීළඟ පොහොය</small><b>${np?.[1] || ''}</b><span>${np ? fmtDateLong(np[0]) : ''}</span></span></div>`}
        ${ev && ev.status !== 'closed' ? html`<a class="btn gold huge" href="#/donate">${icon('plus')} මුදලක් සටහන් කරන්න</a>` : ''}
        ${missing ? html`<button type="button" class="btn ${ev ? 'ghost-light' : 'gold huge'}" data-addpoya>${isAdmin() ? `${missing[1]} එක් කරන්න` : `${missing[1]} තවම එක් කර නැත`}</button>` : ''}
      </section>

      ${setupNeeded ? html`<section class="card note"><h2>පටන් ගන්න පියවර 3ක්</h2><ol class="steps"><li><a href="#/users">මුදල් එකතු කරන අය එක් කරන්න</a></li><li><a href="#/members">සාමාජිකයන් එක් කරන්න</a> (ලැයිස්තුවක් එකවර දැමිය හැක)</li><li><a href="#/cash">පොතේ දැනට ඉතිරි මුදල ඇතුළත් කරන්න</a></li></ol></section>` : ''}

      ${todo.length ? html`<section><h2 class="sec">කළ යුතු දේ</h2><div class="list card0">${todo.map(([ic, cls, t, s, act]) => html`<button type="button" class="row ${cls}" data-todo="${act}">${icon(ic, 'lead-i')}<span class="grow"><b>${t}</b><small>${s}</small></span>${icon('next')}</button>`)}</div></section>` : ''}

      ${ev ? html`<section><h2 class="sec">${ev.title} — ගිණුම්</h2>
        <div class="stats">
          ${stat('එකතු වූ මුදල', st.total, 'in')}
          ${stat('වියදම', st.spent, 'out')}
          ${stat('පෙර ශේෂය', row.brought)}
          ${stat('ඉතිරිය', row.balance, 'bal')}
        </div>
        <p class="sub">${st.donors.size} දෙනෙක් දායක වී ඇත${st.goods.length ? ` · භාණ්ඩ පරිත්‍යාග ${st.goods.length}` : ''} · සාමාජිකයන් ${all('members').filter(m => !m.inactive).length}</p></section>` : ''}

      <section class="card mine"><div class="grow"><small>දැනට මා අත ඇති මුදල</small><b class="${mine < 0 ? 'neg' : ''}">${rs(mine)}</b></div><a class="btn ghost" href="#/cash">${icon('hand')} භාර දෙන්න</a></section>
      ${isDemo() ? html`<p class="sub center">මේ අත්හදා බැලීමකි — මෙහි ඇති නම් සහ මුදල් සැබෑ නොවේ.</p>` : ''}`,
    mount(el) {
      wireEventBar(el, render);
      on(el, 'click', '[data-addpoya]', async () => {
        if (!isAdmin()) return toast('ප්‍රධාන අයට මෙය එක් කරන ලෙස දන්වන්න.');
        await addPoya(missing);
        chooseEvent(poyaId(missing[0]));
        toast(`${missing[1]} එක් කළා`);
      });
      on(el, 'click', '[data-todo]', async b => {
        const a = b.dataset.todo;
        if (a.startsWith('go:')) return go(a.slice(3));
        const list = S.rejected.map(r => `• ${describe(r)}: ${r.error}`).join('\n');
        if (await confirmBox('පිළිගත්තේ නැති සටහන්', list, { ok: 'දැක්කා, ඉවත් කරන්න', cancel: 'පසුව' })) dismissRejected();
      });
    },
  };
}
function describe(r) {
  const p = r.patch || {};
  if (r.table === 'donations') return `${p.memberId ? memberName(p.memberId) : 'පරිත්‍යාගය'} ${p.amount ? rs(p.amount) : ''}`;
  if (r.table === 'handovers') return `${p.fromId ? userName(p.fromId) : 'භාරදීම'} ${p.amount ? rs(p.amount) : ''}`;
  return p.name || p.title || 'සටහන';
}
