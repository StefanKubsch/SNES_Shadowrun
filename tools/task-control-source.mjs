import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { taskInterpreterSource } from './task-interpreter-source.mjs';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { assertPinnedTaskSource, taskFetchWindow, finiteTaskPaths } from './pinned-task-source.mjs';
import { WORD_BITS, WORD_MASK, LONG_MASK } from '../src/constants/bits.mjs';
import {
  BANK_WITHOUT_IO,
  CODE_BANK_BASE,
  LOROM_OFFSET,
  LOW_RAM_END,
  MIRROR_BANK_MASK,
  ROM_BANK_COUNT,
  WRAM_BANK,
  WRAM_BASE,
  WRAM_HIGH_BANK,
} from '../src/constants/memory-map.mjs';
// The physical address behind a CPU address: WRAM, the low RAM mirror or the LoROM
// upper half; null for I/O, SRAM and ROM beyond the physical 1 MiB.
function renderAddress(address) {
  if (!Number.isInteger(address) || address < 0 || address > LONG_MASK)
    throw Error('Invalid render address');
  const bank = address >>> WORD_BITS,
    offset = address & WORD_MASK;
  if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) return address;
  if (!(bank & BANK_WITHOUT_IO) && offset < LOW_RAM_END) return WRAM_BASE + offset;
  if ((bank & MIRROR_BANK_MASK) < ROM_BANK_COUNT && offset >= LOROM_OFFSET)
    return address | CODE_BANK_BASE;
  return null;
}
export const taskWord = (v) => Number.isInteger(v) && v >= 0 && v <= 65535;
export function taskOwner(a) {
  return {
    address: cpuLabel(a),
    physical_address: renderAddress(a) === null ? null : cpuLabel(renderAddress(a)),
  };
}
export function taskStream(d, bank, pointer, y) {
  if (![d, pointer, y].every(taskWord) || !Number.isInteger(bank) || bank < 0 || bank > 255)
    throw Error('Explicit taskstream context');
  const a = (bank * 65536 + pointer + y) & 0xffffff;
  return {
    pointer_reads: [taskOwner(d), taskOwner((d + 1) & 65535)],
    word_reads: [taskOwner(a), taskOwner((a + 1) & 0xffffff)],
  };
}
export function proveTaskControl(map, spec) {
  assertPinnedTaskSource(map, [spec.window, taskFetchWindow]);
  const paths = finiteTaskPaths(map, spec.entry);
  return {
    entry: cpuLabel(spec.entry),
    source_closed_to_dispatch: true,
    full_graph_closed: false,
    native_binding: false,
    paths: paths.map((path) => ({
      visited: path.map(cpuLabel),
      executed_instructions: path.length,
    })),
    operand_s_delta: spec.s_delta,
    outer_return_frames_added: 0,
    minimum_protected_stack_bytes: null,
    external_return_assumptions: 0,
    contract: spec.contract,
    qualification:
      'Pinned local control source only; actual fresh WORD observations/byteowners/intact code/outerstack required. Dynamic nextbody, original capacity/init/globalstack/native Taskbridge/wholeC1CA return open; no CPU/memory/device/scene execution.',
  };
}
export async function emitTaskControlSource(spec, prove, examples = []) {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')
    throw Error('Wrong ROM');
  const blocks = [],
    windows = [],
    map = new Map(),
    sha = (b) => createHash('sha256').update(b).digest('hex');
  for (const [name, w] of [
    [spec.name, spec.window],
    ['fetchF389', taskFetchWindow],
  ]) {
    const instructions = [];
    for (let pc = w.start; pc < w.start + w.hex.length / 2;) {
      const i = decode(bytes, pc, { e: 0, m: 0, x: 0 });
      instructions.push(i);
      map.set(pc, i);
      pc = i.next;
    }
    const raw = Buffer.concat(instructions.map((i) => i.raw));
    blocks.push({
      entry: w.start,
      initialState: { e: 0, m: 0, x: 0 },
      instructions,
      stop: 'Pinned local source; finite branch paths asserted separately, dynamic nextbody open.',
    });
    windows.push({
      name,
      entry: cpuLabel(w.start),
      end_exclusive: cpuLabel(w.start + raw.length),
      covered_bytes: raw.length,
      instruction_count: instructions.length,
      sha256: sha(raw),
      machine_bytes: raw.toString('hex').toUpperCase(),
    });
  }
  const proof = prove(map),
    pc = 0x80f2b4 + spec.opcode,
    off = cpuToOffset(pc, bytes.length),
    raw = bytes.subarray(off, off + 2);
  if (raw.readUInt16LE() !== (spec.entry & 65535)) throw Error('Original dispatch table drift');
  const visit = taskInterpreterSource(bytes);
  if (
    visit.rom_sha256 !== metadata.rom_sha256 ||
    visit.windows.find((w) => w.name === 'interpreterF378').machine_bytes.slice(34) !==
      taskFetchWindow.hex
  )
    throw Error('Fetch owner drift');
  const report = {
    rom_sha256: metadata.rom_sha256,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    windows,
    proofs: [proof],
    source_graph: {
      source_closed_to_dispatch: true,
      full_graph_closed: false,
      native_binding: false,
      code_bytes: windows.reduce((n, w) => n + w.covered_bytes, 0),
      instructions: map.size,
      minimum_protected_stack_bytes: null,
    },
    dispatch_entries: [
      {
        opcode: spec.opcode,
        word_source: cpuLabel(pc),
        target: cpuLabel(spec.entry),
        machine_bytes: raw.toString('hex').toUpperCase(),
        sha256: sha(raw),
      },
    ],
    synthetic_examples: examples,
    processor_reference:
      'WDC W65C816S13March2024: WORDPLA, BEQ/BNE on actualWORDZ, TAY/TAX/TXY WORD-X, nativeDP/bank00/DBR indexed/indirectdata, INC/DEC preservesC/V and JMP programbank. Instructionsemantics only; no device/timing evidence.',
    host_boundary: spec.host_boundary,
  };
  await writeFile(`analysis/render-task-${spec.name}.json`, JSON.stringify(report, null, 2) + '\n');
  await writeFile(`analysis/render-task-${spec.name}.asm.txt`, blocks.map(formatBlock).join('\n'));
  console.log(`${spec.name}: ${report.source_graph.code_bytes}/${map.size}, source toF390 only.`);
}
