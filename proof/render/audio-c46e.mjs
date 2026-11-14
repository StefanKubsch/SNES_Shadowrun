import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderC416 } from './pan-c416.mjs';
import { renderF007 } from './apu-f007.mjs';
import { renderF130 } from './samples-f130.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { BYTE_MASK, WORD_MASK, WORD_SIGN, HIGH_BYTE_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BASE, CODE_BANK, CODE_BANK_BASE } from '../../src/constants/memory-map.mjs';
import { SOUND_LOADED_SET, SOUND_VOICE_MASK } from '../../src/task/wram.mjs';
import {
  APU_COMMAND_SOUND_LEVEL,
  APU_COMMAND_SOUND_VOICES,
  APU_COMMAND_SOUND,
} from '../../src/constants/sound-commands.mjs';

const DEFAULT_MAX_WORK = 1000000;
const AUDIO_STACK_BYTES = 8;
const LOADER_STACK_BYTES = 14;
const PARAMETERS_ARGUMENT = 4;
const VOICE_ARGUMENT = 6;

export function prepareRenderC46E({
  data,
  bank = null,
  status = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  ioMode = null,
  ioRead4217 = null,
  ioRead2140 = null,
} = {}) {
  if (
    (ioMode !== null && ioMode !== 'record-requests') ||
    [ioRead4217, ioRead2140].some(
      (v) =>
        v !== null &&
        (!Array.isArray(v) ||
          !Array.from(v).every((n) => Number.isInteger(n) && n >= 0 && n <= BYTE_MASK)),
    )
  )
    throw Error('Invalid render C46E context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    AUDIO_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderC46E(
        view,
        {
          bank,
          status,
          ioMode,
          ioRead4217,
          ioRead2140,
          stackBytes: stackWindow[1] - stackWindow[0] + 1,
        },
        { work: 0, maxWork },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Original all-sound/nonzero-voice algorithm. Public loader paths require
// fourteen protected bytes; an inner caller owns that transitive stack proof.
// The unbalanced zero-voice return remains an explicit atomic boundary.
// One overlay/request ledger only; no device, CPU, clock or scene execution.
export function renderC46E(view, context, budget) {
  const r = { a: 0, x: 0, y: 0, bank: CODE_BANK, status: textNZ(context.status, CODE_BANK, 1) }; // PHK/PLB.
  const operations = [],
    byteOperations = [],
    calls = [];
  const counts = context.observations ?? {};
  counts.panResultReads ??= 0;
  counts.apuPolls ??= 0;
  let phase = 'audioC46E';
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const shared = {
    read(address) {
      tick();
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', phase, address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      tick();
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', phase, address, value, bytes: 1 }));
    },
  };
  const io = textHelperAccess(shared, budget, operations, phase);
  const load = (value) => {
    r.a = value & WORD_MASK;
    r.status = textNZ(r.status, r.a);
  };
  const index = (name, value) => {
    r[name] = value & WORD_MASK;
    r.status = textNZ(r.status, r[name]);
  };
  const compare = (left, right) => {
    r.status = textNZ((r.status & ~1) | Number(left >= right), (left - right) & WORD_MASK);
  };
  const call = (name, run, role) => {
    const before = Object.freeze({ ...r });
    phase = name;
    const result = run(
      shared,
      {
        ...context,
        ...r,
        observations: counts,
        ioRead2140:
          name === 'F007' ? context.ioRead2140?.slice(counts.apuPolls) : context.ioRead2140,
      },
      budget,
    );
    operations.push(...result.operations);
    if (name === 'F007') counts.apuPolls += result.polls;
    Object.assign(r, {
      a: result.a,
      x: result.x,
      y: result.y,
      bank: result.bank,
      status: result.status,
    });
    calls.push(
      Object.freeze({
        name,
        role,
        before,
        after: Object.freeze({ ...r }),
        command: result.command ?? null,
        polls: result.polls ?? 0,
        work: budget.work,
        ...counts,
      }),
    );
    phase = 'audioC46E';
  };
  index('y', io.read(2));
  const soundAddress = 0x80c4b3 + r.y;
  load(io.read(soundAddress));
  const sound = r.a; // Original WORD PHA, not a cached table refetch.
  const cachedSound = io.read(CODE_BANK_BASE + SOUND_LOADED_SET);
  compare(r.a, cachedSound);
  const soundCacheHit = r.a === cachedSound;
  if (!soundCacheHit) compare(r.a, WORD_SIGN);
  const loaderUsed = !soundCacheHit && sound >= WORD_SIGN;
  if (loaderUsed) {
    if ((context.stackBytes ?? LOADER_STACK_BYTES) < LOADER_STACK_BYTES)
      throw {
        renderBoundary: true,
        reason: 'render_stack_required',
        minimumStackBytes: LOADER_STACK_BYTES,
      };
    io.write(CODE_BANK_BASE + SOUND_LOADED_SET, r.a);
    call('F130', renderF130, 'load');
  }
  load(io.read(PARAMETERS_ARGUMENT));
  call('C416', renderC416, 'parameters');
  load(APU_COMMAND_SOUND_LEVEL);
  call('F007', renderF007, 'parameters');
  index('x', io.read(VOICE_ARGUMENT));
  const voice = r.x;
  if (!voice) throw { renderBoundary: true, reason: 'render_audio_return_required', voice };
  const cachedVoice = io.read(CODE_BANK_BASE + SOUND_VOICE_MASK);
  compare(r.x, cachedVoice);
  const voiceCacheHit = r.x === cachedVoice;
  if (!voiceCacheHit) {
    io.write(CODE_BANK_BASE + SOUND_VOICE_MASK, r.x);
    load(APU_COMMAND_SOUND_VOICES);
    call('F007', renderF007, 'voice');
  }
  load(sound);
  load(r.a | HIGH_BYTE_MASK);
  index('x', r.a);
  load(APU_COMMAND_SOUND);
  call('F007', renderF007, 'sound');
  return textHelperResult(r, budget, operations, {
    outcome: 'audio_requests_composed',
    sound,
    soundAddress,
    soundCacheHit,
    loaderUsed,
    minimumStackBytes: loaderUsed ? LOADER_STACK_BYTES : AUDIO_STACK_BYTES,
    voice,
    cachedVoice,
    voiceCacheHit,
    ...counts,
    calls: Object.freeze(calls),
    outputBytes: 0,
    byteAccesses: byteOperations.length,
    byteOperations: Object.freeze(byteOperations),
  });
}
