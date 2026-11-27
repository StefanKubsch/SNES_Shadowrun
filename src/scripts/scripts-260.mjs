// Scripts 260 to 27F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 260: 1 argument.
export function* script260(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.transferAccount(object, 0x61a8, 0x21d, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x70) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xd, 0x1e6, 0, 3);
  return null;
}

// Script 261: 1 argument.
export function* script261(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x3c) > 0) {
      yield* run.noticeTrashDataDiscarded();
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* run.transferAccount(object, 0xc350, 0x21e, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* run.transferAccount(object, 0x4e20, 0x21f, 4);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.transferAccount(object, 0x3a98, 0x220, 8);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 0xf, 0x1e7, 0, 3);
  return null;
}

// Script 262: 1 argument.
export function* script262(state, arg0) {
  let object = 0,
    local1 = 0;
  function* sub5(in0) {
    local1 = in0 & 0xff;
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(object)));
    const t4 = yield* game.getObjectCoarseY(object);
    const t5 = yield* game.getObjectCoarseX(object);
    yield* game.setObjectVelocity(
      yield* game.createObject(0xe0 /* "Ghoul Bone" */, t5, t4, t3, 0x1ee),
      t2,
      t1,
      8,
    );
  }
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffdf);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 2);
    if ((yield* game.getDistanceToPlayer(object)) <= 0x28) {
      yield* game.appendToFightList(object);
      if ((yield* run.script093(object)) !== 0) {
        yield* sub5(4);
        yield* sub5(8);
        yield* sub5(0xc);
        yield* sub5(0x10);
        yield* sub5(0x14);
        yield* sub5(0x18);
        yield* game.addKarma(2);
      }
      yield* game.fightListRemove(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 263: 1 argument.
export function* script263(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.wait(EVENT.TIMER, 0x32);
  yield* game.setObjectAnimation(object, 2);
  yield* game.moveObjectStraightToWaypoint(object, 0);
  yield* game.wait(EVENT.TIMER | EVENT.ARRIVED, 0x3c);
  yield* run.script20B(object);
  return null;
}

// Script 264: 1 argument.
export function* script264(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getActorStateFlags(0xadb)) & 1) !== 0) {
      yield* run.script371(object, 8, 9, 2, 0x80, 4, 0, 5);
      return null;
    }
  }
}

// Script 265: 1 argument.
export function* script265(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
    yield* game.wait(EVENT.TIMER, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
      yield* run.obtainDataFilePart(0x1585);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* run.obtainDataFile(0x1577);
      yield* game.learnSpell(0x56);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* run.transferAccount(object, 0x2710, 0x224, 2);
    }
    yield* game.keepObjectRecordFlagBits(object, 0xff7e);
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectRecordFlagBits(object, 1);
  yield* run.jackIntoMatrix(object, 6, 0x1d2, 0, 2);
  return null;
}

