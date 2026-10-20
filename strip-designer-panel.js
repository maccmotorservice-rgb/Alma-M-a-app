import {validateStripDesign, renderStripDesign, encodeStripDesignPng, stripInkColor} from './strip-designer.js?v=70';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const key = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const colors = [['#d5a617','Dorado'],['#df8799','Rosa'],['#18794e','Verde'],['#2c72be','Azul'],['#8860bc','Violeta'],['#29272e','Grafito']];
const textColors = [['#ffffff','Blanco'],['#29272e','Grafito'],['#d5a617','Dorado'],['#df8799','Rosa'],['#18794e','Verde'],['#2c72be','Azul']];
const initialDraft = () => ({name:'',color:'#d5a617',size:100,category:'Unisex',qty:1,textColor:'auto',textScale:1,textPosition:50});
const downloadName = design => (design.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,65) || 'Alma-Mia') + (design.size === 50 ? '-01' : '-02') + '.png';

// The parent printing library saves artwork and synchronizes it between members.
export function createStripDesignerPanel({catalog, notify, allowed, onSave, onLibrary}) {
 let draft = initialDraft(), busy = false, busyAction = '', saved = null, downloadUrl = '', downloadFile = '', downloadStatus = '', lastTextColor = '#ffffff';
 let epoch = 0, previewTicket = 0, previewTimer = 0, rendered = null, previewMode = 'front', listening = false;
 const root = () => document.querySelector('#strip-designer');
 const node = id => root()?.querySelector('#' + id);
 const productForName = () => catalog.find(product => key(product.name) === key(draft.name));
 function releaseDownload() {if (downloadUrl) URL.revokeObjectURL(downloadUrl);downloadUrl = '';downloadFile = '';downloadStatus = '';}
 function renderDownloadStatus() {
  const target = node('strip-design-download-status');if (!target) return;target.textContent = downloadStatus;
  if (downloadUrl) {const anchor = document.createElement('a');anchor.href = downloadUrl;anchor.download = downloadFile;anchor.textContent = 'Volver a descargar';target.append(document.createTextNode(' '),anchor);}
 }
 function setDownloadStatus(message) {downloadStatus = message;renderDownloadStatus();}
 function automaticInk() {return stripInkColor(/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#d5a617');}
 function releasePreview() {if (rendered?.canvas) {rendered.canvas.width = 1;rendered.canvas.height = 1;}rendered = null;}
 function error(message = '') {const target = node('strip-design-error');if (target) target.textContent = message;}
 function canonical(input = draft) {return validateStripDesign({...input,size:Number(input.size),textScale:Number(input.textScale),qty:1});}
 function matchDescription() {
  const output = node('strip-design-match');if (!output) return;
  const product = productForName();
  output.textContent = !draft.name.trim() ? 'Elige un perfume del catálogo o escribe un nombre nuevo.' : product ? 'Catálogo · ' + (product.displayReference ?? product.reference) + ' · ' + product.category : 'Perfume nuevo · No está dentro del catálogo. Crear la tira no agrega productos al catálogo.';
  output.dataset.match = product ? 'catalog' : draft.name.trim() ? 'custom' : 'empty';
 }
 function setPreviewStatus(message) {const output = node('strip-design-preview-status');if (output) output.textContent = message;}
 function drawPreview() {
  const stage = node('strip-design-preview-stage');if (!stage || !rendered) return;
  const source = rendered.canvas, face = rendered.faceRect, canvas = document.createElement('canvas');
  canvas.className = previewMode === 'front' ? 'strip-preview-front-canvas' : 'strip-preview-full-canvas';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',(previewMode === 'front' ? 'Frente de la tira de ' : 'Tira completa de ') + (draft.name.trim() || 'tu perfume'));
  if (previewMode === 'front' && face) {
   canvas.width = Math.max(1,Math.ceil(face.w));canvas.height = Math.max(1,Math.ceil(face.h));canvas.getContext('2d').drawImage(source,face.x,face.y,face.w,face.h,0,0,canvas.width,canvas.height);
  } else {canvas.width = source.width;canvas.height = source.height;canvas.getContext('2d').drawImage(source,0,0);}
  stage.dataset.previewMode = previewMode;stage.replaceChildren(canvas);stage.setAttribute('aria-busy','false');
  const physical = rendered.physical, caption = node('strip-design-preview-caption');
  if (caption) caption.textContent = `${Number(draft.size)} ml · ${(physical.w/10).toFixed(2)} × ${(physical.h/10).toFixed(2)} cm · ${previewMode === 'front' ? 'Vista ampliada del frente. La imagen guardada incluye la tira completa.' : 'Tira completa con ambas caras y etiqueta central.'}`;
  root()?.querySelectorAll('[data-strip-preview]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripPreview === previewMode)));
 }
 function schedulePreview(immediate = false) {
  clearTimeout(previewTimer);const ticket = ++previewTicket, token = epoch;
  previewTimer = setTimeout(async () => {
   if (!allowed() || !root()) return;
   let design;
   try {design = canonical({...draft,name:draft.name.trim() || 'Nombre del perfume'});}
   catch (failure) {setPreviewStatus(failure.message);node('strip-design-preview-stage')?.setAttribute('aria-busy','false');return;}
   node('strip-design-preview-stage')?.setAttribute('aria-busy','true');setPreviewStatus('Actualizando vista previa…');
   try {
    const result = await renderStripDesign(design,{dpi:120});
    if (token !== epoch || ticket !== previewTicket || !allowed() || !root()) {result.canvas.width = 1;result.canvas.height = 1;return;}
    releasePreview();rendered = result;drawPreview();setPreviewStatus('Vista previa actualizada.');
   } catch (failure) {if (token === epoch && ticket === previewTicket && allowed()) {setPreviewStatus('No se pudo mostrar la vista previa: ' + failure.message);node('strip-design-preview-stage')?.setAttribute('aria-busy','false');}}
  },immediate ? 0 : 160);
 }
 function savedResult() {
  const output = node('strip-design-saved');if (!output) return;
  output.innerHTML = saved ? `<div class="strip-design-saved-message" role="status"><strong>Tira guardada</strong><p>${esc(saved.name)} · ${saved.size} ml. Ya está disponible en la biblioteca compartida de Luis y Ximena.</p></div><div class="label-actions"><button type="button" class="primary" id="strip-design-library">Ir a imprimir</button></div>` : '';
  const button = node('strip-design-library');if (button) button.onclick = () => {if (allowed()) onLibrary(saved.id);};
 }
 function textControls() {
  const automatic = draft.textColor === 'auto', color = automatic ? automaticInk() : draft.textColor;
  const toggle = node('strip-design-text-auto');if (toggle) toggle.checked = automatic;
  const picker = node('strip-design-text-color');if (picker) picker.value = /^#[0-9a-f]{6}$/i.test(color) ? color : lastTextColor;
  const hex = node('strip-design-text-hex');if (hex) hex.value = color.toUpperCase();
  root()?.querySelectorAll('[data-strip-text-color]').forEach(button => button.setAttribute('aria-pressed',String(!automatic && button.dataset.stripTextColor === draft.textColor.toLowerCase())));
  const percentage = Math.round(Number(draft.textScale) * 100), scale = node('strip-design-text-scale'), output = node('strip-design-text-scale-value');
  if (scale) {scale.value = percentage;scale.setAttribute('aria-valuetext',percentage + ' %');}if (output) output.textContent = percentage + ' %';
  const position=node('strip-design-text-position'),positionOutput=node('strip-design-text-position-value');if(position){position.value=draft.textPosition;position.setAttribute('aria-valuetext',draft.textPosition+' %');}if(positionOutput)positionOutput.textContent=draft.textPosition+' %';
 }
 function fillDraft() {
  for (const [id,field] of [['strip-design-name','name'],['strip-design-size','size'],['strip-design-category','category'],['strip-design-color','color'],['strip-design-hex','color']]) {const input = node(id);if (input) input.value = draft[field];}
  root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor === String(draft.color).toLowerCase())));
  textControls();matchDescription();error();schedulePreview(true);
 }
 function disableForm(disabled) {
  root()?.querySelectorAll('input,select,button').forEach(control => control.disabled = disabled);
  const save = node('strip-design-save'), download = node('strip-design-download');
  if (save) save.textContent = disabled && busyAction === 'save' ? 'Añadiendo tira…' : 'Añadir a la biblioteca';
  if (download) download.textContent = disabled && busyAction === 'download' ? 'Preparando imagen…' : 'Descargar imagen';
 }
 async function exportArtwork(action) {
  if (busy || !allowed()) return;
  let design;try {design = canonical();}catch (failure) {error(failure.message);return;}
  busy = true;busyAction = action;error();disableForm(true);if (action === 'download') {releaseDownload();setDownloadStatus('Preparando imagen PNG…');}
  const token = epoch, cancelled = () => token !== epoch || !allowed();let artwork;
  try {
   artwork = await renderStripDesign(design,{dpi:300});if (cancelled()) return;
   if (action === 'save') {
    const record = await onSave(design,artwork,{cancelled});if (cancelled()) return;
    saved = {id:record.id,name:design.name,size:design.size};savedResult();setPreviewStatus('Tira añadida a la biblioteca.');
   } else {
    const blob = await encodeStripDesignPng(artwork.canvas,{dpi:300});if (cancelled()) return;
    releaseDownload();downloadUrl = URL.createObjectURL(blob);downloadFile = downloadName(design);
    const anchor = document.createElement('a');anchor.href = downloadUrl;anchor.download = downloadFile;anchor.hidden = true;document.body.append(anchor);
    try {anchor.click();}finally {anchor.remove();}
    setDownloadStatus('Descarga iniciada: ' + design.name + ' · ' + design.size + ' ml.');
   }
  } catch (failure) {if (!cancelled()) {error((action === 'save' ? 'No se pudo añadir la tira: ' : 'No se pudo descargar la imagen: ') + failure.message);if (action === 'download') setDownloadStatus('');notify('Revisa el mensaje del formulario para continuar.');}}
  finally {if (artwork?.canvas) {artwork.canvas.width = 1;artwork.canvas.height = 1;}if (token === epoch) {busy = false;busyAction = '';if (allowed()) disableForm(false);}}
 }
 const panel = {
  forgetSaved(id) {if (saved?.id === id) {saved = null;savedResult();}},
  suspend() {epoch++;previewTicket++;clearTimeout(previewTimer);if (busy && busyAction === 'download') setDownloadStatus('');busy = false;busyAction = '';},
  clear() {panel.suspend();releasePreview();releaseDownload();saved = null;draft = initialDraft();lastTextColor = '#ffffff';previewMode = 'front';},
  html() {return `<section id="strip-designer" aria-label="Generador de tiras"><div class="strip-designer-layout"><section class="card strip-designer-form" id="strip-design-form"><div class="section-head"><div><h2>Crea una nueva tira</h2><p>Elige el nombre, los colores y la presentación. Descarga la imagen o añádela a tu biblioteca de impresión.</p></div></div><label class="field" for="strip-design-name">Nombre del perfume<input id="strip-design-name" type="text" list="strip-catalog-options" maxlength="80" autocomplete="off" value="${esc(draft.name)}" placeholder="Elige del catálogo o escribe un nombre nuevo" ${busy?'disabled':''}></label><datalist id="strip-catalog-options">${catalog.map(product => `<option value="${esc(product.name)}" label="${esc(product.displayReference ?? product.reference)}"></option>`).join('')}</datalist><p id="strip-design-match" class="strip-design-match" role="status"></p><div class="form-pair"><label class="field" for="strip-design-size">Presentación<select id="strip-design-size" ${busy?'disabled':''}><option value="100" ${Number(draft.size)===100?'selected':''}>100 ml</option><option value="50" ${Number(draft.size)===50?'selected':''}>50 ml</option></select></label><label class="field" for="strip-design-category">Categoría<select id="strip-design-category" ${busy?'disabled':''}>${['Dama','Caballero','Unisex'].map(value => `<option value="${value}" ${draft.category===value?'selected':''}>${value}</option>`).join('')}</select></label></div><label class="field" for="strip-design-color">Color del diseño</label><div class="strip-design-color-controls"><input id="strip-design-color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(draft.color)?draft.color:'#d5a617')}" aria-label="Elegir color de la tira" ${busy?'disabled':''}><input id="strip-design-hex" type="text" value="${esc(draft.color.toUpperCase())}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código hexadecimal del color" ${busy?'disabled':''}></div><div class="strip-color-swatches" role="group" aria-label="Colores sugeridos">${colors.map(([color,name]) => `<button type="button" data-strip-color="${color}" aria-label="${name}" title="${name}" aria-pressed="${draft.color.toLowerCase()===color}" style="--strip-swatch:${color}" ${busy?'disabled':''}><span aria-hidden="true"></span></button>`).join('')}</div><section class="strip-text-settings" aria-label="Texto de la tira"><h3>Texto de la tira</h3><label class="strip-text-auto-toggle"><input id="strip-design-text-auto" type="checkbox" ${draft.textColor==='auto'?'checked':''} ${busy?'disabled':''}>Color automático según el fondo</label><div class="strip-design-color-controls"><input id="strip-design-text-color" type="color" value="${esc(draft.textColor==='auto'?automaticInk():/^#[0-9a-f]{6}$/i.test(draft.textColor)?draft.textColor:lastTextColor)}" aria-label="Elegir color del texto" ${busy?'disabled':''}><input id="strip-design-text-hex" type="text" value="${esc((draft.textColor==='auto'?automaticInk():draft.textColor).toUpperCase())}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código hexadecimal del texto" ${busy?'disabled':''}></div><div class="strip-color-swatches strip-text-swatches" role="group" aria-label="Colores sugeridos para el texto">${textColors.map(([color,name]) => `<button type="button" data-strip-text-color="${color}" aria-label="Texto ${name.toLowerCase()}" title="${name}" aria-pressed="${draft.textColor===color}" style="--strip-swatch:${color}" ${busy?'disabled':''}><span aria-hidden="true"></span></button>`).join('')}</div><label class="field" for="strip-design-text-scale">Tamaño del nombre</label><div class="strip-text-size-controls"><input id="strip-design-text-scale" type="range" min="50" max="160" step="5" value="${Math.round(Number(draft.textScale)*100)}" aria-valuetext="${Math.round(Number(draft.textScale)*100)} %" ${busy?'disabled':''}><output id="strip-design-text-scale-value" for="strip-design-text-scale">${Math.round(Number(draft.textScale)*100)} %</output><button type="button" class="secondary" id="strip-design-text-scale-reset" aria-label="Restablecer tamaño del nombre al 100 %" ${busy?'disabled':''}>100 %</button></div><label class="field" for="strip-design-text-position">Altura del nombre</label><div class="strip-text-size-controls"><input id="strip-design-text-position" type="range" min="0" max="100" step="1" value="${draft.textPosition}" aria-valuetext="${draft.textPosition} %" ${busy?'disabled':''}><output id="strip-design-text-position-value" for="strip-design-text-position">${draft.textPosition} %</output><button type="button" class="secondary" id="strip-design-text-position-reset" aria-label="Restablecer altura del nombre al 50 %" ${busy?'disabled':''}>50 %</button></div><p class="strip-design-type-hint">0 %: arriba · 100 %: abajo. El nombre permanece a la izquierda, entre el logotipo y la capacidad. El nombre central conserva una sola línea.</p></section><p id="strip-design-error" class="strip-design-error" role="alert"></p><div class="label-actions"><button type="button" class="primary" id="strip-design-download" ${busy?'disabled':''}>${busy&&busyAction==='download'?'Preparando imagen…':'Descargar imagen'}</button><button type="button" class="secondary" id="strip-design-save" ${busy?'disabled':''}>${busy&&busyAction==='save'?'Añadiendo tira…':'Añadir a la biblioteca'}</button><button type="button" class="text-button" id="strip-design-reset" ${busy?'disabled':''}>Limpiar campos</button></div><p id="strip-design-download-status" class="strip-design-download-status" role="status">${esc(downloadStatus)}</p><p class="strip-design-storage-hint">Descarga el PNG para conservar una copia. Añadir a la biblioteca lo comparte con tus otros equipos y con Ximena o Luis para seleccionarlo e imprimir.</p><div id="strip-design-saved" class="strip-design-saved"></div></section><section class="card strip-design-preview"><div class="section-head"><h2>Vista previa</h2></div><div class="strip-preview-tools group-tabs" role="group" aria-label="Vista del diseño"><button type="button" data-strip-preview="front" aria-pressed="${previewMode==='front'}" ${busy?'disabled':''}>Vista del frente</button><button type="button" data-strip-preview="full" aria-pressed="${previewMode==='full'}" ${busy?'disabled':''}>Tira completa</button></div><div class="strip-preview-stage" id="strip-design-preview-stage" aria-busy="true"></div><p class="strip-design-preview-caption" id="strip-design-preview-caption"></p><p id="strip-design-preview-status" class="strip-design-preview-status" role="status">Preparando vista previa…</p></section></div></section>`;},
  mount() {
   if (!allowed() || !root()) return;
   if (!listening) {listening = true;document.addEventListener('alma:view-change',event => {if (event.detail?.view !== 'strip-designer') panel.suspend();});}
   textControls();matchDescription();savedResult();renderDownloadStatus();schedulePreview(true);
   node('strip-design-name').oninput = event => {draft.name = event.target.value;const product = productForName();if (product) {draft.category = product.category;draft.productId = product.id;node('strip-design-category').value = draft.category;}else delete draft.productId;matchDescription();error();schedulePreview();};
   node('strip-design-size').onchange = event => {draft.size = Number(event.target.value);error();schedulePreview();};
   node('strip-design-category').onchange = event => {draft.category = event.target.value;error();schedulePreview();};
   node('strip-design-color').oninput = event => {draft.color = event.target.value;node('strip-design-hex').value = draft.color.toUpperCase();root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor===draft.color)));textControls();error();schedulePreview();};
   node('strip-design-hex').oninput = event => {draft.color = event.target.value.trim();if (/^#[0-9a-f]{6}$/i.test(draft.color)) {draft.color = draft.color.toLowerCase();node('strip-design-color').value = draft.color;root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor===draft.color)));}textControls();error();schedulePreview();};
   root().querySelectorAll('[data-strip-color]').forEach(button => button.onclick = () => {if (busy) return;draft.color = button.dataset.stripColor;node('strip-design-color').value = draft.color;node('strip-design-hex').value = draft.color.toUpperCase();root()?.querySelectorAll('[data-strip-color]').forEach(control => control.setAttribute('aria-pressed',String(control===button)));textControls();error();schedulePreview();});
   root().querySelectorAll('[data-strip-preview]').forEach(button => button.onclick = () => {previewMode = button.dataset.stripPreview;drawPreview();});
   node('strip-design-text-auto').onchange = event => {draft.textColor = event.target.checked ? 'auto' : node('strip-design-text-color').value;if (draft.textColor !== 'auto') lastTextColor = draft.textColor;textControls();error();schedulePreview();};
   node('strip-design-text-color').oninput = event => {lastTextColor = event.target.value;draft.textColor = lastTextColor;textControls();error();schedulePreview();};
   node('strip-design-text-hex').oninput = event => {draft.textColor = event.target.value.trim();node('strip-design-text-auto').checked = false;if (/^#[0-9a-f]{6}$/i.test(draft.textColor)) {draft.textColor = draft.textColor.toLowerCase();lastTextColor = draft.textColor;node('strip-design-text-color').value = draft.textColor;}root()?.querySelectorAll('[data-strip-text-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripTextColor === draft.textColor)));error();schedulePreview();};
   root().querySelectorAll('[data-strip-text-color]').forEach(button => button.onclick = () => {if (busy) return;lastTextColor = button.dataset.stripTextColor;draft.textColor = lastTextColor;textControls();error();schedulePreview();});
   node('strip-design-text-scale').oninput = event => {draft.textScale = Number(event.target.value) / 100;const percentage = Math.round(draft.textScale * 100);node('strip-design-text-scale-value').textContent = percentage + ' %';event.target.setAttribute('aria-valuetext',percentage + ' %');error();schedulePreview();};
   node('strip-design-text-scale-reset').onclick = () => {if (busy) return;draft.textScale = 1;textControls();error();schedulePreview();};
   node('strip-design-text-position').oninput=event=>{draft.textPosition=Number(event.target.value);node('strip-design-text-position-value').textContent=draft.textPosition+' %';event.target.setAttribute('aria-valuetext',draft.textPosition+' %');error();schedulePreview();};
   node('strip-design-text-position-reset').onclick=()=>{if(busy)return;draft.textPosition=50;textControls();error();schedulePreview();};
   node('strip-design-reset').onclick = () => {if (busy) return;draft = initialDraft();lastTextColor = '#ffffff';fillDraft();};
   node('strip-design-save').onclick = () => exportArtwork('save');
   node('strip-design-download').onclick = () => exportArtwork('download');
  }
 };
 return panel;
}
