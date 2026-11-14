import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState } from '../proof/state/host.mjs';

if (process.argv.length !== 2) throw new Error('Usage: node tools/run-slot-selection.mjs');
const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')) });
const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
const suppliedFields = { '10E8': 0, '1038': 0 };
slots.seedSlotFields(created.value, suppliedFields);
const memory = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: memory });
scheduler.addTask(0x318, [created.value]);
const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: slots }));
console.log(JSON.stringify({
  scope: 'Synthetic orchestration: source-derived A9 creation, explicit 10E8/1038 field fixture, then unmodified original 318. Data reads use original Bank 8C. No scene, CPU or rendering.',
  created, suppliedFields, status: result.execution.status, actions: result.actions,
  boundary: result.boundary, pending: result.execution.pending,
  slotFields: Object.fromEntries(Object.entries(slots.snapshot().columns).map(([key, values]) => [key, values[created.value / 2]])),
  fieldBytes11F0: slots.snapshot().fieldBytes['11F0'][created.value / 2],
  workspace: memory.snapshot().workspace,
}, null, 2));
