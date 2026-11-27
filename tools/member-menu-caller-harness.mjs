import { drawTextBufferSequence as drawTextBuffer } from '../src/game/text-draw.mjs';
import {
  putGloveAwayCallSequence,
  releaseNoticeWindowsCallSequence,
} from '../proof/caller/window-release.mjs';
import { waitForConfirmKeySequence } from '../proof/caller/confirm-key.mjs';
import assert from 'node:assert/strict';
import { openWindowSequence } from '../proof/caller/window-open.mjs';
import { releaseWindowSequence } from '../proof/caller/window-release.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { setTextCursorRoutine, printNumberSequence } from './register-forms/window-text.mjs';
import { printTextSequence } from './register-forms/text-print.mjs';
import { frameWaitCallSequence } from '../src/system/live-input-calls.mjs';
import { runPadPresses } from './register-forms/input-routines.mjs';
import { playSoundEffectJsr, shiftPortraitRowsJsr } from './register-forms/jsr-forms.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  segmentSequence,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';
import { memberPortraitSequence } from './register-forms/member-portrait.mjs';
import {
  uploadFirstPortraitSequence,
  uploadPortraitTilesSequence,
} from '../proof/caller/portrait-upload.mjs';
import { unpackPortraitRoutine } from './register-forms/portrait-routines.mjs';
const MENU_SOUND_INDEX = 0x4c,
  PORTRAIT_STACK_TOP = 0x1eef,
  PORTRAIT_STACK_START = 0x1e80,
  PORTRAIT_STACK_END = 0x1ef0,
  GAME_STATE_START = 0x1cc,
  HDMA_TABLE_BYTES = 13,
  PORTRAIT_TILES_START = 0x15250,
  PORTRAIT_TILES_END = 0x16250,
  REQUEST_COMPLETE = 0x8000,
  PORTRAIT_OPENING_FRAMES = 11,
  SECOND_PORTRAIT_DESTINATION = 0x800;

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
      [0x80c46e, playSoundEffectJsr],
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
  if (realDrawing) side.render = drawTextBuffer;
  const finish =
    configure({ ...side, routines, bind, remainingInput: () => pads.length - input }) ??
    ((result) => result);
  prepare(side);
  try {
    const result = finishTextWindow(
      side,
      sequence(h, events, direct ? (realDrawing ? undefined : side.render) : routines),
      budget,
    );
    return finish({ ...result, input });
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}

// Keep full portrait payloads and HDMA fields visible while moving the CPU stack
// away from the portrait buffers. Upload completion is serviced, not an NMI model.
export function configureMemberPortrait({ h, mem, events, put, routines, bind, calls }) {
  h.ctx.s = PORTRAIT_STACK_TOP;
  const snapshot = () => [
    mem.wram[W.HDMAEN_SHADOW],
    mem.read16(W.TMW_SHADOW),
    mem.wram.slice(W.PORTRAIT_HDMA_TABLE, W.PORTRAIT_HDMA_TABLE + HDMA_TABLE_BYTES),
    mem.wram[W.PORTRAIT_WINDOW_LEFT],
    mem.wram[W.PORTRAIT_WINDOW_RIGHT],
  ];
  const service = events.interrupts.textWait;
  let openingFrames = 0;
  events.interrupts.textWait = (callee, frameEvents, status, pc) => {
    if (pc === 0x80901f) {
      if (mem.read16(W.PORTRAIT_DMA_REQUEST) === SECOND_PORTRAIT_DESTINATION)
        openingFrames = PORTRAIT_OPENING_FRAMES;
      calls.push([
        'portrait upload',
        mem.read16(W.PORTRAIT_DMA_REQUEST),
        mem.read16(W.PORTRAIT_PALETTE_START),
        mem.wram.slice(PORTRAIT_TILES_START, PORTRAIT_TILES_END),
      ]);
      put(W.PORTRAIT_DMA_REQUEST, mem.read16(W.PORTRAIT_DMA_REQUEST) | REQUEST_COMPLETE);
      return true;
    }
    if (pc === 0x81b0a9 && openingFrames > 0) {
      openingFrames--;
      // Game state only (user decision 2026-11-17): the window step (X in the original)
      // shows in the window edges of the snapshot, not in a register.
      calls.push(['portrait frame', ...snapshot()]);
      put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
      return true;
    }
    return service(callee, frameEvents, status, pc);
  };
  routines.set(0x809f6d, unpackPortraitRoutine);
  routines.set(0x808f20, shiftPortraitRowsJsr);
  bind(0x809022, () => uploadFirstPortraitSequence(h, events, routines));
  bind(0x808ff5, () => uploadPortraitTilesSequence(h, events, routines));
  bind(0x80e4b3, () => memberPortraitSequence(h, events, routines));
  return (result) => {
    calls.push(['final portrait', ...snapshot()]);
    result.wram.fill(0, PORTRAIT_STACK_START, PORTRAIT_STACK_END);
    for (const [, payload] of result.uploads)
      payload.fill(
        0,
        PORTRAIT_STACK_START - GAME_STATE_START,
        PORTRAIT_STACK_END - GAME_STATE_START,
      );
    return result;
  };
}

// Bind the former dispatched visit and the direct scheduler hooks to the same
// controlled task effect. Budget-one callers exercise a child continuation;
// budget-seven callers exercise the synchronous scheduler hook.
export function configureScriptVisit({ h, events, routines, bind }, cooperative) {
  const run = routines.get(0x80c1ca);
  events.round = () => run(h, events);
  if (!cooperative) return;
  const body = () => segmentSequence(() => run(h, events));
  events.nestedRound = () => new NativeCallContinuation(h.a, body());
  bind(0x80c1ca, body);
}
