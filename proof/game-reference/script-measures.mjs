// Register-level references of the glove limit, distance and halving script natives
// (moved from src/task/native-glove-crosshair-limits.mjs, native-glove-spell-limits.mjs,
// native-object-distance.mjs, native-object-distance-direct.mjs and
// native-shift-right-signed.mjs; lifted in src/game/glove-target.mjs,
// src/game/object-distance.mjs and src/game/script-queries.mjs). The proof plans, the
// Native58 dispatch of proof/task/native-dispatch.mjs and the instruction tests of
// tools/task-native-m1d.test.mjs run these; the game runs the lifted natives.
import { taskStop } from '../../src/task/plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { GLOVE_LIMITS, applyGloveLimits } from '../../src/task/native-glove-crosshair-limits.mjs';
import { OBJECT_X, OBJECT_Y, PLAYER_OBJECT } from '../../src/task/wram.mjs';
import { BANK_WRAP, WORD_BITS, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

const DISTANCE_RETURN_WORD = 0xc692,
  DISTANCE_ENTRY = 0x80c696 & WORD_MASK,
  DISTANCE_RESUME = 0x80c693 & WORD_MASK,
  SIGN_SHIFT = WORD_BITS - 1;

// 80:BC83: switch to the crosshair limits (the tail of 80:BC80 after its JSR 80:BC36).
export const limitCrosshairReference = (a, outerReturn = true) =>
  leaf(a, (h) => applyGloveLimits(h, GLOVE_LIMITS.crosshair), outerReturn);
// 80:BC9C: keep the spell glove inside its screen limits (the tail of 80:BC99 after
// its JSR 80:BC36).
export const limitSpellGloveReference = (a, outerReturn = true) =>
  leaf(a, (h) => applyGloveLimits(h, GLOVE_LIMITS.spell), outerReturn);

// 80:C696..C6BE, shared by 80:C68D (JSR C696) and 80:C694 (falls in after LDY DP02):
// distance of the object (first argument, X) to the object in Y: fresh DP00 X, SEC and
// binary SBC of the X and Y positions at DBR (+X minus +Y), negative differences
// negated by EOR/INC; the larger magnitude (unsigned CMP, fresh DP00 reload) shifted
// right twice to DP00.
function measureObjectDistance(h) {
  const { a } = h;
  h.index('x', h.dp(FIRST_ARGUMENT));
  h.ctx.status |= FLAG_CARRY;
  h.load(h.longRead(h.abs(OBJECT_X) + h.ctx.x));
  h.arithmetic(h.longRead(h.abs(OBJECT_X) + h.ctx.y), true);
  if (h.ctx.a & WORD_SIGN) {
    h.load(h.ctx.a ^ WORD_MASK);
    h.load((h.ctx.a + 1) & WORD_MASK);
  }
  a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'distance-first-DP00');
  h.ctx.status |= FLAG_CARRY;
  h.load(h.longRead(h.abs(OBJECT_Y) + h.ctx.x));
  h.arithmetic(h.longRead(h.abs(OBJECT_Y) + h.ctx.y), true);
  if (h.ctx.a & WORD_SIGN) {
    h.load(h.ctx.a ^ WORD_MASK);
    h.load((h.ctx.a + 1) & WORD_MASK);
  }
  const right = h.dp(FIRST_ARGUMENT);
  h.nz((h.ctx.a - right) & WORD_MASK);
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(h.ctx.a >= right);
  if (!(h.ctx.status & FLAG_CARRY)) h.load(h.dp(FIRST_ARGUMENT));
  for (let n = 0; n < 2; n++) {
    h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (h.ctx.a & 1);
    h.load(h.ctx.a >>> 1);
  }
  a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'distance-result-DP00');
}
// 80:C68D: distance of the object (first argument) to the player object (0CC2), through
// a real JSR to the shared body 80:C696; the two-byte JSR frame is real data.
export const getDistanceToPlayerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
      a.pushWord(DISTANCE_RETURN_WORD, 'distance-inner-JSR');
      h.ctx.pc = DISTANCE_ENTRY;
      measureObjectDistance(h);
      const raw = a.pullWord('distance-inner-RTS');
      if (raw !== DISTANCE_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: raw,
          expected: DISTANCE_RETURN_WORD,
        });
      h.ctx.pc = DISTANCE_RESUME;
    },
    outerReturn,
  );
// 80:C694: distance between the objects in the first and second argument: the larger
// of |dx| and |dy|, divided by four, returned in place of the first argument.
// The second object goes to Y, then the shared body 80:C696 runs without a JSR frame.
export const getDistanceBetweenObjectsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('y', h.dp(SECOND_ARGUMENT));
      measureObjectDistance(h);
    },
    outerReturn,
  );
// 80:D9A7: halve the first argument in place as a signed word (LDA, ASL A puts the sign
// into the carry, ROR of the fresh DP00 shifts it back in). A keeps the ASL result;
// N, Z and C come from the ROR.
export const halveArgumentSignedReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(h.dp(FIRST_ARGUMENT));
      h.asl();
      const sign = h.ctx.status & FLAG_CARRY,
        word = h.dp(FIRST_ARGUMENT),
        halved = (word >>> 1) | (sign << SIGN_SHIFT);
      h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (word & 1);
      h.nz(halved);
      a.writeWord(FIRST_ARGUMENT, halved, BANK_WRAP, 'leaf-ROR-DP00');
    },
    outerReturn,
  );
