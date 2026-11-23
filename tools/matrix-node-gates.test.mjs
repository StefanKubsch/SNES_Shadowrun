// CPU-node gate opening when no neighbouring tile holds 07 (docs/MATRIX-LIFT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCase, createSide, differences } from './lift-function-harness.mjs';
import { DialogTestMemory } from './task-native-dialog-harness.mjs';
import { MATRIX_REFERENCE_ROUTINES } from '../proof/matrix-reference/matrix-scene-loop.mjs';
import { IGNORED_WRAM } from './live-matrix-plan.mjs';
import { matrixRuntime, setWord, word } from '../src/matrix/matrix-runtime.mjs';
import { openNodeGates } from '../src/matrix/matrix-world.mjs';
import * as W from '../src/data/wram.mjs';
import { WRAM_SIZE } from '../src/vm/memory.mjs';

const MAP = 0x2000,
  MAP_BANK = 0x10000,
  ROW_BYTES = 64,
  SIDES = [-64, 2, 64, -2],
  GATES = [0x3f, 0x3e, 0x3f, 0x3e];
const gateCase = {
  entry: 0x81b56f,
  prepare: (s) => ({ a: s.bits }),
  lifted: (m, r) => openNodeGates(m, r.a),
  result: (h) => h.ctx.a,
};
const options = {
  side: (s) => createSide(s, MATRIX_REFERENCE_ROUTINES),
  runtime: matrixRuntime,
  ignored: IGNORED_WRAM,
};

test('the missing-side steps read the following row table and original STZ operand', () => {
  const mem = new DialogTestMemory(new Uint8Array(WRAM_SIZE));
  assert.equal(mem.read16(0x81b601), 0xffff, 'column step after four columns');
  assert.equal(mem.read16(0x81b609), 0x1464, 'row step is the bytes of STZ $14');
});

test('node gates match the original with each side, no side, and masked node bits', () => {
  for (const side of [0, 1, 2, 3, 4]) {
    for (const bits of [0, 2]) {
      const wram = new Uint8Array(WRAM_SIZE);
      setWord(wram, W.MATRIX_MAP, MAP);
      setWord(wram, W.MATRIX_NODE_COLUMNS, 10);
      setWord(wram, W.MATRIX_NODE_ROWS, 10);
      setWord(wram, W.MATRIX_NODE_COLUMNS + 2, 0xffff);
      setWord(wram, W.MATRIX_OBJECT_TYPE, 1); // Keep the persona occupied.
      const cell = MAP + 10 * ROW_BYTES + 10 * 2;
      if (side < SIDES.length) setWord(wram, MAP_BANK + cell + SIDES[side], 7);
      // Even the missing-side case must continue to the gate scan at its new cell.
      const column = 10 + [0, 1, 0, -1, -1][side],
        row = 10 + [-1, 0, 1, 0, 0x1464][side],
        moved = (MAP + row * ROW_BYTES + column * 2) & 0xffff;
      for (let gate = 0; gate < SIDES.length; gate++)
        setWord(wram, MAP_BANK + ((moved + SIDES[gate]) & 0xffff), GATES[gate]);
      const pair = compareCase(gateCase, { seed: 1, wram, bits }, options);
      assert.deepEqual(differences(pair), [], `side ${side}, bits ${bits}`);
      assert.equal(pair.got.stop, undefined);
      assert.equal(pair.got.result, bits ? 4 : 0);
      assert.equal(word(pair.got.wram, W.MATRIX_NODE_COLUMNS), bits ? column : 10);
      assert.equal(word(pair.got.wram, W.MATRIX_NODE_ROWS), bits ? row : 10);
    }
  }
});
