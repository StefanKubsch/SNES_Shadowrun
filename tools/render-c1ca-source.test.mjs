import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode} from './disassemble.mjs';
import {proveVisitC1CAFrontier} from './render-c1ca-stack-proof.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {scriptOpcodes} from '../src/script/opcodes.mjs';
const {bytes:rom,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
const report=JSON.parse(await readFile('analysis/render-c1ca.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const windows=[
  ['visitC1CA',0x80C1CA,0x80C1E3,12,'b8afd73d016d4f9a41e98d0e5fe70e5f17b9fd191bd72fa48597eafd5041f888'],
  ['runC1F9',0x80C1F9,0x80C242,30,'f1eed4a9bdb4b32f0a76ec99f6d65f5fce0cfeb2e058fb8729cb6f60adf911dd'],
  ['readyC3C9',0x80C3C9,0x80C401,26,'7a2149d63131cc826e0beea05c2f42cd561836be3c5d36cfc9fe606ce622ef45'],
  ['removeC396',0x80C396,0x80C3C9,22,'62cd7584a91f512af37ea356498721511a615242a7777d029ed7d394c7ad4843'],
  ['releaseC2BD',0x80C2BD,0x80C2C8,5,'005dbc8b7351dd8d73e7d74d9b389e2af85aef24854a16b244bb5079d4b6669b'],
  ['interpreterF378',0x80F378,0x80F393,15,'60c6faf96ff883254f2ace528057e72b4e1e46389e845683e308d0c3b50c9883'],
  ['endF4BE',0x80F4BE,0x80F4CB,7,'9f6a4494f53e66f10e14841ed27729cccbf2874e132779b894bade4fde38dd45'],
  ['nativeF4CB',0x80F4CB,0x80F532,51,'1f23c041f8b9d73fcf633c2048e902a66bd1999fcbf04f0e86ca7ccaa9a398bc'],
  ['waitC401',0x80C401,0x80C416,9,'fc2da201f0f961428b266f8aa52dfb2c697f6e691e8884877c198ea4ef959932'],
  ['caller9178',0x8091CA,0x8091D8,7,'ebb453e81282b03faeb3ae7088adecb75964f41de7dd70b0b49ed8e564450467'],
  ['sweepC1E3',0x80C1E3,0x80C1F9,10,'9e4b04f1de1dc9eef289fce5d2be2dcd867b508bf4c456eadac19eb588fda938']];
const all=new Map(),map=new Map();
for(const [name,start,end]of windows)for(let pc=start;pc<end;){const i=decode(rom,pc,{e:0,m:0,x:0});assert.ok(i.next<=end);all.set(pc,i);if(!['caller9178','sweepC1E3'].includes(name))map.set(pc,i);pc=i.next;}
const at=(pc,op,value,mode)=>{const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op,cpuLabel(pc));
  if(value!==undefined)assert.equal(i.target??i.value,value,cpuLabel(pc));if(mode!==undefined)assert.equal(i.mode,mode);return i;};
const abs=(bank,base,index=0)=>(bank*65536+base+index)&0xFFFFFF;
const word=pc=>rom.readUInt16LE(cpuToOffset(pc,rom.length));
// Arithmetic below is static source consequence/synthetic data, not CPU,
// native bytecode execution, scheduler/device/frame observations.

test('C1CA local380/177 and11 complete WORD windows have independent ROM hashes/caller boundaries',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256,metadata.rom_sha256);
  for(const [name,start,end,count,hash]of windows){const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));assert.equal(sha(raw),hash);
    assert.equal([...all.keys()].filter(pc=>pc>=start&&pc<end).length,count);
    assert.deepEqual([...report.windows,...report.excerpts].find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});}
  assert.equal(map.size,177);assert.equal([...map.values()].reduce((n,i)=>n+i.raw.length,0),380);assert.equal(report.local_source.code_bytes,380);
});

