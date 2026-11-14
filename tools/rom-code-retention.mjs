// Shared code/data boundary for the ROM map, package builder and audit.
// A change between two code classes does not create a data read margin.
export const ROM_CODE_CLASSES = new Set([
  'code',
  'code_kept',
  'code_static',
  'code_dead',
  'code_unused_native',
  'code_unused_opcode',
]);

export const isDataToCodeBoundary = (classes, offset, codeClasses = ROM_CODE_CLASSES) =>
  offset > 0 && codeClasses.has(classes[offset]) && !codeClasses.has(classes[offset - 1]);

// Original HDMA reads beyond the D478 terminator when enabled during a field.
// The product starts tables at A1 each frame and stops at the terminator.
// Source/limit: docs/ROM-FREE.md, original code-bank read recording section;
// Book I PDF 144 and 152 establish the registers, not the within-field event.
const HARDWARE_ONLY_CODE_READS = [[0xd479, 0xd577]];
export const isHardwareOnlyCodeRead = (offset) =>
  HARDWARE_ONLY_CODE_READS.some(([first, last]) => offset >= first && offset <= last);
