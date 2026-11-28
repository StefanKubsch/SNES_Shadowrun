// Scripts 0E0 to 0FF, decompiled from the original
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

// Script 0E0: 1 argument.
export function* script0E0(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x160);
  yield* game.setObjectArmour(object, 2);
  yield* game.setObjectRecordCount(object, word((yield* game.randomBelow(5)) + 0xf));
  if (
    (yield* run.chaseAndFight(
      object,
      3,
      0x22,
      0,
      3,
      1,
      word(0x5a + ((yield* game.randomByte()) & 0x1f)),
    )) === 0
  ) {
    yield* game.removeObject(object);
  } else {
    yield* run.dropNuyen15E(yield* run.leaveBody(object));
  }
  return null;
}

// Script 0E1: 1 argument.
export function* script0E1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x229 /* "If I am forced to leave the hideout in order to deal with yo..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 0E2: 1 argument.
export function* openDoor(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    yield* run.closeDoorOnRequest(object, 1, 7, 3, 0x2e);
    yield* run.openDoorOnRequest(object, 3, 5, 1, 0x2c, 0x2e);
  }
}

// Script 0E3: no arguments.
export function* script0E3(state) {
  if ((yield* game.question(0x16, 8)) === 0) {
    yield* game.topicText(
      0x11e /* "Okay, but I hafta wait for a radio call, and the airwaves ar..." */,
    );
  } else {
    yield* game.setActorStateFlagBits(0xcbe /* "Helicopter Pilot" */, 1);
    yield* game.endDialog();
  }
  return null;
}

// Script 0E4: 1 argument.
export function* script0E4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script23D(object);
  return null;
}

// Script 0E5: 1 argument.
export function* script0E5(state, arg0) {
  let object = 0;
  block97: {
    object = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 0, 4);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      for (;;) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.talk(object, 0x26);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 2);
          yield* game.notice(6, 3, 0x14, 3, 0x400, 0x194 /* "I'll open the door for you." */, 0xb4);
          yield* game.setObjectAnimation(object, 1);
          yield* game.moveObjectToWaypoint(object, 0);
          yield* game.wait(EVENT.ARRIVED, 0);
          yield* game.moveObjectToWaypoint(object, 1);
          yield* game.wait(EVENT.ARRIVED, 0);
          yield* game.setObjectAnimation(object, 0);
          yield* game.setObjectRecordFlagBits(object, 1);
          break block97;
        }
      }
    }
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 0E6: 1 argument.
export function* script0E6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(object, 0, 0);
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) !== 0) {
          yield* game.playSoundEffect(object, 0x32, 0xff, 3);
          yield* game.notice(0xa, 0x15, 0xc, 3, 0x800, 0x1ba /* "It's black ink." */, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.resetObjectRecordProperty(object);
          yield* game.removeObject(object);
          return null;
        }
      }
    }
  }
}

// Script 0E7: 1 argument.
export function* script0E7(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.dataTerminal(object, 0x1dd, 0x18);
  return null;
}

// Script 0E8: 1 argument.
export function* script0E8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  loop15: for (;;) {
    yield* game.wait(EVENT.OPEN, 0);
    yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.setObjectAnimation(object, 0);
    for (;;) {
      if (((yield* game.wait(EVENT.EXAMINE | EVENT.CLOSE, 0)) & EVENT.CLOSE) !== 0) {
        yield* game.setObjectAnimation(object, 6);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
        continue loop15;
      }
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.notice(
          2,
          0x15,
          0x1c,
          3,
          0x800,
          0x72 /* "Twenty nuyen, I'm going to need this!" */,
          0xf0,
        );
        yield* run.playPickUpSound();
        yield* game.setObjectRecordFlagBits(object, 1);
        yield* game.addNuyen(0x14);
      } else {
        yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x8a /* "There are many files here." */, 0xb4);
      }
    }
  }
}

// Script 0E9: 1 argument.
export function* script0E9(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script23D(object);
  return null;
}

// Script 0EA: 1 argument.
export function* script0EA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.icSecuredDoor(object, 4);
  return null;
}

// Script 0EB: 1 argument.
export function* script0EB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2F8(object, 0xd2, 0);
  return null;
}

// Script 0EC: 1 argument.
export function* script0EC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.grenadeHostageTaker(object);
  return null;
}

