// Scripts 120 to 13F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  greaterSignedLeft,
  less,
  lessSignedLeft,
  script,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 120: 1 argument.
export function* script120(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x25d, local0, 0x1de, 0x1a);
  return null;
}

// Script 121: 1 argument.
export function* script121(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x25b, local0, 0x2710, 0x219, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* script(0x31c);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setActorStateFlagBits(0xdc1, 2);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 2, 0x161, 0, 1);
  return null;
}

// Script 122: no arguments.
export function* script122(state) {
  yield* game.setScriptVariable(0x2e, 0x11b);
  yield* game.setScriptVariable(0x30, 0x123);
  yield* game.changeRoom(0xf1);
  yield* game.wait(1, 1);
  return null;
}

// Script 123: no arguments.
export function* script123(state) {
  yield* game.setScriptVariable(0x2e, 0x10d);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(1, 1);
  return null;
}

// Script 124: 1 argument.
export function* script124(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block145: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x100);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      yield* game.setObjectActionAndDirection(local0, 2, 5);
      for (;;) {
        const t1 = yield* game.wait(0x281, 6);
        local1 = t1;
        if ((local1 & 0x80) !== 0) {
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
            yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e, 0xb4);
          } else {
            yield* game.notice(4, 2, 0x17, 4, 0, 0x1d4, 0xb4);
          }
          yield* game.wait(1, 1);
        }
        if ((local1 & 0x200) !== 0) {
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e, 0xb4);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
          yield* script(0x36c, local0, 2, 4, 0, 0x30, 0x30);
          break block145;
        }
      }
    }
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 125: 1 argument.
export function* script125(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0a0, local0, 0xffff);
  return null;
}

// Script 126: 1 argument.
export function* script126(state, arg0) {
  let local0 = 0,
    local3 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x18)) !== 0xffff) {
    if ((yield* game.scriptAction(0x80)) === 0x80) {
      yield* game.notice(2, 0x14, 0x19, 4, 0x800, 0x81, 0xf0);
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
      yield* game.setScriptVariable(0x1a, state.word('ROOM'));
      yield* game.endDialog();
      yield* game.changeRoom(0xd2);
      yield* game.wait(1, 1);
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 127: 1 argument.
export function* script127(state, arg0) {
  let local0 = 0;
  block95: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    if (((yield* game.getActorStateFlags(0x1c0e)) & 2) === 0) {
      yield* game.setObjectDialog(local0, 0x31);
      yield* game.wait(2, 0);
    } else {
      for (;;) {
        yield* game.wait(2, 0);
        yield* game.talk(local0, 0x32);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.wait(1, 0x14);
          yield* game.notice(3, 2, 0x1a, 3, 0x400, 0x19c, 0xb4);
          yield* game.setObjectAnimation(local0, 1);
          yield* game.setObjectFlags(local0, 0);
          yield* game.resetObjectRecordProperty(local0);
          yield* game.markTopic(0xc);
          break block95;
        }
      }
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 128: 1 argument.
export function* script128(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x08e, local0, 0, 2, 0x1c, 3, 0x1d7);
  }
  return null;
}

// Script 129: 1 argument.
export function* script129(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 2, 0);
  yield* game.setObjectVelocity(local0, 0, 3, 0);
  yield* game.wait(1, 0x3c);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x46);
  local1 = 20;
  for (;;) {
    if (less(yield* game.randomByte(), 0x64)) {
      yield* game.wait(1, 9);
    }
    if (less(yield* game.randomByte(), 0x6e)) {
      yield* game.wait(1, 7);
    }
    if (local1 === 0) {
      yield* game.setObjectAnimation(local0, 4);
      yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
      local1 = 5;
      for (;;) {
        yield* game.wait(8, 0);
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
        if (local1 === 0) {
          yield* game.setObjectAnimation(local0, 0);
          yield* game.wait(1, 0x1e);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.setObjectDirection(local0, 4);
          yield* game.setObjectVelocity(local0, 0, 0xfffc, 0);
          yield* game.wait(1, 0x12c);
          yield* game.clearObjectVelocity(local0);
          yield* game.removeObject(local0);
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
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(local0)) & 0xff;
  const t1 = shiftLeft(word((yield* game.getObjectCoarseHeight(local1)) + 0x20), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
  yield* game.setObjectPosition(local0, t3, t2, t1);
  yield* game.playSoundEffect(local0, 0x1e, 0xff, 3);
  yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, local2));
  yield* game.shootAtObject(local0, local2, 3, 4, 3, 2);
  yield* game.removeObject(local0);
  return null;
}

// Script 12B: 1 argument.
export function* script12B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x08e, local0, 0, 2, 0x1c, 3, 0x1d6);
  }
  return null;
}

