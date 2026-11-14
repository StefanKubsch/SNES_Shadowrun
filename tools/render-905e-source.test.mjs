import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-905e.json', import.meta.url), 'utf8'));
// Independent source windows and incoming widths. Arithmetic/byte examples
// below are static consequences or synthetic fixtures, not CPU/wait execution.
const windows = [
  ['fields905E',0x80905E,0x80908C,16,'14799593294dc957841fa1d1d40d8486be8aa914b113b79edd9d01901ae6ce16'],
  ['setupWait8FF5',0x808FF5,0x809022,18,'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54'],
  ['gateIncrementA954',0x81A954,0x81A958,2,'8dae4a16e8b1334cc47a0b132b15f9d2c934f3732b2d9d26199c3d78d597b0a2'],
  ['selectedDialogFields905E',0x809470,0x80947C,4,'d73eb63cdbcf42ff3d57290ba265a24d86a8085dc381025a85a6fd4838ab045e'],
];
const all = new Map(), graph = new Map();
for (const [name,start,end] of windows) for (let pc=start;pc<end;) {
  const i=decode(rom,pc,{e:0,m:Number(pc>=0x809003&&pc<0x809019),x:0});
  assert.ok(i.next<=end); all.set(pc,i);
  if(name!=='selectedDialogFields905E')graph.set(pc,i);pc=i.next;
}
const at=(pc,op,value,mode)=>{
  const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));
  if(mode!==undefined)assert.equal(i.mode,mode,cpuLabel(pc));return i;
};
const proof=map=>proveWordStack(map,0x80905E,'RTS',{measureStack:true});

test('905E pins46/16 root,45/18 wait,4/2 increment and12/4 caller with independent hashes/modes',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);const supplied=[...report.windows,report.caller.window];assert.equal(supplied.length,4);
  for(const[name,start,end,count,hash]of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal([...all.keys()].filter(pc=>pc>=start&&pc<end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,95);assert.equal(report.full_graph.instructions,36);
});

test('905E prefix publishes fullWORD00A1 and X0800 through real8FF5 before any fieldwrite',()=>{
  at(0x80905E,'LDA',0xA1,'immM');at(0x809061,'STA',0x142,'abs');at(0x809064,'LDX',0x800,'immX');at(0x809067,'JSR',0x808FF5);
  at(0x809019,'STX',0x140,'abs');assert.equal(all.get(0x809019).state.x,0);
  assert.deepEqual(report.full_graph.calls,[{from:'80:9067',to:'80:8FF5',kind:'JSR'},{from:'80:9087',to:'81:A954',kind:'JSL'}]);
  assert.match(report.contract.prefix,/Both metadata bytes written/);assert.match(report.contract.entry,/Incoming A\/X overwritten before use; Y preserved/);
  assert.deepEqual([0xA1&255,0xA1>>>8],[0xA1,0]);assert.deepEqual([0x800&255,0x800>>>8],[0,8]);
});

test('905E actual8FF5 six stores retain WORD/BYTE order; no420B or transferbuffer/DP read',()=>{
  assert.deepEqual([...graph.values()].filter(i=>i.cpu>=0x808FF5&&i.cpu<0x809019&&i.mnemonic==='STA')
    .map(i=>[i.value,i.state.m?1:2]),[[0x4305,2],[0x4302,2],[0x4304,1],[0x4301,1],[0x2115,1],[0x4300,1,]]);
  for(const[pc,value]of [[0x808FF5,0x1000],[0x808FFB,0x5250],[0x809003,0x7F],[0x809008,0x18],[0x80900D,0x80],[0x809012,1]])at(pc,'LDA',value,'immM');
  assert.ok(![...graph.values()].some(i=>i.value===0x420B||i.mode.startsWith('dp')||['dil','dily','MVN','MVP'].includes(i.mode)));
  assert.deepEqual([...graph.values()].filter(i=>i.mnemonic==='LDA'&&!i.mode.startsWith('imm')).map(i=>i.value),[0x1BA,0x140]);
  assert.equal(report.local.bitmap_or_source_copy_bytes,0);
});

test('905E X0800 cannot selfrelease; all65536 freshpoll words obey signedBPL including zero',()=>{
  at(0x809017,'REP',32);at(0x80901C,'LDA',0x140,'abs');at(0x80901F,'BPL',0x80901C);at(0x809021,'RTS');
  for(let value=0;value<65536;value++)assert.equal(!(value&0x8000),value<32768);
  assert.equal(0x800&0x8000,0);
  assert.match(report.contract.helper,/Prior negative0140 overwritten/);assert.match(report.contract.helper,/0800 cannot release its own unchanged wait/);
  assert.equal(report.full_graph.actual_termination_proven,false);assert.match(report.full_graph.qualification,/external writer/);
});

