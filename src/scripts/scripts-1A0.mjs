// Scripts 1A0 to 1BF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  localByte,
  localWord,
  script,
  setLocalWord,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 1A0: 7 arguments, returns a word.
export function* script1A0(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
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
    block180: {
      if (!less(yield* game.getObjectRecordCount(local15), 0xc)) {
        block172: {
          yield* game.setObjectAnimation(local15, 2);
          if (local14 !== 1) {
            if (local14 !== 3) {
              if (local14 !== 5) {
                if (local14 !== 7) {
                  const t1 = yield* game.chooseEnemyTarget(local15);
                  local16 = t1 & 0xff;
                  if (t1 === 0xffff) {
                    yield* game.native81(local15, shiftRight(local0, 8));
                    break block172;
                  }
                  yield* game.moveObjectStraightToPlayer(local15);
                  break block172;
                }
                yield* game.native81(local15, local4 & 0xff);
                break block172;
              }
              yield* game.native81(local15, shiftRight(local4, 8));
              break block172;
            }
            yield* game.native81(local15, local2 & 0xff);
            break block172;
          }
          yield* game.native81(local15, shiftRight(local2, 8));
          break block172;
        }
        local14 = word(local14 + 1) & 7 & 0xff;
        break block180;
      }
      block54: {
        if (local14 === 0xff) {
          break block54;
        }
        yield* game.setObjectAnimation(local15, 2);
        local14 = 255;
        yield* game.native81(local15, shiftRight(local0, 8));
        break block54;
      }
      break block180;
    }
    if ((yield* script(0x241, local15, 0x64, 0x3c, 0x32, 0xc, local14)) === 0) {
      local17 = 0;
      loop204: for (;;) {
        block434: {
          if (!less(yield* game.getDistanceToPlayer(local15), 0x64)) {
            if (((yield* game.wait(0x801, 0xc)) & 0x800) === 0) {
              break block434;
            }
            return 0xffff;
          }
          block413: {
            if ((yield* game.getDistanceToPlayer(local15)) <= 0xa) {
              const t9 = yield* game.chooseEnemyTarget(local15);
              local16 = t9 & 0xff;
              if (t9 === 0xffff) {
                break block413;
              }
              yield* game.setObjectAnimation(local15, 5);
              yield* game.turnObjectToPlayer(local15);
              yield* game.playSoundEffect(local15, 2, 0xff, 0xff);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                const t10 = local12 & 0xff;
                const t11 = shiftRight(local12, 8);
                const t12 = local10 & 0xff;
                const t13 = shiftRight(local10, 8);
                const t14 = yield* game.getPlayerObjectCopy();
                const t15 = local15;
                yield* game.shootAtObject(t15, t14, t13, t12, t11, t10);
                if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) > 5) {
                  break block413;
                }
                return 0xffff;
              }
              return 0xffff;
            }
            block321: {
              const t2 = yield* game.chooseEnemyTarget(local15);
              local16 = t2 & 0xff;
              if (t2 === 0xffff) {
                break block321;
              }
              yield* game.setObjectAnimation(local15, 4);
              yield* game.turnObjectToPlayer(local15);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                block281: {
                  if (!less(local17, 9)) {
                    break block281;
                  }
                  yield* game.playSoundEffect(local15, 0x42, 0xff, 0xff);
                  break block281;
                }
                const t3 = local8 & 0xff;
                const t4 = shiftRight(local8, 8);
                const t5 = local6 & 0xff;
                const t6 = shiftRight(local6, 8);
                const t7 = yield* game.getPlayerObjectCopy();
                const t8 = local15;
                yield* game.shootAtObject(t8, t7, t6, t5, t4, t3);
                if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) > 5) {
                  break block321;
                }
                return 0xffff;
              }
              return 0xffff;
            }
            break block413;
          }
          break block434;
        }
        if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
          if (
            (truth(local17 === 5) |
              (truth(less(yield* game.getObjectRecordCount(local15), 0xc)) &
                truth(local14 !== 0xff))) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local17 = word(local17 + 1) & 0xff;
          continue loop204;
        }
        return 0xffff;
      }
    } else {
      return 0xffff;
    }
  }
  const t16 = arg6;
  const t17 = arg5;
  const t18 = arg4;
  const t19 = arg3;
  const t20 = arg2;
  const t21 = arg1;
  local0 = arg0;
  local2 = t21;
  local4 = t20;
  local6 = t19;
  local8 = t18;
  local10 = t17;
  local12 = t16;
  local15 = local0 & 0xff & 0xff;
  local14 = 0;
  loop512: for (;;) {
    if ((yield* sub17()) === 0) {
      continue loop512;
    }
    if ((yield* game.getObjectRecordCount(local15)) !== 0) {
      return 0xffff;
    }
    return 0;
  }
}

