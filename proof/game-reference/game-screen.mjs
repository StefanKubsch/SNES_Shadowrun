// Register-level reference of the game screen set-up 80:9629 (moved from
// src/task/main-initialize.mjs; lifted in src/game/game-screen.mjs). Its callees stay
// register-level in src/task/main-initialize.mjs, where other callers use them.
import { MAIN_INITIALIZE_ROUTINES } from '../../src/task/main-initialize.mjs';
import { routineCaller } from '../../src/task/routine-call.mjs';
import { unpackStep } from '../../src/task/native-unpack-body.mjs';
import { TM_SHADOW } from '../../src/task/wram.mjs';
import {
  BG3HOFS,
  BG3VOFS,
  HDMAEN,
  MEMSEL,
  NMITIMEN,
  NMITIMEN_AUTO_JOYPAD,
  NMITIMEN_NMI_ENABLE,
} from '../../src/constants/hardware-registers.mjs';
import { LAYER_BG1, LAYER_BG2, LAYER_OBJ } from '../../src/constants/ppu.mjs';
import { FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
import { BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';

const callFor = (h, e, r) => routineCaller(h, e, r, true);
const ports = (h, rows) => {
  for (const [pc, offset, value] of rows) {
    h.load(value);
    h.portWrite(offset, h.ctx.a & (h.m() ? BYTE_MASK : WORD_MASK), h.m() ? 1 : 2, pc);
  }
};
const sourceBank = (source) => source >>> WORD_BITS,
  sourceOffset = (source) => source & WORD_MASK;
// The game NMI handler installed by 80:C109 and the game's main screen layers.
const GAME_NMI = 0x80c152,
  GAME_LAYERS = LAYER_BG1 | LAYER_BG2 | LAYER_OBJ;

// 80:9629: initialize the game screen: registers, VRAM, palettes, windows and objects.
export function initializeGameScreen(h, e, r = MAIN_INITIALIZE_ROUTINES) {
  const { ctx } = h,
    call = callFor(h, e, r);
  h.sep(FLAG_MEMORY_8BIT);
  ports(h, [[0x80962d, MEMSEL, 1]]);
  h.portWrite(NMITIMEN, 0, 1, 0x809630);
  h.portWrite(HDMAEN, 0, 1, 0x809633);
  h.rep(FLAG_MEMORY_8BIT);
  for (const [pc, target, long] of [
    [0x809638, 0x81b064, true],
    [0x80963c, 0x808fb3, false],
    [0x80963f, 0x80bc1a, false],
    [0x809642, 0x81891a, true],
    [0x809646, 0x818cb9, true],
    [0x80964a, 0x81a840, true],
    [0x80964e, 0x81a772, true],
    [0x809652, 0x81ab2c, true],
    [0x809656, 0x80c1a6, false],
    [0x809659, 0x80cc44, false],
    [0x80965c, 0x80e41b, false],
    [0x80965f, 0x81ef26, true],
  ])
    call(pc, target, long);
  h.index('x', sourceOffset(GAME_NMI));
  h.index('y', sourceBank(GAME_NMI));
  call(0x809669, 0x80c109);
  const step = (pc) => unpackStep(h, e, pc);
  step(0x80966d);
  h.sep(FLAG_MEMORY_8BIT);
  step(0x80966f);
  h.load(NMITIMEN_NMI_ENABLE | NMITIMEN_AUTO_JOYPAD);
  step(0x809671);
  h.portWrite(NMITIMEN, ctx.a & BYTE_MASK, 1, 0x809671);
  step(0x809674);
  h.load(GAME_LAYERS);
  step(0x809676);
  h.testBits(h.abs(TM_SHADOW), true);
  for (const [pc, offset] of [
    [0x809679, BG3VOFS],
    [0x80967c, BG3VOFS],
    [0x80967f, BG3HOFS],
    [0x809682, BG3HOFS],
  ]) {
    step(pc);
    h.portWrite(offset, 0, 1, pc);
  }
  step(0x809685);
  h.rep(FLAG_MEMORY_8BIT);
  step(0x809687);
  return h.rts();
}

export const GAME_SCREEN_REFERENCE_ENTRIES = [[0x809629, initializeGameScreen]];
// A copy of a routine table with this reference.
export const withGameScreenReference = (table) =>
  new Map([...table, ...GAME_SCREEN_REFERENCE_ENTRIES]);
