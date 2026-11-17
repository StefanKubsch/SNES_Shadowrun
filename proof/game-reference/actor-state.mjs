// Register-level references of the actor state natives 80:CB2B, 80:CB3C, 80:CB4D,
// 80:CB9F, 80:CBB3, 80:CBCB, 80:9DAE, 80:9DC8 and 80:9DEC (moved from src/task/native-record-*.mjs; lifted in
// src/game/actor-state.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/system/native-leaf-support.mjs';
import { readActorState } from '../system/native-leaf-support.mjs';
import { RECORD_COUNT, RECORD_FLAGS, RECORD_PROPERTY, WRAM } from '../../src/data/wram.mjs';
import { akimiArrivalFlags, fixesEnabled, keepVampireDefeated } from '../../src/game/bugfixes.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { OBJECT_NUMBER } from '../../src/data/wram.mjs';
import { protectedJakeHealth } from '../../src/game/cheats.mjs';
import {
  BANK_WRAP,
  BYTE_MASK,
  BYTE_SIGN,
  LONG_MASK,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_MEMORY_8BIT,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

const TRUE = WORD_MASK,
  FALSE = 0;
// 80:CB2B: return the flag byte of the state record of the actor entry (first argument).
// With bug fixes enabled, Akimi's arrival flags are corrected (src/game/bugfixes.mjs).
export const getActorStateFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor)),
        word = h.load(h.longRead(WRAM + RECORD_FLAGS + state));
      let flags = h.load(word & BYTE_MASK);
      if (fixesEnabled(a)) flags = h.load(akimiArrivalFlags(a, h.dp(FIRST_ARGUMENT), flags));
      h.result(flags);
    },
    outerReturn,
  );
// 80:CB3C: return the count byte of the state record of the actor entry (first argument).
// An actor without a record reads its count from WRAM address 2.
export const getActorStateCountReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor)),
        word = h.load(h.longRead(WRAM + RECORD_COUNT + state));
      h.result(h.load(word & BYTE_MASK), 'nativeC7-result-WORD');
    },
    outerReturn,
  );
// 80:CB4D: return the property word of the state record of the actor entry (first
// argument). An actor without a record reads WRAM address 3 (a real null read).
export const getActorStatePropertyReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT)),
        state = h.index('x', readActorState(h, actor));
      h.result(h.load(h.longRead(WRAM + RECORD_PROPERTY + state)), 'nativeCD-result-WORD');
    },
    outerReturn,
  );
// 80:CB9F: set the flag byte of the state record of the actor entry (first argument)
// to the low byte of the second argument (SEP #$20 store); no record, no change.
// With exploit prevention, a defeated vampire stays defeated (src/game/bugfixes.mjs).
export const setActorStateFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      if (
        a.vm?.gameplay?.preventExploits &&
        keepVampireDefeated(a, h.dp(FIRST_ARGUMENT), h.dp(SECOND_ARGUMENT, 1), state)
      )
        return;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(h.dp(SECOND_ARGUMENT, 1), 1);
      h.longWrite(WRAM + RECORD_FLAGS + state, flags, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:CBB3: set the bits of the second argument's low byte in the flag byte of the
// state record of the actor entry (first argument); no record, no change.
export const setActorStateFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(a.read(WRAM + RECORD_FLAGS + state, 'leaf-record-BYTE'), 1);
      h.longWrite(
        WRAM + RECORD_FLAGS + state,
        h.load((flags & BYTE_MASK) | h.dp(SECOND_ARGUMENT, 1), 1),
        1,
      );
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:CBCB: keep only the bits of the second argument's low byte in the flag byte of
// the state record of the actor entry (first argument); no record, no change.
export const keepActorStateFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a),
        field = (WRAM + RECORD_FLAGS + state) & LONG_MASK;
      h.ctx.status |= FLAG_MEMORY_8BIT;
      const flags = h.load(a.read(field, 'record-and-field-BYTE'), 1);
      h.longWrite(field, h.load(flags & h.dp(SECOND_ARGUMENT, 1), 1), 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
// 80:9DAE: return TRUE (FFFF) when the property word of the state record of the actor
// entry (second argument) equals the first argument, else FALSE (0); FALSE without a
// record. The flags come from the CMP or the load of TRUE.
export const isActorStatePropertyReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(SECOND_ARGUMENT));
      if (readActorState(h, actor) !== 0) {
        const state = h.index('x', h.ctx.a),
          property = h.load(h.longRead(WRAM + RECORD_PROPERTY + state)),
          wanted = h.dp(FIRST_ARGUMENT);
        // CMP: carry when property >= wanted, N and Z from the difference.
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(property >= wanted);
        h.nz((property - wanted) & WORD_MASK);
        if (property === wanted) {
          h.result(h.load(WORD_MASK), 'leaf-equal-DP00');
          return;
        }
      }
      a.writeWord(FIRST_ARGUMENT, 0, BANK_WRAP, 'leaf-zero-DP00');
    },
    outerReturn,
  );
