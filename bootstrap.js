// Keep the access screen usable even if an application module cannot load.
(function(){
 const source=new URL(document.currentScript.src),version=source.searchParams.get('v');
 const moduleUrl=name=>{const url=new URL(name,source);if(version)url.searchParams.set('v',version);return url.href;};
 let ready=false;
 function showFailure(message,error){
  if(ready||!document.body.classList.contains('access-locked'))return;
  const screen=document.getElementById('access-screen');if(!screen)return;
  const card=document.createElement('div');card.className='access-card';
  const logo=document.createElement('img');logo.src=new URL('./assets/logo.png',source).href;logo.alt='Alma Mía';
  const title=document.createElement('h1');title.textContent='Acceso privado';
  const text=document.createElement('p');text.setAttribute('role','alert');text.textContent=message;
  const retry=document.createElement('button');retry.type='button';retry.className='primary';retry.textContent='Volver a cargar el portal';retry.onclick=()=>location.reload();
  card.append(logo,title,text,retry);
  if(error){const details=document.createElement('details'),summary=document.createElement('summary'),description=document.createElement('p');summary.textContent='Ver detalle del error';description.textContent=String(error.message||error).slice(0,500);details.append(summary,description);card.append(details);}
  screen.replaceChildren(card);screen.hidden=false;
 }
 const timer=setTimeout(()=>showFailure('La carga está tardando demasiado. Comprueba tu conexión y vuelve a cargar el portal.'),18000);
 import(moduleUrl('./app.js')).then(entry=>entry.portalReady).then(()=>{ready=true;clearTimeout(timer);},error=>{clearTimeout(timer);showFailure('No se pudo cargar el portal. Comprueba tu conexión y vuelve a intentarlo.',error);});
 // Welcome and PDF helpers must not prevent access to the business application.
 import(moduleUrl('./welcome.js')).catch(()=>{});
 import(moduleUrl('./portal-tools.js')).catch(()=>{});
})();
