import {isMaterialLow,extraBottles,bottleStock} from './inventory.js?v=92';
export async function createMaterialsPdf(state,catalog,{now=new Date()}={}){
 const {jsPDF,autoTable}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:'a4'}),margin=16,zone='America/Guatemala';
 const number=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
 const date=new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'long',timeStyle:'short'}).format(now);
 doc.setProperties({title:'Reporte de reposición · Alma Mía',author:'Alma Mía Perfumes'});
 doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(65,43,27);doc.text('Alma Mía',margin,22);
 doc.setFontSize(14);doc.text('Reporte de materias primas',margin,32);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(80);doc.text(date+' (Guatemala)',margin,40);
 const missing=state.materials.filter(m=>!m.discontinued&&m.stock===0),low=state.materials.filter(m=>!m.discontinued&&isMaterialLow(m)).sort((a,b)=>a.stock-b.stock);
 doc.text(`Faltantes: ${missing.length}   |   Por terminar: ${low.length}`,margin,48);
 let y=59;
 const name=m=>{const p=m.kind==='Esencia'?catalog.find(p=>p.id===m.id.slice(4)):null;return m.name+(p?'\nInspirado en '+(p.displayReference??p.reference):'');};
 const amount=m=>{if(m.stock===0)return '0 ml';if(m.id==='alcohol')return `${number(m.stock/(state.unitSettings?.gallonMl||4000))} galones\n${number(m.stock)} ml`;if(m.kind!=='Esencia')return number(m.stock)+' ml';const bottles=[{number:1,stock:bottleStock(m,1),capacity:250},...extraBottles(m)].filter(b=>b.stock>0);return `${number(m.stock)} ml en total\n`+bottles.map(b=>`Frasco ${b.number}: ${number(b.stock)} ml (${number(b.stock/b.capacity*4)}/4)`).join('\n');};
 for(const [title,items,empty] of [['Insumos faltantes',missing,'No hay insumos faltantes.'],['Insumos por terminar',low,'No hay insumos por terminar.']]){
  if(y>250){doc.addPage();y=22;}
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(40);doc.text(title,margin,y);
  if(items.length){autoTable(doc,{startY:y+5,head:[['Insumo','Existencias']],body:items.map(m=>[name(m),amount(m)]),theme:'striped',margin:{left:margin,right:margin,top:18,bottom:18},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:40},headStyles:{fillColor:[239,234,225],textColor:50},columnStyles:{0:{cellWidth:112},1:{cellWidth:66}},rowPageBreak:'avoid'});y=doc.lastAutoTable.finalY+14;}
  else{doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(empty,margin,y+9);y+=24;}
 }
 const count=doc.getNumberOfPages();for(let page=1;page<=count;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Alma Mía · Reporte de reposición',margin,287);doc.text(`${page} / ${count}`,194,287,{align:'right'});}
 const filenameDate=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return {blob:doc.output('blob'),filename:`Alma-Mia-Reporte-Materias-Primas-${filenameDate}.pdf`};
}

