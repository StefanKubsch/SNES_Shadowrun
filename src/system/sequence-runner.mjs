import { taskStop } from './task-stop.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from './native-wait-continuation.mjs';

// Budgeted generator composition. The suspended generator owns its locals and
// reply; CPU registers, return addresses and stack storage are not control state.
export class SequenceRunner {
  constructor(sequence, continuations = new Map()) {
    this.sequence = sequence;
    this.continuations = continuations;
    this.work = 0;
    this.done = false;
    this.failed = false;
    this.running = false;
    this.current = null;
    this.child = null;
  }
  run(budget) {
    if (!Number.isSafeInteger(budget) || budget < 0) taskStop('native_call_budget_required');
    if (this.failed) taskStop('native_call_failed');
    if (this.running) taskStop('native_call_reentry');
    this.running = true;
    try {
      while (budget > 0 && !this.done) {
        if (!this.current) {
          const next = this.sequence.next(this.reply);
          this.reply = undefined;
          if (next.done) {
            this.done = true;
            this.result = next.value;
            break;
          }
          this.current = next.value;
          if (this.current.continuation) this.child = this.current.continuation;
          else if (typeof this.current !== 'function') {
            // A factory is registered by target, or by its run function when
            // another implementation of the same target exists (proof references).
            const factory = this.continuations.get(this.current.target);
            if (factory?.run === this.current.run) this.child = factory.create(this.current);
            else
              this.child = this.continuations.get(this.current.run)?.create(this.current) ?? null;
          }
        }
        if (this.child) {
          const before = this.child.work,
            status = this.child.run(budget),
            used = this.child.work - before;
          budget -= used;
          this.work += used;
          if (status === WAIT_PAUSED) break;
          this.reply = this.child.result;
          this.child = null;
        } else {
          const action = this.current;
          this.reply =
            typeof action === 'function'
              ? action()
              : action.run(action.h, action.events, action.routines);
          budget--;
          this.work++;
        }
        this.current = null;
      }
    } catch (error) {
      this.failed = true;
      throw error;
    } finally {
      this.running = false;
    }
    return this.done ? WAIT_RETURNED : WAIT_PAUSED;
  }
}
