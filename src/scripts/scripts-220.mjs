// Scripts 220 to 23F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 220: 1 argument.
export function* script220(state, arg0) {
  let local0 = 0;
  block15: {
    local0 = arg0 & 0xff;
    if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
      break block15;
    }
    yield* game.setObjectRecordFlags(local0, 0xa);
    break block15;
  }
  yield* script(0x083, local0, 0, 2, 0x14, 3, 1, 5);
  return null;
}

// Script 221: 1 argument, returns a word.
export function* script221(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block163: {
    local0 = arg0 & 0xff;
    const t1 = yield* game.chooseEnemyTarget(local0);
    local1 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.setObjectAnimation(local0, 4);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 5);
      yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
      yield* game.shootAtObject(local0, signed(local1), 2, 0, 4, 0);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 6);
      local2 =
        truth(
          ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0xf) + 0x14))) & 0x800) !==
            0,
        ) & 0xff;
      if (
        (truth((yield* game.getDistanceBetweenObjects(local0, signed(local1))) > 0x3c) &
          (signed(local2) ^ 0xffff)) ===
        0
      ) {
        break block163;
      }
      yield* game.moveObjectToObject(local0, signed(local1));
      yield* game.setObjectAnimation(local0, 1);
      local2 =
        truth(
          ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0xf) + 1))) & 0x800) !== 0,
        ) & 0xff;
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      break block163;
    }
    yield* game.setObjectAnimation(local0, 0);
    yield* game.turnObjectToObject(local0, signed(local1));
    local2 =
      truth(
        ((yield* game.wait(0x801, word(0x28 + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !== 0,
      ) & 0xff;
    break block163;
  }
  return signed(local2);
}

// Script 222: 1 argument.
export function* script222(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local6 = in0 & 0xff;
    local7 = t1 & 0xff;
    yield* game.placeObjectOnWaypoint(local0, local5);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.native1D(local0, local7);
    local4 = (truth(((yield* game.wait(0x806, 0)) & 0x800) !== 0) ^ 0xffff) & 0xff;
    local5 = local7 & 0xff;
    local3 = signed(local6) & 0xff;
    return;
  }
  function sub47(in0, in1) {
    const t2 = in1;
    local6 = in0 & 0xff;
    local7 = t2 & 0xff;
    if (signed(local3) === 0) {
      return local7;
    }
    return local6;
  }
  local0 = arg0 & 0xff;
  block84: {
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectDialog(local0, 0x57);
      break block84;
    }
    yield* game.setObjectDialog(local0, 0x54);
    break block84;
  }
  loop84: for (;;) {
    block160: {
      local4 = 255;
      yield* game.wait(1, word(((yield* game.randomByte()) & 0x1ff) + 0xa));
      local1 = (yield* game.randomByte()) & 3;
      local3 = 255;
      if (local1 !== 0) {
        if (local1 !== 1) {
          if (local1 !== 2) {
            local5 = 6;
            break block160;
          }
          local5 = 4;
          break block160;
        }
        local5 = 3;
        break block160;
      }
      local5 = 0;
      break block160;
    }
    loop160: for (;;) {
      block294: {
        if (local5 !== 0) {
          if (local5 !== 1) {
            if (local5 !== 2) {
              if (local5 !== 3) {
                if (local5 !== 4) {
                  if (local5 !== 5) {
                    if (local5 !== 6) {
                      break block294;
                    }
                    yield* sub5(0, 5);
                    break block294;
                  }
                  const t7 = sub47(6, 4);
                  const t8 = signed(local3);
                  yield* sub5(t8, t7);
                  break block294;
                }
                yield* sub5(0xffff, 5);
                break block294;
              }
              yield* sub5(0xffff, 2);
              break block294;
            }
            const t5 = sub47(1, 3);
            const t6 = signed(local3);
            yield* sub5(t6, t5);
            break block294;
          }
          const t3 = sub47(0, 2);
          const t4 = signed(local3);
          yield* sub5(t4, t3);
          break block294;
        }
        yield* sub5(0, 1);
        break block294;
      }
      if (
        ((truth(local5 === 1) | truth(local5 === 2) | truth(local5 === 5)) & signed(local4)) !==
        0
      ) {
        continue loop160;
      }
      yield* game.releaseObjectGraphics(local0);
      if (signed(local4) !== 0) {
        continue loop84;
      }
      yield* script(0x35d, local0);
      return null;
    }
  }
}

