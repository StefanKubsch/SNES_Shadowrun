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
    block57: {
      local5 = in0 & 0xff;
      if (signed(local5) === 0) {
        yield* game.createObject(
          0x55,
          0x227,
          0x1c3,
          word(0x48 + (yield* game.randomBelow(0x20))),
          0x2be,
        );
        break block57;
      }
      yield* game.createObject(
        0x55,
        0x23e,
        0x1c3,
        word(0x48 + (yield* game.randomBelow(0x20))),
        0x2be,
      );
      break block57;
    }
    return;
  }
  function* sub120() {
    const t1 = word(word(0x1cb + (yield* game.randomBelow(0x10))) - local3);
    const t2 = word(0x231 + (yield* game.randomBelow(0x10)));
    yield* game.setSpriteMode(yield* game.createObject(0xb8, t2, t1, 0x40, 0x382), 0);
    return;
  }
  function* sub58() {
    const t3 = word(0x48 + (yield* game.randomBelow(0x20)));
    const t4 = word(0x1ba + (yield* game.randomBelow(0x10)));
    const t5 = word(0x226 + (yield* game.randomBelow(0x10)));
    yield* game.createObject(0x56, t5, t4, t3, 0x2be);
    return;
  }
  function* sub90() {
    const t6 = word(word(0x17e + local3) + (yield* game.randomBelow(0x14)));
    const t7 = word(0x21e - (yield* game.randomBelow(0x64)));
    yield* game.createObject(0xb8, t7, t6, 0x40, 0x382);
    return;
  }
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) === 0) {
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.wait(1, 0xf0);
  local1 = 0xf;
  local3 = 0x28;
  loop175: for (;;) {
    block207: {
      yield* game.wait(1, local3);
      yield* sub5(0xffff);
      yield* sub5(0);
      if ((local1 & 3) !== 0) {
        break block207;
      }
      local3 = word(local3 - 4);
      break block207;
    }
    const t8 = word(local1 - 1);
    local1 = t8;
    if (t8 !== 0) {
      continue loop175;
    }
    local1 = 0xc;
    local3 = 0;
    loop225: for (;;) {
      yield* game.wait(1, 8);
      yield* sub120();
      local3 = word(local3 + 8);
      const t9 = word(local1 - 1);
      local1 = t9;
      if (t9 !== 0) {
        continue loop225;
      }
      loop253: for (;;) {
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
          loop340: for (;;) {
            yield* sub90();
            yield* game.wait(1, 8);
            local3 = word(local3 + 8);
            continue loop340;
          }
        } else {
          yield* sub58();
          continue loop253;
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
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x231, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 005: 2 arguments, returns a word.
export function* script005(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  const t1 = arg1;
  local0 = arg0 & 0xff;
  local1 = t1;
  loop4: for (;;) {
    block62: {
      local3 = truth(((yield* game.wait(0x805, 4)) & 0x800) !== 0) & 0xff;
      local1 = word(local1 - 1);
      if (!less(yield* game.getDistanceToPlayer(local0), 0xf)) {
        break block62;
      }
      local1 = 0;
      const t2 = yield* game.getPlayerObject();
      const t3 = local0;
      yield* game.shootAtObject(t3, t2, 2, 5, 5, 1);
      local3 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
      break block62;
    }
    if ((truth(local1 === 0) | signed(local3)) === 0) {
      continue loop4;
    }
    return signed(local3);
  }
}

// Script 006: 1 argument.
export function* script006(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  loop15: for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
    continue loop15;
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
    block27: {
      if (local6 !== 1) {
        break block27;
      }
      yield* game.setScriptVariableBits(local2, 1);
      break block27;
    }
    block40: {
      if (local6 !== 7) {
        break block40;
      }
      yield* game.keepScriptVariableBits(local2, 0);
      break block40;
    }
    block64: {
      if (((yield* game.getScriptVariable(local2)) & 1) === 0) {
        local6 = word(local6 - 1);
        break block64;
      }
      local6 = word(local6 + 1);
      break block64;
    }
    block78: {
      if (local6 !== 1) {
        break block78;
      }
      yield* game.setScriptVariableBits(local2, 1);
      break block78;
    }
    block91: {
      if (local6 !== 7) {
        break block91;
      }
      yield* game.keepScriptVariableBits(local2, 0);
      break block91;
    }
    yield* game.setScriptVariable(local1, local6);
    return;
  }
  const t1 = arg4;
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4 & 0xff;
  local2 = t3 & 0xff;
  local3 = t2 & 0xff;
  local4 = t1;
  block182: {
    yield* game.keepActorStateFlagBits(local4, local3 ^ 0xffff);
    local6 = yield* game.getScriptVariable(local1);
    yield* sub13();
    yield* game.setObjectActionAndDirection(local0, word(local6 - 1), 0);
    yield* game.wait(1, 5);
    if (((yield* game.getActorStateFlags(local4)) & local3) !== 0) {
      break block182;
    }
    loop139: for (;;) {
      block171: {
        yield* sub13();
        yield* game.setObjectAnimation(local0, word(local6 - 1));
        yield* game.wait(1, 0x3c);
        if (((yield* game.randomByte()) & 1) === 0) {
          break block171;
        }
        yield* game.wait(1, 0x19);
        break block171;
      }
      if (((yield* game.getActorStateFlags(local4)) & local3) === 0) {
        continue loop139;
      }
      break block182;
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
    return;
  }
  const t4 = arg4;
  const t5 = arg3;
  const t6 = arg2;
  const t7 = arg1;
  local0 = arg0 & 0xff;
  local1 = t7 & 0xff;
  local2 = t6 & 0xff;
  local3 = t5 & 0xff;
  local4 = t4 & 0xff;
  block79: {
    yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
    yield* game.setObjectActionAndDirection(local0, 4, 3);
    yield* game.setObjectFlagBits(local0, 0xa000);
    yield* game.setSpriteMode(local0, 0x8001);
    if ((local3 & 0x40) === 0) {
      yield* game.native09(local0);
      break block79;
    }
    yield* game.native09(local0 | 1);
    break block79;
  }
  local5 = 0;
  local7 = 0;
  local9 = 0;
  yield* game.appendToFightList(local0);
  loop91: for (;;) {
    block197: {
      local5 = word(local5 + 1);
      const t8 = word(local7 + 1);
      local7 = t8;
      if (t8 !== 0x64) {
        if (local7 !== 0xb4) {
          if (local7 !== 0xdc) {
            if (local7 !== 0xf0) {
              if (local7 !== 0x12c) {
                break block197;
              }
              yield* game.setObjectActionAndDirection(local0, 4, 3);
              local7 = 0;
              yield* sub13();
              break block197;
            }
            yield* game.setObjectActionAndDirection(local0, 1, 3);
            yield* sub13();
            break block197;
          }
          yield* game.setObjectActionAndDirection(local0, 2, 7);
          break block197;
        }
        yield* game.setObjectActionAndDirection(local0, 4, 7);
        break block197;
      }
      yield* game.setObjectActionAndDirection(local0, 2, 3);
      break block197;
    }
    block212: {
      if (local5 !== 0x64) {
        break block212;
      }
      yield* game.moveSwarmWave(1, 0, 0, 0);
      break block212;
    }
    block231: {
      if (local5 !== 0x320) {
        break block231;
      }
      local5 = 0;
      yield* game.moveSwarmWave(1, 1, 0, 0);
      break block231;
    }
    block259: {
      if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
        yield* game.moveSwarmWave(0, 0, 0, 0);
        break block259;
      }
      local9 = 255;
      break block259;
    }
    if (signed(local9) === 0) {
      continue loop91;
    }
    block333: {
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
      if ((local3 & 0x80) !== 0) {
        break block333;
      }
      yield* game.resetObjectRecordProperty(local0);
      break block333;
    }
    return null;
  }
}

// Script 00C: 1 argument, returns a word.
export function* script00C(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block101: {
    local0 = arg0 & 0xff;
    yield* game.keepObjectFlagBits(local0, 0xffef);
    const t1 = yield* game.getPlayerObjectCopy();
    const t2 = local0;
    yield* game.turnObjectToObject(t2, t1);
    yield* game.setObjectAnimation(local0, 7);
    const t3 = yield* game.wait(0x808, 0);
    local1 = t3;
    if ((t3 & 8) === 0) {
      yield* game.setObjectAnimation(local0, 0);
      break block101;
    }
    block94: {
      yield* game.setObjectAnimation(local0, 4);
      const t4 = yield* game.wait(0x801, 0xa);
      local1 = t4;
      if ((t4 & 1) === 0) {
        yield* game.setObjectAnimation(local0, 0);
        break block94;
      }
      const t5 = yield* game.getPlayerObjectCopy();
      const t6 = local0;
      yield* game.turnObjectToObject(t6, t5);
      const t7 = yield* game.getPlayerObjectCopy();
      const t8 = local0;
      yield* game.createObject(0x10a, t8, t7, 0, 0x12a);
      yield* game.setObjectAnimation(local0, 8);
      local1 = yield* game.wait(0x801, 1);
      break block94;
    }
    break block101;
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
    return;
  }
  function* sub5(in0) {
    local1 = in0 & 0xff;
    yield* game.native1D(local0, local1);
    yield* game.wait(6, 0);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x3f);
  yield* game.setObjectDirection(local0, 0);
  yield* game.placeObjectOnWaypoint(local0, 5);
  loop56: for (;;) {
    yield* sub19();
    yield* sub5(7);
    yield* sub5(8);
    yield* sub5(6);
    yield* sub19();
    yield* sub5(8);
    yield* sub5(5);
    continue loop56;
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
    block219: {
      local3 = in0 & 0xff;
      yield* game.setObjectAnimation(local0, 2);
      yield* game.native1D(local0, local3);
      const t1 = truth(((yield* game.wait(6, 0)) & 2) !== 0);
      local2 = t1 & 0xff;
      if (t1 !== 0) {
        break block219;
      }
      yield* game.setObjectDirection(local0, 4);
      yield* game.setObjectAnimation(local0, 0);
      const t2 = truth(((yield* game.wait(3, 0x14)) & 2) !== 0);
      local2 = t2 & 0xff;
      if (t2 !== 0) {
        break block219;
      }
      block211: {
        if (((yield* game.randomByte()) & 1) === 0) {
          local1 = 5;
          loop113: for (;;) {
            block149: {
              yield* game.setObjectDirection(local0, local1);
              local2 = truth(((yield* game.wait(3, 0x10)) & 2) !== 0) & 0xff;
              if (local1 !== 0) {
                local1 = word(local1 - 1) & 0xff;
                break block149;
              }
              local1 = 7;
              break block149;
            }
            if ((truth(local1 === 6) | signed(local2)) === 0) {
              continue loop113;
            }
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
        } else {
          block106: {
            yield* game.setObjectAnimation(local0, 3);
            yield* game.setObjectDirection(local0, 0);
            const t3 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0);
            local2 = t3 & 0xff;
            if (t3 !== 0) {
              break block106;
            }
            yield* game.setObjectDirection(local0, 6);
            local2 = truth(((yield* game.wait(0xa, 0)) & 2) !== 0) & 0xff;
            break block106;
          }
          break block211;
        }
      }
      const t4 = local3;
      local1 = local3 & 0xff;
      yield* game.placeObjectOnWaypoint(local0, t4);
      break block219;
    }
    return;
  }
  function* sub220() {
    yield* game.placeObjectOnWaypoint(local0, 3);
    yield* game.wait(1, 0xf);
    yield* game.placeObjectOnWaypoint(local0, 4);
    return;
  }
  local0 = arg0 & 0xff;
  block388: {
    yield* game.keepObjectFlagBits(local0, 0xde9f);
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0xb52)) & 0x80) !== 0) {
      break block388;
    }
    yield* game.setObjectRecordFlags(local0, 0);
    local1 = 0;
    yield* game.placeObjectOnWaypoint(local0, 0);
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    local2 = 0;
    loop281: for (;;) {
      block317: {
        if (local1 !== 0) {
          yield* sub5(0);
          break block317;
        }
        block310: {
          if (((yield* game.randomByte()) & 1) === 0) {
            yield* sub5(2);
            break block310;
          }
          yield* sub5(1);
          break block310;
        }
        break block317;
      }
      if (signed(local2) === 0) {
        continue loop281;
      }
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      const t5 = yield* game.getObjectCoarseHeight(local0);
      const t6 = yield* game.getObjectCoarseY(local0);
      const t7 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0x56, t7, t6, t5, 0x149);
      yield* game.wait(1, 0xa);
      yield* sub220();
      const t8 = yield* game.getObjectCoarseHeight(local0);
      const t9 = yield* game.getObjectCoarseY(local0);
      const t10 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0x56, t10, t9, t8, 0x149);
      yield* sub220();
      yield* game.setObjectFlags(local0, 0);
      yield* script(0x1f1, local0);
      break block388;
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
    block34: {
      yield* game.setObjectAnimation(local0, 2);
      if (local5 !== 0) {
        yield* game.stopMotion(local0);
        break block34;
      }
      yield* game.moveObjectStraightToPlayer(local0);
      break block34;
    }
    block53: {
      if (local5 !== 2) {
        local7 = 120;
        break block53;
      }
      local7 = 70;
      break block53;
    }
    local8 = 0;
    loop56: for (;;) {
      block91: {
        if (
          (truth((yield* game.chooseEnemyTarget(local0)) === 0xffff) &
            (signed(local6) ^ 0xffff)) ===
          0
        ) {
          break block91;
        }
        yield* game.notice(0xa, 4, 0xc, 3, 0x400, 0x254, 0x78);
        local6 = 255;
        break block91;
      }
      block102: {
        if (local8 <= 0x1f) {
          break block102;
        }
        local8 = 0;
        break block102;
      }
      block453: {
        if (local5 <= 0) {
          break block453;
        }
        block272: {
          local11 = (yield* game.getDirectionToPlayer(local0)) & 0xff;
          if ((truth(local5 === 1) | truth(local5 === 3)) === 0) {
            break block272;
          }
          if (local11 !== 0) {
            if (local11 !== 1) {
              if (local11 !== 2) {
                if (local11 !== 3) {
                  if (local11 !== 4) {
                    if (local11 !== 5) {
                      if (local11 !== 6) {
                        if (local11 !== 7) {
                          break block272;
                        }
                        local12 = 4;
                        local14 = 4;
                        break block272;
                      }
                      local12 = 0;
                      local14 = 4;
                      break block272;
                    }
                    local12 = 0xfffc;
                    local14 = 4;
                    break block272;
                  }
                  local12 = 0xfffc;
                  local14 = 0;
                  break block272;
                }
                local12 = 0xfffc;
                local14 = 0xfffc;
                break block272;
              }
              local12 = 0;
              local14 = 0xfffc;
              break block272;
            }
            local12 = 4;
            local14 = 0xfffc;
            break block272;
          }
          local12 = 4;
          local14 = 0;
          break block272;
        }
        block424: {
          if (local5 !== 2) {
            break block424;
          }
          if (local11 !== 0) {
            if (local11 !== 1) {
              if (local11 !== 2) {
                if (local11 !== 3) {
                  if (local11 !== 4) {
                    if (local11 !== 5) {
                      if (local11 !== 6) {
                        if (local11 !== 7) {
                          break block424;
                        }
                        local12 = 4;
                        local14 = 0xfffc;
                        break block424;
                      }
                      local12 = 4;
                      local14 = 0;
                      break block424;
                    }
                    local12 = 4;
                    local14 = 4;
                    break block424;
                  }
                  local12 = 0;
                  local14 = 4;
                  break block424;
                }
                local12 = 0xfffc;
                local14 = 4;
                break block424;
              }
              local12 = 0xfffc;
              local14 = 0;
              break block424;
            }
            local12 = 0xfffc;
            local14 = 0xfffc;
            break block424;
          }
          local12 = 0;
          local14 = 0xfffc;
          break block424;
        }
        block442: {
          if (local5 !== 3) {
            break block442;
          }
          local12 = word(-local12);
          local14 = word(-local14);
          break block442;
        }
        yield* game.turnObjectToPlayer(local0);
        yield* game.setObjectVelocity(local0, local12, local14, 0);
        break block453;
      }
      const t1 = yield* game.wait(0x805, 1);
      local9 = t1;
      if ((t1 & 0x800) === 0) {
        block504: {
          if (local8 !== 8) {
            break block504;
          }
          yield* game.playSoundEffect(local0, 0x42, 0xff, 0xff);
          const t2 = signed(local4);
          const t3 = local3;
          const t4 = local2;
          const t5 = local1;
          const t6 = yield* game.getPlayerObjectCopy();
          const t7 = local0;
          yield* game.shootAtObject(t7, t6, t5, t4, t3, t2);
          break block504;
        }
        if (
          (truth(local7 === 0) |
            (truth(less(yield* game.getDistanceToPlayer(local0), 0x28)) &
              truth(less(local7, 0x28))) |
            (truth(
              ((yield* game.getObjectVelocityX(local0)) |
                (yield* game.getObjectVelocityY(local0))) !==
                0,
            ) ^
              0xffff) |
            truth((local9 & 4) !== 0)) !==
          0
        ) {
          block569: {
            const t8 = word(local5 + 1);
            local5 = t8 & 0xff;
            if (t8 !== 4) {
              break block569;
            }
            local5 = 0;
            break block569;
          }
          return 0;
        }
        local7 = word(local7 - 1) & 0xff;
        local8 = word(local8 + 1) & 0xff;
        continue loop56;
      }
      return 0xffff;
    }
  }
  const t9 = arg4;
  const t10 = arg3;
  const t11 = arg2;
  const t12 = arg1;
  local0 = arg0 & 0xff;
  local1 = t12 & 0xff;
  local2 = t11 & 0xff;
  local3 = t10 & 0xff;
  local4 = t9 & 0xff;
  local6 = 0;
  local5 = 0;
  loop577: for (;;) {
    if ((yield* sub13()) === 0) {
      continue loop577;
    }
    return null;
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
  block256: {
    const t1 = arg4;
    const t2 = arg3;
    const t3 = arg2;
    const t4 = arg1;
    local0 = arg0 & 0xff;
    local1 = t4 & 0xff;
    local2 = t3 & 0xff;
    local3 = t2 & 0xff;
    local4 = t1 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block256;
    }
    const t5 = yield* game.scriptAction(0x140);
    local5 = t5;
    if ((t5 & 0x100) === 0) {
      if ((local5 & 0x40) === 0) {
        break block256;
      }
      yield* script(0x240);
      const t6 = yield* game.scriptChooseNumber();
      local7 = t6;
      if (t6 === 0xffff) {
        break block256;
      }
      if ((yield* script(0x197, local7)) === 0) {
        block221: {
          local9 = 0xcadd;
          if (local7 !== 0x189c) {
            if (local7 !== 0x145f) {
              if (local7 !== 0x3b1) {
                break block221;
              }
              local9 = 0x1d;
              break block221;
            }
            local9 = 0x18;
            break block221;
          }
          local9 = 0x13;
          break block221;
        }
        if (local9 !== 0xcadd) {
          yield* game.setScriptVariable(0x1c, yield* game.getObjectNumber(local0));
          yield* game.setScriptVariable(0x1e, local9);
          yield* game.talk(local0, local9);
          break block256;
        }
        yield* script(0x1b1, local7);
        break block256;
      }
      block168: {
        if (local7 === (yield* game.getActorStateProperty(yield* game.getObjectNumber(local0)))) {
          break block168;
        }
        yield* game.setItemPropertyAndUnequip(local0, local7);
        if (local7 !== 0x8b2) {
          yield* game.notice(0xd, 0x15, 7, 3, 0x400, 0x16, 0x78);
          break block168;
        }
        yield* game.notice(0xd, 0x15, 7, 3, 0x800, 0x16, 0x78);
        break block168;
      }
      break block256;
    }
    block72: {
      if (!less(yield* game.getRunnerStrength(state.byte('MEMBER_OBJECT')), local4)) {
        yield* game.equipRunnerWeapon(local0, local1, local2, signed(local3));
        break block72;
      }
      yield* game.notice(2, 0x15, 0xf, 3, 0x800, 0x14, 0xf0);
      break block72;
    }
    break block256;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 012: 1 argument.
export function* script012(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  loop8: for (;;) {
    const t1 = word((yield* game.randomBelow(5)) - 2);
    const t2 = word((yield* game.randomBelow(5)) - 2);
    const t3 = local0;
    yield* game.setObjectVelocity(t3, t2, t1, 0);
    yield* game.wait(1, 1);
    continue loop8;
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
  loop14: for (;;) {
    yield* game.wait(1, 6);
    if ((yield* game.getDistanceToPlayer(local0)) > 0x32) {
      continue loop14;
    }
    block50: {
      if (((yield* game.randomByte()) & 7) !== 1) {
        break block50;
      }
      yield* game.playSoundEffect(local0, 0x60, 0xff, 3);
      break block50;
    }
    yield* game.setObjectAnimation(local0, 1);
    const t1 = word(((yield* game.randomByte()) & 7) - 3);
    const t2 = word(((yield* game.randomByte()) & 7) - 3);
    const t3 = local0;
    yield* game.setObjectVelocity(t3, t2, t1, 5);
    yield* game.wait(1, 0x78);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 015: 1 argument.
export function* script015(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  loop9: for (;;) {
    yield* game.setObjectFlagBits(local0, 0x140);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 0);
    yield* game.keepObjectFlagBits(local0, 0xfebf);
    yield* game.wait(0x400, 0);
    yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(local0, 6);
    continue loop9;
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
  block59: {
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
      break block59;
    }
    local4 = 0x14;
    break block59;
  }
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local6), 2);
  const t2 = shiftLeft(word((yield* game.getObjectCoarseY(local6)) - local4), 2);
  const t3 = shiftLeft(word((yield* game.getObjectCoarseX(local6)) - local4), 2);
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.moveObjectStraightToObject(local0, signed(local7));
  local2 = 0x32;
  loop103: for (;;) {
    block167: {
      if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local7)), 0xf)) {
        local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
        local2 = word(local2 - 1);
        break block167;
      }
      yield* game.shootAtObject(local0, signed(local7), 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
      local2 = 0;
      break block167;
    }
    if ((signed(local1) | truth(local2 === 0)) === 0) {
      continue loop103;
    }
    yield* game.removeObject(local0);
    return null;
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
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x224)) ===
        0
      ) {
        break block85;
      }
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.keepObjectFlagBits(local0, 0xdebf);
      yield* game.setObjectRecordFlags(local0, 1);
      yield* game.wait(1, 0x28);
      loop58: for (;;) {
        yield* game.setObjectVelocity(local0, 0, 8, 0);
        yield* game.wait(1, 0xa);
        if ((yield* game.getObjectCoarseY(local0)) <= 0x264) {
          continue loop58;
        }
        yield* game.clearObjectVelocity(local0);
        break block85;
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
  loop7: for (;;) {
    block30: {
      if (((yield* game.randomByte()) & 1) === 0) {
        yield* game.setObjectActionAndDirection(local0, 0, 7);
        break block30;
      }
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      break block30;
    }
    yield* game.wait(0xa, 0);
    continue loop7;
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
