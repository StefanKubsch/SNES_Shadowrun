// Scripts 100 to 11F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  localByte,
  localWord,
  script,
  setLocalWord,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 100: 1 argument.
export function* script100(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x45);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectAnimation(local0, 0);
  local1 = 0;
  loop20: for (;;) {
    yield* game.setObjectDirection(local0, word(local1 + 3));
    yield* game.wait(3, word(0x96 + (yield* game.randomBelow(0x64))));
    local1 = word(local1 + 1) & 3 & 0xff;
    continue loop20;
  }
}

// Script 101: 1 argument.
export function* script101(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop2;
    }
    return null;
  }
}

// Script 102: 1 argument.
export function* script102(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xd2e)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0xd2e, 0, 0x73, 0x2000);
    yield* game.notice(5, 3, 0x10, 3, 0x400, 0x191, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0xc, 0, 0, 0, 0, 0xd2e, 0x28);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 103: 1 argument.
export function* script103(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local1 = in0 & 0xff;
    local2 = t1 & 0xff;
    yield* game.setObjectActionAndDirection(local0, local2, local1);
    if (((yield* game.wait(0x80a, 0)) & 0x800) === 0) {
      if (
        ((yield* game.wait(0x803, word(0x64 + ((yield* game.randomByte()) & 0x7f)))) & 0x800) ===
        0
      ) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  local0 = arg0 & 0xff;
  loop59: for (;;) {
    if ((yield* sub5(3, 7)) === 0) {
      if ((yield* sub5(5, 8)) === 0) {
        if ((yield* sub5(5, 8)) === 0) {
          if ((yield* sub5(7, 7)) === 0) {
            continue loop59;
          }
          return null;
        }
        return null;
      }
      return null;
    }
    return null;
  }
}

// Script 104: 1 argument.
export function* script104(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block91: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, 2);
    const t1 = yield* game.findNearestVisibleMember(local0);
    local1 = t1 & 0xff;
    if (t1 === 0xffff) {
      break block91;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.playSoundEffect(local0, 0x1e, 0xb4, 0xff);
    yield* game.playSoundEffect(local0, 0x1e, 0x64, 0xff);
    yield* game.playSoundEffect(local0, 0x1e, 0x50, 0xff);
    yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local1)));
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0xb8, t4, t3, t2, 0x382);
    yield* game.blast(local0, 0xf);
    break block91;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 105: 1 argument.
