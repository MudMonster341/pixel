// Minimal PNG decoder (FB-0025): reads vendor atlas PNGs so tools/make-assets.js can copy pixel
// rects out of them. Covers 8-bit truecolor/truecolor+alpha (color type 2/6, the Roguelike Modern
// City sheet) and 1/2/4/8-bit palette images with an optional tRNS alpha table (color type 3, the
// Pixel Vehicle Pack's per-vehicle PNGs use 4-bit palettes). Grayscale (0/4) is decoded too since
// it's cheap to support once the bit-unpacking machinery exists. No dependencies beyond Node's
// built-in `zlib` for the DEFLATE stream -- everything else (chunk framing, scanline
// un-filtering, sub-byte pixel unpacking) is implemented here.
//
// Deliberately out of scope, and this throws loudly instead of guessing: Adam7 interlacing,
// 16-bit channels, and any chunk-level corruption (bad signature, missing IHDR/PLTE).
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf) {
  const chunks = [];
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 8 + len + 4; // skip the trailing CRC, we trust local vendor files
  }
  return chunks;
}

// Extracts `bitDepth` bits starting at `bitOffset` from a decoded (unfiltered) scanline. Works for
// bitDepth 1/2/4/8 uniformly, including the byte-aligned 8-bit case.
function readSample(row, bitOffset, bitDepth) {
  const byteIndex = Math.floor(bitOffset / 8);
  const bitIndexInByte = bitOffset % 8;
  const shift = 8 - bitIndexInByte - bitDepth;
  const mask = (1 << bitDepth) - 1;
  return (row[byteIndex] >> shift) & mask;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Un-applies the per-scanline PNG filter (None/Sub/Up/Average/Paeth) to get raw pixel bytes back.
function unfilter(raw, width, height, bitsPerPixel, rowBytes) {
  const filterBpp = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const stride = rowBytes + 1;
  const out = Buffer.alloc(rowBytes * height);
  let prevRow = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const src = raw.slice(y * stride + 1, y * stride + 1 + rowBytes);
    const outRow = Buffer.alloc(rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= filterBpp ? outRow[x - filterBpp] : 0;
      const b = prevRow[x];
      const c = x >= filterBpp ? prevRow[x - filterBpp] : 0;
      let value = src[x];
      if (filterType === 0) {
        // none
      } else if (filterType === 1) {
        value = (value + a) & 0xff;
      } else if (filterType === 2) {
        value = (value + b) & 0xff;
      } else if (filterType === 3) {
        value = (value + Math.floor((a + b) / 2)) & 0xff;
      } else if (filterType === 4) {
        value = (value + paeth(a, b, c)) & 0xff;
      } else {
        throw new Error(`Unsupported PNG scanline filter type ${filterType}`);
      }
      outRow[x] = value;
    }
    outRow.copy(out, y * rowBytes);
    prevRow = outRow;
  }
  return out;
}

// Decodes a PNG file's bytes into { width, height, data } where `data` is a tightly-packed
// width*height*4 RGBA Buffer (matching the shape tools/lib/png.js's encodePNG expects).
function decodePNG(buf) {
  if (!buf.slice(0, 8).equals(PNG_SIGNATURE)) throw new Error('Not a PNG file (bad signature)');

  const chunks = readChunks(buf);
  const ihdrChunk = chunks.find((c) => c.type === 'IHDR');
  if (!ihdrChunk) throw new Error('PNG has no IHDR chunk');
  const ihdr = ihdrChunk.data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compressionMethod = ihdr[10];
  const filterMethod = ihdr[11];
  const interlaceMethod = ihdr[12];

  if (compressionMethod !== 0 || filterMethod !== 0) {
    throw new Error('Unsupported PNG compression/filter method (expected the standard deflate + adaptive filtering)');
  }
  if (interlaceMethod !== 0) {
    throw new Error('Interlaced (Adam7) PNGs are not supported by this decoder');
  }
  if (![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG color type ${colorType}`);
  }
  if (![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth} (16-bit channels are not supported)`);
  }
  if ([2, 4, 6].includes(colorType) && bitDepth !== 8) {
    throw new Error(`Color type ${colorType} requires 8-bit depth, got ${bitDepth}`);
  }

  let palette = null; // array of [r, g, b], for color type 3
  let trns = null; // Buffer of per-index alpha (color type 3), shorter than palette = rest opaque
  const idatParts = [];
  for (const { type, data } of chunks) {
    if (type === 'PLTE') {
      if (data.length % 3 !== 0) throw new Error('Malformed PLTE chunk');
      palette = [];
      for (let i = 0; i < data.length; i += 3) palette.push([data[i], data[i + 1], data[i + 2]]);
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatParts.push(data);
    }
  }
  if (colorType === 3 && !palette) throw new Error('Palette color type (3) with no PLTE chunk');

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bitsPerPixel = channels * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);

  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const unfiltered = unfilter(raw, width, height, bitsPerPixel, rowBytes);

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = unfiltered.slice(y * rowBytes, (y + 1) * rowBytes);
    for (let x = 0; x < width; x++) {
      const bitOffset = x * bitsPerPixel;
      const outIdx = (y * width + x) * 4;
      if (colorType === 2) {
        const byteOff = bitOffset / 8;
        rgba[outIdx] = row[byteOff];
        rgba[outIdx + 1] = row[byteOff + 1];
        rgba[outIdx + 2] = row[byteOff + 2];
        rgba[outIdx + 3] = 255;
      } else if (colorType === 6) {
        const byteOff = bitOffset / 8;
        rgba[outIdx] = row[byteOff];
        rgba[outIdx + 1] = row[byteOff + 1];
        rgba[outIdx + 2] = row[byteOff + 2];
        rgba[outIdx + 3] = row[byteOff + 3];
      } else if (colorType === 4) {
        const byteOff = bitOffset / 8;
        rgba[outIdx] = rgba[outIdx + 1] = rgba[outIdx + 2] = row[byteOff];
        rgba[outIdx + 3] = row[byteOff + 1];
      } else if (colorType === 0) {
        const sample = readSample(row, bitOffset, bitDepth);
        const v = Math.round((sample * 255) / ((1 << bitDepth) - 1));
        rgba[outIdx] = rgba[outIdx + 1] = rgba[outIdx + 2] = v;
        rgba[outIdx + 3] = 255;
      } else if (colorType === 3) {
        const idx = readSample(row, bitOffset, bitDepth);
        const rgb = palette[idx];
        if (!rgb) throw new Error(`Palette index ${idx} out of range (palette has ${palette.length} entries)`);
        rgba[outIdx] = rgb[0];
        rgba[outIdx + 1] = rgb[1];
        rgba[outIdx + 2] = rgb[2];
        rgba[outIdx + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
  }

  return { width, height, data: rgba };
}

module.exports = { decodePNG };
