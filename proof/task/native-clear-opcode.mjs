import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  releaseNoticeWindowsObserved,
  validateNoticeReleaseOptions,
  clearFF79Registers,
} from '../../src/task/native-slot-release.mjs';
export function runTaskNativeClearOpcode(a, options, allowRemainingWaitObservations = false) {
  if (a.ctx.x !== 0x58) taskStop('task_native_a7_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0xa7 ||
    argumentsResult.freshId !== 0xa7 ||
    argumentsResult.metadataWord !== 0x0100 ||
    argumentsResult.wordPops !== 0
  )
    taskStop('task_native_a7_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-a7-fresh-A2');
  if (bridge.pointerWord !== 0xff79 || pointerWord !== 0xff79)
    taskStop('task_native_a7_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = releaseNoticeWindowsObserved(a, options, false, allowRemainingWaitObservations);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0xa7);
  if (resume.metadataWord !== 0 || resume.resultPushed)
    taskStop('task_native_a7_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-a7-through-ff79-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x80ff79,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: argumentsResult,
    callee,
    waitObservationsUsed: callee.waitObservationsUsed,
    waitEvents: callee.waitEvents,
    fullTaskBinding: false,
  };
}
export function prepareTaskNativeOpcodeFF79(options) {
  const invalid = validateNoticeReleaseOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNativeClearOpcode(a, options),
    clearFF79Registers,
  );
}
