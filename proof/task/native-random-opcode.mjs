import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { randomBelow, randomByte, taskRandomDevices } from '../../src/task/native-random.mjs';
import { taskRandomTableSources } from '../../src/task/native-random-tables.mjs';
export function runTaskNativeRandomOpcode(a, options, expectedId = 0x3e) {
  if (![0x3e, 0x63].includes(expectedId)) taskStop('task_random_native_id_required');
  const prefix = expectedId === 0x3e ? 'task_native3e' : 'task_native63',
    target = expectedId === 0x3e ? 0x80c51f : 0x80c560,
    metadata = expectedId === 0x3e ? 0x0201 : 0x0100;
  if (a.ctx.x !== 0x58) taskStop(prefix + '_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments(a);
  if (args.id !== expectedId || args.freshId !== expectedId || args.metadataWord !== metadata)
    taskStop(prefix + '_argument_source_required');
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(
      0xa2,
      16,
      expectedId === 0x3e ? 'native3e-fresh-A2' : 'native63-fresh-A2',
    );
  if (bridge.pointerWord !== (target & 65535) || pointerWord !== (target & 65535))
    taskStop(prefix + '_target_required');
  const checkTable = (address, value, width) => {
    for (let n = 0; n < width; n++) {
      const pc = (address + n) & 0xffffff,
        t = taskRandomTableSources.find((t) => pc >= t.start && pc < t.start + t.hex.length / 2);
      if (
        t &&
        ((value >>> (8 * n)) & 255) !==
          parseInt(t.hex.slice((pc - t.start) * 2, (pc - t.start) * 2 + 2), 16)
      )
        taskStop('task_random_table_source_required', { address: pc });
    }
    return value;
  };
  const calleeAccess = {
    ...a,
    read: (address, ...rest) => checkTable(address, a.read(address, ...rest), 1),
    readWord: (address, ...rest) => checkTable(address, a.readWord(address, ...rest), 2),
  };
  a.ctx.pc = pointerWord;
  const callee =
    expectedId === 0x3e ? randomBelow(calleeAccess, false) : randomByte(calleeAccess, false);
  if (callee.returnTarget !== 0x80f509) taskStop('task_native_resume_target_required');
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, expectedId);
  if (resume.metadataWord !== 2 || !resume.resultPushed)
    taskStop(prefix + '_return_source_required');
  return {
    ...resume,
    arguments: args,
    callee,
    calleeEntry: target,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    scope:
      expectedId === 0x3e
        ? 'manual-original-native58-3e-through-whole-random-range-actual-f508-f509-before-F390'
        : 'manual-original-native58-63-through-whole-random-byte-helper-actual-f508-f509-before-F390',
    fullTaskBinding: false,
  };
}
export const prepareTaskNativeOpcodeC51F = (options) =>
  prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNativeRandomOpcode(a, options),
    taskRandomDevices,
  );
export const prepareTaskNativeOpcodeC560 = (options) =>
  prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNativeRandomOpcode(a, options, 0x63),
    taskRandomDevices,
  );
