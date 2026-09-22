// Generates the packaged .exe's icon: a small BITS gate/arch motif, drawn the same way as the rest
// of the game's art (tools/make-assets.js -- pixel-by-pixel, no external image tools), using the
// same BITS palette (docs/STYLE_GUIDE.md, tools/make-assets.js PALETTE $ % & *): sand pillars, a
// terracotta arch band, a dark glass doorway. Packed into a multi-size Windows .ico (16-256px, PNG-
// compressed entries -- supported since Vista, which is all electron-builder's Windows target needs).
//
// Run:  node tools/make-icon.js          (writes build/icon.ico)
// Used by: package.json "build.win.icon" (electron-builder, docs/decisions/0010) and
// electron/main.js (the window's own taskbar icon).
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

const OUT_DIR = path.join(__dirname, '..', 'build');
const BASE = 64; // drawn at 64x64, then nearest-neighbor resized -- keeps the pixel-art look blocky
                  // at every size instead of blurring, same reasoning as pixelArt:true in src/main.js.
const SIZES = [16, 24, 32, 48, 64, 128, 256];

// Same hex values as tools/make-assets.js PALETTE ($ wall, % wall shade, & trim, * glass, archRed,
// wallHi) -- kept as a small local copy rather than requiring that file, which has side effects
// (reads vendor pack PNGs off disk) this script has no reason to trigger.
const COLOR = {
  bg: '#1a1c2c',       // K: outline/background navy, matches the game's own canvas backgroundColor
  wall: '#e6cba4',     // $: BITS wall (pillars)
  wallShade: '#cfae86',// %: BITS wall shade (pillar inner edge)
  wallHi: '#f2ddb8',   // wallHi: light cap band
  arch: '#9c3a28',     // archRed: the grand-entrance arch
  archLight: '#cf8a6c',// &: BITS trim (arch highlight edge)
  glass: '#2f3a44',    // *: glass doorway
  glassLight: '#4a5866',// a lighter reflection stripe on the glass
  ground: '#6f362c',   // paving bevel deep shadow, used for the step line
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) }; // starts fully transparent
}

function setPixel(canvas, x, y, hex, alpha = 255) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const [r, g, b] = hexToRgb(hex);
  const i = (y * canvas.size + x) * 4;
  canvas.data[i] = r;
  canvas.data[i + 1] = g;
  canvas.data[i + 2] = b;
  canvas.data[i + 3] = alpha;
}

function fillRect(canvas, x0, y0, w, h, hex) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(canvas, x, y, hex);
}

// Rounded-square badge background, like every other app icon -- a quarter-circle cut at each
// corner (radius r) so it doesn't look like a plain sharp-edged square tile.
function drawBadgeBackground(canvas, hex, r) {
  const n = canvas.size;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x < r ? r - x : x >= n - r ? x - (n - r - 1) : 0;
      const dy = y < r ? r - y : y >= n - r ? y - (n - r - 1) : 0;
      if (dx * dx + dy * dy <= r * r) setPixel(canvas, x, y, hex);
    }
  }
}

