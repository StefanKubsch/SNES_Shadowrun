// Scripts 240 to 25F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftRight, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 240: no arguments.
export function* script240(state) {
  yield* game.endDialog();
  yield* game.wait(1, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(1, 1);
  yield* game.notice(2, 0x17, 8, 3, 0, 0x10, 1);
  return null;
}

// Script 241: 6 arguments, returns a word.
export function* script241(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
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
  local5 = t1 & 0xff;
  local6 = local1 & 0xff;
  loop16: for (;;) {
    const t6 = yield* game.wait(0x805, 1);
    local7 = t6;
    if ((t6 & 0x800) === 0) {
      if (
        (truth(local6 === 0) |
          (truth(less(yield* game.getDistanceToPlayer(local0), local3)) &
            truth(less(local6, local2))) |
          (truth(
            ((yield* game.getObjectVelocityX(local0)) |
              (yield* game.getObjectVelocityY(local0))) !==
              0,
          ) ^
            0xffff) |
          (truth(less(yield* game.getObjectRecordCount(local0), local4)) & truth(local5 !== 0xff)) |
          truth((local7 & 4) !== 0)) !==
        0
      ) {
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        yield* game.setObjectAnimation(local0, 0);
        const t7 = yield* game.chooseEnemyTarget(local0);
        local9 = t7 & 0xff;
        yield* game.turnObjectToObject(local0, t7);
        return 0;
      }
      local6 = word(local6 - 1) & 0xff;
      continue loop16;
    }
    return 0xffff;
  }
}

// Script 242: 2 arguments, returns a word.
export function* script242(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block31: {
    const t1 = arg1;
    local0 = arg0 & 0xff;
    local1 = t1;
    yield* game.keepObjectFlagBits(local0, 0xffef);
    if (local1 !== 0x600) {
      yield* game.setObjectAnimation(local0, 4);
      break block31;
    }
    yield* game.setObjectAnimation(local0, 5);
    break block31;
  }
  const t2 = yield* game.getPlayerObjectCopy();
  const t3 = local0;
  yield* game.turnObjectToObject(t3, t2);
  const t4 = yield* game.getPlayerObject();
  const t5 = local0;
  yield* game.shootAtObject(t5, t4, 3, 0, 3, 2);
  yield* game.playSoundEffect(local0, 0xc, 0xff, 0xff);
  const t6 = yield* game.wait(0x801, 0x3c);
  local3 = t6;
  return truth((t6 & 0x800) !== 0);
}

// Script 243: 1 argument.
export function* script243(state, arg0) {
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
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 4, 0x17d, 0, 2);
  return null;
}

// Script 244: 1 argument.
export function* script244(state, arg0) {
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
      yield* script(0x0fc, 0x16c0);
      break block35;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block41;
  }
  block95: {
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* script(0x101, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    if ((yield* game.isActorStateProperty(0x8b2, 0x762)) === 0) {
      yield* script(0x2e8, local0, 3, 0x1d7, 0, 3);
      break block95;
    }
    yield* script(0x2e8, local0, 3, 0x1d7, 2, 3);
    break block95;
  }
  return null;
}

// Script 245: 1 argument.
export function* script245(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  return null;
}

// Script 246: 1 argument.
export function* script246(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block12: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
      break block12;
    }
    yield* script(0x245, local0);
    break block12;
  }
  loop12: for (;;) {
    block81: {
      local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
      const t1 = yield* script(0x2ab, signed(local1), 0);
      local2 = t1;
      if (t1 !== 0x80) {
        if (local2 !== 0x10) {
          break block81;
        }
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* script(0x04b);
        local1 = 255;
        break block81;
      }
      yield* game.notice(2, 0x15, 0xd, 3, 0x800, 0x88, 0xf0);
      yield* game.learnSpell(0x4f);
      yield* game.setScriptVariable(0, word((yield* game.getScriptVariable(0)) + 1));
      break block81;
    }
    if (signed(local1) === 0) {
      continue loop12;
    }
    yield* game.removeObject(local0);
    return null;
  }
}

// Script 247: no arguments.
export function* script247(state) {
  yield* script(0x10e, 0x3b);
  return null;
}

