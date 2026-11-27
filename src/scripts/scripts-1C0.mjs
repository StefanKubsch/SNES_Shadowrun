// Scripts 1C0 to 1DF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 1C0: 1 argument.
export function* script1C0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f8, local0, 0x159, 1);
  return null;
}

// Script 1C1: 1 argument.
export function* script1C1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    block233: {
      yield* game.setActorStateFlagBits(0x1f4f, 1);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.placeObjectOnWaypoint(local0, 1);
        yield* game.setSpriteMode(local0, 0x8001);
        yield* game.setObjectActionAndDirection(local0, 7, 3);
        yield* game.wait(2, 0);
        yield* game.talk(local0, 0xd);
        yield* game.setSpriteMode(local0, 0);
        yield* game.setObjectActionAndDirection(local0, 1, 0);
        yield* game.setObjectVelocity(local0, 0, 2, 0);
        yield* game.wait(1, 0x19);
        yield* game.native1D(local0, 0);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setObjectActionAndDirection(local0, 0, 0);
        yield* game.wait(1, 0xc8);
        yield* game.setObjectActionAndDirection(local0, 1, 4);
        yield* game.setObjectVelocity(local0, 0, 0xfffe, 0);
        yield* game.wait(1, 0x19);
        yield* game.native1D(local0, 1);
        yield* game.wait(1, 0x78);
        yield* game.notice(2, 2, 0x15, 3, 0x400, 0x7f, 0x12c);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.setActorStateFlagBits(0xbd7, 0x80);
        yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
        break block233;
      }
      yield* game.placeObjectOnWaypoint(local0, 1);
      yield* game.setSpriteMode(local0, 0x8001);
      yield* game.setObjectDialog(local0, 0xe);
      yield* game.setObjectActionAndDirection(local0, 7, 3);
      yield* game.wait(3, 0xc8);
      yield* game.setObjectVelocity(local0, 2, 0, 0);
      yield* game.wait(3, 0x1e);
      yield* game.clearObjectVelocity(local0);
      yield* game.wait(2, 0);
      break block233;
    }
    continue loop2;
  }
}

// Script 1C2: 1 argument, returns a word.
export function* script1C2(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = word((yield* game.getObjectCoarseY(local0)) - 4);
  const t3 = word((yield* game.getObjectCoarseX(local0)) - 1);
  local1 = (yield* game.createObject(0x9e, t3, t2, t1, 0x164)) & 0xff;
  const t4 = yield* game.getSpriteMode(local0);
  const t5 = local1;
  yield* game.setSpriteMode(t5, t4);
  return local1;
}

// Script 1C3: 1 argument.
export function* script1C3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0a0, local0, 0);
  return null;
}

// Script 1C4: no arguments.
export function* script1C4(state) {
  yield* script(0x10e, 0xbd);
  return null;
}

// Script 1C5: 1 argument.
export function* script1C5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f8, local0, 0x158, 0);
  return null;
}

