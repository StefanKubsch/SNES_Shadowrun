// Scripts 060 to 07F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  multiply,
  notEqualOrNegativeLeft,
  script,
  shiftLeft,
  shiftRight,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 060: 1 argument.
export function* script060(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setScriptVariable(0x2a, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 061: 1 argument.
export function* script061(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f2, local0, 2, 1, 4, 1);
  return null;
}

// Script 062: 1 argument.
export function* script062(state, arg0) {
  let local0 = 0,
    local2 = 0;
  block109: {
    local0 = arg0;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (
      (truth(((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3) |
        truth(state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT'))) ===
      0
    ) {
      break block109;
    }
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block109;
    }
    local2 = state.byte('AIM_TARGET_OBJECT') & 0xff;
    local0 = multiply(local0, 0x96);
    yield* game.playSoundEffect(local2, 0x36, 0xff, 0xff);
    yield* game.setObjectFlagBits(local2, 0x1000);
    loop66: for (;;) {
      yield* game.setObjectFlagBits(local2, 0x80);
      yield* game.wait(1, 1);
      yield* game.keepObjectFlagBits(local2, 0xff7f);
      yield* game.wait(1, 1);
      const t1 = word(local0 - 1);
      local0 = t1;
      if (t1 !== 0) {
        continue loop66;
      }
      yield* game.keepObjectFlagBits(local2, 0xefff);
      break block109;
    }
  }
  return null;
}

// Script 063: 1 argument.
export function* script063(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x280;
  loop19: for (;;) {
    yield* game.advanceOrbitSlot4(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if ((truth(t1 === 0) | truth(state.word(0x1d09) === 0)) === 0) {
      continue loop19;
    }
    block82: {
      if (state.word(0x1d09) !== 0) {
        yield* script(0x275, local0, 3, 0xb75);
        break block82;
      }
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(1, 0x3c);
      yield* game.removeObject(local0);
      break block82;
    }
    return null;
  }
}

// Script 064: 1 argument.
export function* script064(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    block137: {
      yield* game.wait(1, 1);
      if (((yield* game.getActorStateFlags(0xde4)) & 1) === 0) {
        break block137;
      }
      yield* game.keepObjectFlagBits(local0, 0xdfff);
      yield* game.setObjectActionAndDirection(local0, 0, 6);
      yield* game.setObjectRecordFlags(local0, 1);
      yield* game.wait(1, 0x78);
      yield* game.setObjectAnimation(local0, 4);
      yield* game.wait(8, 0);
      local1 = 3;
      loop73: for (;;) {
        yield* game.setObjectAnimation(local0, 5);
        yield* game.wait(8, 0);
        yield* game.playSoundEffect(local0, 0xe, 0xff, 0xff);
        if (local1 === 0) {
          yield* game.setObjectAnimation(local0, 6);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(local0, 1);
          yield* game.setObjectVelocity(local0, 0xfffd, 0, 0);
          yield* game.wait(1, 0x78);
          break block137;
        }
        local1 = word(local1 - 1);
        continue loop73;
      }
    }
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.resetObjectRecordProperty(local0);
  return null;
}

// Script 065: 1 argument.
export function* script065(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.randomBelow(7);
  const t2 = local0;
  yield* game.setObjectActionAndDirection(t2, t1, 3);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 066: 1 argument.
export function* script066(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x172;
  loop19: for (;;) {
    yield* game.advanceOrbitSlot5(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if ((truth(t1 === 0) | truth(state.word(0x1d09) === 0)) === 0) {
      continue loop19;
    }
    block82: {
      if (state.word(0x1d09) !== 0) {
        yield* script(0x275, local0, 4, 0xb6e);
        break block82;
      }
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(1, 0x3c);
      yield* game.removeObject(local0);
      break block82;
    }
    return null;
  }
}

// Script 067: 1 argument.
export function* script067(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 0);
  yield* game.wait(8, 0);
  yield* game.wait(1, 0x190);
  return null;
}

// Script 068: 1 argument, returns a word.
export function* script068(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = local0;
  local1 = (yield* game.createObject(0x99, t3, t2, t1, 0x90)) & 0xff;
  yield* game.wait(1, 5);
  yield* game.removeObject(local0);
  yield* game.wait(1, 0xa);
  return local1;
}

// Script 069: 1 argument.
export function* script069(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x2da;
  loop19: for (;;) {
    yield* game.advanceOrbitSlot6(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if ((truth(t1 === 0) | truth(state.word(0x1d09) === 0)) === 0) {
      continue loop19;
    }
    block82: {
      if (state.word(0x1d09) !== 0) {
        yield* script(0x275, local0, 5, 0xb6e);
        break block82;
      }
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(1, 0x3c);
      yield* game.removeObject(local0);
      break block82;
    }
    return null;
  }
}

// Script 06A: 1 argument.
export function* script06A(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x1cc;
  loop19: for (;;) {
    yield* game.advanceOrbitSlot7(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if ((truth(t1 === 0) | truth(state.word(0x1d09) === 0)) === 0) {
      continue loop19;
    }
    block82: {
      if (state.word(0x1d09) !== 0) {
        yield* script(0x275, local0, 6, 0xb6e);
        break block82;
      }
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(1, 0x3c);
      yield* game.removeObject(local0);
      break block82;
    }
    return null;
  }
}

// Script 06B: 1 argument.
export function* script06B(state, arg0) {
  let local0 = 0;
  block15: {
    local0 = arg0 & 0xff;
    if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
      break block15;
    }
    yield* game.setObjectRecordFlags(local0, 0xa);
    break block15;
  }
  yield* script(0x3a0, local0, 2, 2, 3, 3, 0);
  return null;
}

// Script 06C: 1 argument.
export function* script06C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0) {
    local3 = in0;
    local5 = shiftRight(local3, 2);
    loop14: for (;;) {
      block60: {
        local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
        local5 = word(local5 - 1);
        if (!less(yield* game.getDistanceBetweenObjects(local0, signed(local2)), 0x14)) {
          break block60;
        }
        yield* game.shootAtObject(local0, signed(local2), 5, 5, 7, 2);
        local5 = 0;
        break block60;
      }
      if (
        (truth(local5 === 0) |
          signed(local1) |
          truth(((yield* game.getActorStateFlags(0x188)) & 0x40) !== 0)) ===
        0
      ) {
        continue loop14;
      }
      return;
    }
  }
  local0 = arg0 & 0xff;
  local1 = 0;
  yield* game.setObjectArmour(local0, 3);
  yield* game.setObjectRecordCount(local0, 0xf);
  yield* game.appendToFightList(local0);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 1);
  yield* game.setActorStateFlags(0x188, 0);
  loop114: for (;;) {
    block275: {
      if (((yield* game.getActorStateFlags(0x188)) & 0x40) === 0) {
        block255: {
          const t1 = yield* game.chooseEnemyTarget(local0);
          local2 = t1 & 0xff;
          if (t1 === 0xffff) {
            break block255;
          }
          yield* game.setObjectFlagBits(local0, 0x40);
          yield* game.setObjectAnimation(local0, 2);
          yield* game.moveObjectStraightToObject(local0, signed(local2));
          yield* sub5(word(((yield* game.randomByte()) & 0x7f) + 0x14));
          if (
            (truth(((yield* game.getActorStateFlags(0x188)) & 0x40) !== 0) | signed(local1)) !==
            0
          ) {
            break block255;
          }
          yield* game.stopMotion(local0);
          yield* game.clearObjectVelocity(local0);
          yield* game.keepObjectFlagBits(local0, 0xffbf);
          if (
            (truth((yield* game.getDistanceBetweenObjects(local0, signed(local2))) > 0x28) &
              truth(((yield* game.randomByte()) & 1) !== 0)) ===
            0
          ) {
            break block255;
          }
          yield* game.turnObjectToObject(local0, signed(local2));
          const t2 = (yield* game.getObjectDirection(local0)) & 0xfffe;
          const t3 = local0;
          yield* game.setObjectActionAndDirection(t3, 1, t2);
          local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
          yield* game.createObject(0x65, local0, 0, 0, 0x34);
          break block255;
        }
        local1 =
          truth(
            ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0x3f) + 0xa))) & 0x800) !==
              0,
          ) & 0xff;
        break block275;
      }
      local1 = 255;
      break block275;
    }
    if ((signed(local1) | truth(((yield* game.getActorStateFlags(0x188)) & 0x40) !== 0)) === 0) {
      continue loop114;
    }
    block310: {
      if (((yield* game.getActorStateFlags(0x188)) & 0x40) !== 0) {
        break block310;
      }
      yield* script(0x276, local0);
      yield* game.addKarma(5);
      break block310;
    }
    yield* game.fightListRemove(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 06D: 1 argument.
export function* script06D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 0, 6);
  loop14: for (;;) {
    yield* game.wait(2, 0);
    yield* game.talk(local0, 0x2d);
    if ((yield* game.getActorStateFlags(0x46)) === 0) {
      continue loop14;
    }
    yield* game.notice(2, 3, 0x1e, 4, 0x400, 0x1a7, 0xc8);
    loop52: for (;;) {
      yield* game.wait(2, 0);
      yield* game.notice(7, 3, 0x11, 3, 0x400, 0x1a9, 0xc8);
      continue loop52;
    }
  }
}

