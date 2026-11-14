import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRenderEF47Source, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {roots, callers, reused, ownerBlocks, graphBlocks, map, proofs} = proveRenderEF47Source(bytes);
const address = label => parseInt(label.replace(':',''),16);
const audio = JSON.parse(await readFile('analysis/render-audio.json','utf8'));
if (audio.rom_sha256 !== metadata.rom_sha256) throw Error('Audio revision drift');
const keep = new Set(['samplesF130','repeatWordF1E8','subtractLengthF100','sendWordF122','sendPairF03A','apuF007']);
const reusedWindows = audio.windows.filter(w => keep.has(w.name));
if (JSON.stringify(reusedWindows) !== JSON.stringify(reused.map(describe))) throw Error('EF47 audio dependency drift');
const ownerWindows = audio.windows.filter(w => ['directoryLoaderF092','selectedInitEF63'].includes(w.name));
if (JSON.stringify(ownerWindows) !== JSON.stringify(ownerBlocks.map(describe))) throw Error('EF47 audio owner drift');
const table = (name,entry,length,qualification) => {
  const offset = cpuToOffset(entry,bytes.length), raw = bytes.subarray(offset,offset+length);
  return { name,entry:cpuLabel(entry),covered_bytes:length,sha256:createHash('sha256').update(raw).digest('hex'),
    machine_bytes:raw.toString('hex').toUpperCase(),qualification };
};
const tables = [table('selectedDialogModes94E8',0x8094E8,256,
  'Original bytes at the actual selected DBR80 caller base, including overlap with caller code; masked7F header selects0..127 here only. No general EF47 selector cap or initialized scene.'),
  table('selectedModePairs9FFF0A',0x9FFF0A,9,
    'Selected original pair bytes0238/0537/0639/0C38 and zero terminator BYTE. Header94 from selected9FFEAC; not a general loop bound or pointer initialization.')];