// Script 266: 1 argument.
export function* script266(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(5, 0x14, 0x15, 3, 0x800, 0x225 /* "ERROR - File fragment only." */, 0xf0);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 267: 1 argument.
export function* script267(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.script245(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    const t1 = yield* run.script2AB(signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.script04B();
        local1 = 255;
      }
    } else {
      yield* game.notice(
        2,
        0x13,
        0x16,
        5,
        0x800,
        0x6c /* "The memo reads - Armitage to perform courier run to Matrix S..." */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 268: 1 argument.
export function* script268(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block192: {
    object = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 1, 3);
    yield* game.wait(EVENT.TIMER, 1);
    const t1 = yield* game.chooseEnemyTarget(object);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.playSoundEffect(object, 0x36, 0xff, 0xff);
      yield* game.wait(EVENT.TIMER, yield* game.moveObjectTowardsObject(object, signed(local2)));
      yield* game.clearObjectVelocity(object);
      yield* game.removeObject(object);
      const t2 = yield* game.createObject(0xc3, 0, 0, 0, 0xa1);
      object = t2 & 0xff;
      yield* run.script0DB(t2);
      local1 = 200;
      for (;;) {
        yield* game.wait(EVENT.TIMER, 1);
        yield* game.haltObject(signed(local2));
        const t3 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
        const t4 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
        const t5 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
        yield* game.setObjectPosition(object, t5, t4, t3);
        const t6 = word(local1 - 1);
        local1 = word(local1 - 1) & 0xff;
        if (t6 === 0) {
          local1 = 60;
          for (;;) {
            yield* game.wait(EVENT.TIMER, 1);
            yield* game.haltObject(signed(local2));
            const t7 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
            const t8 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4);
            const t9 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4);
            yield* game.setObjectPosition(object, t9, t8, t7);
            yield* game.wait(EVENT.TIMER, 1);
            yield* game.setObjectPosition(object, 0, 0, 0);
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
  yield* game.removeObject(object);
  return null;
}

// Script 269: 1 argument.
export function* script269(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script07A(0x700 | local0, 0x506, 0x243, 0x306));
  return null;
}

// Script 26A: 1 argument.
export function* script26A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22a /* "Withhold payment of 10,000,000 nuyen to Drake's Account unti..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 26B: 1 argument.
export function* script26B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script31F(object, 3);
  return null;
}

// Script 26C: 1 argument.
export function* script26C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerArmour(object, 5);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.removeObject(object);
  return null;
}

// Script 26D: no arguments.
export function* noticeTooFarAway(state) {
  yield* game.notice(2, 2, 0xc, 3, 0, 0 /* "Too far away." */, 0x78);
  return null;
}

// Script 26E: 1 argument.
export function* script26E(state, arg0) {
  let object = 0,
    actor = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  actor = yield* game.getScriptVariable(8);
  yield* game.wait(EVENT.TIMER, object);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  yield* game.setObjectFlagBits(object, 0x2040);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(actor)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(object, t2, t1, 0x10);
      yield* game.setObjectFlagBits(object, 0x20);
      yield* game.wait(EVENT.TIMER, 0x1e);
      yield* game.setObjectActionAndDirection(object, 7, 0);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 26F: no arguments.
export function* script26F(state) {
  yield* run.enterWithoutRunners(0xe8);
  return null;
}

// Script 270: 1 argument.
export function* script270(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.walkToWaypoint(object, 0);
  yield* game.notice(
    4,
    2,
    0x19,
    4,
    0x400,
    0xf8 /* "If only you'd come closer, Jake. I almost had you in my gras..." */,
    0xf0,
  );
  yield* run.walkToWaypoint(object, 1);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x64);
  yield* run.shootRandomTargets(object, 6);
  yield* run.goToRoom(0xb4);
  return null;
}

// Script 271: 1 argument.
export function* script271(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlags(object, 0x20);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.setObjectVelocity(object, 0xfffa, 0, 0xf);
  local3 = yield* game.getObjectCoarseHeight(object);
  for (;;) {
    local1 = local3;
    yield* game.wait(EVENT.TIMER, 1);
    local3 = yield* game.getObjectCoarseHeight(object);
    if (local1 === local3) {
      yield* game.clearObjectVelocity(object);
      for (;;) {
        local1 = local3;
        yield* game.wait(EVENT.TIMER, 0xa);
        local3 = yield* game.getObjectCoarseHeight(object);
        if (local1 === local3) {
          yield* run.findNuyen(object);
          return null;
        }
      }
    }
  }
}

// Script 272: 1 argument.
export function* script272(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.moveObjectStraightToPlayer(object);
  for (;;) {
    if (!less(yield* game.getDistanceToPlayer(object), 0xf)) {
      local1 = truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 4)) & EVENT.HIT) !== 0) & 0xff;
    } else {
      yield* game.shootAtObject(object, yield* game.getPlayerObject(), 3, 5, 3, 1);
      local1 = truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0x14)) & EVENT.HIT) !== 0) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 273: 1 argument.
