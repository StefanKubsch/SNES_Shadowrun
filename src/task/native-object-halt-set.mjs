import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_FLAGS, OBJECT_HALTED, OBJECT_TASK } from './wram.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { BANK_SIZE, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
// 80:8E96 and 80:8EB8: bit 10 of $1458 of object DP00 set (8E96) or cleared (8EB8); then from
// $1350 (negative: done) along the links $0372 while $0BA2 is negative, and in the first nonnegative
// $0BA2 bit 12 set or cleared. A link chain without end loops in the original; stop after 65536 links.
// Wait bit 12 holds the task of a halted object (docs/SCHEDULER.md).
const WAIT_HALTED = 0x1000,
  LINK_LIMIT = BANK_SIZE;
// Set (halt) or clear (resume) the halt bits of the object and of its waiting task.
function setObjectHalted(a, outerReturn, set) {
  return leaf(
    a,
    (h) => {
      const { ctx } = h,
        field = (offset, index) => h.longRead(h.abs(offset) + index);
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(field(OBJECT_FLAGS, ctx.x));
      h.load(set ? ctx.a | OBJECT_HALTED : ctx.a & (WORD_MASK ^ OBJECT_HALTED));
      h.longWrite(h.abs(OBJECT_FLAGS) + ctx.x, ctx.a);
      h.index('y', field(OBJECT_TASK, ctx.x));
      if (ctx.status & FLAG_NEGATIVE) return;
      for (let n = 0; ; n++) {
        if (n === LINK_LIMIT)
          taskStop('task_native_link_chain_unbounded', { entry: set ? 0x808e96 : 0x808eb8 });
        h.load(field(TASK_WAIT, ctx.y));
        if (!(ctx.status & FLAG_NEGATIVE)) break;
        h.load(field(TASK_PREVIOUS, ctx.y));
        h.index('y', ctx.a);
      }
      h.load(set ? ctx.a | WAIT_HALTED : ctx.a & (WORD_MASK ^ WAIT_HALTED));
      h.longWrite(h.abs(TASK_WAIT) + ctx.y, ctx.a);
    },
    outerReturn,
  );
}
// 80:8E96: halt the object (first argument) and its task.
export const haltObject = (a, outerReturn = true) => setObjectHalted(a, outerReturn, true);
// 80:8EB8 (native-object-halt-clear.mjs): resume the object (first argument) and its task.
export const resumeObject = (a, outerReturn = true) => setObjectHalted(a, outerReturn, false);
