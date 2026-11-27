// Scripts 320 to 33F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  EVENT,
  less,
  localByte,
  localWord,
  setLocalWord,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 320: 1 argument.
export function* script320(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x64);
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 7, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0xf0);
    yield* game.setObjectActionAndDirection(object, 0, 5);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x1e0);
  }
}

// Script 321: 3 arguments.
export function* giveArmour(state, arg0, arg1, arg2) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    value = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    const t1 = yield* game.scriptAction(0x140);
    local4 = t1;
    if ((local4 & 0x100) === 0) {
      if ((local4 & 0x40) !== 0) {
        yield* run.promptGiveTo();
        const t2 = yield* game.scriptChooseNumber();
        local6 = t2;
        if (local6 !== 0xffff) {
          if ((yield* run.script197(local6)) === 0) {
            value = 0xcadd;
            if (local6 !== 0x189c) {
              if (local6 !== 0x145f) {
                if (local6 === 0x3b1) {
                  value = 0x1d;
                }
              } else {
                value = 0x18;
              }
            } else {
              value = 0x13;
            }
            if (value !== 0xcadd) {
              yield* game.setScriptVariable(0x1c, yield* game.getObjectNumber(object));
              yield* game.setScriptVariable(0x1e, value);
              yield* game.talk(object, value);
            } else {
              yield* run.refuseToGiveTo(local6);
            }
          } else {
            if (
              local6 !== (yield* game.getActorStateProperty(yield* game.getObjectNumber(object)))
            ) {
              yield* game.setItemPropertyAndUnequip(object, local6);
              if (local6 !== 0x8b2) {
                yield* game.notice(0xd, 0x15, 7, 3, 0x400, 0x16 /* "Thanks!" */, 0x78);
              } else {
                yield* game.notice(0xd, 0x15, 7, 3, 0x800, 0x16 /* "Thanks!" */, 0x78);
              }
            }
          }
        }
      }
    } else {
      if (!less(yield* game.getRunnerStrength(state.byte('MEMBER_OBJECT')), local3)) {
        yield* game.equipRunnerArmour(object, local1);
      } else {
        yield* game.notice(2, 0x15, 0xf, 3, 0x800, 0x14 /* "Not strong enough." */, 0xf0);
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 322: 1 argument.
export function* script322(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block149: {
    object = arg0 & 0xff;
    yield* game.setObjectArmour(object, 2);
    yield* game.setObjectRecordCount(object, 0xd);
    if ((yield* run.script07E(5)) === 0) {
      yield* game.removeObject(object);
    } else {
      for (;;) {
        yield* game.wait(EVENT.TIMER, word(0x3c + ((yield* game.randomByte()) & 0x1f)));
        if (less(yield* game.getDistanceToPlayer(object), 0x96)) {
          if (((yield* game.randomByte()) & 1) === 0) {
            yield* game.setObjectActionAndDirection(object, 0, 7);
          } else {
            yield* game.setObjectActionAndDirection(object, 0, 3);
          }
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.appendToFightList(object);
          for (;;) {
            const t1 = yield* game.chooseEnemyTarget(object);
            local2 = t1 & 0xff;
            if (t1 === 0xffff) {
              local1 =
                truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 6)) & EVENT.HIT) !== 0) & 0xff;
            } else {
              local1 =
                (yield* run.script235(
                  object,
                  signed(local2),
                  2,
                  0,
                  5,
                  0,
                  word(0x50 + ((yield* game.randomByte()) & 0x1f)),
                )) & 0xff;
            }
            if (signed(local1) !== 0) {
              yield* game.addKarma(1);
              yield* game.fightListRemove(object);
              yield* run.leaveBody(object);
              break block149;
            }
          }
        }
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
  for (;;) {
    yield* game.wait(EVENT.TIMER, 4);
    local2 = word(local2 + 1);
    if (
      (truth(local2 !== local0) & truth(((yield* game.getScriptVariable(0x2a)) & 1) !== 0)) ===
      0
    ) {
      return null;
    }
  }
}

// Script 324: 1 argument.
export function* script324(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x200 | local0, 0x100, 0));
  return null;
}

// Script 325: 2 arguments.
export function* script325(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  return null;
}

// Script 326: 1 argument.
export function* script326(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  count = 0xa;
  for (;;) {
    yield* game.setObjectAnimation(object, 1);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.releaseObjectGraphics(object);
    count = word(count - 1);
    if (count === 0) {
      yield* game.setObjectActionAndDirection(object, 0, 5);
      return null;
    }
  }
}

