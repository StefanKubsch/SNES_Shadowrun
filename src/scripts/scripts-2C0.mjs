// Scripts 2C0 to 2DF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, multiply, script, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 2C0: 1 argument.
export function* script2C0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x380, local0, 3, 0xa, 1, 5);
  return null;
}

// Script 2C1: 1 argument.
export function* script2C1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x900 | local0, 0xb0a, 0, 0x70c));
  return null;
}

// Script 2C2: 1 argument.
export function* script2C2(state, arg0) {
  let local0 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x40);
  yield* game.setObjectAnimation(local0, 2);
  yield* game.setObjectDirection(local0, 0);
  yield* game.native1D(local0, 9);
  yield* game.wait(1, 0x3c);
  yield* game.notice(0xe, 2, 9, 3, 0x400, 0x5e, 0x78);
  local3 = 0;
  loop48: for (;;) {
    block81: {
      if (((yield* game.wait(5, 2)) & 4) === 0) {
        if (!less(yield* game.getDistanceToPlayer(local0), 0x28)) {
          break block81;
        }
        local3 = 255;
        break block81;
      }
      local3 = 255;
      break block81;
    }
    if (signed(local3) === 0) {
      continue loop48;
    }
    yield* game.stopMotion(local0);
    yield* game.clearObjectVelocity(local0);
    yield* game.setObjectAnimation(local0, 0);
    yield* game.turnObjectToPlayer(local0);
    yield* game.wait(1, 0x19);
    yield* game.talk(local0, 0x7f);
    yield* game.resetObjectRecordProperty(local0);
    yield* game.keepObjectFlagBits(local0, 0xffbf);
    yield* game.setObjectAnimation(local0, 2);
    yield* game.native1D(local0, 0xa);
    yield* game.wait(4, 0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 2C3: 1 argument.
export function* script2C3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 1, 6);
  yield* script(0x33d, local0, 0xe6, 0x99);
  return null;
}

// Script 2C4: 1 argument.
export function* script2C4(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block84: {
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
      yield* game.blast(local1, 0xb);
      break block84;
    }
    yield* game.removeObject(local0);
    break block84;
  }
  return null;
}

// Script 2C5: 1 argument.
export function* script2C5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x147, local0, 0);
  return null;
}

// Script 2C6: 1 argument.
export function* script2C6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectRecordFlagBits(local0, 1);
    yield* game.keepObjectFlagBits(local0, 0xffbf);
    yield* game.setObjectActionAndDirection(local0, 2, 4);
    yield* game.native1D(local0, 0);
    yield* game.wait(4, 0);
    yield* game.stopMotion(local0);
    yield* game.setObjectVelocity(local0, 0xfffe, 0xfffb, 0);
    yield* game.wait(1, 0x3c);
    yield* game.releaseObjectGraphics(local0);
    yield* game.removeObject(local0);
    return null;
  }
  return null;
}

