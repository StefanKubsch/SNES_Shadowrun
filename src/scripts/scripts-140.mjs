// Scripts 140 to 15F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, notEqualOrNegativeLeft, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 140: 1 argument.
export function* script140(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  loop13: for (;;) {
    yield* game.setObjectAnimation(object, 2);
    for (;;) {
      yield* game.wait(EVENT.OPEN, 0);
      if (less(yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()), 0x1d0)) {
        yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(object, 4);
        yield* game.wait(EVENT.TIMER, 0xa);
        if ((yield* game.testObjectCollision(object, 0)) === 0) {
          yield* game.wait(EVENT.ANIMATION_END, 0);
          loop104: for (;;) {
            yield* game.setObjectAnimation(object, 0);
            for (;;) {
              yield* game.wait(EVENT.CLOSE, 0);
              if (less(yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()), 0x1d0)) {
                yield* game.setObjectAnimation(object, 6);
                yield* game.wait(EVENT.TIMER, 0xa);
                if ((yield* game.testObjectCollision(object, 2)) === 0) {
                  yield* game.wait(EVENT.ANIMATION_END, 0);
                  yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
                  continue loop13;
                }
                yield* game.playSoundEffect(object, 0x20, 0xff, 3);
                yield* game.wait(EVENT.TIMER, 5);
                continue loop104;
              }
              yield* run.noticeTooFarAway();
            }
          }
        } else {
          yield* game.playSoundEffect(object, 0x20, 0xff, 3);
          yield* game.wait(EVENT.TIMER, 5);
          yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
          continue loop13;
        }
      } else {
        yield* run.noticeTooFarAway();
      }
    }
  }
}

// Script 141: 1 argument.
export function* script141(state, arg0) {
  let object = 0,
    local1 = 0,
    count = 0;
  function* sub5() {
    const t1 = word(((yield* game.randomByte()) & 7) + 2);
    const t2 = word(((yield* game.randomByte()) & 0xf) + 4);
    yield* game.notice(t2, t1, 7, 3, 0x400, 0x7d /* "*WOOF*" */, 0x1e);
    yield* game.playSoundEffect(object, 0x3a, 0xff, 3);
    yield* game.wait(EVENT.TIMER, word(0xa + ((yield* game.randomByte()) & 0xf)));
  }
  object = arg0 & 0xff;
  block291: {
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      local1 = 0;
      loop70: for (;;) {
        yield* game.setObjectAnimation(object, 1);
        yield* game.moveObjectStraightToPlayer(object);
        count = word(0x78 + ((yield* game.randomByte()) & 0x7f));
        for (;;) {
          yield* game.wait(EVENT.TIMER, 1);
          count = word(count - 1);
          if (
            (truth(count === 0) |
              truth(((yield* game.getActorStateFlags(0x1921 /* "Broken Gate" */)) & 1) !== 0)) !==
            0
          ) {
            if (((yield* game.getActorStateFlags(0x1921 /* "Broken Gate" */)) & 1) !== 0) {
              local1 = 255;
            }
            yield* game.stopMotion(object);
            yield* game.clearObjectVelocity(object);
            yield* game.setObjectAnimation(object, 0);
            yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 0x7f) + 0x28));
            if (signed(local1) === 0) {
              continue loop70;
            }
            yield* game.setObjectAnimation(object, 1);
            yield* game.moveObjectStraightToWaypoint(object, 0xc);
            yield* game.wait(EVENT.ARRIVED, 0);
            yield* game.keepObjectFlagBits(object, 0xffbf);
            yield* game.moveObjectStraightToWaypoint(object, 8);
            yield* game.wait(EVENT.ARRIVED, 0);
            yield* game.setObjectRecordFlagBits(object, 0x40);
            yield* game.notice(9, 2, 0xc, 3, 0x400, 0x7c /* "Arwoooooooooo!" */, 0x78);
            yield* game.moveObjectStraightToWaypoint(object, 0xb);
            yield* game.wait(EVENT.ARRIVED, 0);
            yield* game.stopMotion(object);
            yield* game.setActorStateFlagBits(0x1546 /* "Dog Collar" */, 0x80);
            yield* game.setObjectRecordFlagBits(object, 1);
            yield* run.script0AE(object);
            count = 6;
            for (;;) {
              yield* sub5();
              count = word(count - 1);
              if (count === 0) {
                yield* game.setObjectAnimation(object, 1);
                yield* game.moveObjectStraightToWaypoint(object, 0xd);
                yield* game.wait(EVENT.ARRIVED, 0);
                yield* game.moveObjectStraightToWaypoint(object, 0xe);
                yield* game.wait(EVENT.ARRIVED, 0);
                yield* game.removeObject(object);
                break block291;
              }
            }
          }
        }
      }
    }
  }
  return null;
}

