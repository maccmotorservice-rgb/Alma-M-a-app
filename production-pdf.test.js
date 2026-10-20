import test from 'node:test';
import assert from 'node:assert/strict';
import {productionPdfData,productionPdfFilename,createProductionPdf} from './production-pdf.js';

const batch={id:'production-test',number:7,date:'2026-10-20T01:15:00Z',purpose:{type:'customer',customerId:'c1',customerName:'Cliente de prueba'},createdBy:'Ximena',items:[
 {id:'1',name:'Perfume unisex',reference:'Referencia unisex',category:'Unisex',line:'Nicho',size:100,qty:3,completed:1},
 {id:'2',name:'Perfume de dama',reference:'Referencia de dama',category:'Dama',line:'Diseñador',size:50,qty:2,completed:2},
 {id:'3',name:'Perfume de caballero',reference:'Referencia de caballero',category:'Caballero',line:'Diseñador',size:100,qty:1,completed:0}
]};

test('production PDF snapshot preserves category order, both sizes and accurate planned/completed/pending totals',()=>{
 const original=structuredClone(batch),data=productionPdfData(batch);
 assert.deepEqual(batch,original,'export must not change production or inventory');
 assert.deepEqual(data.groups.map(group=>group.category),['Dama','Caballero','Unisex']);
 assert.deepEqual(data.groups.map(group=>group.items.map(item=>[item.size,item.qty,item.completed,item.pending])),[[[50,2,2,0]],[[100,1,0,1]],[[100,3,1,2]]]);
 assert.deepEqual(data.totals,{qty:6,completed:3,pending:3,volumeMl:500,essenceMl:150,fixativeMl:10,alcoholMl:340});
 assert.equal(data.status,'En producción');assert.equal(data.purpose,'Pedido · Cliente de prueba');assert.equal(data.createdBy,'Ximena');
 assert.match(data.dateLabel,/19.*octubre.*2026/,'printed date follows Guatemala rather than UTC');
 data.groups[0].items[0].name='Changed print copy';assert.equal(batch.items[1].name,'Perfume de dama');
});

test('draft, completed, cancelled and legacy orders keep their distinct real production states',()=>{
 const draft=productionPdfData(batch,{draft:true});assert.equal(draft.status,'Borrador · Pendiente de confirmación');
 const complete={...batch,items:batch.items.map(item=>({...item,completed:item.qty}))};
 assert.equal(productionPdfData(complete).status,'Listo para entrega');
 assert.equal(productionPdfData({...complete,purpose:{type:'stock'}}).status,'Listo para anaquel');
 const cancelled=productionPdfData({...batch,status:'cancelled',cancelledBy:'Luis',cancelledAt:'2026-10-20T02:00:00Z',cancellationReason:'Esto fue una prueba',cancellationReversedUnits:3});
 assert.equal(cancelled.status,'Cancelado');assert.equal(cancelled.cancellation.reason,'Esto fue una prueba');assert.equal(cancelled.cancellation.reversedUnits,3);
 assert.equal(cancelled.totals.completed,3,'historical progress stays visible after cancellation');
 assert.equal(productionPdfData({...batch,items:batch.items.map(({completed,...item})=>item)}).totals.completed,0);
 for(const invalid of [{...batch,items:[]},{...batch,date:'invalid'},{...batch,items:[{...batch.items[0],completed:4}]},{...batch,items:[{...batch.items[0],qty:1.5}]}])assert.throws(()=>productionPdfData(invalid));
 assert.equal(productionPdfFilename(batch),'Alma-Mia-Lista-Produccion-AM-0007.pdf');
 assert.equal(productionPdfFilename(batch,{draft:true}),'Alma-Mia-Lista-Produccion-AM-0007-Borrador.pdf');
});

test('a long production list creates a real multipage PDF without saving production',async()=>{
 const many={...batch,items:Array.from({length:75},(_,i)=>({...batch.items[i%3],id:String(i),name:'Nombre de perfume largo para revisar la paginación '+i,reference:'Inspiración y marca de perfume de referencia para producción '+i}))};
 const original=structuredClone(many),result=await createProductionPdf(many,{logo:false,now:new Date('2026-10-20T12:00:00Z')});
 assert.equal(result.blob.type,'application/pdf');assert.ok(result.pages>=4);assert.deepEqual(many,original);
 assert.match((await result.blob.text()).slice(0,8),/^%PDF-/);assert.ok(result.blob.size>15000);
});