// Script 327: 1 argument.
export function* script327(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x500 | local0, 0x304, 0));
  return null;
}

// Script 328: no arguments.
export function* script328(state) {
  yield* game.learnSpell(0x54);
  return null;
}

// Script 329: 2 arguments.
export function* script329(state, arg0, arg1) {
  let object = 0,
    dialog = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0;
  object = arg0 & 0xff;
  dialog = arg1;
  yield* game.wait(EVENT.TIMER, 6);
  if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
    if (state.word('GROUP_LEADER_ONLY') === 0) {
      block501: {
        yield* run.script209(object);
        local4 = 0;
        if ((yield* game.getGroupMemberPosition(object)) > 0) {
          yield* game.setObjectDialog(object, dialog);
          yield* game.keepObjectFlagBits(object, 0xfe9f);
          yield* game.clearObjectVelocity(object);
          local5 = 0;
          for (;;) {
            if ((yield* game.hasFightTarget()) === 0) {
              yield* game.placeObjectInFormation(object);
              const t3 = yield* game.wait(
                EVENT.TIMER | EVENT.TALK | EVENT.EXAMINE | EVENT.OPEN | EVENT.CLOSE | EVENT.HIT,
                1,
              );
              local5 = t3;
              if ((local5 & 0x682) !== 0) {
                if ((local5 & 2) === 0) {
                  if ((local5 & 0x80) === 0) {
                    if ((local5 & 0x600) !== 0) {
                      local5 = yield* run.script1CD(object, 0x1e, 0x1e);
                    }
                  } else {
                    yield* game.statusScreen(object);
                    local5 = yield* game.wait(
                      EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN | EVENT.CLOSE | EVENT.HIT,
                      1,
                    );
                  }
                } else {
                  yield* game.talk(object, dialog);
                }
              }
              local4 = truth((local5 & 0x800) !== 0) & 0xff;
            } else {
              block403: {
                if ((yield* game.hasNoObjectAnimation(object)) === 0) {
                  local7 = (yield* game.chooseRandomFightTarget(object)) & 0xff;
                  local3 = 0;
                  for (;;) {
                    block373: {
                      if ((local5 & 0x4000) === 0) {
                        if ((local5 & 0x600) === 0) {
                          if ((local5 & 0x80) === 0) {
                            if ((local5 & 0x2000) !== 0) {
                              yield* run.promptTarget();
                              const t1 = yield* game.chooseUnderGlove(object);
                              local8 = t1 & 0xff;
                              if (t1 !== 0xffff) {
                                local7 = signed(local8) & 0xff;
                              }
                            }
                            if (signed(local7) !== 0xffff) {
                              yield* game.turnObjectToObject(object, signed(local7));
                              yield* game.setObjectAnimation(object, 7);
                              const t2 = yield* game.wait(
                                EVENT.ANIMATION_END |
                                  EVENT.EXAMINE |
                                  EVENT.OPEN |
                                  EVENT.CLOSE |
                                  EVENT.HIT |
                                  EVENT.TARGET |
                                  EVENT.MOVE_TO,
                                0,
                              );
                              local5 = t2;
                              if ((local5 & 8) === 0) {
                                yield* game.setObjectAnimation(object, 0);
                              } else {
                                yield* game.setObjectAnimation(object, 4);
                                local5 = yield* game.wait(
                                  EVENT.TIMER |
                                    EVENT.EXAMINE |
                                    EVENT.OPEN |
                                    EVENT.CLOSE |
                                    EVENT.HIT |
                                    EVENT.TARGET |
                                    EVENT.MOVE_TO,
                                  0x1e,
                                );
                                if (
                                  ((yield* game.canAttack(object, signed(local7))) &
                                    truth((local5 & 1) !== 0)) ===
                                  0
                                ) {
                                  yield* game.setObjectAnimation(object, 0);
                                } else {
                                  yield* game.turnObjectToObject(object, signed(local7));
                                  yield* game.createObject(0x10a, object, signed(local7), 0, 0x12a);
                                  yield* game.setObjectAnimation(object, 8);
                                  local5 = yield* game.wait(
                                    EVENT.TIMER |
                                      EVENT.EXAMINE |
                                      EVENT.OPEN |
                                      EVENT.CLOSE |
                                      EVENT.HIT |
                                      EVENT.TARGET |
                                      EVENT.MOVE_TO,
                                    0x3c,
                                  );
                                }
                              }
                            } else {
                              yield* game.placeObjectInFormation(object);
                              local5 = yield* game.wait(
                                EVENT.TIMER |
                                  EVENT.EXAMINE |
                                  EVENT.OPEN |
                                  EVENT.CLOSE |
                                  EVENT.HIT |
                                  EVENT.TARGET |
                                  EVENT.MOVE_TO,
                                1,
                              );
                            }
                          } else {
                            yield* game.statusScreen(object);
                            local5 = yield* game.wait(
                              EVENT.TIMER |
                                EVENT.EXAMINE |
                                EVENT.OPEN |
                                EVENT.CLOSE |
                                EVENT.HIT |
                                EVENT.TARGET |
                                EVENT.MOVE_TO,
                              1,
                            );
                          }
                        } else {
                          local5 = yield* run.script1CD(object, 0x1e, 0x1e);
                        }
                      } else {
                        yield* game.setObjectAnimation(object, 2);
                        yield* game.setObjectFlagBits(object, 0x60);
                        yield* game.choosePlace(object);
                        for (;;) {
                          local5 = yield* game.wait(
                            EVENT.TIMER |
                              EVENT.ARRIVED |
                              EVENT.EXAMINE |
                              EVENT.OPEN |
                              EVENT.CLOSE |
                              EVENT.HIT |
                              EVENT.TARGET |
                              EVENT.MOVE_TO,
                            0xf,
                          );
                          if (((yield* game.getObjectFlags(object)) & 8) !== 0 && local5 === 1) {
                            yield* game.stopMotion(object);
                            yield* game.clearObjectVelocity(object);
                            local5 = 4;
                          }
                          if (local5 !== 1) {
                            yield* game.keepObjectFlagBits(object, 0xff9f);
                            break block373;
                          }
                        }
                      }
                    }
                    local4 = truth((local5 & 0x800) !== 0) & 0xff;
                    if (
                      (signed(local3) |
                        signed(local4) |
                        ((yield* game.canAttack(object, signed(local7))) ^ 0xffff)) !==
                      0
                    ) {
                      yield* game.stopMotion(object);
                      yield* game.clearObjectVelocity(object);
                      break block403;
                    }
                  }
                } else {
                  local4 = (yield* run.script194(object)) & 0xff;
                }
              }
            }
            if (signed(local4) !== 0) {
              break block501;
            }
          }
        }
      }
      yield* run.releaseRunner(object);
      if (signed(local4) === 0) {
        yield* run.script194(object);
        yield* game.setObjectAnimation(object, 0);
        yield* game.turnObjectToPlayer(object);
        yield* game.wait(EVENT.TIMER, 0x14);
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
    yield* game.removeObject(object);
    return null;
  }
  yield* run.releaseRunner(object);
  yield* game.removeObject(object);
  return null;
}

// Script 32A: 1 argument.
export function* script32A(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0, in1) {
    local3 = in0;
    local5 = in1;
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = word((yield* game.getObjectCoarseY(object)) - local5);
    const t3 = word((yield* game.getObjectCoarseX(object)) - local3);
    yield* game.createObject(0xb8, t3, t2, t1, 0x382);
    yield* game.wait(EVENT.TIMER, 2);
  }
  object = arg0 & 0xff;
  block189: {
    yield* game.setObjectActionAndDirection(object, 2, 5);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      for (;;) {
        const t4 = yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 6);
        local1 = t4;
        if ((local1 & 1) === 0) {
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x20f /* "This safe is locked." */, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          if ((yield* game.getObjectNumber(object)) === 0x63c) {
            yield* sub5(0xa, 0xf);
            yield* sub5(4, 0);
            yield* sub5(0x14, 0xa);
            yield* sub5(0x19, 0x14);
            yield* sub5(0x28, 0xf);
            yield* sub5(0x1e, 0x14);
            yield* sub5(0x23, 0x1e);
          }
          yield* run.closeDoorWhenClear(object, 2, 4, 0, 0x2c, 0x2e);
          break block189;
        }
      }
    } else {
      yield* run.openDoorOnRequest(object, 2, 4, 0, 0x2c, 0x2e);
    }
  }
  for (;;) {
    yield* run.closeDoorOnRequest(object, 0, 6, 2, 0x2e);
    yield* run.openDoorOnRequest(object, 2, 4, 0, 0x2c, 0x2e);
  }
}