// Script 1C6: 1 argument.
export function* script1C6(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block264: {
    local0 = arg0 & 0xff;
    yield* game.keepObjectRecordFlagBits(local0, 0xffbf);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block264;
    }
    block49: {
      if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
        break block49;
      }
      yield* game.notice(3, 0x16, 0x13, 3, 0x800, 0x6d, 0xb4);
      yield* game.setObjectRecordFlagBits(local0, 2);
      break block49;
    }
    yield* game.setObjectActionAndDirection(local0, 6, 5);
    local1 = 0;
    loop59: for (;;) {
      block130: {
        if (((yield* game.wait(0x81, 0xf0)) & 0x80) === 0) {
          yield* game.playSoundEffect(local0, 0x50, 0xff, 3);
          yield* game.wait(1, 0xa);
          const t1 = yield* game.getObjectCoarseHeight(local0);
          const t2 = yield* game.getObjectCoarseY(local0);
          const t3 = word((yield* game.getObjectCoarseX(local0)) + 4);
          yield* game.createObject(0xe6, t3, t2, t1, 0x99);
          yield* game.wait(1, 0xa);
          yield* game.playSoundEffect(local0, 0x50, 0xff, 3);
          break block130;
        }
        local1 = 255;
        break block130;
      }
      if (signed(local1) === 0) {
        continue loop59;
      }
      yield* game.setObjectRecordFlagBits(local0, 0x41);
      yield* game.setObjectAnimation(local0, 1);
      yield* game.notice(2, 0x15, 0x17, 3, 0x800, 0x6e, 0xf0);
      yield* game.wait(1, 0x64);
      yield* game.setObjectAnimation(local0, 2);
      yield* game.notice(2, 2, 0x12, 3, 0x400, 0x6f, 0xf0);
      yield* game.wait(1, 0xc8);
      yield* game.notice(4, 4, 0x11, 4, 0x400, 0x70, 0xf0);
      yield* game.wait(1, 0xc8);
      yield* game.notice(0x13, 6, 8, 3, 0x400, 0x71, 0x78);
      yield* game.wait(1, 0xc8);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 6);
      yield* game.keepObjectRecordFlagBits(local0, 0xffbf);
      break block264;
    }
  }
  yield* game.keepObjectRecordFlagBits(local0, 3);
  yield* script(0x206, local0);
  return null;
}

// Script 1C7: 5 arguments.
export function* script1C7(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0;
  function* sub13() {
    block160: {
      if (!less(yield* game.getObjectRecordCount(local11), 0xf)) {
        block152: {
          yield* game.setObjectAnimation(local11, 2);
          if (local10 !== 1) {
            if (local10 !== 3) {
              const t1 = yield* game.chooseEnemyTarget(local11);
              local13 = t1 & 0xff;
              if (t1 === 0xffff) {
                yield* game.native81(local11, shiftRight(local0, 8));
                break block152;
              }
              yield* game.moveObjectStraightToPlayer(local11);
              break block152;
            }
            yield* game.native81(local11, local2 & 0xff);
            break block152;
          }
          yield* game.native81(local11, shiftRight(local2, 8));
          break block152;
        }
        local10 = word(local10 + 1) & 3 & 0xff;
        break block160;
      }
      block74: {
        if (local10 === 0xff) {
          break block74;
        }
        block65: {
          yield* game.setObjectAnimation(local11, 2);
          local10 = 255;
          if (local4 === 0) {
            break block65;
          }
          yield* game.notice(2, 5, 0x1a, 4, 0x400, local4, 0xa0);
          break block65;
        }
        yield* game.native81(local11, shiftRight(local0, 8));
        break block74;
      }
      break block160;
    }
    if ((yield* script(0x241, local11, 0x64, 0x3c, 0x28, 0xf, local10)) === 0) {
      local14 = 0;
      loop184: for (;;) {
        block322: {
          local13 = (yield* game.chooseEnemyTarget(local11)) & 0xff;
          if (
            (truth(less(yield* game.getDistanceToPlayer(local11), 0x64)) &
              truth(signed(local13) !== 0xffff)) ===
            0
          ) {
            if (((yield* game.wait(0x801, 6)) & 0x800) === 0) {
              break block322;
            }
            return 0xffff;
          }
          yield* game.setObjectAnimation(local11, 4);
          yield* game.turnObjectToPlayer(local11);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            block301: {
              yield* game.playSoundEffect(local11, 0xc, 0xff, 0xff);
              const t2 = local6 & 0xff;
              const t3 = shiftRight(local6, 8);
              const t4 = yield* game.getPlayerObjectCopy();
              const t5 = local11;
              yield* game.shootAtObject(t5, t4, t3, 0, t2, 1);
              if (
                (truth(local8 !== 0) &
                  truth(less(yield* game.randomByte(), 0x1388)) &
                  (signed(local12) ^ 0xffff)) ===
                0
              ) {
                break block301;
              }
              yield* game.notice(4, 6, 0x12, 3, 0x400, local8, 0xa0);
              local12 = 255;
              break block301;
            }
            break block322;
          }
          return 0xffff;
        }
        if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
          if (
            (truth(local14 === 5) |
              (truth(less(yield* game.getObjectRecordCount(local11), 0xf)) &
                truth(local10 !== 0xff))) !==
            0
          ) {
            if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
              return 0;
            }
            return 0xffff;
          }
          local14 = word(local14 + 1) & 0xff;
          continue loop184;
        }
        return 0xffff;
      }
    } else {
      return 0xffff;
    }
  }
  const t6 = arg4;
  const t7 = arg3;
  const t8 = arg2;
  const t9 = arg1;
  local0 = arg0;
  local2 = t9;
  local4 = t8;
  local6 = t7;
  local8 = t6;
  local12 = 0;
  local11 = local0 & 0xff & 0xff;
  local10 = 0;
  loop403: for (;;) {
    if ((yield* sub13()) === 0) {
      continue loop403;
    }
    return null;
  }
}

