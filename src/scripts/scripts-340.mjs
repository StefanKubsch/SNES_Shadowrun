// Scripts 340 to 35F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 340: 1 argument.
export function* script340(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.setObjectDialog(local0, 9);
  yield* game.wait(2, 0);
  return null;
}

// Script 341: 1 argument.
export function* script341(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x101, 0xbb8, 0x658, 0);
  return null;
}

// Script 342: 1 argument.
export function* script342(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    block33: {
      if (((yield* game.wait(0x81, 1)) & 0x80) === 0) {
        break block33;
      }
      yield* game.notice(5, 0x15, 0x16, 3, 0x800, 0x11b, 0xf0);
      break block33;
    }
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
      continue loop2;
    }
    return null;
  }
}

// Script 343: 1 argument.
export function* script343(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block161: {
    local0 = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0xdc1)) & 2) === 0) {
      if (
        (truth(((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) |
          truth(((yield* game.getActorStateFlags(0xdc1)) & 0x20) !== 0)) ===
        0
      ) {
        yield* game.setObjectActionAndDirection(local0, 0, 2);
        loop58: for (;;) {
          local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
          if ((truth(less(yield* game.getDistanceToPlayer(local0), 0x32)) | signed(local1)) === 0) {
            continue loop58;
          }
          block151: {
            yield* game.setObjectDirection(local0, 6);
            yield* game.wait(1, 0x1e);
            if (signed(local1) !== 0) {
              break block151;
            }
            yield* game.talk(local0, 0x39);
            loop106: for (;;) {
              block137: {
                const t1 = yield* game.wait(0x803, 6);
                local2 = t1;
                local1 = truth((t1 & 0x800) !== 0) & 0xff;
                if ((local2 & 2) === 0) {
                  break block137;
                }
                yield* game.talk(local0, 0x39);
                break block137;
              }
              if (((yield* game.isActorStateProperty(0x149, 0x999)) | signed(local1)) === 0) {
                continue loop106;
              }
              break block151;
            }
          }
          if (signed(local1) !== 0) {
            break block161;
          }
          yield* game.talk(local0, 0x3a);
          break block161;
        }
      } else {
        yield* game.resetObjectRecordProperty(local0);
        yield* game.removeObject(local0);
        return null;
      }
    } else {
      yield* game.setObjectActionAndDirection(local0, 0, 2);
      break block161;
    }
  }
  block248: {
    if (((yield* game.getActorStateFlags(0xdc1)) & 4) !== 0) {
      break block248;
    }
    yield* game.setActorStateFlagBits(0xdc1, 0x20);
    yield* game.setActorStateFlagBits(0xdc1, 4);
    yield* game.keepActorStateFlagBits(0xabf, 0xff7f);
    yield* game.setObjectDirection(local0, 6);
    yield* game.wait(1, 0x32);
    yield* game.setObjectAnimation(local0, 1);
    yield* game.native1D(local0, 0);
    yield* game.wait(1, 0x14);
    const t2 = yield* game.getObjectCoarseHeight(local0);
    const t3 = yield* game.getObjectCoarseY(local0);
    const t4 = yield* game.getObjectCoarseX(local0);
    yield* game.createObject(0x6b, t4, t3, t2, 0xbf);
    yield* game.wait(1, 1);
    yield* game.resetObjectRecordProperty(local0);
    break block248;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 344: no arguments.
export function* script344(state) {
  yield* game.setActorStateFlagBits(0x191a, 1);
  return null;
}

// Script 345: 2 arguments.
export function* script345(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  const t1 = arg1;
  local0 = arg0 & 0xff;
  local1 = t1;
  yield* game.setObjectDirection(local0, 5);
  loop9: for (;;) {
    block132: {
      if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
        yield* game.setObjectFlagBits(local0, 0x100);
        yield* game.setObjectAnimation(local0, 1);
        loop76: for (;;) {
          block107: {
            if ((yield* game.wait(0x281, 0xa)) === 1) {
              break block107;
            }
            yield* game.notice(7, 0x15, 0x13, 3, 0x800, 0x1f9, 0xc8);
            break block107;
          }
          if (((yield* game.getActorStateFlags(local1)) & 1) === 0) {
            continue loop76;
          }
          yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
          yield* game.setObjectAnimation(local0, 2);
          break block132;
        }
      } else {
        yield* game.keepObjectFlagBits(local0, 0xfeff);
        yield* game.setObjectAnimation(local0, 0);
        loop30: for (;;) {
          yield* game.wait(1, 0xa);
          if (((yield* game.getActorStateFlags(local1)) & 1) !== 0) {
            continue loop30;
          }
          yield* game.playSoundEffect(local0, 0x30, 0xff, 3);
          yield* game.setObjectAnimation(local0, 3);
          break block132;
        }
      }
    }
    yield* game.wait(8, 0);
    continue loop9;
  }
}

// Script 346: 1 argument.
export function* script346(state, arg0) {
  let local0 = 0;
  block32: {
    local0 = arg0 & 0xff;
    yield* script(0x28c, local0, 0x1b, 0x1388, 0x14);
    if (state.byte(0x3bfc) !== 0) {
      break block32;
    }
    state.setByte(0x3bfc, 0, 0xa);
    yield* game.raiseMemberMagicPoints(yield* game.getPlayerObjectCopy(), 0x64);
    break block32;
  }
  block45: {
    if (state.byte(0x3c0b) !== 0) {
      break block45;
    }
    state.setByte(0x3c0b, 0, 1);
    break block45;
  }
  block58: {
    if (state.byte(0x3c0c) !== 0) {
      break block58;
    }
    state.setByte(0x3c0c, 0, 1);
    break block58;
  }
  block71: {
    if (state.byte(0x3c0a) !== 0) {
      break block71;
    }
    state.setByte(0x3c0a, 0, 1);
    break block71;
  }
  block84: {
    if (state.byte(0x3c07) !== 0) {
      break block84;
    }
    state.setByte(0x3c07, 0, 1);
    break block84;
  }
  block97: {
    if (state.byte(0x3c09) !== 0) {
      break block97;
    }
    state.setByte(0x3c09, 0, 1);
    break block97;
  }
  return null;
}

// Script 347: 1 argument.
export function* script347(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    block43: {
      yield* game.setObjectActionAndDirection(local0, 0, 0);
      if (((yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64))) & 2) === 0) {
        break block43;
      }
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x63, 0x78);
      break block43;
    }
    block88: {
      yield* game.releaseObjectGraphics(local0);
      yield* game.setObjectActionAndDirection(local0, 0, 7);
      if (((yield* game.wait(3, word(((yield* game.randomByte()) & 0x7f) + 0x64))) & 2) === 0) {
        break block88;
      }
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x63, 0x78);
      break block88;
    }
    yield* game.releaseObjectGraphics(local0);
    continue loop2;
  }
}

