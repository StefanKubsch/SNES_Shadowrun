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
  block61: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x160);
    yield* game.setObjectArmour(local0, 2);
    const t1 = word((yield* game.randomBelow(5)) + 0xf);
    const t2 = local0;
    yield* game.setObjectRecordCount(t2, t1);
    const t3 = word(0x5a + ((yield* game.randomByte()) & 0x1f));
    const t4 = local0;
    if ((yield* script(0x076, t4, 3, 0x22, 0, 3, 1, t3)) === 0) {
      yield* game.removeObject(local0);
      break block61;
    }
    yield* script(0x1ba, yield* script(0x068, local0));
    break block61;
  }
  return null;
}

// Script 0E1: 1 argument.
export function* script0E1(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x229, 0xf0);
    break block30;
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
  loop13: for (;;) {
    yield* script(0x074, local0, 1, 7, 3, 0x2e);
    yield* script(0x2a3, local0, 3, 5, 1, 0x2c, 0x2e);
    continue loop13;
  }
}

// Script 0E3: no arguments.
export function* script0E3(state) {
  block26: {
    if ((yield* game.question(0x16, 8)) === 0) {
      yield* game.topicText(0x11e);
      break block26;
    }
    yield* game.setActorStateFlagBits(0xcbe, 1);
    yield* game.endDialog();
    break block26;
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
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block97;
    }
    loop18: for (;;) {
      yield* game.wait(2, 0);
      yield* game.talk(local0, 0x26);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop18;
      }
      yield* game.setObjectRecordFlagBits(local0, 2);
      yield* game.notice(6, 3, 0x14, 3, 0x400, 0x194, 0xb4);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.native1D(local0, 0);
      yield* game.wait(4, 0);
      yield* game.native1D(local0, 1);
      yield* game.wait(4, 0);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.setObjectRecordFlagBits(local0, 1);
      break block97;
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 0E6: 1 argument.
export function* script0E6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      continue loop2;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    loop24: for (;;) {
      block64: {
        if (((yield* game.wait(0x81, 1)) & 0x80) === 0) {
          break block64;
        }
        yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
        yield* game.notice(0xa, 0x15, 0xc, 3, 0x800, 0x1ba, 0xf0);
        break block64;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop24;
      }
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
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
    loop46: for (;;) {
      if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
        yield* game.setObjectAnimation(local0, 6);
        yield* game.wait(8, 0);
        yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
        continue loop15;
      }
      block119: {
        if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
          yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x72, 0xf0);
          yield* script(0x04b);
          yield* game.setObjectRecordFlagBits(local0, 1);
          yield* game.addNuyen(0x14);
          break block119;
        }
        yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x8a, 0xb4);
        break block119;
      }
      continue loop46;
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
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(9, 2, 0xb, 3, 0, 0x69, 0x78);
    break block26;
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
    return;
  }
  function* sub5(in0, in1, in2, in3, in4) {
    const t1 = in4;
    const t2 = in3;
    const t3 = in2;
    const t4 = in1;
    local1 = in0 & 0xff;
    local2 = t4 & 0xff;
    local3 = t3 & 0xff;
    local4 = t2 & 0xff;
    local5 = t1 & 0xff;
    yield* game.setObjectAnimation(local0, 0);
    yield* sub18(local2);
    yield* sub18(local3);
    yield* sub18(local4);
    yield* sub18(local5);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.native1D(local0, local1);
    yield* game.wait(6, 0);
    yield* game.stopMotion(local0);
    yield* game.clearObjectVelocity(local0);
    yield* game.setObjectAnimation(local0, 0);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.placeObjectOnWaypoint(local0, 0);
  yield* game.setObjectDialog(local0, 0x61);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  loop105: for (;;) {
    yield* sub5(1, 5, 4, 5, 6);
    yield* sub5(2, 6, 6, 5, 4);
    yield* sub5(1, 3, 4, 5, 6);
    yield* sub5(0, 0, 7, 1, 2);
    continue loop105;
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
    block34: {
      yield* game.setObjectAnimation(local0, 2);
      if (local5 !== 0) {
        yield* game.stopMotion(local0);
        break block34;
      }
      yield* game.moveObjectStraightToPlayer(local0);
      break block34;
    }
    block53: {
      if (local5 !== 2) {
        local7 = 120;
        break block53;
      }
      local7 = 70;
      break block53;
    }
    loop53: for (;;) {
      block88: {
        if (
          (truth((yield* game.chooseEnemyTarget(local0)) === 0xffff) &
            (signed(local6) ^ 0xffff)) ===
          0
        ) {
          break block88;
        }
        yield* game.notice(0xc, 4, 0xc, 3, 0x400, 0x254, 0x78);
        local6 = 255;
        break block88;
      }
      block439: {
        if (local5 <= 0) {
          break block439;
        }
        block258: {
          local10 = (yield* game.getDirectionToPlayer(local0)) & 0xff;
          if ((truth(local5 === 1) | truth(local5 === 3)) === 0) {
            break block258;
          }
          if (local10 !== 0) {
            if (local10 !== 1) {
              if (local10 !== 2) {
                if (local10 !== 3) {
                  if (local10 !== 4) {
                    if (local10 !== 5) {
                      if (local10 !== 6) {
                        if (local10 !== 7) {
                          break block258;
                        }
                        local11 = 4;
                        local13 = 4;
                        break block258;
                      }
                      local11 = 0;
                      local13 = 4;
                      break block258;
                    }
                    local11 = 0xfffc;
                    local13 = 4;
                    break block258;
                  }
                  local11 = 0xfffc;
                  local13 = 0;
                  break block258;
                }
                local11 = 0xfffc;
                local13 = 0xfffc;
                break block258;
              }
              local11 = 0;
              local13 = 0xfffc;
              break block258;
            }
            local11 = 4;
            local13 = 0xfffc;
            break block258;
          }
          local11 = 4;
          local13 = 0;
          break block258;
        }
        block410: {
          if (local5 !== 2) {
            break block410;
          }
          if (local10 !== 0) {
            if (local10 !== 1) {
              if (local10 !== 2) {
                if (local10 !== 3) {
                  if (local10 !== 4) {
                    if (local10 !== 5) {
                      if (local10 !== 6) {
                        if (local10 !== 7) {
                          break block410;
                        }
                        local11 = 4;
                        local13 = 0xfffc;
                        break block410;
                      }
                      local11 = 4;
                      local13 = 0;
                      break block410;
                    }
                    local11 = 4;
                    local13 = 4;
                    break block410;
                  }
                  local11 = 0;
                  local13 = 4;
                  break block410;
                }
                local11 = 0xfffc;
                local13 = 4;
                break block410;
              }
              local11 = 0xfffc;
              local13 = 0;
              break block410;
            }
            local11 = 0xfffc;
            local13 = 0xfffc;
            break block410;
          }
          local11 = 0;
          local13 = 0xfffc;
          break block410;
        }
        block428: {
          if (local5 !== 3) {
            break block428;
          }
          local11 = word(-local11);
          local13 = word(-local13);
          break block428;
        }
        yield* game.turnObjectToPlayer(local0);
        yield* game.setObjectVelocity(local0, local11, local13, 0);
        break block439;
      }
      const t1 = yield* game.wait(0x805, 1);
      local8 = t1;
      if ((t1 & 0x800) === 0) {
        if (
          (truth(local7 === 0) |
            (truth(less(yield* game.getDistanceToPlayer(local0), 0x28)) &
              truth(less(local7, 0x28))) |
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
                  loop808: for (;;) {
                    yield* game.setObjectAnimation(local0, 5);
                    yield* game.turnObjectToPlayer(local0);
                    if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                      yield* game.playSoundEffect(local0, 0xe, 0xff, 0xff);
                      const t12 = signed(local4);
                      const t13 = local3;
                      const t14 = local2;
                      const t15 = local1;
                      const t16 = yield* game.getPlayerObjectCopy();
                      const t17 = local0;
                      yield* game.shootAtObject(t17, t16, t15, t14, t13, t12);
                      if (local8 === 3) {
                        yield* game.setObjectAnimation(local0, 6);
                        if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                          break block893;
                        }
                        return 0xffff;
                      }
                      local8 = word(local8 + 1);
                      continue loop808;
                    }
                    return 0xffff;
                  }
                } else {
                  return 0xffff;
                }
              } else {
                yield* game.setObjectAnimation(local0, 7);
                yield* game.turnObjectToPlayer(local0);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  block717: {
                    const t8 = (yield* game.randomByte()) & 3;
                    local8 = t8;
                    if (t8 !== 0) {
                      if (local8 !== 1) {
                        if (local8 !== 2) {
                          local17 = 14;
                          local15 = 0x258;
                          break block717;
                        }
                        local17 = 15;
                        local15 = 0x257;
                        break block717;
                      }
                      local17 = 17;
                      local15 = 0x256;
                      break block717;
                    }
                    local17 = 17;
                    local15 = 0x255;
                    break block717;
                  }
                  yield* game.notice(8, 6, local17, 3, 0x400, local15, 0x64);
                  yield* game.setObjectAnimation(local0, 8);
                  if (((yield* game.wait(0x801, 0x50)) & 0x800) === 0) {
                    const t9 = word((yield* game.getObjectCoarseHeight(local0)) + 0x20);
                    const t10 = yield* game.getObjectCoarseY(local0);
                    const t11 = yield* game.getObjectCoarseX(local0);
                    yield* game.createObject(0xdc, t11, t10, t9, 0x160);
                    break block893;
                  }
                  return 0xffff;
                }
                return 0xffff;
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
                if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
                  break block893;
                }
                return 0xffff;
              }
              return 0xffff;
            }
          }
          block908: {
            const t18 = word(local5 + 1);
            local5 = t18 & 0xff;
            if (t18 !== 4) {
              break block908;
            }
            local5 = 0;
            break block908;
          }
          return 0;
        }
        local7 = word(local7 - 1) & 0xff;
        continue loop53;
      }
      return 0xffff;
    }
  }
  const t19 = arg4;
  const t20 = arg3;
  const t21 = arg2;
  const t22 = arg1;
  local0 = arg0 & 0xff;
  local1 = t22 & 0xff;
  local2 = t21 & 0xff;
  local3 = t20 & 0xff;
  local4 = t19 & 0xff;
  local6 = 0;
  local5 = 0;
  loop916: for (;;) {
    if ((yield* sub13()) === 0) {
      continue loop916;
    }
    return null;
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
  loop12: for (;;) {
    yield* game.wait(1, 1);
    if ((yield* game.getScriptVariable(0x2a)) !== 1) {
      continue loop12;
    }
    yield* game.setObjectVelocity(local0, 0, 0, 0xfffb);
    yield* game.wait(1, 0xf);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 0F2: 1 argument.
export function* script0F2(state, arg0) {
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
    block130: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block130;
          }
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (t2 === 0xffff) {
            break block130;
          }
          if (local4 !== 0x14a5) {
            yield* script(0x0ff, local4);
            break block130;
          }
          yield* game.endDialog();
          yield* game.setActorStateFlagBits(local4, 0x80);
          break block130;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block130;
      }
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd, 0xf0);
      break block130;
    }
    if (signed(local1) === 0) {
      continue loop18;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 0F3: 1 argument.
export function* script0F3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  loop12: for (;;) {
    yield* game.wait(2, 0);
    yield* game.talk(local0, 0x5b);
    yield* game.setActorStateFlagBits(0xb9f, 1);
    continue loop12;
  }
}

