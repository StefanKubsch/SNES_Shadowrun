import { readStateByte, writeStateByte } from '../state/objects.mjs';
// Optional player-requested changes. Layout and limits: docs/CHEATS.md.
import { CHEAT } from './cheat-settings.mjs';
import { RECORD_ATTRIBUTE, RECORD_SKILL, RECORD_SPELL } from '../data/runners.mjs';
import {
  JAKE_BODY,
  NUYEN,
  MAGIC_POINTS,
  RECORD_COUNT,
  DECKER_RECORD,
  DECKER_HEALTH,
  DECKER_COMPUTER_SKILL,
  MATRIX_HEALTH,
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  STORY_STAGE,
  WRAM,
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
  return a.mem.read8(WRAM + JAKE_BODY + RECORD_ATTRIBUTE.count_max) || remaining;
}

// A pad read is the common boundary for browser changes and recording replay.
// Never populate the zeroed cold-start WRAM before a character exists.
export function applyCheats(game) {
  const mask = game.vm.cheats;
  if (!mask) return;
  const wram = game.memory.wram;
  if (
    !word(wram, STORY_STAGE) ||
    !readStateByte(wram, JAKE_BODY) ||
    !readStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.count_max)
  )
    return;
  let refillMagic = false;
  if (mask & CHEAT.stats) {
    writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.body, ATTRIBUTE_MAX);
    writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.strength, ORDINARY_STAT_MAX);
    writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.charisma, ORDINARY_STAT_MAX);
    writeStateByte(
      wram,
      JAKE_BODY + RECORD_ATTRIBUTE.count_max,
      ATTRIBUTE_MAX * RESOURCE_PER_ATTRIBUTE,
    );
    for (const [name, offset] of Object.entries(RECORD_SKILL))
      writeStateByte(
        wram,
        JAKE_BODY + offset,
        name === 'firearms' ? FIREARMS_MAX : ORDINARY_STAT_MAX,
      );
  }
  if (mask & CHEAT.spells) {
    for (const offset of Object.values(RECORD_SPELL)) {
      refillMagic ||= readStateByte(wram, JAKE_BODY + offset) !== ORDINARY_STAT_MAX;
      writeStateByte(wram, JAKE_BODY + offset, ORDINARY_STAT_MAX);
    }
  }
  if (mask & (CHEAT.stats | CHEAT.spells)) {
    refillMagic ||= readStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.magic) !== ATTRIBUTE_MAX;
    writeStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.magic, ATTRIBUTE_MAX);
    if (refillMagic) writeStateByte(wram, MAGIC_POINTS, ATTRIBUTE_MAX * RESOURCE_PER_ATTRIBUTE);
  }
  if (mask & CHEAT.money) {
    putWord(wram, NUYEN, WORD_MASK);
    putWord(wram, NUYEN + 2, WORD_MASK);
  }
  const matrix =
    word(wram, NMI_CALLBACK) === (MATRIX_NMI & WORD_MASK) &&
    readStateByte(wram, NMI_CALLBACK_BANK) === MATRIX_NMI >>> (2 * BYTE_BITS);
  if (matrix && word(wram, DECKER_RECORD) === JAKE_STATE_RECORD) {
    if (mask & CHEAT.stats)
      writeStateByte(
        wram,
        DECKER_COMPUTER_SKILL,
        readStateByte(wram, JAKE_BODY + RECORD_SKILL.computer),
      );
    if (mask & CHEAT.health) {
      writeStateByte(
        wram,
        DECKER_HEALTH,
        readStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.count_max),
      );
      putWord(wram, MATRIX_HEALTH, readStateByte(wram, DECKER_HEALTH));
    }
  }
  if (mask & CHEAT.health && readStateByte(wram, JAKE_STATE_RECORD + RECORD_COUNT) > 0)
    writeStateByte(
      wram,
      JAKE_STATE_RECORD + RECORD_COUNT,
      readStateByte(wram, JAKE_BODY + RECORD_ATTRIBUTE.count_max),
    );
}
