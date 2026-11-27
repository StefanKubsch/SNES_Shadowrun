// Scripts 0A0 to 0BF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  localByte,
  localWord,
  multiply,
  script,
  setLocalWord,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 0A0: 2 arguments.
export function* script0A0(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    local14 = 0,
    local15 = 0;
  function* sub7(in0, in1) {
    local9 = in0;
    local11 = in1;
    local13 = (yield* game.getObjectDirection(local0)) & 0xff;
    local14 = 255;
    local15 = (yield* game.chooseEnemyTarget(local0)) & 0xff;
    for (;;) {
      if (((yield* game.wait(local9 | 0x800, local6)) & 0x800) === 0) {
        if (
          (truth(signed(local15) !== 0xffff) &
            truth(less(yield* game.getDistanceBetweenObjects(local0, signed(local15)), 0x28)) &
            signed(local14)) !==
          0
        ) {
          yield* game.shootAtObject(local0, signed(local15), 3, 5, 5, 0xffff);
          local14 = 0;
        }
        if (((yield* game.randomByte()) & 0xe0) === 0) {
          yield* game.createObject(0x54, local0, 0xa, 0, 0x16f);
        }
        yield* game.setObjectDirection(local0, local13);
        local11 = word(local11 - 1);
      } else {
        local8 = 0;
        yield* game.fightListRemove(local0);
      }
      if ((signed(local8) & truth(local11 > 0)) === 0) {
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.wait(1, 4);
  local6 = word(4 + (yield* game.randomBelow(4)));
  yield* game.setObjectArmour(local0, 2);
  yield* game.setObjectRecordCount(local0, 0xc);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  local8 = 255;
  if (signed(local1) === 0) {
    local4 = 0;
  } else {
    local4 = 2;
  }
  yield* game.setObjectActionAndDirection(local0, 0, shiftLeft((yield* game.randomByte()) & 3, 1));
  yield* game.wait(1, word(((yield* game.randomByte()) & 0x3f) + 0xa));
  yield* game.setObjectAnimation(local0, 1);
  yield* game.appendToFightList(local0);
  for (;;) {
    yield* game.setObjectDirection(local0, local4);
    local2 = word(((yield* game.randomByte()) & 3) + 2);
    if (signed(local1) === 0) {
      yield* game.setObjectVelocity(local0, 0, local2, 0);
    } else {
      yield* game.setObjectVelocity(local0, local2, 0, 0);
    }
    yield* sub7(1, 0x19);
    yield* game.setObjectDirection(local0, word(local4 + 4));
    if (signed(local8) !== 0) {
      if (signed(local1) === 0) {
        yield* game.setObjectVelocity(local0, 0, word(-local2), 0);
      } else {
        yield* game.setObjectVelocity(local0, word(-local2), 0, 0);
      }
      yield* sub7(1, 0x19);
    }
    if (signed(local8) === 0) {
      yield* game.addKarma(6);
      yield* game.fightListRemove(local0);
      yield* script(0x312, local0);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 0A1: no arguments.
export function* script0A1(state) {
  return null;
}

// Script 0A2: 1 argument.
export function* script0A2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x14);
    yield* game.wait(1, 0x64);
    yield* game.notice(4, 4, 0x14, 3, 0x400, 0x24d, 0x78);
    yield* game.wait(1, 0xa);
    yield* game.appendToFightList(local0);
    if ((yield* script(0x2ec, 0x400 | local0, 0x805, 0, 0x200, 0x401, 5, 0)) === 0) {
      yield* game.addKarma(0x14);
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

// Script 0A3: 1 argument.
export function* script0A3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x32);
    yield* game.wait(1, 0xa);
    yield* game.notice(0xa, 4, 9, 3, 0x400, 0x251, 0x78);
    yield* game.appendToFightList(local0);
    yield* script(0x1c7, 0x400 | local0, 0x305, 0x252, 0x204, 0);
    yield* game.notice(6, 4, 6, 3, 0x400, 0x253, 0x78);
    yield* game.addKarma(0x1a);
    yield* game.fightListRemove(local0);
    yield* game.setActorStateFlagBits(0x1b66, 1);
    yield* script(0x35d, local0);
    yield* game.wait(1, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 0A4: no arguments.
export function* script0A4(state) {
  if ((yield* game.question(0x12, 0xa)) === 0) {
    yield* game.topicText(0x13e);
  } else {
    yield* game.setActorStateHolder(0x2ae, 0x8b2);
    yield* game.topicText(0x13d);
    yield* game.markTopic(0x39);
  }
  return null;
}

// Script 0A5: 1 argument.
export function* script0A5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 3, 3);
  return null;
}

// Script 0A6: 1 argument.
export function* script0A6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x160);
  yield* game.setObjectArmour(local0, 4);
  yield* game.setObjectRecordCount(local0, word((yield* game.randomBelow(0xa)) + 0x14));
  if ((yield* script(0x076, local0, 5, 0x45, 0, 5, 2, 0x3c)) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x1bc, yield* script(0x068, local0));
  }
  return null;
}

// Script 0A7: 3 arguments.
export function* script0A7(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2;
  yield* game.setSpriteMode(local0, 0);
  for (;;) {
    yield* game.wait(1, 0x14);
    if ((yield* game.getScriptVariable(0x2a)) === 0) {
      yield* game.wait(1, local2);
      if (local1 === 1) {
        yield* game.setActorStateFlagBits(0x1500, 0x40);
      }
      yield* game.setObjectActionAndDirection(local0, 1, 5);
      yield* game.keepObjectFlagBits(local0, 0xffbf);
      yield* game.setObjectArmour(local0, 0x3f);
      yield* game.moveObjectStraightToWaypoint(local0, local1);
      yield* game.wait(4, 0);
      if (local1 !== 1) {
        yield* game.setSpriteMode(local0, 1);
      } else {
        yield* game.setSpriteMode(local0, 0x8001);
      }
      yield* game.setObjectArmour(local0, 3);
      yield* game.setObjectFlagBits(local0, 0x40);
      yield* script(0x04e, local0);
      if (local1 === 1) {
        yield* game.setActorStateFlagBits(0x1688, 0x80);
      }
      return null;
    }
  }
}

// Script 0A8: 1 argument.
export function* script0A8(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  local1 = 0;
  for (;;) {
    if (((yield* game.wait(0x281, 6)) & 1) === 0) {
      yield* game.notice(7, 0x15, 0x10, 3, 0x800, 0x9b, 0xb4);
    } else {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
        yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
        yield* script(0x2a3, local0, 3, 5, 1, 0x2c, 0x2e);
        local1 = 255;
      }
    }
    if (signed(local1) !== 0) {
      yield* script(0x0e2, local0);
      return null;
    }
  }
}

