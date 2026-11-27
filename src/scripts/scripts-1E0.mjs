// Scripts 1E0 to 1FF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  lessOrEqualSignedLeft,
  localByte,
  localWord,
  multiply,
  multiplySignedLeft,
  notEqualOrNegativeLeft,
  script,
  setLocalWord,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 1E0: 1 argument.
export function* script1E0(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block121: {
    local0 = arg0 & 0xff;
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if (t1 !== 0x80) {
      if (local1 !== 0x100) {
        break block121;
      }
      yield* game.endDialog();
      yield* game.wait(1, 0x14);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      yield* game.wait(1, 5);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(1, 0xa);
      state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
      if ((yield* game.getCurrentRoomHeader()) !== (yield* game.getRoomHeader(0x13d))) {
        break block121;
      }
      yield* game.setActorStateFlagBits(0x188, 0x80);
      break block121;
    }
    yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x1bb, 0xf0);
    break block121;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1E1: no arguments.
export function* script1E1(state) {
  yield* game.setActorStateFlagBits(0xcc5, 1);
  return null;
}

// Script 1E2: 1 argument.
export function* script1E2(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0;
  block435: {
    local0 = arg0;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (!less(state.byte(0x1d6f), 4)) {
      break block435;
    }
    if (
      (truth(((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3) |
        truth(state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT'))) ===
      0
    ) {
      break block435;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block435;
    }
    state.setByte(0x1d6f, 0, word(state.byte(0x1d6f) + 1));
    local2 = state.byte('AIM_TARGET_OBJECT') & 0xff;
    const t1 = yield* game.getObjectCoarseHeight(local2);
    const t2 = word((yield* game.getObjectCoarseY(local2)) - 6);
    const t3 = word((yield* game.getObjectCoarseX(local2)) - 6);
    const t4 = yield* game.createObject(0xc5, t3, t2, t1, 0xa1);
    local3 = t4 & 0xff;
    yield* game.bindObjectToCurrentTask(t4);
    yield* script(0x0db, local3);
    local0 = multiplySignedLeft(local0, 0x12c);
    yield* game.addObjectArmour(local2, 0x1e);
    loop107: for (;;) {
      yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
      yield* game.setObjectDirection(local3, 3);
      loop122: for (;;) {
        const t5 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
        const t6 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) - 6);
        const t7 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) - 6);
        const t8 = local3;
        yield* game.setObjectPosition(t8, t7, t6, t5);
        local0 = word(local0 - 1);
        if (((yield* game.wait(9, 1)) & 8) === 0) {
          continue loop122;
        }
        yield* game.setObjectDirection(local3, 7);
        loop177: for (;;) {
          const t9 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
          const t10 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) + 6);
          const t11 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) + 6);
          const t12 = local3;
          yield* game.setObjectPosition(t12, t11, t10, t9);
          local0 = word(local0 - 1);
          if (((yield* game.wait(9, 1)) & 8) === 0) {
            continue loop177;
          }
          if (!lessOrEqualSignedLeft(local0, 0x78)) {
            continue loop107;
          }
          loop234: for (;;) {
            yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
            yield* game.setObjectDirection(local3, 3);
            loop249: for (;;) {
              block315: {
                const t13 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
                const t14 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) - 4);
                const t15 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) - 4);
                const t16 = local3;
                yield* game.setObjectPosition(t16, t15, t14, t13);
                const t17 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                local4 = t17 & 0xff;
                if (t17 !== 0) {
                  break block315;
                }
                yield* game.setObjectPosition(local3, 0, 0, 0);
                local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                break block315;
              }
              local0 = word(local0 - 2);
              if (signed(local4) === 0) {
                continue loop249;
              }
              yield* game.setObjectDirection(local3, 7);
              loop333: for (;;) {
                block399: {
                  const t18 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
                  const t19 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) + 6);
                  const t20 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) + 6);
                  const t21 = local3;
                  yield* game.setObjectPosition(t21, t20, t19, t18);
                  const t22 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                  local4 = t22 & 0xff;
                  if (t22 !== 0) {
                    break block399;
                  }
                  yield* game.setObjectPosition(local3, 0, 0, 0);
                  local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                  break block399;
                }
                local0 = word(local0 - 2);
                if (signed(local4) === 0) {
                  continue loop333;
                }
                if (!lessOrEqualSignedLeft(local0, 0)) {
                  continue loop234;
                }
                yield* game.subtractObjectArmour(local2, 0x1e);
                yield* game.removeObject(local3);
                state.setByte(0x1d6f, 0, word(state.byte(0x1d6f) - 1));
                break block435;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

