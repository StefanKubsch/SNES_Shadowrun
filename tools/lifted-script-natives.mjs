// The script natives that run lifted code (src/task/native-script-leaves.mjs) and what
// the oracle comparisons may expect of them (docs/MAIN-LOOP-LIFT.md). After the
// native's RTS the script interpreter's $F509 replaces A, X, Y, the direct page and N/Z
// and reads the result from the direct page word 00; no opcode reads the carry or
// overflow before it sets them. So a lifted native leaves only the return state: the
// program counter, the stack pointer, the banks, the emulation bit and the register
// widths.
export const LIFTED_SCRIPT_NATIVES = new Set([
  0x808521, 0x80c461, 0x80c46e, 0x80c51f, 0x80c560, 0x808d7f, 0x808d3f, 0x808d4e, 0x808bc5,
  0x808c08, 0x808c8d, 0x808ccf, 0x80cd20, 0x80cbf7, 0x80bba0,
]);
// Direct page bytes a lifted native does not produce: the sample loader's scratch
// (7E:0089-008B, 008F-0099) after any, and after the sight natives the line of sight's
// working bytes 7E:000E-006C (user decision 2026-11-13; no caller reads them).
const LOADER_SCRATCH = [
    [0x89, 0x8c],
    [0x8f, 0x9a],
  ],
  SIGHT_SCRATCH = [0x0e, 0x6d],
  SIGHT_NATIVES = new Set([0x808bc5, 0x808c08, 0x808c8d, 0x808ccf]);
// Whether the WRAM byte at address is scratch the lifted native target leaves unwritten.
export function inLiftedScratch(target, address) {
  const ranges = SIGHT_NATIVES.has(target) ? [...LOADER_SCRATCH, SIGHT_SCRATCH] : LOADER_SCRATCH;
  return ranges.some(([from, end]) => address >= from && address < end);
}

const WIDTH_FLAGS = 0x30;

// The registers of a native's return that the comparison checks for target.
export function nativeReturnContext(target, ctx) {
  if (!LIFTED_SCRIPT_NATIVES.has(target)) return ctx;
  const { a: _a, x: _x, y: _y, status, ...kept } = ctx;
  return { ...kept, widths: status & WIDTH_FLAGS };
}
