// Scripts 340 to 35F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, shiftLeft, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 340: 1 argument.
export function* script340(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectFlagBits(object, 0x100);
  yield* game.setObjectDialog(object, 9);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 341: 1 argument.
export function* script341(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script28D(object, 0x101, 0xbb8, 0x658, 0);
  return null;
}

// Script 342: 1 argument.
export function* examineDgcPanel(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    if (((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) !== 0) {
      yield* game.notice(5, 0x15, 0x16, 3, 0x800, 0x11b /* "The panel logo reads: D-G-C" */, 0xf0);
    }
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
      return null;
    }
  }
}

// Script 343: 1 argument.
export function* script343(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0;
  block161: {
    object = arg0 & 0xff;
    if (((yield* game.getActorStateFlags(0xdc1)) & 2) === 0) {
      if (
        (truth(((yield* game.getActorStateFlags(0xdc1)) & 0x40) !== 0) |
          truth(((yield* game.getActorStateFlags(0xdc1)) & 0x20) !== 0)) ===
        0
      ) {
        yield* game.setObjectActionAndDirection(object, 0, 2);
        for (;;) {
          local1 = truth(((yield* game.wait(EVENT.TIMER | EVENT.HIT, 6)) & EVENT.HIT) !== 0) & 0xff;
          if ((truth(less(yield* game.getDistanceToPlayer(object), 0x32)) | signed(local1)) !== 0) {
            block151: {
              yield* game.setObjectDirection(object, 6);
              yield* game.wait(EVENT.TIMER, 0x1e);
              if (signed(local1) === 0) {
                yield* game.talk(object, 0x39);
                for (;;) {
                  const t1 = yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.HIT, 6);
                  local2 = t1;
                  local1 = truth((local2 & 0x800) !== 0) & 0xff;
                  if ((local2 & 2) !== 0) {
                    yield* game.talk(object, 0x39);
                  }
                  if (((yield* game.isActorStateProperty(0x149, 0x999)) | signed(local1)) !== 0) {
                    break block151;
                  }
                }
              }
            }
            if (signed(local1) !== 0) {
              break block161;
            }
            yield* game.talk(object, 0x3a);
            break block161;
          }
        }
      } else {
        yield* game.resetObjectRecordProperty(object);
        yield* game.removeObject(object);
        return null;
      }
    } else {
      yield* game.setObjectActionAndDirection(object, 0, 2);
    }
  }
  if (((yield* game.getActorStateFlags(0xdc1)) & 4) === 0) {
    yield* game.setActorStateFlagBits(0xdc1, 0x20);
    yield* game.setActorStateFlagBits(0xdc1, 4);
    yield* game.keepActorStateFlagBits(0xabf, 0xff7f);
    yield* game.setObjectDirection(object, 6);
    yield* game.wait(EVENT.TIMER, 0x32);
    yield* game.setObjectAnimation(object, 1);
    yield* game.moveObjectToWaypoint(object, 0);
    yield* game.wait(EVENT.TIMER, 0x14);
    const t2 = yield* game.getObjectCoarseHeight(object);
    const t3 = yield* game.getObjectCoarseY(object);
    const t4 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0x6b /* "Vampire!" */, t4, t3, t2, 0xbf);
    yield* game.wait(EVENT.TIMER, 1);
    yield* game.resetObjectRecordProperty(object);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 344: no arguments.
export function* script344(state) {
  yield* game.setActorStateFlagBits(0x191a, 1);
  return null;
}

