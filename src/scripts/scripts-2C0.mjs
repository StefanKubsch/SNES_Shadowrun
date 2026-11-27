// Scripts 2C0 to 2DF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, multiply, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 2C0: 1 argument.
export function* script2C0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script380(local0, 3, 0xa, 1, 5);
  return null;
}

// Script 2C1: 1 argument.
export function* script2C1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script07A(0x900 | local0, 0xb0a, 0, 0x70c));
  return null;
}

// Script 2C2: 1 argument.
export function* script2C2(state, arg0) {
  let object = 0,
    local3 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x40);
  yield* game.setObjectAnimation(object, 2);
  yield* game.setObjectDirection(object, 0);
  yield* game.moveObjectToWaypoint(object, 9);
  yield* game.wait(1, 0x3c);
  yield* game.notice(0xe, 2, 9, 3, 0x400, 0x5e /* "Hey! You!" */, 0x78);
  local3 = 0;
  for (;;) {
    if (((yield* game.wait(5, 2)) & 4) === 0) {
      if (less(yield* game.getDistanceToPlayer(object), 0x28)) {
        local3 = 255;
      }
    } else {
      local3 = 255;
    }
    if (signed(local3) !== 0) {
      yield* game.stopMotion(object);
      yield* game.clearObjectVelocity(object);
      yield* game.setObjectAnimation(object, 0);
      yield* game.turnObjectToPlayer(object);
      yield* game.wait(1, 0x19);
      yield* game.talk(object, 0x7f);
      yield* game.resetObjectRecordProperty(object);
      yield* game.keepObjectFlagBits(object, 0xffbf);
      yield* game.setObjectAnimation(object, 2);
      yield* game.moveObjectToWaypoint(object, 0xa);
      yield* game.wait(4, 0);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 2C3: 1 argument.
export function* script2C3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 1, 6);
  yield* run.nothing(object, 0xe6, 0x99);
  return null;
}

// Script 2C4: 1 argument.
export function* script2C4(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(1, 1);
  const t1 = yield* game.chooseEnemyTarget(object);
  local2 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.playSoundEffect(object, 0x1e, 0xff, 0xff);
    yield* game.wait(1, yield* game.moveObjectTowardsObject(object, signed(local2)));
    yield* game.removeObject(object);
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    local1 = (yield* game.createObject(0xb8, t4, t3, t2, 0x382)) & 0xff;
    yield* game.wait(1, 0xa);
    yield* game.blast(local1, 0xb);
  } else {
    yield* game.removeObject(object);
  }
  return null;
}

// Script 2C5: 1 argument.
export function* script2C5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.lockedDoor(local0, 0);
  return null;
}

// Script 2C6: 1 argument.
export function* script2C6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
    yield* game.setObjectRecordFlagBits(object, 1);
    yield* game.keepObjectFlagBits(object, 0xffbf);
    yield* game.setObjectActionAndDirection(object, 2, 4);
    yield* game.moveObjectToWaypoint(object, 0);
    yield* game.wait(4, 0);
    yield* game.stopMotion(object);
    yield* game.setObjectVelocity(object, 0xfffe, 0xfffb, 0);
    yield* game.wait(1, 0x3c);
    yield* game.releaseObjectGraphics(object);
    yield* game.removeObject(object);
    return null;
  }
  return null;
}

