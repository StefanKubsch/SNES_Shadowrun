// Scripts 0C0 to 0DF, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, localByte, localWord, setLocalWord, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 0C0: 1 argument.
export function* script0C0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x30, 0x5dc0, 0xbf3, 0);
  return null;
}

// Script 0C1: 1 argument.
export function* script0C1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  yield* run.script1A2(object, 5, 2, 0, 0);
  return null;
}

// Script 0C2: 1 argument.
export function* script0C2(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 6);
  yield* run.script1A2(object, 5, 2, 0, 0);
  return null;
}

// Script 0C3: no arguments.
export function* script0C3(state) {
  let local0 = 0;
  yield* game.topicText(
    0xe4 /* "I don't care who got you in here. You're on my property now!..." */,
  );
  if (state.byte('JAKE_NEGOTIATION') <= 1) {
    local0 = 0xfa0;
    yield* game.windowText(0xd9 /* "4,000" */);
  } else {
    local0 = 0x7d0;
    yield* game.windowText(0xd7 /* "2,000" */);
  }
  yield* game.windowText(0xe5 /* "nuyen will buy us insurance. You got the cash?" */);
  if ((yield* game.question(0x18, 9)) === 0) {
    yield* game.topicText(
      0xce /* "Well, get comfortable! You gonna need money or some muscle t..." */,
    );
  } else {
    if ((yield* game.payNuyen(local0)) === 0) {
      yield* game.topicText(
        0xcf /* "Look spug. Unless I can see some cash, that's just too bad." */,
      );
    } else {
      yield* game.endDialog();
      yield* game.setActorStateFlagBits(0x23e, 0x80);
    }
  }
  return null;
}

