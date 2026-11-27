// Scripts 2A0 to 2BF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 2A0: 1 argument.
export function* script2A0(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block32: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block32;
    }
    if (((yield* game.getActorStateFlags(0x1c0e)) & 0x80) === 0) {
      yield* game.removeObject(local0);
      return null;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    break block32;
  }
  loop32: for (;;) {
    block106: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          break block106;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
        local1 = 255;
        break block106;
      }
      yield* game.notice(5, 0x15, 0x15, 3, 0x800, 0x1fc, 0xf0);
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
      break block106;
    }
    if (signed(local1) === 0) {
      continue loop32;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 2A1: 1 argument.
export function* script2A1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  loop6: for (;;) {
    block56: {
      if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
        break block56;
      }
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x94, 0x78);
      break block56;
    }
    continue loop6;
  }
}

// Script 2A2: 1 argument.
export function* script2A2(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block105: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x140);
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) === 0) {
      break block105;
    }
    yield* game.setObjectArmour(local0, 2);
    yield* game.setObjectRecordCount(local0, 0x1e);
    yield* game.setObjectActionAndDirection(local0, 4, 0);
    yield* game.appendToFightList(local0);
    loop39: for (;;) {
      block85: {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* script(0x221, local0)) & 0xff;
          break block85;
        }
        yield* game.turnObjectToObject(local0, signed(local2));
        local1 =
          truth(
            ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !==
              0,
          ) & 0xff;
        break block85;
      }
      if (signed(local1) === 0) {
        continue loop39;
      }
      yield* game.addKarma(0xb);
      yield* game.fightListRemove(local0);
      yield* script(0x1bc, yield* script(0x35d, local0));
      break block105;
    }
  }
  return null;
}

// Script 2A3: 6 arguments.
export function* script2A3(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  const t1 = arg5;
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  local0 = arg0 & 0xff;
  local1 = t5 & 0xff;
  local2 = t4 & 0xff;
  local3 = t3 & 0xff;
  local4 = t2 & 0xff;
  local5 = t1 & 0xff;
  loop12: for (;;) {
    yield* game.setObjectAnimation(local0, local1);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(local0, local4, 0xff, 3);
    yield* game.setObjectAnimation(local0, local2);
    yield* game.wait(1, 0xa);
    if ((yield* game.testObjectCollision(local0, local3)) === 0) {
      yield* game.wait(8, 0);
      return null;
    }
    yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
    yield* game.wait(1, 5);
    yield* game.playSoundEffect(local0, local5, 0xff, 3);
    continue loop12;
  }
}

// Script 2A4: 1 argument.
export function* script2A4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  loop9: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop9;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0x7f);
    yield* game.setObjectAnimation(local0, 5);
    yield* game.wait(8, 0);
    yield* game.setObjectAnimation(local0, 1);
    loop46: for (;;) {
      yield* game.wait(1, 1);
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop46;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0x7f);
      yield* game.setObjectAnimation(local0, 7);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(local0, 3);
      loop83: for (;;) {
        block132: {
          if (((yield* game.wait(0x202, 0)) & 2) === 0) {
            yield* game.notice(2, 0x15, 0x1a, 3, 0x800, 0x44, 0xf0);
            break block132;
          }
          yield* game.notice(2, 2, 0x1b, 3, 0x400, 0x43, 0xf0);
          break block132;
        }
        continue loop83;
      }
    }
  }
}

// Script 2A5: 1 argument.
export function* script2A5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  loop6: for (;;) {
    block56: {
      if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
        break block56;
      }
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x95, 0x78);
      break block56;
    }
    continue loop6;
  }
}