// Script 248: 1 argument.
export function* script248(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x20);
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.setObjectVelocity(local0, 0, 0xfffa, 0xf);
  local3 = yield* game.getObjectCoarseHeight(local0);
  loop25: for (;;) {
    local1 = local3;
    yield* game.wait(1, 1);
    local3 = yield* game.getObjectCoarseHeight(local0);
    if (local1 !== local3) {
      continue loop25;
    }
    yield* game.clearObjectVelocity(local0);
    loop51: for (;;) {
      local1 = local3;
      yield* game.wait(1, 0xa);
      local3 = yield* game.getObjectCoarseHeight(local0);
      if (local1 !== local3) {
        continue loop51;
      }
      yield* script(0x15e, local0);
      return null;
    }
  }
}

// Script 249: 1 argument.
export function* script249(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x00a, local0, 0x22, 0x26, 0x80, 0x175a);
  return null;
}

// Script 24A: 1 argument.
export function* script24A(state, arg0) {
  let local0 = 0;
  block77: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block77;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x15) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block55: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 8) === 0) {
        break block55;
      }
      yield* script(0x25b, local0, 0x1f40, 0x21a, 2);
      break block55;
    }
    block71: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block71;
      }
      yield* script(0x0fe, 0x159a);
      break block71;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block77;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 5, 0x163, 0, 2);
  return null;
}

// Script 24B: 1 argument.
export function* script24B(state, arg0) {
  let local0 = 0;
  block55: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block55;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x41) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block49: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block49;
      }
      yield* script(0x0fe, 0x1593);
      break block49;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block55;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 6, 0x180, 0, 2);
  return null;
}

// Script 24C: 1 argument.
export function* script24C(state, arg0) {
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
      yield* script(0x0fc, 0x16c0);
      break block35;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block41;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xc, 0x1e1, 0, 3);
  return null;
}

// Script 24D: 1 argument.
export function* script24D(state, arg0) {
  let local0 = 0;
  block54: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block54;
    }
    block32: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
        break block32;
      }
      yield* script(0x31c);
      break block32;
    }
    block48: {
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block48;
      }
      yield* script(0x0fc, 0x175a);
      break block48;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block54;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 7, 0x1a6, 0, 2);
  return null;
}

// Script 24E: 1 argument.
export function* script24E(state, arg0) {
  let local0 = 0;
  block55: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block55;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x2f) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block49: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) === 0) {
        break block49;
      }
      yield* script(0x0fe, 0x158c);
      break block49;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block55;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 8, 0x1a9, 0, 2);
  return null;
}

// Script 24F: 1 argument.
export function* script24F(state, arg0) {
  let local0 = 0;
  block107: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block107;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x19) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block49: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 4) === 0) {
        break block49;
      }
      yield* script(0x0d1, 0x15af);
      break block49;
    }
    block101: {
      if (
        (truth((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) &
          (truth(((yield* game.getActorStateFlags(0xd5f)) & 0x80) !== 0) ^ 0xffff)) ===
        0
      ) {
        break block101;
      }
      yield* game.setActorStateFlags(0xd5f, 0x80);
      yield* game.notice(5, 2, 0x15, 3, 0, 0x216, 1);
      yield* game.confirmKey();
      yield* game.wait(1, 1);
      break block101;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block107;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 5, 0x1e2, 0, 3);
  return null;
}

// Script 250: 1 argument.
export function* script250(state, arg0) {
  let local0 = 0;
  block55: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block55;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0xfb) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    block49: {
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block49;
      }
      yield* script(0x0fc, 0x16c0);
      break block49;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block55;
  }
  block110: {
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* script(0x101, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    if (((yield* game.getActorStateFlags(0xd5f)) & 0x80) === 0) {
      yield* script(0x2e8, local0, 0xe, 0x1e3, 0, 3);
      break block110;
    }
    yield* script(0x2e8, local0, 0xe, 0x1e3, 2, 3);
    break block110;
  }
  return null;
}

