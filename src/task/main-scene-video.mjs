import { unpackStep } from './native-unpack-body.mjs';
import { taskStop } from './plan.mjs';
import { unpackStream } from './native-unpack.mjs';
import { unpackPortrait } from './native-dialog-portrait.mjs';

import {
  CLEAR_COLOUR,
  CLEAR_COLOUR_HIGH,
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  NMITIMEN_SHADOW,
  OAM_SHADOW,
  OAM_SHADOW_HIGH,
  PALETTE_SHADOW,
  SCENE_LAYER_HIGH,
  WRAM,
} from './wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK_PAIR, WRAM_BANK } from '../constants/memory-map.mjs';
import {
  NMITIMEN,
  NMITIMEN_AUTO_JOYPAD,
  NMITIMEN_NMI_ENABLE,
  OAMADDL,
  OAMDATA,
  OBJSEL,
  DMAP0,
  BBAD0,
  A1T0L,
  A1B0,
  DAS0L,
  MDMAEN,
  VMADDL,
  VMAINC,
  VMDATAL,
  CGADD,
  M7SEL,
  M7A,
  M7B,
  M7C,
  M7D,
  M7X,
  M7Y,
  INIDISP,
  CGDATA,
  BG1SC,
  BG2SC,
  BG3SC,
  BG12NBA,
  BG34NBA,
  BG1HOFS,
  BGMODE,
  TM,
  W12SEL,
  CGADSUB,
  CGSWSEL,
  COLDATA,
  SETINI,
  WRIO,
  MEMSEL,
} from '../constants/hardware-registers.mjs';
import {
  BGMODE_BG3_PRIORITY,
  BGMODE_MODE_1,
  CGRAM_COLOURS,
  COLDATA_BLUE,
  COLDATA_GREEN,
  COLDATA_RED,
  DMAP_FIXED_SOURCE,
  DMAP_TWO_PORTS,
  INIDISP_FORCED_BLANK,
  LAYER_BG1,
  LAYER_BG2,
  LAYER_BG3,
  LAYER_OBJ,
  OAM_BYTES,
  OAM_ENTRY_BYTES,
  OAM_HIGH_TABLE_BYTES,
  OAM_LOW_TABLE_BYTES,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_IRQ_DISABLE,
} from '../constants/cpu-flags.mjs';
// Shared display initialization for 81:CDF8/C3CA. Hardware stores are requests with original PCs;
// no DMA, NMI callback or elapsed frame is executed. h operates on the one VM memory/stack.

// Scene screen registers of 81:EBE9 (src/data/scene-lists.mjs): BG1 map at 0, BG2 and BG3
// maps from the base bytes 04 and 08, character bases 24 (BG1/BG2) and 01 (BG3/BG4), OBJ
// base and size 43, mode 1 with BG3 priority, and BG1-BG3 plus OBJ on the main screen.
const SCENE_BG2SC = 4,
  SCENE_BG3SC = 8,
  SCENE_BG12NBA = 0x24,
  SCENE_BG34NBA = 1,
  SCENE_OBJSEL = 0x43,
  SCENE_BGMODE = BGMODE_MODE_1 | BGMODE_BG3_PRIORITY,
  SCENE_TM = LAYER_BG1 | LAYER_BG2 | LAYER_BG3 | LAYER_OBJ;
// 81:EB7B enables the NMI and the automatic joypad read.
const NMI_AND_JOYPAD = NMITIMEN_NMI_ENABLE | NMITIMEN_AUTO_JOYPAD;
// OAM word that puts a sprite off screen (X FF, Y F0), 81:EDB6.
const OAM_OFF_SCREEN = 0xf0ff;
// Fixed DMA source byte 81:EE4E that 81:EE22 sends across all of VRAM (scene_dma_fill).
const DMA_FILL = 0xee4e,
  DMA_FILL_BANK = 0x81;
// Register reset 81:EE4F: all WRIO outputs high, COLDATA 0 on all three components, colour
// math prevented everywhere (CGWSEL bits 4-5 = 3, src/video/ppu-frame.mjs) and FastROM.
export const WRIO_ALL_HIGH = 0xff,
  CGSWSEL_MATH_PREVENTED = 0x30,
  MEMSEL_FAST_ROM = 1;
