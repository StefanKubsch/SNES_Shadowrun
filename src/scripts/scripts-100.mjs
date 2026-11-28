// Scripts 100 to 11F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  EVENT,
  less,
  localByte,
  localWord,
  setLocalWord,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 100: 1 argument.
export function* script100(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x45);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectAnimation(object, 0);
  local1 = 0;
  for (;;) {
    yield* game.setObjectDirection(object, word(local1 + 3));
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(0x96 + (yield* game.randomBelow(0x64))));
    local1 = word(local1 + 1) & 3 & 0xff;
  }
}

// Script 101: 1 argument.
export function* waitUntilDefeated(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      return null;
    }
  }
}

// Script 102: 1 argument.
export function* script102(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xd2e /* "Heavy Dude" */)) & 0x80) === 0) {
    yield* run.talkOrStrikeBack(object, 0xd2e, 0, 0x73, 0x2000);
    yield* game.notice(5, 3, 0x10, 3, 0x400, 0x191 /* "A wise choice human." */, 0xb4);
    yield* game.removeObject(object);
    yield* game.addSceneObject(0xc, 0, 0, 0, 0, 0xd2e, 0x28);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 103: 1 argument.
export function* script103(state, arg0) {
  let object = 0,
    direction = 0,
    action = 0;
  function* sub5(in0, in1) {
    direction = in0 & 0xff;
    action = in1 & 0xff;
    yield* game.setObjectActionAndDirection(object, action, direction);
    if (
      ((yield* game.wait(EVENT.TALK | EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) &
        EVENT.DEFEATED) ===
      0
    ) {
      if (
        ((yield* game.wait(
          EVENT.TIMER | EVENT.TALK | EVENT.DEFEATED,
          word(0x64 + ((yield* game.randomByte()) & 0x7f)),
        )) &
          EVENT.DEFEATED) ===
        0
      ) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  object = arg0 & 0xff;
  for (;;) {
    if ((yield* sub5(3, 7)) === 0) {
      if ((yield* sub5(5, 8)) === 0) {
        if ((yield* sub5(5, 8)) === 0) {
          if ((yield* sub5(7, 7)) !== 0) {
            return null;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
}

// Script 104: 1 argument.
export function* script104(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 2);
  const t1 = yield* game.findNearestVisibleMember(object);
  local1 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    yield* game.playSoundEffect(object, 0x1e, 0xb4, 0xff);
    yield* game.playSoundEffect(object, 0x1e, 0x64, 0xff);
    yield* game.playSoundEffect(object, 0x1e, 0x50, 0xff);
    yield* game.wait(EVENT.TIMER, yield* game.moveObjectTowardsObject(object, signed(local1)));
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0xb8, t4, t3, t2, 0x382);
    yield* game.blast(object, 0xf);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 105: 1 argument.
export function* script105(state, arg0) {
  const locals = new Uint8Array(10);
  function* sub63(in0, in1) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x21a),
      localByte(locals, 3),
    );
    yield* game.wait(EVENT.TIMER, localWord(locals, 4));
  }
  function* sub36(in0, in1) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x99),
      localByte(locals, 3),
    );
    yield* game.wait(EVENT.TIMER, localWord(locals, 4));
  }
  function* sub5(in0, in1, in2, in3) {
    setLocalWord(locals, 3, in0);
    setLocalWord(locals, 5, in1);
    locals[7] = in2 & 0xff;
    setLocalWord(locals, 8, in3);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(localWord(locals, 3), 0x64, 0x64, 0x40, localWord(locals, 5)),
      localByte(locals, 7),
    );
    yield* game.wait(EVENT.TIMER, localWord(locals, 8));
  }
  function* sub91(in0, in1, in2, in3) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    locals[6] = in2 & 0xff;
    setLocalWord(locals, 7, in3);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a),
      localByte(locals, 3),
    );
    yield* game.wait(EVENT.TIMER, localWord(locals, 4));
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a),
      localByte(locals, 6),
    );
    yield* game.wait(EVENT.TIMER, localWord(locals, 7));
  }
  locals[0] = arg0 & 0xff;
  block779: {
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 0);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
      if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) !== 0) {
        yield* game.wait(EVENT.TIMER, 1);
        yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0xff7e);
        if ((state.matrix.dataBits & 0x80) !== 0) {
          yield* game.notice(8, 2, 0x10, 3, 0, 0x25a /* "PROGRAM DOWNLOADED" */, 1);
          yield* game.confirmKey();
          yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
          yield* game.setScriptVariable(0x20, 5);
          yield* game.setScriptVariable(0x24, 0);
          state.settings.options = 3;
          yield* game.changeRoom(0xa0);
          yield* game.wait(EVENT.TIMER, 1);
        }
      }
      yield* run.waitUntilDefeated(localByte(locals, 0));
      yield* game.setObjectRecordFlagBits(localByte(locals, 0), 1);
      yield* run.jackIntoMatrix(localByte(locals, 0), 0x10, 0xa0, 0, 3);
    } else {
      yield* game.setScriptVariable(0x2c, 1);
      setLocalWord(locals, 1, 8);
      for (;;) {
        yield* sub63(0xf, 2);
        yield* sub63(0xc, 1);
        yield* sub36(0x19, 3);
        yield* sub36(0xd, 5);
        yield* sub63(0x17, 5);
        yield* sub36(0xa, 4);
        yield* sub36(0x18, 6);
        setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
        if (localWord(locals, 1) === 0) {
          yield* sub5(0x55, 0x8a, 0xb, 0xa);
          yield* sub5(0x55, 0x8a, 0xe, 5);
          yield* sub5(0x55, 0x8a, 0x1a, 0x6e);
          yield* sub91(0x15, 5, 0x15, 5);
          yield* sub5(0x56, 0x8a, 0x14, 0x10);
          yield* sub5(0x7a, 0x2c3, 0x1b, 0xd);
          yield* sub5(0x7a, 0x2e6, 0x1c, 2);
          yield* sub5(0x7a, 0xdf, 0x1b, 2);
          yield* sub91(0x13, 2, 0xd, 0x14);
          yield* sub5(0x55, 0x8a, 0x12, 0x11);
          yield* sub91(0x16, 8, 0x18, 0xa);
          yield* sub5(0x56, 0x8a, 0x10, 0xd);
          setLocalWord(locals, 1, 3);
          for (;;) {
            yield* sub91(0xa, 5, 0xf, 2);
            yield* sub91(0x13, 4, 0xc, 4);
            yield* sub91(0x18, 8, 0x1a, 2);
            yield* sub91(0x19, 6, 0x19, 6);
            yield* sub5(0x55, 0x8a, 0x11, 0x11);
            yield* sub91(0x14, 5, 0x15, 2);
            yield* sub91(0xd, 4, 0x16, 2);
            yield* sub5(0x55, 0x8a, 0x12, 0x11);
            setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
            if (localWord(locals, 1) === 0) {
              yield* sub5(0x7a, 0x2bf, 0x1c, 0xd);
              yield* sub5(0x7a, 0x2e6, 0x1c, 2);
              yield* sub5(0x7a, 0xdf, 0x1b, 2);
              setLocalWord(locals, 1, 3);
              for (;;) {
                yield* sub5(0x55, 0x8a, 0xb, 0xa);
                yield* sub5(0x56, 0x8a, 0x18, 0x10);
                yield* sub5(0x8e, 0x8a, 0x14, 3);
                yield* sub5(0x55, 0x8a, 0x10, 1);
                yield* sub63(0xc, 5);
                yield* sub5(0x56, 0x8a, 0x15, 0x10);
                yield* sub5(0x8e, 0x8a, 0xd, 1);
                yield* sub36(0x18, 5);
                yield* sub5(0x55, 0x8a, 0xc, 1);
                yield* sub5(0x56, 0x8a, 0x1a, 6);
                yield* sub5(0x8e, 0x8a, 0x15, 3);
                yield* sub5(0x55, 0x8a, 0x11, 8);
                yield* sub5(0x56, 0x8a, 0x16, 5);
                yield* sub63(0x13, 5);
                yield* sub5(0x8e, 0x8a, 0xe, 7);
                setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
                if (localWord(locals, 1) === 0) {
                  break block779;
                }
              }
            }
          }
        }
      }
    }
  }
  yield* game.removeObject(localByte(locals, 0));
  return null;
}

