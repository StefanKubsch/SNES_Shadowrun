// Release window handles and rewind text allocation after the last active window.
// Notice and glove cleanup share the same named state as their game consumers.
import { windowState, windowManagerState } from '../state/windows.mjs';
import { noticeState } from '../state/notices.mjs';
import { gloveState } from '../state/glove.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
export function* releaseWindowSequence(h, events) {
  const { mem } = h.a,
    state = windowManagerState(mem);
  yield () => {
    let handle = state.windowArgument;
    windowState(mem, handle).active = 0;
    if (handle !== state.lastIndex) return;
    do handle = (handle - 2) & WORD_MASK;
    while (!(handle & WORD_SIGN) && !windowState(mem, handle).active);
    const next = (handle + 2) & WORD_MASK;
    state.nextTile = windowState(mem, next).firstTile;
    state.lastIndex = handle;
  };
  yield* drawWindowListSequence(h, events);
}
export function* releaseNoticeWindowsSequence(h, events) {
  const { mem } = h.a,
    state = noticeState(mem);
  for (let index = state.slots.length - 1; index >= 0; index--) {
    const slot = state.slots[index],
      window = slot.window;
    if (window & WORD_SIGN) continue;
    yield* releaseWindowAt(h, events, window);
    yield () => {
      slot.window = WORD_MASK;
    };
  }
  yield () => {
    windowManagerState(mem).firstIndex = 0;
  };
}
export function* putGloveAwaySequence(h, events) {
  const state = gloveState(h.a.mem);
  yield () => {
    state.kind = 0;
  };
  if (state.targetTag & WORD_SIGN) return;
  yield* releaseGloveNameWindowSequence(h, events);
}
export function* releaseGloveNameWindowSequence(h, events) {
  const { mem } = h.a,
    glove = gloveState(mem),
    state = windowManagerState(mem);
  yield () => {
    state.windowArgument = glove.nameWindow;
  };
  yield* releaseWindowSequence(h, events);
  yield () => {
    glove.targetTag = WORD_MASK;
    glove.targetObject = WORD_MASK;
  };
}
export function* releaseNoticeWindowsCallSequence(h, events) {
  yield* releaseNoticeWindowsSequence(h, events);
}
export function* releaseWindowAt(h, events, window) {
  yield () => {
    windowManagerState(h.a.mem).windowArgument = window;
  };
  yield* releaseWindowSequence(h, events);
}
