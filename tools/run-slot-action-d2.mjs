import { readFile } from 'node:fs/promises';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState } from '../proof/state/host.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.length && !['105', '252'].includes(args[0])) throw new Error('Usage: node tools/run-slot-action-d2.mjs [105|252]');
const id = args[0] === '252' ? 0x252 : 0x105;
const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')) });
const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
const rootArgs = id === 0x105 ? [created.value] : [0, 0, 0, 0, created.value];
const memory = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: memory });
scheduler.addTask(id, rootArgs);
const result = visitTailWithState(scheduler, createScriptState({ byteLength: 0x32, slotState: slots }));
console.log(JSON.stringify({
  scope: 'Synthetic orchestration: source-derived A9 creation then unmodified original 105/252 with explicit root arguments. D2 reads original Bank 8C, no additional slot-field fixtures. No scene, CPU or rendering.',
  scriptId: id, rootArgs, created, status: result.execution.status, actions: result.actions,
  boundary: result.boundary, pending: result.execution.pending,
  tasks: result.execution.tasks.map(task => ({ taskId: task.taskId, status: task.status, checks: task.checks, wait: task.wait, frames: task.frames.map(frame => ({ id: frame.id, pc: frame.pc })) })),
  slotFields: Object.fromEntries(Object.entries(slots.snapshot().columns).map(([key, values]) => [key, values[created.value / 2]])),
  fieldBytes11F0: slots.snapshot().fieldBytes['11F0'][created.value / 2],
  workspace: memory.snapshot().workspace,
}, null, 2));
