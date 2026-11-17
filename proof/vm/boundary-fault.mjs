// Fault conversion of the register-level drivers (proof/vm/main-driver.mjs and
// native-call.mjs); the live game does not convert task stops into VM faults.
import { VmFault } from '../../src/vm/memory.mjs';

// A proven module stops at a source boundary by throwing {taskBoundary, reason, ...}.
// The VM reports it as VmFault('<kind>:<reason>') at the native or main target.
export function boundaryFault(error, kind, target) {
  if (!error?.taskBoundary) return error;
  const { taskBoundary, reason, ...details } = error;
  return new VmFault(kind + ':' + reason, target, details);
}
