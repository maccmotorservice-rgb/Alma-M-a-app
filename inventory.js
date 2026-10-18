export function initialState(catalog){return {version:1,unitSettings:{quarterMl:62.5,gallonMl:4000},materials:[{id:'alcohol',name:'Alcohol',kind:'Base',stock:0,min:500},{id:'galaxolide',name:'Galaxolide',kind:'Fijador',stock:0,min:100},...catalog.map(p=>({id:'ess-'+p.id,name:p.name,kind:'Esencia',stock:0,min:30}))],ready:{},movements:[]};}
export function applyMovement(state,{type,id,amount,note=''}){const s=structuredClone(state);if(!Number.isFinite(amount)||amount<=0)throw Error('Introduce una cantidad mayor que cero.');const m=s.materials.find(m=>m.id===id);if(!m)throw Error('Insumo no encontrado.');const delta=type==='entry'?amount:type==='exit'?-amount:NaN;if(!Number.isFinite(delta))throw Error('Movimiento inválido.');if(m.stock+delta<0)throw Error('No hay suficientes existencias.');changeTotal(m,m.stock+delta);s.movements.unshift({date:new Date().toISOString(),label:m.name,detail:note,delta,unit:'ml'});return s;}
export function recipeFor(size){
 if(![50,100].includes(size))throw Error('Presentación inválida.');
 const scale=size/100;return {essence:30*scale,fixative:2*scale,alcohol:68*scale};
}
export function produce(state,{id,size,qty},catalog){
 if(!catalog.some(p=>p.id===id)||![50,100].includes(size)||!Number.isSafeInteger(qty)||qty<1)throw Error('Revisa el perfume, la presentación y el número de envases.');
 const recipe=recipeFor(size),s=structuredClone(state),needs=[['ess-'+id,qty*recipe.essence],['galaxolide',qty*recipe.fixative],['alcohol',qty*recipe.alcohol]];
 for(const[key,n]of needs){const m=s.materials.find(x=>x.id===key);if(!m||m.stock+0.000001<n)throw Error('Existencias insuficientes: '+(m?.name||key));}
 for(const[key,n]of needs){const m=s.materials.find(x=>x.id===key);changeTotal(m,m.stock-n);}
 s.ready[id+'-'+size]=(s.ready[id+'-'+size]||0)+qty;
 s.movements.unshift({date:new Date().toISOString(),label:catalog.find(p=>p.id===id).name,detail:`Preparación · ${size} ml · Por envase: ${recipe.essence} ml esencia, ${recipe.fixative} ml galaxolide, ${recipe.alcohol} ml alcohol`,delta:qty,unit:'frascos'});return s;
}
export function readyMovement(state,{id,size,qty,type},catalog){if(!catalog.some(p=>p.id===id)||![50,100].includes(size)||!Number.isInteger(qty)||qty<1||!['entry','delivery'].includes(type))throw Error('Revisa el perfume y la cantidad de frascos.');const s=structuredClone(state),key=id+'-'+size,delta=type==='entry'?qty:-qty;if((s.ready[key]||0)+delta<0)throw Error('No hay suficientes perfumes listos.');s.ready[key]=(s.ready[key]||0)+delta;s.movements.unshift({date:new Date().toISOString(),label:catalog.find(p=>p.id===id).name,detail:(type==='entry'?'Ingreso de perfume ya preparado':'Entrega')+` · ${size} ml`,delta,unit:'frascos'});return s;}
export function validateBackup(s,catalog){const base=initialState(catalog);if(s?.version!==1||!Array.isArray(s.materials)||s.materials.length!==base.materials.length||!Array.isArray(s.movements)||!s.ready||typeof s.ready!=='object'||Array.isArray(s.ready))throw Error('El archivo no es un respaldo válido de Alma Mía.');for(const m of base.materials){const found=s.materials.filter(x=>x.id===m.id);if(found.length!==1||!Number.isFinite(found[0].stock)||found[0].stock<0||!Number.isFinite(found[0].min)||found[0].min<0)throw Error('El respaldo contiene existencias inválidas.');m.stock=found[0].stock;m.min=found[0].min;if(found[0].secondBottle!==undefined){const b=found[0].secondBottle;if(!b||!Number.isFinite(b.capacity)||b.capacity<=0||!Number.isFinite(b.stock)||b.stock<0||b.stock>b.capacity||b.stock>m.stock)throw Error('Segundo frasco inválido en el respaldo.');m.secondBottle={capacity:b.capacity,stock:b.stock};}}for(const[key,n]of Object.entries(s.ready)){const p=key.match(/^(\d{2,3})-(50|100)$/);if(!p||!catalog.some(x=>x.id===p[1])||!Number.isSafeInteger(n)||n<0)throw Error('Stock de perfumes inválido.');}if(s.movements.some(m=>!m||typeof m.label!=='string'||typeof m.detail!=='string'||!Number.isFinite(m.delta)||!['ml','frascos'].includes(m.unit)||!Number.isFinite(Date.parse(m.date))))throw Error('Historial inválido.');const unitSettings=s.unitSettings??{quarterMl:null,gallonMl:null};for(const name of ['quarterMl','gallonMl']){const value=unitSettings[name];if(value!==null&&(!Number.isFinite(value)||value<=0))throw Error('Conversión de unidades inválida.');}return {...base,ready:s.ready,movements:s.movements,unitSettings:{quarterMl:unitSettings.quarterMl??62.5,gallonMl:unitSettings.gallonMl??4000}};}

