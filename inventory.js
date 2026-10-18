export function initialState(catalog){return {version:1,customers:[],batches:[],unitSettings:{quarterMl:62.5,gallonMl:4000},materials:[{id:'alcohol',name:'Alcohol',kind:'Base',stock:0,min:500},{id:'galaxolide',name:'Galaxolide',kind:'Fijador',stock:0,min:100},...catalog.map(p=>({id:'ess-'+p.id,name:p.name,kind:'Esencia',stock:0,min:30}))],ready:{},movements:[]};}
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
export function validateBackup(s,catalog){const base=initialState(catalog);if(s?.version!==1||!Array.isArray(s.materials)||s.materials.length!==base.materials.length||!Array.isArray(s.movements)||!s.ready||typeof s.ready!=='object'||Array.isArray(s.ready))throw Error('El archivo no es un respaldo válido de Alma Mía.');for(const m of base.materials){const found=s.materials.filter(x=>x.id===m.id);if(found.length!==1||!Number.isFinite(found[0].stock)||found[0].stock<0||!Number.isFinite(found[0].min)||found[0].min<0)throw Error('El respaldo contiene existencias inválidas.');m.stock=found[0].stock;m.min=found[0].min;if(found[0].secondBottle!==undefined){const b=found[0].secondBottle;if(!b||!Number.isFinite(b.capacity)||b.capacity<=0||!Number.isFinite(b.stock)||b.stock<0||b.stock>b.capacity||b.stock>m.stock)throw Error('Segundo frasco inválido en el respaldo.');m.secondBottle={capacity:b.capacity,stock:b.stock};}}for(const[key,n]of Object.entries(s.ready)){const p=key.match(/^(\d{2,3})-(50|100)$/);if(!p||!catalog.some(x=>x.id===p[1])||!Number.isSafeInteger(n)||n<0)throw Error('Stock de perfumes inválido.');}if(s.movements.some(m=>!m||typeof m.label!=='string'||typeof m.detail!=='string'||!Number.isFinite(m.delta)||!['ml','frascos'].includes(m.unit)||!Number.isFinite(Date.parse(m.date))))throw Error('Historial inválido.');const unitSettings=s.unitSettings??{quarterMl:null,gallonMl:null};for(const name of ['quarterMl','gallonMl']){const value=unitSettings[name];if(value!==null&&(!Number.isFinite(value)||value<=0))throw Error('Conversión de unidades inválida.');}validateCustomers(s.customers??[]);validateBatches(s.batches??[],catalog);return {...base,batches:(s.batches??[]).map(b=>{const copy=structuredClone(b);if(copy.items.some(i=>i.completed===undefined)){copy.workflow='preaccounted';copy.items=copy.items.map(i=>i.completed===undefined?{...i,completed:0,preaccounted:i.qty}:i);delete copy.completedAt;}return copy;}),customers:structuredClone(s.customers??[]),ready:s.ready,movements:s.movements,unitSettings:{quarterMl:unitSettings.quarterMl??62.5,gallonMl:unitSettings.gallonMl??4000}};}

