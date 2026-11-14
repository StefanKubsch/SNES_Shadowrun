import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
import * as combat from '../../src/task/native-combat.mjs';
import {
  chooseObjectUnderGloveObserved,
  validateGloveTaskOptions,
} from '../../src/task/native-glove-target.mjs';
import { fec1Registers } from '../../src/task/native-notice.mjs';
import { lineOfSightDevices } from '../../src/task/line-of-sight.mjs';
import { native8BC5Devices } from './native-8bc5-opcode.mjs';
// Devices of the velocity body 8D95: the hardware divider and its three quotient reads.
const velocityDevices = Object.freeze({
  writes: Object.freeze([0x4204, 0x4205, 0x4206]),
  reads: Object.freeze([0x4214, 0x4215]),
  observationPcs: Object.freeze([0x808df2, 0x808e0f, 0x808e2c]),
});
// Native ID -> callee entry, argument metadata, run(accessor, options) and devices.
const CALLEES = Object.freeze({
  0xab: {
    entry: 0x808b43,
    metadataWord: 0x0101,
    run: (a, o) => combat.spendMagicPointsObserved(a, o, false),
    devices: fec1Registers,
  },
  0x86: {
    entry: 0x808c08,
    metadataWord: 0x0201,
    run: (a) => combat.findNearestVisibleMember(a, false),
    devices: lineOfSightDevices,
  },
  0x4e: {
    entry: 0x808c8d,
    metadataWord: 0x0101,
    run: (a) => combat.chooseRandomFightTarget(a, false),
    devices: native8BC5Devices,
  },
  0x69: {
    entry: 0x808ccf,
    metadataWord: 0x0202,
    run: (a) => combat.canObjectAttack(a, false),
    devices: lineOfSightDevices,
  },
  0xa6: {
    entry: 0x808d0b,
    metadataWord: 0x0001,
    run: (a, o) => chooseObjectUnderGloveObserved(a, o, false),
    devices: fec1Registers,
    validate: validateGloveTaskOptions,
  },
  0x62: {
    entry: 0x808d3f,
    metadataWord: 0x0002,
    run: (a) => combat.jumpObjectTowardsObject(a, false),
    devices: velocityDevices,
  },
  0xd9: {
    entry: 0x808d4e,
    metadataWord: 0x0002,
    run: (a) => combat.jumpObjectTowardsPoint(a, false),
    devices: velocityDevices,
  },
  0x73: {
    entry: 0x808d7f,
    metadataWord: 0x0202,
    run: (a) => combat.moveObjectTowardsObject(a, false),
    devices: velocityDevices,
  },
});
// One individually proved Native58 call through the callee of ID id (argument words, result word as declared).
function runCalleeOpcode(callee, a, options, id) {
  const name = id.toString(16),
    pointer = callee.entry & 0xffff;
  if (a.ctx.x !== 0x58) taskStop(`task_native_${name}_opcode_required`);
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== id ||
    argumentsResult.freshId !== id ||
    argumentsResult.metadataWord !== callee.metadataWord ||
    argumentsResult.wordPops !== (callee.metadataWord & 0xff)
  )
    taskStop(`task_native_${name}_argument_source_required`, {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, `native-${name}-fresh-A2`);
  if (bridge.pointerWord !== pointer || pointerWord !== pointer)
    taskStop(`task_native_${name}_target_required`, {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const result = callee.run(a, options);
  if (result.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: result.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, id);
  // Natives without a result word (return byte 0, e.g. 45/CD9D) declare result: false.
  if (resume.resultPushed !== (callee.result !== false))
    taskStop(`task_native_${name}_return_source_required`, { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: `manual-original-native58-${name}-through-${pointer.toString(16)}-actual-f508-and-f509-before-F390`,
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
    waitObservationsUsed: result.waitObservationsUsed ?? 0,
    inputObservationsUsed: result.inputObservationsUsed ?? 0,
    fullTaskBinding: false,
  };
}
// Composition for a table of callees; options carry nativeId like every special-native oracle of the
// differential test. Also used by other small special natives (native-small-opcode.mjs).
export function nativeOpcodeComposition(callees) {
  return (options) => {
    const callee = callees[options.nativeId];
    if (!callee) return { handled: false, reason: 'task_native_callee_id_required' };
    const invalid = (callee.validate ?? validateTaskActionsOptions)(options);
    if (invalid) return invalid;
    return prepareTaskPlan(
      options,
      [0x80f390],
      (a) => runCalleeOpcode(callee, a, options, options.nativeId),
      callee.devices,
    );
  };
}
export const prepareTaskNativeOpcodeCombat = nativeOpcodeComposition(CALLEES);
export const COMBAT_NATIVE_IDS = Object.freeze(Object.keys(CALLEES).map(Number));
