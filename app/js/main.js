// Boot, routing and the frame around every screen.
import { S, load, onChange, parseInvite, parseJoin, connect, sync, startAutoSync, isDemo } from './store.js';
import { html } from './util.js';
import { icon, on, toast, confirmBox } from './ui.js';
import * as auth from './screens/auth.js';
import { home } from './screens/home.js';
import { donate, thanks } from './screens/donate.js';
import { collection, donationDetail } from './screens/collection.js';
import { messagesHome, queue, groupPost } from './screens/messages.js';
import { cash, expenses, pledges } from './screens/money.js';
import { members, families, familyDetail } from './screens/people.js';
import { events, eventDetail, parcels, tasks, delivery } from './screens/events.js';
import { report } from './screens/report.js';
import { photos } from './screens/photos.js';
import { more, reports, history, settings, users, help } from './screens/more.js';

/** A screen is { title, body, mount?(el), back?, tab? }. Add new ones here. */
const ROUTES = {
  home, donate, thanks, collection, donation: donationDetail, messages: messagesHome, queue, group: groupPost,
  cash, expenses, pledges, members, families, family: familyDetail, events, event: eventDetail,
  parcels, tasks, delivery, report, photos, more, reports, history, settings, users, help,
};
const TABS = [['home', 'home', 'මුල් පිටුව'], ['collection', 'coins', 'එකතුව'], ['donate', 'plus', 'මුදලක්'], ['messages', 'chat', 'පණිවිඩ'], ['more', 'more', 'තවත්']];

const app = document.getElementById('app');
export const go = (path, replace) => { replace ? location.replace('#/' + path) : (location.hash = '#/' + path); };
const parse = () => {
  const [path, q] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: ROUTES[path] ? path : 'home', params: Object.fromEntries(new URLSearchParams(q || '')) };
};

/** The personal invite being accepted right now, if any. */
let joining = null;
async function startJoin(inv) {
  if (S.session && !S.conn?.demo && !(await confirmBox('වෙනත් කෙනෙක් ලෙස ඇතුළු වන්නද?', `මෙම දුරකථනයේ දැනට ඇතුළු වී සිටින්නේ ${S.session.user.name}. ඉදිරියට ගියොත් ඒ අය මෙම දුරකථනයෙන් ඉවත් වේ.`, { ok: 'ඉදිරියට', cancel: 'අවලංගු' }))) return render();
  joining = inv;
  render();
}
let current = null, scrollKey = '', scrolls = {};
export function render({ keepScroll } = {}) {
  if (joining) return show(auth.joinScreen(joining, () => { joining = null; go('home', true); render(); }));
  if (!S.conn) return show(auth.connectScreen(startJoin));
  if (!S.session?.token) return show(auth.loginScreen());
  const { name, params } = parse();
  const key = location.hash;
  if (scrollKey && !keepScroll) scrolls[scrollKey] = scrollY;
  const scr = ROUTES[name](params);
  if (!scr) return go('home', true);
  current = { name, params, ...scr };
  const top = TABS.some(t => t[0] === name) && !scr.focus;
  app.className = 'framed' + (scr.focus ? ' focus' : '');
  app.innerHTML = html`
    ${name === 'home' ? '' : html`<header class="topbar">${top ? html`<span class="tb-sp"></span>` : html`<button type="button" class="iconbtn" data-back aria-label="ආපසු">${icon('back')}</button>`}<h1>${scr.title}</h1>${statusChip()}</header>`}
    <main id="main">${scr.body}</main>
    ${scr.focus ? '' : html`<nav class="tabs">${TABS.map(([r, ic, l]) => html`<a href="#/${r}" class="${[r === name ? 'on' : '', r === 'donate' ? 'big' : ''].join(' ')}" ${r === name ? 'aria-current=page' : ''}><span>${icon(ic)}</span><small>${l}</small></a>`)}</nav>`}`;
  document.title = scr.title ? `${scr.title} — දනට පින් ඇත්තෝ` : 'දනට පින් ඇත්තෝ';
  scr.mount?.(document.getElementById('main'));
  if (key !== scrollKey) scrollTo(0, backing ? scrolls[key] || 0 : 0);
  backing = false;
  scrollKey = key;
}
function show(scr) {
  current = null; scrollKey = '';
  app.className = 'plain';
  app.innerHTML = html`<main id="main">${scr.body}</main>`;
  scr.mount?.(document.getElementById('main'));
}
export function statusChip() {
  const n = S.outbox.length;
  const [cls, ic, t] = isDemo() ? ['demo', 'help', 'අත්හදා බැලීම']
    : S.storageBroken ? ['bad', 'alert', 'සුරැකෙන්නේ නැහැ']
    : S.status === 'error' ? ['bad', 'alert', 'දෝෂයක්']
    : S.status === 'offline' ? ['warn', 'sync', n ? `යැවීමට ${n}ක්` : 'Offline']
    : n || S.status === 'syncing' ? ['busy', 'sync', n ? 'යවමින්…' : ''] : ['ok', 'check', 'සුරැකුණා'];
  return html`<button type="button" class="sync ${cls}" data-sync aria-label="සුරැකීමේ තත්ත්වය: ${t || 'යාවත්කාලීන වෙමින්'}">${icon(ic)}<span>${t}</span></button>`;
}

