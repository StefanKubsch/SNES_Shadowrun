// Scripts 360 to 37F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 360: 1 argument.
export function* script360(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script2F7(local0, 3, 2, 1, 0x1e);
  yield* run.dropNuyen15F(yield* run.leaveBody(local0));
  return null;
}

// Script 361: 1 argument.
export function* script361(state, arg0) {
  let object = 0,
    local1 = 0;
  block73: {
    object = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 0, 0);
    if (
      (yield* game.getObjectCoarseY(object)) >
      (yield* game.getObjectCoarseY(yield* game.getPlayerObject()))
    ) {
      for (;;) {
        local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
        if (
          (truth(less(yield* game.getDistanceToPlayer(object), 0x50)) |
            signed(local1) |
            truth(
              less(
                yield* game.getObjectCoarseY(object),
                word(0x50 + (yield* game.getObjectCoarseY(yield* game.getPlayerObject()))),
              ),
            )) !==
          0
        ) {
          yield* game.setObjectDirection(object, 4);
          yield* game.wait(1, 6);
          yield* game.talk(object, 0x2b);
          break block73;
        }
      }
    }
  }
  yield* game.setObjectRecordCount(object, 0x1e);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, 4);
  for (;;) {
    const t1 = yield* run.script221(object);
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      yield* game.addKarma(9);
      yield* game.fightListRemove(object);
      yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
      return null;
    }
  }
}

// Script 362: 1 argument.
export function* script362(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(local0, 0x20, 0xea60, 0x91);
  return null;
}

// Script 363: 1 argument.
export function* script363(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  for (;;) {
    yield* game.setObjectAnimation(object, 6);
    yield* game.wait(0x180, 0);
    yield* game.notice(2, 0x15, 0xf, 4, 0x800, 0x5f /* "The VDU displays - OUT OF ORDER" */, 0xc8);
    yield* game.setObjectAnimation(object, 1);
    yield* game.wait(1, 0xc8);
    yield* game.setObjectAnimation(object, 6);
  }
}

// Script 364: 1 argument.
export function* script364(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* game.keepActorStateFlagBits(0x1d96, 0xfffe);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 9, 0x1ea, 0, 4);
  return null;
}

// Script 365: 1 argument.
export function* script365(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x8d) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) !== 0) {
      yield* game.setActorStateFlagBits(0x171b, 0x40);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 5, 0x1eb, 0, 4);
  return null;
}

// Script 366: 1 argument.
export function* script366(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 4);
  yield* game.setObjectVelocity(object, 0, 0xfffc, 0);
  yield* game.wait(1, 0xf);
  yield* game.setObjectDirection(object, 6);
  yield* game.setObjectVelocity(object, 0xfffc, 0, 0);
  yield* game.wait(1, 0xbe);
  yield* game.clearObjectVelocity(object);
  for (;;) {
    yield* run.script045(object, 1);
    if (((yield* game.getScriptVariable(0x2a)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(object, 2, 0);
      yield* game.setObjectVelocity(object, 0, 4, 0);
      yield* game.wait(1, 0x96);
      yield* game.setScriptVariable(0x2c, word((yield* game.getScriptVariable(0x2c)) + 1));
      yield* game.changeScene(0x14, 0, 0xf2);
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 367: 1 argument.
export function* script367(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  for (;;) {
    yield* game.wait(1, 0x1e);
    if ((yield* game.getScriptVariable(0x2a)) <= 3) {
      block116: {
        if (((yield* game.randomByte()) & 1) === 0) {
          count = 3;
          for (;;) {
            const t4 = word((yield* game.getObjectCoarseHeight(object)) + 0xa);
            const t5 = yield* game.getObjectCoarseY(object);
            const t6 = yield* game.getObjectCoarseX(object);
            yield* game.createObject(0x91, t6, t5, t4, 0x1a9);
            yield* game.wait(1, 3);
            count = word(count - 1);
            if (count === 1) {
              yield* game.wait(1, word(((yield* game.randomByte()) & 0xff) + 0x78));
              break block116;
            }
          }
        } else {
          const t1 = word((yield* game.getObjectCoarseHeight(object)) + 0x14);
          const t2 = word((yield* game.getObjectCoarseY(object)) - 0xa);
          const t3 = yield* game.getObjectCoarseX(object);
          yield* game.createObject(0xbd /* "Ghoul" */, t3, t2, t1, 0x8d);
        }
      }
      yield* game.wait(1, word(((yield* game.randomByte()) & 0x1f) + 0x1e));
    }
  }
}

// Script 368: 1 argument.
export function* script368(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.addNuyen(0x32);
  return null;
}

// Script 369: 1 argument.
export function* script369(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* run.obtainDataFile(0x1562);
    }
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.modifySubLevelDoor(1);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 7, 0x1e9, 0, 4);
  return null;
}

// Script 36A: 1 argument.
export function* script36A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.modifySubLevelDoor(2);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  if (((yield* game.getObjectRecordFlags(object)) & 0x40) === 0) {
    yield* run.jackIntoMatrix(object, 9, 0x1ec, 0, 4);
  } else {
    yield* run.jackIntoMatrix(object, 9, 0x1ec, 2, 4);
  }
  return null;
}

// Script 36B: 1 argument.
export function* script36B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
      yield* run.modifySubLevelDoor(4);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xb, 0x1f1, 0, 4);
  return null;
}