// Script 106: 1 argument.
export function* script106(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.lockedDoor(object, 0xffff);
  return null;
}

// Script 107: 1 argument.
export function* script107(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x258);
  yield* game.setObjectAnimation(object, 1);
  yield* game.setObjectDialog(object, 0x44);
  yield* game.setObjectFlagBits(object, 0x2000);
  local1 = 0;
  for (;;) {
    yield* game.placeObjectOnWaypoint(object, 0);
    yield* game.moveObjectToWaypoint(object, 1);
    if (
      ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
      0
    ) {
      yield* game.moveObjectToWaypoint(object, 2);
      if (
        ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
        0
      ) {
        yield* game.moveObjectToWaypoint(object, 3);
        if (
          ((yield* game.wait(EVENT.TALK | EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
          0
        ) {
          yield* game.stopMotion(object);
          yield* game.wait(EVENT.TIMER, 0xa8c);
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

// Script 108: 1 argument.
export function* script108(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setActorStateFlagBits(0x1d96, 2);
  yield* run.grenadeHostageTaker(object);
  return null;
}

// Script 109: 1 argument.
export function* script109(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rideToNextStop(object, 0xffff);
  return null;
}

// Script 10A: no arguments.
export function* script10A(state) {
  yield* game.setScriptVariable(0x2e, 0xda);
  yield* game.setScriptVariable(0x30, 0x120);
  yield* game.changeRoom(0xf1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 10B: no arguments.
export function* script10B(state) {
  yield* game.setScriptVariable(0x2e, 0xf6);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 10C: 3 arguments, returns a word.
export function* patrolAndShootC(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    local6 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    object = 0;
  function* sub9() {
    if (!less(yield* game.getObjectRecordCount(object), 0xb)) {
      yield* game.setObjectAnimation(object, 2);
      if (local11 !== 0) {
        local11 = 0;
        yield* game.moveObjectStraightToWaypoint(object, local2 & 0xff);
      } else {
        local11 = 1;
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local2, 8));
      }
    } else {
      if (local11 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local11 = 255;
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.approachUntilInRange(object, 0x64, 0x3c, 0x32, 0xb, local11)) === 0) {
      local10 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local9 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(object, 4);
          yield* game.turnObjectToObject(object, signed(local9));
          if (
            ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
            0
          ) {
            yield* game.playSoundEffect(object, 0xc, 0xff, 0xff);
            yield* game.shootAtObject(object, signed(local9), 2, 1, 0xc, 1);
            if (
              (truth(text !== 0) &
                truth(less(yield* game.randomByte(), 0x1388)) &
                (signed(local6) ^ 0xffff)) !==
              0
            ) {
              yield* game.notice(5, 6, 0x14, 4, 0x400, text, 0xa0);
              local6 = 255;
            }
          } else {
            return 0xffff;
          }
        }
        if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) === 0) {
          if (
            (truth(local10 === 5) |
              truth(less(yield* game.getObjectRecordCount(object), 0xb) && local11 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local10 = word(local10 + 1) & 0xff;
        } else {
          return 0xffff;
        }
      }
    } else {
      return 0xffff;
    }
  }
  local0 = arg0;
  local2 = arg1;
  text = arg2;
  local6 = 0;
  object = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, 3);
  local11 = 0;
  for (;;) {
    if ((yield* sub9()) !== 0) {
      yield* game.addKarma(word((yield* game.randomBelow(6)) + 2));
      yield* game.fightListRemove(object);
      return yield* run.leaveBodyAndResetRecord(object);
    }
  }
}

// Script 10D: 3 arguments.
export function* ratShamanFight(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local7 = 0,
    local9 = 0,
    object2 = 0,
    waypoint = 0,
    object = 0,
    local13 = 0;
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  object = shiftRight(local0, 8) & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  yield* game.setObjectRecordCount(object, 0x46);
  local6 = 0;
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, 4);
  local13 = 0;
  if ((yield* game.getScriptVariable(0x2c)) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x12c);
  }
  for (;;) {
    local7 = yield* game.randomBelow(5);
    if (local7 !== 0) {
      if (local7 !== 1) {
        if (local7 !== 2) {
          if (local7 !== 3) {
            waypoint = local4 & 0xff & 0xff;
          } else {
            waypoint = shiftRight(local4, 8) & 0xff;
          }
        } else {
          waypoint = local2 & 0xff & 0xff;
        }
      } else {
        waypoint = shiftRight(local2, 8) & 0xff;
      }
    } else {
      waypoint = local0 & 0xff & 0xff;
    }
    if (local13 !== waypoint) {
      yield* game.setObjectAnimation(object, 2);
      yield* game.moveObjectToWaypoint(object, waypoint);
      local6 =
        truth(((yield* game.wait(EVENT.ARRIVED | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) !== 0) &
        0xff;
    }
    local13 = waypoint & 0xff;
    if (signed(local6) === 0) {
      const t1 = yield* game.chooseEnemyTarget(object);
      local9 = t1 & 0xff;
      if (t1 !== 0xffff) {
        yield* game.turnObjectToObject(object, signed(local9));
        yield* game.setObjectAnimation(object, 7);
        yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        yield* game.setObjectAnimation(object, 4);
        yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
        const t2 = truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(0xa + ((yield* game.randomByte()) & 0x1f)),
          )) &
            EVENT.DEFEATED) !==
            0,
        );
        local6 = t2 & 0xff;
        if (t2 === 0) {
          if (
            (truth(((yield* game.randomByte()) & 7) === 0) &
              (truth((yield* game.getScriptVariable(0x2c)) !== 0) ^ 0xffff)) ===
            0
          ) {
            const t6 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
            const t7 = yield* game.getObjectCoarseY(object);
            const t8 = yield* game.getObjectCoarseX(object);
            yield* game.createObject(0xdc, t8, t7, t6, 0x160);
          } else {
            const t3 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
            const t4 = yield* game.getObjectCoarseY(object);
            const t5 = yield* game.getObjectCoarseX(object);
            yield* game.createObject(0x100, t5, t4, t3, 0x268);
          }
        }
        yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
        yield* game.setObjectAnimation(object, 8);
      } else {
        yield* game.setObjectAnimation(object, 0);
      }
      local6 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x3c)) & EVENT.DEFEATED) !== 0) &
        0xff;
    }
    if (signed(local6) !== 0) {
      yield* game.addKarma(0x14);
      yield* game.fightListRemove(object);
      object2 = (yield* run.leaveBodyAndResetRecord(object)) & 0xff;
      yield* game.wait(EVENT.TIMER, 0x14);
      const t9 = yield* game.getObjectCoarseHeight(object2);
      const t10 = yield* game.getObjectCoarseY(object2);
      const t11 = yield* game.getObjectCoarseX(object2);
      yield* game.createObject(0x9e /* "Nuyen" */, t11, t10, t9, 0x3a6);
      yield* game.setActorStateFlagBits(0x1531 /* "Dog spirit" */, 1);
      yield* game.setScriptVariable(0x28, word((yield* game.getScriptVariable(0x28)) + 1));
      const t12 = yield* game.getObjectCoarseHeight(object2);
      const t13 = yield* game.getObjectCoarseY(object2);
      const t14 = yield* game.getObjectCoarseX(object2);
      yield* game.createObject(0x78 /* "Jester Spirit" */, t14, t13, t12, 0x12f);
      yield* game.playSoundEffect(object, 0x56, 0xff, 3);
      yield* game.markTopic(0x27 /* "Rat" */);
      yield* game.wait(EVENT.TIMER, 0x190);
      return null;
    }
  }
}