// Script 0C4: 1 argument.
export function* script0C4(state, arg0) {
  const locals = new Uint8Array(8);
  function* sub8(in0, in1) {
    locals[2] = in0 & 0xff;
    setLocalWord(locals, 3, in1);
    for (;;) {
      yield* game.playSoundEffect(localByte(locals, 0), 0x2c, 0x1f, 3);
      yield* game.wait(1, localWord(locals, 3));
      const t1 = word(localByte(locals, 2) - 1);
      locals[2] = word(localByte(locals, 2) - 1) & 0xff;
      if (t1 <= 0) {
        yield* game.playSoundEffect(localByte(locals, 0), 6, 0x1f, 3);
        yield* game.wait(8, 0);
        return;
      }
    }
  }
  function* sub5() {
    yield* game.setSpriteMode(localByte(locals, 0), 1);
    yield* game.releaseGlove();
    if ((yield* game.getScriptVariable(0x2a)) !== 2) {
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), 0);
    } else {
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), 4);
    }
    yield* game.createObject(0xb /* "Me" */, 0, 0, 0, 0x184);
    yield* game.wait(1, 0x64);
    yield* game.createObject(0x95, 0, 0, 0, 0x2f3);
    yield* game.wait(1, 0x78);
    yield* game.notice(7, 3, 0x11, 3, 0x400, 0x1c1 /* "This won't hurt a bit." */, 0xb4);
    yield* game.wait(1, 0xc8);
    yield* game.setSpriteMode(localByte(locals, 0), 0x8001);
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 3, 0);
    yield* sub8(5, 0x1e);
    yield* game.wait(1, 0x14);
    yield* game.setObjectAnimation(localByte(locals, 0), 5);
    if ((yield* game.isTopicKnown(8 /* "Cyberware" */)) === 0) {
      yield* game.notice(
        3,
        3,
        0x1a,
        5,
        0x400,
        0x198 /* "Once I'm finished here Jake, maybe you'd like to take a look..." */,
        0x118,
      );
      yield* game.addTopic(8 /* "Cyberware" */);
    }
    yield* sub8(3, 0x2d);
    yield* game.setSpriteMode(localByte(locals, 0), 0);
    yield* game.stopTimer();
    yield* game.setScriptVariable(0x16, 1);
    yield* game.setObjectAnimation(localByte(locals, 0), 1);
    yield* game.moveObjectToWaypoint(localByte(locals, 0), 2);
    yield* game.wait(4, 0);
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 6);
    yield* game.wait(1, 0xa0);
    if ((yield* game.getScriptVariable(0x2a)) === 0) {
      yield* game.talk(localByte(locals, 0), 0x20);
    }
    yield* game.setObjectRecordFlagBits(localByte(locals, 0), 0xc0);
    yield* game.wait(1, 1);
    yield* game.changeRoom(0xee);
    yield* game.wait(1, 2);
  }
  function* sub290(in0, in1, in2) {
    setLocalWord(locals, 2, in0);
    setLocalWord(locals, 4, in1);
    setLocalWord(locals, 6, in2);
    yield* game.releaseNoticeWindows();
    yield* game.notice(4, 3, 0x19, 4, 0x400, localWord(locals, 4), 1);
    yield* game.confirmKey();
    yield* game.keepActorStateFlagBits(localWord(locals, 6), 0xff3f);
    yield* game.setScriptVariable(0x2a, localWord(locals, 2));
    yield* game.setObjectRecordFlags(localByte(locals, 0), 2);
    yield* game.changeRoom(0xee);
    yield* game.wait(1, 2);
  }
  locals[0] = arg0 & 0xff;
  block511: {
    yield* game.setActorStateFlags(0x3f0, 0);
    yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 6);
    if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x40) === 0) {
      if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 0x80) === 0) {
        if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 2) === 0) {
          yield* game.setScriptVariable(0x2a, 0);
          yield* game.turnObjectToPlayer(localByte(locals, 0));
          yield* game.notice(9, 3, 0xe, 3, 0x400, 0x196 /* "Come on in Jake." */, 0x78);
          for (;;) {
            yield* game.wait(2, 0);
            yield* run.talkFacingPlayer(localByte(locals, 0), 0x1f);
            if (((yield* game.getObjectRecordFlags(localByte(locals, 0))) & 1) !== 0) {
              yield* game.setObjectRecordFlagBits(localByte(locals, 0), 2);
              yield* game.changeRoom(0xee);
              yield* game.wait(1, 2);
              break block511;
            }
          }
        } else {
          yield* sub5();
          return null;
        }
      } else {
        yield* game.placeObjectOnWaypoint(localByte(locals, 0), 2);
        yield* game.turnObjectToPlayer(localByte(locals, 0));
        yield* game.wait(1, 0x3c);
        yield* game.turnObjectToPlayer(localByte(locals, 0));
        yield* game.notice(
          2,
          3,
          0x1c,
          3,
          0x400,
          0x197 /* "Hello Jake you're looking much better." */,
          0x50,
        );
        yield* game.wait(1, 0x1e);
      }
    } else {
      yield* game.placeObjectOnWaypoint(localByte(locals, 0), 2);
    }
  }
  yield* game.keepObjectRecordFlagBits(localByte(locals, 0), 0xffbf);
  for (;;) {
    const t2 = truth(((yield* game.wait(3, 1)) & 2) !== 0);
    locals[1] = t2 & 0xff;
    if (((t2 ^ 0xffff) & truth(((yield* game.getActorStateFlags(0x31e)) & 0x20) !== 0)) !== 0) {
      yield* game.turnObjectToPlayer(localByte(locals, 0));
      yield* game.keepActorStateFlagBits(0x31e, 0xffdf);
      yield* game.wait(1, 0x14);
      if (((yield* game.getActorStateFlags(0x3aa)) & 0xc0) === 0) {
        if (((yield* game.getActorStateFlags(0x192f)) & 0xc0) === 0) {
          if (((yield* game.getActorStateFlags(0x15c4)) & 0xc0) === 0) {
            yield* game.wait(1, 0xa);
            yield* game.setObjectDirection(localByte(locals, 0), 2);
          } else {
            yield* sub290(3, 0x1ac, 0x15c4);
            return null;
          }
        } else {
          yield* sub290(2, 0x1aa, 0x192f);
          return null;
        }
      } else {
        yield* sub290(1, 0x1af, 0x3aa);
        return null;
      }
    }
    if (signed(localByte(locals, 1)) !== 0) {
      yield* game.setObjectDirection(localByte(locals, 0), 6);
      yield* game.wait(1, 0x3c);
      if ((yield* game.isTopicKnown(8 /* "Cyberware" */)) === 0) {
        yield* game.talk(localByte(locals, 0), 0x20);
      } else {
        yield* game.talk(localByte(locals, 0), 0x21);
      }
      yield* game.setObjectActionAndDirection(localByte(locals, 0), 0, 2);
      yield* game.wait(1, 0x14);
    }
  }
}

