// Monthly PDF: first every name, village and amount is checked (and fixed here), then the PDF is made.
import { S, me, byId, put, remove, isAdmin, userName, activeUsers } from '../store.js';
import { search } from '../search.js';
import { html, rs } from '../util.js';
import { eventStats, parcelTotals, plannedParcels, reportRows, reviewIssues, rowSignature } from '../calc.js';
import { icon, on, toast, formSheet, sheet, empty, stat, bar, confirmBox, areas } from '../ui.js';
import { activeEvent, chooseEvent, eventBar, wireEventBar } from './home.js';
import { buildReport, SORTS, PARTS } from '../report-pdf.js';
import { shareFile, saveFile, canShareFiles } from '../share.js';
import { render } from '../main.js';

/* ---- ticks: kept on this phone; hold no names, and lapse when the line changes ---- */
const key = id => 'rv-' + id;
const readTicks = id => { try { return JSON.parse(localStorage.getItem(key(id)) || '{}'); } catch { return memory[id] || {}; } };
const memory = {};
const saveTicks = (id, t) => { memory[id] = t; try { localStorage.setItem(key(id), JSON.stringify(t)); } catch { /* private window */ } };

let filter = 'todo', query = '', sort = 'name', parts = Object.keys(PARTS);

export function report({ e }) {
  if (e && byId('events', e) && !byId('events', e).deleted) chooseEvent(e);
  const ev = activeEvent();
  if (!ev) return { title: 'PDF වාර්තාව', back: 'more', body: empty('report', 'තවම පින්කමක් නැහැ.') };
  const closed = ev.status === 'closed';
  const rows = reportRows(S.db, ev.id), issues = reviewIssues(rows), ticks = readTicks(ev.id);
  const ok = r => ticks[r.d.id] === rowSignature(r);
  const done = rows.filter(ok).length, bad = rows.filter(r => issues[r.d.id] && !ok(r)).length;
  const st = eventStats(S.db, ev.id), n = plannedParcels(S.db, ev), par = parcelTotals(S.db, ev.id, n);
  const ready = rows.length > 0 && done === rows.length;
  const canEdit = r => !closed && (isAdmin() || r.d.collectorId === me().id);
  const item = r => html`<div class="row check-row ${ok(r) ? 'okrow' : issues[r.d.id] ? 'warn' : ''}">
    <label class="tick"><input type="checkbox" data-t="${r.d.id}" ${ok(r) ? 'checked' : ''} aria-label="${r.m.name} නිවැරදියි"><span></span></label>
    <button type="button" class="rowbtn" data-e="${r.d.id}"><b>${r.m.name || '(නම නැත)'}</b><small>${r.m.area || 'ගම සඳහන් නැත'} · ${userName(r.d.collectorId)}</small>${issues[r.d.id] && !ok(r) ? html`<small class="issue">${icon('alert')} ${issues[r.d.id].join(' · ')}</small>` : ''}</button>
    <strong>${r.d.kind === 'goods' ? r.d.goods : rs(r.d.amount)}</strong>${icon('edit')}</div>`;

  return {
    title: 'PDF වාර්තාව', back: 'more',
    body: html`${eventBar(ev)}
      <ol class="stepper"><li class="${ready ? 'ok' : 'on'}"><b>1</b> පරීක්ෂා කරන්න</li><li class="${ready ? 'on' : ''}"><b>2</b> PDF සාදන්න</li><li><b>3</b> Group එකට</li></ol>
      <div class="stats">${stat('මුළු එකතුව', st.total, 'in')}${stat('සටහන්', `${rows.length}`)}${stat('බඩු මලු', `${n || 0}`)}${stat('එක මල්ලක වටිනාකම', par.perParcel, 'bal')}</div>
      ${rows.length ? html`
        <div class="progress"><span><b>${done}</b> / ${rows.length} පරීක්ෂා කර ඇත</span>${bar(done, rows.length)}</div>
        ${bad ? html`<p class="banner warn">${icon('alert')}<span>විශේෂයෙන් බැලිය යුතු සටහන් ${bad}ක් ඇත.</span></p>` : ''}
        <p class="sub">නම, ගම සහ මුදල බලා නිවැරදි නම් ✓ කරන්න. වැරදි නම් ඒ මත ඔබා වෙනස් කරන්න. වෙනස් කළ විට නැවත ✓ කළ යුතුයි.</p>
        <div class="seg"><button type="button" data-f="todo" class="${filter === 'todo' ? 'on' : ''}">බැලිය යුතු (${rows.length - done})</button><button type="button" data-f="all" class="${filter === 'all' ? 'on' : ''}">සියල්ල (${rows.length})</button></div>
        <div class="search">${icon('search')}<input type="search" placeholder="නම හෝ ගම — සිංහල හෝ English" value="${query}" aria-label="සොයන්න"></div>
        <div class="list card0" data-list></div>` : empty('coins', 'මෙම පින්කමට තවම පරිත්‍යාග සටහන් කර නැහැ.')}
      ${closed ? html`<p class="banner">${icon('lock')}<span>ගිණුම් වසා ඇති නිසා නම සහ ගම පමණක් වෙනස් කළ හැක.</span></p>` : html`<a class="btn ghost" href="#/donate">${icon('plus')} අමතක වූ පරිත්‍යාගයක් එක් කරන්න</a>`}
      <div class="list card0"><a class="row" href="#/parcels">${icon('bag', 'lead-i')}<span class="grow"><b>බඩු මල්ලේ අන්තර්ගතය</b><small>${par.items.length ? `බඩු වර්ග ${par.items.length} · ${rs(par.perParcel)}` : 'තවම එක් කර නැත'} · මලු ${n || 0}</small></span>${icon('next')}</a></div>
      <details class="more"><summary>PDF එකේ පිළිවෙළ සහ කොටස්</summary><div class="lab">නම් පෙළගැස්ම</div><div class="chips">${Object.entries(SORTS).map(([k, [l]]) => html`<label class="chip"><input type="radio" name="srt" value="${k}" ${sort === k ? 'checked' : ''}><span>${l}</span></label>`)}</div><div class="lab">අමතර කොටස්</div><div class="chips">${Object.entries(PARTS).map(([k, l]) => html`<label class="chip"><input type="checkbox" data-part="${k}" ${parts.includes(k) ? 'checked' : ''}><span>${l}</span></label>`)}</div></details>
      ${rows.length && !ready ? html`<button type="button" class="btn ghost" data-all>${icon('check')} ඉතිරි ${rows.length - done} නිවැරදියි</button>` : ''}
      <button type="button" class="btn gold huge" data-make ${ready ? '' : 'disabled'}>${icon('report')} PDF සාදන්න</button>
      ${ready || !rows.length ? '' : html`<p class="sub center">සියලු නම් පරීක්ෂා කළ පසු PDF එක සෑදිය හැක.</p>`}`,
    mount(el) {
      wireEventBar(el, render);
      const list = el.querySelector('[data-list]');
      const draw = () => {
        if (!list) return;
        const show = search(rows.filter(r => filter === 'all' || !ok(r)), query, r => ({ text: [r.m.name, r.m.area] })).sort((a, b) => !!issues[b.d.id] - !!issues[a.d.id]);
        list.innerHTML = show.length ? html`${show.map(item)}` : empty('check', query ? 'හමු වුණේ නැහැ.' : 'සියල්ල පරීක්ෂා කර අවසන්. සාදු!');
      };
      draw();
      el.querySelector('input[type=search]')?.addEventListener('input', x => { query = x.target.value; draw(); });
      on(el, 'click', '[data-f]', b => { filter = b.dataset.f; render({ keepScroll: true }); });
      on(el, 'change', '[data-t]', b => {
        const t = readTicks(ev.id), r = rows.find(x => x.d.id === b.dataset.t);
        if (b.checked) t[r.d.id] = rowSignature(r); else delete t[r.d.id];
        saveTicks(ev.id, t);
        setTimeout(() => render({ keepScroll: true }), 250); // let the tick show before the line moves away
      });
      on(el, 'click', '[data-e]', b => editRow(rows.find(r => r.d.id === b.dataset.e), canEdit, ev));
      on(el, 'click', '[data-all]', async () => {
        if (!(await confirmBox('සියල්ල නිවැරදිද?', `${bad ? `බැලිය යුතු සටහන් ${bad}ක් තවම ඇත.\n` : ''}ඉතිරි ${rows.length - done} නම්, ගම් සහ මුදල් ඔබ පරීක්ෂා කළාද?`, { ok: 'ඔව්, නිවැරදියි', cancel: 'නැවත බලන්නම්' }))) return;
        saveTicks(ev.id, Object.fromEntries(rows.map(r => [r.d.id, rowSignature(r)])));
        render({ keepScroll: true });
      });
      on(el, 'change', '[name=srt]', b => { sort = b.value; });
      on(el, 'change', '[data-part]', b => { parts = b.checked ? [...parts, b.dataset.part] : parts.filter(p => p !== b.dataset.part); });
      on(el, 'click', '[data-make]', b => make(ev, b));
    },
  };
}

