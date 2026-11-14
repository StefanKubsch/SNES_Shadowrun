// Opcode handlers of the event interpreter ($80:F389, jump table $80:F2B4).
// Each handler reproduces the effect of the original handler on registers, WRAM and
// flags (semantics from the proven modules in src/task/*). It receives the
// VM, returns CONTINUE or an exit code and allocates nothing.
// The interpreter loop takes care of the next opcode fetch.
import { VmFault } from './memory.mjs';
import {
  ARITHMETIC_SCRATCH,
  NATIVE_ARGUMENT_COUNTS,
  NATIVE_BRIDGE,
  OUTER_STACK,
  SCRIPT_ARGUMENT_BYTES,
  SCRIPT_CALL,
  STATUS_FLAGS_FIRST,
  STATUS_FLAGS_SECOND,
  FRAME_CALL_ID,
  FRAME_OPERAND_STACK,
  FRAME_PC,
  FRAME_LOCALS,
  FRAME_RETURN,
} from './layout.mjs';
import {
  FLAG_DECIMAL,
  FLAG_CARRY,
  FLAG_OVERFLOW,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  WORD_MASK,
  WORD_BITS,
  WORD_SIGN,
  BYTE_MASK,
  BYTE_SIGN,
  BYTE_VALUES,
  HIGH_BYTE_MASK,
  BYTE_BITS,
} from '../constants/bits.mjs';
import {
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVH,
  WRDIVB,
  RDDIVL,
  RDDIVH,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
import { OPCODE } from '../script/opcodes.mjs';
import { WRAM } from '../task/wram.mjs';

// Stack-relative byte offsets: top word at S+1, the next word at S+3.
const STACK_SECOND_WORD = 3;
// $F927 publishes bit 2 in each status byte; true script values use all bits.
const STATUS_INDEX_BIT = 0x04,
  STATUS_INDEX_CLEAR = BYTE_MASK ^ STATUS_INDEX_BIT,
  SCRIPT_TRUE = WORD_MASK;
// $F612 scaling workspace relative to ARITHMETIC_SCRATCH ($01EA).
const DIVIDEND_FRACTION_OFFSET = 2,
  SCALED_DIVISOR_OFFSET = 4,
  DIVISOR_FRACTION_OFFSET = 6;

export const CONTINUE = 0;
export const EXIT_END = 1; // $56 END: return to the outer caller
export const EXIT_STATUS_RETURN = 2; // $F927: publish the status, RTS from the current stack
export const EXIT_NATIVE_CALL = 3; // $58: arguments taken over, continue at $F4F6
export const EXIT_SCRIPT_CALL = 4; // $52: arguments taken over, continue at $F488

const signed = (word) => (word & WORD_SIGN) !== 0;
const local = (vm, index) => (vm.d + FRAME_LOCALS + index) & WORD_MASK;
const absolute = (vm, offset) => (vm.dbr << WORD_BITS) + offset;
const requireBinary = (vm) => {
  if (vm.p & FLAG_DECIMAL) throw new VmFault('decimal_mode');
};
const setCarry = (vm, carry) => {
  vm.p = (vm.p & ~FLAG_CARRY) | (carry ? FLAG_CARRY : 0);
};

// --- Stack and locals ----------------------------------------------------

// $F398 push_u8, $F3B1 push_u16, $F393 push_zero
function pushU8(vm) {
  const v = vm.stream16() & BYTE_MASK;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.push16(v);
  return CONTINUE;
}
function pushU16(vm) {
  const v = vm.stream16();
  vm.y = (vm.y + 2) & WORD_MASK;
  vm.push16(v);
  return CONTINUE;
}
function pushZero(vm) {
  vm.push16(0);
  return CONTINUE;
}

// $F3A1 load_local_u8, $F3B9 load_local_u16
function loadLocalU8(vm) {
  const index = vm.stream16() & BYTE_MASK;
  vm.x = index;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.push16(vm.mem.read16Bank0(local(vm, index)) & BYTE_MASK);
  return CONTINUE;
}
function loadLocalU16(vm) {
  const index = vm.stream16() & BYTE_MASK;
  vm.x = index;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.push16(vm.mem.read16Bank0(local(vm, index)));
  return CONTINUE;
}
// $F8CB: first local byte without an operand
function loadLocal0(vm) {
  vm.push16(vm.mem.read16Bank0(local(vm, 0)) & BYTE_MASK);
  return CONTINUE;
}

// $F3C6 store_local_u8, $F3D7 store_local_u16
function storeLocalU8(vm) {
  const index = vm.stream16() & BYTE_MASK;
  vm.x = index;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.mem.write8(local(vm, index), vm.pull16() & BYTE_MASK);
  return CONTINUE;
}
function storeLocalU16(vm) {
  const index = vm.stream16() & BYTE_MASK;
  vm.x = index;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.mem.write16Bank0(local(vm, index), vm.pull16());
  return CONTINUE;
}

// $F3F6 push_i8, $F408 load_local_i8: sign extension sets carry
function pushSignExtended(vm, source) {
  const low = source & BYTE_MASK,
    negative = low >= BYTE_SIGN;
  setCarry(vm, negative);
  vm.push16(negative ? HIGH_BYTE_MASK | low : low);
}
function pushI8(vm) {
  const operand = vm.stream16();
  vm.y = (vm.y + 1) & WORD_MASK;
  pushSignExtended(vm, operand);
  return CONTINUE;
}
function loadLocalI8(vm) {
  const operand = vm.stream16();
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.x = operand & BYTE_MASK;
  pushSignExtended(vm, vm.mem.read16Bank0(local(vm, vm.x)));
  return CONTINUE;
}

// --- State words in bank $7E -------------------------------------------------

function stateOffset(vm) {
  const offset = vm.stream16();
  vm.x = offset;
  vm.y = (vm.y + 2) & WORD_MASK;
  return WRAM + offset;
}
// $F8D4 load_state_u8, $F8E4 load_state_u16, $F90F load_state_i8
function loadStateU8(vm) {
  vm.push16(vm.mem.read16(stateOffset(vm)) & BYTE_MASK);
  return CONTINUE;
}
function loadStateU16(vm) {
  vm.push16(vm.mem.read16(stateOffset(vm)));
  return CONTINUE;
}
function loadStateI8(vm) {
  pushSignExtended(vm, vm.mem.read16(stateOffset(vm)));
  return CONTINUE;
}
// $F8F1 store_state_u8, $F902 store_state_u16
function storeStateU8(vm) {
  const address = stateOffset(vm);
  vm.mem.write8(address, vm.pull16() & BYTE_MASK);
  return CONTINUE;
}
function storeStateU16(vm) {
  const address = stateOffset(vm);
  vm.mem.write16(address, vm.pull16());
  return CONTINUE;
}

// --- Simple operations on the stack -------------------------------------------

// $F3E4 increment, $F3EA decrement, $F3F0 duplicate, $F8BB drop
function increment(vm) {
  vm.push16((vm.pull16() + 1) & WORD_MASK);
  return CONTINUE;
}
function decrement(vm) {
  vm.push16((vm.pull16() - 1) & WORD_MASK);
  return CONTINUE;
}
function duplicate(vm) {
  vm.push16(vm.peek16(1));
  return CONTINUE;
}
function drop(vm) {
  vm.pull16();
  return CONTINUE;
}

// $F532 add: carry and overflow from a 16-bit ADC
function add(vm) {
  requireBinary(vm);
  const right = vm.pull16(),
    left = vm.peek16(1),
    sum = right + left,
    value = sum & WORD_MASK;
  vm.poke16(1, value);
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
    (sum > WORD_MASK ? FLAG_CARRY : 0) |
    (~(right ^ left) & (right ^ value) & WORD_SIGN ? FLAG_OVERFLOW : 0);
  return CONTINUE;
}
// $F53B subtract: left - right, the result replaces left
function subtract(vm) {
  requireBinary(vm);
  const left = vm.peek16(STACK_SECOND_WORD),
    right = vm.peek16(1),
    value = (left - right) & WORD_MASK;
  vm.poke16(STACK_SECOND_WORD, value);
  vm.pull16();
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
    (left >= right ? FLAG_CARRY : 0) |
    ((left ^ right) & (left ^ value) & WORD_SIGN ? FLAG_OVERFLOW : 0);
  return CONTINUE;
}

// $F715 and, $F71D or, $F725 xor, $F72D not
function bitAnd(vm) {
  const r = vm.pull16();
  vm.poke16(1, r & vm.peek16(1));
  return CONTINUE;
}
function bitOr(vm) {
  const r = vm.pull16();
  vm.poke16(1, r | vm.peek16(1));
  return CONTINUE;
}
function bitXor(vm) {
  const r = vm.pull16();
  vm.poke16(1, r ^ vm.peek16(1));
  return CONTINUE;
}
function bitNot(vm) {
  vm.push16(vm.pull16() ^ WORD_MASK);
  return CONTINUE;
}

// $F6F4 negate, $F6FD shift_left, $F709 shift_right (count on top, value below)
function negate(vm) {
  vm.push16(-vm.pull16() & WORD_MASK);
  return CONTINUE;
}
function shift(vm, left) {
  const count = vm.pull16();
  vm.x = count;
  if (count === 0) return CONTINUE;
  let value = vm.pull16(),
    carry = vm.p & FLAG_CARRY;
  for (let n = 0; n < count; n++) {
    if (left) {
      carry = value >>> (WORD_BITS - 1);
      value = (value << 1) & WORD_MASK;
    } else {
      carry = value & 1;
      value >>>= 1;
    }
  }
  vm.x = 0;
  setCarry(vm, carry);
  vm.push16(value);
  return CONTINUE;
}
function shiftLeft(vm) {
  return shift(vm, true);
}
function shiftRight(vm) {
  return shift(vm, false);
}

// --- Truth values and comparisons (result $FFFF or $0000) ------------------------

// $F8BF boolean: every value other than 0 becomes $FFFF
function boolean(vm) {
  if (vm.peek16(1) !== 0) vm.poke16(1, SCRIPT_TRUE);
  return CONTINUE;
}
// $F843 equal (also $B0), $F87F not_equal (also $B8)
function equality(vm, wantEqual) {
  const right = vm.pull16(),
    left = vm.peek16(1);
  setCarry(vm, right >= left);
  vm.poke16(1, (right === left) === wantEqual ? SCRIPT_TRUE : 0);
  return CONTINUE;
}
function equal(vm) {
  return equality(vm, true);
}
function notEqual(vm) {
  return equality(vm, false);
}

// $F852 ($AC), $F86E ($AE), $F88E ($B4), $F8AA ($B6): sign gate with CMP
function compareGate(vm, op) {
  const leftGate = op === OPCODE.COMPARE_AC_HANDLER || op === OPCODE.COMPARE_B4_HANDLER;
  const gate = leftGate ? vm.peek16(STACK_SECOND_WORD) : 0,
    right = vm.pull16();
  let value;
  if (signed(leftGate ? gate : right))
    value = op === OPCODE.COMPARE_AC_HANDLER || op === OPCODE.COMPARE_AE_HANDLER ? 0 : SCRIPT_TRUE;
  else {
    const left = vm.peek16(1);
    setCarry(vm, right >= left);
    value = op === OPCODE.COMPARE_AE_HANDLER ? SCRIPT_TRUE : right === left ? 0 : SCRIPT_TRUE; // $AE: BEQ +0 always reaches DEX
  }
  vm.poke16(1, value);
  return CONTINUE;
}
// $F735 ($8A), $F77A ($92), $F7BC ($9A), $F7FE ($A2): carry comparison, $8A/$A2 with right-1
function carryCompare(vm, op) {
  const right = vm.pull16(),
    compared =
      op === OPCODE.COMPARE_8A_HANDLER || op === OPCODE.COMPARE_A2_HANDLER
        ? (right - 1) & WORD_MASK
        : right;
  const carry = compared >= vm.peek16(1);
  setCarry(vm, carry);
  vm.poke16(1, (op === OPCODE.COMPARE_9A_HANDLER ? !carry : carry) ? SCRIPT_TRUE : 0);
  return CONTINUE;
}
// $F745 ($8C), $F762 ($8E), $F789 ($94), $F7A5 ($96): carry comparison with sign gate
function carrySignGate(vm, op) {
  const leftGate = op === OPCODE.COMPARE_8C_HANDLER || op === OPCODE.COMPARE_94_HANDLER;
  const gate = leftGate ? vm.peek16(STACK_SECOND_WORD) : 0,
    right = vm.pull16();
  let value;
  if (signed(leftGate ? gate : right)) value = leftGate ? SCRIPT_TRUE : 0;
  else {
    const compared =
      op === OPCODE.COMPARE_8C_HANDLER || op === OPCODE.COMPARE_8E_HANDLER
        ? (right - 1) & WORD_MASK
        : right;
    const carry = compared >= vm.peek16(1);
    setCarry(vm, carry);
    value = carry ? SCRIPT_TRUE : 0;
  }
  vm.poke16(1, value);
  return CONTINUE;
}
// $F7CB ($9C), $F7E7 ($9E), $F80E ($A4), $F82B ($A6): complemented variant
function complementSignGate(vm, op) {
  const leftGate = op === OPCODE.COMPARE_9C_HANDLER || op === OPCODE.COMPARE_A4_HANDLER;
  const gate = leftGate ? vm.peek16(STACK_SECOND_WORD) : 0,
    right = vm.pull16();
  let value;
  if (signed(leftGate ? gate : right)) value = leftGate ? 0 : SCRIPT_TRUE;
  else {
    const compared =
      op === OPCODE.COMPARE_A4_HANDLER || op === OPCODE.COMPARE_A6_HANDLER
        ? (right - 1) & WORD_MASK
        : right;
    const carry = compared >= vm.peek16(1);
    setCarry(vm, carry);
    value = carry ? 0 : SCRIPT_TRUE;
  }
  vm.poke16(1, value);
  return CONTINUE;
}

// --- Control flow -----------------------------------------------------------------

// $F420 jump_if_zero, $F42E jump_if_nonzero, $F43C jump
function jumpIf(vm, taken) {
  vm.y = taken ? vm.stream16() : (vm.y + 2) & WORD_MASK;
  return CONTINUE;
}
function jumpIfZero(vm) {
  return jumpIf(vm, vm.pull16() === 0);
}
function jumpIfNonzero(vm) {
  return jumpIf(vm, vm.pull16() !== 0);
}
function jump(vm) {
  vm.y = vm.stream16();
  return CONTINUE;
}

// $F442 call_local: store the return Y below [DP+5], lower the pointer by 2
function callLocal(vm) {
  const target = vm.stream16();
  vm.x = target;
  vm.y = (vm.y + 2) & WORD_MASK;
  const pointer = (vm.d + FRAME_RETURN) & WORD_MASK;
  vm.mem.write16(absolute(vm, vm.mem.read16Bank0(pointer)), vm.y);
  vm.mem.write16Bank0(pointer, (vm.mem.read16Bank0(pointer) - 2) & WORD_MASK);
  vm.y = target;
  return CONTINUE;
}
// $F454 return_local: raise the pointer by 2, read the return Y afresh
function returnLocal(vm) {
  const pointer = (vm.d + FRAME_RETURN) & WORD_MASK;
  vm.mem.write16Bank0(pointer, (vm.mem.read16Bank0(pointer) + 2) & WORD_MASK);
  vm.y = vm.mem.read16(absolute(vm, vm.mem.read16Bank0(pointer)));
  return CONTINUE;
}

// --- Multiplication via the hardware unit ($F584) ---------------------------------

function loadLow(vm, byte) {
  vm.a = (vm.a & HIGH_BYTE_MASK) | byte;
}
function xba(vm) {
  vm.a = ((vm.a & BYTE_MASK) << BYTE_BITS) | (vm.a >>> BYTE_BITS);
}
function adc8(vm, right) {
  const left = vm.a & BYTE_MASK,
    sum = left + right,
    result = sum & BYTE_MASK;
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
    (sum > BYTE_MASK ? FLAG_CARRY : 0) |
    (~(left ^ right) & (left ^ result) & BYTE_SIGN ? FLAG_OVERFLOW : 0);
  loadLow(vm, result);
}
// Take the absolute value of the stack word and increment the sign counter X.
function magnitude(vm, offset) {
  const word = vm.peek16(offset);
  vm.a = word;
  if (signed(word)) {
    vm.a = -word & WORD_MASK;
    vm.poke16(offset, vm.a);
    vm.x++;
  }
}
// A counter value X of exactly 1 after counting down negates the result.
function negateIfOddSign(vm) {
  vm.x = (vm.x - 1) & WORD_MASK;
  if (vm.x === 0) {
    vm.a = -vm.pull16() & WORD_MASK;
    vm.push16(vm.a);
  }
}
function multiplyBody(vm) {
  requireBinary(vm);
  const mem = vm.mem,
    bank = vm.dbr << WORD_BITS,
    scratch = bank + ARITHMETIC_SCRATCH;
  loadLow(vm, mem.read8((vm.s + STACK_SECOND_WORD) & WORD_MASK));
  mem.write8(bank + WRMPYA, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8((vm.s + 2) & WORD_MASK));
  mem.write8(bank + WRMPYB, vm.a & BYTE_MASK);
  xba(vm);
  loadLow(vm, mem.read8(bank + RDMPYL));
  mem.write8(scratch, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8((vm.s + 1) & WORD_MASK));
  vm.s = (vm.s + 1) & WORD_MASK;
  mem.write8(bank + WRMPYB, vm.a & BYTE_MASK);
  xba(vm);
  vm.p &= ~FLAG_CARRY;
  mem.write8(bank + WRMPYA, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + RDMPYL));
  mem.write8((vm.s + 2) & WORD_MASK, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + RDMPYH));
  adc8(vm, mem.read8(scratch));
  mem.write8(scratch, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8((vm.s + 1) & WORD_MASK));
  vm.s = (vm.s + 1) & WORD_MASK;
  loadLow(vm, mem.read8((vm.s + 2) & WORD_MASK));
  mem.write8(bank + WRMPYB, vm.a & BYTE_MASK);
  vm.p &= ~FLAG_CARRY;
  loadLow(vm, mem.read8(bank + RDMPYL));
  adc8(vm, mem.read8(scratch));
  mem.write8((vm.s + 2) & WORD_MASK, vm.a & BYTE_MASK);
  negateIfOddSign(vm);
  return CONTINUE;
}
// $F581 UU, $F546 SU (left signed), $F556 US (right), $F566 SS
function multiplyUU(vm) {
  vm.x = 0;
  return multiplyBody(vm);
}
function multiplySU(vm) {
  vm.x = 0;
  magnitude(vm, STACK_SECOND_WORD);
  return multiplyBody(vm);
}
function multiplyUS(vm) {
  vm.x = 0;
  magnitude(vm, 1);
  return multiplyBody(vm);
}
function multiplySS(vm) {
  vm.x = 0;
  magnitude(vm, 1);
  magnitude(vm, STACK_SECOND_WORD);
  return multiplyBody(vm);
}

