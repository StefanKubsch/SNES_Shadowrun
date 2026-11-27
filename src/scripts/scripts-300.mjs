// Scripts 300 to 31F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 300: 1 argument.
export function* script300(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setActorStateFlagBits(0x1d96, 4);
  yield* script(0x252, local0, 1, 0x203, 0x405, 0);
  return null;
}

// Script 301: 1 argument.
export function* script301(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x79a)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0x79a, 0, 0x6d, 0x2000);
    yield* game.notice(2, 3, 0x1d, 3, 0x400, 0x18e, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0xf, 0, 0, 0, 0, 0x79a, 0x1e);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 302: 1 argument.
export function* script302(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x28, 0x1f4, 0x17c3, 0);
  return null;
}

// Script 303: 1 argument.
export function* script303(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerWeapon(local0, 0, 0, 0);
  yield* game.wait(1, 1);
  yield* game.removeObject(local0);
  return null;
}

// Script 304: 1 argument.
export function* script304(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    yield* game.wait(2, 0);
    yield* game.notice(5, 2, 6, 3, 0x400, 0x1c2, 0x64);
  }
}

// Script 305: 1 argument.
export function* script305(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) === 0) {
    yield* script(0x101, local0);
    const t1 = yield* game.getScriptVariable(0x2a);
    local4 = t1 & 0xff;
    const t2 = shiftLeft(yield* game.getObjectCoarseHeight(t1), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseY(local4), 2);
    const t4 = shiftLeft(yield* game.getObjectCoarseX(local4), 2);
    yield* game.setObjectPosition(local0, t4, t3, t2);
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.setObjectRecordFlags(local0, 0);
  }
  for (;;) {
    local1 = (yield* game.hasObjectRecordProperty(local0)) & 0xff;
    const t5 = yield* script(0x2ab, signed(local1), 0);
    local2 = t5;
    if (local2 !== 0x80) {
      if (local2 === 0x10) {
        yield* game.setObjectRecordPropertyFromGroup(local0);
        yield* game.playSoundEffect(0xffff, 0x38, 0xff, 3);
        local1 = 255;
      }
    } else {
      yield* game.notice(8, 0x15, 0x10, 3, 0x800, 0x1fd, 0xf0);
      yield* game.playSoundEffect(local0, 0x32, 0xff, 3);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(local0);
      return null;
    }
  }
}

// Script 306: 1 argument.
export function* script306(state, arg0) {
  let local0 = 0;
  block56: {
    local0 = arg0 & 0xff;
    yield* game.setObjectDirection(local0, 5);
    if (less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
      yield* game.setObjectAnimation(local0, 0);
      for (;;) {
        yield* game.wait(1, 5);
        if (!less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
          yield* game.setObjectAnimation(local0, 6);
          yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
          yield* game.wait(8, 0);
          break block56;
        }
      }
    }
  }
  loop56: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    yield* game.setObjectFlagBits(local0, 0x100);
    for (;;) {
      yield* game.wait(1, 5);
      if ((yield* game.getDistanceToPlayer(local0)) <= 0x1e) {
        yield* game.keepObjectFlagBits(local0, 0xfeff);
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
        yield* game.wait(8, 0);
        yield* game.setObjectAnimation(local0, 0);
        for (;;) {
          yield* game.wait(1, 5);
          if (!less(yield* game.getDistanceToPlayer(local0), 0x1f)) {
            yield* game.setObjectAnimation(local0, 6);
            yield* game.playSoundEffect(local0, 0x3c, 0xff, 3);
            yield* game.wait(8, 0);
            continue loop56;
          }
        }
      }
    }
  }
}

// Script 307: 2 arguments.
export function* script307(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1;
  local3 = (yield* game.getObjectDirection(local0)) & 0xff;
  yield* game.turnObjectToPlayer(local0);
  yield* game.wait(1, 0x14);
  yield* game.talk(local0, local1);
  yield* game.setObjectDirection(local0, local3);
  return null;
}

// Script 308: 1 argument.
export function* script308(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x2a, 0xfa0, 0x150, 0);
  return null;
}

