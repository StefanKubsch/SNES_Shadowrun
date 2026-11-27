// Scripts 380 to 39F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  notEqualOrNegativeLeft,
  script,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 380: 5 arguments.
export function* script380(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block288: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
    } else {
      local7 = 0;
      yield* game.setObjectRecordCount(local0, local2);
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local6 = t1 & 0xff;
        if (t1 === 0xffff) {
          local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
        } else {
          if (
            !less(
              yield* game.getObjectCoarseX(signed(local6)),
              yield* game.getObjectCoarseX(local0),
            )
          ) {
            if (notEqualOrNegativeLeft(local7, local4)) {
              local7 = word(local7 + 1);
              yield* game.setObjectVelocity(local0, 1, 0, 0);
              yield* game.setObjectActionAndDirection(local0, 1, 2);
            }
            local5 = truth(((yield* game.wait(0x801, 0x20)) & 0x800) !== 0) & 0xff;
            yield* game.clearObjectVelocity(local0);
          } else {
            if (notEqualOrNegativeLeft(local7, word(-local4))) {
              local7 = word(local7 - 1);
              yield* game.setObjectVelocity(local0, 0xffff, 0, 0);
              yield* game.setObjectActionAndDirection(local0, 1, 4);
            }
            local5 = truth(((yield* game.wait(0x801, 0x20)) & 0x800) !== 0) & 0xff;
            yield* game.clearObjectVelocity(local0);
          }
          if (
            (truth(
              less(
                yield* game.getObjectCoarseY(signed(local6)),
                word((yield* game.getObjectCoarseY(local0)) + 0x14),
              ),
            ) &
              (signed(local5) ^ 0xffff)) !==
            0
          ) {
            yield* game.setObjectAnimation(local0, 4);
            yield* game.shootAtObject(local0, signed(local6), 3, 0, 4, 0);
            yield* game.setObjectDirection(local0, 3);
            yield* game.playSoundEffect(local0, 0xe, 0xff, 3);
            if (local1 !== 0) {
              yield* game.appendToFightList(local0);
              local1 = 0;
            }
            local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
          }
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(1);
          if (local1 === 0) {
            yield* game.fightListRemove(local0);
          }
          const t2 = yield* game.getObjectCoarseHeight(local0);
          const t3 = yield* game.getObjectCoarseY(local0);
          const t4 = yield* game.getObjectCoarseX(local0);
          yield* game.createObject(0x9e, t4, t3, t2, 0x248);
          yield* script(0x068, local0);
          break block288;
        }
      }
    }
  }
  return null;
}

// Script 381: no arguments.
export function* script381(state) {
  if ((yield* game.isActorStateProperty(0x8b2, 0xb1a)) === 0) {
    yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
    yield* game.setActorStateHolder(0xb1a, 0x8b2);
    yield* game.topicText(0x192);
  } else {
    yield* game.topicText(0x193);
  }
  return null;
}

// Script 382: 1 argument.
export function* script382(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.playSoundEffect(local0, 0xa, 0xff, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 383: 1 argument.
export function* script383(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  function* sub5() {
    const t1 = yield* script(0x1b4, local0);
    local3 = t1 & 0xff;
    const t2 = shiftLeft(word((yield* game.getObjectCoarseHeight(t1)) + 8), 2);
    const t3 = shiftLeft(
      word(word((yield* game.getObjectCoarseY(local3)) - 8) - (yield* game.randomBelow(4))),
      2,
    );
    const t4 = shiftLeft(
      word((yield* game.getObjectCoarseX(local3)) + (yield* game.randomBelow(8))),
      2,
    );
    yield* game.setObjectPosition(local3, t4, t3, t2);
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.setObjectFlagBits(local0, 0x80);
  for (;;) {
    yield* game.wait(0x80, 0);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      local1 = yield* game.randomBelow(8);
      yield* game.setObjectRecordFlagBits(local0, 1);
      if (local1 <= 6) {
        if (local1 <= 3) {
          yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
          yield* script(0x38e);
        } else {
          const t5 = word((yield* game.getObjectCoarseHeight(local0)) + 5);
          const t6 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
          const t7 = word((yield* game.getObjectCoarseX(local0)) + 5);
          yield* game.createObject(0x14, t7, t6, t5, 0x262);
        }
      } else {
        yield* sub5();
        yield* sub5();
        yield* sub5();
      }
    } else {
      yield* script(0x38e);
    }
  }
}

// Script 384: 1 argument.
export function* script384(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseY(local0);
  const t2 = yield* game.getObjectCoarseX(local0);
  yield* script(0x195, local0, t2, t1, 0, 4, 0xa);
  return null;
}

// Script 385: 1 argument.
export function* script385(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
    yield* game.setObjectActionAndDirection(local0, 0, 3);
    yield* game.setObjectDialog(local0, 0x42);
    for (;;) {
      yield* game.wait(3, 6);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
        yield* game.setObjectRecordFlags(local0, 0);
        yield* game.changeScene(0x8002, 0, 0x1aa);
        return null;
      }
    }
  } else {
    yield* game.setObjectRecordFlagBits(local0, 0x80);
    return null;
  }
}

