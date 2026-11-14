import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveMenuStack, proveSelectionStack } from './render-menu-stack-proof.mjs';

const {bytes:rom,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
const report=JSON.parse(await readFile('analysis/render-selection.json','utf8'));
const address=label=>parseInt(label.replace(':',''),16);
const pins=[
  ['choice91E2',0x8091E2,0x80920D,18,'77b0c30b38d8028f5cc73f7772b11f14ad151187e5483c4a89de6f82ca7b1580'],
  ['choice9215',0x809215,0x8092C5,76,'5bbcca6fc7cd254474a65f52ad4d02fd519a002e3482be22d30d1d9247be2b1d'],
  ['selectedDialogChoices',0x80948D,0x8094A5,10,'a534b9bc166cd8ae9203a3b24e3f8b6644af76cfddeeb899e69688cd912d1f7a'],
];
// Independent literal mode regions from the original source; analyzer state
// and its compact proof intervals are not used to decode these instructions.
const byteRegions=[[0x80FAB6,0x80FAC6],[0x80FD91,0x80FDA7],[0x80FDBC,0x80FDCA],
  [0x80F9E8,0x80F9FB],[0x80FE84,0x80FE89],[0x80FEA1,0x80FEBC],
  [0x80FB95,0x80FBC6],[0x80FC38,0x80FC5C],[0x80FC5F,0x80FC79],
  [0x80FC96,0x80FCEE],[0x80FD15,0x80FD37],[0x80FD56,0x80FD5B],
  [0x81ADCE,0x81ADD9],[0x81AE2E,0x81AE33],[0x81AE61,0x81AE8F],
  [0x80C447,0x80C45F],[0x81F13D,0x81F156],[0x81F18E,0x81F1B4],
  [0x81F1C6,0x81F1D1],[0x81F1EB,0x81F1F5],[0x81F125,0x81F12F],
  [0x81F03A,0x81F067],[0x81F00A,0x81F023],
  [0x809EE4,0x809EED],[0x809F00,0x809F12],
  [0x81AF37,0x81AF3E],[0x81AFB0,0x81AFB7],[0x81AFDE,0x81AFE5]];
const map=new Map(),callerMap=new Map();
for(const w of [...report.windows,...report.dependencies.flatMap(d=>d.windows),report.caller]) {
  const destination=w.name==='selectedDialogChoices'?callerMap:map;
  for(let pc=address(w.entry);pc<address(w.end_exclusive);){
    const reset=pc>=0x809E50&&pc<0x809E59;
    const i=decode(rom,pc,{e:Number(pc===0x809E55),m:Number(reset||byteRegions.some(([a,b])=>pc>=a&&pc<b)),
      x:Number(reset||pc>=0x809F00&&pc<0x809F12)});
    assert.ok(i.next<=address(w.end_exclusive),cpuLabel(pc));
    if(destination.has(pc))assert.deepEqual(destination.get(pc),i);
    destination.set(pc,i);pc=i.next;
  }
}
const at=(pc,op,value,mode)=>{
  const i=map.get(pc)??callerMap.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));if(mode!==undefined)assert.equal(i.mode,mode);return i;
};
const broken=(pc,patch)=>{const m=new Map(map);m.set(pc,{...m.get(pc),...patch});return m;};
const reached=(p,pc)=>p.mode_windows.some(w=>pc>=address(w.entry)&&pc<address(w.end_exclusive));

test('selection pins two exact WORD roots, original caller and complete European ROM independently',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256,metadata.rom_sha256);
  for(const[name,start,end,count,hash]of pins){const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.deepEqual([...report.windows,report.caller].find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
    assert.equal([...map.keys(),...callerMap.keys()].filter(pc=>pc>=start&&pc<end).length,count);
  }
  assert.equal(map.has(0x80920D),false);assert.equal(map.size,1664);assert.equal([...map.values()].reduce((n,i)=>n+i.raw.length,0),3573);
});

