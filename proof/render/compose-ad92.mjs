import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderA9B2 } from './a9b2.mjs';
import { renderACCF } from './entry-accf.mjs';
import { renderACB5 } from './request-acb5.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  BANK_SIZE,
  LONG_MASK,
  BYTE_BITS,
  WORD_SIGN,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { WINDOW_LAST_INDEX, WINDOW_FIRST_INDEX, WINDOW_ACTIVE } from '../../src/task/wram.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const COMPOSITION_STACK_BYTES = 22;
const STATUS_NZ = FLAG_NEGATIVE | FLAG_ZERO;

export function prepareRenderAD92({
  data,
  bank = null,
  status = null,
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
    (divisionMode !== null && divisionMode !== 'stable-native') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead01F8 !== null &&
      (!Array.isArray(waitRead01F8) || !Array.from(waitRead01F8).every(isWord)))
  )
    throw Error('Invalid render AD92 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    COMPOSITION_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      renderAD92(
        view,
        { bank, status, divisionMode, waitMode, waitRead01F8 },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Native caller-specific algorithm, no instruction dispatch or inner commit.
// The metered view records every ordered byte access, including A9B2's reads
// which its standalone historical helper work counter did not count.
export function renderAD92(view, context, budget) {
  budget.outputBytes ??= 0;
  const operations = [],
    base = context.bank * BANK_SIZE;
  let phase = 'A9B2',
    byteAccesses = 0,
    visits = 0,
    entries = 0,
    entryOutputBytes = 0;
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, address, value) => {
    operations.push(Object.freeze({ kind, space: 'data', phase, address, value, bytes: 1 }));
  };
  const shared = {
    read(address) {
      tick();
      byteAccesses++;
      const value = view.read(address);
      record('read', address, value);
      return value;
    },
    write(address, value) {
      tick();
      byteAccesses++;
      view.write(address, value);
      record('write', address, value);
    },
  };
  const read = (address) =>
    shared.read(address & LONG_MASK) | (shared.read((address + 1) & LONG_MASK) << BYTE_BITS);
  const nz = (flags, value) =>
    (flags & ~STATUS_NZ) | (value & WORD_SIGN ? FLAG_NEGATIVE : 0) | (value === 0 ? 2 : 0);
  const compare = (r, right) => {
    r.status = nz((r.status & ~1) | (r.x >= right ? 1 : 0), (r.x - right) & WORD_MASK);
  };
  try {
    const converted = renderA9B2(shared, context, budget, context.divisionMode);
    const r = {
      a: converted.a,
      x: converted.x,
      y: converted.y,
      bank: context.bank,
      status: converted.status,
    };
    phase = 'list';
    r.a = read(base + WINDOW_LAST_INDEX);
    r.status = nz(r.status, r.a);
    const listSkipped = Boolean(r.a & WORD_SIGN);
    if (!listSkipped) {
      r.x = 0;
      r.status = nz(r.status, r.x);
      do {
        visits++;
        compare(r, read(base + WINDOW_FIRST_INDEX));
        if (r.status & 1) {
          r.a = read(base + WINDOW_ACTIVE + r.x);
          r.status = nz(r.status, r.a);
          if (r.a !== 0) {
            phase = 'ACCF';
            const entry = renderACCF(shared, r, budget);
            Object.assign(r, { a: entry.a, x: entry.x, y: entry.y, status: entry.status });
            entries++;
            entryOutputBytes += entry.outputBytes;
            phase = 'list';
          }
        }
        r.x = (r.x + 1) & WORD_MASK;
        r.status = nz(r.status, r.x);
        r.x = (r.x + 1) & WORD_MASK;
        r.status = nz(r.status, r.x);
        compare(r, read(base + WINDOW_LAST_INDEX));
      } while (!(r.status & 1) || r.status & 2);
    }
    phase = 'ACB5';
    const transfer = renderACB5(shared, { ...context, ...r }, budget);
    // External observations also appear as byte writes above. Keep their
    // explicit WORD provenance alongside the native byte chronology.
    return {
      ...transfer,
      outcome: 'render_composed',
      listSkipped,
      visits,
      entries,
      entryOutputBytes,
      outputBytes: budget.outputBytes,
      byteAccesses,
      work: budget.work,
      conversion: Object.freeze(converted),
      operations: Object.freeze(operations),
      waitOperations: transfer.operations,
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, callerPhase: phase };
  }
}
