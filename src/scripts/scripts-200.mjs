// Scripts 200 to 21F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  multiply,
  notEqualOrNegativeLeft,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 200: 1 argument.
export function* script200(state, arg0) {
  let object = 0;
  function* sub5() {
    yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x99 /* "A bone of the living dead." */, 0x78);
  }
  object = arg0 & 0xff;
  block92: {
    if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
      if ((yield* game.scriptAction(0x80)) === 0x80) {
        yield* sub5();
      }
    } else {
      yield* game.setObjectRecordFlags(object, object);
      for (;;) {
        if (((yield* game.wait(0x90, 0)) & 0x10) !== 0) {
          yield* game.setObjectRecordPropertyFromGroup(object);
          yield* run.script04B();
          yield* game.releaseObjectGraphics(object);
          yield* game.wait(1, 0x3c);
          break block92;
        }
        yield* sub5();
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 201: 1 argument.
export function* script201(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x61);
  yield* game.wait(2, 0);
  return null;
}

// Script 202: 1 argument.
export function* script202(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script2AA(local0, 1, 0x203, 0x401, 0x402, 0x2305);
  return null;
}

// Script 203: 1 argument.
export function* script203(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script2BC(local0, 0x22, 0x26, 0, 0x80, 0x16c0);
  return null;
}

// Script 204: 1 argument.
export function* script204(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x62);
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
    yield* game.setObjectActionAndDirection(object, 0, 7);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 205: 1 argument.
export function* script205(state, arg0) {
  let local0 = 0,
    created = 0,
    local2 = 0,
    local3 = 0;
  block363: {
    local0 = arg0 & 0xff;
    yield* game.endDialog();
    if (state.byte('SPIRIT_SUMMONED') === 0) {
      if ((yield* game.spendMagic(word(8 + shiftLeft(local0, 1)))) !== 0) {
        if ((yield* game.getPreviousFightObject(0xffff)) !== 0xffff) {
          state.setByte('SPIRIT_SUMMONED', 0, 1);
          const t1 = word((yield* game.getObjectCoarseHeight(state.byte('MEMBER_OBJECT'))) + 0x20);
          const t2 = yield* game.getObjectCoarseY(state.byte('MEMBER_OBJECT'));
          const t3 = yield* game.getObjectCoarseX(state.byte('MEMBER_OBJECT'));
          created = (yield* game.createObject(0xc4, t3, t2, t1, 0xa1)) & 0xff;
          yield* game.setObjectDirection(created, 0);
          yield* game.setObjectAnimation(created, 2);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          yield* game.wait(1, 0xa);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(1, 0xa);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          yield* game.wait(1, 0x1e);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(1, 0xa);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(1, 0xa);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          local3 = 255;
          for (;;) {
            const t4 = yield* game.getPreviousFightObject(signed(local3));
            local3 = t4 & 0xff;
            if (t4 === 0xffff) {
              yield* game.removeObject(created);
              yield* game.wait(1, 0x14);
              state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
              state.setByte('SPIRIT_SUMMONED', 0, 0);
              break block363;
            }
            yield* game.turnObjectToObject(created, signed(local3));
            const t5 = word((yield* game.moveObjectTowardsObject(created, signed(local3))) - 5);
            local2 = t5 & 0xff;
            if (t5 > 0xf5 || local2 === 0) {
              local2 = 1;
            }
            yield* game.wait(1, local2);
            yield* game.playSoundEffect(created, 0x5a, 0xc0, 0xff);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
            yield* game.wait(1, 5);
            yield* game.shootAtObject(created, signed(local3), 0xff, 0, multiply(local0, 6), 0);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          }
        } else {
          yield* game.addMagicPoints(word(8 + shiftLeft(local0, 1)));
        }
      }
    }
  }
  return null;
}

// Script 206: 1 argument.
export function* usePhone(state, arg0) {
  let object = 0,
    local1 = 0,
    count = 0,
    local6 = 0,
    local8 = 0;
  function* sub5() {
    const t1 = yield* game.randomBelow(4);
    local6 = t1;
    if (local6 !== 0) {
      if (local6 !== 1) {
        if (local6 !== 2) {
          local8 = 78;
        } else {
          local8 = 72;
        }
      } else {
        local8 = 82;
      }
    } else {
      local8 = 80;
    }
    yield* game.playSoundEffect(object, local8, 0xff, 3);
  }
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  for (;;) {
    yield* game.setObjectAnimation(object, 6);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0xff7f);
      if ((yield* game.getScriptVariable(0)) === 0) {
        yield* game.notice(
          2,
          2,
          0x1b,
          3,
          0,
          0x4a /* "You don't have any numbers to call." */,
          0xf0,
        );
        yield* game.confirmKey();
      } else {
        block193: {
          yield* game.releaseNoticeWindows();
          yield* game.wait(1, 1);
          yield* game.notice(2, 3, 0xf, 3, 0, 0x49 /* "Please dial number." */, 2);
          const t2 = yield* game.spellChoice();
          local1 = t2;
          if (local1 !== 0) {
            yield* game.setObjectAnimation(object, 1);
            count = 6;
            for (;;) {
              yield* sub5();
              yield* game.wait(1, word(8 + ((yield* game.randomByte()) & 7)));
              count = word(count - 1);
              if (count <= 0) {
                yield* run.script397(object, local1, 0);
                yield* game.notice(
                  5,
                  5,
                  0x16,
                  3,
                  0x400,
                  0x4d /* "Thank you for using ECOTEL." */,
                  0x78,
                );
                break block193;
              }
            }
          }
        }
      }
    }
    if (((yield* game.wait(0x81, 1)) & 0x80) !== 0) {
      yield* game.setObjectAnimation(object, 2);
      yield* game.wait(1, 0x14);
      yield* game.notice(3, 2, 0x19, 3, 0x400, 0x18 /* "Welcome to ECOTEL phone service." */, 0x78);
      yield* game.wait(1, 0x14);
      yield* game.notice(4, 4, 0x17, 3, 0x400, 0x19 /* "Please insert CredStick in slot." */, 0x78);
      yield* game.wait(1, 0x28);
      yield* game.setObjectAnimation(object, 0);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(object, 6);
    }
  }
}