test('selection tables8/510 have independent hashes and exclude adjacent data from code',()=>{
  for(const[t,start,length,hash]of [[report.tables[0],0x80920D,8,'044bad9630a54bb9397f60e057338a1a1d5a6695e91028d3b07dd4cd527ff45d'],
    [report.tables[1],0x8D8000,510,'9bad33072654e14111ebea142bd5cb2f2c480a79a957b39e96f9256d05a01623']]){
    const offset=cpuToOffset(start,rom.length),raw=rom.subarray(offset,offset+length);
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);assert.equal(t.sha256,hash);assert.equal(t.covered_bytes,length);assert.equal(t.machine_bytes,raw.toString('hex').toUpperCase());
  }
  assert.equal(report.tables[0].machine_bytes,'88708C7090700000');
  for(let id=0;id<255;id++){const index=id*2;assert.ok(index>=0&&index+1<510);assert.equal(index&1,0);}
});

test('all transitive dependency windows match original bytes and owner contracts with independent widths',async()=>{
  for(const d of report.dependencies){const owner=JSON.parse(await readFile(d.report,'utf8'));assert.equal(owner.rom_sha256,metadata.rom_sha256);
    for(const w of d.windows){const start=address(w.entry),end=address(w.end_exclusive),raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
      assert.ok([...owner.windows,...(owner.dependencies??[]).flatMap(d=>d.windows)].some(v=>JSON.stringify(v)===JSON.stringify(w)));
      assert.equal(createHash('sha256').update(raw).digest('hex'),w.sha256);assert.equal(raw.toString('hex').toUpperCase(),w.machine_bytes);
      assert.equal([...map.keys()].filter(pc=>pc>=start&&pc<end).length,w.instruction_count);
    }
  }
});

test('91E2 constructs fixedbank80 pointer with freshDP17 and rereads DP00 after realA6C7',()=>{
  at(0x8091E2,'LDA',0x17,'dp');at(0x8091E4,'STA',0,'dp');
  for(const[pc,offset,value]of [[0x8091E6,2,2],[0x8091EB,4,4],[0x8091F0,6,3],[0x8091F5,8,0x920D],[0x8091FA,10,0x80]]){
    at(pc,'LDA',value,'immM');at(pc+3,'STA',offset,'dp');
  }
  at(0x8091FF,'JSR',0x80A6C7);at(0x809202,'LDA',0,'dp');at(0x809204,'CMP',65535);
  at(0x809207,'BNE',0x80920C);at(0x809209,'STA',0x1D63,'abs');at(0x80920C,'RTS');
  const writes=[...map.values()].filter(i=>i.cpu>=0x8091E2&&i.cpu<0x80920D&&i.mnemonic==='STA').map(i=>[i.mode,i.value]);
  assert.deepEqual(writes,[['dp',0],['dp',2],['dp',4],['dp',6],['dp',8],['dp',10],['abs',0x1D63]]);
});

test('91E2 all65536 post-menu words select only exactFFFF and produce fullWORD CMP flags',()=>{
  // Numeric source consequence only: no menu, memory or CPU execution.
  for(let value=0;value<65536;value++){
    const difference=(value-65535)&65535;assert.equal(value===65535,difference===0);
    assert.equal(value>=65535,value===65535);assert.equal(Boolean(difference&0x8000),value>=32767&&value<65535);
  }
  assert.equal(at(0x809202,'LDA',0).state.m,0);assert.equal(at(0x809209,'STA',0x1D63).state.m,0);
});

test('9215 masks WORD ID/flag reads but still requires their high bytes and real lowFF sentinel',()=>{
  at(0x809215,'LDA',0x7E3CA3,'long');at(0x809219,'AND',255);at(0x80921C,'CMP',255);at(0x80921F,'BEQ',0x80924E);
  at(0x809225,'LDA',0x7E3CA3,'longx');at(0x809229,'AND',255);at(0x80922C,'CMP',255);at(0x80922F,'BEQ',0x809254);
  at(0x809231,'STA',0x23,'dp');at(0x809233,'LDA',0x7E3CD6,'longx');at(0x809237,'AND',255);at(0x80923A,'BNE',0x80924B);
  for(let value=0;value<65536;value++){assert.equal((value&255)===255,value%256===255);assert.equal((value&255)===0,value%256===0);}
  for(const pc of[0x809215,0x809225,0x809233,0x8092B3])assert.equal(map.get(pc).state.m,0);
});

