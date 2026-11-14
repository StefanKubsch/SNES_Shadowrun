import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-9f6d.json', import.meta.url), 'utf8'));
// Literal independently reviewed ROM pins. Algebra below checks source
// consequences, without CPU execution or claiming an initialized dialog.
const windows = [
  ['unpack9F6D',0x809F6D,0x80A033,105,'ba3c4645c5b235948fb048770fe1fd0d77ebcc88128d291f7c7362eac1144d79'],
  ['bit9E65',0x809E65,0x809E7E,15,'c72d7b290430e738bb89d68f8cf33cdeb60367d827d0627a7caba6f4960daad5'],
  ['selectedDialogFirstUnpack',0x80943F,0x809456,9,'d436e2aa03b6e38ef95a7d5d6f9916f13c6977f87030b32eff267c416993cc97'],
  ['selectedDialogSecondUnpack',0x809465,0x809479,8,'64866e16adc95bd92fb1df71a179b77979bea530da356dedc6d3c518a952c81d'],
];
const all = new Map(), graph = new Map();
for (const [name,start,end] of windows) {
  const state={e:0,m:0,x:0};
  for(let pc=start;pc<end;) {
    const i=decode(rom,pc,state); assert.ok(i.next<=end); all.set(pc,i);
    if(name==='unpack9F6D'||name==='bit9E65')graph.set(pc,i);
    if(['SEP','REP'].includes(i.mnemonic)){if(i.value&32)state.m=Number(i.mnemonic==='SEP');if(i.value&16)state.x=Number(i.mnemonic==='SEP');}
    pc=i.next;
  }
}
const at=(pc,op,value,mode)=>{
  const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));
  if(mode!==undefined)assert.equal(i.mode,mode,cpuLabel(pc));return i;
};
const table=rom.subarray(cpuToOffset(0x80A033,rom.length),cpuToOffset(0x80A133,rom.length));

test('9F6D four ROM windows pin198/105 root,25/15 actualcallee and two selectedcallers',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);
  const supplied=[...report.windows,...report.callers.windows];assert.equal(supplied.length,4);
  for(const[name,start,end,count,hash]of windows){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal([...all.values()].filter(i=>i.cpu>=start&&i.cpu<end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,223);assert.equal(report.full_graph.instructions,120);
});

test('9F6D saves full inputA/Y/X, entryP/DBR and switches locally to7F without caller index limit',()=>{
  at(0x809F6D,'PHP');at(0x809F6E,'PHB');at(0x809F6F,'STA',0xE1,'dp');at(0x809F71,'STY',0xE3,'dp');
  at(0x809F73,'STX',0xDD);at(0x809F75,'STX',0xDF);at(0x809F77,'STZ',0xEB);
  at(0x809F79,'PEA',0x7F7F);at(0x809F7C,'PLB');at(0x809F7D,'PLB');
  for(let y=0;y<=65535;y++)assert.equal(((y&255)<<16)|0x1234,((y<<16)|0x1234)&0xFFFFFF);
  assert.match(report.contract.entry,/only its lowbyte E3 is pointerbank/);
  assert.match(report.contract.entry,/No index alignment, header capacity or initialized output assumed/);
});

test('9F6D saves original first header, wraps secondWORD+2 and has no zeroheader exit before literal',()=>{
  at(0x809F7E,'LDY',0);at(0x809F81,'LDA',0xE1,'dily');at(0x809F83,'STA',0xDB);at(0x809F85,'PHA');
  at(0x809F86,'INY');at(0x809F87,'INY');at(0x809F88,'CLC');at(0x809F89,'LDA',0xE1,'dily');
  at(0x809F8B,'ADC',2);at(0x809F8E,'STA',0xE5);at(0x809F90,'LDA',4);at(0x809F93,'STA',0xE7);
  at(0x809F95,'STZ',0xE9);at(0x809F97,'STZ',0xEF);at(0x809F99,'BRA',0x809FA0);
  assert.ok(![...graph.values()].filter(i=>i.cpu>=0x809F6D&&i.cpu<0x809F99).some(i=>i.mode==='rel8'));
  for(let word=0;word<=65535;word++)assert.equal((word+2)&65535,word>=65534?word-65534:word+2);
  assert.match(report.contract.header,/Zero targetDB still decodes\/copies a first literal run/);
});

