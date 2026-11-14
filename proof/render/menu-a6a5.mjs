import {
  BYTE_MASK,
  BANK_SIZE,
  LONG_MASK,
  WORD_MASK,
  WORD_BITS,
} from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  MENU_SELECTION,
  MENU_PAGE_START,
  MENU_NAVIGATION_INPUT,
  MENU_HOTKEYS,
  PAD_PRESSED,
  MENU_SHOW_NUMBERS,
  MENU_COLUMN,
  MENU_ROW,
  MENU_REPEAT_COUNTER,
  PAD_HELD,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderA617, renderA5DB, renderA5F9 } from './list-a617.mjs';
import { renderFA67 } from './request-fa67.mjs';
import { renderB0A1 } from './counter-b0a1.mjs';
import { render9E1A } from './input-9e1a.mjs';
import { renderC46E } from './audio-c46e.mjs';
import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const MENU_STACK_BYTES = 20;
const LIST_POINTER_ARGUMENT = 8;
const LIST_BANK_ARGUMENT = 10;
const HOTKEY_POINTER_ARGUMENT = 12;
const AUDIO_LEVEL = 0x40;
const AUDIO_PARAMETERS_ARGUMENT = 4;
const AUDIO_VOICES_ARGUMENT = 6;
const ROW_ARGUMENT = 4;
const AUDIO_VOICES = 3;
const VISIBLE_ROWS_ARGUMENT = 6;
const CONFIRM_SOUND = 0x4c;
const MOVE_SOUND = 0x4a;
const NAVIGATE_DOWN = 0x400;
const NAVIGATE_UP = 0x800;
const PAGE_PREVIOUS = 0x20;
const PAGE_NEXT = 0x10;
const WORD_SIGN_SHIFT = 15;
const VERTICAL_DIRECTIONS = 0xc00;
const REPEAT_DELAY = 20;
const REPEAT_RESTART = 19;
const CANCEL_BUTTON = 0x2000;
const CONFIRM_BUTTONS = 0xd0c0;

const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK;
function prepare(
  run,
  needsA,
  {
    data,
    bank = null,
    status = null,
    a = null,
    x = null,
    y = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    ioMode = null,
    waitMode = null,
    ioRead4214Word = null,
    ioRead4216Byte = null,
    ioRead4214 = null,
    ioRead4216 = null,
    ioRead4217 = null,
    ioRead2140 = null,
    waitRead01F6 = null,
    waitRead01FA = null,
    waitRead01FC = null,
    waitRead1C76 = null,
  } = {},
) {
  if (
    [a, x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead4214Word, ioRead4216, waitRead01F6, waitRead01FA, waitRead01FC, waitRead1C76].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    ) ||
    [ioRead4216Byte, ioRead4214, ioRead4217, ioRead2140].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isByte)),
    )
  )
    throw Error('Invalid render menu context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    MENU_STACK_BYTES,
  );
  if (entry) return entry;
  if (needsA && a === null) return { handled: false, reason: 'render_entry_required' };
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
          a,
          x,
          y,
          ioMode,
          waitMode,
          ioRead4214Word,
          ioRead4216Byte,
          ioRead4214,
          ioRead4216,
          ioRead4217,
          ioRead2140,
          waitRead01F6,
          waitRead01FA,
          waitRead01FC,
          waitRead1C76,
          stackBytes: stackWindow[1] - stackWindow[0] + 1,
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
export const prepareRenderA6A5 = (context) => prepare(renderA6A5, false, context);
export const prepareRenderA6AD = (context) => prepare(renderA6AD, false, context);
export const prepareRenderA6B8 = (context) => prepare(renderA6B8, true, context);
export const prepareRenderA6C7 = (context) => prepare(renderA6C7, false, context);

