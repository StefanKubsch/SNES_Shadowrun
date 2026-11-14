import { taskStop } from './plan.mjs';
import { unpackStep } from './native-unpack-body.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { sendApuCommand, computeSoundPan } from './native-input-apu.mjs';
import {
  MUSIC,
  SOUND_LOADED_SET,
  SOUND_VOICE_MASK,
  APU_COMMAND_TOKEN,
  MUSIC_MODE_BYTE,
  APU_PAIR_PENDING,
  APU_PAIR_FIRST_BYTE,
  AUDIO_BLOCK_LIST_POINTER,
  AUDIO_BLOCK_LIST_BANK_WORD,
  AUDIO_DIRECTORY_POINTER,
  AUDIO_RAW_SOURCE_POINTER,
  AUDIO_RAW_SOURCE_BANK_WORD,
  AUDIO_BYTES_REMAINING,
  AUDIO_BLOCK_COUNT,
  AUDIO_DESTINATION,
  AUDIO_DESTINATION_HIGH,
  AUDIO_WORK_WORD,
} from './wram.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  BANK_WRAP,
  BANK_SIZE,
  HIGH_BYTE_MASK,
  WORD_SIGN,
  BYTE_BITS,
} from '../constants/bits.mjs';
import {
  APU_COMMAND_VOLUME_TARGET,
  APU_COMMAND_SONG,
  APU_COMMAND_SOUND,
  APU_COMMAND_SOUND_LEVEL,
  APU_COMMAND_SONG_LEVEL,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_TRANSFER,
} from '../constants/sound-commands.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import {
  APUIO0,
  APUIO1,
  APUIO2,
  APUIO3,
  WRMPYA,
  WRMPYB,
  RDMPYH,
} from '../constants/hardware-registers.mjs';

const JSR_BYTES = 3,
  JSL_BYTES = 4,
  JSL_RETURN_OFFSET = JSL_BYTES - 1;
// F122 and F1E8 have the same two F03A call offsets (PHA, SEP, PLA, JSR).
const AUDIO_WORD_LOW_CALL_OFFSET = 4,
  AUDIO_WORD_HIGH_CALL_OFFSET = 8;
// Directory and block formats are documented in src/data/sound.mjs.
const AUDIO_DIRECTORY_ITEMS = 5,
  AUDIO_DIRECTORY_ITEM_BYTES = 4,
  AUDIO_DIRECTORY_END = 0xff;
const AUDIO_LOAD_FLAG = WORD_SIGN,
  AUDIO_REPEAT_COUNT_MASK = WORD_SIGN - 1;
// F25A: complement the mode, then ADC 8100 with carry clear to load 80FF-mode.
const AUDIO_MODE_COMPLEMENT_BIAS = 0x8100,
  SONG_REPEAT_PARAMETER = 0x0100;
// EF47 restores these left/right levels after selecting the music mode.
const MUSIC_MODE_SONG_LEVEL = 0x2020,
  MUSIC_MODE_VOLUME_TARGET = 0x7f7f;
// C46E reads sound words from C4B3 at the byte offset supplied in DP02.
const SOUND_EFFECT_TABLE = 0xc4b3,
  SOUND_EFFECT_ARGUMENT = 2,
  SOUND_LEVEL_ARGUMENT = 4,
  SOUND_VOICE_ARGUMENT = 6;