test('905E selector all65536 words isolate bit7 via WORDAND/XBA/LSR yielding3480 or7480 and C0',()=>{
  at(0x809071,'LDA',0x1BA,'abs');at(0x809074,'AND',0x80,'immM');at(0x809077,'XBA');at(0x809078,'LSR',undefined,'A');at(0x809079,'ORA',0x3480,'immM');
  assert.equal(all.get(0x809071).state.m,0);assert.equal(all.get(0x809078).state.m,0);
  for(let value=0;value<65536;value++){
    const masked=value&0x80,swapped=((masked&255)<<8)|(masked>>>8),carry=swapped&1;
    const result=(swapped>>>1)|0x3480;
    assert.equal(result,value&0x80?0x7480:0x3480);assert.equal(carry,0);
    assert.deepEqual([result&255,result>>>8],[0x80,value&0x80?0x74:0x34]);
  }
  assert.deepEqual(report.local.selector,{source:'actualDBR:01BA',width:2,mask:128,clear_value:0x3480,set_value:0x7480,shift_carry:0});
});

test('905E exactlythree WORD fieldstores touchsix bytes, synthetic surrounding7E bytes stayunchanged',()=>{
  at(0x80906A,'LDA',0x1A1A);at(0x80906D,'STA',0x7E3D10,'long');at(0x80907C,'STA',0x7E3D12,'long');
  at(0x809080,'LDA',0x28);at(0x809083,'STA',0x7E3F08,'long');at(0x809087,'JSL',0x81A954);at(0x80908B,'RTS');
  assert.deepEqual([...graph.values()].filter(i=>i.cpu>=0x80905E&&i.cpu<0x80908C&&i.mnemonic==='STA').map(i=>[i.value,i.mode,i.state.m]),
    [[0x142,'abs',0],[0x7E3D10,'long',0],[0x7E3D12,'long',0],[0x7E3F08,'long',0]]);
  const initial=Uint8Array.from({length:65536},(_,n)=>(n*29+(n>>>8)*7)&255),written=new Set([0x3D10,0x3D11,0x3D12,0x3D13,0x3F08,0x3F09]);
  for(const selector of [0,0x80]){
    const result=initial.slice();for(const[a,v]of [[0x3D10,0x1A1A],[0x3D12,selector?0x7480:0x3480],[0x3F08,0x28]]){
      result[a]=v&255;result[a+1]=v>>>8;
    }
    assert.deepEqual([...result.slice(0x3D10,0x3D14)],[0x1A,0x1A,0x80,selector?0x74:0x34]);assert.deepEqual([...result.slice(0x3F08,0x3F0A)],[0x28,0]);
    for(let a=0;a<65536;a++)if(!written.has(a))assert.equal(result[a],initial[a]);
  }
  assert.deepEqual(report.local.field_stores,[['7E:3D10',0x1A1A,2],['7E:3D12',[0x3480,0x7480],2],['7E:3F08',0x28,2]]);
});

test('A954 all65536 WORDincrements include highbytecarry/wrap; finalNZ is memoryresult, A0028 retained',()=>{
  at(0x81A954,'INC',0x1562,'abs');at(0x81A957,'RTL');assert.equal(all.get(0x81A954).state.m,0);
  for(let old=0;old<65536;old++){
    const result=(old+1)&65535,low=((old&255)+1)&255,high=((old>>>8)+Number((old&255)===255))&255;
    assert.equal(result,low|(high<<8));assert.equal(result===0,old===65535);
    assert.equal(Boolean(result&0x8000),old>=0x7FFF&&old<=0xFFFE);
  }
  assert.match(report.contract.increment,/A stays0028/);assert.match(report.contract.return,/FinalN\/Z from INCWORD1562 result, not A0028/);
  assert.equal(report.increment_graph.actual_termination_proven,true);
});

test('905E return C0 and preservedV/I/Y/DBR independent of poll or selector; NZ not entryP',()=>{
  assert.ok(![...graph.values()].some(i=>['CLC','SEC','ADC','SBC','CMP','CPX','CPY','CLV','CLI','SEI','PHP','PLP','PHB','PLB','LDY','TAY'].includes(i.mnemonic)));
  for(let p=0;p<256;p++)if(!(p&0x38))for(const old of [0,0x7FFE,0x7FFF,0xFFFE,0xFFFF]){
    const result=(old+1)&65535,final=(p&~0x83)|(result&0x8000?0x80:0)|(result===0?2:0);
    assert.equal(final&1,0);assert.equal(final&0x44,p&0x44);
    assert.equal(Boolean(final&2),old===0xFFFF);assert.equal(Boolean(final&0x80),old>=0x7FFF&&old<=0xFFFE);
  }
  assert.match(report.contract.return,/A0028\/X0800/);assert.match(report.contract.return,/C0 from WORDLSR/);
});

