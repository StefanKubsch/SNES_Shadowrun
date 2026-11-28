// The party's trail: ordinary step indices and named position records over the
// existing independent owner. Legacy word wrapping stays in this temporary bridge.
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { stateField } from './named-fields.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

export const FORMATION_STEPS = COMBAT_FIELDS.formationX.count;
const states = new WeakMap();
export function formationState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name, index = 0) => stateField(mem, COMBAT_FIELDS, combatState, name, index),
    index = field('formationIndex'),
    unmoved = field('formationUnmoved'),
    records = new Map();
  state = Object.defineProperties(
    {},
    {
      player: stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, 'playerObject'),
      hitFrames: field('hitFrames'),
      head: {
        get: () => index.get() / 2,
        set(value) {
          index.set(value * 2);
        },
      },
      moving: {
        get: () => unmoved.get() === 0,
        set(value) {
          unmoved.set(value ? 0 : WORD_MASK);
        },
      },
    },
  );
  state.step = (at) => {
    let record = records.get(at);
    if (!record) {
      record = Object.defineProperties(
        {},
        {
          x: field('formationX', at),
          y: field('formationY', at),
          height: field('formationHeight', at),
          direction: field('formationDirection', at),
        },
      );
      records.set(at, record);
    }
    return record;
  };
  state.retreat = () => {
    const previous = (index.get() - 2) & WORD_MASK;
    index.set(previous & WORD_SIGN ? (FORMATION_STEPS - 1) * 2 : previous);
    return state.step(state.head);
  };
  state.following = (spacing) => {
    let at = (index.get() + spacing * 2) & WORD_MASK;
    if (at >= FORMATION_STEPS * 2) at -= FORMATION_STEPS * 2;
    return state.step(at / 2);
  };
  states.set(mem, state);
  return state;
}