/** Everything about one printed line in a single form: the person and the gift. */
function editRow(r, canEdit, ev) {
  const { d, m } = r, full = canEdit(r), goods = v => v.kind === 'goods';
  return formSheet({
    title: 'නිවැරදි කරන්න',
    value: { name: m.name, area: m.area, anon: m.anon, kind: d.kind, amount: d.kind === 'goods' ? '' : d.amount, goods: d.goods, collectorId: d.collectorId },
    intro: full ? '' : ev.status === 'closed' ? 'ගිණුම් වසා ඇති නිසා නම සහ ගම පමණක් වෙනස් කළ හැක.' : `මුදල වෙනස් කළ හැක්කේ ${userName(d.collectorId)}ට හෝ ප්‍රධාන අයට පමණි.`,
    fields: [
      { key: 'name', label: 'නම', required: true },
      { key: 'area', label: 'ගම', required: true, list: areas() },
      { key: 'anon', label: 'වාර්තාවේ නම නොපෙන්වන්න', type: 'toggle' },
      ...(full ? [
        { key: 'kind', label: 'වර්ගය', type: 'choice', required: true, options: [['cash', 'අතට මුදල්'], ['bank', 'බැංකුවට'], ['goods', 'ද්‍රව්‍ය']] },
        { key: 'amount', label: 'මුදල', type: 'money', required: true, when: v => !goods(v) },
        { key: 'goods', label: 'ද්‍රව්‍යය', required: true, when: goods },
        ...(isAdmin() ? [{ key: 'collectorId', label: 'එකතු කළ අය', type: 'select', required: true, options: activeUsers().some(u => u.id === d.collectorId) ? activeUsers().map(u => [u.id, u.name]) : [...activeUsers().map(u => [u.id, u.name]), [d.collectorId, userName(d.collectorId)]] }] : []),
      ] : []),
    ],
    onSave: async v => {
      await put('members', m.id, { name: v.name, area: v.area, anon: v.anon });
      if (full) {
        const p = goods(v) ? { kind: 'goods', goods: v.goods, amount: d.kind === 'goods' ? d.amount : '' } : { kind: v.kind, amount: v.amount, goods: '' };
        if (v.collectorId) p.collectorId = v.collectorId;
        await put('donations', d.id, p);
      }
      toast('සුරැකුණා. දැන් ✓ කරන්න.');
    },
    deleteLabel: 'මෙම පරිත්‍යාගය මකන්න',
    onDelete: full ? async () => {
      if (!(await confirmBox('මකන්නද?', `${m.name} — ${d.kind === 'goods' ? d.goods : rs(d.amount)}`, { ok: 'මකන්න', danger: true }))) return false;
      await remove('donations', d.id);
      toast('මැකුවා', { undo: () => put('donations', d.id, { deleted: false }) });
      return true;
    } : null,
  });
}

