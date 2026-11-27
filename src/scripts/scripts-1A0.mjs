// Scripts 1A0 to 1BF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  localByte,
  localWord,
  setLocalWord,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

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
    object = 0,
    local16 = 0,
    local17 = 0;
  function* sub17() {
    if (!less(yield* game.getObjectRecordCount(object), 0xc)) {
      yield* game.setObjectAnimation(object, 2);
      if (local14 !== 1) {
        if (local14 !== 3) {
          if (local14 !== 5) {
            if (local14 !== 7) {
              const t1 = yield* game.chooseEnemyTarget(object);
              local16 = t1 & 0xff;
              if (t1 === 0xffff) {
                yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
              } else {
                yield* game.moveObjectStraightToPlayer(object);
              }
            } else {
              yield* game.moveObjectStraightToWaypoint(object, local4 & 0xff);
            }
          } else {
            yield* game.moveObjectStraightToWaypoint(object, shiftRight(local4, 8));
          }
        } else {
          yield* game.moveObjectStraightToWaypoint(object, local2 & 0xff);
        }
      } else {
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local2, 8));
      }
      local14 = word(local14 + 1) & 7 & 0xff;
    } else {
      if (local14 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local14 = 255;
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.script241(object, 0x64, 0x3c, 0x32, 0xc, local14)) === 0) {
      local17 = 0;
      for (;;) {
        if (!less(yield* game.getDistanceToPlayer(object), 0x64)) {
          if (((yield* game.wait(0x801, 0xc)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          if ((yield* game.getDistanceToPlayer(object)) <= 0xa) {
            const t3 = yield* game.chooseEnemyTarget(object);
            local16 = t3 & 0xff;
            if (t3 !== 0xffff) {
              yield* game.setObjectAnimation(object, 5);
              yield* game.turnObjectToPlayer(object);
              yield* game.playSoundEffect(object, 2, 0xff, 0xff);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                yield* game.shootAtObject(
                  object,
                  yield* game.getPlayerObjectCopy(),
                  shiftRight(local10, 8),
                  local10 & 0xff,
                  shiftRight(local12, 8),
                  local12 & 0xff,
                );
                if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
                  return 0xffff;
                }
              } else {
                return 0xffff;
              }
            }
          } else {
            const t2 = yield* game.chooseEnemyTarget(object);
            local16 = t2 & 0xff;
            if (t2 !== 0xffff) {
              yield* game.setObjectAnimation(object, 4);
              yield* game.turnObjectToPlayer(object);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                if (less(local17, 9)) {
                  yield* game.playSoundEffect(object, 0x42, 0xff, 0xff);
                }
                yield* game.shootAtObject(
                  object,
                  yield* game.getPlayerObjectCopy(),
                  shiftRight(local6, 8),
                  local6 & 0xff,
                  shiftRight(local8, 8),
                  local8 & 0xff,
                );
                if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
                  return 0xffff;
                }
              } else {
                return 0xffff;
              }
            }
          }
        }
        if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
          if (
            (truth(local17 === 5) |
              truth(less(yield* game.getObjectRecordCount(object), 0xc) && local14 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local17 = word(local17 + 1) & 0xff;
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
  local6 = arg3;
  local8 = arg4;
  local10 = arg5;
  local12 = arg6;
  object = local0 & 0xff & 0xff;
  local14 = 0;
  for (;;) {
    if ((yield* sub17()) !== 0) {
      if ((yield* game.getObjectRecordCount(object)) !== 0) {
        return 0xffff;
      }
      return 0;
    }
  }
}

// Script 1A1: 1 argument.
export function* script1A1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  for (;;) {
    if ((yield* game.wait(0x201, 1)) !== 1) {
      yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xf0);
    }
  }
}

// Script 1A2: 5 arguments.
export function* script1A2(state, arg0, arg1, arg2, arg3, arg4) {
  const locals = new Uint8Array(13);
  function* sub47(in0) {
    locals[9] = in0 & 0xff;
    if (signed(localByte(locals, 3)) !== 0) {
      yield* game.playSoundEffect(localByte(locals, 0), 0x46, localByte(locals, 9), 0xc);
    }
  }
  function* sub13(in0, in1) {
    setLocalWord(locals, 9, in0);
    setLocalWord(locals, 11, in1);
    if (signed(localByte(locals, 4)) === 0) {
      yield* game.setObjectVelocity(localByte(locals, 0), localWord(locals, 11), 0, 0);
    } else {
      yield* game.setObjectVelocity(localByte(locals, 0), 0, localWord(locals, 11), 0);
    }
    yield* game.wait(1, localWord(locals, 9));
  }
  locals[0] = arg0 & 0xff;
  locals[1] = arg1 & 0xff;
  locals[2] = arg2 & 0xff;
  locals[3] = arg3 & 0xff;
  locals[4] = arg4 & 0xff;
  locals[8] =
    truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x15))) & 0xff;
  loop73: for (;;) {
    locals[5] = 0xffff & 0xff;
    if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x80) === 0) {
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), localByte(locals, 2));
    } else {
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), localByte(locals, 1));
      locals[5] = 0 & 0xff;
    }
    block264: {
      yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0x7f);
      if (signed(localByte(locals, 5)) !== 0) {
        yield* game.wait(1, 0xc8);
        locals[7] = 0x14 & 0xff;
        for (;;) {
          yield* game.wait(1, 0xa);
          yield* sub47(0x50);
          const t1 = word(localByte(locals, 7) - 1);
          locals[7] = word(localByte(locals, 7) - 1) & 0xff;
          if (t1 === 0) {
            locals[7] = 0xe & 0xff;
            for (;;) {
              yield* sub13(0xa, 8);
              yield* sub47(0x50);
              const t2 = word(localByte(locals, 7) - 1);
              locals[7] = word(localByte(locals, 7) - 1) & 0xff;
              if (t2 === 0) {
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
        }
      }
    }
    yield* game.wait(1, 0x14);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x14);
    }
    yield* sub13(0xa, 1);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x28);
    }
    yield* sub13(0xa, 2);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x32);
    }
    yield* sub13(0xa, 3);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x3c);
    }
    yield* sub13(0xa, 4);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x46);
    }
    yield* sub13(0xa, 5);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x50);
    }
    yield* sub13(0xa, 6);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x5a);
    }
    yield* sub13(0xa, 7);
    if (signed(localByte(locals, 8)) === 0) {
      yield* sub47(0x64);
    }
    if (signed(localByte(locals, 4)) === 0) {
      yield* game.setObjectVelocity(localByte(locals, 0), 8, 0, 0);
    } else {
      yield* game.setObjectVelocity(localByte(locals, 0), 0, 8, 0);
    }
    locals[6] = 0x64 & 0xff;
    for (;;) {
      locals[6] = word(localByte(locals, 6) - 5) & 0xff;
      if (signed(localByte(locals, 8)) === 0) {
        yield* sub47(localByte(locals, 6));
      }
      yield* game.wait(1, 0xa);
      if (localByte(locals, 6) === 0) {
        yield* game.clearObjectVelocity(localByte(locals, 0));
        continue loop73;
      }
    }
  }
}

