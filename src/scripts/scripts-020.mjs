// Scripts 020 to 03F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, multiply, script, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 020: no arguments.
export function* script020(state) {
  const t1 = yield* script(0x03f, 0x2710, 0x2328, 0x1f40);
  const t2 = yield* script(0x0b2, 0x152, 0x153, 0x154);
  yield* script(0x162, 0x1b6d, t2, t1, 0x151, 0x150);
  return null;
}

// Script 021: 1 argument.
export function* script021(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    yield* game.wait(1, 0xa);
    if (
      (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
      (yield* game.getObjectCoarseHeight(local0))
    ) {
      yield* game.removeObject(local0);
      break block30;
    }
    yield* script(0x360, local0);
    break block30;
  }
  return null;
}

// Script 022: 1 argument.
export function* script022(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local3 = 0;
  block225: {
    local0 = arg0;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (!less(state.byte(0x1d70), 4)) {
      break block225;
    }
    if ((yield* game.isInFightList(state.byte('AIM_TARGET_OBJECT'))) === 0) {
      break block225;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block225;
    }
    state.setByte(0x1d70, 0, word(state.byte(0x1d70) + 1));
    const t1 = state.byte('AIM_TARGET_OBJECT');
    local2 = t1 & 0xff;
    yield* game.haltObject(t1);
    yield* game.wait(1, 1);
    const t2 = yield* game.getObjectCoarseHeight(local2);
    const t3 = word((yield* game.getObjectCoarseY(local2)) - 4);
    const t4 = word((yield* game.getObjectCoarseX(local2)) - 4);
    const t5 = yield* game.createObject(0xc3, t4, t3, t2, 0xa1);
    local3 = t5 & 0xff;
    yield* script(0x0db, t5);
    yield* game.playSoundEffect(local3, 0x36, 0xff, 0xff);
    yield* game.wait(1, 1);
    yield* game.updateObjectDepthMode(local3);
    local0 = word(multiply(local0, 0x12c) - 0x78);
    loop114: for (;;) {
      yield* game.haltObject(local2);
      yield* game.wait(1, 1);
      const t6 = word(local0 - 1);
      local0 = t6;
      if (t6 > 0) {
        continue loop114;
      }
      local0 = 0x78;
      loop139: for (;;) {
        yield* game.haltObject(local2);
        yield* game.wait(1, 1);
        const t7 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
        const t8 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) - 0x10);
        const t9 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) - 0x10);
        const t10 = local3;
        yield* game.setObjectPosition(t10, t9, t8, t7);
        yield* game.haltObject(local2);
        yield* game.wait(1, 1);
        yield* game.setObjectPosition(local3, 0, 0, 0);
        const t11 = word(local0 - 2);
        local0 = t11;
        if (t11 > 0) {
          continue loop139;
        }
        yield* game.resumeObject(local2);
        yield* game.removeObject(local3);
        state.setByte(0x1d70, 0, word(state.byte(0x1d70) - 1));
        break block225;
      }
    }
  }
  return null;
}

// Script 023: 1 argument.
export function* script023(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x301, 0x23c, 0x403, 0x903));
  return null;
}

// Script 024: 1 argument.
export function* script024(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x1e);
  yield* script(0x0fb, local0, 3);
  return null;
}

// Script 025: 1 argument.
export function* script025(state, arg0) {
  let local0 = 0;
  block66: {
    local0 = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) !== 0) {
      break block66;
    }
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    yield* game.keepActorStateFlagBits(0x1696, 0xfffe);
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    yield* game.setObjectDialog(local0, 0x33);
    loop34: for (;;) {
      yield* game.wait(3, 6);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        continue loop34;
      }
      yield* game.raiseStoryStage(5);
      yield* game.setObjectRecordFlags(local0, 0);
      yield* game.changeScene(2, 0, 0xf3);
      break block66;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 026: 1 argument.