// Script 1C8: 3 arguments.
export function* script1C8(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  const t1 = arg2;
  const t2 = arg1;
  local0 = arg0 & 0xff;
  local1 = t2 & 0xff;
  local2 = t1 & 0xff;
  yield* game.setObjectActionAndDirection(local0, local1, local2);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.wait(1, 1);
  loop25: for (;;) {
    block42: {
      if (local2 !== 3) {
        yield* game.bobSecondObject(local0);
        break block42;
      }
      yield* game.bobObject(local0);
      break block42;
    }
    block79: {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        break block79;
      }
      yield* game.setObjectActionAndDirection(local0, 4, 3);
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.wait(1, 0x1d);
      yield* game.setObjectActionAndDirection(local0, local1, local2);
      break block79;
    }
    yield* game.wait(1, 1);
    if (state.word(0x1d09) !== 0) {
      continue loop25;
    }
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1C9: 1 argument.
export function* script1C9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 7);
  yield* script(0x3a4, local0, 1);
  yield* script(0x045, local0, 3);
  yield* script(0x3a4, local0, 0);
  yield* game.notice(7, 2, 0x12, 4, 0x400, 0xfa, 0xf0);
  yield* script(0x045, local0, 7);
  yield* script(0x3a4, local0, 1);
  yield* script(0x045, local0, 4);
  yield* script(0x08b, 0xd6);
  return null;
}

// Script 1CA: 1 argument.
export function* script1CA(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.placeObjectOnWaypoint(local0, local1);
  yield* script(0x0ae, local0);
  yield* game.wait(1, 0x320);
  yield* game.setObjectActionAndDirection(local0, 0, 1);
  yield* game.wait(8, 0);
  return null;
}

// Script 1CB: 1 argument.
export function* script1CB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f8, local0, 0xaa, 0);
  return null;
}

