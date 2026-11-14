import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';
import { runTaskVisit } from './visit-c1ca.mjs';
import { runTaskVisitTail } from './visit-tail.mjs';
import { runTaskOpcodeSequence } from './opcode-sequence.mjs';

// Bounded original joins only, with actual inner return bytes on one overlay.
// Capabilities are earned by the actual source-specific pushes in this plan.
// External protected owners remain governed by prepareTaskPlan unchanged.
export function runTaskVisitOpcodes(a, options) {
  if (!Number.isSafeInteger(options.maxHandlers) || options.maxHandlers < 1)
    taskStop('task_handler_budget_required');
  if (
    ![1, 2].every((n) => options.protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)))
  )
    taskStop('task_outer_return_required');
  const inner = new Map(),
    returns = [],
    steps = [],
    visits = [];
  const key = (s) => renderAddress((s + 1) & 65535);
  const adapted = {
    ...a,
    pushWord(value, label) {
      a.pushWord(value, label);
      if (['visit-JSR-F378', 'visit-PEA-continuation-return', 'visit-JSR-body'].includes(label)) {
        const raw = label === 'visit-JSR-body' ? 0xc1d8 : 0xc20a;
        if (value !== raw) taskStop('task_visit_inner_source_required');
        inner.set(key(a.ctx.s), {
          s: a.ctx.s,
          raw,
          bytes: [key(a.ctx.s), renderAddress((a.ctx.s + 2) & 65535)],
        });
      }
    },
    readWord(address, wrap = 24, label = 'WORD', outer = false) {
      const owned = outer && wrap === 16 ? inner.get(renderAddress(address)) : null;
      if (!owned) return a.readWord(address, wrap, label, outer);
      const raw = a.readWord(address, wrap, label + '-migrated-inner');
      if (raw !== owned.raw)
        taskStop('task_visit_inner_return_required', { address, raw, expected: owned.raw });
      inner.delete(renderAddress(address));
      returns.push(
        Object.freeze({
          raw,
          target: 0x800000 | ((raw + 1) & 65535),
          bytes: Object.freeze(owned.bytes),
        }),
      );
      return raw;
    },
  };
  const owners = () => [
    ...options.protectedStackBytes,
    ...Array.from(inner.values()).flatMap((v) => v.bytes),
  ];
  let result = runTaskVisit(adapted);
  visits.push(Object.freeze({ ...result }));
  while (true) {
    if (result.frontier !== '80:F390') {
      if (a.entry === 0x80c1ca && result.returnTarget === 0x80c1d9) {
        if (returns.at(-1)?.raw !== 0xc1d8) taskStop('task_visit_inner_return_required');
        result = runTaskVisitTail(adapted, { preserveD: options.visitStatusComposition === true });
      }
      if (steps.length !== options.maxHandlers)
        taskStop('task_visit_opcode_count_required', { handlersExecuted: steps.length });
      return {
        ...result,
        steps: Object.freeze(steps),
        visits: Object.freeze(visits),
        migratedReturns: Object.freeze(returns),
        handlersExecuted: steps.length,
        boundedOpcodeDispatchExecuted: true,
        scope: 'manual-bounded-visit-opcodes-actual-return',
      };
    }
    if (steps.length === options.maxHandlers)
      return {
        ...result,
        steps: Object.freeze(steps),
        visits: Object.freeze(visits),
        migratedReturns: Object.freeze(returns),
        handlersExecuted: steps.length,
        boundedOpcodeDispatchExecuted: true,
        scope: 'manual-bounded-visit-opcodes-before-next-F390',
      };
    const returnCount = returns.length;
    const p = runTaskOpcodeSequence(adapted, {
      ...options,
      maxHandlers: 1,
      native58Composition: true,
      script52Composition: true,
      statusReturnComposition: options.visitStatusComposition === true,
      allowCurrentStackReturn: options.visitStatusComposition === true,
      protectedStackBytes: owners(),
    });
    steps.push(p.steps[0]);
    result = p.steps[0];
    if (
      result.frontier === 'actual-outer-return-target' ||
      result.frontier === 'actual-outer-yield-target'
    ) {
      if (
        result.returnTarget !== 0x80c20b ||
        returns.length !== returnCount + 1 ||
        returns.at(-1)?.raw !== 0xc20a
      )
        taskStop('task_visit_postrun_source_required');
      result = runTaskVisit(
        { ...adapted, entry: 0x80c20b },
        { preservePostrunD: options.visitStatusComposition === true },
      );
      visits.push(Object.freeze({ ...result, postrunOccurrenceProven: true }));
    } else if (result.frontier !== '80:F390')
      taskStop('task_visit_opcode_frontier_required', { frontier: result.frontier });
  }
}
export const prepareTaskVisitOpcodes = (options) =>
  prepareTaskPlan(options, [0x80c1ca, 0x80c1f9, 0x80c20b], (a) => runTaskVisitOpcodes(a, options));
// Separate renewed contract: F927 uses the actual current stack, never savedS.
export const prepareTaskVisitStatusOpcodes = (options) =>
  prepareTaskVisitOpcodes({ ...options, visitStatusComposition: true });
