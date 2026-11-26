import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { closePortraitWindowJsr, openPortraitWindowJsr } from '../proof/caller/jsr-forms.mjs';
import { runFrameWait } from '../proof/caller/input-routines.mjs';

useLiftVectors(import.meta.url);

// The lifted portrait window in its RTS forms (proof/caller/jsr-forms.mjs), named as the
// former.
const direct = {
  openPortraitWindowSequence: openPortraitWindowJsr,
  closePortraitWindowSequence: closePortraitWindowJsr,
};
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import { DIALOG_HDMA_TABLE, HDMAEN_SHADOW, TMW_SHADOW, RANDOM_STATE } from '../src/data/wram.mjs';

function run(module, name, shadow, counter, budget) {
  const side = textWindowSide(),
    { h, mem, put, events } = side,
    // Game state only (user decision 2026-11-17): the step (X in the original) shows in
    // the window edges of the HDMA table, not in a register.
    snapshot = () => [
      mem.wram[HDMAEN_SHADOW],
      mem.read16(TMW_SHADOW),
      mem.wram.slice(DIALOG_HDMA_TABLE, DIALOG_HDMA_TABLE + 16),
    ];
  put(HDMAEN_SHADOW, shadow);
  put(TMW_SHADOW, 0x0f);
  put(RANDOM_STATE, counter);
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    assert.equal(pc, 0x81b0a9);
    side.calls.push(snapshot());
    put(RANDOM_STATE, (mem.read16(RANDOM_STATE) + 1) & 0xffff);
    return true;
  };
  let final;
  function* sequence() {
    const result = yield* module[name](h, events, new Map([[0x81b0a1, runFrameWait]]));
    final = snapshot();
    return result;
  }
  const result = finishTextWindow(side, sequence(), budget);
  return { ...result, final };
}

for (const budget of [1, 7])
  for (const shadow of [0, 1, 0xfe, 0xff])
    for (const counter of [0, 0xfffe, 0xffff])
      for (const name of ['openPortraitWindowSequence', 'closePortraitWindowSequence'])
        test(`direct portrait ${name}: shadow ${shadow}, counter ${counter}, budget ${budget}`, () => {
          const actual = run(direct, name, shadow, counter, budget);
          assertFrozenRun(actual);
          assert.equal(actual.calls.length, 11, 'eleven frame waits');
          const opening = name.startsWith('open');
          assert.equal(actual.final[0], opening ? shadow | 1 : shadow & ~1);
          assert.equal(actual.final[1], opening ? 0x0f : 0);
          // The left window's right edge (table byte 5) of the step before each frame.
          assert.deepEqual(
            actual.calls.slice(1).map(([, , table]) => table[5]),
            Array.from(
              { length: 10 },
              (_, n) => (0x39 + (opening ? 2 + 3 * n : 31 - 3 * n)) & 0xff,
            ),
            'each frame sees the original edge step',
          );
        });
