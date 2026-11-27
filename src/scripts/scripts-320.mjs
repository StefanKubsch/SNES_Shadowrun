// Scripts 320 to 33F, decompiled from the original
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

// Script 320: 1 argument.
export function* script320(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x64);
  loop7: for (;;) {
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.wait(3, 0xf0);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(3, 0x1e0);
    continue loop7;
  }
}

// Script 321: 3 arguments.
export function* script321(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  block248: {
    const t1 = arg2;
    const t2 = arg1;
    local0 = arg0 & 0xff;
    local1 = t2;
    local3 = t1 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block248;
    }
    const t3 = yield* game.scriptAction(0x140);
    local4 = t3;
    if ((t3 & 0x100) === 0) {
      if ((local4 & 0x40) === 0) {
        break block248;
      }
      yield* script(0x240);
      const t4 = yield* game.scriptChooseNumber();
      local6 = t4;
      if (t4 === 0xffff) {
        break block248;
      }
      if ((yield* script(0x197, local6)) === 0) {
        block213: {
          local8 = 0xcadd;
          if (local6 !== 0x189c) {
            if (local6 !== 0x145f) {
              if (local6 !== 0x3b1) {
                break block213;
              }
              local8 = 0x1d;
              break block213;
            }
            local8 = 0x18;
            break block213;
          }
          local8 = 0x13;
          break block213;
        }
        if (local8 !== 0xcadd) {
          yield* game.setScriptVariable(0x1c, yield* game.getObjectNumber(local0));
          yield* game.setScriptVariable(0x1e, local8);
          yield* game.talk(local0, local8);
          break block248;
        }
        yield* script(0x1b1, local6);
        break block248;
      }
      block160: {
        if (local6 === (yield* game.getActorStateProperty(yield* game.getObjectNumber(local0)))) {
          break block160;
        }
        yield* game.setItemPropertyAndUnequip(local0, local6);
        if (local6 !== 0x8b2) {
          yield* game.notice(0xd, 0x15, 7, 3, 0x400, 0x16, 0x78);
          break block160;
        }
        yield* game.notice(0xd, 0x15, 7, 3, 0x800, 0x16, 0x78);
        break block160;
      }
      break block248;
    }
    block64: {
      if (!less(yield* game.getRunnerStrength(state.byte('MEMBER_OBJECT')), local3)) {
        yield* game.equipRunnerArmour(local0, local1);
        break block64;
      }
      yield* game.notice(2, 0x15, 0xf, 3, 0x800, 0x14, 0xf0);
      break block64;
    }
    break block248;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 322: 1 argument.
export function* script322(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block149: {
    local0 = arg0 & 0xff;
    yield* game.setObjectArmour(local0, 2);
    yield* game.setObjectRecordCount(local0, 0xd);
    if ((yield* script(0x07e, 5)) === 0) {
      yield* game.removeObject(local0);
      break block149;
    }
    loop20: for (;;) {
      yield* game.wait(1, word(0x3c + ((yield* game.randomByte()) & 0x1f)));
      if (!less(yield* game.getDistanceToPlayer(local0), 0x96)) {
        continue loop20;
      }
      block66: {
        if (((yield* game.randomByte()) & 1) === 0) {
          yield* game.setObjectActionAndDirection(local0, 0, 7);
          break block66;
        }
        yield* game.setObjectActionAndDirection(local0, 0, 3);
        break block66;
      }
      yield* game.wait(8, 0);
      yield* game.appendToFightList(local0);
      loop75: for (;;) {
        block126: {
          const t1 = yield* game.chooseEnemyTarget(local0);
          local2 = t1 & 0xff;
          if (t1 === 0xffff) {
            local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
            break block126;
          }
          const t2 = word(0x50 + ((yield* game.randomByte()) & 0x1f));
          const t3 = signed(local2);
          const t4 = local0;
          local1 = (yield* script(0x235, t4, t3, 2, 0, 5, 0, t2)) & 0xff;
          break block126;
        }
        if (signed(local1) === 0) {
          continue loop75;
        }
        yield* game.addKarma(1);
        yield* game.fightListRemove(local0);
        yield* script(0x068, local0);
        break block149;
      }
    }
  }
  return null;
}

// Script 323: 1 argument.
export function* script323(state, arg0) {
  let local0 = 0,
    local2 = 0;
  local0 = arg0;
  local2 = 0;
  loop5: for (;;) {
    yield* game.wait(1, 4);
    const t1 = word(local2 + 1);
    local2 = t1;
    if ((truth(t1 !== local0) & truth(((yield* game.getScriptVariable(0x2a)) & 1) !== 0)) !== 0) {
      continue loop5;
    }
    return null;
  }
}

// Script 324: 1 argument.
export function* script324(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x200 | local0, 0x100, 0));
  return null;
}