// Script 309: 1 argument.
export function* script309(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x252, local0, 0x405, 1, 0x203, 6);
  return null;
}

// Script 30A: 1 argument.
export function* script30A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectAnimation(local0, 0);
  if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
    yield* game.setObjectDirection(local0, 5);
  } else {
    yield* game.setObjectDirection(local0, 1);
  }
  for (;;) {
    if (((yield* game.wait(0x180, 0)) & 0x100) === 0) {
      yield* game.notice(4, 0x15, 0x19, 3, 0x800, 0x1f7, 0xc8);
    } else {
      if (((yield* game.getActorStateFlags(0x299)) & 1) === 0) {
        yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
        if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
          yield* game.notice(8, 3, 0x10, 3, 0, 0x206, 0xc8);
          yield* game.setObjectRecordFlagBits(local0, 1);
          yield* game.setObjectDirection(local0, 1);
        } else {
          yield* game.notice(8, 3, 0x10, 3, 0, 0x207, 0xc8);
          yield* game.keepObjectRecordFlagBits(local0, 0);
          yield* game.setObjectDirection(local0, 5);
        }
      } else {
        yield* game.notice(6, 3, 0x13, 3, 0, 0x20c, 0xc8);
      }
    }
  }
}

// Script 30B: 1 argument.
export function* script30B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x200 | local0, 0xa09, 0, 0x804, 0xc06));
  return null;
}

// Script 30C: 1 argument.
export function* script30C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  for (;;) {
    if (((yield* game.wait(0x82, 0)) & 2) === 0) {
      if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
        yield* game.notice(2, 0x15, 0x15, 3, 0x800, 0x6b, 0x78);
        yield* game.setObjectRecordFlags(local0, 1);
        yield* game.setActorStateFlagBits(0x1482, 0x80);
      } else {
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x62, 0x3c);
      }
    } else {
      yield* game.notice(2, 0x15, 0xe, 3, 0x800, 0x61, 0x3c);
    }
  }
}

// Script 30D: 1 argument.
export function* script30D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x38, 0x1388, 0x850, 0);
  return null;
}

// Script 30E: 1 argument.
export function* script30E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x252, local0, 0x607, 0x809, 0xa0b, 6);
  return null;
}

// Script 30F: no arguments.
export function* script30F(state) {
  yield* game.markTopic(0x13);
  return null;
}

// Script 310: 1 argument.
export function* script310(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x2d, 0x3a98, 0x261, 0);
  return null;
}

// Script 311: 1 argument.
export function* script311(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2d5, local0, 2);
  return null;
}

// Script 312: 1 argument.
export function* script312(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = 4;
  for (;;) {
    const t1 = word(((yield* game.randomByte()) & 3) - 2);
    const t2 = word(((yield* game.randomByte()) & 3) - 2);
    const t3 = word(local1 + (yield* game.getObjectCoarseHeight(local0)));
    const t4 = yield* game.getObjectCoarseY(local0);
    const t5 = yield* game.getObjectCoarseX(local0);
    yield* game.setObjectVelocity(yield* game.createObject(0x54, t5, t4, t3, 0x3a7), t2, t1, 8);
    const t6 = word(local1 - 1);
    local1 = word(local1 - 1) & 0xff;
    if (t6 === 0) {
      return null;
    }
  }
}

// Script 313: 1 argument.
export function* script313(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x27c, 0x900 | local0, 0x206, 0, 0x804, 0xc06));
  return null;
}

// Script 314: 1 argument.
export function* script314(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x29, 0x7d0, 0x12f3, 0);
  return null;
}

