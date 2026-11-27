// Scripts 200 to 21F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  multiply,
  notEqualOrNegativeLeft,
  script,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 200: 1 argument.
export function* script200(state, arg0) {
  let local0 = 0;
  function* sub5() {
    yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x99, 0x78);
    return;
  }
  local0 = arg0 & 0xff;
  block92: {
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      if ((yield* game.scriptAction(0x80)) !== 0x80) {
        break block92;
      }
      yield* sub5();
      break block92;
    }
    yield* game.setObjectRecordFlags(local0, local0);
    loop42: for (;;) {
      if (((yield* game.wait(0x90, 0)) & 0x10) !== 0) {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        yield* game.releaseObjectGraphics(local0);
        yield* game.wait(1, 0x3c);
        break block92;
      }
      yield* sub5();
      continue loop42;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 201: 1 argument.
export function* script201(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x61);
  yield* game.wait(2, 0);
  return null;
}

// Script 202: 1 argument.
export function* script202(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x402, 0x2305);
  return null;
}

// Script 203: 1 argument.
export function* script203(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2bc, local0, 0x22, 0x26, 0, 0x80, 0x16c0);
  return null;
}

// Script 204: 1 argument.
export function* script204(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x62);
  loop7: for (;;) {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 7);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
    continue loop7;
  }
}

// Script 205: 1 argument.
export function* script205(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  block363: {
    local0 = arg0 & 0xff;
    yield* game.endDialog();
    if (state.byte(0x1d71) !== 0) {
      break block363;
    }
    if ((yield* game.spendMagic(word(8 + shiftLeft(local0, 1)))) === 0) {
      break block363;
    }
    if ((yield* game.getPreviousFightObject(0xffff)) !== 0xffff) {
      state.setByte(0x1d71, 0, 1);
      const t1 = word((yield* game.getObjectCoarseHeight(state.byte('MEMBER_OBJECT'))) + 0x20);
      const t2 = yield* game.getObjectCoarseY(state.byte('MEMBER_OBJECT'));
      const t3 = yield* game.getObjectCoarseX(state.byte('MEMBER_OBJECT'));
      local1 = (yield* game.createObject(0xc4, t3, t2, t1, 0xa1)) & 0xff;
      yield* game.setObjectDirection(local1, 0);
      yield* game.setObjectAnimation(local1, 2);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      yield* game.wait(1, 0xa);
      yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(1, 0xa);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      yield* game.wait(1, 0x1e);
      yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(1, 0xa);
      yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(1, 0xa);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      local3 = 255;
      loop226: for (;;) {
        const t4 = yield* game.getPreviousFightObject(signed(local3));
        local3 = t4 & 0xff;
        if (t4 === 0xffff) {
          yield* game.removeObject(local1);
          yield* game.wait(1, 0x14);
          state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
          state.setByte(0x1d71, 0, 0);
          break block363;
        }
        block272: {
          yield* game.turnObjectToObject(local1, signed(local3));
          const t5 = word((yield* game.moveObjectTowardsObject(local1, signed(local3))) - 5);
          local2 = t5 & 0xff;
          if ((truth(t5 > 0xf5) | truth(local2 === 0)) === 0) {
            break block272;
          }
          local2 = 1;
          break block272;
        }
        yield* game.wait(1, local2);
        yield* game.playSoundEffect(local1, 0x5a, 0xc0, 0xff);
        state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
        yield* game.wait(1, 5);
        yield* game.shootAtObject(local1, signed(local3), 0xff, 0, multiply(local0, 6), 0);
        state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
        continue loop226;
      }
    } else {
      yield* game.addMagicPoints(word(8 + shiftLeft(local0, 1)));
      break block363;
    }
  }
  return null;
}

