// Scripts 000 to 01F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 000: 1 argument.
export function* script000(state, arg0) {
  let local0 = 0,
    local1 = 0,
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
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) === 0) {
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.wait(1, 0xf0);
  local1 = 0xf;
  local3 = 0x28;
  for (;;) {
    yield* game.wait(1, local3);
    yield* sub5(0xffff);
    yield* sub5(0);
    if ((local1 & 3) === 0) {
      local3 = word(local3 - 4);
    }
    local1 = word(local1 - 1);
    if (local1 === 0) {
      local1 = 0xc;
      local3 = 0;
      for (;;) {
        yield* game.wait(1, 8);
        yield* sub120();
        local3 = word(local3 + 8);
        local1 = word(local1 - 1);
        if (local1 === 0) {
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
  yield* script(0x157, local0, 3, 0xa, 1, 0);
  return null;
}

// Script 002: no arguments.
export function* script002(state) {
  const t1 = yield* script(0x03f, 0xbb8, 0xa8c, 0x960);
  const t2 = yield* script(0x0b2, 0x175, 0x176, 0x177);
  yield* script(0x162, 0xb52, t2, t1, 0x174, 0x173);
  return null;
}

// Script 003: 1 argument.
export function* script003(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectDialog(local0, 0x80);
  yield* game.wait(2, 0);
  return null;
}

// Script 004: 1 argument.
export function* script004(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x231, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 005: 2 arguments, returns a word.
export function* script005(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  for (;;) {
    local3 = truth(((yield* game.wait(0x805, 4)) & 0x800) !== 0) & 0xff;
    local1 = word(local1 - 1);
    if (less(yield* game.getDistanceToPlayer(local0), 0xf)) {
      local1 = 0;
      yield* game.shootAtObject(local0, yield* game.getPlayerObject(), 2, 5, 5, 1);
      local3 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
    }
    if ((truth(local1 === 0) | signed(local3)) !== 0) {
      return signed(local3);
    }
  }
}

// Script 006: 1 argument.
export function* script006(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
  }
}

// Script 007: 1 argument.
export function* script007(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.wait(0x800, 0);
  yield* script(0x35d, local0);
  return null;
}

// Script 008: 1 argument.
export function* script008(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x81);
  for (;;) {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 7);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(local0);
  }
}

// Script 009: 1 argument.
export function* script009(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x179, local0, 0x2a0);
  return null;
}

// Script 00A: 5 arguments.
export function* script00A(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0;
  function* sub13() {
    if (local6 === 1) {
      yield* game.setScriptVariableBits(local2, 1);
    }
    if (local6 === 7) {
      yield* game.keepScriptVariableBits(local2, 0);
    }
    if (((yield* game.getScriptVariable(local2)) & 1) === 0) {
      local6 = word(local6 - 1);
    } else {
      local6 = word(local6 + 1);
    }
    if (local6 === 1) {
      yield* game.setScriptVariableBits(local2, 1);
    }
    if (local6 === 7) {
      yield* game.keepScriptVariableBits(local2, 0);
    }
    yield* game.setScriptVariable(local1, local6);
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4;
  block182: {
    yield* game.keepActorStateFlagBits(local4, local3 ^ 0xffff);
    local6 = yield* game.getScriptVariable(local1);
    yield* sub13();
    yield* game.setObjectActionAndDirection(local0, word(local6 - 1), 0);
    yield* game.wait(1, 5);
    if (((yield* game.getActorStateFlags(local4)) & local3) === 0) {
      for (;;) {
        yield* sub13();
        yield* game.setObjectAnimation(local0, word(local6 - 1));
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
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 00B: 5 arguments.
export function* script00B(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  function* sub13() {
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = word((yield* game.getObjectCoarseY(local0)) - 0xa);
    const t3 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0xdc, t3, t2, t1, 0x104);
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
  yield* game.setObjectActionAndDirection(local0, 4, 3);
  yield* game.setObjectFlagBits(local0, 0xa000);
  yield* game.setSpriteMode(local0, 0x8001);
  if ((local3 & 0x40) === 0) {
    yield* game.startWaveSwarm(local0);
  } else {
    yield* game.startWaveSwarm(local0 | 1);
  }
  local5 = 0;
  local7 = 0;
  local9 = 0;
  yield* game.appendToFightList(local0);
  for (;;) {
    local5 = word(local5 + 1);
    local7 = word(local7 + 1);
    if (local7 !== 0x64) {
      if (local7 !== 0xb4) {
        if (local7 !== 0xdc) {
          if (local7 !== 0xf0) {
            if (local7 === 0x12c) {
              yield* game.setObjectActionAndDirection(local0, 4, 3);
              local7 = 0;
              yield* sub13();
            }
          } else {
            yield* game.setObjectActionAndDirection(local0, 1, 3);
            yield* sub13();
          }
        } else {
          yield* game.setObjectActionAndDirection(local0, 2, 7);
        }
      } else {
        yield* game.setObjectActionAndDirection(local0, 4, 7);
      }
    } else {
      yield* game.setObjectActionAndDirection(local0, 2, 3);
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
      yield* game.fightListRemove(local0);
      yield* game.keepObjectFlagBits(local0, 0x5fff);
      yield* game.setObjectRecordFlagBits(local0, 1);
      yield* game.setObjectActionAndDirection(local0, 2, 3);
      yield* game.setObjectVelocity(local0, 0, 0xfffb, 8);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x14);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      if ((local3 & 0x80) === 0) {
        yield* game.resetObjectRecordProperty(local0);
      }
      return null;
    }
  }
}

// Script 00C: 1 argument, returns a word.
export function* script00C(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffef);
  yield* game.turnObjectToObject(local0, yield* game.getPlayerObjectCopy());
  yield* game.setObjectAnimation(local0, 7);
  const t1 = yield* game.wait(0x808, 0);
  local1 = t1;
  if ((local1 & 8) === 0) {
    yield* game.setObjectAnimation(local0, 0);
  } else {
    yield* game.setObjectAnimation(local0, 4);
    const t2 = yield* game.wait(0x801, 0xa);
    local1 = t2;
    if ((local1 & 1) === 0) {
      yield* game.setObjectAnimation(local0, 0);
    } else {
      yield* game.turnObjectToObject(local0, yield* game.getPlayerObjectCopy());
      yield* game.createObject(0x10a, local0, yield* game.getPlayerObjectCopy(), 0, 0x12a);
      yield* game.setObjectAnimation(local0, 8);
      local1 = yield* game.wait(0x801, 1);
    }
  }
  return truth((local1 & 0x800) !== 0);
}

// Script 00D: 1 argument.
export function* script00D(state, arg0) {
  let local0 = 0,
    local1 = 0;
  function* sub19() {
    yield* game.setObjectAnimation(local0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x28));
    yield* game.setObjectAnimation(local0, 1);
  }
  function* sub5(in0) {
    local1 = in0 & 0xff;
    yield* game.moveObjectToWaypoint(local0, local1);
    yield* game.wait(6, 0);
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x3f);
  yield* game.setObjectDirection(local0, 0);
  yield* game.placeObjectOnWaypoint(local0, 5);
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
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  function* sub5(in0) {
    local3 = in0 & 0xff;
    yield* game.setObjectAnimation(local0, 2);
    yield* game.moveObjectToWaypoint(local0, local3);
    const t1 = truth(((yield* game.wait(6, 0)) & 2) !== 0);
    local2 = t1 & 0xff;
    if (t1 === 0) {
      yield* game.setObjectDirection(local0, 4);
      yield* game.setObjectAnimation(local0, 0);
      const t2 = truth(((yield* game.wait(3, 0x14)) & 2) !== 0);
      local2 = t2 & 0xff;
      if (t2 === 0) {
        block211: {
          if (((yield* game.randomByte()) & 1) === 0) {
            local1 = 5;
            for (;;) {
              yield* game.setObjectDirection(local0, local1);
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
                local4 = yield* game.getObjectCoarseX(local0);
                local6 = yield* game.getObjectCoarseY(local0);
                local8 = yield* game.getObjectCoarseHeight(local0);
                yield* game.placeObjectOnWaypoint(local0, 3);
                yield* game.createObject(0x96, local4, local6, local8, 0x27e);
                local2 = truth(((yield* game.wait(3, 0xb4)) & 2) !== 0) & 0xff;
                break block211;
              }
            }
          } else {
            yield* game.setObjectAnimation(local0, 3);
            yield* game.setObjectDirection(local0, 0);
            const t3 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0);
            local2 = t3 & 0xff;
            if (t3 === 0) {
              yield* game.setObjectDirection(local0, 6);
              local2 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0) & 0xff;
            }
          }
        }
        local1 = local3 & 0xff;
        yield* game.placeObjectOnWaypoint(local0, local3);
      }
    }
  }
  function* sub220() {
    yield* game.placeObjectOnWaypoint(local0, 3);
    yield* game.wait(1, 0xf);
    yield* game.placeObjectOnWaypoint(local0, 4);
  }
  local0 = arg0 & 0xff;
  block388: {
    yield* game.keepObjectFlagBits(local0, 0xde9f);
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0xb52)) & 0x80) === 0) {
      yield* game.setObjectRecordFlags(local0, 0);
      local1 = 0;
      yield* game.placeObjectOnWaypoint(local0, 0);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
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
          yield* game.stopMotion(local0);
          yield* game.clearObjectVelocity(local0);
          yield* game.setObjectActionAndDirection(local0, 0, 0);
          const t4 = yield* game.getObjectCoarseHeight(local0);
          const t5 = yield* game.getObjectCoarseY(local0);
          const t6 = yield* game.getObjectCoarseX(local0);
          yield* game.createObject(0x56, t6, t5, t4, 0x149);
          yield* game.wait(1, 0xa);
          yield* sub220();
          const t7 = yield* game.getObjectCoarseHeight(local0);
          const t8 = yield* game.getObjectCoarseY(local0);
          const t9 = yield* game.getObjectCoarseX(local0);
          yield* game.createObject(0x56, t9, t8, t7, 0x149);
          yield* sub220();
          yield* game.setObjectFlags(local0, 0);
          yield* script(0x1f1, local0);
          break block388;
        }
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 00F: 5 arguments.
export function* script00F(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
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
    yield* game.setObjectAnimation(local0, 2);
    if (local5 !== 0) {
      yield* game.stopMotion(local0);
    } else {
      yield* game.moveObjectStraightToPlayer(local0);
    }
    if (local5 !== 2) {
      local7 = 120;
    } else {
      local7 = 70;
    }
    local8 = 0;
    for (;;) {
      if (
        (truth((yield* game.chooseEnemyTarget(local0)) === 0xffff) & (signed(local6) ^ 0xffff)) !==
        0
      ) {
        yield* game.notice(0xa, 4, 0xc, 3, 0x400, 0x254, 0x78);
        local6 = 255;
      }
      if (local8 > 0x1f) {
        local8 = 0;
      }
      if (local5 > 0) {
        local11 = (yield* game.getDirectionToPlayer(local0)) & 0xff;
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
        yield* game.turnObjectToPlayer(local0);
        yield* game.setObjectVelocity(local0, local12, local14, 0);
      }
      const t1 = yield* game.wait(0x805, 1);
      local9 = t1;
      if ((local9 & 0x800) === 0) {
        if (local8 === 8) {
          yield* game.playSoundEffect(local0, 0x42, 0xff, 0xff);
          yield* game.shootAtObject(
            local0,
            yield* game.getPlayerObjectCopy(),
            local1,
            local2,
            local3,
            signed(local4),
          );
        }
        if (
          (truth(local7 === 0) |
            truth(less(yield* game.getDistanceToPlayer(local0), 0x28) && less(local7, 0x28)) |
            (truth(
              ((yield* game.getObjectVelocityX(local0)) |
                (yield* game.getObjectVelocityY(local0))) !==
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
  local0 = arg0 & 0xff;
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
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 2);
  yield* game.notice(4, 5, 0x15, 3, 0x400, 0x238, 0xc8);
  yield* script(0x1bc, yield* script(0x27c, 0x200 | local0, 1, 0x239, 0x403, 0x903));
  yield* game.notice(3, 7, 0x11, 3, 0x400, 0x23d, 0x78);
  return null;
}

// Script 011: 5 arguments.
export function* script011(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
    const t1 = yield* game.scriptAction(0x140);
    local5 = t1;
    if ((local5 & 0x100) === 0) {
      if ((local5 & 0x40) !== 0) {
        yield* script(0x240);
        const t2 = yield* game.scriptChooseNumber();
        local7 = t2;
        if (local7 !== 0xffff) {
          if ((yield* script(0x197, local7)) === 0) {
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
              yield* game.setScriptVariable(0x1c, yield* game.getObjectNumber(local0));
              yield* game.setScriptVariable(0x1e, local9);
              yield* game.talk(local0, local9);
            } else {
              yield* script(0x1b1, local7);
            }
          } else {
            if (
              local7 !== (yield* game.getActorStateProperty(yield* game.getObjectNumber(local0)))
            ) {
              yield* game.setItemPropertyAndUnequip(local0, local7);
              if (local7 !== 0x8b2) {
                yield* game.notice(0xd, 0x15, 7, 3, 0x400, 0x16, 0x78);
              } else {
                yield* game.notice(0xd, 0x15, 7, 3, 0x800, 0x16, 0x78);
              }
            }
          }
        }
      }
    } else {
      if (!less(yield* game.getRunnerStrength(state.byte('MEMBER_OBJECT')), local4)) {
        yield* game.equipRunnerWeapon(local0, local1, local2, signed(local3));
      } else {
        yield* game.notice(2, 0x15, 0xf, 3, 0x800, 0x14, 0xf0);
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 012: 1 argument.
export function* script012(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  for (;;) {
    const t1 = word((yield* game.randomBelow(5)) - 2);
    const t2 = word((yield* game.randomBelow(5)) - 2);
    yield* game.setObjectVelocity(local0, t2, t1, 0);
    yield* game.wait(1, 1);
  }
}

// Script 013: 1 argument.
export function* script013(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, local0, 0x102, 0, 0x403, 0x903));
  return null;
}

// Script 014: 1 argument.
export function* script014(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    yield* game.wait(1, 6);
    if ((yield* game.getDistanceToPlayer(local0)) <= 0x32) {
      if (((yield* game.randomByte()) & 7) === 1) {
        yield* game.playSoundEffect(local0, 0x60, 0xff, 3);
      }
      yield* game.setObjectAnimation(local0, 1);
      const t1 = word(((yield* game.randomByte()) & 7) - 3);
      const t2 = word(((yield* game.randomByte()) & 7) - 3);
      yield* game.setObjectVelocity(local0, t2, t1, 5);
      yield* game.wait(1, 0x78);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 015: 1 argument.
export function* script015(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  for (;;) {
    yield* game.setObjectFlagBits(local0, 0x140);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 0);
    yield* game.keepObjectFlagBits(local0, 0xfebf);
    yield* game.wait(0x400, 0);
    yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(local0, 6);
  }
}

// Script 016: 1 argument.
export function* script016(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local7 = 0;
  local0 = arg0 & 0xff;
  local6 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  local7 = (yield* game.getObjectCoarseY(local0)) & 0xff;
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
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local6), 2);
  const t2 = shiftLeft(word((yield* game.getObjectCoarseY(local6)) - local4), 2);
  const t3 = shiftLeft(word((yield* game.getObjectCoarseX(local6)) - local4), 2);
  yield* game.setObjectPosition(local0, t3, t2, t1);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.moveObjectStraightToObject(local0, signed(local7));
  local2 = 0x32;
  for (;;) {
    if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local7)), 0xf)) {
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
      local2 = word(local2 - 1);
    } else {
      yield* game.shootAtObject(local0, signed(local7), 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
      local2 = 0;
    }
    if ((signed(local1) | truth(local2 === 0)) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 017: 1 argument.
export function* script017(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x200 | local0, 0x201, 0x23a, 0x403, 0x903));
  yield* game.notice(3, 7, 0xd, 3, 0x400, 0x23e, 0x78);
  return null;
}

// Script 018: 1 argument.
export function* script018(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x100 | local0, 0x103, 0x23b, 0x403, 0x903));
  return null;
}

