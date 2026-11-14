// Fixed equations for the pinned F612 body; all scratch aliases are fresh.
export function divideBody(a) {
  const signCount = a.ctx.x,
    absolute = (o) => a.ctx.bank * 65536 + o;
  const readScratch = (o) => a.readWord(absolute(o), 24, 'fresh-division-scratch');
  const writeScratch = (o, v) => a.writeWord(absolute(o), v, 24, 'division-scratch');
  writeScratch(0x1ec, 0);
  writeScratch(0x1f0, 0);
  let shifts = 0;
  while (a.ctx.a >= 256) {
    const dividend = readScratch(0x1ea);
    writeScratch(0x1ea, dividend >>> 1);
    const remainder = readScratch(0x1ec);
    writeScratch(0x1ec, (remainder >>> 1) | ((dividend & 1) << 15));
    const divisorLow = a.ctx.a & 1;
    a.ctx.a >>>= 1;
    const divisorRemainder = readScratch(0x1f0);
    writeScratch(0x1f0, (divisorRemainder >>> 1) | (divisorLow << 15));
    shifts++;
  }
  const scaledDivisor = a.ctx.a;
  writeScratch(0x1ee, scaledDivisor);
  a.ctx.a = readScratch(0x1ea);
  a.absoluteWrite(0x4204, a.ctx.a, 2, 0x80f632, 'division-request');
  a.ctx.a = (a.ctx.a & 0xff00) | a.read(absolute(0x1ee), 'fresh-divisor-low');
  a.absoluteWrite(0x4206, a.ctx.a & 255, 1, 0x80f63a, 'division-request');
  // Three XBA before the first observation preserve the former low byte as B.
  a.ctx.a = ((a.ctx.a & 255) << 8) | (a.ctx.a >>> 8);
  const loadByte = (v) => {
    a.ctx.a = (a.ctx.a & 0xff00) | v;
    return v;
  };
  loadByte(a.absoluteRead(0x4214, 1, 0x80f642, 'division-observation'));
  a.write((a.ctx.s + 1) & 65535, a.ctx.a & 255, 'quotient-low');
  loadByte(a.absoluteRead(0x4215, 1, 0x80f647, 'division-observation'));
  a.write((a.ctx.s + 2) & 65535, a.ctx.a & 255, 'quotient-high');
  loadByte(a.read(absolute(0x1ec), 'fresh-remainder-low'));
  a.absoluteWrite(0x4204, a.ctx.a & 255, 1, 0x80f64f, 'division-request');
  loadByte(a.absoluteRead(0x4216, 1, 0x80f652, 'division-observation'));
  a.absoluteWrite(0x4205, a.ctx.a & 255, 1, 0x80f655, 'division-request');
  loadByte(a.read(absolute(0x1f0), 'fresh-divisor-remainder-low'));
  a.absoluteWrite(0x4206, a.ctx.a & 255, 1, 0x80f65b, 'division-request');
  // Two XBA restore both accumulator bytes before REP20/WORD observation.
  a.ctx.a = a.absoluteRead(0x4214, 2, 0x80f664, 'division-observation');
  const remainingWord = a.stackWord(1, 'fresh-remaining-CMP'),
    carry = Number(a.ctx.a >= remainingWord);
  a.ctx.status = (a.ctx.status & ~1) | carry;
  if (!carry) {
    a.ctx.a = (a.pullWord('fresh-correction-PLA') - 1) & 65535;
    a.pushWord(a.ctx.a, 'correction-PHA');
  }
  a.ctx.x = (a.ctx.x - 1) & 65535;
  if (a.ctx.x === 0) {
    a.ctx.a = -a.pullWord('fresh-negation-PLA') & 65535;
    a.pushWord(a.ctx.a, 'negation-PHA');
  }
  return {
    ...a.fetch(),
    signCount,
    shifts,
    scaledDivisor,
    remainingWord,
    corrected: !carry,
    negated: signCount === 1,
  };
}
export function divideLeft(a, signed = false) {
  a.ctx.a = a.stackWord(3, 'fresh-left-WORD');
  if (signed && a.ctx.a & 0x8000) {
    a.ctx.a = -a.ctx.a & 65535;
    a.ctx.x++;
  }
  a.writeWord(a.ctx.bank * 65536 + 0x1ea, a.ctx.a, 24, 'initial-dividend');
  a.ctx.a = a.pullWord('fresh-right-PLA');
}
