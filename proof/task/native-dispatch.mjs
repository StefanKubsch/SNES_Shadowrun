import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { nativeTarget } from '../../src/task/native-targets.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import { raiseMemberMagicPointsReference } from '../game-reference/runner-state.mjs';
import {
  getObjectFlagsReference,
  keepObjectFlagBitsReference,
  setObjectFlagBitsReference,
  setObjectFlagsReference,
  getObjectRecordFirstByteReference,
  getObjectRecordFlagsReference,
  getObjectRecordCountReference,
  getObjectRecordPropertyReference,
  setObjectRecordFlagsReference,
  setObjectRecordFlagBitsReference,
  keepObjectRecordFlagBitsReference,
  setObjectRecordCountReference,
} from '../game-reference/object-fields.mjs';

import {
  getScriptVariableReference,
  setScriptVariableReference,
  setScriptVariableBitsReference,
  keepScriptVariableBitsReference,
} from '../game-reference/script-variables.mjs';

import {
  getActorStateFlagsReference,
  getActorStateCountReference,
  getActorStatePropertyReference,
  setActorStateFlagsReference,
  setActorStateFlagBitsReference,
  keepActorStateFlagBitsReference,
} from '../game-reference/actor-state.mjs';

import {
  getObjectArmourReference,
  setObjectArmourReference,
  addObjectArmourReference,
  subtractObjectArmourReference,
} from '../game-reference/object-fields.mjs';

import {
  getObjectVelocityXReference,
  getObjectVelocityYReference,
  getObjectVelocityZReference,
  getObjectCoarseXReference,
  getObjectCoarseYReference,
  getObjectCoarseHeightReference,
} from '../game-reference/object-fields.mjs';

import {
  getPadHeldReference,
  getPadPressedReference,
  getPlayerObjectReference,
  getPlayerObjectCopyReference,
  getGloveScreenXReference,
  getGloveScreenYReference,
} from '../game-reference/script-queries.mjs';

import {
  getObjectDirectionReference,
  getObjectNumberReference,
  getSpriteModeReference,
  setSpriteModeReference,
} from '../game-reference/object-fields.mjs';

import {
  bindObjectToCurrentTaskReference,
  clearObjectTaskReference,
  clearObjectVelocityReference,
  setObjectVelocityReference,
} from '../game-reference/object-fields.mjs';

import {
  isTimerRunningReference,
  startTimerReference,
  stopTimerReference,
} from '../game-reference/script-timer.mjs';

import {
  resetSwarmPhasesReference,
  setSwarmHeightPhaseTargetReference,
  setSwarmHeightSpeedTargetReference,
  setSwarmPathPhaseTargetReference,
  setSwarmPathSpeedTargetReference,
} from '../game-reference/swarm-setup.mjs';

import {
  getActorKindFlagsReference,
  getActorKindReference,
  getActorKindValueReference,
  getObjectKindValueReference,
} from '../game-reference/kind-values.mjs';

import {
  changeRoomReference,
  changeSceneReference,
  requestMainLoopExitReference,
  requestRoomReloadReference,
} from '../game-reference/script-requests.mjs';

import {
  getCurrentRoomHeaderReference,
  getRoomHeaderReference,
  getStoryStageReference,
  raiseStoryStageReference,
} from '../game-reference/room-story.mjs';