// Script 019: 1 argument.
export function* script019(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x100 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01A: 1 argument.
export function* script01A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    block85: {
      if (
        ((truth(((yield* game.randomByte()) & 3) !== 0) ^ 0xffff) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x224)) !==
        0
      ) {
        yield* game.setObjectActionAndDirection(local0, 0, 0);
        yield* game.keepObjectFlagBits(local0, 0xdebf);
        yield* game.setObjectRecordFlags(local0, 1);
        yield* game.wait(1, 0x28);
        for (;;) {
          yield* game.setObjectVelocity(local0, 0, 8, 0);
          yield* game.wait(1, 0xa);
          if ((yield* game.getObjectCoarseY(local0)) > 0x264) {
            yield* game.clearObjectVelocity(local0);
            break block85;
          }
        }
      }
    }
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.resetObjectRecordProperty(local0);
  return null;
}

// Script 01B: 1 argument.
export function* script01B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x48);
  for (;;) {
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 7);
    } else {
      yield* game.setObjectActionAndDirection(local0, 0, 0);
    }
    yield* game.wait(0xa, 0);
  }
}

// Script 01C: 1 argument.
export function* script01C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x300 | local0, 0x300, 0, 0x403, 0x903));
  return null;
}

// Script 01D: 1 argument.
export function* script01D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x200 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01E: 1 argument.
export function* script01E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x100 | local0, 1, 0, 0x403, 0x903));
  return null;
}

// Script 01F: 1 argument.
export function* script01F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 0, 8, 2, 4);
  return null;
}