export function* script273(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22b /* "The security on the sixth floor has been upgraded. The AI is..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 274: 1 argument.
export function* script274(state, arg0) {
  let object = 0,
    actor = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 1);
  yield* game.setObjectAnimation(object, 0);
  actor = yield* game.getScriptVariable(8);
  yield* game.wait(EVENT.TIMER, object);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  yield* game.setObjectFlagBits(object, 0x2040);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(actor)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(object, t2, t1, 0x10);
      yield* game.setObjectFlagBits(object, 0x20);
      yield* game.wait(EVENT.TIMER, 0x1e);
      yield* game.setObjectActionAndDirection(object, 7, 0);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 275: 3 arguments.
export function* script275(state, arg0, arg1, arg2) {
  let object = 0,
    local1 = 0,
    actor = 0,
    count = 0,
    local6 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  actor = arg2;
  yield* game.setActorStateFlagBits(actor, 0x80);
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setSpriteMode(object, 1);
  if ((yield* game.getScriptVariable(0x12)) !== 0) {
    const t1 = yield* game.findNearestVisibleMember(object);
    local6 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.wait(EVENT.TIMER, yield* game.moveObjectTowardsObject(object, signed(local6)));
    } else {
      yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsPoint(object, local1));
    }
  } else {
    yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsPoint(object, local1));
  }
  yield* game.releaseObjectGraphics(object);
  count = 8;
  for (;;) {
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0xeb, t4, t3, t2, 0x1e8);
    yield* game.wait(EVENT.TIMER, 0xa);
    count = word(count - 1);
    if (count === 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 276: 1 argument.
export function* scatterGhoulBones(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  local1 = 0xc;
  for (;;) {
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(object)));
    const t4 = yield* game.getObjectCoarseY(object);
    const t5 = yield* game.getObjectCoarseX(object);
    yield* game.setObjectVelocity(
      yield* game.createObject(0xe0 /* "Ghoul Bone" */, t5, t4, t3, 0x1ee),
      t2,
      t1,
      8,
    );
    local1 = word(local1 - 4);
    if (local1 === 0) {
      return null;
    }
  }
}

// Script 277: 1 argument.
export function* script277(state, arg0) {
  let object = 0;
  block100: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      yield* game.setObjectFlagBits(object, 0x100);
      yield* game.setObjectActionAndDirection(object, 2, 5);
      for (;;) {
        if ((yield* game.wait(EVENT.TIMER | EVENT.OPEN, 1)) !== 1) {
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.setObjectAnimation(object, 4);
          yield* game.playSoundEffect(object, 0x3e, 0xff, 3);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.keepObjectFlagBits(object, 0xfeff);
          break block100;
        }
      }
    } else {
      yield* game.setObjectActionAndDirection(object, 0, 5);
    }
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 278: 1 argument.
export function* script278(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script07A(0x800 | local0, 0x607, 0x244, 0x306));
  return null;
}

