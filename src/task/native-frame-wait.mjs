import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { waitForRandomStateChangeWithInterrupts } from './main-wait-interrupt.mjs';

import { RANDOM_STATE, WRAM } from './wram.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE, FLAG_CARRY } from '../constants/cpu-flags.mjs';
import {
  LONG_WRAP,
  WORD_MASK,
  BANK_WRAP,
  BANK_SIZE,
  WORD_SIGN,
  LONG_BYTES,
} from '../constants/bits.mjs';
// 81:B0A1: wait until the word RANDOM_STATE (7E:1C76) changes: LDA long, CMP long,
// BEQ back, RTL (AF761C7E/CF761C7E/F0FA/6B). CMP refetches a full long word against the
// saved A; neither DBR nor a counter change supplies input or time, so the new values
// come from recorded wait observations.
export function waitForRandomStateChange(a, options, outerReturn = true, allowRemaining = false) {
  if (options?.interruptEvents?.interrupts !== undefined)
    return {
      ...waitForRandomStateChangeWithInterrupts(dialogAccess(a), options.interruptEvents),
      waitObservationsUsed: 0,
      waitEvents: Object.freeze([]),
    };
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  const baseline = a.readWord(WRAM + RANDOM_STATE, LONG_WRAP, 'counter-baseline');
  a.ctx.a = baseline;
  a.ctx.status =
    (a.ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
    (baseline & WORD_SIGN ? FLAG_NEGATIVE : 0) |
    (baseline === 0 ? FLAG_ZERO : 0);
  let used = 0,
    observed;
  do {
    const record = options.waitObservations[used];
    if (
      !record ||
      !Object.isFrozen(record) ||
      record.pc !== 0x81b0a5 ||
      record.address !== WRAM + RANDOM_STATE ||
      record.width !== 2 ||
      !Number.isInteger(record.value) ||
      record.value < 0 ||
      record.value > WORD_MASK
    )
      taskStop('task_wait_observation_required', {
        pc: 0x81b0a5,
        address: WRAM + RANDOM_STATE,
        width: 2,
        observationIndex: used,
      });
    used++;
    a.writeWord(WRAM + RANDOM_STATE, record.value, LONG_WRAP, 'counter-observed-writer');
    observed = a.readWord(WRAM + RANDOM_STATE, LONG_WRAP, 'counter-fresh-CMP');
    const difference = (a.ctx.a - observed) & WORD_MASK;
    a.ctx.status =
      (a.ctx.status & ~(FLAG_CARRY | FLAG_ZERO | FLAG_NEGATIVE)) |
      Number(a.ctx.a >= observed) |
      (difference & WORD_SIGN ? FLAG_NEGATIVE : 0) |
      (difference === 0 ? FLAG_ZERO : 0);
  } while (a.ctx.status & FLAG_ZERO);
  if (!allowRemaining && used !== options.waitObservations.length)
    taskStop('task_wait_observation_unused', { observationIndex: used });
  const rawReturnWord = a.readWord(
    (a.ctx.s + 1) & WORD_MASK,
    BANK_WRAP,
    'counter-outer-RTL',
    outerReturn,
  );
  const returnBank = a.read(
    (a.ctx.s + LONG_BYTES) & WORD_MASK,
    'counter-outer-RTL-bank',
    outerReturn,
  );
  a.ctx.s = (a.ctx.s + LONG_BYTES) & WORD_MASK;
  a.ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  a.ctx.programBank = returnBank;
  return {
    baseline,
    observed,
    polls: used,
    waitObservationsUsed: used,
    waitEvents: Object.freeze(options.waitObservations.slice(0, used)),
    rawReturnWord,
    returnBank,
    returnTarget: returnBank * BANK_SIZE + a.ctx.pc,
    frontier: 'observed-outer-RTL-target',
    dynamicDispatchExecuted: false,
    returnTargetExecuted: false,
    scope:
      'manual-source-specific-counter-WORD-observations-and-actual-RTL-no-frame-input-time-proof',
  };
}