// Script 12C: 1 argument.
export function* script12C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x28);
    yield* game.wait(1, 0x1e);
    yield* game.notice(2, 4, 0x11, 3, 0x400, 0x48, 0x78);
    yield* game.appendToFightList(local0);
    if ((yield* script(0x1a0, 0x200 | local0, 7, 0x603, 0x201, 0x901, 0x204, 0x401)) === 0) {
      yield* game.addKarma(9);
      yield* game.fightListRemove(local0);
      yield* script(0x35d, local0);
      yield* game.setActorStateFlagBits(0x1b66, 1);
      yield* game.wait(1, 0x64);
    } else {
      yield* game.setActorStateFlagBits(0x1b66, 2);
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 12D: 1 argument.
export function* script12D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 4);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.wait(1, 1);
  for (;;) {
    yield* game.bobSecondObject(local0);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.wait(1, 0x1d);
      yield* game.setObjectActionAndDirection(local0, 2, 4);
    }
    yield* game.wait(1, 1);
    if (state.word('CIRCLE_LEADER_ALIVE') === 0) {
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 12E: 1 argument.
export function* script12E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0a7, local0, 2, 0x64);
  return null;
}

// Script 12F: 1 argument.
export function* script12F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectVelocity(local0, 0, 0, 2);
  yield* game.wait(1, 0x3c);
  yield* game.clearObjectVelocity(local0);
  yield* game.talk(local0, 0x30);
  yield* game.setObjectVelocity(local0, 0, 0, 1);
  local2 = 9;
  local1 = 6;
  for (;;) {
    if (local1 !== 7) {
      local1 = word(local1 + 1) & 0xff;
    } else {
      local1 = 0;
      local2 = word(local2 - 1);
    }
    yield* game.setObjectDirection(local0, local1);
    yield* game.wait(1, local2);
    if (local2 === 1) {
      if (((yield* game.getActorStateFlags(0xb52)) & 0x80) !== 0) {
        yield* game.talk(local0, 0x76);
      }
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 130: 1 argument.
export function* script130(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x08e, local0, 5, 0xa, 0x12, 3, 0x1d8);
  }
  return null;
}

// Script 131: 1 argument.
export function* script131(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x78c)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0x78c, 0, 0x6f, 0x2000);
    yield* game.notice(5, 2, 0x14, 3, 0x400, 0xe6, 0xb4);
    yield* game.setActorStateFlagBits(0x78c, 0x80);
    yield* game.addSceneObject(0xf, 0, 0, 0, 0xa, 0x78c, 0x14);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 132: 1 argument.
export function* script132(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x08e, local0, 0, 0xf, 8, 3, 0x1c2);
  }
  return null;
}

// Script 133: 1 argument.
export function* script133(state, arg0) {
  let local0 = 0;
  block221: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      yield* game.placeObjectOnWaypoint(local0, 8);
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
          yield* game.wait(1, 2);
          yield* game.setObjectAnimation(local0, 1);
          for (;;) {
            yield* game.wait(1, 1);
            if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
              yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
              yield* game.setObjectAnimation(local0, 7);
              yield* game.wait(1, 0x14);
              yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
              yield* game.wait(8, 0);
              yield* game.setObjectActionAndDirection(local0, 8, 0);
              for (;;) {
                yield* game.wait(1, 1);
                if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
                  yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
                  yield* game.setActorStateFlagBits(0xbb4, 0x80);
                  yield* game.wait(1, 0x3c);
                  yield* game.placeObjectOnWaypoint(local0, 7);
                  yield* game.setObjectActionAndDirection(local0, 2, 1);
                  for (;;) {
                    yield* game.wait(1, 1);
                    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
                      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
                      yield* game.setObjectRecordFlagBits(local0, 1);
                      yield* game.setObjectDirection(local0, 1);
                      yield* game.setObjectFlagBits(local0, 0x100);
                      yield* game.placeObjectOnWaypoint(local0, 8);
                      yield* game.setObjectRecordFlagBits(local0, 0x20);
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
      yield* game.setObjectDirection(local0, 1);
      yield* game.placeObjectOnWaypoint(local0, 8);
    }
  }
  loop221: for (;;) {
    block329: {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x20) !== 0) {
        yield* game.setObjectAnimation(local0, 0);
        for (;;) {
          if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
            yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
            yield* game.keepObjectRecordFlagBits(local0, 0xffdf);
            break block329;
          }
          yield* game.notice(2, 0x13, 0x15, 3, 0x800, 0x85, 0x78);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
            yield* game.wait(1, 0x3c);
            yield* game.notice(0xc, 0x15, 0x12, 3, 0x800, 0x86, 0x78);
            yield* game.setActorStateFlagBits(0x229, 0x80);
            yield* game.setObjectRecordFlagBits(local0, 0x40);
          }
        }
      }
    }
    yield* game.setObjectAnimation(local0, 6);
    yield* game.wait(8, 0);
    loop340: for (;;) {
      yield* game.placeObjectOnWaypoint(local0, 7);
      yield* game.setObjectAnimation(local0, 2);
      for (;;) {
        if (((yield* game.wait(0x280, 0)) & 0x200) !== 0) {
          yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
          yield* game.placeObjectOnWaypoint(local0, 8);
          yield* game.setObjectAnimation(local0, 4);
          yield* game.wait(1, 0x1e);
          if ((yield* game.testObjectCollision(local0, 0)) === 0) {
            yield* game.setObjectRecordFlagBits(local0, 0x20);
            yield* game.wait(8, 0);
            continue loop221;
          }
          yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
          yield* game.wait(1, 5);
          yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
          continue loop340;
        }
        yield* game.notice(2, 0x13, 0x15, 3, 0x800, 0x85, 0x78);
      }
    }
  }
}

