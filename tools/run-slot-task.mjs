import { readFile } from 'node:fs/promises';
import { createScriptTask } from '../proof/script/task.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { runTaskWithState } from '../proof/state/host.mjs';

const [argumentText = '1234', fixtureFlag, ...extra] = process.argv.slice(2);
if (!/^[0-9A-Fa-f]{1,4}$/.test(argumentText) || fixtureFlag !== undefined && fixtureFlag !== '--fixture' || extra.length) throw new Error('Usage: node tools/run-slot-task.mjs HEX_WORD_ARGUMENT [--fixture]');
const argument = parseInt(argumentText, 16);
const offset = argument & 255;
const slots = createSlotState();
if (fixtureFlag === '--fixture') {
  // Synthetic occupied slot with an empty chain. No original scene/allocation
  // is claimed; real slot allocation through A9 is the next implementation.
  slots.seedSlot(offset, { definitionWord: 1, count: 0, head: 0 });
  slots.seedActiveList([offset]);
}
const state = createScriptState({ byteLength: 0x32, slotState: slots });
const bundle = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const outcome = runTaskWithState(createScriptTask(bundle, 0x060, [argument]), state);
console.log(JSON.stringify({
  scope: fixtureFlag ? 'Original $060 on an explicitly synthetic occupied-slot fixture; source-derived pool/list initialization. No scene or original slot allocation.' : 'Original $060 on the source-derived initial empty slot/list state. Per-slot counts/heads remain unknown; no invented occupancy.',
  script: '060', argument,
  ...outcome,
}, null, 2));