// Script 1E3: no arguments.
export function* script1E3(state) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0;
  block386: {
    local0 = yield* game.getScriptVariable(0x1c);
    local2 = yield* game.getScriptVariable(0x1e);
    local6 = 0xcadd;
    if (local0 !== 0xb21) {
      if (local0 !== 0x1952) {
        if (local0 !== 0x17c3) {
          if (local0 !== 0x150) {
            if (local0 !== 0x850) {
              if (local0 !== 0x261) {
                if (local0 !== 0x12f3) {
                  if (local0 !== 0x13b) {
                    if (local0 !== 0x157) {
                      if (local0 !== 0x276) {
                        if (local0 !== 0x1a4) {
                          if (local0 !== 0xbf3) {
                            if (local0 !== 0x18a3) {
                              if (local0 !== 0x1696) {
                                if (local0 !== 0x770) {
                                  if (local0 !== 0x129f) {
                                    if (local0 !== 0x1b5f) {
                                      break block386;
                                    }
                                    local4 = 0x13c;
                                    local6 = 0x4e20;
                                    break block386;
                                  }
                                  local4 = 0x13b;
                                  local6 = 0x3a98;
                                  break block386;
                                }
                                local4 = 0x138;
                                local6 = 0x2328;
                                break block386;
                              }
                              local4 = 0x136;
                              local6 = 0x1770;
                              break block386;
                            }
                            local4 = 0x134;
                            local6 = 0xbb8;
                            break block386;
                          }
                          local4 = 0x139;
                          local6 = 0x2af8;
                          break block386;
                        }
                        local4 = 0x13a;
                        local6 = 0x36b0;
                        break block386;
                      }
                      local4 = 0x136;
                      local6 = 0x1770;
                      break block386;
                    }
                    local4 = 0x131;
                    local6 = 0x514;
                    break block386;
                  }
                  local4 = 0x135;
                  local6 = 0xfa0;
                  break block386;
                }
                local4 = 0x130;
                local6 = 0x3e8;
                break block386;
              }
              local4 = 0x137;
              local6 = 0x1d4c;
              break block386;
            }
            local4 = 0x133;
            local6 = 0x9c4;
            break block386;
          }
          local4 = 0x132;
          local6 = 0x7d0;
          break block386;
        }
        local4 = 0x12f;
        local6 = 0xc8;
        break block386;
      }
      local4 = 0x12f;
      local6 = 0xc8;
      break block386;
    }
    local4 = 0x130;
    local6 = 0x3e8;
    break block386;
  }
  block610: {
    if (local6 !== 0xcadd) {
      block448: {
        if (local2 !== 0x13) {
          if (local2 !== 0x18) {
            if (local2 !== 0x1d) {
              break block448;
            }
            yield* game.topicText(0x260);
            break block448;
          }
          yield* game.topicText(0x261);
          break block448;
        }
        yield* game.topicText(0x262);
        break block448;
      }
      block497: {
        yield* game.windowText(local4);
        if (local2 !== 0x13) {
          if (local2 !== 0x18) {
            if (local2 !== 0x1d) {
              break block497;
            }
            yield* game.windowText(0x128);
            break block497;
          }
          yield* game.windowText(0x127);
          break block497;
        }
        yield* game.windowText(0x126);
        break block497;
      }
      if ((yield* game.question(0x14, 8)) === 0) {
        if (local2 !== 0x13) {
          if (local2 !== 0x18) {
            if (local2 !== 0x1d) {
              break block610;
            }
            yield* game.topicText(0x12e);
            break block610;
          }
          yield* game.topicText(0x12d);
          break block610;
        }
        yield* game.topicText(0x12c);
        break block610;
      }
      block551: {
        if (local2 !== 0x13) {
          if (local2 !== 0x18) {
            if (local2 !== 0x1d) {
              break block551;
            }
            yield* game.topicText(0x12b);
            break block551;
          }
          yield* game.topicText(0x12a);
          break block551;
        }
        yield* game.topicText(0x129);
        break block551;
      }
      yield* game.setActorItemPropertyAndUnequip(local0, 0xbad);
      yield* game.addNuyen(local6);
      break block610;
    }
    yield* game.topicText(0x125);
    break block610;
  }
  return null;
}

