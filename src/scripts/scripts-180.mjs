// Scripts 180 to 19F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 180: no arguments.
export function* script180(state) {
  yield* run.enterWithoutRunners(0xdc);
  return null;
}

// Script 181: no arguments.
export function* script181(state) {
  const t1 = yield* run.byNegotiation(0x7d0, 0x6a4, 0x3e8);
  const t2 = yield* run.byNegotiationB(0x15c, 0x15d, 0x15e);
  yield* run.offerToHire(0x98b, t2, t1, 0x15b, 0x15a);
  return null;
}

// Script 182: 1 argument.
export function* script182(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x317 /* "Street Doc" */)) & 2) === 0) {
    yield* game.addNuyen(0x1f4);
    yield* game.setActorStateFlagBits(0x317 /* "Street Doc" */, 2);
    return null;
  }
  return null;
}

// Script 183: 1 argument.
export function* endingScene11(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.walkToWaypoint(object, 0);
  yield* run.walkToWaypoint(object, 1);
  yield* run.shootRandomTargets(object, 5);
  yield* game.notice(2, 2, 0x15, 3, 0x400, 0xf4 /* "This isn't the end, Armitage!" */, 0xf0);
  yield* run.walkToWaypoint(object, 2);
  yield* game.notice(5, 4, 0x18, 3, 0x400, 0xf5 /* "We'll meet again in Shadowrun II!" */, 0xf0);
  yield* run.shootRandomTargets(object, 8);
  yield* run.nextEndingScene(0xf0);
  return null;
}

// Script 184: 1 argument.
export function* script184(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.placeObjectOnWaypoint(object, 1);
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(EVENT.TIMER, 0x64);
  yield* game.removeObject(object);
  return null;
}

