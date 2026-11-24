// The most-used flow: who → how much → done → thank them. One question per page.
import { S, all, me, byId, put, remove, isAdmin, isDemo, activeUsers, memberName } from '../store.js';
import { html, rs, money, today, uid, waNumber, byName } from '../util.js';
import { eventStats, pledgeStatus } from '../calc.js';
import { icon, waIcon, on, toast, mountPicker, pickerHtml, pickMember, memberForm, empty } from '../ui.js';
import { activeEvent, eventBar, wireEventBar } from './home.js';
import { compose, openWhatsApp, markSent, wasSent, pendingFor, copyText } from '../messages.js';
import { drawCard, shareCard, canShareFiles } from '../card.js';
import { go, render } from '../main.js';

const QUICK = [500, 1000, 2000, 5000];

export function donate({ m: memberId }) {
  const ev = activeEvent();
  if (!ev || ev.status === 'closed') return { title: 'මුදලක් සටහන් කරන්න', body: empty('calendar', ev ? 'මෙම පින්කමේ ගිණුම් වසා ඇත.' : 'පළමුව පින්කමක් එක් කළ යුතුයි.', html`${ev ? eventBar(ev) : html`<a class="btn primary" href="#/events">පින්කම් බලන්න</a>`}`), mount: el => wireEventBar(el, render) };
  const member = memberId && byId('members', memberId);
  return member ? amountStep(ev, member) : whoStep(ev);
}

function whoStep(ev) {
  const st = eventStats(S.db, ev.id);
  const sums = {};
  all('donations').filter(d => d.eventId === ev.id).forEach(d => { sums[d.memberId] = (sums[d.memberId] || 0) + Number(d.kind === 'goods' ? 0 : d.amount); });
  return {
    title: 'කවුද දුන්නේ?', keep: true,
    body: html`${eventBar(ev)}${pickerHtml()}`,
    mount(el) {
      wireEventBar(el, render);
      mountPicker(el, {
        onPick: m => go(`donate?m=${m.id}`),
        // people who have not given yet come first
        sort: (a, b) => st.donors.has(a.id) - st.donors.has(b.id) || byName(a, b),
        badge: m => (st.donors.has(m.id) ? `✓ දුන්නා ${sums[m.id] ? rs(sums[m.id]) : ''}` : ''),
      });
    },
  };
}