// Script 2A6: 4 arguments.
export function* script2A6(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0;
  function* sub11(in0, in1) {
    block37: {
      const t1 = in1;
      local5 = in0;
      local7 = t1;
      if (signed(local3) === 0) {
        yield* game.setObjectVelocity(local0, local7, 0, 0);
        break block37;
      }
      yield* game.setObjectVelocity(local0, 0, local7, 0);
      break block37;
    }
    yield* game.wait(1, local5);
    return;
  }
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4 & 0xff;
  local2 = t3 & 0xff;
  local3 = t2 & 0xff;
  yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
  loop50: for (;;) {
    block80: {
      local4 = 255;
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        yield* game.placeObjectOnWaypoint(local0, local2);
        break block80;
      }
      yield* game.placeObjectOnWaypoint(local0, local1);
      local4 = 0;
      break block80;
    }
    block208: {
      yield* game.keepObjectRecordFlagBits(local0, 0x7f);
      if (signed(local4) === 0) {
        break block208;
      }
      yield* game.setObjectAnimation(local0, 2);
      yield* game.wait(1, 0x190);
      yield* sub11(0x8c, 8);
      yield* sub11(0xa, 7);
      yield* sub11(0xa, 6);
      yield* sub11(0xa, 5);
      yield* sub11(0xa, 4);
      yield* sub11(0xa, 3);
      yield* sub11(0xa, 2);
      yield* sub11(0xa, 1);
      yield* sub11(0x14, 0);
      yield* game.setObjectAnimation(local0, 4);
      yield* game.wait(8, 0);
      yield* game.setObjectRecordFlagBits(local0, 1);
      yield* game.setObjectAnimation(local0, 0);
      yield* game.wait(1, 0x90);
      yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      yield* game.setObjectAnimation(local0, 6);
      yield* game.wait(8, 0);
      break block208;
    }
    yield* game.setObjectAnimation(local0, 2);
    yield* game.wait(1, 0x14);
    yield* sub11(0xa, 1);
    yield* sub11(0xa, 2);
    yield* sub11(0xa, 3);
    yield* sub11(0xa, 4);
    yield* sub11(0xa, 5);
    yield* sub11(0xa, 6);
    yield* sub11(0xa, 7);
    yield* sub11(0xc8, 8);
    yield* game.clearObjectVelocity(local0);
    continue loop50;
  }
}

// Script 2A7: 1 argument.
export function* script2A7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x800 | local0, 0x706, 0, 0x70c));
  return null;
}

// Script 2A8: 1 argument.
export function* script2A8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  const t2 = word(shiftLeft(yield* game.getObjectCoarseY(local0), 2) - 0x10);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.setObjectDialog(local0, 0x54);
  yield* script(0x103, local0);
  yield* game.setObjectActionAndDirection(local0, 7, 7);
  const t5 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  const t6 = word(shiftLeft(yield* game.getObjectCoarseY(local0), 2) - 0x10);
  const t7 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
  const t8 = local0;
  yield* game.setObjectPosition(t8, t7, t6, t5);
  yield* script(0x35d, local0);
  return null;
}

// Script 2A9: 1 argument.
export function* script2A9(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  loop13: for (;;) {
    local1 = 0;
    yield* game.setObjectAnimation(local0, 3);
    loop21: for (;;) {
      block133: {
        const t1 = yield* game.wait(0x281, 1);
        local2 = t1;
        if ((t1 & 0x80) === 0) {
          if ((local2 & 0x200) === 0) {
            if ((local2 & 1) === 0) {
              break block133;
            }
            if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
              break block133;
            }
            yield* game.setObjectRecordFlagBits(local0, 1);
            local1 = 255;
            break block133;
          }
          block102: {
            if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
              yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
              break block102;
            }
            local1 = 255;
            break block102;
          }
          break block133;
        }
        yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x96, 0x78);
        break block133;
      }
      if (signed(local1) === 0) {
        continue loop21;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xff7f);
      yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
      yield* game.setObjectAnimation(local0, 5);
      yield* game.wait(1, 0xa);
      if ((yield* game.testObjectCollision(local0, 1)) === 0) {
        yield* game.wait(8, 0);
        loop207: for (;;) {
          yield* game.setObjectAnimation(local0, 1);
          loop212: for (;;) {
            if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
              yield* game.setObjectAnimation(local0, 7);
              yield* game.wait(1, 0xa);
              if ((yield* game.testObjectCollision(local0, 3)) === 0) {
                yield* game.wait(8, 0);
                yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
                continue loop13;
              }
              yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
              yield* game.wait(1, 5);
              continue loop207;
            }
            yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x96, 0x78);
            continue loop212;
          }
        }
      } else {
        yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
        yield* game.wait(1, 5);
        yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
        continue loop13;
      }
    }
  }
}