// --- Division via scaling and the hardware unit ($F612) ----------------------------

function divideLeft(vm, signedLeft) {
  vm.a = vm.peek16(STACK_SECOND_WORD);
  if (signedLeft && signed(vm.a)) {
    vm.a = -vm.a & WORD_MASK;
    vm.x++;
  }
  vm.mem.write16(absolute(vm, ARITHMETIC_SCRATCH), vm.a);
  vm.a = vm.pull16();
}
function divideRightMagnitude(vm) {
  if (signed(vm.a)) {
    vm.a = -vm.a & WORD_MASK;
    vm.x++;
  }
}
function divideBody(vm) {
  const mem = vm.mem,
    bank = vm.dbr << WORD_BITS;
  mem.write16(bank + ARITHMETIC_SCRATCH + DIVIDEND_FRACTION_OFFSET, 0);
  mem.write16(bank + ARITHMETIC_SCRATCH + DIVISOR_FRACTION_OFFSET, 0);
  // Scale the divisor to 8 bits; collect the shifted-out bits in $1EC/$1F0.
  while (vm.a >= BYTE_VALUES) {
    const dividend = mem.read16(bank + ARITHMETIC_SCRATCH);
    mem.write16(bank + ARITHMETIC_SCRATCH, dividend >>> 1);
    mem.write16(
      bank + ARITHMETIC_SCRATCH + DIVIDEND_FRACTION_OFFSET,
      (mem.read16(bank + ARITHMETIC_SCRATCH + DIVIDEND_FRACTION_OFFSET) >>> 1) |
        ((dividend & 1) << (WORD_BITS - 1)),
    );
    const divisorLow = vm.a & 1;
    vm.a >>>= 1;
    mem.write16(
      bank + ARITHMETIC_SCRATCH + DIVISOR_FRACTION_OFFSET,
      (mem.read16(bank + ARITHMETIC_SCRATCH + DIVISOR_FRACTION_OFFSET) >>> 1) |
        (divisorLow << (WORD_BITS - 1)),
    );
  }
  mem.write16(bank + ARITHMETIC_SCRATCH + SCALED_DIVISOR_OFFSET, vm.a);
  vm.a = mem.read16(bank + ARITHMETIC_SCRATCH);
  mem.write16(bank + WRDIVL, vm.a);
  loadLow(vm, mem.read8(bank + ARITHMETIC_SCRATCH + SCALED_DIVISOR_OFFSET));
  mem.write8(bank + WRDIVB, vm.a & BYTE_MASK);
  xba(vm); // three XBA in the original: the former low byte is kept as B
  loadLow(vm, mem.read8(bank + RDDIVL));
  mem.write8((vm.s + 1) & WORD_MASK, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + RDDIVH));
  mem.write8((vm.s + 2) & WORD_MASK, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + ARITHMETIC_SCRATCH + DIVIDEND_FRACTION_OFFSET));
  mem.write8(bank + WRDIVL, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + RDMPYL));
  mem.write8(bank + WRDIVH, vm.a & BYTE_MASK);
  loadLow(vm, mem.read8(bank + ARITHMETIC_SCRATCH + DIVISOR_FRACTION_OFFSET));
  mem.write8(bank + WRDIVB, vm.a & BYTE_MASK);
  vm.a = mem.read16(bank + RDDIVL);
  const carry = vm.a >= vm.peek16(1);
  setCarry(vm, carry);
  if (!carry) {
    vm.a = (vm.pull16() - 1) & WORD_MASK;
    vm.push16(vm.a);
  } // correction of the estimate
  negateIfOddSign(vm);
  return CONTINUE;
}
// $F609 UU, $F5CC SU, $F5DE US, $F5F0 SS
function divideUU(vm) {
  vm.x = 0;
  divideLeft(vm, false);
  return divideBody(vm);
}
function divideSU(vm) {
  vm.x = 0;
  divideLeft(vm, true);
  return divideBody(vm);
}
function divideUS(vm) {
  vm.x = 0;
  divideLeft(vm, false);
  divideRightMagnitude(vm);
  return divideBody(vm);
}
function divideSS(vm) {
  vm.x = 0;
  divideLeft(vm, true);
  divideRightMagnitude(vm);
  return divideBody(vm);
}