// Script 134: no arguments.
export function* script134(state) {
  yield* game.addNuyen(0xbb8);
  yield* game.setActorStateFlagBits(0x1b66, 0x40);
  yield* game.markTopic(0x1a);
  return null;
}

// Script 135: 1 argument.
export function* script135(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getActorStateProperty(0x1474)) !== 0x1538) {
    yield* script(0x0f7, local0);
  } else {
    yield* script(0x006, local0);
  }
  return null;
}

// Script 136: 1 argument.
export function* script136(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x28);
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = yield* game.getObjectCoarseX(local0);
  yield* game.createObject(0xb8, t3, t2, t1, 0x382);
  yield* game.blast(local0, 8);
  yield* game.removeObject(local0);
  return null;
}

// Script 137: 1 argument.
export function* script137(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0x15e);
  yield* game.setObjectAnimation(local0, 2);
  yield* game.moveObjectToPoint(local0, 0x262, 0x1e0);
  yield* game.wait(4, 0);
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0xc8);
  yield* game.notice(2, 4, 0x1c, 3, 0, 0x232, 0x12c);
  yield* game.setObjectActionAndDirection(local0, 2, 2);
  yield* game.moveObjectStraightToWaypoint(local0, 5);
  yield* game.wait(4, 0);
  yield* game.moveObjectStraightToPoint(local0, 0x199, 0x180);
  yield* game.wait(4, 0);
  yield* game.changeScene(3, 5, 0x18b);
  yield* game.setScriptVariable(0x2c, word((yield* game.getScriptVariable(0x2c)) + 1));
  yield* game.removeObject(local0);
  return null;
}

// Script 138: 1 argument.
export function* script138(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (local4 !== 0xffff) {
            if (local4 !== 0x635) {
              yield* script(0x0ff, local4);
            } else {
              yield* game.endDialog();
              yield* script(0x04b);
              yield* game.setActorStateFlagBits(local4, 0x80);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 139: 1 argument.
export function* script139(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(9, 2, 0x11, 3, 0, 0x64, 0x78);
  }
  return null;
}

// Script 13A: no arguments.
export function* script13A(state) {
  yield* game.setActorStateFlagBits(0xb9f, 1);
  return null;
}

// Script 13B: 1 argument.
export function* script13B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 6);
  yield* script(0x1a2, local0, 0, 0, 0, 0);
  return null;
}

// Script 13C: 1 argument.
export function* script13C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 5);
  for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(8, 0x15, 0xe, 3, 0x800, 0x1f8, 0xc8);
  }
}

// Script 13D: 1 argument.
export function* script13D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(8, 2, 0xd, 3, 0, 0x65, 0x78);
  }
  return null;
}

// Script 13E: 1 argument.
export function* script13E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  function* sub5() {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    for (;;) {
      if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
        yield* game.turnObjectToPlayer(local0);
        if (less(yield* game.getDistanceToPlayer(local0), 0x50)) {
          yield* game.notice(2, 2, 0x1c, 4, 0x400, 0x11d, 0xf0);
          for (;;) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              yield* game.turnObjectToPlayer(local0);
              if (less(yield* game.getDistanceToPlayer(local0), 0x32)) {
                yield* game.appendToFightList(local0);
                local3 = 255;
                local1 = 20;
                for (;;) {
                  if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
                    yield* game.setObjectDirection(local0, (yield* game.randomByte()) & 7);
                    const t1 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
                    const t2 = yield* game.getObjectCoarseY(local0);
                    const t3 = yield* game.getObjectCoarseX(local0);
                    local2 = (yield* game.createObject(0xb9, t3, t2, t1, 0x136)) & 0xff;
                    const t4 = word(8 - ((yield* game.randomByte()) & 0xf));
                    const t5 = word(8 - ((yield* game.randomByte()) & 0xf));
                    yield* game.setObjectVelocity(local2, t5, t4, 8);
                    const t6 = word(2 - ((yield* game.randomByte()) & 3));
                    const t7 = word(2 - ((yield* game.randomByte()) & 3));
                    yield* game.setObjectVelocity(local0, t7, t6, 0);
                    const t8 = word(local1 - 1);
                    local1 = word(local1 - 1) & 0xff;
                    if (t8 === 0) {
                      yield* game.setObjectVelocity(local2, 0, 0, 8);
                      yield* game.clearObjectVelocity(local0);
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
  local0 = arg0 & 0xff;
  local3 = 0;
  yield* sub5();
  if (signed(local3) !== 0) {
    yield* game.fightListRemove(local0);
  }
  yield* script(0x35d, local0);
  return null;
}

// Script 13F: 1 argument.
export function* script13F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(8, 2, 0xc, 3, 0, 0x66, 0x78);
  }
  return null;
}