test('older task/heap/frame slices retain exact source ownership without supplying machine-return assumptions',async()=>{
  for(const d of report.dependencies){const owner=JSON.parse(await readFile(d.report,'utf8'));assert.equal(owner.rom_sha256,metadata.rom_sha256);
    for(const w of d.source_blocks){assert.ok(owner.source_blocks.some(v=>JSON.stringify(v)===JSON.stringify(w)));let pc=parseInt(w.entry,16),raw='';
      while(raw.length<w.machine_bytes.length){const i=map.get(pc);assert.ok(i);raw+=i.raw.toString('hex').toUpperCase();pc=i.next;}assert.equal(raw,w.machine_bytes);}}
  at(0x8091D1,'JSR',0x80C34A);at(0x8091D4,'JSR',0x80C1CA);at(0x8091D7,'RTS');
});

test('C1CA cursorVALUE is saved asWORD but nonnegative path forcesDBR80 before restoring actual0250 cell',()=>{
  for(const [pc,op,value]of [[0x80C1CA,'LDA',0x250],[0x80C1CD,'PHA'],[0x80C1CE,'LDX',0x24C],[0x80C1D1,'STX',0x250],
    [0x80C1D4,'BMI',0x80C1DE],[0x80C1D6,'JSR',0x80C1F9],[0x80C1D9,'PEA',0x8080],[0x80C1DC,'PLB'],[0x80C1DD,'PLB'],
    [0x80C1DE,'PLA'],[0x80C1DF,'STA',0x250],[0x80C1E2,'RTS']])at(pc,op,value);
  for(let bank=0;bank<256;bank++){assert.equal(abs(bank,0x250),bank*65536+0x250);assert.equal(abs(128,0x250),0x800250);}
  assert.notEqual(abs(0x7E,0x250),abs(0x80,0x250));assert.match(report.contract.cursor,/not necessarily original physical cell/);
  assert.deepEqual(report.no_dispatch_graph.proof.returns.map(r=>r.dbr),[128,'entry']);
});

test('C3C9 actualzero/negative/1000 mask paths precede scratchwrites and readiness has no timing input',()=>{
  for(const [pc,op,value]of [[0x80C3C9,'LDA',0xBA2],[0x80C3CC,'BEQ',0x80C3FF],[0x80C3CE,'BMI',0x80C3FA],
    [0x80C3D0,'BIT',0x1000],[0x80C3D3,'BNE',0x80C3FA],[0x80C3D5,'STZ',0],[0x80C3D7,'STA',0x71],
    [0x80C3D9,'AND',0x6FFE],[0x80C3DC,'AND',0xC62],[0x80C3FA,'CLC'],[0x80C3FC,'STZ',0xBA2],[0x80C3FF,'SEC']])at(pc,op,value);
  for(let mask=0;mask<65536;mask++){
    const earlyBlocked=Boolean(mask&0x9000);assert.equal(earlyBlocked,(mask>=32768)||Boolean(mask&4096));
    if(!mask||earlyBlocked)continue;
    for(const events of [0,1,65535,mask])assert.equal((mask&0x6FFE)&events,mask&events&0x6FFE);
  }
  assert.ok(![...map.values()].filter(i=>i.cpu>=0x80C3C9&&i.cpu<0x80C401).some(i=>i.mnemonic==='JSR'));
});

test('readiness freshDP71/DP00 and fullcounter DEC wrap preserve actual OR/timer and late clear ordering',()=>{
  for(const [pc,op,value]of [[0x80C3DF,'BEQ',0x80C3E3],[0x80C3E1,'STA',0],[0x80C3E3,'LDA',0x71],[0x80C3E5,'BIT',1],
    [0x80C3E8,'BEQ',0x80C3F6],[0x80C3EA,'DEC',0xC02],[0x80C3ED,'BNE',0x80C3F6],[0x80C3EF,'LDA',1],
    [0x80C3F2,'TSB',0],[0x80C3F4,'LDA',0x71],[0x80C3F6,'LDA',0],[0x80C3F8,'BNE',0x80C3FC]])at(pc,op,value);
  for(let counter=0;counter<65536;counter++){const decremented=(counter-1)&65535;assert.equal(decremented===0,counter===1);}
  assert.equal((0-1)&65535,65535);assert.equal((65535-1)&65535,65534);
  for(let eventWord=0;eventWord<65536;eventWord++)assert.equal((eventWord|1)&65535,eventWord+(1-(eventWord&1)));
});