export function* script026(state, arg0) {
  let local0 = 0;
  block222: {
    local0 = arg0 & 0xff;
    yield* game.releaseGlove();
    if ((yield* game.getScriptVariable(0x2c)) !== 1) {
      if ((yield* game.getScriptVariable(0x2c)) !== 2) {
        if ((yield* game.getScriptVariable(0x2c)) !== 3) {
          if ((yield* game.getScriptVariable(0x2c)) !== 4) {
            if ((yield* game.getScriptVariable(0x2c)) !== 5) {
              if ((yield* game.getScriptVariable(0x2c)) !== 6) {
                if ((yield* game.getScriptVariable(0x2c)) !== 7) {
                  if ((yield* game.getScriptVariable(0x2c)) !== 8) {
                    if ((yield* game.getScriptVariable(0x2c)) !== 9) {
                      if ((yield* game.getScriptVariable(0x2c)) !== 0xa) {
                        if ((yield* game.getScriptVariable(0x2c)) !== 0xb) {
                          if ((yield* game.getScriptVariable(0x2c)) !== 0xc) {
                            if ((yield* game.getScriptVariable(0x2c)) !== 0xd) {
                              break block222;
                            }
                            yield* script(0x1d1, local0);
                            break block222;
                          }
                          yield* script(0x097, local0);
                          break block222;
                        }
                        yield* script(0x183, local0);
                        break block222;
                      }
                      yield* script(0x2ed, local0);
                      break block222;
                    }
                    yield* script(0x1e5, local0);
                    break block222;
                  }
                  yield* script(0x1c9, local0);
                  break block222;
                }
                yield* script(0x02f, local0);
                break block222;
              }
              yield* script(0x374, local0);
              break block222;
            }
            yield* script(0x28b, local0);
            break block222;
          }
          yield* script(0x270, local0);
          break block222;
        }
        yield* script(0x0bb, local0);
        break block222;
      }
      yield* script(0x366, local0);
      break block222;
    }
    yield* script(0x137, local0);
    break block222;
  }
  return null;
}

// Script 027: 1 argument.
export function* script027(state, arg0) {
  let local0 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0x3c);
  yield* game.notice(2, 2, 0x16, 3, 0x400, 0x1e3, 0xb4);
  yield* game.setObjectArmour(local0, 2);
  yield* game.setObjectRecordCount(local0, 0x1e);
  yield* game.appendToFightList(local0);
  loop45: for (;;) {
    block84: {
      yield* game.setObjectAnimation(local0, 4);
      const t1 = yield* game.chooseEnemyTarget(local0);
      local2 = t1 & 0xff;
      if (t1 === 0xffff) {
        break block84;
      }
      yield* game.shootAtObject(local0, signed(local2), 4, 1, 5, 1);
      yield* game.playSoundEffect(local0, 0x42, 0xff, 0xff);
      break block84;
    }
    if (((yield* game.wait(0x801, 0x28)) & 0x800) === 0) {
      continue loop45;
    }
    block162: {
      yield* game.addKarma(0x12);
      yield* game.fightListRemove(local0);
      yield* game.talk(local0, 0x36);
      yield* game.setScriptVariable(0x28, word((yield* game.getScriptVariable(0x28)) + 1));
      yield* game.setActorStateFlagBits(0x769, 0x80);
      if (((yield* game.getActorStateFlags(0xd2e)) & 0x80) === 0) {
        break block162;
      }
      yield* game.notice(4, 4, 0x17, 3, 0, 0x1f3, 0xb4);
      yield* game.addNuyen(0x7d0);
      yield* script(0x04b);
      break block162;
    }
    yield* script(0x35d, local0);
    return null;
  }
}

// Script 028: 1 argument.
export function* script028(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, local0, 0x204, 0, 0x403, 0x903));
  return null;
}

// Script 029: 1 argument.
export function* script029(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0fb, local0, 4);
  return null;
}