// Script 36C: 6 arguments.
export function* script36C(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  yield* game.setObjectAnimation(object, local1);
  for (;;) {
    yield* game.wait(1, 0xa);
    if ((yield* game.testObjectCollision(object, local3)) === 0) {
      yield* game.playSoundEffect(object, local4, 0xff, 3);
      yield* game.setObjectAnimation(object, local2);
      yield* game.wait(8, 0);
      return null;
    }
  }
}

// Script 36D: 4 arguments.
export function* script36D(state, arg0, arg1, arg2, arg3) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2 & 0xff;
  local4 = arg3;
  local6 = word((yield* game.getObjectCoarseX(object)) - local1);
  local8 = word((yield* game.getObjectCoarseY(object)) - local1);
  local1 = word(local1 + local1);
  loop30: for (;;) {
    yield* game.setObjectAnimation(object, 1);
    const t1 = word(local8 + (yield* game.randomBelow(local1)));
    const t2 = word(local6 + (yield* game.randomBelow(local1)));
    yield* game.moveObjectStraightToPoint(object, t2, t1);
    for (;;) {
      const t3 = yield* game.wait(0x807, local3);
      local10 = t3;
      if ((local10 & 1) !== 0) {
        local10 = local10 | 4;
      }
      if ((local10 & 0x804) !== 0) {
        if ((local10 & 4) !== 0) {
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          yield* game.setObjectAnimation(object, 0);
          yield* game.wait(3, local4);
        }
        if ((local10 & 0x800) === 0) {
          continue loop30;
        }
        return null;
      }
    }
  }
}

// Script 36E: 1 argument.
export function* script36E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xbc9)) & 1) !== 0) {
    yield* game.removeObject(object);
    return null;
  }
  for (;;) {
    yield* game.wait(1, 0x7d0);
    yield* game.notice(4, 0x15, 6, 3, 0x400, 0x7b /* "Help!" */, 0x3c);
  }
}

// Script 36F: 1 argument.
export function* script36F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x68) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) !== 0) {
      yield* run.transferAccount(object, 0x61a8, 0x221, 2);
      yield* run.obtainDataFile(0x1570);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xa, 0x1ed, 0, 4);
  return null;
}

// Script 370: 1 argument.
export function* script370(state, arg0) {
  let object = 0,
    local1 = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, 0x5a);
  yield* game.setObjectArmour(object, 3);
  yield* game.keepObjectFlagBits(object, 0xfebf);
  for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0x7af)) & 1) !== 0) {
      block174: {
        yield* game.wait(1, 0x3c);
        yield* game.keepActorStateFlagBits(0x7af, 0xfffe);
        yield* game.appendToFightList(object);
        yield* game.setObjectActionAndDirection(object, 0, 0);
        yield* game.wait(1, 0x1e);
        yield* game.setObjectAnimation(object, 1);
        const t1 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0);
        local1 = t1 & 0xff;
        if (t1 === 0) {
          loop88: for (;;) {
            count = 8;
            for (;;) {
              yield* game.setObjectAnimation(object, 1);
              if (less(yield* game.getDistanceToPlayer(object), 0xc8)) {
                const t2 = yield* game.getObjectCoarseHeight(object);
                const t3 = yield* game.getObjectCoarseY(object);
                const t4 = yield* game.getObjectCoarseX(object);
                yield* game.createObject(0x78 /* "Jester Spirit" */, t4, t3, t2, 0x3e);
              }
              local1 = truth(((yield* game.wait(0x801, 0x32)) & 0x800) !== 0) & 0xff;
              count = word(count - 1);
              if ((truth(count === 0) | signed(local1)) !== 0) {
                if (signed(local1) === 0) {
                  local1 = truth(((yield* game.wait(0x801, 0xa0)) & 0x800) !== 0) & 0xff;
                }
                if (signed(local1) === 0) {
                  continue loop88;
                }
                break block174;
              }
            }
          }
        }
      }
      yield* game.addKarma(0x1a);
      yield* game.fightListRemove(object);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      yield* game.setActorStateFlagBits(0x7b6, 0x80);
      yield* game.setActorStateFlagBits(0x666, 1);
      return null;
    }
  }
}