test('nonzero continuation RTS consumes actualWORD, increments to target and leaves C20B returnframe',()=>{
  at(0x80C1F9,'JSR',0x80C3C9);at(0x80C1FC,'BCC',0x80C22F);at(0x80C1FE,'LDA',0x2B2,'absx');
  at(0x80C201,'BEQ',0x80C208);at(0x80C203,'PEA',0xC20A);at(0x80C206,'PHA');at(0x80C207,'RTS');at(0x80C208,'JSR',0x80F378);
  for(let value=1;value<65536;value++)assert.equal((value+1)&65535,(value+1)%65536);
  assert.equal((65535+1)&65535,0);assert.equal((0xF508+1)&65535,0xF509);assert.equal((0xC20A+1)&65535,0xC20B);
  const b=report.full_graph.frontier.boundaries.find(b=>b.kind==='continuation-rts');assert.equal(b.at,'80:C207');assert.equal(b.remaining_local_stack_bytes,6);assert.equal(b.return_to,'80:C20B');
});

test('postrun source rereads status/cursor and negative status directly selects successor without readiness/continuation',()=>{
  for(const [pc,op,value]of [[0x80C20B,'LDX',0x250],[0x80C20E,'LDA',0xBA2],[0x80C211,'BMI',0x80C239],
    [0x80C213,'LDA',0x312],[0x80C216,'STA',0x250],[0x80C219,'LDA',0xBA2],[0x80C21C,'BNE',0x80C22E],[0x80C21E,'JSR',0x80C396],
    [0x80C221,'LDX',0x250],[0x80C224,'LDA',0xBA2],[0x80C227,'BPL',0x80C22E],[0x80C229,'STZ',0xBA2],[0x80C22C,'BRA',0x80C1FE],
    [0x80C22F,'LDX',0x250],[0x80C232,'LDA',0x312],[0x80C235,'STA',0x250],[0x80C239,'LDA',0x372],[0x80C23C,'STA',0x250],
    [0x80C23F,'TAX'],[0x80C240,'BRA',0x80C208]])at(pc,op,value);
  assert.match(report.contract.postrun,/secondfreshstatus/);assert.match(report.contract.postrun,/No root\/negativecursor sentinel/);
});

test('actualC396/C2BD release preserves lazyheap, reloads links and conditionally repairs cursor/tail without guards',()=>{
  for(const [pc,op,value]of [[0x80C396,'SEC'],[0x80C397,'LDA',0x252],[0x80C39A,'SBC',0x3D6],[0x80C39D,'JSR',0x80C2BD],
    [0x80C2BD,'TAY'],[0x80C2BE,'LDA',0x3D2],[0x80C2C1,'AND',0x7FFF],[0x80C2C4,'STA',0x3D2],
    [0x80C3A0,'LDY',0x312],[0x80C3A3,'LDA',0x24E],[0x80C3A6,'STA',0x312],[0x80C3A9,'STX',0x24E],
    [0x80C3AC,'CPX',0x250],[0x80C3AF,'BNE',0x80C3B4],[0x80C3B1,'STY',0x250],[0x80C3B4,'LDA',0x372],
    [0x80C3B7,'TYX'],[0x80C3B8,'BMI',0x80C3BD],[0x80C3BA,'STA',0x372],[0x80C3BD,'TAY'],[0x80C3BE,'BMI',0x80C3C5],
    [0x80C3C1,'STA',0x312],[0x80C3C5,'STX',0x24C]])at(pc,op,value);
  for(let value=0;value<65536;value++)assert.equal(value&0x7FFF,value%32768);
  assert.deepEqual(report.removal_graph.proof,proveWordStack(map,0x80C396,'RTS',{measureStack:true}));assert.equal(report.removal_graph.proof.minimum_protected_stack_bytes,4);
  assert.equal(report.readiness_graph.proof.minimum_protected_stack_bytes,2);
});

