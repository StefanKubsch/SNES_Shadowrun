import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { appendScriptTask } from './task-append.mjs';

import {
  ANIMATION_CLOCK_START,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_Y,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  MOTION_ACTIVE,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_ARMOUR,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_DEPTH_ORDER,
  OBJECT_DEPTH_RULE,
  OBJECT_DIALOG,
  OBJECT_DIRECTION,
  OBJECT_FRAME_REPEATS,
  OBJECT_LAST_SLOT,
  OBJECT_PICTURE,
  OBJECT_RECORD,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_KIND,
  OBJECT_NUMBER,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
  OBJECT_TASK,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
  OBJECT_DIAGONAL,
} from './wram.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
import { KIND_TABLE, KIND_FLAGS_OFFSET } from '../data/kinds.mjs';
// Return words of the JSL A8EB and of the JSR C366 (bank offsets of the calls' last bytes).
const APPEND_RETURN_WORD = 0x80a8ee & WORD_MASK,
  C366_RETURN_WORD = 0x80c368 & WORD_MASK;
// 80:A835: create an object of the kind in the first argument in the last free slot (kind
// negative; none free: nothing) and return the slot in DP00. Original slot creation and the
// actual A8EB JSL/C366 JSR/RTL graph.
export const createObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.index('x', OBJECT_LAST_SLOT + 2);
      while (true) {
        h.index('x', (ctx.x - 1) & WORD_MASK);
        h.index('x', (ctx.x - 1) & WORD_MASK);
        if (ctx.x & WORD_SIGN) return;
        h.load(h.longRead(WRAM + OBJECT_KIND + ctx.x));
        if (ctx.a & WORD_SIGN) break;
      }
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + OBJECT_KIND + ctx.x, ctx.a);
      for (const offset of [
        OBJECT_VELOCITY_X,
        OBJECT_VELOCITY_Y,
        OBJECT_VELOCITY_Z,
        OBJECT_DEPTH_RULE,
      ])
        h.longWrite(h.abs(offset) + ctx.x, 0);
      h.load(0);
      for (const offset of [
        OBJECT_BOX_X1,
        OBJECT_BOX_X2,
        OBJECT_BOX_Y1,
        OBJECT_BOX_Y2,
        OBJECT_BOX_HEIGHT,
        OBJECT_ARMOUR,
        OBJECT_DIALOG,
        MOTION_ACTIVE,
      ])
        h.longWrite(WRAM + offset + ctx.x, ctx.a);
      h.longWrite(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
      h.longWrite(WRAM + OBJECT_PICTURE + ctx.x, ctx.a);
      h.load(h.dp(2));
      h.asl();
      h.asl();
      h.longWrite(h.abs(OBJECT_X) + ctx.x, ctx.a);
      h.load(h.dp(DP_OBJECT_Y));
      h.asl();
      h.asl();
      h.longWrite(h.abs(OBJECT_Y) + ctx.x, ctx.a);
      ctx.status &= ~FLAG_CARRY;
      h.arithmetic(h.longRead(h.abs(OBJECT_X) + ctx.x));
      ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
      h.load(ctx.a >>> 1);
      h.longWrite(h.abs(OBJECT_DIAGONAL) + ctx.x, ctx.a);
      h.load(h.dp(DP_OBJECT_HEIGHT));
      h.asl();
      h.asl();
      h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.x, ctx.a);
      for (const offset of [
        OBJECT_ACTION_DIRECTIONS,
        OBJECT_VRAM_SLOT_COUNT,
        OBJECT_VRAM_SLOT_HEAD,
        OBJECT_DIRECTION,
        OBJECT_RECORD,
        OBJECT_DEPTH_ORDER,
      ])
        h.longWrite(h.abs(offset) + ctx.x, 0);
      h.load(WORD_MASK);
      h.longWrite(h.abs(OBJECT_SELECTION) + ctx.x, ctx.a);
      h.longWrite(h.abs(OBJECT_NUMBER) + ctx.x, ctx.a);
      h.load(ANIMATION_CLOCK_START);
      h.longWrite(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x, ctx.a);
      h.load(1);
      h.longWrite(WRAM + OBJECT_FRAME_REPEATS + ctx.x, ctx.a);
      a.writeWord(FIRST_ARGUMENT, ctx.x, BANK_WRAP, 'create-slot-STX-DP00');
      h.load(h.longRead(WRAM + OBJECT_KIND + ctx.x));
      h.asl();
      a.writeWord(2, ctx.a, BANK_WRAP, 'create-slot-STA-DP02');
      h.asl();
      h.arithmetic(h.dp(2));
      h.index('x', ctx.a);
      h.load(h.longRead(KIND_TABLE + KIND_FLAGS_OFFSET + ctx.x));
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(OBJECT_FLAGS) + ctx.x, ctx.a);
      h.load(ctx.x);
      h.index('x', h.longRead(h.abs(DRAW_LIST_INDEX)));
      h.index('x', (ctx.x + 1) & WORD_MASK);
      h.index('x', (ctx.x + 1) & WORD_MASK);
      h.longWrite(h.abs(DRAW_LIST_INDEX), ctx.x);
      h.longWrite(h.abs(DRAW_LIST) + ctx.x, ctx.a);
      h.index('x', h.dp(DP_OBJECT_SCRIPT));
      if (ctx.x & WORD_SIGN) return;
      a.write(ctx.s, CODE_BANK, 'create-slot-JSL-bank');
      ctx.s = (ctx.s - 1) & WORD_MASK;
      a.pushWord(APPEND_RETURN_WORD, 'create-slot-JSL-WORD');
      a.pushWord(C366_RETURN_WORD, 'create-slot-C366-JSR');
      const appended = appendScriptTask(a, false);
      if (appended.rawReturnWord !== C366_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: appended.rawReturnWord,
          expected: C366_RETURN_WORD,
        });
      const raw = a.pullWord('create-slot-C369-RTL-WORD'),
        bank = a.read((ctx.s + 1) & WORD_MASK, 'create-slot-C369-RTL-bank');
      ctx.s = (ctx.s + 1) & WORD_MASK;
      if (raw !== APPEND_RETURN_WORD || bank !== CODE_BANK)
        taskStop('task_native_long_return_required', { raw, bank });
      ctx.pc = APPEND_RETURN_WORD + 1;
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(OBJECT_TASK) + ctx.x, ctx.a);
    },
    outerReturn,
  );
