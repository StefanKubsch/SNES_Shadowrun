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
  0x08b: 'goToRoom', // the player's copy goes, script variable 2C counts up
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
});
