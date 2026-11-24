// Local-first data. Reads come from memory, writes are saved on the phone first
// (IndexedDB) and sent to the Google Sheet whenever there is a connection.
import { uid, today } from './util.js';
import { seed } from './demo.js';

export const TABLES = ['settings', 'events', 'members', 'donations', 'pledges', 'handovers', 'expenses', 'openings', 'transfers', 'families', 'teams', 'deliveries', 'parcelItems', 'tasks', 'messages'];

/* ---- tiny IndexedDB key-value ---- */
let idb;
const open = () => idb ||= new Promise((res, rej) => {
  const r = indexedDB.open('pinpotha', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function kv(mode, fn) {
  const tx = (await open()).transaction('kv', mode);
  const out = fn(tx.objectStore('kv'));
  return new Promise((res, rej) => { tx.oncomplete = () => res(out?.result); tx.onerror = tx.onabort = () => rej(tx.error); });
}
const get = k => kv('readonly', s => s.get(k));
const save = obj => kv('readwrite', s => { Object.entries(obj).forEach(([k, v]) => s.put(v, k)); });

/* ---- state ---- */
export const S = {
  conn: null,      // { id, key } from the invite link, or { demo: true }
  session: null,   // { token, user, sheetUrl }
  users: [],
  rev: 0,
  outbox: [],      // [{ opId, table, id, patch, at }]
  rejected: [],    // ops the server refused, shown until dismissed
  base: {},        // server truth  { table: { id: rec } }
  db: {},          // what screens read { table: [rec] } = base + outbox
  status: 'idle',  // idle | syncing | offline | error
  error: '',
  lastSync: 0,
};
const listeners = new Set();
export const onChange = f => { listeners.add(f); return () => listeners.delete(f); };
const emit = kind => listeners.forEach(f => f(kind));

export const me = () => S.session?.user || {};
export const isAdmin = () => me().role === 'admin';
export const isDemo = () => !!S.conn?.demo;
export const all = t => (S.db[t] || []).filter(r => !r.deleted);
export const byId = (t, id) => (S.db[t] || []).find(r => r.id === id);
export const userName = id => id === 'BANK' ? 'බැංකු ගිණුම' : S.users.find(u => u.id === id)?.name || '—';
export const memberName = id => byId('members', id)?.name || '—';
export const activeUsers = () => S.users.filter(u => u.active);

const blank = () => Object.fromEntries(TABLES.map(t => [t, {}]));
function rebuild() {
  const view = Object.fromEntries(TABLES.map(t => [t, { ...S.base[t] }]));
  S.outbox.forEach(o => { if (view[o.table]) view[o.table][o.id] = { ...view[o.table][o.id], ...o.patch, id: o.id }; });
  S.db = Object.fromEntries(TABLES.map(t => [t, Object.values(view[t])]));
}

export async function load() {
  try {
    const [conn, session, data, outbox, rejected] = await Promise.all(['conn', 'session', 'data', 'outbox', 'rejected'].map(get));
    S.conn = conn || null;
    S.session = session || null;
    S.base = { ...blank(), ...(data?.base || {}) };
    S.rev = data?.rev || 0;
    S.users = data?.users || [];
    S.outbox = outbox || [];
    S.rejected = rejected || [];
  } catch (e) {
    console.error(e);
    S.base = blank();
    S.storageBroken = true; // private window: works, but unsent data would not survive closing
  }
  rebuild();
  navigator.storage?.persist?.().catch(() => {});
}
async function persist(...what) {
  const v = { conn: S.conn, session: S.session, data: { base: S.base, rev: S.rev, users: S.users }, outbox: S.outbox, rejected: S.rejected };
  try { await save(Object.fromEntries(what.map(k => [k, v[k]]))); } catch (e) { console.error(e); S.storageBroken = true; }
}

/* ---- connection + login ---- */
/** Accepts the whole invite link or just the part after "#setup=". */
export function parseInvite(text) {
  const m = /(?:#setup=)?([\w-]+)\.([0-9a-f]{20,})\s*$/i.exec(String(text || '').trim());
  return m ? { id: m[1], key: m[2] } : null;
}
export async function connect(conn) {
  const other = S.conn && (S.conn.id !== conn.id);
  if (other && !conn.demo && !S.conn.demo && S.outbox.length) throw new Error('තවම නොයැවූ සටහන් ඇත. පළමුව ඒවා යවන්න.');
  if (other || conn.demo || S.conn?.demo) await wipe();
  S.conn = conn;
  if (conn.demo) {
    const d = seed(today());
    S.users = d.users;
    S.session = { token: 'demo', user: d.users[0] };
    Object.entries(d.tables).forEach(([t, rows]) => rows.forEach(r => { S.base[t][r.id] = { deleted: false, ...r }; }));
    rebuild();
  }
  await persist('conn', 'session', 'data', 'outbox', 'rejected');
  emit('session');
}
async function wipe() {
  S.session = null; S.users = []; S.rev = 0; S.outbox = []; S.rejected = []; S.base = blank(); S.demoLog = [];
  rebuild();
}
export async function disconnect() {
  await wipe();
  S.conn = null;
  await persist('conn', 'session', 'data', 'outbox', 'rejected');
  emit('session');
}

const endpoint = () => S.conn.id === 'local' ? '/api' : `https://script.google.com/macros/s/${S.conn.id}/exec`;
export async function api(action, body = {}) {
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    // text/plain keeps this a "simple" request: Apps Script cannot answer CORS preflights.
    res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctl.signal, body: JSON.stringify({ key: S.conn.key, token: S.session?.token, action, ...body }) });
    res = await res.json();
  } catch (e) {
    throw Object.assign(new Error('අන්තර්ජාල සම්බන්ධතාවය නැත. පසුව ඉබේම යැවේ.'), { code: 'network', cause: e });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw Object.assign(new Error(res.error), { code: res.code });
  return res;
}
export async function login(userId, pin) {
  const r = await api('login', { userId, pin });
  // Unsent notes belong to the person who wrote them.
  if (S.session && S.session.user.id !== r.user.id && S.outbox.length) throw new Error(`${S.session.user.name}ගේ නොයැවූ සටහන් ඇත. පළමුව ඔවුන් ඇතුළු විය යුතුයි.`);
  S.session = { token: r.token, user: r.user, sheetUrl: r.sheetUrl };
  await persist('session');
  emit('session');
  await sync();
}
export async function logout() {
  const { conn } = S;
  await wipe();
  S.conn = conn;
  await persist('conn', 'session', 'data', 'outbox', 'rejected');
  emit('session');
}

/* ---- writing ---- */
/** Create or change one record. Saved on the phone before this resolves. */
export async function put(table, id, patch) {
  id = id || uid();
  if (isDemo()) {
    const before = S.base[table][id];
    (S.demoLog ||= []).unshift({ at: new Date().toISOString(), userId: me().id, userName: me().name, table, recId: id, action: !before ? 'create' : patch.deleted === true ? 'delete' : patch.deleted === false ? 'restore' : 'update', before: before ? Object.fromEntries(Object.keys(patch).map(k => [k, before[k]])) : {}, after: patch });
    S.base[table][id] = { deleted: false, ...before, ...patch, id };
    rebuild();
    await persist('data');
  } else {
    S.outbox.push({ opId: uid(), table, id, patch, at: Date.now() });
    rebuild();
    await persist('outbox');
    syncSoon();
  }
  emit('data');
  return id;
}
export const remove = (table, id) => put(table, id, { deleted: true });
export const restore = (table, id) => put(table, id, { deleted: false });
export const setting = (k, dflt = '') => { const r = byId('settings', k); return r && !r.deleted && r.value !== '' ? r.value : dflt; };

/* ---- syncing ---- */
let running = null, timer;
export function syncSoon(ms = 400) { clearTimeout(timer); timer = setTimeout(() => sync().catch(() => {}), ms); }

export function sync() {
  if (isDemo() || !S.conn || !S.session) return Promise.resolve();
  return running ||= doSync().finally(() => { running = null; if (S.outbox.length && S.status === 'idle') syncSoon(); });
}
async function doSync() {
  setStatus('syncing');
  const sent = S.outbox.slice(0, 200);
  let r;
  try {
    r = await api('sync', { since: S.rev, ops: sent.map(({ opId, table, id, patch }) => ({ opId, table, id, patch })) });
  } catch (e) {
    if (e.code === 'auth') { S.session.token = null; setStatus('error', e.message); emit('session'); return; }
    if (e.code === 'key') { setStatus('error', e.message); return; }
    setStatus(e.code === 'network' ? 'offline' : 'error', e.message);
    syncSoon(30000);
    return;
  }
  const done = new Set(), refused = new Set();
  r.results.forEach(x => {
    done.add(x.opId);
    if (x.ok) return;
    refused.add(x.opId);
    const op = sent.find(o => o.opId === x.opId);
    if (!op) return;
    S.rejected.push({ ...op, error: x.error });
    if (x.rec) S.base[op.table][op.id] = x.rec; else delete S.base[op.table][op.id];
  });
  // Accepted patches become part of the base even if the server had nothing new to report about them.
  sent.forEach(o => { if (done.has(o.opId) && !refused.has(o.opId)) S.base[o.table][o.id] = { ...S.base[o.table][o.id], ...o.patch, id: o.id }; });
  Object.entries(r.changes).forEach(([t, rows]) => { if (S.base[t]) rows.forEach(x => { S.base[t][x.id] = x; }); });
  S.outbox = S.outbox.filter(o => !done.has(o.opId));
  S.rev = r.rev;
  S.users = r.users;
  S.session.user = r.me;
  S.lastSync = Date.now();
  rebuild();
  await persist('data', 'outbox', 'rejected', 'session');
  setStatus('idle');
  emit('sync');
}
function setStatus(s, err = '') { S.status = s; S.error = err; emit('status'); }

export async function dismissRejected() { S.rejected = []; await persist('rejected'); emit('data'); }
export async function setUsers(users, token) {
  S.users = users;
  if (token) S.session.token = token;
  await persist('data', 'session');
  emit('data');
}
export async function setToken(token) { S.session.token = token; await persist('session'); }

export function startAutoSync() {
  addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - S.lastSync > 15000) sync(); });
  setInterval(() => { if (!document.hidden && Date.now() - S.lastSync > 60000) sync(); }, 20000);
}