// Script 2C7: 1 argument.
export function* script2C7(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 0);
  yield* game.wait(1, 0x64);
  count = 0xc8;
  for (;;) {
    yield* game.wait(1, 1);
    count = word(count - 1);
    if (((yield* game.hasFightTarget()) | truth(count === 0)) !== 0) {
      block58: {
        if (count !== 0) {
          for (;;) {
            yield* game.wait(1, 1);
            if ((yield* game.hasFightTarget()) === 0) {
              break block58;
            }
          }
        }
      }
      for (;;) {
        yield* game.wait(1, 0x14);
        if ((yield* game.getDistanceToPlayer(object)) <= 0x64) {
          yield* game.notice(
            2,
            0x14,
            0x13,
            4,
            0x800,
            0x7e /* "I have a strange feeling about those eyes..." */,
            0xf0,
          );
          yield* game.wait(1, 0x3c);
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* game.setObjectVelocity(object, 0xfffe, 0xffff, 0);
          yield* game.wait(1, 0x14);
          yield* game.setObjectVelocity(object, 0xfffe, 0, 0);
          yield* game.setObjectActionAndDirection(object, 0, 0);
          yield* game.wait(8, 0);
          yield* game.clearObjectVelocity(object);
          yield* game.wait(1, 0x3c);
          yield* game.talk(object, 0);
          yield* game.setObjectVelocity(object, 2, 1, 0);
          yield* game.setObjectActionAndDirection(object, 2, 0);
          yield* game.wait(8, 0);
          yield* game.releaseObjectGraphics(object);
          yield* game.clearObjectVelocity(object);
          if ((yield* game.isTopicKnown(0xd /* "Dog" */)) !== 0) {
            yield* game.resetObjectRecordProperty(object);
          }
          yield* game.removeObject(object);
          return null;
        }
      }
    }
  }
}

// Script 2C8: 1 argument.
export function* script2C8(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  for (;;) {
    const t1 = truth(((yield* game.wait(0x90, 0)) & 0x10) !== 0);
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      const t2 = yield* game.getObjectCoarseHeight(object);
      const t3 = yield* game.getObjectCoarseY(object);
      const t4 = yield* game.getObjectCoarseX(object);
      yield* game.createObject(0xb8, t4, t3, t2, 0x382);
      yield* game.blast(object, 0xa);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
    yield* game.notice(4, 0x15, 0x16, 3, 0x800, 0x1e2 /* "The pin has been pulled out." */, 0xb4);
  }
}