// Script 0C5: 1 argument.
export function* script0C5(state, arg0) {
  let object = 0;
  block86: {
    object = arg0 & 0xff;
    yield* game.setObjectFlagBits(object, 0x140);
    if (((yield* game.getObjectRecordFlags(object)) & 1) === 0) {
      yield* game.setObjectActionAndDirection(object, 5, 5);
      for (;;) {
        if (((yield* game.wait(0x281, 6)) & 1) === 0) {
          yield* game.notice(7, 3, 0x10, 3, 0, 0x9b /* "This door is locked." */, 0xc8);
        }
        if (((yield* game.getObjectRecordFlags(object)) & 1) !== 0) {
          yield* run.script36C(object, 5, 6, 4, 0x30, 0x30);
          break block86;
        }
      }
    } else {
      yield* game.setObjectActionAndDirection(object, 4, 5);
    }
  }
  for (;;) {
    yield* run.script074(object, 4, 7, 5, 0x30);
    yield* run.script2A3(object, 5, 6, 4, 0x30, 0x30);
  }
}

// Script 0C6: 1 argument.
export function* script0C6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script00A(local0, 0x20, 0x24, 0x40, 0x175a);
  return null;
}

// Script 0C7: 1 argument.
export function* script0C7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x24, 0x50, 0x105a, 0xffff);
  return null;
}

// Script 0C8: 3 arguments.
export function* script0C8(state, arg0, arg1, arg2) {
  let local0 = 0,
    local2 = 0,
    local4 = 0;
  local0 = arg0;
  local2 = arg1;
  local4 = arg2;
  if ((yield* game.question(0x12, 0xa)) === 0) {
    yield* game.topicText(local4);
  } else {
    if ((yield* game.payNuyen(local2)) === 0) {
      yield* game.topicText(2 /* "Not enough money!" */);
    } else {
      yield* game.endDialog();
      yield* game.setActorStateFlagBits(local0, 0x80);
    }
  }
  return null;
}

// Script 0C9: 1 argument.
export function* script0C9(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x34, 0x1f40, 0x18a3, 0);
  return null;
}

// Script 0CA: 2 arguments.
export function* script0CA(state, arg0, arg1) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  local1 = arg1;
  yield* game.setObjectDirection(object, 5);
  yield* game.setObjectFlagBits(object, 0x100);
  loop15: for (;;) {
    yield* game.setObjectAnimation(object, 3);
    for (;;) {
      if (((yield* game.wait(0x280, 0)) & 0x200) !== 0) {
        yield* game.playSoundEffect(object, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(object, 5);
        yield* game.wait(1, 0xa);
        if ((yield* game.testObjectCollision(object, 1)) === 0) {
          yield* game.wait(8, 0);
          loop117: for (;;) {
            yield* game.setObjectAnimation(object, 1);
            for (;;) {
              if (((yield* game.wait(0x480, 0)) & 0x400) !== 0) {
                yield* game.setObjectAnimation(object, 7);
                yield* game.wait(1, 0xa);
                if ((yield* game.testObjectCollision(object, 3)) === 0) {
                  yield* game.wait(8, 0);
                  yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
                  continue loop15;
                }
                yield* game.playSoundEffect(object, 0x20, 0xff, 3);
                yield* game.wait(1, 5);
                continue loop117;
              }
              yield* game.notice(2, 0x15, 0xb, 3, 0x800, local1, 0x78);
            }
          }
        } else {
          yield* game.playSoundEffect(object, 0x20, 0xff, 3);
          yield* game.wait(1, 5);
          yield* game.playSoundEffect(object, 0x2e, 0xff, 3);
          continue loop15;
        }
      } else {
        yield* game.notice(2, 0x15, 0xb, 3, 0x800, local1, 0x78);
      }
    }
  }
}

// Script 0CB: 1 argument.
export function* script0CB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* run.script1A2(object, 4, 1, 0, 0xffff);
  return null;
}

// Script 0CC: 1 argument.
export function* script0CC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 4);
  yield* run.script1A2(object, 4, 1, 0, 0xffff);
  return null;
}

// Script 0CD: 1 argument.
export function* script0CD(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectDialog(object, 0x82);
  yield* game.setObjectActionAndDirection(object, 7, 5);
  for (;;) {
    if (((yield* game.getObjectRecordFlags(object)) & 0x80) === 0) {
      yield* game.wait(3, 1);
    } else {
      yield* game.setObjectDirection(object, 5);
      yield* game.wait(3, 0xf0);
      yield* game.setObjectDirection(object, 1);
      yield* game.keepObjectRecordFlagBits(object, 0x7f);
    }
  }
}

