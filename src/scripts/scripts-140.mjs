// Scripts 140 to 15F, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import {
  less,
  notEqualOrNegativeLeft,
  script,
  shiftLeft,
  signed,
  truth,
  word,
} from './runtime.mjs';
import { game } from './natives.mjs';

// Script 140: 1 argument.
export function* script140(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectDirection(local0, 5);
  yield* game.setObjectFlagBits(local0, 0x100);
  loop13: for (;;) {
    yield* game.setObjectAnimation(local0, 2);
    loop18: for (;;) {
      yield* game.wait(0x200, 0);
      if (less(yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()), 0x1d0)) {
        yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
        yield* game.setObjectAnimation(local0, 4);
        yield* game.wait(1, 0xa);
        if ((yield* game.testObjectCollision(local0, 0)) === 0) {
          yield* game.wait(8, 0);
          loop104: for (;;) {
            yield* game.setObjectAnimation(local0, 0);
            loop108: for (;;) {
              yield* game.wait(0x400, 0);
              if (less(yield* game.getObjectCoarseX(yield* game.getPlayerObjectCopy()), 0x1d0)) {
                yield* game.setObjectAnimation(local0, 6);
                yield* game.wait(1, 0xa);
                if ((yield* game.testObjectCollision(local0, 2)) === 0) {
                  yield* game.wait(8, 0);
                  yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
                  continue loop13;
                }
                yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
                yield* game.wait(1, 5);
                continue loop104;
              }
              yield* script(0x26d);
              continue loop108;
            }
          }
        } else {
          yield* game.playSoundEffect(local0, 0x20, 0xff, 3);
          yield* game.wait(1, 5);
          yield* game.playSoundEffect(local0, 0x2e, 0xff, 3);
          continue loop13;
        }
      } else {
        yield* script(0x26d);
        continue loop18;
      }
    }
  }
}

// Script 141: 1 argument.
export function* script141(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5() {
    const t1 = word(((yield* game.randomByte()) & 7) + 2);
    const t2 = word(((yield* game.randomByte()) & 0xf) + 4);
    yield* game.notice(t2, t1, 7, 3, 0x400, 0x7d, 0x1e);
    yield* game.playSoundEffect(local0, 0x3a, 0xff, 3);
    yield* game.wait(1, word(0xa + ((yield* game.randomByte()) & 0xf)));
    return;
  }
  local0 = arg0 & 0xff;
  block291: {
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block291;
    }
    local1 = 0;
    loop70: for (;;) {
      yield* game.setObjectAnimation(local0, 1);
      yield* game.moveObjectStraightToPlayer(local0);
      local2 = word(0x78 + ((yield* game.randomByte()) & 0x7f));
      loop88: for (;;) {
        yield* game.wait(1, 1);
        const t3 = word(local2 - 1);
        local2 = t3;
        if ((truth(t3 === 0) | truth(((yield* game.getActorStateFlags(0x1921)) & 1) !== 0)) === 0) {
          continue loop88;
        }
        block131: {
          if (((yield* game.getActorStateFlags(0x1921)) & 1) === 0) {
            break block131;
          }
          local1 = 255;
          break block131;
        }
        yield* game.stopMotion(local0);
        yield* game.clearObjectVelocity(local0);
        yield* game.setObjectAnimation(local0, 0);
        yield* game.wait(1, word(((yield* game.randomByte()) & 0x7f) + 0x28));
        if (signed(local1) === 0) {
          continue loop70;
        }
        yield* game.setObjectAnimation(local0, 1);
        yield* game.native81(local0, 0xc);
        yield* game.wait(4, 0);
        yield* game.keepObjectFlagBits(local0, 0xffbf);
        yield* game.native81(local0, 8);
        yield* game.wait(4, 0);
        yield* game.setObjectRecordFlagBits(local0, 0x40);
        yield* game.notice(9, 2, 0xc, 3, 0x400, 0x7c, 0x78);
        yield* game.native81(local0, 0xb);
        yield* game.wait(4, 0);
        yield* game.stopMotion(local0);
        yield* game.setActorStateFlagBits(0x1546, 0x80);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* script(0x0ae, local0);
        local2 = 6;
        loop247: for (;;) {
          yield* sub5();
          const t4 = word(local2 - 1);
          local2 = t4;
          if (t4 !== 0) {
            continue loop247;
          }
          yield* game.setObjectAnimation(local0, 1);
          yield* game.native81(local0, 0xd);
          yield* game.wait(4, 0);
          yield* game.native81(local0, 0xe);
          yield* game.wait(4, 0);
          yield* game.removeObject(local0);
          break block291;
        }
      }
    }
  }
  return null;
}

