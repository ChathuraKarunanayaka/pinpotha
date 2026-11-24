/**
 * පින් පොත — backend (Google Apps Script, Google Sheet එකකට bind කළ).
 *
 * Every record lives in one `db_<table>` tab. Clients send field-level patches
 * ("ops") and pull everything newer than the last revision they saw. To add a
 * field or table, extend SCHEMA below and run "Sheet යාවත්කාලීන කරන්න" from the menu.
 */

// type: s = text, n = number, b = boolean
const SCHEMA = {
  settings:   { value: ['s', 'අගය'] },
  events:     { type: ['s', 'වර්ගය'], title: ['s', 'පින්කම'], date: ['s', 'දිනය'], fund: ['s', 'අරමුදල'], status: ['s', 'තත්ත්වය'], parcels: ['n', 'මලු ගණන'], note: ['s', 'සටහන'] },
  members:    { name: ['s', 'නම'], phone: ['s', 'දුරකථනය'], area: ['s', 'ප්‍රදේශය'], usual: ['n', 'සාමාන්‍ය මුදල'], collectorId: ['s', 'භාර'], noRemind: ['b', 'මතක් නොකරන්න'], anon: ['b', 'නම නොපෙන්වන්න'], inactive: ['b', 'අක්‍රිය'], note: ['s', 'සටහන'] },
  donations:  { eventId: ['s', 'පින්කම'], memberId: ['s', 'සාමාජිකයා'], kind: ['s', 'වර්ගය'], amount: ['n', 'මුදල'], goods: ['s', 'භාණ්ඩය'], collectorId: ['s', 'එකතු කළේ'], payerId: ['s', 'වෙනුවෙන් ගෙව්වේ'], settled: ['b', 'පියවූ'], settledAt: ['s', 'පියවූ දිනය'], date: ['s', 'දිනය'], note: ['s', 'සටහන'] },
  pledges:    { eventId: ['s', 'පින්කම'], memberId: ['s', 'සාමාජිකයා'], amount: ['n', 'මුදල'], cancelled: ['b', 'අවලංගු'], note: ['s', 'සටහන'] },
  expenses:   { eventId: ['s', 'පින්කම'], taskId: ['s', 'කාර්යය'], category: ['s', 'වර්ගය'], title: ['s', 'විස්තරය'], amount: ['n', 'මුදල'], paidBy: ['s', 'ගෙව්වේ'], shop: ['s', 'කඩය'], billNo: ['s', 'බිල් අංකය'], date: ['s', 'දිනය'], note: ['s', 'සටහන'] },
  openings:   { fund: ['s', 'අරමුදල'], holder: ['s', 'මුදල් ළඟ'], amount: ['n', 'මුදල'], date: ['s', 'දිනය'], note: ['s', 'සටහන'] },
  transfers:  { fromFund: ['s', 'අරමුදලෙන්'], toFund: ['s', 'අරමුදලට'], amount: ['n', 'මුදල'], date: ['s', 'දිනය'], note: ['s', 'සටහන'] },
  families:   { name: ['s', 'නම'], area: ['s', 'ප්‍රදේශය'], address: ['s', 'ලිපිනය'], phone: ['s', 'දුරකථනය'], people: ['n', 'සාමාජික ගණන'], children: ['n', 'ළමුන්'], need: ['s', 'තත්ත්වය'], urgent: ['b', 'හදිසි'], referredBy: ['s', 'දැනුම් දුන්නේ'], status: ['s', 'අනුමැතිය'], map: ['s', 'සිතියම'], note: ['s', 'සටහන'] },
  teams:      { eventId: ['s', 'පින්කම'], name: ['s', 'කණ්ඩායම'], people: ['s', 'අය'], vehicle: ['s', 'වාහනය'], note: ['s', 'සටහන'] },
  deliveries: { eventId: ['s', 'පින්කම'], familyId: ['s', 'පවුල'], teamId: ['s', 'කණ්ඩායම'], parcels: ['n', 'මලු'], status: ['s', 'තත්ත්වය'], doneAt: ['s', 'වේලාව'], note: ['s', 'සටහන'] },
  parcelItems:{ eventId: ['s', 'පින්කම'], name: ['s', 'බඩුව'], unit: ['s', 'ඒකකය'], qty: ['n', 'මල්ලකට'], price: ['n', 'ඒකක මිල'], bought: ['b', 'ගත්තා'], sort: ['n', 'පිළිවෙළ'] },
  tasks:      { eventId: ['s', 'පින්කම'], title: ['s', 'කාර්යය'], owner: ['s', 'භාර'], budget: ['n', 'අයවැය'], due: ['s', 'දිනය'], status: ['s', 'තත්ත්වය'], note: ['s', 'සටහන'] },
  messages:   { eventId: ['s', 'පින්කම'], memberId: ['s', 'සාමාජිකයා'], kind: ['s', 'වර්ගය'], refId: ['s', 'අදාළ'], at: ['s', 'වේලාව'] },
};
const USER_FIELDS = { name: ['s', 'නම'], role: ['s', 'භූමිකාව'], phone: ['s', 'දුරකථනය'], active: ['b', 'සක්‍රිය'], collects: ['b', 'එකතු කරයි'], inviteHash: ['s', '-'], inviteExp: ['n', '-'], pinHash: ['s', '-'], salt: ['s', '-'], tv: ['n', '-'] };
const META = { deleted: ['b', 'මකා ඇත'], rev: ['n', 'rev'], updatedAt: ['s', 'වෙනස් කළේ'], updatedBy: ['s', 'කවුද'] };
const AUDIT_HEADS = ['at', 'userId', 'userName', 'table', 'recId', 'action', 'before', 'after'];

