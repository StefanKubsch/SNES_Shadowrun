// Scripts 1E0 to 1FF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  EVENT,
  less,
  lessOrEqualSignedLeft,
  localByte,
  localWord,
  multiply,
  multiplySignedLeft,
  notEqualOrNegativeLeft,
  setLocalWord,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 1E0: 1 argument.
export function* script1E0(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  local1 = yield* game.scriptAction(0x180);
  if (local1 !== 0x80) {
    if (local1 === 0x100) {
      yield* game.endDialog();
      yield* game.wait(EVENT.TIMER, 0x14);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
      yield* game.wait(EVENT.TIMER, 5);
      state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
      yield* game.wait(EVENT.TIMER, 0xa);
      state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
      if ((yield* game.getCurrentRoomHeader()) === (yield* game.getRoomHeader(0x13d))) {
        yield* game.setActorStateFlagBits(0x188 /* "Vampire!" */, 0x80);
      }
    }
  } else {
    yield* game.notice(
      2,
      0x15,
      0x1c,
      3,
      0x800,
      0x1bb /* "It gives off a bright flash when used." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1E1: no arguments.
export function* script1E1(state) {
  yield* game.setActorStateFlagBits(0xcc5 /* "Helicopter Pilot" */, 1);
  return null;
}

// Script 1E2: 1 argument.
export function* script1E2(state, arg0) {
  let count = 0,
    object = 0,
    object2 = 0,
    local4 = 0;
  block435: {
    count = arg0;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (less(state.byte('ARMOUR_SPELLS_ACTIVE'), 4)) {
      if (
        ((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3 ||
        state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT')
      ) {
        if ((yield* game.spendMagic(word(4 + count))) !== 0) {
          state.setByte('ARMOUR_SPELLS_ACTIVE', 0, word(state.byte('ARMOUR_SPELLS_ACTIVE') + 1));
          object = state.byte('AIM_TARGET_OBJECT') & 0xff;
          const t1 = yield* game.getObjectCoarseHeight(object);
          const t2 = word((yield* game.getObjectCoarseY(object)) - 6);
          const t3 = word((yield* game.getObjectCoarseX(object)) - 6);
          const t4 = yield* game.createObject(0xc5 /* "Protected" */, t3, t2, t1, 0xa1);
          object2 = t4 & 0xff;
          yield* game.bindObjectToCurrentTask(t4);
          yield* run.script0DB(object2);
          count = multiplySignedLeft(count, 0x12c);
          yield* game.addObjectArmour(object, 0x1e);
          loop107: for (;;) {
            yield* game.playSoundEffect(object2, 8, 0xff, 0xff);
            yield* game.setObjectDirection(object2, 3);
            for (;;) {
              const t5 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
              const t6 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 6);
              const t7 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) - 6);
              yield* game.setObjectPosition(object2, t7, t6, t5);
              count = word(count - 1);
              if (
                ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) & EVENT.ANIMATION_END) !==
                0
              ) {
                yield* game.setObjectDirection(object2, 7);
                for (;;) {
                  const t8 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
                  const t9 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) + 6);
                  const t10 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) + 6);
                  yield* game.setObjectPosition(object2, t10, t9, t8);
                  count = word(count - 1);
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                      EVENT.ANIMATION_END) !==
                    0
                  ) {
                    if (!lessOrEqualSignedLeft(count, 0x78)) {
                      continue loop107;
                    }
                    loop234: for (;;) {
                      yield* game.playSoundEffect(object2, 8, 0xff, 0xff);
                      yield* game.setObjectDirection(object2, 3);
                      for (;;) {
                        const t11 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
                        const t12 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 4);
                        const t13 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) - 4);
                        yield* game.setObjectPosition(object2, t13, t12, t11);
                        const t14 = truth(
                          ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                            EVENT.ANIMATION_END) !==
                            0,
                        );
                        local4 = t14 & 0xff;
                        if (t14 === 0) {
                          yield* game.setObjectPosition(object2, 0, 0, 0);
                          local4 =
                            truth(
                              ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                EVENT.ANIMATION_END) !==
                                0,
                            ) & 0xff;
                        }
                        count = word(count - 2);
                        if (signed(local4) !== 0) {
                          yield* game.setObjectDirection(object2, 7);
                          for (;;) {
                            const t15 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
                            const t16 = word(
                              shiftLeft(yield* game.getObjectCoarseY(object), 2) + 6,
                            );
                            const t17 = word(
                              shiftLeft(yield* game.getObjectCoarseX(object), 2) + 6,
                            );
                            yield* game.setObjectPosition(object2, t17, t16, t15);
                            const t18 = truth(
                              ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                EVENT.ANIMATION_END) !==
                                0,
                            );
                            local4 = t18 & 0xff;
                            if (t18 === 0) {
                              yield* game.setObjectPosition(object2, 0, 0, 0);
                              local4 =
                                truth(
                                  ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                    EVENT.ANIMATION_END) !==
                                    0,
                                ) & 0xff;
                            }
                            count = word(count - 2);
                            if (signed(local4) !== 0) {
                              if (!lessOrEqualSignedLeft(count, 0)) {
                                continue loop234;
                              }
                              yield* game.subtractObjectArmour(object, 0x1e);
                              yield* game.removeObject(object2);
                              state.setByte(
                                'ARMOUR_SPELLS_ACTIVE',
                                0,
                                word(state.byte('ARMOUR_SPELLS_ACTIVE') - 1),
                              );
                              break block435;
                            }
                          }
                        }
                      }
                    }
                  }
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