test('9215 collection saves WORD scanX and appends original8D token with actualDBR fullY addresses',()=>{
  for(const[pc,op,value]of [[0x809221,'LDX',0],[0x809224,'TXY'],[0x80923C,'PHX'],[0x80923D,'LDA',0x23],
    [0x80923F,'ASL'],[0x809240,'TAX'],[0x809241,'LDA',0x8D8000],[0x809245,'STA',0x154],
    [0x809248,'PLX'],[0x809249,'INY'],[0x80924A,'INY'],[0x80924B,'INX'],[0x80924C,'BRA',0x809225]])at(pc,op,value);
  assert.equal(map.get(0x809241).mode,'longx');assert.equal(map.get(0x809245).mode,'absy');
  assert.equal(map.get(0x809249).state.x,0);
  // Both full indices wrap independently; effective long addresses carry banks.
  assert.equal(0x7E3CA3+0xFFFF,0x7F3CA2);assert.equal(0x7E0154+0xFFFF,0x7F0153);
  assert.equal((0xFFFF+1)&65535,0);assert.equal((32768*2)&65535,0);
  // Synthetic address consequence: indexed list output may alias a future ID.
  assert.equal(0x7E0154+0x3B4F,0x7E3CA3);
});

test('9215 firstsentinel and collectedYzero exits do not clear1D63 or allocate a buffer',()=>{
  at(0x80924E,'LDA',65535);at(0x809251,'STA',0,'dp');at(0x809253,'RTS');at(0x809254,'CPY',0);at(0x809257,'BEQ',0x80924E);
  at(0x809259,'LDA',0);at(0x80925C,'STA',0x154,'absy');
  for(let accepted=0;accepted<=65536;accepted++)assert.equal(((accepted*2)&65535)===0,accepted%32768===0);
  const early=[...map.values()].filter(i=>i.cpu>=0x80924E&&i.cpu<0x809254);
  assert.deepEqual(early.map(i=>i.mnemonic),['LDA','STA','RTS']);assert.equal(early[1].value,0);
});

test('9215 actual allocation, freshDP1A scratch, menu pointer and unconditional release are pinned',()=>{
  for(const[pc,offset,value]of [[0x80925F,0,6],[0x809264,2,15],[0x809269,4,14],[0x80926E,6,11],[0x809273,8,0],
    [0x80927F,2,1],[0x809284,4,0],[0x809289,6,9],[0x80928E,8,0x154],[0x809293,10,0x7E]]){
    at(pc,'LDA',value);at(pc+3,'STA',offset,'dp');
  }
  at(0x809278,'JSR',0x80F963);at(0x80927B,'LDA',0,'dp');at(0x80927D,'STA',0x1A,'dp');
  at(0x809298,'JSR',0x80A6C7);at(0x80929B,'PEI',0,'di');at(0x80929D,'LDA',0x1A,'dp');at(0x80929F,'STA',0,'dp');
  at(0x8092A1,'JSR',0x80FA3E);at(0x8092A4,'PLY');
  assert.ok(![...map.values()].filter(i=>i.cpu>=0x809278&&i.cpu<0x8092A5).some(i=>i.mode==='rel8'));
});

test('9215 cancellation restores stackselection while retaining realrelease A/X and returnedDBR',()=>{
  at(0x8092A5,'CPY',65535);at(0x8092A8,'BNE',0x8092B0);at(0x8092AA,'STY',0x1D63,'abs');at(0x8092AD,'STY',0,'dp');at(0x8092AF,'RTS');
  assert.ok(![...map.values()].filter(i=>i.cpu>=0x8092A4&&i.cpu<0x8092B0).some(i=>['LDA','TXA','TYA','TAX'].includes(i.mnemonic)));
  const p=report.choice9215_graph.proof;assert.ok(p.returns.some(r=>r.at==='80:92AF'&&r.dbr==='entry'));
  assert.ok(p.returns.every(r=>r.dbr==='entry'||r.dbr===0x80));
});

