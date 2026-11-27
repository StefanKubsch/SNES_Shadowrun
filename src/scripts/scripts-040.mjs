// Scripts 040 to 05F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 040: 1 argument.
export function* script040(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1bc, yield* script(0x27c, 0x500 | local0, 0x304, 0, 0x403, 0x903));
  return null;
}

// Script 041: 1 argument.
export function* script041(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x00a, local0, 0x22, 0x26, 0x80, 0x16c0);
  return null;
}

// Script 042: 1 argument.
export function* script042(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectStraightToWaypoint(local0, 1);
  yield* game.wait(4, 0);
  yield* game.setObjectActionAndDirection(local0, 0, 3);
  yield* game.wait(1, 5);
  yield* game.setObjectActionAndDirection(local0, 7, 3);
  yield* game.wait(1, 0x14);
  yield* game.notice(2, 2, 0x1a, 3, 0x400, 0xf0, 0xf0);
  yield* game.wait(1, 0xc8);
  yield* game.setObjectActionAndDirection(local0, 0, 3);
  yield* game.wait(1, 5);
  yield* game.setObjectAnimation(local0, 1);
  yield* game.moveObjectStraightToWaypoint(local0, 0);
  yield* game.wait(4, 0);
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* game.wait(1, 5);
  yield* game.setObjectActionAndDirection(local0, 7, 7);
  yield* game.wait(1, 0x64);
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* game.wait(1, 5);
  yield* game.setObjectActionAndDirection(local0, 1, 4);
  yield* game.setObjectVelocity(local0, 0, 0xfffe, 0);
  yield* game.wait(1, 0x14);
  yield* game.clearObjectVelocity(local0);
  yield* game.setObjectAnimation(local0, 0);
  yield* game.turnObjectToPlayer(local0);
  state.setWord('COLOUR_REQUEST', 0, 1);
  yield* game.notice(6, 5, 0x15, 3, 0x400, 0x25c, 0x270f);
  yield* game.wait(1, 0xf0);
  yield* game.notice(4, 0xa, 0x19, 3, 0x800, 0x25d, 0x270f);
  yield* game.wait(1, 0xf0);
  yield* game.notice(5, 0x14, 0x16, 3, 0, 0x25e, 0x270f);
  yield* game.wait(1, 0x190);
  yield* game.requestMainLoopExit();
  return null;
}

// Script 043: 1 argument.
export function* script043(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.setObjectDialog(local0, 0x59);
  yield* script(0x0ae, local0);
  yield* script(0x36d, local0, 0x3c, 0xc8, 0x3c);
  yield* script(0x35d, local0);
  return null;
}