// All items are applied to a copy; a failed row never partially saves a batch.
export function productionPreview(state,items,catalog,purpose={type:'stock'},batchId=globalThis.crypto.randomUUID()){
 if(!Array.isArray(items)||!items.length)throw Error('Selecciona al menos un perfume.');
 if(!purpose||!['stock','customer'].includes(purpose.type))throw Error('Selecciona el destino de la producción.');
 const customer=purpose.type==='customer'?(state.customers??[]).find(c=>c.id===purpose.customerId):null;
 if(purpose.type==='customer'&&!customer)throw Error('Selecciona un cliente registrado o registra uno nuevo.');
 if((state.batches??[]).some(b=>b.id===batchId))throw Error('Este lote ya fue confirmado.');
 const seen=new Set(),rows=items.map(item=>{const p=catalog.find(p=>p.id===item.id),key=item.id+'-'+item.size;if(!p||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1||seen.has(key))throw Error('Revisa los perfumes, las presentaciones y las cantidades del lote.');seen.add(key);return {id:p.id,name:p.name,reference:p.reference,category:p.category,line:p.line,size:item.size,qty:item.qty,completed:0};});
 const totals=rows.reduce((t,item)=>{const r=recipeFor(item.size);t.qty+=item.qty;t.volumeMl+=item.size*item.qty;t.essenceMl+=r.essence*item.qty;t.fixativeMl+=r.fixative*item.qty;t.alcoholMl+=r.alcohol*item.qty;return t;},{qty:0,volumeMl:0,essenceMl:0,fixativeMl:0,alcoholMl:0});
 return {id:batchId,number:Math.max(0,...(state.batches??[]).map(b=>b.number))+1,date:new Date().toISOString(),purpose:customer?{type:'customer',customerId:customer.id,customerName:customer.name}:{type:'stock'},items:rows,totals};
}
export function produceBatch(state,items,catalog,purpose={type:'stock'},batchId){
 const batch=productionPreview(state,items,catalog,purpose,batchId);let next=structuredClone(state);
 for(const item of batch.items){next=produce(next,item,catalog);item.completed=item.qty;const movement=next.movements[0];movement.production=structuredClone(batch.purpose);movement.batchId=batch.id;movement.detail+=' · '+(batch.purpose.type==='customer'?'Pedido de '+batch.purpose.customerName:'Producción para stock')+' · Lote AM-'+String(batch.number).padStart(4,'0');}
 next.batches??=[];next.batches.unshift(batch);return next;
}
export function confirmProduction(state,preview,catalog){
 const batch=productionPreview(state,preview.items,catalog,preview.purpose,preview.id);batch.workflow='progress';batch.items=batch.items.map(item=>({...item,completed:0}));const next=structuredClone(state);next.batches??=[];next.batches.unshift(batch);return next;
}
export function completedQuantity(item){return item.completed??0;}
export function batchProgress(batch){const completed=batch.items.reduce((n,item)=>n+completedQuantity(item),0),total=batch.items.reduce((n,item)=>n+item.qty,0);return {completed,total,pending:total-completed,ready:completed===total,label:completed===total?(batch.purpose.type==='customer'?'Listo para entrega':'Listo para anaquel'):'En producción'};}
export function completeBatchItem(state,{batchId,id,size,completed},catalog){
 const batch=(state.batches??[]).find(b=>b.id===batchId),item=batch?.items.find(i=>i.id===id&&i.size===size);if(!item)throw Error('No se encontró el perfume dentro del lote.');const previous=completedQuantity(item);
 if(!Number.isSafeInteger(completed)||completed<previous||completed>item.qty)throw Error('Indica un total de envases hechos entre '+previous+' y '+item.qty+'.');
 if(completed===previous)return structuredClone(state);
 const accounted=item.preaccounted??(item.completed===undefined?item.qty:0),newUnits=Math.max(0,completed-accounted)-Math.max(0,previous-accounted);const next=newUnits?produce(state,{id,size,qty:newUnits},catalog):structuredClone(state);if(!newUnits)next.movements.unshift({date:new Date().toISOString(),label:item.name,detail:'Avance registrado; insumos y perfumes contabilizados en la versión anterior',delta:completed-previous,unit:'frascos'});const saved=next.batches.find(b=>b.id===batchId),row=saved.items.find(i=>i.id===id&&i.size===size),now=new Date().toISOString();row.completed=completed;if(accounted)row.preaccounted=accounted;saved.updatedAt=now;if(batchProgress(saved).ready)saved.completedAt=now;
 const movement=next.movements[0];movement.production=structuredClone(batch.purpose);movement.batchId=batchId;movement.detail+=' · '+(batch.purpose.type==='customer'?'Pedido de '+batch.purpose.customerName:'Producción para stock')+' · Lote AM-'+String(batch.number).padStart(4,'0');return next;
}
function validateBatches(batches,catalog){
 if(!Array.isArray(batches))throw Error('Lista de lotes inválida.');const ids=new Set(),numbers=new Set();
 for(const b of batches){if(!b||typeof b.id!=='string'||!b.id||ids.has(b.id)||!Number.isSafeInteger(b.number)||b.number<1||numbers.has(b.number)||!Number.isFinite(Date.parse(b.date))||!b.purpose||!['stock','customer'].includes(b.purpose.type)||!Array.isArray(b.items)||!b.items.length)throw Error('Lote inválido en el respaldo.');ids.add(b.id);numbers.add(b.number);if(b.purpose.type==='customer'&&(typeof b.purpose.customerId!=='string'||typeof b.purpose.customerName!=='string'||!b.purpose.customerName.trim()))throw Error('Cliente del lote inválido.');const seen=new Set(),totals={qty:0,volumeMl:0,essenceMl:0,fixativeMl:0,alcoholMl:0};for(const item of b.items){const key=item.id+'-'+item.size;if(!catalog.some(p=>p.id===item.id)||!['name','reference','category','line'].every(k=>typeof item[k]==='string')||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1||seen.has(key))throw Error('Detalle de lote inválido.');seen.add(key);const r=recipeFor(item.size);totals.qty+=item.qty;totals.volumeMl+=item.qty*item.size;totals.essenceMl+=item.qty*r.essence;totals.fixativeMl+=item.qty*r.fixative;totals.alcoholMl+=item.qty*r.alcohol;}if(b.items.some(i=>i.preaccounted!==undefined&&(!Number.isSafeInteger(i.preaccounted)||i.preaccounted<0||i.preaccounted>i.qty)))throw Error('Contabilización anterior inválida.');if(b.items.some(i=>i.completed!==undefined&&(!Number.isSafeInteger(i.completed)||i.completed<0||i.completed>i.qty))||(b.workflow==='progress'&&b.items.some(i=>i.completed===undefined)))throw Error('Avance de producción inválido.');for(const key of ['updatedAt','completedAt'])if(b[key]!==undefined&&!Number.isFinite(Date.parse(b[key])))throw Error('Fecha de avance inválida.');if(!b.totals||Object.keys(totals).some(k=>b.totals[k]!==totals[k]))throw Error('Totales del lote inválidos.');}
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

function validateCustomers(customers){
 if(!Array.isArray(customers))throw Error('Lista de clientes inválida.');const ids=new Set();
 for(const c of customers){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>120||typeof c.phone!=='string'||c.phone.length>50)throw Error('Cliente inválido en el respaldo.');ids.add(c.id);}
}
export function registerCustomer(state,{name,phone=''}){
 const clean=typeof name==='string'?name.trim():'';const contact=typeof phone==='string'?phone.trim():'';
 if(!clean||clean.length>120||contact.length>50)throw Error('Introduce el nombre del cliente (máximo 120 caracteres).');
 if((state.customers??[]).some(c=>c.name.toLocaleLowerCase()===clean.toLocaleLowerCase()&&c.phone===contact))throw Error('Este cliente ya está registrado. Selecciónalo en la lista.');
 const next=structuredClone(state);next.customers??=[];next.customers.push({id:globalThis.crypto.randomUUID(),name:clean,phone:contact});return next;
}

export function attributeSessionChanges(previous,next,actor){
 if(!['Luis','Ximena'].includes(actor))throw Error('Selecciona Luis o Ximena en “¿Quién está en esta sesión?” antes de guardar.');
 const result=structuredClone(next),added=result.movements.length-previous.movements.length;
 if(added<0)throw Error('No se puede atribuir una sustitución del historial como un movimiento nuevo.');
 for(const movement of result.movements.slice(0,added))movement.performedBy=actor;
 for(const batch of result.batches??[]){const old=(previous.batches??[]).find(b=>b.id===batch.id);if(!old){batch.createdBy=actor;continue;}const changed=batch.items.filter(item=>{const before=old.items.find(i=>i.id===item.id&&i.size===item.size);return before&&completedQuantity(before)!==completedQuantity(item);});if(changed.length){batch.updatedBy=actor;for(const item of changed)item.completedBy=actor;if(batchProgress(batch).ready)batch.completedBy=actor;}}
 for(const customer of result.customers??[])if(!(previous.customers??[]).some(c=>c.id===customer.id))customer.createdBy=actor;
 return result;
}
