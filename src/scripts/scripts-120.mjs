// Scripts 120 to 13F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  EVENT,
  greaterSignedLeft,
  less,
  lessSignedLeft,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 120: 1 argument.
export function* script120(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.dataTerminal(object, 0x1de, 0x1a);
  return null;
}

// Script 121: 1 argument.
export function* script121(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.matrix.downloadBits & 0x80) !== 0) {
      yield* run.transferAccount(object, 0x2710, 0x219, 2);
    }
    if ((state.matrix.downloadBits & 1) !== 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setActorStateFlagBits(0xdc1 /* "Heavy Dude" */, 2);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 2, 0x161, 0, 1);
  return null;
}

// Script 122: no arguments.
export function* script122(state) {
  yield* game.setScriptVariable(0x2e, 0x11b);
  yield* game.setScriptVariable(0x30, 0x123);
  yield* game.changeRoom(0xf1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 123: no arguments.
export function* script123(state) {
  yield* game.setScriptVariable(0x2e, 0x10d);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(EVENT.TIMER, 1);
  return null;
}

// Script 124: 1 argument.
export function* script124(state, arg0) {
  let object = 0,
    events = 0;
  block145: {
    object = arg0 & 0xff;
    yield* game.setObjectFlagBits(object, 0x100);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.setObjectActionAndDirection(object, 2, 5);
      for (;;) {
        events = yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 6);
        if ((events & EVENT.EXAMINE) !== 0) {
          if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
            yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e /* "This gate is locked." */, 0xb4);
          } else {
            yield* game.notice(
              4,
              2,
              0x17,
              4,
              0,
              0x1d4 /* "The sign on the gate reads - Dark Blade. Members only." */,
              0xb4,
            );
          }
          yield* game.wait(EVENT.TIMER, 1);
        }
        if ((events & EVENT.OPEN) !== 0) {
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e /* "This gate is locked." */, 0xb4);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
          yield* run.closeDoorWhenClear(object, 2, 4, 0, 0x30, 0x30);
          break block145;
        }
      }
    }
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 125: 1 argument.
export function* script125(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waterCreature(object, 0xffff);
  return null;
}

// Script 126: 1 argument.
export function* script126(state, arg0) {
  let object = 0,
    local3 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x18)) !== 0xffff) {
    if ((yield* game.scriptAction(0x80)) === 0x80) {
      yield* game.notice(
        2,
        0x14,
        0x19,
        4,
        0x800,
        0x81 /* "The matchbox has a \"WASTELANDS club\" logo on the back." */,
        0xf0,
      );
      if (
        (truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1))) |
          truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x1f)))) !==
        0
      ) {
        local3 = word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) - 0x266);
        local5 = word((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) - 0x1d5);
        if (
          ((truth(
            (yield* game.getScriptVariable(0x18)) === 1 &&
              greaterSignedLeft(local3, 0) &&
              greaterSignedLeft(local5, 0),
          ) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
            (truth(
              (yield* game.getScriptVariable(0x18)) === 2 &&
                lessSignedLeft(local3, 0) &&
                greaterSignedLeft(local5, 0),
            ) &
              truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
            (truth(
              (yield* game.getScriptVariable(0x18)) === 3 &&
                greaterSignedLeft(local3, 0) &&
                lessSignedLeft(local5, 0),
            ) &
              truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
            (truth(
              (yield* game.getScriptVariable(0x18)) === 4 &&
                lessSignedLeft(local3, 0) &&
                lessSignedLeft(local5, 0),
            ) &
              truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
            (truth((yield* game.getScriptVariable(0x18)) === 5) &
              truth(
                (yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x1f)),
              ))) ===
          0
        ) {
          yield* game.setScriptVariable(0x18, 0);
        } else {
          if ((yield* game.getScriptVariable(0x18)) === 3) {
            yield* game.playSoundEffect(0xffff, 0x50, 0xff, 1);
          }
          if ((yield* game.getScriptVariable(0x18)) === 5) {
            yield* game.setScriptVariable(0x18, 0xfffe);
            yield* game.playSoundEffect(0xffff, 0x66, 0xff, 1);
          }
          yield* game.playSoundEffect(0xffff, 0x4e, 0xff, 3);
          yield* game.setScriptVariable(0x18, word((yield* game.getScriptVariable(0x18)) + 1));
        }
      }
    }
  } else {
    if (((yield* game.scriptAction(0x200)) & 0x200) !== 0) {
      yield* game.setScriptVariable(0x1a, state.room.number);
      yield* game.endDialog();
      yield* game.changeRoom(0xd2);
      yield* game.wait(EVENT.TIMER, 1);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 127: 1 argument.
export function* script127(state, arg0) {
  let object = 0;
  block95: {
    object = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 0, 0);
    if (((yield* game.getActorStateFlags(0x1c0e /* "A Busy Man" */)) & 2) === 0) {
      yield* game.setObjectDialog(object, 0x31);
      yield* game.wait(EVENT.TALK, 0);
    } else {
      for (;;) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.talk(object, 0x32);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.wait(EVENT.TIMER, 0x14);
          yield* game.notice(
            3,
            2,
            0x1a,
            3,
            0x400,
            0x19c /* "Thanks chummer, go right on down." */,
            0xb4,
          );
          yield* game.setObjectAnimation(object, 1);
          yield* game.setObjectFlags(object, 0);
          yield* game.resetObjectRecordProperty(object);
          yield* game.markTopic(0xc /* "Docks" */);
          break block95;
        }
      }
    }
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 128: 1 argument.
export function* script128(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* run.answerWithNotice(object, 0, 2, 0x1c, 3, 0x1d7);
  }
  return null;
}

