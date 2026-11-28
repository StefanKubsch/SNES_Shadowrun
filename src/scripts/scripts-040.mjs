// Scripts 040 to 05F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 040: 1 argument.
export function* script040(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.patrolAndShootB(0x500 | local0, 0x304, 0, 0x403, 0x903));
  return null;
}

// Script 041: 1 argument.
export function* script041(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script00A(object, 0x22, 0x26, 0x80, 0x16c0);
  return null;
}

// Script 042: 1 argument.
export function* script042(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* game.setObjectAnimation(object, 1);
  yield* game.moveObjectStraightToWaypoint(object, 1);
  yield* game.wait(EVENT.ARRIVED, 0);
  yield* game.setObjectActionAndDirection(object, 0, 3);
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.setObjectActionAndDirection(object, 7, 3);
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* game.notice(2, 2, 0x1a, 3, 0x400, 0xf0 /* "It's pretty quiet around here, Sam" */, 0xf0);
  yield* game.wait(EVENT.TIMER, 0xc8);
  yield* game.setObjectActionAndDirection(object, 0, 3);
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.setObjectAnimation(object, 1);
  yield* game.moveObjectStraightToWaypoint(object, 0);
  yield* game.wait(EVENT.ARRIVED, 0);
  yield* game.setObjectActionAndDirection(object, 0, 7);
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.setObjectActionAndDirection(object, 7, 7);
  yield* game.wait(EVENT.TIMER, 0x64);
  yield* game.setObjectActionAndDirection(object, 0, 7);
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.setObjectActionAndDirection(object, 1, 4);
  yield* game.setObjectVelocity(object, 0, 0xfffe, 0);
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* game.clearObjectVelocity(object);
  yield* game.setObjectAnimation(object, 0);
  yield* game.turnObjectToPlayer(object);
  state.screen.colourRequest = 1;
  yield* game.notice(6, 5, 0x15, 3, 0x400, 0x25c /* "You have reached the end." */, 0x270f);
  yield* game.wait(EVENT.TIMER, 0xf0);
  yield* game.notice(
    4,
    0xa,
    0x19,
    3,
    0x800,
    0x25d /* "Thank you for playing Shadowrun." */,
    0x270f,
  );
  yield* game.wait(EVENT.TIMER, 0xf0);
  yield* game.notice(5, 0x14, 0x16, 3, 0, 0x25e /* "Developed by BEAM Software." */, 0x270f);
  yield* game.wait(EVENT.TIMER, 0x190);
  yield* game.requestMainLoopExit();
  return null;
}

