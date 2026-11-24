// Menu, yearly report, change history, settings, committee accounts and help.
import { S, all, me, treasurerId, activeUsers, byId, put, isAdmin, isDemo, api, setting, setUsers, setToken, logout, disconnect, memberName, userName, sync } from '../store.js';
import { html, rs, fmtStamp, fmtDate } from '../util.js';
import { FUNDS, fundLedger, fundBalance } from '../calc.js';
import { icon, on, toast, formSheet, confirmBox, empty, stat, sheet } from '../ui.js';
import { TEMPLATES, template, copyText, orgName } from '../messages.js';
import { drawCard, CARD_TEXT, CARD_VERSE } from '../card.js';
import { render } from '../main.js';

export function more() {
  const groups = [
    ['මුදල්', [['cash', 'cash', 'අත ඇති මුදල්'], ['expenses', 'bill', 'වියදම්'], ['pledges', 'gift', 'පොරොන්දු']]],
    ['පින්කම', [['events', 'calendar', 'පින්කම්'], ['tasks', 'check', 'කාර්යයන්'], ['parcels', 'bag', 'මල්ලේ ලැයිස්තුව'], ['delivery', 'truck', 'බෙදාහැරීම']]],
    ['අය', [['members', 'people', 'සාමාජිකයන්'], ['families', 'house', 'පවුල්']]],
    ['වෙනත්', [['report', 'report', 'PDF වාර්තාව'], ['photos', 'camera', 'ඡායාරූප'], ['reports', 'sheet', 'ගිණුම් වාර්තා'], ['history', 'clock', 'ඉතිහාසය'], ...(isAdmin() ? [['users', 'lock', 'කමිටුව']] : []), ['settings', 'gear', 'සැකසුම්'], ['help', 'help', 'උදව්']]],
  ];
  return {
    title: 'තවත්',
    body: html`${groups.map(([g, items]) => html`<h2 class="sec">${g}</h2><div class="tiles">${items.map(([r, ic, l]) => html`<a class="tile" href="#/${r}">${icon(ic)}<span>${l}</span></a>`)}</div>`)}
      ${S.session.sheetUrl ? html`<a class="btn ghost" target="_blank" rel="noopener noreferrer" href="${S.session.sheetUrl}">${icon('sheet')} Google Sheet එක බලන්න</a>` : ''}
      <p class="sub center">${me().name} · ${isAdmin() ? 'ප්‍රධාන' : 'මුදල් එකතු කරන්නා'}</p>`,
  };
}

