// European interpreter at $80:F389, jump table $80:F2B4.
// Operand widths are recovered from byte-stream reads/INY in each handler.
// Names ending in 'handler' deliberately leave arithmetic semantics open.
const OPCODE_DEFINITIONS = [
  [0x00, 'push_u8', 'u8', 0xf398],
  [0x02, 'load_local_u8', 'u8', 0xf3a1],
  [0x04, 'load_state_u8', 'u16', 0xf8d4],
  [0x0a, 'push_i8', 'u8', 0xf3f6],
  [0x0c, 'load_local_i8', 'u8', 0xf408],
  [0x0e, 'load_state_i8', 'u16', 0xf90f],
  [0x14, 'push_u16', 'u16', 0xf3b1],
  [0x16, 'load_local_u16', 'u8', 0xf3b9],
  [0x18, 'load_state_u16', 'u16', 0xf8e4],
  [0x2c, 'store_local_u8', 'u8', 0xf3c6],
  [0x2e, 'store_state_u8', 'u16', 0xf8f1],
  [0x34, 'store_local_u16', 'u8', 0xf3d7],
  [0x36, 'store_state_u16', 'u16', 0xf902],
  [0x44, 'jump_if_zero', 'u16', 0xf420, 'conditional'],
  [0x46, 'jump_if_nonzero', 'u16', 0xf42e, 'conditional'],
  [0x48, 'jump', 'u16', 0xf43c, 'jump'],
  [0x4c, 'call_local', 'u16', 0xf442, 'local_call'],
  [0x50, 'return_local', 'none', 0xf454, 'return'],
  [0x52, 'call_script', 'u16', 0xf460],
  [0x56, 'end', 'none', 0xf4be, 'end'],
  [0x58, 'call_native', 'u8', 0xf4cb],
  [0x5c, 'add', 'none', 0xf532],
  [0x5e, 'subtract', 'none', 0xf53b],
  [0x60, 'multiply_uu_handler', 'none', 0xf581],
  [0x62, 'multiply_su_handler', 'none', 0xf546],
  [0x64, 'multiply_us_handler', 'none', 0xf556],
  [0x66, 'multiply_ss_handler', 'none', 0xf566],
  [0x68, 'divide_uu_handler', 'none', 0xf609],
  [0x6a, 'divide_su_handler', 'none', 0xf5cc],
  [0x6c, 'divide_us_handler', 'none', 0xf5de],
  [0x6e, 'divide_ss_handler', 'none', 0xf5f0],
  [0x70, 'remainder_uu_handler', 'none', 0xf6ae],
  [0x72, 'remainder_su_handler', 'none', 0xf67a],
  [0x74, 'remainder_us_handler', 'none', 0xf689],
  [0x76, 'remainder_ss_handler', 'none', 0xf696],
  [0x78, 'negate', 'none', 0xf6f4],
  [0x7a, 'shift_left', 'none', 0xf6fd],
  [0x7c, 'shift_right', 'none', 0xf709],
  [0x7e, 'bit_and', 'none', 0xf715],
  [0x80, 'bit_or', 'none', 0xf71d],
  [0x82, 'bit_xor', 'none', 0xf725],
  [0x84, 'bit_not', 'none', 0xf72d],
  [0x86, 'increment', 'none', 0xf3e4],
  [0x88, 'decrement', 'none', 0xf3ea],
  [0x8a, 'compare_8a_handler', 'none', 0xf735],
  [0x8c, 'compare_8c_handler', 'none', 0xf745],
  [0x8e, 'compare_8e_handler', 'none', 0xf762],
  [0x92, 'compare_92_handler', 'none', 0xf77a],
  [0x94, 'compare_94_handler', 'none', 0xf789],
  [0x96, 'compare_96_handler', 'none', 0xf7a5],
  [0x9a, 'compare_9a_handler', 'none', 0xf7bc],
  [0x9c, 'compare_9c_handler', 'none', 0xf7cb],
  [0x9e, 'compare_9e_handler', 'none', 0xf7e7],
  [0xa2, 'compare_a2_handler', 'none', 0xf7fe],
  [0xa4, 'compare_a4_handler', 'none', 0xf80e],
  [0xa6, 'compare_a6_handler', 'none', 0xf82b],
  [0xaa, 'equal', 'none', 0xf843],
  [0xac, 'compare_ac_handler', 'none', 0xf852],
  [0xae, 'compare_ae_handler', 'none', 0xf86e],
  [0xb0, 'equal_alias', 'none', 0xf843],
  [0xb2, 'not_equal', 'none', 0xf87f],
  [0xb4, 'compare_b4_handler', 'none', 0xf88e],
  [0xb6, 'compare_b6_handler', 'none', 0xf8aa],
  [0xb8, 'not_equal_alias', 'none', 0xf87f],
  [0xba, 'duplicate', 'none', 0xf3f0],
  [0xbc, 'drop', 'none', 0xf8bb],
  [0xbe, 'boolean', 'none', 0xf8bf],
  [0xc0, 'push_zero', 'none', 0xf393],
  [0xc2, 'load_local0_u8', 'none', 0xf8cb],
];
const OPERAND_BYTES = { u16: 2, u8: 1, none: 0 };
// The jump table $80:F2B4 has one entry per even opcode 00-C2.
const JUMP_TABLE_ENTRIES = 98;
export const scriptOpcodes = Object.freeze(
  Object.fromEntries(
    OPCODE_DEFINITIONS.map(([opcode, name, operand, handler, flow = 'next']) => [
      opcode,
      Object.freeze({
        opcode,
        name,
        operand,
        handler,
        flow,
        length: 1 + OPERAND_BYTES[operand],
      }),
    ]),
  ),
);

// Opcode by upper-case name, for example OPCODE.JUMP (48) or OPCODE.END (56).
export const OPCODE = Object.freeze(
  Object.fromEntries(OPCODE_DEFINITIONS.map(([opcode, name]) => [name.toUpperCase(), opcode])),
);

// These entries dispatch directly to $F927, or via JMP $F927.
export const trapOpcodes = Object.freeze(
  Array.from({ length: JUMP_TABLE_ENTRIES }, (_, i) => i * 2).filter((op) => !scriptOpcodes[op]),
);
