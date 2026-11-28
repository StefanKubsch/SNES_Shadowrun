// The selected runner's spells, with their level names and scripts. Jake chooses
// a spell for later casting; another runner can execute its script immediately.
import { memberMenuState } from '../state/member-menu.mjs';
import { memberSpellState } from '../state/member-spells.mjs';
import { memberMenuContent } from '../content/member-menus.mjs';
import { findRunnerIndex } from '../content/runners.mjs';
import { objectWord, readStateWord, writeStateWord } from '../state/objects.mjs';
import { scriptVisitSequence } from '../system/script-visit.mjs';
import { appendScript } from '../script/task-api.mjs';
import { openWindowAt } from './window-open.mjs';
import { chooseFromList } from './menu-choice.mjs';
import { releaseWindowAt, releaseNoticeWindowsSequence } from './window-release.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { resetWindowList } from './window-list.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { SPELL_WINDOW } from '../data/native-member-spell-menu.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

export const STATUS_ENTRY = 0x80e68e;
const MENU_ENTRY = 0x80e693;
export function buildMemberSpellChoices(mem) {
  const spells = memberSpellState(mem),
    content = memberMenuContent(mem),
    items = [TEXT_EXIT];
  spells.choice(0).text = TEXT_EXIT;
  for (const [index, definition] of content.spells.entries()) {
    const level = spells.level(index);
    if (!level) continue;
    const choice = spells.choice(items.length);
    choice.text = content.spellLevelName(index, level, spells.addressCarry(index));
    choice.name = definition.name;
    choice.script = definition.script;
    choice.leaderScript = definition.leaderScript;
    choice.spell = index;
    choice.level = level;
    items.push(choice.text);
  }
  spells.choice(items.length).text = 0;
  return items;
}
function* afterScriptSequence(h, events) {
  const state = memberMenuState(h.a.mem);
  if (state.endWord) return;
  if (state.redrawPortrait) {
    yield* resetWindowList(h, events);
    yield* memberPortrait(h, events);
  }
  if (state.hasNotices) {
    yield* waitForConfirmKey(h, events);
    yield* releaseNoticeWindowsSequence(h, events);
  }
}
export function* spellMenu(h, events, entry = MENU_ENTRY, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = memberMenuState(mem),
    spells = memberSpellState(mem);
  let known;
  yield () => {
    state.runSpell = entry === STATUS_ENTRY ? 0 : WORD_MASK;
    known = memberMenuContent(mem).spells.filter((_, index) => spells.level(index)).length;
  };
  if (known) {
    const ids = [TEXT_EXIT];
    for (let index = 0; index < 6; index++) {
      const level = spells.level(index);
      if (level) ids.push(memberMenuContent(mem).spellLevelName(index, level));
    }
    const shape = mem.language ? translatedListWindow(mem, SPELL_WINDOW, ids) : SPELL_WINDOW;
    state.submenuWindow = yield* openWindowAt(h, events, [
      shape.left,
      shape.top,
      shape.columns,
      known + SPELL_WINDOW.extraRows,
    ]);
    let items;
    yield () => {
      items = buildMemberSpellChoices(mem);
    };
    const chosen = yield* chooseFromList(h, events, renderBuffer, {
      window: state.submenuWindow,
      column: 1,
      row: 0,
      visibleRows: SPELL_WINDOW.visibleRows,
      items,
    });
    let script = false,
      spellScript;
    yield () => {
      if (chosen === 0) return;
      if (chosen & WORD_SIGN) {
        state.endWord = chosen;
        return;
      }
      const choice = spells.choice(chosen);
      spellScript = choice.script;
      writeStateWord(mem.wram, 0, choice.level);
      if (state.object === state.player) {
        spells.select(chosen);
        return;
      }
      script = state.runSpell !== 0;
    };
    if (script) {
      yield () => appendScript(h.a, spellScript);
      yield () => {
        state.redrawPortrait = 0;
      };
      yield* scriptVisitSequence(events);
      yield* afterScriptSequence(h, events);
    }
    yield* releaseWindowAt(h, events, state.submenuWindow);
  }
  if (state.runSpell === 0) yield* equipmentRows(h, events, renderBuffer);
}
export function* openSpellMenuSequence(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = memberMenuState(mem);
  yield () => {
    state.active = WORD_MASK;
    state.object = readStateWord(mem.wram, 0);
    state.number = objectWord(mem, 'number', state.object);
    state.runnerIndex = findRunnerIndex(mem, state.number);
    state.recordPosition = 6;
    state.endWord = 0;
  };
  yield* spellMenu(h, events, MENU_ENTRY, renderBuffer);
  yield () => {
    state.active = 0;
  };
}