// Script 0CE: 1 argument.
export function* script0CE(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x35, 0x32c8, 0x1696, 0);
  return null;
}

// Script 0CF: 1 argument.
export function* script0CF(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x36, 0x4e20, 0x770, 0);
  return null;
}

// Script 0D0: 1 argument.
export function* script0D0(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script28D(local0, 0x37, 0x7530, 0x129f, 0);
  return null;
}

// Script 0D1: 1 argument.
export function* obtainDataFile(state, arg0) {
  let local0 = 0;
  local0 = arg0;
  if ((yield* game.isActorStateProperty(0x8b2, local0)) === 0) {
    yield* run.script04B();
    yield* game.setActorStateHolder(local0, 0x8b2);
    yield* game.notice(6, 2, 0x10, 3, 0, 0x210 /* "DATA FILE OBTAINED." */, 1);
    yield* game.confirmKey();
  } else {
    yield* game.notice(5, 2, 0x15, 3, 0, 0x211 /* "REDUNDANT DATA DISCARDED." */, 1);
    yield* game.confirmKey();
  }
  return null;
}

// Script 0D2: 1 argument.
export function* script0D2(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.wait(1, 2);
  state.setWord('GROUP_LEADER_ONLY', 0, 0xffff);
  yield* game.removeObject(object);
  return null;
}

// Script 0D3: no arguments.
export function* script0D3(state) {
  const t1 = yield* run.byNegotiation(0x5dc, 0x4b0, 0x320);
  const t2 = yield* run.byNegotiationB(0x16b, 0x16c, 0x16d);
  yield* run.script162(0xba6, t2, t1, 0x16a, 0x169);
  return null;
}

// Script 0D4: 1 argument.
export function* script0D4(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* run.script31F(local0, 2);
  return null;
}

// Script 0D5: 1 argument.
export function* script0D5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0xb3d)) & 0x80) === 0) {
    yield* run.script06E(object, 0xb3d, 0, 0x7a, 0x2000);
    yield* game.notice(2, 2, 0x11, 3, 0x400, 0xa6 /* "Okay man, let's hit it!" */, 0x78);
    yield* game.removeObject(object);
    yield* game.addSceneObject(0x63, 0, 0, 0, 0, 0xb3d, 0xa);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}

// Script 0D6: 1 argument.
export function* script0D6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.waitUntilDefeated(object);
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(0x10, 0);
  yield* run.script04B();
  yield* game.notice(0xa, 0x15, 0xb, 3, 0x800, 0x1f5 /* "2,000 nuyen." */, 0xf0);
  yield* game.addNuyen(0x7d0);
  yield* game.resetObjectRecordProperty(object);
  yield* game.removeObject(object);
  return null;
}

// Script 0D7: no arguments.
export function* script0D7(state) {
  if (((yield* game.getActorStateFlags(0x23e)) & 1) === 0) {
    if ((yield* game.isActorStateProperty(0x1538, 0x23e)) === 0) {
      yield* game.topicText(
        0xd1 /* "You gots big dreams! You not last long, but crowds like! Fig..." */,
      );
      if ((yield* game.question(0x18, 6)) === 0) {
        yield* game.topicText(0xe3 /* "Yep, you're right, King much too tough for you." */);
      } else {
        yield* game.setActorStateFlagBits(0x1b66, 8);
        yield* game.endDialog();
      }
    } else {
      yield* game.topicText(0xd0 /* "The King is dead chummer, but life goes on..." */);
    }
  } else {
    yield* game.topicText(0xde /* "The King doesn't want to fight you..." */);
  }
  return null;
}

// Script 0D8: 1 argument.
export function* script0D8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* run.script07E(3)) === 0) {
    yield* game.removeObject(object);
  } else {
    yield* game.setObjectArmour(object, 2);
    yield* game.setObjectRecordCount(object, 0xf);
    yield* run.script2F7(object, 2, 4, 0, 0x32);
    yield* run.dropNuyen15E(yield* run.leaveBody(object));
  }
  return null;
}

