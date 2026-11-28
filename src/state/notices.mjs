// Notice slots and duration share the independent window owner. Caller arguments
// and language fitting stay in this temporary bridge, outside notice game flow.
import { WINDOW_TEXT_FIELDS, windowsText } from './windows-text.mjs';
import { stateField } from './named-fields.mjs';
import { fitNoticeWindow } from '../data/language.mjs';
import * as W from '../data/wram.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
const states = new WeakMap();
export function noticeState(mem) {
  let state = states.get(mem);
  if (state) return state;
  const field = (name, index = 0) => stateField(mem, WINDOW_TEXT_FIELDS, windowsText, name, index),
    raw = (at) => ({
      get: () => mem.read16Bank0(at),
      set(value) {
        mem.write16Bank0(at, value);
      },
    });
  const slots = Array.from({ length: WINDOW_TEXT_FIELDS.noticeWindows.count }, (_, index) =>
    Object.defineProperties(
      { index },
      { window: field('noticeWindows', index), frames: field('noticeFrames', index) },
    ),
  );
  state = Object.defineProperties(
    { slots },
    {
      effectFrames: field('noticeEffectFrames'),
      window: raw(0),
      text: raw(2),
      frames: raw(W.DP_NOTICE_FRAMES),
      textNumber: raw(W.DP_NOTICE_TEXT),
      attributes: raw(W.DP_WINDOW_ATTRIBUTES),
    },
  );
  state.fitWindow = () =>
    fitNoticeWindow(
      mem,
      (at) => mem.read16Bank0(at),
      (at, value) => mem.write16Bank0(at, value),
    );
  state.resetWindows = () => {
    for (const slot of slots) slot.window = WORD_MASK;
  };
  state.chooseSlot = () => {
    let minimum = WORD_MASK,
      fewest;
    for (let index = slots.length - 1; index >= 0; index--) {
      if (slots[index].window & WORD_SIGN) return index;
      if (minimum >= slots[index].frames) {
        minimum = slots[index].frames;
        fewest = index;
      }
    }
    return fewest;
  };
  states.set(mem, state);
  return state;
}