// Script 207: 1 argument.
export function* script207(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  function* sub50(in0, in1, in2, in3, in4) {
    local2 = in0 & 0xff;
    local3 = in1 & 0xff;
    local4 = in2;
    local6 = in3;
    local8 = in4;
    yield* game.setObjectActionAndDirection(object, local2, local3);
    yield* game.setObjectVelocity(object, local4, local6, local8);
  }
  function* sub47() {
    if (((yield* game.wait(0x801, 0x190)) & 0x800) === 0) {
      yield* game.appendToFightList(object);
      local1 = 255;
      yield* sub50(7, 3, 0, 0, 0);
      if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
        yield* sub50(1, 4, 0, 0xfffe, 0);
        if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
          yield* game.clearObjectVelocity(object);
          yield* game.setObjectAnimation(object, 8);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            yield* game.releaseObjectGraphics(object);
            yield* game.fightListRemove(object);
            local1 = 0;
            yield* game.wait(1, 0x320);
            yield* game.appendToFightList(object);
            local1 = 255;
            yield* sub50(7, 7, 0, 0, 0);
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              yield* sub50(1, 0, 0, 2, 0);
              if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
                yield* game.clearObjectVelocity(object);
                yield* game.setObjectAnimation(object, 8);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  yield* game.releaseObjectGraphics(object);
                  yield* game.fightListRemove(object);
                  local1 = 0;
                  return 0;
                }
                return 0xffff;
              }
              return 0xffff;
            }
            return 0xffff;
          }
          return 0xffff;
        }
        return 0xffff;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  function* sub5(in0) {
    local2 = in0 & 0xff;
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local2 + (yield* game.getObjectCoarseHeight(object)));
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
  local1 = 0;
  for (;;) {
    yield* game.wait(1, 0x3c);
    if ((yield* sub47()) !== 0) {
      yield* sub5(4);
      yield* sub5(8);
      yield* sub5(0xc);
      yield* sub5(0x10);
      yield* sub5(0x14);
      yield* sub5(0x18);
      yield* game.addKarma(2);
      if (signed(local1) !== 0) {
        yield* game.fightListRemove(object);
      }
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 208: 1 argument.
export function* script208(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.setObjectDialog(object, 0x63);
  yield* game.wait(2, 0);
  return null;
}

// Script 209: 1 argument.
export function* script209(state, arg0) {
  let object = 0,
    count = 0;
  object = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) <= 1) {
    return null;
  }
  count = word(0xc8 + (yield* game.randomBelow(0x28)));
  for (;;) {
    yield* game.placeObjectInFormation(object);
    yield* game.wait(1, 1);
    count = word(count - 1);
    if (count === 0) {
      yield* run.leaveBody(object);
      for (;;) {
        yield* game.wait(1, 1);
      }
    }
  }
}

