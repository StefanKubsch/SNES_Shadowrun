// Talking with an object (lifted from 80:936C with the dialog close 80:92C5; the
// register-level versions in src/task/native-dialog.mjs stay the reference and serve
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
// The callees come from the routine table and run through their frames with the A, X
// and Y the original passes them (the main loop binds the lifted glove release, window
// opening, window release and frame wait; the others are register-level). The flags the
// routine itself changes (the carry of its shifts and comparisons) are passed on as the
// original's; it changes no overflow. It leaves the registers of its last callee (the
// music change) or of the window release with A the pulled music word.
import { dialogCallSequence, dialogCallBody } from '../task/native-call-continuation.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { fixesEnabled, preparePushkinTopics } from './bugfixes.mjs';
import { dialogTextRoutines } from '../task/native-dialog-text.mjs';
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
} from '../task/native-dialog-portrait.mjs';
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
} from '../task/wram.mjs';
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
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
  colour: [0x80936c, 0x81886a, true],
  glove: [0x809377, 0x80bcb2],
  notices: [0x80938d, 0x80ff79],
  music: [0x8093bc, 0x81ef47, true],
  frame: [0x8093db, 0x80f963],
  narrow: [0x8093ec, 0x80fa92],
  text: [0x809408, 0x80f963],
  jakeUnpack: [0x80944d, 0x809f6d],
  jakeShift: [0x809450, 0x808f20],
  jakeUpload: [0x809453, 0x809022],
  partnerUnpack: [0x809470, 0x809f6d],
  partnerShift: [0x809473, 0x808f20],
  partnerUpload: [0x809476, 0x80905e],
  portraitWindow: [0x809479, 0x808f3a],
  greeting: [0x809483, 0x809178],
  wait: [0x809489, 0x81b0a1, true],
  menu: [0x809490, 0x8091e2],
  topics: [0x8094a2, 0x809215],
  topicText: [0x8094b8, 0x809178],
  talkText: [0x8094c5, 0x809178],
  close: [0x8094d3, 0x8092c5],
  releaseText: [0x8094d9, 0x80fa3e],
  releaseFrame: [0x8094df, 0x80fa3e],
  restoreMusic: [0x8094e5, 0x81ef47, true],
  closePortrait: [0x8092c5, 0x808f97],
  tiles: [0x8092ce, 0x80adf4],
  closeWait: [0x8092d1, 0x81b0a1, true],
  pad: [0x809333, 0x809e1a],
  sprites: [0x809336, 0x80b8de],
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
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
// The long pointer in the direct page at dp, plus y.
const pointer = (wram, dp, y) => ((word(wram, dp) | (wram[dp + 2] << WORD_BITS)) + y) & LONG_MASK;

// Clear the fixed colour (81:886A), called with JSL: COLDATA black on all planes, no
// colour math (CGADSUB 0). A keeps its high byte with E0 below it, sign set.
export function clearFixedColourRoutine(h) {
  const { ctx } = h,
    { port } = sceneRuntime(h);
  ctx.a = (ctx.a & HIGH_BYTE_MASK) | FIXED_COLOUR_BLACK;
  port.write(COLDATA, FIXED_COLOUR_BLACK, 1, COLDATA_SITE);
  port.write(CGADSUB, 0, 1, CGADSUB_SITE);
  flag(ctx, FLAG_NEGATIVE, true);
  flag(ctx, FLAG_ZERO, false);
  return h.rtl();
}
// Set the text area of the window in the direct page word 00 (80:FA92), called with JSR:
// its left text pixel from 02, its width in pixels from 04, or, for 0 or less, the
// window's columns plus 04 less two (as the original adds them). X is left the window.
export function setWindowTextWidthRoutine(h) {
  const { ctx } = h,
    { wram } = sceneRuntime(h),
    x = word(wram, DP_OBJECT);
  ctx.x = x;
  setWord(wram, WINDOW_LEFT_PIXEL + x, word(wram, DP_RECORD_NUMBER));
  let width = word(wram, DP_PIXEL_WIDTH);
  if (width === 0 || width & WORD_SIGN) {
    const columns = word(wram, WINDOW_COLUMNS + x),
      sum = width + columns,
      result = sum & WORD_MASK;
    flag(ctx, FLAG_CARRY, sum > WORD_MASK);
    flag(ctx, FLAG_OVERFLOW, ~(width ^ columns) & (width ^ result) & WORD_SIGN);
    width = (result - BORDER_COLUMNS) & WORD_MASK;
  }
  ctx.a = width;
  flag(ctx, FLAG_NEGATIVE, width & WORD_SIGN);
  flag(ctx, FLAG_ZERO, width === 0);
  setWord(wram, WINDOW_WIDTH_PIXELS + x, width);
  return h.rts();
}