export function* script105(state, arg0) {
  const locals = new Uint8Array(10);
  function* sub63(in0, in1) {
    const t1 = in1;
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, t1);
    const t2 = localByte(locals, 3);
    const t3 = yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x21a);
    yield* game.placeObjectOnWaypoint(t3, t2);
    yield* game.wait(1, localWord(locals, 4));
    return;
  }
  function* sub36(in0, in1) {
    const t4 = in1;
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, t4);
    const t5 = localByte(locals, 3);
    const t6 = yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x99);
    yield* game.placeObjectOnWaypoint(t6, t5);
    yield* game.wait(1, localWord(locals, 4));
    return;
  }
  function* sub5(in0, in1, in2, in3) {
    const t7 = in3;
    const t8 = in2;
    const t9 = in1;
    setLocalWord(locals, 3, in0);
    setLocalWord(locals, 5, t9);
    locals[7] = t8 & 0xff;
    setLocalWord(locals, 8, t7);
    const t10 = localByte(locals, 7);
    const t11 = yield* game.createObject(
      localWord(locals, 3),
      0x64,
      0x64,
      0x40,
      localWord(locals, 5),
    );
    yield* game.placeObjectOnWaypoint(t11, t10);
    yield* game.wait(1, localWord(locals, 8));
    return;
  }
  function* sub91(in0, in1, in2, in3) {
    const t12 = in3;
    const t13 = in2;
    const t14 = in1;
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, t14);
    locals[6] = t13 & 0xff;
    setLocalWord(locals, 7, t12);
    const t15 = localByte(locals, 3);
    const t16 = yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a);
    yield* game.placeObjectOnWaypoint(t16, t15);
    yield* game.wait(1, localWord(locals, 4));
    const t17 = localByte(locals, 6);
    const t18 = yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a);
    yield* game.placeObjectOnWaypoint(t18, t17);
    yield* game.wait(1, localWord(locals, 7));
    return;
  }
  locals[0] = arg0 & 0xff;
  block779: {
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 0);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
      block759: {
        if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) === 0) {
          break block759;
        }
        yield* game.wait(1, 1);
        yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0xff7e);
        if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
          break block759;
        }
        yield* game.notice(8, 2, 0x10, 3, 0, 0x25a, 1);
        yield* game.confirmKey();
        yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
        yield* game.setScriptVariable(0x20, 5);
        yield* game.setScriptVariable(0x24, 0);
        state.setWord('GAME_OPTIONS', 0, 3);
        yield* game.changeRoom(0xa0);
        yield* game.wait(1, 1);
        break block759;
      }
      yield* script(0x101, localByte(locals, 0));
      yield* game.setObjectRecordFlagBits(localByte(locals, 0), 1);
      yield* script(0x2e8, localByte(locals, 0), 0x10, 0xa0, 0, 3);
      break block779;
    }
    yield* game.setScriptVariable(0x2c, 1);
    setLocalWord(locals, 1, 8);
    loop176: for (;;) {
      yield* sub63(0xf, 2);
      yield* sub63(0xc, 1);
      yield* sub36(0x19, 3);
      yield* sub36(0xd, 5);
      yield* sub63(0x17, 5);
      yield* sub36(0xa, 4);
      yield* sub36(0x18, 6);
      const t19 = word(localWord(locals, 1) - 1);
      setLocalWord(locals, 1, t19);
      if (t19 !== 0) {
        continue loop176;
      }
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
      loop374: for (;;) {
        yield* sub91(0xa, 5, 0xf, 2);
        yield* sub91(0x13, 4, 0xc, 4);
        yield* sub91(0x18, 8, 0x1a, 2);
        yield* sub91(0x19, 6, 0x19, 6);
        yield* sub5(0x55, 0x8a, 0x11, 0x11);
        yield* sub91(0x14, 5, 0x15, 2);
        yield* sub91(0xd, 4, 0x16, 2);
        yield* sub5(0x55, 0x8a, 0x12, 0x11);
        const t20 = word(localWord(locals, 1) - 1);
        setLocalWord(locals, 1, t20);
        if (t20 !== 0) {
          continue loop374;
        }
        yield* sub5(0x7a, 0x2bf, 0x1c, 0xd);
        yield* sub5(0x7a, 0x2e6, 0x1c, 2);
        yield* sub5(0x7a, 0xdf, 0x1b, 2);
        setLocalWord(locals, 1, 3);
        loop511: for (;;) {
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
          const t21 = word(localWord(locals, 1) - 1);
          setLocalWord(locals, 1, t21);
          if (t21 !== 0) {
            continue loop511;
          }
          break block779;
        }
      }
    }
  }
  yield* game.removeObject(localByte(locals, 0));
  return null;
}

// Script 106: 1 argument.
export function* script106(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x147, local0, 0xffff);
  return null;
}

// Script 107: 1 argument.
export function* script107(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x258);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.setObjectDialog(local0, 0x44);
  yield* game.setObjectFlagBits(local0, 0x2000);
  local1 = 0;
  loop29: for (;;) {
    block122: {
      yield* game.placeObjectOnWaypoint(local0, 0);
      yield* game.native1D(local0, 1);
      if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
        yield* game.native1D(local0, 2);
        if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
          yield* game.native1D(local0, 3);
          if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
            yield* game.stopMotion(local0);
            yield* game.wait(1, 0xa8c);
            break block122;
          }
          local1 = 255;
          break block122;
        }
        local1 = 255;
        break block122;
      }
      local1 = 255;
      break block122;
    }
    if (signed(local1) === 0) {
      continue loop29;
    }
    yield* game.stopMotion(local0);
    yield* script(0x35d, local0);
    return null;
  }
}

// Script 108: 1 argument.
export function* script108(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setActorStateFlagBits(0x1d96, 2);
  yield* script(0x13e, local0);
  return null;
}

// Script 109: 1 argument.
export function* script109(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x02b, local0, 0xffff);
  return null;
}

// Script 10A: no arguments.
export function* script10A(state) {
  yield* game.setScriptVariable(0x2e, 0xda);
  yield* game.setScriptVariable(0x30, 0x120);
  yield* game.changeRoom(0xf1);
  yield* game.wait(1, 1);
  return null;
}

// Script 10B: no arguments.
export function* script10B(state) {
  yield* game.setScriptVariable(0x2e, 0xf6);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(1, 1);
  return null;
}

