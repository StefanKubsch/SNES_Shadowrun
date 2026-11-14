import { readFile } from 'node:fs/promises';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { runTaskWithState } from '../proof/state/host.mjs';

const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const definitionAsset = JSON.parse(await readFile(new URL('../assets/slot-definitions.json', import.meta.url), 'utf8'));
// Synthetic orchestration only. Slot data comes from real A9 effects and the
// extracted data window, followed by the unmodified original script $060.
const wrapper = {
  id: 0xFFFF, argumentBytes: 0, returnBytes: 0, localBytes: 0,
  bytecode: [0x0A, 0xFF, 0x00, 64, 0x14, 0xC8, 1, 0x00, 123, 0x00, 11, 0x58, 0xA9, 0x52, 0x60, 0, 0x56],
};
const bundle = { ...original, scripts: [...original.scripts, wrapper] };
const slotState = createSlotState({ definitionData: createSlotDefinitions(definitionAsset) });
const state = createScriptState({ byteLength: 0x32, slotState });
console.log(JSON.stringify({
  scope: 'Synthetic orchestration of European native A9 without script-task creation, followed by original $060. Definition data is extracted; no occupied-slot fixtures, original scene or graphics are claimed.',
  creationArgs: [11, 123, 456, 64, 0xFFFF],
  ...runTaskWithState(createScriptTask(bundle, wrapper.id), state),
}, null, 2));
