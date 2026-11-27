// Names of scripts that other scripts start (docs/READABLE-GAME.md, phase 2), read by
// tools/decompile-scripts.mjs. A name says what the script does, as its code, texts and
// callers show it; a script without a clear purpose keeps its number (scriptNNN).
// Object kinds: 99 is "body", 9E "Nuyen" (the kind names of assets/vm-kinds.json).
export const SCRIPT_NAMES = Object.freeze({
  // Objects that leave something behind.
  0x068: 'leaveBody', // a body object where the object was; returns the body
  0x35d: 'leaveBodyAndResetRecord',
  0x1b4: 'dropNuyen15C', // a nuyen object (action 15C) at the object; returns it
  0x1ba: 'dropNuyen15E',
  0x1bc: 'dropNuyen15F',
  0x1c2: 'dropNuyen164',
  0x15e: 'findNuyen', // 30 to 60 nuyen at random, then the object goes
  // Waiting and moving.
  0x101: 'waitUntilDefeated', // record flag 80
  0x3a4: 'walkToWaypoint',
  0x10e: 'enterWithoutRunners', // the runners say they wait outside
  0x307: 'talkFacingPlayer',
  0x33d: 'nothing',
  // The group.
  0x35c: 'setLeaderOnly', // GROUP_LEADER_ONLY after two frames
  0x331: 'releaseRunner', // full stamina and magic, then out of the group
  0x011: 'giveWeapon', // offer a weapon to a runner ("Not strong enough.")
  0x321: 'giveArmour',
  0x03f: 'byNegotiation', // one of three values by Jake's Negotiation (0-2, 3-4, 5+)
  0x0b2: 'byNegotiationB', // the same code as byNegotiation
  // Prompts and notices.
  0x0f9: 'promptUseOn',
  0x240: 'promptGiveTo',
  0x1fb: 'promptThrowAt',
  0x253: 'promptTarget',
  0x085: 'refuseToUseOn', // "I'm not using it on HIM/HER/THAT!" by the actor kind
  0x1b1: 'refuseToGiveTo',
  0x0ff: 'refuseKeyOn', // "The key won't fit." or "I'm not using it on HIM/HER!"
  0x26d: 'noticeTooFarAway',
  0x38e: 'noticeNothingSpecial',
  0x31c: 'noticeTrashDataDiscarded',
  // Data, accounts and rewards.
  0x0d1: 'obtainDataFile', // Jake holds the file, or it is redundant
  0x0fe: 'obtainDataFilePart', // four parts make the file of obtainDataFile
  0x25b: 'transferAccount', // nuyen once per record flag
  0x28c: 'rewardNuyenAndKarma',
  // Places.
  0x0fc: 'activateElevator',
  0x2ce: 'modifySubLevelDoor',
  0x147: 'lockedDoor', // "Something sharp could open the lock."
  0x04c: 'lockedCabinet',
  0x345: 'sealedDoor', // "It's electronically sealed."
  0x2d5: 'icSecuredDoor', // "The door is secured by IC program."
  0x165: 'lightSwitch',
  0x206: 'usePhone', // ECOTEL
  0x2cd: 'buyCyberware',
  0x2e8: 'jackIntoMatrix',
  0x006: 'alwaysLockedDoor', // "This door is locked." on examine or open
  0x1dc: 'alwaysLockedDoorB', // the same with action 2
  0x342: 'examineDgcPanel', // until record flag 80
  0x08e: 'answerWithNotice', // the same notice each time Jake talks to the object
  0x0c8: 'offerForNuyen', // yes and paid: the dialog ends and the actor flag 80 is set
  0x118: 'offerArenaFight',
  // Fights.
  0x045: 'shootRandomTargets', // the given number of shots at random fight targets
  0x005: 'shootPlayerWhenNear', // while counting down, or until defeated
  0x0ac: 'walkAndShootPlayer', // to a waypoint, shooting at Jake when near
  0x360: 'fightAndDropNuyen', // script 2F7's fight, then a body and nuyen
  0x276: 'scatterGhoulBones',
  // Doors: open on the glove's Open, close on its Close, unless something stands in them.
  0x2a3: 'openDoorOnRequest',
  0x074: 'closeDoorOnRequest',
  0x36c: 'closeDoorWhenClear',
  0x0ad: 'closedDoor', // opens and closes for ever, starting closed
  0x2b5: 'closedDoorB',
  0x0e2: 'openDoor', // starting open
  0x2e7: 'openDoorB',
  // NPCs.
  0x06e: 'talkOrStrikeBack', // talks when Jake talks to it, strikes back when attacked (object flag 10)
  0x242: 'shootBackAtPlayer', // returns true when defeated meanwhile
  0x00c: 'castBackAtPlayer',
  0x1cd: 'runnerCastsSpell', // a hired runner's spell menu
  0x29f: 'runnerCastsSpellB',
  // Items.
  0x04b: 'playPickUpSound',
  0x2ab: 'awaitExamineOrPickUp', // or the action menu, when the first argument is not 0
  0x3a2: 'combineTimeBomb', // Detonator and Explosives become the Time Bomb
  0x312: 'scatterBubbles',
  // The ending: script variable 2C counts the scenes; each one ends in nextEndingScene.
  0x026: 'playEndingScene',
  0x08b: 'nextEndingScene', // the player's copy goes, 2C counts up, the next room
  0x137: 'endingScene1', // "WARNING: 20 Seconds until detonation."
  0x366: 'endingScene2',
  0x0bb: 'endingScene3',
  0x270: 'endingScene4',
  0x28b: 'endingScene5',
  0x374: 'endingScene6',
  0x02f: 'endingScene7',
  0x1c9: 'endingScene8',
  0x1e5: 'endingScene9',
  0x2ed: 'endingScene10',
  0x183: 'endingScene11',
  0x097: 'endingScene12', // "The Shadowrunners were..."
  0x1d1: 'endingScene13',
  // Fights: a round returns true when the fighter was defeated in it. Script variable
  // 2A counts the spawned fighters that are active.
  0x235: 'shootRound', // turn to the target and shoot
  0x221: 'shootOrCloseInRound', // shoot, then move closer to a far target
  0x28e: 'standAndShoot',
  0x04e: 'spawnedShooter', // counts itself in 2A while it fights
  0x07e: 'rollEnemySpawn', // a chance in ten, and fewer than four active
  0x076: 'chaseAndFight',
  0x2cf: 'spawnedChaser',
});
