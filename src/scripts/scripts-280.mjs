// Scripts 280 to 29F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 280: 1 argument.
export function* script280(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectFlagBits(local0, 0x100);
  local2 = (yield* game.randomByte()) & 1;
  const t1 = truth(((yield* game.randomByte()) & 1) !== 0);
  local1 = t1 & 0xff;
  if (t1 === 0) {
    if ((local2 & 1) === 0) {
      yield* game.placeObjectOnWaypoint(local0, 2);
    } else {
      yield* game.placeObjectOnWaypoint(local0, 0);
    }
    yield* game.setObjectActionAndDirection(local0, 0, 6);
    local4 = 0xfff6;
  } else {
    if ((local2 & 1) === 0) {
      yield* game.placeObjectOnWaypoint(local0, 3);
    } else {
      yield* game.placeObjectOnWaypoint(local0, 1);
    }
    yield* game.setObjectActionAndDirection(local0, 0, 2);
    local4 = 0xa;
  }
  yield* game.setObjectVelocity(local0, local4, 0, 0);
  for (;;) {
    yield* game.blast(local0, 0xa);
    yield* game.wait(1, 0x10);
    if (
      (truth((yield* game.getObjectCoarseX(local0)) > 0x2bc) |
        truth(less(yield* game.getObjectCoarseX(local0), 0x50))) !==
      0
    ) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 281: 1 argument.
export function* script281(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x500 | local0, 0x506, 0, 0x70c));
  return null;
}

// Script 282: 1 argument.
export function* script282(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, yield* game.randomBelow(7), 7);
  return null;
}

// Script 283: 1 argument.
export function* script283(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 5);
  for (;;) {
    yield* game.wait(0x80, 0);
    yield* script(0x38e);
  }
}

// Script 284: 1 argument.
export function* script284(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 3);
  yield* game.setObjectAnimation(local0, 0);
  local1 = yield* game.getScriptVariable(8);
  yield* game.wait(1, local0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectFlagBits(local0, 0x2040);
  for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(local0, t2, t1, 0x10);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 285: no arguments.
export function* script285(state) {
  yield* game.setActorStateFlagBits(0x1c0e, 2);
  return null;
}

// Script 286: 1 argument.
export function* script286(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
    yield* game.wait(1, 0x23);
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) !== 0) {
      yield* script(0x25b, local0, 0x3e8, 0x217, 2);
    }
    if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
      yield* script(0x0d1, 0x15a8);
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
  }
  yield* script(0x0ae, local0);
  yield* script(0x342, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0, 0xac, 0, 1);
  return null;
}

// Script 287: 1 argument.
export function* script287(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 6, 4, 1, 1);
  return null;
}

// Script 288: 1 argument.
export function* script288(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 4);
  yield* game.setObjectAnimation(local0, 0);
  local1 = yield* game.getScriptVariable(8);
  yield* game.wait(1, local0);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.setObjectFlagBits(local0, 0x2040);
  for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
      const t1 = word(3 - (yield* game.randomByte())) & 7;
      const t2 = word(3 - (yield* game.randomByte())) & 7;
      yield* game.setObjectVelocity(local0, t2, t1, 0x10);
      yield* game.setObjectFlagBits(local0, 0x20);
      yield* game.wait(1, 0x1e);
      yield* game.setObjectActionAndDirection(local0, 7, 0);
      yield* game.wait(8, 0);
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 289: 1 argument.
export function* script289(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 3);
  yield* script(0x2a6, local0, 4, 1, 0);
  return null;
}

// Script 28A: 1 argument.
export function* script28A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 3);
  yield* script(0x2a6, local0, 4, 1, 0);
  return null;
}

// Script 28B: 1 argument.
export function* script28B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x35c);
  yield* script(0x3a4, local0, 0);
  yield* script(0x3a4, local0, 1);
  yield* script(0x045, local0, 3);
  yield* game.notice(2, 2, 0x1c, 3, 0x400, 0xfb, 0xf0);
  yield* script(0x3a4, local0, 2);
  yield* script(0x045, local0, 8);
  yield* script(0x08b, 0xef);
  return null;
}

// Script 28C: 4 arguments.
export function* script28C(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  local5 = arg3 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.wait(0x80, 0);
  yield* game.addNuyen(local3);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* game.addKarma(local5);
  yield* script(0x04b);
  yield* game.notice(2, 2, 0x1c, 3, 0, local1, 0x190);
  return null;
}

