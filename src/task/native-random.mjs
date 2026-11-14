import { taskStop } from './plan.mjs';
import { routineCaller } from './routine-call.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { RANDOM_STATE, RANDOM_STATE_HIGH, RANDOM_BYTE, DP_RANDOM_MASK, WRAM } from './wram.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK, BANK_SIZE, BYTE_MASK } from '../constants/bits.mjs';
import { SLHV, OPHCT, OPVCT } from '../constants/hardware-registers.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// C560 reads its byte permutation through DBR; C51F selects a WORD mask by
// incrementing the initial index twice before each shift of its nonzero limit.
const RANDOM_BYTE_TABLE = 0xc58d;
const RANDOM_MASK_TABLE = 0xc540;
const RANDOM_MASK_INITIAL_INDEX = 0xfffe;
const RANDOM_BYTE_ENTRY = 0xc560;
const RANDOM_BYTE_RETURN_WORD = 0xc534;
export const taskRandomDevices = Object.freeze({
  writes: Object.freeze([]),
  reads: Object.freeze([SLHV, OPHCT, OPVCT]),
  observationPcs: Object.freeze([0x80c566, 0x80c572, 0x80c57f]),
});
function finish(a, outer) {
  const { ctx } = a,
    rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'random-RTS-WORD', outer);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: 'observed-outer-RTS-target',
  };
}
// Fixed C560 equations. Every PPU BYTE, table BYTE and mutable state BYTE
// is freshly read; no beam position, elapsed time or device reply is inferred.
// 80:C560: next random byte from the counter bytes and the permutation table.
export function randomByte(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  if (ctx.programBank !== CODE_BANK) taskStop('task_random_entry_required');
  h.pushByte(ctx.status, 'random-PHP');
  ctx.status |= FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT;
  ctx.x &= BYTE_MASK;
  ctx.y &= BYTE_MASK;
  ctx.y = h.nz(h.read(h.abs(RANDOM_BYTE), 1), 1);
  h.load(a.absoluteRead(SLHV, 1, 0x80c566, 'random-PPU-latch'), 1);
  h.load(h.read(h.abs(RANDOM_BYTE_TABLE) + ctx.y, 1), 1);
  h.load((ctx.a & BYTE_MASK) ^ h.read(WRAM + RANDOM_STATE, 1), 1);
  h.dpWrite(0, ctx.a, 1);
  h.load((ctx.a & BYTE_MASK) ^ a.absoluteRead(OPHCT, 1, 0x80c572, 'random-PPU-horizontal'), 1);
  ctx.y = h.nz(ctx.a & BYTE_MASK, 1);
  h.load(h.read(h.abs(RANDOM_BYTE_TABLE) + ctx.y, 1), 1);
  h.load((ctx.a & BYTE_MASK) ^ h.read(WRAM + RANDOM_STATE_HIGH, 1), 1);
  h.dpWrite(1, ctx.a, 1);
  h.load((ctx.a & BYTE_MASK) ^ a.absoluteRead(OPVCT, 1, 0x80c57f, 'random-PPU-vertical'), 1);
  h.compare(ctx.a & BYTE_MASK, h.read(h.abs(RANDOM_BYTE), 1));
  const incremented = Boolean(ctx.status & FLAG_ZERO);
  if (incremented) h.load((ctx.a + 1) & BYTE_MASK, 1);
  h.write(h.abs(RANDOM_BYTE), ctx.a, 1);
  ctx.status = h.pullByte('random-PLP-fresh');
  if (ctx.status & FLAG_INDEX_8BIT) {
    ctx.x &= BYTE_MASK;
    ctx.y &= BYTE_MASK;
  }
  if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
    taskStop('task_random_return_mode_required');
  return { ...finish(a, outerReturn), incremented };
}
// 80:C51F: random number below the limit in the first argument (result in DP00).
export function randomBelow(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  if (ctx.programBank !== CODE_BANK) taskStop('task_random_entry_required');
  h.load(h.dp(0));
  const zero = ctx.a === 0;
  let attempts = 0,
    mask = null;
  if (!zero) {
    h.dpWrite(2, ctx.a);
    ctx.x = h.nz(RANDOM_MASK_INITIAL_INDEX);
    do {
      a.tick();
      ctx.x = h.nz((ctx.x + 1) & WORD_MASK);
      ctx.x = h.nz((ctx.x + 1) & WORD_MASK);
      h.asl();
    } while (!(ctx.status & FLAG_CARRY));
    h.load(h.read(h.abs(RANDOM_MASK_TABLE) + ctx.x));
    mask = ctx.a;
    h.dpWrite(DP_RANDOM_MASK, ctx.a);
    do {
      a.pushWord(RANDOM_BYTE_RETURN_WORD, 'random-JSR-C560');
      ctx.pc = RANDOM_BYTE_ENTRY;
      const called = randomByte(a, false);
      attempts++;
      if (called.rawReturnWord !== RANDOM_BYTE_RETURN_WORD || called.returnTarget !== 0x80c535)
        taskStop('task_native_helper_return_required', {
          raw: called.rawReturnWord,
          target: called.returnTarget,
        });
      h.load(h.dp(0));
      h.load(ctx.a & h.dp(DP_RANDOM_MASK));
      h.compare(ctx.a, h.dp(2));
    } while (ctx.status & FLAG_CARRY);
    h.dpWrite(0, ctx.a);
  }
  return { ...finish(a, outerReturn), zeroLimit: zero, attempts, mask };
}
// 80:F2A8: randomBelow (C51F) for long callers, with DBR 0.
export function randomBelowLong(h, e, r) {
  h.phb();
  h.push(0, 2);
  h.plb();
  h.plb();
  routineCaller(h, e, r)(0x80f2ae, 0x80c51f);
  h.plb();
  return h.rtl();
}
