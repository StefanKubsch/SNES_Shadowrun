// Scripts 160 to 17F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, notEqualSignedLeft, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 160: 1 argument.
export function* script160(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 1);
  const t1 = yield* game.chooseEnemyTarget(object);
  local2 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.playSoundEffect(object, 0x1e, 0xff, 0xff);
    yield* game.wait(EVENT.TIMER, yield* game.moveObjectTowardsObject(object, signed(local2)));
    yield* game.removeObject(object);
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    local1 = (yield* game.createObject(0xb8, t4, t3, t2, 0x382)) & 0xff;
    yield* game.wait(EVENT.TIMER, 0xa);
    yield* game.blast(local1, 7);
  } else {
    yield* game.removeObject(object);
  }
  return null;
}

// Script 161: 1 argument.
export function* script161(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.notice(8, 2, 0xc, 3, 0, 0x1d9 /* "Wastelands........." */, 0xf0);
  yield* run.script0D2(object);
  return null;
}

// Script 162: 5 arguments.
export function* offerToHire(state, arg0, arg1, arg2, arg3, arg4) {
  let actor = 0,
    text = 0,
    nuyen = 0,
    text2 = 0,
    text3 = 0;
  actor = arg0;
  text = arg1;
  nuyen = arg2;
  text2 = arg3;
  text3 = arg4;
  if (!(
    (state.byte('JAKE_CHARISMA') === 3 && state.byte('GROUP_INDEX') > 0) ||
    (state.byte('JAKE_CHARISMA') === 4 && state.byte('GROUP_INDEX') > 2) ||
    (state.byte('JAKE_CHARISMA') === 5 && state.byte('GROUP_INDEX') > 2) ||
    (state.byte('JAKE_CHARISMA') === 6 && state.byte('GROUP_INDEX') > 4)
  )) {
    yield* game.topicText(text);
    if ((yield* game.question(0x12, 0xa)) === 0) {
      yield* game.topicText(text2);
    } else {
      if ((yield* game.payNuyen(nuyen)) === 0) {
        yield* game.topicText(text3);
      } else {
        yield* game.endDialog();
        yield* game.setActorStateFlagBits(actor, 0x80);
      }
    }
  } else {
    yield* game.topicText(
      0x13f /* "If you have a few less runners, I may consider going on a ru..." */,
    );
  }
  return null;
}

// Script 163: 1 argument.
export function* script163(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x140);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 6);
    if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(object, 0, 5);
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) !== 0) {
          yield* game.playSoundEffect(object, 0x32, 0xff, 3);
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x1bf /* "It can't be touched." */, 0xf0);
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

// Script 164: 1 argument.
export function* script164(state, arg0) {
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
        text = 0x1f2;
      } else {
        text = 0x1f1;
      }
    } else {
      text = 0x1f0;
    }
  } else {
    text = 0x1ef;
  }
  yield* game.notice(2, 0x15, 0xa, 3, 0x800, text, 0xb4);
  yield* run.playPickUpSound();
  if (local1 !== 1) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        yield* game.addNuyen(0xc8);
      } else {
        yield* game.addNuyen(0xb4);
      }
    } else {
      yield* game.addNuyen(0xaa);
    }
  } else {
    yield* game.addNuyen(0x96);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 165: 2 arguments.
export function* lightSwitch(state, arg0, arg1) {
  let object = 0,
    action = 0;
  object = arg0 & 0xff;
  action = arg1 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(object, action, 5);
  } else {
    yield* game.setObjectActionAndDirection(object, action, 1);
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
      yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
      yield* game.wait(EVENT.TIMER, 3);
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.setObjectRecordFlagBits(object, 1);
        yield* game.setObjectDirection(object, 1);
      } else {
        yield* game.keepObjectRecordFlagBits(object, 0);
        yield* game.setObjectDirection(object, 5);
      }
    }
  }
}

// Script 166: 1 argument.
export function* script166(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.followActorSwitch(object, 0x2a7);
  return null;
}

