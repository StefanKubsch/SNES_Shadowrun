import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditPackedAssets, packedTokenMetrics } from './packed-asset-audit.mjs';
import { inspectRom } from './rom.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { requireRomAddress, romOffset } from '../src/data/rom-bytes.mjs';
import { lzDecode, lzBits } from '../src/data/lz.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { unpackStreamLong } from '../src/task/native-unpack.mjs';

const audit = await auditPackedAssets();
const bitsFor = lzBits((n) => cartridge.rom[romOffset(0x80a033 + n)]);

test('packed inventory covers all current assets and separates encoded slots from word margins', () => {
  assert.equal(audit.room_streams, 1536);
  assert.equal(audit.length_prefixed_streams, 253);
  assert.equal(audit.streams.length, 1789);
  assert.equal(audit.adjacent_streams, 1759);
  assert.equal(audit.missing_word_read_margins, 0);
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.formats).map(([format, v]) => [format, v.streams])),
    {
      room4: 1536,
      bg2: 4,
      credits: 1,
      text: 1,
      map: 27,
      obj4: 43,
      bg4: 11,
      scene: 165,
      states: 1,
    },
  );
  assert.equal(
    audit.streams.reduce((n, s) => n + s.word_read_margin_bytes, 0),
    883,
  );
  assert.ok(audit.streams.every((s) => s.output_overshoot_bytes === 0));
});

test('every packed slot and borrowed word margin equals the original European ROM', () => {
  const { bytes, metadata } = inspectRom(readFileSync('Shadowrun (E).smc'));
  assert.equal(metadata.rom_sha256, audit.source_rom_sha256);
  for (const row of audit.streams) {
    const start = romOffset(requireRomAddress(row.address));
    const length = row.packed_slot_bytes + row.word_read_margin_bytes;
    assert.deepEqual(
      Buffer.from(cartridge.rom.slice(start, start + length)),
      bytes.subarray(start, start + length),
      row.address,
    );
    assert.ok(cartridge.present.subarray(start, start + length).every(Boolean), row.address);
  }
  const first = audit.streams[0];
  assert.equal(first.address, '82:8000');
  assert.equal(
    first.header_bytes,
    0,
    'room sources own no length word before the recorded address',
  );
  assert.equal(first.end_exclusive, '82:8036');
  assert.equal(first.adjacent_stream, '82:8036');
  const credits = audit.streams.find((s) => s.address === '81:F2BD');
  assert.equal(credits.end_exclusive, '81:F48D');
  assert.equal(credits.next_class, 'scene_list');
});

test('gamma, selector and overlapping reference metrics retain word rounding', () => {
  for (const tokens of [[[1]], [[128]], [[1], [0, 3]], [[1], [0, 3], [0, 4]], [[1], [0, 3], [1]]]) {
    const result = packedTokenMetrics(tokens, bitsFor);
    assert.ok(result.native_read_bytes >= result.encoded_bytes);
    assert.ok(result.native_read_bytes <= result.encoded_bytes + 1);
  }
  assert.deepEqual(packedTokenMetrics([[1]], bitsFor), {
    token_output_bytes: 1,
    literal_bytes: 1,
    bit_count: 1,
    encoded_bytes: 4,
    native_read_bytes: 5,
  });
  assert.equal(packedTokenMetrics([[1], [0, 3]], bitsFor).token_output_bytes, 4);
  assert.equal(packedTokenMetrics([[128]], bitsFor).bit_count, 15);
  assert.equal(packedTokenMetrics([[1], [0, 3]], bitsFor).bit_count, 3);
  assert.equal(packedTokenMetrics([[1], [0, 3], [0, 4]], bitsFor).bit_count, 10);
  assert.equal(packedTokenMetrics([[1], [0, 3], [1]], bitsFor).bit_count, 5);
});

test('actual native unpack reads match audited endpoints and bit counts across formats', () => {
  // Exercise both margin parities per format where they occur. The full map
  // format includes matrix data; destination 2000 leaves enough WRAM for it.
  const selected = new Map();
  for (const row of audit.streams) {
    const key = `${row.format}:${row.word_read_margin_bytes}`;
    if (!selected.has(key)) selected.set(key, row);
  }
  for (const row of selected.values()) {
    const cpu = requireRomAddress(row.address);
    const entry = row.header_bytes ? 0x809f49 : 0x809e7e;
    const pointer = row.header_bytes ? cpu : cpu - 2;
    const mem = new VmMemory(cartridge.rom);
    mem.present = cartridge.present;
    const reads = [];
    const read8 = mem.read8.bind(mem);
    mem.read8 = (address) => {
      if (address >= cpu && address >>> 16 === cpu >>> 16) reads.push(address);
      return read8(address);
    };
    mem.write16(0x1ef1, 0x1234);
    const vm = {
      mem,
      a: pointer & 0xffff,
      x: 0x2000,
      y: pointer >>> 16,
      s: 0x1ef0,
      d: 0,
      dbr: 0x80,
      p: 0,
      pc: entry & 0xffff,
    };
    const accessor = new TaskAccessor(vm);
    accessor.load();
    accessor.ctx.programBank = 0x80;
    const result = unpackStreamLong(accessor, true, entry);
    assert.equal(result.bits, row.bit_count, row.address);
    assert.equal(result.literalBytes + result.referenceBytes, row.token_output_bytes, row.address);
    assert.equal(
      Math.max(...reads) + 1,
      cpu + row.header_bytes + row.native_read_bytes,
      row.address,
    );
    const decoded = lzDecode(
      (n) => cartridge.rom[romOffset(cpu + row.header_bytes + n)],
      row.output_bytes,
      bitsFor,
    );
    assert.deepEqual(mem.wram.slice(0x2000, 0x2000 + row.output_bytes), decoded.data, row.address);
  }
});
