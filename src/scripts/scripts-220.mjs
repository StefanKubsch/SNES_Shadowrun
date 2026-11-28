// Scripts 220 to 23F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 220: 1 argument.
export function* script220(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.spawnedGunman(object, 0, 2, 0x14, 3, 1, 5);
  return null;
}

// Script 221: 1 argument, returns a word.
export function* shootOrCloseInRound(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.chooseEnemyTarget(object);
  local1 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.setObjectAnimation(object, 5);
    yield* game.playSoundEffect(object, 0xc, 0xff, 3);
    yield* game.shootAtObject(object, signed(local1), 2, 0, 4, 0);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.setObjectAnimation(object, 6);
    local2 =
      truth(
        ((yield* game.wait(
          EVENT.TIMER | EVENT.DEFEATED,
          word(((yield* game.randomByte()) & 0xf) + 0x14),
        )) &
          EVENT.DEFEATED) !==
          0,
      ) & 0xff;
    if (
      (truth((yield* game.getDistanceBetweenObjects(object, signed(local1))) > 0x3c) &
        (signed(local2) ^ 0xffff)) !==
      0
    ) {
      yield* game.moveObjectToObject(object, signed(local1));
      yield* game.setObjectAnimation(object, 1);
      local2 =
        truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(((yield* game.randomByte()) & 0xf) + 1),
          )) &
            EVENT.DEFEATED) !==
            0,
        ) & 0xff;
      yield* game.stopMotion(object);
      yield* game.clearObjectVelocity(object);
    }
  } else {
    yield* game.setObjectAnimation(object, 0);
    yield* game.turnObjectToObject(object, signed(local1));
    local2 =
      truth(
        ((yield* game.wait(
          EVENT.TIMER | EVENT.DEFEATED,
          word(0x28 + ((yield* game.randomByte()) & 0x1f)),
        )) &
          EVENT.DEFEATED) !==
          0,
      ) & 0xff;
  }
  return signed(local2);
}

// Script 222: 1 argument.
export function* script222(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    waypoint = 0,
    local6 = 0,
    waypoint2 = 0;
  function* sub5(in0, in1) {
    local6 = in0 & 0xff;
    waypoint2 = in1 & 0xff;
    yield* game.placeObjectOnWaypoint(object, waypoint);
    yield* game.setObjectAnimation(object, 1);
    yield* game.moveObjectToWaypoint(object, waypoint2);
    local4 =
      (truth(
        ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) !== 0,
      ) ^
        0xffff) &
      0xff;
    waypoint = waypoint2 & 0xff;
    local3 = signed(local6) & 0xff;
  }
  function sub47(in0, in1) {
    local6 = in0 & 0xff;
    waypoint2 = in1 & 0xff;
    if (signed(local3) === 0) {
      return waypoint2;
    }
    return local6;
  }
  object = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectDialog(object, 0x57);
  } else {
    yield* game.setObjectDialog(object, 0x54);
  }
  loop84: for (;;) {
    local4 = 255;
    yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 0x1ff) + 0xa));
    local1 = (yield* game.randomByte()) & 3;
    local3 = 255;
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          waypoint = 6;
        } else {
          waypoint = 4;
        }
      } else {
        waypoint = 3;
      }
    } else {
      waypoint = 0;
    }
    for (;;) {
      if (waypoint !== 0) {
        if (waypoint !== 1) {
          if (waypoint !== 2) {
            if (waypoint !== 3) {
              if (waypoint !== 4) {
                if (waypoint !== 5) {
                  if (waypoint === 6) {
                    yield* sub5(0, 5);
                  }
                } else {
                  yield* sub5(signed(local3), sub47(6, 4));
                }
              } else {
                yield* sub5(0xffff, 5);
              }
            } else {
              yield* sub5(0xffff, 2);
            }
          } else {
            yield* sub5(signed(local3), sub47(1, 3));
          }
        } else {
          yield* sub5(signed(local3), sub47(0, 2));
        }
      } else {
        yield* sub5(0, 1);
      }
      if ((truth(waypoint === 1 || waypoint === 2 || waypoint === 5) & signed(local4)) === 0) {
        yield* game.releaseObjectGraphics(object);
        if (signed(local4) !== 0) {
          continue loop84;
        }
        yield* run.leaveBodyAndResetRecord(object);
        return null;
      }
    }
  }
}

