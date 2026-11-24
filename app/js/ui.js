// Reusable interface pieces: icons, toast, dialogs, forms, member picker.
import { search } from './search.js';
import { html, raw, norm, byName, prettyPhone, today, rs } from './util.js';
import { all, put, me, byId, memberName } from './store.js';

/* ---- icons (24px stroke) ---- */
const P = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
  coins: 'M12 3c4 0 7 1.3 7 3s-3 3-7 3-7-1.3-7-3 3-3 7-3ZM5 6v6c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3 3 7 3s7-1.3 7-3v-6',
  plus: 'M12 5v14M5 12h14', chat: 'M4 5h16v11H9l-5 4V5Z', more: 'M4 6h16M4 12h16M4 18h16',
  back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', check: 'M4.5 12.5l5 5 10-11', close: 'M6 6l12 12M18 6 6 18',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2 .8 3.200 2.500 3.500 5.500',
  house: 'M4 11 12 4l8 7v9H4v-9ZM12 17.500c-2-1.300-3-2.300-3-3.500a1.500 1.500 0 0 1 3-.4 1.500 1.500 0 0 1 3 .4c0 1.200-1 2.200-3 3.500Z',
  truck: 'M2.500 6h11v10h-11V6ZM13.500 10h4l3.500 3.500V16h-7.500M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  bag: 'M5 8h14l-1 12H6L5 8ZM9 8V6.500a3 3 0 0 1 6 0V8', bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',
  hand: 'M12 3v10M8 9l4 4 4-4M4 14v5.500h16V14', promise: 'M12 20s-7-4.300-7-9.500A3.800 3.800 0 0 1 12 8a3.800 3.800 0 0 1 7 2.500C19 15.700 12 20 12 20Z',
  swap: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4', calendar: 'M4 6h16v14H4V6ZM4 10h16M8 3v4M16 3v4', report: 'M5 20V10M12 20V4M19 20v-7M3 20h18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.500 2', gear: 'M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M18.700 5.300l-2.100 2.100M7.400 16.600l-2.100 2.100',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.300-1 .8-1 1.700M12 16.500v.2', edit: 'M4 20l1-4L16 5l3 3L8 19l-4 1Z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  phone: 'M6 3h4l1.500 5-2.500 1.500a12 12 0 0 0 5.500 5.500L16 12.500l5 1.500v4c0 1.500-1.500 3-3 3C10 21 3 14 3 6c0-1.500 1.500-3 3-3Z', pin: 'M12 21s-7-6-7-11.500a7 7 0 0 1 14 0C19 15 12 21 12 21ZM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z',
  copy: 'M9 9h11v11H9V9ZM5 15H4V4h11v1', share: 'M12 15V4M8 7.500 12 3.500l4 4M5 12v8h14v-8', search: 'M10.500 17a6.500 6.500 0 1 0 0-13 6.500 6.500 0 0 0 0 13ZM15.500 15.500 20.500 20.500',
  gift: 'M4 11h16v9H4v-9ZM3 7h18v4H3V7ZM12 7v13M12 7c-2 0-4-.8-4-2.500S11 3 12 7c1-4 4-4 4-2.500S14 7 12 7Z', bank: 'M3 9l9-5 9 5H3ZM5 9v9M10 9v9M14 9v9M19 9v9M3 20h18', cash: 'M3 6h18v12H3V6ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9.500v5M18 9.500v5',
  camera: 'M4 8h4l1.500-2.500h5L16 8h4v11H4V8ZM12 16.500a3.300 3.300 0 1 0 0-6.600 3.300 3.300 0 0 0 0 6.600Z', image: 'M4 5h16v14H4V5ZM4 16l5-5 4 4 2.500-2.500L20 17M15 10a1.200 1.200 0 1 0 0-2.400 1.200 1.200 0 0 0 0 2.400Z',
  lotus: 'M12 19c-3-2-4.500-5-4.500-7.500S9.500 7 12 4.500c2.500 2.500 4.500 4.500 4.500 7S15 17 12 19ZM7.500 11C5 10.500 3.500 11 2.500 12c1 4 4.500 7 9.500 7 5 0 8.500-3 9.500-7-1-1-2.500-1.500-5-1', lock: 'M6 11h12v9H6v-9ZM8.500 11V8a3.500 3.500 0 0 1 7 0v3', sync: 'M20 8A8.500 8.500 0 0 0 5 7.500M4 4v4h4M4 16a8.500 8.500 0 0 0 15 .5M20 20v-4h-4', alert: 'M12 4 2.500 20h19L12 4ZM12 10v5M12 17.500v.2', sheet: 'M4 4h16v16H4V4ZM4 9h16M4 14.500h16M10 9v11', box: 'M4 8l8-4 8 4v8l-8 4-8-4V8ZM4 8l8 4 8-4M12 12v8',
};
export const icon = (n, cls = '') => raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || ''}"/></svg>`);
export const waIcon = raw('<svg class="i wa" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.200-4.200A8 8 0 1 1 8.300 19L4 20ZM9 8.500c-.5 1.500 0 3 1.500 4.500s3.500 2.200 4.700 1.700"/></svg>');

