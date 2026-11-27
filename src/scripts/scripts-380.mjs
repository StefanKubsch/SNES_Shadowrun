// Scripts 380 to 39F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, notEqualOrNegativeLeft, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 380: 5 arguments.
export function* script380(state, arg0, arg1, arg2, arg3, arg4) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    count = 0;
  block288: {
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
              yield* game.getObjectCoarseX(signed(local6)),
              yield* game.getObjectCoarseX(object),
            )
          ) {
            if (notEqualOrNegativeLeft(count, local4)) {
              count = word(count + 1);
              yield* game.setObjectVelocity(object, 1, 0, 0);
              yield* game.setObjectActionAndDirection(object, 1, 2);
            }
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x20)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
            yield* game.clearObjectVelocity(object);
          } else {
            if (notEqualOrNegativeLeft(count, word(-local4))) {
              count = word(count - 1);
              yield* game.setObjectVelocity(object, 0xffff, 0, 0);
              yield* game.setObjectActionAndDirection(object, 1, 4);
            }
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x20)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
            yield* game.clearObjectVelocity(object);
          }
          if (
            (truth(
              less(
                yield* game.getObjectCoarseY(signed(local6)),
                word((yield* game.getObjectCoarseY(object)) + 0x14),
              ),
            ) &
              (signed(local5) ^ 0xffff)) !==
            0
          ) {
            yield* game.setObjectAnimation(object, 4);
            yield* game.shootAtObject(object, signed(local6), 3, 0, 4, 0);
            yield* game.setObjectDirection(object, 3);
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
          yield* game.createObject(0x9e /* "Nuyen" */, t4, t3, t2, 0x248);
          yield* run.leaveBody(object);
          break block288;
        }
      }
    }
  }
  return null;
}

// Script 381: no arguments.
export function* script381(state) {
  if ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0xb1a /* "Leaves" */)) === 0) {
    yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
    yield* game.setActorStateHolder(0xb1a /* "Leaves" */, 0x8b2 /* "Me" */);
    yield* game.topicText(
      0x192 /* "He will guide you in your destiny. Here, take these enchante..." */,
    );
  } else {
    yield* game.topicText(
      0x193 /* "The shrine is close. I can feel it. I think he is calling yo..." */,
    );
  }
  return null;
}

// Script 382: 1 argument.
export function* script382(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.playSoundEffect(object, 0xa, 0xff, 0xff);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 383: 1 argument.
export function* script383(state, arg0) {
  let object = 0,
    local1 = 0,
    object2 = 0;
  function* sub5() {
    const t1 = yield* run.dropNuyen15C(object);
    object2 = t1 & 0xff;
    const t2 = shiftLeft(word((yield* game.getObjectCoarseHeight(t1)) + 8), 2);
    const t3 = shiftLeft(
      word(word((yield* game.getObjectCoarseY(object2)) - 8) - (yield* game.randomBelow(4))),
      2,
    );
    const t4 = shiftLeft(
      word((yield* game.getObjectCoarseX(object2)) + (yield* game.randomBelow(8))),
      2,
    );
    yield* game.setObjectPosition(object2, t4, t3, t2);
  }
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  yield* game.setObjectFlagBits(object, 0x80);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE, 0);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      local1 = yield* game.randomBelow(8);
      yield* game.setObjectRecordFlagBits(object, 1);
      if (local1 <= 6) {
        if (local1 <= 3) {
          yield* game.keepObjectRecordFlagBits(object, 0xfffe);
          yield* run.noticeNothingSpecial();
        } else {
          const t5 = word((yield* game.getObjectCoarseHeight(object)) + 5);
          const t6 = word((yield* game.getObjectCoarseY(object)) - 0xa);
          const t7 = word((yield* game.getObjectCoarseX(object)) + 5);
          yield* game.createObject(0x14 /* "Scary Ghoul" */, t7, t6, t5, 0x262);
        }
      } else {
        yield* sub5();
        yield* sub5();
        yield* sub5();
      }
    } else {
      yield* run.noticeNothingSpecial();
    }
  }
}

