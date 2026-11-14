import { FIRST_ARGUMENT } from './native-leaf-support.mjs';
import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { showNotice, showNoticeSequence, validateNoticeOptions } from './native-notice.mjs';
import { setTextCursor, printNumber } from './native-list-prerequisites.mjs';
import { printText, printTextSequence } from './native-text-compose.mjs';
import { observedContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { playSoundEffect, setMusicMode } from './native-audio-compose.mjs';
import {
  DP_CURSOR_ROW,
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  FIGHT_FIRST_REMOVAL,
  FIGHT_KARMA,
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  FIGHT_MUSIC,
  GAME_OPTIONS,
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_POSITIONS,
  KARMA,
  OPTION_MUSIC_RESTORE,
  WRAM,
} from './wram.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
import {
  WORD_MASK,
  WORD_BITS,
  BANK_WRAP,
  BANK_SIZE,
  BYTE_MASK,
  LONG_BYTES,
} from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// 80:855E: remove the object (first argument) from the fight list 1FB2 (searched downward from X = 1FB0, missing
// returns). The first removal (1FCE = 0, DEC to FFFF) counts down the nonzero words 7E2DF8+X for
// X = 7E2DE6 down to 0, unless 1D6B or 7E2DE6 is negative. A nonempty list returns after 1FB0 -= 2.
// The empty list ends the fight: the gain 7E3C11 >> 3 minus 1FCC (nonzero) goes to 1FCC and is
// shown in a notice (FEC1, width 9 or 10 from 10 on, FAAC, FD80, text 7117, sound 32 by C46E).
// With bit 1 of 1FD6 a nonnegative 1FCA restores that music through EF47, without it mode 0.
// The karma notice 0A/02/09/03 (ten columns from a gain of 10 on) shows text 4 for 78 frames;
// FE69 adds text 7117 and C46E plays sound 32 at level FF on voices 7.
const KARMA_NOTICE = Object.freeze({
    left: 10,
    top: 2,
    columns: 9,
    wideColumns: 10,
    wideFrom: 10,
    rows: 3,
    text: 4,
    frames: 0x78,
  }),
  TEXT_KARMA_GAIN = 0x7117,
  KARMA_SOUND = 0x32,
  KARMA_SOUND_LEVEL = BYTE_MASK,
  KARMA_SOUND_VOICES = 7;
// Proved routines called by 855E. Tests may pass a replacement for a routine with its own proof.
export const FIGHT_LIST_REMOVE_ROUTINES = Object.freeze({
  notice: (a, events) => showNotice(a, events, false),
  cursor: (a, events) => setTextCursor(a, events, false),
  number: (a, events) => printNumber(a, events, false),
  text: (a, events) => printText(a, events, false),
  sound: (a, events) => playSoundEffect(a, events, false),
  music: (a, events) => setMusicMode(a, events, false),
});
export function removeFromFightList(
  a,
  events,
  outerReturn = true,
  routines = FIGHT_LIST_REMOVE_ROUTINES,
) {
  return drainNativeSequence(removeFromFightListSequence(a, events, outerReturn, routines));
}
// The notice FEC1 and text FE69 keep their own sequences unless a test
// replaces them; the remaining helpers stay single segments.
function* removeFromFightListSequence(
  a,
  events,
  outerReturn,
  routines = FIGHT_LIST_REMOVE_ROUTINES,
) {
  if (a.ctx.d !== 0 || a.ctx.programBank !== CODE_BANK) taskStop('task_855e_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const decrement = (address) => {
    const value = h.nz((h.read(address) - 1) & WORD_MASK, 2);
    h.write(address, value);
  };
  const call = function* (pc, target, body, long = false) {
    let bank;
    const raw = (pc + (long ? LONG_BYTES : 2)) & WORD_MASK;
    yield () => {
      bank = ctx.programBank;
      if (long) h.pushByte(bank, '855E-JSL-bank');
      a.pushWord(raw, '855E-call-return');
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const p = yield* body();
    yield () => {
      if (p.rawReturnWord !== raw || ctx.programBank !== bank || ctx.pc !== ((raw + 1) & WORD_MASK))
        taskStop('task_native_helper_return_required', {
          pc,
          raw: p.rawReturnWord,
          bank: ctx.programBank,
          returnTarget: p.returnTarget,
        });
      if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
        taskStop('task_855e_helper_mode_required', { pc });
    };
    return p;
  };
  const routine = (name, sequence = null) =>
    sequence && routines[name] === FIGHT_LIST_REMOVE_ROUTINES[name]
      ? sequence()
      : (function* () {
          let result;
          yield () => {
            result = routines[name](a, events);
          };
          return result;
        })();
  const finish = (outcome) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('task_855e_return_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      '855E-RTS-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-855e',
      outcome,
    };
  };
  let result = null,
    notice = false,
    restore;
  yield () => {
    index('x', h.read(h.abs(FIGHT_LIST_INDEX)));
    for (;;) {
      if (ctx.status & FLAG_NEGATIVE) {
        result = finish('fight_entry_missing');
        return;
      }
      h.load(h.read(h.abs(FIGHT_LIST) + ctx.x));
      h.compare(ctx.a, h.dp(FIRST_ARGUMENT));
      if (ctx.status & FLAG_ZERO) break;
      index('x', (ctx.x - 1) & WORD_MASK);
      index('x', (ctx.x - 1) & WORD_MASK);
    }
    do {
      h.load(h.read(h.abs(FIGHT_LIST + 2) + ctx.x));
      h.write(h.abs(FIGHT_LIST) + ctx.x, ctx.a);
      index('x', (ctx.x + 1) & WORD_MASK);
      index('x', (ctx.x + 1) & WORD_MASK);
      const end = h.read(h.abs(FIGHT_LIST_INDEX));
      ctx.status = (ctx.status & ~FLAG_CARRY) | Number(ctx.x >= end);
      h.nz((ctx.x - end) & WORD_MASK, 2);
    } while (!(ctx.status & FLAG_CARRY));
    h.load(h.read(h.abs(FIGHT_FIRST_REMOVAL)));
    if (ctx.status & FLAG_ZERO) {
      decrement(h.abs(FIGHT_FIRST_REMOVAL));
      h.load(h.read(h.abs(GROUP_LEADER_ONLY)));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        h.load(h.read(WRAM + GROUP_INDEX));
        if (!(ctx.status & FLAG_NEGATIVE)) {
          index('x', ctx.a);
          do {
            h.load(h.read(WRAM + GROUP_POSITIONS + ctx.x));
            if (!(ctx.status & FLAG_ZERO)) {
              h.load((ctx.a - 1) & WORD_MASK);
              h.write(WRAM + GROUP_POSITIONS + ctx.x, ctx.a);
            }
            index('x', (ctx.x - 1) & WORD_MASK);
            index('x', (ctx.x - 1) & WORD_MASK);
          } while (!(ctx.status & FLAG_NEGATIVE));
        }
      }
    }
    decrement(h.abs(FIGHT_LIST_INDEX));
    decrement(h.abs(FIGHT_LIST_INDEX));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      result = finish('fight_entry_removed');
      return;
    }
    h.load(h.read(WRAM + KARMA));
    h.lsr();
    h.lsr();
    h.lsr();
    ctx.status |= FLAG_CARRY;
    h.arithmetic(h.read(h.abs(FIGHT_KARMA)), true);
    if (!(ctx.status & FLAG_ZERO)) {
      notice = true;
      h.write(h.abs(FIGHT_KARMA), ctx.a);
      h.compare(ctx.a, KARMA_NOTICE.wideFrom);
      h.load(ctx.status & FLAG_CARRY ? KARMA_NOTICE.wideColumns : KARMA_NOTICE.columns);
      for (const [o, n] of [
        [DP_WINDOW_COLUMNS, null],
        [DP_WINDOW_LEFT, KARMA_NOTICE.left],
        [DP_WINDOW_TOP, KARMA_NOTICE.top],
        [DP_WINDOW_ROWS, KARMA_NOTICE.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
        [DP_NOTICE_TEXT, KARMA_NOTICE.text],
        [DP_NOTICE_FRAMES, KARMA_NOTICE.frames],
      ]) {
        if (n !== null) h.load(n);
        h.dpWrite(o, ctx.a);
      }
    }
  };
  if (result) return result;
  if (notice) {
    yield* call(0x8085e4, 0x80fec1, () =>
      routine('notice', () => showNoticeSequence(a, events, false)),
    );
    yield () => {
      h.dpWrite(0, ctx.a);
      h.dpWrite(2, 0);
      h.dpWrite(DP_CURSOR_ROW, 0);
    };
    yield* call(0x8085ed, 0x80faac, () => routine('cursor'));
    yield () => {
      h.load(h.read(h.abs(FIGHT_KARMA)));
      h.dpWrite(2, ctx.a);
    };
    yield* call(0x8085f5, 0x80fd80, () => routine('number'));
    yield () => {
      h.load(TEXT_KARMA_GAIN);
      h.dpWrite(2, ctx.a);
    };
    yield* call(0x8085fd, 0x80fe69, () =>
      routine('text', () => printTextSequence(a, events, false)),
    );
    yield () => {
      for (const [o, n] of [
        [0, WORD_MASK],
        [DP_SOUND_LEVEL, KARMA_SOUND_LEVEL],
        [DP_SOUND_VOICE, KARMA_SOUND_VOICES],
        [DP_SOUND_EFFECT, KARMA_SOUND],
      ]) {
        h.load(n);
        h.dpWrite(o, ctx.a);
      }
    };
    yield* call(0x808614, 0x80c46e, () => routine('sound'));
  }
  yield () => {
    h.load(h.read(h.abs(GAME_OPTIONS)) & OPTION_MUSIC_RESTORE);
    restore = !(ctx.status & FLAG_ZERO);
    if (!restore) h.load(0);
    else {
      h.load(h.read(h.abs(FIGHT_MUSIC)));
      if (ctx.status & FLAG_NEGATIVE)
        result = finish(notice ? 'fight_ended_notice' : 'fight_ended');
    }
  };
  if (result) return result;
  yield* call(restore ? 0x808624 : 0x80862c, 0x81ef47, () => routine('music'), true);
  yield () => {
    result = finish(notice ? 'fight_ended_notice_music' : 'fight_ended_music');
  };
  return result;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level native.
function observeRemoveFromFightList(a, options, outerReturn, lifted = null) {
  const invalid = validateNoticeOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: options?.waitMode ?? null,
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    return { ...result, waitObservationsUsed: events.waitIndex };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : removeFromFightListSequence(a, events, outerReturn);
  return { sequence, finish };
}
export function removeFromFightListObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeRemoveFromFightList(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createRemoveFromFightListObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeRemoveFromFightList(a, options, false, lifted));
