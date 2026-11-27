// Scripts 3A0 to 3A8, decompiled from the original
// bytecode by tools/decompile-scripts.mjs (docs/READABLE-GAME.md, phase 2). Generated:
// edit the decompiler, not this file.
import { EVENT, less, signed, truth, word } from './runtime.mjs';
import { game } from './natives.mjs';
import { run } from './started.mjs';

// Script 3A0: 6 arguments.
export function* script3A0(state, arg0, arg1, arg2, arg3, arg4, arg5) {
  let object = 0,
    local1 = 0,
    local2 = 0,
    local3 = 0,
    local4 = 0,
    local5 = 0,
    local6 = 0,
    local7 = 0;
  block199: {
    object = arg0 & 0xff;
    local1 = arg1 & 0xff;
    local2 = arg2 & 0xff;
    local3 = arg3 & 0xff;
    local4 = arg4 & 0xff;
    local5 = arg5 & 0xff;
    if ((yield* run.rollEnemySpawn(local1)) === 0) {
      yield* game.removeObject(object);
    } else {
      yield* game.setObjectActionAndDirection(object, 6, 3);
      yield* game.wait(EVENT.TIMER, 0x3c);
      yield* game.setObjectRecordCount(object, local3);
      for (;;) {
        const t1 = yield* game.chooseEnemyTarget(object);
        local7 = t1 & 0xff;
        if (
          (truth(t1 !== 0xffff) &
            truth(
              less(
                yield* game.getObjectCoarseY(signed(local7)),
                yield* game.getObjectCoarseY(object),
              ),
            )) !==
          0
        ) {
          yield* game.setObjectAnimation(object, 1);
          yield* game.shootAtObject(object, signed(local7), local2, 0, local4, signed(local5));
          yield* game.turnObjectToObject(object, signed(local7));
          if (less(yield* game.getObjectDirection(object), 3)) {
            yield* game.setObjectDirection(object, 4);
          }
          yield* game.playSoundEffect(object, 0xc, 0xff, 3);
          if (local1 !== 0) {
            yield* game.appendToFightList(object);
            local1 = 0;
          }
        }
        const t2 = truth(
          ((yield* game.wait(
            EVENT.TIMER | EVENT.DEFEATED,
            word(0x64 + ((yield* game.randomByte()) & 0x1f)),
          )) &
            EVENT.DEFEATED) !==
            0,
        );
        local6 = t2 & 0xff;
        if (t2 !== 0) {
          yield* game.addKarma(1);
          yield* game.fightListRemove(object);
          yield* game.playSoundEffect(object, 0x14, 0xff, 3);
          yield* game.setObjectDirection(object, 3);
          yield* game.setObjectAnimation(object, 6);
          if ((yield* game.getObjectRecordFlags(object)) !== 0) {
            yield* game.setObjectRecordFlags(
              object,
              word((yield* game.getObjectRecordFlags(object)) - 1),
            );
          } else {
            yield* game.resetObjectRecordProperty(object);
          }
          yield* game.clearObjectTask(object);
          break block199;
        }
      }
    }
  }
  return null;
}

// Script 3A1: 1 argument.
export function* script3A1(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* run.script1AD(object, 4, 0x78, 0x72, 0);
  return null;
}

// Script 3A2: no arguments.
export function* combineTimeBomb(state) {
  if (
    ((yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x15bd /* "Detonator" */)) &
      (yield* game.isActorStateProperty(0x8b2 /* "Me" */, 0x13a2 /* "Explosives" */))) !==
    0
  ) {
    yield* game.setActorStateHolder(0x15bd /* "Detonator" */, 0x1538 /* "Dog Food" */);
    yield* game.setActorStateHolder(0x13a2 /* "Explosives" */, 0x1538 /* "Dog Food" */);
    yield* game.setActorStateHolder(0x230 /* "Time Bomb" */, 0x8b2 /* "Me" */);
  }
  return null;
}

// Script 3A3: no arguments.
export function* script3A3(state) {
  let local0 = 0,
    local2 = 0;
  local2 = yield* game.getScriptVariable(0x20);
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
  yield* game.setActorStateFlags(0x16c0 /* "Computer" */, 0);
  yield* game.changeScene(3, word(local2 - 1), local0);
  return null;
}

// Script 3A4: 2 arguments.
export function* walkToWaypoint(state, arg0, arg1) {
  let object = 0,
    waypoint = 0;
  object = arg0 & 0xff;
  waypoint = arg1 & 0xff;
  yield* game.setObjectAnimation(object, 2);
  yield* game.moveObjectStraightToWaypoint(object, waypoint);
  yield* game.wait(EVENT.ARRIVED, 0);
  return null;
}

// Script 3A5: 1 argument.
export function* script3A5(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.TIMER, 0x3c);
  yield* game.removeObject(object);
  return null;
}

// Script 3A6: 1 argument.
export function* script3A6(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 0, 0);
  yield* game.wait(EVENT.PICK_UP, 0);
  yield* game.addNuyen(0xbb8);
  yield* game.notice(0xb, 0x15, 0xb, 3, 0x800, 0x1f4 /* "3,000 nuyen." */, 0xb4);
  yield* game.resetObjectRecordProperty(object);
  yield* game.removeObject(object);
  return null;
}

// Script 3A7: 1 argument.
export function* script3A7(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  yield* game.setObjectActionAndDirection(object, 1, 5);
  yield* game.wait(EVENT.TIMER, 0x14);
  yield* game.removeObject(object);
  return null;
}

// Script 3A8: 1 argument.
export function* script3A8(state, arg0) {
  let object = 0;
  object = arg0 & 0xff;
  if (((yield* game.getActorStateFlags(0x15d2 /* "Decker" */)) & 0x80) === 0) {
    yield* run.talkOrStrikeBack(object, 0x15d2, 0, 0x7e, 0x2000);
    yield* game.notice(7, 3, 0x10, 3, 0x400, 0x191 /* "A wise choice human." */, 0xb4);
    yield* game.removeObject(object);
    yield* game.addSceneObject(0xd, 0, 0, 0, 0, 0x15d2, 0x28);
    return null;
  }
  yield* game.clearObjectTask(object);
  return null;
}
