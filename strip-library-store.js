// Keep originals and upload receipts intact. Repair a missing cache store by
// upgrading the existing database, never by deleting or recreating its data.
const DATABASE_NAME='alma-mia-tiras',STORE_NAME='images';
let database,connection;

function storageError(cause) {
 if(cause?.code==='STRIP_CACHE_BLOCKED'||cause?.code==='STRIP_CACHE_UNAVAILABLE')return cause;
 const message=cause?.name==='QuotaExceededError'?'No hay espacio suficiente para guardar la biblioteca de tiras en este dispositivo.':cause?.name==='SecurityError'?'El navegador no permite acceder a la biblioteca local de tiras. Abre la app en una pestaña normal con almacenamiento habilitado.':'No se pudo acceder a la biblioteca local de tiras. Vuelve a sincronizar; tus imágenes originales se conservan.';
 return Object.assign(new Error(message,{cause}),{code:'STRIP_CACHE_UNAVAILABLE'});
}
function forgetConnection(db) {
 if(connection===db){connection=undefined;database=undefined;}
 db.close();
}
function openRequest(version) {
 return new Promise((resolve,reject)=>{
  let request,settled=false,blockedTimer;
  const finish=(error,db)=>{
   clearTimeout(blockedTimer);
   if(settled){db?.close();return;}
   settled=true;if(error)reject(error);else resolve(db);
  };
  try{request=version===undefined?indexedDB.open(DATABASE_NAME):indexedDB.open(DATABASE_NAME,version);}catch(error){finish(error);return;}
  request.onupgradeneeded=()=>{
   if(settled){request.transaction.abort();return;}
   if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME,{keyPath:'id'});
  };
  request.onsuccess=()=>finish(null,request.result);
  request.onerror=()=>finish(request.error);
  request.onblocked=()=>{
   if(blockedTimer||settled)return;
   blockedTimer=setTimeout(()=>finish(Object.assign(new Error('La biblioteca local está abierta en otra pestaña. Cierra las otras pestañas de Alma Mía y vuelve a sincronizar.'),{code:'STRIP_CACHE_BLOCKED'})),8000);
  };
 });
}
async function connectDatabase() {
 let version;
 for(let attempt=0;attempt<4;attempt++){
  let db;
  try{db=await openRequest(version);}catch(error){
   // Another tab may have completed a newer repair while this upgrade waited.
   if(error?.name==='VersionError'){version=undefined;continue;}
   throw error;
  }
  if(db.objectStoreNames.contains(STORE_NAME))return db;
  version=db.version+1;db.close();
 }
 throw Error('No se pudo reparar el almacén local de tiras.');
}
export function openStripDatabase() {
 if(!database){
  const pending=connectDatabase().then(db=>{
   connection=db;
   db.onversionchange=()=>forgetConnection(db);
   db.onclose=()=>{if(connection===db){connection=undefined;database=undefined;}};
   return db;
  }).catch(error=>{if(database===pending)database=undefined;throw storageError(error);});
  database=pending;
 }
 return database;
}
async function transaction(mode,initialize) {
 for(let attempt=0;attempt<2;attempt++){
  const db=await openStripDatabase();let tx;
  try{tx=db.transaction(STORE_NAME,mode);tx.objectStore(STORE_NAME);}
  catch(error){
   tx?.abort();
   if(['NotFoundError','InvalidStateError'].includes(error?.name)){
    forgetConnection(db);
    // Retry only transaction creation: no caller operation has run yet.
    if(attempt===0)continue;
   }
   throw storageError(error);
  }
  // Start requests in the same task as transaction creation. In particular,
  // Safari may close an idle transaction across an intervening promise turn.
  return new Promise((resolve,reject)=>initialize(tx,resolve,reject));
 }
}
export async function stripTransaction(mode,operation) {
 return transaction(mode,(tx,resolve,reject)=>{
  let request,failure;
  tx.oncomplete=()=>resolve(request?.result);
  tx.onerror=()=>reject(failure||storageError(tx.error));
  tx.onabort=()=>reject(failure||storageError(tx.error));
  try{request=operation(tx.objectStore(STORE_NAME));}catch(error){failure=error;tx.abort();}
 });
}
export const readStripRecord=id=>stripTransaction('readonly',store=>store.get(id));
export const writeStripRecord=record=>stripTransaction('readwrite',store=>store.put(record));
export const removeStripRecord=id=>stripTransaction('readwrite',store=>store.delete(id));
// Guard the current record inside one transaction; an async download must never
// replace an edit that was made while it was in flight. Undefined means no change.
export async function updateStripRecord(id,transform) {
 return transaction('readwrite',(tx,resolve,reject)=>{
  const store=tx.objectStore(STORE_NAME);let result,failure;
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(failure||storageError(tx.error));
  tx.onabort=()=>reject(failure||storageError(tx.error));
  const request=store.get(id);
  request.onsuccess=()=>{try{const previous=request.result,next=transform(previous);result=next===undefined?previous:next;if(next===null)store.delete(id);else if(next!==undefined)store.put(next);}catch(error){failure=error;tx.abort();}};
 });
}
export async function listStripMetadata() {
 const records=[];
 await transaction('readonly',(tx,resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(storageError(tx.error));
  tx.onabort=()=>reject(storageError(tx.error));
  const request=tx.objectStore(STORE_NAME).openCursor();
  request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const {blob,...metadata}=cursor.value;records.push(metadata);cursor.continue();};
 });
 return records;
}
