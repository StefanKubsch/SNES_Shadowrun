// Register-level reference of the start menu 81:E14A/E1B4 and its input 81:E29F
// (the lifted version is src/frontend/start-menu.mjs).
import { INTRO_SETUP_REFERENCE_ENTRIES } from '../intro-reference/intro-routines.mjs';
import { saveSlotCount } from '../../src/game/save-slots.mjs';

import { creditsRequested, markStartMenu, requestCredits } from '../../src/game/credits.mjs';
import {
  LARGE_FRAME_GRAPHICS,
  MENU_ARROW_CHAR,
  MENU_BLANK_CHAR,
  SMALL_FRAME_GRAPHICS,
  TITLE_FADE_BYTES,
  TITLE_FADE_COLOURS,
  frontendCallSequence,
  START_MENU_TEXT_ENTRIES,
} from './start-menu-text.mjs';
import { interruptStep, steppedInterrupts } from '../../src/task/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/task/native-call-continuation.mjs';
import { FRONTEND_NMI_ROUTINES } from '../../src/task/main-frontend-nmi.mjs';

import {
  DP_MENU_CHOICE,
  DP_MENU_CURSOR,
  DP_MENU_TIMEOUT,
  MENU_ROW_DISABLED,
  PAD_B,
  PAD_DOWN,
  PAD_PRESSED,
  PAD_SELECT,
  PAD_START,
  PAD_UP,
  SETTINGS_CONTROL,
  SETTINGS_CONTROL_TYPE_A,
  SETTINGS_MUSIC,
  SETTINGS_MUSIC_FULL,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
  TITLE_PALETTE,
} from '../../src/task/wram.mjs';
import { WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
} from '../../src/constants/cpu-flags.mjs';
import { APUIO2 } from '../../src/constants/hardware-registers.mjs';

import { COLOUR_MASK } from '../../src/constants/ppu.mjs';
import {
  APU_COMMAND_SOUND_VOLUME,
  APU_COMMAND_VOLUME_TARGET,
  APU_FULL_VOLUME,
} from '../../src/constants/sound-commands.mjs';
const downX = (h) => {
  h.index('x', h.ctx.x - 1);
  h.index('x', h.ctx.x - 1);
};
// The start menu song (81:F229).
const SONG_START_MENU = 2;
// Menu sounds of APU_COMMAND_SOUND_VOLUME: level 22, sound 09 (move) or 08 (choose).
const MENU_MOVE_SOUND = 0x2209,
  MENU_CHOOSE_SOUND = 0x2208;
// Packed data: 80:F2A0 unpacks A (bank Y) to bank 7E at X, 80:F2A4 to bank 7F at X.
const LARGE_FRAMES_PACKED = 0x87d71a,
  SMALL_FRAMES_PACKED = 0x84f9e8;
// Scene lists run by 81:EC16 (address in X, bank in Y; src/data/scene-lists.mjs).
const START_MENU_LIST = 0x81f7b5;
// Start menu 81:E14A/E1B4 and its input 81:E29F. B or Start chooses, Up moves back, Select
// or Down forward; the menu times out (sooner right after the title) as if cancelled.
const MENU_CONFIRM = PAD_B | PAD_START,
  MENU_PREVIOUS = PAD_UP,
  MENU_NEXT = PAD_SELECT | PAD_DOWN,
  MENU_TIMEOUT = 0x960,
  MENU_TIMEOUT_AFTER_TITLE = 0x12c,
  MENU_NONE = WORD_MASK, // no row (timeout) or no save slot (a new game)
  MENU_CANCELLED = 0xfffe,
  MENU_START_CUE = 2, // APU port 2 value the start menu waits for
  MENU_ROWS = 3,
  MENU_CREDITS = MENU_ROWS,
  ENHANCED_MENU_ROWS = MENU_ROWS + 1,
  MENU_SAVED_GAME = 1,
  MENU_OPTIONS = 2,
  OPTIONS_ROWS = 4,
  DP_MENU_LAST_ROW = 0x10,
  // Shifted right before it is stored: full, then event, then off, then full again.
  MUSIC_SETTING_CYCLE = SETTINGS_MUSIC_FULL * 2 + 1,
  TITLE_BASE_COLOURS_BYTES = 0x20; // colours 0-15 from 85:EBC0