// Script 06E: 5 arguments.
export function* script06E(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local13 = 0;
  function* sub13() {
    block59: {
      if (local6 !== 0x600) {
        if (local6 !== 0x2000) {
          local10 = (yield* script(0x242, local0, 0x600)) & 0xff;
          break block59;
        }
        local10 = (yield* script(0x242, local0, 0)) & 0xff;
        break block59;
      }
      local10 = (yield* script(0x00c, local0)) & 0xff;
      break block59;
    }
    return;
  }
  const t1 = arg4;
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4;
  local3 = t3 & 0xff;
  local4 = t2;
  local6 = t1;
  yield* game.setObjectActionAndDirection(local0, 0, local3);
  loop66: for (;;) {
    yield* game.wait(1, 6);
    if ((yield* game.hasFightTarget()) !== 0) {
      continue loop66;
    }
    local8 = 0;
    loop81: for (;;) {
      block137: {
        const t5 = yield* game.wait(0x803, 1);
        local13 = t5;
        local8 = (truth((t5 & 2) !== 0) | signed(local8)) & 0xff;
        local10 = truth((local13 & 0x800) !== 0) & 0xff;
        const t6 = truth(((yield* game.getObjectFlags(local0)) & 0x10) !== 0);
        local9 = t6 & 0xff;
        if (((t6 ^ 0xffff) & (signed(local8) ^ 0xffff) & (signed(local10) ^ 0xffff)) === 0) {
          break block137;
        }
        yield* game.setObjectActionAndDirection(local0, 0, local3);
        break block137;
      }
      if (
        ((truth(
          (yield* game.getObjectCoarseHeight(yield* game.getPlayerObject())) ===
            (yield* game.getObjectCoarseHeight(local0)),
        ) &
          signed(local8)) |
          signed(local9) |
          signed(local10)) !==
        0
      ) {
        block218: {
          if ((signed(local9) | signed(local10)) === 0) {
            yield* game.setObjectAnimation(local0, 0);
            local8 = 0;
            yield* game.turnObjectToPlayer(local0);
            yield* game.wait(1, 0x14);
            yield* game.talk(local0, local4);
            break block218;
          }
          yield* sub13();
          break block218;
        }
        if (((yield* game.getActorStateFlags(local1)) & 0x80) !== 0) {
          state.setWord('GROUP_LEADER_ONLY', 0, 0);
          return null;
        }
        local11 = 0x64;
        loop233: for (;;) {
          const t7 = yield* game.wait(0x803, 1);
          local13 = t7;
          local8 = truth((t7 & 2) !== 0) & 0xff;
          local10 = truth((local13 & 0x800) !== 0) & 0xff;
          local9 = truth(((yield* game.getObjectFlags(local0)) & 0x10) !== 0) & 0xff;
          local11 = word(local11 - 1);
          if ((signed(local8) | signed(local9) | signed(local10) | truth(local11 === 0)) === 0) {
            continue loop233;
          }
          block313: {
            if ((signed(local9) | signed(local10)) === 0) {
              if (signed(local8) !== 0) {
                break block313;
              }
              yield* game.setObjectActionAndDirection(local0, 0, local3);
              break block313;
            }
            yield* sub13();
            break block313;
          }
          continue loop81;
        }
      } else {
        block179: {
          if (signed(local8) === 0) {
            break block179;
          }
          yield* game.notice(2, 3, 0xc, 3, 0, 0, 0x78);
          local8 = 0;
          break block179;
        }
        continue loop81;
      }
    }
  }
}

