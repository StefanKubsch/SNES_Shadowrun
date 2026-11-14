import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState } from '../proof/state/host.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.length && !['--fixture-equal', '--fixture-return', '--fixture-byte'].includes(args[0])) throw new Error('Usage: node tools/run-slot-action-6a.mjs [--fixture-equal|--fixture-return|--fixture-byte]');
const original = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const profiles = createTaskFrameProfiles(JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8')));
const memory = createTaskFrameAllocator({ profileData: profiles });
const data = createSlotActionData(JSON.parse(await readFile(new URL('../assets/slot-action-data.json', import.meta.url), 'utf8')));
const slots = createSlotState({ actionData: data });
// Only explicit synthetic field source. Definitions/counts/heads stay unknown
// or initializer-derived; no occupied-slot fixture or scene is manufactured.
const fields = args[0] === '--fixture-equal' ? { '1198': 5 } : args[0] === '--fixture-return' ? { '1198': 0, '10E8': 0, '1038': 0xFFFF } : args[0] === '--fixture-byte' ? { '1198': 0, '10E8': 1, '1090': 0x8000 } : {};
slots.seedSlotFields(0, fields);
if (args[0] === '--fixture-byte') slots.seedSlotFieldByte(0, '11F0', 0, 0x80);
const state = createScriptState({ byteLength: 0x32, slotState: slots });
const scheduler = createScriptScheduler(original, { frameAllocator: memory });
scheduler.addTask(0x318, [0]);
const result = visitTailWithState(scheduler, state);
console.log(JSON.stringify({
  scope: 'Unmodified original $318 with synthetically supplied root argument 0; any additional fields below are explicitly synthetic source fixtures. No scene, CPU or rendering.',
  suppliedFields: fields,
  suppliedLowByte: args[0] === '--fixture-byte' ? 0x80 : null,
  status: result.execution.status, actions: result.actions, boundary: result.boundary,
  pending: result.execution.pending,
  slotFields: Object.fromEntries(['1198', '10E8', '1038', '1090', '11F0'].map(key => [key, slots.snapshot().columns[key][0]])),
  fieldBytes11F0: slots.snapshot().fieldBytes['11F0'][0],
  memory: { activeOrder: memory.snapshot().activeOrder, cursorOffset: memory.snapshot().cursorOffset, workspace: memory.snapshot().workspace },
}, null, 2));