// Script 1A3: no arguments.
export function* script1A3(state) {
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0xc1 /* "Well, you know where to find me." */);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.topicText(
        0xc0 /* "If I gave you credit, Jake, what's to say you'll live long e..." */,
      );
    } else {
      if (less(yield* game.getActorStateCount(0x395), 6)) {
        yield* game.addActorStateCount(0x395, 1);
        yield* game.setActorStateHolder(0x395, 0x8b2);
        yield* game.topicText(
          0xbf /* "There you go, Jake. You can't always find a street doc when ..." */,
        );
      } else {
        yield* game.addNuyen(0x64);
        yield* game.topicText(
          0xc2 /* "I think you've already got enough of these, Jake. My other p..." */,
        );
      }
    }
  }
  return null;
}

// Script 1A4: 1 argument.
export function* script1A4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.script083(object, 0xffff, 3, 3, 1, 2, 2);
  return null;
}

// Script 1A5: 1 argument.
export function* script1A5(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getActorStateFlags(0x63c);
  local1 = t1 & 0xff;
  if ((truth((t1 & 1) !== 0) & (truth((local1 & 0x80) !== 0) ^ 0xffff)) !== 0) {
    yield* game.setActorStateHolder(0x230, 0x1538);
    yield* game.setActorStateFlagBits(0x63c, 0x80);
    yield* game.keepActorStateFlagBits(0x63c, 0xfffe);
    yield* game.playSoundEffect(object, 0xa, 0xff, 3);
    yield* game.wait(1, 0x3c);
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 1A6: 1 argument.
export function* script1A6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getStoryStage()) !== 1) {
    yield* run.script2B5(local0);
  } else {
    yield* run.script1DC(local0);
  }
  return null;
}

