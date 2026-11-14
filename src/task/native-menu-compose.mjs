import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { runTaskListHelper } from './native-list-prerequisites.mjs';
import { waitForRandomStateChange } from './native-frame-wait.mjs';
import { readInput } from './native-input-apu.mjs';
import { playSoundEffect } from './native-audio-compose.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  WordWaitContinuation,
  ObservedWaitContinuation,
  runInterruptWordWait,
} from './main-wait-interrupt.mjs';
import {
  drainNativeSequence,
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from './native-call-continuation.mjs';
import {
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_TILE_UPLOAD_BYTES,
  WRAM,
  WINDOW_TILE_START,
  WINDOW_TILE_COUNT,
  MENU_PAGE_START,
  MENU_SELECTION,
  MENU_COLUMN,
  MENU_ROW,
  MENU_REPEAT_COUNTER,
  MENU_NAVIGATION_INPUT,
  MENU_SHOW_NUMBERS,
  MENU_HOTKEYS,
  TEXT_TILE_UPLOAD,
  PAD_HELD,
  PAD_PRESSED,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
  DP_LIST_VALUES,
  DP_MENU_VISIBLE_ROWS,
  DP_MENU_ROW,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
} from './wram.mjs';
import {
  WORD_MASK,
  BANK_WRAP,
  BANK_SIZE,
  WORD_BITS,
  LONG_MASK,
  LONG_WRAP,
} from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  APUIO0,
  APUIO1,
  APUIO2,
  APUIO3,
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVH,
  WRDIVB,
  RDDIVL,
  RDDIVH,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

const TEXT_TILE_PIXEL_SHIFT = 0x3;
const TEXT_TILE_VRAM_BEFORE_START = 0x4fff;
const TEXT_TILE_BYTE_SHIFT = 0x4;

const JSL_RETURN_OFFSET = 0x3;
const JSL_BYTES = 0x4;
const JSR_BYTES = 0x3;
const TEXT_CODE_BANK = 0x81;
const MENU_SOUND_LEVEL = 0x40;
const MENU_SOUND_VOICE = 0x3;
const MENU_CONFIRM_SOUND = 0x4c;
const MENU_MOVE_SOUND = 0x4a;
const MENU_REPEAT_DELAY = 0x14;
const MENU_REPEAT_RELOAD = 0x13;
const MENU_INPUT_DOWN = 0x400;
const MENU_INPUT_UP = 0x800;
const MENU_INPUT_VERTICAL = 0xc00;
const MENU_INPUT_CANCEL = 0x2000;
const MENU_INPUT_CONFIRM = 0xd0c0;
const MENU_INPUT_PREVIOUS_PAGE = 0x20;
const MENU_INPUT_NEXT_PAGE = 0x10;

const entries = [0x80a6a5, 0x80a6ad, 0x80a6b8, 0x80a6c7];
const devices = Object.freeze({
  writes: Object.freeze([APUIO0, APUIO1, APUIO2, APUIO3, WRMPYA, WRMPYB, WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([APUIO0, RDDIVL, RDDIVH, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([
    0x80facd, 0x80fd9e, 0x80fda7, 0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94, 0x81f00e,
    0x81f046, 0x80c44f, 0x80c45a,
  ]),
});
export const taskMenuDevices = devices;
function access(a, events) {
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const compareIndex = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const bit = (mask) => {
    ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
    return Boolean(ctx.a & mask);
  };
  const finish = (long, outer) => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'menu-return-WORD', outer);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    let returnBank = ctx.programBank;
    if (long) {
      returnBank = h.pullByte('menu-return-bank', outer);
      ctx.programBank = returnBank;
    }
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnBank,
      returnTarget: returnBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: long ? 'observed-outer-RTL-target' : 'observed-outer-RTS-target',
    };
  };
  // The frame exists from the original call until the callee's own return.
  const callSequence = function* (pc, target, body, long = false, role = null) {
    let bank;
    yield () => {
      bank = ctx.programBank;
      if (long) h.pushByte(bank, 'menu-JSL-bank');
      a.pushWord((pc + (long ? JSL_RETURN_OFFSET : 2)) & WORD_MASK, 'menu-call-return');
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const result = yield* body();
    yield () => {
      if (
        result.rawReturnWord !== ((pc + (long ? JSL_RETURN_OFFSET : 2)) & WORD_MASK) ||
        ctx.programBank !== bank ||
        ctx.pc !== ((pc + (long ? JSL_BYTES : JSR_BYTES)) & WORD_MASK)
      )
        taskStop('task_native_helper_return_required', {
          pc,
          raw: result.rawReturnWord,
          bank: ctx.programBank,
          target: result.returnTarget,
        });
      if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
        taskStop('task_menu_return_mode_required', { pc, status: ctx.status });
      events.calls.push(
        Object.freeze({
          pc,
          target,
          role,
          rawReturnWord: result.rawReturnWord,
          returnTarget: result.returnTarget,
          outcome: result.outcome,
        }),
      );
    };
    return result;
  };
  return { ...h, index, compareIndex, bit, finish, callSequence };
}
function* segment(run) {
  let result;
  yield () => {
    result = run();
  };
  return result;
}
function* continued(continuation) {
  return yield { continuation };
}
// 81:ACBD: wait until the requested window upload is done.
export function waitForWindowUpload(a, events, outerReturn = false) {
  if (events?.interrupts !== undefined)
    return runInterruptWordWait(dialogAccess(a), events, 0x81acbd);
  if (a.ctx.programBank !== TEXT_CODE_BANK) taskStop('task_menu_entry_required');
  const h = access(a, events),
    { ctx } = h;
  let polls = 0;
  if (events.mode !== 'record-observations') taskStop('task_wait_mode_required');
  do {
    const address = h.abs(TEXT_TILE_UPLOAD),
      o = events.values?.[events.waitIndex];
    if (
      !o ||
      !Object.isFrozen(o) ||
      o.pc !== 0x81acbd ||
      o.address !== address ||
      o.width !== 2 ||
      !Number.isInteger(o.value) ||
      o.value < 0 ||
      o.value > WORD_MASK
    )
      taskStop('task_wait_observation_required', {
        pc: 0x81acbd,
        address,
        width: 2,
        observationIndex: events.waitIndex,
      });
    events.waitIndex++;
    polls++;
    h.write(address, o.value);
    h.load(h.read(address));
  } while (ctx.a !== 0);
  return { ...h.finish(true, outerReturn), outcome: 'wait_zero', polls };
}
// 80:FA67: request the upload of the text tiles of the window in the first argument to VRAM.
export function requestWindowUpload(a, events, outerReturn = false) {
  return drainNativeSequence(requestWindowUploadSequence(a, events, outerReturn));
}
// With an interrupt set the ACBD poll pauses as its own WORD continuation.
export function* requestWindowUploadSequence(a, events, outerReturn = false) {
  if (a.ctx.programBank !== CODE_BANK) taskStop('task_menu_entry_required');
  const h = access(a, events),
    { ctx } = h;
  yield () => {
    h.index('x', h.dp(0));
    h.load(h.read(WRAM + WINDOW_TILE_START + ctx.x));
    for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
    h.arithmetic(TEXT_TILE_VRAM_BEFORE_START);
    h.write(h.abs(TEXT_TILE_UPLOAD_ADDRESS), ctx.a);
    h.load(h.read(WRAM + WINDOW_TILE_COUNT + ctx.x));
    for (let n = 0; n < TEXT_TILE_BYTE_SHIFT; n++) h.asl();
    h.write(h.abs(TEXT_TILE_UPLOAD_BYTES), ctx.a);
    h.write(h.abs(TEXT_TILE_UPLOAD), h.nz((h.read(h.abs(TEXT_TILE_UPLOAD)) + 1) & WORD_MASK));
  };
  yield* h.callSequence(
    0x80fa84,
    0x81acbd,
    () =>
      events?.interrupts !== undefined
        ? continued(new WordWaitContinuation(dialogAccess(a), events, 0x81acbd))
        : segment(() => waitForWindowUpload(a, events)),
    true,
    'request-wait',
  );
  let result;
  yield () => {
    result = {
      ...h.finish(false, outerReturn),
      outcome: 'request_wait_prepared',
    };
  };
  return result;
}
export function runTaskMenuCompose(a, events, entry, outerReturn = true) {
  return drainNativeSequence(menuComposeSequence(a, events, entry, outerReturn));
}
// Each menu round pauses in the counter wait B0A1 and the input edge 9E1A;
// list helpers and the confirmation sound stay single segments. routines (optional,
// for tests) replaces the word wait 81:B0A1, the pad word 80:9E1A and the sound
// 80:C46E; each replacement takes (h, events) and returns with RTS or RTL.
export function* menuComposeSequence(a, events, entry, outerReturn = true, routines = null) {
  if (!entries.includes(entry) || a.ctx.programBank !== CODE_BANK)
    taskStop('task_menu_entry_required');
  const h = access(a, events),
    { ctx } = h;
  let iterations = 0,
    moves = 0,
    pages = 0,
    hotkeyReads = 0,
    repeats = 0;
  const interrupts = events.interrupts !== undefined;
  const field = (offset) => h.read(h.abs(offset)),
    store = (offset, value) => h.write(h.abs(offset), value);
  const listToken = () =>
    h.read(
      (h.dp(DP_LIST_TOKENS, 2) + (h.dp(DP_LIST_TOKEN_BANK, 1) << WORD_BITS) + ctx.y) & LONG_MASK,
      2,
    );
  const shortToken = () => h.read((h.abs(h.dp(DP_LIST_VALUES, 2)) + ctx.y) & LONG_MASK, 2);
  const replaced = (target) => routines?.get(target);
  const tableCall = function* (target) {
    let raw;
    yield () => {
      raw = routines.get(target)(dialogAccess(a), events);
    };
    return { rawReturnWord: raw, returnTarget: ctx.programBank * BANK_SIZE + ctx.pc };
  };
  const list = (pc, target, role) =>
    h.callSequence(
      pc,
      target,
      () => segment(() => runTaskListHelper(a, events, target, false)),
      false,
      role,
    );
  const input = (pc, role) =>
    h.callSequence(
      pc,
      0x809e1a,
      () =>
        replaced(0x809e1a)
          ? tableCall(0x809e1a)
          : interrupts
            ? continued(new ObservedWaitContinuation(dialogAccess(a), events, 0x809e1a))
            : segment(() => {
                if (events.inputMode === 'record-observations') {
                  const address = h.abs(PAD_HELD),
                    o = events.inputs?.[events.inputIndex];
                  if (
                    !o ||
                    !Object.isFrozen(o) ||
                    o.pc !== 0x809e1a ||
                    o.address !== address ||
                    o.width !== 2 ||
                    !Number.isInteger(o.value) ||
                    o.value < 0 ||
                    o.value > WORD_MASK
                  )
                    taskStop('task_input_observation_required', {
                      pc: 0x809e1a,
                      address,
                      width: 2,
                      observationIndex: events.inputIndex,
                    });
                  events.inputIndex++;
                  a.writeWord(address, o.value, LONG_WRAP, 'menu-observed-input-writer');
                }
                return readInput(a, false);
              }),
      false,
      role,
    );
  const counter = function* () {
    const result = yield* h.callSequence(
      0x80a6e9,
      0x81b0a1,
      () =>
        replaced(0x81b0a1)
          ? tableCall(0x81b0a1)
          : interrupts
            ? continued(new ObservedWaitContinuation(dialogAccess(a), events, 0x81b0a1))
            : segment(() => {
                if (events.mode !== 'record-observations') taskStop('task_wait_mode_required');
                const result = waitForRandomStateChange(
                  a,
                  {
                    interruptEvents: events,
                    waitObservations: Object.freeze(events.values?.slice(events.waitIndex) ?? []),
                  },
                  false,
                  true,
                );
                events.waitIndex += result.waitObservationsUsed;
                return result;
              }),
      true,
      'counter-wait',
    );
    return result;
  };
  const done = (outcome, selection) => ({
    ...h.finish(false, outerReturn),
    outcome,
    selection,
    iterations,
    moves,
    pages,
    hotkeyReads,
    repeats,
  });
  const confirm = function* () {
    let selection, result;
    yield () => {
      h.load(WORD_MASK);
      h.dpWrite(0, ctx.a);
      h.load(MENU_SOUND_LEVEL);
      h.dpWrite(DP_SOUND_LEVEL, ctx.a);
      h.load(MENU_SOUND_VOICE);
      h.dpWrite(DP_SOUND_VOICE, ctx.a);
      h.load(MENU_CONFIRM_SOUND);
      h.dpWrite(2, ctx.a);
    };
    yield* h.callSequence(
      0x80a819,
      0x80c46e,
      () =>
        replaced(0x80c46e) ? tableCall(0x80c46e) : segment(() => playSoundEffect(a, events, false)),
      false,
      'confirm-audio',
    );
    yield () => {
      h.load(field(MENU_SELECTION));
      h.lsr();
      selection = ctx.a;
      h.dpWrite(0, ctx.a);
    };
    yield* input(0x80a822, 'confirm-input');
    yield () => {
      result = done('menu_confirmed', selection);
    };
    return result;
  };
  const move = function* () {
    let previousPage,
      nextPage = false;
    yield () => {
      a.pushWord(ctx.y, 'menu-move-PHY');
      h.compareIndex(ctx.y, field(MENU_PAGE_START));
      previousPage = !(ctx.status & FLAG_CARRY);
      if (!previousPage) {
        h.load(ctx.y);
        ctx.status |= FLAG_CARRY;
        h.arithmetic(field(MENU_PAGE_START), true);
        h.lsr();
        h.compare(ctx.a, h.dp(DP_MENU_VISIBLE_ROWS));
        nextPage = Boolean(ctx.status & FLAG_CARRY);
      }
      if (previousPage || nextPage) {
        h.load(field(MENU_PAGE_START));
        if (nextPage) {
          ctx.status &= ~FLAG_CARRY;
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS));
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS));
        } else {
          ctx.status |= FLAG_CARRY;
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS), true);
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS), true);
          if (!(ctx.status & FLAG_CARRY)) h.load(0);
        }
        store(MENU_PAGE_START, ctx.a);
      } else h.index('y', field(MENU_SELECTION));
    };
    if (previousPage || nextPage) {
      yield* h.callSequence(
        0x80a7f7,
        0x80fa67,
        () => requestWindowUploadSequence(a, events),
        false,
        'scroll-request',
      );
      yield* list(0x80a7fa, 0x80a617, 'scroll-list');
      yield () => {
        pages++;
      };
    } else yield* list(0x80a78e, 0x80a5db, 'move-unmark');
    yield () => {
      h.index('y', a.pullWord('menu-move-PLY-fresh'));
      store(MENU_SELECTION, ctx.y);
    };
    yield* list(0x80a795, 0x80a5f9, 'move-mark');
    yield () => {
      moves++;
      a.pushWord(h.dp(0, 2), 'menu-PEI00');
      a.pushWord(h.dp(DP_MENU_VISIBLE_ROWS, 2), 'menu-PEI06');
      h.load(WORD_MASK);
      h.dpWrite(0, ctx.a);
      h.load(MENU_SOUND_LEVEL);
      h.dpWrite(DP_SOUND_LEVEL, ctx.a);
      h.load(MENU_SOUND_VOICE);
      h.dpWrite(DP_SOUND_VOICE, ctx.a);
      h.load(MENU_MOVE_SOUND);
      h.dpWrite(2, ctx.a);
      h.load(a.pullWord('menu-PLA06-fresh'));
      h.dpWrite(DP_MENU_VISIBLE_ROWS, ctx.a);
      h.load(a.pullWord('menu-PLA00-fresh'));
      h.dpWrite(0, ctx.a);
    };
  };
  // The original navigation tests decide on one move; their reads stay one segment.
  const navigation = function* () {
    let moving = false;
    yield () => {
      moving = (() => {
        h.load(field(MENU_NAVIGATION_INPUT));
        if (h.bit(MENU_INPUT_DOWN)) {
          h.index('y', field(MENU_SELECTION));
          h.index('y', (ctx.y + 1) & WORD_MASK);
          h.index('y', (ctx.y + 1) & WORD_MASK);
          h.load(listToken());
          return ctx.a !== 0;
        }
        if (h.bit(MENU_INPUT_UP)) {
          h.index('y', field(MENU_SELECTION));
          if (ctx.y === 0) return false;
          h.index('y', (ctx.y - 1) & WORD_MASK);
          h.index('y', (ctx.y - 1) & WORD_MASK);
          return true;
        }
        h.load(field(MENU_HOTKEYS));
        if (ctx.a !== 0) return false;
        h.load(field(PAD_PRESSED));
        if (h.bit(MENU_INPUT_PREVIOUS_PAGE)) {
          h.load(field(MENU_PAGE_START));
          if (ctx.a === 0) return false;
          ctx.status |= FLAG_CARRY;
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS), true);
          h.arithmetic(h.dp(DP_MENU_VISIBLE_ROWS), true);
          h.index('y', ctx.a);
          return true;
        }
        if (!h.bit(MENU_INPUT_NEXT_PAGE)) return false;
        h.index('x', h.dp(DP_MENU_VISIBLE_ROWS));
        h.index('y', field(MENU_PAGE_START));
        do {
          h.index('y', (ctx.y + 1) & WORD_MASK);
          h.index('y', (ctx.y + 1) & WORD_MASK);
          h.load(listToken());
          if (ctx.a === 0) return false;
          h.index('x', (ctx.x - 1) & WORD_MASK);
        } while (ctx.x !== 0);
        return true;
      })();
    };
    if (moving) yield* move();
  };
  yield () => {
    if (entry === 0x80a6b8) {
      h.asl();
      store(MENU_SELECTION, ctx.a);
      h.load(WORD_MASK);
      store(MENU_SHOW_NUMBERS, ctx.a);
      store(MENU_HOTKEYS, 0);
    } else if (entry === 0x80a6ad) {
      h.load(WORD_MASK);
      store(MENU_SHOW_NUMBERS, ctx.a);
      store(MENU_HOTKEYS, 0);
      store(MENU_SELECTION, 0);
    } else {
      if (entry === 0x80a6a5) {
        h.load(WORD_MASK);
        store(MENU_HOTKEYS, ctx.a);
      } else store(MENU_HOTKEYS, 0);
      store(MENU_SHOW_NUMBERS, 0);
      store(MENU_SELECTION, 0);
    }
    h.load(h.dp(2));
    store(MENU_COLUMN, ctx.a);
    h.load(h.dp(DP_MENU_ROW));
    store(MENU_ROW, ctx.a);
    store(MENU_PAGE_START, 0);
    store(MENU_REPEAT_COUNTER, 0);
  };
  yield* list(0x80a6e0, 0x80a617, 'initial-list');
  yield () => h.index('y', field(MENU_SELECTION));
  yield* list(0x80a6e6, 0x80a5f9, 'initial-mark');
  for (;;) {
    yield* counter();
    yield* input(0x80a6ed, 'loop-input');
    let branch;
    yield () => {
      iterations++;
      h.load(field(PAD_PRESSED));
      store(MENU_NAVIGATION_INPUT, ctx.a);
      h.load(field(PAD_HELD));
      h.load(ctx.a & MENU_INPUT_VERTICAL);
      if (ctx.a !== 0) {
        store(MENU_REPEAT_COUNTER, h.nz((field(MENU_REPEAT_COUNTER) + 1) & WORD_MASK));
        h.load(field(MENU_REPEAT_COUNTER));
        h.compare(ctx.a, MENU_REPEAT_DELAY);
        if (ctx.status & FLAG_ZERO) {
          h.load(MENU_REPEAT_RELOAD);
          store(MENU_REPEAT_COUNTER, ctx.a);
          h.load(field(PAD_HELD));
          store(MENU_NAVIGATION_INPUT, ctx.a);
          repeats++;
        }
      } else store(MENU_REPEAT_COUNTER, 0);
      h.load(field(PAD_PRESSED));
      if (h.bit(MENU_INPUT_CANCEL)) {
        h.index('y', field(MENU_SELECTION));
        branch = 'cancel';
      } else if (h.bit(MENU_INPUT_CONFIRM)) {
        h.index('y', field(MENU_SELECTION));
        branch = 'confirm';
      } else branch = 'navigate';
    };
    if (branch === 'cancel') {
      yield* list(0x80a829, 0x80a5db, 'cancel-unmark');
      yield () => {
        h.load(WORD_MASK);
        h.dpWrite(0, ctx.a);
      };
      yield* input(0x80a831, 'cancel-input');
      let result;
      yield () => {
        result = done('menu_cancelled', WORD_MASK);
      };
      return result;
    }
    if (branch === 'confirm') {
      yield* list(0x80a802, 0x80a5db, 'confirm-unmark');
      return yield* confirm();
    }
    yield* navigation();
    let hotkeys;
    yield () => {
      h.load(field(MENU_HOTKEYS));
      hotkeys = ctx.a !== 0;
      if (hotkeys) h.index('y', 0);
    };
    if (!hotkeys) continue;
    for (;;) {
      let end, hit;
      yield () => {
        h.load(listToken());
        end = ctx.a === 0;
        if (end) return;
        hotkeyReads++;
        h.load(shortToken());
        h.load(ctx.a & field(PAD_PRESSED));
        hit = ctx.a !== 0;
        if (hit) {
          a.pushWord(ctx.y, 'menu-hotkey-PHY');
          h.index('y', field(MENU_SELECTION));
        } else {
          h.index('y', (ctx.y + 1) & WORD_MASK);
          h.index('y', (ctx.y + 1) & WORD_MASK);
        }
      };
      if (end) break;
      if (hit) {
        yield* list(0x80a7d1, 0x80a5db, 'hotkey-unmark');
        yield () => {
          h.load(a.pullWord('menu-hotkey-PLA-fresh'));
          store(MENU_SELECTION, ctx.a);
        };
        return yield* confirm();
      }
    }
  }
}
// Shared table adapters with registered continuations.
export const chooseFromMenuAdapter = (h, e) => runTaskMenuCompose(h.a, e, 0x80a6c7, false);
export const chooseFromNumberedMenuAdapter = (h, e) => runTaskMenuCompose(h.a, e, 0x80a6ad, false);
export const requestWindowUploadAdapter = (h, e) => requestWindowUpload(h.a, e, false);
export const chooseFromNumberedMenuWithSelectionAdapter = (h, e) =>
  runTaskMenuCompose(h.a, e, 0x80a6b8, false);
for (const [target, run, sequence] of [
  [0x80a6c7, chooseFromMenuAdapter, (a, e) => menuComposeSequence(a, e, 0x80a6c7, false)],
  [0x80a6ad, chooseFromNumberedMenuAdapter, (a, e) => menuComposeSequence(a, e, 0x80a6ad, false)],
  [
    0x80a6b8,
    chooseFromNumberedMenuWithSelectionAdapter,
    (a, e) => menuComposeSequence(a, e, 0x80a6b8, false),
  ],
  [0x80fa67, requestWindowUploadAdapter, (a, e) => requestWindowUploadSequence(a, e, false)],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h.a, events)),
  });

export { entries as taskMenuEntries };