// Script 384: 1 argument.
export function* script384(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseY(object);
  const t2 = yield* game.getObjectCoarseX(object);
  yield* run.script195(object, t2, t1, 0, 4, 0xa);
  return null;
}

// Script 385: 1 argument.
export function* script385(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
    yield* game.setObjectActionAndDirection(object, 0, 3);
    yield* game.setObjectDialog(object, 0x42);
    for (;;) {
      yield* game.wait(EVENT.TIMER | EVENT.TALK, 6);
      if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
        yield* game.setObjectRecordFlags(object, 0);
        yield* game.changeScene(0x8002, 0, 0x1aa);
        return null;
      }
    }
  } else {
    yield* game.setObjectRecordFlagBits(object, 0x80);
    return null;
  }
}

// Script 386: 1 argument.
export function* script386(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    direction = 0;
  function* sub5(in0, in1) {
    local1 = in0;
    local3 = in1;
    loop9: for (;;) {
      direction = 0;
      for (;;) {
        yield* game.setObjectDirection(object, direction);
        yield* game.wait(word(local3 + 1), 0x10);
        direction = word(direction + 2);
        if (direction === 8) {
          if (((yield* game.getObjectRecordFlags(object)) & local1) === 0) {
            continue loop9;
          }
          yield* game.playSoundEffect(object, 0x14, 0xff, 3);
          return;
        }
      }
    }
  }
  object = arg0 & 0xff;
  block401: {
    if (
      ((yield* game.isTopicKnown(0x1c /* "Laughlyn" */)) &
        (truth((yield* game.getScriptVariable(0x2c)) !== 0) ^ 0xffff)) ===
      0
    ) {
      yield* game.setActorStateFlagBits(0xdc1 /* "Heavy Dude" */, 0x40);
      yield* game.setObjectArmour(object, 0x3f);
      yield* game.setObjectRecordFlags(object, 0);
      yield* game.setObjectActionAndDirection(object, 1, 5);
      yield* game.setObjectFlagBits(object, 0x2020);
      for (;;) {
        yield* game.moveObjectToPlayer(object);
        yield* game.wait(EVENT.TIMER, 0x3c);
        yield* game.clearObjectVelocity(object);
        yield* game.stopMotion(object);
        if (less(yield* game.getDistanceToPlayer(object), 0xf)) {
          yield* game.shootAtObject(object, yield* game.getPlayerObject(), 6, 5, 5, 1);
        }
        yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
        yield* game.setObjectAnimation(object, 7);
        yield* game.wait(EVENT.ANIMATION_END, 0);
        if (less(yield* game.getDistanceToPlayer(object), 0x78)) {
          yield* game.createObject(0x91, object, 0, 0, 0x2b3);
          yield* game.wait(EVENT.TIMER, 0xa);
          yield* game.createObject(0x91, object, 0, 0, 0x2b3);
        }
        yield* game.setObjectAnimation(object, 1);
        if (
          (truth((yield* game.getDistanceToPlayer(object)) > 0x28) &
            truth(((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0)) !==
          0
        ) {
          yield* game.keepObjectRecordFlagBits(object, 0xff7f);
          yield* game.notice(2, 3, 0xc, 3, 0, 0 /* "Too far away." */, 0x78);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 0x40);
          yield* game.keepObjectRecordFlagBits(object, 0xfff8);
          yield* game.notice(5, 2, 0x13, 3, 0x400, 0x1db /* "Aaaarrgghh, I can't see." */, 0xb4);
          yield* sub5(1, 0);
          yield* game.talk(object, 0x3b);
          yield* game.setObjectDialog(object, 0x3b);
          yield* sub5(2, 2);
          yield* game.talk(object, 0x3c);
          yield* game.setObjectDialog(object, 0x3c);
          for (;;) {
            yield* sub5(4, 2);
            yield* game.keepObjectRecordFlagBits(object, 0xfffb);
            if ((yield* game.isTopicKnown(0x1c /* "Laughlyn" */)) !== 0) {
              const t1 = yield* game.getObjectCoarseHeight(object);
              const t2 = yield* game.getObjectCoarseY(object);
              const t3 = yield* game.getObjectCoarseX(object);
              yield* game.createObject(0x56, t3, t2, t1, 0xf0);
              yield* game.appendToFightList(object);
              yield* game.addKarma(0x20);
              yield* game.fightListRemove(object);
              yield* game.removeObject(object);
              yield* game.wait(EVENT.TIMER, 0x50);
              yield* game.addNuyen(0x1388);
              yield* run.playPickUpSound();
              yield* game.notice(
                4,
                4,
                0x16,
                3,
                0,
                0x1f6 /* "The vampire had 5,000 nuyen." */,
                0xb4,
              );
            }
            if ((yield* game.isTopicKnown(0x1c /* "Laughlyn" */)) !== 0) {
              break block401;
            }
          }
        }
      }
    } else {
      yield* game.removeObject(object);
    }
  }
  return null;
}

// Script 387: 1 argument.
export function* script387(state, arg0) {
  let object = 0,
    frames = 0;
  function* sub5() {
    yield* game.setSpriteMode(object, 1);
    yield* game.setObjectActionAndDirection(object, 0, 4);
    frames = word(((yield* game.randomByte()) & 0xff) + 1);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, frames);
    yield* game.setSpriteMode(object, 0x8001);
    yield* game.setObjectActionAndDirection(object, 7, 3);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(0x118 - frames));
  }
  object = arg0 & 0xff;
  if (
    ((yield* game.isTopicKnown(0x23 /* "Nirwanda" */)) |
      (yield* game.isTopicKnown(0x1c /* "Laughlyn" */))) ===
    0
  ) {
    yield* game.setObjectDialog(object, 0x3d);
  } else {
    yield* game.setObjectDialog(object, 0x3e);
  }
  for (;;) {
    yield* game.setObjectVelocity(object, 0xffff, 0, 0);
    yield* sub5();
    yield* game.setObjectVelocity(object, 1, 0, 0);
    yield* sub5();
  }
}

