// Lookup tables of banks 80 and 81 (docs/ROM-FREE.md, step 2): fixed ranges
// between code that the port reads by index. Each entry names its readers;
// the range ends where executed code begins.
// - lz_bit_lengths 80:A033: bit length of n (0 for 0, 8 for 128 to 255), the
//   width of a back reference in the unpacker 9F49 (src/data/lz.mjs lzBits),
// - random_masks 80:C540: 16 words FFFF >> k, the mask of C51F for a range
//   below 2^(16-k) (src/task/native-random.mjs),
// - random_bytes 80:C58D: 256 bytes C560 mixes with 7E:1C76/1C77,
// - motion_offsets 80:AEB4: 136 words k * 20, read from the bases AEB4 and
//   AEC4 by the tile queue of AC2F (src/task/native-scene-tiles.mjs),
// - color_ramp 80:D3D1: 512 bytes of 8877 (proof/render/color-8877.mjs), D2E7
//   and the main loop upkeep,
// - bit_reverse 81:A017: each byte with its bits reversed, for mirrored
//   graphics (src/task/main-scene-graphics.mjs) and the unpacker body,
// - glyph_widths 81:AC0C: the pixel width of each character code 00 to 80
//   (FADD, text composition FB2A),
// - text_masks 81:AC8D: 34 bytes; AEC8 reads from AC8D, the text
//   composition XORs the words at AC9D (proof/render/text-compose.mjs),
// - text_numbers 80:D9B8: 611 text pointers by number (bit 15 selects bank
//   9E, see vm-texts.json), passed to FE69 by the selection 933A, the spell
//   list E1CF (numbers from 7E:3C1C) and the notices FEC1 (DP0A); written
//   as text addresses,
// - opcode_handlers 80:F2B4: the handler of each even script opcode 00 to C2,
//   read by JMP ($F2B4,X) at 80:F390 (src/script/opcodes.mjs; the VM checks
//   it with verifyOpcodeTable),
// - the matrix control tables of bank 81 (named data for the lifted matrix in
//   src/matrix/matrix-tables.mjs, used by src/matrix/matrix-world.mjs; the register-level
//   reference is in proof/matrix-reference/).
//   Direction tables are indexed by 7E:141C (even 0 to 14, 0 up, 4 right,
//   8 down, 12 left; the turns BCC3/BCE8 also pass the diagonals between,
//   which only matrix_face_pictures fills):
//   - matrix_damage 81:BA3E: the random range 6 (n - 7) of the damage that
//     B9D0 and C111 take for the tiles 08 to 0F (F2A8, then B1B5 subtracts
//     the roll + 1 from 7E:1754); the ninth word 36 has no reader,
//   - matrix_push_x/y 81:BA50/BA60: the step back by one tile after damage
//     (added to 7E:1524/1566),
//   - matrix_direction_calls 81:BB56: JSR ($BB56,X) at BA93 by the low pad
//     nibble of 7E:01CB times two (right BB44, left BB3E, down BB50, up BB4A,
//     else BA97),
//   - matrix_tile_steps 81:BB76 and matrix_map_steps 81:BB86: the next tile
//     in the 32 wide map, as tile and as byte offset (B69D, B696, B6A6),
//   - matrix_step_x/y 81:BB96/BBA6 and matrix_fast_x/y 81:BBB6/BBC6: the
//     speeds for 7E:14A0/14E2 (fast on the map values 1 and 2),
//   - matrix_move_pictures 81:BBD6 and matrix_face_pictures 81:BBE6: the
//     animation lists from 81:BE69 that B8AD sets in 7E:15A8,
//   - matrix_track_calls 81:BC1B: JSR ($BC1B,X) at BC09 by direction, all
//     BC41,
//   - matrix_track_stop, matrix_track_turn1/2 81:BC73/BC83/BC93 and
//     matrix_track_turn1/2_direction 81:BCA3/BCB3: the map values BC41
//     compares on a track and the new direction for each turn,
//   - matrix_state_calls 81:BD56: JSR ($BD56,X) at BD52 by 7E:173E,
//   - matrix_ahead_x/y 81:C23C/C24C: one tile ahead (C111, for B8C8),
//   - matrix_bits 81:C2D4: the bit 1 << k that C111 and C28C set in
//     7E:1756/1758/175A,
//   - matrix_amounts_10/18 81:C330/C396: the amount C25C adds to 7E:1750 for
//     the map values 10 to 17 and 18 to 1F; the word read of the last entry
//     also takes the ninth byte,
//   - matrix_text_commands 81:B372: the matrix text commands 01 to 06 of
//     JSR ($B370,X) at B307 (command 0 ends the text before the jump),
//   - matrix_cell_columns/rows 81:B5F9/B601: the map cell step B56F takes
//     toward the side that holds the value 7,
//   - matrix_side_offsets 81:B642 (byte offsets in the map, up, right, down,
//     left), matrix_side_x/y B64A/B652, matrix_side_values B65A and
//     matrix_side_kinds B662: B609 and B56F put an object of the kind (to
//     B8C8) beside each side whose map value matches,
//   - matrix_object_marks 81:B94F: the map word B90F writes under an object
//     of the kind 2 to 4 (the words for 0 and 1 have no reader),
//   - matrix_neighbour_offsets 81:B9C0: the eight neighbours B959 counts
//     damage tiles 08 to 0F in,
//   - matrix_oam_x_bits 81:BE65: the bit BD99 sets in the OAM high table
//     7E:111E for an object left of the screen, by its slot within the byte,
//   - matrix_blink_colors 81:BFD4: the two BGR colours (black, green) the
//     matrix NMI writes byte by byte to CGRAM 9 and 13 in turn,
//   - matrix_bg3_hdma 81:C101: the HDMA table C029 gives channel 6 for 2109
//     (BG3SC, mode 0): line counts 06, 44, 7F with the values 0C, 08, 0C,
//     end 00 (Book I chapter 17.2, PDF 87),
//   - matrix_vram_fill 81:B258: the fixed source byte of the DMA B228 that
//     clears 0800 bytes of VRAM from word 0800,
// - bar_remainder_tiles 81:B026: the tile word AF1F writes to 7E:2446+X for
//   the division remainder 0 to 30 (docs/reference/render-routines.md#af1f),
// - save_slot_offsets 81:B124: the SRAM offset of each save slot, read by
//   B11A for the save B17D and its checksum (src/task/native-main-menu.mjs),
// - the intro sprites of src/intro/intro-objects.mjs and src/task/main-intro-nmi.mjs:
//   - intro_sprite_tiles/columns/rows/x/y 81:E991/E9F3/EA55/EAB7/EB19: for
//     each of the 49 picture numbers the first OBJ name, the grid size and
//     the signed offset of the grid that E83A builds,
//   - intro_frames 81:DADD (D9D5) and intro_frames_df77 81:DF77 (DF0E): the
//     picture number of each step for the slots 7E:113E/114E, -1 stops, -2
//     goes back to the offset 3C (DADD) or 36 (DF77),
//   - intro_events_e900 81:DB8B and intro_events_e971 81:DBE1: entries of
//     three words (the time 7E:11A2, then X and Y twice their value) that
//     D9D5 hands to E900 and E971 when the time comes, ending with FFFF,
// - the intro scenes of CDF8 (src/task/main-scene.mjs, scene 7E:001E, six
//   words each):
//   - scene_audio_modes 81:D3BF (EF47 when not negative), scene_sounds D3CB
//     (F007/F130 when not zero),
//   - scene_targets/steps D3D7/D3E3 and scene_end_steps D3EF: the value and
//     step the wait EEBB moves toward (src/task/main-scene-wait.mjs), with
//     the frame counts scene_frames D3FB and scene_end_frames D407,
//   - scene_sprite_bases D413 (D4E8, CF79 displacements),
//   - scene_animation_calls D41F: JMP ($D41F,X) at CF76,
//   - scene_window_hdma D42B: the HDMA table of channel 7 (mode 1, 2126 and
//     2127, Book I chapter 17.2, PDF 87), one of scene_window_hdma_a/b/c
//     D437/D44D/D463 (line count and two bytes, end 00),
// - obj_size_clear_masks 80:B18A and obj_x_high_bits 80:B85E: for each OBJ
//   slot 0 to 127 the AND mask that clears its size bit and the bit that
//   sets its X bit 8 in the OAM high table copy 7E:3F08
//   (src/task/native-scene-sprites.mjs),
// - sound_effects 80:C4B3: the sound word C46E takes at the byte offset of
//   its argument (proof/render/audio-c46e.mjs): the low byte goes to F007
//   command 5, bit 15 has F130 load its set first (cached in 7E:1CE0),
// - the karma lists of CE6D (src/task/native-main-menu.mjs KARMA_LISTS): for the
//   attributes F0F3 (karma_attribute_* 80:EFB2), the skills F054
//   (karma_skill_* EFCA) and the spells F1B5 (karma_spell_* EFE2) the WRAM
//   byte of each value (stats), its name (names) and its maximum (limits),
// - the spell menu of E693 (src/task/native-member-spell-menu.mjs): spell_level_names
//   80:E7C8 (six rows by level 1 to 6, six spells each, read at E7BC +
//   12 level + 2 slot with the record slots 6 to 11), then by spell the
//   script numbers spell_scripts_a/b 80:E810/E81C (to 7E:1E2D/1E4D) and the
//   names spell_names 80:E828 (to 7E:1F31),
// - walk_step_x/y 80:DF27/DF39 and pad_directions 80:DF4B: the steps E014
//   moves by direction 0 to 8 (to 7E:0D20/0D78), and the direction DEC7
//   takes for each pad nibble of 7E:01CB (10: none),
// - motion_x/y_a 80:C7CC/C7DC and motion_x/y_b 80:C7EC/C7FC: the eight
//   direction steps of src/task/main-motion-target.mjs (b when its test is
//   zero), also in assets/slot-motion-direction-data.json,
// - intro_spawns 81:DC78: entries of three words (frame offset - 3C, X and Y
//   twice their value) DC43 puts in the intro slots, ending with FFFF,
// - frontend_vram_copies 81:DC92: entries of three words (the screen
//   7E:001E, WRAM source in bank 7E, VRAM word address) for the 0800 byte
//   DMA of src/frontend/title.mjs, ending with FFFF,
// - shot_kinds 80:8A13 (by direction 7E:1198) and shot_spread_x/y
//   80:8A23/8A33 (by a random 0 to 7): the object 8AB5 starts for a shot and
//   its offset from 7E:0E28/0E80 / 4 (src/task/native-object-shoot.mjs),
// - hit_kinds 80:8840 and hit_offsets 80:8850 (by direction): the same for
//   the hit 8691 (src/task/native-object-hit.mjs),
// - dialog_music 80:94EA: the music of a dialog, read as the word at 80:94E8
//   + 2 n by 936C for the music number n (bits 0 to 6 of the record flag
//   byte, src/data/dialogs.mjs; 0 keeps the music and reads nothing, the
//   records use 1 and 2) and compared with 7E:1CDE (src/task/native-dialog.mjs),
// - selection_steps_x/y 80:BBFA/BC0A: the steps 933A/BBA0 give the chosen
//   object by direction (to 7E:0D20/0D78, src/task/native-selection.mjs),
// - the status screen EA6E (src/task/native-status-screen.mjs): the window rows
//   status_attribute_rows 80:ED0E and names status_attribute_names ED16 of
//   the four attributes, the menu A6C7 status_menu_items ED1E (Exit first,
//   0 ends it) and status_submenu_calls ED2E (JMP ($ED2E,X) at ECEA by the
//   choice, 0 for Exit),
// - decimal_powers 80:FE45: 10^9 down to 10 as 32 bit values, the divisors
//   of the number output at EA6E,
// - intro_sound_voices 81:E949 (by slot) and intro_sound_pans 81:E951 (by
//   screen column): the word E900 ORs for F007 command 7,
// - intro_unpacks 81:D85C: entries of three words (A, Y and X for F2A0)
//   D83E unpacks, ending with 0000,
// - intro_e900_x/y 81:E12A/E13A: the positions twice their value the intro
//   hands E900 every eight steps,
// - frontend_vram_uploads 81:DD8B: entries of three words (the time
//   7E:001E, WRAM source in bank 7E, VRAM word address) of the frontend NMI,
//   ending with FFFF,
// - frontend_text_vram 81:E7A0 (the VRAM word of each text row E6AE sends)
//   and frontend_sound_words 81:E7B4 (F007 command 7 words of E57E/E6AE),
// - frontend_menu_fade_shifts/masks 81:D90F/D91B (D8E5) and
//   frontend_text_fade_shifts/masks 81:E60B/E617 (E5DB): the shift count
//   and colour mask of each fade step,
// - frontend_oam 81:E5CB: four OBJ entries E57E copies to 7E:0F1E,
// - scene_list_commands 81:EC2F: JSR ($EC2F,X) at EC28 by the scene list
//   command (src/task/main-scene-video.mjs, src/data/scene-lists.mjs);
//   command 0 ends a list before the jump,
// - window HDMA tables (line count and two bytes for 2126/2127, end 00):
//   dialog_window_hdma 80:8F87 (8F3A copies the 16 bytes to 7E:0144),
//   weapon_window_hdma 80:E480 (F254 to 7E:1F3F) and
//   intro_window_hdma 81:D687 (to 7E:8EA8),
// - menu item lists for A6C7 (text pointers, 0 ends): dialog_menu_items
//   80:920D (91E2), modal_menu_items 80:CD91 (Yes/No), save_menu_items
//   80:CE65 and main_menu_items 80:CEC3 (CE6D), karma_menu_items 80:EF78,
// - compare_calls_b0e3/b126 80:B0E3/B126: JMP ($B0E3,X) at B0AC and
//   JMP ($B126,X) at B0EF, the depth compares (COMPARE of
//   src/task/native-scene-sprites.mjs; index 0 is not taken),
// - formation_slot_offsets 80:BB88: the slot offset of each member (BB2C),
// - swarm_values_d260 80:D2DD and swarm_values_d63c 80:D704: the word D260
//   and D63C hand the create call D2AF in DP08 by member,
// - skill_names 80:E8BC: the six skill names of E834,
// - upkeep_sound_args 80:FF73: the sound argument (an offset into
//   sound_effects) the main loop upkeep picks at random for C46E,
// - aa9c_sources 80:FFAD: the two long pointers of the packed streams AA9C
//   unpacks (proof/render/aa9c.mjs),
// - oam_fill 81:A7FB and scene_dma_fill 81:EE4E: fixed DMA source bytes,
// - scene_displacements_d022/d0fd 81:D022/D0FD: the byte CFCC and its
//   neighbours mask (3, 7) for D4E8; the word read takes the next byte too,
// - scene_sprite_parts 81:D529: two OBJ parts of D4E8 (offset word at
//   D527 + X shares these bytes: X 6 and 2 read D52D/D529 and D52F/D52B),
// - intro_oam_x_bits 81:E8E1: the X bit 8 per slot that E83A sets.
// The matrix animation lists 81:BE69 to BEC2 (MATRIX_ANIMATIONS) follow:
// picture words BD99 takes one per step into 7E:13DA, each list ends with
// FFFF (start again) or FFFE (stop). The pointer tables above, B8AD and
// B8C8 (BEB1) name their starts.
// Kinds: 1 byte, 2 word, 4 long word, 'long' a 24 bit address, 's2' signed word, 'hex' word as four hex digits,
// 'text' text pointer, 'pointer' a word within the table's bank, written as
// an address (zero stays 0).
// Every table keeps its address and length (table_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { label, romWriter, textPointerLabel, textPointerWord } from './rom-bytes.mjs';
import {
  WORD_MASK,
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  WORD_HEX_DIGITS,
  BANK_MASK,
  BYTE_VALUES,
  LONG_BYTES,
  WORD_SIGN,
} from '../constants/bits.mjs';