// Script 28D: 5 arguments.
export function* script28D(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0;
  function* sub13() {
    yield* game.notice(9, 0x14, 0x15, 4, 0x800, local1, 0xf0);
  }
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  local5 = arg3;
  local7 = arg4 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  for (;;) {
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      if (((yield* game.getActorStateFlags(local5)) & 1) === 0) {
        if (((yield* game.wait(0xa0, 0)) & 0x80) === 0) {
          yield* game.releaseNoticeWindows();
          yield* game.wait(1, 2);
          yield* game.notice(2, 2, 0x15, 4, 0x400, local1, 0xf0);
          yield* game.notice(0x15, 5, 6, 3, 0, 0x15, 1);
          if ((yield* game.question(0x17, 7)) !== 0) {
            if ((yield* game.payNuyen(local3)) === 0) {
              yield* game.releaseNoticeWindows();
              yield* game.wait(1, 2);
              yield* game.notice(6, 6, 0x10, 3, 0x400, 2, 0xf0);
            } else {
              if (less(yield* game.getActorStateCount(local5), 6)) {
                if (signed(local7) === 0) {
                  yield* game.setObjectRecordFlagBits(local0, 1);
                } else {
                  yield* game.addActorStateCount(local5, 1);
                }
                yield* game.setActorStateHolder(local5, 0x8b2);
                yield* game.releaseNoticeWindows();
                yield* script(0x04b);
              } else {
                yield* game.releaseNoticeWindows();
                yield* game.wait(1, 2);
                yield* game.notice(2, 6, 0x1c, 3, 0, 0x25, 0x78);
                yield* game.addNuyen(local3);
              }
            }
          }
        } else {
          yield* game.releaseNoticeWindows();
          yield* game.wait(1, 2);
          yield* sub13();
          yield* game.notice(2, 0x12, 0xe, 3, 0, 0xff, 0xf0);
        }
      } else {
        yield* game.setObjectFlagBits(local0, 0x80);
        yield* game.wait(0x80, 0);
        yield* game.releaseNoticeWindows();
        yield* game.wait(1, 2);
        yield* sub13();
        yield* game.notice(2, 0x12, 0xc, 3, 0, 0x100, 0xf0);
      }
    } else {
      if ((yield* game.getActorStateProperty(local5)) !== 0xbad) {
        yield* game.setObjectFlagBits(local0, 0x80);
        yield* game.wait(0x80, 0);
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0xfe, 0x78);
      } else {
        yield* game.keepObjectRecordFlagBits(local0, 0xfffe);
      }
    }
  }
}

// Script 28E: 1 argument.
export function* script28E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectRecordCount(local0, 0xf);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, word(0x3c + ((yield* game.randomByte()) & 0x1f)));
  local1 = 0;
  yield* game.appendToFightList(local0);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      local1 = (yield* script(0x235, local0, signed(local2), 1, 0, 4, 1, 0x32)) & 0xff;
    } else {
      yield* game.turnObjectToObject(local0, signed(local2));
      local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(6);
      yield* game.fightListRemove(local0);
      return null;
    }
  }
}

// Script 28F: 1 argument.
export function* script28F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x700 | local0, 0x506, 0, 0x70c));
  return null;
}

// Script 290: 1 argument.
export function* script290(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* script(0x2a6, local0, 5, 2, 0xffff);
  return null;
}

// Script 291: 1 argument.
export function* script291(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* script(0x2a6, local0, 5, 2, 0xffff);
  return null;
}

// Script 292: 1 argument.
export function* script292(state, arg0) {
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
          if (local3 !== 0x12d) {
            if (local3 !== 0x222) {
              yield* script(0x085, local3);
            } else {
              if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
                yield* game.wait(1, 1);
                yield* game.setActorStateFlagBits(local3, 0x80);
                yield* game.setObjectRecordFlagBits(local0, 2);
                yield* script(0x04b);
              } else {
                yield* game.notice(2, 0x15, 0x1d, 3, 0, 0x109, 0xf0);
              }
            }
          } else {
            if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
              yield* game.wait(1, 1);
              yield* game.setActorStateFlagBits(local3, 0x80);
              yield* game.setObjectRecordFlagBits(local0, 1);
              yield* script(0x04b);
            } else {
              yield* game.notice(4, 0x15, 0x18, 3, 0, 0x107, 0xf0);
            }
          }
        }
      }
    } else {
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.notice(7, 0x13, 0x13, 3, 0x800, 0x106, 0xf0);
      } else {
        yield* game.notice(4, 0x13, 0x18, 3, 0x800, 0x107, 0xf0);
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 2) === 0) {
        yield* game.notice(5, 0x15, 0x15, 3, 0x800, 0x108, 0xf0);
      } else {
        yield* game.notice(2, 0x15, 0x1d, 3, 0x800, 0x109, 0xf0);
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 293: 1 argument.
export function* script293(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x321, local0, 1, 1);
  return null;
}

// Script 294: 1 argument.
export function* script294(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    yield* script(0x0ae, local0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t1 = yield* script(0x2ab, signed(local1), 0x100);
    local2 = t1;
    if (local2 !== 0x80) {
      if (local2 !== 0x10) {
        if (local2 === 0x100) {
          yield* script(0x0f9);
          const t2 = yield* game.chooseNumber();
          local4 = t2;
          if (local4 !== 0xffff) {
            if (local4 !== 7) {
              yield* script(0x0ff, local4);
            } else {
              yield* game.setActorStateFlagBits(local4, 0x80);
            }
          }
        }
      } else {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
      }
    } else {
      yield* game.notice(2, 0x14, 0x11, 4, 0x800, 0x90, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 295: 1 argument.
export function* script295(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x800 | local0, 0x607, 0, 0x70c));
  return null;
}

// Script 296: 1 argument.
export function* script296(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  for (;;) {
    if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
    } else {
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x91, 0x78);
    }
  }
}

