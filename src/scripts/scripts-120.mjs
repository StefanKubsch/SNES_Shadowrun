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
  block60: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block60;
    }
    block41: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block41;
      }
      yield* script(0x25b, local0, 0x2710, 0x219, 2);
      break block41;
    }
    block54: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block54;
      }
      yield* script(0x31c);
      break block54;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block60;
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
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block145;
    }
    yield* game.setObjectActionAndDirection(local0, 2, 5);
    loop25: for (;;) {
      block95: {
        const t1 = yield* game.wait(0x281, 6);
        local1 = t1;
        if ((t1 & 0x80) === 0) {
          break block95;
        }
        block89: {
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
            yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e, 0xb4);
            break block89;
          }
          yield* game.notice(4, 2, 0x17, 4, 0, 0x1d4, 0xb4);
          break block89;
        }
        yield* game.wait(1, 1);
        break block95;
      }
      block123: {
        if ((local1 & 0x200) === 0) {
          break block123;
        }
        yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20e, 0xb4);
        break block123;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        continue loop25;
      }
      yield* script(0x36c, local0, 2, 4, 0, 0x30, 0x30);
      break block145;
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
  block307: {
    local0 = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x18)) !== 0xffff) {
      if ((yield* game.scriptAction(0x80)) !== 0x80) {
        break block307;
      }
      yield* game.notice(2, 0x14, 0x19, 4, 0x800, 0x81, 0xf0);
      if (
        (truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1))) |
          truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x1f)))) ===
        0
      ) {
        break block307;
      }
      local3 = word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) - 0x266);
      local5 = word((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) - 0x1d5);
      if (
        ((truth((yield* game.getScriptVariable(0x18)) === 1) &
          truth(greaterSignedLeft(local3, 0)) &
          truth(greaterSignedLeft(local5, 0)) &
          truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
          (truth((yield* game.getScriptVariable(0x18)) === 2) &
            truth(lessSignedLeft(local3, 0)) &
            truth(greaterSignedLeft(local5, 0)) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
          (truth((yield* game.getScriptVariable(0x18)) === 3) &
            truth(greaterSignedLeft(local3, 0)) &
            truth(lessSignedLeft(local5, 0)) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
          (truth((yield* game.getScriptVariable(0x18)) === 4) &
            truth(lessSignedLeft(local3, 0)) &
            truth(lessSignedLeft(local5, 0)) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(1)))) |
          (truth((yield* game.getScriptVariable(0x18)) === 5) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x1f))))) ===
        0
      ) {
        yield* game.setScriptVariable(0x18, 0);
        break block307;
      }
      block254: {
        if ((yield* game.getScriptVariable(0x18)) !== 3) {
          break block254;
        }
        yield* game.playSoundEffect(0xffff, 0x50, 0xff, 1);
        break block254;
      }
      block280: {
        if ((yield* game.getScriptVariable(0x18)) !== 5) {
          break block280;
        }
        yield* game.setScriptVariable(0x18, 0xfffe);
        yield* game.playSoundEffect(0xffff, 0x66, 0xff, 1);
        break block280;
      }
      yield* game.playSoundEffect(0xffff, 0x4e, 0xff, 3);
      yield* game.setScriptVariable(0x18, word((yield* game.getScriptVariable(0x18)) + 1));
      break block307;
    }
    block44: {
      if (((yield* game.scriptAction(0x200)) & 0x200) === 0) {
        break block44;
      }
      yield* game.setScriptVariable(0x1a, state.word('ROOM'));
      yield* game.endDialog();
      yield* game.changeRoom(0xd2);
      yield* game.wait(1, 1);
      break block44;
    }
    break block307;
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
      break block95;
    }
    loop19: for (;;) {
      yield* game.wait(2, 0);
      yield* game.talk(local0, 0x32);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop19;
      }
      yield* game.wait(1, 0x14);
      yield* game.notice(3, 2, 0x1a, 3, 0x400, 0x19c, 0xb4);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.setObjectFlags(local0, 0);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.markTopic(0xc);
      break block95;
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 128: 1 argument.
export function* script128(state, arg0) {
  let local0 = 0;
  block31: {
    local0 = arg0 & 0xff;
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.removeObject(local0);
      break block31;
    }
    yield* script(0x08e, local0, 0, 2, 0x1c, 3, 0x1d7);
    break block31;
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
  loop45: for (;;) {
    block60: {
      if (!less(yield* game.randomByte(), 0x64)) {
        break block60;
      }
      yield* game.wait(1, 9);
      break block60;
    }
    block75: {
      if (!less(yield* game.randomByte(), 0x6e)) {
        break block75;
      }
      yield* game.wait(1, 7);
      break block75;
    }
    if (local1 === 0) {
      yield* game.setObjectAnimation(local0, 4);
      yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
      local1 = 5;
      loop108: for (;;) {
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
        continue loop108;
      }
    } else {
      local1 = word(local1 - 1) & 0xff;
      continue loop45;
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
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.playSoundEffect(local0, 0x1e, 0xff, 3);
  yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, local2));
  yield* game.shootAtObject(local0, local2, 3, 4, 3, 2);
  yield* game.removeObject(local0);
  return null;
}

