import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  runTaskActionsObserved,
  validateTaskActionsOptions,
  taskActionsDevices,
} from '../../src/task/native-actions.mjs';
// One original Native58/13 invocation. Whole owned actions graph, genuine
// F508/RTS/F509, result-PHA and next fetch; no arbitrary target or CPU runner.
export function runTaskNative13Opcode(a, options, allowRemainingObservations = false) {
  if (a.ctx.x !== 0x58) taskStop('task_native13_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const args = runTaskNativeArguments(a);
  if (args.id !== 0x13 || args.freshId !== 0x13 || args.metadataWord !== 0x0201)
    taskStop('task_native13_argument_source_required', {
      id: args.id,
      freshId: args.freshId,
      metadataWord: args.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native13-fresh-A2');
  if (bridge.pointerWord !== 0x9ba0 || pointerWord !== 0x9ba0)
    taskStop('task_native13_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = runTaskActionsObserved(a, options, 0x809ba0, false, allowRemainingObservations);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x13);
  if (resume.metadataWord !== 2 || !resume.resultPushed)
    taskStop('task_native13_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope:
      'manual-original-native58-13-through-whole-actions-actual-f508-f509-result-PHA-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x809ba0,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: args,
    callee,
    waitObservationsUsed: callee.waitObservationsUsed,
    inputObservationsUsed: callee.inputObservationsUsed,
    fullTaskBinding: false,
  };
}
export function prepareTaskNativeOpcode9BA0(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative13Opcode(a, options),
    taskActionsDevices,
  );
}
