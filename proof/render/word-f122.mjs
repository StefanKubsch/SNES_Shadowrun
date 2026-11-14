import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF03A } from './pair-f03a.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';

export const prepareRenderF122 = (options) => prepareWordSender(options, false);
export const prepareRenderF1E8 = (options) => prepareWordSender(options, true);

function prepareWordSender(
  {
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
  } = {},
  incrementAddress,
) {
  if (
    [a, x, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead2140 !== null &&
      (!Array.isArray(ioRead2140) ||
        !Array.from(ioRead2140).every((v) => Number.isInteger(v) && v >= 0 && v <= 255)))
  )
    throw Error('Invalid render word sender context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    6,
  );
  if (entry) return entry;
  if ([a, x, y].some((v) => v === null)) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => 0x7e0000 + v),
  );
  try {
    return view.finish(
      renderWordSender(
        view,
        { bank, status, a, x, y, ioMode, ioRead2140 },
        { work: 0, maxWork },
        incrementAddress,
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export const renderF122 = (view, context, budget) => renderWordSender(view, context, budget, false);
export const renderF1E8 = (view, context, budget) => renderWordSender(view, context, budget, true);

// The original WORD PHA supplies two saved BYTE PLAs. Preserve the full
// actual F03A return between them, including its hidden high accumulator.
// No child plan/commit, CPU/stack execution or inferred APU progress.
function renderWordSender(view, context, budget, incrementAddress) {
  const routine = incrementAddress ? 'F1E8' : 'F122',
    inputWord = context.a;
  const r = {
    a: inputWord,
    x: context.x,
    y: context.y,
    bank: context.bank,
    status: context.status | 32,
  };
  const operations = [],
    calls = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  let phase = 'lowByte',
    callIndex = 0,
    polls = 0,
    addressBefore = null,
    addressAfter = null;
  try {
    for (const value of [inputWord & 255, inputWord >>> 8]) {
      phase = callIndex === 0 ? 'lowByte' : 'highByte';
      r.a = (r.a & 0xff00) | value;
      r.status = textNZ(r.status, value, 1);
      const before = Object.freeze({ ...r });
      const p = renderF03A(view, { ...context, ...r, observations: counts }, budget);
      operations.push(...p.operations);
      polls += p.polls;
      Object.assign(r, { a: p.a, x: p.x, y: p.y, bank: p.bank, status: p.status });
      calls.push(
        Object.freeze({
          name: 'F03A',
          inputByte: value,
          buffered: p.buffered,
          before,
          after: Object.freeze({ ...r }),
          polls: p.polls,
          apuPolls: counts.apuPolls,
          work: budget.work,
        }),
      );
      callIndex++;
    }
    r.status &= ~32; // Original REP20 does not recompute N/Z from full A.
    if (incrementAddress) {
      phase = 'address';
      const io = textHelperAccess(view, budget, operations, phase);
      for (let n = 0; n < 2; n++) {
        const old = io.read(0x96);
        if (n === 0) addressBefore = old;
        addressAfter = (old + 1) & 65535;
        io.write(0x96, addressAfter);
        r.status = textNZ(r.status, addressAfter);
      }
    }
    return textHelperResult(r, budget, operations, {
      outcome: 'apu_word_requests_prepared',
      routine,
      inputWord,
      polls,
      apuPolls: counts.apuPolls,
      addressBefore,
      addressAfter,
      calls: Object.freeze(calls),
      outputBytes: 0,
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, routine, callIndex, phase: error.phase ?? phase };
  }
}