// Script 32B: 1 argument.
export function* script32B(state, arg0) {
  let object = 0,
    object2 = 0,
    count = 0,
    local5 = 0;
  function* sub5(in0) {
    count = in0;
    local5 = 0;
    for (;;) {
      yield* game.wait(EVENT.TIMER, 1);
      count = word(count - 1);
      if (less(yield* game.getDistanceToPlayer(object), 0xa)) {
        local5 = 255;
        yield* game.shootAtObject(object, yield* game.getPlayerObject(), 3, 4, 3, 3);
      }
      if ((truth(count === 0) | signed(local5)) !== 0) {
        return signed(local5);
      }
    }
  }
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectDirection(object, 5);
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectAnimation(object, 2);
  } else {
    yield* game.setObjectAnimation(object, 1);
  }
  const t1 = yield* game.getObjectCoarseX(object);
  object2 = t1 & 0xff;
  const t2 = shiftLeft(word((yield* game.getObjectCoarseHeight(t1)) + 0x20), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t4 = shiftLeft(yield* game.getObjectCoarseX(object2), 2);
  yield* game.setObjectPosition(object, t4, t3, t2);
  const t5 = word(((yield* game.randomByte()) & 0xf) + 7);
  const t6 = word(((yield* game.randomByte()) & 7) - 4);
  const t7 = word(((yield* game.randomByte()) & 7) - 4);
  yield* game.setObjectVelocity(object, t7, t6, t5);
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* sub5(0x3c);
  yield* game.removeObject(object);
  return null;
}