// Script 043: 1 argument.
export function* script043(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.setObjectDialog(object, 0x59);
  yield* run.script0AE(object);
  yield* run.wanderAround(object, 0x3c, 0xc8, 0x3c);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 044: 1 argument.
export function* script044(state, arg0) {
  let object = 0,
    local3 = 0,
    local5 = 0,
    x = 0,
    y = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    frames = 0;
  function* sub5() {
    local3 = yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy());
    local5 = yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy());
  }
  function* sub18(in0, in1, in2) {
    local12 = in0 & 0xff;
    local13 = in1 & 0xff;
    frames = in2 & 0xff;
    x = word(local3 + signed(local12));
    y = word(local5 + signed(local13));
    if (x <= 0x262) {
      if (!less(x, 0x19a)) {
        if (y <= 0x21c) {
          if (less(y, 0x118)) {
            y = 0x118;
          }
        } else {
          y = 0x21c;
        }
      } else {
        x = 0x19a;
      }
    } else {
      x = 0x262;
    }
    yield* game.createObject(0x100, x, y, 0x40, 0x210);
    yield* game.wait(EVENT.TIMER, frames);
  }
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  const t1 = yield* game.randomBelow(6);
  local11 = t1 & 0xff;
  if (t1 !== 0) {
    if (local11 !== 1) {
      if (local11 !== 2) {
        if (local11 !== 3) {
          if (local11 !== 4) {
            if (local11 === 5) {
              yield* sub5();
              yield* sub18(0, 0xfff6, 0x28);
              yield* sub5();
              yield* sub18(0, 0xa, 0x28);
              yield* sub5();
              yield* sub18(0, 0xfff6, 0x28);
              yield* sub5();
              yield* sub18(0xfff6, 0, 0x28);
              yield* sub5();
              yield* sub18(0xa, 0, 0x28);
              yield* sub5();
              yield* sub18(0xfff6, 0, 0x28);
            }
          } else {
            yield* sub5();
            yield* sub18(0, 0xffd8, 0x28);
            yield* sub5();
            yield* sub18(0xffec, 0xffec, 0x28);
            yield* sub5();
            yield* sub18(0xffe8, 0, 0x28);
            yield* sub5();
            yield* sub18(0xffec, 0x10, 0x28);
            yield* sub5();
            yield* sub18(0xfff6, 0x1c, 0x28);
            yield* sub5();
            yield* sub18(0xa, 0x1c, 0x28);
            yield* sub5();
            yield* sub18(0x10, 0xc, 0x28);
          }
        } else {
          yield* sub5();
          yield* sub18(0, 0xffc4, 1);
          yield* sub18(0, 0x3c, 0x3c);
          yield* sub5();
          yield* sub18(0xffd8, 0, 1);
          yield* sub18(0x28, 0, 0x3c);
          yield* sub5();
          yield* sub18(0, 0xffec, 1);
          yield* sub18(0, 0x14, 0x3c);
          yield* sub5();
          yield* sub18(0, 0, 1);
        }
      } else {
        yield* sub5();
        yield* sub18(0xffc4, 0, 1);
        yield* sub18(0x3c, 0, 0x3c);
        yield* sub5();
        yield* sub18(0, 0xffd8, 1);
        yield* sub18(0, 0x28, 0x3c);
        yield* sub5();
        yield* sub18(0xffec, 0, 1);
        yield* sub18(0x14, 0, 0x3c);
        yield* sub5();
        yield* sub18(0, 0, 1);
      }
    } else {
      yield* sub5();
      yield* sub18(0xffe2, 0, 0x28);
      yield* sub18(0x1e, 0, 0x28);
      yield* sub18(0, 0x1e, 0x28);
      yield* sub18(0, 0xffe2, 0x28);
    }
  } else {
    yield* sub5();
    yield* sub18(0xffec, 0, 0x14);
    yield* sub18(0x14, 0, 0x5a);
    yield* sub5();
    yield* sub18(0, 0xffec, 0x14);
    yield* sub18(0, 0x14, 0x14);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 045: 2 arguments.
export function* shootRandomTargets(state, arg0, arg1) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.setObjectAnimation(object, 0);
  for (;;) {
    const t1 = yield* game.chooseRandomFightTarget(object);
    local2 = t1 & 0xff;
    if (t1 === 0xffff) {
      yield* game.wait(EVENT.TIMER, 0x3c);
    } else {
      yield* game.setObjectAnimation(object, 5);
      yield* game.shootWithOwnWeapon(object, signed(local2));
      yield* game.playSoundEffect(object, 0xc, 0xff, 0xff);
      yield* game.wait(EVENT.TIMER, 0x1e);
    }
    const t2 = word(local1 - 1);
    local1 = word(local1 - 1) & 0xff;
    if (t2 === 0) {
      return null;
    }
  }
}

// Script 046: no arguments.
export function* script046(state) {
  const t1 = yield* run.byNegotiation(0x7d0, 0x708, 0x5dc);
  const t2 = yield* run.byNegotiationB(0x17a, 0x17b, 0x17c);
  yield* run.offerToHire(0x1458, t2, t1, 0x179, 0x178);
  return null;
}

// Script 047: 1 argument.
export function* script047(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
  }
}

// Script 048: 1 argument.
export function* script048(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waypointShooter(object, 0, 3, 3, 0);
  return null;
}

