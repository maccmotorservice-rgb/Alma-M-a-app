import {salesMoney,salesGroups,salesDate,salesCapacity,salesFilename,salesPaymentSummary} from './sales.js?v=23';
export async function createSalesPdf(note,{logo=true}={}){
 const {jsPDF,autoTable}=await import('./assets/pdf-client.js');const doc=new jsPDF({unit:'mm',format:'a4'}),margin=16,width=178;
 doc.setProperties({title:`Nota de venta · ${note.customer}`,author:'Alma Mía Perfumes',subject:'Nota de venta'});
 let image=null;if(logo){const response=await fetch('./assets/logo.png');if(!response.ok)throw Error('No se pudo cargar el logotipo para el PDF.');image=new Uint8Array(await response.arrayBuffer());}
 const text=(s,x,y,size=10,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(25);doc.text(String(s),x,y);};
 const table=(head,body,startY,extra={})=>autoTable(doc,{startY,head,body,theme:'grid',margin:{left:margin,right:margin,top:18,bottom:20},styles:{font:'helvetica',fontSize:9,cellPadding:3,lineColor:190,lineWidth:.15,textColor:25,overflow:'linebreak'},headStyles:{fillColor:[230,230,230],textColor:25,fontStyle:'bold'},...extra});
 doc.setDrawColor(180);doc.line(margin,15,194,15);
 if(image)doc.addImage(image,'PNG',margin,25,42,10);else text('Alma Mía',margin,32,23,true);
 text('PERFUMES',margin,39,8,true);if(note.status==='cancelled')text('CANCELADA · '+note.cancelledBy+' · '+new Date(note.cancelledAt).toLocaleDateString('es-MX'),margin,45,9,true);text('NOTA DE VENTA',143,32,15,true);
 table([['CLIENTE','FECHA','CAPACIDAD']],[[note.customer,salesDate(note.date),salesCapacity(note)]],49,{columnStyles:{0:{cellWidth:76},1:{cellWidth:56},2:{cellWidth:46}}});
 let y=doc.lastAutoTable.finalY+10;text('Resumen del pedido',margin,y,12,true);
 const groups=salesGroups(note);table([['Categoría','Piezas','Subtotal']],[...groups.map(g=>[g.category,String(g.pieces),salesMoney(g.subtotalCents)]),['TOTAL',String(note.totals.pieces),salesMoney(note.totals.subtotalCents)]],y+4,{columnStyles:{0:{cellWidth:118},1:{cellWidth:24,halign:'right'},2:{cellWidth:36,halign:'right'}},didParseCell:d=>{if(d.section==='body'&&d.row.index===groups.length){d.cell.styles.fontStyle='bold';d.cell.styles.fillColor=[242,242,242]}}});
 y=doc.lastAutoTable.finalY+9;if(y+46>275){doc.addPage();y=22;}
 doc.setFillColor(248);doc.setDrawColor(190);doc.rect(margin,y,width,31,'FD');text('TOTAL DE PIEZAS',margin+3,y+10,9,true);text(note.totals.pieces,margin+3,y+23,16,true);
 doc.setFontSize(9);doc.setFont('helvetica','bold');doc.text('TOTAL A PAGAR',190,y+9,{align:'right'});
 if(note.discountPercent>0){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`Incluye ${note.discountPercent}% de descuento.`,190,y+16,{align:'right'});}
 doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(salesMoney(note.totals.totalCents)+' MXN',190,y+25,{align:'right'});
 if(note.discountPercent>0){text(`Subtotal: ${salesMoney(note.totals.subtotalCents)}. Descuento: ${salesMoney(note.totals.discountCents)}. Total: ${salesMoney(note.totals.totalCents)}.`,margin,y+39,9);}
 const payment=salesPaymentSummary(note),paymentType=note.paymentType==='credit'?'Crédito':note.paymentType==='cash'?'Contado':'Por definir';
 let paymentY=y+(note.discountPercent>0?47:39);if(paymentY+25>275){doc.addPage();paymentY=22;}
 table([['TIPO DE PAGO','IMPORTE PAGADO','SALDO PENDIENTE','ESTADO']],[[paymentType,payment.type?salesMoney(payment.paidCents):'—',payment.type?salesMoney(payment.balanceCents):'—',note.status==='cancelled'?'Cancelada':payment.label]],paymentY,{styles:{fontSize:8,cellPadding:3}});
 if(note.status==='cancelled')table([['MOTIVO DE CANCELACIÓN']],[[note.cancellationReason||'Sin motivo registrado']],doc.lastAutoTable.finalY+5);
 doc.addPage();y=22;
 for(const group of groups){if(y+30>270){doc.addPage();y=22;}text(group.category,margin,y,11,true);
 table([['Perfume Alma Mía','Perfume real / inspirado en','Cap.','Cant.','P. unitario','Total']],[...group.items.map(i=>[i.name,i.reference||'—',i.size?i.size+' ml':'—',String(i.qty),salesMoney(i.unitCents),salesMoney(i.unitCents*i.qty)]),['Subtotal','','',String(group.pieces),'',salesMoney(group.subtotalCents)]],y+4,{rowPageBreak:'avoid',columnStyles:{0:{cellWidth:38},1:{cellWidth:58},2:{cellWidth:18},3:{cellWidth:14,halign:'right'},4:{cellWidth:25,halign:'right'},5:{cellWidth:25,halign:'right'}},styles:{font:'helvetica',fontSize:8,cellPadding:2.5,lineColor:190,lineWidth:.15,textColor:25},didParseCell:d=>{if(d.section==='body'&&d.row.index===group.items.length){d.cell.styles.fillColor=[245,245,245];d.cell.styles.fontStyle='bold';}}});y=doc.lastAutoTable.finalY+12;
 }
 if(y+33>275){doc.addPage();y=22;}
 table([],[[ 'TOTAL GENERAL',note.totals.pieces+' piezas',salesMoney(note.totals.totalCents)+' MXN']],y,{columnStyles:{0:{cellWidth:80},1:{cellWidth:40},2:{cellWidth:58,halign:'right'}},styles:{fillColor:[242,242,242],fontStyle:'bold',fontSize:11,cellPadding:4}});
 if(note.discountPercent>0)text(`Subtotal ${salesMoney(note.totals.subtotalCents)} - descuento ${note.discountPercent}% (${salesMoney(note.totals.discountCents)}) = ${salesMoney(note.totals.totalCents)}.`,margin,doc.lastAutoTable.finalY+9,9);
 if((note.payments??[]).length){y=doc.lastAutoTable.finalY+(note.discountPercent>0?20:12);if(y+30>272){doc.addPage();y=22;}text('Historial de abonos',margin,y,11,true);table([['Fecha del abono','Importe','Usuario','Fecha de registro']],note.payments.map(p=>[salesDate(p.date),salesMoney(p.amountCents),p.recordedBy,new Date(p.recordedAt).toLocaleString('es-MX')]),y+4,{columnStyles:{0:{cellWidth:47},1:{cellWidth:30,halign:'right'},2:{cellWidth:30},3:{cellWidth:71}}});}
 const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);if(note.status==='cancelled'){doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(170,45,35);doc.text('CANCELADA · Documento sin vigencia',105,278,{align:'center'});}doc.setDrawColor(190);doc.line(margin,282,194,282);doc.setTextColor(110);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Alma Mía Perfumes | Nota de venta',margin,287);doc.text(`Página ${p}`,194,287,{align:'right'});}
 return doc;
}
export async function downloadSalesPdf(note){const doc=await createSalesPdf(note);doc.save(salesFilename(note));}