// Script 10E: 1 argument.
export function* enterWithoutRunners(state, arg0) {
  let room = 0;
  room = arg0;
  if (state.party.lastIndex > 0) {
    if (state.party.lastIndex <= 2) {
      yield* game.notice(
        5,
        6,
        0x16,
        4,
        0x400,
        0x142 /* "Jake, I don't want to go in there. I will wait outside." */,
        1,
      );
    } else {
      yield* game.notice(5, 6, 0x14, 3, 0x400, 0x141 /* "We will wait outside Jake." */, 1);
    }
    yield* game.confirmKey();
  }
  yield* game.changeRoom(room);
  return null;
}

// Script 10F: 1 argument.
export function* script10F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (less(state.combat.fightUnread, 0xc)) {
    state.combat.fightUnread = word(state.combat.fightUnread + 1);
    const t1 = (yield* game.getObjectArmour(object)) & 7;
    const t2 = shiftRight(yield* game.getObjectArmour(object), 3);
    yield* game.setObjectActionAndDirection(object, t2, t1);
    yield* game.setObjectVelocity(object, 0, 0, 1);
    yield* game.wait(EVENT.TIMER, 0x28);
    state.combat.fightUnread = word(state.combat.fightUnread - 1);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 110: 1 argument.
export function* script110(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0xf);
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 7, 3);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
    yield* game.setObjectActionAndDirection(object, 7, 3);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
  }
}

