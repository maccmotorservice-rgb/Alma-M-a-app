import {validatePrintStock} from './print-stock.js?v=95';
import {materialRegistry,catalogForState} from './material-registry.js?v=95';
import {cloneData,randomId} from './clone-data.js?v=95';
import {emptyStripLibrary,validateStripLibrary} from './strip-library-data.js?v=95';
import {resolveCancellationReason} from './cancellation.js?v=95';
import {validateSalesNotes,activeSalesNoteForBatch,buildSalesNote,editSalesNote,salesCategory} from './sales.js?v=95';
export function extraBottles(material){return [...(material.secondBottle?[{number:2,...material.secondBottle}]:[]),...(material.additionalBottles??[])].sort((a,b)=>a.number-b.number);}
export function bottleStock(material,number=1){return number===1?Math.round((material.stock-extraBottles(material).reduce((n,b)=>n+b.stock,0))*1000)/1000:extraBottles(material).find(b=>b.number===number)?.stock??0;}
export function isMaterialLow(material){
 if(material.stock<=0)return false;
 if(material.kind!=='Esencia')return material.stock<=material.min;
 return [{stock:bottleStock(material,1),capacity:250},...extraBottles(material)].every(b=>b.stock<=b.capacity/4+0.000001);
}
export function bottleInfo(material,number){return extraBottles(material).find(b=>b.number===number);}
function bottleRef(material,number){return number===2?material.secondBottle:material.additionalBottles?.find(b=>b.number===number);}
export function initialState(catalog){return {version:1,salesNotes:[],customers:[],batches:[],stripLibrary:emptyStripLibrary(),unitSettings:{quarterMl:62.5,gallonMl:4000},materials:[{id:'alcohol',name:'Alcohol',kind:'Base',stock:0,min:500},{id:'galaxolide',name:'Galaxolide',kind:'Fijador',stock:0,min:100},...catalog.map(p=>({id:'ess-'+p.id,name:p.name,kind:'Esencia',stock:0,min:30,...(p.discontinued?{discontinued:true}:{})}))],ready:{},movements:[]};}
export function applyMovement(state,{type,id,amount,note=''}){const s=cloneData(state);if(!Number.isFinite(amount)||amount<=0)throw Error('Introduce una cantidad mayor que cero.');const m=s.materials.find(m=>m.id===id);if(!m)throw Error('Insumo no encontrado.');if(m.discontinued)throw Error('Este insumo está descontinuado y solo se conserva en el historial.');const delta=type==='entry'?amount:type==='exit'?-amount:NaN;if(!Number.isFinite(delta))throw Error('Movimiento inválido.');if(m.stock+delta<0)throw Error('No hay suficientes existencias.');changeTotal(m,m.stock+delta);s.movements.unshift({date:new Date().toISOString(),label:m.name,detail:note,delta,unit:'ml'});return s;}
export function recipeFor(size){
 if(![50,100].includes(size))throw Error('Presentación inválida.');
 const scale=size/100;return {essence:30*scale,fixative:2*scale,alcohol:68*scale};
}
export function produce(state,{id,size,qty},catalog){
 if(!catalog.some(p=>p.id===id&&!p.discontinued)||![50,100].includes(size)||!Number.isSafeInteger(qty)||qty<1)throw Error('Revisa el perfume, la presentación y el número de envases.');
 const recipe=recipeFor(size),s=cloneData(state),needs=[['ess-'+id,qty*recipe.essence],['galaxolide',qty*recipe.fixative],['alcohol',qty*recipe.alcohol]];
 for(const[key,n]of needs){const m=s.materials.find(x=>x.id===key);if(!m||m.stock+0.000001<n)throw Error('Existencias insuficientes: '+(m?.name||key));}
 for(const[key,n]of needs){const m=s.materials.find(x=>x.id===key);changeTotal(m,m.stock-n);}
 s.ready[id+'-'+size]=(s.ready[id+'-'+size]||0)+qty;
 s.movements.unshift({date:new Date().toISOString(),label:catalog.find(p=>p.id===id).name,detail:`Preparación · ${size} ml · Por envase: ${recipe.essence} ml esencia, ${recipe.fixative} ml galaxolide, ${recipe.alcohol} ml alcohol`,delta:qty,unit:'frascos'});return s;
}
export function readyMovement(state,{id,size,qty,type},catalog){if(!catalog.some(p=>p.id===id&&!p.discontinued)||![50,100].includes(size)||!Number.isInteger(qty)||qty<1||!['entry','delivery'].includes(type))throw Error('Revisa el perfume y la cantidad de frascos.');const s=cloneData(state),key=id+'-'+size,delta=type==='entry'?qty:-qty;if((s.ready[key]||0)+delta<0)throw Error('No hay suficientes perfumes listos.');s.ready[key]=(s.ready[key]||0)+delta;s.movements.unshift({date:new Date().toISOString(),label:catalog.find(p=>p.id===id).name,detail:(type==='entry'?'Ingreso de perfume ya preparado':'Entrega')+` · ${size} ml`,delta,unit:'frascos'});return s;}
export function removeReadyStock(state,{id,size,qty,reasonCode,reason='',expectedStock},catalog){
 if(!['test','other'].includes(reasonCode))throw Error('Selecciona el motivo para eliminar stock.');
 const explanation=resolveCancellationReason(reasonCode,reason),stock=state.ready[id+'-'+size]??0;
 if(expectedStock!==undefined&&expectedStock!==stock)throw Error('El stock cambió en otra sesión. Cierra y vuelve a abrir Eliminar stock.');
 const next=readyMovement(state,{id,size,qty,type:'delivery'},catalog);
 Object.assign(next.movements[0],{detail:`Eliminación de stock · ${size} ml · Motivo: ${explanation}`,reasonCode,reason:explanation});return next;
}
export function validateBackup(s,catalog){const registry=materialRegistry(s??{},catalog);catalog=catalogForState(catalog,s??{});const base=initialState(catalog);if(s?.printSupplyStock!==undefined)base.printSupplyStock=validatePrintStock(s.printSupplyStock);if(Object.keys(registry.prices).length)base.catalogPriceOverrides=registry.prices;if(registry.products.length)base.customProducts=registry.products;if(registry.bases.length){base.customBaseMaterials=registry.bases;base.materials.push(...registry.bases.map(m=>({...m,stock:0,min:0})));}if(registry.discontinued.length)base.discontinuedMaterialIds=registry.discontinued;for(const m of base.materials)if(registry.discontinued.includes(m.id))m.discontinued=true;if(s?.version!==1||!Array.isArray(s.materials)||s.materials.length!==base.materials.length||!Array.isArray(s.movements)||!s.ready||typeof s.ready!=='object'||Array.isArray(s.ready))throw Error('El archivo no es un respaldo válido de Alma Mía.');for(const m of base.materials){const found=s.materials.filter(x=>x.id===m.id);if(found.length!==1||!Number.isFinite(found[0].stock)||found[0].stock<0||!Number.isFinite(found[0].min)||found[0].min<0)throw Error('El respaldo contiene existencias inválidas.');m.stock=found[0].stock;m.min=found[0].min;if(found[0].secondBottle!==undefined){const b=found[0].secondBottle;if(!b||!Number.isFinite(b.capacity)||b.capacity<=0||!Number.isFinite(b.stock)||b.stock<0||b.stock>b.capacity||b.stock>m.stock)throw Error('Segundo frasco inválido en el respaldo.');m.secondBottle={capacity:b.capacity,stock:b.stock};}if(found[0].additionalBottles!==undefined){const extras=found[0].additionalBottles;if(!Array.isArray(extras)||new Set(extras.map(b=>b.number)).size!==extras.length||extras.some(b=>!b||!Number.isSafeInteger(b.number)||b.number<3||!Number.isFinite(b.capacity)||b.capacity<=0||!Number.isFinite(b.stock)||b.stock<0||b.stock>b.capacity))throw Error('Frascos adicionales inválidos.');m.additionalBottles=cloneData(extras);}if(extraBottles(m).reduce((n,b)=>n+b.stock,0)>m.stock+0.000001)throw Error('Los frascos superan el saldo total.');}for(const[key,n]of Object.entries(s.ready)){const p=key.match(/^(\d{2,3})-(50|100)$/);if(!p||!catalog.some(x=>x.id===p[1])||!Number.isSafeInteger(n)||n<0)throw Error('Stock de perfumes inválido.');}if(s.movements.some(m=>!m||typeof m.label!=='string'||typeof m.detail!=='string'||!Number.isFinite(m.delta)||!['ml','frascos','unidades'].includes(m.unit)||!Number.isFinite(Date.parse(m.date))))throw Error('Historial inválido.');const unitSettings=s.unitSettings??{quarterMl:null,gallonMl:null};for(const name of ['quarterMl','gallonMl']){const value=unitSettings[name];if(value!==null&&(!Number.isFinite(value)||value<=0))throw Error('Conversión de unidades inválida.');}validateCustomers(s.customers??[]);validateBatches(s.batches??[],catalog);return {...base,stripLibrary:validateStripLibrary(s.stripLibrary),salesNotes:validateSalesNotes(s.salesNotes??[]),batches:(s.batches??[]).map(b=>{const copy=cloneData(b);copy.items=copy.items.map(item=>{const p=catalog.find(p=>p.id===item.id);return {...item,name:p.name,reference:p.displayReference??p.reference};});if(copy.items.some(i=>i.completed===undefined)){copy.workflow='preaccounted';copy.items=copy.items.map(i=>i.completed===undefined?{...i,completed:0,preaccounted:i.qty}:i);delete copy.completedAt;}return copy;}),customers:cloneData(s.customers??[]),ready:s.ready,movements:s.movements,unitSettings:{quarterMl:unitSettings.quarterMl??62.5,gallonMl:unitSettings.gallonMl??4000}};}