// Script 142: 1 argument.
export function* script142(state, arg0) {
  let object = 0,
    local1 = 0;
  block152: {
    object = arg0 & 0xff;
    yield* game.setSpriteMode(object, 1);
    local1 = 0;
    yield* game.setScriptVariable(0x2a, 0);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      loop25: for (;;) {
        block66: {
          if (local1 === 1) {
            for (;;) {
              yield* game.wait(EVENT.TIMER, 6);
              if (((yield* game.getObjectRecordFlags(object)) & 0x40) !== 0) {
                yield* game.wait(EVENT.TIMER, 0xa);
                yield* game.playSoundEffect(object, 0x3e, 0xff, 3);
                break block66;
              }
            }
          }
        }
        yield* game.setObjectFlagBits(object, 0x100);
        yield* game.setObjectActionAndDirection(object, 2, 5);
        for (;;) {
          if (
            (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 6)) ^ 0xffff) & 1) !==
            0
          ) {
            yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xf0);
          }
          if ((yield* game.getScriptVariable(0x2a)) === 0) {
            yield* game.setObjectAnimation(object, 4);
            yield* game.playSoundEffect(object, 0x3e, 0xff, 3);
            yield* game.wait(EVENT.ANIMATION_END, 0);
            const t1 = word(local1 + 1);
            local1 = word(local1 + 1) & 0xff;
            if (t1 !== 2) {
              continue loop25;
            }
            break block152;
          }
        }
      }
    }
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.setObjectRecordFlagBits(object, 0x80);
  yield* game.keepObjectFlagBits(object, 0xfeff);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 143: no arguments.
export function* script143(state) {
  if ((yield* game.question(0x12, 0xa)) === 0) {
    yield* game.topicText(0x1a2 /* "Never mind, she is too good for you anyway." */);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.notice(8, 2, 0xf, 3, 0, 2 /* "Not enough money!" */, 0x78);
    } else {
      yield* game.endDialog();
      yield* game.setActorStateFlagBits(0xdd6 /* "Heavy Dude" */, 1);
    }
  }
  return null;
}

// Script 144: 1 argument.
export function* script144(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.standAndShoot(object);
  yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
  return null;
}

// Script 145: 1 argument.
export function* script145(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(object, 1, 5);
      state.setWord('COLOUR_REQUEST', 0, 4);
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 146: 1 argument.
export function* script146(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x100);
  yield* game.setObjectActionAndDirection(object, 3, 5);
  for (;;) {
    if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 6)) & EVENT.TIMER) === 0) {
      yield* game.notice(7, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xb4);
    }
  }
}

// Script 147: 2 arguments.
export function* lockedDoor(state, arg0, arg1) {
  let object = 0,
    local1 = 0,
    events = 0;
  block165: {
    object = arg0 & 0xff;
    local1 = arg1 & 0xff;
    yield* game.setObjectDirection(object, 5);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.setObjectFlagBits(object, 0x100);
      yield* game.setObjectAnimation(object, 2);
      if (signed(local1) === 0) {
        yield* game.setObjectAnimation(object, 3);
      } else {
        yield* game.setObjectAnimation(object, 2);
      }
      for (;;) {
        events = yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 1);
        if ((events & EVENT.EXAMINE) === 0) {
          if ((events & EVENT.OPEN) !== 0) {
            yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0xf0);
          }
        } else {
          yield* game.notice(
            2,
            0x15,
            0x1c,
            3,
            0x800,
            0x9c /* "Something sharp could open the lock." */,
            0x78,
          );
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.keepObjectRecordFlagBits(object, 0x7f);
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
          if (signed(local1) === 0) {
            yield* game.setObjectAnimation(object, 5);
          } else {
            yield* game.setObjectAnimation(object, 4);
          }
          yield* game.wait(EVENT.ANIMATION_END, 0);
          break block165;
        }
      }
    }
  }
  if (signed(local1) === 0) {
    yield* game.setObjectAnimation(object, 1);
  } else {
    yield* game.setObjectAnimation(object, 0);
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 148: 1 argument.
export function* script148(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 2) !== 0) {
      yield* game.setObjectActionAndDirection(object, 1, 5);
      state.setWord('COLOUR_REQUEST', 0, 4);
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 149: 1 argument.
export function* script149(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.playSoundEffect(object, 0x66, 0xff, 3);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0xa);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.removeObject(object);
  return null;
}

