import { FIRST_ARGUMENT } from './native-leaf-support.mjs';
import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import {
  WINDOW_FIRST_INDEX,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
  WINDOW_ACTIVE,
  WRAM,
  WINDOW_MAP_OFFSET,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_TILE_INITIAL,
  WINDOW_TILE_COUNT,
  WINDOW_ATTRIBUTES,
  WINDOW_MAP_BUFFER,
  TEXT_MAP_UPLOAD,
} from './wram.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { unpackWindowMap } from './native-render-unpack.mjs';

import { dialogAccess } from './native-dialog-support.mjs';
import {
  runInterruptWordWait,
  runInterruptRequestWait,
  RequestWaitContinuation,
} from './main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from './native-call-continuation.mjs';
import { WORD_MASK, WORD_BITS, BANK_WRAP, BANK_SIZE } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';

const DP_DRAW_ATTRIBUTES = 0xc9;
const DP_DRAW_MAP_ROW = 0xc3;
const WINDOW_MAP_ROW_BYTES = 0x40;
const DP_DRAW_WINDOW_INDEX = 0xcf;
const DP_DRAW_TILE = 0xd2;
const WINDOW_BORDER_TOP_LEFT = 0x2001;
const DP_DRAW_COLUMNS = 0xc6;
const WINDOW_BORDER_TOP = 0x2002;
const WINDOW_BORDER_TOP_RIGHT = 0x6001;
const WINDOW_BORDER_LEFT = 0x2003;
const DP_DRAW_REMAINING = 0xcc;
const WINDOW_BORDER_RIGHT = 0x6003;
const WINDOW_BORDER_BOTTOM_LEFT = 0xa001;
const WINDOW_BORDER_BOTTOM = 0xa002;
const WINDOW_BORDER_BOTTOM_RIGHT = 0xe001;