function amountStep(ev, m) {
  const pledge = pledgeStatus(S.db, ev.id).find(p => p.pledge.memberId === m.id && p.due > 0);
  const given = all('donations').filter(d => d.eventId === ev.id && d.memberId === m.id);
  const quick = [...new Set([pledge?.due, Number(m.usual) || 0, ...QUICK].filter(Boolean))].slice(0, 6);
  let kind = 'cash', payer = null, busy = false;
  return {
    title: 'කොපමණද?', focus: true, keep: true, back: 'donate',
    body: html`
      <div class="who"><span class="ava">${[...m.name][0]}</span><span class="grow"><b>${m.name}</b><small>${ev.title}</small></span><a class="btn mini" href="#/donate">වෙනස් කරන්න</a></div>
      ${given.length ? html`<p class="banner warn">${icon('alert')}<span>මෙම අය දැනටමත් ${given.map(d => (d.kind === 'goods' ? d.goods : rs(d.amount))).join(', ')} දී ඇත. තව එකක් නම් පමණක් සටහන් කරන්න.</span></p>` : ''}
      ${pledge ? html`<p class="banner">${icon('gift')}<span>පොරොන්දු වූ මුදලෙන් ${rs(pledge.due)} ලැබීමට ඇත.</span></p>` : ''}
      <form novalidate>
        <div class="chips three">
          ${[['cash', 'cash', 'අතට මුදල්'], ['bank', 'bank', 'බැංකුවට'], ['goods', 'box', 'භාණ්ඩ']].map(([v, ic, l]) => html`<label class="chip tall"><input type="radio" name="kind" value="${v}" ${v === 'cash' ? 'checked' : ''}>${icon(ic)}<span>${l}</span></label>`)}
        </div>
        <div data-money>
          <div class="moneybox huge"><span>රු.</span><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="මුදල"></div>
          <div class="quick">${quick.map(q => html`<button type="button" data-q="${q}">${money(q)}</button>`)}</div>
        </div>
        <div data-goods hidden>
          <div class="field"><label for="g">මොනවද දුන්නේ?</label><input id="g" name="goods" placeholder="උදා: හාල් කිලෝ 10" autocomplete="off"></div>
          <div class="field"><label for="gv">දළ වටිනාකම <small>(අවශ්‍ය නම්)</small></label><div class="moneybox"><span>රු.</span><input id="gv" name="value" inputmode="decimal" placeholder="0"></div></div>
        </div>
        <label class="toggle card0" data-behalf><input type="checkbox" name="behalf"><span class="sw"></span><span><b>වෙන කෙනෙක් වෙනුවෙන් ගෙව්වා</b><small>${m.name} වෙනුවෙන් තව කෙනෙක් මුදල් දුන්නා නම්</small></span></label>
        <button type="button" class="pick" data-payer hidden><span>මුදල් දුන්නේ කවුද? තෝරන්න</span>${icon('next')}</button>
        <details class="more"><summary>දිනය / සටහනක් එක් කරන්න</summary>
          <div class="field"><label for="d">දිනය</label><input id="d" type="date" name="date" value="${today()}" max="${today()}"></div>
          ${isAdmin() ? html`<div class="field"><label for="c">මුදල් එකතු කළේ</label><select id="c" name="collectorId">${activeUsers().map(u => html`<option value="${u.id}" ${u.id === me().id ? 'selected' : ''}>${u.name}</option>`)}</select></div>` : ''}
          <div class="field"><label for="n">සටහන</label><input id="n" name="note" autocomplete="off"></div>
        </details>
        <p class="err big" data-err hidden></p>
        <div class="stack sticky"><button class="btn primary huge">${icon('check')} <span data-save>සුරකින්න</span></button></div>
      </form>`,
    mount(el) {
      const f = el.querySelector('form'), $ = s => el.querySelector(s);
      const num = s => Number(String(s).replace(/[,\s]/g, ''));
      const draw = () => {
        kind = f.elements.kind.value;
        $('[data-money]').hidden = kind === 'goods';
        $('[data-goods]').hidden = kind !== 'goods';
        $('[data-behalf]').hidden = kind === 'goods';
        $('[data-payer]').hidden = kind === 'goods' || !f.elements.behalf.checked;
        const a = num(f.elements.amount.value);
        $('[data-save]').textContent = kind !== 'goods' && a > 0 ? `${rs(a)} සුරකින්න` : 'සුරකින්න';
        $('[data-err]').hidden = true;
      };
      f.addEventListener('input', draw);
      on(f, 'click', '[data-q]', b => { f.elements.amount.value = b.dataset.q; draw(); });
      const choosePayer = async () => { const p = await pickMember({ title: 'මුදල් දුන්නේ කවුද?', exclude: m.id }); if (p) { payer = p; $('[data-payer] span').textContent = `මුදල් දුන්නේ: ${p.name}`; } };
      f.elements.behalf.addEventListener('change', () => { if (f.elements.behalf.checked && !payer) choosePayer(); });
      on(f, 'click', '[data-payer]', choosePayer);
      f.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        const err = t => { $('[data-err]').textContent = t; $('[data-err]').hidden = false; $('[data-err]').scrollIntoView({ block: 'center' }); };
        const amount = num(kind === 'goods' ? f.elements.value.value || 0 : f.elements.amount.value);
        const goods = kind === 'goods' ? f.elements.goods.value.trim() : '';
        if (kind === 'goods' ? !goods : !(amount > 0)) return err(kind === 'goods' ? 'දුන් භාණ්ඩය ලියන්න.' : 'මුදල ඇතුළත් කරන්න.');
        if (!(amount >= 0)) return err('වටිනාකම ඉලක්කම් වලින් ලියන්න.');
        const behalf = kind !== 'goods' && f.elements.behalf.checked;
        if (behalf && !payer) return err('මුදල් දුන්නේ කවුදැයි තෝරන්න.');
        busy = true;
        const id = await put('donations', uid(), {
          eventId: ev.id, memberId: m.id, kind, amount: kind === 'goods' && !amount ? '' : amount, goods,
          collectorId: f.elements.collectorId?.value || me().id, payerId: behalf ? payer.id : '', settled: false, settledAt: '',
          date: f.elements.date.value || today(), note: f.elements.note.value.trim(),
        });
        navigator.vibrate?.(40);
        go(`thanks?id=${id}`, true);
      });
      f.elements.amount.focus({ preventScroll: true });
    },
  };
}

/* ---- after saving ---- */
const LABEL = { thanks: 'ස්තුති පණිවිඩය යවන්න', behalfAsk: 'දැනුම් දෙන්න', behalfPay: 'ස්තුති පණිවිඩය යවන්න' };

