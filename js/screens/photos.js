// Photos of a pinkama: take or pick them, choose the good ones, and share a collage.
// Pictures stay on this phone only — they are never uploaded anywhere.
import { byId, localGet, localSet } from '../store.js';
import { html, fmtDateLong, uid } from '../util.js';
import { icon, on, toast, sheet, empty, confirmBox } from '../ui.js';
import { activeEvent, chooseEvent, eventBar, wireEventBar } from './home.js';
import { eventLabel, orgName } from '../messages.js';
import { drawCollage, STYLES, THEMES, MAX } from '../collage.js';
import { shareFile, saveFile } from '../share.js';
import { render } from '../main.js';

const POOL = 30, SIDE = 1400;
const opts = { style: 'mosaic', theme: 'night', seed: 7, note: '' };

/** Shrink a camera photo (and apply its rotation) so thirty of them fit in memory. */
async function shrink(file) {
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
    img = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image')); }; i.src = u; });
  }
  const k = Math.min(1, SIDE / Math.max(img.width, img.height)), cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  img.close?.();
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88));
  cv.width = cv.height = 0;
  return blob;
}

export function photos({ e }) {
  if (e && byId('events', e) && !byId('events', e).deleted) chooseEvent(e);
  const ev = activeEvent();
  if (!ev) return { title: 'ඡායාරූප', back: 'more', body: empty('camera', 'තවම පින්කමක් නැහැ.') };
  return {
    title: 'ඡායාරූප එකතුව', back: 'more', keep: true,
    body: html`${eventBar(ev)}
      <div class="two"><label class="btn primary">${icon('camera')} Camera<input type="file" accept="image/*" capture="environment" data-file hidden></label><label class="btn ghost">${icon('image')} Gallery<input type="file" accept="image/*" multiple data-file hidden></label></div>
      <p class="sub" data-info></p>
      <div class="thumbs" data-thumbs></div>
      <section data-make hidden>
        <div class="collage"><canvas data-cv aria-label="ඡායාරූප එකතුවේ පෙරදසුන"></canvas></div>
        <button type="button" class="btn ghost" data-shuffle>${icon('sync')} වෙනත් විදිහකට</button>
        <div class="lab">මෝස්තරය</div><div class="chips">${Object.entries(STYLES).map(([k, l]) => html`<label class="chip"><input type="radio" name="style" value="${k}" ${opts.style === k ? 'checked' : ''}><span>${l}</span></label>`)}</div>
        <div class="lab">වර්ණය</div><div class="chips">${Object.entries(THEMES).map(([k, t]) => html`<label class="chip swatch"><input type="radio" name="theme" value="${k}" ${opts.theme === k ? 'checked' : ''}><span><i style="background:linear-gradient(${t.bg[0]},${t.bg[1]})"></i>${t.label}</span></label>`)}</div>
        <div class="field"><label for="cn">වචනයක් එක් කරන්න <small>(අවශ්‍ය නම්)</small></label><input id="cn" data-note maxlength="60" value="${opts.note}" placeholder="උදා: පවුල් 20කට බඩු මලු පිරිනැමුවා" autocomplete="off"></div>
        <div class="stack"><button type="button" class="btn wa huge" data-share>${icon('share')} WhatsApp group එකට යවන්න</button><button type="button" class="btn ghost" data-save>${icon('hand')} දුරකථනයට බාගන්න</button></div>
        <p class="banner">${icon('lock')}<span>ආධාර ලබන අයගේ ගෞරවය රකිමු: මුහුණු පෙනෙන ඡායාරූප යැවීමට පෙර ඔවුන්ගේ කැමැත්ත ගන්න.</span></p>
      </section>`,
    mount: el => mount(el, ev),
  };
}

