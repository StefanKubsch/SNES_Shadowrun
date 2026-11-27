// Scripts 0E0 to 0FF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  localByte,
  localWord,
  script,
  setLocalWord,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 0E0: 1 argument.
export function* script0E0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x160);
  yield* game.setObjectArmour(local0, 2);
  yield* game.setObjectRecordCount(local0, word((yield* game.randomBelow(5)) + 0xf));
  if (
    (yield* script(
      0x076,
      local0,
      3,
      0x22,
      0,
      3,
      1,
      word(0x5a + ((yield* game.randomByte()) & 0x1f)),
    )) === 0
  ) {
    yield* game.removeObject(local0);
  } else {
    yield* script(0x1ba, yield* script(0x068, local0));
  }
  return null;
}

// Script 0E1: 1 argument.
export function* script0E1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x229, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 0E2: 1 argument.
export function* script0E2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  for (;;) {
    yield* script(0x074, local0, 1, 7, 3, 0x2e);
    yield* script(0x2a3, local0, 3, 5, 1, 0x2c, 0x2e);
  }
}

// Script 0E3: no arguments.
export function* script0E3(state) {
  if ((yield* game.question(0x16, 8)) === 0) {
    yield* game.topicText(0x11e);
  } else {
    yield* game.setActorStateFlagBits(0xcbe, 1);
    yield* game.endDialog();
  }
  return null;
}

// Script 0E4: 1 argument.
export function* script0E4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x23d, local0);
  return null;
}

// Script 0E5: 1 argument.
export function* script0E5(state, arg0) {
  let local0 = 0;
  block97: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      for (;;) {
        yield* game.wait(2, 0);
        yield* game.talk(local0, 0x26);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(local0, 2);
          yield* game.notice(6, 3, 0x14, 3, 0x400, 0x194, 0xb4);
          yield* game.setObjectAnimation(local0, 1);
          yield* game.moveObjectToWaypoint(local0, 0);
          yield* game.wait(4, 0);
          yield* game.moveObjectToWaypoint(local0, 1);
          yield* game.wait(4, 0);
          yield* game.setObjectAnimation(local0, 0);
          yield* game.setObjectRecordFlagBits(local0, 1);
          break block97;
        }
      }
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 0E6: 1 argument.
export function* script0E6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      for (;;) {
        if (((yield* game.wait(0x81, 1)) & 0x80) !== 0) {
          yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
          yield* game.notice(0xa, 0x15, 0xc, 3, 0x800, 0x1ba, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.resetObjectRecordProperty(local0);
          yield* game.removeObject(local0);
          return null;
        }
      }
    }
  }
}

// Script 0E7: 1 argument.
export function* script0E7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x25d, local0, 0x1dd, 0x18);
  return null;
}

// Script 0E8: 1 argument.
export function* script0E8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  loop15: for (;;) {
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 0);
    yield* game.setObjectAnimation(local0, 0);
    for (;;) {
      if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
        yield* game.setObjectAnimation(local0, 6);
        yield* game.wait(8, 0);
        yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
        continue loop15;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x72, 0xf0);
        yield* script(0x04b);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.addNuyen(0x14);
      } else {
        yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x8a, 0xb4);
      }
    }
  }
}

// Script 0E9: 1 argument.
export function* script0E9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x23d, local0);
  return null;
}

// Script 0EA: 1 argument.
export function* script0EA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2d5, local0, 4);
  return null;
}

// Script 0EB: 1 argument.
export function* script0EB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f8, local0, 0xd2, 0);
  return null;
}

// Script 0EC: 1 argument.
export function* script0EC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x13e, local0);
  return null;
}

