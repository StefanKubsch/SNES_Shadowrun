import {readFile,writeFile} from 'node:fs/promises';
import {emitTaskPartialSource,decodeTaskWindows} from './task-partial-source.mjs';
import {inspectRom} from './rom.mjs';
import {dispatchSpec,prove} from './render-task-native-dispatch-source-proof.mjs';
import {taskLeafSpecs} from './task-native-leaf-specs.mjs';
import {proveLeafSource} from './task-native-leaf-source.mjs';
import {continuationSpecs} from './task-native-continuation-specs.mjs';
import {proveContinuation} from './task-native-continuation-source.mjs';
const report=await emitTaskPartialSource(dispatchSpec,map=>[prove(map)],[]);
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
report.target_dependencies=taskLeafSpecs.map(s=>({entry:s.entry,source:`analysis/render-task-${s.name}.json`,proof:proveLeafSource(decodeTaskWindows(bytes,s.windows).map,s)}));
report.composition_dependencies=continuationSpecs.map(s=>({source:`analysis/render-task-${s.name}.json`,proofs:proveContinuation(decodeTaskWindows(bytes,s.windows).map,s)}));
report.composition_contract={entry:'80:F4F6',inner_call:'80:F506',inner_return_word:'F508',required_return_target:'80:F509',
 frontier:'80:F390',local_source_complete:true,full_task_binding:false,global_stack_minimum:null,
 stack:'Actual migrated root S+1/S+2 protected; inner JSR high/low writes and actual RTS low/high reads use bank00 and may alias data. Reject any fresh RTS target other than F509.',
 mode:'Bridge establishes D0/DBR80; each selected callee proves E0M0X0/D0/entry DBR preserved and its own local stack/call graph. Full D/DBR/context are freshly reestablished by original F509.',
 aliases:'F52F pointer after JSR, leaf DP/data, restored Task D/DBR/S/ID, both metadata bytes, result/PC/pointer/opcode retain every prior write.',
 boundaries:'Unsupported target/mode/return/physical owner/window/budget rejects whole composition. No inferred original initialization, occurrence, hardware, C1CA/9178/scene/frame or full dynamic task dispatch.'};
await writeFile('analysis/render-task-native-dispatch.json',JSON.stringify(report,null,2)+'\n');
