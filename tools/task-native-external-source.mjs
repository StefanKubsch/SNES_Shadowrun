import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';
import {decodeTaskWindows,taskRomHash} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {formatBlock} from './disassemble.mjs';

// Own code of a Native58 callee in pinned windows, with every call into a routine proved elsewhere as
// an external return (spec.externalReturns: [target, 'RTS'|'RTL', source]). Spec fields: name, entry,
// id, rootReturn, maximumLocalStackBytes, instructions, returns, windows, externalReturns, scope, contract,
// optional indexPulls (pinned PLA taking a PHX/PHY WORD), widthJoins (REP/SEP reached in both widths) and
// peiWordPushes ([pc, DP offset] of a pinned PEI pushing a DATA word) and pullKinds ([pc, kinds] of a pinned
// PLA taking the bytes of different pushes) and dataPulls (pinned PLX/PLY taking a DATA word pushed by PHA) and indirectTargets ([pc, targets] of a pinned
// JMP (abs,X) whose table entries were read from the ROM).
export function proveExternalSource(map,spec) {
  assertPinnedTaskSource(map,spec.windows);
  const proof=proveWordStack(map,spec.entry,spec.rootReturn,{measureStack:true,externalReturns:new Map(spec.externalReturns.map(([t,op])=>[t,op])),
    indexPulls:new Set(spec.indexPulls??[]),widthJoins:new Set(spec.widthJoins??[]),peiWordPushes:new Map(spec.peiWordPushes??[]),pullKinds:new Map(spec.pullKinds??[]),dataPulls:new Set(spec.dataPulls??[]),indirectTargets:new Map(spec.indirectTargets??[])});
  if(proof.reachable_instructions!==map.size||map.size!==spec.instructions||proof.external_return_assumptions!==spec.externalReturns.length
    ||proof.maximum_local_stack_bytes!==spec.maximumLocalStackBytes||proof.minimum_protected_stack_bytes!==spec.maximumLocalStackBytes+2
    ||proof.returns.map(r=>r.at).sort().join()!==spec.returns.join()||proof.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error(spec.name+' stack/mode drift');
  return {...proof,root_return:spec.rootReturn,native_function_id:spec.id,
    external_return_contracts:spec.externalReturns.map(([t,op,source])=>({target:cpuLabel(t),return:op,source})),
    inner_calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&map.has(i.target)).map(i=>({at:cpuLabel(i.cpu),target:cpuLabel(i.target)})),
    qualification:spec.contract};
}
export async function emitExternalSource(spec) {
  const {bytes,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
  if(metadata.rom_sha256!==taskRomHash)throw Error('Wrong European ROM');
  const {map,blocks,windows}=decodeTaskWindows(bytes,spec.windows);
  for(const w of windows){const literal=spec.windows.find(s=>cpuLabel(s.start)===w.entry);if(w.machine_bytes!==literal.hex)throw Error(spec.name+' source literal drift');}
  const proof=proveExternalSource(map,spec),report={rom_sha256:taskRomHash,progress_reference:'docs/PORTIERUNGSSTAND.json',
    scope:spec.scope,
    windows,proofs:[proof],source_graph:{local_source_complete:true,full_graph_closed:false,classification:'native58-graph-with-external-returns',
      code_bytes:windows.reduce((n,w)=>n+w.covered_bytes,0),instructions:map.size},contract:spec.contract};
  await writeFile(`analysis/render-${spec.name}.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`analysis/render-${spec.name}.asm.txt`,blocks.map(formatBlock).join('\n'));
  console.log(`${spec.name}: ${report.source_graph.code_bytes}/${map.size}, ${proof.external_return_assumptions} external returns, RTS proof.`);
}