// Script 223: no arguments.
export function* script223(state) {
  let local0 = 0,
    local2 = 0;
  block82: {
    const t1 = yield* game.getScriptVariable(0x22);
    local2 = t1;
    if (t1 !== 3) {
      if (local2 !== 4) {
        if (local2 !== 5) {
          if (local2 !== 6) {
            if (local2 !== 7) {
              break block82;
            }
            local0 = 0x179;
            break block82;
          }
          local0 = 0x173;
          break block82;
        }
        local0 = 0x16c;
        break block82;
      }
      local0 = 0x165;
      break block82;
    }
    local0 = 0x1ce;
    break block82;
  }
  yield* game.setActorStateFlags(0x16c0, 0);
  yield* game.changeScene(4, word(local2 - 1), local0);
  return null;
}

// Script 224: 1 argument.
export function* script224(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* game.wait(1, 0x122);
  yield* game.setObjectDirection(local0, 3);
  yield* game.wait(1, 0x78);
  yield* game.setObjectDirection(local0, 7);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 225: 1 argument.
export function* script225(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = word(((yield* game.randomByte()) & 3) + 5);
  local1 = t1 & 0xff;
  yield* game.setObjectRecordCount(local0, t1);
  yield* game.setObjectActionAndDirection(local0, local1, 5);
  yield* game.appendToFightList(local0);
  loop26: for (;;) {
    yield* game.wait(0x801, 0x1e);
    if (!less(yield* game.getDistanceToPlayer(local0), 0x32)) {
      continue loop26;
    }
    yield* game.createObject(0x54, local0, 0x1e, 0, 0x16f);
    const t2 = yield* game.getObjectRecordCount(local0);
    local1 = t2 & 0xff;
    if (less(t2, 2)) {
      yield* game.fightListRemove(local0);
      yield* game.clearObjectTask(local0);
      return null;
    }
    yield* game.setObjectAnimation(local0, local1);
    continue loop26;
  }
}

// Script 226: 1 argument.
export function* script226(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block143: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) === 0) {
      break block143;
    }
    block26: {
      if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
        break block26;
      }
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      break block26;
    }
    loop26: for (;;) {
      block138: {
        local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
        const t1 = yield* script(0x2ab, signed(local1), 0x100);
        local2 = t1;
        if (t1 !== 0x80) {
          if (local2 !== 0x10) {
            if (local2 !== 0x100) {
              break block138;
            }
            yield* script(0x0f9);
            const t2 = yield* game.chooseNumber();
            local4 = t2;
            if (t2 === 0xffff) {
              break block138;
            }
            if (local4 !== 0x18fe) {
              yield* script(0x0ff, local4);
              break block138;
            }
            yield* game.endDialog();
            yield* game.setActorStateFlagBits(local4, 1);
            break block138;
          }
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          local1 = 255;
          break block138;
        }
        yield* game.notice(6, 0x15, 0x14, 3, 0x800, 0x1be, 0xf0);
        break block138;
      }
      if (signed(local1) === 0) {
        continue loop26;
      }
      break block143;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 227: 1 argument.
export function* script227(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block52: {
    local0 = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block52;
    }
    yield* script(0x307, local0, 0x37);
    yield* game.wait(1, 0x1e);
    yield* game.setObjectRecordCount(local0, 0x14);
    yield* game.native81(local0, 2);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.wait(4, 0);
    break block52;
  }
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.appendToFightList(local0);
  loop64: for (;;) {
    block118: {
      const t1 = yield* game.chooseEnemyTarget(local0);
      local2 = t1 & 0xff;
      if ((yield* game.getDistanceBetweenObjects(local0, t1)) <= 0x50) {
        local1 = (yield* script(0x235, local0, signed(local2), 3, 0, 2, 1, 0x1e)) & 0xff;
        break block118;
      }
      yield* game.turnObjectToObject(local0, signed(local2));
      local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
      break block118;
    }
    if (signed(local1) === 0) {
      continue loop64;
    }
    yield* game.addKarma(5);
    yield* game.fightListRemove(local0);
    yield* script(0x1ba, yield* script(0x35d, local0));
    return null;
  }
}