// Script 111: 7 arguments, returns a word.
export function* guardRoute(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
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
        if (text !== 0 && text !== 0xffff) {
          yield* game.notice(2, 5, 0x18, 3, 0x400, text, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.approachUntilInRange(object, 0x64, 0x3c, 0x37, 0xf, local14)) === 0) {
      block387: {
        local16 = (yield* game.chooseEnemyTarget(object)) & 0xff;
        if (!(less(yield* game.getDistanceToPlayer(object), 0x78) && signed(local16) !== 0xffff)) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(object, 4);
          yield* game.turnObjectToPlayer(object);
          if (
            ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
            0
          ) {
            local17 = 0;
            for (;;) {
              yield* game.setObjectAnimation(object, 5);
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
                if (text !== 0xffff) {
                  if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
                    return 0xffff;
                  }
                }
                if (local17 === 3) {
                  yield* game.setObjectAnimation(object, 6);
                  if (
                    ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) &
                      EVENT.DEFEATED) ===
                    0
                  ) {
                    break block387;
                  }
                  return 0xffff;
                }
                local17 = word(local17 + 1);
              } else {
                return 0xffff;
              }
            }
          } else {
            return 0xffff;
          }
        }
      }
      if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) === 0) {
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
  local8 = arg4;
  local10 = arg5;
  local12 = arg6;
  object = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 0);
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

