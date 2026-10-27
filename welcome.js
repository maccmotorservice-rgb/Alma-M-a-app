import {createWelcomeAmbience} from './welcome-ambience.js?v=93';
import {createWelcomeVoice} from './welcome-voice.js?v=93';

/* Device-only welcome preferences. This module never reads or writes inventory. */
export const WELCOME_IDLE_MS = 2 * 60 * 60 * 1000;
export const WELCOME_TIME_ZONE = 'America/Guatemala';
export const WELCOME_STATE_KEY = 'alma-mia-welcome-state-v1';
const SOUND_KEY = 'alma-mia-welcome-sound';
const LEASE_KEY = 'alma-mia-welcome-lease-v1';
const emptyState = () => ({lastWelcomeAt: 0, lastWelcomeDay: '', lastActivityAt: 0});
const timestamp = value => Number.isFinite(value) && value > 0 ? value : 0;
const dayFormatters = new Map();

export function welcomeDay(now = Date.now(), timeZone = WELCOME_TIME_ZONE) {
 let formatter = dayFormatters.get(timeZone);
 if (!formatter) {formatter = new Intl.DateTimeFormat('en', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'});dayFormatters.set(timeZone, formatter);}
 const parts = formatter.formatToParts(new Date(now));
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

// A lit, iridescent surface: moving folds change their normals and reflections.
// Render into a private GPU canvas, then copy immediately into the visible canvas.
function createLiquidSurface() {
 const surface = document.createElement('canvas');
 const gl = surface.getContext('webgl', {alpha:false, antialias:false, depth:false, stencil:false, powerPreference:'low-power'});
 if (!gl) return null;
 const vertex = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}';
 const fragment = `precision mediump float;
 uniform vec2 resolution;uniform float time;
 float fold(vec2 p){
  p+=vec2(.42*sin(p.y*1.25+time*.34),.32*cos(p.x*1.1-time*.27));
  return sin(p.x*1.45+p.y*1.75+.95*sin(p.y*1.4-p.x*.65+time*.36)+time*.28)
   +.25*sin(p.x*2.4-p.y*1.8-time*.24);
 }
 vec3 pearl(float v){
  vec3 violet=vec3(.31,.12,.66),blue=vec3(.20,.37,.80),cyan=vec3(.42,.84,.88),pink=vec3(.91,.53,.73);
  vec3 c=mix(violet,blue,smoothstep(-1.1,.0,v));
  c=mix(c,cyan,smoothstep(-.15,.8,v));
  return mix(c,pink,smoothstep(.40,1.05,v));
 }
 void main(){
  vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y)*3.2;
  float h=fold(p),e=.018;
  vec2 slope=vec2(fold(p+vec2(e,0.0))-fold(p-vec2(e,0.0)),fold(p+vec2(0.0,e))-fold(p-vec2(0.0,e)))/(2.0*e);
  vec3 n=normalize(vec3(-slope*.7,1.0));vec3 view=vec3(0.0,0.0,1.0);
  vec3 light=normalize(vec3(-.55,.7,1.2));
  float diffuse=max(dot(n,light),0.0);
  vec3 halfLight=normalize(light+view);
  float sheen=pow(max(dot(n,halfLight),0.0),18.0);
  float sharp=pow(max(dot(n,normalize(normalize(vec3(.45,-.25,1.5))+view)),0.0),48.0);
  vec3 reflection=reflect(-view,n);
  float stripe=exp(-pow((reflection.x*.75+reflection.y*.65+.16*sin(time*.25))/.16,2.0));
  float edge=pow(1.0-max(n.z,0.0),2.0);
  vec3 colour=pearl(h*.65+p.x*.12+sin(time*.2)*.18);
  colour*=.38+diffuse*.72;
  colour+=vec3(.76,.88,1.0)*sheen*.55;
  colour+=vec3(1.0,.78,.65)*stripe*.5;
  colour+=vec3(.67,.55,1.0)*edge*.45;
  // Broad studio reflections, with a fine highlight instead of flat outlines.
  colour+=vec3(1.0,.92,.83)*sharp*.14;
  float vignette=1.0-.24*length((uv-.5)*1.25);colour*=vignette;
  gl_FragColor=vec4(colour,1.0);
 }`;
 function shader(type, source) {const result=gl.createShader(type);gl.shaderSource(result,source);gl.compileShader(result);if(!gl.getShaderParameter(result,gl.COMPILE_STATUS)) {gl.deleteShader(result);return null;}return result;}
 const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
 if (!vs || !fs) return null;
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const resolution=gl.getUniformLocation(program,'resolution'),time=gl.getUniformLocation(program,'time');
 return (context,w,h,t)=>{if(gl.isContextLost())return false;if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;gl.viewport(0,0,w,h);}gl.uniform2f(resolution,w,h);gl.uniform1f(time,t);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);context.drawImage(surface,0,0);return true;};
}

