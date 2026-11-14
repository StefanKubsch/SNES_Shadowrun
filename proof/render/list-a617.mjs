import {
  BYTE_MASK,
  BANK_SIZE,
  LONG_MASK,
  WORD_MASK,
  WORD_BITS,
} from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  MENU_PAGE_START,
  MENU_ROW,
  MENU_COLUMN,
  MENU_DRAW_ROW,
  MENU_ROWS_REMAINING,
  MENU_SHOW_NUMBERS,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderFAAC } from './cursor-faac.mjs';
import { renderFE69 } from './text-compose.mjs';
import { renderFD80 } from './number-fd80.mjs';
import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const LIST_STACK_BYTES = 16;
const MARK_STACK_BYTES = 14;
const LIST_POINTER_ARGUMENT = 8;
const LIST_BANK_ARGUMENT = 10;
const NUMBER_POINTER_ARGUMENT = 12;
const ROW_ARGUMENT = 4;
const BLANK_TEXT_TOKEN = 0x707d;
const MARK_TEXT_TOKEN = 0x7074;
const VISIBLE_ROWS_ARGUMENT = 6;
const PAGE_MARKER_INSET = 3;
const MORE_TEXT_TOKEN = 0x707a;
const PREVIOUS_TEXT_TOKEN = 0x7077;

const isByte = (v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK;
function prepare(
  run,
  stackBytes,
  needsY,
  {
    data,
    bank = null,
    status = null,
    y = null,
    emulation = null,
    directPage = null,
    stackWindow = null,
    maxWork = DEFAULT_MAX_WORK,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    ioMode = null,
    ioRead4214Word = null,
    ioRead4216Byte = null,
    ioRead4214 = null,
    ioRead4216 = null,
    waitMode = null,
    waitRead01FA = null,
    waitRead01FC = null,
  } = {},
) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [ioRead4214Word, ioRead4216, waitRead01FA, waitRead01FC].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isWord)),
    ) ||
    [ioRead4216Byte, ioRead4214].some(
      (v) => v !== null && (!Array.isArray(v) || !Array.from(v).every(isByte)),
    )
  )
    throw Error('Invalid render list context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    stackBytes,
  );
  if (entry) return entry;
  if (needsY && y === null) return { handled: false, reason: 'render_entry_required' };
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
          y,
          ioMode,
          ioRead4214Word,
          ioRead4216Byte,
          ioRead4214,
          ioRead4216,
          waitMode,
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
export const prepareRenderA617 = (context) => prepare(renderA617, LIST_STACK_BYTES, false, context);
export const prepareRenderA5DB = (context) => prepare(renderA5DB, MARK_STACK_BYTES, true, context);
export const prepareRenderA5F9 = (context) => prepare(renderA5F9, MARK_STACK_BYTES, true, context);

