// Finds Sinhala names typed in English letters ("anula" → අනුලා), and forgives the usual
// spelling differences in either script (ණ/න, ළ/ල, th/t, w/v, aa/a ...).
// Both sides are reduced to the same simple sound key, then compared.

const CONS = {
  'ක': 'k', 'ඛ': 'k', 'ග': 'g', 'ඝ': 'g', 'ඞ': 'n', 'ඟ': 'ng', 'ච': 'c', 'ඡ': 'c', 'ජ': 'j', 'ඣ': 'j', 'ඤ': 'n', 'ඥ': 'n', 'ඦ': 'nj',
  'ට': 't', 'ඨ': 't', 'ඩ': 'd', 'ඪ': 'd', 'ණ': 'n', 'ඬ': 'nd', 'ත': 't', 'ථ': 't', 'ද': 'd', 'ධ': 'd', 'න': 'n', 'ඳ': 'nd',
  'ප': 'p', 'ඵ': 'p', 'බ': 'b', 'භ': 'b', 'ම': 'm', 'ඹ': 'mb', 'ය': 'y', 'ර': 'r', 'ල': 'l', 'ව': 'v', 'ශ': 's', 'ෂ': 's', 'ස': 's', 'හ': 'h', 'ළ': 'l', 'ෆ': 'p',
};
const VOWEL = { 'අ': 'a', 'ආ': 'a', 'ඇ': 'a', 'ඈ': 'a', 'ඉ': 'i', 'ඊ': 'i', 'උ': 'u', 'ඌ': 'u', 'ඍ': 'ru', 'ඎ': 'ru', 'එ': 'e', 'ඒ': 'e', 'ඓ': 'ai', 'ඔ': 'o', 'ඕ': 'o', 'ඖ': 'au' };
const SIGN = { 'ා': 'a', 'ැ': 'a', 'ෑ': 'a', 'ි': 'i', 'ී': 'i', 'ු': 'u', 'ූ': 'u', 'ෘ': 'ru', 'ෲ': 'ru', 'ෙ': 'e', 'ේ': 'e', 'ෛ': 'ai', 'ො': 'o', 'ෝ': 'o', 'ෞ': 'au', '්': '' };

function fromSinhala(word) {
  let out = '';
  const ch = [...word.normalize('NFC').replace(/[​-‍﻿]/g, '')];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (CONS[c] !== undefined) {
      const next = ch[i + 1];
      out += CONS[c];
      if (SIGN[next] !== undefined) { out += SIGN[next]; i++; } else out += 'a'; // the letter's own "a"
    } else if (VOWEL[c]) out += VOWEL[c];
    else if (c === 'ං') out += 'n';
    else if (c === 'ඃ') out += 'h';
    else out += SIGN[c] ?? c;
  }
  return out;
}
function fromLatin(word) {
  return word.replace(/ch/g, 'c\u0001').replace(/c(?!\u0001)/g, 'k').replace(/\u0001/g, '')
    .replace(/gn/g, 'n').replace(/ph|f/g, 'p').replace(/sh|z/g, 's').replace(/([tdbgkj])h/g, '$1')
    .replace(/w/g, 'v').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ae/g, 'a');
}
/** Sound key: lower-case Latin, long vowels and doubled letters collapsed. */
export function sound(word) {
  const w = String(word || '').toLowerCase();
  const k = /[඀-෿]/.test(w) ? fromSinhala(w) : fromLatin(w);
  return k.replace(/ng/g, 'n').replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
}
/** Consonants only; y and h come and go between spellings (Abeywardena / අබේවර්ධන). */
const bones = key => key.replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1');
const vowelStart = key => /^[aeiou]/.test(key);

const words = s => String(s || '').toLowerCase().split(/[\s.,\-()/]+/).filter(Boolean);
const plain = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cache = new Map();
function keysOf(text) {
  let k = cache.get(text);
  if (!k) {
    if (cache.size > 3000) cache.clear();
    k = words(text).map(sound);
    cache.set(text, k);
  }
  return k;
}

/** 0 = exact text, 1 = sounds the same from the start of a word, 2 = similar consonants, -1 = no match. */
export function rank(query, ...texts) {
  const q = plain(query);
  if (!q) return 0;
  if (texts.some(t => plain(t).includes(q))) return 0;
  const qs = words(q).map(sound).filter(Boolean);
  if (!qs.length) return -1;
  const keys = texts.flatMap(t => keysOf(String(t || '')));
  // A Sinhala query ending in a bare letter may be half typed, so its final "a" is optional.
  const starts = (k, x) => k.startsWith(x) || (/[ක-ෆ]$/.test(q) && x.length > 1 && k.startsWith(x.slice(0, -1)));
  if (qs.every(x => keys.some(k => starts(k, x)))) return 1;
  const joined = keys.join(''); // "deSilva" typed as one word
  if (qs.length === 1 && qs[0].length > 3 && joined.includes(qs[0])) return 1;
  const near = x => { const b = bones(x); return keys.some(k => starts(k, x) || (b.length > 1 ? vowelStart(k) === vowelStart(x) && bones(k).startsWith(b) : qs.length > 1 && x.length <= 2 && k[0] === x[0])); };
  if (qs.every(near)) return 2;
  return -1;
}

/** Keeps matches in their given order, best kind first; near matches only when nothing better exists. */
export function search(list, query, texts) {
  if (!plain(query)) return list.slice();
  const digits = String(query).replace(/\D/g, '').replace(/^0/, '');
  const scored = list.map(item => {
    const { phone, text } = texts(item);
    const byPhone = digits.length > 2 && String(phone || '').replace(/\D/g, '').includes(digits);
    return { item, r: byPhone ? 0 : rank(query, ...text) };
  });
  const good = scored.filter(x => x.r === 0 || x.r === 1).sort((a, b) => a.r - b.r);
  return (good.length ? good : scored.filter(x => x.r === 2)).map(x => x.item);
}
