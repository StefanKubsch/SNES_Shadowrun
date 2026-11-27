// Scripts 3A0 to 3A8, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { less, script, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';

// Script 3A0: 6 arguments.
export function* script3A0(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let local0 = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block199: {
    local0 = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    local5 = arg5 & 0xff;
    if ((yield* script(0x07e, local1)) === 0) {
      yield* game.removeObject(local0);
    } else {
      yield* game.setObjectActionAndDirection(local0, 6, 3);
      yield* game.wait(1, 0x3c);
      yield* game.setObjectRecordCount(local0, local3);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(local0);
        local7 = t1 & 0xff;
        if (
          (truth(t1 !== 0xffff) &
            truth(
              less(
                yield* game.getObjectCoarseY(signed(local7)),
                yield* game.getObjectCoarseY(local0),
              ),
            )) !==
          0
        ) {
          yield* game.setObjectAnimation(local0, 1);
          yield* game.shootAtObject(local0, signed(local7), local2, 0, local4, signed(local5));
          yield* game.turnObjectToObject(local0, signed(local7));
          if (less(yield* game.getObjectDirection(local0), 3)) {
            yield* game.setObjectDirection(local0, 4);
          }
          yield* game.playSoundEffect(local0, 0xc, 0xff, 3);
          if (local1 !== 0) {
            yield* game.appendToFightList(local0);
            local1 = 0;
          }
        }
        const t2 = truth(
          ((yield* game.wait(0x801, word(0x64 + ((yield* game.randomByte()) & 0x1f)))) & 0x800) !==
            0,
        );
        local6 = t2 & 0xff;
        if (t2 !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(local0);
          yield* game.playSoundEffect(local0, 0x14, 0xff, 3);
          yield* game.setObjectDirection(local0, 3);
          yield* game.setObjectAnimation(local0, 6);
          if ((yield* game.getObjectRecordFlags(local0)) !== 0) {
            yield* game.setObjectRecordFlags(
              local0,
              word((yield* game.getObjectRecordFlags(local0)) - 1),
            );
          } else {
            yield* game.resetObjectRecordProperty(local0);
          }
          yield* game.clearObjectTask(local0);
          break block199;
        }
      }
    }
  }
  return null;
}

// Script 3A1: 1 argument.
export function* script3A1(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* script(0x1ad, local0, 4, 0x78, 0x72, 0);
  return null;
}

// Script 3A2: no arguments.
export function* script3A2(state) {
  if (
    ((yield* game.isActorStateProperty(0x8b2, 0x15bd)) &
      (yield* game.isActorStateProperty(0x8b2, 0x13a2))) !==
    0
  ) {
    yield* game.setActorStateHolder(0x15bd, 0x1538);
    yield* game.setActorStateHolder(0x13a2, 0x1538);
    yield* game.setActorStateHolder(0x230, 0x8b2);
  }
  return null;
}

// Script 3A3: no arguments.
export function* script3A3(state) {
  let local0 = 0,
    local2 = 0;
  const t1 = yield* game.getScriptVariable(0x20);
  local2 = t1;
  if (local2 !== 2) {
    if (local2 !== 3) {
      if (local2 !== 4) {
        if (local2 === 5) {
          local0 = 0x178;
        }
      } else {
        local0 = 0x172;
      }
    } else {
      local0 = 0x16b;
    }
  } else {
    local0 = 0x164;
  }
  if (local2 === 2) {
    yield* game.raiseStoryStage(6);
  }
  yield* game.setActorStateFlags(0x16c0, 0);
  yield* game.changeScene(3, word(local2 - 1), local0);
  return null;
}

// Script 3A4: 2 arguments.
export function* script3A4(state, arg0, arg1) {
  let local0 = 0,
    local1 = 0;
  local0 = arg0 & 0xff;
  local1 = arg1 & 0xff;
  yield* game.setObjectAnimation(local0, 2);
  yield* game.moveObjectStraightToWaypoint(local0, local1);
  yield* game.wait(4, 0);
  return null;
}

// Script 3A5: 1 argument.
export function* script3A5(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(1, 0x3c);
  yield* game.removeObject(local0);
  return null;
}

// Script 3A6: 1 argument.
export function* script3A6(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 0, 0);
  yield* game.wait(0x10, 0);
  yield* game.addNuyen(0xbb8);
  yield* game.notice(0xb, 0x15, 0xb, 3, 0x800, 0x1f4, 0xb4);
  yield* game.resetObjectRecordProperty(local0);
  yield* game.removeObject(local0);
  return null;
}

// Script 3A7: 1 argument.
export function* script3A7(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(local0, 1, 5);
  yield* game.wait(1, 0x14);
  yield* game.removeObject(local0);
  return null;
}

// Script 3A8: 1 argument.
export function* script3A8(state, arg0) {
  let local0 = 0;
  local0 = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x15d2)) & 0x80) === 0) {
    yield* script(0x06e, local0, 0x15d2, 0, 0x7e, 0x2000);
    yield* game.notice(7, 3, 0x10, 3, 0x400, 0x191, 0xb4);
    yield* game.removeObject(local0);
    yield* game.addSceneObject(0xd, 0, 0, 0, 0, 0x15d2, 0x28);
    return null;
  }
  yield* game.clearObjectTask(local0);
  return null;
}