// Script 2AA: 6 arguments.
export function* script2AA(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0,
    local15 = 0,
    local16 = 0,
    local17 = 0,
    local18 = 0,
    local19 = 0,
    local20 = 0,
    local21 = 0,
    local23 = 0,
    local25 = 0,
    local26 = 0,
    local27 = 0,
    local28 = 0,
    local29 = 0,
    local30 = 0;
  function* sub18() {
    yield* game.setObjectAnimation(local0, 0);
    yield* game.stopMotion(local0);
    yield* game.clearObjectVelocity(local0);
    local17 = (yield* game.getObjectDirection(local0)) & 0xff;
    local18 = 7;
    loop37: for (;;) {
      if (((yield* game.wait(0x801, 0x2d)) & 0x800) === 0) {
        block137: {
          const t1 = yield* game.chooseEnemyTarget(local0);
          local15 = t1 & 0xff;
          if (t1 === 0xffff) {
            local17 = word(local17 + 1) & 7 & 0xff;
            yield* game.setObjectAnimation(local0, 0);
            yield* game.setObjectDirection(local0, local17);
            local18 = word(local18 - 1) & 0xff;
            break block137;
          }
          yield* game.setObjectAnimation(local0, 4);
          yield* game.shootAtObject(
            local0,
            signed(local15),
            local25,
            local26,
            local27,
            signed(local28),
          );
          yield* game.playSoundEffect(local0, 0x40, 0xff, 3);
          if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
            break block137;
          }
          return 0xffff;
        }
        if (local18 !== 0) {
          continue loop37;
        }
        return 0;
      }
      return 0xffff;
    }
  }
  function* sub15() {
    block215: {
      local11 = shiftRight(local1, 8) & 0xff;
      local12 = local1 & 0xff;
      local13 = shiftRight(local3, 8) & 0xff;
      local14 = local3 & 0xff;
      local25 = shiftRight(local5, 8) & 0xff;
      local26 = local5 & 0xff;
      local27 = shiftRight(local7, 8) & 0xff;
      local28 = local7 & 0xff;
      local30 = local9 & 0xff;
      yield* game.setObjectRecordCount(local0, shiftRight(local9, 8));
      if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
        break block215;
      }
      yield* game.setObjectRecordFlags(local0, local30);
      break block215;
    }
    block277: {
      const t2 = (yield* game.randomByte()) & 3;
      local16 = t2 & 0xff;
      if (t2 !== 0) {
        if (local16 !== 1) {
          if (local16 !== 2) {
            if (local16 !== 3) {
              break block277;
            }
            local19 = local14 & 0xff;
            break block277;
          }
          local19 = local13 & 0xff;
          break block277;
        }
        local19 = local12 & 0xff;
        break block277;
      }
      local19 = local11 & 0xff;
      break block277;
    }
    yield* game.placeObjectOnWaypoint(local0, local19);
    local16 = word(local16 + 1) & 0xff;
    yield* game.appendToFightList(local0);
    yield* game.setObjectArmour(local0, 2);
    loop295: for (;;) {
      block409: {
        local20 = local19 & 0xff;
        if (local16 !== 0) {
          if (local16 !== 1) {
            if (local16 !== 2) {
              if (local16 !== 3) {
                if (local16 !== 4) {
                  if (local16 !== 5) {
                    if (local16 !== 6) {
                      yield* game.getPlayerObjectAfterBreak(0);
                      break block409;
                    }
                    local16 = 0;
                    local19 = local11 & 0xff;
                    break block409;
                  }
                  local19 = local12 & 0xff;
                  break block409;
                }
                local19 = local13 & 0xff;
                break block409;
              }
              local19 = local14 & 0xff;
              break block409;
            }
            local19 = local13 & 0xff;
            break block409;
          }
          local19 = local12 & 0xff;
          break block409;
        }
        local19 = local11 & 0xff;
        break block409;
      }
      local23 = 0;
      loop412: for (;;) {
        block431: {
          const t3 = word(local23 + 1);
          local23 = t3;
          if (t3 !== 0xe) {
            break block431;
          }
          if ((yield* sub18()) === 0) {
            break block431;
          }
          return;
        }
        block463: {
          yield* game.setObjectAnimation(local0, 2);
          if ((truth(local23 > 0xe) & truth(less(local23, 0x1c))) === 0) {
            yield* game.native1D(local0, local19);
            break block463;
          }
          yield* game.native1D(local0, local20);
          break block463;
        }
        const t4 = yield* game.wait(0x805, 0x1e);
        local21 = t4;
        if ((t4 & 0x800) === 0) {
          if ((local21 & 1) === 0) {
            local23 = 0;
            local16 = word(local16 + 1) & 0xff;
            if ((yield* sub18()) === 0) {
              continue loop295;
            }
            return;
          }
          local29 = 10;
          loop495: for (;;) {
            if (((yield* game.wait(0x801, 4)) & 0x800) === 0) {
              block572: {
                const t5 = yield* game.chooseEnemyTarget(local0);
                local15 = t5 & 0xff;
                if (t5 === 0xffff) {
                  break block572;
                }
                yield* game.clearObjectVelocity(local0);
                yield* game.stopMotion(local0);
                yield* game.setObjectAnimation(local0, 4);
                yield* game.shootAtObject(
                  local0,
                  signed(local15),
                  local25,
                  local26,
                  local27,
                  signed(local28),
                );
                yield* game.playSoundEffect(local0, 0x40, 0xff, 3);
                if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
                  break block572;
                }
                return;
              }
              block603: {
                const t6 = word(local29 - 1);
                local29 = t6 & 0xff;
                if (t6 !== 0) {
                  break block603;
                }
                local29 = 10;
                if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
                  break block603;
                }
                return;
              }
              if (signed(local15) !== 0xffff) {
                continue loop495;
              }
              continue loop412;
            }
            return;
          }
        } else {
          return;
        }
      }
    }
  }
  const t7 = arg5;
  const t8 = arg4;
  const t9 = arg3;
  const t10 = arg2;
  const t11 = arg1;
  local0 = arg0 & 0xff;
  local1 = t11;
  local3 = t10;
  local5 = t9;
  local7 = t8;
  local9 = t7;
  block674: {
    yield* sub15();
    yield* game.fightListRemove(local0);
    if ((yield* game.getObjectRecordFlags(local0)) <= 1) {
      yield* script(0x1c2, yield* script(0x35d, local0));
      break block674;
    }
    const t12 = word((yield* game.getObjectRecordFlags(local0)) - 1);
    const t13 = local0;
    yield* game.setObjectRecordFlags(t13, t12);
    yield* script(0x1c2, yield* script(0x068, local0));
    break block674;
  }
  yield* game.addKarma(5);
  return null;
}