// One source-specific list/mark composition. Original PHY/PLY saves a WORD Y
// around each row-text/number call; marker calls do not save callee Y.
function compose(view, context, budget, helper) {
  budget.outputBytes ??= 0;
  const r = { a: 0, x: 0, y: context.y, bank: context.bank, status: context.status };
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
  ])
    counts[key] ??= 0;
  let phase = helper,
    visits = 0,
    entries = 0,
    numbers = 0,
    glyphs = 0,
    rows = 0;
  let more = false,
    previous = false;
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
  const io = textHelperAccess(shared, budget, operations, helper);
  const absolute = (offset) => (context.bank * BANK_SIZE + offset) & LONG_MASK;
  const load = (value) => {
    r.a = value & WORD_MASK;
    r.status = textNZ(r.status, r.a);
  };
  const index = (name, value) => {
    r[name] = value & WORD_MASK;
    r.status = textNZ(r.status, r[name]);
  };
  const arithmetic = (right, subtract = false) => {
    const left = r.a,
      carry = r.status & 1;
    const sum = subtract ? left - right - (1 - carry) : left + right + carry;
    r.a = sum & WORD_MASK;
    r.status = textArithmeticFlags(
      r.status,
      left,
      right,
      r.a,
      subtract ? sum >= 0 : sum > WORD_MASK,
      subtract,
    );
  };
  const call = (name, run, role, saveY = false) => {
    const savedY = r.y,
      before = Object.freeze({ ...r });
    phase = name;
    const result = run(shared, { ...context, ...r, observations: counts }, budget);
    for (const event of result.operations) operations.push(event);
    Object.assign(r, {
      a: result.a,
      x: result.x,
      y: result.y,
      bank: result.bank,
      status: result.status,
    });
    if (saveY) index('y', savedY); // WORD PLY changes NZ, retains A/X/C/V.
    glyphs += result.glyphs ?? 0;
    rows += result.rows ?? 0;
    calls.push(
      Object.freeze({
        name,
        role,
        before,
        after: Object.freeze({ ...r }),
        savedY: saveY ? savedY : null,
        outcome: result.outcome,
        outputBytes: budget.outputBytes,
        work: budget.work,
        ...counts,
      }),
    );
    phase = helper;
  };
  const text = (token, role, saveY = false) => {
    load(token);
    io.write(2, r.a);
    call('FE69', renderFE69, role, saveY);
  };
  const listToken = () => {
    // LDA[$08],Y fetches a fresh 24-bit pointer; WORD target can carry banks.
    const pointer = io.read(LIST_POINTER_ARGUMENT) | (io.read(LIST_BANK_ARGUMENT, 1) << WORD_BITS);
    return io.read((pointer + r.y) & LONG_MASK);
  };
  const number = () => {
    // LDA($0C),Y fetches a fresh16-bit pointer and the actual caller DBR.
    const pointer = io.read(NUMBER_POINTER_ARGUMENT);
    return io.read(absolute(pointer + r.y));
  };
  if (helper !== 'A617') {
    load(r.y);
    r.status |= 1;
    arithmetic(io.read(absolute(MENU_PAGE_START)), true);
    r.status = (r.status & ~1) | (r.a & 1);
    load(r.a >>> 1);
    r.status &= ~1;
    arithmetic(io.read(absolute(MENU_ROW)));
    io.write(ROW_ARGUMENT, r.a);
    load(io.read(absolute(MENU_COLUMN)));
    load(r.a - 1);
    io.write(2, r.a);
    call('FAAC', renderFAAC, 'mark');
    text(helper === 'A5DB' ? BLANK_TEXT_TOKEN : MARK_TEXT_TOKEN, 'mark');
  } else {
    load(io.read(absolute(MENU_ROW)));
    io.write(absolute(MENU_DRAW_ROW), r.a);
    load(io.read(VISIBLE_ROWS_ARGUMENT));
    io.write(absolute(MENU_ROWS_REMAINING), r.a);
    index('y', io.read(absolute(MENU_PAGE_START)));
    for (;;) {
      visits++;
      load(io.read(absolute(MENU_COLUMN)));
      io.write(2, r.a);
      load(io.read(absolute(MENU_DRAW_ROW)));
      io.write(ROW_ARGUMENT, r.a);
      load(r.a + 1);
      io.write(absolute(MENU_DRAW_ROW), r.a);
      call('FAAC', renderFAAC, 'line');
      load(listToken());
      if (!r.a) break;
      io.write(2, r.a);
      call('FE69', renderFE69, 'line', true);
      entries++;
      load(io.read(absolute(MENU_SHOW_NUMBERS)));
      if (r.a) {
        load(number());
        if (r.a) {
          text(BLANK_TEXT_TOKEN, 'number-gap', true);
          load(number());
          io.write(2, r.a);
          call('FD80', renderFD80, 'number', true);
          numbers++;
        }
      }
      index('y', r.y + 1);
      index('y', r.y + 1);
      const remaining = (io.read(absolute(MENU_ROWS_REMAINING)) - 1) & WORD_MASK;
      io.write(absolute(MENU_ROWS_REMAINING), remaining);
      r.status = textNZ(r.status, remaining);
      if (remaining !== 0) continue;
      load(listToken());
      if (r.a) {
        more = true;
        index('x', io.read(0));
        load(io.read(WRAM_BASE + WINDOW_COLUMNS + r.x));
        load(r.a - PAGE_MARKER_INSET);
        io.write(2, r.a);
        load(io.read(WRAM_BASE + WINDOW_ROWS + r.x));
        load(r.a - PAGE_MARKER_INSET);
        io.write(ROW_ARGUMENT, r.a);
        call('FAAC', renderFAAC, 'more');
        text(MORE_TEXT_TOKEN, 'more');
      }
      break;
    }
    load(io.read(absolute(MENU_PAGE_START)));
    if (r.a) {
      previous = true;
      index('x', io.read(0));
      load(io.read(WRAM_BASE + WINDOW_COLUMNS + r.x));
      load(r.a - PAGE_MARKER_INSET);
      io.write(2, r.a);
      io.write(ROW_ARGUMENT, 0);
      call('FAAC', renderFAAC, 'previous');
      text(PREVIOUS_TEXT_TOKEN, 'previous');
    }
  }
  return textHelperResult(r, budget, operations, {
    outcome: helper === 'A617' ? 'list_composed' : 'mark_composed',
    helper,
    visits,
    entries,
    numbers,
    more,
    previous,
    glyphs,
    rows,
    calls: Object.freeze(calls),
    outputBytes: budget.outputBytes,
    ...counts,
    byteAccesses: byteOperations.length,
    byteOperations: Object.freeze(byteOperations),
  });
}
export const renderA617 = (view, context, budget) => compose(view, context, budget, 'A617');
export const renderA5DB = (view, context, budget) => compose(view, context, budget, 'A5DB');
export const renderA5F9 = (view, context, budget) => compose(view, context, budget, 'A5F9');
