// Scripts 160 to 17F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, notEqualSignedLeft, script, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 160: 1 argument.
export function* script160(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 1);
  const t1 = yield* game.chooseEnemyTarget(local0);
  local2 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.playSoundEffect(local0, 0x1e, 0xff, 0xff);
    yield* game.wait(1, yield* game.moveObjectTowardsObject(local0, signed(local2)));
    yield* game.removeObject(local0);
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    local1 = (yield* game.createObject(0xb8, t4, t3, t2, 0x382)) & 0xff;
    yield* game.wait(1, 0xa);
    yield* game.blast(local1, 7);
  } else {
    yield* game.removeObject(local0);
  }
  return null;
}

// Script 161: 1 argument.
export function* script161(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.notice(8, 2, 0xc, 3, 0, 0x1d9, 0xf0);
  yield* script(0x0d2, local0);
  return null;
}

// Script 162: 5 arguments.
export function* script162(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0;
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  local6 = arg3;
  local8 = arg4;
  if (!(
    (state.byte('JAKE_CHARISMA') === 3 && state.byte('GROUP_INDEX') > 0) ||
    (state.byte('JAKE_CHARISMA') === 4 && state.byte('GROUP_INDEX') > 2) ||
    (state.byte('JAKE_CHARISMA') === 5 && state.byte('GROUP_INDEX') > 2) ||
    (state.byte('JAKE_CHARISMA') === 6 && state.byte('GROUP_INDEX') > 4)
  )) {
    yield* game.topicText(local2);
    if ((yield* game.question(0x12, 0xa)) === 0) {
      yield* game.topicText(local6);
    } else {
      if ((yield* game.payNuyen(local4)) === 0) {
        yield* game.topicText(local8);
      } else {
        yield* game.endDialog();
        yield* game.setActorStateFlagBits(local0, 0x80);
      }
    }
  } else {
    yield* game.topicText(0x13f);
  }
  return null;
}

// Script 163: 1 argument.
export function* script163(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x140);
  for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      for (;;) {
        if (((yield* game.wait(0x81, 1)) & 0x80) !== 0) {
          yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
          yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x1bf, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.resetObjectRecordProperty(local0);
          yield* game.removeObject(local0);
          return null;
        }
      }
    }
  }
}

// Script 164: 1 argument.
export function* script164(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = (yield* game.randomByte()) & 3;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 1);
  yield* game.updateObjectDepthMode(local0);
  yield* game.wait(0x10, 0);
  if (local1 !== 0) {
    if (local1 !== 1) {
      if (local1 !== 2) {
        local3 = 0x1f2;
      } else {
        local3 = 0x1f1;
      }
    } else {
      local3 = 0x1f0;
    }
  } else {
    local3 = 0x1ef;
  }
  yield* game.notice(2, 0x15, 0xa, 3, 0x800, local3, 0xb4);
  yield* script(0x04b);
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
  yield* game.removeObject(local0);
  return null;
}

// Script 165: 2 arguments.
export function* script165(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(local0, local1, 5);
  } else {
    yield* game.setObjectActionAndDirection(local0, local1, 1);
  }
  for (;;) {
    if (((yield* game.wait(0x180, 0)) & 0x100) === 0) {
      yield* game.notice(4, 0x15, 0x19, 3, 0x800, 0x1f7, 0xc8);
    } else {
      yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
      yield* game.wait(1, 3);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.setObjectDirection(local0, 1);
      } else {
        yield* game.keepObjectRecordFlagBits(local0, 0);
        yield* game.setObjectDirection(local0, 5);
      }
    }
  }
}

// Script 166: 1 argument.
export function* script166(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x179, local0, 0x2a7);
  return null;
}

// Script 167: 1 argument.
export function* script167(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.appendToFightList(local0);
  loop10: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    for (;;) {
      yield* game.wait(1, 6);
      if (less(yield* game.getDistanceToPlayer(local0), 0x30)) {
        yield* game.setObjectVelocity(local0, 0, 0, 0x1e);
        yield* game.wait(1, 0x1e);
        yield* game.createObject(0x54, local0, 0xa, 0, 0x16f);
        yield* game.wait(1, 0xa);
        yield* game.createObject(0x54, local0, 0xa, 0, 0x16f);
        yield* game.wait(1, 0x14);
        yield* game.releaseObjectGraphics(local0);
        continue loop10;
      }
    }
  }
}

