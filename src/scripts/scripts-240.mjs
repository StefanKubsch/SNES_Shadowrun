// Scripts 240 to 25F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 240: no arguments.
export function* promptGiveTo(state) {
  yield* game.endDialog();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(2, 0x17, 8, 3, 0, 0x10 /* "Give to:" */, 1);
  return null;
}

// Script 241: 6 arguments, returns a word.
export function* approachUntilInRange(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    events = 0,
    local9 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  local6 = local1 & 0xff;
  for (;;) {
    events = yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, 1);
    if ((events & EVENT.DEFEATED) === 0) {
      if (
        (truth(local6 === 0) |
          truth(less(yield* game.getDistanceToPlayer(object), local3) && less(local6, local2)) |
          (truth(
            ((yield* game.getObjectVelocityX(object)) |
              (yield* game.getObjectVelocityY(object))) !==
              0,
          ) ^
            0xffff) |
          truth(less(yield* game.getObjectRecordCount(object), local4) && local5 !== 0xff) |
          truth((events & EVENT.ARRIVED) !== 0)) !==
        0
      ) {
        yield* game.stopMotion(object);
        yield* game.clearObjectVelocity(object);
        yield* game.setObjectAnimation(object, 0);
        const t1 = yield* game.chooseEnemyTarget(object);
        local9 = t1 & 0xff;
        yield* game.turnObjectToObject(object, t1);
        return 0;
      }
      local6 = word(local6 - 1) & 0xff;
    } else {
      return 0xffff;
    }
  }
}

// Script 242: 2 arguments, returns a word.
export function* shootBackAtPlayer(state, arg0, arg1) {
  let object = 0,
    local1 = 0,
    events = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  yield* game.keepObjectFlagBits(object, 0xffef);
  if (local1 !== 0x600) {
    yield* game.setObjectAnimation(object, 4);
  } else {
    yield* game.setObjectAnimation(object, 5);
  }
  yield* game.turnObjectToObject(object, yield* game.getPlayerObjectCopy());
  yield* game.shootAtObject(object, yield* game.getPlayerObject(), 3, 0, 3, 2);
  yield* game.playSoundEffect(object, 0xc, 0xff, 0xff);
  events = yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x3c);
  return truth((events & EVENT.DEFEATED) !== 0);
}

// Script 243: 1 argument.
export function* script243(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 4, 0x17d, 0, 2);
  return null;
}

// Script 244: 1 argument.
export function* script244(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x16c0);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  if ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x762 /* "Password" */)) === 0) {
    yield* run.jackIntoMatrix(object, 3, 0x1d7, 0, 3);
  } else {
    yield* run.jackIntoMatrix(object, 3, 0x1d7, 2, 3);
  }
  return null;
}

// Script 245: 1 argument.
export function* script245(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  return null;
}

// Script 246: 1 argument.
export function* script246(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.script245(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0);
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0xd, 3, 0x800, 0x88 /* "Sassie 702-826." */, 0xf0);
      yield* game.learnSpell(0x4f);
      yield* game.setScriptVariable(0, word((yield* game.getScriptVariable(0)) + 1));
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 247: no arguments.
export function* script247(state) {
  yield* run.enterWithoutRunners(0x3b);
  return null;
}

// Script 248: 1 argument.
export function* script248(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setObjectVelocity(object, 0, 0xfffa, 0xf);
  local3 = yield* game.getObjectCoarseHeight(object);
  for (;;) {
    local1 = local3;
    yield* game.wait(EVENT.TIMER, 1);
    local3 = yield* game.getObjectCoarseHeight(object);
    if (local1 === local3) {
      yield* game.clearObjectVelocity(object);
      for (;;) {
        local1 = local3;
        yield* game.wait(EVENT.TIMER, 0xa);
        local3 = yield* game.getObjectCoarseHeight(object);
        if (local1 === local3) {
          yield* run.findNuyen(object);
          return null;
        }
      }
    }
  }
}

// Script 249: 1 argument.
export function* script249(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script00A(object, 0x22, 0x26, 0x80, 0x175a);
  return null;
}

// Script 24A: 1 argument.
export function* script24A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x15) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 8) !== 0) {
      yield* run.transferAccount(object, 0x1f40, 0x21a, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFilePart(0x159a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 5, 0x163, 0, 2);
  return null;
}

// Script 24B: 1 argument.
export function* script24B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x41) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFilePart(0x1593);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 6, 0x180, 0, 2);
  return null;
}

// Script 24C: 1 argument.
export function* script24C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x16c0);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xc, 0x1e1, 0, 3);
  return null;
}

// Script 24D: 1 argument.
export function* script24D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 7, 0x1a6, 0, 2);
  return null;
}

// Script 24E: 1 argument.
export function* script24E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x2f) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) !== 0) {
      yield* run.obtainDataFilePart(0x158c);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 8, 0x1a9, 0, 2);
  return null;
}

