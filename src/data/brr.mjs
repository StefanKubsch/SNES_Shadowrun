// BRR samples as editable 16-bit WAV with a lossless way back
// (docs/ROM-FREE.md, step 2: samples).
//
// A BRR sample (Book I PDF 178/179) is a run of 9-byte blocks: a header byte
// (bits 4 to 7 shift, bits 2/3 filter, bit 1 loop, bit 0 end) and 16 signed
// 4-bit nibbles, high nibble first. Decoding follows Dsp.decodeBrr in
// src/apu/dsp.mjs, here once from silence (p1 = p2 = 0), without pitch,
// envelope or interpolation: each output is a 16-bit value with bit 0 clear.
//
// The WAV holds these decoded values. The block headers stay beside it in
// vm-sound.json, since the PCM does not name them. With header and the two
// previous values a nibble usually is the only one giving its value; where
// several give the same value (shift 0 drops a nibble's lowest bit; shifts
// 13 to 15 and clipping merge more), the block keeps its 16 nibbles as hex.
// The encoder accepts a value only if a nibble yields it exactly, so an
// unchanged WAV gives the original bytes and an edit must stay BRR-exact.
import { VmFault } from '../vm/memory.mjs';
import { HEX_RADIX, WORD_BITS, NIBBLE_BITS, NIBBLE_MASK } from '../constants/bits.mjs';
import {
  BRR_BLOCK_BYTES,
  BRR_FILTER_MASK,
  BRR_FILTER_2,
  BRR_RANGE_SHIFT,
} from '../apu/dsp-registers.mjs';

export const BRR_BLOCK = BRR_BLOCK_BYTES,
  BRR_VALUES = 16,
  WAV_RATE = 32000;
// A 4-bit nibble takes 16 values; shifts 13 to 15 keep only the sign (Dsp.decodeBrr).
const NIBBLE_VALUES = 1 << NIBBLE_BITS,
  NIBBLE_SIGN_SHIFT = 28,
  BRR_RANGE_INVALID = 0xd;
const INT16_MIN = -32768,
  INT16_MAX = 32767;

const s16 = (v) => (v << WORD_BITS) >> WORD_BITS;
const clamp16 = (v) => Math.max(INT16_MIN, Math.min(INT16_MAX, v));

// Output of nibble n (0 to 15) under shift/filter after the values p1, p2.
export function brrValue(nibble, shift, filter, p1, p2) {
  let s = (nibble << NIBBLE_SIGN_SHIFT) >> NIBBLE_SIGN_SHIFT;
  s = (s << shift) >> 1;
  if (shift >= BRR_RANGE_INVALID) s = (s >> 25) << 11; // magic-number-ok: sign only, -2048 or 0
  const a = p1,
    b = p2 >> 1;
  // Filter coefficients (Book I PDF 179) in the chip's fixed-point steps.
  if (filter >= BRR_FILTER_2) {
    s += a;
    s -= b;
    if (filter === BRR_FILTER_2) {
      s += b >> 4; // magic-number-ok: filter 2 coefficient
      s += (a * -3) >> 6; // magic-number-ok: filter 2 coefficient
    } else {
      s += (a * -13) >> 7; // magic-number-ok: filter 3 coefficient
      s += (b * 3) >> 4; // magic-number-ok: filter 3 coefficient
    }
  } else if (filter) {
    s += a >> 1;
    s += -a >> 5; // magic-number-ok: filter 1 coefficient
  }
  return s16(clamp16(s) * 2);
}

// Nibble i of the block at k: two per data byte, the high nibble first.
const nibbleAt = (bytes, k, i) =>
  (bytes[k + 1 + (i >> 1)] >> (i & 1 ? 0 : NIBBLE_BITS)) & NIBBLE_MASK;

// BRR bytes to {pcm, headers, nibbles}: headers as one byte per block,
// nibbles as hex strings for the blocks whose PCM does not determine them.
export function decodeBrr(bytes) {
  const blocks = bytes.length / BRR_BLOCK;
  const pcm = new Int16Array(blocks * BRR_VALUES),
    headers = new Uint8Array(blocks),
    nibbles = {};
  let p1 = 0,
    p2 = 0,
    n = 0;
  for (let b = 0; b < blocks; b++) {
    const k = b * BRR_BLOCK,
      header = (headers[b] = bytes[k]),
      shift = header >> BRR_RANGE_SHIFT,
      filter = header & BRR_FILTER_MASK;
    let ambiguous = false;
    for (let i = 0; i < BRR_VALUES; i++) {
      const value = brrValue(nibbleAt(bytes, k, i), shift, filter, p1, p2);
      let same = 0;
      for (let m = 0; m < NIBBLE_VALUES; m++)
        if (brrValue(m, shift, filter, p1, p2) === value) same++;
      if (same > 1) ambiguous = true;
      p2 = p1;
      p1 = pcm[n++] = value;
    }
    if (ambiguous)
      nibbles[b] = Array.from({ length: BRR_VALUES }, (_, i) =>
        nibbleAt(bytes, k, i).toString(HEX_RADIX).toUpperCase(),
      ).join('');
  }
  return { pcm, headers, nibbles };
}

