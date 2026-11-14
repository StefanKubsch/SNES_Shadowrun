import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const windows = [[0x80C9E0, 0x80C9F1], [0x80C84D, 0x80C913], [0x80C913, 0x80C9E0],
  [0x80C80C, 0x80C84D], [0x80AAAF, 0x80AB0A], [0x80A985, 0x80AA4C]];
const readBlock = (entry, end) => {
  const instructions = []; let state = { ...mode };
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, state);
    if (ins.next > end || ['PLP', 'XCE', 'TCD', 'PLD', 'PLB', 'SED', 'JML', 'RTI'].includes(ins.mnemonic)) throw Error('Mode/bank/control contract needs renewed analysis');
    if (['REP', 'SEP'].includes(ins.mnemonic)) {
      if (ins.value !== 0x20 || ![0x80AAEA, 0x80AAFA].includes(pc)) throw Error('Unexpected mode change');
      state = { ...state, m: ins.mnemonic === 'SEP' ? 1 : 0 };
    }
    instructions.push(ins); pc = ins.next;
  }
  return { entry, initialState: mode, instructions, stop: 'Complete explicit source window; all graph paths verified separately; no machine instructions executed' };
};
const blocks = windows.map(([entry, end]) => readBlock(entry, end));
const instructions = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const edges = [];
for (const ins of instructions.values()) {
  if (ins.target !== undefined) {
    if (!instructions.has(ins.target)) throw Error('Uncovered helper edge');
    edges.push({ from: cpuLabel(ins.cpu), kind: ins.mnemonic, to: cpuLabel(ins.target) });
  }
  if (!['RTS', 'JMP', 'BRA'].includes(ins.mnemonic) && !instructions.has(ins.next)) throw Error('Uncovered fallthrough');
}
const calls = edges.filter(e => e.kind === 'JSR');
if (calls.map(e => e.to).join(',') !== '80:C84D,80:C913,80:C80C,80:AAAF,80:C80C,80:AAAF,80:A985') throw Error('Helper call graph changed');
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const caller = readBlock(0x80AB26, 0x80AB38);
const tables = [0x80C7CC, 0x80C7DC, 0x80C7EC, 0x80C7FC].map(address => {
  const raw = bytes.subarray(cpuToOffset(address, bytes.length), cpuToOffset(address + 16, bytes.length));
  return { entry: cpuLabel(address), end_exclusive: cpuLabel(address + 16), covered_bytes: 16,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase(),
    words: Array.from({ length: 8 }, (_, i) => raw.readUInt16LE(i * 2)) };
});
const accesses = [...instructions.values()].filter(i => ['LDA', 'LDX', 'LDY', 'ADC', 'SBC', 'CMP', 'CPY', 'ORA', 'STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic)
  && ['dp', 'abs', 'absx', 'absy', 'longx', 'dil', 'dily', 'sr'].includes(i.mode)).map(i => ({
    from: cpuLabel(i.cpu), instruction: i.mnemonic, operand: i.operand,
    width_bytes: ['LDX', 'LDY', 'CPY', 'STX', 'STY'].includes(i.mnemonic) ? 2 : i.state.m ? 1 : 2,
    operation: ['STA', 'STX', 'STY', 'STZ'].includes(i.mnemonic) ? 'write' : 'read',
    bank_contract: i.mode === 'dp' ? 'D=0; bank00 low WRAM' : i.mode === 'longx' ? 'Explicit long bank'
      : ['dil', 'dily'].includes(i.mode) ? '24-bit pointer in bank00 DP; source sets bank8C, not DBR'
        : i.mode === 'sr' ? 'Saved direction word on native stack, not argument workspace'
          : i.value >= 0x8000 ? 'Inherited DBR; Bank80 ROM tables only with DBR00/80; other ROM banks select different pages'
            : 'Inherited DBR must expose low WRAM for valid slot/task offsets'
  }));
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete static C9E0 graph: six routines, seven direct/transitive calls,775 helper bytes;18-byte AB26 caller and64 bytes of bank80 direction tables. AAAF/6A and A985 match the prior slot-actions source. No CPU execution. Native C9E0 and complete AB26 integration are supplied with atomic slot/byte/scratch/workspace/task planning; see docs/reference/movement.md#c9e0.',
  routines: blocks.map(describe), caller_windows: [describe(caller)], tables, edges, accesses,
  caller_edges: caller.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
  entry_contract: 'E0M0X0,D=0,binary arithmetic,X=game-slot byte offset. AB26 reads40E0 and skips C9E0 if zero. The graph inherits DBR without modifying it: low slot/task addresses require WRAM mapping; C7CC/C7DC/C7EC/C7FC are the extracted Bank80 ROM tables only for DBR00/80; other ROM banks select different pages. DBR7E would select high WRAM instead: never silently replace it by ROM. This bounded ROM-table contract does not prove the full scene caller DBR.',
  dispatch_timer: 'C9E0 tests4138 bit0, choosing C84D if set, C913 otherwise. Both decrement40E0 modulo65536, writing it before any target read. Nonzero result returns immediately. Direct helper entry40E0=0 would wrap toFFFF; AB26 never invokes that case. Timer expiry is a call-count observation, not a browser/frame timer.',
  target_helper_C80C: {
    reads: '4190!=0: target coordinates are4190 and41E8.4190==0:41E8 becomes Y, and target coordinates are0E28+Y and0E80+Y. Zero direct first-coordinate therefore selects the slot-target mode. Current0E28/0E80 read at X; second4190 test repeats the source read.',
    scratch: 'STZ A8/AB first. Each SEC/SBC wraps target-current to a word. Negative sign-bit result is stored unchanged in A8/AB, then EORFFFF/INC forms magnitude into A2/A5. Nonnegative sign words stay zero. Magnitude8000 remains8000. ReturnA=wrapped(A2+A5) with freshCLC; unsigned cutoff compares the wrapped word with0010.',
    side_effects: 'Writes shared D9 scratch A2/A5/A8/AB only. Preserves X, widths,D,DBR; changes Y only in slot-target mode. No universal target-slot validation or initialization is established.'
  },
  C84D: {
    expiry: 'If wrapped distance<0010, stop path. Otherwise read prior1458 bit8 before AB2F clears it. Set bit8 forces40E0=001E and chooses the opposite axis from4138 bit1, without toggling4138. No bit8:40E0=2, choose first axis when bit1=0, second when bit1=1. Selected magnitude<000C XORs4138 bit1 and switches axis. Magnitude==000C keeps the axis.',
    direction: 'First-axis signA8 chooses direction6 if nonzero else2; second-axis signAB chooses4 if nonzero else0. Write workspace00=X,02=direction;PHY saves direction, JSR AAAF, PLA recovers it even if the callee overwrites02/Y. All four directions call6A, even if1198 later causes a no-write return.',
    motion: 'Double saved direction to table-byte offset; read1038 after6A/A985 effects. Exactly1038=2 selectsC7EC/C7FC, all other valuesC7CC/C7DC. Write both0D20 and0D78. Bit0 of4138 remains set; timer stays2 or001E.'
  },
  C913: {
    direction: 'After distance>=0010, test(A5>>>1)>=A2 first for second-axis cardinal4/0; else(A2>>>1)>=A5 for first-axis cardinal6/2. Equality belongs to the first matching cardinal case. Otherwise signs(A8!=0,AB!=0) map diagonals(true,true)=5,(true,false)=7,(false,true)=3,(false,false)=1.',
    callee_gate: 'Always write00=X,02=direction andPHY.4138=0 writes4138=4*direction+2 and calls6A. Nonzero4138 whose logical>>>2 equals direction calls6A without rewriting4138. Other nonzero4138 writes4*direction+2 but setsY=FFFF and skips6A. This asymmetry is original code, not a missing call. CMP/LDA01,S read the saved direction word; they do not read DP01.',
    motion: 'PLA recovers direction, double for table index, then use1038 after any callee effects for table pair and write0D20/0D78. Finally40E0=2. This new4138 has bit0 clear.'
  },
  stop_paths: {
    writes: 'Both stop paths zero0D20/0D78. Timer remains the expired zero. Read1350+X: negative returns without task reads. Otherwise while0BA2+Y is negative, follow0372+Y; at first nonnegative status set0C62+Y=old OR0004. No linked-task status/link writes.',
    boundaries: 'Only initial1350 is sign-checked. A negative follow-up link is not a stop marker here; original code has no cycle, range, slot alignment or unknown-data guard. Native host must fail closed on unsupported address/cycle/unknown values without partial slot/scratch/task writes. Task flag write is an actual conditional side effect; native frameAllocator eventWord owns0C62 and heap-bound wait checks read it; no implicit check/sweep follows a motion call.'
  },
  callee_AAAF_A985: {
    source: 'Complete existing6A/A985 routines are repinned, not treated as successful opaque helpers. No further calls after A985. Bank8C pointer/data source is explicitly required on data-reading branches; no graphics or hardware helper in this graph.',
    AAAF: 'X=00, old1198->Y. If old1198==02 return with no further field/data reads. Else write1198=02; read10E8. For0001..007F:08=1090,0A=008C;SEP20,byte11F0=oldByte-ROM[8C:pointer+old1198]+ROM[8C:pointer+new1198] modulo256 with SEC then freshCLC;REP20;4030=0080,1140=FFFF. X stays slot; Y becomes new1198. For10E8=0 or>=0080:1038=FFFF returns; otherwise02=1038&7FFF,1038=FFFF,callA985.',
    A985: 'Y=00, compare02 to1038+Y; equality returns preservingX. Mutating path writes1038; definition3F28 doubles modulo WORD for8C:ED8A table index. Pointer=wrapped(tableWord+wrapped(2*02)+original02bit15), stored00,02/06/0A=008C. IndirectWORD00 gives04;1090/08=wrapped(indirectWord+8+previousADCcarry), not unconditional+8. X restored to slot before remaining accesses.',
    data_writes: 'A985 writesWORD11F0 fromWORD[08+1198]&00FF;4088=byte0;10E8=byte1 XOR80;3FD8=1;1248=byte2;4240/4298/42F0/4348 sign-extend bytes3..6;43A0=unsigned byte7;4030=80;1140=FFFF. Original loads are WORDs even when masked to a byte. Workspace00/02/04/06/08/0A is clobbered; directions saved on stack survive these writes.'
  },
  return_contract: 'All calls are shortJSR/RTS with balanced local stacks. C84D/C913 PHY pairs with PLA, so Y is not restored. Every graph return is E0M0X0,D/DBR unchanged,X=original slot for valid entry00 writes and A985 return. A/Y/Carry vary by branch and are not Boolean results. AB2F ignores returnedA/Y/Carry, rereads1458, clearsbit8, then uses updated0D20/0D78 and any6A/A985 extents in the later body. AFC4 separately saves/restores outerY aroundAB26.',
  side_effects: {
    own_scratch_words: ['A2', 'A5', 'A8', 'AB'], workspace_words: ['00', '02', '04', '06', '08', '0A'],
    own_slot_writes: ['7E:40E0', '7E:4138', '0D20', '0D78'], conditional_task_write: '0C62+linked task offset',
    preserved: 'No own0ED8/0DD0/6B/0F30/search scratch11..3E/68 writes; no sharedD9 AE/B1/B4/B7/BA writes. Callee may change1198,1038,1090,11F0,4088,10E8,3FD8,1248,4240,4298,42F0,4348,43A0,4030,1140. Later motion writes are separate and must share the same atomic host plan.'
  },
  implementation: { helper: 'proof/state/slot-motion-helper-c9e0.mjs', direction_data: 'proof/state/slot-motion-direction-data.mjs; assets/slot-motion-direction-data.json contains64 original bytes, requires explicit DBR00/80 only',
    binding: 'slots.stepMotionHelperC9E0 supplies bounded slot/definition/byte/target sources; stepMotion merges the prelude and all later motion helpers before any live write. frameAllocator owns workspace and task eventWord0C62, including9F C40E reset and next explicit wait check. Unknown/outside/cyclic reads leave every owner unchanged.',
    probe: 'Explicit synthetic timer1/mode0 and direct target+32 with DBR80 and negative heads gives486/1826/1725,0F30=1156,40E0=2,4138=6,0D20/0D78=2; workspaceD470/008C/D472/008C/D47A/008C. Direct target=current gives484/1824/1725,0F30=1154,zero horizontal motion/timer and linked217 eventWord4. No automatic waiter check or scene/frame claim.' },
  boundaries: ['Native C9E0 and full manual motion body are supplied with explicit sources and atomic planning; Prelude81:8799 full source contract is pinned in motion-prelude-8799.json; native atomic prelude binding is supplied; AC2F complete static source is pinned in motion-postpass-ac2f.json; native bounded manual AC2F binding is supplied; native atomic manual AFC4 supplied; complete DE94 static source/return contract pinned in motion-prefix-de94.json; native bounded manual DE94 and atomic DE94/AFC4 composition supplied; selected original writer contracts pinned in motion-prefix-writers.json; native88 atomic six-WORD reset supplied; gate8000 local source pinned in motion-gate-8000.json; external callees source-required; A4BF local body,A44D andtime helpers pinned in motion-transition-a4bf.json; BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source; full starter/render and pointer lifecycle remain open',
    'ROM-table interpretation requires the explicit inherited DBR contract; full scene/main-loop DBR and gates remain open',
    'Original target/timer/direction/task-link initialization and original collision-list initialization remain open; no synthetic scene facts',
    'Automatic main-loop orchestration, scene/frame integration and audio/display remain separate work']
};
await writeFile('analysis/motion-helper-c9e0.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-helper-c9e0.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete C9E0 graph E0M0X0/D0/binary; inherited DBR, no CPU execution.\n; AAAF temporarily sets M1, restores M0; all transitive calls covered.\n\n`
  + [...blocks, caller].map(formatBlock).join('\n') + '\n; Direction data: ROM only under the explicit inherited DBR mapping.\n'
  + tables.map(t => `${t.entry}  ${t.machine_bytes}  ; WORDs ${t.words.map(w => w.toString(16).toUpperCase().padStart(4, '0')).join(' ')}`).join('\n')).trimEnd() + '\n');
console.log(`C9E0 graph:775 bytes,${edges.length} control edges,${calls.length} calls; caller18 bytes; tables64 bytes.`);
