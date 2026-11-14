import { getActorStateProperty } from './native-record-property-get.mjs';
import { addKarma } from './native-karma-add.mjs';
import { keepActorStateFlagBits } from './native-record-flags-and.mjs';
import { getActorStateCount } from './native-record-count-get.mjs';
import { addActorStateCount } from './native-record-count-add.mjs';
import { setObjectRecordFlagBits } from './native-object-record-flags-or.mjs';
import { resetObjectRecordProperty } from './native-object-record-property-reset.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import { turnObjectToPlayer } from './native-player-direction-slot.mjs';
import { keepObjectRecordFlagBits } from './native-object-record-flags-and.mjs';
import { endDialog } from './native-dialog-end.mjs';
import { learnSpell } from './native-spell-add.mjs';
import { markTopic } from './native-topic-mark.mjs';
import { placeObjectOnWaypoint } from './native-object-to-waypoint.mjs';
import { setActorStateFlags } from './native-record-flags-set.mjs';
import { releaseObjectGraphics } from './native-object-release-direct.mjs';
import { equipRunnerArmour } from './native-runner-armour-equip.mjs';
import { equipRunnerWeapon } from './native-runner-weapon-equip.mjs';
import { getActorStateFlags } from './native-record-flags-get.mjs';
import { addNuyen } from './native-nuyen-add.mjs';
// Individually pinned Native58 leaf equations; no ROM decoding or generic dispatch.
import { setObjectAnimation } from './native-object-action-apply.mjs';
import { getObjectCoarseY } from './native-object-position-y.mjs';
import { getObjectCoarseHeight } from './native-object-height.mjs';
import { clearObjectTask } from './native-object-task-clear.mjs';
import { bindObjectToCurrentTask } from './native-object-task-bind.mjs';
import { setObjectVelocity } from './native-object-velocity-set.mjs';
import { getObjectFlags } from './native-object-flags-get.mjs';
import { setObjectFlagBits } from './native-object-flags-or.mjs';
import { getScriptVariable } from './native-script-variable-get.mjs';
import { setScriptVariableBits } from './native-script-variable-or.mjs';
import { getObjectDirection } from './native-object-direction.mjs';
import { getObjectNumber } from './native-object-number.mjs';
import { getSpriteMode } from './native-sprite-mode-get.mjs';
import { setSpriteMode } from './native-sprite-mode-set.mjs';
import { setObjectActionAndDirection } from './native-object-turn.mjs';
import { changeScene } from './native-scene-change.mjs';
import { changeRoom } from './native-room-change.mjs';
import { removeObject } from './native-object-release.mjs';
import { createObject } from './native-object-create.mjs';
import { setSwarmPathPhaseTarget } from './native-swarm-path-phase-target.mjs';
import { setSwarmPathSpeedTarget } from './native-swarm-path-speed-target.mjs';
import { halveArgumentSigned } from './native-shift-right-signed.mjs';
import { setObjectDialog } from './native-object-dialog-set.mjs';
import { getPadHeld } from './native-pad-held.mjs';
import { getPadPressed } from './native-pad-pressed.mjs';
import { getPlayerObject } from './native-player-object.mjs';
import { getGloveScreenX } from './native-glove-screen-x.mjs';
import { getGloveScreenY } from './native-glove-screen-y.mjs';
import { startTimer } from './native-timer-start.mjs';
import { requestRoomReload } from './native-room-reload.mjs';
import { getObjectRecordFlags } from './native-object-record-flags.mjs';
import { keepScriptVariableBits } from './native-script-variable-and.mjs';
import { setSwarmHeightPhaseTarget } from './native-swarm-height-phase-target.mjs';
import { getObjectRecordFirstByte } from './native-object-record-byte0.mjs';
import { getObjectRecordCount } from './native-object-record-count.mjs';
import { getObjectRecordProperty } from './native-object-record-property.mjs';
import { setActorStateFlagBits } from './native-record-flags-or.mjs';
import { requestMainLoopExit } from './native-main-loop-exit.mjs';
import { setScriptVariable } from './native-script-variable-set.mjs';
import { addObjectArmour } from './native-object-armour-add.mjs';
import { setSwarmHeightSpeedTarget } from './native-swarm-height-speed-target.mjs';
import { getRoomHeader } from './native-room-entry.mjs';
import { resetSwarmPhases } from './native-swarm-phases-reset.mjs';
import { getActorKindValue } from './native-record-kind-attribute.mjs';
import { getActorKindFlags } from './native-record-kind-second-attribute.mjs';
import { getDistanceToPlayer } from './native-object-distance.mjs';
import { moveObjectToWaypoint } from './native-motion-waypoint-move.mjs';
import { getActorKind } from './native-record-kind-get.mjs';
import { moveObjectStraightToPlayer } from './native-motion-player-follow.mjs';
import { getObjectArmour } from './native-object-armour-get.mjs';
import { setObjectArmour } from './native-object-armour-set.mjs';
import { moveObjectStraightToObject } from './native-motion-object-follow.mjs';
import { getPlayerObjectCopy } from './native-player-object-second.mjs';
import { stopTimer } from './native-timer-stop.mjs';
import { keepObjectFlagBits } from './native-object-flags-and.mjs';
import { moveObjectStraightToPoint } from './native-motion-point-follow.mjs';
import { subtractObjectArmour } from './native-object-armour-subtract.mjs';
import { stopMotion } from './native-motion-stop.mjs';
import { setObjectFlags } from './native-object-flags-set.mjs';
import { getObjectKindValue } from './native-object-kind-attribute.mjs';
import { isActorStateProperty } from './native-record-property-equals.mjs';
import { getObjectVelocityX } from './native-object-velocity-x.mjs';
import { getObjectVelocityY } from './native-object-velocity-y.mjs';
import { getObjectVelocityZ } from './native-object-velocity-z.mjs';
import { updateObjectDepthMode } from './native-sprite-mode-from-flags.mjs';
import { clearObjectVelocity } from './native-object-velocity-clear.mjs';
import { getObjectCoarseX } from './native-object-position-x.mjs';
import { hasObjectRecordProperty } from './native-object-record-property-test.mjs';
import { setObjectRecordCount } from './native-object-record-count-set.mjs';
import { raiseStoryStage } from './native-story-stage-raise.mjs';
import { moveObjectStraightToWaypoint } from './native-motion-waypoint-follow.mjs';
import { setObjectRecordPropertyFromGroup } from './native-object-record-property-from-group.mjs';
import { isTopicKnown } from './native-topic-known.mjs';
import { setObjectRecordFlags } from './native-object-record-flags-set.mjs';
import { setObjectPosition } from './native-object-position-set.mjs';
import { enterMatrix } from './native-matrix-enter.mjs';
import { getCurrentRoomHeader } from './native-room-entry-current.mjs';
import { isTimerRunning } from './native-timer-running.mjs';
import { testObjectCollision } from './native-object-collision.mjs';
import { resetPlayerControl } from './native-player-control-reset.mjs';
import { addSceneObject } from './native-scene-object-add.mjs';
import { hasFightTarget } from './native-fight-list-any-active.mjs';
import { turnObjectToObject } from './native-object-face-object.mjs';
import { getDistanceBetweenObjects } from './native-object-distance-direct.mjs';
import { getStoryStage } from './native-story-stage-get.mjs';
import { getRunnerStrength } from './native-runner-record-byte.mjs';
import { limitCrosshair } from './native-glove-crosshair-limits.mjs';
import { limitSpellGlove } from './native-glove-spell-limits.mjs';
import { addMagicPoints } from './native-magic-points-add.mjs';
import { haltObject } from './native-object-halt-set.mjs';
import { resumeObject } from './native-object-halt-clear.mjs';
import { appendSelectedSpellTask } from './native-task-append-from-list.mjs';
import { getPlayerObjectAfterBreak } from './native-player-object-break.mjs';
import { addObjectHeight } from './native-object-height-add.mjs';
import { moveObjectToPlayer } from './native-motion-player-move.mjs';
import { raiseMemberMagicPoints } from './native-magic-points-raise.mjs';
import { setItemPropertyAndUnequip } from './native-object-record-property-equip.mjs';
import { bobObject } from './native-object-bob.mjs';
import { bobSecondObject } from './native-object-bob-offset.mjs';
import { advanceOrbitSlot1 } from './native-orbit-slot-1.mjs';
import { advanceOrbitSlot2 } from './native-orbit-slot-2.mjs';
import { advanceOrbitSlot3 } from './native-orbit-slot-3.mjs';
import { advanceOrbitSlot4 } from './native-orbit-slot-4.mjs';
import { advanceOrbitSlot5 } from './native-orbit-slot-5.mjs';
import { advanceOrbitSlot6 } from './native-orbit-slot-6.mjs';
import { advanceOrbitSlot7 } from './native-orbit-slot-7.mjs';
import { advanceOrbitSlot8 } from './native-orbit-slot-8.mjs';
import { decrementObjectStateCount } from './native-object-record-count-decrement.mjs';
import { removeGroupMember } from './native-group-remove.mjs';
import { startBrightnessFade } from './native-signed-offset-set.mjs';
import { placeObjectInFormation } from './native-formation-place.mjs';
import { setActorItemPropertyAndUnequip } from './native-record-property-equip.mjs';
import { hasNoObjectAnimation } from './native-object-selection-empty.mjs';
import { getGroupMemberPosition } from './native-group-member-position.mjs';
import { startSwarmOrbit } from './native-swarm-orbit-start.mjs';
import { moveSwarmAlongPath } from './native-swarm-follow-path.mjs';
import { moveSwarmWave } from './native-swarm-wave.mjs';
import { startPathSwarm } from './native-swarm-start.mjs';
import { startWaveSwarm } from './native-swarm-start-second.mjs';
import { circleSwarmLeader } from './native-swarm-circle-leader.mjs';
import { addTopic } from './native-topic-add.mjs';
import { getPreviousFightObject } from './native-fight-list-previous.mjs';
import { isInFightList } from './native-fight-list-contains.mjs';
import { moveObjectToPoint } from './native-motion-point-move.mjs';
import { moveObjectToObject } from './native-motion-object-move.mjs';
import { getDirectionToPlayer } from './native-player-direction.mjs';
const targets = new Map([
  [0x809d6a, setObjectRecordPropertyFromGroup],
  [0x809159, isTopicKnown],
  [0x80caa2, setObjectRecordFlags],
  [0x80d14a, setObjectPosition],
  [0x80e30f, enterMatrix],
  [0x80ccb9, getCurrentRoomHeader],
  [0x80e262, isTimerRunning],
  [0x808371, testObjectCollision],
  [0x80de7e, resetPlayerControl],
  [0x80a1e6, addSceneObject],
  [0x80866f, hasFightTarget],
  [0x80cf93, turnObjectToObject],
  [0x80c694, getDistanceBetweenObjects],
  [0x80d134, getStoryStage],
  [0x80d067, getRunnerStrength],
  [0x80bc83, limitCrosshair],
  [0x80bc9c, limitSpellGlove],
  [0x808b8a, addMagicPoints],
  [0x808e96, haltObject],
  [0x808eb8, resumeObject],
  [0x808eda, appendSelectedSpellTask],
  [0x80d186, getPlayerObjectAfterBreak],
  [0x80a977, addObjectHeight],
  [0x80c71d, moveObjectToPlayer],
  [0x80cf2e, raiseMemberMagicPoints],
  [0x809d15, setItemPropertyAndUnequip],
  [0x80d714, bobObject],
  [0x80d73b, bobSecondObject],
  [0x80d769, advanceOrbitSlot1],
  [0x80d76f, advanceOrbitSlot2],
  [0x80d775, advanceOrbitSlot3],
  [0x80d77b, advanceOrbitSlot4],
  [0x80d781, advanceOrbitSlot5],
  [0x80d787, advanceOrbitSlot6],
  [0x80d78d, advanceOrbitSlot7],
  [0x80d793, advanceOrbitSlot8],
  [0x809dc8, decrementObjectStateCount],
  [0x80a2b5, removeGroupMember],
  [0x80d9ad, startBrightnessFade],
  [0x80bb2c, placeObjectInFormation],
  [0x809ce4, setActorItemPropertyAndUnequip],
  [0x80bb90, hasNoObjectAnimation],
  [0x80a297, getGroupMemberPosition],
  [0x80d604, startSwarmOrbit],
  [0x80d85b, moveSwarmAlongPath],
  [0x80d2e7, moveSwarmWave],
  [0x80d7dd, startPathSwarm],
  [0x80d260, startWaveSwarm],
  [0x80d63c, circleSwarmLeader],
  [0x8090eb, addTopic],
  [0x808631, getPreviousFightObject],
  [0x808656, isInFightList],
  [0x80c7a1, moveObjectToPoint],
  [0x80c6f8, moveObjectToObject],
  [0x80d1dd, getDirectionToPlayer],
  [0x80c6bf, moveObjectStraightToWaypoint],
  [0x80cca4, raiseStoryStage],
  [0x809d98, hasObjectRecordProperty],
  [0x80a985, setObjectAnimation],
  [0x80e1b3, learnSpell],
  [0x80913c, markTopic],
  [0x80d105, placeObjectOnWaypoint],
  [0x80cb9f, setActorStateFlags],
  [0x80aa4c, releaseObjectGraphics],
  [0x808b16, equipRunnerArmour],
  [0x808b9f, equipRunnerWeapon],
  [0x80cb2b, getActorStateFlags],
  [0x80ccdb, addNuyen],
  [0x80cdb2, addKarma],
  [0x80cbcb, keepActorStateFlagBits],
  [0x80cc33, changeScene],
  [0x80cc97, changeRoom],
  [0x80a8f5, removeObject],
  [0x80a835, createObject],
  [0x80a963, getObjectCoarseY],
  [0x80a96d, getObjectCoarseHeight],
  [0x80a91d, clearObjectTask],
  [0x80a926, bindObjectToCurrentTask],
  [0x80a92f, setObjectVelocity],
  [0x80ca05, getObjectFlags],
  [0x80ca15, setObjectFlagBits],
  [0x80cc07, getScriptVariable],
  [0x80cc19, setScriptVariableBits],
  [0x80d255, getObjectDirection],
  [0x80d1ca, getObjectNumber],
  [0x80d17b, getSpriteMode],
  [0x80d16d, setSpriteMode],
  [0x80d15c, setObjectActionAndDirection],
  [0x80d985, setSwarmPathPhaseTarget],
  [0x80d98e, setSwarmPathSpeedTarget],
  [0x80d9a7, halveArgumentSigned],
  [0x8094ee, setObjectDialog],
  [0x809e59, getPadHeld],
  [0x809e5f, getPadPressed],
  [0x80cd97, getPlayerObject],
  [0x80c0f7, getGloveScreenX],
  [0x80c100, getGloveScreenY],
  [0x80e255, startTimer],
  [0x80d016, requestRoomReload],
  [0x80ca3a, getObjectRecordFlags],
  [0x80cc26, keepScriptVariableBits],
  [0x80d97c, setSwarmHeightPhaseTarget],
  [0x80ca2b, getObjectRecordFirstByte],
  [0x80ca49, getObjectRecordCount],
  [0x80ca58, getObjectRecordProperty],
  [0x80cbb3, setActorStateFlagBits],
  [0x80d9a0, requestMainLoopExit],
  [0x80cc10, setScriptVariable],
  [0x808afa, addObjectArmour],
  [0x80d997, setSwarmHeightSpeedTarget],
  [0x80cccc, getRoomHeader],
  [0x80d622, resetSwarmPhases],
  [0x80caf2, getActorKindValue],
  [0x80cb06, getActorKindFlags],
  [0x80c68d, getDistanceToPlayer],
  [0x80c6c4, moveObjectToWaypoint],
  [0x80d0fc, getActorKind],
  [0x80c716, moveObjectStraightToPlayer],
  [0x808ef5, getObjectArmour],
  [0x808af1, setObjectArmour],
  [0x80c6f3, moveObjectStraightToObject],
  [0x80d18a, getPlayerObjectCopy],
  [0x80e24e, stopTimer],
  [0x80ca20, keepObjectFlagBits],
  [0x80c79c, moveObjectStraightToPoint],
  [0x808b08, subtractObjectArmour],
  [0x80c7c2, stopMotion],
  [0x80ca0d, setObjectFlags],
  [0x80c9f1, getObjectKindValue],
  [0x809dae, isActorStateProperty],
  [0x80a941, getObjectVelocityX],
  [0x80a949, getObjectVelocityY],
  [0x80a951, getObjectVelocityZ],
  [0x80d0d3, updateObjectDepthMode],
  [0x80d13e, clearObjectVelocity],
  [0x80a959, getObjectCoarseX],
  [0x80cae0, setObjectRecordCount],
  [0x80cab4, setObjectRecordFlagBits],
  [0x809d7a, resetObjectRecordProperty],
  [0x80aaaf, setObjectDirection],
  [0x80d1d2, turnObjectToPlayer],
  [0x80caca, keepObjectRecordFlagBits],
  [0x80cdcf, endDialog],
  [0x80cb4d, getActorStateProperty],
  [0x80cb3c, getActorStateCount],
  [0x809dec, addActorStateCount],
]);
export const nativeTarget = (entry) => targets.get(entry);
export const nativeTargetEntries = Object.freeze([...targets.keys()]);
