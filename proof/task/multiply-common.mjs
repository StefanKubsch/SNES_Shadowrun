import { taskStop } from '../../src/task/plan.mjs';

// Fixed native equations for the source-verified F584 body. No instruction
// decoder, opcode dispatcher or calculated hardware product is involved.
export function multiplyPrefix(a, offset) {
  const word = a.stackWord(offset, 'sign-WORD');
  a.ctx.a = word;
  if (word & 0x8000) {
    a.ctx.a = -word & 65535;
    a.writeWord((a.ctx.s + offset) & 65535, a.ctx.a, 16, 'sign-magnitude');
    a.ctx.x++;
  }
}
export function multiplyBody(a) {
  if (a.ctx.status & 8) taskStop('task_binary_arithmetic_required');
  const signCount = a.ctx.x,
    absolute = (o) => a.ctx.bank * 65536 + o;
  const load = (v) => {
    a.ctx.a = (a.ctx.a & 0xff00) | v;
    return v;
  };
  const xba = () => {
    a.ctx.a = ((a.ctx.a & 255) << 8) | (a.ctx.a >>> 8);
  };
  const stackByte = (offset, label) => a.read((a.ctx.s + offset) & 65535, label);
  const pullByte = (label) => {
    const v = stackByte(1, label);
    a.ctx.s = (a.ctx.s + 1) & 65535;
    load(v);
    return v;
  };
  const request = (offset, pc) => a.absoluteWrite(offset, a.ctx.a & 255, 1, pc, 'multiply-request');
  const observation = (offset, pc) => load(a.absoluteRead(offset, 1, pc, 'multiply-observation'));
  const adc = (right) => {
    const left = a.ctx.a & 255,
      sum = left + right,
      result = sum & 255;
    a.ctx.status =
      (a.ctx.status & ~0x41) |
      Number(sum > 255) |
      (~(left ^ right) & (left ^ result) & 128 ? 0x40 : 0);
    load(result);
  };
  load(stackByte(3, 'left-low'));
  request(0x4202, 0x80f588);
  load(stackByte(2, 'right-high'));
  request(0x4203, 0x80f58d);
  xba();
  observation(0x4216, 0x80f592);
  a.write(absolute(0x1ea), a.ctx.a & 255, 'scratch-first');
  pullByte('right-low-PLA');
  request(0x4203, 0x80f599);
  xba();
  a.ctx.status &= ~1;
  request(0x4202, 0x80f59e);
  observation(0x4216, 0x80f5a1);
  a.write((a.ctx.s + 2) & 65535, a.ctx.a & 255, 'result-low');
  observation(0x4217, 0x80f5a6);
  adc(a.read(absolute(0x1ea), 'fresh-scratch-first-ADC'));
  a.write(absolute(0x1ea), a.ctx.a & 255, 'scratch-second');
  pullByte('discarded-right-high-PLA');
  load(stackByte(2, 'fresh-left-high'));
  request(0x4203, 0x80f5b2);
  a.ctx.status &= ~1;
  observation(0x4216, 0x80f5b6);
  adc(a.read(absolute(0x1ea), 'fresh-scratch-second-ADC'));
  a.write((a.ctx.s + 2) & 65535, a.ctx.a & 255, 'result-high');
  a.ctx.x = (a.ctx.x - 1) & 65535;
  if (a.ctx.x === 0) {
    a.ctx.a = -a.pullWord('fresh-negation-PLA') & 65535;
    a.pushWord(a.ctx.a, 'negation-PHA');
  }
  return { ...a.fetch(), signCount, negated: signCount === 1 };
}
