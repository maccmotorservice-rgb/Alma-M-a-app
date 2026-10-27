import {isMaterialLow,completedQuantity,recipeFor} from './inventory.js?v=87';
import {resolveSalesProduct} from './sales-analytics.js?v=87';
export const quoteStatuses={missing:{label:'Agotada',color:'#dc2626'},low:{label:'Por agotarse',color:'#ea580c'},available:{label:'Con existencias',color:'#b28b00'},outside:{label:'Fuera del catálogo',color:'#9333ea'}};
export const normalizeQuoteName=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function quoteMoneyCents(value){
 const text=String(value??'').trim().replace(/^(?:MXN|USD|GTQ|Q|\$)\s*/i,'').replace(/\s*(?:MXN|USD|GTQ)$/i,'').trim();
 if(!text)return null;
 let normalized=text;
 if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text))normalized=text.replace(/,/g,'');
 else if(/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text))normalized=text.replace(/\./g,'').replace(',','.');
 else if(/^\d+,\d{1,2}$/.test(text))normalized=text.replace(',','.');
 else if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('Revisa el importe: usa hasta dos decimales, por ejemplo 1250.00.');
 const cents=Math.round(Number(normalized)*100);if(!Number.isSafeInteger(cents)||cents<0)throw Error('Importe inválido.');return cents;
}
export function matchQuoteProduct(description,catalog){
 const text=normalizeQuoteName(description),padded=' '+text+' ';
 const ranked=catalog.map(p=>{const references=[p.reference,p.displayReference,p.guideReference,p.guideReference?.split(' / ').slice(1).join(' / '),p.name].filter(Boolean).map(normalizeQuoteName);const matching=references.filter(ref=>ref&&(ref===text||(ref.length>=5&&padded.includes(' '+ref+' '))));return {id:p.id,score:Math.max(0,...matching.map(ref=>ref.length))};}).filter(p=>p.score).sort((a,b)=>b.score-a.score);
 if(!ranked.length)return {productId:'',candidates:[]};
 const best=ranked.filter(p=>p.score===ranked[0].score);return {productId:best.length===1?best[0].id:'',candidates:ranked.slice(0,5).map(p=>p.id)};
}
export function quoteDocumentMetadata(lines){
 const joined=lines.map(l=>l.text).join('\n'),currencies=[...new Set(joined.match(/\b(?:MXN|USD|GTQ)\b/g)??[])];
 const metadata={currency:currencies.length===1?currencies[0]:'',provider:/euroclich[eé]/i.test(joined)?'Eurocliché':'',taxPercent:'0',officialTotal:'',itemCount:null};
 const header=lines.findIndex(l=>/Art[ií]culos/i.test(l.text)&&/Subtotal/i.test(l.text)&&/IVA/i.test(l.text));
 if(header>=0){const summary=lines.slice(header+1,header+4).find(l=>(l.text.match(/\$\s*[\d,.]+/g)??[]).length>=3);if(summary){const amounts=summary.text.match(/\$\s*[\d,.]+/g).map(quoteMoneyCents),subtotal=amounts[amounts.length-3],tax=amounts[amounts.length-2],total=amounts[amounts.length-1],count=summary.text.match(/^\s*(\d+)\s/);metadata.itemCount=count?Number(count[1]):null;metadata.officialTotal=(total/100).toFixed(2);metadata.reportedSubtotal=(subtotal/100).toFixed(2);metadata.reportedTax=(tax/100).toFixed(2);if(subtotal>0)metadata.taxPercent=String(Math.round(tax/subtotal*10000)/100);}}
 return metadata;
}
function structuredQuoteRows(lines,catalog){
 const rows=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],match=line.text.match(/^\s*(\d{1,3})\s+(\d+(?:[.,]\d+)?)\s*(kg|g|ml|lt|l)\s+([A-Z0-9-]+)\b/i),prices=line.text.match(/\$\s*\d[\d.,]*/g);
  if(!match||!prices||prices.length<2)continue;
  const previous=lines[i-1],next=lines[i+1],alias=previous?.page===line.page&&!/Precio Unit|Inspirad[ao]|\$|^\s*#/.test(previous.text)?previous.text.trim():'',inspiration=next?.page===line.page&&/Inspirad[ao]\s+en/i.test(next.text)?next.text.trim():'';
  const reference=inspiration.replace(/^Inspirad[ao]\s+en\s*/i,''),gender=alias.match(/(?:^|\s)([MFU])(?:\.|\s|$)/)?.[1],category={M:'Caballero',F:'Dama',U:'Unisex'}[gender],candidates=category?catalog.filter(p=>p.category===category):catalog;
  const sourceName=normalizeQuoteName(reference||alias),compatible=candidates.filter(p=>{const brand=normalizeQuoteName(p.brand),withoutBrand=sourceName.startsWith(brand+' ')?sourceName.slice(brand.length+1):sourceName.endsWith(' '+brand)?sourceName.slice(0,-brand.length-1):sourceName;return [p.reference,p.guideReference?.split(' / ').slice(1).join(' / '),p.name].filter(Boolean).map(normalizeQuoteName).some(name=>name===sourceName||name===withoutBrand);}),resolved=matchQuoteProduct(reference||alias,compatible),unit=match[3].toLowerCase(),qty=Number(match[2].replace(',','.'));
  rows.push({key:'row-'+rows.length,description:[alias,inspiration].filter(Boolean).join(' · ')||line.text,productId:resolved.productId,candidates:resolved.candidates,amount:(quoteMoneyCents(prices[prices.length-1])/100).toFixed(2),quantityMl:['ml','l','lt'].includes(unit)?String(qty*(unit==='ml'?1:1000)):'',sourceQuantity:match[2]+' '+unit,supplierCode:match[4],supplierNumber:Number(match[1]),unitPrice:prices[prices.length-2],page:line.page,y:line.y,include:null});
 }
 return rows;
}
export function quoteRowsFromLines(lines,catalog){
 const structured=structuredQuoteRows(lines,catalog);if(structured.length)return structured;
 const rows=[];
 for(const line of lines){const text=String(line.text??'').trim();if(!text||/^(?:sub\s*total|total|iva\b|impuesto|descuento|env[ií]o|flete|saldo|p[aá]gina|fecha|tel[eé]fono|rfc\b|clabe\b|cuenta\b|cotizaci[oó]n\b|vigencia|direcci[oó]n|domicilio|correo|www\.|https?:)/i.test(text))continue;
 const match=matchQuoteProduct(text,catalog),price=text.match(/(?:\$|MXN\s*|USD\s*|GTQ\s*)?\d[\d.,]*(?:\s*(?:MXN|USD|GTQ))?\s*$/i),hasLetters=/[a-záéíóúñ]{3}/i.test(text);
 if(!hasLetters||(!match.productId&&!price))continue;
 const withoutPrice=price?text.slice(0,price.index).trim():text;
 if(!/[a-záéíóúñ]{3}/i.test(withoutPrice))continue;
 let amount='';if(price)try{const cents=quoteMoneyCents(price[0]);if(cents!==null)amount=(cents/100).toFixed(2);}catch{}
 const ml=text.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros|litros|litro|lt|l)\b/i);
 rows.push({key:'row-'+rows.length,description:text,productId:match.productId,candidates:match.candidates,amount,quantityMl:ml?String(Number(ml[1].replace(',','.'))*(/^l/i.test(ml[2])?1000:1)):'',page:line.page??1,y:line.y??.5,include:null});
 }
 return rows;
}
export function pendingMaterialNeeds(state){
 const needs={};for(const b of state.batches??[]){if(b.status==='cancelled')continue;for(const i of b.items??[]){const pending=Math.max(0,i.qty-completedQuantity(i));if(!pending)continue;const recipe=recipeFor(i.size);for(const [key,ml] of [['ess-'+i.id,recipe.essence],['alcohol',recipe.alcohol],['galaxolide',recipe.fixative]])needs[key]=(needs[key]??0)+ml*pending;}}return needs;
}
export function analyzeQuotation(rows,state,catalog,{now=new Date(),taxPercent='0',fixedCharges='0',officialTotal=''}={}){
 const needs=pendingMaterialNeeds(state),quoted=new Set(),sales={};
 const cutoff=now.getTime()-90*86400000;
 for(const note of state.salesNotes??[]){const date=Date.parse(note.date+'T12:00:00Z');if(note.status==='cancelled'||!Number.isFinite(date)||date<cutoff||date>now.getTime())continue;for(const i of note.items??[]){const p=resolveSalesProduct(i,catalog);if(p)sales[p.id]=(sales[p.id]??0)+i.qty;}}
 const analyzed=rows.map(row=>{
  const p=catalog.find(p=>p.id===row.productId),materialId=p?'ess-'+p.id:['alcohol','galaxolide'].includes(row.productId)?row.productId:null,material=materialId&&!p?.discontinued?state.materials.find(m=>m.id===materialId&&!m.discontinued):null;
  if(materialId)quoted.add(materialId);
  const status=!material?'outside':material.stock===0?'missing':isMaterialLow(material)?'low':'available',pendingMl=needs[materialId]??0,deficitMl=material?Math.max(0,pendingMl-material.stock):0;
  const recommend=!!material&&(status==='missing'||status==='low'||deficitMl>0);
  const reason=p?.discontinued?'Producto descontinuado: no pedir ni reponer.':!material?(row.productId==='outside'?'No está en tu catálogo: evalúa una muestra o incorporación antes de comprar.':'Confirma la coincidencia con tu catálogo antes de decidir.'):
   deficitMl>0?`Los lotes pendientes requieren ${pendingMl} ml; faltan ${Number(deficitMl.toFixed(2))} ml sobre el saldo actual.`:
   status==='missing'?'Sin existencias: priorizar la reposición.':status==='low'?'Cumple el criterio de reposición por frasco: conviene pedirla.':'El saldo supera el umbral de reposición y cubre la producción pendiente registrada: puede posponerse para reducir el gasto.';
  let cents=null,amountError='';try{cents=quoteMoneyCents(row.amount);}catch(error){amountError=error.message;}
  const quantityMl=row.quantityMl===''?null:Number(row.quantityMl),quantityError=quantityMl!==null&&(!Number.isFinite(quantityMl)||quantityMl<=0)?'Revisa los mililitros cotizados.':'';
  const unresolved=!material&&row.productId!=='outside'&&!p?.discontinued;
  return {...row,product:p,material,status,pendingMl,deficitMl,recommend,reason,cents,amountError,quantityError,quantityMl,insufficientQuantity:quantityMl!==null&&deficitMl>quantityMl,recentUnits:p?sales[p.id]??0:null,keep:row.include===null||row.include===undefined?recommend:row.include===true,unresolved};
 });
 const known=analyzed.filter(r=>r.cents!==null&&!r.amountError),sum=items=>items.reduce((n,r)=>n+r.cents,0),subtotalCents=sum(known),selectedSubtotalCents=sum(known.filter(r=>r.keep));
 const rate=Number(taxPercent);let calculationError='',charges=0,reported=null;
 try{charges=quoteMoneyCents(fixedCharges)??0;reported=quoteMoneyCents(officialTotal);}catch(error){calculationError=error.message;}
 if(!Number.isFinite(rate)||rate<0||rate>100||String(taxPercent).trim()==='')calculationError='Indica un IVA válido entre 0 y 100 %.';
 const taxFor=items=>Number.isFinite(rate)?items.reduce((n,r)=>n+Math.round(r.cents*rate/100),0):0,taxCents=taxFor(known),selectedTaxCents=taxFor(known.filter(r=>r.keep));
 const calculatedTotalCents=subtotalCents+taxCents+charges,difference=reported===null?0:reported-calculatedTotalCents,roundingCents=Math.abs(difference)<=5?difference:0;
 if(reported!==null&&Math.abs(difference)>5)calculationError='Los renglones, IVA y cargos no coinciden con el total del proveedor. Revisa los importes antes de confirmar.';
 const totalCents=calculatedTotalCents+roundingCents,selectedCents=selectedSubtotalCents+selectedTaxCents+(known.some(r=>r.keep)?charges:0)+(subtotalCents?Math.round(roundingCents*selectedSubtotalCents/subtotalCents):0),savingsCents=totalCents-selectedCents;
 const missing=(state.materials??[]).filter(m=>m.kind==='Esencia'&&!m.discontinued&&!catalog.find(p=>p.id===m.id.slice(4))?.discontinued&&(m.stock===0||isMaterialLow(m))&&!quoted.has(m.id)).map(m=>({id:m.id,product:catalog.find(p=>p.id===m.id.slice(4)),status:m.stock===0?'missing':'low'}));
 const complete=!calculationError&&analyzed.length>0&&analyzed.every(r=>String(r.description??'').trim()&&r.cents!==null&&!r.amountError&&!r.quantityError&&!r.unresolved)&&[subtotalCents,selectedSubtotalCents,taxCents,selectedTaxCents,totalCents,selectedCents,savingsCents].every(Number.isSafeInteger);
 return {rows:analyzed,missing,subtotalCents,selectedSubtotalCents,taxPercent:rate,taxCents,selectedTaxCents,fixedChargesCents:charges,officialTotalCents:reported,roundingCents,calculationError,totalCents,selectedCents,savingsCents,complete,unresolved:analyzed.filter(r=>r.unresolved).length,unpriced:analyzed.filter(r=>r.cents===null||r.amountError).length};
}