// --- Remainder by shifting and subtracting ($F6B1) -----------------------------------

function remainderBody(vm) {
  const mem = vm.mem,
    scratch = absolute(vm, ARITHMETIC_SCRATCH);
  if (vm.a >= compareTop(vm)) return CONTINUE;
  vm.push16(vm.y);
  vm.y = 0;
  let saved;
  do {
    vm.y = (vm.y + 1) & WORD_MASK;
    vm.a = (vm.a * 2) & WORD_MASK;
    saved = compareTop(vm);
    // If A drops to 0 through divisor 0 or overflow, the original doubles forever.
    if (vm.a === 0 && saved !== 0) throw new VmFault('original_endless_loop');
  } while (vm.a < saved);
  if (vm.a === saved) return remainderZero(vm);
  setCarry(vm, vm.a & 1);
  vm.a >>>= 1;
  mem.write16(scratch, vm.a);
  for (;;) {
    const left = vm.pull16();
    requireBinary(vm);
    const right = mem.read16(scratch),
      difference = left - right,
      result = difference & WORD_MASK;
    vm.p =
      (vm.p & ~(FLAG_CARRY | FLAG_OVERFLOW)) |
      (difference >= 0 ? FLAG_CARRY : 0) |
      ((left ^ right) & (left ^ result) & WORD_SIGN ? FLAG_OVERFLOW : 0);
    vm.a = result;
    vm.push16(result);
    vm.a = mem.read16(scratch);
    for (;;) {
      vm.y = (vm.y - 1) & WORD_MASK;
      if (vm.y === 0) {
        vm.y = vm.pull16();
        negateIfOddSign(vm);
        return CONTINUE;
      }
      setCarry(vm, vm.a & 1);
      vm.a >>>= 1;
      saved = compareTop(vm);
      if (vm.a === saved) return remainderZero(vm);
      if (vm.a < saved) {
        mem.write16(scratch, vm.a);
        break;
      }
    }
  }
}
// CMP 1,S: carry = A >= top word
function compareTop(vm) {
  const value = vm.peek16(1);
  setCarry(vm, vm.a >= value);
  return value;
}
function remainderZero(vm) {
  vm.poke16(1, 0);
  vm.y = vm.pull16();
  return CONTINUE;
}
// $F6AE UU; $F67A SU (left absolute value discarded), $F689 US, $F696 SS (left absolute value stored)
function remainderUU(vm) {
  vm.x = 0;
  vm.a = vm.pull16();
  return remainderBody(vm);
}
function remainderSigned(vm, op) {
  vm.x = 0;
  if (op !== OPCODE.REMAINDER_US_HANDLER) {
    vm.a = vm.peek16(STACK_SECOND_WORD);
    if (signed(vm.a)) {
      vm.a = -vm.a & WORD_MASK;
      vm.x++;
    }
    if (op === OPCODE.REMAINDER_SS_HANDLER) vm.poke16(STACK_SECOND_WORD, vm.a);
  }
  vm.a = vm.pull16();
  if (op !== OPCODE.REMAINDER_SU_HANDLER && signed(vm.a)) {
    vm.a = -vm.a & WORD_MASK;
    vm.x++;
  }
  return remainderBody(vm);
}

