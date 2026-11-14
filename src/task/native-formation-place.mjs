import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import { setObjectAnimation } from './native-object-action-apply.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  FORMATION_INDEX,
  FORMATION_X,
  FORMATION_Y,
  FORMATION_HEIGHT,
  FORMATION_DIRECTION,
  FORMATION_LAST,
  FORMATION_UNMOVED,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';
const FORMATION_MEMBER_STEPS = 0xbb88;
const FORMATION_RING_BYTES = FORMATION_LAST + 2;
const FORMATION_ACTION_RETURN_WORD = 0xbb71;
const FORMATION_SELECTION_RETURN_WORD = 0xbb86;
// 80:BB2C: the object (first argument) takes its place in the formation. Its number 150A+Y is searched in the group
// 7E2DF0 from 7E2DE6 down (a miss leaves X = FFFE); the step BB88+X plus 0D18 (minus 80 from 80 on) selects
// the recorded position 7E45A8 (0: nothing) with 7E44A8/7E4528 and the action 7E4628. Height, position and
// depth go to 0ED8/0E28/0E80+Y; AAAF sets the action DP02 (PEI DP00 around it), then A985 the selection 2
// (0D1A = 0) or 0, both with real JSR/RTS.
const callLeaf = (a, returnWord, run) => {
  a.pushWord(returnWord, 'BB2C-JSR');
  const result = run(a, false);
  if (result.rawReturnWord !== returnWord)
    taskStop('task_native_helper_return_required', {
      actual: result.rawReturnWord,
      expected: returnWord,
    });
};
export const placeObjectInFormation = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        compare = (left, right) => {
          h.nz((left - right) & WORD_MASK);
          ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
        };
      h.load(h.longRead(WRAM + GROUP_INDEX));
      h.index('x', ctx.a);
      h.index('y', h.dp(0));
      h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
      for (;;) {
        compare(ctx.a, h.longRead(WRAM + GROUP_NUMBERS + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        h.index('x', ctx.x - 2);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      h.load(h.longRead(h.abs(FORMATION_MEMBER_STEPS) + ctx.x));
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.longRead(h.abs(FORMATION_INDEX)));
      compare(ctx.a, FORMATION_RING_BYTES);
      if (ctx.status & FLAG_CARRY) h.arithmetic(FORMATION_RING_BYTES, true);
      h.index('x', ctx.a);
      h.load(h.longRead(WRAM + FORMATION_HEIGHT + ctx.x));
      if (ctx.status & FLAG_ZERO) return;
      h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.y, ctx.a);
      h.load(h.longRead(WRAM + FORMATION_X + ctx.x));
      h.longWrite(h.abs(OBJECT_X) + ctx.y, ctx.a);
      h.load(h.longRead(WRAM + FORMATION_Y + ctx.x));
      h.longWrite(h.abs(OBJECT_Y) + ctx.y, ctx.a);
      h.load(h.longRead(WRAM + FORMATION_DIRECTION + ctx.x));
      a.writeWord(2, ctx.a, BANK_WRAP, 'BB2C-DP02');
      a.pushWord(h.dp(0), 'BB2C-PEI-DP00');
      callLeaf(a, FORMATION_ACTION_RETURN_WORD, setObjectDirection);
      h.load(h.longRead(h.abs(FORMATION_UNMOVED)));
      h.load(ctx.status & FLAG_ZERO ? 2 : 0);
      a.writeWord(2, ctx.a, BANK_WRAP, 'BB2C-DP02');
      h.load(a.pullWord('BB2C-PLA'));
      a.writeWord(0, ctx.a, BANK_WRAP, 'BB2C-DP00');
      callLeaf(a, FORMATION_SELECTION_RETURN_WORD, setObjectAnimation);
    },
    outerReturn,
  );