// Script 206: 1 argument.
export function* script206(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local6 = 0,
    local8 = 0;
  function* sub5() {
    block58: {
      const t1 = yield* game.randomBelow(4);
      local6 = t1;
      if (t1 !== 0) {
        if (local6 !== 1) {
          if (local6 !== 2) {
            local8 = 78;
            break block58;
          }
          local8 = 72;
          break block58;
        }
        local8 = 82;
        break block58;
      }
      local8 = 80;
      break block58;
    }
    yield* game.playSoundEffect(local0, local8, 0xff, 3);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  loop73: for (;;) {
    block212: {
      yield* game.setObjectAnimation(local0, 6);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        break block212;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      if ((yield* game.getScriptVariable(0)) === 0) {
        yield* game.notice(2, 2, 0x1b, 3, 0, 0x4a, 0xf0);
        yield* game.confirmKey();
        break block212;
      }
      block193: {
        yield* game.releaseNoticeWindows();
        yield* game.wait(1, 1);
        yield* game.notice(2, 3, 0xf, 3, 0, 0x49, 2);
        const t2 = yield* game.spellChoice();
        local1 = t2;
        if (t2 === 0) {
          break block193;
        }
        yield* game.setObjectAnimation(local0, 1);
        local3 = 6;
        loop143: for (;;) {
          yield* sub5();
          yield* game.wait(1, word(8 + ((yield* game.randomByte()) & 7)));
          const t3 = word(local3 - 1);
          local3 = t3;
          if (t3 > 0) {
            continue loop143;
          }
          yield* script(0x397, local0, local1, 0);
          yield* game.notice(5, 5, 0x16, 3, 0x400, 0x4d, 0x78);
          break block193;
        }
      }
      break block212;
    }
    block299: {
      if (((yield* game.wait(0x81, 1)) & 0x80) === 0) {
        break block299;
      }
      yield* game.setObjectAnimation(local0, 2);
      yield* game.wait(1, 0x14);
      yield* game.notice(3, 2, 0x19, 3, 0x400, 0x18, 0x78);
      yield* game.wait(1, 0x14);
      yield* game.notice(4, 4, 0x17, 3, 0x400, 0x19, 0x78);
      yield* game.wait(1, 0x28);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 6);
      break block299;
    }
    continue loop73;
  }
}

// Script 207: 1 argument.
export function* script207(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  function* sub50(in0, in1, in2, in3, in4) {
    const t1 = in4;
    const t2 = in3;
    const t3 = in2;
    const t4 = in1;
    local2 = in0 & 0xff;
    local3 = t4 & 0xff;
    local4 = t3;
    local6 = t2;
    local8 = t1;
    yield* game.setObjectActionAndDirection(local0, local2, local3);
    yield* game.setObjectVelocity(local0, local4, local6, local8);
    return;
  }
  function* sub47() {
    if (((yield* game.wait(0x801, 0x190)) & 0x800) === 0) {
      yield* game.appendToFightList(local0);
      local1 = 255;
      yield* sub50(7, 3, 0, 0, 0);
      if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
        yield* sub50(1, 4, 0, 0xfffe, 0);
        if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
          yield* game.clearObjectVelocity(local0);
          yield* game.setObjectAnimation(local0, 8);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            yield* game.releaseObjectGraphics(local0);
            yield* game.fightListRemove(local0);
            local1 = 0;
            yield* game.wait(1, 0x320);
            yield* game.appendToFightList(local0);
            local1 = 255;
            yield* sub50(7, 7, 0, 0, 0);
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              yield* sub50(1, 0, 0, 2, 0);
              if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
                yield* game.clearObjectVelocity(local0);
                yield* game.setObjectAnimation(local0, 8);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  yield* game.releaseObjectGraphics(local0);
                  yield* game.fightListRemove(local0);
                  local1 = 0;
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
  function* sub5(in0) {
    local2 = in0 & 0xff;
    const t5 = word(((yield* game.randomByte()) & 3) - 2);
    const t6 = word(((yield* game.randomByte()) & 3) - 2);
    const t7 = word(local2 + (yield* game.getObjectCoarseHeight(local0)));
    const t8 = yield* game.getObjectCoarseY(local0);
    const t9 = yield* game.getObjectCoarseX(local0);
    const t10 = yield* game.createObject(0xe0, t9, t8, t7, 0x1ee);
    yield* game.setObjectVelocity(t10, t6, t5, 8);
    return;
  }
  local0 = arg0 & 0xff;
  local1 = 0;
  loop301: for (;;) {
    yield* game.wait(1, 0x3c);
    if ((yield* sub47()) === 0) {
      continue loop301;
    }
    block356: {
      yield* sub5(4);
      yield* sub5(8);
      yield* sub5(0xc);
      yield* sub5(0x10);
      yield* sub5(0x14);
      yield* sub5(0x18);
      yield* game.addKarma(2);
      if (signed(local1) === 0) {
        break block356;
      }
      yield* game.fightListRemove(local0);
      break block356;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 208: 1 argument.
export function* script208(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.setObjectDialog(local0, 0x63);
  yield* game.wait(2, 0);
  return null;
}

// Script 209: 1 argument.
export function* script209(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) <= 1) {
    return null;
  }
  local1 = word(0xc8 + (yield* game.randomBelow(0x28)));
  loop21: for (;;) {
    yield* game.placeObjectInFormation(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if (t1 !== 0) {
      continue loop21;
    }
    yield* script(0x068, local0);
    loop46: for (;;) {
      yield* game.wait(1, 1);
      continue loop46;
    }
  }
}

// Script 20A: 1 argument.
export function* script20A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x329, local0, 0x66);
  yield* game.keepObjectRecordFlagBits(local0, 0xff97);
  return null;
}

// Script 20B: 1 argument.
export function* script20B(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectArmour(local0, 2);
  yield* game.setObjectRecordCount(local0, 0x23);
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0x1e);
  yield* game.appendToFightList(local0);
  loop28: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    yield* game.moveObjectStraightToPlayer(local0);
    loop36: for (;;) {
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
      if ((truth(less(yield* game.getDistanceToPlayer(local0), 0xf)) | signed(local1)) === 0) {
        continue loop36;
      }
      block127: {
        if (signed(local1) !== 0) {
          break block127;
        }
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        loop73: for (;;) {
          yield* game.setObjectAnimation(local0, 4);
          const t1 = yield* game.getPlayerObject();
          const t2 = local0;
          yield* game.shootAtObject(t2, t1, 2, 4, 5, 1);
          yield* game.playSoundEffect(local0, 6, 0xff, 3);
          local1 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
          if ((truth((yield* game.getDistanceToPlayer(local0)) > 0xf) | signed(local1)) === 0) {
            continue loop73;
          }
          break block127;
        }
      }
      if (signed(local1) === 0) {
        continue loop28;
      }
      yield* game.addKarma(7);
      yield* game.fightListRemove(local0);
      yield* script(0x1bc, yield* script(0x35d, local0));
      return null;
    }
  }
}