// Script 1CC: 1 argument.
export function* script1CC(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  function* sub61(in0, in1) {
    const t1 = in1;
    local1 = in0;
    local3 = t1;
    yield* game.createObject(0x55, local1, local3, 0x47, 0x2be);
    yield* game.wait(1, 6);
    return;
  }
  function* sub5(in0, in1) {
    const t2 = in1;
    local1 = in0;
    local3 = t2;
    yield* game.notice(2, 2, 0x1c, 3, 0x400, local3, 0xfa);
    loop25: for (;;) {
      yield* game.wait(1, 0xa);
      const t3 = yield* game.getPlayerObjectCopy();
      const t4 = local0;
      yield* game.panSongLevelToObject(
        0xffff,
        word(0xff - shiftRight(yield* game.getDistanceBetweenObjects(t4, t3), 1)),
      );
      const t5 = word(local1 - 0xa);
      local1 = t5;
      if (t5 !== 0) {
        continue loop25;
      }
      return;
    }
  }
  local0 = arg0 & 0xff;
  if (
    (truth((yield* game.getStoryStage()) === 1) |
      (truth(((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) ^ 0xffff)) ===
    0
  ) {
    return null;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop110: for (;;) {
    yield* game.wait(1, 0xa);
    if ((yield* game.getDistanceToPlayer(local0)) <= 0x64) {
      yield* game.setObjectFlagBits(local0, 1);
      yield* game.wait(1, 0x3c);
      yield* game.notice(7, 2, 0x11, 3, 0, 0x73, 0x78);
      yield* game.wait(1, 0x82);
      yield* game.notice(9, 0x13, 0xd, 3, 0, 0x74, 0x78);
      yield* game.wait(1, 0x14);
      yield* sub61(0x24d, 0x241);
      yield* sub61(0x239, 0x241);
      yield* sub61(0x225, 0x241);
      yield* sub61(0x211, 0x241);
      yield* sub61(0x211, 0x255);
      yield* sub61(0x211, 0x269);
      yield* sub61(0x211, 0x27d);
      yield* game.wait(1, 0xa);
      yield* sub61(0x211, 0x27d);
      yield* sub61(0x211, 0x269);
      yield* sub61(0x211, 0x255);
      yield* sub61(0x211, 0x241);
      yield* sub61(0x225, 0x241);
      yield* sub61(0x239, 0x241);
      yield* sub61(0x24d, 0x241);
      yield* game.wait(1, 0x28);
      loop340: for (;;) {
        yield* sub5(0xf0, 0x75);
        yield* sub5(0x1e0, 0x76);
        yield* sub5(0xf0, 0x77);
        yield* sub5(0x1e0, 0x78);
        yield* sub5(0xf0, 0x79);
        yield* sub5(0x1e0, 0x7a);
        yield* game.wait(1, 0xc8);
        continue loop340;
      }
    } else {
      const t6 = yield* game.getPlayerObjectCopy();
      const t7 = local0;
      yield* game.panSongLevelToObject(
        0xffff,
        word(0xff - shiftRight(yield* game.getDistanceBetweenObjects(t7, t6), 1)),
      );
      continue loop110;
    }
  }
}

// Script 1CD: 3 arguments, returns a word.
export function* script1CD(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  block96: {
    const t1 = arg2;
    const t2 = arg1;
    local0 = arg0 & 0xff;
    local1 = t2;
    local3 = t1;
    yield* game.setObjectAnimation(local0, 7);
    const t3 = yield* game.wait(0x6e88, 0);
    local5 = t3;
    if ((t3 & 8) === 0) {
      yield* game.setObjectAnimation(local0, 0);
      break block96;
    }
    block89: {
      yield* game.setObjectAnimation(local0, 4);
      const t4 = yield* game.wait(0x6e81, local1);
      local5 = t4;
      if ((t4 & 1) === 0) {
        yield* game.setObjectAnimation(local0, 0);
        break block89;
      }
      block68: {
        yield* game.spellMenu(local0);
        if (signed(state.byte('SPELL_TARGET_OBJECT')) === 0xffff) {
          break block68;
        }
        yield* game.turnObjectToObject(local0, signed(state.byte('SPELL_TARGET_OBJECT')));
        break block68;
      }
      yield* game.setObjectAnimation(local0, 8);
      local5 = yield* game.wait(0x2e83, local3);
      break block89;
    }
    break block96;
  }
  return local5;
}

// Script 1CE: 1 argument.
export function* script1CE(state, arg0) {
  let local0 = 0;
  block35: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0x7b6)) & 0x80) === 0) {
      yield* game.removeObject(local0);
      break block35;
    }
    yield* script(0x399, local0, 5, 0xa, 0x64);
    yield* game.setObjectArmour(local0, 2);
    break block35;
  }
  return null;
}

// Script 1CF: 1 argument.
export function* script1CF(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block114: {
    local0 = arg0 & 0xff;
    if (
      (truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) > 0x21c) &
        truth((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) > 0x1ea)) ===
      0
    ) {
      break block114;
    }
    block99: {
      const t1 = yield* game.getObjectNumber(local0);
      local3 = t1;
      if (t1 !== 0xf73) {
        if (local3 !== 0xf03) {
          if (local3 !== 0xf50) {
            if (local3 !== 0xf5e) {
              local1 = 0x1b7;
              break block99;
            }
            local1 = 0x1b6;
            break block99;
          }
          local1 = 0x1b5;
          break block99;
        }
        local1 = 0x1b4;
        break block99;
      }
      local1 = 0x1b3;
      break block99;
    }
    yield* game.notice(0xb, 2, 9, 3, 0, local1, 0xf0);
    break block114;
  }
  yield* script(0x06f, 0x175a);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 1D0: 1 argument.