// Script 279: 1 argument.
export function* script279(state, arg0) {
  let object = 0,
    action = 0,
    direction = 0,
    dx = 0,
    dy = 0,
    dz = 0;
  function* sub5(in0, in1, in2, in3, in4) {
    action = in0 & 0xff;
    direction = in1 & 0xff;
    dx = in2;
    dy = in3;
    dz = in4;
    yield* game.setObjectActionAndDirection(object, action, direction);
    yield* game.setObjectVelocity(object, dx, dy, dz);
  }
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(object, 7, 0);
    yield* game.moveObjectToWaypoint(object, 0);
    yield* game.wait(EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectActionAndDirection(object, 8, 0);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.setActorStateFlagBits(0x3a3, 0x80);
    yield* game.setActorStateFlagBits(0x7ee, 0x80);
    yield* game.wait(EVENT.TIMER, 2);
    yield* sub5(1, 2, 2, 0, 0);
    yield* game.wait(EVENT.TIMER, 0x14);
    yield* sub5(0, 0, 0, 0, 0);
    yield* game.wait(EVENT.TIMER, 0x1e0);
    yield* game.setActorStateFlagBits(0x3a3, 0x80);
    yield* game.setObjectDirection(object, 0);
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(EVENT.ANIMATION_END, 1);
    yield* sub5(0, 6, 0, 0, 0);
    yield* game.wait(EVENT.TIMER, 0x78);
    yield* sub5(1, 4, 0, 0xfffe, 0);
    yield* game.wait(EVENT.TIMER, 0x19);
    yield* game.setObjectActionAndDirection(object, 1, 3);
    yield* game.moveObjectStraightToWaypoint(object, 1);
    yield* game.wait(EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectActionAndDirection(object, 1, 2);
    yield* game.moveObjectToWaypoint(object, 5);
    yield* game.wait(EVENT.TIMER, 0xf);
    yield* game.setActorStateFlagBits(0xf5, 0x80);
    yield* game.wait(EVENT.ARRIVED, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectActionAndDirection(object, 0, 1);
    yield* game.setObjectRecordFlagBits(object, 1);
    yield* game.wait(EVENT.TIMER, 0x1cc);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 5);
      if (((yield* game.getObjectRecordFlags(object)) & 2) !== 0) {
        yield* game.keepObjectRecordFlagBits(object, 0xfffd);
        yield* game.playSoundEffect(object, 0x14, 0xff, 3);
        yield* sub5(6, 0, 2, 0, 0);
        yield* game.wait(EVENT.TIMER, 0x14);
        yield* game.setObjectAnimation(object, 2);
        yield* game.moveObjectToWaypoint(object, 6);
        yield* game.wait(EVENT.ARRIVED, 0);
        yield* game.stopMotion(object);
        yield* game.setActorStateFlagBits(0xaf, 0x80);
        yield* game.removeObject(object);
        return null;
      }
    }
  } else {
    yield* game.placeObjectOnWaypoint(object, 2);
    yield* game.setObjectActionAndDirection(object, 0, 3);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 2);
      if ((yield* game.getDistanceToPlayer(object)) <= 0x50) {
        if (signed(state.byte('JAKE_ALTERNATE_PORTRAIT')) === 0) {
          yield* game.setObjectDirection(object, 4);
          yield* game.wait(EVENT.TIMER, 0x1e);
          yield* game.notice(2, 2, 0xf, 3, 0x400, 0x57 /* "Oh no! The zombie!!" */, 0xf0);
          yield* game.setActorStateFlagBits(0x7ee, 2);
          yield* game.playSoundEffect(object, 0x14, 0xff, 3);
          yield* game.wait(EVENT.TIMER, 0x1e);
          yield* game.setObjectAnimation(object, 2);
          yield* game.moveObjectToWaypoint(object, 6);
          yield* game.wait(EVENT.TIMER, 0xa);
          yield* game.setActorStateFlagBits(0xaf, 0x80);
          yield* game.wait(EVENT.ARRIVED, 0);
          yield* game.stopMotion(object);
          yield* game.removeObject(object);
          return null;
        }
        for (;;) {
          yield* game.wait(EVENT.TALK, 0);
          if (((yield* game.getObjectRecordFlags(object)) & 4) === 0) {
            if (((yield* game.getActorStateFlags(0xb05)) & 2) === 0) {
              yield* game.talk(object, 0x50);
            } else {
              yield* game.talk(object, 0x53);
            }
            if (((yield* game.getObjectRecordFlags(object)) & 8) !== 0) {
              yield* game.setObjectRecordFlagBits(object, 4);
              yield* game.setObjectAnimation(object, 1);
              yield* game.moveObjectToWaypoint(object, 0xb);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.moveObjectToWaypoint(object, 0xa);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.stopMotion(object);
              yield* game.setActorStateFlagBits(0x12de, 0x80);
              yield* game.setObjectActionAndDirection(object, 0, 1);
              yield* game.wait(EVENT.TIMER, 0x78);
              yield* game.setObjectDirection(object, 4);
              yield* game.notice(
                2,
                2,
                0x1b,
                3,
                0x400,
                0x59 /* "Hey Sam, where is that Grinder file?" */,
                0x78,
              );
              yield* game.wait(EVENT.TIMER, 0x3c);
              yield* game.notice(
                0xa,
                6,
                0x14,
                3,
                0x400,
                0x5a /* "Try the \"TESTED\" cabinet." */,
                0x78,
              );
              yield* game.wait(EVENT.TIMER, 0x3c);
              yield* game.setObjectAnimation(object, 1);
              yield* game.moveObjectToWaypoint(object, 9);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.stopMotion(object);
              yield* game.setActorStateFlagBits(0x12e5, 0x80);
              yield* game.setObjectActionAndDirection(object, 0, 0);
              yield* game.wait(EVENT.TIMER, 0x78);
              yield* game.setObjectAnimation(object, 1);
              yield* game.moveObjectToWaypoint(object, 2);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.stopMotion(object);
              yield* game.clearObjectVelocity(object);
              yield* game.setObjectAnimation(object, 0);
              yield* game.turnObjectToPlayer(object);
              yield* game.notice(
                2,
                2,
                0x1c,
                5,
                0x400,
                0x5b /* "Hey look buddy, I haven't got time at the moment, why not lo..." */,
                0x12c,
              );
              yield* game.wait(EVENT.TIMER, 0x78);
              yield* game.setObjectAnimation(object, 1);
              yield* game.moveObjectToWaypoint(object, 0xd);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.moveObjectToWaypoint(object, 0xc);
              yield* game.wait(EVENT.ARRIVED, 0);
              yield* game.stopMotion(object);
              yield* game.setObjectActionAndDirection(object, 0, 0);
            }
          } else {
            yield* game.talk(object, 0x52);
          }
        }
      }
    }
  }
}