// Script 2AB: 2 arguments, returns a word.
export function* script2AB(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block28: {
    const t1 = arg1;
    local0 = arg0 & 0xff;
    local1 = t1;
    if (signed(local0) === 0) {
      local3 = yield* game.wait(0x90, 0);
      break block28;
    }
    local3 = yield* game.scriptAction(0x80 | local1);
    break block28;
  }
  return local3;
}

// Script 2AC: 1 argument.
export function* script2AC(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x089, local0);
  loop6: for (;;) {
    block183: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0x100);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          if (local2 !== 0x100) {
            break block183;
          }
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (t2 === 0xffff) {
            break block183;
          }
          if (
            (truth(local4 === 0x16c) |
              truth(local4 === 0x165) |
              truth(local4 === 0x17a) |
              truth(local4 === 0x15e) |
              (truth(local4 === 0x173) &
                (truth(((yield* game.getActorStateFlags(0xbad)) & 0x40) !== 0) ^ 0xffff))) ===
            0
          ) {
            if ((yield* game.getActorKind(local4)) !== 0x22) {
              yield* script(0x085, local4);
              break block183;
            }
            yield* game.notice(2, 0x16, 0x16, 3, 0x800, 0x1a, 0xb4);
            break block183;
          }
          yield* game.setActorStateFlagBits(local4, 0x80);
          break block183;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block183;
      }
      yield* game.notice(2, 0x15, 0x13, 3, 0x800, 0x8e, 0xf0);
      break block183;
    }
    if (signed(local1) === 0) {
      continue loop6;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 2AD: 1 argument.
export function* script2AD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x4e, 0x6c, 0);
  return null;
}

