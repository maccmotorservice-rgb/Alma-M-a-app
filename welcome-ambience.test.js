import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WELCOME_AMBIENCE_DURATION, createWelcomeAmbience} from './welcome-ambience.js';

test('prepared welcome recording contains the complete seamless stereo choir cycle', async () => {
 const wav = await readFile(new URL('./assets/audio/welcome-angelic-zen-v61.wav', import.meta.url));
 assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
 assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
 assert.equal(wav.readUInt16LE(20), 1, 'uncompressed PCM decodes across browsers');
 assert.equal(wav.readUInt16LE(22), 2);
 assert.equal(wav.readUInt32LE(24), 24000);
 assert.equal(wav.readUInt16LE(34), 16);
 assert.equal(wav.toString('ascii', 36, 40), 'data');
 const frames = wav.readUInt32LE(40) / 4, rate = wav.readUInt32LE(24);
 assert.equal(frames / rate, WELCOME_AMBIENCE_DURATION);
 assert.equal(wav.length, 44 + frames * 4);
 for (let channel = 0; channel < 2; channel++) {
  let peak = 0;
  for (let second = 0; second < WELCOME_AMBIENCE_DURATION; second++) {
   let energy = 0;
   for (let frame = second * rate; frame < (second + 1) * rate; frame++) {
    const sample = wav.readInt16LE(44 + frame * 4 + channel * 2) / 32768;
    energy += sample * sample;peak = Math.max(peak, Math.abs(sample));
   }
   assert.ok(Math.sqrt(energy / rate) > .002, `channel ${channel} stays audible at second ${second}`);
  }
  assert.ok(peak > .1 && peak < .781, 'recording stays below clipping');
  const first = wav.readInt16LE(44 + channel * 2), last = wav.readInt16LE(44 + (frames - 1) * 4 + channel * 2);
  assert.ok(Math.abs(first - last) / 32768 < .025, 'loop boundary is smooth');
 }
});

function audioContext(sampleRate = 16000) {
 return {
  sampleRate,
  createBuffer(numberOfChannels, length, rate) {
   const channels = Array.from({length: numberOfChannels}, () => new Float32Array(length));
   return {numberOfChannels, length, sampleRate: rate, duration: length / rate, getChannelData: index => channels[index]};
  }
 };
}

test('welcome music remains a bounded stereo loop without offline rendering support', async () => {
 const context = audioContext(), first = createWelcomeAmbience(context);
 assert.equal(createWelcomeAmbience(context), first, 'reopening reuses the rendered music');
 const buffer = await first;
 assert.equal(buffer.numberOfChannels, 2);
 assert.equal(buffer.duration, WELCOME_AMBIENCE_DURATION);
 const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
 let peak = 0, stereoDifference = 0, sum = 0;
 for (let i = 0; i < left.length; i++) {
  assert.ok(Number.isFinite(left[i]) && Number.isFinite(right[i]));
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  stereoDifference += (left[i] - right[i]) ** 2;sum += left[i];
 }
 assert.ok(peak > .1 && peak <= .781, `unclipped audible music: ${peak}`);
 assert.ok(Math.sqrt(stereoDifference / left.length) > .003, 'choir and room have stereo width');
 assert.ok(Math.abs(sum / left.length) < .001, 'no DC offset');
 for (let second = 0; second < WELCOME_AMBIENCE_DURATION; second++) {
  let energy = 0;
  for (let i = second * buffer.sampleRate; i < (second + 1) * buffer.sampleRate; i++) energy += left[i] ** 2;
  assert.ok(Math.sqrt(energy / buffer.sampleRate) > .002, `no silent second at ${second}`);
 }
 for (const channel of [left, right]) {
  assert.ok(Math.abs(channel[0] - channel.at(-1)) < .025, 'tails continue across the loop boundary without a click');
 }
});
