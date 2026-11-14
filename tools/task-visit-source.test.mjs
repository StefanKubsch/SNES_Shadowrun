import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {proveTaskVisit,visitEntries} from './task-visit-source.mjs';
import {validateManualTaskEvidence} from './progress.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('renew complete original visit/helper/entry windows and source-linked five native entries',async()=>{
 const p=await proveTaskVisit(bytes),r=JSON.parse(await readFile('analysis/render-task-visit.json'));assert.deepEqual(r.proofs,p.proofs);
 assert.deepEqual(p.proofs.map(p=>p.entry),visitEntries);assert.ok(p.proofs.every(p=>p.global_stack_minimum===null&&p.external_return_assumptions===0));
 const progress=JSON.parse(await readFile('docs/PORTIERUNGSSTAND.json')),g=progress.work_groups.find(g=>g.id==='task-visit-c1ca');
 await validateManualTaskEvidence(process.cwd(),g,progress.rom_sha256);
});
test('every byte of fixed visit/readiness/removal/entry windows is independently pinned',async()=>{
 const pins=JSON.parse(await readFile(new URL('./task-visit-windows.json',import.meta.url)));
 for(const w of pins)for(let n=0;n<w.hex.length/2;n++){
  const changed=Buffer.from(bytes);changed[cpuToOffset(w.start,bytes.length)+n]^=1;await assert.rejects(()=>proveTaskVisit(changed));
 }
 for(const address of [0x80F495,0x80F509,0x80F52E]){const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveTaskVisit(changed));}
});
