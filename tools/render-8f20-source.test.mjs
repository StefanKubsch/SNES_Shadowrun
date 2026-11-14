import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-8f20.json', import.meta.url), 'utf8'));
// Independent literal ROM pins; no CPU execution. Memory algebra below uses
// synthetic bytes only, never original936C output/initialization evidence.
const windows = [
  ['rows8F20',0x808F20,0x808F3A,13,'e2df2188db31cbb2931ada6bf6233fd339ff065d9ba74c28f861715774f3e250'],
  ['selectedDialogFirstRows',0x80943F,0x809456,9,'d436e2aa03b6e38ef95a7d5d6f9916f13c6977f87030b32eff267c416993cc97'],
  ['selectedDialogSecondRows',0x809465,0x809479,8,'64866e16adc95bd92fb1df71a179b77979bea530da356dedc6d3c518a952c81d'],
];
const all = new Map(), graph = new Map();
for (const [name,start,end] of windows) for (let pc=start;pc<end;) {
  const i=decode(rom,pc,{e:0,m:0,x:0}); assert.ok(i.next<=end); all.set(pc,i);
  if(name==='rows8F20')graph.set(pc,i);pc=i.next;
}
const at=(pc,op,value,mode)=>{
  const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));
  if(mode!==undefined)assert.equal(i.mode,mode,cpuLabel(pc));return i;
};
const proof=map=>proveWordStack(map,0x808F20,'RTS',{measureStack:true});

test('8F20 pins26/13 complete root and43/17 selectedcaller bytes independently',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);
  const supplied=[...report.windows,...report.callers.windows];assert.equal(supplied.length,3);
  for(const[name,start,end,count,hash]of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal([...all.values()].filter(i=>i.cpu>=start&&i.cpu<end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,26);assert.equal(report.full_graph.instructions,13);
  for(const i of graph.values())assert.deepEqual(i.state,{e:0,m:0,x:0});
});

test('8F20 overwrites all incomingregisters, saves onlyDBR and uses exactWORD count/pointer constants',()=>{
  at(0x808F20,'PHB');at(0x808F21,'LDX',0x5A4F,'immX');at(0x808F24,'LDY',0x624F,'immX');
  at(0x808F27,'TYA');at(0x808F28,'SEC');at(0x808F29,'SBC',0x100,'immM');at(0x808F2C,'TAY');
  at(0x808F2D,'LDA',255,'immM');
  const move=at(0x808F30,'MVP');assert.deepEqual([...move.raw],[0x44,0x7F,0x7F]);
  assert.ok(![...graph.values()].some(i=>['PHP','PLP','JSR','JSL','LDA'].includes(i.mnemonic)&&i.mode!=='immM'));
  assert.match(report.contract.entry,/Incoming A\/X\/Y are overwritten before use/);
});

test('8F20 boundedloop proof has first equality at7,1792 bytes and exact finalindices without wrap',()=>{
  at(0x808F33,'CPX',0x534F,'immX');at(0x808F36,'BNE',0x808F27);at(0x808F38,'PLB');at(0x808F39,'RTS');
  for(let n=1;n<=7;n++){
    const x=0x5A4F-n*256,y=0x624F-n*512;
    assert.equal(x===0x534F,n===7);assert.ok(x>=0&&y>=0);
    assert.equal(y-x,(8-n)*256);
  }
  assert.equal(7*256,1792);assert.equal(0x624F-7*512,0x544F);
  assert.equal(report.full_graph.actual_termination_proven,true);
  assert.deepEqual(report.full_graph.calls,[]);
  assert.deepEqual(report.local.edges,[{from:'80:8F36',kind:'BNE',to:'80:8F27'}]);
});

