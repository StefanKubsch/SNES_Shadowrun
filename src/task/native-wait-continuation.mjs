import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';

import {
  PAD_HELD,
  PAD_PRESSED,
  RANDOM_STATE,
  WRAM,
  NMITIMEN_SHADOW,
  PAD_PREVIOUS,
} from './wram.mjs';
import { HVBJOY, STDCNTRL1L, HVBJOY_JOYPAD_BUSY } from '../constants/hardware-registers.mjs';
import {
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import { BANK_SIZE, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// 9E1A compares the entire word; the low four non-button bits invalidate input.
const SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;
export const WAIT_PAUSED = 0,
  WAIT_RETURNED = 1;
const roots = new Set([0x81b0a1, 0x81eebb, 0x809e0b, 0x809e1a]);
const registers = ['e', 'programBank', 'pc', 'a', 'x', 'y', 's', 'd', 'bank', 'status'];

// Fixed native equations, not an instruction decoder. One step is one original
// instruction. A finite host budget only suspends execution: it never supplies
// elapsed time, an NMI, a counter write, a pad word or a ready flag.
export class NativeWaitContinuation {
  constructor(a, root) {
    const c = a.ctx;
    if (
      !roots.has(root) ||
      c.programBank * BANK_SIZE + c.pc !== root ||
      c.e !== 0 ||
      c.d !== 0 ||
      (root !== 0x81eebb &&
        c.status & (root === 0x809e0b ? FLAG_MEMORY_8BIT : FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
    )
      taskStop('native_wait_entry_required', { root });
    this.a = a;
    this.context = c;
    this.h = dialogAccess(a);
    this.root = root;
    this.done = false;
    this.failed = false;
    this.instructions = 0;
    this.polls = 0;
    this.saved = registers.map((key) => c[key]);
  }
  get pc() {
    return this.context.programBank * BANK_SIZE + this.context.pc;
  }
  get work() {
    return this.instructions;
  }
  run(budget, { beforeInstruction = null } = {}) {
    // Infinite draining is reserved for the synchronous observation adapter.
    if (
      (!Number.isSafeInteger(budget) || budget < 0) &&
      !(budget === Infinity && typeof beforeInstruction === 'function')
    )
      taskStop('native_wait_budget_required');
    if (beforeInstruction !== null && typeof beforeInstruction !== 'function')
      taskStop('native_wait_hook_required');
    if (this.failed) taskStop('native_wait_failed');
    if (
      this.a.ctx !== this.context ||
      registers.some((key, n) => this.context[key] !== this.saved[n])
    )
      taskStop('native_wait_owner_required', { pc: this.pc });
    try {
      for (let n = 0; n < budget && !this.done; n++) {
        const pc = this.pc;
        beforeInstruction?.(pc);
        // An interrupt may change memory, but RTI must restore every register.
        // Hooks are owned by the interrupt adapter, which checks that contract.
        if (this.pc !== pc) taskStop('native_wait_return_required', { pc });
        this.#advance(pc);
        this.instructions++;
      }
    } catch (error) {
      this.failed = true;
      throw error;
    } finally {
      for (let n = 0; n < registers.length; n++) this.saved[n] = this.context[registers[n]];
    }
    return this.done ? WAIT_RETURNED : WAIT_PAUSED;
  }
  #advance(pc) {
    const h = this.h,
      c = this.context;
    let next;
    switch (pc) {
      // AF761C7E / CF761C7E / F0FA / 6B. Saved A is the baseline;
      // CMP refetches both long-addressed bytes regardless of DBR.
      case 0x81b0a1:
        h.load(h.read(WRAM + RANDOM_STATE, 2));
        this.baseline = c.a;
        next = 0x81b0a5;
        break;
      case 0x81b0a5:
        this.observed = h.read(WRAM + RANDOM_STATE, 2);
        h.cmp(this.observed);
        this.polls++;
        next = 0x81b0a9;
        break;
      case 0x81b0a9:
        next = c.status & FLAG_ZERO ? 0x81b0a5 : 0x81b0ab;
        break;
      case 0x81b0ab:
        return this.#finish(true);

      // PHP/SEP20 and either HVBJOY bit 7 or the saved BYTE counter.
      case 0x81eebb:
        h.php();
        next = 0x81eebc;
        break;
      case 0x81eebc:
        h.sep(FLAG_MEMORY_8BIT);
        next = 0x81eebe;
        break;
      case 0x81eebe:
        h.load(h.dp(NMITIMEN_SHADOW));
        next = 0x81eec0;
        break;
      case 0x81eec0:
        next = c.status & FLAG_NEGATIVE ? 0x81eec9 : 0x81eec2;
        break;
      case 0x81eec2:
        h.load(h.port(HVBJOY, 1, pc));
        this.polls++;
        next = 0x81eec5;
        break;
      case 0x81eec5:
        next = c.status & FLAG_NEGATIVE ? 0x81eec2 : 0x81eec7;
        break;
      case 0x81eec7:
        h.plp();
        next = 0x81eec8;
        break;
      case 0x81eec8:
        return this.#finish(true);
      case 0x81eec9:
        h.load(h.read(WRAM + RANDOM_STATE));
        this.baseline = c.a & BYTE_MASK;
        next = 0x81eecd;
        break;
      case 0x81eecd:
        this.observed = h.read(WRAM + RANDOM_STATE);
        h.cmp(this.observed);
        this.polls++;
        next = 0x81eed1;
        break;
      case 0x81eed1:
        next = c.status & FLAG_ZERO ? 0x81eecd : 0x81eed3;
        break;
      case 0x81eed3:
        h.plp();
        next = 0x81eed4;
        break;
      case 0x81eed4:
        return this.#finish(true);

      // The original WORD reads retain all supplied device bits. Busy is
      // tested before 4218; no assumption that NMI entry means pad-ready.
      case 0x809e0b:
        h.load(h.port(HVBJOY, 2, pc));
        this.polls++;
        next = 0x809e0e;
        break;
      case 0x809e0e:
        h.load(c.a & HVBJOY_JOYPAD_BUSY);
        next = 0x809e11;
        break;
      case 0x809e11:
        next = c.status & FLAG_ZERO ? 0x809e13 : 0x809e0b;
        break;
      case 0x809e13:
        h.load(h.port(STDCNTRL1L, 2, pc));
        next = 0x809e16;
        break;
      case 0x809e16:
        h.write(h.abs(PAD_HELD), c.a);
        next = 0x809e19;
        break;
      case 0x809e19:
        return this.#finish(false);

      // All three held-word reads are fresh, even across a host pause/NMI.
      case 0x809e1a:
        h.load(h.read(h.abs(PAD_HELD)));
        next = 0x809e1d;
        break;
      case 0x809e1d:
        h.load(c.a ^ h.read(h.abs(PAD_PREVIOUS)));
        next = 0x809e20;
        break;
      case 0x809e20:
        h.load(c.a & h.read(h.abs(PAD_HELD)));
        next = 0x809e23;
        break;
      case 0x809e23:
        h.write(h.abs(PAD_PRESSED), c.a);
        next = 0x809e26;
        break;
      case 0x809e26:
        h.load(h.read(h.abs(PAD_HELD)));
        next = 0x809e29;
        break;
      case 0x809e29:
        h.write(h.abs(PAD_PREVIOUS), c.a);
        next = 0x809e2c;
        break;
      case 0x809e2c:
        h.cmp(SOFT_RESET_BUTTONS);
        next = 0x809e2f;
        break;
      case 0x809e2f:
        if (c.status & FLAG_ZERO)
          taskStop('task_reset_source_required', { pc, target: 0x809e3d, startupTarget: 0x80e382 });
        next = 0x809e31;
        break;
      case 0x809e31:
        h.load(c.a & INVALID_PAD_BITS);
        next = 0x809e34;
        break;
      case 0x809e34:
        next = c.status & FLAG_ZERO ? 0x809e3c : 0x809e36;
        break;
      case 0x809e36:
        h.write(h.abs(PAD_HELD), 0);
        next = 0x809e39;
        break;
      case 0x809e39:
        h.write(h.abs(PAD_PRESSED), 0);
        next = 0x809e3c;
        break;
      case 0x809e3c:
        return this.#finish(false);
      default:
        taskStop('native_wait_pc_required', { pc });
    }
    c.programBank = next >>> WORD_BITS;
    c.pc = next & WORD_MASK;
  }
  #finish(long) {
    const rawReturnWord = long ? this.h.rtl() : this.h.rts(),
      c = this.context;
    this.done = true;
    this.result = {
      rawReturnWord,
      returnBank: c.programBank,
      returnTarget: c.programBank * BANK_SIZE + c.pc,
      ...(this.root === 0x81b0a1
        ? { baseline: this.baseline, observed: this.observed, polls: this.polls }
        : {}),
    };
  }
}