// Script 185: 1 argument.
export function* script185(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0);
  yield* game.setObjectFlags(object, 0x140);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  local1 = 0;
  yield* game.appendToFightList(object);
  for (;;) {
    block58: {
      local1 = (yield* run.walkAndShootPlayer(object, 0, signed(local1))) & 0xff;
      yield* game.setObjectDirection(object, 6);
      if (signed(local1) === 0) {
        for (;;) {
          yield* game.wait(EVENT.TIMER, 1);
          if (less(yield* game.getDistanceToPlayer(object), 0xb4)) {
            break block58;
          }
        }
      }
    }
    const t1 = yield* run.walkAndShootPlayer(object, 2, signed(local1));
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      yield* game.fightListRemove(object);
      yield* game.releaseObjectGraphics(object);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 186: 1 argument.
export function* script186(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* run.passingVehicle(object, 3, 0, 0xffff, 0);
  return null;
}

// Script 187: 1 argument.
export function* script187(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* run.passingVehicle(object, 3, 0, 0xffff, 0);
  return null;
}

// Script 188: 1 argument.
export function* script188(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* game.setScriptVariable(8, 0x7d9);
  yield* run.waveSwarm(object, 1, 2, 0xc0, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 189: 1 argument.
export function* script189(state, arg0) {
  let object = 0,
    count = 0;
  function* sub5(in0) {
    count = in0;
    for (;;) {
      yield* game.wait(EVENT.TIMER, 1);
      if ((state.input.held & 0xf0f0) !== 0) {
        state.room.reload = 0xffff;
      }
      count = word(count - 1);
      if (count === 0) {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  yield* game.releaseGlove();
  yield* sub5(0x514);
  yield* game.setObjectActionAndDirection(object, 1, 2);
  yield* game.setObjectVelocity(object, 3, 0, 0);
  yield* sub5(0x64);
  yield* game.startBrightnessFade(4);
  yield* sub5(0x32);
  state.room.reload = 0xffff;
  return null;
}

// Script 18A: 1 argument.
export function* script18A(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    frames = 0;
  function* sub5(in0, in1) {
    local3 = in0;
    frames = in1;
    if (((yield* game.wait(local3 | 0x800, frames)) & EVENT.DEFEATED) !== 0) {
      local2 = 255;
    }
  }
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, word((yield* game.randomBelow(0x3c)) + 0xa));
  yield* game.setObjectArmour(object, 3);
  yield* game.setObjectRecordCount(object, 0x14);
  local2 = 0;
  yield* game.appendToFightList(object);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectActionAndDirection(object, 3, 7);
  yield* sub5(8, 0);
  yield* game.setObjectAnimation(object, 1);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(object);
    local1 = t1 & 0xff;
    yield* game.moveObjectStraightToObject(object, t1);
    if (signed(local1) !== 0xffff) {
      if (less(yield* game.getDistanceBetweenObjects(object, signed(local1)), 0xa)) {
        yield* game.shootAtObject(object, signed(local1), 4, 4, 8, 2);
      }
      if (((yield* game.wait(EVENT.TIMER | EVENT.ARRIVED, 0x28)) & EVENT.ARRIVED) !== 0) {
        yield* game.moveObjectStraightToObject(object, signed(local1));
      }
    }
    yield* sub5(1, 0x28);
    if ((signed(local2) | truth(signed(local1) === 0xffff)) !== 0) {
      if (signed(local2) !== 0) {
        yield* game.addKarma(3);
      }
      yield* game.fightListRemove(object);
      yield* game.stopMotion(object);
      yield* game.clearObjectVelocity(object);
      if (signed(local2) === 0) {
        yield* game.setObjectAnimation(object, 8);
        yield* game.wait(EVENT.ANIMATION_END, 0);
      } else {
        yield* run.scatterGhoulBones(object);
      }
      yield* game.removeObject(object);
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
      return null;
    }
  }
}

// Script 18B: 1 argument.
export function* script18B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.notice(8, 2, 0xd, 3, 0, 0x1da /* "Jagged Nails......." */, 0xf0);
  yield* run.script0D2(object);
  return null;
}

// Script 18C: 1 argument.
export function* script18C(state, arg0) {
  let object = 0,
    local1 = 0,
    waypoint = 0,
    direction = 0;
  function* sub5(in0, in1) {
    waypoint = in0 & 0xff;
    direction = in1 & 0xff;
    yield* game.setObjectAnimation(object, 1);
    yield* game.moveObjectToWaypoint(object, waypoint);
    yield* game.wait(EVENT.TALK | EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectActionAndDirection(object, 0, direction);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x3f) + 0x3c));
    yield* game.setObjectAnimation(object, 1);
    yield* game.moveObjectToWaypoint(object, 3);
    yield* game.wait(EVENT.TALK | EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectActionAndDirection(object, 1, 0);
    yield* game.setObjectVelocity(object, 0, 2, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x3c);
    yield* game.clearObjectVelocity(object);
    yield* game.setObjectAnimation(object, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x3c);
    yield* game.setObjectActionAndDirection(object, 1, 4);
    yield* game.setObjectVelocity(object, 0, 0xfffe, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x3c);
    yield* game.clearObjectVelocity(object);
  }
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x8a);
  yield* game.setObjectAnimation(object, 1);
  yield* game.moveObjectToWaypoint(object, 3);
  yield* game.wait(EVENT.TALK | EVENT.ARRIVED, 0);
  yield* game.stopMotion(object);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x3f) + 1));
  for (;;) {
    local1 = yield* game.randomBelow(6);
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          if (local1 !== 3) {
            if (local1 !== 4) {
              if (local1 === 5) {
                yield* sub5(7, 2);
              }
            } else {
              yield* sub5(8, 6);
            }
          } else {
            yield* sub5(6, 4);
          }
        } else {
          yield* sub5(2, 0);
        }
      } else {
        yield* sub5(4, 2);
      }
    } else {
      yield* sub5(5, 2);
    }
  }
}

