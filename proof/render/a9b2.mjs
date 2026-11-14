import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  BYTE_BITS,
  BANK_SIZE,
  WORD_MASK,
  WORD_BITS,
  WORD_SIGN,
  BYTE_MASK,
  BYTE_SIGN,
} from '../../src/constants/bits.mjs';
import {
  WINDOW_MAP_SOURCE,
  WINDOW_MAP_SOURCE_BANK,
  WINDOW_MAP_BUFFER,
} from '../../src/task/wram.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary, unpackRender9F49 } from './unpack-9f49.mjs';
import { renderAF1F } from './af1f.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const CONVERSION_STACK_BYTES = 19;
const STATUS_NZ = 0x82;
const LAST_MAP_WORD_OFFSET = 0x73e;
const TILE_WORD_ADDEND = 0x2017;
const CONVERSION_ENTRY_X = 0xfffe;
const STATUS_NZCV = 0xc3;
const OVERFLOW_FLAG_SHIFT = 6;
const CONVERSION_WORDS = 928;

// One A9B2/AF1F data plan; native division requires an explicit stable
// arithmetic contract. Unpack and conversion never commit alone.
export function prepareRenderA9B2({
  data,
  bank = null,
  status = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  divisionMode = null,
} = {}) {
  if (divisionMode !== null && divisionMode !== 'stable-native')
    throw Error('Invalid render division context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    CONVERSION_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  const budget = { work: 0, maxWork, maxOutputBytes };
  try {
    return view.finish(renderA9B2(view, { bank, status }, budget, divisionMode));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Shared ordered view/budget for larger loader plans. No inner commit payload.
export function renderA9B2(view, { bank, status }, budget, divisionMode) {
  let phase = 'unpack';
  const readWord = (address) => view.read(address) | (view.read(address + 1) << BYTE_BITS);
  try {
    // Absolute input operands use the actual incoming DBR, not a default80.
    const sourceOffset = readWord(bank * BANK_SIZE + WINDOW_MAP_SOURCE);
    const sourceBankWord = readWord(bank * BANK_SIZE + WINDOW_MAP_SOURCE_BANK);
    // LDX23A0 immediately before the call clears N/Z; this is the P
    // preserved by9F49, rather than the original caller's N/Z.
    const unpack = unpackRender9F49(
      view,
      {
        sourceOffset,
        sourceBankWord,
        destination: WINDOW_MAP_BUFFER,
        bank,
        status: status & ~STATUS_NZ,
      },
      budget,
    );
    phase = 'conversion';
    let carry = 0,
      overflow = 0;
    for (let offset = LAST_MAP_WORD_OFFSET; offset >= 0; offset -= 2) {
      if (++budget.work > budget.maxWork)
        throw { renderBoundary: true, reason: 'render_work_budget_required' };
      const address = WRAM_BASE + WINDOW_MAP_BUFFER + offset,
        value = readWord(address);
      const sum = value + TILE_WORD_ADDEND + carry,
        result = sum & WORD_MASK;
      carry = sum >>> WORD_BITS;
      overflow = ~(value ^ TILE_WORD_ADDEND) & (value ^ result) & WORD_SIGN ? 1 : 0;
      renderOutputBytes(budget, 2);
      view.write(address, result & BYTE_MASK);
      view.write(address + 1, result >>> BYTE_BITS);
    }
    phase = 'af1f';
    const af1f = renderAF1F(
      view,
      { x: CONVERSION_ENTRY_X, y: unpack.y, carry, overflow },
      budget,
      divisionMode,
    );
    ({ carry, overflow } = af1f);
    // AF1F supplies the actual C/V for its reached path. The final PLB
    // sets N/Z from the restored incoming bank byte, not from A.
    const finalStatus =
      (status & ~STATUS_NZCV) |
      carry |
      (overflow << OVERFLOW_FLAG_SHIFT) |
      (bank & BYTE_SIGN) |
      (bank === 0 ? 2 : 0);
    return {
      handled: true,
      outcome: af1f.outcome,
      a: af1f.a,
      x: af1f.x,
      y: af1f.y,
      bank,
      status: finalStatus,
      carry,
      overflow,
      conversionWords: CONVERSION_WORDS,
      work: budget.work,
      unpack: Object.freeze(unpack),
      af1f: Object.freeze(af1f),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