// Script 044: 1 argument.
export function* script044(state, arg0) {
  let local0 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0;
  function* sub5() {
    local3 = yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy());
    local5 = yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy());
  }
  function* sub18(in0, in1, in2) {
    local12 = in0 & 0xff;
    local13 = in1 & 0xff;
    local14 = in2 & 0xff;
    local7 = word(local3 + signed(local12));
    local9 = word(local5 + signed(local13));
    if (local7 <= 0x262) {
      if (!less(local7, 0x19a)) {
        if (local9 <= 0x21c) {
          if (less(local9, 0x118)) {
            local9 = 0x118;
          }
        } else {
          local9 = 0x21c;
        }
      } else {
        local7 = 0x19a;
      }
    } else {
      local7 = 0x262;
    }
    yield* game.createObject(0x100, local7, local9, 0x40, 0x210);
    yield* game.wait(1, local14);
  }
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  const t1 = yield* game.randomBelow(6);
  local11 = t1 & 0xff;
  if (t1 !== 0) {
    if (local11 !== 1) {
      if (local11 !== 2) {
        if (local11 !== 3) {
          if (local11 !== 4) {
            if (local11 === 5) {
              yield* sub5();
              yield* sub18(0, 0xfff6, 0x28);
              yield* sub5();
              yield* sub18(0, 0xa, 0x28);
              yield* sub5();
              yield* sub18(0, 0xfff6, 0x28);
              yield* sub5();
              yield* sub18(0xfff6, 0, 0x28);
              yield* sub5();
              yield* sub18(0xa, 0, 0x28);
              yield* sub5();
              yield* sub18(0xfff6, 0, 0x28);
            }
          } else {
            yield* sub5();
            yield* sub18(0, 0xffd8, 0x28);
            yield* sub5();
            yield* sub18(0xffec, 0xffec, 0x28);
            yield* sub5();
            yield* sub18(0xffe8, 0, 0x28);
            yield* sub5();
            yield* sub18(0xffec, 0x10, 0x28);
            yield* sub5();
            yield* sub18(0xfff6, 0x1c, 0x28);
            yield* sub5();
            yield* sub18(0xa, 0x1c, 0x28);
            yield* sub5();
            yield* sub18(0x10, 0xc, 0x28);
          }
        } else {
          yield* sub5();
          yield* sub18(0, 0xffc4, 1);
          yield* sub18(0, 0x3c, 0x3c);
          yield* sub5();
          yield* sub18(0xffd8, 0, 1);
          yield* sub18(0x28, 0, 0x3c);
          yield* sub5();
          yield* sub18(0, 0xffec, 1);
          yield* sub18(0, 0x14, 0x3c);
          yield* sub5();
          yield* sub18(0, 0, 1);
        }
      } else {
        yield* sub5();
        yield* sub18(0xffc4, 0, 1);
        yield* sub18(0x3c, 0, 0x3c);
        yield* sub5();
        yield* sub18(0, 0xffd8, 1);
        yield* sub18(0, 0x28, 0x3c);
        yield* sub5();
        yield* sub18(0xffec, 0, 1);
        yield* sub18(0x14, 0, 0x3c);
        yield* sub5();
        yield* sub18(0, 0, 1);
      }
    } else {
      yield* sub5();
      yield* sub18(0xffe2, 0, 0x28);
      yield* sub18(0x1e, 0, 0x28);
      yield* sub18(0, 0x1e, 0x28);
      yield* sub18(0, 0xffe2, 0x28);
    }
  } else {
    yield* sub5();
    yield* sub18(0xffec, 0, 0x14);
    yield* sub18(0x14, 0, 0x5a);
    yield* sub5();
    yield* sub18(0, 0xffec, 0x14);
    yield* sub18(0, 0x14, 0x14);
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 045: 2 arguments.
export function* script045(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.setObjectAnimation(local0, 0);
  for (;;) {
    const t1 = yield* game.chooseRandomFightTarget(local0);
    local2 = t1 & 0xff;
    if (t1 === 0xffff) {
      yield* game.wait(1, 0x3c);
    } else {
      yield* game.setObjectAnimation(local0, 5);
      yield* game.shootWithOwnWeapon(local0, signed(local2));
      yield* game.playSoundEffect(local0, 0xc, 0xff, 0xff);
      yield* game.wait(1, 0x1e);
    }
    const t2 = word(local1 - 1);
    local1 = word(local1 - 1) & 0xff;
    if (t2 === 0) {
      return null;
    }
  }
}

// Script 046: no arguments.
export function* script046(state) {
  const t1 = yield* script(0x03f, 0x7d0, 0x708, 0x5dc);
  const t2 = yield* script(0x0b2, 0x17a, 0x17b, 0x17c);
  yield* script(0x162, 0x1458, t2, t1, 0x179, 0x178);
  return null;
}

// Script 047: 1 argument.
export function* script047(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 1);
  }
}

// Script 048: 1 argument.
export function* script048(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f2, local0, 0, 3, 3, 0);
  return null;
}

