import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuToOffset,cpuLabel} from './rom.mjs';
import {decode} from './disassemble.mjs';
import {proveText9178Stack} from './render-9178-stack-proof.mjs';
const {bytes:rom,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
const report=JSON.parse(await readFile('analysis/render-9178.json','utf8'));
const address=s=>parseInt(s.replace(':',''),16);
// Independently fixed original incoming BYTE regions, including branch-only
//91D8 and FB39 joins. Analyzer/proof mode intervals do not decode this map.
const byteRegions=[[0x80908C,0x8090EB],[0x80918A,0x80919A],[0x8091A8,0x8091B5],[0x8091D8,0x8091DA],
  [0x80FAB6,0x80FAC6],[0x80FE84,0x80FE89],[0x80FEA1,0x80FEBC],[0x80FB95,0x80FBC6],
  [0x80FC38,0x80FC5C],[0x80FC5F,0x80FC79],[0x80FC96,0x80FCEE],[0x80FD15,0x80FD37],
  [0x80FD56,0x80FD5B],[0x81ADCE,0x81ADD9],[0x81AE2E,0x81AE33],[0x81AE61,0x81AE8F]];
const map=new Map(),extra=new Map();
for(const w of [...report.windows,...report.dependencies.flatMap(d=>d.windows),...report.excerpts]){
  const target=report.excerpts.includes(w)?extra:map;
  for(let pc=address(w.entry);pc<address(w.end_exclusive);){
    const i=decode(rom,pc,{e:0,m:Number(byteRegions.some(([a,b])=>pc>=a&&pc<b)),x:0});
    assert.ok(i.next<=address(w.end_exclusive));if(target.has(pc))assert.deepEqual(target.get(pc),i);target.set(pc,i);pc=i.next;
  }
}
const at=(pc,op,value,mode)=>{const i=map.get(pc)??extra.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));if(mode!==undefined)assert.equal(i.mode,mode);return i;};
const mutate=(pc,patch)=>{const m=new Map(map);m.set(pc,{...m.get(pc),...patch});return m;};

test('9178/908C roots and task/caller excerpts have independent European-ROM hashes and instruction counts',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256,metadata.rom_sha256);
  for(const[name,start,end,count,hash]of [
    ['text9178',0x809178,0x8091E2,57,'10d125b6ec392df0f3fdff7d4f24515d73e53ae213b2f5e6468f745b62c87d80'],
    ['insert908C',0x80908C,0x8090EB,42,'038989b171013afdc0063b25677f20570283559c8a14302792b07dda555f31a4'],
    ['appendC34A',0x80C34A,0x80C366,11,'9956f7144b0b6c29202dfa6667fac828e926c950132c1b4522d09c1d59b0265f'],
    ['visitC1CA',0x80C1CA,0x80C1E3,12,'b8afd73d016d4f9a41e98d0e5fe70e5f17b9fd191bd72fa48597eafd5041f888'],
    ['dynamicTaskDispatch',0x80C1F9,0x80C20B,8,'c759767edd6604422132e4daff433ab728ef6499850b52072fc218772ac88e6e'],
    ['caller9483',0x80947C,0x809486,4,'40763c17b9a65133b720bf78c61da3584b490c45ca4d039235ed992ce7800116'],
    ['caller94B8',0x8094B1,0x8094BB,3,'762e1d6a041188e4ec955b4f3c5ae4d497aea30a8a801e5f6d2489a9b3683a64'],
    ['caller94C5',0x8094C2,0x8094C8,2,'012bf79e6928848335f762415001d292b9e074762d71202a2c64c3ef0fcb554d']]){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.deepEqual([...report.windows,...report.excerpts].find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(map.size,632);assert.equal([...map.values()].reduce((n,i)=>n+i.raw.length,0),1306);
});

test('all actual render dependency bytes match their owners with independent BYTE/WORD decode regions',async()=>{
  for(const d of report.dependencies){const owner=JSON.parse(await readFile(d.report,'utf8'));assert.equal(owner.rom_sha256,metadata.rom_sha256);
    for(const w of d.windows){const raw=rom.subarray(cpuToOffset(address(w.entry),rom.length),cpuToOffset(address(w.end_exclusive),rom.length));
      assert.ok(owner.windows.some(v=>JSON.stringify(v)===JSON.stringify(w)));assert.equal(raw.toString('hex').toUpperCase(),w.machine_bytes);
      assert.equal(createHash('sha256').update(raw).digest('hex'),w.sha256);assert.equal([...map.keys()].filter(pc=>pc>=address(w.entry)&&pc<address(w.end_exclusive)).length,w.instruction_count);
    }
  }
});

