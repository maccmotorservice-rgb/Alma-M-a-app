import {randomId} from './clone-data.js?v=76';
import {inspectStripImageBlob} from './strip-image-format.js?v=76';
import {openStripDatabase as db,stripTransaction as transact,listStripMetadata,readStripRecord} from './strip-library-store.js?v=76';
import {createStripDesignerPanel} from './strip-designer-panel.js?v=76';
import {validateStripDesign,encodeStripDesignPng,stripDesignIdentity} from './strip-designer.js?v=76';
import {Unzip,AsyncUnzipInflate} from './assets/zip-client.js';
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function stripIdentity(filename,catalog){const base=filename.split(/[\\/]/).pop().replace(/\.[^.]+$/,'');const codes=[...base.matchAll(/(?:^|[\s_.()\-])(01|02)(?=$|[\s_.()\-])/g)].map(m=>m[1]);const unique=[...new Set(codes)];const size=unique.length===1?(unique[0]==='01'?50:100):null;const name=base.replace(/(?:^|[\s_.()\-])(01|02)(?=$|[\s_.()\-])/g,' ').replace(/\(\s*\)|\[\s*\]/g,' ').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();const matches=catalog.filter(p=>normalize(p.name)===normalize(name));return {name:name||base,size,productId:matches.length===1?matches[0].id:null,warning:matches.length===1?'':'No coincide con nombre en el catálogo'};}
export function imageResolution(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),read16=(p)=>view.getUint16(p);
 if(bytes.length>=8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71){
  for(let p=8;p+12<=bytes.length;){const length=view.getUint32(p);if(p+12+length>bytes.length)break;const tag=String.fromCharCode(...bytes.subarray(p+4,p+8));if(tag==='pHYs'&&length===9&&bytes[p+16]===1){const x=view.getUint32(p+8)*.0254,y=view.getUint32(p+12)*.0254;if(x>0&&y>0)return {x,y,source:'imagen'};}p+=length+12;}
 }
 if(bytes.length>18&&bytes[0]===255&&bytes[1]===216){
  for(let p=2;p+4<=bytes.length;){if(bytes[p]!==255)break;const marker=bytes[p+1];if(marker===218||marker===217)break;const length=read16(p+2);if(length<2||p+2+length>bytes.length)break;if(marker===224&&length>=16&&String.fromCharCode(...bytes.subarray(p+4,p+9))==='JFIF\0'){const unit=bytes[p+11],factor=unit===1?1:unit===2?2.54:0,x=read16(p+12)*factor,y=read16(p+14)*factor;if(x>0&&y>0)return {x,y,source:'imagen'};}p+=length+2;}
 }
 return {x:300,y:300,source:'referencia-300'};
}
export const STRIP_SIZES=Object.freeze({50:Object.freeze({w:71.9,h:390}),100:Object.freeze({w:80.1,h:431.8})});
export function stripPrintSize(item){const official=STRIP_SIZES[item.size];if(official)return {...official,source:'medida-oficial'};const dpi=item.resolution??{x:300,y:300,source:'referencia-300'};return {w:item.width/dpi.x*25.4,h:item.height/dpi.y*25.4,source:dpi.source};}
export function stripPlacement(index,width,height,physical){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Dimensiones de imagen inválidas.');const {w,h}=physical??{w:width/300*25.4,h:height/300*25.4};if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw Error('Medidas de impresión inválidas.');if(w>80.11||h>431.81)throw Error(`La tira mide ${w.toFixed(2)} × ${h.toFixed(2)} mm y supera el espacio del tabloide. Revisa sus medidas de impresión.`);return {page:Math.floor(index/3),x:[18.6,101.6,183.7][index%3]+(80.1-w)/2,y:(431.8-h)/2,w,h};}
export function expandStripSelection(items){return items.flatMap(item=>{const qty=item.qty??1;if(!Number.isInteger(qty)||qty<1||qty>999)throw Error('La cantidad de cada tira debe ser un número entero entre 1 y 999.');return Array.from({length:qty},()=>item);});}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function metadata(){const records=await listStripMetadata();for(const item of records){if(!item.resolution){const record=await readStripRecord(item.id);if(record?.blob)item.resolution=imageResolution(new Uint8Array(await record.blob.slice(0,65536).arrayBuffer()));}}return records;}
async function inspectImage(blob){let bitmap;try{bitmap=await createImageBitmap(blob);if(bitmap.width*bitmap.height>80000000)throw Error('La imagen supera 80 megapíxeles.');const canvas=document.createElement('canvas'),scale=Math.min(180/bitmap.width,500/bitmap.height,1);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return {width:bitmap.width,height:bitmap.height,thumb:canvas.toDataURL('image/png')};}finally{bitmap?.close();}}
// Generated artwork and ZIP images use the same cache and shared upload queue.
export async function saveDesignedStrip(input,artwork,{catalog=[],cancelled=()=>false,workspace}={}) {
 const design=validateStripDesign({...input,qty:1});
 if(!artwork?.canvas||artwork.canvas.width<1||artwork.canvas.height<1)throw Error('No se pudo preparar la imagen de la tira.');
 const assertActive=()=>{if(cancelled())throw Error('Guardado cancelado.');};assertActive();
 const identity=stripDesignIdentity(design);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 const id='created-'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
 const blob=await encodeStripDesignPng(artwork.canvas,{dpi:300});
 assertActive();const info=await inspectImage(blob);assertActive();
 const previous=await transact('readonly',store=>store.get(id));assertActive();
 const product=design.personalized?null:catalog.find(item=>normalize(item.name)===normalize(design.name));
 const filename=(design.name.replace(/[\\/:*?"<>|]+/g,'-')||'Alma-Mia')+(design.size===50?' 01':' 02')+'.png';
 const record={id,filename,name:design.name,size:design.size,category:design.category,productId:product?.id??null,warning:product||design.personalized?'':'Perfume no está dentro del catálogo',...info,resolution:{x:300,y:300,source:'generada-300'},source:'generated',design,createdAt:previous?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString(),_sync:{dirty:true,changedAt:new Date().toISOString(),editId:randomId(),workspace},blob};
 await transact('readwrite',store=>{assertActive();return store.put(record);});return record;
}
// Only artwork created by this tool can be removed; original ZIP images remain intact.
export async function deleteDesignedStrip(id,{cancelled=()=>false}={}) {
 if(typeof id!=='string'||!id)throw Error('No se encontró la tira que quieres eliminar.');
 if(cancelled())throw Error('Eliminación cancelada.');
 const database=await db();
 if(cancelled())throw Error('Eliminación cancelada.');
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('images','readwrite'),store=tx.objectStore('images');
  let record=null,failure;
  tx.oncomplete=()=>resolve(record);
  tx.onerror=()=>reject(failure||tx.error||Error('No se pudo eliminar la tira.'));
  tx.onabort=()=>reject(failure||tx.error||Error('Eliminación cancelada.'));
  const request=store.get(id);
  request.onsuccess=()=>{
   try{
    if(cancelled())throw Error('Eliminación cancelada.');
    record=request.result??null;
    if(record&&record.source!=='generated')throw Error('Solo puedes eliminar tiras creadas en esta herramienta.');
    if(record)store.delete(id);
   }catch(error){failure=error;tx.abort();}
  };
 });
}
export async function importStripsZip(file,{catalog,onProgress=()=>{},cancelled=()=>false,workspace}){let count=0,skipped=0,total=0,processed=0,failure=null;const jobs=new Set(),pendingImages=new Set(),errors=[];const unzip=new Unzip(entry=>{if(!/\.(png|jpe?g|webp)$/i.test(entry.name)||/(^|\/)__MACOSX\/|(^|\/)\._/.test(entry.name))return;let chunks=[],bytes=0;const job=new Promise((resolve,reject)=>{entry.ondata=(error,chunk,final)=>{if(error){reject(error);return;}if(cancelled()){entry.terminate();reject(Error('Importación cancelada.'));return;}bytes+=chunk.length;total+=chunk.length;if(bytes>80*1024*1024||total>1024*1024*1024){entry.terminate();reject(Error('El contenido supera el límite de seguridad de importación.'));return;}chunks.push(chunk);if(final){const ext=entry.name.split('.').pop().toLowerCase();let blob=new Blob(chunks,{type:ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg'});chunks=[];const task=inspectStripImageBlob(blob).then(normalized=>{blob=normalized;return inspectImage(blob);}).then(async info=>{if(cancelled())throw Error('Importación cancelada.');const identity=stripIdentity(entry.name,catalog),resolution=imageResolution(new Uint8Array(await blob.slice(0,65536).arrayBuffer()));await transact('readwrite',store=>store.put({id:entry.name.toLowerCase(),filename:entry.name,...identity,...info,resolution,source:'imported',updatedAt:new Date().toISOString(),_sync:{dirty:true,changedAt:new Date().toISOString(),editId:randomId(),workspace},blob}));count++;onProgress({count,skipped,processed,totalBytes:file.size});}).then(resolve,reject);pendingImages.add(task);task.finally(()=>pendingImages.delete(task));}};entry.start();});jobs.add(job);job.catch(error=>{skipped++;errors.push(entry.name+': '+error.message);if(/cancelad|límite/.test(error.message))failure=error;}).finally(()=>jobs.delete(job));});unzip.register(AsyncUnzipInflate);const reader=file.stream().getReader();try{while(true){if(cancelled())throw Error('Importación cancelada.');if(failure)throw failure;const {done,value}=await reader.read();if(done)break;processed+=value.length;unzip.push(value,false);if(pendingImages.size>=2)await Promise.allSettled([...pendingImages]);onProgress({count,skipped,processed,totalBytes:file.size});await new Promise(r=>setTimeout(r,0));}unzip.push(new Uint8Array(),true);await Promise.allSettled([...jobs]);if(failure)throw failure;if(!count)throw Error(errors[0]||'El ZIP no contiene imágenes PNG, JPG o WebP compatibles.');return {count,skipped,errors};}finally{await reader.cancel().catch(()=>{});}}
export async function buildStripsPdf(items,{getRecord=readStripRecord}={}){
 const copies=expandStripSelection(items);if(!copies.length)throw Error('Selecciona al menos una tira.');
 const {jsPDF}=await import('./assets/pdf-client.js');const pdf=new jsPDF({unit:'mm',format:[279.4,431.8],orientation:'portrait',compress:true});
 pdf.setProperties({title:'Tiras en tabloide · Alma Mía',author:'Alma Mía Perfumes'});const cache=new Map();
 for(let i=0;i<copies.length;i++){
  const chosen=copies[i];let image=cache.get(chosen.id);
  if(!image){const stored=await getRecord(chosen.id);if(!stored)throw Error('No se encontró una de las tiras.');const item={...stored,blob:await inspectStripImageBlob(stored.blob)};
   const raw=new Uint8Array(await item.blob.arrayBuffer());const resolution=item.resolution??imageResolution(raw);const physical=STRIP_SIZES[item.size]?stripPrintSize(item):chosen.printSize??stripPrintSize({...item,resolution});
   let bytes=raw,type=item.blob.type==='image/jpeg'?'JPEG':'PNG';
   if(item.source==='generated'){
    // Keep the original PNG in the library, but keep multi-page print files light.
    const bitmap=await createImageBitmap(item.blob),canvas=document.createElement('canvas');
    try{canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0);bytes=canvas.toDataURL('image/jpeg',.98);type='JPEG';}
    finally{bitmap.close();canvas.width=1;canvas.height=1;}
   }else if(item.blob.type==='image/webp'){const bitmap=await createImageBitmap(item.blob);try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bytes=canvas.toDataURL('image/png');}finally{bitmap.close();}}
   image={bytes,type,width:item.width,height:item.height,physical,alias:'strip-'+cache.size};cache.set(chosen.id,image);
  }
  const place=stripPlacement(i,image.width,image.height,image.physical);if(i&&i%3===0)pdf.addPage([279.4,431.8],'portrait');
  pdf.addImage(image.bytes,image.type,place.x,place.y,place.w,place.h,image.alias,'FAST');await new Promise(r=>setTimeout(r,0));
 }
 return {blob:pdf.output('blob'),pages:Math.ceil(copies.length/3),count:copies.length};
}
function createImportedStripsPanel({catalog,notify,allowed,sync,onDelete=()=>{}}){let quantities={},overrides={},items=[],selected=[],query='',size='all',loading=false,busy=false,status='',url='',epoch=0,needsReload=false,reloadTicket=0;const readMetadata=async()=>sync.visibleMetadata(await metadata());const clearPdf=()=>{if(url)URL.revokeObjectURL(url);url='';};const filtered=()=>items.filter(p=>(size==='all'||String(p.size)===size)&&normalize(p.name+' '+p.filename).includes(normalize(query)));const panel={async reload({preservePdf=false}={}){const ticket=++reloadTicket,token=epoch,before=selected.map(id=>{const row=items.find(item=>item.id===id);return [id,row?.asset?.path,row?.size,row?.width,row?.height];}),list=await readMetadata();if(token!==epoch||ticket!==reloadTicket)return;items=list;selected=selected.filter(id=>items.some(item=>item.id===id));const after=selected.map(id=>{const row=items.find(item=>item.id===id);return [id,row?.asset?.path,row?.size,row?.width,row?.height];});if(!preservePdf||JSON.stringify(before)!==JSON.stringify(after))clearPdf();loading=true;},async remoteChanged(){if(busy||!allowed()){needsReload=true;return;}await panel.reload({preservePdf:true});if(allowed())panel.refresh?.();},count(){return items.length;},reveal(id){query='';size='all';const item=items.find(item=>item.id===id);if(item)status='Tira guardada: '+item.name+'. Selecciónala para incluirla en un tabloide.';},clear(){epoch++;selected=[];quantities={};overrides={};items=[];clearPdf();loading=false;busy=false;status='';},html(){return `<div class="page-title"><div><div class="eyebrow">IMPRESIÓN</div><h1>Imprimir tiras</h1><p>Elige tus tiras y la cantidad que necesitas de cada una. Se colocan hasta tres por tabloide.</p></div></div><section class="card"><h2>Biblioteca de tiras</h2><p>Selecciona tiras creadas aquí o importa imágenes desde tu ZIP. Puedes combinarlas en el mismo tabloide.</p><p>En los archivos del ZIP, 01 = 50 ml (7.19 × 39 cm) · 02 = 100 ml (8.01 × 43.18 cm).</p><p>Tu biblioteca se comparte entre tus equipos y las cuentas de Luis y Ximena. Las imágenes originales se descargan cuando las necesitas para imprimir.</p><label class="field">${busy?'Procesando…':'Importar imágenes desde ZIP'}<input id="strips-file" type="file" accept=".zip,application/zip" ${busy?'disabled':''}></label><p role="status" id="strips-status">${esc(status)}</p><div class="toolbar"><input id="strips-search" aria-label="Buscar tira" placeholder="Buscar tira…" value="${esc(query)}"><select id="strips-size" aria-label="Capacidad"><option value="all">Todas las capacidades</option><option value="50" ${size==='50'?'selected':''}>50 ml</option><option value="100" ${size==='100'?'selected':''}>100 ml</option></select></div><p>${items.length} tiras disponibles</p><div class="strips-library">${filtered().map(item=>`<article class="strip-card"><label class="strip-card-select"><input type="checkbox" data-strip-id="${esc(item.id)}" ${selected.includes(item.id)?'checked':''} ${busy?'disabled':''}>${item.thumb?`<img loading="lazy" src="${esc(item.thumb)}" alt="Tira ${esc(item.name)}">`:`<div class="strip-thumb-placeholder" aria-label="Vista previa pendiente">Vista previa pendiente</div>`}<strong>${esc(item.name)}</strong><span>${item.size?item.size+' ml':'Capacidad sin identificar'}</span>${item.design?.personalized||item.category==='Personalizada'?'<span>Personalizada</span>':''}${item.warning?`<small class="strip-warning">${esc(item.warning)}</small>`:''}${item.source==='generated'?`<small>Texto ${esc((item.design?.textColor??'auto')==='auto'?'automático':item.design.textColor.toUpperCase())} · Letra ${Math.round((item.design?.textScale??1)*100)} %</small>`:''}<small>${esc(item.filename)}</small>${item._sync?.dirty||!item.asset?'<small class="strip-warning">Pendiente de compartir</small>':''}</label>${item.source==='generated'?`<button type="button" class="text-button strip-delete-button" data-strip-delete="${esc(item.id)}" aria-label="Eliminar tira ${esc(item.name)} de ${item.size} ml" ${busy?'disabled':''}>Eliminar</button>`:''}</article>`).join('')||'<p>Importa tu ZIP para mostrar las tiras, o cambia los filtros.</p>'}</div></section><section class="card label-selection"><h2>Selección · ${selected.reduce((sum,id)=>sum+(quantities[id]??1),0)} tiras · ${Math.ceil(selected.reduce((sum,id)=>sum+(quantities[id]??1),0)/3)} tabloides</h2><ol>${selected.map((id,i)=>{const item=items.find(p=>p.id===id),physical=STRIP_SIZES[item.size]?stripPrintSize(item):overrides[id]??stripPrintSize(item);return `<li class="strip-selected"><div><strong>${i+1}. ${esc(item.name)}</strong><p>${item.size?item.size+' ml':'Sin capacidad'} · ${physical.w.toFixed(2)} × ${physical.h.toFixed(2)} mm</p><label class="field">Cantidad de tiras<input type="number" min="1" max="999" step="1" value="${quantities[id]??1}" data-strip-qty="${esc(id)}" ${busy?'disabled':''}></label>${STRIP_SIZES[item.size]?'<small>Medida oficial fija según la capacidad.</small>':`<details><summary>Ajustar medidas de impresión</summary><p>Se mantiene la proporción de la imagen. Cambiar el ancho ajusta el alto.</p><label class="field">Ancho de la tira (mm)<input type="number" min="1" max="80.1" step="0.01" value="${physical.w.toFixed(2)}" data-strip-width="${esc(id)}" ${busy?'disabled':''}></label>${!item.resolution||item.resolution.source==='referencia-300'?'<small>Sin resolución de impresión en la imagen: medida calculada a 300 ppp, como el ejemplo. Verifica antes de imprimir.</small>':''}</details>`}</div><button class="text-button" data-strip-remove="${esc(id)}" ${busy?'disabled':''}>Quitar</button></li>`;}).join('')}</ol><p>Tabloide vertical: 27.94 × 43.18 cm. Medidas oficiales: 50 ml = 7.19 × 39 cm · 100 ml = 8.01 × 43.18 cm. Se coloca la imagen completa en su medida correspondiente, sin recortarla. Los espacios sobrantes quedan vacíos.</p><div class="label-actions"><button class="primary" id="strips-preview" ${!selected.length||busy?'disabled':''}>${busy?'Procesando…':'Previsualizar tabloides'}</button><button class="secondary" id="strips-clear" ${busy?'disabled':''}>Limpiar selección</button></div><div id="strips-pdf">${url?`<a class="primary" href="${url}" download="Alma-Mia-Tiras-${Date.now()}.pdf">Descargar PDF</a><p>Imprimir al 100 %, sin ajustar a página.</p><iframe title="Tabloides seleccionados" src="${url}"></iframe>`:''}</div></section>`;},mount(){const refresh=()=>{if(!allowed())return;const root=document.querySelector('#content'),focused=document.activeElement?.id,pos=document.activeElement?.selectionStart;root.innerHTML=panel.html();panel.mount();if(focused==='strips-search'){const input=document.querySelector('#strips-search');input.focus();input.setSelectionRange(pos,pos);}};panel.refresh=refresh;if(needsReload&&!busy){needsReload=false;void panel.remoteChanged();}if(!loading){loading=true;const token=epoch;readMetadata().then(list=>{if(token!==epoch)return;items=list;if(allowed())refresh();}).catch(e=>notify('No se pudo leer la biblioteca: '+e.message));}document.querySelector('#strips-search').oninput=e=>{query=e.target.value;refresh();};document.querySelector('#strips-size').onchange=e=>{size=e.target.value;refresh();};document.querySelectorAll('[data-strip-id]').forEach(c=>c.onchange=()=>{if(busy)return;selected=c.checked?[...selected,c.dataset.stripId]:selected.filter(id=>id!==c.dataset.stripId);clearPdf();refresh();});document.querySelectorAll('[data-strip-qty]').forEach(input=>input.onchange=()=>{if(busy)return;const qty=Number(input.value);if(!Number.isInteger(qty)||qty<1||qty>999){notify('Ingresa una cantidad entera de 1 a 999.');refresh();return;}quantities[input.dataset.stripQty]=qty;clearPdf();refresh();});document.querySelectorAll('[data-strip-width]').forEach(input=>input.onchange=()=>{if(busy)return;const w=Number(input.value),item=items.find(p=>p.id===input.dataset.stripWidth),base=stripPrintSize(item),h=w/base.w*base.h;try{stripPlacement(0,item.width,item.height,{w,h});overrides[item.id]={w,h};clearPdf();}catch(error){notify(error.message);}refresh();});document.querySelectorAll('[data-strip-remove]').forEach(b=>b.onclick=()=>{selected=selected.filter(id=>id!==b.dataset.stripRemove);clearPdf();refresh();});document.querySelectorAll('[data-strip-delete]').forEach(button=>button.onclick=async()=>{
 if(busy||!allowed())return;
 const id=button.dataset.stripDelete,item=items.find(item=>item.id===id);
 if(!item||item.source!=='generated')return;
 if(!window.confirm(`¿Eliminar de la biblioteca la tira «${item.name}» de ${item.size} ml? También se quitará de la selección de impresión.`))return;
 busy=true;status='Eliminando tira…';const token=epoch;refresh();
 try{
  await sync.remove(id,{cancelled:()=>token!==epoch||!allowed()});
  if(token!==epoch)return;
  items=items.filter(item=>item.id!==id);selected=selected.filter(selectedId=>selectedId!==id);
  delete quantities[id];delete overrides[id];clearPdf();onDelete(id);status='Tira eliminada: '+item.name+'.';
 }catch(error){if(token===epoch){status='No se pudo eliminar la tira: '+error.message;if(allowed())notify(status);}}
 finally{if(token===epoch){busy=false;refresh();}}
});document.querySelector('#strips-clear').onclick=()=>{selected=[];quantities={};overrides={};clearPdf();refresh();};document.querySelector('#strips-file').onchange=async e=>{const file=e.target.files[0];if(!file||busy)return;busy=true;status='Abriendo ZIP…';clearPdf();refresh();const token=epoch;try{const result=await importStripsZip(file,{catalog,workspace:sync.getWorkspace(),cancelled:()=>epoch!==token,onProgress:p=>{status=`Importando: ${p.count} imágenes · ${Math.round(p.processed/p.totalBytes*100)} % del ZIP leído`;if(allowed())document.querySelector('#strips-status').textContent=status;}});if(token!==epoch)return;items=await readMetadata();selected=selected.filter(id=>items.some(p=>p.id===id));status=`${result.count} imágenes importadas.${result.skipped?' No se pudieron importar '+result.skipped+' imágenes.':''} ${items.filter(p=>p.warning).length} sin coincidencia con el catálogo.`;if(result.errors.length)status+=' '+result.errors.slice(0,2).join(' · ');try{await sync.synchronize();}catch{status+=' Las tiras se conservaron en este equipo; revisa el estado de sincronización.';}}catch(e){if(token===epoch){status=e.message;items=await readMetadata().catch(()=>items);}}finally{if(token===epoch){busy=false;refresh();}}};document.querySelector('#strips-preview').onclick=async()=>{if(busy||!allowed())return;if(selected.some(id=>!items.find(p=>p.id===id).size)){notify('Hay tiras cuya capacidad no se identificó en el nombre. Verifica que incluyan 01 o 02 antes de imprimir.');}busy=true;clearPdf();const token=epoch,snapshot=selected.map(id=>({...items.find(p=>p.id===id),qty:quantities[id]??1,printSize:overrides[id]}));refresh();try{const result=await buildStripsPdf(snapshot,{getRecord:id=>sync.getRecord(id)});if(token!==epoch||!allowed())return;url=URL.createObjectURL(result.blob);}catch(e){notify('No se pudo generar el PDF: '+e.message);}finally{if(token===epoch){busy=false;refresh();if(url&&allowed())document.querySelector('#strips-pdf').scrollIntoView({behavior:'smooth'});}}};}};return panel;}


// Custom designs and imported images share one library and one tabloid printer.
export function createStripsPanel({catalog,notify,allowed,sync,getView,onNavigate}) {
 let manualSyncBusy=false,sessionEpoch=0;
 const isCreator=()=>getView()==='strip-designer';
 const library=createImportedStripsPanel({catalog,notify,sync,allowed:()=>allowed()&&!isCreator(),onDelete:id=>designer.forgetSaved(id)});
 const designer=createStripDesignerPanel({catalog,notify,allowed:()=>allowed()&&isCreator(),
  onSave:async(design,artwork,options)=>{const record=await saveDesignedStrip(design,artwork,{...options,catalog,workspace:sync.getWorkspace()});const shared=await sync.publish(record);await library.reload();return shared;},
  onLibrary:id=>{designer.suspend();library.reveal(id);onNavigate('strips');const input=document.querySelector('[data-strip-id="'+id+'"]');input?.closest('.strip-card')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.effects==='off'?'auto':'smooth',block:'center'});input?.focus({preventScroll:true});}
 });
 function refresh(){const content=document.querySelector('#content');if(!content||!allowed())return;content.innerHTML=panel.html();panel.mount();}
 const setupUrl='https://github.com/maccmotorservice-rgb/Alma-M-a-app/blob/main/supabase/04-biblioteca-tiras.sql';
 const syncHtml=()=>`<section class="card strip-sync" aria-label="Sincronización de la biblioteca"><p role="status" id="strips-sync-status">${esc(sync.getStatus().message)}</p><div class="label-actions"><button type="button" class="secondary" id="strips-sync-retry" ${manualSyncBusy||sync.getStatus().phase==='syncing'?'disabled':''}>${manualSyncBusy||sync.getStatus().phase==='syncing'?'Sincronizando…':'Sincronizar ahora'}</button><a class="text-button" id="strips-sync-setup" href="${setupUrl}" target="_blank" rel="noopener" ${sync.getStatus().phase==='setup'?'':'hidden'}>Activar biblioteca compartida</a></div><details id="strips-sync-issues" ${sync.getStatus().issues?.length?'open':'hidden'}><summary>Archivos pendientes de sincronizar</summary><ul id="strips-sync-issues-list">${(sync.getStatus().issues??[]).map(issue=>`<li><strong>${esc(issue.filename)}</strong><span>${esc(issue.message)}</span></li>`).join('')}</ul><p>Los originales se conservan en este equipo. Las demás tiras continúan sincronizándose.</p></details></section>`;
 function updateSyncButton(){const button=document.getElementById('strips-sync-retry');if(button){const busy=manualSyncBusy||sync.getStatus().phase==='syncing';button.disabled=busy;button.textContent=busy?'Sincronizando…':'Sincronizar ahora';}}
 function bindSync(){
  updateSyncButton();const button=document.getElementById('strips-sync-retry');
  if(button)button.onclick=async()=>{
   if(manualSyncBusy||!allowed())return;
   const token=sessionEpoch;manualSyncBusy=true;updateSyncButton();
   try{
    const result=await sync.refresh();
    if(token!==sessionEpoch||!allowed()||result?.phase==='paused')return;
    await library.reload({preservePdf:true});
    if(token!==sessionEpoch||!allowed())return;
    if(isCreator())onNavigate('strips');else refresh();
    const count=library.count();
    notify(count?`Biblioteca actualizada: ${count} ${count===1?'tira disponible':'tiras disponibles'}.`:'La biblioteca compartida aún está vacía. Abre la app en el equipo que conserva las imágenes y termina la sincronización.');
   }catch(error){if(token===sessionEpoch&&allowed())notify(error.message||'No se pudo actualizar la biblioteca. Vuelve a intentar.');}
   finally{if(token===sessionEpoch){manualSyncBusy=false;if(allowed())updateSyncButton();}}
  };
 }
 sync.subscribe(value=>{if(!allowed())return;const target=document.getElementById('strips-sync-status');if(target)target.textContent=value.message;const issues=document.getElementById('strips-sync-issues'),list=document.getElementById('strips-sync-issues-list');if(issues&&list){const entries=value.issues??[],wasHidden=issues.hidden;issues.hidden=!entries.length;if(wasHidden&&entries.length)issues.open=true;list.replaceChildren(...entries.map(issue=>{const row=document.createElement('li'),name=document.createElement('strong'),message=document.createElement('span');name.textContent=issue.filename;message.textContent=issue.message;row.append(name,message);return row;}));}const setup=document.getElementById('strips-sync-setup');if(setup)setup.hidden=value.phase!=='setup';updateSyncButton();});
 const originalHtml=library.html.bind(library),originalMount=library.mount.bind(library);
 library.html=()=>originalHtml().replace('</p></div></div>','</p></div><button type="button" class="secondary" data-view="strip-designer">Crear tiras ↗</button></div>'+syncHtml());
 library.mount=()=>{bindSync();originalMount();};
 const panel={
  libraryChanged(){return library.remoteChanged();},
  clear(){sessionEpoch++;manualSyncBusy=false;designer.clear();library.clear();},
  html(){return isCreator()?`<div class="page-title"><div><div class="eyebrow">DISEÑO DE TIRAS</div><h1>Crear tiras</h1><p>Diseña una tira, descarga su imagen o guárdala en la biblioteca compartida.</p></div><button type="button" class="secondary" data-view="strips">Ir a Imprimir tiras ↗</button></div>${designer.html()}`:library.html();},
  mount(){if(!allowed())return;if(isCreator())designer.mount();else library.mount();}
 };
 return panel;
}
