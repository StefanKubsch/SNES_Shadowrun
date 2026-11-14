import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  observedContinuation,
  drainNativeSequence,
  dialogCallBody,
  segmentSequence,
} from './native-call-continuation.mjs';
import { TALK_WAIT_PCS } from './native-dialog.mjs';
import { GLOVE_ROUTINES, routineCall, rts, absolute } from './native-glove-target-support.mjs';
import { sec, clc } from './status-flags.mjs';
import { putOnActionGlove, putOnSpellGlove, be6dSequence } from './native-glove.mjs';

import {
  CAMERA_X,
  CAMERA_Y,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  MOTION_ACTIVE,
  MOTION_MODE,
  MOTION_X,
  MOTION_Y,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  PAD_PRESSED,
  PLAYER_OBJECT,
  WRAM,
  OBJECT_X,
  OBJECT_Y,
  GLOVE_X,
  GLOVE_Y,
  PAD_A,
  PAD_B,
  PAD_X,
  PAD_Y,
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  MEMBER_MENU_ACTIVE,
  SCRIPT_GLOVE_CHOICE,
  SPELL_TARGET_OBJECT,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_NOTICE_TEXT,
  DP_NOTICE_FRAMES,
} from './wram.mjs';
import { DP_SCRATCH } from './native-member-spell-menu.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP, LONG_MASK, WORD_BITS } from '../constants/bits.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';

// The glove choice waits for a newly pressed A, B, X or Y.
const GLOVE_CHOICE_BUTTONS = PAD_A | PAD_B | PAD_X | PAD_Y;
// 9C40: an object is out of reach from a summed X/Y distance or a height distance of 81
// on; the notice 02/02/0C/03 then shows text 0 for 3C frames (FEC1).
export const GLOVE_REACH = 0x81;
export const OUT_OF_REACH_NOTICE = Object.freeze({ left: 2, columns: 0x0c, rows: 3, frames: 0x3c });
// C724: the glove position words give pixels after six shifts (X once more into DPA2);
// the place is projected back with the bases 900 and 600 (the inverse of BC36).
const GLOVE_PIXEL_SHIFT = 6,
  DP_GLOVE_PIXEL_X = 0xa8,
  DP_GLOVE_HALF_PIXEL_X = 0xa2,
  DP_GLOVE_PIXEL_Y = 0xa5,
  PLACE_Y_BASE = 0x900,
  PLACE_X_BASE = 0x600;
// 80:9BC6 and its relatives (choices with the glove): routine table, helpers and the text width FADD in
// native-glove-target-support.mjs, the glove itself in native-glove.mjs.

