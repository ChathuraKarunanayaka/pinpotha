import test from 'node:test';
import assert from 'node:assert/strict';
import { search, rank } from '../app/js/search.js';

const NAMES = ['සුනිල් පෙරේරා', 'කමලා විජේසිංහ', 'නිමල් බණ්ඩාර', 'ශ්‍යාමලී ද සිල්වා', 'රංජිත් කුමාර', 'අනුලා මැණිකේ', 'චමින්ද ජයසූරිය', 'දිල්රුක්ෂි ප්‍රනාන්දු', 'ගාමිණී රත්නායක', 'හේමා අබේවර්ධන',
  'ඉන්ද්‍රානි සෙනෙවිරත්න', 'ජයන්ත ගුණසේකර', 'කුසුම් රාජපක්ෂ', 'ලාල් විතානගේ', 'මංජුලා ධර්මසේන', 'නදීෂා ලියනගේ', 'ඔෂධී සමරවීර', 'පියල් ගමගේ', 'රුවන් දිසානායක', 'සමන්ති කරුණාරත්න',
  'තිලක් හේරත්', 'උපුල් එදිරිසිංහ', 'වසන්ති මුණසිංහ', 'යසෝමා බාලසූරිය', 'අනිල් ඤාණදාස', 'කෘෂ්ණා ශ්‍රීමති', 'Nimal Fonseka', 'සංගීතා ප්‍රියන්ත'];
const find = q => search(NAMES, q, n => ({ text: [n] }));
const first = (q, want) => assert.ok(find(q)[0]?.includes(want), `${q} → ${find(q).join(' | ') || 'nothing'}`);

test('English letters find Sinhala names', () => {
  for (const [q, want] of Object.entries({
    Anula: 'අනුලා', anula: 'අනුලා', Anulaa: 'අනුලා', anu: 'අනුලා', sunil: 'සුනිල්', Suneel: 'සුනිල්', perera: 'පෙරේරා', kamala: 'කමලා', wijesinghe: 'විජේසිංහ', wijesinha: 'විජේසිංහ', vijesingha: 'විජේසිංහ',
    shyamali: 'ශ්‍යාමලී', 'de silva': 'සිල්වා', ranjith: 'රංජිත්', menike: 'මැණිකේ', manike: 'මැණිකේ', chaminda: 'චමින්ද', jayasooriya: 'ජයසූරිය', jayasuriya: 'ජයසූරිය', dilrukshi: 'දිල්රුක්ෂි', fernando: 'ප්‍රනාන්දු', pranandu: 'ප්‍රනාන්දු',
    gamini: 'ගාමිණී', rathnayake: 'රත්නායක', ratnayaka: 'රත්නායක', hema: 'හේමා', abeywardena: 'අබේවර්ධන', abeywardana: 'අබේවර්ධන', indrani: 'ඉන්ද්‍රානි', senevirathne: 'සෙනෙවිරත්න', jayantha: 'ජයන්ත', gunasekara: 'ගුණසේකර', gunasekera: 'ගුණසේකර',
    rajapaksha: 'රාජපක්ෂ', rajapakse: 'රාජපක්ෂ', withanage: 'විතානගේ', vithanage: 'විතානගේ', manjula: 'මංජුලා', dharmasena: 'ධර්මසේන', nadeesha: 'නදීෂා', liyanage: 'ලියනගේ', oshadi: 'ඔෂධී', samaraweera: 'සමරවීර', dissanayake: 'දිසානායක',
    karunarathne: 'කරුණාරත්න', herath: 'හේරත්', thilak: 'තිලක්', edirisinghe: 'එදිරිසිංහ', munasinghe: 'මුණසිංහ', yasoma: 'යසෝමා', gnanadasa: 'ඤාණදාස', krishna: 'කෘෂ්ණා', sangeetha: 'සංගීතා', priyantha: 'ප්‍රියන්ත', ruwan: 'රුවන්',
    'sunil per': 'සුනිල්', 'SUNIL  PERERA': 'සුනිල්',
  })) first(q, want);
});

test('Sinhala still works: part of a word, half-typed letters, common letter mix-ups, and names saved in English', () => {
  first('අනු', 'අනුලා'); first('ස', 'සුනිල්'); first('සුනිල', 'සුනිල්'); first('ගාමිනි', 'ගාමිණී'); first('මුනසිංහ', 'මුණසිංහ');
  first('බන්ඩාර', 'බණ්ඩාර'); first('ෆොන්සේකා', 'Fonseka'); first('පෙරේ', 'පෙරේරා');
});

test('a good match hides loose ones; nonsense finds nothing', () => {
  assert.deepEqual(find('anula'), ['අනුලා මැණිකේ']);
  assert.deepEqual(find('anil'), ['අනිල් ඤාණදාස']);
  for (const q of ['xqv', 'gggbt', 'bob marley', '!!']) assert.deepEqual(find(q), [], q);
  assert.equal(find('').length, NAMES.length);
});

test('phone and village are searched too', () => {
  const list = [{ n: 'අනුලා', p: '077 123 4567', a: 'මහරගම' }, { n: 'සුනිල්', p: '', a: 'කොට්ටාව' }];
  const f = q => search(list, q, x => ({ phone: x.p, text: [x.n, x.a] })).map(x => x.n);
  assert.deepEqual(f('0771234'), ['අනුලා']);
  assert.deepEqual(f('kottawa'), ['සුනිල්']);
  assert.deepEqual(f('maharagama'), ['අනුලා']);
});

test('fast enough to run on every key press', () => {
  const big = Array.from({ length: 1000 }, (_, i) => NAMES[i % NAMES.length] + ' ' + i), t = performance.now();
  for (const q of ['a', 'an', 'anu', 'anul', 'anula']) search(big, q, n => ({ text: [n] }));
  assert.ok(performance.now() - t < 400);
  assert.equal(rank('x', ''), -1);
});
