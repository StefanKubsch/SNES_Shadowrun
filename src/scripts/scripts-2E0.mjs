// Scripts 2E0 to 2FF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 2E0: 1 argument.
export function* script2E0(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xb9f /* "Jamaican" */)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(object, 2, 5);
    for (;;) {
      yield* game.wait(EVENT.EXAMINE | EVENT.USE, 0);
      yield* game.notice(2, 2, 0x13, 3, 0x400, 0xa1 /* "The phone is being used!" */, 0xf0);
    }
  } else {
    yield* game.keepObjectRecordFlagBits(object, 0xff7f);
    yield* run.usePhone(object);
    return null;
  }
}

// Script 2E1: 1 argument.
export function* script2E1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.spawnedGunmanF(object, 4, 1, 0xf, 5, 0);
  return null;
}

// Script 2E2: 1 argument.
export function* script2E2(state, arg0) {
  let object = 0;
  block123: {
    object = arg0 & 0xff;
    yield* game.keepObjectFlagBits(object, 0xdfff);
    if (((yield* game.getObjectRecordFlags(object)) & 2) === 0) {
      if (
        ((yield* game.isTopicKnown(0x23 /* "Nirwanda" */)) |
          (yield* game.isTopicKnown(0x1c /* "Laughlyn" */))) !==
        0
      ) {
        block98: {
          yield* game.setObjectActionAndDirection(object, 0, 0);
          if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
            for (;;) {
              yield* game.wait(EVENT.TIMER, 6);
              if (less(yield* game.getDistanceToPlayer(object), 0x1e)) {
                yield* game.wait(EVENT.TALK, 0);
                yield* run.talkFacingPlayer(object, 0x2e);
                if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
                  break block98;
                }
              }
            }
          } else {
            yield* game.wait(EVENT.TALK, 0);
          }
        }
        for (;;) {
          yield* run.talkFacingPlayer(object, 0x2f);
          if (((yield* game.getObjectRecordFlags(object)) & 2) !== 0) {
            break block123;
          }
          yield* game.wait(EVENT.TALK, 0);
        }
      }
    } else {
      yield* game.resetObjectRecordProperty(object);
    }
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 2E3: 1 argument.
export function* script2E3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2E4: 1 argument.
export function* script2E4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x16);
  yield* game.setObjectActionAndDirection(object, 7, 3);
  for (;;) {
    yield* game.setObjectVelocity(object, 2, 0, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x1e);
    yield* game.clearObjectVelocity(object);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x64);
    yield* game.setObjectVelocity(object, 0xfffe, 0, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x1e);
    yield* game.clearObjectVelocity(object);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x64);
  }
}

// Script 2E5: 1 argument.
export function* script2E5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 1);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x34);
  for (;;) {
    yield* game.setObjectVelocity(object, 0xfffe, 0, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x64);
    yield* game.clearObjectVelocity(object);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0xff) + 0xa));
    yield* game.setObjectVelocity(object, 2, 0, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x64);
    yield* game.clearObjectVelocity(object);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0xff) + 0xa));
  }
}

// Script 2E6: 1 argument.
export function* script2E6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setObjectActionAndDirection(object, 1, 0);
  yield* game.setObjectVelocity(object, 0xfffc, 0, 8);
  yield* game.wait(EVENT.TIMER, 0xa);
  yield* game.removeObject(object);
  return null;
}

// Script 2E7: 1 argument.
export function* openDoorB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    yield* run.closeDoorOnRequest(object, 0, 6, 2, 0x2e);
    yield* run.openDoorOnRequest(object, 2, 4, 0, 0x2c, 0x2e);
  }
}

// Script 2E8: 5 arguments.
export function* jackIntoMatrix(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2;
  local4 = arg3 & 0xff;
  local5 = arg4 & 0xff;
  if (
    (truth((yield* game.getScriptVariable(0xc)) === 0x8b2) &
      truth((yield* game.getScriptVariable(0x16)) === 0)) ===
    0
  ) {
    yield* game.enterMatrix(local1, local2, local4, local5, yield* game.getScriptVariable(0xc));
  } else {
    state.screen.colourRequest = 1;
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = yield* game.getObjectCoarseY(object);
    const t3 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0xe6, t3, t2, t1, 0x99);
    yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
    yield* game.wait(EVENT.TIMER, 0xa);
    state.screen.colourRequest = 2;
    yield* game.enterMatrix(2, local2, 0, 0, 0x8b2);
  }
  return null;
}

