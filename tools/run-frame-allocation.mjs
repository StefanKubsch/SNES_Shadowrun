import { readFile } from 'node:fs/promises';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';

const parseWord = text => {
  if (!/^[0-9a-f]{1,4}$/i.test(text ?? '')) throw new Error('Expected hexadecimal script ID/workspace words');
  return parseInt(text, 16);
};
const [idText = '197', ...argumentsText] = process.argv.slice(2);
const asset = JSON.parse(await readFile(new URL('../assets/task-frame-profiles.json', import.meta.url), 'utf8'));
const allocator = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(asset) });
const result = allocator.createFrame(parseWord(idText), argumentsText.map(parseWord));
console.log(JSON.stringify({ scope: 'Original frame data initialization with a synthetically supplied workspace; no original caller, list insertion or script execution.', ...result, freeTaskOffset: allocator.snapshot().freeTaskOffset }, null, 2));
