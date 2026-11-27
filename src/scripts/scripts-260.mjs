// Scripts 260 to 27F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 260: 1 argument.
export function* script260(state, arg0) {
  let local0 = 0;
  block61: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block61;
    }
    block41: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block41;
      }
      yield* script(0x25b, local0, 0x61a8, 0x21d, 2);
      break block41;
    }
    block55: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x70) <= 0) {
        break block55;
      }
      yield* script(0x31c);
      break block55;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block61;
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
  block105: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block105;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x3c) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block55: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block55;
      }
      yield* script(0x25b, local0, 0xc350, 0x21e, 2);
      break block55;
    }
    block77: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) === 0) {
        break block77;
      }
      yield* script(0x25b, local0, 0x4e20, 0x21f, 4);
      break block77;
    }
    block99: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block99;
      }
      yield* script(0x25b, local0, 0x3a98, 0x220, 8);
      break block99;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block105;
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
    const t6 = yield* game.createObject(0xe0, t5, t4, t3, 0x1ee);
    yield* game.setObjectVelocity(t6, t2, t1, 8);
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffdf);
  loop52: for (;;) {
    yield* game.wait(1, 2);
    if ((yield* game.getDistanceToPlayer(local0)) > 0x28) {
      continue loop52;
    }
    block112: {
      yield* game.appendToFightList(local0);
      if ((yield* script(0x093, local0)) === 0) {
        break block112;
      }
      yield* sub5(4);
      yield* sub5(8);
      yield* sub5(0xc);
      yield* sub5(0x10);
      yield* sub5(0x14);
      yield* sub5(0x18);
      yield* game.addKarma(2);
      break block112;
    }
    yield* game.fightListRemove(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 263: 1 argument.
export function* script263(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.wait(1, 0x32);
  yield* game.setObjectAnimation(local0, 2);
  yield* game.native81(local0, 0);
  yield* game.wait(5, 0x3c);
  yield* script(0x20b, local0);
  return null;
}

// Script 264: 1 argument.
export function* script264(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getActorStateFlags(0xadb)) & 1) === 0) {
      continue loop2;
    }
    yield* script(0x371, local0, 8, 9, 2, 0x80, 4, 0, 5);
    return null;
  }
}

