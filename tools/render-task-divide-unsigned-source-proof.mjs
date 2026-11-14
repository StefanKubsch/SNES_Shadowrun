import {proveArithmeticSource} from './task-arithmetic-source.mjs';
export const spec={
  "name": "divide-unsigned",
  "opcode": 104,
  "entry": 8451593,
  "windows": [
    {
      "start": 8451593,
      "hex": "A20000A3038DEA0168"
    },
    {
      "start": 8451602,
      "hex": "9CEC019CF001C90001900F4EEA016EEC014A6EF001C90001B0F18DEE01ADEA018D0442E220ADEE018D0642EBEBEBEAEAAD14428301AD15428302ADEC018D0442AD16428D0542ADF0018D0642EBEBEAEAC220AD1442C301B003683A48CAD0066849FFFF1A484C89F3"
    },
    {
      "start": 8450953,
      "hex": "B100C829FF00AA7CB4F2"
    }
  ],
  "classification": "div-observation-and-stack-source",
  "contract": "Fresh leftWORD LDA03,S -> actualDBR01EA low/high BEFORE fresh rightWORD PLA. Scratch stores may alias right stackbytes. X0, no sign normalization. E0M0X0 actual JMP entry in bank80, no rootJSR. D/actualDBR/S/fullY and intact code/outerstack are explicit. All stack/direct sources bank00 wrap16; absolute data uses actualDBR, WORDlow/high. S+2 at dynamic F390. Source edges include both conditional outcomes, not feasible value paths or executed instructions. Every pointer/opcode refetch is fresh, includes ignored opcodeHigh, full Y; finalA/X=opcodeLow,N0/Z, D/DBR/I/decimal preserved. No stackcapacity/parity/ID/target/init guards. Stores may physically alias scratch/pointer/frame/header/operand/opcode, so earlier data cannot be silently reused. Common F612: WORDSTZ01EC/01F0 before CMP0100. While A>=0100, WORDLSR01EA/ROR01EC, accumulatorLSR, WORDROR01F0, CMP0100/BCS. Only register A guarantees at most8 halvings; fresh scratch RMW sources may alias. Full finalA ->WORD01EE; freshWORD01EA ->WORD4204 low/high, SEP20, freshBYTE01EE ->4206. ThreeXBA/twoNOP then freshBYTE4214 and4215 -> remaining stacklow/high. FreshBYTE01EC ->4204; freshBYTE4216 ->4205; freshBYTE01F0 ->4206. TwoXBA/twoNOP/REP20; freshWORD4214 (including4215) CMP freshremaining stackWORD. BCS skips correction; otherwise freshWORDPLA/DEC/PHA (0000 wrapsFFFF). DEX/BNE then optional freshWORDPLA/EORFFFF/INC/PHA when signCount1. C from finalCMP and incoming V survive all correction/fetch; no ADC/SBC, decimalFlag preserved. Zero divisor has no guard and reaches requests; reads cannot be inferred as quotients, remainders, completion or timing.",
  "qualification": "Pinned complete local arithmetic source/control edges only; fresh actual data/device observations and effective byteowners/intactcode/outerstack required. No memory/CPU/device execution, global termination, native Taskbridge or wholeC1CA/9178/scene/frame proof.",
  "host_boundary": "Normalized host arithmetic/array operands do not supply the original physical stack, scratch/register observations, carries, fresh aliases or full machine return. No host arithmetic or native status changed."
};
export const prove=map=>proveArithmeticSource(map,spec);