// Script 10C: 3 arguments, returns a word.
export function* script10C(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0;
  function* sub9() {
    block90: {
      if (!less(yield* game.getObjectRecordCount(local12), 0xb)) {
        yield* game.setObjectAnimation(local12, 2);
        if (local11 !== 0) {
          local11 = 0;
          yield* game.native81(local12, local2 & 0xff);
          break block90;
        }
        local11 = 1;
        yield* game.native81(local12, shiftRight(local2, 8));
        break block90;
      }
      block46: {
        if (local11 === 0xff) {
          break block46;
        }
        yield* game.setObjectAnimation(local12, 2);
        local11 = 255;
        yield* game.native81(local12, shiftRight(local0, 8));
        break block46;
      }
      break block90;
    }
    if ((yield* script(0x241, local12, 0x64, 0x3c, 0x32, 0xb, local11)) === 0) {
      local10 = 0;
      loop114: for (;;) {
        block240: {
          const t1 = yield* game.chooseEnemyTarget(local12);
          local9 = t1 & 0xff;
          if (t1 === 0xffff) {
            if (((yield* game.wait(0x801, 6)) & 0x800) === 0) {
              break block240;
            }
            return 0xffff;
          }
          yield* game.setObjectAnimation(local12, 4);
          yield* game.turnObjectToObject(local12, signed(local9));
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            block219: {
              yield* game.playSoundEffect(local12, 0xc, 0xff, 0xff);
              yield* game.shootAtObject(local12, signed(local9), 2, 1, 0xc, 1);
              if (
                (truth(local4 !== 0) &
                  truth(less(yield* game.randomByte(), 0x1388)) &
                  (signed(local6) ^ 0xffff)) ===
                0
              ) {
                break block219;
              }
              yield* game.notice(5, 6, 0x14, 4, 0x400, local4, 0xa0);
              local6 = 255;
              break block219;
            }
            break block240;
          }
          return 0xffff;
        }
        if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
          if (
            (truth(local10 === 5) |
              (truth(less(yield* game.getObjectRecordCount(local12), 0xb)) &
                truth(local11 !== 0xff))) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local10 = word(local10 + 1) & 0xff;
          continue loop114;
        }
        return 0xffff;
      }
    } else {
      return 0xffff;
    }
  }
  const t2 = arg2;
  const t3 = arg1;
  local0 = arg0;
  local2 = t3;
  local4 = t2;
  local6 = 0;
  local12 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local12, 2, 0);
  yield* game.setObjectFlagBits(local12, 0x140);
  yield* game.appendToFightList(local12);
  yield* game.setObjectArmour(local12, 3);
  local11 = 0;
  loop345: for (;;) {
    if ((yield* sub9()) === 0) {
      continue loop345;
    }
    yield* game.addKarma(word((yield* game.randomBelow(6)) + 2));
    yield* game.fightListRemove(local12);
    return yield* script(0x35d, local12);
  }
}