test('8F20 exact seven descendingrows cover1792 unique sources and scattered destinations',()=>{
  const expected=[
    [0x5A4F,0x5950,0x614F,0x6050],[0x594F,0x5850,0x5F4F,0x5E50],
    [0x584F,0x5750,0x5D4F,0x5C50],[0x574F,0x5650,0x5B4F,0x5A50],
    [0x564F,0x5550,0x594F,0x5850],[0x554F,0x5450,0x574F,0x5650],
    [0x544F,0x5350,0x554F,0x5450],
  ];
  assert.deepEqual(report.local.copy.rows,expected.map(([s0,s1,d0,d1],n)=>({pass:n+1,bytes:256,
    source_first:cpuLabel(0x7F0000+s0),source_last:cpuLabel(0x7F0000+s1),
    destination_first:cpuLabel(0x7F0000+d0),destination_last:cpuLabel(0x7F0000+d1)})));
  const sources=new Set(),destinations=new Set();
  for(const[s0,s1,d0,d1]of expected){assert.equal(s0-s1,255);assert.equal(d0-d1,255);
    for(let k=0;k<256;k++){assert.ok(!sources.has(s0-k));sources.add(s0-k);assert.ok(!destinations.has(d0-k));destinations.add(d0-k);}}
  assert.equal(sources.size,1792);assert.equal(destinations.size,1792);
  assert.equal(Math.min(...sources),0x5350);assert.equal(Math.max(...sources),0x5A4F);
  assert.equal(0x614F-0x5450+1-destinations.size,6*256);
  assert.equal(report.local.copy.total_bytes,1792);assert.equal(report.local.copy.destination_gap_bytes,256);
});

test('8F20 synthetic sharedbyte algebra proves descending overlaps preserve all originals and gaps',()=>{
  const initial=Uint8Array.from({length:65536},(_,i)=>((i>>>8)*37+(i&255)*13)&255),actual=initial.slice();
  const destinations=new Set(),readSources=new Set();
  for(let k=0;k<1792;k++){
    const source=0x5A4F-k,row=k>>>8,within=k&255,destination=0x614F-row*512-within;
    // This proves previous writes can never replace a not-yet-read source.
    assert.ok(!destinations.has(source));assert.ok(destination>source);
    const byte=actual[source];readSources.add(source);actual[destination]=byte;destinations.add(destination);
    assert.equal(actual[destination],initial[source]);
    if(destination<=0x5A4F)assert.ok(readSources.has(destination));
  }
  for(let address=0;address<65536;address++)if(!destinations.has(address))assert.equal(actual[address],initial[address]);
  for(let source=0x5350;source<=0x5A4F;source++){
    // Independent increasing source-coordinate formula for the seven rows.
    const row=(source-0x5350)>>>8,within=(source-0x5350)&255;
    assert.equal(actual[0x5450+row*512+within],initial[source]);
  }
  assert.match(report.contract.freshness,/synthetic|overlap/);
});

test('8F20 reverse roworder loses originalsource bytes in synthetic overlap counterexample',()=>{
  const initial=Uint8Array.from({length:65536},(_,i)=>((i>>>8)*37+(i&255)*13)&255),wrong=initial.slice();
  for(let row=6;row>=0;row--)for(let k=0;k<256;k++)wrong[0x614F-row*512-k]=wrong[0x5A4F-row*256-k];
  assert.notEqual(wrong[0x574F],initial[0x554F]);
  assert.match(report.contract.freshness,/Arbitrary ascending\/reversed row order is not equivalent/);
});

test('8F20 C1/V0 precede finalPLB N/Z from all256 actual entryDBRs, no restoredP or Aflags',()=>{
  at(0x808F28,'SEC');at(0x808F29,'SBC',256);at(0x808F33,'CPX',0x534F);at(0x808F38,'PLB');
  for(let n=1;n<=7;n++){
    const before=0x624F-(n-1)*512,after=before-256;
    assert.ok(before>=256);assert.equal(((before^after)&(before^256)&0x8000)!==0,false);
  }
  for(let dbr=0;dbr<256;dbr++)for(const entry of [0,1,2,4,64,128,199]){
    const p=(entry&4)|1|(dbr&128)|(dbr===0?2:0);
    assert.equal(p&65,1);assert.equal(p&128,dbr&128);assert.equal(Boolean(p&2),dbr===0);assert.equal(p&4,entry&4);
  }
  assert.match(report.contract.return,/AFFFF, X534F, Y544F/);assert.match(report.contract.return,/PLB then replaces N\/Z using entryDBR byte/);
  assert.match(report.contract.return,/entryP is not restored/);
});

test('8F20 complete typedstack sourceproof restoresDBR under3 protectedbytes, zero externalreturns',()=>{
  assert.deepEqual(proof(graph),report.full_graph.proof);
  assert.equal(proof(graph).minimum_protected_stack_bytes,3);assert.equal(proof(graph).maximum_local_stack_bytes,1);
  assert.equal(proof(graph).external_return_assumptions,0);assert.equal(proof(graph).reachable_instructions,13);
  assert.deepEqual(proof(graph).returns,[{at:'80:8F39',m:0,x:0,dbr:'entry'}]);
});

