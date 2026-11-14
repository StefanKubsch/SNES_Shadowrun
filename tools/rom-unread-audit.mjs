// Read-only evidence for the three unidentified data ranges. An operand
// search and recorded reads cannot prove that a range has no indirect reader.
// Usage: node tools/rom-unread-audit.mjs > .cache/logs/rom-unread-audit.json
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inspectRom, cpuToOffset, offsetToCpu, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { BYTE_BITS, WORD_MASK, HEX_RADIX } from '../src/constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_INDEX_8BIT } from '../src/constants/cpu-flags.mjs';

const WORD_BYTES = 2;
const READ_MNEMONICS = new Set([
  'LDA',
  'LDX',
  'LDY',
  'CMP',
  'CPX',
  'CPY',
  'ADC',
  'SBC',
  'AND',
  'ORA',
  'EOR',
  'BIT',
  'TSB',
  'TRB',
  'ASL',
  'LSR',
  'ROL',
  'ROR',
  'INC',
  'DEC',
]);
const WORD_MEMORY_MODES = new Set(['abs', 'absx', 'absy']);
const LONG_MEMORY_MODES = new Set(['long', 'longx']);
const LITERAL_MODES = new Set(['immM', 'immX', 'word']);
const UNUSED_CHARACTER_NAMES = ['Gorgax', 'Heavy Orc', 'Slick Dude', 'Wolf'];
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url));
const json = (name) => JSON.parse(read(name));
const address = (text) => parseInt(text.replace(':', ''), HEX_RADIX);

// Include every observed E/M/X state as well as the map's first traced state.
export function auditInstructionStarts(map, observed) {
  const starts = new Set(map.traced_starts);
  for (const [offset, states] of Object.entries(observed.starts)) {
    for (const state of states) {
      const [p, e] = state.split(' ');
      const status = parseInt(p, HEX_RADIX);
      starts.add(
        `${offset}:${e}${Number(Boolean(+e || status & FLAG_MEMORY_8BIT))}${Number(Boolean(+e || status & FLAG_INDEX_8BIT))}`,
      );
    }
  }
  return [...starts].sort();
}

// Match operands naming a byte in a range, including a word starting one
// byte before it. Absolute operands leave DBR unresolved; indexed operands
// leave the index unresolved. Bases farther away require separate review.
export function unreadOperandCandidates(bytes, starts, cpu, length) {
  const offset = cpuToOffset(cpu, bytes.length);
  const word = cpu & WORD_MASK;
  const candidates = [];
  for (const start of starts) {
    const [at, flags] = start.split(':');
    const ins = decode(bytes, offsetToCpu(parseInt(at, HEX_RADIX)), {
      e: +flags[0],
      m: +flags[1],
      x: +flags[2],
    });
    let kind;
    if (READ_MNEMONICS.has(ins.mnemonic) && LONG_MEMORY_MODES.has(ins.mode)) {
      let target;
      try {
        target = cpuToOffset(ins.value, bytes.length);
      } catch {
        continue;
      }
      if (target >= offset - 1 && target < offset + length) kind = 'long_memory_base';
    } else if (READ_MNEMONICS.has(ins.mnemonic) && WORD_MEMORY_MODES.has(ins.mode)) {
      if (ins.value >= word - 1 && ins.value < word + length)
        kind = 'absolute_memory_base_unknown_bank';
    } else if (LITERAL_MODES.has(ins.mode) && ins.value >= word - 1 && ins.value < word + length) {
      kind = 'literal_only';
    }
    if (kind)
      candidates.push({
        pc: cpuLabel(ins.cpu),
        state: flags,
        instruction: `${ins.mnemonic} ${ins.operand}`,
        kind,
      });
  }
  return candidates;
}

const overlap = (offset, length, ranges) =>
  ranges.reduce(
    (sum, [at, size]) =>
      sum + Math.max(0, Math.min(offset + length, at + size) - Math.max(offset, at)),
    0,
  );