const FUNDS = { poya: 'මාසික පොහොය අරමුදල', annual: 'සංවත්සර අරමුදල' };
const MONEY_TABLES = ['events', 'members', 'donations', 'expenses', 'openings', 'transfers', 'pledges'];
const MAX_OPS = 400, MAX_TEXT = 2000, MAX_AMOUNT = 100000000;
const TOKEN_DAYS = 365, MAX_PIN_TRIES = 5, INVITE_DAYS = 7;
const APP_URL = 'https://danata-pin-aththo.vercel.app/';

/* ------------------------------------------------------------------ HTTP */

function doGet() { return json_({ ok: true, app: 'pinpotha' }); }

function doPost(e) {
  let out;
  try {
    out = handle_(JSON.parse(e.postData.contents));
  } catch (err) {
    out = err && err.code ? { ok: false, code: err.code, error: err.message } : { ok: false, code: 'server', error: String(err && err.message || err) };
  }
  return json_(out);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, message) { const e = new Error(message); e.code = code; throw e; }

function handle_(req) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('inviteKey');
  if (!key) fail_('setup', 'පද්ධතිය තවම සකසා නැත.');
  // A personal invite is its own secret; everything else needs the device key as well as a PIN session.
  const invited = req.action === 'inviteInfo' || req.action === 'join';
  if (!invited && !safeEq_(String(req.key || ''), key)) fail_('key', 'ආරාධනා link එක වලංගු නැත. ප්‍රධාන අයගෙන් අලුත් link එකක් ගන්න.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) fail_('busy', 'පද්ධතිය කාර්යබහුලයි. මොහොතකින් නැවත උත්සාහ කරන්න.');
  try {
    const db = new Db_();
    let out;
    if (req.action === 'inviteInfo') { const u = invitee_(db, req.invite); out = { name: u.name, role: u.role, org: db.setting('orgName') }; }
    else if (req.action === 'join') out = join_(db, req, key);
    else if (req.action === 'hello') out = { users: db.users().filter(u => u.active && u.pinHash).map(u => ({ id: u.id, name: u.name })), org: db.setting('orgName') };
    else if (req.action === 'login') out = login_(db, req);
    else {
      const user = auth_(db, req.token);
      if (req.action === 'sync') out = sync_(db, user, req);
      else if (req.action === 'history') out = { rows: history_(req.limit) };
      else if (req.action === 'invite') out = invite_(db, user, req.user || {});
      else if (req.action === 'userSave') out = userSave_(db, user, req.user || {});
      else if (req.action === 'changePin') out = changePin_(db, user, req);
      else fail_('action', 'නොදන්නා ඉල්ලීමකි.');
    }
    out.ok = true;
    return out;
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ Auth */

function hmac_(text) {
  const secret = PropertiesService.getScriptProperties().getProperty('secret');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret));
}
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function pinHash_(pin, salt) { return hmac_('pin|' + salt + '|' + pin); }
function newToken_(u) {
  const body = [u.id, u.tv, Date.now() + TOKEN_DAYS * 864e5].join('~');
  return body + '~' + hmac_('tok|' + body);
}
function auth_(db, token) {
  const p = String(token || '').split('~');
  const bad = () => fail_('auth', 'නැවත PIN අංකය ඇතුළත් කරන්න.');
  if (p.length !== 4) bad();
  if (!safeEq_(p[3], hmac_('tok|' + p.slice(0, 3).join('~'))) || Number(p[2]) < Date.now()) bad();
  const u = db.users().find(x => x.id === p[0]);
  if (!u || !u.active || String(u.tv) !== p[1]) bad();
  return u;
}

function checkPin_(u, pin) {
  const props = PropertiesService.getScriptProperties();
  const k = 'try_' + u.id;
  const t = JSON.parse(props.getProperty(k) || '{"n":0,"until":0}');
  if (t.until > Date.now()) fail_('locked', 'වැරදි PIN වැඩියි. මිනිත්තු ' + Math.ceil((t.until - Date.now()) / 60000) + 'කින් නැවත උත්සාහ කරන්න.');
  if (safeEq_(pinHash_(String(pin), u.salt), u.pinHash)) { props.deleteProperty(k); return; }
  t.n++;
  // Lock-out doubles every five wrong tries: 15 min, 30 min, 1 h ... capped at a day.
  if (t.n % MAX_PIN_TRIES === 0) t.until = Date.now() + Math.min(15 * Math.pow(2, t.n / MAX_PIN_TRIES - 1), 1440) * 60000;
  props.setProperty(k, JSON.stringify(t));
  fail_('pin', 'PIN අංකය වැරදියි.');
}

function login_(db, req) {
  const u = db.users().find(x => x.id === req.userId && x.active);
  if (!u) fail_('pin', 'පරිශීලකයා හමු නොවුණි.');
  checkPin_(u, req.pin);
  return { token: newToken_(u), user: publicUser_(u), sheetUrl: u.role === 'admin' ? SpreadsheetApp.getActive().getUrl() : '' };
}

function publicUser_(u) {
  return { id: u.id, name: u.name, role: u.role, phone: u.phone, active: u.active, collects: u.role === 'admin' ? u.collects === true : true, pending: !!u.inviteHash && Number(u.inviteExp) > Date.now(), joined: !!u.pinHash };
}
function ownerOnly_(me) { if (me.role !== 'admin') fail_('denied', 'මෙය කළ හැක්කේ ප්‍රධාන පාලකට පමණි.'); }
function cleanName_(v) {
  const name = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) fail_('invalid', 'නම අවශ්‍යයි.');
  return name;
}
/** Only one coordinator at a time: appointing a new one turns the previous one back into a collector. */
function setRole_(db, me, rec, role) {
  rec.role = role === 'coordinator' ? 'coordinator' : 'collector';
  if (rec.role !== 'coordinator') return;
  db.users().slice().forEach(u => {
    if (u.id === rec.id || u.role !== 'coordinator') return;
    db.save('users', Object.assign({}, u, { role: 'collector' }), me);
    db.audit(me, 'users', u.id, 'update', { name: u.name, role: 'coordinator' }, { name: u.name, role: 'collector' });
  });
}