// Script 18D: no arguments.
export function* script18D(state) {
  yield* game.releaseGlove();
  if (((yield* game.getActorStateFlags(0x78c /* "Orc" */)) & 0x80) !== 0) {
    yield* game.keepActorStateFlagBits(0x78c /* "Orc" */, 0xff7f);
  }
  if (((yield* game.getActorStateFlags(0xba6 /* "Jamaican" */)) & 0x80) !== 0) {
    yield* game.keepActorStateFlagBits(0xba6 /* "Jamaican" */, 0xff7f);
  }
  yield* game.createObject(0xb0, 0x249, 0x237, 0x40, 0x326);
  yield* game.createObject(0xb1, 0x242, 0x230, 0x40, 0x2f6);
  yield* game.wait(EVENT.TIMER, 0xc8);
  yield* game.notice(
    2,
    0x15,
    0x1c,
    4,
    0x800,
    0xe8 /* "Where are you taking me? And why did you have to blindfold m..." */,
    0xf0,
  );
  yield* game.wait(EVENT.TIMER, 0xdc);
  yield* game.notice(2, 2, 0x1c, 3, 0x400, 0xe9 /* "Don't worry, we'll keep you safe." */, 0xf0);
  yield* game.wait(EVENT.TIMER, 0x190);
  yield* game.notice(
    3,
    2,
    0x1a,
    3,
    0x400,
    0xea /* "It isn't five star but you'll like it." */,
    0xf0,
  );
  yield* game.wait(EVENT.TIMER, 0x104);
  return null;
}

// Script 18E: 1 argument.
export function* script18E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waypointShooter(object, 1, 2, 3, 1);
  return null;
}

// Script 18F: 1 argument.
export function* script18F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlags(object, 0);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 190: 1 argument.
export function* script190(state, arg0) {
  let object = 0,
    local3 = 0;
  block108: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* run.script0AE(object);
      yield* game.notice(4, 4, 6, 3, 0x400, 0x7b /* "Help!" */, 0x3c);
      local3 = 0;
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) === 0) {
          if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
            local3 = 255;
          }
        } else {
          yield* game.notice(
            2,
            0x15,
            0x1c,
            3,
            0x800,
            0x6a /* "He is in great pain, he cannot speak..." */,
            0xf0,
          );
        }
        if (signed(local3) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* game.setObjectAnimation(object, 1);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.talk(object, 0x5c);
          break block108;
        }
      }
    }
  }
  yield* game.setObjectActionAndDirection(object, 7, 5);
  for (;;) {
    if (((yield* game.getObjectRecordFlags(object)) & 2) !== 0) {
      yield* game.setObjectAnimation(object, 2);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.setObjectAnimation(object, 3);
      yield* game.setObjectVelocity(object, 0, 0, 2);
      yield* game.playSoundEffect(object, 0x66, 0xff, 3);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      yield* game.markTopic(0x11 /* "Ghouls" */);
      return null;
    }
    yield* game.wait(EVENT.TALK, 0);
    yield* game.talk(object, 0x5c);
  }
}

// Script 191: 1 argument.
export function* script191(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* run.passingVehicle(object, 3, 0, 0xffff, 0xffff);
  return null;
}

// Script 192: 1 argument.
export function* script192(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* run.passingVehicle(object, 3, 0, 0xffff, 0xffff);
  return null;
}

