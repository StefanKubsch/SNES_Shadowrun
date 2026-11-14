import {
  BYTE_MASK,
  BANK_SIZE,
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  GLOVE_NAME_WINDOW,
  WINDOW_ACTIVE,
  WINDOW_LAST_INDEX,
  WINDOW_TILE_START,
  WINDOW_NEXT_TILE,
  GLOVE_TARGET_TAG,
  GLOVE_TARGET_OBJECT,
  GLOVE_SNAP_X,
  GLOVE_X,
  GLOVE_SNAP_Y,
  GLOVE_Y,
  DRAW_LIST_INDEX,
  DRAW_LIST,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_KIND,
  GLOVE_KIND,
  AIMING_SPELL,
  SCRIPT_GLOVE_CHOICE,
  GLOVE_BASE_Y,
  OBJECT_DIAGONAL,
  OBJECT_HEIGHT,
  CAMERA_Y,
  OBJECT_BOX_X1,
  OBJECT_BOX_Y1,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y2,
  GLOVE_BASE_X,
  OBJECT_Y,
  OBJECT_X,
  CAMERA_X,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  PAD_HELD,
  GLOVE_SPEED_X,
  GLOVE_SPEED_Y,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderFADD } from './text-width-fadd.mjs';
import { renderF963 } from './allocate-f963.mjs';
import { renderFE69 } from './text-compose.mjs';
import { renderAD92 } from './compose-ad92.mjs';
import { textNZ } from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const HELD_STACK_BYTES = 32;
const SELECTION_STACK_BYTES = 30;
const STATUS_CV = 65;
const OVERFLOW_BIT = 64;
const WORD_SIGN_SHIFT = 15;
const OVERFLOW_FLAG_SHIFT = 6;
const PROJECTED_X_SCRATCH = 0x14;
const NAME_WINDOW_TOP = 23;
const PROJECTED_Y_SCRATCH = 0x17;
const GLOVE_X_SCRATCH = 0x0e;
const GLOVE_Y_SCRATCH = 0x11;
const SPELL_TARGET_KIND = 11;
const SPELL_GLOVE = 0xfffd;
const INDEX_SCRATCH = 0x1a;
const OBJECT_KIND_FLAGS = 3;
const LAST_NUMBER_NAME_INDEX = 24;
const NAME_PADDING_PIXELS = 24;
const COLUMNS_ARGUMENT = 4;
const NAME_RIGHT_COLUMN = 30;
const NAME_WINDOW_ROWS = 3;
const ROWS_ARGUMENT = 6;
const NAME_WINDOW_ATTRIBUTES = 0x800;
const ATTRIBUTES_ARGUMENT = 8;
const DIRECTION_NIBBLE_MASK = 15;
const POSITIVE_ACCELERATION = 47;
const NEGATIVE_ACCELERATION = 48;
const MAX_GLOVE_SPEED = 768;
const NEGATIVE_MAX_SPEED = 0xfd00;
const MAX_GLOVE_X = 0xef00;
const MAX_GLOVE_Y = 0xce00;
const MIN_GLOVE_POSITION = 768;

