// Spend karma on already known attributes, skills and spells. Rebuild available
// choices after every purchase; a Body increase also raises and restores health.
import { karmaMenuState } from '../state/karma-menu.mjs';
import { memberMenuState } from '../state/member-menu.mjs';
import { memberMenuContent } from '../content/member-menus.mjs';
import { jakeState } from '../state/jake.mjs';
import { writeStateWord } from '../state/objects.mjs';
import { chooseFromList } from './menu-choice.mjs';
import { openWindowAt, clearWindowText } from './window-open.mjs';
import { setTextCursorAt, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import {
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
  releaseWindowAt,
} from './window-release.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { raiseStateCountAndRedraw } from './runner-state-call.mjs';
import { raiseMemberMagicPointsInPlace } from '../script/native-magic-points-raise.mjs';
import { KARMA_WINDOWS } from '../system/native-main-menu.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { WORD_MASK, WORD_SIGN, BYTE_MASK } from '../constants/bits.mjs';
const TEXT_KARMA = 0x7117,
  TEXT_INSUFFICIENT = 0x711b;
function* text(h, events, renderBuffer, value) {
  yield () => writeStateWord(h.a.mem.wram, 2, value);
  yield* printText(h, events, renderBuffer);
}
function* fittedWindow(h, events, shape, ids = [], options) {
  const fit = h.a.mem.language ? translatedListWindow(h.a.mem, shape, ids, options) : shape;
  return yield* openWindowAt(h, events, [fit.left, fit.top, fit.columns, fit.rows]);
}
export function* karmaLine(h, events, renderBuffer = drawTextBuffer) {
  const state = karmaMenuState(h.a.mem);
  yield* clearWindowText(h, events, state.balanceWindow);
  yield () => setTextCursorAt(h, state.balanceWindow, 0, 0);
  yield* text(h, events, renderBuffer, TEXT_KARMA);
  yield () => setTextCursorAt(h, state.balanceWindow, 6, 0);
  yield () => writeStateWord(h.a.mem.wram, 2, state.balance >>> 3);
  yield* printNumber(h, events, renderBuffer);
}
export function* buyStep(h, events, upgrade, renderBuffer = drawTextBuffer) {
  const state = karmaMenuState(h.a.mem);
  let paid;
  yield () => {
    paid = state.buy(upgrade);
  };
  if (paid) return true;
  const window = yield* fittedWindow(
    h,
    events,
    { left: 14, top: 2, columns: 16, rows: 3 },
    [TEXT_INSUFFICIENT],
    { column: 0 },
  );
  yield* text(h, events, renderBuffer, TEXT_INSUFFICIENT);
  yield* waitForConfirmKey(h, events);
  yield* releaseWindowAt(h, events, window);
  return false;
}
export function buildKarmaChoices(mem, category) {
  const state = karmaMenuState(mem),
    definitions = memberMenuContent(mem).karma[category].upgrades;
  state.row(0).text = TEXT_EXIT;
  state.row(0).value = 0;
  state.rowCount = 0;
  for (const [index, upgrade] of definitions.entries()) {
    const value = state.value(upgrade);
    if (!value || value >= upgrade.limit) continue;
    const row = state.row(1 + state.rowCount);
    row.text = upgrade.text;
    row.value = value;
    row.sourceIndex = index;
    state.rowCount++;
  }
  state.row(1 + state.rowCount).text = 0;
  if (state.rowCount !== state.previousRowCount) {
    state.previousRowCount = state.rowCount;
    state.selectedRow = 0;
  }
  return Array.from({ length: 1 + state.rowCount }, (_, index) => state.row(index));
}
export function* karmaList(h, events, category, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = karmaMenuState(mem),
    group = memberMenuContent(mem).karma[category];
  yield* text(h, events, renderBuffer, group.text);
  yield () => {
    state.previousRowCount = -1;
  };
  for (;;) {
    let rows;
    yield () => {
      rows = buildKarmaChoices(mem, category);
    };
    yield* clearWindowText(h, events, state.listWindow);
    const chosen = yield* chooseFromList(h, events, renderBuffer, {
      window: state.listWindow,
      column: 1,
      row: 0,
      visibleRows: KARMA_WINDOWS.listVisibleRows,
      items: rows.map((row) => row.text),
      values: rows.map((row) => row.value),
      selectedRow: state.selectedRow,
    });
    if (!chosen || chosen & WORD_SIGN) return;
    let upgrade;
    yield () => {
      state.selectedRow = chosen;
      upgrade = group.upgrades[state.row(chosen).sourceIndex];
    };
    const paid = yield* buyStep(h, events, upgrade, renderBuffer);
    if (paid && upgrade.field === 'body') {
      yield () => {
        jakeState(mem).maxHealth += 10;
        writeStateWord(mem.wram, 0, state.player);
        writeStateWord(mem.wram, 2, 10);
      };
      yield* raiseStateCountAndRedraw(h, events);
    }
    yield* karmaLine(h, events, renderBuffer);
  }
}
export function* karmaMenu(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = karmaMenuState(mem),
    content = memberMenuContent(mem),
    layout = KARMA_WINDOWS;
  yield* releaseNoticeWindowsSequence(h, events);
  yield* putGloveAwaySequence(h, events);
  yield () => memberMenuState(mem).prepareRecord(0);
  state.balanceWindow = yield* fittedWindow(h, events, {
    left: layout.left,
    top: layout.balanceTop,
    columns: layout.columns,
    rows: layout.balanceRows,
  });
  state.categoryWindow = yield* fittedWindow(
    h,
    events,
    {
      left: layout.left,
      top: layout.categoryTop,
      columns: layout.columns,
      rows: layout.categoryRows,
    },
    content.karmaCategories,
  );
  yield* karmaLine(h, events, renderBuffer);
  const detailTop = mem.language ? layout.categoryTop + layout.categoryRows + 1 : layout.headerTop,
    detailIds = [
      TEXT_EXIT,
      ...Object.values(content.karma).flatMap((group) => [
        group.text,
        ...group.upgrades.map((upgrade) => upgrade.text),
      ]),
    ];
  for (;;) {
    yield* clearWindowText(h, events, state.categoryWindow);
    const chosen = yield* chooseFromList(h, events, renderBuffer, {
      window: state.categoryWindow,
      column: 1,
      row: 0,
      visibleRows: layout.categoryVisibleRows,
      items: content.karmaCategories,
    });
    if (!chosen || chosen === WORD_MASK) break;
    state.headerWindow = yield* fittedWindow(
      h,
      events,
      {
        left: layout.detailLeft,
        top: detailTop,
        columns: layout.detailColumns,
        rows: layout.headerRows,
      },
      detailIds,
      { valueColumns: 3 },
    );
    state.listWindow = yield* fittedWindow(
      h,
      events,
      {
        left: layout.detailLeft,
        top: mem.language ? detailTop + layout.headerRows : layout.listTop,
        columns: layout.detailColumns,
        rows: layout.listRows,
      },
      detailIds,
      { valueColumns: 3 },
    );
    const category = chosen === 1 ? 'attributes' : chosen === 2 ? 'skills' : 'spells';
    yield () => writeStateWord(mem.wram, 0, state.headerWindow);
    yield* karmaList(h, events, category, renderBuffer);
    yield* releaseWindowAt(h, events, state.listWindow);
    yield* releaseWindowAt(h, events, state.headerWindow);
  }
  yield* releaseWindowAt(h, events, state.categoryWindow);
  yield* releaseWindowAt(h, events, state.balanceWindow);
  const leaderArguments = () => {
    writeStateWord(mem.wram, 0, state.player);
    writeStateWord(mem.wram, 2, BYTE_MASK);
  };
  yield leaderArguments;
  yield* raiseStateCountAndRedraw(h, events);
  yield leaderArguments;
  yield () => raiseMemberMagicPointsInPlace(h.a);
}