// Script 193: 1 argument.
export function* script193(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.script0AE(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x100);
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* game.endDialog();
          yield* game.wait(EVENT.TIMER, 1);
          state.jake.alternatePortrait = signed(state.jake.alternatePortrait) ^ 0xffff;
          yield* game.notice(2, 0x16, 0x12, 3, 0x800, 0x9e /* "I'll just put these on..." */, 0xf0);
          yield* game.resetObjectRecordProperty(object);
          local1 = 255;
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0xe, 3, 0x800, 0x9d /* "Dark sun-glasses." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 194: 1 argument, returns a word.
export function* script194(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.faceRoomDirection(object);
  yield* game.setObjectFlagBits(object, 0x60);
  local1 =
    truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xc)) & EVENT.DEFEATED) !== 0) & 0xff;
  yield* game.keepObjectFlagBits(object, 0xff9f);
  yield* game.clearObjectVelocity(object);
  yield* game.setObjectAnimation(object, 0);
  return signed(local1);
}

// Script 195: 6 arguments.
export function* spawnedGunmanD(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local13 = 0;
  block228: {
    object = arg0 & 0xff;
    local1 = arg1;
    local3 = arg2;
    local5 = arg3 & 0xff;
    local6 = arg4 & 0xff;
    local7 = arg5 & 0xff;
    if ((yield* run.rollEnemySpawn(local6)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectRecordCount(object, local7);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      local8 = 0;
      local9 = 255;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local10 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (signed(local9) !== 0) {
            yield* game.appendToFightList(object);
            local9 = 0;
          }
          if (signed(local5) === 0) {
            local11 = yield* game.getObjectCoarseX(signed(local10));
            local13 = yield* game.getObjectCoarseY(signed(local10));
          } else {
            local11 = yield* game.getObjectCoarseY(signed(local10));
            local13 = yield* game.getObjectCoarseX(signed(local10));
          }
          if (local1 > local11) {
            yield* game.setObjectAnimation(object, 4);
            yield* game.shootAtObject(object, signed(local10), 2, 0, 5, 0);
            if (!less(local3, local13)) {
              yield* game.setObjectDirection(object, 7);
            } else {
              yield* game.setObjectDirection(object, 3);
            }
            yield* game.playSoundEffect(object, 0xc, 0xff, 3);
            local8 =
              truth(
                ((yield* game.wait(
                  EVENT.TIMER | EVENT.DEFEATED,
                  word(((yield* game.randomByte()) & 0xf) + 0x1e),
                )) &
                  EVENT.DEFEATED) !==
                  0,
              ) & 0xff;
          }
        }
        if (signed(local8) !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(object);
          yield* game.setObjectActionAndDirection(object, 6, 5);
          yield* game.playSoundEffect(object, 0x14, 0xff, 3);
          yield* game.clearObjectTask(object);
          break block228;
        }
        local8 =
          truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x14)) & EVENT.DEFEATED) !== 0) &
          0xff;
      }
    }
  }
  return null;
}

// Script 196: 1 argument.
export function* script196(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 6);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectArmour(object, 1);
  yield* run.waterCreatureB(object, 0x12, 0x32);
  return null;
}

// Script 197: 1 argument, returns a word.
export function* isRunnerActor(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if (local0 !== 0x8b2) {
    if (local0 !== 0x1458) {
      if (local0 !== 0x89d) {
        if (local0 !== 0x15d2) {
          if (local0 !== 0x79a) {
            if (local0 !== 0xa4f) {
              if (local0 !== 0xd2e) {
                if (local0 !== 0x1b6d) {
                  if (local0 !== 0xb52) {
                    if (local0 !== 0xba6) {
                      if (local0 !== 0x78c) {
                        if (local0 !== 0xb3d) {
                          if (local0 !== 0x98b) {
                            return 0;
                          }
                          return 0xffff;
                        }
                        return 0xffff;
                      }
                      return 0xffff;
                    }
                    return 0xffff;
                  }
                  return 0xffff;
                }
                return 0xffff;
              }
              return 0xffff;
            }
            return 0xffff;
          }
          return 0xffff;
        }
        return 0xffff;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  return 0xffff;
}

// Script 198: 1 argument.
export function* script198(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectArmour(object, 1);
  yield* run.waterCreatureB(object, 0x32, 0xc);
  return null;
}

// Script 199: 1 argument.
export function* script199(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  for (;;) {
    block174: {
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.placeObjectOnWaypoint(object, 0);
        yield* run.script0AE(object);
        yield* game.setObjectDialog(object, 0x10);
        local1 = 0;
        for (;;) {
          if (
            ((yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) ===
            0
          ) {
            if (
              (yield* game.isActorStateProperty(
                0xfce /* "Heavy Bouncer" */,
                0x237 /* "Tickets" */,
              )) !== 0
            ) {
              local1 = 255;
            }
          } else {
            yield* game.notice(
              2,
              0x15,
              0x16,
              3,
              0x800,
              0xa8 /* "7 foot high and 4 foot wide." */,
              0xf0,
            );
          }
          if (signed(local1) !== 0) {
            yield* game.setObjectRecordFlagBits(object, 1);
            yield* game.wait(EVENT.TIMER, 0x3c);
            yield* game.notice(0xc, 2, 0x11, 3, 0x400, 0xa9 /* "Ok, buddy. Go on in..." */, 0x78);
            yield* game.wait(EVENT.TIMER, 0x3c);
            yield* game.setObjectActionAndDirection(object, 1, 0);
            yield* game.setObjectVelocity(object, 0, 2, 0);
            yield* game.wait(EVENT.TIMER, 0x64);
            yield* game.moveObjectToWaypoint(object, 1);
            yield* game.wait(EVENT.ARRIVED, 0);
            yield* game.stopMotion(object);
            break block174;
          }
        }
      } else {
        yield* game.placeObjectOnWaypoint(object, 1);
        yield* run.script0AE(object);
        yield* game.setObjectDialog(object, 0x11);
        yield* game.wait(EVENT.TALK, 0);
      }
    }
  }
}

