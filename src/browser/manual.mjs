import { BINDABLE } from './controls.mjs';
import { createOverlayDialog } from './overlay-dialog.mjs';
import { CONTROL_ACTIONS, controlBindingLabel, resolveControlText } from './control-help.mjs';
import {
  MANUAL_ARTICLES,
  MANUAL_CHAPTERS,
  MANUAL_EQUIPMENT,
  MANUAL_SPELLS,
  manualMatches,
} from './manual-data.mjs';

const COPY = {
  en: {
    title: 'Handbook',
    search: 'Search the handbook',
    placeholder: 'Weapon, spell or topic …',
    all: 'Overview',
    chapters: 'Chapters',
    intro: 'Your guide to the shadows',
    scope:
      'Explore Seattle with guides to controls, actions, character, inventory, equipment, combat, magic, skills, recovery, Karma, dialogue and the Matrix.',
    paused: 'The game waits while you read.',
    weapon: 'Weapons',
    armor: 'Armor',
    strength: 'Required Strength',
    name: 'Name',
    tableNote:
      'Original English item names. Strength is the requirement to equip an item, not its damage or protection.',
    spell: 'Spell reference',
    results: 'Results',
    empty: 'No results. Try an English item name or another term.',
    binding: 'Your binding',
    action: 'Function / situation',
    pause: 'Pause',
    pauseAction: 'Pause or resume the game (fixed key).',
  },
  de: {
    title: 'Handbuch',
    search: 'Handbuch durchsuchen',
    placeholder: 'Waffe, Zauber oder Thema …',
    all: 'Übersicht',
    chapters: 'Kapitel',
    intro: 'Dein Wegweiser durch die Schatten',
    scope:
      'Erkunde Seattle mit Hilfen zu Steuerung, Aktionen, Charakter, Inventar, Ausrüstung, Kampf, Magie, Fertigkeiten, Erholung, Karma, Dialogen und Matrix.',
    paused: 'Das Spiel wartet, während du liest.',
    weapon: 'Waffen',
    armor: 'Rüstungen',
    strength: 'Benötigte Stärke',
    name: 'Name',
    tableNote:
      'Englische Originalnamen der Gegenstände. Stärke ist die Voraussetzung zum Ausrüsten, kein Schadens- oder Schutzwert.',
    spell: 'Zauberübersicht',
    results: 'Treffer',
    empty: 'Keine Treffer. Versuche einen englischen Gegenstandsnamen oder einen anderen Begriff.',
    binding: 'Deine Belegung',
    action: 'Funktion / Spielsituation',
    pause: 'Pause',
    pauseAction: 'Spiel pausieren oder fortsetzen (feste Taste).',
  },
};