// Script 02A: 1 argument.
export function* script02A(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22c, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 02B: 2 arguments.
export function* script02B(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0;
  function* sub10(in0) {
    local7 = in0;
    loop12: for (;;) {
      const t1 = word((yield* game.randomBelow(3)) - 1);
      const t2 = word((yield* game.randomBelow(3)) - 1);
      const t3 = yield* game.getPlayerObjectCopy();
      yield* game.setObjectVelocity(t3, t2, t1, 0);
      yield* game.wait(1, 1);
      if ((state.word('PAD_HELD') & 0xf0f0) === 0) {
        if (local7 === 0) {
          return 0;
        }
        local7 = word(local7 - 1);
        continue loop12;
      }
      return 0xffff;
    }
  }
  function* sub64(in0, in1, in2) {
    block156: {
      const t4 = in2;
      const t5 = in1;
      local7 = in0;
      local9 = t5;
      local11 = t4 & 0xff;
      if (signed(local1) === 0) {
        const t9 = word((yield* game.getObjectCoarseHeight(local0)) + 0x40);
        const t10 = word(local9 + (yield* game.getObjectCoarseY(local0)));
        const t11 = word(local7 + (yield* game.getObjectCoarseX(local0)));
        local2 = (yield* game.createObject(0x110, t11, t10, t9, 0x7d)) & 0xff;
        yield* game.setObjectVelocity(local2, 0x20, 0x20, 0);
        break block156;
      }
      const t6 = word((yield* game.getObjectCoarseHeight(local0)) + 0x40);
      const t7 = word(word(local9 + (yield* game.getObjectCoarseY(local0))) + 0x130);
      const t8 = word(word(local7 + (yield* game.getObjectCoarseX(local0))) + 0x130);
      local2 = (yield* game.createObject(0x110, t8, t7, t6, 0x7d)) & 0xff;
      yield* game.setObjectVelocity(local2, 0xffe0, 0xffe0, 0);
      break block156;
    }
    block225: {
      yield* game.setObjectActionAndDirection(local2, 0, local11 & 0x7f);
      if ((local11 & 0x80) === 0) {
        yield* game.setSpriteMode(local2, 1);
        const t12 = shiftLeft(word((yield* game.getObjectCoarseHeight(local2)) - 0x40), 2);
        const t13 = shiftLeft(word((yield* game.getObjectCoarseY(local2)) + 0x80), 2);
        const t14 = shiftLeft(word((yield* game.getObjectCoarseX(local2)) + 0x40), 2);
        const t15 = local2;
        yield* game.setObjectPosition(t15, t14, t13, t12);
        break block225;
      }
      yield* game.setSpriteMode(local2, 0x8001);
      break block225;
    }
    return;
  }
  function* sub7() {
    local3 = 0;
    loop229: for (;;) {
      if ((yield* sub10(0x1e)) === 0) {
        yield* sub64(0x40, 0, 0);
        yield* sub64(0, 0, 0x81);
        yield* sub64(0, 0x40, 0x80);
        if ((yield* sub10(0x1e)) === 0) {
          block320: {
            if ((yield* game.randomBelow(2)) === 0) {
              if ((yield* game.randomBelow(2)) === 0) {
                yield* sub64(0x3c, 0, 2);
                break block320;
              }
              yield* sub64(4, 0, 2);
              break block320;
            }
            yield* sub64(word((yield* game.randomBelow(0x1e)) + 0xa), 0, 3);
            break block320;
          }
          block349: {
            if (local3 !== 0) {
              local3 = word(local3 - 1);
              break block349;
            }
            yield* game.playSoundEffect(0xffff, 0x2a, 0xff, 3);
            local3 = 2;
            break block349;
          }
          if (local5 === 0) {
            return;
          }
          local5 = word(local5 - 1);
          continue loop229;
        }
        return;
      }
      return;
    }
  }
  const t16 = arg1;
  local0 = arg0 & 0xff;
  local1 = t16 & 0xff;
  block482: {
    yield* game.releaseGlove();
    yield* script(0x35c);
    const t17 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
    const t18 = shiftLeft(word((yield* game.getObjectCoarseY(local0)) - 0x20), 2);
    const t19 = shiftLeft(word((yield* game.getObjectCoarseX(local0)) - 0x20), 2);
    const t20 = local0;
    yield* game.setObjectPosition(t20, t19, t18, t17);
    local5 = 4;
    if ((yield* game.getScriptVariable(0x30)) === 0xffff) {
      break block482;
    }
    yield* game.notice(2, 2, 9, 3, 0, 0x11f, 0x270f);
    yield* game.notice(0xb, 0x13, 0xa, 3, 0x400, yield* game.getScriptVariable(0x30), 0x270f);
    if ((yield* game.getScriptVariable(0x30)) !== 0x123) {
      break block482;
    }
    yield* game.notice(9, 0x16, 0xe, 3, 0x400, 0x124, 0x270f);
    state.setWord('COLOUR_REQUEST', 0, 4);
    break block482;
  }
  yield* sub7();
  yield* game.playSoundEffect(0xffff, 0x2a, 0, 1);
  yield* game.playSoundEffect(0xffff, 0x2a, 0, 2);
  yield* game.changeRoom(yield* game.getScriptVariable(0x2e));
  return null;
}

// Script 02C: 1 argument.
export function* script02C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectArmour(local0, 2);
  const t1 = word(0x46 + ((yield* game.randomByte()) & 0x1f));
  const t2 = local0;
  yield* script(0x399, t2, 3, 5, t1);
  return null;
}

