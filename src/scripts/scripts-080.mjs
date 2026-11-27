// Scripts 080 to 09F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 080: 1 argument.
export function* script080(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (less(state.word('FIGHT_UNREAD'), 0xc)) {
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') + 1));
    yield* game.setObjectActionAndDirection(local0, 0, yield* game.getObjectArmour(local0));
    yield* game.wait(8, 0);
    state.setWord('FIGHT_UNREAD', 0, word(state.word('FIGHT_UNREAD') - 1));
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 081: no arguments.
export function* script081(state) {
  yield* game.markTopic(7);
  return null;
}

// Script 082: 1 argument.
export function* script082(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x02b, local0, 0);
  return null;
}

// Script 083: 7 arguments.
export function* script083(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    local15 = 0;
  block332: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    local5 = arg5 & 0xff;
    local6 = arg6 & 0xff;
    if ((yield* script(0x07e, local2)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectRecordCount(local0, local3);
      yield* game.setObjectActionAndDirection(local0, 7, 5);
      if (signed(local1) === 0) {
        local13 = yield* game.getObjectCoarseX(local0);
        local15 = yield* game.getObjectCoarseY(local0);
      } else {
        local13 = yield* game.getObjectCoarseY(local0);
        local15 = yield* game.getObjectCoarseX(local0);
      }
      local7 = 0;
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local8 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (signed(local1) === 0) {
            local9 = yield* game.getObjectCoarseX(signed(local8));
            local11 = yield* game.getObjectCoarseY(signed(local8));
          } else {
            local9 = yield* game.getObjectCoarseY(signed(local8));
            local11 = yield* game.getObjectCoarseX(signed(local8));
          }
          if (local13 > local9) {
            yield* game.setObjectAnimation(local0, 4);
            yield* game.shootAtObject(local0, signed(local8), local5, 0, local6, 0);
            if (!less(local15, local11)) {
              yield* game.setObjectDirection(local0, 0);
            } else {
              yield* game.setObjectDirection(local0, 1);
            }
            yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
            if (local2 !== 0) {
              yield* game.appendToFightList(local0);
              local2 = 0;
            }
            const t2 = truth(
              ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0xf) + 0x14))) &
                0x800) !==
                0,
            );
            local7 = t2 & 0xff;
            if (t2 === 0) {
              yield* game.setObjectActionAndDirection(local0, 7, 5);
              local7 =
                truth(
                  ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0x1f) + 0x3c))) &
                    0x800) !==
                    0,
                ) & 0xff;
            }
          }
        }
        if (signed(local7) !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(local0);
          yield* game.setSpriteMode(local0, 0x8001);
          yield* game.keepObjectFlagBits(local0, 0xdfff);
          yield* game.setObjectActionAndDirection(local0, 6, 5);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          if (local4 <= 2) {
            yield* script(0x1b4, local0);
          } else {
            yield* script(0x1ba, local0);
          }
          if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
            yield* game.setObjectRecordFlags(
              local0,
              word((yield* game.getObjectRecordFlags(local0)) - 1),
            );
          } else {
            yield* game.resetObjectRecordProperty(local0);
          }
          break block332;
        }
        local7 = truth(((yield* game.wait(0x801, 0xc)) & 0x800) !== 0) & 0xff;
      }
    }
  }
  return null;
}