// Script 2AE: 1 argument.
export function* script2AE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0xa00 | local0, 0x907, 0, 0x70c));
  return null;
}

// Script 2AF: 1 argument.
export function* script2AF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  const t2 = word(shiftLeft(yield* game.getObjectCoarseY(local0), 2) - 0x10);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.setObjectDialog(local0, 0x55);
  yield* script(0x103, local0);
  yield* game.setObjectActionAndDirection(local0, 7, 7);
  const t5 = shiftLeft(yield* game.getObjectCoarseHeight(local0), 2);
  const t6 = word(shiftLeft(yield* game.getObjectCoarseY(local0), 2) - 0x10);
  const t7 = shiftLeft(yield* game.getObjectCoarseX(local0), 2);
  const t8 = local0;
  yield* game.setObjectPosition(t8, t7, t6, t5);
  yield* script(0x35d, local0);
  return null;
}

// Script 2B0: 1 argument.
export function* script2B0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ca, local0, 0x97);
  return null;
}

// Script 2B1: 1 argument.
export function* script2B1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x11d);
    yield* script(0x0ae, local0);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(local0);
    continue loop2;
  }
}

// Script 2B2: 1 argument.
export function* script2B2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.releaseGlove();
  yield* game.stopTimer();
  yield* game.wait(1, 0x64);
  yield* game.notice(0xb, 4, 0xb, 3, 0x400, 0xee, 0xf0);
  yield* game.wait(1, 0x190);
  yield* game.notice(0xc, 0x14, 9, 3, 0, 0xef, 0x7d0);
  yield* game.wait(1, 0x190);
  yield* game.requestRoomReload();
  return null;
}

// Script 2B3: 1 argument.
export function* script2B3(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block134: {
    local0 = arg0 & 0xff;
    yield* game.setObjectFlagBits(local0, 0x60);
    local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local1), 2);
    const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
    const t4 = local0;
    yield* game.setObjectPosition(t4, t3, t2, t1);
    yield* game.addObjectHeight(local0, 0x20);
    yield* game.playSoundEffect(local0, 0x60, 0xff, 3);
    yield* game.wait(1, 2);
    const t5 = yield* game.chooseEnemyTarget(local0);
    local2 = t5 & 0xff;
    if (t5 !== 0xffff) {
      block122: {
        yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local2)));
        if (!less(yield* game.getDistanceToPlayer(local0), 0x14)) {
          break block122;
        }
        const t8 = yield* game.chooseEnemyTarget(local0);
        const t9 = local0;
        yield* game.shootAtObject(t9, t8, 3, 5, 3, 3);
        break block122;
      }
      yield* game.setObjectDirection(local0, 5);
      yield* game.wait(1, 5);
      break block134;
    }
    const t6 = yield* game.getPlayerObject();
    const t7 = local0;
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(t7, t6));
    break block134;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 2B4: 1 argument.
export function* script2B4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  loop7: for (;;) {
    block37: {
      if (((yield* game.wait(0xa, 0)) & 2) === 0) {
        break block37;
      }
      yield* game.notice(0x14, 2, 6, 3, 0x400, 0x1c2, 0x64);
      break block37;
    }
    yield* game.setObjectAnimation(local0, 0);
    continue loop7;
  }
}

// Script 2B5: 1 argument.
export function* script2B5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  loop13: for (;;) {
    yield* script(0x2a3, local0, 2, 4, 0, 0x2c, 0x2e);
    yield* script(0x074, local0, 0, 6, 2, 0x2e);
    continue loop13;
  }
}

// Script 2B6: 1 argument.
export function* script2B6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x56);
  yield* script(0x22f, local0);
  yield* script(0x35d, local0);
  return null;
}