let backing = false;
window.navigation?.addEventListener('navigate', e => { if (e.navigationType === 'traverse') backing = true; });
addEventListener('hashchange', () => { if (!takeInvite()) render(); });
on(document.body, 'click', '[data-back]', () => {
  if (current?.back) { backing = true; return go(current.back, true); }
  history_back();
});
function history_back() { if (window.history.length > 1) window.history.back(); else go('home', true); }
on(document.body, 'click', '[data-go]', b => go(b.dataset.go));
on(document.body, 'click', '[data-sync]', async () => {
  if (isDemo()) return toast('මේ අත්හදා බැලීමක්. දත්ත යන්නේ නැහැ.');
  if (S.storageBroken) return toast('මෙම බ්‍රව්සරයේ දත්ත සුරැකෙන්නේ නැහැ. සාමාන්‍ය Chrome/Safari එකෙන් විවෘත කරන්න.', { bad: true });
  await sync();
  toast(S.status === 'idle' ? 'සියල්ල සුරැකී ඇත ✓' : S.error, { bad: S.status !== 'idle' });
});

onChange(kind => {
  if (kind === 'status') { const c = document.querySelector('.sync'); if (c) c.outerHTML = String(statusChip()); return; }
  if (joining) return; // the join screen finishes first
  if (kind === 'session') return render();
  // Never redraw under someone's fingers: an open dialog or a half-typed form stays as it is.
  if (document.querySelector('dialog[open]') || current?.keep || typing()) { pendingDraw = true; return; }
  render({ keepScroll: true });
});
let pendingDraw = false;
const typing = () => !!document.activeElement?.closest?.('#main input:not([type=checkbox]):not([type=radio]), #main textarea, #main select');
addEventListener('focusout', () => setTimeout(() => { if (pendingDraw && !typing() && !document.querySelector('dialog[open]') && !current?.keep) { pendingDraw = false; render({ keepScroll: true }); } }, 200));
new MutationObserver(() => { if (pendingDraw && !document.querySelector('dialog[open]') && !current?.keep) { pendingDraw = false; render({ keepScroll: true }); } }).observe(document.body, { childList: true });

/** Invite links look like …/#setup=<id>.<key>; the secret is removed from the address bar straight away. */
function takeInvite() {
  if (location.hash === '#demo') { window.history.replaceState(null, '', location.pathname); connect({ demo: true }).then(() => render()); return true; }
  if (location.hash.startsWith('#join=')) {
    const j = parseJoin(location.hash);
    window.history.replaceState(null, '', location.pathname + '#/home');
    if (j) startJoin(j); else { toast('Link එක සම්පූර්ණ නැහැ. මුළු link එකම ඔබන්න.', { bad: true }); render(); }
    return true;
  }
  if (!location.hash.startsWith('#setup=')) return false;
  const inv = parseInvite(location.hash);
  window.history.replaceState(null, '', location.pathname + '#/home');
  if (!inv) { toast('Link එක සම්පූර්ණ නැහැ. නැවත බලන්න.', { bad: true }); render(); return true; }
  (async () => {
    if (S.conn && !S.conn.demo && S.conn.id !== inv.id && !(await confirmBox('වෙනත් පොතකට මාරු වන්නද?', 'මෙම දුරකථනයේ දැනට තිබෙන පොත වෙනුවට අලුත් පොත විවෘත වේ.'))) return render();
    try { await connect(inv); } catch (e) { toast(e.message, { bad: true }); }
    render();
  })();
  return true;
}

window.history.scrollRestoration = 'manual';
let size = '1';
try { size = localStorage.getItem('size') || '1'; } catch { /* private window */ }
document.documentElement.dataset.size = size;
await load();
if (!takeInvite()) render();
startAutoSync();
sync();
if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});