// Script 24F: 1 argument.
export function* script24F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x19) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 4) !== 0) {
      yield* run.obtainDataFile(0x15af);
    }
    if (
      (truth((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) &
        (truth(((yield* game.getActorStateFlags(0xd5f /* "Heavy Dude" */)) & 0x80) !== 0) ^
          0xffff)) !==
      0
    ) {
      yield* game.setActorStateFlags(0xd5f /* "Heavy Dude" */, 0x80);
      yield* game.notice(5, 2, 0x15, 3, 0, 0x216 /* "LEVEL 3 NODE DEACTIVATED." */, 1);
      yield* game.confirmKey();
      yield* game.wait(EVENT.TIMER, 1);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 5, 0x1e2, 0, 3);
  return null;
}

// Script 250: 1 argument.
export function* script250(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0xfb) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x16c0);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  if (((yield* game.getActorStateFlags(0xd5f /* "Heavy Dude" */)) & 0x80) === 0) {
    yield* run.jackIntoMatrix(object, 0xe, 0x1e3, 0, 3);
  } else {
    yield* run.jackIntoMatrix(object, 0xe, 0x1e3, 2, 3);
  }
  return null;
}

// Script 251: 7 arguments, returns a word.
export function* guardRouteE(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let object = 0,
    local1 = 0,
    text = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    count = 0,
    local16 = 0,
    local17 = 0,
    local18 = 0,
    local19 = 0,
    local20 = 0,
    local22 = 0,
    waypoint = 0,
    animation = 0,
    effect = 0,
    local27 = 0,
    local28 = 0,
    columns = 0;
  function* sub17() {
    yield* game.setObjectAnimation(object, 0);
    const t1 = yield* game.chooseEnemyTarget(object);
    local28 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.turnObjectToObject(object, signed(local28));
    }
    if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) === 0) {
      block206: {
        if ((yield* game.getDistanceToPlayer(object)) > 0xf) {
          local13 = 0;
          for (;;) {
            const t2 = yield* game.chooseEnemyTarget(object);
            local28 = t2 & 0xff;
            if (t2 !== 0xffff) {
              yield* game.setObjectAnimation(object, 2);
              yield* game.moveObjectStraightToPlayer(object);
              for (;;) {
                if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 5)) & EVENT.DEFEATED) === 0) {
                  if (less(yield* game.getDistanceToPlayer(object), local11)) {
                    break block206;
                  }
                  if ((yield* game.getDistanceToPlayer(object)) > local22) {
                    local20 = word(local20 + 1);
                    if (local20 === 0x12c) {
                      local20 = 0;
                      if (text !== 0x47) {
                        columns = 20;
                      } else {
                        columns = 25;
                      }
                      yield* game.notice(2, 4, columns, 3, 0x400, text, 0x78);
                    }
                  }
                } else {
                  return 0xffff;
                }
              }
            } else {
              yield* game.setObjectActionAndDirection(object, 0, 4);
              if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x14)) & EVENT.DEFEATED) !== 0) {
                return 0xffff;
              }
            }
          }
        }
      }
      yield* game.stopMotion(object);
      yield* game.clearObjectVelocity(object);
      yield* game.setObjectAnimation(object, animation);
      if (((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) === 0) {
        yield* game.shootAtObject(
          object,
          yield* game.getPlayerObjectCopy(),
          local16,
          local17,
          local18,
          signed(local19),
        );
        yield* game.playSoundEffect(object, effect, 0xff, 3);
        if (signed(local27) !== 0) {
          if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
            return 0xffff;
          }
        }
        block393: {
          const t3 = word(local13 + 1);
          local13 = word(local13 + 1) & 0xff;
          if (t3 === 3) {
            local13 = 0;
            yield* game.setObjectAnimation(object, 2);
            yield* game.moveObjectStraightToWaypoint(object, waypoint);
            if (
              ((yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, 0x28)) &
                EVENT.DEFEATED) ===
              0
            ) {
              yield* game.stopMotion(object);
              yield* game.clearObjectVelocity(object);
              yield* game.setObjectAnimation(object, 0);
              yield* game.turnObjectToPlayer(object);
              if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x3c)) & EVENT.DEFEATED) === 0) {
                count = 0x3c;
                for (;;) {
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) ===
                    0
                  ) {
                    if (
                      (truth(count === 0) |
                        truth(less(yield* game.getDistanceToPlayer(object), 0x32))) !==
                      0
                    ) {
                      break block393;
                    }
                    count = word(count - 1);
                  } else {
                    return 0xffff;
                  }
                }
              } else {
                return 0xffff;
              }
            } else {
              return 0xffff;
            }
          }
        }
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  object = arg0 & 0xff;
  local1 = arg1;
  text = arg2;
  local5 = arg3;
  local7 = arg4;
  local9 = arg5;
  local11 = arg6;
  local16 = shiftRight(local7, 8) & 0xff;
  local17 = local7 & 0xff;
  animation = shiftRight(local5, 8) & 0xff;
  effect = local5 & 0xff;
  local18 = shiftRight(local9, 8) & 0xff;
  local19 = local9 & 0xff & 0xff;
  waypoint = local1 & 0xff & 0xff;
  local27 = truth((local1 & 0xff00) !== 0) & 0xff;
  local13 = 0;
  local20 = 0;
  local22 = word(local11 + 0x64);
  for (;;) {
    if ((yield* sub17()) !== 0) {
      yield* game.setObjectActionAndDirection(object, 0, 0);
      if (signed(local27) === 0) {
        return 0;
      }
      if ((yield* game.getObjectRecordCount(object)) !== 0) {
        return 0xffff;
      }
      return 0;
    }
  }
}