// Script 20A: 1 argument.
export function* script20A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script329(object, 0x66);
  yield* game.keepObjectRecordFlagBits(object, 0xff97);
  return null;
}

// Script 20B: 1 argument.
export function* script20B(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectArmour(object, 2);
  yield* game.setObjectRecordCount(object, 0x23);
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* game.wait(1, 0x1e);
  yield* game.appendToFightList(object);
  loop28: for (;;) {
    yield* game.setObjectAnimation(object, 2);
    yield* game.moveObjectStraightToPlayer(object);
    for (;;) {
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
      if ((truth(less(yield* game.getDistanceToPlayer(object), 0xf)) | signed(local1)) !== 0) {
        block127: {
          if (signed(local1) === 0) {
            yield* game.stopMotion(object);
            yield* game.clearObjectVelocity(object);
            for (;;) {
              yield* game.setObjectAnimation(object, 4);
              yield* game.shootAtObject(object, yield* game.getPlayerObject(), 2, 4, 5, 1);
              yield* game.playSoundEffect(object, 6, 0xff, 3);
              local1 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
              if ((truth((yield* game.getDistanceToPlayer(object)) > 0xf) | signed(local1)) !== 0) {
                break block127;
              }
            }
          }
        }
        if (signed(local1) === 0) {
          continue loop28;
        }
        yield* game.addKarma(7);
        yield* game.fightListRemove(object);
        yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
        return null;
      }
    }
  }
}

// Script 20C: 1 argument.
export function* script20C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    created = 0;
  block155: {
    local0 = arg0 & 0xff;
    yield* game.endDialog();
    if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
      const t1 = yield* game.spellGloveTarget();
      local1 = t1 & 0xff;
      if (
        (truth(t1 === 0xffff) |
          truth(
            ((yield* game.getObjectFlags(signed(local1))) & 3) !== 3 &&
              notEqualOrNegativeLeft(signed(local1), state.byte('PLAYER_OBJECT')),
          )) ===
        0
      ) {
        yield* game.raiseStateCount(signed(local1), multiply(local0, 0xf));
        const t2 = yield* game.getObjectCoarseHeight(signed(local1));
        const t3 = word((yield* game.getObjectCoarseY(signed(local1))) - 1);
        const t4 = word((yield* game.getObjectCoarseX(signed(local1))) - 1);
        created = (yield* game.createObject(0xda, t4, t3, t2, 0xa1)) & 0xff;
        yield* game.setObjectDirection(created, 0);
        yield* game.setObjectAnimation(created, 0);
        yield* game.playSoundEffect(created, 0x36, 0xff, 0xff);
        local0 = 60;
        for (;;) {
          yield* game.wait(1, 1);
          const t5 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local1)), 2);
          const t6 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local1)), 2) - 4);
          const t7 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local1)), 2) - 4);
          yield* game.setObjectPosition(created, t7, t6, t5);
          const t8 = word(local0 - 1);
          local0 = word(local0 - 1) & 0xff;
          if (t8 <= 0) {
            yield* game.removeObject(created);
            break block155;
          }
        }
      } else {
        yield* game.addMagicPoints(word(4 + local0));
      }
    }
  }
  return null;
}

