import { inputLabel } from './controls.mjs';

// Menu prose and changing labels share the player's game-language choice.
export const MENU_COPY = {
  en: {
    options: 'Options',
    close: 'Close',
    tributeCredit: 'Tribute soundtrack arranged, performed and produced by Julian Daniels',
    originalSoundtrackCredit: 'Original soundtrack by Marshall Parker',
    projectGithub: 'This project on GitHub:',
    on: 'on',
    off: 'off',
    language: 'Language: English',
    crt: 'CRT picture: {state} (F9)',
    bezel: 'Monitor bezel: {state}',
    zoom: 'Window zoom: {value}%',
    soundtrackSettings: 'Soundtrack',
    soundtrackHelp:
      'Choose the original SNES music or the Tribute recordings. The volume slider adjusts Tribute music only; original music and sound effects keep their level.',
    soundtrack: 'Soundtrack: {name}',
    tribute: 'Tribute',
    original: 'Original',
    volume: 'Tribute volume:',
    bugfixes: 'Original bug fixes',
    bugfixesHelp:
      'Corrects returned companion weapons, Akimi’s arrival, Pushkin’s required conversation topic and Bulletproof Vest availability.',
    preventExploits: 'Prevent vampire farming',
    preventExploitsHelp:
      'Keeps the defeated vampire from respawning after talking to Jester, preventing repeated payouts from the same fight.',
    markers: 'Highlight objects: {state}',
    markersHelp:
      'Periodically marks usable items and devices with a small pulsing ring. People and ordinary doors stay unmarked.',
    fourSaveSlots: 'Four save slots',
    instantText: 'Instant menus and dialogs',
    instantTextHelp:
      'Draws menus and dialog windows at once instead of line by line at the speed of the original console.',
    fluidControls: 'Fluid controls',
    fluidControlsHelp:
      'The mouse keeps moving the crosshair and the spell pointer while Jake recovers from a shot, instead of the original pause.',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    debugRoom: 'Debug room',
    debugNotStarted:
      'Start a game first. The debug room is only reachable when Jake is playable and you can control him.',
    debugHelp:
      'Warps Jake into the hidden debug room. Only reachable when Jake is playable and you can control him; the invisible exit at the bottom centre leads back.',
    gameplayHelp:
      'Choose gameplay fixes before starting. Reload the page to change them during a game.',
    crtSettings: 'CRT settings',
    crtControls: 'CRT picture controls',
    brightness: 'Brightness',
    contrast: 'Contrast',
    brightnessHelp: 'Sets the black level.',
    contrastHelp: 'Sets the picture intensity.',
    defaults: 'Restore defaults',
    controls: 'Controls',
    controlExplanations: 'Explanations',
    controlsHelp:
      'Find the function you want to change, choose “change”, then press the new key or mouse button. Assigning an input removes it from its previous function. Letters count by their label. P pauses or resumes the game and cannot be reassigned.',
    change: 'change',
    unbound: 'Not bound',
    pressKey: 'Press a key …',
    saves: 'Save/load game',
    savesHelp:
      'Save at a bed or with “Save now” below. Only saved progress is kept in this browser profile; clearing browser data can erase it. Load a slot through “Start saved game” in the game’s title menu.',
    saveExportHelp:
      'Export downloads all saved slots together as Shadowrun.srm. It does not save your current position: save into a slot first. Keep the file as a backup or transfer it to another browser or computer.',
    saveImportHelp:
      'Import selects an .srm file and replaces the slots stored in this browser. A running game ends and unsaved progress is lost. Then choose “Start game”, “Start saved game” in the title menu and the slot to load. Importing alone does not continue the game.',
    saveNowHelp:
      'Save now, without a bed, while Jake can move freely. Loading starts at the entrance of the current room, as after a bed.',
    saveNow: 'Save now: game {slot}',
    slotUsed: 'used, will be overwritten',
    slotFree: 'free',
    saveExport: 'Export (.srm)',
    saveImport: 'Import (.srm)',
    recording: 'Recording',
    recordingHelp:
      'The game records all input since the start. If something goes wrong, export the recording and send it along: it replays the session exactly.',
    recordingExport: 'Export recording (.json)',
    saveEmpty: 'No save game yet. Save at a bed (“Save game”) or use “Save now” during play.',
    saveStored:
      'Stored in the browser: game {games}. “Start saved game” in the title menu loads it.',
    saveHidden:
      ' Game {games} can only be loaded with “Four save slots: on” (set it before starting).',
    saveFailed: 'The browser could not keep the save game. Please export it as .srm.',
    savedSlot: 'Saved as game {slot}.',
    saved: 'Game saved in the browser.',
    saveImported: 'Save game imported. “Start game”, then “Start saved game”.',
    importLost:
      'This .srm file has only games 1 and 2. The stored game {games} will be removed. Continue?',
    importRunning: 'The running game ends and unsaved progress is lost. Use this save game?',
    saveUnavailable:
      'Saving is only possible while Jake can move freely (no menu, dialogue, matrix or countdown).',
    debugUnavailable:
      'The debug room is only reachable when Jake is playable and you can control him (no menu or dialogue open).',
    musicPaused: 'Paused.',
    musicOriginal: 'Original music (no tribute version).',
    musicLoading: 'Loading tribute…',
    and: ' and ',
  },
  de: {
    options: 'Optionen',
    close: 'Schließen',
    tributeCredit: 'Tribute Soundtrack arrangiert, eingespielt und produziert von Julian Daniels',
    originalSoundtrackCredit: 'Originaler Soundtrack von Marshall Parker',
    projectGithub: 'Dieses Projekt auf GitHub:',
    on: 'ein',
    off: 'aus',
    language: 'Sprache: Deutsch',
    crt: 'Röhrenbild: {state} (F9)',
    bezel: 'Monitorrahmen: {state}',
    zoom: 'Fenstervergrößerung: {value} %',
    soundtrackSettings: 'Musik',
    soundtrackHelp:
      'Wähle die originale SNES-Musik oder die Tribute-Aufnahmen. Der Lautstärkeregler verändert nur die Tribute-Musik; Originalmusik und Spieleffekte behalten ihre Lautstärke.',
    soundtrack: 'Musik: {name}',
    tribute: 'Tribute',
    original: 'Original',
    volume: 'Tribute-Lautstärke:',
    bugfixes: 'Originalfehler beheben',
    bugfixesHelp:
      'Korrigiert zurückgegebene Begleiterwaffen, Akimis Ankunft, Pushkins nötiges Gesprächsthema und die Verfügbarkeit der Bulletproof Vest.',
    preventExploits: 'Vampir-Farming verhindern',
    preventExploitsHelp:
      'Verhindert, dass der besiegte Vampir nach einem Gespräch mit Jester erneut erscheint und derselbe Kampf wiederholt Geld einbringt.',
    markers: 'Objekte hervorheben: {state}',
    markersHelp:
      'Markiert benutzbare Gegenstände und Geräte regelmäßig mit einem kleinen pulsierenden Ring. Personen und normale Türen bleiben unmarkiert.',
    fourSaveSlots: 'Vier Speicherplätze',
    instantText: 'Menüs und Dialoge sofort',
    instantTextHelp:
      'Zeichnet Menüs und Dialogfenster auf einen Schlag statt Zeile für Zeile im Tempo der Originalkonsole.',
    fluidControls: 'Flüssige Steuerung',
    fluidControlsHelp:
      'Die Maus bewegt Fadenkreuz und Zauberzeiger weiter, während Jake sich von einem Schuss erholt, statt wie im Original kurz zu stocken.',
    fullscreen: 'Vollbild',
    exitFullscreen: 'Vollbild verlassen',
    debugRoom: 'Debugraum',
    debugNotStarted:
      'Starte zuerst ein Spiel. Der Debugraum ist nur erreichbar, wenn Jake spielbar ist und du ihn gerade steuern kannst.',
    debugHelp:
      'Versetzt Jake in den versteckten Debugraum. Nur erreichbar, wenn Jake spielbar ist und du ihn gerade steuern kannst; der unsichtbare Ausgang unten in der Mitte führt zurück.',
    gameplayHelp:
      'Wähle Spielkorrekturen vor dem Start. Lade die Seite neu, um sie während einer Partie zu ändern.',
    crtSettings: 'Röhrenbild-Einstellungen',
    crtControls: 'Röhrenbild anpassen',
    brightness: 'Helligkeit',
    contrast: 'Kontrast',
    brightnessHelp: 'Stellt den Schwarzwert ein.',
    contrastHelp: 'Stellt die Bildintensität ein.',
    defaults: 'Standard wiederherstellen',
    controls: 'Steuerung',
    controlExplanations: 'Erklärungen',
    controlsHelp:
      'Suche die gewünschte Funktion, wähle „ändern“ und drücke die neue Taste oder Maustaste. Die Taste wird dabei von ihrer bisherigen Funktion entfernt. Buchstaben gelten nach ihrer Beschriftung. P pausiert oder setzt das Spiel fort und kann nicht neu belegt werden.',
    change: 'ändern',
    unbound: 'Nicht belegt',
    pressKey: 'Taste drücken …',
    saves: 'Spiel speichern/laden',
    savesHelp:
      'Speichere an einem Bett oder unten mit „Jetzt speichern“. Nur gespeicherter Fortschritt bleibt in diesem Browserprofil erhalten; beim Löschen der Browserdaten kann er verloren gehen. Einen Speicherplatz lädst du im Titelmenü des Spiels über „Gesichertes Spiel starten“.',
    saveExportHelp:
      'Exportieren lädt alle gespeicherten Plätze zusammen als Shadowrun.srm herunter. Deine aktuelle Position wird dabei nicht gespeichert: Speichere vorher in einen Spielstand. Bewahre die Datei als Sicherung auf oder übertrage sie auf einen anderen Browser oder Computer.',
    saveImportHelp:
      'Importieren öffnet eine .srm-Datei und ersetzt die im Browser gespeicherten Plätze. Eine laufende Partie endet und ungespeicherter Fortschritt geht verloren. Wähle danach „Spiel starten“, im Titelmenü „Gesichertes Spiel starten“ und den gewünschten Speicherplatz. Der Import allein setzt die Partie noch nicht fort.',
    saveNowHelp:
      'Speichere sofort ohne Bett, solange Jake sich frei bewegen kann. Beim Laden beginnst du am Eingang des aktuellen Raums, wie nach dem Speichern in einem Bett.',
    saveNow: 'Jetzt speichern: Spiel {slot}',
    slotUsed: 'belegt, wird überschrieben',
    slotFree: 'frei',
    saveExport: 'Exportieren (.srm)',
    saveImport: 'Importieren (.srm)',
    recording: 'Aufzeichnung',
    recordingHelp:
      'Das Spiel zeichnet alle Eingaben seit dem Start auf. Wenn etwas schiefgeht, exportiere die Aufzeichnung und schicke sie mit: Sie gibt die Sitzung genau wieder.',
    recordingExport: 'Aufzeichnung exportieren (.json)',
    saveEmpty:
      'Noch kein Spielstand vorhanden. Speichere an einem Bett („Spiel speichern“) oder während der Partie mit „Jetzt speichern“.',
    saveStored:
      'Im Browser gespeichert: Spiel {games}. „Gesichertes Spiel starten“ im Titelmenü lädt den Spielstand.',
    saveHidden:
      ' Spiel {games} kann nur mit „Vier Speicherplätze: ein“ geladen werden (vor dem Start einstellen).',
    saveFailed:
      'Der Browser konnte den Spielstand nicht behalten. Bitte exportiere ihn als .srm-Datei.',
    savedSlot: 'Als Spiel {slot} gespeichert.',
    saved: 'Spielstand im Browser gespeichert.',
    saveImported:
      'Spielstand importiert. Wähle „Spiel starten“, dann im Titelmenü „Gesichertes Spiel starten“ und den Speicherplatz.',
    importLost:
      'Diese .srm-Datei enthält nur Spiel 1 und 2. Das gespeicherte Spiel {games} wird entfernt. Fortfahren?',
    importRunning:
      'Die laufende Partie endet und ungespeicherter Fortschritt geht verloren. Diesen Spielstand verwenden?',
    saveUnavailable:
      'Speichern ist nur möglich, solange Jake sich frei bewegen kann (ohne Menü, Dialog, Matrix oder Countdown).',
    debugUnavailable:
      'Der Debugraum ist nur erreichbar, wenn Jake spielbar ist und du ihn gerade steuern kannst (kein Menü oder Dialog geöffnet).',
    musicPaused: 'Pausiert.',
    musicOriginal: 'Originalmusik (keine Tribute-Version).',
    musicLoading: 'Tribute-Musik wird geladen…',
    and: ' und ',
  },
};

