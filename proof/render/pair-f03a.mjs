import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { BYTE_MASK, BANK_SIZE, HIGH_BYTE_MASK, BYTE_BITS } from '../../src/constants/bits.mjs';
import {
  WRAM_BASE,
  WRAM_BANK,
  WRAM_HIGH_BANK,
  BANK_WITHOUT_IO,
} from '../../src/constants/memory-map.mjs';
import { APU_PAIR_PENDING, APU_PAIR_FIRST_BYTE, APU_COMMAND_TOKEN } from '../../src/task/wram.mjs';
import { APUIO0, APUIO1, APUIO2 } from '../../src/constants/hardware-registers.mjs';

const DEFAULT_MAX_WORK = 1000000;
const PAIR_STACK_BYTES = 3;

export function prepareRenderF03A({
  data,
  bank = null,
  status = null,
  a = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  ioMode = null,
  ioRead2140 = null,
} = {}) {
  if (
    [a, x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead2140 !== null &&
      (!Array.isArray(ioRead2140) ||
        !Array.from(ioRead2140).every((v) => Number.isInteger(v) && v >= 0 && v <= BYTE_MASK)))
  )
    throw Error('Invalid render F03A context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    PAIR_STACK_BYTES,
    1,
  );
  if (entry) return entry;
  if ([a, x, y].some((v) => v === null)) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(
      renderF03A(view, { bank, status, a, x, y, ioMode, ioRead2140 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Source-specific BYTE pair buffer/request algorithm. The saved byte models
// original PHA/PLA data only; no stack, device, CPU or clock execution.
export function renderF03A(view, context, budget) {
  const r = {
    a: context.a,
    x: context.x,
    y: context.y,
    bank: context.bank,
    status: context.status,
  };
  const operations = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  const inputByte = r.a & BYTE_MASK,
    base = r.bank * BANK_SIZE,
    physical = r.bank === WRAM_BANK || r.bank === WRAM_HIGH_BANK;
  let phase = 'flag',
    polls = 0,
    token = null,
    nextToken = null,
    firstByte = null;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const read = (offset) => access().read(base + offset, 1);
  const write = (offset, value) => access().write(base + offset, value, 1);
  const register = (kind, offset, value) => {
    if (physical) return kind === 'read' ? read(offset) : write(offset, value);
    if (r.bank & BANK_WITHOUT_IO)
      throw { renderBoundary: true, reason: 'render_address_required', address: base + offset };
    return access().request(kind, base + offset, value, 1, context.ioMode);
  };
  const load = (value) => {
    r.a = (r.a & HIGH_BYTE_MASK) | (value & BYTE_MASK);
    r.status = textNZ(r.status, r.a & BYTE_MASK, 1);
  };
  const swap = () => {
    r.a = (r.a >>> BYTE_BITS) | ((r.a & BYTE_MASK) << BYTE_BITS);
    r.status = textNZ(r.status, r.a & BYTE_MASK, 1);
  };
  try {
    load(read(APU_PAIR_PENDING));
    const pairFlag = r.a & BYTE_MASK,
      buffered = pairFlag === 0;
    if (buffered) {
      phase = 'buffer';
      load(inputByte);
      write(APU_PAIR_FIRST_BYTE, r.a & BYTE_MASK);
      phase = 'decrement';
      const flag = (read(APU_PAIR_PENDING) - 1) & BYTE_MASK;
      write(APU_PAIR_PENDING, flag);
      r.status = textNZ(r.status, flag, 1);
    } else {
      phase = 'clear';
      write(APU_PAIR_PENDING, 0);
      phase = 'token';
      load(read(APU_COMMAND_TOKEN));
      token = r.a & BYTE_MASK;
      phase = 'poll';
      let sample;
      do {
        sample = register('read', APUIO0, context.ioRead2140?.[counts.apuPolls]);
        if (!physical) counts.apuPolls++;
        polls++;
        r.status = textNZ(
          (r.status & ~1) | Number(token >= sample),
          (token - sample) & BYTE_MASK,
          1,
        );
      } while (sample !== token);
      load(token + 1);
      nextToken = r.a & BYTE_MASK;
      swap();
      phase = 'first';
      load(read(APU_PAIR_FIRST_BYTE));
      firstByte = r.a & BYTE_MASK;
      register('write', APUIO1, firstByte);
      phase = 'second';
      load(inputByte);
      register('write', APUIO2, r.a & BYTE_MASK);
      phase = 'acknowledge';
      swap();
      register('write', APUIO0, r.a & BYTE_MASK);
      phase = 'store';
      write(APU_COMMAND_TOKEN, r.a & BYTE_MASK);
    }
    return textHelperResult(r, budget, operations, {
      outcome: buffered ? 'apu_pair_buffered' : 'apu_pair_requests_prepared',
      buffered,
      inputByte,
      pairFlag,
      firstByte,
      token,
      nextToken,
      polls,
      apuPolls: counts.apuPolls,
      outputBytes: 0,
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase };
  }
}
