import {proveArithmeticSource} from './task-arithmetic-source.mjs';
export const spec={
  "name": "multiply-us",
  "opcode": 100,
  "entry": 8451414,
  "windows": [
    {
      "start": 8451414,
      "hex": "A20000A301102749FFFF1A8301E8801E"
    },
    {
      "start": 8451460,
      "hex": "E220A3038D0242A3028D0342EBEAAD16428DEA01688D0342EB188D0242AD16428302AD17426DEA018DEA0168A3028D034218AD16426DEA018302C220CAD0066849FFFF1A484C89F3"
    },
    {
      "start": 8450953,
      "hex": "B100C829FF00AA7CB4F2"
    }
  ],
  "classification": "mul-observation-and-stack-source",
  "contract": "Fresh rightWORD at incomingS+1/+2. Negative EORFFFF/INC/STA01,S writes magnitude low/high; INX sets sign count1. Positive skips stores. Left remains unnormalized. E0M0X0 actual JMP entry in bank80, no rootJSR. D/actualDBR/S/fullY and intact code/outerstack are explicit. All stack/direct sources bank00 wrap16; absolute data uses actualDBR, WORDlow/high. S+2 at dynamic F390. Source edges include both conditional outcomes, not feasible value paths or executed instructions. Every pointer/opcode refetch is fresh, includes ignored opcodeHigh, full Y; finalA/X=opcodeLow,N0/Z, D/DBR/I/decimal preserved. No stackcapacity/parity/ID/target/init guards. Stores may physically alias scratch/pointer/frame/header/operand/opcode, so earlier data cannot be silently reused. Common F584: SEP20 leaves highA intact. LDA03,S (leftLow), STA4202; LDA02,S (rightHigh), STA4203; XBA/NOP; fresh BYTE4216 -> BYTE01EA. BYTEPLA(rightLow), STA4203; XBA restores previously read rightHigh into lowA; CLC/STA4202 writes that BYTE, not cached leftLow. Fresh BYTE4216 -> STA02,S at originalS+3 (resultLow). Fresh BYTE4217 plus fresh01EA under binaryADC/C0 ->01EA. Second BYTEPLA still reads originalS+2 even though its value is discarded. Fresh LDA02,S now originalS+4 ->4203; CLC; fresh4216 plus fresh01EA ->STA02,S originalS+4 (resultHigh). REP20, DEX; BNE skip unless signCount1, which PLA/EORFFFF/INC/PHA negates fresh remaining WORD. XBA swaps both accumulator bytes in BYTE mode; each BYTE read preserves current highA. Carry/V from last BYTEADC survive correction/refetch; decimalFlag0 required for those binary equations. 4202/4203 stores and three4216/one4217 reads are actualDBR requests/observations, never assumed hardware products or elapsed timing.",
  "qualification": "Pinned complete local arithmetic source/control edges only; fresh actual data/device observations and effective byteowners/intactcode/outerstack required. No memory/CPU/device execution, global termination, native Taskbridge or wholeC1CA/9178/scene/frame proof.",
  "host_boundary": "Normalized host arithmetic/array operands do not supply the original physical stack, scratch/register observations, carries, fresh aliases or full machine return. No host arithmetic or native status changed."
};
export const prove=map=>proveArithmeticSource(map,spec);
