// Original, sample-free choir. Rebuild with: node scripts/build-welcome-audio.mjs
import {writeFile} from 'node:fs/promises';
import {renderWelcomeChoir} from '../welcome-ambience.js';
const context = {createBuffer(numberOfChannels, length, sampleRate) {const channels = Array.from({length: numberOfChannels}, () => new Float32Array(length));return {numberOfChannels, length, sampleRate, duration: length / sampleRate, getChannelData: index => channels[index]};}};
const audio = await renderWelcomeChoir(context), wav = Buffer.alloc(44 + audio.length * 4);
wav.write('RIFF', 0);wav.writeUInt32LE(wav.length - 8, 4);wav.write('WAVEfmt ', 8);wav.writeUInt32LE(16, 16);wav.writeUInt16LE(1, 20);wav.writeUInt16LE(2, 22);wav.writeUInt32LE(audio.sampleRate, 24);wav.writeUInt32LE(audio.sampleRate * 4, 28);wav.writeUInt16LE(4, 32);wav.writeUInt16LE(16, 34);wav.write('data', 36);wav.writeUInt32LE(audio.length * 4, 40);
let peak = 0, energy = 0;const seams = [];
for (let c = 0; c < 2; c++) {const data = audio.getChannelData(c);seams.push(Math.abs(data[0] - data.at(-1)));for (let i = 0; i < data.length; i++) {peak = Math.max(peak, Math.abs(data[i]));energy += data[i] ** 2;wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 4 + c * 2);}}
await writeFile(new URL('../assets/audio/welcome-choir-zen-v60.wav', import.meta.url), wav);
console.log(JSON.stringify({duration: audio.duration, sampleRate: audio.sampleRate, peak, rms: Math.sqrt(energy / (audio.length * 2)), seams}));