// Script 388: no arguments.
export function* script388(state) {
  const t1 = yield* run.byNegotiation(0x3e8, 0x384, 0x320);
  const t2 = yield* run.byNegotiationB(0x170, 0x171, 0x172);
  yield* run.script162(0xd2e, t2, t1, 0x16f, 0x16e);
  return null;
}

// Script 389: 1 argument.
export function* script389(state, arg0) {
  let object = 0;
  block60: {
    object = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
      yield* run.giveArmour(object, 2, 2);
    } else {
      for (;;) {
        yield* game.wait(EVENT.TIMER, 0x1e);
        if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
          yield* game.keepObjectRecordFlagBits(object, 0xfffe);
          yield* game.setObjectActionAndDirection(object, 0, 0);
          yield* game.wait(EVENT.PICK_UP, 0);
          yield* game.setObjectRecordPropertyFromGroup(object);
          yield* run.playPickUpSound();
          yield* game.removeObject(object);
          break block60;
        }
      }
    }
  }
  return null;
}

// Script 38A: no arguments.
export function* script38A(state) {
  yield* game.setActorStateFlagBits(0x3bf /* "Shady character..." */, 0x80);
  return null;
}

// Script 38B: 1 argument.
export function* script38B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectAnimation(object, 0);
  yield* game.setObjectDialog(object, 0x43);
  for (;;) {
    yield* game.turnObjectToPlayer(object);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, 5);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.setActorStateHolder(0x762 /* "Password" */, 0x8b2 /* "Me" */);
      yield* game.keepActorStateFlagBits(0x129f /* "Full Bodysuit" */, 0xfffe);
      yield* game.keepActorStateFlagBits(0x1b5f /* "AS-7 A. Cannon" */, 0xfffe);
      yield* game.changeScene(2, 0, 0x1aa);
      return null;
    }
  }
}

