// Presentation only. Existing filter buttons remain the source of their actions.
const filterLabels={
 'data-catalog-category':'Categoría de perfume','data-material-group':'Colección','data-material-status':'Existencias',
 'data-stock-gender':'Categoría','data-stock-size':'Presentación','data-label-category':'Categoría de etiqueta',
 'data-sales-rank-gender':'Categoría','data-sales-rank-mode':'Orden del ranking','data-sales-rank-limit':'Cantidad de resultados',
 'data-material-report-mode':'Documento','data-progress-filter':'Avance de producción','data-stock-status':'Existencias'
};
export function friendlyFilterLabel(group,buttons){
 const attribute=Object.keys(filterLabels).find(key=>buttons.every(button=>button.hasAttribute(key)));
 return {attribute,label:attribute?filterLabels[attribute]:group.getAttribute('aria-label')||'Filtrar resultados'};
}
export function initFriendlyFilters(){
 const document=globalThis.document;if(!document)return;
 const records=new WeakMap();let sequence=0,scheduled=false;
 function focusAfter(key){requestAnimationFrame(()=>{const select=[...document.querySelectorAll('select[data-friendly-key]')].find(el=>el.dataset.friendlyKey===key);select?.focus({preventScroll:true});});}
 function enhanceGroup(group){
  const buttons=[...group.children].filter(el=>el.tagName==='BUTTON');
  if(buttons.length<3||buttons.some(button=>!button.hasAttribute('aria-pressed')))return;
  let record=records.get(group);
  if(record&&record.wrapper.isConnected&&record.select.options.length!==buttons.length){record.wrapper.remove();records.delete(group);group.hidden=false;return enhanceGroup(group);}
  if(record&&record.wrapper.isConnected){const selected=buttons.findIndex(button=>button.getAttribute('aria-pressed')==='true');if(selected>=0&&record.select.value!==String(selected))record.select.value=String(selected);buttons.forEach((button,i)=>{const text=button.textContent.trim();const option=record.select.options[i];if(option.textContent!==text)option.textContent=text;if(option.disabled!==button.disabled)option.disabled=button.disabled;});return;}
  const {attribute,label}=friendlyFilterLabel(group,buttons),key=(group.closest('dialog')?.id||'content')+':'+(attribute||group.getAttribute('aria-label')||buttons[0].textContent.trim());
  const wrapper=document.createElement('label'),caption=document.createElement('span'),select=document.createElement('select');wrapper.className='field friendly-filter-control';caption.textContent=label;select.id='friendly-filter-'+ ++sequence;select.dataset.friendlyKey=key;select.setAttribute('aria-label',label);
  buttons.forEach((button,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=button.textContent.trim();option.disabled=button.disabled;option.selected=button.getAttribute('aria-pressed')==='true';select.append(option);});
  select.onchange=()=>{const index=Number(select.value);[...group.children].filter(el=>el.tagName==='BUTTON')[index]?.click();focusAfter(key);};
  const previous=group.previousElementSibling;if(previous?.matches('.sales-filter-label,.inventory-filter-line>span')){previous.classList.add('friendly-redundant-label');previous.hidden=true;}
  wrapper.append(caption,select);group.before(wrapper);group.classList.add('friendly-filter-source');group.hidden=true;record={wrapper,select};records.set(group,record);
 }
 function enhanceSearch(input){
  if(input.closest('.friendly-search')){const clear=input.closest('.friendly-search').querySelector('button');if(clear)clear.hidden=!input.value;return;}
  const wrapper=document.createElement('div'),clear=document.createElement('button');wrapper.className='friendly-search';input.before(wrapper);wrapper.append(input);input.type='search';input.inputMode='search';input.autocomplete='off';input.spellcheck=false;
  clear.type='button';clear.className='friendly-search-clear';clear.textContent='Limpiar';clear.setAttribute('aria-label','Limpiar búsqueda');clear.hidden=!input.value;wrapper.append(clear);
  input.addEventListener('input',()=>{clear.hidden=!input.value;});
  clear.onclick=()=>{const id=input.id;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));const current=id?document.getElementById(id):input;current?.focus({preventScroll:true});};
 }
 function scan(){
  scheduled=false;
  const controls=document.querySelector('#content>.inventory-controls'),metrics=document.querySelector('#content>.inventory-metrics');if(controls&&metrics&&(metrics.compareDocumentPosition(controls)&4))metrics.before(controls);
  for(const region of document.querySelectorAll('#content,dialog')){
   region.querySelectorAll('.group-tabs,.catalog-filters').forEach(enhanceGroup);
   region.querySelectorAll('input[type="search"],input[placeholder^="Buscar"],input[aria-label^="Buscar"]').forEach(enhanceSearch);
  }
 }
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(scan);});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed','disabled']});
 document.addEventListener('alma:render',scan);scan();
 return {refresh:scan,dispose(){observer.disconnect();document.removeEventListener('alma:render',scan);}};
}
