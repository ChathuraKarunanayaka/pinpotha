// Draws the app icons (full moon and lotus) as PNG without any dependencies.
import fs from 'node:fs';
import zlib from 'node:zlib';

const crcT = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]), o = Buffer.alloc(8 + d.length + 4); o.writeUInt32BE(d.length, 0); b.copy(o, 4); o.writeUInt32BE(crc(b), 8 + d.length); return o; };

// Unit square, y down. Petals are lens shapes: the overlap of two circles, rotated about the lotus base.
const petal = (x, y, ang, len, wid) => {
  const dx = x - 0.5, dy = y - 0.68, c = Math.cos(-ang), s = Math.sin(-ang);
  const px = dx * c - dy * s, py = dx * s + dy * c + len / 2;
  const h = len / 2, w = wid / 2, R = (h * h + w * w) / (2 * w);
  return Math.hypot(px - (R - w), py) < R && Math.hypot(px + (R - w), py) < R;
};
function color(x, y) {
  const pet = [[-1.15, 0.24], [1.15, 0.24], [-0.6, 0.29], [0.6, 0.29], [0, 0.33]];
  for (let i = pet.length - 1; i >= 0; i--) if (petal(x, y, pet[i][0], pet[i][1], 0.135)) return i === 4 ? [255, 246, 248] : i > 1 ? [250, 205, 216] : [243, 172, 190];
  const d = Math.hypot(x - 0.5, y - 0.43);
  if (d < 0.255) return [255, 233, 168];
  const g = Math.max(0, 1 - (d - 0.255) / 0.25) * 0.35, t = y;
  return [15 + 27 * t + g * 120, 23 + 29 * t + g * 100, 64 + 60 * t + g * 20];
}
for (const n of [180, 192, 512]) {
  const rowsz = n * 3 + 1, rawb = Buffer.alloc(rowsz * n), ss = 4;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = [0, 0, 0];
    for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) color((x + (i + 0.5) / ss) / n, (y + (j + 0.5) / ss) / n).forEach((v, k) => { a[k] += v; });
    a.forEach((v, k) => { rawb[y * rowsz + 1 + x * 3 + k] = Math.min(255, Math.round(v / (ss * ss))); });
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(new URL(`../app/icons/icon-${n}.png`, import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(rawb, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
