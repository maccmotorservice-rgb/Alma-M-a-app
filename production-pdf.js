import {completedQuantity,recipeFor} from './inventory.js?v=64';

const GROUPS=['Dama','Caballero','Unisex'];
const ZONE='America/Guatemala';
const formatNumber=value=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(value);
const formatDate=value=>new Intl.DateTimeFormat('es-MX',{timeZone:ZONE,dateStyle:'long',timeStyle:'short'}).format(new Date(value));
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();

// A print snapshot is derived from the displayed order, never from live stock.
export function productionPdfData(batch,{draft=false}={}){
 if(!batch||typeof batch!=='object'||!Array.isArray(batch.items)||!batch.items.length)throw Error('No hay una lista de producción para descargar.');
 if(!Number.isSafeInteger(batch.number)||batch.number<1||!Number.isFinite(Date.parse(batch.date))||!['stock','customer'].includes(batch.purpose?.type))throw Error('Revisa los datos de la orden antes de generar el PDF.');
 const rows=batch.items.map(item=>{
  const completed=completedQuantity(item);
  if(!clean(item.name)||![50,100].includes(item.size)||!Number.isSafeInteger(item.qty)||item.qty<1||!Number.isSafeInteger(completed)||completed<0||completed>item.qty)throw Error('La lista contiene cantidades de producción inválidas.');
  return {name:clean(item.name),reference:clean(item.displayReference??item.reference),line:clean(item.line),category:clean(item.category)||'Sin categoría',size:item.size,qty:item.qty,completed,pending:item.qty-completed};
 });
 const totals=rows.reduce((sum,row)=>{const formula=recipeFor(row.size);return {qty:sum.qty+row.qty,completed:sum.completed+row.completed,pending:sum.pending+row.pending,volumeMl:sum.volumeMl+row.qty*row.size,essenceMl:sum.essenceMl+row.qty*formula.essence,fixativeMl:sum.fixativeMl+row.qty*formula.fixative,alcoholMl:sum.alcoholMl+row.qty*formula.alcohol};},{qty:0,completed:0,pending:0,volumeMl:0,essenceMl:0,fixativeMl:0,alcoholMl:0});
 const cancelled=batch.status==='cancelled';
 const categories=[...GROUPS,...new Set(rows.map(row=>row.category).filter(category=>!GROUPS.includes(category)))];
 const data={
  number:'AM-'+String(batch.number).padStart(4,'0'),date:batch.date,dateLabel:formatDate(batch.date),draft:Boolean(draft),
  purpose:batch.purpose.type==='customer'?'Pedido · '+clean(batch.purpose.customerName):'Producción para stock',createdBy:clean(batch.createdBy),
  status:draft?'Borrador · Pendiente de confirmación':cancelled?'Cancelado':totals.pending?'En producción':batch.purpose.type==='customer'?'Listo para entrega':'Listo para anaquel',
  cancelled,groups:categories.map(category=>({category,items:rows.filter(row=>row.category===category)})).filter(group=>group.items.length),totals
 };
 if(cancelled)data.cancellation={reason:clean(batch.cancellationReason)||'Sin motivo registrado',by:clean(batch.cancelledBy),date:Number.isFinite(Date.parse(batch.cancelledAt))?formatDate(batch.cancelledAt):'',reversedUnits:Number.isSafeInteger(batch.cancellationReversedUnits)?batch.cancellationReversedUnits:0};
 return data;
}

export function productionPdfFilename(batch,{draft=false}={}){
 if(!Number.isSafeInteger(batch?.number)||batch.number<1)throw Error('La orden no tiene un número válido.');
 return `Alma-Mia-Lista-Produccion-AM-${String(batch.number).padStart(4,'0')}${draft?'-Borrador':''}.pdf`;
}

