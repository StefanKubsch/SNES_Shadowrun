// Notice text numbers and effect sounds through the existing content readers.
import { textOfNumber } from './texts.mjs';
import { readTables } from '../data/tables.mjs';
import { TEXT_NUMBERS } from '../data/native-notice.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { taskStop } from '../system/task-stop.mjs';
const sounds = new WeakMap();
export function noticeText(mem, number) {
  const at = CODE_BANK_BASE + TEXT_NUMBERS + ((number << 1) & WORD_MASK);
  if (at + 1 > CODE_BANK_BASE + WORD_MASK) taskStop('notice_text_required', { text: number });
  return textOfNumber(mem, number);
}
export function noticeEffectSound(mem, index) {
  let entries = sounds.get(mem);
  if (!entries) {
    entries = readTables((at) => mem.read8(at)).find(
      (table) => table.name === 'upkeep_sound_args',
    ).values;
    sounds.set(mem, entries);
  }
  return entries[index];
}
