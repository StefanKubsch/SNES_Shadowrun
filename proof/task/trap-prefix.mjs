import { prepareTaskPlan } from './plan.mjs';

// Five independently pinned original JMPs. F927 itself is not executed.
export function runTaskTrapPrefix(a) {
  a.ctx.pc = 0xf927;
  return {
    frontier: '80:F927',
    scope: 'manual-original-JMP-prefix-before-unproved-target',
    targetExecuted: false,
    dynamicDispatchExecuted: false,
  };
}
export const prepareTaskTrapPrefix = (options) =>
  prepareTaskPlan(options, [0x80f4bb, 0x80f774, 0x80f7b6, 0x80f7f8, 0x80f83d], runTaskTrapPrefix);