// Script 0ED: 1 argument.
export function* script0ED(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(object), 0x64)) {
    yield* game.notice(9, 2, 0xb, 3, 0, 0x69 /* "Sputnik Club" */, 0x78);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 0EE: 1 argument.
export function* script0EE(state, arg0) {
  let object = 0,
    waypoint = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    direction = 0;
  function* sub18(in0) {
    direction = in0 & 0xff;
    yield* game.setObjectDirection(object, direction);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x3f) + 0x14));
  }
  function* sub5(in0, in1, in2, in3, in4) {
    waypoint = in0 & 0xff;
    local2 = in1 & 0xff;
    local3 = in2 & 0xff;
    local4 = in3 & 0xff;
    local5 = in4 & 0xff;
    yield* game.setObjectAnimation(object, 0);
    yield* sub18(local2);
    yield* sub18(local3);
    yield* sub18(local4);
    yield* sub18(local5);
    yield* game.setObjectAnimation(object, 1);
    yield* game.moveObjectToWaypoint(object, waypoint);
    yield* game.wait(EVENT.TALK | EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.clearObjectVelocity(object);
    yield* game.setObjectAnimation(object, 0);
  }
  object = arg0 & 0xff;
  yield* game.placeObjectOnWaypoint(object, 0);
  yield* game.setObjectDialog(object, 0x61);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  for (;;) {
    yield* sub5(1, 5, 4, 5, 6);
    yield* sub5(2, 6, 6, 5, 4);
    yield* sub5(1, 3, 4, 5, 6);
    yield* sub5(0, 0, 7, 1, 2);
  }
}

