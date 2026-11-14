import { prepareTaskPlan } from './plan.mjs';

// Original F390: full WORD X, PBR80 pointer bytes, bank wrap. JMP changes
// only PC. Reading a target alone never grants permission to execute it.
export function runTaskOpcodeTarget(a) {
  const tableAddress = 0x800000 | ((0xf2b4 + a.ctx.x) & 65535);
  const low = a.read(tableAddress, 'opcode-target-low');
  const high = a.read(0x800000 | ((tableAddress + 1) & 65535), 'opcode-target-high');
  const targetWord = low | (high << 8),
    target = 0x800000 | targetWord;
  a.ctx.pc = targetWord;
  return {
    tableAddress,
    targetWord,
    target,
    frontier: 'observed-opcode-target',
    targetExecuted: false,
    dynamicDispatchExecuted: false,
  };
}
export const prepareTaskOpcodeTarget = (options) =>
  prepareTaskPlan(options, [0x80f390], runTaskOpcodeTarget);