// Script 20D: 1 argument.
export function* script20D(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    object2 = 0,
    local11 = 0;
  function* sub5(in0) {
    local11 = in0 & 0xff;
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local11 + (yield* game.getObjectCoarseHeight(object)));
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
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 4);
  }
  yield* game.setObjectRecordCount(object, yield* game.getObjectRecordFlags(object));
  local2 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  local4 = shiftLeft(yield* game.getObjectCoarseY(object), 2);
  local6 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  local1 = 0;
  for (;;) {
    yield* game.wait(1, 0xf);
    if ((yield* game.getDistanceToPlayer(object)) <= 0x3c) {
      yield* game.appendToFightList(object);
      const t6 = yield* run.script093(object);
      local1 = t6 & 0xff;
      if (t6 !== 0) {
        yield* game.addKarma(2);
      }
      yield* game.fightListRemove(object);
      if (signed(local1) === 0) {
        yield* game.setObjectPosition(object, local2, local4, local6);
        yield* game.wait(1, 0xc8);
      }
      if (signed(local1) !== 0) {
        yield* game.playSoundEffect(object, 0x20, 0xff, 3);
        yield* sub5(4);
        yield* sub5(8);
        yield* sub5(0xc);
        yield* sub5(0x10);
        yield* sub5(0x14);
        yield* sub5(0x18);
        if (less(yield* game.getObjectRecordFlags(object), 0x28)) {
          yield* game.setObjectRecordFlags(
            object,
            word(2 + (yield* game.getObjectRecordFlags(object))),
          );
        }
        if (
          (truth(((yield* game.getActorStateFlags(0xbc9)) & 1) !== 0) &
            truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(7))) &
            truth((yield* game.randomBelow(2)) !== 0)) !==
          0
        ) {
          const t7 = yield* game.getActorStateFlags(0x1141);
          object2 = t7 & 0xff;
          if (t7 !== 1) {
            const t8 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
            const t9 = shiftLeft(yield* game.getObjectCoarseY(object), 2);
            const t10 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
            yield* game.setObjectPosition(object2, t10, t9, t8);
            yield* game.setObjectVelocity(object2, 0, 0, 0x10);
            yield* game.setObjectRecordFlags(object2, 1);
            yield* game.setObjectActionAndDirection(object2, 0, 3);
            yield* game.removeObject(object);
            local8 = 0x3c;
            for (;;) {
              yield* game.wait(1, 1);
              yield* game.setObjectFlagBits(object2, 0x20);
              yield* game.wait(1, 1);
              yield* game.keepObjectFlagBits(object2, 0xffdf);
              local8 = word(local8 - 2);
              if (local8 === 0) {
                yield* game.setObjectActionAndDirection(object2, 8, 3);
                return null;
              }
            }
          }
        }
        yield* game.removeObject(object);
        return null;
      }
    }
  }
}

// Script 20E: 1 argument.
export function* script20E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x1e);
    yield* game.appendToFightList(object);
    yield* run.script00F(object, 7, 1, 0xa, 5);
    yield* game.addKarma(0x19);
    yield* game.fightListRemove(object);
    yield* run.leaveBodyAndResetRecord(object);
    yield* game.setActorStateFlagBits(0x1b66, 1);
    yield* game.wait(1, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 20F: 1 argument.
export function* script20F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 210: 1 argument.
export function* script210(state, arg0) {
  let object = 0,
    local1 = 0;
  function* sub5(in0) {
    local1 = in0 & 0xff;
    yield* game.playSoundEffect(object, 0x4a, local1, 3);
    yield* game.wait(1, 4);
  }
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0);
  yield* game.setObjectActionAndDirection(object, 8, 0);
  const t1 = word(0x60 + (yield* game.getObjectCoarseHeight(object)));
  const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(object)) - 4);
  yield* game.createObject(0xc3, t3, t2, t1, 0xf5);
  yield* game.wait(1, 1);
  yield* game.updateObjectDepthMode(object);
  yield* sub5(0xff);
  yield* sub5(0xc0);
  yield* sub5(0x80);
  yield* sub5(0x40);
  yield* game.wait(1, 0x15);
  yield* game.removeObject(object);
  return null;
}

// Script 211: 1 argument.
export function* script211(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 0);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 212: 1 argument.
export function* script212(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 213: 1 argument.
export function* script213(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.lightSwitch(local0, 0);
  return null;
}

// Script 214: 1 argument.
export function* script214(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  loop7: for (;;) {
    yield* game.setObjectAnimation(object, 2);
    yield* game.setObjectFlagBits(object, 0x100);
    yield* game.wait(0x200, 0);
    yield* game.setObjectRecordFlagBits(object, 1);
    yield* game.keepObjectFlagBits(object, 0xfeff);
    yield* game.playSoundEffect(object, 0x30, 0xff, 3);
    yield* game.setObjectAnimation(object, 4);
    yield* game.wait(8, 0);
    yield* game.setObjectAnimation(object, 0);
    for (;;) {
      yield* game.wait(1, 1);
      if (((yield* game.getActorStateFlags(0x1507)) & 0x40) !== 0) {
        yield* game.wait(0x400, 0);
        yield* game.keepObjectRecordFlagBits(object, 0xfffe);
        yield* game.playSoundEffect(object, 0x30, 0xff, 3);
        yield* game.setObjectAnimation(object, 6);
        yield* game.wait(8, 0);
        continue loop7;
      }
    }
  }
}

// Script 215: 1 argument.
export function* script215(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 2);
  yield* run.script1A2(object, 2, 2, 0xffff, 0);
  return null;
}

// Script 216: 1 argument.
export function* script216(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.setObjectDialog(object, 0x5e);
  yield* game.wait(2, 0);
  return null;
}

