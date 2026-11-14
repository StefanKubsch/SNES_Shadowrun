import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  shootAtGloveTargetObserved,
  shootWithOwnWeaponObserved,
} from '../../src/task/native-object-shoot.mjs';
import { native8AB5Devices } from './native-8ab5-opcode.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
// One individually proved Native58 call through 8A51 (ID 58, no argument) or 8A8C (ID 5A, two argument
// words), result pushed. Devices as in 8AB5 (hit graph of Native7C with sound and random, 81:A25F).
const CALLEES = Object.freeze({
  0x58: { entry: 0x808a51, metadataWord: 0x0000, wordPops: 0, run: shootAtGloveTargetObserved },
  0x5a: { entry: 0x808a8c, metadataWord: 0x0102, wordPops: 2, run: shootWithOwnWeaponObserved },
});
export function runTaskNative8A51Opcode(a, options, id) {
  const callee = CALLEES[id],
    name = id.toString(16);
  if (a.ctx.x !== 0x58) taskStop(`task_native_${name}_opcode_required`);
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== id ||
    argumentsResult.freshId !== id ||
    argumentsResult.metadataWord !== callee.metadataWord ||
    argumentsResult.wordPops !== callee.wordPops
  )
    taskStop(`task_native_${name}_argument_source_required`, {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, `native-${name}-fresh-A2`);
  if (bridge.pointerWord !== (callee.entry & 0xffff) || pointerWord !== (callee.entry & 0xffff))
    taskStop(`task_native_${name}_target_required`, {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const result = callee.run(a, options, false);
  if (result.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: result.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, id);
  if (!resume.resultPushed)
    taskStop(`task_native_${name}_return_source_required`, { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: `manual-original-native58-${name}-through-${(callee.entry & 0xffff).toString(16)}-actual-f508-and-f509-before-F390`,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: callee.entry,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: result.rawReturnWord,
    calleeReturnTarget: result.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: argumentsResult,
    callee: result,
    waitObservationsUsed: result.waitObservationsUsed,
    inputObservationsUsed: result.inputObservationsUsed,
    fullTaskBinding: false,
  };
}
// Options carry nativeId (58 or 5A) like every special-native oracle of the differential test.
export function prepareTaskNativeOpcode8A51(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  const id = options.nativeId;
  if (!CALLEES[id]) return { handled: false, reason: 'task_native_8a51_id_required' };
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative8A51Opcode(a, options, id),
    native8AB5Devices,
  );
}