// Script 325: 2 arguments.
export function* script325(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  const t1 = arg1;
  local0 = arg0 & 0xff;
  local1 = t1 & 0xff;
  return null;
}

// Script 326: 1 argument.
export function* script326(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  local1 = 0xa;
  loop11: for (;;) {
    yield* game.setObjectAnimation(local0, 1);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(local0);
    const t1 = word(local1 - 1);
    local1 = t1;
    if (t1 !== 0) {
      continue loop11;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    return null;
  }
}

// Script 327: 1 argument.
export function* script327(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 0x304, 0));
  return null;
}

// Script 328: no arguments.
export function* script328(state) {
  yield* game.learnSpell(0x54);
  return null;
}

// Script 329: 2 arguments.
export function* script329(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0;
  const t1 = arg1;
  local0 = arg0 & 0xff;
  local1 = t1;
  yield* game.wait(1, 6);
  if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
    if (state.word('GROUP_LEADER_ONLY') === 0) {
      block501: {
        yield* script(0x209, local0);
        local4 = 0;
        if ((yield* game.getGroupMemberPosition(local0)) <= 0) {
          break block501;
        }
        yield* game.setObjectDialog(local0, local1);
        yield* game.keepObjectFlagBits(local0, 0xfe9f);
        yield* game.clearObjectVelocity(local0);
        local5 = 0;
        loop72: for (;;) {
          block496: {
            if ((yield* game.hasFightTarget()) === 0) {
              block487: {
                yield* game.placeObjectInFormation(local0);
                const t4 = yield* game.wait(0xe83, 1);
                local5 = t4;
                if ((t4 & 0x682) === 0) {
                  break block487;
                }
                if ((local5 & 2) === 0) {
                  if ((local5 & 0x80) === 0) {
                    if ((local5 & 0x600) === 0) {
                      break block487;
                    }
                    local5 = yield* script(0x1cd, local0, 0x1e, 0x1e);
                    break block487;
                  }
                  yield* game.statusScreen(local0);
                  local5 = yield* game.wait(0xe81, 1);
                  break block487;
                }
                yield* game.talk(local0, local1);
                break block487;
              }
              local4 = truth((local5 & 0x800) !== 0) & 0xff;
              break block496;
            }
            block403: {
              if ((yield* game.hasNoObjectAnimation(local0)) === 0) {
                local7 = (yield* game.chooseRandomFightTarget(local0)) & 0xff;
                local3 = 0;
                loop100: for (;;) {
                  block373: {
                    if ((local5 & 0x4000) === 0) {
                      if ((local5 & 0x600) === 0) {
                        if ((local5 & 0x80) === 0) {
                          block249: {
                            if ((local5 & 0x2000) === 0) {
                              break block249;
                            }
                            yield* script(0x253);
                            const t2 = yield* game.chooseUnderGlove(local0);
                            local8 = t2 & 0xff;
                            if (t2 === 0xffff) {
                              break block249;
                            }
                            local7 = signed(local8) & 0xff;
                            break block249;
                          }
                          if (signed(local7) !== 0xffff) {
                            yield* game.turnObjectToObject(local0, signed(local7));
                            yield* game.setObjectAnimation(local0, 7);
                            const t3 = yield* game.wait(0x6e88, 0);
                            local5 = t3;
                            if ((t3 & 8) === 0) {
                              yield* game.setObjectAnimation(local0, 0);
                              break block373;
                            }
                            block366: {
                              yield* game.setObjectAnimation(local0, 4);
                              local5 = yield* game.wait(0x6e81, 0x1e);
                              if (
                                ((yield* game.canAttack(local0, signed(local7))) &
                                  truth((local5 & 1) !== 0)) ===
                                0
                              ) {
                                yield* game.setObjectAnimation(local0, 0);
                                break block366;
                              }
                              yield* game.turnObjectToObject(local0, signed(local7));
                              yield* game.createObject(0x10a, local0, signed(local7), 0, 0x12a);
                              yield* game.setObjectAnimation(local0, 8);
                              local5 = yield* game.wait(0x6e81, 0x3c);
                              break block366;
                            }
                            break block373;
                          }
                          yield* game.placeObjectInFormation(local0);
                          local5 = yield* game.wait(0x6e81, 1);
                          break block373;
                        }
                        yield* game.statusScreen(local0);
                        local5 = yield* game.wait(0x6e81, 1);
                        break block373;
                      }
                      local5 = yield* script(0x1cd, local0, 0x1e, 0x1e);
                      break block373;
                    }
                    yield* game.setObjectAnimation(local0, 2);
                    yield* game.setObjectFlagBits(local0, 0x60);
                    yield* game.choosePlace(local0);
                    loop123: for (;;) {
                      block158: {
                        local5 = yield* game.wait(0x6e85, 0xf);
                        if (
                          (truth(((yield* game.getObjectFlags(local0)) & 8) !== 0) &
                            truth(local5 === 1)) ===
                          0
                        ) {
                          break block158;
                        }
                        yield* game.stopMotion(local0);
                        yield* game.clearObjectVelocity(local0);
                        local5 = 4;
                        break block158;
                      }
                      if (local5 === 1) {
                        continue loop123;
                      }
                      yield* game.keepObjectFlagBits(local0, 0xff9f);
                      break block373;
                    }
                  }
                  local4 = truth((local5 & 0x800) !== 0) & 0xff;
                  if (
                    (signed(local3) |
                      signed(local4) |
                      ((yield* game.canAttack(local0, signed(local7))) ^ 0xffff)) ===
                    0
                  ) {
                    continue loop100;
                  }
                  yield* game.stopMotion(local0);
                  yield* game.clearObjectVelocity(local0);
                  break block403;
                }
              } else {
                local4 = (yield* script(0x194, local0)) & 0xff;
                break block403;
              }
            }
            break block496;
          }
          if (signed(local4) === 0) {
            continue loop72;
          }
          break block501;
        }
      }
      block559: {
        yield* script(0x331, local0);
        if (signed(local4) === 0) {
          yield* script(0x194, local0);
          yield* game.setObjectAnimation(local0, 0);
          yield* game.turnObjectToPlayer(local0);
          yield* game.wait(1, 0x14);
          yield* game.notice(3, 3, 0x19, 4, 0x400, 0x140, 1);
          yield* game.confirmKey();
          yield* game.removeObject(local0);
          break block559;
        }
        yield* script(0x068, local0);
        break block559;
      }
      return null;
    }
    yield* game.removeObject(local0);
    return null;
  }
  yield* script(0x331, local0);
  yield* game.removeObject(local0);
  return null;
}