const directorySources = audio.tables.filter(t => ['selectedDirectoryPointer98FFFA','selectedDirectory9FFEAC'].includes(t.name));
for (const t of directorySources) {
  const current = table(t.name,address(t.entry),t.covered_bytes,t.qualification);
  if (JSON.stringify(current) !== JSON.stringify(t)) throw Error('Original directory data drift');
}
const scan = pattern => {
  const out = [];
  for (let offset=0;offset<=bytes.length-pattern.length;offset++) if (pattern.every((v,i) => bytes[offset+i]===v))
    out.push(cpuLabel(((0x80+Math.floor(offset/0x8000))<<16)|0x8000|(offset&0x7FFF)));
  return out;
};
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope:'Complete EF47/F25A/F1FA and every actual local audio callee, with selected936C/AC/A4BF callers and original pointer owner separate. Structural source/stack only; no CPU/device/clock/scene/frame execution.',
  windows:[...roots,...callers].map(describe),dependencies:[{report:'analysis/render-audio.json',windows:reusedWindows}],
  full_graph:{closed:true,code_bytes:graphBlocks.reduce((n,b)=>n+describe(b).covered_bytes,0),instructions:map.size,
    proof:proofs[0],helper_proofs:proofs.slice(1),native_binding:true,actual_termination_proven:false,
    calls:[...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({from:cpuLabel(i.cpu),kind:i.mnemonic,to:cpuLabel(i.target)}))},
  native_composition:{entry:'81:EF47',module:'proof/render/mode-ef47.mjs',probe:'analysis/render-ef47-native.json',
    accumulator_bytes:2,index_bytes:2,minimum_protected_stack_bytes:22,native_binding:true,
    qualification:'Manual atomic composition only; full first WORD cache store and real F25A plus two fixed F007 commands, shared view/global polls/budgets and one outer commit. Original AC/dialog/transition callers and initialization remain open.'},
  tables,selected_owners:{report:'analysis/render-audio.json',windows:ownerWindows,tables:directorySources,
    qualification:'Real F092 pointer stores and selectedEF63 DBR80/index0 initialization source only. EF63 F229 boot return and original lifecycle remain open; this block does not initialize DP8C.'},
  contract:{
    entry:'EF47 E0/M0/X0, D0000, binary, actual DBR and WORDA;22 protected stackbytes including rootJSL3, intact disjoint code/stack/data and no foreign interference. F25A saves/restores M0 or M1 with WORDX;19 protected bytes. Actual F1FA caller uses BYTEA/WORDX;15 protected bytes.',
    ef47:'First WORDSTA actualDBR1CDE gets the full entryA, even when lowA0. Then realF25A. On actualreturn fixedWORD A000D/X2020 -> F007, then A0002/X7F7F -> F007. ReturnWORDA=0200|lastnextToken, X7F7F, Y actualF25A result, entryDBR/D retained; P=entryP withN/Z cleared because finalLDA2/LDX7F7F and saved-statusF007. No fabricated Y, token, APUack or global dialog return.',
    f25a:'PHP/REP10/SEP20 then BYTEPHA preserves only low inputA across unconditional F007 command04/X0. BYTEPLA/BEQ tests only that lowbyte; fullWORD1CDE cache already stored byEF47 remains separate. Zero path skipsF1FA/F130/finalmodehandshake, returns A0400/X0/Yentry and originalP. Nonzero: realJSRF1FA; REP20/AND00FF/WORDPHA/EORFFFF/CLC/ADC8100 givesWORD80FF-modeByte, then realF130. WORDPLA restores that saved selectorbyte, ORA0100/TAX, SEP20/A04/F007, PLP/RTL. ReturnA=0400|nextToken, X0100|savedmodeByte, Y actuallastF130 result, fullentryP/DBR restored.',
    f1fa:'BYTESTA actualDBR1CE5 beforePHP; LDY0/REP20 reads freshlong[DP8C],Y headerWORD thenTAY. LoopSEP20/freshBYTE[DP8C],Y: zero exits before cacheCMP or nextbyte read. Otherwise WORDINY precedes freshBYTECMPactualDBR1CE5. Mismatch skips loader but still secondWORDINY. Match LDA80/XBA then freshBYTE[DP8C],Y; REP20 formsWORD8000|sampleByte, PHY/JSLF130/PLY/SEP20. SecondWORDINY then BRAloop; matches do not stop scanning, duplicates cause repeated realF130 calls. WORDY wraps; no capacity, alignment, cached record or termination inferred. PLP then freshLDAactualDBR1CE5/RTS returnsBYTE modeword withN/Z from freshcacheBYTE, C/V/I from savedentryP, actualX, terminalY, entryDBR.',
    freshness:'DP8C..8E remains the actual pointer source at every long read; freshheader/table/cache and loader bytes share caller-owned memory. F130 fixed DP stores do not explicitly write8C..8E; its 8A WORDstore ends at8B. Transitive absolute stores do not explicitly write1CE5, but finalcache reload remains fresh and mapping/interference ownership is still required. Different BYTE/WORD widths and aliases cannot be replaced by independent snapshots.',
    audio:'All real F130/F100/F122/F1E8/F03A/F007 paths included with actual mixed-width frames. Existing global BYTE2140 observations and native request/budget/view contracts remain prerequisites. Structural22/19/15-byte proofs do not prove directory/payload termination, device acknowledgement, sample completion, audio output or interrupt/frame chronology.',
  },
  selected_callers:{
    dialog:'80:939B headerAND7F/zero skips selection; fresh1FD6 bit0 gate; fresh01BA AND7F/ASL/TAY -> actualDBR94E8+Y WORD, freshCMP1CDE. Unequal caches freshLDY1CDE/PHY thenJSLEF47; otherwisePEAFFFF. This savedWORD remains for later80:94E2 PLA; negative skips restore, nonnegative JSLEF47. PHY word is eventually consumed by PLA; full936C stack/control and interveningcallee effects remain open.',
    other:'Instruction-pinned JSL80:8559 AC and80:A580 A4BF. Native AC audio boundary and complete transition caller are still open; the new source proof supplies neither caller integration nor automatic execution.',
    scan:{raw_jsl_candidates:scan([0x22,0x47,0xEF,0x81]),qualification:'Raw ROM bytepattern hints only. Four selected instruction-validated calls; no indirect/reachability/allcallsite proof.'},
  },
  native_prerequisites:[{entry:'81:F1FA',module:'proof/render/mode-f1fa.mjs',probe:'analysis/render-f1fa-native.json',
    accumulator_bytes:1,index_bytes:2,minimum_protected_stack_bytes:15,native_binding:true,
    qualification:'Manual atomic prerequisite only; native F25A supplied separately; native EF47 composition supplied under22 protected stackbytes; original callers remain open.'},
    {entry:'81:F25A',module:'proof/render/mode-f25a.mjs',probe:'analysis/render-f25a-native.json',
      accumulator_bytes:[2,1],index_bytes:2,minimum_protected_stack_bytes:19,native_binding:true,
      qualification:'Manual atomic WORD/BYTE mode composition only; native EF47 composition supplied under22 protected stackbytes; original callers remain open.'}],
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-ef47.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-ef47.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete EF47/F25A/F1FA and actualcallees, selectedcallers/owners separate. No CPU execution.\n\n`
  +[...graphBlocks,...callers,...ownerBlocks].map(formatBlock).join('\n'));
console.log(`EF47 full graph ${report.full_graph.code_bytes}/${map.size}; protected EF47/F25A/F1FA ${proofs[0].minimum_protected_stack_bytes}/${proofs[1].minimum_protected_stack_bytes}/${proofs[3].minimum_protected_stack_bytes}; native F1FA/F25A supplied; native EF47 supplied; original caller binding remains OPEN.`);
