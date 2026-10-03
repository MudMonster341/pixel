// Ogg Vorbis -> MP3, in pure JS/WASM (no ffmpeg, nothing to install system-wide). Build-time only:
// tools/pack-offline.js runs this so the offline bundle ships MP3, which every browser plays (older
// Safari on macOS cannot decode Ogg Vorbis). docs/OFFLINE_BUNDLE.md "Audio" explains the why.
//
//   decode:  @wasm-audio-decoders/ogg-vorbis (libvorbis as WASM)
//   encode:  @breezystack/lamejs (LAME in JS; the maintained fork of lamejs, which fails under modern bundlers)
//
// Settings: 128 kbps stereo, or 96 kbps mono when both channels are identical (most of the Kenney sfx
// are dual-mono). The source sample rate is kept (44.1/48 kHz), so nothing is resampled.
//
// GAPLESS: an MP3 encoder always starts with ~1105 samples (26 ms) of delay, which would put a click
// of silence at the loop point of the music and a lag on every footstep. lamejs writes no Xing/LAME
// header, so this file writes one: a silent first frame whose "Info" tag carries the encoder delay and
// end padding in the LAME-tag layout. Chrome/Firefox/Edge (ffmpeg-based decoding) and Safari
// (AudioToolbox) both trim by it. A decoder that ignores the tag just plays the Info frame as 26 ms of
// silence, so the worst case is the same small gap as an untagged file, never a failure.
//
// Command line (what pack-offline.js uses):  node ogg-to-mp3.mjs --cache <dir> <a.ogg> <b.ogg> ...
// converts the files that are not cached yet and prints one JSON array on stdout:
//   [{ "ogg": "...", "mp3": "<dir>/<hash>.mp3", "converted": true|false, "bytes": N, "seconds": S }, ...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import { Mp3Encoder } from '@breezystack/lamejs';

const require = createRequire(import.meta.url);
const { mp3Info, parseHeader } = require('./mp3-info.js');

// Bump when the encoder settings or the tag writer change, so cached files are rebuilt.
export const CONVERTER_VERSION = 'v1-128k-stereo-96k-mono-info-tag';
const ENCODER_DELAY = 576; // LAME's ENCDELAY; players add their own 529-sample decoder delay on top
const STEREO_KBPS = 128;
const MONO_KBPS = 96;
const SAMPLES_PER_FRAME = 1152;
const SUPPORTED_RATES = [32000, 44100, 48000];