// Script 142: 1 argument.
export function* script142(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block152: {
    local0 = arg0 & 0xff;
    yield* game.setSpriteMode(local0, 1);
    local1 = 0;
    yield* game.setScriptVariable(0x2a, 0);
    if (((yield* game.getObjectRecordFlags(local0)) & 0x80) !== 0) {
      break block152;
    }
    loop25: for (;;) {
      block66: {
        if (local1 !== 1) {
          break block66;
        }
        loop33: for (;;) {
          yield* game.wait(1, 6);
          if (((yield* game.getObjectRecordFlags(local0)) & 0x40) === 0) {
            continue loop33;
          }
          yield* game.wait(1, 0xa);
          yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
          break block66;
        }
      }
      yield* game.setObjectFlagBits(local0, 0x100);
      yield* game.setObjectActionAndDirection(local0, 2, 5);
      loop79: for (;;) {
        block111: {
          if ((((yield* game.wait(0x281, 6)) ^ 0xffff) & 1) === 0) {
            break block111;
          }
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0xf0);
          break block111;
        }
        if ((yield* game.getScriptVariable(0x2a)) !== 0) {
          continue loop79;
        }
        yield* game.setObjectAnimation(local0, 4);
        yield* game.playSoundEffect(local0, 0x3e, 0xff, 3);
        yield* game.wait(8, 0);
        const t1 = word(local1 + 1);
        local1 = t1 & 0xff;
        if (t1 !== 2) {
          continue loop25;
        }
        break block152;
      }
    }
  }
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.setObjectRecordFlagBits(local0, 0x80);
  yield* game.keepObjectFlagBits(local0, 0xfeff);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 143: no arguments.
export function* script143(state) {
  block51: {
    if ((yield* game.question(0x12, 0xa)) === 0) {
      yield* game.topicText(0x1a2);
      break block51;
    }
    block43: {
      if ((yield* game.payNuyen(0x64)) === 0) {
        yield* game.notice(8, 2, 0xf, 3, 0, 2, 0x78);
        break block43;
      }
      yield* game.endDialog();
      yield* game.setActorStateFlagBits(0xdd6, 1);
      break block43;
    }
    break block51;
  }
  return null;
}

// Script 144: 1 argument.
export function* script144(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28e, local0);
  yield* script(0x1ba, yield* script(0x35d, local0));
  return null;
}

// Script 145: 1 argument.
export function* script145(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop8: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 1) === 0) {
      continue loop8;
    }
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    state.setWord('COLOUR_REQUEST', 0, 4);
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 146: 1 argument.
export function* script146(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectFlagBits(local0, 0x100);
  yield* game.setObjectActionAndDirection(local0, 3, 5);
  loop15: for (;;) {
    block46: {
      if (((yield* game.wait(0x281, 6)) & 1) !== 0) {
        break block46;
      }
      yield* game.notice(7, 0x15, 0x10, 3, 0x800, 0x9b, 0xb4);
      break block46;
    }
    continue loop15;
  }
}