// Script 049: 1 argument.
export function* script049(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x140);
  yield* game.setObjectActionAndDirection(object, 6, 0);
  yield* game.wait(EVENT.TIMER, 0xaf);
  yield* game.keepObjectFlagBits(object, 0xffdf);
  yield* game.setObjectVelocity(object, 0, 0, 2);
  yield* game.wait(EVENT.TIMER, 0xa);
  yield* game.setObjectVelocity(object, 0, 0, 0);
  yield* game.releaseObjectGraphics(object);
  return null;
}

// Script 04A: 1 argument.
export function* script04A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.turnObjectToPlayer(object);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* run.waypointShooterB(object, 1, 2, 2, 0x28, 6, 0, 2);
  return null;
}

// Script 04B: no arguments.
export function* playPickUpSound(state) {
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
  return null;
}

// Script 04C: 4 arguments.
export function* lockedCabinet(state, arg0, arg1, arg2, arg3) {
  let object = 0,
    text = 0,
    rows = 0,
    actor = 0;
  block75: {
    object = arg0 & 0xff;
    text = arg1;
    rows = arg2 & 0xff;
    actor = arg3;
    yield* game.keepObjectFlagBits(object, 0xfeff);
    yield* game.setObjectActionAndDirection(object, 2, 5);
    if (((yield* game.getActorStateFlags(0x7fc /* "Mortician" */)) & 4) === 0) {
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.OPEN, 1)) & EVENT.OPEN) !== 0) {
          yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x89 /* "This cabinet is locked." */, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          break block75;
        }
      }
    }
  }
  loop75: for (;;) {
    yield* game.setObjectAnimation(object, 2);
    yield* game.wait(EVENT.OPEN, 0);
    yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(EVENT.ANIMATION_END, 0);
    yield* game.setObjectAnimation(object, 0);
    for (;;) {
      if (((yield* game.wait(EVENT.EXAMINE | EVENT.CLOSE, 0)) & EVENT.CLOSE) !== 0) {
        yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(object, 6);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        continue loop75;
      }
      if (((yield* game.getObjectRecordFlags(object)) & 0x40) === 0) {
        yield* game.notice(2, 0x14, 0x1c, rows, 0x800, text, 0xb4);
        yield* game.setActorStateFlagBits(actor, 0x80);
        yield* game.setObjectRecordFlagBits(object, 0x40);
      } else {
        yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0x8a /* "There are many files here." */, 0xb4);
      }
    }
  }
}

// Script 04D: no arguments.
export function* script04D(state) {
  if (((yield* game.getActorStateFlags(0xb05 /* "LoneStar Badge" */)) & 1) === 0) {
    yield* game.topicText(
      0xb8 /* "So you wanna play Rent-A-Cop! I might be able to accommodate..." */,
    );
    if ((yield* game.question(0x18, 9)) === 0) {
      yield* game.topicText(0xb9 /* "You're right, I'll save it for someone who needs it." */);
    } else {
      if ((yield* game.payNuyen(0x96)) === 0) {
        yield* game.topicText(0xba /* "You ain't got enough cash, chum!" */);
      } else {
        yield* game.topicText(0xb7 /* "Impersonating a cop is risky man! Don't get caught!" */);
        yield* game.setActorStateFlagBits(0xb05 /* "LoneStar Badge" */, 1);
        yield* game.setActorStateHolder(0xb05 /* "LoneStar Badge" */, 0x8b2 /* "Me" */);
      }
    }
  } else {
    yield* game.topicText(0xb7 /* "Impersonating a cop is risky man! Don't get caught!" */);
  }
  return null;
}

// Script 04E: 1 argument.
export function* spawnedShooter(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectRecordCount(object, word(((yield* game.randomByte()) & 0xf) + 0xa));
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.turnObjectToPlayer(object);
  yield* game.appendToFightList(object);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(object);
    local2 = t1 & 0xff;
    if (t1 === 0xffff) {
      local1 =
        truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x28)) & EVENT.DEFEATED) !== 0) &
        0xff;
    } else {
      local1 = (yield* run.shootRound(object, signed(local2), 1, 0, 4, 0, 0x3c)) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(9);
      yield* game.fightListRemove(object);
      yield* game.setObjectDirection(object, 0);
      yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
      return null;
    }
  }
}