test('9178 fresh setup, BYTE tag and WORD masked length retain fullY wrap and required highbyte',()=>{
  for(const[pc,op,value,mode]of [[0x809178,'STA',0x1D,'dp'],[0x80917A,'LDA',0x14,'dp'],[0x80917C,'STA',0],
    [0x80917E,'JSR',0x80FA67],[0x809181,'STZ',2],[0x809183,'STZ',4],[0x809185,'JSR',0x80FAAC],
    [0x80918A,'LDY',4],[0x80918D,'LDA',0x11,'dily'],[0x80918F,'CMP',0xF8],[0x809191,'BEQ',0x8091D8],
    [0x809193,'INY'],[0x809194,'CMP',0x1D],[0x809198,'REP',32],[0x80919A,'LDA',0x11,'dily'],
    [0x80919C,'AND',255],[0x80919F,'STA',0x23],[0x8091A1,'TYA'],[0x8091A2,'CLC'],[0x8091A3,'ADC',0x23],[0x8091A5,'TAY']])at(pc,op,value,mode);
  assert.equal(map.get(0x80919A).state.m,0);assert.equal(map.get(0x80918D).state.m,1);
  for(let value=0;value<65536;value++)assert.equal(value&255,value%256);
  for(let y=0;y<65536;y++)for(const length of [0,1,255])assert.equal((y+length)&65535,(y+length)%65536);
});

test('908C uses actual BYTE nibble and increments fullY even for count0; all256 flags split nibble and taskbit',()=>{
  at(0x80908C,'AND',15);at(0x80908E,'INY');at(0x80908F,'CMP',0);at(0x809091,'BEQ',0x8090EA);at(0x809093,'STA',0x20);
  at(0x809095,'LDA',0x11,'dily');at(0x809097,'STA',0x1D);at(0x809099,'INY');at(0x80909A,'LDX',0);
  for(const i of [...map.values()].filter(i=>i.cpu>=0x80908C&&i.cpu<0x8090EB))assert.deepEqual(i.state,{e:0,m:1,x:0});
  for(let flag=0;flag<256;flag++){assert.ok((flag&15)<=15);assert.equal((flag<<1)&255,(flag*2)%256);assert.equal(flag>>>7,Number(flag>=128));}
  assert.equal(0x80&15,0);assert.equal((65535+1)&65535,0);
});

test('908C duplicate exits before all insertion stores, with original sentinel-first and unsigned search ordering',()=>{
  for(const[pc,op,value]of [[0x80909D,'LDA',0x7E3CA3],[0x8090A1,'CMP',255],[0x8090A3,'BEQ',0x8090AE],
    [0x8090A5,'CMP',0x1D],[0x8090A7,'BEQ',0x8090E6],[0x8090A9,'BCS',0x8090AE],
    [0x8090AB,'INX'],[0x8090AC,'BRA',0x80909D],[0x8090E6,'DEC',0x20],[0x8090E8,'BNE',0x809095]])at(pc,op,value);
  const stores=[...map.values()].filter(i=>i.cpu>=0x80908C&&i.cpu<0x8090EB&&i.mnemonic==='STA'&&i.mode==='longx');
  assert.deepEqual(stores.map(i=>[i.cpu,i.value]),[[0x8090BB,0x7E3CA3],[0x8090C1,0x7E3CD6],[0x8090CB,0x7E3CA3],[0x8090DB,0x7E3CD6]]);
  for(let old=0;old<256;old++)for(let desired=0;desired<256;desired++){
    const insertion=old===255||old>desired;assert.equal(old===desired&&!insertion,old===desired&&old!==255);
  }
});

