import { runnerState } from '../state/runners.mjs';
import { jakeState } from '../state/jake.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// Optional player-requested changes. Layout and limits: docs/CHEATS.md.
import { CHEAT } from './cheat-settings.mjs';
import {
  NUYEN,
  RECORD_COUNT,
  DECKER_RECORD,
  DECKER_HEALTH,
  DECKER_COMPUTER_SKILL,
  MATRIX_HEALTH,
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  STORY_STAGE,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

// Actor 08B2, 8D:B01F + 08B2 + 1, points at Jake's state record.
export const JAKE_STATE_RECORD = 0x33dc;
export const ATTRIBUTE_MAX = 20,
  ORDINARY_STAT_MAX = 6,
  FIREARMS_MAX = 16;
export const RESOURCE_PER_ATTRIBUTE = 10;
const MATRIX_NMI = 0x81bec3;
const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const putWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, value >>> BYTE_BITS);
};

// Called before the damage store and its zero/death decision, rather than
// healing at the next frame after a lethal hit has already woken the task.
export function protectedJakeHealth(a, record, remaining) {
  if (!(a.vm?.cheats & CHEAT.health) || record !== JAKE_STATE_RECORD) return remaining;
  return jakeState(a.mem).maxHealth || remaining;
}

// A pad read is the common boundary for browser changes and recording replay.
// Never populate the zeroed cold-start WRAM before a character exists.
export function applyCheats(game) {
  const mask = game.vm.cheats;
  if (!mask) return;
  const wram = game.memory.wram,
    jake = jakeState(game.memory);
  if (!word(wram, STORY_STAGE) || !jake.body || !jake.maxHealth) return;
  let refillMagic = false;
  if (mask & CHEAT.stats) {
    jake.body = ATTRIBUTE_MAX;
    jake.strength = jake.charisma = ORDINARY_STAT_MAX;
    jake.maxHealth = ATTRIBUTE_MAX * RESOURCE_PER_ATTRIBUTE;
    for (const name of Object.keys(jake.skills))
      jake.skills[name] = name === 'firearms' ? FIREARMS_MAX : ORDINARY_STAT_MAX;
  }
  if (mask & CHEAT.spells) {
    for (const name of Object.keys(jake.spells)) {
      refillMagic ||= jake.spells[name] !== ORDINARY_STAT_MAX;
      jake.spells[name] = ORDINARY_STAT_MAX;
    }
  }
  if (mask & (CHEAT.stats | CHEAT.spells)) {
    refillMagic ||= jake.magic !== ATTRIBUTE_MAX;
    jake.magic = ATTRIBUTE_MAX;
    if (refillMagic)
      runnerState(game.memory, 0).magicPoints = ATTRIBUTE_MAX * RESOURCE_PER_ATTRIBUTE;
  }
  if (mask & CHEAT.money) {
    putWord(wram, NUYEN, WORD_MASK);
    putWord(wram, NUYEN + 2, WORD_MASK);
  }
  const matrix =
    word(wram, NMI_CALLBACK) === (MATRIX_NMI & WORD_MASK) &&
    readStateByte(wram, NMI_CALLBACK_BANK) === MATRIX_NMI >>> (2 * BYTE_BITS);
  if (matrix && word(wram, DECKER_RECORD) === JAKE_STATE_RECORD) {
    if (mask & CHEAT.stats) writeStateByte(wram, DECKER_COMPUTER_SKILL, jake.skills.computer);
    if (mask & CHEAT.health) {
      writeStateByte(wram, DECKER_HEALTH, jake.maxHealth);
      putWord(wram, MATRIX_HEALTH, readStateByte(wram, DECKER_HEALTH));
    }
  }
  if (mask & CHEAT.health && readStateByte(wram, JAKE_STATE_RECORD + RECORD_COUNT) > 0)
    writeStateByte(wram, JAKE_STATE_RECORD + RECORD_COUNT, jake.maxHealth);
}