// Script 223: no arguments.
export function* script223(state) {
  let local0 = 0,
    local2 = 0;
  local2 = yield* game.getScriptVariable(0x22);
  if (local2 !== 3) {
    if (local2 !== 4) {
      if (local2 !== 5) {
        if (local2 !== 6) {
          if (local2 === 7) {
            local0 = 0x179;
          }
        } else {
          local0 = 0x173;
        }
      } else {
        local0 = 0x16c;
      }
    } else {
      local0 = 0x165;
    }
  } else {
    local0 = 0x1ce;
  }
  yield* game.setActorStateFlags(0x16c0 /* "Computer" */, 0);
  yield* game.changeScene(4, word(local2 - 1), local0);
  return null;
}

// Script 224: 1 argument.
export function* script224(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectActionAndDirection(object, 0, 7);
  yield* game.wait(EVENT.TIMER, 0x122);
  yield* game.setObjectDirection(object, 3);
  yield* game.wait(EVENT.TIMER, 0x78);
  yield* game.setObjectDirection(object, 7);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 225: 1 argument.
export function* script225(state, arg0) {
  let object = 0,
    action = 0;
  object = arg0 & 0xff;
  const t1 = word(((yield* game.randomByte()) & 3) + 5);
  action = t1 & 0xff;
  yield* game.setObjectRecordCount(object, t1);
  yield* game.setObjectActionAndDirection(object, action, 5);
  yield* game.appendToFightList(object);
  for (;;) {
    yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e);
    if (less(yield* game.getDistanceToPlayer(object), 0x32)) {
      yield* game.createObject(0x54 /* "Bubbles" */, object, 0x1e, 0, 0x16f);
      const t2 = yield* game.getObjectRecordCount(object);
      action = t2 & 0xff;
      if (less(t2, 2)) {
        yield* game.fightListRemove(object);
        yield* game.clearObjectTask(object);
        return null;
      }
      yield* game.setObjectAnimation(object, action);
    }
  }
}

// Script 226: 1 argument.
export function* script226(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    actor = 0;
  block143: {
    object = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0xdc1 /* "Heavy Dude" */)) & 0x40) !== 0) {
      if ((yield* game.hasObjectRecordProperty(object)) === 0) {
        yield* game.setObjectActionAndDirection(object, 0, 5);
      }
      for (;;) {
        local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
        local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x100);
        if (local2 !== 0x80) {
          if (local2 !== 0x10) {
            if (local2 === 0x100) {
              yield* run.promptUseOn();
              actor = yield* game.chooseNumber();
              if (actor !== 0xffff) {
                if (actor !== 0x18fe) {
                  yield* run.refuseKeyOn(actor);
                } else {
                  yield* game.endDialog();
                  yield* game.setActorStateFlagBits(actor, 1);
                }
              }
            }
          } else {
            yield* game.setObjectRecordPropertyFromGroup(object);
            yield* run.playPickUpSound();
            local1 = 255;
          }
        } else {
          yield* game.notice(
            6,
            0x15,
            0x14,
            3,
            0x800,
            0x1be /* "It's a strange looking key." */,
            0xf0,
          );
        }
        if (signed(local1) !== 0) {
          break block143;
        }
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 227: 1 argument.
export function* script227(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    yield* run.talkFacingPlayer(object, 0x37);
    yield* game.wait(EVENT.TIMER, 0x1e);
    yield* game.setObjectRecordCount(object, 0x14);
    yield* game.moveObjectStraightToWaypoint(object, 2);
    yield* game.setObjectAnimation(object, 1);
    yield* game.wait(EVENT.ARRIVED, 0);
  }
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* game.setObjectAnimation(object, 0);
  yield* game.appendToFightList(object);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(object);
    local2 = t1 & 0xff;
    if ((yield* game.getDistanceBetweenObjects(object, t1)) <= 0x50) {
      local1 = (yield* run.shootRound(object, signed(local2), 3, 0, 2, 1, 0x1e)) & 0xff;
    } else {
      yield* game.turnObjectToObject(object, signed(local2));
      local1 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(5);
      yield* game.fightListRemove(object);
      yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
      return null;
    }
  }
}