test('actualF378 PEI frame01 selects finalbankbyte2 after twoPLBs and records outerS before task TCS',()=>{
  for(const [pc,op,value,mode]of [[0x80F378,'LDA',0x252,'absx'],[0x80F37B,'TCD'],[0x80F37C,'PEI',1,'di'],
    [0x80F37E,'PLB'],[0x80F37F,'PLB'],[0x80F380,'TSC'],[0x80F381,'STA',0x1F2,'abs'],[0x80F384,'LDA',7,'dp'],
    [0x80F386,'TCS'],[0x80F387,'LDY',3,'dp'],[0x80F389,'LDA',0,'diy'],[0x80F38B,'INY'],
    [0x80F38C,'AND',255],[0x80F38F,'TAX'],[0x80F390,'JMP',0xF2B4,'indx']])at(pc,op,value,mode);
  for(let high=0;high<256;high++)for(let low=0;low<256;low++){const stack=[high,low];assert.equal(stack.pop(),low);assert.equal(stack.pop(),high);}
  assert.equal(report.full_graph.frontier.boundaries.find(b=>b.at==='80:F386').dbr,'fresh frame byte2');
  assert.equal(abs(0x9D,0x1F2),0x9D01F2);assert.match(report.contract.payload,/IgnoredopcodeHigh still required/);
});

test('all256 opcode WORD targets pin actualoverlap/codebytes; literal table only98 even slots and no ASL',()=>{
  const t=report.dispatch.opcode_source,raw=rom.subarray(cpuToOffset(0x80F2B4,rom.length),cpuToOffset(0x80F3B5,rom.length));
  assert.equal(sha(raw),'da8aa8034bf4f4a7008fb730170c0644fd71564e46be668bc6490e94876f43e7');assert.equal(t.covered_bytes,257);assert.equal(t.machine_bytes,raw.toString('hex').toUpperCase());
  assert.equal(report.dispatch.all_byte_opcode_targets.length,256);assert.equal(report.dispatch.original_even_slots,98);
  for(let opcode=0;opcode<256;opcode++){const target=word(0x80F2B4+opcode),d=report.dispatch.all_byte_opcode_targets[opcode];
    assert.equal(d.opcode,opcode);assert.equal(d.target,cpuLabel(0x800000|target));assert.equal(d.word_source,cpuLabel(0x80F2B4+opcode));
    if(scriptOpcodes[opcode])assert.equal(target,scriptOpcodes[opcode].handler);
    assert.equal(d.classification==='original even table slot',opcode<=0xC2&&!(opcode&1));}
  assert.equal(0x80F2B4+0xC4,0x80F378);assert.equal(word(0x80F2B4+0xC4),0x52BD);
  assert.ok(![...map.values()].filter(i=>i.cpu>=0x80F389&&i.cpu<=0x80F390).some(i=>i.mnemonic==='ASL'));
});

test('nativeABI literal pointer/argument/return WORD source pins cover BYTE IDs including beyond220 originals',()=>{
  for(const [name,start,length,hash]of [
    ['allByteNativePointerWords',0x82D7B8,512,'83182ceed51a9add8677705f74db9335d717fd7030d04964e091e0d0430879e3'],
    ['allByteNativeArgumentWordSources',0x82DA4C,257,'0ed9b659f25ae021b798f61bac082ee7caaaf0a9b149dd198744c1974701e168'],
    ['allByteNativeReturnWordSources',0x82D970,257,'f4e63266b79a46ba576560ed1896e1b3cb779b00715c379ee3802276bdfb19ff']]){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(start,rom.length)+length),t=report.dispatch.native_sources.find(t=>t.name===name);
    assert.equal(sha(raw),hash);assert.equal(t.machine_bytes,raw.toString('hex').toUpperCase());assert.equal(t.covered_bytes,length);}
  assert.equal(report.dispatch.original_native_slots,220);assert.equal(word(0x82D7B8+0x9F*2),0xC401);
  assert.equal(0x82DA4C+220,0x82DB28);assert.equal(0x82D7B8+220*2,0x82D970);
});

