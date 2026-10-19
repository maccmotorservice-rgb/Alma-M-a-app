/* Device-only welcome preferences. This module never reads or writes inventory. */
export const WELCOME_IDLE_MS = 2 * 60 * 60 * 1000;
export const WELCOME_TIME_ZONE = 'America/Guatemala';
export const WELCOME_STATE_KEY = 'alma-mia-welcome-state-v1';
const SOUND_KEY = 'alma-mia-welcome-sound';
const LEASE_KEY = 'alma-mia-welcome-lease-v1';
const emptyState = () => ({lastWelcomeAt: 0, lastWelcomeDay: '', lastActivityAt: 0});
const timestamp = value => Number.isFinite(value) && value > 0 ? value : 0;

export function welcomeDay(now = Date.now(), timeZone = WELCOME_TIME_ZONE) {
 const parts = new Intl.DateTimeFormat('en', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(now));
 const part = type => parts.find(item => item.type === type)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}

export function mergeWelcomeState(a = {}, b = {}) {
 const latest = timestamp(b.lastWelcomeAt) > timestamp(a.lastWelcomeAt) ? b : a;
 return {
  lastWelcomeAt: Math.max(timestamp(a.lastWelcomeAt), timestamp(b.lastWelcomeAt)),
  lastWelcomeDay: /^\d{4}-\d{2}-\d{2}$/.test(latest.lastWelcomeDay ?? '') ? latest.lastWelcomeDay : '',
  lastActivityAt: Math.max(timestamp(a.lastActivityAt), timestamp(b.lastActivityAt))
 };
}

export function welcomeEligibility(state = {}, now = Date.now()) {
 const welcomed = timestamp(state.lastWelcomeAt);
 if (!welcomed || welcomed > now + 5 * 60 * 1000) return {due: true, reason: 'first'};
 const day = state.lastWelcomeDay || welcomeDay(welcomed);
 if (day !== welcomeDay(now)) return {due: true, reason: 'day'};
 const active = Math.max(timestamp(state.lastActivityAt), welcomed);
 return now - active >= WELCOME_IDLE_MS ? {due: true, reason: 'idle'} : {due: false, reason: null};
}

export function claimWelcome(state, now = Date.now()) {
 return {...mergeWelcomeState(state), lastWelcomeAt: now, lastWelcomeDay: welcomeDay(now), lastActivityAt: now};
}