// Script 147: 2 arguments.
export function* script147(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block165: {
    const t1 = arg1;
    local0 = arg0 & 0xff;
    local1 = t1 & 0xff;
    yield* game.setObjectDirection(local0, 5);
    if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
      break block165;
    }
    block48: {
      yield* game.setObjectFlagBits(local0, 0x100);
      yield* game.setObjectAnimation(local0, 2);
      if (signed(local1) === 0) {
        yield* game.setObjectAnimation(local0, 3);
        break block48;
      }
      yield* game.setObjectAnimation(local0, 2);
      break block48;
    }
    loop48: for (;;) {
      block112: {
        const t2 = yield* game.wait(0x281, 1);
        local2 = t2;
        if ((t2 & 0x80) === 0) {
          if ((local2 & 0x200) === 0) {
            break block112;
          }
          yield* game.notice(2, 0x15, 0x10, 3, 0x800, 0x9b, 0xf0);
          break block112;
        }
        yield* game.notice(2, 0x15, 0x1c, 3, 0x800, 0x9c, 0x78);
        break block112;
      }
      if (((yield* game.getObjectRecordFlags(local0)) & 0x80) === 0) {
        continue loop48;
      }
      block159: {
        yield* game.keepObjectRecordFlagBits(local0, 0x7f);
        yield* game.setObjectRecordFlagBits(local0, 1);
        yield* game.playSoundEffect(local0, 0x2c, 0xff, 3);
        if (signed(local1) === 0) {
          yield* game.setObjectAnimation(local0, 5);
          break block159;
        }
        yield* game.setObjectAnimation(local0, 4);
        break block159;
      }
      yield* game.wait(8, 0);
      break block165;
    }
  }
  block182: {
    if (signed(local1) === 0) {
      yield* game.setObjectAnimation(local0, 1);
      break block182;
    }
    yield* game.setObjectAnimation(local0, 0);
    break block182;
  }
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 148: 1 argument.
export function* script148(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop8: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 2) === 0) {
      continue loop8;
    }
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    state.setWord('COLOUR_REQUEST', 0, 4);
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 149: 1 argument.
export function* script149(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.playSoundEffect(local0, 0x66, 0xff, 3);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.wait(1, 0xa);
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  yield* game.removeObject(local0);
  return null;
}

// Script 14A: no arguments.
export function* script14A(state) {
  yield* game.setActorStateFlagBits(0x3f0, 0x80);
  return null;
}

// Script 14B: 1 argument.
export function* script14B(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.setObjectActionAndDirection(local0, 0, 4);
  yield* game.setObjectDialog(local0, 0x2c);
  yield* game.wait(2, 0);
  return null;
}

// Script 14C: 1 argument.
export function* script14C(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x28d, local0, 0x32, 0x9c40, 0x1b5f, 0);
  return null;
}

// Script 14D: 1 argument.
export function* script14D(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  state.setWord('MEMBER_INDEX', 0, 0);
  yield* game.equipRunnerWeapon(local0, 1, 8, 3);
  yield* game.wait(1, 1);
  yield* game.removeObject(local0);
  return null;
}

// Script 14E: 1 argument.
export function* script14E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  function* sub5(in0, in1) {
    const t1 = in1;
    local1 = in0 & 0xff;
    local2 = t1 & 0xff;
    yield* game.setObjectActionAndDirection(local0, local2, local1);
    yield* game.wait(0xa, 0);
    yield* game.wait(3, word(0x64 + ((yield* game.randomByte()) & 0x7f)));
    return;
  }
  local0 = arg0 & 0xff;
  yield* game.setObjectDialog(local0, 0x47);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  loop47: for (;;) {
    yield* sub5(3, 7);
    yield* sub5(5, 8);
    yield* sub5(5, 8);
    yield* sub5(7, 7);
    continue loop47;
  }
}

// Script 14F: 1 argument.
export function* script14F(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop8: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 4) === 0) {
      continue loop8;
    }
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    state.setWord('COLOUR_REQUEST', 0, 4);
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 150: no arguments.
export function* script150(state) {
  block45: {
    if (((yield* game.getActorStateFlags(0x1d11)) & 1) === 0) {
      break block45;
    }
    yield* game.raiseStoryStage(2);
    yield* game.setActorStateFlagBits(0x818, 0x80);
    yield* game.setActorStateFlagBits(0x842, 0x80);
    yield* game.setActorStateFlagBits(0x208a, 0x80);
    yield* game.changeScene(0x8000, 0, 0x95);
    break block45;
  }
  return null;
}

// Script 151: no arguments.
export function* script151(state) {
  block39: {
    if (((yield* game.getActorStateFlags(0x208a)) & 1) === 0) {
      break block39;
    }
    yield* game.setActorStateFlagBits(0x80a, 0x80);
    yield* game.setActorStateFlagBits(0x826, 0x80);
    yield* game.setActorStateFlagBits(0x1d11, 0x80);
    yield* game.changeScene(0, 0, 0x8b);
    break block39;
  }
  return null;
}