// Script 348: 1 argument.
export function* script348(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x0ae, local0);
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.setObjectDialog(local0, 0xa);
  yield* game.wait(2, 0);
  return null;
}

// Script 349: 1 argument.
export function* script349(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x102, 0x1770, 0x1944, 0);
  return null;
}

// Script 34A: 1 argument.
export function* script34A(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block142: {
    local0 = arg0 & 0xff;
    if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
      break block142;
    }
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((t1 & 0x80) === 0) {
      if ((local1 & 0x100) === 0) {
        break block142;
      }
      yield* script(0x0f9);
      const t2 = yield* game.chooseNumber();
      local3 = t2;
      if (t2 === 0xffff) {
        break block142;
      }
      if (local3 !== 0x666) {
        yield* script(0x085, local3);
        break block142;
      }
      yield* game.wait(1, 1);
      yield* game.setActorStateFlagBits(local3, 0x80);
      yield* game.setObjectRecordFlagBits(local0, 1);
      break block142;
    }
    block81: {
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.notice(9, 0x15, 0x10, 3, 0x800, 0x104, 0xf0);
        break block81;
      }
      yield* game.notice(5, 0x15, 0x18, 3, 0x800, 0x105, 0xf0);
      break block81;
    }
    break block142;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 34B: 1 argument.
