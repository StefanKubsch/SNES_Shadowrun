// Scripts 2E0 to 2FF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 2E0: 1 argument.
export function* script2E0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xb9f)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(local0, 2, 5);
    for (;;) {
      yield* game.wait(0x180, 0);
      yield* game.notice(2, 2, 0x13, 3, 0x400, 0xa1, 0xf0);
    }
  } else {
    yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
    yield* script(0x206, local0);
    return null;
  }
}

// Script 2E1: 1 argument.
export function* script2E1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(local0)) === 0) {
    yield* game.setObjectRecordFlags(local0, 0xa);
  }
  yield* script(0x3a0, local0, 4, 1, 0xf, 5, 0);
  return null;
}

// Script 2E2: 1 argument.
export function* script2E2(state, arg0) {
  let local0 = 0;
  block123: {
    local0 = arg0 & 0xff;
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
      if (((yield* game.isTopicKnown(0x23)) | (yield* game.isTopicKnown(0x1c))) !== 0) {
        block98: {
          yield* game.setObjectActionAndDirection(local0, 0, 0);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
            for (;;) {
              yield* game.wait(1, 6);
              if (less(yield* game.getDistanceToPlayer(local0), 0x1e)) {
                yield* game.wait(2, 0);
                yield* script(0x307, local0, 0x2e);
                if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
                  break block98;
                }
              }
            }
          } else {
            yield* game.wait(2, 0);
          }
        }
        for (;;) {
          yield* script(0x307, local0, 0x2f);
          if (((yield* game.getObjectRecordFlags(local0)) & 2) !== 0) {
            break block123;
          }
          yield* game.wait(2, 0);
        }
      }
    } else {
      yield* game.resetObjectRecordProperty(local0);
    }
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 2E3: 1 argument.
export function* script2E3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2E4: 1 argument.
export function* script2E4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x16);
  yield* game.setObjectActionAndDirection(local0, 7, 3);
  for (;;) {
    yield* game.setObjectVelocity(local0, 2, 0, 0);
    yield* game.wait(3, 0x1e);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(3, 0x64);
    yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
    yield* game.wait(3, 0x1e);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(3, 0x64);
  }
}

// Script 2E5: 1 argument.
export function* script2E5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 1);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x34);
  for (;;) {
    yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
    yield* game.wait(3, 0x64);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0xff) + 0xa));
    yield* game.setObjectVelocity(local0, 2, 0, 0);
    yield* game.wait(3, 0x64);
    yield* game.clearObjectVelocity(local0);
    yield* game.wait(3, word(((yield* game.randomByte()) & 0xff) + 0xa));
  }
}

// Script 2E6: 1 argument.
export function* script2E6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectFlagBits(local0, 0x20);
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  yield* game.setObjectVelocity(local0, 0xfffc, 0, 8);
  yield* game.wait(1, 0xa);
  yield* game.removeObject(local0);
  return null;
}

// Script 2E7: 1 argument.
export function* script2E7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  for (;;) {
    yield* script(0x074, local0, 0, 6, 2, 0x2e);
    yield* script(0x2a3, local0, 2, 4, 0, 0x2c, 0x2e);
  }
}

// Script 2E8: 5 arguments.
export function* script2E8(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2;
  local4 = arg3 & 0xff;
  local5 = arg4 & 0xff;
  if (
    (truth((yield* game.getScriptVariable(0xc)) === 0x8b2) &
      truth((yield* game.getScriptVariable(0x16)) === 0)) ===
    0
  ) {
    yield* game.enterMatrix(local1, local2, local4, local5, yield* game.getScriptVariable(0xc));
  } else {
    state.setWord('COLOUR_REQUEST', 0, 1);
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = yield* game.getObjectCoarseY(local0);
    const t3 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0xe6, t3, t2, t1, 0x99);
    yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
    yield* game.wait(1, 0xa);
    state.setWord('COLOUR_REQUEST', 0, 2);
    yield* game.enterMatrix(2, local2, 0, 0, 0x8b2);
  }
  return null;
}

// Script 2E9: no arguments.
export function* script2E9(state) {
  yield* script(0x0c8, 0x1c0e, 0x64, 0x1a0);
  return null;
}

// Script 2EA: 1 argument.
export function* script2EA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 0x100, 0, 0x804, 0xc06));
  return null;
}

