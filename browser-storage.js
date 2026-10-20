// Some browsers deny Storage access or writes. Keep this page usable without
// clearing existing data; failed changes remain private to this page's memory.
export function createBrowserStorage(name,{getStorage=()=>globalThis[name]}={}) {
 const known=new Map(),pending=new Map();
 const storage=()=>{try{return getStorage();}catch{return null;}};
 function keys() {
  let result;
  try {
   const source=storage();if(!source)throw Error('Storage unavailable');
   result=new Set();
   for(let index=0;index<source.length;index++){const key=source.key(index);if(key!==null)result.add(String(key));}
   for(const key of known.keys())if(!result.has(key)&&!pending.has(key))known.delete(key);
  }catch{result=new Set(known.keys());}
  for(const [key,value] of pending)if(value===null)result.delete(key);else result.add(key);
  return [...result];
 }
 return {
  getItem(key) {
   key=String(key);if(pending.has(key))return pending.get(key);
   try {
    const source=storage();if(!source)throw Error('Storage unavailable');
    const value=source.getItem(key);
    if(value===null){known.delete(key);return null;}
    known.set(key,String(value));return String(value);
   }catch{return known.get(key)??null;}
  },
  setItem(key,value) {
   key=String(key);value=String(value);known.set(key,value);
   try {
    const source=storage();if(!source)throw Error('Storage unavailable');
    source.setItem(key,value);pending.delete(key);
   }catch{pending.set(key,value);}
  },
  removeItem(key) {
   key=String(key);known.delete(key);
   try {
    const source=storage();if(!source)throw Error('Storage unavailable');
    source.removeItem(key);pending.delete(key);
   }catch{pending.set(key,null);}
  },
  key(index) {index=Number(index??0);return Number.isFinite(index)&&index>=0?(keys()[Math.floor(index)]??null):null;},
  get length(){return keys().length;}
 };
}

// Resolve browser globals only when used, so merely importing this module is safe.
export const localStore=createBrowserStorage('localStorage');
export const sessionStore=createBrowserStorage('sessionStorage');
