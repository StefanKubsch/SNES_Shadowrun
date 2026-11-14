// Lag-free frame events (user decision 2026-10-20, docs/NATIVE-CONTINUATION.md).
// Without a CPU timing model, an NMI arises only where the original cannot
// proceed without it: at the back branch of an original wait loop whose
// condition would branch back again right now. Working code runs through
// without an NMI (no lag frame, see docs/STRATEGY.md, slowdowns). The point is
// canonical: the back branch still uses the flags of the previous read, and the
// next read sees the value after RTI. Other points of the same loop differ
// only in the hardware frame below S.
//
// In the NMI the source answers exactly three device reads with a pinned PC:
//   00:C118 LDA $4210 (WORD)  value dead, TSC at C11B overwrites A and N/Z
//   80:9E0B LDA $4212 (WORD)  AND #$0001 at 9E0E; bit 0 = 0, pad read done
//   80:9E13 LDA $4218 (WORD)  input pad word latched once per NMI
// Book I PDF 140 (2-28-1) NMITIMEN, 145 (2-28-6) RDNMI, 146 (2-28-7) HVBJOY,
// 148 (2-28-9) pad bits. All other reads remain observation limits.
import { taskStop } from '../task/plan.mjs';
import { VmFault } from './memory.mjs';
import { WORD_BITS, WORD_MASK, BYTE_MASK, BYTE_BITS } from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BANK_WITHOUT_IO } from '../constants/memory-map.mjs';
import {
  APUIO0,
  APUIO3,
  HVBJOY,
  MDMAEN,
  MPYH,
  MPYL,
  NMITIMEN,
  NMITIMEN_AUTO_JOYPAD,
  NMITIMEN_NMI_ENABLE,
  OPHCT,
  OPVCT,
  RDNMI,
  RDVRAMH,
  SLHV,
  STAT77,
  STAT78_PAL,
  STDCNTRL1L,
} from '../constants/hardware-registers.mjs';

// The three pinned NMI reads of the header comment.
const PAD_STATUS_PC = 0x809e0b,
  PAD_READ_PC = 0x809e13;
// Is the address in a bank with the system area (registers)?
const inSystemArea = (address) => !((address >>> WORD_BITS) & BANK_WITHOUT_IO);

const Z = FLAG_ZERO,
  N = FLAG_NEGATIVE,
  EMPTY = Object.freeze([]);
const taken = (flag, set) => (status) => !!(status & flag) === set;
// Back branch -> condition under which it branches back (bytes from the ROM).
export const BLOCKING_BRANCHES = new Map([
  [0x81b0a9, taken(Z, true)], // B0A1: CMP 7E1C76 / BEQ B0A5
  [0x81eed1, taken(Z, true)], // EEBB: CMP 7E1C76 / BEQ EECD (BYTE counter path)
  [0x81acb2, taken(Z, false)], // ACAF: LDA 01F8 / BNE
  [0x81acc0, taken(Z, false)], // ACBD: LDA 01F6 / BNE
  [0x81acc6, taken(Z, false)], // ACC3: LDA 01FA / BNE
  [0x81accc, taken(Z, false)], // ACC9: LDA 01FC / BNE
  [0x81cf4f, taken(Z, false)], // CDF8 fade poll: LDA 11A3 / BNE CF4C
  [0x80901f, taken(N, false)], // LDA 0140 / BPL 901C
  [0x80ae0f, taken(Z, false)], // LDA 1562 / BNE AE0C
  [0x80ae61, taken(Z, false)], // LDA 1562 / BNE AE5E
  // Music beat of the sound driver on port 2 (frontend): the APU runs only per NMI.
  [0x81e1bb, taken(Z, false)], // LDA 2142 / CMP #2 / BNE E1B6
  [0x81e515, taken(Z, false)], // LDA 2142 / CMP #3 / BNE E510
  [0x81d6bd, taken(Z, false)], // LDA 2142 / BNE D6BA (title)
  [0x81d785, taken(Z, false)], // LDA 2142 / BNE D782
  [0x81d7a1, taken(Z, false)], // LDA 2142 / BNE D79E
  [0x81d7ba, taken(Z, false)], // LDA 2142 / BNE D7B7
  [0x81d7fa, taken(Z, false)], // LDA 2142 / BNE D7F7
]);
// Of these, the waits for the sound driver: with NMI disabled (title after
// loading) only audio time passes there, one sample (32 kHz) per back branch. The
// original polls without an interrupt until the driver answers; the CPU work
// itself stays timeless as in the rest of the model.
const APU_WAITS = new Set([0x81e1bb, 0x81e515, 0x81d6bd, 0x81d785, 0x81d7a1, 0x81d7ba, 0x81d7fa]);
// Standard pad: only the twelve buttons named in PDF 148. The manual does not name
// the lower four bits; 9E1A discards input with these bits set.
export const PAD_BUTTONS = 0xfff0;
// NMITIMEN after a device write (BYTE or WORD across 4200).
export function nmitimenAfterWrite(current, address, value, width) {
  if (!inSystemArea(address)) return current;
  for (let n = 0; n < width; n++)
    if (((address + n) & WORD_MASK) === NMITIMEN) current = (value >>> (BYTE_BITS * n)) & BYTE_MASK;
  return current;
}