// Script 02D: 1 argument.
export function* script02D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x203, 0, 0x403, 0x903));
  return null;
}

// Script 02E: 1 argument.
export function* script02E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local6 = 0,
    local8 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local6 = in0;
    local8 = t1;
    yield* game.setObjectVelocity(local0, local6, local8, 0);
    yield* game.wait(1, 4);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xffdf);
  local1 = 2;
  local3 = yield* game.randomBelow(2);
  loop52: for (;;) {
    block116: {
      if (local3 === 2) {
        break block116;
      }
      block102: {
        if (local3 === 1) {
          break block102;
        }
        yield* sub5(4, 0x10);
        yield* sub5(4, 8);
        yield* sub5(4, 0x10);
        yield* sub5(0, 0x10);
        yield* sub5(0xfffc, 0x10);
        break block102;
      }
      yield* sub5(0xfffc, 8);
      yield* sub5(0xfffc, 8);
      break block116;
    }
    yield* sub5(0xfffc, 0x10);
    yield* sub5(0, 0x10);
    yield* sub5(4, 0x10);
    yield* sub5(4, 8);
    yield* sub5(4, 8);
    local1 = word(local1 - 1);
    local3 = 0;
    if (local1 !== 0) {
      continue loop52;
    }
    yield* game.setScriptVariableBits(0x14, 4);
    local5 = (yield* game.createObject(0xb8, 0x64, 0x64, 0x40, 0x382)) & 0xff;
    const t2 = word(2 + (yield* game.randomBelow(5)));
    const t3 = local5;
    yield* game.placeObjectOnWaypoint(t3, t2);
    yield* game.setSpriteMode(local5, 0x8001);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 02F: 1 argument.
export function* script02F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 1);
  yield* script(0x3a4, local0, 0);
  yield* script(0x045, local0, 6);
  yield* script(0x08b, 0xb3);
  return null;
}

// Script 030: 1 argument.
export function* script030(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x50, 0x68, 0);
  return null;
}

// Script 031: 1 argument.
export function* script031(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 032: 1 argument.
export function* script032(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x304, 0, 0x403, 0x903));
  return null;
}

// Script 033: 1 argument.
export function* script033(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x302, 0, 0x403, 0x903));
  return null;
}

// Script 034: 1 argument.
export function* script034(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block39: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x60);
    local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
    yield* game.setObjectAnimation(local0, 7);
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectDirection(local0, 5);
      break block39;
    }
    yield* game.setObjectDirection(local0, 1);
    break block39;
  }
  block150: {
    yield* game.wait(1, 0x3c);
    const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local1), 2);
    const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
    const t4 = local0;
    yield* game.setObjectPosition(t4, t3, t2, t1);
    yield* game.addObjectHeight(local0, 0x20);
    yield* game.playSoundEffect(local0, 4, 0xff, 3);
    const t5 = yield* game.chooseEnemyTarget(local0);
    local2 = t5 & 0xff;
    if (t5 !== 0xffff) {
      block143: {
        yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local2)));
        if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local2)), 0x14)) {
          break block143;
        }
        yield* game.shootAtObject(local0, signed(local2), 3, 5, 3, 3);
        break block143;
      }
      yield* game.wait(1, 5);
      break block150;
    }
    const t6 = yield* game.getPlayerObject();
    const t7 = local0;
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(t7, t6));
    break block150;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 035: 1 argument.
export function* script035(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x402, 0, 0x403, 0x903));
  return null;
}