// Script 265: 1 argument.
export function* script265(state, arg0) {
  let local0 = 0;
  block83: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block83;
    }
    block35: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block35;
      }
      yield* script(0x0fe, 0x1585);
      break block35;
    }
    block55: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) === 0) {
        break block55;
      }
      yield* script(0x0d1, 0x1577);
      yield* game.learnSpell(0x56);
      break block55;
    }
    block77: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block77;
      }
      yield* script(0x25b, local0, 0x2710, 0x224, 2);
      break block77;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block83;
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
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(5, 0x14, 0x15, 3, 0x800, 0x225, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 267: 1 argument.
export function* script267(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block12: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block12;
    }
    yield* script(0x245, local0);
    break block12;
  }
  loop12: for (;;) {
    block70: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          break block70;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block70;
      }
      yield* game.notice(2, 0x13, 0x16, 5, 0x800, 0x6c, 0xf0);
      break block70;
    }
    if (signed(local1) === 0) {
      continue loop12;
    }
    yield* game.removeObject(local0);
    return null;
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
    if (t1 === 0xffff) {
      break block192;
    }
    yield* game.playSoundEffect(local0, 0x36, 0xff, 0xff);
    yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local2)));
    yield* game.clearObjectVelocity(local0);
    yield* game.removeObject(local0);
    const t2 = yield* game.createObject(0xc3, 0, 0, 0, 0xa1);
    local0 = t2 & 0xff;
    yield* script(0x0db, t2);
    local1 = 200;
    loop70: for (;;) {
      yield* game.wait(1, 1);
      yield* game.haltObject(signed(local2));
      const t3 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
      const t4 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
      const t5 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
      const t6 = local0;
      yield* game.setObjectPosition(t6, t5, t4, t3);
      const t7 = word(local1 - 1);
      local1 = t7 & 0xff;
      if (t7 !== 0) {
        continue loop70;
      }
      local1 = 60;
      loop125: for (;;) {
        yield* game.wait(1, 1);
        yield* game.haltObject(signed(local2));
        const t8 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
        const t9 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
        const t10 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
        const t11 = local0;
        yield* game.setObjectPosition(t11, t10, t9, t8);
        yield* game.wait(1, 1);
        yield* game.setObjectPosition(local0, 0, 0, 0);
        const t12 = word(local1 - 1);
        local1 = t12 & 0xff;
        if (t12 > 0) {
          continue loop125;
        }
        yield* game.resumeObject(signed(local2));
        break block192;
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
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22a, 0xf0);
    break block30;
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
  loop37: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
      continue loop37;
    }
    const t1 = word(3 - (yield* game.randomByte())) & 7;
    const t2 = word(3 - (yield* game.randomByte())) & 7;
    const t3 = local0;
    yield* game.setObjectVelocity(t3, t2, t1, 0x10);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* game.wait(1, 0x1e);
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.wait(8, 0);
    yield* game.removeObject(local0);
    return null;
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
  loop25: for (;;) {
    local1 = local3;
    yield* game.wait(1, 1);
    local3 = yield* game.getObjectCoarseHeight(local0);
    if (local1 !== local3) {
      continue loop25;
    }
    yield* game.clearObjectVelocity(local0);
    loop51: for (;;) {
      local1 = local3;
      yield* game.wait(1, 0xa);
      local3 = yield* game.getObjectCoarseHeight(local0);
      if (local1 !== local3) {
        continue loop51;
      }
      yield* script(0x15e, local0);
      return null;
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
  loop10: for (;;) {
    block64: {
      if (!less(yield* game.getDistanceToPlayer(local0), 0xf)) {
        local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
        break block64;
      }
      const t1 = yield* game.getPlayerObject();
      const t2 = local0;
      yield* game.shootAtObject(t2, t1, 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
      break block64;
    }
    if (signed(local1) === 0) {
      continue loop10;
    }
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 273: 1 argument.
export function* script273(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 7, 0x800, 0x22b, 0xf0);
    break block30;
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
  loop41: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
      continue loop41;
    }
    const t1 = word(3 - (yield* game.randomByte())) & 7;
    const t2 = word(3 - (yield* game.randomByte())) & 7;
    const t3 = local0;
    yield* game.setObjectVelocity(t3, t2, t1, 0x10);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* game.wait(1, 0x1e);
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.wait(8, 0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 275: 3 arguments.
export function* script275(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0;
  block79: {
    const t1 = arg2;
    const t2 = arg1;
    local0 = arg0 & 0xff;
    local1 = t2 & 0xff;
    local2 = t1;
    yield* game.setActorStateFlagBits(local2, 0x80);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* game.setSpriteMode(local0, 1);
    if ((yield* game.getScriptVariable(0x12)) !== 0) {
      const t3 = yield* game.findNearestVisibleMember(local0);
      local6 = t3 & 0xff;
      if (t3 !== 0xffff) {
        yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local6)));
        break block79;
      }
      yield* game.wait(1, yield* game.jumpObjectTowardsPoint(local0, local1));
      break block79;
    }
    yield* game.wait(1, yield* game.jumpObjectTowardsPoint(local0, local1));
    break block79;
  }
  yield* game.releaseObjectGraphics(local0);
  local4 = 8;
  loop86: for (;;) {
    const t4 = yield* game.getObjectCoarseHeight(local0);
    const t5 = yield* game.getObjectCoarseY(local0);
    const t6 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0xeb, t6, t5, t4, 0x1e8);
    yield* game.wait(1, 0xa);
    const t7 = word(local4 - 1);
    local4 = t7;
    if (t7 !== 0) {
      continue loop86;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 276: 1 argument.
export function* script276(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = 0xc;
  loop6: for (;;) {
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(local0)));
    const t4 = yield* game.getObjectCoarseY(local0);
    const t5 = yield* game.getObjectCoarseX(local0);
    const t6 = yield* game.createObject(0xe0, t5, t4, t3, 0x1ee);
    yield* game.setObjectVelocity(t6, t2, t1, 8);
    const t7 = word(local1 - 4);
    local1 = t7;
    if (t7 !== 0) {
      continue loop6;
    }
    return null;
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
      loop34: for (;;) {
        block64: {
          if ((yield* game.wait(0x201, 1)) === 1) {
            break block64;
          }
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0xf0);
          break block64;
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop34;
        }
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
        yield* game.wait(8, 0);
        yield* game.keepObjectFlagBits(local0, 0xfeff);
        break block100;
      }
    } else {
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      break block100;
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
    const t1 = in4;
    const t2 = in3;
    const t3 = in2;
    const t4 = in1;
    local3 = in0 & 0xff;
    local4 = t4 & 0xff;
    local5 = t3;
    local7 = t2;
    local9 = t1;
    yield* game.setObjectActionAndDirection(local0, local3, local4);
    yield* game.setObjectVelocity(local0, local5, local7, local9);
    return;
  }
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.native1D(local0, 0);
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
    yield* game.native81(local0, 1);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 1, 2);
    yield* game.native1D(local0, 5);
    yield* game.wait(1, 0xf);
    yield* game.setActorStateFlagBits(0xf5, 0x80);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 1);
    yield* game.setObjectRecordFlagBits(local0, 1);
    yield* game.wait(1, 0x1cc);
    loop679: for (;;) {
      yield* game.wait(1, 5);
      if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
        continue loop679;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xfffd);
      yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
      yield* sub5(6, 0, 2, 0, 0);
      yield* game.wait(1, 0x14);
      yield* game.setObjectAnimation(local0, 2);
      yield* game.native1D(local0, 6);
      yield* game.wait(4, 0);
      yield* game.stopMotion(local0);
      yield* game.setActorStateFlagBits(0xaf, 0x80);
      yield* game.removeObject(local0);
      return null;
    }
  } else {
    yield* game.placeObjectOnWaypoint(local0, 2);
    yield* game.setObjectActionAndDirection(local0, 0, 3);
    loop53: for (;;) {
      yield* game.wait(1, 2);
      if ((yield* game.getDistanceToPlayer(local0)) > 0x50) {
        continue loop53;
      }
      if (signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) === 0) {
        yield* game.setObjectDirection(local0, 4);
        yield* game.wait(1, 0x1e);
        yield* game.notice(2, 2, 0xf, 3, 0x400, 0x57, 0xf0);
        yield* game.setActorStateFlagBits(0x7ee, 2);
        yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
        yield* game.wait(1, 0x1e);
        yield* game.setObjectAnimation(local0, 2);
        yield* game.native1D(local0, 6);
        yield* game.wait(1, 0xa);
        yield* game.setActorStateFlagBits(0xaf, 0x80);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.removeObject(local0);
        return null;
      }
      loop75: for (;;) {
        block367: {
          yield* game.wait(2, 0);
          if (((yield* game.getObjectRecordFlags(local0)) & 4) === 0) {
            block124: {
              if (((yield* game.getActorStateFlags(0xb05)) & 2) === 0) {
                yield* game.talk(local0, 0x50);
                break block124;
              }
              yield* game.talk(local0, 0x53);
              break block124;
            }
            if (((yield* game.getObjectRecordFlags(local0)) & 8) === 0) {
              break block367;
            }
            yield* game.setObjectRecordFlagBits(local0, 4);
            yield* game.setObjectAnimation(local0, 1);
            yield* game.native1D(local0, 0xb);
            yield* game.wait(4, 0);
            yield* game.native1D(local0, 0xa);
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
            yield* game.native1D(local0, 9);
            yield* game.wait(4, 0);
            yield* game.stopMotion(local0);
            yield* game.setActorStateFlagBits(0x12e5, 0x80);
            yield* game.setObjectActionAndDirection(local0, 0, 0);
            yield* game.wait(1, 0x78);
            yield* game.setObjectAnimation(local0, 1);
            yield* game.native1D(local0, 2);
            yield* game.wait(4, 0);
            yield* game.stopMotion(local0);
            yield* game.clearObjectVelocity(local0);
            yield* game.setObjectAnimation(local0, 0);
            yield* game.turnObjectToPlayer(local0);
            yield* game.notice(2, 2, 0x1c, 5, 0x400, 0x5b, 0x12c);
            yield* game.wait(1, 0x78);
            yield* game.setObjectAnimation(local0, 1);
            yield* game.native1D(local0, 0xd);
            yield* game.wait(4, 0);
            yield* game.native1D(local0, 0xc);
            yield* game.wait(4, 0);
            yield* game.stopMotion(local0);
            yield* game.setObjectActionAndDirection(local0, 0, 0);
            break block367;
          }
          yield* game.talk(local0, 0x52);
          break block367;
        }
        continue loop75;
      }
    }
  }
}

