// Register-level dialog portrait routines no longer run by the game (lifted in
// src/game/portrait-window.mjs, portrait-upload.mjs, dialog-talk.mjs and
// fixed-colour.mjs); the dialog references and comparisons call them.
import {
  FIXED_COLOUR_BLACK,
  DP_PIXEL_WIDTH,
  PORTRAIT_BUFFER,
  SECOND_PORTRAIT_PALETTE,
  SECOND_PORTRAIT_VRAM,
  SECOND_PORTRAIT_HDMA,
  PORTRAIT_WINDOW,
  waitWord,
} from '../../src/system/native-dialog-portrait.mjs';
import { waitForRandomStateChange } from '../../src/system/native-frame-wait.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../../src/constants/ppu.mjs';
import { BYTE_SIGN, BYTE_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { WRAM_HIGH_BANK, WRAM_BANK } from '../../src/constants/memory-map.mjs';
import {
  WRAM,
  WINDOW_LEFT_PIXEL,
  WINDOW_COLUMNS,
  WINDOW_WIDTH_PIXELS,
  PORTRAIT_PALETTE_START,
  OAM_HIGH_TABLE,
  DIALOG_RECORD_FLAGS,
  NMI_JOB_LISTS,
  LEFT_WINDOW_RIGHT_EDGE,
  RIGHT_WINDOW_RIGHT_EDGE,
  LEFT_WINDOW_LEFT_EDGE,
  RIGHT_WINDOW_LEFT_EDGE,
  DIALOG_HDMA_TABLE,
  HDMAEN_SHADOW,
  TMW_SHADOW,
  PORTRAIT_DMA_REQUEST,
} from '../../src/data/wram.mjs';
import {
  COLDATA,
  CGADSUB,
  W12SEL,
  WBGLOG,
  A1T0L,
  DMAP0,
  BBAD0,
  A1B0,
  DAS0L,
  VMAINC,
  VMDATAL,
} from '../../src/constants/hardware-registers.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';

// Offset of the last byte of the dialog HDMA table.
const DIALOG_HDMA_LAST_BYTE = 0x0f;
// CGRAM start of the first portrait palette.
const FIRST_PORTRAIT_PALETTE = 0x91;
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
// 8F20 moves seven 100-byte portrait rows up by 100 with MVP in bank 7F.
const PORTRAIT_ROW_SHIFT = Object.freeze({
  sourceEnd: 0x5a4f,
  destinationEnd: 0x624f,
  sourceStop: 0x534f,
  rowBytes: 0x100,
});
// 8FF5 uploads 1000 bytes in DMA mode 1 to VMDATAL/VMDATAH.
const PORTRAIT_UPLOAD_BYTES = 0x1000,
  PORTRAIT_UPLOAD_MODE = 1,
  PORTRAIT_UPLOAD_TARGET = VMDATAL & BYTE_MASK;
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
export function runWindowEdges(h) {
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