// 81:AEB0: redraw the window list ($0200 = 0, JSL AD92).
export function resetAndDrawWindowList(h, events, routines = GLOVE_ROUTINES) {
  return drainNativeSequence(aeb0Sequence(h, events, routines));
}
function* aeb0Sequence(h, events, routines = GLOVE_ROUTINES) {
  yield () => h.write(h.abs(WINDOW_FIRST_INDEX), 0);
  yield* routineCall(routines, events, h, 0x81aeb3, 0x81ad92, true);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
// 81:AEB8: prepare the window list (JSL A9B2, JSL ACB5), $0200 = $0204 + 1.
function* aeb8Sequence(h, events, routines = GLOVE_ROUTINES) {
  yield* routineCall(routines, events, h, 0x81aeb8, 0x81a9b2, true);
  yield* routineCall(routines, events, h, 0x81aebc, 0x81acb5, true);
  let result;
  yield () => {
    h.load(h.read(h.abs(WINDOW_LAST_INDEX)));
    h.load((h.ctx.a + 1) & WORD_MASK);
    h.write(h.abs(WINDOW_FIRST_INDEX), h.ctx.a);
    result = h.rtl();
  };
  return result;
}
// Every frame B0A1, 9E1A and BE6D until A/B/X/Y are newly pressed (shared loop of the glove choice).
// The glove movement runs from the routine table when it has one (tests share a stand-in
// with the lifted choice), otherwise register-level.
function* gloveFrames(h, events, routines, [counter, input, move]) {
  const { ctx } = h;
  do {
    yield* routineCall(routines, events, h, counter, 0x81b0a1, true);
    yield* routineCall(routines, events, h, input, 0x809e1a);
    if (routines.has(0x80be6d)) yield* routineCall(routines, events, h, move, 0x80be6d);
    else yield* dialogCallBody(h, move, 0x80be6d, () => be6dSequence(h, events, routines));
    yield () => {
      h.load(h.read(h.abs(PAD_PRESSED)));
      h.load(ctx.a & GLOVE_CHOICE_BUTTONS);
    };
  } while (ctx.status & FLAG_ZERO);
}
const redrawSequence = function* (h, events, routines, pc) {
  let open;
  yield () => {
    h.load(h.read(h.abs(MEMBER_MENU_ACTIVE)));
    open = Boolean(h.ctx.status & FLAG_ZERO);
  };
  if (open) yield* dialogCallBody(h, pc, 0x81aeb0, () => aeb0Sequence(h, events, routines), true);
};
// 80:9C40: selection loop; result slot or FFFF in DP00.
function* gloveSelectSequence(h, events, routines = GLOVE_ROUTINES) {
  const { ctx } = h,
    call = (pc, target, long = false) => routineCall(routines, events, h, pc, target, long);
  yield* dialogCallBody(h, 0x809c40, 0x80bc67, () => segmentSequence(() => putOnActionGlove(h)));
  yield* gloveFrames(h, events, routines, [0x809c43, 0x809c47, 0x809c4a]);
  let held,
    far = false;
  yield () => {
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
    held = !(ctx.status & FLAG_NEGATIVE);
    if (!held) return;
    h.index('y', h.read(h.abs(GLOVE_TARGET_OBJECT)));
    h.index('x', h.read(h.abs(PLAYER_OBJECT)));
    const distance = (offset) => {
      sec(h);
      h.load(h.read(h.abs(offset) + ctx.x));
      h.sbc(h.read(h.abs(offset) + ctx.y));
      absolute(h);
    };
    distance(OBJECT_X);
    h.dpWrite(DP_SCRATCH, ctx.a);
    distance(OBJECT_Y);
    clc(h);
    h.adc(h.dp(DP_SCRATCH));
    h.cmp(GLOVE_REACH);
    far = Boolean(ctx.status & FLAG_CARRY);
    if (!far) {
      distance(OBJECT_HEIGHT);
      h.cmp(GLOVE_REACH);
      far = Boolean(ctx.status & FLAG_CARRY);
    }
    // Too far: notice (window 2/2, width $0C, height 3, text 0, one second).
    if (far) {
      for (const [offset, value] of [
        [DP_WINDOW_LEFT, OUT_OF_REACH_NOTICE.left],
        [DP_WINDOW_TOP, null],
        [DP_WINDOW_COLUMNS, OUT_OF_REACH_NOTICE.columns],
        [DP_WINDOW_ROWS, OUT_OF_REACH_NOTICE.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
      ]) {
        if (value !== null) h.load(value);
        h.dpWrite(offset, ctx.a);
      }
      h.dpWrite(DP_NOTICE_TEXT, 0);
      h.load(OUT_OF_REACH_NOTICE.frames);
      h.dpWrite(DP_NOTICE_FRAMES, ctx.a);
    }
  };
  let chosen = false;
  if (held) {
    if (far) yield* call(0x809cb3, 0x80fec1);
    else {
      yield* redrawSequence(h, events, routines, 0x809cbd);
      yield () => {
        h.load(h.read(h.abs(GLOVE_TARGET_OBJECT)));
        h.pha();
      };
      yield* call(0x809cc5, 0x80bcb2);
      yield () => {
        h.pla();
        h.dpWrite(0, ctx.a);
      };
      chosen = true;
      yield* call(0x809ccb, 0x809e1a);
    }
  }
  if (!chosen) {
    yield* call(0x809ccf, 0x80bcb2);
    yield* redrawSequence(h, events, routines, 0x809cd7);
    yield () => {
      h.load(WORD_MASK);
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x809ce0, 0x809e1a);
  }
  return yield* rts(h);
}
// 9BC6 without the final RTS: the slot from 9C40 becomes the object number $150A+slot (FFFF stays).
function* gloveTargetSequence(h, events, routines) {
  const { ctx } = h;
  yield* dialogCallBody(h, 0x809bc6, 0x809c40, () => gloveSelectSequence(h, events, routines));
  yield () => {
    h.index('y', h.dp(0));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
      h.dpWrite(0, ctx.a);
    }
  };
}
const entryCheck = (a) => {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_9bc6_entry_required');
};
function* finishSequence(h, a, outerReturn, name) {
  let result;
  yield () => {
    result = finish(h, a, outerReturn, name);
  };
  return result;
}
// 80:9BC6: choose an object with the glove and return its object number.
export function chooseObjectNumberWithGlove(
  a,
  events,
  outerReturn = true,
  routines = GLOVE_ROUTINES,
) {
  return drainNativeSequence(chooseObjectNumberWithGloveSequence(a, events, outerReturn, routines));
}
function* chooseObjectNumberWithGloveSequence(a, events, outerReturn, routines = GLOVE_ROUTINES) {
  entryCheck(a);
  const h = dialogAccess(a);
  yield* gloveTargetSequence(h, events, routines);
  return yield* finishSequence(h, a, outerReturn, '9BC6');
}
// 80:9BD3: target with the spell glove. Open dialog ($1F62): close 92C5 first. AEB8, BC99, then
// every frame B0A1, 9E1A, BE6D until A/B/X/Y; an object without bit 15 in $1458 continues. Result slot
// $01DE or FFFF in DP00 and $1FD2, in between BCB2 and, without a dialog, the window list AEB0, finally 9E1A.
export function targetWithSpellGlove(a, events, outerReturn = true, routines = GLOVE_ROUTINES) {
  return drainNativeSequence(spellGloveTargetSequence(a, events, outerReturn, routines));
}
// Original routine $9BD3.
function* spellGloveTargetSequence(a, events, outerReturn, routines = GLOVE_ROUTINES) {
  entryCheck(a);
  const h = dialogAccess(a),
    { ctx } = h,
    call = (pc, target, long = false) => routineCall(routines, events, h, pc, target, long);
  let dialog;
  yield () => {
    h.load(h.read(h.abs(MEMBER_MENU_ACTIVE)));
    dialog = !(ctx.status & FLAG_ZERO);
  };
  if (dialog) yield* call(0x809bd8, 0x8092c5);
  yield* dialogCallBody(h, 0x809bdb, 0x81aeb8, () => aeb8Sequence(h, events, routines), true);
  yield* dialogCallBody(h, 0x809bdf, 0x80bc99, () => segmentSequence(() => putOnSpellGlove(h)));
  for (;;) {
    yield* gloveFrames(h, events, routines, [0x809be2, 0x809be6, 0x809be9]);
    let none, usable;
    yield () => {
      h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
      none = Boolean(ctx.status & FLAG_NEGATIVE);
      if (none) return;
      h.index('x', h.read(h.abs(GLOVE_TARGET_OBJECT)));
      h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
      usable = Boolean(ctx.status & FLAG_NEGATIVE);
    };
    if (none) break;
    if (usable) {
      yield* redrawSequence(h, events, routines, 0x809c06);
      yield () => {
        h.load(h.read(h.abs(GLOVE_TARGET_OBJECT)));
        h.write(h.abs(SPELL_TARGET_OBJECT), ctx.a);
        h.pha();
      };
      yield* call(0x809c11, 0x80bcb2);
      yield () => {
        h.pla();
        h.dpWrite(0, ctx.a);
      };
      yield* call(0x809c17, 0x809e1a);
      return yield* finishSequence(h, a, outerReturn, '9BD3');
    }
  }
  yield* call(0x809c1b, 0x80bcb2);
  yield* redrawSequence(h, events, routines, 0x809c23);
  yield () => {
    h.load(WORD_MASK);
    h.write(h.abs(SPELL_TARGET_OBJECT), ctx.a);
    h.dpWrite(0, ctx.a);
  };
  yield* call(0x809c2f, 0x809e1a);
  return yield* finishSequence(h, a, outerReturn, '9BD3');
}
function finish(h, a, outerReturn, name) {
  const { ctx } = h,
    rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, name + '-RTS', outerReturn);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-' + name.toLowerCase(),
    chosen: h.dp(0),
  };
}
// 80:9BB9: script form of 9BC6 (object number) with flag $1D6D = FFFF during the choice, then STZ $1D6D.
export function scriptChooseObjectNumberWithGlove(
  a,
  events,
  outerReturn = true,
  routines = GLOVE_ROUTINES,
) {
  return drainNativeSequence(
    scriptChooseObjectNumberWithGloveSequence(a, events, outerReturn, routines),
  );
}
function* scriptChooseObjectNumberWithGloveSequence(
  a,
  events,
  outerReturn,
  routines = GLOVE_ROUTINES,
) {
  entryCheck(a);
  const h = dialogAccess(a);
  yield () => {
    h.load(WORD_MASK);
    h.write(h.abs(SCRIPT_GLOVE_CHOICE), h.ctx.a);
  };
  yield* dialogCallBody(h, 0x809bbf, 0x809bc6, function* () {
    yield* gloveTargetSequence(h, events, routines);
    return yield* rts(h);
  });
  yield () => h.write(h.abs(SCRIPT_GLOVE_CHOICE), 0);
  return yield* finishSequence(h, a, outerReturn, '9BB9');
}
// 80:C724: choose a place with the action glove. Record 7E4138+DP00 = 0, window list AEB8, glove BC67,
// every frame B0A1, 9E1A, BE6D until A/B/X/Y is newly pressed; window list AEB0. From the glove position $01D4/$01D6
// (each >> 6, X additionally >> 7 in DPA2) and camera $0CC4/$0CC6 come 7E41E8 (900 + DPA2 - 0CC6 - DPA5 - 0ED8,
// times 2 plus 0CC4, halved) and 7E4190 (the value + 600 - DPA8 - 0CC4) of the record, 7E40E0 = 1; glove off
// via BCB2. The BRA at C727 skips the entry C729 (LDA #1).
export function choosePlaceWithGlove(a, events, outerReturn = true, routines = GLOVE_ROUTINES) {
  return drainNativeSequence(choosePlaceWithGloveSequence(a, events, outerReturn, routines));
}
function* choosePlaceWithGloveSequence(a, events, outerReturn, routines = GLOVE_ROUTINES) {
  entryCheck(a);
  const h = dialogAccess(a),
    { ctx } = h,
    call = (pc, target, long = false) => routineCall(routines, events, h, pc, target, long);
  yield () => {
    h.load(0);
    h.index('x', h.dp(0));
    h.phx();
    h.write(WRAM + MOTION_MODE + ctx.x, ctx.a);
  };
  yield* dialogCallBody(h, 0x80c733, 0x81aeb8, () => aeb8Sequence(h, events, routines), true);
  yield* dialogCallBody(h, 0x80c737, 0x80bc67, () => segmentSequence(() => putOnActionGlove(h)));
  yield* gloveFrames(h, events, routines, [0x80c73a, 0x80c73e, 0x80c741]);
  yield* dialogCallBody(h, 0x80c74c, 0x81aeb0, () => aeb0Sequence(h, events, routines), true);
  yield () => {
    h.load(h.read(h.abs(GLOVE_X)));
    for (let n = 0; n < GLOVE_PIXEL_SHIFT; n++) h.lsr();
    h.dpWrite(DP_GLOVE_PIXEL_X, ctx.a);
    h.lsr();
    h.dpWrite(DP_GLOVE_HALF_PIXEL_X, ctx.a);
    h.load(h.read(h.abs(GLOVE_Y)));
    for (let n = 0; n < GLOVE_PIXEL_SHIFT; n++) h.lsr();
    h.dpWrite(DP_GLOVE_PIXEL_Y, ctx.a);
    h.plx();
    h.load(PLACE_Y_BASE);
    clc(h);
    h.adc(h.dp(DP_GLOVE_HALF_PIXEL_X));
    sec(h);
    h.sbc(h.read(h.abs(CAMERA_Y)));
    h.sbc(h.dp(DP_GLOVE_PIXEL_Y));
    h.sbc(h.read(h.abs(OBJECT_HEIGHT) + ctx.x));
    h.asl();
    clc(h);
    h.adc(h.read(h.abs(CAMERA_X)));
    h.lsr();
    h.write(WRAM + MOTION_Y + ctx.x, ctx.a);
    clc(h);
    h.adc(PLACE_X_BASE);
    sec(h);
    h.sbc(h.dp(DP_GLOVE_PIXEL_X));
    h.sbc(h.read(h.abs(CAMERA_X)));
    h.write(WRAM + MOTION_X + ctx.x, ctx.a);
    h.load(1);
    h.write(WRAM + MOTION_ACTIVE + ctx.x, ctx.a);
  };
  yield* call(0x80c798, 0x80bcb2);
  return yield* finishSequence(h, a, outerReturn, 'C724');
}
// 80:9C33: script form of the choice 9C40 (slot) with flag $1D6D = FFFF during the choice, then STZ $1D6D.
export function scriptChooseObjectWithGlove(
  a,
  events,
  outerReturn = true,
  routines = GLOVE_ROUTINES,
) {
  return drainNativeSequence(scriptChooseObjectWithGloveSequence(a, events, outerReturn, routines));
}
function* scriptChooseObjectWithGloveSequence(a, events, outerReturn, routines = GLOVE_ROUTINES) {
  entryCheck(a);
  const h = dialogAccess(a);
  yield () => {
    h.load(WORD_MASK);
    h.write(h.abs(SCRIPT_GLOVE_CHOICE), h.ctx.a);
  };
  yield* dialogCallBody(h, 0x809c39, 0x809c40, () => gloveSelectSequence(h, events, routines));
  yield () => h.write(h.abs(SCRIPT_GLOVE_CHOICE), 0);
  return yield* finishSequence(h, a, outerReturn, '9C33');
}
// 80:8D0B: choose the object under the glove: the same selection loop as 9C40 without the distance check and window list; result slot
// $01DE (object under the glove) or FFFF in DP00, then BCB2 and 9E1A.
export function chooseObjectUnderGlove(a, events, outerReturn = true, routines = GLOVE_ROUTINES) {
  return drainNativeSequence(chooseObjectUnderGloveSequence(a, events, outerReturn, routines));
}
function* chooseObjectUnderGloveSequence(a, events, outerReturn, routines = GLOVE_ROUTINES) {
  entryCheck(a);
  const h = dialogAccess(a),
    { ctx } = h,
    call = (pc, target, long = false) => routineCall(routines, events, h, pc, target, long);
  yield* dialogCallBody(h, 0x808d0b, 0x80bc67, () => segmentSequence(() => putOnActionGlove(h)));
  yield* gloveFrames(h, events, routines, [0x808d0e, 0x808d12, 0x808d15]);
  let held;
  yield () => {
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
    held = !(ctx.status & FLAG_NEGATIVE);
    if (held) {
      h.load(h.read(h.abs(GLOVE_TARGET_OBJECT)));
      h.pha();
    }
  };
  if (held) {
    yield* call(0x808d29, 0x80bcb2);
    yield () => {
      h.pla();
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x808d2f, 0x809e1a);
  } else {
    yield* call(0x808d33, 0x80bcb2);
    yield () => {
      h.load(WORD_MASK);
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x808d3b, 0x809e1a);
  }
  let result;
  yield () => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, '8D0B-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-8d0b',
      chosen: h.dp(0),
    };
  };
  return result;
}
const WINDOW_ROUTINE_BANK = 0x81;
// Observations: counter B0A5 (frame), wait loops of the windows (ACAF/ACBD/ACC3/ACC9), joypad 9E1A.
const GLOVE_WAIT_PCS = Object.freeze(
  TALK_WAIT_PCS.filter((pc) => pc >>> WORD_BITS === WINDOW_ROUTINE_BANK),
);
export function validateGloveTaskOptions(options) {
  const {
    waitMode = null,
    waitObservations = null,
    inputMode = null,
    inputObservations = null,
  } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (inputMode !== null && inputMode !== 'record-observations')
    return { handled: false, reason: 'task_input_mode_required' };
  const records = (values, pcs) =>
    values === null ||
    (Array.isArray(values) &&
      Object.isFrozen(values) &&
      Array.from(values).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          pcs.includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= LONG_MASK &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= WORD_MASK,
      ));
  if (!records(waitObservations, GLOVE_WAIT_PCS))
    return { handled: false, reason: 'task_wait_observations_required' };
  if (!records(inputObservations, [0x809e1a]))
    return { handled: false, reason: 'task_input_observations_required' };
  return null;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observedGlove(sequence, a, options, outerReturn, lifted = null) {
  const invalid = validateGloveTaskOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: 'record-observations',
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: options?.inputObservations ?? null,
      inputIndex: 0,
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  if (lifted !== null && lagFree(events))
    return { sequence: liftedResult(lifted(dialogAccess(a), events)), finish };
  return { sequence: sequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
const observed =
  (sequence) =>
  (a, options, outerReturn = true, lifted = null) => {
    const { sequence: s, finish } = observedGlove(sequence, a, options, outerReturn, lifted);
    return finish(drainNativeSequence(s));
  };
// The scheduler's native bridge owns these continuations between work budgets.
const resumable =
  (sequence) =>
  (a, options, lifted = null) =>
    observedContinuation(a, observedGlove(sequence, a, options, false, lifted));
export const chooseObjectNumberWithGloveObserved = observed(chooseObjectNumberWithGloveSequence),
  createChooseObjectNumberWithGloveObserved = resumable(chooseObjectNumberWithGloveSequence);
export const chooseObjectUnderGloveObserved = observed(chooseObjectUnderGloveSequence),
  createChooseObjectUnderGloveObserved = resumable(chooseObjectUnderGloveSequence);
export const targetWithSpellGloveObserved = observed(spellGloveTargetSequence),
  createTargetWithSpellGloveObserved = resumable(spellGloveTargetSequence);
export const scriptChooseObjectWithGloveObserved = observed(scriptChooseObjectWithGloveSequence),
  createScriptChooseObjectWithGloveObserved = resumable(scriptChooseObjectWithGloveSequence);
export const choosePlaceWithGloveObserved = observed(choosePlaceWithGloveSequence),
  createChoosePlaceWithGloveObserved = resumable(choosePlaceWithGloveSequence);
export const scriptChooseObjectNumberWithGloveObserved = observed(
    scriptChooseObjectNumberWithGloveSequence,
  ),
  createScriptChooseObjectNumberWithGloveObserved = resumable(
    scriptChooseObjectNumberWithGloveSequence,
  );
NATIVE_CALL_CONTINUATIONS.set(0x81aeb0, {
  run: resetAndDrawWindowList,
  create: ({ h, events }) => new NativeCallContinuation(h.a, aeb0Sequence(h, events)),
});