// Close the dialog (80:92C5), a sequence: the callee table routines.
export function* closeDialogSequence(h, events, routines) {
  const { ctx } = h,
    { port } = sceneRuntime(h),
    call = ([site, target, long]) => dialogCallSequence(h, events, routines, site, target, long);
  yield* call(CALL.closePortrait);
  yield () => {
    ctx.a = 0;
    port.write(OBJSEL, 0, 2, CLOSE_OBJSEL_SITE);
  };
  yield* call(CALL.tiles);
  yield* call(CALL.closeWait);
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
      // The byte loads keep the source's high byte in A.
      ctx.a = (source & HIGH_BYTE_MASK) | FONT_DMA_CHANNEL;
    }
  };
  yield* call(CALL.pad);
  yield* call(CALL.sprites);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Talk with the object (80:936C), a sequence for a native call continuation: h the
// glove action's access (direct page 0, data bank 80), routines the callee table.
export function* talkSequence(h, events, routines) {
  const { ctx } = h,
    m = sceneRuntime(h),
    { mem, wram, port } = m,
    call = ([site, target, long]) => dialogCallSequence(h, events, routines, site, target, long);
  if (fixesEnabled(h.a)) preparePushkinTopics(h.a, word(wram, DP_RECORD_NUMBER));
  events.text ??= dialogTextRoutines(events);
  // Load a portrait record (pointer in F6, bank in F8) for the unpacker: Y its bank, A its
  // address, X the buffer.
  function* portrait(unpack, shift) {
    yield () => {
      const at = word(wram, DP_PORTRAIT_POINTER) | (wram[DP_PORTRAIT_BANK] << WORD_BITS);
      ctx.y = longWord(mem, at + PORTRAIT_RECORD_BANK_BYTE) & BYTE_MASK;
      ctx.a = longWord(mem, at);
      ctx.x = PORTRAIT_BUFFER;
    };
    yield* call(unpack);
    yield* call(shift);
  }
  // Set the window of the direct page words 00 to 08 (A ends 0).
  const window = ([left, top, columns, rows]) => {
    setWord(wram, DP_WINDOW_LEFT, left);
    setWord(wram, DP_WINDOW_TOP, top);
    setWord(wram, DP_WINDOW_COLUMNS, columns);
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    ctx.a = 0;
  };
  yield* call(CALL.colour);
  yield () => {
    setWord(wram, DIALOG_END, 0);
    ctx.a = word(wram, DP_OBJECT);
    setWord(wram, DP_DIALOG_OBJECT, ctx.a);
  };
  yield* call(CALL.glove);
  yield () => {
    wram[DP_RECORD_BANK] = RECORD_BANK;
    const number = word(wram, DP_RECORD_NUMBER);
    flag(ctx, FLAG_CARRY, number & WORD_SIGN);
    ctx.y = (number << 1) & WORD_MASK;
    ctx.a = longWord(mem, DIALOG_TABLE + ctx.y);
    setWord(wram, DP_RECORD, ctx.a);
    ctx.y = word(wram, DP_DIALOG_OBJECT);
  };
  yield* call(CALL.notices);
  // The dialog's music: its old music (or FFFF) stays on the stack.
  let change = false;
  yield () => {
    ctx.y = RECORD_FLAG_BYTE;
    ctx.a = longWord(mem, pointer(wram, DP_RECORD, ctx.y)) & BYTE_MASK;
    setWord(wram, DIALOG_RECORD_FLAGS, ctx.a);
    ctx.a &= MUSIC_BITS;
    if (ctx.a) ctx.a = word(wram, GAME_OPTIONS) & OPTION_MUSIC;
    if (ctx.a) {
      ctx.y = (word(wram, DIALOG_RECORD_FLAGS) & MUSIC_BITS) << 1;
      flag(ctx, FLAG_CARRY, false);
      ctx.a = longWord(mem, MUSIC_TABLE + ctx.y);
      const music = word(wram, MUSIC);
      flag(ctx, FLAG_CARRY, ctx.a >= music);
      change = ctx.a !== music;
    }
    if (change) {
      ctx.y = word(wram, MUSIC);
      h.a.pushWord(ctx.y);
    } else h.a.pushWord(NO_MUSIC);
  };
  if (change) yield* call(CALL.music);
  yield () => window(PORTRAIT_FRAME);
  yield* call(CALL.frame);
  yield () => {
    setWord(wram, DP_PORTRAIT_FRAME, word(wram, DP_OBJECT));
    setWord(wram, DP_RECORD_NUMBER, FRAME_LEFT_PIXEL);
    ctx.a = FRAME_WIDTH_CHANGE;
    setWord(wram, DP_PIXEL_WIDTH, ctx.a);
  };
  yield* call(CALL.narrow);
  yield () => window(TEXT_WINDOW);
  yield* call(CALL.text);
  // Jake's portrait record, then the partner's from the dialog record.
  yield () => {
    setWord(wram, DP_TEXT_WINDOW, word(wram, DP_OBJECT));
    port.write(OBJSEL, PORTRAIT_OBJSEL, 2, OBJSEL_SITE);
    setWord(wram, PALETTE_UPLOAD_LIST_BYTES, 0);
    const jake = wram[JAKE_ALTERNATE_PORTRAIT]
      ? JAKE_ALTERNATE_PORTRAIT_DIALOG
      : JAKE_PORTRAIT_DIALOG;
    flag(ctx, FLAG_CARRY, false);
    ctx.x = longWord(mem, DIALOG_TABLE + (jake << 1));
    wram[DP_PORTRAIT_BANK] = mem.read8(DIALOG_BANK_BASE + PORTRAIT_RECORD_BANK_BYTE + ctx.x);
    ctx.a = longWord(mem, DIALOG_BANK_BASE + ctx.x);
    setWord(wram, DP_PORTRAIT_POINTER, ctx.a);
  };
  yield* portrait(CALL.jakeUnpack, CALL.jakeShift);
  yield* call(CALL.jakeUpload);
  yield () => {
    ctx.y = PORTRAIT_RECORD_BANK_BYTE;
    wram[DP_PORTRAIT_BANK] = mem.read8(pointer(wram, DP_RECORD, ctx.y));
    ctx.a = longWord(mem, pointer(wram, DP_RECORD, 0));
    setWord(wram, DP_PORTRAIT_POINTER, ctx.a);
  };
  yield* portrait(CALL.partnerUnpack, CALL.partnerShift);
  yield* call(CALL.partnerUpload);
  yield* call(CALL.portraitWindow);
  yield () => {
    setWord(wram, DP_OBJECT, word(wram, DP_PORTRAIT_FRAME));
    ctx.a = GREETING_TEXT;
  };
  yield* call(CALL.greeting);
  yield () => (ctx.x = GREETING_WAIT_FRAMES);
  do {
    yield* call(CALL.wait);
    yield () => (ctx.x = (ctx.x - 1) & WORD_MASK);
  } while (!(ctx.x & WORD_SIGN));
  // The menu until Exit or the end word.
  for (;;) {
    yield* call(CALL.menu);
    let next;
    yield () => {
      flag(ctx, FLAG_CARRY, true);
      if (ctx.a === MENU_EXIT) return void (next = 'end');
      ctx.x = word(wram, DIALOG_END);
      if (ctx.x) return void (next = 'end');
      if (ctx.a === MENU_TALK) {
        ctx.a = TALK_TEXT;
        return void (next = 'talk');
      }
      next = 'topics';
    };
    if (next === 'end') break;
    if (next === 'topics') {
      yield* call(CALL.topics);
      yield () => {
        ctx.a = word(wram, DIALOG_END);
        if (ctx.a) return void (next = 'end');
        ctx.x = word(wram, DP_OBJECT);
        flag(ctx, FLAG_CARRY, ctx.x >= NO_TOPIC);
        if (ctx.x === NO_TOPIC) return void (next = 'menu');
        ctx.a = word(wram, TOPIC_LIST + ctx.x) & BYTE_MASK;
      };
      if (next === 'end') break;
      if (next === 'menu') continue;
    }
    yield* call(next === 'talk' ? CALL.talkText : CALL.topicText);
    let stop;
    yield () => {
      ctx.a = word(wram, DIALOG_END);
      stop = ctx.a !== 0;
    };
    if (stop) break;
  }
  // Close, release both windows and restore the old music.
  yield () => {
    h.a.pushWord(word(wram, DP_PORTRAIT_FRAME));
    ctx.a = word(wram, DP_TEXT_WINDOW);
    h.a.pushWord(ctx.a);
  };
  yield* dialogCallBody(h, ...CALL.close, () => closeDialogSequence(h, events, routines));
  yield () => {
    ctx.a = h.a.pullWord();
    setWord(wram, DP_OBJECT, ctx.a);
  };
  yield* call(CALL.releaseText);
  yield () => {
    ctx.a = h.a.pullWord();
    setWord(wram, DP_OBJECT, ctx.a);
  };
  yield* call(CALL.releaseFrame);
  let restore;
  yield () => {
    ctx.a = h.a.pullWord();
    flag(ctx, FLAG_NEGATIVE, ctx.a & WORD_SIGN);
    flag(ctx, FLAG_ZERO, ctx.a === 0);
    restore = !(ctx.a & WORD_SIGN);
  };
  if (restore) yield* call(CALL.restoreMusic);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
