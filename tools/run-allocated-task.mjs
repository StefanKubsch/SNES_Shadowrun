import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createScriptTask } from '../proof/script/task.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { runTaskWithState } from '../proof/state/host.mjs';

const parseWord = text => {
  if (!/^[0-9a-f]{1,4}$/i.test(text ?? '')) throw new Error('Expected hexadecimal script ID/arguments');
  return parseInt(text, 16);
};
const inputs = process.argv.slice(2);
const checkIndex = inputs.indexOf('--checks');
const checkText = checkIndex < 0 ? '0' : inputs[checkIndex + 1];
if (!/^\d+$/.test(checkText ?? '')) throw new Error('Expected readiness check count');
const checks = Number(checkText);
if (!Number.isSafeInteger(checks) || checks > 1000000) throw new Error('Invalid readiness check count');
if (checkIndex >= 0) inputs.splice(checkIndex, 2);
const [id = '197', ...argumentTexts] = inputs;
const bundle = JSON.parse(await readFile(new URL('../assets/scripts.json', import.meta.url), 'utf8'));
const asset = JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8'));
const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(asset) });
const task = createScriptTask(bundle, parseWord(id), argumentTexts.map(parseWord), { frameAllocator: allocator });
const state = createScriptState({ byteLength: 0x32 });
let result = runTaskWithState(task, state);
for (let index = 0; index < checks && result.execution.status === 'waiting'; index++) {
  task.tick();
  result = runTaskWithState(task, state);
}
const memory = allocator.snapshot();
console.log(JSON.stringify({ scope: 'Original script with original allocation and synthetically supplied root arguments; no original scene/caller.', ...result, memory: { freeTaskOffset: memory.freeTaskOffset, tailOffset: memory.tailOffset, cursorOffset: memory.cursorOffset, activeOrder: memory.activeOrder, workspace: memory.workspace, headers: memory.heap.headers } }, null, 2));
