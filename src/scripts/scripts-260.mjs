// Scripts 260 to 27F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 260: 1 argument.
export function* script260(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x25b, local0, 0x61a8, 0x21d, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x70) > 0) {
      yield* script(0x31c);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xd, 0x1e6, 0, 3);
  return null;
}

// Script 261: 1 argument.
export function* script261(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x3c) > 0) {
      yield* script(0x31c);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* script(0x25b, local0, 0xc350, 0x21e, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* script(0x25b, local0, 0x4e20, 0x21f, 4);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x25b, local0, 0x3a98, 0x220, 8);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xf, 0x1e7, 0, 3);
  return null;
}

// Script 262: 1 argument.
export function* script262(state, arg0) {
  let local0 = 0,
    local1 = 0;
  function* sub5(in0) {
    local1 = in0 & 0xff;
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(local0)));
    const t4 = yield* game.getObjectCoarseY(local0);
    const t5 = yield* game.getObjectCoarseX(local0);
    yield* game.setObjectVelocity(yield* game.createObject(0xe0, t5, t4, t3, 0x1ee), t2, t1, 8);
  }
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffdf);
  for (;;) {
    yield* game.wait(1, 2);
    if ((yield* game.getDistanceToPlayer(local0)) <= 0x28) {
      yield* game.appendToFightList(local0);
      if ((yield* script(0x093, local0)) !== 0) {
        yield* sub5(4);
        yield* sub5(8);
        yield* sub5(0xc);
        yield* sub5(0x10);
        yield* sub5(0x14);
        yield* sub5(0x18);
        yield* game.addKarma(2);
      }
      yield* game.fightListRemove(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 263: 1 argument.
export function* script263(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.wait(1, 0x32);
  yield* game.setObjectAnimation(local0, 2);
  yield* game.moveObjectStraightToWaypoint(local0, 0);
  yield* game.wait(5, 0x3c);
  yield* script(0x20b, local0);
  return null;
}

// Script 264: 1 argument.
export function* script264(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getActorStateFlags(0xadb)) & 1) !== 0) {
      yield* script(0x371, local0, 8, 9, 2, 0x80, 4, 0, 5);
      return null;
    }
  }
}

// Script 265: 1 argument.
export function* script265(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* script(0x0fe, 0x1585);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* script(0x0d1, 0x1577);
      yield* game.learnSpell(0x56);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x25b, local0, 0x2710, 0x224, 2);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 6, 0x1d2, 0, 2);
  return null;
}

// Script 266: 1 argument.
export function* script266(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(5, 0x14, 0x15, 3, 0x800, 0x225, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 267: 1 argument.
export function* script267(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x245, local0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x13, 0x16, 5, 0x800, 0x6c, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 268: 1 argument.
export function* script268(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block192: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 1, 3);
    yield* game.wait(1, 1);
    const t1 = yield* game.chooseEnemyTarget(local0);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.playSoundEffect(local0, 0x36, 0xff, 0xff);
      yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local2)));
      yield* game.clearObjectVelocity(local0);
      yield* game.removeObject(local0);
      const t2 = yield* game.createObject(0xc3, 0, 0, 0, 0xa1);
      local0 = t2 & 0xff;
      yield* script(0x0db, t2);
      local1 = 200;
      for (;;) {
        yield* game.wait(1, 1);
        yield* game.haltObject(signed(local2));
        const t3 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
        const t4 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
        const t5 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
        yield* game.setObjectPosition(local0, t5, t4, t3);
        const t6 = word(local1 - 1);
        local1 = word(local1 - 1) & 0xff;
        if (t6 === 0) {
          local1 = 60;
          for (;;) {
            yield* game.wait(1, 1);
            yield* game.haltObject(signed(local2));
            const t7 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
            const t8 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
            const t9 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
            yield* game.setObjectPosition(local0, t9, t8, t7);
            yield* game.wait(1, 1);
            yield* game.setObjectPosition(local0, 0, 0, 0);
            const t10 = word(local1 - 1);
            local1 = word(local1 - 1) & 0xff;
            if (t10 <= 0) {
              yield* game.resumeObject(signed(local2));
              break block192;
            }
          }
        }
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 269: 1 argument.
export function* script269(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x07a, 0x700 | local0, 0x506, 0x243, 0x306));
  return null;
}