// Script 10D: 3 arguments.
export function* script10D(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local7 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0;
  block58: {
    const t1 = arg2;
    const t2 = arg1;
    local0 = arg0;
    local2 = t2;
    local4 = t1;
    local12 = shiftRight(local0, 8) & 0xff;
    yield* game.setObjectActionAndDirection(local12, 0, 6);
    yield* game.setObjectRecordCount(local12, 0x46);
    local6 = 0;
    yield* game.appendToFightList(local12);
    yield* game.setObjectArmour(local12, 4);
    local13 = 0;
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      break block58;
    }
    yield* game.wait(1, 0x12c);
    break block58;
  }
  loop58: for (;;) {
    block141: {
      const t3 = yield* game.randomBelow(5);
      local7 = t3;
      if (t3 !== 0) {
        if (local7 !== 1) {
          if (local7 !== 2) {
            if (local7 !== 3) {
              local11 = local4 & 0xff & 0xff;
              break block141;
            }
            local11 = shiftRight(local4, 8) & 0xff;
            break block141;
          }
          local11 = local2 & 0xff & 0xff;
          break block141;
        }
        local11 = shiftRight(local2, 8) & 0xff;
        break block141;
      }
      local11 = local0 & 0xff & 0xff;
      break block141;
    }
    block174: {
      if (local13 === local11) {
        break block174;
      }
      yield* game.setObjectAnimation(local12, 2);
      yield* game.native1D(local12, local11);
      local6 = truth(((yield* game.wait(0x804, 0)) & 0x800) !== 0) & 0xff;
      break block174;
    }
    block372: {
      local13 = local11 & 0xff;
      if (signed(local6) !== 0) {
        break block372;
      }
      block358: {
        const t4 = yield* game.chooseEnemyTarget(local12);
        local9 = t4 & 0xff;
        if (t4 !== 0xffff) {
          block341: {
            yield* game.turnObjectToObject(local12, signed(local9));
            yield* game.setObjectAnimation(local12, 7);
            const t5 = (yield* game.getObjectDirection(local12)) & 0xfffe;
            const t6 = local12;
            yield* game.setObjectDirection(t6, t5);
            yield* game.wait(8, 0);
            yield* game.setObjectAnimation(local12, 4);
            const t7 = (yield* game.getObjectDirection(local12)) & 0xfffe;
            const t8 = local12;
            yield* game.setObjectDirection(t8, t7);
            const t9 = truth(
              ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) &
                0x800) !==
                0,
            );
            local6 = t9 & 0xff;
            if (t9 !== 0) {
              break block341;
            }
            if (
              (truth(((yield* game.randomByte()) & 7) === 0) &
                (truth((yield* game.getScriptVariable(0x2c)) !== 0) ^ 0xffff)) ===
              0
            ) {
              const t13 = word((yield* game.getObjectCoarseHeight(local12)) + 0x20);
              const t14 = yield* game.getObjectCoarseY(local12);
              const t15 = yield* game.getObjectCoarseX(local12);
              yield* game.createObject(0xdc, t15, t14, t13, 0x160);
              break block341;
            }
            const t10 = word((yield* game.getObjectCoarseHeight(local12)) + 0x20);
            const t11 = yield* game.getObjectCoarseY(local12);
            const t12 = yield* game.getObjectCoarseX(local12);
            yield* game.createObject(0x100, t12, t11, t10, 0x268);
            break block341;
          }
          const t16 = (yield* game.getObjectDirection(local12)) & 0xfffe;
          const t17 = local12;
          yield* game.setObjectDirection(t17, t16);
          yield* game.setObjectAnimation(local12, 8);
          break block358;
        }
        yield* game.setObjectAnimation(local12, 0);
        break block358;
      }
      local6 = truth(((yield* game.wait(0x801, 0x3c)) & 0x800) !== 0) & 0xff;
      break block372;
    }
    if (signed(local6) === 0) {
      continue loop58;
    }
    yield* game.addKarma(0x14);
    yield* game.fightListRemove(local12);
    local10 = (yield* script(0x35d, local12)) & 0xff;
    yield* game.wait(1, 0x14);
    const t18 = yield* game.getObjectCoarseHeight(local10);
    const t19 = yield* game.getObjectCoarseY(local10);
    const t20 = yield* game.getObjectCoarseX(local10);
    yield* game.createObject(0x9e, t20, t19, t18, 0x3a6);
    yield* game.setActorStateFlagBits(0x1531, 1);
    yield* game.setScriptVariable(0x28, word((yield* game.getScriptVariable(0x28)) + 1));
    const t21 = yield* game.getObjectCoarseHeight(local10);
    const t22 = yield* game.getObjectCoarseY(local10);
    const t23 = yield* game.getObjectCoarseX(local10);
    yield* game.createObject(0x78, t23, t22, t21, 0x12f);
    yield* game.playSoundEffect(local12, 0x56, 0xff, 3);
    yield* game.markTopic(0x27);
    yield* game.wait(1, 0x190);
    return null;
  }
}

// Script 10E: 1 argument.
export function* script10E(state, arg0) {
  let local0 = 0;
  block60: {
    local0 = arg0;
    if (state.byte('GROUP_INDEX') <= 0) {
      break block60;
    }
    block58: {
      if (state.byte('GROUP_INDEX') <= 2) {
        yield* game.notice(5, 6, 0x16, 4, 0x400, 0x142, 1);
        break block58;
      }
      yield* game.notice(5, 6, 0x14, 3, 0x400, 0x141, 1);
      break block58;
    }
    yield* game.confirmKey();
    break block60;
  }
  yield* game.changeRoom(local0);
  return null;
}