// Script 168: 1 argument.
export function* script168(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block145: {
    local0 = arg0 & 0xff;
    local2 = 1;
    if ((yield* script(0x07e, 3)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectRecordCount(local0, word((yield* game.randomBelow(3)) + 0xa));
      yield* game.setObjectActionAndDirection(local0, 0, (yield* game.randomByte()) & 7);
      yield* game.wait(1, word(0x5a + ((yield* game.randomByte()) & 0x1f)));
      yield* game.setSpriteMode(local0, 0);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local4 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (local2 !== 0) {
            yield* game.appendToFightList(local0);
            local2 = 0;
          }
          local1 =
            (yield* script(
              0x235,
              local0,
              signed(local4),
              1,
              0,
              4,
              0,
              word(0x5a + ((yield* game.randomByte()) & 0x1f)),
            )) & 0xff;
        } else {
          yield* game.turnObjectToObject(local0, signed(local4));
          local1 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
        }
        if (signed(local1) !== 0) {
          yield* game.addKarma(2);
          yield* game.fightListRemove(local0);
          yield* script(0x1b4, yield* script(0x068, local0));
          break block145;
        }
      }
    }
  }
  return null;
}

// Script 169: 1 argument.
export function* script169(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.notice(2, 0x15, 0x11, 3, 0x800, 0x63, 0x78);
  }
}

// Script 16A: no arguments.
export function* script16A(state) {
  yield* script(0x0c8, 0x193d, 0x3e8, 0x19d);
  return null;
}

// Script 16B: no arguments.
export function* script16B(state) {
  yield* script(0x10e, 0x14f);
  return null;
}

// Script 16C: 1 argument.
export function* script16C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 0, 0xa, 2, 5);
  return null;
}

// Script 16D: no arguments.
export function* script16D(state) {
  yield* game.changeScene(2, 0, 0x8b);
  return null;
}

// Script 16E: 1 argument.
export function* script16E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x258);
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 6, 7);
  yield* game.setObjectVelocity(local0, 0xfffc, 4, 0);
  yield* game.wait(1, 0x3c);
  yield* game.playSoundEffect(local0, 0x3a, 0xff, 0xff);
  yield* game.wait(1, 0x32);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.wait(1, 0x3c);
  yield* game.playSoundEffect(local0, 0x5a, 0xff, 0xff);
  yield* game.wait(1, 0x78);
  yield* game.setObjectActionAndDirection(local0, 3, 6);
  yield* game.wait(8, 0);
  yield* game.setObjectActionAndDirection(local0, 7, 7);
  yield* game.wait(1, 0x14);
  yield* game.setObjectAnimation(local0, 4);
  yield* game.wait(1, 0x3c);
  yield* game.playSoundEffect(local0, 0x36, 0xff, 0xff);
  const t1 = word((yield* game.getObjectCoarseHeight(local0)) + 5);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 0x14);
  yield* game.createObject(0xda, t3, t2, t1, 0x3a5);
  yield* game.wait(1, 0x3c);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x3c);
  yield* game.setObjectActionAndDirection(local0, 2, 0);
  yield* game.setObjectVelocity(local0, 0, 4, 0);
  yield* game.wait(1, 0x12c);
  yield* game.removeObject(local0);
  return null;
}

// Script 16F: 1 argument.
export function* script16F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 5);
  const t1 = shiftLeft(
    word((yield* game.getObjectCoarseHeight(local1)) + (yield* game.getObjectCoarseY(local0))),
    2,
  );
  const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
  yield* game.setObjectPosition(local0, t3, t2, t1);
  yield* game.wait(1, 2);
  const t4 = yield* game.chooseEnemyTarget(local0);
  local2 = t4 & 0xff;
  if (t4 !== 0xffff) {
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local2)));
    if (less(yield* game.getDistanceBetweenObjects(local0, signed(local2)), 0x14)) {
      yield* game.shootAtObject(local0, signed(local2), 2, 4, 5, 3);
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 170: 1 argument.
export function* script170(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2d5, local0, 1);
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
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x78, 0x79, 0);
  return null;
}

// Script 173: 1 argument.
export function* script173(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x803, 0x2d04);
  return null;
}

// Script 174: 6 arguments.
export function* script174(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block177: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    local5 = arg5 & 0xff;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectActionAndDirection(local0, 6, 7);
      yield* game.setObjectRecordCount(local0, local3);
      yield* game.wait(1, 0x3c);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local7 = t1 & 0xff;
        if (
          (truth(t1 !== 0xffff) &
            truth(
              less(
                yield* game.getObjectCoarseX(signed(local7)),
                yield* game.getObjectCoarseX(local0),
              ),
            )) !==
          0
        ) {
          yield* game.setObjectAnimation(local0, 0);
          yield* game.shootAtObject(local0, signed(local7), local2, 0, local4, signed(local5));
          yield* game.turnObjectToObject(local0, signed(local7));
          if (less(yield* game.getObjectDirection(local0), 4)) {
            yield* game.setObjectDirection(local0, 6);
          }
          yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
          if (local1 !== 0) {
            yield* game.appendToFightList(local0);
            local1 = 0;
          }
        }
        const t2 = truth(
          ((yield* game.wait(0x801, word(0x64 + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !==
            0,
        );
        local6 = t2 & 0xff;
        if (t2 !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(local0);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          yield* game.setObjectDirection(local0, 7);
          yield* game.setObjectAnimation(local0, 6);
          yield* game.clearObjectTask(local0);
          break block177;
        }
      }
    }
  }
  return null;
}

// Script 175: 1 argument.
export function* script175(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  for (;;) {
    yield* game.setObjectVelocity(local0, 0xfffe, 0xfffe, 0);
    yield* game.wait(1, 0x3c);
    yield* game.setObjectVelocity(local0, 2, 2, 0);
    yield* game.wait(1, 0x3c);
  }
}

// Script 176: 1 argument.
export function* script176(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setActorStateFlagBits(0x1d96, 8);
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x904, 0x2804);
  return null;
}

