import {catalogCategories,filterCatalog} from './catalog-tools.js?v=96';
export const labelName=name=>{const s=String(name).trim().toLocaleLowerCase('es');return s.charAt(0).toLocaleUpperCase('es')+s.slice(1);};
export function labelRowCounts(selection={}){
 if(!selection||typeof selection!=='object')throw Error('La selección de filas no es válida.');
 const rows100=selection.rows100===undefined?1:selection.rows100,rows50=selection.rows50===undefined?1:selection.rows50;
 if(![rows100,rows50].every(value=>Number.isInteger(value)&&value>=0&&value<=100))throw Error('Indica de 0 a 100 filas enteras por presentación.');
 if(rows100+rows50===0)throw Error('Cada perfume debe tener al menos una fila de etiquetas.');
 return {rows100,rows50};
}
export function labelLayout(selection){
 const plan=Array.isArray(selection)?selection:Number.isInteger(selection)&&selection>=1&&selection<=112?Array.from({length:selection},()=>({})):null;
 if(!plan||plan.length<1||plan.length>112)throw Error('Selecciona entre 1 y 112 perfumes.');
 const normalized=plan.map(labelRowCounts),rows=[];let page=0,y=35.1;
 const nextPage=()=>{page++;y=35.1;};
 for(let i=0;i<normalized.length;i++){
  const {rows100,rows50}=normalized[i],height=rows100*56.9+rows50*45.3-10;
  // Keep a perfume together when its full group fits one sheet. This also
  // preserves the original 100/50 pair placement for the default quantities.
  if(height<=909.8+.001&&y+height>944.9+.001)nextPage();
  for(const [size,w,h,copies,count]of [[100,69.6,46.9,7,rows100],[50,59.8,35.3,8,rows50]])for(let repeat=0;repeat<count;repeat++){
   if(y+h>944.9+.001)nextPage();
   rows.push({index:i,page,size,w,h,copies,y,x:(580-(copies*w+(copies-1)*10))/2});y+=h+10;
  }
 }
 return {rows,pages:page+1,totalRows:rows.length,totalLabels:rows.reduce((sum,row)=>sum+row.copies,0)};
}
export function fitLabelName(name,maxWidth,measure,base){
 const words=labelName(name).split(/\s+/),lines=words.length>1?[words[0],words.slice(1).join(' ')]:words;
 // Fit the text without moving the required break after the first word.
 for(let step=0;step<=Math.ceil((base-3)*10);step++){
  const size=Math.max(3,base-step/10);
  if(lines.every(line=>measure(line,size)<=maxWidth))return {lines,size};
 }
 throw Error('El nombre es demasiado largo para la etiqueta.');
}
export async function buildLabelsPdf(products){
 const layout=labelLayout(products),{jsPDF}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:[580,980],orientation:'portrait',compress:true});
 const templates=await Promise.all([100,50].map(async size=>{const res=await fetch(`./assets/labels/template-${size}.png?v=96`);if(!res.ok)throw Error('No se pudo cargar la plantilla.');return new Uint8Array(await res.arrayBuffer());}));
 doc.setProperties({title:'Pliego de etiquetas · Alma Mía',author:'Alma Mía Perfumes'});doc.setFont('helvetica','normal');doc.setTextColor(0);let current=0,processed=0;
 for(const row of layout.rows){
  if(row.page!==current){doc.addPage([580,980],'portrait');current=row.page;}
  const is100=row.size===100,left=(is100?104/822:113/751)*row.w,base=64/(is100?822:751)*row.w*72/25.4;
  const fitted=fitLabelName(products[row.index].name,row.w-left-7,(s,size)=>{doc.setFontSize(size);return doc.getTextWidth(s);},base);
  const center=(is100?280/554:247/443)*row.h,lineHeight=fitted.size*25.4/72*1.12,first=center-(fitted.lines.length-1)*lineHeight/2+fitted.size*25.4/72*.35;
  for(let j=0;j<row.copies;j++){
   const x=row.x+j*(row.w+10);doc.addImage(templates[is100?0:1],'PNG',x,row.y,row.w,row.h,'label-'+row.size,'FAST');doc.setFontSize(fitted.size);fitted.lines.forEach((line,k)=>doc.text(line,x+left,row.y+first+k*lineHeight));
  }
  if(++processed%8===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {blob:doc.output('blob'),pages:layout.pages,rows:layout.totalRows,labels:layout.totalLabels};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLabelsPanel({catalog,notify,allowed}){
 let selected=[],plans=new Map(),query='',category='all',url='',busy=false,resultMessage='',epoch=0;
 const planFor=id=>plans.get(id)??{rows100:1,rows50:1};
 const products=()=>selected.map(id=>({...catalog.find(product=>product.id===id),...planFor(id)}));
 const clearPdf=()=>{if(url)URL.revokeObjectURL(url);url='';resultMessage='';};
 function selection(){
  const chosen=products();if(!chosen.length)return {chosen,layout:null,error:''};
  for(const product of chosen){try{labelRowCounts(product);}catch(error){return {chosen,layout:null,error:product.name+': '+error.message};}}
  try{return {chosen,layout:labelLayout(chosen),error:''};}catch(error){return {chosen,layout:null,error:error.message};}
 }
 function summary(data){
  if(!data.layout)return data.error?'Revisa las filas seleccionadas antes de generar el PDF.':'Todavía no has seleccionado filas.';
  const counts=data.layout.rows.reduce((total,row)=>{total[row.size]++;return total;},{100:0,50:0});
  return `${counts[100]} ${counts[100]===1?'fila':'filas'} de 100 ml · ${counts[100]*7} etiquetas / ${counts[50]} ${counts[50]===1?'fila':'filas'} de 50 ml · ${counts[50]*8} etiquetas. Total: ${data.layout.totalLabels} etiquetas · ${data.layout.pages} ${data.layout.pages===1?'pliego':'pliegos'}.`;
 }
 const pdfHtml=()=>url?`<a class="primary" href="${url}" download="Alma-Mia-Etiquetas-${Date.now()}.pdf">Descargar PDF</a><p>Imprime al 100 %, sin ajustar a página. El visor puede mostrar blanco donde hay transparencia.</p><iframe title="Pliego de etiquetas" src="${url}"></iframe>`:'';
 function updateCounts(){
  if(!allowed())return;
  const data=selection(),summaryNode=document.getElementById('label-selection-summary'),errorNode=document.getElementById('label-count-error'),preview=document.getElementById('label-preview');
  if(summaryNode)summaryNode.textContent=summary(data);if(errorNode)errorNode.textContent=data.error;
  if(preview)preview.disabled=busy||!selected.length||Boolean(data.error);
  document.querySelectorAll('[data-label-item-summary]').forEach(node=>{const counts=planFor(node.dataset.labelItemSummary);node.textContent=[counts.rows100,counts.rows50].every(value=>Number.isInteger(value)&&value>=0&&value<=100)?`${counts.rows100*7} etiquetas de 100 ml · ${counts.rows50*8} etiquetas de 50 ml`:'';});
 }
 const panel={
  clear(){epoch++;selected=[];plans.clear();query='';category='all';busy=false;clearPdf();},
  html(){
   const list=filterCatalog(catalog,{query,category}),data=selection();
   return `<div class="page-title"><div><div class="eyebrow">IMPRESIÓN</div><h1>Imprimir etiquetas</h1><p>Selecciona los perfumes y el número de filas de cada presentación.</p></div></div><section class="card"><h2>Seleccionar perfumes</h2><div class="group-tabs">${catalogCategories.map(([id,name])=>`<button type="button" data-label-category="${id}" aria-pressed="${category===id}">${name}</button>`).join('')}</div><label class="field">Buscar por nombre, inspiración o marca<input id="label-search" value="${esc(query)}" placeholder="Buscar perfume…"></label><div class="label-options">${list.map(product=>`<label class="label-option"><input type="checkbox" data-label-id="${esc(product.id)}" ${busy?'disabled':''} ${selected.includes(product.id)?'checked':''}><span><strong>${esc(product.name)}</strong><small>${esc(product.displayReference??product.reference)} · ${esc(product.category)}</small></span></label>`).join('')||'<p>Sin coincidencias.</p>'}</div></section><section class="card label-selection"><h2>Tu selección · ${selected.length} ${selected.length===1?'perfume':'perfumes'}</h2><p>Una fila contiene 7 etiquetas de 100 ml u 8 de 50 ml. Cada perfume comienza con una fila de cada tamaño. Usa 0 si no necesitas una presentación.</p>${selected.length?`<ol class="label-selected-list">${selected.map(id=>{const product=catalog.find(product=>product.id===id),counts=planFor(id);return `<li class="label-selected-item"><div class="label-selected-header"><strong>${esc(labelName(product.name))}</strong><button type="button" class="text-button" data-label-remove="${esc(id)}" aria-label="Quitar ${esc(product.name)}" ${busy?'disabled':''}>Quitar</button></div><div class="label-row-controls">${[100,50].map(size=>{const value=counts['rows'+size];return `<label class="field">Filas de ${size} ml<input type="number" min="0" max="100" step="1" inputmode="numeric" value="${Number.isFinite(value)?value:''}" data-label-rows="${esc(id)}" data-label-size="${size}" aria-label="Filas de ${size} ml de ${esc(product.name)}" ${busy?'disabled':''}><small>${size===100?7:8} etiquetas por fila</small></label>`;}).join('')}</div><p class="label-item-count" data-label-item-summary="${esc(id)}"></p></li>`;}).join('')}</ol>`:'<p>Selecciona perfumes con las casillas de arriba.</p>'}<p id="label-selection-summary" class="label-selection-summary" role="status" aria-live="polite">${esc(summary(data))}</p><p id="label-count-error" class="label-count-error" role="alert">${esc(data.error)}</p><p>Pliego de 58 × 98 cm · Separación de 1 cm · Se añaden los pliegos necesarios, conservando el orden de selección, las medidas y la transparencia.</p><div class="label-actions"><button type="button" class="primary" id="label-preview" ${!selected.length||busy||data.error?'disabled':''}>${busy?'Generando…':'Previsualizar pliego'}</button><button type="button" class="secondary" id="label-clear" ${busy?'disabled':''}>Limpiar selección</button></div><p id="label-result" role="status">${esc(resultMessage)}</p><div id="label-pdf">${pdfHtml()}</div></section>`;
  },
  mount(){
   if(!allowed())return;
   const refresh=()=>{
    if(!allowed())return;
    const active=document.activeElement,focused=active?.id,range=focused==='label-search'?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;
    document.getElementById('content').innerHTML=panel.html();panel.mount();
    if(range){const input=document.getElementById('label-search');input.focus({preventScroll:true});input.setSelectionRange(...range);}
   };
   document.getElementById('label-search').oninput=event=>{query=event.target.value;refresh();};
   document.querySelectorAll('[data-label-category]').forEach(button=>button.onclick=()=>{category=button.dataset.labelCategory;refresh();});
   document.querySelectorAll('[data-label-id]').forEach(input=>input.onchange=()=>{if(busy||!allowed())return;const id=input.dataset.labelId;selected=input.checked?[...selected,id]:selected.filter(selectedId=>selectedId!==id);if(input.checked&&!plans.has(id))plans.set(id,{rows100:1,rows50:1});clearPdf();refresh();});
   document.querySelectorAll('[data-label-remove]').forEach(button=>button.onclick=()=>{if(busy||!allowed())return;selected=selected.filter(id=>id!==button.dataset.labelRemove);clearPdf();refresh();});
   document.querySelectorAll('[data-label-rows]').forEach(input=>input.oninput=()=>{
    if(busy||!allowed())return;
    const id=input.dataset.labelRows,counts={...planFor(id)},value=input.value;
    counts['rows'+input.dataset.labelSize]=value.trim()===''?NaN:Number(value);plans.set(id,counts);clearPdf();
    document.getElementById('label-pdf')?.replaceChildren();document.getElementById('label-result').textContent='';updateCounts();
   });
   document.getElementById('label-clear').onclick=()=>{if(busy||!allowed())return;selected=[];plans.clear();clearPdf();refresh();};
   document.getElementById('label-preview').onclick=async()=>{
    if(busy||!allowed())return;
    const data=selection();if(data.error||!data.chosen.length){notify(data.error||'Selecciona al menos un perfume.');return;}
    busy=true;clearPdf();const token=epoch;refresh();
    try{
     const result=await buildLabelsPdf(data.chosen);
     if(token!==epoch||!allowed())return;
     url=URL.createObjectURL(result.blob);resultMessage=`${data.chosen.length} ${data.chosen.length===1?'perfume':'perfumes'} · ${result.rows} ${result.rows===1?'fila':'filas'} · ${result.labels} etiquetas · ${result.pages} ${result.pages===1?'pliego':'pliegos'}.`;
    }catch(error){if(token===epoch&&allowed())notify('No se pudo generar el pliego: '+error.message);}
    finally{if(token===epoch){busy=false;refresh();if(url&&allowed())document.getElementById('label-pdf').scrollIntoView({behavior:'smooth',block:'start'});}}
   };
   updateCounts();
  }
 };
 return panel;
}
