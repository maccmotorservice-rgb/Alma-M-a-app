import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState} from './inventory.js';
import {materialsQuoteEssences,materialsQuotation,createMaterialsQuotationPdf,createMaterialsPdf} from './materials-pdf.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const fixture=()=>{
 const state=initialState(catalog.slice(0,4));for(const material of state.materials)material.stock=500;
 state.materials.find(m=>m.id==='ess-01').stock=0;
 Object.assign(state.materials.find(m=>m.id==='ess-02'),{stock:125,secondBottle:{capacity:250,stock:62.5}});
 Object.assign(state.materials.find(m=>m.id==='ess-03'),{stock:130,secondBottle:{capacity:250,stock:67.5}});
 state.materials.find(m=>m.id==='ess-04').stock=62.5;
 state.materials.find(m=>m.id==='alcohol').stock=0;state.materials.find(m=>m.id==='galaxolide').stock=0;
 return state;
};
const now=new Date('2026-10-23T02:30:00Z');

test('quotation includes exactly depleted and low essences using the same per-bottle threshold as the report',()=>{
 const state=fixture(),before=JSON.stringify(state),items=materialsQuoteEssences(state,catalog);
 assert.deepEqual(items.map(i=>i.id).sort(),['ess-01','ess-02','ess-04']);assert.ok(items.every(i=>i.quantityMl===250));assert.equal(JSON.stringify(state),before);
 const acqua=items.find(i=>i.id==='ess-01'),chic=items.find(i=>i.id==='ess-02');assert.equal(acqua.name,'Acqua di Giò Parfum');assert.equal(acqua.house,'Armani');assert.equal(chic.name,'Chic for Men EDT');assert.equal(chic.house,'Carolina Herrera');
 for(const item of items)assert.ok(!catalog.some(p=>p.name===item.name),'internal aliases must not be sent to suppliers');
});
test('quantities start at 250 ml, can be increased independently, and do not require multiples of 250',()=>{
 const state=fixture(),before=JSON.stringify(state),result=materialsQuotation(state,catalog,{quantities:{'ess-01':500,'ess-02':'300','ess-03':1000}});
 assert.equal(result.items.find(i=>i.id==='ess-01').quantityMl,500);assert.equal(result.items.find(i=>i.id==='ess-02').quantityMl,300);assert.equal(result.items.find(i=>i.id==='ess-04').quantityMl,250);assert.equal(result.totalMl,1050);assert.equal(result.items.find(i=>i.id==='ess-03'),undefined);assert.equal(JSON.stringify(state),before);
 for(const quantity of [0,249,249.5,-250,NaN,Infinity,'',250.5,1000001])assert.throws(()=>materialsQuotation(state,catalog,{quantities:{'ess-01':quantity}}),/cantidad/);
});
test('alcohol is opt in with editable ml; galaxolide and internal inventory balances never enter the quotation',()=>{
 const state=fixture(),without=materialsQuotation(state,catalog);assert.equal(without.items.length,3);assert.ok(without.items.every(i=>i.id.startsWith('ess-')));
 const withAlcohol=materialsQuotation(state,catalog,{includeAlcohol:true,alcoholMl:8000});assert.deepEqual(withAlcohol.items.find(i=>i.id==='alcohol'),{id:'alcohol',name:'Alcohol',house:'',quantityMl:8000});assert.equal(withAlcohol.totalMl,8750);assert.equal(materialsQuotation(state,catalog,{includeAlcohol:true}).items.find(i=>i.id==='alcohol').quantityMl,4000);assert.equal(withAlcohol.items.find(i=>i.id==='galaxolide'),undefined);
 assert.throws(()=>materialsQuotation(state,catalog,{includeAlcohol:true,alcoholMl:100}),/Alcohol/);
 const available=initialState(catalog);for(const m of available.materials)m.stock=500;assert.throws(()=>materialsQuotation(available,catalog),/No hay esencias/);assert.equal(materialsQuotation(available,catalog,{includeAlcohol:true}).items.length,1);
});
test('missing real names or production houses block a supplier document rather than inventing references',()=>{
 const state=fixture(),broken=catalog.map(p=>p.id==='01'?{...p,brand:''}:p);assert.throws(()=>materialsQuoteEssences(state,broken),/nombre real o la casa/);
 const fallback=catalog.map(p=>p.id==='01'?{...p,guideReference:undefined}:p);assert.equal(materialsQuoteEssences(state,fallback).find(i=>i.id==='ess-01').name,'Acqua di Giò Parfum');
});
test('normal PDF keeps internal names while the supplier PDF contains only real names, houses and requested ml',async()=>{
 const state=fixture(),before=JSON.stringify(state),normal=await createMaterialsPdf(state,catalog,{now}),quote=await createMaterialsQuotationPdf(state,catalog,{now,quantities:{'ess-01':750},includeAlcohol:true,alcoholMl:4000});
 const normalText=await normal.blob.text(),quoteText=await quote.blob.text();assert.match(normalText,/^%PDF-/);assert.match(normalText,/Mediterranean Asset/);assert.match(quoteText,/^%PDF-/);assert.match(quoteText,/Armani/);assert.match(quoteText,/Chic for Men EDT/);assert.match(quoteText,/750 ml/);assert.doesNotMatch(quoteText,/Mediterranean Asset|Peppered Suede|Sugared Leather|Galaxolide|Existencias|Faltantes|Alma M/);assert.equal(quote.data.items.length,4);assert.match(quote.filename,/2026-10-22/);assert.equal(JSON.stringify(state),before);
});
test('a full 112-essence supplier request paginates and keeps all names and quantities',async()=>{
 const state=initialState(catalog),before=JSON.stringify(state),quote=await createMaterialsQuotationPdf(state,catalog,{now});assert.equal(quote.data.items.length,112);assert.equal(quote.data.totalMl,28000);assert.ok(quote.pages>=3);assert.ok(quote.blob.size>20000);assert.equal(JSON.stringify(state),before);
});

