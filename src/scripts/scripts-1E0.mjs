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
  local0 = arg0 & 0xff;
  const t1 = yield* game.scriptAction(0x180);
  local1 = t1;
  if (local1 !== 0x80) {
    if (local1 === 0x100) {
      yield* game.endDialog();
      yield* game.wait(1, 0x14);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      yield* game.wait(1, 5);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(1, 0xa);
      state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
      if ((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x13d))) {
        yield* game.setActorStateFlagBits(0x188, 0x80);
      }
    }
  } else {
    yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x1bb, 0xf0);
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
    if (less(state.byte('ARMOUR_SPELLS_ACTIVE'), 4)) {
      if (
        ((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3 ||
        state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT')
      ) {
        if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
          state.setByte('ARMOUR_SPELLS_ACTIVE', 0, word(state.byte('ARMOUR_SPELLS_ACTIVE') + 1));
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
            for (;;) {
              const t5 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
              const t6 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) - 6);
              const t7 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) - 6);
              yield* game.setObjectPosition(local3, t7, t6, t5);
              local0 = word(local0 - 1);
              if (((yield* game.wait(9, 1)) & 8) !== 0) {
                yield* game.setObjectDirection(local3, 7);
                for (;;) {
                  const t8 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
                  const t9 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) + 6);
                  const t10 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) + 6);
                  yield* game.setObjectPosition(local3, t10, t9, t8);
                  local0 = word(local0 - 1);
                  if (((yield* game.wait(9, 1)) & 8) !== 0) {
                    if (!lessOrEqualSignedLeft(local0, 0x78)) {
                      continue loop107;
                    }
                    loop234: for (;;) {
                      yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
                      yield* game.setObjectDirection(local3, 3);
                      for (;;) {
                        const t11 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
                        const t12 = word(shiftLeft(yield* game.getObjectCoarseY(local2), 2) - 4);
                        const t13 = word(shiftLeft(yield* game.getObjectCoarseX(local2), 2) - 4);
                        yield* game.setObjectPosition(local3, t13, t12, t11);
                        const t14 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                        local4 = t14 & 0xff;
                        if (t14 === 0) {
                          yield* game.setObjectPosition(local3, 0, 0, 0);
                          local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                        }
                        local0 = word(local0 - 2);
                        if (signed(local4) !== 0) {
                          yield* game.setObjectDirection(local3, 7);
                          for (;;) {
                            const t15 = shiftLeft(yield* game.getObjectCoarseHeight(local2), 2);
                            const t16 = word(
                              shiftLeft(yield* game.getObjectCoarseY(local2), 2) + 6,
                            );
                            const t17 = word(
                              shiftLeft(yield* game.getObjectCoarseX(local2), 2) + 6,
                            );
                            yield* game.setObjectPosition(local3, t17, t16, t15);
                            const t18 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                            local4 = t18 & 0xff;
                            if (t18 === 0) {
                              yield* game.setObjectPosition(local3, 0, 0, 0);
                              local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                            }
                            local0 = word(local0 - 2);
                            if (signed(local4) !== 0) {
                              if (!lessOrEqualSignedLeft(local0, 0)) {
                                continue loop234;
                              }
                              yield* game.subtractObjectArmour(local2, 0x1e);
                              yield* game.removeObject(local3);
                              state.setByte(
                                'ARMOUR_SPELLS_ACTIVE',
                                0,
                                word(state.byte('ARMOUR_SPELLS_ACTIVE') - 1),
                              );
                              break block435;
                            }
                          }
                        }
                      }
                    }
                  }
                }
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
                                  if (local0 === 0x1b5f) {
                                    local4 = 0x13c;
                                    local6 = 0x4e20;
                                  }
                                } else {
                                  local4 = 0x13b;
                                  local6 = 0x3a98;
                                }
                              } else {
                                local4 = 0x138;
                                local6 = 0x2328;
                              }
                            } else {
                              local4 = 0x136;
                              local6 = 0x1770;
                            }
                          } else {
                            local4 = 0x134;
                            local6 = 0xbb8;
                          }
                        } else {
                          local4 = 0x139;
                          local6 = 0x2af8;
                        }
                      } else {
                        local4 = 0x13a;
                        local6 = 0x36b0;
                      }
                    } else {
                      local4 = 0x136;
                      local6 = 0x1770;
                    }
                  } else {
                    local4 = 0x131;
                    local6 = 0x514;
                  }
                } else {
                  local4 = 0x135;
                  local6 = 0xfa0;
                }
              } else {
                local4 = 0x130;
                local6 = 0x3e8;
              }
            } else {
              local4 = 0x137;
              local6 = 0x1d4c;
            }
          } else {
            local4 = 0x133;
            local6 = 0x9c4;
          }
        } else {
          local4 = 0x132;
          local6 = 0x7d0;
        }
      } else {
        local4 = 0x12f;
        local6 = 0xc8;
      }
    } else {
      local4 = 0x12f;
      local6 = 0xc8;
    }
  } else {
    local4 = 0x130;
    local6 = 0x3e8;
  }
  if (local6 !== 0xcadd) {
    if (local2 !== 0x13) {
      if (local2 !== 0x18) {
        if (local2 === 0x1d) {
          yield* game.topicText(0x260);
        }
      } else {
        yield* game.topicText(0x261);
      }
    } else {
      yield* game.topicText(0x262);
    }
    yield* game.windowText(local4);
    if (local2 !== 0x13) {
      if (local2 !== 0x18) {
        if (local2 === 0x1d) {
          yield* game.windowText(0x128);
        }
      } else {
        yield* game.windowText(0x127);
      }
    } else {
      yield* game.windowText(0x126);
    }
    if ((yield* game.question(0x14, 8)) === 0) {
      if (local2 !== 0x13) {
        if (local2 !== 0x18) {
          if (local2 === 0x1d) {
            yield* game.topicText(0x12e);
          }
        } else {
          yield* game.topicText(0x12d);
        }
      } else {
        yield* game.topicText(0x12c);
      }
    } else {
      if (local2 !== 0x13) {
        if (local2 !== 0x18) {
          if (local2 === 0x1d) {
            yield* game.topicText(0x12b);
          }
        } else {
          yield* game.topicText(0x12a);
        }
      } else {
        yield* game.topicText(0x129);
      }
      yield* game.setActorItemPropertyAndUnequip(local0, 0xbad);
      yield* game.addNuyen(local6);
    }
  } else {
    yield* game.topicText(0x125);
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
  for (;;) {
    if ((yield* sub5(1)) !== 0) {
      yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      yield* game.talk(local0, 2);
    }
    if ((yield* sub5(2)) !== 0) {
      yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
      yield* game.talk(local0, 3);
    }
    if ((yield* sub5(0x20)) !== 0) {
      yield* game.keepObjectRecordFlagBits(local0, 0xffdf);
      yield* game.talk(local0, 4);
    }
    if (((yield* sub5(0x80)) & (yield* sub5(0x40))) === 0) {
      if ((yield* sub5(0x80)) !== 0) {
        yield* game.wait(2, 0);
        yield* game.talk(local0, 5);
      }
      if ((truth(less(yield* game.getScriptVariable(4), 0xa)) & (yield* sub5(4))) !== 0) {
        yield* game.keepObjectRecordFlagBits(local0, 0xfffb);
        const t1 = yield* game.getScriptVariable(4);
        local3 = t1;
        if (local3 !== 0) {
          if (local3 !== 1) {
            if (local3 !== 2) {
              if (local3 !== 3) {
                if (local3 !== 4) {
                  if (local3 !== 5) {
                    if (local3 !== 6) {
                      if (local3 !== 7) {
                        if (local3 !== 8) {
                          if (local3 === 9) {
                            local1 = 0xa95;
                          }
                        } else {
                          local1 = 0x1f1;
                        }
                      } else {
                        local1 = 0x1283;
                      }
                    } else {
                      local1 = 0x137f;
                    }
                  } else {
                    local1 = 0x620;
                  }
                } else {
                  local1 = 0xae2;
                }
              } else {
                local1 = 0xa5d;
              }
            } else {
              local1 = 0xd43;
            }
          } else {
            local1 = 0xce8;
          }
        } else {
          local1 = 0x1267;
        }
        yield* game.setActorStateFlagBits(local1, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(1, 1);
      }
      if ((yield* sub5(8)) !== 0) {
        yield* game.keepObjectRecordFlagBits(local0, 0xfff7);
        yield* game.setActorStateFlagBits(0x245, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(1, 1);
      }
      if ((yield* sub5(0x80)) === 0) {
        yield* game.wait(2, 0);
        yield* game.talk(local0, 1);
      }
    } else {
      for (;;) {
        yield* game.wait(2, 0);
        yield* game.notice(2, 4, 0x19, 3, 0x400, 0xc7, 0x78);
      }
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
  local0 = arg0 & 0xff;
  if ((yield* game.question(0x18, 5)) === 0) {
    yield* game.topicText(0xac);
  } else {
    if ((yield* game.payNuyen(0x1f4)) === 0) {
      yield* game.topicText(0xad);
    } else {
      yield* game.setActorStateFlagBits(0x317, 0x80);
      yield* game.endDialog();
    }
  }
  return null;
}

// Script 1E7: 1 argument.
export function* script1E7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22f, 0xf0);
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
    for (;;) {
      if ((yield* game.hasFightTarget()) === 0) {
        yield* game.placeObjectInFormation(local0);
        const t3 = yield* game.wait(0xe83, 1);
        local5 = t3;
        if ((local5 & 0x682) !== 0) {
          if ((local5 & 2) === 0) {
            if ((local5 & 0x80) === 0) {
              if ((local5 & 0x600) !== 0) {
                local5 = yield* script(0x1cd, local0, 0x23, 0x1e);
              }
            } else {
              yield* game.statusScreen(local0);
              local5 = yield* game.wait(0xe83, 1);
            }
          } else {
            yield* game.talk(local0, 0x75);
            local5 = yield* game.wait(0xe83, 1);
          }
        }
        local4 = truth((local5 & 0x800) !== 0) & 0xff;
      } else {
        block369: {
          if ((yield* game.hasNoObjectAnimation(local0)) === 0) {
            local3 = 0;
            local1 = (yield* game.chooseRandomFightTarget(local0)) & 0xff;
            for (;;) {
              block339: {
                if ((local5 & 0x4000) === 0) {
                  if ((local5 & 0x600) === 0) {
                    if ((local5 & 0x80) === 0) {
                      if ((local5 & 0x2000) !== 0) {
                        yield* script(0x253);
                        const t1 = yield* game.chooseUnderGlove(local0);
                        local2 = t1 & 0xff;
                        if (t1 !== 0xffff) {
                          local1 = signed(local2) & 0xff;
                        }
                      }
                      if (signed(local1) !== 0xffff) {
                        yield* game.turnObjectToObject(local0, signed(local1));
                        yield* game.setObjectAnimation(local0, 7);
                        const t2 = yield* game.wait(0x6e88, 0);
                        local5 = t2;
                        if ((local5 & 8) === 0) {
                          yield* game.setObjectAnimation(local0, 0);
                        } else {
                          yield* game.setObjectAnimation(local0, 4);
                          local5 = yield* game.wait(0x6e81, 0x23);
                          if (
                            ((yield* game.canAttack(local0, signed(local1))) &
                              truth((local5 & 1) !== 0)) ===
                            0
                          ) {
                            yield* game.setObjectAnimation(local0, 0);
                          } else {
                            yield* game.turnObjectToObject(local0, signed(local1));
                            yield* game.createObject(0x10a, local0, signed(local1), 0, 0x12a);
                            yield* game.setObjectAnimation(local0, 8);
                            local5 = yield* game.wait(0x6e81, 0x3c);
                          }
                        }
                      } else {
                        yield* game.placeObjectInFormation(local0);
                        local5 = yield* game.wait(0x6e81, 1);
                      }
                    } else {
                      yield* game.statusScreen(local0);
                      local5 = yield* game.wait(1, 1);
                    }
                  } else {
                    local5 = yield* script(0x1cd, local0, 0x1e, 0x1e);
                  }
                } else {
                  yield* game.setObjectAnimation(local0, 2);
                  yield* game.setObjectFlagBits(local0, 0x60);
                  yield* game.choosePlace(local0);
                  for (;;) {
                    local5 = yield* game.wait(0x6e85, 0xf);
                    if (((yield* game.getObjectFlags(local0)) & 8) !== 0 && local5 === 1) {
                      yield* game.stopMotion(local0);
                      yield* game.clearObjectVelocity(local0);
                      local5 = 4;
                    }
                    if (local5 !== 1) {
                      yield* game.keepObjectFlagBits(local0, 0xff9f);
                      break block339;
                    }
                  }
                }
              }
              local4 = truth((local5 & 0x800) !== 0) & 0xff;
              if (
                (signed(local3) |
                  signed(local4) |
                  ((yield* game.canAttack(local0, signed(local1))) ^ 0xffff)) !==
                0
              ) {
                yield* game.stopMotion(local0);
                yield* game.clearObjectVelocity(local0);
                break block369;
              }
            }
          } else {
            local4 = (yield* script(0x194, local0)) & 0xff;
          }
        }
      }
      if (signed(local4) !== 0) {
        yield* script(0x331, local0);
        yield* script(0x068, local0);
        return null;
      }
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
    if (state.byte('SPIRIT_SUMMONED') === 0) {
      if ((yield* game.spendMagic(word(8 + shiftLeft(local0, 1)))) !== 0) {
        if ((yield* game.getPreviousFightObject(0xffff)) !== 0xffff) {
          state.setByte('SPIRIT_SUMMONED', 0, 1);
          state.setByte('SPELL_EFFECT_BUSY', 0, 0xffff);
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
          for (;;) {
            const t4 = yield* game.getPreviousFightObject(signed(local3));
            local3 = t4 & 0xff;
            if (t4 === 0xffff) {
              yield* game.removeObject(local1);
              yield* game.wait(1, 0x14);
              state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
              state.setByte('SPELL_EFFECT_BUSY', 0, 0);
              state.setByte('SPIRIT_SUMMONED', 0, 0);
              break block374;
            }
            yield* game.turnObjectToObject(local1, signed(local3));
            const t5 = word((yield* game.moveObjectTowardsObject(local1, signed(local3))) - 5);
            local2 = t5 & 0xff;
            if (t5 > 0xf5 || local2 === 0) {
              local2 = 1;
            }
            yield* game.wait(1, local2);
            yield* game.playSoundEffect(local1, 0x5a, 0xc0, 0xff);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
            yield* game.wait(1, 5);
            yield* game.shootAtObject(local1, signed(local3), 0xff, 0, multiply(local0, 6), 0);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          }
        } else {
          yield* game.addMagicPoints(word(8 + shiftLeft(local0, 1)));
        }
      }
    }
  }
  return null;
}

// Script 1ED: 1 argument.
export function* script1ED(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0x5d);
  } else {
    yield* game.endDialog();
    yield* game.setActorStateFlagBits(0x7fc, 8);
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
    yield* script(0x06e, local0, 0xb52, yield* game.getDirectionToPlayer(local0), 0x74, 0x600);
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
      ((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3 ||
      state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT')
    ) {
      if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
        state.setByte('SPELL_EFFECT_BUSY', 0, 0xffff);
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
        for (;;) {
          yield* game.wait(1, 1);
          const t4 = shiftLeft(yield* game.getObjectCoarseHeight(local1), 2);
          const t5 = word(shiftLeft(yield* game.getObjectCoarseY(local1), 2) - 4);
          const t6 = word(shiftLeft(yield* game.getObjectCoarseX(local1), 2) - 4);
          yield* game.setObjectPosition(local2, t6, t5, t4);
          const t7 = word(local0 - 1);
          local0 = word(local0 - 1) & 0xff;
          if (t7 <= 0) {
            yield* game.removeObject(local2);
            state.setByte('SPELL_EFFECT_BUSY', 0, 0);
            break block155;
          }
        }
      }
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
  for (;;) {
    yield* game.wait(2, 0);
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
  }
  function* sub5() {
    const t4 = yield* game.getObjectCoarseHeight(local0);
    const t5 = yield* game.getObjectCoarseY(local0);
    const t6 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0x78, t6, t5, t4, 0x2e);
  }
  local0 = arg0 & 0xff;
  block441: {
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      const t7 = yield* game.scriptAction(0x180);
      local1 = t7;
      if (local1 !== 0x80) {
        if (local1 === 0x100) {
          if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
            if ((yield* game.getCurrentRoomHeader()) !== (yield* game.getRoomHeader(0x122))) {
              yield* game.notice(2, 0x16, 0x13, 3, 0x800, 7, 0xf0);
            } else {
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
              for (;;) {
                yield* game.setObjectDirection(local0, local3);
                local3 = word(local3 + 1) & 7 & 0xff;
                yield* game.wait(1, local6);
                if (less(local4, 0xa)) {
                  local6 = word(local6 + 1);
                }
                if (local4 === 0) {
                  for (;;) {
                    yield* game.wait(1, 5);
                    if (((yield* game.getScriptVariable(0x14)) & 2) !== 0) {
                      yield* game.keepObjectFlagBits(local0, 0xffdf);
                      yield* game.setObjectVelocity(local0, 0, 0, 1);
                      local4 = 0xf;
                      for (;;) {
                        yield* game.wait(1, 0xf);
                        yield* sub22();
                        local4 = word(local4 - 1);
                        if (local4 === 0) {
                          yield* game.clearObjectVelocity(local0);
                          local4 = 0x14;
                          for (;;) {
                            yield* game.wait(1, 0xf);
                            yield* sub5();
                            yield* sub22();
                            if ((local4 & 3) === 0) {
                              yield* game.playSoundEffect(local0, 0x56, 0x60, 6);
                            }
                            local4 = word(local4 - 1);
                            if (local4 === 0) {
                              yield* game.setObjectVelocity(local0, 0, 0, 1);
                              local4 = 0x3c;
                              yield* game.playSoundEffect(local0, 0x56, 0xff, 4);
                              for (;;) {
                                yield* game.wait(1, 1);
                                yield* game.setObjectFlagBits(local0, 0x80);
                                yield* game.wait(1, 1);
                                yield* game.keepObjectFlagBits(local0, 0xff7f);
                                local4 = word(local4 - 2);
                                if ((local4 & 3) === 0) {
                                  yield* game.setObjectDirection(
                                    local0,
                                    word((yield* game.getObjectDirection(local0)) + 1) & 7,
                                  );
                                }
                                if (local4 === 0) {
                                  yield* game.keepScriptVariableBits(0x14, 0xfffe);
                                  break block441;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  local4 = word(local4 - 1);
                }
              }
            }
          }
        }
      } else {
        yield* game.notice(2, 0x16, 0x13, 3, 0x800, 0x10f, 0xf0);
      }
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
    for (;;) {
      yield* game.setObjectVelocity(localByte(locals, 0), 0xfffe, 0xfffe, 5);
      yield* game.wait(1, 0x14);
      yield* game.setObjectVelocity(localByte(locals, 0), 2, 2, 0xfffb);
      yield* game.wait(1, 0x14);
      setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
      if (localWord(locals, 1) === 0) {
        yield* game.stopMotion(localByte(locals, 0));
        yield* game.clearObjectVelocity(localByte(locals, 0));
        return;
      }
    }
  }
  function* sub242(in0, in1, in2, in3, in4) {
    setLocalWord(locals, 1, in0);
    setLocalWord(locals, 3, in1);
    locals[5] = in2 & 0xff;
    setLocalWord(locals, 6, in3);
    locals[8] = in4 & 0xff;
    if (
      ((yield* game.isActorStateProperty(0x8b2, localWord(locals, 1))) &
        (truth(localWord(locals, 3) === 0xffff) |
          (yield* game.isActorStateProperty(0x8b2, localWord(locals, 3)))) &
        (truth(
          ((yield* game.getObjectRecordFlags(localByte(locals, 0))) & localByte(locals, 5)) !== 0,
        ) ^
          0xffff)) !==
      0
    ) {
      locals[9] = 0xffff & 0xff;
      if (!(localByte(locals, 5) === 2 && state.byte('JAKE_SUMMON_SPIRIT') === 0)) {
        if (!(localByte(locals, 5) === 4 && state.byte('JAKE_FREEZE') === 0)) {
          if (!(localByte(locals, 5) === 8 && state.byte('JAKE_ARMOUR_SPELL') === 0)) {
            if (!(localByte(locals, 5) === 0x10 && state.byte('JAKE_POWERBALL') === 0)) {
              if (localByte(locals, 5) === 0x20 && state.byte('JAKE_INVISIBILITY') === 0) {
                if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 3) !== 3) {
                  locals[9] = 0 & 0xff;
                } else {
                  state.setByte('JAKE_INVISIBILITY', 0, 1);
                }
              }
            } else {
              state.setByte('JAKE_POWERBALL', 0, 1);
            }
          } else {
            state.setByte('JAKE_ARMOUR_SPELL', 0, 1);
          }
        } else {
          if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 1) === 0) {
            locals[9] = 0 & 0xff;
          } else {
            state.setByte('JAKE_FREEZE', 0, 1);
          }
        }
      } else {
        state.setByte('JAKE_SUMMON_SPIRIT', 0, 1);
      }
      if (signed(localByte(locals, 9)) !== 0) {
        yield* game.playSoundEffect(localByte(locals, 0), 0x32, 0xff, 3);
        yield* game.setObjectRecordFlagBits(localByte(locals, 0), localByte(locals, 5));
        yield* game.notice(2, 2, localByte(locals, 8), 3, 0x800, localWord(locals, 6), 1);
        yield* game.confirmKey();
      }
    }
  }
  function* sub5() {
    block241: {
      if (
        state.byte('JAKE_SUMMON_SPIRIT') === 0 ||
        state.byte('JAKE_FREEZE') === 0 ||
        state.byte('JAKE_ARMOUR_SPELL') === 0 ||
        state.byte('JAKE_POWERBALL') === 0 ||
        state.byte('JAKE_INVISIBILITY') === 0
      ) {
        setLocalWord(locals, 1, 0);
        for (;;) {
          const t1 = yield* game.getScriptVariable(0x32);
          locals[3] = t1 & 0xff;
          if (t1 !== 0) {
            if (localByte(locals, 3) !== 1) {
              if (localByte(locals, 3) !== 2) {
                if (localByte(locals, 3) !== 3) {
                  if (state.byte('JAKE_ARMOUR_SPELL') === 0) {
                    setLocalWord(locals, 1, 0x1cf);
                    locals[4] = 0x18 & 0xff;
                    locals[5] = 5 & 0xff;
                  }
                } else {
                  if (state.byte('JAKE_INVISIBILITY') === 0) {
                    setLocalWord(locals, 1, 0x1d2);
                    locals[4] = 0x1b & 0xff;
                    locals[5] = 4 & 0xff;
                  }
                }
              } else {
                if (state.byte('JAKE_SUMMON_SPIRIT') === 0) {
                  setLocalWord(locals, 1, 0x1d1);
                  locals[4] = 0x19 & 0xff;
                  locals[5] = 4 & 0xff;
                }
              }
            } else {
              if (state.byte('JAKE_FREEZE') === 0) {
                setLocalWord(locals, 1, 0x1d3);
                locals[4] = 0x19 & 0xff;
                locals[5] = 4 & 0xff;
              }
            }
          } else {
            if (state.byte('JAKE_POWERBALL') === 0) {
              setLocalWord(locals, 1, 0x1d0);
              locals[4] = 0x17 & 0xff;
              locals[5] = 5 & 0xff;
            }
          }
          if (localByte(locals, 3) !== 4) {
            yield* game.setScriptVariable(0x32, word(localByte(locals, 3) + 1));
          } else {
            yield* game.setScriptVariable(0x32, 0);
          }
          if (localWord(locals, 1) !== 0) {
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
      }
    }
  }
  locals[0] = arg0 & 0xff;
  yield* game.setActorStateFlags(0xd6d, 0);
  for (;;) {
    yield* game.wait(1, 1);
    if (less(yield* game.getDistanceToPlayer(localByte(locals, 0)), 0x32)) {
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
      } else {
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
        } else {
          yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x80);
          yield* sub470();
          if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) === 0) {
            if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
              yield* game.notice(2, 3, 0x1b, 4, 0x400, 0x1c9, 0xb4);
              if (state.byte('JAKE_HEAL') === 0) {
                state.setByte('JAKE_HEAL', 0, 1);
              }
              if (state.byte('JAKE_MAGIC') === 0) {
                state.setByte('JAKE_MAGIC', 0, 1);
                yield* game.raiseMemberMagicPoints(yield* game.getPlayerObjectCopy(), 0xa);
              }
              yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
              yield* game.wait(1, 0xb4);
            }
            if (((yield* game.getActorStateFlags(0x191a)) & 1) === 0) {
              yield* game.talk(localByte(locals, 0), 0x28);
            } else {
              yield* game.notice(4, 3, 0x18, 5, 0x400, 0x1c8, 1);
              yield* game.confirmKey();
            }
          } else {
            yield* game.talk(localByte(locals, 0), 0x29);
            yield* sub242(0x1546, 0x152a, 2, 0x1cc, 0x1c);
            yield* sub242(0x1944, 0x896, 4, 0x1ce, 0x17);
            yield* sub242(0x896, 0x3cd, 8, 0x1ca, 0x18);
            yield* sub242(0x1141, 0x777, 0x10, 0x1cb, 0x19);
            yield* sub242(0x658, 0xffff, 0x20, 0x1cd, 0x1b);
            yield* sub5();
          }
        }
      }
      yield* game.setActorStateFlagBits(0xd6d, 2);
      yield* game.wait(1, 0xa);
      yield* game.setObjectAnimation(localByte(locals, 0), 2);
      yield* game.wait(8, 0);
      yield* game.removeObject(localByte(locals, 0));
      return null;
    }
  }
}

