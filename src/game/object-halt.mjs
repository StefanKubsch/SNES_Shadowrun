// Halting and resuming an object (lifted from the script natives 80:8E96 and 80:8EB8;
// register-level references in proof/game-reference/object-halt.mjs).
//
// The object's halt bit (bit 10 of its flags, 7E:1458) is set or cleared. When the object
// has a task (7E:1350 not negative), the task that runs for it (a parent waiting for its
// child stands for the child) gets wait bit 12, which keeps the task of a halted object
// waiting (docs/SCHEDULER.md), set or cleared.
//
// The object fields are reached through the data bank with 24-bit indexes, the task
// through the task API (src/script/task-api.mjs).
import { OBJECT_HALTED } from '../data/wram.mjs';
import { tasksOf, waitingTask } from '../script/task-api.mjs';
import { WAIT_HALTED } from '../script/scheduler.mjs';
import { WORD_SIGN } from '../constants/bits.mjs';
import { bankObjectWord, setBankObjectWord } from '../state/objects.mjs';

const DP_OBJECT = 0;

const withBit = (value, bit, set) => (set ? value | bit : value & ~bit);

// Set (halt) or clear (resume) the halt bits of the object in word 00 and of its task.
function setHalted(mem, a, set) {
  const object = mem.read16Bank0(DP_OBJECT);
  setBankObjectWord(
    a,
    'flags',
    object,
    withBit(bankObjectWord(a, 'flags', object), OBJECT_HALTED, set),
  );
  const task = bankObjectWord(a, 'task', object);
  if (task & WORD_SIGN) return;
  const tasks = tasksOf(a),
    waiting = waitingTask(tasks, task);
  tasks.setWait(waiting, withBit(tasks.wait(waiting), WAIT_HALTED, set));
}

// 80:8E96: halt the object in word 00 and its task.
export const haltObject = (mem, a) => setHalted(mem, a, true);
// 80:8EB8: resume the object in word 00 and its task.
export const resumeObject = (mem, a) => setHalted(mem, a, false);