// Script 2C7: 1 argument.
export function* script2C7(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  yield* game.wait(1, 0x64);
  local1 = 0xc8;
  loop19: for (;;) {
    yield* game.wait(1, 1);
    local1 = word(local1 - 1);
    if (((yield* game.hasFightTarget()) | truth(local1 === 0)) === 0) {
      continue loop19;
    }
    block58: {
      if (local1 === 0) {
        break block58;
      }
      loop47: for (;;) {
        yield* game.wait(1, 1);
        if ((yield* game.hasFightTarget()) !== 0) {
          continue loop47;
        }
        break block58;
      }
    }
    loop58: for (;;) {
      yield* game.wait(1, 0x14);
      if ((yield* game.getDistanceToPlayer(local0)) > 0x64) {
        continue loop58;
      }
      block186: {
        yield* game.notice(2, 0x14, 0x13, 4, 0x800, 0x7e, 0xf0);
        yield* game.wait(1, 0x3c);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.setObjectVelocity(local0, 0xfffe, 0xffff, 0);
        yield* game.wait(1, 0x14);
        yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
        yield* game.setObjectActionAndDirection(local0, 0, 0);
        yield* game.wait(8, 0);
        yield* game.clearObjectVelocity(local0);
        yield* game.wait(1, 0x3c);
        yield* game.talk(local0, 0);
        yield* game.setObjectVelocity(local0, 2, 1, 0);
        yield* game.setObjectActionAndDirection(local0, 2, 0);
        yield* game.wait(8, 0);
        yield* game.releaseObjectGraphics(local0);
        yield* game.clearObjectVelocity(local0);
        if ((yield* game.isTopicKnown(0xd)) === 0) {
          break block186;
        }
        yield* game.resetObjectRecordProperty(local0);
        break block186;
      }
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 2C8: 1 argument.
export function* script2C8(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  loop7: for (;;) {
    const t1 = truth(((yield* game.wait(0x90, 0)) & 0x10) !== 0);
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      const t2 = yield* game.getObjectCoarseHeight(local0);
      const t3 = yield* game.getObjectCoarseY(local0);
      const t4 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0xb8, t4, t3, t2, 0x382);
      yield* game.blast(local0, 0xa);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
    yield* game.notice(4, 0x15, 0x16, 3, 0x800, 0x1e2, 0xb4);
    continue loop7;
  }
}

// Script 2C9: 1 argument.
export function* script2C9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0 & 0xff;
    loop7: for (;;) {
      block74: {
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0x42, 0xff, 3);
        yield* game.wait(8, 0);
        if ((yield* game.getObjectNumber(local0)) !== 0x1ab) {
          if ((yield* game.getObjectNumber(local0)) !== 0x214) {
            yield* game.wait(1, 0x17);
            break block74;
          }
          yield* game.wait(1, 0x13);
          break block74;
        }
        yield* game.wait(1, 0xb);
        break block74;
      }
      const t1 = word(local2 - 1);
      local2 = t1 & 0xff;
      if (t1 !== 0) {
        continue loop7;
      }
      return;
    }
  }
  local0 = arg0 & 0xff;
  block395: {
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      yield* game.removeObject(local0);
      break block395;
    }
    block145: {
      yield* game.setScriptVariable(0x2a, 0);
      yield* game.setObjectFlags(local0, 0);
      yield* script(0x0ae, local0);
      if ((yield* game.getObjectNumber(local0)) !== 0x1ab) {
        if ((yield* game.getObjectNumber(local0)) !== 0x214) {
          local1 = 10;
          break block145;
        }
        local1 = 6;
        break block145;
      }
      local1 = 1;
      break block145;
    }
    loop145: for (;;) {
      yield* game.turnObjectToPlayer(local0);
      yield* game.wait(1, 0xa);
      const t2 = word(local1 - 1);
      local1 = t2 & 0xff;
      if (t2 !== 0) {
        continue loop145;
      }
      block201: {
        yield* game.wait(1, 0x8c);
        if ((yield* game.getObjectNumber(local0)) !== 0xa8e) {
          break block201;
        }
        yield* game.notice(4, 1, 0x19, 3, 0x400, 0x233, 0xf0);
        break block201;
      }
      block250: {
        yield* game.setObjectAnimation(local0, 2);
        yield* game.moveObjectStraightToPlayer(local0);
        yield* game.wait(1, 0x28);
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        if ((yield* game.getObjectNumber(local0)) !== 0xa8e) {
          break block250;
        }
        yield* game.notice(5, 3, 0x18, 3, 0x400, 0x234, 0xf0);
        break block250;
      }
      block360: {
        yield* game.turnObjectToPlayer(local0);
        yield* game.appendToFightList(local0);
        yield* sub5(8);
        if ((yield* game.getObjectNumber(local0)) !== 0xa8e) {
          if ((yield* game.getObjectNumber(local0)) !== 0x1ab) {
            if ((yield* game.getObjectNumber(local0)) !== 0x214) {
              local1 = 8;
              break block360;
            }
            local1 = 4;
            break block360;
          }
          local1 = 2;
          break block360;
        }
        yield* game.notice(5, 1, 0x15, 4, 0x400, 0x235, 0xf0);
        yield* game.setObjectVelocity(local0, 0, 4, 0);
        yield* game.setObjectActionAndDirection(local0, 2, 0);
        yield* game.wait(1, 0x1e);
        yield* game.clearObjectVelocity(local0);
        yield* game.turnObjectToPlayer(local0);
        local1 = 7;
        break block360;
      }
      block381: {
        yield* sub5(local1);
        if ((yield* game.getObjectNumber(local0)) !== 0xa8e) {
          break block381;
        }
        yield* game.setScriptVariable(0x2a, 1);
        break block381;
      }
      yield* game.fightListRemove(local0);
      yield* script(0x35d, local0);
      break block395;
    }
  }
  return null;
}