test('MVP sharedstatic proof changesDBR to destinationbank independently of restored8F20 PHB/PLB',()=>{
  // Synthetic graph isolates shared proof semantics: different operand banks,
  // no stack save/restore, no buffer/CPU execution claim.
  const move={...graph.get(0x808F30),raw:Buffer.from([0x44,0x12,0x77])};
  const map=new Map([[move.cpu,move],[move.next,{...graph.get(0x808F39),cpu:move.next}]]);
  const result=proveWordStack(map,move.cpu,'RTS',{measureStack:true});
  assert.deepEqual(result.returns,[{at:'80:8F33',m:0,x:0,dbr:0x12}]);
  assert.equal(result.minimum_protected_stack_bytes,2);
});

test('8F20 proof rejects missingloop/source, width, unbalanced stack and wrongroot return mutations',()=>{
  const missing=new Map(graph);missing.delete(0x808F27);assert.throws(()=>proof(missing),/Uncovered edge/);
  const width=new Map(graph);width.set(0x808F29,{...width.get(0x808F29),state:{e:0,m:1,x:0}});assert.throws(()=>proof(width),/Mode mismatch/);
  const stack=new Map(graph);stack.set(0x808F38,{...stack.get(0x808F38),mnemonic:'PLA'});assert.throws(()=>proof(stack),/Stack mismatch/);
  const ret=new Map(graph);ret.set(0x808F39,{...ret.get(0x808F39),mnemonic:'RTL'});assert.throws(()=>proof(ret),/Wrong root return/);
  const edge=new Map(graph);edge.set(0x808F36,{...edge.get(0x808F36),target:0x808F3A});assert.throws(()=>proof(edge),/Uncovered edge/);
});

test('8F20 selected936C caller order agrees withBF3B and9F6D without header/sourcecoverage inference',async()=>{
  for(const[a,b,c]of [[0x80944D,0x809450,0x809453],[0x809470,0x809473,0x809476]]){
    at(a,'JSR',0x809F6D);at(b,'JSR',0x808F20);at(c,'JSR',c===0x809453?0x809022:0x80905E);
  }
  const parent=JSON.parse(await readFile(new URL('../analysis/render-bf3b.json',import.meta.url)));
  const unpack=JSON.parse(await readFile(new URL('../analysis/render-9f6d.json',import.meta.url)));
  const owner=parent.windows.find(w=>w.name==='dialog936C');
  for(let n=0;n<2;n++){
    const w=report.callers.windows[n],offset=(parseInt(w.entry.replace(':',''),16)-0x80936C)*2;
    assert.equal(owner.machine_bytes.slice(offset,offset+w.covered_bytes*2),w.machine_bytes);
    assert.equal(unpack.callers.windows[n].machine_bytes,w.machine_bytes);
  }
  assert.ok(report.callers.scan.raw_jsr_candidates.includes('80:9450'));assert.ok(report.callers.scan.raw_jsr_candidates.includes('80:9473'));
  assert.match(report.callers.scan.qualification,/No indirect\/reachability\/allcallsite proof/);
  assert.match(report.contract.ownership,/neither selectedcaller nor fixed8F20 count proves all1792 sources exist/);
});

test('8F20 source and native prerequisite supplied toBF3B, original caller lifecycle staysopen',async()=>{
  const parent=JSON.parse(await readFile(new URL('../analysis/render-bf3b.json',import.meta.url)));
  assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:8F20'));
  const supplied=parent.full_graph.supplied_source_nested_callees.find(c=>c.entry==='80:8F20');
  assert.equal(supplied.code_bytes,26);assert.equal(supplied.instructions,13);assert.equal(supplied.minimum_protected_stack_bytes,3);
  assert.equal(supplied.native_binding,true);assert.equal(report.full_graph.native_binding,true);
  assert.equal(report.native_prerequisite.module,'proof/render/rows-8f20.mjs');
  assert.equal(report.native_prerequisite.minimum_protected_stack_bytes,3);
  assert.equal(parent.full_graph.closed,false);assert.equal(parent.full_graph.native_binding,false);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
