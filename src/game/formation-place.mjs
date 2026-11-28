// Place a party object at its spacing in the leader's recorded trail. A step
// without a recorded height leaves the object untouched.
import { partyState } from '../state/party.mjs';
import { formationState } from '../state/formation.mjs';
import { formationSpacing } from '../content/formation.mjs';
import { selectObjectAnimation, turnObject } from './object-turn.mjs';
import { readStateWord, writeStateWord, setObjectWord, objectWord } from '../state/objects.mjs';

const WALKING = 2,
  STANDING = 0;
export function placeInFormation(mem) {
  const { wram } = mem,
    object = readStateWord(wram, 0),
    number = objectWord(mem, 'number', object),
    party = partyState(mem),
    trail = formationState(mem);
  let member = party.lastMember;
  while (number !== party.member(member).number) {
    member--;
    if (member < 0) break;
  }
  const step = trail.following(formationSpacing(mem, member));
  if (step.height === 0) return;
  setObjectWord(mem, 'height', object, step.height);
  setObjectWord(mem, 'x', object, step.x);
  setObjectWord(mem, 'y', object, step.y);
  writeStateWord(wram, 2, step.direction);
  turnObject(mem, wram);
  writeStateWord(wram, 2, trail.moving ? WALKING : STANDING);
  writeStateWord(wram, 0, object);
  selectObjectAnimation(mem, wram);
}