// Script 0ED: 1 argument.
export function* script0ED(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(local0), 0x64)) {
    yield* game.notice(9, 2, 0xb, 3, 0, 0x69, 0x78);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 0EE: 1 argument.
export function* script0EE(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0;
  function* sub18(in0) {
    local6 = in0 & 0xff;
    yield* game.setObjectDirection(local0, local6);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x3f) + 0x14));
  }
  function* sub5(in0, in1, in2, in3, in4) {
    local1 = in0 & 0xff;
    local2 = in1 & 0xff;
    local3 = in2 & 0xff;
    local4 = in3 & 0xff;
    local5 = in4 & 0xff;
    yield* game.setObjectAnimation(local0, 0);
    yield* sub18(local2);
    yield* sub18(local3);
    yield* sub18(local4);
    yield* sub18(local5);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.moveObjectToWaypoint(local0, local1);
    yield* game.wait(6, 0);
    yield* game.stopMotion(local0);
    yield* game.clearObjectVelocity(local0);
    yield* game.setObjectAnimation(local0, 0);
  }
  local0 = arg0 & 0xff;
  yield* game.placeObjectOnWaypoint(local0, 0);
  yield* game.setObjectDialog(local0, 0x61);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  for (;;) {
    yield* sub5(1, 5, 4, 5, 6);
    yield* sub5(2, 6, 6, 5, 4);
    yield* sub5(1, 3, 4, 5, 6);
    yield* sub5(0, 0, 7, 1, 2);
  }
}