/* ---- toast ---- */
let toastTimer;
export function toast(msg, { undo, bad } = {}) {
  const el = document.getElementById('toast');
  el.className = 'toast show' + (bad ? ' bad' : '');
  el.innerHTML = html`<span>${msg}</span>${undo ? html`<button type="button">ආපසු ගන්න</button>` : ''}`;
  // Keep the toast above any open dialog.
  (document.querySelector('dialog[open]:last-of-type') || document.body).append(el);
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('show'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), undo ? 7000 : 3500);
}
function parkToast() { const el = document.getElementById('toast'); if (el.parentElement !== document.body) document.body.append(el); }

/* ---- delegated events ---- */
export function on(el, type, sel, fn) {
  el.addEventListener(type, e => { const t = e.target.closest(sel); if (t && el.contains(t)) fn(t, e); });
}

/* ---- dialogs ---- */
/** Opens a full-width sheet. `mount(body, close)` wires it up. Resolves with whatever close() got. */
export function sheet({ title, body, mount, cls = '' }) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.className = 'sheet ' + cls;
    d.innerHTML = html`<div class="sheet-in"><header><h2 tabindex="-1" autofocus>${title}</h2><button type="button" class="iconbtn" data-close aria-label="වසන්න">${icon('close')}</button></header><div class="sheet-body">${body}</div></div>`;
    document.body.append(d);
    let out;
    const close = v => { out = v; d.close(); };
    d.addEventListener('close', () => { parkToast(); d.remove(); res(out); });
    d.addEventListener('click', e => { if (e.target === d && !d.querySelector('form')) close(); });
    on(d, 'click', '[data-close]', () => close());
    d.showModal();
    mount?.(d.querySelector('.sheet-body'), close);
  });
}
export const confirmBox = (title, text, { ok = 'ඔව්', cancel = 'නැහැ', danger } = {}) => sheet({
  title, cls: 'small',
  body: html`<p class="lead">${text}</p><div class="stack"><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button><button type="button" class="btn ghost" data-close>${cancel}</button></div>`,
  mount: (b, close) => on(b, 'click', '[data-ok]', () => close(true)),
});

/* ---- forms ---- */
// field: { key, label, type, options:[[value,label]], required, hint, placeholder, value, when(values) }
function fieldHtml(f, v) {
  const id = 'f-' + f.key;
  const val = v ?? '';
  const lab = html`<label for="${id}">${f.label}${f.required ? '' : html` <small>${f.optional ?? '(අවශ්‍ය නම්)'}</small>`}</label>`;
  const hint = f.hint ? html`<p class="hint">${f.hint}</p>` : '';
  const wrap = inner => html`<div class="field" data-field="${f.key}">${inner}${hint}<p class="err" hidden></p></div>`;
  switch (f.type) {
    case 'toggle': return html`<div class="field" data-field="${f.key}"><label class="toggle"><input type="checkbox" name="${f.key}" ${raw(val ? 'checked' : '')}><span class="sw"></span><span>${f.label}</span></label>${hint}<p class="err" hidden></p></div>`;
    case 'choice': return wrap(html`<div class="lab">${f.label}</div><div class="chips">${f.options.map(([o, l]) => html`<label class="chip"><input type="radio" name="${f.key}" value="${o}" ${raw(String(o) === String(val) ? 'checked' : '')}><span>${l}</span></label>`)}</div>`);
    case 'select': return wrap(html`${lab}<select id="${id}" name="${f.key}">${f.required && val ? '' : html`<option value="">— තෝරන්න —</option>`}${f.options.map(([o, l]) => html`<option value="${o}" ${raw(String(o) === String(val) ? 'selected' : '')}>${l}</option>`)}</select>`);
    case 'textarea': return wrap(html`${lab}<textarea id="${id}" name="${f.key}" rows="${f.rows || 3}" placeholder="${f.placeholder || ''}">${val}</textarea>`);
    case 'money': return wrap(html`${lab}<div class="moneybox"><span>රු.</span><input id="${id}" name="${f.key}" inputmode="decimal" autocomplete="off" value="${val}" placeholder="0"></div>${f.quick ? html`<div class="quick">${f.quick.map(q => html`<button type="button" data-quick="${q}">${q.toLocaleString()}</button>`)}</div>` : ''}`);
    case 'member': return wrap(html`<div class="lab">${f.label}</div><button type="button" class="pick" data-pick="${f.key}"><span>${val ? memberName(val) : 'තෝරන්න'}</span>${icon('next')}</button><input type="hidden" name="${f.key}" value="${val}">`);
    case 'number': return wrap(html`${lab}<input id="${id}" name="${f.key}" inputmode="decimal" autocomplete="off" value="${val}" placeholder="${f.placeholder || ''}">`);
    default: return wrap(html`${lab}<input id="${id}" name="${f.key}" type="${f.type || 'text'}" autocomplete="off" value="${val}" placeholder="${f.placeholder || ''}" ${raw(f.list ? `list="${id}-l"` : '')}>${f.list ? html`<datalist id="${id}-l">${[...new Set(f.list)].filter(Boolean).map(x => html`<option value="${x}">`)}</datalist>` : ''}`);
  }
}
const parseNum = s => String(s).replace(/[,\s]/g, '');

