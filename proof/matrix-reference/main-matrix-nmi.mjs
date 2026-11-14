import { runObservedNmi } from '../../src/task/observed-nmi.mjs';
import { sendOamBuffer } from '../../src/task/main-scene-video.mjs';
import { readJoypadLong } from '../../src/task/main-scene-wait.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';

import { BG3_MAP_VRAM, HDMA_ENTRY_BYTES, MAP_LAST, SCROLL_TABLE } from './main-scene-matrix.mjs';
import {
  DMA_RECORD_COUNT,
  MATRIX_COLOUR_CYCLE_A,
  MATRIX_COLOUR_CYCLE_B,
  MATRIX_DMA_END,
  MATRIX_DMA_RECORDS,
  MATRIX_FAR_SCROLL_X,
  MATRIX_FAR_SCROLL_Y,
  MATRIX_SCROLL_X,
  MATRIX_SCROLL_Y,
  MATRIX_TEXT_CURSOR,
  MATRIX_TEXT_CURSOR_SHOWN,
  MATRIX_TEXT_SCROLL,
  RANDOM_STATE,
  WRAM,
} from '../../src/task/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../../src/constants/bits.mjs';
import {
  DMAP0,
  BBAD0,
  DAS0L,
  VMAINC,
  A1B0,
  BG1HOFS,
  BG1VOFS,
  BG2HOFS,
  BG2VOFS,
  A1T0L,
  VMADDL,
  MDMAEN,
  BG3VOFS,
  CGADD,
  CGDATA,
  VMDATAL,
} from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
  FLAG_ZERO,
  FLAG_CARRY,
  FLAG_NEGATIVE,
} from '../../src/constants/cpu-flags.mjs';
// B1E2 consumes the original eight-byte DMA records by moving S, not by
// indexing a copied queue. Every pull and the saved S at DP32 remain fresh.
const DP_SAVED_STACK = 0x32;
// 81:BEC3: BG3 colour 1 of palettes 0 and 1 (CGRAM 1 and 5) half and full green, colour 0
// black; the blink colours 81:BFD4 (two words) go to CGRAM 9 and 13 every 16 and 8 frames
// (the STA instructions 7, 14 and 21 bytes behind the loop start); the BG3 row that scrolls
// in next (232 lines below the scroll) is cleared, and the text cursor tile 02 (palette 3,
// priority) moves to MATRIX_TEXT_CURSOR.
const GREEN_HALF = 0x01e0,
  GREEN_FULL = 0x03e0,
  PALETTE_1_TEXT = 5,
  MATRIX_BLINK_COLOURS = 0x81bfd4,
  BLINK_INDEX_MASK = 3,
  BLINK_A_FRAMES_MASK = 15,
  BLINK_B_FRAMES_MASK = 7,
  BLINK_A_COLOUR = 9,
  BLINK_B_COLOUR = 13,
  BLINK_CGADD_PC = 7,
  BLINK_LOW_PC = 14,
  BLINK_HIGH_PC = 21,
  WINDOW_SCROLL = SCROLL_TABLE + HDMA_ENTRY_BYTES + 1,
  NEXT_ROW_LINES = 0xe8,
  ROW_LINE_MASK = 0xf8,
  CURSOR_TILE = 0x2c02;
