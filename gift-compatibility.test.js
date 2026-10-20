import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cloneData} from './clone-data.js';
import {initialState,applyMovement,productionPreview,confirmProduction,completeBatchItem,validateBackup,batchProgress,registerCustomer} from './inventory.js';
import {buildSalesNote,salesDraftFromBatch,salesAccounts,salesPaymentSummary,validateSalesNotes,editSalesNote,addSalesPayment} from './sales.js';
import {salesAnalytics} from './sales-analytics.js';
import {createSalesPdf} from './sales-pdf.js';
import {createProductionPdf,productionPdfData} from './production-pdf.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const context={id:'gift-note',createdAt:'2026-10-20T12:00:00Z',createdBy:'Luis'};
const draft={customer:'',date:'2026-10-20',paymentType:'gift',discountEnabled:true,discountPercent:30,items:[{productId:catalog[0].id,name:catalog[0].name,reference:catalog[0].reference,category:'Perfumes de caballero - Diseñador',size:100,qty:2,price:699}]};
test('Safari fallback copies cycles, dates, sparse arrays, maps, binary views and image originals without losing data',async()=>{
 const native=globalThis.structuredClone;globalThis.structuredClone=undefined;
 try{
  const bytes=new Uint8Array([1,2,3]),blob=new Blob([bytes],{type:'image/png'}),value={date:new Date(0),bytes,view:new DataView(bytes.buffer),map:new Map(),set:new Set([1]),blob,array:new Array(3),undefinedValue:undefined};value.self=value;value.map.set(value,bytes);value.array[2]='end';
  const result=cloneData(value);assert.notEqual(result,value);assert.equal(result.self,result);assert.equal(result.date.getTime(),0);assert.equal(result.map.get(result),result.bytes);assert.equal(result.view.buffer,result.bytes.buffer);result.bytes[0]=9;assert.equal(bytes[0],1);assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),bytes);assert.equal(result.blob.type,'image/png');assert.equal(result.array.length,3);assert.equal(0 in result.array,false);assert.ok('undefinedValue' in result);
  assert.throws(()=>cloneData({callback(){}}),TypeError);
 }finally{globalThis.structuredClone=native;}
});
test('gift production consumes the normal recipe only on completion and roundtrips alongside old data without native structuredClone',()=>{
 const native=globalThis.structuredClone;globalThis.structuredClone=undefined;
 try{
  let state=initialState(catalog);for(const [id,amount] of [['ess-'+catalog[0].id,250],['alcohol',4000],['galaxolide',100]])state=applyMovement(state,{id,type:'entry',amount});
  const existing=JSON.stringify(state),preview=productionPreview(state,[{id:catalog[0].id,size:100,qty:2}],catalog,{type:'gift'},'gift-batch');
  let next=confirmProduction(state,preview,catalog);assert.equal(JSON.stringify(state),existing);assert.deepEqual(next.materials,state.materials);assert.deepEqual(next.ready,{});
  next=completeBatchItem(next,{batchId:'gift-batch',id:catalog[0].id,size:100,completed:2},catalog);
  assert.equal(next.materials.find(m=>m.id==='ess-'+catalog[0].id).stock,190);assert.equal(next.ready[catalog[0].id+'-100'],2);assert.equal(batchProgress(next.batches[0]).label,'Listo para entrega');assert.match(next.movements[0].detail,/Obsequio/);
  const d=salesDraftFromBatch(next.batches[0],catalog,{date:draft.date});assert.equal(d.paymentType,'gift');assert.equal(d.customer,'');next.salesNotes=[buildSalesNote(d,context)];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(next)),catalog),next);
  assert.deepEqual(validateBackup(JSON.parse(existing),catalog),state);
 }finally{globalThis.structuredClone=native;}
});
test('gifts have zero revenue, collections, receivables and sales ranking units, but retain replacement costs',()=>{
 const original=JSON.stringify(draft),note=buildSalesNote(draft,context);assert.equal(JSON.stringify(draft),original);assert.equal(note.items[0].unitCents,0);assert.equal(note.discountPercent,0);assert.equal(note.totals.totalCents,0);
 assert.deepEqual(validateSalesNotes([note]),[note]);assert.deepEqual(salesAccounts([note]),{receivableCents:0,receivedCents:0,paidNotes:0,unclassified:0});assert.deepEqual(salesPaymentSummary(note),{type:'gift',paidCents:0,balanceCents:0,status:'gift',label:'Obsequio'});
 const analytics=salesAnalytics([note],catalog,2026);assert.equal(analytics.totals.salesCents,0);assert.equal(analytics.totals.collectedCents,0);assert.equal(analytics.totals.replacementCents,28000);assert.equal(analytics.best.length,0);assert.equal(analytics.unsold.find(p=>p.id===catalog[0].id).gifts,2);
 assert.throws(()=>addSalesPayment({salesNotes:[note]},note.id,{actor:'Luis',expectedRevision:0,amount:1,date:draft.date}),/crédito/);
 const corrupted=cloneData(note);corrupted.items[0].unitCents=100;assert.throws(()=>validateSalesNotes([corrupted]),/obsequio/i);
 const credit=buildSalesNote({...draft,paymentType:'credit'},context),paid=addSalesPayment({salesNotes:[credit]},credit.id,{actor:'Luis',expectedRevision:0,amount:1,date:draft.date});assert.throws(()=>editSalesNote(paid,note,{actor:'Luis',expectedRevision:1}),/conservar/);
});
test('production accepts an absent customer, preserves registered recipients and rejects broken references',()=>{
 let state=registerCustomer(initialState(catalog),{name:'Ana'});for(const type of ['customer','gift']){
  const unnamed=productionPreview(state,[{id:catalog[0].id,size:50,qty:1}],catalog,{type},type);assert.deepEqual(unnamed.purpose,{type});assert.doesNotMatch(productionPdfData(unnamed).purpose,/undefined|cliente/i);assert.deepEqual(validateBackup(confirmProduction(state,unnamed,catalog),catalog).batches[0].purpose,{type});
  const named=productionPreview(state,unnamed.items,catalog,{type,customerId:state.customers[0].id},type+'-named');assert.equal(named.purpose.customerName,'Ana');assert.throws(()=>productionPreview(state,unnamed.items,catalog,{type,customerId:'missing'}));
 }
});
test('real sales PDFs completely omit the client heading when empty and preserve it when supplied',async()=>{
 const note=buildSalesNote(draft,context),before=JSON.stringify(note),pdf=await createSalesPdf(note,{logo:false}),text=pdf.output();assert.match(text,/^%PDF-/);assert.doesNotMatch(text,/CLIENTE|undefined|Nota sin cliente/);assert.match(text,/Obsequio/);assert.equal(JSON.stringify(note),before);
 const named=await createSalesPdf({...note,customer:'Ana'}, {logo:false});assert.match(named.output(),/CLIENTE/);assert.match(named.output(),/Ana/);
 const batch=productionPreview(initialState(catalog),[{id:catalog[0].id,size:50,qty:1}],catalog,{type:'gift'},'pdf-gift');const production=await createProductionPdf(batch,{logo:false});assert.equal(production.data.purpose,'Obsequio');assert.equal(production.blob.type,'application/pdf');
});

test('Safari fallback IDs remain secure UUID v4 values without native randomUUID',async()=>{
 const {randomId}=await import('./clone-data.js'),native=globalThis.crypto.randomUUID;globalThis.crypto.randomUUID=undefined;
 try{const ids=Array.from({length:100},()=>randomId());assert.equal(new Set(ids).size,100);for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);}finally{globalThis.crypto.randomUUID=native;}
});
