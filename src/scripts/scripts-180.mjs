// Scripts 180 to 19F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 180: no arguments.
export function* script180(state) {
  yield* script(0x10e, 0xdc);
  return null;
}

// Script 181: no arguments.
export function* script181(state) {
  const t1 = yield* script(0x03f, 0x7d0, 0x6a4, 0x3e8);
  const t2 = yield* script(0x0b2, 0x15c, 0x15d, 0x15e);
  yield* script(0x162, 0x98b, t2, t1, 0x15b, 0x15a);
  return null;
}

// Script 182: 1 argument.
export function* script182(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x317)) & 2) === 0) {
    yield* game.addNuyen(0x1f4);
    yield* game.setActorStateFlagBits(0x317, 2);
    return null;
  }
  return null;
}

// Script 183: 1 argument.
export function* script183(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 0);
  yield* script(0x3a4, local0, 1);
  yield* script(0x045, local0, 5);
  yield* game.notice(2, 2, 0x15, 3, 0x400, 0xf4, 0xf0);
  yield* script(0x3a4, local0, 2);
  yield* game.notice(5, 4, 0x18, 3, 0x400, 0xf5, 0xf0);
  yield* script(0x045, local0, 8);
  yield* script(0x08b, 0xf0);
  return null;
}

// Script 184: 1 argument.
export function* script184(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.placeObjectOnWaypoint(local0, 1);
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0x64);
  yield* game.removeObject(local0);
  return null;
}