// Script 06F: 1 argument.
export function* script06F(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  yield* game.wait(1, 1);
  yield* game.setActorStateFlagBits(local0, 2);
  return null;
}

// Script 070: 1 argument.
export function* script070(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x334;
  loop19: for (;;) {
    yield* game.advanceOrbitSlot8(local0);
    yield* game.wait(1, 1);
    const t1 = word(local1 - 1);
    local1 = t1;
    if ((truth(t1 === 0) | truth(state.word(0x1d09) === 0)) === 0) {
      continue loop19;
    }
    block84: {
      if (state.word(0x1d09) !== 0) {
        yield* script(0x275, local0, 7, 0xb6e);
        yield* game.resetSwarmPhases();
        break block84;
      }
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(1, 0x3c);
      yield* game.removeObject(local0);
      break block84;
    }
    return null;
  }
}

// Script 071: 1 argument.
export function* script071(state, arg0) {
  let local0 = 0;
  block20: {
    local0 = arg0 & 0xff;
    yield* game.setObjectArmour(local0, 1);
    if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
      break block20;
    }
    yield* game.setObjectRecordFlags(local0, 0xa);
    break block20;
  }
  yield* script(0x3a0, local0, 3, 2, 3, 1, 0);
  return null;
}

// Script 072: 1 argument.
export function* script072(state, arg0) {
  let local0 = 0;
  block42: {
    local0 = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) !== 0) {
      yield* script(0x10d, shiftLeft(local0, 8) | 3, 0x303, 0x404);
      break block42;
    }
    yield* script(0x10d, shiftLeft(local0, 8), 0x102, 0x304);
    break block42;
  }
  return null;
}