// Script 228: 1 argument.
export function* script228(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block133: {
    object = arg0 & 0xff;
    if (
      ((yield* game.isTopicKnown(0x23 /* "Nirwanda" */)) |
        (yield* game.isTopicKnown(0x1c /* "Laughlyn" */))) ===
      0
    ) {
      yield* game.clearObjectTask(object);
    } else {
      yield* game.setObjectRecordCount(object, 0x28);
      yield* game.setObjectArmour(object, 3);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.TIMER, word(0x3c + ((yield* game.randomByte()) & 0x1f)));
      local1 = 0;
      yield* game.appendToFightList(object);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* run.shootRound(object, signed(local2), 4, 0, 6, 1, 0x1e)) & 0xff;
        } else {
          yield* game.turnObjectToObject(object, signed(local2));
          local1 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) &
            0xff;
        }
        if (signed(local1) !== 0) {
          yield* game.setActorStateFlagBits(0x13a2 /* "Explosives" */, 0x40);
          yield* game.addKarma(3);
          yield* game.fightListRemove(object);
          yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
          break block133;
        }
      }
    }
  }
  return null;
}

// Script 229: 1 argument.
export function* script229(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(EVENT.TIMER, 0x145);
  yield* game.notice(
    0xe,
    5,
    0x13,
    4,
    0x400,
    0xf1 /* "Remember what happened last time you said that!" */,
    0xb4,
  );
  yield* game.wait(EVENT.TIMER, 0xc8);
  yield* game.turnObjectToPlayer(object);
  return null;
}

// Script 22A: no arguments.
export function* script22A(state) {
  yield* game.setActorStateFlagBits(0xb83 /* "Jester Spirit" */, 0x80);
  yield* game.endDialog();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(4, 4, 0x18, 3, 0x400, 0x110 /* "No! No, don't say it! Aiiiieeeee..." */, 0xf0);
  return null;
}

// Script 22B: 1 argument.
export function* script22B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseX(object);
  const t2 = yield* game.getObjectCoarseY(object);
  yield* run.spawnedGunmanD(object, t2, t1, 0xffff, 5, 0x14);
  return null;
}

// Script 22C: 1 argument.
export function* script22C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.hiredRunner(object, 4, 0x2a, 0x77, 0);
  return null;
}

// Script 22D: 1 argument.
export function* script22D(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (
      (truth(less(yield* game.getDistanceToPlayer(object), 0x14)) |
        (truth(((yield* game.getActorStateFlags(0x292 /* "Switch" */)) & 1) !== 0) &
          (truth(((yield* game.getActorStateFlags(0x284 /* "Switch" */)) & 1) !== 0) ^ 0xffff))) !==
      0
    ) {
      yield* game.setObjectActionAndDirection(object, 0, 0);
      yield* game.wait(EVENT.TIMER, word((yield* game.randomBelow(6)) + 0xa));
      const t1 = yield* game.getObjectCoarseHeight(object);
      const t2 = yield* game.getObjectCoarseY(object);
      const t3 = yield* game.getObjectCoarseX(object);
      local1 = (yield* game.createObject(0xb8, t3, t2, t1, 0x382)) & 0xff;
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      yield* game.blast(local1, 0x14);
      return null;
    }
  }
}

// Script 22E: 1 argument.
export function* script22E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script31F(object, 0);
  return null;
}

