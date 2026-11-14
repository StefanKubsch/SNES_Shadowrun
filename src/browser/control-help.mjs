import { controlInputLabel } from './ui-language.mjs';

export const CONTROL_MOUSE_HELP = {
  en: 'Move the mouse over the picture to position the glove or crosshair. Examine with {L}; open or use with {R}. If the right mouse button is assigned to Open / Use, it uses the target or opens its action list. In menus, the mouse wheel moves the selection and left click confirms; right click goes back after play begins. When aiming a weapon or spell, left click activates it and right click closes the pointer. These menu and aiming clicks are fixed, even if you reassign the mouse buttons. A standard gamepad works without setup.',
  de: 'Bewege die Maus über das Bild, um Hand oder Fadenkreuz zu positionieren. Mit {L} untersuchst du, mit {R} öffnest oder benutzt du. Ist die rechte Maustaste mit Öffnen / Benutzen belegt, benutzt sie das Ziel oder öffnet seine Aktionsliste. In Menüs bewegt das Mausrad die Auswahl und links bestätigt; rechts geht nach Spielbeginn zurück. Beim Zielen mit Waffe oder Zauber löst links die Aktion aus und rechts schließt den Zeiger. Diese Menü- und Zielklicks sind fest, auch wenn du Maustasten neu belegst. Ein Standard-Gamepad funktioniert ohne Einrichtung.',
};

// SNES functions follow the handbook; browser exceptions follow mouse-control.mjs.
export const CONTROL_ACTIONS = {
  B: {
    en: 'Open the action glove / action list; confirm a choice or target. Matrix: attack IC or a CPU.',
    de: 'Aktionshand / Aktionsliste öffnen; Auswahl oder Ziel bestätigen. Matrix: IC oder CPU angreifen.',
  },
  Y: { en: 'Open the item inventory.', de: 'Gegenstandsinventar öffnen.' },
  Select: {
    en: 'Show party status in free play; leave the status screen or go back in menus.',
    de: 'Im freien Spiel Gruppenstatus zeigen; Statusbildschirm verlassen oder in Menüs zurückgehen.',
  },
  Start: {
    en: 'Open Jake’s status; select a status inventory; confirm a Karma improvement. Title menu: start a new game.',
    de: 'Jakes Status öffnen; Statusinventar wählen; Karmasteigerung bestätigen. Titelmenü: neues Spiel starten.',
  },
  Up: {
    en: 'Move up; move the pointer or menu selection up.',
    de: 'Nach oben bewegen; Zeiger oder Menüauswahl nach oben bewegen.',
  },
  Down: {
    en: 'Move down; move the pointer or menu selection down.',
    de: 'Nach unten bewegen; Zeiger oder Menüauswahl nach unten bewegen.',
  },
  Left: {
    en: 'Move left; move the pointer or menu selection left.',
    de: 'Nach links bewegen; Zeiger oder Menüauswahl nach links bewegen.',
  },
  Right: {
    en: 'Move right; move the pointer or menu selection right.',
    de: 'Nach rechts bewegen; Zeiger oder Menüauswahl nach rechts bewegen.',
  },
  A: {
    en: 'Open the weapon crosshair; press again to fire at the selected target. Matrix: download from a datastore.',
    de: 'Waffenfadenkreuz öffnen; erneut drücken, um auf das gewählte Ziel zu schießen. Matrix: Datenspeicher herunterladen.',
  },
  X: {
    en: 'Open the spell glove; press again to cast the selected spell. Dismiss No Spell Selected. Matrix: jack out.',
    de: 'Zauberhand öffnen; erneut drücken, um den gewählten Zauber zu wirken. No Spell Selected schließen. Matrix: ausloggen.',
  },
  L: {
    en: 'Examine a target. Keyword list: previous page.',
    de: 'Ziel untersuchen. Schlüsselwortliste: vorherige Seite.',
  },
  R: {
    en: 'Open a door / use a target. Keyword list: next page.',
    de: 'Tür öffnen / Ziel benutzen. Schlüsselwortliste: nächste Seite.',
  },
  Back: {
    en: 'Close the glove or crosshair in free play; go back in menus after play begins. No effect at the title menu.',
    de: 'Im freien Spiel Hand oder Fadenkreuz schließen; nach Spielbeginn in Menüs zurückgehen. Im Titelmenü ohne Wirkung.',
  },
};

export function controlBindingLabel(bindings, language, name) {
  return (
    bindings[name]
      .map((input) => controlInputLabel(language, input))
      .join(language === 'de' ? ' oder ' : ' or ') ||
    (language === 'de' ? 'Nicht belegt' : 'Not bound')
  );
}

// Explicit tokens avoid changing ordinary English articles or Control Type A/B.
export function resolveControlText(text, bindings, language) {
  return text.replace(/\{(\w+)\}/g, (token, name) => {
    if (!(name in CONTROL_ACTIONS)) return token;
    return controlBindingLabel(bindings, language, name);
  });
}