// Script 345: 2 arguments.
export function* sealedDoor(state, arg0, arg1) {
  let object = 0,
    actor = 0;
  object = arg0 & 0xff;
  actor = arg1;
  yield* game.setObjectDirection(object, 5);
  for (;;) {
    block132: {
      if (((yield* game.getActorStateFlags(actor)) & 1) === 0) {
        yield* game.setObjectFlagBits(object, 0x100);
        yield* game.setObjectAnimation(object, 1);
        for (;;) {
          if ((yield* game.wait(EVENT.TIMER | EVENT.EXAMINE | EVENT.OPEN, 0xa)) !== 1) {
            yield* game.notice(
              7,
              0x15,
              0x13,
              3,
              0x800,
              0x1f9 /* "It's electronically sealed." */,
              0xc8,
            );
          }
          if (((yield* game.getActorStateFlags(actor)) & 1) !== 0) {
            yield* game.playSoundEffect(object, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(object, 2);
            break block132;
          }
        }
      } else {
        yield* game.keepObjectFlagBits(object, 0xfeff);
        yield* game.setObjectAnimation(object, 0);
        for (;;) {
          yield* game.wait(EVENT.TIMER, 0xa);
          if (((yield* game.getActorStateFlags(actor)) & 1) === 0) {
            yield* game.playSoundEffect(object, 0x30, 0xff, 3);
            yield* game.setObjectAnimation(object, 3);
            break block132;
          }
        }
      }
    }
    yield* game.wait(EVENT.ANIMATION_END, 0);
  }
}

// Script 346: 1 argument.
export function* script346(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(object, 0x1b, 0x1388, 0x14);
  if (state.byte('JAKE_MAGIC') === 0) {
    state.setByte('JAKE_MAGIC', 0, 0xa);
    yield* game.raiseMemberMagicPoints(yield* game.getPlayerObjectCopy(), 0x64);
  }
  if (state.byte('JAKE_SUMMON_SPIRIT') === 0) {
    state.setByte('JAKE_SUMMON_SPIRIT', 0, 1);
  }
  if (state.byte('JAKE_FREEZE') === 0) {
    state.setByte('JAKE_FREEZE', 0, 1);
  }
  if (state.byte('JAKE_ARMOUR_SPELL') === 0) {
    state.setByte('JAKE_ARMOUR_SPELL', 0, 1);
  }
  if (state.byte('JAKE_POWERBALL') === 0) {
    state.setByte('JAKE_POWERBALL', 0, 1);
  }
  if (state.byte('JAKE_INVISIBILITY') === 0) {
    state.setByte('JAKE_INVISIBILITY', 0, 1);
  }
  return null;
}

// Script 347: 1 argument.
export function* script347(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    if (
      ((yield* game.wait(
        EVENT.TIMER | EVENT.TALK,
        word(((yield* game.randomByte()) & 0x7f) + 0x64),
      )) &
        EVENT.TALK) !==
      0
    ) {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x63 /* "There's no response..." */, 0x78);
    }
    yield* game.releaseObjectGraphics(object);
    yield* game.setObjectActionAndDirection(object, 0, 7);
    if (
      ((yield* game.wait(
        EVENT.TIMER | EVENT.TALK,
        word(((yield* game.randomByte()) & 0x7f) + 0x64),
      )) &
        EVENT.TALK) !==
      0
    ) {
      yield* game.notice(2, 0x15, 0x12, 3, 0x800, 0x63 /* "There's no response..." */, 0x78);
    }
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 348: 1 argument.
export function* script348(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script0AE(object);
  yield* game.setObjectFlagBits(object, 0x100);
  yield* game.setObjectDialog(object, 0xa);
  yield* game.wait(EVENT.TALK, 0);
  return null;
}

// Script 349: 1 argument.
export function* script349(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script28D(object, 0x102, 0x1770, 0x1944, 0);
  return null;
}

// Script 34A: 1 argument.
export function* script34A(state, arg0) {
  let object = 0,
    local1 = 0,
    actor = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
    const t1 = yield* game.scriptAction(0x180);
    local1 = t1;
    if ((local1 & 0x80) === 0) {
      if ((local1 & 0x100) !== 0) {
        yield* run.promptUseOn();
        const t2 = yield* game.chooseNumber();
        actor = t2;
        if (actor !== 0xffff) {
          if (actor !== 0x666) {
            yield* run.refuseToUseOn(actor);
          } else {
            yield* game.wait(EVENT.TIMER, 1);
            yield* game.setActorStateFlagBits(actor, 0x80);
            yield* game.setObjectRecordFlagBits(object, 1);
          }
        }
      }
    } else {
      yield* game.playSoundEffect(object, 0x32, 0xff, 3);
      if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
        yield* game.notice(9, 0x15, 0x10, 3, 0x800, 0x104 /* "The bottle is empty." */, 0xf0);
      } else {
        yield* game.notice(
          5,
          0x15,
          0x18,
          3,
          0x800,
          0x105 /* "The bottle contains incubus ink." */,
          0xf0,
        );
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 34B: 1 argument.
export function* script34B(state, arg0) {
  let created = 0,
    object = 0,
    local2 = 0;
  created = arg0 & 0xff;
  object = (yield* game.getObjectCoarseX(created)) & 0xff;
  local2 = (yield* game.getObjectCoarseY(created)) & 0xff;
  yield* game.setObjectActionAndDirection(created, 0, 0);
  const t1 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
  const t2 = shiftLeft(yield* game.getObjectCoarseY(object), 2);
  const t3 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
  yield* game.setObjectPosition(created, t3, t2, t1);
  yield* game.addObjectHeight(created, 0x20);
  yield* game.wait(EVENT.TIMER, yield* game.jumpObjectTowardsObject(created, signed(local2)));
  yield* game.removeObject(created);
  const t4 = yield* game.getObjectCoarseHeight(created);
  const t5 = yield* game.getObjectCoarseY(created);
  const t6 = yield* game.getObjectCoarseX(created);
  created = (yield* game.createObject(0xb8, t6, t5, t4, 0x382)) & 0xff;
  yield* game.wait(EVENT.TIMER, 0xa);
  yield* game.blast(created, 6);
  return null;
}

// Script 34C: 1 argument.
export function* script34C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script27C(0xa00 | local0, 0x709, 0, 0x804, 0xc06));
  return null;
}

// Script 34D: 1 argument.
export function* script34D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x800 | local0, 0x706, 0));
  return null;
}