// Script 129: 1 argument.
export function* script129(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectVelocity(object, 0, 3, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.clearObjectVelocity(object);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x46);
  local1 = 20;
  for (;;) {
    if (less(yield* game.randomByte(), 0x64)) {
      yield* game.wait(EVENT.TIMER, 9);
    }
    if (less(yield* game.randomByte(), 0x6e)) {
      yield* game.wait(EVENT.TIMER, 7);
    }
    if (local1 === 0) {
      yield* game.setObjectAnimation(object, 4);
      yield* game.playSoundEffect(object, 0xc, 0xff, 3);
      local1 = 5;
      for (;;) {
        yield* game.wait(EVENT.ANIMATION_END, 0);
        yield* game.setObjectAnimation(object, 4);
        yield* game.playSoundEffect(object, 0xc, 0xff, 3);
        if (local1 === 0) {
          yield* game.setObjectAnimation(object, 0);
          yield* game.wait(EVENT.TIMER, 0x1e);
          yield* game.setObjectAnimation(object, 2);
          yield* game.setObjectDirection(object, 4);
          yield* game.setObjectVelocity(object, 0, 0xfffc, 0);
          yield* game.wait(EVENT.TIMER, 0x12c);
          yield* game.clearObjectVelocity(object);
          yield* game.removeObject(object);
          return null;
        }
        local1 = word(local1 - 1) & 0xff;
      }
    } else {
      local1 = word(local1 - 1) & 0xff;
    }
  }
}

// Script 12A: 1 argument.
export function* script12A(state, arg0) {
  let object = 0,
    object2 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(object)) & 0xff;
  const t1 = shiftLeft(word((yield* game.getObjectCoarseHeight(object2)) + 0x20), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object2), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.playSoundEffect(object, 0x1e, 0xff, 3);
  yield* game.wait(EVENT.TIMER, yield* game.moveObjectTowardsObject(object, local2));
  yield* game.shootAtObject(object, local2, 3, 4, 3, 2);
  yield* game.removeObject(object);
  return null;
}

// Script 12B: 1 argument.
export function* script12B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* run.answerWithNotice(object, 0, 2, 0x1c, 3, 0x1d6);
  }
  return null;
}