// Script 1A1: 1 argument.
export function* script1A1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
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

// Script 1A2: 5 arguments.
export function* script1A2(state, arg0, arg1, arg2, arg3, arg4) {
  const locals = new Uint8Array(13);
  function* sub47(in0) {
    block63: {
      locals[9] = in0 & 0xff;
      if (signed(localByte(locals, 3)) === 0) {
        break block63;
      }
      yield* game.playSoundEffect(localByte(locals, 0), 0x46, localByte(locals, 9), 0xc);
      break block63;
    }
    return;
  }
  function* sub13(in0, in1) {
    block39: {
      const t1 = in1;
      setLocalWord(locals, 9, in0);
      setLocalWord(locals, 11, t1);
      if (signed(localByte(locals, 4)) === 0) {
        yield* game.setObjectVelocity(localByte(locals, 0), localWord(locals, 11), 0, 0);
        break block39;
      }
      yield* game.setObjectVelocity(localByte(locals, 0), 0, localWord(locals, 11), 0);
      break block39;
    }
    yield* game.wait(1, localWord(locals, 9));
    return;
  }
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  locals[0] = arg0 & 0xff;
  locals[1] = t5 & 0xff;
  locals[2] = t4 & 0xff;
  locals[3] = t3 & 0xff;
  locals[4] = t2 & 0xff;
  locals[8] =
    truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x15))) & 0xff;
  loop73: for (;;) {
    block103: {
      locals[5] = 0xffff & 0xff;
      if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x80) === 0) {
        yield* game.placeObjectOnWaypoint(localByte(locals, 0), localByte(locals, 2));
        break block103;
      }
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), localByte(locals, 1));
      locals[5] = 0 & 0xff;
      break block103;
    }
    block264: {
      yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0x7f);
      if (signed(localByte(locals, 5)) === 0) {
        break block264;
      }
      yield* game.wait(1, 0xc8);
      locals[7] = 0x14 & 0xff;
      loop124: for (;;) {
        yield* game.wait(1, 0xa);
        yield* sub47(0x50);
        const t6 = word(localByte(locals, 7) - 1);
        locals[7] = t6 & 0xff;
        if (t6 !== 0) {
          continue loop124;
        }
        locals[7] = 0xe & 0xff;
        loop151: for (;;) {
          yield* sub13(0xa, 8);
          yield* sub47(0x50);
          const t7 = word(localByte(locals, 7) - 1);
          locals[7] = t7 & 0xff;
          if (t7 !== 0) {
            continue loop151;
          }
          yield* sub47(0x50);
          yield* sub13(0xa, 7);
          yield* sub47(0x46);
          yield* sub13(0xa, 6);
          yield* sub47(0x3c);
          yield* sub13(0xa, 5);
          yield* sub47(0x32);
          yield* sub13(0xa, 4);
          yield* sub47(0x28);
          yield* sub13(0xa, 3);
          yield* sub47(0x1e);
          yield* sub13(0xa, 2);
          yield* sub47(0);
          yield* sub13(0xa, 1);
          yield* sub13(0x124, 0);
          break block264;
        }
      }
    }
    block281: {
      yield* game.wait(1, 0x14);
      if (signed(localByte(locals, 8)) !== 0) {
        break block281;
      }
      yield* sub47(0x14);
      break block281;
    }
    block298: {
      yield* sub13(0xa, 1);
      if (signed(localByte(locals, 8)) !== 0) {
        break block298;
      }
      yield* sub47(0x28);
      break block298;
    }
    block315: {
      yield* sub13(0xa, 2);
      if (signed(localByte(locals, 8)) !== 0) {
        break block315;
      }
      yield* sub47(0x32);
      break block315;
    }
    block332: {
      yield* sub13(0xa, 3);
      if (signed(localByte(locals, 8)) !== 0) {
        break block332;
      }
      yield* sub47(0x3c);
      break block332;
    }
    block349: {
      yield* sub13(0xa, 4);
      if (signed(localByte(locals, 8)) !== 0) {
        break block349;
      }
      yield* sub47(0x46);
      break block349;
    }
    block366: {
      yield* sub13(0xa, 5);
      if (signed(localByte(locals, 8)) !== 0) {
        break block366;
      }
      yield* sub47(0x50);
      break block366;
    }
    block383: {
      yield* sub13(0xa, 6);
      if (signed(localByte(locals, 8)) !== 0) {
        break block383;
      }
      yield* sub47(0x5a);
      break block383;
    }
    block400: {
      yield* sub13(0xa, 7);
      if (signed(localByte(locals, 8)) !== 0) {
        break block400;
      }
      yield* sub47(0x64);
      break block400;
    }
    block422: {
      if (signed(localByte(locals, 4)) === 0) {
        yield* game.setObjectVelocity(localByte(locals, 0), 8, 0, 0);
        break block422;
      }
      yield* game.setObjectVelocity(localByte(locals, 0), 0, 8, 0);
      break block422;
    }
    locals[6] = 0x64 & 0xff;
    loop426: for (;;) {
      block443: {
        locals[6] = word(localByte(locals, 6) - 5) & 0xff;
        if (signed(localByte(locals, 8)) !== 0) {
          break block443;
        }
        yield* sub47(localByte(locals, 6));
        break block443;
      }
      yield* game.wait(1, 0xa);
      if (localByte(locals, 6) !== 0) {
        continue loop426;
      }
      yield* game.clearObjectVelocity(localByte(locals, 0));
      continue loop73;
    }
  }
}