// Script 34E: 1 argument.
export function* script34E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(object, 0x1c, 0x2710, 0x2a);
  return null;
}

// Script 34F: 1 argument.
export function* script34F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script28D(object, 0x103, 0x9c4, 0x32c, 0);
  return null;
}

// Script 350: 1 argument.
export function* script350(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.giveWeapon(object, 6, 3, 1, 1);
  return null;
}

// Script 351: 1 argument.
export function* script351(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = 64;
  for (;;) {
    yield* game.playSoundEffect(0xffff, 0x62, 0xff, 1);
    yield* game.wait(EVENT.TIMER, 0x14);
    const t1 = word(local1 - 1);
    local1 = word(local1 - 1) & 0xff;
    if (t1 === 0) {
      return null;
    }
  }
}

// Script 352: 1 argument.
export function* script352(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (less(yield* game.getDistanceToPlayer(object), 0x64)) {
    yield* game.notice(9, 2, 0xe, 3, 0, 0x67 /* "Grim Reaper Club." */, 0x78);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 353: 1 argument.
export function* script353(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(object, 0x1d, 0x4a38, 0x46);
  yield* game.addTopic(0x16 /* "Hiring" */);
  return null;
}

// Script 354: no arguments.
export function* script354(state) {
  const t1 = yield* run.byNegotiation(0x1f4, 0x190, 0x12c);
  const t2 = yield* run.byNegotiationB(0x17f, 0x180, 0x181);
  yield* run.script162(0xb3d, t2, t1, 0x17e, 0x17d);
  return null;
}

// Script 355: 1 argument.
export function* script355(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  if ((yield* game.hasObjectRecordProperty(object)) === 0) {
    yield* game.setObjectRecordFlags(object, object);
    yield* run.script245(object);
    local1 = 0;
    for (;;) {
      if (((yield* game.wait(EVENT.PICK_UP | EVENT.EXAMINE, 0)) & EVENT.EXAMINE) === 0) {
        yield* game.setObjectRecordPropertyFromGroup(object);
        yield* run.script04B();
        local1 = 255;
      } else {
        yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x4e /* "Worn Leather Jacket" */, 0xf0);
      }
      if (signed(local1) !== 0) {
        yield* game.removeObject(object);
        return null;
      }
    }
  } else {
    yield* game.setSpriteMode(object, 0);
    yield* run.script293(object);
    return null;
  }
}

// Script 356: 1 argument.
export function* script356(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x800 | local0, 0x607, 0));
  return null;
}

// Script 357: 1 argument.
export function* script357(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(object, 0x1e, 0x6590, 0x64);
  yield* game.setActorStateFlagBits(0x1c0e, 2);
  return null;
}

// Script 358: 1 argument.
export function* script358(state, arg0) {
  let object = 0,
    local1 = 0;
  block127: {
    object = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.setObjectActionAndDirection(object, 2, 5);
      yield* game.setObjectDialog(object, 0xb);
      local1 = 0;
      for (;;) {
        if (
          ((yield* game.wait(EVENT.TIMER | EVENT.TALK | EVENT.EXAMINE, 1)) & EVENT.EXAMINE) ===
          0
        ) {
          if ((yield* game.isActorStateProperty(0x185d, 0xbd7)) !== 0) {
            yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
            local1 = 255;
          }
        } else {
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0xaa /* "He looks very tired..." */, 0xf0);
        }
        if (signed(local1) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* run.script0AE(object);
          yield* game.setObjectDialog(object, 0xc);
          yield* game.wait(EVENT.TALK, 0);
          break block127;
        }
      }
    } else {
      yield* run.script0AE(object);
      yield* game.setObjectDialog(object, 0xc);
      yield* game.wait(EVENT.TALK, 0);
    }
  }
  return null;
}

