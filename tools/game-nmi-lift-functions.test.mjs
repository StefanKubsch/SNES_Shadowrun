// Random per-function tests of the lifted jobs of the game NMI handler 80:C152
// (src/game/game-nmi.mjs) against the register-level jobs (GAME_NMI_ROUTINES in
// src/task/main-game-nmi.mjs; docs/MAIN-LOOP-LIFT.md). Both sides must leave the same
// WRAM, the same device writes and the registers the handler keeps (S, PC, program
// bank, 16-bit modes); the handler restores the others.
import { prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { GAME_NMI_ROUTINES } from '../src/task/main-game-nmi.mjs';
import { GAME_NMI_LIFTED_ROUTINES } from '../src/game/game-nmi.mjs';
import {
  BRIGHTNESS_FADE,
  BRIGHTNESS_FADE_FRAMES,
  DP_VRAM_UPLOAD_INDEX,
  GLOVE_KIND,
  GLOVE_LIMIT_KIND,
  INIDISP_SHADOW,
  MAP_COLUMN_UPLOAD,
  MAP_ROW_UPLOAD,
  MAP_UPLOAD_HELD,
  NMI_JOB_LISTS,
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_UPLOAD_LIST_BYTES,
  PORTRAIT_DMA_REQUEST,
  SCENE_PALETTE_COUNT,
  SCENE_PALETTE_UPLOAD,
  TEXT_BUFFER_READBACK,
  TEXT_BUFFER_UPLOAD,
  TEXT_MAP_UPLOAD,
  TEXT_TILE_UPLOAD,
  TEXT_TILE_UPLOAD_BYTES,
} from '../src/task/wram.mjs';

const WRAM_BYTES = 0x20000,
  HEX = 16,
  STATUS_MODES = 0x30,
  // The NMI stack of the handler (7E:1C7C-1CBB).
  NMI_STACK = 0x1cb0,
  // The jobs' frames, which the register-level handler pushes below the caller's return
  // on the NMI stack (from 7E:1C7C) and the lifted one does not.
  IGNORED = [[0x1c7c, NMI_STACK - 2]];

const setWord = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = (value >>> 8) & 0xff;
};
function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  // Job lists closed or open; fades off, in or out, at their last frame or not, with
  // brightness 0, 15 or between and the forced blank set or clear.
  if (rnd(3) === 0) setWord(wram, NMI_JOB_LISTS, 0);
  setWord(wram, BRIGHTNESS_FADE, pick([0, 1, 2, 4, 0xffff, 0xfffc, 0x8000, rnd(0x10000)]));
  setWord(wram, BRIGHTNESS_FADE_FRAMES, pick([1, 1, 1, 0, 2, rnd(0x10000)]));
  wram[INIDISP_SHADOW] = pick([0, 0x80, 0x0f, 0x8f, 0x07, 0x88, rnd(256)]);
  // Palette lists of 0 to 8 entries (an odd byte count now and then, or a long one up to
  // the list index 20 whose colour gets the shift's carry); VRAM records 0 to 64, none
  // (negative) or an odd index. The palette numbers are random words (bit 12 carries).
  setWord(
    wram,
    PALETTE_UPLOAD_LIST_BYTES,
    pick([
      0,
      0,
      2 * (1 + rnd(8)),
      2 * (1 + rnd(8)),
      2 * (1 + rnd(8)),
      2 * (1 + rnd(8)),
      2 * rnd(24),
      2 * rnd(24),
      pick([1 + 2 * rnd(4), 0x8002]),
    ]),
  );
  setWord(
    wram,
    DP_VRAM_UPLOAD_INDEX,
    pick([0, 2 * rnd(64), 2 * rnd(64), 0xfffe, 0xffff, 2 * rnd(64) + 1]),
  );
  // Scene palettes requested or not, 0 to 15 of them (now and then up to 47, whose
  // colour index wraps, or 8000, whose doubled count is 0 and runs the list through FFFE
  // past 2000); palette cycle steps requested or not, slots in the game's range or up to
  // 400.
  if (rnd(3) === 0) setWord(wram, SCENE_PALETTE_UPLOAD, 0);
  setWord(
    wram,
    SCENE_PALETTE_COUNT,
    pick([
      0,
      1 + rnd(8),
      1 + rnd(8),
      1 + rnd(15),
      1 + rnd(15),
      rnd(48),
      rnd(48),
      pick([0x8000, 1]),
    ]),
  );
  if (rnd(3) === 0) setWord(wram, PALETTE_REQUEST_POINTER, 0);
  setWord(wram, PALETTE_REQUEST_SLOT, pick([0, 2 * rnd(8), 2 * rnd(8), rnd(0x400)]));
  // Portrait requests sent (negative) or waiting; glove changes to the crosshair, the
  // spell or the action glove, or another kind, or none; a glove shown or not.
  if (rnd(2)) wram[PORTRAIT_DMA_REQUEST + 1] |= 0x80;
  else wram[PORTRAIT_DMA_REQUEST + 1] &= 0x7f;
  setWord(wram, GLOVE_LIMIT_KIND, pick([0, 0, 0xfffe, 0xfffd, 0xffff, rnd(0x10000)]));
  setWord(wram, GLOVE_KIND, pick([0, 0xffff, 0xfffd, 0xfffe, rnd(0x10000)]));
  // Map uploads held or not, a column, a row, both or none marked; text requests each
  // set or clear, tile clears below, at and above one chunk (1400 bytes).
  if (rnd(4)) setWord(wram, MAP_UPLOAD_HELD, 0);
  for (const at of [MAP_COLUMN_UPLOAD, MAP_ROW_UPLOAD]) if (rnd(2)) setWord(wram, at, 0);
  for (const at of [TEXT_TILE_UPLOAD, TEXT_MAP_UPLOAD, TEXT_BUFFER_UPLOAD, TEXT_BUFFER_READBACK])
    if (rnd(2)) setWord(wram, at, 0);
  setWord(
    wram,
    TEXT_TILE_UPLOAD_BYTES,
    pick([0x1400, 0x1401, 0x13ff, 0x2800, 0x200, 0, rnd(0x10000)]),
  );
  return { seed, wram, rnd, pick };
}
const side = (s) => createSide(s, GAME_NMI_ROUTINES);
const registers = (h) =>
  ['s', 'pc', 'programBank'].map((r) => h.ctx[r].toString(HEX)).join() +
  ',' +
  (h.ctx.status & STATUS_MODES).toString(HEX);