// Script 0A9: 1 argument.
export function* script0A9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.notice(2, 2, 0x12, 4, 0x400, 0x237, 0xc8);
  }
}

// Script 0AA: 1 argument.
export function* script0AA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 0, 4, 2, 2);
  return null;
}

// Script 0AB: 4 arguments, returns a word.
export function* script0AB(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0;
  function* sub11() {
    if (!less(yield* game.getObjectRecordCount(local10), 0x13)) {
      yield* game.setObjectAnimation(local10, 2);
      if (local12 !== 0) {
        local12 = 0;
        yield* game.moveObjectStraightToWaypoint(local10, local2 & 0xff);
      } else {
        local12 = 1;
        yield* game.moveObjectStraightToWaypoint(local10, shiftRight(local2, 8));
      }
    } else {
      if (local12 !== 0xff) {
        yield* game.setObjectAnimation(local10, 2);
        local12 = 255;
        if (local4 !== 0) {
          yield* game.notice(1, 0x13, 0x1e, 4, 0x400, local4, 0x1c2);
        }
        yield* game.moveObjectStraightToWaypoint(local10, shiftRight(local0, 8));
      }
    }
    if ((yield* script(0x241, local10, 0x64, 0x3c, 0x32, 0x13, local12)) === 0) {
      local11 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local10);
        local9 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(0x801, 6)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(local10, 4);
          yield* game.turnObjectToObject(local10, signed(local9));
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            if (less(local11, 9)) {
              yield* game.playSoundEffect(local10, 0x40, 0xff, 0xff);
            }
            yield* game.shootAtObject(local10, signed(local9), 7, 1, 0xe, 5);
          } else {
            return 0xffff;
          }
        }
        if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
          if (
            (truth(local11 === 0xa) |
              truth(less(yield* game.getObjectRecordCount(local10), 0x13) && local12 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local11 = word(local11 + 1) & 0xff;
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
  local4 = arg2;
  local6 = arg3 & 0xff;
  local10 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local10, 2, 0);
  yield* game.setObjectFlagBits(local10, 0x140);
  yield* game.appendToFightList(local10);
  local12 = 0;
  for (;;) {
    if ((yield* sub11()) !== 0) {
      yield* game.addKarma(local6);
      yield* game.fightListRemove(local10);
      return yield* script(0x35d, local10);
    }
  }
}

// Script 0AC: 3 arguments, returns a word.
export function* script0AC(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = 0;
  yield* game.moveObjectToWaypoint(local0, local1);
  for (;;) {
    if ((signed(local2) | signed(local3)) !== 0) {
      return signed(local2);
    }
    if (((yield* game.wait(5, 1)) & 4) === 0) {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        if (less(yield* game.getDistanceToPlayer(local0), 0xf)) {
          yield* game.shootAtObject(local0, yield* game.getPlayerObject(), 3, 5, 3, 1);
          local3 = truth(((yield* game.wait(5, 0x14)) & 4) !== 0) & 0xff;
        }
      } else {
        local2 = 255;
      }
    } else {
      local3 = 255;
    }
  }
}

