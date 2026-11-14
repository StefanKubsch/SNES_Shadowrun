import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { appendToFightListReference as appendToFightList } from '../game-reference/fight-list-append.mjs';
import { taskAudioDevices } from '../../src/task/native-audio-compose.mjs';
// One individually proved Native58/AC call through 8521 (one argument word, no result).
export function runTaskNative8521Opcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native_ac_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0xac ||
    argumentsResult.freshId !== 0xac ||
    argumentsResult.metadataWord !== 0x0101 ||
    argumentsResult.wordPops !== 1
  )
    taskStop('task_native_ac_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-ac-fresh-A2');
  if (bridge.pointerWord !== 0x8521 || pointerWord !== 0x8521)
    taskStop('task_native_ac_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = appendToFightList(a, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0xac);
  if (resume.resultPushed)
    taskStop('task_native_ac_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-ac-through-8521-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x808521,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: argumentsResult,
    callee,
    fullTaskBinding: false,
  };
}
export const prepareTaskNativeOpcode8521 = (options) =>
  prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative8521Opcode(a, options),
    taskAudioDevices,
  );