// Script 297: 1 argument.
export function* script297(state, arg0) {
  let local0 = 0;
  function* sub5() {
    yield* game.notice(2, 0x15, 0x14, 3, 0x800, 0x10a, 0xf0);
    yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
  }
  local0 = arg0 & 0xff;
  block85: {
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      for (;;) {
        if (((yield* game.wait(0x90, 0)) & 0x10) !== 0) {
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          break block85;
        }
        yield* sub5();
      }
    } else {
      if (((yield* game.scriptAction(0x80)) & 0x80) !== 0) {
        yield* sub5();
      }
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 298: 1 argument.
export function* script298(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x800 | local0, 0x607, 0, 0x70c));
  return null;
}

// Script 299: 1 argument.
export function* script299(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  for (;;) {
    if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
    } else {
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x92, 0x78);
    }
  }
}

// Script 29A: no arguments.
export function* script29A(state) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  function* sub3(in0, in1) {
    local2 = in0;
    local4 = in1;
    yield* game.addNuyen(local2);
    yield* game.topicText(0xd2);
    yield* game.windowText(local4);
    yield* game.windowText(0xd3);
  }
  const t1 = yield* game.getScriptVariable(4);
  local0 = t1;
  if (local0 !== 0) {
    if (local0 !== 1) {
      if (local0 !== 2) {
        if (local0 !== 3) {
          if (local0 !== 4) {
            if (local0 !== 5) {
              if (local0 !== 6) {
                if (local0 !== 7) {
                  if (local0 !== 8) {
                    if (local0 === 9) {
                      yield* sub3(0x1f40, 0xdd);
                      yield* game.setActorStateFlagBits(0x1b66, 0x80);
                    }
                  } else {
                    yield* sub3(0x1b58, 0xdc);
                  }
                } else {
                  yield* sub3(0x1770, 0xdb);
                }
              } else {
                yield* sub3(0x1388, 0xda);
              }
            } else {
              yield* sub3(0xfa0, 0xd9);
            }
          } else {
            yield* sub3(0xbb8, 0xd8);
          }
        } else {
          yield* sub3(0x7d0, 0xd7);
        }
      } else {
        yield* sub3(0x3e8, 0xd6);
      }
    } else {
      yield* sub3(0x2bc, 0xd5);
    }
  } else {
    yield* sub3(0x12c, 0xd4);
  }
  yield* game.setScriptVariable(4, word((yield* game.getScriptVariable(4)) + 1));
  return null;
}

// Script 29B: 1 argument.
export function* script29B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 0, 6, 2, 3);
  return null;
}

// Script 29C: 1 argument.
export function* script29C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x140);
  yield* game.setObjectArmour(local0, 4);
  yield* game.setObjectRecordCount(local0, 0x1e);
  yield* game.setObjectActionAndDirection(local0, 4, 0);
  yield* game.appendToFightList(local0);
  for (;;) {
    const t1 = yield* game.chooseEnemyTarget(local0);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      local1 = (yield* script(0x221, local0)) & 0xff;
    } else {
      yield* game.turnObjectToObject(local0, signed(local2));
      local1 =
        truth(
          ((yield* game.wait(0x801, word(0xa + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !==
            0,
        ) & 0xff;
    }
    if (signed(local1) !== 0) {
      yield* game.addKarma(0xb);
      yield* game.fightListRemove(local0);
      yield* script(0x1bc, yield* script(0x35d, local0));
      return null;
    }
  }
}

// Script 29D: 1 argument.
export function* script29D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x07a, 0x400 | local0, 0x304, 0, 0x70c));
  return null;
}

// Script 29E: 1 argument.
export function* script29E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  for (;;) {
    if (((yield* game.wait(0x280, 0)) & 0x80) === 0) {
      yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0x78);
    } else {
      yield* game.notice(2, 0x15, 0xb, 3, 0x800, 0x93, 0x78);
    }
  }
}

// Script 29F: 3 arguments, returns a word.
export function* script29F(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = arg2;
  yield* game.setObjectAnimation(local0, 7);
  const t1 = yield* game.wait(0x6e88, 0);
  local5 = t1;
  if ((local5 & 8) === 0) {
    yield* game.setObjectAnimation(local0, 0);
  } else {
    yield* game.setObjectAnimation(local0, 8);
    const t2 = yield* game.wait(0x6e81, local1);
    local5 = t2;
    if ((local5 & 1) === 0) {
      yield* game.setObjectAnimation(local0, 0);
    } else {
      yield* game.spellMenu(local0);
      if (signed(state.byte('SPELL_TARGET_OBJECT')) !== 0xffff) {
        yield* game.turnObjectToObject(local0, signed(state.byte('SPELL_TARGET_OBJECT')));
      }
      local5 = yield* game.wait(0x2e83, local3);
    }
  }
  return local5;
}