export function* script1D0(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block16: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block16;
    }
    yield* script(0x101, local0);
    yield* script(0x0ae, local0);
    break block16;
  }
  loop16: for (;;) {
    block90: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          break block90;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
        local1 = 255;
        break block90;
      }
      yield* game.notice(2, 0x15, 0xe, 3, 0x800, 0x84, 0xf0);
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
      break block90;
    }
    if (signed(local1) === 0) {
      continue loop16;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1D1: 1 argument.
export function* script1D1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x3c);
  yield* script(0x3a4, local0, 2);
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* game.wait(1, 0x270f);
  return null;
}

// Script 1D2: 1 argument.
export function* script1D2(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block88: {
    local0 = arg0 & 0xff;
    if ((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) <= 0x203) {
      break block88;
    }
    block73: {
      const t1 = yield* game.getObjectNumber(local0);
      local3 = t1;
      if (t1 !== 0xd82) {
        if (local3 !== 0xd66) {
          if (local3 !== 0xcd3) {
            local1 = 0x1b6;
            break block73;
          }
          local1 = 0x1b5;
          break block73;
        }
        local1 = 0x1b4;
        break block73;
      }
      local1 = 0x1b3;
      break block73;
    }
    yield* game.notice(0xb, 2, 9, 3, 0, local1, 0xf0);
    break block88;
  }
  yield* script(0x06f, 0x16c0);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 1D3: 1 argument.
export function* script1D3(state, arg0) {
  let local0 = 0;
  block39: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block39;
    }
    yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    yield* game.notice(4, 0x15, 0x17, 3, 0x800, 0x1fb, 0xf0);
    break block39;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 1D4: 1 argument.
export function* script1D4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.releaseGlove();
  state.setWord('ROOM', 0, yield* game.getScriptVariable(6));
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0xc8);
  yield* game.restoreRunners();
  yield* game.mainMenu();
  yield* game.wait(1, 0x14);
  yield* game.setObjectActionAndDirection(local0, 0, 1);
  yield* game.wait(8, 0);
  yield* game.changeRoom(yield* game.getScriptVariable(6));
  return null;
}

// Script 1D5: 1 argument.
export function* script1D5(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  function* sub5(in0) {
    local2 = in0 & 0xff;
    yield* game.releaseObjectGraphics(local2);
    const t1 = yield* game.getObjectCoarseHeight(local2);
    const t2 = yield* game.getObjectCoarseY(local2);
    const t3 = local2;
    local3 = (yield* game.createObject(0x99, t3, t2, t1, 0x90)) & 0xff;
    yield* game.wait(1, 5);
    yield* game.resetObjectRecordProperty(local2);
    yield* game.wait(1, 0xa);
    return local3;
  }
  local0 = arg0 & 0xff;
  block146: {
    local1 = local0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.setObjectFlagBits(local0, 0x40);
    if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
      yield* game.setObjectRecordFlagBits(local0, 2);
      yield* game.wait(1, 0x64);
      yield* game.playSoundEffect(0xffff, 0xc, 0xff, 3);
      yield* game.wait(1, 0x14);
      yield* game.playSoundEffect(0xffff, 0x14, 0xff, 3);
      yield* game.wait(1, 0x64);
      yield* game.notice(4, 2, 0x19, 4, 0x400, 0x45, 0xf0);
      break block146;
    }
    yield* game.wait(1, 0xdc);
    break block146;
  }
  yield* game.appendToFightList(local0);
  yield* script(0x251, local0, 0, 0x47, 0x40a, 0x100, 0x300, 0x50);
  yield* game.addKarma(1);
  yield* game.fightListRemove(local0);
  const t4 = yield* sub5(local0);
  local0 = t4 & 0xff;
  yield* game.bindObjectToCurrentTask(t4);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectAnimation(local0, 1);
  loop195: for (;;) {
    block272: {
      yield* game.wait(0x80, 0);
      if (((yield* game.getObjectRecordFlags(local1)) & 1) === 0) {
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x4e, 0xf0);
        yield* game.setObjectRecordFlagBits(local1, 1);
        const t5 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
        const t6 = word(shiftLeft(yield* game.getObjectCoarseY(local0), 2) - 2);
        const t7 = word(shiftLeft(yield* game.getObjectCoarseX(local0), 2) - 2);
        const t8 = yield* game.getActorStateFlags(0xb21);
        yield* game.setObjectPosition(t8, t7, t6, t5);
        break block272;
      }
      yield* script(0x38e);
      break block272;
    }
    continue loop195;
  }
}