const DOUBLE_WORD_BYTES = 4;
const byteSize = (size) =>
  size === 1 || size === DOUBLE_WORD_BYTES ? size : size === 'long' ? LONG_BYTES : 2;
export const LOOKUP_TABLES = [
  ['lz_bit_lengths', 0x80a033, 1, 256],
  ['random_masks', 0x80c540, 2, 16],
  ['random_bytes', 0x80c58d, 1, 256],
  ['motion_offsets', 0x80aeb4, 2, 136],
  ['color_ramp', 0x80d3d1, 1, 512],
  ['bit_reverse', 0x81a017, 1, 256],
  ['glyph_widths', 0x81ac0c, 1, 129],
  ['text_masks', 0x81ac8d, 1, 34],
  ['text_numbers', 0x80d9b8, 'text', 611],
  ['opcode_handlers', 0x80f2b4, 'pointer', 98],
  ['matrix_damage', 0x81ba3e, 2, 9],
  ['matrix_push_x', 0x81ba50, 's2', 8],
  ['matrix_push_y', 0x81ba60, 's2', 8],
  ['matrix_direction_calls', 0x81bb56, 'pointer', 16],
  ['matrix_tile_steps', 0x81bb76, 's2', 8],
  ['matrix_map_steps', 0x81bb86, 's2', 8],
  ['matrix_step_x', 0x81bb96, 's2', 8],
  ['matrix_step_y', 0x81bba6, 's2', 8],
  ['matrix_fast_x', 0x81bbb6, 's2', 8],
  ['matrix_fast_y', 0x81bbc6, 's2', 8],
  ['matrix_move_pictures', 0x81bbd6, 'pointer', 8],
  ['matrix_face_pictures', 0x81bbe6, 'pointer', 8],
  ['matrix_track_calls', 0x81bc1b, 'pointer', 8],
  ['matrix_track_stop', 0x81bc73, 2, 8],
  ['matrix_track_turn1', 0x81bc83, 2, 8],
  ['matrix_track_turn2', 0x81bc93, 2, 8],
  ['matrix_track_turn1_direction', 0x81bca3, 2, 8],
  ['matrix_track_turn2_direction', 0x81bcb3, 2, 8],
  ['matrix_state_calls', 0x81bd56, 'pointer', 6],
  ['matrix_ahead_x', 0x81c23c, 's2', 8],
  ['matrix_ahead_y', 0x81c24c, 's2', 8],
  ['matrix_bits', 0x81c2d4, 2, 8],
  ['matrix_amounts_10', 0x81c330, 1, 9],
  ['matrix_amounts_18', 0x81c396, 1, 9],
  ['matrix_text_commands', 0x81b372, 'pointer', 6],
  ['matrix_cell_columns', 0x81b5f9, 's2', 4],
  ['matrix_cell_rows', 0x81b601, 's2', 4],
  ['matrix_side_offsets', 0x81b642, 's2', 4],
  ['matrix_side_x', 0x81b64a, 's2', 4],
  ['matrix_side_y', 0x81b652, 's2', 4],
  ['matrix_side_values', 0x81b65a, 2, 4],
  ['matrix_side_kinds', 0x81b662, 2, 4],
  ['matrix_object_marks', 0x81b94f, 2, 5],
  ['matrix_neighbour_offsets', 0x81b9c0, 's2', 8],
  ['matrix_oam_x_bits', 0x81be65, 1, 4],
  ['matrix_blink_colors', 0x81bfd4, 2, 2],
  ['matrix_bg3_hdma', 0x81c101, 1, 7],
  ['matrix_vram_fill', 0x81b258, 1, 1],
  ['bar_remainder_tiles', 0x81b026, 2, 31],
  ['save_slot_offsets', 0x81b124, 2, 4],
  ['intro_sprite_tiles', 0x81e991, 2, 49],
  ['intro_sprite_columns', 0x81e9f3, 2, 49],
  ['intro_sprite_rows', 0x81ea55, 2, 49],
  ['intro_sprite_x', 0x81eab7, 's2', 49],
  ['intro_sprite_y', 0x81eb19, 's2', 49],
  ['intro_frames', 0x81dadd, 's2', 87],
  ['intro_events_e900', 0x81db8b, 2, 43],
  ['intro_events_e971', 0x81dbe1, 2, 49],
  ['intro_frames_df77', 0x81df77, 's2', 56],
  ['scene_audio_modes', 0x81d3bf, 's2', 6],
  ['scene_sounds', 0x81d3cb, 2, 6],
  ['scene_targets', 0x81d3d7, 2, 6],
  ['scene_steps', 0x81d3e3, 2, 6],
  ['scene_end_steps', 0x81d3ef, 2, 6],
  ['scene_frames', 0x81d3fb, 2, 6],
  ['scene_end_frames', 0x81d407, 2, 6],
  ['scene_sprite_bases', 0x81d413, 2, 6],
  ['scene_animation_calls', 0x81d41f, 'pointer', 6],
  ['scene_window_hdma', 0x81d42b, 'pointer', 6],
  ['scene_window_hdma_a', 0x81d437, 1, 22],
  ['scene_window_hdma_b', 0x81d44d, 1, 22],
  ['scene_window_hdma_c', 0x81d463, 1, 22],
  ['obj_size_clear_masks', 0x80b18a, 1, 128],
  ['obj_x_high_bits', 0x80b85e, 1, 128],
  ['sound_effects', 0x80c4b3, 'hex', 54],
  ['karma_attribute_stats', 0x80efb2, 'hex', 4],
  ['karma_attribute_names', 0x80efba, 'text', 4],
  ['karma_attribute_limits', 0x80efc2, 2, 4],
  ['karma_skill_stats', 0x80efca, 'hex', 4],
  ['karma_skill_names', 0x80efd2, 'text', 4],
  ['karma_skill_limits', 0x80efda, 2, 4],
  ['spell_level_names', 0x80e7c8, 'text', 36],
  ['spell_scripts_a', 0x80e810, 2, 6],
  ['spell_scripts_b', 0x80e81c, 2, 6],
  ['spell_names', 0x80e828, 'text', 6],
  ['walk_step_x', 0x80df27, 's2', 9],
  ['walk_step_y', 0x80df39, 's2', 9],
  ['pad_directions', 0x80df4b, 2, 16],
  ['motion_x_a', 0x80c7cc, 's2', 8],
  ['motion_y_a', 0x80c7dc, 's2', 8],
  ['motion_x_b', 0x80c7ec, 's2', 8],
  ['motion_y_b', 0x80c7fc, 's2', 8],
  ['intro_spawns', 0x81dc78, 2, 13],
  ['frontend_vram_copies', 0x81dc92, 'hex', 13],
  ['shot_kinds', 0x808a13, 2, 8],
  ['shot_spread_x', 0x808a23, 's2', 8],
  ['shot_spread_y', 0x808a33, 's2', 8],
  ['hit_kinds', 0x808840, 2, 8],
  ['hit_offsets', 0x808850, 's2', 8],
  ['dialog_music', 0x8094ea, 2, 2],
  ['selection_steps_x', 0x80bbfa, 's2', 8],
  ['selection_steps_y', 0x80bc0a, 's2', 8],
  ['status_attribute_rows', 0x80ed0e, 2, 4],
  ['status_attribute_names', 0x80ed16, 'text', 4],
  ['status_menu_items', 0x80ed1e, 'text', 8],
  ['status_submenu_calls', 0x80ed2e, 'pointer', 7],
  ['decimal_powers', 0x80fe45, 4, 9],
  ['intro_sound_voices', 0x81e949, 'hex', 4],
  ['intro_sound_pans', 0x81e951, 'hex', 16],
  ['intro_unpacks', 0x81d85c, 'hex', 16],
  ['intro_e900_x', 0x81e12a, 2, 8],
  ['intro_e900_y', 0x81e13a, 2, 8],
  ['frontend_vram_uploads', 0x81dd8b, 'hex', 19],
  ['frontend_text_vram', 0x81e7a0, 'hex', 10],
  ['frontend_sound_words', 0x81e7b4, 'hex', 4],
  ['frontend_menu_fade_shifts', 0x81d90f, 2, 6],
  ['frontend_menu_fade_masks', 0x81d91b, 'hex', 6],
  ['frontend_text_fade_shifts', 0x81e60b, 2, 6],
  ['frontend_text_fade_masks', 0x81e617, 'hex', 6],
  ['frontend_oam', 0x81e5cb, 1, 16],
  ['scene_list_commands', 0x81ec2f, 'pointer', 9],
  ['dialog_window_hdma', 0x808f87, 1, 16],
  ['weapon_window_hdma', 0x80e480, 1, 13],
  ['intro_window_hdma', 0x81d687, 1, 13],
  ['dialog_menu_items', 0x80920d, 'text', 4],
  ['modal_menu_items', 0x80cd91, 'text', 3],
  ['save_menu_items', 0x80ce65, 'text', 4],
  ['main_menu_items', 0x80cec3, 'text', 4],
  ['karma_menu_items', 0x80ef78, 'text', 5],
  ['compare_calls_b0e3', 0x80b0e3, 'pointer', 5],
  ['compare_calls_b126', 0x80b126, 'pointer', 5],
  ['formation_slot_offsets', 0x80bb88, 2, 4],
  ['swarm_values_d260', 0x80d2dd, 2, 5],
  ['swarm_values_d63c', 0x80d704, 2, 8],
  ['skill_names', 0x80e8bc, 'text', 6],
  ['upkeep_sound_args', 0x80ff73, 2, 3],
  ['aa9c_sources', 0x80ffad, 'long', 2],
  ['oam_fill', 0x81a7fb, 1, 1],
  ['scene_dma_fill', 0x81ee4e, 1, 1],
  ['scene_displacements_d022', 0x81d022, 1, 8],
  ['scene_displacements_d0fd', 0x81d0fd, 1, 16],
  ['scene_sprite_parts', 0x81d529, 'hex', 4],
  ['intro_oam_x_bits', 0x81e8e1, 1, 4],
  ['karma_spell_stats', 0x80efe2, 'hex', 6],
  ['karma_spell_names', 0x80efee, 'text', 6],
  ['karma_spell_limits', 0x80effa, 2, 6],
].map(([name, address, size, count]) => ({
  name,
  address,
  size,
  count,
  length: byteSize(size) * count,
}));
// Text pointers: bit 15 selects bank 9E, the address always has bit 15 set.
const textWord = (text) => {
  const m = /^(9D|9E):([89A-F][0-9A-F]{3})$/.exec(text ?? '');
  return m ? textPointerWord(m[1], m[2]) : null;
};
export const MATRIX_ANIMATIONS = 0x81be69,
  MATRIX_ANIMATIONS_END = 0x81bec3;