// Script 084: 1 argument.
export function* script084(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xba6)) & 0x80) === 0) {
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      yield* game.placeObjectOnWaypoint(local0, 2);
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* script(0x06e, local0, 0xba6, 0, 0x71, 0x2000);
      yield* game.notice(2, 2, 0x16, 3, 0x400, 0xa3, 0x78);
      yield* game.removeObject(local0);
      yield* game.addSceneObject(0xe, 0, 0, 0, 0, 0xba6, 0x1e);
      return null;
    }
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    yield* game.setObjectAnimation(local0, 0);
    for (;;) {
      yield* game.setObjectDirection(local0, 2);
      yield* game.wait(2, 0);
      yield* game.turnObjectToPlayer(local0);
      yield* game.notice(2, 4, 0x14, 4, 0x400, 0xa2, 0xf0);
      yield* game.wait(1, 0x78);
    }
  } else {
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 085: 1 argument.
export function* script085(state, arg0) {
  let local0 = 0,
    local2 = 0;
  local0 = arg0;
  if (((yield* game.getActorKindFlags(local0)) & 0x8000) === 0) {
    local2 = 0xa;
  } else {
    if (((yield* game.getActorKindFlags(local0)) & 0x4000) === 0) {
      local2 = 9;
    } else {
      local2 = 8;
    }
  }
  yield* game.notice(2, 0x15, 0x13, 3, 0x800, local2, 0x78);
  return null;
}

// Script 086: no arguments.
export function* script086(state) {
  yield* script(0x0c8, 0x46, 0x32, 0x1a8);
  return null;
}

// Script 087: 1 argument.
export function* script087(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  for (;;) {
    yield* game.wait(0x80, 0);
    yield* game.notice(2, 0x13, 0x14, 5, 0x800, 0xa7, 0xf0);
  }
}

// Script 088: 1 argument.
export function* script088(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0x19);
    yield* game.wait(1, 0x1e);
    yield* game.appendToFightList(local0);
    if ((yield* script(0x251, local0, 0x100, 0x46, 0x400, 0x404, 0x602, 0xc)) === 0) {
      yield* game.addKarma(0x16);
      yield* game.fightListRemove(local0);
      yield* script(0x35d, local0);
      yield* game.setActorStateFlagBits(0x1b66, 1);
      yield* game.wait(1, 0x64);
    } else {
      yield* game.setActorStateFlagBits(0x1b66, 2);
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 089: 1 argument.
export function* script089(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    yield* script(0x245, local0);
  }
  return null;
}

// Script 08A: 1 argument.
export function* script08A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 08B: 1 argument.
export function* script08B(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  yield* game.removeObject(yield* game.getPlayerObjectCopy());
  yield* game.setScriptVariable(0x2c, word((yield* game.getScriptVariable(0x2c)) + 1));
  yield* game.changeRoom(local0);
  for (;;) {
    yield* game.wait(1, 1);
  }
}

// Script 08C: 1 argument.
export function* script08C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectToWaypoint(local0, 1);
  yield* game.wait(4, 0);
  yield* game.stopMotion(local0);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x78);
  yield* game.setObjectActionAndDirection(local0, 8, 0);
  yield* game.wait(8, 0);
  yield* game.releaseObjectGraphics(local0);
  return null;
}

