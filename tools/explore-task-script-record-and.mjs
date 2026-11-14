import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {inspectRom,cpuToOffset} from './rom.mjs';import {renderAddress} from '../src/render/data.mjs';
import {recordAndBodySpecs as specs,recordAndNativeSources} from '../proof/task/script-body-record-and-specs.mjs';
import {recordAndCases} from './task-script-body-record-and-fixtures.mjs';import {runWaitBodyFixture} from './task-script-body-wait-fixtures.mjs';
const save=()=>writeFile('proof/task/script-body-record-and-specs.mjs','// Own whole1A5 original source: freshBB flags/74/0D/4B BYTE mask, audio/actual count60 readiness/5B/END.\nexport const recordAndBodySpecs='+JSON.stringify(specs,null,2)+';\nexport const recordAndNativeSources='+JSON.stringify(recordAndNativeSources,null,2)+';\n');
if(!process.argv.includes('--worker')){let from=0;for(let n=0;n<1000;n++){
 const out=execFileSync(process.execPath,[process.argv[1],'--worker',String(from)],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(out);
 if(out.includes('Complete recordand exploration')){for(const flags of [['--prune'],[]]){const verified=execFileSync(process.execPath,[process.argv[1],'--worker','0',...flags],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});process.stdout.write(verified);if(!verified.includes('Complete recordand exploration'))throw Error('Incomplete final recordand paths');}process.exit(0);}
 const next=out.match(/Resume case (\d+)/);if(!next)throw Error('Missing recordand checkpoint');from=Number(next[1]);
 }throw Error('Recordand exploration bound exceeded');}
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc')),reached=new Map(specs.map(s=>[s.id,new Set()]));
const cases=specs.flatMap(s=>recordAndCases().map(v=>({s,v})));let paths=0;
for(let n=Number(process.argv[3]??0);n<cases.length;n++){const {s,v}=cases[n],run=runWaitBodyFixture(s,v,{reportBoundary:true}),p=run.boundary??run.plan;
 if(!p.handled){const owner=Number.isInteger(p.address)?renderAddress(p.address):null;
  if(['task_script_body_ROM_read_required','render_source_required'].includes(p.reason)&&owner>=0x800000){
   if(s.romReads.some(r=>r.address===p.address))throw Error('Repeated recordand ROM '+JSON.stringify(p));
   s.romReads.push({address:p.address,value:bytes.readUInt16LE(cpuToOffset(p.address,bytes.length))});s.romReads.sort((a,b)=>a.address-b.address);await save();console.log('OriginalROM',p.address.toString(16));
  }else throw Error(`Recordand${s.id.toString(16)}/${v.name} segment${run.segments.length}: ${JSON.stringify(p)}`);
  console.log('Resume case',n);process.exit(0);
 }
 for(const segment of run.segments)for(const a of segment.accesses)if(a.kind==='read'&&!a.label.startsWith('original-body-ROM-table')
  &&(a.label.endsWith('-low')||['text-root-BYTE','d2-indirect-BYTE','script-header-BYTE','script-header-indexed-BYTE'].includes(a.label)))reached.get(s.id).add(a.address);
 paths++;console.log('Whole recordand',s.id.toString(16),v.name,p.resultWord,run.segments.length);
}
if(process.argv.includes('--prune')){for(const s of specs)s.romReads=s.romReads.filter(r=>reached.get(s.id).has(r.address));await save();}
console.log('Complete recordand exploration',paths,'ROM WORDs',specs.map(s=>[s.id,s.romReads.length]));
