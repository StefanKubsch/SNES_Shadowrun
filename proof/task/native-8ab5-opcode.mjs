import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { shootAtObjectObserved } from '../../src/task/native-object-shoot.mjs';
import { hitObjectsInBlastDevices } from '../../src/task/native-object-hit.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
import { lineOfSightDevices } from '../../src/task/line-of-sight.mjs';
// Devices of 8AB5: those of the Native7C hit graph (actions, sound, random) and the arithmetic unit of 81:A25F.
export const native8AB5Devices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([...new Set([...hitObjectsInBlastDevices[key], ...lineOfSightDevices[key]])]),
    ]),
  ),
);
// One individually proved Native58/10 call through 8AB5 (six argument words, result pushed).
export function runTaskNative8AB5Opcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native_10_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0x10 ||
    argumentsResult.freshId !== 0x10 ||
    argumentsResult.metadataWord !== 0x0006 ||
    argumentsResult.wordPops !== 6
  )
    taskStop('task_native_10_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-10-fresh-A2');
  if (bridge.pointerWord !== 0x8ab5 || pointerWord !== 0x8ab5)
    taskStop('task_native_10_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = shootAtObjectObserved(a, options, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x10);
  if (!resume.resultPushed)
    taskStop('task_native_10_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-10-through-8ab5-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x808ab5,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: argumentsResult,
    callee,
    waitObservationsUsed: callee.waitObservationsUsed,
    inputObservationsUsed: callee.inputObservationsUsed,
    fullTaskBinding: false,
  };
}
export function prepareTaskNativeOpcode8AB5(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative8AB5Opcode(a, options),
    native8AB5Devices,
  );
}