// Script 1A3: no arguments.
export function* script1A3(state) {
  block71: {
    if ((yield* game.question(0x18, 8)) === 0) {
      yield* game.topicText(0xc1);
      break block71;
    }
    block64: {
      if ((yield* game.payNuyen(0x64)) === 0) {
        yield* game.topicText(0xc0);
        break block64;
      }
      block57: {
        if (less(yield* game.getActorStateCount(0x395), 6)) {
          yield* game.addActorStateCount(0x395, 1);
          yield* game.setActorStateHolder(0x395, 0x8b2);
          yield* game.topicText(0xbf);
          break block57;
        }
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xc2);
        break block57;
      }
      break block64;
    }
    break block71;
  }
  return null;
}

// Script 1A4: 1 argument.
export function* script1A4(state, arg0) {
  let local0 = 0;
  block15: {
    local0 = arg0 & 0xff;
    if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
      break block15;
    }
    yield* game.setObjectRecordFlags(local0, 0xa);
    break block15;
  }
  yield* script(0x083, local0, 0xffff, 3, 3, 1, 2, 2);
  return null;
}

// Script 1A5: 1 argument.
export function* script1A5(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block63: {
    local0 = arg0 & 0xff;
    const t1 = yield* game.getActorStateFlags(0x63c);
    local1 = t1 & 0xff;
    if ((truth((t1 & 1) !== 0) & (truth((local1 & 0x80) !== 0) ^ 0xffff)) === 0) {
      break block63;
    }
    yield* game.setActorStateHolder(0x230, 0x1538);
    yield* game.setActorStateFlagBits(0x63c, 0x80);
    yield* game.keepActorStateFlagBits(0x63c, 0xfffe);
    yield* game.playSoundEffect(local0, 0xa, 0xff, 3);
    yield* game.wait(1, 0x3c);
    break block63;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 1A6: 1 argument.
export function* script1A6(state, arg0) {
  let local0 = 0;
  block21: {
    local0 = arg0 & 0xff;
    if ((yield* game.getStoryStage()) !== 1) {
      yield* script(0x2b5, local0);
      break block21;
    }
    yield* script(0x1dc, local0);
    break block21;
  }
  return null;
}

// Script 1A7: 1 argument.
export function* script1A7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 1, 8, 3, 4);
  return null;
}

// Script 1A8: 1 argument.
export function* script1A8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 2, 2);
  return null;
}

// Script 1A9: 1 argument.
export function* script1A9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectFlags(local0, 0);
  yield* game.playSoundEffect(local0, 0x60, 0xff, 3);
  yield* game.setObjectActionAndDirection(local0, 1, 5);
  const t1 = word(((yield* game.randomByte()) & 7) - 3);
  const t2 = word(((yield* game.randomByte()) & 7) - 3);
  const t3 = local0;
  yield* game.setObjectVelocity(t3, t2, t1, 5);
  yield* game.wait(1, 0x78);
  yield* game.removeObject(local0);
  return null;
}

