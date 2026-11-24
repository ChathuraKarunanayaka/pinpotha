// Drawn sample pictures for the collage scene (no real people).
async function makePictures() {
  const W = 1200, H = 1200;
  const sky = (x, a, b) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); };
  const disc = (x, cx, cy, r, f) => { x.fillStyle = f; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  const petal = (x, cx, cy, l, w, a, f) => { x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = f; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-w, -l * .35, -w * .5, -l * .85, 0, -l); x.bezierCurveTo(w * .5, -l * .85, w, -l * .35, 0, 0); x.fill(); x.restore(); };
  const lotus = (x, cx, cy, s) => [-1.25, 1.25, -.85, .85, -.45, .45, 0].forEach((a, i) => petal(x, cx, cy, 240 * s, 80 * s, a, ['#f29bb4', '#f29bb4', '#f6b5c7', '#f6b5c7', '#fbd0db', '#fbd0db', '#fff0f4'][i]));
  const dagoba = (x, cx, base, s, f) => { x.fillStyle = f; x.beginPath(); x.ellipse(cx, base, 300 * s, 270 * s, 0, Math.PI, 0); x.fill(); x.fillRect(cx - 340 * s, base - 4, 680 * s, 50 * s); x.fillRect(cx - 380 * s, base + 40 * s, 760 * s, 50 * s); x.fillRect(cx - 70 * s, base - 330 * s, 140 * s, 80 * s); x.beginPath(); x.moveTo(cx - 48 * s, base - 330 * s); x.lineTo(cx, base - 620 * s); x.lineTo(cx + 48 * s, base - 330 * s); x.fill(); };
  const lamp = (x, cx, cy, s) => { const g = x.createRadialGradient(cx, cy - 60 * s, 5, cx, cy - 60 * s, 200 * s); g.addColorStop(0, 'rgba(255,210,90,.95)'); g.addColorStop(1, 'rgba(255,170,40,0)'); x.fillStyle = g; x.fillRect(cx - 220 * s, cy - 280 * s, 440 * s, 440 * s); x.fillStyle = '#8a4b1f'; x.beginPath(); x.ellipse(cx, cy, 90 * s, 46 * s, 0, 0, Math.PI); x.fill(); x.fillRect(cx - 90 * s, cy - 6 * s, 180 * s, 10 * s); petal(x, cx, cy, 120 * s, 34 * s, 0, '#ffe9a0'); };
  const bag = (x, cx, cy, s, f) => { x.fillStyle = f; x.beginPath(); x.moveTo(cx - 110 * s, cy - 150 * s); x.lineTo(cx + 110 * s, cy - 150 * s); x.lineTo(cx + 140 * s, cy + 150 * s); x.lineTo(cx - 140 * s, cy + 150 * s); x.fill(); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 14 * s; x.beginPath(); x.arc(cx, cy - 150 * s, 60 * s, Math.PI, 0); x.stroke(); petal(x, cx, cy + 70 * s, 110 * s, 40 * s, -.5, 'rgba(255,255,255,.75)'); petal(x, cx, cy + 70 * s, 120 * s, 40 * s, 0, 'rgba(255,255,255,.9)'); petal(x, cx, cy + 70 * s, 110 * s, 40 * s, .5, 'rgba(255,255,255,.75)'); };
  const scenes = [
    x => { sky(x, '#1b2a6b', '#e79a6a'); disc(x, 880, 300, 120, '#ffe9a8'); dagoba(x, 560, 860, 1, '#fdfaf2'); x.fillStyle = '#2d4a2f'; x.fillRect(0, 940, W, 260); },
    x => { sky(x, '#f7ead0', '#e0c79a'); x.fillStyle = '#9b7446'; x.fillRect(0, 880, W, 320); [[250, 760, '#c0563f'], [600, 730, '#2f7d5b'], [950, 760, '#3a5aa8']].forEach(([a, b2, f]) => bag(x, a, b2, 1, f)); },
    x => { sky(x, '#1a1030', '#3a1c22'); [[200, 900, 1], [480, 760, 1.2], [780, 900, 1], [1020, 720, .9], [330, 520, .8], [720, 480, .9]].forEach(a => lamp(x, ...a)); },
    x => { sky(x, '#bfe3d8', '#3f8f8a'); for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(20,90,70,${.35 + i % 3 * .15})`; x.beginPath(); x.ellipse((i * 311) % W, 760 + (i * 137) % 400, 190, 70, 0, 0, 7); x.fill(); } lotus(x, 600, 800, 1.6); lotus(x, 230, 960, .8); lotus(x, 980, 1000, .9); },
    x => { sky(x, '#8fd0f2', '#f5f0d8'); x.fillStyle = '#6b4a2b'; x.fillRect(540, 560, 120, 640); for (let i = 0; i < 46; i++) { const a = i * 2.4, r = 60 + (i * 37) % 360; disc(x, 600 + Math.cos(a) * r * 1.2, 430 + Math.sin(a) * r * .85, 95, ['#2f7d46', '#3f9658', '#256b3a'][i % 3]); } x.fillStyle = '#c9b27a'; x.fillRect(0, 1060, W, 140); },
    x => { sky(x, '#0f1740', '#2a347c'); disc(x, 600, 480, 260, '#ffe9a8'); for (let i = 0; i < 40; i++) disc(x, (i * 197) % W, (i * 331) % 800, 4, 'rgba(255,255,255,.7)'); dagoba(x, 600, 1010, .75, '#0a1030'); },
    x => { sky(x, '#ffe6a8', '#f2a14a'); for (let i = 0; i < 5; i++) { x.fillStyle = ['#1f4fa3', '#f2c230', '#c8322b', '#ffffff', '#e8762d'][i]; x.fillRect(120 + i * 192, 180, 192, 760); } lotus(x, 600, 1120, .9); },
  ];
  const out = [];
  for (let i = 0; i < scenes.length; i++) { const c = document.createElement('canvas'); c.width = W; c.height = H; scenes[i](c.getContext('2d')); out.push(new File([await new Promise(r => c.toBlob(r, 'image/jpeg', .9))], `p${i}.jpg`, { type: 'image/jpeg' })); }
  return out;
}
