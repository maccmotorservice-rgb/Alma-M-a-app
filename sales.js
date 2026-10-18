export const salesCategories=['Perfumes unisex - Nicho','Perfumes de dama - Nicho','Perfumes de caballero - Nicho','Perfumes de dama - Diseñador','Perfumes de caballero - Diseñador','Perfumes unisex - Diseñador','Material promocional'];
export const salesCategory=p=>`Perfumes ${p.category==='Dama'?'de dama':p.category==='Caballero'?'de caballero':'unisex'} - ${p.line}`;
export const salesMoney=cents=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export function salesTotals(items,discountPercent=0){
 if(!Number.isFinite(discountPercent)||discountPercent<0||discountPercent>30)throw Error('El descuento debe estar entre 0 % y 30 %.');
 if(!Array.isArray(items)||!items.length)throw Error('Agrega al menos un concepto a la nota.');
 let subtotalCents=0,pieces=0;for(const item of items){if(!Number.isSafeInteger(item.qty)||item.qty<1||!Number.isSafeInteger(item.unitCents)||item.unitCents<0||!Number.isSafeInteger(item.qty*item.unitCents))throw Error('Revisa las cantidades y precios de los conceptos.');subtotalCents+=item.qty*item.unitCents;pieces+=item.qty;}
 if(!Number.isSafeInteger(subtotalCents)||!Number.isSafeInteger(pieces))throw Error('El importe o la cantidad excede el límite permitido.');
 const discountCents=Math.round(subtotalCents*discountPercent/100);return {pieces,subtotalCents,discountCents,totalCents:subtotalCents-discountCents};
}
export function buildSalesNote(draft,{id=crypto.randomUUID(),createdAt=new Date().toISOString(),createdBy}={}){
 const customer=String(draft.customer??'').trim(),date=String(draft.date??'');if(!customer||customer.length>120)throw Error('Indica el nombre del cliente (máximo 120 caracteres).');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Indica una fecha válida.');
 const items=(draft.items??[]).map(i=>({name:String(i.name??'').trim(),reference:String(i.reference??'').trim(),category:String(i.category??''),size:i.size===''||i.size===null?null:Number(i.size),qty:Number(i.qty),unitCents:Math.round(Number(i.price)*100)}));
 if(items.some(i=>!i.name||i.name.length>160||i.reference.length>240||!salesCategories.includes(i.category)||![null,50,100].includes(i.size)))throw Error('Revisa el nombre, categoría y presentación de cada concepto.');
 if((draft.items??[]).some(i=>String(i.price).trim()===''||!Number.isFinite(Number(i.price))||Number(i.price)<0||String(i.qty).trim()===''))throw Error('Indica un precio y una cantidad válidos. El precio puede ser cero.');
 const discountPercent=draft.discountEnabled?Number(draft.discountPercent):0,totals=salesTotals(items,discountPercent);
 if(!['Luis','Ximena'].includes(createdBy))throw Error('Inicia sesión o selecciona el usuario antes de guardar la nota.');
 return {id,customer,date,items,discountPercent,totals,createdAt,createdBy};
}
export function validateSalesNotes(notes){
 if(!Array.isArray(notes)||new Set(notes.map(n=>n?.id)).size!==notes.length)throw Error('Notas de venta inválidas en el respaldo.');
 for(const n of notes){if(!n||typeof n.id!=='string'||!n.id||!Number.isFinite(Date.parse(n.createdAt))||!Array.isArray(n.items))throw Error('Nota de venta inválida.');const checked=buildSalesNote({...n,discountEnabled:n.discountPercent!==0,items:n.items.map(i=>({...i,price:i.unitCents/100}))},n);if(!n.totals||Object.keys(checked.totals).some(key=>checked.totals[key]!==n.totals[key]))throw Error('Los importes de la nota de venta no coinciden.');if(!['active','cancelled'].includes(n.status??'active')||(n.revision!==undefined&&(!Number.isSafeInteger(n.revision)||n.revision<0)))throw Error('Estado de nota inválido.');for(const prefix of ['updated','cancelled'])if(n[prefix+'At']!==undefined&&(!Number.isFinite(Date.parse(n[prefix+'At']))||!['Luis','Ximena'].includes(n[prefix+'By'])))throw Error('Datos de seguimiento de nota inválidos.');if(n.status==='cancelled'&&(!n.cancelledAt||!n.cancelledBy))throw Error('Falta información de la cancelación.');if(n.cancellationReason!==undefined&&(typeof n.cancellationReason!=='string'||n.cancellationReason.length>240))throw Error('Motivo de cancelación inválido.');if(n.events!==undefined&&(!Array.isArray(n.events)||n.events.some(e=>!e||!['edited','cancelled'].includes(e.type)||!Number.isFinite(Date.parse(e.at))||!['Luis','Ximena'].includes(e.by))))throw Error('Historial de nota inválido.');}
 return structuredClone(notes);
}
export function salesGroups(note){return salesCategories.map(category=>({category,items:note.items.filter(i=>i.category===category)})).filter(g=>g.items.length).map(g=>({...g,pieces:g.items.reduce((s,i)=>s+i.qty,0),subtotalCents:g.items.reduce((s,i)=>s+i.qty*i.unitCents,0)}));}
export function salesDate(date){return new Date(date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});}
export function salesCapacity(note){const sizes=[...new Set(note.items.filter(i=>i.size).map(i=>i.size))].sort((a,b)=>a-b);return sizes.length?sizes.map(s=>s+' ml').join(' / '):'—';}
export function salesFilename(note){return `${note.status==='cancelled'?'CANCELADA-':''}Alma-Mia-${note.customer.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,60)}-${note.date}-${note.id.slice(0,8)}.pdf`;}
export const salesNoteStatus=note=>note.status??'active';
function salesActor(actor){if(!['Luis','Ximena'].includes(actor))throw Error('Inicia sesión o selecciona el usuario antes de modificar la nota.');}
function existingSalesNote(state,id,expectedRevision){const note=(state.salesNotes??[]).find(n=>n.id===id);if(!note)throw Error('No se encontró la nota de venta.');if(salesNoteStatus(note)==='cancelled')throw Error('La nota está cancelada y no puede modificarse.');if((note.revision??0)!==expectedRevision)throw Error('La nota cambió en otra sesión. Ábrela de nuevo antes de editar o cancelar.');return note;}
export function editSalesNote(state,candidate,{actor,expectedRevision,at=new Date().toISOString()}){
 salesActor(actor);const original=existingSalesNote(state,candidate.id,expectedRevision);validateSalesNotes([candidate]);const note={...candidate,id:original.id,createdAt:original.createdAt,createdBy:original.createdBy,status:'active',revision:(original.revision??0)+1,updatedAt:at,updatedBy:actor,events:[...(original.events??[]),{type:'edited',at,by:actor}]};return {...state,salesNotes:state.salesNotes.map(n=>n.id===note.id?note:n)};
}
export function cancelSalesNote(state,id,{actor,expectedRevision,reason='',at=new Date().toISOString()}){
 salesActor(actor);const original=existingSalesNote(state,id,expectedRevision);if(typeof reason!=='string'||reason.trim().length>240)throw Error('El motivo de cancelación debe tener un máximo de 240 caracteres.');const note={...original,status:'cancelled',revision:(original.revision??0)+1,cancelledAt:at,cancelledBy:actor,cancellationReason:reason.trim(),events:[...(original.events??[]),{type:'cancelled',at,by:actor}]};return {...state,salesNotes:state.salesNotes.map(n=>n.id===id?note:n)};
}
