import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { fixesEnabled, preparePushkinTopics } from '../game/bugfixes.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  clearFixedColour,
  setWindowTextWidth,
  unpackPortrait,
  shiftPortraitRows,
  uploadFirstPortrait,
  uploadSecondPortrait,
  openPortraitWindow,
  closePortraitWindow,
  putGloveAwayAdapter,
  PORTRAIT_OBJSEL,
  DP_PORTRAIT_POINTER,
  DP_PORTRAIT_BANK,
  PORTRAIT_RECORD_BANK_BYTE,
  PORTRAIT_BUFFER,
  DP_PIXEL_WIDTH,
} from './native-dialog-portrait.mjs';
import {
  dialogTextRoutines,
  showDialogText,
  chooseDialogAction,
  chooseDialogTopic,
  showDialogTextSequence,
  chooseDialogActionSequence,
  chooseDialogTopicSequence,
} from './native-dialog-text.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
  dialogCallBody,
} from './native-call-continuation.mjs';
import { reloadObjectTiles } from './native-scene-tiles.mjs';
import { buildSpriteList } from './native-scene-sprites.mjs';
import { waitForRandomStateChange } from './native-frame-wait.mjs';
import { releaseNoticeWindowsAdapter } from './native-slot-release.mjs';
import { openWindowAdapter } from './native-window-open.mjs';
import { runReleaseWindowCall } from '../game/window-release.mjs';
import { setMusicMode } from './native-audio-compose.mjs';
import { readInput } from './native-input-apu.mjs';
import {
  waitForRandomStateChangeWithInterrupts,
  readInputWithInterrupts,
} from './main-wait-interrupt.mjs';

import {
  DIALOG_END,
  MUSIC,
  PAD_HELD,
  TOPIC_LIST,
  WRAM,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DIALOG_RECORD_FLAGS,
  GAME_OPTIONS,
  OPTION_MUSIC,
  PALETTE_UPLOAD_LIST_BYTES,
  JAKE_ALTERNATE_PORTRAIT,
} from './wram.mjs';
import { BYTE_MASK, BANK_WRAP, WORD_MASK, LONG_MASK, WORD_BITS } from '../constants/bits.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import {
  OBJSEL,
  VMADDL,
  DAS0L,
  A1T0L,
  A1B0,
  BBAD0,
  VMAINC,
  VMDATAL,
  DMAP0,
  MDMAEN,
} from '../constants/hardware-registers.mjs';
import { VMAINC_INCREMENT_AFTER_HIGH } from '../constants/ppu.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { DIALOG_TABLE, DIALOG_BANK_BASE } from '../data/portraits.mjs';
import { JAKE_PORTRAIT_DIALOG, JAKE_ALTERNATE_PORTRAIT_DIALOG } from '../data/runners.mjs';

// 92C5 reloads two 40-byte font blocks from bank 8D to VRAM 0000 and 0100 (DMA channel 0,
// mode 1 to VMDATAL, address increment after the high byte), each with its eight call sites.
const FONT_BANK = DIALOG_BANK_BASE >>> WORD_BITS,
  FONT_UPLOAD_BYTES = 0x40,
  FONT_UPLOAD_MODE = 1,
  FONT_UPLOAD_CHANNEL = 1;
