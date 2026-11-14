import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {inspectRom,cpuToOffset} from './rom.mjs';import {renderAddress} from '../src/render/data.mjs';
import {childCountdownBodySpecs as specs} from '../proof/task/script-body-child-countdown-specs.mjs';
import {runChildFixture,childBodyCases} from './task-script-body-child-fixtures.mjs';
import {countdownParentIO,countdownParentWait} from './task-script-body-child-countdown-observations.mjs';
import {countdownTextKey} from './task-script-child-countdown-parent-paths.mjs';
const saveObservations=()=>writeFile('tools/task-script-body-child-countdown-observations.mjs','// Independently declared synthetic samples; original PC/address/width is source-bounded, values do not simulate devices, readiness, time or frames.\nexport const countdownParentIO='+JSON.stringify(countdownParentIO,null,2)+';\nexport const countdownParentWait='+JSON.stringify(countdownParentWait,null,2)+';\n');
const save=()=>writeFile('proof/task/script-body-child-countdown-specs.mjs','// Own original argument parents of allocated Child6F/0D2; full source/native ownership required.\nexport const childCountdownBodySpecs='+JSON.stringify(specs,null,2)+';\n');
if(!process.argv.includes('--worker')){
 let from=0;for(let n=0;n<3000;n++){
  const output=execFileSync(process.execPath,[process.argv[1],'--worker',String(from)],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(output);
  if(output.includes('Complete child countdown exploration')){
   for(const flags of [['--prune'],[]]){const verified=execFileSync(process.execPath,[process.argv[1],'--worker','0',...flags],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(verified);if(!verified.includes('Complete child countdown exploration'))throw Error('Incomplete final countdown paths');}
   process.exit(0);
  }
  const next=output.match(/Resume case (\d+)/);if(!next)throw Error('Missing child countdown checkpoint');from=Number(next[1]);
 }throw Error('Child countdown exploration bound exceeded');
}
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
const ioShapes=new Map([[0x81ADDD,[0x804216,2,0]],[0x81AE39,[0x804216,2,0]],
 [0x81AE73,[0x804214,1,0]],[0x81AE7D,[0x804214,1,1]],[0x81AE94,[0x804216,2,0]]]);
const waitShapes=new Map([[0x81ACC3,[0x8001FA,0x7E01FA]],[0x81ACC9,[0x8001FC,0x7E01FC,...Array.from({length:8},(_,n)=>0x7E2AE0+2*n)]]]);
for(const s of specs)for(const r of s.romReads)if(bytes.readUInt16LE(cpuToOffset(r.address,bytes.length))!==r.value)throw Error('Countdown parent original ROM drift');
const cases=specs.flatMap(s=>childBodyCases(s).map(v=>({s,v}))),reached=new Map(specs.map(s=>[s.id,new Set()]));let paths=0;
for(let caseIndex=Number(process.argv[3]??0);caseIndex<cases.length;caseIndex++){
 const {s,v}=cases[caseIndex],key=countdownTextKey(s,v),run=runChildFixture(s,v,{reportBoundary:true}),p=run.boundary??run.plan;
 if(!p.handled){const owner=Number.isInteger(p.address)?renderAddress(p.address):null;
  if(['task_script_body_ROM_read_required','render_source_required'].includes(p.reason)&&owner>=0x800000&&run.segments.length===0){
   if(s.romReads.some(r=>r.address===p.address))throw Error('Repeated countdown parent ROM '+JSON.stringify(p));
   s.romReads.push({address:p.address,value:bytes.readUInt16LE(cpuToOffset(p.address,bytes.length))});s.romReads.sort((a,b)=>a.address-b.address);await save();console.log('OriginalROM',p.address.toString(16));
  }else if(p.reason==='task_io_observation_required'&&run.segments.length===0){
   const shape=ioShapes.get(p.pc),records=countdownParentIO[key]??=[];
   if(!shape||shape[0]!==p.address||shape[1]!==p.width||p.observationIndex!==records?.length||records.length>256)throw Error('Unproved countdown IO '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:p.width,value:shape[2]});await saveObservations();console.log('Declared independent IO',p.pc.toString(16));
  }else if(p.reason==='task_wait_observation_required'&&run.segments.length===0){
   const records=countdownParentWait[key]??=[];
   // Each real text wait receives its remaining slice and reports its own
   // local index; no global event index or device value is inferred here.
   if(!waitShapes.get(p.pc)?.includes(p.address)||p.width!==2||!records||records.length>256)throw Error('Unproved countdown wait '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:2,value:(p.address&0xFFFF)>=0x2AE0?0xAAAA:0});await saveObservations();console.log('Declared independent wait',p.pc.toString(16));
  }else throw Error(`Child countdown${s.id.toString(16)}/${v.name} segment${run.segments.length}: ${JSON.stringify(p)}`);
  console.log('Resume case',caseIndex);process.exit(0);
 }
 for(const segment of run.segments)for(const a of segment.accesses)if(a.kind==='read'
  &&!a.label.startsWith('original-body-ROM-table')&&(a.label.endsWith('-low')||['text-root-BYTE','script-header-BYTE','script-header-indexed-BYTE'].includes(a.label)))reached.get(s.id).add(a.address);
 paths++;console.log('Whole child countdown',s.id.toString(16),v.name,p.childCompletion,run.segments.length);
}
if(process.argv.includes('--prune')){for(const s of specs)s.romReads=s.romReads.filter(r=>reached.get(s.id).has(r.address));await save();}
console.log('Complete child countdown exploration',paths,'ParentROM WORDs',specs.map(s=>[s.id,s.romReads.length]));