// All items are applied to a copy; a failed row never partially saves a batch.
export function produceBatch(state,items,catalog){
 if(!Array.isArray(items)||!items.length)throw Error('Selecciona al menos un perfume.');
 let next=structuredClone(state);const seen=new Set();
 for(const item of items){const key=item.id+'-'+item.size;if(seen.has(key))throw Error('Una presentación está repetida.');seen.add(key);next=produce(next,item,catalog);}
 return next;
}
export function setMaterialStock(state,{id,amount,factor=1,unit='ml'}){
 if(!Number.isFinite(amount)||amount<0||!Number.isFinite(factor)||factor<=0||!Number.isFinite(amount*factor))throw Error('Introduce una cantidad válida.');
 const next=structuredClone(state),m=next.materials.find(m=>m.id===id);if(!m)throw Error('Materia prima no encontrada.');
 const previous=m.stock;changeTotal(m,amount*factor);
 next.movements.unshift({date:new Date().toISOString(),label:m.name,detail:`Actualización de existencias: ${amount} ${unit} (antes ${previous} ml)`,delta:Math.round((m.stock-previous)*1000)/1000,unit:'ml'});
 return next;
}

export function readyBatch(state,items,catalog){
 if(!Array.isArray(items)||!items.length)throw Error('Selecciona al menos un perfume.');
 let next=structuredClone(state);const seen=new Set();
 for(const item of items){const key=item.id+'-'+item.size;if(seen.has(key))throw Error('Una presentación está repetida.');seen.add(key);next=readyMovement(next,{...item,type:'entry'},catalog);}
 return next;
}

function changeTotal(material,total){
 if(material.secondBottle){const consumed=Math.max(0,material.stock-total),first=material.stock-material.secondBottle.stock;material.secondBottle.stock=Math.max(0,Math.round((material.secondBottle.stock-Math.max(0,consumed-first))*1000)/1000);}
 material.stock=Math.round(total*1000)/1000;
}
export function setBottleStocks(state,{id,firstStock,secondBottle=null}){
 if(!Number.isFinite(firstStock)||firstStock<0)throw Error('Revisa cuánto queda en el primer frasco.');
 if(secondBottle&&(!Number.isFinite(secondBottle.capacity)||secondBottle.capacity<=0||!Number.isFinite(secondBottle.stock)||secondBottle.stock<0||secondBottle.stock>secondBottle.capacity))throw Error('El segundo frasco necesita una capacidad válida y existencias entre cero y su capacidad.');
 const next=structuredClone(state),m=next.materials.find(x=>x.id===id);if(!m)throw Error('Materia prima no encontrada.');const previous=m.stock;
 m.stock=Math.round((firstStock+(secondBottle?.stock||0))*1000)/1000;if(secondBottle)m.secondBottle={capacity:secondBottle.capacity,stock:Math.round(secondBottle.stock*1000)/1000};else delete m.secondBottle;
 next.movements.unshift({date:new Date().toISOString(),label:m.name,detail:`Actualización: primer frasco ${firstStock} ml${secondBottle?`, segundo frasco ${secondBottle.stock} de ${secondBottle.capacity} ml`:''}`,delta:Math.round((m.stock-previous)*1000)/1000,unit:'ml'});return next;
}
