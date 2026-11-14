import { BYTE_MASK, BYTE_SIGN, HIGH_BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { isWord } from '../script/runtime.mjs';
import { isSlotActionData } from './slot-action-data.mjs';

// Existing proof field keys are hexadecimal address text, including digit-only keys.
export const ACTION_FIELD = Object.freeze({
  SELECTION: '1038',
  DIRECTIONS: '1090',
  PALETTE: '1248',
  PICTURE_CHANGE: '1140',
  DIRECTION: '1198',
});
const ACTION_HEADER_BYTES = 8;
const SELECTION_CARRY_BIT = 15;
const ACTION_DATA_BANK = 0x8c;
const ACTION_BYTE = { BOX_X1: 3, BOX_X2: 4, BOX_Y1: 5, BOX_Y2: 6, HEIGHT: 7 };
export const ANIMATION_CLOCK_RESTART = 0x80;
const PICTURE_RESTART = WORD_MASK;

// $A99D ASL supplies bit 15 to ADC. Its outgoing carry survives LDA/STA
// through $A9B1 and participates in the second pointer calculation.
export function slotSelectionEntry(tableWord, selectionWord) {
  if (!isWord(tableWord) || !isWord(selectionWord)) throw new Error('Invalid slot selection word');
  const sum =
    tableWord + ((selectionWord * 2) & WORD_MASK) + (selectionWord >>> SELECTION_CARRY_BIT);
  return { pointer: sum & WORD_MASK, carry: sum > WORD_MASK ? 1 : 0 };
}

// A bounded data plan for $80:A985, not a CPU/address bus. Validate all
// source reads before the host commits an action; unknown reads are a port
// boundary, not a rollback behavior claimed for the original routine.
export function prepareSlotSelection({
  selectionWord,
  currentSelection,
  definitionWord,
  currentIndex,
  actionData,
}) {
  if (!isWord(selectionWord) || (currentSelection !== null && !isWord(currentSelection)))
    throw new Error('Invalid slot selection input');
  if (currentSelection === null) return { handled: false, reason: 'slot_source_required' };
  if (selectionWord === currentSelection)
    return { handled: true, fields: {}, workspaceWords: null };
  if (!actionData) return { handled: false, reason: 'slot_action_data_source_required' };
  if (!isSlotActionData(actionData)) throw new Error('Invalid slot action source');
  if (currentIndex === null) return { handled: false, reason: 'slot_source_required' };
  if (!isWord(currentIndex)) throw new Error('Invalid slot index word');
  const table = actionData.readDefinitionPointer(definitionWord);
  if (!table.available) return { handled: false, reason: table.reason };
  const entry = slotSelectionEntry(table.value, selectionWord);
  const record = actionData.readDataWord(entry.pointer);
  if (!record.available) return { handled: false, reason: record.reason };
  const counterPointer = (record.value + ACTION_HEADER_BYTES + entry.carry) & WORD_MASK;
  // Every source LDA here is 16-bit, even though AND #00FF keeps only low.
  const counter = actionData.readDataWord(counterPointer, currentIndex);
  if (!counter.available) return { handled: false, reason: counter.reason };
  const bytes = [];
  for (let index = 0; index < ACTION_HEADER_BYTES; index++) {
    const read = actionData.readDataWord(record.value, index);
    if (!read.available) return { handled: false, reason: read.reason };
    bytes.push(read.value & BYTE_MASK);
  }
  const signed = (byte) => (byte < BYTE_SIGN ? byte : byte | HIGH_BYTE_MASK);
  return {
    handled: true,
    workspaceWords: [
      entry.pointer,
      ACTION_DATA_BANK,
      record.value,
      ACTION_DATA_BANK,
      counterPointer,
      ACTION_DATA_BANK,
    ],
    fields: {
      [ACTION_FIELD.SELECTION]: selectionWord,
      [ACTION_FIELD.DIRECTIONS]: counterPointer,
      '11F0': counter.value & BYTE_MASK,
      '7E:4088': bytes[0],
      '10E8': bytes[1] ^ BYTE_SIGN,
      '7E:3FD8': 1,
      [ACTION_FIELD.PALETTE]: bytes[2],
      '7E:4240': signed(bytes[ACTION_BYTE.BOX_X1]),
      '7E:4298': signed(bytes[ACTION_BYTE.BOX_X2]),
      '7E:42F0': signed(bytes[ACTION_BYTE.BOX_Y1]),
      '7E:4348': signed(bytes[ACTION_BYTE.BOX_Y2]),
      '7E:43A0': bytes[ACTION_BYTE.HEIGHT],
      '7E:4030': ANIMATION_CLOCK_RESTART,
      [ACTION_FIELD.PICTURE_CHANGE]: PICTURE_RESTART,
    },
  };
}