// All items are applied to a copy; a failed row never partially saves a batch.
export function productionPreview(state,items,catalog,purpose={type:'stock'},batchId=randomId()){
 if(!Array.isArray(items)||!items.length)throw Error('Selecciona al menos un perfume.');
 if(!purpose||!['stock','customer','gift'].includes(purpose.type))throw Error('Selecciona el destino de la producción.');
 const customer=purpose.type!=='stock'&&purpose.customerId?(state.customers??[]).find(c=>c.id===purpose.customerId):null;
 if(purpose.type!=='stock'&&purpose.customerId&&!customer)throw Error('Selecciona un cliente registrado o registra uno nuevo.');
 if((state.batches??[]).some(b=>b.id===batchId))throw Error('Este lote ya fue confirmado.');
 const seen=new Set(),rows=items.map(item=>{const p=catalog.find(p=>p.id===item.id),key=item.id+'-'+item.size;if(!p||p.discontinued||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1||seen.has(key))throw Error('Revisa los perfumes, las presentaciones y las cantidades del lote.');seen.add(key);return {id:p.id,name:p.name,reference:p.displayReference??p.reference,category:p.category,line:p.line,size:item.size,qty:item.qty,completed:0};});
 const totals=rows.reduce((t,item)=>{const r=recipeFor(item.size);t.qty+=item.qty;t.volumeMl+=item.size*item.qty;t.essenceMl+=r.essence*item.qty;t.fixativeMl+=r.fixative*item.qty;t.alcoholMl+=r.alcohol*item.qty;return t;},{qty:0,volumeMl:0,essenceMl:0,fixativeMl:0,alcoholMl:0});
 return {id:batchId,number:Math.max(0,...(state.batches??[]).map(b=>b.number))+1,date:new Date().toISOString(),purpose:customer?{type:purpose.type,customerId:customer.id,customerName:customer.name}:{type:purpose.type},items:rows,totals};
}
export function produceBatch(state,items,catalog,purpose={type:'stock'},batchId){
 const batch=productionPreview(state,items,catalog,purpose,batchId);let next=cloneData(state);
 for(const item of batch.items){next=produce(next,item,catalog);item.completed=item.qty;const movement=next.movements[0];movement.production=cloneData(batch.purpose);movement.batchId=batch.id;movement.detail+=' · '+((batch.purpose.type==='customer'&&batch.purpose.customerName?'Pedido de '+batch.purpose.customerName:productionPurposeLabel(batch.purpose)))+' · Lote AM-'+String(batch.number).padStart(4,'0');}
 next.batches??=[];next.batches.unshift(batch);return next;
}
export function confirmProduction(state,preview,catalog){
 const batch=productionPreview(state,preview.items,catalog,preview.purpose,preview.id);batch.workflow='progress';batch.items=batch.items.map(item=>({...item,completed:0}));const next=cloneData(state);next.batches??=[];next.batches.unshift(batch);return next;
}
export function completedQuantity(item){return item.completed??0;}
export function batchProgress(batch){const completed=batch.items.reduce((n,item)=>n+completedQuantity(item),0),total=batch.items.reduce((n,item)=>n+item.qty,0);return {completed,total,pending:total-completed,cancelled:batch.status==='cancelled',ready:batch.status!=='cancelled'&&completed===total,label:batch.status==='cancelled'?'Cancelado':completed===total?(batch.purpose.type!=='stock'?'Listo para entrega':'Listo para anaquel'):'En producción'};}
export function completeBatchItem(state,{batchId,id,size,completed},catalog){
 const batch=(state.batches??[]).find(b=>b.id===batchId),item=batch?.items.find(i=>i.id===id&&i.size===size);if(!item)throw Error('No se encontró el perfume dentro del lote.');if(batch.status==='cancelled')throw Error('El lote o pedido está cancelado y no admite cambios de producción.');const previous=completedQuantity(item);
 if(!Number.isSafeInteger(completed)||completed<0||completed>item.qty)throw Error('Indica un total de envases hechos entre 0 y '+item.qty+'.');
 if(completed===previous)return cloneData(state);
 const accounted=item.preaccounted??(item.completed===undefined?item.qty:0),newUnits=Math.max(0,completed-accounted)-Math.max(0,previous-accounted),recipe=recipeFor(size),needs=[['ess-'+id,recipe.essence],['galaxolide',recipe.fixative],['alcohol',recipe.alcohol]],charges=cloneData(item.productionCharges??[]);
 let next;
 if(newUnits>0){next=produce(state,{id,size,qty:newUnits},catalog);const second={};for(const[key]of needs){const before=state.materials.find(m=>m.id===key),after=next.materials.find(m=>m.id===key);second[key]=Math.max(0,(before.secondBottle?.stock??0)-(after.secondBottle?.stock??0));}const others={};for(const[key]of needs){const before=state.materials.find(m=>m.id===key),after=next.materials.find(m=>m.id===key);others[key]={};for(const b of before.additionalBottles??[]){const used=Math.max(0,b.stock-bottleStock(after,b.number));if(used)others[key][b.number]=used;}}charges.push({qty:newUnits,second,others});}
 else if(newUnits<0){
  const undo=-newUnits,key=id+'-'+size;if((state.ready[key]??0)<undo)throw Error('No se puede reducir esa cantidad: no hay suficientes perfumes listos para retirar. Revisa las entregas registradas antes de corregir el lote.');
  next=cloneData(state);next.ready[key]-=undo;const restoreSecond={},restoreOther={};let remaining=undo;
  while(remaining>0&&charges.length){const block=charges.slice(-1)[0],take=Math.min(remaining,block.qty);for(const[materialId,perUnit]of needs){let volume=take*perUnit;for(const number of Object.keys(block.others?.[materialId]??{}).map(Number).sort((a,b)=>b-a)){const amount=Math.min(volume,block.others[materialId][number]);restoreOther[materialId]??={};restoreOther[materialId][number]=(restoreOther[materialId][number]??0)+amount;block.others[materialId][number]-=amount;volume-=amount;}const amount=Math.min(volume,block.second[materialId]??0);restoreSecond[materialId]=(restoreSecond[materialId]??0)+amount;block.second[materialId]=Math.max(0,(block.second[materialId]??0)-amount);}block.qty-=take;remaining-=take;if(!block.qty)charges.pop();}
  for(const[materialId,perUnit]of needs){const m=next.materials.find(m=>m.id===materialId);m.stock=Math.round((m.stock+undo*perUnit)*1000)/1000;for(const[number,amount]of Object.entries(restoreOther[materialId]??{})){const ref=bottleRef(m,Number(number));if(ref)ref.stock=Math.round((ref.stock+Math.min(amount,ref.capacity-ref.stock))*1000)/1000;}if(m.secondBottle){const restore=Math.min(restoreSecond[materialId]??0,m.secondBottle.capacity-m.secondBottle.stock);m.secondBottle.stock=Math.round((m.secondBottle.stock+restore)*1000)/1000;}}
  next.movements.unshift({date:new Date().toISOString(),label:item.name,detail:`Corrección de producción · ${size} ml · ${undo} envases retirados de perfumes listos; insumos restituidos`,delta:-undo,unit:'frascos'});
 }else{next=cloneData(state);next.movements.unshift({date:new Date().toISOString(),label:item.name,detail:'Avance corregido; insumos y perfumes contabilizados en la versión anterior sin cambios',delta:completed-previous,unit:'frascos'});}
 const saved=next.batches.find(b=>b.id===batchId),row=saved.items.find(i=>i.id===id&&i.size===size),now=new Date().toISOString();row.completed=completed;row.productionCharges=charges;if(accounted)row.preaccounted=accounted;saved.updatedAt=now;if(batchProgress(saved).ready)saved.completedAt=now;else{delete saved.completedAt;delete saved.completedBy;}
 const movement=next.movements[0];movement.production=cloneData(batch.purpose);movement.batchId=batchId;movement.detail+=' · '+((batch.purpose.type==='customer'&&batch.purpose.customerName?'Pedido de '+batch.purpose.customerName:productionPurposeLabel(batch.purpose)))+' · Lote AM-'+String(batch.number).padStart(4,'0');return next;
}
// Complete the planned work and classify extra units as one atomic inventory change.
export function completeBatchWithExtras(state,{batchId,id,size,completed,extras=[],expectedBatch,expectedNote,actor},catalog){
 const batch=(state.batches??[]).find(b=>b.id===batchId);
 if(!batch||batch.status==='cancelled')throw Error('El lote o pedido ya no está vigente.');
 if(expectedBatch&&JSON.stringify(batch)!==JSON.stringify(expectedBatch))throw Error('El lote cambió en otra sesión. Revisa su avance antes de guardar.');
 if(!Array.isArray(extras))throw Error('Revisa los perfumes adicionales.');
 const groups={order:[],stock:[]};
 for(const item of extras){if(!item||!['order','stock'].includes(item.destination)||!catalog.some(p=>p.id===item.id)||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1)throw Error('Elige perfume, presentación, cantidad y destino para cada extra.');const rows=groups[item.destination],row=rows.find(r=>r.id===item.id&&r.size===item.size);if(row){row.qty+=item.qty;if(!Number.isSafeInteger(row.qty))throw Error('Cantidad adicional inválida.');}else rows.push({id:item.id,size:item.size,qty:item.qty});}
 const note=activeSalesNoteForBatch(state,batchId);
 if(expectedNote!==undefined&&JSON.stringify(note??null)!==JSON.stringify(expectedNote))throw Error('La nota del pedido cambió. Vuelve a abrir el lote antes de guardar.');
 if(groups.order.length&&note?.stockDelivery)throw Error('La nota ya tiene entrega registrada. Envía los extras a stock o registra un pedido separado para conservar esa entrega.');
 let next=completeBatchItem(state,{batchId,id,size,completed},catalog);
 if(groups.order.length){
  const saved=next.batches.find(b=>b.id===batchId);
  for(const extra of groups.order){let row=saved.items.find(i=>i.id===extra.id&&i.size===extra.size);if(row)row.qty+=extra.qty;else{const p=catalog.find(p=>p.id===extra.id);row={...extra,name:p.name,reference:p.displayReference??p.reference,category:p.category,line:p.line,completed:0};saved.items.push(row);}
   const r=recipeFor(extra.size);saved.totals.qty+=extra.qty;saved.totals.volumeMl+=extra.size*extra.qty;saved.totals.essenceMl+=r.essence*extra.qty;saved.totals.fixativeMl+=r.fixative*extra.qty;saved.totals.alcoholMl+=r.alcohol*extra.qty;
  }
  for(const extra of groups.order){const row=next.batches.find(b=>b.id===batchId).items.find(i=>i.id===extra.id&&i.size===extra.size);next=completeBatchItem(next,{batchId,id:extra.id,size:extra.size,completed:completedQuantity(row)+extra.qty},catalog);}
  if(note){const items=note.items.map(item=>({...item,price:item.unitCents/100}));for(const extra of groups.order){const p=catalog.find(p=>p.id===extra.id),row=items.find(i=>i.productId===extra.id&&Number(i.size)===extra.size);if(row)row.qty+=extra.qty;else items.push({productId:p.id,name:p.name,reference:p.displayReference??p.reference,category:salesCategory(p),size:extra.size,qty:extra.qty,price:p['price'+extra.size]});}
   const candidate=buildSalesNote({...note,discountEnabled:note.discountPercent!==0,items},note);candidate.payments=cloneData(note.payments??[]);next=editSalesNote(next,candidate,{actor,expectedRevision:note.revision??0,catalog});
  }
 }
 if(groups.stock.length){const preview=productionPreview(next,groups.stock,catalog,{type:'stock'});next=confirmProduction(next,preview,catalog);const separate=next.batches.find(b=>b.id===preview.id);separate.parentBatchId=batchId;const source=next.batches.find(b=>b.id===batchId);source.extraStockBatchIds=[...(source.extraStockBatchIds??[]),preview.id];source.updatedAt=new Date().toISOString();for(const extra of groups.stock)next=completeBatchItem(next,{batchId:preview.id,id:extra.id,size:extra.size,completed:extra.qty},catalog);}
 validateBatches(next.batches,catalog);return next;
}
function validateBatches(batches,catalog){
 if(!Array.isArray(batches))throw Error('Lista de lotes inválida.');const ids=new Set(),numbers=new Set();
 for(const b of batches){if(!b||typeof b.id!=='string'||!b.id||ids.has(b.id)||!Number.isSafeInteger(b.number)||b.number<1||numbers.has(b.number)||!Number.isFinite(Date.parse(b.date))||!b.purpose||!['stock','customer','gift'].includes(b.purpose.type)||!Array.isArray(b.items)||!b.items.length)throw Error('Lote inválido en el respaldo.');if(b.status!==undefined&&!['active','cancelled'].includes(b.status))throw Error('Estado de lote inválido.');if(b.status==='cancelled'&&(!Number.isFinite(Date.parse(b.cancelledAt))||!['Luis','Ximena'].includes(b.cancelledBy)||typeof b.cancellationReason!=='string'||b.cancellationReason.trim().length<3||b.cancellationReason.length>240))throw Error('Datos de cancelación del lote inválidos.');if(b.parentBatchId!==undefined&&(typeof b.parentBatchId!=='string'||!b.parentBatchId||b.parentBatchId===b.id))throw Error('Origen del lote adicional inválido.');if(b.extraStockBatchIds!==undefined&&(!Array.isArray(b.extraStockBatchIds)||new Set(b.extraStockBatchIds).size!==b.extraStockBatchIds.length||b.extraStockBatchIds.some(id=>typeof id!=='string'||!id||id===b.id)))throw Error('Lotes adicionales de stock inválidos.');ids.add(b.id);numbers.add(b.number);if(b.purpose.type!=='stock'&&(b.purpose.customerId!==undefined||b.purpose.customerName!==undefined)&&(typeof b.purpose.customerId!=='string'||!b.purpose.customerId.trim()||typeof b.purpose.customerName!=='string'||!b.purpose.customerName.trim()))throw Error('Cliente del lote inválido.');const seen=new Set(),totals={qty:0,volumeMl:0,essenceMl:0,fixativeMl:0,alcoholMl:0};for(const item of b.items){const key=item.id+'-'+item.size;if(!catalog.some(p=>p.id===item.id)||!['name','reference','category','line'].every(k=>typeof item[k]==='string')||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1||seen.has(key))throw Error('Detalle de lote inválido.');seen.add(key);const r=recipeFor(item.size);totals.qty+=item.qty;totals.volumeMl+=item.qty*item.size;totals.essenceMl+=item.qty*r.essence;totals.fixativeMl+=item.qty*r.fixative;totals.alcoholMl+=item.qty*r.alcohol;}for(const item of b.items)for(const block of item.productionCharges??[])if(block.others!==undefined){if(!block.others||typeof block.others!=='object'||Object.entries(block.others).some(([id,bottles])=>!['ess-'+item.id,'alcohol','galaxolide'].includes(id)||!bottles||typeof bottles!=='object'||Object.entries(bottles).some(([number,amount])=>!Number.isSafeInteger(Number(number))||Number(number)<3||!Number.isFinite(amount)||amount<0)))throw Error('Consumo de frascos adicionales inválido.');}for(const item of b.items)if(item.productionCharges!==undefined){if(!Array.isArray(item.productionCharges)||item.productionCharges.some(c=>!c||!Number.isSafeInteger(c.qty)||c.qty<1||!c.second||typeof c.second!=='object'||Object.entries(c.second).some(([key,value])=>!['ess-'+item.id,'alcohol','galaxolide'].includes(key)||!Number.isFinite(value)||value<0)))throw Error('Detalle de consumo inválido.');}if(b.items.some(i=>i.preaccounted!==undefined&&(!Number.isSafeInteger(i.preaccounted)||i.preaccounted<0||i.preaccounted>i.qty)))throw Error('Contabilización anterior inválida.');if(b.items.some(i=>i.completed!==undefined&&(!Number.isSafeInteger(i.completed)||i.completed<0||i.completed>i.qty))||(b.workflow==='progress'&&b.items.some(i=>i.completed===undefined)))throw Error('Avance de producción inválido.');for(const key of ['updatedAt','completedAt'])if(b[key]!==undefined&&!Number.isFinite(Date.parse(b[key])))throw Error('Fecha de avance inválida.');if(!b.totals||Object.keys(totals).some(k=>b.totals[k]!==totals[k]))throw Error('Totales del lote inválidos.');}
}
export function setMaterialStock(state,{id,amount,factor=1,unit='ml'}){
 if(!Number.isFinite(amount)||amount<0||!Number.isFinite(factor)||factor<=0||!Number.isFinite(amount*factor))throw Error('Introduce una cantidad válida.');
 const next=cloneData(state),m=next.materials.find(m=>m.id===id);if(!m)throw Error('Materia prima no encontrada.');if(m.discontinued)throw Error('Esta materia prima está descontinuada.');
 const previous=m.stock;changeTotal(m,amount*factor);
 next.movements.unshift({date:new Date().toISOString(),label:m.name,detail:`Actualización de existencias: ${amount} ${unit} (antes ${previous} ml)`,delta:Math.round((m.stock-previous)*1000)/1000,unit:'ml'});
 return next;
}

