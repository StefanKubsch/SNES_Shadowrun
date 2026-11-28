// Start the selected spell, reading its current level when the task is created.
import { memberSpellState } from '../state/member-spells.mjs';
import { argumentWords, tasksOf } from '../script/task-api.mjs';

export function startSelectedSpell(mem, a) {
  const spell = memberSpellState(mem);
  spell.prepareCast();
  tasksOf(a).append(spell.script, argumentWords(mem, spell.script));
}