// Byte ports of each upload with the index of their call site in FONT_UPLOADS.
const FONT_UPLOAD_PORTS = Object.freeze([
  [A1B0, FONT_BANK, 3],
  [BBAD0, VMDATAL & BYTE_MASK, 4],
  [VMAINC, VMAINC_INCREMENT_AFTER_HIGH, 5],
  [DMAP0, FONT_UPLOAD_MODE, 6],
  [MDMAEN, FONT_UPLOAD_CHANNEL, 7],
]);
const FONT_UPLOADS = Object.freeze([
  [0, 0xfb78, [0x8092d8, 0x8092de, 0x8092e4, 0x8092eb, 0x8092f0, 0x8092f5, 0x8092fa, 0x8092ff]],
  [0x100, 0xfd78, [0x809307, 0x80930d, 0x809313, 0x80931a, 0x80931f, 0x809324, 0x809329, 0x80932e]],
]);
// 936C direct page: the dialog object, the record pointer from 80:94F7 (bank 8D) and the
// portrait frame and text windows; flag byte 3 of the record, its music bits and the
// music table read at 80:94E8 + 2 n (src/data/tables.mjs dialog_music).
// The portrait frame window also takes the texts of 935B and 933A.
export const DP_PORTRAIT_FRAME = 0x14;
const DP_DIALOG_OBJECT = 0x26,
  DP_DIALOG_RECORD = 0x11,
  DP_DIALOG_RECORD_BANK = 0x13,
  DP_TEXT_WINDOW = 0x17;
const DIALOG_RECORD_FLAG_BYTE = 3,
  DIALOG_MUSIC_BITS = 0x7f,
  DIALOG_MUSIC_TABLE = 0x94e8;
// The portrait frame 01/01/1E/0D moves to pixel 54 and narrows by 8 (FA92); the text
// window is 01/0E/1E/0D.
const PORTRAIT_FRAME = Object.freeze({ left: 1, top: 1, columns: 0x1e, rows: 0x0d }),
  TEXT_WINDOW = Object.freeze({ left: 1, top: 0x0e, columns: 0x1e, rows: 0x0d }),
  PORTRAIT_FRAME_LEFT_PIXEL = 0x54,
  PORTRAIT_FRAME_WIDTH_CHANGE = -8 & WORD_MASK;
// 9178 text requests: FFFF the greeting, FFFE the talk text (else a topic); the greeting
// is followed by 3C frames; 9215 returns FF when no topic was chosen.
const GREETING_TEXT = WORD_MASK,
  TALK_TEXT = 0xfffe,
  GREETING_WAIT_FRAMES = 0x3c,
  NO_TOPIC_CHOSEN = BYTE_MASK;