// Script 386: 1 argument.
export function* script386(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0, in1) {
    local1 = in0;
    local3 = in1;
    loop9: for (;;) {
      local5 = 0;
      for (;;) {
        yield* game.setObjectDirection(local0, local5);
        yield* game.wait(word(local3 + 1), 0x10);
        local5 = word(local5 + 2);
        if (local5 === 8) {
          if (((yield* game.getObjectRecordFlags(local0)) & local1) === 0) {
            continue loop9;
          }
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          return;
        }
      }
    }
  }
  local0 = arg0 & 0xff;
  block401: {
    if (
      ((yield* game.isTopicKnown(0x1c)) &
        (truth((yield* game.getScriptVariable(0x2c)) !== 0) ^ 0xffff)) ===
      0
    ) {
      yield* game.setActorStateFlagBits(0xdc1, 0x40);
      yield* game.setObjectArmour(local0, 0x3f);
      yield* game.setObjectRecordFlags(local0, 0);
      yield* game.setObjectActionAndDirection(local0, 1, 5);
      yield* game.setObjectFlagBits(local0, 0x2020);
      for (;;) {
        yield* game.moveObjectToPlayer(local0);
        yield* game.wait(1, 0x3c);
        yield* game.clearObjectVelocity(local0);
        yield* game.stopMotion(local0);
        if (less(yield* game.getDistanceToPlayer(local0), 0xf)) {
          yield* game.shootAtObject(local0, yield* game.getPlayerObject(), 6, 5, 5, 1);
        }
        yield* game.setObjectDirection(local0, (yield* game.getObjectDirection(local0)) & 0xfffe);
        yield* game.setObjectAnimation(local0, 7);
        yield* game.wait(8, 0);
        if (less(yield* game.getDistanceToPlayer(local0), 0x78)) {
          yield* game.createObject(0x91, local0, 0, 0, 0x2b3);
          yield* game.wait(1, 0xa);
          yield* game.createObject(0x91, local0, 0, 0, 0x2b3);
        }
        yield* game.setObjectAnimation(local0, 1);
        if (
          (truth((yield* game.getDistanceToPlayer(local0)) > 0x28) &
            truth(((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0)) !==
          0
        ) {
          yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
          yield* game.notice(2, 3, 0xc, 3, 0, 0, 0x78);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(local0, 0x40);
          yield* game.keepObjectRecordFlagBits(local0, 0xfff8);
          yield* game.notice(5, 2, 0x13, 3, 0x400, 0x1db, 0xb4);
          yield* sub5(1, 0);
          yield* game.talk(local0, 0x3b);
          yield* game.setObjectDialog(local0, 0x3b);
          yield* sub5(2, 2);
          yield* game.talk(local0, 0x3c);
          yield* game.setObjectDialog(local0, 0x3c);
          for (;;) {
            yield* sub5(4, 2);
            yield* game.keepObjectRecordFlagBits(local0, 0xfffb);
            if ((yield* game.isTopicKnown(0x1c)) !== 0) {
              const t1 = yield* game.getObjectCoarseHeight(local0);
              const t2 = yield* game.getObjectCoarseY(local0);
              const t3 = yield* game.getObjectCoarseX(local0);
              yield* game.createObject(0x56, t3, t2, t1, 0xf0);
              yield* game.appendToFightList(local0);
              yield* game.addKarma(0x20);
              yield* game.fightListRemove(local0);
              yield* game.removeObject(local0);
              yield* game.wait(1, 0x50);
              yield* game.addNuyen(0x1388);
              yield* script(0x04b);
              yield* game.notice(4, 4, 0x16, 3, 0, 0x1f6, 0xb4);
            }
            if ((yield* game.isTopicKnown(0x1c)) !== 0) {
              break block401;
            }
          }
        }
      }
    } else {
      yield* game.removeObject(local0);
    }
  }
  return null;
}

// Script 387: 1 argument.
export function* script387(state, arg0) {
  let local0 = 0,
    local1 = 0;
  function* sub5() {
    yield* game.setSpriteMode(local0, 1);
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    const t1 = word(((yield* game.randomByte()) & 0xff) + 1);
    local1 = t1;
    yield* game.wait(3, local1);
    yield* game.setSpriteMode(local0, 0x8001);
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(0x118 - local1));
  }
  local0 = arg0 & 0xff;
  if (((yield* game.isTopicKnown(0x23)) | (yield* game.isTopicKnown(0x1c))) === 0) {
    yield* game.setObjectDialog(local0, 0x3d);
  } else {
    yield* game.setObjectDialog(local0, 0x3e);
  }
  for (;;) {
    yield* game.setObjectVelocity(local0, 0xffff, 0, 0);
    yield* sub5();
    yield* game.setObjectVelocity(local0, 1, 0, 0);
    yield* sub5();
  }
}

