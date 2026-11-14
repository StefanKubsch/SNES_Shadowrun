// ROM-only interpreter source shared by the task opcode analyzers. It returns
// the subset of C1CA report fields those analyzers used (two WORD windows, the
// 257-byte opcode WORD source and all 256 byte-opcode targets) with identical
// descriptors, computed as analyze-render-c1ca.mjs does. No report is read.
import {createHash} from 'node:crypto';
import {cpuLabel, cpuToOffset} from './rom.mjs';
import {decode} from './disassemble.mjs';

const romHash = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const sha = b => createHash('sha256').update(b).digest('hex');

function describeWindow(bytes, name, entry, end) {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, {e: 0, m: 0, x: 0});
    if (i.next > end) throw Error('Source window overflow');
    instructions.push(i); pc = i.next;
  }
  const raw = Buffer.concat(instructions.map(i => i.raw));
  return {name, entry: cpuLabel(entry), end_exclusive: cpuLabel(instructions.at(-1).next), covered_bytes: raw.length,
    instruction_count: instructions.length, sha256: sha(raw), machine_bytes: raw.toString('hex').toUpperCase()};
}

export function taskInterpreterSource(bytes) {
  if (sha(bytes) !== romHash) throw Error('Wrong European ROM revision');
  const off = cpuToOffset(0x80F2B4, bytes.length), raw = bytes.subarray(off, off + 257);
  const opcode_source = {name: 'allByteOpcodeWordSources', entry: cpuLabel(0x80F2B4), covered_bytes: 257,
    sha256: sha(raw), machine_bytes: raw.toString('hex').toUpperCase()};
  const all_byte_opcode_targets = Array.from({length: 256}, (_, opcode) => ({opcode, word_source: cpuLabel(0x80F2B4 + opcode),
    target: cpuLabel(0x800000 | raw.readUInt16LE(opcode)),
    classification: opcode <= 0xC2 && !(opcode & 1) ? 'original even table slot' : 'unvalidated overlapping WORD/code-byte target'}));
  return {rom_sha256: romHash,
    windows: [describeWindow(bytes, 'interpreterF378', 0x80F378, 0x80F393), describeWindow(bytes, 'runC1F9', 0x80C1F9, 0x80C242)],
    dispatch: {opcode_source, all_byte_opcode_targets}};
}
