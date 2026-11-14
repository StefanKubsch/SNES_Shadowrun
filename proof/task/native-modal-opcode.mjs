import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { runTaskModalObserved, modalDevices } from '../../src/task/native-modal.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
const contracts = new Map([
  [0x72, [0x80cd43, 0x0202, 0x0202]],
  [0xbf, [0x80cd20, 0x0101, 0x0002]],
  [0x74, [0x80cbf7, 0x0202, 0x0000]],
  [0xd7, [0x80935b, 0x0001, 0x0200]],
]);
export function runTaskModalOpcode(a, options, id, allowRemaining = false) {
  const c = contracts.get(id);
  if (!c || a.ctx.x !== 0x58) taskStop('task_modal_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments(a);
  if (args.id !== id || args.freshId !== id || args.metadataWord !== c[1])
    taskStop('task_modal_argument_source_required');
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointer = a.readWord(0xa2, 16, 'modal-fresh-A2');
  if (bridge.pointerWord !== (c[0] & 65535) || pointer !== (c[0] & 65535))
    taskStop('task_modal_target_required');
  a.ctx.pc = pointer;
  const callee = runTaskModalObserved(a, options, c[0], false, allowRemaining);
  if (
    callee.returnTarget !== 0x80f509 ||
    a.ctx.d !== 0 ||
    a.ctx.bank !== 0x80 ||
    a.ctx.status & 0x30
  )
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, id);
  if (resume.metadataWord !== c[2] || resume.resultPushed !== Boolean(c[2] & 255))
    taskStop('task_modal_return_source_required');
  return {
    ...resume,
    arguments: args,
    callee,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: c[0],
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
export function prepareTaskModalOpcode(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskModalOpcode(a, options, options.nativeId),
    modalDevices,
  );
}