// Script 1E4: 1 argument.
export function* script1E4(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0) {
    local5 = in0;
    return truth(((yield* game.getObjectRecordFlags(local0)) & local5) !== 0);
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectAnimation(local0, 0);
  yield* game.turnObjectToPlayer(local0);
  yield* game.wait(1, 2);
  loop29: for (;;) {
    block47: {
      if ((yield* sub5(1)) === 0) {
        break block47;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      yield* game.talk(local0, 2);
      break block47;
    }
    block65: {
      if ((yield* sub5(2)) === 0) {
        break block65;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
      yield* game.talk(local0, 3);
      break block65;
    }
    block83: {
      if ((yield* sub5(0x20)) === 0) {
        break block83;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xffdf);
      yield* game.talk(local0, 4);
      break block83;
    }
    if (((yield* sub5(0x80)) & (yield* sub5(0x40))) === 0) {
      block142: {
        if ((yield* sub5(0x80)) === 0) {
          break block142;
        }
        yield* game.wait(2, 0);
        yield* game.talk(local0, 5);
        break block142;
      }
      block340: {
        if ((truth(less(yield* game.getScriptVariable(4), 0xa)) & (yield* sub5(4))) === 0) {
          break block340;
        }
        block324: {
          yield* game.keepObjectRecordFlagBits(local0, 0xfffb);
          const t1 = yield* game.getScriptVariable(4);
          local3 = t1;
          if (t1 !== 0) {
            if (local3 !== 1) {
              if (local3 !== 2) {
                if (local3 !== 3) {
                  if (local3 !== 4) {
                    if (local3 !== 5) {
                      if (local3 !== 6) {
                        if (local3 !== 7) {
                          if (local3 !== 8) {
                            if (local3 !== 9) {
                              break block324;
                            }
                            local1 = 0xa95;
                            break block324;
                          }
                          local1 = 0x1f1;
                          break block324;
                        }
                        local1 = 0x1283;
                        break block324;
                      }
                      local1 = 0x137f;
                      break block324;
                    }
                    local1 = 0x620;
                    break block324;
                  }
                  local1 = 0xae2;
                  break block324;
                }
                local1 = 0xa5d;
                break block324;
              }
              local1 = 0xd43;
              break block324;
            }
            local1 = 0xce8;
            break block324;
          }
          local1 = 0x1267;
          break block324;
        }
        yield* game.setActorStateFlagBits(local1, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(1, 1);
        break block340;
      }
      block370: {
        if ((yield* sub5(8)) === 0) {
          break block370;
        }
        yield* game.keepObjectRecordFlagBits(local0, 0xfff7);
        yield* game.setActorStateFlagBits(0x245, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(1, 1);
        break block370;
      }
      block389: {
        if ((yield* sub5(0x80)) !== 0) {
          break block389;
        }
        yield* game.wait(2, 0);
        yield* game.talk(local0, 1);
        break block389;
      }
      continue loop29;
    }
    loop97: for (;;) {
      yield* game.wait(2, 0);
      yield* game.notice(2, 4, 0x19, 3, 0x400, 0xc7, 0x78);
      continue loop97;
    }
  }
}

// Script 1E5: 1 argument.
export function* script1E5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x045, local0, 4);
  yield* script(0x3a4, local0, 0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x28);
  yield* game.notice(3, 2, 0x19, 4, 0x400, 0xf9, 0x78);
  yield* script(0x045, local0, 8);
  yield* script(0x08b, 0xb1);
  return null;
}

// Script 1E6: 1 argument.
export function* script1E6(state, arg0) {
  let local0 = 0;
  block42: {
    local0 = arg0 & 0xff;
    if ((yield* game.question(0x18, 5)) === 0) {
      yield* game.topicText(0xac);
      break block42;
    }
    block35: {
      if ((yield* game.payNuyen(0x1f4)) === 0) {
        yield* game.topicText(0xad);
        break block35;
      }
      yield* game.setActorStateFlagBits(0x317, 0x80);
      yield* game.endDialog();
      break block35;
    }
    break block42;
  }
  return null;
}

// Script 1E7: 1 argument.
export function* script1E7(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22f, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1E8: 1 argument.
export function* script1E8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.blast(local0, 0xf);
  yield* game.playSoundEffect(local0, 0xa, 0xff, 3);
  yield* game.setSpriteMode(local0, 1);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 1E9: 1 argument.
export function* script1E9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 6);
  if (state.word('GROUP_LEADER_ONLY') === 0) {
    local4 = 0;
    yield* game.setObjectRecordFlagBits(local0, 0x80);
    yield* game.keepObjectFlagBits(local0, 0xfe9f);
    yield* game.clearObjectVelocity(local0);
    local5 = 0;
    loop40: for (;;) {
      block472: {
        if ((yield* game.hasFightTarget()) === 0) {
          block463: {
            yield* game.placeObjectInFormation(local0);
            const t3 = yield* game.wait(0xe83, 1);
            local5 = t3;
            if ((t3 & 0x682) === 0) {
              break block463;
            }
            if ((local5 & 2) === 0) {
              if ((local5 & 0x80) === 0) {
                if ((local5 & 0x600) === 0) {
                  break block463;
                }
                local5 = yield* script(0x1cd, local0, 0x23, 0x1e);
                break block463;
              }
              yield* game.statusScreen(local0);
              local5 = yield* game.wait(0xe83, 1);
              break block463;
            }
            yield* game.talk(local0, 0x75);
            local5 = yield* game.wait(0xe83, 1);
            break block463;
          }
          local4 = truth((local5 & 0x800) !== 0) & 0xff;
          break block472;
        }
        block369: {
          if ((yield* game.hasNoObjectAnimation(local0)) === 0) {
            local3 = 0;
            local1 = (yield* game.chooseRandomFightTarget(local0)) & 0xff;
            loop68: for (;;) {
              block339: {
                if ((local5 & 0x4000) === 0) {
                  if ((local5 & 0x600) === 0) {
                    if ((local5 & 0x80) === 0) {
                      block215: {
                        if ((local5 & 0x2000) === 0) {
                          break block215;
                        }
                        yield* script(0x253);
                        const t1 = yield* game.chooseUnderGlove(local0);
                        local2 = t1 & 0xff;
                        if (t1 === 0xffff) {
                          break block215;
                        }
                        local1 = signed(local2) & 0xff;
                        break block215;
                      }
                      if (signed(local1) !== 0xffff) {
                        yield* game.turnObjectToObject(local0, signed(local1));
                        yield* game.setObjectAnimation(local0, 7);
                        const t2 = yield* game.wait(0x6e88, 0);
                        local5 = t2;
                        if ((t2 & 8) === 0) {
                          yield* game.setObjectAnimation(local0, 0);
                          break block339;
                        }
                        block332: {
                          yield* game.setObjectAnimation(local0, 4);
                          local5 = yield* game.wait(0x6e81, 0x23);
                          if (
                            ((yield* game.canAttack(local0, signed(local1))) &
                              truth((local5 & 1) !== 0)) ===
                            0
                          ) {
                            yield* game.setObjectAnimation(local0, 0);
                            break block332;
                          }
                          yield* game.turnObjectToObject(local0, signed(local1));
                          yield* game.createObject(0x10a, local0, signed(local1), 0, 0x12a);
                          yield* game.setObjectAnimation(local0, 8);
                          local5 = yield* game.wait(0x6e81, 0x3c);
                          break block332;
                        }
                        break block339;
                      }
                      yield* game.placeObjectInFormation(local0);
                      local5 = yield* game.wait(0x6e81, 1);
                      break block339;
                    }
                    yield* game.statusScreen(local0);
                    local5 = yield* game.wait(1, 1);
                    break block339;
                  }
                  local5 = yield* script(0x1cd, local0, 0x1e, 0x1e);
                  break block339;
                }
                yield* game.setObjectAnimation(local0, 2);
                yield* game.setObjectFlagBits(local0, 0x60);
                yield* game.choosePlace(local0);
                loop91: for (;;) {
                  block126: {
                    local5 = yield* game.wait(0x6e85, 0xf);
                    if (
                      (truth(((yield* game.getObjectFlags(local0)) & 8) !== 0) &
                        truth(local5 === 1)) ===
                      0
                    ) {
                      break block126;
                    }
                    yield* game.stopMotion(local0);
                    yield* game.clearObjectVelocity(local0);
                    local5 = 4;
                    break block126;
                  }
                  if (local5 === 1) {
                    continue loop91;
                  }
                  yield* game.keepObjectFlagBits(local0, 0xff9f);
                  break block339;
                }
              }
              local4 = truth((local5 & 0x800) !== 0) & 0xff;
              if (
                (signed(local3) |
                  signed(local4) |
                  ((yield* game.canAttack(local0, signed(local1))) ^ 0xffff)) ===
                0
              ) {
                continue loop68;
              }
              yield* game.stopMotion(local0);
              yield* game.clearObjectVelocity(local0);
              break block369;
            }
          } else {
            local4 = (yield* script(0x194, local0)) & 0xff;
            break block369;
          }
        }
        break block472;
      }
      if (signed(local4) === 0) {
        continue loop40;
      }
      yield* script(0x331, local0);
      yield* script(0x068, local0);
      return null;
    }
  } else {
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1EA: 1 argument.
export function* script1EA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2bc, local0, 0x20, 0x24, 1, 0x40, 0x16c0);
  return null;
}

// Script 1EB: 1 argument.
export function* script1EB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x28);
    yield* script(0x0ab, local0, 0x506, 0, 0x1c);
    yield* game.setActorStateFlagBits(0x1b66, 1);
    yield* game.wait(1, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 1EC: 1 argument.
export function* script1EC(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  block374: {
    local0 = arg0 & 0xff;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (state.byte(0x1d71) !== 0) {
      break block374;
    }
    if ((yield* game.spendMagic(word(8 + shiftLeft(local0, 1)))) === 0) {
      break block374;
    }
    if ((yield* game.getPreviousFightObject(0xffff)) !== 0xffff) {
      state.setByte(0x1d71, 0, 1);
      state.setByte(0x1d72, 0, 0xffff);
      const t1 = word((yield* game.getObjectCoarseHeight(state.byte('PLAYER_OBJECT'))) + 0x20);
      const t2 = yield* game.getObjectCoarseY(state.byte('PLAYER_OBJECT'));
      const t3 = yield* game.getObjectCoarseX(state.byte('PLAYER_OBJECT'));
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
      loop233: for (;;) {
        const t4 = yield* game.getPreviousFightObject(signed(local3));
        local3 = t4 & 0xff;
        if (t4 === 0xffff) {
          yield* game.removeObject(local1);
          yield* game.wait(1, 0x14);
          state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
          state.setByte(0x1d72, 0, 0);
          state.setByte(0x1d71, 0, 0);
          break block374;
        }
        block279: {
          yield* game.turnObjectToObject(local1, signed(local3));
          const t5 = word((yield* game.moveObjectTowardsObject(local1, signed(local3))) - 5);
          local2 = t5 & 0xff;
          if ((truth(t5 > 0xf5) | truth(local2 === 0)) === 0) {
            break block279;
          }
          local2 = 1;
          break block279;
        }
        yield* game.wait(1, local2);
        yield* game.playSoundEffect(local1, 0x5a, 0xc0, 0xff);
        state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
        yield* game.wait(1, 5);
        yield* game.shootAtObject(local1, signed(local3), 0xff, 0, multiply(local0, 6), 0);
        state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
        continue loop233;
      }
    } else {
      yield* game.addMagicPoints(word(8 + shiftLeft(local0, 1)));
      break block374;
    }
  }
  return null;
}

// Script 1ED: 1 argument.
export function* script1ED(state, arg0) {
  let local0 = 0;
  block27: {
    local0 = arg0 & 0xff;
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0x5d);
      break block27;
    }
    yield* game.endDialog();
    yield* game.setActorStateFlagBits(0x7fc, 8);
    break block27;
  }
  return null;
}

