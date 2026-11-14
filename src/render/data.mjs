import { BANK_SIZE, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
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
} from '../constants/memory-map.mjs';

const WRAM_LAST_ADDRESS = WRAM_BASE + 2 * BANK_SIZE - 1;
// Explicit scratch write permissions of this manual owner, not a claim about
// task ownership: workspace DB-F2, word D8-D9 and three pointer words.
const SCRATCH_WORKSPACE_FIRST = WRAM_BASE + 0xdb,
  SCRATCH_WORKSPACE_LAST = WRAM_BASE + 0xf2,
  SCRATCH_WORD_LOW = WRAM_BASE + 0xd8,
  SCRATCH_WORD_HIGH = WRAM_BASE + 0xd9,
  SCRATCH_POINTER_BYTES = [
    WRAM_BASE + 0xa2,
    WRAM_BASE + 0xa3,
    WRAM_BASE + 0xa5,
    WRAM_BASE + 0xa6,
    WRAM_BASE + 0xa8,
    WRAM_BASE + 0xa9,
  ];

// Explicit bytes for a manual render plan. This owner is not connected to
// slots/tasks or their scratch owners. No implicit WRAM initialization.
const owners = new WeakMap();
const plans = new WeakMap();
const addressValid = (a) => Number.isInteger(a) && a >= 0 && a <= LONG_MASK;
export function renderAddress(address) {
  if (!addressValid(address)) throw Error('Invalid render address');
  const bank = address >>> WORD_BITS,
    offset = address & WORD_MASK;
  if (bank === WRAM_BANK || bank === WRAM_HIGH_BANK) return address;
  if (!(bank & BANK_WITHOUT_IO) && offset < LOW_RAM_END) return WRAM_BASE + offset;
  // Only the physical 1 MiB LoROM upper halves. No SRAM, I/O or
  // beyond-physical-ROM mirroring is inferred.
  if ((bank & MIRROR_BANK_MASK) < ROM_BANK_COUNT && offset >= LOROM_OFFSET)
    return address | CODE_BANK_BASE;
  return null;
}
export const isRenderData = (data) => owners.has(data);
const isWram = (a) => a >= WRAM_BASE && a <= WRAM_LAST_ADDRESS;
const renderScratch = (a) =>
  (a >= SCRATCH_WORKSPACE_FIRST && a <= SCRATCH_WORKSPACE_LAST) ||
  a === SCRATCH_WORD_LOW ||
  a === SCRATCH_WORD_HIGH ||
  SCRATCH_POINTER_BYTES.includes(a);
export function createRenderData({ writeWindows = [] } = {}) {
  if (
    !Array.isArray(writeWindows) ||
    Array.from(writeWindows).some(
      (w) =>
        !Array.isArray(w) ||
        w.length !== 2 ||
        !Array.from(w).every(addressValid) ||
        !Array.from(w).every(isWram) ||
        w[0] > w[1],
    )
  )
    throw Error('Invalid render write windows');
  const state = { bytes: new Map(), writeWindows: writeWindows.map((w) => [...w]), version: 0 };
  const data = Object.freeze({
    seed(address, values) {
      if (
        !addressValid(address) ||
        !(Array.isArray(values) || values instanceof Uint8Array) ||
        !values.length
      )
        throw Error('Invalid render seed');
      const entries = Array.from(values, (value, i) => {
        if (
          !Number.isInteger(value) ||
          value < 0 ||
          value > BYTE_MASK ||
          !addressValid(address + i)
        )
          throw Error('Invalid render seed');
        const mapped = renderAddress(address + i);
        if (mapped === null) throw Error('Unsupported render seed address');
        return [mapped, value];
      });
      for (const [a, v] of entries) state.bytes.set(a, v);
      state.version++;
    },
    readByte(address) {
      const mapped = renderAddress(address);
      if (mapped === null) return { available: false, reason: 'render_address_required', address };
      return state.bytes.has(mapped)
        ? { available: true, value: state.bytes.get(mapped) }
        : { available: false, reason: 'render_source_required', address: mapped };
    },
    snapshot: () => ({
      writeWindows: state.writeWindows.map((w) => [...w]),
      bytes: [...state.bytes].sort(([a], [b]) => a - b).map((e) => [...e]),
    }),
    commit(plan) {
      const prepared = plans.get(plan);
      if (!prepared || prepared.owner !== data) throw Error('Invalid render plan');
      if (prepared.version !== state.version)
        return { handled: false, reason: 'render_plan_stale' };
      for (const [a, v] of prepared.writes) state.bytes.set(a, v);
      state.version++;
      return { handled: true };
    },
  });
  owners.set(data, state);
  return data;
}

// One ordered overlay for source, output and DP aliases. Successful plans
// retain a private immutable commit payload and the source revision.
export function prepareRenderView(data, stackWindow = []) {
  const state = owners.get(data);
  if (!state) throw Error('Invalid render data');
  const version = state.version,
    bytes = new Map(state.bytes),
    writes = new Map(),
    reads = new Set();
  const fail = (reason, address) => {
    throw { renderBoundary: true, reason, address };
  };
  const resolve = (address) => {
    const a = renderAddress(address);
    if (a === null) fail('render_address_required', address);
    if (a >= stackWindow[0] && a <= stackWindow[1]) fail('render_stack_alias_required', a);
    return a;
  };
  return {
    read(address) {
      const a = resolve(address);
      reads.add(a);
      if (!bytes.has(a)) fail('render_source_required', a);
      return bytes.get(a);
    },
    write(address, value) {
      const a = resolve(address);
      if (
        !isWram(a) ||
        (!renderScratch(a) && !state.writeWindows.some(([first, last]) => a >= first && a <= last))
      )
        fail('render_write_window_required', a);
      bytes.set(a, value);
      writes.set(a, value);
    },
    finish(result) {
      const plan = Object.freeze({
        ...result,
        byteWrites: Object.freeze([...writes].map((e) => Object.freeze([...e]))),
        readAddresses: Object.freeze([...reads].sort((a, b) => a - b)),
      });
      plans.set(plan, { owner: data, version, writes: [...writes].map((e) => [...e]) });
      return plan;
    },
  };
}