test('9E65 signed counter reload uses freshpointer/Y, swappedWORD, preservedA and16 highfirst bits',async()=>{
  at(0x809E65,'DEC',0xEF);at(0x809E67,'BPL',0x809E7B);at(0x809E69,'PHA');at(0x809E6A,'LDA',15);
  at(0x809E6D,'STA',0xEF);at(0x809E6F,'LDY',0xE5);at(0x809E71,'LDA',0xE1,'dily');at(0x809E73,'XBA');
  at(0x809E74,'STA',0xF1);at(0x809E76,'INY');at(0x809E77,'INY');at(0x809E78,'STY',0xE5);
  at(0x809E7A,'PLA');at(0x809E7B,'ASL',0xF1);at(0x809E7D,'RTS');
  for(let word=0;word<=65535;word++) {
    const swapped=(word&255)*256+(word>>>8);
    for(let bit=0;bit<16;bit++)assert.equal((swapped>>>(15-bit))&1,bit<8?(word>>>(7-bit))&1:(word>>>(23-bit))&1);
  }
  const parent=JSON.parse(await readFile(new URL('../analysis/render-a9b2.json',import.meta.url)));
  assert.deepEqual(report.dependencies[0].window,report.windows[1]);
  assert.equal(parent.windows.find(w=>w.entry==='80:9E65').machine_bytes,report.windows[1].machine_bytes);
});

test('9F6D actual sixbitcalls allclose at9E65 and gamma loops consume control before databit',()=>{
  const calls=[0x809F9B,0x809FA3,0x809FA8,0x809FFD,0x80A00B,0x80A010];
  for(const pc of calls)at(pc,'JSR',0x809E65);
  assert.deepEqual(report.full_graph.calls,calls.map(pc=>({from:cpuLabel(pc),to:'80:9E65',kind:'JSR'})));
  at(0x809FA0,'LDA',1);at(0x809FA6,'BCS',0x809FAE);at(0x809FAB,'ROL');at(0x809FAC,'BRA',0x809FA3);
  at(0x80A008,'LDA',1);at(0x80A00E,'BCS',0x80A017);at(0x80A013,'ROL');at(0x80A014,'JMP',0x80A00B);
  // Source-derived wrapping ROL can lose its initial leading1 after16 bits.
  let code=1;for(let n=0;n<16;n++)code=(code*2)&65535;assert.equal(code,0);
  assert.match(report.contract.literal_code,/No code-length or nonzero guarantee/);
});

test('9F6D all65536 literal lengths preserve oddcarry across wordcopy and zero still copies1 byte',()=>{
  at(0x809FAE,'LDY',0xE7);at(0x809FB0,'LDX',0xDF);at(0x809FB2,'STA',0xEB);at(0x809FB4,'LSR');
  at(0x809FB5,'STA',0xED);at(0x809FB7,'BEQ',0x809FCA);at(0x809FB9,'PHP');
  at(0x809FBE,'STA',0,'absx');at(0x809FC3,'DEC',0xED);at(0x809FC5,'BNE',0x809FBA);at(0x809FC7,'PLP');
  at(0x809FC8,'BCC',0x809FD5);at(0x809FCA,'SEP',32);at(0x809FCF,'STA',0,'absx');at(0x809FD3,'REP',32);
  assert.equal(all.get(0x809FBE).state.m,0);assert.equal(all.get(0x809FCC).state.m,1);assert.equal(all.get(0x809FCC).state.x,0);
  for(let length=0;length<=65535;length++) {
    const words=length>>>1,tail=words===0?1:length&1;
    assert.equal(words*2+tail,length===0?1:length);
  }
  assert.match(report.contract.literal_code,/EB0 physically copies1 byte while counted0/);
});