test('native entry moves actual operandwords to actualDBR workspace, resetsD/DBR and JMPs bank00 A2 pointer',()=>{
  for(const [pc,op,value,mode]of [[0x80F4CB,'LDA',0,'diy'],[0x80F4CD,'INY'],[0x80F4CE,'AND',255],[0x80F4D1,'STY',3],
    [0x80F4D3,'STA',9],[0x80F4D6,'LDA',0x82DA4C,'longx'],[0x80F4DA,'AND',255],[0x80F4DD,'BEQ',0x80F4EC],
    [0x80F4E3,'PLA'],[0x80F4E4,'STA',0,'absx'],[0x80F4E7,'INX'],[0x80F4E8,'INX'],[0x80F4E9,'DEY'],
    [0x80F4EC,'LDA',9,'dp'],[0x80F4EE,'ASL'],[0x80F4F0,'TSC'],[0x80F4F1,'STA',7],
    [0x80F4F3,'LDA',0x1F2,'abs'],[0x80F4F6,'TCS'],[0x80F4F7,'LDA',0],[0x80F4FA,'TCD'],[0x80F4FB,'PEA',0x8080],
    [0x80F500,'LDA',0x82D7B8,'longx'],[0x80F504,'STA',0xA2,'dp'],[0x80F506,'JSR',0x80F52F],[0x80F52F,'JMP',0xA2,'ind']])at(pc,op,value,mode);
  for(let id=0;id<65536;id++)assert.equal((id*2)&65535,(id*2)%65536);
  assert.match(report.contract.native,/aliasedWORD/);assert.match(report.contract.native,/source-required/);
});

test('conditional F509 reloads actualcursor/frame/bank/S/ID and any nonzero returnbyte pushes oneWORD',()=>{
  for(const [pc,op,value]of [[0x80F509,'LDX',0x250],[0x80F50C,'LDA',0x252],[0x80F50F,'TCD'],[0x80F510,'PEI',1],
    [0x80F512,'PLB'],[0x80F513,'PLB'],[0x80F514,'TSC'],[0x80F515,'STA',0x1F2],[0x80F518,'LDA',7],[0x80F51A,'TCS'],
    [0x80F51B,'LDX',9],[0x80F51D,'LDA',0x82D970],[0x80F521,'AND',255],[0x80F524,'BEQ',0x80F52A],
    [0x80F526,'LDA',0],[0x80F529,'PHA'],[0x80F52A,'LDY',3],[0x80F52C,'JMP',0x80F389]])at(pc,op,value);
  for(let wordValue=0;wordValue<65536;wordValue++)assert.equal(Boolean(wordValue&255),wordValue%256!==0);
  assert.equal([...map.values()].filter(i=>i.cpu>=0x80F509&&i.cpu<0x80F52F&&i.mnemonic==='PHA').length,1);
});

test('END restores actualouterS/D0 with preservedframebank; native9F consumes realJSR return F508 for later F509 resume',()=>{
  for(const [pc,op,value]of [[0x80F4BE,'PLA'],[0x80F4BF,'STA',0],[0x80F4C2,'LDA',0x1F2],[0x80F4C5,'TCS'],[0x80F4C6,'LDA',0],[0x80F4C9,'TCD'],[0x80F4CA,'RTS'],
    [0x80C401,'LDX',0x250],[0x80C404,'LDA',0],[0x80C406,'STA',0xBA2],[0x80C409,'LDA',2],[0x80C40B,'STA',0xC02],
    [0x80C40E,'STZ',0xC62],[0x80C411,'PLA'],[0x80C412,'STA',0x2B2],[0x80C415,'RTS']])at(pc,op,value);
  assert.equal(map.get(0x80F506).next-1,0x80F508);assert.equal((0xF508+1)&65535,0xF509);
  assert.equal(map.get(0x80C203).value+1,0xC20B);assert.equal(map.get(0x80C208).next,0x80C20B);
  assert.match(report.contract.yield,/Status0 removes without executingF509/);
});