// Script 251: 7 arguments, returns a word.
export function* script251(state, arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    local14 = 0,
    local16 = 0,
    local17 = 0,
    local18 = 0,
    local19 = 0,
    local20 = 0,
    local22 = 0,
    local24 = 0,
    local25 = 0,
    local26 = 0,
    local27 = 0,
    local28 = 0,
    local29 = 0;
  function* sub17() {
    block38: {
      yield* game.setObjectAnimation(local0, 0);
      const t1 = yield* game.chooseEnemyTarget(local0);
      local28 = t1 & 0xff;
      if (t1 === 0xffff) {
        break block38;
      }
      yield* game.turnObjectToObject(local0, signed(local28));
      break block38;
    }
    if (((yield* game.wait(0x801, 0x1e)) & 0x800) === 0) {
      block206: {
        if ((yield* game.getDistanceToPlayer(local0)) <= 0xf) {
          break block206;
        }
        local13 = 0;
        loop68: for (;;) {
          const t2 = yield* game.chooseEnemyTarget(local0);
          local28 = t2 & 0xff;
          if (t2 !== 0xffff) {
            yield* game.setObjectAnimation(local0, 2);
            yield* game.moveObjectStraightToPlayer(local0);
            loop115: for (;;) {
              if (((yield* game.wait(0x801, 5)) & 0x800) === 0) {
                if (less(yield* game.getDistanceToPlayer(local0), local11)) {
                  break block206;
                }
                block203: {
                  if ((yield* game.getDistanceToPlayer(local0)) <= local22) {
                    break block203;
                  }
                  const t3 = word(local20 + 1);
                  local20 = t3;
                  if (t3 !== 0x12c) {
                    break block203;
                  }
                  block186: {
                    local20 = 0;
                    if (local3 !== 0x47) {
                      local29 = 20;
                      break block186;
                    }
                    local29 = 25;
                    break block186;
                  }
                  yield* game.notice(2, 4, local29, 3, 0x400, local3, 0x78);
                  break block203;
                }
                continue loop115;
              }
              return 0xffff;
            }
          } else {
            yield* game.setObjectActionAndDirection(local0, 0, 4);
            if (((yield* game.wait(0x801, 0x14)) & 0x800) === 0) {
              continue loop68;
            }
            return 0xffff;
          }
        }
      }
      yield* game.stopMotion(local0);
      yield* game.clearObjectVelocity(local0);
      yield* game.setObjectAnimation(local0, local25);
      if (((yield* game.wait(0x808, 0)) & 0x800) === 0) {
        block275: {
          const t4 = signed(local19);
          const t5 = local18;
          const t6 = local17;
          const t7 = local16;
          const t8 = yield* game.getPlayerObjectCopy();
          const t9 = local0;
          yield* game.shootAtObject(t9, t8, t7, t6, t5, t4);
          yield* game.playSoundEffect(local0, local26, 0xff, 3);
          if (signed(local27) === 0) {
            break block275;
          }
          if ((yield* game.getObjectRecordCount(yield* game.getPlayerObjectCopy())) > 5) {
            break block275;
          }
          return 0xffff;
        }
        block393: {
          const t10 = word(local13 + 1);
          local13 = t10 & 0xff;
          if (t10 !== 3) {
            break block393;
          }
          local13 = 0;
          yield* game.setObjectAnimation(local0, 2);
          yield* game.native81(local0, local24);
          if (((yield* game.wait(0x805, 0x28)) & 0x800) === 0) {
            yield* game.stopMotion(local0);
            yield* game.clearObjectVelocity(local0);
            yield* game.setObjectAnimation(local0, 0);
            yield* game.turnObjectToPlayer(local0);
            if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
              local14 = 0x3c;
              loop353: for (;;) {
                if (((yield* game.wait(0x801, 1)) & 0x800) === 0) {
                  if (
                    (truth(local14 === 0) |
                      truth(less(yield* game.getDistanceToPlayer(local0), 0x32))) !==
                    0
                  ) {
                    break block393;
                  }
                  local14 = word(local14 - 1);
                  continue loop353;
                }
                return 0xffff;
              }
            } else {
              return 0xffff;
            }
          } else {
            return 0xffff;
          }
        }
        return 0;
      }
      return 0xffff;
    }
    return 0xffff;
  }
  const t11 = arg6;
  const t12 = arg5;
  const t13 = arg4;
  const t14 = arg3;
  const t15 = arg2;
  const t16 = arg1;
  local0 = arg0 & 0xff;
  local1 = t16;
  local3 = t15;
  local5 = t14;
  local7 = t13;
  local9 = t12;
  local11 = t11;
  local16 = shiftRight(local7, 8) & 0xff;
  local17 = local7 & 0xff;
  local25 = shiftRight(local5, 8) & 0xff;
  local26 = local5 & 0xff;
  local18 = shiftRight(local9, 8) & 0xff;
  local19 = local9 & 0xff & 0xff;
  local24 = local1 & 0xff & 0xff;
  local27 = truth((local1 & 0xff00) !== 0) & 0xff;
  local13 = 0;
  local20 = 0;
  local22 = word(local11 + 0x64);
  loop460: for (;;) {
    if ((yield* sub17()) === 0) {
      continue loop460;
    }
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    if (signed(local27) === 0) {
      return 0;
    }
    if ((yield* game.getObjectRecordCount(local0)) !== 0) {
      return 0xffff;
    }
    return 0;
  }
}

