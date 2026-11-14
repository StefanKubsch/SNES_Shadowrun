// Values describe a nominal APU-to-AV baseband model, not a measured S-MIX.
// Sources and the distinction between board evidence and choices: AUDIO-OUTPUT.md.
export const PAL_1CHIP_AUDIO = Object.freeze({
  dacHold: true,
  inputCapacitanceF: 100e-9,
  inputResistanceOhm: 100000,
  inputSourceResistanceOhm: 0,
  mixerGain: 1,
  mixerLowPassHz: 0,
  outputCapacitanceF: 10e-6,
  outputResistanceOhm: 1000,
  outputShuntF: 330e-12,
  loadResistanceOhm: 47000,
});

const PAL_SCHEMATIC =
    'PAL arzi84 rev 0.5; nonSNES Git blob a2ca3ae261cbe8ac365a62782ab54e9fd1bac2c5',
  JR_SCHEMATIC = 'SNN-CPU-01 AV.kicad_sch Git blob 3f183728c666b58c9a83ab21ee8ea2d9daf1fcd1',
  NEC_DATASHEET = 'NEC S11588EJ4V0DS00, page 12, section 4(2), figures 4-3/4-4',
  REPLACEMENT = 'RetroLoom Super Wave Blaster S-MIX replacement input coupling',
  EARLY_PAL = 'arzi84 SNSP-CPU-01/-02 rev 0.8, 2017-11-04, C51/C52';

const evidence = (unit, category, source, note) => Object.freeze({ unit, category, source, note });
const nominalEvidence = Object.freeze({
  dacHold: evidence(
    'boolean',
    'derived',
    NEC_DATASHEET,
    'Ideal baseband hold magnitude; output amplifier response is unknown.',
  ),
  inputCapacitanceF: evidence(
    'F',
    'related-board-assumption',
    REPLACEMENT,
    '100 nF is a replacement-design value; original PAL C23/C26 remain unknown.',
  ),
  inputResistanceOhm: evidence(
    'ohm',
    'model-choice',
    null,
    'Resistive S-MIX input approximation; original impedance is unknown.',
  ),
  inputSourceResistanceOhm: evidence(
    'ohm',
    'model-choice',
    null,
    'Ideal loaded Thevenin DAC source after its physical shunt; not R48/R51 in series.',
  ),
  mixerGain: evidence(
    'linear',
    'model-choice',
    null,
    'Normalized gain; original gain and polarity are unknown.',
  ),
  mixerLowPassHz: evidence(
    'Hz',
    'model-choice',
    null,
    'Zero selects flat response; no internal S-MIX pole is established.',
  ),
  outputCapacitanceF: evidence(
    'F',
    'pal-reconstruction',
    PAL_SCHEMATIC,
    'C12/C13 series output coupling.',
  ),
  outputResistanceOhm: evidence(
    'ohm',
    'pal-reconstruction',
    PAL_SCHEMATIC,
    'R23/R26 series resistors; S-MIX source impedance is approximated as zero.',
  ),
  outputShuntF: evidence(
    'F',
    'related-board-assumption',
    EARLY_PAL,
    '330 pF candidate for PAL 1CHIP C51/C52; original values remain unknown. Not RF C22.',
  ),
  loadResistanceOhm: evidence(
    'ohm',
    'listening-setup',
    null,
    'Chosen line-input resistance, with no cable capacitance; not an internal SNES part.',
  ),
});

const jrCoupling = evidence(
  'F',
  'related-board-assumption',
  JR_SCHEMATIC,
  '150 nF comparison from the Jr reconstruction; not a measured PAL 1CHIP value.',
);
const unresolved = Object.freeze([
  'PAL C23-C28 and C51/C52 values and revision differences',
  'Original DAC and S-MIX source/input impedances, gain, polarity and bandwidth',
  'PRESET/MUTE transients, noise and nonlinear response',
  'DAC images and the receiving chain above the native PCM baseband',
]);

function profile(id, description, category, overrides = {}, evidenceOverrides = {}) {
  return Object.freeze({
    id,
    description,
    category,
    board: 'SNSP-CPU-1CHIP-01/-02, not measured separately',
    parameters: Object.freeze({ ...PAL_1CHIP_AUDIO, ...overrides }),
    evidence: Object.freeze({ ...nominalEvidence, ...evidenceOverrides }),
    unresolved,
  });
}

export const DEFAULT_AUDIO_PROFILE = 'pal_1chip_nominal_100n_100k';
export const AUDIO_PROFILES = Object.freeze(
  Object.fromEntries(
    [
      profile(
        DEFAULT_AUDIO_PROFILE,
        'Existing nominal PAL 1CHIP approximation',
        'nominal-approximation',
      ),
      profile(
        'pal_1chip_reference_150n_100k',
        'Jr coupling comparison',
        'comparison-hypothesis',
        { inputCapacitanceF: 150e-9 },
        { inputCapacitanceF: jrCoupling },
      ),
      profile(
        'pal_1chip_150n_47k',
        'Jr coupling with stronger assumed input loading',
        'comparison-hypothesis',
        { inputCapacitanceF: 150e-9, inputResistanceOhm: 47000 },
        { inputCapacitanceF: jrCoupling },
      ),
      profile(
        'pal_1chip_100n_150k',
        'Alternative with the same RC product as 150 nF / 100 kohm',
        'comparison-hypothesis',
        { inputResistanceOhm: 150000 },
      ),
      profile(
        'pal_1chip_optional_lp12k',
        'Experimental one-pole 12 kHz mixer response',
        'experimental-hypothesis',
        { inputCapacitanceF: 150e-9, mixerLowPassHz: 12000 },
        {
          inputCapacitanceF: jrCoupling,
          mixerLowPassHz: evidence(
            'Hz',
            'hypothesis',
            null,
            'Unverified continuous one-pole comparison; not an original S-MIX specification.',
          ),
        },
      ),
    ].map((definition) => [definition.id, definition]),
  ),
);

export function getAudioProfile(id = DEFAULT_AUDIO_PROFILE) {
  if (typeof id !== 'string' || !Object.hasOwn(AUDIO_PROFILES, id))
    throw new RangeError('Unknown audio profile: ' + String(id));
  return AUDIO_PROFILES[id];
}