// Lifted natives whose proofs run their register-level references (the game runs the
// lifted ones, src/task/native-targets.mjs).
const REFERENCE_TARGETS = new Map([
  [0x80cf2e, raiseMemberMagicPointsReference],
  [0x80ca05, getObjectFlagsReference],
  [0x80ca0d, setObjectFlagsReference],
  [0x80ca15, setObjectFlagBitsReference],
  [0x80ca20, keepObjectFlagBitsReference],
  [0x80ca2b, getObjectRecordFirstByteReference],
  [0x80ca3a, getObjectRecordFlagsReference],
  [0x80ca49, getObjectRecordCountReference],
  [0x80ca58, getObjectRecordPropertyReference],
  [0x80caa2, setObjectRecordFlagsReference],
  [0x80cab4, setObjectRecordFlagBitsReference],
  [0x80caca, keepObjectRecordFlagBitsReference],
  [0x80cae0, setObjectRecordCountReference],
  [0x80cc07, getScriptVariableReference],
  [0x80cc10, setScriptVariableReference],
  [0x80cc19, setScriptVariableBitsReference],
  [0x80cc26, keepScriptVariableBitsReference],
  [0x80cb2b, getActorStateFlagsReference],
  [0x80cb3c, getActorStateCountReference],
  [0x80cb4d, getActorStatePropertyReference],
  [0x80cb9f, setActorStateFlagsReference],
  [0x80cbb3, setActorStateFlagBitsReference],
  [0x80cbcb, keepActorStateFlagBitsReference],
  [0x808ef5, getObjectArmourReference],
  [0x808af1, setObjectArmourReference],
  [0x808afa, addObjectArmourReference],
  [0x808b08, subtractObjectArmourReference],
  [0x80a941, getObjectVelocityXReference],
  [0x80a949, getObjectVelocityYReference],
  [0x80a951, getObjectVelocityZReference],
  [0x80a959, getObjectCoarseXReference],
  [0x80a963, getObjectCoarseYReference],
  [0x80a96d, getObjectCoarseHeightReference],
  [0x809e59, getPadHeldReference],
  [0x809e5f, getPadPressedReference],
  [0x80cd97, getPlayerObjectReference],
  [0x80d18a, getPlayerObjectCopyReference],
  [0x80c0f7, getGloveScreenXReference],
  [0x80c100, getGloveScreenYReference],
  [0x80d255, getObjectDirectionReference],
  [0x80d1ca, getObjectNumberReference],
  [0x80d17b, getSpriteModeReference],
  [0x80d16d, setSpriteModeReference],
  [0x80a91d, clearObjectTaskReference],
  [0x80a926, bindObjectToCurrentTaskReference],
  [0x80a92f, setObjectVelocityReference],
  [0x80d13e, clearObjectVelocityReference],
  [0x80e255, startTimerReference],
  [0x80e24e, stopTimerReference],
  [0x80e262, isTimerRunningReference],
  [0x80d97c, setSwarmHeightPhaseTargetReference],
  [0x80d985, setSwarmPathPhaseTargetReference],
  [0x80d98e, setSwarmPathSpeedTargetReference],
  [0x80d997, setSwarmHeightSpeedTargetReference],
  [0x80d622, resetSwarmPhasesReference],
  [0x80c9f1, getObjectKindValueReference],
  [0x80caf2, getActorKindValueReference],
  [0x80cb06, getActorKindFlagsReference],
  [0x80d0fc, getActorKindReference],
  [0x80cc97, changeRoomReference],
  [0x80cc33, changeSceneReference],
  [0x80d016, requestRoomReloadReference],
  [0x80d9a0, requestMainLoopExitReference],
  [0x80cccc, getRoomHeaderReference],
  [0x80ccb9, getCurrentRoomHeaderReference],
  [0x80d134, getStoryStageReference],
  [0x80cca4, raiseStoryStageReference],
]);

// A fixed, independently source-checked set of native equations. This is no
// opcode runner: unproved pointers never invoke an arbitrary function or ROM.
export function runTaskNativeDispatch(
  a,
  outerReturn = true,
  admittedTargets = null,
  expectedTarget = null,
) {
  const pointerWord = a.readWord(0xa2, 16, 'native-dispatch-fresh-pointer'),
    calleeEntry = 0x800000 | pointerWord;
  if (admittedTargets && !admittedTargets.includes(calleeEntry))
    taskStop('task_native_opcode_target_source_required', { calleeEntry });
  if (expectedTarget !== null && calleeEntry !== expectedTarget)
    taskStop('task_native_opcode_target_required', { calleeEntry, expectedTarget });
  const run = REFERENCE_TARGETS.get(calleeEntry) ?? nativeTarget(calleeEntry);
  if (!run) taskStop('task_native_target_source_required', { calleeEntry });
  a.ctx.pc = pointerWord;
  const result = run(a, outerReturn);
  return {
    ...result,
    pointerWord,
    calleeEntry,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
  };
}
export const prepareTaskNativeDispatch = (options) =>
  prepareTaskPlan(options, [0x80f52f], (a) => runTaskNativeDispatch(a));

// Bridge, fresh target, actual leaf RTS and original resume share one overlay,
// one ledger and one final commit. Internal F508 bytes are freshly read and
// must return to F509 before the source-checked continuation can be applied.
export function runTaskNativeCall(
  a,
  protectedStackBytes,
  admittedTargets = null,
  expectedTarget = null,
) {
  const bridge = runTaskNativeBridge(a, protectedStackBytes),
    dispatch = runTaskNativeDispatch(a, false, admittedTargets, expectedTarget);
  if (dispatch.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: dispatch.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, protectedStackBytes);
  return {
    ...resume,
    calleeEntry: dispatch.calleeEntry,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: dispatch.pointerWord,
    calleeReturnWord: dispatch.rawReturnWord,
    calleeReturnTarget: dispatch.returnTarget,
    boundedNativeDispatchExecuted: true,
    calleeReturnTargetExecuted: true,
    scope: 'manual-source-bound-bridge-leaf-resume-before-F390',
    fullTaskBinding: false,
  };
}
export const prepareTaskNativeCall = (options) =>
  prepareTaskPlan(options, [0x80f4f6], (a) => runTaskNativeCall(a, options.protectedStackBytes));