export async function downloadMaterialsPdf(state,catalog){
 const {blob,filename}=await createMaterialsPdf(state,catalog),url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=filename;anchor.hidden=true;document.body.append(anchor);
 try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

// Supplier-facing names come from catalog references, never internal aliases.
export function materialsQuoteEssences(state,catalog,{selectedIds}={}){
 const essences=state.materials.filter(m=>m.kind==='Esencia'&&!m.discontinued&&!catalog.find(p=>p.id===m.id.slice(4))?.discontinued);
 if(selectedIds!==undefined&&(!Array.isArray(selectedIds)||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>typeof id!=='string'||!essences.some(m=>m.id===id))))throw Error('La selección de esencias no es válida. Elige esencias del catálogo sin repetirlas.');
 const selected=selectedIds===undefined?essences.filter(m=>m.stock===0||isMaterialLow(m)):essences.filter(m=>selectedIds.includes(m.id));
 return selected.map(material=>{
  const product=catalog.find(p=>p.id===material.id.slice(4));
  if(!product?.brand?.trim()||!product.reference?.trim())throw Error('Falta el nombre real o la casa productora de la esencia '+material.id+'.');
  const house=product.brand.trim(),guide=String(product.guideReference??''),prefix=house+' / ';
  const name=(guide.startsWith(prefix)?guide.slice(prefix.length):product.reference).trim();
  if(!name)throw Error('Falta el nombre real de la esencia '+material.id+'.');
  if(!['Dama','Caballero','Unisex'].includes(product.category))throw Error('Falta la categoría Dama, Caballero o Unisex de la esencia '+material.id+'.');
  return {id:material.id,name,house,category:product.category,quantityMl:250};
 }).sort((a,b)=>a.house.localeCompare(b.house,'es')||a.name.localeCompare(b.name,'es'));
}
export function materialsQuotation(state,catalog,{quantities={},includeAlcohol=false,alcoholMl=4000,selectedIds}={}){
 if(typeof includeAlcohol!=='boolean')throw Error('Indica si deseas incluir alcohol.');
 const quantity=(value,label)=>{const ml=Number(value);if(!Number.isSafeInteger(ml)||ml<250||ml>1000000)throw Error(label+': indica una cantidad entera de 250 a 1,000,000 ml.');return ml;};
 const items=materialsQuoteEssences(state,catalog,{selectedIds}).map(item=>({...item,quantityMl:quantity(quantities[item.id]??250,item.name)}));
 if(includeAlcohol)items.push({id:'alcohol',name:'Alcohol',house:'',quantityMl:quantity(alcoholMl,'Alcohol')});
 if(!items.length)throw Error('No hay esencias seleccionadas. Agrega una esencia del catálogo o incluye alcohol para solicitar su cotización.');
 return {items,totalMl:items.reduce((sum,item)=>sum+item.quantityMl,0)};
}
export async function createMaterialsQuotationPdf(state,catalog,{now=new Date(),...options}={}){
 const data=materialsQuotation(state,catalog,options),{jsPDF,autoTable}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:'a4'}),margin=16,zone='America/Guatemala';
 const number=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:0}).format(n);
 const date=new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'long'}).format(now);
 doc.setProperties({title:'Solicitud de cotización de esencias',subject:'Nombres reales, casas productoras, categorías y cantidades solicitadas'});
 doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('Solicitud de cotización',margin,24);
 doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(date+' · Guatemala',margin,33);
 doc.text('Solicito precio y disponibilidad de los siguientes insumos:',margin,44);
 autoTable(doc,{startY:51,head:[['Nombre real / referencia','Casa productora','Categoría','Cantidad solicitada']],body:data.items.map(item=>[item.name,item.house||'—',item.category||'—',number(item.quantityMl)+' ml']),theme:'striped',margin:{left:margin,right:margin,top:20,bottom:23},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:35},headStyles:{fillColor:[235,238,237],textColor:35},columnStyles:{0:{cellWidth:65},1:{cellWidth:46},2:{cellWidth:29},3:{cellWidth:38,halign:'right'}},rowPageBreak:'avoid'});
 const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Solicitud de cotización',margin,287);doc.text(`${page} / ${pages}`,194,287,{align:'right'});
 }
 const filenameDate=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return {blob:doc.output('blob'),filename:`Solicitud-Cotizacion-Esencias-${filenameDate}.pdf`,data,pages};
}

export async function createEssenceDirectoryPdf(state,catalog,{now=new Date()}={}){
 const {essenceDirectory}=await import('./material-registry.js?v=92');
 const items=essenceDirectory(state,catalog),{jsPDF,autoTable}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:'a4'}),margin=16;
 doc.setProperties({title:'Lista de esencias · Alma Mía',subject:'Esencias activas y descontinuadas',author:'Alma Mía'});
 doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('Alma Mía · Lista de esencias',margin,24);
 doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(new Intl.DateTimeFormat('es-MX',{timeZone:'America/Guatemala',dateStyle:'long'}).format(now),margin,33);
 let y=46;
 for(const [title,retired] of [['Esencias activas',false],['Descontinuadas',true]]){
  const rows=items.filter(item=>item.discontinued===retired);
  if(y>245){doc.addPage();y=24;}
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(title,margin,y);
  if(!rows.length){doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('No hay esencias en esta sección.',margin,y+10);y+=25;continue;}
  autoTable(doc,{startY:y+5,head:[['Nombre comercial','Perfume original / casa productora','Categoría']],body:rows.map(item=>[item.name,[item.reference,item.brand].filter(Boolean).join(' — '),item.category]),theme:'striped',margin:{left:margin,right:margin,top:20,bottom:20},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:35},headStyles:{fillColor:[231,233,242],textColor:35},columnStyles:{0:{cellWidth:58},1:{cellWidth:94},2:{cellWidth:26}},rowPageBreak:'avoid'});
  y=doc.lastAutoTable.finalY+16;
 }
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Alma Mía · Lista de esencias',margin,287);doc.text(`${i} / ${pages}`,194,287,{align:'right'});}
 return {blob:doc.output('blob'),filename:'Alma-Mia-Lista-Esencias.pdf'};
}