export function menuText(language, key, values = {}) {
  const copy = MENU_COPY[language] ?? MENU_COPY.en;
  return copy[key].replace(/\{(\w+)\}/g, (token, name) =>
    values[name] === undefined ? token : String(values[name]),
  );
}

export function translateMenu(root, language) {
  for (const node of root.querySelectorAll('[data-menu-text]'))
    node.textContent = menuText(language, node.dataset.menuText);
  for (const node of root.querySelectorAll('[data-menu-title]'))
    node.title = menuText(language, node.dataset.menuTitle);
  for (const node of root.querySelectorAll('[data-menu-label]'))
    node.setAttribute('aria-label', menuText(language, node.dataset.menuLabel));
}

const ACTION_NAMES = {
  en: {
    B: 'Action glove / Confirm',
    Y: 'Items',
    Select: 'Party status / Back',
    Start: 'Character status',
    Up: 'Move up',
    Down: 'Move down',
    Left: 'Move left',
    Right: 'Move right',
    A: 'Aim / Shoot',
    X: 'Cast spells',
    L: 'Examine',
    R: 'Open / Use',
    Back: 'Cancel / Back',
  },
  de: {
    B: 'Aktionshand / Bestätigen',
    Y: 'Gegenstände',
    Select: 'Gruppenstatus / Zurück',
    Start: 'Charakterstatus',
    Up: 'Nach oben',
    Down: 'Nach unten',
    Left: 'Nach links',
    Right: 'Nach rechts',
    A: 'Zielen / Schießen',
    X: 'Zaubern',
    L: 'Untersuchen',
    R: 'Öffnen / Benutzen',
    Back: 'Abbrechen / Zurück',
  },
};
const INPUT_NAMES = {
  'mouse:0': 'Linke Maustaste',
  'mouse:1': 'Mittlere Maustaste',
  'mouse:2': 'Rechte Maustaste',
  'mouse:3': 'Maustaste 4',
  'mouse:4': 'Maustaste 5',
  'code:Space': 'Leertaste',
  'code:ShiftLeft': 'Linke Umschalttaste',
  'code:ShiftRight': 'Rechte Umschalttaste',
  'code:ControlLeft': 'Linke Strg-Taste',
  'code:ControlRight': 'Rechte Strg-Taste',
  'code:Backspace': 'Rücktaste',
};
export const controlName = (language, name) => (ACTION_NAMES[language] ?? ACTION_NAMES.en)[name];
export const controlInputLabel = (language, input) =>
  language === 'de' ? (INPUT_NAMES[input] ?? inputLabel(input)) : inputLabel(input);