// --- Calls and exit -------------------------------------------------------------------

// Shared part of $F460/$F4CB: argument words into the work area from DBR:0000.
function moveArguments(vm, count) {
  vm.y = count;
  vm.x = 0;
  do {
    vm.a = vm.pull16();
    vm.mem.write16(absolute(vm, vm.x), vm.a);
    vm.x = (vm.x + 2) & WORD_MASK;
    vm.y = (vm.y - 1) & WORD_MASK;
  } while (vm.y !== 0);
}
function saveOperandStack(vm) {
  vm.a = vm.s;
  vm.mem.write16Bank0((vm.d + FRAME_OPERAND_STACK) & WORD_MASK, vm.a);
  vm.a = vm.mem.read16(absolute(vm, OUTER_STACK));
  vm.p =
    (vm.p & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
    (signed(vm.a) ? FLAG_NEGATIVE : 0) |
    (vm.a === 0 ? FLAG_ZERO : 0);
}
// $F460 call_script: up to before TCS at $F488
function callScript(vm) {
  const id = vm.stream16();
  vm.y = (vm.y + 2) & WORD_MASK;
  vm.mem.write16Bank0((vm.d + FRAME_PC) & WORD_MASK, vm.y);
  vm.mem.write16Bank0((vm.d + FRAME_CALL_ID) & WORD_MASK, id);
  vm.x = id;
  const bytes = vm.mem.read16(SCRIPT_ARGUMENT_BYTES + id) & BYTE_MASK;
  if (bytes) {
    setCarry(vm, bytes & 1);
    moveArguments(vm, bytes >>> 1);
  }
  vm.x = vm.mem.read16Bank0((vm.d + FRAME_CALL_ID) & WORD_MASK);
  saveOperandStack(vm);
  vm.pc = SCRIPT_CALL;
  vm.exitId = id;
  return EXIT_SCRIPT_CALL;
}
// $F4CB call_native: up to before TCS at $F4F6
function callNative(vm) {
  const id = vm.stream16() & BYTE_MASK;
  vm.y = (vm.y + 1) & WORD_MASK;
  vm.mem.write16Bank0((vm.d + FRAME_PC) & WORD_MASK, vm.y);
  vm.mem.write16Bank0((vm.d + FRAME_CALL_ID) & WORD_MASK, id);
  vm.x = id;
  const count = vm.mem.read16(NATIVE_ARGUMENT_COUNTS + id) & BYTE_MASK;
  if (count) moveArguments(vm, count);
  const freshId = vm.mem.read16Bank0((vm.d + FRAME_CALL_ID) & WORD_MASK);
  setCarry(vm, freshId >= WORD_SIGN);
  vm.x = (freshId * 2) & WORD_MASK;
  saveOperandStack(vm);
  vm.pc = NATIVE_BRIDGE;
  vm.exitId = id;
  return EXIT_NATIVE_CALL;
}
// $F4BE end: result to DBR:0000, restore the outer stack from DBR:01F2
function end(vm) {
  vm.mem.write16(absolute(vm, 0), vm.pull16());
  const savedOuterS = vm.mem.read16(absolute(vm, OUTER_STACK));
  const returnWord = vm.mem.read16Bank0((savedOuterS + 1) & WORD_MASK);
  vm.s = (savedOuterS + 2) & WORD_MASK;
  vm.a = 0;
  vm.d = 0;
  vm.p = (vm.p & ~(FLAG_ZERO | FLAG_NEGATIVE)) | FLAG_ZERO;
  vm.pc = (returnWord + 1) & WORD_MASK;
  return EXIT_END;
}
// $F927 (also via the JMP prefixes $54/$90/$98/$A0/$A8 and all unused opcodes):
// set bit 2 of DBR:01BE/01C0 from [DP], then RTS from the current stack.
function statusReturn(vm) {
  const mem = vm.mem,
    index = mem.read16Bank0(vm.d);
  const first =
    (mem.read8(absolute(vm, STATUS_FLAGS_FIRST)) & STATUS_INDEX_CLEAR) |
    (signed(index) ? STATUS_INDEX_BIT : 0);
  mem.write8(absolute(vm, STATUS_FLAGS_FIRST), first);
  const second =
    (mem.read8(absolute(vm, STATUS_FLAGS_SECOND)) & STATUS_INDEX_CLEAR) |
    (index === 1 ? STATUS_INDEX_BIT : 0);
  mem.write8(absolute(vm, STATUS_FLAGS_SECOND), second);
  vm.a = (vm.a & HIGH_BYTE_MASK) | second;
  vm.x = index;
  vm.p =
    (vm.p & ~(FLAG_CARRY | FLAG_ZERO | FLAG_MEMORY_8BIT | FLAG_NEGATIVE)) |
    (index >= 1 ? FLAG_CARRY : 0) |
    (second === 0 ? FLAG_ZERO : 0) |
    (second & FLAG_NEGATIVE);
  const returnWord = mem.read16Bank0((vm.s + 1) & WORD_MASK);
  vm.s = (vm.s + 2) & WORD_MASK;
  vm.pc = (returnWord + 1) & WORD_MASK;
  return EXIT_STATUS_RETURN;
}

// --- Table: opcode -> [original target, handler] ------------------------------------

const op = (fn) => (vm) => fn(vm, vm.x);
const STATUS = 0xf927;
export const OPCODE_TABLE = Object.freeze([
  [0x00, 0xf398, pushU8],
  [0x02, 0xf3a1, loadLocalU8],
  [0x04, 0xf8d4, loadStateU8],
  [0x0a, 0xf3f6, pushI8],
  [0x0c, 0xf408, loadLocalI8],
  [0x0e, 0xf90f, loadStateI8],
  [0x14, 0xf3b1, pushU16],
  [0x16, 0xf3b9, loadLocalU16],
  [0x18, 0xf8e4, loadStateU16],
  [0x2c, 0xf3c6, storeLocalU8],
  [0x2e, 0xf8f1, storeStateU8],
  [0x34, 0xf3d7, storeLocalU16],
  [0x36, 0xf902, storeStateU16],
  [0x44, 0xf420, jumpIfZero],
  [0x46, 0xf42e, jumpIfNonzero],
  [0x48, 0xf43c, jump],
  [0x4c, 0xf442, callLocal],
  [0x50, 0xf454, returnLocal],
  [0x52, 0xf460, callScript],
  [0x54, 0xf4bb, statusReturn],
  [0x56, 0xf4be, end],
  [0x58, 0xf4cb, callNative],
  [0x5c, 0xf532, add],
  [0x5e, 0xf53b, subtract],
  [0x60, 0xf581, multiplyUU],
  [0x62, 0xf546, multiplySU],
  [0x64, 0xf556, multiplyUS],
  [0x66, 0xf566, multiplySS],
  [0x68, 0xf609, divideUU],
  [0x6a, 0xf5cc, divideSU],
  [0x6c, 0xf5de, divideUS],
  [0x6e, 0xf5f0, divideSS],
  [0x70, 0xf6ae, remainderUU],
  [0x72, 0xf67a, op(remainderSigned)],
  [0x74, 0xf689, op(remainderSigned)],
  [0x76, 0xf696, op(remainderSigned)],
  [0x78, 0xf6f4, negate],
  [0x7a, 0xf6fd, shiftLeft],
  [0x7c, 0xf709, shiftRight],
  [0x7e, 0xf715, bitAnd],
  [0x80, 0xf71d, bitOr],
  [0x82, 0xf725, bitXor],
  [0x84, 0xf72d, bitNot],
  [0x86, 0xf3e4, increment],
  [0x88, 0xf3ea, decrement],
  [0x8a, 0xf735, op(carryCompare)],
  [0x8c, 0xf745, op(carrySignGate)],
  [0x8e, 0xf762, op(carrySignGate)],
  [0x90, 0xf774, statusReturn],
  [0x92, 0xf77a, op(carryCompare)],
  [0x94, 0xf789, op(carrySignGate)],
  [0x96, 0xf7a5, op(carrySignGate)],
  [0x98, 0xf7b6, statusReturn],
  [0x9a, 0xf7bc, op(carryCompare)],
  [0x9c, 0xf7cb, op(complementSignGate)],
  [0x9e, 0xf7e7, op(complementSignGate)],
  [0xa0, 0xf7f8, statusReturn],
  [0xa2, 0xf7fe, op(carryCompare)],
  [0xa4, 0xf80e, op(complementSignGate)],
  [0xa6, 0xf82b, op(complementSignGate)],
  [0xa8, 0xf83d, statusReturn],
  [0xaa, 0xf843, equal],
  [0xac, 0xf852, op(compareGate)],
  [0xae, 0xf86e, op(compareGate)],
  [0xb0, 0xf843, equal],
  [0xb2, 0xf87f, notEqual],
  [0xb4, 0xf88e, op(compareGate)],
  [0xb6, 0xf8aa, op(compareGate)],
  [0xb8, 0xf87f, notEqual],
  [0xba, 0xf3f0, duplicate],
  [0xbc, 0xf8bb, drop],
  [0xbe, 0xf8bf, boolean],
  [0xc0, 0xf393, pushZero],
  [0xc2, 0xf8cb, loadLocal0],
  // Unused even opcodes point directly to $F927.
  ...[
    0x06, 0x08, 0x10, 0x12, 0x1a, 0x1c, 0x1e, 0x20, 0x22, 0x24, 0x26, 0x28, 0x2a, 0x30, 0x32, 0x38,
    0x3a, 0x3c, 0x3e, 0x40, 0x42, 0x4a, 0x4e, 0x5a,
  ].map((code) => [code, STATUS, statusReturn]),
]);