/** Owner creates (or renews) a personal, single-use link. Renewing also ends that person's old sessions and PIN. */
function invite_(db, me, p) {
  ownerOnly_(me);
  const found = p.id ? db.load('users').byId[p.id] : null;
  if (p.id && !found) fail_('invalid', 'පරිශීලකයා හමු නොවුණි.');
  if (found && found.role === 'admin') fail_('invalid', 'ප්‍රධාන පාලකට ආරාධනා link එකක් අවශ්‍ය නැත.');
  const token = uid_();
  const rec = Object.assign({ id: 'u' + uid_(), tv: 0, role: 'collector', phone: '', collects: true, deleted: false }, found || {});
  rec.name = cleanName_(p.name || rec.name);
  if (db.users().some(u => u.id !== rec.id && u.name === rec.name)) fail_('invalid', 'මේ නමින් කෙනෙක් දැනටමත් ඇත. නම වෙනස් කරන්න.');
  if (p.phone !== undefined) rec.phone = String(p.phone || '').slice(0, 30);
  setRole_(db, me, rec, p.role || rec.role);
  Object.assign(rec, { active: false, pinHash: '', salt: '', tv: Number(rec.tv || 0) + 1, inviteHash: hmac_('inv|' + token), inviteExp: Date.now() + INVITE_DAYS * 864e5 });
  db.save('users', rec, me);
  db.audit(me, 'users', rec.id, found ? 'update' : 'create', {}, { name: rec.name, role: rec.role, invited: true });
  db.commit();
  return { users: db.users().map(publicUser_), invite: token, id: rec.id };
}
function invitee_(db, token) {
  const h = hmac_('inv|' + String(token || ''));
  const u = db.users().find(x => x.inviteHash && safeEq_(x.inviteHash, h));
  if (!u || Number(u.inviteExp) < Date.now()) fail_('invite', 'මෙම ආරාධනා link එක භාවිතා කර ඇත, නැතිනම් කල් ඉකුත් වී ඇත. ප්‍රධාන පාලකගෙන් අලුත් link එකක් ගන්න.');
  return u;
}
function join_(db, req, key) {
  const u = invitee_(db, req.invite);
  const rec = Object.assign({}, u, { name: cleanName_(req.name || u.name), active: true, inviteHash: '', inviteExp: '' });
  if (db.users().some(x => x.id !== rec.id && x.name === rec.name)) fail_('invalid', 'මේ නමින් කෙනෙක් දැනටමත් ඇත. නම වෙනස් කරන්න.');
  setPin_(rec, req.pin);
  PropertiesService.getScriptProperties().deleteProperty('try_' + rec.id);
  db.save('users', rec, rec);
  db.audit(rec, 'users', rec.id, 'update', { name: u.name }, { name: rec.name, role: rec.role, joined: true });
  db.commit();
  return { key: key, token: newToken_(rec), user: publicUser_(rec), sheetUrl: '' };
}

function userSave_(db, me, p) {
  ownerOnly_(me);
  const found = db.load('users').byId[p.id];
  if (!found) fail_('invalid', 'පරිශීලකයා හමු නොවුණි.');
  const old = Object.assign({}, found), rec = Object.assign({}, found);
  rec.name = cleanName_(p.name || old.name);
  if (db.users().some(u => u.id !== rec.id && u.name === rec.name)) fail_('invalid', 'මේ නමින් කෙනෙක් දැනටමත් ඇත.');
  if (p.phone !== undefined) rec.phone = String(p.phone || '').slice(0, 30);
  if (old.role === 'admin') {
    if (p.collects !== undefined) rec.collects = p.collects === true;
  } else {
    if (p.role) setRole_(db, me, rec, p.role);
    if (p.active === true && !old.pinHash) fail_('invalid', 'මෙම අය තවම එක් වී නැත. ආරාධනා link එකක් යවන්න.');
    if (p.active !== undefined) rec.active = p.active === true;
    if (p.active === false) { rec.tv = Number(old.tv || 0) + 1; rec.inviteHash = ''; rec.inviteExp = ''; }
  }
  db.save('users', rec, me);
  const view = u => ({ name: u.name, role: u.role, active: u.active, collects: u.collects });
  db.audit(me, 'users', rec.id, 'update', view(old), view(rec));
  db.commit();
  return { users: db.users().map(publicUser_) };
}

function setPin_(rec, pin) {
  if (!/^\d{4,8}$/.test(String(pin))) fail_('invalid', 'PIN එක ඉලක්කම් 4ක් විය යුතුයි.');
  rec.salt = uid_();
  rec.pinHash = pinHash_(String(pin), rec.salt);
  rec.tv = (rec.tv || 0) + 1;
}

function changePin_(db, me, req) {
  checkPin_(me, req.oldPin);
  const rec = Object.assign({}, me);
  setPin_(rec, req.newPin);
  db.save('users', rec, me);
  db.audit(rec, 'users', rec.id, 'update', {}, { pinChanged: true });
  db.commit();
  return { token: newToken_(rec) };
}

/* ------------------------------------------------------------------ Sync */