export async function auditUnreadRom() {
  const { bytes, metadata } = inspectRom(read('Shadowrun (E).smc'));
  const manifest = json('assets/vm-cartridge.json');
  const map = json('analysis/vm-rom-map.json');
  const observed = json('analysis/rom-code-observed.json');
  const reads = json('analysis/rom-reads.json');
  const raw = json('assets/vm-raw.json');
  if (metadata.rom_sha256 !== manifest.source_rom_sha256 || map.rom_sha256 !== metadata.rom_sha256)
    throw new Error('Audit inputs must belong to the same European ROM');
  const cartridge = await loadCartridge(async (name) => new Uint8Array(read(`assets/${name}`)));
  const starts = auditInstructionStarts(map, observed);
  const matchesOriginal = (cpu, length) => {
    const offset = cpuToOffset(cpu, bytes.length);
    for (let i = 0; i < length; i++)
      if (!cartridge.present[offset + i] || cartridge.rom[offset + i] !== bytes[offset + i])
        return false;
    return true;
  };
  const ranges = raw.unread.map((run) => {
    const cpu = address(run.address),
      offset = cpuToOffset(cpu, bytes.length);
    const data = Buffer.from(run.hex, 'hex');
    if (!data.equals(bytes.subarray(offset, offset + data.length)))
      throw new Error(`Raw bytes differ from the ROM at ${run.address}`);
    const wordValues = [];
    for (let i = 0; i + 1 < data.length; i += WORD_BYTES)
      wordValues.push(data[i] | (data[i + 1] << BYTE_BITS));
    return {
      address: run.address,
      bytes: data.length,
      hex: run.hex,
      byte_min: Math.min(...data),
      byte_max: Math.max(...data),
      little_endian_words: wordValues,
      neighboring_map_ranges: map.ranges.filter((r) => {
        const at = parseInt(r.rom_offset, HEX_RADIX);
        return at < offset + data.length + 1 && at + r.length > offset - 1;
      }),
      recorded_native_read_bytes: overlap(offset, data.length, reads.ranges),
      original_code_bank_recording_applies: offset <= WORD_MASK,
      recorded_original_read_bytes:
        offset <= WORD_MASK
          ? Object.keys(observed.reads).filter((key) => {
              const at = parseInt(key, HEX_RADIX);
              return at >= offset && at < offset + data.length;
            }).length
          : null,
      operand_candidates: unreadOperandCandidates(bytes, starts, cpu, data.length),
      preserved_in_product: matchesOriginal(cpu, data.length),
    };
  });
  const texts = json('assets/vm-texts.json').texts;
  const kinds = json('assets/vm-kinds.json').kinds;
  const actions = json('assets/vm-actions.json');
  const pictures = new Map(json('assets/vm-pictures.json').pictures.map((p) => [p.address, p]));
  const unusedCharacters = UNUSED_CHARACTER_NAMES.map((name) => {
    const text = texts.find((t) => t.text === name);
    const kind = kinds.findIndex((k) => text && k.name === text.address);
    if (kind < 0) throw new Error(`Missing character named by the local TCRF PDF: ${name}`);
    const list = actions.blocks[actions.kinds[kind]];
    const frames = [...new Set(list.actions.flatMap((n) => actions.blocks[n].frames))];
    const tiles = [
      ...new Set(
        frames.flatMap((f) => {
          const picture = pictures.get(f);
          if (!picture) throw new Error(`Missing picture ${f} for ${name}`);
          return picture.tiles.flat();
        }),
      ),
    ];
    const OBJ_CHARACTER_BYTES = 64;
    return {
      name,
      kind,
      text: text.address,
      action_list: actions.kinds[kind],
      actions: list.actions,
      picture_count: frames.length,
      tile_source_count: tiles.length,
      tile_bytes_match_original: tiles.every((t) =>
        matchesOriginal(address(t), OBJ_CHARACTER_BYTES),
      ),
    };
  });
  return {
    source_rom_sha256: metadata.rom_sha256,
    scope:
      'Bounded evidence only. No proof of global unreachability; no data is removed or reclassified.',
    traced_instruction_starts: map.traced_starts.length,
    decoded_states: starts.length,
    map_conflicts: map.conflicts,
    original_read_scope: 'Existing original read recordings cover banks 80/81 only, not 8B/8D.',
    indirect_limit:
      'An index, computed pointer, transfer or another bank can reach a range without naming its base. Review neighboring readers separately.',
    unread_bytes: ranges.reduce((n, r) => n + r.bytes, 0),
    ranges,
    unused_character_scope:
      'Local TCRF main PDF page 4 names these characters; preserved European assets do not prove non-use during every story route.',
    unused_characters: unusedCharacters,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await auditUnreadRom(), null, 2));