// Script 228: 1 argument.
export function* script228(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block133: {
    local0 = arg0 & 0xff;
    if (((yield* game.isTopicKnown(0x23)) | (yield* game.isTopicKnown(0x1c))) === 0) {
      yield* game.clearObjectTask(local0);
      break block133;
    }
    yield* game.setObjectRecordCount(local0, 0x28);
    yield* game.setObjectArmour(local0, 3);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.wait(1, word(0x3c + ((yield* game.randomByte()) & 0x1f)));
    local1 = 0;
    yield* game.appendToFightList(local0);
    loop49: for (;;) {
      block100: {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* script(0x235, local0, signed(local2), 4, 0, 6, 1, 0x1e)) & 0xff;
          break block100;
        }
        yield* game.turnObjectToObject(local0, signed(local2));
        local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
        break block100;
      }
      if (signed(local1) === 0) {
        continue loop49;
      }
      yield* game.setActorStateFlagBits(0x13a2, 0x40);
      yield* game.addKarma(3);
      yield* game.fightListRemove(local0);
      yield* script(0x1bc, yield* script(0x35d, local0));
      break block133;
    }
  }
  return null;
}

// Script 229: 1 argument.
export function* script229(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0x145);
  yield* game.notice(0xe, 5, 0x13, 4, 0x400, 0xf1, 0xb4);
  yield* game.wait(1, 0xc8);
  yield* game.turnObjectToPlayer(local0);
  return null;
}

// Script 22A: no arguments.
export function* script22A(state) {
  yield* game.setActorStateFlagBits(0xb83, 0x80);
  yield* game.endDialog();
  yield* game.wait(1, 1);
  yield* game.notice(4, 4, 0x18, 3, 0x400, 0x110, 0xf0);
  return null;
}

// Script 22B: 1 argument.
export function* script22B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseX(local0);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = local0;
  yield* script(0x195, t3, t2, t1, 0xffff, 5, 0x14);
  return null;
}

// Script 22C: 1 argument.
export function* script22C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x2a, 0x77, 0);
  return null;
}

// Script 22D: 1 argument.
export function* script22D(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  loop7: for (;;) {
    yield* game.wait(1, 6);
    if (
      (truth(less(yield* game.getDistanceToPlayer(local0), 0x14)) |
        (truth(((yield* game.getActorStateFlags(0x292)) & 1) !== 0) &
          (truth(((yield* game.getActorStateFlags(0x284)) & 1) !== 0) ^ 0xffff))) ===
      0
    ) {
      continue loop7;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, word((yield* game.randomBelow(6)) + 0xa));
    const t1 = yield* game.getObjectCoarseHeight(local0);
    const t2 = yield* game.getObjectCoarseY(local0);
    const t3 = yield* game.getObjectCoarseX(local0);
    local1 = (yield* game.createObject(0xb8, t3, t2, t1, 0x382)) & 0xff;
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    yield* game.blast(local1, 0x14);
    return null;
  }
}

// Script 22E: 1 argument.
export function* script22E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x31f, local0, 0);
  return null;
}

