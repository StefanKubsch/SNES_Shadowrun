import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, hex } from './rom.mjs';
import { disassembleBlock, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw new Error('Wrong European ROM revision');
const roots = [[0x808511, 0, 0], [0x808521, 0, 0], [0x80855D, 0, 0],
  [0x81EF47, 0, 0], [0x81F25A, 0, 0], [0x81F007, 1, 0], [0x81F023, 1, 0], [0x81F269, 1, 0], [0x81F1FA, 1, 0]];
const blocks = roots.map(([entry, m, x]) => disassembleBlock(bytes, entry, { e: 0, m, x }, 128));
const handshake = blocks.find(block => block.entry === 0x81F007);
if (handshake.stop !== 'PLP boundary' || handshake.instructions.some(ins => ['JSR','JSL','REP','XCE'].includes(ins.mnemonic))) throw new Error('Handshake return mode proof changed');
const instructions = new Map();
for (const block of blocks) for (const ins of block.instructions) {
  const previous = instructions.get(ins.cpu);
  if (previous && !previous.raw.equals(ins.raw)) throw new Error('Conflicting instruction boundary');
  instructions.set(ins.cpu, ins);
}
const coverage = [[0x808511, 0x808521], [0x808521, 0x80855E], [0x81F007, 0x81F024]].map(([start, end]) => {
  const covered = new Set();
  for (const ins of instructions.values()) if (ins.cpu >= start && ins.cpu < end) {
    for (let address = ins.cpu; address < ins.next; address++) {
      if (address >= end || covered.has(address)) throw new Error('Overlapping source instruction');
      covered.add(address);
    }
    if (ins.target !== undefined && ins.target >= start && ins.target < end && !instructions.has(ins.target)) throw new Error('Missing branch target');
  }
  if (covered.size !== end - start) throw new Error('Incomplete source body');
  return { start: hex(start), end_exclusive: hex(end), covered_bytes: covered.size };
});
const report = {
  rom_sha256: metadata.rom_sha256, coverage,
  scope: 'AC initializer and bounded no-helper data paths implemented. Audio call remains pending; source prefix reaches a real port handshake, with no audio success substituted.',
  initialization: { source: '80:8511-8520', writes: { '1FB0': 0xFFFE, '1FCE': 0, '1FD0': 0, '1FD4': 0 }, uninitialized: ['1FB2 entry bytes', '1FCA', '1FCC', '1FD6', '1CDE', '7E:3C11'], call_candidate_only: 'ROM002588 contains JSR8511; its caller mode/control path is not proved by the byte pattern alone.' },
  data_window: { base: '1FB0', byte_length: 40, scope: 'Explicit implementation window through the word at1FD6; not a list capacity. Writes may alias fields inside this window; outside addresses remain uncovered.' },
  first_entry: 'Word at7E:3C11 shares the existing script-word source at7E:3BBB offset0056. Do not duplicate it or initialize its unknown value.',
  helper_boundary: 'If1FD6 bit0 and1CDE!=6: AC writes saved mode then calls81:EF47 withA=6. EF47 writes1CDE=6 and callsF25A. F25A saves byteA=6 and callsF007 withA=4,X=0. F007 loops comparing1CE4 with2140, writes2142/2141/2140 and1CE4, restores its saved mode and returns RTL. Those port inputs and audio effects are absent in the native AC runtime.',
  further_source: 'After the proven F007 mode-preserving return, F269 restores original byteA, takes nonzero path and callsF1FA. Complete EF47/F25A/F1FA and actualcallees now supplied inanalysis/render-ef47.json:428 bytes/213 instructions with22/19/15 protected stackbytes. Native F1FA and F25A supplied separately; native EF47 supplied under22 protected stackbytes; AC caller integration remains open; no audio acknowledgment or completion inferred.',
  source_blocks: blocks.map(block => ({ entry: hex(block.entry), stop: block.stop, references: block.references, machine_bytes: Buffer.concat(block.instructions.map(ins => ins.raw)).toString('hex').toUpperCase() })),
};
await writeFile('analysis/ac-state.asm.txt', (`; European ROM SHA-256 ${metadata.rom_sha256}\n; AC data initializer and audio call boundary. F007 PHP/PLP proves its saved return mode; complete EF47/F25A/F1FA source supplied separately inrender-ef47. Native AC audio remains unsupported.\n\n` + blocks.map(formatBlock).join('\n')).trimEnd() + '\n');
await writeFile('analysis/ac-state.json', JSON.stringify(report, null, 2) + '\n');
console.log('Source coverage: initializer 16 bytes, AC body 61 bytes, port handshake 29 bytes; audio execution remains unsupported.');