// Script 1EE: 1 argument.
export function* script1EE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x20);
  yield* script(0x0db, local0);
  yield* game.wait(1, 0x1e);
  yield* game.removeObject(local0);
  return null;
}

// Script 1EF: no arguments.
export function* script1EF(state) {
  yield* script(0x118, 0xdf);
  return null;
}

// Script 1F0: 1 argument.
export function* script1F0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7bd);
  yield* script(0x00b, local0, 0, 1, 0, 0x1d);
  yield* game.removeObject(local0);
  return null;
}

// Script 1F1: 1 argument.
export function* script1F1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xb52)) & 0x80) === 0) {
    const t1 = yield* game.getDirectionToPlayer(local0);
    const t2 = local0;
    yield* script(0x06e, t2, 0xb52, t1, 0x74, 0x600);
    yield* game.notice(2, 3, 0x15, 3, 0x400, 0x18c, 0xb4);
    yield* game.addSceneObject(0xac, 0, 0, 0, 0, 0xb52, 0x1e);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 1F2: 1 argument.
export function* script1F2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 2);
  yield* game.notice(0xc, 0x14, 0xe, 3, 0x400, 0x246, 0xc8);
  yield* script(0x1c2, yield* script(0x0ab, 0x200 | local0, 0x700, 0x247, 0x10));
  yield* game.notice(3, 0x14, 0xf, 3, 0x400, 0x248, 0x78);
  return null;
}

