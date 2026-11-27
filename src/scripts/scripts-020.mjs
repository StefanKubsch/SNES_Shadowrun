// Scripts 020 to 03F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, multiply, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 020: no arguments.
export function* script020(state) {
  const t1 = yield* run.byNegotiation(0x2710, 0x2328, 0x1f40);
  const t2 = yield* run.byNegotiationB(0x152, 0x153, 0x154);
  yield* run.script162(0x1b6d, t2, t1, 0x151, 0x150);
  return null;
}

// Script 021: 1 argument.
export function* script021(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0xa);
  if (
    (yield* game.getObjectCoarseHeight(yield* game.getPlayerObjectCopy())) !==
    (yield* game.getObjectCoarseHeight(object))
  ) {
    yield* game.removeObject(object);
  } else {
    yield* run.fightAndDropNuyen(object);
  }
  return null;
}

// Script 022: 1 argument.
export function* script022(state, arg0) {
  let count = 0,
    object = 0,
    object2 = 0;
  block225: {
    count = arg0;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (less(state.byte('FREEZE_SPELLS_ACTIVE'), 4)) {
      if ((yield* game.isInFightList(state.byte('AIM_TARGET_OBJECT'))) !== 0) {
        if ((yield* game.spendMagic(word(4 + count))) !== 0) {
          state.setByte('FREEZE_SPELLS_ACTIVE', 0, word(state.byte('FREEZE_SPELLS_ACTIVE') + 1));
          object = state.byte('AIM_TARGET_OBJECT') & 0xff;
          yield* game.haltObject(state.byte('AIM_TARGET_OBJECT'));
          yield* game.wait(EVENT.TIMER, 1);
          const t1 = yield* game.getObjectCoarseHeight(object);
          const t2 = word((yield* game.getObjectCoarseY(object)) - 4);
          const t3 = word((yield* game.getObjectCoarseX(object)) - 4);
          const t4 = yield* game.createObject(0xc3, t3, t2, t1, 0xa1);
          object2 = t4 & 0xff;
          yield* run.script0DB(t4);
          yield* game.playSoundEffect(object2, 0x36, 0xff, 0xff);
          yield* game.wait(EVENT.TIMER, 1);
          yield* game.updateObjectDepthMode(object2);
          count = word(multiply(count, 0x12c) - 0x78);
          for (;;) {
            yield* game.haltObject(object);
            yield* game.wait(EVENT.TIMER, 1);
            count = word(count - 1);
            if (count <= 0) {
              count = 0x78;
              for (;;) {
                yield* game.haltObject(object);
                yield* game.wait(EVENT.TIMER, 1);
                const t5 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
                const t6 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 0x10);
                const t7 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) - 0x10);
                yield* game.setObjectPosition(object2, t7, t6, t5);
                yield* game.haltObject(object);
                yield* game.wait(EVENT.TIMER, 1);
                yield* game.setObjectPosition(object2, 0, 0, 0);
                count = word(count - 2);
                if (count <= 0) {
                  yield* game.resumeObject(object);
                  yield* game.removeObject(object2);
                  state.setByte(
                    'FREEZE_SPELLS_ACTIVE',
                    0,
                    word(state.byte('FREEZE_SPELLS_ACTIVE') - 1),
                  );
                  break block225;
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

// Script 023: 1 argument.
export function* script023(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x301, 0x23c, 0x403, 0x903));
  return null;
}

// Script 024: 1 argument.
export function* script024(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 0x1e);
  yield* run.script0FB(object, 3);
  return null;
}

// Script 025: 1 argument.
export function* script025(state, arg0) {
  let object = 0;
  block66: {
    object = arg0 & 0xff;
    if ((yield* game.getScriptVariable(0x2c)) === 0) {
      yield* game.keepObjectFlagBits(object, 0xdfff);
      yield* game.keepActorStateFlagBits(0x1696, 0xfffe);
      yield* game.setObjectActionAndDirection(object, 0, 4);
      yield* game.setObjectDialog(object, 0x33);
      for (;;) {
        yield* game.wait(EVENT.TIMER | EVENT.TALK, 6);
        if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
          yield* game.raiseStoryStage(5);
          yield* game.setObjectRecordFlags(object, 0);
          yield* game.changeScene(2, 0, 0xf3);
          break block66;
        }
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 026: 1 argument.
export function* script026(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.releaseGlove();
  if ((yield* game.getScriptVariable(0x2c)) !== 1) {
    if ((yield* game.getScriptVariable(0x2c)) !== 2) {
      if ((yield* game.getScriptVariable(0x2c)) !== 3) {
        if ((yield* game.getScriptVariable(0x2c)) !== 4) {
          if ((yield* game.getScriptVariable(0x2c)) !== 5) {
            if ((yield* game.getScriptVariable(0x2c)) !== 6) {
              if ((yield* game.getScriptVariable(0x2c)) !== 7) {
                if ((yield* game.getScriptVariable(0x2c)) !== 8) {
                  if ((yield* game.getScriptVariable(0x2c)) !== 9) {
                    if ((yield* game.getScriptVariable(0x2c)) !== 0xa) {
                      if ((yield* game.getScriptVariable(0x2c)) !== 0xb) {
                        if ((yield* game.getScriptVariable(0x2c)) !== 0xc) {
                          if ((yield* game.getScriptVariable(0x2c)) === 0xd) {
                            yield* run.script1D1(object);
                          }
                        } else {
                          yield* run.script097(object);
                        }
                      } else {
                        yield* run.script183(object);
                      }
                    } else {
                      yield* run.script2ED(object);
                    }
                  } else {
                    yield* run.script1E5(object);
                  }
                } else {
                  yield* run.script1C9(object);
                }
              } else {
                yield* run.script02F(object);
              }
            } else {
              yield* run.script374(object);
            }
          } else {
            yield* run.script28B(object);
          }
        } else {
          yield* run.script270(object);
        }
      } else {
        yield* run.script0BB(object);
      }
    } else {
      yield* run.script366(object);
    }
  } else {
    yield* run.script137(object);
  }
  return null;
}

// Script 027: 1 argument.
export function* script027(state, arg0) {
  let object = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.notice(2, 2, 0x16, 3, 0x400, 0x1e3 /* "Get this scum out of here." */, 0xb4);
  yield* game.setObjectArmour(object, 2);
  yield* game.setObjectRecordCount(object, 0x1e);
  yield* game.appendToFightList(object);
  for (;;) {
    yield* game.setObjectAnimation(object, 4);
    const t1 = yield* game.chooseEnemyTarget(object);
    local2 = t1 & 0xff;
    if (t1 !== 0xffff) {
      yield* game.shootAtObject(object, signed(local2), 4, 1, 5, 1);
      yield* game.playSoundEffect(object, 0x42, 0xff, 0xff);
    }
    if (((yield* game.wait(EVENT.TIMER | EVENT.HIT, 0x28)) & EVENT.HIT) !== 0) {
      yield* game.addKarma(0x12);
      yield* game.fightListRemove(object);
      yield* game.talk(object, 0x36);
      yield* game.setScriptVariable(0x28, word((yield* game.getScriptVariable(0x28)) + 1));
      yield* game.setActorStateFlagBits(0x769, 0x80);
      if (((yield* game.getActorStateFlags(0xd2e)) & 0x80) !== 0) {
        yield* game.notice(4, 4, 0x17, 3, 0, 0x1f3 /* "The decker finds 2,000 nuyen." */, 0xb4);
        yield* game.addNuyen(0x7d0);
        yield* run.script04B();
      }
      yield* run.leaveBodyAndResetRecord(object);
      return null;
    }
  }
}

// Script 028: 1 argument.
export function* script028(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(object, 0x204, 0, 0x403, 0x903));
  return null;
}

// Script 029: 1 argument.
export function* script029(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0FB(object, 4);
  return null;
}

// Script 02A: 1 argument.
export function* script02A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22c /* "Professor Pushkin was delivered alive this morning. He does ..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 02B: 2 arguments.
export function* script02B(state, arg0, arg1) {
  let object = 0,
    local1 = 0,
    created = 0,
    count2 = 0,
    count3 = 0,
    count = 0,
    local9 = 0,
    local11 = 0;
  function* sub10(in0) {
    count = in0;
    for (;;) {
      const t1 = word((yield* game.randomBelow(3)) - 1);
      const t2 = word((yield* game.randomBelow(3)) - 1);
      const t3 = yield* game.getPlayerObjectCopy();
      yield* game.setObjectVelocity(t3, t2, t1, 0);
      yield* game.wait(EVENT.TIMER, 1);
      if ((state.word('PAD_HELD') & 0xf0f0) === 0) {
        if (count === 0) {
          return 0;
        }
        count = word(count - 1);
      } else {
        return 0xffff;
      }
    }
  }
  function* sub64(in0, in1, in2) {
    count = in0;
    local9 = in1;
    local11 = in2 & 0xff;
    if (signed(local1) === 0) {
      const t7 = word((yield* game.getObjectCoarseHeight(object)) + 0x40);
      const t8 = word(local9 + (yield* game.getObjectCoarseY(object)));
      const t9 = word(count + (yield* game.getObjectCoarseX(object)));
      created = (yield* game.createObject(0x110, t9, t8, t7, 0x7d)) & 0xff;
      yield* game.setObjectVelocity(created, 0x20, 0x20, 0);
    } else {
      const t4 = word((yield* game.getObjectCoarseHeight(object)) + 0x40);
      const t5 = word(word(local9 + (yield* game.getObjectCoarseY(object))) + 0x130);
      const t6 = word(word(count + (yield* game.getObjectCoarseX(object))) + 0x130);
      created = (yield* game.createObject(0x110, t6, t5, t4, 0x7d)) & 0xff;
      yield* game.setObjectVelocity(created, 0xffe0, 0xffe0, 0);
    }
    yield* game.setObjectActionAndDirection(created, 0, local11 & 0x7f);
    if ((local11 & 0x80) === 0) {
      yield* game.setSpriteMode(created, 1);
      const t10 = shiftLeft(word((yield* game.getObjectCoarseHeight(created)) - 0x40), 2);
      const t11 = shiftLeft(word((yield* game.getObjectCoarseY(created)) + 0x80), 2);
      const t12 = shiftLeft(word((yield* game.getObjectCoarseX(created)) + 0x40), 2);
      yield* game.setObjectPosition(created, t12, t11, t10);
    } else {
      yield* game.setSpriteMode(created, 0x8001);
    }
  }
  function* sub7() {
    count2 = 0;
    for (;;) {
      if ((yield* sub10(0x1e)) === 0) {
        yield* sub64(0x40, 0, 0);
        yield* sub64(0, 0, 0x81);
        yield* sub64(0, 0x40, 0x80);
        if ((yield* sub10(0x1e)) === 0) {
          if ((yield* game.randomBelow(2)) === 0) {
            if ((yield* game.randomBelow(2)) === 0) {
              yield* sub64(0x3c, 0, 2);
            } else {
              yield* sub64(4, 0, 2);
            }
          } else {
            yield* sub64(word((yield* game.randomBelow(0x1e)) + 0xa), 0, 3);
          }
          if (count2 !== 0) {
            count2 = word(count2 - 1);
          } else {
            yield* game.playSoundEffect(0xffff, 0x2a, 0xff, 3);
            count2 = 2;
          }
          if (count3 === 0) {
            return;
          }
          count3 = word(count3 - 1);
        } else {
          return;
        }
      } else {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.releaseGlove();
  yield* run.setLeaderOnly();
  const t13 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t14 = shiftLeft(word((yield* game.getObjectCoarseY(object)) - 0x20), 2);
  const t15 = shiftLeft(word((yield* game.getObjectCoarseX(object)) - 0x20), 2);
  yield* game.setObjectPosition(object, t15, t14, t13);
  count3 = 4;
  if ((yield* game.getScriptVariable(0x30)) !== 0xffff) {
    yield* game.notice(2, 2, 9, 3, 0, 0x11f /* "Next Stop:" */, 0x270f);
    yield* game.notice(0xb, 0x13, 0xa, 3, 0x400, yield* game.getScriptVariable(0x30), 0x270f);
    if ((yield* game.getScriptVariable(0x30)) === 0x123) {
      yield* game.notice(9, 0x16, 0xe, 3, 0x400, 0x124 /* "Maximum Security" */, 0x270f);
      state.setWord('COLOUR_REQUEST', 0, 4);
    }
  }
  yield* sub7();
  yield* game.playSoundEffect(0xffff, 0x2a, 0, 1);
  yield* game.playSoundEffect(0xffff, 0x2a, 0, 2);
  yield* game.changeRoom(yield* game.getScriptVariable(0x2e));
  return null;
}

// Script 02C: 1 argument.
export function* script02C(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectArmour(object, 2);
  yield* run.script399(object, 3, 5, word(0x46 + ((yield* game.randomByte()) & 0x1f)));
  return null;
}

// Script 02D: 1 argument.
export function* script02D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x203, 0, 0x403, 0x903));
  return null;
}