// Script 315: 1 argument.
export function* script315(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local4 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(local0)) !== 0) {
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((local1 & 0x80) === 0) {
      if ((local1 & 0x100) !== 0) {
        yield* script(0x0f9);
        const t2 = yield* game.scriptChooseObject();
        local3 = t2 & 0xff;
        if (t2 !== 0xffff) {
          const t3 = yield* game.getObjectNumber(signed(local3));
          local4 = t3;
          if ((truth(local4 === 0xbc9) | (yield* script(0x197, local4))) === 0) {
            yield* script(0x085, yield* game.getObjectNumber(signed(local3)));
          } else {
            if (local4 !== 0xbc9) {
              yield* game.raiseStateCount(signed(local3), 0xa);
            } else {
              yield* game.setObjectRecordFlagBits(signed(local3), 0x80);
            }
            yield* game.playSoundEffect(local0, 0x36, 0xff, 0xff);
            if ((yield* game.decrementObjectStateCount(local0)) !== 0) {
              yield* game.resetObjectRecordProperty(local0);
            }
          }
        }
      }
    } else {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x8d, 0xf0);
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 316: 1 argument.
export function* script316(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x011, local0, 0, 0x14, 6, 5);
  return null;
}

// Script 317: 1 argument.
export function* script317(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x2c, 0x2328, 0x13b, 0);
  return null;
}

// Script 318: 1 argument.
export function* script318(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  function* sub5(in0) {
    local2 = in0 & 0xff;
    local3 = 0;
    for (;;) {
      yield* game.createObject(0x54, local2, 0, 0, 0x32b);
      local1 = truth(((yield* game.wait(0x801, 3)) & 0x800) !== 0) & 0xff;
      local3 = word(local3 + 1);
      if ((truth(less(local3, 3)) & (signed(local1) ^ 0xffff)) === 0) {
        if (signed(local1) === 0) {
          local1 = truth(((yield* game.wait(0x801, 0x18)) & 0x800) !== 0) & 0xff;
        }
        return;
      }
    }
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectAnimation(local0, word(((yield* game.randomByte()) & 3) + 5));
  } else {
    yield* game.setObjectAnimation(local0, word(((yield* game.randomByte()) & 3) + 3));
  }
  yield* game.setObjectRecordCount(local0, 0xf);
  yield* game.appendToFightList(local0);
  for (;;) {
    local1 = truth(((yield* game.wait(0x801, 6)) & 0x800) !== 0) & 0xff;
    if ((truth(less(yield* game.getDistanceToPlayer(local0), 0x50)) | signed(local1)) !== 0) {
      if (signed(local1) === 0) {
        yield* sub5(local0);
      }
      if (signed(local1) !== 0) {
        yield* game.addKarma(5);
        yield* game.fightListRemove(local0);
        yield* game.setObjectFlags(local0, 0);
        yield* game.clearObjectTask(local0);
        return null;
      }
    }
  }
}

// Script 319: 1 argument.
export function* script319(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x200 | local0, 0x403, 0x24a));
  return null;
}

// Script 31A: 1 argument.
export function* script31A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 3);
  yield* script(0x2a6, local0, 1, 1, 0);
  return null;
}