// 81:EB97 installs the NMI callback 81:EC15 and fills CGRAM from colour 16 (wrapping) with
// the word CLEAR_COLOUR.
const SCREEN_INIT_CALLBACK = 0xec15,
  SCREEN_INIT_CALLBACK_BANK = 0x81,
  CLEAR_COLOUR_FIRST = 0x10;
// Direct page of the palette copy 81:ECF2: source pointer and bank, the colour count (low)
// and first colour (high), and the byte count.
const DP_PALETTE_SOURCE = 0x20,
  DP_PALETTE_SOURCE_BANK = 0x22,
  DP_PALETTE_COUNT = 0x0e,
  DP_PALETTE_FIRST = 0x0f,
  DP_PALETTE_BYTES = 0x10;
// Direct page of the command list interpreter 81:EC16: the list pointer and bank, the
// stream pointer and bank of command 03 and the port of command 05.
const DP_COMMANDS = 0x28,
  DP_COMMANDS_BANK = 0x2a,
  DP_STREAM = 0x24,
  DP_STREAM_BANK = 0x26,
  DP_PORT = 0x0e;
// Command table 81:EC2F (scene_list_commands) and the argument bytes of command 04.
const COMMAND_BANK = 0x810000,
  COMMAND_TABLE = 0xec2f,
  PALETTE_COMMAND_BYTES = 6;
const port = (h, pc, offset, value, bytes = 1) => h.portWrite(offset, value, bytes, pc);
const longCall = (h, pc, target, run) => h.call(pc, target, run, true);
const indexBytes = (h) => (h.xw() ? 1 : 2);