// Script 049: 1 argument.
export function* script049(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.wait(1, 0x140);
  yield* game.setObjectActionAndDirection(local0, 6, 0);
  yield* game.wait(1, 0xaf);
  yield* game.keepObjectFlagBits(local0, 0xffdf);
  yield* game.setObjectVelocity(local0, 0, 0, 2);
  yield* game.wait(1, 0xa);
  yield* game.setObjectVelocity(local0, 0, 0, 0);
  yield* game.releaseObjectGraphics(local0);
  return null;
}

// Script 04A: 1 argument.
export function* script04A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x3c);
  yield* game.turnObjectToPlayer(local0);
  yield* game.wait(1, 0x3c);
  yield* script(0x371, local0, 1, 2, 2, 0x28, 6, 0, 2);
  return null;
}

// Script 04B: no arguments.
export function* script04B(state) {
  yield* game.wait(1, 5);
  yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
  return null;
}

// Script 04C: 4 arguments.
export function* script04C(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0;
  block75: {
    local0 = arg0 & 0xff;
    local1 = arg1;
    local3 = arg2 & 0xff;
    local4 = arg3;
    yield* game.keepObjectFlagBits(local0, 0xfeff);
    yield* game.setObjectActionAndDirection(local0, 2, 5);
    if (((yield* game.getActorStateFlags(0x7fc)) & 4) === 0) {
      for (;;) {
        if (((yield* game.wait(0x201, 1)) & 0x200) !== 0) {
          yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x89, 0xf0);
        }
        if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
          break block75;
        }
      }
    }
  }
  loop75: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    yield* game.wait(0x200, 0);
    yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
    yield* game.setObjectAnimation(local0, 4);
    yield* game.wait(8, 0);
    yield* game.setObjectAnimation(local0, 0);
    for (;;) {
      if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
        yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(local0, 6);
        yield* game.wait(8, 0);
        continue loop75;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
        yield* game.notice(2, 0x14, 0x1c, local3, 0x800, local1, 0xb4);
        yield* game.setActorStateFlagBits(local4, 0x80);
        yield* game.setObjectRecordFlagBits(local0, 0x40);
      } else {
        yield* game.notice(2, 0x15, 0x16, 3, 0x800, 0x8a, 0xb4);
      }
    }
  }
}

// Script 04D: no arguments.
export function* script04D(state) {
  if (((yield* game.getActorStateFlags(0xb05)) & 1) === 0) {
    yield* game.topicText(0xb8);
    if ((yield* game.question(0x18, 9)) === 0) {
      yield* game.topicText(0xb9);
    } else {
      if ((yield* game.payNuyen(0x96)) === 0) {
        yield* game.topicText(0xba);
      } else {
        yield* game.topicText(0xb7);
        yield* game.setActorStateFlagBits(0xb05, 1);
        yield* game.setActorStateHolder(0xb05, 0x8b2);
      }
    }
  } else {
    yield* game.topicText(0xb7);
  }
  return null;
}

// Script 04E: 1 argument.
export function* script04E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, word(((yield* game.randomByte()) & 0xf) + 0xa));
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 1);
  yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
  yield* game.wait(1, 0x3c);
  yield* game.turnObjectToPlayer(local0);
  yield* game.appendToFightList(local0);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local2 = t1 & 0xff;
    if (t1 === 0xffff) {
      local1 = truth(((yield* game.wait(0x801, 0x28)) & 0x800) !== 0) & 0xff;
    } else {
      local1 = (yield* script(0x235, local0, signed(local2), 1, 0, 4, 0, 0x3c)) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(9);
      yield* game.fightListRemove(local0);
      yield* game.setObjectDirection(local0, 0);
      yield* script(0x1ba, yield* script(0x35d, local0));
      yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
      return null;
    }
  }
}

