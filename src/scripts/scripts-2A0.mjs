// Scripts 2A0 to 2BF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, shiftLeft, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 2A0: 1 argument.
export function* script2A0(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    if (((yield* game.getActorStateFlags(0x1c0e)) & 0x80) === 0) {
      yield* game.removeObject(object);
      return null;
    }
    yield* game.setObjectActionAndDirection(object, 0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    const t1 = yield* run.script2AB(signed(local1), 0);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
        local1 = 255;
      }
    } else {
      yield* game.notice(5, 0x15, 0x15, 3, 0x800, 0x1fc /* "Smooth scales of a mermaid." */, 0xf0);
      yield* game.playSoundEffect(object, 0x32, 0xff, 3);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 2A1: 1 argument.
export function* script2A1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script0AE(local0);
  for (;;) {
    if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
    } else {
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x94 /* "Apartment 4" */, 0x78);
    }
  }
}

// Script 2A2: 1 argument.
export function* script2A2(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block105: {
    object = arg0 & 0xff;
    yield* game.setObjectFlagBits(object, 0x140);
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) {
      yield* game.setObjectArmour(object, 2);
      yield* game.setObjectRecordCount(object, 0x1e);
      yield* game.setObjectActionAndDirection(object, 4, 0);
      yield* game.appendToFightList(object);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local2 = t1 & 0xff;
        if (t1 !== 0xffff) {
          local1 = (yield* run.script221(object)) & 0xff;
        } else {
          yield* game.turnObjectToObject(object, signed(local2));
          local1 =
            truth(
              ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) &
                0x800) !==
                0,
            ) & 0xff;
        }
        if (signed(local1) !== 0) {
          yield* game.addKarma(0xb);
          yield* game.fightListRemove(object);
          yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
          break block105;
        }
      }
    }
  }
  return null;
}

// Script 2A3: 6 arguments.
export function* script2A3(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5 & 0xff;
  for (;;) {
    yield* game.setObjectAnimation(object, local1);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(object, local4, 0xff, 3);
    yield* game.setObjectAnimation(object, local2);
    yield* game.wait(1, 0xa);
    if ((yield* game.testObjectCollision(object, local3)) === 0) {
      yield* game.wait(8, 0);
      return null;
    }
    yield* game.playSoundEffect(object, 0x20, 0xff, 3);
    yield* game.wait(1, 5);
    yield* game.playSoundEffect(object, local5, 0xff, 3);
  }
}

// Script 2A4: 1 argument.
export function* script2A4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 3, 5);
  for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0x7f);
      yield* game.setObjectAnimation(object, 5);
      yield* game.wait(8, 0);
      yield* game.setObjectAnimation(object, 1);
      for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.keepObjectRecordFlagBits(object, 0x7f);
          yield* game.setObjectAnimation(object, 7);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(object, 3);
          for (;;) {
            if (((yield* game.wait(0x202, 0)) & 2) === 0) {
              yield* game.notice(
                2,
                0x15,
                0x1a,
                3,
                0x800,
                0x44 /* "The door is locked from the inside." */,
                0xf0,
              );
            } else {
              yield* game.notice(
                2,
                2,
                0x1b,
                3,
                0x400,
                0x43 /* "There is nobody here, but us... mice!" */,
                0xf0,
              );
            }
          }
        }
      }
    }
  }
}

// Script 2A5: 1 argument.
export function* script2A5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script0AE(local0);
  for (;;) {
    if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
    } else {
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x95 /* "Apartment 5" */, 0x78);
    }
  }
}

