import { readFile } from 'node:fs/promises';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const original = await load('scripts');
const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')) });
const state = createScriptState({ byteLength: 0x32, slotState: slots });
const parse = input => {
  if (!/^(?:0x)?[0-9a-f]{1,4}$/i.test(input ?? '')) throw new Error('Expected hexadecimal word');
  return parseInt(input.replace(/^0x/i, ''), 16);
};
const callerMode = process.argv[2] === '--caller';
const id = callerMode ? parse(process.argv[3]) : 2;
const args = callerMode ? process.argv.slice(4).map(parse) : [];
const word = value => [0x14, value & 255, value >>> 8];
// Explicit synthetic orchestration under original $002's sourced frame profile.
const code = [0x197, 64, 456, 123, 11].flatMap(word).concat([0x58, 0xA9, 0x56]);
const bundle = callerMode ? original : { ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s) };
const scheduler = createScriptScheduler(bundle, { frameAllocator: allocator });
scheduler.addTask(id, args);
const compact = result => ({
  status: result.execution.status, boundary: result.boundary, actions: result.actions,
  pending: result.execution.pending, cursor: result.execution.cursor,
  tasks: result.execution.tasks.map(t => ({ taskId: t.taskId, scriptId: t.scriptId, status: t.status, steps: t.steps, checks: t.checks, frames: t.frames.map(f => ({ id: f.id, pc: f.pc, stack: f.stack, memory: f.memory })) })),
  memory: { activeOrder: allocator.snapshot().activeOrder, cursorOffset: allocator.snapshot().cursorOffset, workspace: allocator.snapshot().workspace },
  slots: { lastOffset: slots.snapshot().activeList.lastOffset, createdDefinition: slots.snapshot().definitions[43], originalTaskHandle: slots.snapshot().columns['1350'][43] },
});
const first = compact(visitTailWithState(scheduler, state));
const passes = [first];
if (!callerMode && first.status !== 'native_call') {
  passes.push(compact(sweepWithState(scheduler, state))); // Cursor priming only.
  passes.push(compact(sweepWithState(scheduler, state))); // First actual new-root visit.
}
console.log(JSON.stringify({ scope: callerMode ? 'Unmodified European original caller; synthetically supplied root arguments and initializer-derived data only. Unknown effects remain pending; no original scene claimed.' : 'Synthetic A9 caller using a sourced allocation profile; spawned $197 is unmodified original code. No scene, emulator, renderer or audio.', root: { id, args }, passes }, null, 2));