export function* script34B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  local0 = arg0 & 0xff;
  local1 = (yield* game.getObjectCoarseX(local0)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(local0)) & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(local1), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(local1), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(local1), 2);
  const t4 = local0;
  yield* game.setObjectPosition(t4, t3, t2, t1);
  yield* game.addObjectHeight(local0, 0x20);
  yield* game.wait(1, yield* game.jumpObjectTowardsObject(local0, signed(local2)));
  yield* game.removeObject(local0);
  const t5 = yield* game.getObjectCoarseHeight(local0);
  const t6 = yield* game.getObjectCoarseY(local0);
  const t7 = yield* game.getObjectCoarseX(local0);
  local0 = (yield* game.createObject(0xb8, t7, t6, t5, 0x382)) & 0xff;
  yield* game.wait(1, 0xa);
  yield* game.blast(local0, 6);
  return null;
}

// Script 34C: 1 argument.
export function* script34C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0xa00 | local0, 0x709, 0, 0x804, 0xc06));
  return null;
}

// Script 34D: 1 argument.
export function* script34D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x800 | local0, 0x706, 0));
  return null;
}

// Script 34E: 1 argument.
export function* script34E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28c, local0, 0x1c, 0x2710, 0x2a);
  return null;
}

// Script 34F: 1 argument.
export function* script34F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x103, 0x9c4, 0x32c, 0);
  return null;
}

// Script 350: 1 argument.
export function* script350(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 6, 3, 1, 1);
  return null;
}

// Script 351: 1 argument.
export function* script351(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = 64;
  loop6: for (;;) {
    yield* game.playSoundEffect(0xffff, 0x62, 0xff, 1);
    yield* game.wait(1, 0x14);
    const t1 = word(local1 - 1);
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      continue loop6;
    }
    return null;
  }
}

// Script 352: 1 argument.
export function* script352(state, arg0) {
  let local0 = 0;
  block26: {
    local0 = arg0 & 0xff;
    if (!less(yield* game.getDistanceToPlayer(local0), 0x64)) {
      break block26;
    }
    yield* game.notice(9, 2, 0xe, 3, 0, 0x67, 0x78);
    break block26;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 353: 1 argument.
export function* script353(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28c, local0, 0x1d, 0x4a38, 0x46);
  yield* game.addTopic(0x16);
  return null;
}

// Script 354: no arguments.
export function* script354(state) {
  const t1 = yield* script(0x03f, 0x1f4, 0x190, 0x12c);
  const t2 = yield* script(0x0b2, 0x17f, 0x180, 0x181);
  yield* script(0x162, 0xb3d, t2, t1, 0x17e, 0x17d);
  return null;
}

// Script 355: 1 argument.
export function* script355(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* game.setObjectRecordFlags(local0, local0);
    yield* script(0x245, local0);
    local1 = 0;
    loop28: for (;;) {
      block70: {
        if (((yield* game.wait(0x90, 0)) & 0x80) === 0) {
          yield* game.setObjectRecordPropertyFromGroup(local0);
          yield* script(0x04b);
          local1 = 255;
          break block70;
        }
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x4e, 0xf0);
        break block70;
      }
      if (signed(local1) === 0) {
        continue loop28;
      }
      yield* game.removeObject(local0);
      return null;
    }
  } else {
    yield* game.setSpriteMode(local0, 0);
    yield* script(0x293, local0);
    return null;
  }
}

// Script 356: 1 argument.
export function* script356(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x800 | local0, 0x607, 0));
  return null;
}

// Script 357: 1 argument.
export function* script357(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28c, local0, 0x1e, 0x6590, 0x64);
  yield* game.setActorStateFlagBits(0x1c0e, 2);
  return null;
}

// Script 358: 1 argument.
export function* script358(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block127: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      yield* game.setObjectActionAndDirection(local0, 2, 5);
      yield* game.setObjectDialog(local0, 0xb);
      local1 = 0;
      loop45: for (;;) {
        block102: {
          if (((yield* game.wait(0x83, 1)) & 0x80) === 0) {
            if ((yield* game.isActorStateProperty(0x185d, 0xbd7)) === 0) {
              break block102;
            }
            yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
            local1 = 255;
            break block102;
          }
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0xaa, 0xf0);
          break block102;
        }
        if (signed(local1) === 0) {
          continue loop45;
        }
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* script(0x0ae, local0);
        yield* game.setObjectDialog(local0, 0xc);
        yield* game.wait(2, 0);
        break block127;
      }
    } else {
      yield* script(0x0ae, local0);
      yield* game.setObjectDialog(local0, 0xc);
      yield* game.wait(2, 0);
      break block127;
    }
  }
  return null;
}