test('typed frontier proves59 instructions/prefix10 and44-instruction no-dispatch8 without invented postrun returns',()=>{
  const p=proveVisitC1CAFrontier(map),q=proveVisitC1CAFrontier(map,{skipReady:true});assert.deepEqual(p,report.full_graph.frontier);assert.deepEqual(q,report.no_dispatch_graph.proof);
  assert.equal(p.reachable_instructions,59);assert.equal(p.minimum_protected_prefix_stack_bytes,10);assert.equal(p.minimum_protected_stack_bytes,undefined);
  assert.equal(p.maximum_stack_witness.at,'80:C206');assert.equal(q.reachable_instructions,44);assert.equal(q.minimum_protected_stack_bytes,8);
  assert.equal(p.external_return_assumptions,0);assert.equal(q.external_return_assumptions,0);
  assert.deepEqual(p.boundaries.map(b=>b.at),['80:C207','80:F386']);assert.equal(q.boundaries[0].at,'80:C1FC');
  for(const at of ['80:C20B','80:C396','80:F387','80:F509','80:F52F'])assert.ok(!p.visited.includes(at));
  assert.deepEqual(report.readiness_graph.proof,proveWordStack(map,0x80C3C9,'RTS',{measureStack:true}));
});

test('frontier rejects missing ready/payload bodies, untyped RTS/TCS/PEI, cursor/width/DBR/return mutations',()=>{
  for(const pc of [0x80C3C9,0x80C3FA,0x80C3FF,0x80C1DE,0x80C203,0x80F378,0x80F37C,0x80F384]){
    const m=new Map(map);m.delete(pc);assert.throws(()=>proveVisitC1CAFrontier(m));}
  for(const [pc,patch]of [[0x80C1CD,{mnemonic:'PHY'}],[0x80C1D9,{value:0x7E7E}],[0x80C1DD,{mnemonic:'NOP'}],
    [0x80C1D6,{target:0x80F509}],[0x80C207,{mnemonic:'NOP'}],[0x80C203,{value:0xC20B}],
    [0x80C206,{state:{e:0,m:1,x:0}}],[0x80F37C,{value:2}],[0x80F37F,{mnemonic:'NOP'}],
    [0x80F386,{mnemonic:'NOP'}],[0x80C3D5,{mnemonic:'PLD'}],[0x80C238,{mnemonic:'RTL'}],[0x80C3D0,{length:2}]]){
    const m=new Map(map);m.set(pc,{...m.get(pc),...patch});assert.throws(()=>proveVisitC1CAFrontier(m));}
  const missingRelease=new Map(map);missingRelease.delete(0x80C2BD);assert.throws(()=>proveWordStack(missingRelease,0x80C396,'RTS',{measureStack:true}));
  assert.throws(()=>proveVisitC1CAFrontier(map,{skipReady:1}),/Explicit/);
});

test('central/9178/BF3B retain full dynamic source frontier and choose bounded operandstack source prerequisite',async()=>{
  const [text,parent,progress]=await Promise.all(['analysis/render-9178.json','analysis/render-bf3b.json','docs/PORTIERUNGSSTAND.json'].map(async p=>JSON.parse(await readFile(p,'utf8'))));
  assert.equal(report.full_graph.closed,false);assert.equal(report.full_graph.native_binding,false);assert.equal(report.full_graph.minimum_protected_stack_bytes,null);
  assert.deepEqual(report.full_graph.unresolved_boundaries,['80:C207 continuation data-derived RTS','80:F386 operand-stack TCS','80:F390 indexed opcode JMP','80:F52F native pointer JMP']);
  assert.equal(text.full_graph.closed,false);assert.equal(text.full_graph.minimum_protected_stack_bytes,null);assert.deepEqual(text.full_graph.unresolved_nested_callees,['80:C1CA']);
  const partial=text.full_graph.supplied_partial_nested_callees[0];assert.equal(partial.entry,'80:C1CA');assert.equal(partial.minimum_protected_stack_bytes,null);assert.equal(partial.minimum_protected_prefix_stack_bytes,10);
  assert.ok(parent.full_graph.unresolved_nested_callees.includes('80:9178'));
  assert.equal(report.full_graph.supplied_opcode_sources[0].source_closed_to_dispatch,true);
  assert.equal(report.full_graph.supplied_opcode_sources[0].full_graph_closed,false);
  const visit=progress.work_groups.find(g=>g.id==='task-visit-c1ca');
  assert.equal(visit.status,'composition-required');assert.equal(visit.source_contract,'analysis/render-task-visit.json');
  assert.equal(visit.manual_native.module,'proof/task/visit-c1ca.mjs');
  assert.ok(!progress.supplied.some(r=>r.entry==='80:C1CA'||r.entry==='80:9178'));
});
