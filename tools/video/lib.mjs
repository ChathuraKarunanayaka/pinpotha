// Shared helpers for the demo video: a seeded local app server and a small DevTools client.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBackend } from '../gas-mock.mjs';
import { seed } from '../../app/js/demo.js';

const root = fileURLToPath(new URL('../../app/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

/** The app runs under the same headers Vercel will send (HSTS makes no sense on localhost). */
const HEADERS = JSON.parse(fs.readFileSync(root + 'vercel.json', 'utf8')).headers[0].headers.filter(h => h.key !== 'Strict-Transport-Security');

/** Real backend code, filled with the made-up demo data as of `day`. */
export function seededBackend(day, pin) {
  const be = createBackend();
  be.setup('නිමල්', pin);
  const key = be.key(), call = (action, body) => { const r = be.call({ key, action, ...body }); if (!r.ok) throw new Error(action + ': ' + r.error); return r; };
  const admin = call('hello').users[0], token = call('login', { userId: admin.id, pin }).token;
  const ids = [admin.id, ...[['සමන්', 'coordinator'], ['කුමාරි', 'collector'], ['රුවන්', 'collector']].map(([name, role]) => be.call({ action: 'join', invite: call('invite', { token, user: { name, role } }).invite, pin: '4826' }).user.id)], d = seed(day), map = Object.fromEntries(d.users.map((u, i) => [u.id, ids[i]]));
  const fix = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, map[v] || v]));
  const t = d.tables, old = t.events.find(e => e.id === 'demo-old');
  Object.assign(old, { title: 'ඉල් පොහොය', date: '2026-11-24', status: 'open' });
  t.donations.find(x => x.id === 'demo-c8').note = '';
  const order = ['events', 'members', 'families', 'tasks', 'teams', 'donations', 'pledges', 'openings', 'expenses', 'deliveries', 'parcelItems'];
  const ops = order.flatMap(tb => t[tb].map(r => { const { id, ...patch } = fix(r); return { opId: tb + id, table: tb, id, patch }; }));
  // messages already sent for most gifts, so the to-do list looks like a normal week
  t.donations.filter(x => x.eventId !== 'demo-old').slice(0, 5).forEach(x => ops.push({ opId: 'm' + x.id, table: 'messages', id: `m-thanks-${x.id}-${x.memberId}`, patch: { kind: 'thanks', refId: x.id, memberId: x.memberId, eventId: x.eventId, at: day + 'T04:00:00Z' } }));
  ops.push({ opId: 'close', table: 'events', id: 'demo-old', patch: { status: 'closed' } });
  for (let i = 0; i < ops.length; i += 200) { const bad = call('sync', { token, since: 0, ops: ops.slice(i, i + 200) }).results.filter(r => !r.ok); if (bad.length) throw new Error(JSON.stringify(bad[0])); }
  return { be, key };
}

export function serve(be, dirs = {}, routes = {}) {
  return new Promise(res => {
    const srv = http.createServer((req, out) => {
      const url = new URL(req.url, 'http://x');
      if (routes[url.pathname]) return routes[url.pathname](req, out, url);
      if (url.pathname === '/api') { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { out.setHeader('content-type', 'application/json'); out.end(JSON.stringify(be.call(JSON.parse(b)))); }); return; }
      const pre = Object.keys(dirs).find(p => url.pathname.startsWith(p)), base = pre ? dirs[pre] : root;
      const file = path.join(base, pre ? url.pathname.slice(pre.length) : url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { out.statusCode = 404; return out.end(); }
      out.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
      out.setHeader('cache-control', 'no-store');
      if (!pre) HEADERS.forEach(h => out.setHeader(h.key, h.value));
      fs.createReadStream(file).pipe(out);
    }).listen(0, () => res({ port: srv.address().port, close: () => srv.close() }));
  });
}

const EDGE = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function browser({ width, height, scale, mobile = true, init = '' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinvideo-'));
  const proc = spawn(EDGE, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--hide-scrollbars', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { /* not yet */ } }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0;
  const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const w = wait.get(m.id); wait.delete(m.id); m.error ? w.j(new Error(m.error.message)) : w.r(m.result); } else if (m.method === 'Runtime.exceptionThrown') console.log('PAGE ERROR', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise((r, j) => { const id = ++n; wait.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: `await (${expr})`, awaitPromise: true, returnByValue: true, replMode: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  return {
    send, ev,
    go: async url => { await send('Page.navigate', { url }); await sleep(1500); },
    close: async () => { try { await send('Browser.close'); } catch { proc.kill(); } await sleep(800); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* still locked */ } },
  };
}