// Script 371: 8 arguments.
export function* script371(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0,
    local13 = 0;
  function* sub19(in0) {
    local13 = in0 & 0xff;
    if (signed(local8) === 0) {
      if (signed(local12) === 0xffff) {
        local8 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
      } else {
        yield* game.setObjectAnimation(object, local3);
        yield* game.moveObjectStraightToWaypoint(object, local13);
        const t1 = truth(((yield* game.wait(0x805, 0x3c)) & 0x800) !== 0);
        local8 = t1 & 0xff;
        if (t1 === 0) {
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          if (less(yield* game.getDistanceBetweenObjects(object, signed(local12)), 0xfa)) {
            const t2 = word(((yield* game.randomByte()) & 0x3f) + 0xa);
            const t3 = yield* game.getPlayerObject();
            local8 = (yield* run.script235(object, t3, local5, local6, local7, 2, t2)) & 0xff;
          }
        }
      }
    }
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  local6 = arg6 & 0xff;
  local7 = arg7 & 0xff;
  local10 = yield* game.getSpriteMode(object);
  yield* game.setObjectRecordCount(object, local4);
  yield* game.setSpriteMode(object, 0);
  yield* game.setObjectActionAndDirection(object, 2, 5);
  yield* game.moveObjectStraightToWaypoint(object, local2);
  yield* game.wait(4, 0);
  yield* game.setSpriteMode(object, local10);
  yield* game.setObjectAnimation(object, 0);
  local8 = 0;
  yield* game.appendToFightList(object);
  for (;;) {
    local12 = (yield* game.chooseEnemyTarget(object)) & 0xff;
    yield* sub19(local1);
    if (signed(local8) === 0) {
      yield* sub19(local2);
    }
    if (signed(local8) !== 0) {
      yield* game.addKarma(0xb);
      yield* game.fightListRemove(object);
      yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
      return null;
    }
  }
}

// Script 372: 1 argument.
export function* script372(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x1e);
    yield* game.wait(1, 0x28);
    yield* game.notice(
      2,
      4,
      0x14,
      4,
      0x400,
      0x24e /* "Okay, wise guy! Prepare to lose your right to live!" */,
      0x78,
    );
    yield* game.wait(1, 0xa);
    yield* game.appendToFightList(object);
    if ((yield* run.script111(object, 0x102, 0, 0x300, 0x401, 0x204, 0x201)) === 0) {
      yield* game.notice(9, 5, 9, 3, 0x400, 0x24f /* "You! You..." */, 0x78);
      yield* game.addKarma(0xc);
      yield* game.fightListRemove(object);
      yield* run.leaveBodyAndResetRecord(object);
      yield* game.setActorStateFlagBits(0x1b66, 1);
      yield* game.wait(1, 0xc8);
    } else {
      yield* game.setActorStateFlagBits(0x1b66, 2);
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 373: 1 argument.
export function* script373(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* run.transferAccount(object, 0x2ee0, 0x222, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFile(0x1554);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0, 0x1ee, 0, 4);
  return null;
}

// Script 374: 1 argument.
export function* script374(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.walkToWaypoint(local0, 0);
  yield* run.script045(local0, 3);
  yield* game.notice(
    2,
    2,
    0x1b,
    4,
    0x400,
    0xfd /* "Why do you run? I will not hurt you, Jake. You know you can ..." */,
    0xf0,
  );
  yield* game.wait(1, 0x78);
  yield* run.script045(local0, 3);
  yield* game.wait(1, 0x78);
  yield* run.goToRoom(0xd9);
  return null;
}

// Script 375: 1 argument.
export function* script375(state, arg0) {
  let created = 0,
    local1 = 0;
  created = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(created)) !== 0) {
    if ((yield* game.scriptAction(0x100)) === 0x100) {
      yield* run.promptThrowAt();
      const t1 = yield* game.chooseUnderGlove(created);
      local1 = t1 & 0xff;
      if (t1 !== 0xffff) {
        if ((yield* game.decrementObjectStateCount(created)) !== 0) {
          yield* game.resetObjectRecordProperty(created);
        }
        yield* game.setObjectActionAndDirection(created, 0, 0);
        yield* game.endDialog();
        yield* game.addObjectHeight(created, 0x20);
        yield* game.wait(1, yield* game.jumpObjectTowardsObject(created, signed(local1)));
        yield* game.removeObject(created);
        const t2 = yield* game.getObjectCoarseHeight(created);
        const t3 = yield* game.getObjectCoarseY(created);
        const t4 = yield* game.getObjectCoarseX(created);
        created = (yield* game.createObject(0xb8, t4, t3, t2, 0x382)) & 0xff;
        yield* game.wait(1, 0xa);
        yield* game.blast(created, 0xd);
        return null;
      }
    }
  }
  yield* game.removeObject(created);
  return null;
}