// 81:B1E2: send the queued VRAM DMA records (matrix NMI).
export function sendMatrixDmaRecords(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_MEMORY_8BIT);
  h.sep(FLAG_INDEX_8BIT);
  h.load(h.read(h.abs(MATRIX_DMA_RECORDS)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(ctx.s);
    h.dpWrite(DP_SAVED_STACK, ctx.a);
    h.load(DMA_RECORD_COUNT - 1);
    ctx.s = ctx.a;
    h.index('y', 1);
    h.portWrite(DMAP0, ctx.y, 1, 0x81b1f5);
    h.index('x', VMDATAL & BYTE_MASK);
    h.portWrite(BBAD0, ctx.x, 1, 0x81b1fa);
    for (;;) {
      h.pla();
      if (ctx.status & FLAG_ZERO) break;
      h.portWrite(DAS0L, ctx.a, 2, 0x81b200);
      h.plx();
      h.portWrite(VMAINC, ctx.x, 1, 0x81b204);
      h.plx();
      h.portWrite(A1B0, ctx.x, 1, 0x81b208);
      h.pla();
      h.portWrite(A1T0L, ctx.a, 2, 0x81b20c);
      h.pla();
      h.portWrite(VMADDL, ctx.a, 2, 0x81b210);
      h.portWrite(MDMAEN, ctx.y, 1, 0x81b213);
    }
    h.load(h.dp(DP_SAVED_STACK));
    ctx.s = ctx.a;
    h.write(h.abs(MATRIX_DMA_END), 0);
    h.write(h.abs(MATRIX_DMA_RECORDS), 0);
    h.index('x', 0);
    h.portWrite(MDMAEN, ctx.x, 1, 0x81b223);
  }
  h.plp();
  return h.rts();
}
// 81:BEC3: matrix NMI callback: colours, blink, message row and text cursor.
export function handleMatrixNmi(h, e, r = MATRIX_NMI_ROUTINES) {
  return drainNativeSequence(handleMatrixNmiSequence(h, e, r));
}
function* handleMatrixNmiSequence(h, e, r) {
  const { ctx } = h,
    call = routineCaller(h, e, r);
  let result;
  yield () => {
    call(0x81bec3, 0x81ed8b, true);
    h.load(h.read(h.abs(MATRIX_SCROLL_X)));
    h.lsr();
    h.write(h.abs(MATRIX_FAR_SCROLL_X), ctx.a);
    h.load(h.read(h.abs(MATRIX_SCROLL_Y)));
    h.lsr();
    h.write(h.abs(MATRIX_FAR_SCROLL_Y), ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    for (const [pc, offset, value] of [
      [0x81bed9, CGADD, 0],
      [0x81bedc, CGDATA, 0],
      [0x81bedf, CGDATA, 0],
      [0x81bee4, CGDATA, GREEN_HALF & BYTE_MASK],
      [0x81bee9, CGDATA, GREEN_HALF >> BYTE_BITS],
      [0x81beee, CGADD, PALETTE_1_TEXT],
      [0x81bef3, CGDATA, GREEN_FULL & BYTE_MASK],
      [0x81bef8, CGDATA, GREEN_FULL >> BYTE_BITS],
    ]) {
      if (![0x81bedc, 0x81bedf].includes(pc)) h.load(value);
      h.portWrite(offset, value, 1, pc);
    }
    for (const [pc, offset, shadow] of [
      [0x81befe, MATRIX_TEXT_SCROLL, WINDOW_SCROLL],
      [0x81bf08, MATRIX_TEXT_SCROLL + 1, WINDOW_SCROLL + 1],
    ]) {
      h.load(h.read(h.abs(offset)));
      h.portWrite(BG3VOFS, ctx.a & BYTE_MASK, 1, pc);
      h.write(shadow, ctx.a);
    }
    for (const [pc, offset, port] of [
      [0x81bf12, MATRIX_SCROLL_X, BG1HOFS],
      [0x81bf18, MATRIX_SCROLL_X + 1, BG1HOFS],
      [0x81bf1e, MATRIX_SCROLL_Y, BG1VOFS],
      [0x81bf24, MATRIX_SCROLL_Y + 1, BG1VOFS],
      [0x81bf2a, MATRIX_FAR_SCROLL_X, BG2HOFS],
      [0x81bf30, MATRIX_FAR_SCROLL_X + 1, BG2HOFS],
      [0x81bf36, MATRIX_FAR_SCROLL_Y, BG2VOFS],
      [0x81bf3c, MATRIX_FAR_SCROLL_Y + 1, BG2VOFS],
    ]) {
      h.load(h.read(h.abs(offset)));
      h.portWrite(port, ctx.a & BYTE_MASK, 1, pc);
    }
    h.rep(FLAG_MEMORY_8BIT);
    for (const [mask, offset, base, palette] of [
      [BLINK_A_FRAMES_MASK, MATRIX_COLOUR_CYCLE_A, 0x81bf4a, BLINK_A_COLOUR],
      [BLINK_B_FRAMES_MASK, MATRIX_COLOUR_CYCLE_B, 0x81bf76, BLINK_B_COLOUR],
    ]) {
      h.load(h.read(WRAM + RANDOM_STATE));
      h.load(ctx.a & mask);
      if (!(ctx.status & FLAG_ZERO)) continue;
      h.index('x', h.read(h.abs(offset), 2));
      h.sep(FLAG_MEMORY_8BIT);
      h.load(palette);
      h.portWrite(CGADD, ctx.a & BYTE_MASK, 1, base + BLINK_CGADD_PC);
      h.load(h.read(MATRIX_BLINK_COLOURS + ctx.x));
      h.portWrite(CGDATA, ctx.a & BYTE_MASK, 1, base + BLINK_LOW_PC);
      h.load(h.read(MATRIX_BLINK_COLOURS + 1 + ctx.x));
      h.portWrite(CGDATA, ctx.a & BYTE_MASK, 1, base + BLINK_HIGH_PC);
      h.rep(FLAG_MEMORY_8BIT);
      h.load(ctx.x);
      h.load(ctx.a + 1);
      h.load(ctx.a + 1);
      h.load(ctx.a & BLINK_INDEX_MASK);
      h.write(h.abs(offset), ctx.a);
    }
    h.load(h.read(h.abs(MATRIX_TEXT_SCROLL)));
    ctx.status &= ~FLAG_CARRY;
    h.adc(NEXT_ROW_LINES);
    h.load(ctx.a & ROW_LINE_MASK);
    h.asl();
    h.asl();
    h.load(ctx.a | BG3_MAP_VRAM);
    h.portWrite(VMADDL, ctx.a, 2, 0x81bfa8);
    h.index('x', MAP_LAST);
    do {
      h.portWrite(VMDATAL, 0, 2, 0x81bfae);
      h.index('x', ctx.x - 1);
    } while (!(ctx.status & FLAG_NEGATIVE));
    h.load(h.read(h.abs(MATRIX_TEXT_CURSOR_SHOWN)));
    h.portWrite(VMADDL, ctx.a, 2, 0x81bfb7);
    h.portWrite(VMDATAL, 0, 2, 0x81bfba);
    call(0x81bfbd, 0x81b1e2);
    h.load(h.read(h.abs(MATRIX_TEXT_CURSOR)));
    h.write(h.abs(MATRIX_TEXT_CURSOR_SHOWN), ctx.a);
    h.portWrite(VMADDL, ctx.a, 2, 0x81bfc6);
    h.load(CURSOR_TILE);
    h.portWrite(VMDATAL, ctx.a, 2, 0x81bfcc);
  };
  yield* nativeCallSequence(h, e, r, 0x81bfcf, 0x80f290, true);
  yield () => {
    result = h.rtl();
  };
  return result;
}
export const MATRIX_NMI_ROUTINES = new Map([
  [0x81bec3, handleMatrixNmi],
  [0x81b1e2, sendMatrixDmaRecords],
  [0x81ed8b, sendOamBuffer],
  [0x80f290, readJoypadLong],
]);

// Compatibility entry for the Matrix callback table. Execution remains explicit.
export const runObservedMatrixNmi = (a, e = null, r = MATRIX_NMI_ROUTINES) =>
  runObservedNmi(a, e, r);
// Keyed by its run function: src/matrix owns the target 81:BEC3.
NATIVE_CALL_CONTINUATIONS.set(handleMatrixNmi, {
  run: handleMatrixNmi,
  create: ({ h, events, routines }) =>
    new NativeCallContinuation(h.a, handleMatrixNmiSequence(h, events, routines)),
});