// Script 2C9: 1 argument.
export function* script2C9(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0 & 0xff;
    for (;;) {
      yield* game.setObjectAnimation(object, 4);
      yield* game.playSoundEffect(object, 0x42, 0xff, 3);
      yield* game.wait(8, 0);
      if ((yield* game.getObjectNumber(object)) !== 0x1ab) {
        if ((yield* game.getObjectNumber(object)) !== 0x214) {
          yield* game.wait(1, 0x17);
        } else {
          yield* game.wait(1, 0x13);
        }
      } else {
        yield* game.wait(1, 0xb);
      }
      const t1 = word(local2 - 1);
      local2 = word(local2 - 1) & 0xff;
      if (t1 === 0) {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  block395: {
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setScriptVariable(0x2a, 0);
      yield* game.setObjectFlags(object, 0);
      yield* run.script0AE(object);
      if ((yield* game.getObjectNumber(object)) !== 0x1ab) {
        if ((yield* game.getObjectNumber(object)) !== 0x214) {
          local1 = 10;
        } else {
          local1 = 6;
        }
      } else {
        local1 = 1;
      }
      for (;;) {
        yield* game.turnObjectToPlayer(object);
        yield* game.wait(1, 0xa);
        const t2 = word(local1 - 1);
        local1 = word(local1 - 1) & 0xff;
        if (t2 === 0) {
          yield* game.wait(1, 0x8c);
          if ((yield* game.getObjectNumber(object)) === 0xa8e) {
            yield* game.notice(
              4,
              1,
              0x19,
              3,
              0x400,
              0x233 /* "Armitage, I've been expecting you." */,
              0xf0,
            );
          }
          yield* game.setObjectAnimation(object, 2);
          yield* game.moveObjectStraightToPlayer(object);
          yield* game.wait(1, 0x28);
          yield* game.stopMotion(object);
          yield* game.clearObjectVelocity(object);
          if ((yield* game.getObjectNumber(object)) === 0xa8e) {
            yield* game.notice(
              5,
              3,
              0x18,
              3,
              0x400,
              0x234 /* "You will pay for your sabotage!" */,
              0xf0,
            );
          }
          yield* game.turnObjectToPlayer(object);
          yield* game.appendToFightList(object);
          yield* sub5(8);
          if ((yield* game.getObjectNumber(object)) !== 0xa8e) {
            if ((yield* game.getObjectNumber(object)) !== 0x1ab) {
              if ((yield* game.getObjectNumber(object)) !== 0x214) {
                local1 = 8;
              } else {
                local1 = 4;
              }
            } else {
              local1 = 2;
            }
          } else {
            yield* game.notice(
              5,
              1,
              0x15,
              4,
              0x400,
              0x235 /* "Finish him. We must escape before the computer blows." */,
              0xf0,
            );
            yield* game.setObjectVelocity(object, 0, 4, 0);
            yield* game.setObjectActionAndDirection(object, 2, 0);
            yield* game.wait(1, 0x1e);
            yield* game.clearObjectVelocity(object);
            yield* game.turnObjectToPlayer(object);
            local1 = 7;
          }
          yield* sub5(local1);
          if ((yield* game.getObjectNumber(object)) === 0xa8e) {
            yield* game.setScriptVariable(0x2a, 1);
          }
          yield* game.fightListRemove(object);
          yield* run.leaveBodyAndResetRecord(object);
          break block395;
        }
      }
    }
  }
  return null;
}

// Script 2CA: 1 argument.
export function* script2CA(state, arg0) {
  let local0 = 0,
    created = 0;
  local0 = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  const t1 = state.byte('AIM_TARGET_OBJECT');
  const t2 = yield* game.getPlayerObjectCopy();
  if ((yield* game.canAttack(t2, t1)) !== 0) {
    if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
      state.setByte('SPELL_EFFECT_BUSY', 0, 0xffff);
      const t3 = word((yield* game.getObjectCoarseHeight(state.byte('PLAYER_OBJECT'))) + 0x20);
      const t4 = yield* game.getObjectCoarseY(state.byte('PLAYER_OBJECT'));
      const t5 = yield* game.getObjectCoarseX(state.byte('PLAYER_OBJECT'));
      created = (yield* game.createObject(0xdc, t5, t4, t3, 0xa1)) & 0xff;
      yield* game.setObjectDirection(created, shiftRight(word(local0 - 1), 1));
      yield* game.setObjectAnimation(created, 0);
      yield* game.playSoundEffect(created, 0x1e, 0xff, 0xff);
      yield* game.wait(
        1,
        yield* game.moveObjectTowardsObject(created, state.byte('AIM_TARGET_OBJECT')),
      );
      yield* game.removeObject(created);
      const t6 = yield* game.getObjectCoarseHeight(created);
      const t7 = yield* game.getObjectCoarseY(created);
      const t8 = yield* game.getObjectCoarseX(created);
      created = (yield* game.createObject(0xb8, t8, t7, t6, 0x382)) & 0xff;
      yield* game.wait(1, 0xa);
      yield* game.blast(created, multiply(local0, 6));
      state.setByte('SPELL_EFFECT_BUSY', 0, 0);
    }
  }
  return null;
}

// Script 2CB: 1 argument.
export function* script2CB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script1AD(local0, 4, 0x5a, 0x70, 0x600);
  return null;
}

// Script 2CC: 1 argument.
export function* script2CC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectDialog(object, 0x4c);
  yield* game.wait(2, 0);
  return null;
}

