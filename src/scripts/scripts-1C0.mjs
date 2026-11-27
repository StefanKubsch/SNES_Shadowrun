// Scripts 1C0 to 1DF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 1C0: 1 argument.
export function* script1C0(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2F8(object, 0x159, 1);
  return null;
}

// Script 1C1: 1 argument.
export function* script1C1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.setActorStateFlagBits(0x1f4f, 1);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.placeObjectOnWaypoint(object, 1);
      yield* game.setSpriteMode(object, 0x8001);
      yield* game.setObjectActionAndDirection(object, 7, 3);
      yield* game.wait(EVENT.TALK, 0);
      yield* game.talk(object, 0xd);
      yield* game.setSpriteMode(object, 0);
      yield* game.setObjectActionAndDirection(object, 1, 0);
      yield* game.setObjectVelocity(object, 0, 2, 0);
      yield* game.wait(EVENT.TIMER, 0x19);
      yield* game.moveObjectToWaypoint(object, 0);
      yield* game.wait(EVENT.ARRIVED, 0);
      yield* game.stopMotion(object);
      yield* game.setObjectActionAndDirection(object, 0, 0);
      yield* game.wait(EVENT.TIMER, 0xc8);
      yield* game.setObjectActionAndDirection(object, 1, 4);
      yield* game.setObjectVelocity(object, 0, 0xfffe, 0);
      yield* game.wait(EVENT.TIMER, 0x19);
      yield* game.moveObjectToWaypoint(object, 1);
      yield* game.wait(EVENT.TIMER, 0x78);
      yield* game.notice(2, 2, 0x15, 3, 0x400, 0x7f /* "Here ya go, your favourite!" */, 0x12c);
      yield* game.wait(EVENT.ARRIVED, 0);
      yield* game.stopMotion(object);
      yield* game.setObjectRecordFlagBits(object, 1);
      yield* game.setActorStateFlagBits(0xbd7, 0x80);
      yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
    } else {
      yield* game.placeObjectOnWaypoint(object, 1);
      yield* game.setSpriteMode(object, 0x8001);
      yield* game.setObjectDialog(object, 0xe);
      yield* game.setObjectActionAndDirection(object, 7, 3);
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 0xc8);
      yield* game.setObjectVelocity(object, 2, 0, 0);
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x1e);
      yield* game.clearObjectVelocity(object);
      yield* game.wait(EVENT.TALK, 0);
    }
  }
}

// Script 1C2: 1 argument, returns a word.
export function* dropNuyen164(state, arg0) {
  let object = 0,
    created = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
  created = (yield* game.createObject(0x9e /* "Nuyen" */, t3, t2, t1, 0x164)) & 0xff;
  yield* game.setSpriteMode(created, yield* game.getSpriteMode(object));
  return created;
}

// Script 1C3: 1 argument.
export function* script1C3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0A0(object, 0);
  return null;
}

// Script 1C4: no arguments.
export function* script1C4(state) {
  yield* run.enterWithoutRunners(0xbd);
  return null;
}

// Script 1C5: 1 argument.
export function* script1C5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2F8(object, 0x158, 0);
  return null;
}

// Script 1C6: 1 argument.
export function* script1C6(state, arg0) {
  let object = 0,
    local1 = 0;
  block264: {
    object = arg0 & 0xff;
    yield* game.keepObjectRecordFlagBits(object, 0xffbf);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      if (((yield* game.getObjectRecordFlags(object)) & 2) !== 0) {
        yield* game.notice(3, 0x16, 0x13, 3, 0x800, 0x6d /* "Hey, this looks familiar!" */, 0xb4);
        yield* game.setObjectRecordFlagBits(object, 2);
      }
      yield* game.setObjectActionAndDirection(object, 6, 5);
      local1 = 0;
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE, 0xf0)) & EVENT.EXAMINE) === 0) {
          yield* game.playSoundEffect(object, 0x50, 0xff, 3);
          yield* game.wait(EVENT.TIMER, 0xa);
          const t1 = yield* game.getObjectCoarseHeight(object);
          const t2 = yield* game.getObjectCoarseY(object);
          const t3 = word((yield* game.getObjectCoarseX(object)) + 4);
          yield* game.createObject(0xe6, t3, t2, t1, 0x99);
          yield* game.wait(EVENT.TIMER, 0xa);
          yield* game.playSoundEffect(object, 0x50, 0xff, 3);
        } else {
          local1 = 255;
        }
        if (signed(local1) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 0x41);
          yield* game.setObjectAnimation(object, 1);
          yield* game.notice(
            2,
            0x15,
            0x17,
            3,
            0x800,
            0x6e /* "There is a recorded message." */,
            0xf0,
          );
          yield* game.wait(EVENT.TIMER, 0x64);
          yield* game.setObjectAnimation(object, 2);
          yield* game.notice(2, 2, 0x12, 3, 0x400, 0x6f /* "Cancel your run, Jake!" */, 0xf0);
          yield* game.wait(EVENT.TIMER, 0xc8);
          yield* game.notice(
            4,
            4,
            0x11,
            4,
            0x400,
            0x70 /* "Hand over the files. We mean business!" */,
            0xf0,
          );
          yield* game.wait(EVENT.TIMER, 0xc8);
          yield* game.notice(0x13, 6, 8, 3, 0x400, 0x71 /* "Drake." */, 0x78);
          yield* game.wait(EVENT.TIMER, 0xc8);
          yield* game.setObjectAnimation(object, 0);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.setObjectAnimation(object, 6);
          yield* game.keepObjectRecordFlagBits(object, 0xffbf);
          break block264;
        }
      }
    }
  }
  yield* game.keepObjectRecordFlagBits(object, 3);
  yield* run.usePhone(object);
  return null;
}

