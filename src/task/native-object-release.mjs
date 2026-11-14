import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import {
  ANIMATION_CLOCK_START,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  MOTION_ACTIVE,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_FRAME_REPEATS,
  OBJECT_PICTURE,
  VRAM_SLOT_NEXT,
  OBJECT_KIND,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  VRAM_SLOT_COUNT,
  VRAM_SLOT_FREE_LIST,
  WRAM,
  OBJECT_ACTION_DIRECTIONS,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
// Countdown of the VRAM slots still to free; return word of the JSR A8F5 (its last byte).
const DP_SLOTS_LEFT = 0x17,
  RELEASE_RETURN_WORD = 0x80a8f7 & WORD_MASK;
// Body of 80:AA4C, also called by 80:A8F5: clear the box, motion, picture and animation
// fields of the object (first argument) and return its VRAM slots to the free list.
export function releaseObjectGraphics(h) {
  const { a, ctx } = h;
  h.index('x', h.dp(0));
  h.load(0);
  for (const offset of [
    OBJECT_BOX_X1,
    OBJECT_BOX_X2,
    OBJECT_BOX_Y1,
    OBJECT_BOX_Y2,
    OBJECT_BOX_HEIGHT,
    MOTION_ACTIVE,
  ])
    h.longWrite(WRAM + offset + ctx.x, ctx.a);
  h.longWrite(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x, ctx.a);
  h.longWrite(WRAM + OBJECT_PICTURE + ctx.x, ctx.a);
  h.longWrite(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x, ctx.a);
  h.load(WORD_MASK);
  h.longWrite(h.abs(OBJECT_SELECTION) + ctx.x, ctx.a);
  h.load(ANIMATION_CLOCK_START);
  h.longWrite(WRAM + OBJECT_ANIMATION_CLOCK + ctx.x, ctx.a);
  h.load(1);
  h.longWrite(WRAM + OBJECT_FRAME_REPEATS + ctx.x, ctx.a);
  h.load(h.longRead(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x));
  if (ctx.a === 0) return;
  a.writeWord(DP_SLOTS_LEFT, ctx.a, BANK_WRAP, 'release-count-DP17');
  ctx.status &= ~FLAG_CARRY;
  h.arithmetic(h.longRead(h.abs(VRAM_SLOT_COUNT)));
  h.longWrite(h.abs(VRAM_SLOT_COUNT), ctx.a);
  do {
    h.index('y', h.longRead(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
    h.load(h.longRead(h.abs(VRAM_SLOT_NEXT) + ctx.y));
    h.longWrite(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x, ctx.a);
    h.load(h.longRead(h.abs(VRAM_SLOT_FREE_LIST)));
    h.longWrite(h.abs(VRAM_SLOT_FREE_LIST), ctx.y);
    h.longWrite(h.abs(VRAM_SLOT_NEXT) + ctx.y, ctx.a);
    const count = h.nz(
      (a.readWord(DP_SLOTS_LEFT, BANK_WRAP, 'release-fresh-DP17') - 1) & WORD_MASK,
    );
    a.writeWord(DP_SLOTS_LEFT, count, BANK_WRAP, 'release-DEC-DP17');
  } while (!(ctx.status & FLAG_ZERO));
  h.longWrite(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x, 0);
}
// 80:A8F5: remove the object (first argument) from the scene: JSR AA4C releases its
// graphics, its kind becomes FFFF and it leaves the draw list (the entries after it
// move down by one word).
export const removeObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      a.pushWord(RELEASE_RETURN_WORD, 'release-inner-JSR');
      releaseObjectGraphics(h);
      const raw = a.pullWord('release-inner-RTS');
      if (raw !== RELEASE_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: raw,
          expected: RELEASE_RETURN_WORD,
        });
      h.ctx.pc = RELEASE_RETURN_WORD + 1;
      h.index('x', h.dp(0));
      h.load(WORD_MASK);
      h.longWrite(WRAM + OBJECT_KIND + h.ctx.x, h.ctx.a);
      h.index('x', h.longRead(h.abs(DRAW_LIST_INDEX)));
      for (let n = 0; n < 2; n++) {
        const count = h.nz((h.longRead(h.abs(DRAW_LIST_INDEX)) - 1) & WORD_MASK);
        h.longWrite(h.abs(DRAW_LIST_INDEX), count);
      }
      h.load(h.longRead(h.abs(DRAW_LIST) + h.ctx.x));
      while (true) {
        const right = h.dp(0),
          left = h.ctx.a;
        h.nz((left - right) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
        if (h.ctx.status & FLAG_ZERO) break;
        h.index('x', (h.ctx.x - 1) & WORD_MASK);
        h.index('x', (h.ctx.x - 1) & WORD_MASK);
        h.index('y', h.longRead(h.abs(DRAW_LIST) + h.ctx.x));
        h.longWrite(h.abs(DRAW_LIST) + h.ctx.x, h.ctx.a);
        h.load(h.ctx.y);
      }
    },
    outerReturn,
  );
