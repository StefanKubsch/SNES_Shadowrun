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
  for (;;) {
    yield* game.setObjectDirection(local0, word(local1 + 3));
    yield* game.wait(3, word(0x96 + (yield* game.randomBelow(0x64))));
    local1 = word(local1 + 1) & 3 & 0xff;
  }
}

// Script 101: 1 argument.
export function* script101(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      return null;
    }
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
    local1 = in0 & 0xff;
    local2 = in1 & 0xff;
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
  for (;;) {
    if ((yield* sub5(3, 7)) === 0) {
      if ((yield* sub5(5, 8)) === 0) {
        if ((yield* sub5(5, 8)) === 0) {
          if ((yield* sub5(7, 7)) !== 0) {
            return null;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
}

// Script 104: 1 argument.
export function* script104(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 2);
  const t1 = yield* game.findNearestVisibleMember(local0);
  local1 = t1 & 0xff;
  if (t1 !== 0xffff) {
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
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 105: 1 argument.
export function* script105(state, arg0) {
  const locals = new Uint8Array(10);
  function* sub63(in0, in1) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x21a),
      localByte(locals, 3),
    );
    yield* game.wait(1, localWord(locals, 4));
  }
  function* sub36(in0, in1) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0xe6, 0x64, 0x64, 0x40, 0x99),
      localByte(locals, 3),
    );
    yield* game.wait(1, localWord(locals, 4));
  }
  function* sub5(in0, in1, in2, in3) {
    setLocalWord(locals, 3, in0);
    setLocalWord(locals, 5, in1);
    locals[7] = in2 & 0xff;
    setLocalWord(locals, 8, in3);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(localWord(locals, 3), 0x64, 0x64, 0x40, localWord(locals, 5)),
      localByte(locals, 7),
    );
    yield* game.wait(1, localWord(locals, 8));
  }
  function* sub91(in0, in1, in2, in3) {
    locals[3] = in0 & 0xff;
    setLocalWord(locals, 4, in1);
    locals[6] = in2 & 0xff;
    setLocalWord(locals, 7, in3);
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a),
      localByte(locals, 3),
    );
    yield* game.wait(1, localWord(locals, 4));
    yield* game.placeObjectOnWaypoint(
      yield* game.createObject(0x7a, 0x64, 0x64, 0x40, 0x37a),
      localByte(locals, 6),
    );
    yield* game.wait(1, localWord(locals, 7));
  }
  locals[0] = arg0 & 0xff;
  block779: {
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 0);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
      if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) !== 0) {
        yield* game.wait(1, 1);
        yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0xff7e);
        if ((state.byte('DECKER_DATA_BITS') & 0x80) !== 0) {
          yield* game.notice(8, 2, 0x10, 3, 0, 0x25a, 1);
          yield* game.confirmKey();
          yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
          yield* game.setScriptVariable(0x20, 5);
          yield* game.setScriptVariable(0x24, 0);
          state.setWord('GAME_OPTIONS', 0, 3);
          yield* game.changeRoom(0xa0);
          yield* game.wait(1, 1);
        }
      }
      yield* script(0x101, localByte(locals, 0));
      yield* game.setObjectRecordFlagBits(localByte(locals, 0), 1);
      yield* script(0x2e8, localByte(locals, 0), 0x10, 0xa0, 0, 3);
    } else {
      yield* game.setScriptVariable(0x2c, 1);
      setLocalWord(locals, 1, 8);
      for (;;) {
        yield* sub63(0xf, 2);
        yield* sub63(0xc, 1);
        yield* sub36(0x19, 3);
        yield* sub36(0xd, 5);
        yield* sub63(0x17, 5);
        yield* sub36(0xa, 4);
        yield* sub36(0x18, 6);
        setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
        if (localWord(locals, 1) === 0) {
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
          for (;;) {
            yield* sub91(0xa, 5, 0xf, 2);
            yield* sub91(0x13, 4, 0xc, 4);
            yield* sub91(0x18, 8, 0x1a, 2);
            yield* sub91(0x19, 6, 0x19, 6);
            yield* sub5(0x55, 0x8a, 0x11, 0x11);
            yield* sub91(0x14, 5, 0x15, 2);
            yield* sub91(0xd, 4, 0x16, 2);
            yield* sub5(0x55, 0x8a, 0x12, 0x11);
            setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
            if (localWord(locals, 1) === 0) {
              yield* sub5(0x7a, 0x2bf, 0x1c, 0xd);
              yield* sub5(0x7a, 0x2e6, 0x1c, 2);
              yield* sub5(0x7a, 0xdf, 0x1b, 2);
              setLocalWord(locals, 1, 3);
              for (;;) {
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
                setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
                if (localWord(locals, 1) === 0) {
                  break block779;
                }
              }
            }
          }
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
  for (;;) {
    yield* game.placeObjectOnWaypoint(local0, 0);
    yield* game.moveObjectToWaypoint(local0, 1);
    if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
      yield* game.moveObjectToWaypoint(local0, 2);
      if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
        yield* game.moveObjectToWaypoint(local0, 3);
        if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
          yield* game.stopMotion(local0);
          yield* game.wait(1, 0xa8c);
        } else {
          local1 = 255;
        }
      } else {
        local1 = 255;
      }
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.stopMotion(local0);
      yield* script(0x35d, local0);
      return null;
    }
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
    if (!less(yield* game.getObjectRecordCount(local12), 0xb)) {
      yield* game.setObjectAnimation(local12, 2);
      if (local11 !== 0) {
        local11 = 0;
        yield* game.moveObjectStraightToWaypoint(local12, local2 & 0xff);
      } else {
        local11 = 1;
        yield* game.moveObjectStraightToWaypoint(local12, shiftRight(local2, 8));
      }
    } else {
      if (local11 !== 0xff) {
        yield* game.setObjectAnimation(local12, 2);
        local11 = 255;
        yield* game.moveObjectStraightToWaypoint(local12, shiftRight(local0, 8));
      }
    }
    if ((yield* script(0x241, local12, 0x64, 0x3c, 0x32, 0xb, local11)) === 0) {
      local10 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local12);
        local9 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(0x801, 6)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(local12, 4);
          yield* game.turnObjectToObject(local12, signed(local9));
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            yield* game.playSoundEffect(local12, 0xc, 0xff, 0xff);
            yield* game.shootAtObject(local12, signed(local9), 2, 1, 0xc, 1);
            if (
              (truth(local4 !== 0) &
                truth(less(yield* game.randomByte(), 0x1388)) &
                (signed(local6) ^ 0xffff)) !==
              0
            ) {
              yield* game.notice(5, 6, 0x14, 4, 0x400, local4, 0xa0);
              local6 = 255;
            }
          } else {
            return 0xffff;
          }
        }
        if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
          if (
            (truth(local10 === 5) |
              truth(less(yield* game.getObjectRecordCount(local12), 0xb) && local11 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local10 = word(local10 + 1) & 0xff;
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
  local6 = 0;
  local12 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local12, 2, 0);
  yield* game.setObjectFlagBits(local12, 0x140);
  yield* game.appendToFightList(local12);
  yield* game.setObjectArmour(local12, 3);
  local11 = 0;
  for (;;) {
    if ((yield* sub9()) !== 0) {
      yield* game.addKarma(word((yield* game.randomBelow(6)) + 2));
      yield* game.fightListRemove(local12);
      return yield* script(0x35d, local12);
    }
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
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  local12 = shiftRight(local0, 8) & 0xff;
  yield* game.setObjectActionAndDirection(local12, 0, 6);
  yield* game.setObjectRecordCount(local12, 0x46);
  local6 = 0;
  yield* game.appendToFightList(local12);
  yield* game.setObjectArmour(local12, 4);
  local13 = 0;
  if ((yield* game.getScriptVariable(0x2c)) !== 0) {
    yield* game.wait(1, 0x12c);
  }
  for (;;) {
    const t1 = yield* game.randomBelow(5);
    local7 = t1;
    if (local7 !== 0) {
      if (local7 !== 1) {
        if (local7 !== 2) {
          if (local7 !== 3) {
            local11 = local4 & 0xff & 0xff;
          } else {
            local11 = shiftRight(local4, 8) & 0xff;
          }
        } else {
          local11 = local2 & 0xff & 0xff;
        }
      } else {
        local11 = shiftRight(local2, 8) & 0xff;
      }
    } else {
      local11 = local0 & 0xff & 0xff;
    }
    if (local13 !== local11) {
      yield* game.setObjectAnimation(local12, 2);
      yield* game.moveObjectToWaypoint(local12, local11);
      local6 = truth(((yield* game.wait(0x804, 0)) & 0x800) !== 0) & 0xff;
    }
    local13 = local11 & 0xff;
    if (signed(local6) === 0) {
      const t2 = yield* game.chooseEnemyTarget(local12);
      local9 = t2 & 0xff;
      if (t2 !== 0xffff) {
        yield* game.turnObjectToObject(local12, signed(local9));
        yield* game.setObjectAnimation(local12, 7);
        yield* game.setObjectDirection(local12, (yield* game.getObjectDirection(local12)) & 0xfffe);
        yield* game.wait(8, 0);
        yield* game.setObjectAnimation(local12, 4);
        yield* game.setObjectDirection(local12, (yield* game.getObjectDirection(local12)) & 0xfffe);
        const t3 = truth(
          ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !==
            0,
        );
        local6 = t3 & 0xff;
        if (t3 === 0) {
          if (
            (truth(((yield* game.randomByte()) & 7) === 0) &
              (truth((yield* game.getScriptVariable(0x2c)) !== 0) ^ 0xffff)) ===
            0
          ) {
            const t7 = word((yield* game.getObjectCoarseHeight(local12)) + 0x20);
            const t8 = yield* game.getObjectCoarseY(local12);
            const t9 = yield* game.getObjectCoarseX(local12);
            yield* game.createObject(0xdc, t9, t8, t7, 0x160);
          } else {
            const t4 = word((yield* game.getObjectCoarseHeight(local12)) + 0x20);
            const t5 = yield* game.getObjectCoarseY(local12);
            const t6 = yield* game.getObjectCoarseX(local12);
            yield* game.createObject(0x100, t6, t5, t4, 0x268);
          }
        }
        yield* game.setObjectDirection(local12, (yield* game.getObjectDirection(local12)) & 0xfffe);
        yield* game.setObjectAnimation(local12, 8);
      } else {
        yield* game.setObjectAnimation(local12, 0);
      }
      local6 = truth(((yield* game.wait(0x801, 0x3c)) & 0x800) !== 0) & 0xff;
    }
    if (signed(local6) !== 0) {
      yield* game.addKarma(0x14);
      yield* game.fightListRemove(local12);
      local10 = (yield* script(0x35d, local12)) & 0xff;
      yield* game.wait(1, 0x14);
      const t10 = yield* game.getObjectCoarseHeight(local10);
      const t11 = yield* game.getObjectCoarseY(local10);
      const t12 = yield* game.getObjectCoarseX(local10);
      yield* game.createObject(0x9e, t12, t11, t10, 0x3a6);
      yield* game.setActorStateFlagBits(0x1531, 1);
      yield* game.setScriptVariable(0x28, word((yield* game.getScriptVariable(0x28)) + 1));
      const t13 = yield* game.getObjectCoarseHeight(local10);
      const t14 = yield* game.getObjectCoarseY(local10);
      const t15 = yield* game.getObjectCoarseX(local10);
      yield* game.createObject(0x78, t15, t14, t13, 0x12f);
      yield* game.playSoundEffect(local12, 0x56, 0xff, 3);
      yield* game.markTopic(0x27);
      yield* game.wait(1, 0x190);
      return null;
    }
  }
}

// Script 10E: 1 argument.
export function* script10E(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if (state.byte('GROUP_INDEX') > 0) {
    if (state.byte('GROUP_INDEX') <= 2) {
      yield* game.notice(5, 6, 0x16, 4, 0x400, 0x142, 1);
    } else {
      yield* game.notice(5, 6, 0x14, 3, 0x400, 0x141, 1);
    }
    yield* game.confirmKey();
  }
  yield* game.changeRoom(local0);
  return null;
}

// Script 10F: 1 argument.
export function* script10F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(state.word('FIGHT_UNREAD'), 0xc)) {
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') + 1));
    const t1 = (yield* game.getObjectArmour(local0)) & 7;
    const t2 = shiftRight(yield* game.getObjectArmour(local0), 3);
    yield* game.setObjectActionAndDirection(local0, t2, t1);
    yield* game.setObjectVelocity(local0, 0, 0, 1);
    yield* game.wait(1, 0x28);
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') - 1));
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 110: 1 argument.
export function* script110(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0xf);
  for (;;) {
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
    yield* game.setObjectActionAndDirection(local0, 7, 3);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0xc8));
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
    if (!less(yield* game.getObjectRecordCount(local15), 0xf)) {
      yield* game.setObjectAnimation(local15, 2);
      if (local14 !== 1) {
        if (local14 !== 3) {
          const t1 = yield* game.chooseEnemyTarget(local15);
          local16 = t1 & 0xff;
          if (t1 === 0xffff) {
            yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local0, 8));
          } else {
            yield* game.moveObjectStraightToPlayer(local15);
          }
        } else {
          yield* game.moveObjectStraightToWaypoint(local15, local2 & 0xff);
        }
      } else {
        yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local2, 8));
      }
      local14 = word(local14 + 1) & 3 & 0xff;
    } else {
      if (local14 !== 0xff) {
        yield* game.setObjectAnimation(local15, 2);
        local14 = 255;
        if (local4 !== 0 && local4 !== 0xffff) {
          yield* game.notice(2, 5, 0x18, 3, 0x400, local4, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local0, 8));
      }
    }
    if ((yield* script(0x241, local15, 0x64, 0x3c, 0x37, 0xf, local14)) === 0) {
      block387: {
        local16 = (yield* game.chooseEnemyTarget(local15)) & 0xff;
        if (!(less(yield* game.getDistanceToPlayer(local15), 0x78) && signed(local16) !== 0xffff)) {
          if (((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(local15, 4);
          yield* game.turnObjectToPlayer(local15);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            local17 = 0;
            for (;;) {
              yield* game.setObjectAnimation(local15, 5);
              yield* game.turnObjectToPlayer(local15);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                yield* game.playSoundEffect(local15, 0xe, 0xff, 0xff);
                yield* game.shootAtObject(
                  local15,
                  yield* game.getPlayerObjectCopy(),
                  shiftRight(local6, 8),
                  local6 & 0xff,
                  shiftRight(local8, 8),
                  local8 & 0xff,
                );
                if (local4 !== 0xffff) {
                  if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
                    return 0xffff;
                  }
                }
                if (local17 === 3) {
                  yield* game.setObjectAnimation(local15, 6);
                  if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                    break block387;
                  }
                  return 0xffff;
                }
                local17 = word(local17 + 1);
              } else {
                return 0xffff;
              }
            }
          } else {
            return 0xffff;
          }
        }
      }
      if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  local6 = arg3;
  local8 = arg4;
  local10 = arg5;
  local12 = arg6;
  local15 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local15, 2, 0);
  local14 = 0;
  for (;;) {
    if ((yield* sub17()) !== 0) {
      if ((yield* game.getObjectRecordCount(local15)) !== 0) {
        return 0xffff;
      }
      return 0;
    }
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
  for (;;) {
    yield* game.bobObject(local0);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      yield* game.wait(1, 0x1d);
      yield* game.setObjectActionAndDirection(local0, 2, 3);
    }
    yield* game.wait(1, 1);
    if (state.word('CIRCLE_LEADER_ALIVE') === 0) {
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 115: 1 argument.
export function* script115(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block37: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      yield* game.keepObjectFlagBits(local0, 0);
      yield* game.clearObjectVelocity(local0);
      for (;;) {
        yield* game.wait(1, 6);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x40) !== 0) {
          yield* game.setObjectActionAndDirection(local0, 0, 0);
          break block37;
        }
      }
    }
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* game.notice(3, 0x15, 0x1a, 3, 0x800, 0x204, 0xf0);
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        yield* script(0x3a2);
      }
    } else {
      yield* game.notice(7, 0x15, 0x11, 3, 0x800, 0x201, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
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
  local0 = arg0;
  if (((yield* game.getActorStateFlags(0x1b66)) & 0x80) === 0) {
    yield* game.topicText(local0);
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0xe2);
    } else {
      yield* game.setActorStateFlagBits(0x1b66, 4);
      yield* game.endDialog();
    }
  } else {
    yield* game.topicText(0xe1);
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
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x0d1, 0x15a1);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 3) > 0) {
      yield* script(0x31c);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
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
  state.setByte('JAKE_MAGIC', 0, 4);
  state.setByte('JAKE_COMPUTER', 0, 5);
  state.setByte('JAKE_INVISIBILITY', 0, 2);
  state.setByte('JAKE_SUMMON_SPIRIT', 0, 2);
  state.setByte('JAKE_POWERBALL', 0, 2);
  state.setByte('JAKE_FREEZE', 0, 2);
  state.setByte('JAKE_HEAL', 0, 2);
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
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x11, 0x1c, 9, 0x800, 0x230, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}
