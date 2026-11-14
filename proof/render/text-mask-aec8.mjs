import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary } from './unpack-9f49.mjs';
import { WRAM_BASE } from '../../src/constants/memory-map.mjs';
import {
  TEXT_PENDING_BYTES,
  TEXT_PIXEL_OFFSET,
  TEXT_WORK_WORD,
  TEXT_MASK_BUFFER,
  TEXT_BUFFER_BYTES,
} from '../../src/task/wram.mjs';
import { WORD_MASK, BANK_SIZE, LONG_MASK } from '../../src/constants/bits.mjs';

const DEFAULT_MAX_WORK = 1000000;
const MASK_STACK_BYTES = 3;
const TEXT_MASK_BYTES = 16;
const TEXT_MASK_WORDS = 8;
const WORD_TOP_BIT_SHIFT = 15;

import {
  textHelperAccess,
  textHelperResult,
  textArithmeticFlags,
  textNZ,
} from './text-helper-access.mjs';

export function prepareRenderAEC8({
  data,
  bank = null,
  status = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = DEFAULT_MAX_WORK,
} = {}) {
  if (y !== null && !isWord(y)) throw Error('Invalid render text mask context');
  const entry = renderEntryBoundary(
    { data, bank, status, emulation, directPage, stackWindow, maxWork },
    MASK_STACK_BYTES,
  );
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow.map((v) => WRAM_BASE + v),
  );
  try {
    return view.finish(renderAEC8(view, { bank, status, y }, { work: 0, maxWork }));
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, ...result } = error;
    return { handled: false, ...result };
  }
}

export function renderAEC8(view, { bank, status, y = null }, budget) {
  const operations = [],
    io = textHelperAccess(view, budget, operations, 'AEC8');
  let a,
    x,
    visits = 0;
  try {
    a = io.read(TEXT_PENDING_BYTES);
    status = textNZ(status, a);
    x = io.read(TEXT_PIXEL_OFFSET);
    status = textNZ(status, x);
    if (x !== 0) {
      const sum = a + TEXT_MASK_BYTES,
        next = sum & WORD_MASK;
      status = textArithmeticFlags(status, a, TEXT_MASK_BYTES, next, sum > WORD_MASK);
      a = next;
      io.write(TEXT_PENDING_BYTES, a);
      y = a;
      // ASL/TAX retain original index bit 15 as Carry; no semantic index cap.
      status = (status & ~1) | (x >>> WORD_TOP_BIT_SHIFT);
      x = (x << 1) & WORD_MASK;
      a = io.read(0x81ac8d + x);
      io.write(TEXT_WORK_WORD, a);
      x = TEXT_MASK_WORDS;
      do {
        const address = (bank * BANK_SIZE + (TEXT_MASK_BUFFER - 2) + y) & LONG_MASK;
        a = io.read(address) | io.read(TEXT_WORK_WORD);
        io.write(address, a);
        visits++;
        y = (y - 2) & WORD_MASK;
        x--;
      } while (x !== 0);
      a = io.read(TEXT_PENDING_BYTES);
      status = textNZ(status, a);
    }
    io.write(bank * BANK_SIZE + TEXT_BUFFER_BYTES, a);
    return textHelperResult({ a, x, y, bank, status }, budget, operations, {
      outcome: 'text_mask_prepared',
      visits,
    });
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    throw { ...error, phase: 'AEC8' };
  }
}
