import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRenderFA92Source, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, caller, owners, map, proof} = proveRenderFA92Source(bytes);
const be6d = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
if (be6d.rom_sha256 !== metadata.rom_sha256) throw Error('Source revision drift');
const parent = be6d.windows.find(w => w.name === 'allocateF963');
if (!parent) throw Error('Missing source parent');
const start = parseInt(parent.entry.replace(':', ''), 16), end = parseInt(parent.end_exclusive.replace(':', ''), 16);
for (const fragment of owners) {
  const data = describe(fragment), offset = (fragment.entry - start) * 2;
  if (fragment.entry < start || fragment.instructions.at(-1).next > end
    || parent.machine_bytes.slice(offset, offset + data.covered_bytes * 2) !== data.machine_bytes)
    throw Error('Selected source fragment drift');
}
const rawCandidates = [];
for (let offset = 0; offset < bytes.length - 2; offset++) if (bytes[offset] === 0x20 && bytes[offset + 1] === 0x92 && bytes[offset + 2] === 0xFA)
  rawCandidates.push(cpuLabel(((0x80 + Math.floor(offset / 0x8000)) << 16) | 0x8000 | (offset & 0x7FFF)));
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local FA92 source/control/WORD/DBR/stack contract, selected936C caller and F963 field writers separate. No CPU/device/clock/scene/frame execution.',
  windows: [root, caller].map(describe),
  full_graph: { closed: true, code_bytes: describe(root).covered_bytes, instructions: map.size, proof,
    calls: [], native_binding: true, actual_termination_proven: true,
    qualification: 'Finite acyclic root without callees or waits, under intact disjoint stack/code and valid data. No whole936C or hardware lifecycle proof.' },
  native_prerequisite: { module: 'proof/render/fields-fa92.mjs', probe: 'analysis/render-fa92-native.json',
    accumulator_bytes: 2, index_bytes: 2, minimum_protected_stack_bytes: 2,
    qualification: 'Manual atomic prerequisite only; fresh shared DP/dimension bytes, exact first/second WORD stores and ADC/DEC flags, cumulative work/output budgets and one outer commit. Original936C/BF3B caller and buffer initialization remain open.' },
  local: { edges: root.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    order: ['fresh WORD DP00 -> X', 'fresh WORD DP02 -> A', 'WORD fixedlong7E2100+X store',
      'fresh WORD DP04 -> A', 'zero branches to CLC', 'positive nonzero skips arithmetic',
      'zero or negative: CLC/ADC fresh WORD fixedlong7E2020+X/DEC/DEC', 'WORD fixedlong7E2120+X store', 'RTS80FAAB'] },
  contract: {
    entry: 'E0/M0/X0, D0000, binary arithmetic, actual DBR and2 protected stackbytes including rootJSR2. No incoming A/X precondition; Y/P-C/V/I are actual incoming values. Intact disjoint stack/code, valid fresh sources and writable destinations remain required.',
    first: 'Full fresh WORD DP00 is unmasked X, including zero, odd and8000..FFFF. Fresh WORD DP02 stored unchanged at fixedlong7E2100+X before DP04 read; no index alignment, capacity or signed-index gate. WORD destination secondbyte and full index carry into7F remain real addresses.',
    gate: 'Fresh WORD DP04 zero takes BEQ80FAA0 before BPL. Positive0001..7FFF takes BPL80FAA7 and stores unchanged, without reading2020. Negative8000..FFFF falls through to CLC like zero; zero is not a no-op or positive path.',
    relative: 'CLC discards entryC; ADC fresh WORD fixedlong7E2020+X yields wrapping sum with binary additionC/V. Two WORD DEC A produce wrapping sum-2, updating N/Z but preserving ADC C/V. No clamp, saturation, BYTE narrowing or shifted pixel formula; full dimensionWORD including highbit/zero is used.',
    return: 'Both paths finish WORDSTA7E2120+X thenRTS80FAAB. A is the actually stored secondWORD; X is original fullDP00; Y, actual DBR and I/M/X preserved. Positive path C/V from entry and N0/Z0 from DP04 LDA. Zero/negative path C/V from ADC before twoDEC, N/Z from finalDEC. No final flags recomputed from first field or a helper summary.',
    freshness: 'Reads DP00/DP02, writes firstWORD, then readsDP04 and conditionally2020WORD. Fixed-long destinations and indexed2020WORD all use full X/24-bit carry; bytes are not independent cached record fields. No local DP scratch or MMIO store, no callback, no interrupt/frame ownership inferred.',
  },
  selected_owners: { report: 'analysis/render-be6d.json', parent: 'allocateF963', windows: owners.map(describe),
    qualification: 'Selected original F963 active-path writers only: DP04->2020+X, ((DP04-2)<<3)WORD->2120+X, LDA0 then2100+X and other fields. FA92 has its own unshifted formula. Existing full F963 source/native contract supplied separately; no successful allocation or original initialized buffer assumed.' },
  caller: { source: 'analysis/render-bf3b.json', at: '80:93EC', return_to: '80:93EF',
    order: 'After actual F963 return, freshDP00->DP14, WORD0054->DP02, WORDFFF8->DP04, JSRFA92. FA92 writes2100+X=0054 and2120+X=(fresh2020+X-000A)WORD with actual fullDP00 X. Return caller LDA0001/STA DP00 replaces index source; DP14 remains the saved original word locally.',
    qualification: 'Original936C fragment only. Previous F963 can return capacity-full; no successful allocation/indexvalidity inferred. Other caller effects, original initialization, whole936C/BF3B stack/control and automatic dialog lifecycle remain open.',
    scan: { raw_jsr_candidates: rawCandidates, qualification: 'Raw ROM bytepattern hints only, selected80:93EC instruction-validated. No indirect/reachability/allcallsite proof.' } },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-fa92.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-fa92.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete FA92 root, selected936C caller and F963 writer fragments separate. No CPU execution.\n\n`
  + [root, caller, ...owners].map(formatBlock).join('\n'));
console.log(`FA92 ${describe(root).covered_bytes}/${map.size}; closed acyclic source with${proof.minimum_protected_stack_bytes} protected bytes; native supplied, original caller binding OPEN.`);