// Script 22F: 1 argument.
export function* script22F(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0;
  function sub16() {
    if (local2 !== 0) {
      if (local2 !== 1) {
        if (local2 !== 2) {
          return local8;
        }
        return local7;
      }
      return local6;
    }
    return local5;
  }
  function* sub5(in0, in1, in2, in3) {
    local5 = in0 & 0xff;
    local6 = in1 & 0xff;
    local7 = in2 & 0xff;
    local8 = in3 & 0xff;
    yield* game.setObjectActionAndDirection(object, 0, 5);
    if (
      ((yield* game.wait(
        EVENT.TIMER | EVENT.TALK | EVENT.DEFEATED,
        word(((yield* game.randomByte()) & 0x7f) + 1),
      )) &
        EVENT.DEFEATED) ===
      0
    ) {
      if (
        ((yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.DEFEATED, 0x3c)) & EVENT.DEFEATED) ===
        0
      ) {
        yield* game.setObjectAnimation(object, 1);
        const t1 = sub16();
        local1 = t1 & 0xff;
        yield* game.moveObjectToWaypoint(object, t1);
        if (
          ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) !==
          0
        ) {
          local4 = 255;
        }
      } else {
        local4 = 255;
      }
    } else {
      local4 = 255;
    }
  }
  object = arg0 & 0xff;
  local1 = 255;
  local4 = 0;
  for (;;) {
    local2 = (yield* game.randomByte()) & 3;
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          if (local1 !== 3) {
            if (local1 !== 4) {
              if (local1 !== 5) {
                if (local1 !== 6) {
                  if (local1 !== 8) {
                    if (local1 !== 7) {
                      yield* sub5(0, 1, 4, 2);
                    } else {
                      yield* sub5(8, 0, 5, 6);
                    }
                  } else {
                    yield* sub5(7, 0, 5, 6);
                  }
                } else {
                  yield* sub5(5, 4, 3, 2);
                }
              } else {
                yield* sub5(8, 7, 6, 4);
              }
            } else {
              yield* sub5(5, 8, 3, 2);
            }
          } else {
            yield* sub5(2, 4, 6, 5);
          }
        } else {
          yield* sub5(1, 3, 6, 4);
        }
      } else {
        yield* sub5(0, 8, 6, 3);
      }
    } else {
      yield* sub5(8, 8, 5, 5);
    }
    if (signed(local4) !== 0) {
      return null;
    }
  }
}

// Script 230: 1 argument.
export function* script230(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(EVENT.TIMER, 0x1e);
  for (;;) {
    block56: {
      yield* game.moveObjectToWaypoint(object, 0);
      const t1 = yield* run.shootPlayerWhenNear(object, 0x3c);
      local1 = t1 & 0xff;
      if (t1 === 0) {
        for (;;) {
          const t2 = truth(
            ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 2)) & EVENT.DEFEATED) !== 0,
          );
          local1 = t2 & 0xff;
          if ((t2 | truth(less(yield* game.getDistanceToPlayer(object), 0x64))) !== 0) {
            break block56;
          }
        }
      }
    }
    yield* game.moveObjectStraightToPlayer(object);
    if (signed(local1) === 0) {
      local1 = (yield* run.shootPlayerWhenNear(object, 0x1c)) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 231: 1 argument.
export function* script231(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (less(yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()), 0x15e)) {
      local1 = 0;
      for (;;) {
        yield* game.createObject(0x79, 0, 0, 0, 0x280);
        yield* game.wait(EVENT.TIMER, 0x32);
        local1 = word(local1 + 1);
        if (!less(local1, 4)) {
          yield* game.wait(EVENT.TIMER, word(0x5a + ((yield* game.randomByte()) & 0xff)));
          continue loop2;
        }
      }
    }
  }
}