// Script 1A7: 1 argument.
export function* script1A7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveWeapon(local0, 1, 8, 3, 4);
  return null;
}

// Script 1A8: 1 argument.
export function* script1A8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveArmour(local0, 2, 2);
  return null;
}

// Script 1A9: 1 argument.
export function* script1A9(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectFlags(object, 0);
  yield* game.playSoundEffect(object, 0x60, 0xff, 3);
  yield* game.setObjectActionAndDirection(object, 1, 5);
  const t1 = word(((yield* game.randomByte()) & 7) - 3);
  const t2 = word(((yield* game.randomByte()) & 7) - 3);
  yield* game.setObjectVelocity(object, t2, t1, 5);
  yield* game.wait(1, 0x78);
  yield* game.removeObject(object);
  return null;
}

// Script 1AA: 1 argument.
export function* script1AA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, 0x1e);
  for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getActorStateFlags(0x16c0)) & 0x80) !== 0) {
      yield* game.wait(1, 0x64);
      yield* run.dropNuyen164(yield* run.script0AB(object, 1, 0, 0x10));
      return null;
    }
  }
}

// Script 1AB: 1 argument.
export function* script1AB(state, arg0) {
  let object = 0,
    local1 = 0,
    object2 = 0;
  function* sub5() {
    const t1 = yield* run.dropNuyen15C(object);
    object2 = t1 & 0xff;
    const t2 = shiftLeft(word((yield* game.getObjectCoarseHeight(t1)) + 8), 2);
    const t3 = shiftLeft(
      word((yield* game.getObjectCoarseY(object2)) + (yield* game.randomBelow(8))),
      2,
    );
    const t4 = shiftLeft(
      word(word((yield* game.getObjectCoarseX(object2)) - 8) - (yield* game.randomBelow(4))),
      2,
    );
    yield* game.setObjectPosition(object2, t4, t3, t2);
  }
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  yield* game.setObjectFlagBits(object, 0x80);
  for (;;) {
    yield* game.wait(0x80, 0);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      local1 = yield* game.randomBelow(8);
      yield* game.setObjectRecordFlagBits(object, 1);
      if (local1 <= 6) {
        if (local1 <= 3) {
          yield* game.keepObjectRecordFlagBits(object, 0xfffe);
          yield* run.noticeNothingSpecial();
        } else {
          const t5 = word((yield* game.getObjectCoarseHeight(object)) + 5);
          const t6 = word((yield* game.getObjectCoarseY(object)) + 5);
          const t7 = word((yield* game.getObjectCoarseX(object)) - 0xa);
          yield* game.createObject(0x14 /* "Scary Ghoul" */, t7, t6, t5, 0x262);
        }
      } else {
        yield* sub5();
        yield* sub5();
        yield* sub5();
      }
    } else {
      yield* run.noticeNothingSpecial();
    }
  }
}

// Script 1AC: 1 argument.
export function* script1AC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* run.script08E(object, 4, 0xa, 8, 3, 0x1c2);
  yield* game.removeObject(object);
  return null;
}

