// 65816 building blocks shared by the scheduler and the native bridge. They
// change registers and flags exactly as the original instructions do.

import { BYTE_SIGN, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK_PAIR } from '../constants/memory-map.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';

// N/Z as after LDA, TAX or PLB with an 8-bit (width 1) or 16-bit result.
export function nz(vm, value, width = 2) {
  vm.p =
    (vm.p & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
    (value & (width === 1 ? BYTE_SIGN : WORD_SIGN) ? FLAG_NEGATIVE : 0) |
    (value === 0 ? FLAG_ZERO : 0);
  return value;
}

// PLB: pull the data bank from the stack (8 bits, sets N/Z).
export function plb(vm) {
  vm.s = (vm.s + 1) & WORD_MASK;
  vm.dbr = nz(vm, vm.mem.read8(vm.s), 1);
}

// PEA $8080 / PLB / PLB: DBR = $80.
export function bank80(vm) {
  vm.push16(CODE_BANK_PAIR);
  plb(vm);
  plb(vm);
}
