import { runTaskLocalWrites } from './local-writes.mjs';
import { runTaskCallLocal } from './call-local.mjs';
import { runTaskReturnLocal } from './return-local.mjs';
import { runTaskMultiplyUnsigned } from './multiply-unsigned.mjs';
import { runTaskMultiplySU } from './multiply-su.mjs';
import { runTaskMultiplyUS } from './multiply-us.mjs';
import { runTaskMultiplySS } from './multiply-ss.mjs';
import { runTaskDivideUnsigned } from './divide-unsigned.mjs';
import { runTaskDivideSU } from './divide-su.mjs';
import { runTaskDivideUS } from './divide-us.mjs';
import { runTaskDivideSS } from './divide-ss.mjs';
import { runTaskRemainderUnsigned } from './remainder-unsigned.mjs';
import { runTaskRemainderSigned } from './remainder-signed.mjs';
import { runTaskScriptArguments } from '../../src/task/script-arguments.mjs';
import { runTaskScriptOpcode } from '../../src/task/script-yield.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeOpcode } from './native-opcode.mjs';
import { runTaskEndReturn } from './end-return.mjs';
import { runTaskTrapPrefix } from './trap-prefix.mjs';
import { runTaskStatusReturn } from './status-return.mjs';
import { runTaskJumpZero } from './jump-zero.mjs';
import { runTaskJumpNonzero } from './jump-nonzero.mjs';
import { runTaskJump } from './jump.mjs';
import { runTaskCompareGates } from './compare-gates.mjs';
import { runTaskCarryCompare } from './carry-compare.mjs';
import { runTaskCarrySignGates } from './carry-sign-gates.mjs';
import { runTaskComplementSignGates } from './complement-sign-gates.mjs';
import { runTaskStateReads } from './state-reads.mjs';
import { runTaskStateWrites } from './state-writes.mjs';
import { runTaskStateSignExtension } from './state-sign-extension.mjs';
import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskPush } from './push.mjs';
import { runTaskLocalReads } from './local-reads.mjs';
import { runTaskUpdates } from './updates.mjs';
import { runTaskConsumers } from './consumers.mjs';
import { runTaskBitLogic } from './bit-logic.mjs';
import { runTaskTruth } from './truth.mjs';
import { runTaskNegateShifts } from './negate-shifts.mjs';
import { runTaskSignExtension } from './sign-extension.mjs';

