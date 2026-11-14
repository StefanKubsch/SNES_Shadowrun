// Objects bobbing up and down and circling on an orbit (lifted from the script natives
// 80:D714, 80:D73B and 80:D769 to 80:D793 with their body 80:D796; register-level
// references in proof/game-reference/object-bob.mjs).
//
// Both follow the wave table 80:D3D1 (a byte per phase 0 to 1FF, read through the data
// bank 80). A bob step stores the object in its bob word (7E:1D51, the second bob's
// 7E:1D4F), advances the phase (7E:1D57, 7E:1D59) by 20 and sets the object's height to
// the wave byte over 8 plus 160; the second bob reads the wave half a period later. An
// orbit step advances the member phase of its slot (7E:1CEF plus the slot) by 8; twice
// the wave byte (below 28 folded up: 28 plus half the shortfall) plus 174 becomes the
// height, the wave byte a quarter period later plus 648 the X position.
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  BOB_OBJECT,
  BOB_PHASE,
  BOB_SECOND_OBJECT,
  BOB_SECOND_PHASE,
  OBJECT_HEIGHT,
  OBJECT_X,
  SWARM_MEMBERS,
} from '../task/wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// Wave table 80:D3D1 of the bobbing, swarm and orbit natives (also the colour ramp of 80:8877):
// one byte per phase 0 to 1FF; 80 is a quarter and 100 half of the table.
export const WAVE_TABLE = 0xd3d1,
  PHASE_MASK = 0x1ff,
  WAVE_WORD_INDEX_MASK = 0x1fe,
  QUARTER_PHASE = 0x80,
  HALF_PHASE = 0x100;

const BOB_PHASE_STEP = 0x20,
  BOB_HEIGHT_SHIFT = 3,
  BOB_BASE_HEIGHT = 0x160,
  ORBIT_PHASE_STEP = 8,
  ORBIT_LOW_LIMIT = 0x28,
  ORBIT_BASE_HEIGHT = 0x174,
  ORBIT_BASE_X = 0x648;

const waveByte = (mem, phase) => dataBankWord(mem, WAVE_TABLE, phase) & BYTE_MASK;

// 80:D714 (second false) and 80:D73B (second true): one bob step of the object.
export function bobObject(mem, object, second) {
  const objectWord = second ? BOB_SECOND_OBJECT : BOB_OBJECT,
    phaseWord = second ? BOB_SECOND_PHASE : BOB_PHASE;
  setDataBankWord(mem, objectWord, 0, object);
  const phase = (dataBankWord(mem, phaseWord) + BOB_PHASE_STEP) & PHASE_MASK;
  setDataBankWord(mem, phaseWord, 0, phase);
  const wave = waveByte(mem, second ? (phase + HALF_PHASE) & PHASE_MASK : phase);
  setDataBankWord(
    mem,
    OBJECT_HEIGHT,
    dataBankWord(mem, objectWord),
    (wave >>> BOB_HEIGHT_SHIFT) + BOB_BASE_HEIGHT,
  );
}
// 80:D769 to 80:D793 (slot 0 to 14): one orbit step of the object.
export function advanceOrbit(mem, object, slot) {
  const phase = (dataBankWord(mem, SWARM_MEMBERS, slot) + ORBIT_PHASE_STEP) & PHASE_MASK;
  setDataBankWord(mem, SWARM_MEMBERS, slot, phase);
  let rise = 2 * waveByte(mem, phase);
  if (rise < ORBIT_LOW_LIMIT) rise = ((ORBIT_LOW_LIMIT - rise) >>> 1) + ORBIT_LOW_LIMIT;
  setDataBankWord(mem, OBJECT_HEIGHT, object, rise + ORBIT_BASE_HEIGHT);
  setDataBankWord(
    mem,
    OBJECT_X,
    object,
    waveByte(mem, (phase + QUARTER_PHASE) & PHASE_MASK) + ORBIT_BASE_X,
  );
}
