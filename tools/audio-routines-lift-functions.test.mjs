// Random per-function tests of the lifted audio table entries
// (src/apu/audio-routines.mjs) against the frozen outcomes (tools/lift-vectors/) of the former register-level references
// (proof/apu-reference/audio-routines.mjs): the sound driver command 81:F007 in
// both accumulator widths, the music change 81:EF47 with the cartridge's sound
// directory and the sound effect 80:C46E with its stereo levels 80:C416
// (docs/AUDIO-ROUTINES-LIFT.md). Both sides must leave the same WRAM
// outside the scratch, the same device writes and the registers their callers may
// read (A, X, the status flags, the stack pointer and the program counter).
import { prng, DialogTestMemory } from './task-native-dialog-harness.mjs';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import { sendApuCommandRoutine } from './register-forms/audio-routines.mjs';
import { setMusicModeRoutine } from './register-forms/audio-routines.mjs';
import { playSoundEffectJsr } from './register-forms/jsr-forms.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  APU_COMMAND_TOKEN = 0x1ce4,
  APU_PAIR_PENDING = 0x1ce6,
  MEMORY_8BIT = 0x20,
  // The sound directory pointer the game keeps at 7E:008C (from 98:FFFA, 81:F092).
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  SOUND_DIRECTORY = [0, 1, 2].map((n) => ROM.read8(0x98fffa + n)),
  // Not produced by the lifted code: direct page scratch, the sample loader's state
  // (7E:008C-008E stays compared) and the main stack.
  IGNORED = [
    [0x0000, 0x0034],
    [0x0089, 0x008c],
    [0x008f, 0x009a],
    [0x0100, 0x01ca],
  ];

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  wram.set(SOUND_DIRECTORY, 0x8c);
  wram[APU_PAIR_PENDING] = pick([0, 0, 0xff, 1]);
  wram[APU_COMMAND_TOKEN] = rnd(256);
  return { seed, wram, rnd, pick };
}

const side = (s) => createSide(s, new Map());
const summary = (names) => (h) => names.map((r) => h.ctx[r].toString(HEX)).join();
const registers = summary(['a', 'x', 'status', 's', 'pc', 'programBank']);
// The lifted side starts with the reference's registers and caller frame (long for
// the bank 81 routines).
const lifted =
  (run, result = registers, bank = 0x81) =>
  (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = bank;
    if (bank === 0x81) h.pushByte(0x81);
    h.push(0x1234, 2);
    run(h);
    return result(h);
  };
// C46E: the registers its callers may read; the status flags are not produced, nor
// Y after a sample set load (only offsets past the table load one).
// Game state only (user decision 2026-11-17): the lifted sound effect leaves no A, X
// and Y; the data bank, stack and return stay compared.
const effectRegisters = summary(['bank', 's', 'pc', 'programBank']);
const word = (wram, at, value) => {
  wram[at] = value & 0xff;
  wram[at + 1] = value >>> 8;
};

const CASES = [
  {
    name: 'sendApuCommand 81:F007',
    entry: 0x81f007,
    long: true,
    prepare: (s) => ({
      a: s.rnd(65536),
      x: s.rnd(65536),
      y: s.rnd(65536),
      status: s.pick([0, MEMORY_8BIT]) | (s.rnd(256) & 0xc7),
    }),
    lifted: lifted(sendApuCommandRoutine),
  },
  {
    name: 'setMusicMode 81:EF47',
    entry: 0x81ef47,
    long: true,
    samples: 120,
    prepare: (s) => ({
      a: s.pick([0, 8, 0xff, s.rnd(16), s.rnd(65536)]),
      x: s.rnd(65536),
      status: s.rnd(256) & 0xc7,
    }),
    lifted: lifted(setMusicModeRoutine),
  },
  {
    // Objects 0-43 or none, the 27 effects of 80:C4B3 and words beyond, cached and new sample sets
    // and voices, random levels and camera.
    name: 'playSoundEffect 80:C46E',
    entry: 0x80c46e,
    samples: 400,
    prepare: (s) => {
      // Offsets past the table read code words, some with bit 15 (a sample set).
      const effect = s.pick([2 * s.rnd(27), 2 * s.rnd(27), s.rnd(0x400)]);
      word(s.wram, 0, s.pick([0xffff, 0x8000, 2 * s.rnd(44), 2 * s.rnd(44)]));
      word(s.wram, 2, effect);
      word(s.wram, 4, s.rnd(65536));
      const voices = s.pick([1, 3, 0xc0, 0x80, s.rnd(65535) + 1]);
      word(s.wram, 6, voices);
      if (s.rnd(2)) word(s.wram, 0x1ce2, voices);
      if (s.rnd(2))
        word(s.wram, 0x1ce0, ROM.read8(0x80c4b3 + effect) | (ROM.read8(0x80c4b4 + effect) << 8));
      // Positions near the camera reach every clamp.
      const camera = s.rnd(0x1000);
      word(s.wram, 0x0cc4, camera);
      const object = s.wram[0] | (s.wram[1] << 8);
      if (object < 0x8000 && s.rnd(4)) {
        // The object's Y word minus its X word lands around the camera.
        const x = s.rnd(0x200);
        word(s.wram, 0x0e28 + object, x);
        word(s.wram, 0x0e80 + object, (x + camera - 0x600 + s.rnd(0x500) - 0x80) & 0xffff);
      }
      return { bank: s.pick([0x7e, 0x80, 0x81]), pc: 0xc46e };
    },
    lifted: lifted(playSoundEffectJsr, effectRegisters, 0x80),
  },
];

registerCases(CASES, { sample, side, runtime: (h) => h, ignored: IGNORED });