// Script 185: 1 argument.
export function* script185(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0);
  yield* game.setObjectFlags(local0, 0x140);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  local1 = 0;
  yield* game.appendToFightList(local0);
  for (;;) {
    block58: {
      local1 = (yield* script(0x0ac, local0, 0, signed(local1))) & 0xff;
      yield* game.setObjectDirection(local0, 6);
      if (signed(local1) === 0) {
        for (;;) {
          yield* game.wait(1, 1);
          if (less(yield* game.getDistanceToPlayer(local0), 0xb4)) {
            break block58;
          }
        }
      }
    }
    const t1 = yield* script(0x0ac, local0, 2, signed(local1));
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      yield* game.fightListRemove(local0);
      yield* game.releaseObjectGraphics(local0);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 186: 1 argument.
export function* script186(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* script(0x1a2, local0, 3, 0, 0xffff, 0);
  return null;
}

// Script 187: 1 argument.
export function* script187(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* script(0x1a2, local0, 3, 0, 0xffff, 0);
  return null;
}

// Script 188: 1 argument.
export function* script188(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* game.setScriptVariable(8, 0x7d9);
  yield* script(0x00b, local0, 1, 2, 0xc0, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 189: 1 argument.
export function* script189(state, arg0) {
  let local0 = 0,
    local1 = 0;
  function* sub5(in0) {
    local1 = in0;
    for (;;) {
      yield* game.wait(1, 1);
      if ((state.word('PAD_HELD') & 0xf0f0) !== 0) {
        state.setWord('MAIN_LOOP_RELOAD', 0, 0xffff);
      }
      local1 = word(local1 - 1);
      if (local1 === 0) {
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  yield* game.releaseGlove();
  yield* sub5(0x514);
  yield* game.setObjectActionAndDirection(local0, 1, 2);
  yield* game.setObjectVelocity(local0, 3, 0, 0);
  yield* sub5(0x64);
  yield* game.startBrightnessFade(4);
  yield* sub5(0x32);
  state.setWord('MAIN_LOOP_RELOAD', 0, 0xffff);
  return null;
}

// Script 18A: 1 argument.
export function* script18A(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0, in1) {
    local3 = in0;
    local5 = in1;
    if (((yield* game.wait(local3 | 0x800, local5)) & 0x800) !== 0) {
      local2 = 255;
    }
  }
  local0 = arg0 & 0xff;
  yield* game.wait(1, word((yield* game.randomBelow(0x3c)) + 0xa));
  yield* game.setObjectArmour(local0, 3);
  yield* game.setObjectRecordCount(local0, 0x14);
  local2 = 0;
  yield* game.appendToFightList(local0);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectActionAndDirection(local0, 3, 7);
  yield* sub5(8, 0);
  yield* game.setObjectAnimation(local0, 1);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local1 = t1 & 0xff;
    yield* game.moveObjectStraightToObject(local0, t1);
    if (signed(local1) !== 0xffff) {
      if (less(yield* game.getDistanceBetweenObjects(local0, signed(local1)), 0xa)) {
        yield* game.shootAtObject(local0, signed(local1), 4, 4, 8, 2);
      }
      if (((yield* game.wait(5, 0x28)) & 4) !== 0) {
        yield* game.moveObjectStraightToObject(local0, signed(local1));
      }
    }
    yield* sub5(1, 0x28);
    if ((signed(local2) | truth(signed(local1) === 0xffff)) !== 0) {
      if (signed(local2) !== 0) {
        yield* game.addKarma(3);
      }
      yield* game.fightListRemove(local0);
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      if (signed(local2) === 0) {
        yield* game.setObjectAnimation(local0, 8);
        yield* game.wait(8, 0);
      } else {
        yield* script(0x276, local0);
      }
      yield* game.removeObject(local0);
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
      return null;
    }
  }
}

// Script 18B: 1 argument.
export function* script18B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.notice(8, 2, 0xd, 3, 0, 0x1da, 0xf0);
  yield* script(0x0d2, local0);
  return null;
}

// Script 18C: 1 argument.
export function* script18C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0;
  function* sub5(in0, in1) {
    local3 = in0 & 0xff;
    local4 = in1 & 0xff;
    yield* game.setObjectAnimation(local0, 1);
    yield* game.moveObjectToWaypoint(local0, local3);
    yield* game.wait(6, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 0, local4);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x3f) + 0x3c));
    yield* game.setObjectAnimation(local0, 1);
    yield* game.moveObjectToWaypoint(local0, 3);
    yield* game.wait(6, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 1, 0);
    yield* game.setObjectVelocity(local0, 0, 2, 0);
    yield* game.wait(3, 0x3c);
    yield* game.clearObjectVelocity(local0);
    yield* game.setObjectAnimation(local0, 0);
    yield* game.wait(3, 0x3c);
    yield* game.setObjectActionAndDirection(local0, 1, 4);
    yield* game.setObjectVelocity(local0, 0, 0xfffe, 0);
    yield* game.wait(3, 0x3c);
    yield* game.clearObjectVelocity(local0);
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x8a);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectToWaypoint(local0, 3);
  yield* game.wait(6, 0);
  yield* game.stopMotion(local0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(3, word(((yield* game.randomByte()) & 0x3f) + 1));
  for (;;) {
    const t1 = yield* game.randomBelow(6);
    local1 = t1;
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          if (local1 !== 3) {
            if (local1 !== 4) {
              if (local1 === 5) {
                yield* sub5(7, 2);
              }
            } else {
              yield* sub5(8, 6);
            }
          } else {
            yield* sub5(6, 4);
          }
        } else {
          yield* sub5(2, 0);
        }
      } else {
        yield* sub5(4, 2);
      }
    } else {
      yield* sub5(5, 2);
    }
  }
}

// Script 18D: no arguments.
export function* script18D(state) {
  yield* game.releaseGlove();
  if (((yield* game.getActorStateFlags(0x78c)) & 0x80) !== 0) {
    yield* game.keepActorStateFlagBits(0x78c, 0xff7f);
  }
  if (((yield* game.getActorStateFlags(0xba6)) & 0x80) !== 0) {
    yield* game.keepActorStateFlagBits(0xba6, 0xff7f);
  }
  yield* game.createObject(0xb0, 0x249, 0x237, 0x40, 0x326);
  yield* game.createObject(0xb1, 0x242, 0x230, 0x40, 0x2f6);
  yield* game.wait(1, 0xc8);
  yield* game.notice(2, 0x15, 0x1c, 4, 0x800, 0xe8, 0xf0);
  yield* game.wait(1, 0xdc);
  yield* game.notice(2, 2, 0x1c, 3, 0x400, 0xe9, 0xf0);
  yield* game.wait(1, 0x190);
  yield* game.notice(3, 2, 0x1a, 3, 0x400, 0xea, 0xf0);
  yield* game.wait(1, 0x104);
  return null;
}

// Script 18E: 1 argument.
export function* script18E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f2, local0, 1, 2, 3, 1);
  return null;
}