// Script 27A: no arguments.
export function* script27A(state) {
  block63: {
    if (state.byte(0x3c06) !== 0) {
      yield* game.topicText(0xcc);
      break block63;
    }
    block56: {
      yield* game.topicText(0xcb);
      if ((yield* game.question(0x16, 8)) === 0) {
        yield* game.topicText(0xc9);
        break block56;
      }
      block49: {
        if ((yield* game.payNuyen(0x3e8)) === 0) {
          yield* game.topicText(0xc8);
          break block49;
        }
        yield* game.topicText(0xca);
        state.setByte(0x3c06, 0, 1);
        yield* game.markTopic(0x22);
        break block49;
      }
      break block56;
    }
    break block63;
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
  loop41: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
      continue loop41;
    }
    const t1 = word(3 - (yield* game.randomByte())) & 7;
    const t2 = word(3 - (yield* game.randomByte())) & 7;
    const t3 = local0;
    yield* game.setObjectVelocity(t3, t2, t1, 0x10);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* game.wait(1, 0x1e);
    yield* game.setObjectActionAndDirection(local0, 7, 0);
    yield* game.wait(8, 0);
    yield* game.removeObject(local0);
    return null;
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
    block147: {
      if (!less(yield* game.getObjectRecordCount(local13), 0xb)) {
        yield* game.setObjectAnimation(local13, 2);
        if (local15 !== 0) {
          local15 = 0;
          yield* game.native81(local13, local2 & 0xff);
          break block147;
        }
        local15 = 1;
        yield* game.native81(local13, shiftRight(local2, 8));
        break block147;
      }
      block103: {
        if (local15 === 0xff) {
          break block103;
        }
        block94: {
          yield* game.setObjectAnimation(local13, 2);
          local15 = 255;
          if (local4 === 0) {
            break block94;
          }
          if (local4 !== 0x23a) {
            yield* game.notice(2, 5, 0x19, 3, 0x400, local4, 0xa0);
            break block94;
          }
          yield* game.notice(2, 5, 0x16, 3, 0x400, local4, 0xa0);
          break block94;
        }
        yield* game.native81(local13, shiftRight(local0, 8));
        break block103;
      }
      break block147;
    }
    if ((yield* script(0x241, local13, 0x64, 0x3c, 0x32, 0xb, local15)) === 0) {
      local14 = 0;
      loop171: for (;;) {
        block340: {
          const t1 = yield* game.chooseEnemyTarget(local13);
          local12 = t1 & 0xff;
          if (t1 === 0xffff) {
            if (((yield* game.wait(0x801, 6)) & 0x800) === 0) {
              break block340;
            }
            return 0xffff;
          }
          block319: {
            if ((yield* game.getDistanceBetweenObjects(local13, signed(local12))) <= 0xa) {
              yield* game.setObjectAnimation(local13, 5);
              yield* game.turnObjectToObject(local13, signed(local12));
              yield* game.playSoundEffect(local13, 2, 0xff, 0xff);
              if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                yield* game.shootAtObject(local13, signed(local12), 2, 4, local8 & 0xff, 1);
                break block319;
              }
              return 0xffff;
            }
            yield* game.setObjectAnimation(local13, 4);
            yield* game.turnObjectToObject(local13, signed(local12));
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              block242: {
                if (!less(local14, 4)) {
                  break block242;
                }
                yield* game.playSoundEffect(local13, 0x42, 0xff, 0xff);
                break block242;
              }
              yield* game.shootAtObject(local13, signed(local12), 2, 1, shiftRight(local8, 8), 1);
              break block319;
            }
            return 0xffff;
          }
          break block340;
        }
        if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
          if (
            (truth(local14 === 5) |
              (truth(less(yield* game.getObjectRecordCount(local13), 0xb)) &
                truth(local15 !== 0xff))) !==
            0
          ) {
            if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local14 = word(local14 + 1) & 0xff;
          continue loop171;
        }
        return 0xffff;
      }
    } else {
      return 0xffff;
    }
  }
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  local0 = arg0;
  local2 = t5;
  local4 = t4;
  local6 = t3;
  local8 = t2;
  local13 = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(local13, 2, 0);
  yield* game.setObjectFlagBits(local13, 0x140);
  yield* game.appendToFightList(local13);
  yield* game.setObjectArmour(local13, local6 & 0xff);
  local15 = 0;
  loop445: for (;;) {
    if ((yield* sub13()) === 0) {
      continue loop445;
    }
    yield* game.addKarma(word((yield* game.randomBelow(shiftRight(local6, 8))) + 4));
    yield* game.fightListRemove(local13);
    return yield* script(0x35d, local13);
  }
}

// Script 27D: 1 argument.
export function* script27D(state, arg0) {
  let local0 = 0;
  block153: {
    local0 = arg0 & 0xff;
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    yield* game.setObjectFlagBits(local0, 0x140);
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    if ((yield* game.getScriptVariable(0x28)) <= 0) {
      yield* game.setObjectDialog(local0, 0x23);
      yield* game.wait(2, 0);
      break block153;
    }
    block94: {
      if (
        (truth(
          less(
            yield* game.getObjectCoarseY(local0),
            yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()),
          ),
        ) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x1c2)) !==
        0
      ) {
        break block94;
      }
      loop49: for (;;) {
        yield* game.wait(2, 0);
        yield* game.talk(local0, 0x22);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop49;
        }
        yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
        yield* game.notice(5, 3, 0x14, 3, 0x400, 0x1a4, 0xb4);
        break block94;
      }
    }
    yield* game.keepObjectFlagBits(local0, 0xfebf);
    yield* game.setObjectVelocity(local0, 2, 0, 0);
    yield* game.wait(1, 0xa);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(1, 6);
    yield* script(0x08e, local0, 4, 0xa, 8, 3, 0x1c2);
    break block153;
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
