// Show text in a notice window, optionally in translated pages. Four slots use
// the last free entry, then the shortest duration with the original tie order.
import { noticeState } from '../state/notices.mjs';
import { windowState } from '../state/windows.mjs';
import { noticeText } from '../content/notices.mjs';
import { openWindow, clearWindowText } from './window-open.mjs';
import { releaseWindowAt } from './window-release.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { WORD_SIGN } from '../constants/bits.mjs';

function* pagesSequence(h, events, renderBuffer, { id, pages }) {
  const { mem } = h.a,
    state = noticeState(mem),
    window = state.window,
    text = state.text;
  for (let page = 0; page < pages.length; page++) {
    if (page) {
      yield* waitForConfirmKey(h, events);
      yield* clearWindowText(h, events, window);
      yield () => {
        const record = windowState(mem, window);
        record.cursorTile = record.firstTile;
        record.initialTile = record.firstTile;
        record.cursorPixel = 0;
        record.leftPixel = 0;
        state.window = window;
        state.text = text;
      };
    }
    yield () => {
      mem.noticePage = { id, codes: pages[page] };
    };
    yield* printText(h, events, renderBuffer);
    yield () => {
      mem.noticePage = null;
    };
  }
}
export function* showNotice(h, events, renderBuffer = drawTextBuffer, shown = {}) {
  const { mem } = h.a,
    state = noticeState(mem);
  let paged, window, index, replace;
  yield () => {
    paged = state.fitWindow();
    if (state.attributes === 0x400) state.effectFrames = 30;
  };
  yield* openWindow(h, events);
  yield () => {
    window = state.window;
    state.text = noticeText(mem, state.textNumber);
  };
  if (paged) yield* pagesSequence(h, events, renderBuffer, paged);
  else yield* printText(h, events, renderBuffer);
  yield () => {
    index = state.chooseSlot();
    replace = !(state.slots[index].window & WORD_SIGN);
  };
  if (replace) yield* releaseWindowAt(h, events, state.slots[index].window);
  yield () => {
    state.slots[index].frames = state.frames;
    state.slots[index].window = window;
    shown.window = window;
    shown.slot = index * 2;
  };
}
export function* showNoticeSequence(h, events, renderBuffer = drawTextBuffer, shown = {}) {
  yield* showNotice(h, events, renderBuffer, shown);
}
