import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

// SEC/CLC on the processor status of a routine helper h.
export const sec = (h) => {
    h.ctx.status |= FLAG_CARRY;
  },
  clc = (h) => {
    h.ctx.status &= ~FLAG_CARRY;
  };
export const setCarry = (h, set) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(set);
};
