// Talking with an object (lifted from 80:936C with the dialog close 80:92C5; the
// register-level versions in proof/replay/native-dialog.mjs stay the reference and serve
// the other callers).
//
// The glove action passes the object in the direct page word 00 and its dialog record
// number in 02 (the record pointer from 80:94F7, bank 8D). The dialog clears the colour
// effect (81:886A), puts the glove away (80:BCB2), releases the notice windows (80:FF79)
// and, when the record's flag byte 3 names a music (bits 0 to 6, table 80:94E8) other
// than the current one and the music option is on, changes the music (81:EF47); the old
// music, or FFFF, stays on the stack. It opens the portrait frame (1, 1, 1E x D; moved to
// pixel 54 and narrowed by 8 with 80:FA92) and the text window (1, E, 1E x D), unpacks and
// uploads Jake's portrait (dialog record 4E, or 4F when 7E:3C17 says so) and the
// partner's (80:9F6D, 80:8F20, 80:9022, 80:905E), opens the portrait window (80:8F3A),
// shows the greeting (80:9178 with FFFF) and waits 61 frames. Then the menu (80:91E2:
// Exit, Talk, Ask about) runs until Exit or the end word 7E:1D63: Talk shows the talk
// text (FFFE), Ask about a topic chosen with 80:9215 from the topic list 7E:3CA3. At the
// end the dialog closes (80:92C5: the portrait window closed, the object tiles reloaded,
// a frame waited, the two font blocks uploaded from 8D:FB78 and 8D:FD78 to VRAM 0000 and
// 0100 by DMA, the pad read and the sprites rebuilt), both windows are released and the
// old music comes back.
//
// All callees compose directly through their established frames with the
// original arguments; the music changes and the dialog texts take theirs as parameters.
// Registers (user decision 2026-11-17): game state only; the routine, the dialog close,
// the colour clear and the text width leave no A, X, Y or flags. The old music and the
// two windows wait on the stack as in the original.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { setMusicModeInPlace } from '../apu/audio-routines.mjs';
import { showDialogText } from './dialog-text.mjs';
import { chooseDialogAction, chooseDialogTopicSequence } from './dialog-menus.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { reloadObjectTiles } from './object-tiles.mjs';
import { buildSpritesInPlace } from './sprite-list.mjs';
import { openWindow } from './window-open.mjs';
import {
  putGloveAwaySequence,
  releaseNoticeWindowsSequence,
  releaseWindowSequence,
} from './window-release.mjs';
import { closePortraitWindow, openPortraitWindow } from './portrait-window.mjs';
import {
  unpackPortrait,
  shiftPortraitRowsInPlace,
  uploadFirstPortrait,
  uploadSecondPortrait,
} from './portrait-upload.mjs';
import { frameWaitCallSequence, takePad } from '../system/live-input-calls.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { fixesEnabled, preparePushkinTopics } from './bugfixes.mjs';
import { DIALOG_TABLE, DIALOG_BANK_BASE } from '../data/portraits.mjs';
import { JAKE_PORTRAIT_DIALOG, JAKE_ALTERNATE_PORTRAIT_DIALOG } from '../data/runners.mjs';
import {
  DP_PORTRAIT_BANK,
  DP_PORTRAIT_POINTER,
  DP_PIXEL_WIDTH,
  PORTRAIT_BUFFER,
  PORTRAIT_OBJSEL,
  PORTRAIT_RECORD_BANK_BYTE,
  FIXED_COLOUR_BLACK,
} from '../system/native-dialog-portrait.mjs';
import {
  DIALOG_END,
  DIALOG_RECORD_FLAGS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  GAME_OPTIONS,
  JAKE_ALTERNATE_PORTRAIT,
  MUSIC,
  OPTION_MUSIC,
  PALETTE_UPLOAD_LIST_BYTES,
  TOPIC_LIST,
  WINDOW_COLUMNS,
  WINDOW_LEFT_PIXEL,
  WINDOW_WIDTH_PIXELS,
} from '../data/wram.mjs';
import {
  A1B0,
  A1T0L,
  BBAD0,
  CGADSUB,
  COLDATA,
  DAS0L,
  DMAP0,
  MDMAEN,
  OBJSEL,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The direct page words of the dialog: the object, the record pointer (bank in 13), the
// portrait frame and the text window.
const DP_OBJECT = 0x00,
  DP_RECORD_NUMBER = 0x02,
  DP_DIALOG_OBJECT = 0x26,
  DP_RECORD = 0x11,
  DP_RECORD_BANK = 0x13,
  DP_PORTRAIT_FRAME = 0x14,
  DP_TEXT_WINDOW = 0x17;
const RECORD_FLAG_BYTE = 3,
  MUSIC_BITS = 0x7f,
  MUSIC_TABLE = 0x8094e8,
  NO_MUSIC = WORD_MASK,
  RECORD_BANK = DIALOG_BANK_BASE >>> WORD_BITS,
  PORTRAIT_FRAME = Object.freeze([1, 1, 0x1e, 0x0d]),
  TEXT_WINDOW = Object.freeze([1, 0x0e, 0x1e, 0x0d]),
  FRAME_LEFT_PIXEL = 0x54,
  FRAME_WIDTH_CHANGE = -8 & WORD_MASK,
  GREETING_TEXT = WORD_MASK,
  TALK_TEXT = 0xfffe,
  GREETING_WAIT_FRAMES = 0x3c,
  NO_TOPIC = BYTE_MASK,
  MENU_EXIT = 0,
  MENU_TALK = 1;
// The two font blocks of the dialog close: VRAM word address and source in bank 8D, 40
// bytes by DMA channel 0 (mode 1 to VMDATAL, increment after the high byte), each with
// the sites of its eight writes.
const FONT_BLOCKS = Object.freeze([
    [0, 0xfb78, [0x8092d8, 0x8092de, 0x8092e4, 0x8092eb, 0x8092f0, 0x8092f5, 0x8092fa, 0x8092ff]],
    [
      0x100,
      0xfd78,
      [0x809307, 0x80930d, 0x809313, 0x80931a, 0x80931f, 0x809324, 0x809329, 0x80932e],
    ],
  ]),
  FONT_BYTES = 0x40,
  FONT_DMA_MODE = 1,
  FONT_DMA_CHANNEL = 1;
// Original call sites and callees.
const CALL = Object.freeze({
  jakeUnpack: [0x80944d, 0x809f6d],
  partnerUnpack: [0x809470, 0x809f6d],
  wait: [0x809489, 0x81b0a1, true],
  topics: [0x8094a2, 0x809215],
  releaseText: [0x8094d9, 0x80fa3e],
  releaseFrame: [0x8094df, 0x80fa3e],
  closeWait: [0x8092d1, 0x81b0a1, true],
});
const OBJSEL_SITE = 0x809412,
  CLOSE_OBJSEL_SITE = 0x8092cb,
  COLDATA_SITE = 0x81886e,
  CGADSUB_SITE = 0x818871,
  BORDER_COLUMNS = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// The long pointer in the direct page at dp, plus y.
const pointer = (wram, dp, y) => ((word(wram, dp) | (wram[dp + 2] << WORD_BITS)) + y) & LONG_MASK;

// Clear the fixed colour (81:886A), called with JSL: COLDATA black on all planes, no
// colour math (CGADSUB 0).
export function clearFixedColourInPlace(h) {
  const { port } = sceneRuntime(h);
  port.write(COLDATA, FIXED_COLOUR_BLACK, 1, COLDATA_SITE);
  port.write(CGADSUB, 0, 1, CGADSUB_SITE);
}
// 81:886A as called with JSL; returns with its RTL.
export function clearFixedColourRoutine(h) {
  clearFixedColourInPlace(h);
  return h.rtl();
}
// Set the text area of the window in the direct page word 00 (80:FA92), called with JSR:
// its left text pixel from 02, its width in pixels from 04, or, for 0 or less, the
// window's columns plus 04 less two (as the original adds them).
export function setWindowTextWidthInPlace(h) {
  const { wram } = sceneRuntime(h),
    x = word(wram, DP_OBJECT);
  setWord(wram, WINDOW_LEFT_PIXEL + x, word(wram, DP_RECORD_NUMBER));
  let width = word(wram, DP_PIXEL_WIDTH);
  if (width === 0 || width & WORD_SIGN)
    width = (width + word(wram, WINDOW_COLUMNS + x) - BORDER_COLUMNS) & WORD_MASK;
  setWord(wram, WINDOW_WIDTH_PIXELS + x, width);
}
// 80:FA92 as called with JSR; returns with its RTS.
export function setWindowTextWidthRoutine(h) {
  setWindowTextWidthInPlace(h);
  return h.rts();
}

// Close the dialog (80:92C5) with live portrait, frame and input calls, for lifted
// callers without the JSR frame (the caller's return word lies only in free stack
// bytes). Object tile reload and sprite composition retain their shared service table.
export function* closeDialog(h, events) {
  const { port } = sceneRuntime(h);
  yield* closePortraitWindow(h, events);
  yield () => port.write(OBJSEL, 0, 2, CLOSE_OBJSEL_SITE);
  yield* reloadObjectTiles(h, events);
  yield* dialogCallBody(
    h,
    CALL.closeWait[0],
    CALL.closeWait[1],
    () => frameWaitCallSequence(h, events),
    true,
  );
  yield () => {
    for (const [vram, source, sites] of FONT_BLOCKS) {
      const writes = [
        [VMADDL, vram, 2],
        [DAS0L, FONT_BYTES, 2],
        [A1T0L, source, 2],
        [A1B0, RECORD_BANK, 1],
        [BBAD0, VMDATAL & BYTE_MASK, 1],
        [VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1],
        [DMAP0, FONT_DMA_MODE, 1],
        [MDMAEN, FONT_DMA_CHANNEL, 1],
      ];
      writes.forEach(([register, value, width], n) => port.write(register, value, width, sites[n]));
    }
  };
  yield* segmentSequence(() => takePad(h, events));
  yield () => buildSpritesInPlace(h);
}
// The dialog close as called with JSR (80:92C5); returns with its RTS.
export function* closeDialogSequence(h, events) {
  yield* closeDialog(h, events);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Talk with the object (80:936C) for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes); the menu, topic choice and waits
// keep their own. The glove action supplies direct page 0 and data bank 80;
// renderBuffer draws text.
export function* talk(h, events, renderBuffer = drawTextBufferSequence) {
  const m = sceneRuntime(h),
    { mem, wram, port } = m;
  if (fixesEnabled(h.a)) preparePushkinTopics(h.a, word(wram, DP_RECORD_NUMBER));
  // Load a portrait record (pointer in F6, bank in F8) for the unpacker: its address and
  // bank and the buffer.
  function* portrait(unpack) {
    let stream;
    yield () => {
      const at = word(wram, DP_PORTRAIT_POINTER) | (wram[DP_PORTRAIT_BANK] << WORD_BITS);
      stream = [longWord(mem, at), longWord(mem, at + PORTRAIT_RECORD_BANK_BYTE) & BYTE_MASK];
    };
    yield* dialogCallBody(h, ...unpack, () =>
      segmentSequence(() => unpackPortrait(h, events, ...stream, PORTRAIT_BUFFER)),
    );
    yield () => shiftPortraitRowsInPlace(h);
  }
  // Set the window of the direct page words 00 to 08.
  const window = ([left, top, columns, rows]) => {
    setWord(wram, DP_WINDOW_LEFT, left);
    setWord(wram, DP_WINDOW_TOP, top);
    setWord(wram, DP_WINDOW_COLUMNS, columns);
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  // The music to change to, then the music to restore.
  const music = function* (mode) {
    yield () => setMusicModeInPlace(h, mode.value);
  };
  yield () => clearFixedColourInPlace(h);
  yield () => {
    setWord(wram, DIALOG_END, 0);
    setWord(wram, DP_DIALOG_OBJECT, word(wram, DP_OBJECT));
  };
  yield* putGloveAwaySequence(h, events);
  yield () => {
    wram[DP_RECORD_BANK] = RECORD_BANK;
    const number = word(wram, DP_RECORD_NUMBER);
    setWord(wram, DP_RECORD, longWord(mem, DIALOG_TABLE + ((number << 1) & WORD_MASK)));
  };
  yield* releaseNoticeWindowsSequence(h, events);
  // The dialog's music. The original keeps the old music (or FFFF) on the stack over the
  // dialog, and later the two windows over the close; those words lie only in free stack
  // bytes and are kept in locals here (game state only, user decision 2026-11-17).
  let change = null,
    oldMusic;
  yield () => {
    const flags = longWord(mem, pointer(wram, DP_RECORD, RECORD_FLAG_BYTE)) & BYTE_MASK;
    setWord(wram, DIALOG_RECORD_FLAGS, flags);
    if (flags & MUSIC_BITS && word(wram, GAME_OPTIONS) & OPTION_MUSIC) {
      const value = longWord(mem, MUSIC_TABLE + ((flags & MUSIC_BITS) << 1)),
        current = word(wram, MUSIC);
      if (value !== current) change = { value };
    }
    oldMusic = change ? word(wram, MUSIC) : NO_MUSIC;
  };
  if (change) yield* music(change);
  yield () => window(PORTRAIT_FRAME);
  yield* openWindow(h, events);
  yield () => {
    setWord(wram, DP_PORTRAIT_FRAME, word(wram, DP_OBJECT));
    setWord(wram, DP_RECORD_NUMBER, FRAME_LEFT_PIXEL);
    setWord(wram, DP_PIXEL_WIDTH, FRAME_WIDTH_CHANGE);
  };
  yield () => setWindowTextWidthInPlace(h);
  yield () => window(TEXT_WINDOW);
  yield* openWindow(h, events);
  // Jake's portrait record, then the partner's from the dialog record.
  yield () => {
    setWord(wram, DP_TEXT_WINDOW, word(wram, DP_OBJECT));
    port.write(OBJSEL, PORTRAIT_OBJSEL, 2, OBJSEL_SITE);
    setWord(wram, PALETTE_UPLOAD_LIST_BYTES, 0);
    const jake = wram[JAKE_ALTERNATE_PORTRAIT]
        ? JAKE_ALTERNATE_PORTRAIT_DIALOG
        : JAKE_PORTRAIT_DIALOG,
      record = longWord(mem, DIALOG_TABLE + (jake << 1));
    wram[DP_PORTRAIT_BANK] = mem.read8(DIALOG_BANK_BASE + PORTRAIT_RECORD_BANK_BYTE + record);
    setWord(wram, DP_PORTRAIT_POINTER, longWord(mem, DIALOG_BANK_BASE + record));
  };
  yield* portrait(CALL.jakeUnpack);
  yield* uploadFirstPortrait(h, events);
  yield () => {
    wram[DP_PORTRAIT_BANK] = mem.read8(pointer(wram, DP_RECORD, PORTRAIT_RECORD_BANK_BYTE));
    setWord(wram, DP_PORTRAIT_POINTER, longWord(mem, pointer(wram, DP_RECORD, 0)));
  };
  yield* portrait(CALL.partnerUnpack);
  yield* uploadSecondPortrait(h, events);
  yield* openPortraitWindow(h, events);
  yield () => setWord(wram, DP_OBJECT, word(wram, DP_PORTRAIT_FRAME));
  yield* showDialogText(h, events, renderBuffer, GREETING_TEXT);
  // The greeting waits until the frame count passes below 0.
  for (let frames = GREETING_WAIT_FRAMES; !(frames & WORD_SIGN); frames = (frames - 1) & WORD_MASK)
    yield* dialogCallBody(
      h,
      CALL.wait[0],
      CALL.wait[1],
      () => frameWaitCallSequence(h, events),
      true,
    );
  // The menu until Exit or the end word.
  for (;;) {
    yield* chooseDialogAction(h, events, renderBuffer);
    let next, key;
    yield () => {
      // The menu leaves its row in the direct page word 00.
      const row = word(wram, DP_OBJECT);
      if (row === MENU_EXIT || word(wram, DIALOG_END)) return void (next = 'end');
      if (row === MENU_TALK) {
        key = TALK_TEXT;
        return void (next = 'talk');
      }
      next = 'topics';
    };
    if (next === 'end') break;
    if (next === 'topics') {
      yield* dialogCallBody(h, ...CALL.topics, () =>
        chooseDialogTopicSequence(h, events, renderBuffer),
      );
      yield () => {
        if (word(wram, DIALOG_END)) return void (next = 'end');
        const topic = word(wram, DP_OBJECT);
        if (topic === NO_TOPIC) return void (next = 'menu');
        key = word(wram, TOPIC_LIST + topic) & BYTE_MASK;
      };
      if (next === 'end') break;
      if (next === 'menu') continue;
    }
    yield* showDialogText(h, events, renderBuffer, key);
    let stop;
    yield () => {
      stop = word(wram, DIALOG_END) !== 0;
    };
    if (stop) break;
  }
  // Close, release both windows and restore the old music.
  let frameWindow, textWindow;
  yield () => {
    frameWindow = word(wram, DP_PORTRAIT_FRAME);
    textWindow = word(wram, DP_TEXT_WINDOW);
  };
  yield* closeDialog(h, events);
  yield () => setWord(wram, DP_OBJECT, textWindow);
  yield* releaseWindowSequence(h, events);
  yield () => setWord(wram, DP_OBJECT, frameWindow);
  yield* releaseWindowSequence(h, events);
  let restore = null;
  yield () => {
    const value = oldMusic;
    if (!(value & WORD_SIGN)) restore = { value, restore: true };
  };
  if (restore) yield* music(restore);
}
// The talk as called with JSR (80:936C), a sequence for a native call continuation;
// returns with its RTS.
export function* talkSequence(h, events, renderBuffer = drawTextBufferSequence) {
  yield* talk(h, events, renderBuffer);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
