import {isMaterialLow,completedQuantity,recipeFor} from './inventory.js?v=81';
import {resolveSalesProduct} from './sales-analytics.js?v=81';
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
  const resolved=matchQuoteProduct(reference||alias,candidates),unit=match[3].toLowerCase(),qty=Number(match[2].replace(',','.'));
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
  const p=catalog.find(p=>p.id===row.productId),materialId=p?'ess-'+p.id:['alcohol','galaxolide'].includes(row.productId)?row.productId:null,material=materialId?state.materials.find(m=>m.id===materialId):null;
  if(materialId)quoted.add(materialId);
  const status=!material?'outside':material.stock===0?'missing':isMaterialLow(material)?'low':'available',pendingMl=needs[materialId]??0,deficitMl=material?Math.max(0,pendingMl-material.stock):0;
  const recommend=!!material&&(status==='missing'||status==='low'||deficitMl>0);
  const reason=!material?(row.productId==='outside'?'No está en tu catálogo: evalúa una muestra o incorporación antes de comprar.':'Confirma la coincidencia con tu catálogo antes de decidir.'):
   deficitMl>0?`Los lotes pendientes requieren ${pendingMl} ml; faltan ${Number(deficitMl.toFixed(2))} ml sobre el saldo actual.`:
   status==='missing'?'Sin existencias: priorizar la reposición.':status==='low'?'Cumple el criterio de reposición por frasco: conviene pedirla.':'El saldo supera el umbral de reposición y cubre la producción pendiente registrada: puede posponerse para reducir el gasto.';
  let cents=null,amountError='';try{cents=quoteMoneyCents(row.amount);}catch(error){amountError=error.message;}
  const quantityMl=row.quantityMl===''?null:Number(row.quantityMl),quantityError=quantityMl!==null&&(!Number.isFinite(quantityMl)||quantityMl<=0)?'Revisa los mililitros cotizados.':'';
  const unresolved=!material&&row.productId!=='outside';
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
 const missing=(state.materials??[]).filter(m=>m.kind==='Esencia'&&(m.stock===0||isMaterialLow(m))&&!quoted.has(m.id)).map(m=>({id:m.id,product:catalog.find(p=>p.id===m.id.slice(4)),status:m.stock===0?'missing':'low'}));
 const complete=!calculationError&&analyzed.length>0&&analyzed.every(r=>String(r.description??'').trim()&&r.cents!==null&&!r.amountError&&!r.quantityError&&!r.unresolved)&&[subtotalCents,selectedSubtotalCents,taxCents,selectedTaxCents,totalCents,selectedCents,savingsCents].every(Number.isSafeInteger);
 return {rows:analyzed,missing,subtotalCents,selectedSubtotalCents,taxPercent:rate,taxCents,selectedTaxCents,fixedChargesCents:charges,officialTotalCents:reported,roundingCents,calculationError,totalCents,selectedCents,savingsCents,complete,unresolved:analyzed.filter(r=>r.unresolved).length,unpriced:analyzed.filter(r=>r.cents===null||r.amountError).length};
}