// Script 167: 1 argument.
export function* script167(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.appendToFightList(object);
  loop10: for (;;) {
    yield* game.setObjectAnimation(object, 2);
    for (;;) {
      yield* game.wait(EVENT.TIMER, 6);
      if (less(yield* game.getDistanceToPlayer(object), 0x30)) {
        yield* game.setObjectVelocity(object, 0, 0, 0x1e);
        yield* game.wait(EVENT.TIMER, 0x1e);
        yield* game.createObject(0x54 /* "Bubbles" */, object, 0xa, 0, 0x16f);
        yield* game.wait(EVENT.TIMER, 0xa);
        yield* game.createObject(0x54 /* "Bubbles" */, object, 0xa, 0, 0x16f);
        yield* game.wait(EVENT.TIMER, 0x14);
        yield* game.releaseObjectGraphics(object);
        continue loop10;
      }
    }
  }
}

// Script 168: 1 argument.
export function* script168(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block145: {
    object = arg0 & 0xff;
    local2 = 1;
    if ((yield* run.rollEnemySpawn(3)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectRecordCount(object, word((yield* game.randomBelow(3)) + 0xa));
      yield* game.setObjectActionAndDirection(object, 0, (yield* game.randomByte()) & 7);
      yield* game.wait(EVENT.TIMER, word(0x5a + ((yield* game.randomByte()) & 0x1f)));
      yield* game.setSpriteMode(object, 0);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local4 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (local2 !== 0) {
            yield* game.appendToFightList(object);
            local2 = 0;
          }
          local1 =
            (yield* run.shootRound(
              object,
              signed(local4),
              1,
              0,
              4,
              0,
              word(0x5a + ((yield* game.randomByte()) & 0x1f)),
            )) & 0xff;
        } else {
          yield* game.turnObjectToObject(object, signed(local4));
          local1 =
            truth(((yield* game.wait(EVENT.TIMER | EVENT.DEFEATED, 0x1e)) & EVENT.DEFEATED) !== 0) &
            0xff;
        }
        if (signed(local1) !== 0) {
          yield* game.addKarma(2);
          yield* game.fightListRemove(object);
          yield* run.dropNuyen15C(yield* run.leaveBody(object));
          break block145;
        }
      }
    }
  }
  return null;
}

// Script 169: 1 argument.
export function* script169(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  for (;;) {
    yield* game.wait(EVENT.TALK, 0);
    yield* game.notice(2, 0x15, 0x11, 3, 0x800, 0x63 /* "There's no response..." */, 0x78);
  }
}

// Script 16A: no arguments.
export function* script16A(state) {
  yield* run.offerForNuyen(0x193d, 0x3e8, 0x19d);
  return null;
}

// Script 16B: no arguments.
export function* script16B(state) {
  yield* run.enterWithoutRunners(0x14f);
  return null;
}

// Script 16C: 1 argument.
export function* script16C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.giveWeapon(object, 0, 0xa, 2, 5);
  return null;
}

// Script 16D: no arguments.
export function* script16D(state) {
  yield* game.changeScene(2, 0, 0x8b);
  return null;
}

// Script 16E: 1 argument.
export function* script16E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x258);
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* game.setObjectActionAndDirection(object, 6, 7);
  yield* game.setObjectVelocity(object, 0xfffc, 4, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.playSoundEffect(object, 0x3a, 0xff, 0xff);
  yield* game.wait(EVENT.TIMER, 0x32);
  yield* game.clearObjectVelocity(object);
  yield* game.setObjectAnimation(object, 1);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.playSoundEffect(object, 0x5a, 0xff, 0xff);
  yield* game.wait(EVENT.TIMER, 0x78);
  yield* game.setObjectActionAndDirection(object, 3, 6);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.setObjectActionAndDirection(object, 7, 7);
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* game.setObjectAnimation(object, 4);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.playSoundEffect(object, 0x36, 0xff, 0xff);
  const t1 = word((yield* game.getObjectCoarseHeight(object)) + 5);
  const t2 = yield* game.getObjectCoarseY(object);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 0x14);
  yield* game.createObject(0xda, t3, t2, t1, 0x3a5);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectVelocity(object, 0, 4, 0);
  yield* game.wait(EVENT.TIMER, 0x12c);
  yield* game.removeObject(object);
  return null;
}

