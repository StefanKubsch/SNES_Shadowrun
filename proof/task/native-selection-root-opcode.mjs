import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { runTaskSelectionObserved, selectionDevices } from '../../src/task/native-selection.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
export function runTaskSelectionOpcode(a, options, id, allowRemaining = false) {
  const entry = id === 0x9a ? 0x80933a : id === 0x1a ? 0x80bba0 : null;
  if (!entry || a.ctx.x !== 0x58) taskStop('task_selection_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments(a);
  if (args.id !== id || args.freshId !== id || args.metadataWord !== 0x0201)
    taskStop('task_selection_argument_source_required');
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointer = a.readWord(0xa2, 16, 'selection-fresh-A2');
  if (bridge.pointerWord !== (entry & 65535) || pointer !== (entry & 65535))
    taskStop('task_selection_target_required');
  a.ctx.pc = pointer;
  const callee = runTaskSelectionObserved(a, options, entry, false, allowRemaining);
  if (
    callee.returnTarget !== 0x80f509 ||
    a.ctx.d !== 0 ||
    a.ctx.bank !== 0x80 ||
    a.ctx.status & 0x30
  )
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, id);
  if (resume.metadataWord !== 0 || resume.resultPushed)
    taskStop('task_selection_return_source_required');
  return {
    ...resume,
    arguments: args,
    callee,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: entry,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointer,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    waitObservationsUsed: callee.waitObservationsUsed,
    fullTaskBinding: false,
  };
}
export function prepareTaskSelectionOpcode(options) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskSelectionOpcode(a, options, options.nativeId),
    selectionDevices,
  );
}