// Script 12C: 1 argument.
export function* script12C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x28);
    yield* game.wait(EVENT.TIMER, 0x1e);
    yield* game.notice(2, 4, 0x11, 3, 0x400, 0x48 /* "Time to rock and roll!" */, 0x78);
    yield* game.appendToFightList(object);
    if ((yield* run.guardRouteB(0x200 | object, 7, 0x603, 0x201, 0x901, 0x204, 0x401)) === 0) {
      yield* game.addKarma(9);
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

// Script 12D: 1 argument.
export function* script12D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 4);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.wait(EVENT.TIMER, 1);
  for (;;) {
    yield* game.bobSecondObject(object);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(object, 4, 3);
      yield* game.keepObjectRecordFlagBits(object, 0xff7f);
      yield* game.wait(EVENT.TIMER, 0x1d);
      yield* game.setObjectActionAndDirection(object, 2, 4);
    }
    yield* game.wait(EVENT.TIMER, 1);
    if (state.motion.circleLeaderAlive === 0) {
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 12E: 1 argument.
export function* script12E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.enterWhenRoomClear(object, 2, 0x64);
  return null;
}

// Script 12F: 1 argument.
export function* script12F(state, arg0) {
  let object = 0,
    direction = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectVelocity(object, 0, 0, 2);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.clearObjectVelocity(object);
  yield* game.talk(object, 0x30);
  yield* game.setObjectVelocity(object, 0, 0, 1);
  count = 9;
  direction = 6;
  for (;;) {
    if (direction !== 7) {
      direction = word(direction + 1) & 0xff;
    } else {
      direction = 0;
      count = word(count - 1);
    }
    yield* game.setObjectDirection(object, direction);
    yield* game.wait(EVENT.TIMER, count);
    if (count === 1) {
      if (((yield* game.getActorStateFlags(0xb52 /* "Kitsune" */)) & 0x80) !== 0) {
        yield* game.talk(object, 0x76);
      }
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 130: 1 argument.
export function* script130(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* run.answerWithNotice(object, 5, 0xa, 0x12, 3, 0x1d8);
  }
  return null;
}

// Script 131: 1 argument.
export function* script131(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x78c /* "Orc" */)) & 0x80) === 0) {
    yield* run.talkOrStrikeBack(object, 0x78c, 0, 0x6f, 0x2000);
    yield* game.notice(5, 2, 0x14, 3, 0x400, 0xe6 /* "Okay budster, let's hit it!" */, 0xb4);
    yield* game.setActorStateFlagBits(0x78c /* "Orc" */, 0x80);
    yield* game.addSceneObject(0xf, 0, 0, 0, 0xa, 0x78c, 0x14);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 132: 1 argument.
export function* script132(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* run.answerWithNotice(object, 0, 0xf, 8, 3, 0x1c2);
  }
  return null;
}