export const taskAudioDevices = Object.freeze({
  writes: Object.freeze([APUIO0, APUIO1, APUIO2, APUIO3, WRMPYA, WRMPYB]),
  reads: Object.freeze([APUIO0, RDMPYH]),
  observationPcs: Object.freeze([0x81f00e, 0x81f046, 0x80c44f, 0x80c45a]),
});
function access(a, events, entryM = 0) {
  const h = taskTextAccess(a, { entryM }),
    { ctx } = h;
  const index = (name, value) => {
    if (ctx.status & FLAG_INDEX_8BIT) taskStop('task_audio_index_mode_required');
    ctx[name] = h.nz(value, 2);
  };
  const compareIndex = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const increment = (offset, delta, bytes) => {
    const value = h.nz(
      (h.dp(offset, bytes) + delta) & (bytes === 1 ? BYTE_MASK : WORD_MASK),
      bytes,
    );
    h.dpWrite(offset, value, bytes);
    return value;
  };
  const indirect = (dp, bytes = ctx.status & FLAG_MEMORY_8BIT ? 1 : 2) =>
    h.read((h.dp(dp, 2) + (h.dp(dp + 2, 1) << WORD_BITS) + ctx.y) & LONG_MASK, bytes);
  const finish = (long, outer) => {
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'audio-return-WORD',
      outer,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    let returnBank = ctx.programBank;
    if (long) {
      returnBank = h.pullByte('audio-return-bank', outer);
      ctx.programBank = returnBank;
    }
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnBank,
      returnTarget: returnBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: long ? 'observed-outer-RTL-target' : 'observed-outer-RTS-target',
    };
  };
  const call = (
    pc,
    target,
    run,
    long = false,
    expectedM = ctx.status & FLAG_MEMORY_8BIT ? 1 : 0,
  ) => {
    const bank = ctx.programBank;
    if (long) h.pushByte(bank, 'audio-JSL-bank');
    a.pushWord((pc + (long ? JSL_RETURN_OFFSET : 2)) & WORD_MASK, 'audio-call-return');
    ctx.programBank = target >>> WORD_BITS;
    ctx.pc = target & WORD_MASK;
    const result = run();
    if (
      result.rawReturnWord !== ((pc + (long ? JSL_RETURN_OFFSET : 2)) & WORD_MASK) ||
      ctx.programBank !== bank ||
      ctx.pc !== ((pc + (long ? JSL_BYTES : JSR_BYTES)) & WORD_MASK)
    )
      taskStop('task_native_helper_return_required', {
        pc,
        raw: result.rawReturnWord,
        bank: ctx.programBank,
        target: result.returnTarget,
      });
    if (
      (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) !==
      (expectedM === 1 ? FLAG_MEMORY_8BIT : 0)
    )
      taskStop('task_audio_return_mode_required', { pc, status: ctx.status });
    events.calls.push(
      Object.freeze({
        pc,
        target,
        rawReturnWord: result.rawReturnWord,
        returnTarget: result.returnTarget,
        outcome: result.outcome,
        polls: result.polls ?? 0,
      }),
    );
    return result;
  };
  return { ...h, a, index, compareIndex, increment, indirect, finish, call };
}
// 81:F03A: send a byte pair to the APU (or buffer it).
export function sendApuBytePair(a, events, outerReturn = false) {
  const h = access(a, events, 1),
    { ctx } = h;
  h.pushByte(ctx.a & BYTE_MASK, 'F03A-BYTE-PHA');
  h.load(h.read(h.abs(APU_PAIR_PENDING), 1));
  const buffered = (ctx.a & BYTE_MASK) === 0;
  let polls = 0;
  if (buffered) {
    h.load(h.pullByte('F03A-BYTE-PLA-buffered'));
    h.write(h.abs(APU_PAIR_FIRST_BYTE), ctx.a & BYTE_MASK, 1);
    const next = h.nz((h.read(h.abs(APU_PAIR_PENDING), 1) - 1) & BYTE_MASK, 1);
    h.write(h.abs(APU_PAIR_PENDING), next, 1);
  } else {
    h.write(h.abs(APU_PAIR_PENDING), 0, 1);
    h.load(h.read(h.abs(APU_COMMAND_TOKEN), 1));
    do {
      h.compare(ctx.a & BYTE_MASK, a.absoluteRead(APUIO0, 1, 0x81f046, 'F03A-fresh-ack'));
      polls++;
      unpackStep(h, events, 0x81f049);
    } while (!(ctx.status & FLAG_ZERO));
    unpackStep(h, events, 0x81f04b);
    h.load(((ctx.a & BYTE_MASK) + 1) & BYTE_MASK);
    h.xba();
    h.load(h.read(h.abs(APU_PAIR_FIRST_BYTE), 1));
    a.absoluteWrite(APUIO1, ctx.a & BYTE_MASK, 1, 0x81f050, 'F03A-first');
    h.load(h.pullByte('F03A-BYTE-PLA-sent'));
    a.absoluteWrite(APUIO2, ctx.a & BYTE_MASK, 1, 0x81f054, 'F03A-second');
    h.xba();
    a.absoluteWrite(APUIO0, ctx.a & BYTE_MASK, 1, 0x81f058, 'F03A-next-token');
    unpackStep(h, events, 0x81f05b);
    h.write(h.abs(APU_COMMAND_TOKEN), ctx.a & BYTE_MASK, 1);
  }
  return {
    ...h.finish(false, outerReturn),
    outcome: buffered ? 'apu_pair_buffered' : 'apu_pair_requests_prepared',
    buffered,
    polls,
  };
}
// 81:F100: subtract the word in A from the remaining sample byte count.
export function subtractSampleLength(a, events, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h;
  h.dpWrite(AUDIO_WORK_WORD, ctx.a);
  h.load(h.dp(AUDIO_BYTES_REMAINING));
  ctx.status |= FLAG_CARRY;
  h.arithmetic(h.dp(AUDIO_WORK_WORD), true);
  h.dpWrite(AUDIO_BYTES_REMAINING, ctx.a);
  return { ...h.finish(false, outerReturn), outcome: 'length_subtracted' };
}
export function runTaskAudioWord(a, events, incrementAddress, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h,
    base = incrementAddress ? 0x81f1e8 : 0x81f122;
  a.pushWord(ctx.a, 'audio-word-PHA');
  ctx.status |= FLAG_MEMORY_8BIT;
  h.load(h.pullByte('audio-word-PLA-low-fresh'));
  h.call(base + AUDIO_WORD_LOW_CALL_OFFSET, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
  h.load(h.pullByte('audio-word-PLA-high-fresh'));
  h.call(base + AUDIO_WORD_HIGH_CALL_OFFSET, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
  ctx.status &= ~FLAG_MEMORY_8BIT;
  if (incrementAddress) {
    h.increment(AUDIO_DESTINATION, 1, 2);
    h.increment(AUDIO_DESTINATION, 1, 2);
  }
  return { ...h.finish(false, outerReturn), outcome: 'apu_word_requests_prepared' };
}
// 81:F130: load sample data into the APU.
export function loadSampleData(a, events, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h;
  h.pushByte(ctx.status, 'F130-PHP');
  ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & AUDIO_LOAD_FLAG ? 0 : FLAG_ZERO);
  let scanned = 0,
    rawBytes = 0,
    repeatWords = 0;
  const blocks = [];
  const done = (outcome) => {
    ctx.status = h.pullByte('F130-PLP-fresh');
    if (ctx.status & FLAG_INDEX_8BIT) {
      ctx.x &= BYTE_MASK;
      ctx.y &= BYTE_MASK;
    }
    return {
      ...h.finish(true, outerReturn),
      outcome,
      scanned,
      rawBytes,
      repeatWords,
      blocks: Object.freeze(blocks),
    };
  };
  if (!(ctx.a & AUDIO_LOAD_FLAG)) return done('audio_loader_skipped');
  ctx.status = (ctx.status & ~FLAG_INDEX_8BIT) | FLAG_MEMORY_8BIT;
  h.dpWrite(AUDIO_WORK_WORD, ctx.a & BYTE_MASK, 1);
  h.index('y', AUDIO_DIRECTORY_ITEMS);
  for (;;) {
    h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 1));
    scanned++;
    h.compare(ctx.a & BYTE_MASK, AUDIO_DIRECTORY_END);
    if (ctx.status & FLAG_ZERO) return done('audio_directory_terminated');
    h.compare(ctx.a & BYTE_MASK, h.dp(AUDIO_WORK_WORD, 1));
    if (ctx.status & FLAG_ZERO) break;
    for (let n = 0; n < AUDIO_DIRECTORY_ITEM_BYTES; n++) h.index('y', (ctx.y + 1) & WORD_MASK);
  }
  h.index('y', (ctx.y + 1) & WORD_MASK);
  ctx.status &= ~FLAG_MEMORY_8BIT;
  h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 2));
  h.dpWrite(AUDIO_BLOCK_LIST_POINTER, ctx.a);
  h.index('y', (ctx.y + 1) & WORD_MASK);
  h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 2));
  h.dpWrite(AUDIO_BLOCK_LIST_BANK_WORD, ctx.a);
  h.index('y', 0);
  h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
  h.load((ctx.a - 1) & WORD_MASK);
  h.load((ctx.a - 1) & WORD_MASK);
  h.dpWrite(AUDIO_BYTES_REMAINING, ctx.a);
  h.index('y', (ctx.y + 1) & WORD_MASK);
  h.index('y', (ctx.y + 1) & WORD_MASK);
  h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
  h.dpWrite(AUDIO_DESTINATION, ctx.a);
  for (;;) {
    h.index('y', (ctx.y + 1) & WORD_MASK);
    h.index('y', (ctx.y + 1) & WORD_MASK);
    h.load(h.dp(AUDIO_BYTES_REMAINING));
    if (ctx.a === 0) return done('audio_data_requests_prepared');
    h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
    const countWord = ctx.a,
      headerIndex = ctx.y;
    if (!(ctx.status & FLAG_NEGATIVE)) {
      h.dpWrite(AUDIO_BLOCK_COUNT, ctx.a);
      h.call(0x81f17a, 0x81f100, () => subtractSampleLength(a, events, false));
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
      h.dpWrite(AUDIO_RAW_SOURCE_POINTER, ctx.a);
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
      h.dpWrite(AUDIO_RAW_SOURCE_BANK_WORD, ctx.a);
      a.pushWord(ctx.y, 'F130-PHY');
      h.index('y', 0);
      ctx.status |= FLAG_MEMORY_8BIT;
      h.load(APU_COMMAND_TRANSFER);
      h.index('x', h.dp(AUDIO_WORK_WORD, 2));
      h.call(0x81f192, 0x81f007, () => sendApuCommand(a, false), true, 1);
      h.write(h.abs(APU_PAIR_PENDING), 0, 1);
      h.load(h.dp(AUDIO_DESTINATION, 1));
      h.call(0x81f19b, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
      h.load(h.dp(AUDIO_DESTINATION_HIGH, 1));
      h.call(0x81f1a0, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
      const before = rawBytes;
      do {
        h.load(h.indirect(AUDIO_RAW_SOURCE_POINTER, 1));
        unpackStep(h, events, 0x81f1a5);
        h.call(0x81f1a5, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
        rawBytes++;
        unpackStep(h, events, 0x81f1a8);
        h.increment(AUDIO_DESTINATION, 1, 1);
        h.index('y', (ctx.y + 1) & WORD_MASK);
        h.compareIndex(ctx.y, h.dp(AUDIO_BLOCK_COUNT, 2));
      } while (!(ctx.status & FLAG_ZERO));
      h.call(0x81f1af, 0x81f03a, () => sendApuBytePair(a, events), false, 1);
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.index('y', a.pullWord('F130-PLY-fresh'));
      blocks.push(Object.freeze({ kind: 'raw', headerIndex, countWord, bytes: rawBytes - before }));
    } else {
      h.load(ctx.a & AUDIO_REPEAT_COUNT_MASK);
      h.dpWrite(AUDIO_BLOCK_COUNT, ctx.a);
      h.asl();
      a.pushWord(ctx.a, 'F130-length-PHA');
      h.call(0x81f1c0, 0x81f100, () => subtractSampleLength(a, events, false));
      h.index('x', a.pullWord('F130-length-PLX-fresh'));
      ctx.status |= FLAG_MEMORY_8BIT;
      h.load(APU_COMMAND_TRANSFER);
      h.call(0x81f1c8, 0x81f007, () => sendApuCommand(a, false), true, 1);
      h.write(h.abs(APU_PAIR_PENDING), 0, 1);
      ctx.status &= ~FLAG_MEMORY_8BIT;
      h.load(h.dp(AUDIO_DESTINATION));
      h.call(0x81f1d3, 0x81f122, () => runTaskAudioWord(a, events, false, false));
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.index('y', (ctx.y + 1) & WORD_MASK);
      h.load(h.indirect(AUDIO_BLOCK_LIST_POINTER, 2));
      h.dpWrite(AUDIO_WORK_WORD, ctx.a);
      const before = repeatWords;
      do {
        h.load(h.dp(AUDIO_WORK_WORD));
        h.call(0x81f1de, 0x81f1e8, () => runTaskAudioWord(a, events, true, false));
        repeatWords++;
      } while (h.increment(AUDIO_BLOCK_COUNT, -1, 2) !== 0);
      blocks.push(
        Object.freeze({ kind: 'repeat', headerIndex, countWord, words: repeatWords - before }),
      );
    }
  }
}
// F1FA (BYTE A, WORD X): mode byte to 1CE5; fresh WORD header [8C] as list index Y, then BYTE pairs
// until a zero byte. A matching first byte loads the second through F130 with A = 80xx (PHY/PLY around
// the JSL). Returns the fresh 1CE5 byte.
// 81:F1FA: store the mode byte and load the samples of its list entry through F130.
export function loadModeSamples(a, events, outerReturn = true) {
  const h = access(a, events, 1),
    { ctx } = h;
  h.write(h.abs(MUSIC_MODE_BYTE), ctx.a & BYTE_MASK, 1);
  h.pushByte(ctx.status, 'F1FA-PHP');
  h.index('y', 0);
  ctx.status &= ~FLAG_MEMORY_8BIT;
  h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 2));
  h.index('y', ctx.a);
  let loads = 0;
  for (;;) {
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 1));
    if (ctx.status & FLAG_ZERO) break;
    h.index('y', (ctx.y + 1) & WORD_MASK);
    h.compare(ctx.a & BYTE_MASK, h.read(h.abs(MUSIC_MODE_BYTE), 1));
    if (ctx.status & FLAG_ZERO) {
      h.load(AUDIO_LOAD_FLAG >>> BYTE_BITS, 1);
      h.xba();
      h.load(h.indirect(AUDIO_DIRECTORY_POINTER, 1), 1);
      ctx.status &= ~FLAG_MEMORY_8BIT;
      a.pushWord(ctx.y, 'F1FA-PHY');
      h.call(0x81f21a, 0x81f130, () => loadSampleData(a, events, false), true, 0);
      h.index('y', a.pullWord('F1FA-PLY-fresh'));
      loads++;
    }
    ctx.status |= FLAG_MEMORY_8BIT;
    h.index('y', (ctx.y + 1) & WORD_MASK);
  }
  ctx.status = h.pullByte('F1FA-PLP-fresh');
  if (ctx.status & FLAG_INDEX_8BIT) {
    ctx.x &= BYTE_MASK;
    ctx.y &= BYTE_MASK;
  }
  h.load(h.read(h.abs(MUSIC_MODE_BYTE), 1), 1);
  return { ...h.finish(false, outerReturn), outcome: 'audio_mode_list_scanned', loads };
}
// 81:F25A: start the song of the music mode. Command 04 with X0 always; a nonzero mode
// byte scans F1FA, loads 80FF minus the cached byte through F130 and sends command 04
// with X = 01xx. PHP/PLP restore the entry mode.
function startMusicModeSong(a, events, outerReturn = true) {
  const entryM = a.ctx.status & FLAG_MEMORY_8BIT ? 1 : 0,
    h = access(a, events, entryM),
    { ctx } = h;
  h.pushByte(ctx.status, 'F25A-PHP');
  ctx.status = (ctx.status & ~FLAG_INDEX_8BIT) | FLAG_MEMORY_8BIT;
  h.pushByte(ctx.a & BYTE_MASK, 'F25A-BYTE-PHA');
  h.load(APU_COMMAND_SONG, 1);
  h.index('x', 0);
  h.call(0x81f265, 0x81f007, () => sendApuCommand(a, false), true, 1);
  h.load(h.pullByte('F25A-BYTE-PLA-fresh'), 1);
  const mode = ctx.a & BYTE_MASK;
  if (mode !== 0) {
    h.call(0x81f26c, 0x81f1fa, () => loadModeSamples(a, events, false), false, 1);
    ctx.status &= ~FLAG_MEMORY_8BIT;
    h.load(ctx.a & BYTE_MASK);
    a.pushWord(ctx.a, 'F25A-WORD-PHA');
    h.load(ctx.a ^ WORD_MASK);
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(AUDIO_MODE_COMPLEMENT_BIAS);
    h.call(0x81f27c, 0x81f130, () => loadSampleData(a, events, false), true, 0);
    h.load(a.pullWord('F25A-WORD-PLA-fresh'));
    h.load(ctx.a | SONG_REPEAT_PARAMETER);
    h.index('x', ctx.a);
    ctx.status |= FLAG_MEMORY_8BIT;
    h.load(APU_COMMAND_SONG, 1);
    h.call(0x81f289, 0x81f007, () => sendApuCommand(a, false), true, 1);
  }
  ctx.status = h.pullByte('F25A-PLP-fresh');
  if (ctx.status & FLAG_INDEX_8BIT) {
    ctx.x &= BYTE_MASK;
    ctx.y &= BYTE_MASK;
  }
  return {
    ...h.finish(true, outerReturn),
    outcome: mode ? 'audio_mode_requests_prepared' : 'audio_mode_cleared',
    mode,
  };
}
// EF47 (WORD A): full word to actualDBR 1CDE, F25A, then F007 with 0D/2020 and 02/7F7F.
// 81:EF47: switch the music to the mode in A.
export function setMusicMode(a, events, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h;
  h.write(h.abs(MUSIC), ctx.a);
  const mode = ctx.a;
  h.call(0x81ef4a, 0x81f25a, () => startMusicModeSong(a, events, false), true, 0);
  h.load(APU_COMMAND_SONG_LEVEL);
  h.index('x', MUSIC_MODE_SONG_LEVEL);
  h.call(0x81ef54, 0x81f007, () => sendApuCommand(a, false), true, 0);
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', MUSIC_MODE_VOLUME_TARGET);
  h.call(0x81ef5e, 0x81f007, () => sendApuCommand(a, false), true, 0);
  return { ...h.finish(true, outerReturn), outcome: 'audio_mode_changed', mode };
}
// 80:C46E: play a sound effect (level, voices, pan) on a nonzero channel.
export function playSoundEffect(a, events, outerReturn = true) {
  const h = access(a, events),
    { ctx } = h;
  h.pushByte(ctx.programBank, 'C46E-PHK');
  ctx.bank = h.pullByte('C46E-PLB-fresh');
  h.nz(ctx.bank, 1);
  h.index('y', h.dp(SOUND_EFFECT_ARGUMENT));
  h.load(h.read(h.abs(SOUND_EFFECT_TABLE) + ctx.y));
  a.pushWord(ctx.a, 'C46E-sound-PHA');
  const sound = ctx.a;
  h.compare(ctx.a, h.read(h.abs(SOUND_LOADED_SET)));
  const soundCacheHit = Boolean(ctx.status & FLAG_ZERO);
  let loaderUsed = false;
  if (!soundCacheHit) {
    h.compare(ctx.a, AUDIO_LOAD_FLAG);
    if (ctx.status & FLAG_CARRY) {
      loaderUsed = true;
      h.write(h.abs(SOUND_LOADED_SET), ctx.a);
      h.call(0x80c483, 0x81f130, () => loadSampleData(a, events, false), true);
    }
  }
  h.load(h.dp(SOUND_LEVEL_ARGUMENT));
  h.call(0x80c489, 0x80c416, () => computeSoundPan(a, false));
  h.load(APU_COMMAND_SOUND_LEVEL);
  h.call(0x80c48f, 0x81f007, () => sendApuCommand(a, false), true);
  h.index('x', h.dp(SOUND_VOICE_ARGUMENT));
  const voice = ctx.x;
  if (voice === 0) {
    const raw = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'C46E-zero-voice-RTS');
    taskStop('task_audio_return_required', {
      pc: 0x80c4b2,
      voice,
      rawReturnWord: raw,
      returnTarget: ctx.programBank * BANK_SIZE + ((raw + 1) & WORD_MASK),
    });
  }
  h.compareIndex(ctx.x, h.read(h.abs(SOUND_VOICE_MASK)));
  const voiceCacheHit = Boolean(ctx.status & FLAG_ZERO);
  if (!voiceCacheHit) {
    h.write(h.abs(SOUND_VOICE_MASK), ctx.x);
    h.load(APU_COMMAND_SOUND_VOICES);
    h.call(0x80c4a2, 0x81f007, () => sendApuCommand(a, false), true);
  }
  h.load(a.pullWord('C46E-sound-PLA-fresh'));
  h.load(ctx.a | HIGH_BYTE_MASK);
  h.index('x', ctx.a);
  h.load(APU_COMMAND_SOUND);
  h.call(0x80c4ae, 0x81f007, () => sendApuCommand(a, false), true);
  return {
    ...h.finish(false, outerReturn),
    outcome: 'audio_requests_composed',
    sound,
    voice,
    soundCacheHit,
    voiceCacheHit,
    loaderUsed,
  };
}
