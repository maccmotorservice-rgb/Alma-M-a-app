/* Device speech only. No recordings, names or inventory are sent to an app API. */
export function welcomeVoiceText(user) {
 return user === 'Luis' ? 'Bienvenido, Luis.' : user === 'Ximena' ? 'Bienvenida, Ximena.' : null;
}
export function selectWelcomeVoice(voices = []) {
 const lang = voice => String(voice.lang || '').toLowerCase().replace('_', '-');
 return voices.find(v => lang(v) === 'es-mx' && v.localService) || voices.find(v => lang(v) === 'es-mx') || voices.find(v => /^es(?:-|$)/.test(lang(v)) && v.localService) || voices.find(v => /^es(?:-|$)/.test(lang(v))) || null;
}
export function createWelcomeVoice({scope = globalThis, allowed = () => true, waitMs = 400} = {}) {
 let generation = 0, timer = 0, listener = null, utterance = null;
 const engine = scope.speechSynthesis;
 const available = () => engine && typeof engine.speak === 'function' && typeof scope.SpeechSynthesisUtterance === 'function';
 function voices() {try {return engine?.getVoices?.() || [];} catch {return [];}}
 function clearWait() {clearTimeout(timer);timer = 0;if (listener) engine?.removeEventListener?.('voiceschanged', listener);listener = null;}
 function cancel() {
  generation++;clearWait();
  if (utterance) {utterance.onend = null;utterance.onerror = null;utterance = null;try {engine.cancel();} catch {}}
 }
 function prime() {if (available()) voices();}
 function speak(user, stillValid = () => true) {
  cancel();const text = welcomeVoiceText(user), request = generation;
  if (!available() || !text || !allowed() || !stillValid()) return false;
  const say = () => {
   if (request !== generation) return;
   if (!allowed() || !stillValid()) {clearWait();return;}
   clearWait();
   try {
    const line = new scope.SpeechSynthesisUtterance(text), selected = selectWelcomeVoice(voices());
    line.lang = selected?.lang || 'es-MX';if (selected) line.voice = selected;
    line.rate = .94;line.pitch = 1;line.volume = .8;utterance = line;
    const finish = () => {if (utterance === line) utterance = null;};line.onend = finish;line.onerror = finish;
    engine.speak(line);
   } catch {utterance = null;}
  };
  if (voices().length) say();
  else {
   listener = () => {if (voices().length) say();};engine.addEventListener?.('voiceschanged', listener);
   timer = setTimeout(say, waitMs);
  }
  return true;
 }
 return {prime, speak, cancel};
}