// A job called with JSL (long) or JSR, as the harness calls the reference.
const job = (name, entry, long = true) => ({
  name,
  entry,
  long,
  prepare: (s) => ({ bank: 0, d: 0, status: s.rnd(256) & 0xc7, s: NMI_STACK }),
  result: registers,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = entry >>> 16;
    if (long) h.pushByte(0x81);
    h.push(0x1234, 2);
    GAME_NMI_LIFTED_ROUTINES.get(entry)(h);
    return registers(h);
  },
});
const longJob = (name, entry) => job(name, entry);
const CASES = [
  {
    ...longJob('handleGameNmi 80:C152', 0x80c152),
    samples: 300,
    // All jobs in one sample: lists of the game's sizes only.
    prepare: (s) => {
      setWord(s.wram, PALETTE_UPLOAD_LIST_BYTES, 2 * s.rnd(9));
      setWord(s.wram, SCENE_PALETTE_COUNT, s.rnd(16));
      setWord(s.wram, DP_VRAM_UPLOAD_INDEX, s.pick([0xfffe, 2 * s.rnd(64)]));
      setWord(s.wram, PALETTE_REQUEST_SLOT, 2 * s.rnd(8));
      return { bank: 0, d: 0, status: s.rnd(256) & 0xc7, s: NMI_STACK };
    },
  },
  job('uploadScenePalettes 80:999A', 0x80999a, false),
  longJob('uploadReadyMapEdges 81:8949', 0x818949),
  longJob('clearTextTiles 81:A9E1', 0x81a9e1),
  longJob('uploadPaletteCycleStep 81:80C4', 0x8180c4),
  longJob('uploadObjectPalettes 81:A919', 0x81a919),
  job('uploadPortraitGraphics 80:8FBA', 0x808fba, false),
  job('uploadGlove 80:C06B', 0x80c06b, false),
  longJob('uploadVramRecords 81:A958', 0x81a958),
  longJob('uploadOam 81:A98E', 0x81a98e),
  longJob('stepBrightnessFade 81:B0D1', 0x81b0d1),
];

registerCases(CASES, {
  sample,
  side,
  runtime: (h) => h,
  ignored: IGNORED,
  samples: 600,
  // Lists past 2000 (an odd palette byte count ends at index FFFF) lie outside the game.
  outside: new Set(['nmi_list_required']),
});