// Script 2A6: 4 arguments.
export function* script2A6(state, arg0, arg1, arg2, arg3) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0;
  function* sub11(in0, in1) {
    local5 = in0;
    local7 = in1;
    if (signed(local3) === 0) {
      yield* game.setObjectVelocity(object, local7, 0, 0);
    } else {
      yield* game.setObjectVelocity(object, 0, local7, 0);
    }
    yield* game.wait(1, local5);
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  yield* game.keepObjectRecordFlagBits(object, 0xfffe);
  for (;;) {
    local4 = 255;
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      yield* game.placeObjectOnWaypoint(object, local2);
    } else {
      yield* game.placeObjectOnWaypoint(object, local1);
      local4 = 0;
    }
    yield* game.keepObjectRecordFlagBits(object, 0x7f);
    if (signed(local4) !== 0) {
      yield* game.setObjectAnimation(object, 2);
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
      yield* game.setObjectAnimation(object, 4);
      yield* game.wait(8, 0);
      yield* game.setObjectRecordFlagBits(object, 1);
      yield* game.setObjectAnimation(object, 0);
      yield* game.wait(1, 0x90);
      yield* game.keepObjectRecordFlagBits(object, 0xfffe);
      yield* game.setObjectAnimation(object, 6);
      yield* game.wait(8, 0);
    }
    yield* game.setObjectAnimation(object, 2);
    yield* game.wait(1, 0x14);
    yield* sub11(0xa, 1);
    yield* sub11(0xa, 2);
    yield* sub11(0xa, 3);
    yield* sub11(0xa, 4);
    yield* sub11(0xa, 5);
    yield* sub11(0xa, 6);
    yield* sub11(0xa, 7);
    yield* sub11(0xc8, 8);
    yield* game.clearObjectVelocity(object);
  }
}

// Script 2A7: 1 argument.
export function* script2A7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script07A(0x800 | local0, 0x706, 0, 0x70c));
  return null;
}

// Script 2A8: 1 argument.
export function* script2A8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t2 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 0x10);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.setObjectDialog(object, 0x54);
  yield* run.script103(object);
  yield* game.setObjectActionAndDirection(object, 7, 7);
  const t4 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t5 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 0x10);
  const t6 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  yield* game.setObjectPosition(object, t6, t5, t4);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 2A9: 1 argument.
export function* script2A9(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  loop13: for (;;) {
    local1 = 0;
    yield* game.setObjectAnimation(object, 3);
    for (;;) {
      const t1 = yield* game.wait(0x281, 1);
      local2 = t1;
      if ((local2 & 0x80) === 0) {
        if ((local2 & 0x200) === 0) {
          if ((local2 & 1) !== 0) {
            if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
              yield* game.setObjectRecordFlagBits(object, 1);
              local1 = 255;
            }
          }
        } else {
          if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
            yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b /* "This door is locked." */, 0x78);
          } else {
            local1 = 255;
          }
        }
      } else {
        yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x96 /* "Apartment 6" */, 0x78);
      }
      if (signed(local1) !== 0) {
        yield* game.keepObjectRecordFlagBits(object, 0xff7f);
        yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(object, 5);
        yield* game.wait(1, 0xa);
        if ((yield* game.testObjectCollision(object, 1)) === 0) {
          yield* game.wait(8, 0);
          loop207: for (;;) {
            yield* game.setObjectAnimation(object, 1);
            for (;;) {
              if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
                yield* game.setObjectAnimation(object, 7);
                yield* game.wait(1, 0xa);
                if ((yield* game.testObjectCollision(object, 3)) === 0) {
                  yield* game.wait(8, 0);
                  yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
                  continue loop13;
                }
                yield* game.playSoundEffect(object, 0x20, 0xff, 3);
                yield* game.wait(1, 5);
                continue loop207;
              }
              yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x96 /* "Apartment 6" */, 0x78);
            }
          }
        } else {
          yield* game.playSoundEffect(object, 0x20, 0xff, 3);
          yield* game.wait(1, 5);
          yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
          continue loop13;
        }
      }
    }
  }
}

