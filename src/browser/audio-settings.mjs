import { createOverlayDialog } from './overlay-dialog.mjs';
import { AUDIO_PROFILES, DEFAULT_AUDIO_PROFILE } from './audio-profiles.mjs';

const COPY = {
  en: {
    title: 'Audio',
    filter: 'Analog audio filter',
    on: 'on',
    off: 'off',
    filterHelp:
      'Console-style output for original music and effects. Off plays unfiltered digital audio. Tribute music always bypasses this filter.',
    profiles: 'Choose an audio profile',
    help: 'Standard approximates PAL 1CHIP; comparisons and experiments are not console measurements. Choices stay in this browser and apply on return to the game.',
    pal_1chip_nominal_100n_100k: [
      'PAL 1CHIP · Standard',
      'The existing sound: gently reduces deep bass and upper treble. Nominal 100 nF / 100 kΩ model.',
    ],
    pal_1chip_reference_150n_100k: [
      'Comparison · More deep bass',
      'Slightly more deep bass. SNES Jr. coupling candidate: 150 nF, with an assumed 100 kΩ input.',
    ],
    pal_1chip_150n_47k: [
      'Comparison · Less deep bass',
      'Less deep bass than Standard. Uses 150 nF with a stronger assumed input load of 47 kΩ.',
    ],
    pal_1chip_100n_150k: [
      'Comparison · Alternative input',
      '100 nF / 150 kΩ: sounds identical to “More deep bass” with the current ideal-source assumption.',
    ],
    pal_1chip_optional_lp12k: [
      'Experiment · Softer treble',
      'Unverified 12 kHz low-pass: softer treble. Lower safety gain also makes bypass quieter.',
    ],
  },
  de: {
    title: 'Audio',
    filter: 'Analoger Audiofilter',
    on: 'ein',
    off: 'aus',
    filterHelp:
      'Konsolenklang für Originalmusik und Effekte. Aus: ungefilterter Digitalton. Die Tribute-Musik umgeht den Filter immer.',
    profiles: 'Wähle ein Audioprofil',
    help: 'Standard nähert PAL 1CHIP an. Vergleiche und Experimente sind keine Messungen an Originalkonsolen. Die Auswahl bleibt im Browser gespeichert und wirkt bei der Rückkehr zum Spiel.',
    pal_1chip_nominal_100n_100k: [
      'PAL 1CHIP · Standard',
      'Der bisherige Klang: sanft gedämpfte tiefste Bässe und obere Höhen. Nominelles Modell mit 100 nF / 100 kΩ.',
    ],
    pal_1chip_reference_150n_100k: [
      'Vergleich · Mehr Tiefbass',
      'Etwas mehr Tiefbass. Vergleichswert aus dem SNES Jr.: 150 nF, mit angenommenen 100 kΩ am Eingang.',
    ],
    pal_1chip_150n_47k: [
      'Vergleich · Weniger Tiefbass',
      'Weniger Tiefbass als Standard. 150 nF mit stärkerer angenommener Eingangsbelastung von 47 kΩ.',
    ],
    pal_1chip_100n_150k: [
      'Vergleich · Alternativer Eingang',
      '100 nF / 150 kΩ: klingt unter der aktuellen Annahme einer idealen Quelle genauso wie „Mehr Tiefbass“.',
    ],
    pal_1chip_optional_lp12k: [
      'Experiment · Sanftere Höhen',
      'Unbestätigter 12-kHz-Tiefpass: sanftere Höhen. Zum Schutz vor Übersteuerung auch bei ausgeschaltetem Filter leiser.',
    ],
  },
};

export function createAudioSettings({
  frame,
  opener,
  returnFocus,
  soundtrackControls,
  enabled,
  profile,
  onOpen,
  onClose,
  onChange,
}) {
  const content = document.createElement('div');
  let language = 'en';
  if (!Object.hasOwn(AUDIO_PROFILES, profile)) profile = DEFAULT_AUDIO_PROFILE;
  soundtrackControls.hidden = false;
  const overlay = createOverlayDialog({
    id: 'audio-settings',
    titles: { en: COPY.en.title, de: COPY.de.title },
    frame,
    opener,
    returnFocus,
    content,
    onOpen,
    onClose,
  });
  function render() {
    const copy = COPY[language],
      filterCard = document.createElement('section'),
      filter = document.createElement('button'),
      filterHelp = document.createElement('p'),
      profiles = document.createElement('fieldset'),
      legend = document.createElement('legend'),
      help = document.createElement('p');
    overlay.setLanguage(language);
    filterCard.className = 'overlay-card';
    filter.id = 'analog-audio';
    filter.type = 'button';
    const syncFilter = () => {
      filter.setAttribute('aria-pressed', String(enabled));
      filter.textContent = `${copy.filter}: ${copy[enabled ? 'on' : 'off']}`;
    };
    syncFilter();
    filter.addEventListener('click', () => {
      enabled = !enabled;
      syncFilter();
      onChange({ enabled, profile });
    });
    filterHelp.id = 'audio-filter-help';
    filterHelp.textContent = copy.filterHelp;
    filter.setAttribute('aria-describedby', filterHelp.id);
    filterCard.append(filter, filterHelp);
    profiles.className = 'audio-profile-list';
    legend.textContent = copy.profiles;
    help.id = 'audio-profiles-help';
    help.textContent = copy.help;
    profiles.setAttribute('aria-describedby', help.id);
    profiles.append(legend, help);
    for (const id of Object.keys(AUDIO_PROFILES)) {
      const card = document.createElement('div'),
        label = document.createElement('label'),
        radio = document.createElement('input'),
        name = document.createElement('span'),
        description = document.createElement('p');
      card.className = 'overlay-card';
      radio.type = 'radio';
      radio.name = 'audio-profile';
      radio.value = id;
      radio.checked = profile === id;
      name.textContent = copy[id][0];
      description.id = `audio-${id}-help`;
      description.textContent = copy[id][1];
      radio.setAttribute('aria-describedby', description.id);
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        profile = id;
        onChange({ enabled, profile });
      });
      label.append(radio, name);
      card.append(label, description);
      profiles.append(card);
    }
    content.replaceChildren(soundtrackControls, filterCard, profiles);
  }
  render();
  return {
    get isOpen() {
      return overlay.isOpen;
    },
    get enabled() {
      return enabled;
    },
    get profile() {
      return profile;
    },
    setLanguage(code) {
      language = code === 'de' ? 'de' : 'en';
      render();
    },
    open: overlay.open,
  };
}