// Script 16F: 1 argument.
export function* script16F(state, arg0) {
  let object = 0,
    object2 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 5);
  const t1 = shiftLeft(
    word((yield* game.getObjectCoarseHeight(object2)) + (yield* game.getObjectCoarseY(object))),
    2,
  );
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object2), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.wait(EVENT.TIMER, 2);
  const t4 = yield* game.chooseEnemyTarget(object);
  local2 = t4 & 0xff;
  if (t4 !== 0xffff) {
    yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsObject(object, signed(local2)));
    if (less(yield* game.getDistanceBetweenObjects(object, signed(local2)), 0x14)) {
      yield* game.shootAtObject(object, signed(local2), 2, 4, 5, 3);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 170: 1 argument.
export function* script170(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.icSecuredDoor(object, 1);
  return null;
}

// Script 171: no arguments.
export function* script171(state) {
  yield* game.raiseStoryStage(4);
  yield* game.changeScene(0x8001, 0, 0x7a);
  return null;
}

// Script 172: 1 argument.
export function* script172(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.hiredRunner(object, 4, 0x78, 0x79, 0);
  return null;
}

// Script 173: 1 argument.
export function* script173(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.patrolGunman(object, 1, 0x203, 0x401, 0x803, 0x2d04);
  return null;
}

// Script 174: 6 arguments.
export function* spawnedGunmanC(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block177: {
    object = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    local5 = arg5 & 0xff;
    if ((yield* run.rollEnemySpawn(local1)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectActionAndDirection(object, 6, 7);
      yield* game.setObjectRecordCount(object, local3);
      yield* game.wait(EVENT.TIMER, 0x3c);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local7 = t1 & 0xff;
        if (
          (truth(t1 !== 0xffff) &
            truth(
              less(
                yield* game.getObjectCoarseX(signed(local7)),
                yield* game.getObjectCoarseX(object),
              ),
            )) !==
          0
        ) {
          yield* game.setObjectAnimation(object, 0);
          yield* game.shootAtObject(object, signed(local7), local2, 0, local4, signed(local5));
          yield* game.turnObjectToObject(object, signed(local7));
          if (less(yield* game.getObjectDirection(object), 4)) {
            yield* game.setObjectDirection(object, 6);
          }
          yield* game.playSoundEffect(object, 0xc, 0xff, 3);
          if (local1 !== 0) {
            yield* game.appendToFightList(object);
            local1 = 0;
          }
        }
        const t2 = truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(0x64 + ((yield* game.randomByte()) & 0x1f)),
          )) &
            EVENT.DEFEATED) !==
            0,
        );
        local6 = t2 & 0xff;
        if (t2 !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(object);
          yield* game.playSoundEffect(object, 0x14, 0xff, 3);
          yield* game.setObjectDirection(object, 7);
          yield* game.setObjectAnimation(object, 6);
          yield* game.clearObjectTask(object);
          break block177;
        }
      }
    }
  }
  return null;
}

// Script 175: 1 argument.
export function* script175(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 0);
  for (;;) {
    yield* game.setObjectVelocity(object, 0xfffe, 0xfffe, 0);
    yield* game.wait(EVENT.TIMER, 0x3c);
    yield* game.setObjectVelocity(object, 2, 2, 0);
    yield* game.wait(EVENT.TIMER, 0x3c);
  }
}

// Script 176: 1 argument.
export function* script176(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setActorStateFlagBits(0x1d96, 8);
  yield* run.patrolGunman(object, 1, 0x203, 0x401, 0x904, 0x2804);
  return null;
}

// Script 177: 1 argument.
export function* script177(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectDialog(object, 0x49);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 178: 1 argument.
export function* script178(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.patrolGunman(object, 1, 0x203, 0x401, 0xa04, 0x3705);
  return null;
}

// Script 179: 2 arguments.
export function* followActorSwitch(state, arg0, arg1) {
  let object = 0,
    actor = 0;
  object = arg0 & 0xff;
  actor = arg1;
  yield* game.setObjectDirection(object, 5);
  for (;;) {
    block108: {
      if (((yield* game.getActorStateFlags(actor)) & 1) === 0) {
        yield* game.setObjectFlagBits(object, 0x100);
        yield* game.setObjectAnimation(object, 0);
        for (;;) {
          yield* game.wait(EVENT.TIMER, 0xa);
          if (((yield* game.getActorStateFlags(actor)) & 1) !== 0) {
            yield* game.playSoundEffect(object, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(object, 3);
            break block108;
          }
        }
      } else {
        yield* game.keepObjectFlagBits(object, 0xfeff);
        yield* game.setObjectAnimation(object, 1);
        for (;;) {
          yield* game.wait(EVENT.TIMER, 0xa);
          if (((yield* game.getActorStateFlags(actor)) & 1) === 0) {
            yield* game.playSoundEffect(object, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(object, 2);
            break block108;
          }
        }
      }
    }
    yield* game.wait(EVENT.ANIMATION_END, 0);
  }
}

// Script 17A: 1 argument.
export function* script17A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.wait(EVENT.EXAMINE, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
  }
}

// Script 17B: 1 argument.
export function* script17B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.patrolGunman(object, 1, 0x203, 0x401, 0x903, 0x2d04);
  return null;
}

// Script 17C: 1 argument.
export function* script17C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.patrolGunman(object, 0x809, 0xa0b, 0x401, 0xa04, 0x3705);
  return null;
}

