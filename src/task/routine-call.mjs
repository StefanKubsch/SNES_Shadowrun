import { taskStop } from './plan.mjs';

// A JSR or JSL into a routine table: the routine bound to the target runs
// inside the original call frame. An unbound target stops before the frame
// is pushed (main_loop_frontier); there is no assumed return value.
export const routineCaller =
  (h, events, routines, longDefault = false) =>
  (pc, target, long = longDefault) => {
    const run = routines.get(target);
    if (!run) taskStop('main_loop_frontier', { target });
    return h.call(pc, target, () => run(h, events, routines), long);
  };