// Script 2AA: 6 arguments.
export function* script2AA(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
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
    yield* game.setObjectAnimation(object, 0);
    yield* game.stopMotion(object);
    yield* game.clearObjectVelocity(object);
    local17 = (yield* game.getObjectDirection(object)) & 0xff;
    local18 = 7;
    for (;;) {
      if (((yield* game.wait(0x801, 0x2d)) & 0x800) === 0) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local15 = t1 & 0xff;
        if (t1 === 0xffff) {
          local17 = word(local17 + 1) & 7 & 0xff;
          yield* game.setObjectAnimation(object, 0);
          yield* game.setObjectDirection(object, local17);
          local18 = word(local18 - 1) & 0xff;
        } else {
          yield* game.setObjectAnimation(object, 4);
          yield* game.shootAtObject(
            object,
            signed(local15),
            local25,
            local26,
            local27,
            signed(local28),
          );
          yield* game.playSoundEffect(object, 0x40, 0xff, 3);
          if (((yield* game.wait(0x808, 0)) & 0x800) !== 0) {
            return 0xffff;
          }
        }
        if (local18 === 0) {
          return 0;
        }
      } else {
        return 0xffff;
      }
    }
  }
  function* sub15() {
    local11 = shiftRight(local1, 8) & 0xff;
    local12 = local1 & 0xff;
    local13 = shiftRight(local3, 8) & 0xff;
    local14 = local3 & 0xff;
    local25 = shiftRight(local5, 8) & 0xff;
    local26 = local5 & 0xff;
    local27 = shiftRight(local7, 8) & 0xff;
    local28 = local7 & 0xff;
    local30 = local9 & 0xff;
    yield* game.setObjectRecordCount(object, shiftRight(local9, 8));
    if ((yield* game.getObjectRecordFlags(object)) === 0) {
      yield* game.setObjectRecordFlags(object, local30);
    }
    const t2 = (yield* game.randomByte()) & 3;
    local16 = t2 & 0xff;
    if (t2 !== 0) {
      if (local16 !== 1) {
        if (local16 !== 2) {
          if (local16 === 3) {
            local19 = local14 & 0xff;
          }
        } else {
          local19 = local13 & 0xff;
        }
      } else {
        local19 = local12 & 0xff;
      }
    } else {
      local19 = local11 & 0xff;
    }
    yield* game.placeObjectOnWaypoint(object, local19);
    local16 = word(local16 + 1) & 0xff;
    yield* game.appendToFightList(object);
    yield* game.setObjectArmour(object, 2);
    loop295: for (;;) {
      local20 = local19 & 0xff;
      if (local16 !== 0) {
        if (local16 !== 1) {
          if (local16 !== 2) {
            if (local16 !== 3) {
              if (local16 !== 4) {
                if (local16 !== 5) {
                  if (local16 !== 6) {
                    yield* game.getPlayerObjectAfterBreak(0);
                  } else {
                    local16 = 0;
                    local19 = local11 & 0xff;
                  }
                } else {
                  local19 = local12 & 0xff;
                }
              } else {
                local19 = local13 & 0xff;
              }
            } else {
              local19 = local14 & 0xff;
            }
          } else {
            local19 = local13 & 0xff;
          }
        } else {
          local19 = local12 & 0xff;
        }
      } else {
        local19 = local11 & 0xff;
      }
      local23 = 0;
      loop412: for (;;) {
        local23 = word(local23 + 1);
        if (local23 === 0xe) {
          if ((yield* sub18()) !== 0) {
            return;
          }
        }
        yield* game.setObjectAnimation(object, 2);
        if (!(local23 > 0xe && less(local23, 0x1c))) {
          yield* game.moveObjectToWaypoint(object, local19);
        } else {
          yield* game.moveObjectToWaypoint(object, local20);
        }
        const t3 = yield* game.wait(0x805, 0x1e);
        local21 = t3;
        if ((local21 & 0x800) === 0) {
          if ((local21 & 1) === 0) {
            local23 = 0;
            local16 = word(local16 + 1) & 0xff;
            if ((yield* sub18()) === 0) {
              continue loop295;
            }
            return;
          }
          local29 = 10;
          for (;;) {
            if (((yield* game.wait(0x801, 4)) & 0x800) === 0) {
              const t4 = yield* game.chooseEnemyTarget(object);
              local15 = t4 & 0xff;
              if (t4 !== 0xffff) {
                yield* game.clearObjectVelocity(object);
                yield* game.stopMotion(object);
                yield* game.setObjectAnimation(object, 4);
                yield* game.shootAtObject(
                  object,
                  signed(local15),
                  local25,
                  local26,
                  local27,
                  signed(local28),
                );
                yield* game.playSoundEffect(object, 0x40, 0xff, 3);
                if (((yield* game.wait(0x808, 0)) & 0x800) !== 0) {
                  return;
                }
              }
              const t5 = word(local29 - 1);
              local29 = word(local29 - 1) & 0xff;
              if (t5 === 0) {
                local29 = 10;
                if (((yield* game.wait(0x801, 0x3c)) & 0x800) !== 0) {
                  return;
                }
              }
              if (signed(local15) === 0xffff) {
                continue loop412;
              }
            } else {
              return;
            }
          }
        } else {
          return;
        }
      }
    }
  }
  object = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  local5 = arg3;
  local7 = arg4;
  local9 = arg5;
  yield* sub15();
  yield* game.fightListRemove(object);
  if ((yield* game.getObjectRecordFlags(object)) <= 1) {
    yield* run.dropNuyen164(yield* run.leaveBodyAndResetRecord(object));
  } else {
    yield* game.setObjectRecordFlags(object, word((yield* game.getObjectRecordFlags(object)) - 1));
    yield* run.dropNuyen164(yield* run.leaveBody(object));
  }
  yield* game.addKarma(5);
  return null;
}