// Script 133: 1 argument.
export function* script133(state, arg0) {
  let object = 0;
  block221: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.placeObjectOnWaypoint(object, 8);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      for (;;) {
        yield* game.wait(EVENT.TIMER, 1);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.keepObjectRecordFlagBits(object, 0xff7f);
          yield* game.wait(EVENT.TIMER, 2);
          yield* game.setObjectAnimation(object, 1);
          for (;;) {
            yield* game.wait(EVENT.TIMER, 1);
            if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
              yield* game.keepObjectRecordFlagBits(object, 0xff7f);
              yield* game.setObjectAnimation(object, 7);
              yield* game.wait(EVENT.TIMER, 0x14);
              yield* game.playSoundEffect(object, 0x16, 0xff, 3);
              yield* game.wait(EVENT.ANIMATION_END, 0);
              yield* game.setObjectActionAndDirection(object, 8, 0);
              for (;;) {
                yield* game.wait(EVENT.TIMER, 1);
                if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
                  yield* game.keepObjectRecordFlagBits(object, 0xff7f);
                  yield* game.setActorStateFlagBits(0xbb4 /* "JAKE" */, 0x80);
                  yield* game.wait(EVENT.TIMER, 0x3c);
                  yield* game.placeObjectOnWaypoint(object, 7);
                  yield* game.setObjectActionAndDirection(object, 2, 1);
                  for (;;) {
                    yield* game.wait(EVENT.TIMER, 1);
                    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
                      yield* game.keepObjectRecordFlagBits(object, 0xff7f);
                      yield* game.setObjectRecordFlagBits(object, 1);
                      yield* game.setObjectDirection(object, 1);
                      yield* game.setObjectFlagBits(object, 0x100);
                      yield* game.placeObjectOnWaypoint(object, 8);
                      yield* game.setObjectRecordFlagBits(object, 0x20);
                      break block221;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      yield* game.setObjectDirection(object, 1);
      yield* game.placeObjectOnWaypoint(object, 8);
    }
  }
  loop221: for (;;) {
    block329: {
      if (((yield* game.getObjectRecordFlags(object)) & 0x20) !== 0) {
        yield* game.setObjectAnimation(object, 0);
        for (;;) {
          if (((yield* game.wait(EVENT.EXAMINE | EVENT.CLOSE, 0)) & EVENT.CLOSE) !== 0) {
            yield* game.playSoundEffect(object, 0x16, 0xff, 3);
            yield* game.keepObjectRecordFlagBits(object, 0xffdf);
            break block329;
          }
          yield* game.notice(
            2,
            0x13,
            0x15,
            3,
            0x800,
            0x85 /* "The label reads: Armitage J." */,
            0x78,
          );
          if (((yield* game.getObjectRecordFlags(object)) & 0x40) === 0) {
            yield* game.wait(EVENT.TIMER, 0x3c);
            yield* game.notice(
              0xc,
              0x15,
              0x12,
              3,
              0x800,
              0x86 /* "A bit of paper fell out." */,
              0x78,
            );
            yield* game.setActorStateFlagBits(0x229 /* "Torn Paper" */, 0x80);
            yield* game.setObjectRecordFlagBits(object, 0x40);
          }
        }
      }
    }
    yield* game.setObjectAnimation(object, 6);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    loop340: for (;;) {
      yield* game.placeObjectOnWaypoint(object, 7);
      yield* game.setObjectAnimation(object, 2);
      for (;;) {
        if (((yield* game.wait(EVENT.EXAMINE | EVENT.OPEN, 0)) & EVENT.OPEN) !== 0) {
          yield* game.playSoundEffect(object, 0x16, 0xff, 3);
          yield* game.placeObjectOnWaypoint(object, 8);
          yield* game.setObjectAnimation(object, 4);
          yield* game.wait(EVENT.TIMER, 0x1e);
          if ((yield* game.testObjectCollision(object, 0)) === 0) {
            yield* game.setObjectRecordFlagBits(object, 0x20);
            yield* game.wait(EVENT.ANIMATION_END, 0);
            continue loop221;
          }
          yield* game.playSoundEffect(object, 0x20, 0xff, 3);
          yield* game.wait(EVENT.TIMER, 5);
          yield* game.playSoundEffect(object, 0x16, 0xff, 3);
          continue loop340;
        }
        yield* game.notice(
          2,
          0x13,
          0x15,
          3,
          0x800,
          0x85 /* "The label reads: Armitage J." */,
          0x78,
        );
      }
    }
  }
}

// Script 134: no arguments.
export function* script134(state) {
  yield* game.addNuyen(0xbb8);
  yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 0x40);
  yield* game.markTopic(0x1a /* "King" */);
  return null;
}

// Script 135: 1 argument.
export function* script135(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getActorStateProperty(0x1474 /* "Drake" */)) !== 0x1538) {
    yield* run.script0F7(object);
  } else {
    yield* run.alwaysLockedDoor(object);
  }
  return null;
}

// Script 136: 1 argument.
export function* script136(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 0x28);
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = yield* game.getObjectCoarseY(object);
  const t3 = yield* game.getObjectCoarseX(object);
  yield* game.createObject(0xb8, t3, t2, t1, 0x382);
  yield* game.blast(object, 8);
  yield* game.removeObject(object);
  return null;
}

// Script 137: 1 argument.
export function* endingScene1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(EVENT.TIMER, 0x15e);
  yield* game.setObjectAnimation(object, 2);
  yield* game.moveObjectToPoint(object, 0x262, 0x1e0);
  yield* game.wait(EVENT.ARRIVED, 0);
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(EVENT.TIMER, 0xc8);
  yield* game.notice(2, 4, 0x1c, 3, 0, 0x232 /* "WARNING: 20 Seconds until detonation." */, 0x12c);
  yield* game.setObjectActionAndDirection(object, 2, 2);
  yield* game.moveObjectStraightToWaypoint(object, 5);
  yield* game.wait(EVENT.ARRIVED, 0);
  yield* game.moveObjectStraightToPoint(object, 0x199, 0x180);
  yield* game.wait(EVENT.ARRIVED, 0);
  yield* game.changeScene(3, 5, 0x18b);
  yield* game.setScriptVariable(0x2c, word((yield* game.getScriptVariable(0x2c)) + 1));
  yield* game.removeObject(object);
  return null;
}

