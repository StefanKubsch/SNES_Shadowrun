// Register-level APU command 81:F007 and sound pan natives that only references and
// comparisons call; the game sends its APU commands through src/apu/ and keeps the
// pad read in src/system/native-input-apu.mjs.
import { finish } from '../../src/system/native-input-apu.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';
import { taskTextAccess } from '../../src/system/native-text-prerequisites.mjs';
import {
  APUIO0,
  APUIO2,
  APUIO1,
  WRMPYA,
  WRMPYB,
  RDMPYH,
} from '../../src/constants/hardware-registers.mjs';
import { APU_COMMAND_TOKEN, OBJECT_Y, OBJECT_X, CAMERA_X } from '../../src/data/wram.mjs';
import {
  BYTE_SIGN,
  HIGH_BYTE_MASK,
  BYTE_MASK,
  BYTE_BITS,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
} from '../../src/constants/cpu-flags.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';

// C416 maps the relative object/camera position into an unsigned pan byte.
const PAN_CENTRE = 128,
  PAN_MAX = 255,
  PAN_COORDINATE_BIAS = 0x600;
const PAN_MULTIPLIER_MASK = 0x7f;

// Code bank of the APU command routine.
const APU_CODE_BANK = 0x81;

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