// Script 38C: 1 argument.
export function* script38C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (
    (truth(((yield* game.getActorStateFlags(0x1b6d /* "Akimi" */)) & 0x80) !== 0) &
      (truth(((yield* game.getActorStateFlags(0x1b6d /* "Akimi" */)) & 0x40) !== 0) ^ 0xffff)) ===
    0
  ) {
    yield* game.removeObject(object);
  } else {
    block71: {
      if (((yield* game.getActorStateFlags(0x1b6d /* "Akimi" */)) & 0x20) === 0) {
        for (;;) {
          yield* game.wait(EVENT.TIMER, 0xa);
          if (((yield* game.getActorStateFlags(0x1d0a)) & 1) !== 0) {
            yield* game.setActorStateFlagBits(0x1b6d /* "Akimi" */, 0x20);
            break block71;
          }
        }
      } else {
        yield* game.placeObjectOnWaypoint(object, 6);
      }
    }
    yield* game.setObjectActionAndDirection(object, 0, 6);
    yield* game.wait(EVENT.TIMER, 0x3c);
    if (((yield* game.getActorStateFlags(0x1b6d /* "Akimi" */)) & 8) === 0) {
      yield* game.setActorStateFlagBits(0x1b6d /* "Akimi" */, 8);
      yield* game.notice(5, 4, 0x16, 3, 0x400, 0x259 /* "Jake, I see you have arrived." */, 0x140);
    }
    yield* game.setObjectAnimation(object, 2);
    yield* game.moveObjectStraightToPlayer(object);
    yield* game.wait(EVENT.TIMER | EVENT.ARRIVED, 0x3c);
    yield* game.setActorStateFlagBits(0x1b6d /* "Akimi" */, 0x40);
    yield* game.removeObject(object);
    yield* game.addSceneObject(0xa0, 0, 0, 0, 0, 0x1b6d, 0x32);
  }
  return null;
}

// Script 38D: 1 argument.
export function* script38D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x32);
    yield* game.setScriptVariable(0x2a, 0);
    yield* game.wait(EVENT.TIMER, 0x32);
    yield* game.appendToFightList(object);
    yield* game.setObjectArmour(object, 4);
    yield* run.script0EF(object, 2, 0, 5, 2);
    yield* game.addKarma(0x28);
    yield* game.fightListRemove(object);
    yield* run.leaveBodyAndResetRecord(object);
    yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 1);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 1);
      if ((yield* game.getScriptVariable(0x2a)) === 0) {
        yield* game.wait(EVENT.TIMER, 0x64);
        yield* game.changeRoom(0xae);
        return null;
      }
    }
  } else {
    return null;
  }
}

// Script 38E: no arguments.
export function* noticeNothingSpecial(state) {
  yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0xe /* "Nothing special here." */, 0x78);
  yield* game.wait(EVENT.TIMER, 0x1e);
  return null;
}

// Script 38F: 1 argument.
export function* script38F(state, arg0) {
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
            if (local4 !== 0xfce) {
              yield* run.refuseToGiveTo(local4);
            } else {
              yield* game.setItemPropertyAndUnequip(object, local4);
            }
          }
          local1 = 255;
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.playPickUpSound();
        local1 = 255;
      }
    } else {
      yield* game.notice(
        2,
        0x14,
        0x13,
        4,
        0x800,
        0x8f /* "The tickets to the Maria Mercurial concert!" */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 390: 1 argument.
export function* script390(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* run.waitUntilDefeated(object);
    yield* game.setObjectActionAndDirection(object, 0, 5);
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
        3,
        0x15,
        0x1b,
        3,
        0x800,
        0x1e0 /* "On the paper is a code- DRAKE0065." */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 391: 1 argument, returns a word.
export function* script391(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
    yield* game.keepObjectRecordFlagBits(object, 0xff7f);
    yield* game.setObjectFlagBits(object, 0x40);
    yield* game.setObjectAnimation(object, 0);
    yield* game.turnObjectToPlayer(object);
    return 0xffff;
  }
  yield* game.removeObject(object);
  return 0;
}

// Script 392: no arguments.
export function* script392(state) {
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0xc5 /* "Sure bud, your choice..." */);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.topicText(0xc4 /* "All transactions are strictly cash. No credit!" */);
    } else {
      if (less(yield* game.getActorStateCount(0x105a /* "Grenade" */), 6)) {
        yield* game.addActorStateCount(0x105a /* "Grenade" */, 1);
        yield* game.setActorStateHolder(0x105a /* "Grenade" */, 0x8b2 /* "Me" */);
        yield* game.topicText(0xc3 /* "There ya go! Nice doing business..." */);
      } else {
        yield* game.addNuyen(0x64);
        yield* game.topicText(0xc6 /* "You've got six already, you're a walking arsenal!" */);
      }
    }
  }
  return null;
}

