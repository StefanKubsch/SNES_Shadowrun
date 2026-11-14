import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF007 } from './apu-f007.mjs';
import { renderF03A } from './pair-f03a.mjs';
import { renderF122, renderF1E8 } from './word-f122.mjs';
import {
  textHelperAccess,
  textHelperResult,
  textNZ,
  textArithmeticFlags,
} from './text-helper-access.mjs';

export function prepareRenderF130({
  data,
  bank = null,
  status = null,
  a = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  ioMode = null,
  ioRead2140 = null,
} = {}) {
  if (
    [a, x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead2140 !== null &&
      (!Array.isArray(ioRead2140) ||
        !Array.from(ioRead2140).every((v) => Number.isInteger(v) && v >= 0 && v <= 255)))
  )
    throw Error('Invalid render F130 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    10,
  );
  if (entry) return entry;
  if ([a, x, y].some((v) => v === null)) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => 0x7e0000 + v),
  );
  try {
    return view.finish(
      renderF130(view, { bank, status, a, x, y, ioMode, ioRead2140 }, { work: 0, maxWork }),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Original F100 fixed WORD length subtraction. Its caller owns the view,
// stack protection and commit. Reads remain fresh after the DP98 store.
export function renderF100(view, context, budget) {
  const r = {
    a: context.a,
    x: context.x,
    y: context.y,
    bank: context.bank,
    status: context.status,
  };
  const operations = [],
    io = textHelperAccess(view, budget, operations, 'lengthF100');
  try {
    const inputWord = r.a;
    io.write(0x98, inputWord);
    const left = io.read(0x92);
    r.a = left;
    r.status = textNZ(r.status, left) | 1;
    const right = io.read(0x98),
      difference = left - right;
    r.a = difference & 65535;
    r.status = textArithmeticFlags(r.status, left, right, r.a, difference >= 0, true);
    io.write(0x92, r.a);
    return textHelperResult(r, budget, operations, {
      inputWord,
      remainingBefore: left,
      remaining: r.a,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: 'lengthF100' };
  }
}

// Source-specific directory/raw/repeat algorithm, not an opcode dispatcher.
// PHP/PLP restores entry status. Polls are actual external observations;
// original counters, overlapping pointer reads and tail A are never repaired.
export function renderF130(view, context, budget) {
  const entryStatus = context.status,
    inputWord = context.a;
  const r = { a: inputWord, x: context.x, y: context.y, bank: context.bank, status: entryStatus };
  const operations = [],
    calls = [],
    blocks = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  let phase = 'gate',
    scanned = 0,
    rawBytes = 0,
    repeatWords = 0,
    polls = 0,
    callIndex = 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const load = (value, bytes = r.status & 32 ? 1 : 2) => {
    const mask = bytes === 1 ? 255 : 65535;
    r.a = (r.a & ~mask) | (value & mask);
    r.status = textNZ(r.status, r.a & mask, bytes);
  };
  const index = (name, value) => {
    r[name] = value & 65535;
    r.status = textNZ(r.status, r[name]);
  };
  const advance = () => index('y', r.y + 1);
  const compare = (left, right, bytes) => {
    const mask = bytes === 1 ? 255 : 65535;
    r.status = textNZ((r.status & ~1) | Number(left >= right), (left - right) & mask, bytes);
  };
  const read = (address, bytes = 2) => access().read(address, bytes);
  const write = (address, value, bytes = 2) => access().write(address, value, bytes);
  const indirect = (dp, bytes) => {
    const pointer = read(dp) | (read(dp + 2, 1) << 16);
    return read((pointer + r.y) & 0xffffff, bytes);
  };
  const modify = (address, delta, bytes) => {
    const value = (read(address, bytes) + delta) & (bytes === 1 ? 255 : 65535);
    write(address, value, bytes);
    r.status = textNZ(r.status, value, bytes);
    return value;
  };
  const call = (name, run) => {
    const before = Object.freeze({ ...r });
    const p = run(
      view,
      {
        ...context,
        ...r,
        observations: counts,
        ioRead2140:
          name === 'F007' ? context.ioRead2140?.slice(counts.apuPolls) : context.ioRead2140,
      },
      budget,
    );
    if (name === 'F007' && r.bank !== 0x7e && r.bank !== 0x7f) counts.apuPolls += p.polls;
    polls += p.polls ?? 0;
    operations.push(...p.operations);
    Object.assign(r, { a: p.a, x: p.x, y: p.y, bank: p.bank, status: p.status });
    calls.push(
      Object.freeze({
        name,
        before,
        after: Object.freeze({ ...r }),
        polls: p.polls ?? 0,
        apuPolls: counts.apuPolls,
        work: budget.work,
      }),
    );
    callIndex++;
  };
  const result = (outcome) => {
    r.status = entryStatus;
    return textHelperResult(r, budget, operations, {
      outcome,
      inputWord,
      scanned,
      rawBytes,
      repeatWords,
      polls,
      apuPolls: counts.apuPolls,
      blocks: Object.freeze(blocks),
      calls: Object.freeze(calls),
      outputBytes: 0,
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  };
  try {
    if (!(inputWord & 0x8000)) return result('audio_loader_skipped');
    r.status = (r.status & ~16) | 32;
    phase = 'directory';
    write(0x98, r.a, 1);
    index('y', 5);
    for (;;) {
      load(indirect(0x8c, 1));
      scanned++;
      compare(r.a & 255, 255, 1);
      if ((r.a & 255) === 255) return result('audio_directory_terminated');
      const id = read(0x98, 1);
      compare(r.a & 255, id, 1);
      if ((r.a & 255) === id) break;
      for (let n = 0; n < 4; n++) advance();
    }
    advance();
    r.status &= ~32;
    load(indirect(0x8c, 2));
    write(0x89, r.a);
    advance();
    load(indirect(0x8c, 2));
    write(0x8a, r.a);
    index('y', 0);
    phase = 'header';
    load(indirect(0x89, 2));
    load(r.a - 1);
    load(r.a - 1);
    write(0x92, r.a);
    advance();
    advance();
    load(indirect(0x89, 2));
    write(0x96, r.a);
    for (;;) {
      phase = 'block';
      advance();
      advance();
      load(read(0x92));
      if (!r.a) return result('audio_data_requests_prepared');
      load(indirect(0x89, 2));
      const countWord = r.a,
        headerIndex = r.y;
      if (!(r.status & 128)) {
        write(0x94, r.a);
        call('F100', renderF100);
        advance();
        advance();
        load(indirect(0x89, 2));
        write(0x8f, r.a);
        advance();
        load(indirect(0x89, 2));
        write(0x90, r.a);
        const savedY = r.y,
          startBytes = rawBytes;
        index('y', 0);
        r.status |= 32;
        phase = 'raw';
        load(16);
        index('x', read(0x98));
        call('F007', renderF007);
        write(r.bank * 65536 + 0x1ce6, 0, 1);
        load(read(0x96, 1));
        call('F03A', renderF03A);
        load(read(0x97, 1));
        call('F03A', renderF03A);
        do {
          load(indirect(0x8f, 1));
          call('F03A', renderF03A);
          rawBytes++;
          modify(0x96, 1, 1);
          advance();
          const length = read(0x94);
          compare(r.y, length, 2);
        } while (!(r.status & 2));
        const tailA = r.a;
        call('F03A', renderF03A);
        r.status &= ~32;
        index('y', savedY);
        blocks.push(
          Object.freeze({
            kind: 'raw',
            headerIndex,
            countWord,
            bytes: rawBytes - startBytes,
            tailA,
          }),
        );
      } else {
        phase = 'repeat';
        load(r.a & 0x7fff);
        write(0x94, r.a);
        const shifted = r.a << 1;
        r.a = shifted & 65535;
        r.status = textNZ((r.status & ~1) | Number(shifted > 65535), r.a);
        const savedLength = r.a,
          startWords = repeatWords;
        call('F100', renderF100);
        index('x', savedLength);
        r.status |= 32;
        load(16);
        call('F007', renderF007);
        write(r.bank * 65536 + 0x1ce6, 0, 1);
        r.status &= ~32;
        load(read(0x96));
        call('F122', renderF122);
        advance();
        advance();
        load(indirect(0x89, 2));
        write(0x98, r.a);
        do {
          load(read(0x98));
          call('F1E8', renderF1E8);
          repeatWords++;
        } while (modify(0x94, -1, 2) !== 0);
        blocks.push(
          Object.freeze({
            kind: 'repeat',
            headerIndex,
            countWord,
            words: repeatWords - startWords,
          }),
        );
      }
    }
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: 'F130', callIndex, phase: error.phase ?? phase };
  }
}