// Script 22F: 1 argument.
export function* script22F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0,
    local8 = 0;
  function sub16() {
    if (local2 !== 0) {
      if (local2 !== 1) {
        if (local2 !== 2) {
          return local8;
        }
        return local7;
      }
      return local6;
    }
    return local5;
  }
  function* sub5(in0, in1, in2, in3) {
    const t1 = in3;
    const t2 = in2;
    const t3 = in1;
    local5 = in0 & 0xff;
    local6 = t3 & 0xff;
    local7 = t2 & 0xff;
    local8 = t1 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    if (((yield* game.wait(0x803, word(((yield* game.randomByte()) & 0x7f) + 1))) & 0x800) === 0) {
      if (((yield* game.wait(0x803, 0x3c)) & 0x800) === 0) {
        yield* game.setObjectAnimation(local0, 1);
        const t4 = sub16();
        local1 = t4 & 0xff;
        yield* game.native1D(local0, t4);
        if (((yield* game.wait(0x806, 0)) & 0x800) === 0) {
          return;
        }
        local4 = 255;
        return;
      }
      local4 = 255;
      return;
    }
    local4 = 255;
    return;
  }
  local0 = arg0 & 0xff;
  local1 = 255;
  local4 = 0;
  loop142: for (;;) {
    block351: {
      local2 = (yield* game.randomByte()) & 3;
      if (local1 !== 0) {
        if (local1 !== 1) {
          if (local1 !== 2) {
            if (local1 !== 3) {
              if (local1 !== 4) {
                if (local1 !== 5) {
                  if (local1 !== 6) {
                    if (local1 !== 8) {
                      if (local1 !== 7) {
                        yield* sub5(0, 1, 4, 2);
                        break block351;
                      }
                      yield* sub5(8, 0, 5, 6);
                      break block351;
                    }
                    yield* sub5(7, 0, 5, 6);
                    break block351;
                  }
                  yield* sub5(5, 4, 3, 2);
                  break block351;
                }
                yield* sub5(8, 7, 6, 4);
                break block351;
              }
              yield* sub5(5, 8, 3, 2);
              break block351;
            }
            yield* sub5(2, 4, 6, 5);
            break block351;
          }
          yield* sub5(1, 3, 6, 4);
          break block351;
        }
        yield* sub5(0, 8, 6, 3);
        break block351;
      }
      yield* sub5(8, 8, 5, 5);
      break block351;
    }
    if (signed(local4) === 0) {
      continue loop142;
    }
    return null;
  }
}

// Script 230: 1 argument.
export function* script230(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.wait(1, 0x1e);
  loop15: for (;;) {
    block56: {
      yield* game.native1D(local0, 0);
      const t1 = yield* script(0x005, local0, 0x3c);
      local1 = t1 & 0xff;
      if (t1 !== 0) {
        break block56;
      }
      loop31: for (;;) {
        const t2 = truth(((yield* game.wait(0x801, 2)) & 0x800) !== 0);
        local1 = t2 & 0xff;
        if ((t2 | truth(less(yield* game.getDistanceToPlayer(local0), 0x64))) === 0) {
          continue loop31;
        }
        break block56;
      }
    }
    block72: {
      yield* game.moveObjectStraightToPlayer(local0);
      if (signed(local1) !== 0) {
        break block72;
      }
      local1 = (yield* script(0x005, local0, 0x1c)) & 0xff;
      break block72;
    }
    if (signed(local1) === 0) {
      continue loop15;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 231: 1 argument.
export function* script231(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 0x14);
    if (!less(yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()), 0x15e)) {
      continue loop2;
    }
    local1 = 0;
    loop23: for (;;) {
      yield* game.createObject(0x79, 0, 0, 0, 0x280);
      yield* game.wait(1, 0x32);
      const t1 = word(local1 + 1);
      local1 = t1;
      if (less(t1, 4)) {
        continue loop23;
      }
      yield* game.wait(1, word(0x5a + ((yield* game.randomByte()) & 0xff)));
      continue loop2;
    }
  }
}