function crc16(bytes, start, end, crc = 0) {
  for (let i = start; i < end; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc & 0xffff;
}

// The silent first frame carrying the LAME-style tag (see the header comment).
function buildInfoFrame(firstFrameHeader4, h, { audioFrames, audioBytes, delay, padding }) {
  const frameLength = Math.floor((144 * h.bitrate) / h.sampleRate); // no padding byte
  const frame = Buffer.alloc(frameLength);
  firstFrameHeader4.copy(frame, 0, 0, 4);
  frame[2] &= ~0x02; // padding bit off, so the frame is exactly frameLength bytes
  const tagAt = 4 + h.sideInfo;
  frame.write('Info', tagAt, 'latin1'); // CBR file
  frame.writeUInt32BE(0x0f, tagAt + 4); // flags: frames, bytes, TOC, quality are all present (fixed layout)
  frame.writeUInt32BE(audioFrames, tagAt + 8);
  frame.writeUInt32BE(audioBytes + frameLength, tagAt + 12);
  // 100 TOC bytes at tagAt + 16 stay zero (a CBR file needs none; nothing here seeks)
  const lame = tagAt + 120;
  frame.write('LAME3.100', lame, 'latin1');
  frame[lame + 9] = 0x01; // tag revision 0, VBR method 1 (CBR)
  frame[lame + 20] = Math.min(255, Math.round(h.bitrate / 1000)); // "ABR/minimal bitrate" byte
  frame.writeUIntBE(((delay & 0xfff) << 12) | (padding & 0xfff), lame + 21, 3);
  frame.writeUInt32BE(audioBytes + frameLength, lame + 28); // music length
  const tagCrcAt = lame + 34;
  frame.writeUInt16BE(0, lame + 32); // music CRC (decoders ignore it; filled by the caller if wanted)
  frame.writeUInt16BE(crc16(frame, 0, tagCrcAt), tagCrcAt);
  return frame;
}

// oggBytes (Buffer/Uint8Array) -> { mp3: Buffer, seconds, sampleRate, channels, bitrate }
export async function oggToMp3(oggBytes, decoder) {
  const own = !decoder;
  if (own) { decoder = new OggVorbisDecoder(); await decoder.ready; }
  let decoded;
  try {
    decoded = await decoder.decodeFile(new Uint8Array(oggBytes));
  } finally {
    if (own) decoder.free(); else await decoder.reset();
  }
  if (decoded.errors && decoded.errors.length) throw new Error(`Ogg decode errors: ${decoded.errors.map((e) => e.message || e).join('; ')}`);
  const { sampleRate, samplesDecoded } = decoded;
  const channelData = decoded.channelData;
  if (!samplesDecoded || !channelData.length) throw new Error('the Ogg file decoded to no audio');
  if (!SUPPORTED_RATES.includes(sampleRate)) throw new Error(`unsupported sample rate ${sampleRate} (MP3 takes ${SUPPORTED_RATES.join('/')}; resample the source)`);

  const toInt16 = (f32) => {
    const out = new Int16Array(f32.length + SAMPLES_PER_FRAME); // + one frame of trailing silence (keeps end padding >= decoder delay)
    for (let i = 0; i < f32.length; i++) {
      const v = Math.max(-1, Math.min(1, f32[i]));
      out[i] = Math.round(v < 0 ? v * 32768 : v * 32767);
    }
    return out;
  };
  const left = toInt16(channelData[0]);
  const right = channelData.length > 1 ? toInt16(channelData[1]) : left;
  let maxDiff = 0;
  for (let i = 0; i < left.length && maxDiff <= 2; i++) maxDiff = Math.max(maxDiff, Math.abs(left[i] - right[i]));
  const mono = maxDiff <= 2; // dual-mono: one channel is enough
  const kbps = mono ? MONO_KBPS : STEREO_KBPS;

  const encoder = new Mp3Encoder(mono ? 1 : 2, sampleRate, kbps);
  const chunks = [];
  const BLOCK = SAMPLES_PER_FRAME * 16;
  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const out = mono ? encoder.encodeBuffer(l) : encoder.encodeBuffer(l, right.subarray(i, i + BLOCK));
    if (out.length) chunks.push(Buffer.from(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Buffer.from(tail));
  const audio = Buffer.concat(chunks);

  const first = parseHeader(audio, 0);
  if (!first) throw new Error('the encoder produced no valid MP3 frame header');
  let audioFrames = 0;
  for (let p = 0; p + 4 <= audio.length;) {
    const h = parseHeader(audio, p);
    if (!h) break;
    audioFrames++;
    p += h.length;
  }
  if (!audioFrames) throw new Error('the encoder produced no MP3 frames');
  const delay = ENCODER_DELAY;
  const padding = audioFrames * SAMPLES_PER_FRAME - delay - samplesDecoded;
  if (padding < 0 || padding > 4095) throw new Error(`unexpected end padding ${padding}`);
  const info = buildInfoFrame(audio.subarray(0, 4), first, { audioFrames, audioBytes: audio.length, delay, padding });
  const mp3 = Buffer.concat([info, audio]);

  const check = mp3Info(mp3);
  const expected = samplesDecoded / sampleRate;
  if (!check.valid || Math.abs(check.seconds - expected) > 0.001) {
    throw new Error(`self-check failed: wrote ${check.seconds}s, expected ${expected}s`);
  }
  return { mp3, seconds: expected, sampleRate, channels: mono ? 1 : 2, bitrate: kbps * 1000 };
}

export function cacheName(oggBytes) {
  return `${crypto.createHash('sha256').update(CONVERTER_VERSION).update(oggBytes).digest('hex').slice(0, 24)}.mp3`;
}

// Converts every file not yet in `cacheDir`; returns [{ ogg, mp3, converted, bytes, seconds }].
export async function convertAll(oggFiles, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const results = [];
  let decoder = null;
  try {
    for (const ogg of oggFiles) {
      const bytes = fs.readFileSync(ogg);
      const mp3Path = path.join(cacheDir, cacheName(bytes));
      if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 0) {
        const info = mp3Info(fs.readFileSync(mp3Path));
        if (info.valid) { results.push({ ogg, mp3: mp3Path, converted: false, bytes: fs.statSync(mp3Path).size, seconds: info.seconds }); continue; }
      }
      if (!decoder) { decoder = new OggVorbisDecoder(); await decoder.ready; }
      let out;
      try {
        out = await oggToMp3(bytes, decoder);
      } catch (error) {
        throw new Error(`${path.basename(ogg)}: ${error.message}`);
      }
      const tmp = `${mp3Path}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, out.mp3);
      fs.renameSync(tmp, mp3Path);
      results.push({ ogg, mp3: mp3Path, converted: true, bytes: out.mp3.length, seconds: out.seconds });
    }
  } finally {
    if (decoder) decoder.free();
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--cache');
  if (at < 0 || !args[at + 1]) { console.error('usage: node ogg-to-mp3.mjs --cache <dir> <file.ogg>...'); process.exit(2); }
  const cacheDir = args[at + 1];
  const files = args.filter((_, i) => i !== at && i !== at + 1);
  convertAll(files, cacheDir).then(
    (results) => { process.stdout.write(`${JSON.stringify(results)}\n`); },
    (error) => { console.error(`ogg-to-mp3: ${error.message}`); process.exit(1); },
  );
}
