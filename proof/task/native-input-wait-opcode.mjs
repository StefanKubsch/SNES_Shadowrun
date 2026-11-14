import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  waitForConfirmKey,
  validateTaskInputWaitOptions,
} from '../../src/task/native-input-wait.mjs';
export function runTaskNativeInputWaitOpcode(a, options, allowRemaining = false) {
  if (a.ctx.x !== 0x58) taskStop('task_native_a3_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments(a);
  if (
    args.id !== 0xa3 ||
    args.freshId !== 0xa3 ||
    args.metadataWord !== 0x100 ||
    args.wordPops !== 0
  )
    taskStop('task_native_a3_argument_source_required');
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointer = a.readWord(0xa2, 16, 'native-a3-fresh-A2');
  if (bridge.pointerWord !== 0xf953 || pointer !== 0xf953)
    taskStop('task_native_a3_target_required');
  a.ctx.pc = pointer;
  const callee = waitForConfirmKey(a, options, false, allowRemaining);
  if (callee.returnTarget !== 0x80f509) taskStop('task_native_resume_target_required');
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0xa3);
  if (resume.metadataWord !== 0x200 || resume.resultPushed)
    taskStop('task_native_a3_return_source_required');
  return {
    ...resume,
    arguments: args,
    callee,
    calleeEntry: 0x80f953,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointer,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    waitObservationsUsed: callee.waitObservationsUsed,
    waitEvents: callee.waitEvents,
    inputObservationsUsed: callee.inputObservationsUsed,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    fullTaskBinding: false,
    scope: 'manual-original-native58-a3-whole-normal-F953-f508-f509-before-F390',
  };
}
export function prepareTaskNativeOpcodeF953(options) {
  const invalid = validateTaskInputWaitOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(options, [0x80f390], (a) => runTaskNativeInputWaitOpcode(a, options));
}
