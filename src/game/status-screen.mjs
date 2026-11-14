// The status screen of a group member (lifted from 80:EA6E, 80:EA89 and 80:EA8E;
// register-level version statusSequence in src/task/native-status-screen.mjs, which
// recorded waits and inputs replay).
//
// The entries: the script native 80:EA6E shows the object DP 00; the player control's
// 80:EA89 (Start) and 80:EA8E (Y, the item submenu at once, 7E:1F64 FFFF) show the
// object under the glove (01DA not negative: 01DE) or the leader (0CC2). The sound is
// dimmed (command 2 to 2F2F, 81:F007), the member menu mark 1F62 set and open notice
// windows released (80:FF79). An object whose number is not in the group (7E:2DF0)
// gives way to the leader; a leader outside the group stops. The object's state count
// (7E:0002 of its record) goes to 1F5E, its number, object and runner index to 1F5A,
// 1F5C and 1F60, the record pointer to DP F9 and the portrait (Jake's alternate with
// 7E:3C17) and datajack to 1F54 and 1F56. After the glove (80:BCB2) and 81:886A the
// status window (02, 02, 1E by 1A, its number in 1F4C) shows the attribute rows
// (80:ED0E, labels 80:ED16; the record's third byte is skipped), the state count, the
// magic points over ten times Magic, and for Jake karma, money (80:FDCF) and the spell
// label; then the weapon and armour labels, the equipment rows (80:E9C5) and the
// portrait (80:E4B3). The menu (80:ED1E in a window at 15, 03, its number in 1F4E)
// runs a submenu of the table 80:ED2E (JMP (ED2E,X) inside JSR ECEA) until one sets
// 7E:1D63 or the menu ends; 1F64 set runs the first submenu once and keeps no menu
// window. At the end 80:92C5, the windows are released, 1F62 is cleared and the sound
// restored (7F7F). The callees run through their frames from the routine table.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { taskStop } from '../task/plan.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { DP_SCRATCH, STATUS_LAYOUT } from '../task/native-member-spell-menu.mjs';
import {
  ATTRIBUTE_ROWS,
  DP_MAGIC_MAXIMUM,
  MENU_WINDOW,
  STATUS_MENU_ITEMS,
  STATUS_ROWS,
  STATUS_VOLUME_TARGET,
  STATUS_WINDOW_SHAPE,
  TEXT_MONEY,
  TEXT_SLASH,
  translatedMenuWindow,
} from '../task/native-status-screen.mjs';
import {
  DIALOG_END,
  DP_CURSOR_ROW,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GROUP_INDEX,
  GROUP_NUMBERS,
  JAKE_ALTERNATE_PORTRAIT,
  KARMA,
  MAGIC_POINTS,
  MEMBER_DATAJACK,
  MEMBER_INDEX,
  MEMBER_MENU_ACTIVE,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT,
  MEMBER_STATE_COUNT,
  NUYEN,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  STATUS_ITEMS_AT_ONCE,
  STATUS_MENU_WINDOW,
  STATUS_WINDOW,
  WRAM,
} from '../task/wram.mjs';
import {
  JAKE_ALTERNATE_PORTRAIT_DIALOG,
  JAKE_OBJECT_NUMBER,
  RECORD_MAGIC,
  RUNNER_DATAJACKS,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_PORTRAITS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The entries: the script native, Start and Y in the player control.
export const NATIVE_ENTRY = 0x80ea6e,
  START_ENTRY = 0x80ea89,
  ITEMS_ENTRY = 0x80ea8e;
const SOUND = 0x81f007,
  RELEASE_NOTICES = 0x80ff79,
  PUT_GLOVE_AWAY = 0x80bcb2,
  STATUS_SETUP = 0x81886a,
  OPEN_WINDOW = 0x80f963,
  CURSOR = 0x80faac,
  TEXT = 0x80fe69,
  NUMBER = 0x80fd80,
  DECIMAL_NUMBER = 0x80fdcf,
  EQUIPMENT_ROWS = 0x80e9c5,
  PORTRAIT = 0x80e4b3,
  PLAIN_MENU = 0x80a6c7,
  RELEASE_WINDOW = 0x80fa3e,
  STATUS_CLEANUP = 0x8092c5;
// The attribute labels follow the rows; the attributes from index 6 down, the record's
// byte after the third attribute is skipped; the submenus' jump table; the restored
// sound level; the mark set; the first submenu (items) for 1F64.
const ATTRIBUTE_LABELS = 0xed16,
  LAST_ATTRIBUTE = 6,
  SKIPPED_AFTER = 2,
  SUBMENUS = 0xed2e,
  FULL_VOLUME = 0x7f7f,
  MARK_SET = WORD_MASK,
  FIRST_SUBMENU = 1,
  MENU_COLUMN = 1,
  // Ten times Magic: Magic doubled, then times four plus the double.
  MAGIC_SCALE_SHIFT = 2,
  KARMA_SHIFT = 3,
  KARMA_CARRY_BIT = 1 << (KARMA_SHIFT - 1),
  // The money's 32-bit number for 80:FDCF.
  DP_NUMBER_LOW = 2,
  DP_NUMBER_HIGH = 4;
const TEXT_KARMA = 0x7117,
  TEXT_SPELL = 0x7484,
  TEXT_WEAPON = 0x7125,
  TEXT_ARMOUR = 0x70b6;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const load = (ctx, value) => {
  ctx.a = value;
  setSignZero(ctx, value);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// CMP/CPX on words: the carry for left >= right, the sign and zero of the difference.
const compare = (ctx, left, right) => {
  setFlag(ctx, FLAG_CARRY, left >= right);
  setSignZero(ctx, (left - right) & WORD_MASK);
};
// A long word read: WRAM fields indexed past their bank reach the next one.
const longWord = (mem, address) => mem.read16(address & LONG_MASK);
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 80:EA6E, 80:EA89 or 80:EA8E: the status screen (see above). A sequence that ends
// with its RTS.
export function* statusScreenSequence(h, events, routines, entry = NATIVE_ENTRY) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    native = entry === NATIVE_ENTRY;
  const call = (pc, target, long = false) =>
    nativeCallSequence(h, events, routines, pc, target, long, false);
  // The record pointer DP F9 and its word, which the attribute rows step through.
  const record = () => word(wram, DP_MEMBER_RECORD) | (wram[DP_MEMBER_RECORD_BANK] << WORD_BITS);
  const nextRecordByte = () => {
    const value = longWord(mem, record()) & BYTE_MASK;
    setWord(wram, DP_MEMBER_RECORD, word(wram, DP_MEMBER_RECORD) + 1);
    return value;
  };
  // The cursor (column DP 02, row DP 1D or kept), a text and a number, each a call.
  const cursor = function* (pc, column, row) {
    yield () => {
      setWord(wram, 2, column);
      load(ctx, column);
      if (row === undefined) return;
      setWord(wram, DP_CURSOR_ROW, row);
      load(ctx, row);
    };
    yield* call(pc, CURSOR);
  };
  const text = function* (pc, id) {
    yield () => {
      load(ctx, id);
      setWord(wram, 2, id);
    };
    yield* call(pc, TEXT);
  };
  const number = function* (pc, value) {
    yield () => {
      const shown = value();
      load(ctx, shown);
      setWord(wram, 2, shown);
    };
    yield* call(pc, NUMBER);
  };
  // The object's state count from its record (LDX record, LDA state AND FF).
  const keepStateCount = (object) => {
    const at = dataBankWord(mem, OBJECT_RECORD, object),
      count = longWord(mem, WRAM + STATE_COUNT + at) & BYTE_MASK;
    ctx.x = at;
    load(ctx, count);
    setDataBankWord(mem, MEMBER_STATE_COUNT, 0, count);
  };
  // Whether the object's number is in the group (searched from the group's index down).
  const inGroup = (object) => {
    const objectNumber = dataBankWord(mem, OBJECT_NUMBER, object);
    let at = word(wram, GROUP_INDEX);
    ctx.a = objectNumber;
    for (;;) {
      const member = longWord(mem, WRAM + GROUP_NUMBERS + at);
      compare(ctx, objectNumber, member);
      if (objectNumber === member) break;
      at = (at - 2) & WORD_MASK;
      setSignZero(ctx, at);
      if (negative(at)) break;
    }
    ctx.x = at;
    return (ctx.status & FLAG_ZERO) !== 0;
  };

  yield () => {
    if (entry === ITEMS_ENTRY) {
      setWord(wram, STATUS_ITEMS_AT_ONCE, MARK_SET);
      load(ctx, MARK_SET);
    } else setWord(wram, STATUS_ITEMS_AT_ONCE, 0);
    ctx.a = APU_COMMAND_VOLUME_TARGET;
    ctx.x = STATUS_VOLUME_TARGET;
    setSignZero(ctx, STATUS_VOLUME_TARGET);
  };
  yield* call(native ? 0x80ea77 : 0x80ea9a, SOUND, true);
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, MARK_SET);
    load(ctx, MARK_SET);
    // The native keeps its object DP 00 on the stack over the release (PEI, PLY).
    if (native) h.push(word(wram, 0), 2);
  };
  yield* call(native ? 0x80ea83 : 0x80eaa4, RELEASE_NOTICES);
  yield () => {
    let object;
    if (native) object = h.pull(2);
    else {
      const tag = dataBankWord(mem, GLOVE_TARGET_TAG);
      ctx.a = tag;
      object = dataBankWord(mem, negative(tag) ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT);
    }
    ctx.y = object;
    keepStateCount(object);
    if (!inGroup(object)) {
      object = dataBankWord(mem, PLAYER_OBJECT);
      ctx.y = object;
      keepStateCount(object);
      if (!inGroup(object)) taskStop('task_ea6e_endless_search');
    }
    // The runner of the number (from the last; none leaves FFFE).
    let runner = RUNNER_LAST_INDEX;
    for (;;) {
      const runnerNumber = dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner);
      compare(ctx, ctx.a, runnerNumber);
      if (ctx.a === runnerNumber) break;
      runner = (runner - 2) & WORD_MASK;
      setSignZero(ctx, runner);
      if (negative(runner)) break;
    }
    ctx.x = runner;
    setWord(wram, MEMBER_NUMBER, ctx.a);
    setWord(wram, MEMBER_OBJECT, object);
    setWord(wram, MEMBER_INDEX, runner);
  };
  yield* call(0x80eaea, PUT_GLOVE_AWAY);
  yield* call(0x80eaed, STATUS_SETUP, true);
  yield () => {
    const runner = dataBankWord(mem, MEMBER_INDEX);
    ctx.x = runner;
    setWord(wram, DP_MEMBER_RECORD, dataBankWord(mem, RUNNER_RECORD_POINTERS, runner));
    // CPX #0 leaves the carry set.
    setFlag(ctx, FLAG_CARRY, true);
    const alternate = runner === 0 && wram[JAKE_ALTERNATE_PORTRAIT] !== 0;
    setWord(
      wram,
      MEMBER_PORTRAIT,
      alternate ? JAKE_ALTERNATE_PORTRAIT_DIALOG : dataBankWord(mem, RUNNER_PORTRAITS, runner),
    );
    setWord(wram, MEMBER_DATAJACK, dataBankWord(mem, RUNNER_DATAJACKS, runner));
    wram[DP_MEMBER_RECORD_BANK] = mem.read8(
      (CODE_BANK_BASE + RUNNER_RECORD_BANKS + runner) & LONG_MASK,
    );
    setWord(wram, DIALOG_END, 0);
    setWord(wram, DP_WINDOW_LEFT, STATUS_WINDOW_SHAPE.left);
    setWord(wram, DP_WINDOW_TOP, STATUS_WINDOW_SHAPE.top);
    setWord(wram, DP_WINDOW_COLUMNS, STATUS_WINDOW_SHAPE.columns);
    setWord(wram, DP_WINDOW_ROWS, STATUS_WINDOW_SHAPE.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    load(ctx, 0);
  };
  yield* call(0x80eb3a, OPEN_WINDOW);
  yield () => {
    const window = word(wram, 0);
    setWord(wram, STATUS_WINDOW, window);
    ctx.y = RECORD_MAGIC;
    const doubled = (longWord(mem, record() + RECORD_MAGIC) & BYTE_MASK) << 1,
      maximum = (doubled << MAGIC_SCALE_SHIFT) + doubled;
    setWord(wram, DP_MAGIC_MAXIMUM, maximum);
    // The shifts and the sum of at most 2550 carry and overflow nothing.
    load(ctx, maximum);
    setFlag(ctx, FLAG_CARRY, false);
    setFlag(ctx, FLAG_OVERFLOW, false);
  };
  // The attribute rows from the last; a callee may change the index kept in DP 6B.
  let at = LAST_ATTRIBUTE;
  do {
    yield () => {
      setWord(wram, 2, STATUS_ROWS.labelColumn);
      const row = dataBankWord(mem, ATTRIBUTE_ROWS, at);
      load(ctx, row);
      setWord(wram, DP_CURSOR_ROW, row);
      setWord(wram, DP_SCRATCH, at);
      ctx.x = at;
    };
    yield* call(0x80eb62, CURSOR);
    yield () => {
      const kept = word(wram, DP_SCRATCH),
        label = dataBankWord(mem, ATTRIBUTE_LABELS, kept);
      ctx.x = kept;
      load(ctx, label);
      setWord(wram, 2, label);
    };
    yield* call(0x80eb6c, TEXT);
    yield* cursor(0x80eb74, STATUS_LAYOUT.valueColumn);
    yield () => {
      const value = nextRecordByte(),
        kept = word(wram, DP_SCRATCH);
      ctx.x = kept;
      compare(ctx, kept, SKIPPED_AFTER);
      if (kept === SKIPPED_AFTER) setWord(wram, DP_MEMBER_RECORD, word(wram, DP_MEMBER_RECORD) + 1);
      load(ctx, value);
      setWord(wram, 2, value);
    };
    yield* call(0x80eb89, NUMBER);
    yield () => {
      at = (word(wram, DP_SCRATCH) - 2) & WORD_MASK;
      ctx.x = at;
      setSignZero(ctx, at);
    };
  } while (!negative(at));
  yield* cursor(0x80eb9c, STATUS_ROWS.countColumn, STATUS_ROWS.stateCountRow);
  yield* number(0x80eba4, () => dataBankWord(mem, MEMBER_STATE_COUNT));
  yield* text(0x80ebac, TEXT_SLASH);
  yield* number(0x80ebb8, nextRecordByte);
  yield* cursor(0x80ebc5, STATUS_ROWS.countColumn, STATUS_ROWS.magicRow);
  yield* number(0x80ebd6, () => {
    const runner = dataBankWord(mem, MEMBER_INDEX),
      member = runner >>> 1;
    setFlag(ctx, FLAG_CARRY, runner & 1);
    ctx.x = member;
    return longWord(mem, WRAM + MAGIC_POINTS + member) & BYTE_MASK;
  });
  yield* text(0x80ebde, TEXT_SLASH);
  yield* number(0x80ebe5, () => word(wram, DP_MAGIC_MAXIMUM));
  let jake;
  yield () => {
    const memberNumber = dataBankWord(mem, MEMBER_NUMBER);
    ctx.a = memberNumber;
    compare(ctx, memberNumber, JAKE_OBJECT_NUMBER);
    jake = memberNumber === JAKE_OBJECT_NUMBER;
  };
  if (jake) {
    yield* cursor(0x80ebfa, STATUS_ROWS.labelColumn, STATUS_ROWS.karmaRow);
    yield* text(0x80ec02, TEXT_KARMA);
    yield* cursor(0x80ec0a, STATUS_LAYOUT.valueColumn);
    yield* number(0x80ec16, () => {
      const karma = longWord(mem, WRAM + KARMA);
      setFlag(ctx, FLAG_CARRY, karma & KARMA_CARRY_BIT);
      return karma >>> KARMA_SHIFT;
    });
    yield* cursor(0x80ec23, STATUS_ROWS.labelColumn, STATUS_ROWS.moneyRow);
    yield* text(0x80ec2b, TEXT_MONEY);
    yield* cursor(0x80ec33, STATUS_LAYOUT.valueColumn);
    yield () => {
      const high = longWord(mem, WRAM + NUYEN + 2);
      setWord(wram, DP_NUMBER_LOW, longWord(mem, WRAM + NUYEN));
      setWord(wram, DP_NUMBER_HIGH, high);
      load(ctx, high);
    };
    yield* call(0x80ec42, DECIMAL_NUMBER);
    yield* cursor(0x80ec4f, STATUS_ROWS.labelColumn, STATUS_ROWS.spellLabelRow);
    yield* text(0x80ec57, TEXT_SPELL);
  }
  yield* cursor(0x80ec64, STATUS_ROWS.labelColumn, STATUS_ROWS.weaponLabelRow);
  yield* text(0x80ec6c, TEXT_WEAPON);
  yield* cursor(0x80ec79, STATUS_ROWS.labelColumn, STATUS_ROWS.armourLabelRow);
  yield* text(0x80ec81, TEXT_ARMOUR);
  yield* call(0x80ec84, EQUIPMENT_ROWS);
  yield* call(0x80ec87, PORTRAIT);

  let direct;
  yield () => {
    const atOnce = dataBankWord(mem, STATUS_ITEMS_AT_ONCE);
    load(ctx, atOnce);
    direct = atOnce !== 0;
    if (direct) return;
    const window = translatedMenuWindow(h);
    setWord(wram, DP_WINDOW_LEFT, window.left);
    setWord(wram, DP_WINDOW_TOP, window.top);
    setWord(wram, DP_WINDOW_COLUMNS, window.columns);
    setWord(wram, DP_WINDOW_ROWS, window.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    load(ctx, 0);
  };
  if (!direct) {
    yield* call(0x80eca8, OPEN_WINDOW);
    yield () => {
      const window = word(wram, 0);
      load(ctx, window);
      setWord(wram, STATUS_MENU_WINDOW, window);
    };
  }
  for (;;) {
    let chosen, close;
    yield () => {
      if (direct) {
        chosen = FIRST_SUBMENU;
        load(ctx, chosen);
        return;
      }
      const atOnce = dataBankWord(mem, STATUS_ITEMS_AT_ONCE);
      load(ctx, atOnce);
      close = atOnce !== 0;
      if (close) return;
      setWord(wram, 0, dataBankWord(mem, STATUS_MENU_WINDOW));
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, STATUS_MENU_ITEMS);
      setWord(wram, DP_LIST_TOKEN_BANK, CODE_BANK);
      load(ctx, CODE_BANK);
    };
    if (close) return yield* closeSequence(h, call);
    if (!direct) {
      yield* call(0x80ecd0, PLAIN_MENU);
      yield () => {
        chosen = word(wram, 0);
        load(ctx, chosen);
      };
      if (chosen === 0 || negative(chosen)) break;
    }
    direct = false;
    let submenu;
    yield () => {
      const offset = (chosen << 1) & WORD_MASK;
      setFlag(ctx, FLAG_CARRY, negative(chosen));
      load(ctx, offset);
      ctx.x = offset;
      submenu = CODE_BANK_BASE | dataBankWord(mem, SUBMENUS, offset);
      if (!routines.has(submenu))
        taskStop('task_ea6e_submenu_open', { pc: 0x80ecea, x: offset, target: submenu });
    };
    // JSR ECEA, whose JMP (ED2E,X) gives the submenu the JSR's frame.
    yield* call(0x80ece0, submenu);
    let ended;
    yield () => {
      const end = word(wram, DIALOG_END);
      load(ctx, end);
      ended = end !== 0;
    };
    if (ended) break;
  }
  yield () => {
    const window = dataBankWord(mem, STATUS_MENU_WINDOW);
    load(ctx, window);
    setWord(wram, 0, window);
  };
  yield* call(0x80ecf2, RELEASE_WINDOW);
  return yield* closeSequence(h, call);
}

// ECF5: the cleanup, the status window released, the mark cleared and the sound
// restored; then the RTS.
function* closeSequence(h, call) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield* call(0x80ecf5, STATUS_CLEANUP);
  yield () => {
    const window = dataBankWord(mem, STATUS_WINDOW);
    load(ctx, window);
    setWord(wram, 0, window);
  };
  yield* call(0x80ecfd, RELEASE_WINDOW);
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, 0);
    ctx.a = APU_COMMAND_VOLUME_TARGET;
    ctx.x = FULL_VOLUME;
    setSignZero(ctx, FULL_VOLUME);
  };
  yield* call(0x80ed09, SOUND, true);
  return yield* returnSequence(h);
}
