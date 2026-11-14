import {
  BYTE_MASK,
  BANK_SIZE,
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_SIGN,
} from '../../src/constants/bits.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  WINDOW_ACTIVE,
  WINDOW_LAST_INDEX,
  WINDOW_TILE_START,
  WINDOW_NEXT_TILE,
  NOTICE_EFFECT_FRAMES,
  NOTICE_WINDOWS,
  NOTICE_FRAMES,
} from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF963 } from './allocate-f963.mjs';
import { renderFE69 } from './text-compose.mjs';
import { renderAD92 } from './compose-ad92.mjs';
import { textNZ } from './text-helper-access.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const NOTICE_STACK_BYTES = 32;
const ATTRIBUTES_ARGUMENT = 8;
const NOTICE_EFFECT_ATTRIBUTES = 0x400;
const EFFECT_FRAMES = 30;
const TEXT_ARGUMENT = 0x0a;
const WORD_SIGN_SHIFT = 15;
const NOTICE_TEXT_TABLE = 0xd9b8;
const LAST_NOTICE_INDEX = 6;
const FRAMES_ARGUMENT = 0x0c;
const OVERFLOW_FLAG_SHIFT = 6;

export function prepareRenderFEC1({
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
} = {}) {
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
    throw Error('Invalid render FEC1 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    NOTICE_STACK_BYTES,
  );
  if (entry) return entry;
  if (x === null || y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderFEC1(
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

// Fixed notice allocation/text/slot algorithm. All callees share the byte
// overlay and budgets; only the outer owner may finish or commit the plan.
export function renderFEC1(view, context, budget) {
  budget.outputBytes ??= 0;
  const r = { a: 0, x: context.x, y: context.y, bank: context.bank, status: context.status };
  const operations = [],
    byteOperations = [],
    calls = [],
    waitOperations = [];
  const counts = context.noticeObservations ?? {
    productReads: 0,
    pollsF6: 0,
    pollsF8: 0,
    quotientReads: 0,
    resultReads: 0,
    pollsFA: 0,
    pollsFC: 0,
  };
  let phase = 'noticeFEC1',
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
  };
  // Original FA3E body, including unconditional AD92 and freshly read tail
  // flags. Its X is restored by FEC1's original PHX/PLX, Y is not restored.
  const remove = () => {
    phase = 'removeFA3E';
    index('x', read(0));
    load(0);
    write(absolute(WINDOW_ACTIVE, r.x), r.a);
    compare(r.x, read(absolute(WINDOW_LAST_INDEX)));
    if (r.status & 2) {
      do {
        index('x', r.x - 1);
        index('x', r.x - 1);
        if (r.status & BYTE_SIGN) break;
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
    phase = 'noticeFEC1';
  };

  load(read(ATTRIBUTES_ARGUMENT));
  compare(r.a, NOTICE_EFFECT_ATTRIBUTES);
  if (r.status & 2) {
    load(EFFECT_FRAMES);
    write(absolute(NOTICE_EFFECT_FRAMES), r.a);
  }
  call('F963', renderF963);
  load(read(0));
  const allocation = r.a;
  load(read(TEXT_ARGUMENT));
  const beforeShift = r.a;
  r.status = (r.status & ~1) | (beforeShift >>> WORD_SIGN_SHIFT);
  load(beforeShift << 1);
  index('x', r.a);
  load(read(absolute(NOTICE_TEXT_TABLE, r.x)));
  write(2, r.a);
  call('FE69', renderFE69);
  index('x', LAST_NOTICE_INDEX);
  load(WORD_MASK);
  let replaced = false;
  for (;;) {
    visits++;
    const minimum = r.a;
    load(read(WRAM_BASE + NOTICE_WINDOWS + r.x));
    if (r.status & BYTE_SIGN) break;
    load(minimum);
    compare(r.a, read(absolute(NOTICE_FRAMES, r.x)));
    if (r.status & 1) {
      load(read(absolute(NOTICE_FRAMES, r.x)));
      index('y', r.x);
    }
    index('x', r.x - 1);
    index('x', r.x - 1);
    if (!(r.status & BYTE_SIGN)) continue;
    index('x', r.y);
    load(read(WRAM_BASE + NOTICE_WINDOWS + r.x));
    write(0, r.a);
    const selected = r.x;
    remove();
    index('x', selected);
    replaced = true;
    break;
  }
  load(read(FRAMES_ARGUMENT));
  write(absolute(NOTICE_FRAMES, r.x), r.a);
  load(allocation);
  write(WRAM_BASE + NOTICE_WINDOWS + r.x, r.a);
  const ioRequests = operations.filter((v) => v.space === 'io');
  return {
    handled: true,
    outcome: replaced ? 'notice_replaced' : 'notice_inserted',
    ...r,
    carry: r.status & 1,
    overflow: (r.status >>> OVERFLOW_FLAG_SHIFT) & 1,
    allocation,
    slot: r.x,
    visits,
    ...counts,
    outputBytes: budget.outputBytes,
    work: budget.work,
    byteAccesses: byteOperations.length,
    byteOperations: Object.freeze(byteOperations),
    operations: Object.freeze(operations),
    ioRequests: Object.freeze(ioRequests),
    ioWrites: Object.freeze(ioRequests.filter((v) => v.kind === 'write')),
    waitOperations: Object.freeze(waitOperations),
    calls: Object.freeze(calls),
  };
}
