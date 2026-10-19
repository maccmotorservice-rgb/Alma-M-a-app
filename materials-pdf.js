import {isMaterialLow,extraBottles,bottleStock} from './inventory.js?v=49';
export async function downloadMaterialsPdf(state,catalog){
 const {jsPDF,autoTable}=await import('./assets/pdf-client.js');
 const doc=new jsPDF({unit:'mm',format:'a4'}),margin=16,now=new Date(),zone='America/Guatemala';
 const number=n=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
 const date=new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'long',timeStyle:'short'}).format(now);
 doc.setProperties({title:'Reporte de reposición · Alma Mía',author:'Alma Mía Perfumes'});
 doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(65,43,27);doc.text('Alma Mía',margin,22);
 doc.setFontSize(14);doc.text('Reporte de materias primas',margin,32);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(80);doc.text(date+' (Guatemala)',margin,40);
 const missing=state.materials.filter(m=>m.stock===0),low=state.materials.filter(isMaterialLow).sort((a,b)=>a.stock-b.stock);
 doc.text(`Faltantes: ${missing.length}   |   Por terminar: ${low.length}`,margin,48);
 let y=59;
 const name=m=>{const p=m.kind==='Esencia'?catalog.find(p=>p.id===m.id.slice(4)):null;return m.name+(p?'\nInspirado en '+(p.displayReference??p.reference):'');};
 const amount=m=>{if(m.stock===0)return '0 ml';if(m.id==='alcohol')return `${number(m.stock/(state.unitSettings?.gallonMl||4000))} galones\n${number(m.stock)} ml`;if(m.kind!=='Esencia')return number(m.stock)+' ml';const bottles=[{number:1,stock:bottleStock(m,1),capacity:250},...extraBottles(m)].filter(b=>b.stock>0);return `${number(m.stock)} ml en total\n`+bottles.map(b=>`Frasco ${b.number}: ${number(b.stock)} ml (${number(b.stock/b.capacity*4)}/4)`).join('\n');};
 for(const [title,items,empty] of [['Insumos faltantes',missing,'No hay insumos faltantes.'],['Insumos por terminar',low,'No hay insumos por terminar.']]){
  if(y>250){doc.addPage();y=22;}
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(40);doc.text(title,margin,y);
  if(items.length){autoTable(doc,{startY:y+5,head:[['Insumo','Existencias']],body:items.map(m=>[name(m),amount(m)]),theme:'striped',margin:{left:margin,right:margin,top:18,bottom:18},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:40},headStyles:{fillColor:[239,234,225],textColor:50},columnStyles:{0:{cellWidth:112},1:{cellWidth:66}},rowPageBreak:'avoid'});y=doc.lastAutoTable.finalY+14;}
  else{doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(empty,margin,y+9);y+=24;}
 }
 const count=doc.getNumberOfPages();for(let page=1;page<=count;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Alma Mía · Reporte de reposición',margin,287);doc.text(`${page} / ${count}`,194,287,{align:'right'});}
 const filenameDate=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 doc.save(`Alma-Mia-Reporte-Materias-Primas-${filenameDate}.pdf`);
}