// Script 0AD: 1 argument.
export function* script0AD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  for (;;) {
    yield* script(0x2a3, local0, 3, 5, 1, 0x2c, 0x2e);
    yield* script(0x074, local0, 1, 7, 3, 0x2e);
  }
}

// Script 0AE: 1 argument.
export function* script0AE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  return null;
}

// Script 0AF: 1 argument.
export function* script0AF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x141);
  yield* game.releaseObjectGraphics(local0);
  return null;
}

// Script 0B0: 1 argument.
export function* script0B0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2bc, local0, 0x22, 0x26, 0, 0x80, 0x175a);
  return null;
}

// Script 0B1: 1 argument.
export function* script0B1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x7b6)) & 0x80) === 0) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x2cf, local0);
  }
  return null;
}

// Script 0B2: 3 arguments, returns a word.
export function* script0B2(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  if (!less(state.byte('JAKE_NEGOTIATION'), 3)) {
    if (!(state.byte('JAKE_NEGOTIATION') > 2 && less(state.byte('JAKE_NEGOTIATION'), 5))) {
      return local4;
    }
    return local2;
  }
  return local0;
}

// Script 0B3: 1 argument.
export function* script0B3(state, arg0) {
  const locals = new Uint8Array(11);
  function* sub5(in0) {
    setLocalWord(locals, 9, in0);
    const t1 = word(
      (yield* game.getObjectCoarseHeight(localByte(locals, 0))) -
        multiply(0xa, localWord(locals, 9)),
    );
    const t2 = yield* game.getObjectCoarseY(localByte(locals, 0));
    const t3 = word((yield* game.getObjectCoarseX(localByte(locals, 0))) + localWord(locals, 9));
    return yield* game.createObject(0x4d, t3, t2, t1, 0xf1);
  }
  function* sub32(in0) {
    locals[9] = in0 & 0xff;
    const t4 = shiftLeft(yield* game.getObjectCoarseHeight(localByte(locals, 9)), 2);
    const t5 = shiftLeft(word((yield* game.getObjectCoarseY(localByte(locals, 9))) + 1), 2);
    const t6 = shiftLeft(yield* game.getObjectCoarseX(localByte(locals, 9)), 2);
    yield* game.setObjectPosition(localByte(locals, 9), t6, t5, t4);
  }
  function* sub61(in0) {
    locals[9] = in0 & 0xff;
    const t7 = shiftLeft(yield* game.getObjectCoarseHeight(localByte(locals, 9)), 2);
    const t8 = shiftLeft(word((yield* game.getObjectCoarseY(localByte(locals, 9))) - 1), 2);
    const t9 = shiftLeft(yield* game.getObjectCoarseX(localByte(locals, 9)), 2);
    yield* game.setObjectPosition(localByte(locals, 9), t9, t8, t7);
  }
  locals[0] = arg0 & 0xff;
  yield* game.setObjectRecordFlags(localByte(locals, 0), 0x28);
  yield* game.setObjectArmour(localByte(locals, 0), 4);
  yield* game.setObjectFlagBits(localByte(locals, 0), 0xa000);
  yield* game.setScriptVariable(0x2a, 0);
  yield* game.keepObjectFlagBits(localByte(locals, 0), 0xff9f);
  yield* game.setObjectActionAndDirection(localByte(locals, 0), 1, 3);
  yield* game.setSpriteMode(localByte(locals, 0), 0x8001);
  locals[1] = (yield* sub5(1)) & 0xff;
  locals[2] = (yield* sub5(2)) & 0xff;
  locals[3] = (yield* sub5(3)) & 0xff;
  locals[4] = (yield* sub5(4)) & 0xff;
  yield* game.appendToFightList(localByte(locals, 0));
  loop160: for (;;) {
    locals[6] = truth(((yield* game.randomByte()) & 1) !== 0) & 0xff;
    yield* game.setObjectAnimation(localByte(locals, 0), 1);
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectDirection(localByte(locals, 0), 3);
    } else {
      yield* game.setObjectDirection(localByte(locals, 0), 7);
    }
    setLocalWord(locals, 7, 0);
    for (;;) {
      yield* sub32(localByte(locals, 0));
      yield* sub32(localByte(locals, 1));
      yield* sub32(localByte(locals, 2));
      yield* sub32(localByte(locals, 3));
      yield* sub32(localByte(locals, 4));
      locals[5] = truth(((yield* game.wait(0x801, 2)) & 0x800) !== 0) & 0xff;
      setLocalWord(locals, 7, word(localWord(locals, 7) + 1));
      if ((truth(localWord(locals, 7) === 0x14) | signed(localByte(locals, 5))) !== 0) {
        block403: {
          if (signed(localByte(locals, 5)) === 0) {
            yield* game.setObjectAnimation(localByte(locals, 0), 4);
            yield* game.wait(1, 0x1e);
            if (signed(localByte(locals, 6)) !== 0) {
              const t10 = yield* game.getObjectCoarseHeight(localByte(locals, 0));
              const t11 = word((yield* game.getObjectCoarseY(localByte(locals, 0))) - 0xa);
              const t12 = word((yield* game.getObjectCoarseX(localByte(locals, 0))) - 0xa);
              yield* game.createObject(0xdc, t12, t11, t10, 0x160);
            }
            yield* game.setObjectAnimation(localByte(locals, 0), 1);
            setLocalWord(locals, 7, 0);
            for (;;) {
              yield* sub61(localByte(locals, 0));
              yield* sub61(localByte(locals, 1));
              yield* sub61(localByte(locals, 2));
              yield* sub61(localByte(locals, 3));
              yield* sub61(localByte(locals, 4));
              setLocalWord(locals, 7, word(localWord(locals, 7) + 1));
              locals[5] = truth(((yield* game.wait(0x801, 2)) & 0x800) !== 0) & 0xff;
              if ((truth(localWord(locals, 7) === 0x14) | signed(localByte(locals, 5))) !== 0) {
                if (signed(localByte(locals, 5)) !== 0) {
                  break block403;
                }
                yield* game.setObjectAnimation(localByte(locals, 0), 4);
                yield* game.wait(1, 0x1e);
                if (signed(localByte(locals, 6)) === 0) {
                  break block403;
                }
                const t13 = yield* game.getObjectCoarseHeight(localByte(locals, 0));
                const t14 = word((yield* game.getObjectCoarseY(localByte(locals, 0))) - 0xa);
                const t15 = word((yield* game.getObjectCoarseX(localByte(locals, 0))) - 0xa);
                yield* game.createObject(0xdc, t15, t14, t13, 0x104);
                break block403;
              }
            }
          }
        }
        if (signed(localByte(locals, 5)) === 0) {
          continue loop160;
        }
        yield* game.setSpriteMode(localByte(locals, 0), 1);
        yield* game.addKarma(0x20);
        yield* game.fightListRemove(localByte(locals, 0));
        yield* game.setScriptVariable(0x2a, 1);
        yield* game.setObjectVelocity(localByte(locals, 0), 0, 0, 0xfffb);
        yield* game.wait(1, 0x1e);
        yield* game.resetObjectRecordProperty(localByte(locals, 0));
        yield* game.removeObject(localByte(locals, 0));
        return null;
      }
    }
  }
}

