// Scripts 060 to 07F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  EVENT,
  less,
  multiply,
  notEqualOrNegativeLeft,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 060: 1 argument.
export function* script060(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setScriptVariable(0x2a, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 061: 1 argument.
export function* script061(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waypointShooter(object, 2, 1, 4, 1);
  return null;
}

// Script 062: 1 argument.
export function* script062(state, arg0) {
  let count = 0,
    object = 0;
  block109: {
    count = arg0;
    state.menu.memberIndex = 0;
    if (
      ((yield* game.getObjectFlags(state.combat.aimTarget)) & 3) === 3 ||
      state.combat.aimTarget === state.room.player
    ) {
      if ((yield* game.spendMagic(word(4 + count))) !== 0) {
        object = state.combat.aimTarget & 0xff;
        count = multiply(count, 0x96);
        yield* game.playSoundEffect(object, 0x36, 0xff, 0xff);
        yield* game.setObjectFlagBits(object, 0x1000);
        for (;;) {
          yield* game.setObjectFlagBits(object, 0x80);
          yield* game.wait(EVENT.TIMER, 1);
          yield* game.keepObjectFlagBits(object, 0xff7f);
          yield* game.wait(EVENT.TIMER, 1);
          count = word(count - 1);
          if (count === 0) {
            yield* game.keepObjectFlagBits(object, 0xefff);
            break block109;
          }
        }
      }
    }
  }
  return null;
}

// Script 063: 1 argument.
export function* script063(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x280;
  for (;;) {
    yield* game.advanceOrbitSlot4(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 3, 0xb75);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 064: 1 argument.
export function* script064(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    block137: {
      yield* game.wait(EVENT.TIMER, 1);
      if (((yield* game.getActorStateFlags(0xde4 /* "Heavy Dude" */)) & 1) !== 0) {
        yield* game.keepObjectFlagBits(object, 0xdfff);
        yield* game.setObjectActionAndDirection(object, 0, 6);
        yield* game.setObjectRecordFlags(object, 1);
        yield* game.wait(EVENT.TIMER, 0x78);
        yield* game.setObjectAnimation(object, 4);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        count = 3;
        for (;;) {
          yield* game.setObjectAnimation(object, 5);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.playSoundEffect(object, 0xe, 0xff, 0xff);
          if (count === 0) {
            yield* game.setObjectAnimation(object, 6);
            yield* game.wait(EVENT.ANIMATION_END, 0);
            yield* game.setObjectAnimation(object, 1);
            yield* game.setObjectVelocity(object, 0xfffd, 0, 0);
            yield* game.wait(EVENT.TIMER, 0x78);
            break block137;
          }
          count = word(count - 1);
        }
      }
    }
    yield* game.removeObject(object);
    return null;
  }
  yield* game.resetObjectRecordProperty(object);
  return null;
}

// Script 065: 1 argument.
export function* script065(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, yield* game.randomBelow(7), 3);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 066: 1 argument.
export function* script066(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x172;
  for (;;) {
    yield* game.advanceOrbitSlot5(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 4, 0xb6e);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 067: 1 argument.
export function* script067(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 0);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.wait(EVENT.TIMER, 0x190);
  return null;
}

// Script 068: 1 argument, returns a word.
export function* leaveBody(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = yield* game.getObjectCoarseY(object);
  local1 = (yield* game.createObject(0x99 /* "body" */, object, t2, t1, 0x90)) & 0xff;
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.removeObject(object);
  yield* game.wait(EVENT.TIMER, 0xa);
  return local1;
}

// Script 069: 1 argument.
export function* script069(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x2da;
  for (;;) {
    yield* game.advanceOrbitSlot6(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 5, 0xb6e);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 06A: 1 argument.
export function* script06A(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x1cc;
  for (;;) {
    yield* game.advanceOrbitSlot7(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 6, 0xb6e);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 06B: 1 argument.
export function* script06B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.spawnedGunmanF(object, 2, 2, 3, 3, 0);
  return null;
}

// Script 06C: 1 argument.
export function* script06C(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    count = 0;
  function* sub5(in0) {
    local3 = in0;
    count = shiftRight(local3, 2);
    for (;;) {
      local1 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 4)) & EVENT.DEFEATED) !== 0) & 0xff;
      count = word(count - 1);
      if (less(yield* game.getDistanceBetweenObjects(object, signed(local2)), 0x14)) {
        yield* game.shootAtObject(object, signed(local2), 5, 5, 7, 2);
        count = 0;
      }
      if (
        (truth(count === 0) |
          signed(local1) |
          truth(((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x40) !== 0)) !==
        0
      ) {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  local1 = 0;
  yield* game.setObjectArmour(object, 3);
  yield* game.setObjectRecordCount(object, 0xf);
  yield* game.appendToFightList(object);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.setActorStateFlags(0x188 /* "Vampire!" */, 0);
  for (;;) {
    if (((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x40) === 0) {
      const t1 = yield* game.chooseEnemyTarget(object);
      local2 = t1 & 0xff;
      if (t1 !== 0xffff) {
        yield* game.setObjectFlagBits(object, 0x40);
        yield* game.setObjectAnimation(object, 2);
        yield* game.moveObjectStraightToObject(object, signed(local2));
        yield* sub5(word(((yield* game.randomByte()) & 0x7f) + 0x14));
        if (
          (truth(((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x40) !== 0) |
            signed(local1)) ===
          0
        ) {
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          yield* game.keepObjectFlagBits(object, 0xffbf);
          if (
            (truth((yield* game.getDistanceBetweenObjects(object, signed(local2))) > 0x28) &
              truth(((yield* game.randomByte()) & 1) !== 0)) !==
            0
          ) {
            yield* game.turnObjectToObject(object, signed(local2));
            yield* game.setObjectActionAndDirection(
              object,
              1,
              (yield* game.getObjectDirection(object)) & 0xfffe,
            );
            local1 =
              truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) &
              0xff;
            yield* game.createObject(0x65 /* "Ghoul" */, object, 0, 0, 0x34);
          }
        }
      }
      local1 =
        truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(((yield* game.randomByte()) & 0x3f) + 0xa),
          )) &
            EVENT.DEFEATED) !==
            0,
        ) & 0xff;
    } else {
      local1 = 255;
    }
    if (
      (signed(local1) |
        truth(((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x40) !== 0)) !==
      0
    ) {
      if (((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x40) === 0) {
        yield* run.scatterGhoulBones(object);
        yield* game.addKarma(5);
      }
      yield* game.fightListRemove(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 06D: 1 argument.
export function* script06D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectActionAndDirection(object, 0, 6);
  for (;;) {
    yield* game.wait(EVENT.TALK, 0);
    yield* game.talk(object, 0x2d);
    if ((yield* game.getActorStateFlags(0x46 /* "Wooden Door" */)) !== 0) {
      yield* game.notice(
        2,
        3,
        0x1e,
        4,
        0x400,
        0x1a7 /* "That door knob is a bit tricky sometimes. You'll need a litt..." */,
        0xc8,
      );
      for (;;) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.notice(7, 3, 0x11, 3, 0x400, 0x1a9 /* "It's open, go right in." */, 0xc8);
      }
    }
  }
}

// Script 06E: 5 arguments.
export function* talkOrStrikeBack(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    actor = 0,
    direction = 0,
    dialog = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    count = 0,
    events = 0;
  function* sub13() {
    if (local6 !== 0x600) {
      if (local6 !== 0x2000) {
        local10 = (yield* run.shootBackAtPlayer(object, 0x600)) & 0xff;
      } else {
        local10 = (yield* run.shootBackAtPlayer(object, 0)) & 0xff;
      }
    } else {
      local10 = (yield* run.castBackAtPlayer(object)) & 0xff;
    }
  }
  object = arg0 & 0xff;
  actor = arg1;
  direction = arg2 & 0xff;
  dialog = arg3;
  local6 = arg4;
  yield* game.setObjectActionAndDirection(object, 0, direction);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if ((yield* game.hasFightTarget()) === 0) {
      local8 = 0;
      loop81: for (;;) {
        events = yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.DEFEATED, 1);
        local8 = (truth((events & EVENT.TALK) !== 0) | signed(local8)) & 0xff;
        local10 = truth((events & EVENT.DEFEATED) !== 0) & 0xff;
        const t1 = truth(((yield* game.getObjectFlags(object)) & 0x10) !== 0);
        local9 = t1 & 0xff;
        if (((t1 ^ 0xffff) & (signed(local8) ^ 0xffff) & (signed(local10) ^ 0xffff)) !== 0) {
          yield* game.setObjectActionAndDirection(object, 0, direction);
        }
        if (
          ((truth(
            (yield* game.getObjectCoarseHeight(yield* game.getPlayerObject())) ===
              (yield* game.getObjectCoarseHeight(object)),
          ) &
            signed(local8)) |
            signed(local9) |
            signed(local10)) !==
          0
        ) {
          if ((signed(local9) | signed(local10)) === 0) {
            yield* game.setObjectAnimation(object, 0);
            local8 = 0;
            yield* game.turnObjectToPlayer(object);
            yield* game.wait(EVENT.TIMER, 0x14);
            yield* game.talk(object, dialog);
          } else {
            yield* sub13();
          }
          if (((yield* game.getActorStateFlags(actor)) & 0x80) !== 0) {
            state.party.leaderOnly = 0;
            return null;
          }
          count = 0x64;
          for (;;) {
            events = yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.DEFEATED, 1);
            local8 = truth((events & EVENT.TALK) !== 0) & 0xff;
            local10 = truth((events & EVENT.DEFEATED) !== 0) & 0xff;
            local9 = truth(((yield* game.getObjectFlags(object)) & 0x10) !== 0) & 0xff;
            count = word(count - 1);
            if ((signed(local8) | signed(local9) | signed(local10) | truth(count === 0)) !== 0) {
              if ((signed(local9) | signed(local10)) === 0) {
                if (signed(local8) === 0) {
                  yield* game.setObjectActionAndDirection(object, 0, direction);
                }
              } else {
                yield* sub13();
              }
              continue loop81;
            }
          }
        } else {
          if (signed(local8) !== 0) {
            yield* game.notice(2, 3, 0xc, 3, 0, 0 /* "Too far away." */, 0x78);
            local8 = 0;
          }
        }
      }
    }
  }
}

// Script 06F: 1 argument.
export function* script06F(state, arg0) {
  let actor = 0;
  actor = arg0;
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.setActorStateFlagBits(actor, 2);
  return null;
}

// Script 070: 1 argument.
export function* script070(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x334;
  for (;;) {
    yield* game.advanceOrbitSlot8(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 7, 0xb6e);
        yield* game.resetSwarmPhases();
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 071: 1 argument.
export function* script071(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectArmour(object, 1);
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.spawnedGunmanF(object, 3, 2, 3, 1, 0);
  return null;
}

// Script 072: 1 argument.
export function* script072(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) !== 0) {
    yield* run.ratShamanFight(shiftLeft(local0, 8) | 3, 0x303, 0x404);
  } else {
    yield* run.ratShamanFight(shiftLeft(local0, 8), 0x102, 0x304);
  }
  return null;
}

// Script 073: 1 argument.
export function* script073(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      3,
      0x15,
      0x1a,
      3,
      0x800,
      0x1df /* "On the paper is a code- ANEKI001." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 074: 5 arguments.
export function* closeDoorOnRequest(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    animation = 0,
    animation2 = 0,
    local3 = 0,
    effect = 0;
  object = arg0 & 0xff;
  animation = arg1 & 0xff;
  animation2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  effect = arg4 & 0xff;
  for (;;) {
    yield* game.setObjectAnimation(object, animation);
    yield* game.wait(EVENT.CLOSE, 0);
    yield* game.setObjectAnimation(object, animation2);
    yield* game.wait(EVENT.TIMER, 0xa);
    if ((yield* game.testObjectCollision(object, local3)) === 0) {
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.playSoundEffect(object, effect, 0xff, 3);
      return null;
    }
    yield* game.playSoundEffect(object, 0x20, 0xff, 3);
    yield* game.wait(EVENT.TIMER, 5);
  }
}

// Script 075: 1 argument.
export function* script075(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x24);
    yield* game.wait(EVENT.TIMER, 0x23);
    yield* game.appendToFightList(object);
    if ((yield* run.guardRoute(0x800 | object, 0x403, 0, 0x400, 0x501, 0x204, 0x201)) === 0) {
      yield* game.addKarma(0xd);
      yield* game.fightListRemove(object);
      yield* run.leaveBodyAndResetRecord(object);
      yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 1);
      yield* game.wait(EVENT.TIMER, 0x64);
    } else {
      yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 2);
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 076: 7 arguments, returns a word.
export function* chaseAndFight(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    frames = 0,
    local8 = 0,
    karma = 0,
    local10 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  frames = arg6;
  if ((yield* run.rollEnemySpawn(local1)) === 0) {
    return 0;
  }
  karma = shiftRight(local2, 4) & 0xff;
  local2 = local2 & 0xf & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, (yield* game.randomByte()) & 7);
  yield* game.wait(EVENT.TIMER, frames);
  for (;;) {
    yield* game.setObjectAnimation(object, 0);
    const t1 = yield* game.chooseEnemyTarget(object);
    local10 = t1 & 0xff;
    if (t1 !== 0xffff) {
      if (local1 !== 0) {
        yield* game.appendToFightList(object);
        local1 = 0;
      }
      local8 =
        (yield* run.shootRound(
          object,
          signed(local10),
          local2,
          local3,
          local4,
          signed(local5),
          frames,
        )) & 0xff;
      if (
        (truth((yield* game.getDistanceBetweenObjects(object, signed(local10))) > 0x64) &
          ((signed(local8) | truth(((yield* game.getObjectRecordFlags(object)) & 1) !== 0)) ^
            0xffff)) !==
        0
      ) {
        yield* game.setObjectAnimation(object, 2);
        yield* game.moveObjectToObject(object, signed(local10));
        local8 =
          truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) !== 0) &
          0xff;
        yield* game.stopMotion(object);
        yield* game.clearObjectVelocity(object);
      }
    } else {
      yield* game.turnObjectToObject(object, signed(local10));
      local8 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) !== 0) &
        0xff;
    }
    if (signed(local8) !== 0) {
      yield* game.addKarma(karma);
      yield* game.fightListRemove(object);
      return 0xffff;
    }
  }
}

// Script 077: 1 argument.
export function* script077(state, arg0) {
  let count = 0,
    local2 = 0;
  block119: {
    count = arg0;
    yield* game.endDialog();
    if ((yield* game.spendMagic(word(4 + count))) !== 0) {
      const t1 = yield* game.spellGloveTarget();
      local2 = t1 & 0xff;
      if (
        (truth(t1 === 0xffff) |
          truth(
            ((yield* game.getObjectFlags(signed(local2))) & 3) !== 3 &&
              notEqualOrNegativeLeft(signed(local2), state.room.player),
          )) ===
        0
      ) {
        count = multiply(count, 0x96);
        yield* game.playSoundEffect(signed(local2), 0x36, 0xff, 0xff);
        yield* game.setObjectFlagBits(signed(local2), 0x1000);
        for (;;) {
          yield* game.setObjectFlagBits(signed(local2), 0x80);
          yield* game.wait(EVENT.TIMER, 1);
          yield* game.keepObjectFlagBits(signed(local2), 0xff7f);
          yield* game.wait(EVENT.TIMER, 1);
          count = word(count - 1);
          if (count === 0) {
            yield* game.keepObjectFlagBits(signed(local2), 0xefff);
            break block119;
          }
        }
      } else {
        yield* game.addMagicPoints(word(4 + count));
      }
    }
  }
  return null;
}

// Script 078: 1 argument.
export function* script078(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
  }
}

// Script 079: 1 argument.
export function* script079(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x1d96)) & 0x80) === 0) {
    if ((yield* game.getObjectNumber(object)) === 0x1d96) {
      yield* game.setObjectRecordFlagBits(object, 0x80);
    }
    yield* game.setObjectActionAndDirection(object, 1, 5);
    yield* game.wait(EVENT.TIMER, 0x190);
  }
  yield* run.script031(object);
  return null;
}

// Script 07A: 4 arguments, returns a word.
export function* patrolAndShoot(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    local6 = 0,
    count = 0,
    text2 = 0,
    script = 0,
    local14 = 0,
    local16 = 0,
    object = 0,
    columns = 0;
  function* sub11() {
    if (!less(yield* game.getObjectRecordCount(object), 0xb)) {
      yield* game.setObjectAnimation(object, 2);
      if (local16 !== 0) {
        local16 = 0;
        yield* game.moveObjectStraightToWaypoint(object, local2 & 0xff);
      } else {
        local16 = 1;
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local2, 8));
      }
    } else {
      if (local16 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local16 = 255;
        if (text !== 0) {
          if (text !== 0x243) {
            if (text !== 0x244) {
              columns = 23;
            } else {
              columns = 22;
            }
          } else {
            columns = 20;
          }
          yield* game.notice(2, 5, columns, 3, 0x400, text, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.approachUntilInRange(object, 0x64, 0x3c, 0x32, 0xb, local16)) === 0) {
      const t1 = yield* game.chooseEnemyTarget(object);
      local14 = t1 & 0xff;
      if (t1 === 0xffff) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x3c)) & EVENT.DEFEATED) !== 0) {
          return 0xffff;
        }
      } else {
        block548: {
          if (
            (truth((yield* game.getDistanceBetweenObjects(object, signed(local14))) > 0x32) |
              truth(((yield* game.randomByte()) & 1) !== 0)) ===
            0
          ) {
            yield* game.setObjectAnimation(object, 4);
            yield* game.turnObjectToObject(object, signed(local14));
            if (
              ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
              0
            ) {
              count = 0;
              for (;;) {
                yield* game.setObjectAnimation(object, 5);
                yield* game.turnObjectToObject(object, signed(local14));
                if (
                  ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
                  0
                ) {
                  yield* game.playSoundEffect(object, 0xe, 0xff, 0xff);
                  yield* game.shootAtObject(object, signed(local14), 2, 0, local6 & 0xff, 1);
                  if (count === 3) {
                    yield* game.setObjectAnimation(object, 6);
                    if (
                      ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) &
                        EVENT.DEFEATED) ===
                      0
                    ) {
                      break block548;
                    }
                    return 0xffff;
                  }
                  count = word(count + 1);
                } else {
                  return 0xffff;
                }
              }
            } else {
              return 0xffff;
            }
          } else {
            yield* game.setObjectAnimation(object, 7);
            yield* game.turnObjectToObject(object, signed(local14));
            if (
              ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
              0
            ) {
              count = (yield* game.randomByte()) & 3;
              if (count !== 0) {
                if (count !== 1) {
                  if (count !== 2) {
                    text2 = 0x242;
                    columns = 16;
                  } else {
                    text2 = 0x241;
                    columns = 18;
                  }
                } else {
                  text2 = 0x240;
                  columns = 18;
                }
              } else {
                text2 = 0x23f;
                columns = 21;
              }
              yield* game.notice(4, word(columns - 0xf), columns, 3, 0x400, text2, 0x64);
              yield* game.setObjectAnimation(object, 8);
              count = 5;
              for (;;) {
                const t2 = yield* game.chooseEnemyTarget(object);
                local14 = t2 & 0xff;
                if (t2 !== 0xffff) {
                  yield* game.turnObjectToObject(object, signed(local14));
                }
                if (
                  ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END | EVENT.DEFEATED, 8)) &
                    EVENT.DEFEATED) ===
                  0
                ) {
                  if (count === 0) {
                    if (signed(local14) !== 0xffff) {
                      const t3 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
                      const t4 = yield* game.getObjectCoarseY(object);
                      const t5 = yield* game.getObjectCoarseX(object);
                      yield* game.createObject(0xdc, t5, t4, t3, script);
                    }
                    break block548;
                  }
                  count = word(count - 1);
                } else {
                  return 0xffff;
                }
              }
            } else {
              return 0xffff;
            }
          }
        }
      }
      if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) === 0) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  local0 = arg0;
  local2 = arg1;
  text = arg2;
  local6 = arg3;
  object = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.appendToFightList(object);
  if (((yield* game.getStoryStage()) & 0x20) === 0) {
    yield* game.setObjectArmour(object, 2);
    script = 0x2c4;
  } else {
    yield* game.setObjectArmour(object, 4);
    script = 0x160;
  }
  local16 = 0;
  for (;;) {
    if ((yield* sub11()) !== 0) {
      yield* game.addKarma(word((yield* game.randomBelow(shiftRight(local6, 8))) + 3));
      yield* game.fightListRemove(object);
      return yield* run.leaveBodyAndResetRecord(object);
    }
  }
}

// Script 07B: no arguments.
export function* script07B(state) {
  yield* run.offerForNuyen(0x3f0, 0x7d0, 0x195);
  return null;
}

// Script 07C: 1 argument.
export function* script07C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  state.menu.memberIndex = 0;
  yield* game.equipRunnerArmour(object, 0x23);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.removeObject(object);
  return null;
}

// Script 07D: 1 argument.
export function* script07D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x26);
  yield* game.removeObject(object);
  return null;
}

// Script 07E: 1 argument, returns a word.
export function* rollEnemySpawn(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (
    (truth(less(yield* game.randomBelow(0xa), local0)) &
      truth(less(yield* game.getScriptVariable(0x2a), 4))) ===
    0
  ) {
    return 0;
  }
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  return 0xffff;
}

// Script 07F: no arguments.
export function* script07F(state) {
  yield* game.setActorStateFlagBits(0xabf /* "Mage" */, 0x80);
  return null;
}
