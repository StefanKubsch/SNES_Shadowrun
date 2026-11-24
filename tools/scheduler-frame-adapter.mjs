// Original scheduler entry metadata for callers retained in frozen proof code.
// Ordinary game rounds own no such frame; only comparison drivers install this.
import { ROUND, HEAD_VISIT } from '../src/script/natives.mjs';
import { CODE_BANK } from '../src/constants/memory-map.mjs';
import { WORD_MASK } from '../src/constants/bits.mjs';
import { taskStop } from '../src/system/task-stop.mjs';

const ENTRY_STACK_BYTES = new Map([
  [ROUND, 4],
  [HEAD_VISIT, 6],
]);

export function withSchedulerFrames(loop) {
  const interval = loop.interval.bind(loop);
  loop.interval = (target) => {
    const events = interval(target);
    // Frozen callers must reach this adapter, including when the actual side
    // uses direct frame jobs. Named live callbacks would bypass its return frame.
    delete events.schedulerRound;
    delete events.headVisit;
    delete events.nestedHeadVisit;
    events.round ??= (entry) => taskStop('game_loop_synchronous_round', { entry });
    events.nestedRound = (entry) => loop.round(entry);
    events.valueRounds = false;
    return events;
  };
  loop.round = (entry) => {
    const { natives, accessor: a, scheduler } = loop;
    const visit = natives.continuation(
      (function* () {
        const at = entry & WORD_MASK;
        natives.stacks.push((a.ctx.s - ENTRY_STACK_BYTES.get(at)) & WORD_MASK);
        try {
          yield* at === ROUND ? scheduler.rounds() : scheduler.headVisit();
        } finally {
          natives.stacks.pop();
        }
        a.ctx.bank = CODE_BANK;
        a.ctx.pc = (a.pullWord() + 1) & WORD_MASK;
      })(),
    );
    return {
      get work() {
        return visit.work;
      },
      get result() {
        return visit.result;
      },
      run(budget) {
        natives.workBudget = budget;
        try {
          return visit.run(budget);
        } finally {
          natives.workBudget = Infinity;
        }
      },
    };
  };
  return loop;
}