// Script 1AA: 1 argument.
export function* script1AA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, 0x1e);
  loop7: for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getActorStateFlags(0x16c0)) & 0x80) === 0) {
      continue loop7;
    }
    yield* game.wait(1, 0x64);
    yield* script(0x1c2, yield* script(0x0ab, local0, 1, 0, 0x10));
    return null;
  }
}

// Script 1AB: 1 argument.
export function* script1AB(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  function* sub5() {
    const t1 = yield* script(0x1b4, local0);
    local3 = t1 & 0xff;
    const t2 = shiftLeft(word((yield* game.getObjectCoarseHeight(t1)) + 8), 2);
    const t3 = shiftLeft(
      word((yield* game.getObjectCoarseY(local3)) + (yield* game.randomBelow(8))),
      2,
    );
    const t4 = shiftLeft(
      word(word((yield* game.getObjectCoarseX(local3)) - 8) - (yield* game.randomBelow(4))),
      2,
    );
    const t5 = local3;
    yield* game.setObjectPosition(t5, t4, t3, t2);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  yield* game.setObjectFlagBits(local0, 0x80);
  loop64: for (;;) {
    block162: {
      yield* game.wait(0x80, 0);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        local1 = yield* game.randomBelow(8);
        yield* game.setObjectRecordFlagBits(local0, 1);
        if (local1 <= 6) {
          if (local1 <= 3) {
            yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
            yield* script(0x38e);
            break block162;
          }
          const t6 = word((yield* game.getObjectCoarseHeight(local0)) + 5);
          const t7 = word((yield* game.getObjectCoarseY(local0)) + 5);
          const t8 = word((yield* game.getObjectCoarseX(local0)) - 0xa);
          yield* game.createObject(0x14, t8, t7, t6, 0x262);
          break block162;
        }
        yield* sub5();
        yield* sub5();
        yield* sub5();
        break block162;
      }
      yield* script(0x38e);
      break block162;
    }
    continue loop64;
  }
}

// Script 1AC: 1 argument.
export function* script1AC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* script(0x08e, local0, 4, 0xa, 8, 3, 0x1c2);
  yield* game.removeObject(local0);
  return null;
}