// Script 388: no arguments.
export function* script388(state) {
  const t1 = yield* script(0x03f, 0x3e8, 0x384, 0x320);
  const t2 = yield* script(0x0b2, 0x170, 0x171, 0x172);
  yield* script(0x162, 0xd2e, t2, t1, 0x16f, 0x16e);
  return null;
}

// Script 389: 1 argument.
export function* script389(state, arg0) {
  let local0 = 0;
  block60: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      yield* script(0x321, local0, 2, 2);
    } else {
      for (;;) {
        yield* game.wait(1, 0x1e);
        if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
          yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
          yield* game.setObjectActionAndDirection(local0, 0, 0);
          yield* game.wait(0x10, 0);
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          yield* game.removeObject(local0);
          break block60;
        }
      }
    }
  }
  return null;
}

// Script 38A: no arguments.
export function* script38A(state) {
  yield* game.setActorStateFlagBits(0x3bf, 0x80);
  return null;
}

// Script 38B: 1 argument.
export function* script38B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectAnimation(local0, 0);
  yield* game.setObjectDialog(local0, 0x43);
  for (;;) {
    yield* game.turnObjectToPlayer(local0);
    yield* game.wait(3, 5);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      yield* game.setActorStateHolder(0x762, 0x8b2);
      yield* game.keepActorStateFlagBits(0x129f, 0xfffe);
      yield* game.keepActorStateFlagBits(0x1b5f, 0xfffe);
      yield* game.changeScene(2, 0, 0x1aa);
      return null;
    }
  }
}

// Script 38C: 1 argument.
export function* script38C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (
    (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x80) !== 0) &
      (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x40) !== 0) ^ 0xffff)) ===
    0
  ) {
    yield* game.removeObject(local0);
  } else {
    block71: {
      if (((yield* game.getActorStateFlags(0x1b6d)) & 0x20) === 0) {
        for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(0x1d0a)) & 1) !== 0) {
            yield* game.setActorStateFlagBits(0x1b6d, 0x20);
            break block71;
          }
        }
      } else {
        yield* game.placeObjectOnWaypoint(local0, 6);
      }
    }
    yield* game.setObjectActionAndDirection(local0, 0, 6);
    yield* game.wait(1, 0x3c);
    if (((yield* game.getActorStateFlags(0x1b6d)) & 8) === 0) {
      yield* game.setActorStateFlagBits(0x1b6d, 8);
      yield* game.notice(5, 4, 0x16, 3, 0x400, 0x259, 0x140);
    }
    yield* game.setObjectAnimation(local0, 2);
    yield* game.moveObjectStraightToPlayer(local0);
    yield* game.wait(5, 0x3c);
    yield* game.setActorStateFlagBits(0x1b6d, 0x40);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0xa0, 0, 0, 0, 0, 0x1b6d, 0x32);
  }
  return null;
}