async function mount(el, ev) {
  wireEventBar(el, render);
  const KEY = 'photos-' + ev.id, $ = s => el.querySelector(s);
  const alive = () => el.contains($('[data-thumbs]'));
  let list = [], imgs = new Map(), urls = new Map(), drawing = false, again = false, ready = null;
  const picked = () => list.filter(p => p.on);
  const persist = () => localSet(KEY, list);

  const bitmap = async p => { if (!imgs.has(p.id)) imgs.set(p.id, await createImageBitmap(p.blob)); return imgs.get(p.id); };
  const url = p => { if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); return urls.get(p.id); };
  const drop = id => { imgs.get(id)?.close?.(); imgs.delete(id); if (urls.has(id)) URL.revokeObjectURL(urls.get(id)); urls.delete(id); };

  function thumbs() {
    const n = picked().length;
    $('[data-info]').textContent = list.length ? `තෝරා ඇත ${n} / ${list.length} (උපරිම ${MAX}). ඡායාරූපය ඔබා තෝරන්න හෝ ඉවත් කරන්න.` : 'ඡායාරූප මෙම දුරකථනයේ පමණක් තබා ගනී. Camera එකෙන් ගන්න, නැත්නම් gallery එකෙන් කිහිපයක් තෝරන්න.';
    $('[data-thumbs]').innerHTML = html`${list.map((p, i) => html`<div class="thumb ${p.on ? 'on' : ''}"><button type="button" data-tg="${p.id}" aria-pressed="${p.on}" aria-label="ඡායාරූපය ${i + 1}"><img src="${url(p)}" alt="" loading="lazy">${p.on ? html`<span class="num">${picked().indexOf(p) + 1}</span>` : ''}</button><button type="button" class="dots3" data-opt="${p.id}" aria-label="ඡායාරූප ${i + 1} සැකසුම්">⋯</button></div>`)}`;
    $('[data-make]').hidden = !n;
  }
  async function draw() {
    if (drawing) { again = true; return; }
    const sel = picked();
    if (!sel.length) return;
    drawing = true; ready = null;
    try {
      const ph = [];
      for (const p of sel) ph.push({ img: await bitmap(p), focus: p.focus });
      if (alive()) {
        const cv = $('[data-cv]');
        await drawCollage(cv, ph, { ...opts, title: eventLabel(ev), date: fmtDateLong(ev.date), org: orgName() });
        // Encoded ahead of time: phones only allow sharing straight from the tap.
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
        if (blob && !again) ready = new File([blob], `Danata-Pin-Aththo-${ev.date}.jpg`, { type: 'image/jpeg' });
      }
    } catch (x) { console.error(x); toast('ඡායාරූපය ඇඳිය නොහැකි වුණා.', { bad: true }); }
    drawing = false;
    if (again) { again = false; draw(); }
  }
  const refresh = () => { thumbs(); draw(); };

  list = (await localGet(KEY)) || [];
  if (!alive()) return;
  refresh();

  el.querySelectorAll('[data-file]').forEach(inp => inp.addEventListener('change', async () => {
    const files = [...inp.files];
    inp.value = '';
    if (!files.length) return;
    $('[data-info]').textContent = 'ඡායාරූප සූදානම් කරමින්…';
    let failed = 0;
    for (const f of files) {
      if (list.length >= POOL) { toast(`උපරිම ඡායාරූප ${POOL}යි.`); break; }
      try { list.push({ id: uid(), blob: await shrink(f), on: picked().length < MAX, focus: 0.4 }); } catch { failed++; }
    }
    await persist();
    if (failed) toast(`ඡායාරූප ${failed}ක් විවෘත කළ නොහැකි වුණා.`, { bad: true });
    if (alive()) refresh();
  }));
  on(el, 'click', '[data-tg]', b => {
    const p = list.find(x => x.id === b.dataset.tg);
    if (!p.on && picked().length >= MAX) return toast(`එක වරකට ඡායාරූප ${MAX}ක් පමණයි.`);
    p.on = !p.on; persist(); refresh();
  });
  on(el, 'click', '[data-opt]', async b => {
    const p = list.find(x => x.id === b.dataset.opt);
    const act = await sheet({
      title: 'ඡායාරූපය', cls: 'small',
      body: html`<img class="optimg" src="${url(p)}" alt=""><div class="lab">පෙනිය යුතු කොටස</div><div class="seg">${[[0, 'ඉහළ'], [0.4, 'මැද'], [1, 'පහළ']].map(([f, l]) => html`<button type="button" data-a="f${f}" class="${p.focus === f ? 'on' : ''}">${l}</button>`)}</div><div class="stack"><button type="button" class="btn ghost" data-a="main">${icon('lotus')} ප්‍රධාන ඡායාරූපය කරන්න</button><button type="button" class="btn link danger" data-a="del">${icon('trash')} මෙතැනින් ඉවත් කරන්න</button></div>`,
      mount: (d, close) => on(d, 'click', '[data-a]', x => close(x.dataset.a)),
    });
    if (!act) return;
    if (act === 'main') { list = [p, ...list.filter(x => x !== p)]; p.on = true; if (picked().length > MAX) picked().pop().on = false; }
    else if (act === 'del') { if (!(await confirmBox('ඉවත් කරන්නද?', 'මෙම ඡායාරූපය app එකෙන් ඉවත් වේ. Gallery එකේ ඇති එක එලෙසම තිබේ.', { ok: 'ඉවත් කරන්න', danger: true }))) return; list = list.filter(x => x !== p); drop(p.id); }
    else p.focus = Number(act.slice(1));
    persist(); refresh();
  });
  el.addEventListener('change', x => { if (x.target.name === 'style' || x.target.name === 'theme') { opts[x.target.name] = x.target.value; draw(); } });
  let nt;
  $('[data-note]').addEventListener('input', x => { opts.note = x.target.value.trim(); clearTimeout(nt); nt = setTimeout(draw, 500); });
  on(el, 'click', '[data-shuffle]', () => {
    opts.seed = (opts.seed % 997) + 1;
    const sel = picked(), rest = list.filter(p => !p.on);
    for (let i = sel.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sel[i], sel[j]] = [sel[j], sel[i]]; }
    list = [...sel, ...rest]; persist(); refresh();
  });
  const wait = () => { if (!ready) toast('මොහොතක් ඉන්න…'); return ready; };
  on(el, 'click', '[data-share]', async () => { const f = wait(); if (f && (await shareFile(f)) === 'saved') toast('බාගත වුණා. WhatsApp හි 📎 මගින් යවන්න.'); });
  on(el, 'click', '[data-save]', () => { const f = wait(); if (f) { saveFile(f); toast('බාගත වුණා.'); } });
}
