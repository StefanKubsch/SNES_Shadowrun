import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';

const rom = readFileSync(new URL('../Shadowrun (E).smc', import.meta.url));
const at = (address, length) => rom.subarray(((address >>> 16) & 0x7F) << 15 | (address & 0x7FFF), (((address >>> 16) & 0x7F) << 15 | (address & 0x7FFF)) + length).toString('hex').toUpperCase();

test('NativeC2/CDA8: gepinnte Originalbytes und Native58-Anker; Gleichung über die bewiesene AD92-Komposition', () => {
  // LDA $1D61 / STA $00 / JSL $81AD92 / RTS
  assert.equal(at(0x80CDA8, 10), 'AD611D85002292AD8160');
  assert.equal(at(0x82D7B8 + 2 * 0xC2, 2), 'A8CD');
  assert.equal(at(0x82DA4C + 0xC2, 2), '0001'); // keine Argumentwörter
  assert.equal(at(0x82D970 + 0xC2, 2), '0202'); // Ergebnis wird gepusht
  assert.ok(SPECIAL_NATIVES.has(0x80CDA8));
});