// Script 1E3: no arguments.
export function* script1E3(state) {
  let local0 = 0,
    local2 = 0,
    text = 0,
    nuyen = 0;
  local0 = yield* game.getScriptVariable(0x1c);
  local2 = yield* game.getScriptVariable(0x1e);
  nuyen = 0xcadd;
  if (local0 !== 0xb21) {
    if (local0 !== 0x1952) {
      if (local0 !== 0x17c3) {
        if (local0 !== 0x150) {
          if (local0 !== 0x850) {
            if (local0 !== 0x261) {
              if (local0 !== 0x12f3) {
                if (local0 !== 0x13b) {
                  if (local0 !== 0x157) {
                    if (local0 !== 0x276) {
                      if (local0 !== 0x1a4) {
                        if (local0 !== 0xbf3) {
                          if (local0 !== 0x18a3) {
                            if (local0 !== 0x1696) {
                              if (local0 !== 0x770) {
                                if (local0 !== 0x129f) {
                                  if (local0 === 0x1b5f) {
                                    text = 0x13c;
                                    nuyen = 0x4e20;
                                  }
                                } else {
                                  text = 0x13b;
                                  nuyen = 0x3a98;
                                }
                              } else {
                                text = 0x138;
                                nuyen = 0x2328;
                              }
                            } else {
                              text = 0x136;
                              nuyen = 0x1770;
                            }
                          } else {
                            text = 0x134;
                            nuyen = 0xbb8;
                          }
                        } else {
                          text = 0x139;
                          nuyen = 0x2af8;
                        }
                      } else {
                        text = 0x13a;
                        nuyen = 0x36b0;
                      }
                    } else {
                      text = 0x136;
                      nuyen = 0x1770;
                    }
                  } else {
                    text = 0x131;
                    nuyen = 0x514;
                  }
                } else {
                  text = 0x135;
                  nuyen = 0xfa0;
                }
              } else {
                text = 0x130;
                nuyen = 0x3e8;
              }
            } else {
              text = 0x137;
              nuyen = 0x1d4c;
            }
          } else {
            text = 0x133;
            nuyen = 0x9c4;
          }
        } else {
          text = 0x132;
          nuyen = 0x7d0;
        }
      } else {
        text = 0x12f;
        nuyen = 0xc8;
      }
    } else {
      text = 0x12f;
      nuyen = 0xc8;
    }
  } else {
    text = 0x130;
    nuyen = 0x3e8;
  }
  if (nuyen !== 0xcadd) {
    if (local2 !== 0x13) {
      if (local2 !== 0x18) {
        if (local2 === 0x1d) {
          yield* game.topicText(0x260 /* "Hmm.. Okay. How about if I give you" */);
        }
      } else {
        yield* game.topicText(0x261 /* "Oh boy! You got a beauty there! I'll give ya" */);
      }
    } else {
      yield* game.topicText(0x262 /* "Quiet man, Okay. I'll give ya..." */);
    }
    yield* game.windowText(text);
    if (local2 !== 0x13) {
      if (local2 !== 0x18) {
        if (local2 === 0x1d) {
          yield* game.windowText(0x128 /* "for the item. Okay?" */);
        }
      } else {
        yield* game.windowText(0x127 /* "for it! Still wanna sell?" */);
      }
    } else {
      yield* game.windowText(0x126 /* ". Deal?" */);
    }
    if ((yield* game.question(0x14, 8)) === 0) {
      if (local2 !== 0x13) {
        if (local2 !== 0x18) {
          if (local2 === 0x1d) {
            yield* game.topicText(0x12e /* "Okay, no sale then." */);
          }
        } else {
          yield* game.topicText(
            0x12d /* "Awww, you're acting just like my mother-in-law! Wishy Washy!" */,
          );
        }
      } else {
        yield* game.topicText(0x12c /* "Too bad, I would have liked to have one of those!" */);
      }
    } else {
      if (local2 !== 0x13) {
        if (local2 !== 0x18) {
          if (local2 === 0x1d) {
            yield* game.topicText(0x12b /* "Okay, thank you." */);
          }
        } else {
          yield* game.topicText(
            0x12a /* "Sucker!! Just kiddin'. I never rip off my friends! HAR HAR!" */,
          );
        }
      } else {
        yield* game.topicText(0x129 /* "You'll never get a better deal anywhere!" */);
      }
      yield* game.setActorItemPropertyAndUnequip(local0, 0xbad);
      yield* game.addNuyen(nuyen);
    }
  } else {
    yield* game.topicText(0x125 /* "I've got a bad feeling about this, no DEAL!" */);
  }
  return null;
}

// Script 1E4: 1 argument.
export function* script1E4(state, arg0) {
  let object = 0,
    actor = 0,
    local3 = 0,
    local5 = 0;
  function* sub5(in0) {
    local5 = in0;
    return truth(((yield* game.getObjectRecordFlags(object)) & local5) !== 0);
  }
  object = arg0 & 0xff;
  yield* game.setObjectAnimation(object, 0);
  yield* game.turnObjectToPlayer(object);
  yield* game.wait(EVENT.TIMER, 2);
  for (;;) {
    if ((yield* sub5(1)) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0xfffe);
      yield* game.talk(object, 2);
    }
    if ((yield* sub5(2)) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0xfffd);
      yield* game.talk(object, 3);
    }
    if ((yield* sub5(0x20)) !== 0) {
      yield* game.keepObjectRecordFlagBits(object, 0xffdf);
      yield* game.talk(object, 4);
    }
    if (((yield* sub5(0x80)) & (yield* sub5(0x40))) === 0) {
      if ((yield* sub5(0x80)) !== 0) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.talk(object, 5);
      }
      if ((truth(less(yield* game.getScriptVariable(4), 0xa)) & (yield* sub5(4))) !== 0) {
        yield* game.keepObjectRecordFlagBits(object, 0xfffb);
        local3 = yield* game.getScriptVariable(4);
        if (local3 !== 0) {
          if (local3 !== 1) {
            if (local3 !== 2) {
              if (local3 !== 3) {
                if (local3 !== 4) {
                  if (local3 !== 5) {
                    if (local3 !== 6) {
                      if (local3 !== 7) {
                        if (local3 !== 8) {
                          if (local3 === 9) {
                            actor = 0xa95;
                          }
                        } else {
                          actor = 0x1f1;
                        }
                      } else {
                        actor = 0x1283;
                      }
                    } else {
                      actor = 0x137f;
                    }
                  } else {
                    actor = 0x620;
                  }
                } else {
                  actor = 0xae2;
                }
              } else {
                actor = 0xa5d;
              }
            } else {
              actor = 0xd43;
            }
          } else {
            actor = 0xce8;
          }
        } else {
          actor = 0x1267;
        }
        yield* game.setActorStateFlagBits(actor, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(EVENT.TIMER, 1);
      }
      if ((yield* sub5(8)) !== 0) {
        yield* game.keepObjectRecordFlagBits(object, 0xfff7);
        yield* game.setActorStateFlagBits(0x245 /* "The King" */, 0x80);
        yield* game.changeRoom(0x2c);
        yield* game.wait(EVENT.TIMER, 1);
      }
      if ((yield* sub5(0x80)) === 0) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.talk(object, 1);
      }
    } else {
      for (;;) {
        yield* game.wait(EVENT.TALK, 0);
        yield* game.notice(
          2,
          4,
          0x19,
          3,
          0x400,
          0xc7 /* "Buddy, nobody left to fight here!!" */,
          0x78,
        );
      }
    }
  }
}

