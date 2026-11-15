import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECIAL_NATIVES } from '../proof/vm/special-natives.mjs';

const rom = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
const at = (address, length) =>
  rom
    .subarray(
      (((address >>> 16) & 0x7f) << 15) | (address & 0x7fff),
      ((((address >>> 16) & 0x7f) << 15) | (address & 0x7fff)) + length,
    )
    .toString('hex')
    .toUpperCase();

test('NativeC2/CDA8: pinned original bytes and Native58 anchors; equation through the proved AD92 composition', () => {
  // LDA $1D61 / STA $00 / JSL $81AD92 / RTS
  assert.equal(at(0x80cda8, 10), 'AD611D85002292AD8160');
  assert.equal(at(0x82d7b8 + 2 * 0xc2, 2), 'A8CD');
  assert.equal(at(0x82da4c + 0xc2, 2), '0001'); // no argument words
  assert.equal(at(0x82d970 + 0xc2, 2), '0202'); // result is pushed
  assert.ok(SPECIAL_NATIVES.has(0x80cda8));
});