// Script 2CD: 6 arguments.
export function* buyCyberware(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  local5 = arg3;
  local7 = arg4 & 0xff;
  local8 = arg5;
  local12 = 0;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.setSpriteMode(object, 0x8001);
  for (;;) {
    yield* game.wait(1, 1);
    if ((yield* game.isTopicKnown(8 /* "Cyberware" */)) !== 0) {
      for (;;) {
        const t1 = yield* game.wait(0xa1, 1);
        local10 = t1;
        if ((local10 & 0x80) !== 0) {
          yield* game.notice(4, 2, local7, 3, 0x800, local3, 0x50);
        }
        if ((local10 & 0x20) !== 0) {
          yield* game.setActorStateFlagBits(0x31e, 0x20);
          yield* game.wait(1, 0x14);
          yield* game.notice(2, 2, 0x1a, 6, 0x400, local5, 1);
          if ((yield* game.question(0x1a, 6)) !== 0) {
            if ((yield* game.payNuyen(local1)) === 0) {
              yield* game.notice(8, 2, 0xf, 3, 0, 2 /* "Not enough money!" */, 0x78);
            } else {
              local12 = 255;
            }
          }
          if (signed(local12) !== 0) {
            if (state.byte('JAKE_SKILLSOFT') === 0 && local8 === 0x3aa) {
              state.setByte('JAKE_SKILLSOFT', 0, 1);
            }
            if (state.byte('JAKE_DERMAL_ARMOUR') === 0 && local8 === 0x15c4) {
              state.setByte('JAKE_DERMAL_ARMOUR', 0, 1);
            }
            if (
              (truth(local8 === 0x192f) & (signed(state.byte('JAKE_WIRED_REFLEXES')) ^ 0xffff)) !==
              0
            ) {
              state.setByte('JAKE_WIRED_REFLEXES', 0, 0xffff);
            }
            yield* game.setActorStateFlagBits(local8, 0xc0);
            yield* game.resetObjectRecordProperty(object);
            yield* game.removeObject(object);
            return null;
          }
        }
      }
    }
  }
}

// Script 2CE: 1 argument.
export function* modifySubLevelDoor(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  yield* game.setScriptVariableBits(0xe, local0);
  yield* game.notice(4, 2, 0x18, 3, 0, 0x11c /* "Sub-level door program modified." */, 0xf0);
  return null;
}

// Script 2CF: 1 argument.
export function* script2CF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x160);
  yield* game.setObjectArmour(object, 3);
  yield* game.setObjectRecordCount(object, word((yield* game.randomBelow(8)) + 0xf));
  if (
    (yield* run.script076(
      object,
      4,
      0x33,
      0,
      4,
      1,
      word(0x46 + ((yield* game.randomByte()) & 0x1f)),
    )) === 0
  ) {
    yield* game.removeObject(object);
  } else {
    yield* run.dropNuyen15E(yield* run.leaveBody(object));
  }
  return null;
}

// Script 2D0: 1 argument.
export function* script2D0(state, arg0) {
  let object = 0,
    local1 = 0,
    local3 = 0;
  function* sub5(in0, in1) {
    local1 = in0;
    local3 = in1;
    yield* game.wait(1, local1);
    return local3 ^ 0xffff;
  }
  object = arg0 & 0xff;
  yield* game.resetObjectRecordProperty(object);
  yield* game.notice(2, 2, 0x15, 4, 0x400, yield* sub5(0x3c, 0xffc4), 0xf0);
  yield* game.notice(8, 5, 0x16, 3, 0x400, yield* sub5(0x78, 0xffc3), 0xb4);
  yield* game.notice(2, 2, 0x13, 3, 0x400, yield* sub5(0xf0, 0xffc2), 0xf0);
  yield* game.notice(6, 4, 0x18, 4, 0x400, yield* sub5(0xb4, 0xffc1), 0x12c);
  yield* game.notice(2, 2, 9, 3, 0x400, yield* sub5(0xf0, 0xffc0), 0x78);
  return null;
}

// Script 2D1: no arguments.
export function* script2D1(state) {
  yield* run.script118(0xe0);
  return null;
}

