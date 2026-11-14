import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  redrawWindowListObserved,
  validateWindowListRedrawOptions,
  cda8Registers,
} from '../../src/task/native-window-list-redraw.mjs';
// One individually proved Native58/C2 call through CDA8 and the AD92 composition.
export function runTaskNativeCDA8Opcode(a, options, allowRemainingWaitObservations = false) {
  if (a.ctx.x !== 0x58) taskStop('task_native_c2_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0xc2 ||
    argumentsResult.freshId !== 0xc2 ||
    argumentsResult.metadataWord !== 0x0100 ||
    argumentsResult.wordPops !== 0
  )
    taskStop('task_native_c2_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-c2-fresh-A2');
  if (bridge.pointerWord !== 0xcda8 || pointerWord !== 0xcda8)
    taskStop('task_native_c2_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = redrawWindowListObserved(a, options, false, allowRemainingWaitObservations);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0xc2);
  if (!resume.resultPushed)
    taskStop('task_native_c2_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-c2-through-cda8-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x80cda8,
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
export function prepareTaskNativeOpcodeCDA8(options) {
  const invalid = validateWindowListRedrawOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNativeCDA8Opcode(a, options),
    cda8Registers,
  );
}