// Script 31B: 1 argument.
export function* script31B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0,
    local5 = 0,
    local7 = 0,
    local8 = 0,
    local9 = 0,
    local11 = 0,
    local13 = 0,
    local15 = 0;
  function* sub5() {
    local1 = yield* game.getObjectCoarseX(local0);
    local3 = yield* game.getObjectCoarseY(local0);
    local5 = yield* game.getObjectCoarseHeight(local0);
    local7 = (yield* game.createObject(0x66, local1, local3, local5, 0x1b8)) & 0xff;
    yield* game.setObjectPosition(
      local0,
      shiftLeft(local1, 2),
      shiftLeft(word(local3 + 9), 2),
      shiftLeft(local5, 2),
    );
    yield* game.setObjectActionAndDirection(local0, 0, 4);
    local8 = 0;
    yield* game.wait(1, 1);
    for (;;) {
      const t1 = yield* game.chooseEnemyTarget(local0);
      local15 = t1 & 0xff;
      if (t1 !== 0xffff) {
        yield* game.setObjectAnimation(local7, 0);
        yield* game.turnObjectToObject(local7, signed(local15));
        const t2 = yield* game.getObjectDirection(local7);
        local8 = t2 & 0xff;
        if (t2 !== 0) {
          if (local8 !== 1) {
            if (local8 !== 2) {
              if (local8 !== 3) {
                if (local8 !== 4) {
                  if (local8 !== 5) {
                    if (local8 !== 6) {
                      if (local8 === 7) {
                        local9 = 7;
                        local11 = 0xfff9;
                      }
                    } else {
                      local9 = 9;
                      local11 = 0;
                    }
                  } else {
                    local9 = 7;
                    local11 = 7;
                  }
                } else {
                  local9 = 0;
                  local11 = 9;
                }
              } else {
                local9 = 0xfff9;
                local11 = 7;
              }
            } else {
              local9 = 0xfff7;
              local11 = 0;
            }
          } else {
            local9 = 0xfff9;
            local11 = 0xfff9;
          }
        } else {
          local9 = 0;
          local11 = 0xfff7;
        }
        yield* game.setObjectPosition(
          local0,
          shiftLeft(word(local1 + local9), 2),
          shiftLeft(word(local3 + local11), 2),
          shiftLeft(local5, 2),
        );
        yield* game.setObjectActionAndDirection(local0, 0, local8);
        const t3 = yield* game.getDistanceBetweenObjects(local7, signed(local15));
        local13 = t3;
        if (!less(local13, 0x64)) {
          if (!less(local13, 0x96)) {
            if (less(local13, 0xc8)) {
              if (((yield* game.wait(0x801, 0xf)) & 0x800) !== 0) {
                return;
              }
            }
          } else {
            if (((yield* game.wait(0x801, 0xa)) & 0x800) !== 0) {
              return;
            }
          }
        } else {
          if (((yield* game.wait(0x801, 5)) & 0x800) !== 0) {
            return;
          }
        }
        yield* game.setObjectAnimation(local7, 4);
        yield* game.playSoundEffect(local0, 0x40, 0xff, 3);
        yield* game.shootAtObject(local0, signed(local15), 1, 1, 7, 2);
        if (((yield* game.wait(0x801, word(0xc + (yield* game.randomBelow(5))))) & 0x800) !== 0) {
          return;
        }
      } else {
        if (((yield* game.wait(0x801, 0x3c)) & 0x800) !== 0) {
          return;
        }
      }
    }
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 2);
  yield* game.appendToFightList(local0);
  yield* game.setObjectArmour(local0, 3);
  yield* game.setObjectRecordCount(local0, word(0x1e + (yield* game.randomBelow(0x14))));
  yield* sub5();
  yield* game.setObjectActionAndDirection(local7, 0, local8);
  yield* game.addKarma(6);
  yield* game.fightListRemove(local0);
  yield* game.setObjectDirection(local0, 6);
  yield* script(0x068, local0);
  return null;
}

// Script 31C: no arguments.
export function* script31C(state) {
  yield* game.notice(6, 2, 0x12, 3, 0, 0x212, 1);
  yield* game.confirmKey();
  yield* game.wait(1, 1);
  return null;
}

// Script 31D: 1 argument.
export function* script31D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x2f2, local0, 1, 0, 2, 0);
  return null;
}

// Script 31E: 1 argument.
export function* script31E(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1c2, yield* script(0x10c, 0x500 | local0, 0x104, 0));
  return null;
}

// Script 31F: 2 arguments.
export function* script31F(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  function* sub7() {
    yield* game.setObjectAnimation(local0, 0);
    yield* game.wait(1, 2);
    yield* game.releaseObjectGraphics(local0);
    yield* game.wait(1, 2);
  }
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.setObjectDirection(local0, local1);
  for (;;) {
    yield* game.wait(1, word(0xc8 + ((yield* game.randomByte()) & 0x3f)));
    if ((yield* game.getScriptVariable(0x18)) === 0) {
      yield* game.setScriptVariable(0x18, 1);
    }
    yield* sub7();
    yield* sub7();
    yield* sub7();
    yield* sub7();
    if ((yield* game.getScriptVariable(0x18)) === 1) {
      yield* game.setScriptVariable(0x18, 0);
    }
    if (((yield* game.randomByte()) & 1) === 0) {
      yield* game.setObjectAnimation(local0, 0);
    } else {
      yield* game.releaseObjectGraphics(local0);
    }
  }
}