// Script 2D2: 1 argument.
export function* script2D2(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x63c)) & 0x40) === 0) {
    yield* game.setObjectArmour(object, 0x3f);
    if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
      yield* game.notice(8, 2, 0xb, 3, 0x400, 0x1e4 /* "Get 'em boys." */, 0xb4);
    }
    yield* game.setObjectActionAndDirection(object, 0, 0);
    yield* game.wait(1, 0x28);
    yield* run.script076(object, 0xa, 0x45, 0, 5, 2, 0x14);
  } else {
    yield* game.resetObjectRecordProperty(object);
    yield* game.removeObject(object);
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = yield* game.getObjectCoarseY(object);
    const t3 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0x99 /* "body" */, t3, t2, t1, 0x152);
  }
  return null;
}

// Script 2D3: 1 argument.
export function* script2D3(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x89d)) & 0x80) === 0) {
    yield* run.script06E(object, 0x89d, 0, 0x69, 0x2000);
    yield* game.notice(2, 3, 0x18, 3, 0x400, 0x18f /* "This should pay off a few bills." */, 0xb4);
    yield* game.removeObject(object);
    yield* game.addSceneObject(0x5b, 0, 0, 0, 0, 0x89d, 0x14);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 2D4: 1 argument.
export function* script2D4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(object), 0x64)) {
    yield* game.notice(0xd, 2, 9, 3, 0, 0x68 /* "The Cage." */, 0x78);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 2D5: 2 arguments.
export function* icSecuredDoor(state, arg0, arg1) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  if (((yield* game.getScriptVariable(0xe)) & local1) === 0) {
    yield* game.setObjectActionAndDirection(object, 3, 5);
    yield* game.setObjectFlagBits(object, 0x100);
    for (;;) {
      if (((yield* game.wait(0x280, 0)) & 0x200) === 0) {
        yield* game.notice(
          2,
          0x15,
          0x16,
          3,
          0x800,
          0x11b /* "The panel logo reads: D-G-C" */,
          0xf0,
        );
      } else {
        yield* game.notice(
          2,
          0x15,
          0x1b,
          3,
          0x800,
          0x119 /* "The door is secured by IC program." */,
          0xf0,
        );
      }
    }
  } else {
    yield* run.script0F7(object);
    return null;
  }
}

// Script 2D6: 1 argument.
export function* script2D6(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block144: {
    object = arg0 & 0xff;
    yield* game.setScriptVariable(0x2a, 0);
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) {
      yield* game.setObjectArmour(object, 3);
      yield* game.setObjectRecordCount(object, 0x1e);
      yield* game.setObjectActionAndDirection(object, 4, 0);
      yield* game.appendToFightList(object);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* run.script235(object, signed(local2), 2, 1, 4, 1, 0x32)) & 0xff;
        } else {
          yield* game.turnObjectToObject(object, signed(local2));
          local1 =
            truth(
              ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0xf)))) &
                0x800) !==
                0,
            ) & 0xff;
        }
        if (signed(local1) !== 0) {
          yield* game.addKarma(9);
          yield* game.fightListRemove(object);
          if ((yield* game.getObjectNumber(object)) !== 0x5b0) {
            yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
            break block144;
          }
          yield* game.setActorStateFlagBits(0x85e, 1);
          yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
          break block144;
        }
      }
    }
  }
  return null;
}

