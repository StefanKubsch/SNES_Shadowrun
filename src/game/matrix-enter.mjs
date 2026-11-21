import { dataBankOf } from '../system/data-bank.mjs';
// Entering the Matrix (lifted from the script native 80:E30F; register-level reference in
// proof/game-reference/matrix-enter.mjs).
//
// The native requests the Matrix scene (FFFE) and keeps the room to return to; the deck
// gets 40 memory, and the matrix system, its extra nodes and the message list are kept
// as bytes. Then the decker's object number (direct page word 08) is searched in the
// runner table from the last runner down: the runner record's Computer skill becomes
// the decker's skill. From that runner's index down the group's numbers are searched:
// the member's object record gives the decker's health byte (its count byte) and the
// record pointer to write it back to. A miss ends either search (the original's index
// runs below zero), and an object without a record ends the native.
//
// Memory is reached as the original reaches it: the scene request, the deck bytes, the
// runner columns, the group slots and object records through the data bank, the room,
// the group numbers and the record's byte long in bank 7E, the runner record through the
// long pointer it leaves in the direct page words A2 and A4.
import {
  DECKER_COMPUTER_SKILL,
  DECKER_HEALTH,
  DECKER_MEMORY,
  DECKER_RECORD,
  GROUP_NUMBERS,
  GROUP_SLOTS,
  MATRIX_EXTRA_NODES,
  MATRIX_MESSAGES,
  MATRIX_SYSTEM,
  RECORD_COUNT,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_MATRIX,
  WRAM,
} from '../data/wram.mjs';
import {
  RECORD_COMPUTER,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { bankObjectWord } from '../state/objects.mjs';

// The arguments: the matrix system, the room to return to, the extra nodes, the message
// list and the decker's object number; the runner record's long pointer.
const DP_SYSTEM = 0,
  DP_ROOM = 2,
  DP_EXTRA_NODES = 4,
  DP_MESSAGES = 6,
  DP_DECKER = 8,
  DP_RECORD = 0xa2,
  DP_RECORD_BANK = 0xa4;
// The deck's memory.
const DECK_MEMORY = 0x40;
const ENTRY_BYTES = 2;

const bankAddress = (a, offset) => ((dataBankOf(a) << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value);
const setBankByte = (a, offset, value) => a.mem.write8(bankAddress(a, offset), value & BYTE_MASK);
const wramWord = (mem, offset) => mem.read16((WRAM + offset) & LONG_MASK);
const directWord = (mem, offset) => mem.read16Bank0(offset);

// The index from start down whose table word is the value, or -1 (the original's index
// below zero).
function searchDown(start, table, value) {
  for (let x = start; ;) {
    if (table(x) === value) return x;
    x = (x - ENTRY_BYTES) & WORD_MASK;
    if (x & WORD_SIGN) return -1;
  }
}

// 80:E30F: enter the Matrix with the arguments in the direct page words 00 to 08.
export function enterMatrix(mem, a) {
  setBankWord(a, SCENE_REQUEST, SCENE_REQUEST_MATRIX);
  mem.write16((WRAM + ROOM) & LONG_MASK, directWord(mem, DP_ROOM));
  setBankByte(a, DECKER_MEMORY, DECK_MEMORY);
  for (const [argument, field] of [
    [DP_MESSAGES, MATRIX_MESSAGES],
    [DP_SYSTEM, MATRIX_SYSTEM],
    [DP_EXTRA_NODES, MATRIX_EXTRA_NODES],
  ])
    setBankByte(a, field, mem.read8(argument));
  const runner = searchDown(
    RUNNER_LAST_INDEX,
    (x) => bankWord(a, RUNNER_OBJECT_NUMBERS + x),
    directWord(mem, DP_DECKER),
  );
  if (runner < 0) return;
  mem.write16Bank0(DP_RECORD, bankWord(a, RUNNER_RECORD_POINTERS + runner));
  mem.write8(DP_RECORD_BANK, mem.read8(bankAddress(a, RUNNER_RECORD_BANKS + runner)));
  const record = (mem.read8(DP_RECORD_BANK) << WORD_BITS) | directWord(mem, DP_RECORD);
  setBankByte(a, DECKER_COMPUTER_SKILL, mem.read8((record + RECORD_COMPUTER) & LONG_MASK));
  const member = searchDown(
    runner,
    (x) => wramWord(mem, GROUP_NUMBERS + x),
    directWord(mem, DP_DECKER),
  );
  if (member < 0) return;
  const objectRecord = bankObjectWord(a, 'record', bankWord(a, GROUP_SLOTS + member));
  if (objectRecord === 0) return;
  setBankByte(a, DECKER_HEALTH, mem.read8((WRAM + RECORD_COUNT + objectRecord) & LONG_MASK));
  setBankWord(a, DECKER_RECORD, objectRecord);
}
