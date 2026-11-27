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
    const t1 = arg4;
    const t2 = arg3;
    const t3 = arg2;
    const t4 = arg1;
    local0 = arg0 & 0xff;
    local1 = t4 & 0xff;
    local2 = t3 & 0xff;
    local3 = t2 & 0xff;
    local4 = t1 & 0xff;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
      break block288;
    }
    local7 = 0;
    yield* game.setObjectRecordCount(local0, local2);
    yield* game.setObjectActionAndDirection(local0, 4, 3);
    loop33: for (;;) {
      block241: {
        const t5 = yield* game.chooseEnemyTarget(local0);
        local6 = t5 & 0xff;
        if (t5 === 0xffff) {
          local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
          break block241;
        }
        block148: {
          if (
            !less(
              yield* game.getObjectCoarseX(signed(local6)),
              yield* game.getObjectCoarseX(local0),
            )
          ) {
            block131: {
              if (!notEqualOrNegativeLeft(local7, local4)) {
                break block131;
              }
              local7 = word(local7 + 1);
              yield* game.setObjectVelocity(local0, 1, 0, 0);
              yield* game.setObjectActionAndDirection(local0, 1, 2);
              break block131;
            }
            local5 = truth(((yield* game.wait(0x801, 0x20)) & 0x800) !== 0) & 0xff;
            yield* game.clearObjectVelocity(local0);
            break block148;
          }
          block84: {
            if (!notEqualOrNegativeLeft(local7, word(-local4))) {
              break block84;
            }
            local7 = word(local7 - 1);
            yield* game.setObjectVelocity(local0, 0xffff, 0, 0);
            yield* game.setObjectActionAndDirection(local0, 1, 4);
            break block84;
          }
          local5 = truth(((yield* game.wait(0x801, 0x20)) & 0x800) !== 0) & 0xff;
          yield* game.clearObjectVelocity(local0);
          break block148;
        }
        block224: {
          if (
            (truth(
              less(
                yield* game.getObjectCoarseY(signed(local6)),
                word((yield* game.getObjectCoarseY(local0)) + 0x14),
              ),
            ) &
              (signed(local5) ^ 0xffff)) ===
            0
          ) {
            break block224;
          }
          block210: {
            yield* game.setObjectAnimation(local0, 4);
            yield* game.shootAtObject(local0, signed(local6), 3, 0, 4, 0);
            yield* game.setObjectDirection(local0, 3);
            yield* game.playSoundEffect(local0, 0xe, 0xff, 3);
            if (local1 === 0) {
              break block210;
            }
            yield* game.appendToFightList(local0);
            local1 = 0;
            break block210;
          }
          local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
          break block224;
        }
        break block241;
      }
      if (signed(local5) === 0) {
        continue loop33;
      }
      block260: {
        yield* game.addKarma(1);
        if (local1 !== 0) {
          break block260;
        }
        yield* game.fightListRemove(local0);
        break block260;
      }
      const t6 = yield* game.getObjectCoarseHeight(local0);
      const t7 = yield* game.getObjectCoarseY(local0);
      const t8 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0x9e, t8, t7, t6, 0x248);
      yield* script(0x068, local0);
      break block288;
    }
  }
  return null;
}

// Script 381: no arguments.
export function* script381(state) {
  block42: {
    if ((yield* game.isActorStateProperty(0x8b2, 0xb1a)) === 0) {
      yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
      yield* game.setActorStateHolder(0xb1a, 0x8b2);
      yield* game.topicText(0x192);
      break block42;
    }
    yield* game.topicText(0x193);
    break block42;
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
    const t5 = local3;
    yield* game.setObjectPosition(t5, t4, t3, t2);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.setObjectFlagBits(local0, 0x80);
  loop64: for (;;) {
    block162: {
      yield* game.wait(0x80, 0);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        local1 = yield* game.randomBelow(8);
        yield* game.setObjectRecordFlagBits(local0, 1);
        if (local1 <= 6) {
          if (local1 <= 3) {
            yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
            yield* script(0x38e);
            break block162;
          }
          const t6 = word((yield* game.getObjectCoarseHeight(local0)) + 5);
          const t7 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
          const t8 = word((yield* game.getObjectCoarseX(local0)) + 5);
          yield* game.createObject(0x14, t8, t7, t6, 0x262);
          break block162;
        }
        yield* sub5();
        yield* sub5();
        yield* sub5();
        break block162;
      }
      yield* script(0x38e);
      break block162;
    }
    continue loop64;
  }
}