// Script 17D: 1 argument.
export function* script17D(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x3f0 /* "Secretary" */)) & 2) === 0) {
    block58: {
      if (((yield* game.getActorStateFlags(0x3f0 /* "Secretary" */)) & 3) === 0) {
        yield* game.setObjectActionAndDirection(object, 2, 5);
        yield* game.setObjectFlagBits(object, 0x100);
        for (;;) {
          yield* game.wait(EVENT.TIMER, 0xa);
          if (((yield* game.getActorStateFlags(0x3f0 /* "Secretary" */)) & 1) !== 0) {
            break block58;
          }
        }
      }
    }
    yield* run.closeDoorWhenClear(object, 2, 4, 0, 0x2c, 0x2e);
  }
  yield* run.openDoorB(object);
  return null;
}

// Script 17E: 1 argument.
export function* script17E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.patrolGunman(object, 0x405, 0x607, 0x401, 0xb04, 0x3c07);
  return null;
}

// Script 17F: 1 argument.
export function* script17F(state, arg0) {
  let object = 0,
    events = 0,
    local3 = 0,
    local4 = 0;
  function* sub5() {
    yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    yield* game.notice(
      2,
      0x15,
      0x18,
      3,
      0x800,
      0x9a /* "The slippery scale of a reptile." */,
      0x78,
    );
  }
  object = arg0 & 0xff;
  block241: {
    if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
      if ((yield* game.scriptAction(0x80)) === 0x80) {
        yield* sub5();
      }
    } else {
      yield* game.setObjectRecordFlags(object, object);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.setSpriteMode(object, 0x8001);
      yield* game.setObjectFlagBits(object, 0x60);
      local3 = 0;
      local4 = 0;
      for (;;) {
        events = yield* game.wait(EVENT.PICK_UP | EVENT.EXAMINE, 0);
        if (events === 0x80) {
          yield* sub5();
        }
        if (events === 0x10) {
          if (!less(local4, 3)) {
            local3 = 255;
          } else {
            const t1 = word((yield* game.randomBelow(8)) + 0xfffc);
            const t2 = word((yield* game.randomBelow(8)) + 0xfffc);
            yield* game.setObjectVelocity(object, t2, t1, 0);
            yield* game.wait(EVENT.TIMER, 1);
            if (
              (truth(notEqualSignedLeft(yield* game.getObjectVelocityX(object), 0)) &
                truth(notEqualSignedLeft(yield* game.getObjectVelocityY(object), 0))) ===
              0
            ) {
              yield* game.playSoundEffect(object, 6, 0xc0, 3);
              yield* game.wait(EVENT.TIMER, 6);
              yield* game.playSoundEffect(object, 6, 0x80, 3);
              yield* game.wait(EVENT.TIMER, 6);
              yield* game.playSoundEffect(object, 6, 0x40, 3);
              yield* game.wait(EVENT.TIMER, 6);
              yield* game.clearObjectVelocity(object);
              local4 = word(local4 + 1) & 0xff;
            } else {
              local3 = 255;
            }
          }
        }
        if (signed(local3) !== 0) {
          yield* game.setActorStateHolder(0x7cb /* "Naga" */, 0x1538 /* "Dog Food" */);
          yield* game.setObjectRecordPropertyFromGroup(object);
          yield* run.playPickUpSound();
          break block241;
        }
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}