// Script 32A: 1 argument.
export function* script32A(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local3 = in0;
    local5 = t1;
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = word((yield* game.getObjectCoarseY(local0)) - local5);
    const t4 = word((yield* game.getObjectCoarseX(local0)) - local3);
    yield* game.createObject(0xb8, t4, t3, t2, 0x382);
    yield* game.wait(1, 2);
    return;
  }
  local0 = arg0 & 0xff;
  block189: {
    yield* game.setObjectActionAndDirection(local0, 2, 5);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      loop73: for (;;) {
        block108: {
          const t5 = yield* game.wait(0x281, 6);
          local1 = t5;
          if ((t5 & 1) !== 0) {
            break block108;
          }
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20f, 0xf0);
          break block108;
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop73;
        }
        block176: {
          if ((yield* game.getObjectNumber(local0)) !== 0x63c) {
            break block176;
          }
          yield* sub5(0xa, 0xf);
          yield* sub5(4, 0);
          yield* sub5(0x14, 0xa);
          yield* sub5(0x19, 0x14);
          yield* sub5(0x28, 0xf);
          yield* sub5(0x1e, 0x14);
          yield* sub5(0x23, 0x1e);
          break block176;
        }
        yield* script(0x36c, local0, 2, 4, 0, 0x2c, 0x2e);
        break block189;
      }
    } else {
      yield* script(0x2a3, local0, 2, 4, 0, 0x2c, 0x2e);
      break block189;
    }
  }
  loop189: for (;;) {
    yield* script(0x074, local0, 0, 6, 2, 0x2e);
    yield* script(0x2a3, local0, 2, 4, 0, 0x2c, 0x2e);
    continue loop189;
  }
}