// Script 252: 5 arguments.
export function* grenadeThrower(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    direction = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0,
    y = 0;
  function* sub13(in0) {
    y = in0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 7, direction);
    yield* game.createObject(0xb9 /* "Grenade" */, object, y, 0, 0x217);
    yield* game.wait(EVENT.TIMER, 0x14);
    yield* game.setObjectAnimation(object, 0);
    if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x28)) & EVENT.DEFEATED) === 0) {
      return 0;
    }
    return 0xffff;
  }
  function* sub65(in0) {
    y = in0 & 0xff;
    yield* game.setObjectAnimation(object, 2);
    yield* game.moveObjectToWaypoint(object, y);
    if (((yield* game.wait(EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) === 0) {
      yield* game.setObjectActionAndDirection(object, 0, direction);
      return 0;
    }
    return 0xffff;
  }
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  local5 = arg3;
  direction = arg4 & 0xff;
  local9 = shiftRight(local1, 8) & 0xff;
  local10 = local1 & 0xff;
  local11 = shiftRight(local3, 8) & 0xff;
  local12 = local3 & 0xff;
  local13 = shiftRight(local5, 8) & 0xff;
  local14 = local5 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  local8 = 0;
  yield* game.appendToFightList(object);
  for (;;) {
    if ((yield* sub13(local11)) === 0) {
      if ((yield* sub65(local9)) === 0) {
        if ((yield* sub13(local12)) === 0) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xf)) & EVENT.DEFEATED) === 0) {
            if ((yield* sub13(local13)) === 0) {
              if ((yield* sub65(local10)) === 0) {
                if ((yield* sub13(local14)) === 0) {
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x14)) & EVENT.DEFEATED) !==
                    0
                  ) {
                    local8 = 255;
                  }
                } else {
                  local8 = 255;
                }
              } else {
                local8 = 255;
              }
            } else {
              local8 = 255;
            }
          } else {
            local8 = 255;
          }
        } else {
          local8 = 255;
        }
      } else {
        local8 = 255;
      }
    } else {
      local8 = 255;
    }
    if (signed(local8) !== 0) {
      yield* game.fightListRemove(object);
      yield* game.addKarma(1);
      yield* run.leaveBodyAndResetRecord(object);
      return null;
    }
  }
}

// Script 253: no arguments.
export function* promptTarget(state) {
  yield* game.releaseNoticeWindows();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(2, 0x17, 9, 3, 0, 0x13 /* "Target:" */, 1);
  return null;
}

// Script 254: 1 argument.
export function* script254(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getActorStateFlags(0xadb /* "Mage" */)) & 1) !== 0) {
      yield* run.waypointShooterB(object, 4, 5, 2, 0x80, 4, 0, 5);
      return null;
    }
  }
}

// Script 255: 1 argument.
export function* script255(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x3f) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 8, 0x1a7, 0, 2);
  return null;
}

// Script 256: 1 argument.
export function* script256(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 4, 0x1a8, 0, 2);
  return null;
}

// Script 257: 1 argument.
export function* script257(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if (
      (truth((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) &
        (truth(((yield* game.getActorStateFlags(0xfc7 /* "Heavy Dude" */)) & 0x80) !== 0) ^
          0xffff)) !==
      0
    ) {
      yield* game.setActorStateFlags(0xfc7 /* "Heavy Dude" */, 0x80);
      yield* game.notice(5, 2, 0x15, 3, 0, 0x215 /* "LEVEL 6 NODE DEACTIVATED." */, 1);
      yield* game.confirmKey();
      yield* game.wait(EVENT.TIMER, 1);
    }
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 7, 0x1df, 0, 2);
  return null;
}

// Script 258: 1 argument.
export function* script258(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 8) !== 0) {
      yield* run.transferAccount(object, 0x2710, 0x21b, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x20) !== 0) {
      yield* run.transferAccount(object, 0x30d4, 0x21c, 4);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) !== 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFile(0x15b6);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xa, 0x1e4, 0, 3);
  return null;
}

