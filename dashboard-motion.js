// One owner for dashboard hover feedback. No background, text or image is changed.
export const dashboardCardSelector=[
 '.card','.hero','.aura-greeting','.aura-metric','.liquid-action',
 '.aura-tool-grid>button','.aura-priorities>button','.aura-tabs>button',
 '.liquid-dashboard-nav>button','.studio-launch-grid>button','.sales-month-button'
].join(',');
export function initDashboardMotion(){
 const root=document.documentElement;let active=null,view=document.querySelector('#content .aura-home')?'overview':'';
 const enabled=()=>root.dataset.design==='modern'&&root.dataset.effects==='on'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 function clear(){active?.classList.remove('dashboard-hover');active=null;}
 function mark(){
  if(!['overview','sales-report'].includes(view))return;
  for(const card of document.querySelectorAll('#content '+dashboardCardSelector.split(',').join(',#content ')))card.setAttribute('data-dashboard-card','');
 }
 function enter(target){const card=target instanceof Element?target.closest('#content [data-dashboard-card]'):null;if(card===active)return;clear();if(card&&enabled()){active=card;active.classList.add('dashboard-hover');}}
 document.addEventListener('pointerover',event=>{if(event.pointerType==='mouse')enter(event.target);});
 document.addEventListener('pointerout',event=>{if(event.pointerType==='mouse')enter(event.relatedTarget);});
 document.addEventListener('pointercancel',clear);
 document.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')clear();},true);
 window.addEventListener('blur',clear);
 document.addEventListener('alma:render',event=>{clear();view=event.detail.view;mark();});
 document.addEventListener('alma:effects-change',()=>{if(!enabled())clear();});
 document.addEventListener('alma:design-change',()=>{clear();mark();});
 mark();
}
