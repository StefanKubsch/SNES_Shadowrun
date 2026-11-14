// Read-only classification of retained code bytes and data read margins.
// Usage: node tools/rom-code-audit.mjs > .cache/logs/rom-code-audit.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inspectRom, cpuToOffset, offsetToCpu, cpuLabel } from './rom.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { HEX_RADIX } from '../src/constants/bits.mjs';
import {
  ROM_CODE_CLASSES,
  isDataToCodeBoundary,
  isHardwareOnlyCodeRead,
} from './rom-code-retention.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url));
const json = (name) => JSON.parse(read(name));
const address = (text) => parseInt(text.replace(':', ''), HEX_RADIX);
const ROM_OFFSET_HEX_DIGITS = 5; // Physical offsets in the one MiB coverage recording.

export function classifyRetainedCode(classOf, nativeReads, originalReads, runs, romSize) {
  const original = new Map(
    Object.entries(originalReads).map(([at, pc]) => [parseInt(at, HEX_RADIX), pc]),
  );
  const rows = [];
  for (const run of runs) {
    const offset = cpuToOffset(address(run.address), romSize);
    for (let i = 0; i < run.hex.length / 2; i++) {
      const at = offset + i;
      const native = Boolean(nativeReads[at]);
      const nextPc = original.get(at) ?? null;
      const hardwareOnly = nextPc !== null && isHardwareOnlyCodeRead(at);
      const cpuRead = native || (nextPc !== null && !hardwareOnly);
      const margin = isDataToCodeBoundary(classOf, at);
      rows.push({
        address: cpuLabel(offsetToCpu(at)),
        offset: at,
        hex: run.hex.slice(2 * i, 2 * i + 2),
        code_class: classOf[at],
        previous_class: classOf[at - 1] ?? null,
        native_recorded: native,
        original_recorded_next_pc: nextPc,
        original_hardware_only: hardwareOnly,
        data_boundary: margin,
        category: cpuRead
          ? 'recorded_cpu_read'
          : hardwareOnly
            ? 'hardware_only_and_margin'
            : margin
              ? 'unobserved_data_margin'
              : 'unexplained',
      });
    }
  }
  return rows;
}

export async function auditRetainedCode() {
  const { bytes, metadata } = inspectRom(read('Shadowrun (E).smc'));
  const map = json('analysis/vm-rom-map.json');
  const raw = json('assets/vm-raw.json');
  const manifest = json('assets/vm-cartridge.json');
  const observed = json('analysis/rom-code-observed.json');
  const reads = json('analysis/rom-reads.json');
  if (
    [map.rom_sha256, raw.source_rom_sha256, manifest.source_rom_sha256].some(
      (sha) => sha !== metadata.rom_sha256,
    )
  )
    throw new Error('Code audit inputs must belong to the same European ROM');
  const classOf = new Array(bytes.length);
  for (const range of map.ranges) {
    const offset = parseInt(range.rom_offset, HEX_RADIX);
    classOf.fill(range.class, offset, offset + range.length);
  }
  const native = new Uint8Array(bytes.length);
  for (const [offset, length] of reads.ranges) native.fill(1, offset, offset + length);
  const cartridge = await loadCartridge(async (name) => new Uint8Array(read(`assets/${name}`)));
  const rows = classifyRetainedCode(classOf, native, observed.reads, raw.code_bytes, bytes.length);
  for (const row of rows) {
    const at = row.offset;
    if (
      !ROM_CODE_CLASSES.has(classOf[at]) ||
      !cartridge.present[at] ||
      cartridge.rom[at] !== bytes[at] ||
      parseInt(row.hex, HEX_RADIX) !== bytes[at]
    )
      throw new Error(`Retained code byte differs at ${row.address}`);
  }
  // The former rule kept an executed-code byte after any other code class
  // except code_kept. Those transitions are not data boundaries.
  const omittedTransitions = [];
  for (let at = 1; at < bytes.length; at++) {
    const previous = classOf[at - 1];
    if (
      classOf[at] !== 'code' ||
      !ROM_CODE_CLASSES.has(previous) ||
      previous === 'code' ||
      previous === 'code_kept'
    )
      continue;
    omittedTransitions.push({
      address: cpuLabel(offsetToCpu(at)),
      previous_class: previous,
      absent: !cartridge.present[at],
      native_recorded: Boolean(native[at]),
      original_recorded:
        observed.reads[
          at.toString(HEX_RADIX).toUpperCase().padStart(ROM_OFFSET_HEX_DIGITS, '0')
        ] !== undefined,
    });
  }
  const categories = {};
  for (const row of rows) categories[row.category] = (categories[row.category] ?? 0) + 1;
  return {
    source_rom_sha256: metadata.rom_sha256,
    scope:
      'Recorded reads and source-classified data boundaries. Unrecorded paths can still read absent code and report rom_byte_absent.',
    original_pc_note:
      'The read callback PC can be the following instruction. Resolve the actual reader from its source and CPU mode, not from this label alone.',
    retained_code_bytes: rows.length,
    raw_code_runs: raw.code_bytes.length,
    raw_bytes: manifest.raw_bytes,
    decoded_bytes: manifest.decoded_bytes,
    absent_code_bytes: manifest.absent_code_bytes,
    counts: categories,
    omitted_code_class_transitions: omittedTransitions.length,
    omitted_transitions: omittedTransitions,
    bytes: rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditRetainedCode(), null, 2));
