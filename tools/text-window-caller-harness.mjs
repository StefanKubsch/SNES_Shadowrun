import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../src/constants/bits.mjs';
import {
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVB,
  RDDIVL,
  RDMPYL,
} from '../src/constants/hardware-registers.mjs';
import assert from 'node:assert/strict';
import { createSide, pictureState } from './lift-function-harness.mjs';
import { windowMapSource } from './lift-window-samples.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { NativeCallContinuation } from './register-forms/native-call-continuation.mjs';
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

const HEX_RADIX = 16,
  FIXTURE_SEED = 17,
  WRAM_BASE = 0x7e0000,
  WRAM_BYTES = 0x20000,
  GAME_STATE_START = 0x1cc,
  SAVED_REGISTERS_START = 0x1c78,
  SAVED_REGISTERS_END = 0x1cbc,
  CPU_STACK_START = 0x100,
  CPU_STACK_END = 0x1ca,
  CALLER_RETURN = 0x1234,
  CODE_BANK = 0x80,
  DIALOG_ENTRY = 0x9178,
  MASK_BYTES = 32,
  TEXT_DATA_BANK = 0x7e,
  CAPTURE_BYTES = 256,
  // White (all three 5-bit components at 31).
  FIXTURE_FIXED_COLOUR = 0x7fff,
  // CGADSUB bits 0-5: BG1-BG4, OBJ and the back area.
  FIXTURE_MATH_LAYERS = 0x3f,
  // The dialog font DMAs (81:AB2C): 64 bytes each, the second to VRAM word 100.
  FONT_DMA_BYTES = 0x40,
  FONT_SOURCE = 0x8dfb78,
  FONT_SECOND_SOURCE = 0x8dfd78,
  FONT_SECOND_VRAM = 0x200,
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
// branches (the mode 7 product comes from the side's picture back end). Existing integration comparisons retain actual devices and NMIs.
export function textWindowSide() {
  const side = createSide({ seed: FIXTURE_SEED, wram: new Uint8Array(WRAM_BYTES) }, new Map()),
    { a, mem } = side,
    put = (at, value) => mem.write16(WRAM_BASE | at, value),
    read = a.devices.read,
    write = a.devices.write;
  windowMapSource(mem.wram, mem);
  for (const [at, value] of DEFAULT_WINDOW_FIELDS) {
    put(at, value);
    assert.equal(
      mem.wram[at] | (mem.wram[at + 1] << BYTE_BITS),
      value,
      'fixture initializes WRAM window fields',
    );
  }
  let multiplier = 0,
    product = 0,
    dividend = 0,
    quotient = 0;
  a.devices = {
    bus: side.picture,
    read(address, width) {
      const at = address & WORD_MASK;
      const value = at === RDDIVL ? quotient : at === RDMPYL ? product : null;
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
      }
    },
  };
  const frames = new LagFreeFrames({ nmitimen: CODE_BANK }),
    uploads = [],
    calls = [];
  frames.textWait = (_h, _events, _status, pc) => {
    assert.ok(
      UPLOAD_REQUESTS.has(pc),
      `only known text/window upload branches: ${pc.toString(HEX_RADIX)}`,
    );
    uploads.push([pc, mem.wram.slice(GAME_STATE_START)]);
    if (pc === 0x81accc) mem.wram.fill(0, TEXT_MASK_BUFFER, TEXT_MASK_BUFFER + MASK_BYTES);
    put(UPLOAD_REQUESTS.get(pc), 0);
    return true;
  };
  Object.assign(a.ctx, { programBank: CODE_BANK, bank: CODE_BANK, pc: DIALOG_ENTRY });
  // A lit fixed colour and colour math on every layer, so that their resets show in
  // the picture state.
  side.picture.fixedColour = FIXTURE_FIXED_COLOUR;
  side.picture.mathLayers = FIXTURE_MATH_LAYERS;
  side.put = put;
  side.events = { interrupts: frames };
  side.uploads = uploads;
  side.calls = calls;
  // The text buffer stand-in records the buffer with the text data bank 7E that the
  // original entry 80:FB39 runs in (the record kept its former shape).
  side.render = function* () {
    yield () =>
      calls.push([
        'text',
        TEXT_DATA_BANK,
        mem.wram.slice(TEXT_BUFFER, TEXT_BUFFER + CAPTURE_BYTES),
      ]);
  };
  return side;
}

// The picture back end behind a result's picture state (results are often copied).
const pictures = new WeakMap();
export const pictureVideoOf = (result) => pictures.get(result.picture);

// Whether the picture holds the dialog font set-up: OBJSEL 0 and the two 64-byte font
// DMAs from 8D:FB78 and 8D:FD78 to VRAM words 0 and 100.
export function fontUploaded(result) {
  const video = pictureVideoOf(result),
    same = (at, source) =>
      Array.from({ length: FONT_DMA_BYTES }, (_, n) => video.memory.read8(source + n)).every(
        (v, n) => v === video.vram[at + n],
      );
  return (
    video.objectSizes === 0 &&
    video.objectBase === 0 &&
    same(0, FONT_SOURCE) &&
    same(FONT_SECOND_VRAM, FONT_SECOND_SOURCE)
  );
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
  const picture = pictureState(side.picture);
  pictures.set(picture, side.picture);
  return {
    wram: mem.wram,
    calls: side.calls,
    uploads: side.uploads,
    writes: side.writes,
    picture,
    result: continuation.result,
  };
}

export function rendererTable(side) {
  // Preserve pausing on the dispatched side without sharing its caller.
  const run = () => assert.fail('renderer requires continuation');
  return {
    run,
    create: () => new NativeCallContinuation(side.a, side.render(side.h, side.events)),
  };
}
