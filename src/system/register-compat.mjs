// Register-level compatibility entries for recorded comparisons. Live play never
// reaches them: game code takes game services and frame jobs. Recorded callers
// (the frozen caller and lift-function tests in tools/) still pass an accessor
// whose CPU context carries the original registers, stack frames and interrupt
// records. The modules that implement those equations install themselves here
// when they load, so the live import graph contains none of them
// (docs/REGISTER-COMPAT-BOUNDARY.md):
//   dialogAccess          tools/register-forms/native-dialog-support.mjs
//   dialogCallBody        tools/register-forms/native-call-continuation.mjs
//   observedContinuation  tools/register-forms/native-call-continuation.mjs
//   interruptAtBranch     tools/register-forms/main-wait-interrupt.mjs
// Every recorded accessor comes from dialogAccess, whose module loads the others.
import { taskStop } from './task-stop.mjs';

const entries = new Map();

export function installRegisterCompat(parts) {
  for (const [name, run] of Object.entries(parts)) entries.set(name, run);
}

export function registerCompat(name) {
  const run = entries.get(name);
  if (!run) taskStop('register_compat_required', { name });
  return run;
}

// The original JSR/JSL frame around a callee sequence, for recorded callers only.
export function* recordedCallBody(h, pc, target, body, long = false) {
  return yield* registerCompat('dialogCallBody')(h, pc, target, body, long);
}