// Script 152: 1 argument.
export function* script152(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 2, 0);
  yield* game.clearObjectTask(local0);
  return null;
}

// Script 153: no arguments.
export function* script153(state) {
  yield* script(0x0c8, 0x1650, 0x32, 0x1a5);
  return null;
}

// Script 154: 1 argument.
export function* script154(state, arg0) {
  let local0 = 0,
    local1 = 0;
  block80: {
    local0 = arg0 & 0xff;
    if (((yield* game.getObjectRecordFlags(local0)) & 1) === 0) {
      break block80;
    }
    yield* game.resetObjectRecordProperty(local0);
    yield* game.setObjectActionAndDirection(local0, 0, 6);
    yield* game.wait(1, 0x32);
    local1 = 0xffff;
    loop32: for (;;) {
      yield* game.setObjectVelocity(local0, local1, 0, 0);
      yield* game.wait(1, 0x14);
      const t1 = word(local1 - 1);
      local1 = t1;
      if (t1 !== 0xfff7) {
        continue loop32;
      }
      yield* game.wait(1, 0x1e);
      yield* game.setObjectVelocity(local0, 0xfffa, 4, 0);
      yield* game.wait(1, 5);
      break block80;
    }
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 155: 1 argument.
export function* script155(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 5);
  loop8: for (;;) {
    yield* game.wait(1, 0x14);
    if (((yield* game.getActorStateFlags(0x1d96)) & 8) === 0) {
      continue loop8;
    }
    yield* game.setObjectActionAndDirection(local0, 1, 5);
    state.setWord('COLOUR_REQUEST', 0, 4);
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 156: no arguments.
export function* script156(state) {
  yield* game.changeScene(5, 0, 3);
  return null;
}

// Script 157: 5 arguments.
export function* script157(state, arg0, arg1, arg2, arg3, arg4) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block293: {
    const t1 = arg4;
    const t2 = arg3;
    const t3 = arg2;
    const t4 = arg1;
    local0 = arg0 & 0xff;
    local1 = t4 & 0xff;
    local2 = t3 & 0xff;
    local3 = t2 & 0xff;
    local4 = t1 & 0xff;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
      break block293;
    }
    local7 = 0;
    yield* game.setObjectRecordCount(local0, local2);
    yield* game.setObjectActionAndDirection(local0, 4, 3);
    loop33: for (;;) {
      block246: {
        const t5 = yield* game.chooseEnemyTarget(local0);
        local6 = t5 & 0xff;
        if (t5 === 0xffff) {
          local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
          break block246;
        }
        block147: {
          if (
            !less(
              yield* game.getObjectCoarseY(signed(local6)),
              yield* game.getObjectCoarseY(local0),
            )
          ) {
            block130: {
              if (!notEqualOrNegativeLeft(local7, local4)) {
                break block130;
              }
              local7 = word(local7 + 1);
              yield* game.setObjectVelocity(local0, 0, 1, 0);
              yield* game.setObjectActionAndDirection(local0, 1, 0);
              break block130;
            }
            local5 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
            yield* game.clearObjectVelocity(local0);
            break block147;
          }
          block84: {
            if (!notEqualOrNegativeLeft(local7, word(-local4))) {
              break block84;
            }
            local7 = word(local7 - 1);
            yield* game.setObjectVelocity(local0, 0, 0xffff, 0);
            yield* game.setObjectActionAndDirection(local0, 1, 6);
            break block84;
          }
          local5 = truth(((yield* game.wait(0x801, 0x1e)) & 0x800) !== 0) & 0xff;
          yield* game.clearObjectVelocity(local0);
          break block147;
        }
        block229: {
          if (
            (truth(signed(local6) !== 0xffff) &
              truth(
                less(
                  yield* game.getObjectCoarseX(signed(local6)),
                  word((yield* game.getObjectCoarseX(local0)) + 0x14),
                ),
              ) &
              (signed(local5) ^ 0xffff)) ===
            0
          ) {
            break block229;
          }
          block215: {
            yield* game.setObjectAnimation(local0, 4);
            yield* game.shootAtObject(local0, signed(local6), 3, 0, 5, 0);
            yield* game.setObjectDirection(local0, 7);
            yield* game.playSoundEffect(local0, 0xe, 0xff, 3);
            if (local1 === 0) {
              break block215;
            }
            yield* game.appendToFightList(local0);
            local1 = 0;
            break block215;
          }
          local5 = truth(((yield* game.wait(0x801, 0x14)) & 0x800) !== 0) & 0xff;
          break block229;
        }
        break block246;
      }
      if (signed(local5) === 0) {
        continue loop33;
      }
      block265: {
        yield* game.addKarma(1);
        if (local1 !== 0) {
          break block265;
        }
        yield* game.fightListRemove(local0);
        break block265;
      }
      const t6 = yield* game.getObjectCoarseHeight(local0);
      const t7 = yield* game.getObjectCoarseY(local0);
      const t8 = yield* game.getObjectCoarseX(local0);
      yield* game.createObject(0x9e, t8, t7, t6, 0x271);
      yield* script(0x068, local0);
      break block293;
    }
  }
  return null;
}

// Script 158: no arguments.
export function* script158(state) {
  block61: {
    if (((yield* game.getActorStateFlags(0x1f48)) & 1) === 0) {
      break block61;
    }
    yield* game.setActorStateFlagBits(0x81f, 0x80);
    yield* game.setActorStateFlagBits(0x83b, 0x80);
    yield* game.setActorStateFlagBits(0x1d0a, 0x80);
    yield* game.markTopic(0x12);
    yield* game.markTopic(0x1a);
    yield* game.markTopic(6);
    yield* game.markTopic(0xf);
    yield* game.markTopic(0x25);
    yield* game.changeScene(0x8000, 0, 0x20);
    break block61;
  }
  return null;
}

// Script 159: no arguments.
export function* script159(state) {
  block40: {
    if (((yield* game.getActorStateFlags(0x1d0a)) & 1) === 0) {
      break block40;
    }
    yield* game.setActorStateFlagBits(0x811, 0x80);
    yield* game.setActorStateFlagBits(0x1f48, 0x80);
    yield* game.setActorStateFlagBits(0x803, 0x80);
    yield* game.changeScene(0, 0, 0x18d);
    break block40;
  }
  return null;
}

// Script 15A: 1 argument.
export function* script15A(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.learnSpell(0x50);
  yield* game.markTopic(5);
  yield* game.setScriptVariableBits(2, 1);
  return null;
}

// Script 15B: 1 argument.
export function* script15B(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local2 = 0;
  block159: {
    local0 = arg0 & 0xff;
    yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) + 1));
    yield* game.setObjectAnimation(local0, 0);
    yield* game.turnObjectToPlayer(local0);
    yield* game.setObjectFlagBits(local0, 0x40);
    yield* game.appendToFightList(local0);
    yield* game.setObjectArmour(local0, 3);
    const t1 = yield* game.randomBelow(0xff);
    local1 = t1 & 0xff;
    if (!less(t1, 0x19)) {
      if (!less(local1, 0x32)) {
        if (!less(local1, 0x4b)) {
          if (!less(local1, 0x64)) {
            if (!less(local1, 0x7d)) {
              if (!less(local1, 0x96)) {
                if (!less(local1, 0xaf)) {
                  if (!less(local1, 0xc8)) {
                    local2 = 0;
                    break block159;
                  }
                  local2 = 1;
                  break block159;
                }
                local2 = 5;
                break block159;
              }
              local2 = 3;
              break block159;
            }
            local2 = 8;
            break block159;
          }
          local2 = 2;
          break block159;
        }
        local2 = 6;
        break block159;
      }
      local2 = 4;
      break block159;
    }
    local2 = 7;
    break block159;
  }
  block199: {
    yield* script(0x111, shiftLeft(local2, 8) | local0, 0, 0xffff, 0x300, 0x301, 0, 0);
    if ((yield* game.getScriptVariable(0x2a)) === 0) {
      break block199;
    }
    yield* game.setScriptVariable(0x2a, word((yield* game.getScriptVariable(0x2a)) - 1));
    break block199;
  }
  yield* game.fightListRemove(local0);
  yield* game.removeObject(local0);
  const t2 = yield* game.getObjectCoarseHeight(local0);
  const t3 = yield* game.getObjectCoarseY(local0);
  const t4 = yield* game.getObjectCoarseX(local0);
  yield* game.createObject(0x56, t4, t3, t2, 0x149);
  return null;
}

