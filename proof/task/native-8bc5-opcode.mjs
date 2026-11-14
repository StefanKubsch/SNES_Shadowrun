import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { chooseEnemyTarget } from '../game-reference/enemy-target-choice.mjs';
import { taskRandomDevices } from '../../src/task/native-random.mjs';
import { lineOfSightDevices } from '../../src/task/line-of-sight.mjs';
// Devices of 8BC5: the PPU counters of C51F and the arithmetic unit of 81:A25F.
export const native8BC5Devices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([...new Set([...taskRandomDevices[key], ...lineOfSightDevices[key]])]),
    ]),
  ),
);
// One individually proved Native58/07 call through 8BC5 (one argument word, result pushed).
export function runTaskNative8BC5Opcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native_07_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0x07 ||
    argumentsResult.freshId !== 0x07 ||
    argumentsResult.metadataWord !== 0x0101 ||
    argumentsResult.wordPops !== 1
  )
    taskStop('task_native_07_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-07-fresh-A2');
  if (bridge.pointerWord !== 0x8bc5 || pointerWord !== 0x8bc5)
    taskStop('task_native_07_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = chooseEnemyTarget(a, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x07);
  if (!resume.resultPushed)
    taskStop('task_native_07_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-07-through-8bc5-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x808bc5,
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
export const prepareTaskNativeOpcode8BC5 = (options) =>
  prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative8BC5Opcode(a, options),
    native8BC5Devices,
  );
