// Register-level references of the runner state natives 80:CECB, 80:CF2E and 80:D079
// with 80:D08A (moved from src/task/native-state-count-raise.mjs,
// src/task/native-magic-points-raise.mjs and src/task/native-runners-restore.mjs; lifted in src/game/runner-state.mjs). The
// references run the natives' sequences with these bodies, so the window list call and
// its frame stay the same on both sides.
import { drainNativeSequence } from '../../src/task/native-call-continuation.mjs';
import { cecbSequence } from '../../src/task/native-state-count-raise.mjs';
import { d079Sequence } from '../../src/task/native-runners-restore.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT } from '../../src/task/native-leaf-support.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { leaf } from '../../src/task/native-leaf-support.mjs';
import { taskSelectionSupport } from '../../src/task/native-object-turn.mjs';
import {
  DP_REFILL_DOUBLE_MAGIC,
  DP_RESOURCE_DOUBLE_MAGIC,
  DP_RESOURCE_MAX,
  DP_RESOURCE_RECORD,
  DP_RESOURCE_RECORD_BANK,
  GROUP_INDEX,
  GROUP_NUMBERS,
  MAGIC_POINTS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RECORD_COUNT,
  WRAM,
} from '../../src/task/wram.mjs';
import { BANK_WRAP, BYTE_MASK, LONG_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';
import {
  RECORD_COUNT_MAX,
  RECORD_MAGIC,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../../src/data/runners.mjs';
import { ACTOR_RECORD, ACTOR_TABLE } from '../../src/data/actors.mjs';

// 80:CECB register-level body (before its JSL 81:AD92).
export function raiseStateCountRegisters(h) {
  const { ctx } = h;
  h.index('y', h.dp(FIRST_ARGUMENT));
  for (let leader = false; ; leader = true) {
    h.load(h.read(WRAM + GROUP_INDEX));
    h.index('x', ctx.a);
    h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
    for (;;) {
      h.cmp(h.read(WRAM + GROUP_NUMBERS + ctx.x));
      if (ctx.status & FLAG_ZERO) break;
      h.index('x', ctx.x - 2);
      if (ctx.status & FLAG_NEGATIVE) break;
    }
    if (ctx.status & FLAG_ZERO) break;
    if (leader) taskStop('task_cecb_endless_search');
    h.index('y', h.read(h.abs(PLAYER_OBJECT)));
    h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
  }
  h.index('x', RUNNER_LAST_INDEX);
  for (;;) {
    h.cmp(h.read(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', ctx.x - 2);
    if (ctx.status & FLAG_NEGATIVE) break;
  }
  h.load(h.read(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  ctx.status &= ~FLAG_CARRY;
  h.adc(RECORD_COUNT_MAX);
  h.dpWrite(DP_RESOURCE_RECORD, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(RUNNER_RECORD_BANKS) + ctx.x));
  h.dpWrite(DP_RESOURCE_RECORD_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.indirect(DP_RESOURCE_RECORD)));
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(DP_RESOURCE_MAX, ctx.a);
  h.index('x', h.read(h.abs(OBJECT_RECORD) + ctx.y));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(WRAM + RECORD_COUNT + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(SECOND_ARGUMENT));
    h.cmp(h.dp(DP_RESOURCE_MAX));
    if (ctx.status & FLAG_CARRY) h.load(h.dp(DP_RESOURCE_MAX));
    h.sep(FLAG_MEMORY_8BIT);
    h.write(WRAM + RECORD_COUNT + ctx.x, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
  }
}
function restoreRunnerEntry(h) {
  const { ctx } = h;
  h.load(h.read(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  ctx.status &= ~FLAG_CARRY;
  h.adc(RECORD_MAGIC);
  h.dpWrite(DP_RESOURCE_RECORD, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(RUNNER_RECORD_BANKS) + ctx.x));
  h.dpWrite(DP_RESOURCE_RECORD_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.index('y', ctx.x);
  h.load(h.read(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
  h.index('x', ctx.a);
  h.load(h.read(ACTOR_TABLE + ACTOR_RECORD + ctx.x));
  if (!(ctx.status & FLAG_ZERO)) {
    h.pha();
    h.load(ctx.y);
    h.lsr();
    h.index('x', ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.indirect(DP_RESOURCE_RECORD)));
    h.load(ctx.a & BYTE_MASK);
    h.asl();
    h.dpWrite(DP_REFILL_DOUBLE_MAGIC, ctx.a);
    h.asl();
    h.asl();
    ctx.status &= ~FLAG_CARRY;
    h.adc(h.dp(DP_REFILL_DOUBLE_MAGIC));
    h.write(WRAM + MAGIC_POINTS + ctx.x, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
    ctx.status &= ~FLAG_CARRY;
    h.load(h.dp(DP_RESOURCE_RECORD));
    h.adc(RECORD_COUNT_MAX - RECORD_MAGIC);
    h.dpWrite(DP_RESOURCE_RECORD, ctx.a);
    h.plx();
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.indirect(DP_RESOURCE_RECORD)));
    h.write(WRAM + RECORD_COUNT + ctx.x, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
  }
  return h.rts();
}
// 80:D079 register-level body (before its JSL 81:AD92).
export function restoreRunnersRegisters(h) {
  const { ctx } = h;
  h.index('x', RUNNER_LAST_INDEX);
  do {
    h.phx();
    h.call(0x80d07d, 0x80d08a, () => restoreRunnerEntry(h));
    h.plx();
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
}
export const raiseMemberStateCountReference = (a, events, outerReturn = true, routines = null) =>
  drainNativeSequence(cecbSequence(a, events, outerReturn, routines, raiseStateCountRegisters));
export const restoreAllRunnersReference = (a, events, outerReturn = true, routines = null) =>
  drainNativeSequence(d079Sequence(a, events, outerReturn, routines, restoreRunnersRegisters));

// 80:CF2E register-level (a leaf native): the object 150A+Y is searched in the group
// 7E2DF0 from 7E2DE6 down; a miss retries with the player 0CC2 (a player outside the
// group loops for ever in the original: stop on the second miss). Then the number is
// searched in 9700 from X = 18 and the record 971A+1/9734 read.
export const raiseMemberMagicPointsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h),
        { ctx } = h;
      h.index('y', h.dp(0));
      for (let attempt = 0; ; attempt++) {
        h.load(h.longRead(WRAM + GROUP_INDEX));
        h.index('x', ctx.a);
        h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
        let found = false;
        for (;;) {
          k.compare(ctx.a, h.longRead(WRAM + GROUP_NUMBERS + ctx.x));
          if (ctx.status & FLAG_ZERO) {
            found = true;
            break;
          }
          h.index('x', (ctx.x - 1) & WORD_MASK);
          h.index('x', (ctx.x - 1) & WORD_MASK);
          if (ctx.status & FLAG_NEGATIVE) break;
        }
        if (found) break;
        if (attempt === 1) taskStop('task_native_cf2e_player_outside_group', { player: ctx.y });
        h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
        h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
      }
      h.index('x', RUNNER_LAST_INDEX);
      for (;;) {
        k.compare(ctx.a, h.longRead(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        h.index('x', (ctx.x - 1) & WORD_MASK);
        h.index('x', (ctx.x - 1) & WORD_MASK);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      h.load(h.longRead(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(RECORD_MAGIC);
      a.writeWord(DP_RESOURCE_RECORD, ctx.a, BANK_WRAP, 'cf2e-DP6B');
      h.load(a.read((h.abs(RUNNER_RECORD_BANKS) + ctx.x) & LONG_MASK, 'cf2e-9734-BYTE'), 1);
      a.write(DP_RESOURCE_RECORD_BANK, ctx.a & BYTE_MASK, 'cf2e-DP6D-BYTE');
      h.load(k.indirect(DP_RESOURCE_RECORD));
      h.load(ctx.a & BYTE_MASK);
      h.asl();
      a.writeWord(DP_RESOURCE_DOUBLE_MAGIC, ctx.a, BANK_WRAP, 'cf2e-DP6B');
      h.asl();
      h.asl();
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.dp(DP_RESOURCE_DOUBLE_MAGIC));
      a.writeWord(DP_RESOURCE_MAX, ctx.a, BANK_WRAP, 'cf2e-DP04');
      h.load(ctx.x);
      ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
      h.load(ctx.a >>> 1);
      h.index('x', ctx.a);
      h.load(h.longRead(WRAM + MAGIC_POINTS + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.dp(2));
      k.compare(ctx.a, h.dp(DP_RESOURCE_MAX));
      if (ctx.status & FLAG_CARRY) h.load(h.dp(DP_RESOURCE_MAX));
      a.write(WRAM + MAGIC_POINTS + ctx.x, ctx.a & BYTE_MASK, 'cf2e-7E3C96-BYTE');
    },
    outerReturn,
  );
