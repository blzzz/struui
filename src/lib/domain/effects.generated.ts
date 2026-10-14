// Erzeugt von scripts/strudel-effects.mjs aus @strudel/core/controls.mjs und pattern.mjs. Nicht von Hand ändern: npm run gen:effects
import type { EffectInfo } from './effects.ts';

export const EFFECTS: readonly EffectInfo[] = [
  {
    "name": "adsr",
    "group": "audio",
    "synonyms": [],
    "description": "ADSR envelope: Combination of Attack, Decay, Sustain, and Release.",
    "hint": "attack time in seconds",
    "values": [
      ".1"
    ]
  },
  {
    "name": "attack",
    "group": "audio",
    "synonyms": [
      "att"
    ],
    "description": "Amplitude envelope attack time: Specifies how long it takes for the sound to reach its peak value, relative to the onset.",
    "hint": "time in seconds",
    "values": [
      "0",
      ".1",
      ".5"
    ]
  },
  {
    "name": "begin",
    "group": "audio",
    "synonyms": [],
    "description": "A pattern of numbers from 0 to 1.",
    "hint": "between 0 and 1, where 1 is the length of the sample",
    "values": [
      "0",
      ".25",
      ".5",
      ".75"
    ]
  },
  {
    "name": "bpattack",
    "group": "audio",
    "synonyms": [
      "bpa"
    ],
    "description": "Sets the attack duration for the bandpass filter envelope.",
    "hint": "time of the bandpass filter envelope",
    "values": [
      ".01",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "bpdc",
    "group": "audio",
    "synonyms": [],
    "description": "DC offset of the LFO for the bandpass filter",
    "hint": "dc offset. set to 0 for unipolar",
    "values": []
  },
  {
    "name": "bpdecay",
    "group": "audio",
    "synonyms": [
      "bpd"
    ],
    "description": "Sets the decay duration for the bandpass filter envelope.",
    "hint": "time of the bandpass filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "bpdepth",
    "group": "audio",
    "synonyms": [],
    "description": "Depth of the LFO for the bandpass filter",
    "hint": "depth of modulation",
    "values": []
  },
  {
    "name": "bpdepthfrequency",
    "group": "audio",
    "synonyms": [
      "bpdepthfreq"
    ],
    "description": "Depth of the LFO for the bandpass filter, in HZ",
    "hint": "depth of modulation",
    "values": [
      "0",
      "100",
      "200",
      "500"
    ]
  },
  {
    "name": "bpenv",
    "group": "audio",
    "synonyms": [
      "bpe"
    ],
    "description": "Sets the bandpass filter envelope modulation depth.",
    "hint": "depth of the bandpass filter envelope between 0 and _n_",
    "values": [
      "-4",
      "-2",
      "-1",
      "0",
      "1",
      "2",
      "4"
    ]
  },
  {
    "name": "bpf",
    "group": "audio",
    "synonyms": [
      "bandf",
      "bp"
    ],
    "description": "Sets the center frequency of the band-pass filter.",
    "hint": "center frequency",
    "values": [
      "1000",
      "2000",
      "4000",
      "8000"
    ]
  },
  {
    "name": "bpq",
    "group": "audio",
    "synonyms": [
      "bandq"
    ],
    "description": "Sets the band-pass q-factor (resonance).",
    "hint": "q factor",
    "values": [
      "0",
      "1",
      "2",
      "3"
    ]
  },
  {
    "name": "bprate",
    "group": "audio",
    "synonyms": [],
    "description": "Rate of the LFO for the bandpass filter",
    "hint": "rate in hertz",
    "values": []
  },
  {
    "name": "bprelease",
    "group": "audio",
    "synonyms": [
      "bpr"
    ],
    "description": "Sets the release time for the bandpass filter envelope.",
    "hint": "time of the bandpass filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "bpshape",
    "group": "audio",
    "synonyms": [],
    "description": "Shape of the LFO for the bandpass filter",
    "hint": "Shape of the lfo (0, 1, 2, ..)",
    "values": []
  },
  {
    "name": "bpskew",
    "group": "audio",
    "synonyms": [],
    "description": "Skew of the LFO for the bandpass filter",
    "hint": "How much to bend the LFO shape",
    "values": []
  },
  {
    "name": "bpsustain",
    "group": "audio",
    "synonyms": [
      "bps"
    ],
    "description": "Sets the sustain amplitude for the bandpass filter envelope.",
    "hint": "amplitude of the bandpass filter envelope",
    "values": [
      "0",
      ".25",
      ".5",
      "1",
      "4"
    ]
  },
  {
    "name": "bpsync",
    "group": "audio",
    "synonyms": [],
    "description": "Cycle-synced rate of the LFO for the bandpass filter",
    "hint": "rate in cycles",
    "values": []
  },
  {
    "name": "busgain",
    "group": "audio",
    "synonyms": [
      "bgain"
    ],
    "description": "Postgain multiplier prior to sending the signal to the audio bus.",
    "hint": "",
    "values": []
  },
  {
    "name": "ccn",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI control number: Sends a MIDI control change message.",
    "hint": "control number (0-127)",
    "values": []
  },
  {
    "name": "ccv",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI control value: Sends a MIDI control change message.",
    "hint": "control value (0-127)",
    "values": []
  },
  {
    "name": "chorus",
    "group": "audio",
    "synonyms": [],
    "description": "mix control for the chorus effect",
    "hint": "mix amount between 0 and 1",
    "values": [
      ".5"
    ]
  },
  {
    "name": "clip",
    "group": "audio",
    "synonyms": [
      "legato"
    ],
    "description": "Multiplies the duration with the given number.",
    "hint": ">= 0",
    "values": [
      ".5",
      "1",
      "2"
    ]
  },
  {
    "name": "coarse",
    "group": "audio",
    "synonyms": [],
    "description": "Fake-resampling for lowering the sample rate.",
    "hint": "1 for original 2 for half, 3 for a third and so on",
    "values": [
      "1",
      "4",
      "8",
      "16",
      "32"
    ]
  },
  {
    "name": "color",
    "group": "audio",
    "synonyms": [
      "colour"
    ],
    "description": "Sets the color of the hap in visualizations like pianoroll or highlighting.",
    "hint": "Hexadecimal or CSS color name",
    "values": []
  },
  {
    "name": "compressor",
    "group": "audio",
    "synonyms": [],
    "description": "Dynamics Compressor.",
    "hint": "",
    "values": [
      "-20"
    ]
  },
  {
    "name": "crush",
    "group": "audio",
    "synonyms": [],
    "description": "Bit crusher effect.",
    "hint": "between 1 (for drastic reduction in bit-depth) to 16 (for barely no reduction)",
    "values": [
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "16"
    ]
  },
  {
    "name": "cut",
    "group": "audio",
    "synonyms": [],
    "description": "In the style of classic drum-machines, cut will stop a playing sample as soon as another samples with in same cutgroup is to be played.",
    "hint": "cut group number",
    "values": [
      "1"
    ]
  },
  {
    "name": "decay",
    "group": "audio",
    "synonyms": [
      "dec"
    ],
    "description": "Amplitude envelope decay time: the time it takes after the attack time to reach the sustain level.",
    "hint": "decay time in seconds",
    "values": [
      ".1",
      ".2",
      ".3",
      ".4"
    ]
  },
  {
    "name": "delay",
    "group": "audio",
    "synonyms": [],
    "description": "Sets the level of the delay signal.",
    "hint": "between 0 and 1",
    "values": [
      "0",
      ".25",
      ".5",
      "0.65",
      "1"
    ]
  },
  {
    "name": "delayfeedback",
    "group": "audio",
    "synonyms": [
      "delayfb",
      "dfb"
    ],
    "description": "Sets the level of the signal that is fed back into the delay.",
    "hint": "between 0 and 1",
    "values": [
      ".25",
      ".5",
      ".75",
      "1"
    ]
  },
  {
    "name": "delayspeed",
    "group": "audio",
    "synonyms": [
      "delayt",
      "dt"
    ],
    "description": "Sets the time of the delay effect.",
    "hint": "controls the pitch of the delay feedback",
    "values": [
      "-2",
      "-1",
      ".5",
      "2"
    ]
  },
  {
    "name": "delaysync",
    "group": "audio",
    "synonyms": [
      "delayt",
      "dt"
    ],
    "description": "Sets the time of the delay effect in cycles.",
    "hint": "delay length in cycles",
    "values": []
  },
  {
    "name": "density",
    "group": "audio",
    "synonyms": [],
    "description": "Noise crackle density",
    "hint": "between 0 and x",
    "values": []
  },
  {
    "name": "detune",
    "group": "audio",
    "synonyms": [
      "det"
    ],
    "description": "Set detune for stacked voices of supported oscillators",
    "hint": "",
    "values": [
      ".1",
      ".2",
      ".5",
      "24.1"
    ]
  },
  {
    "name": "distort",
    "group": "audio",
    "synonyms": [
      "dist"
    ],
    "description": "Wave shaping distortion.",
    "hint": "amount of distortion to apply",
    "values": [
      "0",
      "2",
      "3",
      "8",
      "10"
    ]
  },
  {
    "name": "distorttype",
    "group": "audio",
    "synonyms": [
      "disttype"
    ],
    "description": "Type of waveshaping distortion to apply.",
    "hint": "type of distortion to apply",
    "values": [
      "0",
      "1",
      "2",
      "fold",
      "chebyshev",
      "scurve",
      "diode",
      "asym",
      "sinefold"
    ]
  },
  {
    "name": "distortvol",
    "group": "audio",
    "synonyms": [
      "distvol"
    ],
    "description": "Postgain for waveshaping distortion.",
    "hint": "linear postgain of the distortion",
    "values": [
      "0.8"
    ]
  },
  {
    "name": "djf",
    "group": "audio",
    "synonyms": [],
    "description": "DJ filter, below 0.5 is low pass filter, above is high pass filter.",
    "hint": "below 0.5 is low pass filter, above is high pass filter",
    "values": [
      ".2",
      ".3",
      ".5",
      ".75"
    ]
  },
  {
    "name": "drive",
    "group": "audio",
    "synonyms": [],
    "description": "Filter overdrive for supported filter types",
    "hint": "",
    "values": [
      ".5",
      "4"
    ]
  },
  {
    "name": "duckattack",
    "group": "audio",
    "synonyms": [
      "duckatt"
    ],
    "description": "The time required for the ducked signal(s) to return to their normal volume.",
    "hint": "The attack time in seconds",
    "values": [
      "0",
      "0.2",
      "0.4"
    ]
  },
  {
    "name": "duckdepth",
    "group": "audio",
    "synonyms": [],
    "description": "The amount of ducking applied to target orbit Can vary across orbits with the ':' mininotation, e.g. duckdepth(\"0.3:0.1\").",
    "hint": "depth of modulation from 0 to 1",
    "values": [
      "0",
      ".6",
      ".9",
      "1"
    ]
  },
  {
    "name": "duckonset",
    "group": "audio",
    "synonyms": [
      "duckons"
    ],
    "description": "The time required for the ducked signal(s) to reach their lowest volume.",
    "hint": "The onset time in seconds",
    "values": [
      "0",
      "0.01",
      "0.3"
    ]
  },
  {
    "name": "duckorbit",
    "group": "audio",
    "synonyms": [
      "duck"
    ],
    "description": "Modulate the amplitude of an orbit to create a \"sidechain\" like effect.",
    "hint": "target orbit",
    "values": [
      "2"
    ]
  },
  {
    "name": "end",
    "group": "audio",
    "synonyms": [],
    "description": "The same as .begin, but cuts off the end off each sample.",
    "hint": "1 = whole sample, .5 = half sample, .25 = quarter sample etc.",
    "values": [
      ".1",
      ".2",
      ".5",
      "1"
    ]
  },
  {
    "name": "fanchor",
    "group": "audio",
    "synonyms": [],
    "description": "controls the center of the filter envelope.",
    "hint": "0 to 1",
    "values": [
      "0",
      ".5",
      "1"
    ]
  },
  {
    "name": "fmattack",
    "group": "audio",
    "synonyms": [
      "fmatt"
    ],
    "description": "Attack time for the FM envelope: time it takes to reach maximum modulation A number may be added afterwards to control the attack of the envelope of any of the 8 individual FMs (e.g. fmatt5)",
    "hint": "attack time",
    "values": [
      "0",
      ".05",
      ".1",
      ".2"
    ]
  },
  {
    "name": "fmdecay",
    "group": "audio",
    "synonyms": [
      "fmdec"
    ],
    "description": "Decay time for the FM envelope: seconds until the sustain level is reached after the attack phase.",
    "hint": "decay time",
    "values": [
      ".01",
      ".05",
      ".1",
      ".2"
    ]
  },
  {
    "name": "fmenv",
    "group": "audio",
    "synonyms": [],
    "description": "Ramp type of fm envelope.",
    "hint": "lin | exp",
    "values": [
      "exp",
      "lin"
    ]
  },
  {
    "name": "fmh",
    "group": "audio",
    "synonyms": [],
    "description": "Sets the Frequency Modulation Harmonicity Ratio.",
    "hint": "",
    "values": [
      "1",
      "1.5",
      "1.61",
      "2"
    ]
  },
  {
    "name": "fmi",
    "group": "audio",
    "synonyms": [
      "fm"
    ],
    "description": "Sets the Frequency Modulation of the synth.",
    "hint": "modulation index",
    "values": [
      "0",
      "1",
      "2",
      "4",
      "8",
      "32"
    ]
  },
  {
    "name": "fmrelease",
    "group": "audio",
    "synonyms": [
      "fmrel"
    ],
    "description": "Release time for the FM envelope: how much modulation is applied after the note is released A number may be added afterwards to control the release of the envelope of any of the 8 individual FMs (e.g. fmrel8)",
    "hint": "release time",
    "values": []
  },
  {
    "name": "fmsustain",
    "group": "audio",
    "synonyms": [
      "fmsus"
    ],
    "description": "Sustain level for the FM envelope: how much modulation is applied after the decay phase A number may be added afterwards to control the sustain of the envelope of any of the 8 individual FMs (e.g. fmsus7)",
    "hint": "sustain level",
    "values": [
      "0",
      ".5",
      ".75",
      "1"
    ]
  },
  {
    "name": "fmwave",
    "group": "audio",
    "synonyms": [],
    "description": "Waveform of the fm modulator A number may be added afterwards to control the waveform any of the 8 individual FMs (e.g. fmwave6)",
    "hint": "waveform",
    "values": [
      "sine",
      "square",
      "sawtooth",
      "crackle",
      "brown"
    ]
  },
  {
    "name": "freq",
    "group": "audio",
    "synonyms": [],
    "description": "Set frequency of sound.",
    "hint": "in Hz. the audible range is between 20 and 20000 Hz",
    "values": []
  },
  {
    "name": "ftype",
    "group": "audio",
    "synonyms": [],
    "description": "Sets the filter type.",
    "hint": "12db (0), ladder (1), or 24db (2)",
    "values": [
      "0",
      "1",
      "2",
      "ladder"
    ]
  },
  {
    "name": "gain",
    "group": "audio",
    "synonyms": [],
    "description": "Controls the gain by an exponential amount.",
    "hint": "gain",
    "values": [
      ".4",
      "1",
      "2"
    ]
  },
  {
    "name": "hpattack",
    "group": "audio",
    "synonyms": [
      "hpa"
    ],
    "description": "Sets the attack duration for the highpass filter envelope.",
    "hint": "time of the highpass filter envelope",
    "values": [
      ".01",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "hpdc",
    "group": "audio",
    "synonyms": [],
    "description": "DC offset of the LFO for the highpass filter",
    "hint": "dc offset. set to 0 for unipolar",
    "values": []
  },
  {
    "name": "hpdecay",
    "group": "audio",
    "synonyms": [
      "hpd"
    ],
    "description": "Sets the decay duration for the highpass filter envelope.",
    "hint": "time of the highpass filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "hpdepth",
    "group": "audio",
    "synonyms": [],
    "description": "Depth of the LFO for the highpass filter",
    "hint": "depth of modulation",
    "values": []
  },
  {
    "name": "hpdepthfrequency",
    "group": "audio",
    "synonyms": [
      "hpdepthfreq"
    ],
    "description": "Depth of the LFO for the hipass filter, in hz",
    "hint": "depth of modulation",
    "values": [
      "0",
      "100",
      "200",
      "500"
    ]
  },
  {
    "name": "hpenv",
    "group": "audio",
    "synonyms": [
      "hpe"
    ],
    "description": "Sets the highpass filter envelope modulation depth.",
    "hint": "depth of the highpass filter envelope between 0 and _n_",
    "values": [
      "-4",
      "-2",
      "-1",
      "0",
      "1",
      "2",
      "4"
    ]
  },
  {
    "name": "hpf",
    "group": "audio",
    "synonyms": [
      "hp",
      "hcutoff"
    ],
    "description": "Applies the cutoff frequency of the high-pass filter.",
    "hint": "audible between 0 and 20000",
    "values": [
      "100",
      "200",
      "500",
      "1000",
      "2000",
      "4000"
    ]
  },
  {
    "name": "hpq",
    "group": "audio",
    "synonyms": [
      "hresonance"
    ],
    "description": "Controls the high-pass q-value.",
    "hint": "resonance factor between 0 and 50",
    "values": [
      "0",
      "10",
      "20",
      "30"
    ]
  },
  {
    "name": "hprate",
    "group": "audio",
    "synonyms": [],
    "description": "Rate of the LFO for the highpass filter",
    "hint": "rate in hertz",
    "values": []
  },
  {
    "name": "hprelease",
    "group": "audio",
    "synonyms": [
      "hpr"
    ],
    "description": "Sets the release time for the highpass filter envelope.",
    "hint": "time of the highpass filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "hpshape",
    "group": "audio",
    "synonyms": [],
    "description": "Shape of the LFO for the highpass filter",
    "hint": "Shape of the lfo (0, 1, 2, ..)",
    "values": []
  },
  {
    "name": "hpskew",
    "group": "audio",
    "synonyms": [],
    "description": "Skew of the LFO for the highpass filter",
    "hint": "How much to bend the LFO shape",
    "values": []
  },
  {
    "name": "hpsustain",
    "group": "audio",
    "synonyms": [
      "hps"
    ],
    "description": "Sets the sustain amplitude for the highpass filter envelope.",
    "hint": "amplitude of the highpass filter envelope",
    "values": [
      "0",
      ".25",
      ".5",
      "1",
      "4"
    ]
  },
  {
    "name": "hpsync",
    "group": "audio",
    "synonyms": [],
    "description": "Cycle-synced rate of the LFO for the highpass filter",
    "hint": "rate in cycles",
    "values": []
  },
  {
    "name": "irbegin",
    "group": "audio",
    "synonyms": [
      "ir"
    ],
    "description": "Sets the beginning of the IR response sample",
    "hint": "between 0 and 1",
    "values": [
      "0",
      ".5",
      ".75",
      "2",
      "swpad"
    ]
  },
  {
    "name": "iresponse",
    "group": "audio",
    "synonyms": [
      "ir"
    ],
    "description": "Sets the sample to use as an impulse response for the reverb.",
    "hint": "to use as an impulse response",
    "values": [
      "shaker_large"
    ]
  },
  {
    "name": "irspeed",
    "group": "audio",
    "synonyms": [],
    "description": "Sets speed of the sample for the impulse response.",
    "hint": "",
    "values": [
      ".5",
      "1",
      "2"
    ]
  },
  {
    "name": "loop",
    "group": "audio",
    "synonyms": [],
    "description": "Loops the sample.",
    "hint": "If 1, the sample is looped",
    "values": [
      "1"
    ]
  },
  {
    "name": "loopBegin",
    "group": "audio",
    "synonyms": [
      "loopb"
    ],
    "description": "Begin to loop at a specific point in the sample (inbetween begin and end).",
    "hint": "between 0 and 1, where 1 is the length of the sample",
    "values": [
      "0",
      ".125",
      ".25"
    ]
  },
  {
    "name": "loopEnd",
    "group": "audio",
    "synonyms": [
      "loope"
    ],
    "description": "End the looping section at a specific point in the sample (inbetween begin and end).",
    "hint": "between 0 and 1, where 1 is the length of the sample",
    "values": [
      ".25",
      ".5",
      ".75",
      "1"
    ]
  },
  {
    "name": "lpattack",
    "group": "audio",
    "synonyms": [
      "lpa"
    ],
    "description": "Sets the attack duration for the lowpass filter envelope.",
    "hint": "time of the filter envelope",
    "values": [
      ".01",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "lpdc",
    "group": "audio",
    "synonyms": [],
    "description": "DC offset of the LFO for the lowpass filter",
    "hint": "dc offset. set to 0 for unipolar",
    "values": []
  },
  {
    "name": "lpdecay",
    "group": "audio",
    "synonyms": [
      "lpd"
    ],
    "description": "Sets the decay duration for the lowpass filter envelope.",
    "hint": "time of the filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "lpdepth",
    "group": "audio",
    "synonyms": [],
    "description": "Depth of the LFO for the lowpass filter",
    "hint": "depth of modulation",
    "values": [
      "0",
      ".5",
      "1",
      "1.8"
    ]
  },
  {
    "name": "lpdepthfrequency",
    "group": "audio",
    "synonyms": [
      "lpdepthfreq"
    ],
    "description": "Depth of the LFO for the lowpass filter, in HZ",
    "hint": "depth of modulation",
    "values": [
      "0",
      "100",
      "200",
      "500"
    ]
  },
  {
    "name": "lpenv",
    "group": "audio",
    "synonyms": [
      "lpe"
    ],
    "description": "Sets the lowpass filter envelope modulation depth.",
    "hint": "depth of the lowpass filter envelope between 0 and _n_",
    "values": [
      "-4",
      "-2",
      "-1",
      "0",
      "1",
      "2",
      "4"
    ]
  },
  {
    "name": "lpf",
    "group": "audio",
    "synonyms": [
      "cutoff",
      "ctf",
      "lp"
    ],
    "description": "Applies the cutoff frequency of the low-pass filter.",
    "hint": "audible between 0 and 20000",
    "values": [
      "100",
      "200",
      "500",
      "1000",
      "2000",
      "4000"
    ]
  },
  {
    "name": "lpq",
    "group": "audio",
    "synonyms": [
      "resonance"
    ],
    "description": "Controls the low-pass q-value.",
    "hint": "resonance factor between 0 and 50",
    "values": [
      "0",
      "10",
      "20",
      "30"
    ]
  },
  {
    "name": "lprate",
    "group": "audio",
    "synonyms": [],
    "description": "Rate of the LFO for the lowpass filter",
    "hint": "rate in hertz",
    "values": [
      "1",
      "2",
      "4",
      "8"
    ]
  },
  {
    "name": "lprelease",
    "group": "audio",
    "synonyms": [
      "lpr"
    ],
    "description": "Sets the release time for the lowpass filter envelope.",
    "hint": "time of the filter envelope",
    "values": [
      "0",
      ".1",
      ".25",
      ".5",
      "4"
    ]
  },
  {
    "name": "lpshape",
    "group": "audio",
    "synonyms": [],
    "description": "Shape of the LFO for the lowpass filter",
    "hint": "Shape of the lfo (0, 1, 2, ..)",
    "values": []
  },
  {
    "name": "lpskew",
    "group": "audio",
    "synonyms": [],
    "description": "Skew of the LFO for the lowpass filter",
    "hint": "How much to bend the LFO shape",
    "values": []
  },
  {
    "name": "lpsustain",
    "group": "audio",
    "synonyms": [
      "lps"
    ],
    "description": "Sets the sustain amplitude for the lowpass filter envelope.",
    "hint": "amplitude of the lowpass filter envelope",
    "values": [
      "0",
      ".25",
      ".5",
      "1",
      "4"
    ]
  },
  {
    "name": "lpsync",
    "group": "audio",
    "synonyms": [],
    "description": "Cycle-synced rate of the LFO for the lowpass filter",
    "hint": "rate in cycles",
    "values": [
      "1",
      "2",
      "4",
      "8"
    ]
  },
  {
    "name": "midibend",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI pitch bend: Sends a MIDI pitch bend message.",
    "hint": "MIDI pitch bend (-1 - 1)",
    "values": []
  },
  {
    "name": "midicmd",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI command: Sends a MIDI command message.",
    "hint": "MIDI command",
    "values": []
  },
  {
    "name": "miditouch",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI key after touch: Sends a MIDI key after touch message.",
    "hint": "MIDI key after touch (0-1)",
    "values": []
  },
  {
    "name": "noise",
    "group": "audio",
    "synonyms": [],
    "description": "Adds pink noise to the mix",
    "hint": "wet amount",
    "values": []
  },
  {
    "name": "note",
    "group": "pitch",
    "synonyms": [],
    "description": "Plays the given note name or midi number.",
    "hint": "",
    "values": []
  },
  {
    "name": "nrpnn",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI NRPN non-registered parameter number: Sends a MIDI NRPN non-registered parameter number message.",
    "hint": "MIDI NRPN non-registered parameter number (0-127)",
    "values": [
      "1"
    ]
  },
  {
    "name": "nrpv",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI NRPN non-registered parameter value: Sends a MIDI NRPN non-registered parameter value message.",
    "hint": "MIDI NRPN non-registered parameter value (0-127)",
    "values": [
      "123"
    ]
  },
  {
    "name": "octave",
    "group": "audio",
    "synonyms": [
      "oct"
    ],
    "description": "Sets the default octave of a synth.",
    "hint": "octave number",
    "values": [
      "0",
      "1",
      "2",
      "3"
    ]
  },
  {
    "name": "offset",
    "group": "audio",
    "synonyms": [],
    "description": "Sets how the voicing is offset from the anchored position",
    "hint": "the amount to shift the voicing up or down",
    "values": [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5"
    ]
  },
  {
    "name": "pan",
    "group": "audio",
    "synonyms": [],
    "description": "Sets position in stereo.",
    "hint": "between 0 and 1, from left to right (assuming stereo), once round a circle (assuming multichannel)",
    "values": [
      "0",
      ".5",
      "1"
    ]
  },
  {
    "name": "panchor",
    "group": "audio",
    "synonyms": [],
    "description": "Sets the range anchor of the envelope: - anchor 0: range = [note, note + penv] - anchor 1: range = [note - penv, note] If you don't set an anchor, the value will default to the psustain value.",
    "hint": "anchor offset",
    "values": [
      "0",
      ".5",
      "1"
    ]
  },
  {
    "name": "pattack",
    "group": "audio",
    "synonyms": [
      "patt"
    ],
    "description": "Attack time of pitch envelope.",
    "hint": "time in seconds",
    "values": [
      "0",
      ".1",
      ".25",
      ".5"
    ]
  },
  {
    "name": "pcurve",
    "group": "audio",
    "synonyms": [],
    "description": "Curve of envelope.",
    "hint": "0 = linear, 1 = exponential",
    "values": [
      "0",
      "1"
    ]
  },
  {
    "name": "pdecay",
    "group": "audio",
    "synonyms": [
      "pdec"
    ],
    "description": "Decay time of pitch envelope.",
    "hint": "time in seconds",
    "values": [
      "0",
      ".1",
      ".25",
      ".5"
    ]
  },
  {
    "name": "penv",
    "group": "audio",
    "synonyms": [],
    "description": "Amount of pitch envelope.",
    "hint": "change in semitones",
    "values": [
      "-12",
      "-7",
      "-1",
      "0",
      ".5",
      "1",
      "7",
      "12"
    ]
  },
  {
    "name": "phaser",
    "group": "audio",
    "synonyms": [
      "ph"
    ],
    "description": "Phaser audio effect that approximates popular guitar pedals.",
    "hint": "speed of modulation",
    "values": [
      "1",
      "2",
      "4",
      "8"
    ]
  },
  {
    "name": "phasercenter",
    "group": "audio",
    "synonyms": [
      "phc"
    ],
    "description": "The center frequency of the phaser in HZ.",
    "hint": "in HZ",
    "values": [
      "800",
      "2000",
      "4000"
    ]
  },
  {
    "name": "phaserdepth",
    "group": "audio",
    "synonyms": [
      "phd",
      "phasdp"
    ],
    "description": "The amount the signal is affected by the phaser effect.",
    "hint": "number between 0 and 1",
    "values": [
      "0",
      ".5",
      ".75",
      "1"
    ]
  },
  {
    "name": "phasersweep",
    "group": "audio",
    "synonyms": [
      "phs"
    ],
    "description": "The frequency sweep range of the lfo for the phaser effect.",
    "hint": "most useful values are between 0 and 4000",
    "values": [
      "800",
      "2000",
      "4000"
    ]
  },
  {
    "name": "prelease",
    "group": "audio",
    "synonyms": [
      "prel"
    ],
    "description": "Release time of pitch envelope",
    "hint": "time in seconds",
    "values": [
      "0",
      ".1",
      ".25",
      ".5"
    ]
  },
  {
    "name": "progNum",
    "group": "midi",
    "synonyms": [],
    "description": "MIDI program number: Sends a MIDI program change message.",
    "hint": "MIDI program number (0-127)",
    "values": [
      "10"
    ]
  },
  {
    "name": "pw",
    "group": "audio",
    "synonyms": [],
    "description": "Controls the pulsewidth of the pulse oscillator",
    "hint": "",
    "values": [
      "0",
      ".5",
      ".75",
      ".8",
      "1"
    ]
  },
  {
    "name": "pwrate",
    "group": "audio",
    "synonyms": [],
    "description": "Controls the lfo rate for the pulsewidth of the pulse oscillator",
    "hint": "",
    "values": [
      ".1",
      "5",
      "25"
    ]
  },
  {
    "name": "pwsweep",
    "group": "audio",
    "synonyms": [],
    "description": "Controls the lfo sweep for the pulsewidth of the pulse oscillator",
    "hint": "",
    "values": [
      "0.3",
      ".8"
    ]
  },
  {
    "name": "release",
    "group": "audio",
    "synonyms": [
      "rel"
    ],
    "description": "Amplitude envelope release time: The time it takes after the offset to go from sustain level to zero.",
    "hint": "release time in seconds",
    "values": [
      "0",
      ".1",
      ".4",
      ".6",
      "1",
      "2"
    ]
  },
  {
    "name": "room",
    "group": "audio",
    "synonyms": [],
    "description": "Sets the level of reverb.",
    "hint": "between 0 and 1",
    "values": [
      "0",
      ".2",
      ".4",
      ".6",
      ".8",
      "0.9",
      "1"
    ]
  },
  {
    "name": "roomdim",
    "group": "audio",
    "synonyms": [
      "rdim"
    ],
    "description": "Reverb lowpass frequency at -60dB (in hertz).",
    "hint": "between 0 and 20000hz",
    "values": [
      "400",
      "8000"
    ]
  },
  {
    "name": "roomfade",
    "group": "audio",
    "synonyms": [
      "rfade"
    ],
    "description": "Reverb fade time (in seconds).",
    "hint": "for the reverb to fade",
    "values": [
      "0.5",
      "4"
    ]
  },
  {
    "name": "roomlp",
    "group": "audio",
    "synonyms": [
      "rlp"
    ],
    "description": "Reverb lowpass starting frequency (in hertz).",
    "hint": "between 0 and 20000hz",
    "values": [
      "5000",
      "10000"
    ]
  },
  {
    "name": "roomsize",
    "group": "audio",
    "synonyms": [
      "rsize",
      "sz",
      "size"
    ],
    "description": "Sets the room size of the reverb, see room.",
    "hint": "between 0 and 10",
    "values": [
      "1",
      "4"
    ]
  },
  {
    "name": "shape",
    "group": "audio",
    "synonyms": [],
    "description": "(Deprecated) Wave shaping distortion.",
    "hint": "between 0 and 1",
    "values": [
      "0",
      ".2",
      ".4",
      ".6",
      ".8"
    ]
  },
  {
    "name": "speed",
    "group": "audio",
    "synonyms": [],
    "description": "Changes the speed of sample playback, i.e. a cheap way of changing pitch.",
    "hint": "-inf to inf, negative numbers play the sample backwards",
    "values": [
      "-4",
      "-2",
      "1",
      "2",
      "4"
    ]
  },
  {
    "name": "spread",
    "group": "audio",
    "synonyms": [],
    "description": "Set the stereo pan spread for supported oscillators",
    "hint": "between 0 and 1",
    "values": [
      "0",
      ".3",
      "1"
    ]
  },
  {
    "name": "stretch",
    "group": "audio",
    "synonyms": [],
    "description": "Changes the speed of sample playback, i.e. a cheap way of changing pitch.",
    "hint": "-inf to inf, negative numbers play the sample backwards",
    "values": [
      ".5",
      "1",
      "2"
    ]
  },
  {
    "name": "sustain",
    "group": "audio",
    "synonyms": [
      "sus"
    ],
    "description": "Amplitude envelope sustain level: The level which is reached after attack / decay, being sustained until the offset.",
    "hint": "sustain level between 0 and 1",
    "values": [
      "0",
      ".1",
      ".4",
      ".6",
      "1"
    ]
  },
  {
    "name": "transient",
    "group": "audio",
    "synonyms": [],
    "description": "Transient shaper.",
    "hint": "Emphasis on transients; between -1 (deaccentuate) and 1 (accentuate)",
    "values": [
      "-1",
      "-0.5",
      "0",
      "0.5",
      "1"
    ]
  },
  {
    "name": "tremolo",
    "group": "audio",
    "synonyms": [
      "trem"
    ],
    "description": "Modulate the amplitude of a sound with a continuous waveform",
    "hint": "modulation speed in HZ",
    "values": [
      "2",
      "3",
      "100"
    ]
  },
  {
    "name": "tremolodepth",
    "group": "audio",
    "synonyms": [
      "tremdepth"
    ],
    "description": "Depth of amplitude modulation",
    "hint": "",
    "values": [
      ".7",
      "1",
      "2"
    ]
  },
  {
    "name": "tremolophase",
    "group": "audio",
    "synonyms": [
      "tremphase"
    ],
    "description": "Alter the phase of the modulation waveform",
    "hint": "the offset in cycles of the modulation",
    "values": [
      "0",
      ".25",
      ".66"
    ]
  },
  {
    "name": "tremoloshape",
    "group": "audio",
    "synonyms": [
      "tremshape"
    ],
    "description": "Shape of amplitude modulation",
    "hint": "tri | square | sine | saw | ramp",
    "values": [
      "sine",
      "tri",
      "square"
    ]
  },
  {
    "name": "tremoloskew",
    "group": "audio",
    "synonyms": [
      "tremskew"
    ],
    "description": "Alter the shape of the modulation waveform",
    "hint": "between 0 & 1, the shape of the waveform",
    "values": [
      "0",
      ".5",
      "1"
    ]
  },
  {
    "name": "tremolosync",
    "group": "audio",
    "synonyms": [
      "tremsync"
    ],
    "description": "Modulate the amplitude of a sound with a continuous waveform",
    "hint": "modulation speed in cycles",
    "values": [
      "4"
    ]
  },
  {
    "name": "unison",
    "group": "audio",
    "synonyms": [],
    "description": "Set number of stacked voices for supported oscillators",
    "hint": "",
    "values": [
      "1",
      "2",
      "7"
    ]
  },
  {
    "name": "velocity",
    "group": "audio",
    "synonyms": [
      "vel"
    ],
    "description": "Sets the velocity from 0 to 1.",
    "hint": "",
    "values": [
      ".4",
      "1"
    ]
  },
  {
    "name": "vib",
    "group": "audio",
    "synonyms": [
      "vibrato",
      "v"
    ],
    "description": "Applies a vibrato to the frequency of the oscillator.",
    "hint": "of the vibrato in hertz",
    "values": [
      ".5",
      "1",
      "2",
      "4",
      "8",
      "16"
    ]
  },
  {
    "name": "vibmod",
    "group": "audio",
    "synonyms": [
      "vmod"
    ],
    "description": "Sets the vibrato depth in semitones.",
    "hint": "of vibrato (in semitones)",
    "values": [
      ".25",
      ".5",
      "1",
      "2",
      "12"
    ]
  },
  {
    "name": "vowel",
    "group": "audio",
    "synonyms": [],
    "description": "Formant filter to make things sound like vowels.",
    "hint": "You can use a e i o u ae aa oe ue y uh un en an on, corresponding to [a] [e] [i] [o] [u] [æ] [ɑ] [ø] [y] [ɯ] [ʌ] [œ̃] [ɛ̃] [ɑ̃] [ɔ̃]. Aliases: aa = å = ɑ, oe = ø = ö, y = ı, ae = æ",
    "values": [
      "a",
      "e",
      "i",
      "o",
      "u"
    ]
  },
  {
    "name": "warp",
    "group": "audio",
    "synonyms": [
      "wavetableWarp"
    ],
    "description": "Amount of warp (alteration of the waveform) to apply to the wavetable oscillator",
    "hint": "Warp of the wavetable from 0 to 1",
    "values": [
      "0",
      "0.25",
      "0.5",
      "0.75",
      "1"
    ]
  },
  {
    "name": "warpattack",
    "group": "audio",
    "synonyms": [
      "warpatt"
    ],
    "description": "Attack time of the wavetable oscillator's warp envelope",
    "hint": "attack time in seconds",
    "values": []
  },
  {
    "name": "warpdc",
    "group": "audio",
    "synonyms": [],
    "description": "DC offset of the LFO for the wavetable oscillator's warp",
    "hint": "dc offset. set to 0 for unipolar",
    "values": []
  },
  {
    "name": "warpdecay",
    "group": "audio",
    "synonyms": [
      "warpdec"
    ],
    "description": "Decay time of the wavetable oscillator's warp envelope",
    "hint": "decay time in seconds",
    "values": []
  },
  {
    "name": "warpdepth",
    "group": "audio",
    "synonyms": [],
    "description": "Depth of the LFO for the wavetable oscillator's warp",
    "hint": "depth of modulation",
    "values": []
  },
  {
    "name": "warpenv",
    "group": "audio",
    "synonyms": [],
    "description": "Amount of envelope applied wavetable oscillator's position envelope",
    "hint": "between 0 and 1",
    "values": []
  },
  {
    "name": "warpmode",
    "group": "audio",
    "synonyms": [
      "wavetableWarpMode"
    ],
    "description": "Type of warp (alteration of the waveform) to apply to the wavetable oscillator.",
    "hint": "Warp mode",
    "values": [
      "2",
      "asym",
      "bendp",
      "spin",
      "logistic",
      "sync",
      "wormhole",
      "brownian"
    ]
  },
  {
    "name": "warprate",
    "group": "audio",
    "synonyms": [],
    "description": "Rate of the LFO for the wavetable oscillator's warp",
    "hint": "rate in hertz",
    "values": []
  },
  {
    "name": "warprelease",
    "group": "audio",
    "synonyms": [
      "warprel"
    ],
    "description": "Release time of the wavetable oscillator's warp envelope",
    "hint": "release time in seconds",
    "values": []
  },
  {
    "name": "warpshape",
    "group": "audio",
    "synonyms": [],
    "description": "Shape of the LFO for the wavetable oscillator's warp",
    "hint": "Shape of the lfo (0, 1, 2, ..)",
    "values": []
  },
  {
    "name": "warpskew",
    "group": "audio",
    "synonyms": [],
    "description": "Skew of the LFO for the wavetable oscillator's warp",
    "hint": "How much to bend the LFO shape",
    "values": []
  },
  {
    "name": "warpsustain",
    "group": "audio",
    "synonyms": [
      "warpsus"
    ],
    "description": "Sustain time of the wavetable oscillator's warp envelope",
    "hint": "sustain level (0 to 1)",
    "values": []
  },
  {
    "name": "warpsync",
    "group": "audio",
    "synonyms": [],
    "description": "cycle synced rate of the LFO for the wavetable warp position",
    "hint": "rate in cycles",
    "values": []
  },
  {
    "name": "wt",
    "group": "audio",
    "synonyms": [
      "wavetablePosition"
    ],
    "description": "Position in the wavetable of the wavetable oscillator",
    "hint": "Position in the wavetable from 0 to 1",
    "values": [
      "0",
      "0.25",
      "0.5",
      "0.75",
      "1"
    ]
  },
  {
    "name": "wtattack",
    "group": "audio",
    "synonyms": [
      "wtatt"
    ],
    "description": "Attack time of the wavetable oscillator's position envelope",
    "hint": "attack time in seconds",
    "values": []
  },
  {
    "name": "wtdc",
    "group": "audio",
    "synonyms": [],
    "description": "DC offset of the LFO for the wavetable oscillator's position",
    "hint": "dc offset. set to 0 for unipolar",
    "values": []
  },
  {
    "name": "wtdecay",
    "group": "audio",
    "synonyms": [
      "wtdec"
    ],
    "description": "Decay time of the wavetable oscillator's position envelope",
    "hint": "decay time in seconds",
    "values": []
  },
  {
    "name": "wtdepth",
    "group": "audio",
    "synonyms": [],
    "description": "Depth of the LFO for the wavetable oscillator's position",
    "hint": "depth of modulation",
    "values": []
  },
  {
    "name": "wtenv",
    "group": "audio",
    "synonyms": [],
    "description": "Amount of envelope applied wavetable oscillator's position envelope",
    "hint": "between 0 and 1",
    "values": []
  },
  {
    "name": "wtphaserand",
    "group": "audio",
    "synonyms": [
      "wavetablePhaseRand"
    ],
    "description": "Amount of randomness of the initial phase of the wavetable oscillator.",
    "hint": "Randomness of the initial phase. Between 0 (not random) and 1 (fully random)",
    "values": [
      "0",
      "1"
    ]
  },
  {
    "name": "wtrate",
    "group": "audio",
    "synonyms": [],
    "description": "Rate of the LFO for the wavetable oscillator's position",
    "hint": "rate in hertz",
    "values": []
  },
  {
    "name": "wtrelease",
    "group": "audio",
    "synonyms": [
      "wtrel"
    ],
    "description": "Release time of the wavetable oscillator's position envelope",
    "hint": "release time in seconds",
    "values": []
  },
  {
    "name": "wtshape",
    "group": "audio",
    "synonyms": [],
    "description": "Shape of the LFO for the wavetable oscillator's position",
    "hint": "Shape of the lfo (0, 1, 2, ..)",
    "values": []
  },
  {
    "name": "wtskew",
    "group": "audio",
    "synonyms": [],
    "description": "Skew of the LFO for the wavetable oscillator's position",
    "hint": "How much to bend the LFO shape",
    "values": []
  },
  {
    "name": "wtsustain",
    "group": "audio",
    "synonyms": [
      "wtsus"
    ],
    "description": "Sustain time of the wavetable oscillator's position envelope",
    "hint": "sustain level (0 to 1)",
    "values": []
  },
  {
    "name": "wtsync",
    "group": "audio",
    "synonyms": [],
    "description": "cycle synced rate of the LFO for the wavetable oscillator's position",
    "hint": "rate in cycles",
    "values": []
  }
];

export const NOTE_OPS: readonly EffectInfo[] = [
  {
    "name": "add",
    "group": "arith",
    "synonyms": [],
    "description": "Assumes a pattern of numbers.",
    "hint": "",
    "values": [
      "0",
      "3",
      "4",
      "5",
      "7"
    ]
  },
  {
    "name": "sub",
    "group": "arith",
    "synonyms": [],
    "description": "Like add, but the given numbers are subtracted.",
    "hint": "",
    "values": [
      "0",
      "1",
      "2",
      "3"
    ]
  },
  {
    "name": "mul",
    "group": "arith",
    "synonyms": [],
    "description": "Multiplies each number by the given factor.",
    "hint": "",
    "values": [
      "150"
    ]
  },
  {
    "name": "div",
    "group": "arith",
    "synonyms": [],
    "description": "Divides each number by the given factor.",
    "hint": "",
    "values": []
  }
];
