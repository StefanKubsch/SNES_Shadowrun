import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseFromMenuSequence as direct } from '../src/game/menu-choice.mjs';
import { chooseFromMenuSequence as dispatched } from '../proof/caller/menu-choice.mjs';
import { runFrameWait, runPadPresses } from '../src/system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { createSide } from './lift-function-harness.mjs';
import {
  PAD_HELD,
  RANDOM_STATE,
  SOUND_LOADED_SET,
  TEXT_BUFFER,
  TEXT_TILE_UPLOAD,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_TILE_COUNT,
} from '../src/data/wram.mjs';

const NAVIGATE = [0x400, 0, 0x400, 0, 0x10, 0, 0x20, 0, ...Array(23).fill(0x400), 0, 0x800, 0];

// Isolate caller composition: real list decoding, selection, page clearing, input
// and sound commands. The text-buffer renderer is a stand-in; input and tile waits
// are serviced at their blocking branches. Integration tests retain real NMIs.
function run(sequence, entry, pads, budget) {
  const side = createSide({ seed: 17, wram: new Uint8Array(0x20000) }, new Map()),
    { h, a, mem } = side,
    put = (at, value) => mem.write16(0x7e0000 | at, value),
    texts = [],
    waits = [],
    frames = new LagFreeFrames({ nmitimen: 0x80 }),
    events = { interrupts: frames };
  for (const [at, value] of [
    [0, 0],
    [2, 1],
    [4, 1],
    [6, 3],
    [8, 0x6000],
    [0x0a, 0x7e],
    [0x0c, 0x6100],
    [WINDOW_COLUMNS, 14],
    [WINDOW_ROWS, 8],
    [WINDOW_TILE_START, 0x2027],
    [WINDOW_TILE_COUNT, 72],
    [SOUND_LOADED_SET, mem.read16(0x80c4b3 + 0x4c)],
  ])
    put(at, value);
  for (let n = 0; n < 7; n++) {
    put(0x6000 + 2 * n, 0x707d);
    put(0x6100 + 2 * n, n === 2 ? 0x100 : 0);
  }
  Object.assign(a.ctx, { programBank: 0x80, bank: 0x7e, a: 2, pc: entry & 0xffff });
  h.push(0x1234, 2);
  let input = 0;
  frames.textWait = (_h, _events, _status, pc) => {
    waits.push(pc);
    if (pc === 0x81b0a9) {
      assert.ok(input < pads.length, 'menu consumes the bounded input script');
      put(PAD_HELD, pads[input++]);
      put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    } else {
      assert.equal(pc, 0x81acc0, 'only page tile clearing can wait here');
      put(TEXT_TILE_UPLOAD, 0);
    }
    return true;
  };
  const drawStandIn = (callee) => {
    texts.push(mem.wram.slice(TEXT_BUFFER, TEXT_BUFFER + 128));
    return callee.rts();
  };
  const routines = new Map([
    [0x81b0a1, runFrameWait],
    [0x809e1a, runPadPresses],
    [0x80c46e, playSoundEffectRoutine],
    [0x80fb39, drawStandIn],
  ]);
  // Direct menus receive a renderer sequence and have no helper table.
  const renderer = function* (callee) {
      let result;
      yield () => {
        result = drawStandIn(callee);
      };
      return result;
    },
    continuation = new NativeCallContinuation(
      a,
      sequence(h, events, sequence === direct ? renderer : routines, entry, a.ctx.a),
    );
  const before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let steps = 0;
  while (continuation.run(budget) === WAIT_PAUSED)
    assert.ok(++steps < 20000, 'menu returns across small-budget pauses');
  const result = mem.read16(0);
  mem.wram.fill(0, 0x100, 0x1ca);
  mem.wram.fill(0, 0x1c78, 0x1cbc);
  return { result, input, texts, waits, wram: mem.wram, writes: side.writes };
}

for (const budget of [1, 7])
  for (const entry of [0x80a6a5, 0x80a6ad, 0x80a6b8, 0x80a6c7])
    for (const [name, pads] of [
      ['confirm after navigation and repeat', [...NAVIGATE, 0x8000]],
      ['cancel after navigation and repeat', [...NAVIGATE, 0x2000]],
      ['hotkey or confirm', [0x100, 0, 0x8000]],
    ])
      test(`direct menu ${entry.toString(16)}: ${name}, budget ${budget}`, () => {
        const actual = run(direct, entry, pads, budget),
          previous = run(dispatched, entry, pads, budget);
        assert.deepEqual(actual, previous);
        if (name.startsWith('cancel')) assert.equal(actual.result, 0xffff);
        else assert.ok(actual.result < 7, 'selection is a row in the list');
        if (name === 'hotkey or confirm' && entry === 0x80a6a5) {
          assert.equal(actual.result, 2);
          assert.equal(actual.input, 1, 'hotkey confirms without a later B press');
        }
        if (name.startsWith('confirm') && entry !== 0x80a6a5)
          assert.ok(actual.waits.includes(0x81acc0), 'navigation crosses a page');
      });