// Script 138: 1 argument.
export function* script138(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.waitUntilDefeated(object);
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
            if (actor !== 0x635) {
              yield* run.refuseKeyOn(actor);
            } else {
              yield* game.endDialog();
              yield* run.playPickUpSound();
              yield* game.setActorStateFlagBits(actor, 0x80);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd /* "It's a small key." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 139: 1 argument.
export function* script139(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(9, 2, 0x11, 3, 0, 0x64 /* "Tenth Street Station." */, 0x78);
  }
  return null;
}

// Script 13A: no arguments.
export function* script13A(state) {
  yield* game.setActorStateFlagBits(0xb9f /* "Jamaican" */, 1);
  return null;
}

// Script 13B: 1 argument.
export function* script13B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  yield* run.passingVehicle(object, 0, 0, 0, 0);
  return null;
}

// Script 13C: 1 argument.
export function* script13C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 5);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE | EVENT.OPEN, 0);
    yield* game.notice(8, 0x15, 0xe, 3, 0x800, 0x1f8 /* "It's rusted shut." */, 0xc8);
  }
}

// Script 13D: 1 argument.
export function* script13D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(8, 2, 0xd, 3, 0, 0x65 /* "Oldtown Station." */, 0x78);
  }
  return null;
}

// Script 13E: 1 argument.
export function* grenadeHostageTaker(state, arg0) {
  let object = 0,
    local1 = 0,
    created = 0,
    local3 = 0;
  function* sub5() {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    for (;;) {
      if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) === 0) {
        yield* game.turnObjectToPlayer(object);
        if (less(yield* game.getDistanceToPlayer(object), 0x50)) {
          yield* game.notice(
            2,
            2,
            0x1c,
            4,
            0x400,
            0x11d /* "Oh look man, you come any closer and I blow everyone to bits..." */,
            0xf0,
          );
          for (;;) {
            if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) === 0) {
              yield* game.turnObjectToPlayer(object);
              if (less(yield* game.getDistanceToPlayer(object), 0x32)) {
                yield* game.appendToFightList(object);
                local3 = 255;
                local1 = 20;
                for (;;) {
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) ===
                    0
                  ) {
                    yield* game.setObjectDirection(object, (yield* game.randomByte()) & 7);
                    const t1 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
                    const t2 = yield* game.getObjectCoarseY(object);
                    const t3 = yield* game.getObjectCoarseX(object);
                    created =
                      (yield* game.createObject(0xb9 /* "Grenade" */, t3, t2, t1, 0x136)) & 0xff;
                    const t4 = word(8 - ((yield* game.randomByte()) & 0xf));
                    const t5 = word(8 - ((yield* game.randomByte()) & 0xf));
                    yield* game.setObjectVelocity(created, t5, t4, 8);
                    const t6 = word(2 - ((yield* game.randomByte()) & 3));
                    const t7 = word(2 - ((yield* game.randomByte()) & 3));
                    yield* game.setObjectVelocity(object, t7, t6, 0);
                    const t8 = word(local1 - 1);
                    local1 = word(local1 - 1) & 0xff;
                    if (t8 === 0) {
                      yield* game.setObjectVelocity(created, 0, 0, 8);
                      yield* game.clearObjectVelocity(object);
                      return;
                    }
                  } else {
                    return;
                  }
                }
              }
            } else {
              return;
            }
          }
        }
      } else {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  local3 = 0;
  yield* sub5();
  if (signed(local3) !== 0) {
    yield* game.fightListRemove(object);
  }
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 13F: 1 argument.
export function* script13F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(8, 2, 0xc, 3, 0, 0x66 /* "Daley Station." */, 0x78);
  }
  return null;
}