// Script 32B: 1 argument.
export function* script32B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0) {
    local3 = in0;
    local5 = 0;
    loop10: for (;;) {
      block47: {
        yield* game.wait(1, 1);
        local3 = word(local3 - 1);
        if (!less(yield* game.getDistanceToPlayer(local0), 0xa)) {
          break block47;
        }
        local5 = 255;
        const t1 = yield* game.getPlayerObject();
        const t2 = local0;
        yield* game.shootAtObject(t2, t1, 3, 4, 3, 3);
        break block47;
      }
      if ((truth(local3 === 0) | signed(local5)) === 0) {
        continue loop10;
      }
      return signed(local5);
    }
  }
  local0 = arg0 & 0xff;
  block93: {
    yield* game.setSpriteMode(local0, 0x8001);
    yield* game.setObjectDirection(local0, 5);
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectAnimation(local0, 2);
      break block93;
    }
    yield* game.setObjectAnimation(local0, 1);
    break block93;
  }
  const t3 = yield* game.getObjectCoarseX(local0);
  local1 = t3 & 0xff;
  const t4 = shiftLeft(word((yield* game.getObjectCoarseHeight(t3)) + 0x20), 2);
  const t5 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
  const t6 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
  const t7 = local0;
  yield* game.setObjectPosition(t7, t6, t5, t4);
  const t8 = word(((yield* game.randomByte()) & 0xf) + 7);
  const t9 = word(((yield* game.randomByte()) & 7) - 4);
  const t10 = word(((yield* game.randomByte()) & 7) - 4);
  const t11 = local0;
  yield* game.setObjectVelocity(t11, t10, t9, t8);
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* sub5(0x3c);
  yield* game.removeObject(local0);
  return null;
}

// Script 32C: 1 argument.
export function* script32C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, 0x14);
  loop7: for (;;) {
    yield* game.wait(1, word(0xa + (yield* game.randomBelow(0xa))));
    if ((yield* game.getDistanceToPlayer(local0)) > 0x14) {
      continue loop7;
    }
    block206: {
      yield* game.setObjectFlagBits(local0, 0xa000);
      yield* game.clearObjectVelocity(local0);
      yield* game.setObjectAnimation(local0, 7);
      yield* game.turnObjectToPlayer(local0);
      yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
      yield* game.appendToFightList(local0);
      local1 = truth(((yield* game.wait(0x808, 0)) & 0x800) !== 0) & 0xff;
      const t1 = yield* game.chooseEnemyTarget(local0);
      local4 = t1 & 0xff;
      if ((truth(t1 === 0xffff) | signed(local1)) !== 0) {
        break block206;
      }
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.moveObjectStraightToObject(local0, signed(local4));
      local2 = 88;
      local3 = 0;
      loop107: for (;;) {
        block150: {
          if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local4)), 0xf)) {
            break block150;
          }
          if (local3 !== 0) {
            local3 = word(local3 - 1) & 0xff;
            break block150;
          }
          yield* game.shootAtObject(local0, signed(local4), 4, 4, 6, 1);
          local3 = 15;
          break block150;
        }
        local2 = word(local2 - 1) & 0xff;
        local1 = truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) & 0xff;
        if ((truth(local2 === 0) | signed(local1)) === 0) {
          continue loop107;
        }
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        if (signed(local1) !== 0) {
          break block206;
        }
        yield* game.keepObjectFlagBits(local0, 0xffdf);
        yield* game.setObjectAnimation(local0, 8);
        yield* game.wait(8, 0);
        break block206;
      }
    }
    block222: {
      yield* game.fightListRemove(local0);
      if (signed(local1) === 0) {
        break block222;
      }
      yield* script(0x276, local0);
      yield* game.addKarma(4);
      break block222;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 32D: 1 argument.
export function* script32D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 4, 0));
  return null;
}