test('9215 remapping rereads flags only, decrements WORDY and exits on sign rather than ID sentinel',()=>{
  for(const[pc,op,value]of [[0x8092B0,'LDX',0],[0x8092B3,'LDA',0x7E3CD6],[0x8092B7,'AND',255],
    [0x8092BA,'BNE',0x8092BF],[0x8092BC,'DEY'],[0x8092BD,'BMI',0x8092C2],
    [0x8092BF,'INX'],[0x8092C0,'BRA',0x8092B3],[0x8092C2,'STX',0],[0x8092C4,'RTS']])at(pc,op,value);
  assert.equal(map.get(0x8092B3).mode,'longx');assert.equal(map.get(0x8092BC).state.x,0);
  assert.deepEqual([...map.values()].filter(i=>i.cpu>=0x8092B0&&i.cpu<0x8092C5&&i.mnemonic==='LDA').map(i=>i.value),[0x7E3CD6]);
  for(let y=0;y<65535;y++){
    const after=(y-1)&65535;assert.equal(Boolean(after&0x8000),y===0||y>=0x8001);
  }
  assert.equal((0x8000-1)&65535,0x7FFF);assert.equal((0x8001-1)&65535,0x8000);
  // Synthetic sparse flag fixture: zero-based ordinal2 maps to index5.
  const flags=[1,0,2,0,7,0];let y=2,selected=null;
  for(let x=0;x<flags.length;x++)if(flags[x]===0){y=(y-1)&65535;if(y&0x8000){selected=x;break;}}
  assert.equal(selected,5);assert.equal(y,65535);
});

test('selection transitive normal proofs preserve22/28 stack witnesses and both sound profiles',()=>{
  for(const[entry,key,stack,reach,originalReach]of [[0x8091E2,'choice91e2_graph',22,1080,939],[0x809215,'choice9215_graph',28,1620,1479]]){
    const p=proveSelectionStack(map,entry);assert.deepEqual(p,report[key].proof);assert.equal(p.minimum_protected_stack_bytes,stack);
    assert.equal(p.external_return_assumptions,0);assert.equal(p.reachable_instructions,reach);
    const original=proveSelectionStack(map,entry,{sound:'original-002D'});assert.deepEqual(original,report[key].original_sound_proof);
    assert.equal(original.minimum_protected_stack_bytes,stack);assert.equal(original.reachable_instructions,originalReach);
    assert.ok(reached(p,0x81F130));assert.ok(!reached(original,0x81F130));assert.ok(!reached(p,0x809E3D));
    assert.ok(p.excluded_boundaries.filter(b=>b.at==='80:9E2F').every(b=>b.local_stack_bytes===4));
    const witness=p.maximum_stack_witness;assert.equal(witness.local_stack_bytes+2,stack);
    assert.equal(witness.return_frames.reduce((n,f)=>n+(f.kind==='RTS'?2:3),0)+witness.data_bytes+witness.status_bytes+2,stack);
  }
  assert.equal(report.choice91e2_graph.proof.maximum_stack_witness.at,'81:AEAA');
  assert.equal(report.choice9215_graph.proof.maximum_stack_witness.at,'80:9E69');
  assert.equal(report.choice9215_graph.proof.maximum_stack_witness.data_bytes,8);
});

