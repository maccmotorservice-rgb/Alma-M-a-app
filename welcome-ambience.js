/* Original welcome music, prepared with the synthesizer below. Playback reuses
   one stereo buffer; synthesis remains available if the local recording fails. */
export const WELCOME_AMBIENCE_DURATION = 32;
const RENDER_RATE = 24000;
const cachedBuffers = new Map();
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [
 [52, 59, 66, 68], // E add9
 [49, 56, 63, 64], // C# minor9
 [45, 52, 59, 61], // A major9
 [47, 54, 61, 64]  // B suspended
];
const MELODIES = [
 [[1.2, 68, .47], [3.45, 71, .44], [5.1, 73, .38], [6.55, 71, .33]],
 [[1.45, 68, .43], [3.7, 66, .37], [5.3, 64, .39], [6.65, 71, .30]],
 [[1.2, 64, .43], [3.45, 66, .39], [5.15, 73, .38], [6.6, 71, .33]],
 [[1.4, 64, .40], [3.7, 66, .42], [5.3, 68, .35], [6.65, 66, .31]]
];
const PIANO_PARTIALS = [1, .39, .20, .105, .056, .029, .015, .007];

function score() {
 const notes = [];
 for (let chord = 0; chord < CHORDS.length; chord++) {
  const at = chord * 8, pitches = CHORDS[chord];
  notes.push([at, pitches[0], .49], [at + .14, pitches[1], .34], [at + .36, pitches[2], .31]);
  for (const [offset, pitch, velocity] of MELODIES[chord]) notes.push([at + offset, pitch, velocity]);
 }
 return notes;
}

function noiseBuffer(context, duration, seed = 9413) {
 const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
 const data = buffer.getChannelData(0);
 let random = seed;
 for (let i = 0; i < data.length; i++) {
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  data[i] = random / 2147483648 - 1;
 }
 return buffer;
}

function roomImpulse(context) {
 const length = Math.ceil(context.sampleRate * 2.8), buffer = context.createBuffer(2, length, context.sampleRate);
 for (let channel = 0; channel < 2; channel++) {
  const data = buffer.getChannelData(channel);
  let random = 8803 + channel * 1721, filtered = 0;
  for (let i = 0; i < length; i++) {
   random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
   filtered += .2 * (random / 2147483648 - 1 - filtered);
   const time = i / context.sampleRate;
   // A short pre-delay and a dark tail leave the piano's attack clear.
   data[i] = time < .028 ? 0 : filtered * Math.exp(-time * 2.25) * Math.min(1, (time - .028) / .03);
  }
 }
 return buffer;
}

function schedulePiano(context, destination, hammer, at, midi, velocity) {
 const fundamental = frequency(midi), length = midi < 55 ? 6.8 : 5.6;
 const panner = context.createStereoPanner();
 panner.pan.value = Math.max(-.38, Math.min(.38, (midi - 61) / 42));
 panner.connect(destination);
 for (let harmonic = 1; harmonic <= PIANO_PARTIALS.length; harmonic++) {
  // Slight string inharmonicity and detuned paired strings create a piano,
  // rather than an organ-like sine chord. Upper partials decay sooner.
  const partial = fundamental * harmonic * Math.sqrt(1 + .00009 * harmonic * harmonic);
  const decay = (midi < 55 ? 2.6 : 1.95) / (1 + .34 * (harmonic - 1));
  const strings = harmonic <= 3 ? 2 : 1;
  for (let string = 0; string < strings; string++) {
   const oscillator = context.createOscillator(), envelope = context.createGain();
   oscillator.type = 'sine';oscillator.frequency.value = partial;
   oscillator.detune.value = strings === 2 ? (string ? 1.7 : -1.7) : 0;
   const level = velocity * .31 * PIANO_PARTIALS[harmonic - 1] / strings;
   envelope.gain.setValueAtTime(0, at);
   envelope.gain.linearRampToValueAtTime(level, at + .006);
   envelope.gain.exponentialRampToValueAtTime(Math.max(.000001, level * Math.exp(-length / decay)), at + length - .08);
   envelope.gain.linearRampToValueAtTime(0, at + length);
   oscillator.connect(envelope);envelope.connect(panner);oscillator.start(at);oscillator.stop(at + length);
  }
 }
 const strike = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
 strike.buffer = hammer;filter.type = 'lowpass';filter.frequency.value = 1900;filter.Q.value = .4;
 envelope.gain.setValueAtTime(0, at);envelope.gain.linearRampToValueAtTime(velocity * .026, at + .003);
 envelope.gain.exponentialRampToValueAtTime(.000001, at + .048);
 strike.connect(filter);filter.connect(envelope);envelope.connect(panner);strike.start(at);strike.stop(at + .05);
}