// Script 1AD: 5 arguments.
export function* script1AD(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0;
  const t1 = arg4;
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4 & 0xff;
  local2 = t3;
  local4 = t2;
  local6 = t1;
  yield* game.wait(1, 6);
  if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
    block472: {
      if ((yield* game.getObjectRecordCount(local0)) !== 0) {
        if (state.word('GROUP_LEADER_ONLY') === 0) {
          yield* script(0x209, local0);
          local11 = 0;
          if ((yield* game.getGroupMemberPosition(local0)) <= 0) {
            break block472;
          }
          yield* game.keepObjectFlagBits(local0, 0xfe9f);
          yield* game.clearObjectVelocity(local0);
          local12 = 0;
          loop88: for (;;) {
            block467: {
              if ((yield* game.hasFightTarget()) === 0) {
                block458: {
                  yield* game.placeObjectInFormation(local0);
                  const t6 = yield* game.wait(0x883 | local6, 1);
                  local12 = t6;
                  if ((t6 & 0x682) === 0) {
                    break block458;
                  }
                  if ((local12 & 2) === 0) {
                    if ((local12 & 0x600) === 0) {
                      if ((local12 & 0x80) === 0) {
                        break block458;
                      }
                      yield* game.statusScreen(local0);
                      break block458;
                    }
                    local12 = yield* script(0x29f, local0, 0x1e, 0x1e);
                    break block458;
                  }
                  yield* game.talk(local0, local4);
                  break block458;
                }
                local11 = truth((local12 & 0x800) !== 0) & 0xff;
                break block467;
              }
              block380: {
                if ((yield* game.hasNoObjectAnimation(local0)) === 0) {
                  local8 = (yield* game.chooseRandomFightTarget(local0)) & 0xff;
                  local10 = 0;
                  loop116: for (;;) {
                    block350: {
                      if ((local12 & 0x4000) === 0) {
                        if ((local12 & 0x600) === 0) {
                          if ((local12 & 0x80) === 0) {
                            block268: {
                              if ((local12 & 0x2000) === 0) {
                                break block268;
                              }
                              yield* script(0x253);
                              const t5 = yield* game.chooseUnderGlove(local0);
                              local9 = t5 & 0xff;
                              if (t5 === 0xffff) {
                                break block268;
                              }
                              local8 = signed(local9) & 0xff;
                              break block268;
                            }
                            if (signed(local8) === 0xffff) {
                              yield* game.setObjectAnimation(local0, 2);
                              yield* game.placeObjectInFormation(local0);
                              local12 = yield* game.wait(0x4881 | local6, 1);
                              break block350;
                            }
                            block298: {
                              if (local6 !== 0x600) {
                                yield* game.setObjectAnimation(local0, 4);
                                break block298;
                              }
                              yield* game.setObjectAnimation(local0, 5);
                              break block298;
                            }
                            yield* game.setObjectFlagBits(local0, 0x40);
                            local10 =
                              (yield* game.shootWithOwnWeapon(local0, signed(local8))) & 0xff;
                            local12 = yield* game.wait(0x6881 | local6, local2);
                            yield* game.keepObjectFlagBits(local0, 0xffbf);
                            break block350;
                          }
                          yield* game.statusScreen(local0);
                          local12 = yield* game.wait(0x6881, 1);
                          break block350;
                        }
                        local12 = yield* script(0x29f, local0, 0x1e, 0x1e);
                        break block350;
                      }
                      yield* game.setObjectAnimation(local0, 2);
                      yield* game.setObjectFlagBits(local0, 0x60);
                      yield* game.choosePlace(local0);
                      loop139: for (;;) {
                        block177: {
                          local12 = yield* game.wait(0x6885 | local6, 0xf);
                          if (
                            (truth(((yield* game.getObjectFlags(local0)) & 8) !== 0) &
                              truth(local12 === 1)) ===
                            0
                          ) {
                            break block177;
                          }
                          yield* game.stopMotion(local0);
                          yield* game.clearObjectVelocity(local0);
                          local12 = 4;
                          break block177;
                        }
                        if (local12 === 1) {
                          continue loop139;
                        }
                        yield* game.keepObjectFlagBits(local0, 0xff9f);
                        break block350;
                      }
                    }
                    local11 = truth((local12 & 0x800) !== 0) & 0xff;
                    if (
                      (signed(local10) |
                        signed(local11) |
                        ((yield* game.canAttack(local0, signed(local8))) ^ 0xffff)) ===
                      0
                    ) {
                      continue loop116;
                    }
                    yield* game.stopMotion(local0);
                    yield* game.clearObjectVelocity(local0);
                    break block380;
                  }
                } else {
                  local11 = (yield* script(0x194, local0)) & 0xff;
                  break block380;
                }
              }
              break block467;
            }
            if (signed(local11) === 0) {
              continue loop88;
            }
            break block472;
          }
        } else {
          yield* game.removeObject(local0);
          return null;
        }
      } else {
        local11 = 255;
        break block472;
      }
    }
    block526: {
      yield* script(0x331, local0);
      if (signed(local11) === 0) {
        yield* script(0x194, local0);
        yield* game.turnObjectToPlayer(local0);
        yield* game.wait(1, 0x14);
        yield* game.notice(3, 3, 0x19, 4, 0x400, 0x140, 1);
        yield* game.confirmKey();
        yield* game.removeObject(local0);
        break block526;
      }
      yield* script(0x068, local0);
      break block526;
    }
    return null;
  }
  yield* script(0x331, local0);
  yield* game.removeObject(local0);
  return null;
}

// Script 1AE: 1 argument.
export function* script1AE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, 0x1e);
  loop7: for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getActorStateFlags(0x16c0)) & 0x80) === 0) {
      continue loop7;
    }
    yield* game.wait(1, 0x64);
    yield* script(0x1c2, yield* script(0x0ab, local0, 1, 0, 0x10));
    return null;
  }
}

// Script 1AF: 1 argument.
export function* script1AF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x403, 0x1e03);
  return null;
}

