// Scripts 360 to 37F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 360: 1 argument.
export function* script360(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f7, local0, 3, 2, 1, 0x1e);
  yield* script(0x1bc, yield* script(0x068, local0));
  return null;
}

// Script 361: 1 argument.
export function* script361(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block73: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    if (
      (yield* game.getObjectCoarseY(local0)) <=
      (yield* game.getObjectCoarseY(yield* game.getPlayerObject()))
    ) {
      break block73;
    }
    loop18: for (;;) {
      local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
      if (
        (truth(less(yield* game.getDistanceToPlayer(local0), 0x50)) |
          signed(local1) |
          truth(
            less(
              yield* game.getObjectCoarseY(local0),
              word(0x50 + (yield* game.getObjectCoarseY(yield* game.getPlayerObject()))),
            ),
          )) ===
        0
      ) {
        continue loop18;
      }
      yield* game.setObjectDirection(local0, 4);
      yield* game.wait(1, 6);
      yield* game.talk(local0, 0x2b);
      break block73;
    }
  }
  yield* game.setObjectRecordCount(local0, 0x1e);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* game.appendToFightList(local0);
  yield* game.setObjectArmour(local0, 4);
  loop91: for (;;) {
    const t1 = yield* script(0x221, local0);
    local1 = t1 & 0xff;
    if (t1 === 0) {
      continue loop91;
    }
    yield* game.addKarma(9);
    yield* game.fightListRemove(local0);
    yield* script(0x1bc, yield* script(0x35d, local0));
    return null;
  }
}

// Script 362: 1 argument.
export function* script362(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28c, local0, 0x20, 0xea60, 0x91);
  return null;
}

// Script 363: 1 argument.
export function* script363(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  loop7: for (;;) {
    yield* game.setObjectAnimation(local0, 6);
    yield* game.wait(0x180, 0);
    yield* game.notice(2, 0x15, 0xf, 4, 0x800, 0x5f, 0xc8);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.wait(1, 0xc8);
    yield* game.setObjectAnimation(local0, 6);
    continue loop7;
  }
}

// Script 364: 1 argument.
export function* script364(state, arg0) {
  let local0 = 0;
  block42: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block42;
    }
    block36: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block36;
      }
      yield* game.keepActorStateFlagBits(0x1d96, 0xfffe);
      break block36;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block42;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 9, 0x1ea, 0, 4);
  return null;
}

// Script 365: 1 argument.
export function* script365(state, arg0) {
  let local0 = 0;
  block56: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block56;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x8d) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block50: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) === 0) {
        break block50;
      }
      yield* game.setActorStateFlagBits(0x171b, 0x40);
      break block50;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block56;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 5, 0x1eb, 0, 4);
  return null;
}

// Script 366: 1 argument.
export function* script366(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 4);
  yield* game.setObjectVelocity(local0, 0, 0xfffc, 0);
  yield* game.wait(1, 0xf);
  yield* game.setObjectDirection(local0, 6);
  yield* game.setObjectVelocity(local0, 0xfffc, 0, 0);
  yield* game.wait(1, 0xbe);
  yield* game.clearObjectVelocity(local0);
  loop45: for (;;) {
    yield* script(0x045, local0, 1);
    if (((yield* game.getScriptVariable(0x2a)) & 1) === 0) {
      continue loop45;
    }
    yield* game.setObjectActionAndDirection(local0, 2, 0);
    yield* game.setObjectVelocity(local0, 0, 4, 0);
    yield* game.wait(1, 0x96);
    yield* game.setScriptVariable(0x2c, word((yield* game.getScriptVariable(0x2c)) + 1));
    yield* game.changeScene(0x14, 0, 0xf2);
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 367: 1 argument.
export function* script367(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  loop9: for (;;) {
    yield* game.wait(1, 0x1e);
    if ((yield* game.getScriptVariable(0x2a)) > 3) {
      continue loop9;
    }
    block116: {
      if (((yield* game.randomByte()) & 1) === 0) {
        local1 = 3;
        loop64: for (;;) {
          const t4 = word((yield* game.getObjectCoarseHeight(local0)) + 0xa);
          const t5 = yield* game.getObjectCoarseY(local0);
          const t6 = yield* game.getObjectCoarseX(local0);
          yield* game.createObject(0x91, t6, t5, t4, 0x1a9);
          yield* game.wait(1, 3);
          const t7 = word(local1 - 1);
          local1 = t7;
          if (t7 !== 1) {
            continue loop64;
          }
          yield* game.wait(1, word(((yield* game.randomByte()) & 0xff) + 0x78));
          break block116;
        }
      } else {
        const t1 = word((yield* game.getObjectCoarseHeight(local0)) + 0x14);
        const t2 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
        const t3 = yield* game.getObjectCoarseX(local0);
        yield* game.createObject(0xbd, t3, t2, t1, 0x8d);
        break block116;
      }
    }
    yield* game.wait(1, word(((yield* game.randomByte()) & 0x1f) + 0x1e));
    continue loop9;
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
  let local0 = 0;
  block56: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block56;
    }
    block35: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block35;
      }
      yield* script(0x0d1, 0x1562);
      break block35;
    }
    block50: {
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block50;
      }
      yield* script(0x2ce, 1);
      break block50;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block56;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 7, 0x1e9, 0, 4);
  return null;
}