export function readyBatch(state,items,catalog){
 if(!Array.isArray(items)||!items.length)throw Error('Selecciona al menos un perfume.');
 let next=cloneData(state);const seen=new Set();
 for(const item of items){const key=item.id+'-'+item.size;if(seen.has(key))throw Error('Una presentación está repetida.');seen.add(key);next=readyMovement(next,{...item,type:'entry'},catalog);}
 return next;
}

function changeTotal(material,total){
 let remaining=Math.max(0,material.stock-total-bottleStock(material,1));
 for(const bottle of extraBottles(material)){const ref=bottleRef(material,bottle.number),used=Math.min(remaining,ref.stock);ref.stock=Math.round((ref.stock-used)*1000)/1000;remaining-=used;}
 material.stock=Math.round(total*1000)/1000;
}
export function setNumberedBottle(state,{id,number,stock,capacity}){
 if(!Number.isSafeInteger(number)||number<1||!Number.isFinite(stock)||stock<0||!Number.isFinite(capacity)||capacity<=0||(number>1&&stock>capacity))throw Error('Revisa el número, capacidad y existencias del frasco.');
 const next=cloneData(state),m=next.materials.find(m=>m.id===id);if(!m)throw Error('Materia prima no encontrada.');if(m.discontinued)throw Error('Esta materia prima está descontinuada.');const before=bottleStock(m,number),previous=m.stock;
 if(number===2)m.secondBottle={capacity,stock};else if(number>2){m.additionalBottles??=[];const old=m.additionalBottles.find(b=>b.number===number);if(old)Object.assign(old,{capacity,stock});else m.additionalBottles.push({number,capacity,stock});}
 m.stock=Math.round((previous-before+stock)*1000)/1000;next.movements.unshift({date:new Date().toISOString(),label:m.name,detail:`Actualización: frasco ${number}, ${stock} ml de ${capacity} ml`,delta:Math.round((stock-before)*1000)/1000,unit:'ml'});return next;
}
export function setBottleStocks(state,{id,firstStock,secondBottle=null}){
 if(!Number.isFinite(firstStock)||firstStock<0)throw Error('Revisa cuánto queda en el primer frasco.');
 if(secondBottle&&(!Number.isFinite(secondBottle.capacity)||secondBottle.capacity<=0||!Number.isFinite(secondBottle.stock)||secondBottle.stock<0||secondBottle.stock>secondBottle.capacity))throw Error('El segundo frasco necesita una capacidad válida y existencias entre cero y su capacidad.');
 const next=cloneData(state),m=next.materials.find(x=>x.id===id);if(!m)throw Error('Materia prima no encontrada.');if(m.discontinued)throw Error('Esta materia prima está descontinuada.');const previous=m.stock;
 m.stock=Math.round((firstStock+(secondBottle?.stock||0)+(m.additionalBottles??[]).reduce((n,b)=>n+b.stock,0))*1000)/1000;if(secondBottle)m.secondBottle={capacity:secondBottle.capacity,stock:Math.round(secondBottle.stock*1000)/1000};else delete m.secondBottle;
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
 const next=cloneData(state);next.customers??=[];next.customers.push({id:randomId(),name:clean,phone:contact});return next;
}