// Script 1E5: 1 argument.
export function* endingScene9(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.setLeaderOnly();
  yield* run.shootRandomTargets(object, 4);
  yield* run.walkToWaypoint(object, 0);
  yield* game.setObjectAnimation(object, 0);
  yield* game.wait(EVENT.TIMER, 0x28);
  yield* game.notice(
    3,
    2,
    0x19,
    4,
    0x400,
    0xf9 /* "We could not allow you to escape. We HAD to stop you!" */,
    0x78,
  );
  yield* run.shootRandomTargets(object, 8);
  yield* run.nextEndingScene(0xb1);
  return null;
}

// Script 1E6: 1 argument.
export function* script1E6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.question(0x18, 5)) === 0) {
    yield* game.topicText(0xac /* "No? Oh come on, it doesn't cost that much..." */);
  } else {
    if ((yield* game.payNuyen(0x1f4)) === 0) {
      yield* game.topicText(
        0xad /* "Hey, look here, I don't work for free, if you ain't got the ..." */,
      );
    } else {
      yield* game.setActorStateFlagBits(0x317 /* "Street Doc" */, 0x80);
      yield* game.endDialog();
    }
  }
  return null;
}

// Script 1E7: 1 argument.
export function* script1E7(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x22f /* "The following target is moved to PRIORITY ONE termination : ..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1E8: 1 argument.
export function* script1E8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.blast(object, 0xf);
  yield* game.playSoundEffect(object, 0xa, 0xff, 3);
  yield* game.setSpriteMode(object, 1);
  yield* game.wait(EVENT.ANIMATION_END, 0);
  yield* game.removeObject(object);
  return null;
}

// Script 1E9: 1 argument.
export function* script1E9(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0;
  object = arg0 & 0xff;
  yield* game.wait(EVENT.TIMER, 6);
  if (state.word('GROUP_LEADER_ONLY') === 0) {
    local4 = 0;
    yield* game.setObjectRecordFlagBits(object, 0x80);
    yield* game.keepObjectFlagBits(object, 0xfe9f);
    yield* game.clearObjectVelocity(object);
    local5 = 0;
    for (;;) {
      if ((yield* game.hasFightTarget()) === 0) {
        yield* game.placeObjectInFormation(object);
        local5 = yield* game.wait(
          EVENT.TIMER | EVENT.TALK | EVENT.EXAMINE | EVENT.OPEN | EVENT.CLOSE | EVENT.DEFEATED,
          1,
        );
        if ((local5 & (EVENT.TALK | EVENT.EXAMINE | EVENT.OPEN | EVENT.CLOSE)) !== 0) {
          if ((local5 & 2) === 0) {
            if ((local5 & 0x80) === 0) {
              if ((local5 & 0x600) !== 0) {
                local5 = yield* run.runnerCastsSpell(object, 0x23, 0x1e);
              }
            } else {
              yield* game.statusScreen(object);
              local5 = yield* game.wait(
                EVENT.TIMER |
                  EVENT.TALK |
                  EVENT.EXAMINE |
                  EVENT.OPEN |
                  EVENT.CLOSE |
                  EVENT.DEFEATED,
                1,
              );
            }
          } else {
            yield* game.talk(object, 0x75);
            local5 = yield* game.wait(
              EVENT.TIMER | EVENT.TALK | EVENT.EXAMINE | EVENT.OPEN | EVENT.CLOSE | EVENT.DEFEATED,
              1,
            );
          }
        }
        local4 = truth((local5 & 0x800) !== 0) & 0xff;
      } else {
        block369: {
          if ((yield* game.hasNoObjectAnimation(object)) === 0) {
            local3 = 0;
            local1 = (yield* game.chooseRandomFightTarget(object)) & 0xff;
            for (;;) {
              block339: {
                if ((local5 & 0x4000) === 0) {
                  if ((local5 & 0x600) === 0) {
                    if ((local5 & 0x80) === 0) {
                      if ((local5 & 0x2000) !== 0) {
                        yield* run.promptTarget();
                        const t1 = yield* game.chooseUnderGlove(object);
                        local2 = t1 & 0xff;
                        if (t1 !== 0xffff) {
                          local1 = signed(local2) & 0xff;
                        }
                      }
                      if (signed(local1) !== 0xffff) {
                        yield* game.turnObjectToObject(object, signed(local1));
                        yield* game.setObjectAnimation(object, 7);
                        local5 = yield* game.wait(
                          EVENT.ANIMATION_END |
                            EVENT.EXAMINE |
                            EVENT.OPEN |
                            EVENT.CLOSE |
                            EVENT.DEFEATED |
                            EVENT.TARGET |
                            EVENT.MOVE_TO,
                          0,
                        );
                        if ((local5 & EVENT.ANIMATION_END) === 0) {
                          yield* game.setObjectAnimation(object, 0);
                        } else {
                          yield* game.setObjectAnimation(object, 4);
                          local5 = yield* game.wait(
                            EVENT.TIMER |
                              EVENT.EXAMINE |
                              EVENT.OPEN |
                              EVENT.CLOSE |
                              EVENT.DEFEATED |
                              EVENT.TARGET |
                              EVENT.MOVE_TO,
                            0x23,
                          );
                          if (
                            ((yield* game.canAttack(object, signed(local1))) &
                              truth((local5 & 1) !== 0)) ===
                            0
                          ) {
                            yield* game.setObjectAnimation(object, 0);
                          } else {
                            yield* game.turnObjectToObject(object, signed(local1));
                            yield* game.createObject(0x10a, object, signed(local1), 0, 0x12a);
                            yield* game.setObjectAnimation(object, 8);
                            local5 = yield* game.wait(
                              EVENT.TIMER |
                                EVENT.EXAMINE |
                                EVENT.OPEN |
                                EVENT.CLOSE |
                                EVENT.DEFEATED |
                                EVENT.TARGET |
                                EVENT.MOVE_TO,
                              0x3c,
                            );
                          }
                        }
                      } else {
                        yield* game.placeObjectInFormation(object);
                        local5 = yield* game.wait(
                          EVENT.TIMER |
                            EVENT.EXAMINE |
                            EVENT.OPEN |
                            EVENT.CLOSE |
                            EVENT.DEFEATED |
                            EVENT.TARGET |
                            EVENT.MOVE_TO,
                          1,
                        );
                      }
                    } else {
                      yield* game.statusScreen(object);
                      local5 = yield* game.wait(EVENT.TIMER, 1);
                    }
                  } else {
                    local5 = yield* run.runnerCastsSpell(object, 0x1e, 0x1e);
                  }
                } else {
                  yield* game.setObjectAnimation(object, 2);
                  yield* game.setObjectFlagBits(object, 0x60);
                  yield* game.choosePlace(object);
                  for (;;) {
                    local5 = yield* game.wait(
                      EVENT.TIMER |
                        EVENT.ARRIVED |
                        EVENT.EXAMINE |
                        EVENT.OPEN |
                        EVENT.CLOSE |
                        EVENT.DEFEATED |
                        EVENT.TARGET |
                        EVENT.MOVE_TO,
                      0xf,
                    );
                    if (((yield* game.getObjectFlags(object)) & 8) !== 0 && local5 === 1) {
                      yield* game.stopMotion(object);
                      yield* game.clearObjectVelocity(object);
                      local5 = 4;
                    }
                    if (local5 !== 1) {
                      yield* game.keepObjectFlagBits(object, 0xff9f);
                      break block339;
                    }
                  }
                }
              }
              local4 = truth((local5 & 0x800) !== 0) & 0xff;
              if (
                (signed(local3) |
                  signed(local4) |
                  ((yield* game.canAttack(object, signed(local1))) ^ 0xffff)) !==
                0
              ) {
                yield* game.stopMotion(object);
                yield* game.clearObjectVelocity(object);
                break block369;
              }
            }
          } else {
            local4 = (yield* run.script194(object)) & 0xff;
          }
        }
      }
      if (signed(local4) !== 0) {
        yield* run.releaseRunner(object);
        yield* run.leaveBody(object);
        return null;
      }
    }
  } else {
    yield* game.removeObject(object);
    return null;
  }
}

// Script 1EA: 1 argument.
export function* script1EA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script2BC(object, 0x20, 0x24, 1, 0x40, 0x16c0);
  return null;
}

// Script 1EB: 1 argument.
export function* script1EB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script391(object)) !== 0) {
    yield* game.setObjectRecordCount(object, 0x28);
    yield* run.script0AB(object, 0x506, 0, 0x1c);
    yield* game.setActorStateFlagBits(0x1b66 /* "Arena owner" */, 1);
    yield* game.wait(EVENT.TIMER, 0x64);
    yield* game.changeRoom(0xae);
    return null;
  }
  return null;
}

