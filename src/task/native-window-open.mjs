import { WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { taskStop } from './plan.mjs';
import { leafAccess, finishLeaf } from './native-leaf-support.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { WordWaitContinuation, RequestWaitContinuation } from './main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { M7A, M7B, MPYL } from '../constants/hardware-registers.mjs';
import {
  TEXT_TILE_UPLOAD,
  TEXT_MAP_UPLOAD,
  WINDOW_CURSOR_PIXEL,
  WINDOW_LEFT_PIXEL,
  WINDOW_STYLE,
  WINDOW_TILE_START,
  WINDOW_TILE_INITIAL,
  WINDOW_CURSOR_TILE,
  WINDOW_LAST_INDEX,
  TEXT_TILE_UPLOAD_ADDRESS,
  TEXT_TILE_UPLOAD_BYTES,
  WINDOW_NEXT_TILE,
  WINDOW_ACTIVE,
  WRAM,
  WINDOW_MAP_OFFSET,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_COUNT,
  WINDOW_WIDTH_PIXELS,
  WINDOW_ATTRIBUTES,
  WINDOW_MAP_BUFFER,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
} from './wram.mjs';
import {
  WORD_SIGN,
  WORD_MASK,
  BANK_WRAP,
  WORD_BITS,
  LONG_WRAP,
  BYTE_MASK,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';

const TEXT_TILE_PIXEL_SHIFT = 0x3;
const TEXT_TILE_VRAM_BEFORE_START = 0x4fff;
const TEXT_TILE_BYTE_SHIFT = 0x4;
const DP_DRAW_WINDOW_INDEX = 0xcf;
const DP_DRAW_TILE = 0xd2;
const DP_DRAW_ATTRIBUTES = 0xc9;
const DP_DRAW_MAP_ROW = 0xc3;
const WINDOW_MAP_ROW_BYTES = 0x40;
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
const WINDOW_INDEX_LIMIT = 0x20;
const WINDOW_RIGHT_LIMIT = 0x1f;
const WINDOW_BOTTOM_LIMIT = 0x1b;
const WINDOW_MAP_ROW_SHIFT = 0x5;
const WINDOW_TILE_LIMIT = 0x2400;
const WINDOW_TILE_WRAP_START = 0x2027;

// 80:F963: open a window (position, size and attributes in DP00 to DP08) and return its
// number in DP00. These fixed native algorithms implement the pinned graph. They do not
// decode instructions, execute a CPU, or calculate a hardware product.
// The same caller segments serve observation replay and finite continuation.
export function openWindow(
  a,
  observations,
  outerReturn = true,
  allowRemainingWaitObservations = false,
) {
  const result = drainNativeSequence(f963Sequence(a, observations, outerReturn));
  // Only the enclosing FEC1 composition can retain later helper events; its
  // outer wrapper still rejects every unused observation. Standalone stays strict.
  if (
    !allowRemainingWaitObservations &&
    result.waitObservationsUsed !== (observations?.values?.length ?? 0)
  )
    taskStop('task_wait_observation_unused', {
      observationIndex: result.waitObservationsUsed,
    });
  return result;
}
export function* f963Sequence(a, observations, outerReturn) {
  let waitIndex = 0,
    allocationIndex = null,
    wrapped = false,
    topVisits = 0,
    rows = 0,
    cells = 0,
    bottomVisits = 0,
    resets = 0;
  const waitEvents = [],
    interruptEvents =
      observations?.interruptEvents?.interrupts !== undefined ? observations.interruptEvents : null;
  const h = leafAccess(a),
    { ctx } = h;
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK);
  };
  const dec = () => h.load((ctx.a - 1) & WORD_MASK);
  const dx = () => h.index('x', (ctx.x - 1) & WORD_MASK);
  const iy = () => h.index('y', (ctx.y + 1) & WORD_MASK);
  const read = (offset) => h.longRead(h.abs(offset));
  const write = (offset, value) => h.longWrite(h.abs(offset), value);
  const dpWrite = (offset, value) => a.writeWord(offset, value, BANK_WRAP, 'F963-DP-store');
  const pushByte = (value, label) => {
    a.write(ctx.s, value, label);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  };
  const pullByte = (label) => {
    const value = a.read((ctx.s + 1) & WORD_MASK, label);
    ctx.s = (ctx.s + 1) & WORD_MASK;
    return value;
  };
  // The frame exists from the original call until its own return. A callee
  // without an RTS/RTL equation leaves the fresh pull to this caller segment.
  const call = function* (pc, continuation, target, long, body) {
    let callerBank;
    yield () => {
      callerBank = ctx.programBank;
      if (long) pushByte(callerBank, 'F963-JSL-bank');
      a.pushWord((continuation - 1) & WORD_MASK, 'F963-inner-return');
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const result = yield* body();
    yield () => {
      if (result?.rawReturnWord !== undefined) {
        if (
          result.rawReturnWord !== ((continuation - 1) & WORD_MASK) ||
          ctx.programBank !== callerBank ||
          ctx.pc !== (continuation & WORD_MASK)
        )
          taskStop('task_native_helper_return_required', {
            pc,
            raw: result.rawReturnWord,
            bank: ctx.programBank,
          });
        return;
      }
      const raw = a.pullWord('F963-inner-return-fresh'),
        bank = long ? pullByte('F963-RTL-bank-fresh') : callerBank;
      if (raw !== ((continuation - 1) & WORD_MASK) || bank !== callerBank)
        taskStop('task_native_helper_return_required', { pc, raw, bank });
      ctx.programBank = bank;
      ctx.pc = continuation & WORD_MASK;
    };
  };
  const segment = function* (run) {
    let result;
    yield () => {
      result = run();
    };
    return result;
  };
  const wait = function* (pc, offset) {
    if (interruptEvents)
      return yield {
        continuation: new WordWaitContinuation(dialogAccess(a), interruptEvents, pc),
      };
    return yield* segment(() => {
      if (observations?.mode !== 'record-observations') taskStop('task_wait_mode_required');
      for (;;) {
        const address = h.abs(offset),
          observation = observations.values?.[waitIndex];
        if (
          !observation ||
          observation.pc !== pc ||
          observation.address !== address ||
          observation.width !== 2
        )
          taskStop('task_wait_observation_required', {
            pc,
            address,
            width: 2,
            observationIndex: waitIndex,
          });
        waitIndex++;
        // Explicit external WORD observation, applied in the private overlay at
        // its original LDA. Each subsequent poll obtains its own fresh event.
        a.writeWord(address, observation.value, LONG_WRAP, 'F963-observed-wait-writer');
        waitEvents.push(Object.freeze({ ...observation }));
        h.load(read(offset));
        if (ctx.a === 0) break;
      }
    });
  };
  const request = function* () {
    yield () => {
      h.index('x', h.dp(0));
      h.load(h.longRead(WRAM + WINDOW_TILE_START + ctx.x));
      for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
      h.arithmetic(TEXT_TILE_VRAM_BEFORE_START);
      write(TEXT_TILE_UPLOAD_ADDRESS, ctx.a);
      h.load(h.longRead(WRAM + WINDOW_TILE_COUNT + ctx.x));
      for (let n = 0; n < TEXT_TILE_BYTE_SHIFT; n++) h.asl();
      write(TEXT_TILE_UPLOAD_BYTES, ctx.a);
      const count = h.nz((read(TEXT_TILE_UPLOAD) + 1) & WORD_MASK);
      write(TEXT_TILE_UPLOAD, count);
    };
    yield* call(0x80fa84, 0x80fa88, 0x81acbd, true, () => wait(0x81acbd, TEXT_TILE_UPLOAD));
  };
  const entry = () =>
    segment(() => {
      pushByte(ctx.bank, 'ACCF-PHB');
      a.pushWord(WRAM_BANK_PAIR, 'ACCF-PEA');
      ctx.bank = pullByte('ACCF-PLB-first');
      h.nz(ctx.bank, 1);
      ctx.bank = pullByte('ACCF-PLB-second');
      h.nz(ctx.bank, 1);
      dpWrite(DP_DRAW_WINDOW_INDEX, ctx.x);
      h.load(h.longRead(WRAM + WINDOW_TILE_INITIAL + ctx.x));
      dpWrite(DP_DRAW_TILE, ctx.a);
      h.load(h.longRead(WRAM + WINDOW_ATTRIBUTES + ctx.x));
      dpWrite(DP_DRAW_ATTRIBUTES, ctx.a);
      h.load(h.longRead(WRAM + WINDOW_MAP_OFFSET + ctx.x));
      dpWrite(DP_DRAW_MAP_ROW, ctx.a);
      h.index('y', ctx.a);
      const emit = () => h.longWrite(h.abs(WINDOW_MAP_BUFFER) + ctx.y, ctx.a);
      const cap = (value) => {
        h.load(value);
        h.load(ctx.a | h.dp(DP_DRAW_ATTRIBUTES));
        emit();
      };
      const advance = () => {
        iy();
        iy();
      };
      const rowBase = () => {
        ctx.status &= ~FLAG_CARRY;
        h.load(h.dp(DP_DRAW_MAP_ROW));
        h.arithmetic(WINDOW_MAP_ROW_BYTES);
        dpWrite(DP_DRAW_MAP_ROW, ctx.a);
        h.index('y', ctx.a);
      };
      cap(WINDOW_BORDER_TOP_LEFT);
      advance();
      h.load(h.longRead(WRAM + WINDOW_COLUMNS + ctx.x));
      dec();
      dec();
      dpWrite(DP_DRAW_COLUMNS, ctx.a);
      h.index('x', ctx.a);
      do {
        cap(WINDOW_BORDER_TOP);
        topVisits++;
        advance();
        dx();
      } while (ctx.x !== 0);
      cap(WINDOW_BORDER_TOP_RIGHT);
      h.index('x', h.dp(DP_DRAW_WINDOW_INDEX));
      h.load(h.longRead(WRAM + WINDOW_ROWS + ctx.x));
      dec();
      dec();
      h.index('x', ctx.a);
      do {
        rows++;
        rowBase();
        cap(WINDOW_BORDER_LEFT);
        advance();
        h.load(h.dp(DP_DRAW_COLUMNS));
        dpWrite(DP_DRAW_REMAINING, ctx.a);
        h.load(h.dp(DP_DRAW_TILE));
        h.load(ctx.a | h.dp(DP_DRAW_ATTRIBUTES));
        let remaining;
        do {
          emit();
          cells++;
          h.load((ctx.a + 1) & WORD_MASK);
          dpWrite(DP_DRAW_TILE, h.nz((h.dp(DP_DRAW_TILE) + 1) & WORD_MASK));
          advance();
          remaining = h.nz((h.dp(DP_DRAW_REMAINING) - 1) & WORD_MASK);
          dpWrite(DP_DRAW_REMAINING, remaining);
        } while (remaining !== 0);
        cap(WINDOW_BORDER_RIGHT);
        a.pushWord(ctx.x, 'ACCF-PHX');
        h.index('x', h.dp(DP_DRAW_WINDOW_INDEX));
        ctx.status |= FLAG_CARRY;
        h.load(h.dp(DP_DRAW_TILE));
        h.arithmetic(h.longRead(WRAM + WINDOW_TILE_START + ctx.x), true);
        compare(ctx.a, h.longRead(WRAM + WINDOW_TILE_COUNT + ctx.x));
        if (ctx.status & FLAG_CARRY) {
          h.load(h.longRead(WRAM + WINDOW_TILE_START + ctx.x));
          dpWrite(DP_DRAW_TILE, ctx.a);
          resets++;
        }
        h.index('x', a.pullWord('ACCF-PLX-fresh'));
        dx();
      } while (ctx.x !== 0);
      rowBase();
      cap(WINDOW_BORDER_BOTTOM_LEFT);
      advance();
      h.index('x', h.dp(DP_DRAW_COLUMNS));
      do {
        cap(WINDOW_BORDER_BOTTOM);
        bottomVisits++;
        advance();
        dx();
      } while (ctx.x !== 0);
      cap(WINDOW_BORDER_BOTTOM_RIGHT);
      h.index('x', h.dp(DP_DRAW_WINDOW_INDEX));
      ctx.bank = pullByte('ACCF-PLB-restored-fresh');
      h.nz(ctx.bank, 1);
    });
  const transfer = function* () {
    if (interruptEvents)
      return yield {
        continuation: new RequestWaitContinuation(dialogAccess(a), interruptEvents, 0x81acb5),
      };
    yield () => {
      const count = h.nz((read(TEXT_MAP_UPLOAD) + 1) & WORD_MASK);
      write(TEXT_MAP_UPLOAD, count);
    };
    yield* call(0x81acb8, 0x81acbc, 0x81acaf, true, () => wait(0x81acaf, TEXT_MAP_UPLOAD));
  };
  let capacityEnd;
  yield () => {
    h.index('x', read(WINDOW_LAST_INDEX));
    h.index('x', (ctx.x + 1) & WORD_MASK);
    h.index('x', (ctx.x + 1) & WORD_MASK);
    compare(ctx.x, WINDOW_INDEX_LIMIT);
    capacityEnd = Boolean(ctx.status & FLAG_CARRY);
  };
  if (!capacityEnd) {
    yield () => {
      allocationIndex = ctx.x;
      write(WINDOW_LAST_INDEX, ctx.x);
      const clamp = (position, extent, maximum) => {
        h.load(h.dp(position));
        dec();
        if (ctx.a & WORD_SIGN) {
          h.load(1);
          dpWrite(position, ctx.a);
        } else {
          ctx.status |= FLAG_CARRY;
          h.load(maximum);
          h.arithmetic(h.dp(extent), true);
          compare(ctx.a, h.dp(position));
          if (!(ctx.status & FLAG_CARRY)) dpWrite(position, ctx.a);
        }
      };
      clamp(0, DP_WINDOW_COLUMNS, WINDOW_RIGHT_LIMIT);
      clamp(2, DP_WINDOW_ROWS, WINDOW_BOTTOM_LIMIT);
      h.load(h.dp(2));
      for (let n = 0; n < WINDOW_MAP_ROW_SHIFT; n++) h.asl();
      h.arithmetic(h.dp(0));
      h.asl();
      h.longWrite(WRAM + WINDOW_MAP_OFFSET + ctx.x, ctx.a);
      h.load(h.dp(DP_WINDOW_COLUMNS));
      h.longWrite(WRAM + WINDOW_COLUMNS + ctx.x, ctx.a);
      dec();
      dec();
      for (let n = 0; n < TEXT_TILE_PIXEL_SHIFT; n++) h.asl();
      h.longWrite(WRAM + WINDOW_WIDTH_PIXELS + ctx.x, ctx.a);
      h.load(h.dp(DP_WINDOW_ROWS));
      h.longWrite(WRAM + WINDOW_ROWS + ctx.x, ctx.a);
      h.load(h.dp(DP_WINDOW_ATTRIBUTES));
      h.longWrite(WRAM + WINDOW_ATTRIBUTES + ctx.x, ctx.a);
      h.load(0);
      for (const offset of [
        WINDOW_CURSOR_PIXEL,
        WINDOW_LEFT_PIXEL,
        WINDOW_STYLE,
        0x2160, // magic-number-ok: The role of this window field is unproved.
      ])
        h.longWrite(WRAM + offset + ctx.x, ctx.a);
      h.load(h.longRead(h.abs(WINDOW_ACTIVE) + ctx.x));
      dec();
      h.longWrite(h.abs(WINDOW_ACTIVE) + ctx.x, ctx.a);
      ctx.status |= FLAG_MEMORY_8BIT;
      h.load(h.dp(DP_WINDOW_COLUMNS, 1), 1);
      h.load((ctx.a - 1) & BYTE_MASK, 1);
      h.load((ctx.a - 1) & BYTE_MASK, 1);
      a.absoluteWrite(M7A, ctx.a & BYTE_MASK, 1, 0x80f9ec, 'F963-product-low');
      a.absoluteWrite(M7A, 0, 1, 0x80f9ef, 'F963-product-high');
      h.load(h.dp(DP_WINDOW_ROWS, 1), 1);
      h.load((ctx.a - 1) & BYTE_MASK, 1);
      h.load((ctx.a - 1) & BYTE_MASK, 1);
      a.absoluteWrite(M7B, ctx.a & BYTE_MASK, 1, 0x80f9f6, 'F963-product-factor');
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(read(WINDOW_NEXT_TILE));
      dpWrite(0, ctx.a);
      ctx.status &= ~FLAG_CARRY;
      h.load(a.absoluteRead(MPYL, 2, 0x80fa01, 'F963-product-first'));
      h.longWrite(WRAM + WINDOW_TILE_COUNT + ctx.x, ctx.a);
      h.arithmetic(read(WINDOW_NEXT_TILE));
      write(WINDOW_NEXT_TILE, ctx.a);
      compare(ctx.a, WINDOW_TILE_LIMIT);
      if (ctx.status & FLAG_CARRY) {
        wrapped = true;
        ctx.status &= ~FLAG_CARRY;
        h.load(WINDOW_TILE_WRAP_START);
        dpWrite(0, ctx.a);
        h.arithmetic(a.absoluteRead(MPYL, 2, 0x80fa19, 'F963-product-second-fresh'));
        write(WINDOW_NEXT_TILE, ctx.a);
      }
      h.load(h.dp(0));
      for (const offset of [WINDOW_TILE_START, WINDOW_TILE_INITIAL, WINDOW_CURSOR_TILE])
        h.longWrite(WRAM + offset + ctx.x, ctx.a);
      h.load(read(WINDOW_LAST_INDEX));
      dpWrite(0, ctx.a);
    };
    yield* call(0x80fa32, 0x80fa35, 0x80fa67, false, request);
    yield* call(0x80fa35, 0x80fa39, 0x81accf, true, entry);
    yield* call(0x80fa39, 0x80fa3d, 0x81acb5, true, transfer);
  }
  let result;
  yield () => {
    result = {
      ...finishLeaf(a, outerReturn),
      outcome: allocationIndex === null ? 'capacity_end' : 'allocation_prepared',
      allocationIndex,
      wrapped,
      topVisits,
      rows,
      cells,
      bottomVisits,
      resets,
      waitObservationsUsed: waitIndex,
      waitEvents: Object.freeze(waitEvents),
    };
  };
  return result;
}
// Shared window allocation adapter. Its observation index belongs to the
// enclosing owner; the continuation consumes only explicit interrupt records.
export function openWindowAdapter(h, e) {
  const p = openWindow(
    h.a,
    {
      mode: e.mode,
      interruptEvents: e,
      values: Object.freeze((e.values ?? []).slice(e.waitIndex)),
    },
    false,
    true,
  );
  e.waitIndex += p.waitObservationsUsed;
  e.waitEvents.push(...p.waitEvents);
  return p;
}
NATIVE_CALL_CONTINUATIONS.set(0x80f963, {
  run: openWindowAdapter,
  create: ({ h, events }) =>
    events?.interrupts === undefined
      ? null
      : new NativeCallContinuation(
          h.a,
          f963Sequence(
            h.a,
            {
              mode: events.mode,
              interruptEvents: events,
              values: Object.freeze([]),
            },
            false,
          ),
        ),
});
