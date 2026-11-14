// The live game must not depend on where its steps end. The attract game after the
// start menu's timeout runs its main loop rounds as pausable nested scheduler rounds;
// with small step budgets the rounds pause within their scripts. The driver loads
// the main loop's registers into the shared VM meanwhile, and a round that resumed
// without its own registers restarted at $C1E3 and ran its scripts twice in one
// frame (a countdown script at 7E:04F2 counted a frame twice). Every NMI must be the
// same with the default budget and with small ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { loadSave } from './mesen-f390-oracle.mjs';
import { exploreLive } from './explore-live.mjs';
import { fnv1a } from '../src/data/fnv.mjs';

// From power-on: the whole title, the start menu's timeout at NMI 3588, then the
// attract game.
const PLAN = [['wait', 3700]],
  FIRST = 3500,
  BUDGETS = [undefined, 50, 1000];

function frames(budget) {
  const out = [];
  exploreLive(PLAN, {
    cartridge,
    sram: loadSave('apartment'),
    onGame: (game) => {
      const step = game.step.bind(game);
      if (budget) game.step = () => step({ mainBudget: budget, opcodeBudget: budget });
      const onNmi = game.frames.onNmi;
      game.frames.onNmi = (k) => {
        if (k >= FIRST) out.push(fnv1a(game.memory.wram));
        onNmi(k);
      };
    },
  });
  return out;
}

test(
  'the attract game gives the same frames whatever the live step budget',
  { timeout: 600000 },
  () => {
    const [reference, ...others] = BUDGETS.map(frames);
    assert.ok(reference.length > 150, 'frames compared: ' + reference.length);
    others.forEach((run, n) => {
      const length = Math.min(run.length, reference.length),
        first = run.slice(0, length).findIndex((hash, i) => hash !== reference[i]);
      assert.equal(first, -1, `budget ${BUDGETS[n + 1]}: WRAM differs at NMI ${FIRST + first}`);
    });
  },
);
