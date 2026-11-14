// Register-level references of the actor state natives 80:CB2B, 80:CB3C, 80:CB4D,
// 80:CB9F, 80:CBB3, 80:CBCB and 80:9DAE (moved from src/task/native-record-*.mjs; lifted in
// src/game/actor-state.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  leaf,
  readActorState,
} from '../../src/task/native-leaf-support.mjs';
import { RECORD_COUNT, RECORD_FLAGS, RECORD_PROPERTY, WRAM } from '../../src/task/wram.mjs';
import { akimiArrivalFlags, fixesEnabled, keepVampireDefeated } from '../../src/game/bugfixes.mjs';
import { BANK_WRAP, BYTE_MASK, LONG_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT } from '../../src/constants/cpu-flags.mjs';
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