function sync_(db, user, req) {
  const ops = Array.isArray(req.ops) ? req.ops.slice(0, MAX_OPS) : [];
  const since = Number(req.since) || 0;
  const results = [];
  let moneyTouched = false;

  ops.forEach(op => {
    const r = { opId: op.opId, ok: true };
    try {
      if (applyOp_(db, user, op) && MONEY_TABLES.indexOf(op.table) >= 0) moneyTouched = true;
    } catch (err) {
      if (!err.code) throw err;
      r.ok = false;
      r.error = err.message;
      r.rec = SCHEMA[op.table] ? (db.load(op.table).byId[op.id] || null) : null;
    }
    results.push(r);
  });
  db.commit();
  if (moneyTouched) {
    try { refreshReports_(db); } catch (err) { console.error('reports', err); } // the ledger itself is already saved
  }

  const changes = {};
  Object.keys(SCHEMA).forEach(t => {
    if (db.tableRev(t) <= since) return;
    const list = db.load(t).rows.filter(x => x.rev > since);
    if (list.length) changes[t] = list;
  });
  return { results: results, changes: changes, rev: db.rev, users: db.users().map(publicUser_), me: publicUser_(user) };
}

/** Returns true when something changed. Throws coded errors on rejection. */
function applyOp_(db, user, op) {
  const fields = SCHEMA[op.table];
  if (!fields) fail_('invalid', 'නොදන්නා දත්ත වර්ගයකි.');
  if (!/^[\w.-]{3,80}$/.test(String(op.id || ''))) fail_('invalid', 'දත්ත අංකය වැරදියි.');
  const patch = cleanPatch_(fields, op.patch || {});
  const before = db.load(op.table).byId[op.id] || null;

  const changed = {};
  Object.keys(patch).forEach(k => { if (!before || norm_(before[k]) !== norm_(patch[k])) changed[k] = patch[k]; });
  if (before && !Object.keys(changed).length) return false;

  const after = Object.assign({ id: op.id, deleted: false }, before || {}, changed);
  authorize_(db, user, op.table, before, after, changed);
  validate_(db, op.table, before, after, changed);

  const prev = {};
  if (before) Object.keys(changed).forEach(k => prev[k] = before[k]);
  db.save(op.table, after, user);
  if (op.table !== 'messages')
    db.audit(user, op.table, op.id, !before ? 'create' : changed.deleted === true ? 'delete' : changed.deleted === false ? 'restore' : 'update', prev, changed);
  return true;
}

function norm_(v) { return v === undefined || v === null ? '' : v === false ? '' : v; }

function cleanPatch_(fields, patch) {
  const out = {};
  Object.keys(patch).forEach(k => {
    if (k === 'deleted') { out.deleted = patch[k] === true; return; }
    const f = fields[k];
    if (!f) return;
    const v = patch[k];
    if (f[0] === 'b') out[k] = v === true;
    else if (f[0] === 'n') {
      if (v === '' || v === null || v === undefined) { out[k] = ''; return; }
      const n = Number(v);
      if (!isFinite(n) || n < 0 || n > MAX_AMOUNT) fail_('invalid', 'අගය වැරදියි.');
      out[k] = Math.round(n * 1000) / 1000;
    } else out[k] = String(v === null || v === undefined ? '' : v).slice(0, MAX_TEXT);
  });
  return out;
}

function only_(changed, allowed) { return Object.keys(changed).every(k => allowed.indexOf(k) >= 0); }

function authorize_(db, user, table, before, after, changed) {
  const admin = user.role === 'admin';
  const manage = admin || user.role === 'coordinator';
  const deny = m => fail_('denied', m || 'මෙය කළ හැක්කේ ප්‍රධාන පාලකට පමණි.');

  // A closed event is frozen for everyone until an admin re-opens it.
  if (['donations', 'expenses', 'pledges', 'deliveries', 'parcelItems', 'teams', 'tasks'].indexOf(table) >= 0) {
    const free = table === 'donations' && before && only_(changed, ['settled', 'settledAt']);
    const ids = [after.eventId].concat(before ? [before.eventId] : []);
    if (!free && ids.some(id => { const ev = db.load('events').byId[id]; return ev && ev.status === 'closed'; }))
      deny('මෙම පින්කමේ ගිණුම් වසා ඇත. වෙනස් කිරීමට නම් ප්‍රධාන අයෙක් එය නැවත විවෘත කළ යුතුයි.');
  }
  if (admin) return;
  // The coordinator runs the practical side; people, settings, events, funds and closing stay with the owner.
  if (manage && ['expenses', 'parcelItems', 'tasks', 'teams', 'deliveries', 'families'].indexOf(table) >= 0) return;
  if (manage && table === 'events' && before && only_(changed, ['parcels'])) return;

  switch (table) {
    case 'messages': case 'pledges': return;
    case 'members':
      if (changed.deleted) deny();
      return;
    case 'donations':
      if (!before) { if (after.collectorId !== user.id) deny('ඔබ එකතු කළ මුදල් පමණක් සටහන් කරන්න.'); return; }
      if (only_(changed, ['settled', 'settledAt'])) return;
      if (before.collectorId !== user.id || after.collectorId !== user.id) deny('මෙය සටහන් කළ අයට හෝ ප්‍රධාන අයට පමණක් වෙනස් කළ හැක.');
      return;
    case 'families':
      if (!before ? after.status !== 'candidate' : (changed.status !== undefined || changed.deleted !== undefined)) deny('පවුල් අනුමත කරන්නේ ප්‍රධාන පාලක හෝ coordinator.');
      return;
    case 'deliveries':
      if (!before || !only_(changed, ['status', 'doneAt', 'note'])) deny();
      return;
    case 'parcelItems':
      if (!before || !only_(changed, ['bought'])) deny();
      return;
    case 'tasks':
      if (!before || !only_(changed, ['status', 'note'])) deny();
      return;
    default: deny();
  }
}