// Script 02E: 1 argument.
export function* script02E(state, arg0) {
  let object = 0,
    count = 0,
    local3 = 0,
    created = 0,
    dx = 0,
    dy = 0;
  function* sub5(in0, in1) {
    dx = in0;
    dy = in1;
    yield* game.setObjectVelocity(object, dx, dy, 0);
    yield* game.wait(EVENT.TIMER, 4);
  }
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 5, 0);
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.keepObjectFlagBits(object, 0xffdf);
  count = 2;
  local3 = yield* game.randomBelow(2);
  for (;;) {
    if (local3 !== 2) {
      if (local3 !== 1) {
        yield* sub5(4, 0x10);
        yield* sub5(4, 8);
        yield* sub5(4, 0x10);
        yield* sub5(0, 0x10);
        yield* sub5(0xfffc, 0x10);
      }
      yield* sub5(0xfffc, 8);
      yield* sub5(0xfffc, 8);
    }
    yield* sub5(0xfffc, 0x10);
    yield* sub5(0, 0x10);
    yield* sub5(4, 0x10);
    yield* sub5(4, 8);
    yield* sub5(4, 8);
    count = word(count - 1);
    local3 = 0;
    if (count === 0) {
      yield* game.setScriptVariableBits(0x14, 4);
      created = (yield* game.createObject(0xb8, 0x64, 0x64, 0x40, 0x382)) & 0xff;
      yield* game.placeObjectOnWaypoint(created, word(2 + (yield* game.randomBelow(5))));
      yield* game.setSpriteMode(created, 0x8001);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 02F: 1 argument.
export function* script02F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.walkToWaypoint(object, 1);
  yield* run.walkToWaypoint(object, 0);
  yield* run.shootRandomTargets(object, 6);
  yield* run.goToRoom(0xb3);
  return null;
}

// Script 030: 1 argument.
export function* script030(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script1AD(object, 4, 0x50, 0x68, 0);
  return null;
}

// Script 031: 1 argument.
export function* script031(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.clearObjectTask(object);
  return null;
}

// Script 032: 1 argument.
export function* script032(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x304, 0, 0x403, 0x903));
  return null;
}

