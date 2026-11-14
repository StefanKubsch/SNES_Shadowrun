import { BYTE_MASK, WORD_MASK, BANK_SIZE, LONG_MASK } from '../../src/constants/bits.mjs';
import { WRAM_BASE, WRAM_BANK } from '../../src/constants/memory-map.mjs';
import { TOPIC_LIST, TOPIC_FLAGS, DIALOG_END } from '../../src/task/wram.mjs';
import { FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { renderF963 } from './allocate-f963.mjs';
import { renderA6C7 } from './menu-a6a5.mjs';
import { renderFA3E } from './clear-ff79.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const CHOICE_STACK_BYTES = 28;
const RELEASE_CALL_STACK_BYTES = 4;
const COLUMNS_ARGUMENT = 4;
const ROWS_ARGUMENT = 6;
const TOPIC_SCRATCH = 0x23;
const WORD_SIGN_SHIFT = 15;
const TOPIC_TEXT_LIST = 0x154;
const CHOICE_LEFT = 6;
const CHOICE_TOP = 15;
const CHOICE_COLUMNS = 14;
const CHOICE_ROWS = 11;
const TEXT_POINTER_ARGUMENT = 8;
const ALLOCATION_SCRATCH = 0x1a;
const CHOICE_VISIBLE_ROWS = 9;
const TEXT_BANK_ARGUMENT = 10;

const isByte = (value) => Number.isInteger(value) && value >= 0 && value <= BYTE_MASK;
export function prepareRender9215({
  data,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  divisionMode = null,
  ioMode = null,
  waitMode = null,
  ioRead2134 = null,
  ioRead4214Word = null,
  ioRead4216Byte = null,
  ioRead4214 = null,
  ioRead4216 = null,
  ioRead4217 = null,
  ioRead2140 = null,
  waitRead01F6 = null,
  waitRead01F8 = null,
  waitRead01FA = null,
  waitRead01FC = null,
  waitRead1C76 = null,
} = {}) {
  if (
    [x, y].some((value) => value !== null && !isWord(value)) ||
    (divisionMode !== null && divisionMode !== 'stable-native') ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    [
      ioRead2134,
      ioRead4214Word,
      ioRead4216,
      waitRead01F6,
      waitRead01F8,
      waitRead01FA,
      waitRead01FC,
      waitRead1C76,
    ].some(
      (values) => values !== null && (!Array.isArray(values) || !Array.from(values).every(isWord)),
    ) ||
    [ioRead4216Byte, ioRead4214, ioRead4217, ioRead2140].some(
      (values) => values !== null && (!Array.isArray(values) || !Array.from(values).every(isByte)),
    )
  )
    throw Error('Invalid render 9215 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    CHOICE_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      render9215(
        view,
        {
          bank,
          status,
          x,
          y,
          divisionMode,
          ioMode,
          waitMode,
          ioRead2134,
          ioRead4214Word,
          ioRead4216Byte,
          ioRead4214,
          ioRead4216,
          ioRead4217,
          ioRead2140,
          waitRead01F6,
          waitRead01F8,
          waitRead01FA,
          waitRead01FC,
          waitRead1C76,
          stackBytes: stackWindow[1] - stackWindow[0] + 1,
        },
        { work: 0, maxWork, maxOutputBytes, outputBytes: 0 },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Fixed original collection/menu/release/remap algorithm. Host saved words
// represent PHX/PLX and PEI/PLY only under the proved disjoint28-byte stack.
// Fresh bytes and actual callees share one owner; no CPU/stack execution.
export function render9215(view, context, budget) {
  const operations = [],
    byteOperations = [],
    calls = [],
    observations = context.observations ?? {};
  for (const key of ['productReads', 'pollsF6', 'pollsF8']) observations[key] ??= 0;
  const r = {
    a: 0,
    x: context.x ?? null,
    y: context.y ?? null,
    bank: context.bank,
    status: context.status,
  };
  let phase = 'initial',
    scanReads = 0,
    accepted = 0,
    remapReads = 0;
  budget.outputBytes ??= 0;
  // Full chronological provider ledger, including helper bytes. Each actual
  // helper retains its own work accounting and the same cumulative budget.
  const shared = {
    read(address) {
      const value = view.read(address);
      byteOperations.push(Object.freeze({ kind: 'read', phase, address, value, bytes: 1 }));
      return value;
    },
    write(address, value) {
      view.write(address, value);
      byteOperations.push(Object.freeze({ kind: 'write', phase, address, value, bytes: 1 }));
    },
  };
  const access = () => textHelperAccess(shared, budget, operations, 'choice9215:' + phase);
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
  const absolute = (offset, i = 0) => (r.bank * BANK_SIZE + offset + i) & LONG_MASK;
  const write = (address, value = r.a) => {
    renderOutputBytes(budget, 2);
    access().write(address, value);
  };
  const finish = (outcome, fields = {}) =>
    textHelperResult(r, budget, operations, {
      outcome,
      scanReads,
      accepted,
      remapReads,
      ...fields,
      ...observations,
      minimumStackBytes: CHOICE_STACK_BYTES,
      outputBytes: budget.outputBytes,
      calls: Object.freeze(calls),
      byteOperations: Object.freeze(byteOperations),
    });
  const empty = () => {
    phase = 'empty';
    load(WORD_MASK);
    write(0);
    return finish('choice_empty');
  };
  const call = (name, run, extra = {}) => {
    phase = name;
    const before = Object.freeze({ ...r });
    const result = run(
      shared,
      {
        ...context,
        ...r,
        observations,
        stackBytes:
          (context.stackBytes ?? CHOICE_STACK_BYTES) -
          (name === 'FA3E' ? RELEASE_CALL_STACK_BYTES : 2),
        ...extra,
      },
      budget,
    );
    for (const operation of result.operations) operations.push(operation);
    Object.assign(r, {
      a: result.a,
      x: result.x,
      y: result.y,
      bank: result.bank,
      status: result.status,
    });
    if (name === 'F963') {
      observations.productReads += result.productReads ?? 0;
      observations.pollsF6 += result.requestPolls ?? 0;
      observations.pollsF8 += result.transferPolls ?? 0;
    }
    if (name === 'FA3E') observations.pollsF8 += result.polls;
    calls.push(
      Object.freeze({
        name,
        before,
        after: Object.freeze({ ...r }),
        outcome: result.outcome,
        work: budget.work,
        outputBytes: budget.outputBytes,
        ...observations,
        ...(name === 'FA3E'
          ? { buffer: result.buffer, trimmed: result.trimmed, trimVisits: result.trimVisits }
          : {}),
      }),
    );
    return result;
  };
  try {
    load(access().read(WRAM_BASE + TOPIC_LIST));
    load(r.a & BYTE_MASK);
    compare(r.a, BYTE_MASK);
    if (r.status & 2) return empty();
    index('x', 0);
    index('y', r.x);
    for (;;) {
      phase = 'collect';
      scanReads++;
      load(access().read(WRAM_BASE + TOPIC_LIST + r.x));
      load(r.a & BYTE_MASK);
      compare(r.a, BYTE_MASK);
      if (r.status & 2) break;
      write(TOPIC_SCRATCH);
      load(access().read(WRAM_BASE + TOPIC_FLAGS + r.x));
      load(r.a & BYTE_MASK);
      if (r.a === 0) {
        const savedX = r.x;
        load(access().read(TOPIC_SCRATCH));
        r.status = (r.status & ~1) | (r.a >>> WORD_SIGN_SHIFT);
        load(r.a << 1);
        index('x', r.a);
        load(access().read(0x8d8000 + r.x));
        write(absolute(TOPIC_TEXT_LIST, r.y));
        index('x', savedX);
        index('y', r.y + 1);
        index('y', r.y + 1);
        accepted++;
      }
      index('x', r.x + 1);
    }
    compare(r.y, 0);
    if (r.status & 2) return empty();
    phase = 'terminate';
    load(0);
    write(absolute(TOPIC_TEXT_LIST, r.y));
    phase = 'allocate-parameters';
    for (const [address, value] of [
      [0, CHOICE_LEFT],
      [2, CHOICE_TOP],
      [COLUMNS_ARGUMENT, CHOICE_COLUMNS],
      [ROWS_ARGUMENT, CHOICE_ROWS],
      [TEXT_POINTER_ARGUMENT, 0],
    ]) {
      load(value);
      write(address);
    }
    call('F963', renderF963, {
      ioRead2134: context.ioRead2134?.slice(observations.productReads) ?? null,
      waitRead01F6: context.waitRead01F6?.slice(observations.pollsF6) ?? null,
      waitRead01F8: context.waitRead01F8?.slice(observations.pollsF8) ?? null,
    });
    phase = 'menu-parameters';
    load(access().read(0));
    const allocation = r.a;
    write(ALLOCATION_SCRATCH);
    for (const [address, value] of [
      [2, 1],
      [COLUMNS_ARGUMENT, 0],
      [ROWS_ARGUMENT, CHOICE_VISIBLE_ROWS],
      [TEXT_POINTER_ARGUMENT, TOPIC_TEXT_LIST],
      [TEXT_BANK_ARGUMENT, WRAM_BANK],
    ]) {
      load(value);
      write(address);
    }
    const menu = call('A6C7', renderA6C7);
    phase = 'save-selection';
    const selection = access().read(0); // PEI00 does not load A or change flags.
    phase = 'release-parameters';
    load(access().read(ALLOCATION_SCRATCH));
    const releaseBuffer = r.a;
    write(0);
    const release = call('FA3E', renderFA3E, {
      waitRead01F8: context.waitRead01F8?.slice(observations.pollsF8) ?? null,
    });
    phase = 'restore-selection';
    index('y', selection);
    compare(r.y, WORD_MASK);
    if (r.status & 2) {
      phase = 'cancel';
      write(absolute(DIALOG_END), r.y);
      write(0, r.y);
      return finish('choice_cancelled', {
        selection,
        allocation,
        releaseBuffer,
        menuOutcome: menu.outcome,
        releaseOutcome: release.outcome,
      });
    }
    index('x', 0);
    for (;;) {
      phase = 'remap';
      remapReads++;
      load(access().read(WRAM_BASE + TOPIC_FLAGS + r.x));
      load(r.a & BYTE_MASK);
      if (r.a === 0) {
        index('y', r.y - 1);
        if (r.status & FLAG_NEGATIVE) {
          write(0, r.x);
          return finish('choice_remapped', {
            selection,
            allocation,
            releaseBuffer,
            menuOutcome: menu.outcome,
            releaseOutcome: release.outcome,
          });
        }
      }
      index('x', r.x + 1);
    }
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, calleeCaller: error.caller ?? null, caller: '9215', compositionPhase: phase };
  }
}