// Script 14A: no arguments.
export function* script14A(state) {
  yield* game.setActorStateFlagBits(0x3f0 /* "Secretary" */, 0x80);
  return null;
}

// Script 14B: 1 argument.
export function* script14B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x2c);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 14C: 1 argument.
export function* script14C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script28D(object, 0x32, 0x9c40, 0x1b5f, 0);
  return null;
}

// Script 14D: 1 argument.
export function* script14D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerWeapon(object, 1, 8, 3);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.removeObject(object);
  return null;
}

// Script 14E: 1 argument.
export function* script14E(state, arg0) {
  let object = 0,
    direction = 0,
    action = 0;
  function* sub5(in0, in1) {
    direction = in0 & 0xff;
    action = in1 & 0xff;
    yield* game.setObjectActionAndDirection(object, action, direction);
    yield* game.wait(EVENT.TALK | EVENT.ANIMATION_END, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(0x64 + ((yield* game.randomByte()) & 0x7f)));
  }
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x47);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  for (;;) {
    yield* sub5(3, 7);
    yield* sub5(5, 8);
    yield* sub5(5, 8);
    yield* sub5(7, 7);
  }
}

// Script 14F: 1 argument.
export function* script14F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 4) !== 0) {
      yield* game.setObjectActionAndDirection(object, 1, 5);
      state.setWord('COLOUR_REQUEST', 0, 4);
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 150: no arguments.
export function* script150(state) {
  if (((yield* game.getActorStateFlags(0x1d11)) & 1) !== 0) {
    yield* game.raiseStoryStage(2);
    yield* game.setActorStateFlagBits(0x818 /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x842 /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x208a, 0x80);
    yield* game.changeScene(0x8000, 0, 0x95);
  }
  return null;
}

// Script 151: no arguments.
export function* script151(state) {
  if (((yield* game.getActorStateFlags(0x208a)) & 1) !== 0) {
    yield* game.setActorStateFlagBits(0x80a /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x826 /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x1d11, 0x80);
    yield* game.changeScene(0, 0, 0x8b);
  }
  return null;
}

// Script 152: 1 argument.
export function* script152(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 153: no arguments.
export function* script153(state) {
  yield* run.offerForNuyen(0x1650, 0x32, 0x1a5);
  return null;
}

// Script 154: 1 argument.
export function* script154(state, arg0) {
  let object = 0,
    count = 0;
  block80: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
      yield* game.resetObjectRecordProperty(object);
      yield* game.setObjectActionAndDirection(object, 0, 6);
      yield* game.wait(EVENT.TIMER, 0x32);
      count = 0xffff;
      for (;;) {
        yield* game.setObjectVelocity(object, count, 0, 0);
        yield* game.wait(EVENT.TIMER, 0x14);
        count = word(count - 1);
        if (count === 0xfff7) {
          yield* game.wait(EVENT.TIMER, 0x1e);
          yield* game.setObjectVelocity(object, 0xfffa, 4, 0);
          yield* game.wait(EVENT.TIMER, 5);
          break block80;
        }
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 155: 1 argument.
export function* script155(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 8) !== 0) {
      yield* game.setObjectActionAndDirection(object, 1, 5);
      state.setWord('COLOUR_REQUEST', 0, 4);
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 156: no arguments.
export function* script156(state) {
  yield* game.changeScene(5, 0, 3);
  return null;
}

// Script 157: 5 arguments.
export function* script157(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    count = 0;
  block293: {
    object = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    if ((yield* run.rollEnemySpawn(local1)) === 0) {
      yield* game.removeObject(object);
    } else {
      count = 0;
      yield* game.setObjectRecordCount(object, local2);
      yield* game.setObjectActionAndDirection(object, 4, 3);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local6 = t1 & 0xff;
        if (t1 === 0xffff) {
          local5 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x14)) & EVENT.DEFEATED) !== 0) &
            0xff;
        } else {
          if (
            !less(
              yield* game.getObjectCoarseY(signed(local6)),
              yield* game.getObjectCoarseY(object),
            )
          ) {
            if (notEqualOrNegativeLeft(count, local4)) {
              count = word(count + 1);
              yield* game.setObjectVelocity(object, 0, 1, 0);
              yield* game.setObjectActionAndDirection(object, 1, 0);
            }
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
            yield* game.clearObjectVelocity(object);
          } else {
            if (notEqualOrNegativeLeft(count, word(-local4))) {
              count = word(count - 1);
              yield* game.setObjectVelocity(object, 0, 0xffff, 0);
              yield* game.setObjectActionAndDirection(object, 1, 6);
            }
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
            yield* game.clearObjectVelocity(object);
          }
          if (
            (truth(signed(local6) !== 0xffff) &
              truth(
                less(
                  yield* game.getObjectCoarseX(signed(local6)),
                  word((yield* game.getObjectCoarseX(object)) + 0x14),
                ),
              ) &
              (signed(local5) ^ 0xffff)) !==
            0
          ) {
            yield* game.setObjectAnimation(object, 4);
            yield* game.shootAtObject(object, signed(local6), 3, 0, 5, 0);
            yield* game.setObjectDirection(object, 7);
            yield* game.playSoundEffect(object, 0xe, 0xff, 3);
            if (local1 !== 0) {
              yield* game.appendToFightList(object);
              local1 = 0;
            }
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x14)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
          }
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(1);
          if (local1 === 0) {
            yield* game.fightListRemove(object);
          }
          const t2 = yield* game.getObjectCoarseHeight(object);
          const t3 = yield* game.getObjectCoarseY(object);
          const t4 = yield* game.getObjectCoarseX(object);
          yield* game.createObject(0x9e /* "Nuyen" */, t4, t3, t2, 0x271);
          yield* run.leaveBody(object);
          break block293;
        }
      }
    }
  }
  return null;
}