// Script 033: 1 argument.
export function* script033(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x302, 0, 0x403, 0x903));
  return null;
}

// Script 034: 1 argument.
export function* script034(state, arg0) {
  let object = 0,
    object2 = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x60);
  object2 = (yield* game.getObjectCoarseX(object)) & 0xff;
  yield* game.setObjectAnimation(object, 7);
  if (((yield* game.randomByte()) & 1) === 0) {
    yield* game.setObjectDirection(object, 5);
  } else {
    yield* game.setObjectDirection(object, 1);
  }
  yield* game.wait(EVENT.TIMER, 0x3c);
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object2), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object2), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object2), 2);
  yield* game.setObjectPosition(object, t3, t2, t1);
  yield* game.addObjectHeight(object, 0x20);
  yield* game.playSoundEffect(object, 4, 0xff, 3);
  const t4 = yield* game.chooseEnemyTarget(object);
  local2 = t4 & 0xff;
  if (t4 !== 0xffff) {
    yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsObject(object, signed(local2)));
    if (less(yield* game.getDistanceBetweenObjects(object, signed(local2)), 0x14)) {
      yield* game.shootAtObject(object, signed(local2), 3, 5, 3, 3);
    }
    yield* game.wait(EVENT.TIMER, 5);
  } else {
    yield* game.wait(
      EVENT.TIMER,
      yield* game.jumpObjectTowardsObject(object, yield* game.getPlayerObject()),
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 035: 1 argument.
export function* script035(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x402, 0, 0x403, 0x903));
  return null;
}