// The internal request is a list of requested products, not a supplier price list.
export function requestedQuoteRowsFromLines(lines,catalog){
 const rows=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],text=String(line.text??'').trim(),quantity=text.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros|litros|litro|lt|l)\b/i);
  if(!quantity||/^(?:total|solicito|solicitud|cantidad|nombre|p[aá]gina|alcohol|galaxolide)\b/i.test(text)&&!/^alcohol\b/i.test(text))continue;
  let description=text;const next=lines[i+1];if(next?.page===line.page&&next.y-line.y<.025&&!/\d\s*(?:ml|kg|l)\b/i.test(next.text)&&!/^Solicitud|Total|Nombre|Cantidad/i.test(next.text))description+=' '+next.text;
  const category=/\bCaballero\b/i.test(description)?'Caballero':/\bDama\b/i.test(description)?'Dama':/\bUnisex\b/i.test(description)?'Unisex':null;
  const resolved=matchQuoteProduct(description,category?catalog.filter(p=>p.category===category):catalog),id=/^alcohol\b/i.test(text)?'alcohol':resolved.productId;
  rows.push({key:'request-'+rows.length,description,productId:id,quantityMl:String(Number(/^\d{1,3}(?:,\d{3})+$/.test(quantity[1])?quantity[1].replace(/,/g,''):quantity[1].replace(',','.'))*(/^l/i.test(quantity[2])?1000:1)),page:line.page,y:line.y});
 }
 return rows;
}
function requestIdentity(row,catalog){
 if(catalog.some(p=>p.id===row.productId)||['alcohol','galaxolide'].includes(row.productId))return 'id:'+row.productId;
 const source=String(row.description??''),inspiration=source.match(/Inspirad[ao]\s+en\s+(.+)/i)?.[1],text=normalizeQuoteName(inspiration??source).replace(/\b\d+(?:\s+\d+)?\s*(?:ml|kg|litros?|mililitros?)\b/g,'').replace(/\b(?:dama|caballero|unisex)\b/g,'').trim();
 return row.productId==='outside'&&text.length>=4?'name:'+text:null;
}
export function compareRequestedQuotation(supplierRows,requestedRows,catalog){
 if(requestedRows===null||requestedRows===undefined)return {loaded:false,complete:false,allMatch:false,matched:[],extra:[],missing:[],unknownSupplier:[],unknownRequested:[],duplicates:[]};
 const supplier=supplierRows.map(row=>({row,key:requestIdentity(row,catalog)})),requested=requestedRows.map(row=>({row,key:requestIdentity(row,catalog)})),requestedKeys=new Set(requested.map(r=>r.key).filter(Boolean)),supplierKeys=new Set(supplier.map(r=>r.key).filter(Boolean));
 const unknownSupplier=supplier.filter(r=>!r.key).map(r=>r.row),unknownRequested=requested.filter(r=>!r.key).map(r=>r.row),complete=requested.length>0&&!unknownSupplier.length&&!unknownRequested.length;
 const matched=supplier.filter(r=>r.key&&requestedKeys.has(r.key)).map(r=>r.row),extra=supplier.filter(r=>r.key&&!requestedKeys.has(r.key)).map(r=>r.row),missing=requested.filter(r=>r.key&&!supplierKeys.has(r.key)).map(r=>r.row),seen=new Set(),duplicates=supplier.filter(r=>{if(!r.key)return false;const repeat=seen.has(r.key);seen.add(r.key);return repeat;}).map(r=>r.row);
 return {loaded:true,complete,allMatch:complete&&!extra.length&&!missing.length,matched,extra,missing,unknownSupplier,unknownRequested,duplicates};
}
export function quotationBriefSummary(analysis,comparison,catalog,{cash=value=>(value/100).toFixed(2),reviewed=false}={}){
 const name=row=>catalog.find(p=>p.id===row.productId)?.guideReference?.split(' / ').slice(1).join(' / ')||row.description;
 const list=rows=>rows.slice(0,6).map(name).join('; ')+(rows.length>6?`; y ${rows.length-6} más`:''),counts={missing:0,low:0,available:0,outside:0};for(const row of analysis.rows)counts[row.status]++;
 const paragraphs=[`Inventario: ${counts.missing} agotadas, ${counts.low} por agotarse, ${counts.available} con existencias y ${counts.outside} fuera del catálogo o por identificar.`];
 if(!comparison.loaded)paragraphs.push('Falta cargar la cotización interna de Alma Mía para verificar qué perfumes se solicitaron.');
 else{
  paragraphs.push(comparison.allMatch?'Los perfumes cotizados coinciden con los solicitados.':`Comparación de perfumes: ${comparison.matched.length} renglones coinciden con la solicitud.${!comparison.complete?' Hay coincidencias pendientes; las diferencias son preliminares.':''}`);
  if(comparison.extra.length)paragraphs.push(`${!comparison.unknownRequested.length?'Añadidos por el proveedor, no solicitados':'No encontrados en los renglones solicitados identificados'}: ${list(comparison.extra)}.`);
  if(comparison.missing.length)paragraphs.push(`${!comparison.unknownSupplier.length?'Solicitados que faltan en la cotización del proveedor':'Solicitados sin coincidencia identificada en el proveedor'}: ${list(comparison.missing)}.`);
  if(comparison.duplicates.length)paragraphs.push(`Renglones repetidos para revisar: ${list(comparison.duplicates)}.`);
  if(!comparison.extra.length&&!comparison.missing.length&&!comparison.allMatch)paragraphs.push('Identifica los nombres pendientes antes de confirmar que ambas listas coinciden.');
 }
 const priority=analysis.rows.filter(r=>r.recommend),postpone=analysis.rows.filter(r=>!r.recommend&&!r.unresolved);
 if(priority.length)paragraphs.push(`Prioridad de reposición: ${list(priority)}.`);
 if(postpone.length)paragraphs.push(`Para reducir el costo, revisar o posponer: ${list(postpone)}.`);
 if(analysis.complete&&reviewed)paragraphs.push(`Total analizado: ${cash(analysis.totalCents)}. Propuesta seleccionada: ${cash(analysis.selectedCents)}. Ahorro estimado: ${cash(analysis.savingsCents)}.`);
 else paragraphs.push('El ahorro queda pendiente de revisar las coincidencias, los importes, el IVA y los cargos.');
 if(analysis.rows.some(r=>/\b(?:kg|g)\b/i.test(r.sourceQuantity??'')))paragraphs.push('La coincidencia verifica los perfumes. Las cantidades en kg o g no se equiparan a ml sin una conversión confirmada.');
 return paragraphs;
}

export function analyzeQuotationAgainstRequest(rows,requestedRows,state,catalog,options={}){
 const base=analyzeQuotation(rows,state,catalog,options),comparison=compareRequestedQuotation(base.rows,requestedRows,catalog);
 if(!requestedRows?.length||comparison.unknownRequested.length)return {...base,comparison};
 const extraIndices=new Set(base.rows.map((row,i)=>comparison.extra.includes(row)?i:-1).filter(i=>i>=0));
 const adjusted=rows.map((row,i)=>extraIndices.has(i)&&(row.include===null||row.include===undefined)?{...row,include:false}:row),result=analyzeQuotation(adjusted,state,catalog,options);
 result.rows.forEach((row,i)=>{if(extraIndices.has(i)){row.unrequested=true;row.recommend=false;row.reason='No figura en la solicitud interna: posponer y confirmar con el proveedor antes de añadirlo al pedido. '+row.reason;}});
 return {...result,comparison:compareRequestedQuotation(result.rows,requestedRows,catalog)};
}