// Script 217: 1 argument.
export function* script217(state, arg0) {
  let object = 0,
    object2 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(object)) & 0xff;
  const t1 = word(shiftLeft(yield* game.getObjectCoarseHeight(object2), 2) + 0x10);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t3 = word(shiftLeft(yield* game.getObjectCoarseX(object2), 2) - 8);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(1, yield* game.jumpObjectTowardsPoint(object, local2));
  yield* game.clearObjectVelocity(object);
  const t4 = yield* game.getObjectCoarseHeight(object);
  const t5 = yield* game.getObjectCoarseY(object);
  const t6 = yield* game.getObjectCoarseX(object);
  yield* game.createObject(0xb8, t6, t5, t4, 0x382);
  yield* game.blast(object, 8);
  yield* game.removeObject(object);
  return null;
}

// Script 218: 1 argument.
export function* script218(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveWeapon(local0, 6, 3, 0, 1);
  return null;
}

// Script 219: 1 argument.
export function* script219(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script00A(local0, 0x20, 0x24, 0x40, 0x16c0);
  return null;
}

// Script 21A: 1 argument.
export function* script21A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.playSoundEffect(object, 0xc, 0x19, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 21B: 1 argument.
export function* script21B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* game.setObjectActionAndDirection(object, 0, 4);
    yield* game.wait(1, 0x78);
    yield* game.turnObjectToPlayer(object);
    yield* game.playSoundEffect(object, 0x3a, 0xff, 3);
    yield* game.clearObjectTask(object);
  }
  return null;
}

// Script 21C: 1 argument.
export function* script21C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseX(object);
  const t2 = yield* game.getObjectCoarseY(object);
  yield* run.script195(object, t2, t1, 0xffff, 4, 0xa);
  return null;
}

// Script 21D: 1 argument.
export function* script21D(state, arg0) {
  let object = 0,
    local1 = 0,
    count = 0,
    local5 = 0;
  block143: {
    object = arg0 & 0xff;
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if (local1 !== 0x80) {
      if (local1 === 0x100) {
        yield* run.promptUseOn();
        const t2 = yield* game.chooseNumber();
        local5 = t2;
        if (local5 !== 0xffff) {
          if (local5 !== 0x63c) {
            yield* run.refuseToUseOn(local5);
          } else {
            yield* game.setActorStateFlagBits(local5, 1);
            count = 0x28;
            for (;;) {
              yield* game.playSoundEffect(object, 0x26, 0xff, 3);
              yield* game.wait(1, word(shiftRight(count, 2) + 1));
              count = word(count - 1);
              if (count === 0xa) {
                yield* game.endDialog();
                yield* game.setActorStateFlagBits(local5, 0x80);
                yield* game.wait(1, 0xa);
                yield* game.blast(object, 0x14);
                yield* game.resetObjectRecordProperty(object);
                break block143;
              }
            }
          }
        }
      }
    } else {
      yield* game.notice(8, 0x15, 0xf, 3, 0x800, 0x202 /* "It's ready to use." */, 0xf0);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 21E: no arguments.
export function* script21E(state) {
  let local0 = 0,
    local2 = 0;
  const t1 = yield* game.getScriptVariable(0x22);
  local2 = t1;
  if (local2 !== 1) {
    if (local2 !== 2) {
      if (local2 !== 3) {
        if (local2 !== 4) {
          if (local2 !== 5) {
            if (local2 !== 6) {
              local0 = 0x18a;
            } else {
              local0 = 0x188;
            }
          } else {
            local0 = 0x186;
          }
        } else {
          local0 = 0x184;
        }
      } else {
        local0 = 0x182;
      }
    } else {
      local0 = 0x17f;
    }
  } else {
    local0 = 0x182;
  }
  yield* game.setActorStateFlags(0x175a, 0);
  yield* game.changeScene(4, word(local2 - 1), local0);
  return null;
}

// Script 21F: 1 argument.
export function* script21F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectVelocity(object, 0, 3, 0);
  yield* game.wait(1, 0x3c);
  yield* game.clearObjectVelocity(object);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(1, 0x28);
  yield* game.setObjectAnimation(object, 4);
  yield* game.wait(1, 0x1e);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(1, 0x8c);
  yield* game.setObjectActionAndDirection(object, 1, 4);
  yield* game.setObjectVelocity(object, 0, 0xfffc, 0);
  yield* game.wait(1, 0x12c);
  yield* game.clearObjectVelocity(object);
  yield* game.removeObject(object);
  return null;
}