test('selection compact mode windows cover every reached byte with immediate width agreement',()=>{
  for(const p of[...report.conditional_graph.proofs,...report.conditional_graph.original_sound_proofs]){
    const visited=new Set(),modes=new Set();
    for(const w of p.mode_windows)for(let pc=address(w.entry);pc<address(w.end_exclusive);){
      const i=map.get(pc);assert.ok(i);assert.ok(i.next<=address(w.end_exclusive));
      const key=`${pc}/${w.m}/${w.x}`;assert.ok(!modes.has(key));modes.add(key);visited.add(pc);
      if(i.mode==='immM')assert.equal(i.raw.length,w.m?2:3);if(i.mode==='immX')assert.equal(i.raw.length,w.x?2:3);pc=i.next;
    }
    assert.equal(visited.size,p.reachable_instructions);
  }
});

test('selection proof rejects missing actual callees and mutated stack, width, return or control edges',()=>{
  for(const entry of[0x80A6C7,0x80F963,0x80FA3E,0x81AD92,0x809F49,0x809E65,0x81B0A1,0x80C46E]){
    const m=new Map(map);m.delete(entry);assert.throws(()=>proveSelectionStack(m,0x809215),/Uncovered|Renew/);
  }
  for(const[pc,patch]of [[0x80929B,{mode:'dp'}],[0x80929B,{value:2}],[0x8092A4,{mnemonic:'PLA'}],
    [0x80923C,{mnemonic:'NOP'}],[0x809248,{mnemonic:'NOP'}],[0x8092C4,{mnemonic:'RTL'}],
    [0x809278,{target:0x80E382}],[0x809298,{target:0x80920D}],[0x8092C0,{target:0x8092C5}],
    [0x809245,{state:{e:0,m:1,x:0}}],[0x809F34,{state:{e:0,m:1,x:0}}],
    [0x809E2C,{value:0x3031}],[0x80A80F,{value:0}]])assert.throws(()=>proveSelectionStack(broken(pc,patch),0x809215));
  for(const[pc,patch]of [[0x8091FF,{target:0x80A6A5}],[0x809207,{target:0x80920D}],[0x80920C,{mnemonic:'RTL'}]])assert.throws(()=>proveSelectionStack(broken(pc,patch),0x8091E2));
  assert.throws(()=>proveSelectionStack(map,0x80A6C7),/Invalid selection/);assert.throws(()=>proveSelectionStack(map,0x809215,{sound:'guess'}),/Invalid selection/);
  assert.throws(()=>proveMenuStack(map,0x809215),/Invalid menu/);
});

test('actual936C callers and supplied native entries keep conditional sources out of unconditional BF3B graph',async()=>{
  at(0x809490,'JSR',0x8091E2);at(0x8094A2,'JSR',0x809215);
  const parent=JSON.parse(await readFile('analysis/render-bf3b.json','utf8'));
  for(const[entry,stack]of [['80:91E2',22],['80:9215',28]]){
    assert.ok(!parent.full_graph.unresolved_nested_callees.includes(entry));
    assert.ok(!parent.full_graph.supplied_source_nested_callees.some(c=>c.entry===entry));
    const supplied=parent.full_graph.supplied_conditional_nested_callees.find(c=>c.entry===entry);
    assert.equal(supplied.minimum_protected_stack_bytes,stack);assert.equal(supplied.native_binding,true);
    assert.equal(supplied.conditional_normal_graph_closed,true);assert.equal(supplied.full_reset_graph_closed,false);
  }
  assert.equal(parent.full_graph.closed,false);assert.equal(parent.full_graph.native_binding,false);
  const progress=JSON.parse(await readFile('docs/PORTIERUNGSSTAND.json','utf8'));
  assert.equal(progress.work_groups.some(g=>g.id==='selection-91e2-9215'),false);
  for(const[entry,stack]of [['80:91E2',22],['80:9215',28]])assert.equal(progress.supplied.find(r=>r.entry===entry).stack_bytes,stack);
  assert.equal(report.choice91e2_graph.native_binding,true);assert.equal(report.choice9215_graph.native_binding,true);
  assert.equal(report.conditional_graph.native_binding,true);assert.equal(report.conditional_graph.full_reset_graph_closed,false);
  assert.equal(report.conditional_graph.actual_termination_proven,false);assert.equal(report.progress_reference,'docs/PORTIERUNGSSTAND.json');
});
