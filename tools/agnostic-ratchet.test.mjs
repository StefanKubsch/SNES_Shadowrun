// The references of src/ to the original system may only fall (docs/READABLE-GAME.md):
// ROM and WRAM addresses, direct page and hardware register names, and address notation
// in comments (the presentation layer src/platform/ apart). When a block removes
// references, lower the ceilings here to the new counts (node tools/agnostic-counts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { agnosticCounts } from './agnostic-counts.mjs';

const CEILINGS = Object.freeze({
  romLiterals: 1189,
  wramImports: 145,
  hardwareImports: 26,
  directPageNames: 2219,
  addressComments: 2651,
});

test('src/ gains no new references to the original system', () => {
  const { totals } = agnosticCounts();
  for (const [name, ceiling] of Object.entries(CEILINGS))
    assert.ok(totals[name] <= ceiling, `${name}: ${totals[name]} > ${ceiling}`);
});
