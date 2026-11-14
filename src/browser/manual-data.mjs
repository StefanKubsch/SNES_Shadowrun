// Editorial guide based on the US manual. Source transcription and limits:
// docs/MANUAL.md and its source records. These data never drive gameplay.
import { MANUAL_EXTRA_ARTICLES, MANUAL_EXTRA_SOURCES } from './manual-content.mjs';
import { CONTROL_MOUSE_HELP } from './control-help.mjs';
const SOURCE_DOCUMENT = 'shadowrun-snes-us-manual';
export const MANUAL_SOURCES = {
  ...MANUAL_EXTRA_SOURCES,
  controls: { document: SOURCE_DOCUMENT, pdfPage: 6, manualPage: 4 },
  equipment: { document: SOURCE_DOCUMENT, pdfPage: 18, manualPage: 16 },
  equipmentTable: { document: SOURCE_DOCUMENT, pdfPage: 19, manualPage: 17 },
  casting: { document: SOURCE_DOCUMENT, pdfPage: 25, manualPage: 23 },
  spells: { document: SOURCE_DOCUMENT, pdfPage: 26, manualPage: 24 },
};

export const MANUAL_CHAPTERS = [
  { id: 'getting-started', title: { en: 'Getting started', de: 'Spielbeginn' } },
  { id: 'controls', title: { en: 'Controls', de: 'Steuerung' } },
  { id: 'interface', title: { en: 'Exploring & actions', de: 'Erkunden & Aktionen' } },
  { id: 'character', title: { en: 'Character', de: 'Charakter' } },
  { id: 'inventory', title: { en: 'Inventory', de: 'Inventar' } },
  { id: 'equipment', title: { en: 'Weapons & armor', de: 'Waffen & Rüstungen' } },
  { id: 'combat', title: { en: 'Combat & runners', de: 'Kampf & Begleiter' } },
  { id: 'magic', title: { en: 'Magic', de: 'Magie' } },
  { id: 'skills', title: { en: 'Skills', de: 'Fertigkeiten' } },
  { id: 'recovery', title: { en: 'Rest & saving', de: 'Erholung & Speichern' } },
  { id: 'karma', title: { en: 'Karma', de: 'Karma' } },
  { id: 'dialogue', title: { en: 'Dialogue & Vidphone', de: 'Dialoge & Vidphone' } },
  { id: 'matrix', title: { en: 'Matrix', de: 'Matrix' } },
];

