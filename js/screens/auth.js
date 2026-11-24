import { S, connect, parseInvite, api, login, disconnect } from '../store.js';
import { html, raw } from '../util.js';
import { icon, on, confirmBox } from '../ui.js';
import { boMoonSvg } from '../art.js';
import { ORG } from '../messages.js';

const hero = sub => html`<div class="hero-auth">${raw(boMoonSvg(0))}<h1>${ORG}</h1><p>${sub}</p></div>`;

export function connectScreen() {
  return {
    body: html`${hero('පින්කමේ ගිණුම් සහ පණිවිඩ, එක තැනක')}
      <section class="card auth">
        <h2>ආරම්භ කරමු</h2>
        <p>ඔබට WhatsApp හරහා ලැබුණු <b>ආරාධනා link එක</b> ඔබන්න. නැතිනම් එය copy කර මෙතැන දමන්න.</p>
        <textarea rows="3" id="inv" placeholder="https://… #setup=…" aria-label="ආරාධනා link එක" autocapitalize="off" spellcheck="false"></textarea>
        <p class="err" id="e" hidden></p>
        <button class="btn primary" data-ok>ඉදිරියට</button>
        <hr>
        <button class="btn ghost" data-demo>නිකම් අත්හදා බලන්න</button>
      </section>`,
    mount(el) {
      on(el, 'click', '[data-ok]', async () => {
        const inv = parseInvite(el.querySelector('#inv').value), e = el.querySelector('#e');
        e.hidden = !!inv;
        e.textContent = 'Link එක සම්පූර්ණ නැහැ. මුළු link එකම copy කර දමන්න.';
        if (inv) await connect(inv);
      });
      on(el, 'click', '[data-demo]', () => connect({ demo: true }));
    },
  };
}

export function loginScreen() {
  // After a PIN change the same person signs in again, so unsent notes keep their owner.
  const fixed = S.session?.user && S.outbox.length ? S.session.user : null;
  return {
    body: html`${hero('')}<section class="card auth" data-box><p class="center">මොහොතක්…</p></section>`,
    mount(el) {
      const box = el.querySelector('[data-box]');
      const people = list => {
        box.innerHTML = html`<h2>ඔබ කවුද?</h2><div class="stack">${list.map(u => html`<button class="row big" data-u="${u.id}"><span class="ava">${[...u.name][0]}</span><span class="grow"><b>${u.name}</b></span>${icon('next')}</button>`)}</div><button class="btn link" data-leave>වෙනත් link එකක් භාවිතා කරන්න</button>`;
        on(box, 'click', '[data-u]', b => pin(list.find(u => u.id === b.dataset.u), list));
      };
      const pin = (u, list) => {
        let v = '', busy = false;
        box.innerHTML = html`<h2>${u.name}</h2><p class="center">ඔබේ PIN අංකය</p><div class="dots" aria-hidden="true">${[0, 1, 2, 3].map(() => html`<i></i>`)}</div><p class="err center" aria-live="assertive" hidden></p>
          <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => html`<button type="button" data-n="${n}">${n}</button>`)}<button type="button" data-n="x" class="t">${list ? 'ආපසු' : ''}</button><button type="button" data-n="0">0</button><button type="button" data-n="d" aria-label="මකන්න">⌫</button></div>`;
        const dots = () => box.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i < v.length));
        const press = async n => {
          if (busy) return;
          if (n === 'x') return list && people(list);
          if (n === 'd') v = v.slice(0, -1); else if (v.length < 4) v += n;
          dots();
          if (v.length < 4) return;
          busy = true;
          const err = box.querySelector('.err');
          err.hidden = false; err.className = 'center'; err.textContent = 'මොහොතක්…';
          try { await login(u.id, v); } catch (e) {
            err.className = 'err center'; err.textContent = e.code === 'network' ? 'අන්තර්ජාල සම්බන්ධතාවය පරීක්ෂා කරන්න.' : e.message;
            v = ''; dots(); busy = false;
          }
        };
        box.querySelector('.pad').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) press(b.dataset.n); });
        el.onkeydown = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('d'); };
        box.tabIndex = -1; box.focus();
      };
      on(el, 'click', '[data-leave]', async () => {
        if (S.outbox.length) return confirmBox('නොයැවූ සටහන් ඇත', 'පළමුව PIN දමා ඒවා යවන්න.', { ok: 'හරි', cancel: 'වසන්න' });
        disconnect();
      });
      if (fixed) return pin(fixed, null);
      const start = async () => {
        box.innerHTML = html`<p class="center">මොහොතක්…</p>`;
        try { people((await api('hello')).users); } catch (e) {
          box.innerHTML = html`<p class="err center">${e.code === 'network' ? 'අන්තර්ජාල සම්බන්ධතාවය නැත.' : e.message}</p><button class="btn primary" data-retry>නැවත උත්සාහ කරන්න</button><button class="btn link" data-leave>වෙනත් link එකක් භාවිතා කරන්න</button>`;
        }
      };
      on(el, 'click', '[data-retry]', start);
      start();
    },
  };
}