// Script 252: 5 arguments.
export function* script252(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local10 = 0,
    local11 = 0,
    local12 = 0,
    local13 = 0,
    local14 = 0,
    local15 = 0;
  function* sub13(in0) {
    local15 = in0 & 0xff;
    yield* game.setObjectActionAndDirection(local0, 7, local7);
    yield* game.createObject(0xb9, local0, local15, 0, 0x217);
    yield* game.wait(1, 0x14);
    yield* game.setObjectAnimation(local0, 0);
    if (((yield* game.wait(0x801, 0x28)) & 0x800) === 0) {
      return 0;
    }
    return 0xffff;
  }
  function* sub65(in0) {
    local15 = in0 & 0xff;
    yield* game.setObjectAnimation(local0, 2);
    yield* game.native1D(local0, local15);
    if (((yield* game.wait(0x804, 0)) & 0x800) === 0) {
      yield* game.setObjectActionAndDirection(local0, 0, local7);
      return 0;
    }
    return 0xffff;
  }
  const t1 = arg4;
  const t2 = arg3;
  const t3 = arg2;
  const t4 = arg1;
  local0 = arg0 & 0xff;
  local1 = t4;
  local3 = t3;
  local5 = t2;
  local7 = t1 & 0xff;
  local9 = shiftRight(local1, 8) & 0xff;
  local10 = local1 & 0xff;
  local11 = shiftRight(local3, 8) & 0xff;
  local12 = local3 & 0xff;
  local13 = shiftRight(local5, 8) & 0xff;
  local14 = local5 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 6);
  local8 = 0;
  yield* game.appendToFightList(local0);
  loop147: for (;;) {
    block278: {
      if ((yield* sub13(local11)) === 0) {
        if ((yield* sub65(local9)) === 0) {
          if ((yield* sub13(local12)) === 0) {
            if (((yield* game.wait(0x801, 0xf)) & 0x800) === 0) {
              if ((yield* sub13(local13)) === 0) {
                if ((yield* sub65(local10)) === 0) {
                  if ((yield* sub13(local14)) === 0) {
                    if (((yield* game.wait(0x801, 0x14)) & 0x800) === 0) {
                      break block278;
                    }
                    local8 = 255;
                    break block278;
                  }
                  local8 = 255;
                  break block278;
                }
                local8 = 255;
                break block278;
              }
              local8 = 255;
              break block278;
            }
            local8 = 255;
            break block278;
          }
          local8 = 255;
          break block278;
        }
        local8 = 255;
        break block278;
      }
      local8 = 255;
      break block278;
    }
    if (signed(local8) === 0) {
      continue loop147;
    }
    yield* game.fightListRemove(local0);
    yield* game.addKarma(1);
    yield* script(0x35d, local0);
    return null;
  }
}

// Script 253: no arguments.
export function* script253(state) {
  yield* game.releaseNoticeWindows();
  yield* game.wait(1, 1);
  yield* game.notice(2, 0x17, 9, 3, 0, 0x13, 1);
  return null;
}

