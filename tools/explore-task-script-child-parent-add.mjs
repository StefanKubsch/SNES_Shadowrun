import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {inspectRom,cpuToOffset} from './rom.mjs';import {renderAddress} from '../src/render/data.mjs';
import {childParentAddBodySpecs as specs} from '../proof/task/script-body-child-parent-add-specs.mjs';
import {runChildFixture,childBodyCases} from './task-script-body-child-fixtures.mjs';
const parentAddSelector=(s,v)=>v.text;
import {parentAddTextIO,parentAddTextWait} from './task-script-body-child-parent-add-observations.mjs';
const save=()=>writeFile('proof/task/script-body-child-parent-add-specs.mjs','// Own whole28C original source; actual single event128/count0 parent, eight fresh7B adds and whole allocated4B/text suffix.\nexport const childParentAddBodySpecs='+JSON.stringify(specs,null,2)+';\n');
const saveObservations=()=>writeFile('tools/task-script-body-child-parent-add-observations.mjs','// Independent synthetic samples at original bounded text PCs; no device/time/frame inference.\nexport const parentAddTextIO='+JSON.stringify(parentAddTextIO,null,2)+';\nexport const parentAddTextWait='+JSON.stringify(parentAddTextWait,null,2)+';\n');
if(!process.argv.includes('--worker')){let from=0;for(let n=0;n<4000;n++){
 const out=execFileSync(process.execPath,[process.argv[1],'--worker',String(from)],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(out);
 if(out.includes('Complete parentadd exploration')){for(const flags of [['--prune'],[]]){const verified=execFileSync(process.execPath,[process.argv[1],'--worker','0',...flags],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(verified);if(!verified.includes('Complete parentadd exploration'))throw Error('Incomplete final parentadd paths');}process.exit(0);}
 const next=out.match(/Resume case (\d+)/);if(!next)throw Error('Missing parentadd checkpoint');from=Number(next[1]);
 }throw Error('Parentadd exploration bound exceeded');}
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc')),reached=new Map(specs.map(s=>[s.id,new Set()]));
const ioShapes=new Map([[0x80FA01,[0x802134,2,0]],[0x81ADDD,[0x804216,2,0]],[0x81AE39,[0x804216,2,0]],
 [0x81AE73,[0x804214,1,0]],[0x81AE7D,[0x804214,1,1]],[0x81AE94,[0x804216,2,0]]]);
const waitShapes=new Map([[0x81ACBD,[0x8001F6,0x7E01F6]],[0x81ACAF,[0x8001F8,0x7E01F8]],
 [0x81ACC3,[0x8001FA,0x7E01FA]],[0x81ACC9,[0x8001FC,0x7E01FC,...Array.from({length:8},(_,n)=>0x7E2AE0+2*n)]]]);
for(const s of specs)for(const r of s.romReads)if(bytes.readUInt16LE(cpuToOffset(r.address,bytes.length))!==r.value)throw Error('Parentadd original ROM drift');
const cases=specs.flatMap(s=>childBodyCases(s).map(v=>({s,v})));let paths=0;
for(let n=Number(process.argv[3]??0);n<cases.length;n++){const {s,v}=cases[n],selector=parentAddSelector(s,v),run=runChildFixture(s,v,{reportBoundary:true}),p=run.boundary??run.plan;
 if(!p.handled){const owner=Number.isInteger(p.address)?renderAddress(p.address):null;
  if(['task_script_body_ROM_read_required','render_source_required'].includes(p.reason)&&owner>=0x800000){
   if(s.romReads.some(r=>r.address===p.address))throw Error('Repeated parentadd ROM '+JSON.stringify(p));
   s.romReads.push({address:p.address,value:bytes.readUInt16LE(cpuToOffset(p.address,bytes.length))});s.romReads.sort((a,b)=>a.address-b.address);await save();console.log('OriginalROM',p.address.toString(16));
  }else if(p.reason==='task_io_observation_required'){
   const shape=ioShapes.get(p.pc),records=parentAddTextIO[selector]??=[];
   if(!shape||shape[0]!==p.address||shape[1]!==p.width||p.observationIndex!==records.length||records.length>256)throw Error('Unproved parentadd IO '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:p.width,value:shape[2]});await saveObservations();
  }else if(p.reason==='task_wait_observation_required'){
   const records=parentAddTextWait[selector]??=[];
   if(!waitShapes.get(p.pc)?.includes(p.address)||p.width!==2||records.length>256)throw Error('Unproved parentadd wait '+JSON.stringify(p));
   records.push({pc:p.pc,address:p.address,width:2,value:(p.address&0xFFFF)>=0x2AE0?0xAAAA:0});await saveObservations();
  }else throw Error(`Parentadd${s.id.toString(16)}/${v.name} segment${run.segments.length}: ${JSON.stringify(p)}`);
  console.log('Resume case',n);process.exit(0);
 }
 for(const segment of run.segments.filter(p=>p.scriptId===s.id))for(const a of segment.accesses)if(a.kind==='read'
  &&!a.label.startsWith('original-body-ROM-table')&&(a.label.endsWith('-low')||['text-root-BYTE','d2-indirect-BYTE','script-header-BYTE','script-header-indexed-BYTE'].includes(a.label)))reached.get(s.id).add(a.address);
 paths++;console.log('Whole parentadd',s.id.toString(16),v.name,p.resultWord,run.segments.length);
}
if(process.argv.includes('--prune')){for(const s of specs)s.romReads=s.romReads.filter(r=>reached.get(s.id).has(r.address));await save();}
console.log('Complete parentadd exploration',paths,'ParentROM WORDs',specs.map(s=>[s.id,s.romReads.length]));