// Script 1C7: 5 arguments.
export function* script1C7(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    local6 = 0,
    text2 = 0,
    local10 = 0,
    object = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0;
  function* sub13() {
    if (!less(yield* game.getObjectRecordCount(object), 0xf)) {
      yield* game.setObjectAnimation(object, 2);
      if (local10 !== 1) {
        if (local10 !== 3) {
          const t1 = yield* game.chooseEnemyTarget(object);
          local13 = t1 & 0xff;
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
      local10 = word(local10 + 1) & 3 & 0xff;
    } else {
      if (local10 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local10 = 255;
        if (text !== 0) {
          yield* game.notice(2, 5, 0x1a, 4, 0x400, text, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.script241(object, 0x64, 0x3c, 0x28, 0xf, local10)) === 0) {
      local14 = 0;
      for (;;) {
        local13 = (yield* game.chooseEnemyTarget(object)) & 0xff;
        if (!(less(yield* game.getDistanceToPlayer(object), 0x64) && signed(local13) !== 0xffff)) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 6)) & EVENT.HIT) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(object, 4);
          yield* game.turnObjectToPlayer(object);
          if (((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) === 0) {
            yield* game.playSoundEffect(object, 0xc, 0xff, 0xff);
            yield* game.shootAtObject(
              object,
              yield* game.getPlayerObjectCopy(),
              shiftRight(local6, 8),
              0,
              local6 & 0xff,
              1,
            );
            if (
              (truth(text2 !== 0) &
                truth(less(yield* game.randomByte(), 0x1388)) &
                (signed(local12) ^ 0xffff)) !==
              0
            ) {
              yield* game.notice(4, 6, 0x12, 3, 0x400, text2, 0xa0);
              local12 = 255;
            }
          } else {
            return 0xffff;
          }
        }
        if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) === 0) {
          if (
            (truth(local14 === 5) |
              truth(less(yield* game.getObjectRecordCount(object), 0xf) && local10 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local14 = word(local14 + 1) & 0xff;
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
  local6 = arg3;
  text2 = arg4;
  local12 = 0;
  object = local0 & 0xff & 0xff;
  local10 = 0;
  for (;;) {
    if ((yield* sub13()) !== 0) {
      return null;
    }
  }
}

// Script 1C8: 3 arguments.
export function* script1C8(state, arg0, arg1, arg2) {
  let object = 0,
    action = 0,
    direction = 0;
  object = arg0 & 0xff;
  action = arg1 & 0xff;
  direction = arg2 & 0xff;
  yield* game.setObjectActionAndDirection(object, action, direction);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.wait(EVENT.TIMER, 1);
  for (;;) {
    if (direction !== 3) {
      yield* game.bobSecondObject(object);
    } else {
      yield* game.bobObject(object);
    }
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(object, 4, 3);
      yield* game.keepObjectRecordFlagBits(object, 0xff7f);
      yield* game.wait(EVENT.TIMER, 0x1d);
      yield* game.setObjectActionAndDirection(object, action, direction);
    }
    yield* game.wait(EVENT.TIMER, 1);
    if (state.word('CIRCLE_LEADER_ALIVE') === 0) {
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1C9: 1 argument.
export function* script1C9(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.walkToWaypoint(object, 7);
  yield* run.walkToWaypoint(object, 1);
  yield* run.shootRandomTargets(object, 3);
  yield* run.walkToWaypoint(object, 0);
  yield* game.notice(
    7,
    2,
    0x12,
    4,
    0x400,
    0xfa /* "Tell me Jake, did you guess or did you know?" */,
    0xf0,
  );
  yield* run.shootRandomTargets(object, 7);
  yield* run.walkToWaypoint(object, 1);
  yield* run.shootRandomTargets(object, 4);
  yield* run.goToRoom(0xd6);
  return null;
}

// Script 1CA: 1 argument.
export function* script1CA(state, arg0) {
  let object = 0,
    waypoint = 0;
  object = arg0 & 0xff;
  waypoint = (yield* game.getObjectCoarseX(object)) & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.placeObjectOnWaypoint(object, waypoint);
  yield* run.script0AE(object);
  yield* game.wait(EVENT.TIMER, 0x320);
  yield* game.setObjectActionAndDirection(object, 0, 1);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  return null;
}

// Script 1CB: 1 argument.
export function* script1CB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2F8(object, 0xaa, 0);
  return null;
}

// Script 1CC: 1 argument.
export function* script1CC(state, arg0) {
  let object = 0,
    x = 0,
    y = 0;
  function* sub61(in0, in1) {
    x = in0;
    y = in1;
    yield* game.createObject(0x55, x, y, 0x47, 0x2be);
    yield* game.wait(EVENT.TIMER, 6);
  }
  function* sub5(in0, in1) {
    x = in0;
    y = in1;
    yield* game.notice(2, 2, 0x1c, 3, 0x400, y, 0xfa);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 0xa);
      yield* game.panSongLevelToObject(
        0xffff,
        word(
          0xff -
            shiftRight(
              yield* game.getDistanceBetweenObjects(object, yield* game.getPlayerObjectCopy()),
              1,
            ),
        ),
      );
      x = word(x - 0xa);
      if (x === 0) {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  if (
    (truth((yield* game.getStoryStage()) === 1) |
      (truth(((yield* game.getObjectRecordFlags(object)) & 1) !== 0) ^ 0xffff)) ===
    0
  ) {
    return null;
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0xa);
    if ((yield* game.getDistanceToPlayer(object)) <= 0x64) {
      yield* game.setObjectFlagBits(object, 1);
      yield* game.wait(EVENT.TIMER, 0x3c);
      yield* game.notice(7, 2, 0x11, 3, 0, 0x73 /* "Ladies and gentlemen..." */, 0x78);
      yield* game.wait(EVENT.TIMER, 0x82);
      yield* game.notice(9, 0x13, 0xd, 3, 0, 0x74 /* "Maria Mercurial!" */, 0x78);
      yield* game.wait(EVENT.TIMER, 0x14);
      yield* sub61(0x24d, 0x241);
      yield* sub61(0x239, 0x241);
      yield* sub61(0x225, 0x241);
      yield* sub61(0x211, 0x241);
      yield* sub61(0x211, 0x255);
      yield* sub61(0x211, 0x269);
      yield* sub61(0x211, 0x27d);
      yield* game.wait(EVENT.TIMER, 0xa);
      yield* sub61(0x211, 0x27d);
      yield* sub61(0x211, 0x269);
      yield* sub61(0x211, 0x255);
      yield* sub61(0x211, 0x241);
      yield* sub61(0x225, 0x241);
      yield* sub61(0x239, 0x241);
      yield* sub61(0x24d, 0x241);
      yield* game.wait(EVENT.TIMER, 0x28);
      for (;;) {
        yield* sub5(0xf0, 0x75);
        yield* sub5(0x1e0, 0x76);
        yield* sub5(0xf0, 0x77);
        yield* sub5(0x1e0, 0x78);
        yield* sub5(0xf0, 0x79);
        yield* sub5(0x1e0, 0x7a);
        yield* game.wait(EVENT.TIMER, 0xc8);
      }
    } else {
      yield* game.panSongLevelToObject(
        0xffff,
        word(
          0xff -
            shiftRight(
              yield* game.getDistanceBetweenObjects(object, yield* game.getPlayerObjectCopy()),
              1,
            ),
        ),
      );
    }
  }
}

// Script 1CD: 3 arguments, returns a word.
export function* script1CD(state, arg0, arg1, arg2) {
  let object = 0,
    frames = 0,
    frames2 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  frames = arg1;
  frames2 = arg2;
  yield* game.setObjectAnimation(object, 7);
  const t1 = yield* game.wait(
    EVENT.ANIMATION_END |
      EVENT.EXAMINE |
      EVENT.OPEN |
      EVENT.CLOSE |
      EVENT.HIT |
      EVENT.TARGET |
      EVENT.MOVE_TO,
    0,
  );
  local5 = t1;
  if ((local5 & 8) === 0) {
    yield* game.setObjectAnimation(object, 0);
  } else {
    yield* game.setObjectAnimation(object, 4);
    const t2 = yield* game.wait(
      EVENT.TIMER |
        EVENT.EXAMINE |
        EVENT.OPEN |
        EVENT.CLOSE |
        EVENT.HIT |
        EVENT.TARGET |
        EVENT.MOVE_TO,
      frames,
    );
    local5 = t2;
    if ((local5 & 1) === 0) {
      yield* game.setObjectAnimation(object, 0);
    } else {
      yield* game.spellMenu(object);
      if (signed(state.byte('SPELL_TARGET_OBJECT')) !== 0xffff) {
        yield* game.turnObjectToObject(object, signed(state.byte('SPELL_TARGET_OBJECT')));
      }
      yield* game.setObjectAnimation(object, 8);
      local5 = yield* game.wait(
        EVENT.TIMER |
          EVENT.TALK |
          EVENT.EXAMINE |
          EVENT.OPEN |
          EVENT.CLOSE |
          EVENT.HIT |
          EVENT.TARGET,
        frames2,
      );
    }
  }
  return local5;
}

// Script 1CE: 1 argument.
export function* script1CE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x7b6)) & 0x80) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* run.script399(object, 5, 0xa, 0x64);
    yield* game.setObjectArmour(object, 2);
  }
  return null;
}

// Script 1CF: 1 argument.
export function* script1CF(state, arg0) {
  let object = 0,
    text = 0,
    local3 = 0;
  object = arg0 & 0xff;
  if (
    (truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x21c) &
      truth((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) > 0x1ea)) !==
    0
  ) {
    const t1 = yield* game.getObjectNumber(object);
    local3 = t1;
    if (local3 !== 0xf73) {
      if (local3 !== 0xf03) {
        if (local3 !== 0xf50) {
          if (local3 !== 0xf5e) {
            text = 0x1b7;
          } else {
            text = 0x1b6;
          }
        } else {
          text = 0x1b5;
        }
      } else {
        text = 0x1b4;
      }
    } else {
      text = 0x1b3;
    }
    yield* game.notice(0xb, 2, 9, 3, 0, text, 0xf0);
  }
  yield* run.script06F(0x175a);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 1D0: 1 argument.
export function* script1D0(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.waitUntilDefeated(object);
    yield* run.script0AE(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    const t1 = yield* run.script2AB(signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0xe, 3, 0x800, 0x84 /* "Shiny Dog Collar." */, 0xf0);
      yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1D1: 1 argument.
export function* script1D1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* run.walkToWaypoint(object, 2);
  yield* game.setObjectActionAndDirection(object, 0, 7);
  yield* game.wait(EVENT.TIMER, 0x270f);
  return null;
}

// Script 1D2: 1 argument.
export function* script1D2(state, arg0) {
  let object = 0,
    text = 0,
    local3 = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) > 0x203) {
    const t1 = yield* game.getObjectNumber(object);
    local3 = t1;
    if (local3 !== 0xd82) {
      if (local3 !== 0xd66) {
        if (local3 !== 0xcd3) {
          text = 0x1b6;
        } else {
          text = 0x1b5;
        }
      } else {
        text = 0x1b4;
      }
    } else {
      text = 0x1b3;
    }
    yield* game.notice(0xb, 2, 9, 3, 0, text, 0xf0);
  }
  yield* run.script06F(0x16c0);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 1D3: 1 argument.
export function* script1D3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    yield* game.notice(4, 0x15, 0x17, 3, 0x800, 0x1fb /* "They are bright green leaves." */, 0xf0);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1D4: 1 argument.
export function* script1D4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.releaseGlove();
  state.setWord('ROOM', 0, yield* game.getScriptVariable(6));
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0xc8);
  yield* game.restoreRunners();
  yield* game.mainMenu();
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* game.setObjectActionAndDirection(object, 0, 1);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.changeRoom(yield* game.getScriptVariable(6));
  return null;
}