// Script 232: 1 argument.
export function* script232(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 6);
  yield* game.wait(1, 0x1e);
  loop15: for (;;) {
    block58: {
      yield* game.native1D(local0, 1);
      const t1 = yield* script(0x005, local0, 0x3c);
      local1 = t1 & 0xff;
      if (t1 !== 0) {
        break block58;
      }
      loop32: for (;;) {
        local1 = truth(((yield* game.wait(0x801, 4)) & 0x800) !== 0) & 0xff;
        if ((truth(less(yield* game.getDistanceToPlayer(local0), 0x5a)) | signed(local1)) === 0) {
          continue loop32;
        }
        break block58;
      }
    }
    block74: {
      yield* game.moveObjectStraightToPlayer(local0);
      if (signed(local1) !== 0) {
        break block74;
      }
      local1 = (yield* script(0x005, local0, 0x1e)) & 0xff;
      break block74;
    }
    if (signed(local1) === 0) {
      continue loop15;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 233: 1 argument.
export function* script233(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block13: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block13;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    break block13;
  }
  loop13: for (;;) {
    block95: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block95;
          }
          yield* script(0x0f9);
          local1 = 255;
          yield* game.resetObjectRecordProperty(local0);
          break block95;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block95;
      }
      yield* game.notice(7, 0x15, 0x12, 3, 0x800, 0x8d, 0xf0);
      break block95;
    }
    if (signed(local1) === 0) {
      continue loop13;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 234: 1 argument.
export function* script234(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 5);
    if ((yield* game.getActorStateProperty(0xb98)) !== 0x8b2) {
      continue loop2;
    }
    yield* game.setSpriteMode(local0, 0x8001);
    yield* game.addObjectHeight(local0, 0x80);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.setObjectVelocity(local0, 0, 0, 0xffff);
    local1 = 0x1f4;
    local3 = 0;
    loop53: for (;;) {
      block82: {
        yield* game.wait(1, 1);
        const t1 = signed(local3) ^ 0xffff;
        local3 = t1 & 0xff;
        if (t1 === 0) {
          yield* game.keepObjectFlagBits(local0, 0xff7f);
          break block82;
        }
        yield* game.setObjectFlagBits(local0, 0x80);
        break block82;
      }
      const t2 = word(local1 - 1);
      local1 = t2;
      yield* game.panSongLevelToObject(0xffff, shiftRight(t2, 3));
      if (local1 !== 0) {
        continue loop53;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      loop108: for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
          continue loop108;
        }
        yield* game.keepActorStateFlagBits(0x770, 0xfffe);
        yield* game.keepActorStateFlagBits(0xbf3, 0xfffe);
        yield* game.setActorStateFlagBits(0x15c4, 1);
        yield* game.markTopic(0x28);
        yield* game.markTopic(0x1c);
        yield* game.markTopic(0x23);
        yield* game.markTopic(0x18);
        yield* game.markTopic(0xc);
        yield* game.markTopic(4);
        yield* game.changeRoom(0x87);
        return null;
      }
    }
  }
}

// Script 235: 7 arguments, returns a word.
export function* script235(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local8 = 0;
  block52: {
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
    yield* game.setObjectAnimation(local0, 4);
    yield* game.turnObjectToObject(local0, signed(local1));
    if (local3 !== 0) {
      yield* game.playSoundEffect(local0, 0x42, 0xff, 3);
      break block52;
    }
    yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
    break block52;
  }
  yield* game.shootAtObject(local0, signed(local1), local2, local3, local4, signed(local5));
  const t7 = truth(
    ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0x1f) + local6))) & 0x800) !== 0,
  );
  local8 = t7 & 0xff;
  return t7;
}

// Script 236: 1 argument.
export function* script236(state, arg0) {
  let local0 = 0;
  block46: {
    local0 = arg0 & 0xff;
    if ((yield* script(0x07e, 5)) === 0) {
      yield* game.removeObject(local0);
      break block46;
    }
    yield* game.setObjectRecordCount(local0, 0x14);
    yield* game.setObjectArmour(local0, 3);
    yield* script(0x2f7, local0, 3, 5, 1, 0x1e);
    yield* script(0x1bc, yield* script(0x068, local0));
    break block46;
  }
  return null;
}

// Script 237: 1 argument.
export function* script237(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 5);
  loop9: for (;;) {
    yield* game.wait(1, word(((yield* game.randomByte()) & 0x1f) + 0x12c));
    loop23: for (;;) {
      yield* game.wait(1, 0x32);
      if ((yield* game.getScriptVariable(0x2a)) > 4) {
        continue loop23;
      }
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
      yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
      const t1 = word((yield* game.getObjectCoarseHeight(local0)) + 4);
      const t2 = word((yield* game.getObjectCoarseY(local0)) + 8);
      const t3 = word((yield* game.getObjectCoarseX(local0)) - 6);
      yield* game.createObject(0xbd, t3, t2, t1, 0x8d);
      continue loop9;
    }
  }
}

