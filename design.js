/* Visual preferences are local to this browser and never touch inventory data. */
const root=document.documentElement;
const icons={overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',materials:'<path d="M9 3h6M10 3v6L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2l-6-10V3M7 15h10"/>',dictation:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',ready:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4"/>',batches:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 10h8M8 14h5M8 18h3"/>',sales:'<path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3"/>',customers:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',catalog:'<path d="M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4Zm18 0h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h5V4Z"/>',labels:'<path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7" cy="8" r="1"/>',strips:'<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><path d="M18 3h3v18h-3M4 8h3M11 8h3"/>',cloud:'<path d="M6 17a5 5 0 1 1 1-10 7 7 0 0 1 13 3 4 4 0 0 1-1 8h-3M9 16l3-3 3 3M12 13v9"/>',history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>'};
const order={overview:1,materials:11,dictation:12,ready:13,batches:14,sales:21,customers:22,catalog:31,labels:32,strips:33,cloud:41,history:42};
const nav=document.querySelector('aside nav');
for(const button of nav.querySelectorAll('button')){
 const symbol=button.firstChild;if(symbol?.nodeType===Node.TEXT_NODE){const span=document.createElement('span');span.className='classic-symbol';span.textContent=symbol.textContent;symbol.replaceWith(span);}
 button.insertAdjacentHTML('afterbegin',`<svg class="nav-icon modern-only" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[button.dataset.view]??icons.overview}</svg>`);
 button.style.setProperty('--nav-order',order[button.dataset.view]);
}
for(const [position,label]of [[0,'Tu negocio'],[10,'Operación'],[20,'Ventas'],[30,'Catálogo e impresión'],[40,'Administración']]){const group=document.createElement('div');group.className='nav-group modern-only';group.style.order=position;group.textContent=label;nav.append(group);}
const toggle=document.querySelector('#design-toggle'),menu=document.querySelector('#navigation-toggle'),aside=document.querySelector('aside');
function update(){const modern=root.dataset.design!=='classic';toggle.textContent=modern?'Diseño anterior':'Probar diseño nuevo';toggle.setAttribute('aria-label',modern?'Cambiar al diseño anterior':'Cambiar al diseño nuevo');document.querySelector('meta[name=theme-color]').content=modern?'#f5f6f7':'#f6f5f2';if(!modern)closeMenu();updateEffects();}
function closeMenu(){aside.removeAttribute('data-menu-open');menu.setAttribute('aria-expanded','false');menu.textContent='Menú';}
toggle.addEventListener('click',()=>{root.dataset.design=root.dataset.design==='classic'?'modern':'classic';try{localStorage.setItem('alma-mia-design',root.dataset.design);}catch{}update();});
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';aside.toggleAttribute('data-menu-open',open);menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Cerrar menú':'Menú';});
nav.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&aside.hasAttribute('data-menu-open')){closeMenu();menu.focus();}});
document.addEventListener('click',e=>{if(aside.hasAttribute('data-menu-open')&&!aside.contains(e.target))closeMenu();});
const syncActive=()=>nav.querySelectorAll('[data-view]').forEach(button=>button.classList.contains('active')?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current'));
new MutationObserver(syncActive).observe(nav,{attributes:true,attributeFilter:['class'],subtree:true});syncActive();

// Motion remains a browser preference; the OS reduced-motion setting takes priority.
const effectsToggle=document.querySelector('#effects-toggle');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let effectsEnabled=true;try{effectsEnabled=localStorage.getItem('alma-mia-effects')!=='off';}catch{}
const runningAnimations=new Set();let pointerFrame=0;
function effectsActive(){return root.dataset.design==='modern'&&effectsEnabled&&!reducedMotion.matches;}
function updateEffects(){
 root.dataset.effects=effectsActive()?'on':'off';
 effectsToggle.disabled=reducedMotion.matches;
 effectsToggle.setAttribute('aria-pressed',String(effectsEnabled&&!reducedMotion.matches));
 effectsToggle.textContent=reducedMotion.matches?'Efectos: movimiento reducido':effectsEnabled?'Efectos visuales: activados':'Efectos visuales: desactivados';
 effectsToggle.title=reducedMotion.matches?'Tu dispositivo tiene activada la preferencia de reducir movimiento.':'Activar o desactivar los efectos visuales de este navegador';
 if(!effectsActive()){for(const animation of runningAnimations)animation.cancel();runningAnimations.clear();}
}
function animateElement(element,frames,options){if(!effectsActive()||!element?.animate||document.body.classList.contains('access-locked'))return;const animation=element.animate(frames,options);runningAnimations.add(animation);const clean=()=>runningAnimations.delete(animation);animation.addEventListener('finish',clean,{once:true});animation.addEventListener('cancel',clean,{once:true});}
effectsToggle.addEventListener('click',()=>{effectsEnabled=!effectsEnabled;try{localStorage.setItem('alma-mia-effects',effectsEnabled?'on':'off');}catch{}updateEffects();});
reducedMotion.addEventListener('change',updateEffects);updateEffects();
document.addEventListener('alma:view-change',()=>{for(const animation of runningAnimations)animation.cancel();runningAnimations.clear();animateElement(document.querySelector('#content'),[{opacity:.55,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:210,easing:'cubic-bezier(.2,.7,.2,1)'});});
nav.addEventListener('pointermove',event=>{if(!effectsActive()||event.pointerType!=='mouse')return;const button=event.target.closest('button');if(!button)return;cancelAnimationFrame(pointerFrame);pointerFrame=requestAnimationFrame(()=>{if(!effectsActive())return;const box=button.getBoundingClientRect();button.style.setProperty('--pointer-x',`${event.clientX-box.left}px`);button.style.setProperty('--pointer-y',`${event.clientY-box.top}px`);});});
nav.addEventListener('pointerleave',()=>{cancelAnimationFrame(pointerFrame);});
for(const dialog of document.querySelectorAll('dialog'))new MutationObserver(()=>{if(dialog.open)animateElement(dialog,[{opacity:.65,transform:'translateY(9px) scale(.99)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:180,easing:'ease-out'});}).observe(dialog,{attributes:true,attributeFilter:['open']});
const toast=document.querySelector('#toast');new MutationObserver(()=>{if(toast.style.display==='block')animateElement(toast,[{opacity:.2,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:180,easing:'ease-out'});}).observe(toast,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style','data-kind']});
const busyObserver=new MutationObserver(()=>{for(const button of document.querySelectorAll('#content button,dialog button')){const busy=button.disabled&&/^(Generando|Procesando|Guardando|Leyendo|Importando|Cargando)(?:\s|[.…])/i.test(button.textContent.trim());if(busy)button.setAttribute('aria-busy','true');else if(button.hasAttribute('aria-busy'))button.removeAttribute('aria-busy');}});for(const region of document.querySelectorAll('main,dialog'))busyObserver.observe(region,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});

update();
