import { createOverlayDialog } from './overlay-dialog.mjs';
import { CHEAT } from '../game/cheat-settings.mjs';

const COPY = {
  en: {
    title: 'Cheats',
    on: 'On',
    off: 'Off',
    intro: 'Choose your advantages',
    help: 'Changes apply when you return to the game. All switches start off when you reload the page. Money, attributes and spells gained through cheats remain in saved games; switching a cheat off does not undo them.',
    health: [
      'Unlimited health for Jake',
      'Keeps Jake at full Stamina and prevents lethal damage, including in the Matrix. Companions are unaffected.',
    ],
    money: ['Unlimited money', 'Refills your credstick to its maximum of 4,294,967,295 nuyen.'],
    stats: [
      'Maximize Jake’s attributes and skills',
      'Body and Magic 20, Strength and Charisma 6, Firearms 16 and all other skills 6. Spells have their own switch.',
    ],
    spells: [
      'Unlock and maximize all spells',
      'Unlocks all six spells at level 6, raises Magic to 20 and fills spell points when these values increase. Casting still spends spell points.',
    ],
  },
  de: {
    title: 'Cheats',
    on: 'Ein',
    off: 'Aus',
    intro: 'Wähle deine Vorteile',
    help: 'Änderungen wirken, sobald du zum Spiel zurückkehrst. Nach dem Neuladen der Seite sind alle Schalter aus. Geld, Attribute und Zauber aus Cheats bleiben in Spielständen erhalten; Ausschalten macht sie nicht rückgängig.',
    health: [
      'Unendlich Lebenspunkte für Jake',
      'Hält Jakes Stamina voll und verhindert tödlichen Schaden, auch in der Matrix. Begleiter sind davon ausgenommen.',
    ],
    money: [
      'Unendlich Geld',
      'Füllt deinen Credstick auf das Maximum von 4.294.967.295 Nuyen auf.',
    ],
    stats: [
      'Jakes Attribute und Fertigkeiten maximieren',
      'Body und Magic 20, Strength und Charisma 6, Firearms 16 und alle übrigen Fertigkeiten 6. Zauber haben einen eigenen Schalter.',
    ],
    spells: [
      'Alle Zauber freischalten und maximieren',
      'Schaltet alle sechs Zauber auf Stufe 6 frei, erhöht Magic auf 20 und füllt beim Erhöhen dieser Werte die Zauberpunkte. Zaubern verbraucht weiterhin Zauberpunkte.',
    ],
  },
};

export function createCheats({ frame, opener, returnFocus, onOpen, onClose, onChange }) {
  const content = document.createElement('div');
  let language = 'en',
    mask = 0;
  const overlay = createOverlayDialog({
    id: 'cheats',
    titles: { en: COPY.en.title, de: COPY.de.title },
    frame,
    opener,
    returnFocus,
    content,
    onOpen,
    onClose,
  });
  function render() {
    const copy = COPY[language];
    overlay.setLanguage(language);
    content.replaceChildren();
    const intro = document.createElement('h3'),
      help = document.createElement('p');
    intro.textContent = copy.intro;
    help.textContent = copy.help;
    content.append(intro, help);
    for (const [name, bit] of Object.entries(CHEAT)) {
      const card = document.createElement('section'),
        button = document.createElement('button'),
        description = document.createElement('p');
      card.className = 'overlay-card';
      button.type = 'button';
      button.id = `cheat-${name}`;
      const sync = () => {
        button.setAttribute('aria-pressed', String(!!(mask & bit)));
        button.textContent = `${copy[name][0]}: ${copy[mask & bit ? 'on' : 'off']}`;
      };
      sync();
      button.addEventListener('click', () => {
        mask ^= bit;
        sync();
        onChange(mask);
      });
      description.id = `${button.id}-help`;
      description.textContent = copy[name][1];
      button.setAttribute('aria-describedby', description.id);
      card.append(button, description);
      content.append(card);
    }
  }
  render();
  return {
    get isOpen() {
      return overlay.isOpen;
    },
    get mask() {
      return mask;
    },
    setLanguage(code) {
      language = code === 'de' ? 'de' : 'en';
      render();
    },
    open: overlay.open,
  };
}
