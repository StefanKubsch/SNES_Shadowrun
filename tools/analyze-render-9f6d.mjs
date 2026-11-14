import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRender9F6DSource, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, helper, callers, map, proof, table} = proveRender9F6DSource(bytes);
const parent = JSON.parse(await readFile('analysis/render-a9b2.json', 'utf8'));
const existing = parent.windows.find(w => w.entry === '80:9E65');
if (parent.rom_sha256 !== metadata.rom_sha256 || existing?.machine_bytes !== describe(helper).machine_bytes
  || existing?.sha256 !== describe(helper).sha256) throw Error('9E65 dependency drift');
const calls = root.instructions.filter(i => i.mnemonic === 'JSR').map(i => ({ from: cpuLabel(i.cpu), to: cpuLabel(i.target), kind: i.mnemonic }));
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local9F6D and sole actual callee9E65 source, WORD/BYTE modes, DBR and typed stack; original256-byte offset-width table and two selected936C callers separate. No CPU/device/clock/scene/frame execution.',
  windows: [root, helper].map(describe),
  full_graph: { closed: true, code_bytes: describe(root).covered_bytes + describe(helper).covered_bytes, instructions: map.size,
    proof, calls, native_binding: true, actual_termination_proven: false,
    qualification: 'All local source edges and actual calls closed without external returns. Bit-driven loops, wrapping output count, MVN and source/destination aliases need valid bytes and budgets; structural return is not an input termination or original dialog lifecycle proof.' },
  dependencies: [{ report: 'analysis/render-a9b2.json', window: describe(helper) }],
  native_prerequisite: { module: 'proof/render/unpack-9f6d.mjs', probe: 'analysis/render-9f6d-native.json',
    accumulator_bytes: 2, index_bytes: 2, minimum_protected_stack_bytes: 10,
    qualification: 'Manual bounded atomic9F6D/9E65 only, actual entryA/X/Y/P/DBR and fresh shared pointer/header/bit/scratch/output bytes. Literal WORD address carry differs from ascending MVN7F indexwrap; cumulative work/output budgets, original header and entryP/DBR, one outer commit. No original936C/BF3B initialization/caller/scene/frame binding.' },
  table,
  local: { edges: root.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    scratch_words: ['DB','DD','DF','E1','E3','E5','E7','E9','EB','ED','EF','F1'],
    copy: { at: '80:A01C', mnemonic: 'MVN', source_bank: 127, destination_bank: 127, direction: 'ascending', bytes: 'WORD(A)+1; AFFFF transfers65536 bytes, X/Y wrap within bank7F, A finishesFFFF. Reads/writes occur per byte in order, including overlap.' } },
  contract: {
    entry: 'E0/M0/X0/D0000, binary arithmetic, actual entryDBR and10 protected stackbytes including rootJSR2. Full incoming A/X/Y required: A->WORD E1, Y->WORD E3 (only its lowbyte E3 is pointerbank), X->WORD DD and DF. PHP/PHB preserve original P/DBR; local DBR7F via PEA7F7F/PLB/PLB. No index alignment, header capacity or initialized output assumed.',
    header: 'STZ EB before source read; Y0 then fresh WORD [E1],Y->DB and WORD PHA saves original header for final A. Y2, CLC, fresh WORD [E1],Y+0002 wrapping->E5. E7=4, E9=0, EF=0; initial BRA9FA0 skips9F9B bit. Zero targetDB still decodes/copies a first literal run before comparing; no zero header early return.',
    bits: 'Sole callee9E65: WORD DEC EF then signed BPL. Negative reload preserves A with WORDPHA/PLA, EF=15, freshY=E5, WORD [E1],Y/XBA->F1, Y+=2 wrapping->E5. Final WORD ASL F1 yields C and N/Z; A unchanged, X unchanged, Y changes only on reload. First reload from EF0; 16 high-bit-first bits per swapped source WORD under intact scratch, all sources fresh.',
    literal_code: 'A1 then bit9E65; Carry1 finishes code. Carry0 consumes another bit, WORDROL A, BRA back to controlbit. No code-length or nonzero guarantee; wrapping ROL permits0. After code LDY freshE7/LDX freshDF/STAEB, LSR A->ED; quotient zero always takes9FCA BYTE copy, even EB0. Positive quotient copies ED WORDs with WORD DEC ED loop; PHP/PLP protects original LSR carry across source reads/stores/increments, odd bit adds one BYTE. EB0 physically copies1 byte while counted0; otherwise physical length equals full unsignedEB. X/Y wrap as WORDs; abs indexed WORD secondbyte/address carry remains actual address behavior.',
    literal_tail: 'Fresh X->DF, Y->E7; fresh EB, CLC/ADC freshE9 wrapping->E9, unsigned CMP freshDB. Carry1 returns; Carry0 enters copyphase. Actual first store precedes these later reads; no cached metadata or clamp to target length.',
    offset: 'SEP30 narrows X/Y to lowbytes. BYTE LDX freshEA: nonzero uses A8 and highbyte, zero uses A0 and fresh lowE9. CLC/BYTE ADC fixedlong80A033+X, BYTE TAX zeroextends X; REP30 restores widths, LDA0 starts bit accumulator. Table yields width0..16 for every WORD E9; no high accumulator leakage into WORDX. JSR9E65/ROL A/WORD DEX/BNE is a do-loop: width0 underflows toFFFF and consumes65536 bits. WORD bit accumulator wraps. CLC/ADC freshDD wrapping/TAX gives bank7F source index; no backwards-distance subtraction or produced-byte validity check.',
    repeat: 'A1 control/data-bit code like literal loop (JMPA00B), then WORDINC A/STAEB; freshLDY DF, MVN7F->7F ascending copies WORD(EB)+1 bytes. EB0 copies1, EBFFFF copies65536; decoded length is increased twice before wrap-aware physical length. X/Y each wrap within bank7F; each sourcebyte read precedes its destinationwrite and overlap sees earlier writes. STY DF, SEC/LDA freshEB/ADC freshE9 wrapping->E9 counts EB+1; CMP freshDB unsigned. Carry1 returns; Carry0 JMP9F9B reads selectorbit: C1 directly copyphase, C0 literalphase. No length clamp, zero-output guard, bounds validation or whole-stream termination guarantee.',
    return: 'PLA returns original first headerWORD in A even if DB was overwritten by source alias; PLB restores actual entryDBR, PLP restores complete entryP including C/V/N/Z/I/M/X; RTSA032. X/Y are actual final literal/copy results, not entry values or constant output end. Local phases overwrite scratchDB..F2 bytes; no original buffer/scratch ownership or main chronology inferred.',
    freshness: 'DP sourcepointer/counters/bits and bank7F destinations share actual byte view. E3/E4 WORD bankstore does not turn pointer into32bit; long indirect addresses use E1/E2/E3 and WORD Y with24bit address carry. literal STA0000,X uses localDBR7F and full effective address carry; MVN wraps source/destination indices inside bank7F. Pointer/source/header/bitstream may alias scratch, and source may alias output. Original bytes, valid write windows, disjoint protected stack/code and bounded manual planning are explicit prerequisites; no MMIO or wait observations here.',
  },
  callers: { report: 'analysis/render-bf3b.json', windows: callers.map(describe),
    order: 'Both936C fragments read fresh WORD [F6],Y atY2, mask00FF/TAY to sourcebank, fresh WORD [F6]->A, X5250, JSR9F6D; actual return then8F20 then9022 or905E. First fragment explicitly setsY2; second inheritsY2 from preceding936C source. Incoming Y highbyte0 but standalone9F6D accepts fullWORDY and stores E4 too.',
    qualification: 'Selected callers only; 8F20 source26/13 and native atomic prerequisite supplied under3 protected stackbytes; 9022/8FF5 source105/43 supplied under4 protected stackbytes; native8FF5/9022 supplied; actual0140 wait remains open. 905E-8FF5-A954 source95/36 supplied under5 protected stackbytes; Current work is tracked in docs/PORTIERUNGSSTAND.json. No whole936C stack proof, successful source initialization, original5250 buffer capacity or automatic scene binding.' },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-9f6d.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-9f6d.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete9F6D/9E65 source; table and selected936C callers separate. No CPU execution.\n\n`
  + [root, helper, ...callers].map(formatBlock).join('\n') + `\n; Table80:A033,256 bytes: ${table.machine_bytes}\n`);
console.log(`9F6D ${describe(root).covered_bytes}/${root.instructions.length}; graph${report.full_graph.code_bytes}/${map.size}; stack${proof.minimum_protected_stack_bytes}; native supplied, original caller/termination OPEN.`);