// Script 36A: 1 argument.
export function* script36A(state, arg0) {
  let local0 = 0;
  block40: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block40;
    }
    block34: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block34;
      }
      yield* script(0x2ce, 2);
      break block34;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block40;
  }
  block91: {
    yield* script(0x0ae, local0);
    yield* script(0x342, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
      yield* script(0x2e8, local0, 9, 0x1ec, 0, 4);
      break block91;
    }
    yield* script(0x2e8, local0, 9, 0x1ec, 2, 4);
    break block91;
  }
  return null;
}

// Script 36B: 1 argument.
export function* script36B(state, arg0) {
  let local0 = 0;
  block40: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block40;
    }
    block34: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block34;
      }
      yield* script(0x2ce, 4);
      break block34;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block40;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xb, 0x1f1, 0, 4);
  return null;
}

// Script 36C: 6 arguments.
export function* script36C(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  const t1 = arg5;
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  local0 = arg0 & 0xff;
  local1 = t5 & 0xff;
  local2 = t4 & 0xff;
  local3 = t3 & 0xff;
  local4 = t2 & 0xff;
  local5 = t1 & 0xff;
  yield* game.setObjectAnimation(local0, local1);
  loop17: for (;;) {
    yield* game.wait(1, 0xa);
    if ((yield* game.testObjectCollision(local0, local3)) !== 0) {
      continue loop17;
    }
    yield* game.playSoundEffect(local0, local4, 0xff, 3);
    yield* game.setObjectAnimation(local0, local2);
    yield* game.wait(8, 0);
    return null;
  }
}

// Script 36D: 4 arguments.
export function* script36D(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0;
  const t1 = arg3;
  const t2 = arg2;
  const t3 = arg1;
  local0 = arg0 & 0xff;
  local1 = t3;
  local3 = t2 & 0xff;
  local4 = t1;
  local6 = word((yield* game.getObjectCoarseX(local0)) - local1);
  local8 = word((yield* game.getObjectCoarseY(local0)) - local1);
  local1 = word(local1 + local1);
  loop30: for (;;) {
    yield* game.setObjectAnimation(local0, 1);
    const t4 = word(local8 + (yield* game.randomBelow(local1)));
    const t5 = word(local6 + (yield* game.randomBelow(local1)));
    const t6 = local0;
    yield* game.moveObjectStraightToPoint(t6, t5, t4);
    loop52: for (;;) {
      block76: {
        const t7 = yield* game.wait(0x807, local3);
        local10 = t7;
        if ((t7 & 1) === 0) {
          break block76;
        }
        local10 = local10 | 4;
        break block76;
      }
      if ((local10 & 0x804) === 0) {
        continue loop52;
      }
      block112: {
        if ((local10 & 4) === 0) {
          break block112;
        }
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        yield* game.setObjectAnimation(local0, 0);
        yield* game.wait(3, local4);
        break block112;
      }
      if ((local10 & 0x800) === 0) {
        continue loop30;
      }
      return null;
    }
  }
}

