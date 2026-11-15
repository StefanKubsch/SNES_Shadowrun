// An object takes its place in the group's formation (lifted from the script native
// 80:BB2C; register-level reference in proof/game-reference/formation-place.mjs).
//
// The object's number is searched among the group's members (7E:2DF0, from the last word
// index 7E:2DE6 down; a miss gives the index FFFE). The member's step (80:BB88 plus the
// index: how many trail entries the member follows behind) plus the ring index 7E:0D18,
// less the ring's size from there on, selects an entry of the formation trail
// (src/game/formation-trail.mjs). An entry with a height of 0 was never recorded and
// leaves the object alone. Otherwise the object takes the entry's height, X and Y, turns
// to its direction (80:AAAF) and selects the walking action 2, or 0 while the player
// figure moves (80:A985).
import { selectObjectAnimation, turnObject } from './object-turn.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  FORMATION_INDEX,
  FORMATION_X,
  FORMATION_Y,
  FORMATION_HEIGHT,
  FORMATION_DIRECTION,
  FORMATION_LAST,
  FORMATION_UNMOVED,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The members' steps behind the newest trail entry (80:BB88, a word per member index).
const MEMBER_STEPS = 0xbb88,
  RING_BYTES = FORMATION_LAST + 2,
  MEMBER_BYTES = 2;
// The direct page: the object and the direction (then the action).
const DP_OBJECT = 0,
  DP_ARGUMENT = 2;
// The actions: walking, and standing while the player figure moves.
const WALKING = 2,
  STANDING = 0;
// The return words of the JSRs to the turn and the selection (the bank offsets of their
// last bytes).
const TURN_RETURN = 0xbb71,
  SELECTION_RETURN = 0xbb86;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A word of WRAM bank 7E at offset (which may cross into bank 7F).
const wramWord = (mem, offset) => mem.read16((WRAM + offset) & LONG_MASK);

// 80:BB2C: the object in word 00 takes its place in the formation; a takes the call
// frames of the turn and the selection.
export function placeInFormation(mem, a) {
  const { wram } = mem,
    object = word(wram, DP_OBJECT),
    number = dataBankWord(mem, OBJECT_NUMBER, object);
  let member = wramWord(mem, GROUP_INDEX);
  while (number !== wramWord(mem, GROUP_NUMBERS + member)) {
    member = (member - MEMBER_BYTES) & WORD_MASK;
    if (member & WORD_SIGN) break;
  }
  let entry =
    (dataBankWord(mem, MEMBER_STEPS, member) + dataBankWord(mem, FORMATION_INDEX)) & WORD_MASK;
  if (entry >= RING_BYTES) entry -= RING_BYTES;
  const height = wramWord(mem, FORMATION_HEIGHT + entry);
  if (height === 0) return;
  setDataBankWord(mem, OBJECT_HEIGHT, object, height);
  setDataBankWord(mem, OBJECT_X, object, wramWord(mem, FORMATION_X + entry));
  setDataBankWord(mem, OBJECT_Y, object, wramWord(mem, FORMATION_Y + entry));
  setWord(wram, DP_ARGUMENT, wramWord(mem, FORMATION_DIRECTION + entry));
  // PEI 00 keeps the object over the turn.
  a.pushWord(object);
  a.pushWord(TURN_RETURN);
  turnObject(mem, wram, a);
  a.pullWord();
  setWord(wram, DP_ARGUMENT, dataBankWord(mem, FORMATION_UNMOVED) === 0 ? WALKING : STANDING);
  setWord(wram, DP_OBJECT, a.pullWord());
  a.pushWord(SELECTION_RETURN);
  selectObjectAnimation(mem, wram);
  a.pullWord();
}