// Script 1AD: 5 arguments.
export function* script1AD(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2;
  local4 = arg3;
  local6 = arg4;
  yield* game.wait(1, 6);
  if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
    block472: {
      if ((yield* game.getObjectRecordCount(object)) !== 0) {
        if (state.word('GROUP_LEADER_ONLY') === 0) {
          yield* run.script209(object);
          local11 = 0;
          if ((yield* game.getGroupMemberPosition(object)) > 0) {
            yield* game.keepObjectFlagBits(object, 0xfe9f);
            yield* game.clearObjectVelocity(object);
            local12 = 0;
            for (;;) {
              if ((yield* game.hasFightTarget()) === 0) {
                yield* game.placeObjectInFormation(object);
                const t2 = yield* game.wait(0x883 | local6, 1);
                local12 = t2;
                if ((local12 & 0x682) !== 0) {
                  if ((local12 & 2) === 0) {
                    if ((local12 & 0x600) === 0) {
                      if ((local12 & 0x80) !== 0) {
                        yield* game.statusScreen(object);
                      }
                    } else {
                      local12 = yield* run.script29F(object, 0x1e, 0x1e);
                    }
                  } else {
                    yield* game.talk(object, local4);
                  }
                }
                local11 = truth((local12 & 0x800) !== 0) & 0xff;
              } else {
                block380: {
                  if ((yield* game.hasNoObjectAnimation(object)) === 0) {
                    local8 = (yield* game.chooseRandomFightTarget(object)) & 0xff;
                    local10 = 0;
                    for (;;) {
                      block350: {
                        if ((local12 & 0x4000) === 0) {
                          if ((local12 & 0x600) === 0) {
                            if ((local12 & 0x80) === 0) {
                              if ((local12 & 0x2000) !== 0) {
                                yield* run.promptTarget();
                                const t1 = yield* game.chooseUnderGlove(object);
                                local9 = t1 & 0xff;
                                if (t1 !== 0xffff) {
                                  local8 = signed(local9) & 0xff;
                                }
                              }
                              if (signed(local8) === 0xffff) {
                                yield* game.setObjectAnimation(object, 2);
                                yield* game.placeObjectInFormation(object);
                                local12 = yield* game.wait(0x4881 | local6, 1);
                              } else {
                                if (local6 !== 0x600) {
                                  yield* game.setObjectAnimation(object, 4);
                                } else {
                                  yield* game.setObjectAnimation(object, 5);
                                }
                                yield* game.setObjectFlagBits(object, 0x40);
                                local10 =
                                  (yield* game.shootWithOwnWeapon(object, signed(local8))) & 0xff;
                                local12 = yield* game.wait(0x6881 | local6, local2);
                                yield* game.keepObjectFlagBits(object, 0xffbf);
                              }
                            } else {
                              yield* game.statusScreen(object);
                              local12 = yield* game.wait(0x6881, 1);
                            }
                          } else {
                            local12 = yield* run.script29F(object, 0x1e, 0x1e);
                          }
                        } else {
                          yield* game.setObjectAnimation(object, 2);
                          yield* game.setObjectFlagBits(object, 0x60);
                          yield* game.choosePlace(object);
                          for (;;) {
                            local12 = yield* game.wait(0x6885 | local6, 0xf);
                            if (((yield* game.getObjectFlags(object)) & 8) !== 0 && local12 === 1) {
                              yield* game.stopMotion(object);
                              yield* game.clearObjectVelocity(object);
                              local12 = 4;
                            }
                            if (local12 !== 1) {
                              yield* game.keepObjectFlagBits(object, 0xff9f);
                              break block350;
                            }
                          }
                        }
                      }
                      local11 = truth((local12 & 0x800) !== 0) & 0xff;
                      if (
                        (signed(local10) |
                          signed(local11) |
                          ((yield* game.canAttack(object, signed(local8))) ^ 0xffff)) !==
                        0
                      ) {
                        yield* game.stopMotion(object);
                        yield* game.clearObjectVelocity(object);
                        break block380;
                      }
                    }
                  } else {
                    local11 = (yield* run.script194(object)) & 0xff;
                  }
                }
              }
              if (signed(local11) !== 0) {
                break block472;
              }
            }
          }
        } else {
          yield* game.removeObject(object);
          return null;
        }
      } else {
        local11 = 255;
      }
    }
    yield* run.releaseRunner(object);
    if (signed(local11) === 0) {
      yield* run.script194(object);
      yield* game.turnObjectToPlayer(object);
      yield* game.wait(1, 0x14);
      yield* game.notice(
        3,
        3,
        0x19,
        4,
        0x400,
        0x140 /* "It's time for me to leave Jake. I think I have earned my mon..." */,
        1,
      );
      yield* game.confirmKey();
      yield* game.removeObject(object);
    } else {
      yield* run.leaveBody(object);
    }
    return null;
  }
  yield* run.releaseRunner(object);
  yield* game.removeObject(object);
  return null;
}

// Script 1AE: 1 argument.
export function* script1AE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, 0x1e);
  for (;;) {
    yield* game.wait(1, 0xa);
    if (((yield* game.getActorStateFlags(0x16c0)) & 0x80) !== 0) {
      yield* game.wait(1, 0x64);
      yield* run.dropNuyen164(yield* run.script0AB(object, 1, 0, 0x10));
      return null;
    }
  }
}