// Script 036: 1 argument.
export function* script036(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x400 | local0, 0x203, 0, 0x403, 0x903));
  return null;
}

// Script 037: 1 argument.
export function* script037(state, arg0) {
  let count = 0,
    local2 = 0,
    object = 0;
  block238: {
    count = arg0;
    yield* game.endDialog();
    if (less(state.byte('FREEZE_SPELLS_ACTIVE'), 4)) {
      if ((yield* game.spendMagic(word(4 + count))) !== 0) {
        const t1 = yield* game.spellGloveTarget();
        local2 = t1 & 0xff;
        if ((truth(t1 === 0xffff) | ((yield* game.isInFightList(signed(local2))) ^ 0xffff)) === 0) {
          state.setByte('FREEZE_SPELLS_ACTIVE', 0, word(state.byte('FREEZE_SPELLS_ACTIVE') + 1));
          yield* game.haltObject(signed(local2));
          yield* game.wait(EVENT.TIMER, 1);
          const t2 = yield* game.getObjectCoarseHeight(signed(local2));
          const t3 = word((yield* game.getObjectCoarseY(signed(local2))) - 4);
          const t4 = word((yield* game.getObjectCoarseX(signed(local2))) - 4);
          const t5 = yield* game.createObject(0xc3, t4, t3, t2, 0xa1);
          object = t5 & 0xff;
          yield* run.script0DB(t5);
          yield* game.playSoundEffect(object, 0x36, 0xff, 0xff);
          yield* game.wait(EVENT.TIMER, 1);
          yield* game.updateObjectDepthMode(object);
          count = word(multiply(count, 0x12c) - 0x78);
          for (;;) {
            yield* game.haltObject(signed(local2));
            yield* game.wait(EVENT.TIMER, 1);
            count = word(count - 1);
            if (count <= 0) {
              count = 0x78;
              for (;;) {
                yield* game.haltObject(signed(local2));
                yield* game.wait(EVENT.TIMER, 1);
                const t6 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                const t7 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 0x10);
                const t8 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 0x10);
                yield* game.setObjectPosition(object, t8, t7, t6);
                yield* game.haltObject(signed(local2));
                yield* game.wait(EVENT.TIMER, 1);
                yield* game.setObjectPosition(object, 0, 0, 0);
                count = word(count - 2);
                if (count <= 0) {
                  yield* game.resumeObject(signed(local2));
                  yield* game.removeObject(object);
                  state.setByte(
                    'FREEZE_SPELLS_ACTIVE',
                    0,
                    word(state.byte('FREEZE_SPELLS_ACTIVE') - 1),
                  );
                  break block238;
                }
              }
            }
          }
        } else {
          yield* game.addMagicPoints(word(4 + count));
        }
      }
    }
  }
  return null;
}