function validate_(db, table, before, after, changed) {
  const bad = m => fail_('invalid', m);
  const exists = (t, id) => { const r = db.load(t).byId[id]; return !!r && !r.deleted; };
  const user = id => db.users().some(u => u.id === id);
  const amount = () => { if (!(Number(after.amount) > 0)) bad('මුදල ඇතුළත් කරන්න.'); };
  const day = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

  if (changed.deleted === true) {
    const used = (t, k) => db.load(t).rows.some(r => !r.deleted && r[k] === after.id);
    if (table === 'members' && (used('donations', 'memberId') || used('donations', 'payerId'))) bad('මෙම සාමාජිකයාගේ පරිත්‍යාග සටහන් ඇත. මකනවා වෙනුවට "අක්‍රිය" කරන්න.');
    if (table === 'events' && (used('donations', 'eventId') || used('expenses', 'eventId'))) bad('මෙම පින්කමට මුදල් සටහන් ඇති නිසා මැකිය නොහැක.');
    if (table === 'families' && used('deliveries', 'familyId')) bad('මෙම පවුලට බෙදාහැරීම් සටහන් ඇත. මකනවා වෙනුවට "තාවකාලිකව නවත්වන්න".');
    if (table === 'tasks' && used('expenses', 'taskId')) bad('මෙම කාර්යයට වියදම් සටහන් ඇති නිසා මැකිය නොහැක.');
    return;
  }
  if (after.deleted) return;
  const req = (t, k, m) => { if (!before || changed[k] !== undefined || changed.deleted === false) { if (!exists(t, after[k])) bad(m); } };

  switch (table) {
    case 'events':
      if (!after.title || !day(after.date)) bad('පින්කමේ නම සහ දිනය අවශ්‍යයි.');
      if (!FUNDS[after.fund]) bad('අරමුදල තෝරන්න.');
      if (['open', 'closed'].indexOf(after.status) < 0) bad('තත්ත්වය වැරදියි.');
      break;
    case 'members': case 'families':
      if (!String(after.name || '').trim()) bad('නම අවශ්‍යයි.');
      break;
    case 'donations':
      req('events', 'eventId', 'පින්කම හමු නොවුණි.');
      req('members', 'memberId', 'සාමාජිකයා හමු නොවුණි.');
      if (['cash', 'bank', 'goods'].indexOf(after.kind) < 0) bad('පරිත්‍යාග වර්ගය වැරදියි.');
      if (!before || changed.collectorId !== undefined) {
        const c = db.users().find(u => u.id === after.collectorId);
        if (!c || (c.role === 'admin' && !c.collects)) bad('මුදල් එකතු කළ අය තෝරන්න.');
      }
      if (after.kind === 'goods') { if (!after.goods) bad('භාණ්ඩය සඳහන් කරන්න.'); } else amount();
      if (after.payerId) {
        if (after.payerId === after.memberId) bad('වෙනුවෙන් ගෙවූ අය වෙනත් කෙනෙක් විය යුතුයි.');
        if (changed.payerId && !exists('members', after.payerId)) bad('ගෙවූ අය හමු නොවුණි.');
      }
      break;
    case 'pledges':
      req('events', 'eventId', 'පින්කම හමු නොවුණි.');
      req('members', 'memberId', 'සාමාජිකයා හමු නොවුණි.');
      amount();
      break;
    case 'expenses':
      req('events', 'eventId', 'පින්කම හමු නොවුණි.');
      if (after.paidBy !== 'BANK' && after.paidBy !== 'POOL' && !user(after.paidBy)) bad('ගෙවූ අය තෝරන්න.');
      if (after.taskId) req('tasks', 'taskId', 'කාර්යය හමු නොවුණි.');
      if (!after.title) bad('වියදම මොකටද කියා ලියන්න.');
      amount();
      break;
    case 'openings':
      if (!FUNDS[after.fund]) bad('අරමුදල තෝරන්න.');
      if (after.holder !== 'BANK' && after.holder !== 'POOL' && !user(after.holder)) bad('මුදල් තිබෙන්නේ කා ළඟදැයි තෝරන්න.');
      amount();
      break;
    case 'transfers':
      if (!FUNDS[after.fromFund] || !FUNDS[after.toFund] || after.fromFund === after.toFund) bad('අරමුදල් දෙක වෙනස් විය යුතුයි.');
      if (!day(after.date)) bad('දිනය අවශ්‍යයි.');
      amount();
      break;
    case 'deliveries':
      req('events', 'eventId', 'පින්කම හමු නොවුණි.');
      req('families', 'familyId', 'පවුල හමු නොවුණි.');
      break;
    case 'teams': case 'tasks': case 'parcelItems':
      req('events', 'eventId', 'පින්කම හමු නොවුණි.');
      if (!String(after.name || after.title || '').trim()) bad('නම අවශ්‍යයි.');
      break;
  }
}

function history_(limit) {
  const sh = SpreadsheetApp.getActive().getSheetByName('db_audit');
  const last = sh.getLastRow();
  const n = Math.min(Math.max(Number(limit) || 100, 1), 500, last - 1);
  if (n < 1) return [];
  return sh.getRange(last - n + 1, 1, n, AUDIT_HEADS.length).getValues().reverse().map(r => {
    const o = {};
    AUDIT_HEADS.forEach((h, i) => o[h] = text_(r[i]));
    o.before = JSON.parse(o.before || '{}');
    o.after = JSON.parse(o.after || '{}');
    return o;
  });
}

/* ------------------------------------------------------------------ Sheet storage */

