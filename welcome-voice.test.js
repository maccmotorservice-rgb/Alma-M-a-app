import {test} from 'node:test';
import assert from 'node:assert/strict';
import {welcomeVoiceText, selectWelcomeVoice, createWelcomeVoice} from './welcome-voice.js';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(list = [{lang: 'es-MX', localService: true}]) {
 const listeners = new Set(), spoken = [];
 const engine = {cancelled: 0, getVoices: () => list, speak: line => spoken.push(line), cancel() {this.cancelled++;}, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn)};
 const scope = {speechSynthesis: engine, SpeechSynthesisUtterance: class {constructor(text) {this.text = text;}}};
 return {scope, engine, spoken, listeners, setVoices(values) {list = values;for (const fn of [...listeners]) fn();}};
}
test('spoken greeting identifies the authenticated profile and its grammatical gender', () => {
 assert.equal(welcomeVoiceText('Luis'), 'Bienvenido, Luis.');assert.equal(welcomeVoiceText('Ximena'), 'Bienvenida, Ximena.');
 assert.equal(welcomeVoiceText(''), null);assert.equal(welcomeVoiceText('Otro'), null);
 const local = {lang: 'es-MX', localService: true}, remote = {lang: 'es-MX', localService: false}, spanish = {lang: 'es-ES', localService: true};
 assert.equal(selectWelcomeVoice([{lang: 'en-US'}, spanish, remote, local]), local);assert.equal(selectWelcomeVoice([spanish, remote]), remote);assert.equal(selectWelcomeVoice([{lang: 'en-US'}, spanish]), spanish);assert.equal(selectWelcomeVoice([{lang: 'en-US'}]), null);
});
test('priming is silent and enabled speech uses Spanish at a gentle rate', () => {
 const f = fixture(), voice = createWelcomeVoice({scope: f.scope});voice.prime();assert.equal(f.spoken.length, 0);
 assert.equal(voice.speak('Ximena'), true);assert.equal(f.spoken.length, 1);assert.equal(f.spoken[0].text, 'Bienvenida, Ximena.');assert.equal(f.spoken[0].lang, 'es-MX');assert.equal(f.spoken[0].rate, .94);assert.equal(f.spoken[0].volume, .8);
 f.spoken[0].onend();voice.cancel();assert.equal(f.engine.cancelled, 0, 'finished narration does not cancel unrelated speech');
});
test('delayed voice availability is cancelled on mute or a changed session', async () => {
 const f = fixture([]);let active = true;
 const voice = createWelcomeVoice({scope: f.scope, allowed: () => active, waitMs: 10});voice.speak('Luis');assert.equal(f.listeners.size, 1);active = false;
 f.setVoices([{lang: 'es-MX'}]);await pause(20);assert.equal(f.spoken.length, 0);assert.equal(f.listeners.size, 0);
 active = true;f.setVoices([]);voice.speak('Luis');voice.cancel();f.setVoices([{lang: 'es-MX'}]);await pause(20);assert.equal(f.spoken.length, 0);assert.equal(f.listeners.size, 0);
});
test('repeated access never overlaps greetings and stale identity is rejected', async () => {
 const f = fixture(), voice = createWelcomeVoice({scope: f.scope});voice.speak('Luis');voice.speak('Ximena');assert.equal(f.engine.cancelled, 1);assert.equal(f.spoken[1].text, 'Bienvenida, Ximena.');voice.cancel();assert.equal(f.engine.cancelled, 2);
 const delayed = fixture([]);let sameUser = true;const pending = createWelcomeVoice({scope: delayed.scope, waitMs: 10});pending.speak('Luis', () => sameUser);sameUser = false;await pause(20);assert.equal(delayed.spoken.length, 0);
});
test('empty voice list falls back to Spanish and unsupported speech never blocks entry', async () => {
 const f = fixture([]), voice = createWelcomeVoice({scope: f.scope, waitMs: 5});voice.speak('Luis');await pause(15);assert.equal(f.spoken.length, 1);assert.equal(f.spoken[0].lang, 'es-MX');f.spoken[0].onerror();voice.cancel();assert.equal(f.engine.cancelled, 0);
 assert.equal(createWelcomeVoice({scope: {}}).speak('Luis'), false);assert.equal(createWelcomeVoice({scope: f.scope, allowed: () => false}).speak('Luis'), false);
 assert.equal(voice.speak('Otro'), false);f.engine.speak = () => {throw Error('blocked');};assert.doesNotThrow(() => voice.speak('Luis'));voice.cancel();
});

test('an old availability callback cannot clear a newer pending greeting', () => {
 const f = fixture([]), voice = createWelcomeVoice({scope: f.scope});voice.speak('Luis');const stale = [...f.listeners][0];
 voice.speak('Ximena');stale();assert.equal(f.listeners.size, 1);f.setVoices([{lang: 'es-MX'}]);assert.equal(f.spoken.length, 1);assert.equal(f.spoken[0].text, 'Bienvenida, Ximena.');voice.cancel();
});
