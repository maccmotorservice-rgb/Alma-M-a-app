import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cancellationReasons,resolveCancellationReason} from './cancellation.js';
import {catalogCategories,filterCatalog} from './catalog-tools.js';
import {validateEvidenceFile,validateEvidenceMetadata,MAX_EVIDENCE_BYTES} from './evidence.js';
import {buildSalesNote,addSalesPayment,cancelSalesNote,salesAccounts,validateSalesNotes} from './sales.js';
import {initialState,productionPreview,confirmProduction,cancelBatch,validateBackup} from './inventory.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const evidence={bucket:'payment-evidence',path:'luis/payment/file.pdf',name:'Transferencia.pdf',type:'application/pdf',size:12};
const draft={customer:'Cliente',date:'2026-10-18',paymentType:'credit',items:[{name:'Perfume',reference:'Referencia',category:'Perfumes de dama - Diseñador',size:100,qty:1,price:1000}]};
const note=id=>buildSalesNote(draft,{id,createdBy:'Luis'});
test('motivos predefinidos se guardan sin texto libre en notas y lotes; Otro exige 5 caracteres',()=>{
 const state={salesNotes:[note('note')]};let batch=confirmProduction(initialState(catalog),productionPreview(initialState(catalog),[{id:'10',size:100,qty:1}],catalog),catalog);
 for(const [reasonCode,label] of cancellationReasons.filter(([id])=>id!=='other')){assert.equal(resolveCancellationReason(reasonCode),label);const n=cancelSalesNote(state,'note',{actor:'Luis',expectedRevision:0,reasonCode});assert.equal(n.salesNotes[0].cancellationReason,label);assert.deepEqual(validateSalesNotes(n.salesNotes),n.salesNotes);const b=cancelBatch(batch,{batchId:batch.batches[0].id,actor:'Ximena',reasonCode});assert.equal(b.batches[0].cancellationReason,label);assert.deepEqual(validateBackup(b,catalog),b);}
 for(const text of ['','abcd','   abcd   '])assert.throws(()=>resolveCancellationReason('other',text),/5 y 240/);assert.equal(resolveCancellationReason('other','  abcde  '),'abcde');assert.throws(()=>resolveCancellationReason('invalid'),/Selecciona/);
});
test('catálogo oficial completo y filtros exclusivos con búsqueda por notas y aromas',()=>{
 assert.equal(catalog.length,112);assert.deepEqual(catalogCategories.map(c=>c[1]),['Todos','Mujer','Mujer nicho','Hombre','Hombre nicho','Unisex']);const filtered=catalogCategories.slice(1).flatMap(([category])=>filterCatalog(catalog,{category}));assert.equal(filtered.length,catalog.filter(p=>!p.discontinued).length);assert.equal(new Set(filtered.map(p=>p.id)).size,filtered.length);
 assert.equal(catalog.filter(p=>p.notes.combined).length,9);for(const p of catalog.filter(p=>!p.discontinued)){assert.ok(p.family&&p.description&&p.guideReference);assert.ok(p.notes.combined?.length||p.notes.top?.length&&p.notes.heart?.length&&p.notes.base?.length);assert.ok(filterCatalog(catalog,{advanced:true,query:p.description}).some(x=>x.id===p.id));}assert.equal(catalog[0].family,'Amaderada acuática');assert.ok(filterCatalog(catalog,{advanced:true,query:'bergamota',family:catalog[0].family}).some(p=>p.id==='01'));
});
test('abonos de transferencia exigen comprobante y efectivo permite recordatorio sin evidencia',()=>{
 const s={salesNotes:[note('note')]},entry={actor:'Luis',expectedRevision:0,amount:'100',date:'2026-10-18',paymentId:'payment'};assert.throws(()=>addSalesPayment(s,'note',{...entry,method:'transfer'}),/Comprobante/);const transfer=addSalesPayment(s,'note',{...entry,method:'transfer',evidence});assert.deepEqual(transfer.salesNotes[0].payments[0].evidence,evidence);assert.deepEqual(validateSalesNotes(transfer.salesNotes),transfer.salesNotes);const cash=addSalesPayment(s,'note',{...entry,method:'cash',reminder:'  Pagó personalmente  '});assert.equal(cash.salesNotes[0].payments[0].reminder,'Pagó personalmente');assert.equal(cash.salesNotes[0].payments[0].evidence,undefined);assert.throws(()=>addSalesPayment(s,'note',{...entry,reminder:'x'.repeat(241)}),/240/);
});
test('resumen suma saldos y cobros vigentes, excluye canceladas y señala notas antiguas',()=>{
 const credit=addSalesPayment({salesNotes:[note('credit')]},'credit',{actor:'Luis',expectedRevision:0,amount:'250',date:'2026-10-18'}).salesNotes[0],cash={...note('cash'),paymentType:'cash'},cancelled={...note('cancelled'),status:'cancelled'},legacy={...note('legacy')};delete legacy.paymentType;assert.deepEqual(salesAccounts([credit,cash,cancelled,legacy]),{receivableCents:75000,receivedCents:125000,paidNotes:1,unclassified:1});
});
test('comprobantes: firma del archivo, tamaño máximo y rutas privadas válidas',async()=>{
 const file=new File(['%PDF-1.4\nproof'],'pago.pdf',{type:'application/pdf'});assert.equal((await validateEvidenceFile(file)).extension,'pdf');await assert.rejects(validateEvidenceFile(new File(['HTML'],'pago.pdf',{type:'application/pdf'})),/formato/);await assert.rejects(validateEvidenceFile(new File(['x'],'pago.html',{type:'text/html'})),/Adjunta/);await assert.rejects(validateEvidenceFile({type:'application/pdf',size:MAX_EVIDENCE_BYTES+1}),/8 MB/);assert.deepEqual(validateEvidenceMetadata(evidence),evidence);for(const patch of [{path:'../escape.pdf'},{bucket:'public'},{size:MAX_EVIDENCE_BYTES+1},{type:'image/png'}])assert.throws(()=>validateEvidenceMetadata({...evidence,...patch}),/Comprobante/);
});

test('referencias completas incluyen casa y género y se buscan por palabras en cualquier orden',()=>{for(const p of catalog.filter(p=>!p.discontinued)){assert.ok(p.brand);assert.ok(p.displayReference.includes(p.brand));assert.ok(p.displayReference.includes(p.category));assert.ok(filterCatalog(catalog,{query:p.brand}).some(x=>x.id===p.id));}assert.deepEqual(filterCatalog(catalog,{query:'scandal dama'}).map(p=>p.id),['64']);assert.deepEqual(filterCatalog(catalog,{query:'Jean Paul Gaultier scandal hombre'}).map(p=>p.id),['18']);assert.ok(filterCatalog(catalog,{query:'Dior Sauvage'}).some(p=>p.id==='10'));});