export const MANUAL_ARTICLES = [
  ...MANUAL_EXTRA_ARTICLES,
  {
    id: 'browser-controls',
    chapter: 'controls',
    browser: true,
    title: { en: 'Playing in the browser', de: 'Spielen im Browser' },
    text: CONTROL_MOUSE_HELP,
  },
  {
    id: 'current-bindings',
    chapter: 'controls',
    browser: true,
    bindings: true,
    title: { en: 'Your current bindings', de: 'Deine aktuelle Tastenbelegung' },
    text: {
      en: 'These are your current bindings from Options → Controls. “Or” means that either input works. An unbound function needs a binding before you can use it with the keyboard or mouse. The game waits while you read.',
      de: 'Hier siehst du deine aktuelle Belegung aus Optionen → Steuerung. „Oder“ bedeutet, dass jede der genannten Tasten funktioniert. Für eine nicht belegte Funktion musst du zuerst eine Taste zuweisen, um sie mit Tastatur oder Maus zu nutzen. Das Spiel wartet beim Lesen.',
    },
  },
  {
    id: 'snes-controls',
    chapter: 'controls',
    source: MANUAL_SOURCES.controls,
    title: { en: 'Movement and actions', de: 'Bewegung und Aktionen' },
    text: {
      en: 'Movement controls move Jake, position the glove or crosshair and navigate menus. Their movement in the isometric scene depends on the in-game Control Type setting. A function can change with the situation: firing and downloading use the same input, for example. Each chapter explains what to press for that action.',
      de: 'Die Richtungstasten bewegen Jake, positionieren Hand oder Fadenkreuz und navigieren durch Menüs. Die Bewegung in der isometrischen Szene hängt vom Steuerungstyp im Spiel ab. Eine Taste kann je nach Situation etwas anderes tun: Schießen und Herunterladen verwenden zum Beispiel dieselbe Taste. Im jeweiligen Kapitel steht, was du für die Aktion drücken musst.',
    },
  },
  {
    id: 'equipping',
    chapter: 'equipment',
    source: MANUAL_SOURCES.equipment,
    title: { en: 'Equip before using', de: 'Vor der Benutzung ausrüsten' },
    text: {
      en: 'Choose a weapon or armor in the corresponding status-screen inventory. It replaces the previously equipped item. Carrying an item does not mean you can use it: Jake must meet its Strength requirement. The values below are required Strength, not damage or protection ratings.',
      de: 'Wähle eine Waffe oder Rüstung im entsprechenden Inventar des Statusbildschirms. Sie ersetzt den zuvor ausgerüsteten Gegenstand. Tragen allein reicht nicht zum Benutzen: Jake muss die nötige Stärke besitzen. Die Werte unten sind Stärkevoraussetzungen, keine Schadens- oder Schutzwerte.',
    },
  },
  {
    id: 'firing',
    chapter: 'equipment',
    source: MANUAL_SOURCES.equipment,
    title: { en: 'Aim and fire', de: 'Zielen und schießen' },
    text: {
      en: 'Use {A} to bring up the crosshair, move it onto an enemy until their label appears, then fire. Weapons have unlimited ammunition, except grenades. In this browser version, the mouse positions the crosshair and left click fires.',
      de: 'Öffne mit {A} das Fadenkreuz und bewege es auf einen Gegner, bis dessen Bezeichnung erscheint. Dann kannst du feuern. Waffen haben unbegrenzte Munition; Granaten sind die Ausnahme. In dieser Browserversion positioniert die Maus das Fadenkreuz und ein Linksklick feuert.',
    },
  },
  {
    id: 'learning-magic',
    chapter: 'magic',
    source: MANUAL_SOURCES.casting,
    title: { en: 'Learn and cast spells', de: 'Zauber lernen und wirken' },
    text: {
      en: 'Jake starts without magic. Follow your spirit guide, collect the required talismans and return to learn a spell. The magic inventory lists each learned spell, its level and its spell-point cost. Karma raises spell levels. Use {X} to open the spell glove, select a target and press {X} again to cast. You need enough spell points; protective magic can target you or a party member.',
      de: 'Jake beginnt ohne Magie. Folge deinem Geistführer, sammle die benötigten Talismane und kehre zurück, um einen Zauber zu lernen. Das Magieinventar zeigt gelernte Zauber, ihre Stufe und ihre Kosten in Zauberpunkten. Mit Karma steigerst du die Zauberstufen. {X} öffnet die Zauberhand; wähle ein Ziel und drücke erneut {X}. Du brauchst genügend Zauberpunkte. Schutzmagie kann dich oder ein Gruppenmitglied als Ziel haben.',
    },
  },
  {
    id: 'combining-magic',
    chapter: 'magic',
    source: MANUAL_SOURCES.spells,
    title: { en: 'Combine your spells', de: 'Zauber kombinieren' },
    text: {
      en: 'Offensive spells can only target enemies. Freeze can hold an enemy while you attack with Powerball or a weapon. Invisibility prevents enemies from tracking you, but does not prevent every hit.',
      de: 'Offensive Zauber können nur Gegner treffen. Freeze kann einen Gegner festhalten, während du ihn mit Powerball oder einer Waffe angreifst. Invisibility verhindert, dass Gegner dich verfolgen; getroffen werden kannst du trotzdem.',
    },
  },
];