// Script 036: 1 argument.
export function* script036(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x400 | local0, 0x203, 0, 0x403, 0x903));
  return null;
}

// Script 037: 1 argument.
export function* script037(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local3 = 0;
  block238: {
    local0 = arg0;
    yield* game.endDialog();
    if (!less(state.byte(0x1d70), 4)) {
      break block238;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block238;
    }
    const t1 = yield* game.spellGloveTarget();
    local2 = t1 & 0xff;
    if ((truth(t1 === 0xffff) | ((yield* game.isInFightList(signed(local2))) ^ 0xffff)) === 0) {
      state.setByte(0x1d70, 0, word(state.byte(0x1d70) + 1));
      yield* game.haltObject(signed(local2));
      yield* game.wait(1, 1);
      const t2 = yield* game.getObjectCoarseHeight(signed(local2));
      const t3 = word((yield* game.getObjectCoarseY(signed(local2))) - 4);
      const t4 = word((yield* game.getObjectCoarseX(signed(local2))) - 4);
      const t5 = yield* game.createObject(0xc3, t4, t3, t2, 0xa1);
      local3 = t5 & 0xff;
      yield* script(0x0db, t5);
      yield* game.playSoundEffect(local3, 0x36, 0xff, 0xff);
      yield* game.wait(1, 1);
      yield* game.updateObjectDepthMode(local3);
      local0 = word(multiply(local0, 0x12c) - 0x78);
      loop127: for (;;) {
        yield* game.haltObject(signed(local2));
        yield* game.wait(1, 1);
        const t6 = word(local0 - 1);
        local0 = t6;
        if (t6 > 0) {
          continue loop127;
        }
        local0 = 0x78;
        loop152: for (;;) {
          yield* game.haltObject(signed(local2));
          yield* game.wait(1, 1);
          const t7 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
          const t8 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 0x10);
          const t9 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 0x10);
          const t10 = local3;
          yield* game.setObjectPosition(t10, t9, t8, t7);
          yield* game.haltObject(signed(local2));
          yield* game.wait(1, 1);
          yield* game.setObjectPosition(local3, 0, 0, 0);
          const t11 = word(local0 - 2);
          local0 = t11;
          if (t11 > 0) {
            continue loop152;
          }
          yield* game.resumeObject(signed(local2));
          yield* game.removeObject(local3);
          state.setByte(0x1d70, 0, word(state.byte(0x1d70) - 1));
          break block238;
        }
      }
    } else {
      yield* game.addMagicPoints(word(4 + local0));
      break block238;
    }
  }
  return null;
}

// Script 038: 1 argument.
export function* script038(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x2d);
    yield* game.wait(1, 0xa);
    yield* game.appendToFightList(local0);
    yield* game.setObjectArmour(local0, 1);
    yield* script(0x1c7, 0x600 | local0, 6, 0, 0x305, 0x250);
    yield* game.addKarma(0x1f);
    yield* game.fightListRemove(local0);
    yield* script(0x35d, local0);
    yield* game.setActorStateHolder(0x23e, 0x1538);
    yield* game.setActorStateFlagBits(0x1b66, 0x20);
    yield* game.wait(1, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 039: 1 argument.
export function* script039(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x200 | local0, 0x503, 0, 0x403, 0x903));
  return null;
}

// Script 03A: 1 argument.
export function* script03A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x165, local0, 1);
  return null;
}

// Script 03B: 1 argument.
export function* script03B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.setObjectDialog(local0, 0x58);
  yield* script(0x0ae, local0);
  yield* game.wait(1, 0x14);
  yield* script(0x36d, local0, 0x3c, 0xdc, 0x1e);
  yield* script(0x35d, local0);
  return null;
}