// Script 19A: no arguments.
export function* script19A(state) {
  const t1 = yield* run.byNegotiation(0x3e8, 0x384, 0x320);
  const t2 = yield* run.byNegotiationB(0x157, 0x158, 0x159);
  yield* run.offerToHire(0x89d, t2, t1, 0x156, 0x155);
  return null;
}

// Script 19B: 1 argument.
export function* script19B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.hiredRunner(object, 4, 0x64, 0x6e, 0);
  return null;
}

// Script 19C: 1 argument.
export function* script19C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.giveArmour(object, 4, 4);
  return null;
}

// Script 19D: 1 argument.
export function* script19D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectFlagBits(object, 0x80);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE, 0);
    yield* game.notice(
      2,
      0x16,
      0x18,
      3,
      0x800,
      0x11a /* "This terminal is not accessible." */,
      0xb4,
    );
  }
}

// Script 19E: 1 argument.
export function* script19E(state, arg0) {
  let object = 0,
    count = 0,
    local3 = 0;
  block231: {
    object = arg0 & 0xff;
    yield* game.addTopic(0xe /* "Drake" */);
    yield* game.setScriptVariable(0x12, 0);
    state.motion.circleLeaderAlive = 0xffff;
    local3 = 0;
    yield* game.setObjectRecordCount(object, 0x14);
    yield* game.setObjectFlagBits(object, 0x2000);
    yield* game.setSpriteMode(object, 0x8001);
    yield* game.setObjectActionAndDirection(object, 0, 4);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      yield* game.appendToFightList(object);
      yield* game.setObjectArmour(object, 2);
      yield* game.setScriptVariable(0x10, 0x801);
      yield* game.startSwarmOrbit(object);
      count = 0;
      for (;;) {
        yield* game.circleSwarmLeader(0);
        if (((yield* game.wait(yield* game.getScriptVariable(0x10), 1)) & EVENT.DEFEATED) !== 0) {
          yield* game.setObjectRecordCount(object, 0x28);
          const t1 = word(local3 + 1);
          local3 = word(local3 + 1) & 0xff;
          if (t1 !== 1) {
            if (local3 !== 2) {
              if (local3 > 3) {
                local3 = 3;
              }
            } else {
              yield* game.notice(
                3,
                4,
                0x19,
                4,
                0x400,
                0x111 /* "You are a fool to come here! You are no match for the Jester..." */,
                0xf0,
              );
              yield* game.setObjectDialog(object, 0x41);
              yield* game.setScriptVariable(0x10, 0x803);
            }
          } else {
            yield* game.setScriptVariable(0x12, 0xffed);
          }
        }
        count = word(count + 1);
        if (count === 0xf0) {
          yield* game.playSoundEffect(0xffff, 0x56, 0xff, 4);
          state.motion.circlePhaseSpeed = 8;
        }
        if (count === 0x130) {
          state.motion.circlePhaseSpeed = 0;
          count = 0;
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.addKarma(0x38);
          yield* game.fightListRemove(object);
          break block231;
        }
      }
    }
  }
  state.motion.circleLeaderAlive = 0;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectActionAndDirection(object, 1, 4);
  yield* game.setObjectVelocity(object, 0, 0xfffe, 0);
  count = 0x11;
  yield* game.setObjectDialog(object, 0x40);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0xa);
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    yield* game.setObjectVelocity(
      yield* game.createObject(0x78 /* "Jester Spirit" */, t4, t3, t2, 0x332),
      0,
      0,
      0xfffc,
    );
    count = word(count - 1);
    if (count === 0) {
      yield* game.clearObjectVelocity(object);
      for (;;) {
        yield* game.wait(EVENT.TIMER | EVENT.TALK, 0xa);
        const t5 = yield* game.getObjectCoarseHeight(object);
        const t6 = yield* game.getObjectCoarseY(object);
        const t7 = yield* game.getObjectCoarseX(object);
        yield* game.setObjectVelocity(
          yield* game.createObject(0x78 /* "Jester Spirit" */, t7, t6, t5, 0x332),
          0,
          0,
          0xfffc,
        );
        if ((yield* game.isTopicKnown(0x3f /* "Volcano" */)) !== 0) {
          yield* game.setObjectVelocity(object, 0, 0, 0xfffe);
          count = 7;
          for (;;) {
            yield* game.setObjectActionAndDirection(object, 1, 4);
            yield* game.wait(EVENT.TIMER, 2);
            yield* game.setObjectActionAndDirection(object, 1, 5);
            yield* game.wait(EVENT.TIMER, 2);
            yield* game.setObjectActionAndDirection(object, 1, 6);
            yield* game.wait(EVENT.TIMER, 2);
            yield* game.setObjectActionAndDirection(object, 1, 5);
            yield* game.wait(EVENT.TIMER, 2);
            count = word(count - 1);
            if (count === 0) {
              yield* game.clearObjectVelocity(object);
              yield* game.wait(EVENT.PICK_UP, 0);
              yield* run.playPickUpSound();
              yield* game.resetObjectRecordProperty(object);
              yield* game.removeObject(object);
              yield* game.setActorStateHolder(0xb98 /* "Jester Spirit" */, 0x8b2 /* "Me" */);
              yield* game.markTopic(0x23 /* "Nirwanda" */);
              yield* game.markTopic(0x1c /* "Laughlyn" */);
              yield* game.markTopic(4 /* "Bremerton" */);
              return null;
            }
          }
        }
      }
    }
  }
}

