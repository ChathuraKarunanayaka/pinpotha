// Minimal PDF writer: one full-page JPEG per A4 page. Pages are painted by the browser's own
// text engine first, so Sinhala letters always join correctly, on every phone and PDF viewer.
const A4 = [595.28, 841.89];
const enc = new TextEncoder();
const hexTitle = s => 'FEFF' + [...Array(s.length).keys()].map(i => s.charCodeAt(i).toString(16).padStart(4, '0')).join('').toUpperCase();

/** pages: [{ jpeg: Uint8Array, w, h }] → Uint8Array */
export function imagesToPdf(pages, title = '') {
  const parts = [], offsets = [];
  let size = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); size += b.length; };
  const obj = (n, ...body) => { offsets[n] = size; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
  push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const first = 4; // 1 catalog, 2 pages, 3 info; then page, content, image per page
  obj(1, '<< /Type /Catalog /Pages 2 0 R /Lang (si) >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${first + i * 3} 0 R`).join(' ')}] >>`);
  obj(3, `<< /Title <${hexTitle(title)}> >>`);
  pages.forEach((p, i) => {
    const n = first + i * 3, draw = `q ${A4[0]} 0 0 ${A4[1]} 0 0 cm /P Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /P ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream');
  });
  const count = first + pages.length * 3, xref = size;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(size);
  let at = 0;
  parts.forEach(b => { out.set(b, at); at += b.length; });
  return out;
}