// Script 04F: 1 argument.
export function* script04F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getActorStateFlags(0xd6d /* "Heavy Dude" */)) & 1) !== 0) {
      yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 7) + 1));
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.releaseObjectGraphics(object);
      for (;;) {
        yield* game.wait(EVENT.TIMER, 1);
        if (((yield* game.getActorStateFlags(0xd6d /* "Heavy Dude" */)) & 2) !== 0) {
          yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 7) + 1));
          yield* game.setObjectVelocity(object, 0, 0, 3);
          yield* game.setObjectActionAndDirection(object, 0, 5);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.wait(EVENT.TIMER, 0x50);
          yield* game.removeObject(object);
          return null;
        }
      }
    }
  }
}

// Script 050: 1 argument.
export function* script050(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x1458 /* "Dwarf" */)) & 0x80) === 0) {
    yield* run.talkOrStrikeBack(object, 0x1458, 1, 0x78, 0x2000);
    yield* game.notice(0xd, 3, 0xd, 3, 0x400, 0x190 /* "Tee hee yo har." */, 0xb4);
    yield* game.removeObject(object);
    yield* game.addSceneObject(5, 0, 0, 0, 0, 0x1458, 0x28);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 051: 1 argument.
export function* script051(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(object, 0, 5);
  } else {
    yield* game.setObjectActionAndDirection(object, 0, 1);
  }
  for (;;) {
    if (((yield* game.wait(EVENT.EXAMINE | EVENT.USE, 0)) & EVENT.USE) === 0) {
      yield* game.notice(
        4,
        0x15,
        0x19,
        3,
        0x800,
        0x1f7 /* "It looks similar to a light switch." */,
        0xc8,
      );
    } else {
      block240: {
        if (((yield* game.getActorStateFlags(0x27d /* "Switch" */)) & 1) === 0) {
          yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
          if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
            yield* game.setObjectDirection(object, 1);
            yield* game.notice(7, 3, 0x10, 3, 0, 0x208 /* "Water hatch opened." */, 0x64);
            yield* game.wait(EVENT.TIMER, 0x78);
            yield* game.setObjectRecordFlagBits(object, 1);
            yield* game.notice(
              8,
              3,
              0x10,
              4,
              0,
              0x20a /* "Water Chamber filled - Maximum Pressure." */,
              0xc8,
            );
            if (((yield* game.getActorStateFlags(0x63c /* "Safe" */)) & 0x40) === 0) {
              count = 4;
              for (;;) {
                yield* game.playSoundEffect(object, 0x14, 0xff, 3);
                yield* game.wait(EVENT.TIMER, 8);
                count = word(count - 1);
                if (count === 0) {
                  yield* game.setActorStateFlagBits(0x63c /* "Safe" */, 0x40);
                  break block240;
                }
              }
            }
          } else {
            yield* game.notice(7, 3, 0x10, 3, 0, 0x209 /* "Water hatch closed." */, 0x64);
            yield* game.wait(EVENT.TIMER, 0x78);
            yield* game.notice(8, 3, 0x12, 3, 0, 0x20b /* "Water Chamber flushed." */, 0xc8);
            yield* game.keepObjectRecordFlagBits(object, 0);
            yield* game.setObjectDirection(object, 5);
          }
        } else {
          yield* game.notice(
            3,
            3,
            0x1b,
            3,
            0,
            0x236 /* "This switch reset before activating." */,
            0xc8,
          );
        }
      }
    }
  }
}

// Script 052: 1 argument.
export function* script052(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseY(object);
  const t2 = yield* game.getObjectCoarseX(object);
  yield* run.spawnedGunmanD(object, t2, t1, 0, 5, 0x14);
  return null;
}