// 80:9DC8: count down the count byte of the state record of the object's actor entry
// (object in the first argument, its actor offset in OBJECT_NUMBER). Return TRUE (FFFF)
// when the count reaches 0 or there is no record, else FALSE (0). With cheats, Jake's
// protected health keeps its value (src/game/cheats.mjs).
export const decrementObjectStateCountReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const object = h.index('y', h.dp(FIRST_ARGUMENT)),
        actor = h.index('x', h.longRead(h.abs(OBJECT_NUMBER) + object));
      if (readActorState(h, actor) !== 0) {
        const state = h.index('x', ctx.a),
          count = (WRAM + RECORD_COUNT + state) & LONG_MASK;
        let value = h.load((a.read(count, '9dc8-BYTE') - 1) & BYTE_MASK, 1);
        if (a.vm?.cheats) value = h.load(protectedJakeHealth(a, state, value), 1);
        a.write(count, value, '9dc8-BYTE');
        if (!(ctx.status & FLAG_ZERO)) {
          a.writeWord(FIRST_ARGUMENT, FALSE, BANK_WRAP, '9dc8-STZ-DP00');
          return;
        }
      }
      a.writeWord(FIRST_ARGUMENT, h.load(TRUE), BANK_WRAP, '9dc8-DP00');
    },
    outerReturn,
  );
// The byte sum is wrapped before it is clamped to six.
const COUNT_MAX = 6;
const COUNT_LIMIT = COUNT_MAX + 1;

// 80:9DEC: add the second argument's low byte to the count byte of the state record of
// the actor entry (first argument), at most six (CLC, byte ADC, CMP #7, BCC); no record,
// no change.
export const addActorStateCountReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      if (readActorState(h, actor) === 0) return;
      const state = h.index('x', h.ctx.a);
      h.ctx.status |= FLAG_MEMORY_8BIT;
      h.ctx.status &= ~FLAG_CARRY;
      h.load(a.read((WRAM + RECORD_COUNT + state) & LONG_MASK, 'native26-record-BYTE'), 1);
      if (h.ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
      const left = h.ctx.a & BYTE_MASK,
        right = h.dp(SECOND_ARGUMENT, 1),
        sum = left + right,
        result = sum & BYTE_MASK,
        overflow = (~(left ^ right) & (left ^ result) & BYTE_SIGN) !== 0;
      h.ctx.status =
        (h.ctx.status & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
        Number(sum > BYTE_MASK) |
        (overflow ? FLAG_OVERFLOW : 0);
      h.load(result, 1);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(result >= COUNT_LIMIT);
      h.nz((result - COUNT_LIMIT) & BYTE_MASK, 1);
      if (h.ctx.status & FLAG_CARRY) h.load(COUNT_MAX, 1);
      h.longWrite(WRAM + RECORD_COUNT + state, h.ctx.a, 1);
      h.ctx.status &= ~FLAG_MEMORY_8BIT;
    },
    outerReturn,
  );