// Script 2E9: no arguments.
export function* script2E9(state) {
  yield* run.offerForNuyen(0x1c0e, 0x64, 0x1a0);
  return null;
}

// Script 2EA: 1 argument.
export function* script2EA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x200 | local0, 0x100, 0, 0x804, 0xc06));
  return null;
}

// Script 2EB: 1 argument.
export function* script2EB(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x960);
  yield* game.setObjectAnimation(object, 1);
  yield* game.setObjectDialog(object, 0x46);
  local1 = 0;
  for (;;) {
    yield* game.placeObjectOnWaypoint(object, 4);
    yield* game.moveObjectToWaypoint(object, 5);
    if (
      ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
      0
    ) {
      yield* game.moveObjectToWaypoint(object, 6);
      if (
        ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
        0
      ) {
        yield* game.moveObjectToWaypoint(object, 7);
        if (
          ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
          0
        ) {
          yield* game.stopMotion(object);
          yield* game.wait(EVENT.TIMER, 0x4b0);
        } else {
          local1 = 255;
        }
      } else {
        local1 = 255;
      }
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.stopMotion(object);
      yield* run.leaveBodyAndResetRecord(object);
      return null;
    }
  }
}

// Script 2EC: 7 arguments, returns a word.
export function* guardRouteD(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0,
    local14 = 0,
    object = 0,
    local16 = 0,
    local17 = 0;
  function* sub17() {
    if (!less(yield* game.getObjectRecordCount(object), 0xf)) {
      yield* game.setObjectAnimation(object, 2);
      if (local14 !== 1) {
        if (local14 !== 3) {
          const t1 = yield* game.chooseEnemyTarget(object);
          local16 = t1 & 0xff;
          if (t1 === 0xffff) {
            yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
          } else {
            yield* game.moveObjectStraightToPlayer(object);
          }
        } else {
          yield* game.moveObjectStraightToWaypoint(object, local2 & 0xff);
        }
      } else {
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local2, 8));
      }
      local14 = word(local14 + 1) & 3 & 0xff;
    } else {
      if (local14 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local14 = 255;
        if (text !== 0) {
          yield* game.notice(2, 5, 0x18, 3, 0x400, text, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.approachUntilInRange(object, 0x64, 0x3c, 0x37, 0xf, local14)) === 0) {
      local17 = 0;
      for (;;) {
        local16 = (yield* game.chooseEnemyTarget(object)) & 0xff;
        if (!(less(yield* game.getDistanceToPlayer(object), 0x64) && signed(local16) !== 0xffff)) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(object, 4);
          yield* game.turnObjectToPlayer(object);
          if (
            ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
            0
          ) {
            yield* game.playSoundEffect(object, 0xe, 0xff, 0xff);
            yield* game.shootAtObject(
              object,
              yield* game.getPlayerObjectCopy(),
              shiftRight(local6, 8),
              local6 & 0xff,
              shiftRight(local8, 8),
              local8 & 0xff,
            );
            if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
              return 0xffff;
            }
          } else {
            return 0xffff;
          }
        }
        if (
          (truth(local17 === local10) |
            truth(less(yield* game.getObjectRecordCount(object), 0xf) && local14 !== 0xff)) !==
          0
        ) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) === 0) {
            return 0;
          }
          return 0xffff;
        }
        local17 = word(local17 + 1) & 0xff;
      }
    } else {
      return 0xffff;
    }
  }
  local0 = arg0;
  local2 = arg1;
  text = arg2;
  local6 = arg3;
  local8 = arg4;
  local10 = arg5;
  local12 = arg6;
  object = local0 & 0xff & 0xff;
  yield* game.setObjectDirection(object, 0);
  yield* game.setObjectAnimation(object, 2);
  local14 = 0;
  for (;;) {
    if ((yield* sub17()) !== 0) {
      if ((yield* game.getObjectRecordCount(object)) !== 0) {
        return 0xffff;
      }
      return 0;
    }
  }
}

// Script 2ED: 1 argument.
export function* endingScene10(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x1e);
  yield* game.notice(2, 2, 0x14, 3, 0x400, 0xf2 /* "Don't hurt us! Keep away." */, 0xf0);
  yield* game.wait(EVENT.TIMER, 0x5a);
  yield* run.walkToWaypoint(object, 0);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x64);
  yield* game.notice(4, 4, 0x1a, 3, 0x400, 0xf3 /* "We know nothing! We just work here!" */, 0xf0);
  yield* run.walkToWaypoint(object, 1);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0xdc);
  yield* run.nextEndingScene(0xb0);
  return null;
}