export class LagFreeFrames {
  // onNmi runs at NMI entry before the handler: end of the visible frame.
  // pad(k) returns the word for live NMI k (from zero), read at 9E13.
  // apu (src/apu/apu.mjs) receives one frame of audio time per NMI.
  constructor({ pad = () => 0, nmitimen, onNmi = null, apu = null } = {}) {
    if (typeof pad !== 'function' || (onNmi !== null && typeof onNmi !== 'function'))
      throw new VmFault('frame_pad_source_required');
    if (
      nmitimen !== undefined &&
      !(Number.isInteger(nmitimen) && nmitimen >= 0 && nmitimen <= BYTE_MASK)
    )
      throw new VmFault('frame_nmitimen_required');
    this.pad = pad;
    this.nmitimen = nmitimen;
    this.onNmi = onNmi;
    this.apu = apu;
    this.inNmi = false;
    this.latched = undefined;
    this.nmis = 0;
    this.audioSamples = 0;
  }
  // Before the wait instruction at pc with the flags of the preceding read.
  nmiAt(status, pc) {
    const loops = BLOCKING_BRANCHES.get(pc);
    if (loops === undefined || !loops(status)) return false;
    if (this.inNmi) taskStop('frame_nested_nmi', { pc });
    // Without NMI enabled, the original halts at this loop forever.
    if (this.nmitimen === undefined) taskStop('frame_nmitimen_required', { pc });
    if (!(this.nmitimen & NMITIMEN_NMI_ENABLE)) {
      if (this.apu && APU_WAITS.has(pc)) {
        this.apu.advance(1);
        this.audioSamples++;
        return false;
      }
      taskStop('frame_nmi_disabled', { pc });
    }
    return true;
  }
  enterNmi() {
    this.onNmi?.(this.nmis);
    this.apu?.frame();
    this.inNmi = true;
    this.latched = undefined;
    this.nmis++;
  }
  leaveNmi() {
    this.inNmi = false;
    this.latched = undefined;
  }
  read(address, width, pc) {
    if (!this.inNmi || width !== 2) return undefined;
    const offset = address & WORD_MASK;
    if (offset === RDNMI && pc === NMI_MARK_PC) return 0;
    if (offset === HVBJOY && pc === PAD_STATUS_PC) return 0;
    if (offset !== STDCNTRL1L || pc !== PAD_READ_PC) return undefined;
    if (this.nmitimen === undefined || !(this.nmitimen & NMITIMEN_AUTO_JOYPAD))
      taskStop('frame_joypad_disabled', { pc });
    if (this.latched === undefined) {
      const word = this.pad(this.nmis - 1);
      if (!Number.isInteger(word) || word < 0 || word > WORD_MASK || word & ~PAD_BUTTONS)
        throw new VmFault('frame_pad_word_required', address, { pc, word });
      this.latched = word;
    }
    return this.latched;
  }
  write(address, value, width) {
    this.nmitimen = nmitimenAfterWrite(this.nmitimen, address, value, width);
  }
}

// Replacement for the H/V counter (user decision 2026-10-20, STRATEGY.md):
// the random routine C560 uses only the bytes of EOR 213C (80:C572) and EOR 213D
// (80:C57F); their value depends on CPU time, which the lag-free model does not
// know. xorshift32 returns one byte per read; the same seed gives the same
// sequence. This is explicitly not an original value.
const DEFAULT_COUNTER_SEED = 0x5eed1234,
  UINT32_MAX = 0xffffffff,
  // Marsaglia's xorshift32 shift triple.
  XORSHIFT_A = 13,
  XORSHIFT_B = 17,
  XORSHIFT_C = 5;
export function counterBytes(seed = DEFAULT_COUNTER_SEED) {
  if (!Number.isInteger(seed) || seed <= 0 || seed > UINT32_MAX)
    throw new VmFault('frame_counter_seed_required');
  let x = seed >>> 0;
  return () => {
    x ^= x << XORSHIFT_A;
    x >>>= 0;
    x ^= x >>> XORSHIFT_B;
    x ^= x << XORSHIFT_C;
    x >>>= 0;
    return x & BYTE_MASK;
  };
}
const COUNTER_READS = new Map([
  [0x80c572, OPHCT],
  [0x80c57f, OPVCT],
]);
// 81:D7DA LDA 213E (WORD) / AND #$1000: only STAT78 bit 4 (213F) remains, 1 = PAL
// (Book I PDF 137, 2-27-23). The European ROM runs on a PAL console;
// the other bits (version, field, latch, time over) are dead afterwards.
const PAL_STATUS_PC = 0x81d7da,
  PAL_STATUS_WORD = STAT78_PAL << BYTE_BITS;
