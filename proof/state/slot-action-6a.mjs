import { BYTE_MASK, BYTE_SIGN, WORD_MASK } from '../../src/constants/bits.mjs';
import { prepareSlotSelection, ACTION_FIELD, ANIMATION_CLOCK_RESTART } from './slot-selection.mjs';

const FRAME_COUNT_LIMIT = BYTE_SIGN;
const SELECTION_INDEX_MASK = 0x7fff;
const NO_SELECTION = WORD_MASK;
const ACTION_POINTER_WORD = 4;
const ACTION_BANK_WORD = 5;
const ACTION_DATA_BANK = 0x8c;
const PICTURE_RESTART = WORD_MASK;

// Pure bounded plan for $80:AAAF. D2 uses the same plan on the fields its
// preceding A985 phase would write, before either phase commits host state.
export function prepareSlotAction6A({
  offset,
  nextWord,
  definitionWord,
  fields,
  lowByte,
  actionData,
}) {
  const previousWord = fields['1198'];
  if (previousWord === null) return { handled: false, reason: 'slot_source_required' };
  const workspaceWords = [offset, nextWord];
  if (previousWord === nextWord) return { handled: true, fields: {}, workspaceWords };
  const branchWord = fields['10E8'];
  if (branchWord === null) return { handled: false, reason: 'slot_source_required' };
  if (branchWord > 0 && branchWord < FRAME_COUNT_LIMIT) {
    if (!actionData) return { handled: false, reason: 'slot_action_data_source_required' };
    const pointer = fields['1090'];
    if (pointer === null || lowByte === null)
      return { handled: false, reason: 'slot_source_required' };
    const oldData = actionData.readDataByte(pointer, previousWord);
    if (!oldData.available) return { handled: false, reason: oldData.reason };
    const newData = actionData.readDataByte(pointer, nextWord);
    if (!newData.available) return { handled: false, reason: newData.reason };
    return {
      handled: true,
      fields: {
        [ACTION_FIELD.DIRECTION]: nextWord,
        '7E:4030': ANIMATION_CLOCK_RESTART,
        [ACTION_FIELD.PICTURE_CHANGE]: PICTURE_RESTART,
      },
      lowByte: (lowByte - oldData.value + newData.value) & BYTE_MASK,
      workspaceWords,
      workspaceWrites: [
        { index: ACTION_POINTER_WORD, value: pointer },
        { index: ACTION_BANK_WORD, value: ACTION_DATA_BANK },
      ],
    };
  }
  const selection = fields['1038'];
  if (selection === null) return { handled: false, reason: 'slot_source_required' };
  if (selection !== NO_SELECTION) {
    const plan = prepareSlotSelection({
      selectionWord: selection & SELECTION_INDEX_MASK,
      currentSelection: NO_SELECTION,
      definitionWord,
      currentIndex: nextWord,
      actionData,
    });
    if (!plan.handled) return plan;
    return { ...plan, fields: { [ACTION_FIELD.DIRECTION]: nextWord, ...plan.fields } };
  }
  return { handled: true, fields: { [ACTION_FIELD.DIRECTION]: nextWord }, workspaceWords };
}