// Script 1B0: 1 argument.
export function* script1B0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.wait(1, 0xf);
  loop20: for (;;) {
    yield* game.blast(local0, 0x14);
    if (((yield* game.wait(9, 0xf)) & 8) === 0) {
      continue loop20;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1B1: 1 argument.
export function* script1B1(state, arg0) {
  let local0 = 0,
    local2 = 0;
  block44: {
    local0 = arg0;
    if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
      local2 = 0xb;
      break block44;
    }
    block37: {
      if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
        local2 = 0xd;
        break block37;
      }
      local2 = 0xc;
      break block37;
    }
    break block44;
  }
  yield* game.notice(2, 0x15, 0x13, 3, 0x800, local2, 0x78);
  return null;
}

// Script 1B2: 1 argument.
export function* script1B2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x100);
  loop8: for (;;) {
    block237: {
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.setObjectActionAndDirection(local0, 2, 5);
        loop37: for (;;) {
          yield* game.wait(1, 5);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
            continue loop37;
          }
          yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
          yield* game.keepObjectRecordFlagBits(local0, 0x7f);
          yield* game.setObjectAnimation(local0, 4);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(local0, 0);
          loop83: for (;;) {
            yield* game.wait(1, 5);
            if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
              continue loop83;
            }
            yield* game.keepObjectRecordFlagBits(local0, 0x7f);
            yield* game.setObjectAnimation(local0, 6);
            yield* game.wait(8, 0);
            yield* game.setObjectAnimation(local0, 2);
            yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
            loop130: for (;;) {
              block164: {
                yield* game.setObjectAnimation(local0, 2);
                yield* game.wait(0x200, 0);
                if (((yield* game.getObjectRecordFlags(local0)) & 2) !== 0) {
                  break block164;
                }
                yield* game.setActorStateFlagBits(0x7ee, 2);
                yield* game.setObjectRecordFlagBits(local0, 2);
                break block164;
              }
              yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
              yield* game.setObjectAnimation(local0, 4);
              yield* game.wait(1, 0xa);
              if ((yield* game.testObjectCollision(local0, 0)) === 0) {
                yield* game.wait(8, 0);
                yield* script(0x074, local0, 0, 6, 2, 0x2e);
                break block237;
              }
              yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
              yield* game.wait(1, 5);
              yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
              continue loop130;
            }
          }
        }
      } else {
        yield* script(0x2b5, local0);
        break block237;
      }
    }
    continue loop8;
  }
}

// Script 1B3: 1 argument.
export function* script1B3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.resetObjectRecordProperty(local0);
  yield* game.setScriptVariable(2, 0);
  yield* game.setScriptVariable(4, 0);
  yield* game.setScriptVariable(0xa, 0);
  yield* game.setScriptVariable(0xe, 0);
  yield* game.setScriptVariable(0x16, 0);
  yield* game.setScriptVariable(0x18, 0);
  yield* game.setScriptVariable(0x20, 3);
  yield* game.setScriptVariable(0x22, 7);
  yield* game.setScriptVariable(0x24, 1);
  yield* game.setScriptVariable(0x26, 0);
  yield* game.setScriptVariable(0x28, 0);
  yield* game.setScriptVariable(0x2c, 0);
  yield* game.setScriptVariable(0x32, 0);
  yield* game.wait(1, 6);
  loop80: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop80;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.notice(2, 0x11, 0xf, 3, 0x800, 0x40, 0xf0);
    yield* game.wait(1, 0x8c);
    yield* game.notice(4, 0x14, 0x11, 3, 0x800, 0x41, 0xf0);
    yield* game.wait(1, 0x8c);
    yield* game.notice(6, 0x17, 0x12, 3, 0x800, 0x42, 0xf0);
    yield* game.addSceneObject(0xb, 0x166, 0x1f5, 0x40, 6, 0x8b2, 0x32);
    yield* game.wait(1, 1);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1B4: 1 argument, returns a word.
