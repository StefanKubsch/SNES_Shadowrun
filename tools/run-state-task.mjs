import { readFile } from 'node:fs/promises';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { runTaskWithState } from '../proof/state/host.mjs';

const texts = process.argv.slice(2);
let checks = 0;
const checkIndex = texts.indexOf('--checks');
if (checkIndex !== -1) {
  const count = texts[checkIndex + 1];
  if (checkIndex !== texts.length - 2 || !/^\d+$/.test(count) || Number(count) > 100000) throw new Error('Expected --checks DECIMAL_COUNT (0..100000) at end');
  checks = Number(count);
  texts.splice(checkIndex, 2);
}
const [idText = '060', ...argumentTexts] = texts;
if (!/^[0-9A-Fa-f]{1,4}$/.test(idText) || !argumentTexts.every(text => /^[0-9A-Fa-f]{1,4}$/.test(text))) throw new Error('Usage: node tools/run-state-task.mjs HEX_SCRIPT_ID [HEX_WORD_ARGUMENTS...] [--checks DECIMAL_COUNT]');
const bundle = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const task = createScriptTask(bundle, parseInt(idText, 16), argumentTexts.map(text => parseInt(text, 16)));
const state = createScriptState({ byteLength: 0x32 });
let outcome = runTaskWithState(task, state);
const actions = [...outcome.actions];
let performedChecks = 0;
while (performedChecks < checks && outcome.execution.status === 'waiting') {
  task.tick();
  performedChecks++;
  outcome = runTaskWithState(task, state);
  actions.push(...outcome.actions);
}
console.log(JSON.stringify({
  scope: 'Original script with five supported state actions and an explicitly selected 50-byte word window. Initial data is unknown. Checks have no assigned wall-clock duration; downstream scene/text consumers are not ported.',
  script: idText.toUpperCase(),
  ...outcome,
  actions,
  handledCalls: actions.length,
  performedChecks,
}, null, 2));