// Script 20C: 1 argument.
export function* script20C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block155: {
    local0 = arg0 & 0xff;
    yield* game.endDialog();
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block155;
    }
    const t1 = yield* game.spellGloveTarget();
    local1 = t1 & 0xff;
    if (
      (truth(t1 === 0xffff) |
        (truth(((yield* game.getObjectFlags(signed(local1))) & 3) !== 3) &
          truth(notEqualOrNegativeLeft(signed(local1), state.byte('PLAYER_OBJECT'))))) ===
      0
    ) {
      yield* game.raiseStateCount(signed(local1), multiply(local0, 0xf));
      const t2 = yield* game.getObjectCoarseHeight(signed(local1));
      const t3 = word((yield* game.getObjectCoarseY(signed(local1))) - 1);
      const t4 = word((yield* game.getObjectCoarseX(signed(local1))) - 1);
      local2 = (yield* game.createObject(0xda, t4, t3, t2, 0xa1)) & 0xff;
      yield* game.setObjectDirection(local2, 0);
      yield* game.setObjectAnimation(local2, 0);
      yield* game.playSoundEffect(local2, 0x36, 0xff, 0xff);
      local0 = 60;
      loop104: for (;;) {
        yield* game.wait(1, 1);
        const t5 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local1)), 2);
        const t6 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local1)), 2) - 4);
        const t7 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local1)), 2) - 4);
        const t8 = local2;
        yield* game.setObjectPosition(t8, t7, t6, t5);
        const t9 = word(local0 - 1);
        local0 = t9 & 0xff;
        if (t9 > 0) {
          continue loop104;
        }
        yield* game.removeObject(local2);
        break block155;
      }
    } else {
      yield* game.addMagicPoints(word(4 + local0));
      break block155;
    }
  }
  return null;
}

