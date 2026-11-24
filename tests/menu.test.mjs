import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from '../tools/gas-mock.mjs';

/** Answers the Sheet menu's prompts in order and captures the link it shows. */
function menu(be, answers) {
  const seen = { asked: [], alerts: [], html: '' };
  const chain = { setWidth: () => chain, setHeight: () => chain };
  be.ctx.HtmlService = { createHtmlOutput: h => { seen.html = h; return chain; } };
  be.ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: {}, Button: { OK: 'ok' },
    prompt: (_, q) => { seen.asked.push(q); const a = answers.shift(); return { getSelectedButton: () => (a === null ? 'cancel' : 'ok'), getResponseText: () => a }; },
    alert: m => seen.alerts.push(m), showModalDialog: () => {},
  });
  be.ctx.menuInvite();
  return seen;
}
const EXEC = 'https://script.google.com/macros/s/AKfy-abc_123/exec';
const link = h => /readonly>([^<]*)</.exec(h)?.[1];

test('owner link: default address, a new address that is remembered, and bad input', () => {
  const be = createBackend();
  be.setup('පාලක', '9182');
  assert.equal(link(menu(be, [EXEC, '']).html), `https://chathurakarunanayaka.github.io/pinpotha/#setup=AKfy-abc_123.${be.key()}`);
  assert.equal(link(menu(be, [EXEC, 'https://danata-pin-aththo.vercel.app']).html), `https://danata-pin-aththo.vercel.app/#setup=AKfy-abc_123.${be.key()}`);
  assert.equal(link(menu(be, [EXEC, '']).html), `https://danata-pin-aththo.vercel.app/#setup=AKfy-abc_123.${be.key()}`);
  for (const bad of ['http://x.com', 'javascript:alert(1)', 'danata']) { const s = menu(be, [EXEC, bad]); assert.equal(s.html, ''); assert.equal(s.alerts.length, 1); }
  assert.equal(menu(be, ['https://example.com', '']).alerts.length, 1);
  assert.equal(menu(be, [EXEC, null]).html, '');
});