// Script 393: no arguments.
export function* script393(state) {
  yield* game.setActorStateFlagBits(0x4b4 /* "Scientist" */, 0x80);
  yield* game.markTopic(0x14 /* "Head Computer" */);
  return null;
}

// Script 394: 1 argument.
export function* script394(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.sealedDoor(object, 0x28b);
  return null;
}

// Script 395: 1 argument.
export function* script395(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script179(object, 0x27d);
  return null;
}

// Script 396: 1 argument.
export function* script396(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.playSoundEffect(0xffff, 0x5a, 0xc8, 3);
  return null;
}

// Script 397: 3 arguments.
export function* script397(state, arg0, arg1, arg2) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    dialog = 0;
  function* sub9(in0) {
    dialog = in0;
    if (signed(local3) === 0) {
      yield* game.setObjectAnimation(object, 2);
      yield* game.wait(EVENT.TIMER, 0x3c);
    }
    yield* game.talk(object, dialog);
  }
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2 & 0xff;
  local4 = 0;
  if (local1 !== 0x4f) {
    if (local1 !== 0x50) {
      if (local1 !== 0x52) {
        if (local1 !== 0x53) {
          if (local1 !== 0x56) {
            if (local1 !== 0x54) {
              if (local1 !== 0x55) {
                if (local1 !== 0x51) {
                  local4 = 255;
                } else {
                  yield* sub9(0x88);
                }
              } else {
                yield* sub9(0x84);
              }
            } else {
              if (
                (truth(((yield* game.getActorStateFlags(0x1b6d /* "Akimi" */)) & 0x80) !== 0) |
                  truth(
                    (yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x20)),
                  )) ===
                0
              ) {
                yield* sub9(0x67);
              } else {
                local4 = 255;
              }
            }
          } else {
            if ((yield* game.getActorStateProperty(0x1474 /* "Drake" */)) !== 0x1538) {
              yield* sub9(0x85);
            } else {
              local4 = 255;
            }
          }
        } else {
          if (((yield* game.getActorStateFlags(0x1905 /* "Bronze Gate" */)) & 1) === 0) {
            yield* sub9(0x87);
          } else {
            local4 = 255;
          }
        }
      } else {
        yield* sub9(0x89);
      }
    } else {
      yield* sub9(0x5a);
    }
  } else {
    if (((yield* game.getScriptVariable(2)) & 1) === 0) {
      yield* sub9(0x4a);
    } else {
      local4 = 255;
    }
  }
  if (signed(local4) !== 0) {
    yield* game.notice(2, 2, 0x10, 3, 0x400, 0x4b /* "There is no answer." */, 0x78);
  }
  return null;
}

// Script 398: 1 argument.
export function* script398(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script380(object, 3, 0xa, 1, 0);
  return null;
}