function installWelcome() {
 const root = document.documentElement;
 let state = emptyState(), lastPersisted = 0, checkPromise = null, overlay = null, pendingWelcome = null;
 let returnFocus = null, inertRegions = [], closeTimer = 0, focusTimer = 0;
 let soundOn = true, audioContext = null, playing = [], audioTimer = 0, audioGeneration = 0, playedThisWelcome = false;
 const tabId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
 const unlocked = () => !document.body.classList.contains('access-locked');
 const eligibleScreen = () => unlocked() && root.dataset.version === '3' && document.visibilityState !== 'hidden';
 function storageGet(key) {try {return localStorage.getItem(key);} catch {try {return sessionStorage.getItem(key);} catch {return null;}}}
 function storageSet(key, value) {try {localStorage.setItem(key, value);return true;} catch {try {sessionStorage.setItem(key, value);return true;} catch {return false;}}}
 function readState() {
  try {state = mergeWelcomeState(state, JSON.parse(storageGet(WELCOME_STATE_KEY) || '{}') ?? {});} catch {}
  return state;
 }
 function persistState() {
  readState();storageSet(WELCOME_STATE_KEY, JSON.stringify(state));lastPersisted = Date.now();
 }
 function recordActivity(now = Date.now(), force = false) {
  if (!unlocked()) return;
  readState();state.lastActivityAt = Math.max(state.lastActivityAt, now);
  if (force || now - lastPersisted >= 15000) persistState();
 }
 function currentEligibility(now = Date.now()) {
  const latest = readState();
  // Another tab may have already greeted the user while this form remained open.
  if (pendingWelcome && latest.lastWelcomeAt !== pendingWelcome.afterWelcomeAt) pendingWelcome = null;
  const decision = welcomeEligibility(latest, now);
  return decision.due || !pendingWelcome ? decision : {due: true, reason: pendingWelcome.reason};
 }
 function deferWelcome(decision) {
  pendingWelcome = {afterWelcomeAt: state.lastWelcomeAt, reason: decision.reason};
 }
 soundOn = storageGet(SOUND_KEY) !== 'off';

 function updateSoundControls() {
  for (const id of ['welcome-sound', 'welcome-sound-setting']) {
   const button = document.getElementById(id);if (!button) continue;
   button.setAttribute('aria-pressed', String(soundOn));
   button.textContent = id === 'welcome-sound-setting' ? `Sonido de bienvenida: ${soundOn ? 'activado' : 'desactivado'}` : `Sonido ${soundOn ? 'activado' : 'desactivado'}`;
  }
  const note = document.getElementById('welcome-sound-note');
  if (note) note.textContent = soundOn ? 'Una breve melodía original al entrar. Volumen suave.' : 'La bienvenida se mostrará sin sonido.';
 }
 function stopAudio(closeContext = false) {
  audioGeneration++;clearTimeout(audioTimer);
  for (const oscillator of playing) {try {oscillator.stop();} catch {}}
  playing = [];
  if (closeContext && audioContext) {const old = audioContext;audioContext = null;old.close().catch(() => {});}
 }
 async function playJingle(userGesture = false) {
  if (!soundOn || !unlocked() || !overlay || overlay.hidden) return false;
  stopAudio();const generation = audioGeneration;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return false;
  try {
   audioContext ??= new AudioContext();
   // Browsers require a real gesture unless this site already has autoplay access.
   if (audioContext.state !== 'running' && userGesture) await audioContext.resume();
   if (audioContext.state !== 'running' || generation !== audioGeneration || !unlocked() || overlay.hidden || !soundOn) return false;
   const context = audioContext, start = context.currentTime + .025;
   const master = context.createGain();master.gain.value = .11;master.connect(context.destination);
   // Original four-note phrase with soft envelopes; no downloaded audio or external service.
   const notes = [[554.365, 0], [659.255, .29], [830.609, .58], [739.989, .98]];
   for (const [frequency, offset] of notes) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = 'sine';oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start + offset);
    envelope.gain.linearRampToValueAtTime(.68, start + offset + .035);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + 1.05);
    oscillator.connect(envelope);envelope.connect(master);
    oscillator.start(start + offset);oscillator.stop(start + offset + 1.1);playing.push(oscillator);
    oscillator.onended = () => {oscillator.disconnect();envelope.disconnect();};
   }
   // A quiet lower tone gives the phrase a warm, rounded finish.
   const pad = context.createOscillator(), padGain = context.createGain();pad.frequency.value = 277.183;pad.type = 'sine';
   padGain.gain.setValueAtTime(0, start);padGain.gain.linearRampToValueAtTime(.19, start + .35);padGain.gain.exponentialRampToValueAtTime(.0001, start + 2.25);
   pad.connect(padGain);padGain.connect(master);pad.start(start);pad.stop(start + 2.3);playing.push(pad);
   pad.onended = () => {pad.disconnect();padGain.disconnect();master.disconnect();};
   playedThisWelcome = true;audioTimer = setTimeout(() => {playing = [];}, 2500);
   return true;
  } catch {return false;}
 }
 function toggleSound(event) {
  event?.preventDefault();soundOn = !soundOn;storageSet(SOUND_KEY, soundOn ? 'on' : 'off');updateSoundControls();
  if (!soundOn) stopAudio();else if (overlay && !overlay.hidden) void playJingle(true);
 }
 function addSoundSetting() {
  const picker = document.getElementById('design-picker');
  if (!picker || document.getElementById('welcome-sound-setting')) return;
  const button = document.createElement('button');button.type = 'button';button.id = 'welcome-sound-setting';button.className = 'welcome-sound-setting';button.onclick = toggleSound;
  const target = picker.querySelector('#design-preferences,.design-picker-options,.design-options') || picker;
  target.append(button);updateSoundControls();
 }
 function restoreRegions() {
  for (const [element, previous] of inertRegions) if (element.isConnected) element.inert = previous;
  inertRegions = [];
 }
 function closeWelcome({locked = false, preserveAudio = false} = {}) {
  clearTimeout(closeTimer);clearTimeout(focusTimer);
  if (!preserveAudio) stopAudio(locked);
  if (!overlay) return;
  overlay.hidden = true;if (document.body.classList.contains('welcome-open')) document.body.classList.remove('welcome-open');restoreRegions();
  if (!locked && returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({preventScroll: true});
  returnFocus = null;
 }
 function showWelcome() {
  if (!eligibleScreen()) return;
  if (!overlay) {
   overlay = document.createElement('section');overlay.id = 'studio-welcome';overlay.hidden = true;
   overlay.setAttribute('role', 'dialog');overlay.setAttribute('aria-modal', 'true');overlay.setAttribute('aria-labelledby', 'welcome-greeting');overlay.setAttribute('aria-describedby', 'welcome-copy');
   overlay.innerHTML = '<div class="welcome-scene" aria-hidden="true"><div class="welcome-orbit welcome-orbit-one"></div><div class="welcome-orbit welcome-orbit-two"></div><div class="welcome-orbit welcome-orbit-three"></div></div><div class="welcome-card"><button type="button" class="welcome-close" id="welcome-close" aria-label="Cerrar bienvenida">×</button><div class="welcome-mark"><img src="./assets/logo.png" alt="Alma Mía"></div><p class="welcome-eyebrow">TU ESPACIO. TU ESENCIA.</p><h1 class="welcome-greeting" id="welcome-greeting"></h1><p class="welcome-copy" id="welcome-copy">Todo listo para dar vida a tus ideas.</p><div class="welcome-controls"><button type="button" class="welcome-enter" id="welcome-enter">Entrar a mi espacio <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 18 18 6M6 6h12v12"/></svg></button><button type="button" class="welcome-sound" id="welcome-sound" aria-pressed="true"></button></div><p class="welcome-sound-note" id="welcome-sound-note"></p></div>';
   document.body.append(overlay);
   document.getElementById('welcome-close').onclick = () => closeWelcome();
   document.getElementById('welcome-sound').onclick = toggleSound;
   document.getElementById('welcome-enter').onclick = async () => {
    const button = document.getElementById('welcome-enter');button.disabled = true;
    // Start sound in this gesture, before dismissing. Failure to unlock audio never blocks entry.
    const attempt = playedThisWelcome ? Promise.resolve(true) : playJingle(true);
    await Promise.race([attempt, new Promise(resolve => setTimeout(resolve, 350))]);
    if (!overlay.hidden) closeWelcome({preserveAudio: true});button.disabled = false;
   };
   overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();closeWelcome();return;}
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]')].filter(element => element.tabIndex >= 0 && !element.hidden);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
   });
  }
  const user = document.getElementById('session-user')?.value;
  document.getElementById('welcome-greeting').textContent = user === 'Ximena' ? 'Bienvenida, Ximena.' : user === 'Luis' ? 'Bienvenido, Luis.' : 'Bienvenido a tu espacio.';
  returnFocus = document.activeElement;
  inertRegions = [...document.body.children].filter(element => element !== overlay && !/^(SCRIPT|LINK|STYLE)$/.test(element.tagName)).map(element => [element, element.inert]);
  for (const [element] of inertRegions) element.inert = true;
  playedThisWelcome = false;overlay.hidden = false;document.body.classList.add('welcome-open');updateSoundControls();
  // Move focus once; keyboard users can choose sound or continue immediately.
  focusTimer = setTimeout(() => {if (!overlay.hidden) document.getElementById('welcome-enter').focus({preventScroll: true});}, 30);
  if (!reducedMotion.matches && root.dataset.effects !== 'off') overlay.querySelector('.welcome-card').animate?.([{opacity: 0, transform: 'translateY(18px) scale(.975)'}, {opacity: 1, transform: 'translateY(0) scale(1)'}], {duration: 700, easing: 'cubic-bezier(.16,1,.3,1)'});
  void playJingle().then(played => {if (played && !overlay.hidden) closeTimer = setTimeout(() => closeWelcome({preserveAudio: true}), 4200);});
 }
 const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
 async function withDeviceLock(task) {
  if (navigator.locks?.request) return navigator.locks.request('alma-mia-welcome-v1', {mode: 'exclusive'}, task);
  // Lease/read-back fallback keeps concurrent tabs from presenting the same welcome.
  let existing = null;try {existing = JSON.parse(storageGet(LEASE_KEY) || 'null');} catch {}
  if (existing?.until > Date.now() && existing.owner !== tabId) return;
  const lease = {owner: tabId, until: Date.now() + 1800};storageSet(LEASE_KEY, JSON.stringify(lease));
  await pause(70 + Math.random() * 50);
  let owner = tabId;try {owner = JSON.parse(storageGet(LEASE_KEY) || 'null')?.owner ?? tabId;} catch {}
  if (owner !== tabId) return;
  try {return task();} finally {let latest;try {latest = JSON.parse(storageGet(LEASE_KEY) || 'null');} catch {}if (latest?.owner === tabId) storageSet(LEASE_KEY, JSON.stringify({owner: tabId, until: 0}));}
 }
 function maybeWelcome() {
  if (checkPromise) return checkPromise;
  if (!eligibleScreen() || (overlay && !overlay.hidden)) return Promise.resolve();
  const decision = currentEligibility();
  if (!decision.due) return Promise.resolve();
  if (document.querySelector('dialog[open]')) {deferWelcome(decision);return Promise.resolve();}
  checkPromise = withDeviceLock(() => {
   const now = Date.now(), decision = currentEligibility(now);
   if (!eligibleScreen() || !decision.due) return;
   if (document.querySelector('dialog[open]')) {deferWelcome(decision);return;}
   pendingWelcome = null;state = claimWelcome(state, now);persistState();showWelcome();
  }).catch(() => {}).finally(() => {checkPromise = null;});
  return checkPromise;
 }
 function checkThenActivity() {
  if (!unlocked() || document.visibilityState === 'hidden') return;
  const now = Date.now();
  if (eligibleScreen() && currentEligibility(now).due) void maybeWelcome().finally(() => recordActivity(now));
  else recordActivity(now);
 }
 function handleActivity(event) {if (event.isTrusted) checkThenActivity();}
 for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(type, handleActivity, {passive: true, capture: true});
 let lastPointerActivity = 0;
 document.addEventListener('pointermove', event => {if (event.isTrusted && Date.now() - lastPointerActivity > 30000) {lastPointerActivity = Date.now();checkThenActivity();}}, {passive: true});
 window.addEventListener('focus', checkThenActivity);
 window.addEventListener('pageshow', checkThenActivity);
 // Dialog close does not bubble. Capture it so a due welcome waits for forms or the design picker.
 document.addEventListener('close', event => {if (event.target instanceof HTMLDialogElement) void maybeWelcome();}, true);
 document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'hidden') {if (unlocked()) persistState();stopAudio();} else checkThenActivity();});
 window.addEventListener('pagehide', () => {if (unlocked()) persistState();stopAudio(true);});
 window.addEventListener('storage', event => {
  if (event.key === WELCOME_STATE_KEY) readState();
  if (event.key === SOUND_KEY) {soundOn = event.newValue !== 'off';updateSoundControls();if (!soundOn) stopAudio();}
 });
 let wasUnlocked = unlocked();
 new MutationObserver(() => {
  const active = unlocked();
  if (!active && wasUnlocked) {pendingWelcome = null;closeWelcome({locked: true});state = mergeWelcomeState(state);}
  else if (active && !wasUnlocked) void maybeWelcome().finally(() => recordActivity());
  wasUnlocked = active;
 }).observe(document.body, {attributes: true, attributeFilter: ['class']});
 new MutationObserver(() => {if (root.dataset.version !== '3') {pendingWelcome = null;closeWelcome();} else void maybeWelcome();}).observe(root, {attributes: true, attributeFilter: ['data-version']});
 document.addEventListener('alma:design-change', () => {addSoundSetting();if (root.dataset.version !== '3') {pendingWelcome = null;closeWelcome();} else void maybeWelcome();});
 // The design picker may be supplied by a deferred script after this module.
 const pickerObserver = new MutationObserver(() => {addSoundSetting();if (document.getElementById('welcome-sound-setting')) pickerObserver.disconnect();});
 pickerObserver.observe(document.body, {childList: true, subtree: true});
 addSoundSetting();readState();void maybeWelcome().finally(() => {if (unlocked()) recordActivity();});
}

if (typeof document !== 'undefined') {
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWelcome, {once: true});
 else installWelcome();
}