// 80:C109: install the NMI callback X (bank Y).
export function setNmiCallback(h) {
  h.php();
  h.dpWrite(NMI_CALLBACK, h.ctx.x, indexBytes(h));
  h.sep(FLAG_INDEX_8BIT);
  h.dpWrite(NMI_CALLBACK_BANK, h.ctx.y, indexBytes(h));
  h.plp();
  return h.rtl();
}
// 81:EB7B: enable the NMI and the automatic joypad read.
export function enableNmiAndJoypad(h, e) {
  const step = (pc) => unpackStep(h, e, pc);
  step(0x81eb7b);
  h.php();
  step(0x81eb7c);
  h.sep(FLAG_MEMORY_8BIT);
  step(0x81eb7e);
  h.load(h.dp(NMITIMEN_SHADOW));
  step(0x81eb80);
  h.load(h.ctx.a | NMI_AND_JOYPAD);
  step(0x81eb82);
  h.dpWrite(NMITIMEN_SHADOW, h.ctx.a);
  step(0x81eb84);
  port(h, 0x81eb84, NMITIMEN, h.ctx.a & BYTE_MASK);
  step(0x81eb87);
  h.plp();
  step(0x81eb88);
  return h.rtl();
}
// 81:EB89: write A to NMITIMEN and its shadow.
export function setNmiEnable(h) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.dp(NMITIMEN_SHADOW));
  h.load(h.ctx.a & (~NMITIMEN_NMI_ENABLE & WORD_MASK));
  h.dpWrite(NMITIMEN_SHADOW, h.ctx.a);
  port(h, 0x81eb92, NMITIMEN, h.ctx.a & BYTE_MASK);
  h.plp();
  return h.rtl();
}
// 81:EBE9: set the scene screen registers (maps, characters, OBJ, mode, main screen).
export function setSceneScreenRegisters(h) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  for (const [pc, offset, value] of [
    [0x81ebee, BG1SC, 0],
    [0x81ebf3, BG2SC, SCENE_BG2SC],
    [0x81ebf8, BG3SC, SCENE_BG3SC],
    [0x81ebfd, BG12NBA, SCENE_BG12NBA],
    [0x81ec02, BG34NBA, SCENE_BG34NBA],
    [0x81ec07, OBJSEL, SCENE_OBJSEL],
    [0x81ec0c, BGMODE, SCENE_BGMODE],
    [0x81ec11, TM, SCENE_TM],
  ]) {
    h.load(value);
    port(h, pc, offset, h.ctx.a & BYTE_MASK);
  }
  h.plp();
  return h.rtl();
}
// 81:ED8B: send the OAM buffer in WRAM to the OAM by DMA on channel 0.
export function sendOamBuffer(h) {
  h.php();
  h.rep(FLAG_INDEX_8BIT);
  h.sep(FLAG_MEMORY_8BIT);
  h.index('x', 0);
  port(h, 0x81ed93, OAMADDL, h.ctx.x, 2);
  port(h, 0x81ed96, DMAP0, 0);
  h.load(OAMDATA & BYTE_MASK);
  port(h, 0x81ed9b, BBAD0, h.ctx.a & BYTE_MASK);
  h.index('x', OAM_SHADOW);
  port(h, 0x81eda1, A1T0L, h.ctx.x, 2);
  h.load(WRAM_BANK);
  port(h, 0x81eda6, A1B0, h.ctx.a & BYTE_MASK);
  h.index('x', OAM_BYTES);
  port(h, 0x81edac, DAS0L, h.ctx.x, 2);
  h.load(1);
  port(h, 0x81edb1, MDMAEN, h.ctx.a & BYTE_MASK);
  h.plp();
  return h.rtl();
}
// 81:EDB6: hide all sprites in the OAM buffer (off-screen position) and clear the high table.
export function hideAllSprites(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', 0);
  h.load(OAM_OFF_SCREEN);
  do {
    h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
    for (let n = 0; n < OAM_ENTRY_BYTES; n++) h.index('x', ctx.x + 1);
    h.cpx(OAM_LOW_TABLE_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  do {
    h.write(h.abs(OAM_SHADOW) + ctx.x, 0);
    h.index('x', ctx.x + 1);
    h.index('x', ctx.x + 1);
    h.cpx(OAM_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.plp();
  return h.rtl();
}
// 81:EE22: clear all of VRAM by a fixed-source DMA.
export function clearVram(h) {
  h.php();
  h.rep(FLAG_MEMORY_8BIT);
  h.sep(FLAG_INDEX_8BIT);
  for (const [pc, offset, value] of [
    [0x81ee29, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
    [0x81ee2e, DMAP0, DMAP_FIXED_SOURCE | DMAP_TWO_PORTS],
    [0x81ee33, BBAD0, VMDATAL & BYTE_MASK],
  ]) {
    h.index('x', value);
    port(h, pc, offset, h.ctx.x);
  }
  h.load(DMA_FILL);
  port(h, 0x81ee39, A1T0L, h.ctx.a, 2);
  h.index('x', DMA_FILL_BANK);
  port(h, 0x81ee3e, A1B0, h.ctx.x);
  port(h, 0x81ee41, DAS0L, 0, 2);
  port(h, 0x81ee44, VMADDL, 0, 2);
  h.index('x', 1);
  port(h, 0x81ee49, MDMAEN, h.ctx.x);
  h.plp();
  return h.rtl();
}
// 81:EE4F: reset the PPU and CPU registers to their scene defaults.
export function resetPpuRegisters(h) {
  const { ctx } = h;
  h.php();
  h.sep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', 2);
  do {
    port(h, 0x81ee54, OBJSEL + ctx.x, 0);
    port(h, 0x81ee57, VMAINC + ctx.x, 0);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.index('x', BG34NBA - BGMODE);
  do {
    port(h, 0x81ee5f, BGMODE + ctx.x, 0);
    port(h, 0x81ee62, BG1HOFS + ctx.x, 0);
    port(h, 0x81ee65, BG1HOFS + ctx.x, 0);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  port(h, 0x81ee6b, CGADD, 0);
  port(h, 0x81ee6e, M7SEL, 0);
  h.load(1);
  for (const [pc, offset, value] of [
    [0x81ee73, M7A, 0],
    [0x81ee76, M7A, 1],
    [0x81ee79, M7B, 0],
    [0x81ee7c, M7B, 0],
    [0x81ee7f, M7C, 0],
    [0x81ee82, M7C, 0],
    [0x81ee85, M7D, 0],
    [0x81ee88, M7D, 1],
    [0x81ee8b, M7X, 0],
    [0x81ee8e, M7X, 0],
    [0x81ee91, M7Y, 0],
    [0x81ee94, M7Y, 0],
    [0x81ee97, SETINI, 0],
  ])
    port(h, pc, offset, value);
  h.index('x', CGADSUB - W12SEL);
  do {
    port(h, 0x81ee9c, W12SEL + ctx.x, 0);
    port(h, 0x81ee9f, NMITIMEN + ctx.x, 0);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [pc, offset, value] of [
    [0x81eea7, WRIO, WRIO_ALL_HIGH],
    [0x81eeac, COLDATA, COLDATA_RED | COLDATA_GREEN | COLDATA_BLUE],
    [0x81eeb1, CGSWSEL, CGSWSEL_MATH_PREVENTED],
    [0x81eeb6, MEMSEL, MEMSEL_FAST_ROM],
  ]) {
    h.load(value);
    port(h, pc, offset, ctx.a & BYTE_MASK);
  }
  h.plp();
  return h.rtl();
}
// 81:EB97: install the scene NMI callback and fill CGRAM from colour 16 with the clear colour.
export function installSceneNmiAndClearPalette(h) {
  const { ctx } = h;
  ctx.status |= FLAG_IRQ_DISABLE;
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(NMITIMEN_AUTO_JOYPAD);
  h.dpWrite(NMITIMEN_SHADOW, ctx.a);
  port(h, 0x81eb9f, NMITIMEN, ctx.a & BYTE_MASK);
  h.load(INIDISP_FORCED_BLANK);
  port(h, 0x81eba4, INIDISP, ctx.a & BYTE_MASK);
  longCall(h, 0x81eba7, 0x81eb89, () => setNmiEnable(h));
  h.index('x', SCREEN_INIT_CALLBACK);
  h.index('y', SCREEN_INIT_CALLBACK_BANK);
  longCall(h, 0x81ebb1, 0x80c109, () => setNmiCallback(h));
  for (const [pc, target, run] of [
    [0x81ebb5, 0x81ee4f, resetPpuRegisters],
    [0x81ebb9, 0x81ee22, clearVram],
    [0x81ebbd, 0x81edb6, hideAllSprites],
    [0x81ebc1, 0x81ed8b, sendOamBuffer],
  ])
    longCall(h, pc, target, () => run(h));
  h.load(CLEAR_COLOUR_FIRST);
  port(h, 0x81ebc7, CGADD, ctx.a & BYTE_MASK);
  h.index('x', CGRAM_COLOURS - 1);
  do {
    h.load(h.read(h.abs(CLEAR_COLOUR)));
    port(h, 0x81ebd0, CGDATA, ctx.a & BYTE_MASK);
    h.load(h.read(h.abs(CLEAR_COLOUR_HIGH)));
    port(h, 0x81ebd6, CGDATA, ctx.a & BYTE_MASK);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.write(h.abs(CLEAR_COLOUR), 0);
  h.write(h.abs(CLEAR_COLOUR_HIGH), 0);
  h.index('x', 0);
  h.dpWrite(0x2e, ctx.x, indexBytes(h)); // magic-number-ok: direct page 2E cleared here; no reader established
  h.plp();
  return h.rtl();
}

// 80:F2A0: JSR 9F4D (unpack a stream) for long callers, RTL.
export function unpackStreamForBank81(h, e) {
  h.call(0x80f2a0, 0x809f4d, () => unpackStream(h.a, false, e));
  return h.rtl();
}
// 80:F2A4: JSR 9F6D (unpack a portrait) for long callers, RTL.
export function unpackPortraitForBank81(h, e) {
  h.call(0x80f2a4, 0x809f6d, () => unpackPortrait(h, e));
  return h.rtl();
}
// Palette bytes to the actual WRAM shadow and to CGRAM. A zero low-byte count wraps through
// the entire 16-bit Y range as in the original; there is no inferred length or clipping.
// 81:ECF2: copy palette bytes to the WRAM shadow and to CGRAM.
export function copyPalette(h) {
  const { ctx } = h;
  h.php();
  h.dpWrite(DP_PALETTE_SOURCE, ctx.a);
  h.dpWrite(DP_PALETTE_SOURCE_BANK, ctx.y, indexBytes(h));
  h.dpWrite(DP_PALETTE_COUNT, ctx.x, indexBytes(h));
  h.load(h.dp(DP_PALETTE_COUNT) & BYTE_MASK);
  h.asl();
  h.dpWrite(DP_PALETTE_BYTES, ctx.a);
  h.load(h.dp(DP_PALETTE_FIRST) & BYTE_MASK);
  h.asl();
  h.index('x', ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.dp(DP_PALETTE_FIRST));
  port(h, 0x81ed0c, CGADD, ctx.a & BYTE_MASK);
  h.index('y', 0);
  do {
    for (const [pc] of [[0x81ed18], [0x81ed23]]) {
      h.load(h.read(h.indirect(DP_PALETTE_SOURCE, ctx.y)));
      h.write(WRAM + PALETTE_SHADOW + ctx.x, ctx.a);
      port(h, pc, CGDATA, ctx.a & BYTE_MASK);
      h.index('x', ctx.x + 1);
      h.index('y', ctx.y + 1);
    }
    h.cpy(h.dp(DP_PALETTE_BYTES, indexBytes(h)));
  } while (!(ctx.status & FLAG_ZERO));
  h.plp();
  return h.rtl();
}

export const SCENE_VIDEO_COMMANDS = new Map([
  [0x81ec41, (h) => h.rts()],
  [
    0x81ec42,
    (h) => {
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.dpWrite(NMI_CALLBACK, h.ctx.a);
      h.index('y', h.ctx.y + 2);
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.dpWrite(NMI_CALLBACK_BANK, h.ctx.a);
      h.index('y', h.ctx.y + 2);
      return h.rts();
    },
  ],
  [
    0x81ec4f,
    (h) => {
      h.phy();
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.index('x', h.ctx.a);
      h.index('y', h.ctx.y + 2);
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.pha();
      h.index('y', h.ctx.y + 2);
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.ply();
      longCall(h, 0x81ec5d, 0x81ecf2, () => copyPalette(h));
      h.pla();
      h.ctx.status &= ~FLAG_CARRY;
      h.adc(PALETTE_COMMAND_BYTES);
      h.index('y', h.ctx.a);
      return h.rts();
    },
  ],
  [
    0x81ec68,
    (h, e) => {
      const { ctx } = h;
      h.php();
      h.sep(FLAG_MEMORY_8BIT);
      for (const [pc, offset, v] of [
        [0x81ec6d, VMAINC, VMAINC_INCREMENT_AFTER_HIGH],
        [0x81ec72, DMAP0, DMAP_TWO_PORTS],
        [0x81ec77, BBAD0, VMDATAL & BYTE_MASK],
      ]) {
        h.load(v);
        port(h, pc, offset, ctx.a & BYTE_MASK);
      }
      h.rep(FLAG_MEMORY_8BIT);
      h.load(h.read(h.indirect(DP_COMMANDS, ctx.y)));
      port(h, 0x81ec7e, VMADDL, ctx.a, 2);
      h.index('y', ctx.y + 2);
      for (const o of [DP_STREAM, DP_STREAM_BANK]) {
        h.load(h.read(h.indirect(DP_COMMANDS, ctx.y)));
        h.dpWrite(o, ctx.a);
        h.index('y', ctx.y + 2);
      }
      h.load(h.read(h.indirect(DP_COMMANDS, ctx.y)));
      port(h, 0x81ec91, DAS0L, ctx.a, 2);
      h.index('y', ctx.y + 2);
      h.phy();
      h.load(h.dp(DP_STREAM));
      h.index('y', h.dp(DP_STREAM_BANK, indexBytes(h)));
      h.index('x', SCENE_LAYER_HIGH);
      longCall(h, 0x81ec9e, 0x80f2a0, () => unpackStreamForBank81(h, e));
      h.ply();
      h.sep(FLAG_MEMORY_8BIT);
      h.index('x', SCENE_LAYER_HIGH);
      port(h, 0x81eca8, A1T0L, ctx.x, 2);
      h.load(WRAM_BANK);
      port(h, 0x81ecad, A1B0, ctx.a & BYTE_MASK);
      h.load(1);
      port(h, 0x81ecb2, MDMAEN, ctx.a & BYTE_MASK);
      h.plp();
      return h.rts();
    },
  ],
  [
    0x81ecb7,
    (h) => {
      h.phb();
      h.push(CODE_BANK_PAIR, 2);
      h.plb();
      h.plb();
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.dpWrite(DP_PORT, h.ctx.a);
      h.index('y', h.ctx.y + 2);
      // STA ($0E) also targets PPU ports in the original notice data. Route
      // through the bus accessor with the actual two-byte instruction PC.
      h.sep(FLAG_MEMORY_8BIT);
      h.load(h.read(h.indirect(DP_COMMANDS, h.ctx.y)));
      h.portWrite(h.dp(DP_PORT, 2), h.ctx.a & BYTE_MASK, 1, 0x81ecc7);
      h.rep(FLAG_MEMORY_8BIT);
      h.index('y', h.ctx.y + 1);
      h.plb();
      return h.rts();
    },
  ],
  ...[0x81ecce, 0x81eccf, 0x81ecd0].map((t) => [t, (h) => h.rts()]),
]);
// EC16 is an original data-command interpreter, not a CPU interpreter. Only source-proved
// handler targets are admitted; a changed or unknown table target names an explicit frontier.
// 81:EC16: run a scene command list.
export function interpretSceneList(h, e) {
  const { ctx } = h;
  h.php();
  h.dpWrite(DP_COMMANDS, ctx.x, indexBytes(h));
  h.dpWrite(DP_COMMANDS_BANK, ctx.y, indexBytes(h));
  h.index('y', 0);
  for (;;) {
    h.load(h.read(h.indirect(DP_COMMANDS, ctx.y)));
    h.load(ctx.a & BYTE_MASK);
    if (ctx.status & FLAG_ZERO) {
      h.plp();
      return h.rtl();
    }
    h.asl();
    h.index('x', ctx.a);
    h.index('y', ctx.y + 1);
    const target = COMMAND_BANK | h.read(COMMAND_BANK | ((COMMAND_TABLE + ctx.x) & WORD_MASK), 2),
      run = SCENE_VIDEO_COMMANDS.get(target);
    if (!run) taskStop('main_scene_command_frontier', { target, commandIndex: ctx.x });
    h.call(0x81ec28, target, () => run(h, e));
  }
}
// 81:EDD7: clear the OAM high table in the buffer.
export function clearOamHighTable(h) {
  h.php();
  h.rep(FLAG_MEMORY_8BIT);
  for (let at = OAM_SHADOW_HIGH; at <= OAM_SHADOW_HIGH + OAM_HIGH_TABLE_BYTES - 2; at += 2)
    h.write(h.abs(at), 0);
  h.plp();
  return h.rtl();
}
// 81:EE0C: hide the sprites from the OAM write offset (DP2C) to the end of the low table.
const DP_OAM_OFFSET = 0x2c,
  OAM_HIDDEN = 0xf0ff;
export function hideRemainingSprites(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.index('x', h.dp(DP_OAM_OFFSET, 2));
  h.load(OAM_HIDDEN);
  do {
    h.write(h.abs(OAM_SHADOW) + ctx.x, ctx.a);
    for (let n = 0; n < OAM_ENTRY_BYTES; n++) h.index('x', ctx.x + 1);
    h.cpx(OAM_LOW_TABLE_BYTES);
  } while (!(ctx.status & FLAG_ZERO));
  h.plp();
  return h.rtl();
}