// Script 2EE: 1 argument.
export function* script2EE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0D2(object);
  return null;
}

// Script 2EF: 1 argument.
export function* script2EF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2F0: 1 argument.
export function* script2F0(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0);
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
        yield* run.combineTimeBomb();
      }
    } else {
      yield* game.notice(2, 0x14, 0x13, 3, 0x800, 0x203 /* "It has a 5 second delay." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 2F1: 1 argument.
export function* script2F1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.buyFromCase(object, 0x23, 0x64, 0x105a, 0xffff);
  return null;
}

// Script 2F2: 5 arguments.
export function* waypointShooter(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    waypoint = 0,
    events = 0,
    local9 = 0;
  function* sub13(in0) {
    waypoint = in0 & 0xff;
    for (;;) {
      const t1 = yield* game.chooseEnemyTarget(object);
      local9 = t1 & 0xff;
      if (t1 !== 0xffff) {
        yield* game.setObjectAnimation(object, 1);
        yield* game.moveObjectStraightToWaypoint(object, waypoint);
        events = yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, 0xa);
        local5 = truth((events & EVENT.DEFEATED) !== 0) & 0xff;
        yield* game.stopMotion(object);
        yield* game.clearObjectVelocity(object);
        if (signed(local5) === 0) {
          local5 =
            (yield* run.shootRound(object, signed(local9), local3, local4, 4, 0, 0xa)) & 0xff;
        }
      } else {
        yield* game.setObjectActionAndDirection(object, 0, 5);
        local5 =
          truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) &
          0xff;
      }
      if ((truth((events & EVENT.ARRIVED) !== 0) | signed(local5)) !== 0) {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0x1e);
  yield* game.setObjectRecordCount(object, 0x14);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x3c);
    if ((yield* game.chooseEnemyTarget(object)) !== 0xffff) {
      yield* game.appendToFightList(object);
      for (;;) {
        yield* sub13(local1);
        if (signed(local5) === 0) {
          yield* sub13(local2);
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(0xa);
          yield* game.fightListRemove(object);
          yield* game.setObjectDirection(object, 0);
          yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
          return null;
        }
      }
    }
  }
}

// Script 2F3: 1 argument.
export function* script2F3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.placeObjectOnWaypoint(object, 1);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0x2e4);
  yield* game.setObjectActionAndDirection(object, 0, 1);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.wait(EVENT.TIMER, 0x32);
  yield* game.removeObject(object);
  return null;
}

// Script 2F4: 1 argument.
export function* script2F4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x500 | local0, 0x600, 0, 0x804, 0xc06));
  return null;
}

// Script 2F5: 1 argument.
export function* script2F5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2F6: 1 argument.
export function* script2F6(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 5);
  yield* game.wait(EVENT.TIMER, 0x14);
  count = 0x4f6;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || (state.input.held & 0xf0f0) !== 0) {
      yield* game.markTopic(0x17 /* "HitMen" */);
      yield* game.markTopic(0x1f /* "Maria" */);
      yield* game.markTopic(0x1d /* "Lone Star" */);
      yield* game.markTopic(0x3b /* "The Cage" */);
      yield* game.markTopic(0x13 /* "Grinder" */);
      yield* game.markTopic(0x3d /* "Tickets" */);
      yield* game.markTopic(5 /* "Calls" */);
      yield* game.raiseStoryStage(2);
      yield* game.wait(EVENT.TIMER, 1);
      yield* game.changeRoom(0x158);
      yield* game.wait(EVENT.TIMER, 1);
      return null;
    }
  }
}

