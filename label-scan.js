import {readyBatch} from './inventory.js?v=69';
export const MAX_SCANNED_PRODUCTS=20;
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const words=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,' ').trim().split(/\s+/).filter(Boolean);
function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next;}return prev[b.length];}
export function readLabel(text,catalog){
 const tokens=words(text),key=tokens.join(''),foundSizes=new Set();
 for(const match of String(text).toLowerCase().matchAll(/\b(\d+(?:[.,]\d+)?)\s*(ml|m[il]l|cl|l)\b/g)){const value=Number(match[1].replace(',','.'))*(match[2]==='cl'?10:match[2]==='l'?1000:1);if(value>0)foundSizes.add(value);}
 for(const repaired of String(text).matchAll(/\b([Iil1][0Oo]{2}|[5Ss][0Oo])\s*m[lLiI1]\b/g)){const value=Number(repaired[1].replace(/[Iil]/g,'1').replace(/[Oo]/g,'0').replace(/[Ss]/g,'5'));if([50,100].includes(value))foundSizes.add(value);}
 // Convert common fluid-ounce labels only when no metric size was printed.
 if(!foundSizes.size){if(/\b3[.,]4\s*(?:fl\.?\s*)?oz\b/i.test(text))foundSizes.add(100);if(/\b1[.,]7\s*(?:fl\.?\s*)?oz\b/i.test(text))foundSizes.add(50);}
 const sizes=[...foundSizes],size=sizes.length===1&&[50,100].includes(sizes[0])?sizes[0]:null;
 const male=/\b(homme|men|man|hombre|caballero|masculino)\b/i.test(text),female=/\b(femme|women|woman|dama|mujer|femenino)\b/i.test(text);
 const candidates=[];
 for(const p of catalog){if(male&&!female&&p.category==='Dama'||female&&!male&&p.category==='Caballero')continue;let score=0,matched='',source='';
  for(const [alias,kind] of [[p.name,'own'],[p.reference,'reference']]){const a=normalize(alias);if(a.length<4)continue;if(key.includes(a)&&(a.length>5||tokens.includes(a))){const s=a.length+((p.brand&&key.includes(normalize(p.brand)))?8:0);if(s>score){score=s;matched=alias;source=kind;}}}
  if(score)candidates.push({id:p.id,score,matched,source});
 }
 candidates.sort((a,b)=>b.score-a.score);let id=null,matchType='none';
 if(candidates.length){const best=candidates[0];const ambiguous=candidates[1]?.score===best.score||candidates.slice(1).some(c=>!normalize(best.matched).includes(normalize(c.matched))&&!normalize(c.matched).includes(normalize(best.matched)));
  // A base label alone must not silently select one of several variants.
  const variants=best.source==='reference'?catalog.filter(p=>p.id!==best.id&&normalize(p.reference).startsWith(normalize(best.matched))&&!(male&&!female&&p.category==='Dama')&&!(female&&!male&&p.category==='Caballero')):[];
  if(!ambiguous&&!variants.length){id=best.id;matchType='exact';}else{matchType='ambiguous';for(const p of variants)if(!candidates.some(c=>c.id===p.id))candidates.push({id:p.id,score:best.score,matched:p.reference,source:'reference'});}
 }else{
  const partial=[];for(const p of catalog){if(male&&!female&&p.category==='Dama'||female&&!male&&p.category==='Caballero')continue;const tokens=words(p.name);let best=0;for(let start=0;start<tokens.length;start++)for(let count=2;start+count<=tokens.length;count++){const selected=tokens.slice(start,start+count),fragment=selected.join('');if(selected.filter(w=>!['in','of','the','and','de','with'].includes(w)).length>=2&&fragment.length>=9&&fragment.length/normalize(p.name).length>=.55&&key.includes(fragment))best=Math.max(best,fragment.length);}if(best)partial.push({id:p.id,score:best});}
  if(partial.length===1)return {id:partial[0].id,size,matchType:'approximate',candidates:[partial[0].id],text:String(text).trim(),sizeIssue:sizes.length>1?'La etiqueta muestra varias capacidades.':!size?'No se pudo leer la capacidad.':''};
  const scores=catalog.filter(p=>!(male&&!female&&p.category==='Dama')&&!(female&&!male&&p.category==='Caballero')).map(p=>{let score=0,aliasLength=0;for(const alias of [p.name,p.reference]){const n=normalize(alias);if(n.length<6)continue;const length=words(alias).length;for(let start=0;start<tokens.length;start++)for(let count=Math.max(1,length-1);count<=length+1&&start+count<=tokens.length;count++){const value=tokens.slice(start,start+count).join('');if(Math.abs(value.length-n.length)>Math.max(2,n.length*.2))continue;const similarity=1-distance(n,value)/Math.max(n.length,value.length);if(similarity>score){score=similarity;aliasLength=n.length;}}}return {id:p.id,score,aliasLength};}).filter(p=>p.score>=.78).sort((a,b)=>b.score-a.score);
  candidates.push(...scores.slice(0,5));if((scores[0]?.score>=.90||scores[0]?.score>=.86&&scores[0]?.aliasLength>=12)&&scores[0].score-(scores[1]?.score??0)>=.12){id=scores[0].id;matchType='approximate';}else if(scores.length)matchType='ambiguous';
 }
 return {id,size,matchType,candidates:[...new Set(candidates.slice(0,6).map(c=>c.id))],text:String(text).trim(),sizeIssue:sizes.length>1?'La etiqueta muestra varias capacidades.':sizes.length===1&&!size?'La capacidad detectada no es de 50 o 100 ml.':!size?'No se pudo leer la capacidad.':''};
}
export function scannedStockItems(rows,catalog){if(!Array.isArray(rows)||!rows.length||rows.length>MAX_SCANNED_PRODUCTS)throw Error('Escanea entre 1 y 20 productos.');const groups=new Map();let total=0;for(const row of rows){if(!catalog.some(p=>p.id===row.id)||![50,100].includes(row.size)||!Number.isSafeInteger(row.qty)||row.qty<1)throw Error('Revisa el perfume, la capacidad y las unidades de cada etiqueta.');total+=row.qty;if(total>MAX_SCANNED_PRODUCTS)throw Error('El límite es de 20 productos por carga.');const key=row.id+'-'+row.size,entry=groups.get(key)??{id:row.id,size:row.size,qty:0};entry.qty+=row.qty;groups.set(key,entry);}return [...groups.values()];}
export function confirmScannedStock(state,rows,catalog){const next=readyBatch(state,scannedStockItems(rows,catalog),catalog),added=next.movements.length-state.movements.length;for(const movement of next.movements.slice(0,added))movement.detail='Ingreso por escaneo · '+movement.detail;return next;}

export function resolveLabelReadings(readings,catalog){
 const parsed=readings.map(r=>({...readLabel(r.text,catalog),kind:r.kind,confidence:r.confidence})),names=parsed.filter(r=>r.kind!=='footer'),ids=[...new Set(names.map(r=>r.id).filter(Boolean))],sizes=[...new Set(parsed.map(r=>r.size).filter(Boolean))],sizeConflict=parsed.some(r=>r.sizeIssue==='La etiqueta muestra varias capacidades.'),id=ids.length===1?ids[0]:null,size=sizes.length===1&&!sizeConflict?sizes[0]:null;
 return {id,size,candidates:[...new Set(names.flatMap(r=>r.candidates))].slice(0,6),matchType:id?(names.some(r=>r.id===id&&r.matchType==='exact')?'exact':'approximate'):ids.length>1?'ambiguous':'none',text:readings.map((r,i)=>`Lectura ${i+1}${r.kind==='contrast'?' (contraste)':r.kind==='footer'?' (capacidad)':''}:\n${r.text?.trim()||'Sin texto legible'}`).join('\n\n'),sizeIssue:size?'':sizeConflict||sizes.length>1?'Las lecturas no coinciden en la capacidad. Revísala.':'No se pudo leer la capacidad.'};
}
