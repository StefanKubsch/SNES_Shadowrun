import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRenderSelectionSource } from './render-menu-source.mjs';
import { describeRenderDialogBlock as describe } from './render-dialog-source.mjs';
import { verifyMenuSourceReports } from './render-menu-source-reports.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {roots, dependencies, map, reused, proofs, originalProofs, caller, codeBytes} = proveRenderSelectionSource(bytes);
await verifyMenuSourceReports(dependencies.filter(d => d.report !== 'analysis/render-a6a5.json'), metadata.rom_sha256, {allowTransitive: true});
const graph = (proof,b) => ({entry:cpuLabel(b.entry),conditional_graph_closed:true,full_reset_graph_closed:false,
  native_binding:true,actual_termination_proven:false,proof,original_sound_proof:originalProofs[roots.indexOf(b)],
  qualification:'Real transitive callee source followed without external return assumptions; normal-return path only. Fresh9E1A3030 reset excluded, actual source/transfer/counter/audio waits and original initialization remain open.'});
const tables = [['choices920D',0x80920D,8],['choiceTokens8D8000',0x8D8000,510]].map(([name,entry,length])=>{
  const raw=bytes.subarray(cpuToOffset(entry,bytes.length),cpuToOffset(entry,bytes.length)+length);
  return {name,entry:cpuLabel(entry),covered_bytes:length,sha256:createHash('sha256').update(raw).digest('hex'),machine_bytes:raw.toString('hex').toUpperCase(),
    qualification:'Original static table bytes only. 91E2 uses fixed bank80;9215 WORD token indices0..254 from lowbyte masked ID, sentinelFF excluded. No current scene list, flag initialization or text decoding evidence.'};
});
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Complete91E2/9215 roots and actual A6C7/F963/FA3E transitive source. Conditional normal-return BYTE/WORD/DBR/stack proof, full reset and actual termination open. Static tables and selected936C caller separate; no CPU/device/time/interrupt/scene/frame execution.',
  windows:roots.map(describe),dependencies,tables,caller:describe(caller),
  choice91e2_graph:graph(proofs[0],roots[0]),choice9215_graph:graph(proofs[1],roots[1]),
  conditional_graph:{code_bytes:codeBytes,instructions:map.size,proofs,original_sound_proofs:originalProofs,
    conditional_graph_closed:true,full_reset_graph_closed:false,native_binding:true,actual_termination_proven:false},
  local:roots.map(b=>({entry:cpuLabel(b.entry),
    calls:b.instructions.filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),
    edges:b.instructions.filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),
    returns:b.instructions.filter(i=>i.mnemonic==='RTS').map(i=>cpuLabel(i.cpu))})),
  contract:{
    entry:'E0/M0/X0/D0000, binary, actual entryDBR and disjoint intact source/stack. Full returning graph conditional on every reached9E1A fresh01CA not3030 and existing fixed nonzero-voice lemma. Native atomic91E2/9215 supplied separately under22/28 stackbytes; original callers and fullreset remain open.',
    choice91e2:'Fresh DP17->DP00; literal WORD DP02=2,04=4,06=3,08=920D,0A=0080 then actualA6C7. Fresh DP00 after return CMPFFFF; exactFFFF writes actual returnedDBR1D63 thenRTS. Other results do not write1D63 and keep DP00. No selection semantic inferred from labels.',
    table91e2:'Eight original bytes at80:920D: WORD7088/708C/7090/0000. Data excluded from root code; long pointer80:920D is explicit, not actual entryDBR. Menu paths/bytealiases may still affect scratch/output before return.',
    scan9215:'Fresh WORDfixed7E3CA3/3CA4 thenAND00FF, lowFF early writesFFFF->DP00/RTS without initializing X/Y. Otherwise X0/TXY. Each iteration fresh WORDfixedlong7E3CA3+X thenAND00FF/CMP00FF; sentinel ends collection. Store maskedID asWORDDP23, then fresh WORD7E3CD6+X AND00FF; nonzero skips token. Zero: PHX, freshDP23 ASLWORD/TAX, WORDfixed8D8000+X->actualDBR0154+Y,PLX,INYtwice. INX/BRA. X/Y are fullWORD and wrap independently; no invented33/51-item cap or BYTEread substitution. Every ignored highbyte is still required source. Fresh aliases can change future IDs/flags/DP23/list bytes.',
    empty9215:'At sentinel CPY0; exactzero writesFFFF->DP00/RTS, including YWORDwrap tozero after32768 accepted entries. Early/empty exits do not write1D63 or callF963/A6C7/FA3E. No complete record/buffer preclear.',
    allocation9215:'For Ynonzero WORDzero->actualDBR0154+Y terminates list. Literal DP00=6,02=15,04=14,06=11,08=0 then actualF963. Capacity-full does not abort caller: freshDP00->DP1A even if allocation did not initialize an output. Fresh shared byte effects remain real.',
    menu9215:'Then DP02=1,04=0,06=9,08=0154,0A=007E and actualA6C7. DP00 remains allocation result. Producer list uses actualDBR, consumer list fixed7E; manualDBR7F is not silently redirected or promoted to originalscene evidence.',
    release9215:'After actual menu return PEI00 saves two selectionbytes without loadingA or changing flags, freshDP1A->DP00 then actualFA3E unconditionally, including cancellation. No frozen pre-menu allocation variable substitutes DP1A. PLY restores savedselection intoY after realrelease. Source stack is balanced even if callee rewritesDP00/1A; aliasownership remains separate.',
    remap9215:'CPYFFFF: exactFFFF writes returnedDBR1D63 andDP00 viaSTY thenRTS with actualFA3E A/X retained. Otherwise X0 scans freshWORDfixed7E3CD6+X AND00FF; nonzero skipsDEY, zero decrementsWORDY, BMI alone choosesfirstnegative ->STXDP00/RTS. No identifier/sentinel read in this secondscan, no selected-index bound. Noncancel indices8000..FFFE follow actualDEY/sign/wrap and may not behave as small ordinal counts.',
    flags:'91E2 returns freshDP00 inA and CMPFFFF N/Z/C with V from menu. 9215 empty returnsAFFFF/N1/Z0/C1 with entryV; X/Y retained if firstsentinel, otherwise actualscan values. Cancellation afterrelease keeps releaseA/X, YFFFF, CPY C1/N0/Z1. Remap finalA0 fromflagAND, actualnegativeY (FFFF for ordinary0..7FFF ordinals), Xchosen, N1/Z0 fromDEY and C0 from prior CPYnonFFFF; STX doesnotloadA or changeflags. Confirmation forcesDBR80 through actualC46E; cancellation preserves entryDBR, laterFA3E preserves returnedDBR.',
    boundaries:'Actual source-list/flag initialization, transitive wait/MMIO/audio observations, resetE382, original936C/BF3B caller/stackaliases, and scene/frame binding are separate. Conditional typed closure proves no data loop termination, DMA/NMI/APU execution or successful fullreset. Native atomic91E2/9215 supplied separately under22/28 stackbytes with explicit inputs; no original caller or fullreset promotion.',
  },next:'Current next block and open work: docs/PORTIERUNGSSTAND.json.'};
await writeFile('analysis/render-selection.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-selection.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete91E2/9215 actual transitive source; normal9E1A only, fullreset/termination open. Tables are data, not code.\n\n`+[...roots,...reused,caller].map(formatBlock).join('\n')+'\n'+tables.map(t=>`; Data ${t.entry}, ${t.covered_bytes} bytes: ${t.machine_bytes}\n`).join(''));
console.log(`Selection roots ${roots.map(b=>describe(b).covered_bytes+'/'+b.instructions.length)}; source ${codeBytes}/${map.size}; normal stack ${proofs.map(p=>p.minimum_protected_stack_bytes)}; native91E2/9215 supplied; reset/termination open.`);
