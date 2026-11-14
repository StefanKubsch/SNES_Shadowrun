import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  chooseObjectNumberWithGloveObserved,
  validateGloveTaskOptions,
} from '../../src/task/native-glove-target.mjs';
import { fec1Registers } from '../../src/task/native-notice.mjs';
// Devices of 9BC6: the window, text and list family of FEC1 (arithmetic unit and wait loops); no own I/O.
export const native9BC6Devices = fec1Registers;
// One individually proved Native58/D8 call through 9BC6 (no argument, result word DP00).
export function runTaskNative9BC6Opcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native_d8_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0xd8 ||
    argumentsResult.freshId !== 0xd8 ||
    argumentsResult.metadataWord !== 0x0200 ||
    argumentsResult.wordPops !== 0
  )
    taskStop('task_native_d8_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-d8-fresh-A2');
  if (bridge.pointerWord !== 0x9bc6 || pointerWord !== 0x9bc6)
    taskStop('task_native_d8_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = chooseObjectNumberWithGloveObserved(a, options, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0xd8);
  if (!resume.resultPushed)
    taskStop('task_native_d8_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-d8-through-9bc6-actual-f508-f509-result-PHA-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x809bc6,
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
export function prepareTaskNativeOpcode9BC6(options) {
  const invalid = validateGloveTaskOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative9BC6Opcode(a, options),
    native9BC6Devices,
  );
}
