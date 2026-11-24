// Runs backend/Code.gs in Node against an in-memory spreadsheet, for tests and local development.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.maxRows = 1000; this.maxCols = 26; this.hidden = false; }
  getLastRow() { for (let r = this.cells.length; r > 0; r--) if ((this.cells[r - 1] || []).some(v => v !== '' && v !== undefined)) return r; return 0; }
  getLastColumn() { return this.cells.reduce((m, r) => { let c = (r || []).length; while (c && (r[c - 1] === '' || r[c - 1] === undefined)) c--; return Math.max(m, c); }, 0); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(_, n) { this.maxRows += n; }
  insertColumnsAfter(_, n) { this.maxCols += n; }
  setFrozenRows() {}
  hideSheet() { this.hidden = true; }
  clearContents() { this.cells = []; }
  getRange(r, c, n = 1, w = 1) {
    if (r < 1 || c < 1 || n < 1 || w < 1 || r + n - 1 > this.maxRows || c + w - 1 > this.maxCols) throw new Error(`range out of bounds ${this.name} ${r},${c},${n},${w}`);
    const sh = this;
    const range = {
      getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: w }, (_, j) => sh.cells[r - 1 + i]?.[c - 1 + j] ?? '')),
      setValues(v) {
        if (v.length !== n || v.some(x => x.length !== w)) throw new Error(`size mismatch on ${sh.name}`);
        v.forEach((row, i) => row.forEach((x, j) => { (sh.cells[r - 1 + i] ||= [])[c - 1 + j] = coerce(x); }));
        return range;
      },
      setFontWeight: () => range, setBackground: () => range, setFontColor: () => range,
    };
    return range;
  }
}
/** Mimics the way Sheets mangles unquoted text, so missing apostrophes fail tests. */
function coerce(x) {
  if (typeof x !== 'string') return x ?? '';
  if (x.startsWith("'")) return x.slice(1);
  if (x.startsWith('=')) return '#FORMULA!';
  if (/^\d{4}-\d\d-\d\d$/.test(x)) return new Date(x + 'T00:00:00+05:30');
  if (x !== '' && !isNaN(Number(x))) return Number(x);
  return x;
}

export function createBackend({ file = new URL('../backend/Code.gs', import.meta.url) } = {}) {
  const sheets = [new Sheet('Sheet1')];
  const props = new Map();
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: (n, i) => { const s = new Sheet(n); i === undefined ? sheets.push(s) : sheets.splice(i, 0, s); return s; },
    setSpreadsheetTimeZone() {}, getUrl: () => 'https://docs.google.com/spreadsheets/d/mock',
  };
  const ctx = {
    console, Date, JSON, Math,
    SpreadsheetApp: { getActive: () => ss, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, String(v)), deleteProperty: k => props.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (t, k) => [...crypto.createHmac('sha256', k).update(t).digest()],
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'),
      formatDate: d => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => ({ text: s }) }) },
    MailApp: { sent: [], sendEmail(m) { this.sent.push(m); } },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return {
    ctx, sheets, props,
    run: code => vm.runInContext(code, ctx),
    sheet: n => sheets.find(s => s.name === n),
    setup: (name, pin) => ctx.setup_(name, pin),
    key: () => props.get('inviteKey'),
    /** JSON in, JSON out — exactly what a phone sees. */
    call: req => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }).text),
  };
}
