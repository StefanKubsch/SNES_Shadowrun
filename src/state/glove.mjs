// Glove fields needed by window cleanup, shared with the existing game owners.
import { COMBAT_FIELDS, combatState } from './combat.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
const states = new WeakMap();
export function gloveState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name) => stateField(mem, COMBAT_FIELDS, combatState, name);
  state = Object.defineProperties(
    {},
    {
      kind: field('gloveKind'),
      targetTag: field('gloveTarget'),
      targetObject: field('gloveObject'),
      nameWindow: stateField(mem, WINDOW_TEXT_FIELDS, windowsText, 'gloveNameWindow'),
    },
  );
  states.set(mem, state);
  return state;
}