// Script 15C: 1 argument.
export function* script15C(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block50: {
    local0 = arg0 & 0xff;
    local1 = (yield* game.randomByte()) & 3;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, 1);
    yield* game.updateObjectDepthMode(local0);
    yield* game.wait(0x10, 0);
    if (!less(local1, 2)) {
      local3 = 0x1e6;
      break block50;
    }
    local3 = 0x1e5;
    break block50;
  }
  block89: {
    yield* game.notice(2, 0x15, 0xa, 3, 0x800, local3, 0xb4);
    yield* script(0x04b);
    if (!less(local1, 2)) {
      yield* game.addNuyen(0x14);
      break block89;
    }
    yield* game.addNuyen(0xa);
    break block89;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 15D: 1 argument.
export function* script15D(state, arg0) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 7);
  yield* game.setSpriteMode(local0, 0x8001);
  yield* game.keepObjectFlagBits(local0, 0xdfff);
  yield* game.native77(local0 | 0x80);
  yield* game.setSwarmPathPhaseTarget(0x140);
  yield* game.setSwarmPathSpeedTarget(0x40);
  yield* game.setSwarmHeightPhaseTarget(0x180);
  yield* game.setSwarmHeightSpeedTarget(0x180);
  local1 = 200;
  loop49: for (;;) {
    yield* game.moveSwarmAlongPath(local0);
    const t1 = word(local1 - 1);
    local1 = t1 & 0xff;
    if (t1 !== 0) {
      continue loop49;
    }
    block95: {
      if (((yield* game.getObjectRecordFlags(local0)) & 1) !== 0) {
        break block95;
      }
      yield* game.setObjectRecordFlagBits(local0, 1);
      state.setWord('COLOUR_REQUEST', 0, 1);
      yield* game.wait(1, 0x20);
      state.setWord('COLOUR_REQUEST', 0, 2);
      break block95;
    }
    yield* game.clearObjectTask(local0);
    return null;
  }
}