/** Message buttons for one donation; shared with the donation detail screen. */
export function messageButtons(d) {
  const steps = d.payerId
    ? [['behalfAsk', d.memberId, 'ඉල්ලූ අය — මුදල මතක් කර දෙන්න කියා'], ['behalfPay', d.payerId, 'ගෙවූ අය — ස්තුති කර, මුදල ලබා ගන්න කියා']]
    : [['thanks', d.memberId, '']];
  const cards = d.payerId ? [d.memberId, d.payerId] : [d.memberId];
  return html`${steps.map(([k, mid, sub]) => {
    const mem = byId('members', mid), sent = wasSent(k, d.id, mid);
    return html`<div class="msgstep ${sent ? 'sent' : ''}">${sub ? html`<p class="sub">${sub}</p>` : ''}
      ${waNumber(mem?.phone) ? html`<button type="button" class="btn wa huge" data-msg="${k}" data-mem="${mid}">${waIcon}<span><b>${mem.name}</b><small>${sent ? '✓ යවා ඇත — නැවත යවන්න' : LABEL[k]}</small></span></button>`
        : html`<button type="button" class="btn ghost" data-addphone="${mid}">${icon('phone')} ${mem?.name || ''}: WhatsApp අංකය එක් කරන්න</button><button type="button" class="btn link" data-copymsg="${k}" data-mem="${mid}">${icon('copy')} පණිවිඩය copy කරන්න</button>`}</div>`;
  })}
  <div class="cardprev" data-cardprev>${cards.map(mid => html`<button type="button" class="btn gold" data-card="${mid}">${icon('lotus')}<span>${cards.length > 1 ? `${memberName(mid)} — ` : ''}ස්තුති පත (පින්තූරය)</span></button>`)}</div>`;
}
export function wireMessageButtons(el, d, redraw) {
  on(el, 'click', '[data-msg]', b => {
    const { msg, mem } = b.dataset;
    openWhatsApp(byId('members', mem).phone, compose(msg, { eventId: d.eventId, memberId: mem, donation: d }));
    markSent(msg, d.id, mem, d.eventId);
  });
  on(el, 'click', '[data-copymsg]', async b => {
    toast((await copyText(compose(b.dataset.copymsg, { eventId: d.eventId, memberId: b.dataset.mem, donation: d }))) ? 'Copy කළා. කැමති තැනක paste කරන්න.' : 'Copy කළ නොහැකි වුණා.');
  });
  on(el, 'click', '[data-addphone]', async b => { if (await memberForm(byId('members', b.dataset.addphone), S.users)) redraw(); });
  on(el, 'click', '[data-card]', async b => showCard(el, d, b.dataset.card));
}
async function showCard(el, d, memberId) {
  const { sheet } = await import('../ui.js');
  const card = await drawCard(d, { forMember: memberId });
  await sheet({
    title: 'ස්තුති පත',
    body: html`<img class="certificate" src="${card.url}" alt="${memberName(memberId)} සඳහා පින් අනුමෝදනා පත"><p class="sub center">${canShareFiles(card.file) ? html`පහත බොත්තම ඔබා <b>WhatsApp</b> තෝරා, <b>${memberName(memberId)}</b> තෝරන්න.` : 'පින්තූරය copy වූ පසු WhatsApp Web එකේ paste (Ctrl+V) කරන්න.'}</p><div class="stack"><button type="button" class="btn wa huge" data-share>${icon('share')} පින්තූරය යවන්න</button></div>`,
    mount: b => on(b, 'click', '[data-share]', async () => {
      const r = await shareCard(card);
      if (r === 'copied') toast('පින්තූරය copy කළා. WhatsApp එකේ paste කරන්න.');
      if (r === 'saved') toast('පින්තූරය බාගත වුණා.');
      if (r !== 'cancelled') markSent('card', d.id, memberId, d.eventId);
    }),
  });
  URL.revokeObjectURL(card.url);
}

export function thanks({ id }) {
  const d = byId('donations', id);
  if (!d || d.deleted) return null;
  const left = pendingFor(d).length;
  return {
    title: 'සටහන් වුණා', focus: true, back: 'home',
    body: html`
      <div class="done"><span class="tick">${icon('check')}</span><h2>${d.kind === 'goods' ? d.goods : rs(d.amount)}</h2><p>${memberName(d.memberId)}${d.payerId ? html`<br><small>වෙනුවෙන් ගෙව්වේ: ${memberName(d.payerId)}</small>` : ''}</p>${isDemo() ? '' : html`<small>${S.outbox.length ? 'දුරකථනයේ සුරැකුණා. සම්බන්ධතාවය ලැබුණු විට Sheet එකට යයි.' : 'Google Sheet එකටත් එකතු වුණා ✓'}</small>`}</div>
      <div class="stack" data-msgs>${messageButtons(d)}</div>
      <div class="stack foot"><a class="btn primary" href="#/donate">${icon('plus')} තව මුදලක් සටහන් කරන්න</a><a class="btn link" href="#/home">${left ? 'පණිවිඩය පසුව යවන්නම්' : 'මුල් පිටුවට'}</a><button type="button" class="btn link danger" data-undo>වැරදියි — මෙය මකන්න</button></div>`,
    mount(el) {
      wireMessageButtons(el, d, render);
      on(el, 'click', '[data-undo]', async () => { await remove('donations', d.id); toast('මැකුවා', { undo: () => put('donations', d.id, { deleted: false }) }); go('donate', true); });
    },
  };
}