const index = (h, name, value) => {
  h.ctx[name] = h.nz(value, 2);
};
const compare = (h, left, right) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
  h.nz((left - right) & WORD_MASK, 2);
};
function call(a, h, at, next, target, run) {
  const { ctx } = h,
    bank = ctx.programBank;
  h.pushByte(bank, 'render-compose-JSL-bank');
  a.pushWord((next - 1) & WORD_MASK, 'render-compose-JSL-WORD');
  ctx.programBank = target >>> WORD_BITS;
  ctx.pc = target & WORD_MASK;
  const result = run();
  if (
    result.rawReturnWord !== ((next - 1) & WORD_MASK) ||
    ctx.programBank !== bank ||
    ctx.pc !== (next & WORD_MASK)
  )
    taskStop('task_native_helper_return_required', {
      at,
      raw: result.rawReturnWord,
      bank: ctx.programBank,
      pc: ctx.pc,
    });
  return result;
}
// 81:ACAF: wait until the text map upload request word is zero again (the NMI clears it);
// each poll is a recorded observation or an interrupt wait.
export function waitForTextMapUpload(a, events, outerReturn = true) {
  if (events?.interrupts !== undefined)
    return runInterruptWordWait(dialogAccess(a), events, 0x81acaf);
  const h = taskTextAccess(a),
    { ctx } = h;
  let polls = 0;
  if (events?.mode !== 'record-observations') taskStop('task_wait_mode_required');
  for (;;) {
    const address = h.abs(TEXT_MAP_UPLOAD),
      o = events.values?.[events.waitIndex];
    if (!o || o.pc !== 0x81acaf || o.address !== address || o.width !== 2)
      taskStop('task_wait_observation_required', {
        pc: 0x81acaf,
        address,
        width: 2,
        observationIndex: events.waitIndex,
      });
    events.waitIndex++;
    polls++;
    events.waitEvents.push(o);
    h.write(address, o.value);
    h.load(h.read(address));
    if (ctx.a === 0) break;
  }
  return { ...h.finish(outerReturn), outcome: 'wait_complete', polls };
}
// 81:ACB5: request a text map upload (INC of the request word) and wait for it through a
// real JSL to ACAF.
export function requestTextMapUpload(a, events, outerReturn = true) {
  if (events?.interrupts !== undefined)
    return runInterruptRequestWait(dialogAccess(a), events, 0x81acb5);
  const h = taskTextAccess(a),
    counter = h.nz((h.read(h.abs(TEXT_MAP_UPLOAD)) + 1) & WORD_MASK, 2);
  h.write(h.abs(TEXT_MAP_UPLOAD), counter);
  const wait = call(a, h, 0x81acb8, 0x81acbc, 0x81acaf, () =>
    waitForTextMapUpload(a, events, false),
  );
  return {
    ...h.finish(outerReturn),
    outcome: 'request_wait_prepared',
    requestCounter: counter,
    polls: wait.polls,
  };
}
// 81:ACCF: draw the window in X (border and tile area) into the window map buffer.
export function drawWindow(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  let topVisits = 0,
    rows = 0,
    cells = 0,
    bottomVisits = 0,
    resets = 0;
  const ix = (value) => index(h, 'x', value),
    iy = (value) => index(h, 'y', value),
    dx = () => ix((ctx.x - 1) & WORD_MASK);
  const advance = () => {
    iy((ctx.y + 1) & WORD_MASK);
    iy((ctx.y + 1) & WORD_MASK);
  };
  const dec = () => h.load((ctx.a - 1) & WORD_MASK),
    emit = () => h.write(h.abs(WINDOW_MAP_BUFFER) + ctx.y, ctx.a);
  const cap = (value) => {
    h.load(value);
    h.load(ctx.a | h.dp(DP_DRAW_ATTRIBUTES));
    emit();
  };
  const rowBase = () => {
    ctx.status &= ~FLAG_CARRY;
    h.load(h.dp(DP_DRAW_MAP_ROW));
    h.arithmetic(WINDOW_MAP_ROW_BYTES);
    h.dpWrite(DP_DRAW_MAP_ROW, ctx.a);
    iy(ctx.a);
  };
  h.pushByte(ctx.bank, 'ACCF-PHB');
  a.pushWord(WRAM_BANK_PAIR, 'ACCF-PEA');
  ctx.bank = h.pullByte('ACCF-PLB-first');
  h.nz(ctx.bank, 1);
  ctx.bank = h.pullByte('ACCF-PLB-second');
  h.nz(ctx.bank, 1);
  h.dpWrite(DP_DRAW_WINDOW_INDEX, ctx.x);
  h.load(h.read(WRAM + WINDOW_TILE_INITIAL + ctx.x));
  h.dpWrite(DP_DRAW_TILE, ctx.a);
  h.load(h.read(WRAM + WINDOW_ATTRIBUTES + ctx.x));
  h.dpWrite(DP_DRAW_ATTRIBUTES, ctx.a);
  h.load(h.read(WRAM + WINDOW_MAP_OFFSET + ctx.x));
  h.dpWrite(DP_DRAW_MAP_ROW, ctx.a);
  iy(ctx.a);
  cap(WINDOW_BORDER_TOP_LEFT);
  advance();
  h.load(h.read(WRAM + WINDOW_COLUMNS + ctx.x));
  dec();
  dec();
  h.dpWrite(DP_DRAW_COLUMNS, ctx.a);
  ix(ctx.a);
  do {
    topVisits++;
    cap(WINDOW_BORDER_TOP);
    advance();
    dx();
  } while (ctx.x !== 0);
  cap(WINDOW_BORDER_TOP_RIGHT);
  ix(h.dp(DP_DRAW_WINDOW_INDEX));
  h.load(h.read(WRAM + WINDOW_ROWS + ctx.x));
  dec();
  dec();
  ix(ctx.a);
  do {
    rows++;
    rowBase();
    cap(WINDOW_BORDER_LEFT);
    advance();
    h.load(h.dp(DP_DRAW_COLUMNS));
    h.dpWrite(DP_DRAW_REMAINING, ctx.a);
    h.load(h.dp(DP_DRAW_TILE));
    h.load(ctx.a | h.dp(DP_DRAW_ATTRIBUTES));
    let remaining;
    do {
      cells++;
      emit();
      h.load((ctx.a + 1) & WORD_MASK);
      h.dpWrite(DP_DRAW_TILE, h.nz((h.dp(DP_DRAW_TILE) + 1) & WORD_MASK, 2));
      advance();
      remaining = h.nz((h.dp(DP_DRAW_REMAINING) - 1) & WORD_MASK, 2);
      h.dpWrite(DP_DRAW_REMAINING, remaining);
    } while (remaining !== 0);
    cap(WINDOW_BORDER_RIGHT);
    a.pushWord(ctx.x, 'ACCF-PHX');
    ix(h.dp(DP_DRAW_WINDOW_INDEX));
    ctx.status |= FLAG_CARRY;
    h.load(h.dp(DP_DRAW_TILE));
    h.arithmetic(h.read(WRAM + WINDOW_TILE_START + ctx.x), true);
    compare(h, ctx.a, h.read(WRAM + WINDOW_TILE_COUNT + ctx.x));
    if (ctx.status & FLAG_CARRY) {
      resets++;
      h.load(h.read(WRAM + WINDOW_TILE_START + ctx.x));
      h.dpWrite(DP_DRAW_TILE, ctx.a);
    }
    ix(a.pullWord('ACCF-PLX-fresh'));
    dx();
  } while (ctx.x !== 0);
  rowBase();
  cap(WINDOW_BORDER_BOTTOM_LEFT);
  advance();
  ix(h.dp(DP_DRAW_COLUMNS));
  do {
    bottomVisits++;
    cap(WINDOW_BORDER_BOTTOM);
    advance();
    dx();
  } while (ctx.x !== 0);
  cap(WINDOW_BORDER_BOTTOM_RIGHT);
  ix(h.dp(DP_DRAW_WINDOW_INDEX));
  ctx.bank = h.pullByte('ACCF-PLB-restored-fresh');
  h.nz(ctx.bank, 1);
  return {
    ...h.finish(outerReturn),
    outcome: 'entry_prepared',
    topVisits,
    rows,
    cells,
    bottomVisits,
    resets,
  };
}
// 81:AD92: draw the window list: convert the window map (A9B2), draw every active window
// from the first window index on (ACCF) and request the upload (ACB5).
export function drawWindowList(a, events, outerReturn = true) {
  return drainNativeSequence(drawWindowListSequence(a, events, outerReturn));
}
export function* drawWindowListSequence(a, events, outerReturn) {
  const h = taskTextAccess(a),
    { ctx } = h,
    dh = dialogAccess(a);
  let visits = 0,
    entries = 0,
    listSkipped,
    result;
  const conversion = yield* nativeCallSequence(
    dh,
    events,
    RENDER_ROUTINES,
    0x81ad92,
    0x81a9b2,
    true,
  );
  yield () => {
    h.load(h.read(h.abs(WINDOW_LAST_INDEX)));
    listSkipped = Boolean(ctx.status & FLAG_NEGATIVE);
  };
  if (!listSkipped) {
    yield () => index(h, 'x', 0);
    for (;;) {
      yield () => {
        visits++;
        compare(h, ctx.x, h.read(h.abs(WINDOW_FIRST_INDEX)));
      };
      if (ctx.status & FLAG_CARRY) {
        yield () => h.load(h.read(h.abs(WINDOW_ACTIVE) + ctx.x));
        if (ctx.a !== 0) {
          entries++;
          yield* nativeCallSequence(dh, events, RENDER_ROUTINES, 0x81ada8, 0x81accf, true);
        }
      }
      yield () => {
        index(h, 'x', (ctx.x + 1) & WORD_MASK);
        index(h, 'x', (ctx.x + 1) & WORD_MASK);
        compare(h, ctx.x, h.read(h.abs(WINDOW_LAST_INDEX)));
      };
      if (ctx.status & FLAG_CARRY && !(ctx.status & FLAG_ZERO)) break;
    }
  }
  const transfer = yield* nativeCallSequence(dh, events, RENDER_ROUTINES, 0x81adb5, 0x81acb5, true);
  yield () => {
    result = {
      ...h.finish(outerReturn),
      outcome: 'render_composed',
      listSkipped,
      visits,
      entries,
      conversion,
      transfer,
    };
  };
  return result;
}
// 80:FA3E: release the window in the first argument. Releasing the last window moves the
// last index down to the previous active one and resets the next tile; then 81:AD92
// redraws the window list.
export function releaseWindow(a, events, outerReturn = true) {
  return drainNativeSequence(releaseWindowSequence(a, events, outerReturn));
}
export function* releaseWindowSequence(a, events, outerReturn) {
  const h = taskTextAccess(a),
    { ctx } = h,
    dh = dialogAccess(a);
  let scanned = 0,
    compacted = false,
    result;
  yield () => {
    index(h, 'x', h.dp(FIRST_ARGUMENT));
    h.load(0);
    h.write(h.abs(WINDOW_ACTIVE) + ctx.x, ctx.a);
    compare(h, ctx.x, h.read(h.abs(WINDOW_LAST_INDEX)));
    if (ctx.status & FLAG_ZERO) {
      compacted = true;
      for (;;) {
        index(h, 'x', (ctx.x - 1) & WORD_MASK);
        index(h, 'x', (ctx.x - 1) & WORD_MASK);
        if (ctx.status & FLAG_NEGATIVE) break;
        scanned++;
        h.load(h.read(h.abs(WINDOW_ACTIVE) + ctx.x));
        if (ctx.a !== 0) break;
      }
      index(h, 'x', (ctx.x + 1) & WORD_MASK);
      index(h, 'x', (ctx.x + 1) & WORD_MASK);
      h.load(h.read(WRAM + WINDOW_TILE_START + ctx.x));
      h.write(h.abs(WINDOW_NEXT_TILE), ctx.a);
      index(h, 'x', (ctx.x - 1) & WORD_MASK);
      index(h, 'x', (ctx.x - 1) & WORD_MASK);
      h.write(h.abs(WINDOW_LAST_INDEX), ctx.x);
    }
  };
  const render = yield* nativeCallSequence(dh, events, RENDER_ROUTINES, 0x80fa62, 0x81ad92, true);
  yield () => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'FA3E-outer-RTS-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      outcome: 'entry_removed',
      scanned,
      compacted,
      render,
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-render-composition',
    };
  };
  return result;
}
export const drawWindowListAdapter = (h, e) => drawWindowList(h.a, e, false);
export const releaseWindowAdapter = (h, e) => releaseWindow(h.a, e, false);
const requestTextMapUploadAdapter = (h, e) => requestTextMapUpload(h.a, e, false);
export const RENDER_ROUTINES = new Map([
  [0x81a9b2, (h, e) => unpackWindowMap(h.a, false, e)],
  [0x81accf, (h) => drawWindow(h.a, false)],
  [0x81acb5, requestTextMapUploadAdapter],
  [0x81ad92, drawWindowListAdapter],
]);
for (const [target, run, sequence] of [
  [0x81ad92, drawWindowListAdapter, drawWindowListSequence],
  [0x80fa3e, releaseWindowAdapter, releaseWindowSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h.a, events, false)),
  });
NATIVE_CALL_CONTINUATIONS.set(0x81acb5, {
  run: requestTextMapUploadAdapter,
  create: ({ h, events }) =>
    events?.interrupts === undefined ? null : new RequestWaitContinuation(h, events, 0x81acb5),
});
