// Shared fixtures of the caller tests: a side (an accessor on its own copy of a sample's
// WRAM with the picture back end as its device bus), the outcome of a run on it and the
// differences of two outcomes.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { dialogAccess } from './register-forms/native-dialog-support.mjs';
import { TaskAccessor } from './register-forms/task-accessor.mjs';
import { PictureVideo } from '../src/video/picture-video.mjs';
import { setLiveChannels } from './picture-fixture.mjs';
import {
  DMAP0,
  HDMAEN,
  INIDISP,
  MDMAEN,
  MPYH,
  MPYL,
  RDVRAMH,
  RDVRAML,
  SETINI,
} from '../src/constants/hardware-registers.mjs';

const STACK = 0x1c9,
  // The main and NMI stacks: return words and saved registers, no game state.
  CPU_STACKS = [
    [0x0100, 0x01ca],
    [0x1c7c, 0x1cbc],
  ],
  APU_PORT_0 = 0x2140,
  APU_COMMAND_TOKEN = 0x1ce4,
  // Bank 81 for the data bank and the long caller frame.
  LONG_CALLER_BANK = 0x81,
  BYTE_VALUES = 0x100,
  WORD_VALUES = 0x10000,
  COUNTER_SALT = 0x5a5a5a5a,
  LISTED_BYTES = 8,
  HEX = 16,
  BYTE_BITS = 8,
  // The last DMA channel register (channel 7, 437F).
  DMA_REGISTERS_END = 0x437f;

// The register ports the picture back end takes: the PPU registers, the DMA starts and
// the DMA channel registers.
const isPicturePort = (at) =>
  (at >= INIDISP && at <= SETINI) ||
  at === MDMAEN ||
  at === HDMAEN ||
  (at >= DMAP0 && at <= DMA_REGISTERS_END);
// The picture state of a side as one byte array: video memory, palette, OAM and the
// scalar settings (removal plan step 5: the frozen tests compare the picture state, not
// the PPU register writes; user decision 2026-11-26).
export function pictureState(picture) {
  const settings = picture.settings(),
    parts = [
      picture.vram,
      new Uint8Array(picture.palette.buffer),
      picture.oam,
      new Uint8Array(settings.buffer, settings.byteOffset, settings.byteLength),
    ],
    out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// One side: a task accessor on its own copy of the sample's WRAM with its device
// writes recorded. The picture back end (src/video/picture-video.mjs) is the device bus:
// lifted code calls it directly, register-level code reaches it through its PPU and
// DMA register writes, and only the other device writes are listed. The sound driver
// echoes the command token on APU port 0; the multiplication product and VRAM read-back
// come from the picture; other reads (beam counters, joypad) get the same sequence of
// the sample on both sides.
// prepare(mem, s) may add language state to the memory.
export function createSide(s, routines, prepare = () => {}) {
  // The sample's SRAM, if it has one.
  const mem = new DialogTestMemory(s.wram.slice(), s.sram?.slice() ?? null);
  prepare(mem, s);
  const a = new TaskAccessor({
    mem,
    a: 0,
    x: 0,
    y: 0,
    s: STACK,
    d: 0,
    dbr: LONG_CALLER_BANK,
    p: 0,
    pc: 0,
  });
  a.load();
  a.ctx.programBank = LONG_CALLER_BANK;
  const writes = [],
    counter = prng(s.seed ^ COUNTER_SALT),
    record = (address, value, width) =>
      writes.push([address & (WORD_VALUES - 1), value, width].join());
  // DMA sources of random states may point at unmapped addresses, where the hardware
  // reads open bus; both sides read 0 there.
  const picture = new PictureVideo({
    read8(address) {
      try {
        return mem.read8(address);
      } catch (error) {
        if (error.reason !== 'unmapped_read') throw error;
        return 0;
      }
    },
    write8: (address, value) => mem.write8(address, value),
  });
  setLiveChannels(picture);
  // The CPU registers of the scene default reach the write list as hardware writes.
  picture.system = record;
  const pictureRead = (at) => {
    if (at === RDVRAML || at === RDVRAMH) return picture.readVram(at);
    if (at >= MPYL && at <= MPYH) return picture.readProduct(at);
    return null;
  };
  a.io = [];
  a.devices = {
    bus: picture,
    read(address, width) {
      const at = address & (WORD_VALUES - 1);
      if (at === APU_PORT_0) return mem.wram[APU_COMMAND_TOKEN];
      const low = pictureRead(at);
      if (low !== null) return width === 1 ? low : low | (pictureRead(at + 1) << BYTE_BITS);
      return (
        Math.floor(counter() * WORD_VALUES) & (width === 1 ? BYTE_VALUES - 1 : WORD_VALUES - 1)
      );
    },
    write(pc, address, value, width) {
      if (isPicturePort(address & (WORD_VALUES - 1))) picture.write(pc, address, value, width);
      else record(address, value, width);
    },
  };
  return { mem, a, h: dialogAccess(a), writes, picture, routines };
}
export function outcome(state, run, ignored) {
  let result, stop;
  try {
    result = run();
  } catch (error) {
    if (!error.reason) throw error;
    stop = error.reason;
  }
  const wram = state.mem.wram.slice();
  for (const [from, to] of [...CPU_STACKS, ...ignored]) wram.fill(0, from, to);
  return {
    result,
    stop,
    wram,
    sram: state.mem.sram?.slice(),
    writes: state.writes,
    picture: state.picture ? pictureState(state.picture) : null,
  };
}
export function differences({ want, got }) {
  const out = [];
  if (want.stop !== got.stop) out.push(`stop ${want.stop} / ${got.stop}`);
  if (want.stop || got.stop) return out;
  if (want.result !== undefined && want.result !== got.result)
    out.push(`result ${want.result} / ${got.result}`);
  const bytes = [];
  for (let i = 0; i < want.wram.length && bytes.length < LISTED_BYTES; i++)
    if (want.wram[i] !== got.wram[i])
      bytes.push(`${i.toString(HEX)}:${want.wram[i].toString(HEX)}/${got.wram[i].toString(HEX)}`);
  if (bytes.length) out.push(`wram ${bytes.join(' ')}`);
  if (want.sram && want.sram.some((v, i) => v !== got.sram[i])) out.push('sram');
  if (want.writes.join(';') !== got.writes.join(';'))
    out.push(`writes ${want.writes.length} / ${got.writes.length}`);
  if (want.picture && !want.picture.every((v, i) => v === got.picture?.[i])) out.push('picture');
  return out;
}
