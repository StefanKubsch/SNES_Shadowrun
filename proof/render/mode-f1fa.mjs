import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF130 } from './samples-f130.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';

export function prepareRenderF1FA({
  data,
  bank = null,
  status = null,
  a = null,
  x = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  maxOutputBytes = 65536,
  ioMode = null,
  ioRead2140 = null,
} = {}) {
  if (
    [a, x].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead2140 !== null &&
      (!Array.isArray(ioRead2140) ||
        !Array.from(ioRead2140).every((v) => Number.isInteger(v) && v >= 0 && v <= 255)))
  )
    throw Error('Invalid render F1FA context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    15,
    1,
  );
  if (entry) return entry;
  if (a === null || x === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => 0x7e0000 + v),
  );
  try {
    return view.finish(
      renderF1FA(
        view,
        { bank, status, a, x, ioMode, ioRead2140 },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

const registers = (r) => Object.freeze({ ...r });

// Source-specific BYTE-mode scan, with actual F130 calls over the same view.
// Saved status/Y represent only PHP/PLP and WORD PHY/PLY under the proved
// disjoint 15-byte stack contract. No independent inner commit or device run.
export function renderF1FA(view, context, budget) {
  const entryStatus = context.status,
    inputWord = context.a;
  const r = { a: inputWord, x: context.x, y: 0, bank: context.bank, status: entryStatus };
  const operations = [],
    calls = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  budget.outputBytes ??= 0;
  let phase = 'modeF1FA',
    visits = 0,
    matches = 0,
    polls = 0,
    rawBytes = 0,
    repeatWords = 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const read = (address, bytes = 2) => access().read(address, bytes);
  const load = (value, bytes = r.status & 32 ? 1 : 2) => {
    const mask = bytes === 1 ? 255 : 65535;
    r.a = (r.a & ~mask) | (value & mask);
    r.status = textNZ(r.status, r.a & mask, bytes);
  };
  const index = (value) => {
    r.y = value & 65535;
    r.status = textNZ(r.status, r.y);
  };
  const indirect = (bytes) => {
    const pointer = read(0x8c) | (read(0x8e, 1) << 16);
    return read((pointer + r.y) & 0xffffff, bytes);
  };
  const cacheAddress = r.bank * 65536 + 0x1ce5;
  try {
    access().write(cacheAddress, r.a, 1); // STA before PHP; flags unchanged.
    index(0);
    r.status &= ~32;
    load(indirect(2));
    const header = r.a;
    index(r.a);
    for (;;) {
      phase = 'modeF1FA';
      r.status |= 32;
      load(indirect(1));
      visits++;
      if ((r.a & 255) === 0) break; // No cache compare or sample read on zero.
      index(r.y + 1);
      const cachedMode = read(cacheAddress, 1),
        mode = r.a & 255;
      r.status = textNZ((r.status & ~1) | Number(mode >= cachedMode), (mode - cachedMode) & 255, 1);
      if (mode === cachedMode) {
        load(0x80);
        r.a = ((r.a & 255) << 8) | (r.a >>> 8);
        r.status = textNZ(r.status, r.a & 255, 1);
        load(indirect(1));
        r.status &= ~32;
        const savedY = r.y,
          before = registers(r);
        phase = 'F130';
        const result = renderF130(view, { ...context, ...r, observations: counts }, budget);
        for (const operation of result.operations) operations.push(operation);
        Object.assign(r, {
          a: result.a,
          x: result.x,
          y: result.y,
          bank: result.bank,
          status: result.status,
        });
        matches++;
        polls += result.polls;
        rawBytes += result.rawBytes;
        repeatWords += result.repeatWords;
        calls.push(
          Object.freeze({
            name: 'F130',
            before,
            after: registers(r),
            savedY,
            outcome: result.outcome,
            scanned: result.scanned,
            rawBytes: result.rawBytes,
            repeatWords: result.repeatWords,
            polls: result.polls,
            apuPolls: counts.apuPolls,
            work: budget.work,
            calls: result.calls,
            blocks: result.blocks,
          }),
        );
        index(savedY);
        r.status |= 32;
      }
      index(r.y + 1);
    }
    phase = 'modeF1FA';
    r.status = entryStatus;
    load(read(cacheAddress, 1), 1);
    return textHelperResult(r, budget, operations, {
      outcome: 'mode_samples_prepared',
      inputWord,
      header,
      visits,
      matches,
      polls,
      apuPolls: counts.apuPolls,
      rawBytes,
      repeatWords,
      outputBytes: budget.outputBytes,
      minimumStackBytes: 15,
      calls: Object.freeze(calls),
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: 'F1FA', modePhase: phase, matchIndex: matches };
  }
}