function prepare(
  run,
  stackBytes,
  {
    data,
    bank = null,
    status = null,
    x = null,
    y = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    divisionMode = null,
    ioMode = null,
    ioRead2134 = null,
    ioRead4214 = null,
    ioRead4216 = null,
    waitMode = null,
    waitRead01F6 = null,
    waitRead01F8 = null,
    waitRead01FA = null,
    waitRead01FC = null,
  } = {},
) {
  if (
    [x, y].some((v) => v !== null && !isWord(v)) ||
    (divisionMode !== null && divisionMode !== 'stable-native') ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead2134, ioRead4216, waitRead01F6, waitRead01F8, waitRead01FA, waitRead01FC].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    ) ||
    (ioRead4214 !== null &&
      (!Array.isArray(ioRead4214) ||
        !Array.from(ioRead4214).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK)))
  )
    throw Error('Invalid render held composition context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    stackBytes,
  );
  if (entry) return entry;
  if (x === null || y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      run(
        view,
        {
          bank,
          status,
          x,
          y,
          divisionMode,
          ioMode,
          ioRead2134,
          ioRead4214,
          ioRead4216,
          waitMode,
          waitRead01F6,
          waitRead01F8,
          waitRead01FA,
          waitRead01FC,
        },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}
export const prepareRenderBE6D = (context) => prepare(renderBE6D, HELD_STACK_BYTES, context);
export const prepareRenderBCBE = (context) => prepare(renderBCBE, SELECTION_STACK_BYTES, context);

// Source-specific WORD arithmetic and ordered data for these two fixed
// algorithms; no code fetch, opcode dispatch, stack execution or device clock.
function composition(view, context, budget) {
  budget.outputBytes ??= 0;
  const r = { a: 0, x: context.x, y: context.y, bank: context.bank, status: context.status };
  const operations = [],
    byteOperations = [],
    calls = [],
    waitOperations = [];
  const counts = context.heldObservations ?? {
    productReads: 0,
    pollsF6: 0,
    pollsF8: 0,
    quotientReads: 0,
    resultReads: 0,
    pollsFA: 0,
    pollsFC: 0,
  };
  let phase = 'held',
    visits = 0;
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const shared = {
    read(address) {
      tick();
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', phase, address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      tick();
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', phase, address, value, bytes: 1 }));
    },
  };
  const absolute = (offset, index = 0) => (r.bank * BANK_SIZE + offset + index) & LONG_MASK;
  const record = (kind, address, value) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes: 2 }));
    return value;
  };
  const read = (address) =>
    record(
      'read',
      address,
      shared.read(address) | (shared.read((address + 1) & LONG_MASK) << BYTE_BITS),
    );
  const write = (address, value) => {
    value &= WORD_MASK;
    shared.write(address, value & BYTE_MASK);
    shared.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
    record('write', address, value);
  };
  const load = (value) => {
    r.a = value & WORD_MASK;
    r.status = textNZ(r.status, r.a);
  };
  const index = (name, value) => {
    r[name] = value & WORD_MASK;
    r.status = textNZ(r.status, r[name]);
  };
  const compare = (left, right) => {
    r.status = textNZ((r.status & ~1) | Number(left >= right), (left - right) & WORD_MASK);
  };
  const arithmetic = (right, subtract = false) => {
    const left = r.a,
      total = subtract ? left - right - (1 - (r.status & 1)) : left + right + (r.status & 1);
    const next = total & WORD_MASK;
    r.status =
      (r.status & ~STATUS_CV) |
      Number(subtract ? total >= 0 : total > WORD_MASK) |
      ((subtract ? left ^ right : ~(left ^ right)) & (left ^ next) & WORD_SIGN ? OVERFLOW_BIT : 0);
    load(next);
  };
  const carry = (value) => {
    r.status = (r.status & ~1) | value;
  };
  const left = () => {
    const n = r.a;
    carry(n >>> WORD_SIGN_SHIFT);
    load(n << 1);
  };
  const right = (rotate = false) => {
    const n = r.a,
      incoming = r.status & 1;
    carry(n & 1);
    load((n >>> 1) | (rotate ? incoming << WORD_SIGN_SHIFT : 0));
  };
  const swap = () => {
    r.a = (r.a >>> BYTE_BITS) | ((r.a & BYTE_MASK) << BYTE_BITS);
    r.status = textNZ(r.status, r.a & BYTE_MASK, 1);
  };
  const call = (name, run) => {
    const callerPhase = phase;
    phase = name;
    const result = run(
      shared,
      {
        ...context,
        ...r,
        observations: counts,
        ioRead2134: context.ioRead2134?.slice(counts.productReads) ?? null,
        waitRead01F6: context.waitRead01F6?.slice(counts.pollsF6) ?? null,
        waitRead01F8: context.waitRead01F8?.slice(counts.pollsF8) ?? null,
      },
      budget,
    );
    for (const event of result.operations ?? []) operations.push(event);
    for (const event of result.waitOperations ??
      (result.operations ?? []).filter((v) => v.phase === 'wait'))
      waitOperations.push(event);
    Object.assign(r, { a: result.a, x: result.x, y: result.y, status: result.status });
    if (name === 'F963') {
      counts.productReads += result.productReads ?? 0;
      counts.pollsF6 += result.requestPolls ?? 0;
      counts.pollsF8 += result.transferPolls ?? 0;
    }
    if (name === 'AD92') counts.pollsF8 += result.polls;
    calls.push(
      Object.freeze({
        name,
        outcome: result.outcome,
        a: r.a,
        x: r.x,
        y: r.y,
        status: r.status,
        outputBytes: budget.outputBytes,
        ...counts,
        ...(result.conversion?.af1f.divisions
          ? {
              stableDivisions: result.conversion.af1f.divisions,
              stableDivisionReads: result.conversion.af1f.divisionReads,
            }
          : {}),
      }),
    );
    phase = callerPhase;
    return result;
  };
  const finish = (outcome) => {
    const ioRequests = operations.filter((v) => v.space === 'io');
    return {
      handled: true,
      outcome,
      ...r,
      carry: r.status & 1,
      overflow: (r.status >>> OVERFLOW_FLAG_SHIFT) & 1,
      ...counts,
      visits,
      outputBytes: budget.outputBytes,
      work: budget.work,
      byteAccesses: byteOperations.length,
      byteOperations: Object.freeze(byteOperations),
      operations: Object.freeze(operations),
      ioRequests: Object.freeze(ioRequests),
      waitOperations: Object.freeze(waitOperations),
      ioWrites: Object.freeze(ioRequests.filter((v) => v.kind === 'write')),
      calls: Object.freeze(calls),
    };
  };

  // The full BE5B/FA3E reset/release path, including unconditional AD92.
  const release = () => {
    const oldPhase = phase;
    phase = 'releaseBE5B';
    load(read(absolute(GLOVE_NAME_WINDOW)));
    write(0, r.a);
    index('x', read(0));
    load(0);
    write(absolute(WINDOW_ACTIVE, r.x), r.a);
    compare(r.x, read(absolute(WINDOW_LAST_INDEX)));
    if (r.status & 2) {
      do {
        index('x', r.x - 1);
        index('x', r.x - 1);
        if (r.status & FLAG_NEGATIVE) break;
        load(read(absolute(WINDOW_ACTIVE, r.x)));
      } while (r.a === 0);
      index('x', r.x + 1);
      index('x', r.x + 1);
      load(read(WRAM_BASE + WINDOW_TILE_START + r.x));
      write(absolute(WINDOW_NEXT_TILE), r.a);
      index('x', r.x - 1);
      index('x', r.x - 1);
      write(absolute(WINDOW_LAST_INDEX), r.x);
    }
    call('AD92', renderAD92);
    load(WORD_MASK);
    write(absolute(GLOVE_TARGET_TAG), r.a);
    write(absolute(GLOVE_TARGET_OBJECT), r.a);
    phase = oldPhase;
  };
  const exhausted = () => {
    load(read(absolute(GLOVE_TARGET_TAG)));
    if (!(r.status & FLAG_NEGATIVE)) release();
    return finish('selection_exhausted');
  };
  const tracking = () => {
    phase = 'tracking';
    carry(1);
    load(read(PROJECTED_X_SCRATCH));
    arithmetic(read(absolute(GLOVE_SNAP_X)), true);
    compare(r.a, BYTE_MASK);
    if (r.status & 1) {
      release();
      return finish('tracking_released');
    }
    swap();
    write(absolute(GLOVE_X), r.a);
    carry(1);
    load(read(PROJECTED_Y_SCRATCH));
    arithmetic(read(absolute(GLOVE_SNAP_Y)), true);
    compare(r.a, BYTE_MASK);
    if (r.status & 1) {
      release();
      return finish('tracking_released');
    }
    swap();
    write(absolute(GLOVE_Y), r.a);
    return finish('target_tracked');
  };
  const selection = () => {
    phase = 'selection';
    index('y', read(absolute(DRAW_LIST_INDEX)));
    if (r.status & FLAG_NEGATIVE) return exhausted();
    load(read(absolute(GLOVE_X)));
    swap();
    load(r.a & BYTE_MASK);
    write(GLOVE_X_SCRATCH, r.a);
    load(read(absolute(GLOVE_Y)));
    swap();
    load(r.a & BYTE_MASK);
    write(GLOVE_Y_SCRATCH, r.a);
    search: for (;;) {
      visits++;
      index('x', read(absolute(DRAW_LIST, r.y)));
      load(read(absolute(OBJECT_ACTION_DIRECTIONS, r.x)));
      if (r.a !== 0) {
        load(read(WRAM_BASE + OBJECT_KIND + r.x));
        compare(r.a, SPELL_TARGET_KIND);
        if (r.status & 2) {
          load(read(absolute(GLOVE_KIND)));
          compare(r.a, SPELL_GLOVE);
          if (!(r.status & 2)) {
            load(read(absolute(AIMING_SPELL)));
            load(r.a | read(absolute(SCRIPT_GLOVE_CHOICE)));
            if (r.a === 0) {
              index('y', r.y - 1);
              index('y', r.y - 1);
              if (r.status & FLAG_NEGATIVE) return exhausted();
              continue;
            }
          }
          load(read(WRAM_BASE + OBJECT_KIND + r.x));
        }
        left();
        write(INDEX_SCRATCH, r.a);
        left();
        arithmetic(read(INDEX_SCRATCH));
        write(INDEX_SCRATCH, r.x);
        index('x', r.a);
        load(read(0x8cefb0 + r.x));
        index('x', read(INDEX_SCRATCH));
        compare(r.a, WORD_MASK);
        if (!(r.status & 2)) {
          carry(1);
          load(read(absolute(GLOVE_BASE_Y)));
          arithmetic(read(absolute(OBJECT_DIAGONAL, r.x)), true);
          carry(1);
          arithmetic(read(absolute(OBJECT_HEIGHT, r.x)), true);
          carry(1);
          arithmetic(read(absolute(CAMERA_Y)), true);
          if (!(r.status & FLAG_NEGATIVE)) {
            right();
            right();
            write(PROJECTED_Y_SCRATCH, r.a);
            left();
            carry(1);
            arithmetic(read(WRAM_BASE + OBJECT_BOX_X1 + r.x), true);
            carry(1);
            arithmetic(read(WRAM_BASE + OBJECT_BOX_Y1 + r.x), true);
            if (!(r.status & FLAG_NEGATIVE)) {
              right();
              compare(r.a, read(GLOVE_Y_SCRATCH));
              if (r.status & 1) {
                load(read(PROJECTED_Y_SCRATCH));
                carry(1);
                arithmetic(read(WRAM_BASE + OBJECT_BOX_HEIGHT + r.x), true);
                left();
                carry(1);
                arithmetic(read(WRAM_BASE + OBJECT_BOX_X2 + r.x), true);
                carry(1);
                arithmetic(read(WRAM_BASE + OBJECT_BOX_Y2 + r.x), true);
                let rejected = false;
                if (!(r.status & FLAG_NEGATIVE)) {
                  right();
                  compare(r.a, read(GLOVE_Y_SCRATCH));
                  rejected = Boolean(r.status & 1);
                }
                if (!rejected) {
                  carry(0);
                  load(read(absolute(GLOVE_BASE_X)));
                  arithmetic(read(absolute(OBJECT_Y, r.x)));
                  carry(1);
                  arithmetic(read(absolute(OBJECT_X, r.x)), true);
                  carry(1);
                  arithmetic(read(absolute(CAMERA_X)), true);
                  if (r.status & FLAG_NEGATIVE) {
                    carry(1);
                    right(true);
                    carry(1);
                    right(true);
                  }
                  right();
                  right();
                  write(PROJECTED_X_SCRATCH, r.a);
                  carry(1);
                  arithmetic(read(WRAM_BASE + OBJECT_BOX_X1 + r.x), true);
                  carry(0);
                  arithmetic(read(WRAM_BASE + OBJECT_BOX_Y2 + r.x));
                  if (!(r.status & FLAG_NEGATIVE)) {
                    compare(r.a, read(GLOVE_X_SCRATCH));
                    if (r.status & 1) {
                      load(read(PROJECTED_X_SCRATCH));
                      carry(0);
                      arithmetic(read(WRAM_BASE + OBJECT_BOX_Y1 + r.x));
                      carry(1);
                      arithmetic(read(WRAM_BASE + OBJECT_BOX_X2 + r.x), true);
                      if (r.status & FLAG_NEGATIVE) break search;
                      compare(r.a, read(GLOVE_X_SCRATCH));
                      if (!(r.status & 1)) break search;
                    }
                  }
                }
              }
            }
          }
        }
      }
      index('y', r.y - 1);
      index('y', r.y - 1);
      if (r.status & FLAG_NEGATIVE) return exhausted();
    }
    load(read(absolute(GLOVE_TARGET_TAG)));
    if (!(r.status & FLAG_NEGATIVE)) {
      compare(r.a, read(WRAM_BASE + OBJECT_KIND + r.x));
      if (r.status & 2) {
        compare(r.x, read(absolute(GLOVE_TARGET_OBJECT)));
        if (r.status & 2) return tracking();
      }
      const savedX = r.x;
      release();
      index('x', savedX);
    }
    carry(1);
    load(read(PROJECTED_X_SCRATCH));
    arithmetic(read(GLOVE_X_SCRATCH), true);
    write(absolute(GLOVE_SNAP_X), r.a);
    carry(1);
    load(read(PROJECTED_Y_SCRATCH));
    arithmetic(read(GLOVE_Y_SCRATCH), true);
    write(absolute(GLOVE_SNAP_Y), r.a);
    load(read(WRAM_BASE + OBJECT_KIND + r.x));
    write(absolute(GLOVE_TARGET_TAG), r.a);
    write(absolute(GLOVE_TARGET_OBJECT), r.x);
    load(read(absolute(OBJECT_FLAGS, r.x)));
    load(r.a & OBJECT_KIND_FLAGS);
    compare(r.a, OBJECT_KIND_FLAGS);
    if (r.status & 2) {
      load(read(absolute(OBJECT_NUMBER, r.x)));
      index('x', LAST_NUMBER_NAME_INDEX);
      do {
        compare(r.a, read(0x809700 + r.x));
        if (r.status & 2) break;
        index('x', r.x - 1);
        index('x', r.x - 1);
      } while (!(r.status & FLAG_NEGATIVE));
      load(read(0x809782 + r.x));
    } else {
      load(read(absolute(GLOVE_TARGET_TAG)));
      left();
      write(INDEX_SCRATCH, r.a);
      left();
      arithmetic(read(INDEX_SCRATCH));
      index('x', r.a);
      load(read(0x8cefb0 + r.x));
    }
    write(0, r.a);
    const savedText = r.a;
    call('FADD', renderFADD);
    carry(0);
    arithmetic(NAME_PADDING_PIXELS);
    right();
    right();
    right();
    write(COLUMNS_ARGUMENT, r.a);
    carry(1);
    load(NAME_RIGHT_COLUMN);
    arithmetic(read(COLUMNS_ARGUMENT), true);
    write(0, r.a);
    load(NAME_WINDOW_TOP);
    write(2, r.a);
    load(NAME_WINDOW_ROWS);
    write(ROWS_ARGUMENT, r.a);
    load(NAME_WINDOW_ATTRIBUTES);
    write(ATTRIBUTES_ARGUMENT, r.a);
    call('F963', renderF963);
    load(read(0));
    write(absolute(GLOVE_NAME_WINDOW), r.a);
    load(savedText);
    write(2, r.a);
    call('FE69', renderFE69);
    return finish('target_text_composed');
  };
  const held = () => {
    load(read(absolute(GLOVE_KIND)));
    if (r.a === 0) return finish('held_disabled');
    load(read(absolute(PAD_HELD)));
    swap();
    load(r.a & DIRECTION_NIBBLE_MASK);
    right();
    index('x', r.a);
    const velocity = (offset, positive) => {
      if (!positive) {
        right();
        if (!(r.status & 1)) {
          write(absolute(offset), 0);
          return;
        }
      }
      load(read(absolute(offset)));
      if (positive ? r.status & FLAG_NEGATIVE : !(r.status & FLAG_NEGATIVE)) load(0);
      arithmetic(positive ? POSITIVE_ACCELERATION : NEGATIVE_ACCELERATION, !positive);
      compare(r.a, positive ? MAX_GLOVE_SPEED : NEGATIVE_MAX_SPEED);
      if (positive ? r.status & 1 : !(r.status & 1))
        load(positive ? MAX_GLOVE_SPEED : NEGATIVE_MAX_SPEED);
      write(absolute(offset), r.a);
    };
    velocity(GLOVE_SPEED_X, Boolean(r.status & 1));
    load(r.x);
    right();
    right();
    velocity(GLOVE_SPEED_Y, Boolean(r.status & 1));
    for (const [position, speed, upper] of [
      [GLOVE_X, GLOVE_SPEED_X, MAX_GLOVE_X],
      [GLOVE_Y, GLOVE_SPEED_Y, MAX_GLOVE_Y],
    ]) {
      carry(0);
      load(read(absolute(position)));
      arithmetic(read(absolute(speed)));
      compare(r.a, MIN_GLOVE_POSITION);
      if (!(r.status & 1)) load(MIN_GLOVE_POSITION);
      compare(r.a, upper + 1);
      if (r.status & 1) load(upper);
      write(absolute(position), r.a);
    }
    load(read(absolute(PAD_HELD)));
    swap();
    load(r.a & DIRECTION_NIBBLE_MASK);
    if (r.a === 0) return selection();
    load(read(absolute(GLOVE_TARGET_TAG)));
    if (r.status & FLAG_NEGATIVE) return finish('held_moved');
    release();
    return finish('held_released');
  };
  return { held, selection, phase: () => phase };
}
function run(view, context, budget, kind) {
  const owner = composition(view, context, budget);
  try {
    return owner[kind]();
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, heldPhase: owner.phase() };
  }
}
export const renderBE6D = (view, context, budget) => run(view, context, budget, 'held');
export const renderBCBE = (view, context, budget) => run(view, context, budget, 'selection');
