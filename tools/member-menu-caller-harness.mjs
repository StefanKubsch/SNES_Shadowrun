import { drawTextBufferSequence as formerDraw } from '../proof/caller/text-draw.mjs';
import {
  putGloveAwayCallSequence,
  releaseNoticeWindowsCallSequence,
} from '../proof/caller/window-release.mjs';
import { waitForConfirmKeySequence } from '../proof/caller/confirm-key.mjs';
import assert from 'node:assert/strict';
import { openWindowSequence } from '../proof/caller/window-open.mjs';
import { releaseWindowSequence } from '../proof/caller/window-release.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { setTextCursorRoutine, printNumberSequence } from '../proof/caller/window-text.mjs';
import { printTextSequence } from '../proof/caller/text-print.mjs';
import { frameWaitCallSequence, runPadPresses } from '../src/system/live-input-calls.mjs';
import { playSoundEffectRoutine } from '../src/apu/sound-effect.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  segmentSequence,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';
const MENU_SOUND_INDEX = 0x4c;

export function compareRun(
  sequence,
  direct,
  prepare,
  budget,
  pads = [],
  realDrawing = false,
  configure = () => {},
) {
  const side = textWindowSide(),
    { h, a, mem, events, put } = side;
  put(W.WINDOW_ACTIVE, WORD_MASK);
  put(W.SOUND_LOADED_SET, mem.read16(0x80c4b3 + MENU_SOUND_INDEX));
  const serviceUpload = events.interrupts.textWait;
  let input = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc !== 0x81b0a9) return serviceUpload(callee, frameEvents, status, pc);
    assert.ok(input < pads.length, 'bounded menu input');
    put(W.PAD_HELD, pads[input++]);
    put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
    return true;
  };
  const routines = new Map([
      [0x809e1a, runPadPresses],
      [0x80c46e, playSoundEffectRoutine],
    ]),
    bindings = [];
  function bind(target, body) {
    const run = () => assert.fail('callee requires continuation');
    routines.set(target, run);
    bindings.push(run);
    NATIVE_CALL_CONTINUATIONS.set(run, {
      run,
      create: () => new NativeCallContinuation(a, body()),
    });
  }
  // Keep the fixture's live wait independent of register-level factories installed
  // by scene imports for the same target.
  bind(0x81b0a1, () => frameWaitCallSequence(h, events));
  bind(0x80f963, () => openWindowSequence(h, events));
  bind(0x80a6c7, () => chooseFromMenuSequence(h, events, routines, 0x80a6c7));
  bind(0x80fa3e, function* () {
    yield* releaseWindowSequence(h, events);
    let result;
    yield () => {
      result = h.rts();
    };
    return result;
  });
  bind(0x80faac, () => segmentSequence(() => setTextCursorRoutine(h)));
  bind(0x80fe69, () => printTextSequence(h, events, routines));
  bind(0x80fd80, () => printNumberSequence(h, events, routines));
  bind(0x80bcb2, () => putGloveAwayCallSequence(h, events));
  bind(0x80ff79, () => releaseNoticeWindowsCallSequence(h, events));
  bind(0x80f953, () => waitForConfirmKeySequence(h, events, routines));
  bind(0x80fb39, () => side.render(h, events));
  if (realDrawing) side.render = formerDraw;
  configure({ ...side, routines, bind });
  prepare(side);
  try {
    const result = finishTextWindow(
      side,
      sequence(h, events, direct ? (realDrawing ? undefined : side.render) : routines),
      budget,
    );
    return { ...result, input };
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}