// Script 1F8: 1 argument.
export function* script1F8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    yield* game.turnObjectToPlayer(local0);
    yield* game.wait(1, 6);
    if (
      less(
        yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()),
        word((yield* game.getObjectCoarseX(local0)) + 0x14),
      )
    ) {
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
      for (;;) {
        if (((yield* game.wait(3, 1)) & 2) !== 0) {
          yield* game.talk(local0, 0x5f);
        }
        yield* game.keepObjectRecordFlagBits(local0, 0xffbf);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(local0, 1);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.moveObjectToWaypoint(local0, 7);
          yield* game.wait(4, 0);
          break block93;
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(local0, 7);
    }
  }
  yield* game.setObjectAnimation(local0, 0);
  for (;;) {
    yield* game.wait(1, 1);
    yield* game.turnObjectToPlayer(local0);
  }
}

// Script 1FA: 1 argument.
export function* script1FA(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7cb);
  yield* script(0x00b, local0, 0, 1, 0xc0, 0x32);
  const t1 = yield* game.getActorStateFlags(0x3cd);
  local1 = t1 & 0xff;
  if (t1 !== 1) {
    const t2 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseY(local0), 2);
    const t4 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
    yield* game.setObjectPosition(local1, t4, t3, t2);
    yield* game.setObjectVelocity(local1, 0, 0, 8);
    yield* game.setObjectRecordFlags(local1, 1);
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
    if (less(state.byte('ARMOUR_SPELLS_ACTIVE'), 4)) {
      if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
        const t1 = yield* game.spellGloveTarget();
        local2 = t1 & 0xff;
        if (
          (truth(t1 === 0xffff) |
            truth(
              ((yield* game.getObjectFlags(signed(local2))) & 3) !== 3 &&
                notEqualOrNegativeLeft(signed(local2), state.byte('PLAYER_OBJECT')),
            )) ===
          0
        ) {
          state.setByte('ARMOUR_SPELLS_ACTIVE', 0, word(state.byte('ARMOUR_SPELLS_ACTIVE') + 1));
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
            for (;;) {
              const t6 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
              const t7 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 6);
              const t8 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 6);
              yield* game.setObjectPosition(local3, t8, t7, t6);
              local0 = word(local0 - 1);
              if (((yield* game.wait(9, 1)) & 8) !== 0) {
                yield* game.setObjectDirection(local3, 7);
                for (;;) {
                  const t9 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                  const t10 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6);
                  const t11 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6);
                  yield* game.setObjectPosition(local3, t11, t10, t9);
                  local0 = word(local0 - 1);
                  if (((yield* game.wait(9, 1)) & 8) !== 0) {
                    if (!lessOrEqualSignedLeft(local0, 0x78)) {
                      continue loop117;
                    }
                    loop244: for (;;) {
                      yield* game.playSoundEffect(local3, 8, 0xff, 0xff);
                      yield* game.setObjectDirection(local3, 3);
                      for (;;) {
                        const t12 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                        const t13 = word(
                          shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4,
                        );
                        const t14 = word(
                          shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4,
                        );
                        yield* game.setObjectPosition(local3, t14, t13, t12);
                        const t15 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                        local4 = t15 & 0xff;
                        if (t15 === 0) {
                          yield* game.setObjectPosition(local3, 0, 0, 0);
                          local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                        }
                        local0 = word(local0 - 2);
                        if (signed(local4) !== 0) {
                          yield* game.setObjectDirection(local3, 7);
                          for (;;) {
                            const t16 = shiftLeft(
                              yield* game.getObjectCoarseHeight(signed(local2)),
                              2,
                            );
                            const t17 = word(
                              shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6,
                            );
                            const t18 = word(
                              shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6,
                            );
                            yield* game.setObjectPosition(local3, t18, t17, t16);
                            const t19 = truth(((yield* game.wait(9, 1)) & 8) !== 0);
                            local4 = t19 & 0xff;
                            if (t19 === 0) {
                              yield* game.setObjectPosition(local3, 0, 0, 0);
                              local4 = truth(((yield* game.wait(9, 1)) & 8) !== 0) & 0xff;
                            }
                            local0 = word(local0 - 2);
                            if (signed(local4) !== 0) {
                              if (!lessOrEqualSignedLeft(local0, 0)) {
                                continue loop244;
                              }
                              yield* game.subtractObjectArmour(signed(local2), 0x1e);
                              yield* game.removeObject(local3);
                              state.setByte(
                                'ARMOUR_SPELLS_ACTIVE',
                                0,
                                word(state.byte('ARMOUR_SPELLS_ACTIVE') - 1),
                              );
                              break block445;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          yield* game.addMagicPoints(word(4 + local0));
        }
      }
    }
  }
  return null;
}

// Script 1FD: 1 argument.
export function* script1FD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x60);
  for (;;) {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 7);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
  }
}

// Script 1FE: no arguments.
export function* script1FE(state) {
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0xbd);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.topicText(0xbc);
    } else {
      if (less(yield* game.getActorStateCount(0x395), 6)) {
        yield* game.addActorStateCount(0x395, 1);
        yield* game.setActorStateHolder(0x395, 0x8b2);
        yield* game.topicText(0xbb);
      } else {
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xbe);
      }
    }
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