// Script 038: 1 argument.
export function* script038(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x2d);
    yield* game.wait(EVENT.TIMER, 0xa);
    yield* game.appendToFightList(object);
    yield* game.setObjectArmour(object, 1);
    yield* run.script1C7(0x600 | object, 6, 0, 0x305, 0x250);
    yield* game.addKarma(0x1f);
    yield* game.fightListRemove(object);
    yield* run.leaveBodyAndResetRecord(object);
    yield* game.setActorStateHolder(0x23e, 0x1538);
    yield* game.setActorStateFlagBits(0x1b66, 0x20);
    yield* game.wait(EVENT.TIMER, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 039: 1 argument.
export function* script039(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen15F(yield* run.script27C(0x200 | local0, 0x503, 0, 0x403, 0x903));
  return null;
}

// Script 03A: 1 argument.
export function* script03A(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.lightSwitch(object, 1);
  return null;
}

// Script 03B: 1 argument.
export function* script03B(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x140);
  yield* game.setObjectDialog(object, 0x58);
  yield* run.script0AE(object);
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* run.script36D(object, 0x3c, 0xdc, 0x1e);
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 03C: 1 argument.
export function* script03C(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* run.script245(object);
  local1 = 0;
  for (;;) {
    if (((yield* game.wait(EVENT.PICK_UP | EVENT.EXAMINE, 0)) & EVENT.EXAMINE) === 0) {
      if ((yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy())) <= 0x1d0) {
        yield* game.addActorStateCount(0x395, 1);
        yield* game.setActorStateHolder(0x395, 0x8b2);
        yield* game.resetObjectRecordProperty(object);
        yield* run.script04B();
        local1 = 255;
      } else {
        yield* run.noticeTooFarAway();
      }
    } else {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x8d /* "This is a healing patch." */, 0xf0);
    }
    if (signed(local1) !== 0) {
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 03D: 1 argument.
export function* script03D(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0) {
    local2 = in0;
    for (;;) {
      if (((yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.HIT, 6)) & EVENT.HIT) !== 0) {
        local1 = 255;
      }
      if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
        if (
          !less(
            word((yield* game.getObjectCoarseY(object)) + local2),
            yield* game.getObjectCoarseY(yield* game.getPlayerObjectCopy()),
          )
        ) {
          if (signed(local1) !== 0) {
            return 0;
          }
        } else {
          return 0;
        }
      } else {
        return 0xffff;
      }
    }
  }
  object = arg0 & 0xff;
  if ((yield* game.isTopicKnown(0x1c /* "Laughlyn" */)) === 0) {
    yield* game.setObjectRecordCount(object, 0);
    yield* game.setObjectFlagBits(object, 0x40);
    yield* game.setObjectActionAndDirection(object, 0, 6);
    yield* game.setObjectArmour(object, 3);
    local1 = 0;
    yield* game.setObjectDialog(object, 0x1e);
    if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) === 0) {
      if (((yield* sub5(0x14)) | signed(local1)) === 0) {
        yield* game.notice(
          4,
          2,
          0x19,
          3,
          0x400,
          0x1c0 /* "Excuse me, where are you going?" */,
          0x64,
        );
        if ((yield* sub5(0x32)) === 0) {
          yield* game.setActorStateFlags(0xdc1, 0x40);
        }
      }
    }
    if (signed(local1) !== 0) {
      yield* game.setActorStateFlags(0xdc1, 0x40);
    }
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      block242: {
        if (((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) {
          yield* game.setObjectRecordCount(object, 0x3c);
          yield* game.appendToFightList(object);
          for (;;) {
            yield* game.setObjectAnimation(object, 0);
            yield* game.wait(EVENT.TIMER, 0x14);
            const t1 = yield* run.script221(object);
            local1 = t1 & 0xff;
            if (t1 !== 0) {
              yield* game.addKarma(0xa);
              yield* game.fightListRemove(object);
              break block242;
            }
          }
        }
      }
      yield* run.dropNuyen15F(yield* run.leaveBodyAndResetRecord(object));
    } else {
      yield* game.keepObjectFlagBits(object, 0xdfff);
      yield* game.clearObjectTask(object);
    }
    return null;
  }
  yield* game.resetObjectRecordProperty(object);
  yield* game.removeObject(object);
  return null;
}