// Script 04F: 1 argument.
export function* script04F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getActorStateFlags(0xd6d)) & 1) !== 0) {
      yield* game.wait(1, word(((yield* game.randomByte()) & 7) + 1));
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.wait(8, 0);
      yield* game.setObjectActionAndDirection(local0, 0, 5);
      yield* game.wait(8, 0);
      yield* game.releaseObjectGraphics(local0);
      for (;;) {
        yield* game.wait(1, 1);
        if (((yield* game.getActorStateFlags(0xd6d)) & 2) !== 0) {
          yield* game.wait(1, word(((yield* game.randomByte()) & 7) + 1));
          yield* game.setObjectVelocity(local0, 0, 0, 3);
          yield* game.setObjectActionAndDirection(local0, 0, 5);
          yield* game.wait(8, 0);
          yield* game.wait(1, 0x50);
          yield* game.removeObject(local0);
          return null;
        }
      }
    }
  }
}

// Script 050: 1 argument.
export function* script050(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x1458)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0x1458, 1, 0x78, 0x2000);
    yield* game.notice(0xd, 3, 0xd, 3, 0x400, 0x190, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(5, 0, 0, 0, 0, 0x1458, 0x28);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 051: 1 argument.
export function* script051(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectActionAndDirection(local0, 0, 5);
  } else {
    yield* game.setObjectActionAndDirection(local0, 0, 1);
  }
  for (;;) {
    if (((yield* game.wait(0x180, 0)) & 0x100) === 0) {
      yield* game.notice(4, 0x15, 0x19, 3, 0x800, 0x1f7, 0xc8);
    } else {
      block240: {
        if (((yield* game.getActorStateFlags(0x27d)) & 1) === 0) {
          yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
          if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
            yield* game.setObjectDirection(local0, 1);
            yield* game.notice(7, 3, 0x10, 3, 0, 0x208, 0x64);
            yield* game.wait(1, 0x78);
            yield* game.setObjectRecordFlagBits(local0, 1);
            yield* game.notice(8, 3, 0x10, 4, 0, 0x20a, 0xc8);
            if (((yield* game.getActorStateFlags(0x63c)) & 0x40) === 0) {
              local1 = 4;
              for (;;) {
                yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
                yield* game.wait(1, 8);
                local1 = word(local1 - 1);
                if (local1 === 0) {
                  yield* game.setActorStateFlagBits(0x63c, 0x40);
                  break block240;
                }
              }
            }
          } else {
            yield* game.notice(7, 3, 0x10, 3, 0, 0x209, 0x64);
            yield* game.wait(1, 0x78);
            yield* game.notice(8, 3, 0x12, 3, 0, 0x20b, 0xc8);
            yield* game.keepObjectRecordFlagBits(local0, 0);
            yield* game.setObjectDirection(local0, 5);
          }
        } else {
          yield* game.notice(3, 3, 0x1b, 3, 0, 0x236, 0xc8);
        }
      }
    }
  }
}

// Script 052: 1 argument.
export function* script052(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseY(local0);
  const t2 = yield* game.getObjectCoarseX(local0);
  yield* script(0x195, local0, t2, t1, 0, 5, 0x14);
  return null;
}

// Script 053: 1 argument.
export function* script053(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    block135: {
      yield* game.wait(1, 1);
      if (((yield* game.getActorStateFlags(0x1cbd)) & 1) !== 0) {
        yield* game.setObjectDirection(local0, 4);
        yield* game.setObjectAnimation(local0, 2);
        yield* game.setObjectRecordFlags(local0, 1);
        yield* game.setObjectFlags(local0, 0);
        yield* game.keepObjectFlagBits(local0, 0xdfff);
        yield* game.setObjectVelocity(local0, 0, 0xfff9, 0);
        yield* game.wait(1, 0x32);
        yield* game.clearObjectVelocity(local0);
        local1 = 3;
        for (;;) {
          yield* game.setObjectAnimation(local0, 4);
          yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
          yield* game.wait(1, 0x14);
          const t1 = word(local1 - 1);
          local1 = word(local1 - 1) & 0xff;
          if (t1 === 0) {
            yield* game.setObjectActionAndDirection(local0, 2, 0);
            yield* game.setObjectVelocity(local0, 0, 7, 0);
            yield* game.wait(1, 0x7d);
            yield* game.clearObjectVelocity(local0);
            break block135;
          }
        }
      }
    }
    yield* game.removeObject(local0);
    return null;
  }
  yield* game.resetObjectRecordProperty(local0);
  return null;
}

