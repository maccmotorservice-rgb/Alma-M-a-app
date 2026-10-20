/* Gentle ambient synth, bass and felt piano with a distant choir. The prepared
   mix uses a licensed recorded choir; the device fallback is softly synthesized. */
export const WELCOME_AMBIENCE_DURATION = 32;
const RENDER_RATE = 24000, TABLE_LENGTH = 2048, TAU = Math.PI * 2;
const cachedBuffers = new Map();
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [[52, 59, 64, 68], [49, 56, 64, 68], [52, 57, 61, 69], [54, 59, 64, 66]];
const BASS = [40, 37, 33, 35];
const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));

function vocalTable(pitch, vowel, shift, rate) {
 const table = new Float32Array(TABLE_LENGTH + 1), f0 = frequency(pitch);
 const formants = vowel === 'ah' ? [[670, 110, 1], [1140, 170, .8], [2600, 310, .26]] : [[350, 95, 1], [790, 140, .75], [2350, 320, .20]];
 for (let harmonic = 1; harmonic <= 40 && f0 * harmonic < Math.min(6500, rate * .44); harmonic++) {
  const hz = f0 * harmonic;
  const resonance = formants.reduce((sum, [center, width, weight]) => sum + weight * Math.exp(-.5 * ((hz - center * shift) / width) ** 2), 0);
  const level = .20 / harmonic ** 1.7 + .22 * resonance / harmonic ** 1.6;
  for (let i = 0; i < TABLE_LENGTH; i++) table[i] += level * Math.sin(TAU * harmonic * i / TABLE_LENGTH);
 }
 let peak = 0;for (let i = 0; i < TABLE_LENGTH; i++) peak = Math.max(peak, Math.abs(table[i]));
 for (let i = 0; i < TABLE_LENGTH; i++) table[i] /= Math.max(peak, .01);
 table[TABLE_LENGTH] = table[0];return table;
}
function swell(t, duration = 12) {
 if (t < 3) return Math.sin(t / 3 * Math.PI / 2) ** 2;
 if (t > duration - 3) return Math.sin((duration - t) / 3 * Math.PI / 2) ** 2;
 return 1;
}
function addVoice(left, right, rate, chord, part, singer) {
 const pitch = CHORDS[chord][part], shift = [ .96, 1.015, 1.055 ][singer];
 const ah = vocalTable(pitch, 'ah', shift, rate), oo = vocalTable(pitch, 'oo', shift, rate);
 const length = left.length, frames = Math.round(12 * rate), start = Math.round((chord * 8 - 2 + singer * .065) * rate);
 const detune = [-1.7, .1, 1.9][singer], step = frequency(pitch) * 2 ** (detune / 1200) * TABLE_LENGTH / rate;
 const pan = [-.65, .12, .64][singer] + (part - 1.5) * .055, lg = Math.sqrt((1 - pan) / 2), rg = Math.sqrt((1 + pan) / 2);
 let phase = (singer * 417 + part * 229) % TABLE_LENGTH, random = 701 + chord * 97 + part * 53 + singer * 19, breath = 0;
 for (let i = 0; i < frames; i++) {
  const t = i / rate, absolute = chord * 8 + t, vibrato = Math.sin(TAU * (4.6 + singer * .17) * t + part * .9) * Math.min(1, t / 2);
  phase += step * (1 + .00012 * vibrato + .00010 * Math.sin(TAU * .08 * t + singer));
  if (phase >= TABLE_LENGTH) phase -= TABLE_LENGTH;
  const index = Math.floor(phase), mix = phase - index;
  const a = ah[index] + mix * (ah[index + 1] - ah[index]), o = oo[index] + mix * (oo[index + 1] - oo[index]);
  const morph = .18 + .035 * Math.sin(TAU * absolute / 32 + part * .5);
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  const air = random / 2147483648 - 1;breath += .16 * (air - breath);
  const amplitude = .010 * swell(t) * (.98 + .02 * Math.sin(TAU * .07 * t + part + singer));
  const value = ((a * morph + o * (1 - morph)) + (air - breath) * .002) * amplitude;
  const at = ((start + i) % length + length) % length;left[at] += value * lg;right[at] += value * rg;
 }
}
function addBass(left, right, rate, chord) {
 const start = Math.round((chord * 8 - 2) * rate), frames = Math.round(12 * rate), f0 = frequency(BASS[chord]);
 for (let i = 0; i < frames; i++) {
  const t = i / rate, phase = TAU * f0 * t;
  const value = .037 * swell(t) * (Math.sin(phase) + .22 * Math.sin(phase * 2) + .065 * Math.sin(phase * 3));
  const shimmer = .0018 * swell(t) * Math.sin(TAU * frequency(CHORDS[chord][3] + 12) * t + .3 * Math.sin(TAU * .18 * t));
  const at = ((start + i) % left.length + left.length) % left.length;
  left[at] += value + shimmer * .75;right[at] += value + shimmer * .45;
 }
}
function addSynthPad(left, right, rate, chord) {
 const frames = Math.round(12 * rate), start = Math.round((chord * 8 - 2) * rate);
 for (let part = 0; part < 4; part++) {
  const f0 = frequency(CHORDS[chord][part]), pan = [-.42, .4, -.19, .2][part];
  const lg = Math.sqrt((1 - pan) / 2), rg = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < frames; i++) {
   const t = i / rate, phase = TAU * f0 * t + part * .7;
   const value = .033 * swell(t) * (Math.sin(phase) + .13 * Math.sin(phase * 2) + .025 * Math.sin(phase * 4));
   const at = ((start + i) % left.length + left.length) % left.length;
   left[at] += value * lg;right[at] += value * rg;
  }
 }
}
function addQuietPiano(left, right, rate) {
 // Eight gentle notes in 32 seconds; soft attacks and fast overtone decay.
 const notes = [[1.1,64,.015],[4.7,71,.010],[9.5,63,.013],[13.4,68,.009],[17.2,61,.013],[20.8,68,.009],[25.3,66,.014],[29.1,64,.010]];
 const partials = [1, .30, .12, .055, .022, .008];
 for (const [at, pitch, level] of notes) {
  const frames = Math.round(7 * rate), start = Math.round(at * rate), pan = pitch > 67 ? .21 : -.15;
  const lg = Math.sqrt((1 - pan) / 2), rg = Math.sqrt((1 + pan) / 2), f0 = frequency(pitch);
  for (let i = 0; i < frames; i++) {
   const t = i / rate, attack = 1 - Math.exp(-t / .018), tail = Math.min(1, (7 - t) / .25);let value = 0;
   for (let h = 1; h <= partials.length; h++) {
    const f = f0 * h * Math.sqrt(1 + .00008 * h * h), decay = 1.65 / (1 + .48 * (h - 1));
    value += partials[h - 1] * Math.exp(-t / decay) * (Math.sin(TAU * f * t) + .24 * Math.sin(TAU * f * 1.0006 * t)) / 1.24;
   }
   value *= level * attack * tail;const index = (start + i) % left.length;
   left[index] += value * lg;right[index] += value * rg;
  }
 }
}