// Script 12B: 1 argument.
export function* script12B(state, arg0) {
  let local0 = 0;
  block31: {
    local0 = arg0 & 0xff;
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.removeObject(local0);
      break block31;
    }
    yield* script(0x08e, local0, 0, 2, 0x1c, 3, 0x1d6);
    break block31;
  }
  return null;
}

// Script 12C: 1 argument.
export function* script12C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    block106: {
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
        break block106;
      }
      yield* game.setActorStateFlagBits(0x1b66, 2);
      break block106;
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
  loop21: for (;;) {
    block61: {
      yield* game.bobSecondObject(local0);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        break block61;
      }
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.wait(1, 0x1d);
      yield* game.setObjectActionAndDirection(local0, 2, 4);
      break block61;
    }
    yield* game.wait(1, 1);
    if (state.word(0x1d09) !== 0) {
      continue loop21;
    }
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
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
  loop51: for (;;) {
    block75: {
      if (local1 !== 7) {
        local1 = word(local1 + 1) & 0xff;
        break block75;
      }
      local1 = 0;
      local2 = word(local2 - 1);
      break block75;
    }
    yield* game.setObjectDirection(local0, local1);
    yield* game.wait(1, local2);
    if (local2 !== 1) {
      continue loop51;
    }
    block112: {
      if (((yield* game.getActorStateFlags(0xb52)) & 0x80) === 0) {
        break block112;
      }
      yield* game.talk(local0, 0x76);
      break block112;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 130: 1 argument.
export function* script130(state, arg0) {
  let local0 = 0;
  block32: {
    local0 = arg0 & 0xff;
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.removeObject(local0);
      break block32;
    }
    yield* script(0x08e, local0, 5, 0xa, 0x12, 3, 0x1d8);
    break block32;
  }
  return null;
}

// Script 131: 1 argument.
export function* script131(state, arg0) {
  let local0 = 0;
  block65: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0x78c)) & 0x80) !== 0) {
      break block65;
    }
    yield* script(0x06e, local0, 0x78c, 0, 0x6f, 0x2000);
    yield* game.notice(5, 2, 0x14, 3, 0x400, 0xe6, 0xb4);
    yield* game.setActorStateFlagBits(0x78c, 0x80);
    yield* game.addSceneObject(0xf, 0, 0, 0, 0xa, 0x78c, 0x14);
    break block65;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 132: 1 argument.
