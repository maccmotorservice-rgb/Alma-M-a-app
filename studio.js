/* Éter / V3. Presentation and navigation only; business actions stay in the app. */
(() => {
 const root = document.documentElement, aside = document.querySelector('aside'), nav = document.querySelector('#main-navigation');
 if (!aside || !nav) return;
 const groups = {inventory:['materials','ready','print-stock'],production:['batches','sales-new'],sales:['sales','sales-report','customers'],purchases:['material-report','quote-comparator'],design:['strip-designer','label-designer'],print:['labels','strips'],catalog:['catalog','catalog-editor'],system:['cloud','history']};
 const names = {'area-inventory':'Inventario','area-production':'Producción','area-sales':'Ventas','area-purchases':'Compras','area-design':'Diseño','area-print':'Imprimir','area-catalog':'Catálogo','print-stock':'Stock de tiras y etiquetas','sales-new':'Generar nota de venta','label-designer':'Diseñar etiquetas · Pendiente','catalog-editor':'Editar o descargar catálogo','quote-comparator':'Comparador de cotizaciones',overview: 'Resumen', materials: 'Materia prima', ready: 'Producto terminado', batches: 'Producción', sales: 'Notas de venta', customers: 'Clientes', catalog: 'Guía olfativa', labels: 'Imprimir etiquetas', strips: 'Imprimir tiras', 'strip-designer': 'Crear tiras', cloud: 'Conexión', history: 'Movimientos', dictation: 'Dictar materias primas', 'stock-dictation': 'Dictar producto', 'material-report': 'Reporte de reposición', 'sales-report': 'Reporte de ventas', scanner: 'Escanear stock'};
 const descriptions = {'quote-comparator':'Cotización del proveedor, prioridades y ahorro.',overview: 'Inventario, ventas y producción.', materials: 'Insumos, frascos y reposición.', ready: 'Existencias por perfume y presentación.', batches: 'Lotes, pedidos y avances.', sales: 'Documentos, pagos y saldos.', customers: 'Registro y datos de contacto.', catalog: 'Fragancias, referencias y aromas.', labels: 'Selección y generación de pliegos.', strips: 'Biblioteca compartida y PDF en tabloide.', 'strip-designer': 'Diseño de tiras por perfume y presentación.', cloud: 'Conexión y sincronización.', history: 'Historial de operaciones por usuario.'};
 const sideOrder = {overview:1,materials:11,ready:12,'print-stock':13,batches:21,'sales-new':22,sales:31,'sales-report':32,customers:33,'material-report':41,'quote-comparator':42,'strip-designer':51,'label-designer':52,labels:61,strips:62,catalog:71,'catalog-editor':72,history:81,cloud:82};
 const icon = route => nav.querySelector(`[data-view="${route}"] .nav-icon`)?.outerHTML ?? '';
 const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>';
 for (const button of nav.querySelectorAll('[data-view]')) {
  button.dataset.studioGroup = Object.keys(groups).find(key => groups[key].includes(button.dataset.view)) ?? 'overview';
  button.style.setProperty('--studio-nav-order', sideOrder[button.dataset.view]);
  const description = document.createElement('small');
  description.className = 'studio-nav-description';description.textContent = descriptions[button.dataset.view] ?? '';button.append(description);
 }
 for (const [order, label] of [[10,'INVENTARIO'],[20,'PRODUCCIÓN'],[30,'VENTAS'],[40,'COMPRAS'],[50,'DISEÑO'],[60,'IMPRIMIR'],[70,'CATÁLOGO'],[80,'MÁS']]) {
  const section = document.createElement('div');section.className = 'studio-nav-section studio-only';section.style.order = order;section.textContent = label;nav.append(section);
 }
 // Retained as a compatibility presentation; direct sidebar links are used in V3.
 const macro = document.createElement('div');macro.className = 'studio-macro studio-only';macro.setAttribute('role', 'group');macro.setAttribute('aria-label', 'Áreas de trabajo');
 macro.innerHTML = '<button type="button" data-view="overview" data-studio-route="overview">Inicio</button>' + [['inventory','Inventario'],['production','Producción'],['sales','Ventas'],['purchases','Compras'],['design','Diseño'],['print','Imprimir'],['catalog','Catálogo']].map(([key,label])=>`<button type="button" data-view="area-${key}">${label}</button>`).join('');
 aside.insertBefore(macro, document.querySelector('#navigation-toggle'));
 const signature = document.createElement('span');signature.className = 'studio-signature studio-only';signature.innerHTML = '<span aria-hidden="true"></span> PORTAL INTERNO';aside.querySelector('.brand').after(signature);
 const trail = document.createElement('div');trail.className = 'studio-trail studio-only';trail.innerHTML = '<span>Mi espacio</span><i aria-hidden="true">/</i><strong>Resumen</strong>';document.querySelector('.interaction-toolbar').prepend(trail);
 const dock = document.createElement('nav');dock.className = 'studio-dock studio-only';dock.setAttribute('aria-label', 'Accesos principales');
 dock.innerHTML = [['overview', 'Inicio'], ['ready', 'Stock'], ['batches', 'Producir'], ['sales', 'Ventas']].map(([route, label]) => `<button type="button" data-view="${route}" data-dock-view="${route}">${icon(route)}<span>${label}</span></button>`).join('') + '<button type="button" data-studio-search aria-label="Buscar herramienta"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><span>Buscar</span></button>';document.body.append(dock);
 let view = 'overview';
 new ResizeObserver(() => {if (['3','4'].includes(root.dataset.version)) aside.style.setProperty('--studio-panel-height', nav.getBoundingClientRect().height + 'px');}).observe(nav);
 function syncNavigation() {
  const parent = {dictation: 'materials', 'material-report': 'materials', scanner: 'ready', 'stock-dictation': 'ready', 'sales-report': 'sales'}[view] ?? view;
  const group = Object.keys(groups).find(key => groups[key].includes(parent)) ?? 'overview';
  macro.querySelectorAll('button').forEach(button => {
   button.toggleAttribute('data-current', button.dataset.navCategory === group || button.dataset.studioRoute === parent);
   button.setAttribute('aria-expanded', 'false');
  });
  dock.querySelectorAll('[data-dock-view]').forEach(button => {
   const active = button.dataset.dockView === parent;button.toggleAttribute('data-current', active);
   if (active) button.setAttribute('aria-current', 'page');else button.removeAttribute('aria-current');
  });
  trail.querySelector('strong').textContent = names[view] ?? 'Panel de control';root.dataset.workspace = view;
  for (const button of nav.querySelectorAll('[data-studio-hidden]')) button.removeAttribute('data-studio-hidden');
 }
 function openRoute(route) {
  const target = nav.querySelector(`[data-view="${route}"]`);
  if (target) {target.click();return;}
  const button = document.createElement('button');button.type = 'button';button.dataset.view = route;button.hidden = true;document.body.append(button);button.click();button.remove();
 }
 function newSalesNote() {openRoute('sales');document.querySelector('#sales-new')?.click();}
 document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-studio-print-note],[data-studio-new-note]')) {newSalesNote();return;}
  if (event.target.closest('[data-studio-search]')) document.querySelector('#quick-open')?.click();
  const metric = event.target.closest('[data-studio-metric-route]');
  if (metric && ['3','4'].includes(root.dataset.version)) openRoute(metric.dataset.studioMetricRoute);
 });
 document.addEventListener('keydown', event => {
  if (!(event.target instanceof Element)) return;
  const metric = event.target.closest('[data-studio-metric-route]');
  if (['3','4'].includes(root.dataset.version) && metric && ['Enter', ' '].includes(event.key)) {event.preventDefault();metric.click();}
 });
 function decorateMetrics(content) {
  const routes = ['materials', 'ready', 'ready', 'material-report'];
  content.querySelectorAll(':scope > .stats > .card').forEach((card, index) => {
   if (!routes[index]) return;
   card.dataset.studioMetricRoute = routes[index];
   if (!card.querySelector('.studio-metric-arrow')) card.insertAdjacentHTML('beforeend', `<span class="studio-metric-arrow studio-only">${arrow}</span>`);
   if (['3','4'].includes(root.dataset.version)) {card.setAttribute('role', 'button');card.tabIndex = 0;card.setAttribute('aria-label', card.querySelector('.stat-label').textContent + ': ' + card.querySelector('.number').textContent.trim() + '. Ver detalle');}
   else {card.removeAttribute('role');card.removeAttribute('tabindex');card.removeAttribute('aria-label');}
  });
 }
 function decorate() {
  const content = document.querySelector('#content');if (!content || document.body.classList.contains('access-locked')) return;
  if (view === 'overview') {
   if (!content.querySelector('.studio-overview-heading')) {
    const intro = document.createElement('section');intro.className = 'studio-overview-heading studio-only';
    const name = document.querySelector('#session-user')?.value || 'Alma Mía';
    const hour = Number(new Intl.DateTimeFormat('en', {timeZone: 'America/Guatemala', hour: 'numeric', hourCycle: 'h23'}).format(new Date()));
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const salute = document.createElement('p');salute.className = 'studio-salute';salute.textContent = `${greeting}, ${name}.`;intro.append(salute);
    intro.insertAdjacentHTML('beforeend', '<div class="studio-heading-main"><div><h1>Centro de control<span aria-hidden="true">.</span></h1><p>Inventario, producción y ventas en un solo lugar.</p></div><div class="studio-heading-actions"><button type="button" class="secondary" data-view="sales-report">Ver reportes</button><button type="button" class="primary" data-studio-new-note><span aria-hidden="true">＋</span> Nueva nota</button></div></div>');content.prepend(intro);
    const launcher = document.createElement('section');launcher.className = 'studio-launchpad studio-only';launcher.setAttribute('aria-label', 'Acciones rápidas');
    launcher.innerHTML = '<div class="studio-section-cap"><span>ACCESOS RÁPIDOS</span><span aria-hidden="true">↗</span></div><h2>Tu operación, a un clic</h2><div class="studio-launch-grid">' + [['ready', 'Stock de producto', 'Consultar 50 y 100 ml.', 'ready'], ['materials', 'Materias primas', 'Frascos y reposición.', 'materials'], ['sales', 'Notas de venta', 'Consultar notas y abonos.', 'sales'], ['sales-report', 'Reporte de ventas', 'Ingresos y productos vendidos.', 'history']].map(([route, label, description, source]) => `<button type="button" data-view="${route}"><span class="studio-launch-icon">${icon(source)}</span><span><strong>${label}</strong><small>${description}</small></span>${arrow}</button>`).join('') + '</div>';
    content.querySelector('.hero')?.after(launcher);
    const hero = content.querySelector('.hero');
    if (hero) {
     hero.querySelector('h2')?.insertAdjacentHTML('beforebegin', '<span class="studio-hero-label studio-only">PRODUCCIÓN</span>');
     hero.insertAdjacentHTML('beforeend', `<div class="studio-production-visual studio-only" aria-hidden="true"><span class="studio-orbit-ring"></span><span class="studio-orbit-ring ring-two"></span><span class="studio-orbit-ring ring-three"></span><span class="studio-core"><span class="studio-core-mark">${icon('batches')}</span></span><i class="studio-orbit-node node-one"></i><i class="studio-orbit-node node-two"></i><i class="studio-orbit-node node-three"></i></div>`);
    }
   }
   decorateMetrics(content);
  }
  syncNavigation();
 }
 document.addEventListener('alma:render', event => {view = event.detail.view;decorate();});
 document.addEventListener('alma:view-change', event => {view = event.detail.view;decorate();});
 document.addEventListener('alma:design-change', () => {root.removeAttribute('data-nav-category');aside.removeAttribute('data-menu-open');decorate();});
 decorate();
})();