// Activate a chapter as its start reaches the reading area's upper edge.
const SECTION_ACTIVATION_OFFSET = 24;
const SCROLL_EDGE_TOLERANCE = 1;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// A native modal keeps focus and input inside the guide. It belongs to the
// fullscreen frame, so opening it never requires leaving fullscreen.
export function createManual({ frame, opener, returnFocus, getBindings, onOpen, onClose }) {
  const layout = element('div'),
    searchLabel = element('label', null, 'screen-reader-only'),
    search = element('input'),
    nav = element('nav', null, 'manual-nav'),
    content = element('div', null, 'manual-content'),
    result = element('p', null, 'manual-results'),
    scroll = element('div', null, 'manual-scroll'),
    body = element('div', null, 'manual-body');
  let language = 'en',
    chapter = 'all';
  search.id = 'manual-search';
  search.type = 'search';
  searchLabel.htmlFor = search.id;
  result.setAttribute('role', 'status');
  scroll.append(result, content);
  body.append(nav, scroll);
  layout.append(searchLabel, search, body);
  const overlay = createOverlayDialog({
    id: 'manual',
    titles: { en: COPY.en.title, de: COPY.de.title },
    frame,
    opener,
    returnFocus,
    content: layout,
    contentClass: 'manual-layout',
    onOpen,
    onClose,
  });

  function article(entry) {
    const bindings = getBindings();
    const node = element('article', null, 'overlay-card');
    node.dataset.entry = entry.id;
    node.append(
      element(
        'h3',
        resolveControlText(
          entry.name ? `${entry.name} · ${entry.title[language]}` : entry.title[language],
          bindings,
          language,
        ),
      ),
    );
    node.append(element('p', resolveControlText(entry.text[language], bindings, language)));
    if (entry.bindings) {
      const copy = COPY[language];
      const rows = BINDABLE.map((name) => [
        CONTROL_ACTIONS[name][language],
        controlBindingLabel(bindings, language, name),
      ]);
      rows.push([copy.pauseAction, 'P']);
      node.append(table([copy.action, copy.binding], rows));
    }
    return node;
  }

  function table(headings, rows) {
    const node = element('table'),
      head = element('thead'),
      body = element('tbody'),
      heading = element('tr');
    for (const text of headings) {
      const cell = element('th', text);
      cell.scope = 'col';
      heading.append(cell);
    }
    head.append(heading);
    for (const values of rows) {
      const row = element('tr');
      for (const value of values) row.append(element('td', String(value)));
      body.append(row);
    }
    node.append(head, body);
    return node;
  }

  function renderContent() {
    const copy = COPY[language],
      query = search.value.trim();
    const bindings = getBindings();
    const matches = (entry) =>
      manualMatches(
        entry,
        query,
        ['en', 'de']
          .map((code) =>
            resolveControlText(
              `${entry.title?.[code] ?? ''} ${entry.text?.[code] ?? ''}`,
              bindings,
              code,
            ),
          )
          .join(' '),
      );
    content.replaceChildren();
    if (!query) {
      const welcome = element('section', null, 'manual-welcome');
      welcome.dataset.chapter = 'all';
      welcome.append(
        element('h3', copy.intro),
        element('p', copy.scope),
        element('p', copy.paused),
      );
      content.append(welcome);
    }
    let count = 0;
    for (const group of MANUAL_CHAPTERS) {
      const section = element('section', null, 'manual-chapter');
      section.dataset.chapter = group.id;
      section.append(element('h2', group.title[language]));
      for (const entry of MANUAL_ARTICLES.filter(
        (entry) => entry.chapter === group.id && matches(entry),
      )) {
        section.append(article(entry));
        count++;
      }
      if (group.id === 'equipment') {
        for (const category of ['weapon', 'armor']) {
          const items = MANUAL_EQUIPMENT.filter(
            (item) => item.category === category && matches(item),
          );
          if (!items.length) continue;
          const card = element('article', null, 'overlay-card');
          card.dataset.category = category;
          card.append(element('h3', copy[category]), element('p', copy.tableNote));
          card.append(
            table(
              [copy.name, copy.strength],
              items.map((item) => [item.name, item.requiredStrength]),
            ),
          );
          section.append(card);
          count += items.length;
        }
      }
      if (group.id === 'magic') {
        const spells = MANUAL_SPELLS.filter(matches);
        if (spells.length) section.append(element('h3', copy.spell));
        for (const spell of spells) section.append(article(spell));
        count += spells.length;
      }
      if (section.children.length > 1) content.append(section);
    }
    result.textContent = query ? `${copy.results}: ${count}` : '';
    if (!count) content.append(element('p', copy.empty, 'manual-empty'));
    scroll.scrollTop = 0;
    syncNavigation();
  }

  function syncNavigation() {
    if (!overlay.isOpen) return;
    const sections = [...content.querySelectorAll(':scope > section[data-chapter]')];
    const edge = scroll.getBoundingClientRect().top + SECTION_ACTIVATION_OFFSET;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top > edge) break;
      current = section;
    }
    // The last chapter can be too short to reach the upper activation edge.
    if (
      scroll.scrollTop > 0 &&
      scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - SCROLL_EDGE_TOLERANCE
    )
      current = sections.at(-1);
    chapter = current?.dataset.chapter ?? null;
    for (const button of nav.querySelectorAll('button')) {
      const active = button.dataset.chapter === chapter;
      button.setAttribute('aria-pressed', String(active));
      if (active) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
      if (active) {
        const bounds = button.getBoundingClientRect(),
          sidebar = nav.getBoundingClientRect();
        if (bounds.top < sidebar.top) nav.scrollTop += bounds.top - sidebar.top;
        else if (bounds.bottom > sidebar.bottom) nav.scrollTop += bounds.bottom - sidebar.bottom;
      }
    }
  }

  function goToChapter(id) {
    search.value = '';
    renderContent();
    const section = content.querySelector(`[data-chapter="${id}"]`);
    if (section)
      scroll.scrollTop += section.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    syncNavigation();
  }

  function render() {
    const copy = COPY[language];
    overlay.setLanguage(language);
    searchLabel.textContent = copy.search;
    search.placeholder = copy.placeholder;
    nav.setAttribute('aria-label', copy.chapters);
    nav.replaceChildren();
    for (const item of [{ id: 'all', title: { [language]: copy.all } }, ...MANUAL_CHAPTERS]) {
      const button = element('button', item.title[language]);
      button.type = 'button';
      button.dataset.chapter = item.id;
      button.setAttribute('aria-pressed', String(chapter === item.id));
      button.addEventListener('click', () => goToChapter(item.id));
      nav.append(button);
    }
    renderContent();
  }

  search.addEventListener('input', renderContent);
  scroll.addEventListener('scroll', syncNavigation, { passive: true });
  new ResizeObserver(syncNavigation).observe(scroll);
  return {
    get isOpen() {
      return overlay.isOpen;
    },
    setLanguage(code) {
      language = code === 'de' ? 'de' : 'en';
      overlay.setLanguage(language);
      if (overlay.isOpen) render();
    },
    open() {
      if (overlay.isOpen) return;
      render();
      overlay.open();
      syncNavigation();
    },
  };
}