// Script 18F: 1 argument.
export function* script18F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlags(local0, 0);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 190: 1 argument.
export function* script190(state, arg0) {
  let local0 = 0,
    local3 = 0;
  block108: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      yield* script(0x0ae, local0);
      yield* game.notice(4, 4, 6, 3, 0x400, 0x7b, 0x3c);
      local3 = 0;
      for (;;) {
        if (((yield* game.wait(0x81, 1)) & 0x80) === 0) {
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
            local3 = 255;
          }
        } else {
          yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x6a, 0xf0);
        }
        if (signed(local3) !== 0) {
          yield* game.setObjectRecordFlagBits(local0, 1);
          yield* game.setObjectAnimation(local0, 1);
          yield* game.wait(8, 0);
          yield* game.talk(local0, 0x5c);
          break block108;
        }
      }
    }
  }
  yield* game.setObjectActionAndDirection(local0, 7, 5);
  for (;;) {
    if (((yield* game.getObjectRecordFlags(local0)) & 2) !== 0) {
      yield* game.setObjectAnimation(local0, 2);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 3);
      yield* game.setObjectVelocity(local0, 0, 0, 2);
      yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
      yield* game.wait(8, 0);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      yield* game.markTopic(0x11);
      return null;
    }
    yield* game.wait(2, 0);
    yield* game.talk(local0, 0x5c);
  }
}

// Script 191: 1 argument.
export function* script191(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* script(0x1a2, local0, 3, 0, 0xffff, 0xffff);
  return null;
}

// Script 192: 1 argument.
export function* script192(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* script(0x1a2, local0, 3, 0, 0xffff, 0xffff);
  return null;
}

// Script 193: 1 argument.
export function* script193(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x0ae, local0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* game.endDialog();
          yield* game.wait(1, 1);
          state.setByte(
            'JAKE_ALTERNATE_PORTRAIT',
            0,
            signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) ^ 0xffff,
          );
          yield* game.notice(2, 0x16, 0x12, 3, 0x800, 0x9e, 0xf0);
          yield* game.resetObjectRecordProperty(local0);
          local1 = 255;
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0xe, 3, 0x800, 0x9d, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 194: 1 argument, returns a word.
export function* script194(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.faceRoomDirection(local0);
  yield* game.setObjectFlagBits(local0, 0x60);
  local1 = truth(((yield* game.wait(0x801, 0xc)) & 0x800) !== 0) & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xff9f);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 0);
  return signed(local1);
}

// Script 195: 6 arguments.
export function* script195(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local13 = 0;
  block228: {
    local0 = arg0 & 0xff;
    local1 = arg1;
    local3 = arg2;
    local5 = arg3 & 0xff;
    local6 = arg4 & 0xff;
    local7 = arg5 & 0xff;
    if ((yield* script(0x07e, local6)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectRecordCount(local0, local7);
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.wait(8, 0);
      local8 = 0;
      local9 = 255;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local10 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (signed(local9) !== 0) {
            yield* game.appendToFightList(local0);
            local9 = 0;
          }
          if (signed(local5) === 0) {
            local11 = yield* game.getObjectCoarseX(signed(local10));
            local13 = yield* game.getObjectCoarseY(signed(local10));
          } else {
            local11 = yield* game.getObjectCoarseY(signed(local10));
            local13 = yield* game.getObjectCoarseX(signed(local10));
          }
          if (local1 > local11) {
            yield* game.setObjectAnimation(local0, 4);
            yield* game.shootAtObject(local0, signed(local10), 2, 0, 5, 0);
            if (!less(local3, local13)) {
              yield* game.setObjectDirection(local0, 7);
            } else {
              yield* game.setObjectDirection(local0, 3);
            }
            yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
            local8 =
              truth(
                ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0xf) + 0x1e))) &
                  0x800) !==
                  0,
              ) & 0xff;
          }
        }
        if (signed(local8) !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(local0);
          yield* game.setObjectActionAndDirection(local0, 6, 5);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          yield* game.clearObjectTask(local0);
          break block228;
        }
        local8 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
      }
    }
  }
  return null;
}

// Script 196: 1 argument.
export function* script196(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 6);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectArmour(local0, 1);
  yield* script(0x336, local0, 0x12, 0x32);
  return null;
}