// Script 32C: 1 argument.
export function* script32C(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, 0x14);
  for (;;) {
    yield* game.wait(EVENT.TIMER, word(0xa + (yield* game.randomBelow(0xa))));
    if ((yield* game.getDistanceToPlayer(object)) <= 0x14) {
      block206: {
        yield* game.setObjectFlagBits(object, 0xa000);
        yield* game.clearObjectVelocity(object);
        yield* game.setObjectAnimation(object, 7);
        yield* game.turnObjectToPlayer(object);
        yield* game.playSoundEffect(object, 0x16, 0xff, 3);
        yield* game.appendToFightList(object);
        local1 =
          truth(((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) !== 0) & 0xff;
        const t1 = yield* game.chooseEnemyTarget(object);
        local4 = t1 & 0xff;
        if ((truth(t1 === 0xffff) | signed(local1)) === 0) {
          yield* game.setObjectFlagBits(object, 0x20);
          yield* game.setObjectAnimation(object, 1);
          yield* game.moveObjectStraightToObject(object, signed(local4));
          local2 = 88;
          local3 = 0;
          for (;;) {
            if (less(yield* game.getDistanceBetweenObjects(object, signed(local4)), 0xf)) {
              if (local3 !== 0) {
                local3 = word(local3 - 1) & 0xff;
              } else {
                yield* game.shootAtObject(object, signed(local4), 4, 4, 6, 1);
                local3 = 15;
              }
            }
            local2 = word(local2 - 1) & 0xff;
            local1 =
              truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 1)) & EVENT.HIT) !== 0) & 0xff;
            if ((truth(local2 === 0) | signed(local1)) !== 0) {
              yield* game.stopMotion(object);
              yield* game.clearObjectVelocity(object);
              if (signed(local1) !== 0) {
                break block206;
              }
              yield* game.keepObjectFlagBits(object, 0xffdf);
              yield* game.setObjectAnimation(object, 8);
              yield* game.wait(EVENT.ANIMATION_END, 0);
              break block206;
            }
          }
        }
      }
      yield* game.fightListRemove(object);
      if (signed(local1) !== 0) {
        yield* run.scatterGhoulBones(object);
        yield* game.addKarma(4);
      }
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 32D: 1 argument.
export function* script32D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x500 | local0, 4, 0));
  return null;
}

// Script 32E: 1 argument.
export function* script32E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.lockedCabinet(object, 0x8b, 4, 0x237);
  return null;
}

// Script 32F: 1 argument.
export function* script32F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 8, 0);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0x5fff);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 330: no arguments.
export function* script330(state) {
  yield* run.enterWithoutRunners(8);
  return null;
}

// Script 331: 1 argument.
export function* releaseRunner(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.raiseStateCount(object, 0xff);
  yield* game.raiseMemberMagicPoints(object, 0xff);
  yield* game.keepObjectRecordFlagBits(object, 0xff7f);
  yield* game.removeGroupMember(object);
  return null;
}

// Script 332: 1 argument.
export function* script332(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 6, 0);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.removeObject(object);
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
  yield* run.dropNuyen164(yield* run.script27C(0x800 | local0, 0x607, 0, 0x804, 0xc06));
  return null;
}