test('an explicit editable selection can remove report essences and add available catalog essences',()=>{
 const state=fixture(),before=JSON.stringify(state),result=materialsQuotation(state,catalog,{selectedIds:['ess-01','ess-04'],quantities:{'ess-01':750,'ess-04':500,'ess-02':1000}});
 assert.deepEqual(result.items.map(i=>i.id).sort(),['ess-01','ess-04']);assert.equal(result.items.find(i=>i.id==='ess-01').quantityMl,750);assert.equal(result.items.find(i=>i.id==='ess-04').quantityMl,500);assert.equal(JSON.stringify(state),before);
 const available=initialState(catalog);for(const m of available.materials)m.stock=500;assert.equal(materialsQuotation(available,catalog,{selectedIds:['ess-05']}).items[0].id,'ess-05');
});
test('removing every essence stays empty and does not repopulate the automatic report selection',()=>{
 const state=fixture();assert.deepEqual(materialsQuoteEssences(state,catalog,{selectedIds:[]}),[]);assert.throws(()=>materialsQuotation(state,catalog,{selectedIds:[]}),/No hay esencias seleccionadas/);const alcohol=materialsQuotation(state,catalog,{selectedIds:[],includeAlcohol:true});assert.equal(alcohol.items.length,1);assert.equal(alcohol.items[0].id,'alcohol');
});
test('editable selections reject duplicate, unknown and non-essence IDs without altering stock',()=>{
 const state=fixture(),before=JSON.stringify(state);for(const selectedIds of [['ess-01','ess-01'],['ess-999'],['alcohol'],null,'ess-01',[undefined]])assert.throws(()=>materialsQuotation(state,catalog,{selectedIds}),/selección de esencias/);assert.equal(JSON.stringify(state),before);
});
test('the edited PDF prints only selected references, houses and quantities, without inventory status or removed rows',async()=>{
 const state=fixture(),before=JSON.stringify(state),result=await createMaterialsQuotationPdf(state,catalog,{now,selectedIds:['ess-01','ess-04'],quantities:{'ess-04':500}}),text=await result.blob.text();
 assert.equal(result.data.items.length,2);assert.match(text,/CH Men/);assert.match(text,/Armani/);assert.match(text,/500 ml/);assert.doesNotMatch(text,/Chic for Men|Bad Boy|Agotada|Por agotarse|Disponible|Existencias|Mediterranean Asset|Sugared Leather/);assert.ok(result.data.items.every(i=>!('status' in i)));assert.equal(JSON.stringify(state),before);
});

test('supplier PDF includes each catalog gender with real references and no inventory statuses',async()=>{
 const state=initialState(catalog),before=JSON.stringify(state),products=['Dama','Caballero','Unisex'].map(category=>catalog.find(p=>p.category===category)),selectedIds=products.map(p=>'ess-'+p.id),quote=await createMaterialsQuotationPdf(state,catalog,{now,selectedIds,includeAlcohol:true}),text=await quote.blob.text();
 for(const p of products){assert.equal(quote.data.items.find(i=>i.id==='ess-'+p.id).category,p.category);assert.match(text,new RegExp(p.category));}
 assert.doesNotMatch(text,/Agotada|Por agotarse|Disponible|Existencias/);assert.ok(!('category' in quote.data.items.find(i=>i.id==='alcohol')));assert.equal(JSON.stringify(state),before);
});
test('missing or invalid catalog gender blocks quotations rather than inventing a classification',()=>{
 const state=fixture();for(const category of [undefined,'','Otro'])assert.throws(()=>materialsQuotation(state,catalog.map(p=>p.id==='01'?{...p,category}:p)),/categoría/);
});