function columns_(table) {
  return ['id'].concat(Object.keys(table === 'users' ? USER_FIELDS : SCHEMA[table]), Object.keys(META));
}
function fieldDef_(table, key) {
  return (table === 'users' ? USER_FIELDS : SCHEMA[table])[key] || META[key] || ['s', 'id'];
}
/** Text cells get a leading apostrophe so 0771234567, 2026-12-23 and "=..." stay plain text. */
function cellOut_(v, type) {
  if (type === 'b') return v === true;
  if (v === '' || v === null || v === undefined) return '';
  return type === 'n' ? Number(v) : "'" + v;
}
function text_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Colombo', 'yyyy-MM-dd');
  v = String(v);
  return v.charAt(0) === "'" ? v.slice(1) : v;
}
function cellIn_(v, type) {
  if (type === 'b') return v === true || v === 'TRUE';
  if (v === '' || v === null || v === undefined) return '';
  return type === 'n' ? Number(v) : text_(v);
}

function Db_() {
  this.ss = SpreadsheetApp.getActive();
  this.props = PropertiesService.getScriptProperties();
  this.revs = JSON.parse(this.props.getProperty('revs') || '{}');
  this.rev = Number(this.revs._ || 0);
  this.tables = {};
  this.audits = [];
}
Db_.prototype.tableRev = function (t) { return Number(this.revs[t] || 0); };
Db_.prototype.load = function (table) {
  if (this.tables[table]) return this.tables[table];
  const sh = this.ss.getSheetByName('db_' + table);
  if (!sh) fail_('setup', 'Sheet එකේ "db_' + table + '" කොටස නැත. මෙනුවෙන් "Sheet යාවත්කාලීන කරන්න" ඔබන්න.');
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  const heads = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const vals = lastRow > 2 ? sh.getRange(3, 1, lastRow - 2, lastCol).getValues() : [];
  const t = { sheet: sh, heads: heads, rows: [], byId: {}, rowNo: {}, dirty: {}, next: Math.max(lastRow + 1, 3) };
  vals.forEach((r, i) => {
    const o = {};
    heads.forEach((h, c) => { if (h) o[h] = cellIn_(r[c], fieldDef_(table, h)[0]); });
    if (!o.id) return;
    t.rows.push(o); t.byId[o.id] = o; t.rowNo[o.id] = i + 3;
  });
  return this.tables[table] = t;
};
Db_.prototype.users = function () { return this.load('users').rows; };
Db_.prototype.setting = function (k) { const r = this.load('settings').byId[k]; return r && !r.deleted ? r.value : ''; };
/** `rec` must be a copy, never the stored row itself. */
Db_.prototype.save = function (table, rec, user) {
  const t = this.load(table);
  this.rev++;
  rec.rev = this.rev;
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = user ? user.id : '';
  this.revs[table] = this.rev;
  this.revs._ = this.rev;
  const old = t.byId[rec.id];
  if (old) { Object.keys(old).forEach(k => delete old[k]); Object.assign(old, rec); }
  else { const row = Object.assign({}, rec); t.rows.push(row); t.byId[rec.id] = row; t.rowNo[rec.id] = t.next++; }
  t.dirty[rec.id] = true;
};
Db_.prototype.audit = function (user, table, id, action, before, after) {
  this.audits.push([new Date().toISOString(), user.id, user.name, table, id, action, JSON.stringify(before), JSON.stringify(after)].map(v => "'" + v));
};
Db_.prototype.commit = function () {
  // Revisions go first: if a row write fails, the phone retries and gets a newer revision, so nobody misses it.
  if (Object.keys(this.tables).some(n => Object.keys(this.tables[n].dirty).length)) this.props.setProperty('revs', JSON.stringify(this.revs));
  Object.keys(this.tables).forEach(name => {
    const t = this.tables[name];
    const ids = Object.keys(t.dirty).sort((a, b) => t.rowNo[a] - t.rowNo[b]);
    if (!ids.length) return;
    const line = id => t.heads.map(h => h ? cellOut_(t.byId[id][h], fieldDef_(name, h)[0]) : '');
    // Consecutive rows go out in one call.
    for (let i = 0; i < ids.length;) {
      let j = i + 1;
      while (j < ids.length && t.rowNo[ids[j]] === t.rowNo[ids[j - 1]] + 1) j++;
      const first = t.rowNo[ids[i]], n = j - i, max = t.sheet.getMaxRows();
      if (first + n - 1 > max) t.sheet.insertRowsAfter(max, first + n - 1 - max + 50);
      t.sheet.getRange(first, 1, n, t.heads.length).setValues(ids.slice(i, j).map(line));
      i = j;
    }
    t.dirty = {};
  });
  if (this.audits.length) {
    const sh = this.ss.getSheetByName('db_audit');
    const first = sh.getLastRow() + 1, max = sh.getMaxRows();
    if (first + this.audits.length - 1 > max) sh.insertRowsAfter(max, this.audits.length + 100);
    sh.getRange(first, 1, this.audits.length, AUDIT_HEADS.length).setValues(this.audits);
    this.audits = [];
  }
};

function uid_() { return Utilities.getUuid().replace(/-/g, ''); }

/* ------------------------------------------------------------------ Readable report tabs */

function cents_(n) { return Math.round(Number(n || 0) * 100); }