// Script 2CA: 1 argument.
export function* script2CA(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block136: {
    local0 = arg0 & 0xff;
    state.setWord('MEMBER_INDEX', 0, 0);
    const t1 = state.byte('AIM_TARGET_OBJECT');
    const t2 = yield* game.getPlayerObjectCopy();
    if ((yield* game.canAttack(t2, t1)) === 0) {
      break block136;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block136;
    }
    state.setByte(0x1d72, 0, 0xffff);
    const t3 = word((yield* game.getObjectCoarseHeight(state.byte('PLAYER_OBJECT'))) + 0x20);
    const t4 = yield* game.getObjectCoarseY(state.byte('PLAYER_OBJECT'));
    const t5 = yield* game.getObjectCoarseX(state.byte('PLAYER_OBJECT'));
    local1 = (yield* game.createObject(0xdc, t5, t4, t3, 0xa1)) & 0xff;
    yield* game.setObjectDirection(local1, shiftRight(word(local0 - 1), 1));
    yield* game.setObjectAnimation(local1, 0);
    yield* game.playSoundEffect(local1, 0x1e, 0xff, 0xff);
    yield* game.wait(
      1,
      yield* game.moveObjectTowardsObject(local1, state.byte('AIM_TARGET_OBJECT')),
    );
    yield* game.removeObject(local1);
    const t6 = yield* game.getObjectCoarseHeight(local1);
    const t7 = yield* game.getObjectCoarseY(local1);
    const t8 = yield* game.getObjectCoarseX(local1);
    local1 = (yield* game.createObject(0xb8, t8, t7, t6, 0x382)) & 0xff;
    yield* game.wait(1, 0xa);
    yield* game.blast(local1, multiply(local0, 6));
    state.setByte(0x1d72, 0, 0);
    break block136;
  }
  return null;
}

// Script 2CB: 1 argument.
export function* script2CB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x5a, 0x70, 0x600);
  return null;
}

// Script 2CC: 1 argument.
export function* script2CC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectDialog(local0, 0x4c);
  yield* game.wait(2, 0);
  return null;
}

// Script 2CD: 6 arguments.
export function* script2CD(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0;
  const t1 = arg5;
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  local0 = arg0 & 0xff;
  local1 = t5;
  local3 = t4;
  local5 = t3;
  local7 = t2 & 0xff;
  local8 = t1;
  local12 = 0;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.setSpriteMode(local0, 0x8001);
  loop27: for (;;) {
    yield* game.wait(1, 1);
    if ((yield* game.isTopicKnown(8)) === 0) {
      continue loop27;
    }
    loop40: for (;;) {
      block73: {
        const t6 = yield* game.wait(0xa1, 1);
        local10 = t6;
        if ((t6 & 0x80) === 0) {
          break block73;
        }
        yield* game.notice(4, 2, local7, 3, 0x800, local3, 0x50);
        break block73;
      }
      if ((local10 & 0x20) === 0) {
        continue loop40;
      }
      block150: {
        yield* game.setActorStateFlagBits(0x31e, 0x20);
        yield* game.wait(1, 0x14);
        yield* game.notice(2, 2, 0x1a, 6, 0x400, local5, 1);
        if ((yield* game.question(0x1a, 6)) === 0) {
          break block150;
        }
        if ((yield* game.payNuyen(local1)) === 0) {
          yield* game.notice(8, 2, 0xf, 3, 0, 2, 0x78);
          break block150;
        }
        local12 = 255;
        break block150;
      }
      if (signed(local12) === 0) {
        continue loop40;
      }
      block175: {
        if ((truth(state.byte('JAKE_SKILLSOFT') === 0) & truth(local8 === 0x3aa)) === 0) {
          break block175;
        }
        state.setByte('JAKE_SKILLSOFT', 0, 1);
        break block175;
      }
      block195: {
        if ((truth(state.byte('JAKE_DERMAL_ARMOUR') === 0) & truth(local8 === 0x15c4)) === 0) {
          break block195;
        }
        state.setByte('JAKE_DERMAL_ARMOUR', 0, 1);
        break block195;
      }
      block214: {
        if (
          (truth(local8 === 0x192f) & (signed(state.byte('JAKE_WIRED_REFLEXES')) ^ 0xffff)) ===
          0
        ) {
          break block214;
        }
        state.setByte('JAKE_WIRED_REFLEXES', 0, 0xffff);
        break block214;
      }
      yield* game.setActorStateFlagBits(local8, 0xc0);
      yield* game.resetObjectRecordProperty(local0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 2CE: 1 argument.
export function* script2CE(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  yield* game.setScriptVariableBits(0xe, local0);
  yield* game.notice(4, 2, 0x18, 3, 0, 0x11c, 0xf0);
  return null;
}

// Script 2CF: 1 argument.
export function* script2CF(state, arg0) {
  let local0 = 0;
  block61: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x160);
    yield* game.setObjectArmour(local0, 3);
    const t1 = word((yield* game.randomBelow(8)) + 0xf);
    const t2 = local0;
    yield* game.setObjectRecordCount(t2, t1);
    const t3 = word(0x46 + ((yield* game.randomByte()) & 0x1f));
    const t4 = local0;
    if ((yield* script(0x076, t4, 4, 0x33, 0, 4, 1, t3)) === 0) {
      yield* game.removeObject(local0);
      break block61;
    }
    yield* script(0x1ba, yield* script(0x068, local0));
    break block61;
  }
  return null;
}

// Script 2D0: 1 argument.
export function* script2D0(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local1 = in0;
    local3 = t1;
    yield* game.wait(1, local1);
    return local3 ^ 0xffff;
  }
  local0 = arg0 & 0xff;
  yield* game.resetObjectRecordProperty(local0);
  yield* game.notice(2, 2, 0x15, 4, 0x400, yield* sub5(0x3c, 0xffc4), 0xf0);
  yield* game.notice(8, 5, 0x16, 3, 0x400, yield* sub5(0x78, 0xffc3), 0xb4);
  yield* game.notice(2, 2, 0x13, 3, 0x400, yield* sub5(0xf0, 0xffc2), 0xf0);
  yield* game.notice(6, 4, 0x18, 4, 0x400, yield* sub5(0xb4, 0xffc1), 0x12c);
  yield* game.notice(2, 2, 9, 3, 0x400, yield* sub5(0xf0, 0xffc0), 0x78);
  return null;
}

// Script 2D1: no arguments.
export function* script2D1(state) {
  yield* script(0x118, 0xe0);
  return null;
}

// Script 2D2: 1 argument.
export function* script2D2(state, arg0) {
  let local0 = 0;
  block101: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0x63c)) & 0x40) === 0) {
      block73: {
        yield* game.setObjectArmour(local0, 0x3f);
        if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
          break block73;
        }
        yield* game.notice(8, 2, 0xb, 3, 0x400, 0x1e4, 0xb4);
        break block73;
      }
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      yield* game.wait(1, 0x28);
      yield* script(0x076, local0, 0xa, 0x45, 0, 5, 2, 0x14);
      break block101;
    }
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = yield* game.getObjectCoarseY(local0);
    const t3 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0x99, t3, t2, t1, 0x152);
    break block101;
  }
  return null;
}