test('9F6D literalstores precede fresh wrapping count and unsigned targetcomparison without clamp',()=>{
  at(0x809FD5,'STX',0xDF);at(0x809FD7,'STY',0xE7);at(0x809FD9,'LDA',0xEB);at(0x809FDB,'CLC');
  at(0x809FDC,'ADC',0xE9);at(0x809FDE,'STA',0xE9);at(0x809FE0,'CMP',0xDB);at(0x809FE2,'BCC',0x809FE6);at(0x809FE4,'BRA',0x80A02F);
  for(let count=0;count<=65535;count++)for(const length of [0,1,2,32768,65535]) {
    const total=(count+length)&65535;assert.equal(total>=32768,!(total<32768));
  }
  assert.equal(0x7F0000+0xFFFF+1,0x800000); // literal WORD secondbyte carries; MVN below wraps instead.
  assert.match(report.contract.literal_tail,/unsigned CMP freshDB/);
  assert.match(report.contract.freshness,/literal STA0000,X uses localDBR7F and full effective address carry/);
});

test('9F6D full original256byte table and all65536 counts pin width0..16 and BYTE TAX zeroextension',()=>{
  assert.equal(createHash('sha256').update(table).digest('hex'),'14a5d850c255623f9472e3c650abce0c78d32f0276b315b3a276a0462d97a1ac');
  assert.equal(report.table.machine_bytes,table.toString('hex').toUpperCase());assert.equal(report.table.covered_bytes,256);
  for(let x=0;x<256;x++)assert.equal(table[x],x===0?0:Math.floor(Math.log2(x))+1);
  at(0x809FE6,'SEP',48);at(0x809FE8,'LDA',8);at(0x809FEA,'LDX',0xEA);at(0x809FEC,'BNE',0x809FF2);
  at(0x809FEE,'LDA',0);at(0x809FF0,'LDX',0xE9);at(0x809FF2,'CLC');at(0x809FF3,'ADC',0x80A033,'longx');
  at(0x809FF7,'TAX');at(0x809FF8,'REP',48);assert.deepEqual(all.get(0x809FF7).state,{e:0,m:1,x:1});
  for(let count=0;count<=65535;count++) {
    const high=count>>>8,width=(high?8:0)+table[high||count&255];
    assert.equal(width,count===0?0:Math.floor(Math.log2(count))+1);
  }
});

test('9F6D offsetbit loop is do-loop including65536 width0 iterations and adds freshDD',()=>{
  at(0x809FFA,'LDA',0);at(0x80A000,'ROL');at(0x80A001,'DEX');at(0x80A002,'BNE',0x809FFD);
  at(0x80A004,'CLC');at(0x80A005,'ADC',0xDD);at(0x80A007,'TAX');
  for(let width=0;width<=16;width++) {
    let x=width,n=0;do{x=(x-1)&65535;n++;}while(x!==0);
    assert.equal(n,width||65536);
  }
  for(let base=0;base<=65535;base++)assert.equal((base+65535)&65535,(base-1+65536)&65535);
  assert.match(report.contract.offset,/no backwards-distance subtraction or produced-byte validity check/);
});

test('9F6D repeat INC plus MVN count and SEC ADC retain1..65536 copy and wrappingcounter',()=>{
  at(0x80A017,'INC');at(0x80A018,'STA',0xEB);at(0x80A01A,'LDY',0xDF);
  assert.equal(at(0x80A01C,'MVN').raw.toString('hex'),'547f7f');at(0x80A01F,'STY',0xDF);
  at(0x80A021,'SEC');at(0x80A022,'LDA',0xEB);at(0x80A024,'ADC',0xE9);at(0x80A026,'STA',0xE9);
  at(0x80A028,'CMP',0xDB);at(0x80A02A,'BCS',0x80A02F);at(0x80A02C,'JMP',0x809F9B);at(0x809F9E,'BCS',0x809FE6);
  for(let code=0;code<=65535;code++) {
    const a=(code+1)&65535,physical=a+1;
    assert.equal(physical,code===65535?1:code+2);
    for(const count of [0,1,32767,65535])assert.equal((a+count+1)&65535,(count+physical)&65535);
  }
  assert.equal((0xFFFF+65536)&65535,0xFFFF);
  assert.match(report.local.copy.bytes,/overlap/);assert.match(report.contract.repeat,/EBFFFF copies65536/);
});