// Script 0EF: 5 arguments.
export function* script0EF(state, arg0, arg1, arg2, arg3, arg4) {
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
    local11 = 0,
    local13 = 0,
    local15 = 0,
    local17 = 0;
  function* sub13() {
    yield* game.setObjectAnimation(local0, 2);
    if (local5 !== 0) {
      yield* game.stopMotion(local0);
    } else {
      yield* game.moveObjectStraightToPlayer(local0);
    }
    if (local5 !== 2) {
      local7 = 120;
    } else {
      local7 = 70;
    }
    for (;;) {
      if (
        (truth((yield* game.chooseEnemyTarget(local0)) === 0xffff) & (signed(local6) ^ 0xffff)) !==
        0
      ) {
        yield* game.notice(0xc, 4, 0xc, 3, 0x400, 0x254, 0x78);
        local6 = 255;
      }
      if (local5 > 0) {
        local10 = (yield* game.getDirectionToPlayer(local0)) & 0xff;
        if (local5 === 1 || local5 === 3) {
          if (local10 !== 0) {
            if (local10 !== 1) {
              if (local10 !== 2) {
                if (local10 !== 3) {
                  if (local10 !== 4) {
                    if (local10 !== 5) {
                      if (local10 !== 6) {
                        if (local10 === 7) {
                          local11 = 4;
                          local13 = 4;
                        }
                      } else {
                        local11 = 0;
                        local13 = 4;
                      }
                    } else {
                      local11 = 0xfffc;
                      local13 = 4;
                    }
                  } else {
                    local11 = 0xfffc;
                    local13 = 0;
                  }
                } else {
                  local11 = 0xfffc;
                  local13 = 0xfffc;
                }
              } else {
                local11 = 0;
                local13 = 0xfffc;
              }
            } else {
              local11 = 4;
              local13 = 0xfffc;
            }
          } else {
            local11 = 4;
            local13 = 0;
          }
        }
        if (local5 === 2) {
          if (local10 !== 0) {
            if (local10 !== 1) {
              if (local10 !== 2) {
                if (local10 !== 3) {
                  if (local10 !== 4) {
                    if (local10 !== 5) {
                      if (local10 !== 6) {
                        if (local10 === 7) {
                          local11 = 4;
                          local13 = 0xfffc;
                        }
                      } else {
                        local11 = 4;
                        local13 = 0;
                      }
                    } else {
                      local11 = 4;
                      local13 = 4;
                    }
                  } else {
                    local11 = 0;
                    local13 = 4;
                  }
                } else {
                  local11 = 0xfffc;
                  local13 = 4;
                }
              } else {
                local11 = 0xfffc;
                local13 = 0;
              }
            } else {
              local11 = 0xfffc;
              local13 = 0xfffc;
            }
          } else {
            local11 = 0;
            local13 = 0xfffc;
          }
        }
        if (local5 === 3) {
          local11 = word(-local11);
          local13 = word(-local13);
        }
        yield* game.turnObjectToPlayer(local0);
        yield* game.setObjectVelocity(local0, local11, local13, 0);
      }
      const t1 = yield* game.wait(0x805, 1);
      local8 = t1;
      if ((local8 & 0x800) === 0) {
        if (
          (truth(local7 === 0) |
            truth(less(yield* game.getDistanceToPlayer(local0), 0x28) && less(local7, 0x28)) |
            (truth(
              ((yield* game.getObjectVelocityX(local0)) |
                (yield* game.getObjectVelocityY(local0))) !==
                0,
            ) ^
              0xffff) |
            truth((local8 & 4) !== 0)) !==
          0
        ) {
          block893: {
            yield* game.stopMotion(local0);
            yield* game.clearObjectVelocity(local0);
            if (
              (truth(less(yield* game.randomBelow(0xff), 0xaa)) &
                truth(less(yield* game.getScriptVariable(0x2a), 3))) ===
              0
            ) {
              if (
                (truth((yield* game.getDistanceToPlayer(local0)) > 0x32) |
                  truth(((yield* game.randomByte()) & 1) !== 0)) ===
                0
              ) {
                yield* game.setObjectAnimation(local0, 4);
                yield* game.turnObjectToPlayer(local0);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  local8 = 0;
                  for (;;) {
                    yield* game.setObjectAnimation(local0, 5);
                    yield* game.turnObjectToPlayer(local0);
                    if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                      yield* game.playSoundEffect(local0, 0xe, 0xff, 0xff);
                      yield* game.shootAtObject(
                        local0,
                        yield* game.getPlayerObjectCopy(),
                        local1,
                        local2,
                        local3,
                        signed(local4),
                      );
                      if (local8 === 3) {
                        yield* game.setObjectAnimation(local0, 6);
                        if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                          break block893;
                        }
                        return 0xffff;
                      }
                      local8 = word(local8 + 1);
                    } else {
                      return 0xffff;
                    }
                  }
                } else {
                  return 0xffff;
                }
              } else {
                yield* game.setObjectAnimation(local0, 7);
                yield* game.turnObjectToPlayer(local0);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  const t8 = (yield* game.randomByte()) & 3;
                  local8 = t8;
                  if (local8 !== 0) {
                    if (local8 !== 1) {
                      if (local8 !== 2) {
                        local17 = 14;
                        local15 = 0x258;
                      } else {
                        local17 = 15;
                        local15 = 0x257;
                      }
                    } else {
                      local17 = 17;
                      local15 = 0x256;
                    }
                  } else {
                    local17 = 17;
                    local15 = 0x255;
                  }
                  yield* game.notice(8, 6, local17, 3, 0x400, local15, 0x64);
                  yield* game.setObjectAnimation(local0, 8);
                  if (((yield* game.wait(0x801, 0x50)) & 0x800) === 0) {
                    const t9 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
                    const t10 = yield* game.getObjectCoarseY(local0);
                    const t11 = yield* game.getObjectCoarseX(local0);
                    yield* game.createObject(0xdc, t11, t10, t9, 0x160);
                  } else {
                    return 0xffff;
                  }
                } else {
                  return 0xffff;
                }
              }
            } else {
              const t2 = yield* game.getObjectCoarseHeight(local0);
              const t3 = yield* game.getObjectCoarseY(local0);
              const t4 = yield* game.getObjectCoarseX(local0);
              yield* game.createObject(0x56, t4, t3, t2, 0x149);
              if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
                const t5 = yield* game.getObjectCoarseHeight(local0);
                const t6 = yield* game.getObjectCoarseY(local0);
                const t7 = yield* game.getObjectCoarseX(local0);
                yield* game.createObject(0x9d, t7, t6, t5, 0x15b);
                if (((yield* game.wait(0x801, 1)) & 0x800) !== 0) {
                  return 0xffff;
                }
              } else {
                return 0xffff;
              }
            }
          }
          const t12 = word(local5 + 1);
          local5 = word(local5 + 1) & 0xff;
          if (t12 === 4) {
            local5 = 0;
          }
          return 0;
        }
        local7 = word(local7 - 1) & 0xff;
      } else {
        return 0xffff;
      }
    }
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local6 = 0;
  local5 = 0;
  for (;;) {
    if ((yield* sub13()) !== 0) {
      return null;
    }
  }
}