// Script 38D: 1 argument.
export function* script38D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x32);
    yield* game.setScriptVariable(0x2a, 0);
    yield* game.wait(1, 0x32);
    yield* game.appendToFightList(local0);
    yield* game.setObjectArmour(local0, 4);
    yield* script(0x0ef, local0, 2, 0, 5, 2);
    yield* game.addKarma(0x28);
    yield* game.fightListRemove(local0);
    yield* script(0x35d, local0);
    yield* game.setActorStateFlagBits(0x1b66, 1);
    for (;;) {
      yield* game.wait(1, 1);
      if ((yield* game.getScriptVariable(0x2a)) === 0) {
        yield* game.wait(1, 0x64);
        yield* game.changeRoom(0xae);
        return null;
      }
    }
  } else {
    return null;
  }
}

// Script 38E: no arguments.
export function* script38E(state) {
  yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0xe, 0x78);
  yield* game.wait(1, 0x1e);
  return null;
}

// Script 38F: 1 argument.
export function* script38F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x089, local0);
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x40);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x40) {
          yield* script(0x240);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (local4 !== 0xffff) {
            if (local4 !== 0xfce) {
              yield* script(0x1b1, local4);
            } else {
              yield* game.setItemPropertyAndUnequip(local0, local4);
            }
          }
          local1 = 255;
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x14, 0x13, 4, 0x800, 0x8f, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 390: 1 argument.
export function* script390(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(3, 0x15, 0x1b, 3, 0x800, 0x1e0, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 391: 1 argument, returns a word.
export function* script391(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
    yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
    yield* game.setObjectFlagBits(local0, 0x40);
    yield* game.setObjectAnimation(local0, 0);
    yield* game.turnObjectToPlayer(local0);
    return 0xffff;
  }
  yield* game.removeObject(local0);
  return 0;
}

// Script 392: no arguments.
export function* script392(state) {
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0xc5);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.topicText(0xc4);
    } else {
      if (less(yield* game.getActorStateCount(0x105a), 6)) {
        yield* game.addActorStateCount(0x105a, 1);
        yield* game.setActorStateHolder(0x105a, 0x8b2);
        yield* game.topicText(0xc3);
      } else {
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xc6);
      }
    }
  }
  return null;
}

// Script 393: no arguments.
export function* script393(state) {
  yield* game.setActorStateFlagBits(0x4b4, 0x80);
  yield* game.markTopic(0x14);
  return null;
}

// Script 394: 1 argument.
export function* script394(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x345, local0, 0x28b);
  return null;
}

// Script 395: 1 argument.
export function* script395(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x179, local0, 0x27d);
  return null;
}

// Script 396: 1 argument.
export function* script396(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.playSoundEffect(0xffff, 0x5a, 0xc8, 3);
  return null;
}

// Script 397: 3 arguments.
export function* script397(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  function* sub9(in0) {
    local5 = in0;
    if (signed(local3) === 0) {
      yield* game.setObjectAnimation(local0, 2);
      yield* game.wait(1, 0x3c);
    }
    yield* game.talk(local0, local5);
  }
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2 & 0xff;
  local4 = 0;
  if (local1 !== 0x4f) {
    if (local1 !== 0x50) {
      if (local1 !== 0x52) {
        if (local1 !== 0x53) {
          if (local1 !== 0x56) {
            if (local1 !== 0x54) {
              if (local1 !== 0x55) {
                if (local1 !== 0x51) {
                  local4 = 255;
                } else {
                  yield* sub9(0x88);
                }
              } else {
                yield* sub9(0x84);
              }
            } else {
              if (
                (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x80) !== 0) |
                  truth(
                    (yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x20)),
                  )) ===
                0
              ) {
                yield* sub9(0x67);
              } else {
                local4 = 255;
              }
            }
          } else {
            if ((yield* game.getActorStateProperty(0x1474)) !== 0x1538) {
              yield* sub9(0x85);
            } else {
              local4 = 255;
            }
          }
        } else {
          if (((yield* game.getActorStateFlags(0x1905)) & 1) === 0) {
            yield* sub9(0x87);
          } else {
            local4 = 255;
          }
        }
      } else {
        yield* sub9(0x89);
      }
    } else {
      yield* sub9(0x5a);
    }
  } else {
    if (((yield* game.getScriptVariable(2)) & 1) === 0) {
      yield* sub9(0x4a);
    } else {
      local4 = 255;
    }
  }
  if (signed(local4) !== 0) {
    yield* game.notice(2, 2, 0x10, 3, 0x400, 0x4b, 0x78);
  }
  return null;
}

// Script 398: 1 argument.
export function* script398(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x380, local0, 3, 0xa, 1, 0);
  return null;
}