// Script 08D: 1 argument.
export function* script08D(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0;
  function* sub5(in0) {
    local5 = in0;
    for (;;) {
      local7 = shiftRight(local5, 2);
      local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
      local5 = word(local5 - 1);
      if (less(yield* game.getDistanceBetweenObjects(local0, signed(local4)), 0x14)) {
        yield* game.shootAtObject(local0, signed(local4), 5, 4, 7, 2);
        local5 = 0;
        if (((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) {
          local1 = 255;
        }
      }
      if ((truth(local5 === 0) | signed(local1)) !== 0) {
        if (signed(local1) !== 0) {
          local3 = word(local3 - 1) & 0xff;
        }
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.setSpriteMode(local0, 0);
  yield* game.setObjectFlagBits(local0, 0x60);
  yield* game.setObjectAnimation(local0, 7);
  yield* game.turnObjectToPlayer(local0);
  yield* game.clearObjectVelocity(local0);
  yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.wait(8, 0);
  yield* game.setObjectFlagBits(local0, 0x2000);
  local3 = 5;
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  yield* game.setObjectVelocity(local0, 0, 2, 0);
  yield* game.wait(0x801, 0xa);
  local2 = 255;
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local4 = t1 & 0xff;
    if (t1 !== 0xffff) {
      if (signed(local2) !== 0) {
        yield* game.appendToFightList(local0);
        local2 = 0;
      }
      yield* game.moveObjectStraightToObject(local0, signed(local4));
      yield* sub5(word(((yield* game.randomByte()) & 0x3f) + 0x50));
    }
    if (signed(local4) === 0xffff || local3 === 0) {
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      if (local3 !== 0) {
        yield* game.setObjectActionAndDirection(
          local0,
          8,
          (yield* game.getObjectDirection(local0)) & 0xfffe,
        );
        yield* game.wait(8, 0);
      } else {
        yield* script(0x276, local0);
        yield* game.addKarma(3);
      }
      yield* game.fightListRemove(local0);
      yield* game.removeObject(local0);
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
      return null;
    }
  }
}

// Script 08E: 6 arguments.
export function* script08E(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 0, local1);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.notice(local2, 2, local3, local4, 0x400, local5, 0x78);
  }
}

// Script 08F: 1 argument.
export function* script08F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    if (((yield* game.randomByte()) & 3) === 0) {
      yield* game.keepObjectFlagBits(local0, 0xdfff);
      yield* game.setObjectActionAndDirection(local0, 0, 2);
      yield* game.setObjectRecordFlags(local0, 1);
      yield* game.wait(1, 0x7d);
      yield* game.setObjectActionAndDirection(local0, 2, 6);
      yield* game.setObjectVelocity(local0, 0xfffb, 0, 0);
      yield* game.wait(1, 0x78);
    }
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.resetObjectRecordProperty(local0);
  return null;
}

// Script 090: 1 argument.
export function* script090(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseX(local0);
  local1 = t1 & 0xff;
  yield* game.setSpriteMode(local0, yield* game.getSpriteMode(t1));
  const t2 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseY(local0), 2);
  const t4 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
  yield* game.setObjectPosition(local0, t4, t3, t2);
  yield* game.setObjectActionAndDirection(local0, 0, yield* game.getObjectDirection(local1));
  if (((yield* game.getObjectFlags(local1)) & 0x4000) === 0) {
    yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
  } else {
    yield* game.playSoundEffect(local0, 0x12, 0xff, 3);
  }
  yield* game.wait(8, 0);
  yield* game.updateObjectDepthMode(local0);
  yield* game.wait(1, 1);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 091: 1 argument.
export function* script091(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectToWaypoint(local0, 2);
  yield* game.wait(4, 0);
  yield* game.stopMotion(local0);
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.wait(8, 0);
  yield* game.wait(1, 0x14);
  yield* game.setObjectActionAndDirection(local0, 0, 1);
  yield* game.wait(1, 0x4b);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectToWaypoint(local0, 0);
  yield* game.wait(4, 0);
  yield* game.stopMotion(local0);
  yield* game.setObjectActionAndDirection(local0, 8, 0);
  yield* game.wait(8, 0);
  yield* game.setObjectActionAndDirection(local0, 7, 0);
  yield* game.setObjectVelocity(local0, 0, 2, 0);
  yield* game.wait(1, 0x168);
  yield* game.setObjectVelocity(local0, 0, 0, 0);
  return null;
}

// Script 092: 1 argument.
export function* script092(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getScriptVariable(0x2c)) !== 0) {
    yield* game.keepActorStateFlagBits(0x7b6, 0);
    yield* game.keepActorStateFlagBits(0x7af, 0);
  }
  block81: {
    if (((yield* game.getActorStateFlags(0x7b6)) & 0x80) === 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 4);
      yield* game.setObjectDialog(local0, 0x2a);
      for (;;) {
        yield* game.wait(3, 6);
        if ((yield* game.getDistanceToPlayer(local0)) <= 0x28) {
          yield* game.setActorStateFlagBits(0x7af, 1);
          yield* game.wait(1, 0x3c);
          break block81;
        }
      }
    } else {
      yield* game.resetObjectRecordProperty(local0);
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 093: 1 argument, returns a word.
export function* script093(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0xa000);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 7);
  yield* game.turnObjectToPlayer(local0);
  yield* game.playSoundEffect(local0, 0x16, 0xff, 3);
  if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
    if (
      ((yield* game.wait(0x801, word(0x3c + ((yield* game.randomByte()) & 0x1f)))) & 0x800) ===
      0
    ) {
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.moveObjectStraightToPlayer(local0);
      local1 = 120;
      local2 = 0;
      for (;;) {
        if (less(yield* game.getDistanceToPlayer(local0), 0xa)) {
          if (local2 !== 0) {
            local2 = word(local2 - 1) & 0xff;
          } else {
            yield* game.shootAtObject(local0, yield* game.getPlayerObjectCopy(), 4, 4, 4, 0);
            local2 = 20;
          }
        }
        if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
          const t1 = word(local1 - 1);
          local1 = word(local1 - 1) & 0xff;
          if (t1 === 0) {
            yield* game.stopMotion(local0);
            yield* game.clearObjectVelocity(local0);
            yield* game.setObjectAnimation(local0, 8);
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              yield* game.releaseObjectGraphics(local0);
              return 0;
            }
            return 0xffff;
          }
        } else {
          return 0xffff;
        }
      }
    } else {
      return 0xffff;
    }
  } else {
    return 0xffff;
  }
}