const sequenceCall =
  (h, e, r) =>
  (pc, target, long = false) =>
    frontendCallSequence(h, e, r, pc, target, long);

// Original routine $81:E29F.
function chooseMenuRow(h, e, r = START_MENU_REFERENCE_ROUTINES) {
  return drainNativeSequence(chooseMenuRowSequence(h, e, r));
}
function* chooseMenuRowSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  h.load(MENU_ARROW_CHAR);
  yield* call(0x81e2a2, 0x81e32f);
  // The first entry goes directly to the disabled-row check at E310.
  const disabled = () => {
    h.load(h.dp(DP_MENU_CURSOR));
    h.asl();
    h.index('y', ctx.a);
    h.load(h.read(h.abs(MENU_ROW_DISABLED) + ctx.y));
    return !(ctx.status & FLAG_ZERO);
  };
  const next = function* () {
    h.dpWrite(DP_MENU_LAST_ROW, ctx.x, 2);
    h.modify(DP_MENU_LAST_ROW, 'dec', true);
    h.load(h.dp(DP_MENU_CURSOR));
    h.cmp(h.dp(DP_MENU_LAST_ROW));
    if (ctx.status & FLAG_ZERO) h.load(WORD_MASK);
    h.load(ctx.a + 1);
    yield* call(0x81e30d, 0x81e343);
  };
  while (disabled()) yield* next();
  for (;;) {
    yield* call(0x81e2a7, 0x81eebb, true);
    h.modify(DP_MENU_TIMEOUT, 'dec', true);
    // Legacy recorded credits requests (src/game/credits.mjs) leave like the timeout.
    if (ctx.status & FLAG_ZERO || creditsRequested(h.a.vm)) {
      markStartMenu(h.a.vm, false);
      h.load(MENU_NONE);
      h.dpWrite(DP_MENU_CURSOR, ctx.a);
      return h.rts();
    }
    markStartMenu(h.a.vm, true);
    yield* call(0x81e2af, 0x80f298, true);
    h.load(h.read(h.abs(PAD_PRESSED)));
    h.load(ctx.a & MENU_CONFIRM);
    if (!(ctx.status & FLAG_ZERO)) break;
    h.load(h.read(h.abs(PAD_PRESSED)));
    h.load(ctx.a & MENU_PREVIOUS);
    if (!(ctx.status & FLAG_ZERO)) {
      h.phx();
      h.index('x', MENU_MOVE_SOUND);
      h.load(APU_COMMAND_SOUND_VOLUME);
      yield* call(0x81e2ca, 0x81f007, true);
      h.plx();
      h.load(MENU_TIMEOUT);
      h.dpWrite(DP_MENU_TIMEOUT, ctx.a);
      do {
        h.load(h.dp(DP_MENU_CURSOR));
        if (ctx.status & FLAG_ZERO) h.load(ctx.x);
        h.load(ctx.a - 1);
        yield* call(0x81e2da, 0x81e343);
      } while (disabled());
    }
    h.load(h.read(h.abs(PAD_PRESSED)));
    h.load(ctx.a & MENU_NEXT);
    if (!(ctx.status & FLAG_ZERO)) {
      h.phx();
      h.index('x', MENU_MOVE_SOUND);
      h.load(APU_COMMAND_SOUND_VOLUME);
      yield* call(0x81e2f5, 0x81f007, true);
      h.plx();
      h.load(MENU_TIMEOUT);
      h.dpWrite(DP_MENU_TIMEOUT, ctx.a);
      do {
        yield* next();
      } while (disabled());
    }
  }
  markStartMenu(h.a.vm, false);
  h.load(MENU_BLANK_CHAR);
  yield* call(0x81e31f, 0x81e32f);
  h.phx();
  h.index('x', MENU_CHOOSE_SOUND);
  h.load(APU_COMMAND_SOUND_VOLUME);
  yield* call(0x81e329, 0x81f007, true);
  h.plx();
  return h.rts();
}