// Script 335: 1 argument.
export function* script335(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x400 | local0, 0x203, 0));
  return null;
}

// Script 336: 3 arguments.
export function* script336(state, arg0, arg1, arg2) {
  const locals = new Uint8Array(20);
  function* sub9(in0, in1) {
    setLocalWord(locals, 15, in0);
    setLocalWord(locals, 17, in1);
    if (
      ((yield* game.wait(localWord(locals, 15) | 0x800, localWord(locals, 17))) & EVENT.HIT) !==
      0
    ) {
      locals[5] = 0xffff & 0xff;
      yield* game.fightListRemove(localByte(locals, 0));
    }
  }
  function* sub39(in0) {
    locals[15] = in0 & 0xff;
    setLocalWord(locals, 16, yield* game.getObjectCoarseX(localByte(locals, 15)));
    setLocalWord(locals, 18, yield* game.getObjectCoarseY(localByte(locals, 15)));
    if (!(
      localWord(locals, 16) > localWord(locals, 6) &&
      less(localWord(locals, 16), localWord(locals, 8)) &&
      localWord(locals, 18) > localWord(locals, 10) &&
      less(localWord(locals, 18), localWord(locals, 12))
    )) {
      return 0;
    }
    return 0xffff;
  }
  locals[0] = arg0 & 0xff;
  setLocalWord(locals, 1, arg1);
  setLocalWord(locals, 3, arg2);
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
    for (;;) {
      locals[14] = (yield* game.chooseEnemyTarget(localByte(locals, 0))) & 0xff;
      if (((yield* game.randomByte()) & 0x1f) === 0) {
        yield* game.setObjectDirection(
          localByte(locals, 0),
          shiftLeft((yield* game.randomByte()) & 3, 1),
        );
      }
      yield* game.setObjectDirection(
        localByte(locals, 0),
        (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe,
      );
      yield* sub9(1, 6);
      if (((yield* sub39(signed(localByte(locals, 14)))) | signed(localByte(locals, 5))) !== 0) {
        yield* game.setObjectActionAndDirection(
          localByte(locals, 0),
          1,
          (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe,
        );
        yield* game.moveObjectToObject(localByte(locals, 0), signed(localByte(locals, 14)));
        for (;;) {
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
          } else {
            yield* game.shootAtObject(
              localByte(locals, 0),
              signed(localByte(locals, 14)),
              4,
              4,
              3,
              2,
            );
            yield* game.setObjectDirection(
              localByte(locals, 0),
              (yield* game.getObjectDirection(localByte(locals, 0))) & 0xfffe,
            );
            yield* game.keepObjectFlagBits(localByte(locals, 0), 0xfeff);
            yield* sub9(1, 0x5a);
            yield* game.setObjectFlagBits(localByte(locals, 0), 0x100);
            yield* game.moveObjectToPlayer(localByte(locals, 0));
          }
          if (
            ((yield* sub39(signed(localByte(locals, 14)))) &
              (signed(localByte(locals, 5)) ^ 0xffff)) ===
            0
          ) {
            yield* game.stopMotion(localByte(locals, 0));
            yield* game.clearObjectVelocity(localByte(locals, 0));
            if (signed(localByte(locals, 5)) === 0) {
              continue loop132;
            }
            yield* game.addKarma(5);
            yield* game.fightListRemove(localByte(locals, 0));
            yield* run.script312(localByte(locals, 0));
            yield* game.resetObjectRecordProperty(localByte(locals, 0));
            yield* game.removeObject(localByte(locals, 0));
            return null;
          }
        }
      }
    }
  }
}