// Script 1F3: 1 argument.
export function* script1F3(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block155: {
    local0 = arg0 & 0xff;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (
      (truth(((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3) |
        truth(state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT'))) ===
      0
    ) {
      break block155;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block155;
    }
    state.setByte(0x1d72, 0, 0xffff);
    local1 = state.byte('AIM_TARGET_OBJECT') & 0xff;
    yield* game.raiseStateCount(local1, multiply(local0, 0xf));
    const t1 = yield* game.getObjectCoarseHeight(local1);
    const t2 = word((yield* game.getObjectCoarseY(local1)) - 1);
    const t3 = word((yield* game.getObjectCoarseX(local1)) - 1);
    local2 = (yield* game.createObject(0xda, t3, t2, t1, 0xa1)) & 0xff;
    yield* game.setObjectDirection(local2, 0);
    yield* game.setObjectAnimation(local2, 0);
    yield* game.playSoundEffect(local2, 0x36, 0xff, 0xff);
    local0 = 60;
    loop100: for (;;) {
      yield* game.wait(1, 1);
      const t4 = shiftLeft(yield* game.getObjectCoarseHeight(local1), 2);
      const t5 = word(shiftLeft(yield* game.getObjectCoarseY(local1), 2) - 4);
      const t6 = word(shiftLeft(yield* game.getObjectCoarseX(local1), 2) - 4);
      const t7 = local2;
      yield* game.setObjectPosition(t7, t6, t5, t4);
      const t8 = word(local0 - 1);
      local0 = t8 & 0xff;
      if (t8 > 0) {
        continue loop100;
      }
      yield* game.removeObject(local2);
      state.setByte(0x1d72, 0, 0);
      break block155;
    }
  }
  return null;
}

// Script 1F4: 1 argument.
export function* script1F4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.setObjectDialog(local0, 0x5e);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  loop19: for (;;) {
    yield* game.wait(2, 0);
    continue loop19;
  }
}

// Script 1F5: 1 argument.
export function* script1F5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7d2);
  yield* script(0x00b, local0, 0, 1, 0, 0x24);
  yield* game.removeObject(local0);
  return null;
}

// Script 1F6: 1 argument.
export function* script1F6(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0;
  function* sub22() {
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = word((yield* game.getObjectCoarseY(local0)) - 1);
    const t3 = word((yield* game.getObjectCoarseX(local0)) - 1);
    yield* game.setObjectVelocity(yield* game.createObject(0x78, t3, t2, t1, 0x332), 0, 0, 0xfffc);
    return;
  }
  function* sub5() {
    const t4 = yield* game.getObjectCoarseHeight(local0);
    const t5 = yield* game.getObjectCoarseY(local0);
    const t6 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0x78, t6, t5, t4, 0x2e);
    return;
  }
  local0 = arg0 & 0xff;
  block441: {
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block441;
    }
    const t7 = yield* game.scriptAction(0x180);
    local1 = t7;
    if (t7 !== 0x80) {
      if (local1 !== 0x100) {
        break block441;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
        break block441;
      }
      if ((yield* game.getCurrentRoomHeader()) !== (yield* game.getRoomHeader(0x122))) {
        yield* game.notice(2, 0x16, 0x13, 3, 0x800, 7, 0xf0);
        break block441;
      }
      yield* game.setObjectRecordFlagBits(local0, 1);
      yield* game.setSpriteMode(local0, 0x8001);
      yield* game.endDialog();
      yield* game.wait(1, 1);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.playSoundEffect(local0, 0x58, 0xff, 0xf);
      yield* game.setScriptVariableBits(0x14, 1);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.placeObjectOnWaypoint(local0, 1);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.setObjectVelocity(local0, 0, 0, 0x10);
      local3 = 0;
      local4 = 0x80;
      local6 = 1;
      loop188: for (;;) {
        block221: {
          yield* game.setObjectDirection(local0, local3);
          local3 = word(local3 + 1) & 7 & 0xff;
          yield* game.wait(1, local6);
          if (!less(local4, 0xa)) {
            break block221;
          }
          local6 = word(local6 + 1);
          break block221;
        }
        if (local4 === 0) {
          loop236: for (;;) {
            yield* game.wait(1, 5);
            if (((yield* game.getScriptVariable(0x14)) & 2) === 0) {
              continue loop236;
            }
            yield* game.keepObjectFlagBits(local0, 0xffdf);
            yield* game.setObjectVelocity(local0, 0, 0, 1);
            local4 = 0xf;
            loop270: for (;;) {
              yield* game.wait(1, 0xf);
              yield* sub22();
              const t8 = word(local4 - 1);
              local4 = t8;
              if (t8 !== 0) {
                continue loop270;
              }
              yield* game.clearObjectVelocity(local0);
              local4 = 0x14;
              loop298: for (;;) {
                block329: {
                  yield* game.wait(1, 0xf);
                  yield* sub5();
                  yield* sub22();
                  if ((local4 & 3) !== 0) {
                    break block329;
                  }
                  yield* game.playSoundEffect(local0, 0x56, 0x60, 6);
                  break block329;
                }
                const t9 = word(local4 - 1);
                local4 = t9;
                if (t9 !== 0) {
                  continue loop298;
                }
                yield* game.setObjectVelocity(local0, 0, 0, 1);
                local4 = 0x3c;
                yield* game.playSoundEffect(local0, 0x56, 0xff, 4);
                loop360: for (;;) {
                  block408: {
                    yield* game.wait(1, 1);
                    yield* game.setObjectFlagBits(local0, 0x80);
                    yield* game.wait(1, 1);
                    yield* game.keepObjectFlagBits(local0, 0xff7f);
                    const t10 = word(local4 - 2);
                    local4 = t10;
                    if ((t10 & 3) !== 0) {
                      break block408;
                    }
                    const t11 = word((yield* game.getObjectDirection(local0)) + 1) & 7;
                    const t12 = local0;
                    yield* game.setObjectDirection(t12, t11);
                    break block408;
                  }
                  if (local4 !== 0) {
                    continue loop360;
                  }
                  yield* game.keepScriptVariableBits(0x14, 0xfffe);
                  break block441;
                }
              }
            }
          }
        } else {
          local4 = word(local4 - 1);
          continue loop188;
        }
      }
    } else {
      yield* game.notice(2, 0x16, 0x13, 3, 0x800, 0x10f, 0xf0);
      break block441;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1F7: 1 argument.
export function* script1F7(state, arg0) {
  const locals = new Uint8Array(10);
  function* sub470() {
    setLocalWord(locals, 1, 3);
    loop474: for (;;) {
      yield* game.setObjectVelocity(localByte(locals, 0), 0xfffe, 0xfffe, 5);
      yield* game.wait(1, 0x14);
      yield* game.setObjectVelocity(localByte(locals, 0), 2, 2, 0xfffb);
      yield* game.wait(1, 0x14);
      const t1 = word(localWord(locals, 1) - 1);
      setLocalWord(locals, 1, t1);
      if (t1 !== 0) {
        continue loop474;
      }
      yield* game.stopMotion(localByte(locals, 0));
      yield* game.clearObjectVelocity(localByte(locals, 0));
      return;
    }
  }
  function* sub242(in0, in1, in2, in3, in4) {
    block469: {
      const t2 = in4;
      const t3 = in3;
      const t4 = in2;
      const t5 = in1;
      setLocalWord(locals, 1, in0);
      setLocalWord(locals, 3, t5);
      locals[5] = t4 & 0xff;
      setLocalWord(locals, 6, t3);
      locals[8] = t2 & 0xff;
      if (
        ((yield* game.isActorStateProperty(0x8b2, localWord(locals, 1))) &
          (truth(localWord(locals, 3) === 0xffff) |
            (yield* game.isActorStateProperty(0x8b2, localWord(locals, 3)))) &
          (truth(
            ((yield* game.getObjectRecordFlags(localByte(locals, 0))) & localByte(locals, 5)) !== 0,
          ) ^
            0xffff)) ===
        0
      ) {
        break block469;
      }
      block432: {
        locals[9] = 0xffff & 0xff;
        if ((truth(localByte(locals, 5) === 2) & truth(state.byte(0x3c0b) === 0)) === 0) {
          if ((truth(localByte(locals, 5) === 4) & truth(state.byte(0x3c0c) === 0)) === 0) {
            if ((truth(localByte(locals, 5) === 8) & truth(state.byte(0x3c0a) === 0)) === 0) {
              if ((truth(localByte(locals, 5) === 0x10) & truth(state.byte(0x3c07) === 0)) === 0) {
                if (
                  (truth(localByte(locals, 5) === 0x20) & truth(state.byte(0x3c09) === 0)) ===
                  0
                ) {
                  break block432;
                }
                if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 3) !== 3) {
                  locals[9] = 0 & 0xff;
                  break block432;
                }
                state.setByte(0x3c09, 0, 1);
                break block432;
              }
              state.setByte(0x3c07, 0, 1);
              break block432;
            }
            state.setByte(0x3c0a, 0, 1);
            break block432;
          }
          block347: {
            if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 1) === 0) {
              locals[9] = 0 & 0xff;
              break block347;
            }
            state.setByte(0x3c0c, 0, 1);
            break block347;
          }
          break block432;
        }
        state.setByte(0x3c0b, 0, 1);
        break block432;
      }
      if (signed(localByte(locals, 9)) === 0) {
        break block469;
      }
      yield* game.playSoundEffect(localByte(locals, 0), 0x32, 0xff, 3);
      yield* game.setObjectRecordFlagBits(localByte(locals, 0), localByte(locals, 5));
      yield* game.notice(2, 2, localByte(locals, 8), 3, 0x800, localWord(locals, 6), 1);
      yield* game.confirmKey();
      break block469;
    }
    return;
  }
  function* sub5() {
    block241: {
      if (
        (truth(state.byte(0x3c0b) === 0) |
          truth(state.byte(0x3c0c) === 0) |
          truth(state.byte(0x3c0a) === 0) |
          truth(state.byte(0x3c07) === 0) |
          truth(state.byte(0x3c09) === 0)) ===
        0
      ) {
        break block241;
      }
      setLocalWord(locals, 1, 0);
      loop40: for (;;) {
        block193: {
          const t6 = yield* game.getScriptVariable(0x32);
          locals[3] = t6 & 0xff;
          if (t6 !== 0) {
            if (localByte(locals, 3) !== 1) {
              if (localByte(locals, 3) !== 2) {
                if (localByte(locals, 3) !== 3) {
                  if (state.byte(0x3c0a) !== 0) {
                    break block193;
                  }
                  setLocalWord(locals, 1, 0x1cf);
                  locals[4] = 0x18 & 0xff;
                  locals[5] = 5 & 0xff;
                  break block193;
                }
                block169: {
                  if (state.byte(0x3c09) !== 0) {
                    break block169;
                  }
                  setLocalWord(locals, 1, 0x1d2);
                  locals[4] = 0x1b & 0xff;
                  locals[5] = 4 & 0xff;
                  break block169;
                }
                break block193;
              }
              block137: {
                if (state.byte(0x3c0b) !== 0) {
                  break block137;
                }
                setLocalWord(locals, 1, 0x1d1);
                locals[4] = 0x19 & 0xff;
                locals[5] = 4 & 0xff;
                break block137;
              }
              break block193;
            }
            block105: {
              if (state.byte(0x3c0c) !== 0) {
                break block105;
              }
              setLocalWord(locals, 1, 0x1d3);
              locals[4] = 0x19 & 0xff;
              locals[5] = 4 & 0xff;
              break block105;
            }
            break block193;
          }
          block73: {
            if (state.byte(0x3c07) !== 0) {
              break block73;
            }
            setLocalWord(locals, 1, 0x1d0);
            locals[4] = 0x17 & 0xff;
            locals[5] = 5 & 0xff;
            break block73;
          }
          break block193;
        }
        block216: {
          if (localByte(locals, 3) !== 4) {
            yield* game.setScriptVariable(0x32, word(localByte(locals, 3) + 1));
            break block216;
          }
          yield* game.setScriptVariable(0x32, 0);
          break block216;
        }
        if (localWord(locals, 1) === 0) {
          continue loop40;
        }
        yield* game.notice(
          3,
          3,
          localByte(locals, 4),
          localByte(locals, 5),
          0x400,
          localWord(locals, 1),
          1,
        );
        yield* game.confirmKey();
        break block241;
      }
    }
    return;
  }
  locals[0] = arg0 & 0xff;
  yield* game.setActorStateFlags(0xd6d, 0);
  loop528: for (;;) {
    yield* game.wait(1, 1);
    if (!less(yield* game.getDistanceToPlayer(localByte(locals, 0)), 0x32)) {
      continue loop528;
    }
    block945: {
      yield* game.setActorStateFlagBits(0xd6d, 1);
      yield* game.wait(1, 0xf);
      yield* game.setObjectActionAndDirection(localByte(locals, 0), 1, 5);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(localByte(locals, 0), 0);
      if ((yield* game.getScriptVariable(0x2c)) !== 0) {
        yield* sub470();
        yield* sub470();
        yield* sub470();
        yield* sub470();
        break block945;
      }
      block930: {
        if (
          (((yield* game.isActorStateProperty(0x8b2, 0x999)) &
            (yield* game.isActorStateProperty(0x8b2, 0x1546)) &
            (yield* game.isActorStateProperty(0x8b2, 0xb1a))) |
            truth(((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x80) !== 0)) ===
          0
        ) {
          yield* game.wait(1, 0x3c);
          yield* game.notice(2, 0x10, 0x1c, 4, 0x400, 0x1c4, 1);
          yield* game.notice(5, 0x13, 0xf, 3, 0x400, 0x1c5, 1);
          yield* game.notice(6, 0x15, 0xf, 3, 0x400, 0x1c6, 1);
          yield* game.notice(7, 0x17, 0xf, 3, 0x400, 0x1c7, 1);
          yield* game.confirmKey();
          yield* game.wait(1, 0x3c);
          break block930;
        }
        block839: {
          yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x80);
          yield* sub470();
          if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) === 0) {
            block799: {
              if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) !== 0) {
                break block799;
              }
              block768: {
                yield* game.notice(2, 3, 0x1b, 4, 0x400, 0x1c9, 0xb4);
                if (state.byte(0x3c08) !== 0) {
                  break block768;
                }
                state.setByte(0x3c08, 0, 1);
                break block768;
              }
              block787: {
                if (state.byte(0x3bfc) !== 0) {
                  break block787;
                }
                state.setByte(0x3bfc, 0, 1);
                yield* game.raiseMemberMagicPoints(yield* game.getPlayerObjectCopy(), 0xa);
                break block787;
              }
              yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
              yield* game.wait(1, 0xb4);
              break block799;
            }
            if (((yield* game.getActorStateFlags(0x191a)) & 1) === 0) {
              yield* game.talk(localByte(locals, 0), 0x28);
              break block839;
            }
            yield* game.notice(4, 3, 0x18, 5, 0x400, 0x1c8, 1);
            yield* game.confirmKey();
            break block839;
          }
          yield* game.talk(localByte(locals, 0), 0x29);
          yield* sub242(0x1546, 0x152a, 2, 0x1cc, 0x1c);
          yield* sub242(0x1944, 0x896, 4, 0x1ce, 0x17);
          yield* sub242(0x896, 0x3cd, 8, 0x1ca, 0x18);
          yield* sub242(0x1141, 0x777, 0x10, 0x1cb, 0x19);
          yield* sub242(0x658, 0xffff, 0x20, 0x1cd, 0x1b);
          yield* sub5();
          break block839;
        }
        break block930;
      }
      break block945;
    }
    yield* game.setActorStateFlagBits(0xd6d, 2);
    yield* game.wait(1, 0xa);
    yield* game.setObjectAnimation(localByte(locals, 0), 2);
    yield* game.wait(8, 0);
    yield* game.removeObject(localByte(locals, 0));
    return null;
  }
}