// Script 112: no arguments.
export function* script112(state) {
  yield* game.setScriptVariable(0x2e, 0xdf);
  yield* game.setScriptVariable(0x30, 0x121);
  yield* game.changeRoom(0xf1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 113: no arguments.
export function* script113(state) {
  yield* game.setScriptVariable(0x2e, 0xce);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 114: 1 argument.
export function* script114(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 3);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.wait(EVENT.TIMER, 1);
  for (;;) {
    yield* game.bobObject(object);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0xff7f);
      yield* game.setObjectActionAndDirection(object, 4, 3);
      yield* game.wait(EVENT.TIMER, 0x1d);
      yield* game.setObjectActionAndDirection(object, 2, 3);
    }
    yield* game.wait(EVENT.TIMER, 1);
    if (state.motion.circleLeaderAlive === 0) {
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 115: 1 argument.
export function* script115(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block37: {
    object = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(object)) === 0) {
      yield* game.keepObjectFlagBits(object, 0);
      yield* game.clearObjectVelocity(object);
      for (;;) {
        yield* game.wait(EVENT.TIMER, 6);
        if (((yield* game.getObjectRecordFlags(object)) & 0x40) !== 0) {
          yield* game.setObjectActionAndDirection(object, 0, 0);
          break block37;
        }
      }
    }
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x100);
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* game.notice(
            3,
            0x15,
            0x1a,
            3,
            0x800,
            0x204 /* "I can't use it without a Detonator." */,
            0xf0,
          );
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
        yield* run.combineTimeBomb();
      }
    } else {
      yield* game.notice(7, 0x15, 0x11, 3, 0x800, 0x201 /* "It needs a Detonator." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 116: 1 argument.
export function* script116(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.PICK_UP, 0);
  yield* game.setScriptVariable(0xa, 0xffff);
  yield* game.notice(2, 2, 0x1c, 3, 0, 0x21 /* "INVINCIBILITY CHEAT FOR JAKE" */, 0x190);
  yield* game.removeObject(object);
  return null;
}