// Script 2B7: 1 argument.
export function* script2B7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ca, local0, 0x98);
  return null;
}

// Script 2B8: 1 argument.
export function* script2B8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x23b);
    yield* script(0x0ae, local0);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(local0);
    continue loop2;
  }
}

// Script 2B9: 1 argument.
export function* script2B9(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block87: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block87;
    }
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((t1 & 0x80) === 0) {
      if ((local1 & 0x100) === 0) {
        break block87;
      }
      yield* game.endDialog();
      yield* game.wait(1, 1);
      yield* game.notice(2, 0x15, 0x15, 3, 0x800, 0xa0, 0xf0);
      yield* game.setActorStateFlagBits(0xb05, 2);
      yield* game.resetObjectRecordProperty(local0);
      break block87;
    }
    yield* game.notice(2, 0x15, 0x18, 3, 0x800, 0x9f, 0xf0);
    break block87;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 2BA: 1 argument.
export function* script2BA(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x57);
  yield* script(0x22f, local0);
  yield* script(0x35d, local0);
  return null;
}

// Script 2BB: 1 argument.
export function* script2BB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 5, 5);
  return null;
}

// Script 2BC: 6 arguments.
export function* script2BC(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  const t1 = arg5;
  const t2 = arg4;
  const t3 = arg3;
  const t4 = arg2;
  const t5 = arg1;
  local0 = arg0 & 0xff;
  local1 = t5 & 0xff;
  local2 = t4 & 0xff;
  local3 = t3 & 0xff;
  local4 = t2 & 0xff;
  local5 = t1;
  if ((truth((yield* game.getScriptVariable(0x2c)) !== 0) & truth(local3 === 1)) === 0) {
    block54: {
      if (local3 !== 0) {
        local9 = 1;
        break block54;
      }
      local9 = 2;
      break block54;
    }
    block222: {
      local7 = (yield* game.getObjectRecordFlags(local0)) & 7;
      yield* game.setObjectFlagBits(local0, 0x100);
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.wait(1, 1);
      if (
        (truth(local7 === (yield* game.getScriptVariable(local1))) &
          truth((yield* game.getScriptVariable(local2)) === local3) &
          (truth(((yield* game.getActorStateFlags(local5)) & local9) > 0) |
            truth(((yield* game.getObjectRecordFlags(local0)) & 0x20) !== 0))) !==
        0
      ) {
        break block222;
      }
      yield* game.setObjectAnimation(local0, 2);
      loop121: for (;;) {
        yield* game.wait(1, 6);
        if (
          (truth(local7 === (yield* game.getScriptVariable(local1))) &
            truth((yield* game.getScriptVariable(local2)) === local3)) ===
          0
        ) {
          continue loop121;
        }
        if (
          (truth(((yield* game.getActorStateFlags(local5)) & local9) > 0) |
            truth(((yield* game.getObjectRecordFlags(local0)) & 0x20) !== 0)) ===
          0
        ) {
          continue loop121;
        }
        yield* game.setObjectRecordFlagBits(local0, 0x20);
        yield* game.setActorStateFlagBits(local5, local4);
        yield* game.playSoundEffect(local0, 0x4e, 0xff, 3);
        yield* game.wait(1, 0x1e);
        yield* game.playSoundEffect(local0, 0x4e, 0xff, 3);
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
        yield* game.wait(8, 0);
        break block222;
      }
    }
    yield* game.setActorStateFlagBits(local5, local4);
    yield* game.setObjectAnimation(local0, 0);
    yield* game.wait(1, 0xa);
    yield* game.keepObjectFlagBits(local0, 0xfeff);
    yield* game.clearObjectTask(local0);
    return null;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 2BD: 1 argument.
export function* script2BD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x12);
  yield* script(0x22f, local0);
  yield* script(0x35d, local0);
  return null;
}

// Script 2BE: 1 argument.
export function* script2BE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.wait(8, 0);
  yield* game.removeObject(local0);
  return null;
}

// Script 2BF: 1 argument.
export function* script2BF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 1, 7);
  yield* script(0x33d, local0, 0x7a, 0x37a);
  return null;
}