// Script 177: 1 argument.
export function* script177(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectDialog(local0, 0x49);
  yield* game.wait(2, 0);
  return null;
}

// Script 178: 1 argument.
export function* script178(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0xa04, 0x3705);
  return null;
}

// Script 179: 2 arguments.
export function* script179(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  yield* game.setObjectDirection(local0, 5);
  for (;;) {
    block108: {
      if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
        yield* game.setObjectFlagBits(local0, 0x100);
        yield* game.setObjectAnimation(local0, 0);
        for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
            yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(local0, 3);
            break block108;
          }
        }
      } else {
        yield* game.keepObjectFlagBits(local0, 0xfeff);
        yield* game.setObjectAnimation(local0, 1);
        for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
            yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(local0, 2);
            break block108;
          }
        }
      }
    }
    yield* game.wait(8, 0);
  }
}

// Script 17A: 1 argument.
export function* script17A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    yield* game.wait(0x80, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
  }
}

// Script 17B: 1 argument.
export function* script17B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x903, 0x2d04);
  return null;
}

// Script 17C: 1 argument.
export function* script17C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 0x809, 0xa0b, 0x401, 0xa04, 0x3705);
  return null;
}

// Script 17D: 1 argument.
export function* script17D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x3f0)) & 2) === 0) {
    block58: {
      if (((yield* game.getActorStateFlags(0x3f0)) & 3) === 0) {
        yield* game.setObjectActionAndDirection(local0, 2, 5);
        yield* game.setObjectFlagBits(local0, 0x100);
        for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(0x3f0)) & 1) !== 0) {
            break block58;
          }
        }
      }
    }
    yield* script(0x36c, local0, 2, 4, 0, 0x2c, 0x2e);
  }
  yield* script(0x2e7, local0);
  return null;
}

// Script 17E: 1 argument.
export function* script17E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 0x405, 0x607, 0x401, 0xb04, 0x3c07);
  return null;
}

// Script 17F: 1 argument.
export function* script17F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0;
  function* sub5() {
    yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    yield* game.notice(2, 0x15, 0x18, 3, 0x800, 0x9a, 0x78);
  }
  local0 = arg0 & 0xff;
  block241: {
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      if ((yield* game.scriptAction(0x80)) === 0x80) {
        yield* sub5();
      }
    } else {
      yield* game.setObjectRecordFlags(local0, local0);
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.setSpriteMode(local0, 0x8001);
      yield* game.setObjectFlagBits(local0, 0x60);
      local3 = 0;
      local4 = 0;
      for (;;) {
        const t1 = yield* game.wait(0x90, 0);
        local1 = t1;
        if (local1 === 0x80) {
          yield* sub5();
        }
        if (local1 === 0x10) {
          if (!less(local4, 3)) {
            local3 = 255;
          } else {
            const t2 = word((yield* game.randomBelow(8)) + 0xfffc);
            const t3 = word((yield* game.randomBelow(8)) + 0xfffc);
            yield* game.setObjectVelocity(local0, t3, t2, 0);
            yield* game.wait(1, 1);
            if (
              (truth(notEqualSignedLeft(yield* game.getObjectVelocityX(local0), 0)) &
                truth(notEqualSignedLeft(yield* game.getObjectVelocityY(local0), 0))) ===
              0
            ) {
              yield* game.playSoundEffect(local0, 6, 0xc0, 3);
              yield* game.wait(1, 6);
              yield* game.playSoundEffect(local0, 6, 0x80, 3);
              yield* game.wait(1, 6);
              yield* game.playSoundEffect(local0, 6, 0x40, 3);
              yield* game.wait(1, 6);
              yield* game.clearObjectVelocity(local0);
              local4 = word(local4 + 1) & 0xff;
            } else {
              local3 = 255;
            }
          }
        }
        if (signed(local3) !== 0) {
          yield* game.setActorStateHolder(0x7cb, 0x1538);
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          break block241;
        }
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}