// Names and requirements retain the printed table, including its separate
// "Pistol" row and unusual "AS&" label. Do not silently substitute ROM names.
export const MANUAL_EQUIPMENT = [
  { id: 'zip-gun', name: 'Zip Gun', category: 'weapon', requiredStrength: 1 },
  { id: 'beretta-101t', name: 'Beretta 101T Pistol', category: 'weapon', requiredStrength: 1 },
  { id: 'colt-american-l36', name: 'Colt American L36', category: 'weapon', requiredStrength: 1 },
  { id: 'pistol', name: 'Pistol', category: 'weapon', requiredStrength: 1 },
  { id: 'grenade', name: 'Grenade', category: 'weapon', requiredStrength: 1 },
  { id: 'ares-viper', name: 'Ares Viper Heavy Pistol', category: 'weapon', requiredStrength: 2 },
  { id: 'fichetti', name: 'Fichetti Light Pistol', category: 'weapon', requiredStrength: 3 },
  { id: 'uzi-iii', name: 'Uzi III SMG', category: 'weapon', requiredStrength: 4 },
  { id: 'defiance', name: 'Defiance T~250 Shotgun', category: 'weapon', requiredStrength: 4 },
  { id: 'ruger-warhawk', name: 'Ruger Warhawk Pistol', category: 'weapon', requiredStrength: 4 },
  { id: 'hk227', name: 'HK227 Assault Rifle', category: 'weapon', requiredStrength: 5 },
  { id: 'assault-cannon', name: 'AS& Assault Cannon', category: 'weapon', requiredStrength: 6 },
  { id: 'leather-jacket', name: 'Leather Jacket', category: 'armor', requiredStrength: 1 },
  { id: 'mesh-jacket', name: 'Mesh Jacket', category: 'armor', requiredStrength: 2 },
  { id: 'bullet-proof-vest', name: 'Bullet Proof Vest', category: 'armor', requiredStrength: 3 },
  { id: 'full-concealable', name: 'Full Concealable', category: 'armor', requiredStrength: 4 },
  { id: 'partial-body-suit', name: 'Partial Body Suit', category: 'armor', requiredStrength: 5 },
  { id: 'full-body-suit', name: 'Full Body Suit', category: 'armor', requiredStrength: 6 },
].map((item) => ({ ...item, source: MANUAL_SOURCES.equipmentTable }));

export const MANUAL_SPELLS = [
  {
    id: 'heal',
    name: 'Heal',
    title: { en: 'Healing', de: 'Heilung' },
    text: {
      en: 'Restores 5 Stamina points per spell level.',
      de: 'Stellt pro Zauberstufe 5 Stamina-Punkte wieder her.',
    },
  },
  {
    id: 'armor',
    name: 'Armor',
    title: { en: 'Protection', de: 'Schutz' },
    text: {
      en: 'Protects against damage. Protection and duration depend on the spell level. Up to four Armor spells can be active at once.',
      de: 'Schützt vor Schaden. Schutz und Dauer hängen von der Zauberstufe ab. Bis zu vier Armor-Zauber können gleichzeitig aktiv sein.',
    },
  },
  {
    id: 'invisibility',
    name: 'Invisibility',
    title: { en: 'Invisibility', de: 'Unsichtbarkeit' },
    text: {
      en: 'Stops enemies from tracking you, although you can still be hit. Duration depends on the spell level.',
      de: 'Verhindert, dass Gegner dich verfolgen. Du kannst trotzdem getroffen werden. Die Dauer hängt von der Zauberstufe ab.',
    },
  },
  {
    id: 'powerball',
    name: 'Powerball',
    title: { en: 'Offensive magic', de: 'Angriffsmagie' },
    text: {
      en: 'A magical attack whose strength depends on the spell level.',
      de: 'Ein magischer Angriff, dessen Stärke von der Zauberstufe abhängt.',
    },
  },
  {
    id: 'summon-spirit',
    name: 'Summon Spirit',
    title: { en: 'Spirit ally', de: 'Geist beschwören' },
    text: {
      en: 'Summons a servant of your spirit guide to attack every enemy on screen. Attack strength depends on the spell level. No individual target is needed; only one Summon Spirit can be active at once.',
      de: 'Ruft einen Diener deines Geistführers, der alle Gegner auf dem Bildschirm angreift. Die Angriffsstärke hängt von der Zauberstufe ab. Ein einzelnes Ziel ist nicht nötig; nur ein Summon Spirit kann gleichzeitig aktiv sein.',
    },
  },
  {
    id: 'freeze',
    name: 'Freeze',
    title: { en: 'Freeze an enemy', de: 'Gegner einfrieren' },
    text: {
      en: 'Traps an enemy in ice. Duration depends on the spell level. Up to four Freeze spells can be active at once.',
      de: 'Schließt einen Gegner in Eis ein. Die Dauer hängt von der Zauberstufe ab. Bis zu vier Freeze-Zauber können gleichzeitig aktiv sein.',
    },
  },
].map((spell) => ({ ...spell, chapter: 'magic', source: MANUAL_SOURCES.spells }));

export function manualMatches(entry, query, currentControls = '') {
  // Both languages and the original names remain searchable in either UI language.
  const normalize = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const text = normalize(
    [
      entry.name,
      ...Object.values(entry.title ?? {}),
      ...Object.values(entry.text ?? {}),
      currentControls,
    ].join(' '),
  );
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