// Script 36E: 1 argument.
export function* script36E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xbc9)) & 1) !== 0) {
    yield* game.removeObject(local0);
    return null;
  }
  loop14: for (;;) {
    yield* game.wait(1, 0x7d0);
    yield* game.notice(4, 0x15, 6, 3, 0x400, 0x7b, 0x3c);
    continue loop14;
  }
}

// Script 36F: 1 argument.
export function* script36F(state, arg0) {
  let local0 = 0;
  block67: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block67;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x68) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block61: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) === 0) {
        break block61;
      }
      yield* script(0x25b, local0, 0x61a8, 0x221, 2);
      yield* script(0x0d1, 0x1570);
      break block61;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block67;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xa, 0x1ed, 0, 4);
  return null;
}

// Script 370: 1 argument.
export function* script370(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, 0x5a);
  yield* game.setObjectArmour(local0, 3);
  yield* game.keepObjectFlagBits(local0, 0xfebf);
  loop18: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0x7af)) & 1) === 0) {
      continue loop18;
    }
    block174: {
      yield* game.wait(1, 0x3c);
      yield* game.keepActorStateFlagBits(0x7af, 0xfffe);
      yield* game.appendToFightList(local0);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectAnimation(local0, 1);
      const t1 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0);
      local1 = t1 & 0xff;
      if (t1 !== 0) {
        break block174;
      }
      loop88: for (;;) {
        local2 = 8;
        loop92: for (;;) {
          block122: {
            yield* game.setObjectAnimation(local0, 1);
            if (!less(yield* game.getDistanceToPlayer(local0), 0xc8)) {
              break block122;
            }
            const t2 = yield* game.getObjectCoarseHeight(local0);
            const t3 = yield* game.getObjectCoarseY(local0);
            const t4 = yield* game.getObjectCoarseX(local0);
            yield* game.createObject(0x78, t4, t3, t2, 0x3e);
            break block122;
          }
          local1 = truth(((yield* game.wait(0x801, 0x32)) & 0x800) !== 0) & 0xff;
          const t5 = word(local2 - 1);
          local2 = t5;
          if ((truth(t5 === 0) | signed(local1)) === 0) {
            continue loop92;
          }
          block169: {
            if (signed(local1) !== 0) {
              break block169;
            }
            local1 = truth(((yield* game.wait(0x801, 0xa0)) & 0x800) !== 0) & 0xff;
            break block169;
          }
          if (signed(local1) === 0) {
            continue loop88;
          }
          break block174;
        }
      }
    }
    yield* game.addKarma(0x1a);
    yield* game.fightListRemove(local0);
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    yield* game.setActorStateFlagBits(0x7b6, 0x80);
    yield* game.setActorStateFlagBits(0x666, 1);
    return null;
  }
}