const ENDS = { loop: 0xffff, stop: 0xfffe };
const hex = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');
// A word as a value of its kind and back (null: not a value of the kind).
function decode(size, address, v) {
  if (size === 'text') return v ? textPointerLabel(v) : 0;
  if (size === 's2') return (v << WORD_BITS) >> WORD_BITS;
  if (size === 'hex') return hex(v);
  if (size === 'long') return label(v);
  if (size === 'pointer') return v ? label((address & BANK_MASK) | v) : 0;
  return v;
}
function encode(size, address, value) {
  if (size === 'text') return value === 0 ? 0 : textWord(value);
  if (size === 's2')
    return Number.isInteger(value) && value >= -WORD_SIGN && value < WORD_SIGN
      ? value & WORD_MASK
      : null;
  if (size === 'hex') return /^[0-9A-F]{4}$/.test(value ?? '') ? parseInt(value, HEX_RADIX) : null;
  if (size === 'long')
    return /^[0-9A-F]{2}:[0-9A-F]{4}$/.test(value ?? '')
      ? parseInt(value.replace(':', ''), HEX_RADIX)
      : null;
  if (size === 'pointer') {
    if (value === 0) return 0;
    const m = /^([0-9A-F]{2}):([0-9A-F]{4})$/.exec(value ?? '');
    return m && parseInt(m[1], HEX_RADIX) === address >> WORD_BITS && parseInt(m[2], HEX_RADIX)
      ? parseInt(m[2], HEX_RADIX)
      : null;
  }
  return Number.isInteger(value) && value >= 0 && value < 2 ** (BYTE_BITS * size) ? value : null;
}