// Script 2D7: 1 argument.
export function* script2D7(state, arg0) {
  let object = 0,
    local1 = 0;
  block135: {
    object = arg0 & 0xff;
    yield* game.setObjectArmour(object, 2);
    yield* game.setObjectRecordCount(object, 0xf);
    yield* game.setObjectActionAndDirection(object, 1, 0);
    yield* game.setObjectVelocity(object, 0, 2, 0);
    yield* game.appendToFightList(object);
    if (((yield* game.wait(0x801, 0x64)) & 0x800) === 0) {
      yield* game.clearObjectVelocity(object);
      yield* game.turnObjectToPlayer(object);
      yield* game.notice(2, 2, 9, 3, 0x400, 0x5e /* "Hey! You!" */, 0x3c);
      for (;;) {
        yield* game.setObjectAnimation(object, 0);
        const t1 = truth(((yield* game.wait(0x801, 0x10)) & 0x800) !== 0);
        local1 = t1 & 0xff;
        if (t1 === 0) {
          yield* game.turnObjectToPlayer(object);
          yield* game.setObjectAnimation(object, 4);
          yield* game.shootAtObject(object, yield* game.getPlayerObject(), 2, 0, 5, 1);
          yield* game.playSoundEffect(object, 0xc, 0xff, 0xff);
          local1 = truth(((yield* game.wait(0x801, 0x50)) & 0x800) !== 0) & 0xff;
        }
        if (signed(local1) !== 0) {
          break block135;
        }
      }
    }
  }
  yield* game.addKarma(2);
  yield* game.fightListRemove(object);
  yield* game.setObjectDirection(object, 0);
  yield* run.dropNuyen15E(yield* run.leaveBodyAndResetRecord(object));
  return null;
}

// Script 2D8: 1 argument.
export function* script2D8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  for (;;) {
    yield* game.wait(0x80, 0);
    if ((yield* game.getStoryStage()) !== 1) {
      yield* game.notice(
        2,
        0x13,
        0x16,
        5,
        0x800,
        0xb4 /* "TENTH STREET STATION IS NOW FULLY REPAIRED - ECORAIL...WE TR..." */,
        0xf0,
      );
    } else {
      yield* game.notice(
        2,
        0x14,
        0x16,
        4,
        0x800,
        0xb3 /* "STATION CLOSED FOR REPAIRS - ECORAIL CORP." */,
        0xf0,
      );
    }
  }
}

// Script 2D9: 1 argument.
export function* script2D9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    created = 0;
  local0 = arg0 & 0xff;
  yield* game.endDialog();
  if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
    const t1 = yield* game.spellGloveTarget();
    local1 = t1 & 0xff;
    if (t1 === 0xffff) {
      yield* game.addMagicPoints(word(4 + local0));
    } else {
      const t2 = word((yield* game.getObjectCoarseHeight(state.byte('MEMBER_OBJECT'))) + 0x20);
      const t3 = yield* game.getObjectCoarseY(state.byte('MEMBER_OBJECT'));
      const t4 = yield* game.getObjectCoarseX(state.byte('MEMBER_OBJECT'));
      created = (yield* game.createObject(0xdc, t4, t3, t2, 0xa1)) & 0xff;
      yield* game.setObjectDirection(created, shiftRight(word(local0 - 1), 1));
      yield* game.setObjectAnimation(created, 0);
      yield* game.playSoundEffect(created, 0x1e, 0xff, 0xff);
      yield* game.wait(1, yield* game.moveObjectTowardsObject(created, signed(local1)));
      yield* game.removeObject(created);
      const t5 = yield* game.getObjectCoarseHeight(created);
      const t6 = yield* game.getObjectCoarseY(created);
      const t7 = yield* game.getObjectCoarseX(created);
      created = (yield* game.createObject(0xb8, t7, t6, t5, 0x382)) & 0xff;
      yield* game.wait(1, 0xa);
      yield* game.blast(created, multiply(local0, 6));
    }
  }
  return null;
}

// Script 2DA: no arguments.
export function* script2DA(state) {
  const t1 = yield* run.byNegotiation(0x1f4, 0x190, 0x12c);
  const t2 = yield* run.byNegotiationB(0x166, 0x167, 0x168);
  yield* run.script162(0x78c, t2, t1, 0x165, 0x164);
  return null;
}

