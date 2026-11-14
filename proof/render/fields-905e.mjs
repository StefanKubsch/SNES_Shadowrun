import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { BANK_SIZE } from '../../src/constants/bits.mjs';
import { PORTRAIT_PALETTE_START, OAM_HIGH_TABLE, OAM_BUFFER } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { render8FF5 } from './setup-8ff5.mjs';
import { renderA954 } from './gate-a954.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const FIELDS_STACK_BYTES = 5;
const SPRITE_OFFSET = 8;
const PALETTE_START = 0xa1;
const UPLOAD_VRAM_WORD = 0x800;
const SPRITE_POSITION = 0x1a1a;
const SPRITE_SELECTOR = 0x1ba;
const SPRITE_ATTRIBUTES = 0x3480;
const SELECTOR_FLIP_BIT = 0x80;
const SPRITE_FLIP_BIT = 0x4000;
const HIGH_TABLE_VALUE = 0x28;
const FIELD_OUTPUT_BYTES = 6;

export function prepareRender905E({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  ioMode = null,
  waitMode = null,
  waitRead0140 = null,
} = {}) {
  if (
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (waitMode !== null && waitMode !== 'record-observations') ||
    (waitRead0140 !== null &&
      (!Array.isArray(waitRead0140) || !Array.from(waitRead0140).every(isWord)))
  )
    throw Error('Invalid render 905E context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    FIELDS_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((address) => WRAM_BASE + address),
  );
  try {
    return view.finish(
      render905E(
        view,
        { bank, status, y, ioMode, waitMode, waitRead0140 },
        { work: 0, maxWork, outputBytes: 0, maxOutputBytes },
      ),
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

// Actual8FF5 and A954 share this source-specific field plan. No CPU/stack,
// transfer or callback execution. Only the outer owner finishes/commits.
export function render905E(view, context, budget) {
  const operations = [],
    observations = context.observations ?? {},
    base = context.bank * BANK_SIZE;
  let phase = 'prefix';
  budget.outputBytes ??= 0;
  const access = () => textHelperAccess(view, budget, operations, phase);
  const write = (address, value) => {
    renderOutputBytes(budget, 2);
    access().write(address, value);
  };
  try {
    write(base + PORTRAIT_PALETTE_START, PALETTE_START);
    phase = 'setupWait';
    const helper = render8FF5(view, { ...context, x: UPLOAD_VRAM_WORD, observations }, budget);
    for (const operation of helper.operations) operations.push(operation);
    phase = 'firstField';
    write(WRAM_BASE + OAM_BUFFER + SPRITE_OFFSET, SPRITE_POSITION);
    phase = 'selector';
    const selector = access().read(base + SPRITE_SELECTOR);
    const fieldWord = SPRITE_ATTRIBUTES | (selector & SELECTOR_FLIP_BIT ? SPRITE_FLIP_BIT : 0);
    write(WRAM_BASE + OAM_BUFFER + SPRITE_OFFSET + 2, fieldWord);
    phase = 'lastField';
    write(WRAM_BASE + OAM_HIGH_TABLE, HIGH_TABLE_VALUE);
    phase = 'increment';
    // WORDLSR of the masked/swapped selector sets C0; last LDA0028 sets
    // N0/Z0 before actual A954 replaces N/Z from the fresh memory result.
    const increment = renderA954(
      view,
      {
        ...context,
        a: HIGH_TABLE_VALUE,
        x: UPLOAD_VRAM_WORD,
        status: textNZ(helper.status & ~1, HIGH_TABLE_VALUE),
      },
      budget,
    );
    for (const operation of increment.operations) operations.push(operation);
    return textHelperResult(
      {
        a: increment.a,
        x: increment.x,
        y: increment.y,
        bank: increment.bank,
        status: increment.status,
      },
      budget,
      operations,
      {
        outcome: 'dialog_second_fields_prepared',
        selector,
        fieldWord,
        previous: increment.previous,
        value: increment.value,
        polls: helper.polls,
        observed: helper.a,
        waitPolls0140: observations.waitPolls0140,
        fieldOutputBytes: FIELD_OUTPUT_BYTES,
        outputBytes: budget.outputBytes,
        minimumStackBytes: FIELDS_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, calleeCaller: error.caller ?? null, caller: '905E', compositionPhase: phase };
  }
}