// Script 371: 8 arguments.
export function* script371(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  let local0 = 0,
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
    block120: {
      local13 = in0 & 0xff;
      if (signed(local8) !== 0) {
        break block120;
      }
      if (signed(local12) === 0xffff) {
        local8 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
        break block120;
      }
      block103: {
        yield* game.setObjectAnimation(local0, local3);
        yield* game.native81(local0, local13);
        const t1 = truth(((yield* game.wait(0x805, 0x3c)) & 0x800) !== 0);
        local8 = t1 & 0xff;
        if (t1 !== 0) {
          break block103;
        }
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local12)), 0xfa)) {
          break block103;
        }
        const t2 = word(((yield* game.randomByte()) & 0x3f) + 0xa);
        const t3 = local7;
        const t4 = local6;
        const t5 = local5;
        const t6 = yield* game.getPlayerObject();
        const t7 = local0;
        local8 = (yield* script(0x235, t7, t6, t5, t4, t3, 2, t2)) & 0xff;
        break block103;
      }
      break block120;
    }
    return;
  }
  const t8 = arg7;
  const t9 = arg6;
  const t10 = arg5;
  const t11 = arg4;
  const t12 = arg3;
  const t13 = arg2;
  const t14 = arg1;
  local0 = arg0 & 0xff;
  local1 = t14 & 0xff;
  local2 = t13 & 0xff;
  local3 = t12 & 0xff;
  local4 = t11 & 0xff;
  local5 = t10 & 0xff;
  local6 = t9 & 0xff;
  local7 = t8 & 0xff;
  local10 = yield* game.getSpriteMode(local0);
  yield* game.setObjectRecordCount(local0, local4);
  yield* game.setSpriteMode(local0, 0);
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  yield* game.native81(local0, local2);
  yield* game.wait(4, 0);
  yield* game.setSpriteMode(local0, local10);
  yield* game.setObjectAnimation(local0, 0);
  local8 = 0;
  yield* game.appendToFightList(local0);
  loop168: for (;;) {
    block188: {
      local12 = (yield* game.chooseEnemyTarget(local0)) & 0xff;
      yield* sub19(local1);
      if (signed(local8) !== 0) {
        break block188;
      }
      yield* sub19(local2);
      break block188;
    }
    if (signed(local8) === 0) {
      continue loop168;
    }
    yield* game.addKarma(0xb);
    yield* game.fightListRemove(local0);
    yield* script(0x1bc, yield* script(0x35d, local0));
    return null;
  }
}

// Script 372: 1 argument.
export function* script372(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    block127: {
      yield* game.setObjectRecordCount(local0, 0x1e);
      yield* game.wait(1, 0x28);
      yield* game.notice(2, 4, 0x14, 4, 0x400, 0x24e, 0x78);
      yield* game.wait(1, 0xa);
      yield* game.appendToFightList(local0);
      if ((yield* script(0x111, local0, 0x102, 0, 0x300, 0x401, 0x204, 0x201)) === 0) {
        yield* game.notice(9, 5, 9, 3, 0x400, 0x24f, 0x78);
        yield* game.addKarma(0xc);
        yield* game.fightListRemove(local0);
        yield* script(0x35d, local0);
        yield* game.setActorStateFlagBits(0x1b66, 1);
        yield* game.wait(1, 0xc8);
        break block127;
      }
      yield* game.setActorStateFlagBits(0x1b66, 2);
      break block127;
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 373: 1 argument.
export function* script373(state, arg0) {
  let local0 = 0;
  block63: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block63;
    }
    block41: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) === 0) {
        break block41;
      }
      yield* script(0x25b, local0, 0x2ee0, 0x222, 2);
      break block41;
    }
    block57: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block57;
      }
      yield* script(0x0d1, 0x1554);
      break block57;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block63;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0, 0x1ee, 0, 4);
  return null;
}

// Script 374: 1 argument.
export function* script374(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 0);
  yield* script(0x045, local0, 3);
  yield* game.notice(2, 2, 0x1b, 4, 0x400, 0xfd, 0xf0);
  yield* game.wait(1, 0x78);
  yield* script(0x045, local0, 3);
  yield* game.wait(1, 0x78);
  yield* script(0x08b, 0xd9);
  return null;
}

// Script 375: 1 argument.
export function* script375(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block101: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block101;
    }
    if ((yield* game.scriptAction(0x100)) !== 0x100) {
      break block101;
    }
    yield* script(0x1fb);
    const t1 = yield* game.chooseUnderGlove(local0);
    local1 = t1 & 0xff;
    if (t1 === 0xffff) {
      break block101;
    }
    block44: {
      if ((yield* game.decrementObjectStateCount(local0)) === 0) {
        break block44;
      }
      yield* game.resetObjectRecordProperty(local0);
      break block44;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.endDialog();
    yield* game.addObjectHeight(local0, 0x20);
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local1)));
    yield* game.removeObject(local0);
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    local0 = (yield* game.createObject(0xb8, t4, t3, t2, 0x382)) & 0xff;
    yield* game.wait(1, 0xa);
    yield* game.blast(local0, 0xd);
    return null;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 376: 1 argument.
export function* script376(state, arg0) {
  let local0 = 0;
  block59: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block59;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 3) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block53: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block53;
      }
      yield* script(0x0d1, 0x1569);
      yield* game.learnSpell(0x54);
      break block53;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block59;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 1, 0x1ef, 0, 4);
  return null;
}