// Script 337: 1 argument.
export function* script337(state, arg0) {
  let object = 0;
  block421: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      for (;;) {
        yield* game.wait(EVENT.TIMER, 1);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.setObjectActionAndDirection(object, 0, 4);
          yield* game.wait(EVENT.TIMER, 0x64);
          yield* game.setObjectDirection(object, 2);
          yield* game.wait(EVENT.TIMER, 0xc8);
          yield* game.setObjectDirection(object, 4);
          yield* game.wait(EVENT.TIMER, 0xa0);
          yield* game.setObjectAnimation(object, 1);
          yield* game.setObjectVelocity(object, 0, 0xfffe, 0);
          yield* game.wait(EVENT.TIMER, 0x4b);
          yield* game.moveObjectStraightToWaypoint(object, 1);
          yield* game.wait(EVENT.ARRIVED, 0);
          yield* game.stopMotion(object);
          yield* game.setObjectActionAndDirection(object, 0, 2);
          yield* game.setActorStateFlagBits(0xf5, 0x80);
          yield* game.wait(EVENT.TIMER, 0x3c);
          yield* game.setObjectAnimation(object, 1);
          yield* game.setObjectVelocity(object, 2, 0, 0);
          yield* game.wait(EVENT.TIMER, 0x3c);
          yield* game.moveObjectToWaypoint(object, 4);
          yield* game.wait(EVENT.ARRIVED, 0);
          yield* game.stopMotion(object);
          yield* game.setObjectActionAndDirection(object, 0, 6);
          yield* game.setActorStateFlagBits(0x3a3, 0x80);
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* game.wait(EVENT.TIMER, 0x190);
          for (;;) {
            yield* game.wait(EVENT.TIMER, 5);
            if (
              (truth(less(yield* game.getDistanceToPlayer(object), 0x64)) &
                truth(((yield* game.getObjectRecordFlags(object)) & 2) !== 0)) !==
              0
            ) {
              yield* game.keepObjectRecordFlagBits(object, 0xfffd);
              yield* game.playSoundEffect(object, 0x14, 0xff, 3);
              yield* game.notice(2, 2, 0xd, 3, 0x400, 0x39 /* "AAAAAAAAAARGH!" */, 0x78);
              yield* game.setObjectActionAndDirection(object, 6, 0);
              yield* game.setObjectVelocity(object, 3, 0, 0);
              yield* game.wait(EVENT.TIMER, 0x14);
              yield* game.notice(0x10, 4, 0xa, 3, 0x400, 0x3a /* "IT'S ALIVE!" */, 0x3c);
              yield* game.setActorStateFlagBits(0xaf, 0x80);
              yield* game.setObjectAnimation(object, 2);
              yield* game.moveObjectToWaypoint(object, 6);
              yield* game.setActorStateFlagBits(0x7fc, 2);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.stopMotion(object);
              yield* game.removeObject(object);
              break block421;
            }
          }
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(object, 3);
      yield* game.setObjectActionAndDirection(object, 0, 2);
      if (signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) === 0) {
        for (;;) {
          yield* game.wait(EVENT.TIMER, 2);
          if (((yield* game.getObjectRecordFlags(object)) & 2) !== 0) {
            yield* game.keepObjectRecordFlagBits(object, 0xfffd);
            yield* game.setObjectDirection(object, 4);
            yield* game.wait(EVENT.TIMER, 0x1e);
            yield* game.notice(0x11, 4, 7, 3, 0x400, 0x58 /* "Eeeeek!" */, 0xf0);
            yield* game.setObjectAnimation(object, 2);
            yield* game.moveObjectToWaypoint(object, 6);
            yield* game.wait(EVENT.ARRIVED, 0);
            yield* game.stopMotion(object);
            yield* game.removeObject(object);
            yield* game.setActorStateFlagBits(0xaf, 0x80);
            break block421;
          }
        }
      } else {
        for (;;) {
          yield* game.wait(EVENT.TALK, 0);
          yield* game.talk(object, 0x51);
        }
      }
    }
  }
  return null;
}

// Script 338: 1 argument.
export function* script338(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectFlagBits(object, 0x100);
  yield* game.setObjectDialog(object, 7);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 339: 1 argument.
export function* script339(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22e /* "AI computer is nearing completion. Soon we will command the ..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 33A: 1 argument.
export function* script33A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x500 | local0, 0x304, 0));
  return null;
}

// Script 33B: 1 argument.
export function* script33B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectFlagBits(object, 0x100);
  yield* game.setObjectDialog(object, 8);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 33C: 1 argument.
export function* script33C(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.script245(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    const t1 = yield* run.script2AB(signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* run.promptUseOn();
          const t2 = yield* game.chooseNumber();
          actor = t2;
          if (actor !== 0xffff) {
            if (!(actor === 0x1642 || actor === 0x1649 || actor === 0x1634 || actor === 0x163b)) {
              yield* run.refuseToUseOn(actor);
            } else {
              yield* game.setActorStateFlagBits(actor, 0x80);
            }
          }
          local1 = 255;
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.script04B();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0x82 /* "It's a very sharp instrument." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 33D: 3 arguments.
export function* nothing(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
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
  yield* run.dropNuyen164(yield* run.script10C(0x500 | local0, 0x304, 0));
  return null;
}
