import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { playSoundEffect, taskAudioDevices } from '../../src/task/native-audio-compose.mjs';

// Exactly the original Native58/4C normal-return graph. All APU/product
// samples remain fresh external observations; no device clock is inferred.
export function runTaskNativeAudioOpcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native4c_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const args = runTaskNativeArguments(a);
  if (args.id !== 0x4c || args.freshId !== 0x4c || args.metadataWord !== 0x0104)
    taskStop('task_native4c_argument_source_required', {
      id: args.id,
      freshId: args.freshId,
      metadataWord: args.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native4c-fresh-A2');
  if (bridge.pointerWord !== 0xc46e || pointerWord !== 0xc46e)
    taskStop('task_native4c_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const events = { calls: [] },
    callee = playSoundEffect(a, events, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x4c);
  if (resume.metadataWord !== 0 || resume.resultPushed)
    taskStop('task_native4c_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-4c-through-whole-normal-audio-actual-f508-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x80c46e,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: args,
    callee: { ...callee, calls: Object.freeze(events.calls) },
    fullTaskBinding: false,
  };
}
export const prepareTaskNativeOpcodeC46E = (options) =>
  prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNativeAudioOpcode(a, options),
    taskAudioDevices,
  );