// Script 399: 4 arguments.
export function* script399(state, arg0, arg1, arg2, arg3) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    frames = 0,
    local5 = 0,
    local6 = 0;
  block286: {
    object = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    frames = arg3;
    if ((yield* run.rollEnemySpawn(local1)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectFlagBits(object, 0x160);
      yield* game.setObjectRecordCount(object, local2);
      yield* game.setObjectActionAndDirection(object, 0, 0);
      yield* game.wait(EVENT.TIMER, word(((yield* game.randomByte()) & 0x1f) + 0x14));
      yield* game.appendToFightList(object);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local6 = t1 & 0xff;
        if (t1 === 0xffff) {
          local5 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 6)) & EVENT.DEFEATED) !== 0) &
            0xff;
        } else {
          if ((yield* game.getDistanceBetweenObjects(object, signed(local6))) > 0x96) {
            yield* game.moveObjectToObject(object, signed(local6));
            yield* game.setObjectAnimation(object, 2);
            local5 =
              truth(
                ((yield* game.wait(
                  EVENT.TIMER | EVENT.DEFEATED,
                  word(0xa + ((yield* game.randomByte()) & 0x1f)),
                )) &
                  EVENT.DEFEATED) !==
                  0,
              ) & 0xff;
            yield* game.stopMotion(object);
            yield* game.clearObjectVelocity(object);
          }
          yield* game.turnObjectToObject(object, signed(local6));
          yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
          yield* game.setObjectAnimation(object, 7);
          yield* game.wait(EVENT.ANIMATION_END, 0);
          yield* game.turnObjectToObject(object, signed(local6));
          yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
          yield* game.setObjectAnimation(object, 8);
          yield* game.turnObjectToObject(object, signed(local6));
          yield* game.setObjectDirection(object, (yield* game.getObjectDirection(object)) & 0xfffe);
          const t2 = truth(
            ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, frames)) & EVENT.DEFEATED) !== 0,
          );
          local5 = t2 & 0xff;
          if (t2 === 0) {
            yield* game.turnObjectToObject(object, signed(local6));
            if (signed(local6) !== 0xffff) {
              const t3 = word((yield* game.getObjectCoarseHeight(object)) + 0x20);
              const t4 = yield* game.getObjectCoarseY(object);
              const t5 = yield* game.getObjectCoarseX(object);
              yield* game.createObject(0xdc, t5, t4, t3, 0x160);
            }
            yield* game.setObjectDirection(
              object,
              (yield* game.getObjectDirection(object)) & 0xfffe,
            );
            yield* game.setObjectAnimation(object, 0);
            local5 =
              truth(
                ((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, frames)) & EVENT.DEFEATED) !== 0,
              ) & 0xff;
          }
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(object);
          yield* run.dropNuyen15E(yield* run.leaveBody(object));
          break block286;
        }
      }
    }
  }
  return null;
}

// Script 39A: 1 argument.
export function* script39A(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
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
            if (!(actor === 0x38e || actor === 0x380)) {
              yield* run.refuseToUseOn(actor);
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
      yield* game.notice(
        2,
        0x15,
        0x1b,
        3,
        0x800,
        0x200 /* "The bottle contains toxic dissolver." */,
        0xf0,
      );
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 39B: no arguments.
export function* script39B(state) {
  yield* game.changeScene(0x8002, 0, 0x8b);
  return null;
}

// Script 39C: no arguments.
export function* script39C(state) {
  yield* run.enterWithoutRunners(0x44);
  return null;
}

// Script 39D: no arguments.
export function* script39D(state) {
  let local0 = 0,
    local2 = 0;
  local2 = yield* game.getScriptVariable(0x20);
  if (local2 !== 1) {
    if (local2 !== 2) {
      if (local2 !== 3) {
        if (local2 !== 4) {
          if (local2 !== 5) {
            if (local2 !== 6) {
              local0 = 0x189;
            } else {
              local0 = 0x18b;
            }
          } else {
            local0 = 0x189;
          }
        } else {
          local0 = 0x187;
        }
      } else {
        local0 = 0x185;
      }
    } else {
      local0 = 0x183;
    }
  } else {
    local0 = 0x181;
  }
  yield* game.setActorStateFlags(0x175a /* "Computer" */, 0);
  yield* game.changeScene(3, word(local2 - 1), local0);
  return null;
}

// Script 39E: 1 argument.
export function* script39E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script329(object, 0x6a);
  return null;
}

// Script 39F: 1 argument.
export function* script39F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 0xa);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(EVENT.TALK, 0);
      yield* game.talk(object, 0x4b);
      yield* game.setObjectActionAndDirection(object, 1, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.wait(EVENT.TIMER, 5);
      yield* game.changeRoom(0x141);
      yield* game.resetObjectRecordProperty(object);
      return null;
    }
  }
}