test('908C XBA/HighA pipeline moves fresh IDs/flags and stops after movedFF before terminalflag propagation',()=>{
  for(const[pc,op,value]of [[0x8090AE,'LDA',0x7E3CA3],[0x8090B2,'XBA'],[0x8090B3,'LDA',0x7E3CD6],
    [0x8090B7,'STA',0x23],[0x8090B9,'LDA',0x1D],[0x8090BF,'LDA',0],[0x8090C5,'INX'],
    [0x8090C6,'LDA',0x7E3CA3],[0x8090CA,'XBA'],[0x8090CF,'CMP',255],[0x8090D1,'BEQ',0x8090E6],
    [0x8090D3,'LDA',0x7E3CD6],[0x8090D7,'STA',0x24],[0x8090D9,'LDA',0x23],[0x8090DF,'LDA',0x24],[0x8090E1,'STA',0x23]])at(pc,op,value);
  for(let old=0;old<256;old++)for(let next=0;next<256;next++)assert.equal(((old<<8|next)>>>8)|((next&255)<<8),(next<<8)|old);
  assert.equal(0x7E3CA3+65535,0x7F3CA2);assert.equal(0x7E3CD6+65535,0x7F3CD5);
});

test('BYTE PHA/PLA, PHP/PHY and PLY/PLP retain flagbit7 and streamY across actual FE69',()=>{
  for(const[pc,op,value]of [[0x8091AA,'INY'],[0x8091AB,'LDA',0x11],[0x8091AD,'PHA'],[0x8091AE,'JSR',0x80908C],
    [0x8091B1,'PLA'],[0x8091B2,'ASL'],[0x8091B3,'REP',32],[0x8091B5,'PHP'],[0x8091B6,'PHY'],
    [0x8091B7,'BCC',0x8091BB],[0x8091B9,'INY'],[0x8091BA,'INY'],[0x8091BB,'LDA',0x11],
    [0x8091BD,'STA',2],[0x8091BF,'LDA',0x14],[0x8091C1,'STA',0],[0x8091C3,'JSR',0x80FE69],
    [0x8091C6,'PLY'],[0x8091C7,'PLP'],[0x8091C8,'BCC',0x8091D7]])at(pc,op,value);
  assert.equal(map.get(0x8091AD).state.m,1);assert.equal(map.get(0x8091B1).state.m,1);assert.equal(map.get(0x8091B6).state.x,0);
  for(let flag=0;flag<256;flag++)assert.equal(flag&128?2:0,flag>>>7?2:0);
});

test('F8 sentinel compares fresh fullDP1D and retries original root with AFFFD rather than preserving the first tag',()=>{
  at(0x8091D8,'REP',32);at(0x8091DA,'LDA',0xFFFD);at(0x8091DD,'CMP',0x1D);at(0x8091DF,'BNE',0x809178);at(0x8091E1,'RTS');
  for(let value=0;value<65536;value++)assert.equal((0xFFFD-value&65535)===0,value===0xFFFD);
  assert.equal(map.get(0x809178).state.m,0);assert.equal(map.get(0x809097).state.m,1);
});

test('three original936C callers and tasktail reach real append/visit, including data-derived RTS dispatch',()=>{
  at(0x809480,'LDA',65535);at(0x809483,'JSR',0x809178);at(0x8094B1,'LDA',0x7E3CA3);at(0x8094B5,'AND',255);at(0x8094B8,'JSR',0x809178);
  at(0x8094C2,'LDA',0xFFFE);at(0x8094C5,'JSR',0x809178);
  at(0x8091CA,'LDA',0x11,'dily');at(0x8091CC,'TAX');at(0x8091CD,'LDA',0x26);at(0x8091CF,'STA',0);
  at(0x8091D1,'JSR',0x80C34A);at(0x8091D4,'JSR',0x80C1CA);at(0x80C34A,'JSR',0x80C2C8);
  at(0x80C1CA,'LDA',0x250);at(0x80C1CD,'PHA');at(0x80C1CE,'LDX',0x24C);at(0x80C1D4,'BMI',0x80C1DE);at(0x80C1D6,'JSR',0x80C1F9);
  at(0x80C1FE,'LDA',0x2B2,'absx');at(0x80C203,'PEA',0xC20A);at(0x80C206,'PHA');at(0x80C207,'RTS');at(0x80C208,'JSR',0x80F378);
  assert.match(report.contract.taskTail,/data-derived code dispatch/);assert.match(report.contract.taskTail,/no transitive/);
});