// Script 1F8: 1 argument.
export function* script1F8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop13: for (;;) {
    yield* game.turnObjectToPlayer(local0);
    yield* game.wait(1, 6);
    if (
      !less(
        yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()),
        word((yield* game.getObjectCoarseX(local0)) + 0x14),
      )
    ) {
      continue loop13;
    }
    yield* game.playSoundEffect(local0, 0x3a, 0xff, 3);
    yield* game.talk(local0, 0x27);
    yield* game.setObjectActionAndDirection(local0, 1, 4);
    yield* game.setObjectVelocity(local0, 0, 0xfffb, 0);
    yield* game.wait(1, 0x104);
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1F9: 1 argument.
export function* script1F9(state, arg0) {
  let local0 = 0;
  block93: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    yield* game.setObjectFlagBits(local0, 0x100);
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      loop39: for (;;) {
        block57: {
          if (((yield* game.wait(3, 1)) & 2) === 0) {
            break block57;
          }
          yield* game.talk(local0, 0x5f);
          break block57;
        }
        yield* game.keepObjectRecordFlagBits(local0, 0xffbf);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop39;
        }
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.setObjectAnimation(local0, 2);
        yield* game.native1D(local0, 7);
        yield* game.wait(4, 0);
        break block93;
      }
    } else {
      yield* game.placeObjectOnWaypoint(local0, 7);
      break block93;
    }
  }
  yield* game.setObjectAnimation(local0, 0);
  loop97: for (;;) {
    yield* game.wait(1, 1);
    yield* game.turnObjectToPlayer(local0);
    continue loop97;
  }
}

