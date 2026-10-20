// Rebuild the prepared mix with: node scripts/build-welcome-audio.mjs
// The recorded choir stem's provenance and license are beside it in assets/audio/source.
import {readFile, writeFile} from 'node:fs/promises';
import {renderWelcomeChoir} from '../welcome-ambience.js';
const context = {createBuffer(numberOfChannels, length, sampleRate) {const channels = Array.from({length: numberOfChannels}, () => new Float32Array(length));return {numberOfChannels, length, sampleRate, duration: length / sampleRate, getChannelData: index => channels[index]};}};
const audio = await renderWelcomeChoir(context, 24000, {includeVoices: false});
const choir = await readFile(new URL('../assets/audio/source/angelic-choir-v61.wav', import.meta.url));
if (choir.toString('ascii', 0, 4) !== 'RIFF' || choir.toString('ascii', 8, 12) !== 'WAVE') throw Error('The choir stem must be a PCM WAVE file.');
let pcm = null, format = null;
for (let at = 12; at + 8 <= choir.length;) {
 const name = choir.toString('ascii', at, at + 4), size = choir.readUInt32LE(at + 4), start = at + 8;
 if (start + size > choir.length) throw Error('Incomplete choir stem.');
 if (name === 'fmt ') format = {codec: choir.readUInt16LE(start), channels: choir.readUInt16LE(start + 2), rate: choir.readUInt32LE(start + 4), bits: choir.readUInt16LE(start + 14)};
 if (name === 'data') pcm = choir.subarray(start, start + size);
 at = start + size + size % 2;
}
if (!pcm || format?.codec !== 1 || format.channels !== 2 || format.rate !== audio.sampleRate || format.bits !== 16 || pcm.length !== audio.length * 4) throw Error('The choir stem must be 32 seconds, stereo, 24 kHz, 16-bit PCM.');
let energy = 0, peak = 0;
for (let channel = 0; channel < 2; channel++) {
 const data = audio.getChannelData(channel);
 for (let i = 0; i < data.length; i++) {data[i] += .48 * pcm.readInt16LE(i * 4 + channel * 2) / 32768;energy += data[i] ** 2;peak = Math.max(peak, Math.abs(data[i]));}
}
const gain = Math.min(.115 / Math.sqrt(energy / (audio.length * 2)), .72 / peak);
const wav = Buffer.alloc(44 + audio.length * 4);
wav.write('RIFF', 0);wav.writeUInt32LE(wav.length - 8, 4);wav.write('WAVEfmt ', 8);wav.writeUInt32LE(16, 16);wav.writeUInt16LE(1, 20);wav.writeUInt16LE(2, 22);wav.writeUInt32LE(audio.sampleRate, 24);wav.writeUInt32LE(audio.sampleRate * 4, 28);wav.writeUInt16LE(4, 32);wav.writeUInt16LE(16, 34);wav.write('data', 36);wav.writeUInt32LE(audio.length * 4, 40);
const seams = [];
for (let c = 0; c < 2; c++) {const data = audio.getChannelData(c);seams.push(Math.abs(data[0] - data.at(-1)) * gain);for (let i = 0; i < data.length; i++) wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * gain * 32767))), 44 + i * 4 + c * 2);}
await writeFile(new URL('../assets/audio/welcome-angelic-zen-v61.wav', import.meta.url), wav);
console.log(JSON.stringify({duration: audio.duration, sampleRate: audio.sampleRate, peak: peak * gain, rms: Math.sqrt(energy / (audio.length * 2)) * gain, seams}));
