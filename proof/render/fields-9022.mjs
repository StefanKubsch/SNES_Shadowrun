import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import { BANK_SIZE, WORD_MASK, WORD_SIGN } from '../../src/constants/bits.mjs';
import { PORTRAIT_PALETTE_START, OAM_BUFFER, OAM_HIGH_TABLE } from '../../src/task/wram.mjs';
import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { render8FF5 } from './setup-8ff5.mjs';
import { textHelperAccess, textHelperResult, textNZ } from './text-helper-access.mjs';
import { renderOutputBytes } from './output-budget.mjs';

const DEFAULT_MAX_WORK = 1000000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;
const OAM_RECORD_BYTES = 4;
const FIELDS_STACK_BYTES = 4;
const PALETTE_START = 0x91;
const LAST_Y_BYTE_OFFSET = 0x1fd;
const HIDDEN_SPRITE_Y = 0xf0;
const LAST_HIGH_WORD_OFFSET = 0x1e;
const FIRST_SPRITE_POSITION = 0x83a6;
const FIRST_SPRITE_ATTRIBUTES = 0x3200;
const SPRITE_COUNT = 128;
const HIGH_TABLE_WORDS = 16;
const FIELD_OUTPUT_BYTES = 164;

export function prepareRender9022({
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
    throw Error('Invalid render 9022 context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork, maxOutputBytes },
    FIELDS_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((a) => WRAM_BASE + a),
  );
  try {
    return view.finish(
      render9022(
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

// Actual8FF5 is the sole inner call. The source overwrites entry A/X; fixed
// long fields use7E even when the metadata/setup use another actual DBR.
// Only the outer owner finishes/commits the shared view and observations.
export function render9022(view, context, budget) {
  const operations = [],
    observations = context.observations ?? {};
  let phase = 'prefix',
    x,
    helper;
  budget.outputBytes ??= 0;
  const write = (address, value, bytes = 2) => {
    renderOutputBytes(budget, bytes);
    textHelperAccess(view, budget, operations, phase).write(address, value, bytes);
  };
  try {
    write(context.bank * BANK_SIZE + PORTRAIT_PALETTE_START, PALETTE_START);
    phase = 'setupWait';
    helper = render8FF5(view, { ...context, x: 0, observations }, budget);
    for (const operation of helper.operations) operations.push(operation);
    phase = 'byteFields';
    x = LAST_Y_BYTE_OFFSET;
    do {
      write(WRAM_BASE + OAM_BUFFER + x, HIDDEN_SPRITE_Y, 1);
      x = (x - OAM_RECORD_BYTES) & WORD_MASK;
    } while (!(x & WORD_SIGN));
    phase = 'wordFields';
    x = LAST_HIGH_WORD_OFFSET;
    do {
      write(WRAM_BASE + OAM_HIGH_TABLE + x, 0);
      x = (x - 2) & WORD_MASK;
    } while (!(x & WORD_SIGN));
    phase = 'tail';
    write(WRAM_BASE + OAM_BUFFER + OAM_RECORD_BYTES, FIRST_SPRITE_POSITION);
    write(WRAM_BASE + OAM_BUFFER + OAM_RECORD_BYTES + 2, FIRST_SPRITE_ATTRIBUTES);
    return textHelperResult(
      {
        a: FIRST_SPRITE_ATTRIBUTES,
        x,
        y: context.y ?? null,
        bank: context.bank,
        status: textNZ(context.status, FIRST_SPRITE_ATTRIBUTES),
      },
      budget,
      operations,
      {
        outcome: 'dialog_fields_prepared',
        polls: helper.polls,
        waitPolls0140: observations.waitPolls0140,
        observed: helper.a,
        byteStores: SPRITE_COUNT,
        wordStores: HIGH_TABLE_WORDS,
        fieldOutputBytes: FIELD_OUTPUT_BYTES,
        outputBytes: budget.outputBytes,
        minimumStackBytes: FIELDS_STACK_BYTES,
      },
    );
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, calleeCaller: error.caller ?? null, caller: '9022', compositionPhase: phase };
  }
}
