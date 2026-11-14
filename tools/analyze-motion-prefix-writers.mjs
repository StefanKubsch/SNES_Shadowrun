import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { inspectScriptTables, europeanTables } from './scripts.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const specs = [
  ['reset88', 0x80DE7E, 0x80DE94], ['initializer', 0x81891A, 0x818949],
  ['starter', 0x80881C, 0x808840], ['audioSelected', 0x80C46E, 0x80C4B3],
  ['multiply', 0x80C416, 0x80C461], ['apuHandshake', 0x81F007, 0x81F024],
  ['starterCaller', 0x808772, 0x808778], ['initCaller', 0x809642, 0x809652],
  ['renderBoundary', 0x81AD92, 0x81AD96],
];
const readBlock = ([name, entry, end]) => {
  const instructions = [], statuses = []; let state = { ...mode };
  for (let pc = entry; pc < end;) {
    const ins = decode(bytes, pc, state);
    if (ins.next > end || ['XCE', 'TCD', 'PLD', 'RTI', 'BRK', 'COP'].includes(ins.mnemonic)) throw Error(`Renew ${name} source proof`);
    instructions.push(ins); pc = ins.next;
    if (ins.mnemonic === 'PHP') statuses.push({ ...state });
    if (ins.mnemonic === 'PLP') { state = statuses.pop(); if (!state) throw Error('Unpaired status restore'); }
    if (['REP', 'SEP'].includes(ins.mnemonic)) {
      const set = ins.mnemonic === 'SEP' ? 1 : 0;
      if (ins.value & 0x20) state = { ...state, m: set };
      if (ins.value & 0x10) state = { ...state, x: set };
    }
  }
  if (statuses.length) throw Error('Unbalanced status stack');
  return { name, entry, initialState: mode, instructions,
    stop: 'Static source only. Calls do not execute. Return assumptions are explicit in report; AD92/F130 and earlier init callees have no complete return proof.' };
};
const blocks = specs.map(readBlock);
const describe = block => {
  const raw = Buffer.concat(block.instructions.map(i => i.raw));
  return { name: block.name, entry: cpuLabel(block.entry), end_exclusive: cpuLabel(block.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: block.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const edges = block => block.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) }));
