import {proveArithmeticSource} from './task-arithmetic-source.mjs';
export const spec={
  "name": "remainder-unsigned",
  "opcode": 112,
  "entry": 8451758,
  "windows": [
    {
      "start": 8451758,
      "hex": "A2000068"
    },
    {
      "start": 8451762,
      "hex": "C301B03B5AA00000C80AC30190FAF01C4A8DEA016838EDEA0148ADEA0188F0154AC301F007B0F68DEA0180E8A9000083017A4C89F37ACAD0066849FFFF1A484C89F3"
    },
    {
      "start": 8450953,
      "hex": "B100C829FF00AA7CB4F2"
    }
  ],
  "classification": "rem-observation-and-stack-source",
  "contract": "X0 then fresh rightWORD PLA. Initial CMP uses fresh remaining leftWORD. BCS bypass has no PHY/stores/negation and preserves incoming Y. Do not label this as a mathematical modulo implementation. E0M0X0 actual JMP entry in bank80, no rootJSR. D/actualDBR/S/fullY and intact code/outerstack are explicit. All stack/direct sources bank00 wrap16; absolute data uses actualDBR, WORDlow/high. S+2 at dynamic F390. Source edges include both conditional outcomes, not feasible value paths or executed instructions. Every pointer/opcode refetch is fresh, includes ignored opcodeHigh, full Y; finalA/X=opcodeLow,N0/Z, D/DBR/I/decimal preserved. No stackcapacity/parity/ID/target/init guards. Stores may physically alias scratch/pointer/frame/header/operand/opcode, so earlier data cannot be silently reused. Common F6B2: rightA CMP fresh remaining leftWORD, BCS directF6F1 bypasses all sign correction. Otherwise WORDPHY pushes originalY high/low, LDY0. INY/ASLA/CMP01,S/BCC now compares fresh SAVED-Y bytes, not leftWORD. WORDshift can wrap; divisor0 with positive savedY or repeated zero after shift can loop forever under stable supplied bytes, so no general termination claimed. BEQF6DE writes WORD0 into saved-Y top then PLY selectsY0 and jumps fetch without sign correction. Other path LSRA ->WORD01EA; WORDPLA pops savedY, SEC/SBC fresh01EA/binaryFlag0, PHA writes changed savedY, freshWORD01EA ->A. DEY0 ->PLY (possibly changed savedY restored into fullY), DEX and optional leftWORD negate for signCount1; otherwise LSRA/CMPfresh01,S/BEQ/BCS or scratchstore and back to savedY subtraction. PLY is not guaranteed originalY, and final fetch needs actual fresh restoredY. Operand S+2 on each exit, original dividend normally remains unless signed76 normalization/correction. No modulo replacement, loop cap or native binding.",
  "qualification": "Pinned complete local arithmetic source/control edges only; fresh actual data/device observations and effective byteowners/intactcode/outerstack required. No memory/CPU/device execution, global termination, native Taskbridge or wholeC1CA/9178/scene/frame proof.",
  "host_boundary": "Normalized host arithmetic/array operands do not supply the original physical stack, scratch/register observations, carries, fresh aliases or full machine return. No host arithmetic or native status changed."
};
export const prove=map=>proveArithmeticSource(map,spec);