// Script 232: 1 argument.
export function* script232(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  yield* game.wait(EVENT.TIMER, 0x1e);
  for (;;) {
    block58: {
      yield* game.moveObjectToWaypoint(object, 1);
      const t1 = yield* run.shootPlayerWhenNear(object, 0x3c);
      local1 = t1 & 0xff;
      if (t1 === 0) {
        for (;;) {
          local1 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 4)) & EVENT.DEFEATED) !== 0) &
            0xff;
          if ((truth(less(yield* game.getDistanceToPlayer(object), 0x5a)) | signed(local1)) !== 0) {
            break block58;
          }
        }
      }
    }
    yield* game.moveObjectStraightToPlayer(object);
    if (signed(local1) === 0) {
      local1 = (yield* run.shootPlayerWhenNear(object, 0x1e)) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 233: 1 argument.
export function* script233(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x100);
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* run.promptUseOn();
          local1 = 255;
          yield* game.resetObjectRecordProperty(object);
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(7, 0x15, 0x12, 3, 0x800, 0x8d /* "This is a healing patch." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 234: 1 argument.
export function* script234(state, arg0) {
  let object = 0,
    count = 0,
    local3 = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 5);
    if ((yield* game.getActorStateProperty(0xb98 /* "Jester Spirit" */)) === 0x8b2) {
      yield* game.setSpriteMode(object, 0x8001);
      yield* game.addObjectHeight(object, 0x80);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.setObjectVelocity(object, 0, 0, 0xffff);
      count = 0x1f4;
      local3 = 0;
      for (;;) {
        yield* game.wait(EVENT.TIMER, 1);
        const t1 = signed(local3) ^ 0xffff;
        local3 = (signed(local3) ^ 0xffff) & 0xff;
        if (t1 === 0) {
          yield* game.keepObjectFlagBits(object, 0xff7f);
        } else {
          yield* game.setObjectFlagBits(object, 0x80);
        }
        count = word(count - 1);
        yield* game.panSongLevelToObject(0xffff, shiftRight(count, 3));
        if (count === 0) {
          yield* game.keepObjectRecordFlagBits(object, 0xff7f);
          for (;;) {
            yield* game.wait(EVENT.TIMER, 1);
            if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
              yield* game.keepActorStateFlagBits(0x770 /* "Partial Bodysuit" */, 0xfffe);
              yield* game.keepActorStateFlagBits(0xbf3 /* "HK 277 A. Rifle" */, 0xfffe);
              yield* game.setActorStateFlagBits(0x15c4 /* "Dermal Plating" */, 1);
              yield* game.markTopic(0x28 /* "Rust Stilettos" */);
              yield* game.markTopic(0x1c /* "Laughlyn" */);
              yield* game.markTopic(0x23 /* "Nirwanda" */);
              yield* game.markTopic(0x18 /* "Ice" */);
              yield* game.markTopic(0xc /* "Docks" */);
              yield* game.markTopic(4 /* "Bremerton" */);
              yield* game.changeRoom(0x87);
              return null;
            }
          }
        }
      }
    }
  }
}

// Script 235: 7 arguments, returns a word.
export function* shootRound(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local8 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  local6 = arg6;
  yield* game.setObjectAnimation(object, 4);
  yield* game.turnObjectToObject(object, signed(local1));
  if (local3 !== 0) {
    yield* game.playSoundEffect(object, 0x42, 0xff, 3);
  } else {
    yield* game.playSoundEffect(object, 0xc, 0xff, 3);
  }
  yield* game.shootAtObject(object, signed(local1), local2, local3, local4, signed(local5));
  const t1 = truth(
    ((yield* game.wait(
      EVENT.TIMER | EVENT.DEFEATED,
      word(((yield* game.randomByte()) & 0x1f) + local6),
    )) &
      EVENT.DEFEATED) !==
      0,
  );
  local8 = t1 & 0xff;
  return t1;
}

// Script 236: 1 argument.
export function* script236(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.rollEnemySpawn(5)) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* game.setObjectRecordCount(object, 0x14);
    yield* game.setObjectArmour(object, 3);
    yield* run.chaseAndShoot(object, 3, 5, 1, 0x1e);
    yield* run.dropNuyen15F(yield* run.leaveBody(object));
  }
  return null;
}

