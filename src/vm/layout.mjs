// Fixed addresses the event interpreter and scheduler share with the original.
// WRAM offsets are relative to DBR $80 (bank 0 mirror); ROM tables are long
// addresses read by the original routines named beside them.

// Task tables, indexed by X = 2 * slot (48 slots), see src/vm/scheduler.mjs.
export const TASK_FRAME = 0x0252; // D of the task (heap data address)
export const TASK_CONTINUATION = 0x02b2; // RTS word to resume, 0 = enter at $F378
export const TASK_NEXT = 0x0312; // next slot in the task or free list
export const TASK_PREVIOUS = 0x0372; // previous slot in the task list
export const TASK_WAIT = 0x0ba2; // wait mask, $FFFF = waits for a child task
export const TASK_COUNTER = 0x0c02; // frame counter for wait bit 0
export const TASK_EVENTS = 0x0c62; // event bits that ended a wait
export const TASK_LIST_HEAD = 0x024c;
export const TASK_FREE_LIST = 0x024e;
export const TASK_CURSOR = 0x0250; // slot of the current task

// Task frame header at D (TASK_FRAME), written by $C2C8, $F460 and $F4CB:
// bytes 0-2 bytecode pointer with bank, then the fields below.
export const FRAME_BANK_WORD = 1; // high byte: bank of the bytecode (PEA/PLB source)
export const FRAME_BANK_BYTE = 2;
export const FRAME_PC = 3; // script PC (Y)
export const FRAME_RETURN = 5; // local return pointer
export const FRAME_OPERAND_STACK = 7; // S of the operand stack
export const FRAME_CALL_ID = 9; // script or native ID of the pending call
export const FRAME_RETURN_BASE = 0x11; // $C2C8: initial local return pointer = frame + $11
export const FRAME_LOCALS = 0x13; // $F3A1: local byte at frame + $13 + operand
export const FRAME_FIXED_BYTES = 0x17; // $C2C8: added to the two script header counts

// Scheduler scratch words.
export const FRAME_SIZE = 0x0246; // $C2C8: header bytes + $17
export const FRAME_ARGUMENT_BYTES = 0x0248; // $C2C8: argument bytes of the script
export const HEAP_REQUEST = 0x024a; // $C242: requested block size

// Heap from $03D2: block header [size | $8000 used, next block], data from +4.
export const HEAP_SIZE_WORD = 0x03d2;
export const HEAP_NEXT_WORD = 0x03d4;
export const HEAP_DATA = 0x03d6;
export const HEAP_HEADER_BYTES = 4;
export const HEAP_USED = 0x8000;
export const HEAP_SIZE_MASK = 0x7fff;
export const HEAP_INITIAL_SIZE = 0x07cc; // $C1A6: one free block, ending before TASK_WAIT
export const TASK_LAST_SLOT = 0x5e; // $C1A6: last word index of the 48 task slots

// Interpreter work area.
export const ARITHMETIC_SCRATCH = 0x01ea; // $01EA-$01F1: multiply, divide and remainder
export const STATUS_FLAGS_FIRST = 0x01be; // $F927: bit 2 = negative index
export const STATUS_FLAGS_SECOND = 0x01c0; // $F927: bit 2 = index 1
export const OUTER_STACK = 0x01f2; // S of the scheduler while a task runs

// Interpreter entry and exit points in bank $80.
export const OPCODE_LOOP = 0xf390; // state between two opcodes
export const SCRIPT_CALL = 0xf488;
export const SCRIPT_RESUME = 0xf495;
export const NATIVE_BRIDGE = 0xf4f6;
export const NATIVE_DISPATCH = 0xf52f;
export const NATIVE_RESUME = 0xf509;

// ROM tables in bank $82 (read sites listed in tools/scripts.mjs).
export const OPCODE_TARGETS = 0x80f2b4; // word per even opcode
export const SCRIPT_BANKS = 0x82db28; // $C2C8: bank byte per script ID
export const SCRIPT_POINTERS = 0x82ded1; // $C2DB: word per script ID (index 2 * ID)
export const SCRIPT_ARGUMENT_BYTES = 0x82e9cc; // $C2CE and $F460: byte per script ID
export const SCRIPT_RETURN_BYTES = 0x82e623; // $F495: byte != 0 pushes the result
export const NATIVE_POINTERS = 0x82d7b8; // $F4F6: word per native ID (index 2 * ID)
export const NATIVE_ARGUMENT_COUNTS = 0x82da4c; // $F4CB: argument words per native ID
export const NATIVE_RETURN_BYTES = 0x82d970; // $F509: byte != 0 pushes the result
