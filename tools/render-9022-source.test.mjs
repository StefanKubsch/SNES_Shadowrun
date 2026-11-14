import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-9022.json', import.meta.url), 'utf8'));
// Independently pinned ROM windows/modes. All arithmetic/memory examples
// below are source consequences or synthetic bytes, not CPU/wait execution.
const windows = [
  ['fields9022',0x809022,0x80905E,25,'df603c3d7538b57c99b2a2908d34723961a75005edbe85b77b69c3e3b04c29c1'],
  ['setupWait8FF5',0x808FF5,0x809022,18,'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54'],
  ['selectedDialogFields9022',0x809450,0x809459,3,'7ba324afe510edbf2506072ed446b23fae5397ebd25b7d093345c9c3a20b2576'],
];
const all=new Map(),graph=new Map();
for(const[name,start,end]of windows)for(let pc=start;pc<end;){
  const byte=pc>=0x809030&&pc<0x809041||pc>=0x809003&&pc<0x809019;
  const i=decode(rom,pc,{e:0,m:Number(byte),x:0});assert.ok(i.next<=end);all.set(pc,i);
  if(name!=='selectedDialogFields9022')graph.set(pc,i);pc=i.next;
}
const at=(pc,op,value,mode)=>{
  const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));
  if(mode!==undefined)assert.equal(i.mode,mode,cpuLabel(pc));return i;
};
const proof=map=>proveWordStack(map,0x809022,'RTS',{measureStack:true});

test('9022 pins60/25 root,45/18 solecallee and9/3 selectedcaller with independent WORD/BYTE modes',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);const supplied=[...report.windows,report.caller.window];assert.equal(supplied.length,3);
  for(const[name,start,end,count,hash]of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal([...all.keys()].filter(pc=>pc>=start&&pc<end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,105);assert.equal(report.full_graph.instructions,43);
});

test('9022 fullWORD0142 prefix precedes X0 and sole8FF5 call without inputA/X or byteindex narrowing',()=>{
  at(0x809022,'LDA',0x91,'immM');at(0x809025,'STA',0x142,'abs');at(0x809028,'LDX',0,'immX');at(0x80902B,'JSR',0x808FF5);
  assert.equal(all.get(0x809025).state.m,0);
  assert.deepEqual(report.full_graph.calls,[{from:'80:902B',to:'80:8FF5',kind:'JSR'}]);
  assert.match(report.contract.prefix,/Both0142 bytes written/);assert.match(report.contract.entry,/Incoming A\/X overwritten before use, Y preserved locally/);
});

test('8FF5 exact six setupstores use actualDBR WORD/BYTE widths without420B trigger or CPU sourcebuffer reads',()=>{
  const constants=[[0x808FF5,0x1000],[0x808FFB,0x5250],[0x809003,0x7F],[0x809008,0x18],[0x80900D,0x80],[0x809012,1]];
  for(const[pc,value]of constants)at(pc,'LDA',value,'immM');
  assert.deepEqual([...graph.values()].filter(i=>i.cpu>=0x808FF5&&i.cpu<0x809019&&i.mnemonic==='STA')
    .map(i=>[i.value,i.state.m?1:2]),[[0x4305,2],[0x4302,2],[0x4304,1],[0x4301,1],[0x2115,1],[0x4300,1]]);
  assert.deepEqual(report.local.setup_stores,[[0x4305,0x1000,2],[0x4302,0x5250,2],[0x4304,0x7F,1],[0x4301,0x18,1],[0x2115,0x80,1],[0x4300,1,1]]);
  assert.ok(![...graph.values()].some(i=>i.value===0x420B));
  assert.deepEqual([...graph.values()].filter(i=>i.mnemonic==='LDA'&&!i.mode.startsWith('imm')).map(i=>i.value),[0x140]);
  assert.equal(report.local.bitmap_or_source_copy_bytes,0);assert.match(report.contract.helper,/request metadata only/);
});

test('8FF5 publishes fullX before fresh WORDpoll; all65536 pollwords use signedBPL with no preexistingnegative bypass',()=>{
  at(0x809017,'REP',32);at(0x809019,'STX',0x140,'abs');at(0x80901C,'LDA',0x140,'abs');at(0x80901F,'BPL',0x80901C);at(0x809021,'RTS');
  assert.equal(all.get(0x809019).state.x,0);assert.equal(all.get(0x80901C).state.m,0);
  for(let value=0;value<=65535;value++){
    assert.equal((value&0x8000)===0,value<32768);
    assert.equal((value&255)|((value>>>8)<<8),value);
  }
  assert.equal(0&0x8000,0); // Actual9022 X0 cannot release the same unchanged byte view.
  assert.match(report.contract.wait,/publishes0, which cannot release its own wait without an external writer/);
  assert.equal(report.full_graph.actual_termination_proven,false);assert.equal(report.helper_graph.actual_termination_proven,false);
});