// Script 1EC: 1 argument.
export function* script1EC(state, arg0) {
  let local0 = 0,
    created = 0,
    frames = 0,
    local3 = 0;
  block374: {
    local0 = arg0 & 0xff;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (state.byte('SPIRIT_SUMMONED') === 0) {
      if ((yield* game.spendMagic(word(8 + shiftLeft(local0, 1)))) !== 0) {
        if ((yield* game.getPreviousFightObject(0xffff)) !== 0xffff) {
          state.setByte('SPIRIT_SUMMONED', 0, 1);
          state.setByte('SPELL_EFFECT_BUSY', 0, 0xffff);
          const t1 = word((yield* game.getObjectCoarseHeight(state.byte('PLAYER_OBJECT'))) + 0x20);
          const t2 = yield* game.getObjectCoarseY(state.byte('PLAYER_OBJECT'));
          const t3 = yield* game.getObjectCoarseX(state.byte('PLAYER_OBJECT'));
          created = (yield* game.createObject(0xc4, t3, t2, t1, 0xa1)) & 0xff;
          yield* game.setObjectDirection(created, 0);
          yield* game.setObjectAnimation(created, 2);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          yield* game.wait(EVENT.TIMER, 0xa);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(EVENT.TIMER, 0xa);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          yield* game.wait(EVENT.TIMER, 0x1e);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(EVENT.TIMER, 0xa);
          yield* game.playSoundEffect(0xffff, 0xa, 0xff, 0xff);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
          yield* game.wait(EVENT.TIMER, 0xa);
          state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          local3 = 255;
          for (;;) {
            const t4 = yield* game.getPreviousFightObject(signed(local3));
            local3 = t4 & 0xff;
            if (t4 === 0xffff) {
              yield* game.removeObject(created);
              yield* game.wait(EVENT.TIMER, 0x14);
              state.setWord('COLOUR_REQUEST', 0, state.word('COLOUR_REQUEST') | 0x8000);
              state.setByte('SPELL_EFFECT_BUSY', 0, 0);
              state.setByte('SPIRIT_SUMMONED', 0, 0);
              break block374;
            }
            yield* game.turnObjectToObject(created, signed(local3));
            const t5 = word((yield* game.moveObjectTowardsObject(created, signed(local3))) - 5);
            frames = t5 & 0xff;
            if (t5 > 0xf5 || frames === 0) {
              frames = 1;
            }
            yield* game.wait(EVENT.TIMER, frames);
            yield* game.playSoundEffect(created, 0x5a, 0xc0, 0xff);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 2);
            yield* game.wait(EVENT.TIMER, 5);
            yield* game.shootAtObject(created, signed(local3), 0xff, 0, multiply(local0, 6), 0);
            state.setWord('COLOUR_REQUEST', 0, (state.word('COLOUR_REQUEST') & 0xfffc) | 1);
          }
        } else {
          yield* game.addMagicPoints(word(8 + shiftLeft(local0, 1)));
        }
      }
    }
  }
  return null;
}

// Script 1ED: 1 argument.
export function* script1ED(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0x5d /* "No? Well, when you need it, just ask..." */);
  } else {
    yield* game.endDialog();
    yield* game.setActorStateFlagBits(0x7fc /* "Mortician" */, 8);
  }
  return null;
}

// Script 1EE: 1 argument.
export function* script1EE(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectFlagBits(object, 0x20);
  yield* run.script0DB(object);
  yield* game.wait(EVENT.TIMER, 0x1e);
  yield* game.removeObject(object);
  return null;
}

// Script 1EF: no arguments.
export function* script1EF(state) {
  yield* run.offerArenaFight(0xdf);
  return null;
}

// Script 1F0: 1 argument.
export function* script1F0(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7bd);
  yield* run.script00B(object, 0, 1, 0, 0x1d);
  yield* game.removeObject(object);
  return null;
}

// Script 1F1: 1 argument.
export function* script1F1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xb52 /* "Kitsune" */)) & 0x80) === 0) {
    yield* run.talkOrStrikeBack(
      object,
      0xb52,
      yield* game.getDirectionToPlayer(object),
      0x74,
      0x600,
    );
    yield* game.notice(2, 3, 0x15, 3, 0x400, 0x18c /* "Oh wow, this should be fun." */, 0xb4);
    yield* game.addSceneObject(0xac, 0, 0, 0, 0, 0xb52, 0x1e);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 1F2: 1 argument.
export function* script1F2(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 2);
  yield* game.notice(0xc, 0x14, 0xe, 3, 0x400, 0x246 /* "Playtime for Otto!" */, 0xc8);
  yield* run.dropNuyen164(yield* run.script0AB(0x200 | object, 0x700, 0x247, 0x10));
  yield* game.notice(3, 0x14, 0xf, 3, 0x400, 0x248 /* "Aaaargghh, I'm hit!" */, 0x78);
  return null;
}