export function* script132(state, arg0) {
  let local0 = 0;
  block31: {
    local0 = arg0 & 0xff;
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.removeObject(local0);
      break block31;
    }
    yield* script(0x08e, local0, 0, 0xf, 8, 3, 0x1c2);
    break block31;
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
      loop36: for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop36;
        }
        yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
        yield* game.wait(1, 2);
        yield* game.setObjectAnimation(local0, 1);
        loop70: for (;;) {
          yield* game.wait(1, 1);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
            continue loop70;
          }
          yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
          yield* game.setObjectAnimation(local0, 7);
          yield* game.wait(1, 0x14);
          yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
          yield* game.wait(8, 0);
          yield* game.setObjectActionAndDirection(local0, 8, 0);
          loop125: for (;;) {
            yield* game.wait(1, 1);
            if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
              continue loop125;
            }
            yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
            yield* game.setActorStateFlagBits(0xbb4, 0x80);
            yield* game.wait(1, 0x3c);
            yield* game.placeObjectOnWaypoint(local0, 7);
            yield* game.setObjectActionAndDirection(local0, 2, 1);
            loop173: for (;;) {
              yield* game.wait(1, 1);
              if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
                continue loop173;
              }
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
    } else {
      yield* game.setObjectDirection(local0, 1);
      yield* game.placeObjectOnWaypoint(local0, 8);
      break block221;
    }
  }
  loop221: for (;;) {
    block329: {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x20) === 0) {
        break block329;
      }
      yield* game.setObjectAnimation(local0, 0);
      loop235: for (;;) {
        if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
          yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
          yield* game.keepObjectRecordFlagBits(local0, 0xffdf);
          break block329;
        }
        block312: {
          yield* game.notice(2, 0x13, 0x15, 3, 0x800, 0x85, 0x78);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x40) !== 0) {
            break block312;
          }
          yield* game.wait(1, 0x3c);
          yield* game.notice(0xc, 0x15, 0x12, 3, 0x800, 0x86, 0x78);
          yield* game.setActorStateFlagBits(0x229, 0x80);
          yield* game.setObjectRecordFlagBits(local0, 0x40);
          break block312;
        }
        continue loop235;
      }
    }
    yield* game.setObjectAnimation(local0, 6);
    yield* game.wait(8, 0);
    loop340: for (;;) {
      yield* game.placeObjectOnWaypoint(local0, 7);
      yield* game.setObjectAnimation(local0, 2);
      loop350: for (;;) {
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
        continue loop350;
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
  block25: {
    local0 = arg0 & 0xff;
    if ((yield* game.getActorStateProperty(0x1474)) !== 0x1538) {
      yield* script(0x0f7, local0);
      break block25;
    }
    yield* script(0x006, local0);
    break block25;
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
  yield* game.native81(local0, 5);
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
    block133: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block133;
          }
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (t2 === 0xffff) {
            break block133;
          }
          if (local4 !== 0x635) {
            yield* script(0x0ff, local4);
            break block133;
          }
          yield* game.endDialog();
          yield* script(0x04b);
          yield* game.setActorStateFlagBits(local4, 0x80);
          break block133;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block133;
      }
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd, 0xf0);
      break block133;
    }
    if (signed(local1) === 0) {
      continue loop18;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 139: 1 argument.
export function* script139(state, arg0) {
  let local0 = 0;
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(9, 2, 0x11, 3, 0, 0x64, 0x78);
    break block26;
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
  loop8: for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(8, 0x15, 0xe, 3, 0x800, 0x1f8, 0xc8);
    continue loop8;
  }
}

// Script 13D: 1 argument.
export function* script13D(state, arg0) {
  let local0 = 0;
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(8, 2, 0xd, 3, 0, 0x65, 0x78);
    break block26;
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
    loop10: for (;;) {
      if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
        yield* game.turnObjectToPlayer(local0);
        if (!less(yield* game.getDistanceToPlayer(local0), 0x50)) {
          continue loop10;
        }
        yield* game.notice(2, 2, 0x1c, 4, 0x400, 0x11d, 0xf0);
        loop55: for (;;) {
          if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
            yield* game.turnObjectToPlayer(local0);
            if (!less(yield* game.getDistanceToPlayer(local0), 0x32)) {
              continue loop55;
            }
            yield* game.appendToFightList(local0);
            local3 = 255;
            local1 = 20;
            loop94: for (;;) {
              if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
                const t1 = (yield* game.randomByte()) & 7;
                const t2 = local0;
                yield* game.setObjectDirection(t2, t1);
                const t3 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
                const t4 = yield* game.getObjectCoarseY(local0);
                const t5 = yield* game.getObjectCoarseX(local0);
                local2 = (yield* game.createObject(0xb9, t5, t4, t3, 0x136)) & 0xff;
                const t6 = word(8 - ((yield* game.randomByte()) & 0xf));
                const t7 = word(8 - ((yield* game.randomByte()) & 0xf));
                const t8 = local2;
                yield* game.setObjectVelocity(t8, t7, t6, 8);
                const t9 = word(2 - ((yield* game.randomByte()) & 3));
                const t10 = word(2 - ((yield* game.randomByte()) & 3));
                const t11 = local0;
                yield* game.setObjectVelocity(t11, t10, t9, 0);
                const t12 = word(local1 - 1);
                local1 = t12 & 0xff;
                if (t12 !== 0) {
                  continue loop94;
                }
                yield* game.setObjectVelocity(local2, 0, 0, 8);
                yield* game.clearObjectVelocity(local0);
                return;
              }
              return;
            }
          } else {
            return;
          }
        }
      } else {
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  block217: {
    local3 = 0;
    yield* sub5();
    if (signed(local3) === 0) {
      break block217;
    }
    yield* game.fightListRemove(local0);
    break block217;
  }
  yield* script(0x35d, local0);
  return null;
}

// Script 13F: 1 argument.
export function* script13F(state, arg0) {
  let local0 = 0;
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(8, 2, 0xc, 3, 0, 0x66, 0x78);
    break block26;
  }
  return null;
}