// Script 094: 1 argument.
export function* script094(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x5a);
  yield* game.wait(2, 0);
  return null;
}

// Script 095: no arguments.
export function* script095(state) {
  yield* game.setActorStateFlagBits(0x1905, 1);
  return null;
}

// Script 096: 1 argument.
export function* script096(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block115: {
    local0 = arg0 & 0xff;
    if ((yield* game.getCurrentRoomHeader()) !== (yield* game.getRoomHeader(0x185))) {
      yield* script(0x1ad, local0, 4, 0x48, 0x7b, 0x600);
    } else {
      yield* game.removeGroupMember(local0);
      yield* game.wait(1, 0xa);
      yield* game.setObjectActionAndDirection(local0, 2, 0);
      yield* game.notice(2, 3, 0x1c, 4, 0x400, 0x1a6, 0xb4);
      yield* game.moveObjectStraightToWaypoint(local0, 5);
      local1 = truth(((yield* game.wait(0x804, 0)) & 0x800) !== 0) & 0xff;
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      yield* game.appendToFightList(local0);
      for (;;) {
        const t1 = yield* script(0x221, local0);
        local1 = t1 & 0xff;
        if (t1 !== 0) {
          yield* game.addKarma(6);
          yield* game.fightListRemove(local0);
          yield* script(0x1bc, yield* script(0x068, local0));
          break block115;
        }
      }
    }
  }
  return null;
}

// Script 097: 1 argument.
export function* script097(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    local15 = 0,
    local17 = 0,
    local19 = 0,
    local20 = 0,
    local21 = 0,
    local22 = 0;
  function sub5(in0, in1, in2, in3, in4, in5) {
    local15 = in0;
    local17 = in1;
    local19 = in2 & 0xff;
    local20 = in3 & 0xff;
    local21 = in4 & 0xff;
    local22 = in5 & 0xff;
    local7 = local15;
    local13 = local17;
    local3 = local19 & 0xff;
    local4 = local20 & 0xff;
    local5 = local21 & 0xff;
    local6 = local22 & 0xff;
  }
  local0 = arg0 & 0xff;
  yield* game.releaseGlove();
  yield* script(0x35c);
  local9 = 0x2b2;
  local11 = 0x2ee;
  local0 = (yield* game.createObject(0xb0, local9, local11, 0, 0xae)) & 0xff;
  yield* game.setObjectVelocity(local0, 0, 0xfffc, 0);
  yield* game.notice(2, 2, 0x13, 3, 0x400, 0x143, 0xfde8);
  yield* game.wait(1, 0xb4);
  yield* game.clearObjectVelocity(local0);
  local11 = 0x23a;
  sub5(0xf, 0x148, 7, 0xc, 0, 8);
  local1 = 0;
  for (;;) {
    local2 =
      (yield* game.createObject(local7, word(local9 - 5), word(local11 - 5), 0, 0xae)) & 0xff;
    yield* game.keepObjectFlagBits(local2, 0xffdf);
    yield* game.wait(1, 0x14);
    yield* game.notice(signed(local5), signed(local6), local3, 3, 0, local13, 0xf0);
    yield* game.wait(1, 0x78);
    yield* game.setObjectAnimation(local2, 4);
    yield* game.playSoundEffect(local2, local4, 0xff, 3);
    yield* game.wait(1, 0xf);
    yield* game.playSoundEffect(local2, local4, 0xff, 3);
    yield* game.setObjectAnimation(local2, 4);
    yield* game.wait(1, 0x78);
    local9 = word(local9 - 8);
    local11 = word(local11 + 8);
    if (local7 !== 0xa0) {
      yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
      yield* game.removeObject(local2);
      yield* game.wait(1, 0x10);
      yield* game.setObjectVelocity(local0, 0, 2, 0);
      yield* game.wait(1, 0x10);
      yield* game.clearObjectVelocity(local0);
    }
    if (local7 !== 0xf) {
      if (local7 !== 0xe) {
        if (local7 !== 0x63) {
          if (local7 !== 0x59) {
            if (local7 !== 0x5b) {
              if (local7 !== 0) {
                if (local7 !== 5) {
                  if (local7 !== 0xac) {
                    if (local7 !== 0x9d) {
                      if (local7 !== 0xc) {
                        if (local7 === 0xa0) {
                          local1 = 255;
                        }
                      } else {
                        sub5(0xa0, 0x144, 5, 0x32, 0x17, 0x12);
                      }
                    } else {
                      sub5(0xc, 0x14e, 9, 0xe, 0x13, 8);
                    }
                  } else {
                    sub5(0x9d, 0x14f, 8, 0xc, 0x11, 0x12);
                  }
                } else {
                  sub5(0xac, 0x14b, 7, 0x36, 0x10, 8);
                }
              } else {
                sub5(5, 0x14c, 7, 0x40, 0xe, 0x12);
              }
            } else {
              sub5(0, 0x14a, 7, 0xe, 0xc, 8);
            }
          } else {
            sub5(0xf, 0x147, 0xa, 0xc, 6, 8);
          }
        } else {
          sub5(0x59, 0x146, 0xe, 0x32, 3, 0x12);
        }
      } else {
        sub5(0x63, 0x14d, 7, 0xc, 4, 8);
      }
    } else {
      if (local9 !== 0x2aa) {
        sub5(0x5b, 0x145, 7, 0x42, 0xb, 0x12);
      } else {
        sub5(0xe, 0x149, 0xa, 0xc, 0, 0x12);
      }
    }
    if (signed(local1) !== 0) {
      yield* script(0x08b, 0xed);
      return null;
    }
  }
}