// Script 1D6: 1 argument.
export function* script1D6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.setObjectDialog(local0, 0x24);
  yield* game.wait(2, 0);
  return null;
}

// Script 1D7: 1 argument.
export function* script1D7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  loop6: for (;;) {
    yield* game.wait(0x80, 0);
    yield* game.notice(2, 0x15, 0x13, 3, 0x800, 0x60, 0x78);
    continue loop6;
  }
}

// Script 1D8: 1 argument.
export function* script1D8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2aa, local0, 1, 0x203, 0x401, 0x602, 0x2c03);
  return null;
}

// Script 1D9: 1 argument.
export function* script1D9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block16: {
    local0 = arg0 & 0xff;
    yield* game.resetPlayerControl();
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      break block16;
    }
    yield* script(0x026, local0);
    break block16;
  }
  block34: {
    if ((yield* game.getScriptVariable(0xa)) === 0) {
      break block34;
    }
    yield* game.raiseStateCount(local0, 0xff);
    yield* game.raiseMemberMagicPoints(local0, 0xff);
    break block34;
  }
  block490: {
    if ((yield* game.redrawDialogWindowList()) === 0) {
      break block490;
    }
    block420: {
      if (
        (truth((yield* game.getObjectRecordCount(local0)) === 0) &
          (truth((yield* game.getScriptVariable(0xa)) !== 0) ^ 0xffff)) !==
        0
      ) {
        break block420;
      }
      yield* game.setObjectAnimation(local0, 0);
      local4 = 0;
      state.setByte(0x1d72, 0, 0);
      state.setByte(0x1d6f, 0, 0);
      state.setByte(0x1d70, 0, 0);
      state.setByte(0x1d71, 0, 0);
      yield* game.redrawDialogWindowList();
      loop80: for (;;) {
        block404: {
          const t1 = yield* game.playerControl();
          local2 = t1;
          if (t1 === 0) {
            local1 = truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) & 0xff;
            break block404;
          }
          block387: {
            if (
              (truth((local2 & 0x80) !== 0) & truth(less(state.word('RUNNER_WEAPON'), 0x8000))) ===
              0
            ) {
              if (
                (truth((local2 & 0x40) !== 0) &
                  truth(state.word('SELECTED_SPELL_SCRIPT') !== 0) &
                  (signed(state.byte(0x1d72)) ^ 0xffff)) ===
                0
              ) {
                local1 = truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) & 0xff;
                break block387;
              }
              block365: {
                if (state.word('AIMING_WEAPON') === 0) {
                  yield* game.setObjectAnimation(local0, 6);
                  local1 = truth(((yield* game.wait(0x808, 0)) & 0x800) !== 0) & 0xff;
                  yield* game.appendSelectedSpellTask();
                  local1 =
                    (truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) | signed(local1)) & 0xff;
                  break block365;
                }
                state.setWord('AIMING_WEAPON', 0, 0);
                state.setWord('AIMING_SPELL', 0, 0xffff);
                yield* game.limitSpellGlove();
                local1 = truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) & 0xff;
                break block365;
              }
              yield* game.setObjectAnimation(local0, 3);
              break block387;
            }
            block263: {
              if (state.word('AIMING_SPELL') === 0) {
                if ((yield* game.shootAtGloveTarget()) !== 1) {
                  local4 = 0;
                  yield* game.setObjectAnimation(local0, state.byte('AIM_ACTION_NEXT'));
                  const t4 = truth(((yield* game.wait(0x808, 0)) & 0x800) !== 0);
                  local1 = t4 & 0xff;
                  if ((t4 | signed(state.byte('JAKE_WIRED_REFLEXES'))) !== 0) {
                    break block263;
                  }
                  local1 = truth(((yield* game.wait(0x801, 0xa)) & 0x800) !== 0) & 0xff;
                  break block263;
                }
                block180: {
                  const t2 = word(local4 + 1);
                  local4 = t2 & 0xff;
                  if (t2 <= 5) {
                    break block180;
                  }
                  local4 = 0;
                  yield* game.notice(2, 0x17, 0xf, 3, 0, 6, 0x3c);
                  break block180;
                }
                block216: {
                  const t3 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0);
                  local1 = t3 & 0xff;
                  if ((t3 | signed(state.byte('JAKE_WIRED_REFLEXES'))) !== 0) {
                    break block216;
                  }
                  local1 = truth(((yield* game.wait(0x801, 0xa)) & 0x800) !== 0) & 0xff;
                  break block216;
                }
                break block263;
              }
              state.setWord('AIMING_WEAPON', 0, 0xffff);
              state.setWord('AIMING_SPELL', 0, 0);
              yield* game.limitCrosshair();
              local1 = truth(((yield* game.wait(0x801, 1)) & 0x800) !== 0) & 0xff;
              break block263;
            }
            yield* game.setObjectAnimation(local0, word(state.byte('AIM_ACTION_NEXT') - 1));
            break block387;
          }
          break block404;
        }
        if (
          ((signed(local1) & (truth((yield* game.getScriptVariable(0xa)) !== 0) ^ 0xffff)) |
            ((yield* game.isTimerRunning()) ^ 0xffff)) ===
          0
        ) {
          continue loop80;
        }
        break block420;
      }
    }
    block473: {
      yield* game.setObjectVelocity(local0, 0, 0, 0);
      yield* game.playSoundEffect(0xffff, 0x14, 0xff, 0x55);
      yield* game.playSoundEffect(0xffff, 0x14, 0xff, 0xaa);
      if ((yield* game.isTimerRunning()) !== 0) {
        break block473;
      }
      const t5 = word((yield* game.getObjectCoarseHeight(local0)) + 0x10);
      const t6 = word((yield* game.getObjectCoarseY(local0)) - 1);
      const t7 = word((yield* game.getObjectCoarseX(local0)) - 1);
      yield* game.createObject(0xb8, t7, t6, t5, 0x382);
      break block473;
    }
    yield* game.wait(1, 0x1e);
    state.setWord('GAME_OPTIONS', 0, 3);
    yield* game.changeRoom(0x15a);
    break block490;
  }
  return null;
}

// Script 1DA: no arguments.
export function* script1DA(state) {
  yield* game.setActorStateHolder(0x999, 0x8b2);
  yield* game.setActorStateFlagBits(0xbc9, 2);
  yield* script(0x04b);
  return null;
}

// Script 1DB: 1 argument.
export function* script1DB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0a7, local0, 1, 0xb4);
  return null;
}

// Script 1DC: 1 argument.
export function* script1DC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  loop15: for (;;) {
    yield* game.wait(0x280, 0);
    yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
    continue loop15;
  }
}

// Script 1DD: 1 argument.
export function* script1DD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectArmour(local0, 3);
  const t1 = word(0x32 + ((yield* game.randomByte()) & 0x1f));
  const t2 = local0;
  yield* script(0x399, t2, 4, 0xf, t1);
  return null;
}

// Script 1DE: 1 argument.
export function* script1DE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getActorStateFlags(0x7af)) & 1) === 0) {
      continue loop2;
    }
    yield* game.wait(1, word(((yield* game.randomByte()) & 0xf) + 0x1e));
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(8, 0);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(8, 0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 1DF: 1 argument.
export function* script1DF(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(2, 0x12, 0x1c, 8, 0x800, 0x228, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}