// Script 19F: 1 argument.
export function* script19F(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    created = 0,
    count3 = 0,
    count4 = 0,
    count = 0,
    local14 = 0,
    count2 = 0,
    local18 = 0,
    local20 = 0,
    local22 = 0;
  function* sub5() {
    if (state.combat.playerHitFrames === 0) {
      yield* game.moveSwarmAlongPath(object);
    }
    local14 = word(
      0x140 -
        shiftRight(
          word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) - 0x17c),
          1,
        ),
    );
    yield* game.setSwarmPathPhaseTarget(local14);
    yield* game.setSwarmPathSpeedTarget(
      word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) + 0xff04),
    );
    return truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) !== 0);
  }
  object = arg0 & 0xff;
  yield* game.setScriptVariable(0x14, 0);
  yield* game.setSpriteMode(object, 0x8001);
  local1 = 0;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.startPathSwarm(object);
  yield* sub5();
  count = 0;
  local3 = 0;
  yield* game.setObjectRecordCount(object, 0xfa);
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, 5);
  count2 = 0x64;
  for (;;) {
    block265: {
      if (((yield* game.getScriptVariable(0x14)) & 1) !== 0) {
        yield* game.keepObjectFlagBits(object, 0x7fff);
        yield* game.setSwarmPathPhaseTarget(0x100);
        yield* game.setSwarmPathSpeedTarget(0x100);
        count2 = 0;
        count = word(count + 0x64);
        for (;;) {
          yield* game.moveSwarmAlongPath(object);
          yield* game.wait(EVENT.TIMER, 1);
          if (count === 0) {
            yield* game.setScriptVariableBits(0x14, 2);
            for (;;) {
              if (((yield* game.getScriptVariable(0x14)) & 4) !== 0) {
                yield* game.keepScriptVariableBits(0x14, 0xfffb);
                if ((yield* game.getObjectRecordCount(object)) > 0x28) {
                  yield* game.setObjectRecordCount(
                    object,
                    word((yield* game.getObjectRecordCount(object)) - 0xa),
                  );
                }
                if ((local3 & 7) === 0) {
                  yield* game.playSoundEffect(object, 0x6a, 0xff, 0xf);
                  yield* game.setObjectActionAndDirection(object, 1, 4);
                }
                local3 = word(local3 + 1) & 0xff;
              }
              yield* game.wait(EVENT.TIMER, 5);
              if (((yield* game.getScriptVariable(0x14)) & 1) === 0) {
                yield* game.setObjectFlagBits(object, 0x8000);
                break block265;
              }
            }
          } else {
            count = word(count - 1);
          }
        }
      }
    }
    if ((yield* sub5()) === 0) {
      yield* game.setObjectAnimation(object, 0);
      yield* game.turnObjectToPlayer(object);
      if (count === 0) {
        if (((yield* game.randomByte()) & 0xf) !== 0) {
          if (!less(yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()), 0x190)) {
            if (!(
              (yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) > 0x1c2 ||
              count2 === 0
            )) {
              if (count2 !== 0) {
                count2 = word(count2 - 1);
              }
              const t9 = yield* game.getObjectDirection(object);
              local2 = t9 & 0xff;
              if (t9 <= 5) {
                if (local2 !== 5) {
                  if (local2 !== 4) {
                    if (local2 !== 3) {
                      if (less(local2, 3)) {
                        const t27 = word((yield* game.randomBelow(2)) - 0xfffb);
                        const t28 = yield* game.getObjectCoarseHeight(object);
                        const t29 = word((yield* game.getObjectCoarseY(object)) - 0xa);
                        const t30 = word((yield* game.getObjectCoarseX(object)) + 0xa);
                        yield* game.setObjectVelocity(
                          yield* game.createObject(0x8d, t30, t29, t28, 0x1b0),
                          t27,
                          0xfffd,
                          0xfffa,
                        );
                      }
                    } else {
                      const t23 = word((yield* game.randomBelow(2)) - 0xfffb);
                      const t24 = yield* game.getObjectCoarseHeight(object);
                      const t25 = word((yield* game.getObjectCoarseY(object)) - 0x14);
                      const t26 = yield* game.getObjectCoarseX(object);
                      yield* game.setObjectVelocity(
                        yield* game.createObject(0x8d, t26, t25, t24, 0x1b0),
                        t23,
                        0xfffa,
                        0xfffa,
                      );
                    }
                  } else {
                    const t19 = word((yield* game.randomBelow(2)) - 1);
                    const t20 = word((yield* game.getObjectCoarseHeight(object)) - 5);
                    const t21 = word((yield* game.getObjectCoarseY(object)) - 0x19);
                    const t22 = word((yield* game.getObjectCoarseX(object)) - 5);
                    yield* game.setObjectVelocity(
                      yield* game.createObject(0x8d, t22, t21, t20, 0x1b0),
                      t19,
                      0xfffa,
                      0xfffa,
                    );
                  }
                } else {
                  const t14 = word((yield* game.randomBelow(4)) + 0xfffc);
                  const t15 = word((yield* game.randomBelow(4)) + 0xfffc);
                  const t16 = word((yield* game.getObjectCoarseHeight(object)) - 5);
                  const t17 = word((yield* game.getObjectCoarseY(object)) - 0xa);
                  const t18 = word((yield* game.getObjectCoarseX(object)) - 0xa);
                  yield* game.setObjectVelocity(
                    yield* game.createObject(0x8d, t18, t17, t16, 0x1b0),
                    t15,
                    t14,
                    0xfffa,
                  );
                }
              } else {
                const t10 = word((yield* game.randomBelow(2)) + 0xfffd);
                const t11 = word((yield* game.getObjectCoarseHeight(object)) - 5);
                const t12 = word((yield* game.getObjectCoarseY(object)) - 5);
                const t13 = word((yield* game.getObjectCoarseX(object)) - 0x19);
                yield* game.setObjectVelocity(
                  yield* game.createObject(0x8d, t13, t12, t11, 0x1b0),
                  0xfff8,
                  t10,
                  0xfffa,
                );
              }
              yield* game.playSoundEffect(object, 0x66, 0xff, 3);
              count = 0xf;
            } else {
              block670: {
                const t1 = yield* game.findNearestVisibleMember(object);
                local4 = t1 & 0xff;
                if (t1 !== 0xffff) {
                  yield* game.turnObjectToObject(object, signed(local4));
                  yield* game.wait(EVENT.TIMER, 0x14);
                  count3 = word(4 + (yield* game.randomBelow(5)));
                  loop442: for (;;) {
                    const t2 = yield* game.getObjectDirection(object);
                    local2 = t2 & 0xff;
                    if (t2 <= 5) {
                      if (local2 !== 5) {
                        if (local2 !== 4) {
                          if (local2 !== 3) {
                            local18 = 0xfff6;
                            local20 = 0xa;
                            local22 = 0;
                          } else {
                            local18 = 0;
                            local20 = 0x14;
                            local22 = 0;
                          }
                        } else {
                          local18 = 5;
                          local20 = 0x19;
                          local22 = 5;
                        }
                      } else {
                        local18 = 0xa;
                        local20 = 0xa;
                        local22 = 5;
                      }
                    } else {
                      local18 = 0x19;
                      local20 = 5;
                      local22 = 5;
                    }
                    const t3 = word((yield* game.getObjectCoarseHeight(object)) - local22);
                    const t4 = word((yield* game.getObjectCoarseY(object)) - local20);
                    const t5 = word((yield* game.getObjectCoarseX(object)) - local18);
                    created = (yield* game.createObject(0x8d, t5, t4, t3, 0x1b0)) & 0xff;
                    yield* game.moveObjectTowardsObject(created, signed(local4));
                    local18 = yield* game.getObjectVelocityX(created);
                    local20 = yield* game.getObjectVelocityY(created);
                    local22 = yield* game.getObjectVelocityZ(created);
                    const t6 = yield* game.halveArgumentSigned(local22);
                    const t7 = yield* game.halveArgumentSigned(local20);
                    const t8 = yield* game.halveArgumentSigned(local18);
                    yield* game.setObjectVelocity(created, t8, t7, t6);
                    yield* game.playSoundEffect(object, 0x66, 0xff, 3);
                    count4 = 0xf;
                    for (;;) {
                      if ((yield* sub5()) !== 0) {
                        count4 = 0;
                        count3 = 1;
                        local1 = 255;
                      }
                      if (count4 === 0) {
                        count3 = word(count3 - 1);
                        if (count3 !== 0) {
                          continue loop442;
                        }
                        break block670;
                      }
                      count4 = word(count4 - 1);
                    }
                  }
                }
              }
              count = 0x19;
            }
          } else {
            yield* game.createObject(0x100, 0, 0, 0x40, 0x44);
            count = 0x12c;
          }
        } else {
          if ((yield* game.getObjectDirection(object)) === 4) {
            yield* game.setObjectActionAndDirection(object, 7, 4);
            yield* game.wait(EVENT.ANIMATION_END, 0);
          }
          if ((yield* game.getObjectDirection(object)) === 6) {
            yield* game.setObjectActionAndDirection(object, 4, 6);
            yield* game.wait(EVENT.ANIMATION_END, 5);
          }
          count = 5;
        }
      } else {
        count = word(count - 1);
      }
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(0x5a);
      yield* game.fightListRemove(object);
      yield* game.setSwarmPathPhaseTarget(0x140);
      yield* game.setSwarmPathSpeedTarget(0x40);
      yield* game.setSwarmHeightPhaseTarget(0x180);
      yield* game.setSwarmHeightSpeedTarget(0x180);
      yield* game.setObjectAnimation(object, 0);
      count3 = 0xc8;
      for (;;) {
        yield* game.moveSwarmAlongPath(object);
        yield* game.wait(EVENT.TIMER, 1);
        if ((count3 & 7) === 0) {
          yield* game.setObjectDirection(object, word((yield* game.randomBelow(4)) + 2));
        }
        count3 = word(count3 - 1);
        if (count3 === 0) {
          yield* game.setObjectDirection(object, 7);
          state.screen.colourRequest = 1;
          yield* game.wait(EVENT.TIMER, 0x20);
          state.screen.colourRequest = 2;
          yield* game.wait(EVENT.TIMER, 0x28);
          yield* game.resetObjectRecordProperty(object);
          yield* game.changeRoom(0x38);
          return null;
        }
      }
    }
  }
}