// Script 0F0: 1 argument.
export function* script0F0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 0F1: 1 argument.
export function* script0F1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.setSpriteMode(local0, 1);
  for (;;) {
    yield* game.wait(1, 1);
    if ((yield* game.getScriptVariable(0x2a)) === 1) {
      yield* game.setObjectVelocity(local0, 0, 0, 0xfffb);
      yield* game.wait(1, 0xf);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 0F2: 1 argument.
export function* script0F2(state, arg0) {
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
            if (local4 !== 0x14a5) {
              yield* script(0x0ff, local4);
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
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 0F3: 1 argument.
export function* script0F3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.talk(local0, 0x5b);
    yield* game.setActorStateFlagBits(0xb9f, 1);
  }
}

// Script 0F4: 1 argument.
export function* script0F4(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectRecordFlags(local0);
  local1 = t1 & 0xff;
  if ((t1 & 2) === 0) {
    if ((local1 & 4) === 0) {
      yield* script(0x2cd, local0, 0xbb8, 0x1ae, 0x1b2, 0x16, 0x3aa);
    } else {
      yield* script(0x2cd, local0, 0x3a98, 0x1ad, 0x1b1, 0x19, 0x192f);
    }
  } else {
    if ((local1 & 1) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* script(0x2cd, local0, 0x1770, 0x1ab, 0x1b0, 0x16, 0x15c4);
    }
  }
  return null;
}

// Script 0F5: 1 argument.
export function* script0F5(state, arg0) {
  const locals = new Uint8Array(17);
  function* sub8(in0, in1) {
    setLocalWord(locals, 13, in0);
    setLocalWord(locals, 15, in1);
    yield* game.setObjectVelocity(
      yield* game.createObject(
        0x100,
        localWord(locals, 6),
        localWord(locals, 8),
        localWord(locals, 10),
        0x1ee,
      ),
      localWord(locals, 13),
      localWord(locals, 15),
      4,
    );
  }
  function* sub35(in0) {
    locals[13] = in0 & 0xff;
    yield* game.playSoundEffect(0xffff, 0x4c, localByte(locals, 13), 3);
    yield* game.wait(1, 4);
  }
  function* sub5() {
    setLocalWord(locals, 6, yield* game.getObjectCoarseX(localByte(locals, 0)));
    setLocalWord(locals, 8, yield* game.getObjectCoarseY(localByte(locals, 0)));
    setLocalWord(locals, 10, yield* game.getObjectCoarseHeight(localByte(locals, 0)));
    yield* game.removeObject(localByte(locals, 0));
    yield* sub8(2, 0);
    yield* sub8(0, 2);
    yield* sub8(0xfffe, 0);
    yield* sub8(0, 0xfffe);
    yield* sub35(0xff);
    yield* sub35(0xc0);
    yield* sub35(0x80);
    yield* sub35(0x40);
  }
  locals[0] = arg0 & 0xff;
  locals[5] = 0 & 0xff;
  yield* game.setSpriteMode(localByte(locals, 0), 0x8001);
  yield* script(0x0db, localByte(locals, 0));
  yield* game.keepObjectFlagBits(localByte(locals, 0), 0xffdf);
  setLocalWord(locals, 1, 0xa);
  for (;;) {
    yield* game.wait(1, 1);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    yield* game.wait(1, 1);
    yield* game.keepObjectFlagBits(localByte(locals, 0), 0xff7f);
    setLocalWord(locals, 1, word(localWord(locals, 1) - 2));
    if (localWord(locals, 1) === 0) {
      block331: {
        yield* game.setObjectFlagBits(localByte(locals, 0), 0x2020);
        yield* game.wait(1, 0x1b);
        const t1 = yield* game.findNearestVisibleMember(localByte(locals, 0));
        locals[12] = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (
            less(
              yield* game.getDistanceBetweenObjects(
                localByte(locals, 0),
                signed(localByte(locals, 12)),
              ),
              0xa,
            )
          ) {
            yield* game.haltObject(signed(localByte(locals, 12)));
            yield* game.playSoundEffect(localByte(locals, 0), 0x36, 0xff, 0xff);
            yield* game.wait(1, 1);
            const t2 = shiftLeft(
              yield* game.getObjectCoarseHeight(signed(localByte(locals, 12))),
              2,
            );
            const t3 = shiftLeft(yield* game.getObjectCoarseY(signed(localByte(locals, 12))), 2);
            const t4 = shiftLeft(yield* game.getObjectCoarseX(signed(localByte(locals, 12))), 2);
            yield* game.setObjectPosition(localByte(locals, 0), t4, t3, t2);
            yield* game.appendToFightList(localByte(locals, 0));
            setLocalWord(locals, 1, 5);
            loop261: for (;;) {
              yield* game.shootAtObject(
                localByte(locals, 0),
                signed(localByte(locals, 12)),
                0,
                0,
                6,
                6,
              );
              setLocalWord(locals, 3, 0x14);
              for (;;) {
                yield* game.haltObject(signed(localByte(locals, 12)));
                if (((yield* game.wait(0x801, 1)) & 0x800) !== 0) {
                  locals[5] = 0xffff & 0xff;
                }
                setLocalWord(locals, 3, word(localWord(locals, 3) - 1));
                if (localWord(locals, 3) === 0) {
                  setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
                  if ((truth(localWord(locals, 1) === 0) | signed(localByte(locals, 5))) === 0) {
                    continue loop261;
                  }
                  yield* game.resumeObject(signed(localByte(locals, 12)));
                  yield* game.fightListRemove(localByte(locals, 0));
                  break block331;
                }
              }
            }
          }
        }
      }
      yield* sub5();
      return null;
    }
  }
}

// Script 0F6: 1 argument.
export function* script0F6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectDialog(local0, 0x56);
  } else {
    yield* game.setObjectDialog(local0, 0x55);
  }
  yield* script(0x36d, local0, 0x1e, 0xf0, 0x3c);
  yield* script(0x35d, local0);
  return null;
}

