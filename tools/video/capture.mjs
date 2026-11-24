// Step 1: drives the real app at phone size and saves every screen plus a timeline.
import fs from 'node:fs';
import path from 'node:path';
import { seededBackend, serve, browser, sleep } from './lib.mjs';

const OUT = process.argv[2];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const DAY = '2026-12-19', PIN = '1234'; // throw-away local login
const VW = 390, VH = 780;

const { be, key } = seededBackend(DAY, PIN);
const srv = await serve(be, {});
const shift = Date.parse(DAY + 'T04:00:00Z') - Date.now();
const b = await browser({
  width: VW, height: VH, scale: 2,
  init: `(() => { const D = Date, s = ${shift}; window.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(D.now() + s); } static now() { return D.now() + s; } };
    window.__opened = []; window.open = u => { window.__opened.push(u); return null; };
    navigator.canShare = () => true; navigator.share = async () => {};
    try { Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined }); delete Navigator.prototype.serviceWorker; } catch {} })();`,
});
const base = `http://localhost:${srv.port}/`;

/* ---------------- timeline ---------------- */
const T = [];               // { img, dur, cap, sec, rect?, admin?, kind? }
let sec = 0, secTitle = '', cap = '', admin = false, n = 0;
const read = s => Math.max(1.9, 0.9 + [...s].length * 0.045);
async function shot() {
  const f = `s${String(n++).padStart(4, '0')}.jpg`;
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64'));
  return f;
}
const section = (title, isAdmin = false) => { sec++; secTitle = title; admin = isAdmin; T.push({ kind: 'title', title, sec, admin, dur: 1.7 }); };
const push = (img, dur, extra = {}) => T.push({ img, dur, cap, sec, title: secTitle, admin, ...extra });
/** Say something about what is on screen. */
async function say(text, extra = {}) { cap = text; push(await shot(), read(text), extra); }

const find = sel => `(() => { const s = ${JSON.stringify(sel)}; const scope = document.querySelector('dialog[open]:last-of-type') || document;
  if (s.startsWith('text=')) { const t = s.slice(5); return [...scope.querySelectorAll('button,a,label,summary,.row')].filter(e => e.offsetParent !== null && e.textContent.includes(t)).sort((x, y) => x.textContent.length - y.textContent.length)[0]; }
  return scope.querySelector(s) || document.querySelector(s); })()`;
async function until(sel, ms = 8000) { for (let t = 0; t < ms; t += 60) { if (await b.ev(`!!${find(sel)}`)) return; await sleep(60); } throw new Error('missing ' + sel + ' at ' + await b.ev('location.hash') + '\n' + (await b.ev('document.body.innerText')).slice(0, 400)); }