// Script 26A: 1 argument.
export function* script26A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22a, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 26B: 1 argument.
export function* script26B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x31f, local0, 3);
  return null;
}

// Script 26C: 1 argument.
export function* script26C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerArmour(local0, 5);
  yield* game.wait(1, 1);
  yield* game.removeObject(local0);
  return null;
}

// Script 26D: no arguments.
export function* script26D(state) {
  yield* game.notice(2, 2, 0xc, 3, 0, 0, 0x78);
  return null;
}

// Script 26E: 1 argument.
export function* script26E(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  local1 = yield* game.getScriptVariable(8);
  yield* game.wait(1, local0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectFlagBits(local0, 0x2040);
  for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(local0, t2, t1, 0x10);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 26F: no arguments.
export function* script26F(state) {
  yield* script(0x10e, 0xe8);
  return null;
}

// Script 270: 1 argument.
export function* script270(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 0);
  yield* game.notice(4, 2, 0x19, 4, 0x400, 0xf8, 0xf0);
  yield* script(0x3a4, local0, 1);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x64);
  yield* script(0x045, local0, 6);
  yield* script(0x08b, 0xb4);
  return null;
}

// Script 271: 1 argument.
export function* script271(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlags(local0, 0x20);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.setObjectVelocity(local0, 0xfffa, 0, 0xf);
  local3 = yield* game.getObjectCoarseHeight(local0);
  for (;;) {
    local1 = local3;
    yield* game.wait(1, 1);
    local3 = yield* game.getObjectCoarseHeight(local0);
    if (local1 === local3) {
      yield* game.clearObjectVelocity(local0);
      for (;;) {
        local1 = local3;
        yield* game.wait(1, 0xa);
        local3 = yield* game.getObjectCoarseHeight(local0);
        if (local1 === local3) {
          yield* script(0x15e, local0);
          return null;
        }
      }
    }
  }
}

// Script 272: 1 argument.
export function* script272(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.moveObjectStraightToPlayer(local0);
  for (;;) {
    if (!less(yield* game.getDistanceToPlayer(local0), 0xf)) {
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
    } else {
      yield* game.shootAtObject(local0, yield* game.getPlayerObject(), 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 273: 1 argument.
export function* script273(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22b, 0xf0);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 274: 1 argument.
export function* script274(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 1);
  yield* game.setObjectAnimation(local0, 0);
  local1 = yield* game.getScriptVariable(8);
  yield* game.wait(1, local0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectFlagBits(local0, 0x2040);
  for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(local0, t2, t1, 0x10);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 275: 3 arguments.
export function* script275(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2;
  yield* game.setActorStateFlagBits(local2, 0x80);
  yield* game.setObjectFlagBits(local0, 0x20);
  yield* game.setSpriteMode(local0, 1);
  if ((yield* game.getScriptVariable(0x12)) !== 0) {
    const t1 = yield* game.findNearestVisibleMember(local0);
    local6 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local6)));
    } else {
      yield* game.wait(1, yield* game.jumpObjectTowardsPoint(local0, local1));
    }
  } else {
    yield* game.wait(1, yield* game.jumpObjectTowardsPoint(local0, local1));
  }
  yield* game.releaseObjectGraphics(local0);
  local4 = 8;
  for (;;) {
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0xeb, t4, t3, t2, 0x1e8);
    yield* game.wait(1, 0xa);
    local4 = word(local4 - 1);
    if (local4 === 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 276: 1 argument.
export function* script276(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = 0xc;
  for (;;) {
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(local0)));
    const t4 = yield* game.getObjectCoarseY(local0);
    const t5 = yield* game.getObjectCoarseX(local0);
    yield* game.setObjectVelocity(yield* game.createObject(0xe0, t5, t4, t3, 0x1ee), t2, t1, 8);
    local1 = word(local1 - 4);
    if (local1 === 0) {
      return null;
    }
  }
}

// Script 277: 1 argument.
export function* script277(state, arg0) {
  let local0 = 0;
  block100: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      yield* game.setObjectFlagBits(local0, 0x100);
      yield* game.setObjectActionAndDirection(local0, 2, 5);
      for (;;) {
        if ((yield* game.wait(0x201, 1)) !== 1) {
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.setObjectAnimation(local0, 4);
          yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
          yield* game.wait(8, 0);
          yield* game.keepObjectFlagBits(local0, 0xfeff);
          break block100;
        }
      }
    } else {
      yield* game.setObjectActionAndDirection(local0, 0, 5);
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 278: 1 argument.
export function* script278(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x07a, 0x800 | local0, 0x607, 0x244, 0x306));
  return null;
}