// Script 27A: no arguments.
export function* script27A(state) {
  if (state.byte('JAKE_NEGOTIATION') !== 0) {
    yield* game.topicText(0xcc /* "I can negotiate with the president, my boy!" */);
  } else {
    yield* game.topicText(
      0xcb /* "Hey, ya want the gift like me! People usually see things my ..." */,
    );
    if ((yield* game.question(0x16, 8)) === 0) {
      yield* game.topicText(
        0xc9 /* "Ha! And you think you'll make it out there in the REAL world..." */,
      );
    } else {
      if ((yield* game.payNuyen(0x3e8)) === 0) {
        yield* game.topicText(0xc8 /* "Looks like ya gonna need more cash than that, bucko!" */);
      } else {
        yield* game.topicText(
          0xca /* "Okay! Here's how it goes.... Always act cool, never attract ..." */,
        );
        state.setByte('JAKE_NEGOTIATION', 0, 1);
        yield* game.markTopic(0x22 /* "Negotiation" */);
      }
    }
  }
  return null;
}

// Script 27B: 1 argument.
export function* script27B(state, arg0) {
  let object = 0,
    actor = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 2);
  yield* game.setObjectAnimation(object, 0);
  actor = yield* game.getScriptVariable(8);
  yield* game.wait(EVENT.TIMER, object);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  yield* game.setObjectFlagBits(object, 0x2040);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(actor)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(object, t2, t1, 0x10);
      yield* game.setObjectFlagBits(object, 0x20);
      yield* game.wait(EVENT.TIMER, 0x1e);
      yield* game.setObjectActionAndDirection(object, 7, 0);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 27C: 5 arguments, returns a word.