// Script 03C: 1 argument.
export function* script03C(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x245, local0);
  local1 = 0;
  loop9: for (;;) {
    block83: {
      if (((yield* game.wait(0x90, 0)) & 0x80) === 0) {
        if ((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) <= 0x1d0) {
          yield* game.addActorStateCount(0x395, 1);
          yield* game.setActorStateHolder(0x395, 0x8b2);
          yield* game.resetObjectRecordProperty(local0);
          yield* script(0x04b);
          local1 = 255;
          break block83;
        }
        yield* script(0x26d);
        break block83;
      }
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x8d, 0xf0);
      break block83;
    }
    if (signed(local1) === 0) {
      continue loop9;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 03D: 1 argument.
export function* script03D(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0;
    loop7: for (;;) {
      block26: {
        if (((yield* game.wait(0x803, 6)) & 0x800) === 0) {
          break block26;
        }
        local1 = 255;
        break block26;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        if (
          !less(
            word((yield* game.getObjectCoarseY(local0)) + local2),
            yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()),
          )
        ) {
          if (signed(local1) === 0) {
            continue loop7;
          }
          return 0;
        }
        return 0;
      }
      return 0xffff;
    }
  }
  local0 = arg0 & 0xff;
  if ((yield* game.isTopicKnown(0x1c)) === 0) {
    block160: {
      yield* game.setObjectRecordCount(local0, 0);
      yield* game.setObjectFlagBits(local0, 0x40);
      yield* game.setObjectActionAndDirection(local0, 0, 6);
      yield* game.setObjectArmour(local0, 3);
      local1 = 0;
      yield* game.setObjectDialog(local0, 0x1e);
      if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) {
        break block160;
      }
      if (((yield* sub5(0x14)) | signed(local1)) !== 0) {
        break block160;
      }
      yield* game.notice(4, 2, 0x19, 3, 0x400, 0x1c0, 0x64);
      if ((yield* sub5(0x32)) !== 0) {
        break block160;
      }
      yield* game.setActorStateFlags(0xdc1, 0x40);
      break block160;
    }
    block172: {
      if (signed(local1) === 0) {
        break block172;
      }
      yield* game.setActorStateFlags(0xdc1, 0x40);
      break block172;
    }
    block250: {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        block242: {
          if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) === 0) {
            break block242;
          }
          yield* game.setObjectRecordCount(local0, 0x3c);
          yield* game.appendToFightList(local0);
          loop214: for (;;) {
            yield* game.setObjectAnimation(local0, 0);
            yield* game.wait(1, 0x14);
            const t1 = yield* script(0x221, local0);
            local1 = t1 & 0xff;
            if (t1 === 0) {
              continue loop214;
            }
            yield* game.addKarma(0xa);
            yield* game.fightListRemove(local0);
            break block242;
          }
        }
        yield* script(0x1bc, yield* script(0x35d, local0));
        break block250;
      }
      yield* game.keepObjectFlagBits(local0, 0xdfff);
      yield* game.clearObjectTask(local0);
      break block250;
    }
    return null;
  }
  yield* game.resetObjectRecordProperty(local0);
  yield* game.removeObject(local0);
  return null;
}

// Script 03E: 1 argument.
export function* script03E(state, arg0) {
  let local0 = 0,
    local2 = 0;
  block114: {
    local0 = arg0 & 0xff;
    yield* game.setSpriteMode(local0, 0);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* game.setObjectAnimation(local0, 5);
    yield* game.wait(1, 1);
    yield* game.addObjectHeight(local0, 0x20);
    const t1 = yield* game.chooseEnemyTarget(local0);
    local2 = t1 & 0xff;
    if (t1 === 0xffff) {
      break block114;
    }
    block107: {
      yield* game.playSoundEffect(local0, 4, 0xff, 3);
      yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local2)));
      if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local2)), 0xf)) {
        yield* game.wait(1, 6);
        yield* game.createObject(0xd7, local0, signed(local2), 0, 0x16);
        break block107;
      }
      yield* game.shootAtObject(local0, signed(local2), 3, 4, 3, 3);
      yield* game.setObjectDirection(local0, 0);
      break block107;
    }
    yield* game.wait(1, 5);
    break block114;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 03F: 3 arguments, returns a word.
export function* script03F(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  const t1 = arg2;
  const t2 = arg1;
  local0 = arg0;
  local2 = t2;
  local4 = t1;
  if (!less(state.byte(0x3c06), 3)) {
    if ((truth(state.byte(0x3c06) > 2) & truth(less(state.byte(0x3c06), 5))) === 0) {
      return local4;
    }
    return local2;
  }
  return local0;
}