const JSR_BYTES = 3;
// 80:936C: talk with the object: dialog with object DP00 through record DP02 (table 80:94F7, bank 8D). Portraits of Jake
// and the partner, greeting, then the menu Exit/Talk/Ask about until the end ($1D63 or Exit);
// then close the windows, rebuild the scene (tiles ADF4, sprites B8DE) and restore the music.
// Called routines by target address; each has its own comparison with the original instructions. Tests
// may replace them. A routine receives (h, events) and ends with the original RTS/RTL.
const slice = (events) => Object.freeze((events.values ?? []).slice(events.waitIndex));
export const TALK_ROUTINES = new Map([
  [0x8092c5, closeDialogAdapter],
  [0x81886a, (h) => clearFixedColour(h)],
  [0x80bcb2, putGloveAwayAdapter],
  [0x80fa92, (h) => setWindowTextWidth(h)],
  [0x809f6d, (h, e) => unpackPortrait(h, e)],
  [0x808f20, (h) => shiftPortraitRows(h)],
  [0x809022, (h, e) => uploadFirstPortrait(h, e)],
  [0x80905e, (h, e) => uploadSecondPortrait(h, e)],
  [0x808f3a, (h, e) => openPortraitWindow(h, e)],
  [0x809178, showDialogTextAdapter],
  [0x8091e2, chooseDialogActionAdapter],
  [0x809215, chooseDialogTopicAdapter],
  [0x808f97, (h, e) => closePortraitWindow(h, e)],
  [0x80adf4, (h, e) => reloadObjectTiles(h, e)],
  [0x80b8de, (h) => buildSpriteList(h)],
  [0x80ff79, releaseNoticeWindowsAdapter],
  [0x81ef47, (h, e) => setMusicMode(h.a, e, false)],
  [0x80fa3e, runReleaseWindowCall],
  [0x80f963, openWindowAdapter],
  [
    0x81b0a1,
    (h, e) => {
      if (e?.interrupts !== undefined) return waitForRandomStateChangeWithInterrupts(h, e);
      const p = waitForRandomStateChange(h.a, { waitObservations: slice(e) }, false, true);
      e.waitIndex += p.waitObservationsUsed;
      e.waitEvents.push(...p.waitEvents);
      return p;
    },
  ],
  // Input: pad word $01CA from the observation, then the proven 9E1A.
  [
    0x809e1a,
    (h, e) => {
      if (e?.interrupts !== undefined) return readInputWithInterrupts(h, e);
      const address = h.abs(PAD_HELD),
        o = e.inputs?.[e.inputIndex];
      if (!o || !Object.isFrozen(o) || o.pc !== 0x809e1a || o.address !== address || o.width !== 2)
        taskStop('task_input_observation_required', {
          pc: 0x809e1a,
          address,
          width: 2,
          observationIndex: e.inputIndex,
        });
      e.inputIndex++;
      h.write(address, o.value, 2);
      return readInput(h.a, false);
    },
  ],
]);
// A table callee; its registered continuation is chosen by target and function identity.
function routineCall(h, events, routines, pc, target, long = false) {
  if (!routines.get(target)) taskStop('task_936c_routine_open', { pc, target });
  return dialogCallSequence(h, events, routines, pc, target, long);
}
// 80:92C5: close the windows, restore the screen, reload the object tiles, font VRAM 0000/0100 from
// 8D:FB78/FD78 by DMA, read the input, rebuild the sprites. Also called by 9BD3 (open dialog).
export function closeDialog(h, events, routines = TALK_ROUTINES) {
  return drainNativeSequence(closeDialogSequence(h, events, routines));
}
function* closeDialogSequence(h, events, routines = TALK_ROUTINES) {
  const call = (pc, target, long = false) => routineCall(h, events, routines, pc, target, long);
  yield* call(0x8092c5, 0x808f97);
  yield () => {
    h.load(0);
    h.portWrite(OBJSEL, 0, 2, 0x8092cb);
  };
  yield* call(0x8092ce, 0x80adf4);
  yield* call(0x8092d1, 0x81b0a1, true);
  yield () => {
    for (const [vram, source, pcs] of FONT_UPLOADS) {
      h.rep(FLAG_MEMORY_8BIT);
      h.load(vram);
      h.portWrite(VMADDL, vram, 2, pcs[0]);
      h.load(FONT_UPLOAD_BYTES);
      h.portWrite(DAS0L, FONT_UPLOAD_BYTES, 2, pcs[1]);
      h.load(source);
      h.portWrite(A1T0L, source, 2, pcs[2]);
      h.sep(FLAG_MEMORY_8BIT);
      for (const [port, value, n] of FONT_UPLOAD_PORTS) {
        h.load(value);
        h.portWrite(port, value, 1, pcs[n]);
      }
    }
    h.rep(FLAG_MEMORY_8BIT);
  };
  yield* call(0x809333, 0x809e1a);
  yield* call(0x809336, 0x80b8de);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
export function talkWithObject(a, events, outerReturn = true, routines = TALK_ROUTINES) {
  return drainNativeSequence(talkWithObjectSequence(a, events, outerReturn, routines));
}
// Table callees with registered continuations (F963, FF79, BCB2, FA3E, B0A1, 9E1A and
// the dialog parts 9178/91E2/9215/92C5) pause in their own frames; others are segments.
function* talkWithObjectSequence(a, events, outerReturn, routines = TALK_ROUTINES) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_936c_entry_required');
  const h = dialogAccess(a),
    { ctx } = h;
  if (fixesEnabled(a)) preparePushkinTopics(a, h.dp(2));
  events.text ??= dialogTextRoutines(events);
  const call = (pc, target, long = false) => routineCall(h, events, routines, pc, target, long);
  // Unpack the portrait of record [F6] (word address, byte bank) to 7F:5250 and move it row by row.
  const portrait = function* (pc) {
    yield () => {
      h.index('y', PORTRAIT_RECORD_BANK_BYTE);
      h.load(h.read(h.indirect(DP_PORTRAIT_POINTER, ctx.y)) & BYTE_MASK);
      h.index('y', ctx.a);
      h.load(h.read(h.indirect(DP_PORTRAIT_POINTER)));
      h.index('x', PORTRAIT_BUFFER);
    };
    yield* call(pc, 0x809f6d);
    yield* call(pc + JSR_BYTES, 0x808f20);
  };
  yield* call(0x80936c, 0x81886a, true);
  yield () => {
    h.write(h.abs(DIALOG_END), 0);
    h.load(h.dp(0));
    h.dpWrite(DP_DIALOG_OBJECT, ctx.a);
  };
  yield* call(0x809377, 0x80bcb2);
  yield () => {
    h.sep(FLAG_MEMORY_8BIT);
    h.load(FONT_BANK);
    h.dpWrite(DP_DIALOG_RECORD_BANK, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(h.dp(2));
    h.asl();
    h.index('y', ctx.a);
    h.load(h.read(h.abs(DIALOG_TABLE & WORD_MASK) + ctx.y));
    h.dpWrite(DP_DIALOG_RECORD, ctx.a);
    h.index('y', h.dp(DP_DIALOG_OBJECT));
  };
  yield* call(0x80938d, 0x80ff79);
  // Music of the dialog (flag byte [11]+3, bits 0..6, table 80:94E8, src/data/tables.mjs dialog_music) at bit 0 of $1FD6; the old music goes on the stack.
  let change;
  yield () => {
    h.index('y', DIALOG_RECORD_FLAG_BYTE);
    h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)) & BYTE_MASK);
    h.write(h.abs(DIALOG_RECORD_FLAGS), ctx.a);
    h.load(ctx.a & DIALOG_MUSIC_BITS);
    change = !(ctx.status & FLAG_ZERO);
    if (change) {
      h.load(h.read(h.abs(GAME_OPTIONS)) & OPTION_MUSIC);
      change = !(ctx.status & FLAG_ZERO);
    }
    if (change) {
      h.load(h.read(h.abs(DIALOG_RECORD_FLAGS)) & DIALOG_MUSIC_BITS);
      h.asl();
      h.index('y', ctx.a);
      h.load(h.read(h.abs(DIALOG_MUSIC_TABLE) + ctx.y));
      h.cmp(h.read(h.abs(MUSIC)));
      change = !(ctx.status & FLAG_ZERO);
    }
    if (change) {
      h.index('y', h.read(h.abs(MUSIC)));
      h.phy();
    } else h.a.pushWord(WORD_MASK);
  };
  if (change) yield* call(0x8093bc, 0x81ef47, true);
  // Windows: portrait frame (DP14) and text window (DP17) through F963, shift the frame left through FA92.
  yield () => {
    for (const [o, v] of [
      [DP_WINDOW_LEFT, PORTRAIT_FRAME.left],
      [DP_WINDOW_TOP, PORTRAIT_FRAME.top],
      [DP_WINDOW_COLUMNS, PORTRAIT_FRAME.columns],
      [DP_WINDOW_ROWS, PORTRAIT_FRAME.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  yield* call(0x8093db, 0x80f963);
  yield () => {
    h.load(h.dp(0));
    h.dpWrite(DP_PORTRAIT_FRAME, ctx.a);
    h.load(PORTRAIT_FRAME_LEFT_PIXEL);
    h.dpWrite(2, ctx.a);
    h.load(PORTRAIT_FRAME_WIDTH_CHANGE);
    h.dpWrite(DP_PIXEL_WIDTH, ctx.a);
  };
  yield* call(0x8093ec, 0x80fa92);
  yield () => {
    for (const [o, v] of [
      [DP_WINDOW_LEFT, TEXT_WINDOW.left],
      [DP_WINDOW_TOP, TEXT_WINDOW.top],
      [DP_WINDOW_COLUMNS, TEXT_WINDOW.columns],
      [DP_WINDOW_ROWS, TEXT_WINDOW.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]) {
      h.load(v);
      h.dpWrite(o, ctx.a);
    }
  };
  yield* call(0x809408, 0x80f963);
  // Jake's portrait (record 4E, with 7E3C17 record 4F) and the partner's.
  yield () => {
    h.load(h.dp(0));
    h.dpWrite(DP_TEXT_WINDOW, ctx.a);
    h.load(PORTRAIT_OBJSEL);
    h.portWrite(OBJSEL, PORTRAIT_OBJSEL, 2, 0x809412);
    h.write(h.abs(PALETTE_UPLOAD_LIST_BYTES), 0);
    h.load(h.read(WRAM + JAKE_ALTERNATE_PORTRAIT) & BYTE_MASK);
    h.load(ctx.status & FLAG_ZERO ? JAKE_PORTRAIT_DIALOG : JAKE_ALTERNATE_PORTRAIT_DIALOG);
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(h.abs(DIALOG_TABLE & WORD_MASK) + ctx.x));
    h.index('x', ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(DIALOG_BANK_BASE + 2 + ctx.x));
    h.dpWrite(DP_PORTRAIT_BANK, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(h.read(DIALOG_BANK_BASE + ctx.x));
    h.dpWrite(DP_PORTRAIT_POINTER, ctx.a);
  };
  yield* portrait(0x80944d);
  yield* call(0x809453, 0x809022);
  yield () => {
    h.index('y', 2);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.indirect(DP_DIALOG_RECORD, ctx.y)));
    h.dpWrite(DP_PORTRAIT_BANK, ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.indirect(DP_DIALOG_RECORD)));
    h.dpWrite(DP_PORTRAIT_POINTER, ctx.a);
  };
  yield* portrait(0x809470);
  yield* call(0x809476, 0x80905e);
  yield* call(0x809479, 0x808f3a);
  // Greeting, wait one second, then the menu until the end.
  yield () => {
    h.load(h.dp(DP_PORTRAIT_FRAME));
    h.dpWrite(0, ctx.a);
    h.load(GREETING_TEXT);
  };
  yield* call(0x809483, 0x809178);
  yield () => h.index('x', GREETING_WAIT_FRAMES);
  do {
    yield* call(0x809489, 0x81b0a1, true);
    yield () => h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (;;) {
    yield* call(0x809490, 0x8091e2);
    let next;
    yield () => {
      next = (() => {
        h.cmp(0);
        if (ctx.status & FLAG_ZERO) return 'end';
        h.index('x', h.read(h.abs(DIALOG_END)));
        if (!(ctx.status & FLAG_ZERO)) return 'end';
        h.cmp(1);
        if (ctx.status & FLAG_ZERO) {
          h.load(TALK_TEXT);
          return 'talk';
        }
        return 'topics';
      })();
    };
    if (next === 'end') break;
    if (next === 'talk') {
      yield* call(0x8094c5, 0x809178);
      let stop;
      yield () => {
        h.load(h.read(h.abs(DIALOG_END)));
        stop = !(ctx.status & FLAG_ZERO);
      };
      if (stop) break;
      continue;
    }
    yield* call(0x8094a2, 0x809215);
    let step;
    yield () => {
      h.load(h.read(h.abs(DIALOG_END)));
      if (!(ctx.status & FLAG_ZERO)) {
        step = 'end';
        return;
      }
      h.index('x', h.dp(0));
      h.cpx(NO_TOPIC_CHOSEN);
      if (ctx.status & FLAG_ZERO) {
        step = 'menu';
        return;
      }
      h.load(h.read(WRAM + TOPIC_LIST + ctx.x) & BYTE_MASK);
      step = 'topic';
    };
    if (step === 'end') break;
    if (step === 'menu') continue;
    yield* call(0x8094b8, 0x809178);
    let stop;
    yield () => {
      h.load(h.read(h.abs(DIALOG_END)));
      stop = !(ctx.status & FLAG_ZERO);
    };
    if (stop) break;
  }
  // Close: rebuild the scene, free both windows, restore the old music.
  yield () => {
    h.load(h.dp(DP_PORTRAIT_FRAME));
    h.pha();
    h.load(h.dp(DP_TEXT_WINDOW));
    h.pha();
  };
  yield* dialogCallBody(h, 0x8094d3, 0x8092c5, () => closeDialogSequence(h, events, routines));
  yield () => {
    h.pla();
    h.dpWrite(0, ctx.a);
  };
  yield* call(0x8094d9, 0x80fa3e);
  yield () => {
    h.pla();
    h.dpWrite(0, ctx.a);
  };
  yield* call(0x8094df, 0x80fa3e);
  let restore;
  yield () => {
    h.pla();
    restore = !(ctx.status & FLAG_NEGATIVE);
  };
  if (restore) yield* call(0x8094e5, 0x81ef47, true);
  let result;
  yield () => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, '936C-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-936c',
    };
  };
  return result;
}
// Shared table adapters with their registered continuations.
function closeDialogAdapter(h, e) {
  return closeDialog(h, e);
}
function showDialogTextAdapter(h, e) {
  return showDialogText(h, e, e.text);
}
function chooseDialogActionAdapter(h, e) {
  return chooseDialogAction(h, e, e.text);
}
function chooseDialogTopicAdapter(h, e) {
  return chooseDialogTopic(h, e, e.text);
}
export const talkWithObjectAdapter = (h, e) => talkWithObject(h.a, e, false);
const text = (events) => events.text ?? dialogTextRoutines(events);
for (const [target, run, sequence] of [
  [0x8092c5, closeDialogAdapter, (h, events) => closeDialogSequence(h, events)],
  [0x809178, showDialogTextAdapter, (h, events) => showDialogTextSequence(h, events, text(events))],
  [
    0x8091e2,
    chooseDialogActionAdapter,
    (h, events) => chooseDialogActionSequence(h, events, text(events)),
  ],
  [
    0x809215,
    chooseDialogTopicAdapter,
    (h, events) => chooseDialogTopicSequence(h, events, text(events)),
  ],
  [0x80936c, talkWithObjectAdapter, (h, events) => talkWithObjectSequence(h.a, events, false)],
])
  NATIVE_CALL_CONTINUATIONS.set(target, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h, events)),
  });