// Script 0F4: 1 argument.
export function* script0F4(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block99: {
    local0 = arg0 & 0xff;
    const t1 = yield* game.getObjectRecordFlags(local0);
    local1 = t1 & 0xff;
    if ((t1 & 2) === 0) {
      if ((local1 & 4) === 0) {
        yield* script(0x2cd, local0, 0xbb8, 0x1ae, 0x1b2, 0x16, 0x3aa);
        break block99;
      }
      yield* script(0x2cd, local0, 0x3a98, 0x1ad, 0x1b1, 0x19, 0x192f);
      break block99;
    }
    block48: {
      if ((local1 & 1) === 0) {
        yield* game.removeObject(local0);
        break block48;
      }
      yield* script(0x2cd, local0, 0x1770, 0x1ab, 0x1b0, 0x16, 0x15c4);
      break block48;
    }
    break block99;
  }
  return null;
}

// Script 0F5: 1 argument.
export function* script0F5(state, arg0) {
  const locals = new Uint8Array(17);
  function* sub8(in0, in1) {
    const t1 = in1;
    setLocalWord(locals, 13, in0);
    setLocalWord(locals, 15, t1);
    const t2 = localWord(locals, 15);
    const t3 = localWord(locals, 13);
    const t4 = yield* game.createObject(
      0x100,
      localWord(locals, 6),
      localWord(locals, 8),
      localWord(locals, 10),
      0x1ee,
    );
    yield* game.setObjectVelocity(t4, t3, t2, 4);
    return;
  }
  function* sub35(in0) {
    locals[13] = in0 & 0xff;
    yield* game.playSoundEffect(0xffff, 0x4c, localByte(locals, 13), 3);
    yield* game.wait(1, 4);
    return;
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
    return;
  }
  locals[0] = arg0 & 0xff;
  locals[5] = 0 & 0xff;
  yield* game.setSpriteMode(localByte(locals, 0), 0x8001);
  yield* script(0x0db, localByte(locals, 0));
  yield* game.keepObjectFlagBits(localByte(locals, 0), 0xffdf);
  setLocalWord(locals, 1, 0xa);
  loop140: for (;;) {
    yield* game.wait(1, 1);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    yield* game.wait(1, 1);
    yield* game.keepObjectFlagBits(localByte(locals, 0), 0xff7f);
    const t5 = word(localWord(locals, 1) - 2);
    setLocalWord(locals, 1, t5);
    if (t5 !== 0) {
      continue loop140;
    }
    block331: {
      yield* game.setObjectFlagBits(localByte(locals, 0), 0x2020);
      yield* game.wait(1, 0x1b);
      const t6 = yield* game.findNearestVisibleMember(localByte(locals, 0));
      locals[12] = t6 & 0xff;
      if (t6 === 0xffff) {
        break block331;
      }
      if (
        !less(
          yield* game.getDistanceBetweenObjects(
            localByte(locals, 0),
            signed(localByte(locals, 12)),
          ),
          0xa,
        )
      ) {
        break block331;
      }
      yield* game.haltObject(signed(localByte(locals, 12)));
      yield* game.playSoundEffect(localByte(locals, 0), 0x36, 0xff, 0xff);
      yield* game.wait(1, 1);
      const t7 = shiftLeft(yield* game.getObjectCoarseHeight(signed(localByte(locals, 12))), 2);
      const t8 = shiftLeft(yield* game.getObjectCoarseY(signed(localByte(locals, 12))), 2);
      const t9 = shiftLeft(yield* game.getObjectCoarseX(signed(localByte(locals, 12))), 2);
      const t10 = localByte(locals, 0);
      yield* game.setObjectPosition(t10, t9, t8, t7);
      yield* game.appendToFightList(localByte(locals, 0));
      setLocalWord(locals, 1, 5);
      loop261: for (;;) {
        yield* game.shootAtObject(localByte(locals, 0), signed(localByte(locals, 12)), 0, 0, 6, 6);
        setLocalWord(locals, 3, 0x14);
        loop276: for (;;) {
          block299: {
            yield* game.haltObject(signed(localByte(locals, 12)));
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              break block299;
            }
            locals[5] = 0xffff & 0xff;
            break block299;
          }
          const t11 = word(localWord(locals, 3) - 1);
          setLocalWord(locals, 3, t11);
          if (t11 !== 0) {
            continue loop276;
          }
          const t12 = word(localWord(locals, 1) - 1);
          setLocalWord(locals, 1, t12);
          if ((truth(t12 === 0) | signed(localByte(locals, 5))) === 0) {
            continue loop261;
          }
          yield* game.resumeObject(signed(localByte(locals, 12)));
          yield* game.fightListRemove(localByte(locals, 0));
          break block331;
        }
      }
    }
    yield* sub5();
    return null;
  }
}