test('9022 BYTEloop retains WORDX and exact128 scatteredF0 stores then XFFFD signedexit',()=>{
  at(0x80902E,'SEP',32);at(0x809030,'LDA',0xF0);at(0x809032,'LDX',0x1FD);
  at(0x809035,'STA',0x7E3D08,'longx');for(const pc of [0x809039,0x80903A,0x80903B,0x80903C])at(pc,'DEX');at(0x80903D,'BPL',0x809035);
  assert.deepEqual(all.get(0x809035).state,{e:0,m:1,x:0});
  const targets=Array.from({length:128},(_,n)=>0x7E3F05-n*4);
  assert.equal(targets.at(-1),0x7E3D09);assert.equal(new Set(targets).size,128);
  for(let n=0;n<128;n++)assert.ok(0x1FD-n*4>=0);
  assert.equal((0x1FD-128*4)&65535,0xFFFD);assert.ok((0xFFFD&0x8000)!==0);
  assert.deepEqual(report.local.byte_loop,{count:128,first:'7E:3F05',last:'7E:3D09',stride:-4,value:240,final_x:65533});
});

test('9022 WORDloop clears only32 exact contiguousbytes via16 descendingstores then XFFFE',()=>{
  at(0x80903F,'REP',32);at(0x809041,'LDX',30);at(0x809044,'LDA',0);at(0x809047,'STA',0x7E3F08,'longx');
  at(0x80904B,'DEX');at(0x80904C,'DEX');at(0x80904D,'BPL',0x809047);
  assert.deepEqual(all.get(0x809047).state,{e:0,m:0,x:0});
  const targets=Array.from({length:16},(_,n)=>0x7E3F26-n*2),bytes=new Set(targets.flatMap(a=>[a,a+1]));
  assert.equal(bytes.size,32);assert.equal(Math.min(...bytes),0x7E3F08);assert.equal(Math.max(...bytes),0x7E3F27);
  assert.equal((30-16*2)&65535,0xFFFE);
  assert.deepEqual(report.local.word_loop,{count:16,first:'7E:3F26',last:'7E:3F08',stride:-2,value:0,final_x:65534});
});

test('9022 synthetic tailbyte algebra proves83 highbyte overwrites priorF0 and all untouchedbytes stayoriginal',()=>{
  at(0x80904F,'LDA',0x83A6);at(0x809052,'STA',0x7E3D0C,'long');at(0x809056,'LDA',0x3200);at(0x809059,'STA',0x7E3D0E,'long');
  const initial=Uint8Array.from({length:65536},(_,n)=>(n*13+(n>>>8)*37)&255),result=initial.slice(),written=new Set();
  for(let n=0;n<128;n++){const a=0x3F05-n*4;result[a]=240;written.add(a);}assert.equal(result[0x3D0D],240);
  for(let a=0x3F08;a<=0x3F27;a++){result[a]=0;written.add(a);}
  for(const[a,v]of [[0x3D0C,0xA6],[0x3D0D,0x83],[0x3D0E,0],[0x3D0F,0x32]]){result[a]=v;written.add(a);}
  assert.deepEqual([...result.slice(0x3D0C,0x3D10)],[0xA6,0x83,0,0x32]);assert.equal(written.size,163);
  for(let a=0;a<65536;a++)if(!written.has(a))assert.equal(result[a],initial[a]);
  for(let a=0x3D09;a<=0x3F05;a+=4)assert.equal(result[a],a===0x3D0D?0x83:240);
  assert.match(report.local.qualification,/First BYTE loop3D0D=F0 is later overwritten/);
});

test('9022 finalA3200 overrides negativeX/pollNZ while C/V/I and Y/DBR remain localentryvalues',()=>{
  at(0x809056,'LDA',0x3200,'immM');at(0x809059,'STA',0x7E3D0E);at(0x80905D,'RTS');
  assert.ok(![...graph.values()].some(i=>['CLC','SEC','ADC','SBC','CMP','CPX','CPY','CLV','CLI','SEI','PHP','PLP','PHB','PLB','TYA','TAY','LDY'].includes(i.mnemonic)));
  for(let status=0;status<256;status++)if(!(status&0x38)){
    const final=status&~0x82;assert.equal(final&0xC3,status&0x41);assert.equal(final&4,status&4);
  }
  assert.match(report.contract.return,/A3200\/XFFFE/);assert.match(report.contract.return,/C\/V\/I unchanged from entry/);
  assert.match(report.contract.freshness,/7E\/7F offsets are real memory, not IO requests/);
});

