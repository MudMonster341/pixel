// A small MP3 reader: walks the frame headers of an MPEG audio Layer III file and reports what the
// file says about itself. Used by tools/lib/ogg-to-mp3.mjs (to write the gapless "Info" frame) and by
// tests/unit/pack-offline.test.js (to check a converted file is a real, right-length MP3).
// No dependencies; only Layer III (what every encoder here produces) is understood.

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }; // by MPEG version bits

// The 4-byte header at `pos`, or null if it is not a valid Layer III frame header.
function parseHeader(buf, pos) {
  if (pos + 4 > buf.length) return null;
  if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) return null; // 11 sync bits
  const versionBits = (buf[pos + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layerBits = (buf[pos + 1] >> 1) & 3; // 1 = Layer III
  if (versionBits === 1 || layerBits !== 1) return null;
  const bitrateIndex = buf[pos + 2] >> 4;
  const rateIndex = (buf[pos + 2] >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null; // free-format / bad / reserved
  const mpeg1 = versionBits === 3;
  const bitrate = (mpeg1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[versionBits][rateIndex];
  const padding = (buf[pos + 2] >> 1) & 1;
  const channels = ((buf[pos + 3] >> 6) & 3) === 3 ? 1 : 2;
  const samplesPerFrame = mpeg1 ? 1152 : 576;
  const length = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  const sideInfo = mpeg1 ? (channels === 1 ? 17 : 32) : (channels === 1 ? 9 : 17);
  return { mpeg1, bitrate, sampleRate, channels, samplesPerFrame, length, sideInfo, hasCrc: ((buf[pos + 1] & 1) === 0) };
}

// -> { valid, frames (audio frames, the Info frame not counted), sampleRate, channels, bitrate (first frame),
//      samplesPerFrame, hasInfoTag, delay, padding, samples (exact length with the gapless tag, else
//      frames * samplesPerFrame), seconds }.
function mp3Info(buf) {
  let pos = 0;
  if (buf.length >= 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    pos = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
  }
  // find the first frame whose successor is also a frame (a lone 0xFFEx byte pair in tags/noise isn't enough)
  let first = null;
  for (; pos + 4 <= buf.length; pos++) {
    const h = parseHeader(buf, pos);
    if (!h) continue;
    const next = parseHeader(buf, pos + h.length);
    if (next || pos + h.length >= buf.length - 128) { first = h; break; }
  }
  if (!first) return { valid: false, frames: 0, seconds: 0 };

  const info = { valid: true, sampleRate: first.sampleRate, channels: first.channels, bitrate: first.bitrate, samplesPerFrame: first.samplesPerFrame, hasInfoTag: false, delay: 0, padding: 0 };
  let frames = 0;
  let cursor = pos;
  const tagAt = pos + 4 + (first.hasCrc ? 2 : 0) + first.sideInfo;
  const tagName = buf.toString('latin1', tagAt, tagAt + 4);
  let infoFrameBytes = 0;
  if (tagName === 'Info' || tagName === 'Xing') {
    infoFrameBytes = first.length;
    info.hasInfoTag = true;
    const flags = buf.readUInt32BE(tagAt + 4);
    // the LAME extension starts after the optional fields; the fixed layout (all four flags set) puts the
    // 3 delay/padding bytes 141 bytes after the "Info" word, which is what tools/lib/ogg-to-mp3.mjs writes.
    let at = tagAt + 8;
    if (flags & 1) at += 4;
    if (flags & 2) at += 4;
    if (flags & 4) at += 100;
    if (flags & 8) at += 4;
    if (buf.toString('latin1', at, at + 4) === 'LAME') {
      const v = buf.readUIntBE(at + 21, 3);
      info.delay = v >> 12;
      info.padding = v & 0xfff;
    }
  }
  while (cursor + 4 <= buf.length) {
    const h = parseHeader(buf, cursor);
    if (!h) { cursor++; continue; } // tolerate a trailing ID3v1/garbage
    if (cursor + h.length > buf.length) break;
    frames++;
    cursor += h.length;
  }
  if (infoFrameBytes) frames -= 1; // the first frame is the Info frame, not audio
  info.frames = frames;
  info.samples = frames * first.samplesPerFrame - info.delay - info.padding;
  info.seconds = info.samples / first.sampleRate;
  return info;
}

module.exports = { mp3Info, parseHeader };