// Script 359: 1 argument.
export function* script359(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* game.wait(EVENT.TIMER, 0x41);
  yield* game.setObjectActionAndDirection(object, 2, 0);
  yield* game.setObjectVelocity(object, 0, 2, 0);
  yield* game.wait(EVENT.TIMER, 0x41);
  yield* game.setObjectAnimation(object, 0);
  local1 = 3;
  loop48: for (;;) {
    local2 = 11;
    for (;;) {
      if ((local2 & 1) === 0) {
        if (((yield* game.randomByte()) & 1) === 0) {
          yield* game.setObjectVelocity(object, 0xfffe, 3, 0);
        } else {
          yield* game.setObjectVelocity(object, 0xfffe, 2, 0);
        }
      } else {
        if (((yield* game.randomByte()) & 1) === 0) {
          yield* game.setObjectVelocity(object, 2, 0xffff, 0);
        } else {
          yield* game.setObjectVelocity(object, 2, 0xfffe, 0);
        }
      }
      yield* game.wait(EVENT.TIMER, 1);
      if (local2 === 0) {
        yield* game.clearObjectVelocity(object);
        const t1 = yield* game.getObjectDirection(object);
        local3 = t1 & 0xff;
        if (t1 !== 0) {
          if (local3 !== 7) {
            if (local3 !== 6) {
              if (local3 === 5) {
                yield* game.setObjectDirection(object, 4);
              }
            } else {
              yield* game.setObjectDirection(object, 5);
            }
          } else {
            yield* game.setObjectDirection(object, 6);
          }
        } else {
          yield* game.setObjectDirection(object, 7);
        }
        yield* game.wait(EVENT.TIMER, 5);
        if (local1 === 0) {
          const t2 = word((yield* game.getObjectCoarseHeight(object)) - 0xa);
          const t3 = yield* game.getObjectCoarseY(object);
          const t4 = word((yield* game.getObjectCoarseX(object)) + 0xa);
          yield* game.createObject(0x25 /* "JAKE" */, t4, t3, t2, 0x67);
          yield* game.removeObject(object);
          return null;
        }
        local1 = word(local1 - 1) & 0xff;
        continue loop48;
      }
      local2 = word(local2 - 1) & 0xff;
    }
  }
}

// Script 35A: 1 argument.
export function* script35A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x800 | local0, 0x506, 0));
  return null;
}

// Script 35B: 1 argument.
export function* script35B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.dropNuyen164(yield* run.script10C(0x500 | local0, 0x406, 0));
  return null;
}

// Script 35C: no arguments.
export function* setLeaderOnly(state) {
  yield* game.wait(EVENT.TIMER, 2);
  state.setWord('GROUP_LEADER_ONLY', 0, 0xffff);
  return null;
}

// Script 35D: 1 argument, returns a word.
export function* leaveBodyAndResetRecord(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  const t1 = yield* game.getObjectCoarseHeight(object);
  const t2 = yield* game.getObjectCoarseY(object);
  local1 = (yield* game.createObject(0x99 /* "body" */, object, t2, t1, 0x90)) & 0xff;
  yield* game.wait(EVENT.TIMER, 5);
  yield* game.resetObjectRecordProperty(object);
  yield* game.removeObject(object);
  yield* game.wait(EVENT.TIMER, 0xa);
  return local1;
}

// Script 35E: 1 argument.
export function* script35E(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.rewardNuyenAndKarma(object, 0x1f, 0x84d0, 0x7d);
  return null;
}

// Script 35F: 1 argument.
export function* script35F(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    if (((yield* game.getObjectRecordFlags(object)) & 0x40) !== 0) {
      if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
        yield* game.wait(EVENT.TIMER, 0x23);
        if ((state.byte('DECKER_DOWNLOAD_BITS') & 1) !== 0) {
          yield* run.obtainDataFile(0x155b);
        }
        if ((state.byte('DECKER_DOWNLOAD_BITS') & 0x80) !== 0) {
          yield* run.noticeTrashDataDiscarded();
        }
        yield* game.keepObjectRecordFlagBits(object, 0xff7e);
      }
      yield* run.script0AE(object);
      yield* run.examineDgcPanel(object);
      yield* game.setObjectRecordFlagBits(object, 1);
      yield* run.jackIntoMatrix(object, 2, 0x1e8, 0, 4);
      return null;
    }
  }
}
