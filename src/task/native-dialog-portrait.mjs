import { taskStop } from './plan.mjs';
import { waitForRandomStateChange } from './native-frame-wait.mjs';
import { runReleaseWindowCall } from '../game/window-release.mjs';
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
  WINDOW_COLUMNS,
  WINDOW_LEFT_PIXEL,
  WINDOW_WIDTH_PIXELS,
  UNPACK_OUTPUT_START,
  UNPACK_OUTPUT_CURSOR,
  UNPACK_SOURCE_POINTER,
  UNPACK_SOURCE_BANK,
  UNPACK_RUN_LENGTH,
  TMW_SHADOW,
  HDMAEN_SHADOW,
  PORTRAIT_PALETTE_START,
  PORTRAIT_DMA_REQUEST,
  DIALOG_HDMA_TABLE,
  LEFT_WINDOW_LEFT_EDGE,
  LEFT_WINDOW_RIGHT_EDGE,
  RIGHT_WINDOW_LEFT_EDGE,
  RIGHT_WINDOW_RIGHT_EDGE,
  DIALOG_RECORD_FLAGS,
  OAM_HIGH_TABLE,
} from './wram.mjs';
import {
  COLDATA,
  CGADSUB,
  DAS0L,
  A1T0L,
  W12SEL,
  WBGLOG,
  WH0,
  DMAP0,
  BBAD0,
  A1B0,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import { BANK_WRAP, BYTE_MASK, BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
import { WRAM_BANK, WRAM_HIGH_BANK, WRAM_HIGH_BANK_PAIR } from '../constants/memory-map.mjs';
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
const DIALOG_HDMA_LAST_BYTE = 0x0f;
// A portrait: OBJSEL as a word (OAMADDL gets 0), the record pointer [F6] (byte 2 the bank),
// the unpack buffer 7F:5250 and the 1000-byte VRAM DMA of 8FF5 (address increment after the
// high byte, mode 1 to VMDATAL/VMDATAH).
export const PORTRAIT_OBJSEL = 0x40,
  DP_PORTRAIT_POINTER = 0xf6,
  DP_PORTRAIT_BANK = 0xf8,
  PORTRAIT_RECORD_BANK_BYTE = 2,
  PORTRAIT_BUFFER = 0x5250;
const PORTRAIT_UPLOAD_BYTES = 0x1000,
  PORTRAIT_UPLOAD_MODE = 1,
  PORTRAIT_UPLOAD_TARGET = VMDATAL & BYTE_MASK;
// CGRAM starts of the two portrait palettes and the second portrait's VRAM word address.
const FIRST_PORTRAIT_PALETTE = 0x91;
export const SECOND_PORTRAIT_PALETTE = 0xa1,
  SECOND_PORTRAIT_VRAM = 0x800;
// 9022 fills every fourth byte of the HDMA table 7E:3D08 with F0, clears the OAM high
// table copy and sets two table words; 905E and E48D set the second portrait's words (905E
// adds the mirror bit of the dialog flags as bit 14 of the second word).
const PORTRAIT_HDMA_FILL = Object.freeze({
  table: 0x7e3d08,
  value: 0xf0,
  last: 0x1fd,
  stride: 4,
  oamHighLast: 0x1e,
  words: Object.freeze([
    [0x7e3d0c, 0x83a6],
    [0x7e3d0e, 0x3200],
  ]),
});
export const SECOND_PORTRAIT_HDMA = Object.freeze({
  firstAddress: 0x7e3d10,
  first: 0x1a1a,
  secondAddress: 0x7e3d12,
  second: 0x3480,
  oamHighAddress: WRAM + OAM_HIGH_TABLE,
  oamHigh: 0x28,
});
// 8F20 moves seven 100-byte portrait rows up by 100 with MVP in bank 7F.
const PORTRAIT_ROW_SHIFT = Object.freeze({
  sourceEnd: 0x5a4f,
  destinationEnd: 0x624f,
  sourceStop: 0x534f,
  rowBytes: 0x100,
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
// JSL $81B0A1 (wait for the next frame) with the counter observations from events.waitIndex.
export function observeRandomStateWait(h, events, pc) {
  h.call(
    pc,
    0x81b0a1,
    () => {
      const p = waitForRandomStateChange(
        h.a,
        {
          interruptEvents: events,
          waitObservations: Object.freeze((events.values ?? []).slice(events.waitIndex)),
        },
        false,
        true,
      );
      events.waitIndex += p.waitObservationsUsed;
      events.waitEvents.push(...p.waitEvents);
      return p;
    },
    true,
  );
}

// 81:886A: CGWSEL/colour (SEP 20, $2132 = E0, $2131 = 0), RTL.
export function clearFixedColour(h) {
  h.sep(FLAG_MEMORY_8BIT);
  h.load(FIXED_COLOUR_BLACK);
  h.portWrite(COLDATA, FIXED_COLOUR_BLACK, 1, 0x81886e);
  h.portWrite(CGADSUB, 0, 1, 0x818871);
  h.rep(FLAG_MEMORY_8BIT);
  return h.rtl();
}
// 80:FA92: window DP00: DP02 to 7E2100+X; DP04 positive to 7E2120+X, otherwise 7E2020+X + DP04 - 2.
export function setWindowTextWidth(h) {
  const { ctx } = h;
  h.index('x', h.dp(0));
  h.load(h.dp(2));
  h.write(WRAM + WINDOW_LEFT_PIXEL + ctx.x, ctx.a);
  h.load(h.dp(DP_PIXEL_WIDTH));
  if (ctx.status & FLAG_ZERO || ctx.status & FLAG_NEGATIVE) {
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
    h.load(ctx.a - 1);
    h.load(ctx.a - 1);
  }
  h.write(WRAM + WINDOW_WIDTH_PIXELS + ctx.x, ctx.a);
  return h.rts();
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
// 80:8F20: shift the portrait rows in bank 7F up by 0x100 each via MVP (7 passes), PHB/PLB.
export function shiftPortraitRows(h) {
  const { ctx } = h;
  h.phb();
  h.index('x', PORTRAIT_ROW_SHIFT.sourceEnd);
  h.index('y', PORTRAIT_ROW_SHIFT.destinationEnd);
  do {
    h.load(ctx.y);
    ctx.status |= FLAG_CARRY;
    h.sbc(PORTRAIT_ROW_SHIFT.rowBytes);
    h.index('y', ctx.a);
    h.load(PORTRAIT_ROW_SHIFT.rowBytes - 1);
    h.move(WRAM_HIGH_BANK, WRAM_HIGH_BANK, -1);
    h.cpx(PORTRAIT_ROW_SHIFT.sourceStop);
  } while (!(ctx.status & FLAG_ZERO));
  h.plb();
  return h.rts();
}
// 80:8FF5: DMA job 7F:5250, 0x1000 bytes to VRAM X (channel 0), via $0140 to the NMI; wait until
// the NMI sets $0140 negative.
export function uploadPortraitTiles(h, events) {
  const { ctx } = h;
  h.load(PORTRAIT_UPLOAD_BYTES);
  h.portWrite(DAS0L, ctx.a, 2, 0x808ff8);
  h.load(PORTRAIT_BUFFER);
  h.portWrite(A1T0L, ctx.a, 2, 0x808ffe);
  h.sep(FLAG_MEMORY_8BIT);
  for (const [pc, port, v] of [
    [0x809005, A1B0, WRAM_HIGH_BANK],
    [0x80900a, BBAD0, PORTRAIT_UPLOAD_TARGET],
    [0x80900f, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
    [0x809014, DMAP0, PORTRAIT_UPLOAD_MODE],
  ]) {
    h.load(v);
    h.portWrite(port, v, 1, pc);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(PORTRAIT_DMA_REQUEST), ctx.x, 2);
  waitWord(h, events, 0x80901c, PORTRAIT_DMA_REQUEST, (v) => (v & WORD_SIGN) !== 0);
  return h.rts();
}
// 80:9022: channel $91, portrait buffer to VRAM 0; fill the HDMA table 7E3D08.. with F0, clear 7E3F08...
export function uploadFirstPortrait(h, events) {
  const { ctx } = h;
  h.load(FIRST_PORTRAIT_PALETTE);
  h.write(h.abs(PORTRAIT_PALETTE_START), ctx.a);
  h.index('x', 0);
  h.call(0x80902b, 0x808ff5, () => uploadPortraitTiles(h, events));
  h.sep(FLAG_MEMORY_8BIT);
  h.load(PORTRAIT_HDMA_FILL.value);
  h.index('x', PORTRAIT_HDMA_FILL.last);
  do {
    h.write(PORTRAIT_HDMA_FILL.table + ctx.x, ctx.a, 1);
    for (let n = 0; n < PORTRAIT_HDMA_FILL.stride; n++) h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.rep(FLAG_MEMORY_8BIT);
  h.index('x', PORTRAIT_HDMA_FILL.oamHighLast);
  h.load(0);
  do {
    h.write(WRAM + OAM_HIGH_TABLE + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [address, value] of PORTRAIT_HDMA_FILL.words) {
    h.load(value);
    h.write(address, ctx.a);
  }
  return h.rts();
}
// 80:905E: channel $A1, second portrait to VRAM 0800; HDMA entries with the mirror bit from $01BA, 1562 += 1.
export function uploadSecondPortrait(h, events) {
  const { ctx } = h;
  h.load(SECOND_PORTRAIT_PALETTE);
  h.write(h.abs(PORTRAIT_PALETTE_START), ctx.a);
  h.index('x', SECOND_PORTRAIT_VRAM);
  h.call(0x809067, 0x808ff5, () => uploadPortraitTiles(h, events));
  h.load(SECOND_PORTRAIT_HDMA.first);
  h.write(SECOND_PORTRAIT_HDMA.firstAddress, ctx.a);
  h.load(h.read(h.abs(DIALOG_RECORD_FLAGS)));
  h.load(ctx.a & BYTE_SIGN);
  h.xba();
  h.lsr();
  h.load(ctx.a | SECOND_PORTRAIT_HDMA.second);
  h.write(SECOND_PORTRAIT_HDMA.secondAddress, ctx.a);
  h.load(SECOND_PORTRAIT_HDMA.oamHigh);
  h.write(SECOND_PORTRAIT_HDMA.oamHighAddress, ctx.a);
  h.call(
    0x809087,
    0x81a954,
    () => {
      h.modify(h.abs(NMI_JOB_LISTS), 'inc');
      return h.rtl();
    },
    true,
  );
  return h.rts();
}
// 80:8EFE: window edges from X ($0148/$0149/$014E/$014F, BYTE), PHP/PLP.
function runWindowEdges(h) {
  const { ctx } = h;
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(ctx.x);
  ctx.status &= ~FLAG_CARRY;
  h.adc(PORTRAIT_WINDOW.leftWindowRightBias);
  h.write(h.abs(LEFT_WINDOW_RIGHT_EDGE), ctx.a, 1);
  h.load(ctx.x);
  h.adc(PORTRAIT_WINDOW.rightWindowRightBias);
  h.write(h.abs(RIGHT_WINDOW_RIGHT_EDGE), ctx.a, 1);
  h.load(ctx.x);
  h.load(ctx.a ^ BYTE_MASK);
  h.pha();
  h.adc(PORTRAIT_WINDOW.leftWindowLeftBias);
  h.write(h.abs(LEFT_WINDOW_LEFT_EDGE), ctx.a, 1);
  h.pla();
  ctx.status &= ~FLAG_CARRY;
  h.adc(PORTRAIT_WINDOW.rightWindowLeftBias);
  h.write(h.abs(RIGHT_WINDOW_LEFT_EDGE), ctx.a, 1);
  h.plp();
  return h.rts();
}
// 80:8F3A: open the window: window registers, HDMA table $0144 from 80:8F87, prepare channel 0, bit 0 in
// $01C4; then widen the edges by 3 every frame (X = 2..32).
export function openPortraitWindow(h, events) {
  const { ctx } = h;
  h.load(PORTRAIT_WINDOW.select);
  h.portWrite(W12SEL, ctx.a, 2, 0x808f3d);
  h.portWrite(WBGLOG, 0, 2, 0x808f40);
  h.load(DIALOG_HDMA_TABLE);
  h.portWrite(A1T0L, ctx.a, 2, 0x808f46);
  h.sep(FLAG_MEMORY_8BIT);
  h.index('x', DIALOG_HDMA_LAST_BYTE);
  do {
    h.load(h.read(0x808f87 + ctx.x, 1));
    h.write(h.abs(DIALOG_HDMA_TABLE) + ctx.x, ctx.a, 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [pc, port, v] of [
    [0x808f5a, DMAP0, PORTRAIT_WINDOW.hdmaMode],
    [0x808f5f, BBAD0, PORTRAIT_WINDOW.hdmaTarget],
    [0x808f64, A1B0, WRAM_BANK],
  ]) {
    h.load(v);
    h.portWrite(port, v, 1, pc);
  }
  h.load(PORTRAIT_WINDOW.hdmaChannel);
  h.testBits(h.abs(HDMAEN_SHADOW), true);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(PORTRAIT_WINDOW.layers);
  h.write(h.abs(TMW_SHADOW), ctx.a);
  h.index('x', PORTRAIT_WINDOW.edgeFirst);
  do {
    observeRandomStateWait(h, events, 0x808f77);
    h.call(0x808f7b, 0x808efe, () => runWindowEdges(h));
    for (let n = 0; n < PORTRAIT_WINDOW.edgeStep; n++) h.index('x', ctx.x + 1);
    h.cpx(PORTRAIT_WINDOW.edgeEnd);
  } while (!(ctx.status & FLAG_CARRY));
  return h.rts();
}
// 80:8F97: close the window: shrink the edges by 3 every frame (X = 31 downwards), $01C2 = 0, clear bit 0 in $01C4.
export function closePortraitWindow(h, events) {
  const { ctx } = h;
  h.index('x', PORTRAIT_WINDOW.edgeLast);
  do {
    observeRandomStateWait(h, events, 0x808f9a);
    h.call(0x808f9e, 0x808efe, () => runWindowEdges(h));
    for (let n = 0; n < PORTRAIT_WINDOW.edgeStep; n++) h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.write(h.abs(TMW_SHADOW), 0);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(PORTRAIT_WINDOW.hdmaChannel);
  h.testBits(h.abs(HDMAEN_SHADOW), false);
  h.rep(FLAG_MEMORY_8BIT);
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
  [0x80fa3e, runReleaseWindowCall],
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