// Draw the liquid itself each frame: this is not a pan over a generated image.
function installLiquidWelcome(overlay) {
 const root = document.documentElement, scene = overlay.querySelector('.welcome-scene');
 const canvas = document.createElement('canvas');canvas.className = 'welcome-liquid-canvas';canvas.setAttribute('aria-hidden', 'true');scene.append(canvas);
 const context = canvas.getContext('2d');if (!context) return;
 const renderSurface = createLiquidSurface();
 const button = document.createElement('button');button.type = 'button';button.className = 'welcome-motion';overlay.querySelector('.welcome-controls').append(button);
 // Autoplay was explicitly requested for this welcome; pause lasts only until it closes.
 let enabled = true, wasHidden = overlay.hidden;
 let frame = 0, previous = 0, time = 0, width = 0, height = 0;
 const liquid = () => root.dataset.design === 'modern' && root.dataset.version === '4';
 const allowed = () => enabled;
 const visible = () => liquid() && !overlay.hidden && !document.hidden && !overlay.classList.contains('welcome-paused');
 function draw(t) {
  const w = canvas.width, h = canvas.height;
  if (renderSurface?.(context,w,h,t)) return;
  context.clearRect(0, 0, w, h);
  const base = context.createLinearGradient(0, 0, w, h);base.addColorStop(0, '#111635');base.addColorStop(.5, '#402065');base.addColorStop(1, '#0a2444');context.fillStyle = base;context.fillRect(0, 0, w, h);
  // Broad ribbons with independently changing curves and metallic highlight edges.
  for (let i = 0; i < 5; i++) {
   const phase = t * .72 + i * 1.31;
   const y = h * (.08 + i * .21), amplitude = h * .24;
   const a = y + Math.sin(phase) * amplitude, b = y + Math.cos(phase * 1.23) * amplitude;
   const c = y + Math.sin(phase * .91 + 2) * amplitude, end = y + Math.cos(phase + 1) * amplitude;
   const ribbon = context.createLinearGradient(0, y - h * .12, w, y + h * .3);
   const colors = [['#2557af','#6be6ed','#6862e4'],['#472aa8','#ae91ff','#e9b8ec'],['#a23488','#f5b9a9','#7053c2'],['#145e83','#7ae1dc','#4a50ab'],['#3b287b','#b49bf7','#30577b']][i];
   ribbon.addColorStop(0, colors[0]);ribbon.addColorStop(.3, colors[2]);ribbon.addColorStop(.46 + Math.sin(phase) * .08, '#f0dcea');ribbon.addColorStop(.57, colors[1]);ribbon.addColorStop(.72, colors[0]);ribbon.addColorStop(1, colors[2]);
   context.beginPath();context.moveTo(-w * .1, a);context.bezierCurveTo(w * .25, b - h * .35, w * .6, c + h * .35, w * 1.1, end);context.lineTo(w * 1.1, end + h * .27);context.bezierCurveTo(w * .6, c + h * .52, w * .25, b - h * .12, -w * .1, a + h * .27);context.closePath();context.fillStyle = ribbon;context.fill();
   context.beginPath();context.moveTo(-w * .1, a);context.bezierCurveTo(w * .25, b - h * .35, w * .6, c + h * .35, w * 1.1, end);context.strokeStyle = '#e3e5ff70';context.lineWidth = Math.max(1, w / 650);context.stroke();
  }
  const shade = context.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, Math.max(w,h) * .7);shade.addColorStop(0, '#090e2420');shade.addColorStop(1, '#080d3260');context.fillStyle = shade;context.fillRect(0, 0, w, h);
 }
 function tick(now) {
  frame = 0;if (!visible() || !allowed()) return;
  if (!previous || now - previous >= 32) {time += previous ? Math.min((now - previous) / 1000, .08) : 0;previous = now;draw(time);}
  frame = requestAnimationFrame(tick);
 }
 function sync() {
  cancelAnimationFrame(frame);frame = 0;previous = 0;
  button.hidden = !liquid();button.textContent = allowed() ? 'Pausar fondo animado' : 'Activar fondo animado';button.setAttribute('aria-pressed', String(allowed()));
  if (!visible()) return;
  const bounds = scene.getBoundingClientRect(), scale = Math.min(devicePixelRatio || 1, 1.5, 1200 / Math.max(bounds.width, bounds.height));
  const nextWidth = Math.max(1, Math.round(bounds.width * scale)), nextHeight = Math.max(1, Math.round(bounds.height * scale));
  if (width !== nextWidth || height !== nextHeight) {width = canvas.width = nextWidth;height = canvas.height = nextHeight;}
  draw(time);if (allowed()) frame = requestAnimationFrame(tick);
 }
 button.onclick = () => {enabled = !enabled;sync();};
 new MutationObserver(() => {if (wasHidden && !overlay.hidden) enabled = true;wasHidden = overlay.hidden;sync();}).observe(overlay, {attributes:true, attributeFilter:['hidden','class']});
 new MutationObserver(sync).observe(root, {attributes:true, attributeFilter:['data-design','data-version']});
 new ResizeObserver(sync).observe(scene);document.addEventListener('visibilitychange', sync);sync();
}