// Script 2AB: 2 arguments, returns a word.
export function* script2AB(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  if (signed(local0) === 0) {
    local3 = yield* game.wait(0x90, 0);
  } else {
    local3 = yield* game.scriptAction(0x80 | local1);
  }
  return local3;
}

// Script 2AC: 1 argument.
export function* script2AC(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  object = arg0 & 0xff;
  yield* run.script089(object);
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(object)) & 0xff;
    const t1 = yield* run.script2AB(signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* run.promptUseOn();
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (local4 !== 0xffff) {
            if (
              (truth(local4 === 0x16c || local4 === 0x165 || local4 === 0x17a || local4 === 0x15e) |
                (truth(local4 === 0x173) &
                  (truth(((yield* game.getActorStateFlags(0xbad)) & 0x40) !== 0) ^ 0xffff))) ===
              0
            ) {
              if ((yield* game.getActorKind(local4)) !== 0x22) {
                yield* run.refuseToUseOn(local4);
              } else {
                yield* game.notice(
                  2,
                  0x16,
                  0x16,
                  3,
                  0x800,
                  0x1a /* "Video Phone not accessible!" */,
                  0xb4,
                );
              }
            } else {
              yield* game.setActorStateFlagBits(local4, 0x80);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.script04B();
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0x13, 3, 0x800, 0x8e /* "Universal Cash CredStick." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 2AD: 1 argument.
export function* script2AD(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script1AD(local0, 4, 0x4e, 0x6c, 0);
  return null;
}

// Script 2AE: 1 argument.
export function* script2AE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script07A(0xa00 | local0, 0x907, 0, 0x70c));
  return null;
}

// Script 2AF: 1 argument.
export function* script2AF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t2 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 0x10);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.setObjectDialog(object, 0x55);
  yield* run.script103(object);
  yield* game.setObjectActionAndDirection(object, 7, 7);
  const t4 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t5 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 0x10);
  const t6 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  yield* game.setObjectPosition(object, t6, t5, t4);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 2B0: 1 argument.
export function* script2B0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script0CA(local0, 0x97);
  return null;
}

// Script 2B1: 1 argument.
export function* script2B1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x11d);
    yield* run.script0AE(object);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 2B2: 1 argument.
export function* script2B2(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.releaseGlove();
  yield* game.stopTimer();
  yield* game.wait(1, 0x64);
  yield* game.notice(0xb, 4, 0xb, 3, 0x400, 0xee /* "Jake is dead." */, 0xf0);
  yield* game.wait(1, 0x190);
  yield* game.notice(0xc, 0x14, 9, 3, 0, 0xef /* "Game Over" */, 0x7d0);
  yield* game.wait(1, 0x190);
  yield* game.requestRoomReload();
  return null;
}

// Script 2B3: 1 argument.
export function* script2B3(state, arg0) {
  let object = 0,
    object2 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x60);
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 5);
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object2), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object2), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.addObjectHeight(object, 0x20);
  yield* game.playSoundEffect(object, 0x60, 0xff, 3);
  yield* game.wait(1, 2);
  const t4 = yield* game.chooseEnemyTarget(object);
  local2 = t4 & 0xff;
  if (t4 !== 0xffff) {
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(object, signed(local2)));
    if (less(yield* game.getDistanceToPlayer(object), 0x14)) {
      yield* game.shootAtObject(object, yield* game.chooseEnemyTarget(object), 3, 5, 3, 3);
    }
    yield* game.setObjectDirection(object, 5);
    yield* game.wait(1, 5);
  } else {
    yield* game.wait(1, yield* game.jumpObjectTowardsObject(object, yield* game.getPlayerObject()));
  }
  yield* game.removeObject(object);
  return null;
}

// Script 2B4: 1 argument.
export function* script2B4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  for (;;) {
    if (((yield* game.wait(0xa, 0)) & 2) !== 0) {
      yield* game.notice(0x14, 2, 6, 3, 0x400, 0x1c2 /* "What?" */, 0x64);
    }
    yield* game.setObjectAnimation(object, 0);
  }
}