// Script 1FA: 1 argument.
export function* script1FA(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block70: {
    local0 = arg0 & 0xff;
    yield* game.setScriptVariable(8, 0x7cb);
    yield* script(0x00b, local0, 0, 1, 0xc0, 0x32);
    const t1 = yield* game.getActorStateFlags(0x3cd);
    local1 = t1 & 0xff;
    if (t1 === 1) {
      break block70;
    }
    const t2 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseY(local0), 2);
    const t4 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
    const t5 = local1;
    yield* game.setObjectPosition(t5, t4, t3, t2);
    yield* game.setObjectVelocity(local1, 0, 0, 8);
    yield* game.setObjectRecordFlags(local1, 1);
    break block70;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1FB: no arguments.
export function* script1FB(state) {
  yield* game.endDialog();
  yield* game.wait(1, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(1, 1);
  yield* game.notice(2, 0x17, 9, 3, 0, 0x12, 1);
  return null;
}

// Script 1FC: 1 argument.
export function* script1FC(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0;
  block445: {
    local0 = arg0;
    yield* game.endDialog();
    if (!less(state.byte(0x1d6f), 4)) {
      break block445;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block445;
    }
    const t1 = yield* game.spellGloveTarget();
    local2 = t1 & 0xff;
    if (
      (truth(t1 === 0xffff) |
        (truth(((yield* game.getObjectFlags(signed(local2))) & 3) !== 3) &
          truth(notEqualOrNegativeLeft(signed(local2), state.byte('PLAYER_OBJECT'))))) ===
      0
    ) {
      state.setByte(0x1d6f, 0, word(state.byte(0x1d6f) + 1));
      const t2 = yield* game.getObjectCoarseHeight(signed(local2));
      const t3 = word((yield* game.getObjectCoarseY(signed(local2))) - 6);
      const t4 = word((yield* game.getObjectCoarseX(signed(local2))) - 6);
      const t5 = yield* game.createObject(0xc5, t4, t3, t2, 0xa1);
      local3 = t5 & 0xff;
      yield* game.bindObjectToCurrentTask(t5);
      yield* script(0x0db, local3);
      local0 = multiplySignedLeft(local0, 0x12c);
      yield* game.addObjectArmour(signed(local2), 0x1e);
      loop117: for (;;) {
        yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
        yield* game.setObjectDirection(local3, 3);
        loop132: for (;;) {
          const t6 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
          const t7 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 6);
          const t8 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 6);
          const t9 = local3;
          yield* game.setObjectPosition(t9, t8, t7, t6);
          local0 = word(local0 - 1);
          if (((yield* game.wait(9, 1)) & 8) === 0) {
            continue loop132;
          }
          yield* game.setObjectDirection(local3, 7);
          loop187: for (;;) {
            const t10 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
            const t11 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6);
            const t12 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6);
            const t13 = local3;
            yield* game.setObjectPosition(t13, t12, t11, t10);
            local0 = word(local0 - 1);
            if (((yield* game.wait(9, 1)) & 8) === 0) {
              continue loop187;
            }
            if (!lessOrEqualSignedLeft(local0, 0x78)) {
              continue loop117;
            }
            loop244: for (;;) {
              yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
              yield* game.setObjectDirection(local3, 3);
              loop259: for (;;) {
                block325: {
                  const t14 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                  const t15 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
                  const t16 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
                  const t17 = local3;
                  yield* game.setObjectPosition(t17, t16, t15, t14);
                  const t18 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                  local4 = t18 & 0xff;
                  if (t18 !== 0) {
                    break block325;
                  }
                  yield* game.setObjectPosition(local3, 0, 0, 0);
                  local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                  break block325;
                }
                local0 = word(local0 - 2);
                if (signed(local4) === 0) {
                  continue loop259;
                }
                yield* game.setObjectDirection(local3, 7);
                loop343: for (;;) {
                  block409: {
                    const t19 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                    const t20 = word(
                      shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6,
                    );
                    const t21 = word(
                      shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6,
                    );
                    const t22 = local3;
                    yield* game.setObjectPosition(t22, t21, t20, t19);
                    const t23 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                    local4 = t23 & 0xff;
                    if (t23 !== 0) {
                      break block409;
                    }
                    yield* game.setObjectPosition(local3, 0, 0, 0);
                    local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                    break block409;
                  }
                  local0 = word(local0 - 2);
                  if (signed(local4) === 0) {
                    continue loop343;
                  }
                  if (!lessOrEqualSignedLeft(local0, 0)) {
                    continue loop244;
                  }
                  yield* game.subtractObjectArmour(signed(local2), 0x1e);
                  yield* game.removeObject(local3);
                  state.setByte(0x1d6f, 0, word(state.byte(0x1d6f) - 1));
                  break block445;
                }
              }
            }
          }
        }
      }
    } else {
      yield* game.addMagicPoints(word(4 + local0));
      break block445;
    }
  }
  return null;
}

// Script 1FD: 1 argument.
export function* script1FD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x60);
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

// Script 1FE: no arguments.
export function* script1FE(state) {
  block71: {
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0xbd);
      break block71;
    }
    block64: {
      if ((yield* game.payNuyen(0x64)) === 0) {
        yield* game.topicText(0xbc);
        break block64;
      }
      block57: {
        if (less(yield* game.getActorStateCount(0x395), 6)) {
          yield* game.addActorStateCount(0x395, 1);
          yield* game.setActorStateHolder(0x395, 0x8b2);
          yield* game.topicText(0xbb);
          break block57;
        }
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xbe);
        break block57;
      }
      break block64;
    }
    break block71;
  }
  return null;
}

// Script 1FF: no arguments.
export function* script1FF(state) {
  const t1 = yield* script(0x03f, 0x7d0, 0x708, 0x5dc);
  const t2 = yield* script(0x0b2, 0x184, 0x185, 0x186);
  yield* script(0x162, 0xa4f, t2, t1, 0x183, 0x182);
  return null;
}
