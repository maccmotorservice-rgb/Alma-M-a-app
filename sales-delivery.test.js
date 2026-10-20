import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,validateBackup} from './inventory.js';
import {buildSalesNote,insertSalesNote,editSalesNote,cancelSalesNote,addSalesPayment,salesAccounts,validateSalesNotes} from './sales.js';
import {createSalesPdf} from './sales-pdf.js';
import {cloneData} from './clone-data.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const first=catalog[0],second=catalog[1],at='2026-10-20T18:00:00Z';
const line=(p=first,size=100,qty=2)=>({name:p.name,reference:p.reference,productId:p.id,category:'Perfumes de caballero - Diseñador',size,qty,price:p['price'+size]});
const draft={customer:'Cliente prueba',date:'2026-10-20',paymentType:'cash',items:[line()],deliverFromStock:true};
const context={id:'note-stock',createdAt:at,createdBy:'Luis'};
const note=(patch={})=>buildSalesNote({...draft,...patch},context);
const state=()=>({...initialState(catalog),ready:{[first.id+'-100']:5,[first.id+'-50']:4,[second.id+'-100']:3}});
const options={catalog,actor:'Ximena',at};

test('stock delivery is optional and preparing a note or generating its PDF never consumes inventory',async()=>{
 const before=state(),snapshot=JSON.stringify(before),plain=note({deliverFromStock:false});
 assert.equal(plain.deliverFromStock,undefined);assert.equal(plain.stockDelivery,undefined);
 const next=insertSalesNote(before,plain);assert.deepEqual(next.ready,before.ready);assert.deepEqual(next.movements,before.movements);assert.equal(next.salesNotes[0].stockDelivery,undefined);
 const pending=note();await createSalesPdf(pending,{logo:false});assert.equal(JSON.stringify(before),snapshot);assert.equal(pending.stockDelivery,undefined);
});
test('saving atomically records all stock deliveries, actor, note links and a receipt without touching essences or batches',()=>{
 const before=state(),snapshot=JSON.stringify(before),candidate=note({items:[line(),line(first,50,3),line(second,100,1)]}),candidateSnapshot=JSON.stringify(candidate);
 const next=insertSalesNote(before,candidate,options),saved=next.salesNotes[0];
 assert.equal(JSON.stringify(before),snapshot);assert.equal(JSON.stringify(candidate),candidateSnapshot);
 assert.deepEqual(next.ready,{[first.id+'-100']:3,[first.id+'-50']:1,[second.id+'-100']:2});assert.deepEqual(next.materials,before.materials);assert.deepEqual(next.batches,before.batches);
 assert.equal(saved.deliverFromStock,undefined);assert.deepEqual(saved.stockDelivery,{at,by:'Ximena',items:[{productId:first.id,size:100,qty:2},{productId:first.id,size:50,qty:3},{productId:second.id,size:100,qty:1}]});
 assert.equal(next.movements.length,3);for(const movement of next.movements){assert.equal(movement.salesNoteId,saved.id);assert.equal(movement.performedBy,'Ximena');assert.ok(movement.delta<0);assert.equal(movement.unit,'frascos');assert.match(movement.detail,/Entrega de nota/);}
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(next)),catalog),next);
});
test('insufficient stock anywhere blocks the whole note, with no partial delivery or changes to existing data',()=>{
 const before=state(),existing=note({deliverFromStock:false});before.salesNotes=[{...existing,id:'old'}];const snapshot=JSON.stringify(before);
 const tooMany=note({items:[line(),line(second,100,4)]});assert.throws(()=>insertSalesNote(before,tooMany,options),/Stock insuficiente/);assert.equal(JSON.stringify(before),snapshot);
 const duplicates=note({items:[line(first,100,3),line(first,100,3)]});assert.throws(()=>insertSalesNote(before,duplicates,options),/Stock insuficiente/);assert.equal(JSON.stringify(before),snapshot);
 const missing=note({items:[line(second,50,1)]});assert.throws(()=>insertSalesNote(before,missing,options),/Stock insuficiente/);assert.equal(JSON.stringify(before),snapshot);
});
test('duplicate product rows aggregate quantities; untracked presentations stay outside the stock movement',()=>{
 const candidate=note({items:[line(first,100,1),line(first,100,2),{name:'Muestra',reference:'',category:'Material promocional',size:5,qty:1,price:0}]});
 const next=insertSalesNote(state(),candidate,options);assert.equal(next.ready[first.id+'-100'],2);assert.equal(next.movements.length,1);assert.equal(next.salesNotes[0].stockDelivery.items[0].qty,3);assert.equal(next.salesNotes[0].items.length,3);
});
test('unknown or custom perfumes cannot silently consume unrelated inventory',()=>{
 const before=state(),snapshot=JSON.stringify(before),unknown=note({items:[{...line(),productId:'999'}]}),custom=note({items:[{...line(),productId:undefined}]});
 assert.throws(()=>insertSalesNote(before,unknown,options),/catálogo/);assert.throws(()=>insertSalesNote(before,custom,options),/catálogo/);
 assert.throws(()=>insertSalesNote(before,note({items:[{name:'Bolsa',reference:'',category:'Material promocional',size:null,qty:1,price:0}]}),options),/al menos un perfume/);assert.equal(JSON.stringify(before),snapshot);
});
test('repeated saves, financial edits, PDFs and cancellation never repeat or undo a physical delivery',async()=>{
 const saved=insertSalesNote(state(),note(),options),receipt=saved.salesNotes[0].stockDelivery,stock=cloneData(saved.ready),movements=cloneData(saved.movements);
 assert.throws(()=>insertSalesNote(saved,note(),options),/guardada/);
 const edited=editSalesNote(saved,note({customer:'Nombre corregido',items:[{...line(),price:500}]}),{...options,expectedRevision:0});
 assert.deepEqual(edited.ready,stock);assert.deepEqual(edited.movements,movements);assert.deepEqual(edited.salesNotes[0].stockDelivery,receipt);assert.equal(edited.salesNotes[0].customer,'Nombre corregido');
 await createSalesPdf(edited.salesNotes[0],{logo:false});assert.deepEqual(edited.ready,stock);
 const repeated=editSalesNote(edited,note(),{...options,expectedRevision:1});assert.deepEqual(repeated.ready,stock);assert.deepEqual(repeated.movements,movements);
 assert.throws(()=>editSalesNote(repeated,note(),{...options,expectedRevision:1}),/otra sesión/);
 const cancelled=cancelSalesNote(repeated,context.id,{actor:'Luis',expectedRevision:2,reason:'Nota duplicada'});assert.deepEqual(cancelled.ready,stock);assert.deepEqual(cancelled.salesNotes[0].stockDelivery,receipt);assert.deepEqual(validateBackup(cancelled,catalog),cancelled);
});
test('a delivered note protects its recorded product quantities while permitting financial corrections',()=>{
 const saved=insertSalesNote(state(),note(),options),snapshot=JSON.stringify(saved);
 for(const items of [[line(first,100,1)],[line(second,100,2)],[line(first,50,2)]])assert.throws(()=>editSalesNote(saved,note({items}),{...options,expectedRevision:0}),/cantidades entregados/);
 assert.equal(JSON.stringify(saved),snapshot);
});
test('an old note may opt in once during an edit; unselected edits leave stock unchanged',()=>{
 const original=insertSalesNote(state(),note({deliverFromStock:false})),unchanged=editSalesNote(original,note({deliverFromStock:false}),{...options,expectedRevision:0});assert.deepEqual(unchanged.ready,original.ready);
 const delivered=editSalesNote(unchanged,note(),{...options,expectedRevision:1});assert.equal(delivered.ready[first.id+'-100'],3);assert.ok(delivered.salesNotes[0].stockDelivery);
 const insufficient={...unchanged,ready:{}};assert.throws(()=>editSalesNote(insufficient,note(),{...options,expectedRevision:1}),/Stock insuficiente/);assert.equal(insufficient.salesNotes[0].stockDelivery,undefined);
});
test('cash, credit and gifts can register deliveries without changing payment accounting',()=>{
 for(const paymentType of ['cash','credit','gift']){
  const candidate=note({paymentType}),saved=insertSalesNote(state(),candidate,options);assert.equal(saved.ready[first.id+'-100'],3);assert.deepEqual(salesAccounts(saved.salesNotes),salesAccounts([candidate]));
  if(paymentType==='credit'){
   const paid=addSalesPayment(saved,context.id,{actor:'Luis',expectedRevision:0,amount:1,date:draft.date});assert.deepEqual(paid.ready,saved.ready);assert.deepEqual(paid.salesNotes[0].stockDelivery,saved.salesNotes[0].stockDelivery);
  }
 }
});
test('backups preserve old notes and reject corrupt delivery receipts',()=>{
 const saved=insertSalesNote(state(),note(),options);assert.deepEqual(validateSalesNotes(saved.salesNotes),saved.salesNotes);
 for(const patch of [{at:'invalid'},{by:'unknown'},{items:[]},{items:[{productId:first.id,size:5,qty:1}]},{items:[{productId:first.id,size:100,qty:0}]}]){
  const damaged=cloneData(saved);Object.assign(damaged.salesNotes[0].stockDelivery,patch);assert.throws(()=>validateBackup(damaged,catalog),/entrega/);
 }
 const old=insertSalesNote(state(),note({deliverFromStock:false}));assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(old)),catalog),old);
});