export function readTables(read8) {
  return LOOKUP_TABLES.map(({ name, address, size, count }) => ({
    name,
    address: label(address),
    values: Array.from({ length: count }, (_, k) => {
      const width = byteSize(size);
      let v = 0;
      for (let b = width - 1; b >= 0; b--) v = v * BYTE_VALUES + read8(address + width * k + b);
      return decode(size, address, v);
    }),
  }));
}

export function readAnimations(read8) {
  const lists = [];
  for (let at = MATRIX_ANIMATIONS; at < MATRIX_ANIMATIONS_END;) {
    const list = { address: label(at), pictures: [] };
    for (;;) {
      const v = read8(at) | (read8(at + 1) << BYTE_BITS);
      at += 2;
      if (v === ENDS.loop || v === ENDS.stop) {
        list.end = v === ENDS.loop ? 'loop' : 'stop';
        break;
      }
      list.pictures.push(hex(v));
    }
    lists.push(list);
  }
  return lists;
}

function placeAnimations(rom, present, lists) {
  let at = MATRIX_ANIMATIONS;
  const write = romWriter(rom, present, 'table_layout_changed');
  const put = (v) => {
    write(at++, v & BYTE_MASK);
    write(at++, v >> BYTE_BITS);
  };
  for (const list of lists ?? []) {
    if (list?.address !== label(at) || !Array.isArray(list.pictures) || !(list.end in ENDS))
      throw new VmFault('table_layout_changed', at);
    for (const p of list.pictures) {
      const v = /^[0-9A-F]{4}$/.test(p ?? '') ? parseInt(p, HEX_RADIX) : null;
      if (v === null || v >= ENDS.stop) throw new VmFault('table_value_required', at);
      put(v);
    }
    put(ENDS[list.end]);
  }
  if (at !== MATRIX_ANIMATIONS_END) throw new VmFault('table_layout_changed', at);
}

export function placeTables(rom, present, { tables, animations }) {
  const put = romWriter(rom, present, 'table_layout_changed');
  if (tables?.length !== LOOKUP_TABLES.length)
    throw new VmFault('table_layout_changed', LOOKUP_TABLES[0].address);
  LOOKUP_TABLES.forEach(({ name, address, size, count }, n) => {
    const t = tables[n];
    if (t?.name !== name || t.address !== label(address) || t.values?.length !== count)
      throw new VmFault('table_layout_changed', address);
    const width = byteSize(size);
    t.values.forEach((value, k) => {
      const v = encode(size, address, value);
      if (v === null) throw new VmFault('table_value_required', address + width * k);
      for (let b = 0; b < width; b++) {
        put(address + width * k + b, Math.floor(v / 2 ** (BYTE_BITS * b)) & BYTE_MASK);
      }
    });
  });
  placeAnimations(rom, present, animations);
}
