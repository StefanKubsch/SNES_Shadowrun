import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge } from './cartridge-harness.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';
import { BRR_BLOCK, brrValue, decodeBrr, encodeBrr, readWav, writeWav } from '../src/data/brr.mjs';
import { Dsp } from '../src/apu/dsp.mjs';

// Samples as WAV (docs/ROM-FREE.md, step 2: samples; src/data/brr.mjs).
const sound = JSON.parse(readFileSync(new URL('../assets/vm-sound.json', import.meta.url), 'utf8'));
const samples = sound.data.filter((d) => d.role === 'samples');
const romBytes = (d) => {
  const cpu = parseInt(d.address.replace(':', ''), 16);
  return cartridge.rom.subarray(romOffset(cpu), romOffset(cpu) + (d.blocks.length / 2) * BRR_BLOCK);
};
const headers = (d) => Uint8Array.from(d.blocks.match(/../g), (v) => parseInt(v, 16));
const wav = (d) =>
  readWav(new Uint8Array(readFileSync(new URL('../assets/' + d.file, import.meta.url))), d.address);

// The port's own DSP decoder (Book I PDF 178/179) on the same bytes, four
// values per call as in step V4, from an empty ring buffer.
function dspValues(bytes) {
  const ram = new Uint8Array(0x10000);
  ram.set(bytes, 0x1000);
  const dsp = new Dsp(ram),
    voice = dsp.voices[0],
    out = [];
  voice.brrAddress = 0x1000;
  for (let k = 0; k < bytes.length; k += BRR_BLOCK) {
    voice.brrAddress = 0x1000 + k;
    dsp.header = ram[voice.brrAddress];
    for (voice.brrOffset = 1; voice.brrOffset < BRR_BLOCK; voice.brrOffset += 2) {
      const first = voice.bufPos;
      dsp.brrByte = ram[voice.brrAddress + voice.brrOffset];
      dsp.decodeBrr(voice);
      for (let i = 0; i < 4; i++) out.push(voice.buf[first + i]);
    }
  }
  return out;
}

test('every sample WAV is the DSP decoding of its BRR bytes and encodes back to them', () => {
  assert.equal(samples.length, 43);
  let blocks = 0,
    kept = 0;
  for (const d of samples) {
    const bytes = romBytes(d),
      pcm = wav(d);
    assert.deepEqual(Array.from(pcm), dspValues(bytes), d.address);
    assert.ok(
      pcm.every((v) => (v & 1) === 0),
      'DSP outputs keep bit 0 clear',
    );
    const decoded = decodeBrr(bytes);
    assert.deepEqual(decoded.pcm, pcm);
    assert.deepEqual(decoded.headers, headers(d));
    assert.deepEqual(decoded.nibbles, d.nibbles ?? {});
    assert.deepEqual(
      encodeBrr(pcm, headers(d), d.nibbles ?? {}, d.address),
      Uint8Array.from(bytes),
    );
    blocks += headers(d).length;
    kept += Object.keys(d.nibbles ?? {}).length;
    // Only shift 0 blocks keep nibbles in the current samples.
    for (const b of Object.keys(d.nibbles ?? {})) assert.equal(headers(d)[b] >> 4, 0, d.address);
  }
  assert.deepEqual([blocks, kept], [7459, 145]);
});

test('BRR values follow the shift and filter rules, and ambiguous nibbles are kept', () => {
  // Shift 12, no filter: 7 << 12 >> 1 = 14336, doubled 28672; -8 gives -32768.
  assert.equal(brrValue(7, 12, 0, 0, 0), 28672);
  assert.equal(brrValue(8, 12, 0, 0, 0), -32768);
  // Shift 0 drops the lowest bit: 2 and 3 both give 1, doubled 2.
  assert.equal(brrValue(2, 0, 0, 0, 0), 2);
  assert.equal(brrValue(3, 0, 0, 0, 0), 2);
  // Shifts 13 to 15: non-negative nibbles give 0, negative ones -2048 * 2.
  assert.equal(brrValue(5, 13, 0, 0, 0), 0);
  assert.equal(brrValue(9, 15, 0, 0, 0), -4096);
  // Filter 1 adds p1 * 15/16 (p1/2 - p1/32 on the halved scale).
  assert.equal(brrValue(0, 0, 4, 1600, 0), 2 * (800 - 50));
  // A shift 0 block stores its nibbles; without them the way back refuses.
  const block = Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01);
  const { pcm, headers: h, nibbles } = decodeBrr(block);
  assert.deepEqual(nibbles, { 0: '23456789ABCDEF01' });
  assert.deepEqual(encodeBrr(pcm, h, nibbles, 0), block);
  assert.throws(
    () => encodeBrr(pcm, h, {}, 0),
    (error) => error.reason === 'sound_nibbles_required',
  );
});

test('the way back refuses PCM that BRR cannot reproduce and accepts BRR-exact edits', () => {
  const d = samples.find((x) => !x.nibbles),
    pcm = wav(d),
    h = headers(d),
    bytes = romBytes(d);
  // An odd value has no nibble; a shorter WAV changes the layout.
  const odd = pcm.slice();
  odd[5] |= 1;
  assert.throws(
    () => encodeBrr(odd, h, {}, d.address),
    (error) =>
      error.reason === 'sound_value_not_brr' &&
      error.details.block === 0 &&
      error.details.value === 5,
  );
  assert.throws(
    () => encodeBrr(pcm.subarray(0, pcm.length - 16), h, {}, d.address),
    (error) => error.reason === 'sound_layout_changed',
  );
  // The last value of the sample takes another nibble's value: only that
  // nibble changes, since no later value depends on it.
  const last = pcm.length - 1,
    b = h.length - 1,
    shift = h[b] >> 4,
    filter = h[b] & 0x0c;
  const old = bytes[bytes.length - 1] & 15,
    other = (old + 1) & 15;
  const edited = pcm.slice();
  edited[last] = brrValue(other, shift, filter, pcm[last - 1], pcm[last - 2]);
  const result = encodeBrr(edited, h, {}, d.address);
  assert.deepEqual(result.subarray(0, -1), Uint8Array.from(bytes).subarray(0, -1));
  assert.equal(result.at(-1), (bytes[bytes.length - 1] & 0xf0) | other);
});

test('sample WAVs are 16-bit mono at the nominal 32 kHz and tolerate editor chunks', () => {
  const pcm = Int16Array.of(0, 2, -4, 32766);
  const file = writeWav(pcm);
  assert.deepEqual(readWav(file, 0), pcm);
  // A LIST chunk before the data, as audio editors add, is skipped.
  const list = new Uint8Array(
    [...'LIST'].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4]),
  );
  const tagged = new Uint8Array(file.length + list.length);
  tagged.set(file.subarray(0, 36));
  tagged.set(list, 36);
  tagged.set(file.subarray(36), 36 + list.length);
  new DataView(tagged.buffer).setUint32(4, tagged.length - 8, true);
  assert.deepEqual(readWav(tagged, 0), pcm);
  // Another rate (a resampled edit) or stereo is refused.
  for (const [at, value] of [
    [24, 44100],
    [22, 2],
  ]) {
    const changed = file.slice();
    new DataView(changed.buffer)[at === 24 ? 'setUint32' : 'setUint16'](at, value, true);
    assert.throws(
      () => readWav(changed, 0),
      (error) => error.reason === 'sound_wav_format_required',
    );
  }
});