async function make(ev, btn) {
  btn.disabled = true; btn.textContent = 'PDF එක සාදමින්…';
  let out;
  try { out = await buildReport(ev, { sort, parts }); } catch (e) { console.error(e); toast('PDF එක සෑදිය නොහැකි වුණා. නැවත උත්සාහ කරන්න.', { bad: true }); return render({ keepScroll: true }); }
  await sheet({
    title: 'PDF වාර්තාව', cls: 'tall',
    body: html`<div class="pdfpages">${out.previews.map((u, i) => html`<img src="${u}" alt="පිටුව ${i + 1}">`)}</div>
      <div class="stack sticky"><button type="button" class="btn wa huge" data-share>${icon('share')} WhatsApp group එකට යවන්න</button><button type="button" class="btn ghost" data-save>${icon('hand')} දුරකථනයට බාගන්න</button>${canShareFiles(out.file) ? '' : html`<p class="sub center">මෙම උපාංගයෙන් කෙලින්ම share කළ නොහැක. බාගෙන WhatsApp හි 📎 මගින් යවන්න.</p>`}</div>`,
    mount: b => {
      on(b, 'click', '[data-share]', async () => { if ((await shareFile(out.file)) === 'saved') toast('PDF එක බාගත වුණා. WhatsApp හි 📎 මගින් යවන්න.'); });
      on(b, 'click', '[data-save]', () => { saveFile(out.file); toast('PDF එක බාගත වුණා.'); });
    },
  });
  out.previews.forEach(u => URL.revokeObjectURL(u));
  render({ keepScroll: true });
}