// Script 359: 1 argument.
export function* script359(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xffbf);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.wait(1, 0x41);
  yield* game.setObjectActionAndDirection(local0, 2, 0);
  yield* game.setObjectVelocity(local0, 0, 2, 0);
  yield* game.wait(1, 0x41);
  yield* game.setObjectAnimation(local0, 0);
  local1 = 3;
  loop48: for (;;) {
    local2 = 11;
    loop52: for (;;) {
      block120: {
        if ((local2 & 1) === 0) {
          if (((yield* game.randomByte()) & 1) === 0) {
            yield* game.setObjectVelocity(local0, 0xfffe, 3, 0);
            break block120;
          }
          yield* game.setObjectVelocity(local0, 0xfffe, 2, 0);
          break block120;
        }
        block89: {
          if (((yield* game.randomByte()) & 1) === 0) {
            yield* game.setObjectVelocity(local0, 2, 0xffff, 0);
            break block89;
          }
          yield* game.setObjectVelocity(local0, 2, 0xfffe, 0);
          break block89;
        }
        break block120;
      }
      yield* game.wait(1, 1);
      if (local2 === 0) {
        block208: {
          yield* game.clearObjectVelocity(local0);
          const t1 = yield* game.getObjectDirection(local0);
          local3 = t1 & 0xff;
          if (t1 !== 0) {
            if (local3 !== 7) {
              if (local3 !== 6) {
                if (local3 !== 5) {
                  break block208;
                }
                yield* game.setObjectDirection(local0, 4);
                break block208;
              }
              yield* game.setObjectDirection(local0, 5);
              break block208;
            }
            yield* game.setObjectDirection(local0, 6);
            break block208;
          }
          yield* game.setObjectDirection(local0, 7);
          break block208;
        }
        yield* game.wait(1, 5);
        if (local1 === 0) {
          const t2 = word((yield* game.getObjectCoarseHeight(local0)) - 0xa);
          const t3 = yield* game.getObjectCoarseY(local0);
          const t4 = word((yield* game.getObjectCoarseX(local0)) + 0xa);
          yield* game.createObject(0x25, t4, t3, t2, 0x67);
          yield* game.removeObject(local0);
          return null;
        }
        local1 = word(local1 - 1) & 0xff;
        continue loop48;
      }
      local2 = word(local2 - 1) & 0xff;
      continue loop52;
    }
  }
}

// Script 35A: 1 argument.
export function* script35A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x800 | local0, 0x506, 0));
  return null;
}

// Script 35B: 1 argument.
export function* script35B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 0x406, 0));
  return null;
}

// Script 35C: no arguments.
export function* script35C(state) {
  yield* game.wait(1, 2);
  state.setWord('GROUP_LEADER_ONLY', 0, 0xffff);
  return null;
}

// Script 35D: 1 argument, returns a word.
export function* script35D(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(local0);
  const t2 = yield* game.getObjectCoarseY(local0);
  const t3 = local0;
  local1 = (yield* game.createObject(0x99, t3, t2, t1, 0x90)) & 0xff;
  yield* game.wait(1, 5);
  yield* game.resetObjectRecordProperty(local0);
  yield* game.removeObject(local0);
  yield* game.wait(1, 0xa);
  return local1;
}

// Script 35E: 1 argument.
export function* script35E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28c, local0, 0x1f, 0x84d0, 0x7d);
  return null;
}

// Script 35F: 1 argument.
export function* script35F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  loop2: for (;;) {
    yield* game.wait(1, 1);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
      continue loop2;
    }
    block70: {
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        break block70;
      }
      block51: {
        yield* game.wait(1, 0x23);
        if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) === 0) {
          break block51;
        }
        yield* script(0x0d1, 0x155b);
        break block51;
      }
      block64: {
        if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) === 0) {
          break block64;
        }
        yield* script(0x31c);
        break block64;
      }
      yield* game.keepObjectRecordFlagBits(local0, 0xff7e);
      break block70;
    }
    yield* script(0x0ae, local0);
    yield* script(0x342, local0);
    yield* game.setObjectRecordFlagBits(local0, 1);
    yield* script(0x2e8, local0, 2, 0x1e8, 0, 4);
    return null;
  }
}
