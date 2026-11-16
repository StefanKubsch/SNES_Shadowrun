import { BYTE_BITS, WORD_BITS, BYTE_MASK, WORD_MASK, LONG_MASK } from '../src/constants/bits.mjs';
import {
  M7A,
  M7B,
  MPYL,
  MPYM,
  MPYH,
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVB,
  RDDIVL,
  RDMPYL,
} from '../src/constants/hardware-registers.mjs';
import assert from 'node:assert/strict';
import { createSide } from './lift-function-harness.mjs';
import { windowMapSource } from './lift-window-samples.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { NativeCallContinuation } from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import {
  TEXT_BUFFER,
  TEXT_MASK_BUFFER,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
  WINDOW_TILE_START,
  WINDOW_CURSOR_TILE,
  WINDOW_LAST_INDEX,
  WINDOW_NEXT_TILE,
} from '../src/data/wram.mjs';

const FIXTURE_SEED = 17,
  WRAM_BYTES = 0x20000,
  GAME_STATE_START = 0x1cc,
  SAVED_REGISTERS_START = 0x1c78,
  SAVED_REGISTERS_END = 0x1cbc,
  CPU_STACK_START = 0x100,
  CPU_STACK_END = 0x1ca,
  CALLER_RETURN = 0x1234,
  CODE_BANK = 0x80,
  DIALOG_ENTRY = 0x9178,
  SIGNED_BYTE_SHIFT = 24,
  MASK_BYTES = 32,
  CAPTURE_BYTES = 256,
  STEP_LIMIT = 100000;
const DEFAULT_WINDOW_FIELDS = [
  [WINDOW_COLUMNS, 14],
  [WINDOW_ROWS, 8],
  [WINDOW_TILE_START, 0x2027],
  [WINDOW_CURSOR_TILE, 0x2027],
  [WINDOW_LAST_INDEX, 0],
  [WINDOW_NEXT_TILE, 0x2070],
];
const UPLOAD_REQUESTS = new Map([
  [0x81acb2, 0x1f8],
  [0x81acc0, 0x1f6],
  [0x81accc, 0x1fc],
  [0x81acc6, 0x1fa],
]);

// Isolate caller contracts with deterministic arithmetic and serviced upload
// branches. Existing integration comparisons retain actual devices and NMIs.
export function textWindowSide() {
  const side = createSide({ seed: FIXTURE_SEED, wram: new Uint8Array(WRAM_BYTES) }, new Map()),
    { a, mem } = side,
    put = (at, value) => mem.write16(at, value),
    read = a.devices.read,
    write = a.devices.write;
  windowMapSource(mem.wram, mem);
  for (const [at, value] of DEFAULT_WINDOW_FIELDS) put(at, value);
  let multiplier = 0,
    product = 0,
    dividend = 0,
    quotient = 0,
    latch = 0,
    mode7 = 0,
    mode7product = 0;
  a.devices = {
    read(address, width) {
      const at = address & WORD_MASK;
      const value =
        at === RDDIVL
          ? quotient
          : at === RDMPYL
            ? product
            : at === MPYL
              ? mode7product
              : at === MPYM
                ? mode7product >>> BYTE_BITS
                : at === MPYH
                  ? mode7product >>> WORD_BITS
                  : null;
      return value === null ? read(address, width) : value & (width === 1 ? BYTE_MASK : WORD_MASK);
    },
    write(pc, address, value, width) {
      write(pc, address, value, width);
      const at = address & WORD_MASK;
      if (at === WRMPYA) multiplier = value & BYTE_MASK;
      else if (at === WRMPYB) product = multiplier * (value & BYTE_MASK);
      else if (at === WRDIVL) dividend = value;
      else if (at === WRDIVB) {
        quotient = value ? Math.floor(dividend / value) : WORD_MASK;
        product = value ? dividend % value : dividend;
      } else if (at === M7A) {
        mode7 = ((value & BYTE_MASK) << BYTE_BITS) | latch;
        latch = value & BYTE_MASK;
      } else if (at === M7B)
        mode7product =
          (((mode7 << WORD_BITS) >> WORD_BITS) *
            ((value << SIGNED_BYTE_SHIFT) >> SIGNED_BYTE_SHIFT)) &
          LONG_MASK;
    },
  };
  const frames = new LagFreeFrames({ nmitimen: CODE_BANK }),
    uploads = [],
    calls = [];
  frames.textWait = (_h, _events, _status, pc) => {
    assert.ok(UPLOAD_REQUESTS.has(pc), 'only known text/window upload branches');
    uploads.push([pc, mem.wram.slice(GAME_STATE_START)]);
    if (pc === 0x81accc) mem.wram.fill(0, TEXT_MASK_BUFFER, TEXT_MASK_BUFFER + MASK_BYTES);
    put(UPLOAD_REQUESTS.get(pc), 0);
    return true;
  };
  Object.assign(a.ctx, { programBank: CODE_BANK, bank: CODE_BANK, pc: DIALOG_ENTRY });
  side.put = put;
  side.events = { interrupts: frames };
  side.uploads = uploads;
  side.calls = calls;
  side.render = function* (callee) {
    yield () =>
      calls.push([
        'text',
        callee.ctx.bank,
        mem.wram.slice(TEXT_BUFFER, TEXT_BUFFER + CAPTURE_BYTES),
      ]);
    let result;
    yield () => {
      result = callee.rts();
    };
    return result;
  };
  return side;
}

export function finishTextWindow(side, sequence, budget) {
  const { a, h, mem } = side;
  h.push(CALLER_RETURN, 2);
  const continuation = new NativeCallContinuation(a, sequence),
    before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let steps = 0;
  while (continuation.run(budget) === WAIT_PAUSED)
    assert.ok(++steps < STEP_LIMIT, 'bounded caller');
  mem.wram.fill(0, CPU_STACK_START, CPU_STACK_END);
  mem.wram.fill(0, SAVED_REGISTERS_START, SAVED_REGISTERS_END);
  return {
    wram: mem.wram,
    calls: side.calls,
    uploads: side.uploads,
    writes: side.writes,
    result: continuation.result,
  };
}

export function rendererTable(side) {
  // Preserve pausing on the dispatched side without sharing its caller.
  const run = () => assert.fail('renderer requires continuation');
  return { run, create: () => new NativeCallContinuation(side.a, side.render(side.h)) };
}