// Script 237: 1 argument.
export function* script237(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  loop9: for (;;) {
    yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 0x1f) + 0x12c));
    for (;;) {
      yield* game.wait(EVENT.TIMER, 0x32);
      if ((yield* game.getScriptVariable(0x2a)) <= 4) {
        yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
        yield* game.playSoundEffect(object, 0x30, 0xff, 3);
        const t1 = word((yield* game.getObjectCoarseHeight(object)) + 4);
        const t2 = word((yield* game.getObjectCoarseY(object)) + 8);
        const t3 = word((yield* game.getObjectCoarseX(object)) - 6);
        yield* game.createObject(0xbd /* "Ghoul" */, t3, t2, t1, 0x8d);
        continue loop9;
      }
    }
  }
}

// Script 238: 1 argument.
export function* script238(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block166: {
    object = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      yield* game.setObjectFlagBits(object, 0xa000);
      yield* game.setObjectRecordCount(object, 0x28);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.appendToFightList(object);
      yield* game.setObjectArmour(object, 3);
      for (;;) {
        const t1 = truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(0x1e + ((yield* game.randomByte()) & 0x3f)),
          )) &
            EVENT.DEFEATED) !==
            0,
        );
        local1 = t1 & 0xff;
        if (t1 === 0) {
          const t2 = yield* game.chooseEnemyTarget(object);
          local2 = t2 & 0xff;
          yield* game.turnObjectToObject(object, t2);
          if (signed(local2) === 0xffff) {
            yield* game.turnObjectToObject(object, signed(local2));
          } else {
            yield* game.setObjectAnimation(object, 4);
            yield* game.shootAtObject(object, signed(local2), 5, 1, 0xa, 3);
            yield* game.playSoundEffect(object, 0x40, 0xff, 3);
          }
          local1 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) !== 0) &
            0xff;
          yield* game.setObjectAnimation(object, 0);
        }
        if (signed(local1) !== 0) {
          yield* game.addKarma(6);
          yield* game.fightListRemove(object);
          const t3 = yield* game.getObjectCoarseHeight(object);
          const t4 = yield* game.getObjectCoarseY(object);
          const t5 = yield* game.getObjectCoarseX(object);
          yield* game.createObject(0xb8, t5, t4, t3, 0x382);
          yield* game.wait(EVENT.TIMER, 0x14);
          break block166;
        }
      }
    }
  }
  yield* game.resetObjectRecordProperty(object);
  yield* game.removeObject(object);
  return null;
}

// Script 239: no arguments.
export function* script239(state) {
  yield* game.setActorStateFlagBits(0xcc5 /* "Helicopter Pilot" */, 2);
  return null;
}

// Script 23A: no arguments.
export function* script23A(state) {
  yield* game.markTopic(0x26 /* "Raitsov" */);
  return null;
}

// Script 23B: 1 argument.
export function* script23B(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, (yield* game.randomByte()) & 7);
  yield* game.wait(EVENT.TIMER, 0x32);
  yield* game.setObjectRecordCount(object, 0x1e);
  yield* game.setObjectArmour(object, 3);
  yield* game.appendToFightList(object);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(object);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      local1 = (yield* run.shootRound(object, signed(local2), 5, 0, 3, 1, 0x1e)) & 0xff;
    } else {
      local1 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x28)) & EVENT.DEFEATED) !== 0) &
        0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(0x14);
      yield* game.fightListRemove(object);
      yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
      yield* game.setActorStateFlagBits(0x62e /* "Safe Key" */, 0x80);
      return null;
    }
  }
}

// Script 23C: 1 argument.
export function* script23C(state, arg0) {
  let object = 0,
    local1 = 0;
  block78: {
    object = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(object)) === 0) {
      yield* run.script0AE(object);
      local1 = 0;
      for (;;) {
        if (((yield* game.wait(EVENT.PICK_UP | EVENT.EXAMINE, 0)) & EVENT.EXAMINE) === 0) {
          yield* game.setObjectRecordPropertyFromGroup(object);
          yield* run.playPickUpSound();
          yield* game.removeObject(object);
          local1 = 255;
        } else {
          yield* game.notice(
            2,
            0x15,
            0x14,
            3,
            0x800,
            0x1dc /* "It's a PCD-100 Cyberdeck." */,
            0xf0,
          );
        }
        if (signed(local1) !== 0) {
          break block78;
        }
      }
    } else {
      yield* run.dataTerminal(object, 0x1dc, 0x14);
    }
  }
  return null;
}