export function readForm(form, fields) {
  const fd = new FormData(form), v = {};
  fields.forEach(f => { v[f.key] = f.type === 'toggle' ? fd.has(f.key) : String(fd.get(f.key) ?? '').trim(); });
  return v;
}
/** Shows one sheet with a form. onSave(values) may throw to show an error. Resolves to true when saved. */
export function formSheet({ title, fields, value = {}, saveLabel = 'සුරකින්න', onSave, onDelete, deleteLabel = 'මකන්න', intro }) {
  return sheet({
    title,
    body: html`<form novalidate>${intro ? html`<p class="lead">${intro}</p>` : ''}${fields.map(f => fieldHtml(f, value[f.key] !== undefined && value[f.key] !== '' ? value[f.key] : f.value))}
      <p class="err big" data-formerr hidden></p>
      <div class="stack sticky"><button class="btn primary">${saveLabel}</button>${onDelete ? html`<button type="button" class="btn link danger" data-del>${icon('trash')} ${deleteLabel}</button>` : ''}</div></form>`,
    mount(body, close) {
      const form = body.querySelector('form');
      const vis = () => { const v = readForm(form, fields); fields.forEach(f => { if (f.when) form.querySelector(`[data-field="${f.key}"]`).hidden = !f.when(v); }); };
      vis();
      form.addEventListener('input', vis);
      on(form, 'click', '[data-quick]', b => { const i = b.closest('.field').querySelector('input'); i.value = b.dataset.quick; vis(); });
      on(form, 'click', '[data-pick]', async b => {
        const m = await pickMember({ title: b.closest('.field').querySelector('.lab').textContent });
        if (m) { form.elements[b.dataset.pick].value = m.id; b.querySelector('span').textContent = m.name; vis(); }
      });
      if (onDelete) on(form, 'click', '[data-del]', async () => { if (await onDelete()) close(true); });
      let busy = false;
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        const v = readForm(form, fields);
        let first;
        fields.forEach(f => {
          const box = form.querySelector(`[data-field="${f.key}"]`), err = box.querySelector('.err');
          let m = '';
          if (!box.hidden) {
            if (f.type === 'money' || f.type === 'number') {
              v[f.key] = parseNum(v[f.key]);
              if (v[f.key] !== '' && !(Number(v[f.key]) >= 0)) m = 'ඉලක්කම් පමණක් ඇතුළත් කරන්න.';
              else if (f.required && !(Number(v[f.key]) > 0)) m = 'මෙය පුරවන්න.';
              else if (v[f.key] !== '') v[f.key] = Number(v[f.key]);
            } else if (f.required && !v[f.key]) m = 'මෙය පුරවන්න.';
            m ||= f.check?.(v[f.key], v) || '';
          } else if (f.when) v[f.key] = f.type === 'toggle' ? false : '';
          err.textContent = m; err.hidden = !m;
          if (m) first ||= box;
        });
        if (first) { first.scrollIntoView({ block: 'center' }); first.querySelector('input,select,textarea')?.focus({ preventScroll: true }); return; }
        busy = true;
        const btn = form.querySelector('.btn.primary'), t = btn.textContent;
        btn.disabled = true; btn.textContent = 'මොහොතක්…';
        try { if ((await onSave(v)) !== false) close(true); } catch (x) { const fe = form.querySelector('[data-formerr]'); fe.textContent = x.message; fe.hidden = false; }
        busy = false; btn.disabled = false; btn.textContent = t;
      });
    },
  });
}