// Fixed original menu algorithm, not a CPU/stack interpreter. PEI/PHY saves
// are host values with the source-proved 20-byte disjoint-stack contract.
// All reads remain fresh; no input update is inferred from a counter change.
function compose(view, context, budget, helper) {
  if (helper === 'A6B8' && context.a == null)
    throw { renderBoundary: true, reason: 'render_entry_required' };
  budget.outputBytes ??= 0;
  const r = {
    a: context.a ?? 0,
    x: context.x ?? null,
    y: context.y ?? null,
    bank: context.bank,
    status: context.status,
  };
  const operations = [],
    byteOperations = [],
    calls = [];
  const counts = context.observations ?? {};
  for (const key of [
    'numberQuotientReads',
    'numberRemainderReads',
    'quotientReads',
    'resultReads',
    'pollsFA',
    'pollsFC',
    'pollsF6',
    'counterPolls',
    'panResultReads',
    'apuPolls',
  ])
    counts[key] ??= 0;
  let phase = helper,
    stage = 'prefix',
    iterations = 0,
    moves = 0,
    pages = 0,
    hotkeyReads = 0,
    repeats = 0;
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
  const io = textHelperAccess(shared, budget, operations, `menu${helper}`);
  const absolute = (offset) => (r.bank * BANK_SIZE + offset) & LONG_MASK;
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
  const bit = (mask) => {
    r.status = (r.status & ~2) | (r.a & mask ? 0 : 2);
    return Boolean(r.a & mask);
  };
  const arithmetic = (right, subtract = false) => {
    const left = r.a,
      total = subtract ? left - right - (1 - (r.status & 1)) : left + right + (r.status & 1);
    r.a = total & WORD_MASK;
    r.status = textArithmeticFlags(
      r.status,
      left,
      right,
      r.a,
      subtract ? total >= 0 : total > WORD_MASK,
      subtract,
    );
  };
  const half = () => {
    r.status = (r.status & ~1) | (r.a & 1);
    load(r.a >>> 1);
  };
  const call = (name, run, role) => {
    const before = Object.freeze({ ...r });
    phase = name;
    stage = role;
    const result = run(
      shared,
      {
        ...context,
        ...r,
        observations: counts,
        waitRead01F6: context.waitRead01F6?.slice(counts.pollsF6) ?? null,
        stackBytes: (context.stackBytes ?? MENU_STACK_BYTES) - 2,
      },
      budget,
    );
    operations.push(...result.operations);
    if (name === 'FA67') counts.pollsF6 += result.polls;
    Object.assign(r, {
      a: result.a,
      x: result.x,
      y: result.y,
      bank: result.bank,
      status: result.status,
    });
    calls.push(
      Object.freeze({
        name,
        role,
        before,
        after: Object.freeze({ ...r }),
        outcome: result.outcome,
        work: budget.work,
        outputBytes: budget.outputBytes,
        ...counts,
      }),
    );
    phase = helper;
  };
  const listToken = () => {
    const pointer = io.read(LIST_POINTER_ARGUMENT) | (io.read(LIST_BANK_ARGUMENT, 1) << WORD_BITS);
    return io.read((pointer + r.y) & LONG_MASK);
  };
  const shortToken = () => io.read(absolute(io.read(HOTKEY_POINTER_ARGUMENT) + r.y));
  const finish = (outcome, selection) =>
    textHelperResult(r, budget, operations, {
      outcome,
      helper,
      selection,
      iterations,
      moves,
      pages,
      hotkeyReads,
      repeats,
      ...counts,
      outputBytes: budget.outputBytes,
      calls: Object.freeze(calls),
      byteAccesses: byteOperations.length,
      byteOperations: Object.freeze(byteOperations),
    });
  const confirm = () => {
    stage = 'confirm';
    load(WORD_MASK);
    io.write(0, r.a);
    load(AUDIO_LEVEL);
    io.write(AUDIO_PARAMETERS_ARGUMENT, r.a);
    load(AUDIO_VOICES);
    io.write(AUDIO_VOICES_ARGUMENT, r.a);
    load(CONFIRM_SOUND);
    io.write(2, r.a);
    call('C46E', renderC46E, 'confirm-audio');
    load(io.read(absolute(MENU_SELECTION)));
    half();
    const selection = r.a;
    io.write(0, r.a);
    call('9E1A', render9E1A, 'confirm-input');
    return finish('menu_confirmed', selection);
  };
  const move = () => {
    const selectedY = r.y; // Original WORD PHY spans optional FA67/A617 or A5DB.
    compare(r.y, io.read(absolute(MENU_PAGE_START)));
    let previousPage = !(r.status & 1),
      nextPage = false;
    if (!previousPage) {
      load(r.y);
      r.status |= 1;
      arithmetic(io.read(absolute(MENU_PAGE_START)), true);
      half();
      compare(r.a, io.read(VISIBLE_ROWS_ARGUMENT));
      nextPage = Boolean(r.status & 1);
    }
    if (previousPage || nextPage) {
      stage = 'scroll';
      load(io.read(absolute(MENU_PAGE_START)));
      if (nextPage) {
        r.status &= ~1;
        arithmetic(io.read(VISIBLE_ROWS_ARGUMENT));
        arithmetic(io.read(VISIBLE_ROWS_ARGUMENT));
      } else {
        r.status |= 1;
        arithmetic(io.read(VISIBLE_ROWS_ARGUMENT), true);
        arithmetic(io.read(VISIBLE_ROWS_ARGUMENT), true);
        if (!(r.status & 1)) load(0);
      }
      io.write(absolute(MENU_PAGE_START), r.a);
      call('FA67', renderFA67, 'scroll-request');
      call('A617', renderA617, 'scroll-list');
      pages++;
    } else {
      index('y', io.read(absolute(MENU_SELECTION)));
      call('A5DB', renderA5DB, 'move-unmark');
    }
    index('y', selectedY);
    io.write(absolute(MENU_SELECTION), r.y);
    call('A5F9', renderA5F9, 'move-mark');
    moves++;
    // PEI reads do not affect A/P; both original words survive literal stores.
    const saved00 = io.read(0),
      saved06 = io.read(VISIBLE_ROWS_ARGUMENT);
    load(WORD_MASK);
    io.write(0, r.a);
    load(AUDIO_LEVEL);
    io.write(AUDIO_PARAMETERS_ARGUMENT, r.a);
    load(AUDIO_VOICES);
    io.write(AUDIO_VOICES_ARGUMENT, r.a);
    load(MOVE_SOUND);
    io.write(2, r.a);
    load(saved06);
    io.write(VISIBLE_ROWS_ARGUMENT, r.a);
    load(saved00);
    io.write(0, r.a);
  };
  const navigation = () => {
    load(io.read(absolute(MENU_NAVIGATION_INPUT)));
    if (bit(NAVIGATE_DOWN)) {
      index('y', io.read(absolute(MENU_SELECTION)));
      index('y', r.y + 1);
      index('y', r.y + 1);
      load(listToken());
      if (!r.a) return;
      move();
      return;
    }
    if (bit(NAVIGATE_UP)) {
      index('y', io.read(absolute(MENU_SELECTION)));
      if (!r.y) return;
      index('y', r.y - 1);
      index('y', r.y - 1);
      move();
      return;
    }
    load(io.read(absolute(MENU_HOTKEYS)));
    if (r.a) return;
    load(io.read(absolute(PAD_PRESSED)));
    if (bit(PAGE_PREVIOUS)) {
      load(io.read(absolute(MENU_PAGE_START)));
      if (!r.a) return;
      r.status |= 1;
      arithmetic(io.read(VISIBLE_ROWS_ARGUMENT), true);
      arithmetic(io.read(VISIBLE_ROWS_ARGUMENT), true);
      index('y', r.a);
      move();
      return;
    }
    if (!bit(PAGE_NEXT)) return;
    index('x', io.read(VISIBLE_ROWS_ARGUMENT));
    index('y', io.read(absolute(MENU_PAGE_START)));
    do {
      index('y', r.y + 1);
      index('y', r.y + 1);
      load(listToken());
      if (!r.a) return;
      index('x', r.x - 1);
    } while (r.x);
    move();
  };
  try {
    if (helper === 'A6B8') {
      const before = r.a;
      r.status = (r.status & ~1) | (before >>> WORD_SIGN_SHIFT);
      load(before << 1);
      io.write(absolute(MENU_SELECTION), r.a);
      load(WORD_MASK);
      io.write(absolute(MENU_SHOW_NUMBERS), r.a);
      io.write(absolute(MENU_HOTKEYS), 0);
    } else if (helper === 'A6AD') {
      load(WORD_MASK);
      io.write(absolute(MENU_SHOW_NUMBERS), r.a);
      io.write(absolute(MENU_HOTKEYS), 0);
      io.write(absolute(MENU_SELECTION), 0);
    } else {
      if (helper === 'A6A5') {
        load(WORD_MASK);
        io.write(absolute(MENU_HOTKEYS), r.a);
      } else io.write(absolute(MENU_HOTKEYS), 0);
      io.write(absolute(MENU_SHOW_NUMBERS), 0);
      io.write(absolute(MENU_SELECTION), 0);
    }
    load(io.read(2));
    io.write(absolute(MENU_COLUMN), r.a);
    load(io.read(ROW_ARGUMENT));
    io.write(absolute(MENU_ROW), r.a);
    io.write(absolute(MENU_PAGE_START), 0);
    io.write(absolute(MENU_REPEAT_COUNTER), 0);
    call('A617', renderA617, 'initial-list');
    index('y', io.read(absolute(MENU_SELECTION)));
    call('A5F9', renderA5F9, 'initial-mark');
    for (;;) {
      stage = 'wait';
      call('B0A1', renderB0A1, 'counter-wait');
      call('9E1A', render9E1A, 'loop-input');
      iterations++;
      load(io.read(absolute(PAD_PRESSED)));
      io.write(absolute(MENU_NAVIGATION_INPUT), r.a);
      load(io.read(absolute(PAD_HELD)));
      load(r.a & VERTICAL_DIRECTIONS);
      if (r.a) {
        const count = (io.read(absolute(MENU_REPEAT_COUNTER)) + 1) & WORD_MASK;
        io.write(absolute(MENU_REPEAT_COUNTER), count);
        r.status = textNZ(r.status, count);
        load(io.read(absolute(MENU_REPEAT_COUNTER)));
        compare(r.a, REPEAT_DELAY);
        if (r.status & 2) {
          load(REPEAT_RESTART);
          io.write(absolute(MENU_REPEAT_COUNTER), r.a);
          load(io.read(absolute(PAD_HELD)));
          io.write(absolute(MENU_NAVIGATION_INPUT), r.a);
          repeats++;
        }
      } else io.write(absolute(MENU_REPEAT_COUNTER), 0);
      load(io.read(absolute(PAD_PRESSED)));
      if (bit(CANCEL_BUTTON)) {
        index('y', io.read(absolute(MENU_SELECTION)));
        call('A5DB', renderA5DB, 'cancel-unmark');
        load(WORD_MASK);
        io.write(0, r.a);
        call('9E1A', render9E1A, 'cancel-input');
        return finish('menu_cancelled', WORD_MASK);
      }
      if (bit(CONFIRM_BUTTONS)) {
        index('y', io.read(absolute(MENU_SELECTION)));
        call('A5DB', renderA5DB, 'confirm-unmark');
        return confirm();
      }
      stage = 'navigation';
      navigation();
      load(io.read(absolute(MENU_HOTKEYS)));
      if (!r.a) continue;
      index('y', 0);
      for (;;) {
        load(listToken());
        if (!r.a) break;
        hotkeyReads++;
        load(shortToken());
        load(r.a & io.read(absolute(PAD_PRESSED)));
        if (r.a) {
          const selectedY = r.y;
          index('y', io.read(absolute(MENU_SELECTION)));
          call('A5DB', renderA5DB, 'hotkey-unmark');
          load(selectedY);
          io.write(absolute(MENU_SELECTION), r.a);
          return confirm();
        }
        index('y', r.y + 1);
        index('y', r.y + 1);
      }
    }
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, helper, menuStage: stage };
  }
}
export const renderA6A5 = (view, context, budget) => compose(view, context, budget, 'A6A5');
export const renderA6AD = (view, context, budget) => compose(view, context, budget, 'A6AD');
export const renderA6B8 = (view, context, budget) => compose(view, context, budget, 'A6B8');
export const renderA6C7 = (view, context, budget) => compose(view, context, budget, 'A6C7');
