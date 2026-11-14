// The runners' state counts and magic points (lifted from 80:CECB, 80:CF2E and 80:D079
// with 80:D08A; register-level references in proof/game-reference/runner-state.mjs). The
// script natives call them before they redraw the window list
// (src/task/native-state-count-raise.mjs, src/task/native-runners-restore.mjs).
//
// A runner's member record (src/data/runners.mjs) holds the magic attribute in byte 1
// and the state count maximum in byte 5; the magic points of runner row n are the byte
// 7E:3C96 + n, ten times the magic attribute when full. An object's state count is the
// count byte of its object record.
import { taskStop } from '../task/plan.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  MAGIC_POINTS,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  RECORD_COUNT,
} from '../task/wram.mjs';
import {
  RECORD_COUNT_MAX,
  RECORD_MAGIC,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { ACTOR_RECORD, ACTOR_TABLE } from '../data/actors.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';

// The magic points are ten times the magic attribute: twice it plus eight times it.
const MAGIC_DOUBLE_SHIFT = 1,
  MAGIC_EIGHT_SHIFT = 3;

const wramWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
// The object fields are reached through the data bank 80 as the original does
// (src/system/data-bank.mjs).
const romWord = (mem, address) => mem.read8(address) | (mem.read8(address + 1) << BYTE_BITS);

// Search value in the word list at at from index down to 0; returns the index where
// it is (its sign bit clear) or the first negative index.
function searchDown(read, at, index, value) {
  for (;;) {
    if (read(at + index) === value) return index;
    index = (index - 2) & WORD_MASK;
    if (index & WORD_SIGN) return index;
  }
}
// The member record of the runner row (row index, or FFFE past the first row) as a long
// address plus offset, as the original adds it in 16 bits.
function runnerRecord(mem, row, offset) {
  const pointer =
      (romWord(mem, CODE_BANK_BASE + RUNNER_RECORD_POINTERS + row) + offset) & WORD_MASK,
    bank = mem.read8(CODE_BANK_BASE + RUNNER_RECORD_BANKS + row);
  return (bank << WORD_BITS) | pointer;
}

// The member of object: the object or, when its number is not in the group, the leader
// (the original searches forever when neither is; stop is the reason); returns the
// object and its runner row (FFFE when the number is no runner's).
function findMember(mem, object, stop) {
  const { wram } = mem,
    groupNumber = (at) => wramWord(wram, at),
    inGroup = (number) =>
      !(searchDown(groupNumber, GROUP_NUMBERS, wramWord(wram, GROUP_INDEX), number) & WORD_SIGN);
  let number = dataBankWord(mem, OBJECT_NUMBER, object);
  if (!inGroup(number)) {
    object = wramWord(wram, PLAYER_OBJECT);
    number = dataBankWord(mem, OBJECT_NUMBER, object);
    if (!inGroup(number)) taskStop(stop);
  }
  const row = searchDown(
    (at) => romWord(mem, CODE_BANK_BASE + at),
    RUNNER_OBJECT_NUMBERS,
    RUNNER_LAST_INDEX,
    number,
  );
  return { object, row };
}

// Raise the state count of object's member by amount, at most the member's maximum
// (80:CECB). The member is found by the object number among the group, else by the
// leader's (the original searches forever when neither is in the group). Returns the
// member record pointer at the maximum and the maximum, the original's direct page
// values.
export function raiseStateCount(mem, object, amount) {
  const { wram } = mem,
    { object: member, row } = findMember(mem, object, 'task_cecb_endless_search'),
    record = runnerRecord(mem, row, RECORD_COUNT_MAX),
    max = mem.read8(record),
    objectRecord = dataBankWord(mem, OBJECT_RECORD, member);
  if (objectRecord !== 0) {
    const raised = wram[RECORD_COUNT + objectRecord] + amount;
    wram[RECORD_COUNT + objectRecord] = (raised & WORD_MASK) >= max ? max : raised & BYTE_MASK;
  }
  return { record, max };
}

// Raise the magic points of object's member by amount, at most ten times its magic
// attribute (80:CF2E); the member is found as for the state count. Returns the
// original's direct page values: the record pointer's bank, twice the magic attribute
// (which the original stores over the pointer's word) and the maximum.
export function raiseMagicPoints(mem, object, amount) {
  const { wram } = mem,
    { row } = findMember(mem, object, 'task_native_cf2e_player_outside_group'),
    record = runnerRecord(mem, row, RECORD_MAGIC),
    doubleMagic = mem.read8(record) << MAGIC_DOUBLE_SHIFT,
    // Eight times the attribute plus twice it.
    max = (doubleMagic << (MAGIC_EIGHT_SHIFT - MAGIC_DOUBLE_SHIFT)) + doubleMagic,
    points = MAGIC_POINTS + (row >>> 1),
    raised = (wram[points] + amount) & WORD_MASK;
  wram[points] = (raised >= max ? max : raised) & BYTE_MASK;
  return { bank: record >>> WORD_BITS, doubleMagic, max };
}

// Refill the magic points and state counts of every runner with an object record
// (80:D079 with 80:D08A), from the last row to the first. Returns the original's direct
// page values of the first row: its record pointer and, when any runner was refilled,
// twice the last refilled magic attribute (a byte).
export function restoreRunners(mem) {
  const { wram } = mem;
  let record = 0,
    doubleMagic;
  for (let row = RUNNER_LAST_INDEX; row >= 0; row -= 2) {
    record = runnerRecord(mem, row, RECORD_MAGIC);
    const number = romWord(mem, CODE_BANK_BASE + RUNNER_OBJECT_NUMBERS + row),
      objectRecord = romWord(mem, ACTOR_TABLE + ACTOR_RECORD + number);
    if (objectRecord === 0) continue;
    const magic = mem.read8(record);
    doubleMagic = (magic << MAGIC_DOUBLE_SHIFT) & BYTE_MASK;
    wram[MAGIC_POINTS + (row >>> 1)] =
      (((magic << MAGIC_EIGHT_SHIFT) & BYTE_MASK) + doubleMagic) & BYTE_MASK;
    record = (record & ~WORD_MASK) | ((record + RECORD_COUNT_MAX - RECORD_MAGIC) & WORD_MASK);
    wram[RECORD_COUNT + objectRecord] = mem.read8(record);
  }
  return { record, doubleMagic };
}