// Script 1D5: 1 argument.
export function* script1D5(state, arg0) {
  let object = 0,
    object3 = 0,
    object2 = 0,
    local3 = 0;
  function* sub5(in0) {
    object2 = in0 & 0xff;
    yield* game.releaseObjectGraphics(object2);
    const t1 = yield* game.getObjectCoarseHeight(object2);
    const t2 = yield* game.getObjectCoarseY(object2);
    local3 = (yield* game.createObject(0x99 /* "body" */, object2, t2, t1, 0x90)) & 0xff;
    yield* game.wait(EVENT.TIMER, 5);
    yield* game.resetObjectRecordProperty(object2);
    yield* game.wait(EVENT.TIMER, 0xa);
    return local3;
  }
  object = arg0 & 0xff;
  object3 = object & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setObjectFlagBits(object, 0x40);
  if (((yield* game.getObjectRecordFlags(object)) & 2) === 0) {
    yield* game.setObjectRecordFlagBits(object, 2);
    yield* game.wait(EVENT.TIMER, 0x64);
    yield* game.playSoundEffect(0xffff, 0xc, 0xff, 3);
    yield* game.wait(EVENT.TIMER, 0x14);
    yield* game.playSoundEffect(0xffff, 0x14, 0xff, 3);
    yield* game.wait(EVENT.TIMER, 0x64);
    yield* game.notice(
      4,
      2,
      0x19,
      4,
      0x400,
      0x45 /* "Looks like you took a wrong turn drekhead. It'll be your las..." */,
      0xf0,
    );
  } else {
    yield* game.wait(EVENT.TIMER, 0xdc);
  }
  yield* game.appendToFightList(object);
  yield* run.script251(object, 0, 0x47, 0x40a, 0x100, 0x300, 0x50);
  yield* game.addKarma(1);
  yield* game.fightListRemove(object);
  const t3 = yield* sub5(object);
  object = t3 & 0xff;
  yield* game.bindObjectToCurrentTask(t3);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  yield* game.setObjectAnimation(object, 1);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE, 0);
    if (((yield* game.getObjectRecordFlags(object3)) & 1) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x4e /* "Worn Leather Jacket" */, 0xf0);
      yield* game.setObjectRecordFlagBits(object3, 1);
      const t4 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
      const t5 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 2);
      const t6 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) - 2);
      const t7 = yield* game.getActorStateFlags(0xb21);
      yield* game.setObjectPosition(t7, t6, t5, t4);
    } else {
      yield* run.noticeNothingSpecial();
    }
  }
}

