import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskVisit } from './visit-c1ca.mjs';

// Original Native9F consumes the native JSR frame, then a different return.
// Its saved continuation is data, never an immediate F509 occurrence.
export function runTaskNativeWait(a, outerReturn = true) {
  const c = a.ctx;
  if (c.d !== 0) taskStop('task_direct_page_zero_required');
  const nz = (v) => {
    v &= 65535;
    c.status = (c.status & ~0x82) | (v & 32768 ? 128 : 0) | (v === 0 ? 2 : 0);
    return v;
  };
  const abs = (n) => (c.bank * 65536 + n) & 0xffffff;
  c.x = nz(a.readWord(abs(0x250), 24, 'wait-task-index'));
  c.a = nz(a.readWord(0, 16, 'wait-mask'));
  a.writeWord(abs(0xba2 + c.x), c.a, 24, 'wait-mask-store');
  c.a = nz(a.readWord(2, 16, 'wait-count'));
  a.writeWord(abs(0xc02 + c.x), c.a, 24, 'wait-count-store');
  a.writeWord(abs(0xc62 + c.x), 0, 24, 'wait-status-clear');
  c.a = nz(a.pullWord('wait-discard-JSR-PLA'));
  a.writeWord(abs(0x2b2 + c.x), c.a, 24, 'wait-continuation-store');
  const raw = a.readWord((c.s + 1) & 65535, 16, 'wait-outer-RTS', outerReturn);
  c.s = (c.s + 2) & 65535;
  c.pc = (raw + 1) & 65535;
  return {
    savedContinuationWord: c.a,
    rawReturnWord: raw,
    returnTarget: 0x800000 | c.pc,
    frontier: 'actual-native-wait-yield-target',
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    scope: 'manual-original-native9F-discard-JSR-save-continuation-yield',
  };
}
export const prepareTaskNativeWait = (options) =>
  prepareTaskPlan(options, [0x80c401], (a) => runTaskNativeWait(a));

export function runTaskNativeWaitOpcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_opcode_entry_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required');
  const args = runTaskNativeArguments({ ...a, entry: 0x80f4cb });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes);
  const pointer = a.readWord(0xa2, 16, 'wait-dispatch-fresh-pointer');
  if (pointer !== 0xc401) taskStop('task_native_wait_target_required', { pointer });
  a.ctx.pc = pointer;
  const result = runTaskNativeWait(a);
  // Argument and return aliases stay live. This identifies the real bridge
  // bytes consumed by PLA, without caching them or bypassing any access.
  if (result.savedContinuationWord !== 0xf508) taskStop('task_native_wait_continuation_required');
  return {
    ...args,
    ...result,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointer,
    opcode: 0x58,
    target: slot.target,
    tableAddress: slot.tableAddress,
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    calleeEntry: 0x80c401,
    scope: 'manual-native58-original-native9F-through-actual-outer-yield',
  };
}
export const prepareTaskNativeWaitOpcode = (options) =>
  prepareTaskPlan(options, [0x80f390], (a) => runTaskNativeWaitOpcode(a, options));

// Independent, explicitly observed later C1F9 entry. Original readiness
// reads and decrements actual provider bytes; no elapsed time or writer is
// invented. Only its fresh saved F508 and real PEA/PHA/RTS admit F509.
export function runTaskNativeWaitResume(a, options) {
  if (
    ![1, 2].every((n) => options.protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)))
  )
    taskStop('task_outer_return_required');
  const result = runTaskVisit(a, { nativeWaitContinuation: true });
  return {
    ...result,
    scope:
      a.entry === 0x80c1ca
        ? 'manual-observed-whole-C1CA-readiness-native9F-resume'
        : 'manual-observed-C1F9-readiness-native9F-resume',
    readinessEntryObserved: true,
    automaticReadiness: false,
  };
}
export const prepareTaskNativeWaitResume = (options) =>
  prepareTaskPlan(options, [0x80c1f9], (a) => runTaskNativeWaitResume(a, options));
