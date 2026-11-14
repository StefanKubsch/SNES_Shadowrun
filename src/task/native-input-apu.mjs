import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';

import {
  CAMERA_X,
  OBJECT_X,
  OBJECT_Y,
  PAD_HELD,
  PAD_PRESSED,
  PAD_PREVIOUS,
  APU_COMMAND_TOKEN,
} from './wram.mjs';
import {
  APUIO0,
  APUIO2,
  APUIO1,
  WRMPYA,
  WRMPYB,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
import {
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
import {
  BANK_WRAP,
  WORD_MASK,
  BANK_SIZE,
  HIGH_BYTE_MASK,
  BYTE_MASK,
  BYTE_BITS,
  BYTE_SIGN,
} from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

const APU_CODE_BANK = 0x81;
const SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;
// C416 maps the relative object/camera position into an unsigned pan byte.
const PAN_CENTRE = 128,
  PAN_MAX = 255,
  PAN_COORDINATE_BIAS = 0x600;
const PAN_MULTIPLIER_MASK = 0x7f;
function finish(a, long, outerReturn) {
  const { ctx } = a,
    rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'input-apu-return-WORD',
      outerReturn,
    );
  ctx.s = (ctx.s + 2) & WORD_MASK;
  let returnBank = ctx.programBank;
  if (long) {
    returnBank = a.read((ctx.s + 1) & WORD_MASK, 'input-apu-return-bank', outerReturn);
    ctx.s = (ctx.s + 1) & WORD_MASK;
  }
  ctx.programBank = returnBank;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnBank,
    returnTarget: returnBank * BANK_SIZE + ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: long ? 'observed-outer-RTL-target' : 'observed-outer-RTS-target',
  };
}

// Complete normal return paths. Exact3030 abandons the root frame through
// reset/startup; the outer plan withholds every preceding edge/copy write.
// 80:9E1A: take the joypad word of the NMI and derive the newly pressed buttons.
export function readInput(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  if (ctx.programBank !== CODE_BANK) taskStop('task_input_entry_required');
  h.load(h.read(h.abs(PAD_HELD)));
  const first = ctx.a,
    previous = h.read(h.abs(PAD_PREVIOUS));
  h.load(ctx.a ^ previous);
  h.load(ctx.a & h.read(h.abs(PAD_HELD)));
  const edge = ctx.a;
  h.write(h.abs(PAD_PRESSED), ctx.a);
  h.load(h.read(h.abs(PAD_HELD)));
  const current = ctx.a;
  h.write(h.abs(PAD_PREVIOUS), ctx.a);
  h.compare(ctx.a, SOFT_RESET_BUTTONS);
  if (ctx.status & FLAG_ZERO)
    taskStop('task_reset_source_required', {
      pc: 0x809e2f,
      target: 0x809e3d,
      startupTarget: 0x80e382,
    });
  h.load(ctx.a & INVALID_PAD_BITS);
  const filtered = ctx.a !== 0;
  if (filtered) {
    h.write(h.abs(PAD_HELD), 0);
    h.write(h.abs(PAD_PRESSED), 0);
  }
  return {
    ...finish(a, false, outerReturn),
    outcome: filtered ? 'input_filtered' : 'input_preserved',
    first,
    previous,
    edge,
    current,
  };
}