// Script 0F7: 1 argument.
export function* script0F7(state, arg0) {
  let local0 = 0;
  block57: {
    local0 = arg0 & 0xff;
    yield* game.setObjectDirection(local0, 5);
    if (less(yield* game.getDistanceToPlayer(local0), 0x1c)) {
      yield* game.setObjectAnimation(local0, 1);
      for (;;) {
        yield* game.wait(1, 5);
        if (!less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
          yield* game.setObjectAnimation(local0, 7);
          yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
          yield* game.wait(8, 0);
          break block57;
        }
      }
    }
  }
  loop57: for (;;) {
    yield* game.setObjectAnimation(local0, 3);
    yield* game.setObjectFlagBits(local0, 0x100);
    for (;;) {
      yield* game.wait(1, 5);
      if ((yield* game.getDistanceToPlayer(local0)) <= 0x1e) {
        yield* game.keepObjectFlagBits(local0, 0xfeff);
        yield* game.setObjectAnimation(local0, 5);
        yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
        yield* game.wait(8, 0);
        yield* game.setObjectAnimation(local0, 1);
        for (;;) {
          yield* game.wait(1, 5);
          if (!less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
            yield* game.setObjectAnimation(local0, 7);
            yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
            yield* game.wait(8, 0);
            continue loop57;
          }
        }
      }
    }
  }
}