export function* script27C(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    local6 = 0,
    local8 = 0,
    local12 = 0,
    object = 0,
    local14 = 0,
    local15 = 0;
  function* sub13() {
    if (!less(yield* game.getObjectRecordCount(object), 0xb)) {
      yield* game.setObjectAnimation(object, 2);
      if (local15 !== 0) {
        local15 = 0;
        yield* game.moveObjectStraightToWaypoint(object, local2 & 0xff);
      } else {
        local15 = 1;
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local2, 8));
      }
    } else {
      if (local15 !== 0xff) {
        yield* game.setObjectAnimation(object, 2);
        local15 = 255;
        if (text !== 0) {
          if (text !== 0x23a) {
            yield* game.notice(2, 5, 0x19, 3, 0x400, text, 0xa0);
          } else {
            yield* game.notice(2, 5, 0x16, 3, 0x400, text, 0xa0);
          }
        }
        yield* game.moveObjectStraightToWaypoint(object, shiftRight(local0, 8));
      }
    }
    if ((yield* run.script241(object, 0x64, 0x3c, 0x32, 0xb, local15)) === 0) {
      local14 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local12 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 6)) & EVENT.HIT) !== 0) {
            return 0xffff;
          }
        } else {
          if ((yield* game.getDistanceBetweenObjects(object, signed(local12))) <= 0xa) {
            yield* game.setObjectAnimation(object, 5);
            yield* game.turnObjectToObject(object, signed(local12));
            yield* game.playSoundEffect(object, 2, 0xff, 0xff);
            if (((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) === 0) {
              yield* game.shootAtObject(object, signed(local12), 2, 4, local8 & 0xff, 1);
            } else {
              return 0xffff;
            }
          } else {
            yield* game.setObjectAnimation(object, 4);
            yield* game.turnObjectToObject(object, signed(local12));
            if (((yield* game.wait(EVENT.ANIMATION_END | EVENT.HIT, 0)) & EVENT.HIT) === 0) {
              if (less(local14, 4)) {
                yield* game.playSoundEffect(object, 0x42, 0xff, 0xff);
              }
              yield* game.shootAtObject(object, signed(local12), 2, 1, shiftRight(local8, 8), 1);
            } else {
              return 0xffff;
            }
          }
        }
        if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0xa)) & EVENT.HIT) === 0) {
          if (
            (truth(local14 === 5) |
              truth(less(yield* game.getObjectRecordCount(object), 0xb) && local15 !== 0xff)) !==
            0
          ) {
            if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0xa)) & EVENT.HIT) === 0) {
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
  text = arg2;
  local6 = arg3;
  local8 = arg4;
  object = local0 & 0xff & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, local6 & 0xff);
  local15 = 0;
  for (;;) {
    if ((yield* sub13()) !== 0) {
      yield* game.addKarma(word((yield* game.randomBelow(shiftRight(local6, 8))) + 4));
      yield* game.fightListRemove(object);
      return yield* run.leaveBodyAndResetRecord(object);
    }
  }
}

// Script 27D: 1 argument.
export function* script27D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  if ((yield* game.getScriptVariable(0x28)) <= 0) {
    yield* game.setObjectDialog(object, 0x23);
    yield* game.wait(EVENT.TALK, 0);
  } else {
    block94: {
      if (
        (truth(
          less(
            yield* game.getObjectCoarseY(object),
            yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()),
          ),
        ) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x1c2)) ===
        0
      ) {
        for (;;) {
          yield* game.wait(EVENT.TALK, 0);
          yield* game.talk(object, 0x22);
          if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
            yield* game.keepObjectRecordFlagBits(object, 0xff7f);
            yield* game.notice(
              5,
              3,
              0x14,
              3,
              0x400,
              0x1a4 /* "Alright go right in buddy." */,
              0xb4,
            );
            break block94;
          }
        }
      }
    }
    yield* game.keepObjectFlagBits(object, 0xfebf);
    yield* game.setObjectVelocity(object, 2, 0, 0);
    yield* game.wait(EVENT.TIMER, 0xa);
    yield* game.clearObjectVelocity(object);
    yield* game.wait(EVENT.TIMER, 6);
    yield* run.answerWithNotice(object, 4, 0xa, 8, 3, 0x1c2);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 27E: 1 argument.
export function* script27E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0xb4);
  yield* game.removeObject(object);
  return null;
}

// Script 27F: 1 argument.
export function* script27F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script07A(0x800 | local0, 0x607, 0x245, 0x306));
  return null;
}
