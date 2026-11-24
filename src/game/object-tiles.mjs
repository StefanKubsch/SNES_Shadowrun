import { waitStatus } from '../system/wait-status.mjs';
import { dataBankOf } from '../system/data-bank.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The objects' tiles requested again (lifted from 80:ADF4 with 80:AE12; register-level
// versions in proof/system/native-scene-tiles.mjs stay the reference).
//
// After the dialog the portraits have overwritten the objects' tiles in video memory, so
// each object of the draw list (7E:14B2, from its last index 7E:14B0 down) has its
// tiles queued for the NMI's upload again (80:AE12). An object whose picture change
// (OBJECT_PICTURE_CHANGE) is still waiting runs the animation step 80:AC2F
// (object-animation.mjs) until the change is taken, one frame apart (the job count
// 7E:1562 raised by 81:A954 and the word wait 81:B0A1). Otherwise its current picture is
// the frame stream's word before the frame offset (bank 8C at the action directions);
// the picture (bank 9B, 9C with bit 15) has its tiles queued in the object's VRAM slots:
// two jobs per tile, the source in bank 8E and up, the slot's two VRAM halves from the
// tables 80:AEB4 and 80:AEC4. A picture that would fill the upload list past 50 first
// waits until the NMI has emptied the job lists. At the end one more job list is
// counted and the routine waits until the NMI has run them all.
//
// The direct page words of the original are written as it writes them (3E to 40 the
// frame stream, 41 to 43 the picture, 44 the tile count, 82 the upload index).
// Registers (user decision 2026-11-17): game state only; the slot passes to the reload
// and the animation step as a parameter and the routine leaves no A, X, Y or flags.
// The word wait 81:B0A1 composes directly; the draw list index the original pushes
// around each reload (PHY, PLY), the animation step's JSR frame and the frames of its
// job list counts (JSL 81:A954) lie only in free stack bytes and are kept in locals or
// not reproduced (game state only, user decision 2026-11-17). The reload requires the
// lag-free frame model: the NMI arrives at the waits' branches 80:AE61 and 80:AE0F
// (recorded runs use the register-level reload in proof/system/native-scene-tiles.mjs).
// The word wait comes from the live frame sequence.
import { lagFree } from '../system/main-wait-interrupt.mjs';
import { nmiAtBranch, waitForCounterWord } from '../system/frame-wait.mjs';
import { stepAnimationInPlace } from './object-animation.mjs';
import { taskStop } from '../system/task-stop.mjs';
import {
  DP_VRAM_UPLOAD_INDEX,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  NMI_JOB_LISTS,
  VRAM_SLOT_NEXT,
  VRAM_UPLOAD_ADDRESSES,
  VRAM_UPLOAD_BANKS,
  VRAM_UPLOAD_SOURCES,
} from '../data/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { lowObjectWord } from '../state/objects.mjs';

// The direct page words: the frame stream with its bank, the picture with its bank and
// the tiles left to queue.
const DP_STREAM = 0x3e,
  DP_STREAM_BANK = 0x40,
  DP_PICTURE = 0x41,
  DP_PICTURE_BANK = 0x43,
  DP_TILES = 0x44;
const FRAME_BANK = 0x8c,
  PICTURE_BANK = 0x9b,
  HIGH_PICTURE = WORD_SIGN,
  // The stream's word before the frame offset is the picture shown.
  FRAME_STEP = 2,
  // The upload list holds jobs up to index 50; four bytes of jobs per tile.
  UPLOAD_LIMIT = 0x50,
  TILE_JOB_SHIFT = 2,
  // A tile word: the source offset (bits 6 to 15) and the bank above 8E (bits 0 to 5).
  SOURCE_OFFSET = 0xffc0,
  SOURCE_BANK = 0x3f,
  FIRST_SOURCE_BANK = 0x8e,
  // The VRAM addresses of each slot's two halves in bank 80.
  SLOT_HALVES = [0x80aeb4, 0x80aec4],
  LOW_WRAM_END = 0x2000;
// The waits' loads (their branches follow the 3-byte load).
const FULL_WAIT = 0x80ae5e,
  END_WAIT = 0x80ae0c,
  LOAD_BYTES = 3;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// One more job list for the NMI (81:A954).
function countJobList(wram) {
  setWord(wram, NMI_JOB_LISTS, word(wram, NMI_JOB_LISTS) + 1);
}

// Wait at the load site until the NMI has run all job lists (LDA 7E:1562, BNE back).
function* waitForJobLists(h, events, site) {
  const { wram } = h.a.mem;
  if (!lagFree(events)) taskStop('game_lag_free_required');
  // The wait's branch sees the job count's sign in 16-bit mode.
  for (let value; (value = word(wram, NMI_JOB_LISTS)) !== 0;) {
    const status = waitStatus(
      h,
      events,
      FLAG_MEMORY_8BIT | FLAG_NEGATIVE | FLAG_ZERO,
      value & WORD_SIGN ? FLAG_NEGATIVE : 0,
    );
    yield* nmiAtBranch(h, events, site + LOAD_BYTES, status);
  }
}

// Request the tiles of the draw list's objects again (80:ADF4), a sequence composing the
// live frame wait, for lifted callers without the JSR frame (the caller's return word
// lies only in free stack bytes); the per-object request (80:AE12) runs without its
// frame as well. The RTS form for register-level call tables is in
// proof/caller/upkeep-routines.mjs.
export function* reloadObjectTiles(h, events) {
  const { mem } = h.a,
    { wram } = mem;
  let index, slot;
  yield () => {
    setWord(wram, DP_STREAM_BANK, FRAME_BANK);
    index = word(wram, DRAW_LIST_INDEX);
  };
  do {
    yield () => {
      // The draw list through the data bank, as the original's LDX abs,Y.
      slot = longWord(mem, (dataBankOf(h.a) << WORD_BITS) + DRAW_LIST + index);
    };
    yield* reloadSequence(h, events, slot);
    yield () => {
      index = (index - FRAME_STEP) & WORD_MASK;
    };
  } while (!(index & WORD_SIGN));
  yield () => countJobList(wram);
  yield* waitForJobLists(h, events, END_WAIT);
}

// Request the tiles of the object in slot again (80:AE12), without the JSR frame.
function* reloadSequence(h, events, slot) {
  const { mem } = h.a,
    { wram } = mem;
  // A field read in the data bank 80 below 2000.
  const near = (field, index = slot) => {
    if (field + index + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { field, index });
    return field + index;
  };
  const get = (field, index) => word(wram, near(field, index)),
    put = (field, value, index) => setWord(wram, near(field, index), value),
    pointer = (dp) => word(wram, dp) | (readStateByte(wram, dp + 2) << WORD_BITS);

  // A picture change still waiting: the animation step takes it, a frame apart.
  let change = 0;
  yield () => {
    change = lowObjectWord(wram, 'pictureChange', slot);
  };
  if (change) {
    for (;;) {
      yield () => stepAnimationInPlace(h, slot);
      let waiting = false;
      yield () => {
        waiting = lowObjectWord(wram, 'pictureChange', slot) !== 0;
        if (waiting) countJobList(wram);
      };
      if (!waiting) return;
      yield* waitForCounterWord(h, events);
    }
  }

  // The current picture: the stream's word before the frame offset.
  let tiles = 0,
    full = false;
  yield () => {
    const directions = lowObjectWord(wram, 'actionDirections', slot);
    setWord(wram, DP_STREAM, directions);
    const frame = (lowObjectWord(wram, 'frameOffset', slot) - FRAME_STEP) & WORD_MASK,
      picture = (longWord(mem, pointer(DP_STREAM) + frame) + 1) & WORD_MASK;
    setWord(wram, DP_PICTURE, picture | HIGH_PICTURE);
    setWord(wram, DP_PICTURE_BANK, PICTURE_BANK + (picture & HIGH_PICTURE ? 1 : 0));
    tiles = lowObjectWord(wram, 'vramSlotCount', slot);
    if (!tiles) return;
    setWord(wram, DP_TILES, tiles);
    const jobs = ((tiles << TILE_JOB_SHIFT) & WORD_MASK) + word(wram, DP_VRAM_UPLOAD_INDEX);
    // Past FFFF the original does not compare and does not wait.
    full = jobs <= WORD_MASK && jobs >= UPLOAD_LIMIT;
    if (full) countJobList(wram);
  };
  if (!tiles) return;
  if (full) yield* waitForJobLists(h, events, FULL_WAIT);

  // Two upload jobs per tile into the object's slots.
  yield () => {
    let job = word(wram, DP_VRAM_UPLOAD_INDEX),
      tileSlot = lowObjectWord(wram, 'vramSlotHead', slot);
    for (let n = tiles; n; n--) {
      for (const half of SLOT_HALVES) {
        job = (job + 2) & WORD_MASK;
        const tile = longWord(mem, pointer(DP_PICTURE));
        put(VRAM_UPLOAD_SOURCES, tile & SOURCE_OFFSET, job);
        put(VRAM_UPLOAD_BANKS, (tile & SOURCE_BANK) + FIRST_SOURCE_BANK, job);
        put(VRAM_UPLOAD_ADDRESSES, longWord(mem, half + tileSlot), job);
        if (half === SLOT_HALVES[1]) tileSlot = get(VRAM_SLOT_NEXT, tileSlot);
        setWord(wram, DP_PICTURE, word(wram, DP_PICTURE) + 2);
      }
    }
    setWord(wram, DP_TILES, 0);
    setWord(wram, DP_VRAM_UPLOAD_INDEX, job);
  };
}
