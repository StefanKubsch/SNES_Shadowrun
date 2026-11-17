import { taskStop } from './task-stop.mjs';
import { releaseWindowAdapter } from './native-render-compose.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';
import { interruptStep } from './main-wait-interrupt.mjs';
import { runUnpackBody, unpackStep } from './native-unpack-body.mjs';

import {
  GLOVE_KIND,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GLOVE_NAME_WINDOW,
  NMI_JOB_LISTS,
  WRAM,
  UNPACK_OUTPUT_START,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_SOURCE_POINTER,
  UNPACK_SOURCE_BANK,
  UNPACK_RUN_LENGTH,
  PORTRAIT_DMA_REQUEST,
  OAM_HIGH_TABLE,
} from '../data/wram.mjs';
import { WH0 } from '../constants/hardware-registers.mjs';
import { BANK_WRAP, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { WRAM_HIGH_BANK_PAIR } from '../constants/memory-map.mjs';
// Window and portrait setup of the dialog $936C. Each function starts at the original entry (frame from the
// caller via h.call) and ends with the original RTS/RTL. h comes from dialogAccess
// (native-dialog-support.mjs); events is the shared observation set of the native.

// Portrait windows of 8F3A/8F97 and of E433 (native-member-spell-menu.mjs): the W12SEL/W34SEL
// word and TMW layers, HDMA channel 0 in mode 1 to WH0/WH1 from bank 7E, and edges that move by
// three per frame for X = 2 up to 20 (8F97 from 1F down). 8EFE adds the biases to X (right
// edges) and to X EOR FF (left edges) of the left and the right window.
export const PORTRAIT_WINDOW = Object.freeze({
  select: 0x2222,
  layers: 0x0f,
  hdmaMode: 1,
  hdmaTarget: WH0 & BYTE_MASK,
  hdmaChannel: 1,
  edgeFirst: 2,
  edgeStep: 3,
  edgeEnd: 0x21,
  edgeLast: 0x1f,
  leftWindowRightBias: 0x39,
  leftWindowLeftBias: 0x3b,
  rightWindowRightBias: 0xc5,
  rightWindowLeftBias: 0xc7,
});
// A portrait: OBJSEL as a word (OAMADDL gets 0), the record pointer [F6] (byte 2 the bank),
// the unpack buffer 7F:5250 and the 1000-byte VRAM DMA of 8FF5 (address increment after the
// high byte, mode 1 to VMDATAL/VMDATAH).
export const PORTRAIT_OBJSEL = 0x40,
  DP_PORTRAIT_POINTER = 0xf6,
  DP_PORTRAIT_BANK = 0xf8,
  PORTRAIT_RECORD_BANK_BYTE = 2,
  PORTRAIT_BUFFER = 0x5250;
// CGRAM start of the second portrait palette and its VRAM word address.
export const SECOND_PORTRAIT_PALETTE = 0xa1,
  SECOND_PORTRAIT_VRAM = 0x800;
// 905E and E48D set the second portrait's HDMA words (905E adds the mirror bit of the\n// dialog flags as bit 14 of the second word) and its OAM high table byte.
export const SECOND_PORTRAIT_HDMA = Object.freeze({
  firstAddress: 0x7e3d10,
  first: 0x1a1a,
  secondAddress: 0x7e3d12,
  second: 0x3480,
  oamHighAddress: WRAM + OAM_HIGH_TABLE,
  oamHigh: 0x28,
});
// 886A clears the fixed colour: COLDATA red, green and blue planes (bits 5 to 7, ppu.mjs) at 0.
export const FIXED_COLOUR_BLACK = 0xe0;
// FA92: DP04 is the width in pixels; zero or negative is added to the column count minus 2.
export const DP_PIXEL_WIDTH = 4;
// Inline NMI waits with their polled word; the branch follows the 3-byte LDA abs.
const INLINE_WAITS = Object.freeze([
  [0x80901c, PORTRAIT_DMA_REQUEST],
  [0x80ae5e, NMI_JOB_LISTS],
  [0x80ae0c, NMI_JOB_LISTS],
]);
const LDA_ABSOLUTE_BYTES = 3;

// Wait loop LDA abs / Bxx onto itself: per pass one observation of the word that the NMI
// writes; the value is stored at the original address and read afresh. extras: WRAM words that the
// NMI also writes meanwhile and the code reads afterwards (one observation each with the same PC).
export function waitWord(h, events, pc, offset, done, extras = []) {
  if (events?.interrupts !== undefined) {
    if (h.ctx.e !== 0 || h.ctx.d !== 0 || h.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('wait_interrupt_entry_required');
    if (!INLINE_WAITS.some(([at, field]) => at === pc && field === offset))
      taskStop('wait_interrupt_inline_entry_required', { pc, offset });
    let again;
    do {
      interruptStep(h, events, pc);
      h.load(h.read(h.abs(offset), 2));
      interruptStep(h, events, pc + LDA_ABSOLUTE_BYTES);
      again = pc === 0x80901c ? !(h.ctx.status & FLAG_NEGATIVE) : !(h.ctx.status & FLAG_ZERO);
    } while (again);
    return;
  }
  for (;;) {
    const address = h.abs(offset),
      o = events.values?.[events.waitIndex];
    if (!o || o.pc !== pc || o.address !== address || o.width !== 2)
      taskStop('task_wait_observation_required', {
        pc,
        address,
        width: 2,
        observationIndex: events.waitIndex,
      });
    events.waitIndex++;
    events.waitEvents.push(o);
    h.write(address, o.value, 2);
    h.load(h.read(address, 2));
    if (done(h.ctx.a)) break;
  }
  nmiWords(h, events, pc, extras);
}
// Words written by the NMI during a wait (bank 0), in observation order.
export function nmiWords(h, events, pc, offsets) {
  if (events?.interrupts !== undefined) return;
  for (const offset of offsets) {
    const o = events.values?.[events.waitIndex];
    if (!o || o.pc !== pc || o.address !== offset || o.width !== 2)
      taskStop('task_wait_observation_required', {
        pc,
        address: offset,
        width: 2,
        observationIndex: events.waitIndex,
      });
    events.waitIndex++;
    events.waitEvents.push(o);
    h.a.writeWord(offset, o.value, BANK_WRAP);
  }
}

// 80:9F6D: original portrait unpacker, with its real PHP/PHB and RTS.
export function unpackPortrait(h, e) {
  const { ctx } = h,
    step = (pc) => unpackStep(h, e, pc);
  step(0x809f6d);
  h.php();
  step(0x809f6e);
  h.phb();
  step(0x809f6f);
  h.dpWrite(UNPACK_SOURCE_POINTER, ctx.a);
  step(0x809f71);
  h.dpWrite(UNPACK_SOURCE_BANK, ctx.y, 2);
  step(0x809f73);
  h.dpWrite(UNPACK_OUTPUT_START, ctx.x, 2);
  step(0x809f75);
  h.dpWrite(UNPACK_OUTPUT_CURSOR, ctx.x, 2);
  step(0x809f77);
  h.dpWrite(UNPACK_RUN_LENGTH, 0);
  step(0x809f79);
  h.push(WRAM_HIGH_BANK_PAIR, 2);
  step(0x809f7c);
  h.plb();
  step(0x809f7d);
  h.plb();
  step(0x809f7e);
  h.index('y', 0);
  step(0x809f81);
  h.load(h.read(h.indirect(UNPACK_SOURCE_POINTER, ctx.y)));
  runUnpackBody(h, e, true);
  step(0x80a030);
  h.plb();
  step(0x80a031);
  h.plp();
  step(0x80a032);
  return h.rts();
}
// 80:BCB2: glove off ($01D8 = 0); a non-negative $01DA frees the buffer $01DC via BE5B (FA3E).
export function putGloveAway(h, events, routines = null) {
  const r =
    routines === null
      ? RELEASE_ROUTINES
      : new Map([
          [0x80be5b, releaseGloveNameWindow],
          [0x80fa3e, () => routines.fa3e(h.a)],
        ]);
  return drainNativeSequence(gloveReleaseSequence(h, events, r));
}
// Original routine $80:BCB2.
function* gloveReleaseSequence(h, events, routines) {
  let result;
  yield () => {
    h.write(h.abs(GLOVE_KIND), 0);
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
  };
  if (!(h.ctx.status & FLAG_NEGATIVE))
    yield* nativeCallSequence(h, events, routines, 0x80bcba, 0x80be5b);
  yield () => {
    result = h.rts();
  };
  return result;
}
// 80:BE5B: release the glove's name window through FA3E and clear the glove target.
export function releaseGloveNameWindow(h, events, routines = RELEASE_ROUTINES) {
  return drainNativeSequence(releaseGloveNameWindowSequence(h, events, routines));
}
export function* releaseGloveNameWindowSequence(h, events, routines) {
  let result;
  yield () => {
    h.load(h.read(h.abs(GLOVE_NAME_WINDOW)));
    h.dpWrite(0, h.ctx.a);
  };
  yield* nativeCallSequence(h, events, routines, 0x80be60, 0x80fa3e);
  yield () => {
    h.load(WORD_MASK);
    h.write(h.abs(GLOVE_TARGET_TAG), h.ctx.a);
    h.write(h.abs(GLOVE_TARGET_OBJECT), h.ctx.a);
    result = h.rts();
  };
  return result;
}
export const putGloveAwayAdapter = (h, e) => putGloveAway(h, e);
const RELEASE_ROUTINES = new Map([
  [0x80be5b, releaseGloveNameWindow],
  [0x80fa3e, releaseWindowAdapter],
]);
NATIVE_CALL_CONTINUATIONS.set(0x80bcb2, {
  run: putGloveAwayAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, gloveReleaseSequence(h, events, RELEASE_ROUTINES)),
});
NATIVE_CALL_CONTINUATIONS.set(0x80be5b, {
  run: releaseGloveNameWindow,
  create: ({ h, events, routines = RELEASE_ROUTINES }) =>
    new NativeCallContinuation(h.a, releaseGloveNameWindowSequence(h, events, routines)),
});
