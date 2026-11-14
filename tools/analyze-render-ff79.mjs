import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRenderFF79Source, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, caller, reused, map, proof} = proveRenderFF79Source(bytes);
const previous = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
if (previous.rom_sha256 !== metadata.rom_sha256) throw Error('BE6D revision drift');
const reusedWindows = previous.dependencies.flatMap(d => d.windows).filter(w => w.name !== 'releaseBE5B');
if (JSON.stringify(reusedWindows) !== JSON.stringify(reused.map(describe))) throw Error('FF79 dependency drift');
const graph = {
  closed: true, code_bytes: [root, ...reused].reduce((n, b) => n + describe(b).covered_bytes, 0),
  instructions: map.size, proof, actual_termination_proven: false, native_binding: true,
  calls: [...map.values()].filter(i => ['JSR', 'JSL'].includes(i.mnemonic)).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
};
const rawCandidates = [];
for (let offset = 0; offset < bytes.length - 2; offset++) {
  if (bytes[offset] === 0x20 && bytes[offset + 1] === 0x79 && bytes[offset + 2] === 0xFF)
    rawCandidates.push(cpuLabel(((0x80 + Math.floor(offset / 0x8000)) << 16) | 0x8000 | (offset & 0x7FFF)));
}
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete FF79 source and every actual local callee; selected936C caller fragment separate. Structural WORD/DBR/stack graph closed without external return assumptions. No CPU/device/clock/scene/frame execution.',
  windows: [root, caller].map(describe), dependencies: [{ report: 'analysis/render-be6d.json', windows: reusedWindows }],
  full_graph: graph,
  local: {
    edges: root.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    order: ['X=6', 'fresh WORD fixed-long7E0216+X', 'signed-negative skip', 'DP00=slotword', 'PHX', 'JSR80FA3E', 'PLX', 'A=FFFF', 'WORD fixed-long7E0216+X=FFFF', 'DEX', 'DEX', 'BPL next visit', 'WORD actualDBR0200=0', 'RTS80FF97'],
    indices: [6, 4, 2, 0], maximum_release_calls: 4,
  },
  contract: {
    entry: 'E0/M0/X0, D0000, binary arithmetic, actual DBR; 28 protected stackbytes including root JSR2, disjoint code/source/write windows and no external interference. Incoming A/X/Y have no local precondition.',
    scan: 'Fresh fixed-long WORD7E0216+X at X6,4,2,0. Any negative WORD skips release and markerstore; 8000..FFFF all skip, not onlyFFFF. Every nonnegative WORD including0000 is passed unmasked to DP00 before PHX/FA3E/PLX. No capacity, even-buffer-index or validity bound inferred.',
    release: 'FA3E freshLDXDP00; WORDclear actualDBR0226+X before freshCPX0204. Equal-end path decrementsWORD X twice before signedgate, then freshflags scans backward; fixed-long7E2060+X gives0212, and X-2 gives0204. JSL81AD92 unconditional on both paths. AD92 really callsA9B2/9F49/9E9B/9E65/AF1F, conditionalACCF and finalACB5/ACAF; no returning summary substitutes any callee.',
    marker: 'Only after the real FA3E return does PLX restore the outer slotindex; LDAFFFF then fixed-long WORDstore7E0216+X. No all-slots preclear, and no cached later slotreads. PHX protects X only; neither Y nor A nor flags are restored from helper entry.',
    tail: 'After last X0 visit, two WORDDEX yield XFFFE/N1/Z0; signedBPL exits, then WORDSTZ actualDBR0200 and RTS. STZ does not loadA or changeflags. ReturnA is last freshly read negative slotword if skipped, otherwiseFFFF from the final marker; Y and C/V are actual prior callee results or entry values if allskip. E0/M0/X0/D0000 and entryDBR preserved; finalI retained. No fabricated constantA/Y/C/V.',
    ownership: 'Fixed7E slotwords and actualDBR0200 are distinct address families. DP00 shared with real allocation/release scratch. LocalFF79 does not explicitly clear0202 or021E lifetimewords; transitive indexed writes may alias caller data or future slotreads, so no whole-graph preservation inferred. OriginalAB2C slotinitializer is already supplied separately, no initializer/main/interrupt chronology inferred.',
    observations: 'Transitive AF1F arithmetic reads and ACB5/ACAF WORD01F8 waits retain existing explicit source/observation contracts. Stack/control closure proves neither wait progress nor data-loop termination, transfer completion or a dialog/frame lifecycle.',
  },
  caller: {
    source: 'analysis/render-bf3b.json', at: '80:938D', return_to: '80:9390',
    order: '936C previous886A/BCB2 returns conditional. SEP20/DP13=8D/REP20; freshDP02 ASLWORDwrap/TAY, freshactualDBR94F7+Y->DP11; freshDP26->Y; JSRFF79. After actual return LDY3/freshlong[DP11],Y/AND00FF->01BA/AND007F.',
    pointer: 'DP11..13 is constructed before FF79 and freshly dereferenced afterward; no automatic pointer preservation against arbitrary transitive indexed destinations or stackaliases. IncomingY fromDP26 is not saved by FF79; caller replacesY with3 after return.',
    scan: { raw_jsr_candidates: rawCandidates, qualification: 'Raw ROM bytepattern scan only; selected80:938D instruction-validated. No indirect/reachability/allcallsite proof.' },
    boundary: 'FF79 source graph and manual native atomic plan supplied separately. Full936C/BF3B caller graph and reset/source ownership remain open; no whole936C/BF3B stackminimum supplied. Current source/native work: docs/PORTIERUNGSSTAND.json.',
  },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-ff79.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-ff79.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; CompleteFF79 and actualcallees, selected936C caller separate. No CPU execution.\n\n` + [root, ...reused, caller].map(formatBlock).join('\n'));
console.log(`FF79 ${describe(root).covered_bytes}/${root.instructions.length}; full graph ${graph.code_bytes}/${map.size}, protected stack ${proof.minimum_protected_stack_bytes}; native supplied separately, original caller binding OPEN.`);