// Original routine $81:E14A.
function openStartMenu(h, e, r = START_MENU_REFERENCE_ROUTINES) {
  return drainNativeSequence(openStartMenuSequence(h, e, r));
}
function* openStartMenuSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.pha();
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', APU_FULL_VOLUME);
  yield* call(0x81e154, 0x81f007, true);
  h.load(SONG_START_MENU);
  yield* call(0x81e15b, 0x81f229, true);
  for (const [pc, t] of [
    [0x81e15f, 0x81eb97],
    [0x81e163, 0x81e8e5],
    [0x81e167, 0x81ebe9],
  ])
    yield* call(pc, t, true);
  h.index('x', START_MENU_LIST & WORD_MASK);
  h.index('y', START_MENU_LIST >>> WORD_BITS);
  yield* call(0x81e171, 0x81ec16, true);
  yield* call(0x81e175, 0x81eb7b, true);
  yield* call(0x81e179, 0x81d555, true);
  h.index('x', TITLE_FADE_BYTES - 2);
  h.load(COLOUR_MASK);
  do {
    h.write(TITLE_FADE_COLOURS + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.index('x', TITLE_BASE_COLOURS_BYTES - 2);
  do {
    h.load(h.read(0x85ebc0 + ctx.x));
    h.write(TITLE_PALETTE + ctx.x, ctx.a);
    downX(h);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [pc, x, y, a] of [
    [
      0x81e1a3,
      LARGE_FRAME_GRAPHICS,
      LARGE_FRAMES_PACKED >>> WORD_BITS,
      LARGE_FRAMES_PACKED & WORD_MASK,
    ],
    [
      0x81e1b0,
      SMALL_FRAME_GRAPHICS,
      SMALL_FRAMES_PACKED >>> WORD_BITS,
      SMALL_FRAMES_PACKED & WORD_MASK,
    ],
  ]) {
    h.index('x', x);
    h.index('y', y);
    h.load(a);
    yield* call(pc, 0x80f2a4, true);
  }
  ctx.pc = 0x81e1b4 & WORD_MASK;
  const run = r.get(0x81e1b4) ?? runStartMenu;
  if (run === runStartMenu) return yield* startMenuSequence(h, e, r);
  let result;
  yield () => {
    result = run(h, e, r);
  };
  return result;
}
// Fallthrough after both new-game graphics streams, without another stack frame.
// The music beat wait on port 2 takes its lag-free NMI at BNE E1BB.
// Original routine $81:E1B4.
function runStartMenu(h, e, r = START_MENU_REFERENCE_ROUTINES) {
  return drainNativeSequence(startMenuSequence(h, e, r));
}
function* startMenuSequence(h, e, r) {
  const { ctx } = h,
    call = sequenceCall(h, e, r);
  const step = (pc) => {
    if (steppedInterrupts(e)) interruptStep(h, e, pc);
  };
  step(0x81e1b4);
  h.sep(FLAG_MEMORY_8BIT);
  do {
    yield () => {
      step(0x81e1b6);
      h.load(h.port(APUIO2, 1, 0x81e1b6));
      step(0x81e1b9);
      h.cmp(MENU_START_CUE);
      step(0x81e1bb);
    };
  } while (!(ctx.status & FLAG_ZERO));
  step(0x81e1bd);
  h.rep(FLAG_MEMORY_8BIT);
  yield* call(0x81e1bf, 0x81eedd, true);
  yield* call(0x81e1c3, 0x81e50c);
  h.load(MENU_TIMEOUT);
  h.plx();
  if (!(ctx.status & FLAG_ZERO)) h.load(MENU_TIMEOUT_AFTER_TITLE);
  h.dpWrite(DP_MENU_TIMEOUT, ctx.a);
  const finish = function* (cancel = false) {
    h.load(APU_COMMAND_VOLUME_TARGET);
    h.index('x', 0);
    yield* call(cancel ? 0x81e288 : 0x81e272, 0x81f007, true);
    yield* call(cancel ? 0x81e28c : 0x81e276, 0x81eef1, true);
    yield* call(cancel ? 0x81e290 : 0x81e27a, 0x81eb89, true);
    h.load(cancel ? MENU_CANCELLED : h.dp(DP_MENU_CHOICE));
    h.plp();
    return h.rtl();
  };
  for (;;) {
    yield* call(0x81e1d1, 0x81e38d);
    h.dpWrite(DP_MENU_CURSOR, 0);
    for (;;) {
      // The live VM adds a fourth row; source-only equations retain the original menu.
      h.index('x', h.a.vm?.startMenuCredits ? ENHANCED_MENU_ROWS : MENU_ROWS);
      yield* call(0x81e1d9, 0x81e29f);
      h.load(MENU_NONE);
      h.dpWrite(DP_MENU_CHOICE, ctx.a);
      h.load(h.dp(DP_MENU_CURSOR));
      if (ctx.status & FLAG_ZERO) {
        yield* call(0x81e269, 0x81e354);
        return yield* finish();
      }
      if (ctx.status & FLAG_NEGATIVE) return yield* finish(true);
      h.cmp(MENU_SAVED_GAME);
      if (ctx.status & FLAG_ZERO) {
        // Saved games: slot rows and EXIT (four-slot option: src/game/save-slots.mjs).
        const slots = saveSlotCount(h.a);
        yield* call(0x81e250, 0x81e3da);
        h.dpWrite(DP_MENU_CURSOR, 0);
        h.index('x', slots + 1);
        yield* call(0x81e258, 0x81e29f);
        h.load(h.dp(DP_MENU_CURSOR));
        if (ctx.status & FLAG_NEGATIVE) return yield* finish(true);
        h.cmp(slots);
        if (ctx.status & FLAG_ZERO) break;
        h.dpWrite(DP_MENU_CHOICE, ctx.a);
        yield* call(0x81e269, 0x81e354);
        return yield* finish();
      }
      if (h.a.vm?.startMenuCredits && ctx.a === MENU_CREDITS) {
        requestCredits(h.a.vm);
        return yield* finish(true);
      }
      h.cmp(MENU_OPTIONS);
      if (!(ctx.status & FLAG_ZERO)) continue;
      h.dpWrite(DP_MENU_CURSOR, 0);
      for (;;) {
        h.sep(FLAG_MEMORY_8BIT);
        yield* call(0x81e1fd, 0x81d5e4, true);
        h.rep(FLAG_MEMORY_8BIT);
        yield* call(0x81e203, 0x81ef36, true);
        yield* call(0x81e207, 0x81e446);
        h.index('x', OPTIONS_ROWS);
        yield* call(0x81e20d, 0x81e29f);
        h.load(h.dp(DP_MENU_CURSOR));
        if (ctx.status & FLAG_NEGATIVE) return yield* finish(true);
        h.load(ctx.a - 1);
        if (ctx.status & FLAG_NEGATIVE) {
          h.sep(FLAG_MEMORY_8BIT);
          h.load(h.read(SETTINGS_CONTROL));
          h.load(ctx.a ^ SETTINGS_CONTROL_TYPE_A);
          h.load(ctx.a & SETTINGS_CONTROL_TYPE_A);
          h.write(SETTINGS_CONTROL, ctx.a);
          continue;
        }
        h.load(ctx.a - 1);
        if (ctx.status & FLAG_NEGATIVE) {
          h.sep(FLAG_MEMORY_8BIT);
          h.load(h.read(SETTINGS_STEREO));
          h.load(ctx.a ^ SETTINGS_STEREO_ON);
          h.load(ctx.a & SETTINGS_STEREO_ON);
          h.write(SETTINGS_STEREO, ctx.a);
          continue;
        }
        h.load(ctx.a - 1);
        if (!(ctx.status & FLAG_NEGATIVE)) break;
        h.sep(FLAG_MEMORY_8BIT);
        h.load(h.read(SETTINGS_MUSIC));
        if (ctx.status & FLAG_ZERO) h.load(MUSIC_SETTING_CYCLE);
        h.lsr();
        h.write(SETTINGS_MUSIC, ctx.a);
      }
      break;
    }
  }
}

// The reference start menu and its texts in place of the lifted ones.
const REFERENCE = [
  [0x81e14a, openStartMenu, openStartMenuSequence],
  [0x81e1b4, runStartMenu, startMenuSequence],
  [0x81e29f, chooseMenuRow, chooseMenuRowSequence],
];
export const START_MENU_REFERENCE_ENTRIES = [
  ...INTRO_SETUP_REFERENCE_ENTRIES,
  ...START_MENU_TEXT_ENTRIES,
  ...REFERENCE.map(([target, run]) => [target, run]),
];
export const START_MENU_REFERENCE_ROUTINES = new Map([
  ...FRONTEND_NMI_ROUTINES,
  ...START_MENU_REFERENCE_ENTRIES,
]);
for (const [, run, sequence] of REFERENCE)
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events, routines = START_MENU_REFERENCE_ROUTINES }) =>
      new NativeCallContinuation(h.a, sequence(h, events, routines)),
  });
