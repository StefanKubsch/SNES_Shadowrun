// The register-level entries of lifted upkeep, window, text and dialog routines for
// the remaining register-level call tables (moved from src/game/main-upkeep.mjs; the live
// game composes the lifted sequences directly). Each entry runs its lifted sequence
// inside the original call frame; the ones that wait are native call continuations,
// found by their run function.
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import { showNoticeSequence } from '../../src/game/notice-show.mjs';
import {
  putGloveAwayRoutineSequence,
  releaseNoticeWindowsRoutineSequence,
  releaseWindowSequence,
} from '../../src/game/window-release.mjs';
import { closeDialogSequence, talkSequence } from '../../src/game/dialog-talk.mjs';
import {
  chooseDialogActionSequence,
  chooseDialogTopicSequence,
} from '../../src/game/dialog-menus.mjs';
import { showDialogTextSequence } from '../../src/game/dialog-text.mjs';
import {
  closePortraitWindowSequence,
  openPortraitWindowSequence,
} from '../../src/game/portrait-window.mjs';
import {
  uploadFirstPortraitSequence,
  uploadSecondPortraitSequence,
} from '../../src/game/portrait-upload.mjs';
import { reloadObjectTilesSequence } from '../../src/game/object-tiles.mjs';
import { printNumberSequence } from '../../src/game/window-text.mjs';
import { printTextSequence } from '../../src/game/text-print.mjs';
import { drawTextBufferSequence } from '../../src/game/text-draw.mjs';
import { openWindowSequence } from '../../src/game/window-open.mjs';
import { chooseActionSequence } from '../../src/game/action-menu.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// 80:FEC1, called with JSR; its window, text and release wait for the NMI, so it is a
// native call continuation. The register-level notice keeps the target's registration,
// so this one is found by its run function.
export function runShowNotice(h, events) {
  return drainNativeSequence(noticeRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runShowNotice, {
  run: runShowNotice,
  create: ({ h, events }) => new NativeCallContinuation(h.a, noticeRoutineSequence(h, events)),
});
// 80:BCB2, called with JSR; its name window release waits for the NMI.
export function runPutGloveAway(h, events) {
  return drainNativeSequence(putGloveAwayRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPutGloveAway, {
  run: runPutGloveAway,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, putGloveAwayRoutineSequence(h, events)),
});
// 80:FD80, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintNumber(h, events) {
  return drainNativeSequence(printNumberSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintNumber, {
  run: runPrintNumber,
  create: ({ h, events }) => new NativeCallContinuation(h.a, printNumberSequence(h, events)),
});
// 80:FE69, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintText(h, events) {
  return drainNativeSequence(printTextSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintText, {
  run: runPrintText,
  create: ({ h, events }) => new NativeCallContinuation(h.a, printTextSequence(h, events)),
});
// 80:FB39, called with JSR; its upload requests wait for the NMI.
export function runDrawTextBuffer(h, events) {
  return drainNativeSequence(drawTextBufferSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runDrawTextBuffer, {
  run: runDrawTextBuffer,
  create: ({ h, events }) => new NativeCallContinuation(h.a, drawTextBufferSequence(h, events)),
});
// 80:F963, called with JSR; its tile request and map upload wait for the NMI.
export function runOpenWindow(h, events) {
  return drainNativeSequence(openWindowSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runOpenWindow, {
  run: runOpenWindow,
  create: ({ h, events }) => new NativeCallContinuation(h.a, openWindowSequence(h, events)),
});
// 80:99EB, called with JSR; its window, menu and release wait for the NMI. The register
// form: the accepted actions in A, the chosen flag left in A.
export function runChooseAction(h, events) {
  return drainNativeSequence(chooseActionRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runChooseAction, {
  run: runChooseAction,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, chooseActionRoutineSequence(h, events)),
});
// 80:FA3E, called with JSR; its window list waits for the NMI of its upload.
function* releaseWindowCallSequence(h, events) {
  yield* releaseWindowSequence(h, events);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
export function runReleaseWindow(h, events) {
  return drainNativeSequence(releaseWindowCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReleaseWindow, {
  run: runReleaseWindow,
  create: ({ h, events }) => new NativeCallContinuation(h.a, releaseWindowCallSequence(h, events)),
});
// 80:FF79, the notice windows released, called with JSR; the releases wait for the NMI.
export function runReleaseNoticeWindows(h, events) {
  return drainNativeSequence(releaseNoticeWindowsRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReleaseNoticeWindows, {
  run: runReleaseNoticeWindows,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, releaseNoticeWindowsRoutineSequence(h, events)),
});
// 80:91E2 and 80:9215 compose their live menus with the text renderer.
export function runDialogMenu(h, events) {
  return drainNativeSequence(dialogActionRoutineSequence(h, events, drawTextBufferSequence));
}
export function runDialogTopics(h, events) {
  return drainNativeSequence(chooseDialogTopicSequence(h, events, drawTextBufferSequence));
}
// 80:9178 composes live clearing, cursor, text and topic task actions; the register
// form takes the text key in A.
const dialogTextRoutineSequence = (h, events, renderBuffer) =>
  showDialogTextSequence(h, events, renderBuffer, h.ctx.a);
export function runDialogText(h, events) {
  return drainNativeSequence(dialogTextRoutineSequence(h, events, drawTextBufferSequence));
}
for (const [run, sequence] of [
  [runDialogMenu, dialogActionRoutineSequence],
  [runDialogTopics, chooseDialogTopicSequence],
  [runDialogText, dialogTextRoutineSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) =>
      new NativeCallContinuation(h.a, sequence(h, events, drawTextBufferSequence)),
  });
// 80:8F3A and 80:8F97, the portrait window opened and closed over frames.
export function runOpenPortraitWindow(h, events) {
  return drainNativeSequence(openPortraitWindowSequence(h, events));
}
export function runClosePortraitWindow(h, events) {
  return drainNativeSequence(closePortraitWindowSequence(h, events));
}
// 80:9022 and 80:905E, the portraits' uploads; the DMA job 80:8FF5 waits for the NMI.
export function runUploadFirstPortrait(h, events) {
  return drainNativeSequence(uploadFirstPortraitSequence(h, events));
}
export function runUploadSecondPortrait(h, events) {
  return drainNativeSequence(uploadSecondPortraitSequence(h, events));
}
// 80:ADF4, the objects' tiles requested again after the dialog; it waits for the NMI.
export function runReloadObjectTiles(h, events) {
  return drainNativeSequence(reloadObjectTilesSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReloadObjectTiles, {
  run: runReloadObjectTiles,
  create: ({ h, events }) => new NativeCallContinuation(h.a, reloadObjectTilesSequence(h, events)),
});
for (const [run, sequence] of [
  [runOpenPortraitWindow, openPortraitWindowSequence],
  [runClosePortraitWindow, closePortraitWindowSequence],
  [runUploadFirstPortrait, uploadFirstPortraitSequence],
  [runUploadSecondPortrait, uploadSecondPortraitSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h, events)),
  });
// 80:92C5 (the dialog closed), called with JSR; its portrait window waits for the NMI.
function* closeDialogCallSequence(h, events) {
  return yield* closeDialogSequence(h, events);
}
export function runCloseDialog(h, events) {
  return drainNativeSequence(closeDialogCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runCloseDialog, {
  run: runCloseDialog,
  create: ({ h, events }) => new NativeCallContinuation(h.a, closeDialogCallSequence(h, events)),
});
// 80:936C, called with JSR; the dialog waits for the pad and the NMI over many frames,
// with the lifted portrait rows and uploads, window, text, main menu, topic choice,
// colour clear, glove release, notice windows, text width, window release, word wait
// and sprite list.
export function runTalk(h, events) {
  return drainNativeSequence(talkSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runTalk, {
  run: runTalk,
  create: ({ h, events }) => new NativeCallContinuation(h.a, talkSequence(h, events)),
});

// The register forms of the lifted sequences for register-level callers.
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// 80:91E2: A the chosen row (00) with the carry, sign and zero of CMP #FFFF.
export function* dialogActionRoutineSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const result = yield* chooseDialogActionSequence(h, events, renderBuffer),
    { ctx } = h,
    { wram } = h.a.mem,
    chosen = wram[0] | (wram[1] << BYTE_BITS);
  ctx.a = chosen;
  flag(ctx, FLAG_CARRY, chosen === WORD_MASK);
  signAndZero(ctx, (chosen + 1) & WORD_MASK);
  return result;
}
// 80:99EB: the accepted actions in A, the chosen flag left in A.
export function* chooseActionRoutineSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const choice = {},
    result = yield* chooseActionSequence(h, events, renderBuffer, h.ctx.a, choice);
  h.ctx.a = choice.action;
  return result;
}
// 80:FEC1: A the window with its sign and zero and X the slot, as the original leaves them.
export function* noticeRoutineSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const shown = {},
    result = yield* showNoticeSequence(h, events, renderBuffer, shown),
    { ctx } = h;
  ctx.a = shown.window;
  ctx.x = shown.slot;
  signAndZero(ctx, shown.window);
  return result;
}
