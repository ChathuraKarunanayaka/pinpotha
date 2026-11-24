// Members (who give) and families (who receive).
import { S, all, byId, put, remove, isAdmin, memberName, userName } from '../store.js';
import { html, rs, norm, byName, prettyPhone, fmtDate, parseMemberLines, waNumber } from '../util.js';
import { lastDelivered } from '../calc.js';
import { icon, on, toast, sheet, formSheet, memberForm, empty, confirmBox, areas } from '../ui.js';
import { render } from '../main.js';

/* ---------------- members ---------------- */
let q = '', showOff = false;
export function members({ open }) {
  return {
    title: 'සාමාජිකයන්', back: 'more',
    body: html`<div class="two"><button type="button" class="btn primary" data-add>${icon('plus')} එක් කරන්න</button><button type="button" class="btn ghost" data-bulk>${icon('copy')} ලැයිස්තුවක්</button></div>
      <div class="search">${icon('search')}<input type="search" placeholder="නම, ප්‍රදේශය හෝ දුරකථනය" value="${q}" aria-label="සොයන්න"></div>
      <p class="sub" data-count></p><div class="list card0" data-list></div>`,
    mount(el) {
      const list = el.querySelector('[data-list]');
      const draw = () => {
        const n = norm(q), digits = n.replace(/\D/g, '').replace(/^0/, '');
        const base = all('members'), off = base.filter(m => m.inactive).length;
        const rows = base.filter(m => (showOff || !m.inactive) && (!n || norm(m.name).includes(n) || norm(m.area).includes(n) || (digits.length > 2 && String(m.phone).replace(/\D/g, '').includes(digits)))).sort(byName);
        el.querySelector('[data-count]').innerHTML = html`${rows.length} දෙනෙක්${off ? html` · <button type="button" class="inline" data-off>${showOff ? 'අක්‍රිය අය සඟවන්න' : `අක්‍රිය අය (${off}) පෙන්වන්න`}</button>` : ''}`;
        list.innerHTML = rows.length ? html`${rows.map(m => html`<button type="button" class="row ${m.inactive ? 'dim' : ''}" data-m="${m.id}"><span class="ava">${[...m.name][0]}</span><span class="grow"><b>${m.name}</b><small>${[m.area, prettyPhone(m.phone) || 'අංකය නැත'].filter(Boolean).join(' · ')}</small></span>${icon('next')}</button>`)}` : empty('people', q ? 'හමු වුණේ නැහැ.' : 'තවම සාමාජිකයන් නැහැ. එකින් එක හෝ ලැයිස්තුවක් ලෙස එක් කරන්න.');
      };
      draw();
      el.querySelector('input').addEventListener('input', e => { q = e.target.value; draw(); });
      on(el, 'click', '[data-off]', () => { showOff = !showOff; draw(); });
      on(el, 'click', '[data-add]', () => memberForm({}, S.users));
      on(el, 'click', '[data-m]', b => memberSheet(byId('members', b.dataset.m)));
      on(el, 'click', '[data-bulk]', bulk);
      if (open && byId('members', open)) { history.replaceState(null, '', '#/members'); memberForm(byId('members', open), S.users); }
    },
  };
}
function memberSheet(m) {
  const dons = all('donations').filter(d => d.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = dons.filter(d => d.kind !== 'goods').reduce((s, d) => s + Number(d.amount), 0);
  return sheet({
    title: m.name,
    body: html`<p class="lead">${[m.area, prettyPhone(m.phone)].filter(Boolean).join(' · ')}${m.collectorId ? html`<br><small>භාර: ${userName(m.collectorId)}</small>` : ''}</p>${m.note ? html`<p class="sub">${m.note}</p>` : ''}
      <div class="two"><button type="button" class="btn ghost" data-edit>${icon('edit')} වෙනස් කරන්න</button>${waNumber(m.phone) ? html`<a class="btn ghost" href="tel:+${waNumber(m.phone)}">${icon('phone')} අමතන්න</a>` : ''}</div>
      <h2 class="sec">පරිත්‍යාග (${dons.length})${total ? ` · ${rs(total)}` : ''}</h2>
      ${dons.length ? html`<div class="list card0">${dons.map(d => html`<div class="row"><span class="grow"><b>${byId('events', d.eventId)?.title || ''}</b><small>${fmtDate(d.date)}${d.payerId ? ` · ගෙව්වේ ${memberName(d.payerId)}` : ''}</small></span><strong>${d.kind === 'goods' ? d.goods : rs(d.amount)}</strong></div>`)}</div>` : html`<p class="sub">තවම නැහැ.</p>`}
      ${isAdmin() && !dons.length ? html`<button type="button" class="btn link danger" data-del>${icon('trash')} මකන්න</button>` : ''}`,
    mount(b, close) {
      on(b, 'click', '[data-edit]', () => { close(); memberForm(m, S.users); });
      on(b, 'click', '[data-del]', async () => { if (await confirmBox('මකන්නද?', m.name, { ok: 'මකන්න', danger: true })) { close(); await remove('members', m.id); toast('මැකුවා', { undo: () => put('members', m.id, { deleted: false }) }); } });
    },
  });
}
function bulk() {
  return sheet({
    title: 'ලැයිස්තුවක් එකවර එක් කරන්න', cls: 'tall',
    body: html`<p class="lead">එක පේළියකට එක් අයෙක්. <b>නම, දුරකථනය, ප්‍රදේශය</b> ලෙස. Excel හෝ WhatsApp එකකින් copy කර දැමිය හැක.</p>
      <textarea rows="9" placeholder="සුනිල් පෙරේරා, 0771234567, මහරගම&#10;කමලා විජේසිංහ, 0712345678"></textarea><div data-prev></div><div class="stack sticky"><button type="button" class="btn primary" data-save disabled>එක් කරන්න</button></div>`,
    mount(b, close) {
      const ta = b.querySelector('textarea'), btn = b.querySelector('[data-save]');
      let rows = [];
      ta.addEventListener('input', () => {
        const seen = new Set(all('members').flatMap(m => [waNumber(m.phone) || 'n:' + norm(m.name)]));
        const parsed = parseMemberLines(ta.value);
        rows = parsed.filter(r => { const k = waNumber(r.phone) || 'n:' + norm(r.name); if (seen.has(k)) return false; seen.add(k); return true; });
        b.querySelector('[data-prev]').innerHTML = html`<p class="sub">${rows.length} දෙනෙක්${parsed.length - rows.length ? ` · දැනටමත් ඇති ${parsed.length - rows.length} දෙනෙක් මඟ හැරේ` : ''}</p><div class="list card0">${rows.slice(0, 120).map(r => html`<div class="row"><span class="grow"><b>${r.name}</b><small>${[prettyPhone(r.phone) || 'අංකය නැත', r.area].filter(Boolean).join(' · ')}</small></span></div>`)}</div>`;
        btn.disabled = !rows.length;
        btn.textContent = rows.length ? `${rows.length} දෙනෙක් එක් කරන්න` : 'එක් කරන්න';
      });
      on(b, 'click', '[data-save]', async () => {
        btn.disabled = true;
        for (const r of rows) await put('members', null, { ...r, usual: '', collectorId: '', noRemind: false, anon: false, inactive: false, note: '' });
        toast(`${rows.length} දෙනෙක් එක් කළා`);
        close();
      });
    },
  });
}

/* ---------------- families ---------------- */
export const FAM_STATUS = { candidate: 'යෝජිත', approved: 'අනුමතයි', paused: 'නවතා ඇත' };
let fq = '', fs = 'all';
export function families() {
  const last = lastDelivered(S.db);
  const fams = all('families');
  return {
    title: 'ආධාර ලබන පවුල්', back: 'more',
    body: html`<button type="button" class="btn primary huge" data-add>${icon('plus')} පවුලක් එක් කරන්න</button>
      <div class="seg">${[['all', 'සියල්ල'], ...Object.entries(FAM_STATUS)].map(([k, l]) => html`<button type="button" data-s="${k}" class="${fs === k ? 'on' : ''}">${l} (${k === 'all' ? fams.length : fams.filter(f => f.status === k).length})</button>`)}</div>
      <div class="search">${icon('search')}<input type="search" placeholder="නම හෝ ප්‍රදේශය" value="${fq}" aria-label="සොයන්න"></div>
      <div data-list></div><p class="sub center">${icon('lock')} මෙම විස්තර පෙනෙන්නේ කමිටුවට පමණි.</p>`,
    mount(el) {
      const list = el.querySelector('[data-list]');
      const draw = () => {
        const n = norm(fq);
        const rows = fams.filter(f => (fs === 'all' || f.status === fs) && (!n || norm(f.name).includes(n) || norm(f.area).includes(n)));
        const groups = {};
        rows.forEach(f => { (groups[f.area || 'ප්‍රදේශය සඳහන් නැත'] ||= []).push(f); });
        list.innerHTML = rows.length ? html`${Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'si')).map(([a, fl]) => html`<h2 class="sec">${icon('pin')} ${a} (${fl.length})</h2><div class="list card0">${fl.sort(byName).map(f => html`<a class="row" href="#/family?id=${f.id}">${icon('house', 'lead-i')}<span class="grow"><b>${f.name}${f.urgent ? html` <span class="tag bad">හදිසි</span>` : ''}${f.status !== 'approved' ? html` <span class="tag">${FAM_STATUS[f.status]}</span>` : ''}</b><small>${[f.people && `${f.people} දෙනෙක්`, f.need, last[f.id] ? `අවසන් වරට ${fmtDate(last[f.id])}` : 'තවම ලබා දී නැත'].filter(Boolean).join(' · ')}</small></span>${icon('next')}</a>`)}</div>`)}` : empty('house', 'පවුල් නැහැ.');
      };
      draw();
      el.querySelector('input').addEventListener('input', e => { fq = e.target.value; draw(); });
      on(el, 'click', '[data-s]', b => { fs = b.dataset.s; render({ keepScroll: true }); });
      on(el, 'click', '[data-add]', () => familyForm());
    },
  };
}
export function familyForm(f = {}) {
  return formSheet({
    title: f.id ? 'පවුලේ විස්තර' : 'අලුත් පවුලක්', value: f,
    fields: [
      { key: 'name', label: 'ගෘහ මූලිකයාගේ නම', required: true },
      { key: 'area', label: 'ප්‍රදේශය', required: true, list: areas(), hint: 'Group වාර්තාවල පෙන්වන්නේ මෙය පමණි.' },
      { key: 'address', label: 'ලිපිනය', type: 'textarea', rows: 2 },
      { key: 'phone', label: 'දුරකථනය', type: 'tel' },
      { key: 'people', label: 'පවුලේ සාමාජිකයන් ගණන', type: 'number' }, { key: 'children', label: 'ඉන් ළමුන් ගණන', type: 'number' },
      { key: 'need', label: 'තත්ත්වය / අවශ්‍යතාව', type: 'textarea', rows: 2, placeholder: 'උදා: රැකියාවක් නැත, කිරිපිටි අවශ්‍යයි' },
      { key: 'urgent', label: 'හදිසි අවශ්‍යතාවකි', type: 'toggle' },
      { key: 'referredBy', label: 'දැනුම් දුන්නේ කවුද?', list: all('members').map(m => m.name) },
      { key: 'map', label: 'Google Maps link', placeholder: 'https://maps.app.goo.gl/…' },
      ...(isAdmin() ? [{ key: 'status', label: 'අනුමැතිය', type: 'choice', required: true, options: Object.entries(FAM_STATUS), value: f.id ? f.status : 'approved' }] : []),
      { key: 'note', label: 'සටහන', type: 'textarea', rows: 2 },
    ],
    onSave: async v => {
      if (!f.id && all('families').some(x => norm(x.name) === norm(v.name) && norm(x.area) === norm(v.area)) && !(await confirmBox('දැනටමත් ඇත', 'මේ නමින් මේ ප්‍රදේශයේ පවුලක් ඇත. එහෙත් එක් කරනවාද?'))) return false;
      await put('families', f.id, isAdmin() || f.id ? v : { ...v, status: 'candidate' });
      toast(isAdmin() ? 'සුරැකුණා' : 'යෝජනා කළා. ප්‍රධාන අය අනුමත කළ පසු බෙදාහැරීමට එක් වේ.');
    },
  });
}
/** Only real web links: a pasted "javascript:" address must never become clickable. */
export const mapLink = f => (/^https:\/\//i.test(f.map || '') ? f.map : f.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}` : '');
export function familyDetail({ id }) {
  const f = byId('families', id);
  if (!f || f.deleted) return null;
  const hist = all('deliveries').filter(d => d.familyId === id).map(d => ({ d, ev: byId('events', d.eventId) })).filter(x => x.ev).sort((a, b) => b.ev.date.localeCompare(a.ev.date));
  return {
    title: 'පවුල', back: 'families',
    body: html`<section class="card detail"><h2>${f.name}</h2><p class="lead">${f.area}${f.urgent ? html` <span class="tag bad">හදිසි</span>` : ''} <span class="tag">${FAM_STATUS[f.status]}</span></p>
      <dl>${[['ලිපිනය', f.address], ['දුරකථනය', prettyPhone(f.phone)], ['සාමාජිකයන්', f.people && `${f.people}${f.children ? ` (ළමුන් ${f.children})` : ''}`], ['තත්ත්වය', f.need], ['දැනුම් දුන්නේ', f.referredBy], ['සටහන', f.note]].filter(x => x[1]).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
      <div class="two">${mapLink(f) ? html`<a class="btn ghost" target="_blank" rel="noopener noreferrer" href="${mapLink(f)}">${icon('pin')} සිතියම</a>` : ''}${waNumber(f.phone) ? html`<a class="btn ghost" href="tel:+${waNumber(f.phone)}">${icon('phone')} අමතන්න</a>` : ''}</div></section>
      ${isAdmin() && f.status === 'candidate' ? html`<button type="button" class="btn primary huge" data-approve>${icon('check')} අනුමත කරන්න</button>` : ''}
      <button type="button" class="btn ghost" data-edit>${icon('edit')} වෙනස් කරන්න</button>
      <h2 class="sec">ලබා දුන් වාර</h2>
      ${hist.length ? html`<div class="list card0">${hist.map(({ d, ev }) => html`<div class="row"><span class="okmark">${d.status === 'done' ? '✓' : '·'}</span><span class="grow"><b>${ev.title}</b><small>${fmtDate(ev.date)}${d.note ? ` · ${d.note}` : ''}</small></span><strong>මලු ${d.parcels || 1}</strong></div>`)}</div>` : html`<p class="sub">තවම නැහැ.</p>`}
      ${isAdmin() && !hist.length ? html`<button type="button" class="btn link danger" data-del>${icon('trash')} මකන්න</button>` : ''}`,
    mount(el) {
      on(el, 'click', '[data-edit]', () => familyForm(f));
      on(el, 'click', '[data-approve]', async () => { await put('families', id, { status: 'approved' }); toast('අනුමත කළා'); });
      on(el, 'click', '[data-del]', async () => { if (await confirmBox('මකන්නද?', f.name, { ok: 'මකන්න', danger: true })) { location.hash = '#/families'; await remove('families', id); toast('මැකුවා', { undo: () => put('families', id, { deleted: false }) }); } });
    },
  };
}
