import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {inspectRom,cpuToOffset} from './rom.mjs';import {renderAddress} from '../src/render/data.mjs';
import {modalBodySpecs,modalNativeSources} from '../proof/task/script-body-modal-specs.mjs';
import {childMenuBodySpecs as specs} from '../proof/task/script-body-child-menu-specs.mjs';
import {runChildFixture,childBodyCases} from './task-script-body-child-fixtures.mjs';
const child=modalBodySpecs.find(s=>s.id===0xC8);
const saveSpecs=()=>writeFile('proof/task/script-body-modal-specs.mjs','// Whole individually admitted original modal body sources and reached original ROM WORDs.\nexport const modalBodySpecs='+JSON.stringify(modalBodySpecs,null,2)+';\nexport const modalNativeSources='+JSON.stringify(modalNativeSources,null,2)+';\n');
if(!process.argv.includes('--worker')){
 let from=0;for(let n=0;n<3000;n++){
  const output=execFileSync(process.execPath,[process.argv[1],'--worker',String(from)],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(output);
  if(output.includes('Complete child menu exploration')){
   for(const flags of [['--prune'],[]]){const verified=execFileSync(process.execPath,[process.argv[1],'--worker','0',...flags],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(verified);if(!verified.includes('Complete child menu exploration'))throw Error('Incomplete final menu paths');}
   process.exit(0);
  }
  const next=output.match(/Resume case (\d+)/);if(!next)throw Error('Missing child menu checkpoint');from=Number(next[1]);
 }throw Error('Child menu exploration bound exceeded');
}
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const r of child.romReads)if(bytes.readUInt16LE(cpuToOffset(r.address,bytes.length))!==r.value)throw Error('Child menu original ROM drift');
// Preserve every earlier standaloneC8 ROM owner. New caller contexts add
// only actual original-ROM accesses; mutable fields/IO/waits must already
// have independently declared complete fixture observations.
const baseline=new Set(JSON.parse(await readFile('analysis/render-task-script-bodies-modal.json')).proofs.find(p=>p.script_id===0xC8).rom_reads.map(r=>parseInt(r.entry.replace(':',''),16))),
 cases=specs.flatMap(s=>childBodyCases(s).map(v=>({s,v}))),reached=new Set();let paths=0;
for(let caseIndex=Number(process.argv[3]??0);caseIndex<cases.length;caseIndex++){
 const {s,v}=cases[caseIndex],run=runChildFixture(s,v,{reportBoundary:true}),p=run.boundary??run.plan;
 if(!p.handled){const owner=Number.isInteger(p.address)?renderAddress(p.address):null;
  if(['task_script_body_ROM_read_required','render_source_required'].includes(p.reason)&&owner>=0x800000&&run.segments.length===1){
   if(child.romReads.some(r=>r.address===p.address))throw Error('Repeated child menu ROM '+JSON.stringify(p));
   child.romReads.push({address:p.address,value:bytes.readUInt16LE(cpuToOffset(p.address,bytes.length))});child.romReads.sort((a,b)=>a.address-b.address);await saveSpecs();console.log('OriginalROM',p.address.toString(16));
  }else throw Error(`Child menu${s.id.toString(16)}/${v.name} segment${run.segments.length}: ${JSON.stringify(p)}`);
  console.log('Resume case',caseIndex);process.exit(0);
 }
 for(const segment of run.segments)for(const a of segment.accesses)if(a.kind==='read'){
  if(!a.label.startsWith('original-body-ROM-table')&&(a.label.endsWith('-low')||a.label==='text-root-BYTE'))reached.add(a.address);
 }
 paths++;console.log('Whole child menu',s.id.toString(16),v.name,p.childCompletion);
}
if(process.argv.includes('--prune')){
 child.romReads=child.romReads.filter(r=>baseline.has(r.address)||reached.has(r.address));
 await saveSpecs();
}
console.log('Complete child menu exploration',paths,'original ChildROM WORDs',child.romReads.length);