// Script 384: 1 argument.
export function* script384(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseY(local0);
  const t2 = yield* game.getObjectCoarseX(local0);
  const t3 = local0;
  yield* script(0x195, t3, t2, t1, 0, 4, 0xa);
  return null;
}

// Script 385: 1 argument.
export function* script385(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
    yield* game.setObjectActionAndDirection(local0, 0, 3);
    yield* game.setObjectDialog(local0, 0x42);
    loop29: for (;;) {
      yield* game.wait(3, 6);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        continue loop29;
      }
      yield* game.setObjectRecordFlags(local0, 0);
      yield* game.changeScene(0x8002, 0, 0x1aa);
      return null;
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
    const t1 = in1;
    local1 = in0;
    local3 = t1;
    loop9: for (;;) {
      local5 = 0;
      loop12: for (;;) {
        yield* game.setObjectDirection(local0, local5);
        yield* game.wait(word(local3 + 1), 0x10);
        const t2 = word(local5 + 2);
        local5 = t2;
        if (t2 !== 8) {
          continue loop12;
        }
        if (((yield* game.getObjectRecordFlags(local0)) & local1) === 0) {
          continue loop9;
        }
        yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
        return;
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
      loop108: for (;;) {
        block146: {
          yield* game.moveObjectToPlayer(local0);
          yield* game.wait(1, 0x3c);
          yield* game.clearObjectVelocity(local0);
          yield* game.stopMotion(local0);
          if (!less(yield* game.getDistanceToPlayer(local0), 0xf)) {
            break block146;
          }
          const t3 = yield* game.getPlayerObject();
          const t4 = local0;
          yield* game.shootAtObject(t4, t3, 6, 5, 5, 1);
          break block146;
        }
        block204: {
          const t5 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t6 = local0;
          yield* game.setObjectDirection(t6, t5);
          yield* game.setObjectAnimation(local0, 7);
          yield* game.wait(8, 0);
          if (!less(yield* game.getDistanceToPlayer(local0), 0x78)) {
            break block204;
          }
          yield* game.createObject(0x91, local0, 0, 0, 0x2b3);
          yield* game.wait(1, 0xa);
          yield* game.createObject(0x91, local0, 0, 0, 0x2b3);
          break block204;
        }
        block246: {
          yield* game.setObjectAnimation(local0, 1);
          if (
            (truth((yield* game.getDistanceToPlayer(local0)) > 0x28) &
              truth(((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0)) ===
            0
          ) {
            break block246;
          }
          yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
          yield* game.notice(2, 3, 0xc, 3, 0, 0, 0x78);
          break block246;
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop108;
        }
        yield* game.setObjectRecordFlagBits(local0, 0x40);
        yield* game.keepObjectRecordFlagBits(local0, 0xfff8);
        yield* game.notice(5, 2, 0x13, 3, 0x400, 0x1db, 0xb4);
        yield* sub5(1, 0);
        yield* game.talk(local0, 0x3b);
        yield* game.setObjectDialog(local0, 0x3b);
        yield* sub5(2, 2);
        yield* game.talk(local0, 0x3c);
        yield* game.setObjectDialog(local0, 0x3c);
        loop316: for (;;) {
          block394: {
            yield* sub5(4, 2);
            yield* game.keepObjectRecordFlagBits(local0, 0xfffb);
            if ((yield* game.isTopicKnown(0x1c)) === 0) {
              break block394;
            }
            const t7 = yield* game.getObjectCoarseHeight(local0);
            const t8 = yield* game.getObjectCoarseY(local0);
            const t9 = yield* game.getObjectCoarseX(local0);
            yield* game.createObject(0x56, t9, t8, t7, 0xf0);
            yield* game.appendToFightList(local0);
            yield* game.addKarma(0x20);
            yield* game.fightListRemove(local0);
            yield* game.removeObject(local0);
            yield* game.wait(1, 0x50);
            yield* game.addNuyen(0x1388);
            yield* script(0x04b);
            yield* game.notice(4, 4, 0x16, 3, 0, 0x1f6, 0xb4);
            break block394;
          }
          if ((yield* game.isTopicKnown(0x1c)) === 0) {
            continue loop316;
          }
          break block401;
        }
      }
    } else {
      yield* game.removeObject(local0);
      break block401;
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
    yield* game.wait(3, t1);
    yield* game.setSpriteMode(local0, 0x8001);
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(0x118 - local1));
    return;
  }
  local0 = arg0 & 0xff;
  block80: {
    if (((yield* game.isTopicKnown(0x23)) | (yield* game.isTopicKnown(0x1c))) === 0) {
      yield* game.setObjectDialog(local0, 0x3d);
      break block80;
    }
    yield* game.setObjectDialog(local0, 0x3e);
    break block80;
  }
  loop80: for (;;) {
    yield* game.setObjectVelocity(local0, 0xffff, 0, 0);
    yield* sub5();
    yield* game.setObjectVelocity(local0, 1, 0, 0);
    yield* sub5();
    continue loop80;
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
      break block60;
    }
    loop8: for (;;) {
      yield* game.wait(1, 0x1e);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        continue loop8;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.wait(0x10, 0);
      yield* game.setObjectRecordPropertyFromGroup(local0);
      yield* script(0x04b);
      yield* game.removeObject(local0);
      break block60;
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
  loop11: for (;;) {
    yield* game.turnObjectToPlayer(local0);
    yield* game.wait(3, 5);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop11;
    }
    yield* game.setActorStateHolder(0x762, 0x8b2);
    yield* game.keepActorStateFlagBits(0x129f, 0xfffe);
    yield* game.keepActorStateFlagBits(0x1b5f, 0xfffe);
    yield* game.changeScene(2, 0, 0x1aa);
    return null;
  }
}

// Script 38C: 1 argument.
export function* script38C(state, arg0) {
  let local0 = 0;
  block166: {
    local0 = arg0 & 0xff;
    if (
      (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x80) !== 0) &
        (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x40) !== 0) ^ 0xffff)) ===
      0
    ) {
      yield* game.removeObject(local0);
      break block166;
    }
    block71: {
      if (((yield* game.getActorStateFlags(0x1b6d)) & 0x20) === 0) {
        loop45: for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(0x1d0a)) & 1) === 0) {
            continue loop45;
          }
          yield* game.setActorStateFlagBits(0x1b6d, 0x20);
          break block71;
        }
      } else {
        yield* game.placeObjectOnWaypoint(local0, 6);
        break block71;
      }
    }
    block122: {
      yield* game.setObjectActionAndDirection(local0, 0, 6);
      yield* game.wait(1, 0x3c);
      if (((yield* game.getActorStateFlags(0x1b6d)) & 8) !== 0) {
        break block122;
      }
      yield* game.setActorStateFlagBits(0x1b6d, 8);
      yield* game.notice(5, 4, 0x16, 3, 0x400, 0x259, 0x140);
      break block122;
    }
    yield* game.setObjectAnimation(local0, 2);
    yield* game.moveObjectStraightToPlayer(local0);
    yield* game.wait(5, 0x3c);
    yield* game.setActorStateFlagBits(0x1b6d, 0x40);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0xa0, 0, 0, 0, 0, 0x1b6d, 0x32);
    break block166;
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
    loop65: for (;;) {
      yield* game.wait(1, 1);
      if ((yield* game.getScriptVariable(0x2a)) !== 0) {
        continue loop65;
      }
      yield* game.wait(1, 0x64);
      yield* game.changeRoom(0xae);
      return null;
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
  loop6: for (;;) {
    block116: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x40);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x40) {
            break block116;
          }
          block112: {
            yield* script(0x240);
            const t2 = yield* game.chooseNumber();
            local4 = t2;
            if (t2 === 0xffff) {
              break block112;
            }
            if (local4 !== 0xfce) {
              yield* script(0x1b1, local4);
              break block112;
            }
            yield* game.setItemPropertyAndUnequip(local0, local4);
            break block112;
          }
          local1 = 255;
          break block116;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block116;
      }
      yield* game.notice(2, 0x14, 0x13, 4, 0x800, 0x8f, 0xf0);
      break block116;
    }
    if (signed(local1) === 0) {
      continue loop6;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 390: 1 argument.
export function* script390(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block18: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block18;
    }
    yield* script(0x101, local0);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    break block18;
  }
  loop18: for (;;) {
    block77: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          break block77;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block77;
      }
      yield* game.notice(3, 0x15, 0x1b, 3, 0x800, 0x1e0, 0xf0);
      break block77;
    }
    if (signed(local1) === 0) {
      continue loop18;
    }
    yield* game.removeObject(local0);
    return null;
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
  block71: {
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0xc5);
      break block71;
    }
    block64: {
      if ((yield* game.payNuyen(0x64)) === 0) {
        yield* game.topicText(0xc4);
        break block64;
      }
      block57: {
        if (less(yield* game.getActorStateCount(0x105a), 6)) {
          yield* game.addActorStateCount(0x105a, 1);
          yield* game.setActorStateHolder(0x105a, 0x8b2);
          yield* game.topicText(0xc3);
          break block57;
        }
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xc6);
        break block57;
      }
      break block64;
    }
    break block71;
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
    block28: {
      local5 = in0;
      if (signed(local3) !== 0) {
        break block28;
      }
      yield* game.setObjectAnimation(local0, 2);
      yield* game.wait(1, 0x3c);
      break block28;
    }
    yield* game.talk(local0, local5);
    return;
  }
  const t1 = arg2;
  const t2 = arg1;
  local0 = arg0 & 0xff;
  local1 = t2;
  local3 = t1 & 0xff;
  block252: {
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
                    break block252;
                  }
                  yield* sub9(0x88);
                  break block252;
                }
                yield* sub9(0x84);
                break block252;
              }
              block213: {
                if (
                  (truth(((yield* game.getActorStateFlags(0x1b6d)) & 0x80) !== 0) |
                    truth(
                      (yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x20)),
                    )) ===
                  0
                ) {
                  yield* sub9(0x67);
                  break block213;
                }
                local4 = 255;
                break block213;
              }
              break block252;
            }
            block170: {
              if ((yield* game.getActorStateProperty(0x1474)) !== 0x1538) {
                yield* sub9(0x85);
                break block170;
              }
              local4 = 255;
              break block170;
            }
            break block252;
          }
          block135: {
            if (((yield* game.getActorStateFlags(0x1905)) & 1) === 0) {
              yield* sub9(0x87);
              break block135;
            }
            local4 = 255;
            break block135;
          }
          break block252;
        }
        yield* sub9(0x89);
        break block252;
      }
      yield* sub9(0x5a);
      break block252;
    }
    block68: {
      if (((yield* game.getScriptVariable(2)) & 1) === 0) {
        yield* sub9(0x4a);
        break block68;
      }
      local4 = 255;
      break block68;
    }
    break block252;
  }
  block273: {
    if (signed(local4) === 0) {
      break block273;
    }
    yield* game.notice(2, 2, 0x10, 3, 0x400, 0x4b, 0x78);
    break block273;
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
    const t1 = arg3;
    const t2 = arg2;
    const t3 = arg1;
    local0 = arg0 & 0xff;
    local1 = t3 & 0xff;
    local2 = t2 & 0xff;
    local3 = t1;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
      break block286;
    }
    yield* game.setObjectFlagBits(local0, 0x160);
    yield* game.setObjectRecordCount(local0, local2);
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, word(((yield* game.randomByte()) & 0x1f) + 0x14));
    yield* game.appendToFightList(local0);
    loop48: for (;;) {
      block260: {
        const t4 = yield* game.chooseEnemyTarget(local0);
        local6 = t4 & 0xff;
        if (t4 === 0xffff) {
          local5 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
          break block260;
        }
        block107: {
          if ((yield* game.getDistanceBetweenObjects(local0, signed(local6))) <= 0x96) {
            break block107;
          }
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
          break block107;
        }
        block243: {
          yield* game.turnObjectToObject(local0, signed(local6));
          const t5 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t6 = local0;
          yield* game.setObjectDirection(t6, t5);
          yield* game.setObjectAnimation(local0, 7);
          yield* game.wait(8, 0);
          yield* game.turnObjectToObject(local0, signed(local6));
          const t7 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t8 = local0;
          yield* game.setObjectDirection(t8, t7);
          yield* game.setObjectAnimation(local0, 8);
          yield* game.turnObjectToObject(local0, signed(local6));
          const t9 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t10 = local0;
          yield* game.setObjectDirection(t10, t9);
          const t11 = truth(((yield* game.wait(0x801, local3)) & 0x800) !== 0);
          local5 = t11 & 0xff;
          if (t11 !== 0) {
            break block243;
          }
          block216: {
            yield* game.turnObjectToObject(local0, signed(local6));
            if (signed(local6) === 0xffff) {
              break block216;
            }
            const t12 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
            const t13 = yield* game.getObjectCoarseY(local0);
            const t14 = yield* game.getObjectCoarseX(local0);
            yield* game.createObject(0xdc, t14, t13, t12, 0x160);
            break block216;
          }
          const t15 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t16 = local0;
          yield* game.setObjectDirection(t16, t15);
          yield* game.setObjectAnimation(local0, 0);
          local5 = truth(((yield* game.wait(0x801, local3)) & 0x800) !== 0) & 0xff;
          break block243;
        }
        break block260;
      }
      if (signed(local5) === 0) {
        continue loop48;
      }
      yield* game.addKarma(1);
      yield* game.fightListRemove(local0);
      yield* script(0x1ba, yield* script(0x068, local0));
      break block286;
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
  block13: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block13;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    break block13;
  }
  loop13: for (;;) {
    block132: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block132;
          }
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (t2 === 0xffff) {
            break block132;
          }
          if ((truth(local4 === 0x38e) | truth(local4 === 0x380)) === 0) {
            yield* script(0x085, local4);
            break block132;
          }
          yield* game.endDialog();
          yield* game.setActorStateFlagBits(local4, 0x80);
          break block132;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block132;
      }
      yield* game.notice(2, 0x15, 0x1b, 3, 0x800, 0x200, 0xf0);
      break block132;
    }
    if (signed(local1) === 0) {
      continue loop13;
    }
    yield* game.removeObject(local0);
    return null;
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
  block106: {
    const t1 = yield* game.getScriptVariable(0x20);
    local2 = t1;
    if (t1 !== 1) {
      if (local2 !== 2) {
        if (local2 !== 3) {
          if (local2 !== 4) {
            if (local2 !== 5) {
              if (local2 !== 6) {
                local0 = 0x189;
                break block106;
              }
              local0 = 0x18b;
              break block106;
            }
            local0 = 0x189;
            break block106;
          }
          local0 = 0x187;
          break block106;
        }
        local0 = 0x185;
        break block106;
      }
      local0 = 0x183;
      break block106;
    }
    local0 = 0x181;
    break block106;
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
  loop2: for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop2;
    }
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
