// Scripts 000 to 01F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 000: 1 argument.
export function* script000(state, arg0) {
  let object = 0,
    count = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0) {
    local5 = in0 & 0xff;
    if (signed(local5) === 0) {
      yield* game.createObject(
        0x55,
        0x227,
        0x1c3,
        word(0x48 + (yield* game.randomBelow(0x20))),
        0x2be,
      );
    } else {
      yield* game.createObject(
        0x55,
        0x23e,
        0x1c3,
        word(0x48 + (yield* game.randomBelow(0x20))),
        0x2be,
      );
    }
  }
  function* sub120() {
    const t1 = word(word(0x1cb + (yield* game.randomBelow(0x10))) - local3);
    const t2 = word(0x231 + (yield* game.randomBelow(0x10)));
    yield* game.setSpriteMode(yield* game.createObject(0xb8, t2, t1, 0x40, 0x382), 0);
  }
  function* sub58() {
    const t3 = word(0x48 + (yield* game.randomBelow(0x20)));
    const t4 = word(0x1ba + (yield* game.randomBelow(0x10)));
    const t5 = word(0x226 + (yield* game.randomBelow(0x10)));
    yield* game.createObject(0x56, t5, t4, t3, 0x2be);
  }
  function* sub90() {
    const t6 = word(word(0x17e + local3) + (yield* game.randomBelow(0x14)));
    const t7 = word(0x21e - (yield* game.randomBelow(0x64)));
    yield* game.createObject(0xb8, t7, t6, 0x40, 0x382);
  }
  object = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) === 0) {
    yield* game.removeObject(object);
    return null;
  }
  yield* game.wait(1, 0xf0);
  count = 0xf;
  local3 = 0x28;
  for (;;) {
    yield* game.wait(1, local3);
    yield* sub5(0xffff);
    yield* sub5(0);
    if ((count & 3) === 0) {
      local3 = word(local3 - 4);
    }
    count = word(count - 1);
    if (count === 0) {
      count = 0xc;
      local3 = 0;
      for (;;) {
        yield* game.wait(1, 8);
        yield* sub120();
        local3 = word(local3 + 8);
        count = word(count - 1);
        if (count === 0) {
          for (;;) {
            yield* game.wait(1, 8);
            if ((yield* game.getScriptVariable(0x2a)) !== 0) {
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              yield* game.wait(1, 8);
              yield* sub58();
              local3 = 0;
              for (;;) {
                yield* sub90();
                yield* game.wait(1, 8);
                local3 = word(local3 + 8);
              }
            } else {
              yield* sub58();
            }
          }
        }
      }
    }
  }
}

// Script 001: 1 argument.
export function* script001(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script157(local0, 3, 0xa, 1, 0);
  return null;
}

// Script 002: no arguments.
export function* script002(state) {
  const t1 = yield* run.byNegotiation(0xbb8, 0xa8c, 0x960);
  const t2 = yield* run.byNegotiationB(0x175, 0x176, 0x177);
  yield* run.script162(0xb52, t2, t1, 0x174, 0x173);
  return null;
}

// Script 003: 1 argument.
export function* script003(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectDialog(object, 0x80);
  yield* game.wait(2, 0);
  return null;
}