function schedulePad(context, destination, at, chord) {
 for (let index = 0; index < chord.length; index++) {
  const oscillator = context.createOscillator(), envelope = context.createGain(), panner = context.createStereoPanner();
  oscillator.type = 'sine';oscillator.frequency.value = frequency(chord[index]);oscillator.detune.value = index % 2 ? 2.1 : -2.1;
  panner.pan.value = index % 2 ? .46 : -.46;
  envelope.gain.setValueAtTime(0, at);envelope.gain.linearRampToValueAtTime(.0033, at + 2.7);
  envelope.gain.setValueAtTime(.0033, at + 5.8);envelope.gain.linearRampToValueAtTime(0, at + 10.5);
  oscillator.connect(envelope);envelope.connect(panner);panner.connect(destination);oscillator.start(at);oscillator.stop(at + 10.5);
 }
}

function balanceBuffer(buffer) {
 let peak = 0;
 for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
  const data = buffer.getChannelData(channel);
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
 }
 const gain = peak > .000001 ? Math.min(4, .78 / peak) : 1;
 for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
  const data = buffer.getChannelData(channel);
  for (let i = 0; i < data.length; i++) data[i] *= gain;
 }
 return buffer;
}

async function renderOffline(context, sampleRate) {
 const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
 if (!OfflineContext) throw new Error('Offline audio unavailable');
 const length = Math.round(sampleRate * WELCOME_AMBIENCE_DURATION);
 const offline = new OfflineContext(2, length * 3, sampleRate);
 const piano = offline.createGain(), dry = offline.createGain(), room = offline.createConvolver(), wet = offline.createGain();
 piano.gain.value = 1;dry.gain.value = .84;wet.gain.value = .24;
 room.buffer = roomImpulse(offline);
 piano.connect(dry);dry.connect(offline.destination);piano.connect(room);room.connect(wet);wet.connect(offline.destination);
 const hammer = noiseBuffer(offline, .055);
 const notes = score();
 for (let cycle = 0; cycle < 3; cycle++) {
  const cycleStart = cycle * WELCOME_AMBIENCE_DURATION;
  for (const [at, midi, velocity] of notes) schedulePiano(offline, piano, hammer, cycleStart + at, midi, velocity);
  for (let chord = 0; chord < CHORDS.length; chord++) schedulePad(offline, piano, cycleStart + chord * 8, CHORDS[chord]);
 }
 const rendered = await offline.startRendering();
 const buffer = context.createBuffer(2, length, sampleRate);
 // The middle performance already contains the previous cycle's piano and room
 // tails. Both boundaries therefore meet naturally, without silence or a fade.
 for (let channel = 0; channel < 2; channel++) buffer.copyToChannel(rendered.getChannelData(channel).subarray(length, length * 2), channel);
 return balanceBuffer(buffer);
}

