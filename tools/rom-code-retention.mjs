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