// Script 15E: 1 argument.
export function* script15E(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block81: {
    local0 = arg0 & 0xff;
    local1 = (yield* game.randomByte()) & 3;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, 1);
    yield* game.updateObjectDepthMode(local0);
    yield* game.wait(0x10, 0);
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          local3 = 0x1ea;
          break block81;
        }
        local3 = 0x1e9;
        break block81;
      }
      local3 = 0x1e8;
      break block81;
    }
    local3 = 0x1e7;
    break block81;
  }
  block149: {
    yield* game.notice(2, 0x15, 0xa, 3, 0x800, local3, 0xb4);
    yield* script(0x04b);
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          yield* game.addNuyen(0x3c);
          break block149;
        }
        yield* game.addNuyen(0x32);
        break block149;
      }
      yield* game.addNuyen(0x28);
      break block149;
    }
    yield* game.addNuyen(0x1e);
    break block149;
  }
  yield* game.removeObject(local0);
  return null;
}

// Script 15F: 1 argument.
export function* script15F(state, arg0) {
  let local0 = 0,
    local1 = 0,
    local3 = 0;
  block81: {
    local0 = arg0 & 0xff;
    local1 = (yield* game.randomByte()) & 3;
    yield* game.setObjectActionAndDirection(local0, 0, 0);
    yield* game.wait(1, 1);
    yield* game.updateObjectDepthMode(local0);
    yield* game.wait(0x10, 0);
    if (local1 !== 0) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          local3 = 0x1ee;
          break block81;
        }
        local3 = 0x1ed;
        break block81;
      }
      local3 = 0x1ec;
      break block81;
    }
    local3 = 0x1eb;
    break block81;
  }
  block150: {
    yield* game.notice(2, 0x15, 0xa, 3, 0x800, local3, 0xb4);
    yield* script(0x04b);
    if (local1 !== 1) {
      if (local1 !== 1) {
        if (local1 !== 2) {
          yield* game.addNuyen(0x64);
          break block150;
        }
        yield* game.addNuyen(0x5a);
        break block150;
      }
      yield* game.addNuyen(0x50);
      break block150;
    }
    yield* game.addNuyen(0x46);
    break block150;
  }
  yield* game.removeObject(local0);
  return null;
}