export async function createProductionPdf(batch,{draft=false,logo=true,now=new Date()}={}){
 const data=productionPdfData(batch,{draft}),{jsPDF,autoTable}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true}),margin=15,right=195,bodyWidth=180;
 doc.setProperties({title:`Lista de producción ${data.number}${draft?' · Borrador':''}`,author:'Alma Mía Perfumes',subject:data.purpose});
 let image=null;
 if(logo){const response=await fetch('./assets/logo.png');if(!response.ok)throw Error('No se pudo cargar el logotipo para el PDF.');image=new Uint8Array(await response.arrayBuffer());}
 const text=(value,x,y,size=10,bold=false,color=35)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);doc.text(String(value),x,y);};
 const table=(head,body,startY,extra={})=>autoTable(doc,{startY,head,body,theme:'grid',margin:{top:20,left:margin,right:margin,bottom:21},styles:{font:'helvetica',fontSize:8.5,cellPadding:3,textColor:35,lineColor:218,lineWidth:.15,overflow:'linebreak'},headStyles:{fillColor:[235,238,237],textColor:35,fontStyle:'bold'},rowPageBreak:'avoid',...extra});
 if(image)doc.addImage(image,'PNG',margin,16,43,10.25);else text('Alma Mía',margin,25,23,true);
 doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(35);doc.text('LISTA DE PRODUCCIÓN',right,21,{align:'right'});
 doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(data.number,right,28,{align:'right'});
 let y=40;
 table([['ORDEN','FECHA Y HORA (GUATEMALA)']],[[data.number,data.dateLabel]],y,{columnStyles:{0:{cellWidth:46},1:{cellWidth:134}}});
 y=doc.lastAutoTable.finalY+5;
 table([['DESTINO','ESTADO']],[[data.purpose,data.status]],y,{columnStyles:{0:{cellWidth:112},1:{cellWidth:68}}});
 y=doc.lastAutoTable.finalY+5;
 if(data.createdBy){text((draft?'Preparado por: ':'Creado por: ')+data.createdBy,margin,y+3,9);y+=10;}
 if(data.cancelled){
  const c=data.cancellation,info=[c.reason,[c.by,c.date].filter(Boolean).join(' · '),c.reversedUnits?'Unidades de prueba revertidas: '+c.reversedUnits:''].filter(Boolean).join('\n');
  table([['MOTIVO DE CANCELACIÓN']],[[info]],y,{headStyles:{fillColor:[247,230,227],textColor:[122,44,36]}});y=doc.lastAutoTable.finalY+9;
 }
 const pendingLabel=data.cancelled?'Sin producir':'Pendientes';
 for(const group of data.groups){
  if(y>242){doc.addPage();y=23;}
  text(group.category,margin,y+2,11,true);
  table([['Perfume e inspiración','Presentación','Envases','Terminados',pendingLabel]],group.items.map(item=>[[item.name,item.reference?'Inspirado en '+item.reference:'',item.line].filter(Boolean).join('\n'),item.size+' ml',String(item.qty),String(item.completed),String(item.pending)]),y+6,{headStyles:{fillColor:[235,238,237],textColor:35,fontStyle:'bold',fontSize:8,cellPadding:2},columnStyles:{0:{cellWidth:94},1:{cellWidth:25,halign:'center'},2:{cellWidth:19,halign:'right'},3:{cellWidth:21,halign:'right'},4:{cellWidth:21,halign:'right'}}});
  y=doc.lastAutoTable.finalY+11;
 }
 if(y>222){doc.addPage();y=23;}
 text('Resumen de la orden',margin,y+2,12,true);
 table([['Envases planificados','Terminados',pendingLabel]],[[formatNumber(data.totals.qty),formatNumber(data.totals.completed),formatNumber(data.totals.pending)]],y+6,{styles:{fontSize:10,cellPadding:4},columnStyles:{0:{cellWidth:72},1:{cellWidth:54},2:{cellWidth:54}}});
 y=doc.lastAutoTable.finalY+8;
 if(y>233){doc.addPage();y=23;}
 text('Materia prima planificada',margin,y+2,11,true);
 table([['Esencia','Galaxolide','Alcohol','Volumen total']],[[data.totals.essenceMl+' ml',data.totals.fixativeMl+' ml',data.totals.alcoholMl+' ml',data.totals.volumeMl+' ml']],y+6,{columnStyles:{0:{cellWidth:45},1:{cellWidth:45},2:{cellWidth:45},3:{cellWidth:45}}});
 y=doc.lastAutoTable.finalY+7;
 const note='Estas cantidades corresponden a la orden completa. Descargar esta lista no registra avances ni descuenta materias primas.';
 doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text(doc.splitTextToSize(note,bodyWidth),margin,y);
 const pages=doc.getNumberOfPages(),exported=formatDate(now);
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setDrawColor(210);doc.line(margin,280,right,280);
  text(`Alma Mía · ${data.number}${draft?' · Borrador':''}`,margin,286,8,false,100);
  doc.setFontSize(8);doc.text(`${page} / ${pages}`,right,286,{align:'right'});
  doc.setFontSize(7);doc.text('Exportado: '+exported+' · Guatemala',margin,291);
 }
 return {blob:doc.output('blob'),filename:productionPdfFilename(batch,{draft}),pages,data};
}