// Script 054: 1 argument.
export function* script054(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x31f, local0, 1);
  return null;
}

// Script 055: 1 argument.
export function* script055(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0xbe;
  for (;;) {
    yield* game.advanceOrbitSlot1(local0);
    yield* game.wait(1, 1);
    local1 = word(local1 - 1);
    if (local1 === 0 || state.word('CIRCLE_LEADER_ALIVE') === 0) {
      if (state.word('CIRCLE_LEADER_ALIVE') !== 0) {
        yield* script(0x275, local0, 0, 0xb75);
      } else {
        yield* game.setObjectVelocity(local0, 0, 0, 8);
        yield* game.wait(1, 0x3c);
        yield* game.removeObject(local0);
      }
      return null;
    }
  }
}

// Script 056: no arguments.
export function* script056(state) {
  return null;
}

// Script 057: 1 argument.
export function* script057(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((local1 & 0x80) === 0) {
      if ((local1 & 0x100) !== 0) {
        yield* script(0x0f9);
        const t2 = yield* game.chooseNumber();
        local3 = t2;
        if (local3 !== 0xffff) {
          if (local3 !== 0x188) {
            yield* script(0x085, local3);
          } else {
            yield* game.endDialog();
            if (((yield* game.getActorStateFlags(0x188)) & 0x80) === 0) {
              yield* game.notice(2, 0x15, 0x15, 3, 0x800, 0x1bc, 0xb4);
            } else {
              if (((yield* game.getActorStateFlags(local3)) & 2) === 0) {
                if (((yield* game.getActorStateFlags(local3)) & 1) === 0) {
                  yield* game.setActorStateFlagBits(local3, 1);
                } else {
                  yield* game.setActorStateFlagBits(local3, 2);
                }
              } else {
                yield* game.setActorStateFlagBits(local3, 4);
              }
            }
          }
        }
      }
    } else {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x10b, 0xf0);
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 058: 1 argument.
export function* script058(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    yield* game.setObjectFlagBits(local0, 0x20);
    yield* script(0x245, local0);
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
      }
    } else {
      if (
        (truth((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(3))) &
          truth((yield* game.getObjectDirection(yield* game.getPlayerObjectCopy())) === 0) &
          truth((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) === 0x225) &
          truth((yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy())) === 0x1f1) &
          (truth(((yield* game.getObjectRecordFlags(local0)) & 4) !== 0) ^ 0xffff)) ===
        0
      ) {
        yield* game.setObjectRecordFlagBits(local0, 4);
      } else {
        yield* game.endDialog();
        yield* game.setScriptVariable(0x2c, 2);
        yield* game.changeRoom(0x18b);
        yield* game.wait(1, 1);
      }
      yield* game.notice(2, 0x15, 0x19, 3, 0x800, 0x87, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 059: 1 argument.
export function* script059(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x089, local0);
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x40);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x40) {
          yield* script(0x240);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (local4 !== 0xffff) {
            if (local4 !== 0x185d) {
              yield* script(0x1b1, local4);
            } else {
              yield* game.setItemPropertyAndUnequip(local0, local4);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x80, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 05A: 1 argument.
export function* script05A(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x226;
  for (;;) {
    yield* game.advanceOrbitSlot2(local0);
    yield* game.wait(1, 1);
    local1 = word(local1 - 1);
    if (local1 === 0 || state.word('CIRCLE_LEADER_ALIVE') === 0) {
      if (state.word('CIRCLE_LEADER_ALIVE') !== 0) {
        yield* script(0x275, local0, 1, 0xb75);
      } else {
        yield* game.setObjectVelocity(local0, 0, 0, 8);
        yield* game.wait(1, 0x3c);
        yield* game.removeObject(local0);
      }
      return null;
    }
  }
}

// Script 05B: 1 argument.
export function* script05B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  block200: {
    local0 = arg0 & 0xff;
    yield* game.setSpriteMode(local0, 0);
    yield* game.setObjectFlagBits(local0, 0x140);
    local2 = 1;
    if ((yield* script(0x07e, 4)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectRecordCount(local0, word((yield* game.randomBelow(3)) + 5));
      yield* game.setObjectActionAndDirection(local0, 0, (yield* game.randomByte()) & 7 & 0xfffe);
      yield* game.wait(1, 0x1e);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local1 = t1 & 0xff;
        if (t1 !== 0xffff) {
          if (local2 !== 0) {
            yield* game.appendToFightList(local0);
            local2 = 0;
          }
          yield* game.setObjectAnimation(local0, 4);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(local0, 5);
          yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
          yield* game.shootAtObject(local0, signed(local1), 2, 0, 5, 0);
          yield* game.wait(8, 0);
          yield* game.setObjectAnimation(local0, 6);
          local4 =
            truth(
              ((yield* game.wait(0x801, word(((yield* game.randomByte()) & 0x3f) + 0x50))) &
                0x800) !==
                0,
            ) & 0xff;
        } else {
          yield* game.turnObjectToObject(local0, signed(local1));
          local4 =
            truth(
              ((yield* game.wait(0x801, word(0x3c + ((yield* game.randomByte()) & 0x1f)))) &
                0x800) !==
                0,
            ) & 0xff;
        }
        if (signed(local4) !== 0) {
          yield* game.addKarma(2);
          yield* game.fightListRemove(local0);
          yield* script(0x1b4, yield* script(0x068, local0));
          break block200;
        }
      }
    }
  }
  return null;
}

// Script 05C: 1 argument.
export function* script05C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f2, local0, 2, 3, 2, 1);
  return null;
}

