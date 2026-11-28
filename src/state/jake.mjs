// Jake's mutable attributes, skills, spells and cyberware flags. These fields share
// the saved scene owner's independent arrays with scripts and the save serializer.
// The unidentified attribute stays preserved and is never initialized by New Game.
import { SCENE_ROOM_FIELDS, sceneRoomState } from './scene-room.mjs';
import { stateField } from './named-fields.mjs';

export const SKILL_NAMES = Object.freeze([
  'firearms',
  'unarmedCombat',
  'armedCombat',
  'computer',
  'leadership',
  'negotiation',
]);
export const SPELL_NAMES = Object.freeze([
  'powerball',
  'heal',
  'invisibility',
  'armour',
  'summonSpirit',
  'freeze',
]);
const states = new WeakMap();
export function jakeState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name, index) => stateField(mem, SCENE_ROOM_FIELDS, sceneRoomState, name, index),
    attributes = ['body', 'magic', 'strength', 'unidentifiedAttribute', 'charisma', 'maxHealth'],
    descriptors = {};
  for (const [index, name] of attributes.entries())
    descriptors[name] = field('leaderRecord', index);
  for (const [index, name] of ['alternatePortrait', 'dermalArmour', 'wiredReflexes'].entries())
    descriptors[name] = field('leaderFlags', index);
  const group = (names, start) =>
    Object.defineProperties(
      {},
      Object.fromEntries(names.map((name, index) => [name, field('leaderRecord', start + index)])),
    );
  state = Object.defineProperties(
    {
      skills: group(SKILL_NAMES, attributes.length),
      spells: group(SPELL_NAMES, attributes.length + SKILL_NAMES.length),
    },
    descriptors,
  );
  states.set(mem, state);
  return state;
}