// Script 20D: 1 argument.
export function* script20D(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local11 = 0;
  function* sub5(in0) {
    local11 = in0 & 0xff;
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local11 + (yield* game.getObjectCoarseHeight(local0)));
    const t4 = yield* game.getObjectCoarseY(local0);
    const t5 = yield* game.getObjectCoarseX(local0);
    const t6 = yield* game.createObject(0xe0, t5, t4, t3, 0x1ee);
    yield* game.setObjectVelocity(t6, t2, t1, 8);
    return;
  }
  local0 = arg0 & 0xff;
  block60: {
    if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
      break block60;
    }
    yield* game.setObjectRecordFlags(local0, 4);
    break block60;
  }
  const t7 = yield* game.getObjectRecordFlags(local0);
  const t8 = local0;
  yield* game.setObjectRecordCount(t8, t7);
  local2 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
  local4 = shiftLeft(yield* game.getObjectCoarseY(local0), 2);
  local6 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  local1 = 0;
  loop93: for (;;) {
    yield* game.wait(1, 0xf);
    if ((yield* game.getDistanceToPlayer(local0)) > 0x3c) {
      continue loop93;
    }
    block126: {
      yield* game.appendToFightList(local0);
      const t9 = yield* script(0x093, local0);
      local1 = t9 & 0xff;
      if (t9 === 0) {
        break block126;
      }
      yield* game.addKarma(2);
      break block126;
    }
    block150: {
      yield* game.fightListRemove(local0);
      if (signed(local1) !== 0) {
        break block150;
      }
      yield* game.setObjectPosition(local0, local2, local4, local6);
      yield* game.wait(1, 0xc8);
      break block150;
    }
    if (signed(local1) === 0) {
      continue loop93;
    }
    block212: {
      yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
      yield* sub5(4);
      yield* sub5(8);
      yield* sub5(0xc);
      yield* sub5(0x10);
      yield* sub5(0x14);
      yield* sub5(0x18);
      if (!less(yield* game.getObjectRecordFlags(local0), 0x28)) {
        break block212;
      }
      const t10 = word(2 + (yield* game.getObjectRecordFlags(local0)));
      const t11 = local0;
      yield* game.setObjectRecordFlags(t11, t10);
      break block212;
    }
    block348: {
      if (
        (truth(((yield* game.getActorStateFlags(0xbc9)) & 1) !== 0) &
          truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(7))) &
          truth((yield* game.randomBelow(2)) !== 0)) ===
        0
      ) {
        break block348;
      }
      const t12 = yield* game.getActorStateFlags(0x1141);
      local10 = t12 & 0xff;
      if (t12 === 1) {
        break block348;
      }
      const t13 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
      const t14 = shiftLeft(yield* game.getObjectCoarseY(local0), 2);
      const t15 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
      const t16 = local10;
      yield* game.setObjectPosition(t16, t15, t14, t13);
      yield* game.setObjectVelocity(local10, 0, 0, 0x10);
      yield* game.setObjectRecordFlags(local10, 1);
      yield* game.setObjectActionAndDirection(local10, 0, 3);
      yield* game.removeObject(local0);
      local8 = 0x3c;
      loop302: for (;;) {
        yield* game.wait(1, 1);
        yield* game.setObjectFlagBits(local10, 0x20);
        yield* game.wait(1, 1);
        yield* game.keepObjectFlagBits(local10, 0xffdf);
        const t17 = word(local8 - 2);
        local8 = t17;
        if (t17 !== 0) {
          continue loop302;
        }
        yield* game.setObjectActionAndDirection(local10, 8, 3);
        return null;
      }
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 20E: 1 argument.
export function* script20E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x1e);
    yield* game.appendToFightList(local0);
    yield* script(0x00f, local0, 7, 1, 0xa, 5);
    yield* game.addKarma(0x19);
    yield* game.fightListRemove(local0);
    yield* script(0x35d, local0);
    yield* game.setActorStateFlagBits(0x1b66, 1);
    yield* game.wait(1, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 20F: 1 argument.
export function* script20F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 210: 1 argument.
export function* script210(state, arg0) {
  let local0 = 0,
    local1 = 0;
  function* sub5(in0) {
    local1 = in0 & 0xff;
    yield* game.playSoundEffect(local0, 0x4a, local1, 3);
    yield* game.wait(1, 4);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0);
  yield* game.setObjectActionAndDirection(local0, 8, 0);
  const t1 = word(0x60 + (yield* game.getObjectCoarseHeight(local0)));
  const t2 = word((yield* game.getObjectCoarseY(local0)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 4);
  yield* game.createObject(0xc3, t3, t2, t1, 0xf5);
  yield* game.wait(1, 1);
  yield* game.updateObjectDepthMode(local0);
  yield* sub5(0xff);
  yield* sub5(0xc0);
  yield* sub5(0x80);
  yield* sub5(0x40);
  yield* game.wait(1, 0x15);
  yield* game.removeObject(local0);
  return null;
}

// Script 211: 1 argument.
export function* script211(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 212: 1 argument.
export function* script212(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 213: 1 argument.
export function* script213(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x165, local0, 0);
  return null;
}

// Script 214: 1 argument.
export function* script214(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  loop7: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    yield* game.setObjectFlagBits(local0, 0x100);
    yield* game.wait(0x200, 0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    yield* game.keepObjectFlagBits(local0, 0xfeff);
    yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 0);
    yield* game.setObjectAnimation(local0, 0);
    loop60: for (;;) {
      yield* game.wait(1, 1);
      if (((yield* game.getActorStateFlags(0x1507)) & 0x40) === 0) {
        continue loop60;
      }
      yield* game.wait(0x400, 0);
      yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
      yield* game.setObjectAnimation(local0, 6);
      yield* game.wait(8, 0);
      continue loop7;
    }
  }
}

// Script 215: 1 argument.
export function* script215(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* script(0x1a2, local0, 2, 2, 0xffff, 0);
  return null;
}

// Script 216: 1 argument.
export function* script216(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 217: 1 argument.
export function* script217(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(local0)) & 0xff;
  const t1 = word(shiftLeft(yield* game.getObjectCoarseHeight(local1), 2) + 0x10);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
  const t3 = word(shiftLeft(yield* game.getObjectCoarseX(local1), 2) - 8);
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, yield* game.jumpObjectTowardsPoint(local0, local2));
  yield* game.clearObjectVelocity(local0);
  const t5 = yield* game.getObjectCoarseHeight(local0);
  const t6 = yield* game.getObjectCoarseY(local0);
  const t7 = yield* game.getObjectCoarseX(local0);
  yield* game.createObject(0xb8, t7, t6, t5, 0x382);
  yield* game.blast(local0, 8);
  yield* game.removeObject(local0);
  return null;
}

// Script 218: 1 argument.
export function* script218(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 6, 3, 0, 1);
  return null;
}