// Script 279: 1 argument.
export function* script279(state, arg0) {
  let local0 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  function* sub5(in0, in1, in2, in3, in4) {
    local3 = in0 & 0xff;
    local4 = in1 & 0xff;
    local5 = in2;
    local7 = in3;
    local9 = in4;
    yield* game.setObjectActionAndDirection(local0, local3, local4);
    yield* game.setObjectVelocity(local0, local5, local7, local9);
  }
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.moveObjectToWaypoint(local0, 0);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 8, 0);
    yield* game.wait(8, 0);
    yield* game.setActorStateFlagBits(0x3a3, 0x80);
    yield* game.setActorStateFlagBits(0x7ee, 0x80);
    yield* game.wait(1, 2);
    yield* sub5(1, 2, 2, 0, 0);
    yield* game.wait(1, 0x14);
    yield* sub5(0, 0, 0, 0, 0);
    yield* game.wait(1, 0x1e0);
    yield* game.setActorStateFlagBits(0x3a3, 0x80);
    yield* game.setObjectDirection(local0, 0);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 1);
    yield* sub5(0, 6, 0, 0, 0);
    yield* game.wait(1, 0x78);
    yield* sub5(1, 4, 0, 0xfffe, 0);
    yield* game.wait(1, 0x19);
    yield* game.setObjectActionAndDirection(local0, 1, 3);
    yield* game.moveObjectStraightToWaypoint(local0, 1);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 1, 2);
    yield* game.moveObjectToWaypoint(local0, 5);
    yield* game.wait(1, 0xf);
    yield* game.setActorStateFlagBits(0xf5, 0x80);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 1);
    yield* game.setObjectRecordFlagBits(local0, 1);
    yield* game.wait(1, 0x1cc);
    for (;;) {
      yield* game.wait(1, 5);
      if (((yield* game.getObjectRecordFlags(local0)) & 2) !== 0) {
        yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
        yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
        yield* sub5(6, 0, 2, 0, 0);
        yield* game.wait(1, 0x14);
        yield* game.setObjectAnimation(local0, 2);
        yield* game.moveObjectToWaypoint(local0, 6);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setActorStateFlagBits(0xaf, 0x80);
        yield* game.removeObject(local0);
        return null;
      }
    }
  } else {
    yield* game.placeObjectOnWaypoint(local0, 2);
    yield* game.setObjectActionAndDirection(local0, 0, 3);
    for (;;) {
      yield* game.wait(1, 2);
      if ((yield* game.getDistanceToPlayer(local0)) <= 0x50) {
        if (signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) === 0) {
          yield* game.setObjectDirection(local0, 4);
          yield* game.wait(1, 0x1e);
          yield* game.notice(2, 2, 0xf, 3, 0x400, 0x57, 0xf0);
          yield* game.setActorStateFlagBits(0x7ee, 2);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          yield* game.wait(1, 0x1e);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.moveObjectToWaypoint(local0, 6);
          yield* game.wait(1, 0xa);
          yield* game.setActorStateFlagBits(0xaf, 0x80);
          yield* game.wait(4, 0);
          yield* game.stopMotion(local0);
          yield* game.removeObject(local0);
          return null;
        }
        for (;;) {
          yield* game.wait(2, 0);
          if (((yield* game.getObjectRecordFlags(local0)) & 4) === 0) {
            if (((yield* game.getActorStateFlags(0xb05)) & 2) === 0) {
              yield* game.talk(local0, 0x50);
            } else {
              yield* game.talk(local0, 0x53);
            }
            if (((yield* game.getObjectRecordFlags(local0)) & 8) !== 0) {
              yield* game.setObjectRecordFlagBits(local0, 4);
              yield* game.setObjectAnimation(local0, 1);
              yield* game.moveObjectToWaypoint(local0, 0xb);
              yield* game.wait(4, 0);
              yield* game.moveObjectToWaypoint(local0, 0xa);
              yield* game.wait(4, 0);
              yield* game.stopMotion(local0);
              yield* game.setActorStateFlagBits(0x12de, 0x80);
              yield* game.setObjectActionAndDirection(local0, 0, 1);
              yield* game.wait(1, 0x78);
              yield* game.setObjectDirection(local0, 4);
              yield* game.notice(2, 2, 0x1b, 3, 0x400, 0x59, 0x78);
              yield* game.wait(1, 0x3c);
              yield* game.notice(0xa, 6, 0x14, 3, 0x400, 0x5a, 0x78);
              yield* game.wait(1, 0x3c);
              yield* game.setObjectAnimation(local0, 1);
              yield* game.moveObjectToWaypoint(local0, 9);
              yield* game.wait(4, 0);
              yield* game.stopMotion(local0);
              yield* game.setActorStateFlagBits(0x12e5, 0x80);
              yield* game.setObjectActionAndDirection(local0, 0, 0);
              yield* game.wait(1, 0x78);
              yield* game.setObjectAnimation(local0, 1);
              yield* game.moveObjectToWaypoint(local0, 2);
              yield* game.wait(4, 0);
              yield* game.stopMotion(local0);
              yield* game.clearObjectVelocity(local0);
              yield* game.setObjectAnimation(local0, 0);
              yield* game.turnObjectToPlayer(local0);
              yield* game.notice(2, 2, 0x1c, 5, 0x400, 0x5b, 0x12c);
              yield* game.wait(1, 0x78);
              yield* game.setObjectAnimation(local0, 1);
              yield* game.moveObjectToWaypoint(local0, 0xd);
              yield* game.wait(4, 0);
              yield* game.moveObjectToWaypoint(local0, 0xc);
              yield* game.wait(4, 0);
              yield* game.stopMotion(local0);
              yield* game.setObjectActionAndDirection(local0, 0, 0);
            }
          } else {
            yield* game.talk(local0, 0x52);
          }
        }
      }
    }
  }
}

