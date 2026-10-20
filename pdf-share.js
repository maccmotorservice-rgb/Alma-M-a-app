// Sharing stays on this device. PDFs are never uploaded to create public links.
const ownedActions = new Set();
const WHATSAPP_URL = 'https://wa.me/?text=' + encodeURIComponent('Te comparto un PDF de Alma Mía.');

export function pdfFilename(value = 'Alma-Mia.pdf') {
 const base = String(value).normalize('NFC').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '-').trim();
 const stem = (base.replace(/\.pdf$/i, '') || 'Alma-Mia').slice(0, 170);
 return stem + '.pdf';
}

export function canSharePdfFile(file, navigator = globalThis.navigator) {
 if (!file || typeof navigator?.share !== 'function' || typeof navigator?.canShare !== 'function') return false;
 try {return navigator.canShare({files: [file]}) === true;} catch {return false;}
}

// Invoke from a trusted click, after preparing the File. No await precedes share().
export async function sharePdfFile(file, {navigator = globalThis.navigator, title = 'Alma Mía · PDF'} = {}) {
 if (!canSharePdfFile(file, navigator)) return {status: 'unsupported'};
 try {await navigator.share({files: [file], title});return {status: 'shared'};}
 catch (error) {return error?.name === 'AbortError' ? {status: 'cancelled'} : {status: 'failed', error};}
}

// Consumers own their report/preview lifecycle and call dispose() when it closes.
export function mountPdfActions(container, {blob, filename = 'Alma-Mia.pdf', title = 'Alma Mía · PDF'} = {}) {
 if (!container?.ownerDocument || !blob || typeof blob.arrayBuffer !== 'function') throw Error('No se pudo preparar el PDF.');
 const document = container.ownerDocument, URL = document.defaultView?.URL ?? globalThis.URL;
 const url = URL.createObjectURL(blob), anchor = document.createElement('a');
 anchor.className = 'primary';anchor.href = url;anchor.download = pdfFilename(filename);
 anchor.dataset.pdfTitle = title;anchor.textContent = 'Descargar PDF';
 container.append(anchor);
 const handle = {anchor, url, document, dispose() {
  ownedActions.delete(handle);
  const group = anchor.closest('.pdf-share-actions');
  if (group) {group.nextElementSibling?.matches('.pdf-share-status') && group.nextElementSibling.remove();group.remove();}
  else anchor.remove();
  URL.revokeObjectURL(url);
 }};
 ownedActions.add(handle);
 return handle;
}

function sourceFor(anchor, document) {
 if (!anchor.matches('a[download]') || !/\.pdf$/i.test(anchor.getAttribute('download')?.trim() ?? '')) return null;
 if (!anchor.closest('main,dialog') || anchor.closest('.pdf-share-help')) return null;
 const dialog = anchor.closest('dialog');if (dialog && !dialog.open) return null;
 try {
  const url = new URL(anchor.href, document.baseURI), origin = new URL(document.baseURI).origin;
  if (url.origin !== origin || !['blob:', 'http:', 'https:'].includes(url.protocol)) return null;
  return {url: url.href, filename: pdfFilename(anchor.getAttribute('download')), title: anchor.dataset.pdfTitle || 'Alma Mía · PDF'};
 } catch {return null;}
}