test('actual render proof reaches626 instructions and17 protected bytes; standaloneBYTE908C needs2',()=>{
  const p=proveText9178Stack(map);assert.deepEqual(p,report.render_graph.proof);assert.equal(p.reachable_instructions,626);
  assert.equal(p.minimum_protected_stack_bytes,17);assert.equal(p.external_return_assumptions,0);assert.equal(p.maximum_stack_witness.at,'81:AEAA');
  assert.deepEqual(p.returns,[{at:'80:91D7',m:0,x:0,dbr:'entry'},{at:'80:91E1',m:0,x:0,dbr:'entry'}]);
  assert.deepEqual(proveText9178Stack(map,0x80908C),report.helper_graph.proof);assert.equal(report.helper_graph.proof.minimum_protected_stack_bytes,2);
  assert.equal(p.excluded_boundaries[0].at,'80:91C8');assert.equal(p.excluded_boundaries[0].to,'80:91CA');
});

test('compact proof modes preserve every visited source byte and reject missing bodies, stack/control/width mutations',()=>{
  const p=report.render_graph.proof;
  for(const w of p.mode_windows)for(let pc=address(w.entry);pc<address(w.end_exclusive);){const i=map.get(pc);assert.ok(i);assert.equal(i.state.x,w.x);
    if(pc!==0x80FC36)assert.equal(i.state.m,w.m);pc=i.next;}
  for(const target of new Set([...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&map.has(i.target)).map(i=>i.target))){
    const m=new Map(map);m.delete(target);assert.throws(()=>proveText9178Stack(m));
  }
  for(const[pc,patch]of [[0x8091AD,{mnemonic:'PHX'}],[0x8091B1,{mnemonic:'NOP'}],[0x8091B5,{mnemonic:'NOP'}],
    [0x8091C6,{mnemonic:'PLX'}],[0x8091C7,{mnemonic:'NOP'}],[0x8091D7,{mnemonic:'RTL'}],
    [0x8091C8,{target:0x8091D1}],[0x80908C,{state:{e:0,m:0,x:0}}],[0x80FE69,{mnemonic:'JML'}],
    [0x80FAAC,{state:{e:0,m:1,x:0}}],[0x8091D8,{value:16}],[0x8090EA,{mnemonic:'RTL'}]])assert.throws(()=>proveText9178Stack(mutate(pc,patch)));
  assert.throws(()=>proveText9178Stack(map,0x80C1CA),/Invalid/);
});

test('source/central/BF3B status keeps the full task graph open after separateC34A source delivery',async()=>{
  const parent=JSON.parse(await readFile('analysis/render-bf3b.json','utf8')),progress=JSON.parse(await readFile('docs/PORTIERUNGSSTAND.json','utf8'));
  assert.equal(report.full_graph.closed,false);assert.equal(report.full_graph.native_binding,false);assert.deepEqual(report.full_graph.unresolved_nested_callees,['80:C1CA']);
  assert.equal(report.full_graph.supplied_source_nested_callees[0].entry,'80:C34A');
  assert.equal(report.full_graph.supplied_source_nested_callees[0].minimum_protected_stack_bytes,8);
  assert.equal(report.render_graph.conditional_graph_closed,true);assert.equal(report.render_graph.native_binding,false);assert.equal(report.render_graph.actual_termination_proven,false);
  assert.ok(parent.full_graph.unresolved_nested_callees.includes('80:9178'));assert.ok(!parent.full_graph.supplied_source_nested_callees.some(c=>c.entry==='80:9178'));
  const partial=parent.full_graph.supplied_partial_nested_callees.find(c=>c.entry==='80:9178');assert.equal(partial.full_graph_closed,false);assert.equal(partial.minimum_render_stack_bytes,17);
  assert.equal(progress.work_groups.find(g=>g.id==='text-9178').status,'source-required');assert.ok(!progress.supplied.some(r=>r.entry==='80:9178'));
  assert.equal(report.full_graph.supplied_partial_nested_callees[0].entry,'80:C1CA');
  assert.equal(report.full_graph.supplied_partial_nested_callees[0].minimum_protected_stack_bytes,null);
});