// Script 158: no arguments.
export function* script158(state) {
  if (((yield* game.getActorStateFlags(0x1f48)) & 1) !== 0) {
    yield* game.setActorStateFlagBits(0x81f /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x83b /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x1d0a, 0x80);
    yield* game.markTopic(0x12 /* "Glutman" */);
    yield* game.markTopic(0x1a /* "King" */);
    yield* game.markTopic(6 /* "Caryards" */);
    yield* game.markTopic(0xf /* "Examination" */);
    yield* game.markTopic(0x25 /* "Nuyen" */);
    yield* game.changeScene(0x8000, 0, 0x20);
  }
  return null;
}

// Script 159: no arguments.
export function* script159(state) {
  if (((yield* game.getActorStateFlags(0x1d0a)) & 1) !== 0) {
    yield* game.setActorStateFlagBits(0x811 /* "Mono-Rail Car" */, 0x80);
    yield* game.setActorStateFlagBits(0x1f48, 0x80);
    yield* game.setActorStateFlagBits(0x803 /* "Mono-Rail Car" */, 0x80);
    yield* game.changeScene(0, 0, 0x18d);
  }
  return null;
}

// Script 15A: 1 argument.
export function* script15A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.learnSpell(0x50);
  yield* game.markTopic(5 /* "Calls" */);
  yield* game.setScriptVariableBits(2, 1);
  return null;
}

// Script 15B: 1 argument.
export function* script15B(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setObjectAnimation(object, 0);
  yield* game.turnObjectToPlayer(object);
  yield* game.setObjectFlagBits(object, 0x40);
  yield* game.appendToFightList(object);
  yield* game.setObjectArmour(object, 3);
  const t1 = yield* game.randomBelow(0xff);
  local1 = t1 & 0xff;
  if (!less(t1, 0x19)) {
    if (!less(local1, 0x32)) {
      if (!less(local1, 0x4b)) {
        if (!less(local1, 0x64)) {
          if (!less(local1, 0x7d)) {
            if (!less(local1, 0x96)) {
              if (!less(local1, 0xaf)) {
                if (!less(local1, 0xc8)) {
                  local2 = 0;
                } else {
                  local2 = 1;
                }
              } else {
                local2 = 5;
              }
            } else {
              local2 = 3;
            }
          } else {
            local2 = 8;
          }
        } else {
          local2 = 2;
        }
      } else {
        local2 = 6;
      }
    } else {
      local2 = 4;
    }
  } else {
    local2 = 7;
  }
  yield* run.script111(shiftLeft(local2, 8) | object, 0, 0xffff, 0x300, 0x301, 0, 0);
  if ((yield* game.getScriptVariable(0x2a)) !== 0) {
    yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
  }
  yield* game.fightListRemove(object);
  yield* game.removeObject(object);
  const t2 = yield* game.getObjectCoarseHeight(object);
  const t3 = yield* game.getObjectCoarseY(object);
  const t4 = yield* game.getObjectCoarseX(object);
  yield* game.createObject(0x56, t4, t3, t2, 0x149);
  return null;
}