// Script 254: 1 argument.
export function* script254(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getActorStateFlags(0xadb)) & 1) === 0) {
      continue loop2;
    }
    yield* script(0x371, local0, 4, 5, 2, 0x80, 4, 0, 5);
    return null;
  }
}

// Script 255: 1 argument.
export function* script255(state, arg0) {
  let local0 = 0;
  block39: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block39;
    }
    block33: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x3f) <= 0) {
        break block33;
      }
      yield* script(0x31c);
      break block33;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block39;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 8, 0x1a7, 0, 2);
  return null;
}

// Script 256: 1 argument.
export function* script256(state, arg0) {
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
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 4, 0x1a8, 0, 2);
  return null;
}

// Script 257: 1 argument.
export function* script257(state, arg0) {
  let local0 = 0;
  block93: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block93;
    }
    block71: {
      yield* game.wait(1, 0x23);
      if (
        (truth((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) &
          (truth(((yield* game.getActorStateFlags(0xfc7)) & 0x80) !== 0) ^ 0xffff)) ===
        0
      ) {
        break block71;
      }
      yield* game.setActorStateFlags(0xfc7, 0x80);
      yield* game.notice(5, 2, 0x15, 3, 0, 0x215, 1);
      yield* game.confirmKey();
      yield* game.wait(1, 1);
      break block71;
    }
    block87: {
      if ((state.byte('DECKER_DATA_BITS') & 0x80) === 0) {
        break block87;
      }
      yield* script(0x0fc, 0x175a);
      break block87;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block93;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 7, 0x1df, 0, 2);
  return null;
}

// Script 258: 1 argument.
export function* script258(state, arg0) {
  let local0 = 0;
  block98: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block98;
    }
    block41: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 8) === 0) {
        break block41;
      }
      yield* script(0x25b, local0, 0x2710, 0x21b, 2);
      break block41;
    }
    block63: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x20) === 0) {
        break block63;
      }
      yield* script(0x25b, local0, 0x30d4, 0x21c, 4);
      break block63;
    }
    block76: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x10) === 0) {
        break block76;
      }
      yield* script(0x31c);
      break block76;
    }
    block92: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block92;
      }
      yield* script(0x0d1, 0x15b6);
      break block92;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block98;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0xa, 0x1e4, 0, 3);
  return null;
}

// Script 259: 1 argument.
export function* script259(state, arg0) {
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
      yield* script(0x0fc, 0x16c0);
      break block35;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block41;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 9, 0x1e5, 0, 3);
  return null;
}

// Script 25A: 1 argument.
export function* script25A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    block39: {
      if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
        break block39;
      }
      yield* game.notice(2, 2, 0x1c, 3, 0x400, 0xcd, 0xf0);
      break block39;
    }
    return null;
  }
  return null;
}

// Script 25B: 4 arguments.
export function* script25B(state, arg0, arg1, arg2, arg3) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0;
  block35: {
    const t1 = arg3;
    const t2 = arg2;
    const t3 = arg1;
    local0 = arg0 & 0xff;
    local1 = t3;
    local3 = t2;
    local5 = t1 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & local5) === 0) {
      yield* game.setObjectRecordFlagBits(local0, local5);
      yield* game.addNuyen(local1);
      break block35;
    }
    local3 = 0x213;
    break block35;
  }
  yield* game.notice(8, 2, 0xf, 5, 0, local3, 1);
  yield* game.confirmKey();
  yield* game.wait(1, 1);
  return null;
}

// Script 25C: 1 argument.
export function* script25C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 6);
    if (((yield* game.getActorStateFlags(0xadb)) & 1) === 0) {
      continue loop2;
    }
    yield* script(0x371, local0, 6, 7, 2, 0x80, 4, 0, 5);
    return null;
  }
}