// Script 10F: 1 argument.
export function* script10F(state, arg0) {
  let local0 = 0;
  block54: {
    local0 = arg0 & 0xff;
    if (!less(state.word('FIGHT_UNREAD'), 0xc)) {
      break block54;
    }
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') + 1));
    const t1 = (yield* game.getObjectArmour(local0)) & 7;
    const t2 = shiftRight(yield* game.getObjectArmour(local0), 3);
    const t3 = local0;
    yield* game.setObjectActionAndDirection(t3, t2, t1);
    yield* game.setObjectVelocity(local0, 0, 0, 1);
    yield* game.wait(1, 0x28);
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') - 1));
    break block54;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 110: 1 argument.
export function* script110(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0xf);
  loop7: for (;;) {
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
    continue loop7;
  }
}

// Script 111: 7 arguments, returns a word.
export function* script111(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0,
    local14 = 0,
    local15 = 0,
    local16 = 0,
    local17 = 0;
  function* sub17() {
    block170: {
      if (!less(yield* game.getObjectRecordCount(local15), 0xf)) {
        block162: {
          yield* game.setObjectAnimation(local15, 2);
          if (local14 !== 1) {
            if (local14 !== 3) {
              const t1 = yield* game.chooseEnemyTarget(local15);
              local16 = t1 & 0xff;
              if (t1 === 0xffff) {
                yield* game.native81(local15, shiftRight(local0, 8));
                break block162;
              }
              yield* game.moveObjectStraightToPlayer(local15);
              break block162;
            }
            yield* game.native81(local15, local2 & 0xff);
            break block162;
          }
          yield* game.native81(local15, shiftRight(local2, 8));
          break block162;
        }
        local14 = word(local14 + 1) & 3 & 0xff;
        break block170;
      }
      block84: {
        if (local14 === 0xff) {
          break block84;
        }
        block75: {
          yield* game.setObjectAnimation(local15, 2);
          local14 = 255;
          if ((truth(local4 !== 0) & truth(local4 !== 0xffff)) === 0) {
            break block75;
          }
          yield* game.notice(2, 5, 0x18, 3, 0x400, local4, 0xa0);
          break block75;
        }
        yield* game.native81(local15, shiftRight(local0, 8));
        break block84;
      }
      break block170;
    }
    if ((yield* script(0x241, local15, 0x64, 0x3c, 0x37, 0xf, local14)) === 0) {
      block387: {
        local16 = (yield* game.chooseEnemyTarget(local15)) & 0xff;
        if (
          (truth(less(yield* game.getDistanceToPlayer(local15), 0x78)) &
            truth(signed(local16) !== 0xffff)) ===
          0
        ) {
          if (((yield* game.wait(0x801, 0x1e)) & 0x800) === 0) {
            break block387;
          }
          return 0xffff;
        }
        yield* game.setObjectAnimation(local15, 4);
        yield* game.turnObjectToPlayer(local15);
        if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
          local17 = 0;
          loop243: for (;;) {
            yield* game.setObjectAnimation(local15, 5);
            yield* game.turnObjectToPlayer(local15);
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              block327: {
                yield* game.playSoundEffect(local15, 0xe, 0xff, 0xff);
                const t2 = local8 & 0xff;
                const t3 = shiftRight(local8, 8);
                const t4 = local6 & 0xff;
                const t5 = shiftRight(local6, 8);
                const t6 = yield* game.getPlayerObjectCopy();
                const t7 = local15;
                yield* game.shootAtObject(t7, t6, t5, t4, t3, t2);
                if (local4 === 0xffff) {
                  break block327;
                }
                if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) > 5) {
                  break block327;
                }
                return 0xffff;
              }
              if (local17 === 3) {
                yield* game.setObjectAnimation(local15, 6);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  break block387;
                }
                return 0xffff;
              }
              local17 = word(local17 + 1);
              continue loop243;
            }
            return 0xffff;
          }
        } else {
          return 0xffff;
        }
      }
      if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  const t8 = arg6;
  const t9 = arg5;
  const t10 = arg4;
  const t11 = arg3;
  const t12 = arg2;
  const t13 = arg1;
  local0 = arg0;
  local2 = t13;
  local4 = t12;
  local6 = t11;
  local8 = t10;
  local10 = t9;
  local12 = t8;
  local15 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local15, 2, 0);
  local14 = 0;
  loop424: for (;;) {
    if ((yield* sub17()) === 0) {
      continue loop424;
    }
    if ((yield* game.getObjectRecordCount(local15)) !== 0) {
      return 0xffff;
    }
    return 0;
  }
}

// Script 112: no arguments.
export function* script112(state) {
  yield* game.setScriptVariable(0x2e, 0xdf);
  yield* game.setScriptVariable(0x30, 0x121);
  yield* game.changeRoom(0xf1);
  yield* game.wait(1, 1);
  return null;
}