test('9F6D ascending MVN overlap reads prior writes and wraps within bank7F',()=>{
  // Independent byte-order consequence of MVN, synthetic memory only.
  const memory=Uint8Array.from({length:65536},(_,i)=>i&255);
  let x=0xFFFF,y=0;for(let n=0;n<4;n++){const byte=memory[x];memory[y]=byte;x=x+1&65535;y=y+1&65535;}
  assert.deepEqual([...memory.slice(0,4)],[255,255,255,255]);assert.equal(x,3);assert.equal(y,4);
  assert.equal(report.local.copy.source_bank,127);assert.equal(report.local.copy.destination_bank,127);
  assert.match(report.contract.repeat,/overlap sees earlier writes/);
  assert.match(report.contract.freshness,/MVN wraps source\/destination indices inside bank7F/);
});

test('9F6D complete120 instruction typed graph has10 protectedstackbytes and restoredDBR/P without termination claim',()=>{
  assert.deepEqual(proveWordStack(graph,0x809F6D,'RTS',{measureStack:true}),report.full_graph.proof);
  assert.deepEqual(report.full_graph.proof.returns,[{at:'80:A032',m:0,x:0,dbr:'entry'}]);
  assert.equal(report.full_graph.proof.minimum_protected_stack_bytes,10);assert.equal(report.full_graph.proof.maximum_local_stack_bytes,8);
  assert.equal(report.full_graph.proof.external_return_assumptions,0);
  at(0x80A02F,'PLA');at(0x80A030,'PLB');at(0x80A031,'PLP');at(0x80A032,'RTS');
  assert.equal(report.full_graph.actual_termination_proven,false);assert.equal(report.full_graph.native_binding,true);
  assert.equal(report.native_prerequisite.module,'proof/render/unpack-9f6d.mjs');
  assert.equal(report.native_prerequisite.minimum_protected_stack_bytes,10);
  assert.match(report.contract.return,/complete entryP/);assert.match(report.contract.return,/actual final literal\/copy results/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});

test('9F6D proof rejects missingbitcallee, BYTEwidth, stack imbalance and wrong return',()=>{
  const missing=new Map(graph);missing.delete(0x809E65);assert.throws(()=>proveWordStack(missing,0x809F6D,'RTS'),/Uncovered edge/);
  for(const[pc,change,pattern]of[[0x809FBE,{state:{e:0,m:1,x:0}},/Mode mismatch/],
    [0x809FF8,{value:32},/Mode mismatch/],[0x809FC7,{mnemonic:'NOP'},/Stack mismatch/],
    [0x80A032,{mnemonic:'RTL'},/Wrong root return/],[0x809E7D,{mnemonic:'RTL'},/Wrong call return/]]){
    const mutant=new Map(graph);mutant.set(pc,{...graph.get(pc),...change});assert.throws(()=>proveWordStack(mutant,0x809F6D,'RTS'),pattern);
  }
});

test('9F6D two selected936C callers mask sourcebank and use5250 before sourceverified8F20/9022/905E and open905E native binding',()=>{
  for(const start of [0x809442,0x809465]) {
    at(start,'LDA',0xF6,'dily');at(start+2,'AND',255);at(start+5,'TAY');at(start+6,'LDA',0xF6,'dil');
    at(start+8,'LDX',0x5250);at(start+11,'JSR',0x809F6D);at(start+14,'JSR',0x808F20);
  }
  at(0x80943F,'LDY',2);at(0x809453,'JSR',0x809022);at(0x809476,'JSR',0x80905E);
  assert.match(report.callers.qualification,/No whole936C stack proof/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
