import {emitTaskPartialSource} from './task-partial-source.mjs';import {spec,prove,entries} from './render-task-remainder-signed-source-proof.mjs';
import {arithmeticOwners} from './task-arithmetic-source.mjs';
import {readFile,writeFile} from 'node:fs/promises';import {inspectRom,cpuToOffset,cpuLabel} from './rom.mjs';
const report=await emitTaskPartialSource(spec,prove,[]);
report.synthetic_examples=report.proofs.map(p=>arithmeticOwners(p,{s:65535,d:65535,bank:128,y:4,pointerAfter:0x1200}));
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));report.dispatch_entries=entries.map(([opcode,entry])=>{const pc=0x80F2B4+opcode,off=cpuToOffset(pc,bytes.length),raw=bytes.subarray(off,off+2);if(raw.readUInt16LE()!==entry%65536)throw Error('Signed remainder dispatch drift');return {opcode,word_source:cpuLabel(pc),target:cpuLabel(entry),machine_bytes:raw.toString('hex').toUpperCase()};});
await writeFile('analysis/render-task-remainder-signed.json',JSON.stringify(report,null,2)+'\n');