// Script 05D: 1 argument.
export function* script05D(state, arg0) {
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
      }
    } else {
      yield* game.notice(1, 0x15, 0x1d, 3, 0x800, 0x205, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 05E: 1 argument.
export function* script05E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x4d);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  local1 = 0;
  for (;;) {
    yield* game.wait(3, word(0x64 + ((yield* game.randomByte()) & 0xff)));
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectVelocity(local0, 0, 0, 7);
      yield* game.wait(3, 0x14);
      yield* game.setObjectVelocity(local0, 0, 0, 8);
      yield* game.wait(3, 0x46);
    } else {
      const t1 = truth(((yield* game.randomByte()) & 1) !== 0);
      local3 = t1 & 0xff;
      if ((t1 & truth(less(local1, 3))) === 0) {
        if (local1 !== 0) {
          yield* game.setObjectVelocity(local0, 0xfffe, 0, 0);
          local1 = word(local1 - 1);
        }
      } else {
        yield* game.setObjectVelocity(local0, 2, 0, 0);
        local1 = word(local1 + 1);
      }
      yield* game.wait(3, 0x28);
      yield* game.clearObjectVelocity(local0);
    }
  }
}

// Script 05F: 1 argument.
export function* script05F(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 5, 0);
  yield* game.setSpriteMode(local0, 0x8001);
  local1 = 0x118;
  for (;;) {
    yield* game.advanceOrbitSlot3(local0);
    yield* game.wait(1, 1);
    local1 = word(local1 - 1);
    if (local1 === 0 || state.word('CIRCLE_LEADER_ALIVE') === 0) {
      if (state.word('CIRCLE_LEADER_ALIVE') !== 0) {
        yield* script(0x275, local0, 2, 0xb75);
      } else {
        yield* game.setObjectVelocity(local0, 0, 0, 8);
        yield* game.wait(1, 0x3c);
        yield* game.removeObject(local0);
      }
      return null;
    }
  }
}