async function renderFallback(context, sampleRate) {
 // Older Web Audio implementations can still play a true, seamless buffer loop.
 // Yield between notes so generating it never locks a slow phone's interface.
 const length = Math.round(sampleRate * WELCOME_AMBIENCE_DURATION), buffer = context.createBuffer(2, length, sampleRate);
 const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
 for (const [at, midi, velocity] of score()) {
  const pan = Math.max(-.38, Math.min(.38, (midi - 61) / 42)), leftGain = Math.sqrt((1 - pan) / 2), rightGain = Math.sqrt((1 + pan) / 2);
  const start = Math.round(at * sampleRate), duration = midi < 55 ? 6.8 : 5.6, samples = Math.ceil(duration * sampleRate);
  for (let harmonic = 1; harmonic <= PIANO_PARTIALS.length; harmonic++) {
   const f = frequency(midi) * harmonic * Math.sqrt(1 + .00009 * harmonic * harmonic), angle = 2 * Math.PI * f / sampleRate;
   const sinStep = Math.sin(angle), cosStep = Math.cos(angle), decay = (midi < 55 ? 2.6 : 1.95) / (1 + .34 * (harmonic - 1));
   const release = Math.exp(-1 / (sampleRate * decay));
   let sine = 0, cosine = 1, amplitude = velocity * .31 * PIANO_PARTIALS[harmonic - 1];
   for (let i = 0; i < samples; i++) {
    const attack = Math.min(1, i / (sampleRate * .006)), tail = Math.min(1, (samples - i) / (sampleRate * .08));
    const value = sine * amplitude * attack * tail, position = (start + i) % length;
    left[position] += value * leftGain;right[position] += value * rightGain;
    const next = sine * cosStep + cosine * sinStep;cosine = cosine * cosStep - sine * sinStep;sine = next;amplitude *= release;
   }
  }
  await new Promise(resolve => setTimeout(resolve, 0));
 }
 // Circular, damped stereo reflections also carry across the loop boundary.
 const dryLeft = left.slice(), dryRight = right.slice();
 for (const [delay, gain] of [[.173, .13], [.293, .08], [.419, .045]]) {
  const offset = Math.round(delay * sampleRate);let lowLeft = 0, lowRight = 0;
  for (let i = 0; i < length * 2; i++) {
   const position = i % length;lowLeft += .16 * (dryLeft[position] - lowLeft);lowRight += .16 * (dryRight[position] - lowRight);
   if (i >= length) {left[(position + offset) % length] += lowRight * gain;right[(position + offset) % length] += lowLeft * gain;}
  }
  await new Promise(resolve => setTimeout(resolve, 0));
 }
 return balanceBuffer(buffer);
}

async function loadPreparedAmbience(context, sampleRate) {
 if (typeof context.decodeAudioData !== 'function' || typeof fetch !== 'function') throw new Error('Audio decoding unavailable');
 const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
 try {
  const response = await fetch(new URL('./assets/audio/welcome-piano-zen-v58.wav', import.meta.url), {cache: 'force-cache', signal: controller.signal});
  if (!response.ok) throw new Error('Welcome recording unavailable');
  const bytes = await response.arrayBuffer();
  const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  // Decode at the recording's rate rather than doubling memory on 48 kHz devices.
  const decoder = OfflineContext ? new OfflineContext(2, 1, sampleRate) : context;
  const buffer = await decoder.decodeAudioData(bytes);
  if (buffer.numberOfChannels !== 2 || Math.abs(buffer.duration - WELCOME_AMBIENCE_DURATION) > .01) throw new Error('Invalid welcome recording');
  return buffer;
 } finally {clearTimeout(timeout);}
}

export function createWelcomeAmbience(context) {
 // A 24 kHz stereo buffer uses roughly 6 MB. Piano and dark room tails retain
 // their detail, and playback uses one native source even on slower devices.
 const sampleRate = Math.min(RENDER_RATE, Math.max(16000, Number(context.sampleRate) || RENDER_RATE));
 if (!cachedBuffers.has(sampleRate)) {
  const task = loadPreparedAmbience(context, sampleRate).catch(() => renderOffline(context, sampleRate)).catch(() => renderFallback(context, sampleRate));
  cachedBuffers.set(sampleRate, task);
  task.catch(() => {if (cachedBuffers.get(sampleRate) === task) cachedBuffers.delete(sampleRate);});
 }
 return cachedBuffers.get(sampleRate);
}
