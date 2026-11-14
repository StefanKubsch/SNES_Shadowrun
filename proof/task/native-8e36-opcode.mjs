import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  hitObjectsInBlastObserved,
  hitObjectsInBlastDevices,
} from '../../src/task/native-object-hit.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
export function runTaskNative7COpcode(a, options, allowRemaining = false) {
  if (a.ctx.x !== 0x58) taskStop('task_native_7c_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments(a);
  if (args.id !== 0x7c || args.freshId !== 0x7c || args.metadataWord !== 0x0502)
    taskStop('task_native_7c_argument_source_required');
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointer = a.readWord(0xa2, 16, 'native-7c-fresh-A2');
  if (bridge.pointerWord !== 0x8e36 || pointer !== 0x8e36)
    taskStop('task_native_7c_target_required');
  a.ctx.pc = pointer;
  const callee = hitObjectsInBlastObserved(a, options, false, allowRemaining);
  if (callee.returnTarget !== 0x80f509) taskStop('task_native_resume_target_required');
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x7c);
  if (resume.metadataWord !== 2 || !resume.resultPushed)
    taskStop('task_native_7c_return_source_required');
  return {
    ...resume,
    scope: 'manual-original7c-whole-graph-actual-F508-F509-before-F390',
    arguments: args,
    callee,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x808e36,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointer,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    waitObservationsUsed: callee.waitObservationsUsed,
    inputObservationsUsed: callee.inputObservationsUsed,
    fullTaskBinding: false,
  };
}
export function prepareTaskNativeOpcode8E36(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative7COpcode(a, options),
    hitObjectsInBlastDevices,
  );
}