// Script 004: 1 argument.
export function* script004(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x231 /* "No sight of your courier. Word on the street is that he got ..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 005: 2 arguments, returns a word.
export function* script005(state, arg0, arg1) {
  let object = 0,
    count = 0,
    local3 = 0;
  object = arg0 & 0xff;
  count = arg1;
  for (;;) {
    local3 = truth(((yield* game.wait(0x805, 4)) & 0x800) !== 0) & 0xff;
    count = word(count - 1);
    if (less(yield* game.getDistanceToPlayer(object), 0xf)) {
      count = 0;
      yield* game.shootAtObject(object, yield* game.getPlayerObject(), 2, 5, 5, 1);
      local3 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
    }
    if ((truth(count === 0) | signed(local3)) !== 0) {
      return signed(local3);
    }
  }
}

// Script 006: 1 argument.
export function* script006(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
  }
}

// Script 007: 1 argument.
export function* script007(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script0AE(local0);
  yield* game.wait(0x800, 0);
  yield* run.leaveBodyAndResetRecord(local0);
  return null;
}

// Script 008: 1 argument.
export function* script008(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x81);
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
    yield* game.setObjectActionAndDirection(object, 0, 7);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 009: 1 argument.
export function* script009(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script179(local0, 0x2a0);
  return null;
}

// Script 00A: 5 arguments.
export function* script00A(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    count = 0;
  function* sub13() {
    if (count === 1) {
      yield* game.setScriptVariableBits(local2, 1);
    }
    if (count === 7) {
      yield* game.keepScriptVariableBits(local2, 0);
    }
    if (((yield* game.getScriptVariable(local2)) & 1) === 0) {
      count = word(count - 1);
    } else {
      count = word(count + 1);
    }
    if (count === 1) {
      yield* game.setScriptVariableBits(local2, 1);
    }
    if (count === 7) {
      yield* game.keepScriptVariableBits(local2, 0);
    }
    yield* game.setScriptVariable(local1, count);
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4;
  block182: {
    yield* game.keepActorStateFlagBits(local4, local3 ^ 0xffff);
    count = yield* game.getScriptVariable(local1);
    yield* sub13();
    yield* game.setObjectActionAndDirection(object, word(count - 1), 0);
    yield* game.wait(1, 5);
    if (((yield* game.getActorStateFlags(local4)) & local3) === 0) {
      for (;;) {
        yield* sub13();
        yield* game.setObjectAnimation(object, word(count - 1));
        yield* game.wait(1, 0x3c);
        if (((yield* game.randomByte()) & 1) !== 0) {
          yield* game.wait(1, 0x19);
        }
        if (((yield* game.getActorStateFlags(local4)) & local3) !== 0) {
          break block182;
        }
      }
    }
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 00B: 5 arguments.
export function* script00B(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  function* sub13() {
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = word((yield* game.getObjectCoarseY(object)) - 0xa);
    const t3 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0xdc, t3, t2, t1, 0x104);
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  yield* game.keepObjectRecordFlagBits(object, 0xfffe);
  yield* game.setObjectActionAndDirection(object, 4, 3);
  yield* game.setObjectFlagBits(object, 0xa000);
  yield* game.setSpriteMode(object, 0x8001);
  if ((local3 & 0x40) === 0) {
    yield* game.startWaveSwarm(object);
  } else {
    yield* game.startWaveSwarm(object | 1);
  }
  local5 = 0;
  local7 = 0;
  local9 = 0;
  yield* game.appendToFightList(object);
  for (;;) {
    local5 = word(local5 + 1);
    local7 = word(local7 + 1);
    if (local7 !== 0x64) {
      if (local7 !== 0xb4) {
        if (local7 !== 0xdc) {
          if (local7 !== 0xf0) {
            if (local7 === 0x12c) {
              yield* game.setObjectActionAndDirection(object, 4, 3);
              local7 = 0;
              yield* sub13();
            }
          } else {
            yield* game.setObjectActionAndDirection(object, 1, 3);
            yield* sub13();
          }
        } else {
          yield* game.setObjectActionAndDirection(object, 2, 7);
        }
      } else {
        yield* game.setObjectActionAndDirection(object, 4, 7);
      }
    } else {
      yield* game.setObjectActionAndDirection(object, 2, 3);
    }
    if (local5 === 0x64) {
      yield* game.moveSwarmWave(1, 0, 0, 0);
    }
    if (local5 === 0x320) {
      local5 = 0;
      yield* game.moveSwarmWave(1, 1, 0, 0);
    }
    if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
      yield* game.moveSwarmWave(0, 0, 0, 0);
    } else {
      local9 = 255;
    }
    if (signed(local9) !== 0) {
      yield* game.addKarma(local4);
      yield* game.fightListRemove(object);
      yield* game.keepObjectFlagBits(object, 0x5fff);
      yield* game.setObjectRecordFlagBits(object, 1);
      yield* game.setObjectActionAndDirection(object, 2, 3);
      yield* game.setObjectVelocity(object, 0, 0xfffb, 8);
      yield* game.setObjectFlagBits(object, 0x20);
      yield* game.wait(1, 0x14);
      yield* game.setObjectActionAndDirection(object, 7, 0);
      yield* game.wait(8, 0);
      if ((local3 & 0x80) === 0) {
        yield* game.resetObjectRecordProperty(object);
      }
      return null;
    }
  }
}

// Script 00C: 1 argument, returns a word.
export function* script00C(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffef);
  yield* game.turnObjectToObject(object, yield* game.getPlayerObjectCopy());
  yield* game.setObjectAnimation(object, 7);
  const t1 = yield* game.wait(0x808, 0);
  local1 = t1;
  if ((local1 & 8) === 0) {
    yield* game.setObjectAnimation(object, 0);
  } else {
    yield* game.setObjectAnimation(object, 4);
    const t2 = yield* game.wait(0x801, 0xa);
    local1 = t2;
    if ((local1 & 1) === 0) {
      yield* game.setObjectAnimation(object, 0);
    } else {
      yield* game.turnObjectToObject(object, yield* game.getPlayerObjectCopy());
      yield* game.createObject(0x10a, object, yield* game.getPlayerObjectCopy(), 0, 0x12a);
      yield* game.setObjectAnimation(object, 8);
      local1 = yield* game.wait(0x801, 1);
    }
  }
  return truth((local1 & 0x800) !== 0);
}

// Script 00D: 1 argument.
export function* script00D(state, arg0) {
  let object = 0,
    local1 = 0;
  function* sub19() {
    yield* game.setObjectAnimation(object, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x28));
    yield* game.setObjectAnimation(object, 1);
  }
  function* sub5(in0) {
    local1 = in0 & 0xff;
    yield* game.moveObjectToWaypoint(object, local1);
    yield* game.wait(6, 0);
  }
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x3f);
  yield* game.setObjectDirection(object, 0);
  yield* game.placeObjectOnWaypoint(object, 5);
  for (;;) {
    yield* sub19();
    yield* sub5(7);
    yield* sub5(8);
    yield* sub5(6);
    yield* sub19();
    yield* sub5(8);
    yield* sub5(5);
  }
}

// Script 00E: 1 argument.
export function* script00E(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  function* sub5(in0) {
    local3 = in0 & 0xff;
    yield* game.setObjectAnimation(object, 2);
    yield* game.moveObjectToWaypoint(object, local3);
    const t1 = truth(((yield* game.wait(6, 0)) & 2) !== 0);
    local2 = t1 & 0xff;
    if (t1 === 0) {
      yield* game.setObjectDirection(object, 4);
      yield* game.setObjectAnimation(object, 0);
      const t2 = truth(((yield* game.wait(3, 0x14)) & 2) !== 0);
      local2 = t2 & 0xff;
      if (t2 === 0) {
        block211: {
          if (((yield* game.randomByte()) & 1) === 0) {
            local1 = 5;
            for (;;) {
              yield* game.setObjectDirection(object, local1);
              local2 = truth(((yield* game.wait(3, 0x10)) & 2) !== 0) & 0xff;
              if (local1 !== 0) {
                local1 = word(local1 - 1) & 0xff;
              } else {
                local1 = 7;
              }
              if ((truth(local1 === 6) | signed(local2)) !== 0) {
                if (signed(local2) !== 0) {
                  break block211;
                }
                local4 = yield* game.getObjectCoarseX(object);
                local6 = yield* game.getObjectCoarseY(object);
                local8 = yield* game.getObjectCoarseHeight(object);
                yield* game.placeObjectOnWaypoint(object, 3);
                yield* game.createObject(0x96 /* "Kitsune" */, local4, local6, local8, 0x27e);
                local2 = truth(((yield* game.wait(3, 0xb4)) & 2) !== 0) & 0xff;
                break block211;
              }
            }
          } else {
            yield* game.setObjectAnimation(object, 3);
            yield* game.setObjectDirection(object, 0);
            const t3 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0);
            local2 = t3 & 0xff;
            if (t3 === 0) {
              yield* game.setObjectDirection(object, 6);
              local2 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0) & 0xff;
            }
          }
        }
        local1 = local3 & 0xff;
        yield* game.placeObjectOnWaypoint(object, local3);
      }
    }
  }
  function* sub220() {
    yield* game.placeObjectOnWaypoint(object, 3);
    yield* game.wait(1, 0xf);
    yield* game.placeObjectOnWaypoint(object, 4);
  }
  object = arg0 & 0xff;
  block388: {
    yield* game.keepObjectFlagBits(object, 0xde9f);
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0xb52)) & 0x80) === 0) {
      yield* game.setObjectRecordFlags(object, 0);
      local1 = 0;
      yield* game.placeObjectOnWaypoint(object, 0);
      yield* game.setObjectActionAndDirection(object, 0, 0);
      local2 = 0;
      for (;;) {
        if (local1 !== 0) {
          yield* sub5(0);
        } else {
          if (((yield* game.randomByte()) & 1) === 0) {
            yield* sub5(2);
          } else {
            yield* sub5(1);
          }
        }
        if (signed(local2) !== 0) {
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          yield* game.setObjectActionAndDirection(object, 0, 0);
          const t4 = yield* game.getObjectCoarseHeight(object);
          const t5 = yield* game.getObjectCoarseY(object);
          const t6 = yield* game.getObjectCoarseX(object);
          yield* game.createObject(0x56, t6, t5, t4, 0x149);
          yield* game.wait(1, 0xa);
          yield* sub220();
          const t7 = yield* game.getObjectCoarseHeight(object);
          const t8 = yield* game.getObjectCoarseY(object);
          const t9 = yield* game.getObjectCoarseX(object);
          yield* game.createObject(0x56, t9, t8, t7, 0x149);
          yield* sub220();
          yield* game.setObjectFlags(object, 0);
          yield* run.script1F1(object);
          break block388;
        }
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 00F: 5 arguments.
export function* script00F(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local11 = 0,
    local12 = 0,
    local14 = 0;
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
    local8 = 0;
    for (;;) {
      if (
        (truth((yield* game.chooseEnemyTarget(object)) === 0xffff) & (signed(local6) ^ 0xffff)) !==
        0
      ) {
        yield* game.notice(0xa, 4, 0xc, 3, 0x400, 0x254 /* "I can see you!" */, 0x78);
        local6 = 255;
      }
      if (local8 > 0x1f) {
        local8 = 0;
      }
      if (local5 > 0) {
        local11 = (yield* game.getDirectionToPlayer(object)) & 0xff;
        if (local5 === 1 || local5 === 3) {
          if (local11 !== 0) {
            if (local11 !== 1) {
              if (local11 !== 2) {
                if (local11 !== 3) {
                  if (local11 !== 4) {
                    if (local11 !== 5) {
                      if (local11 !== 6) {
                        if (local11 === 7) {
                          local12 = 4;
                          local14 = 4;
                        }
                      } else {
                        local12 = 0;
                        local14 = 4;
                      }
                    } else {
                      local12 = 0xfffc;
                      local14 = 4;
                    }
                  } else {
                    local12 = 0xfffc;
                    local14 = 0;
                  }
                } else {
                  local12 = 0xfffc;
                  local14 = 0xfffc;
                }
              } else {
                local12 = 0;
                local14 = 0xfffc;
              }
            } else {
              local12 = 4;
              local14 = 0xfffc;
            }
          } else {
            local12 = 4;
            local14 = 0;
          }
        }
        if (local5 === 2) {
          if (local11 !== 0) {
            if (local11 !== 1) {
              if (local11 !== 2) {
                if (local11 !== 3) {
                  if (local11 !== 4) {
                    if (local11 !== 5) {
                      if (local11 !== 6) {
                        if (local11 === 7) {
                          local12 = 4;
                          local14 = 0xfffc;
                        }
                      } else {
                        local12 = 4;
                        local14 = 0;
                      }
                    } else {
                      local12 = 4;
                      local14 = 4;
                    }
                  } else {
                    local12 = 0;
                    local14 = 4;
                  }
                } else {
                  local12 = 0xfffc;
                  local14 = 4;
                }
              } else {
                local12 = 0xfffc;
                local14 = 0;
              }
            } else {
              local12 = 0xfffc;
              local14 = 0xfffc;
            }
          } else {
            local12 = 0;
            local14 = 0xfffc;
          }
        }
        if (local5 === 3) {
          local12 = word(-local12);
          local14 = word(-local14);
        }
        yield* game.turnObjectToPlayer(object);
        yield* game.setObjectVelocity(object, local12, local14, 0);
      }
      const t1 = yield* game.wait(0x805, 1);
      local9 = t1;
      if ((local9 & 0x800) === 0) {
        if (local8 === 8) {
          yield* game.playSoundEffect(object, 0x42, 0xff, 0xff);
          yield* game.shootAtObject(
            object,
            yield* game.getPlayerObjectCopy(),
            local1,
            local2,
            local3,
            signed(local4),
          );
        }
        if (
          (truth(local7 === 0) |
            truth(less(yield* game.getDistanceToPlayer(object), 0x28) && less(local7, 0x28)) |
            (truth(
              ((yield* game.getObjectVelocityX(object)) |
                (yield* game.getObjectVelocityY(object))) !==
                0,
            ) ^
              0xffff) |
            truth((local9 & 4) !== 0)) !==
          0
        ) {
          const t2 = word(local5 + 1);
          local5 = word(local5 + 1) & 0xff;
          if (t2 === 4) {
            local5 = 0;
          }
          return 0;
        }
        local7 = word(local7 - 1) & 0xff;
        local8 = word(local8 + 1) & 0xff;
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

// Script 010: 1 argument.
export function* script010(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(1, 2);
  yield* game.notice(4, 5, 0x15, 3, 0x400, 0x238 /* "Don't let him off this floor." */, 0xc8);
  yield* run.dropNuyen15F(yield* run.script27C(0x200 | object, 1, 0x239, 0x403, 0x903));
  yield* game.notice(3, 7, 0x11, 3, 0x400, 0x23d /* "Aargh! I'm hit! I'm hit!" */, 0x78);
  return null;
}

// Script 011: 5 arguments.
export function* giveWeapon(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    const t1 = yield* game.scriptAction(0x140);
    local5 = t1;
    if ((local5 & 0x100) === 0) {
      if ((local5 & 0x40) !== 0) {
        yield* run.promptGiveTo();
        const t2 = yield* game.scriptChooseNumber();
        local7 = t2;
        if (local7 !== 0xffff) {
          if ((yield* run.script197(local7)) === 0) {
            local9 = 0xcadd;
            if (local7 !== 0x189c) {
              if (local7 !== 0x145f) {
                if (local7 === 0x3b1) {
                  local9 = 0x1d;
                }
              } else {
                local9 = 0x18;
              }
            } else {
              local9 = 0x13;
            }
            if (local9 !== 0xcadd) {
              yield* game.setScriptVariable(0x1c, yield* game.getObjectNumber(object));
              yield* game.setScriptVariable(0x1e, local9);
              yield* game.talk(object, local9);
            } else {
              yield* run.refuseToGiveTo(local7);
            }
          } else {
            if (
              local7 !== (yield* game.getActorStateProperty(yield* game.getObjectNumber(object)))
            ) {
              yield* game.setItemPropertyAndUnequip(object, local7);
              if (local7 !== 0x8b2) {
                yield* game.notice(0xd, 0x15, 7, 3, 0x400, 0x16 /* "Thanks!" */, 0x78);
              } else {
                yield* game.notice(0xd, 0x15, 7, 3, 0x800, 0x16 /* "Thanks!" */, 0x78);
              }
            }
          }
        }
      }
    } else {
      if (!less(yield* game.getRunnerStrength(state.byte('MEMBER_OBJECT')), local4)) {
        yield* game.equipRunnerWeapon(object, local1, local2, signed(local3));
      } else {
        yield* game.notice(2, 0x15, 0xf, 3, 0x800, 0x14 /* "Not strong enough." */, 0xf0);
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 012: 1 argument.
export function* script012(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  for (;;) {
    const t1 = word((yield* game.randomBelow(5)) - 2);
    const t2 = word((yield* game.randomBelow(5)) - 2);
    yield* game.setObjectVelocity(object, t2, t1, 0);
    yield* game.wait(1, 1);
  }
}

// Script 013: 1 argument.
export function* script013(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(local0, 0x102, 0, 0x403, 0x903));
  return null;
}

// Script 014: 1 argument.
export function* script014(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(1, 6);
    if ((yield* game.getDistanceToPlayer(object)) <= 0x32) {
      if (((yield* game.randomByte()) & 7) === 1) {
        yield* game.playSoundEffect(object, 0x60, 0xff, 3);
      }
      yield* game.setObjectAnimation(object, 1);
      const t1 = word(((yield* game.randomByte()) & 7) - 3);
      const t2 = word(((yield* game.randomByte()) & 7) - 3);
      yield* game.setObjectVelocity(object, t2, t1, 5);
      yield* game.wait(1, 0x78);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 015: 1 argument.
export function* script015(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 5);
  for (;;) {
    yield* game.setObjectFlagBits(object, 0x140);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(object, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(8, 0);
    yield* game.keepObjectFlagBits(object, 0xfebf);
    yield* game.wait(0x400, 0);
    yield* game.playSoundEffect(object, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(object, 6);
  }
}

// Script 016: 1 argument.
export function* script016(state, arg0) {
  let object = 0,
    local1 = 0,
    count = 0,
    local4 = 0,
    object2 = 0,
    local7 = 0;
  object = arg0 & 0xff;
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  local7 = (yield* game.getObjectCoarseY(object)) & 0xff;
  if (
    (truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x97))) &
      truth((yield* game.getObjectCoarseX(signed(local7))) > 0x1b8) &
      truth(less(yield* game.getObjectCoarseX(signed(local7)), 0x23a)) &
      truth((yield* game.getObjectCoarseY(signed(local7))) > 0x1ae)) ===
    0
  ) {
    local4 = 0;
  } else {
    local4 = 0x14;
  }
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object2), 2);
  const t2 = shiftLeft(word((yield* game.getObjectCoarseY(object2)) - local4), 2);
  const t3 = shiftLeft(word((yield* game.getObjectCoarseX(object2)) - local4), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.moveObjectStraightToObject(object, signed(local7));
  count = 0x32;
  for (;;) {
    if (!less(yield* game.getDistanceBetweenObjects(object, signed(local7)), 0xf)) {
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
      count = word(count - 1);
    } else {
      yield* game.shootAtObject(object, signed(local7), 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
      count = 0;
    }
    if ((signed(local1) | truth(count === 0)) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 017: 1 argument.
export function* script017(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x200 | local0, 0x201, 0x23a, 0x403, 0x903));
  yield* game.notice(3, 7, 0xd, 3, 0x400, 0x23e /* "Ugh! Get them....." */, 0x78);
  return null;
}

// Script 018: 1 argument.
export function* script018(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x100 | local0, 0x103, 0x23b, 0x403, 0x903));
  return null;
}

// Script 019: 1 argument.
export function* script019(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x100 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01A: 1 argument.
export function* script01A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    block85: {
      if (
        ((truth(((yield* game.randomByte()) & 3) !== 0) ^ 0xffff) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x224)) !==
        0
      ) {
        yield* game.setObjectActionAndDirection(object, 0, 0);
        yield* game.keepObjectFlagBits(object, 0xdebf);
        yield* game.setObjectRecordFlags(object, 1);
        yield* game.wait(1, 0x28);
        for (;;) {
          yield* game.setObjectVelocity(object, 0, 8, 0);
          yield* game.wait(1, 0xa);
          if ((yield* game.getObjectCoarseY(object)) > 0x264) {
            yield* game.clearObjectVelocity(object);
            break block85;
          }
        }
      }
    }
    yield* game.removeObject(object);
    return null;
  }
  yield* game.resetObjectRecordProperty(object);
  return null;
}

// Script 01B: 1 argument.
export function* script01B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x48);
  for (;;) {
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectActionAndDirection(object, 0, 7);
    } else {
      yield* game.setObjectActionAndDirection(object, 0, 0);
    }
    yield* game.wait(0xa, 0);
  }
}

// Script 01C: 1 argument.
export function* script01C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x300 | local0, 0x300, 0, 0x403, 0x903));
  return null;
}

// Script 01D: 1 argument.
export function* script01D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x200 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01E: 1 argument.
export function* script01E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x100 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01F: 1 argument.
export function* script01F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveWeapon(local0, 0, 8, 2, 4);
  return null;
}