/** One row per event, per fund, with carried-forward balances. Mirrors app/js/calc.js. */
function summaryRows_(db) {
  const live = t => db.load(t).rows.filter(r => !r.deleted);
  const evs = live('events').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
  const out = [];
  Object.keys(FUNDS).forEach(fund => {
    const open = live('openings').filter(o => o.fund === fund).reduce((s, o) => s + cents_(o.amount), 0);
    let run = open, moved = 0;
    evs.filter(e => e.fund === fund).forEach(e => {
      const don = live('donations').filter(d => d.eventId === e.id);
      const cash = don.filter(d => d.kind !== 'goods').reduce((s, d) => s + cents_(d.amount), 0);
      const exp = live('expenses').filter(x => x.eventId === e.id).reduce((s, x) => s + cents_(x.amount), 0);
      const tr = live('transfers').filter(t => t.date <= e.date).reduce((s, t) => s + (t.toFund === fund ? cents_(t.amount) : 0) - (t.fromFund === fund ? cents_(t.amount) : 0), 0);
      const brought = run, net = tr - moved;
      moved = tr;
      run = brought + net + cash - exp;
      out.push([FUNDS[fund], e.date, e.title, brought / 100, cash / 100, net / 100, exp / 100, run / 100,
        don.filter(d => d.kind !== 'goods').length, don.filter(d => d.kind === 'goods').length, e.status === 'closed' ? 'වසා ඇත' : 'විවෘතයි']);
    });
  });
  return out;
}

function refreshReports_(db) {
  const name = t => { const m = db.load(t).byId; return id => id === 'BANK' ? 'බැංකුව' : id === 'POOL' ? 'පොදු අරමුදල' : (m[id] ? m[id].name || m[id].title : ''); };
  const mem = name('members'), usr = name('users'), ev = name('events');
  const live = t => db.load(t).rows.filter(r => !r.deleted);
  const byDate = (a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  const KIND = { cash: 'මුදල්', bank: 'බැංකුවට', goods: 'භාණ්ඩ' };

  report_(db.ss, 'සාරාංශය', ['අරමුදල', 'දිනය', 'පින්කම', 'පෙර ශේෂය', 'එකතු වූ මුදල', 'අරමුදල් මාරු', 'වියදම', 'ඉතිරිය', 'මුදල් පරිත්‍යාග', 'භාණ්ඩ පරිත්‍යාග', 'තත්ත්වය'], summaryRows_(db), 'tttnnnnnnnt');
  report_(db.ss, 'පරිත්‍යාග', ['දිනය', 'පින්කම', 'සාමාජිකයා', 'වර්ගය', 'මුදල (රු.)', 'භාණ්ඩය', 'එකතු කළේ', 'සටහන'],
    live('donations').sort(byDate).map(d => [d.date, ev(d.eventId), mem(d.memberId), KIND[d.kind], d.kind === 'goods' ? '' : d.amount, d.goods, usr(d.collectorId), d.note]), 'ttttnttt');
  report_(db.ss, 'වියදම්', ['දිනය', 'පින්කම', 'විස්තරය', 'වර්ගය', 'මුදල (රු.)', 'ගෙව්වේ', 'කඩය', 'බිල් අංකය', 'සටහන'],
    live('expenses').sort(byDate).map(x => [x.date, ev(x.eventId), x.title, x.category, x.amount, usr(x.paidBy), x.shop, x.billNo, x.note]), 'ttttntttt');
}

function report_(ss, title, heads, rows, types) {
  let sh = ss.getSheetByName(title);
  if (!sh) sh = ss.insertSheet(title, 0);
  sh.clearContents();
  const need = rows.length + 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
  sh.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight('bold').setBackground('#1d2b64').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, heads.length).setValues(rows.map(r => r.map((v, i) => types[i] === 'n' ? v : cellOut_(v, 's'))));
}

/* ------------------------------------------------------------------ Setup menu (admin, inside the Sheet) */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('පින් පොත')
    .addItem('1. මුල් සැකසුම', 'menuSetup')
    .addItem('2. මගේ (ප්‍රධාන පාලකගේ) link එක', 'menuInvite')
    .addSeparator()
    .addItem('ප්‍රධාන පාලකගේ PIN අලුත් කරන්න', 'menuResetPin')
    .addItem('Sheet යාවත්කාලීන කරන්න', 'menuUpgrade')
    .addItem('අතින් කළ වෙනස්කම් app එකට යවන්න', 'menuResync')
    .addItem('හදිසි: සියලු දුරකථන ඉවත් කරන්න', 'menuRotateKey')
    .addToUi();
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Asia/Colombo');
  // A spreadsheet must keep one visible tab, so the report tab exists before the data tabs are hidden.
  if (!ss.getSheetByName('සාරාංශය')) ss.insertSheet('සාරාංශය', 0);
  Object.keys(SCHEMA).concat('users').forEach(t => {
    let sh = ss.getSheetByName('db_' + t);
    if (!sh) sh = ss.insertSheet('db_' + t);
    const lastCol = sh.getLastColumn();
    const have = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    columns_(t).filter(k => have.indexOf(k) < 0).forEach(k => {
      have.push(k);
      const c = have.length;
      if (c > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), c - sh.getMaxColumns());
      sh.getRange(1, c, 2, 1).setValues([[k], [fieldDef_(t, k)[1]]]);
    });
    sh.setFrozenRows(2);
    sh.hideSheet();
  });
  let au = ss.getSheetByName('db_audit');
  if (!au) { au = ss.insertSheet('db_audit'); au.getRange(1, 1, 1, AUDIT_HEADS.length).setValues([AUDIT_HEADS]); au.hideSheet(); }
}

/** Creates tabs, secrets and the first admin. Safe to run again. */
function setup_(adminName, pin) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('secret')) props.setProperty('secret', uid_() + uid_());
  if (!props.getProperty('inviteKey')) props.setProperty('inviteKey', uid_());
  ensureSheets_();
  const db = new Db_();
  if (!db.users().length) {
    const rec = { id: 'u' + uid_(), name: adminName, role: 'admin', phone: '', active: true, collects: false, tv: 0, deleted: false };
    setPin_(rec, pin);
    db.save('users', rec, null);
    db.commit();
  }
  refreshReports_(db);
}

