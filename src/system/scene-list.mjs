// Scene command lists (lifted from 81:EC16 and its commands 81:EC41-ECD0, with the
// palette copy 81:ECF2; register-level version in src/task/main-scene-video.mjs).
// A list of command bytes with their arguments sets up a screen: the NMI
// callback, packed graphics into VRAM, palettes and single registers. The
// command table scene_list_commands (81:EC2F) names the handler of each byte;
// a handler not known here stops at the frontier, as in the register-level
// version.
//
// The lifted list runs with 16-bit registers (the matrix requires them): the
// callback command then stores its bank as a word.
import { taskStop } from '../task/plan.mjs';
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { unpackStream } from './unpack.mjs';
import {
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  PALETTE_SHADOW,
  SCENE_LAYER_HIGH,
  WRAM,
} from '../task/wram.mjs';
import {
  A1B0,
  A1T0L,
  BBAD0,
  CGADD,
  CGDATA,
  DAS0L,
  DMAP0,
  MDMAEN,
  VMADDL,
  VMAINC,
  VMDATAL,
} from '../constants/hardware-registers.mjs';
import { DMAP_TWO_PORTS, VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  COMMAND_BANK = 0x810000,
  // Single register writes address banks 80 (data bank of 81:ECB7).
  REGISTER_BANK = 0x800000,
  REGISTER_SITE = 0x81ecc7,
  DMA_CHANNEL_0 = 1,
  WRAM_BANK = WRAM >>> WORD_BITS;
// Handlers of the command table.
const NOTHING = [0xec41, 0xecce, 0xeccf, 0xecd0],
  SET_CALLBACK = 0xec42,
  PALETTE = 0xec4f,
  PACKED_TO_VRAM = 0xec68,
  REGISTER = 0xecb7;

const commands = (mem) =>
  decodeOnce(mem, 'scene_list_commands', (image) => tableEntries(image, 'scene_list_commands'));
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Copy count colours from source (long address) to CGRAM from colour first and to
// the palette shadow in WRAM (81:ECF2). A count of 0 copies 64 KB of bytes.
export function copyPalette(mem, video, source, first, count) {
  const bytes = (count * 2) & WORD_MASK;
  let shadow = first * 2,
    offset = 0;
  video.write(CGADD, first, 1);
  do {
    const value = mem.read8((source + offset) & LONG_MASK);
    mem.write8(WRAM + PALETTE_SHADOW + (shadow & WORD_MASK), value);
    video.write(CGDATA, value, 1);
    shadow++;
    offset = (offset + 1) & WORD_MASK;
  } while (offset % 2 !== 0 || offset !== bytes);
}

// Run the scene command list at list (long address).
export function runSceneList(mem, video, port, list) {
  const { wram } = mem,
    table = commands(mem);
  let at = 0;
  const byte = () => mem.read8((list + at++) & LONG_MASK),
    word = () => byte() | (byte() << BYTE_BITS);
  for (;;) {
    const command = mem.read8((list + at) & LONG_MASK);
    if (command === 0) return;
    at++;
    const handler = table[command];
    if (
      handler === undefined ||
      ![...NOTHING, SET_CALLBACK, PALETTE, PACKED_TO_VRAM, REGISTER].includes(handler)
    )
      taskStop('main_scene_command_frontier', {
        target: handler === undefined ? null : COMMAND_BANK | handler,
        commandIndex: command * 2,
      });
    if (handler === SET_CALLBACK) {
      setWord(wram, NMI_CALLBACK, word());
      setWord(wram, NMI_CALLBACK_BANK, word());
    } else if (handler === PALETTE) {
      const colours = word(),
        bank = word(),
        address = word();
      copyPalette(
        mem,
        video,
        ((bank & BYTE_MASK) << WORD_BITS) | address,
        colours >>> BYTE_BITS,
        colours & BYTE_MASK,
      );
    } else if (handler === PACKED_TO_VRAM) {
      // Unpack into the scene buffer at 7E:46A8, then send it to VRAM by DMA.
      video.write(VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 1);
      video.write(DMAP0, DMAP_TWO_PORTS, 1);
      video.write(BBAD0, VMDATAL & BYTE_MASK, 1);
      video.write(VMADDL, word(), 2);
      const stream = word(),
        bank = word();
      video.write(DAS0L, word(), 2);
      unpackStream(mem, ((bank & BYTE_MASK) << WORD_BITS) | stream, SCENE_LAYER_HIGH);
      video.write(A1T0L, SCENE_LAYER_HIGH, 2);
      video.write(A1B0, WRAM_BANK, 1);
      video.write(MDMAEN, DMA_CHANNEL_0, 1);
    } else if (handler === REGISTER) {
      const register = word();
      port.write(REGISTER_BANK | register, byte(), 1, REGISTER_SITE);
    }
  }
}
