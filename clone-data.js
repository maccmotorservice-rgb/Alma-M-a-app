// Safari before 15.4 lacks structuredClone. Keep copies synchronous and independent.
export function cloneData(value){
 if(typeof globalThis.structuredClone==='function')return globalThis.structuredClone(value);
 return copy(value,new Map());
}
function copy(value,seen){
 if(value===null||typeof value!=='object'){
  if(typeof value==='function'||typeof value==='symbol')throw new TypeError('No se puede copiar este dato.');
  return value;
 }
 if(seen.has(value))return seen.get(value);
 let result;
 if(value instanceof Date)result=new Date(value.getTime());
 else if(value instanceof RegExp)result=new RegExp(value.source,value.flags);
 else if(value instanceof ArrayBuffer)result=value.slice(0);
 else if(ArrayBuffer.isView(value)){
  const buffer=copy(value.buffer,seen);
  result=value instanceof DataView?new DataView(buffer,value.byteOffset,value.byteLength):new value.constructor(buffer,value.byteOffset,value.length);
 }
 else if(typeof File!=='undefined'&&value instanceof File)result=new File([value],value.name,{type:value.type,lastModified:value.lastModified});
 else if(typeof Blob!=='undefined'&&value instanceof Blob)result=value.slice(0,value.size,value.type);
 else if(value instanceof Map){result=new Map();seen.set(value,result);for(const [key,item] of value)result.set(copy(key,seen),copy(item,seen));return result;}
 else if(value instanceof Set){result=new Set();seen.set(value,result);for(const item of value)result.add(copy(item,seen));return result;}
 else if(Array.isArray(value)||Object.prototype.toString.call(value)==='[object Object]'){
  result=Array.isArray(value)?new Array(value.length):{};seen.set(value,result);
  for(const key of Object.keys(value))Object.defineProperty(result,key,{value:copy(value[key],seen),enumerable:true,writable:true,configurable:true});
  return result;
 }else throw new TypeError('Tipo de dato no compatible con la copia.');
 seen.set(value,result);return result;
}

// Generate RFC 4122 v4 IDs using Web Crypto on Safari without randomUUID.
export function randomId(){
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
