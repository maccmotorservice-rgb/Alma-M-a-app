// The existing database stays intact. It is now a cache and an upload queue.
let database;
export function openStripDatabase() {
 if (!database) database = new Promise((resolve,reject) => {
  const request = indexedDB.open('alma-mia-tiras',1);
  request.onupgradeneeded = () => request.result.createObjectStore('images',{keyPath:'id'});
  request.onsuccess = () => {const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};
  request.onerror = () => {database=null;reject(request.error);};
 });
 return database;
}
export async function stripTransaction(mode,operation) {
 const db=await openStripDatabase();
 return new Promise((resolve,reject) => {
  const tx=db.transaction('images',mode);let request;
  try {request=operation(tx.objectStore('images'));}catch(error){tx.abort();reject(error);return;}
  tx.oncomplete=()=>resolve(request?.result);
  tx.onerror=()=>reject(tx.error||Error('No se pudo guardar la biblioteca.'));
  tx.onabort=()=>reject(tx.error||Error('Guardado cancelado.'));
 });
}
export const readStripRecord=id=>stripTransaction('readonly',store=>store.get(id));
export const writeStripRecord=record=>stripTransaction('readwrite',store=>store.put(record));
export const removeStripRecord=id=>stripTransaction('readwrite',store=>store.delete(id));
// Guard the current record inside one transaction; an async download must never
// replace an edit that was made while it was in flight. Undefined means no change.
export async function updateStripRecord(id,transform) {
 const db=await openStripDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readwrite'),store=tx.objectStore('images');let result,failure;
  const request=store.get(id);
  request.onsuccess=()=>{try{const previous=request.result,next=transform(previous);result=next===undefined?previous:next;if(next===null)store.delete(id);else if(next!==undefined)store.put(next);}catch(error){failure=error;tx.abort();}};
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(failure||tx.error||Error('No se pudo actualizar la biblioteca.'));
  tx.onabort=()=>reject(failure||tx.error||Error('Actualización cancelada.'));
 });
}
export async function listStripMetadata() {
 const records=[],db=await openStripDatabase();
 await new Promise((resolve,reject)=>{
  const request=db.transaction('images').objectStore('images').openCursor();
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve();return;}const {blob,...metadata}=cursor.value;records.push(metadata);cursor.continue();};
  request.onerror=()=>reject(request.error);
 });
 return records;
}