// Script 23D: 1 argument.
export function* script23D(state, arg0) {
  let object = 0,
    direction = 0,
    dx = 0,
    dy = 0,
    local6 = 0;
  function* sub5() {
    for (;;) {
      if ((yield* game.getDistanceToPlayer(object)) <= 0x1e) {
        local6 = 0;
        const t1 = yield* game.getDirectionToPlayer(object);
        direction = t1 & 0xff;
        if (t1 !== 0) {
          if (direction !== 1) {
            if (direction !== 2) {
              if (direction !== 3) {
                if (direction !== 4) {
                  if (direction !== 5) {
                    if (direction !== 6) {
                      if (direction === 7) {
                        dx = 2;
                        dy = 0xfffe;
                      }
                    } else {
                      dx = 2;
                      dy = 0;
                    }
                  } else {
                    dx = 2;
                    dy = 2;
                  }
                } else {
                  dx = 0;
                  dy = 2;
                }
              } else {
                dx = 0xfffe;
                dy = 2;
              }
            } else {
              dx = 0xfffe;
              dy = 0;
            }
          } else {
            dx = 0xfffe;
            dy = 0xfffe;
          }
        } else {
          dx = 0;
          dy = 0xfffe;
        }
        yield* game.setObjectActionAndDirection(object, 8, direction);
        yield* game.setObjectVelocity(object, dx, dy, 0);
        if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 5)) & EVENT.DEFEATED) !== 0) {
          return;
        }
      } else {
        if (local6 !== 0) {
          if (local6 !== 0x3c) {
            if (local6 === 0x78) {
              yield* game.setObjectAnimation(object, 0);
            }
          } else {
            if (less(yield* game.getDistanceToPlayer(object), 0x28)) {
              yield* game.setObjectAnimation(object, 7);
            }
          }
        } else {
          yield* game.setObjectAnimation(object, 0);
        }
        yield* game.turnObjectToPlayer(object);
        yield* game.clearObjectVelocity(object);
        if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) === 0) {
          local6 = word(local6 + 1);
        } else {
          return;
        }
      }
    }
  }
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  local6 = 0;
  yield* sub5();
  yield* run.leaveBody(object);
  return null;
}

// Script 23E: 1 argument.
export function* script23E(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0);
  yield* game.setObjectFlags(object, 0x140);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  local1 = 0;
  yield* game.appendToFightList(object);
  for (;;) {
    block53: {
      const t1 = yield* run.walkAndShootPlayer(object, 3, signed(local1));
      local1 = t1 & 0xff;
      if (t1 === 0) {
        for (;;) {
          yield* game.wait(EVENT.TIMER, 1);
          if (less(yield* game.getDistanceToPlayer(object), 0x64)) {
            break block53;
          }
        }
      }
    }
    const t2 = yield* run.walkAndShootPlayer(object, 1, signed(local1));
    local1 = t2 & 0xff;
    const t3 = yield* run.walkAndShootPlayer(object, 4, t2);
    local1 = t3 & 0xff;
    const t4 = yield* run.walkAndShootPlayer(object, 1, t3);
    local1 = t4 & 0xff;
    if (t4 !== 0) {
      yield* game.fightListRemove(object);
      yield* game.releaseObjectGraphics(object);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 23F: 1 argument.
export function* script23F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.matrix.dataBits & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  if ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x769 /* "Password" */)) === 0) {
    yield* run.jackIntoMatrix(object, 3, 0x162, 0, 2);
  } else {
    yield* run.jackIntoMatrix(object, 3, 0x162, 2, 2);
  }
  return null;
}
