import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { createObject } from './native-object-create.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import {
  GROUP_INDEX,
  GROUP_SLOTS,
  OBJECT_CLASS_MASK,
  DP_OBJECT_SCRIPT,
  DP_SCENE_OBJECT_NUMBER,
  DP_SCENE_OBJECT_POSITION,
  DP_SCENE_OBJECT_SCRATCH,
  SCENE_OBJECT_ROW_FACTOR,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_POSITIONS,
  OBJECT_ARMOUR,
  OBJECT_DEPTH_ORDER,
  OBJECT_FLAGS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RUNNER_ARMOUR_RATING,
  WRAM,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP, BYTE_MASK, LONG_WRAP, BYTE_BITS } from '../constants/bits.mjs';
import { ACTOR_TABLE, ACTOR_RECORD, ACTOR_SCRIPT, ACTOR_DEPTH_FLAGS } from '../data/actors.mjs';
import { RUNNER_OBJECT_NUMBERS, RUNNER_LAST_INDEX } from '../data/runners.mjs';
const CREATE_RETURN_WORD = 0xa22f;
const ACTION_RETURN_WORD = 0xa239;
// 80:A1E6: add a scene object. Appends the first argument to the object list 7E2DE8 (count 7E2DE6),
// position 7E2DF8 = DP0C + (DP0C>>3)*row(7E3C05) and type 7E2DF0 = DP0A, then the proved
// A835 slot creation (ROM8DB024 sprite) and AAAF action with real JSR/RTS, record fields from
// ROM 8DB01F/8DB020, player slot for the first object, and the 9700 type search (no bound inferred).
export const addSceneObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const compare = (left, right) => {
        h.nz((left - right) & WORD_MASK);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const lsr = () => {
        ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
        h.load(ctx.a >>> 1);
      };
      const call = (returnWord, run) => {
        a.pushWord(returnWord, 'A1E6-JSR');
        const result = run();
        if (result.rawReturnWord !== returnWord)
          taskStop('task_native_helper_return_required', {
            actual: result.rawReturnWord,
            expected: returnWord,
          });
      };
      const store = (offset, value) => a.writeWord(offset, value, BANK_WRAP, 'A1E6-DP-WORD');
      h.load(h.longRead(WRAM + GROUP_INDEX));
      h.load((ctx.a + 1) & WORD_MASK);
      h.load((ctx.a + 1) & WORD_MASK);
      h.longWrite(WRAM + GROUP_INDEX, ctx.a);
      h.index('x', ctx.a);
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + GROUP_OBJECTS + ctx.x, ctx.a);
      h.load(h.longRead(WRAM + SCENE_OBJECT_ROW_FACTOR));
      h.load(ctx.a & BYTE_MASK);
      h.index('y', ctx.a);
      h.load(h.dp(DP_SCENE_OBJECT_POSITION));
      lsr();
      lsr();
      lsr();
      store(DP_SCENE_OBJECT_SCRATCH, ctx.a);
      h.load(0);
      compare(ctx.y, 0);
      while (!(ctx.status & FLAG_ZERO)) {
        ctx.status &= ~FLAG_CARRY;
        h.arithmetic(h.dp(DP_SCENE_OBJECT_SCRATCH));
        h.index('y', (ctx.y - 1) & WORD_MASK);
      }
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.dp(DP_SCENE_OBJECT_POSITION));
      h.longWrite(WRAM + GROUP_POSITIONS + ctx.x, ctx.a);
      h.load(h.dp(DP_SCENE_OBJECT_NUMBER));
      h.longWrite(WRAM + GROUP_NUMBERS + ctx.x, ctx.a);
      h.index('x', ctx.a);
      a.pushWord(ctx.a, 'A1E6-PHA-type');
      h.load(h.dp(DP_OBJECT_SCRIPT));
      store(DP_SCENE_OBJECT_SCRATCH, ctx.a);
      h.load(a.readWord(ACTOR_TABLE + ACTOR_SCRIPT + ctx.x, LONG_WRAP, 'A1E6-sprite-WORD'));
      store(DP_OBJECT_SCRIPT, ctx.a);
      call(CREATE_RETURN_WORD, () => createObject(a, false));
      h.load(h.dp(FIRST_ARGUMENT));
      a.pushWord(ctx.a, 'A1E6-PHA-slot');
      h.load(h.dp(DP_SCENE_OBJECT_SCRATCH));
      store(SECOND_ARGUMENT, ctx.a);
      call(ACTION_RETURN_WORD, () => setObjectDirection(a, false));
      h.load(h.longRead(WRAM + GROUP_INDEX));
      if (ctx.status & FLAG_ZERO) {
        h.load(h.dp(FIRST_ARGUMENT));
        h.longWrite(h.abs(PLAYER_OBJECT), ctx.a);
      }
      h.index('y', a.pullWord('A1E6-PLY-slot'));
      h.load(a.pullWord('A1E6-PLA-type'));
      h.longWrite(h.abs(OBJECT_NUMBER) + ctx.y, ctx.a);
      h.index('x', ctx.a);
      h.load(a.readWord(ACTOR_TABLE + ctx.x, LONG_WRAP, 'A1E6-record-WORD'));
      h.load(ctx.a & ACTOR_DEPTH_FLAGS);
      const swapped = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
      ctx.a = swapped;
      h.nz(swapped & BYTE_MASK, 1);
      h.asl();
      h.arithmetic(0);
      h.longWrite(h.abs(OBJECT_DEPTH_ORDER) + ctx.y, ctx.a);
      h.load(a.readWord(ACTOR_TABLE + ACTOR_RECORD + ctx.x, LONG_WRAP, 'A1E6-record-WORD'));
      h.longWrite(h.abs(OBJECT_RECORD) + ctx.y, ctx.a);
      h.load(h.longRead(WRAM + GROUP_INDEX));
      if (ctx.status & FLAG_ZERO) {
        h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.y));
        h.load(ctx.a | OBJECT_CLASS_MASK);
        h.longWrite(h.abs(OBJECT_FLAGS) + ctx.y, ctx.a);
      }
      h.load(h.longRead(WRAM + GROUP_INDEX));
      h.index('x', ctx.a);
      h.load(ctx.y);
      h.longWrite(h.abs(GROUP_SLOTS) + ctx.x, ctx.a);
      h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
      h.index('x', RUNNER_LAST_INDEX + 2);
      do {
        h.index('x', (ctx.x - 1) & WORD_MASK);
        h.index('x', (ctx.x - 1) & WORD_MASK);
        compare(ctx.a, h.longRead(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
      } while (!(ctx.status & FLAG_ZERO));
      h.load(ctx.x);
      h.asl();
      h.asl();
      h.index('x', ctx.a);
      h.load(h.longRead(WRAM + RUNNER_ARMOUR_RATING + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      h.index('x', ctx.y);
      h.longWrite(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
    },
    outerReturn,
  );
