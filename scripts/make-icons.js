// Regenerates the logo + favicon set in public/ from the SVG below.
// Usage: NODE_PATH=<dir containing sharp> node scripts/make-icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'public');

const SPADE = 'M50 9 C50 9 17 37 17 59 C17 73 29 81 40 76 C43.5 74.5 46 72.5 47.5 70.5 C47.5 80 44 87 35 92 L65 92 C56 87 52.5 80 52.5 70.5 C54 72.5 56.5 74.5 60 76 C71 81 83 73 83 59 C83 37 50 9 50 9 Z';
const BG = '#0f231c', GOLD = '#c9a24d', GOLD2 = '#e2c17a', LINE = '#2a4438';

// Square app icon: dark green tile, gold spade, thin gold ring.
const tile = (r = 22) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD2}"/><stop offset="1" stop-color="${GOLD}"/></linearGradient></defs>
  <rect width="100" height="100" rx="${r}" fill="${BG}"/>
  <rect x="3" y="3" width="94" height="94" rx="${r - 3}" fill="none" stroke="${LINE}" stroke-width="2"/>
  <g transform="translate(50 52) scale(.7) translate(-50 -50)"><path d="${SPADE}" fill="url(#g)"/>
  <path d="M50 38 l5.5 8.5 -5.5 8.5 -5.5 -8.5 z" fill="${BG}"/></g>
</svg>`;

// Full-bleed variant for iOS (the OS rounds the corners itself).
const bleed = tile(0).replace('<rect x="3" y="3"', '<rect x="-100" y="-100"');

// Mark only (transparent) for use next to text.
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD2}"/><stop offset="1" stop-color="${GOLD}"/></linearGradient></defs>
  <path d="${SPADE}" fill="url(#g)"/><path d="M50 38 l5.5 8.5 -5.5 8.5 -5.5 -8.5 z" fill="${BG}"/></svg>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="24" y="24" width="1152" height="582" rx="14" fill="none" stroke="${LINE}" stroke-width="2"/>
  <g transform="translate(90 110) scale(2.6)">${mark.replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="90" y="470" font-family="DejaVu Serif, Georgia, serif" font-size="84" fill="#f1ead9">Hi-Opt II Counter</text>
  <text x="92" y="535" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" fill="#9fb3a8">Hi-Opt II blackjack trainer &amp; table assistant</text>
</svg>`;

(async () => {
  fs.writeFileSync(path.join(out, 'favicon.svg'), tile());
  fs.writeFileSync(path.join(out, 'logo.svg'), mark);
  const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(path.join(out, file));
  await png(tile(), 192, 'icon-192.png');
  await png(tile(), 512, 'icon-512.png');
  await png(bleed, 180, 'apple-touch-icon.png');
  await sharp(Buffer.from(og)).png().toFile(path.join(out, 'og.png'));

  // favicon.ico with 16/32/48 PNG frames
  const sizes = [16, 32, 48];
  const bufs = await Promise.all(sizes.map((s) => sharp(Buffer.from(tile(s < 32 ? 18 : 22)), { density: 384 }).resize(s, s).png().toBuffer()));
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dir = bufs.map((b, i) => {
    const e = Buffer.alloc(16);
    e[0] = sizes[i]; e[1] = sizes[i]; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(b.length, 8); e.writeUInt32LE(offset, 12); offset += b.length; return e;
  });
  fs.writeFileSync(path.join(out, 'favicon.ico'), Buffer.concat([head, ...dir, ...bufs]));

  fs.writeFileSync(path.join(out, 'site.webmanifest'), JSON.stringify({
    name: 'Hi-Opt II Counter', short_name: 'Hi-Opt II', start_url: '/app', display: 'standalone',
    background_color: BG, theme_color: BG,
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }, null, 2));
  console.log('icons written');
})();
