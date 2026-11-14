import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF007 } from './apu-f007.mjs';
import { renderF1FA } from './mode-f1fa.mjs';
import { renderF130 } from './samples-f130.mjs';
import { textHelperResult, textNZ, textArithmeticFlags } from './text-helper-access.mjs';

export function prepareRenderF25A({
  data,
  bank = null,
  status = null,
  a = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  maxOutputBytes = 65536,
  ioMode = null,
  ioRead2140 = null,
} = {}) {
  if (
    [a, y].some((v) => v !== null && !isWord(v)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (ioRead2140 !== null &&
      (!Array.isArray(ioRead2140) ||
        !Array.from(ioRead2140).every((v) => Number.isInteger(v) && v >= 0 && v <= 255)))
  )
    throw Error('Invalid render F25A context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    19,
    status & 32 ? 1 : 2,
  );
  if (entry) return entry;
  if (a === null || y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => 0x7e0000 + v),
  );
  try {
    return view.finish(
      renderF25A(
        view,
        { bank, status, a, y, ioMode, ioRead2140 },
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

// Source-specific mode composition. Host saved bytes represent the proved
// BYTE/WORD PHA/PLA and PHP/PLP transfers, never a CPU stack implementation.
// Real callees share this view/budget/global transcript and one outer commit.
export function renderF25A(view, context, budget) {
  const entryStatus = context.status,
    inputWord = context.a,
    inputMode = inputWord & 255;
  const r = {
    a: inputWord,
    x: 0,
    y: context.y,
    bank: context.bank,
    status: (entryStatus & ~16) | 32,
  };
  const operations = [],
    calls = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  budget.outputBytes ??= 0;
  let phase = 'initialCommand',
    polls = 0,
    mode = null,
    loaderWord = null;
  const load = (value, bytes = r.status & 32 ? 1 : 2) => {
    const mask = bytes === 1 ? 255 : 65535;
    r.a = (r.a & ~mask) | (value & mask);
    r.status = textNZ(r.status, r.a & mask, bytes);
  };
  const index = (value) => {
    r.x = value & 65535;
    r.status = textNZ(r.status, r.x);
  };
  const call = (name, run, role) => {
    phase = role;
    const before = registers(r);
    const result = run(
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
    if (name === 'F007' && r.bank !== 0x7e && r.bank !== 0x7f) counts.apuPolls += result.polls;
    polls += result.polls ?? 0;
    for (const operation of result.operations) operations.push(operation);
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
        after: registers(r),
        outcome: result.outcome,
        command: result.command ?? null,
        matches: result.matches ?? 0,
        visits: result.visits ?? 0,
        rawBytes: result.rawBytes ?? 0,
        repeatWords: result.repeatWords ?? 0,
        polls: result.polls ?? 0,
        apuPolls: counts.apuPolls,
        work: budget.work,
        calls: result.calls ?? Object.freeze([]),
        blocks: result.blocks ?? Object.freeze([]),
      }),
    );
  };
  try {
    load(4);
    index(0);
    call('F007', renderF007, 'initialCommand');
    load(inputMode, 1); // BYTE PLA changes only Low-A and N/Z, including zero.
    if (inputMode !== 0) {
      call('F1FA', renderF1FA, 'modeList');
      r.status &= ~32;
      load(r.a & 255);
      mode = r.a; // AND00FF, protected WORD PHA.
      load(r.a ^ 65535);
      r.status &= ~1;
      const left = r.a,
        total = left + 0x8100;
      r.a = total & 65535;
      r.status = textArithmeticFlags(r.status, left, 0x8100, r.a, total > 65535);
      loaderWord = r.a;
      call('F130', renderF130, 'modeLoader');
      load(mode);
      load(r.a | 0x0100);
      index(r.a); // WORD PLA/ORA/TAX.
      r.status |= 32;
      load(4);
      call('F007', renderF007, 'finalCommand');
    }
    r.status = entryStatus;
    return textHelperResult(r, budget, operations, {
      outcome: 'mode_requests_composed',
      inputWord,
      inputMode,
      mode,
      loaderWord,
      zeroPath: inputMode === 0,
      polls,
      apuPolls: counts.apuPolls,
      outputBytes: budget.outputBytes,
      minimumStackBytes: 19,
      calls: Object.freeze(calls),
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, caller: 'F25A', compositionPhase: phase, compositionCallIndex: calls.length };
  }
}