// Script 1F3: 1 argument.
export function* script1F3(state, arg0) {
  let local0 = 0,
    object = 0,
    created = 0;
  block155: {
    local0 = arg0 & 0xff;
    state.setWord('MEMBER_INDEX', 0, 0);
    if (
      ((yield* game.getObjectFlags(state.byte('AIM_TARGET_OBJECT'))) & 3) === 3 ||
      state.byte('AIM_TARGET_OBJECT') === state.byte('PLAYER_OBJECT')
    ) {
      if ((yield* game.spendMagic(word(4 + local0))) !== 0) {
        state.setByte('SPELL_EFFECT_BUSY', 0, 0xffff);
        object = state.byte('AIM_TARGET_OBJECT') & 0xff;
        yield* game.raiseStateCount(object, multiply(local0, 0xf));
        const t1 = yield* game.getObjectCoarseHeight(object);
        const t2 = word((yield* game.getObjectCoarseY(object)) - 1);
        const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
        created = (yield* game.createObject(0xda, t3, t2, t1, 0xa1)) & 0xff;
        yield* game.setObjectDirection(created, 0);
        yield* game.setObjectAnimation(created, 0);
        yield* game.playSoundEffect(created, 0x36, 0xff, 0xff);
        local0 = 60;
        for (;;) {
          yield* game.wait(EVENT.TIMER, 1);
          const t4 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
          const t5 = word(shiftLeft(yield* game.getObjectCoarseY(object), 2) - 4);
          const t6 = word(shiftLeft(yield* game.getObjectCoarseX(object), 2) - 4);
          yield* game.setObjectPosition(created, t6, t5, t4);
          const t7 = word(local0 - 1);
          local0 = word(local0 - 1) & 0xff;
          if (t7 <= 0) {
            yield* game.removeObject(created);
            state.setByte('SPELL_EFFECT_BUSY', 0, 0);
            break block155;
          }
        }
      }
    }
  }
  return null;
}

// Script 1F4: 1 argument.
export function* script1F4(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 5);
  yield* game.setObjectDialog(object, 0x5e);
  yield* game.keepObjectFlagBits(object, 0xdfff);
  for (;;) {
    yield* game.wait(EVENT.TALK, 0);
  }
}

// Script 1F5: 1 argument.
export function* script1F5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7d2);
  yield* run.script00B(object, 0, 1, 0, 0x24);
  yield* game.removeObject(object);
  return null;
}