// Script 219: 1 argument.
export function* script219(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x00a, local0, 0x20, 0x24, 0x40, 0x16c0);
  return null;
}

// Script 21A: 1 argument.
export function* script21A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.playSoundEffect(local0, 0xc, 0x19, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 21B: 1 argument.
export function* script21B(state, arg0) {
  let local0 = 0;
  block44: {
    local0 = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      yield* game.removeObject(local0);
      break block44;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    yield* game.wait(1, 0x78);
    yield* game.turnObjectToPlayer(local0);
    yield* game.playSoundEffect(local0, 0x3a, 0xff, 3);
    yield* game.clearObjectTask(local0);
    break block44;
  }
  return null;
}

// Script 21C: 1 argument.
export function* script21C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseX(local0);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = local0;
  yield* script(0x195, t3, t2, t1, 0xffff, 4, 0xa);
  return null;
}

// Script 21D: 1 argument.
export function* script21D(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  block143: {
    local0 = arg0 & 0xff;
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if (t1 !== 0x80) {
      if (local1 !== 0x100) {
        break block143;
      }
      yield* script(0x0f9);
      const t2 = yield* game.chooseNumber();
      local5 = t2;
      if (t2 === 0xffff) {
        break block143;
      }
      if (local5 !== 0x63c) {
        yield* script(0x085, local5);
        break block143;
      }
      yield* game.setActorStateFlagBits(local5, 1);
      local3 = 0x28;
      loop79: for (;;) {
        yield* game.playSoundEffect(local0, 0x26, 0xff, 3);
        yield* game.wait(1, word(shiftRight(local3, 2) + 1));
        const t3 = word(local3 - 1);
        local3 = t3;
        if (t3 !== 0xa) {
          continue loop79;
        }
        yield* game.endDialog();
        yield* game.setActorStateFlagBits(local5, 0x80);
        yield* game.wait(1, 0xa);
        yield* game.blast(local0, 0x14);
        yield* game.resetObjectRecordProperty(local0);
        break block143;
      }
    } else {
      yield* game.notice(8, 0x15, 0xf, 3, 0x800, 0x202, 0xf0);
      break block143;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 21E: no arguments.
export function* script21E(state) {
  let local0 = 0,
    local2 = 0;
  block106: {
    const t1 = yield* game.getScriptVariable(0x22);
    local2 = t1;
    if (t1 !== 1) {
      if (local2 !== 2) {
        if (local2 !== 3) {
          if (local2 !== 4) {
            if (local2 !== 5) {
              if (local2 !== 6) {
                local0 = 0x18a;
                break block106;
              }
              local0 = 0x188;
              break block106;
            }
            local0 = 0x186;
            break block106;
          }
          local0 = 0x184;
          break block106;
        }
        local0 = 0x182;
        break block106;
      }
      local0 = 0x17f;
      break block106;
    }
    local0 = 0x182;
    break block106;
  }
  yield* game.setActorStateFlags(0x175a, 0);
  yield* game.changeScene(4, word(local2 - 1), local0);
  return null;
}

// Script 21F: 1 argument.
export function* script21F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 2, 0);
  yield* game.setObjectVelocity(local0, 0, 3, 0);
  yield* game.wait(1, 0x3c);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x28);
  yield* game.setObjectAnimation(local0, 4);
  yield* game.wait(1, 0x1e);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x8c);
  yield* game.setObjectActionAndDirection(local0, 1, 4);
  yield* game.setObjectVelocity(local0, 0, 0xfffc, 0);
  yield* game.wait(1, 0x12c);
  yield* game.clearObjectVelocity(local0);
  yield* game.removeObject(local0);
  return null;
}
