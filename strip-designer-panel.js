import {validateStripDesign, renderStripDesign} from './strip-designer.js?v=62';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const key = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const colors = [['#d5a617','Dorado'],['#df8799','Rosa'],['#18794e','Verde'],['#2c72be','Azul'],['#8860bc','Violeta'],['#29272e','Grafito']];
const initialDraft = () => ({name:'', color:'#d5a617', size:100, category:'Unisex', qty:1});
const downloadName = design => (design.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,65) || 'Alma-Mia') + (design.size === 50 ? '-01' : '-02') + '.png';

// Artwork is saved through the printing library; no inventory or cloud data changes here.
export function createStripDesignerPanel({catalog, notify, allowed, onSave, onLibrary}) {
 let draft = initialDraft(), busy = false, saved = null, imageUrl = '';
 let epoch = 0, previewTicket = 0, previewTimer = 0, rendered = null, previewMode = 'front', listening = false;
 const root = () => document.querySelector('#strip-designer');
 const node = id => root()?.querySelector('#' + id);
 const productForName = () => catalog.find(product => key(product.name) === key(draft.name));
 function releaseSaved() {if (imageUrl) URL.revokeObjectURL(imageUrl);imageUrl = '';saved = null;}
 function releasePreview() {if (rendered?.canvas) {rendered.canvas.width = 1;rendered.canvas.height = 1;}rendered = null;}
 function error(message = '') {const target = node('strip-design-error');if (target) target.textContent = message;}
 function canonical(input = draft) {return validateStripDesign({...input,size:Number(input.size),qty:1});}
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
  output.innerHTML = saved ? `<div class="strip-design-saved-message" role="status"><strong>Tira guardada</strong><p>${esc(saved.name)} · ${saved.size} ml. Ya está disponible en tu biblioteca de impresión.</p></div><div class="label-actions"><button type="button" class="primary" id="strip-design-library">Ir a imprimir</button><a class="secondary" href="${imageUrl}" download="${esc(downloadName(saved))}">Descargar imagen PNG</a></div>` : '';
  const button = node('strip-design-library');if (button) button.onclick = () => {if (allowed()) onLibrary(saved.id);};
 }
 function fillDraft() {
  for (const [id,field] of [['strip-design-name','name'],['strip-design-size','size'],['strip-design-category','category'],['strip-design-color','color'],['strip-design-hex','color']]) {const input = node(id);if (input) input.value = draft[field];}
  root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor === String(draft.color).toLowerCase())));
  matchDescription();error();schedulePreview(true);
 }
 function disableForm(disabled) {root()?.querySelectorAll('input,select,button').forEach(control => control.disabled = disabled);const button = node('strip-design-save');if (button) button.textContent = disabled ? 'Guardando tira…' : 'Guardar tira en biblioteca';}
 const panel = {
  suspend() {epoch++;previewTicket++;clearTimeout(previewTimer);busy = false;},
  clear() {panel.suspend();releasePreview();releaseSaved();draft = initialDraft();previewMode = 'front';},
  html() {return `<section id="strip-designer" aria-label="Generador de tiras"><div class="strip-designer-layout"><section class="card strip-designer-form" id="strip-design-form"><div class="section-head"><div><h2>Crea una nueva tira</h2><p>Elige el nombre, el color y la presentación. Guarda la imagen para usarla después en tus tabloides.</p></div></div><label class="field" for="strip-design-name">Nombre del perfume<input id="strip-design-name" type="text" list="strip-catalog-options" maxlength="80" autocomplete="off" value="${esc(draft.name)}" placeholder="Elige del catálogo o escribe un nombre nuevo" ${busy?'disabled':''}></label><datalist id="strip-catalog-options">${catalog.map(product => `<option value="${esc(product.name)}" label="${esc(product.displayReference ?? product.reference)}"></option>`).join('')}</datalist><p id="strip-design-match" class="strip-design-match" role="status"></p><div class="form-pair"><label class="field" for="strip-design-size">Presentación<select id="strip-design-size" ${busy?'disabled':''}><option value="100" ${Number(draft.size)===100?'selected':''}>100 ml</option><option value="50" ${Number(draft.size)===50?'selected':''}>50 ml</option></select></label><label class="field" for="strip-design-category">Categoría<select id="strip-design-category" ${busy?'disabled':''}>${['Dama','Caballero','Unisex'].map(value => `<option value="${value}" ${draft.category===value?'selected':''}>${value}</option>`).join('')}</select></label></div><label class="field" for="strip-design-color">Color del diseño</label><div class="strip-design-color-controls"><input id="strip-design-color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(draft.color)?draft.color:'#d5a617')}" aria-label="Elegir color de la tira" ${busy?'disabled':''}><input id="strip-design-hex" type="text" value="${esc(draft.color.toUpperCase())}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Código hexadecimal del color" ${busy?'disabled':''}></div><div class="strip-color-swatches" role="group" aria-label="Colores sugeridos">${colors.map(([color,name]) => `<button type="button" data-strip-color="${color}" aria-label="${name}" title="${name}" aria-pressed="${draft.color.toLowerCase()===color}" style="--strip-swatch:${color}" ${busy?'disabled':''}><span aria-hidden="true"></span></button>`).join('')}</div><p id="strip-design-error" class="strip-design-error" role="alert"></p><div class="label-actions"><button type="button" class="primary" id="strip-design-save" ${busy?'disabled':''}>${busy?'Guardando tira…':'Guardar tira en biblioteca'}</button><button type="button" class="secondary" id="strip-design-reset" ${busy?'disabled':''}>Limpiar campos</button></div><p class="strip-design-storage-hint">Las imágenes se guardan en este navegador. Puedes descargar el PNG para conservar una copia.</p><div id="strip-design-saved" class="strip-design-saved"></div></section><section class="card strip-design-preview"><div class="section-head"><h2>Vista previa</h2></div><div class="strip-preview-tools group-tabs" role="group" aria-label="Vista del diseño"><button type="button" data-strip-preview="front" aria-pressed="${previewMode==='front'}" ${busy?'disabled':''}>Vista del frente</button><button type="button" data-strip-preview="full" aria-pressed="${previewMode==='full'}" ${busy?'disabled':''}>Tira completa</button></div><div class="strip-preview-stage" id="strip-design-preview-stage" aria-busy="true"></div><p class="strip-design-preview-caption" id="strip-design-preview-caption"></p><p id="strip-design-preview-status" class="strip-design-preview-status" role="status">Preparando vista previa…</p></section></div></section>`;},
  mount() {
   if (!allowed() || !root()) return;
   if (!listening) {listening = true;document.addEventListener('alma:view-change',event => {if (event.detail?.view !== 'strips') panel.suspend();});}
   matchDescription();savedResult();schedulePreview(true);
   node('strip-design-name').oninput = event => {draft.name = event.target.value;const product = productForName();if (product) {draft.category = product.category;draft.productId = product.id;node('strip-design-category').value = draft.category;}else delete draft.productId;matchDescription();error();schedulePreview();};
   node('strip-design-size').onchange = event => {draft.size = Number(event.target.value);error();schedulePreview();};
   node('strip-design-category').onchange = event => {draft.category = event.target.value;error();schedulePreview();};
   node('strip-design-color').oninput = event => {draft.color = event.target.value;node('strip-design-hex').value = draft.color.toUpperCase();root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor===draft.color)));error();schedulePreview();};
   node('strip-design-hex').oninput = event => {draft.color = event.target.value.trim();if (/^#[0-9a-f]{6}$/i.test(draft.color)) {draft.color = draft.color.toLowerCase();node('strip-design-color').value = draft.color;root()?.querySelectorAll('[data-strip-color]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.stripColor===draft.color)));}error();schedulePreview();};
   root().querySelectorAll('[data-strip-color]').forEach(button => button.onclick = () => {if (busy) return;draft.color = button.dataset.stripColor;node('strip-design-color').value = draft.color;node('strip-design-hex').value = draft.color.toUpperCase();root()?.querySelectorAll('[data-strip-color]').forEach(control => control.setAttribute('aria-pressed',String(control===button)));error();schedulePreview();});
   root().querySelectorAll('[data-strip-preview]').forEach(button => button.onclick = () => {previewMode = button.dataset.stripPreview;drawPreview();});
   node('strip-design-reset').onclick = () => {if (busy) return;draft = initialDraft();fillDraft();};
   node('strip-design-save').onclick = async () => {
    if (busy || !allowed()) return;
    let design;try {design = canonical();} catch (failure) {error(failure.message);return;}
    busy = true;error();disableForm(true);const token = epoch, cancelled = () => token !== epoch || !allowed();let artwork;
    try {
     artwork = await renderStripDesign(design,{dpi:300});if (cancelled()) return;
     const record = await onSave(design,artwork,{cancelled});if (cancelled()) return;
     releaseSaved();saved = {id:record.id,name:design.name,size:design.size};imageUrl = URL.createObjectURL(record.blob);savedResult();setPreviewStatus('Tira guardada en la biblioteca.');
    } catch (failure) {if (!cancelled()) {error('No se pudo guardar la tira: ' + failure.message);notify('No se guardó la tira. Revisa el mensaje del formulario.');}}
    finally {if (artwork?.canvas) {artwork.canvas.width = 1;artwork.canvas.height = 1;}if (token === epoch) {busy = false;if (allowed()) disableForm(false);}}
   };
  }
 };
 return panel;
}