// Script 15C: 1 argument.
export function* script15C(state, arg0) {
  let object = 0,
    local1 = 0,
    text = 0;
  object = arg0 & 0xff;
  local1 = (yield* game.randomByte()) & 3;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.updateObjectDepthMode(object);
  yield* game.wait(EVENT.PICK_UP, 0);
  if (!less(local1, 2)) {
    text = 0x1e6;
  } else {
    text = 0x1e5;
  }
  yield* game.notice(2, 0x15, 0xa, 3, 0x800, text, 0xb4);
  yield* run.playPickUpSound();
  if (!less(local1, 2)) {
    yield* game.addNuyen(0x14);
  } else {
    yield* game.addNuyen(0xa);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 15D: 1 argument.
export function* script15D(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 7);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  yield* game.startPathSwarm(object | 0x80);
  yield* game.setSwarmPathPhaseTarget(0x140);
  yield* game.setSwarmPathSpeedTarget(0x40);
  yield* game.setSwarmHeightPhaseTarget(0x180);
  yield* game.setSwarmHeightSpeedTarget(0x180);
  local1 = 200;
  for (;;) {
    yield* game.moveSwarmAlongPath(object);
    const t1 = word(local1 - 1);
    local1 = word(local1 - 1) & 0xff;
    if (t1 === 0) {
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.setObjectRecordFlagBits(object, 1);
        state.setWord('COLOUR_REQUEST', 0, 1);
        yield* game.wait(EVENT.TIMER, 0x20);
        state.setWord('COLOUR_REQUEST', 0, 2);
      }
      yield* game.clearObjectTask(object);
      return null;
    }
  }
}

// Script 15E: 1 argument.
export function* findNuyen(state, arg0) {
  let object = 0,
    local1 = 0,
    text = 0;
  object = arg0 & 0xff;
  local1 = (yield* game.randomByte()) & 3;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.updateObjectDepthMode(object);
  yield* game.wait(EVENT.PICK_UP, 0);
  if (local1 !== 0) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        text = 0x1ea;
      } else {
        text = 0x1e9;
      }
    } else {
      text = 0x1e8;
    }
  } else {
    text = 0x1e7;
  }
  yield* game.notice(2, 0x15, 0xa, 3, 0x800, text, 0xb4);
  yield* run.playPickUpSound();
  if (local1 !== 0) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        yield* game.addNuyen(0x3c);
      } else {
        yield* game.addNuyen(0x32);
      }
    } else {
      yield* game.addNuyen(0x28);
    }
  } else {
    yield* game.addNuyen(0x1e);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 15F: 1 argument.
export function* script15F(state, arg0) {
  let object = 0,
    local1 = 0,
    text = 0;
  object = arg0 & 0xff;
  local1 = (yield* game.randomByte()) & 3;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.updateObjectDepthMode(object);
  yield* game.wait(EVENT.PICK_UP, 0);
  if (local1 !== 0) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        text = 0x1ee;
      } else {
        text = 0x1ed;
      }
    } else {
      text = 0x1ec;
    }
  } else {
    text = 0x1eb;
  }
  yield* game.notice(2, 0x15, 0xa, 3, 0x800, text, 0xb4);
  yield* run.playPickUpSound();
  if (local1 !== 1) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        yield* game.addNuyen(0x64);
      } else {
        yield* game.addNuyen(0x5a);
      }
    } else {
      yield* game.addNuyen(0x50);
    }
  } else {
    yield* game.addNuyen(0x46);
  }
  yield* game.removeObject(object);
  return null;
}
