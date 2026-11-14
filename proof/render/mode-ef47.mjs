import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF25A } from './mode-f25a.mjs';
import { renderF007 } from './apu-f007.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';

export function prepareRenderEF47({
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
    throw Error('Invalid render EF47 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    22,
  );
  if (entry) return entry;
  if (a === null || y === null) return { handled: false, reason: 'render_entry_required' };
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => 0x7e0000 + v),
  );
  try {
    return view.finish(
      renderEF47(
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

// Source-specific WORD cache store and actual mode/command callees. All
// effects remain on the caller's shared view until its single outer commit.
export function renderEF47(view, context, budget) {
  const inputWord = context.a,
    r = { a: inputWord, y: context.y, bank: context.bank, status: context.status };
  const operations = [],
    calls = [],
    counts = context.observations ?? {};
  counts.apuPolls ??= 0;
  budget.outputBytes ??= 0;
  let phase = 'modeCache',
    polls = 0;
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
        zeroPath: result.zeroPath ?? null,
        mode: result.mode ?? null,
        loaderWord: result.loaderWord ?? null,
        polls: result.polls ?? 0,
        apuPolls: counts.apuPolls,
        work: budget.work,
        calls: result.calls ?? Object.freeze([]),
      }),
    );
  };
  const command = (a, x, role) => {
    r.a = a;
    r.status = textNZ(r.status, a);
    r.x = x;
    r.status = textNZ(r.status, x);
    call('F007', renderF007, role);
  };
  try {
    textHelperAccess(view, budget, operations, phase).write(r.bank * 65536 + 0x1cde, inputWord);
    call('F25A', renderF25A, 'modeComposition');
    command(0x000d, 0x2020, 'command0D');
    command(0x0002, 0x7f7f, 'command02');
    return textHelperResult(r, budget, operations, {
      outcome: 'mode_requests_composed',
      inputWord,
      inputMode: inputWord & 255,
      zeroPath: calls[0].zeroPath,
      mode: calls[0].mode,
      loaderWord: calls[0].loaderWord,
      polls,
      apuPolls: counts.apuPolls,
      outputBytes: budget.outputBytes,
      minimumStackBytes: 22,
      calls: Object.freeze(calls),
      ioReads: Object.freeze(operations.filter((e) => e.space === 'io' && e.kind === 'read')),
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw {
      ...error,
      calleeCaller: error.caller ?? null,
      calleeCompositionPhase: error.compositionPhase ?? null,
      calleeCompositionCallIndex: error.compositionCallIndex ?? null,
      caller: 'EF47',
      compositionPhase: phase,
      compositionCallIndex: calls.length,
    };
  }
}