// Script 117: 1 argument.
export function* script117(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.lockedCabinet(object, 0x8c, 3, 0x168f);
  return null;
}

// Script 118: 1 argument.
export function* offerArenaFight(state, arg0) {
  let text = 0;
  text = arg0;
  if (((yield* game.getActorStateFlags(0x1b66 /* "Arena owner" */)) & 0x80) === 0) {
    yield* game.topicText(text);
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0xe2 /* "No? You not warrior type!?" */);
    } else {
      yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 4);
      yield* game.endDialog();
    }
  } else {
    yield* game.topicText(0xe1 /* "No more fighters left. You is one tough dude!" */);
  }
  return null;
}

// Script 119: no arguments.
export function* script119(state) {
  yield* run.enterWithoutRunners(0x1dc);
  return null;
}

// Script 11A: no arguments.
export function* script11A(state) {
  yield* game.setScriptVariable(0x2e, 0xfd);
  yield* game.setScriptVariable(0x30, 0x122);
  yield* game.changeRoom(0xf1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 11B: no arguments.
export function* script11B(state) {
  yield* game.setScriptVariable(0x2e, 0xe6);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 11C: 1 argument.
export function* script11C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.matrix.downloadBits & 0x80) !== 0) {
      yield* run.obtainDataFile(0x15a1);
    }
    if ((state.matrix.downloadBits & 3) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setActorStateFlagBits(0xdc1 /* "Heavy Dude" */, 2);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 1, 0x160, 0, 1);
  return null;
}

// Script 11D: no arguments.
export function* script11D(state) {
  yield* game.notice(2, 2, 0x1c, 3, 0, 0x25f /* "Winter CES'93 Las Vegas - Warp!" */, 0xa);
  yield* game.setScriptVariable(0x16, 1);
  state.jake.magic = 4;
  state.jake.computer = 5;
  state.jake.spells.invisibility = 2;
  state.jake.spells.summonSpirit = 2;
  state.jake.spells.powerball = 2;
  state.jake.spells.freeze = 2;
  state.jake.spells.heal = 2;
  yield* game.restoreRunners();
  yield* game.confirmKey();
  yield* game.changeRoom(0xd2);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 11E: no arguments.
export function* script11E(state) {
  yield* game.learnSpell(0x51);
  return null;
}

// Script 11F: 1 argument.
export function* script11F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x11,
      0x1c,
      9,
      0x800,
      0x230 /* "The mage Akimi could pose a threat to the security of the AI..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}
