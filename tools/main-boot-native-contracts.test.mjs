// The special native contracts of the boot (tools/main-boot-native-contracts.mjs) against
// the original tables. Until 2026-11-25 this lived in tools/main-boot-connected.test.mjs,
// whose boot replay through the register-level title was retired (user decision).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { BOOT_NATIVE_CONTRACTS } from './main-boot-native-contracts.mjs';
import { SRAM_SIZE } from '../src/vm/memory.mjs';

test('connected special contracts retain their original target, argument and return table bytes', () => {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), new Uint8Array(SRAM_SIZE), rom);
  for (const [target, c] of BOOT_NATIVE_CONTRACTS) {
    assert.equal(0x800000 | mem.read16(0x82d7b8 + c.id * 2), target);
    assert.equal(mem.read16(0x82da4c + c.id), c.metadata);
    assert.equal(Boolean(mem.read8(0x82d970 + c.id)), c.result);
  }
  // C0 has no result, although the next native contributes a nonzero high BYTE.
  assert.equal(mem.read16(0x82d970 + 0xc0), 0x0200);
});
