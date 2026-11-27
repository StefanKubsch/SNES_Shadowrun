// The dialogs as readable records (docs/READABLE-GAME.md, phase 1). The game code asks for
// a dialog by its number and gets its portrait, music and entries; it never reads the
// stored layout. Until the content is loaded from the assets directly (phase 4), the
// records are built once per game memory with the readers of the data modules.
//
// A dialog: the partner's portrait (an index into PORTRAITS), the music to play (or
// none), whether the partner's portrait is mirrored, and its entries in their stored
// order. An entry answers a key (greeting, talk, fallback or a topic number), adds topics
// to the list of known topics, may start a script, and shows a text. Texts are text ids
// that only the text printer reads.
import { readDialogs } from '../data/dialogs.mjs';
import { readPortraits } from '../data/portraits.mjs';
import { readTables } from '../data/tables.mjs';
import { readTopics } from '../data/topics.mjs';
import { textPointerWord } from '../data/rom-bytes.mjs';

// The keys of the entries that are no topic number.
export const GREETING = 'greeting',
  TALK = 'talk',
  FALLBACK = 'fallback';

const cache = new WeakMap();
// A text label of the data modules as the text id the printer takes.
const textId = (label) => {
  if (!label) return 0;
  const [bank, offset] = label.split(':');
  return textPointerWord(bank, offset);
};

function build(mem) {
  const read8 = (at) => mem.read8(at);
  const portraits = readPortraits(read8);
  const portraitIndex = new Map(portraits.map((p, n) => [p.address, n]));
  const dialogs = [];
  for (const d of readDialogs(read8))
    dialogs[d.dialog] = Object.freeze({
      portrait: portraitIndex.get(d.portrait),
      music: d.music,
      mirror: d.mirror,
      entries: Object.freeze(
        d.entries.map((e) =>
          Object.freeze({
            key: e.key,
            topics: Object.freeze([...e.topics]),
            script: e.script ?? null,
            text: textId(e.text),
          }),
        ),
      ),
    });
  const tables = Object.fromEntries(readTables(read8).map((t) => [t.name, t.values]));
  return Object.freeze({
    dialogs: Object.freeze(dialogs),
    portraits: Object.freeze(portraits),
    // The music of the music numbers 1 and up.
    music: Object.freeze(tables.dialog_music),
    // Exit, Talk, Ask about.
    menu: Object.freeze(tables.dialog_menu_items.filter(Boolean).map(textId)),
    // The name of each topic.
    topicNames: Object.freeze(readTopics(read8).map(textId)),
  });
}

// The dialog content of a game's memory.
export function dialogContent(mem) {
  let content = cache.get(mem);
  if (!content) cache.set(mem, (content = build(mem)));
  return content;
}
