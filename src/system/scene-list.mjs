import { writeStateByte } from '../state/objects.mjs';
// Scene command lists (lifted from 81:EC16 and its commands 81:EC41-ECD0, with the
// palette copy 81:ECF2; register-level version in proof/system/main-scene-video.mjs).
// A list of command bytes with their arguments sets up a screen: the NMI
// callback, packed graphics into VRAM, palettes and single registers. The
// command table scene_list_commands (81:EC2F) names the handler of each byte;
// a handler not known here stops at the frontier, as in the register-level
// version.
//
// The lifted list runs with 16-bit registers (the matrix requires them): the
// callback command then stores its bank as a word.
import { taskStop } from './task-stop.mjs';
import {
  sceneListCommands,
  SCENE_COMMAND_CALLBACK,
  SCENE_COMMAND_PALETTE,
  SCENE_COMMAND_PACKED_VRAM,
  SCENE_COMMAND_REGISTER,
} from '../data/scene-commands.mjs';
import { unpackStream } from './unpack.mjs';
import { videoOf } from '../video/picture-video.mjs';
import {
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  PALETTE_SHADOW,
  SCENE_LAYER_HIGH,
  WRAM,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const LONG_MASK = 0xffffff,
  // Single register writes address banks 80 (data bank of 81:ECB7).
  REGISTER_BANK = 0x800000,
  REGISTER_SITE = 0x81ecc7;
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Copy count colours from source (long address) to CGRAM from colour first and to
// the palette shadow in WRAM (81:ECF2). A count of 0 copies 64 KB of bytes.
export function copyPalette(mem, video, source, first, count) {
  const bytes = (count * 2) & WORD_MASK;
  let shadow = first * 2,
    offset = 0;
  const colours = [];
  do {
    const value = mem.read8((source + offset) & LONG_MASK);
    mem.write8(WRAM + PALETTE_SHADOW + (shadow & WORD_MASK), value);
    colours.push(value);
    shadow++;
    offset = (offset + 1) & WORD_MASK;
  } while (offset % 2 !== 0 || offset !== bytes);
  videoOf(video).setColourBytes(first, colours);
}

// Run the scene command list at list (long address).
export function runSceneList(mem, video, port, list) {
  const { wram } = mem,
    table = sceneListCommands(mem),
    v = videoOf(video);
  let at = 0;
  const byte = () => mem.read8((list + at++) & LONG_MASK),
    word = () => byte() | (byte() << BYTE_BITS);
  for (;;) {
    const command = mem.read8((list + at) & LONG_MASK);
    if (command === 0) return;
    at++;
    const handler = table[command];
    if (!handler?.operation)
      taskStop('main_scene_command_frontier', {
        target: handler?.target ?? null,
        commandIndex: command * 2,
      });
    if (handler.operation === SCENE_COMMAND_CALLBACK) {
      setWord(wram, NMI_CALLBACK, word());
      setWord(wram, NMI_CALLBACK_BANK, word());
    } else if (handler.operation === SCENE_COMMAND_PALETTE) {
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
    } else if (handler.operation === SCENE_COMMAND_PACKED_VRAM) {
      // Unpack into the scene buffer at 7E:46A8, then send it to VRAM by DMA.
      // The unpacking only fills WRAM, so it may precede the transfer's set-up.
      const address = word(),
        stream = word(),
        bank = word(),
        bytes = word();
      unpackStream(mem, ((bank & BYTE_MASK) << WORD_BITS) | stream, SCENE_LAYER_HIGH);
      v.transfer(0, { to: 'vram', address, bytes, source: WRAM + SCENE_LAYER_HIGH }, [
        'increment',
        'mode',
        'target',
        'address',
        'bytes',
        'source',
        'bank',
        'start',
      ]);
    } else if (handler.operation === SCENE_COMMAND_REGISTER) {
      const register = word();
      port.write(REGISTER_BANK | register, byte(), 1, REGISTER_SITE);
    }
  }
}