// Script 238: 1 argument.
export function* script238(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block166: {
    local0 = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) !== 0) {
      break block166;
    }
    yield* game.setObjectFlagBits(local0, 0xa000);
    yield* game.setObjectRecordCount(local0, 0x28);
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* game.appendToFightList(local0);
    yield* game.setObjectArmour(local0, 3);
    loop35: for (;;) {
      block130: {
        const t1 = truth(
          ((yield* game.wait(0x801, word(0x1e + ((yield* game.randomByte()) & 0x3f)))) & 0x800) !==
            0,
        );
        local1 = t1 & 0xff;
        if (t1 !== 0) {
          break block130;
        }
        block112: {
          const t2 = yield* game.chooseEnemyTarget(local0);
          local2 = t2 & 0xff;
          yield* game.turnObjectToObject(local0, t2);
          if (signed(local2) === 0xffff) {
            yield* game.turnObjectToObject(local0, signed(local2));
            break block112;
          }
          yield* game.setObjectAnimation(local0, 4);
          yield* game.shootAtObject(local0, signed(local2), 5, 1, 0xa, 3);
          yield* game.playSoundEffect(local0, 0x40, 0xff, 3);
          break block112;
        }
        local1 = truth(((yield* game.wait(0x801, 0xa)) & 0x800) !== 0) & 0xff;
        yield* game.setObjectAnimation(local0, 0);
        break block130;
      }
      if (signed(local1) === 0) {
        continue loop35;
      }
      yield* game.addKarma(6);
      yield* game.fightListRemove(local0);
      const t3 = yield* game.getObjectCoarseHeight(local0);
      const t4 = yield* game.getObjectCoarseY(local0);
      const t5 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0xb8, t5, t4, t3, 0x382);
      yield* game.wait(1, 0x14);
      break block166;
    }
  }
  yield* game.resetObjectRecordProperty(local0);
  yield* game.removeObject(local0);
  return null;
}

// Script 239: no arguments.
export function* script239(state) {
  yield* game.setActorStateFlagBits(0xcc5, 2);
  return null;
}

// Script 23A: no arguments.
export function* script23A(state) {
  yield* game.markTopic(0x26);
  return null;
}

// Script 23B: 1 argument.
export function* script23B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  const t1 = (yield* game.randomByte()) & 7;
  const t2 = local0;
  yield* game.setObjectActionAndDirection(t2, 0, t1);
  yield* game.wait(1, 0x32);
  yield* game.setObjectRecordCount(local0, 0x1e);
  yield* game.setObjectArmour(local0, 3);
  yield* game.appendToFightList(local0);
  loop31: for (;;) {
    block77: {
      const t3 = yield* game.chooseEnemyTarget(local0);
      local2 = t3 & 0xff;
      if (t3 !== 0xffff) {
        local1 = (yield* script(0x235, local0, signed(local2), 5, 0, 3, 1, 0x1e)) & 0xff;
        break block77;
      }
      local1 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
      break block77;
    }
    if (signed(local1) === 0) {
      continue loop31;
    }
    yield* game.addKarma(0x14);
    yield* game.fightListRemove(local0);
    yield* script(0x1bc, yield* script(0x35d, local0));
    yield* game.setActorStateFlagBits(0x62e, 0x80);
    return null;
  }
}

// Script 23C: 1 argument.
export function* script23C(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block78: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      yield* script(0x0ae, local0);
      local1 = 0;
      loop27: for (;;) {
        block73: {
          if (((yield* game.wait(0x90, 0)) & 0x80) === 0) {
            yield* game.setObjectRecordPropertyFromGroup(local0);
            yield* script(0x04b);
            yield* game.removeObject(local0);
            local1 = 255;
            break block73;
          }
          yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x1dc, 0xf0);
          break block73;
        }
        if (signed(local1) === 0) {
          continue loop27;
        }
        break block78;
      }
    } else {
      yield* script(0x25d, local0, 0x1dc, 0x14);
      break block78;
    }
  }
  return null;
}

