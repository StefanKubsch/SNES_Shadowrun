// Halting and resuming an object (lifted from the script natives 80:8E96 and 80:8EB8;
// register-level references in proof/game-reference/object-halt.mjs).
//
// The object's halt bit (bit 10 of its flags, 7E:1458) is set or cleared. When the object
// has a task (7E:1350 not negative), the task's wait mask (7E:0BA2) is followed along the
// task links to the previous task (7E:0372) while it is negative (a task waiting for its
// child), and the first task with a mask not negative gets wait bit 12, which keeps the
// task of a halted object waiting (docs/SCHEDULER.md), set or cleared.
//
// Memory is reached as the original reaches it: the object and task fields through the
// data bank with 24-bit indexes. A link chain without end, which the original follows
// forever, stops at the frontier `task_native_link_chain_unbounded` after 65536 links.
import { taskStop } from '../task/plan.mjs';
import { OBJECT_FLAGS, OBJECT_HALTED, OBJECT_TASK } from '../task/wram.mjs';
import { TASK_PREVIOUS, TASK_WAIT } from '../vm/layout.mjs';
import { BANK_SIZE, LONG_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const DP_OBJECT = 0;
// Wait bit 12: the task of a halted object.
const WAIT_HALTED = 0x1000,
  LINK_LIMIT = BANK_SIZE;
const HALT_ENTRY = 0x808e96,
  RESUME_ENTRY = 0x808eb8;

const bankAddress = (a, offset) => ((a.ctx.bank << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value & WORD_MASK);
const withBit = (value, bit, set) => (set ? value | bit : value & ~bit);

// Set (halt) or clear (resume) the halt bits of the object in word 00 and of its task.
function setHalted(mem, a, set) {
  const object = mem.read16Bank0(DP_OBJECT);
  setBankWord(
    a,
    OBJECT_FLAGS + object,
    withBit(bankWord(a, OBJECT_FLAGS + object), OBJECT_HALTED, set),
  );
  let task = bankWord(a, OBJECT_TASK + object);
  if (task & WORD_SIGN) return;
  let wait = bankWord(a, TASK_WAIT + task);
  for (let links = 0; wait & WORD_SIGN; links++) {
    if (links === LINK_LIMIT - 1)
      taskStop('task_native_link_chain_unbounded', { entry: set ? HALT_ENTRY : RESUME_ENTRY });
    task = bankWord(a, TASK_PREVIOUS + task);
    wait = bankWord(a, TASK_WAIT + task);
  }
  setBankWord(a, TASK_WAIT + task, withBit(wait, WAIT_HALTED, set));
}

// 80:8E96: halt the object in word 00 and its task.
export const haltObject = (mem, a) => setHalted(mem, a, true);
// 80:8EB8: resume the object in word 00 and its task.
export const resumeObject = (mem, a) => setHalted(mem, a, false);