// Script 2D3: 1 argument.
export function* script2D3(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x89d)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0x89d, 0, 0x69, 0x2000);
    yield* game.notice(2, 3, 0x18, 3, 0x400, 0x18f, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0x5b, 0, 0, 0, 0, 0x89d, 0x14);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 2D4: 1 argument.
export function* script2D4(state, arg0) {
  let local0 = 0;
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(0xd, 2, 9, 3, 0, 0x68, 0x78);
    break block26;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 2D5: 2 arguments.
export function* script2D5(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  const t1 = arg1;
  local0 = arg0 & 0xff;
  local1 = t1;
  if (((yield* game.getScriptVariable(0xe)) & local1) === 0) {
    yield* game.setObjectActionAndDirection(local0, 3, 5);
    yield* game.setObjectFlagBits(local0, 0x100);
    loop35: for (;;) {
      block88: {
        if (((yield* game.wait(0x280, 0)) & 0x200) === 0) {
          yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0x11b, 0xf0);
          break block88;
        }
        yield* game.notice(2, 0x15, 0x1b, 3, 0x800, 0x119, 0xf0);
        break block88;
      }
      continue loop35;
    }
  } else {
    yield* script(0x0f7, local0);
    return null;
  }
}

// Script 2D6: 1 argument.
export function* script2D6(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block144: {
    local0 = arg0 & 0xff;
    yield* game.setScriptVariable(0x2a, 0);
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) === 0) {
      break block144;
    }
    yield* game.setObjectArmour(local0, 3);
    yield* game.setObjectRecordCount(local0, 0x1e);
    yield* game.setObjectActionAndDirection(local0, 4, 0);
    yield* game.appendToFightList(local0);
    loop38: for (;;) {
      block96: {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* script(0x235, local0, signed(local2), 2, 1, 4, 1, 0x32)) & 0xff;
          break block96;
        }
        yield* game.turnObjectToObject(local0, signed(local2));
        local1 =
          truth(
            ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0xf)))) & 0x800) !==
              0,
          ) & 0xff;
        break block96;
      }
      if (signed(local1) === 0) {
        continue loop38;
      }
      yield* game.addKarma(9);
      yield* game.fightListRemove(local0);
      if ((yield* game.getObjectNumber(local0)) !== 0x5b0) {
        yield* script(0x1bc, yield* script(0x35d, local0));
        break block144;
      }
      yield* game.setActorStateFlagBits(0x85e, 1);
      yield* script(0x1bc, yield* script(0x35d, local0));
      break block144;
    }
  }
  return null;
}