// Script 03E: 1 argument.
export function* script03E(state, arg0) {
  let object = 0,
    local2 = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0);
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setObjectAnimation(object, 5);
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.addObjectHeight(object, 0x20);
  const t1 = yield* game.chooseEnemyTarget(object);
  local2 = t1 & 0xff;
  if (t1 !== 0xffff) {
    yield* game.playSoundEffect(object, 4, 0xff, 3);
    yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsObject(object, signed(local2)));
    if (!less(yield* game.getDistanceBetweenObjects(object, signed(local2)), 0xf)) {
      yield* game.wait(EVENT.TIMER, 6);
      yield* game.createObject(0xd7 /* "Poison Ooze" */, object, signed(local2), 0, 0x16);
    } else {
      yield* game.shootAtObject(object, signed(local2), 3, 4, 3, 3);
      yield* game.setObjectDirection(object, 0);
    }
    yield* game.wait(EVENT.TIMER, 5);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 03F: 3 arguments, returns a word.
export function* byNegotiation(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  if (!less(state.byte('JAKE_NEGOTIATION'), 3)) {
    if (!(state.byte('JAKE_NEGOTIATION') > 2 && less(state.byte('JAKE_NEGOTIATION'), 5))) {
      return local4;
    }
    return local2;
  }
  return local0;
}
