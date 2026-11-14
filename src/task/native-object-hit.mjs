import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { randomBelow, taskRandomDevices } from './native-random.mjs';
import { createObject } from './native-object-create.mjs';
import { playSoundEffect, taskAudioDevices } from './native-audio-compose.mjs';
import { releaseWindowJsrSequence } from '../game/window-release.mjs';
import { f963Sequence } from './native-window-open.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { printTextSequence } from './native-text-compose.mjs';
import { waitForRandomStateChange } from './native-frame-wait.mjs';
import { waitForConfirmKeySequence } from './native-input-wait.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { ObservedWaitContinuation, lagFree } from './main-wait-interrupt.mjs';
import { drawWindowListJslSequence } from '../game/window-list.mjs';
import {
  NATIVE_CALL_CONTINUATIONS,
  NativeCallContinuation,
  observedContinuation,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { taskActionsDevices, validateTaskActionsOptions } from './native-actions.mjs';
import { taskRandomTableSources } from './native-random-tables.mjs';
import { native8E36Table } from './native-object-hit-tables.mjs';
import { protectedJakeHealth } from '../game/cheats.mjs';
import {
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  HARMLESS_HITS,
  KARMA,
  OBJECT_ARMOUR,
  OBJECT_DAMAGEABLE,
  OBJECT_HITTABLE,
  OBJECT_LAST_SLOT,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_HIT_FRAMES,
  RECORD_COUNT,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_RECORD,
  OBJECT_TASK,
  PLAYER_OBJECT,
  WRAM,
  OBJECT_BOX_HEIGHT,
} from './wram.mjs';
import {
  WORD_MASK,
  BANK_WRAP,
  BANK_SIZE,
  WORD_BITS,
  BYTE_MASK,
  LONG_MASK,
  LONG_BYTES,
  BYTE_BITS,
  HEX_RADIX,
} from '../constants/bits.mjs';
import { TASK_EVENTS, TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// Result word and shooter slot of a hit (8691), shared with the shots of 8AB5/8A51/8A8C:
// the result is 0, FFFF after a kill flag or 1 after a notice; a negative shooter (8E36)
// places no impact object.
export const DP_HIT_RESULT = 0xb4,
  DP_HIT_SHOOTER = 0xb7;
// 8691: the fourth hit on a harmless object warns ("Jake, do not attack those who mean you
// no harm.", 74BA at 06/06/14/04), the eighth costs 8 karma eighths, one karma point
// ("Jake, I must punish you for your lack of compassion. -1 Karma.", 74D2 at 04/04/19/04).
// Each notice waits thirty B0A1 counters before the key input F953.
const HARMLESS_WARNING = Object.freeze({ hits: 4, margin: 6, columns: 20, text: 0x74ba }),
  HARMLESS_PENALTY = Object.freeze({ hits: 8, margin: 4, columns: 25, text: 0x74d2 }),
  HARMLESS_NOTICE_ROWS = 4,
  KARMA_PENALTY = 8,
  NOTICE_COUNTER_WAITS = 30;
// A damaged object wakes its root task with event bit 11; the hit effect object A1 runs
// script 10F four units above the box. With a shooter the impact object E7 (script 80)
// sits one unit towards the shooter's facing (offsets 80:8850) with the facing of 80:8840.
const HIT_EVENT = 0x800,
  HIT_EFFECT_KIND = 0xa1,
  HIT_EFFECT_SCRIPT = 0x10f,
  HIT_EFFECT_RAISE = 4,
  IMPACT_KIND = 0xe7,
  IMPACT_SCRIPT = 0x80,
  IMPACT_OFFSETS = 0x8850,
  IMPACT_FACINGS = 0x8840;
// 881C: a hit player plays sound 20 at level FF on voices 7 and stays stunned 11 frames.
const PLAYER_HIT_SOUND = 0x20,
  PLAYER_HIT_SOUND_LEVEL = BYTE_MASK,
  PLAYER_HIT_SOUND_VOICES = 7,
  PLAYER_HIT_STUN = 11;
// 80:8E36 hitObjectsInBlast: the blast centre object (first argument) and damage (second), and its reach below 60 on every axis.
const DP_BLAST_CENTRE = 0xa2,
  DP_BLAST_DAMAGE = 0xa5,
  BLAST_REACH = 0x60;
export const hitObjectsInBlastDevices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([
        ...new Set([
          ...taskActionsDevices[key],
          ...taskAudioDevices[key],
          ...taskRandomDevices[key],
        ]),
      ]),
    ]),
  ),
);

