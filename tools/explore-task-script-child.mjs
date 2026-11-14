import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {inspectRom,cpuToOffset} from './rom.mjs';import {renderAddress} from '../src/render/data.mjs';
import {childBodySpecs,childBodyNativeSources} from '../proof/task/script-body-child-specs.mjs';
import {modalBodySpecs} from '../proof/task/script-body-modal-specs.mjs';import {selectionBodySpecs} from '../proof/task/script-body-selection-specs.mjs';
import {childBodySeedBytes} from './task-script-body-child-seeds.mjs';import {childTextIO,childTextWait} from './task-script-body-child-observations.mjs';
import {runChildFixture,childBodyCases} from './task-script-body-child-fixtures.mjs';import {taskSelectionFixture} from './task-native-selection-roots-fixtures.mjs';
// This explorer owns the original04B/33D family. The fixed individually
// proved child10E parents live separately and use their own complete fixtures.
const exploredSpecs=childBodySpecs.filter(s=>[0x4B,0x33D].includes(s.childId)&&!s.recordPropertyChild&&!s.parentWaitChild);
const saveSpecs=()=>writeFile('proof/task/script-body-child-specs.mjs',"// Own original parent/child source pins.\nimport {childInputBodySpecs} from './script-body-child-input-specs.mjs';\nimport {childMenuBodySpecs} from './script-body-child-menu-specs.mjs';\nimport {childCountdownBodySpecs} from './script-body-child-countdown-specs.mjs';\nimport {childPropertyBodySpecs} from './script-body-child-property-specs.mjs';\nimport {childParentWaitBodySpecs} from './script-body-child-parent-wait-specs.mjs';\nimport {childParentAliasBodySpecs} from './script-body-child-parent-alias-specs.mjs';\nimport {childParentAddBodySpecs} from './script-body-child-parent-add-specs.mjs';\nexport const childBodySpecs=[..."+JSON.stringify(exploredSpecs,null,2)+',...childInputBodySpecs,...childMenuBodySpecs,...childCountdownBodySpecs,...childPropertyBodySpecs,...childParentWaitBodySpecs,...childParentAliasBodySpecs,...childParentAddBodySpecs].sort((a,b)=>a.id-b.id);\nexport const childBodyNativeSources='+JSON.stringify(childBodyNativeSources,null,2)+';\n');
const saveSeeds=()=>writeFile('tools/task-script-body-child-seeds.mjs','// Explicit synthetic field bytes, never original initialized callers.\nexport const childBodySeedBytes='+JSON.stringify(childBodySeedBytes,null,2)+';\n');
const saveObservations=()=>writeFile('tools/task-script-body-child-observations.mjs','// Independently declared arithmetic/wait samples. Only their reached original PC/address/width shapes come from source.\nexport const childTextIO='+JSON.stringify(childTextIO,null,2)+';\nexport const childTextWait='+JSON.stringify(childTextWait,null,2)+';\n');
if(!process.argv.includes('--worker')){
 for(const s of exploredSpecs)s.romReads=[...new Map([...modalBodySpecs,...selectionBodySpecs,s].flatMap(s=>s.romReads).map(r=>[r.address,r])).values()].sort((a,b)=>a.address-b.address);
 for(const s of exploredSpecs)for(const v of childBodyCases(s)){childTextIO[s.id+':'+v.name]??=[];childTextWait[s.id+':'+v.name]??=[];}await saveSpecs();await saveObservations();
 let from=0;for(let n=0;n<2000;n++){const output=execFileSync(process.execPath,[process.argv[1],'--worker',String(from)],{encoding:'utf8',windowsHide:true});process.stdout.write(output);
  if(output.includes('Complete child exploration')){for(const flags of [['--prune'],[]]){const verified=execFileSync(process.execPath,[process.argv[1],'--worker','0',...flags],{encoding:'utf8',windowsHide:true});process.stdout.write(verified);if(!verified.includes('Complete child exploration'))throw Error('Incomplete final child paths');}process.exit(0);}
  const next=output.match(/Resume case (\d+)/);if(!next)throw Error('Missing child checkpoint');from=Number(next[1]);}throw Error('Child exploration bound exceeded');
}
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));for(const s of childBodySpecs)for(const r of s.romReads)if(bytes.readUInt16LE(cpuToOffset(r.address,bytes.length))!==r.value)throw Error('Child provisional ROM drift');
const ioValues=new Map(taskSelectionFixture(0x9A).ioObservations.map(o=>[o.pc,[o.address,o.width,o.value]]));
for(const [pc,shape]of [[0x81ADDD,[0x804216,2,0]],[0x81AE39,[0x804216,2,0]],[0x81AE73,[0x804214,1,0]],[0x81AE7D,[0x804214,1,1]],[0x81AE94,[0x804216,2,0]]])ioValues.set(pc,shape);
const waitValues=new Map([[0x81ACBD,[0x8001F6]],[0x81ACAF,[0x8001F8]],[0x81ACC3,[0x8001FA,0x7E01FA]],[0x81ACC9,[0x8001FC,0x7E01FC,...Array.from({length:8},(_,n)=>0x7E2AE0+2*n)]]]);
const reached=new Map(exploredSpecs.map(s=>[s.id,new Set()])),fields=new Map(exploredSpecs.map(s=>[s.id,new Set()])),cases=exploredSpecs.flatMap(s=>childBodyCases(s).map(v=>({s,v})));let paths=0;
for(let caseIndex=Number(process.argv[3]??0);caseIndex<cases.length;caseIndex++){const {s,v}=cases[caseIndex],key=s.id+':'+v.name,run=runChildFixture(s,v,{reportBoundary:true}),p=run.boundary??run.plan;
 if(!p.handled){const owner=Number.isInteger(p.address)?renderAddress(p.address):null;
  if(['task_script_body_ROM_read_required','render_source_required'].includes(p.reason)&&owner>=0x800000){
   if(s.romReads.some(r=>r.address===p.address))throw Error('Repeated child ROM '+JSON.stringify(p));
   s.romReads.push({address:p.address,value:bytes.readUInt16LE(cpuToOffset(p.address,bytes.length))});s.romReads.sort((a,b)=>a.address-b.address);await saveSpecs();console.log('OriginalROM',p.address.toString(16));
  }else if(p.reason==='render_source_required'&&owner>=0x7E0000&&owner<=0x7FFFFF){
   const seeds=childBodySeedBytes[s.id]??=[],present=new Set(run.fixture.data.snapshot().bytes.map(([a])=>a));
   if(seeds.some(([a])=>a===owner))throw Error('Repeated child field '+JSON.stringify(p));
   for(let a=owner&~255;a<(owner&~255)+256;a++)if(!present.has(a)&&!seeds.some(([b])=>a===b))seeds.push([a,0]);seeds.sort((a,b)=>a[0]-b[0]);await saveSeeds();console.log('Declared synthetic field',owner.toString(16));
  }else if(p.reason==='task_io_observation_required'&&run.segments.length===0){
   const sample=ioValues.get(p.pc),records=childTextIO[key];if(!sample||sample[0]!==p.address||sample[1]!==p.width||p.observationIndex!==records.length)throw Error('Unproved child IO '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:p.width,value:sample[2]});await saveObservations();console.log('Declared independent IO shape',v.name,p.pc.toString(16));
  }else if(p.reason==='task_wait_observation_required'&&run.segments.length===0){
   const records=childTextWait[key];if(!waitValues.get(p.pc)?.includes(p.address)||p.width!==2||records.length>256)throw Error('Unproved child wait '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:2,value:(p.address&0xFFFF)>=0x2AE0?0xAAAA:0});await saveObservations();console.log('Declared independent wait shape',v.name,p.pc.toString(16));
  }else throw Error(`Child ${v.name} segment${run.segments.length}: ${JSON.stringify(p)}`);
  console.log('Resume case',caseIndex);process.exit(0);
 }
 for(const segment of run.segments)for(const a of segment.accesses)if(a.kind==='read'){fields.get(s.id).add(renderAddress(a.address));if(!a.label.startsWith('original-body-ROM-table')&&(a.label.endsWith('-low')||['text-root-BYTE','d2-indirect-BYTE','script-header-BYTE','script-header-indexed-BYTE'].includes(a.label)))reached.get(s.id).add(a.address);}
 paths++;console.log('Whole',s.id.toString(16),v.name,p.resultWord,'segments',run.segments.length,'childHeapResult',p.childCompletion??null);
}
if(process.argv.includes('--prune')){for(const s of exploredSpecs){s.romReads=s.romReads.filter(r=>reached.get(s.id).has(r.address));childBodySeedBytes[s.id]=(childBodySeedBytes[s.id]??[]).filter(([a])=>fields.get(s.id).has(a));}await saveSeeds();await saveSpecs();}
console.log('Complete child exploration',paths,'ROM WORDs',exploredSpecs.map(s=>[s.id,s.romReads.length]));