// Script 0F6: 1 argument.
export function* script0F6(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectDialog(local0, 0x56);
      break block30;
    }
    yield* game.setObjectDialog(local0, 0x55);
    break block30;
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
    if (!less(yield* game.getDistanceToPlayer(local0), 0x1c)) {
      break block57;
    }
    yield* game.setObjectAnimation(local0, 1);
    loop21: for (;;) {
      yield* game.wait(1, 5);
      if (less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
        continue loop21;
      }
      yield* game.setObjectAnimation(local0, 7);
      yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
      yield* game.wait(8, 0);
      break block57;
    }
  }
  loop57: for (;;) {
    yield* game.setObjectAnimation(local0, 3);
    yield* game.setObjectFlagBits(local0, 0x100);
    loop68: for (;;) {
      yield* game.wait(1, 5);
      if ((yield* game.getDistanceToPlayer(local0)) > 0x1e) {
        continue loop68;
      }
      yield* game.keepObjectFlagBits(local0, 0xfeff);
      yield* game.setObjectAnimation(local0, 5);
      yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 1);
      loop115: for (;;) {
        yield* game.wait(1, 5);
        if (less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
          continue loop115;
        }
        yield* game.setObjectAnimation(local0, 7);
        yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
        yield* game.wait(8, 0);
        continue loop57;
      }
    }
  }
}