function installWelcome() {
 const root = document.documentElement;
 let state = emptyState(), lastPersisted = 0, checkPromise = null, overlay = null, pendingWelcome = null;
 let returnFocus = null, inertRegions = [], focusTimer = 0, welcomeEpoch = 0;
 let soundOn = true, audioContext = null, playing = [], audioNodes = [], activeMaster = null, audioTimer = 0, audioGeneration = 0;
 let introPending = false, introStarted = false, introAttempting = false, introAttemptId = 0;
 let accessIntroActive = false, introPlayback = null, introRequest = null, introOffset = 0;
 const tabId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
 const unlocked = () => !document.body.classList.contains('access-locked');
 const eligibleScreen = () => unlocked() && ['3','4'].includes(root.dataset.version) && document.visibilityState !== 'hidden';
 // Audio remains eligible while the tab is hidden; screen presentation does not.
 const introAllowed = () => soundOn && ['3','4'].includes(root.dataset.version) && (accessIntroActive || (unlocked() && overlay && !overlay.hidden));
 const voice = createWelcomeVoice({allowed: () => soundOn && eligibleScreen()});
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
  const preview = document.getElementById('welcome-preview-setting'), hidePreview = !['3','4'].includes(root.dataset.version);if (preview && preview.hidden !== hidePreview) preview.hidden = hidePreview;
  for (const id of ['welcome-sound', 'welcome-sound-setting', 'access-welcome-sound']) {
   const button = document.getElementById(id);if (!button) continue;
   const pressed = String(soundOn), label = id === 'welcome-sound-setting' ? `Sonido de bienvenida: ${soundOn ? 'activado' : 'desactivado'}` : `Sonido ${soundOn ? 'activado' : 'desactivado'}`;
   if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
   if (button.textContent !== label) button.textContent = label;
  }
 }
 function stopAudio(closeContext = false, fade = false) {
  audioGeneration++;clearTimeout(audioTimer);voice.cancel();introPlayback = null;introRequest = null;introOffset = 0;
  const sources = playing, nodes = audioNodes, master = activeMaster;
  playing = [];audioNodes = [];activeMaster = null;
  const disconnect = () => {for (const node of nodes) {try {node.disconnect();} catch {}}};
  const soften = fade && !closeContext && audioContext?.state === 'running' && master;
  if (soften) {
   // A brief release prevents a click when the intro gives way to the entry phrase.
   const now = audioContext.currentTime, release = typeof fade === 'number' ? fade : .03;
   master.gain.cancelScheduledValues?.(now);master.gain.setValueAtTime(master.gain.value, now);
   master.gain.linearRampToValueAtTime(0, now + release);
   for (const source of sources) {try {source.stop(now + release + .005);} catch {}}
   setTimeout(disconnect, release * 1000 + 30);
  } else {
   for (const source of sources) {try {source.stop();} catch {}}
   disconnect();
  }
  if (closeContext && audioContext) {const old = audioContext;audioContext = null;old.close().catch(() => {});}
 }
 function getAudioContext() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
  return audioContext;
 }
 function resumeAudio(context) {
  // Invoke resume synchronously inside a trusted gesture when one is available.
  // A restored session can also try autoplay; browser refusal never blocks access.
  try {return Promise.resolve(context.resume()).catch(() => {});} catch {return Promise.resolve();}
 }
 function warmAudio() {
  if (!soundOn || !['3','4'].includes(root.dataset.version) || document.visibilityState === 'hidden') return;
  try {
   const context = getAudioContext();if (!context) return;
   // Start rendering in the background while authentication or the picker closes.
   // Playback is limited to a due login or the open welcome below.
   void createWelcomeAmbience(context).catch(() => {});
   if (context.state === 'running') return;
   void resumeAudio(context);
   // A silent frame in the original gesture also unlocks older iOS Web Audio.
   const source = context.createBufferSource(), gain = context.createGain();
   source.buffer = context.createBuffer(1, 1, context.sampleRate);gain.gain.value = 0;
   source.connect(gain);gain.connect(context.destination);source.start();
   source.onended = () => {source.disconnect();gain.disconnect();};
  } catch {}
 }
 function playWelcomeIntro() {
  if (!introAllowed()) return Promise.resolve(false);
  if (introPlayback && introPlayback.context.state !== 'closed') {
   // Keep this source and its audio clock: suspend/resume retains the exact phrase.
   const {context} = introPlayback;
   if (context.state === 'running') return Promise.resolve(true);
   return Promise.race([resumeAudio(context), new Promise(resolve => setTimeout(resolve, 240))]).then(() => introAllowed() && introPlayback?.context === context && context.state === 'running');
  }
  if (introRequest) return introRequest;
  if (introPlayback) {
   // A destroyed context is unusual, but its last audio time still gives an offset.
   const {context, start, offset, buffer} = introPlayback;
   const position = (offset + Math.max(0, context.currentTime - start)) % buffer.duration;
   stopAudio();introOffset = position;
  }
  const generation = audioGeneration;
  const task = (async () => {
   try {
    const context = getAudioContext();if (!context) return false;
    const ambience = createWelcomeAmbience(context);
    if (context.state !== 'running') await Promise.race([resumeAudio(context), new Promise(resolve => setTimeout(resolve, 240))]);
    const buffer = await ambience;
    // A slow download cannot start music after mute, failed login, dismissal or entry.
    if (generation !== audioGeneration || context !== audioContext || context.state !== 'running' || !introAllowed()) return false;
    const start = context.currentTime + .025, offset = introOffset % buffer.duration;
    const master = context.createGain(), source = context.createBufferSource();
    master.gain.setValueAtTime(0, start);master.gain.linearRampToValueAtTime(.22, start + 1.15);
    master.connect(context.destination);source.buffer = buffer;source.loop = true;source.loopStart = 0;source.loopEnd = buffer.duration;
    source.connect(master);playing.push(source);audioNodes.push(source, master);activeMaster = master;
    introPlayback = {context, source, start, offset, buffer};
    source.onended = () => {try {source.disconnect();} catch {}};
    source.start(start, offset);
    return true;
   } catch {return false;}
  })();
  introRequest = task;
  void task.finally(() => {if (introRequest === task) introRequest = null;});
  return task;
 }
 function recoverWelcomeAudio() {
  if (!introAllowed()) return;
  if (introPlayback || accessIntroActive) void playWelcomeIntro();
  else {introStarted = false;introPending = true;tryWelcomeIntro();}
 }
 function finishAccessIntro() {
  if (!accessIntroActive) return;
  accessIntroActive = false;
  if (!overlay || overlay.hidden) stopAudio(false, .14);
 }
 function syncPrivateAccessIntro() {
  const screen = document.getElementById('access-screen');
  const visible = !unlocked() && screen && !screen.hidden;
  const wanted = visible && ['3','4'].includes(root.dataset.version) && currentEligibility().due;
  let control = document.getElementById('access-welcome-sound');
  if (wanted && !control) {
   const card = screen.querySelector('.access-card');
   if (card) {
    control = document.createElement('button');control.type = 'button';control.id = 'access-welcome-sound';control.className = 'welcome-sound';control.onclick = toggleSound;
    card.append(control);
   }
  }
  if (control && control.hidden === Boolean(wanted)) control.hidden = !wanted;
  updateSoundControls();
  if (wanted && soundOn) {
   // Try as soon as private access is shown, before any fields or submit gesture.
   // A browser that blocks autoplay is unlocked by any later trusted interaction.
   if (!accessIntroActive && document.visibilityState === 'hidden') return;
   accessIntroActive = true;void playWelcomeIntro();
  } else if (!unlocked()) finishAccessIntro();
 }
 // Authentication signals contain no credentials. They keep the existing source
 // through login, including retries while the private access card remains visible.
 document.addEventListener('alma:login-start', () => {syncPrivateAccessIntro();warmAudio();recoverWelcomeAudio();});
 document.addEventListener('alma:login-settled', () => {syncPrivateAccessIntro();void maybeWelcome();});
 async function playPortalSound(kind) {
  if (kind === 'intro') return playWelcomeIntro();
  if (!soundOn || !eligibleScreen() || !overlay || overlay.hidden) return false;
  stopAudio(false, true);const generation = audioGeneration;
  try {
   const context = getAudioContext();if (!context) return false;
   if (context.state !== 'running') await Promise.race([resumeAudio(context), new Promise(resolve => setTimeout(resolve, 240))]);
   if (context.state !== 'running' || generation !== audioGeneration || !eligibleScreen() || overlay.hidden || !soundOn) return false;
   const start = context.currentTime + .025, master = context.createGain();
   master.gain.value = kind === 'entry' ? .105 : .075;master.connect(context.destination);audioNodes.push(master);activeMaster = master;
   function tone(frequency, offset, duration, level, {attack = .035, glide = 0} = {}) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = 'sine';oscillator.frequency.setValueAtTime(frequency, start + offset);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(frequency + glide, start + offset + duration);
    envelope.gain.setValueAtTime(0, start + offset);
    envelope.gain.linearRampToValueAtTime(level, start + offset + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
    oscillator.connect(envelope);envelope.connect(master);
    oscillator.start(start + offset);oscillator.stop(start + offset + duration + .025);
    playing.push(oscillator);audioNodes.push(oscillator, envelope);
    oscillator.onended = () => {oscillator.disconnect();envelope.disconnect();};
   }
   {
    // The original phrase, redesigned as rounded glass notes with a final zen sparkle.
    for (const [frequency, offset] of [[554.365, 0], [659.255, .27], [830.609, .55], [739.989, .94]]) {
     tone(frequency, offset, .9, .55, {attack: .045});
     tone(frequency * 2, offset + .018, .53, .055, {attack: .025});
    }
    tone(277.183, 0, 2.4, .19, {attack: .32});
    tone(1479.978, 1.52, .48, .19, {attack: .018});
    tone(1975.533, 1.72, .83, .09, {attack: .025, glide: 5});
   }
   audioTimer = setTimeout(() => {
    if (generation !== audioGeneration) return;
    for (const node of audioNodes) {try {node.disconnect();} catch {}}
    playing = [];audioNodes = [];activeMaster = null;
   }, 3100);
   return true;
  } catch {return false;}
 }
 function tryWelcomeIntro() {
  if (!introPending || introStarted || introAttempting || !soundOn || !overlay || overlay.hidden) return;
  const epoch = welcomeEpoch, attempt = ++introAttemptId;introAttempting = true;
  void playPortalSound('intro').then(played => {
   if (epoch !== welcomeEpoch || attempt !== introAttemptId) return;
   introAttempting = false;
   if (played) {introStarted = true;introPending = false;}
  });
 }
 function toggleSound(event) {
  event?.preventDefault();soundOn = !soundOn;storageSet(SOUND_KEY, soundOn ? 'on' : 'off');updateSoundControls();
  if (!soundOn) {introAttemptId++;introAttempting = false;introStarted = false;introPending = false;stopAudio(false, .14);}
  else if (overlay && !overlay.hidden) {warmAudio();introStarted = false;introPending = true;tryWelcomeIntro();}
  else {warmAudio();syncPrivateAccessIntro();}
 }
 function previewWelcome(event) {
  event?.preventDefault();if (!eligibleScreen()) return;
  warmAudio();
  const now = Date.now(), decision = currentEligibility(now);
  if (decision.due) {state = claimWelcome(state, now);persistState();}
  pendingWelcome = null;
  // close events are queued: install the preview immediately so they cannot
  // compete with the ordinary daily/idle welcome or interrupt the open picker.
  const picker = document.getElementById('design-picker');
  if (picker instanceof HTMLDialogElement && picker.open) picker.close();
  else if (picker?.tagName === 'DETAILS') picker.open = false;
  showWelcome();if (document.getElementById('design-toggle')) returnFocus = document.getElementById('design-toggle');recordActivity(now);
 }
 function addSoundSetting() {
  const picker = document.getElementById('design-picker');if (!picker) return;
  const target = picker.querySelector('#design-preferences,.design-picker-options,.design-options') || picker;
  if (!document.getElementById('welcome-sound-setting')) {
   const button = document.createElement('button');button.type = 'button';button.id = 'welcome-sound-setting';button.className = 'welcome-sound-setting';button.onclick = toggleSound;target.append(button);
  }
  if (!document.getElementById('welcome-preview-setting')) {
   const button = document.createElement('button');button.type = 'button';button.id = 'welcome-preview-setting';button.className = 'welcome-preview-setting';button.textContent = 'Probar bienvenida';button.onclick = previewWelcome;target.append(button);
  }
  updateSoundControls();
 }
 function restoreRegions() {
  for (const [element, previous] of inertRegions) if (element.isConnected) element.inert = previous;
  inertRegions = [];
 }
 function closeWelcome({locked = false, preserveAudio = false} = {}) {
  accessIntroActive = false;clearTimeout(focusTimer);welcomeEpoch++;introAttemptId++;introPending = false;introAttempting = false;
  if (!preserveAudio) stopAudio(locked, .18);
  if (!overlay) return;
  overlay.hidden = true;root.classList.remove('welcome-open');if (document.body.classList.contains('welcome-open')) document.body.classList.remove('welcome-open');restoreRegions();
  if (!locked && returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({preventScroll: true});
  returnFocus = null;
 }
 function showWelcome() {
  if (!eligibleScreen()) return;
  if (!overlay) {
   overlay = document.createElement('section');overlay.id = 'studio-welcome';overlay.hidden = true;
   overlay.setAttribute('role', 'dialog');overlay.setAttribute('aria-modal', 'true');overlay.setAttribute('aria-labelledby', 'welcome-greeting');overlay.setAttribute('aria-describedby', 'welcome-copy');
   overlay.innerHTML = '<div class="welcome-scene" aria-hidden="true"><div class="welcome-orbit welcome-orbit-one"></div><div class="welcome-orbit welcome-orbit-two"></div><div class="welcome-orbit welcome-orbit-three"></div></div><div class="welcome-card"><button type="button" class="welcome-close" id="welcome-close" aria-label="Cerrar bienvenida">×</button><div class="welcome-mark"><img src="./assets/logo.png" alt="Alma Mía"></div><p class="welcome-eyebrow">ALMA MÍA · CONTROL INTERNO</p><h1 class="welcome-greeting" id="welcome-greeting"></h1><p class="welcome-copy" id="welcome-copy">Consulta inventario, notas de venta y reportes.</p><div class="welcome-controls"><button type="button" class="welcome-enter" id="welcome-enter">Acceder a mi portal <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 18 18 6M6 6h12v12"/></svg></button><button type="button" class="welcome-sound" id="welcome-sound" aria-pressed="true"></button></div></div>';
   document.body.append(overlay);
   installLiquidWelcome(overlay);
   document.getElementById('welcome-close').onclick = () => closeWelcome();
   document.getElementById('welcome-sound').onclick = toggleSound;
   document.getElementById('welcome-enter').onclick = async () => {
    const button = document.getElementById('welcome-enter');button.disabled = true;
    // Start sound in this gesture, before dismissing. Failure to unlock audio never blocks entry.
    introAttemptId++;introPending = false;introAttempting = false;warmAudio();
    voice.prime();
    const user = document.getElementById('session-user')?.value;
    const attempt = playPortalSound('entry');
    void attempt.then(played => {
     if (!played) return;
     const generation = audioGeneration, finalNote = playing.slice(-1)[0];
     const valid = () => generation === audioGeneration && soundOn && eligibleScreen() && document.getElementById('session-user')?.value === user;
     // The greeting follows the real final note, including its release. It never
     // races the jingle or delays opening the workspace.
     finalNote?.addEventListener('ended', () => {if (valid()) voice.speak(user, valid);}, {once: true});
    });
    await Promise.race([attempt, new Promise(resolve => setTimeout(resolve, 350))]);
    if (!overlay.hidden) closeWelcome({preserveAudio: true});button.disabled = false;
   };
   overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();closeWelcome();return;}
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]')].filter(element => element.tabIndex >= 0 && !element.hidden);
    const first = controls[0], last = controls.slice(-1)[0];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
   });
  }
  const user = document.getElementById('session-user')?.value;
  document.getElementById('welcome-greeting').textContent = user === 'Ximena' ? 'Bienvenida, Ximena.' : user === 'Luis' ? 'Bienvenido, Luis.' : 'Bienvenido a tu portal.';
  returnFocus = document.activeElement;
  inertRegions = [...document.body.children].filter(element => element !== overlay && !/^(SCRIPT|LINK|STYLE)$/.test(element.tagName)).map(element => [element, element.inert]);
  for (const [element] of inertRegions) element.inert = true;
  welcomeEpoch++;introPending = true;introStarted = false;introAttempting = false;overlay.classList.remove('welcome-paused');overlay.hidden = false;accessIntroActive = false;document.body.classList.add('welcome-open');root.classList.add('welcome-open');updateSoundControls();
  // Move focus once; keyboard users can choose sound or continue immediately.
  focusTimer = setTimeout(() => {if (!overlay.hidden) document.getElementById('welcome-enter').focus({preventScroll: true});}, 30);
  if (!reducedMotion.matches && root.dataset.effects !== 'off') overlay.querySelector('.welcome-card').animate?.([{opacity: 0, transform: 'translateY(18px) scale(.975)'}, {opacity: 1, transform: 'translateY(0) scale(1)'}], {duration: 700, easing: 'cubic-bezier(.16,1,.3,1)'});
  tryWelcomeIntro();
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
  if (!decision.due) {finishAccessIntro();return Promise.resolve();}
  if (document.querySelector('dialog[open]')) {deferWelcome(decision);finishAccessIntro();return Promise.resolve();}
  checkPromise = withDeviceLock(() => {
   const now = Date.now(), decision = currentEligibility(now);
   if (!eligibleScreen() || !decision.due) return;
   if (document.querySelector('dialog[open]')) {deferWelcome(decision);return;}
   pendingWelcome = null;state = claimWelcome(state, now);persistState();showWelcome();
  }).catch(() => {}).finally(() => {checkPromise = null;if (eligibleScreen() && (!overlay || overlay.hidden)) finishAccessIntro();});
  return checkPromise;
 }
 function checkThenActivity() {
  if (!unlocked() || document.visibilityState === 'hidden') return;
  const now = Date.now();
  if (eligibleScreen() && currentEligibility(now).due) void maybeWelcome().finally(() => recordActivity(now));
  else recordActivity(now);
 }
 function handleActivity(event) {
  if (!event.isTrusted) return;
  if (['pointerdown', 'click', 'touchstart', 'touchend', 'keydown'].includes(event.type)) {
   // Cancel a still-pending autoplay before resuming in the entry/dismiss gesture.
   // Otherwise a resumed intro could slip in between pointerdown and click.
   const control = event.target instanceof Element ? event.target.closest('#welcome-enter,#welcome-close,#welcome-sound,#access-welcome-sound') : null;
   const dismissal = event.type === 'keydown' && event.key === 'Escape';
   if ((overlay && !overlay.hidden && (control || dismissal)) || control?.id === 'access-welcome-sound') {introPending = false;stopAudio(false, control?.id === 'welcome-enter');}
   warmAudio();
   if (!control && !dismissal) {syncPrivateAccessIntro();tryWelcomeIntro();}
  }
  checkThenActivity();
 }
 for (const type of ['pointerdown', 'click', 'keydown', 'wheel', 'touchstart', 'touchend']) document.addEventListener(type, handleActivity, {passive: true, capture: true});
 let lastPointerActivity = 0;
 document.addEventListener('pointermove', event => {if (event.isTrusted && Date.now() - lastPointerActivity > 30000) {lastPointerActivity = Date.now();checkThenActivity();}}, {passive: true});
 window.addEventListener('focus', () => {checkThenActivity();syncPrivateAccessIntro();recoverWelcomeAudio();});
 window.addEventListener('pageshow', () => {overlay?.classList.toggle('welcome-paused', document.visibilityState === 'hidden');checkThenActivity();syncPrivateAccessIntro();recoverWelcomeAudio();});
 // Dialog close does not bubble. Capture it so a due welcome waits for forms or the design picker.
 document.addEventListener('close', event => {if (event.target instanceof HTMLDialogElement) void maybeWelcome();}, true);
 document.addEventListener('visibilitychange', () => {
  overlay?.classList.toggle('welcome-paused', document.visibilityState === 'hidden');
  if (document.visibilityState === 'hidden') {
   if (unlocked()) persistState();
   // Background tabs keep the same source playing. Only visual effects pause.
  } else {checkThenActivity();syncPrivateAccessIntro();recoverWelcomeAudio();}
 });
 window.addEventListener('pagehide', event => {
  overlay?.classList.add('welcome-paused');
  if (unlocked()) persistState();
  if (event.persisted) {
   // BFCache freezes the page, unlike a tab switch. Suspend without stopping or
   // closing the source, then pageshow resumes this same playback position.
   if (audioContext?.state === 'running') void audioContext.suspend().catch(() => {});
  } else {accessIntroActive = false;introAttemptId++;introAttempting = false;introPending = false;stopAudio(true);}
 });
 window.addEventListener('storage', event => {
  if (event.key === WELCOME_STATE_KEY) {readState();if (accessIntroActive && !currentEligibility().due) finishAccessIntro();syncPrivateAccessIntro();}
  if (event.key === SOUND_KEY) {
   soundOn = event.newValue !== 'off';updateSoundControls();
   introAttemptId++;introAttempting = false;introStarted = false;introPending = Boolean(soundOn && overlay && !overlay.hidden);
   if (!soundOn) stopAudio(false, .14);else {syncPrivateAccessIntro();tryWelcomeIntro();}
  }
 });
 let wasUnlocked = unlocked();
 new MutationObserver(() => {
  const active = unlocked();
  if (!active && wasUnlocked) {pendingWelcome = null;closeWelcome({locked: true});state = mergeWelcomeState(state);}
  else if (active && !wasUnlocked) void maybeWelcome().finally(() => recordActivity());
  wasUnlocked = active;syncPrivateAccessIntro();
 }).observe(document.body, {attributes: true, attributeFilter: ['class']});
 new MutationObserver(() => {updateSoundControls();if (!['3','4'].includes(root.dataset.version)) {pendingWelcome = null;closeWelcome();syncPrivateAccessIntro();} else {syncPrivateAccessIntro();void maybeWelcome();}}).observe(root, {attributes: true, attributeFilter: ['data-version']});
 document.addEventListener('alma:design-change', () => {addSoundSetting();if (!['3','4'].includes(root.dataset.version)) {pendingWelcome = null;closeWelcome();syncPrivateAccessIntro();} else {syncPrivateAccessIntro();void maybeWelcome();}});
 // The design picker may be supplied by a deferred script after this module.
 const pickerObserver = new MutationObserver(() => {addSoundSetting();if (document.getElementById('welcome-sound-setting')) pickerObserver.disconnect();});
 pickerObserver.observe(document.body, {childList: true, subtree: true});
 const accessScreen = document.getElementById('access-screen');
 if (accessScreen) new MutationObserver(syncPrivateAccessIntro).observe(accessScreen, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']});
 addSoundSetting();readState();syncPrivateAccessIntro();void maybeWelcome().finally(() => {if (unlocked()) recordActivity();});
}

if (typeof document !== 'undefined') {
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWelcome, {once: true});
 else installWelcome();
}