// Script 259: 1 argument.
export function* script259(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x16c0);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 9, 0x1e5, 0, 3);
  return null;
}

// Script 25A: 1 argument.
export function* script25A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    if (((yield* game.getObjectRecordFlags(object)) & 0x40) !== 0) {
      yield* game.notice(
        2,
        2,
        0x1c,
        3,
        0x400,
        0xcd /* "Hey, where do you think you're going?" */,
        0xf0,
      );
    }
    return null;
  }
  return null;
}

// Script 25B: 4 arguments.
export function* transferAccount(state, arg0, arg1, arg2, arg3) {
  let object = 0,
    nuyen = 0,
    text = 0,
    bits = 0;
  object = arg0 & 0xff;
  nuyen = arg1;
  text = arg2;
  bits = arg3 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & bits) === 0) {
    yield* game.setObjectRecordFlagBits(object, bits);
    yield* game.addNuyen(nuyen);
  } else {
    text = 0x213;
  }
  yield* game.notice(8, 2, 0xf, 5, 0, text, 1);
  yield* game.confirmKey();
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 25C: 1 argument.
export function* script25C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getActorStateFlags(0xadb /* "Mage" */)) & 1) !== 0) {
      yield* run.waypointShooterB(object, 6, 7, 2, 0x80, 4, 0, 5);
      return null;
    }
  }
}

// Script 25D: 3 arguments.
export function* dataTerminal(state, arg0, arg1, arg2) {
  let object = 0,
    text = 0,
    columns = 0,
    local4 = 0,
    actor = 0;
  object = arg0 & 0xff;
  text = arg1;
  columns = arg2 & 0xff;
  if ((yield* game.hasFightTarget()) === 0) {
    local4 = yield* game.scriptAction(0x180);
  } else {
    local4 = yield* game.scriptAction(0x80);
  }
  if (local4 !== 0x80) {
    if (local4 === 0x100) {
      yield* run.promptUseOn();
      actor = yield* game.chooseNumber();
      if (actor !== 0xffff) {
        if (!(
          actor === 0x17a0 ||
          actor === 0x16c7 ||
          actor === 0x16f1 ||
          actor === 0x1722 ||
          actor === 0x16ff ||
          actor === 0x1737 ||
          actor === 0x173e ||
          actor === 0x176f ||
          actor === 0x16dc ||
          actor === 0x1745 ||
          actor === 0x16ce ||
          actor === 0x169d ||
          actor === 0x1792 ||
          actor === 0x178b ||
          actor === 0x17b5 ||
          actor === 0x16d5 ||
          actor === 0x17ae ||
          actor === 0x16f8 ||
          actor === 0x16b2 ||
          actor === 0x16a4 ||
          actor === 0x16b9 ||
          actor === 0x16e3 ||
          actor === 0x16ab ||
          actor === 0x174c ||
          actor === 0x1730 ||
          actor === 0x1768 ||
          actor === 0x1706 ||
          actor === 0x171b ||
          actor === 0x17a7 ||
          actor === 0x17bc ||
          actor === 0x1799 ||
          actor === 0x1753 ||
          actor === 0x170d ||
          actor === 0x1b7b
        )) {
          if ((yield* game.getActorKind(actor)) !== 0xb2) {
            yield* run.refuseToUseOn(actor);
          } else {
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
        } else {
          yield* game.endDialog();
          yield* game.setScriptVariable(
            0xc,
            yield* game.getActorStateProperty(yield* game.getObjectNumber(object)),
          );
          if (
            (truth(state.byte('GROUP_INDEX') > 0 && actor === 0x1b7b) &
              truth((yield* game.getScriptVariable(0xc)) !== 0x8b2)) ===
            0
          ) {
            yield* game.setActorStateFlagBits(actor, 0x80);
          } else {
            yield* game.notice(
              2,
              0x15,
              0x1d,
              3,
              0x400,
              0x25b /* "JAKE! You have the data! I can't do it!" */,
              0xf0,
            );
          }
        }
      }
    }
  } else {
    yield* game.notice(2, 0x15, columns, 3, 0x800, text, 0xf0);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 25E: 1 argument.
export function* script25E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFile(0x154d);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* run.transferAccount(object, 0x7d0, 0x218, 2);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0, 0x15f, 0, 5);
  return null;
}

// Script 25F: 1 argument.
export function* script25F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.activateElevator(0x175a);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  if (((yield* game.getActorStateFlags(0xfc7 /* "Heavy Dude" */)) & 0x80) === 0) {
    yield* run.jackIntoMatrix(object, 3, 0x1e0, 0, 2);
  } else {
    yield* run.jackIntoMatrix(object, 3, 0x1e0, 2, 2);
  }
  return null;
}