// Script 2B5: 1 argument.
export function* script2B5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  for (;;) {
    yield* run.script2A3(object, 2, 4, 0, 0x2c, 0x2e);
    yield* run.script074(object, 0, 6, 2, 0x2e);
  }
}

// Script 2B6: 1 argument.
export function* script2B6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x56);
  yield* run.script22F(object);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 2B7: 1 argument.
export function* script2B7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script0CA(local0, 0x98);
  return null;
}

// Script 2B8: 1 argument.
export function* script2B8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, (yield* game.randomByte()) & 0x23b);
    yield* run.script0AE(object);
    yield* game.wait(8, 0);
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 2B9: 1 argument.
export function* script2B9(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((local1 & 0x80) === 0) {
      if ((local1 & 0x100) !== 0) {
        yield* game.endDialog();
        yield* game.wait(1, 1);
        yield* game.notice(
          2,
          0x15,
          0x15,
          3,
          0x800,
          0xa0 /* "I'll tack it onto my pocket..." */,
          0xf0,
        );
        yield* game.setActorStateFlagBits(0xb05, 2);
        yield* game.resetObjectRecordProperty(object);
      }
    } else {
      yield* game.notice(2, 0x15, 0x18, 3, 0x800, 0x9f /* "Lone Star Agent Number 8492BT" */, 0xf0);
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 2BA: 1 argument.
export function* script2BA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x57);
  yield* run.script22F(object);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 2BB: 1 argument.
export function* script2BB(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.giveArmour(local0, 5, 5);
  return null;
}

// Script 2BC: 6 arguments.
export function* script2BC(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0;
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  local2 = arg2 & 0xff;
  local3 = arg3 & 0xff;
  local4 = arg4 & 0xff;
  local5 = arg5;
  if (!((yield* game.getScriptVariable(0x2c)) !== 0 && local3 === 1)) {
    if (local3 !== 0) {
      local9 = 1;
    } else {
      local9 = 2;
    }
    block222: {
      local7 = (yield* game.getObjectRecordFlags(object)) & 7;
      yield* game.setObjectFlagBits(object, 0x100);
      yield* game.setObjectActionAndDirection(object, 0, 5);
      yield* game.wait(1, 1);
      if (
        (truth(local7 === (yield* game.getScriptVariable(local1))) &
          truth((yield* game.getScriptVariable(local2)) === local3) &
          (truth(((yield* game.getActorStateFlags(local5)) & local9) > 0) |
            truth(((yield* game.getObjectRecordFlags(object)) & 0x20) !== 0))) ===
        0
      ) {
        yield* game.setObjectAnimation(object, 2);
        for (;;) {
          yield* game.wait(1, 6);
          if (
            (truth(local7 === (yield* game.getScriptVariable(local1))) &
              truth((yield* game.getScriptVariable(local2)) === local3)) !==
            0
          ) {
            if (
              (truth(((yield* game.getActorStateFlags(local5)) & local9) > 0) |
                truth(((yield* game.getObjectRecordFlags(object)) & 0x20) !== 0)) !==
              0
            ) {
              yield* game.setObjectRecordFlagBits(object, 0x20);
              yield* game.setActorStateFlagBits(local5, local4);
              yield* game.playSoundEffect(object, 0x4e, 0xff, 3);
              yield* game.wait(1, 0x1e);
              yield* game.playSoundEffect(object, 0x4e, 0xff, 3);
              yield* game.setObjectAnimation(object, 4);
              yield* game.playSoundEffect(object, 0x3e, 0xff, 3);
              yield* game.wait(8, 0);
              break block222;
            }
          }
        }
      }
    }
    yield* game.setActorStateFlagBits(local5, local4);
    yield* game.setObjectAnimation(object, 0);
    yield* game.wait(1, 0xa);
    yield* game.keepObjectFlagBits(object, 0xfeff);
    yield* game.clearObjectTask(object);
    return null;
  }
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 2BD: 1 argument.
export function* script2BD(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x12);
  yield* run.script22F(object);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 2BE: 1 argument.
export function* script2BE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.playSoundEffect(object, 0x66, 0xff, 3);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.wait(8, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 2BF: 1 argument.
export function* script2BF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectActionAndDirection(object, 1, 7);
  yield* run.nothing(object, 0x7a, 0x37a);
  return null;
}