test('905E closed36-instruction graph protects5 bytes; A954 standalone3; no externalreturn assumption',()=>{
  assert.deepEqual(proof(graph),report.full_graph.proof);assert.equal(proof(graph).minimum_protected_stack_bytes,5);
  assert.equal(proof(graph).maximum_local_stack_bytes,3);assert.equal(proof(graph).reachable_instructions,36);assert.equal(proof(graph).external_return_assumptions,0);
  assert.deepEqual(proof(graph).returns,[{at:'80:908B',m:0,x:0,dbr:'entry'}]);
  const inc=new Map([...graph].filter(([pc])=>pc>=0x81A954));
  assert.deepEqual(proveWordStack(inc,0x81A954,'RTL',{measureStack:true}),report.increment_graph.proof);
  assert.equal(report.increment_graph.proof.minimum_protected_stack_bytes,3);
});

test('905E proof rejects missingcallees, changedpoll edge, wrong widths, stack and RTS/RTL mismatches',()=>{
  for(const pc of [0x808FF5,0x81A954,0x80901C]){const missing=new Map(graph);missing.delete(pc);assert.throws(()=>proof(missing),/Uncovered edge/);}
  for(const[pc,change,pattern]of [[0x809071,{state:{e:0,m:1,x:0}},/Mode mismatch/],
    [0x81A954,{state:{e:0,m:1,x:0}},/Mode mismatch/],[0x809064,{state:{e:0,m:0,x:1}},/Mode mismatch/],
    [0x80905E,{mnemonic:'PHP'},/Stack mismatch/],[0x809021,{mnemonic:'RTL'},/Wrong call return/],
    [0x81A957,{mnemonic:'RTS'},/Wrong call return/],[0x80908B,{mnemonic:'RTL'},/Wrong root return/],
    [0x80901F,{target:0x80908C},/Uncovered edge/]]){
    const mutant=new Map(graph);mutant.set(pc,{...graph.get(pc),...change});assert.throws(()=>proof(mutant),pattern);
  }
});

test('905E shared8FF5/A954 source matches existing9022/A98E contracts; othergate consumers not callees',async()=>{
  const parent=JSON.parse(await readFile(new URL('../analysis/render-9022.json',import.meta.url)));
  const gate=JSON.parse(await readFile(new URL('../analysis/render-a98e.json',import.meta.url)));
  assert.deepEqual(report.dependencies[0].window,parent.windows.find(w=>w.name==='setupWait8FF5'));
  assert.deepEqual(report.dependencies[1].window,gate.windows.find(w=>w.name==='gateIncrementA954'));
  assert.equal(report.dependencies[1].window.machine_bytes,'EE62156B');
  assert.match(report.contract.owners,/A98E later clearsWORD1562/);assert.match(report.contract.owners,/not905E callees/);
  assert.match(report.contract.freshness,/7E\/7F setup offsets are actual physical WRAM, not IO requests/);
  assert.equal(report.full_graph.native_binding,true);assert.equal(report.increment_graph.native_binding,true);
  assert.equal(report.native_prerequisite.module,'proof/render/gate-a954.mjs');
  assert.equal(report.native_composition.module,'proof/render/fields-905e.mjs');
});

test('905E selected936C caller and updatedBF3B frontier keep originalintegration open; supplied native binding and central progress reference',async()=>{
  at(0x809470,'JSR',0x809F6D);at(0x809473,'JSR',0x808F20);at(0x809476,'JSR',0x80905E);at(0x809479,'JSR',0x808F3A);
  const parent=JSON.parse(await readFile(new URL('../analysis/render-bf3b.json',import.meta.url)));
  const owner=parent.windows.find(w=>w.name==='dialog936C'),offset=(0x9470-0x936C)*2;
  assert.equal(owner.machine_bytes.slice(offset,offset+24),report.caller.window.machine_bytes);
  assert.ok(report.caller.raw_jsr_candidates.includes('80:9476'));assert.match(report.caller.qualification,/no indirect\/reachability\/allcallsite proof/);
  assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:905E'));assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:8F3A'));
  const supplied=parent.full_graph.supplied_source_nested_callees.find(c=>c.entry==='80:905E');
  assert.deepEqual([supplied.code_bytes,supplied.instructions,supplied.minimum_protected_stack_bytes,supplied.native_binding],[95,36,5,true]);
  assert.equal(parent.full_graph.closed,false);assert.equal(parent.full_graph.native_binding,false);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