// Script 2D7: 1 argument.
export function* script2D7(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block135: {
    local0 = arg0 & 0xff;
    yield* game.setObjectArmour(local0, 2);
    yield* game.setObjectRecordCount(local0, 0xf);
    yield* game.setObjectActionAndDirection(local0, 1, 0);
    yield* game.setObjectVelocity(local0, 0, 2, 0);
    yield* game.appendToFightList(local0);
    if (((yield* game.wait(0x801, 0x64)) & 0x800) !== 0) {
      break block135;
    }
    yield* game.clearObjectVelocity(local0);
    yield* game.turnObjectToPlayer(local0);
    yield* game.notice(2, 2, 9, 3, 0x400, 0x5e, 0x3c);
    loop65: for (;;) {
      block130: {
        yield* game.setObjectAnimation(local0, 0);
        const t1 = truth(((yield* game.wait(0x801, 0x10)) & 0x800) !== 0);
        local1 = t1 & 0xff;
        if (t1 !== 0) {
          break block130;
        }
        yield* game.turnObjectToPlayer(local0);
        yield* game.setObjectAnimation(local0, 4);
        const t2 = yield* game.getPlayerObject();
        const t3 = local0;
        yield* game.shootAtObject(t3, t2, 2, 0, 5, 1);
        yield* game.playSoundEffect(local0, 0xc, 0xff, 0xff);
        local1 = truth(((yield* game.wait(0x801, 0x50)) & 0x800) !== 0) & 0xff;
        break block130;
      }
      if (signed(local1) === 0) {
        continue loop65;
      }
      break block135;
    }
  }
  yield* game.addKarma(2);
  yield* game.fightListRemove(local0);
  yield* game.setObjectDirection(local0, 0);
  yield* script(0x1ba, yield* script(0x35d, local0));
  return null;
}

// Script 2D8: 1 argument.
export function* script2D8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  loop7: for (;;) {
    block58: {
      yield* game.wait(0x80, 0);
      if ((yield* game.getStoryStage()) !== 1) {
        yield* game.notice(2, 0x13, 0x16, 5, 0x800, 0xb4, 0xf0);
        break block58;
      }
      yield* game.notice(2, 0x14, 0x16, 4, 0x800, 0xb3, 0xf0);
      break block58;
    }
    continue loop7;
  }
}

// Script 2D9: 1 argument.
export function* script2D9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block134: {
    local0 = arg0 & 0xff;
    yield* game.endDialog();
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block134;
    }
    const t1 = yield* game.spellGloveTarget();
    local1 = t1 & 0xff;
    if (t1 === 0xffff) {
      yield* game.addMagicPoints(word(4 + local0));
      break block134;
    }
    const t2 = word((yield* game.getObjectCoarseHeight(state.byte('MEMBER_OBJECT'))) + 0x20);
    const t3 = yield* game.getObjectCoarseY(state.byte('MEMBER_OBJECT'));
    const t4 = yield* game.getObjectCoarseX(state.byte('MEMBER_OBJECT'));
    local2 = (yield* game.createObject(0xdc, t4, t3, t2, 0xa1)) & 0xff;
    yield* game.setObjectDirection(local2, shiftRight(word(local0 - 1), 1));
    yield* game.setObjectAnimation(local2, 0);
    yield* game.playSoundEffect(local2, 0x1e, 0xff, 0xff);
    yield* game.wait(1, yield* game.moveObjectTowardsObject(local2, signed(local1)));
    yield* game.removeObject(local2);
    const t5 = yield* game.getObjectCoarseHeight(local2);
    const t6 = yield* game.getObjectCoarseY(local2);
    const t7 = yield* game.getObjectCoarseX(local2);
    local2 = (yield* game.createObject(0xb8, t7, t6, t5, 0x382)) & 0xff;
    yield* game.wait(1, 0xa);
    yield* game.blast(local2, multiply(local0, 6));
    break block134;
  }
  return null;
}