// Script 0F8: no arguments.
export function* script0F8(state) {
  block42: {
    if (
      ((truth(state.byte('JAKE_DERMAL_ARMOUR') === 0) &
        truth(((yield* game.getActorStateFlags(0x15c4)) & 1) !== 0)) |
        truth(state.byte('JAKE_SKILLSOFT') === 0) |
        (signed(state.byte('JAKE_WIRED_REFLEXES')) ^ 0xffff)) ===
      0
    ) {
      yield* game.topicText(0x199);
      break block42;
    }
    yield* game.topicText(0x19a);
    break block42;
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
    const t1 = arg1;
    local0 = arg0 & 0xff;
    local1 = t1 & 0xff;
    yield* game.setSpriteMode(local0, 0);
    if (
      (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
      (yield* game.getObjectCoarseHeight(local0))
    ) {
      loop31: for (;;) {
        yield* game.wait(1, 4);
        if (
          (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
          (yield* game.getObjectCoarseHeight(local0))
        ) {
          continue loop31;
        }
        yield* game.setObjectAnimation(local0, 2);
        yield* game.native81(local0, local1);
        if (((yield* game.wait(0x805, 0x118)) & 0x800) === 0) {
          yield* script(0x360, local0);
          break block87;
        }
        yield* script(0x068, local0);
        break block87;
      }
    } else {
      yield* game.placeObjectOnWaypoint(local0, local1);
      yield* script(0x360, local0);
      break block87;
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
  loop2: for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x113);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(local0);
    continue loop2;
  }
}

// Script 0FE: 1 argument.
export function* script0FE(state, arg0) {
  let local0 = 0;
  block146: {
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
        break block146;
      }
      yield* game.setActorStateHolder(0x159a, 0x1538);
      yield* game.setActorStateHolder(0x1593, 0x1538);
      yield* game.setActorStateHolder(0x158c, 0x1538);
      yield* game.setActorStateHolder(0x1585, 0x1538);
      yield* script(0x0d1, 0x157e);
      break block146;
    }
    yield* game.notice(5, 2, 0x15, 3, 0, 0x211, 1);
    yield* game.confirmKey();
    break block146;
  }
  return null;
}

// Script 0FF: 1 argument.
export function* script0FF(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  block53: {
    local0 = arg0;
    if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
      local2 = 0x1b9;
      local4 = 14;
      break block53;
    }
    block37: {
      if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
        local2 = 9;
        break block37;
      }
      local2 = 8;
      break block37;
    }
    local4 = 18;
    break block53;
  }
  yield* game.notice(2, 0x15, local4, 3, 0x800, local2, 0x78);
  return null;
}
