import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom} from './rom.mjs';
import {taskRomHash} from './task-partial-source.mjs';
import {proveNativeWaitSources} from './task-native-wait-source.mjs';
const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong wait ROM');
const source=await proveNativeWaitSources(bytes);
await writeFile('analysis/render-task-native-wait.json',JSON.stringify(source,null,2)+'\n');
console.log('Original Native9F yield, distinct return owners and observed readiness/F509 resume; completed bodies0.');
