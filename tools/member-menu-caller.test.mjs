import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { decimalNumberSequence as directDecimal } from '../src/game/decimal-number.mjs';
import { decimalNumberSequence as formerDecimal } from '../proof/caller/decimal-number.mjs';
for (const budget of [1, 7])
  for (const value of [0, 9, 10, 999, 1000, 999999, 1000000, 1000000000, 0xffffffff])
    for (const realDrawing of [false, true])
      test(`decimal caller: ${value}, budget ${budget}, real drawing ${realDrawing}`, () => {
        const prepare = ({ put }) => {
          put(2, value & 0xffff);
          put(4, value >>> 16);
        };
        const actual = compareRun(directDecimal, true, prepare, budget, [], realDrawing);
        assert.deepEqual(
          actual,
          compareRun(formerDecimal, false, prepare, budget, [], realDrawing),
        );
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
        else {
          const bytes = actual.calls[0][2];
          assert.equal(
            String.fromCharCode(...bytes.subarray(0, bytes.indexOf(13))),
            value.toLocaleString('en-US'),
          );
        }
      });