/** Smoothly bring an element into view (or scroll by px), recording as it moves. */
async function scrollTo(sel, frames = 12, block = 0.5) {
  await until(sel);
  const { from, to, inDialog } = await b.ev(`(() => { const e = ${find(sel)}, sc = e.closest('.sheet-body'), r = e.getBoundingClientRect(); const cur = sc ? sc.scrollTop : scrollY, vis = r.top > 70 && r.bottom < ${VH} - 100; const want = cur + r.top + r.height / 2 - ${VH} * ${block}; const max = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - innerHeight; return { from: cur, to: vis ? cur : Math.max(0, Math.min(max, want)), inDialog: !!sc }; })()`);
  if (Math.abs(to - from) < 8) return;
  for (let i = 1; i <= frames; i++) {
    const k = i / frames, y = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    await b.ev(`(() => { const sc = ${inDialog} ? document.querySelector('dialog[open]:last-of-type .sheet-body') : null; sc ? sc.scrollTo(0, ${y}) : scrollTo(0, ${y}); })()`);
    push(await shot(), 0.055, { cut: true });
  }
}
async function rectOf(sel) { return b.ev(`(() => { const r = ${find(sel)}.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`); }
/** Point at something, tap it, wait for the result. */
async function tap(sel, text, { wait = 450, click = true, hold = 0 } = {}) {
  if (text) cap = text;
  await scrollTo(sel);
  const img = await shot(), rect = await rectOf(sel);
  push(img, text ? Math.max(read(text), 2.2) + hold : 1.25, { rect });
  if (click) await b.ev(`(() => { const e = ${find(sel)}; e.focus?.({ preventScroll: true }); e.click(); })()`);
  await sleep(wait);
}
async function point(sel, text) { return tap(sel, text, { click: false, wait: 0 }); }
async function type(sel, value, text) {
  if (text) { cap = text; push(await shot(), read(text), { rect: await rectOf(sel) }); }
  const chars = [...value];
  for (let i = 1; i <= chars.length; i++) {
    await b.ev(`(() => { const e = ${find(sel)}; e.value = ${JSON.stringify(chars.slice(0, i).join(''))}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(40);
    push(await shot(), chars.length > 12 ? 0.07 : 0.16, { cut: true });
  }
}
/** An illustration of the chat that opens, with the real message text the app wrote. */
async function chat(text, to) {
  const url = await b.ev('window.__opened.at(-1)');
  cap = text;
  T.push({ kind: 'chat', to, msg: decodeURIComponent(url.split('text=')[1]), dur: read(text) + 1.4, cap, sec, title: secTitle, admin });
}
const nav = async (hash, w = 450) => { await b.ev(`location.hash = '#/${hash}'`); await sleep(w); };
const settle = async () => { for (let i = 0; i < 60; i++) { if (await b.ev(`(await import('/js/store.js')).S.outbox.length === 0 && (await import('/js/store.js')).S.status === 'idle'`)) return; await sleep(100); } };
const toastOff = async () => { await b.ev(`document.getElementById('toast').classList.remove('show')`); await sleep(280); };
/** Show the way: the bottom tab, or "තවත්" and then a tile. */
async function viaTab(tab, text) { await b.ev('scrollTo(0,0)'); await tap(`.tabs a[href="#/${tab}"]`, text); }
async function viaMore(tile, name) {
  await nav('home'); await b.ev('scrollTo(0,0)');
  cap = `“තවත්” ඔබා, “${name}” ඔබන්න.`;
  push(await shot(), 2.1, { rect: await rectOf('.tabs a[href="#/more"]') });
  await nav('more');
  await tap(`.tile[href="#/${tile}"]`);
}

/* ---------------- the story ---------------- */
T.push({ kind: 'intro', dur: 5 });

section('ඇතුළු වීම');
await b.go(`${base}#setup=local.${key}`);
await until('text=නිමල්');
await say('ඔබට ලැබුණු ආරාධනා link එක ඔබන්න. මෙම තිරය පෙනේවි.');
await tap('text=නිමල්', 'ඔබේ නම තෝරන්න.');
cap = 'ඔබේ රහස් අංකය (PIN) ඔබන්න. නැවත නැවත අවශ්‍ය නැහැ, එක් වරක් පමණයි.';
push(await shot(), read(cap));
for (const c of PIN) { const r = await rectOf(`[data-n="${c}"]`); push(await shot(), 0.45, { rect: r, cut: true }); await b.ev(`document.querySelector('[data-n="${c}"]').click()`); await sleep(90); }
await until('.hero'); await settle();
await b.ev(`Promise.all(['700 30px "Abhaya Libre"', '400 16px "Noto Sans Sinhala"', '600 16px "Noto Sans Sinhala"', '700 16px "Noto Sans Sinhala"'].map(x => document.fonts.load(x, 'පොහොය')))`); await sleep(700);

section('මුල් පිටුව');
await say('මුල් පිටුවේ ඊළඟ පින්කම, සහ ඊට තව දින කීයක් තියෙනවාද කියා පෙනේ. පොහොය ළං වන විට සඳ පිරේ.');
await point('[data-todo]', 'ඔබ අද කළ යුතු දේ මෙතැන තියෙනවා. ඔබා කෙලින්ම එතැනට යන්න.');
await scrollTo('.stats', 14, 0.45);
await say('එකතු වූ මුදල, වියදම සහ ඉතිරිය ඉබේම ගණනය වේ.');

section('මුදලක් සටහන් කිරීම');
await b.ev('scrollTo(0,0)');
await tap('.tabs .big', 'මැද ඇති ලොකු + බොත්තම ඔබන්න.');
await type('main input[type=search]', 'Anula', 'නම ගසන්න. සිංහල අමාරු නම් English අකුරෙන් ගැසුවත් හරි.');
await tap('main [data-m]', 'අදාළ අය තෝරන්න.');
await tap('[data-q="1000"]', 'මුදල ඔබන්න. නැතිනම් ගණන ලියන්න.');
await tap('main form .btn.primary', '“සුරකින්න” ඔබන්න. එච්චරයි!', { wait: 900 });
await until('.done'); await settle(); await sleep(300); await toastOff();
await say('මුදල සටහන් වුණා. Google Sheet එකටත් ඉබේම එකතු වුණා.');
await tap('[data-msg="thanks"]', 'දැන් ස්තුති පණිවිඩය යවමු. කොළ පාට බොත්තම ඔබන්න.', { wait: 500 });
await chat('පණිවිඩය ලියවිලා WhatsApp විවෘත වේ. යවන්න (Send) ඔබන්න විතරයි.', 'අනුලා මැණිකේ');
await settle();
await tap('[data-card]', 'ස්තුති පතක් (පින්තූරයක්) යවන්නත් පුළුවන්.', { wait: 1800 });
await until('.certificate');
await say('නම සහ මුදල ඇතුළත් ලස්සන ස්තුති පත සූදානම්. “පින්තූරය යවන්න” ඔබන්න.');
await b.ev(`document.querySelector('dialog').close()`); await sleep(300);

section('භාණ්ඩ පරිත්‍යාග');
await nav('donate');
await type('main input[type=search]', 'kusum', 'මුදල් වෙනුවට භාණ්ඩ දුන්නත් එලෙසමයි. නම තෝරන්න.');
await tap('main [data-m]');
await tap('input[name=kind][value=goods]', '“භාණ්ඩ” ඔබන්න.');
await type('input[name=goods]', 'හාල් කිලෝ 10', 'දුන් දේ ලියන්න.');
await tap('main form .btn.primary', 'සුරකින්න.', { wait: 900 });
await until('.done'); await settle(); await toastOff();

section('එකතුව');
await nav('home'); await viaTab('collection', 'පහළ “එකතුව” ඔබන්න.');
await say('මුදල් දුන් සියලු දෙනා මෙහි පෙනේ.');
await tap('[data-v="wait"]', 'තවම නොදුන් අය බලන්න මෙතැන ඔබන්න.');
await say('නමක් ඔබා ඔවුන්ගේ මුදල කෙලින්ම සටහන් කළ හැකියි.');
await b.ev(`document.querySelector('[data-v="given"]').click()`); await sleep(300);
await tap('text=අනුලා මැණිකේ', 'වැරදීමක් වුණාද? ඒ නම ඔබන්න.');
await point('[data-edit]', '“වෙනස් කරන්න” ඔබා නිවැරදි කරන්න. නැතිනම් “මකන්න”.');

section('මතක් කිරීමේ පණිවිඩ');
await nav('home'); await viaTab('messages', 'පොහොයට දින 4කට පෙර සිට මතක් කිරීම් යවමු. “පණිවිඩ” ඔබන්න.');
await tap('a[href*="kind=remind"]', '“මතක් කිරීම්” ඔබන්න. තවම නොදුන් අය පමණක් පෙනේ.');
await tap('[data-send="0"]', 'එකින් එක යවන්න. එක් ඔබීමයි.', { wait: 500 });
await chat('මතක් කිරීම ලියවිලා තියෙනවා. Send ඔබා ආපසු එන්න.', 'සාමාජිකයා');
await settle(); await toastOff();
await say('ආපසු ආ විට ඊළඟ කෙනා සූදානම්. කීයක් යැවුවාද කියාත් පෙනේ.');

section('Group එකට පණිවිඩ');
await nav('messages');
await tap('a[href*="t=list"]', 'මුදල් දුන් අයගේ ලැයිස්තුව group එකට දමන්න මෙතැන ඔබන්න.');
await say('නම් සහ මුදල් ඉබේම ලියවී ඇත. “WhatsApp group එකට යවන්න” ඔබන්න.');
await nav('group?t=finance&e=demo-old');
await say('ගිණුම් සාරාංශයත් එලෙසමයි. පවුල්වල නම් පෙන්වන්නේ නැහැ, ගම සහ ගණන පමණයි.');

section('පොරොන්දු වූ මුදල්');
await viaMore('pledges', 'පොරොන්දු');
await say('“මම දෙනවා” කියා පොරොන්දු වූ අය මෙහි සටහන් කරන්න. මුදල ලැබුණු විට ඉබේම ✓ වේ.');

section('අත ඇති මුදල්');
await viaMore('cash', 'අත ඇති මුදල්');
await say('කා ළඟ කීයක් තියෙනවාද කියා හැමෝටම පෙනේ. ඔබ කිසිවක් කළ යුතු නැහැ, ඉබේම ගණනය වේ.');

section('වියදම්', true);
await viaMore('expenses', 'වියදම්');
await tap('[data-add]', 'වියදමක් සටහන් කරන්න මෙතැන ඔබන්න.');
await until('dialog form');
await type('dialog [name=title]', 'හාල් කිලෝ 100');
await type('dialog [name=amount]', '22000', 'මොකටද, කීයද කියා ලියන්න.');
await b.ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(900); await settle(); await toastOff();
await say('වියදම එකතු වුණා. ඉතිරිය ඉබේම අඩු වුණා.');

section('බඩු මල්ලේ ලැයිස්තුව', true);
await viaMore('parcels', 'මල්ලේ ලැයිස්තුව');
await say('මල්ලකට දාන බඩු සහ මිල මෙහි තියෙනවා. මුළු වියදම ඉබේම ගණනය වේ.');
await tap('[data-b]', 'බඩුව ගත් පසු ✓ කරන්න.');
await settle();
await scrollTo('[data-share]');
await point('[data-share]', 'කඩේට ලැයිස්තුව මෙතැනින් යවන්න.');

section('පවුල් සහ බෙදාහැරීම');
await viaMore('families', 'පවුල්');
await say('ආධාර ලබන පවුල් ගම අනුව පෙනේ. මේවා පෙනෙන්නේ කමිටුවට පමණයි.');
await viaMore('delivery', 'බෙදාහැරීම');
await say('කණ්ඩායම අනුව යා යුතු නිවාස පෙනේ. සිතියමත් විවෘත කළ හැකියි.');
await tap('[data-done]', 'බඩු මල්ල දුන් පසු මෙතැන ඔබන්න.', { wait: 700 });
await settle(); await toastOff();
await say('භාර දුන්නා! ඉතිරි නිවාස ගණන ඉහළින් පෙනේ.');

section('PDF වාර්තාව');
await viaMore('report', 'PDF වාර්තාව');
await say('මාසයේ වාර්තාව PDF එකක් ලෙස හදමු. පළමුව නම් පරීක්ෂා කරමු.');
await scrollTo('.check-row', 14, 0.4);
await say('නම, ගම සහ මුදල හරිද බලන්න.');
await tap('.check-row [data-e]', 'වැරදි නම් ඒ මත ඔබා නිවැරදි කරන්න.');
await until('dialog form');
await say('මෙතැන වෙනස් කරන්න, නැතිනම් මකන්න පුළුවන්.');
await b.ev(`document.querySelector('dialog').close()`); await sleep(300);
await tap('.check-row [data-t]', 'හරි නම් කොටුව ✓ කරන්න.', { wait: 700 });
await tap('[data-all]', 'සියල්ල බැලුවාට පසු මෙතැන ඔබන්න.');
await tap('text=ඔව්, නිවැරදියි', '“ඔව්, නිවැරදියි” ඔබන්න.', { wait: 700 });
await tap('[data-make]', 'දැන් “PDF සාදන්න” ඔබන්න.', { wait: 300 });
await until('.pdfpages', 20000); await sleep(700);
await say('වර්ණවත් සිංහල PDF එක සූදානම්!');
cap = 'නම්, ගම්, මුදල්, භාණ්ඩ, බඩු මල්ලේ අන්තර්ගතය සහ වටිනාකම සියල්ල මෙහි තියෙනවා.';
for (let i = 1; i <= 80; i++) { await b.ev(`document.querySelector('dialog .sheet-body').scrollTo(0, ${i * 13})`); push(await shot(), 0.08, { cut: true }); }
push(await shot(), 1.2);
await point('dialog [data-share]', 'Group එකට යවන්න මෙතැන ඔබන්න.');
await b.ev(`document.querySelector('dialog').close()`); await sleep(400);

section('ඡායාරූප එකතුව');
await viaMore('photos', 'ඡායාරූප'); await sleep(600);
await say('පින්කමේ ඡායාරූප එකතු කරමු. Camera හෝ Gallery ඔබන්න.');
await b.ev(`(async () => { ${fs.readFileSync(new URL('./pictures.js', import.meta.url), 'utf8')}; const dt = new DataTransfer(); for (const f of await makePictures()) dt.items.add(f); const inp = document.querySelectorAll('[data-file]')[1]; inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); })()`);
for (let i = 0; i < 100 && (await b.ev(`document.querySelectorAll('.thumb').length`)) < 7; i++) await sleep(150);
await sleep(2500);
await say('හොඳ ඒවා තෝරන්න. ඔබන විට තේරේ, නැවත ඔබන විට ඉවත් වේ.');
await scrollTo('.collage', 16, 0.5); await sleep(300);
await say('ලස්සන එකතුවක් ඉබේම හැදේ!');
for (const [k, v, t] of [['style', 'moon', 'මෝස්තරය තෝරන්න.'], ['theme', 'bo', 'වර්ණයත් තෝරන්න.'], ['style', 'polaroid', '']]) {
  await tap(`input[name=${k}][value=${v}]`, t || undefined, { wait: 1500 });
  await scrollTo('.collage', 10, 0.5);
  if (!t) cap = 'කැමති එක තෝරා “WhatsApp group එකට යවන්න” ඔබන්න.';
  push(await shot(), t ? 1.5 : read(cap));
}

section('සාමාජිකයන්');
await viaMore('members', 'සාමාජිකයන්');
await say('සාමාජිකයන් සියලු දෙනා මෙහි. එකින් එක හෝ ලැයිස්තුවක් ලෙස එක් කළ හැකියි.');
await tap('main [data-m]', 'නමක් ඔබා දුරකථනය, ගම සහ පරණ පරිත්‍යාග බලන්න.');
await say('කවදා කීයක් දුන්නාද කියා සියල්ල පෙනේ.');
await b.ev(`document.querySelector('dialog').close()`); await sleep(300);

section('සංවත්සර පින්කම', true);
await viaMore('events', 'පින්කම්'); await tap('a[href*="demo-ann"]', 'සංවත්සර පින්කම තෝරා “කාර්යයන් සහ අයවැය” ඔබන්න.'); await b.ev(`document.querySelector('[data-open="tasks"]').click()`); await sleep(500);
await say('ධර්ම දේශනා, දන්සැල් වැනි ලොකු පින්කම් සැලසුම් කරන්න. කාර්යය, භාර අය සහ මුදල් වෙන් කිරීම.');
await scrollTo('.task:nth-of-type(2)', 12, 0.4);
await point('[data-st]', 'කාර්යය අවසන් වූ විට මෙතැන ඔබා සලකුණු කරන්න.');

section('ඉතිහාසය');
await viaMore('history', 'ඉතිහාසය'); await sleep(1400);
await say('කවුද, කවදද, මොනවද කළේ කියා පෙනේ. වැරදීමකින් මැකූ දේ ආපසු ගන්නත් පුළුවන්.');

section('අකුරු ලොකු කිරීම සහ උදව්');
await viaMore('settings', 'සැකසුම්');
await tap('[data-size="2"]', 'අකුරු කුඩා නම් “විශාල” ඔබන්න.', { wait: 600 });
await say('දැන් අකුරු ලොකුයි. කියවන්න ලේසියි.');
await b.ev(`document.querySelector('[data-size="1"]').click()`); await sleep(300);
await nav('help');
await say('අමතක වුණොත් “තවත් → උදව්” බලන්න.');
await nav('home', 600);
cap = 'අන්තර්ජාලය නැති වෙලාවටත් සටහන් කරන්න. සම්බන්ධතාවය ලැබුණු විට ඉබේම යයි.';
push(await shot(), read(cap), { rect: await rectOf('.sync') });
T.push({ kind: 'outro', dur: 5.5 });

fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(T));
console.log('shots', n, 'sections', sec, 'seconds', Math.round(T.reduce((s, x) => s + x.dur, 0)));
await b.close();
srv.close();
process.exit(0);