// Script 0D9: 1 argument.
export function* script0D9(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      7,
      0x800,
      0x226 /* "Anti-AI program finally complete. Courier is to deliver it t..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 0DA: 1 argument.
export function* script0DA(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.scriptAction(0x80)) === 0x80) {
    yield* game.notice(
      2,
      0x12,
      0x1c,
      8,
      0x800,
      0x227 /* "After meeting with the Jester, he agreed to aid us in our pl..." */,
      0xf0,
    );
  }
  yield* game.removeObject(object);
  return null;
}

// Script 0DB: 1 argument.
export function* script0DB(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, yield* game.randomBelow(7), 3);
  return null;
}

// Script 0DC: 1 argument.
export function* script0DC(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if ((yield* game.getObjectRecordFlags(object)) === 0) {
    yield* game.setObjectRecordFlags(object, 0xa);
  }
  yield* run.script174(object, 4, 1, 0xf, 5, 0);
  return null;
}

// Script 0DD: 1 argument.
export function* script0DD(state, arg0) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local4 = 0;
  function* sub110() {
    local1 = 0;
    for (;;) {
      if (((yield* game.wait(0x801, 5)) & 0x800) !== 0) {
        local4 = 255;
      }
      if ((signed(local4) | truth(less(yield* game.getDistanceToPlayer(object), 0x64))) !== 0) {
        return signed(local4);
      }
    }
  }
  function* sub5() {
    const t1 = (yield* game.randomByte()) & 3;
    local2 = t1;
    if (local2 !== 0) {
      if (local2 !== 1) {
        if (local2 !== 2) {
          return 0x117;
        }
        return 0x116;
      }
      return 0x115;
    }
    return 0x114;
  }
  function* sub50() {
    for (;;) {
      if (((yield* game.wait(0x802, 0)) & 0x800) === 0) {
        yield* game.turnObjectToPlayer(object);
        yield* game.notice(
          2,
          2,
          0x18,
          3,
          0x400,
          0x113 /* "Don't hurt me! I've got nothing!" */,
          0xf0,
        );
        if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
          yield* game.setObjectDirection(object, 2);
        } else {
          return;
        }
      } else {
        return;
      }
    }
  }
  object = arg0 & 0xff;
  yield* game.setObjectAnimation(object, 0);
  if (((yield* game.getActorStateFlags(0x1d96)) & 1) === 0) {
    yield* game.setObjectDirection(object, 2);
    if ((yield* sub110()) === 0) {
      yield* game.turnObjectToPlayer(object);
      yield* game.notice(
        4,
        2,
        0x18,
        5,
        0x400,
        0x112 /* "Intruder! I'm calling the guards. Outsiders are not allowed ..." */,
        0x140,
      );
      yield* game.setActorStateFlagBits(0x1d96, 1);
    }
  } else {
    yield* game.setObjectDirection(object, 2);
    if ((yield* sub110()) === 0) {
      yield* game.turnObjectToPlayer(object);
      yield* game.notice(4, 2, 0x17, 4, 0x400, yield* sub5(), 0x140);
    }
  }
  if (signed(local1) === 0) {
    if (((yield* game.wait(0x801, 0x64)) & 0x800) === 0) {
      yield* game.setObjectDirection(object, 2);
      if (((yield* game.wait(0x801, 0x3c)) & 0x800) === 0) {
        yield* sub50();
      }
    }
  }
  yield* run.leaveBodyAndResetRecord(object);
  return null;
}

// Script 0DE: 1 argument.
export function* script0DE(state, arg0) {
  let object = 0,
    local1 = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  local1 = 0;
  for (;;) {
    if (((yield* game.wait(0x800, 0)) & 0x800) === 0) {
      yield* game.notice(
        2,
        0x16,
        0x1c,
        4,
        0x800,
        0x118 /* "This guy is jacked into the MATRIX. He'll be a while..." */,
        0xf0,
      );
    } else {
      local1 = 255;
    }
    if (signed(local1) !== 0) {
      yield* game.setActorStateFlagBits(0x1768, 0x40);
      yield* run.leaveBodyAndResetRecord(object);
      return null;
    }
  }
}

// Script 0DF: 1 argument.
export function* script0DF(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setSpriteMode(object, 0x8001);
  yield* game.setObjectFlagBits(object, 0x20);
  yield* game.setObjectActionAndDirection(object, 1, 1);
  yield* game.setObjectVelocity(object, 1, 0xfffd, 8);
  yield* game.wait(1, 0xa);
  yield* game.removeObject(object);
  return null;
}
