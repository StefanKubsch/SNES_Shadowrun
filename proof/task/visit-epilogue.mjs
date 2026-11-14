import { taskStop } from '../../src/task/plan.mjs';
// Original C1D9: PEA8080/PLB/PLB/PLA/STA0250/RTS, after real C20B->C1D9.
export function runTaskVisitEpilogue(a) {
  const c = a.ctx,
    nz = (v, w = 2) => {
      v &= w === 1 ? 255 : 65535;
      c.status = (c.status & ~0x82) | (v & (w === 1 ? 128 : 32768) ? 128 : 0) | (v === 0 ? 2 : 0);
      return v;
    };
  if (c.pc !== 0xc1d9 || c.d !== 0) taskStop('task_child_visit_epilogue_required');
  a.pushWord(0x8080, 'child-epilogue-PEA');
  for (let n = 0; n < 2; n++) {
    c.bank = nz(a.read((c.s + 1) & 65535, 'child-epilogue-PLB'), 1);
    c.s = (c.s + 1) & 65535;
  }
  c.a = nz(a.pullWord('child-epilogue-cursor-PLA'));
  a.writeWord(c.bank * 65536 + 0x250, c.a, 24, 'child-epilogue-restored-cursor');
  const raw = a.readWord((c.s + 1) & 65535, 16, 'child-epilogue-outer-RTS', true);
  c.s = (c.s + 2) & 65535;
  c.pc = (raw + 1) & 65535;
  return {
    outerReturnWord: raw,
    returnTarget: 0x800000 | c.pc,
    frontier: 'actual-child-visit-outer-return-target',
    returnTargetExecuted: false,
  };
}