export function* script1B4(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = word((yield* game.getObjectCoarseY(local0)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 1);
  local1 = (yield* game.createObject(0x9e, t3, t2, t1, 0x15c)) & 0xff;
  const t4 = yield* game.getSpriteMode(local0);
  const t5 = local1;
  yield* game.setSpriteMode(t5, t4);
  return local1;
}

// Script 1B5: no arguments.
export function* script1B5(state) {
  const t1 = yield* script(0x03f, 0x1388, 0x1194, 0xfa0);
  const t2 = yield* script(0x0b2, 0x189, 0x18a, 0x18b);
  yield* script(0x162, 0x15d2, t2, t1, 0x188, 0x187);
  return null;
}

// Script 1B6: 1 argument.
export function* script1B6(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectArmour(local0, 3);
  yield* game.setObjectRecordCount(local0, 0x1e);
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.appendToFightList(local0);
  yield* game.wait(1, 0x50);
  loop28: for (;;) {
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = yield* game.getObjectCoarseY(local0);
    const t3 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0x78, t3, t2, t1, 0x3e);
    const t4 = truth(
      ((yield* game.wait(0x801, word(0x64 + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !== 0,
    );
    local1 = t4 & 0xff;
    if (t4 === 0) {
      continue loop28;
    }
    yield* game.fightListRemove(local0);
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    yield* game.setActorStateFlagBits(0x222, 1);
    return null;
  }
}

// Script 1B7: no arguments.
export function* script1B7(state) {
  yield* script(0x10e, 0xc7);
  return null;
}

// Script 1B8: 1 argument.
export function* script1B8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.wait(1, 1);
  yield* game.updateObjectDepthMode(local0);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 1B9: 1 argument.
export function* script1B9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x601, 0x2803);
  return null;
}

// Script 1BA: 1 argument, returns a word.
export function* script1BA(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = word((yield* game.getObjectCoarseY(local0)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 1);
  local1 = (yield* game.createObject(0x9e, t3, t2, t1, 0x15e)) & 0xff;
  const t4 = yield* game.getSpriteMode(local0);
  const t5 = local1;
  yield* game.setSpriteMode(t5, t4);
  return local1;
}

// Script 1BB: 1 argument.
export function* script1BB(state, arg0) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  block96: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block96;
    }
    const t1 = yield* game.scriptAction(0xc0);
    local2 = t1;
    if ((t1 & 0x80) === 0) {
      if ((local2 & 0x40) === 0) {
        break block96;
      }
      yield* script(0x240);
      const t2 = yield* game.chooseNumber();
      local4 = t2;
      if (t2 === 0xffff) {
        break block96;
      }
      if (local4 !== 0x149) {
        yield* script(0x1b1, local4);
        break block96;
      }
      yield* game.setItemPropertyAndUnequip(local0, local4);
      break block96;
    }
    yield* game.notice(2, 0x14, 0x19, 3, 0x800, 0x83, 0xf0);
    yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    break block96;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1BC: 1 argument, returns a word.
export function* script1BC(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = word((yield* game.getObjectCoarseY(local0)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 1);
  local1 = (yield* game.createObject(0x9e, t3, t2, t1, 0x15f)) & 0xff;
  const t4 = yield* game.getSpriteMode(local0);
  const t5 = local1;
  yield* game.setSpriteMode(t5, t4);
  return local1;
}

// Script 1BD: no arguments.
export function* script1BD(state) {
  block34: {
    if ((yield* game.getActorStateProperty(0x1952)) !== 0x8b2) {
      yield* game.topicText(0xb5);
      yield* script(0x04b);
      yield* game.setActorStateHolder(0, 0x8b2);
      break block34;
    }
    yield* game.topicText(0xb6);
    break block34;
  }
  return null;
}

// Script 1BE: 1 argument.
export function* script1BE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 6, 6);
  return null;
}

// Script 1BF: 1 argument.
export function* script1BF(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block106: {
    local0 = arg0 & 0xff;
    local1 = 0;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      if (((yield* game.getObjectRecordFlags(local0)) & 8) === 0) {
        yield* game.placeObjectOnWaypoint(local0, 1);
        yield* game.setObjectActionAndDirection(local0, 0, 0);
        loop51: for (;;) {
          block101: {
            if (((yield* game.wait(0x90, 0)) & 0x80) === 0) {
              yield* game.setObjectRecordFlagBits(local0, 8);
              yield* game.setObjectRecordPropertyFromGroup(local0);
              yield* script(0x04b);
              yield* game.removeObject(local0);
              local1 = 255;
              break block101;
            }
            yield* game.notice(2, 0x15, 0x11, 3, 0x800, 0x26, 0xf0);
            break block101;
          }
          if (signed(local1) === 0) {
            continue loop51;
          }
          break block106;
        }
      } else {
        yield* game.removeObject(local0);
        break block106;
      }
    } else {
      yield* script(0x011, local0, 6, 3, 1, 1);
      break block106;
    }
  }
  return null;
}