// Script 098: no arguments.
export function* script098(state) {
  const t1 = yield* script(0x03f, 0x5dc, 0x4b0, 0x3e8);
  const t2 = yield* script(0x0b2, 0x161, 0x162, 0x163);
  yield* script(0x162, 0x79a, t2, t1, 0x160, 0x15f);
  return null;
}

// Script 099: 1 argument.
export function* script099(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.playSoundEffect(local0, 0xc, 0x19, 0xff);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 09A: 1 argument.
export function* script09A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (
    (truth(((yield* game.getActorStateFlags(0xa4f)) & 0x20) !== 0) |
      truth(((yield* game.getActorStateFlags(0xa4f)) & 0x80) !== 0)) ===
    0
  ) {
    yield* script(0x06e, local0, 0xa4f, 0, 0x7c, 0);
    yield* game.notice(8, 3, 0xd, 3, 0x400, 0x18d, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0x9d, 0, 0, 0, 0, 0xa4f, 0x28);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 09B: 1 argument.
export function* script09B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2bc, local0, 0x20, 0x24, 1, 0x40, 0x175a);
  return null;
}

// Script 09C: 1 argument.
export function* script09C(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.placeObjectOnWaypoint(local0, local1);
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  return null;
}

// Script 09D: 1 argument.
export function* script09D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    yield* game.setObjectRecordCount(local0, 0xf);
    yield* game.wait(1, 0x8c);
    yield* game.notice(2, 4, 0x11, 4, 0x400, 0x24b, 0x78);
    yield* game.wait(1, 0x1e);
    yield* game.appendToFightList(local0);
    if ((yield* script(0x2ec, 0x800 | local0, 0x706, 0, 0x100, 0x201, 2, 0)) === 0) {
      yield* game.addKarma(8);
      yield* game.fightListRemove(local0);
      yield* script(0x35d, local0);
      yield* game.setActorStateFlagBits(0x1b66, 1);
      yield* game.wait(1, 0x1e);
      yield* game.notice(8, 4, 0xc, 3, 0x400, 0x24c, 0xdc);
      yield* game.wait(1, 0xdc);
      yield* game.wait(1, 0x1e);
    } else {
      yield* game.setActorStateFlagBits(0x1b66, 2);
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 09E: 1 argument.
export function* script09E(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      yield* game.setObjectFlagBits(local0, 0x140);
      yield* game.setObjectActionAndDirection(local0, 1, 6);
      yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
      yield* game.wait(1, 0x3c);
      yield* game.notice(2, 2, 0x1c, 4, 0x400, 0xab, 0xf0);
      yield* game.wait(1, 0x28);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.clearObjectVelocity(local0);
      for (;;) {
        if (((yield* game.wait(3, 0x14)) & 2) === 0) {
          yield* game.turnObjectToPlayer(local0);
        } else {
          yield* game.talk(local0, 0x19);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          yield* game.setObjectActionAndDirection(local0, 1, 2);
          yield* game.setObjectVelocity(local0, 2, 0, 0);
          yield* game.wait(1, 0xa);
          yield* game.changeRoom(0x1dc);
          return null;
        }
      }
    } else {
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.setObjectRecordFlagBits(local0, 1);
      yield* game.releaseGlove();
      local1 = (yield* game.createObject(0xb, 0, 0, 0, 0x9c)) & 0xff;
      yield* game.setObjectAnimation(local0, 1);
      yield* game.setObjectDirection(local0, 2);
      yield* game.setObjectVelocity(local0, 2, 0, 0);
      yield* game.wait(1, 0x28);
      yield* game.clearObjectVelocity(local0);
      yield* game.notice(3, 2, 0x1a, 4, 0x400, 0xae, 0xf0);
      yield* script(0x0ae, local0);
      yield* game.wait(1, 0xa0);
      yield* game.createObject(0x95, 0, 0, 0, 0x1ca);
      yield* game.wait(1, 1);
      yield* game.removeObject(local1);
      yield* game.wait(1, 0x50);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.moveObjectToWaypoint(local0, 1);
      yield* game.wait(4, 0);
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.setObjectDirection(local0, 6);
      yield* game.wait(1, 0x64);
      yield* game.setObjectAnimation(local0, 3);
      yield* game.setObjectDirection(local0, 0);
      yield* game.wait(1, 0x64);
      yield* game.setObjectAnimation(local0, 5);
      yield* game.setObjectDirection(local0, 0);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.setObjectDirection(local0, 6);
      yield* game.notice(2, 5, 7, 3, 0x400, 0xaf, 0xf0);
      yield* game.startTimer();
      yield* game.wait(1, 0xc8);
      yield* game.notice(2, 0x14, 0x15, 3, 0x800, 0xb0, 0xf0);
      yield* game.wait(1, 0xc8);
      yield* game.notice(4, 0x1b, 0x17, 3, 0x800, 0xb1, 0xf0);
      yield* game.wait(1, 0x190);
      yield* game.notice(2, 8, 0x18, 3, 0x400, 0xb2, 0x78);
      yield* game.addTopic(7);
      yield* game.wait(1, 0x64);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.moveObjectToWaypoint(local0, 2);
      yield* game.wait(4, 0x3c);
      yield* game.clearObjectVelocity(local0);
      yield* game.stopMotion(local0);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.setObjectDirection(local0, 4);
      yield* game.markTopic(0xa);
      yield* game.wait(1, 0x3c);
      yield* game.changeRoom(0xec);
      return null;
    }
  } else {
    if ((yield* game.getScriptVariable(0x16)) !== 1) {
      yield* game.setObjectDialog(local0, 0x1a);
    } else {
      yield* game.setObjectDialog(local0, 0x1b);
    }
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.setObjectFlagBits(local0, 0xa000);
    for (;;) {
      yield* game.turnObjectToPlayer(local0);
      if (((yield* game.wait(0x803, 0x28)) & 0x800) !== 0) {
        yield* script(0x35d, local0);
        return null;
      }
    }
  }
}

// Script 09F: 1 argument.
export function* script09F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(local0)) === 0) {
    yield* game.setObjectRecordFlags(local0, 0xa);
  }
  yield* script(0x083, local0, 0xffff, 2, 0x14, 3, 1, 5);
  return null;
}