test('9022 complete43 instruction typedgraph has4 protectedbytes; sole8FF5 has2, no externalreturns or completionclaim',()=>{
  assert.deepEqual(proof(graph),report.full_graph.proof);assert.equal(proof(graph).minimum_protected_stack_bytes,4);
  assert.equal(proof(graph).maximum_local_stack_bytes,2);assert.equal(proof(graph).reachable_instructions,43);assert.equal(proof(graph).external_return_assumptions,0);
  assert.deepEqual(proof(graph).returns,[{at:'80:905D',m:0,x:0,dbr:'entry'}]);
  const helper=new Map([...graph].filter(([pc])=>pc<0x809022));
  assert.deepEqual(proveWordStack(helper,0x808FF5,'RTS',{measureStack:true}),report.helper_graph.proof);
  assert.equal(report.helper_graph.proof.minimum_protected_stack_bytes,2);
  assert.equal(report.full_graph.native_binding,true);assert.equal(report.full_graph.actual_termination_proven,false);
});

test('9022 proof rejects missingcallee/branch, BYTE-X, wrongAwidth, stack and helper/root return mutations',()=>{
  const missing=new Map(graph);missing.delete(0x808FF5);assert.throws(()=>proof(missing),/Uncovered edge/);
  for(const[pc,change,pattern]of [[0x809035,{state:{e:0,m:1,x:1}},/Mode mismatch/],
    [0x809047,{state:{e:0,m:1,x:0}},/Mode mismatch/],[0x80903F,{value:0},/Mode mismatch/],
    [0x809022,{mnemonic:'PHP'},/Stack mismatch/],[0x809021,{mnemonic:'RTL'},/Wrong call return/],
    [0x80905D,{mnemonic:'RTL'},/Wrong root return/],[0x80901F,{target:0x809060},/Uncovered edge/]]){
    const mutant=new Map(graph);mutant.set(pc,{...graph.get(pc),...change});assert.throws(()=>proof(mutant),pattern);
  }
});

test('9022 8FF5 dependency and separatelypinned8FBA callback/reset owners do not turncallback into actualcallee',async()=>{
  const parent=JSON.parse(await readFile(new URL('../analysis/render-8fba.json',import.meta.url)));
  assert.deepEqual(report.dependencies[0].window,parent.windows.find(w=>w.name==='setupWait8FF5'));
  assert.ok(report.windows[0].machine_bytes.startsWith(report.dependencies[0].selected_root_prefix.machine_bytes));
  for(const w of report.selected_owners.windows){
    assert.deepEqual(w,parent.windows.find(v=>v.name===w.name));
    const start=parseInt(w.entry.replace(':',''),16),end=parseInt(w.end_exclusive.replace(':',''),16);
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(raw.toString('hex').toUpperCase(),w.machine_bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),w.sha256);
  }
  assert.equal(report.selected_owners.windows[0].sha256,'18655de4a121db47dcfeba902f2669aaf96cd7e6278346678cef3845029487fb');
  assert.equal(report.selected_owners.windows[1].machine_bytes,'20BA8F');assert.equal(report.selected_owners.windows[2].machine_bytes,'A9FFFF8D400160');
  assert.match(report.selected_owners.qualification,/not an actual9022 callee/);
  assert.match(report.selected_owners.qualification,/No callback execution, NMI\/RTI chronology/);
});

test('9022 selected936C caller and BF3B sourcefrontier retain originalboundaries; native8FF5/9022 and905E source supplied, supplied native binding and central progress reference',async()=>{
  at(0x809450,'JSR',0x808F20);at(0x809453,'JSR',0x809022);at(0x809456,'LDY',2);
  const parent=JSON.parse(await readFile(new URL('../analysis/render-bf3b.json',import.meta.url)));
  const owner=parent.windows.find(w=>w.name==='dialog936C'),offset=(0x9450-0x936C)*2;
  assert.equal(owner.machine_bytes.slice(offset,offset+18),report.caller.window.machine_bytes);
  assert.ok(report.caller.raw_jsr_candidates.includes('80:9453'));assert.match(report.caller.qualification,/no indirect\/reachability\/allcallsite proof/);
  assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:9022'));assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:905E'));
  assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:8F3A'));
  const supplied=parent.full_graph.supplied_source_nested_callees.find(c=>c.entry==='80:9022');
  assert.deepEqual([supplied.code_bytes,supplied.instructions,supplied.minimum_protected_stack_bytes,supplied.native_binding],[105,43,4,true]);
  assert.equal(parent.full_graph.closed,false);assert.equal(parent.full_graph.native_binding,false);
  assert.equal(report.helper_graph.native_binding,true);assert.equal(report.full_graph.native_binding,true);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
