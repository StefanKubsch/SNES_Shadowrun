import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderAD92 } from './compose-ad92.mjs';
import { textNZ } from './text-helper-access.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  LONG_MASK,
  BYTE_BITS,
  WORD_MASK,
  BYTE_MASK,
  BANK_SIZE,
} from '../../src/constants/bits.mjs';
import {
  WINDOW_ACTIVE,
  WINDOW_LAST_INDEX,
  WINDOW_TILE_START,
  WINDOW_NEXT_TILE,
  NOTICE_WINDOWS,
  WINDOW_FIRST_INDEX,
} from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const CLEAR_STACK_BYTES = 28;
const LAST_NOTICE_INDEX = 6;
const OVERFLOW_FLAG_SHIFT = 6;

export function prepareRenderFF79({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  divisionMode = null,
  waitMode = null,
  waitRead01F8 = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (divisionMode !== null && divisionMode !== 'stable-native') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead01F8 !== null &&
      (!Array.isArray(waitRead01F8) || !Array.from(waitRead01F8).every(isWord)))
  )
    throw Error('Invalid render FF79 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    CLEAR_STACK_BYTES,
  );
  if (entry) return entry;
  if (y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      renderFF79(
        view,
        { bank, status, y, divisionMode, waitMode, waitRead01F8 },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed WORD data operations, with one byte ledger and cumulative budgets.
// No code fetch, stack execution, clock or independently applicable inner plan.
function access(view, budget, phase) {
  const operations = [],
    byteOperations = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const shared = {
    read(address) {
      tick();
      const value = view.read(address);
      byteOperations.push(
        Object.freeze({ kind: 'read', phase: phase(), address, value, bytes: 1 }),
      );
      return value;
    },
    write(address, value) {
      tick();
      view.write(address, value);
      byteOperations.push(
        Object.freeze({ kind: 'write', phase: phase(), address, value, bytes: 1 }),
      );
    },
  };
  const record = (kind, address, value) => {
    operations.push(
      Object.freeze({ kind, space: 'data', phase: phase(), address, value, bytes: 2 }),
    );
    return value;
  };
  return {
    shared,
    operations,
    byteOperations,
    read: (address) =>
      record(
        'read',
        address,
        shared.read(address) | (shared.read((address + 1) & LONG_MASK) << BYTE_BITS),
      ),
    write(address, value) {
      value &= WORD_MASK;
      shared.write(address, value & BYTE_MASK);
      shared.write((address + 1) & LONG_MASK, value >>> BYTE_BITS);
      record('write', address, value);
    },
  };
}
const registers = (r) => Object.freeze({ a: r.a, x: r.x, y: r.y, bank: r.bank, status: r.status });

// Full original FA3E algorithm. AD92 uses this same view and budget; only
// an outer composition can finish/commit. Its caller supplies the remaining
// WORD 01F8 transcript, rather than restarting it for each release.
export function renderFA3E(view, context, budget) {
  budget.outputBytes ??= 0;
  const r = { a: 0, x: 0, y: context.y, bank: context.bank, status: context.status };
  let phase = 'FA3E',
    trimVisits = 0;
  const io = access(view, budget, () => phase);
  const absolute = (offset, index = 0) => (r.bank * BANK_SIZE + offset + index) & LONG_MASK;
  const load = (value) => {
    r.a = value & WORD_MASK;
    r.status = textNZ(r.status, r.a);
  };
  const index = (value) => {
    r.x = value & WORD_MASK;
    r.status = textNZ(r.status, r.x);
  };
  try {
    index(io.read(0));
    const buffer = r.x;
    load(0);
    io.write(absolute(WINDOW_ACTIVE, r.x), r.a);
    const end = io.read(absolute(WINDOW_LAST_INDEX));
    r.status = textNZ((r.status & ~1) | Number(r.x >= end), (r.x - end) & WORD_MASK);
    const trimmed = Boolean(r.status & 2);
    if (trimmed) {
      do {
        trimVisits++;
        index(r.x - 1);
        index(r.x - 1);
        if (r.status & FLAG_NEGATIVE) break;
        load(io.read(absolute(WINDOW_ACTIVE, r.x)));
      } while (r.a === 0);
      index(r.x + 1);
      index(r.x + 1);
      load(io.read(WRAM_BASE + WINDOW_TILE_START + r.x));
      io.write(absolute(WINDOW_NEXT_TILE), r.a);
      index(r.x - 1);
      index(r.x - 1);
      io.write(absolute(WINDOW_LAST_INDEX), r.x);
    }
    const before = registers(r);
    phase = 'AD92';
    const result = renderAD92(io.shared, { ...context, ...r }, budget);
    for (const operation of result.operations) io.operations.push(operation);
    Object.assign(r, {
      a: result.a,
      x: result.x,
      y: result.y,
      bank: result.bank,
      status: result.status,
    });
    return {
      handled: true,
      outcome: 'buffer_released',
      ...r,
      buffer,
      trimmed,
      trimVisits,
      polls: result.polls,
      outputBytes: budget.outputBytes,
      work: budget.work,
      operations: Object.freeze(io.operations),
      byteOperations: Object.freeze(io.byteOperations),
      waitOperations: result.waitOperations,
      conversion: result.conversion,
      calls: Object.freeze([
        Object.freeze({
          name: 'AD92',
          before,
          after: registers(r),
          outcome: result.outcome,
          polls: result.polls,
          visits: result.visits,
          entries: result.entries,
          outputBytes: budget.outputBytes,
          work: budget.work,
        }),
      ]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { releasePhase: phase, ...error };
  }
}

// Source-specific FF79 scan. Host saved X represents only the original
// PHX/PLX under the proved disjoint 28-byte stack contract. All later reads
// see actual earlier writes. There is exactly one public outer commit.
export function renderFF79(view, context, budget) {
  budget.outputBytes ??= 0;
  const r = {
    a: 0,
    x: LAST_NOTICE_INDEX,
    y: context.y,
    bank: context.bank,
    status: textNZ(context.status, LAST_NOTICE_INDEX),
  };
  const io = access(view, budget, () => 'FF79'),
    calls = [],
    waitOperations = [];
  const stableDivisions = [],
    stableDivisionReads = [];
  let visits = 0,
    releases = 0,
    pollsF8 = 0;
  const load = (value) => {
    r.a = value & WORD_MASK;
    r.status = textNZ(r.status, r.a);
  };
  const index = (value) => {
    r.x = value & WORD_MASK;
    r.status = textNZ(r.status, r.x);
  };
  try {
    do {
      visits++;
      load(io.read(WRAM_BASE + NOTICE_WINDOWS + r.x));
      if (!(r.status & FLAG_NEGATIVE)) {
        io.write(0, r.a);
        const savedX = r.x,
          before = registers(r);
        const result = renderFA3E(
          view,
          { ...context, ...r, waitRead01F8: context.waitRead01F8?.slice(pollsF8) ?? null },
          budget,
        );
        for (const operation of result.operations) io.operations.push(operation);
        for (const operation of result.byteOperations) io.byteOperations.push(operation);
        for (const operation of result.waitOperations) waitOperations.push(operation);
        Object.assign(r, {
          a: result.a,
          x: result.x,
          y: result.y,
          bank: result.bank,
          status: result.status,
        });
        releases++;
        pollsF8 += result.polls;
        const divisionBase = stableDivisions.length;
        for (const d of result.conversion.af1f.divisions ?? [])
          stableDivisions.push(
            Object.freeze({ ...d, division: stableDivisions.length + 1, release: releases }),
          );
        for (const d of result.conversion.af1f.divisionReads ?? [])
          stableDivisionReads.push(
            Object.freeze({ ...d, division: divisionBase + d.division, release: releases }),
          );
        calls.push(
          Object.freeze({
            name: 'FA3E',
            slot: savedX,
            buffer: result.buffer,
            before,
            after: registers(r),
            trimmed: result.trimmed,
            trimVisits: result.trimVisits,
            polls: result.polls,
            pollsF8,
            outputBytes: budget.outputBytes,
            work: budget.work,
            calls: result.calls,
          }),
        );
        index(savedX);
        load(WORD_MASK);
        io.write(WRAM_BASE + NOTICE_WINDOWS + r.x, r.a);
      }
      index(r.x - 1);
      index(r.x - 1);
    } while (!(r.status & FLAG_NEGATIVE));
    io.write(r.bank * BANK_SIZE + WINDOW_FIRST_INDEX, 0);
    return {
      handled: true,
      outcome: 'slots_cleared',
      ...r,
      carry: r.status & 1,
      overflow: (r.status >>> OVERFLOW_FLAG_SHIFT) & 1,
      visits,
      releases,
      pollsF8,
      outputBytes: budget.outputBytes,
      work: budget.work,
      byteAccesses: io.byteOperations.length,
      byteOperations: Object.freeze(io.byteOperations),
      operations: Object.freeze(io.operations),
      waitOperations: Object.freeze(waitOperations),
      stableDivisions: Object.freeze(stableDivisions),
      stableDivisionReads: Object.freeze(stableDivisionReads),
      calls: Object.freeze(calls),
      ioWrites: Object.freeze([]),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { helper: 'FF79', visit: visits, completedReleases: releases, ...error };
  }
}
