import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForConfirmKeySequence as direct } from '../src/game/confirm-key.mjs';
import { waitForConfirmKeySequence as former } from '../proof/caller/confirm-key.mjs';
import { runFrameWait, runPadPresses } from '../proof/caller/input-routines.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import { PAD_HELD, PAD_PREVIOUS, PAD_PRESSED, RANDOM_STATE } from '../src/data/wram.mjs';

function run(sequence, pads, previous, budget) {
  const side = textWindowSide(),
    { h, mem, put, events } = side;
  put(PAD_PREVIOUS, previous);
  let input = 0;
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    assert.equal(pc, 0x81b0a9, 'only the counter wait blocks');
    assert.ok(input < pads.length, 'bounded confirming input script');
    side.calls.push([pc, mem.wram.slice(PAD_HELD, PAD_PRESSED + 2)]);
    put(PAD_HELD, pads[input++]);
    put(RANDOM_STATE, (mem.read16(RANDOM_STATE) + 1) & 0xffff);
    return true;
  };
  const routines = new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
    ]),
    result = finishTextWindow(side, sequence(h, events, routines), budget);
  return { ...result, input };
}

for (const budget of [1, 7])
  for (const button of [0x8000, 0x4000, 0x2000, 0x80, 0x40, 0xe0c0])
    for (const previous of [0, button])
      test(`direct confirm: ${button.toString(16)}, previous ${previous}, budget ${budget}`, () => {
        const pads = [
            ...(previous ? [button, button, 0] : []),
            0x1000,
            0x800,
            0x400,
            0x200,
            0x100,
            0x20,
            0x10,
            0x8001,
            0,
            button,
          ],
          actual = run(direct, pads, previous, budget);
        assert.deepEqual(actual, run(former, pads, previous, budget));
        assert.equal(actual.input, pads.length, 'held, other and invalid buttons cannot confirm');
        assert.equal(actual.wram[PAD_PRESSED] | (actual.wram[PAD_PRESSED + 1] << 8), button);
      });