// Script 2DA: no arguments.
export function* script2DA(state) {
  const t1 = yield* script(0x03f, 0x1f4, 0x190, 0x12c);
  const t2 = yield* script(0x0b2, 0x166, 0x167, 0x168);
  yield* script(0x162, 0x78c, t2, t1, 0x165, 0x164);
  return null;
}

// Script 2DB: 1 argument.
export function* script2DB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 1, 0, 0x804, 0xc06));
  return null;
}

// Script 2DC: 1 argument.
export function* script2DC(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x98b)) & 0x80) === 0) {
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    loop26: for (;;) {
      yield* game.wait(2, 0);
      yield* game.turnObjectToPlayer(local0);
      yield* game.wait(1, 0x1e);
      yield* game.talk(local0, 0x6b);
      if (((yield* game.getActorStateFlags(0x98b)) & 0x80) === 0) {
        yield* game.wait(1, 0x3c);
        yield* game.setObjectDirection(local0, 0);
        continue loop26;
      }
      yield* game.notice(2, 2, 0x18, 3, 0x400, 0xe7, 0x78);
      yield* game.addSceneObject(0x59, 0, 0, 0, 0xa, 0x98b, 0xa);
      yield* game.removeObject(local0);
      return null;
    }
  } else {
    return null;
  }
}

// Script 2DD: 1 argument.
export function* script2DD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 0x100, 0, 0x804, 0xc06));
  return null;
}

// Script 2DE: 1 argument.
export function* script2DE(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0;
    local1 = truth(((yield* game.wait(0x801, local2)) & 0x800) !== 0) & 0xff;
    return;
  }
  local0 = arg0 & 0xff;
  if ((yield* game.isActorStateProperty(0x8b2, 0x152a)) === 0) {
    yield* game.setObjectRecordCount(local0, 0x14);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.keepObjectFlagBits(local0, 0xdfff);
    yield* game.setObjectFlagBits(local0, 0x8160);
    loop63: for (;;) {
      yield* game.wait(1, 0xa);
      if (
        (truth(less(yield* game.getDistanceToPlayer(local0), 0xc8)) &
          truth(
            (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) ===
              (yield* game.getObjectCoarseHeight(local0)),
          )) ===
        0
      ) {
        continue loop63;
      }
      yield* game.playSoundEffect(local0, 0x5a, 0xff, 3);
      yield* game.setObjectFlagBits(local0, 0x2000);
      yield* game.appendToFightList(local0);
      loop106: for (;;) {
        local1 = truth(((yield* game.wait(0x801, 8)) & 0x800) !== 0) & 0xff;
        if (
          (truth((yield* game.getDistanceToPlayer(local0)) > 0x3c) & (signed(local1) ^ 0xffff)) !==
          0
        ) {
          continue loop106;
        }
        block224: {
          if (signed(local1) !== 0) {
            break block224;
          }
          yield* game.setObjectAnimation(local0, 1);
          yield* game.moveObjectStraightToPlayer(local0);
          loop146: for (;;) {
            yield* sub5(0xa);
            if (
              (signed(local1) |
                truth(less(yield* game.getDistanceToPlayer(local0), 0xa)) |
                truth((yield* game.getDistanceToPlayer(local0)) > 0x3c)) ===
              0
            ) {
              continue loop146;
            }
            block192: {
              if (!less(yield* game.getDistanceToPlayer(local0), 0xf)) {
                break block192;
              }
              const t1 = yield* game.getPlayerObject();
              const t2 = local0;
              yield* game.shootAtObject(t2, t1, 5, 5, 3, 1);
              break block192;
            }
            block218: {
              yield* game.stopMotion(local0);
              yield* game.clearObjectVelocity(local0);
              yield* game.setObjectAnimation(local0, 0);
              yield* game.keepObjectFlagBits(local0, 0xfeff);
              if (signed(local1) !== 0) {
                break block218;
              }
              yield* sub5(0x14);
              break block218;
            }
            yield* game.setObjectFlagBits(local0, 0x100);
            break block224;
          }
        }
        if (signed(local1) === 0) {
          continue loop106;
        }
        yield* game.fightListRemove(local0);
        yield* game.setActorStateFlagBits(0x152a, 0x80);
        yield* game.setScriptVariable(0x2a, local0);
        yield* game.removeObject(local0);
        return null;
      }
    }
  } else {
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 2DF: 1 argument.
export function* script2DF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x300 | local0, 0x102, 0, 0x804, 0xc06));
  return null;
}