// The way back. address names the sample in faults.
export function encodeBrr(pcm, headers, nibbles, address) {
  if (pcm.length !== headers.length * BRR_VALUES)
    throw new VmFault('sound_layout_changed', address);
  const bytes = new Uint8Array(headers.length * BRR_BLOCK);
  let p1 = 0,
    p2 = 0,
    n = 0;
  for (let b = 0; b < headers.length; b++) {
    const k = b * BRR_BLOCK,
      header = (bytes[k] = headers[b]),
      shift = header >> BRR_RANGE_SHIFT,
      filter = header & BRR_FILTER_MASK;
    const kept = nibbles[b];
    if (kept !== undefined && !new RegExp(`^[0-9A-F]{${BRR_VALUES}}$`).test(kept))
      throw new VmFault('sound_value_required', address, { block: b });
    for (let i = 0; i < BRR_VALUES; i++, n++) {
      const value = pcm[n];
      let nibble = -1;
      if (kept !== undefined) {
        nibble = parseInt(kept[i], HEX_RADIX);
        if (brrValue(nibble, shift, filter, p1, p2) !== value) nibble = -1;
      } else {
        for (let m = 0; m < NIBBLE_VALUES; m++) {
          if (brrValue(m, shift, filter, p1, p2) !== value) continue;
          if (nibble >= 0)
            throw new VmFault('sound_nibbles_required', address, { block: b, value: n });
          nibble = m;
        }
      }
      if (nibble < 0) throw new VmFault('sound_value_not_brr', address, { block: b, value: n });
      bytes[k + 1 + (i >> 1)] |= i & 1 ? nibble : nibble << NIBBLE_BITS;
      p2 = p1;
      p1 = value;
    }
  }
  return bytes;
}

// RIFF WAV: "RIFF", size, "WAVE", then chunks of a four-byte tag, a size and
// the body, padded to even length. The fmt chunk (16 bytes) holds format 1 (PCM),
// channels, rate, byte rate, block align and bits per sample.
const TAG_BYTES = 4,
  CHUNK_HEADER_BYTES = 8,
  CHUNK_SIZE = 4,
  RIFF_HEADER_BYTES = 12,
  WAVE_TAG = 8,
  FMT_CHUNK = 12,
  FMT_BYTES = 16,
  DATA_CHUNK = FMT_CHUNK + CHUNK_HEADER_BYTES + FMT_BYTES,
  PCM_START = DATA_CHUNK + CHUNK_HEADER_BYTES,
  FMT_FORMAT = 0,
  FMT_CHANNELS = 2,
  FMT_RATE = 4,
  FMT_BYTE_RATE = 8,
  FMT_BLOCK_ALIGN = 12,
  FMT_BITS = 14,
  FORMAT_PCM = 1,
  CHANNELS = 1,
  SAMPLE_BYTES = 2,
  SAMPLE_BITS = 16;

// 16-bit mono PCM WAV at WAV_RATE. The rate is nominal: the sounds set the
// playback pitch. Other chunks (editor metadata) are skipped on reading.
export function writeWav(pcm) {
  const dataBytes = SAMPLE_BYTES * pcm.length,
    bytes = new Uint8Array(PCM_START + dataBytes),
    view = new DataView(bytes.buffer);
  const tag = (at, text) => {
    for (let i = 0; i < TAG_BYTES; i++) bytes[at + i] = text.charCodeAt(i);
  };
  const fmt = FMT_CHUNK + CHUNK_HEADER_BYTES;
  tag(0, 'RIFF');
  view.setUint32(CHUNK_SIZE, PCM_START - CHUNK_HEADER_BYTES + dataBytes, true);
  tag(WAVE_TAG, 'WAVE');
  tag(FMT_CHUNK, 'fmt ');
  view.setUint32(FMT_CHUNK + CHUNK_SIZE, FMT_BYTES, true);
  view.setUint16(fmt + FMT_FORMAT, FORMAT_PCM, true);
  view.setUint16(fmt + FMT_CHANNELS, CHANNELS, true);
  view.setUint32(fmt + FMT_RATE, WAV_RATE, true);
  view.setUint32(fmt + FMT_BYTE_RATE, SAMPLE_BYTES * WAV_RATE, true);
  view.setUint16(fmt + FMT_BLOCK_ALIGN, SAMPLE_BYTES, true);
  view.setUint16(fmt + FMT_BITS, SAMPLE_BITS, true);
  tag(DATA_CHUNK, 'data');
  view.setUint32(DATA_CHUNK + CHUNK_SIZE, dataBytes, true);
  pcm.forEach((v, i) => view.setInt16(PCM_START + SAMPLE_BYTES * i, v, true));
  return bytes;
}

export function readWav(bytes, address) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + TAG_BYTES));
  const fail = () => {
    throw new VmFault('sound_wav_format_required', address);
  };
  if (bytes.length < RIFF_HEADER_BYTES || tag(0) !== 'RIFF' || tag(WAVE_TAG) !== 'WAVE') fail();
  let format = null;
  for (let at = RIFF_HEADER_BYTES; at + CHUNK_HEADER_BYTES <= bytes.length;) {
    const size = view.getUint32(at + CHUNK_SIZE, true),
      body = at + CHUNK_HEADER_BYTES;
    if (body + size > bytes.length) fail();
    if (tag(at) === 'fmt ') {
      if (size < FMT_BYTES) fail();
      format = [
        view.getUint16(body + FMT_FORMAT, true),
        view.getUint16(body + FMT_CHANNELS, true),
        view.getUint32(body + FMT_RATE, true),
        view.getUint16(body + FMT_BITS, true),
      ];
    } else if (tag(at) === 'data') {
      if (format?.join() !== [FORMAT_PCM, CHANNELS, WAV_RATE, SAMPLE_BITS].join() || size & 1)
        fail();
      const pcm = new Int16Array(size / SAMPLE_BYTES);
      for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(body + SAMPLE_BYTES * i, true);
      return pcm;
    }
    at = body + size + (size & 1);
  }
  return fail();
}