// Script 0B4: 1 argument.
export function* script0B4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x2b, 0xbb8, 0x157, 0);
  return null;
}

// Script 0B5: 1 argument.
export function* script0B5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x157, local0, 3, 0xa, 1, 5);
  return null;
}

// Script 0B6: no arguments.
export function* script0B6(state) {
  yield* game.setActorStateFlagBits(0x31e, 1);
  return null;
}

// Script 0B7: 1 argument.
export function* script0B7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x06f, 0x175a);
  return null;
}

// Script 0B8: 1 argument.
export function* script0B8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 0B9: 1 argument.
export function* script0B9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x2e, 0x2ee0, 0x276, 0);
  return null;
}

// Script 0BA: 1 argument.
export function* script0BA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.setObjectActionAndDirection(local0, 0, 7);
    yield* game.wait(1, word(((yield* game.randomByte()) & 0xff) + 1));
    yield* game.setObjectActionAndDirection(local0, 0, 3);
    yield* game.wait(1, word(((yield* game.randomByte()) & 0xff) + 1));
  }
}

// Script 0BB: 1 argument.
export function* script0BB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* game.setObjectAnimation(local0, 2);
  yield* game.setObjectVelocity(local0, 0, 4, 0);
  yield* game.notice(2, 2, 0x1b, 4, 0x400, 0xf6, 0xf0);
  yield* game.wait(1, 0x78);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.notice(0xa, 0x15, 0x14, 3, 0x400, 0xf7, 0xf0);
  yield* game.wait(1, 0xc8);
  yield* script(0x08b, 0xb5);
  return null;
}

// Script 0BC: 1 argument.
export function* script0BC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x5a, 0x7d, 0);
  return null;
}

// Script 0BD: 1 argument.
export function* script0BD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x31, 0x7530, 0x1a4, 0);
  return null;
}

// Script 0BE: no arguments.
export function* script0BE(state) {
  yield* game.setActorStateFlagBits(0x1edf, 0x80);
  return null;
}

// Script 0BF: 1 argument.
export function* script0BF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfbf);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectToWaypoint(local0, 0);
  yield* game.wait(4, 0);
  yield* game.notice(3, 2, 0x1b, 3, 0, 0x1fa, 0xb4);
  yield* game.removeObject(local0);
  return null;
}