// Fixed original equations. Each helper shares this private owner, access ledger
// and budget. Instructions are never decoded or dispatched by this module.
// Every call builds its real frame first; the notice helpers F963, FE69, B0A1,
// F953 and FA3E and the render AD92 keep their own sequences, so their waits
// can pause inside 8691. C51F, A835 and the APU handshake C46E stay segments.
function access(a, events) {
  if (a.ctx.d !== 0 || a.ctx.bank !== CODE_BANK || a.ctx.programBank !== CODE_BANK)
    taskStop('task_8e36_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const bit = (mask) => {
    ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
    return Boolean(ctx.a & mask);
  };
  const finish = (outer) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('task_8e36_return_mode_required');
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, '8e36-RTS-fresh', outer);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
    };
  };
  const call = function* (pc, target, body, long = false) {
    const raw = (pc + (long ? LONG_BYTES : 2)) & WORD_MASK;
    let bank;
    yield () => {
      bank = ctx.programBank;
      if (long) h.pushByte(bank, '8e36-JSL-bank');
      a.pushWord(raw, '8e36-call-return');
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
      if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT) || ctx.bank !== CODE_BANK)
        taskStop('task_8e36_helper_context_required', { pc });
      events.calls.push(
        Object.freeze({ pc, target, rawReturnWord: p.rawReturnWord, returnTarget: p.returnTarget }),
      );
    };
    return p;
  };
  const segment = function* (run) {
    let result;
    yield () => {
      result = run();
    };
    return result;
  };
  return { ...h, index, compare, bit, finish, call, segment };
}
// Original routine $80:881C.
function* runPlayerHit(a, events) {
  const h = access(a, events),
    { ctx } = h;
  h.compare(ctx.y, h.read(h.abs(PLAYER_OBJECT)));
  if (!(ctx.status & FLAG_ZERO)) return h.finish(false);
  h.dpWrite(0, ctx.y);
  for (const [o, n] of [
    [DP_SOUND_LEVEL, PLAYER_HIT_SOUND_LEVEL],
    [DP_SOUND_VOICE, PLAYER_HIT_SOUND_VOICES],
    [DP_SOUND_EFFECT, PLAYER_HIT_SOUND],
  ]) {
    h.load(n);
    h.dpWrite(o, ctx.a);
  }
  yield* h.call(0x808832, 0x80c46e, () => h.segment(() => playSoundEffect(a, events, false)));
  h.load(PLAYER_HIT_STUN);
  h.write(h.abs(PLAYER_HIT_FRAMES), ctx.a);
  yield* h.call(0x80883b, 0x81ad92, () => drawWindowListJslSequence(a, events), true);
  return h.finish(false);
}
// 80:8691: hit the object in X with the damage in A (see the notes above).
export function hitObject(a, events, outerReturn = true) {
  return drainNativeSequence(hitObjectSequence(a, events, outerReturn));
}
// 80:8691 for routine tables: called with its JSR frame pushed (h, events), it returns
// with its RTS; its notices pause in the scheduler's continuation.
export const runHitObject = (h, events) => hitObject(h.a, events, false);
NATIVE_CALL_CONTINUATIONS.set(runHitObject, {
  run: runHitObject,
  create: ({ h, events }) => new NativeCallContinuation(h.a, hitObjectSequence(h.a, events, false)),
});
function* hitObjectSequence(a, events, outerReturn) {
  const h = access(a, events),
    { ctx } = h,
    interrupts = events.interrupts !== undefined;
  const slice = (values, index) => Object.freeze((values ?? []).slice(index));
  const counter = (pc) =>
    h.call(
      pc,
      0x81b0a1,
      function* () {
        if (interrupts)
          return yield {
            continuation: new ObservedWaitContinuation(dialogAccess(a), events, 0x81b0a1),
          };
        const p = yield* h.segment(() =>
          waitForRandomStateChange(
            a,
            { waitMode: events.mode, waitObservations: slice(events.values, events.waitIndex) },
            false,
            true,
          ),
        );
        yield () => {
          events.waitIndex += p.waitObservationsUsed;
        };
        return p;
      },
      true,
    );
  const notice = function* (
    allocate,
    text,
    wait,
    input,
    remove,
    { margin, columns, text: pointer },
  ) {
    for (const [o, n] of [
      [DP_WINDOW_LEFT, margin],
      [DP_WINDOW_TOP, margin],
      [DP_WINDOW_COLUMNS, columns],
      [DP_WINDOW_ROWS, HARMLESS_NOTICE_ROWS],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]) {
      h.load(n);
      h.dpWrite(o, ctx.a);
    }
    fitListWindow(a.mem, h, [pointer], { column: 0 });
    yield* h.call(allocate, 0x80f963, function* () {
      const p = yield* f963Sequence(
        a,
        {
          mode: events.mode,
          interruptEvents: events,
          values: slice(events.values, events.waitIndex),
        },
        false,
      );
      yield () => {
        events.waitIndex += p.waitObservationsUsed;
      };
      return p;
    });
    h.load(pointer);
    h.dpWrite(2, ctx.a);
    yield* h.call(text, 0x80fe69, () => printTextSequence(a, events, false));
    h.index('x', NOTICE_COUNTER_WAITS);
    do {
      yield* counter(wait);
      h.index('x', (ctx.x - 1) & WORD_MASK);
    } while (!(ctx.status & FLAG_ZERO));
    yield* h.call(input, 0x80f953, function* () {
      const p = yield* waitForConfirmKeySequence(
        a,
        {
          interruptEvents: events,
          waitMode: events.mode,
          waitObservations: slice(events.values, events.waitIndex),
          inputMode: events.inputMode,
          inputObservations:
            events.inputs === null ? null : slice(events.inputs, events.inputIndex),
        },
        false,
        true,
      );
      yield () => {
        events.waitIndex += p.waitObservationsUsed;
        events.inputIndex += p.inputObservationsUsed;
      };
      return p;
    });
    yield* h.call(remove, 0x80fa3e, () => releaseWindowJsrSequence(a, events));
  };
  h.dpWrite(0, ctx.a);
  h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
  if (!h.bit(OBJECT_DAMAGEABLE)) {
    if (!h.bit(OBJECT_HITTABLE)) return h.finish(outerReturn);
    h.load(h.read(h.abs(HARMLESS_HITS)));
    h.load((ctx.a + 1) & WORD_MASK);
    h.write(h.abs(HARMLESS_HITS), ctx.a);
    h.compare(ctx.a, HARMLESS_WARNING.hits);
    if (!(ctx.status & FLAG_CARRY)) return h.finish(outerReturn);
    if (ctx.status & FLAG_ZERO) {
      yield* notice(0x8087a1, 0x8087a9, 0x8087af, 0x8087b6, 0x8087b9, HARMLESS_WARNING);
      h.load(1);
      h.dpWrite(DP_HIT_RESULT, ctx.a);
      return h.finish(outerReturn);
    }
    h.compare(ctx.a, HARMLESS_PENALTY.hits);
    if (!(ctx.status & FLAG_ZERO)) return h.finish(outerReturn);
    h.load(h.read(WRAM + KARMA));
    h.compare(ctx.a, KARMA_PENALTY);
    if (ctx.status & FLAG_CARRY) {
      yield* notice(0x8087e7, 0x8087ef, 0x8087f5, 0x8087fc, 0x8087ff, HARMLESS_PENALTY);
      ctx.status |= FLAG_CARRY;
      h.load(h.read(WRAM + KARMA));
      h.arithmetic(KARMA_PENALTY, true);
      if (!(ctx.status & FLAG_CARRY)) h.load(0);
    } else h.load(0);
    h.write(WRAM + KARMA, ctx.a);
    h.write(h.abs(HARMLESS_HITS), 0);
    h.load(1);
    h.dpWrite(DP_HIT_RESULT, ctx.a);
    return h.finish(outerReturn);
  }
  h.dpWrite(DP_HIT_SHOOTER, ctx.y);
  a.pushWord(ctx.x, '8691-PHX');
  yield* h.call(0x8086a1, 0x80c51f, () => h.segment(() => randomBelow(a, false)));
  h.index('y', a.pullWord('8691-PLY-fresh'));
  ctx.status |= FLAG_MEMORY_8BIT;
  h.load((ctx.a + 1) & BYTE_MASK, 1);
  ctx.status |= FLAG_CARRY;
  h.index('x', ctx.y);
  h.arithmetic(h.read(WRAM + OBJECT_ARMOUR + ctx.x, 1), true);
  if (!(ctx.status & (FLAG_ZERO | FLAG_NEGATIVE))) {
    h.dpWrite(0, ctx.a, 1);
    h.index('x', h.read(h.abs(OBJECT_RECORD) + ctx.y, 2));
    let writeBack = false;
    if (!(ctx.status & FLAG_ZERO)) {
      ctx.status |= FLAG_CARRY;
      h.load(h.read(WRAM + RECORD_COUNT + ctx.x, 1), 1);
      h.arithmetic(h.dp(0, 1), true);
      if (!(ctx.status & FLAG_CARRY)) h.load(0, 1);
      if (a.vm?.cheats) h.load(protectedJakeHealth(a, ctx.x, ctx.a & BYTE_MASK), 1);
      h.write(WRAM + RECORD_COUNT + ctx.x, ctx.a, 1);
      writeBack = !(ctx.status & FLAG_ZERO);
    }
    if (!writeBack) {
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.index('x', h.read(h.abs(OBJECT_TASK) + ctx.y, 2));
      if (ctx.status & FLAG_NEGATIVE) {
        // Original86CF jumps back to the very same STA in WORD mode. Preserve
        // hidden A-high, WORD-NZ, and repeat the original gate when A is zero.
        h.write(WRAM + RECORD_COUNT + ctx.x, ctx.a, 2);
        writeBack = true; // LDX-negative also guarantees original BNE.
      }
      if (!writeBack) {
        for (;;) {
          h.load(h.read(h.abs(TASK_WAIT) + ctx.x));
          if (!(ctx.status & FLAG_NEGATIVE)) break;
          h.load(h.read(h.abs(TASK_PREVIOUS) + ctx.x));
          h.index('x', ctx.a);
        }
        h.load(h.read(h.abs(TASK_EVENTS) + ctx.x));
        h.load(ctx.a | HIT_EVENT);
        h.write(h.abs(TASK_EVENTS) + ctx.x, ctx.a);
        h.load(WORD_MASK);
        h.dpWrite(DP_HIT_RESULT, ctx.a);
      }
    }
    ctx.status &= ~FLAG_MEMORY_8BIT;
    a.pushWord(h.dp(0, 2), '8691-PEI00');
    h.load(HIT_EFFECT_KIND);
    h.dpWrite(DP_OBJECT_KIND, ctx.a);
    for (const [field, offset] of [
      [OBJECT_X, DP_OBJECT_X],
      [OBJECT_Y, DP_OBJECT_Y],
    ]) {
      h.load(h.read(h.abs(field) + ctx.y));
      h.lsr();
      h.lsr();
      h.dpWrite(offset, ctx.a);
    }
    h.load(HIT_EFFECT_SCRIPT);
    h.dpWrite(DP_OBJECT_SCRIPT, ctx.a);
    h.load(h.read(h.abs(OBJECT_HEIGHT) + ctx.y));
    h.lsr();
    h.lsr();
    ctx.status &= ~FLAG_CARRY;
    h.index('x', ctx.y);
    h.arithmetic(h.read(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
    h.arithmetic(HIT_EFFECT_RAISE);
    h.dpWrite(DP_OBJECT_HEIGHT, ctx.a);
    a.pushWord(ctx.y, '8691-PHY');
    yield* h.call(0x808717, 0x80a835, () => h.segment(() => createObject(a, false)));
    h.index('y', a.pullWord('8691-PLY-fresh'));
    h.index('x', h.dp(0));
    h.load(a.pullWord('8691-PLA-fresh'));
    h.load((ctx.a - 1) & WORD_MASK);
    h.write(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
  }
  ctx.status &= ~FLAG_MEMORY_8BIT;
  h.index('x', h.dp(DP_HIT_SHOOTER));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    h.index('x', ctx.y);
    h.load(IMPACT_KIND);
    h.dpWrite(DP_OBJECT_KIND, ctx.a);
    h.load(h.read(h.abs(OBJECT_HEIGHT) + ctx.x));
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(h.read(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
    h.lsr();
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(h.read(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
    h.lsr();
    h.dpWrite(DP_OBJECT_HEIGHT, ctx.a);
    h.index('x', h.dp(DP_HIT_SHOOTER));
    h.load(h.read(h.abs(OBJECT_DIRECTION) + ctx.x));
    h.asl();
    h.index('x', ctx.a);
    for (const [field, offset] of [
      [OBJECT_X, DP_OBJECT_X],
      [OBJECT_Y, DP_OBJECT_Y],
    ]) {
      h.load(h.read(h.abs(field) + ctx.y));
      h.lsr();
      h.lsr();
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.read(h.abs(IMPACT_OFFSETS) + ctx.x));
      h.dpWrite(offset, ctx.a);
    }
    h.load(h.read(h.abs(IMPACT_FACINGS) + ctx.x));
    a.pushWord(ctx.a, '8691-PHA');
    h.load(IMPACT_SCRIPT);
    h.dpWrite(DP_OBJECT_SCRIPT, ctx.a);
    a.pushWord(ctx.y, '8691-PHY');
    yield* h.call(0x808767, 0x80a835, () => h.segment(() => createObject(a, false)));
    h.index('y', a.pullWord('8691-PLY-fresh'));
    h.load(a.pullWord('8691-PLA-fresh'));
    h.index('x', h.dp(0));
    h.write(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
  }
  yield* h.call(0x808772, 0x80881c, () => runPlayerHit(a, events));
  ctx.status &= ~FLAG_MEMORY_8BIT;
  return h.finish(outerReturn);
}
// routines (optional): a table whose hit 80:8691 runs instead (tests share stand-ins).
function* hitObjectsInBlastSequence(a, events, outerReturn, routines = null) {
  const h = access(a, events),
    { ctx } = h;
  let visits = 0,
    affected = 0;
  h.index('y', h.dp(0));
  h.dpWrite(DP_BLAST_CENTRE, ctx.y);
  h.load(h.dp(2));
  h.dpWrite(DP_BLAST_DAMAGE, ctx.a);
  h.index('x', OBJECT_LAST_SLOT);
  do {
    visits++;
    h.load(h.read(WRAM + OBJECT_KIND + ctx.x));
    let admitted = !(ctx.status & FLAG_NEGATIVE);
    if (admitted) {
      h.load(h.read(h.abs(OBJECT_FLAGS) + ctx.x));
      h.load(ctx.a & OBJECT_HITTABLE);
      admitted = !(ctx.status & FLAG_ZERO);
    }
    if (admitted)
      for (const field of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
        ctx.status |= FLAG_CARRY;
        h.load(h.read(h.abs(field) + ctx.x));
        h.arithmetic(h.read(h.abs(field) + ctx.y), true);
        if (ctx.status & FLAG_NEGATIVE) {
          h.load(ctx.a ^ WORD_MASK);
          h.load((ctx.a + 1) & WORD_MASK);
        }
        h.compare(ctx.a, BLAST_REACH);
        if (ctx.status & FLAG_CARRY) {
          admitted = false;
          break;
        }
      }
    if (admitted) {
      a.pushWord(ctx.x, '8e36-PHX');
      a.pushWord(ctx.y, '8e36-PHY');
      h.load(h.dp(DP_BLAST_DAMAGE));
      h.index('y', WORD_MASK);
      const tableHit = routines?.get(0x808691);
      yield* h.call(0x808e8c, 0x808691, function* () {
        if (!tableHit) return yield* hitObjectSequence(a, events, false);
        let result;
        yield () => {
          result = tableHit(dialogAccess(a), events);
        };
        return result;
      });
      h.index('y', a.pullWord('8e36-PLY-fresh'));
      h.index('x', a.pullWord('8e36-PLX-fresh'));
      affected++;
    }
    h.index('x', (ctx.x - 1) & WORD_MASK);
    h.index('x', (ctx.x - 1) & WORD_MASK);
  } while (!(ctx.status & FLAG_NEGATIVE));
  return {
    ...h.finish(outerReturn),
    visits,
    affected,
    scope: 'manual-original-7c-slot-loop-composition',
  };
}
// 80:8E36 with its hit from a routine table, drained.
export const hitObjectsInBlast = (a, events, outerReturn = true, routines = null) =>
  drainNativeSequence(hitObjectsInBlastSequence(a, events, outerReturn, routines));
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeHitObjectsInBlast(a, options, outerReturn, allowRemaining, lifted = null) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: options.waitMode ?? null,
      values: options.waitObservations ?? null,
      waitIndex: 0,
      inputMode: options.inputMode ?? null,
      inputs: options.inputObservations ?? null,
      inputIndex: 0,
      calls: [],
      waitEvents: [],
    },
    options,
  );
  const tables = [...taskRandomTableSources, native8E36Table];
  const check = (address, value, width) => {
    for (let n = 0; n < width; n++) {
      const pc = (address + n) & LONG_MASK,
        t = tables.find((t) => pc >= t.start && pc < t.start + t.hex.length / 2);
      if (
        t &&
        ((value >>> (BYTE_BITS * n)) & BYTE_MASK) !==
          parseInt(t.hex.slice((pc - t.start) * 2, (pc - t.start) * 2 + 2), HEX_RADIX)
      )
        taskStop('task_7c_table_source_required', { address: pc });
    }
    return value;
  };
  const view = {
    ...a,
    read: (address, ...rest) => check(address, a.read(address, ...rest), 1),
    readWord: (address, ...rest) => check(address, a.readWord(address, ...rest), 2),
  };
  const finish = (p) => {
    if (!allowRemaining && events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused');
    if (!allowRemaining && events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused');
    return {
      ...p,
      calls: Object.freeze(events.calls),
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  if (lifted !== null && lagFree(events))
    return { sequence: liftedResult(lifted(dialogAccess(a), events)), finish };
  return { sequence: hitObjectsInBlastSequence(view, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function hitObjectsInBlastObserved(
  a,
  options,
  outerReturn = true,
  allowRemaining = false,
  lifted = null,
) {
  const { sequence, finish } = observeHitObjectsInBlast(
    a,
    options,
    outerReturn,
    allowRemaining,
    lifted,
  );
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createHitObjectsInBlastObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeHitObjectsInBlast(a, options, false, false, lifted));