// Original fixed F007 equations, with physical PHP/PLP and fresh byte polls.
// Inner audio callers may enter M1; X must be WORD before the original STX.
// 81:F007: send a command to the APU through the port handshake.
export function sendApuCommand(a, outerReturn = true) {
  const { ctx } = a;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (ctx.e !== 0 || ctx.status & FLAG_INDEX_8BIT || ctx.programBank !== APU_CODE_BANK)
    taskStop('task_apu_entry_required');
  const nz = (value) => {
    ctx.status =
      (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (value & BYTE_SIGN ? FLAG_NEGATIVE : 0) |
      (value === 0 ? FLAG_ZERO : 0);
    return value;
  };
  const load = (value) => {
    ctx.a = (ctx.a & HIGH_BYTE_MASK) | nz(value & BYTE_MASK);
  };
  const xba = () => {
    ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
    nz(ctx.a & BYTE_MASK);
  };
  a.write(ctx.s, ctx.status, 'F007-PHP');
  ctx.s = (ctx.s - 1) & WORD_MASK;
  ctx.status |= FLAG_MEMORY_8BIT;
  xba();
  load(a.absoluteRead(APU_COMMAND_TOKEN, 1, 0x81f00b, 'F007-token'));
  const token = ctx.a & BYTE_MASK;
  let polls = 0;
  do {
    const sample = a.absoluteRead(APUIO0, 1, 0x81f00e, 'F007-fresh-ack');
    polls++;
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number((ctx.a & BYTE_MASK) >= sample);
    nz(((ctx.a & BYTE_MASK) - sample) & BYTE_MASK);
  } while (!(ctx.status & FLAG_ZERO));
  a.absoluteWrite(APUIO2, ctx.x, 2, 0x81f013, 'F007-WORD-parameter');
  load(((ctx.a & BYTE_MASK) + 1) & BYTE_MASK);
  const nextToken = ctx.a & BYTE_MASK;
  xba();
  const command = ctx.a & BYTE_MASK;
  a.absoluteWrite(APUIO1, command, 1, 0x81f018, 'F007-command');
  xba();
  a.absoluteWrite(APUIO0, ctx.a & BYTE_MASK, 1, 0x81f01c, 'F007-next-token');
  a.absoluteWrite(APU_COMMAND_TOKEN, ctx.a & BYTE_MASK, 1, 0x81f01f, 'F007-token-store');
  ctx.status = a.read((ctx.s + 1) & WORD_MASK, 'F007-PLP-fresh');
  ctx.s = (ctx.s + 1) & WORD_MASK;
  if (ctx.status & FLAG_INDEX_8BIT) {
    ctx.x &= BYTE_MASK;
    ctx.y &= BYTE_MASK;
  }
  return {
    ...finish(a, true, outerReturn),
    outcome: 'apu_requests_prepared',
    token,
    nextToken,
    command,
    polls,
  };
}

// 80:C416: pan byte of a sound from the object position relative to the camera.
export function computeSoundPan(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  if (ctx.programBank !== CODE_BANK) taskStop('task_pan_entry_required');
  const operand = ctx.a;
  a.absoluteWrite(WRMPYA, ctx.a, 2, 0x80c416, 'C416-WORD-factor');
  h.load(PAN_CENTRE);
  ctx.x = h.nz(h.dp(0), 2);
  const positionUsed = !(ctx.status & FLAG_NEGATIVE);
  let signedClamp = false,
    borrowClamp = false,
    upperClamp = false;
  if (positionUsed) {
    h.load(h.read(h.abs(OBJECT_Y) + ctx.x));
    ctx.status |= FLAG_CARRY;
    h.arithmetic(h.read(h.abs(OBJECT_X) + ctx.x), true);
    ctx.status &= ~FLAG_CARRY;
    h.arithmetic(PAN_COORDINATE_BIAS);
    if (ctx.status & FLAG_NEGATIVE) {
      signedClamp = true;
      h.load(0);
    }
    ctx.status |= FLAG_CARRY;
    h.arithmetic(h.read(h.abs(CAMERA_X)), true);
    if (!(ctx.status & FLAG_CARRY)) {
      borrowClamp = true;
      h.load(0);
    } else {
      h.lsr();
      h.lsr();
      h.compare(ctx.a, PAN_MAX);
      if (ctx.status & FLAG_CARRY) {
        upperClamp = true;
        h.load(PAN_MAX);
      }
    }
  }
  const pan = ctx.a;
  ctx.status |= FLAG_MEMORY_8BIT;
  h.lsr();
  const multiplier = ctx.a & BYTE_MASK;
  a.absoluteWrite(WRMPYB, multiplier, 1, 0x80c448, 'C416-first-multiplier');
  h.load((ctx.a & BYTE_MASK) ^ PAN_MULTIPLIER_MASK);
  const complement = ctx.a & BYTE_MASK;
  h.pushByte(complement, 'C416-BYTE-PHA');
  const first = a.absoluteRead(RDMPYH, 1, 0x80c44f, 'C416-first-product');
  h.load(first);
  h.xba();
  h.load(h.pullByte('C416-BYTE-PLA-fresh'));
  a.absoluteWrite(WRMPYB, ctx.a & BYTE_MASK, 1, 0x80c454, 'C416-second-multiplier');
  const second = a.absoluteRead(RDMPYH, 1, 0x80c45a, 'C416-second-product');
  h.load(second);
  ctx.status &= ~FLAG_MEMORY_8BIT;
  ctx.x = h.nz(ctx.a, 2);
  return {
    ...finish(a, false, outerReturn),
    outcome: 'pan_parameters_prepared',
    operand,
    positionUsed,
    signedClamp,
    borrowClamp,
    upperClamp,
    pan,
    multiplier,
    complement,
    first,
    second,
  };
}