// The gate motif itself, drawn straight at BASE resolution: two pillars, a rounded arch band on
// top connecting them, and a dark glass doorway between -- the same shapes the campus's own BITS
// entrance tiles use (decisions/0012 addendum "the grand-entrance tiles"), simplified for legibility
// at 16px.
function drawGateMotif(canvas) {
  drawBadgeBackground(canvas, COLOR.bg, 10);

  const pillarW = 9;
  const pillarTop = 22;
  const pillarBottom = 54;
  const leftX = 12;
  const rightX = canvas.size - 12 - pillarW;

  for (const px of [leftX, rightX]) {
    fillRect(canvas, px, pillarTop, pillarW, pillarBottom - pillarTop, COLOR.wall);
    fillRect(canvas, px, pillarTop, 2, pillarBottom - pillarTop, COLOR.wallHi); // sunlit left edge
    fillRect(canvas, px + pillarW - 2, pillarTop, 2, pillarBottom - pillarTop, COLOR.wallShade); // shaded right edge
  }

  // Rounded arch band spanning both pillars, y gets higher (smaller) towards the middle.
  const archLeft = leftX - 2;
  const archRight = rightX + pillarW + 2;
  const archBaseY = pillarTop + 2;
  const archRise = 10;
  for (let x = archLeft; x < archRight; x++) {
    const mid = (archLeft + archRight) / 2;
    const t = 1 - Math.pow((x - mid) / ((archRight - archLeft) / 2), 2); // parabola, 1 at center
    const rise = Math.max(0, Math.round(archRise * Math.max(t, 0)));
    const topY = archBaseY - rise;
    fillRect(canvas, x, topY, 1, archBaseY + 6 - topY, COLOR.arch);
    setPixel(canvas, x, topY, COLOR.archLight); // highlight along the top edge
  }

  // Dark glass doorway between the pillars.
  const doorX = leftX + pillarW + 2;
  const doorW = rightX - doorX;
  const doorTop = pillarTop + 8;
  fillRect(canvas, doorX, doorTop, doorW, pillarBottom - doorTop, COLOR.glass);
  fillRect(canvas, doorX + 2, doorTop + 2, Math.max(1, Math.floor(doorW / 3)), pillarBottom - doorTop - 4, COLOR.glassLight);

  // A short step/ground line under both pillars, like the campus entrance steps.
  fillRect(canvas, leftX - 2, pillarBottom, rightX + pillarW - leftX + 4, 3, COLOR.ground);
}

// Nearest-neighbour resize (both up and down): keeps the pixel-art look blocky instead of blurring
// it, the same visual language as pixelArt:true/roundPixels in src/main.js's Phaser config.
function resize(canvas, targetSize) {
  const out = makeCanvas(targetSize);
  for (let y = 0; y < targetSize; y++) {
    const sy = Math.min(canvas.size - 1, Math.floor((y * canvas.size) / targetSize));
    for (let x = 0; x < targetSize; x++) {
      const sx = Math.min(canvas.size - 1, Math.floor((x * canvas.size) / targetSize));
      const si = (sy * canvas.size + sx) * 4;
      const di = (y * targetSize + x) * 4;
      out.data[di] = canvas.data[si];
      out.data[di + 1] = canvas.data[si + 1];
      out.data[di + 2] = canvas.data[si + 2];
      out.data[di + 3] = canvas.data[si + 3];
    }
  }
  return out;
}

// Windows .ico container: a 6-byte header, one 16-byte directory entry per image, then the raw
// image bytes back to back. Modern Windows (Vista+) accepts a plain PNG file as an entry's image
// data (bitCount 32, no separate AND mask needed) -- simpler and smaller than classic BMP/DIB
// entries, and every size electron-builder's Windows target needs (16-256) supports it.
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dirEntries = [];
  const datas = [];
  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
    dir.writeUInt8(0, 2); // color palette: none
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(png.length, 8); // size of image data
    dir.writeUInt32LE(offset, 12); // offset of image data
    offset += png.length;
    dirEntries.push(dir);
    datas.push(png);
  }
  return Buffer.concat([header, ...dirEntries, ...datas]);
}

function main() {
  const base = makeCanvas(BASE);
  drawGateMotif(base);

  const entries = SIZES.map((size) => {
    const resized = size === BASE ? base : resize(base, size);
    const png = encodePNG(size, size, Buffer.from(resized.data.buffer, resized.data.byteOffset, resized.data.length));
    return { size, png };
  });

  const ico = buildIco(entries);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, 'icon.ico');
  fs.writeFileSync(outFile, ico);
  console.log(`Wrote ${outFile} (${ico.length} bytes, sizes: ${SIZES.join(', ')})`);
}

if (require.main === module) main();

module.exports = { drawGateMotif, resize, buildIco, makeCanvas, SIZES, BASE };
