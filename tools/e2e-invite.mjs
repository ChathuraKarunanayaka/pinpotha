// Two separate browsers (owner's phone, collector's phone) against the real backend code.
//   node tools/e2e-invite.mjs [screenshotDir]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createBackend } from './gas-mock.mjs';
import { serve, browser, sleep } from './video/lib.mjs';

const SHOTS = process.argv[2];
const be = createBackend();
be.setup('පාලක', '9182');
const srv = await serve(be), base = `http://localhost:${srv.port}/`;
const init = `window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; navigator.clipboard && (navigator.clipboard.writeText = async t => { window.__copied = t; });`;
const phone = async () => {
  const b = await browser({ width: 390, height: 844, scale: 1, init });
  const q = s => `(() => { const s = ${JSON.stringify(s)}; const sc = document.querySelector('dialog[open]:last-of-type') || document; return s.startsWith('text=') ? [...sc.querySelectorAll('button,a,label')].filter(e => e.offsetParent !== null && e.textContent.includes(s.slice(5))).sort((x, y) => x.textContent.length - y.textContent.length)[0] : sc.querySelector(s); })()`;
  const until = async s => { for (let i = 0; i < 120; i++) { if (await b.ev(`!!${q(s)}`)) return; await sleep(60); } throw new Error('missing ' + s + '\n' + await b.ev('document.body.innerText.slice(0,600)')); };
  return {
    ...b, until,
    tap: async (s, w = 350) => { await until(s); await b.ev(`${q(s)}.click()`); await sleep(w); },
    fill: async (s, v) => { await until(s); await b.ev(`(() => { const e = ${q(s)}; e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`); },
    pin: async p => { for (const c of p) { await until(`[data-n="${c}"]`); await b.ev(`document.querySelector('[data-n="${c}"]').click()`); await sleep(60); } await sleep(700); },
    text: () => b.ev('document.body.innerText'),
    nav: async h => { await b.ev(`location.hash = '#/${h}'`); await sleep(400); },
    shot: async n => { if (SHOTS) fs.writeFileSync(`${SHOTS}/${n}.png`, Buffer.from((await b.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); },
  };
};
const ok = (c, m) => { assert.ok(c, m); console.log('✓', m); };

const own = await phone(), col = await phone();
await own.go(`${base}#setup=local.${be.key()}`);
await own.tap('text=පාලක'); await own.pin('9182'); await own.until('.hero'); await sleep(600);
await own.shot('1-owner-home');
await own.nav('users');
await own.tap('[data-add]');
await own.fill('[name=name]', 'සමන් පෙරේරා'); await own.fill('[name=phone]', '0700000001');
await own.shot('2-invite-form');
await own.ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(1200);
await own.until('[data-cp]'); await own.shot('3-invite-link');
await own.tap('[data-cp]'); await own.tap('[data-wa]');
const link = await own.ev('window.__copied'), wa = decodeURIComponent(await own.ev('window.__opened[0]'));
ok(/#join=local\.[0-9a-f]{32}$/.test(link) && wa.includes(link) && wa.includes('wa.me/94700000001'), 'owner gets a personal link and a WhatsApp message to that number');
ok(!link.includes(be.key()), 'the personal link does not contain the shared device key');
await own.ev(`document.querySelector('dialog').close()`); await sleep(500);
ok((await own.text()).includes('තවම එක් වී නැත'), 'owner sees the person as not joined yet'); await own.shot('4-pending');

await col.go(link); await col.until('#jn'); await col.shot('5-join-name');
ok((await col.ev('location.href')).indexOf('join=') < 0, 'secret is removed from the address bar');
ok(await col.ev(`document.querySelector('#jn').value`) === 'සමන් පෙරේරා', 'name is already filled in');
await col.tap('[data-next]'); await col.pin('1234');
ok((await col.text()).includes('අනුමාන කිරීම ලේසියි'), 'an easy PIN is refused');
await col.pin('4826'); await col.shot('6-join-pin'); await col.pin('4827');
ok((await col.text()).includes('සමාන නැහැ'), 'mismatched PINs start over');
await col.pin('4826'); await col.pin('4826'); await sleep(1500);
await col.until('.hero'); ok(true, 'collector is inside after choosing a PIN'); await col.shot('7-collector-home');

await own.nav('home'); await own.ev(`import('/js/store.js').then(m => m.sync())`); await sleep(900); await own.nav('users');
ok((await own.text()).includes('එක් වී ඇත'), 'owner sees that the person joined');
await own.nav('events'); await own.tap('[data-poya]', 1500);
await own.nav('members'); await own.tap('[data-bulk]'); await own.fill('textarea', 'අනුලා, 0700000002, මහරගම'); await own.tap('[data-save]', 1500);
await own.nav('cash');
ok(!(await own.text()).includes('පාලක'), 'owner is not in the cash list while not collecting');
await own.nav('donate'); await own.tap('[data-m]');
ok(await own.ev(`!!document.querySelector('[name=collectorId] option[value=""]')`), 'owner must choose who collected');
await own.fill('[name=amount]', '500'); await own.ev(`document.querySelector('#main form').requestSubmit()`); await sleep(400);
ok((await own.text()).includes('කවුදැයි තෝරන්න'), 'owner cannot save without choosing');

await col.ev(`import('/js/store.js').then(m => m.sync())`); await sleep(900);
await col.nav('donate'); await col.tap('[data-m]'); await col.fill('[name=amount]', '1500'); await col.ev(`document.querySelector('#main form').requestSubmit()`); await sleep(1500);
await col.until('.done'); ok(true, 'collector records money');
await col.nav('users'); ok((await col.ev('location.hash')) === '#/home', 'collector cannot open the people page');
await col.nav('expenses'); ok(!(await col.ev(`!!document.querySelector('[data-add]')`)), 'collector cannot add expenses');
await col.nav('members'); ok(await col.ev(`!!document.querySelector('[data-add]')`), 'collector can add members');
await col.nav('report'); await col.tap('[data-all]'); await col.tap('text=ඔව්, නිවැරදියි', 900); await col.tap('[data-make]', 300); await col.until('.pdfpages');
ok(await col.ev(`!!document.querySelector('dialog [data-share]')`), 'collector can make and share the PDF');
await col.ev(`document.querySelector('dialog').close()`); await sleep(400);
await col.nav('settings'); ok(!(await col.ev(`!!document.querySelector('[data-org],[data-collects]')`)), 'collector sees no owner settings');
await col.tap('[data-mylink]'); await col.tap('[data-ok]'); const mine = await col.ev('window.__copied');
ok(/#setup=local\.[0-9a-f]+\.\w+$/.test(mine), 'collector can copy a link for their own second phone');

await own.nav('users'); await own.tap('text=සමන් පෙරේරා'); await own.tap('[data-a=edit]'); await own.tap('input[value=coordinator]'); await own.ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(1000);
await col.ev(`import('/js/store.js').then(m => m.sync())`); await sleep(1000); await col.nav('home'); await col.nav('expenses');
ok(await col.ev(`!!document.querySelector('[data-add]')`), 'coordinator can add expenses'); await col.shot('8-coordinator-expenses');
await col.nav('event?id=poya-2026-12-23'); ok(!(await col.ev(`!!document.querySelector('[data-close-ev]')`)), 'coordinator cannot close accounts');

await own.nav('settings'); await own.shot('9-owner-settings'); await own.tap('[data-collects]', 1200); await own.nav('cash'); ok((await own.text()).includes('පාලක'), 'owner appears once the setting is on');

const col2 = await phone();
await col2.go(link); await col2.until('[data-retry]'); ok((await col2.text()).includes('භාවිතා කර ඇත'), 'used link does not work again'); await col2.shot('10-used-link');
await col2.go('about:blank'); await col2.go(mine); await col2.until('[data-n="1"]'); ok((await col2.text()).includes('සමන් පෙරේරා'), 'second phone goes straight to that person’s PIN');
await col2.pin('4826'); await col2.until('.hero'); ok(true, 'second phone works with the PIN');

await own.nav('users'); await own.tap('text=සමන් පෙරේරා'); await own.tap('[data-a=stop]'); await own.tap('[data-ok]', 1200);
await col.ev(`import('/js/store.js').then(m => m.sync())`); await sleep(1200);
ok(!(await col.ev(`!!document.querySelector('.hero')`)) || !(await col.ev(`!!document.querySelector('.tabs')`)), 'stopped person is signed out on the next sync');
for (const p of [own, col, col2]) await p.close();
srv.close();
process.exit(0);