// Each fixed slot below has an independently checked original source contract.
// Full X is used before admission. No ROM instruction or arbitrary callee runs.
const handlers = new Map([
  [0x0, { target: 0x80f398, run: runTaskPush }],
  [0x14, { target: 0x80f3b1, run: runTaskPush }],
  [0xc0, { target: 0x80f393, run: runTaskPush }],
  [0x2, { target: 0x80f3a1, run: runTaskLocalReads }],
  [0x16, { target: 0x80f3b9, run: runTaskLocalReads }],
  [0xc2, { target: 0x80f8cb, run: runTaskLocalReads }],
  [0x86, { target: 0x80f3e4, run: runTaskUpdates }],
  [0x88, { target: 0x80f3ea, run: runTaskUpdates }],
  [0xba, { target: 0x80f3f0, run: runTaskUpdates }],
  [0xbc, { target: 0x80f8bb, run: runTaskConsumers }],
  [0x5c, { target: 0x80f532, run: runTaskConsumers }],
  [0x5e, { target: 0x80f53b, run: runTaskConsumers }],
  [0x7e, { target: 0x80f715, run: runTaskBitLogic }],
  [0x80, { target: 0x80f71d, run: runTaskBitLogic }],
  [0x82, { target: 0x80f725, run: runTaskBitLogic }],
  [0x84, { target: 0x80f72d, run: runTaskBitLogic }],
  [0xbe, { target: 0x80f8bf, run: runTaskTruth }],
  [0xaa, { target: 0x80f843, run: runTaskTruth }],
  [0xb2, { target: 0x80f87f, run: runTaskTruth }],
  [0x78, { target: 0x80f6f4, run: runTaskNegateShifts }],
  [0x7a, { target: 0x80f6fd, run: runTaskNegateShifts }],
  [0x7c, { target: 0x80f709, run: runTaskNegateShifts }],
  [0xa, { target: 0x80f3f6, run: runTaskSignExtension }],
  [0xc, { target: 0x80f408, run: runTaskSignExtension }],
  [0x44, { target: 0x80f420, run: runTaskJumpZero }],
  [0x46, { target: 0x80f42e, run: runTaskJumpNonzero }],
  [0x48, { target: 0x80f43c, run: runTaskJump }],
  [0xac, { target: 0x80f852, run: runTaskCompareGates }],
  [0xae, { target: 0x80f86e, run: runTaskCompareGates }],
  [0xb4, { target: 0x80f88e, run: runTaskCompareGates }],
  [0xb6, { target: 0x80f8aa, run: runTaskCompareGates }],
  [0x8a, { target: 0x80f735, run: runTaskCarryCompare }],
  [0x92, { target: 0x80f77a, run: runTaskCarryCompare }],
  [0x9a, { target: 0x80f7bc, run: runTaskCarryCompare }],
  [0xa2, { target: 0x80f7fe, run: runTaskCarryCompare }],
  [0x8c, { target: 0x80f745, run: runTaskCarrySignGates }],
  [0x8e, { target: 0x80f762, run: runTaskCarrySignGates }],
  [0x94, { target: 0x80f789, run: runTaskCarrySignGates }],
  [0x96, { target: 0x80f7a5, run: runTaskCarrySignGates }],
  [0x9c, { target: 0x80f7cb, run: runTaskComplementSignGates }],
  [0x9e, { target: 0x80f7e7, run: runTaskComplementSignGates }],
  [0xa4, { target: 0x80f80e, run: runTaskComplementSignGates }],
  [0xa6, { target: 0x80f82b, run: runTaskComplementSignGates }],
  [0x4, { target: 0x80f8d4, run: runTaskStateReads }],
  [0x18, { target: 0x80f8e4, run: runTaskStateReads }],
  [0x2e, { target: 0x80f8f1, run: runTaskStateWrites }],
  [0x36, { target: 0x80f902, run: runTaskStateWrites }],
  [0xe, { target: 0x80f90f, run: runTaskStateSignExtension }],
  [0xb0, { target: 0x80f843, run: runTaskTruth }],
  [0x2c, { target: 0x80f3c6, run: runTaskLocalWrites }],
  [0x34, { target: 0x80f3d7, run: runTaskLocalWrites }],
  [0xb8, { target: 0x80f87f, run: runTaskTruth }],
  [0x4c, { target: 0x80f442, run: runTaskCallLocal }],
  [0x50, { target: 0x80f454, run: runTaskReturnLocal }],
  [0x60, { target: 0x80f581, run: runTaskMultiplyUnsigned }],
  [0x62, { target: 0x80f546, run: runTaskMultiplySU }],
  [0x64, { target: 0x80f556, run: runTaskMultiplyUS }],
  [0x66, { target: 0x80f566, run: runTaskMultiplySS }],
  [0x68, { target: 0x80f609, run: runTaskDivideUnsigned }],
  [0x6a, { target: 0x80f5cc, run: runTaskDivideSU }],
  [0x6c, { target: 0x80f5de, run: runTaskDivideUS }],
  [0x6e, { target: 0x80f5f0, run: runTaskDivideSS }],
  [0x70, { target: 0x80f6ae, run: runTaskRemainderUnsigned }],
  [0x72, { target: 0x80f67a, run: runTaskRemainderSigned }],
  [0x74, { target: 0x80f689, run: runTaskRemainderSigned }],
  [0x76, { target: 0x80f696, run: runTaskRemainderSigned }],
  [0x52, { target: 0x80f460, run: runTaskScriptArguments, frontier: '80:F488' }],
  [0x58, { target: 0x80f4cb, run: runTaskNativeArguments, frontier: '80:F4F6' }],
  [0x56, { target: 0x80f4be, run: runTaskEndReturn, frontier: 'actual-outer-return-target' }],
  [0x54, { target: 0x80f4bb, run: runTaskTrapPrefix, frontier: '80:F927' }],
  [0x90, { target: 0x80f774, run: runTaskTrapPrefix, frontier: '80:F927' }],
  [0x98, { target: 0x80f7b6, run: runTaskTrapPrefix, frontier: '80:F927' }],
  [0xa0, { target: 0x80f7f8, run: runTaskTrapPrefix, frontier: '80:F927' }],
  [0xa8, { target: 0x80f83d, run: runTaskTrapPrefix, frontier: '80:F927' }],
  [0x6, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x8, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x10, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x12, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x1a, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x1c, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x1e, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x20, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x22, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x24, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x26, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x28, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x2a, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x30, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x32, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x38, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x3a, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x3c, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x3e, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x40, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x42, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x4a, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x4e, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
  [0x5a, { target: 0x80f927, run: runTaskStatusReturn, frontier: 'actual-outer-return-target' }],
]);
export function runTaskOpcodeSequence(a, options, initialOpcode = null) {
  const limit = options.maxHandlers;
  if (!Number.isSafeInteger(limit) || limit < 1) taskStop('task_handler_budget_required');
  if (initialOpcode !== null && a.ctx.x !== initialOpcode) taskStop('task_opcode_entry_required');
  const steps = [];
  for (let n = 0; n < limit; n++) {
    if (a.ctx.pc !== 0xf390 || a.ctx.status & 0x30) taskStop('task_opcode_context_required');
    const opcode = a.ctx.x,
      dispatch = runTaskOpcodeTarget(a),
      handler = handlers.get(opcode);
    if (!handler) taskStop('task_opcode_source_required', { opcode, target: dispatch.target });
    if (dispatch.target !== handler.target)
      taskStop('task_opcode_target_required', { opcode, target: dispatch.target });
    if (handler.run === runTaskStatusReturn && options.allowCurrentStackReturn === false)
      taskStop('task_opcode_status_return_source_required');
    const fullNative = opcode === 0x58 && options.native58Composition === true;
    const fullScript = opcode === 0x52 && options.script52Composition === true;
    const fullStatus =
      handler.run === runTaskTrapPrefix && options.statusReturnComposition === true;
    if (fullStatus && options.allowCurrentStackReturn === false)
      taskStop('task_opcode_status_return_source_required');
    let result = fullNative
      ? runTaskNativeOpcode({ ...a, entry: handler.target }, options)
      : fullScript
        ? runTaskScriptOpcode({ ...a, entry: handler.target }, options)
        : handler.run({ ...a, entry: handler.target });
    if (fullStatus) {
      if (a.ctx.pc !== 0xf927 || result.frontier !== '80:F927')
        taskStop('task_opcode_frontier_required');
      result = { ...runTaskStatusReturn({ ...a, entry: 0x80f927 }), statusPrefixExecuted: true };
    }
    if (fullScript) {
      if (result.frontier !== 'actual-outer-yield-target')
        taskStop('task_opcode_frontier_required');
      if (n + 1 !== limit)
        taskStop('task_opcode_continuation_source_required', { opcode, frontier: result.frontier });
    } else if (handler.frontier && !fullNative) {
      if (result.frontier !== (fullStatus ? 'actual-outer-return-target' : handler.frontier))
        taskStop('task_opcode_frontier_required');
      if (n + 1 !== limit)
        taskStop('task_opcode_continuation_source_required', { opcode, frontier: result.frontier });
    } else if (a.ctx.pc !== 0xf390 || result.frontier !== '80:F390')
      taskStop('task_opcode_frontier_required');
    steps.push(
      Object.freeze({
        opcode,
        target: dispatch.target,
        tableAddress: dispatch.tableAddress,
        ...result,
      }),
    );
  }
  return {
    frontier: steps.at(-1).frontier,
    scope: 'manual-bounded-source-proved-opcode-sequence',
    steps: Object.freeze(steps),
    handlersExecuted: steps.length,
    boundedOpcodeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    nextTargetExecuted: false,
    fullTaskBinding: false,
  };
}
const prepareSequence = (options, initialOpcode = null) =>
  prepareTaskPlan(options, [0x80f390], (a) => runTaskOpcodeSequence(a, options, initialOpcode));
export const prepareTaskOpcodeSequence = (options) => prepareSequence(options);
export const prepareTaskNativeOpcodeSequence = (options) =>
  prepareSequence({ ...options, native58Composition: true });
export const prepareTaskNativeOpcode58 = (options) =>
  prepareSequence({ ...options, native58Composition: true }, 0x58);
export const prepareTaskScriptOpcodeSequence = (options) =>
  prepareSequence({ ...options, native58Composition: true, script52Composition: true });
export const prepareTaskScriptOpcode52 = (options) =>
  prepareSequence({ ...options, native58Composition: true, script52Composition: true }, 0x52);
export const prepareTaskOpcode00 = (options) => prepareSequence(options, 0x0);
export const prepareTaskOpcode14 = (options) => prepareSequence(options, 0x14);
export const prepareTaskOpcodeC0 = (options) => prepareSequence(options, 0xc0);
export const prepareTaskOpcode02 = (options) => prepareSequence(options, 0x2);
export const prepareTaskOpcode16 = (options) => prepareSequence(options, 0x16);
export const prepareTaskOpcodeC2 = (options) => prepareSequence(options, 0xc2);
export const prepareTaskOpcode86 = (options) => prepareSequence(options, 0x86);
export const prepareTaskOpcode88 = (options) => prepareSequence(options, 0x88);
export const prepareTaskOpcodeBA = (options) => prepareSequence(options, 0xba);
export const prepareTaskOpcodeBC = (options) => prepareSequence(options, 0xbc);
export const prepareTaskOpcode5C = (options) => prepareSequence(options, 0x5c);
export const prepareTaskOpcode5E = (options) => prepareSequence(options, 0x5e);
export const prepareTaskOpcode7E = (options) => prepareSequence(options, 0x7e);
export const prepareTaskOpcode80 = (options) => prepareSequence(options, 0x80);
export const prepareTaskOpcode82 = (options) => prepareSequence(options, 0x82);
export const prepareTaskOpcode84 = (options) => prepareSequence(options, 0x84);
export const prepareTaskOpcodeBE = (options) => prepareSequence(options, 0xbe);
export const prepareTaskOpcodeAA = (options) => prepareSequence(options, 0xaa);
export const prepareTaskOpcodeB2 = (options) => prepareSequence(options, 0xb2);
export const prepareTaskOpcode78 = (options) => prepareSequence(options, 0x78);
export const prepareTaskOpcode7A = (options) => prepareSequence(options, 0x7a);
export const prepareTaskOpcode7C = (options) => prepareSequence(options, 0x7c);
export const prepareTaskOpcode0A = (options) => prepareSequence(options, 0xa);
export const prepareTaskOpcode0C = (options) => prepareSequence(options, 0xc);

export const prepareTaskOpcode44 = (options) => prepareSequence(options, 0x44);
export const prepareTaskOpcode46 = (options) => prepareSequence(options, 0x46);
export const prepareTaskOpcode48 = (options) => prepareSequence(options, 0x48);
export const prepareTaskOpcodeAC = (options) => prepareSequence(options, 0xac);
export const prepareTaskOpcodeAE = (options) => prepareSequence(options, 0xae);
export const prepareTaskOpcodeB4 = (options) => prepareSequence(options, 0xb4);
export const prepareTaskOpcodeB6 = (options) => prepareSequence(options, 0xb6);
export const prepareTaskOpcode8A = (options) => prepareSequence(options, 0x8a);
export const prepareTaskOpcode92 = (options) => prepareSequence(options, 0x92);
export const prepareTaskOpcode9A = (options) => prepareSequence(options, 0x9a);
export const prepareTaskOpcodeA2 = (options) => prepareSequence(options, 0xa2);
export const prepareTaskOpcode8C = (options) => prepareSequence(options, 0x8c);
export const prepareTaskOpcode8E = (options) => prepareSequence(options, 0x8e);
export const prepareTaskOpcode94 = (options) => prepareSequence(options, 0x94);
export const prepareTaskOpcode96 = (options) => prepareSequence(options, 0x96);
export const prepareTaskOpcode9C = (options) => prepareSequence(options, 0x9c);
export const prepareTaskOpcode9E = (options) => prepareSequence(options, 0x9e);
export const prepareTaskOpcodeA4 = (options) => prepareSequence(options, 0xa4);
export const prepareTaskOpcodeA6 = (options) => prepareSequence(options, 0xa6);
export const prepareTaskOpcode04 = (options) => prepareSequence(options, 0x4);
export const prepareTaskOpcode18 = (options) => prepareSequence(options, 0x18);
export const prepareTaskOpcode2E = (options) => prepareSequence(options, 0x2e);
export const prepareTaskOpcode36 = (options) => prepareSequence(options, 0x36);
export const prepareTaskOpcode0E = (options) => prepareSequence(options, 0xe);
export const prepareTaskOpcodeB0 = (options) => prepareSequence(options, 0xb0);

export const prepareTaskOpcode2C = (options) => prepareSequence(options, 0x2c);
export const prepareTaskOpcode34 = (options) => prepareSequence(options, 0x34);
export const prepareTaskOpcodeB8 = (options) => prepareSequence(options, 0xb8);
export const prepareTaskOpcode4C = (options) => prepareSequence(options, 0x4c);
export const prepareTaskOpcode50 = (options) => prepareSequence(options, 0x50);
export const prepareTaskOpcode60 = (options) => prepareSequence(options, 0x60);
export const prepareTaskOpcode62 = (options) => prepareSequence(options, 0x62);
export const prepareTaskOpcode64 = (options) => prepareSequence(options, 0x64);
export const prepareTaskOpcode66 = (options) => prepareSequence(options, 0x66);
export const prepareTaskOpcode68 = (options) => prepareSequence(options, 0x68);
export const prepareTaskOpcode6A = (options) => prepareSequence(options, 0x6a);
export const prepareTaskOpcode6C = (options) => prepareSequence(options, 0x6c);
export const prepareTaskOpcode6E = (options) => prepareSequence(options, 0x6e);
export const prepareTaskOpcode70 = (options) => prepareSequence(options, 0x70);
export const prepareTaskOpcode72 = (options) => prepareSequence(options, 0x72);
export const prepareTaskOpcode74 = (options) => prepareSequence(options, 0x74);
export const prepareTaskOpcode76 = (options) => prepareSequence(options, 0x76);
export const prepareTaskOpcode52 = (options) => prepareSequence(options, 0x52);
export const prepareTaskOpcode58 = (options) => prepareSequence(options, 0x58);
export const prepareTaskOpcode56 = (options) => prepareSequence(options, 0x56);
export const prepareTaskOpcode54 = (options) => prepareSequence(options, 0x54);
export const prepareTaskOpcode90 = (options) => prepareSequence(options, 0x90);
export const prepareTaskOpcode98 = (options) => prepareSequence(options, 0x98);
export const prepareTaskOpcodeA0 = (options) => prepareSequence(options, 0xa0);
export const prepareTaskOpcodeA8 = (options) => prepareSequence(options, 0xa8);

export const prepareTaskOpcode06 = (options) => prepareSequence(options, 0x6);
export const prepareTaskOpcode08 = (options) => prepareSequence(options, 0x8);
export const prepareTaskOpcode10 = (options) => prepareSequence(options, 0x10);
export const prepareTaskOpcode12 = (options) => prepareSequence(options, 0x12);
export const prepareTaskOpcode1A = (options) => prepareSequence(options, 0x1a);
export const prepareTaskOpcode1C = (options) => prepareSequence(options, 0x1c);
export const prepareTaskOpcode1E = (options) => prepareSequence(options, 0x1e);
export const prepareTaskOpcode20 = (options) => prepareSequence(options, 0x20);
export const prepareTaskOpcode22 = (options) => prepareSequence(options, 0x22);
export const prepareTaskOpcode24 = (options) => prepareSequence(options, 0x24);
export const prepareTaskOpcode26 = (options) => prepareSequence(options, 0x26);
export const prepareTaskOpcode28 = (options) => prepareSequence(options, 0x28);
export const prepareTaskOpcode2A = (options) => prepareSequence(options, 0x2a);
export const prepareTaskOpcode30 = (options) => prepareSequence(options, 0x30);
export const prepareTaskOpcode32 = (options) => prepareSequence(options, 0x32);
export const prepareTaskOpcode38 = (options) => prepareSequence(options, 0x38);
export const prepareTaskOpcode3A = (options) => prepareSequence(options, 0x3a);
export const prepareTaskOpcode3C = (options) => prepareSequence(options, 0x3c);
export const prepareTaskOpcode3E = (options) => prepareSequence(options, 0x3e);
export const prepareTaskOpcode40 = (options) => prepareSequence(options, 0x40);
export const prepareTaskOpcode42 = (options) => prepareSequence(options, 0x42);
export const prepareTaskOpcode4A = (options) => prepareSequence(options, 0x4a);
export const prepareTaskOpcode4E = (options) => prepareSequence(options, 0x4e);
export const prepareTaskOpcode5A = (options) => prepareSequence(options, 0x5a);
