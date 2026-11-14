// Frontend helpers that stay register-level: the call frames of the frontend
// sequences, the settings checksum 81:D5D0 with its store 81:D5E4, compare 81:D5EC
// and defaults 81:D5F4, and the output mode 81:EF36 (the startup 80:A133 uses them),
// and the save checksum 81:B1AB of the save code. The start menu with its texts and
// its NMI callback 81:E6AE is lifted (src/frontend/start-menu.mjs; register-level
// reference in proof/frontend-reference/start-menu-text.mjs).
import { taskStop } from './plan.mjs';
import { MAIN_SCENE_ROUTINES } from './main-scene.mjs';
import { compareSaveChecksum } from './native-main-menu.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  JSR_RETURN_OFFSET,
  JSL_RETURN_OFFSET,
} from './native-call-continuation.mjs';
import { routineCaller } from './routine-call.mjs';
import { handleStartMenuNmi } from '../frontend/start-menu.mjs';
import {
  SETTINGS_CHECKSUM,
  SETTINGS_CONTROL,
  SETTINGS_MUSIC,
  SETTINGS_MUSIC_FULL,
  SETTINGS_STEREO,
  SETTINGS_STEREO_ON,
} from './wram.mjs';
import {
  FLAG_CARRY,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import { WORD_MASK, WORD_BITS } from '../constants/bits.mjs';
import { APU_COMMAND_OUTPUT_MODE } from '../constants/sound-commands.mjs';

// BYTE checksum of the three settings (81:D5D0): seed plus the bytes, XORed at the end.
const SETTINGS_CHECKSUM_SEED = 0xeb,
  SETTINGS_CHECKSUM_XOR = 0x5a;

// The same unlabelled frame as routineCaller, as a sequence: a callee with a
// registered continuation pauses inside its frame; any other stays a segment.
export function* frontendCallSequence(h, e, r, pc, target, long = false) {
  const run = r.get(target);
  if (!run) taskStop('main_loop_frontier', { target });
  const bank = h.ctx.programBank,
    raw = (pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET)) & WORD_MASK;
  yield () => {
    if (long) h.pushByte(bank);
    h.a.pushWord(raw);
    h.ctx.programBank = target >>> WORD_BITS;
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { target, run, h, events: e, routines: r };
  yield () => {
    if (h.ctx.programBank !== bank || h.ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  return result;
}
// Registers fixed frontend sequences as continuations of their own targets.
export function frontendContinuations(entries, defaults) {
  for (const [target, run, sequence] of entries)
    NATIVE_CALL_CONTINUATIONS.set(target, {
      run,
      create: ({ h, events, routines = defaults() }) =>
        new NativeCallContinuation(h.a, sequence(h, events, routines)),
    });
}

// BYTE checksum of the three original global SRAM settings. PHP/PLP keeps
// the caller's incoming carry; only the checksum body explicitly clears it.
// Original routine $81:D5D0.
function runSettingsChecksum(h) {
  const { ctx } = h;
  h.php();
  h.rep(FLAG_INDEX_8BIT);
  h.index('x', 2);
  h.load(SETTINGS_CHECKSUM_SEED);
  ctx.status &= ~FLAG_CARRY;
  do {
    h.adc(h.read(SETTINGS_STEREO + ctx.x));
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  h.load(ctx.a ^ SETTINGS_CHECKSUM_XOR);
  h.plp();
  return h.rts();
}
// Original routine $81:D5E4.
function runSettingsChecksumStore(h, e, r = FRONTEND_TEXT_ROUTINES) {
  routineCaller(h, e, r)(0x81d5e4, 0x81d5d0);
  h.write(SETTINGS_CHECKSUM, h.ctx.a);
  return h.rtl();
}
// Original routine $81:D5EC.
function runSettingsChecksumCompare(h, e, r = FRONTEND_TEXT_ROUTINES) {
  routineCaller(h, e, r)(0x81d5ec, 0x81d5d0);
  h.cmp(h.read(SETTINGS_CHECKSUM));
  return h.rtl();
}
// Original routine $81:D5F4.
function runSettingsDefaults(h, e, r = FRONTEND_TEXT_ROUTINES) {
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  for (const [at, value] of [
    [SETTINGS_STEREO, SETTINGS_STEREO_ON],
    [SETTINGS_CONTROL, 0],
    [SETTINGS_MUSIC, SETTINGS_MUSIC_FULL],
  ]) {
    h.load(value);
    h.write(at, h.ctx.a);
  }
  routineCaller(h, e, r)(0x81d609, 0x81d5e4, true);
  h.plp();
  return h.rtl();
}
// Original routine $81:EF36.
function sendOutputMode(h, e, r = FRONTEND_TEXT_ROUTINES) {
  h.php();
  h.rep(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
  h.load(h.read(SETTINGS_STEREO));
  h.index('x', h.ctx.a);
  h.load(APU_COMMAND_OUTPUT_MODE);
  routineCaller(h, e, r)(0x81ef41, 0x81f007, true);
  h.plp();
  return h.rtl();
}
export const FRONTEND_TEXT_ROUTINES = new Map([
  ...MAIN_SCENE_ROUTINES,
  [0x81b1ab, compareSaveChecksum],
  [0x81d5d0, runSettingsChecksum],
  [0x81d5e4, runSettingsChecksumStore],
  [0x81d5ec, runSettingsChecksumCompare],
  [0x81d5f4, runSettingsDefaults],
  [0x81ef36, sendOutputMode],
  // The lifted start menu callback (src/frontend/start-menu.mjs).
  [0x81e6ae, handleStartMenuNmi],
]);
