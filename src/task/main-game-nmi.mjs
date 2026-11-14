import { runObservedNmi } from './observed-nmi.mjs';
import { clearTextTiles } from './main-initialize.mjs';
import { uploadMapEdgesAndScroll } from './main-transition.mjs';
import { readJoypad } from './main-scene-wait.mjs';
import { NativeWaitContinuation } from './native-wait-continuation.mjs';
import { DP_PORTRAIT_BANK, DP_PORTRAIT_POINTER } from './native-dialog-portrait.mjs';
import { GLOVE_KIND_CROSSHAIR, GLOVE_KIND_SPELL } from './native-glove-crosshair-limits.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';

import {
  BRIGHTNESS_FADE,
  BRIGHTNESS_FADE_FRAMES,
  DP_VRAM_UPLOAD_INDEX,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  GLOVE_SCREEN_X,
  GLOVE_SCREEN_Y,
  HDMAEN_SHADOW,
  INIDISP_SHADOW,
  MAP_UPLOAD_HELD,
  NMI_JOB_LISTS,
  OAM_BUFFER,
  PALETTE_BYTES,
  PALETTE_DIRECTION,
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_UPLOAD_LIST,
  PALETTE_UPLOAD_LIST_BYTES,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
  SCENE_BACKDROP,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_LIST,
  SCENE_PALETTE_UPLOAD,
  TM_SHADOW,
  TMW_SHADOW,
  TS_SHADOW,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_BYTES,
  VRAM_UPLOAD_SOURCES,
} from './wram.mjs';
import { CYCLE_TABLE } from '../data/palette-cycles.mjs';
import {
  INIDISP,
  TM,
  TS,
  TMW,
  HDMAEN,
  A1T4L,
  A1B4,
  DAS4L,
  CGADD,
  CGDATA,
  DMAP0,
  BBAD0,
  A1T0L,
  A1B0,
  DAS0L,
  A1T1L,
  A1B1,
  DAS1L,
  DMAP1,
  A1T2L,
  DAS2L,
  DMAP2,
  DMAP4,
  DMA_CHANNEL_STRIDE,
  MDMAEN,
  VMADDL,
  VMAINC,
  VMDATAL,
  OAMADDL,
  OAMDATA,
} from '../constants/hardware-registers.mjs';
import {
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  INIDISP_BRIGHTNESS_MASK,
  INIDISP_FORCED_BLANK,
  MAX_BRIGHTNESS,
  OAM_BYTES,
  OAM_PRIORITY_3,
  OAMADDH_PRIORITY_ROTATION,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import { FLAG_MEMORY_8BIT, FLAG_ZERO, FLAG_NEGATIVE, FLAG_CARRY } from '../constants/cpu-flags.mjs';
import { BYTE_BITS, BYTE_MASK, NIBBLE_BITS, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
// C152 and its original callback graph on the shared VM memory. Port stores
// are requests; reads require chronological observations. Channel-5 readback
// can consume explicit transfer bytes in A9E1; no automatic DMA or clock.
const ports = (h, rows) => {
  for (const [pc, offset, value] of rows) {
    h.load(value);
    h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
  }
};
const down = (h, name) => {
  h.index(name, h.ctx[name] - 1);
  h.index(name, h.ctx[name] - 1);
};
// MDMAEN bit of the DMA channel whose DMAPx register is given.
const channel = (dmap) => 1 << ((dmap - DMAP0) / DMA_CHANNEL_STRIDE);
const sourceBank = (source) => source >>> WORD_BITS,
  sourceOffset = (source) => source & WORD_MASK;
// Value written to mark the portrait request as sent (negative).
const NONE = WORD_MASK;
// Palettes sent to CGRAM (src/data/palettes.mjs): 15 colours from colour 1 of a slot, the
// scene palettes (32 bytes each) to the BG slots 1 to n, the object palettes (16 bytes each)
// to the OBJ slots from CGRAM 128; a palette cycle step (bank 8B) from its first colour.
const SCENE_PALETTES = 0x8cf624,
  SCENE_PALETTE_SHIFT = 5,
  OBJECT_PALETTES = 0x8df1ba,
  OBJECT_PALETTE_SHIFT = NIBBLE_BITS,
  PALETTE_COLOURS_BYTES = 0x1e,
  OBJ_FIRST_COLOUR = 0x81,
  CYCLE_BANK = CYCLE_TABLE >>> WORD_BITS;
// The colours of a portrait follow 3 bytes after its pointer (80:8FBA).
const PORTRAIT_COLOURS_OFFSET = 3;
// Glove graphics (bank 8D): one picture per glove kind, sent as two 0x40-byte halves to the
// OBJ characters 0 and 0x10 (VRAM words 0 and 100); the glove is OAM entry 0.
const GLOVE_CROSSHAIR_PICTURE = 0x8dfb78,
  GLOVE_ACTION_PICTURE = 0x8dfbf8,
  GLOVE_SPELL_PICTURE = 0x8dfc78,
  GLOVE_HALF_BYTES = 0x40,
  GLOVE_LOWER_VRAM = 0x100,
  HIDDEN_Y = 0xf0;

// 80:C152: the game NMI handler with its callbacks.
export function handleGameNmi(h, e, r = GAME_NMI_ROUTINES) {
  return drainNativeSequence(gameNmiSequence(h, e, r));
}
function* gameNmiSequence(h, e, r) {
  const { ctx } = h;
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x80c156, INIDISP, INIDISP_FORCED_BLANK]]);
    h.rep(FLAG_MEMORY_8BIT);
  };
  for (const [pc, target, long] of [
    [0x80c15b, 0x818949, true],
    [0x80c15f, 0x81a9e1, true],
    [0x80c163, 0x80999a, false],
    [0x80c166, 0x8180c4, true],
    [0x80c16a, 0x81a919, true],
    [0x80c16e, 0x81a958, true],
    [0x80c172, 0x81a98e, true],
    [0x80c176, 0x808fba, false],
    [0x80c179, 0x809e0b, false],
    [0x80c17c, 0x80c06b, false],
    [0x80c17f, 0x81b0d1, true],
  ]) {
    yield* nativeCallSequence(h, e, r, pc, target, long);
  }
  let result;
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    for (const [source, port, pc] of [
      [INIDISP_SHADOW, INIDISP, 0x80c188],
      [TM_SHADOW, TM, 0x80c18e],
      [TS_SHADOW, TS, 0x80c194],
      [TMW_SHADOW, TMW, 0x80c19a],
      [HDMAEN_SHADOW, HDMAEN, 0x80c1a0],
    ]) {
      h.load(h.read(h.abs(source)));
      h.portWrite(port, ctx.a & BYTE_MASK, 1, pc);
    }
    h.rep(FLAG_MEMORY_8BIT);
    result = h.rtl();
  };
  return result;
}
// Original routine $81:8949.
function uploadReadyMapEdges(h) {
  h.load(h.read(h.abs(MAP_UPLOAD_HELD)));
  if (!(h.ctx.status & FLAG_ZERO)) return h.rtl();
  h.load(h.read(h.abs(NMI_JOB_LISTS)));
  if (h.ctx.status & FLAG_ZERO) return h.rtl();
  return uploadMapEdgesAndScroll(h);
}
// 80:999A: the scene palettes to the BG palette slots 1 to n, then the backdrop colour.
function uploadScenePalettes(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(SCENE_PALETTE_UPLOAD)));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.load(h.read(h.abs(SCENE_PALETTE_COUNT)));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.asl();
  h.index('y', ctx.a);
  do {
    h.load(h.read(h.abs(SCENE_PALETTE_LIST) + ctx.y));
    for (let n = 0; n < SCENE_PALETTE_SHIFT; n++) h.asl();
    h.adc(sourceOffset(SCENE_PALETTES));
    h.portWrite(A1T4L, ctx.a, 2, 0x8099b1);
    ports(h, [[0x8099b7, DAS4L, PALETTE_COLOURS_BYTES]]);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(ctx.y);
    h.asl();
    h.asl();
    h.asl();
    h.load(ctx.a + 1);
    h.portWrite(CGADD, ctx.a & BYTE_MASK, 1, 0x8099c1);
    ports(h, [
      [0x8099c6, A1B4, sourceBank(SCENE_PALETTES)],
      [0x8099cb, MDMAEN, channel(DMAP4)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    down(h, 'y');
  } while (!(ctx.status & FLAG_ZERO));
  h.sep(FLAG_MEMORY_8BIT);
  h.portWrite(CGADD, 0, 1, 0x8099d6);
  for (const [source, pc] of [
    [SCENE_BACKDROP, 0x8099dc],
    [SCENE_BACKDROP + 1, 0x8099e2],
  ]) {
    h.load(h.read(h.abs(source)));
    h.portWrite(CGDATA, ctx.a & BYTE_MASK, 1, pc);
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(SCENE_PALETTE_UPLOAD), 0);
  return h.rts();
}
// 81:80C4: send the requested palette cycle step.
function uploadPaletteCycleStep(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(PALETTE_REQUEST_POINTER)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.portWrite(A1T0L, ctx.a, 2, 0x8180c9);
  h.load(h.read(h.abs(PALETTE_REQUEST_SLOT)));
  h.index('x', ctx.a);
  h.load(h.read(h.abs(PALETTE_BYTES)));
  h.portWrite(DAS0L, ctx.a, 2, 0x8180d3);
  // One word to DMAP0 and BBAD0: one port, CGDATA.
  ports(h, [[0x8180d9, DMAP0, ((CGDATA & BYTE_MASK) << BYTE_BITS) | DMAP_ONE_PORT]]);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(PALETTE_DIRECTION) + ctx.x));
  h.portWrite(CGADD, ctx.a & BYTE_MASK, 1, 0x8180e1);
  ports(h, [
    [0x8180e6, A1B0, CYCLE_BANK],
    [0x8180eb, MDMAEN, channel(DMAP0)],
  ]);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(0);
  h.write(h.abs(PALETTE_REQUEST_POINTER), ctx.a);
  return h.rtl();
}
// 81:A919: the object palettes of the upload list to their OBJ palette slots.
function uploadObjectPalettes(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(NMI_JOB_LISTS)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.index('y', h.read(h.abs(PALETTE_UPLOAD_LIST_BYTES), 2));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  down(h, 'y');
  do {
    h.load(h.read(h.abs(PALETTE_UPLOAD_LIST) + ctx.y));
    for (let n = 0; n < OBJECT_PALETTE_SHIFT; n++) h.asl();
    h.adc(sourceOffset(OBJECT_PALETTES));
    h.portWrite(A1T4L, ctx.a, 2, 0x81a92f);
    ports(h, [[0x81a935, DAS4L, PALETTE_COLOURS_BYTES]]);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(ctx.y);
    h.asl();
    h.asl();
    h.asl();
    h.adc(OBJ_FIRST_COLOUR);
    h.portWrite(CGADD, ctx.a & BYTE_MASK, 1, 0x81a940);
    ports(h, [
      [0x81a945, A1B4, sourceBank(OBJECT_PALETTES)],
      [0x81a94a, MDMAEN, channel(DMAP4)],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    down(h, 'y');
  } while (!(ctx.status & FLAG_NEGATIVE));
  return h.rtl();
}
// 81:A958: the VRAM upload records, from the last down to the first.
function uploadVramRecords(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(NMI_JOB_LISTS)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.index('x', h.dp(DP_VRAM_UPLOAD_INDEX, 2));
  if (ctx.status & FLAG_NEGATIVE) return h.rtl();
  do {
    h.load(h.read(h.abs(VRAM_UPLOAD_SOURCES) + ctx.x));
    h.portWrite(A1T1L, ctx.a, 2, 0x81a964);
    ports(h, [[0x81a96a, DAS1L, VRAM_UPLOAD_BYTES]]);
    h.load(h.read(h.abs(VRAM_UPLOAD_ADDRESSES) + ctx.x));
    h.portWrite(VMADDL, ctx.a, 2, 0x81a970);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x81a977, VMAINC, VMAINC_INCREMENT_AFTER_HIGH]]);
    h.load(h.read(h.abs(VRAM_UPLOAD_BANKS) + ctx.x));
    h.portWrite(A1B1, ctx.a & BYTE_MASK, 1, 0x81a97d);
    ports(h, [[0x81a982, MDMAEN, channel(DMAP1)]]);
    h.rep(FLAG_MEMORY_8BIT);
    down(h, 'x');
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.dpWrite(DP_VRAM_UPLOAD_INDEX, ctx.x, 2);
  return h.rtl();
}
// 81:A98E: the OAM buffer to the OAM (OAMADDL word with the priority rotation bit).
function uploadOam(h) {
  h.load(h.read(h.abs(NMI_JOB_LISTS)));
  if (h.ctx.status & FLAG_ZERO) return h.rtl();
  ports(h, [
    [0x81a996, A1T2L, OAM_BUFFER],
    [0x81a99c, DAS2L, OAM_BYTES],
    [0x81a9a2, OAMADDL, OAMADDH_PRIORITY_ROTATION << BYTE_BITS],
  ]);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [[0x81a9a9, MDMAEN, channel(DMAP2)]]);
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(NMI_JOB_LISTS), 0);
  return h.rtl();
}
// 80:8FBA: the requested portrait characters (channel 0, set up by the portrait code)
// and its colours.
function uploadPortraitGraphics(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(PORTRAIT_DMA_REQUEST)));
  if (ctx.status & FLAG_NEGATIVE) return h.rts();
  h.portWrite(VMADDL, ctx.a, 2, 0x808fbf);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [[0x808fc6, MDMAEN, channel(DMAP0)]]);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.dp(DP_PORTRAIT_POINTER));
  ctx.status &= ~FLAG_CARRY;
  h.adc(PORTRAIT_COLOURS_OFFSET);
  h.portWrite(A1T4L, ctx.a, 2, 0x808fd1);
  ports(h, [[0x808fd7, DAS4L, PALETTE_COLOURS_BYTES]]);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(PORTRAIT_PALETTE_START)));
  h.portWrite(CGADD, ctx.a & BYTE_MASK, 1, 0x808fdf);
  h.load(h.dp(DP_PORTRAIT_BANK));
  h.portWrite(A1B4, ctx.a & BYTE_MASK, 1, 0x808fe4);
  ports(h, [[0x808fe9, MDMAEN, channel(DMAP4)]]);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(NONE);
  h.write(h.abs(PORTRAIT_DMA_REQUEST), ctx.a);
  return h.rts();
}
// 80:C06B: after a glove change the picture of the new kind, then the glove as OAM entry 0
// (hidden when no glove is shown).
function uploadGlove(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(GLOVE_LIMIT_KIND)));
  if (!(ctx.status & FLAG_ZERO)) {
    h.cmp(GLOVE_KIND_CROSSHAIR);
    if (ctx.status & FLAG_ZERO) h.load(sourceOffset(GLOVE_CROSSHAIR_PICTURE));
    else {
      h.cmp(GLOVE_KIND_SPELL);
      h.load(
        ctx.status & FLAG_ZERO
          ? sourceOffset(GLOVE_SPELL_PICTURE)
          : sourceOffset(GLOVE_ACTION_PICTURE),
      );
    }
    h.portWrite(A1T0L, ctx.a, 2, 0x80c087);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x80c08e, A1B0, sourceBank(GLOVE_ACTION_PICTURE)],
      [0x80c093, BBAD0, VMDATAL & BYTE_MASK],
      [0x80c098, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
      [0x80c09d, DMAP0, DMAP_TWO_PORTS],
    ]);
    h.rep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x80c0a5, VMADDL, 0],
      [0x80c0ab, DAS0L, GLOVE_HALF_BYTES],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x80c0b2, MDMAEN, channel(DMAP0)]]);
    h.rep(FLAG_MEMORY_8BIT);
    ports(h, [
      [0x80c0ba, VMADDL, GLOVE_LOWER_VRAM],
      [0x80c0c0, DAS0L, GLOVE_HALF_BYTES],
    ]);
    h.sep(FLAG_MEMORY_8BIT);
    ports(h, [[0x80c0c7, MDMAEN, channel(DMAP0)]]);
    h.rep(FLAG_MEMORY_8BIT);
    h.write(h.abs(GLOVE_LIMIT_KIND), 0);
  }
  h.portWrite(OAMADDL, 0, 2, 0x80c0cf);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(GLOVE_SCREEN_X)));
  h.portWrite(OAMDATA, ctx.a & BYTE_MASK, 1, 0x80c0d7);
  h.index('x', h.read(h.abs(GLOVE_KIND), 2));
  if (ctx.status & FLAG_ZERO) {
    h.load(HIDDEN_Y);
    h.portWrite(OAMDATA, ctx.a & BYTE_MASK, 1, 0x80c0e1);
  } else {
    h.load(h.read(h.abs(GLOVE_SCREEN_Y)));
    h.portWrite(OAMDATA, ctx.a & BYTE_MASK, 1, 0x80c0e9);
    h.portWrite(OAMDATA, 0, 1, 0x80c0ec);
    ports(h, [[0x80c0f1, OAMDATA, OAM_PRIORITY_3]]);
  }
  h.rep(FLAG_MEMORY_8BIT);
  return h.rts();
}
// 81:B0D1: one brightness step of the fade every BRIGHTNESS_FADE_FRAMES frames; the fade
// ends at brightness 0 (out) or 15 (in, forced blank off).
function stepBrightnessFade(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(BRIGHTNESS_FADE)));
  if (ctx.status & FLAG_ZERO) return h.rtl();
  h.modify(h.abs(BRIGHTNESS_FADE_FRAMES), 'dec');
  if (!(ctx.status & FLAG_ZERO)) return h.rtl();
  h.load(h.read(h.abs(BRIGHTNESS_FADE)));
  if (ctx.status & FLAG_NEGATIVE) {
    h.load(ctx.a ^ WORD_MASK);
    h.load(ctx.a + 1);
    h.write(h.abs(BRIGHTNESS_FADE_FRAMES), ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.abs(INIDISP_SHADOW)));
    h.load(ctx.a & INIDISP_BRIGHTNESS_MASK);
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(h.abs(INIDISP_SHADOW)));
      h.load(ctx.a - 1);
      h.write(h.abs(INIDISP_SHADOW), ctx.a);
      h.rep(FLAG_MEMORY_8BIT);
      return h.rtl();
    }
  } else {
    h.write(h.abs(BRIGHTNESS_FADE_FRAMES), ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.abs(INIDISP_SHADOW)));
    h.load(ctx.a & INIDISP_BRIGHTNESS_MASK);
    h.cmp(MAX_BRIGHTNESS);
    if (!(ctx.status & FLAG_ZERO)) {
      h.load(h.read(h.abs(INIDISP_SHADOW)));
      h.load(ctx.a + 1);
      h.load(ctx.a & (~INIDISP_FORCED_BLANK & BYTE_MASK));
      h.write(h.abs(INIDISP_SHADOW), ctx.a);
      h.rep(FLAG_MEMORY_8BIT);
      return h.rtl();
    }
  }
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(BRIGHTNESS_FADE), 0);
  return h.rtl();
}
export const GAME_NMI_ROUTINES = new Map([
  [0x80c152, handleGameNmi],
  [0x818949, uploadReadyMapEdges],
  [0x818954, uploadMapEdgesAndScroll],
  [0x81a9e1, clearTextTiles],
  [0x80999a, uploadScenePalettes],
  [0x8180c4, uploadPaletteCycleStep],
  [0x81a919, uploadObjectPalettes],
  [0x81a958, uploadVramRecords],
  [0x81a98e, uploadOam],
  [0x808fba, uploadPortraitGraphics],
  [0x809e0b, readJoypad],
  [0x80c06b, uploadGlove],
  [0x81b0d1, stepBrightnessFade],
]);
export const runObservedGameNmi = (a, e = null, r = GAME_NMI_ROUTINES) => runObservedNmi(a, e, r);

// C152 is the admitted outer owner of the nested 9E0B wait. Other callbacks
// keep their existing synchronous contracts until their callers are segmented.
export const GAME_NMI_CONTINUATIONS = new Map([
  [
    0x80c152,
    {
      run: handleGameNmi,
      create: ({ h, events, routines }) =>
        new NativeCallContinuation(
          h.a,
          gameNmiSequence(h, events, routines),
          GAME_NMI_CONTINUATIONS,
        ),
    },
  ],
  [0x809e0b, { run: readJoypad, create: ({ h }) => new NativeWaitContinuation(h.a, 0x809e0b) }],
]);
for (const [target, factory] of GAME_NMI_CONTINUATIONS)
  NATIVE_CALL_CONTINUATIONS.set(target, factory);
