import {randomId} from './clone-data.js?v=93';
import {emptyStripLibrary,validateStripLibrary,validateStripRecord} from './strip-library-data.js?v=93';
import {listStripMetadata,readStripRecord,writeStripRecord,removeStripRecord,updateStripRecord} from './strip-library-store.js?v=93';

const editKey=record=>record?._sync?.editId;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sameAsset=(a,b)=>Boolean(a&&b&&a.path===b.path&&a.size===b.size&&a.type===b.type);
const asDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
const hashBlob=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
const thumbnailBlob=async value=>{
 if(typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))return null;
 return (await fetch(value)).blob();
};
const metadataFor=record=>{
 const result={};
 for(const key of ['id','filename','name','size','productId','warning','width','height','resolution','category','design','createdAt','updatedAt','asset','thumbnail','contentHash'])if(record[key]!==undefined)result[key]=record[key];
 result.source=record.source==='generated'?'generated':'imported';
 return result;
};

// One shared manifest for both members; binary images remain in private Storage.
// Old browser records are uploaded once. Originals are downloaded only for printing.
export function createStripLibrarySync({getCloud,getLibrary,canAccess,onChange=()=>{}}) {
 let identity='',workspace='',epoch=0,manifest=emptyStripLibrary(),signature='',flight=null,rerun=false,timer=0,retryTimer=0;
 let status={phase:'idle',message:'Comprobando biblioteca compartida…',pending:0,issues:[]};
 const listeners=new Set();
 const emit=()=>{for(const listener of listeners)listener(status);};
 const setStatus=(phase,message,pending=status.pending,issues=status.issues)=>{status={phase,message,pending,issues};emit();};
 const blocked=()=>document.body.classList.contains('welcome-open')||document.visibilityState==='hidden';
 const cancelled=token=>token!==epoch||!canAccess();
 const assertActive=token=>{if(cancelled(token))throw Error('Sincronización cancelada.');};
 const inWorkspace=record=>!record?._sync?.workspace||record._sync.workspace===workspace;
 const visibleMetadata=rows=>{const active=new Set(manifest.entries.map(record=>record.id)),deleted=new Map(manifest.deleted.map(record=>[record.id,record]));return rows.filter(record=>inWorkspace(record)&&(!record.asset||record._sync?.dirty||active.has(record.id))&&(!deleted.has(record.id)||record._sync?.dirty&&Date.parse(record._sync.changedAt)>Date.parse(deleted.get(record.id).deletedAt)));};
 function schedule(delay=120) {
  if(!canAccess()||!identity)return;
  clearTimeout(timer);timer=setTimeout(()=>{timer=0;if(blocked()){rerun=true;return;}void synchronize().catch(()=>{});},delay);
 }
 function connect() {
  const cloud=getCloud(),next=canAccess()?`${cloud.config.url}|${cloud.user.id}`:'';
  if(next!==identity){epoch++;identity=next;workspace=cloud?.config?.url??'';signature='';clearTimeout(timer);clearTimeout(retryTimer);flight=null;rerun=false;if(!next){manifest=emptyStripLibrary();setStatus('idle','Inicia sesión para consultar la biblioteca compartida.',0,[]);return;}}
  if(!next)return;
  const latest=validateStripLibrary(getLibrary()??emptyStripLibrary()),encoded=JSON.stringify(latest);
  if(encoded!==signature){manifest=latest;signature=encoded;schedule();}
 }
 async function guardedWrite(record,token) {
  assertActive(token);let accepted=false;
  const stored=await updateStripRecord(record.id,current=>{assertActive(token);if(!current||!inWorkspace(current)||editKey(current)!==editKey(record))return;accepted=true;return record;});
  assertActive(token);if(!accepted){rerun=true;return null;}return stored;
 }
 async function storePublished(record,token) {
  return guardedWrite({...record,_sync:{...record._sync,dirty:false,migration:false,error:undefined,workspace}},token);
 }
 async function process(token) {
  const cloud=getCloud();let local=(await listStripMetadata()).filter(inWorkspace);assertActive(token);
  const entries=new Map(manifest.entries.map(record=>[record.id,record]));
  const deleted=new Map(manifest.deleted.map(record=>[record.id,record]));
  const candidates=local.filter(record=>record._sync?.dirty||(!record.asset&&!record._sync?.workspace));
  let batch=[],uploaded=0;const issues=[];setStatus('syncing',candidates.length?'Compartiendo las tiras de este equipo…':'Actualizando biblioteca compartida…',candidates.length,[]);
  const flush=async()=>{
   if(!batch.length)return;assertActive(token);
   const records=batch;batch=[];
   const next=await cloud.changeStripLibrary({upsert:records.map(metadataFor),cancelled:()=>cancelled(token)});assertActive(token);
   manifest=validateStripLibrary(next);signature=JSON.stringify(manifest);
   for(const record of records)await storePublished(record,token);
   onChange();
  };
  for(const item of candidates) {
   assertActive(token);if(blocked()){await flush();rerun=true;return;}
   let record;try{
   record=await updateStripRecord(item.id,current=>{assertActive(token);if(!current?.blob||!inWorkspace(current)||current._sync?.editId)return;return {...current,_sync:{...current._sync,workspace,editId:randomId(),dirty:true,migration:!current._sync?.dirty,changedAt:current._sync?.changedAt??current.updatedAt??current.createdAt??new Date().toISOString()}};});if(!record?.blob||!inWorkspace(record))continue;
   const tombstone=deleted.get(record.id);
   if(tombstone&&(record._sync?.migration||!record._sync?.dirty||Date.parse(record._sync.changedAt)<=Date.parse(tombstone.deletedAt))){await updateStripRecord(record.id,current=>editKey(current)===editKey(record)?null:undefined);continue;}
   const existing=entries.get(record.id);
   if(existing&&(!record._sync?.dirty||record._sync?.migration)){
    const digest=await hashBlob(record.blob);assertActive(token);
    if(digest===(existing.contentHash??existing.asset.sha256)){
     await guardedWrite({...record,...existing,blob:record.blob?.slice(0,record.blob.size,existing.asset.type),_sync:{...record._sync,dirty:false,migration:false,workspace}},token);continue;
    }
    // Preserve a different old image with the same filename as a separate version.
    const id=record.id.slice(0,990)+'~'+digest.slice(0,16);
    if(entries.has(id)){await guardedWrite({...record,...existing,blob:undefined,thumb:undefined,_sync:{...record._sync,dirty:false,migration:false,workspace}},token);continue;}
    record={...record,id,asset:undefined,thumbnail:undefined,_sync:{dirty:true,changedAt:new Date().toISOString(),workspace,editId:randomId()}};
    await writeStripRecord(record);
   }
   record={...record,source:record.source==='generated'?'generated':'imported',updatedAt:record._sync?.changedAt??new Date().toISOString()};
   if(!record.asset||record._sync?.workspace&&record._sync.workspace!==workspace){
    record.asset=await cloud.uploadStripAsset(record.blob,record.id,{cancelled:()=>cancelled(token)});assertActive(token);
    record.contentHash=record.asset.sha256;
    // A mislabeled extension must not carry the old MIME into PDF printing.
    if(record.blob.type!==record.asset.type)record.blob=record.blob.slice(0,record.blob.size,record.asset.type);
    record._sync={...record._sync,dirty:true,workspace};if(!await guardedWrite(record,token))continue;
   }
   if(!record.thumbnail){const blob=await thumbnailBlob(record.thumb);assertActive(token);if(blob){record.thumbnail=await cloud.uploadStripAsset(blob,record.id,{thumbnail:true,cancelled:()=>cancelled(token)});assertActive(token);if(!await guardedWrite(record,token))continue;}}
   try{validateStripRecord(metadataFor(record));}catch(error){error.code='STRIP_RECORD_INVALID';throw error;}
   batch.push(record);uploaded++;setStatus('syncing',`Compartiendo tiras: ${uploaded} de ${candidates.length}…`,Math.max(0,candidates.length-uploaded));
   if(batch.length>=5)await flush();await sleep(0);
   }catch(error){
    if(cancelled(token))throw error;
    if(['STRIP_IMAGE_FORMAT','STRIP_RECORD_INVALID'].includes(error.code)||/no corresponde al formato indicado|vista previa de la tira no es válida|debe ser una imagen|hasta 80 MB/.test(error.message)){
     const issue={id:item.id,filename:item.filename??item.name??item.id,message:error.message};issues.push(issue);
     if(record)await guardedWrite({...record,_sync:{...record._sync,dirty:true,error:error.message}},token);
     setStatus('syncing',`Continuando la sincronización · ${issues.length} ${issues.length===1?'archivo pendiente':'archivos pendientes'}.`,Math.max(0,candidates.length-uploaded),[...issues]);
     onChange();continue;
    }
    // Keep a short successful batch even if a later upload lost its connection.
    await flush();throw error;
   }
  }
  await flush();assertActive(token);
  // Metadata first: every shared design appears even on a device with no images.
  const thumbnails=[];
  for(const record of manifest.entries){
   assertActive(token);
   const stored=await updateStripRecord(record.id,current=>{
    assertActive(token);if(current&&!inWorkspace(current))return;
    if(current?._sync?.dirty)return;
    if(current?.blob&&!current.asset){rerun=true;return;}
    const same=sameAsset(current?.asset,record.asset)&&current?._sync?.workspace===workspace;
    return {...record,blob:same?current?.blob:undefined,thumb:sameAsset(current?.thumbnail,record.thumbnail)?current?.thumb:undefined,_sync:{dirty:false,workspace}};
   });
   if(stored&&inWorkspace(stored)&&record.thumbnail&&!stored.thumb&&!stored._sync?.dirty)thumbnails.push(record);
  }
  for(const tombstone of manifest.deleted){await updateStripRecord(tombstone.id,current=>{assertActive(token);if(current&&inWorkspace(current)&&(!current._sync?.dirty||Date.parse(current._sync.changedAt)<=Date.parse(tombstone.deletedAt)))return null;});}
  assertActive(token);onChange();
  let failed=0;
  for(const record of thumbnails){
   assertActive(token);if(blocked()){rerun=true;break;}
   try{
    const blob=await cloud.downloadStripAsset(record.thumbnail);assertActive(token);
    const thumb=await asDataUrl(blob);assertActive(token);await updateStripRecord(record.id,current=>{assertActive(token);if(current&&inWorkspace(current)&&!current._sync?.dirty&&sameAsset(current.thumbnail,record.thumbnail))return {...current,thumb};});
   }catch(error){if(cancelled(token))throw error;if(++failed>=3)break;}
   if(thumbnails.indexOf(record)%8===7){onChange();await sleep(0);}
  }
  assertActive(token);onChange();
  if(failed){clearTimeout(retryTimer);retryTimer=setTimeout(()=>schedule(),20000);}
  const message=`Biblioteca compartida · ${manifest.entries.length} ${manifest.entries.length===1?'tira':'tiras'}.`;
  setStatus(issues.length?'partial':failed?'error':'ready',issues.length?`${message} Hay ${issues.length} ${issues.length===1?'archivo pendiente':'archivos pendientes'}; revisa la lista.`:failed?'Algunas vistas previas están pendientes. Reintenta la sincronización.':message,issues.length,[...issues]);
 }
 async function synchronize() {
  if(!canAccess()||!identity)return;
  if(flight){rerun=true;return flight;}
  if(blocked()){rerun=true;return;}
  const token=epoch;rerun=false;
  const task=process(token).catch(error=>{
   if(cancelled(token))return;
   const message=error.message||'No se pudo sincronizar la biblioteca.';
   const setup=/bucket|biblioteca.*configur|04-biblioteca|STRIP_LIBRARY_SETUP/i.test(message);
   setStatus(setup?'setup':'error',setup?'Falta activar la biblioteca compartida en Supabase. Tus tiras de este equipo se conservan.':`Sincronización pendiente: ${message}`);
   clearTimeout(retryTimer);if(!setup)retryTimer=setTimeout(()=>schedule(),20000);
   throw error;
  }).finally(()=>{if(token!==epoch)return;if(flight===task)flight=null;if(rerun&&!blocked())schedule(250);});
  flight=task;return task;
 }
 async function refresh() {
  if(!canAccess()){
   const failure=Error('No se pudo sincronizar. Comprueba la conexión e inicia sesión de nuevo si se solicita.');
   setStatus('error',failure.message,0,[]);throw failure;
  }
  connect();const token=epoch;
  if(blocked()){
   rerun=true;setStatus('paused','La sincronización continuará al volver a esta pantalla y cerrar la bienvenida.');return status;
  }
  setStatus('syncing','Consultando la biblioteca compartida…',0,[]);
  try{
   // A manual refresh must request the server, even when the local revision or
   // this browser's image cache has not changed since the last background poll.
   if(flight)await flight.catch(()=>{});
   assertActive(token);
   const latest=await getCloud().refreshStripLibrary({cancelled:()=>cancelled(token)});assertActive(token);
   if(flight)await flight.catch(()=>{});assertActive(token);
   manifest=validateStripLibrary(getCloud().remote?.data?.stripLibrary??getLibrary()??latest);signature=JSON.stringify(manifest);clearTimeout(timer);timer=0;
   await synchronize();assertActive(token);
   return status;
  }catch(error){
   if(cancelled(token))return;
   if(status.phase!=='setup')setStatus('error',`No se pudo actualizar la biblioteca: ${error.message}`);
   throw error;
  }
 }
 async function publish(record) {
  if(!canAccess())throw Error('La tira se guardó en este equipo. Inicia sesión para compartirla.');
  connect();let stored;
  for(let attempt=0;attempt<3;attempt++){await synchronize();stored=await readStripRecord(record.id);if(stored?.asset&&!stored._sync?.dirty)return stored;}
  throw Error('La tira se conservó en este equipo; su sincronización está pendiente. Revisa el estado de la biblioteca.');
 }
 async function remove(id,{cancelled:external=()=>false}={}) {
  if(!canAccess())throw Error('Inicia sesión para eliminar la tira de la biblioteca compartida.');
  const token=epoch,record=await readStripRecord(id);assertActive(token);
  if(!inWorkspace(record)||record?.source!=='generated')throw Error('Solo puedes eliminar tiras creadas en esta herramienta.');
  await getCloud().changeStripLibrary({remove:[id],cancelled:()=>cancelled(token)||external()});assertActive(token);
  if(external())return;await updateStripRecord(id,current=>{assertActive(token);if(current&&inWorkspace(current)&&editKey(current)===editKey(record))return null;});onChange();schedule();return record;
 }
 async function getRecord(id) {
  const token=epoch;assertActive(token);const record=await readStripRecord(id);assertActive(token);
  if(!record||!inWorkspace(record))throw Error('La tira ya no está en esta biblioteca.');
  const deleted=manifest.deleted.find(item=>item.id===id);
  if(deleted&&(!record._sync?.dirty||Date.parse(record._sync.changedAt)<=Date.parse(deleted.deletedAt))||record.asset&&!record._sync?.dirty&&!manifest.entries.some(item=>item.id===id))throw Error('La tira fue retirada de la biblioteca compartida.');
  if(record.asset&&!record._sync?.dirty&&!sameAsset(manifest.entries.find(item=>item.id===id)?.asset,record.asset))throw Error('La tira cambió. Espera a que termine la sincronización.');
  if(record.blob)return record.asset&&record.blob.type!==record.asset.type?{...record,blob:record.blob.slice(0,record.blob.size,record.asset.type)}:record;
  if(!record.asset)throw Error('La imagen está pendiente de sincronización en el equipo original.');
  const blob=await getCloud().downloadStripAsset(record.asset);assertActive(token);
  let accepted=false;const cached=await updateStripRecord(id,current=>{assertActive(token);if(current&&inWorkspace(current)&&!current._sync?.dirty&&sameAsset(current.asset,record.asset)){accepted=true;return {...current,blob};}});assertActive(token);if(!accepted||manifest.deleted.some(item=>item.id===id)||!sameAsset(manifest.entries.find(item=>item.id===id)?.asset,record.asset))throw Error('La tira cambió mientras se descargaba. Vuelve a seleccionarla.');return cached;
 }
 const wake=()=>{if(canAccess()&&!blocked()&&(rerun||['error','setup'].includes(status.phase)))schedule();};
 new MutationObserver(wake).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);window.addEventListener('online',()=>{if(canAccess())schedule();});
 return {connect,synchronize,refresh,publish,remove,getRecord,visibleMetadata,getWorkspace:()=>workspace,getStatus:()=>status,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},stop(){epoch++;identity='';signature='';clearTimeout(timer);clearTimeout(retryTimer);flight=null;rerun=false;manifest=emptyStripLibrary();setStatus('idle','Inicia sesión para consultar la biblioteca compartida.',0,[]);}};
}