function ask_(ui, q) {
  const r = ui.prompt('පින් පොත', q, ui.ButtonSet.OK_CANCEL);
  return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null;
}

function menuSetup() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActive().getSheetByName('db_users');
  let name = '', pin = '';
  if (!sh || sh.getLastRow() < 3) {
    name = ask_(ui, 'ප්‍රධාන පාලකගේ (ඔබේ) නම:');
    if (!name) return;
    pin = ask_(ui, 'ඉලක්කම් 4ක PIN අංකයක්:');
    if (!/^\d{4,8}$/.test(pin || '')) { ui.alert('PIN එක ඉලක්කම් 4ක් විය යුතුයි. නැවත උත්සාහ කරන්න.'); return; }
  }
  setup_(name, pin);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyReminder').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyReminder').timeBased().everyDays(1).atHour(7).create();
  ui.alert('සැකසුම සාර්ථකයි! දැන් "Deploy → New deployment → Web app" කර, ඉන්පසු "2. මගේ link එක" ඔබන්න.');
}

function menuInvite() {
  const ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  if (!props.getProperty('inviteKey')) { ui.alert('පළමුව "1. මුල් සැකසුම" කරන්න.'); return; }
  const exec = ask_(ui, 'Web app URL එක (https://script.google.com/macros/s/..../exec):');
  if (!exec) return;
  const m = /\/macros\/s\/([\w-]+)\/exec/.exec(exec);
  if (!m) { ui.alert('URL එක වැරදියි. එය /exec වලින් අවසන් විය යුතුයි.'); return; }
  const known = props.getProperty('appUrl') || APP_URL;
  const typed = ask_(ui, 'App එකේ ලිපිනය. දැනට: ' + known + '\nවෙනසක් නැත්නම් හිස්ව තබා OK ඔබන්න.');
  if (typed === null) return;
  if (typed && !/^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(typed)) { ui.alert('ලිපිනය වැරදියි. එය https:// වලින් ආරම්භ විය යුතුයි.'); return; }
  const app = typed || known;
  props.setProperty('appUrl', app);
  const base = app.replace(/[#?].*$/, '').replace(/index\.html$/, '').replace(/\/*$/, '/');
  const link = base + '#setup=' + m[1] + '.' + props.getProperty('inviteKey');
  const html = HtmlService.createHtmlOutput('<p style="font:16px sans-serif">මෙය ඔබේ link එකයි. ඔබේ දුරකථනයෙන් විවෘත කරන්න. අන් අයට මෙය යවන්න එපා; ඔවුන්ට app එකේ \'කමිටුව\' තුළින් පෞද්ගලික link යවන්න:</p><textarea style="width:100%;height:130px" onclick="this.select()" readonly>' + link.replace(/[<>&"]/g, '') + '</textarea>').setWidth(460).setHeight(260);
  ui.showModalDialog(html, 'මගේ link එක');
}

function menuRotateKey() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('සියලු දුරකථන app එකෙන් ඉවත් වේ. හැමෝටම අලුත් link යැවිය යුතුයි. කරගෙන යනවාද?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('inviteKey', uid_());
  menuInvite();
}

function menuResetPin() {
  const ui = SpreadsheetApp.getUi();
  const admins = new Db_().users().filter(u => u.role === 'admin' && u.active);
  const n = ask_(ui, 'කාගේ PIN එකද? අංකය ලියන්න:\n' + admins.map((u, i) => (i + 1) + '. ' + u.name).join('\n'));
  const u = admins[Number(n) - 1];
  if (!u) return;
  const pin = ask_(ui, u.name + ' සඳහා අලුත් PIN:');
  if (!/^\d{4,8}$/.test(pin || '')) { ui.alert('PIN එක ඉලක්කම් 4ක් විය යුතුයි.'); return; }
  withDb_(db => { const rec = Object.assign({}, db.load('users').byId[u.id]); setPin_(rec, pin); db.save('users', rec, null); });
  PropertiesService.getScriptProperties().deleteProperty('try_' + u.id);
  ui.alert('PIN එක අලුත් කළා.');
}

function withDb_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { const db = new Db_(); fn(db); db.commit(); return db; } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

function menuUpgrade() { ensureSheets_(); SpreadsheetApp.getUi().alert('Sheet එක යාවත්කාලීනයි.'); }

function menuResync() {
  withDb_(db => {
    Object.keys(SCHEMA).forEach(t => db.load(t).rows.slice().forEach(r => db.save(t, Object.assign({}, r), null)));
    db.commit();
    refreshReports_(db);
  });
  SpreadsheetApp.getUi().alert('සියල්ල app එකට යැව්වා.');
}

/* ------------------------------------------------------------------ Daily e-mail nudge to the committee */

function dailyReminder() {
  const db = new Db_();
  const to = db.setting('notifyEmails');
  if (!to) return;
  const days = Number(db.setting('remindDays') || 4);
  const today = Utilities.formatDate(new Date(), 'Asia/Colombo', 'yyyy-MM-dd');
  const ms = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  db.load('events').rows.filter(e => !e.deleted && e.status === 'open').forEach(e => {
    const left = Math.round((ms(e.date) - ms(today)) / 864e5);
    if (left !== days && left !== 1) return;
    MailApp.sendEmail({ to: to, subject: e.title + ' — තව දින ' + left + 'යි',
      body: e.title + ' (' + e.date + ') සඳහා තව දින ' + left + 'ක් ඇත.\n\nපින් පොත app එකේ "පණිවිඩ" කොටසට ගොස් සාමාජිකයන්ට මතක් කිරීමේ පණිවිඩ යවන්න.' });
  });
}