/* ---- members ---- */
export const areas = () => [...all('members').map(m => m.area), ...all('families').map(f => f.area)];
export function memberForm(m = {}, users = []) {
  let saved;
  return formSheet({
    title: m.id ? 'සාමාජිකයාගේ විස්තර' : 'අලුත් සාමාජිකයෙක්',
    value: m,
    fields: [
      { key: 'name', label: 'නම', required: true, placeholder: 'උදා: සුනිල් පෙරේරා', check: (v, o) => !m.id && all('members').some(x => norm(x.name) === norm(v) && prettyPhone(x.phone) === prettyPhone(o.phone)) ? 'මේ නම දැනටමත් ලැයිස්තුවේ ඇත.' : '' },
      { key: 'phone', label: 'WhatsApp අංකය', type: 'tel', placeholder: '077 123 4567' },
      { key: 'area', label: 'ගම / ප්‍රදේශය', list: areas() },
      { key: 'usual', label: 'සාමාන්‍යයෙන් දෙන මුදල', type: 'money' },
      { key: 'collectorId', label: 'මතක් කිරීම භාර අය', type: 'select', options: users.filter(u => u.active).map(u => [u.id, u.name]), value: m.id ? '' : me().id },
      { key: 'anon', label: 'Group වාර්තාවල නම නොපෙන්වන්න', type: 'toggle' },
      { key: 'noRemind', label: 'මතක් කිරීම් යවන්න එපා', type: 'toggle' },
      ...(m.id ? [{ key: 'inactive', label: 'දැන් සහභාගී නොවේ (ලැයිස්තුවෙන් සඟවන්න)', type: 'toggle' }] : []),
      { key: 'note', label: 'සටහන', type: 'textarea', rows: 2 },
    ],
    onSave: async v => { saved = await put('members', m.id, { inactive: false, ...v }); toast('සුරැකුණා'); },
  }).then(ok => (ok && saved ? byId('members', saved) : null));
}

/** Search-first member picker. `rank` sorts, `badge(m)` adds a small note under the name. */
export function pickMember({ title = 'සාමාජිකයා තෝරන්න', exclude, badge } = {}) {
  return sheet({
    title, cls: 'tall',
    body: pickerHtml(),
    mount: (b, close) => mountPicker(b, { onPick: close, exclude, badge }),
  });
}
export const pickerHtml = () => html`<div class="search">${icon('search')}<input type="search" placeholder="නම — සිංහල හෝ English (Anula)" aria-label="සොයන්න" autocomplete="off"></div><div class="list" data-list></div>`;
export function mountPicker(el, { onPick, exclude, badge, sort = byName }) {
  const input = el.querySelector('input[type=search]'), list = el.querySelector('[data-list]');
  const draw = () => {
    const q = input.value.trim();
    const rows = search(all('members').filter(m => !m.inactive && m.id !== exclude).sort(sort), q, m => ({ phone: m.phone, text: [m.name, m.area] }));
    const add = html`<button type="button" class="row add" data-new>${icon('plus', 'lead-i')}<span class="grow"><b>${q ? `“${input.value.trim()}” අලුතින් එක් කරන්න` : 'අලුත් සාමාජිකයෙක් එක් කරන්න'}</b></span></button>`;
    list.innerHTML = html`${q && !rows.length ? add : ''}${rows.slice(0, 200).map(m => html`<button type="button" class="row" data-m="${m.id}"><span class="ava">${[...String(m.name)][0]}</span><span class="grow"><b>${m.name}</b><small>${badge?.(m) || [m.area, prettyPhone(m.phone)].filter(Boolean).join(' · ')}</small></span>${icon('next')}</button>`)}${q && !rows.length ? '' : add}`;
  };
  draw();
  input.addEventListener('input', draw);
  on(list, 'click', '[data-m]', b => onPick(byId('members', b.dataset.m)));
  on(list, 'click', '[data-new]', async () => {
    const { S } = await import('./store.js');
    const m = await memberForm({ name: input.value.trim().replace(/^[\d\s+]+$/, '') }, S.users);
    if (m) onPick(m);
  });
}

/* ---- little building blocks ---- */
export const empty = (ic, text, btn = '') => html`<div class="empty">${icon(ic)}<p>${text}</p>${btn}</div>`;
export const bar = (val, max) => html`<div class="bar"><i style="width:${max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0}%"></i></div>`;
export const stat = (label, val, cls = '') => html`<div class="stat ${cls}"><small>${label}</small><b>${typeof val === 'number' ? rs(val) : val}</b></div>`;
export const dateField = (key = 'date', label = 'දිනය') => ({ key, label, type: 'date', required: true, value: today() });

