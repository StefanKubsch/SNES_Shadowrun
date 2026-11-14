import {
  BANK_SIZE,
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
import {
  PALETTE_COUNT,
  PALETTE_DIRECTION,
  PALETTE_INDEX,
  PALETTE_PROGRESS,
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_STEP,
  PALETTE_TABLE,
} from '../../src/task/wram.mjs';

// 81:8076 adds the step until bit 7 is set, then retains the lower seven bits.
const PROGRESS_READY = BYTE_SIGN,
  PROGRESS_REMAINDER = PROGRESS_READY - 1,
  PALETTE_SLOT_BYTES = 2,
  PALETTE_SLOTS_END = 4;
// 81:8076: advance the palette cycles on the game's byte view
// (docs/reference/render-routines.md#8076).
// 81:8076: advance the palette cycles; palette update step on the game's byte view (docs/reference/render-routines.md#8076).
// Register-level equations, the reference of src/game/palette-cycles.mjs; the proof
// entry with its own render data is proof/render/palette-update-8076.mjs.
// One shared byte view and budget; only the outer owner may finish/commit.
export function advancePaletteCycles(view, { bank, status, y = null }, budget) {
  let phase = 'gate',
    x = 0,
    a = 0,
    flags = status,
    index = null,
    pointer = null;
  const base = bank * BANK_SIZE,
    operations = [];
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const record = (kind, offset, value) => {
    operations.push(
      Object.freeze({ kind, space: 'data', phase, address: base + offset, value, bytes: 2 }),
    );
    return value;
  };
  const read = (offset) => {
    tick();
    return record(
      'read',
      offset,
      view.read(base + offset) | (view.read(base + offset + 1) << BYTE_BITS),
    );
  };
  const write = (offset, value) => {
    tick();
    view.write(base + offset, value & BYTE_MASK);
    view.write(base + offset + 1, value >>> BYTE_BITS);
    record('write', offset, value);
  };
  const nz = (value) => {
    flags =
      (flags & ~(FLAG_NEGATIVE | FLAG_ZERO)) |
      (value === 0 ? FLAG_ZERO : 0) |
      (value & WORD_SIGN ? FLAG_NEGATIVE : 0);
  };
  const adc = (left, right, carry) => {
    const sum = left + right + carry,
      value = sum & WORD_MASK;
    flags =
      (flags & ~(FLAG_OVERFLOW | FLAG_CARRY)) |
      (sum > WORD_MASK ? FLAG_CARRY : 0) |
      (~(left ^ right) & (left ^ value) & WORD_SIGN ? FLAG_OVERFLOW : 0);
    nz(value);
    return value;
  };
  const result = (outcome) => ({
    handled: true,
    outcome,
    a,
    x,
    y,
    bank,
    status: flags,
    carry: flags & FLAG_CARRY,
    overflow: flags & FLAG_OVERFLOW ? 1 : 0,
    index,
    pointer,
    work: budget.work,
    operations: Object.freeze(operations),
    ioWrites: Object.freeze([]),
  });
  try {
    for (;;) {
      phase = 'gate';
      a = read(PALETTE_STEP + x);
      nz(a);
      // A zero first gate exits the entire routine, including slot2.
      if (a === 0) return result('gate_zero');
      phase = 'progress';
      a = adc(a, read(PALETTE_PROGRESS + x), 0);
      if (!(a & PROGRESS_READY)) {
        write(PALETTE_PROGRESS + x, a);
        x += PALETTE_SLOT_BYTES;
        // Comparing X with the slot end overrides N/Z/C but preserves the progress ADC's V.
        nz((x - PALETTE_SLOTS_END) & WORD_MASK);
        flags = (flags & ~FLAG_CARRY) | (x >= PALETTE_SLOTS_END ? FLAG_CARRY : 0);
        if (x === PALETTE_SLOTS_END) return result('progress_prepared');
        continue;
      }
      a &= PROGRESS_REMAINDER;
      write(PALETTE_PROGRESS + x, a);
      phase = 'direction';
      const reverse = Boolean(read(PALETTE_DIRECTION + x) & WORD_SIGN);
      phase = 'index';
      const oldIndex = read(PALETTE_INDEX + x);
      if (reverse) index = ((oldIndex === 0 ? read(PALETTE_COUNT + x) : oldIndex) - 1) & WORD_MASK;
      else {
        index = (oldIndex + 1) & WORD_MASK;
        if (index === read(PALETTE_COUNT + x)) index = 0;
      }
      write(PALETTE_INDEX + x, index);
      phase = 'pointer';
      // ASL's original index bit15 is the ADC carry; there is no CLC.
      pointer = adc((index << 1) & WORD_MASK, read(PALETTE_TABLE + x), index >>> (WORD_BITS - 1));
      write(PALETTE_REQUEST_POINTER, pointer);
      phase = 'selection';
      a = x;
      nz(a);
      write(PALETTE_REQUEST_SLOT, a);
      return result('request_prepared');
    }
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase, x };
  }
}
