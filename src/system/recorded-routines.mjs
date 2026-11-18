// Routines that a recorded startup run replaces with the original's register-level
// version. A startup recording observes every reached instruction
// (startupInterrupts), so the lifted routine, which has no instruction boundaries,
// cannot consume those observations; the register-level versions live in proof/ and
// install themselves here. The game never records, so it always runs the lifted
// routine.
import { taskStop } from './task-stop.mjs';

const routines = new Map();

// Installed by proof modules: name -> (h, events, ...values) => result; the lifted
// caller passes its parameters as values, the proof module puts them where the
// register-level version takes them.
export function installRecordedRoutine(name, run) {
  routines.set(name, run);
}

// The register-level replacement of routine `name` for this run, or null when the
// run is not an instruction-level recording.
export function recordedRoutine(events, name) {
  if (!events?.startupInterrupts) return null;
  const run = routines.get(name);
  if (!run) taskStop('recorded_routine_required', { name });
  return run;
}