// Script 113: no arguments.
export function* script113(state) {
  yield* game.setScriptVariable(0x2e, 0xce);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(1, 1);
  return null;
}

// Script 114: 1 argument.
export function* script114(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 3);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.wait(1, 1);
  loop21: for (;;) {
    block61: {
      yield* game.bobObject(local0);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        break block61;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      yield* game.wait(1, 0x1d);
      yield* game.setObjectActionAndDirection(local0, 2, 3);
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

// Script 115: 1 argument.
export function* script115(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block37: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block37;
    }
    yield* game.keepObjectFlagBits(local0, 0);
    yield* game.clearObjectVelocity(local0);
    loop15: for (;;) {
      yield* game.wait(1, 6);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
        continue loop15;
      }
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      break block37;
    }
  }
  loop37: for (;;) {
    block131: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block131;
          }
          yield* game.notice(3, 0x15, 0x1a, 3, 0x800, 0x204, 0xf0);
          break block131;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        yield* script(0x3a2);
        break block131;
      }
      yield* game.notice(7, 0x15, 0x11, 3, 0x800, 0x201, 0xf0);
      break block131;
    }
    if (signed(local1) === 0) {
      continue loop37;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 116: 1 argument.
export function* script116(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(0x10, 0);
  yield* game.setScriptVariable(0xa, 0xffff);
  yield* game.notice(2, 2, 0x1c, 3, 0, 0x21, 0x190);
  yield* game.removeObject(local0);
  return null;
}

// Script 117: 1 argument.
export function* script117(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x04c, local0, 0x8c, 3, 0x168f);
  return null;
}

// Script 118: 1 argument.
export function* script118(state, arg0) {
  let local0 = 0;
  block50: {
    local0 = arg0;
    if (((yield* game.getActorStateFlags(0x1b66)) & 0x80) === 0) {
      yield* game.topicText(local0);
      if ((yield* game.question(0x18, 8)) === 0) {
        yield* game.topicText(0xe2);
        break block50;
      }
      yield* game.setActorStateFlagBits(0x1b66, 4);
      yield* game.endDialog();
      break block50;
    }
    yield* game.topicText(0xe1);
    break block50;
  }
  return null;
}

// Script 119: no arguments.
export function* script119(state) {
  yield* script(0x10e, 0x1dc);
  return null;
}

// Script 11A: no arguments.
export function* script11A(state) {
  yield* game.setScriptVariable(0x2e, 0xfd);
  yield* game.setScriptVariable(0x30, 0x122);
  yield* game.changeRoom(0xf1);
  yield* game.wait(1, 1);
  return null;
}

// Script 11B: no arguments.
export function* script11B(state) {
  yield* game.setScriptVariable(0x2e, 0xe6);
  yield* game.setScriptVariable(0x30, 0xffff);
  yield* game.changeRoom(0x1d1);
  yield* game.wait(1, 1);
  return null;
}

// Script 11C: 1 argument.
export function* script11C(state, arg0) {
  let local0 = 0;
  block55: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block55;
    }
    block35: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block35;
      }
      yield* script(0x0d1, 0x15a1);
      break block35;
    }
    block49: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 3) <= 0) {
        break block49;
      }
      yield* script(0x31c);
      break block49;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block55;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setActorStateFlagBits(0xdc1, 2);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 1, 0x160, 0, 1);
  return null;
}

// Script 11D: no arguments.
export function* script11D(state) {
  yield* game.notice(2, 2, 0x1c, 3, 0, 0x25f, 0xa);
  yield* game.setScriptVariable(0x16, 1);
  state.setByte(0x3bfc, 0, 4);
  state.setByte(0x3c04, 0, 5);
  state.setByte(0x3c09, 0, 2);
  state.setByte(0x3c0b, 0, 2);
  state.setByte(0x3c07, 0, 2);
  state.setByte(0x3c0c, 0, 2);
  state.setByte(0x3c08, 0, 2);
  yield* game.restoreRunners();
  yield* game.confirmKey();
  yield* game.changeRoom(0xd2);
  yield* game.wait(1, 1);
  return null;
}

// Script 11E: no arguments.
export function* script11E(state) {
  yield* game.learnSpell(0x51);
  return null;
}

// Script 11F: 1 argument.
export function* script11F(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x11, 0x1c, 9, 0x800, 0x230, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}