// Script 0EF: 5 arguments.
export function* sentrySeesPlayerB(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local10 = 0,
    dx = 0,
    dy = 0,
    text = 0,
    columns = 0;
  function* sub13() {
    yield* game.setObjectAnimation(object, 2);
    if (local5 !== 0) {
      yield* game.stopMotion(object);
    } else {
      yield* game.moveObjectStraightToPlayer(object);
    }
    if (local5 !== 2) {
      local7 = 120;
    } else {
      local7 = 70;
    }
    for (;;) {
      if (
        (truth((yield* game.chooseEnemyTarget(object)) === 0xffff) & (signed(local6) ^ 0xffff)) !==
        0
      ) {
        yield* game.notice(0xc, 4, 0xc, 3, 0x400, 0x254 /* "I can see you!" */, 0x78);
        local6 = 255;
      }
      if (local5 > 0) {
        local10 = (yield* game.getDirectionToPlayer(object)) & 0xff;
        if (local5 === 1 || local5 === 3) {
          if (local10 !== 0) {
            if (local10 !== 1) {
              if (local10 !== 2) {
                if (local10 !== 3) {
                  if (local10 !== 4) {
                    if (local10 !== 5) {
                      if (local10 !== 6) {
                        if (local10 === 7) {
                          dx = 4;
                          dy = 4;
                        }
                      } else {
                        dx = 0;
                        dy = 4;
                      }
                    } else {
                      dx = 0xfffc;
                      dy = 4;
                    }
                  } else {
                    dx = 0xfffc;
                    dy = 0;
                  }
                } else {
                  dx = 0xfffc;
                  dy = 0xfffc;
                }
              } else {
                dx = 0;
                dy = 0xfffc;
              }
            } else {
              dx = 4;
              dy = 0xfffc;
            }
          } else {
            dx = 4;
            dy = 0;
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
                          dx = 4;
                          dy = 0xfffc;
                        }
                      } else {
                        dx = 4;
                        dy = 0;
                      }
                    } else {
                      dx = 4;
                      dy = 4;
                    }
                  } else {
                    dx = 0;
                    dy = 4;
                  }
                } else {
                  dx = 0xfffc;
                  dy = 4;
                }
              } else {
                dx = 0xfffc;
                dy = 0;
              }
            } else {
              dx = 0xfffc;
              dy = 0xfffc;
            }
          } else {
            dx = 0;
            dy = 0xfffc;
          }
        }
        if (local5 === 3) {
          dx = word(-dx);
          dy = word(-dy);
        }
        yield* game.turnObjectToPlayer(object);
        yield* game.setObjectVelocity(object, dx, dy, 0);
      }
      local8 = yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, 1);
      if ((local8 & EVENT.DEFEATED) === 0) {
        if (
          (truth(local7 === 0) |
            truth(less(yield* game.getDistanceToPlayer(object), 0x28) && less(local7, 0x28)) |
            (truth(
              ((yield* game.getObjectVelocityX(object)) |
                (yield* game.getObjectVelocityY(object))) !==
                0,
            ) ^
              0xffff) |
            truth((local8 & 4) !== 0)) !==
          0
        ) {
          block893: {
            yield* game.stopMotion(object);
            yield* game.clearObjectVelocity(object);
            if (
              (truth(less(yield* game.randomBelow(0xff), 0xaa)) &
                truth(less(yield* game.getScriptVariable(0x2a), 3))) ===
              0
            ) {
              if (
                (truth((yield* game.getDistanceToPlayer(object)) > 0x32) |
                  truth(((yield* game.randomByte()) & 1) !== 0)) ===
                0
              ) {
                yield* game.setObjectAnimation(object, 4);
                yield* game.turnObjectToPlayer(object);
                if (
                  ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
                  0
                ) {
                  local8 = 0;
                  for (;;) {
                    yield* game.setObjectAnimation(object, 5);
                    yield* game.turnObjectToPlayer(object);
                    if (
                      ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) &
                        EVENT.DEFEATED) ===
                      0
                    ) {
                      yield* game.playSoundEffect(object, 0xe, 0xff, 0xff);
                      yield* game.shootAtObject(
                        object,
                        yield* game.getPlayerObjectCopy(),
                        local1,
                        local2,
                        local3,
                        signed(local4),
                      );
                      if (local8 === 3) {
                        yield* game.setObjectAnimation(object, 6);
                        if (
                          ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) &
                            EVENT.DEFEATED) ===
                          0
                        ) {
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
                yield* game.setObjectAnimation(object, 7);
                yield* game.turnObjectToPlayer(object);
                if (
                  ((yield* game.wait(EVENT.ANIMATION_END | EVENT.DEFEATED, 0)) & EVENT.DEFEATED) ===
                  0
                ) {
                  local8 = (yield* game.randomByte()) & 3;
                  if (local8 !== 0) {
                    if (local8 !== 1) {
                      if (local8 !== 2) {
                        columns = 14;
                        text = 0x258;
                      } else {
                        columns = 15;
                        text = 0x257;
                      }
                    } else {
                      columns = 17;
                      text = 0x256;
                    }
                  } else {
                    columns = 17;
                    text = 0x255;
                  }
                  yield* game.notice(8, 6, columns, 3, 0x400, text, 0x64);
                  yield* game.setObjectAnimation(object, 8);
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x50)) & EVENT.DEFEATED) ===
                    0
                  ) {
                    const t7 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
                    const t8 = yield* game.getObjectCoarseY(object);
                    const t9 = yield* game.getObjectCoarseX(object);
                    yield* game.createObject(0xdc, t9, t8, t7, 0x160);
                  } else {
                    return 0xffff;
                  }
                } else {
                  return 0xffff;
                }
              }
            } else {
              const t1 = yield* game.getObjectCoarseHeight(object);
              const t2 = yield* game.getObjectCoarseY(object);
              const t3 = yield* game.getObjectCoarseX(object);
              yield* game.createObject(0x56, t3, t2, t1, 0x149);
              if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0xa)) & EVENT.DEFEATED) === 0) {
                const t4 = yield* game.getObjectCoarseHeight(object);
                const t5 = yield* game.getObjectCoarseY(object);
                const t6 = yield* game.getObjectCoarseX(object);
                yield* game.createObject(0x9d /* "Mage" */, t6, t5, t4, 0x15b);
                if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) !== 0) {
                  return 0xffff;
                }
              } else {
                return 0xffff;
              }
            }
          }
          const t10 = word(local5 + 1);
          local5 = word(local5 + 1) & 0xff;
          if (t10 === 4) {
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
  object = arg0 & 0xff;
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
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 0F1: 1 argument.
export function* script0F1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setSpriteMode(object, 1);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    if ((yield* game.getScriptVariable(0x2a)) === 1) {
      yield* game.setObjectVelocity(object, 0, 0, 0xfffb);
      yield* game.wait(EVENT.TIMER, 0xf);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 0F2: 1 argument.
export function* script0F2(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.waitUntilDefeated(object);
    yield* game.setObjectActionAndDirection(object, 0, 5);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x100);
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* run.promptUseOn();
          actor = yield* game.chooseNumber();
          if (actor !== 0xffff) {
            if (actor !== 0x14a5) {
              yield* run.refuseKeyOn(actor);
            } else {
              yield* game.endDialog();
              yield* game.setActorStateFlagBits(actor, 0x80);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x14, 0xd, 3, 0x800, 0x1bd /* "It's a small key." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 0F3: 1 argument.
export function* script0F3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  for (;;) {
    yield* game.wait(EVENT.TALK, 0);
    yield* game.talk(object, 0x5b);
    yield* game.setActorStateFlagBits(0xb9f /* "Jamaican" */, 1);
  }
}

// Script 0F4: 1 argument.
export function* script0F4(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectRecordFlags(object);
  local1 = t1 & 0xff;
  if ((t1 & 2) === 0) {
    if ((local1 & 4) === 0) {
      yield* run.buyCyberware(object, 0xbb8, 0x1ae, 0x1b2, 0x16, 0x3aa);
    } else {
      yield* run.buyCyberware(object, 0x3a98, 0x1ad, 0x1b1, 0x19, 0x192f);
    }
  } else {
    if ((local1 & 1) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* run.buyCyberware(object, 0x1770, 0x1ab, 0x1b0, 0x16, 0x15c4);
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
    yield* game.wait(EVENT.TIMER, 4);
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
  yield* run.script0DB(localByte(locals, 0));
  yield* game.keepObjectFlagBits(localByte(locals, 0), 0xffdf);
  setLocalWord(locals, 1, 0xa);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    yield* game.setObjectFlagBits(localByte(locals, 0), 0x80);
    yield* game.wait(EVENT.TIMER, 1);
    yield* game.keepObjectFlagBits(localByte(locals, 0), 0xff7f);
    setLocalWord(locals, 1, word(localWord(locals, 1) - 2));
    if (localWord(locals, 1) === 0) {
      block331: {
        yield* game.setObjectFlagBits(localByte(locals, 0), 0x2020);
        yield* game.wait(EVENT.TIMER, 0x1b);
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
            yield* game.wait(EVENT.TIMER, 1);
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
                if (((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 1)) & EVENT.DEFEATED) !== 0) {
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
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectDialog(object, 0x56);
  } else {
    yield* game.setObjectDialog(object, 0x55);
  }
  yield* run.wanderAround(object, 0x1e, 0xf0, 0x3c);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 0F7: 1 argument.
export function* script0F7(state, arg0) {
  let object = 0;
  block57: {
    object = arg0 & 0xff;
    yield* game.setObjectDirection(object, 5);
    if (less(yield* game.getDistanceToPlayer(object), 0x1c)) {
      yield* game.setObjectAnimation(object, 1);
      for (;;) {
        yield* game.wait(EVENT.TIMER, 5);
        if (!less(yield* game.getDistanceToPlayer(object), 0x1f)) {
          yield* game.setObjectAnimation(object, 7);
          yield* game.playSoundEffect(object, 0x3c, 0xff, 3);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          break block57;
        }
      }
    }
  }
  loop57: for (;;) {
    yield* game.setObjectAnimation(object, 3);
    yield* game.setObjectFlagBits(object, 0x100);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 5);
      if ((yield* game.getDistanceToPlayer(object)) <= 0x1e) {
        yield* game.keepObjectFlagBits(object, 0xfeff);
        yield* game.setObjectAnimation(object, 5);
        yield* game.playSoundEffect(object, 0x3e, 0xff, 3);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        yield* game.setObjectAnimation(object, 1);
        for (;;) {
          yield* game.wait(EVENT.TIMER, 5);
          if (!less(yield* game.getDistanceToPlayer(object), 0x1f)) {
            yield* game.setObjectAnimation(object, 7);
            yield* game.playSoundEffect(object, 0x3c, 0xff, 3);
            yield* game.wait(EVENT.ANIMATION_END, 0);
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
    ((truth(state.jake.dermalArmour === 0) &
      truth(((yield* game.getActorStateFlags(0x15c4 /* "Dermal Plating" */)) & 1) !== 0)) |
      truth(state.jake.leadership === 0) |
      (signed(state.jake.wiredReflexes) ^ 0xffff)) ===
    0
  ) {
    yield* game.topicText(
      0x199 /* "It seems like I'm out of stock. I don't think I'll be able t..." */,
    );
  } else {
    yield* game.topicText(
      0x19a /* "It's over there on the bench. Have a look. The prices are ve..." */,
    );
  }
  return null;
}

// Script 0F9: no arguments.
export function* promptUseOn(state) {
  yield* game.endDialog();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(2, 0x17, 7, 3, 0, 0xf /* "Use on:" */, 1);
  return null;
}

// Script 0FA: 1 argument.
export function* script0FA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 0FB: 2 arguments.
export function* script0FB(state, arg0, arg1) {
  let object = 0,
    waypoint = 0;
  block87: {
    object = arg0 & 0xff;
    waypoint = arg1 & 0xff;
    yield* game.setSpriteMode(object, 0);
    if (
      (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
      (yield* game.getObjectCoarseHeight(object))
    ) {
      for (;;) {
        yield* game.wait(EVENT.TIMER, 4);
        if (
          (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) ===
          (yield* game.getObjectCoarseHeight(object))
        ) {
          yield* game.setObjectAnimation(object, 2);
          yield* game.moveObjectStraightToWaypoint(object, waypoint);
          if (
            ((yield* game.wait(EVENT.TIMER | EVENT.ARRIVED | EVENT.DEFEATED, 0x118)) &
              EVENT.DEFEATED) ===
            0
          ) {
            yield* run.fightAndDropNuyen(object);
            break block87;
          }
          yield* run.leaveBody(object);
          break block87;
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(object, waypoint);
      yield* run.fightAndDropNuyen(object);
    }
  }
  return null;
}

// Script 0FC: 1 argument.
export function* activateElevator(state, arg0) {
  let actor = 0;
  actor = arg0;
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(8, 2, 0x10, 3, 0, 0x214 /* "ELEVATOR ACTIVATED." */, 0xb4);
  yield* game.setActorStateFlagBits(actor, 1);
  return null;
}

// Script 0FD: 1 argument.
export function* script0FD(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, (yield* game.randomByte()) & 0x113);
    yield* game.setObjectActionAndDirection(object, 0, 5);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 0FE: 1 argument.
export function* obtainDataFilePart(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if (
    ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, local0)) |
      (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x157e /* "DF_DR-MATRIX" */))) ===
    0
  ) {
    yield* game.setActorStateHolder(local0, 0x8b2 /* "Me" */);
    if (
      ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x159a /* "DF_DR 1-4" */)) &
        (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x1593 /* "DF_DR 2-4" */)) &
        (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x158c /* "DF_DR 3-4" */)) &
        (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x1585 /* "DF_DR 4-4" */))) ===
      0
    ) {
      yield* game.notice(6, 2, 0x10, 3, 0, 0x210 /* "DATA FILE OBTAINED." */, 1);
      yield* game.confirmKey();
    } else {
      yield* game.setActorStateHolder(0x159a /* "DF_DR 1-4" */, 0x1538 /* "Dog Food" */);
      yield* game.setActorStateHolder(0x1593 /* "DF_DR 2-4" */, 0x1538 /* "Dog Food" */);
      yield* game.setActorStateHolder(0x158c /* "DF_DR 3-4" */, 0x1538 /* "Dog Food" */);
      yield* game.setActorStateHolder(0x1585 /* "DF_DR 4-4" */, 0x1538 /* "Dog Food" */);
      yield* run.obtainDataFile(0x157e);
    }
  } else {
    yield* game.notice(5, 2, 0x15, 3, 0, 0x211 /* "REDUNDANT DATA DISCARDED." */, 1);
    yield* game.confirmKey();
  }
  return null;
}

// Script 0FF: 1 argument.
export function* refuseKeyOn(state, arg0) {
  let local0 = 0,
    text = 0,
    columns = 0;
  local0 = arg0;
  if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
    text = 0x1b9;
    columns = 14;
  } else {
    if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
      text = 9;
    } else {
      text = 8;
    }
    columns = 18;
  }
  yield* game.notice(2, 0x15, columns, 3, 0x800, text, 0x78);
  return null;
}
