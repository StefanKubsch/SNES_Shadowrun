import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode,formatBlock} from './disassemble.mjs';
import {proveAppendC34AStack} from './render-c34a-stack-proof.mjs';
const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const sha=b=>createHash('sha256').update(b).digest('hex');
function block(name,entry,end){
  const instructions=[];let state={e:0,m:0,x:0};
  for(let pc=entry;pc<end;){const i=decode(bytes,pc,state);if(i.next>end)throw Error('Window overflow');instructions.push(i);pc=i.next;
    if(['REP','SEP'].includes(i.mnemonic)){if(i.value&32)state.m=Number(i.mnemonic==='SEP');if(i.value&16)state.x=Number(i.mnemonic==='SEP');}}
  return {name,entry,initialState:{e:0,m:0,x:0},instructions,stop:'Complete fixed-callee source; no machine execution or assumed callee returns.'};
}
const describe=b=>{const raw=Buffer.concat(b.instructions.map(i=>i.raw));return {name:b.name,entry:cpuLabel(b.entry),end_exclusive:cpuLabel(b.instructions.at(-1).next),covered_bytes:raw.length,instruction_count:b.instructions.length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const windows=[block('appendC34A',0x80C34A,0x80C366),block('frameC2C8',0x80C2C8,0x80C34A),block('heapC242',0x80C242,0x80C2BD)];
const excerpts=[block('caller9178',0x8091CA,0x8091D7),block('initializeC1A6',0x80C1A6,0x80C1CA)];
const map=new Map(windows.flatMap(b=>b.instructions.map(i=>[i.cpu,i])));
// Match every older split source slice against this complete decode. The old
// slices supply no transitive return proof; they remain independently owned.
const dependencies=[];
for(const path of ['analysis/task-heap.json','analysis/task-frames.json']){
  const owner=JSON.parse(await readFile(path,'utf8'));if(owner.rom_sha256!==metadata.rom_sha256)throw Error('Task ROM drift');
  const slices=owner.source_blocks.filter(w=>{
    const pc=parseInt(w.entry,16);return map.has(pc)||pc===0x80C1A6;
  });
  for(const w of slices){let pc=parseInt(w.entry,16),raw='';
    while(raw.length<w.machine_bytes.length){const i=map.get(pc)??excerpts[1].instructions.find(i=>i.cpu===pc);if(!i)throw Error('Uncovered older slice');raw+=i.raw.toString('hex').toUpperCase();pc=i.next;}
    if(raw!==w.machine_bytes)throw Error('Task slice drift');}
  dependencies.push({report:path,source_blocks:slices});
}
const text=JSON.parse(await readFile('analysis/render-9178.json','utf8'));
if(text.rom_sha256!==metadata.rom_sha256||text.excerpts.find(w=>w.name==='appendC34A').machine_bytes!==describe(windows[0]).machine_bytes)throw Error('9178 append drift');
const profiles=JSON.parse(await readFile('assets/task-frame-profiles.json','utf8'));
if(profiles.romSha256!==metadata.rom_sha256||profiles.profiles.length!==937)throw Error('Task profile drift');
const headerEvidence=[];
for(const p of profiles.profiles){
  const bankWord=bytes.readUInt16LE(cpuToOffset(0x82DB28+p.id,bytes.length));
  const argumentBytes=bytes.readUInt16LE(cpuToOffset(0x82E9CC+p.id,bytes.length))&255;
  const headerAddress=bytes.readUInt16LE(cpuToOffset(0x82DED1+p.id*2,bytes.length));
  const headerCpu=(bankWord&255)*65536+headerAddress,off=cpuToOffset(headerCpu,bytes.length);
  if(p.bankWord!==bankWord||p.headerAddress!==headerAddress||p.argumentBytes!==argumentBytes||p.localBytes!==bytes[off]||p.stackHeaderBytes!==bytes[off+1])throw Error('Original profile mismatch');
  headerEvidence.push({id:p.id,entry:cpuLabel(headerCpu),machine_bytes:bytes.subarray(off,off+2).toString('hex').toUpperCase()});
}
const table=(name,entry,length)=>{const off=cpuToOffset(entry,bytes.length),raw=bytes.subarray(off,off+length);return {name,entry:cpuLabel(entry),covered_bytes:length,sha256:sha(raw),machine_bytes:raw.toString('hex').toUpperCase()};};
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Complete C34A/C2C8/C242 fixed-callee source for actual9178 caller. Static control/mode/DBR/stack and original profile/heap/argument/exhaustion contract; native9178 and C1CA dynamic dispatch separate. No CPU/device/time/interrupt/scene/frame execution.',
  windows:windows.map(describe),excerpts:excerpts.map(describe),dependencies,
  full_graph:{closed:true,native_binding:false,actual_termination_proven:false,code_bytes:windows.reduce((n,b)=>n+describe(b).covered_bytes,0),instructions:map.size,proof:proveAppendC34AStack(map)},
  frame_graph:{closed:true,native_binding:false,actual_termination_proven:false,proof:proveAppendC34AStack(map,0x80C2C8)},
  heap_graph:{closed:true,native_binding:false,actual_termination_proven:false,proof:proveAppendC34AStack(map,0x80C242)},
  local:windows.map(b=>({entry:cpuLabel(b.entry),calls:b.instructions.filter(i=>i.mnemonic==='JSR').map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target)})),edges:b.instructions.filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),returns:b.instructions.filter(i=>i.mnemonic==='RTS').map(i=>cpuLabel(i.cpu))})),
  profile_source:{asset:'assets/task-frame-profiles.json',profiles:937,
    tables:[table('bankWordSource',0x82DB28,938),table('pointerWords',0x82DED1,1874),table('argumentWordSource',0x82E9CC,938)],
    headers_sha256:sha(JSON.stringify(headerEvidence)),
    qualification:'All937 exact original profiles matched against actual WORD table reads and two BYTE header reads. Bank/argument sources include the extra highbyte of the last WORD. Actual caller actionWORD unrestricted; no937-ID clamp, profile asset does not cover out-of-range inputs or mutable source aliases.'},
  contract:{
    entry:'C34A and C2C8 E0M0X0/D0000, binary arithmetic, actual DBR, full incoming script ID inX. Intact source/stack disjoint from all effective stores, including failure continuations. All allowed operations preserve E/X/D/DBR; M returns0. No implied DBR80 or initialized heap/task/source bytes.',
    caller:'9178 restoredCarry1 reads fresh WORD viaDP11/Y toX, freshWORDDP26->DP00, JSR C34A then JSR C1CA. OnlyDP00 is explicitly refreshed here; other required argument words retain actual shared bytes. No visit inside C34A.',
    tables:'C2C8 reads fullWORD82DB28+X toDP73/74, fullWORD82E9CC+X AND00FF to actualDBR0248; TXA/ASL/TAX wraps index16 and reads fullWORD82DED1+wrapped(2*X) toDP71/72. DP73 is pointerbank, DP74 adjacent scratch. Longindex addition24bit, no ID clamp. Both highbytes required. Every pointer/source read fresh.',
    size:'LDA0000 beforeSEP20 clearsHighA. CLC; BYTE[$71] plusBYTE[$71]+Y1, thenADC17 retaining firstCarry. REP20 keepsHighA0; N=(((h0+h1)&FF)+17+carry(h0+h1))&FF. Store actualDBR0246 then realC242. Header names local/stack are existing host interpretation; actual byte arithmetic independently pinned.',
    heap:'C242 stores freshrequest024A, startsX0. Signed allocatedBit15 skips blocks viafresh03D4+X, zero next ends. Free size SEC/SBC024A, unsignedCarry selects fit. Too small: freshnextY0 returns actualdifference; allocatednext takes C24D; freenext ADC currentSize with failedSBC C0, thenADC4 with retained carry, writes mergedsize/link and retries. No alignment/cap/loop termination. Fit remainder0..4 marks originalsize; >=5 splits at X+request+4 with sequentialADCcarry, rereads freshsize/request and subtracts request then4 with sequentialSBCcarry, restores originalnext viaWORDPHA/PLA, marksrequest. Return actual A=(X+03D6)&FFFF; failure A0 or wrapped difference. Lazy merges persist on failure.',
    frame:'No success guard: C2F8 stores actualallocatorA asDP74/75. CLC/ADC0011 -> ($74),Y5; freshDP74 plus freshDBR0246 with retained carry from priorADC, DEC -> argumentcursor. LDY freshDBR0248: zero skips copy, otherwise TAX; freshWORD DBR:FFFE+Y, DEX then WORDSTAdp00+X in bank00, DEX/DEY/DEY/BNE, TXA. FullX/Ywrap, indexedDBR carry24bit versus dp indexed16bit bank00. Oddcount never reaches0 under intact count/register control; no invented cap. Fresh ($74),Y7 cursor store, freshDP71+2 WORDwrap ->($74); Y2 freshWORDDP73 ->($74),Y2; INY/Y3 then zeroWORD ->($74),Y3. DP74 store overwrites DP73 highbyte; later zero overlaps frame3/4. No clear of other payload or event bytes.',
    slots:'Only after frame writes: freshWORDDBR024E->X, BMI C349 for anynegativehead with A0/Y3. Otherwise STZDBR02B2+X/0BA2+X, freshWORDDBR0312+X->DBR024E, freshDP74->DBR0252+X. No slot-count/parity guard. Existing normalized48-slot model only describes initialized valid data.',
    append:'Always after C2C8 return, including eitherexhaustion: freshWORDDBR024C->DBR0312+X, FFFF->DBR0372+X, TXA preserves returnedX inA, freshDBR024C->X; negativeoldtail skips prior-successorstore, nonnegativeoldtail receivesA atDBR0372+X; A->DBR024C. Incoming scriptID not returned. Tail/read/output aliases fresh; Xatreturn is finaloldtail, Ais taskoffset, Y3 for intact pointers/control. FinalN/Z fromLDX024C; C/V from actualC305 ADC, not fixed success flags.',
    exhaustion:'Heapfailure does not exit framecaller. FailureA0 or wrappednegative difference addresses real subsequent frame/argument writes, which may alias scratch/heap/control data. Slotfailure only exitsC2C8: C34A still writes columns with fullnegativeX. For XFFFF stores start at actualDBR0312+FFFF and0372+FFFF (carry into nextbank, low0311/0371), not a valid slot. No failure sentinel, rollback or fabricated successful task. Static return proof requires all writes keep code/stack intact; data validity and terminating reads separately required.',
    host_boundary:'Existing createTaskHeap/createTaskFrameAllocator/appendRoot represent normalized initialized successful heap/slot/workspace data. They explicitly stop heap failure before unsupported framewrites (retaining actual merges), slotfailure after initialized orphan payload, odd/missing arguments and uncovered windows. Argumentworkspace abstraction requires actualDBR:FFFE+Y sources to correspond to explicit workspace bytes; DP00 refresh alone supplies only oneWORD. These APIs are no general DBR/scratch/alias/stack/native C34A binding and must not be substituted for real9178 machine return.',
    boundaries:'Fixed-callee source closed under explicit intact code/stack/binary/D0 premise. No allocator/list validity, data-loop/oddargument termination, payload initialization, native C34A/9178 composition, C1CA/C1F9 dynamicreturn, original936C/BF3B source closure or automatic frame/scene execution.'}};
await writeFile('analysis/render-c34a.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-c34a.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete append/frame/heap fixed-callee source, caller and initialization separate. No CPU execution.\n\n`+[...windows,...excerpts].map(formatBlock).join('\n'));
console.log(`C34A source ${report.full_graph.code_bytes}/${map.size}; protected stack ${report.full_graph.proof.minimum_protected_stack_bytes}/${report.frame_graph.proof.minimum_protected_stack_bytes}/${report.heap_graph.proof.minimum_protected_stack_bytes}; C1CA/native9178 separate.`);