// Script 377: 1 argument.
export function* script377(state, arg0) {
  let local0 = 0;
  block49: {
    local0 = arg0 & 0xff;
    const t1 = word((yield* game.randomBelow(3)) + 0xf);
    const t2 = local0;
    yield* game.setObjectRecordCount(t2, t1);
    const t3 = word(0x46 + ((yield* game.randomByte()) & 0x1f));
    const t4 = local0;
    if ((yield* script(0x076, t4, 3, 0x25, 0, 5, 0, t3)) === 0) {
      yield* game.removeObject(local0);
      break block49;
    }
    yield* script(0x1b4, yield* script(0x068, local0));
    break block49;
  }
  return null;
}

// Script 378: 1 argument.
export function* script378(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  loop9: for (;;) {
    block39: {
      if ((yield* game.wait(0x201, 1)) === 1) {
        break block39;
      }
      yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x9b, 0xf0);
      break block39;
    }
    continue loop9;
  }
}

// Script 379: 1 argument.
export function* script379(state, arg0) {
  let local0 = 0;
  block60: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block60;
    }
    block32: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block32;
      }
      yield* script(0x31c);
      break block32;
    }
    block54: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block54;
      }
      yield* script(0x25b, local0, 0x1388, 0x223, 2);
      break block54;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block60;
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 2, 0x1f0, 0, 4);
  return null;
}

// Script 37A: 1 argument.
export function* script37A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.playSoundEffect(local0, 0xa, 0xff, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 37B: 1 argument.
export function* script37B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x089, local0);
  loop6: for (;;) {
    block220: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block220;
          }
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local8 = t2;
          if (t2 === 0xffff) {
            break block220;
          }
          if (local8 !== 0x14eb) {
            if (((yield* game.getActorKindFlags(local8)) & 0x8000) === 0) {
              yield* game.notice(0xa, 0x15, 0xc, 3, 0x800, 0x1ff, 0xf0);
              break block220;
            }
            block182: {
              if (((yield* game.getActorKindFlags(local8)) & 0x4000) === 0) {
                local4 = 9;
                break block182;
              }
              local4 = 8;
              break block182;
            }
            yield* game.notice(2, 0x15, 0x12, 3, 0x800, local4, 0x78);
            break block220;
          }
          yield* game.endDialog();
          yield* game.setActorStateFlagBits(0x14eb, 1);
          local6 = 0xf0;
          loop115: for (;;) {
            yield* game.playSoundEffect(local0, 0x26, local6, 3);
            yield* game.wait(1, 2);
            const t3 = word(local6 - 0x14);
            local6 = t3;
            if (t3 !== 0) {
              continue loop115;
            }
            break block220;
          }
        } else {
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          local1 = 255;
          break block220;
        }
      } else {
        yield* game.notice(7, 0x15, 0x11, 3, 0x800, 0x1fe, 0xf0);
        break block220;
      }
    }
    if (signed(local1) === 0) {
      continue loop6;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 37C: 1 argument.
export function* script37C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 37D: 1 argument.
export function* script37D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    loop13: for (;;) {
      yield* game.wait(1, 1);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop13;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0x7f);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.wait(1, 0xb4);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
      yield* game.wait(8, 0);
      yield* game.setActorStateFlagBits(0xbbb, 0x80);
      yield* game.setActorStateFlagBits(0x3a3, 0x80);
      yield* game.wait(1, 1);
      yield* game.setObjectRecordFlagBits(local0, 1);
      yield* game.removeObject(local0);
      return null;
    }
  } else {
    return null;
  }
}

// Script 37E: 1 argument.
export function* script37E(state, arg0) {
  let local0 = 0;
  block21: {
    local0 = arg0 & 0xff;
    if ((yield* game.getStoryStage()) !== 1) {
      yield* script(0x0ad, local0);
      break block21;
    }
    yield* script(0x006, local0);
    break block21;
  }
  return null;
}

// Script 37F: 1 argument.
export function* script37F(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22d, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}
