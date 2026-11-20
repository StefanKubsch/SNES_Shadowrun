import assert from 'node:assert/strict';
import { VmMemory, ROM_SIZE } from '../src/vm/memory.mjs';
import { OBJECT_FIELDS, OBJECT_SLOTS } from '../src/state/objects.mjs';
import { COLLISION_FIELDS } from '../src/state/collision.mjs';
import { CAMERA_MAP_FIELDS } from '../src/state/camera-maps.mjs';
import { WINDOW_TEXT_FIELDS } from '../src/state/windows-text.mjs';
import { toWram, restoreWram } from '../proof/state/to-wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../src/constants/bits.mjs';

// A deterministic, nonuniform fixture pattern and distinct replacement words.
const PATTERN_MULTIPLIER = 13,
  PATTERN_BIAS = 7,
  REPLACEMENT_WORD = 0x1234,
  HEX_RADIX = 16;

export const blankMemory = () => new VmMemory(new Uint8Array(ROM_SIZE));
export const WRAM = 0x7e0000;

// Every migrated byte must have exactly one owner, even when another subsystem
// uses it under a different name. Neither reads nor projection may refresh WRAM.
export function storageContract(fields, detach, prior = []) {
  const mem = blankMemory();
  for (let i = 0; i < mem.wram.length; i++)
    mem.wram[i] = (i * PATTERN_MULTIPLIER + PATTERN_BIAS) & BYTE_MASK;
  const before = mem.wram.slice(),
    table = detach(mem.wram),
    occupied = new Set();
  for (const base of Object.values(OBJECT_FIELDS))
    for (let i = 0; i < OBJECT_SLOTS * 2; i++) occupied.add(base + i);
  for (const schema of [COLLISION_FIELDS, CAMERA_MAP_FIELDS, WINDOW_TEXT_FIELDS, ...prior])
    for (const { base, count, bytes = 2, stride = bytes } of Object.values(schema))
      for (let i = 0; i < count; i++)
        for (let n = 0; n < bytes; n++) occupied.add(base + i * stride + n);
  for (const [name, { base, count, bytes, stride }] of Object.entries(fields)) {
    assert.notEqual(table[name].buffer, mem.wram.buffer);
    for (let i = 0; i < count; i++) {
      const at = base + i * stride;
      assert.equal(table[name][i], before[at] | (bytes === 2 ? before[at + 1] << BYTE_BITS : 0));
      table[name][i] = (REPLACEMENT_WORD + i) & (bytes === 1 ? BYTE_MASK : WORD_MASK);
      for (let n = 0; n < bytes; n++) {
        assert.equal(occupied.has(at + n), false, name + ':' + (at + n).toString(HEX_RADIX));
        occupied.add(at + n);
        assert.equal(mem.read8(WRAM + at + n), (table[name][i] >>> (n * BYTE_BITS)) & BYTE_MASK);
      }
    }
  }
  const snapshot = toWram(mem),
    target = blankMemory();
  assert.deepEqual(mem.wram, before);
  assert.equal(detach(mem.wram), table);
  detach(target.wram);
  restoreWram(target, snapshot);
  assert.deepEqual(toWram(target), snapshot);
  assert.throws(() => restoreWram(target, new Uint8Array(1)), /wram_snapshot_size_required/);
  assert.deepEqual(toWram(target), snapshot);
}
