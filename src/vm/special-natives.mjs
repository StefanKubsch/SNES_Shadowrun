// Script natives for the lag-free game. Recorded observation replays use
// proof/vm/special-natives.mjs and its register-level forms.
import {
  liftedFightListRemoveSequence,
  liftedConfirmKeySequence,
  liftedChooseUnderGloveSequence,
  liftedChooseNumberSequence,
  liftedScriptChooseNumberSequence,
  liftedScriptChooseObjectSequence,
  liftedSpellGloveTargetSequence,
  liftedChoosePlaceSequence,
  liftedNoticeSequence,
  liftedReleaseGloveSequence,
  liftedSpendMagicSequence,
  liftedQuestionSequence,
  liftedScriptActionSequence,
  liftedTopicTextSequence,
  liftedWindowTextSequence,
  liftedTalkSequence,
  liftedShootAtObjectSequence,
  liftedShootAtGloveTargetSequence,
  liftedShootWithOwnWeaponSequence,
  liftedBlastSequence,
  liftedSpellChoiceSequence,
  liftedSpellMenuSequence,
  liftedPlayerControlSequence,
  liftedStatusScreenSequence,
  liftedMainMenuSequence,
} from '../game/main-upkeep.mjs';
import { redrawDialogWindowListSequence } from '../game/window-list.mjs';
import { releaseNoticeWindowsCallSequence } from '../game/window-release.mjs';
import {
  appendToFightListNative,
  panSongLevelToObject,
  playSoundEffectNative,
  randomBelowNative,
  randomByteNative,
  moveObjectTowardsObject,
  jumpObjectTowardsObject,
  jumpObjectTowardsPoint,
  chooseEnemyTargetNative,
  payNuyenNative,
  faceRoomDirectionNative,
  setActorStateHolderNative,
  findNearestVisibleMemberNative,
  chooseRandomFightTargetNative,
  canAttackNative,
} from '../script/native-script-leaves.mjs';
import {
  SequenceRunner,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../system/sequence-runner.mjs';
import { lagFree } from './frame-events.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { raiseStateCountSequence, restoreRunnersSequence } from '../game/runner-state-call.mjs';

// Keep synchronous and pausing calls on the same lifted sequence. Replays cannot
// silently fall back to a register-level native in the shipped game.
function nativeSequence(a, options, sequence) {
  const events = {
    mode: 'record-observations',
    values: options?.waitObservations,
    waitIndex: 0,
    calls: [],
    waitEvents: [],
    inputMode: 'record-observations',
    inputs: options?.inputObservations,
    inputIndex: 0,
    ...options?.interruptEvents,
    headVisit: options?.headVisit,
    nestedHeadVisit: options?.nestedHeadVisit,
    valueRounds: options?.valueRounds,
  };
  if (!lagFree(events)) taskStop('script_native_lag_free_required');
  if (!events.frameJobs) taskStop('script_native_frame_jobs_required');
  // The natives take game services and return values; no CPU frame.
  return sequence({ a }, events, false);
}
export const SPECIAL_NATIVES = new Map();
export const SPECIAL_NATIVE_CONTINUATIONS = new Map();
for (const [target, sequence] of [
  [0x80fec1, liftedNoticeSequence],
  [0x80ff79, releaseNoticeWindowsCallSequence],
  [0x80f953, liftedConfirmKeySequence],
  [0x809ba0, liftedScriptActionSequence],
  [0x808e36, liftedBlastSequence],
  [0x80933a, liftedTopicTextSequence],
  [0x80935b, liftedWindowTextSequence],
  [0x80cd43, liftedQuestionSequence],
  [0x80cda8, redrawDialogWindowListSequence],
  [0x808ab5, liftedShootAtObjectSequence],
  [0x808a51, liftedShootAtGloveTargetSequence],
  [0x808a8c, liftedShootWithOwnWeaponSequence],
  [0x80855e, liftedFightListRemoveSequence],
  [0x80936c, liftedTalkSequence],
  [0x809bc6, liftedChooseNumberSequence],
  [0x80e1cf, liftedSpellChoiceSequence],
  [0x80cd9d, liftedReleaseGloveSequence],
  [0x80cecb, raiseStateCountSequence],
  [0x80e014, liftedPlayerControlSequence],
  [0x80ce6d, liftedMainMenuSequence],
  [0x80ea6e, liftedStatusScreenSequence],
  [0x80c724, liftedChoosePlaceSequence],
  [0x80d079, restoreRunnersSequence],
  [0x80f254, liftedSpellMenuSequence],
  [0x809bd3, liftedSpellGloveTargetSequence],
  [0x809c33, liftedScriptChooseObjectSequence],
  [0x809bb9, liftedScriptChooseNumberSequence],
  [0x808d0b, liftedChooseUnderGloveSequence],
  [0x808b43, liftedSpendMagicSequence],
]) {
  SPECIAL_NATIVES.set(target, (a, options) =>
    drainNativeSequence(nativeSequence(a, options, sequence)),
  );
  SPECIAL_NATIVE_CONTINUATIONS.set(target, (a, options) => {
    const continuation = new SequenceRunner(
      nativeSequence(a, options, sequence),
      NATIVE_CALL_CONTINUATIONS,
    );
    return { continuation, finish: () => continuation.result };
  });
}
export const DEVICE_NATIVE_LEAVES = new Map([
  [0x80c46e, playSoundEffectNative],
  [0x80c51f, randomBelowNative],
  [0x80c560, randomByteNative],
  [0x80bba0, faceRoomDirectionNative],
  [0x80cbf7, setActorStateHolderNative],
  [0x80cd20, payNuyenNative],
  [0x808bc5, chooseEnemyTargetNative],
  [0x808521, appendToFightListNative],
  [0x80c461, panSongLevelToObject],
  [0x808c08, findNearestVisibleMemberNative],
  [0x808c8d, chooseRandomFightTargetNative],
  [0x808ccf, canAttackNative],
  [0x808d7f, moveObjectTowardsObject],
  [0x808d3f, jumpObjectTowardsObject],
  [0x808d4e, jumpObjectTowardsPoint],
]);
for (const [target, run] of DEVICE_NATIVE_LEAVES) SPECIAL_NATIVES.set(target, (a) => run(a, false));