const localGraph = block => {
  const graph = new Map(block.instructions.map(i => [i.cpu, i])), pending = [block.entry], seen = new Set();
  while (pending.length) {
    const pc = pending.pop(); if (seen.has(pc)) continue;
    const i = graph.get(pc); if (!i) throw Error(`Uncovered local flow in ${block.name}`);
    seen.add(pc); if (['RTS', 'RTL'].includes(i.mnemonic)) continue;
    if (i.target !== undefined && !['JSR', 'JSL'].includes(i.mnemonic)) pending.push(i.target);
    if (i.mnemonic !== 'BRA') pending.push(i.next);
  }
  if (seen.size !== graph.size) throw Error(`Unreachable listing in ${block.name}`);
  return { name: block.name, structurally_reachable_instructions: seen.size, edges: edges(block),
    calls: edges(block).filter(e => ['JSR', 'JSL'].includes(e.kind)),
    return_sites: block.instructions.filter(i => ['RTS', 'RTL'].includes(i.mnemonic)).map(i => cpuLabel(i.cpu)) };
};
const native88 = inspectScriptTables(bytes).native_functions.find(n => n.id === '88');
if (native88.cpu_address !== '80:DE7E' || native88.argument_words !== 0 || native88.return_bytes !== 0) throw Error('Native88 anchor changed');
const tableAt = cpuToOffset(0x80C4D3, bytes.length), tableWord = bytes.readUInt16LE(tableAt);
if (tableWord !== 0x12) throw Error('Starter audio table changed');
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Selected original0CC2/1D65 writers, not an exhaustive writer inventory. Complete native88 reset and891A initializer. Starter writepoint proved for E0M0X0/D0000 and real WRAM mapping, conditional on APU helper return; subsequent render return remains open. Static decoding/flow only; no CPU or hardware execution and no native initialization supplied.',
  windows: blocks.map(describe), graphs: blocks.slice(0, 6).map(localGraph),
  source_bytes: blocks.slice(0, 6).reduce((sum, b) => sum + describe(b).covered_bytes, 0),
  native88: { ...native88, table_rom_offsets: { pointer: europeanTables.nativePointers + 0x88 * 2,
    arguments: europeanTables.nativeArgumentWords + 0x88, returns: europeanTables.nativeReturnBytes + 0x88 } },
  table: { cpu_address: '80:C4D3', base: '80:C4B3', index: 0x20, width_bytes: 2, value: tableWord,
    machine_bytes: bytes.subarray(tableAt, tableAt + 2).toString('hex').toUpperCase() },
  reset: {
    ordered_word_writes: [[0x1D5B, 0xFFFF], [0x1D5D, 0], [0x1D5F, 0], [0x1D65, 0], [0x1D6B, 0], [0x1D6D, 0]],
    contract: 'E0M0X0; incoming DBR and its actual low-WRAM mapping explicit. Six WORD writes, including odd1D65/1D66; no reads,branches,calls or local stack. No automatic startup claim. Native table88 has zero arguments/return bytes.',
    returns: 'RTS DE93; AFFFF/N1/Z0 from first LDA. X/Y,D,DBR,E/M/X,Carry/V and decimal flag preserved; STZ/STA do not change flags.',
    preserves: 'No0CC2 or slot/task/motion/scratch writes. Bytes1D61..1D64 and1D67..1D6A untouched; no reset of unknown neighbouring bytes.',
  },
  initializer: {
    ordered_word_writes: [[0x0CC2, 0xFFFF], [0x0CC4, 0], [0x0CC6, 0], [0x0CC8, 0], [0x0CCA, 0], [0x0CD0, 0], [0x0CD6, 0], [0x0CD8, 0]],
    ordered_byte_writes: [[0x4330, 1], [0x4331, 0x18], [0x4334, 0x7E]],
    contract: 'E0M0X0; eight DBR-relative WRAM WORD writes then SEP20,three DMA-channel configuration BYTE writes,REP20,RTL. Hardware mapping requires DBR00..3F/80..BF; direct7E would be WRAM instead. No420B DMA trigger. 1D65 is not initialized here.',
    returns: 'RTL8948; E0M0X0,DBR,D,X/Y,Carry/V and decimal flag preserved. BYTE LDA retains high accumulatorFF; after REP20 A=FF7E,N0/Z0 from last BYTE LDA7E.',
    caller: '9642 JSL81891A precedes9646 JSL818CB9,964A JSL81A840 and964E JSL81A772. Selected16-byte call window, not complete startup/previous-callee width or DBR proof.',
  },
  starter: {
    gate: '881C CPY DBR:0CC2;881F BNE883F. Only equality reaches writes; no sign,alignment,capacity or nonzero-counter guard. Mismatch RTS preserves memory. Entry E0M0X0,D0000,actual DBR WRAM mapping and valid stack disjoint from workspace/cache/data writes explicit; no intervening interrupt or external writes.',
    workspace_word_writes: [[0, 'incoming Y'], [4, 0xFF], [6, 7], [2, 0x20]],
    order: ['CPY0CC2', 'BNE883F', 'STY00', 'STA04=00FF', 'STA06=0007', 'STA02=0020', 'JSRC46E', 'LDA000B', 'STA1D65', 'JSL81AD92', 'RTS'],
    counter_write_site: '80:8838', counter_value: 11,
    selected_audio_proof: 'C46E PHK/PLB forces DBR80. LDY02=0020 reads ROM WORD C4D3=0012; cache equality or CMP8000/BCC both reachC487 without F130. C416 and F007 preserve D and workspace06. LDX06=0007 makes C495/BEQ untaken, so saved WORD is popped atC4A6. F007 PHP/PLP restores widths; C416 REP20 returns M0. If all reached APU acknowledgements return, C46E returns E0M0X0,D0000,DBR80 with balanced local stack, proving WORD000B at7E1D65/1D66 before the render call. This does not prove arbitrary C46E arguments or guaranteed APU progress.',
    excluded_audio_sites: ['80:C480', '80:C483'], excluded_zero_index_edge: '80:C495 -> 80:C4B2',
    render_boundary: '883B JSL81AD92 follows the write. AD92 immediately calls81A9B2; its transitive render graph and final return effects are unproved here. No claim that1D65 remains11 after rendering or that the complete starter returns with a proven mode/stack.',
    caller: '8772 JSR881C;8775 REP20;8777 RTS pins direct call and post-return mode forcing only; preceding slot creation and gameplay conditions remain unproved.',
  },
  helpers: {
    multiply: 'C416 complete local graph, no calls. WORD STA4202 also writes4203; later SEP20 writes4203 and reads4217, balanced BYTE PHA/PLA, REP20,TAX,RTS. All paths joinC445; D/DBR and DP06 preserved. Hardware multiplication/result and flags are not evaluated.',
    apu: 'F007 PHP;SEP20; busy-wait CMP2140/BNEF00E; STX2142 remains WORD because X0; BYTE2141/2140/1CE4 writes; PLP;RTL. D/DBR,X/Y and incoming status/widths restored if it returns. APU acknowledgement is required; loop may not terminate. No synthetic acknowledgement or audio execution.',
  },
  boundaries: [
    'Native88 atomic six-WORD reset with shared odd-byte owner supplied; preserve all other bytes and do not set0CC2 or start11 implicitly. BCB2/BE5B/FA3E andAD92 local source pinned in motion-reset-bcb2.json; nextA9B2/9F49 render source. Full render return remains unproved.',
    '891A includes hardware register writes; extracting only0CC2=FFFF would not implement the complete initializer.',
    'Starter requires APU/hardware/render source and native contracts before full implementation. Actual caller DBR/modes, original pointer selection/reassignment, other direct/indirect writers and lifecycle remain open.',
    'No scene/main-loop/frame/time mapping, automatic reset, CPU execution or exhaustive global writer proof.',
  ],
  manufacturer_sources: ['https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf'],
};
await writeFile('analysis/motion-prefix-writers.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-prefix-writers.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Selected writer/helper windows:278 bytes; caller windows22 bytes; render boundary4 bytes; table WORD2 bytes.\n; E0M0X0 entry; REP/SEP and local PHP/PLP tracked. D0000 for selected starter.\n; C46E listing outside selected literal arguments is conditional; F130 is excluded for table0012.\n; AD92 full return is unproved; no CPU or hardware execution.\n\n` + blocks.map(formatBlock).join('\n') + '\n; Table80:C4D3 = 12 00 (WORD0012).\n');
console.log('Selected prefix writers: native88 six-WORD reset,891A eight-WORD/DMA-config initializer,conditional starter11 with bounded audio return proof; full render/lifecycle remain open.');
