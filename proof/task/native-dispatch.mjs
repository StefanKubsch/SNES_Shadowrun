import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { nativeTarget } from '../../src/task/native-targets.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { raiseMemberMagicPointsReference } from '../game-reference/runner-state.mjs';
import {
  getObjectFlagsReference,
  keepObjectFlagBitsReference,
  setObjectFlagBitsReference,
  setObjectFlagsReference,
} from '../game-reference/object-fields.mjs';

// Lifted natives whose proofs run their register-level references (the game runs the
// lifted ones, src/task/native-targets.mjs).
const REFERENCE_TARGETS = new Map([
  [0x80cf2e, raiseMemberMagicPointsReference],
  [0x80ca05, getObjectFlagsReference],
  [0x80ca0d, setObjectFlagsReference],
  [0x80ca15, setObjectFlagBitsReference],
  [0x80ca20, keepObjectFlagBitsReference],
]);

// A fixed, independently source-checked set of native equations. This is no
// opcode runner: unproved pointers never invoke an arbitrary function or ROM.
export function runTaskNativeDispatch(
  a,
  outerReturn = true,
  admittedTargets = null,
  expectedTarget = null,
) {
  const pointerWord = a.readWord(0xa2, 16, 'native-dispatch-fresh-pointer'),
    calleeEntry = 0x800000 | pointerWord;
  if (admittedTargets && !admittedTargets.includes(calleeEntry))
    taskStop('task_native_opcode_target_source_required', { calleeEntry });
  if (expectedTarget !== null && calleeEntry !== expectedTarget)
    taskStop('task_native_opcode_target_required', { calleeEntry, expectedTarget });
  const run = REFERENCE_TARGETS.get(calleeEntry) ?? nativeTarget(calleeEntry);
  if (!run) taskStop('task_native_target_source_required', { calleeEntry });
  a.ctx.pc = pointerWord;
  const result = run(a, outerReturn);
  return {
    ...result,
    pointerWord,
    calleeEntry,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
  };
}
export const prepareTaskNativeDispatch = (options) =>
  prepareTaskPlan(options, [0x80f52f], (a) => runTaskNativeDispatch(a));

// Bridge, fresh target, actual leaf RTS and original resume share one overlay,
// one ledger and one final commit. Internal F508 bytes are freshly read and
// must return to F509 before the source-checked continuation can be applied.
export function runTaskNativeCall(
  a,
  protectedStackBytes,
  admittedTargets = null,
  expectedTarget = null,
) {
  const bridge = runTaskNativeBridge(a, protectedStackBytes),
    dispatch = runTaskNativeDispatch(a, false, admittedTargets, expectedTarget);
  if (dispatch.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: dispatch.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, protectedStackBytes);
  return {
    ...resume,
    calleeEntry: dispatch.calleeEntry,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: dispatch.pointerWord,
    calleeReturnWord: dispatch.rawReturnWord,
    calleeReturnTarget: dispatch.returnTarget,
    boundedNativeDispatchExecuted: true,
    calleeReturnTargetExecuted: true,
    scope: 'manual-source-bound-bridge-leaf-resume-before-F390',
    fullTaskBinding: false,
  };
}
export const prepareTaskNativeCall = (options) =>
  prepareTaskPlan(options, [0x80f4f6], (a) => runTaskNativeCall(a, options.protectedStackBytes));