// Script 1D6: 1 argument.
export function* script1D6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setObjectDialog(object, 0x24);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 1D7: 1 argument.
export function* script1D7(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE, 0);
    yield* game.notice(2, 0x15, 0x13, 3, 0x800, 0x60 /* "Elevator - out of order." */, 0x78);
  }
}

// Script 1D8: 1 argument.
export function* script1D8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2AA(object, 1, 0x203, 0x401, 0x602, 0x2c03);
  return null;
}

// Script 1D9: 1 argument.
export function* script1D9(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  object = arg0 & 0xff;
  yield* game.resetPlayerControl();
  if ((yield* game.getScriptVariable(0x2c)) !== 0) {
    yield* run.script026(object);
  }
  if ((yield* game.getScriptVariable(0xa)) !== 0) {
    yield* game.raiseStateCount(object, 0xff);
    yield* game.raiseMemberMagicPoints(object, 0xff);
  }
  if ((yield* game.redrawDialogWindowList()) !== 0) {
    block420: {
      if (
        (truth((yield* game.getObjectRecordCount(object)) === 0) &
          (truth((yield* game.getScriptVariable(0xa)) !== 0) ^ 0xffff)) ===
        0
      ) {
        yield* game.setObjectAnimation(object, 0);
        local4 = 0;
        state.setByte('SPELL_EFFECT_BUSY', 0, 0);
        state.setByte('ARMOUR_SPELLS_ACTIVE', 0, 0);
        state.setByte('FREEZE_SPELLS_ACTIVE', 0, 0);
        state.setByte('SPIRIT_SUMMONED', 0, 0);
        yield* game.redrawDialogWindowList();
        for (;;) {
          const t1 = yield* game.playerControl();
          local2 = t1;
          if (local2 === 0) {
            local1 =
              truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) & 0xff;
          } else {
            if (!((local2 & 0x80) !== 0 && less(state.word('RUNNER_WEAPON'), 0x8000))) {
              if (
                (truth((local2 & 0x40) !== 0 && state.word('SELECTED_SPELL_SCRIPT') !== 0) &
                  (signed(state.byte('SPELL_EFFECT_BUSY')) ^ 0xffff)) ===
                0
              ) {
                local1 =
                  truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) & 0xff;
              } else {
                if (state.word('AIMING_WEAPON') === 0) {
                  yield* game.setObjectAnimation(object, 6);
                  local1 =
                    truth(
                      ((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) !== 0,
                    ) & 0xff;
                  yield* game.appendSelectedSpellTask();
                  local1 =
                    (truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) |
                      signed(local1)) &
                    0xff;
                } else {
                  state.setWord('AIMING_WEAPON', 0, 0);
                  state.setWord('AIMING_SPELL', 0, 0xffff);
                  yield* game.limitSpellGlove();
                  local1 =
                    truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) &
                    0xff;
                }
                yield* game.setObjectAnimation(object, 3);
              }
            } else {
              if (state.word('AIMING_SPELL') === 0) {
                if ((yield* game.shootAtGloveTarget()) !== 1) {
                  local4 = 0;
                  yield* game.setObjectAnimation(object, state.byte('AIM_ACTION_NEXT'));
                  const t4 = truth(
                    ((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) !== 0,
                  );
                  local1 = t4 & 0xff;
                  if ((t4 | signed(state.byte('JAKE_WIRED_REFLEXES'))) === 0) {
                    local1 =
                      truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0xa)) & EVENT.HIT) !== 0) &
                      0xff;
                  }
                } else {
                  const t2 = word(local4 + 1);
                  local4 = word(local4 + 1) & 0xff;
                  if (t2 > 5) {
                    local4 = 0;
                    yield* game.notice(2, 0x17, 0xf, 3, 0, 6 /* "Target not visible." */, 0x3c);
                  }
                  const t3 = truth(
                    ((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0x14)) & EVENT.HIT) !== 0,
                  );
                  local1 = t3 & 0xff;
                  if ((t3 | signed(state.byte('JAKE_WIRED_REFLEXES'))) === 0) {
                    local1 =
                      truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0xa)) & EVENT.HIT) !== 0) &
                      0xff;
                  }
                }
              } else {
                state.setWord('AIMING_WEAPON', 0, 0xffff);
                state.setWord('AIMING_SPELL', 0, 0);
                yield* game.limitCrosshair();
                local1 =
                  truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) & 0xff;
              }
              yield* game.setObjectAnimation(object, word(state.byte('AIM_ACTION_NEXT') - 1));
            }
          }
          if (
            ((signed(local1) & (truth((yield* game.getScriptVariable(0xa)) !== 0) ^ 0xffff)) |
              ((yield* game.isTimerRunning()) ^ 0xffff)) !==
            0
          ) {
            break block420;
          }
        }
      }
    }
    yield* game.setObjectVelocity(object, 0, 0, 0);
    yield* game.playSoundEffect(0xffff, 0x14, 0xff, 0x55);
    yield* game.playSoundEffect(0xffff, 0x14, 0xff, 0xaa);
    if ((yield* game.isTimerRunning()) === 0) {
      const t5 = word((yield* game.getObjectCoarseHeight(object)) + 0x10);
      const t6 = word((yield* game.getObjectCoarseY(object)) - 1);
      const t7 = word((yield* game.getObjectCoarseX(object)) - 1);
      yield* game.createObject(0xb8, t7, t6, t5, 0x382);
    }
    yield* game.wait(EVENT.TIMER, 0x1e);
    state.setWord('GAME_OPTIONS', 0, 3);
    yield* game.changeRoom(0x15a);
  }
  return null;
}

// Script 1DA: no arguments.
export function* script1DA(state) {
  yield* game.setActorStateHolder(0x999, 0x8b2);
  yield* game.setActorStateFlagBits(0xbc9, 2);
  yield* run.script04B();
  return null;
}

// Script 1DB: 1 argument.
export function* script1DB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0A7(object, 1, 0xb4);
  return null;
}

// Script 1DC: 1 argument.
export function* alwaysLockedDoorB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE | EVENT.OPEN, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
  }
}

// Script 1DD: 1 argument.
export function* script1DD(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectArmour(object, 3);
  yield* run.script399(object, 4, 0xf, word(0x32 + ((yield* game.randomByte()) & 0x1f)));
  return null;
}

// Script 1DE: 1 argument.
export function* script1DE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    if (((yield* game.getActorStateFlags(0x7af)) & 1) !== 0) {
      yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 0xf) + 0x1e));
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1DF: 1 argument.
export function* script1DF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      8,
      0x800,
      0x228 /* "Matrix Systems have created a program which could threaten o..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}