// Script 27A: no arguments.
export function* script27A(state) {
  if (state.byte('JAKE_NEGOTIATION') !== 0) {
    yield* game.topicText(0xcc);
  } else {
    yield* game.topicText(0xcb);
    if ((yield* game.question(0x16, 8)) === 0) {
      yield* game.topicText(0xc9);
    } else {
      if ((yield* game.payNuyen(0x3e8)) === 0) {
        yield* game.topicText(0xc8);
      } else {
        yield* game.topicText(0xca);
        state.setByte('JAKE_NEGOTIATION', 0, 1);
        yield* game.markTopic(0x22);
      }
    }
  }
  return null;
}

// Script 27B: 1 argument.
export function* script27B(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 2);
  yield* game.setObjectAnimation(local0, 0);
  local1 = yield* game.getScriptVariable(8);
  yield* game.wait(1, local0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectFlagBits(local0, 0x2040);
  for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(local0, t2, t1, 0x10);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 27C: 5 arguments, returns a word.
export function* script27C(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0,
    local15 = 0;
  function* sub13() {
    if (!less(yield* game.getObjectRecordCount(local13), 0xb)) {
      yield* game.setObjectAnimation(local13, 2);
      if (local15 !== 0) {
        local15 = 0;
        yield* game.moveObjectStraightToWaypoint(local13, local2 & 0xff);
      } else {
        local15 = 1;
        yield* game.moveObjectStraightToWaypoint(local13, shiftRight(local2, 8));
      }
    } else {
      if (local15 !== 0xff) {
        yield* game.setObjectAnimation(local13, 2);
        local15 = 255;
        if (local4 !== 0) {
          if (local4 !== 0x23a) {
            yield* game.notice(2, 5, 0x19, 3, 0x400, local4, 0xa0);
          } else {
            yield* game.notice(2, 5, 0x16, 3, 0x400, local4, 0xa0);
          }
        }
        yield* game.moveObjectStraightToWaypoint(local13, shiftRight(local0, 8));
      }
    }
    if ((yield* script(0x241, local13, 0x64, 0x3c, 0x32, 0xb, local15)) === 0) {
      local14 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local13);
        local12 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(0x801, 6)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          if ((yield* game.getDistanceBetweenObjects(local13, signed(local12))) <= 0xa) {
            yield* game.setObjectAnimation(local13, 5);
            yield* game.turnObjectToObject(local13, signed(local12));
            yield* game.playSoundEffect(local13, 2, 0xff, 0xff);
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              yield* game.shootAtObject(local13, signed(local12), 2, 4, local8 & 0xff, 1);
            } else {
              return 0xffff;
            }
          } else {
            yield* game.setObjectAnimation(local13, 4);
            yield* game.turnObjectToObject(local13, signed(local12));
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              if (less(local14, 4)) {
                yield* game.playSoundEffect(local13, 0x42, 0xff, 0xff);
              }
              yield* game.shootAtObject(local13, signed(local12), 2, 1, shiftRight(local8, 8), 1);
            } else {
              return 0xffff;
            }
          }
        }
        if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
          if (
            (truth(local14 === 5) |
              truth(less(yield* game.getObjectRecordCount(local13), 0xb) && local15 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local14 = word(local14 + 1) & 0xff;
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
  local13 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local13, 2, 0);
  yield* game.setObjectFlagBits(local13, 0x140);
  yield* game.appendToFightList(local13);
  yield* game.setObjectArmour(local13, local6 & 0xff);
  local15 = 0;
  for (;;) {
    if ((yield* sub13()) !== 0) {
      yield* game.addKarma(word((yield* game.randomBelow(shiftRight(local6, 8))) + 4));
      yield* game.fightListRemove(local13);
      return yield* script(0x35d, local13);
    }
  }
}

// Script 27D: 1 argument.
export function* script27D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  if ((yield* game.getScriptVariable(0x28)) <= 0) {
    yield* game.setObjectDialog(local0, 0x23);
    yield* game.wait(2, 0);
  } else {
    block94: {
      if (
        (truth(
          less(
            yield* game.getObjectCoarseY(local0),
            yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()),
          ),
        ) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x1c2)) ===
        0
      ) {
        for (;;) {
          yield* game.wait(2, 0);
          yield* game.talk(local0, 0x22);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
            yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
            yield* game.notice(5, 3, 0x14, 3, 0x400, 0x1a4, 0xb4);
            break block94;
          }
        }
      }
    }
    yield* game.keepObjectFlagBits(local0, 0xfebf);
    yield* game.setObjectVelocity(local0, 2, 0, 0);
    yield* game.wait(1, 0xa);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(1, 6);
    yield* script(0x08e, local0, 4, 0xa, 8, 3, 0x1c2);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 27E: 1 argument.
export function* script27E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0xb4);
  yield* game.removeObject(local0);
  return null;
}

// Script 27F: 1 argument.
export function* script27F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x07a, 0x800 | local0, 0x607, 0x245, 0x306));
  return null;
}