// Script 0F8: no arguments.
export function* script0F8(state) {
  if (
    ((truth(state.byte('JAKE_DERMAL_ARMOUR') === 0) &
      truth(((yield* game.getActorStateFlags(0x15c4)) & 1) !== 0)) |
      truth(state.byte('JAKE_SKILLSOFT') === 0) |
      (signed(state.byte('JAKE_WIRED_REFLEXES')) ^ 0xffff)) ===
    0
  ) {
    yield* game.topicText(0x199);
  } else {
    yield* game.topicText(0x19a);
  }
  return null;
}

// Script 0F9: no arguments.
export function* script0F9(state) {
  yield* game.endDialog();
  yield* game.wait(1, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(1, 1);
  yield* game.notice(2, 0x17, 7, 3, 0, 0xf, 1);
  return null;
}

// Script 0FA: 1 argument.
export function* script0FA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.wait(1, 1);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 0FB: 2 arguments.
export function* script0FB(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  block87: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    yield* game.setSpriteMode(local0, 0);
    if (
      (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
      (yield* game.getObjectCoarseHeight(local0))
    ) {
      for (;;) {
        yield* game.wait(1, 4);
        if (
          (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) ===
          (yield* game.getObjectCoarseHeight(local0))
        ) {
          yield* game.setObjectAnimation(local0, 2);
          yield* game.moveObjectStraightToWaypoint(local0, local1);
          if (((yield* game.wait(0x805, 0x118)) & 0x800) === 0) {
            yield* script(0x360, local0);
            break block87;
          }
          yield* script(0x068, local0);
          break block87;
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(local0, local1);
      yield* script(0x360, local0);
    }
  }
  return null;
}

// Script 0FC: 1 argument.
export function* script0FC(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  yield* game.wait(1, 1);
  yield* game.notice(8, 2, 0x10, 3, 0, 0x214, 0xb4);
  yield* game.setActorStateFlagBits(local0, 1);
  return null;
}

// Script 0FD: 1 argument.
export function* script0FD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x113);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(local0);
  }
}

// Script 0FE: 1 argument.
export function* script0FE(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if (
    ((yield* game.isActorStateProperty(0x8b2, local0)) |
      (yield* game.isActorStateProperty(0x8b2, 0x157e))) ===
    0
  ) {
    yield* game.setActorStateHolder(local0, 0x8b2);
    if (
      ((yield* game.isActorStateProperty(0x8b2, 0x159a)) &
        (yield* game.isActorStateProperty(0x8b2, 0x1593)) &
        (yield* game.isActorStateProperty(0x8b2, 0x158c)) &
        (yield* game.isActorStateProperty(0x8b2, 0x1585))) ===
      0
    ) {
      yield* game.notice(6, 2, 0x10, 3, 0, 0x210, 1);
      yield* game.confirmKey();
    } else {
      yield* game.setActorStateHolder(0x159a, 0x1538);
      yield* game.setActorStateHolder(0x1593, 0x1538);
      yield* game.setActorStateHolder(0x158c, 0x1538);
      yield* game.setActorStateHolder(0x1585, 0x1538);
      yield* script(0x0d1, 0x157e);
    }
  } else {
    yield* game.notice(5, 2, 0x15, 3, 0, 0x211, 1);
    yield* game.confirmKey();
  }
  return null;
}

// Script 0FF: 1 argument.
export function* script0FF(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0;
  if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
    local2 = 0x1b9;
    local4 = 14;
  } else {
    if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
      local2 = 9;
    } else {
      local2 = 8;
    }
    local4 = 18;
  }
  yield* game.notice(2, 0x15, local4, 3, 0x800, local2, 0x78);
  return null;
}