// Script 073: 1 argument.
export function* script073(state, arg0) {
  let local0 = 0;
  block30: {
    local0 = arg0 & 0xff;
    if ((yield* game.scriptAction(0x80)) !== 0x80) {
      break block30;
    }
    yield* game.notice(3, 0x15, 0x1a, 3, 0x800, 0x1df, 0xf0);
    break block30;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 074: 5 arguments.
export function* script074(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0;
  const t1 = arg4;
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4 & 0xff;
  local2 = t3 & 0xff;
  local3 = t2 & 0xff;
  local4 = t1 & 0xff;
  loop10: for (;;) {
    yield* game.setObjectAnimation(local0, local1);
    yield* game.wait(0x400, 0);
    yield* game.setObjectAnimation(local0, local2);
    yield* game.wait(1, 0xa);
    if ((yield* game.testObjectCollision(local0, local3)) === 0) {
      yield* game.wait(8, 0);
      yield* game.playSoundEffect(local0, local4, 0xff, 3);
      return null;
    }
    yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
    yield* game.wait(1, 5);
    continue loop10;
  }
}

// Script 075: 1 argument.
export function* script075(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* script(0x391, local0)) !== 0) {
    block88: {
      yield* game.setObjectRecordCount(local0, 0x24);
      yield* game.wait(1, 0x23);
      yield* game.appendToFightList(local0);
      if ((yield* script(0x111, 0x800 | local0, 0x403, 0, 0x400, 0x501, 0x204, 0x201)) === 0) {
        yield* game.addKarma(0xd);
        yield* game.fightListRemove(local0);
        yield* script(0x35d, local0);
        yield* game.setActorStateFlagBits(0x1b66, 1);
        yield* game.wait(1, 0x64);
        break block88;
      }
      yield* game.setActorStateFlagBits(0x1b66, 2);
      break block88;
    }
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 076: 7 arguments, returns a word.
export function* script076(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0;
  const t1 = arg6;
  const t2 = arg5;
  const t3 = arg4;
  const t4 = arg3;
  const t5 = arg2;
  const t6 = arg1;
  local0 = arg0 & 0xff;
  local1 = t6 & 0xff;
  local2 = t5 & 0xff;
  local3 = t4 & 0xff;
  local4 = t3 & 0xff;
  local5 = t2 & 0xff;
  local6 = t1;
  if ((yield* script(0x07e, local1)) === 0) {
    return 0;
  }
  local9 = shiftRight(local2, 4) & 0xff;
  local2 = local2 & 0xf & 0xff;
  const t7 = (yield* game.randomByte()) & 7;
  const t8 = local0;
  yield* game.setObjectActionAndDirection(t8, 0, t7);
  yield* game.wait(1, local6);
  loop52: for (;;) {
    block174: {
      yield* game.setObjectAnimation(local0, 0);
      const t9 = yield* game.chooseEnemyTarget(local0);
      local10 = t9 & 0xff;
      if (t9 !== 0xffff) {
        block103: {
          if (local1 === 0) {
            break block103;
          }
          yield* game.appendToFightList(local0);
          local1 = 0;
          break block103;
        }
        local8 =
          (yield* script(
            0x235,
            local0,
            signed(local10),
            local2,
            local3,
            local4,
            signed(local5),
            local6,
          )) & 0xff;
        if (
          (truth((yield* game.getDistanceBetweenObjects(local0, signed(local10))) > 0x64) &
            ((signed(local8) | truth(((yield* game.getObjectRecordFlags(local0)) & 1) !== 0)) ^
              0xffff)) ===
          0
        ) {
          break block174;
        }
        yield* game.setObjectAnimation(local0, 2);
        yield* game.moveObjectToObject(local0, signed(local10));
        local8 = truth(((yield* game.wait(0x801, 0xa)) & 0x800) !== 0) & 0xff;
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        break block174;
      }
      yield* game.turnObjectToObject(local0, signed(local10));
      local8 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
      break block174;
    }
    if (signed(local8) === 0) {
      continue loop52;
    }
    yield* game.addKarma(local9);
    yield* game.fightListRemove(local0);
    return 0xffff;
  }
}

// Script 077: 1 argument.
export function* script077(state, arg0) {
  let local0 = 0,
    local2 = 0;
  block119: {
    local0 = arg0;
    yield* game.endDialog();
    if ((yield* game.spendMagic(word(4 + local0))) === 0) {
      break block119;
    }
    const t1 = yield* game.spellGloveTarget();
    local2 = t1 & 0xff;
    if (
      (truth(t1 === 0xffff) |
        (truth(((yield* game.getObjectFlags(signed(local2))) & 3) !== 3) &
          truth(notEqualOrNegativeLeft(signed(local2), state.byte('PLAYER_OBJECT'))))) ===
      0
    ) {
      local0 = multiply(local0, 0x96);
      yield* game.playSoundEffect(signed(local2), 0x36, 0xff, 0xff);
      yield* game.setObjectFlagBits(signed(local2), 0x1000);
      loop76: for (;;) {
        yield* game.setObjectFlagBits(signed(local2), 0x80);
        yield* game.wait(1, 1);
        yield* game.keepObjectFlagBits(signed(local2), 0xff7f);
        yield* game.wait(1, 1);
        const t2 = word(local0 - 1);
        local0 = t2;
        if (t2 !== 0) {
          continue loop76;
        }
        yield* game.keepObjectFlagBits(signed(local2), 0xefff);
        break block119;
      }
    } else {
      yield* game.addMagicPoints(word(4 + local0));
      break block119;
    }
  }
  return null;
}

// Script 078: 1 argument.
export function* script078(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 1);
    continue loop2;
  }
}