// Script 2EB: 1 argument.
export function* script2EB(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x960);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.setObjectDialog(local0, 0x46);
  local1 = 0;
  for (;;) {
    yield* game.placeObjectOnWaypoint(local0, 4);
    yield* game.moveObjectToWaypoint(local0, 5);
    if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
      yield* game.moveObjectToWaypoint(local0, 6);
      if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
        yield* game.moveObjectToWaypoint(local0, 7);
        if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
          yield* game.stopMotion(local0);
          yield* game.wait(1, 0x4b0);
        } else {
          local1 = 255;
        }
      } else {
        local1 = 255;
      }
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.stopMotion(local0);
      yield* script(0x35d, local0);
      return null;
    }
  }
}

// Script 2EC: 7 arguments, returns a word.
export function* script2EC(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0,
    local14 = 0,
    local15 = 0,
    local16 = 0,
    local17 = 0;
  function* sub17() {
    if (!less(yield* game.getObjectRecordCount(local15), 0xf)) {
      yield* game.setObjectAnimation(local15, 2);
      if (local14 !== 1) {
        if (local14 !== 3) {
          const t1 = yield* game.chooseEnemyTarget(local15);
          local16 = t1 & 0xff;
          if (t1 === 0xffff) {
            yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local0, 8));
          } else {
            yield* game.moveObjectStraightToPlayer(local15);
          }
        } else {
          yield* game.moveObjectStraightToWaypoint(local15, local2 & 0xff);
        }
      } else {
        yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local2, 8));
      }
      local14 = word(local14 + 1) & 3 & 0xff;
    } else {
      if (local14 !== 0xff) {
        yield* game.setObjectAnimation(local15, 2);
        local14 = 255;
        if (local4 !== 0) {
          yield* game.notice(2, 5, 0x18, 3, 0x400, local4, 0xa0);
        }
        yield* game.moveObjectStraightToWaypoint(local15, shiftRight(local0, 8));
      }
    }
    if ((yield* script(0x241, local15, 0x64, 0x3c, 0x37, 0xf, local14)) === 0) {
      local17 = 0;
      for (;;) {
        local16 = (yield* game.chooseEnemyTarget(local15)) & 0xff;
        if (!(less(yield* game.getDistanceToPlayer(local15), 0x64) && signed(local16) !== 0xffff)) {
          if (((yield* game.wait(0x801, 6)) & 0x800) !== 0) {
            return 0xffff;
          }
        } else {
          yield* game.setObjectAnimation(local15, 4);
          yield* game.turnObjectToPlayer(local15);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            yield* game.playSoundEffect(local15, 0xe, 0xff, 0xff);
            yield* game.shootAtObject(
              local15,
              yield* game.getPlayerObjectCopy(),
              shiftRight(local6, 8),
              local6 & 0xff,
              shiftRight(local8, 8),
              local8 & 0xff,
            );
            if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) <= 5) {
              return 0xffff;
            }
          } else {
            return 0xffff;
          }
        }
        if (
          (truth(local17 === local10) |
            truth(less(yield* game.getObjectRecordCount(local15), 0xf) && local14 !== 0xff)) !==
          0
        ) {
          if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
            return 0;
          }
          return 0xffff;
        }
        local17 = word(local17 + 1) & 0xff;
      }
    } else {
      return 0xffff;
    }
  }
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  local6 = arg3;
  local8 = arg4;
  local10 = arg5;
  local12 = arg6;
  local15 = local0 & 0xff & 0xff;
  yield* game.setObjectDirection(local15, 0);
  yield* game.setObjectAnimation(local15, 2);
  local14 = 0;
  for (;;) {
    if ((yield* sub17()) !== 0) {
      if ((yield* game.getObjectRecordCount(local15)) !== 0) {
        return 0xffff;
      }
      return 0;
    }
  }
}

// Script 2ED: 1 argument.
export function* script2ED(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x1e);
  yield* game.notice(2, 2, 0x14, 3, 0x400, 0xf2, 0xf0);
  yield* game.wait(1, 0x5a);
  yield* script(0x3a4, local0, 0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0x64);
  yield* game.notice(4, 4, 0x1a, 3, 0x400, 0xf3, 0xf0);
  yield* script(0x3a4, local0, 1);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.wait(1, 0xdc);
  yield* script(0x08b, 0xb0);
  return null;
}