/* ---------------- reports ---------------- */
let fund = 'poya';
export function reports() {
  const led = fundLedger(S.db, fund).slice().reverse();
  const years = {};
  led.forEach(r => { const y = r.event.date.slice(0, 4); (years[y] ||= { income: 0, spent: 0 }); years[y].income += r.income; years[y].spent += r.spent; });
  return {
    title: 'ගිණුම් වාර්තා', back: 'more',
    body: html`<div class="seg">${Object.entries(FUNDS).map(([k, l]) => html`<button type="button" data-f="${k}" class="${fund === k ? 'on' : ''}">${l}</button>`)}</div>
      <div class="stats">${stat('දැනට අරමුදලේ', fundBalance(S.db, fund), 'bal')}${Object.entries(years).reverse().slice(0, 1).map(([y, v]) => stat(`${y} එකතුව`, v.income, 'in'))}</div>
      ${led.length ? led.map(r => html`<a class="card replink" href="#/event?id=${r.event.id}"><div class="top"><b>${r.event.title}</b><small>${fmtDate(r.event.date)} ${r.event.date.slice(0, 4)}</small></div><table class="ledger"><tr><td>පෙර ශේෂය</td><td>${rs(r.brought)}</td></tr>${r.transfer ? html`<tr><td>අරමුදල් මාරු</td><td>${rs(r.transfer)}</td></tr>` : ''}<tr><td>+ එකතුව</td><td>${rs(r.income)}</td></tr><tr><td>− වියදම</td><td>${rs(r.spent)}</td></tr><tr class="sum"><td>ඉතිරිය</td><td>${rs(r.balance)}</td></tr></table></a>`) : empty('report', 'තවම පින්කම් නැහැ.')}
      <button type="button" class="btn ghost" data-csv>${icon('sheet')} Excel (CSV) ගොනුවක් බාගන්න</button>`,
    mount(el) {
      on(el, 'click', '[data-f]', b => { fund = b.dataset.f; render({ keepScroll: true }); });
      on(el, 'click', '[data-csv]', () => {
        const KIND = { cash: 'මුදල්', bank: 'බැංකුවට', goods: 'භාණ්ඩ' };
        const rows = [['දිනය', 'පින්කම', 'සාමාජිකයා', 'වර්ගය', 'මුදල', 'භාණ්ඩය', 'එකතු කළේ', 'සටහන'],
          ...all('donations').sort((a, b) => a.date.localeCompare(b.date)).map(d => [d.date, byId('events', d.eventId)?.title, memberName(d.memberId), KIND[d.kind], d.amount, d.goods, userName(d.collectorId), d.note])];
        download('pinpotha.csv', '﻿' + rows.map(r => r.map(csv).join(',')).join('\r\n'), 'text/csv');
      });
    },
  };
}
/** Quote for CSV and stop Excel from running cells that look like formulas. */
const csv = v => { let s = String(v ?? ''); if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------------- history ---------------- */
const TNAME = { donations: 'පරිත්‍යාගය', members: 'සාමාජිකයා', expenses: 'වියදම', events: 'පින්කම', pledges: 'පොරොන්දුව', handovers: 'මුදල් භාරදීම', families: 'පවුල', deliveries: 'බෙදාහැරීම', teams: 'කණ්ඩායම', tasks: 'කාර්යය', parcelItems: 'මල්ලේ බඩුව', settings: 'සැකසුම', openings: 'මුල් ඉතිරිය', transfers: 'අරමුදල් මාරුව', users: 'කමිටු ගිණුම', messages: 'පණිවිඩය' };
const ACT = { create: 'එක් කළා', update: 'වෙනස් කළා', delete: 'මැකුවා', restore: 'නැවත ගත්තා' };
const FNAME = { amount: 'මුදල', name: 'නම', title: 'නම', phone: 'දුරකථනය', area: 'ප්‍රදේශය', date: 'දිනය', kind: 'වර්ගය', goods: 'භාණ්ඩය', memberId: 'සාමාජිකයා', payerId: 'ගෙව්වේ', collectorId: 'එකතු කළේ', settled: 'පියවූ', status: 'තත්ත්වය', note: 'සටහන', paidBy: 'ගෙව්වේ', value: 'අගය', toId: 'ලැබුණේ', fromId: 'දුන්නේ', budget: 'අයවැය', owner: 'භාර', parcels: 'මලු', qty: 'ප්‍රමාණය', price: 'මිල', bought: 'ගත්තා' };
function show(k, v) {
  if (v === '' || v === undefined || v === null) return '—';
  if (v === true) return 'ඔව්'; if (v === false) return 'නැත';
  if (['amount', 'budget', 'price'].includes(k)) return rs(v);
  if (['memberId', 'payerId'].includes(k)) return memberName(v);
  if (['collectorId', 'paidBy', 'toId', 'fromId', 'holder'].includes(k)) return userName(v);
  return String(v);
}
export function history() {
  return {
    title: 'වෙනස්කම් ඉතිහාසය', back: 'more', keep: true,
    body: html`<p class="lead">කවුද, කවදද, මොනවද වෙනස් කළේ කියා මෙහි පෙනේ. මැකූ දේ ආපසු ගත හැක.</p><div data-list><p class="sub center">මොහොතක්…</p></div>`,
    async mount(el) {
      const box = el.querySelector('[data-list]');
      const loadRows = async () => {
        try {
          if (!isDemo()) await sync();
          const rows = isDemo() ? S.demoLog || [] : (await api('history', { limit: 200 })).rows;
          box.innerHTML = rows.length ? html`<div class="list card0">${rows.map((r, i) => {
            const rec = byId(r.table, r.recId);
            const what = r.table === 'donations' ? memberName(rec?.memberId) : r.table === 'deliveries' ? byId('families', rec?.familyId)?.name : rec?.name || rec?.title || (r.table === 'users' ? r.after.name : '') || '';
            const ch = r.action === 'update' ? Object.keys(r.after).filter(k => FNAME[k]).map(k => `${FNAME[k]}: ${show(k, r.before[k])} → ${show(k, r.after[k])}`) : r.after.amount ? [rs(r.after.amount)] : [];
            const canUndo = r.action === 'delete' && rec?.deleted && r.table !== 'users';
            return html`<div class="row hist ${r.action}"><span class="grow"><b>${TNAME[r.table] || r.table} ${ACT[r.action]}${what ? ` — ${what}` : ''}</b>${ch.map(c => html`<small>${c}</small>`)}<small>${r.userName} · ${fmtStamp(r.at)}</small></span>${canUndo ? html`<button type="button" class="btn mini" data-undo="${i}">ආපසු ගන්න</button>` : ''}</div>`;
          })}</div>` : empty('clock', 'තවම වෙනස්කම් නැහැ.');
          on(box, 'click', '[data-undo]', async b => { const r = rows[b.dataset.undo]; b.disabled = true; await put(r.table, r.recId, { deleted: false }); toast('ආපසු ගත්තා'); await loadRows(); });
        } catch (e) { box.innerHTML = empty('clock', e.code === 'network' ? 'ඉතිහාසය බැලීමට අන්තර්ජාලය අවශ්‍යයි.' : e.message); }
      };
      loadRows();
    },
  };
}

/* ---------------- settings ---------------- */
export function settings() {
  const size = document.documentElement.dataset.size;
  const A = isAdmin();
  return {
    title: 'සැකසුම්', back: 'more',
    body: html`
      <h2 class="sec">මෙම දුරකථනය</h2>
      <div class="card"><div class="lab">අකුරු ප්‍රමාණය</div><div class="seg">${[['0', 'කුඩා'], ['1', 'සාමාන්‍ය'], ['2', 'විශාල']].map(([v, l]) => html`<button type="button" data-size="${v}" class="${size === v ? 'on' : ''}">${l}</button>`)}</div></div>
      ${A ? html`<h2 class="sec">සංවිධානය</h2><div class="list card0">
        <button type="button" class="row" data-org>${icon('lotus', 'lead-i')}<span class="grow"><b>${orgName()}</b><small>නම, බැංකු විස්තර, මතක් කිරීමේ දින, ස්තුති පත</small></span>${icon('next')}</button></div>
        <h2 class="sec">පණිවිඩ වචන</h2><div class="list card0">${Object.entries(TEMPLATES).map(([k, [l]]) => html`<button type="button" class="row" data-tpl="${k}">${icon('chat', 'lead-i')}<span class="grow"><b>${l}</b>${setting('tpl_' + k) ? html`<small>වෙනස් කර ඇත</small>` : ''}</span>${icon('next')}</button>`)}</div>
        <button type="button" class="btn ghost" data-card>${icon('lotus')} ස්තුති පත බලන්න</button>
        ${isDemo() ? '' : html`<button type="button" class="btn ghost" data-invite>${icon('share')} කමිටුවට ආරාධනා link එක</button>`}` : ''}
      <h2 class="sec">ගිණුම</h2>
      <div class="stack">${isDemo() ? html`<button type="button" class="btn ghost" data-exit>අත්හදා බැලීම අවසන් කරන්න</button>` : html`<button type="button" class="btn ghost" data-pin>${icon('lock')} PIN අංකය වෙනස් කරන්න</button><button type="button" class="btn ghost" data-backup>${icon('sheet')} උපස්ථයක් (backup) බාගන්න</button><button type="button" class="btn link danger" data-out>ඉවත් වන්න</button>`}</div>`,
    mount(el) {
      on(el, 'click', '[data-size]', b => { document.documentElement.dataset.size = b.dataset.size; try { localStorage.setItem('size', b.dataset.size); } catch { /* private window */ } render({ keepScroll: true }); });
      on(el, 'click', '[data-org]', () => formSheet({
        title: 'සංවිධානය', value: { orgName: orgName(), bankDetails: setting('bankDetails'), remindDays: setting('remindDays', '4'), cardAmount: setting('cardAmount', '1') === '1', notifyEmails: setting('notifyEmails'), cardText: setting('cardText', CARD_TEXT), cardVerse: setting('cardVerse', CARD_VERSE), treasurerId: treasurerId() },
        fields: [{ key: 'orgName', label: 'සංවිධානයේ නම', required: true }, { key: 'treasurerId', label: 'භාණ්ඩාගාරික (ඉතිරි මුදල් තබා ගන්නා අය)', type: 'select', required: true, options: activeUsers().map(u => [u.id, u.name]) }, { key: 'bankDetails', label: 'බැංකු ගිණුම් විස්තර', type: 'textarea', hint: 'Group මතක් කිරීමේ පණිවිඩයට එක් වේ.' }, { key: 'remindDays', label: 'මතක් කිරීම් දින කීයකට පෙරද?', type: 'number', required: true }, { key: 'cardAmount', label: 'ස්තුති පතේ මුදල පෙන්වන්න', type: 'toggle' }, { key: 'cardText', label: 'ස්තුති පතේ පින් අනුමෝදනාව', type: 'textarea', rows: 4, required: true }, { key: 'cardVerse', label: 'ස්තුති පතේ දහම් වදන', required: true }, { key: 'notifyEmails', label: 'කමිටුවට ඊමේල් මතක් කිරීම්', hint: 'ඊමේල් ලිපින, කොමාවෙන් වෙන් කර. පොහොයට දින 4කට පෙර ඉබේම යයි.' }],
        onSave: async v => { for (const [k, x] of Object.entries(v)) { const s = k === 'cardAmount' ? (x ? '1' : '0') : String(x); if (s !== setting(k, k === 'cardAmount' ? '1' : '')) await put('settings', k, { value: s }); } toast('සුරැකුණා'); },
      }));
      on(el, 'click', '[data-tpl]', b => {
        const k = b.dataset.tpl, dflt = TEMPLATES[k][1], tags = [...new Set(dflt.match(/\{[^}]+\}/g))];
        formSheet({
          title: TEMPLATES[k][0], value: { text: template(k) },
          intro: `${tags.join(' ')} — මේවා ඉබේම පිරේ. වෙනස් නොකර තබන්න.`,
          fields: [{ key: 'text', label: 'පණිවිඩය', type: 'textarea', rows: 12, required: true }],
          onSave: async v => { await put('settings', 'tpl_' + k, { value: v.text.replace(/\r\n/g, '\n') === dflt ? '' : v.text }); toast('සුරැකුණා'); },
          deleteLabel: 'මුල් වචනවලට ආපසු', onDelete: setting('tpl_' + k) ? async () => { await put('settings', 'tpl_' + k, { value: '' }); toast('මුල් වචන යෙදුවා'); return true; } : null,
        });
      });
      on(el, 'click', '[data-card]', async () => {
        const d = all('donations').find(x => x.kind !== 'goods');
        if (!d) return toast('පළමුව පරිත්‍යාගයක් සටහන් කරන්න.');
        const c = await drawCard(d);
        sheet({ title: 'ස්තුති පත', body: html`<img class="certificate" src="${c.url}" alt="ස්තුති පතේ ආදර්ශය">` });
      });
      on(el, 'click', '[data-invite]', async () => {
        const link = `${location.origin}${location.pathname}#setup=${S.conn.id}.${S.conn.key}`;
        if (!(await confirmBox('ආරාධනා link එක', 'මෙය කමිටුවේ අයට පමණක් පුද්ගලිකව යවන්න. Group එකට දමන්න එපා.', { ok: 'Copy කරන්න', cancel: 'වසන්න' }))) return;
        toast((await copyText(link)) ? 'Copy කළා' : 'බැරි වුණා', {});
      });
      on(el, 'click', '[data-pin]', () => formSheet({
        title: 'PIN අංකය වෙනස් කරන්න',
        fields: [{ key: 'oldPin', label: 'දැනට ඇති PIN', type: 'password', required: true }, { key: 'newPin', label: 'අලුත් PIN (ඉලක්කම් 4)', type: 'password', required: true, check: v => (/^\d{4}$/.test(v) ? '' : 'ඉලක්කම් 4ක් විය යුතුයි.') }, { key: 'again', label: 'අලුත් PIN නැවත', type: 'password', required: true, check: (v, o) => (v === o.newPin ? '' : 'දෙක සමාන නැහැ.') }],
        onSave: async v => { await setToken((await api('changePin', { oldPin: v.oldPin, newPin: v.newPin })).token); toast('PIN වෙනස් කළා'); },
      }));
      on(el, 'click', '[data-backup]', () => download(`pinpotha-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ at: new Date().toISOString(), tables: S.db }, null, 1), 'application/json'));
      on(el, 'click', '[data-out]', async () => {
        if (S.outbox.length) return confirmBox('තවම නොයැවූ සටහන් ඇත', `සටහන් ${S.outbox.length}ක් Sheet එකට ගොස් නැත. අන්තර්ජාලය ඇති විට නැවත උත්සාහ කරන්න.`, { ok: 'හරි', cancel: 'වසන්න' });
        if (await confirmBox('ඉවත් වන්නද?', 'මෙම දුරකථනයේ ඇති දත්ත මැකේ. Sheet එකේ දත්ත ආරක්ෂිතයි.', { ok: 'ඉවත් වන්න' })) { location.hash = '#/home'; logout(); }
      });
      on(el, 'click', '[data-exit]', () => disconnect());
    },
  };
}

/* ---------------- committee accounts ---------------- */
export function users() {
  if (!isAdmin()) return null;
  const edit = (u = {}) => formSheet({
    title: u.id ? u.name : 'කමිටුවට අයෙක්', value: { role: 'collector', active: true, ...u },
    fields: [{ key: 'name', label: 'නම', required: true }, { key: 'phone', label: 'දුරකථනය', type: 'tel', hint: 'Group මතක් කිරීමේ පණිවිඩයේ පෙන්වයි.' },
      { key: 'role', label: 'භූමිකාව', type: 'choice', required: true, options: [['collector', 'මුදල් එකතු කරන්නා'], ['admin', 'ප්‍රධාන (භාණ්ඩාගාරික)']] },
      { key: 'pin', label: u.id ? 'අලුත් PIN' : 'PIN අංකය (ඉලක්කම් 4)', type: 'tel', required: !u.id, hint: u.id ? 'PIN අමතක වූ විට පමණක් පුරවන්න.' : 'මෙය ඔවුන්ට කියන්න. පසුව ඔවුන්ට වෙනස් කළ හැක.', check: v => (!v || /^\d{4}$/.test(v) ? '' : 'ඉලක්කම් 4ක් විය යුතුයි.') },
      ...(u.id ? [{ key: 'active', label: 'සක්‍රියයි (app එකට ඇතුළු විය හැක)', type: 'toggle' }] : [])],
    onSave: async v => {
      if (isDemo()) { await setUsers(u.id ? S.users.map(x => (x.id === u.id ? { ...x, ...v } : x)) : [...S.users, { id: 'demo-u' + Date.now(), ...v, active: true }]); return; }
      const r = await api('userSave', { user: { id: u.id, ...v, active: u.id ? v.active : true } });
      await setUsers(r.users, r.token);
      toast('සුරැකුණා');
    },
  });
  return {
    title: 'කමිටුව', back: 'more',
    body: html`<button type="button" class="btn primary huge" data-add>${icon('plus')} අයෙක් එක් කරන්න</button>
      <div class="list card0">${S.users.map(u => html`<button type="button" class="row ${u.active ? '' : 'dim'}" data-u="${u.id}"><span class="ava">${[...u.name][0]}</span><span class="grow"><b>${u.name}</b><small>${u.role === 'admin' ? 'ප්‍රධාන' : 'මුදල් එකතු කරන්නා'}${u.active ? '' : ' · අක්‍රිය'}</small></span>${icon('next')}</button>`)}</div>
      <section class="card note"><b>ප්‍රධාන</b>: වියදම්, පින්කම්, පවුල් අනුමත කිරීම, ගිණුම් වැසීම සියල්ල.<br><b>මුදල් එකතු කරන්නා</b>: තමන් එකතු කළ මුදල් සටහන් කිරීම, පණිවිඩ, පවුල් යෝජනා කිරීම, බෙදාහැරීම සලකුණු කිරීම.</section>`,
    mount(el) {
      on(el, 'click', '[data-add]', () => edit());
      on(el, 'click', '[data-u]', b => edit(S.users.find(u => u.id === b.dataset.u)));
    },
  };
}

/* ---------------- help ---------------- */
export function help() {
  const QA = [
    ['මුදලක් ලැබුණු විට', 'පහළ මැද ඇති ලොකු + බොත්තම ඔබන්න → නම තෝරන්න → මුදල ඔබන්න → සුරකින්න. ඉන්පසු WhatsApp බොත්තම ඔබා ස්තුති පණිවිඩය යවන්න.'],
    ['ස්තුති පත (පින්තූරය) යවන්නේ කෙසේද?', 'පළමුව ස්තුති පණිවිඩය යවන්න. එවිට ඒ අය WhatsApp හි මුලින්ම පෙනේ. ඉන්පසු "ස්තුති පත" → "පින්තූරය යවන්න" → WhatsApp → ඒ අය තෝරන්න.'],
    ['අන්තර්ජාලය නැති විට', 'කිසි ගැටලුවක් නැහැ. සටහන් දුරකථනයේ සුරැකේ. අන්තර්ජාලය ලැබුණු විට app එක විවෘත කළ විට ඉබේම Sheet එකට යයි. ඉහළ දකුණේ "සුරැකුණා" පෙනේ නම් සියල්ල ගොස් ඇත.'],
    ['වැරදීමක් වුණොත්', '"එකතුව" → අදාළ අය → "වෙනස් කරන්න" හෝ "මකන්න". මැකූ දේ "තවත් → ඉතිහාසය" තුළින් ආපසු ගත හැක.'],
    ['කා ළඟ කීයක් තියෙනවාද?', 'මුල් පිටුවේ සහ "තවත් → අත ඇති මුදල්" තුළ හැමෝටම පෙනේ. මුදලක් සටහන් කළ විට එකතු කළ අයගේ ගණනට එකතු වේ; වියදමක් සටහන් කළ විට ගෙවූ අයගෙන් අඩු වේ. වෙනත් කිසිවක් කළ යුතු නැහැ.'],
    ['සිංහලෙන් type කරන්න අමාරු නම්', 'නම English අකුරෙන් ගසන්න. උදා: Anula හෝ perera ගැසූ විට අනුලා, පෙරේරා ලැබේ.'],
    ['පොහොයට පෙර මතක් කිරීම්', 'දින 4කට පෙර සිට මුල් පිටුවේ පෙනේ. "පණිවිඩ → මතක් කිරීම්" ගොස් එකින් එක යවන්න. දැනටමත් මුදල් දුන් අය ලැයිස්තුවේ නැහැ.'],
    ['මාසික PDF එක group එකට', '"තවත් → PDF වාර්තාව". එක් එක් නම, ගම සහ මුදල බලා ✓ කරන්න. වැරදි නම් ඒ මත ඔබා වෙනස් කරන්න හෝ මකන්න. සියල්ල ✓ වූ පසු "PDF සාදන්න" → බලා → "WhatsApp group එකට යවන්න".'],
    ['ඡායාරූප එකතුවක් (collage)', '"තවත් → ඡායාරූප" → Camera හෝ Gallery. හොඳ ඒවා තෝරන්න → මෝස්තරය සහ වර්ණය තෝරන්න → යවන්න. ඡායාරූප දුරකථනයෙන් පිටතට යන්නේ ඔබ යැවූ විට පමණි.'],
    ['දුරකථනයේ app එකක් ලෙස දැමීම', 'Android: Chrome ⋮ → "Add to Home screen". iPhone: Safari Share → "Add to Home Screen", පසුව ආරාධනා link එක එහි paste කරන්න.'],
  ];
  return { title: 'උදව්', back: 'more', body: html`${QA.map(([q, a], i) => html`<details class="qa" ${i ? '' : 'open'}><summary>${q}</summary><p>${a}</p></details>`)}` };
}

