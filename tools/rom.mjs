import { createHash } from 'node:crypto';

export const hex = (value, width = 6) => value.toString(16).toUpperCase().padStart(width, '0');
export const cpuLabel = address => `${hex(address >>> 16, 2)}:${hex(address & 0xFFFF, 4)}`;

export function stripCopierHeader(file) {
  const copierHeaderBytes = file.length % 0x8000 === 512 ? 512 : 0;
  return { bytes: file.subarray(copierHeaderBytes), copierHeaderBytes };
}

// Plain LoROM only; reject RAM, hardware, and offsets beyond the supplied ROM.
// ROM mirroring beyond the physical ROM is deliberately not inferred.
export function cpuToOffset(cpu, size) {
  if (!Number.isInteger(cpu) || cpu < 0 || cpu > 0xFFFFFF) throw new Error('Invalid CPU address');
  const bank = cpu >>> 16;
  const address = cpu & 0xFFFF;
  const b = bank & 0x7F;
  if (b === 0x7E || b === 0x7F || (address < 0x8000 && !(b >= 0x40 && b <= 0x6F))) {
    throw new Error(`Not a LoROM ROM address: ${cpuLabel(cpu)}`);
  }
  const offset = b * 0x8000 + (address & 0x7FFF);
  if (offset >= size) throw new Error(`ROM address beyond file: ${cpuLabel(cpu)}`);
  return offset;
}

export function offsetToCpu(offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset >= 0x400000) throw new Error('Invalid LoROM offset');
  return ((0x80 + Math.floor(offset / 0x8000)) << 16) | 0x8000 | (offset & 0x7FFF);
}

export function inspectRom(file) {
  const { bytes, copierHeaderBytes } = stripCopierHeader(file);
  if (bytes.length !== 0x100000) throw new Error('This research profile requires a 1 MiB Shadowrun ROM');
  const h = 0x7FC0;
  const title = bytes.subarray(h, h + 21).toString('ascii');
  if (title !== 'SHADOWRUN            ' || bytes[h + 21] !== 0x30) {
    throw new Error('Expected SHADOWRUN FastROM/LoROM header');
  }
  const vectorFields = {
    native_cop: 0x7FE4, native_brk: 0x7FE6, native_abort: 0x7FE8,
    native_nmi: 0x7FEA, native_irq: 0x7FEE,
    emulation_cop: 0x7FF4, emulation_abort: 0x7FF8,
    emulation_nmi: 0x7FFA, reset: 0x7FFC, emulation_irq_brk: 0x7FFE,
  };
  const vectors = Object.fromEntries(Object.entries(vectorFields).map(([name, offset]) => {
    const address = bytes.readUInt16LE(offset);
    return [name, { vector_rom_offset: hex(offset), cpu_address: cpuLabel(address), rom_offset: hex(cpuToOffset(address, bytes.length)) }];
  }));
  const checksum = bytes.readUInt16LE(h + 30);
  const complement = bytes.readUInt16LE(h + 28);
  const computedChecksum = bytes.reduce((sum, value) => sum + value, 0) & 0xFFFF;
  const metadata = {
    file_size_bytes: file.length, rom_size_bytes: bytes.length, copier_header_bytes: copierHeaderBytes,
    file_sha256: createHash('sha256').update(file).digest('hex'),
    rom_sha256: createHash('sha256').update(bytes).digest('hex'),
    title: title.trimEnd(), header_rom_offset: hex(h), map_mode: hex(bytes[h + 21], 2), mapping: 'FastROM / LoROM',
    cartridge_type: hex(bytes[h + 22], 2), declared_rom_size_bytes: 1024 * 2 ** bytes[h + 23],
    declared_sram_size_bytes: bytes[h + 24] === 0 ? 0 : 1024 * 2 ** bytes[h + 24],
    destination_code: hex(bytes[h + 25], 2), region: bytes[h + 25] === 2 ? 'Europe / PAL (header)' : 'Other region',
    licensee_code: hex(bytes[h + 26], 2), revision: bytes[h + 27],
    stored_checksum: hex(checksum, 4), stored_complement: hex(complement, 4), computed_checksum: hex(computedChecksum, 4),
    checksum_valid: checksum === computedChecksum, complement_valid: (checksum ^ complement) === 0xFFFF,
    vectors,
  };
  return { bytes, metadata };
}