// Script 1AF: 1 argument.
export function* script1AF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script2AA(local0, 1, 0x203, 0x401, 0x403, 0x1e03);
  return null;
}

// Script 1B0: 1 argument.
export function* script1B0(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.wait(1, 0xf);
  for (;;) {
    yield* game.blast(object, 0x14);
    if (((yield* game.wait(9, 0xf)) & 8) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1B1: 1 argument.
export function* refuseToGiveTo(state, arg0) {
  let local0 = 0,
    local2 = 0;
  local0 = arg0;
  if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
    local2 = 0xb;
  } else {
    if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
      local2 = 0xd;
    } else {
      local2 = 0xc;
    }
  }
  yield* game.notice(2, 0x15, 0x13, 3, 0x800, local2, 0x78);
  return null;
}

// Script 1B2: 1 argument.
export function* script1B2(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    block237: {
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.setObjectRecordFlagBits(object, 1);
        yield* game.setObjectActionAndDirection(object, 2, 5);
        for (;;) {
          yield* game.wait(1, 5);
          if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
            yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
            yield* game.keepObjectRecordFlagBits(object, 0x7f);
            yield* game.setObjectAnimation(object, 4);
            yield* game.wait(8, 0);
            yield* game.setObjectAnimation(object, 0);
            for (;;) {
              yield* game.wait(1, 5);
              if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
                yield* game.keepObjectRecordFlagBits(object, 0x7f);
                yield* game.setObjectAnimation(object, 6);
                yield* game.wait(8, 0);
                yield* game.setObjectAnimation(object, 2);
                yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
                for (;;) {
                  yield* game.setObjectAnimation(object, 2);
                  yield* game.wait(0x200, 0);
                  if (((yield* game.getObjectRecordFlags(object)) & 2) === 0) {
                    yield* game.setActorStateFlagBits(0x7ee, 2);
                    yield* game.setObjectRecordFlagBits(object, 2);
                  }
                  yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
                  yield* game.setObjectAnimation(object, 4);
                  yield* game.wait(1, 0xa);
                  if ((yield* game.testObjectCollision(object, 0)) === 0) {
                    yield* game.wait(8, 0);
                    yield* run.script074(object, 0, 6, 2, 0x2e);
                    break block237;
                  }
                  yield* game.playSoundEffect(object, 0x20, 0xff, 3);
                  yield* game.wait(1, 5);
                  yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
                }
              }
            }
          }
        }
      } else {
        yield* run.script2B5(object);
      }
    }
  }
}

// Script 1B3: 1 argument.
export function* script1B3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.resetObjectRecordProperty(object);
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
  for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(object, 0, 0);
      yield* game.notice(2, 0x11, 0xf, 3, 0x800, 0x40 /* "Oh, Ooooh my head." */, 0xf0);
      yield* game.wait(1, 0x8c);
      yield* game.notice(4, 0x14, 0x11, 3, 0x800, 0x41 /* "My brain feels burnt..." */, 0xf0);
      yield* game.wait(1, 0x8c);
      yield* game.notice(6, 0x17, 0x12, 3, 0x800, 0x42 /* "Where am I? Who am I?" */, 0xf0);
      yield* game.addSceneObject(0xb, 0x166, 0x1f5, 0x40, 6, 0x8b2, 0x32);
      yield* game.wait(1, 1);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1B4: 1 argument, returns a word.
export function* dropNuyen15C(state, arg0) {
  let object = 0,
    created = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
  created = (yield* game.createObject(0x9e /* "Nuyen" */, t3, t2, t1, 0x15c)) & 0xff;
  yield* game.setSpriteMode(created, yield* game.getSpriteMode(object));
  return created;
}

// Script 1B5: no arguments.
export function* script1B5(state) {
  const t1 = yield* run.byNegotiation(0x1388, 0x1194, 0xfa0);
  const t2 = yield* run.byNegotiationB(0x189, 0x18a, 0x18b);
  yield* run.script162(0x15d2, t2, t1, 0x188, 0x187);
  return null;
}