function diffuseRoom(left, right, rate) {
 const length = left.length, dryLeft = left.slice(), dryRight = right.slice();
 // Circular, low-passed reflections retain the choir's tails through the seam.
 for (const [seconds, gain] of [[.13, .15], [.29, .12], [.47, .11], [.73, .095], [1.13, .08], [1.67, .07], [2.31, .055], [3.17, .041], [4.19, .027], [5.37, .017]]) {
  const delay = Math.round(seconds * rate);let lowLeft = 0, lowRight = 0;
  for (let i = 0; i < length * 2; i++) {
   const at = i % length;lowLeft += .22 * (dryLeft[at] - lowLeft);lowRight += .22 * (dryRight[at] - lowRight);
   if (i >= length) {const reflected = (at + delay) % length;left[reflected] += lowRight * gain;right[reflected] += lowLeft * gain;}
  }
 }
}
function balance(buffer) {
 let peak = 0, energy = 0;
 for (let channel = 0; channel < 2; channel++) {
  const data = buffer.getChannelData(channel);let mean = 0;
  // Match the boundary with a short, smooth correction, never a fade to silence.
  const seam = (data[0] - data.at(-1)) / 2, edge = Math.min(Math.round(buffer.sampleRate * .01), Math.floor(data.length / 4));
  for (let i = 0; i < edge; i++) {const correction = seam * (.5 + .5 * Math.cos(Math.PI * i / edge));data[i] -= correction;data[data.length - 1 - i] += correction;}
  for (const sample of data) mean += sample;mean /= data.length;
  for (let i = 0; i < data.length; i++) {data[i] -= mean;peak = Math.max(peak, Math.abs(data[i]));energy += data[i] ** 2;}
 }
 const rms = Math.sqrt(energy / (buffer.length * 2)), gain = Math.min(.78 / Math.max(peak, .001), .125 / Math.max(rms, .001));
 for (let channel = 0; channel < 2; channel++) {const data = buffer.getChannelData(channel);for (let i = 0; i < data.length; i++) data[i] *= gain;}
 return buffer;
}
export async function renderWelcomeChoir(context, sampleRate = RENDER_RATE, {includeVoices = true} = {}) {
 const buffer = context.createBuffer(2, Math.round(sampleRate * WELCOME_AMBIENCE_DURATION), sampleRate), left = buffer.getChannelData(0), right = buffer.getChannelData(1);
 for (let chord = 0; chord < CHORDS.length; chord++) {
  for (let part = 0; includeVoices && part < 4; part++) {
   for (let singer = 0; singer < 3; singer++) addVoice(left, right, sampleRate, chord, part, singer);
   await yieldFrame();
  }
  addSynthPad(left, right, sampleRate, chord);addBass(left, right, sampleRate, chord);await yieldFrame();
 }
 addQuietPiano(left, right, sampleRate);diffuseRoom(left, right, sampleRate);return balance(buffer);
}
async function loadPreparedAmbience(context, sampleRate) {
 if (typeof context.decodeAudioData !== 'function' || typeof fetch !== 'function') throw new Error('Audio decoding unavailable');
 const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
 try {
  const response = await fetch(new URL('./assets/audio/welcome-angelic-zen-v61.wav', import.meta.url), {cache: 'force-cache', signal: controller.signal});
  if (!response.ok) throw new Error('Welcome recording unavailable');
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const decoder = OfflineContext ? new OfflineContext(2, 1, sampleRate) : context;
  const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
  if (buffer.numberOfChannels !== 2 || Math.abs(buffer.duration - WELCOME_AMBIENCE_DURATION) > .01) throw new Error('Invalid welcome recording');
  return buffer;
 } finally {clearTimeout(timeout);}
}
export function createWelcomeAmbience(context) {
 const rate = Math.min(RENDER_RATE, Math.max(16000, Number(context.sampleRate) || RENDER_RATE));
 if (!cachedBuffers.has(rate)) {
  const task = loadPreparedAmbience(context, rate).catch(() => renderWelcomeChoir(context, rate));cachedBuffers.set(rate, task);
  task.catch(() => {if (cachedBuffers.get(rate) === task) cachedBuffers.delete(rate);});
 }
 return cachedBuffers.get(rate);
}
