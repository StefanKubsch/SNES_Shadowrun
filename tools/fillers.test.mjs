import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillerKind, placeFillers, scriptJumpEnds } from '../src/data/fillers.mjs';
import { romOffset } from '../src/data/rom-bytes.mjs';

const rom = readFileSync('Shadowrun (E).smc');
const read8 = (cpu) => rom[romOffset(cpu)];
const asset = JSON.parse(readFileSync('assets/vm-fillers.json', 'utf8'));

test('Every filler is a ROM run of its value and kind, and placing it restores the original bytes', () => {
  // The zero byte 99:FFD6 is the empty mode list of sound directory 3 (src/data/sound.mjs), no filler.
  assert.deepEqual(asset.counts, { script_end: 99, bank_end: 16, zero_run: 2, ff_run: 0 });
  const out = new Uint8Array(rom.length),
    present = new Uint8Array(rom.length);
  placeFillers(out, present, asset);
  let placed = 0;
  for (const { address, length, value } of asset.fillers) {
    const cpu = parseInt(address.replace(':', ''), 16);
    for (let i = 0; i < length; i++) {
      assert.equal(out[romOffset(cpu + i)], rom[romOffset(cpu + i)]);
      assert.equal(rom[romOffset(cpu + i)], value);
    }
    placed += length;
  }
  assert.equal(
    present.reduce((n, v) => n + v, 0),
    placed,
  );
  assert.equal(placed, 374);
  assert.throws(() => placeFillers(out, present, asset), /filler_layout_changed/);
});

test('Kind rules accept only uniform runs with their structural reason', () => {
  const ends = new Set([0x82edc8]);
  assert.equal(fillerKind(read8, 0x82edc8, 1, ends), 'script_end');
  assert.equal(fillerKind(read8, 0x82edc8, 1, new Set()), null);
  assert.equal(fillerKind(read8, 0x8a8071, 192, ends), 'zero_run');
  assert.equal(fillerKind(read8, 0x8a8071, 193, ends), null);
  assert.equal(fillerKind(read8, 0x9fffd6, 42, ends), 'bank_end');
  const jump = scriptJumpEnds([
    { address: 0x828000, bytecode: [0x48, 0x00, 0x00] },
    { address: 0x829000, bytecode: [0x56] },
  ]);
  assert.deepEqual([...jump], [0x828005]);
  for (const bad of [
    { address: '82:EDC8', length: 1, value: 0, kind: 'script_end' },
    { address: '8A:8071', length: 2, value: 255, kind: 'zero_run' },
    { address: '9F:FFD0', length: 2, value: 255, kind: 'bank_end' },
    { address: '9F:FFFF', length: 2, value: 255, kind: 'ff_run' },
    { address: '82:EDC8', length: 1, value: 86, kind: 'other' },
  ])
    assert.throws(
      () =>
        placeFillers(new Uint8Array(rom.length), new Uint8Array(rom.length), { fillers: [bad] }),
      /filler_value_required/,
    );
});
