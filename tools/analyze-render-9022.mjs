import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRender9022Source, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, helper, caller, map, proof, helperProof} = proveRender9022Source(bytes);
const previous = JSON.parse(await readFile('analysis/render-8fba.json', 'utf8'));
const parentHelper = previous.windows.find(w => w.name === helper.name);
const selectedPrefix = previous.windows.find(w => w.name === 'selectedSetupCaller9022');
if (previous.rom_sha256 !== metadata.rom_sha256 || JSON.stringify(parentHelper) !== JSON.stringify(describe(helper))
  || !describe(root).machine_bytes.startsWith(selectedPrefix.machine_bytes)) throw Error('8FF5 dependency drift');
const owners = ['request8FBA', 'callbackCallC176', 'reset8FB3'].map(name => {
  const w = previous.windows.find(w => w.name === name);
  if (!w) throw Error('Missing selected owner');
  const raw = bytes.subarray(cpuToOffset(parseInt(w.entry.replace(':', ''), 16), bytes.length),
    cpuToOffset(parseInt(w.end_exclusive.replace(':', ''), 16), bytes.length));
  if (raw.toString('hex').toUpperCase() !== w.machine_bytes || createHash('sha256').update(raw).digest('hex') !== w.sha256)
    throw Error('Selected owner drift');
  return w;
});
const candidates = [];
for (let p = 0; p < bytes.length - 2; p++) if (bytes[p] === 0x20 && bytes[p + 1] === 0x22 && bytes[p + 2] === 0x90)
  candidates.push(cpuLabel(((0x80 + Math.floor(p / 0x8000)) << 16) | 0x8000 | (p & 0x7FFF)));
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local9022 and sole actual callee8FF5 source, WORD/BYTE modes, actual DBR and typed stack. Selected936C caller and existing0140 writer/callback sources separate. No CPU/device/clock/scene/frame execution.',
  windows: [root, helper].map(describe),
  full_graph: { closed: true, code_bytes: 105, instructions: map.size, proof,
    calls: [{ from: '80:902B', to: '80:8FF5', kind: 'JSR' }], native_binding: true, actual_termination_proven: false,
    qualification: 'All local source edges/calls closed without external return assumptions. Fresh0140 signed wait requires an external writer/observation; structural RTS reachability is not actual wait completion, DMA confirmation or whole936C lifecycle proof.' },
  helper_graph: { entry: '80:8FF5', code_bytes: 45, instructions: 18, proof: helperProof, native_binding: true, actual_termination_proven: false },
  dependencies: [{ report: 'analysis/render-8fba.json', window: parentHelper, selected_root_prefix: selectedPrefix }],
  local: { edges: [...map.values()].filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    setup_stores: [[0x4305,0x1000,2],[0x4302,0x5250,2],[0x4304,0x7F,1],[0x4301,0x18,1],[0x2115,0x80,1],[0x4300,1,1]],
    byte_loop: { count: 128, first: '7E:3F05', last: '7E:3D09', stride: -4, value: 240, final_x: 65533 },
    word_loop: { count: 16, first: '7E:3F26', last: '7E:3F08', stride: -2, value: 0, final_x: 65534 },
    tail_stores: [['7E:3D0C',0x83A6,2],['7E:3D0E',0x3200,2]],
    bitmap_or_source_copy_bytes: 0,
    qualification: 'Fixed scalar metadata writes only, not CPU transferbuffer reads or copied DMA bytes. First BYTE loop3D0D=F0 is later overwritten by highbyte83 of WORD3D0C=83A6.' },
  contract: {
    entry: 'E0/M0/X0/D0000, binary arithmetic, actual DBR and4 protected stackbytes including rootJSR2 and helperJSR2; helper standalone needs2. Incoming A/X overwritten before use, Y preserved locally. No DBR switch/PHP/PLP or alignment/capacity inference.',
    prefix: 'WORD0091->actualDBR0142, X0000, JSR8FF5. Both0142 bytes written; later8FBA reads only0142 lowbyte. No F6/F8/DP/sourcebuffer read or writer in9022/8FF5.',
    helper: '8FF5 writes ordered WORD4305=1000, WORD4302=5250, then SEP20 BYTE4304=7F/4301=18/2115=80/4300=01 to actualDBR. X unchanged, no420B trigger store or CPU sourcebuffer read. Channel0 source7F5250/4096 bytes is request metadata only. REP20 then STXWORDactualDBR0140 before any fresh WORDLDA0140/BPL polling.',
    wait: 'BPL901C repeats for every WORD0000..7FFF, including zero;8000..FFFF exits and returns that actual negativeWORD inA atRTS9021, N1/Z0, C/V/I and X/Y/DBR preserved. Standalone8FF5 can publish any fullX, but9022 publishes0, which cannot release its own wait without an external writer. Do not skip polling, infer negative marker, execute8FBA or claim original interrupt/DMA completion.',
    byte_fields: 'After actual8FF5 return SEP20, BYTEA=F0 with hidden highA from returned negativeWORD, WORDX01FD. Fixedlong7E3D08+X BYTEstore followed by fourWORD DEX and signedBPL. Exactly128 stores at3F05,3F01,...3D09, X endsFFFD. X remains WORD throughout; no full32-bit/four-byte record initialization inferred.',
    word_fields: 'REP20, X001E, WORDLDA0000. Fixedlong7E3F08+X WORDstore followed by twoWORD DEX/signedBPL: sixteen zeroWORDS at3F26..3F08, X endsFFFE. Exactly32 bytes cleared; neither full previous region nor untouched fields are reset.',
    tail: 'Then WORD83A6->fixedlong7E3D0C before WORD3200->fixedlong7E3D0E. First highbyte3D0D=83 overwrites earlier BYTEF0. Four tail bytes are A6/83/00/32; no pointer semantic, referenced ROM table or palette buffer hydration inferred.',
    return: 'RTS905D: A3200/XFFFE, Y and actual DBR preserved locally, M0/X0/D0, final N0/Z0 from last WORDLDA3200. C/V/I unchanged from entry because setup, polls, LDAs, stores and DEX do not replace C/V/I. No final NZ from negativeX or pollA; no entryP restoration.',
    freshness: '0142/0140 and setup offsets use actualDBR with real WORD bytes and address semantics;7E/7F offsets are real memory, not IO requests. Root metadata destinations are fixedlong7E independent of DBR. All aliases/windows/stack/source and chronological wait observations need one shared native view; valid bytes or compatible observed waits do not establish original owner/frame chronology.',
  },
  selected_owners: { report: 'analysis/render-8fba.json', windows: owners,
    qualification: 'Existing8FBA source and selectedC176 callbackcall plus8FB3 reset separately pinned. 8FBA writesFFFF to actualDBR0140 after its requests, not an actual9022 callee. No callback execution, NMI/RTI chronology, automatic producer or successful transfer inferred.' },
  caller: { report: 'analysis/render-bf3b.json', window: describe(caller), at: '80:9453', return_to: '80:9456',
    order: 'Actual8F20 return thenJSR9022; only after actual9022 return LDY0002. Caller incoming8F20 A/X/Y overwritten by9022 except preservedY; no successful preceding9F6D/8F20 initialization or whole936C termination inferred.',
    raw_jsr_candidates: candidates, qualification: 'Selected9453 instruction-validated; raw ROM bytepatterns only, no indirect/reachability/allcallsite proof.' },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-9022.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-9022.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete9022/8FF5 source; selected936C caller separate. Signed0140 wait completion unproved. No CPU execution.\n\n`
  + [root, helper, caller].map(formatBlock).join('\n'));
console.log(`9022 60/25; local graph105/${map.size}, stack${proof.minimum_protected_stack_bytes}; helper45/18 stack${helperProof.minimum_protected_stack_bytes}, native8FF5/9022 supplied; actual wait/original caller binding OPEN.`);
