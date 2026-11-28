// Record the leader's movement in the party trail. A hit or an unchanged position
// marks it stationary. Room entry clears heights, keeping the other old step fields.
import { formationState, FORMATION_STEPS } from '../state/formation.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { OBJECT_FIELDS, isObjectSlot, objectWordIn, readStateWord } from '../state/objects.mjs';

const LOW_WRAM_END = 0x2000;
// Keep the established diagnostic boundary for a missing or invalid player slot.
function playerField(wram, name, slot) {
  if (isObjectSlot(slot)) return objectWordIn(wram, name, slot);
  const at = (OBJECT_FIELDS[name] + slot) & WORD_MASK;
  if (at + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
  return readStateWord(wram, at);
}
export function recordFormationStep(mem) {
  const trail = formationState(mem);
  if (trail.hitFrames) {
    trail.moving = false;
    return;
  }
  const slot = trail.player,
    x = playerField(mem.wram, 'x', slot),
    y = playerField(mem.wram, 'y', slot),
    height = playerField(mem.wram, 'height', slot),
    previous = trail.step(trail.head);
  if (x === previous.x && y === previous.y && height === previous.height) {
    trail.moving = false;
    return;
  }
  const step = trail.retreat();
  step.x = x;
  step.y = y;
  step.height = height;
  step.direction = playerField(mem.wram, 'direction', slot);
  trail.moving = true;
}

export function resetFormationTrail(mem) {
  const trail = formationState(mem);
  trail.head = 0;
  trail.step(0).x = trail.step(0).y = 0;
  for (let index = FORMATION_STEPS - 1; index >= 0; index--) trail.step(index).height = 0;
}
