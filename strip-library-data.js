import {validateStripDesign} from './strip-designer.js?v=78';

export const STRIP_LIBRARY_BUCKET = 'strip-library';
export const MAX_STRIP_ASSET_BYTES = 80 * 1024 * 1024;
export const STRIP_ASSET_PART_BYTES = 8 * 1024 * 1024;
export const emptyStripLibrary = () => ({version:1,entries:[],deleted:[]});
const imageTypes = new Set(['image/png','image/jpeg','image/webp']);
const safePath = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/(?:image|thumb|part-\d{3})\.(?:png|jpg|webp|bin)$/;
const fail = () => {throw Error('La biblioteca compartida de tiras contiene información inválida.');};
function text(value,max,{optional=false,empty=false}={}) {
 if(value===undefined&&optional)return undefined;
 if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u001f\u007f]/u.test(value))fail();
 return value;
}
function date(value,optional=true) {if(value===undefined&&optional)return undefined;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))fail();return value;}
export function validateStripAsset(ref,{thumbnail=false}={}) {
 const limit=thumbnail?1024*1024:MAX_STRIP_ASSET_BYTES;
 if(!ref||ref.bucket!==STRIP_LIBRARY_BUCKET||typeof ref.path!=='string'||!safePath.test(ref.path)||!imageTypes.has(ref.type)||!Number.isSafeInteger(ref.size)||ref.size<1||ref.size>limit)fail();
 const clean={bucket:STRIP_LIBRARY_BUCKET,path:ref.path,type:ref.type,size:ref.size};
 if(ref.sha256!==undefined){if(typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))fail();clean.sha256=ref.sha256;}
 if(ref.parts!==undefined){
  if(!Array.isArray(ref.parts)||ref.parts.length<2||ref.parts.length>10||ref.path!==ref.parts[0]?.path)fail();
  let total=0;const seen=new Set(),folder=ref.path.slice(0,ref.path.lastIndexOf('/'));
  clean.parts=ref.parts.map((part,index)=>{
   if(!part||typeof part.path!=='string'||!safePath.test(part.path)||part.path!==`${folder}/part-${String(index).padStart(3,'0')}.bin`||seen.has(part.path)||!Number.isSafeInteger(part.size)||part.size<1||part.size>STRIP_ASSET_PART_BYTES||(index<ref.parts.length-1&&part.size!==STRIP_ASSET_PART_BYTES))fail();
   seen.add(part.path);total+=part.size;return {path:part.path,size:part.size};
  });
  if(total!==ref.size)fail();
 }else if(ref.size>STRIP_ASSET_PART_BYTES||!ref.path.endsWith(ref.type==='image/jpeg'?'.jpg':ref.type==='image/webp'?'.webp':'.png'))fail();
 return clean;
}
export function validateStripRecord(record) {
 if(!record||typeof record!=='object'||Array.isArray(record)||!['imported','generated'].includes(record.source)||![null,50,100].includes(record.size)||!Number.isSafeInteger(record.width)||!Number.isSafeInteger(record.height)||record.width<1||record.height<1||record.width*record.height>80000000)fail();
 const clean={id:text(record.id,1024),filename:text(record.filename,1024),name:text(record.name,160),size:record.size,productId:record.productId===null||record.productId===undefined?null:text(record.productId,80),warning:text(record.warning??'',500,{empty:true}),width:record.width,height:record.height,source:record.source,asset:validateStripAsset(record.asset)};
 if(record.category!==undefined)clean.category=text(record.category,80);
 if(record.resolution!==undefined){const {x,y,source}=record.resolution??{};if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||y<=0||x>100000||y>100000)fail();clean.resolution={x,y,source:text(source,80)};}
 if(record.thumbnail!==undefined)clean.thumbnail=validateStripAsset(record.thumbnail,{thumbnail:true});
 for(const key of ['createdAt','updatedAt'])if(record[key]!==undefined)clean[key]=date(record[key]);
 for(const key of ['createdBy','updatedBy'])if(record[key]!==undefined){if(!['Luis','Ximena'].includes(record[key]))fail();clean[key]=record[key];}
 if(record.contentHash!==undefined){if(typeof record.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(record.contentHash))fail();clean.contentHash=record.contentHash;}
 if(record.source==='generated'){
  clean.design=validateStripDesign(record.design);
  if(clean.design.name!==clean.name||clean.design.size!==clean.size)fail();
 }
 return clean;
}
export function validateStripLibrary(value) {
 if(value===undefined||value===null)return emptyStripLibrary();
 if(!value||value.version!==1||!Array.isArray(value.entries)||!Array.isArray(value.deleted)||value.entries.length>10000||value.deleted.length>20000)fail();
 const seen=new Set(),entries=value.entries.map(record=>{const clean=validateStripRecord(record);if(seen.has(clean.id))fail();seen.add(clean.id);return clean;});
 const deleted=value.deleted.map(item=>{const id=text(item?.id,1024);if(seen.has(id))fail();seen.add(id);const clean={id,deletedAt:date(item.deletedAt,false)};if(item.deletedBy!==undefined){if(!['Luis','Ximena'].includes(item.deletedBy))fail();clean.deletedBy=item.deletedBy;}return clean;});
 const result={version:1,entries,deleted};
 if(JSON.stringify(result).length>4000000)throw Error('La biblioteca compartida supera el límite de metadatos.');
 return result;
}
export function mergeStripLibrary(value,{upsert=[],remove=[]}={}, {actor,now=new Date().toISOString()}={}) {
 const current=validateStripLibrary(value);
 if(!Array.isArray(upsert)||!Array.isArray(remove))fail();
 if(actor!==undefined&&!['Luis','Ximena'].includes(actor))fail();date(now,false);
 const entries=new Map(current.entries.map(record=>[record.id,record])),deleted=new Map(current.deleted.map(item=>[item.id,item]));
 const added=new Set();
 for(const input of upsert){
  const record=validateStripRecord(input);if(added.has(record.id))fail();added.add(record.id);
  const tombstone=deleted.get(record.id),changedAt=Date.parse(record.updatedAt??record.createdAt??'');
  if(tombstone&&(!Number.isFinite(changedAt)||changedAt<=Date.parse(tombstone.deletedAt)))continue;
  const previous=entries.get(record.id);
  const candidate={...record,createdAt:previous?.createdAt??record.createdAt??now,updatedAt:now};
  if(actor){candidate.createdBy=previous?.createdBy??record.createdBy??actor;candidate.updatedBy=actor;}
  // A newer explicit save can recreate a deleted design. Pending uploads carry
  // their original change time so another device's later deletion wins.
  entries.set(record.id,candidate);deleted.delete(record.id);
 }
 const removed=new Set();
 for(const id of remove){text(id,1024);if(added.has(id)||removed.has(id))fail();removed.add(id);const record=entries.get(id);
  if(record&&record.source!=='generated')throw Error('Solo puedes eliminar tiras creadas en esta herramienta.');
  entries.delete(id);if(!deleted.has(id))deleted.set(id,{id,deletedAt:now,...(actor?{deletedBy:actor}:{})});
 }
 return validateStripLibrary({version:1,entries:[...entries.values()],deleted:[...deleted.values()]});
}
export function stripRecordFingerprint(record) {
 const clean=validateStripRecord(record);
 // Storage paths and synchronization timestamps do not define the artwork.
 const {asset,thumbnail,createdAt,updatedAt,createdBy,updatedBy,...metadata}=clean;
 return JSON.stringify({...metadata,bytes:asset.size,type:asset.type});
}