// Script 32E: 1 argument.
export function* script32E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x04c, local0, 0x8b, 4, 0x237);
  return null;
}

// Script 32F: 1 argument.
export function* script32F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 8, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0x5fff);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 330: no arguments.
export function* script330(state) {
  yield* script(0x10e, 8);
  return null;
}

// Script 331: 1 argument.
export function* script331(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.raiseStateCount(local0, 0xff);
  yield* game.raiseMemberMagicPoints(local0, 0xff);
  yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
  yield* game.removeGroupMember(local0);
  return null;
}

// Script 332: 1 argument.
export function* script332(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 6, 0);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 333: no arguments.
export function* script333(state) {
  yield* game.changeScene(1, 0, 0x87);
  return null;
}

// Script 334: 1 argument.
export function* script334(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x800 | local0, 0x607, 0, 0x804, 0xc06));
  return null;
}

// Script 335: 1 argument.
export function* script335(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x400 | local0, 0x203, 0));
  return null;
}

// Script 336: 3 arguments.
export function* script336(state, arg0, arg1, arg2) {
  const locals = new Uint8Array(20);
  function* sub9(in0, in1) {
    block38: {
      const t1 = in1;
      setLocalWord(locals, 15, in0);
      setLocalWord(locals, 17, t1);
      if (
        ((yield* game.wait(localWord(locals, 15) | 0x800, localWord(locals, 17))) & 0x800) ===
        0
      ) {
        break block38;
      }
      locals[5] = 0xffff & 0xff;
      yield* game.fightListRemove(localByte(locals, 0));
      break block38;
    }
    return;
  }
  function* sub39(in0) {
    locals[15] = in0 & 0xff;
    setLocalWord(locals, 16, yield* game.getObjectCoarseX(localByte(locals, 15)));
    setLocalWord(locals, 18, yield* game.getObjectCoarseY(localByte(locals, 15)));
    if (
      (truth(localWord(locals, 16) > localWord(locals, 6)) &
        truth(less(localWord(locals, 16), localWord(locals, 8))) &
        truth(localWord(locals, 18) > localWord(locals, 10)) &
        truth(less(localWord(locals, 18), localWord(locals, 12)))) ===
      0
    ) {
      return 0;
    }
    return 0xffff;
  }
  const t2 = arg2;
  const t3 = arg1;
  locals[0] = arg0 & 0xff;
  setLocalWord(locals, 1, t3);
  setLocalWord(locals, 3, t2);
  setLocalWord(
    locals,
    6,
    word((yield* game.getObjectCoarseX(localByte(locals, 0))) - localWord(locals, 1)),
  );
  setLocalWord(
    locals,
    8,
    word((yield* game.getObjectCoarseX(localByte(locals, 0))) + localWord(locals, 1)),
  );
  setLocalWord(
    locals,
    10,
    word((yield* game.getObjectCoarseY(localByte(locals, 0))) - localWord(locals, 3)),
  );
  setLocalWord(
    locals,
    12,
    word((yield* game.getObjectCoarseY(localByte(locals, 0))) + localWord(locals, 3)),
  );
  yield* game.setObjectRecordCount(localByte(locals, 0), 0xf);
  yield* game.setObjectDirection(localByte(locals, 0), 4);
  locals[5] = 0 & 0xff;
  yield* game.appendToFightList(localByte(locals, 0));
  loop132: for (;;) {
    yield* game.keepObjectFlagBits(localByte(locals, 0), 0xfeff);
    yield* game.setObjectAnimation(localByte(locals, 0), 0);
    loop142: for (;;) {
      block168: {
        locals[14] = (yield* game.chooseEnemyTarget(localByte(locals, 0))) & 0xff;
        if (((yield* game.randomByte()) & 0x1f) !== 0) {
          break block168;
        }
        const t4 = shiftLeft((yield* game.randomByte()) & 3, 1);
        const t5 = localByte(locals, 0);
        yield* game.setObjectDirection(t5, t4);
        break block168;
      }
      const t6 = (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe;
      const t7 = localByte(locals, 0);
      yield* game.setObjectDirection(t7, t6);
      yield* sub9(1, 6);
      if (((yield* sub39(signed(localByte(locals, 14)))) | signed(localByte(locals, 5))) === 0) {
        continue loop142;
      }
      const t8 = (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe;
      const t9 = localByte(locals, 0);
      yield* game.setObjectActionAndDirection(t9, 1, t8);
      yield* game.moveObjectToObject(localByte(locals, 0), signed(localByte(locals, 14)));
      loop211: for (;;) {
        block276: {
          if (
            !less(
              yield* game.getDistanceBetweenObjects(
                localByte(locals, 0),
                signed(localByte(locals, 14)),
              ),
              0xc,
            )
          ) {
            yield* sub9(1, 6);
            break block276;
          }
          yield* game.shootAtObject(
            localByte(locals, 0),
            signed(localByte(locals, 14)),
            4,
            4,
            3,
            2,
          );
          const t10 = (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe;
          const t11 = localByte(locals, 0);
          yield* game.setObjectDirection(t11, t10);
          yield* game.keepObjectFlagBits(localByte(locals, 0), 0xfeff);
          yield* sub9(1, 0x5a);
          yield* game.setObjectFlagBits(localByte(locals, 0), 0x100);
          yield* game.moveObjectToPlayer(localByte(locals, 0));
          break block276;
        }
        if (
          ((yield* sub39(signed(localByte(locals, 14)))) &
            (signed(localByte(locals, 5)) ^ 0xffff)) !==
          0
        ) {
          continue loop211;
        }
        yield* game.stopMotion(localByte(locals, 0));
        yield* game.clearObjectVelocity(localByte(locals, 0));
        if (signed(localByte(locals, 5)) === 0) {
          continue loop132;
        }
        yield* game.addKarma(5);
        yield* game.fightListRemove(localByte(locals, 0));
        yield* script(0x312, localByte(locals, 0));
        yield* game.resetObjectRecordProperty(localByte(locals, 0));
        yield* game.removeObject(localByte(locals, 0));
        return null;
      }
    }
  }
}

// Script 337: 1 argument.
export function* script337(state, arg0) {
  let local0 = 0;
  block421: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      loop129: for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop129;
        }
        yield* game.setObjectActionAndDirection(local0, 0, 4);
        yield* game.wait(1, 0x64);
        yield* game.setObjectDirection(local0, 2);
        yield* game.wait(1, 0xc8);
        yield* game.setObjectDirection(local0, 4);
        yield* game.wait(1, 0xa0);
        yield* game.setObjectAnimation(local0, 1);
        yield* game.setObjectVelocity(local0, 0, 0xfffe, 0);
        yield* game.wait(1, 0x4b);
        yield* game.native81(local0, 1);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setObjectActionAndDirection(local0, 0, 2);
        yield* game.setActorStateFlagBits(0xf5, 0x80);
        yield* game.wait(1, 0x3c);
        yield* game.setObjectAnimation(local0, 1);
        yield* game.setObjectVelocity(local0, 2, 0, 0);
        yield* game.wait(1, 0x3c);
        yield* game.native1D(local0, 4);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setObjectActionAndDirection(local0, 0, 6);
        yield* game.setActorStateFlagBits(0x3a3, 0x80);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.wait(1, 0x190);
        loop294: for (;;) {
          yield* game.wait(1, 5);
          if (
            (truth(less(yield* game.getDistanceToPlayer(local0), 0x64)) &
              truth(((yield* game.getObjectRecordFlags(local0)) & 2) !== 0)) ===
            0
          ) {
            continue loop294;
          }
          yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          yield* game.notice(2, 2, 0xd, 3, 0x400, 0x39, 0x78);
          yield* game.setObjectActionAndDirection(local0, 6, 0);
          yield* game.setObjectVelocity(local0, 3, 0, 0);
          yield* game.wait(1, 0x14);
          yield* game.notice(0x10, 4, 0xa, 3, 0x400, 0x3a, 0x3c);
          yield* game.setActorStateFlagBits(0xaf, 0x80);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.native1D(local0, 6);
          yield* game.setActorStateFlagBits(0x7fc, 2);
          yield* game.wait(4, 0);
          yield* game.stopMotion(local0);
          yield* game.removeObject(local0);
          break block421;
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(local0, 3);
      yield* game.setObjectActionAndDirection(local0, 0, 2);
      if (signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) === 0) {
        loop46: for (;;) {
          yield* game.wait(1, 2);
          if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
            continue loop46;
          }
          yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
          yield* game.setObjectDirection(local0, 4);
          yield* game.wait(1, 0x1e);
          yield* game.notice(0x11, 4, 7, 3, 0x400, 0x58, 0xf0);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.native1D(local0, 6);
          yield* game.wait(4, 0);
          yield* game.stopMotion(local0);
          yield* game.removeObject(local0);
          yield* game.setActorStateFlagBits(0xaf, 0x80);
          break block421;
        }
      } else {
        loop29: for (;;) {
          yield* game.wait(2, 0);
          yield* game.talk(local0, 0x51);
          continue loop29;
        }
      }
    }
  }
  return null;
}