// Script 25D: 3 arguments.
export function* script25D(state, arg0, arg1, arg2) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0,
    local6 = 0;
  block27: {
    const t1 = arg2;
    const t2 = arg1;
    local0 = arg0 & 0xff;
    local1 = t2;
    local3 = t1 & 0xff;
    if ((yield* game.hasFightTarget()) === 0) {
      local4 = yield* game.scriptAction(0x180);
      break block27;
    }
    local4 = yield* game.scriptAction(0x80);
    break block27;
  }
  block419: {
    if (local4 !== 0x80) {
      if (local4 !== 0x100) {
        break block419;
      }
      yield* script(0x0f9);
      const t3 = yield* game.chooseNumber();
      local6 = t3;
      if (t3 === 0xffff) {
        break block419;
      }
      if (
        (truth(local6 === 0x17a0) |
          truth(local6 === 0x16c7) |
          truth(local6 === 0x16f1) |
          truth(local6 === 0x1722) |
          truth(local6 === 0x16ff) |
          truth(local6 === 0x1737) |
          truth(local6 === 0x173e) |
          truth(local6 === 0x176f) |
          truth(local6 === 0x16dc) |
          truth(local6 === 0x1745) |
          truth(local6 === 0x16ce) |
          truth(local6 === 0x169d) |
          truth(local6 === 0x1792) |
          truth(local6 === 0x178b) |
          truth(local6 === 0x17b5) |
          truth(local6 === 0x16d5) |
          truth(local6 === 0x17ae) |
          truth(local6 === 0x16f8) |
          truth(local6 === 0x16b2) |
          truth(local6 === 0x16a4) |
          truth(local6 === 0x16b9) |
          truth(local6 === 0x16e3) |
          truth(local6 === 0x16ab) |
          truth(local6 === 0x174c) |
          truth(local6 === 0x1730) |
          truth(local6 === 0x1768) |
          truth(local6 === 0x1706) |
          truth(local6 === 0x171b) |
          truth(local6 === 0x17a7) |
          truth(local6 === 0x17bc) |
          truth(local6 === 0x1799) |
          truth(local6 === 0x1753) |
          truth(local6 === 0x170d) |
          truth(local6 === 0x1b7b)) ===
        0
      ) {
        if ((yield* game.getActorKind(local6)) !== 0xb2) {
          yield* script(0x085, local6);
          break block419;
        }
        yield* game.notice(2, 0x16, 0x18, 3, 0x800, 0x11a, 0xb4);
        break block419;
      }
      block380: {
        yield* game.endDialog();
        yield* game.setScriptVariable(
          0xc,
          yield* game.getActorStateProperty(yield* game.getObjectNumber(local0)),
        );
        if (
          (truth(state.byte('GROUP_INDEX') > 0) &
            truth(local6 === 0x1b7b) &
            truth((yield* game.getScriptVariable(0xc)) !== 0x8b2)) ===
          0
        ) {
          yield* game.setActorStateFlagBits(local6, 0x80);
          break block380;
        }
        yield* game.notice(2, 0x15, 0x1d, 3, 0x400, 0x25b, 0xf0);
        break block380;
      }
      break block419;
    }
    yield* game.notice(2, 0x15, local3, 3, 0x800, local1, 0xf0);
    break block419;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 25E: 1 argument.
export function* script25E(state, arg0) {
  let local0 = 0;
  block63: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block63;
    }
    block35: {
      yield* game.wait(1, 0x23);
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
        break block35;
      }
      yield* script(0x0d1, 0x154d);
      break block35;
    }
    block57: {
      if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x40) === 0) {
        break block57;
      }
      yield* script(0x25b, local0, 0x7d0, 0x218, 2);
      break block57;
    }
    yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
    break block63;
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* script(0x101, local0);
  yield* game.setObjectRecordFlagBits(local0, 1);
  yield* script(0x2e8, local0, 0, 0x15f, 0, 5);
  return null;
}

// Script 25F: 1 argument.
export function* script25F(state, arg0) {
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
  block95: {
    yield* game.setObjectActionAndDirection(local0, 0, 5);
    yield* script(0x101, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    if (((yield* game.getActorStateFlags(0xfc7)) & 0x80) === 0) {
      yield* script(0x2e8, local0, 3, 0x1e0, 0, 2);
      break block95;
    }
    yield* script(0x2e8, local0, 3, 0x1e0, 2, 2);
    break block95;
  }
  return null;
}
