import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';

// Original C1D9..C1E2, entered only with an observed compatible context.
export function runTaskVisitTail(a, { preserveD = false } = {}) {
  const c = a.ctx;
  if (c.d !== 0 && !preserveD) taskStop('task_visit_D0_required');
  const nz = (v, w = 2) => {
    c.status = (c.status & ~0x82) | (v & (w === 1 ? 128 : 32768) ? 128 : 0) | (v === 0 ? 2 : 0);
    return v;
  };
  a.pushWord(0x8080, 'visit-tail-PEA-DBR80');
  for (let n = 0; n < 2; n++) {
    c.bank = nz(a.read((c.s + 1) & 65535, 'visit-tail-PLB'), 1);
    c.s = (c.s + 1) & 65535;
  }
  c.a = nz(a.pullWord('visit-tail-cursor-PLA'));
  a.writeWord(c.bank * 65536 + 0x250, c.a, 24, 'visit-tail-restored-cursor');
  const raw = a.readWord((c.s + 1) & 65535, 16, 'visit-tail-outer-RTS', true);
  c.s = (c.s + 2) & 65535;
  c.pc = (raw + 1) & 65535;
  return {
    returnTarget: 0x800000 | c.pc,
    outerReturnWord: raw,
    returnTargetExecuted: false,
    frontier: 'actual-visit-return-target',
    visitReturned: true,
    scope: 'manual-original-C1D9-cursor-return',
  };
}
export const prepareTaskVisitTail = (options) =>
  prepareTaskPlan(options, [0x80c1d9], (a) => {
    if (
      ![3, 4].every((n) =>
        options.protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)),
      )
    )
      taskStop('task_outer_return_required');
    return runTaskVisitTail(a);
  });