// Script 376: 1 argument.
export function* script376(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 3) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.obtainDataFile(0x1569);
      yield* game.learnSpell(0x54);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 1, 0x1ef, 0, 4);
  return null;
}

// Script 377: 1 argument.
export function* script377(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, word((yield* game.randomBelow(3)) + 0xf));
  if (
    (yield* run.script076(
      object,
      3,
      0x25,
      0,
      5,
      0,
      word(0x46 + ((yield* game.randomByte()) & 0x1f)),
    )) === 0
  ) {
    yield* game.removeObject(object);
  } else {
    yield* run.dropNuyen15C(yield* run.leaveBody(object));
  }
  return null;
}

// Script 378: 1 argument.
export function* script378(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  for (;;) {
    if ((yield* game.wait(0x201, 1)) !== 1) {
      yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xf0);
    }
  }
}

// Script 379: 1 argument.
export function* script379(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.transferAccount(object, 0x1388, 0x223, 2);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* run.script0AE(object);
  yield* run.script342(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 2, 0x1f0, 0, 4);
  return null;
}

// Script 37A: 1 argument.
export function* script37A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.playSoundEffect(object, 0xa, 0xff, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 37B: 1 argument.
export function* script37B(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  object = arg0 & 0xff;
  yield* run.script089(object);
  for (;;) {
    block220: {
      local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
      const t1 = yield* run.script2AB(signed(local1), 0x100);
      local2 = t1;
      if (local2 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 === 0x100) {
            yield* run.promptUseOn();
            const t2 = yield* game.chooseNumber();
            local8 = t2;
            if (local8 !== 0xffff) {
              if (local8 !== 0x14eb) {
                if (((yield* game.getActorKindFlags(local8)) & 0x8000) === 0) {
                  yield* game.notice(0xa, 0x15, 0xc, 3, 0x800, 0x1ff /* "It won't budge." */, 0xf0);
                } else {
                  if (((yield* game.getActorKindFlags(local8)) & 0x4000) === 0) {
                    local4 = 9;
                  } else {
                    local4 = 8;
                  }
                  yield* game.notice(2, 0x15, 0x12, 3, 0x800, local4, 0x78);
                }
              } else {
                yield* game.endDialog();
                yield* game.setActorStateFlagBits(0x14eb, 1);
                local6 = 0xf0;
                for (;;) {
                  yield* game.playSoundEffect(object, 0x26, local6, 3);
                  yield* game.wait(1, 2);
                  local6 = word(local6 - 0x14);
                  if (local6 === 0) {
                    break block220;
                  }
                }
              }
            }
          }
        } else {
          yield* game.setObjectRecordPropertyFromGroup(object);
          yield* run.script04B();
          local1 = 255;
        }
      } else {
        yield* game.notice(7, 0x15, 0x11, 3, 0x800, 0x1fe /* "Rusted steel crowbar." */, 0xf0);
      }
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 37C: 1 argument.
export function* script37C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.clearObjectTask(object);
  return null;
}

// Script 37D: 1 argument.
export function* script37D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    for (;;) {
      yield* game.wait(1, 1);
      if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
        yield* game.keepObjectRecordFlagBits(object, 0x7f);
        yield* game.setObjectActionAndDirection(object, 0, 0);
        yield* game.wait(1, 0xb4);
        yield* game.setObjectAnimation(object, 1);
        yield* game.playSoundEffect(object, 0x16, 0xff, 3);
        yield* game.wait(8, 0);
        yield* game.setActorStateFlagBits(0xbbb, 0x80);
        yield* game.setActorStateFlagBits(0x3a3, 0x80);
        yield* game.wait(1, 1);
        yield* game.setObjectRecordFlagBits(object, 1);
        yield* game.removeObject(object);
        return null;
      }
    }
  } else {
    return null;
  }
}

// Script 37E: 1 argument.
export function* script37E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getStoryStage()) !== 1) {
    yield* run.script0AD(local0);
  } else {
    yield* run.script006(local0);
  }
  return null;
}

// Script 37F: 1 argument.
export function* script37F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22d /* "The Rust Stilettos gang have failed to fulfill their instruc..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}
