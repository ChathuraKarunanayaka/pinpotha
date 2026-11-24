// Step 2: paints every frame in the browser and encodes an MP4 with a soft bell track.
//   FFMPEG=path node tools/video/render.mjs <shotsDir> <out.mp4> [probeSeconds,comma,separated]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve, browser } from './lib.mjs';

const [, , SHOTS, OUT, PROBE] = process.argv;
const FPS = 25, FFMPEG = process.env.FFMPEG || 'ffmpeg';
const here = fileURLToPath(new URL('./', import.meta.url));
let sink = () => {};
const srv = await serve({ call: () => ({}) }, { '/shots/': SHOTS + '/', '/video/': here }, {
  '/stage': (q, r) => { r.setHeader('content-type', 'text/html'); r.end('<!doctype html><meta charset=utf-8><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@600;700;800&family=Noto+Sans+Sinhala:wght@400;500;600;700&display=swap"><body></body>'); },
  '/frame': (q, r) => { const b = []; q.on('data', x => b.push(x)); q.on('end', async () => { await sink(Buffer.concat(b)); r.end('ok'); }); },
});
const b = await browser({ width: 400, height: 400, scale: 1, mobile: false });
await b.go(`http://localhost:${srv.port}/stage`);
const total = await b.ev(`(async () => { window.M = await import('/video/compose.js'); return await M.init(); })()`);

if (PROBE) {
  const list = PROBE.split(',').map(Number);
  let i = 0;
  sink = x => { fs.writeFileSync(path.join(SHOTS, `probe-${list[i]}.jpg`), x); i++; };
  for (const t of list) await b.ev(`M.render(${Math.round(t * FPS)}, ${Math.round(t * FPS) + 1}, ${FPS})`);
  console.log('total', total);
} else {
  /* ---- soft singing-bowl notes: a slow pentatonic wander, mixed low under the captions ---- */
  const SR = 44100, N = Math.ceil(total * SR), buf = new Float32Array(N);
  const scale = [146.83, 164.81, 196, 220, 246.94, 293.66, 329.63, 392];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let t = 0.4, k = 2; t < total - 4; t += 1.9 + rnd() * 1.3) {
    k = Math.max(0, Math.min(scale.length - 1, k + Math.round((rnd() - 0.5) * 4)));
    const f = scale[k], vol = 0.1 + rnd() * 0.05, s0 = Math.floor(t * SR);
    [[1, 1, 2.6], [2.01, 0.35, 1.7], [2.99, 0.16, 1.1], [0.5, 0.4, 3]].forEach(([m, a, decay]) => {
      for (let i = 0; i < SR * 5 && s0 + i < N; i++) { const x = i / SR; buf[s0 + i] += Math.sin(2 * Math.PI * f * m * x) * a * vol * Math.exp(-x / decay) * Math.min(1, x / 0.03); }
    });
  }
  const pcm = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++) { const x = i / SR, fade = Math.min(1, x / 1.5, (total - x) / 3); pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(buf[i] * 1.1) * 0.75 * Math.max(0, fade))) * 32767), i * 2); }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  const wav = path.join(SHOTS, 'music.wav');
  fs.writeFileSync(wav, Buffer.concat([head, pcm]));

  const codec = (process.env.VCODEC || 'h264_mf -b:v 1500k').split(' ');
  const ff = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', ...codec, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', OUT,
    // a second, small copy that any phone can forward on WhatsApp
    '-map', '0:v', '-map', '1:a', '-vf', 'scale=720:1280:flags=lanczos', '-c:v', ...(process.env.VCODEC_SMALL || 'h264_mf -b:v 330k').split(' '), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '48k', '-shortest', '-movflags', '+faststart', OUT.replace('.mp4', '-whatsapp.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  sink = x => new Promise(res => { ff.stdin.write(x) ? res() : ff.stdin.once('drain', res); });
  const frames = Math.floor(total * FPS);
  for (let f = 0; f < frames; f += 250) { await b.ev(`M.render(${f}, ${Math.min(frames, f + 250)}, ${FPS})`); if (f % 1000 === 0) console.log(f, '/', frames); }
  ff.stdin.end();
  const code = await new Promise(r => ff.on('close', r));
  console.log('ffmpeg exit', code, 'seconds', Math.round(total), 'MB', (fs.statSync(OUT).size / 1048576).toFixed(1));
}
await b.close();
srv.close();
process.exit(0);