export function attributeSessionChanges(previous,next,actor){
 if(!['Luis','Ximena'].includes(actor))throw Error('Selecciona Luis o Ximena en “¿Quién está en esta sesión?” antes de guardar.');
 const result=cloneData(next),added=result.movements.length-previous.movements.length;
 if(added<0)throw Error('No se puede atribuir una sustitución del historial como un movimiento nuevo.');
 for(const movement of result.movements.slice(0,added))movement.performedBy=actor;
 for(const batch of result.batches??[]){const old=(previous.batches??[]).find(b=>b.id===batch.id);if(!old){batch.createdBy=actor;continue;}const changed=batch.items.filter(item=>{const before=old.items.find(i=>i.id===item.id&&i.size===item.size);return !before||completedQuantity(before)!==completedQuantity(item);});if(changed.length||JSON.stringify(batch.extraStockBatchIds??[])!==JSON.stringify(old.extraStockBatchIds??[])){batch.updatedBy=actor;for(const item of changed)item.completedBy=actor;if(batchProgress(batch).ready)batch.completedBy=actor;}}
 for(const customer of result.customers??[])if(!(previous.customers??[]).some(c=>c.id===customer.id))customer.createdBy=actor;
 return result;
}

export function cancelBatch(state,{batchId,reason,reasonCode='other',actor,expectedBatch,at=new Date().toISOString()},catalog=[]){
 if(!['Luis','Ximena'].includes(actor))throw Error('Selecciona el usuario antes de cancelar.');
 const batch=(state.batches??[]).find(b=>b.id===batchId);if(!batch)throw Error('No se encontró el lote o pedido.');if(batch.status==='cancelled')throw Error('El lote o pedido ya está cancelado.');
 if(expectedBatch&&JSON.stringify(batch)!==JSON.stringify(expectedBatch))throw Error('La producción cambió en otra sesión. Revisa su avance antes de cancelar.');
 reason=resolveCancellationReason(reasonCode,reason);
 let next=cloneData(state),reversed=0;
 if(reasonCode==='test'){
  if(batch.items.some(item=>item.completed===undefined||(item.preaccounted??0)>0))throw Error('Este lote tiene producción de una versión anterior y no puede revertirse automáticamente. Revisa sus movimientos antes de cancelarlo como prueba.');
  for(const item of batch.items){const qty=completedQuantity(item);if(!qty)continue;if((item.productionCharges??[]).reduce((n,c)=>n+c.qty,0)!==qty)throw Error('No se encontró el consumo completo de este lote para devolverlo con seguridad. Revisa sus movimientos.');next=completeBatchItem(next,{batchId,id:item.id,size:item.size,completed:0},catalog);reversed+=qty;}
 }
 const saved=next.batches.find(b=>b.id===batchId);if(reasonCode==='test')saved.cancellationReversedUnits=reversed;saved.status='cancelled';saved.cancelledAt=at;saved.cancelledBy=actor;saved.cancellationReason=reason.trim();saved.cancellationCode=reasonCode;
 next.movements.unshift({date:at,label:'AM-'+String(batch.number).padStart(4,'0'),detail:`Cancelación de ${batch.purpose.type==='customer'?'pedido':'lote'} · ${saved.cancellationReason} · ${reasonCode==='test'?`Prueba revertida: ${reversed} envases retirados del stock; insumos restituidos`:'Avances e inventario conservados'}`,delta:0,unit:'frascos',batchId,performedBy:actor});return next;
}

export function productionPurposeLabel(purpose){return purpose.type==='stock'?'Producción para stock':(purpose.type==='gift'?'Obsequio':'Pedido')+(purpose.customerName?' · '+purpose.customerName:'');}
