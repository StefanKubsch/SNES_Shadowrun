// Bits of the 65816 processor status register P (ctx.status, vm.p).
// SEP/REP take the same bit masks. Source: the WDC W65C816 programming model.
// The local manuals (Book I, Book II, SnesDevManualCPU.pdf) name the M and X
// flags but print no bit table in their text layer; the layout below matches
// the established use in this code base (SEP #$20 selects 8-bit memory).

/** C: carry or borrow out of the last addition, subtraction, shift or compare. */
export const FLAG_CARRY = 0x01;
/** Z: the last result was zero (also "equal" after a compare). */
export const FLAG_ZERO = 0x02;
/** I: IRQ interrupts are disabled. */
export const FLAG_IRQ_DISABLE = 0x04;
/** D: decimal mode for ADC and SBC. */
export const FLAG_DECIMAL = 0x08;
/** X: index registers X and Y are 8 bits wide (native mode). */
export const FLAG_INDEX_8BIT = 0x10;
/** M: accumulator and memory accesses are 8 bits wide (native mode). */
export const FLAG_MEMORY_8BIT = 0x20;
/** V: signed overflow of the last addition or subtraction, or bit 6 after BIT. */
export const FLAG_OVERFLOW = 0x40;
/** N: the last result was negative (its top bit is set). */
export const FLAG_NEGATIVE = 0x80;