// Script 2F7: 5 arguments.
export function* chaseAndShoot(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    frames = 0,
    local6 = 0,
    local7 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  frames = arg4;
  yield* game.setObjectRecordCount(object, word(0x14 + ((yield* game.randomByte()) & 0xf)));
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.appendToFightList(object);
  local6 = 0;
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(object);
    local7 = t1 & 0xff;
    if (t1 !== 0xffff) {
      if (
        (truth(less(yield* game.getDistanceBetweenObjects(object, signed(local7)), 0x28)) &
          truth(
            (yield* game.getObjectCoarseHeight(object)) ===
              (yield* game.getObjectCoarseHeight(signed(local7))),
          )) ===
        0
      ) {
        yield* game.turnObjectToObject(object, signed(local7));
        if (signed(local6) === 0) {
          yield* game.setObjectAnimation(object, 5);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.setObjectAnimation(object, 7);
          local6 =
            truth(
              ((yield* game.wait(
                EVENT.TIMER | EVENT.DEFEATED,
                word(word(frames + 0x14) + ((yield* game.randomByte()) & 0x1f)),
              )) &
                EVENT.DEFEATED) !==
                0,
            ) & 0xff;
        }
        if (signed(local6) === 0) {
          yield* game.turnObjectToObject(object, signed(local7));
          yield* game.setObjectAnimation(object, 8);
          yield* game.playSoundEffect(object, 4, 0xff, 3);
          yield* game.createObject(0xbb, object, signed(local7), 0, 0x34b);
          yield* game.wait(EVENT.ANIMATION_END, 0);
        }
      } else {
        block188: {
          yield* game.setObjectAnimation(object, 2);
          yield* game.moveObjectStraightToObject(object, signed(local7));
          local6 =
            truth(
              ((yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, frames)) &
                EVENT.DEFEATED) !==
                0,
            ) & 0xff;
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          if (less(yield* game.getDistanceBetweenObjects(object, signed(local7)), 0xa)) {
            for (;;) {
              yield* game.setObjectAnimation(object, 4);
              yield* game.playSoundEffect(object, 6, 0xff, 3);
              yield* game.shootAtObject(object, signed(local7), local1, 4, local2, signed(local3));
              local6 =
                truth(
                  ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, frames)) & EVENT.DEFEATED) !== 0,
                ) & 0xff;
              if (
                (truth((yield* game.getDistanceBetweenObjects(object, signed(local7))) > 0xf) |
                  signed(local6)) !==
                0
              ) {
                break block188;
              }
            }
          }
        }
      }
    }
    yield* game.setObjectAnimation(object, 0);
    if (signed(local6) === 0) {
      local6 =
        truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(frames + ((yield* game.randomByte()) & 0x1f)),
          )) &
            EVENT.DEFEATED) !==
            0,
        ) & 0xff;
    }
    if (signed(local6) !== 0) {
      yield* game.addKarma(2);
      yield* game.fightListRemove(object);
      return null;
    }
  }
}

// Script 2F8: 3 arguments.
export function* script2F8(state, arg0, arg1, arg2) {
  let object = 0,
    value = 0,
    action = 0;
  object = arg0 & 0xff;
  value = arg1;
  action = arg2 & 0xff;
  yield* run.setLeaderOnly();
  yield* game.setObjectActionAndDirection(object, action, 5);
  yield* game.setObjectFlagBits(object, 0x80);
  for (;;) {
    yield* game.wait(EVENT.USE, 0);
    yield* game.setScriptVariable(6, value);
    yield* game.changeRoom(0x15b);
  }
}

// Script 2F9: no arguments.
export function* script2F9(state) {
  yield* game.notice(0xc, 2, 6, 3, 0, 0x22 /* "ADIOS!" */, 0x3c);
  yield* game.changeRoom(yield* game.getScriptVariable(0x1a));
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 2FA: 1 argument.
export function* script2FA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.standAndShoot(object);
  yield* game.talk(object, 0x35);
  yield* game.setActorStateFlagBits(0xbc2 /* "Iron Key" */, 0x80);
  yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
  return null;
}

// Script 2FB: 1 argument.
export function* script2FB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.chaseAndShoot(object, 2, 2, 1, 0x14);
  yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
  return null;
}

// Script 2FC: 1 argument.
export function* script2FC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x25);
  for (;;) {
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 6);
    if (((yield* game.getActorStateFlags(0xdd6 /* "Heavy Dude" */)) & 1) !== 0) {
      yield* game.notice(8, 3, 0xf, 3, 0x400, 0x1a3 /* "Here's the number." */, 0xb4);
      yield* game.learnSpell(0x55);
      yield* run.playPickUpSound();
      yield* game.keepActorStateFlagBits(0xdd6 /* "Heavy Dude" */, 0xfffe);
    }
  }
}

// Script 2FD: 1 argument.
export function* script2FD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x300 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2FE: 1 argument.
export function* script2FE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.patrolAndShootB(0x800 | local0, 0x109, 0, 0x804, 0xc06));
  return null;
}

// Script 2FF: 1 argument.
export function* script2FF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  for (;;) {
    yield* game.wait(EVENT.TALK, 0);
    yield* game.talk(object, 0x14);
  }
}