// Script 1F6: 1 argument.
export function* script1F6(state, arg0) {
  let object = 0,
    local1 = 0,
    direction = 0,
    count = 0,
    frames = 0;
  function* sub22() {
    const t1 = yield* game.getObjectCoarseHeight(object);
    const t2 = word((yield* game.getObjectCoarseY(object)) - 1);
    const t3 = word((yield* game.getObjectCoarseX(object)) - 1);
    yield* game.setObjectVelocity(
      yield* game.createObject(0x78 /* "Jester Spirit" */, t3, t2, t1, 0x332),
      0,
      0,
      0xfffc,
    );
  }
  function* sub5() {
    const t4 = yield* game.getObjectCoarseHeight(object);
    const t5 = yield* game.getObjectCoarseY(object);
    const t6 = yield* game.getObjectCoarseX(object);
    yield* game.createObject(0x78 /* "Jester Spirit" */, t6, t5, t4, 0x2e);
  }
  object = arg0 & 0xff;
  block441: {
    if ((yield* game.hasObjectRecordProperty(object)) !== 0) {
      local1 = yield* game.scriptAction(0x180);
      if (local1 !== 0x80) {
        if (local1 === 0x100) {
          if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
            if ((yield* game.getCurrentRoomHeader()) !== (yield* game.getRoomHeader(0x122))) {
              yield* game.notice(2, 0x16, 0x13, 3, 0x800, 7 /* "I'm not using it HERE!" */, 0xf0);
            } else {
              yield* game.setObjectRecordFlagBits(object, 1);
              yield* game.setSpriteMode(object, 0x8001);
              yield* game.endDialog();
              yield* game.wait(EVENT.TIMER, 1);
              yield* game.resetObjectRecordProperty(object);
              yield* game.playSoundEffect(object, 0x58, 0xff, 0xf);
              yield* game.setScriptVariableBits(0x14, 1);
              yield* game.setObjectActionAndDirection(object, 0, 0);
              yield* game.placeObjectOnWaypoint(object, 1);
              yield* game.setObjectFlagBits(object, 0x20);
              yield* game.setObjectVelocity(object, 0, 0, 0x10);
              direction = 0;
              count = 0x80;
              frames = 1;
              for (;;) {
                yield* game.setObjectDirection(object, direction);
                direction = word(direction + 1) & 7 & 0xff;
                yield* game.wait(EVENT.TIMER, frames);
                if (less(count, 0xa)) {
                  frames = word(frames + 1);
                }
                if (count === 0) {
                  for (;;) {
                    yield* game.wait(EVENT.TIMER, 5);
                    if (((yield* game.getScriptVariable(0x14)) & 2) !== 0) {
                      yield* game.keepObjectFlagBits(object, 0xffdf);
                      yield* game.setObjectVelocity(object, 0, 0, 1);
                      count = 0xf;
                      for (;;) {
                        yield* game.wait(EVENT.TIMER, 0xf);
                        yield* sub22();
                        count = word(count - 1);
                        if (count === 0) {
                          yield* game.clearObjectVelocity(object);
                          count = 0x14;
                          for (;;) {
                            yield* game.wait(EVENT.TIMER, 0xf);
                            yield* sub5();
                            yield* sub22();
                            if ((count & 3) === 0) {
                              yield* game.playSoundEffect(object, 0x56, 0x60, 6);
                            }
                            count = word(count - 1);
                            if (count === 0) {
                              yield* game.setObjectVelocity(object, 0, 0, 1);
                              count = 0x3c;
                              yield* game.playSoundEffect(object, 0x56, 0xff, 4);
                              for (;;) {
                                yield* game.wait(EVENT.TIMER, 1);
                                yield* game.setObjectFlagBits(object, 0x80);
                                yield* game.wait(EVENT.TIMER, 1);
                                yield* game.keepObjectFlagBits(object, 0xff7f);
                                count = word(count - 2);
                                if ((count & 3) === 0) {
                                  yield* game.setObjectDirection(
                                    object,
                                    word((yield* game.getObjectDirection(object)) + 1) & 7,
                                  );
                                }
                                if (count === 0) {
                                  yield* game.keepScriptVariableBits(0x14, 0xfffe);
                                  break block441;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  count = word(count - 1);
                }
              }
            }
          }
        }
      } else {
        yield* game.notice(2, 0x16, 0x13, 3, 0x800, 0x10f /* "Jester Spirit Insignia" */, 0xf0);
      }
    }
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1F7: 1 argument.
export function* script1F7(state, arg0) {
  const locals = new Uint8Array(10);
  function* sub470() {
    setLocalWord(locals, 1, 3);
    for (;;) {
      yield* game.setObjectVelocity(localByte(locals, 0), 0xfffe, 0xfffe, 5);
      yield* game.wait(EVENT.TIMER, 0x14);
      yield* game.setObjectVelocity(localByte(locals, 0), 2, 2, 0xfffb);
      yield* game.wait(EVENT.TIMER, 0x14);
      setLocalWord(locals, 1, word(localWord(locals, 1) - 1));
      if (localWord(locals, 1) === 0) {
        yield* game.stopMotion(localByte(locals, 0));
        yield* game.clearObjectVelocity(localByte(locals, 0));
        return;
      }
    }
  }
  function* sub242(in0, in1, in2, in3, in4) {
    setLocalWord(locals, 1, in0);
    setLocalWord(locals, 3, in1);
    locals[5] = in2 & 0xff;
    setLocalWord(locals, 6, in3);
    locals[8] = in4 & 0xff;
    if (
      ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, localWord(locals, 1))) &
        (truth(localWord(locals, 3) === 0xffff) |
          (yield* game.isActorStateProperty(0x8b2 /* "Me" */, localWord(locals, 3)))) &
        (truth(
          ((yield* game.getObjectRecordFlags(localByte(locals, 0))) & localByte(locals, 5)) !== 0,
        ) ^
          0xffff)) !==
      0
    ) {
      locals[9] = 0xffff & 0xff;
      if (!(localByte(locals, 5) === 2 && state.byte('JAKE_SUMMON_SPIRIT') === 0)) {
        if (!(localByte(locals, 5) === 4 && state.byte('JAKE_FREEZE') === 0)) {
          if (!(localByte(locals, 5) === 8 && state.byte('JAKE_ARMOUR_SPELL') === 0)) {
            if (!(localByte(locals, 5) === 0x10 && state.byte('JAKE_POWERBALL') === 0)) {
              if (localByte(locals, 5) === 0x20 && state.byte('JAKE_INVISIBILITY') === 0) {
                if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 3) !== 3) {
                  locals[9] = 0 & 0xff;
                } else {
                  state.setByte('JAKE_INVISIBILITY', 0, 1);
                }
              }
            } else {
              state.setByte('JAKE_POWERBALL', 0, 1);
            }
          } else {
            state.setByte('JAKE_ARMOUR_SPELL', 0, 1);
          }
        } else {
          if (((yield* game.getActorStateFlags(localWord(locals, 1))) & 1) === 0) {
            locals[9] = 0 & 0xff;
          } else {
            state.setByte('JAKE_FREEZE', 0, 1);
          }
        }
      } else {
        state.setByte('JAKE_SUMMON_SPIRIT', 0, 1);
      }
      if (signed(localByte(locals, 9)) !== 0) {
        yield* game.playSoundEffect(localByte(locals, 0), 0x32, 0xff, 3);
        yield* game.setObjectRecordFlagBits(localByte(locals, 0), localByte(locals, 5));
        yield* game.notice(2, 2, localByte(locals, 8), 3, 0x800, localWord(locals, 6), 1);
        yield* game.confirmKey();
      }
    }
  }
  function* sub5() {
    block241: {
      if (
        state.byte('JAKE_SUMMON_SPIRIT') === 0 ||
        state.byte('JAKE_FREEZE') === 0 ||
        state.byte('JAKE_ARMOUR_SPELL') === 0 ||
        state.byte('JAKE_POWERBALL') === 0 ||
        state.byte('JAKE_INVISIBILITY') === 0
      ) {
        setLocalWord(locals, 1, 0);
        for (;;) {
          const t1 = yield* game.getScriptVariable(0x32);
          locals[3] = t1 & 0xff;
          if (t1 !== 0) {
            if (localByte(locals, 3) !== 1) {
              if (localByte(locals, 3) !== 2) {
                if (localByte(locals, 3) !== 3) {
                  if (state.byte('JAKE_ARMOUR_SPELL') === 0) {
                    setLocalWord(locals, 1, 0x1cf);
                    locals[4] = 0x18 & 0xff;
                    locals[5] = 5 & 0xff;
                  }
                } else {
                  if (state.byte('JAKE_INVISIBILITY') === 0) {
                    setLocalWord(locals, 1, 0x1d2);
                    locals[4] = 0x1b & 0xff;
                    locals[5] = 4 & 0xff;
                  }
                }
              } else {
                if (state.byte('JAKE_SUMMON_SPIRIT') === 0) {
                  setLocalWord(locals, 1, 0x1d1);
                  locals[4] = 0x19 & 0xff;
                  locals[5] = 4 & 0xff;
                }
              }
            } else {
              if (state.byte('JAKE_FREEZE') === 0) {
                setLocalWord(locals, 1, 0x1d3);
                locals[4] = 0x19 & 0xff;
                locals[5] = 4 & 0xff;
              }
            }
          } else {
            if (state.byte('JAKE_POWERBALL') === 0) {
              setLocalWord(locals, 1, 0x1d0);
              locals[4] = 0x17 & 0xff;
              locals[5] = 5 & 0xff;
            }
          }
          if (localByte(locals, 3) !== 4) {
            yield* game.setScriptVariable(0x32, word(localByte(locals, 3) + 1));
          } else {
            yield* game.setScriptVariable(0x32, 0);
          }
          if (localWord(locals, 1) !== 0) {
            yield* game.notice(
              3,
              3,
              localByte(locals, 4),
              localByte(locals, 5),
              0x400,
              localWord(locals, 1),
              1,
            );
            yield* game.confirmKey();
            break block241;
          }
        }
      }
    }
  }
  locals[0] = arg0 & 0xff;
  yield* game.setActorStateFlags(0xd6d /* "Heavy Dude" */, 0);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    if (less(yield* game.getDistanceToPlayer(localByte(locals, 0)), 0x32)) {
      yield* game.setActorStateFlagBits(0xd6d /* "Heavy Dude" */, 1);
      yield* game.wait(EVENT.TIMER, 0xf);
      yield* game.setObjectActionAndDirection(localByte(locals, 0), 1, 5);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.setObjectAnimation(localByte(locals, 0), 0);
      if ((yield* game.getScriptVariable(0x2c)) !== 0) {
        yield* sub470();
        yield* sub470();
        yield* sub470();
        yield* sub470();
      } else {
        if (
          (((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x999 /* "Magic Fetish" */)) &
            (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x1546 /* "Dog Collar" */)) &
            (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0xb1a /* "Leaves" */))) |
            truth(((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x80) !== 0)) ===
          0
        ) {
          yield* game.wait(EVENT.TIMER, 0x3c);
          yield* game.notice(
            2,
            0x10,
            0x1c,
            4,
            0x400,
            0x1c4 /* "Go... and do not return until you have the three items from ..." */,
            1,
          );
          yield* game.notice(5, 0x13, 0xf, 3, 0x400, 0x1c5 /* "One of the earth" */, 1);
          yield* game.notice(6, 0x15, 0xf, 3, 0x400, 0x1c6 /* "One of a creature" */, 1);
          yield* game.notice(7, 0x17, 0xf, 3, 0x400, 0x1c7 /* "One of a man" */, 1);
          yield* game.confirmKey();
          yield* game.wait(EVENT.TIMER, 0x3c);
        } else {
          yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x80);
          yield* sub470();
          if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) === 0) {
            if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
              yield* game.notice(
                2,
                3,
                0x1b,
                4,
                0x400,
                0x1c9 /* "You have done well, take this spell... it will heal your mor..." */,
                0xb4,
              );
              if (state.byte('JAKE_HEAL') === 0) {
                state.setByte('JAKE_HEAL', 0, 1);
              }
              if (state.byte('JAKE_MAGIC') === 0) {
                state.setByte('JAKE_MAGIC', 0, 1);
                yield* game.raiseMemberMagicPoints(yield* game.getPlayerObjectCopy(), 0xa);
              }
              yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0x40);
              yield* game.wait(EVENT.TIMER, 0xb4);
            }
            if (((yield* game.getActorStateFlags(0x191a /* "Bronze Gate" */)) & 1) === 0) {
              yield* game.talk(localByte(locals, 0), 0x28);
            } else {
              yield* game.notice(
                4,
                3,
                0x18,
                5,
                0x400,
                0x1c8 /* "You have not fulfilled your promise, do not return until the..." */,
                1,
              );
              yield* game.confirmKey();
            }
          } else {
            yield* game.talk(localByte(locals, 0), 0x29);
            yield* sub242(0x1546, 0x152a, 2, 0x1cc, 0x1c);
            yield* sub242(0x1944, 0x896, 4, 0x1ce, 0x17);
            yield* sub242(0x896, 0x3cd, 8, 0x1ca, 0x18);
            yield* sub242(0x1141, 0x777, 0x10, 0x1cb, 0x19);
            yield* sub242(0x658, 0xffff, 0x20, 0x1cd, 0x1b);
            yield* sub5();
          }
        }
      }
      yield* game.setActorStateFlagBits(0xd6d /* "Heavy Dude" */, 2);
      yield* game.wait(EVENT.TIMER, 0xa);
      yield* game.setObjectAnimation(localByte(locals, 0), 2);
      yield* game.wait(EVENT.ANIMATION_END, 0);
      yield* game.removeObject(localByte(locals, 0));
      return null;
    }
  }
}