// Script 399: 4 arguments.
export function* script399(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local5 = 0,
    local6 = 0;
  block286: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectFlagBits(local0, 0x160);
      yield* game.setObjectRecordCount(local0, local2);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.wait(1, word(((yield* game.randomByte()) & 0x1f) + 0x14));
      yield* game.appendToFightList(local0);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local6 = t1 & 0xff;
        if (t1 === 0xffff) {
          local5 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
        } else {
          if ((yield* game.getDistanceBetweenObjects(local0, signed(local6))) > 0x96) {
            yield* game.moveObjectToObject(local0, signed(local6));
            yield* game.setObjectAnimation(local0, 2);
            local5 =
              truth(
                ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) &
                  0x800) !==
                  0,
              ) & 0xff;
            yield* game.stopMotion(local0);
            yield* game.clearObjectVelocity(local0);
          }
          yield* game.turnObjectToObject(local0, signed(local6));
          yield* game.setObjectDirection(local0, (yield* game.getObjectDirection(local0)) & 0xfffe);
          yield* game.setObjectAnimation(local0, 7);
          yield* game.wait(8, 0);
          yield* game.turnObjectToObject(local0, signed(local6));
          yield* game.setObjectDirection(local0, (yield* game.getObjectDirection(local0)) & 0xfffe);
          yield* game.setObjectAnimation(local0, 8);
          yield* game.turnObjectToObject(local0, signed(local6));
          yield* game.setObjectDirection(local0, (yield* game.getObjectDirection(local0)) & 0xfffe);
          const t2 = truth(((yield* game.wait(0x801, local3)) & 0x800) !== 0);
          local5 = t2 & 0xff;
          if (t2 === 0) {
            yield* game.turnObjectToObject(local0, signed(local6));
            if (signed(local6) !== 0xffff) {
              const t3 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
              const t4 = yield* game.getObjectCoarseY(local0);
              const t5 = yield* game.getObjectCoarseX(local0);
              yield* game.createObject(0xdc, t5, t4, t3, 0x160);
            }
            yield* game.setObjectDirection(
              local0,
              (yield* game.getObjectDirection(local0)) & 0xfffe,
            );
            yield* game.setObjectAnimation(local0, 0);
            local5 = truth(((yield* game.wait(0x801, local3)) & 0x800) !== 0) & 0xff;
          }
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(local0);
          yield* script(0x1ba, yield* script(0x068, local0));
          break block286;
        }
      }
    }
  }
  return null;
}

// Script 39A: 1 argument.
export function* script39A(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
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
            if (!(local4 === 0x38e || local4 === 0x380)) {
              yield* script(0x085, local4);
            } else {
              yield* game.endDialog();
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
      yield* game.notice(2, 0x15, 0x1b, 3, 0x800, 0x200, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 39B: no arguments.
export function* script39B(state) {
  yield* game.changeScene(0x8002, 0, 0x8b);
  return null;
}

// Script 39C: no arguments.
export function* script39C(state) {
  yield* script(0x10e, 0x44);
  return null;
}

// Script 39D: no arguments.
export function* script39D(state) {
  let local0 = 0,
    local2 = 0;
  const t1 = yield* game.getScriptVariable(0x20);
  local2 = t1;
  if (local2 !== 1) {
    if (local2 !== 2) {
      if (local2 !== 3) {
        if (local2 !== 4) {
          if (local2 !== 5) {
            if (local2 !== 6) {
              local0 = 0x189;
            } else {
              local0 = 0x18b;
            }
          } else {
            local0 = 0x189;
          }
        } else {
          local0 = 0x187;
        }
      } else {
        local0 = 0x185;
      }
    } else {
      local0 = 0x183;
    }
  } else {
    local0 = 0x181;
  }
  yield* game.setActorStateFlags(0x175a, 0);
  yield* game.changeScene(3, word(local2 - 1), local0);
  return null;
}

// Script 39E: 1 argument.
export function* script39E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x329, local0, 0x6a);
  return null;
}

// Script 39F: 1 argument.
export function* script39F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.wait(2, 0);
      yield* game.talk(local0, 0x4b);
      yield* game.setObjectActionAndDirection(local0, 1, 5);
      yield* game.wait(8, 0);
      yield* game.wait(1, 5);
      yield* game.changeRoom(0x141);
      yield* game.resetObjectRecordProperty(local0);
      return null;
    }
  }
}