// Script 1B6: 1 argument.
export function* script1B6(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectArmour(object, 3);
  yield* game.setObjectRecordCount(object, 0x1e);
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.appendToFightList(object);
  yield* game.wait(1, 0x50);
  for (;;) {
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = yield* game.getObjectCoarseY(object);
    const t3 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0x78 /* "Jester Spirit" */, t3, t2, t1, 0x3e);
    const t4 = truth(
      ((yield* game.wait(0x801, word(0x64 + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !== 0,
    );
    local1 = t4 & 0xff;
    if (t4 !== 0) {
      yield* game.fightListRemove(object);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      yield* game.setActorStateFlagBits(0x222, 1);
      return null;
    }
  }
}

// Script 1B7: no arguments.
export function* script1B7(state) {
  yield* run.enterWithoutRunners(0xc7);
  return null;
}

// Script 1B8: 1 argument.
export function* script1B8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.wait(1, 1);
  yield* game.updateObjectDepthMode(object);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 1B9: 1 argument.
export function* script1B9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script2AA(local0, 1, 0x203, 0x401, 0x601, 0x2803);
  return null;
}

// Script 1BA: 1 argument, returns a word.
export function* dropNuyen15E(state, arg0) {
  let object = 0,
    created = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
  created = (yield* game.createObject(0x9e /* "Nuyen" */, t3, t2, t1, 0x15e)) & 0xff;
  yield* game.setSpriteMode(created, yield* game.getSpriteMode(object));
  return created;
}

// Script 1BB: 1 argument.
export function* script1BB(state, arg0) {
  let object = 0,
    local2 = 0,
    local4 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    const t1 = yield* game.scriptAction(0xc0);
    local2 = t1;
    if ((local2 & 0x80) === 0) {
      if ((local2 & 0x40) !== 0) {
        yield* run.promptGiveTo();
        const t2 = yield* game.chooseNumber();
        local4 = t2;
        if (local4 !== 0xffff) {
          if (local4 !== 0x149) {
            yield* run.refuseToGiveTo(local4);
          } else {
            yield* game.setItemPropertyAndUnequip(object, local4);
          }
        }
      }
    } else {
      yield* game.notice(
        2,
        0x14,
        0x19,
        3,
        0x800,
        0x83 /* "Engraved on the amulet is a bat." */,
        0xf0,
      );
      yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1BC: 1 argument, returns a word.
export function* dropNuyen15F(state, arg0) {
  let object = 0,
    created = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
  created = (yield* game.createObject(0x9e /* "Nuyen" */, t3, t2, t1, 0x15f)) & 0xff;
  yield* game.setSpriteMode(created, yield* game.getSpriteMode(object));
  return created;
}

// Script 1BD: no arguments.
export function* script1BD(state) {
  if ((yield* game.getActorStateProperty(0x1952)) !== 0x8b2) {
    yield* game.topicText(
      0xb5 /* "Jake! You're still alive!!? You're crazy. Take this weapon. ..." */,
    );
    yield* run.script04B();
    yield* game.setActorStateHolder(0, 0x8b2);
  } else {
    yield* game.topicText(
      0xb6 /* "Jake! You're still alive!!? You're crazy man. You got tech i..." */,
    );
  }
  return null;
}

// Script 1BE: 1 argument.
export function* script1BE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveArmour(local0, 6, 6);
  return null;
}

// Script 1BF: 1 argument.
export function* script1BF(state, arg0) {
  let object = 0,
    local1 = 0;
  block106: {
    object = arg0 & 0xff;
    local1 = 0;
    if ((yield* game.hasObjectRecordProperty(object)) === 0) {
      if (((yield* game.getObjectRecordFlags(object)) & 8) === 0) {
        yield* game.placeObjectOnWaypoint(object, 1);
        yield* game.setObjectActionAndDirection(object, 0, 0);
        for (;;) {
          if (((yield* game.wait(0x90, 0)) & 0x80) === 0) {
            yield* game.setObjectRecordFlagBits(object, 8);
            yield* game.setObjectRecordPropertyFromGroup(object);
            yield* run.script04B();
            yield* game.removeObject(object);
            local1 = 255;
          } else {
            yield* game.notice(2, 0x15, 0x11, 3, 0x800, 0x26 /* "'Beretta 101T' pistol." */, 0xf0);
          }
          if (signed(local1) !== 0) {
            break block106;
          }
        }
      } else {
        yield* game.removeObject(object);
      }
    } else {
      yield* run.giveWeapon(object, 6, 3, 1, 1);
    }
  }
  return null;
}
