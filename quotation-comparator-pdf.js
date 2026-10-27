import {quoteStatuses,quotationBriefSummary,compareRequestedQuotation} from './quotation-comparator.js?v=86';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export async function createComparisonPdf({document:source,analysis,currency,provider='',comparison=null,reviewed=false,catalog=[],now=new Date()}){
 if(!source?.pages?.length||!analysis?.rows?.length)throw Error('Carga la cotización del proveedor antes de preparar el PDF.');
 const {jsPDF}=await import('./assets/pdf-client.js'),doc=new jsPDF({unit:'mm',format:'a4'}),cash=cents=>currency?new Intl.NumberFormat('es-MX',{style:'currency',currency}).format(cents/100)+' '+currency:(cents/100).toFixed(2),date=new Intl.DateTimeFormat('es-MX',{timeZone:'America/Guatemala',dateStyle:'medium',timeStyle:'short'}).format(now);
 doc.setProperties({title:'Comparador de cotizaciones',subject:'Copia comentada; el original se conserva intacto'});
 for(const [index,page] of source.pages.entries()){
  if(index)doc.addPage();doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(30);doc.text('Cotización del proveedor · Copia comentada',14,14);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(doc.splitTextToSize(source.name,180).slice(0,1),14,20);
  let x=14;for(const [key,text] of [['missing','Rojo: agotada'],['low','Naranja: por agotarse'],['available','Amarillo: con existencias'],['outside','Morado: fuera / por identificar']]){doc.setFillColor(...rgb(quoteStatuses[key].color));doc.circle(x,26,1.3,'F');doc.setTextColor(35);doc.text(text,x+3,27);x+=key==='low'?51:key==='outside'?55:43;}
  const scale=Math.min(170/page.width,248/page.height),w=page.width*scale,h=page.height*scale,top=34;doc.addImage(page.image,'JPEG',28,top,w,h,undefined,'FAST');
  analysis.rows.forEach((row,i)=>{if(row.page!==page.page)return;const y=top+Math.max(0,Math.min(1,row.y))*h;doc.setFillColor(...rgb(quoteStatuses[row.status].color));doc.circle(16,y,1.7,'F');doc.setFontSize(7);doc.setTextColor(35);doc.text(String(row.supplierNumber??i+1),20,y+1);});
  doc.setFontSize(8);doc.setTextColor(70);doc.text('Puntos de inventario al margen. Resumen debajo del documento. Original sin cambios.',14,290);
 }
 doc.addPage();let y=20;doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(30);doc.text('Resumen de la comparación',14,y);y+=9;
 doc.setFont('helvetica','normal');doc.setFontSize(9);
 const paragraphs=[provider&&'Proveedor: '+provider,'Revisado: '+date,...quotationBriefSummary(analysis,comparison??compareRequestedQuotation(analysis.rows,null,[]),catalog.length?catalog:analysis.rows.map(r=>r.product).filter(Boolean),{cash,reviewed:reviewed&&!!currency})].filter(Boolean);
 for(const paragraph of paragraphs){const lines=doc.splitTextToSize(paragraph,180);for(const line of lines){if(y>276){doc.addPage();y=22;}doc.text(line,14,y);y+=4.6;}y+=4;}
 const pages=doc.getNumberOfPages();for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFontSize(8);doc.setTextColor(70);doc.text(`${n} / ${pages}`,196,290,{align:'right'});}
 return {blob:doc.output('blob'),filename:'Comparacion-Cotizacion-'+now.toISOString().slice(0,10)+'.pdf',pages};
}