// Observations: wait loops (ACAF/ACBD/ACC3/ACC9, DMA 901C, tiles AE0C/AE5E with DP82 from the NMI), counter B0A5,
// NMI words after the frame wait of the tile loop (AE23), pad 9E1A.
export const TALK_WAIT_PCS = Object.freeze([
  0x81acaf, 0x81acbd, 0x81acc3, 0x81acc9, 0x81b0a5, 0x80901c, 0x80ae0c, 0x80ae5e, 0x80ae23,
]);
export function validateDialogTaskOptions(options) {
  const {
    waitMode = null,
    waitObservations = null,
    inputMode = null,
    inputObservations = null,
  } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (inputMode !== null && inputMode !== 'record-observations')
    return { handled: false, reason: 'task_input_mode_required' };
  const records = (values, pcs) =>
    values === null ||
    (Array.isArray(values) &&
      Object.isFrozen(values) &&
      Array.from(values).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          pcs.includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= LONG_MASK &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= WORD_MASK,
      ));
  if (!records(waitObservations, TALK_WAIT_PCS))
    return { handled: false, reason: 'task_wait_observations_required' };
  if (!records(inputObservations, [0x809e1a]))
    return { handled: false, reason: 'task_input_observations_required' };
  return null;
}
// lifted (optional): the lifted dialog's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level one.
function observeTalk(a, options, outerReturn, lifted = null) {
  const invalid = validateDialogTaskOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: 'record-observations',
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: options?.inputObservations ?? null,
      inputIndex: 0,
      round: options?.round ?? null,
      nestedRound: options?.nestedRound ?? null,
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : talkWithObjectSequence(a, events, outerReturn);
  return { sequence, finish };
}
export function talkWithObjectObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeTalk(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createTalkWithObjectObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeTalk(a, options, false, lifted));