// Script 1F8: 1 argument.
export function* script1F8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.keepObjectFlagBits(object, 0xffbf);
  yield* game.setObjectActionAndDirection(object, 0, 5);
  for (;;) {
    yield* game.turnObjectToPlayer(object);
    yield* game.wait(EVENT.TIMER, 6);
    if (
      less(
        yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()),
        word((yield* game.getObjectCoarseX(object)) + 0x14),
      )
    ) {
      yield* game.playSoundEffect(object, 0x3a, 0xff, 3);
      yield* game.talk(object, 0x27);
      yield* game.setObjectActionAndDirection(object, 1, 4);
      yield* game.setObjectVelocity(object, 0, 0xfffb, 0);
      yield* game.wait(EVENT.TIMER, 0x104);
      yield* game.resetObjectRecordProperty(object);
      yield* game.removeObject(object);
      return null;
    }
  }
}

// Script 1F9: 1 argument.
export function* script1F9(state, arg0) {
  let object = 0;
  block93: {
    object = arg0 & 0xff;
    yield* game.setObjectActionAndDirection(object, 1, 5);
    yield* game.setObjectFlagBits(object, 0x100);
    yield* game.keepObjectFlagBits(object, 0xdfff);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      for (;;) {
        if (((yield* game.wait(EVENT.TIMER | EVENT.TALK, 1)) & EVENT.TALK) !== 0) {
          yield* game.talk(object, 0x5f);
        }
        yield* game.keepObjectRecordFlagBits(object, 0xffbf);
        if (((yield* game.getObjectRecordFlags(object)) & 0x80) !== 0) {
          yield* game.setObjectRecordFlagBits(object, 1);
          yield* game.setObjectAnimation(object, 2);
          yield* game.moveObjectToWaypoint(object, 7);
          yield* game.wait(EVENT.ARRIVED, 0);
          break block93;
        }
      }
    } else {
      yield* game.placeObjectOnWaypoint(object, 7);
    }
  }
  yield* game.setObjectAnimation(object, 0);
  for (;;) {
    yield* game.wait(EVENT.TIMER, 1);
    yield* game.turnObjectToPlayer(object);
  }
}

// Script 1FA: 1 argument.
export function* script1FA(state, arg0) {
  let object = 0,
    object2 = 0;
  object = arg0 & 0xff;
  yield* game.setScriptVariable(8, 0x7cb);
  yield* run.script00B(object, 0, 1, 0xc0, 0x32);
  const t1 = yield* game.getActorStateFlags(0x3cd /* "Serpent Scales" */);
  object2 = t1 & 0xff;
  if (t1 !== 1) {
    const t2 = shiftLeft(yield* game.getObjectCoarseHeight(object), 2);
    const t3 = shiftLeft(yield* game.getObjectCoarseY(object), 2);
    const t4 = shiftLeft(yield* game.getObjectCoarseX(object), 2);
    yield* game.setObjectPosition(object2, t4, t3, t2);
    yield* game.setObjectVelocity(object2, 0, 0, 8);
    yield* game.setObjectRecordFlags(object2, 1);
  }
  yield* game.removeObject(object);
  return null;
}

// Script 1FB: no arguments.
export function* promptThrowAt(state) {
  yield* game.endDialog();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.releaseNoticeWindows();
  yield* game.wait(EVENT.TIMER, 1);
  yield* game.notice(2, 0x17, 9, 3, 0, 0x12 /* "Throw at:" */, 1);
  return null;
}