// Script 2EE: 1 argument.
export function* script2EE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0d2, local0);
  return null;
}

// Script 2EF: 1 argument.
export function* script2EF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2F0: 1 argument.
export function* script2F0(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* game.setObjectActionAndDirection(local0, 0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        yield* script(0x3a2);
      }
    } else {
      yield* game.notice(2, 0x14, 0x13, 3, 0x800, 0x203, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 2F1: 1 argument.
export function* script2F1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x23, 0x64, 0x105a, 0xffff);
  return null;
}

// Script 2F2: 5 arguments.
export function* script2F2(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local9 = 0;
  function* sub13(in0) {
    local6 = in0 & 0xff;
    for (;;) {
      const t1 = yield* game.chooseEnemyTarget(local0);
      local9 = t1 & 0xff;
      if (t1 !== 0xffff) {
        yield* game.setObjectAnimation(local0, 1);
        yield* game.moveObjectStraightToWaypoint(local0, local6);
        const t2 = yield* game.wait(0x805, 0xa);
        local7 = t2;
        local5 = truth((local7 & 0x800) !== 0) & 0xff;
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        if (signed(local5) === 0) {
          local5 = (yield* script(0x235, local0, signed(local9), local3, local4, 4, 0, 0xa)) & 0xff;
        }
      } else {
        yield* game.setObjectActionAndDirection(local0, 0, 5);
        local5 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
      }
      if ((truth((local7 & 4) !== 0) | signed(local5)) !== 0) {
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0x1e);
  yield* game.setObjectRecordCount(local0, 0x14);
  for (;;) {
    yield* game.wait(1, 0x3c);
    if ((yield* game.chooseEnemyTarget(local0)) !== 0xffff) {
      yield* game.appendToFightList(local0);
      for (;;) {
        yield* sub13(local1);
        if (signed(local5) === 0) {
          yield* sub13(local2);
        }
        if (signed(local5) !== 0) {
          yield* game.addKarma(0xa);
          yield* game.fightListRemove(local0);
          yield* game.setObjectDirection(local0, 0);
          yield* script(0x1ba, yield* script(0x35d, local0));
          return null;
        }
      }
    }
  }
}

// Script 2F3: 1 argument.
export function* script2F3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.placeObjectOnWaypoint(local0, 1);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0x2e4);
  yield* game.setObjectActionAndDirection(local0, 0, 1);
  yield* game.wait(8, 0);
  yield* game.wait(1, 0x32);
  yield* game.removeObject(local0);
  return null;
}

// Script 2F4: 1 argument.
export function* script2F4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x500 | local0, 0x600, 0, 0x804, 0xc06));
  return null;
}

// Script 2F5: 1 argument.
export function* script2F5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2F6: 1 argument.
export function* script2F6(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 5);
  yield* game.wait(1, 0x14);
  local1 = 0x4f6;
  for (;;) {
    yield* game.wait(1, 1);
    local1 = word(local1 - 1);
    if (local1 === 0 || (state.word('PAD_HELD') & 0xf0f0) !== 0) {
      yield* game.markTopic(0x17);
      yield* game.markTopic(0x1f);
      yield* game.markTopic(0x1d);
      yield* game.markTopic(0x3b);
      yield* game.markTopic(0x13);
      yield* game.markTopic(0x3d);
      yield* game.markTopic(5);
      yield* game.raiseStoryStage(2);
      yield* game.wait(1, 1);
      yield* game.changeRoom(0x158);
      yield* game.wait(1, 1);
      return null;
    }
  }
}