// Script 2DB: 1 argument.
export function* script2DB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script27C(0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2DC: 1 argument.
export function* script2DC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x98b)) & 0x80) === 0) {
    yield* game.keepObjectFlagBits(object, 0xdfff);
    yield* game.setObjectActionAndDirection(object, 0, 0);
    for (;;) {
      yield* game.wait(2, 0);
      yield* game.turnObjectToPlayer(object);
      yield* game.wait(1, 0x1e);
      yield* game.talk(object, 0x6b);
      if (((yield* game.getActorStateFlags(0x98b)) & 0x80) === 0) {
        yield* game.wait(1, 0x3c);
        yield* game.setObjectDirection(object, 0);
      } else {
        yield* game.notice(2, 2, 0x18, 3, 0x400, 0xe7 /* "I am now under your command..." */, 0x78);
        yield* game.addSceneObject(0x59, 0, 0, 0, 0xa, 0x98b, 0xa);
        yield* game.removeObject(object);
        return null;
      }
    }
  } else {
    return null;
  }
}

// Script 2DD: 1 argument.
export function* script2DD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script27C(0x200 | local0, 0x100, 0, 0x804, 0xc06));
  return null;
}

// Script 2DE: 1 argument.
export function* script2DE(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0;
    local1 = truth(((yield* game.wait(0x801, local2)) & 0x800) !== 0) & 0xff;
  }
  object = arg0 & 0xff;
  if ((yield* game.isActorStateProperty(0x8b2, 0x152a)) === 0) {
    yield* game.setObjectRecordCount(object, 0x14);
    yield* game.setObjectActionAndDirection(object, 0, 5);
    yield* game.keepObjectFlagBits(object, 0xdfff);
    yield* game.setObjectFlagBits(object, 0x8160);
    for (;;) {
      yield* game.wait(1, 0xa);
      if (
        (truth(less(yield* game.getDistanceToPlayer(object), 0xc8)) &
          truth(
            (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) ===
              (yield* game.getObjectCoarseHeight(object)),
          )) !==
        0
      ) {
        yield* game.playSoundEffect(object, 0x5a, 0xff, 3);
        yield* game.setObjectFlagBits(object, 0x2000);
        yield* game.appendToFightList(object);
        for (;;) {
          local1 = truth(((yield* game.wait(0x801, 8)) & 0x800) !== 0) & 0xff;
          if (
            (truth((yield* game.getDistanceToPlayer(object)) > 0x3c) &
              (signed(local1) ^ 0xffff)) ===
            0
          ) {
            block224: {
              if (signed(local1) === 0) {
                yield* game.setObjectAnimation(object, 1);
                yield* game.moveObjectStraightToPlayer(object);
                for (;;) {
                  yield* sub5(0xa);
                  if (
                    (signed(local1) |
                      truth(less(yield* game.getDistanceToPlayer(object), 0xa)) |
                      truth((yield* game.getDistanceToPlayer(object)) > 0x3c)) !==
                    0
                  ) {
                    if (less(yield* game.getDistanceToPlayer(object), 0xf)) {
                      yield* game.shootAtObject(object, yield* game.getPlayerObject(), 5, 5, 3, 1);
                    }
                    yield* game.stopMotion(object);
                    yield* game.clearObjectVelocity(object);
                    yield* game.setObjectAnimation(object, 0);
                    yield* game.keepObjectFlagBits(object, 0xfeff);
                    if (signed(local1) === 0) {
                      yield* sub5(0x14);
                    }
                    yield* game.setObjectFlagBits(object, 0x100);
                    break block224;
                  }
                }
              }
            }
            if (signed(local1) !== 0) {
              yield* game.fightListRemove(object);
              yield* game.setActorStateFlagBits(0x152a, 0x80);
              yield* game.setScriptVariable(0x2a, object);
              yield* game.removeObject(object);
              return null;
            }
          }
        }
      }
    }
  } else {
    yield* game.resetObjectRecordProperty(object);
    yield* game.removeObject(object);
    return null;
  }
}

// Script 2DF: 1 argument.
export function* script2DF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script27C(0x300 | local0, 0x102, 0, 0x804, 0xc06));
  return null;
}