// Script 079: 1 argument.
export function* script079(state, arg0) {
  let local0 = 0;
  block44: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0x1d96)) & 0x80) !== 0) {
      break block44;
    }
    block29: {
      if ((yield* game.getObjectNumber(local0)) !== 0x1d96) {
        break block29;
      }
      yield* game.setObjectRecordFlagBits(local0, 0x80);
      break block29;
    }
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    yield* game.wait(1, 0x190);
    break block44;
  }
  yield* script(0x031, local0);
  return null;
}

// Script 07A: 4 arguments, returns a word.
export function* script07A(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0,
    local8 = 0,
    local10 = 0,
    local12 = 0,
    local14 = 0,
    local16 = 0,
    local17 = 0,
    local18 = 0;
  function* sub11() {
    block152: {
      if (!less(yield* game.getObjectRecordCount(local17), 0xb)) {
        yield* game.setObjectAnimation(local17, 2);
        if (local16 !== 0) {
          local16 = 0;
          yield* game.native81(local17, local2 & 0xff);
          break block152;
        }
        local16 = 1;
        yield* game.native81(local17, shiftRight(local2, 8));
        break block152;
      }
      block108: {
        if (local16 === 0xff) {
          break block108;
        }
        block99: {
          yield* game.setObjectAnimation(local17, 2);
          local16 = 255;
          if (local4 === 0) {
            break block99;
          }
          block82: {
            if (local4 !== 0x243) {
              if (local4 !== 0x244) {
                local18 = 23;
                break block82;
              }
              local18 = 22;
              break block82;
            }
            local18 = 20;
            break block82;
          }
          yield* game.notice(2, 5, local18, 3, 0x400, local4, 0xa0);
          break block99;
        }
        yield* game.native81(local17, shiftRight(local0, 8));
        break block108;
      }
      break block152;
    }
    if ((yield* script(0x241, local17, 0x64, 0x3c, 0x32, 0xb, local16)) === 0) {
      block569: {
        const t1 = yield* game.chooseEnemyTarget(local17);
        local14 = t1 & 0xff;
        if (t1 === 0xffff) {
          if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
            break block569;
          }
          return 0xffff;
        }
        block548: {
          if (
            (truth((yield* game.getDistanceBetweenObjects(local17, signed(local14))) > 0x32) |
              truth(((yield* game.randomByte()) & 1) !== 0)) ===
            0
          ) {
            yield* game.setObjectAnimation(local17, 4);
            yield* game.turnObjectToObject(local17, signed(local14));
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              local8 = 0;
              loop454: for (;;) {
                yield* game.setObjectAnimation(local17, 5);
                yield* game.turnObjectToObject(local17, signed(local14));
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  yield* game.playSoundEffect(local17, 0xe, 0xff, 0xff);
                  yield* game.shootAtObject(local17, signed(local14), 2, 0, local6 & 0xff, 1);
                  if (local8 === 3) {
                    yield* game.setObjectAnimation(local17, 6);
                    if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                      break block548;
                    }
                    return 0xffff;
                  }
                  local8 = word(local8 + 1);
                  continue loop454;
                }
                return 0xffff;
              }
            } else {
              return 0xffff;
            }
          } else {
            yield* game.setObjectAnimation(local17, 7);
            yield* game.turnObjectToObject(local17, signed(local14));
            if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
              block308: {
                const t2 = (yield* game.randomByte()) & 3;
                local8 = t2;
                if (t2 !== 0) {
                  if (local8 !== 1) {
                    if (local8 !== 2) {
                      local10 = 0x242;
                      local18 = 16;
                      break block308;
                    }
                    local10 = 0x241;
                    local18 = 18;
                    break block308;
                  }
                  local10 = 0x240;
                  local18 = 18;
                  break block308;
                }
                local10 = 0x23f;
                local18 = 21;
                break block308;
              }
              yield* game.notice(4, word(local18 - 0xf), local18, 3, 0x400, local10, 0x64);
              yield* game.setObjectAnimation(local17, 8);
              local8 = 5;
              loop337: for (;;) {
                block356: {
                  const t3 = yield* game.chooseEnemyTarget(local17);
                  local14 = t3 & 0xff;
                  if (t3 === 0xffff) {
                    break block356;
                  }
                  yield* game.turnObjectToObject(local17, signed(local14));
                  break block356;
                }
                if (((yield* game.wait(0x809, 8)) & 0x800) === 0) {
                  if (local8 === 0) {
                    block419: {
                      if (signed(local14) === 0xffff) {
                        break block419;
                      }
                      const t4 = local12;
                      const t5 = word((yield* game.getObjectCoarseHeight(local17)) + 0x20);
                      const t6 = yield* game.getObjectCoarseY(local17);
                      const t7 = yield* game.getObjectCoarseX(local17);
                      yield* game.createObject(0xdc, t7, t6, t5, t4);
                      break block419;
                    }
                    break block548;
                  }
                  local8 = word(local8 - 1);
                  continue loop337;
                }
                return 0xffff;
              }
            } else {
              return 0xffff;
            }
          }
        }
        break block569;
      }
      if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  const t8 = arg3;
  const t9 = arg2;
  const t10 = arg1;
  local0 = arg0;
  local2 = t10;
  local4 = t9;
  local6 = t8;
  block648: {
    local17 = local0 & 0xff & 0xff;
    yield* game.setObjectActionAndDirection(local17, 2, 0);
    yield* game.setObjectFlagBits(local17, 0x140);
    yield* game.appendToFightList(local17);
    if (((yield* game.getStoryStage()) & 0x20) === 0) {
      yield* game.setObjectArmour(local17, 2);
      local12 = 0x2c4;
      break block648;
    }
    yield* game.setObjectArmour(local17, 4);
    local12 = 0x160;
    break block648;
  }
  local16 = 0;
  loop651: for (;;) {
    if ((yield* sub11()) === 0) {
      continue loop651;
    }
    yield* game.addKarma(word((yield* game.randomBelow(shiftRight(local6, 8))) + 3));
    yield* game.fightListRemove(local17);
    return yield* script(0x35d, local17);
  }
}

// Script 07B: no arguments.
export function* script07B(state) {
  yield* script(0x0c8, 0x3f0, 0x7d0, 0x195);
  return null;
}

// Script 07C: 1 argument.
export function* script07C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerArmour(local0, 0x23);
  yield* game.wait(1, 1);
  yield* game.removeObject(local0);
  return null;
}

// Script 07D: 1 argument.
export function* script07D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x26);
  yield* game.removeObject(local0);
  return null;
}

// Script 07E: 1 argument, returns a word.
export function* script07E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (
    (truth(less(yield* game.randomBelow(0xa), local0)) &
      truth(less(yield* game.getScriptVariable(0x2a), 4))) ===
    0
  ) {
    return 0;
  }
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  return 0xffff;
}

// Script 07F: no arguments.
export function* script07F(state) {
  yield* game.setActorStateFlagBits(0xabf, 0x80);
  return null;
}