// Script 23D: 1 argument.
export function* script23D(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0,
    local6 = 0;
  function* sub5() {
    loop5: for (;;) {
      block277: {
        if ((yield* game.getDistanceToPlayer(local0)) <= 0x1e) {
          block246: {
            local6 = 0;
            const t1 = yield* game.getDirectionToPlayer(local0);
            local1 = t1 & 0xff;
            if (t1 !== 0) {
              if (local1 !== 1) {
                if (local1 !== 2) {
                  if (local1 !== 3) {
                    if (local1 !== 4) {
                      if (local1 !== 5) {
                        if (local1 !== 6) {
                          if (local1 !== 7) {
                            break block246;
                          }
                          local2 = 2;
                          local4 = 0xfffe;
                          break block246;
                        }
                        local2 = 2;
                        local4 = 0;
                        break block246;
                      }
                      local2 = 2;
                      local4 = 2;
                      break block246;
                    }
                    local2 = 0;
                    local4 = 2;
                    break block246;
                  }
                  local2 = 0xfffe;
                  local4 = 2;
                  break block246;
                }
                local2 = 0xfffe;
                local4 = 0;
                break block246;
              }
              local2 = 0xfffe;
              local4 = 0xfffe;
              break block246;
            }
            local2 = 0;
            local4 = 0xfffe;
            break block246;
          }
          yield* game.setObjectActionAndDirection(local0, 8, local1);
          yield* game.setObjectVelocity(local0, local2, local4, 0);
          if (((yield* game.wait(0x801, 5)) & 0x800) === 0) {
            break block277;
          }
          return;
        }
        block65: {
          if (local6 !== 0) {
            if (local6 !== 0x3c) {
              if (local6 !== 0x78) {
                break block65;
              }
              yield* game.setObjectAnimation(local0, 0);
              break block65;
            }
            block50: {
              if (!less(yield* game.getDistanceToPlayer(local0), 0x28)) {
                break block50;
              }
              yield* game.setObjectAnimation(local0, 7);
              break block50;
            }
            break block65;
          }
          yield* game.setObjectAnimation(local0, 0);
          break block65;
        }
        yield* game.turnObjectToPlayer(local0);
        yield* game.clearObjectVelocity(local0);
        if (((yield* game.wait(0x801, 0xa)) & 0x800) === 0) {
          local6 = word(local6 + 1);
          break block277;
        }
        return;
      }
      continue loop5;
    }
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  local6 = 0;
  yield* sub5();
  yield* script(0x068, local0);
  return null;
}

// Script 23E: 1 argument.
export function* script23E(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0);
  yield* game.setObjectFlags(local0, 0x140);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  local1 = 0;
  yield* game.appendToFightList(local0);
  loop24: for (;;) {
    block53: {
      const t1 = yield* script(0x0ac, local0, 3, signed(local1));
      local1 = t1 & 0xff;
      if (t1 !== 0) {
        break block53;
      }
      loop38: for (;;) {
        yield* game.wait(1, 1);
        if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
          continue loop38;
        }
        break block53;
      }
    }
    const t2 = yield* script(0x0ac, local0, 1, signed(local1));
    local1 = t2 & 0xff;
    const t3 = yield* script(0x0ac, local0, 4, t2);
    local1 = t3 & 0xff;
    const t4 = yield* script(0x0ac, local0, 1, t3);
    local1 = t4 & 0xff;
    if (t4 === 0) {
      continue loop24;
    }
    yield* game.fightListRemove(local0);
    yield* game.releaseObjectGraphics(local0);
    yield* game.resetObjectRecordProperty(local0);
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 23F: 1 argument.
export function* script23F(state, arg0) {
  let local0 = 0;
  block41: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block41;
    }
    block35: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block35;
      }
      yield* script(0x0fc, 0x175a);
      break block35;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block41;
  }
  block94: {
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* script(0x101, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    if ((yield* game.isActorStateProperty(0x8b2, 0x769)) === 0) {
      yield* script(0x2e8, local0, 3, 0x162, 0, 2);
      break block94;
    }
    yield* script(0x2e8, local0, 3, 0x162, 2, 2);
    break block94;
  }
  return null;
}
