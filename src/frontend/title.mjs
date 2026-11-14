// The title (lifted from 81:D694 with the prologue 81:DDDB and 81:DE93, the window
// 81:D81F, the picture 81:D927, the blend 81:D87C with 81:D8E5, and the NMI callbacks
// 81:DD54, 81:DAD6, 81:D93E with 81:D9D5, and 81:DCAC; register-level reference in
// proof/frontend-reference/).
//
// The prologue scrolls its text up over 980 frames while the title song fades in.
// The title then shows the intro screen (src/intro), waits, pans the skyline right
// until position 0401 with objects moving over it, scrolls the city down, narrows
// the window and blends three views of the picture in and out, then fades out. A
// held button ends either at once; the title then returns 1 instead of 0.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  PROLOGUE_EDIT,
} from '../data/packed-text-edits.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { taskStop } from '../task/plan.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { startSceneScreen, enableNmiAndJoypad, disableNmi } from '../system/nmi.mjs';
import { runSceneList } from '../system/scene-list.mjs';
import { unpackStream } from '../system/unpack.mjs';
import { readJoypad, takePadPresses } from '../system/joypad.mjs';
import { nmiAtBranch, waitForFrame } from '../system/frame-wait.mjs';
import { startSong } from '../apu/music-mode.mjs';
import { setSceneScreen } from '../video/scene-screen.mjs';
import { fadeIn, fadeOut } from '../video/fades.mjs';
import { setUpIntroScene, setUpIntroWindow, setUpTitleAudio } from '../intro/intro-scene.mjs';
import { clearIntroObjects, drawPanObjects } from '../intro/intro-objects.mjs';
import {
  DP_PROLOGUE_DELAY,
  DP_PROLOGUE_READ,
  DP_PROLOGUE_SCROLL,
  DP_TITLE_POSITION,
  DP_TITLE_SPEED,
  DP_TITLE_SPEED_TARGET,
  DP_TITLE_UPLOAD,
  INTRO_WINDOW_ENTRY_BYTES,
  INTRO_WINDOW_HDMA,
  MENU_FONT_TILES,
  OAM_SHADOW,
  PAD_HELD,
  PROLOGUE_FONT_TILES,
  PROLOGUE_TEXT,
  PROLOGUE_TILEMAP,
  PROLOGUE_TILEMAP_BYTES,
  TITLE_PALETTE,
  VRAM_SLOT_COUNT,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B0,
  A1T0L,
  APUIO2,
  BBAD0,
  BG12NBA,
  BG1HOFS,
  BG1VOFS,
  BG2HOFS,
  BG2VOFS,
  BG3HOFS,
  BG3VOFS,
  CGADD,
  CGADSUB,
  CGDATA,
  CGSWSEL,
  DAS0L,
  DMAP0,
  HDMAEN,
  MDMAEN,
  STAT77,
  STAT78_PAL,
  TM,
  TS,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import {
  CGADSUB_HALF,
  CGSWSEL_SUB_SCREEN,
  DMAP_ONE_PORT,
  DMAP_TWO_PORTS,
  LAYER_BG1,
  LAYER_BG2,
  OAM_BYTES,
  TILE_FLIP_BITS,
  VMAINC_INCREMENT_AFTER_HIGH,
} from '../constants/ppu.mjs';
import {
  APU_COMMAND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
} from '../constants/sound-commands.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';

const LONG_MASK = 0xffffff,
  WRAM_BANK = WRAM >>> WORD_BITS,
  // Register-level routines for recorded interrupt observations.
  WAIT_FRAME = 0x81eebb,
  READ_INPUT = 0x80f298,
  CALL_SITE = 0x81d694;
// The prologue: font and text (packed in bank 81) into bank 7E, its scene list, 980
// frames; after 120 frames the title song starts at volume 0 and fades in. The text
// scrolls one line every three frames; every eight lines a new text line is centred
// in the tile row below the screen, and after the last one the scroll waits.
const PROLOGUE_FONT_PACKED = 0x81f803,
  PROLOGUE_TEXT_PACKED = 0x81f5ce,
  PROLOGUE_LIST = 0x81f768,
  PROLOGUE_FRAMES = 980,
  PROLOGUE_MUSIC_FRAME = 860,
  PROLOGUE_SCROLL_DELAY = 2,
  PROLOGUE_LINE_MASK = 7,
  PROLOGUE_END_DELAY = 0xfa0,
  PROLOGUE_ROW_MASK = 0xfff8,
  PROLOGUE_ROW_SHIFT = 3,
  PROLOGUE_NEW_ROW = 0x780,
  PROLOGUE_ROW_COLUMNS = 0x20,
  PROLOGUE_ROW_END_MASK = 0x3e,
  PROLOGUE_TILE_MASK = TILE_FLIP_BITS | BYTE_MASK,
  FONT_FIRST_CODE = 0x20,
  SONG_TITLE = 1,
  // The prologue text is read in data bank 7E.
  PROLOGUE_TEXT_LONG = WRAM + PROLOGUE_TEXT;
// The title, by its position in DP_TITLE_POSITION: 52 frames of waiting, the pan to
// TITLE_PAN_END; then the vertical scroll at TITLE_SCROLL_SPEED narrows the window a
// line per frame from TITLE_WINDOW_START to TITLE_WINDOW_END (BG2 leaves the main
// screen at TITLE_BG1_ONLY); after the three views the title ends past
// TITLE_END_CHECK once the position reaches TITLE_END.
const TITLE_PAN_WAIT = 0x34,
  TITLE_PAN_END = 0x401,
  TITLE_SCROLL_SPEED = 0xb0,
  TITLE_WINDOW_START = 0x226,
  TITLE_BG1_ONLY = 0x3e8,
  TITLE_WINDOW_END = 0xdac,
  TITLE_END_CHECK = 0x4d10,
  TITLE_END = 0x6000,
  // A PAL console (STAT78 bit 4, read as the high byte of the STAT77 word) ends the
  // title 0200 positions earlier.
  STAT77_WORD_PAL = STAT78_PAL << BYTE_BITS,
  PAL_POSITION_SHIFT = 3,
  END_CHECK_SITE = 0x81d7da,
  // Scrolls by a quarter or an eighth of the position.
  QUARTER_SHIFT = 2,
  EIGHTH_SHIFT = 3,
  TITLE_PAN_LIST = 0x81f6df,
  TITLE_SCROLL_LIST = 0x81f6e5,
  MENU_FONT_PACKED = 0x84daf2,
  TITLE_SCROLL_COLOURS_BYTES = 0x60,
  // 81:D83E (in the intro screen) leaves the data bank at 81.
  TITLE_DATA_BANK = 0x81;
// The music beat polls (LDA 2142 / BNE) of the title, by the site of their LDA.
const BEAT_BEFORE_FADE_IN = 0x81d6ba,
  BEAT_BEFORE_PICTURE = 0x81d782,
  BEAT_VIEW_2 = 0x81d79e,
  BEAT_VIEW_3 = 0x81d7b7,
  BEAT_AT_END = 0x81d7f7,
  BEAT_BRANCH_OFFSET = 3;
// The picture (81:D927): BG1 and BG2 with character bases 3 and 1, BG2 at the first
// of three views; the blend (81:D87C) adds BG1 at half to BG2 on the sub screen,
// fading up over six steps, holding 60 frames, and fading down over 24.
const PICTURE_LAYERS = LAYER_BG1 | LAYER_BG2,
  PICTURE_CHARACTERS = 0x13,
  BG2_VIEWS = [0x9c, 0xbe, 0xdf],
  BLEND_MATH = CGADSUB_HALF | LAYER_BG1,
  BLEND_FADE_FIRST = 0x12,
  BLEND_FADE_END = 0x18,
  BLEND_HOLD_FRAMES = 60,
  FADE_STEPS_PER_ENTRY_SHIFT = 2;
// The NMI callbacks: the prologue tilemap to VRAM word 1000; the pan speeds up by
// PAN_ACCELERATION (saturating, 16.16 position with the fraction in
// DP_TITLE_SPEED_TARGET) and scrolls BG1 by the position, BG2 by a quarter and BG3 by
// an eighth; the vertical scroll moves its speed by one toward the target, scrolls
// BG1 by a quarter of the position and BG2 by an eighth until BG2_SCROLL_END, from
// then on it sends the title colours to CGRAM colour 16. Both send an 800 byte map
// to VRAM at the positions of their upload tables (three words: position, source in
// bank 7E, VRAM word).
const PROLOGUE_TILEMAP_VRAM = 0x1000,
  VRAM_WORD_DMA = ((VMDATAL & BYTE_MASK) << BYTE_BITS) | DMAP_TWO_PORTS,
  PAN_ACCELERATION = 0x7d0,
  UPLOAD_ENTRY_WORDS = 3,
  UPLOAD_BYTES = 0x800,
  BG2_SCROLL_END = 0x78,
  SCROLL_FIRST_COLOUR = 0x10,
  DMA_CHANNEL_0 = 1;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const readLongWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
const writeLongWord = (mem, at, value) => {
  mem.write8(at & LONG_MASK, value & BYTE_MASK);
  mem.write8((at + 1) & LONG_MASK, (value >>> BYTE_BITS) & BYTE_MASK);
};
const writeHalves = (video, register, value) => {
  video.write(register, value & BYTE_MASK, 1);
  video.write(register, (value >>> BYTE_BITS) & BYTE_MASK, 1);
};

// The title tables of bank 81 by name (src/data/tables.mjs).
const titleTables = (mem) =>
  decodeOnce(mem, 'title', (image) => {
    const tables = {};
    for (const [key, name] of [
      ['panUploads', 'frontend_vram_copies'],
      ['scrollUploads', 'frontend_vram_uploads'],
      ['fadeShifts', 'frontend_menu_fade_shifts'],
      ['fadeMasks', 'frontend_menu_fade_masks'],
    ]) {
      const values = tableEntries(image, name);
      tables[key] = (index) => {
        const value = values[index];
        if (value === undefined) taskStop('title_table_index_frontier', { table: name, index });
        return value;
      };
    }
    return Object.freeze(tables);
  });

// Write the next prologue text line, centred, into the tile row below the screen
// (81:DE93); after the last line set the end delay and clear the row.
export function drawPrologueLine(mem) {
  const { wram } = mem,
    text = (at) => mem.read8((PROLOGUE_TEXT_LONG + at) & LONG_MASK);
  let x =
    ((((word(wram, DP_PROLOGUE_SCROLL) & PROLOGUE_ROW_MASK) << PROLOGUE_ROW_SHIFT) & WORD_MASK) +
      PROLOGUE_NEW_ROW) &
    (PROLOGUE_TILEMAP_BYTES - 1);
  const put = (value) => {
    writeLongWord(mem, PROLOGUE_TILEMAP + x, value);
    x = (x + 2) & WORD_MASK;
  };
  const read = word(wram, DP_PROLOGUE_READ);
  if (text(read) === 0) setWord(wram, DP_PROLOGUE_DELAY, PROLOGUE_END_DELAY);
  else {
    let padding = PROLOGUE_ROW_COLUMNS,
      at = read;
    for (; text(at) !== 0; at = (at + 1) & WORD_MASK) padding = (padding - 1) & WORD_MASK;
    for (padding >>>= 1; ; put(0)) {
      padding = (padding - 1) & WORD_MASK;
      if (padding & WORD_SIGN) break;
    }
    for (at = read; text(at) !== 0; at = (at + 1) & WORD_MASK) {
      const glyph = (((text(at) - FONT_FIRST_CODE) & WORD_MASK) << 1) & WORD_MASK;
      put(readLongWord(mem, PROLOGUE_FONT_TILES + glyph) & PROLOGUE_TILE_MASK);
    }
    setWord(wram, DP_PROLOGUE_READ, at + 1);
    if ((x & PROLOGUE_ROW_END_MASK) === 0) return;
  }
  do put(0);
  while ((x & PROLOGUE_ROW_END_MASK) !== 0);
}
// Narrow the title window by a line (81:D81F): the first H-DMA entry loses a line
// until one is left, the second and third take the count of the second plus one.
export function moveTitleWindow(wram) {
  const first = INTRO_WINDOW_HDMA - WRAM,
    second = first + INTRO_WINDOW_ENTRY_BYTES;
  if (wram[first] === 1) return;
  wram[first] = (wram[first] - 1) & BYTE_MASK;
  wram[second] = wram[second + INTRO_WINDOW_ENTRY_BYTES] = (wram[second] + 1) & BYTE_MASK;
}
// One fade step of the blend (81:D8E5): the original ANDs the step's mask with zero
// and shifts the result, so colours 16-63 of the title palette become black.
export function fadeTitleBlend(m, step) {
  const t = titleTables(m.mem),
    entry = step >>> FADE_STEPS_PER_ENTRY_SHIFT,
    colour = (0 & t.fadeMasks(entry)) >>> t.fadeShifts(entry);
  for (let at = TITLE_SCROLL_COLOURS_BYTES - 2; at >= 0; at -= 2)
    writeLongWord(m.mem, TITLE_PALETTE + at, colour);
}
// Show the title picture (81:D927).
function showTitlePicture(video) {
  video.write(TM, PICTURE_LAYERS, 1);
  video.write(BG12NBA, PICTURE_CHARACTERS, 1);
  video.write(BG2VOFS, BG2_VIEWS[0], 1);
  video.write(BG2VOFS, 0, 1);
}

// 81:DD54: the NMI callback of the prologue: the text tilemap to VRAM, the BG3
// scroll, then the joypad.
export function handlePrologueNmi(h) {
  const { wram, video, port } = sceneRuntime(h);
  video.write(VMADDL, PROLOGUE_TILEMAP_VRAM, 2);
  video.write(DMAP0, VRAM_WORD_DMA, 2);
  video.write(A1T0L, PROLOGUE_TILEMAP & WORD_MASK, 2);
  video.write(DAS0L, PROLOGUE_TILEMAP_BYTES, 2);
  writeHalves(video, BG3VOFS, word(wram, DP_PROLOGUE_SCROLL));
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(A1B0, WRAM_BANK, 1);
  video.write(MDMAEN, DMA_CHANNEL_0, 1);
  setWord(wram, PAD_HELD, readJoypad(port));
  return h.rtl();
}
// An 800 byte map from source in bank 7E to the VRAM word vram, by DMA on channel 0.
function sendMap(video, source, vram) {
  video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
  video.write(DMAP0, DMAP_TWO_PORTS, 1);
  video.write(BBAD0, VMDATAL & BYTE_MASK, 1);
  video.write(A1T0L, source, 2);
  video.write(A1B0, WRAM_BANK, 1);
  video.write(DAS0L, UPLOAD_BYTES, 2);
  video.write(VMADDL, vram, 2);
  video.write(MDMAEN, DMA_CHANNEL_0, 1);
}
// 81:DAD6: the NMI callback of the title's first frames: the OAM buffer, then the
// objects (81:D9D5).
export function handleTitleObjectsNmi(h) {
  const m = sceneRuntime(h);
  m.video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  drawPanObjects(m, word(m.wram, DP_TITLE_POSITION));
  return h.rtl();
}
// 81:D9D5 entered on its own: the objects of the title pan.
export function handlePanObjects(h) {
  const m = sceneRuntime(h);
  drawPanObjects(m, word(m.wram, DP_TITLE_POSITION));
  return h.rtl();
}
// 81:D93E: the NMI callback of the pan: the OAM buffer; until position 0401 the
// speed, position and horizontal scrolls and a map upload at the positions of the
// table; then the objects (81:D9D5).
export function handleTitlePanNmi(h) {
  const m = sceneRuntime(h),
    { wram, video } = m;
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  const position = word(wram, DP_TITLE_POSITION);
  if (position !== TITLE_PAN_END) {
    const speed = Math.min(word(wram, DP_TITLE_SPEED) + PAN_ACCELERATION, WORD_MASK),
      fraction = word(wram, DP_TITLE_SPEED_TARGET) + speed;
    setWord(wram, DP_TITLE_SPEED, speed);
    setWord(wram, DP_TITLE_SPEED_TARGET, fraction);
    const next = (position + (fraction > WORD_MASK ? 1 : 0)) & WORD_MASK;
    setWord(wram, DP_TITLE_POSITION, next);
    writeHalves(video, BG1HOFS, position);
    writeHalves(video, BG2HOFS, position >>> QUARTER_SHIFT);
    writeHalves(video, BG3HOFS, position >>> EIGHTH_SHIFT);
    const t = titleTables(m.mem);
    for (let n = 0; !(t.panUploads(n) & WORD_SIGN); n += UPLOAD_ENTRY_WORDS)
      if (t.panUploads(n) === next) {
        sendMap(video, t.panUploads(n + 1), t.panUploads(n + 2));
        break;
      }
  }
  drawPanObjects(m, word(wram, DP_TITLE_POSITION));
  return h.rtl();
}
// 81:DCAC: the NMI callback of the vertical scroll: the OAM buffer, the speed by one
// toward its target, the position, the scrolls or the title colours, a map upload
// once the position passes the next entry of the table, then the joypad.
export function handleTitleScrollNmi(h) {
  const m = sceneRuntime(h),
    { wram, video } = m;
  video.copyToOam(WRAM + OAM_SHADOW, OAM_BYTES);
  let speed = word(wram, DP_TITLE_SPEED);
  const target = word(wram, DP_TITLE_SPEED_TARGET);
  if (speed !== target) {
    speed = (speed + (speed > target ? -1 : 1)) & WORD_MASK;
    setWord(wram, DP_TITLE_SPEED, speed);
  }
  const position = (word(wram, DP_TITLE_POSITION) + (speed >>> 2)) & WORD_MASK;
  setWord(wram, DP_TITLE_POSITION, position);
  writeHalves(video, BG1VOFS, position >>> QUARTER_SHIFT);
  if (position >>> EIGHTH_SHIFT < BG2_SCROLL_END)
    writeHalves(video, BG2VOFS, position >>> EIGHTH_SHIFT);
  else {
    video.write(CGADD, SCROLL_FIRST_COLOUR, 1);
    video.write(DMAP0, DMAP_ONE_PORT, 1);
    video.write(BBAD0, CGDATA & BYTE_MASK, 1);
    video.write(A1T0L, TITLE_PALETTE & WORD_MASK, 2);
    video.write(A1B0, WRAM_BANK, 1);
    video.write(DAS0L, TITLE_SCROLL_COLOURS_BYTES, 2);
    video.write(MDMAEN, DMA_CHANNEL_0, 1);
  }
  const t = titleTables(m.mem),
    upload = word(wram, DP_TITLE_UPLOAD);
  if (upload & 1)
    taskStop('title_table_index_frontier', { table: 'frontend_vram_uploads', upload });
  const n = upload >>> 1;
  if (t.scrollUploads(n) < position) {
    setWord(wram, DP_TITLE_UPLOAD, upload + UPLOAD_ENTRY_WORDS * 2);
    sendMap(video, t.scrollUploads(n + 1), t.scrollUploads(n + 2));
  }
  setWord(wram, PAD_HELD, readJoypad(m.port));
  return h.rtl();
}

// 81:D694: play the prologue and the title. h is the accessor of the native call
// from the title cycle 80:A18C. Returns with A = 0 after the whole title, 1 after a
// held button, and the zero flag of that load.
export function* titleSequence(h, events, routines) {
  const { ctx } = h,
    status = ctx.status,
    call = (target) => nativeCallSequence(h, events, routines, CALL_SITE, target, true),
    lifted = lagFree(events);
  ctx.status &= ~(FLAG_MEMORY_8BIT | FLAG_INDEX_8BIT);
  let m;
  const wait = () => (lifted ? waitForFrame(h, events, m.port) : call(WAIT_FRAME)),
    input = lifted ? () => [() => takePadPresses(m.wram)] : () => call(READ_INPUT),
    held = () => word(m.wram, PAD_HELD) !== 0;
  // The music beat: LDA 2142 until the sound driver's port 2 reads 0 (at the BNE
  // the lag-free frames deliver an NMI, or audio time with the NMI disabled).
  const beat = function* (site) {
    for (;;) {
      let value;
      yield () => (value = m.port.read(APUIO2, 1, site));
      if (value === 0) return;
      if (!lifted) continue;
      const after = (ctx.status | FLAG_MEMORY_8BIT) & ~(FLAG_NEGATIVE | FLAG_ZERO);
      yield* nmiAtBranch(
        h,
        events,
        site + BEAT_BRANCH_OFFSET,
        value & BYTE_SIGN ? after | FLAG_NEGATIVE : after,
      );
    }
  };
  // Frames with input until a held button (true) or until done() after a frame.
  const frames = function* (done, each = () => {}) {
    for (;;) {
      yield* wait();
      yield* input();
      yield () => each();
      if (held()) return true;
      if (done()) return false;
    }
  };
  // The blend of a view (81:D87C): true if a held button ended it.
  const blend = function* () {
    yield () => {
      m.video.write(TM, LAYER_BG1, 1);
      m.video.write(TS, LAYER_BG2, 1);
      m.video.write(CGSWSEL, CGSWSEL_SUB_SCREEN, 1);
      m.video.write(CGADSUB, BLEND_MATH, 1);
    };
    ctx.bank = TITLE_DATA_BANK;
    for (let step = BLEND_FADE_FIRST; step !== BLEND_FADE_END; step++) {
      yield* wait();
      yield () => fadeTitleBlend(m, step);
      yield* input();
      if (held()) return true;
    }
    let left = BLEND_HOLD_FRAMES;
    if (yield* frames(() => --left === 0)) return true;
    for (let step = BLEND_FADE_END - 1; step >= 0; step--) {
      yield* wait();
      yield () => fadeTitleBlend(m, step);
      yield* input();
      if (held()) return true;
    }
    yield () => {
      m.video.write(TM, LAYER_BG1, 1);
      m.video.write(TS, 0, 1);
    };
    return false;
  };
  const finish = function* (key) {
    yield () => {
      if (key) m.sound(APU_COMMAND_VOLUME_TARGET, 0);
    };
    yield* fadeOut(m.video, wait);
    yield () => {
      disableNmi(m.wram, m.port);
      // The held button's exit writes the word 0 to HDMAEN and 420D.
      m.video.write(HDMAEN, 0, key ? 2 : 1);
    };
    if (!key) yield* beat(BEAT_AT_END);
    let result;
    yield () => {
      ctx.status = key ? status : status & ~FLAG_MEMORY_8BIT;
      ctx.a = ctx.status & FLAG_MEMORY_8BIT ? (ctx.a & ~BYTE_MASK) | (key ? 1 : 0) : key ? 1 : 0;
      ctx.status = (ctx.status & ~(FLAG_NEGATIVE | FLAG_ZERO)) | (key ? 0 : FLAG_ZERO);
      result = h.rtl();
    };
    return result;
  };

  yield () => {
    m = sceneRuntime(h);
    m.sound(APU_COMMAND_VOLUME_TARGET, APU_FULL_VOLUME);
    setWord(m.wram, VRAM_SLOT_COUNT, 0);
    clearIntroObjects(m.wram);
  };
  if (yield* prologue()) return yield* finish(true);
  yield () => {
    setUpIntroScene(m);
    ctx.bank = TITLE_DATA_BANK;
    setUpIntroWindow(m);
  };
  yield* beat(BEAT_BEFORE_FADE_IN);
  yield () => enableNmiAndJoypad(m.wram, m.port);
  yield* fadeIn(m.video, wait);
  yield () => {
    setWord(m.wram, DP_TITLE_SPEED_TARGET, 0);
    setWord(m.wram, DP_TITLE_SPEED, 0);
  };
  let left = TITLE_PAN_WAIT;
  if (yield* frames(() => --left === 0)) return yield* finish(true);
  yield () => runSceneList(m.mem, m.video, m.port, TITLE_PAN_LIST);
  const position = () => word(m.wram, DP_TITLE_POSITION);
  if (yield* frames(() => true)) return yield* finish(true);
  while (position() !== TITLE_PAN_END) if (yield* frames(() => true)) return yield* finish(true);
  yield () => {
    const { mem, wram, video, port } = m;
    unpackStream(mem, MENU_FONT_PACKED, MENU_FONT_TILES & WORD_MASK);
    disableNmi(wram, port);
    runSceneList(mem, video, port, TITLE_SCROLL_LIST);
    setWord(wram, DP_TITLE_SPEED_TARGET, TITLE_SCROLL_SPEED);
    for (const at of [DP_TITLE_SPEED, DP_TITLE_POSITION, DP_TITLE_UPLOAD]) setWord(wram, at, 0);
    for (let at = TITLE_SCROLL_COLOURS_BYTES - 2; at >= 0; at -= 2)
      writeLongWord(mem, TITLE_PALETTE + at, 0);
  };
  yield* wait();
  yield () => enableNmiAndJoypad(m.wram, m.port);
  // The scroll narrows the window from TITLE_WINDOW_START on; BG2 leaves the main
  // screen at TITLE_BG1_ONLY.
  for (;;) {
    yield* wait();
    yield () => {
      if (position() >= TITLE_WINDOW_START) moveTitleWindow(m.wram);
    };
    yield* input();
    if (held()) return yield* finish(true);
    if (position() >= TITLE_BG1_ONLY) break;
  }
  yield () => m.video.write(TM, LAYER_BG1, 1);
  for (;;) {
    yield* wait();
    yield* input();
    yield () => moveTitleWindow(m.wram);
    if (held()) return yield* finish(true);
    if (position() >= TITLE_WINDOW_END) break;
  }
  yield* beat(BEAT_BEFORE_PICTURE);
  yield () => showTitlePicture(m.video);
  if ((yield* blend()) || held()) return yield* finish(true);
  for (const [view, site] of [
    [BG2_VIEWS[1], BEAT_VIEW_2],
    [BG2_VIEWS[2], BEAT_VIEW_3],
  ]) {
    yield () => {
      m.video.write(BG2VOFS, view, 1);
      m.video.write(BG2VOFS, 0, 1);
    };
    yield* beat(site);
    if ((yield* blend()) || held()) return yield* finish(true);
  }
  // The end: past TITLE_END_CHECK once the position (0200 more on a PAL console)
  // reaches TITLE_END.
  const ended = () => {
    if (position() < TITLE_END_CHECK) return false;
    const pal = (m.port.read(STAT77, 2, END_CHECK_SITE) & STAT77_WORD_PAL) >>> PAL_POSITION_SHIFT;
    return ((pal + position()) & WORD_MASK) >= TITLE_END;
  };
  if (yield* frames(ended)) return yield* finish(true);
  return yield* finish(false);

  // 81:DDDB: the prologue; true if a held button ended it.
  function* prologue() {
    yield () => {
      const { mem, wram, video, port } = m;
      const snapshot = beginPackedTextEdit(h.a.mem, PROLOGUE_EDIT);
      try {
        startSceneScreen(wram, video, port);
        setSceneScreen(video);
        unpackStream(mem, PROLOGUE_FONT_PACKED, PROLOGUE_FONT_TILES & WORD_MASK);
        unpackStream(mem, PROLOGUE_TEXT_PACKED, PROLOGUE_TEXT);
        runSceneList(mem, video, port, PROLOGUE_LIST);
      } finally {
        endPackedTextEdit(h.a.mem, snapshot);
      }
      setUpTitleAudio(m);
      for (const at of [DP_PROLOGUE_SCROLL, DP_PROLOGUE_DELAY, DP_PROLOGUE_READ])
        setWord(wram, at, 0);
      enableNmiAndJoypad(wram, port);
      wram.fill(0, PROLOGUE_TILEMAP - WRAM, PROLOGUE_TILEMAP - WRAM + PROLOGUE_TILEMAP_BYTES);
    };
    yield* fadeIn(m.video, wait);
    for (let frame = PROLOGUE_FRAMES; ;) {
      yield* wait();
      yield* input();
      yield () => {
        const { wram } = m,
          delay = (word(wram, DP_PROLOGUE_DELAY) - 1) & WORD_MASK;
        setWord(wram, DP_PROLOGUE_DELAY, delay);
        if (!(delay & WORD_SIGN)) return;
        setWord(wram, DP_PROLOGUE_DELAY, PROLOGUE_SCROLL_DELAY);
        const scroll = (word(wram, DP_PROLOGUE_SCROLL) + 1) & WORD_MASK;
        setWord(wram, DP_PROLOGUE_SCROLL, scroll);
        if ((scroll & PROLOGUE_LINE_MASK) === 0) drawPrologueLine(m.mem);
      };
      if (held()) return true;
      if (frame === PROLOGUE_MUSIC_FRAME)
        yield () => {
          m.sound(APU_COMMAND_VOLUME, 0);
          m.sound(APU_COMMAND_VOLUME_TARGET, APU_FULL_VOLUME);
          startSong(m.mem, m.port, SONG_TITLE);
        };
      if (--frame === 0) {
        yield* fadeOut(m.video, wait);
        return false;
      }
    }
  }
}
