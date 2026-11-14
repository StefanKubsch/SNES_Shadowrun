import { cpuToOffset, cpuLabel, hex } from './rom.mjs';

// European-ROM table locations recovered from the ROM's own instructions.
// Do not apply the US randomizer's offsets or script names to these entries.
export const europeanTables = Object.freeze({
  scriptBanks: 0x15B28,
  scriptPointers: 0x15ED1,
  scriptReturnBytes: 0x16623,
  scriptArgumentBytes: 0x169CC,
  nativePointers: 0x157B8,
  nativeReturnBytes: 0x15970,
  nativeArgumentWords: 0x15A4C,
});
const evidence = [
  [0x42C8, 'BF28DB82'], // LDA $82:DB28,X: script bank
  [0x42CE, 'BFCCE982'], // LDA $82:E9CC,X: script argument bytes
  [0x42DB, 'BFD1DE82'], // LDA $82:DED1,X after TXA/ASL/TAX: pointer
  [0x74A9, 'BF23E682'], // LDA $82:E623,X: script return bytes
  [0x74D6, 'BF4CDA82'], // LDA $82:DA4C,X: native argument words
  [0x7500, 'BFB8D782'], // LDA $82:D7B8,X after TXA/ASL/TAX: native pointer
  [0x751D, 'BF70D982'], // LDA $82:D970,X: native return bytes
];

export function inspectScriptTables(bytes) {
  for (const [offset, expected] of evidence) {
    if (bytes.subarray(offset, offset + 4).toString('hex').toUpperCase() !== expected) {
      throw new Error(`European script-table access signature mismatch at ROM $${hex(offset)}`);
    }
  }
  const t = europeanTables;
  const count = t.scriptPointers - t.scriptBanks;
  if (t.scriptReturnBytes - t.scriptPointers !== count * 2 || t.scriptArgumentBytes - t.scriptReturnBytes !== count) {
    throw new Error('Script table sizes disagree');
  }
  const scripts = [];
  for (let id = 0; id < count; id++) {
    const bank = bytes[t.scriptBanks + id];
    const address = bytes.readUInt16LE(t.scriptPointers + id * 2);
    if (bank < 0x80 || bank > 0x9F || address < 0x8000) throw new Error(`Invalid script pointer ${id}`);
    const cpu = (bank << 16) | address;
    const offset = cpuToOffset(cpu, bytes.length);
    scripts.push({
      id: hex(id, 3), cpu_address: cpuLabel(cpu), rom_offset: hex(offset),
      argument_bytes: bytes[t.scriptArgumentBytes + id], return_bytes: bytes[t.scriptReturnBytes + id],
      scratch_bytes: bytes[offset], max_stack_bytes: bytes[offset + 1],
      header_semantics: 'Inferred from US reference; allocator reads these two bytes and adds $17 in European code',
      preview_hex_including_header: bytes.subarray(offset, Math.min(offset + 34, (Math.floor(offset / 0x8000) + 1) * 0x8000)).toString('hex').toUpperCase(),
    });
  }
  const nativeCount = (t.nativeReturnBytes - t.nativePointers) / 2;
  if (t.nativeArgumentWords - t.nativeReturnBytes !== nativeCount || t.scriptBanks - t.nativeArgumentWords !== nativeCount) {
    throw new Error('Native table sizes disagree');
  }
  const nativeFunctions = [];
  for (let id = 0; id < nativeCount; id++) {
    const address = bytes.readUInt16LE(t.nativePointers + id * 2);
    if (address < 0x8000) throw new Error(`Invalid native pointer ${id}`);
    const cpu = 0x800000 | address;
    nativeFunctions.push({
      id: hex(id, 2), cpu_address: cpuLabel(cpu), rom_offset: hex(cpuToOffset(cpu, bytes.length)),
      argument_words: bytes[t.nativeArgumentWords + id], return_bytes: bytes[t.nativeReturnBytes + id],
    });
  }
  return {
    scope: 'Table inventory. Script lengths, opcode meanings, and US-to-Europe semantic IDs are not yet established.',
    tables_rom_offsets: Object.fromEntries(Object.entries(t).map(([name, offset]) => [name, hex(offset)])),
    table_access_evidence: evidence.map(([offset, code]) => ({ rom_offset: hex(offset), instruction_bytes: code })),
    script_count: count, unique_script_addresses: new Set(scripts.map(s => s.rom_offset)).size,
    native_function_count: nativeCount, unique_native_addresses: new Set(nativeFunctions.map(s => s.rom_offset)).size,
    scripts, native_functions: nativeFunctions,
  };
}