// Script 2F7: 5 arguments.
export function* script2F7(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local7 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4;
  yield* game.setObjectRecordCount(local0, word(0x14 + ((yield* game.randomByte()) & 0xf)));
  yield* game.setObjectFlagBits(local0, 0x20);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 1);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.wait(1, 0x3c);
  yield* game.appendToFightList(local0);
  local6 = 0;
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local7 = t1 & 0xff;
    if (t1 !== 0xffff) {
      if (
        (truth(less(yield* game.getDistanceBetweenObjects(local0, signed(local7)), 0x28)) &
          truth(
            (yield* game.getObjectCoarseHeight(local0)) ===
              (yield* game.getObjectCoarseHeight(signed(local7))),
          )) ===
        0
      ) {
        yield* game.turnObjectToObject(local0, signed(local7));
        if (signed(local6) === 0) {
          yield* game.setObjectAnimation(local0, 5);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(local0, 7);
          local6 =
            truth(
              ((yield* game.wait(
                0x801,
                word(word(local4 + 0x14) + ((yield* game.randomByte()) & 0x1f)),
              )) &
                0x800) !==
                0,
            ) & 0xff;
        }
        if (signed(local6) === 0) {
          yield* game.turnObjectToObject(local0, signed(local7));
          yield* game.setObjectAnimation(local0, 8);
          yield* game.playSoundEffect(local0, 4, 0xff, 3);
          yield* game.createObject(0xbb, local0, signed(local7), 0, 0x34b);
          yield* game.wait(8, 0);
        }
      } else {
        block188: {
          yield* game.setObjectAnimation(local0, 2);
          yield* game.moveObjectStraightToObject(local0, signed(local7));
          local6 = truth(((yield* game.wait(0x805, local4)) & 0x800) !== 0) & 0xff;
          yield* game.stopMotion(local0);
          yield* game.clearObjectVelocity(local0);
          if (less(yield* game.getDistanceBetweenObjects(local0, signed(local7)), 0xa)) {
            for (;;) {
              yield* game.setObjectAnimation(local0, 4);
              yield* game.playSoundEffect(local0, 6, 0xff, 3);
              yield* game.shootAtObject(local0, signed(local7), local1, 4, local2, signed(local3));
              local6 = truth(((yield* game.wait(0x801, local4)) & 0x800) !== 0) & 0xff;
              if (
                (truth((yield* game.getDistanceBetweenObjects(local0, signed(local7))) > 0xf) |
                  signed(local6)) !==
                0
              ) {
                break block188;
              }
            }
          }
        }
      }
    }
    yield* game.setObjectAnimation(local0, 0);
    if (signed(local6) === 0) {
      local6 =
        truth(
          ((yield* game.wait(0x801, word(local4 + ((yield* game.randomByte()) & 0x1f)))) &
            0x800) !==
            0,
        ) & 0xff;
    }
    if (signed(local6) !== 0) {
      yield* game.addKarma(2);
      yield* game.fightListRemove(local0);
      return null;
    }
  }
}

// Script 2F8: 3 arguments.
export function* script2F8(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2 & 0xff;
  yield* script(0x35c);
  yield* game.setObjectActionAndDirection(local0, local3, 5);
  yield* game.setObjectFlagBits(local0, 0x80);
  for (;;) {
    yield* game.wait(0x100, 0);
    yield* game.setScriptVariable(6, local1);
    yield* game.changeRoom(0x15b);
  }
}

// Script 2F9: no arguments.
export function* script2F9(state) {
  yield* game.notice(0xc, 2, 6, 3, 0, 0x22, 0x3c);
  yield* game.changeRoom(yield* game.getScriptVariable(0x1a));
  yield* game.wait(1, 1);
  return null;
}

// Script 2FA: 1 argument.
export function* script2FA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28e, local0);
  yield* game.talk(local0, 0x35);
  yield* game.setActorStateFlagBits(0xbc2, 0x80);
  yield* script(0x1bc, yield* script(0x35d, local0));
  return null;
}

// Script 2FB: 1 argument.
export function* script2FB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f7, local0, 2, 2, 1, 0x14);
  yield* script(0x1ba, yield* script(0x35d, local0));
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
  return null;
}

// Script 2FC: 1 argument.
export function* script2FC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x25);
  for (;;) {
    yield* game.wait(3, 6);
    if (((yield* game.getActorStateFlags(0xdd6)) & 1) !== 0) {
      yield* game.notice(8, 3, 0xf, 3, 0x400, 0x1a3, 0xb4);
      yield* game.learnSpell(0x55);
      yield* script(0x04b);
      yield* game.keepActorStateFlagBits(0xdd6, 0xfffe);
    }
  }
}

// Script 2FD: 1 argument.
export function* script2FD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x300 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2FE: 1 argument.
export function* script2FE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x800 | local0, 0x109, 0, 0x804, 0xc06));
  return null;
}

// Script 2FF: 1 argument.
export function* script2FF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.talk(local0, 0x14);
  }
}