// Script 1FC: 1 argument.
export function* script1FC(state, arg0) {
  let count = 0,
    local2 = 0,
    object = 0,
    local4 = 0;
  block445: {
    count = arg0;
    yield* game.endDialog();
    if (less(state.byte('ARMOUR_SPELLS_ACTIVE'), 4)) {
      if ((yield* game.spendMagic(word(4 + count))) !== 0) {
        const t1 = yield* game.spellGloveTarget();
        local2 = t1 & 0xff;
        if (
          (truth(t1 === 0xffff) |
            truth(
              ((yield* game.getObjectFlags(signed(local2))) & 3) !== 3 &&
                notEqualOrNegativeLeft(signed(local2), state.byte('PLAYER_OBJECT')),
            )) ===
          0
        ) {
          state.setByte('ARMOUR_SPELLS_ACTIVE', 0, word(state.byte('ARMOUR_SPELLS_ACTIVE') + 1));
          const t2 = yield* game.getObjectCoarseHeight(signed(local2));
          const t3 = word((yield* game.getObjectCoarseY(signed(local2))) - 6);
          const t4 = word((yield* game.getObjectCoarseX(signed(local2))) - 6);
          const t5 = yield* game.createObject(0xc5 /* "Protected" */, t4, t3, t2, 0xa1);
          object = t5 & 0xff;
          yield* game.bindObjectToCurrentTask(t5);
          yield* run.script0DB(object);
          count = multiplySignedLeft(count, 0x12c);
          yield* game.addObjectArmour(signed(local2), 0x1e);
          loop117: for (;;) {
            yield* game.playSoundEffect(object, 8, 0xff, 0xff);
            yield* game.setObjectDirection(object, 3);
            for (;;) {
              const t6 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
              const t7 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 6);
              const t8 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 6);
              yield* game.setObjectPosition(object, t8, t7, t6);
              count = word(count - 1);
              if (
                ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) & EVENT.ANIMATION_END) !==
                0
              ) {
                yield* game.setObjectDirection(object, 7);
                for (;;) {
                  const t9 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                  const t10 = word(shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6);
                  const t11 = word(shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6);
                  yield* game.setObjectPosition(object, t11, t10, t9);
                  count = word(count - 1);
                  if (
                    ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                      EVENT.ANIMATION_END) !==
                    0
                  ) {
                    if (!lessOrEqualSignedLeft(count, 0x78)) {
                      continue loop117;
                    }
                    loop244: for (;;) {
                      yield* game.playSoundEffect(object, 8, 0xff, 0xff);
                      yield* game.setObjectDirection(object, 3);
                      for (;;) {
                        const t12 = shiftLeft(yield* game.getObjectCoarseHeight(signed(local2)), 2);
                        const t13 = word(
                          shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) - 4,
                        );
                        const t14 = word(
                          shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) - 4,
                        );
                        yield* game.setObjectPosition(object, t14, t13, t12);
                        const t15 = truth(
                          ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                            EVENT.ANIMATION_END) !==
                            0,
                        );
                        local4 = t15 & 0xff;
                        if (t15 === 0) {
                          yield* game.setObjectPosition(object, 0, 0, 0);
                          local4 =
                            truth(
                              ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                EVENT.ANIMATION_END) !==
                                0,
                            ) & 0xff;
                        }
                        count = word(count - 2);
                        if (signed(local4) !== 0) {
                          yield* game.setObjectDirection(object, 7);
                          for (;;) {
                            const t16 = shiftLeft(
                              yield* game.getObjectCoarseHeight(signed(local2)),
                              2,
                            );
                            const t17 = word(
                              shiftLeft(yield* game.getObjectCoarseY(signed(local2)), 2) + 6,
                            );
                            const t18 = word(
                              shiftLeft(yield* game.getObjectCoarseX(signed(local2)), 2) + 6,
                            );
                            yield* game.setObjectPosition(object, t18, t17, t16);
                            const t19 = truth(
                              ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                EVENT.ANIMATION_END) !==
                                0,
                            );
                            local4 = t19 & 0xff;
                            if (t19 === 0) {
                              yield* game.setObjectPosition(object, 0, 0, 0);
                              local4 =
                                truth(
                                  ((yield* game.wait(EVENT.TIMER | EVENT.ANIMATION_END, 1)) &
                                    EVENT.ANIMATION_END) !==
                                    0,
                                ) & 0xff;
                            }
                            count = word(count - 2);
                            if (signed(local4) !== 0) {
                              if (!lessOrEqualSignedLeft(count, 0)) {
                                continue loop244;
                              }
                              yield* game.subtractObjectArmour(signed(local2), 0x1e);
                              yield* game.removeObject(object);
                              state.setByte(
                                'ARMOUR_SPELLS_ACTIVE',
                                0,
                                word(state.byte('ARMOUR_SPELLS_ACTIVE') - 1),
                              );
                              break block445;
                            }
                          }
                        }
                      }
                    }
                  }
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

// Script 1FD: 1 argument.
export function* script1FD(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x60);
  for (;;) {
    yield* game.setObjectActionAndDirection(object, 0, 0);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
    yield* game.setObjectActionAndDirection(object, 0, 7);
    yield* game.wait(EVENT.TIMER | EVENT.TALK, word(((yield* game.randomByte()) & 0x7f) + 0x64));
    yield* game.releaseObjectGraphics(object);
  }
}

// Script 1FE: no arguments.
export function* script1FE(state) {
  if ((yield* game.question(0x18, 8)) === 0) {
    yield* game.topicText(0xbd /* "Well if ya ever need 'em..." */);
  } else {
    if ((yield* game.payNuyen(0x64)) === 0) {
      yield* game.topicText(
        0xbc /* "I need the money first, mister. It's pretty risky getting 'e..." */,
      );
    } else {
      if (less(yield* game.getActorStateCount(0x395 /* "Slap Patch" */), 6)) {
        yield* game.addActorStateCount(0x395 /* "Slap Patch" */, 1);
        yield* game.setActorStateHolder(0x395 /* "Slap Patch" */, 0x8b2 /* "Me" */);
        yield* game.topicText(0xbb /* "Here ya go, mister! They're great in an emergency." */);
      } else {
        yield* game.addNuyen(0x64);
        yield* game.topicText(
          0xbe /* "You've already got enough! We need some here in the yards." */,
        );
      }
    }
  }
  return null;
}

// Script 1FF: no arguments.
export function* script1FF(state) {
  const t1 = yield* run.byNegotiation(0x7d0, 0x708, 0x5dc);
  const t2 = yield* run.byNegotiationB(0x184, 0x185, 0x186);
  yield* run.script162(0xa4f, t2, t1, 0x183, 0x182);
  return null;
}