// Script 197: 1 argument, returns a word.
export function* script197(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if (local0 !== 0x8b2) {
    if (local0 !== 0x1458) {
      if (local0 !== 0x89d) {
        if (local0 !== 0x15d2) {
          if (local0 !== 0x79a) {
            if (local0 !== 0xa4f) {
              if (local0 !== 0xd2e) {
                if (local0 !== 0x1b6d) {
                  if (local0 !== 0xb52) {
                    if (local0 !== 0xba6) {
                      if (local0 !== 0x78c) {
                        if (local0 !== 0xb3d) {
                          if (local0 !== 0x98b) {
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

// Script 198: 1 argument.
export function* script198(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 5);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectArmour(local0, 1);
  yield* script(0x336, local0, 0x32, 0xc);
  return null;
}

// Script 199: 1 argument.
export function* script199(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    block174: {
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.placeObjectOnWaypoint(local0, 0);
        yield* script(0x0ae, local0);
        yield* game.setObjectDialog(local0, 0x10);
        local1 = 0;
        for (;;) {
          if (((yield* game.wait(0x83, 1)) & 0x80) === 0) {
            if ((yield* game.isActorStateProperty(0xfce, 0x237)) !== 0) {
              local1 = 255;
            }
          } else {
            yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0xa8, 0xf0);
          }
          if (signed(local1) !== 0) {
            yield* game.setObjectRecordFlagBits(local0, 1);
            yield* game.wait(1, 0x3c);
            yield* game.notice(0xc, 2, 0x11, 3, 0x400, 0xa9, 0x78);
            yield* game.wait(1, 0x3c);
            yield* game.setObjectActionAndDirection(local0, 1, 0);
            yield* game.setObjectVelocity(local0, 0, 2, 0);
            yield* game.wait(1, 0x64);
            yield* game.moveObjectToWaypoint(local0, 1);
            yield* game.wait(4, 0);
            yield* game.stopMotion(local0);
            break block174;
          }
        }
      } else {
        yield* game.placeObjectOnWaypoint(local0, 1);
        yield* script(0x0ae, local0);
        yield* game.setObjectDialog(local0, 0x11);
        yield* game.wait(2, 0);
      }
    }
  }
}

// Script 19A: no arguments.
export function* script19A(state) {
  const t1 = yield* script(0x03f, 0x3e8, 0x384, 0x320);
  const t2 = yield* script(0x0b2, 0x157, 0x158, 0x159);
  yield* script(0x162, 0x89d, t2, t1, 0x156, 0x155);
  return null;
}

// Script 19B: 1 argument.
export function* script19B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x64, 0x6e, 0);
  return null;
}

// Script 19C: 1 argument.
export function* script19C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 4, 4);
  return null;
}

// Script 19D: 1 argument.
export function* script19D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectFlagBits(local0, 0x80);
  for (;;) {
    yield* game.wait(0x80, 0);
    yield* game.notice(2, 0x16, 0x18, 3, 0x800, 0x11a, 0xb4);
  }
}

// Script 19E: 1 argument.
export function* script19E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block231: {
    local0 = arg0 & 0xff;
    yield* game.addTopic(0xe);
    yield* game.setScriptVariable(0x12, 0);
    state.setWord('CIRCLE_LEADER_ALIVE', 0, 0xffff);
    local3 = 0;
    yield* game.setObjectRecordCount(local0, 0x14);
    yield* game.setObjectFlagBits(local0, 0x2000);
    yield* game.setSpriteMode(local0, 0x8001);
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      yield* game.appendToFightList(local0);
      yield* game.setObjectArmour(local0, 2);
      yield* game.setScriptVariable(0x10, 0x801);
      yield* game.startSwarmOrbit(local0);
      local1 = 0;
      for (;;) {
        yield* game.circleSwarmLeader(0);
        if (((yield* game.wait(yield* game.getScriptVariable(0x10), 1)) & 0x800) !== 0) {
          yield* game.setObjectRecordCount(local0, 0x28);
          const t1 = word(local3 + 1);
          local3 = word(local3 + 1) & 0xff;
          if (t1 !== 1) {
            if (local3 !== 2) {
              if (local3 > 3) {
                local3 = 3;
              }
            } else {
              yield* game.notice(3, 4, 0x19, 4, 0x400, 0x111, 0xf0);
              yield* game.setObjectDialog(local0, 0x41);
              yield* game.setScriptVariable(0x10, 0x803);
            }
          } else {
            yield* game.setScriptVariable(0x12, 0xffed);
          }
        }
        local1 = word(local1 + 1);
        if (local1 === 0xf0) {
          yield* game.playSoundEffect(0xffff, 0x56, 0xff, 4);
          state.setWord('CIRCLE_PHASE_SPEED', 0, 8);
        }
        if (local1 === 0x130) {
          state.setWord('CIRCLE_PHASE_SPEED', 0, 0);
          local1 = 0;
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.addKarma(0x38);
          yield* game.fightListRemove(local0);
          break block231;
        }
      }
    }
  }
  state.setWord('CIRCLE_LEADER_ALIVE', 0, 0);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 1, 4);
  yield* game.setObjectVelocity(local0, 0, 0xfffe, 0);
  local1 = 0x11;
  yield* game.setObjectDialog(local0, 0x40);
  for (;;) {
    yield* game.wait(1, 0xa);
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    yield* game.setObjectVelocity(yield* game.createObject(0x78, t4, t3, t2, 0x332), 0, 0, 0xfffc);
    local1 = word(local1 - 1);
    if (local1 === 0) {
      yield* game.clearObjectVelocity(local0);
      for (;;) {
        yield* game.wait(3, 0xa);
        const t5 = yield* game.getObjectCoarseHeight(local0);
        const t6 = yield* game.getObjectCoarseY(local0);
        const t7 = yield* game.getObjectCoarseX(local0);
        yield* game.setObjectVelocity(
          yield* game.createObject(0x78, t7, t6, t5, 0x332),
          0,
          0,
          0xfffc,
        );
        if ((yield* game.isTopicKnown(0x3f)) !== 0) {
          yield* game.setObjectVelocity(local0, 0, 0, 0xfffe);
          local1 = 7;
          for (;;) {
            yield* game.setObjectActionAndDirection(local0, 1, 4);
            yield* game.wait(1, 2);
            yield* game.setObjectActionAndDirection(local0, 1, 5);
            yield* game.wait(1, 2);
            yield* game.setObjectActionAndDirection(local0, 1, 6);
            yield* game.wait(1, 2);
            yield* game.setObjectActionAndDirection(local0, 1, 5);
            yield* game.wait(1, 2);
            local1 = word(local1 - 1);
            if (local1 === 0) {
              yield* game.clearObjectVelocity(local0);
              yield* game.wait(0x10, 0);
              yield* script(0x04b);
              yield* game.resetObjectRecordProperty(local0);
              yield* game.removeObject(local0);
              yield* game.setActorStateHolder(0xb98, 0x8b2);
              yield* game.markTopic(0x23);
              yield* game.markTopic(0x1c);
              yield* game.markTopic(4);
              return null;
            }
          }
        }
      }
    }
  }
}

// Script 19F: 1 argument.
export function* script19F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local8 = 0,
    local12 = 0,
    local14 = 0,
    local16 = 0,
    local18 = 0,
    local20 = 0,
    local22 = 0;
  function* sub5() {
    if (state.word('PLAYER_HIT_FRAMES') === 0) {
      yield* game.moveSwarmAlongPath(local0);
    }
    const t1 = word(
      0x140 -
        shiftRight(
          word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) - 0x17c),
          1,
        ),
    );
    local14 = t1;
    yield* game.setSwarmPathPhaseTarget(local14);
    yield* game.setSwarmPathSpeedTarget(
      word((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) + 0xff04),
    );
    return truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0);
  }
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(0x14, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.startPathSwarm(local0);
  yield* sub5();
  local12 = 0;
  local3 = 0;
  yield* game.setObjectRecordCount(local0, 0xfa);
  yield* game.appendToFightList(local0);
  yield* game.setObjectArmour(local0, 5);
  local16 = 0x64;
  for (;;) {
    block265: {
      if (((yield* game.getScriptVariable(0x14)) & 1) !== 0) {
        yield* game.keepObjectFlagBits(local0, 0x7fff);
        yield* game.setSwarmPathPhaseTarget(0x100);
        yield* game.setSwarmPathSpeedTarget(0x100);
        local16 = 0;
        local12 = word(local12 + 0x64);
        for (;;) {
          yield* game.moveSwarmAlongPath(local0);
          yield* game.wait(1, 1);
          if (local12 === 0) {
            yield* game.setScriptVariableBits(0x14, 2);
            for (;;) {
              if (((yield* game.getScriptVariable(0x14)) & 4) !== 0) {
                yield* game.keepScriptVariableBits(0x14, 0xfffb);
                if ((yield* game.getObjectRecordCount(local0)) > 0x28) {
                  yield* game.setObjectRecordCount(
                    local0,
                    word((yield* game.getObjectRecordCount(local0)) - 0xa),
                  );
                }
                if ((local3 & 7) === 0) {
                  yield* game.playSoundEffect(local0, 0x6a, 0xff, 0xf);
                  yield* game.setObjectActionAndDirection(local0, 1, 4);
                }
                local3 = word(local3 + 1) & 0xff;
              }
              yield* game.wait(1, 5);
              if (((yield* game.getScriptVariable(0x14)) & 1) === 0) {
                yield* game.setObjectFlagBits(local0, 0x8000);
                break block265;
              }
            }
          } else {
            local12 = word(local12 - 1);
          }
        }
      }
    }
    if ((yield* sub5()) === 0) {
      yield* game.setObjectAnimation(local0, 0);
      yield* game.turnObjectToPlayer(local0);
      if (local12 === 0) {
        if (((yield* game.randomByte()) & 0xf) !== 0) {
          if (!less(yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()), 0x190)) {
            if (!(
              (yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) > 0x1c2 ||
              local16 === 0
            )) {
              if (local16 !== 0) {
                local16 = word(local16 - 1);
              }
              const t11 = yield* game.getObjectDirection(local0);
              local2 = t11 & 0xff;
              if (t11 <= 5) {
                if (local2 !== 5) {
                  if (local2 !== 4) {
                    if (local2 !== 3) {
                      if (less(local2, 3)) {
                        const t29 = word((yield* game.randomBelow(2)) - 0xfffb);
                        const t30 = yield* game.getObjectCoarseHeight(local0);
                        const t31 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
                        const t32 = word((yield* game.getObjectCoarseX(local0)) + 0xa);
                        yield* game.setObjectVelocity(
                          yield* game.createObject(0x8d, t32, t31, t30, 0x1b0),
                          t29,
                          0xfffd,
                          0xfffa,
                        );
                      }
                    } else {
                      const t25 = word((yield* game.randomBelow(2)) - 0xfffb);
                      const t26 = yield* game.getObjectCoarseHeight(local0);
                      const t27 = word((yield* game.getObjectCoarseY(local0)) - 0x14);
                      const t28 = yield* game.getObjectCoarseX(local0);
                      yield* game.setObjectVelocity(
                        yield* game.createObject(0x8d, t28, t27, t26, 0x1b0),
                        t25,
                        0xfffa,
                        0xfffa,
                      );
                    }
                  } else {
                    const t21 = word((yield* game.randomBelow(2)) - 1);
                    const t22 = word((yield* game.getObjectCoarseHeight(local0)) - 5);
                    const t23 = word((yield* game.getObjectCoarseY(local0)) - 0x19);
                    const t24 = word((yield* game.getObjectCoarseX(local0)) - 5);
                    yield* game.setObjectVelocity(
                      yield* game.createObject(0x8d, t24, t23, t22, 0x1b0),
                      t21,
                      0xfffa,
                      0xfffa,
                    );
                  }
                } else {
                  const t16 = word((yield* game.randomBelow(4)) + 0xfffc);
                  const t17 = word((yield* game.randomBelow(4)) + 0xfffc);
                  const t18 = word((yield* game.getObjectCoarseHeight(local0)) - 5);
                  const t19 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
                  const t20 = word((yield* game.getObjectCoarseX(local0)) - 0xa);
                  yield* game.setObjectVelocity(
                    yield* game.createObject(0x8d, t20, t19, t18, 0x1b0),
                    t17,
                    t16,
                    0xfffa,
                  );
                }
              } else {
                const t12 = word((yield* game.randomBelow(2)) + 0xfffd);
                const t13 = word((yield* game.getObjectCoarseHeight(local0)) - 5);
                const t14 = word((yield* game.getObjectCoarseY(local0)) - 5);
                const t15 = word((yield* game.getObjectCoarseX(local0)) - 0x19);
                yield* game.setObjectVelocity(
                  yield* game.createObject(0x8d, t15, t14, t13, 0x1b0),
                  0xfff8,
                  t12,
                  0xfffa,
                );
              }
              yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
              local12 = 0xf;
            } else {
              block670: {
                const t2 = yield* game.findNearestVisibleMember(local0);
                local4 = t2 & 0xff;
                if (t2 !== 0xffff) {
                  yield* game.turnObjectToObject(local0, signed(local4));
                  yield* game.wait(1, 0x14);
                  local6 = word(4 + (yield* game.randomBelow(5)));
                  loop442: for (;;) {
                    const t3 = yield* game.getObjectDirection(local0);
                    local2 = t3 & 0xff;
                    if (t3 <= 5) {
                      if (local2 !== 5) {
                        if (local2 !== 4) {
                          if (local2 !== 3) {
                            local18 = 0xfff6;
                            local20 = 0xa;
                            local22 = 0;
                          } else {
                            local18 = 0;
                            local20 = 0x14;
                            local22 = 0;
                          }
                        } else {
                          local18 = 5;
                          local20 = 0x19;
                          local22 = 5;
                        }
                      } else {
                        local18 = 0xa;
                        local20 = 0xa;
                        local22 = 5;
                      }
                    } else {
                      local18 = 0x19;
                      local20 = 5;
                      local22 = 5;
                    }
                    const t4 = word((yield* game.getObjectCoarseHeight(local0)) - local22);
                    const t5 = word((yield* game.getObjectCoarseY(local0)) - local20);
                    const t6 = word((yield* game.getObjectCoarseX(local0)) - local18);
                    local5 = (yield* game.createObject(0x8d, t6, t5, t4, 0x1b0)) & 0xff;
                    yield* game.moveObjectTowardsObject(local5, signed(local4));
                    local18 = yield* game.getObjectVelocityX(local5);
                    local20 = yield* game.getObjectVelocityY(local5);
                    const t7 = yield* game.getObjectVelocityZ(local5);
                    local22 = t7;
                    const t8 = yield* game.halveArgumentSigned(local22);
                    const t9 = yield* game.halveArgumentSigned(local20);
                    const t10 = yield* game.halveArgumentSigned(local18);
                    yield* game.setObjectVelocity(local5, t10, t9, t8);
                    yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
                    local8 = 0xf;
                    for (;;) {
                      if ((yield* sub5()) !== 0) {
                        local8 = 0;
                        local6 = 1;
                        local1 = 255;
                      }
                      if (local8 === 0) {
                        local6 = word(local6 - 1);
                        if (local6 !== 0) {
                          continue loop442;
                        }
                        break block670;
                      }
                      local8 = word(local8 - 1);
                    }
                  }
                }
              }
              local12 = 0x19;
            }
          } else {
            yield* game.createObject(0x100, 0, 0, 0x40, 0x44);
            local12 = 0x12c;
          }
        } else {
          if ((yield* game.getObjectDirection(local0)) === 4) {
            yield* game.setObjectActionAndDirection(local0, 7, 4);
            yield* game.wait(8, 0);
          }
          if ((yield* game.getObjectDirection(local0)) === 6) {
            yield* game.setObjectActionAndDirection(local0, 4, 6);
            yield* game.wait(8, 5);
          }
          local12 = 5;
        }
      } else {
        local12 = word(local12 - 1);
      }
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(0x5a);
      yield* game.fightListRemove(local0);
      yield* game.setSwarmPathPhaseTarget(0x140);
      yield* game.setSwarmPathSpeedTarget(0x40);
      yield* game.setSwarmHeightPhaseTarget(0x180);
      yield* game.setSwarmHeightSpeedTarget(0x180);
      yield* game.setObjectAnimation(local0, 0);
      local6 = 0xc8;
      for (;;) {
        yield* game.moveSwarmAlongPath(local0);
        yield* game.wait(1, 1);
        if ((local6 & 7) === 0) {
          yield* game.setObjectDirection(local0, word((yield* game.randomBelow(4)) + 2));
        }
        local6 = word(local6 - 1);
        if (local6 === 0) {
          yield* game.setObjectDirection(local0, 7);
          state.setWord('COLOUR_REQUEST', 0, 1);
          yield* game.wait(1, 0x20);
          state.setWord('COLOUR_REQUEST', 0, 2);
          yield* game.wait(1, 0x28);
          yield* game.resetObjectRecordProperty(local0);
          yield* game.changeRoom(0x38);
          return null;
        }
      }
    }
  }
}