// Script 338: 1 argument.
export function* script338(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.setObjectDialog(local0, 7);
  yield* game.wait(2, 0);
  return null;
}

// Script 339: 1 argument.
export function* script339(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22e, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 33A: 1 argument.
export function* script33A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 0x304, 0));
  return null;
}

// Script 33B: 1 argument.
export function* script33B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.setObjectDialog(local0, 8);
  yield* game.wait(2, 0);
  return null;
}

// Script 33C: 1 argument.
export function* script33C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block12: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block12;
    }
    yield* script(0x245, local0);
    break block12;
  }
  loop12: for (;;) {
    block146: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block146;
          }
          block142: {
            yield* script(0x0f9);
            const t2 = yield* game.chooseNumber();
            local4 = t2;
            if (t2 === 0xffff) {
              break block142;
            }
            if (
              (truth(local4 === 0x1642) |
                truth(local4 === 0x1649) |
                truth(local4 === 0x1634) |
                truth(local4 === 0x163b)) ===
              0
            ) {
              yield* script(0x085, local4);
              break block142;
            }
            yield* game.setActorStateFlagBits(local4, 0x80);
            break block142;
          }
          local1 = 255;
          break block146;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block146;
      }
      yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0x82, 0xf0);
      break block146;
    }
    if (signed(local1) === 0) {
      continue loop12;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 33D: 3 arguments.
export function* script33D(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  const t1 = arg2;
  const t2 = arg1;
  local0 = arg0 & 0xff;
  local1 = t2;
  local3 = t1;
  return null;
}

// Script 33E: no arguments.
export function* script33E(state) {
  yield* game.learnSpell(0x53);
  return null;
}

// Script 33F: 1 argument.
export function* script33F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 0x304, 0));
  return null;
}