// Script 053: 1 argument.
export function* script053(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    block135: {
      yield* game.wait(EVENT.TIMER, 1);
      if (((yield* game.getActorStateFlags(0x1cbd)) & 1) !== 0) {
        yield* game.setObjectDirection(object, 4);
        yield* game.setObjectAnimation(object, 2);
        yield* game.setObjectRecordFlags(object, 1);
        yield* game.setObjectFlags(object, 0);
        yield* game.keepObjectFlagBits(object, 0xdfff);
        yield* game.setObjectVelocity(object, 0, 0xfff9, 0);
        yield* game.wait(EVENT.TIMER, 0x32);
        yield* game.clearObjectVelocity(object);
        local1 = 3;
        for (;;) {
          yield* game.setObjectAnimation(object, 4);
          yield* game.playSoundEffect(object, 0xc, 0xff, 3);
          yield* game.wait(EVENT.TIMER, 0x14);
          const t1 = word(local1 - 1);
          local1 = word(local1 - 1) & 0xff;
          if (t1 === 0) {
            yield* game.setObjectActionAndDirection(object, 2, 0);
            yield* game.setObjectVelocity(object, 0, 7, 0);
            yield* game.wait(EVENT.TIMER, 0x7d);
            yield* game.clearObjectVelocity(object);
            break block135;
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

// Script 054: 1 argument.
export function* script054(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script31F(object, 1);
  return null;
}

// Script 055: 1 argument.
export function* script055(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0xbe;
  for (;;) {
    yield* game.advanceOrbitSlot1(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 0, 0xb75);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 056: no arguments.
export function* script056(state) {
  return null;
}

// Script 057: 1 argument.
export function* script057(state, arg0) {
  let object = 0,
    local1 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    local1 = yield* game.scriptAction(0x180);
    if ((local1 & 0x80) === 0) {
      if ((local1 & 0x100) !== 0) {
        yield* run.promptUseOn();
        actor = yield* game.chooseNumber();
        if (actor !== 0xffff) {
          if (actor !== 0x188) {
            yield* run.refuseToUseOn(actor);
          } else {
            yield* game.endDialog();
            if (((yield* game.getActorStateFlags(0x188 /* "Vampire!" */)) & 0x80) === 0) {
              yield* game.notice(
                2,
                0x15,
                0x15,
                3,
                0x800,
                0x1bc /* "You can't get close enough." */,
                0xb4,
              );
            } else {
              if (((yield* game.getActorStateFlags(actor)) & 2) === 0) {
                if (((yield* game.getActorStateFlags(actor)) & 1) === 0) {
                  yield* game.setActorStateFlagBits(actor, 1);
                } else {
                  yield* game.setActorStateFlagBits(actor, 2);
                }
              } else {
                yield* game.setActorStateFlagBits(actor, 4);
              }
            }
          }
        }
      }
    } else {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x10b /* "Sharp wooden stake." */, 0xf0);
      yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 058: 1 argument.
export function* script058(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.waitUntilDefeated(object);
    yield* game.setObjectFlagBits(object, 0x20);
    yield* run.script245(object);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0);
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      if (
        (truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(3))) &
          truth((yield* game.getObjectDirection(yield* game.getPlayerObjectCopy())) === 0) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) === 0x225) &
          truth((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) === 0x1f1) &
          (truth(((yield* game.getObjectRecordFlags(object)) & 4) !== 0) ^ 0xffff)) ===
        0
      ) {
        yield* game.setObjectRecordFlagBits(object, 4);
      } else {
        yield* game.endDialog();
        yield* game.setScriptVariable(0x2c, 2);
        yield* game.changeRoom(0x18b);
        yield* game.wait(EVENT.TIMER, 1);
      }
      yield* game.notice(
        2,
        0x15,
        0x19,
        3,
        0x800,
        0x87 /* "The paper reads: Warehouse No. 5." */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 059: 1 argument.
export function* script059(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  object = arg0 & 0xff;
  yield* run.script089(object);
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0x40);
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x40) {
          yield* run.promptGiveTo();
          local4 = yield* game.chooseNumber();
          if (local4 !== 0xffff) {
            if (local4 !== 0x185d) {
              yield* run.refuseToGiveTo(local4);
            } else {
              yield* game.setItemPropertyAndUnequip(object, local4);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x80 /* "The iced tea is chilled." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 05A: 1 argument.
export function* script05A(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x226;
  for (;;) {
    yield* game.advanceOrbitSlot2(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 1, 0xb75);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}

// Script 05B: 1 argument.
export function* script05B(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block200: {
    object = arg0 & 0xff;
    yield* game.setSpriteMode(object, 0);
    yield* game.setObjectFlagBits(object, 0x140);
    local2 = 1;
    if ((yield* run.rollEnemySpawn(4)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectRecordCount(object, word((yield* game.randomBelow(3)) + 5));
      yield* game.setObjectActionAndDirection(object, 0, (yield* game.randomByte()) & 7 & 0xfffe);
      yield* game.wait(EVENT.TIMER, 0x1e);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local1 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (local2 !== 0) {
            yield* game.appendToFightList(object);
            local2 = 0;
          }
          yield* game.setObjectAnimation(object, 4);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.setObjectAnimation(object, 5);
          yield* game.playSoundEffect(object, 0xc, 0xff, 3);
          yield* game.shootAtObject(object, signed(local1), 2, 0, 5, 0);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.setObjectAnimation(object, 6);
          local4 =
            truth(
              ((yield* game.wait(
                EVENT.TIMER | EVENT.DEFEATED,
                word(((yield* game.randomByte()) & 0x3f) + 0x50),
              )) &
                EVENT.DEFEATED) !==
                0,
            ) & 0xff;
        } else {
          yield* game.turnObjectToObject(object, signed(local1));
          local4 =
            truth(
              ((yield* game.wait(
                EVENT.TIMER | EVENT.DEFEATED,
                word(0x3c + ((yield* game.randomByte()) & 0x1f)),
              )) &
                EVENT.DEFEATED) !==
                0,
            ) & 0xff;
        }
        if (signed(local4) !== 0) {
          yield* game.addKarma(2);
          yield* game.fightListRemove(object);
          yield* run.dropNuyen15C(yield* run.leaveBody(object));
          break block200;
        }
      }
    }
  }
  return null;
}

// Script 05C: 1 argument.
export function* script05C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waypointShooter(object, 2, 3, 2, 1);
  return null;
}

// Script 05D: 1 argument.
export function* script05D(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    local2 = yield* run.awaitExamineOrPickUp(signed(local1), 0);
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(
        1,
        0x15,
        0x1d,
        3,
        0x800,
        0x205 /* "The bottle is labelled 'Toxic Dissolver'." */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 05E: 1 argument.
export function* script05E(state, arg0) {
  let object = 0,
    count = 0,
    local3 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x4d);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  count = 0;
  for (;;) {
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(0x64 + ((yield* game.randomByte()) & 0xff)));
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectVelocity(object, 0, 0, 7);
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x14);
      yield* game.setObjectVelocity(object, 0, 0, 8);
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x46);
    } else {
      const t1 = truth(((yield* game.randomByte()) & 1) !== 0);
      local3 = t1 & 0xff;
      if ((t1 & truth(less(count, 3))) === 0) {
        if (count !== 0) {
          yield* game.setObjectVelocity(object, 0xfffe, 0, 0);
          count = word(count - 1);
        }
      } else {
        yield* game.setObjectVelocity(object, 2, 0, 0);
        count = word(count + 1);
      }
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 0x28);
      yield* game.clearObjectVelocity(object);
    }
  }
}

// Script 05F: 1 argument.
export function* script05F(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  count = 0x118;
  for (;;) {
    yield* game.advanceOrbitSlot3(object);
    yield* game.wait(EVENT.TIMER, 1);
    count = word(count - 1);
    if (count === 0 || state.motion.circleLeaderAlive === 0) {
      if (state.motion.circleLeaderAlive !== 0) {
        yield* run.orbiterAttacks(object, 2, 0xb75);
      } else {
        yield* game.setObjectVelocity(object, 0, 0, 8);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.removeObject(object);
      }
      return null;
    }
  }
}