export function initPdfSharing({document = globalThis.document, allowed = () => !document.body?.classList.contains('access-locked')} = {}) {
 if (!document?.body) return {scan() {}, dispose() {}};
 const window = document.defaultView ?? globalThis, navigator = window.navigator, records = new Map();
 const File = window.File, fetch = window.fetch?.bind(window), AbortController = window.AbortController;
 let stopped = false, scheduled = false, serial = 0;
 const permitted = () => {try {return !stopped && allowed();} catch {return false;}};
 const current = record => {const source = record.anchor.isConnected && sourceFor(record.anchor, document);return permitted() && records.get(record.anchor) === record && source?.url === record.source.url && source.filename === record.source.filename;};
 function remove(record) {
  records.delete(record.anchor);record.abort?.abort();record.file = null;
  record.button.remove();record.status.remove();
  if (record.group.parentNode) {
   if (record.anchor.parentNode === record.group) record.group.before(record.anchor);
   record.group.remove();
  }
 }
 function status(record, message = '') {record.status.textContent = message;record.status.hidden = !message;}
 function fallback(record, message, download = false) {
  if (!current(record)) return;
  if (download) record.anchor.click();
  record.status.replaceChildren(document.createTextNode(message + ' '));record.status.hidden = false;
  const open = document.createElement('a');open.className = 'pdf-whatsapp-open';open.href = WHATSAPP_URL;
  open.target = '_blank';open.rel = 'noopener noreferrer';open.textContent = 'Abrir WhatsApp';
  record.status.append(open);
 }
 async function prepare(record) {
  if (!current(record)) return;
  record.file = null;record.state = 'loading';record.button.disabled = true;record.button.textContent = 'Preparando PDF…';status(record);
  // Devices without file sharing can use the download-and-attach flow directly.
  if (typeof navigator?.share !== 'function' || typeof navigator?.canShare !== 'function' || !File || !fetch) {
   record.state = 'fallback';record.button.disabled = false;record.button.textContent = 'Enviar por WhatsApp';return;
  }
  record.abort?.abort();record.abort = AbortController ? new AbortController() : null;
  try {
   const response = await fetch(record.source.url, record.abort ? {signal: record.abort.signal} : undefined);
   if (!response.ok) throw Error('PDF no disponible');
   const blob = await response.blob();if (!current(record)) return;
   const header = new TextDecoder().decode(await blob.slice(0, 1024).arrayBuffer());
   if (!header.includes('%PDF-')) throw Error('El archivo no es un PDF');
   const file = new File([blob], record.source.filename, {type: 'application/pdf'});
   if (!current(record)) return;
   record.file = file;record.state = canSharePdfFile(file, navigator) ? 'ready' : 'fallback';
   record.button.disabled = false;record.button.textContent = 'Enviar por WhatsApp';
  } catch (error) {
   if (!current(record) || error?.name === 'AbortError') return;
   record.state = 'error';record.button.disabled = false;record.button.textContent = 'Reintentar PDF';
   status(record, 'No se pudo preparar el archivo. Vuelve a intentarlo o genera el PDF de nuevo.');
  }
 }
 function add(anchor, source) {
  const group = document.createElement('span'), button = document.createElement('button'), output = document.createElement('span');
  group.className = 'pdf-share-actions';button.type = 'button';button.className = 'secondary pdf-whatsapp-button';
  button.dataset.pdfWhatsapp = '';button.textContent = 'Preparando PDF…';button.disabled = true;
  output.className = 'pdf-share-status';output.id = 'pdf-share-status-' + ++serial;output.setAttribute('role', 'status');output.hidden = true;
  button.setAttribute('aria-describedby', output.id);
  anchor.before(group);group.append(anchor, button);group.after(output);
  const record = {anchor, source, group, button, status: output, file: null, state: 'loading', abort: null};records.set(anchor, record);
  button.onclick = async () => {
   if (!current(record) || record.state === 'loading' || record.state === 'sharing') return;
   if (record.state === 'error') {void prepare(record);return;}
   if (record.state !== 'ready' || !record.file) {fallback(record, 'Descarga iniciada. Adjunta el PDF descargado en la conversación de WhatsApp que elijas.', true);return;}
   record.state = 'sharing';button.disabled = true;status(record, 'Selecciona WhatsApp y la conversación en el menú de tu dispositivo.');
   const result = await sharePdfFile(record.file, {navigator, title: record.source.title});
   if (!current(record)) return;
   record.state = 'ready';button.disabled = false;
   if (result.status === 'cancelled') status(record);
   else if (result.status === 'shared') status(record, 'El PDF se compartió desde el menú de tu dispositivo.');
   else fallback(record, 'No se pudo abrir el menú para compartir. Usa Descargar PDF y adjunta el archivo en WhatsApp.');
  };
  void prepare(record);
 }
 function scan() {
  scheduled = false;if (stopped) return;
  if (!permitted()) {
   for (const record of [...records.values()]) remove(record);
   for (const handle of [...ownedActions]) if (handle.document === document) handle.dispose();
   return;
  }
  for (const record of [...records.values()]) {
   const source = record.anchor.isConnected && sourceFor(record.anchor, document);
   if (!source || source.url !== record.source.url || source.filename !== record.source.filename) remove(record);
  }
  for (const anchor of document.querySelectorAll('main a[download],dialog a[download]')) {
   if (records.has(anchor)) continue;
   const source = sourceFor(anchor, document);if (source) add(anchor, source);
  }
 }
 function queue() {if (!scheduled && !stopped) {scheduled = true;queueMicrotask(scan);}}
 const observer = new window.MutationObserver(queue);
 observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'download', 'class', 'open']});
 scan();
 return {scan, dispose() {
  stopped = true;observer.disconnect();
  for (const record of [...records.values()]) remove(record);
  for (const handle of [...ownedActions]) if (handle.document === document) handle.dispose();
 }};
}