// 81:EEC2 LDA 4212 / BMI EEC2 (EEBB with the NMI shadow $30 bit 7 cleared):
// without an NMI the lag-free model has no frame position; the CPU work is
// timeless, so it reads outside VBlank (Book I PDF 146, 2-28-7: bit 7
// V-blank, bit 6 H-blank, bit 0 pad read only in VBlank). The byte stays in the
// caller's A; at the reached caller 81:D737, EB7B (LDA $30) overwrites it.
const VBLANK_POLL_PC = 0x81eec2;
// C566 LDA 2137 (dead latch), A9E1 VRAM prefetch at 81:AA8E.
const DEAD_LATCH_PC = 0x80c566,
  VRAM_PREFETCH_PC = 0x81aa8e;
// The text mask transfer of the original uses DMA channel 5.
const TEXT_DMA_CHANNEL_BIT = 1 << 5;

// Devices with lag-free frames: each native or main loop call receives an
// empty observation set whose interrupt channel is the shared source.
// Writes also go to an optional device (for example PpuBus).
// With apu (src/apu/apu.mjs) the native audio unit answers 2140-2143; its
// time is driven by LagFreeFrames (one frame per NMI).
export const NMI_MARK_PC = 0x00c118; // LDA $4210 at NMI entry C112
export function isApuPort(address) {
  const offset = address & WORD_MASK;
  return inSystemArea(address) && offset >= APUIO0 && offset <= APUIO3;
}
export class LiveDevices {
  // counter(port, pc) returns the counter byte for the random routine (default counterBytes()).
  constructor(
    frames,
    interruptRoutines,
    { bus = null, counter = counterBytes(), apu = null } = {},
  ) {
    if (
      !(frames instanceof LagFreeFrames) ||
      !(interruptRoutines instanceof Map) ||
      typeof counter !== 'function'
    )
      throw new VmFault('frame_devices_required');
    this.frames = frames;
    this.bus = bus;
    this.counter = counter;
    this.counterReads = 0;
    this.apu = apu;
    this.set = Object.freeze({
      io: EMPTY,
      wait: EMPTY,
      input: EMPTY,
      interrupts: frames,
      interruptRoutines,
    });
    this.calls = 0;
  }
  peek(target) {
    return { ...this.set, target };
  }
  take(target) {
    this.calls++;
    return this.peek(target);
  }
  // With a PPU bus: the multiplication result 2134-2136 (Book I PDF 134) and
  // the A9E1 VRAM prefetch at 81:AA8E come from the PPU model, not from time.
  read(address, width, pc) {
    const offset = address & WORD_MASK,
      ppu = this.bus?.ppu;
    if (this.apu && isApuPort(address) && offset + width <= APUIO3 + 1) {
      let value = 0;
      for (let n = 0; n < width; n++)
        value |= this.apu.cpuRead(offset - APUIO0 + n) << (BYTE_BITS * n);
      return value;
    }
    if (inSystemArea(address) && width === 1) {
      // C566 LDA 2137 is dead: LDA C58D,Y at C569 replaces A and N/Z.
      if (offset === SLHV && pc === DEAD_LATCH_PC) return 0;
      if (COUNTER_READS.get(pc) === offset) {
        const value = this.counter(offset, pc);
        if (!Number.isInteger(value) || value < 0 || value > BYTE_MASK)
          throw new VmFault('frame_counter_byte_required', address, { pc, value });
        this.counterReads++;
        return value;
      }
    }
    if (offset === STAT77 && width === 2 && pc === PAL_STATUS_PC && inSystemArea(address))
      return PAL_STATUS_WORD;
    if (
      offset === HVBJOY &&
      width === 1 &&
      pc === VBLANK_POLL_PC &&
      inSystemArea(address) &&
      !this.frames.inNmi
    ) {
      if (this.frames.nmitimen === undefined || this.frames.nmitimen & NMITIMEN_NMI_ENABLE)
        throw new VmFault('frame_vblank_poll_with_nmi', address, { pc });
      return 0;
    }
    if (ppu && inSystemArea(address)) {
      if (offset >= MPYL && offset + width <= MPYH + 1) {
        let value = 0;
        for (let n = 0; n < width; n++) value |= ppu.readProduct(offset + n) << (BYTE_BITS * n);
        return value;
      }
      if (offset === RDVRAMH && width === 1 && pc === VRAM_PREFETCH_PC) return ppu.readVram(offset);
    }
    return this.frames.read(address, width, pc);
  }
  write(pc, address, value, width) {
    // Without a PPU, the channel-5 text mask transfer would silently miss WRAM.
    if (!this.bus && inSystemArea(address))
      for (let n = 0; n < width; n++)
        if (
          ((address + n) & WORD_MASK) === MDMAEN &&
          (value >>> (BYTE_BITS * n)) & TEXT_DMA_CHANNEL_BIT
        )
          throw new VmFault('frame_text_dma_device_required', address, { pc });
    this.frames.write(address, value, width);
    if (this.apu && isApuPort(address))
      this.apu.cpuWrite((address & WORD_MASK) - APUIO0, value, width);
    this.bus?.write(pc, address, value, width);
  }
}
