import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRender905ESource, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, helper, increment, caller, map, proof, incrementProof} = proveRender905ESource(bytes);
const gate = JSON.parse(await readFile('analysis/render-a98e.json', 'utf8'));
const selectedHelper = describe(helper);
const selectedIncrement = gate.windows.find(w => w.name === increment.name);
if (gate.rom_sha256 !== metadata.rom_sha256
  || JSON.stringify(selectedIncrement) !== JSON.stringify(describe(increment))) throw Error('905E dependency drift');
const candidates = [];
for (let p = 0; p < bytes.length - 2; p++) if (bytes[p] === 0x20 && bytes[p + 1] === 0x5E && bytes[p + 2] === 0x90)
  candidates.push(cpuLabel(((0x80 + Math.floor(p / 0x8000)) << 16) | 0x8000 | (p & 0x7FFF)));
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete905E source and both actual callees8FF5/A954, WORD/BYTE modes, actual DBR and typed stack. Selected936C caller separate. No CPU/device/clock/scene/frame execution.',
  windows: [root, helper, increment].map(describe),
  full_graph: { closed: true, code_bytes: 95, instructions: map.size, proof,
    calls: [{ from: '80:9067', to: '80:8FF5', kind: 'JSR' }, { from: '80:9087', to: '81:A954', kind: 'JSL' }],
    native_binding: true, actual_termination_proven: false,
    qualification: 'All local source edges/calls closed without external return assumptions. RootJSR2 plus maximum nestedJSL3 requires5 protected bytes, not simultaneous helperJSR2+JSL3. Fresh0140 signed wait needs an external writer; structural return is not actual wait/DMA/NMI/RTI or whole936C completion.' },
  increment_graph: { entry: '81:A954', code_bytes: 4, instructions: 2, proof: incrementProof, native_binding: true,
    actual_termination_proven: true, qualification: 'Finite INCWORD/RTL only under intact source/stack/memory. No counter initialization or original callback ordering inferred.' },
  dependencies: [{ report: 'analysis/render-9022.json', window: selectedHelper }, { report: 'analysis/render-a98e.json', window: selectedIncrement }],
  local: {
    edges: [...map.values()].filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    root_order: ['WORD00A1->actualDBR0142', 'X0800', 'JSR8FF5 publishesWORD0800 before fresh signed0140 polls',
      'WORD1A1A->fixedlong7E3D10', 'freshWORDactualDBR01BA', 'AND0080/XBA/WORDLSR/ORA3480',
      'WORD3480 or7480->fixedlong7E3D12', 'WORD0028->fixedlong7E3F08', 'JSLA954 freshWORDactualDBR1562 increment/store', 'RTS908B'],
    field_stores: [['7E:3D10',0x1A1A,2],['7E:3D12',[0x3480,0x7480],2],['7E:3F08',0x28,2]],
    selector: { source: 'actualDBR:01BA', width: 2, mask: 0x80, clear_value: 0x3480, set_value: 0x7480, shift_carry: 0 },
    bitmap_or_source_copy_bytes: 0,
  },
  contract: {
    entry: 'E0/M0/X0/D0000, binary arithmetic, actual DBR and5 protected stackbytes including rootJSR2 and maximum nestedJSL3. Incoming A/X overwritten before use; Y preserved locally. No DP read/write, DBR switch, PHP/PLP or buffer capacity assumption.',
    prefix: 'WORD00A1->actualDBR0142 then WORDX0800/JSR8FF5. Both metadata bytes written; later8FBA reads only0142 lowbyte. This is not9022 WORD0091/X0000.',
    helper: 'Exact shared8FF5: ordered WORD4305=1000/4302=5250, BYTE4304=7F/4301=18/2115=80/4300=01 at actualDBR, no420B start or transfer source reads. Then fullX0800->WORDactualDBR0140; only fresh LDAWORD0140/BPL polls decide return. All0000..7FFF including zero wait;8000..FFFF return. Prior negative0140 overwritten. 0800 cannot release its own unchanged wait; no automatic8FBA/callback writer or DMA/interrupt completion inferred.',
    fields: 'Only after actual8FF5 return, WORD1A1A->fixedlong7E3D10. Then freshWORDactualDBR01BA AND0080 gives0000/0080, XBA gives0000/8000, WORDLSR gives0000/4000 withC0, ORA3480 gives3480/7480->fixedlong7E3D12. All other selector bits ignored but both source bytes required. WORD0028->fixedlong7E3F08. Six scalar bytes, no complete records or palette/transfer hydration; other bytes preserved.',
    increment: 'JSLA954 at9087 reads/increments/stores freshWORDactualDBR1562, including highbyte1563 and WORDFFFF->0000 wrap. A stays0028, X0800/Y/DBR/C/V/I preserved by INC/RTL; N/Z derive from the incremented memoryWORD. A954 does not load that value intoA, restore P, trigger DMA or acknowledge completion. Standalone needs3 protected JSLbytes; full905E needs5.',
    return: 'RTS908B: A0028/X0800, Y/actualDBR/I/V preserved locally. C0 from WORDLSR of masked/swapped selector, independent of entryC and pollword. FinalN/Z from INCWORD1562 result, not A0028, selector or negative pollA; Z1 iff old1562=FFFF, N1 iff old1562 in7FFF..FFFE. M0/X0/D0; no whole entryP restoration.',
    freshness: 'Metadata/setup/0140/01BA/1562 use actualDBR; fixedlong fieldstores use7E. Systembank lowmemory uses the existing WRAM mirror;7E/7F setup offsets are actual physical WRAM, not IO requests. All actual aliases, stack/context, write windows, work/output budgets and chronological wait observations must share one native view. No original owner/initialization/frame binding from compatible manual bytes.',
    owners: 'A954 is the existing pinned1562 increment from A98E source. A98E later clearsWORD1562 after its own requests;8949/A919/A958 read the gate. These are not905E callees. Full01BA/1562 owner chronology and actual callback scheduling remain separate.',
  },
  caller: { report: 'analysis/render-bf3b.json', window: describe(caller), at: '80:9476', return_to: '80:9479',
    order: 'Actual9F6D then8F20 then905E return beforeJSR8F3A. No initial transferbuffer/whole936C or8F3A return proof inferred.',
    raw_jsr_candidates: candidates, qualification: 'Selected9476 instruction-validated; raw ROM bytepatterns only, no indirect/reachability/allcallsite proof.' },
  native_prerequisite: { entry: '81:A954', module: 'proof/render/gate-a954.mjs', minimum_protected_stack_bytes: 3,
    qualification: 'Native manual atomicA954 supplied separately: fresh actualDBR WORD1562 increment, preserved registers or explicit unknown, exact INC N/Z, cumulative work/output budgets and one outer commit. No original gate owner/initialization or callback/frame lifecycle inferred.' },
  native_composition: { module: 'proof/render/fields-905e.mjs', minimum_protected_stack_bytes: 5,
    qualification: 'Native manual atomic905E supplied separately: actual8FF5/X0800 with chronological0140 observations, fixed fields/fresh01BA, actualA954/fresh1562 INC flags; shared work/output budgets and one outer commit. No actual interrupt/wait/DMA completion or original936C/BF3B initialization/frame binding inferred.' },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-905e.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-905e.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete905E and actual8FF5/A954 callees; selected936C caller separate. Actual0140 wait completion unproved. No CPU execution.\n\n`
  + [root, helper, increment, caller].map(formatBlock).join('\n'));
console.log(`905E46/16; closed graph95/${map.size}, stack${proof.minimum_protected_stack_bytes}; nativeA954/905E supplied; wait/original caller binding OPEN; next8F3A source.`);
