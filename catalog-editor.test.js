import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {initialState,validateBackup,applyMovement}from'./inventory.js';
import {catalogForState,registerMaterial,discontinueMaterial,catalogPriceTargets,setCatalogPrices}from'./material-registry.js';
import {buildSalesNote}from'./sales.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const input={kind:'Esencia',name:'Aurora Catálogo',reference:'Nueva Original',brand:'Casa Original',category:'Unisex',line:'Nicho',stock:250,price50:399,price100:599};
test('los tres grupos de precios son exclusivos y solo incluyen perfumes activos',()=>{
 const groups=['designer','niche','unisex'].map(id=>catalogPriceTargets(catalog,'group',id));const ids=groups.flat().map(p=>p.id);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,catalog.filter(p=>!p.discontinued).length);assert.ok(groups[0].every(p=>p.line==='Diseñador'&&p.category!=='Unisex'));assert.ok(groups[1].every(p=>p.line==='Nicho'&&p.category!=='Unisex'));assert.ok(groups[2].every(p=>p.category==='Unisex'));
});
test('precios por grupo e individuales se conservan al recargar sin modificar notas ni existencias',()=>{
 let state=initialState(catalog);state=applyMovement(state,{id:'ess-01',type:'entry',amount:250});state.salesNotes=[buildSalesNote({customer:'Cliente',date:'2026-10-26',items:[{name:catalog[0].name,category:'Perfumes de caballero - Diseñador',size:50,qty:1,price:429}],paymentType:'cash'},{createdBy:'Luis'})];const before=JSON.stringify(state);
 let next=setCatalogPrices(state,{scope:'group',id:'designer',price50:'440.50',price100:'660.75'},catalog);next=setCatalogPrices(next,{scope:'individual',id:'01',price50:'450',price100:'670'},catalog);const restored=validateBackup(JSON.parse(JSON.stringify(next)),catalog),effective=catalogForState(catalog,restored);
 assert.equal(effective.find(p=>p.id==='01').price50,450);assert.equal(effective.find(p=>p.id==='02').price50,440.5);assert.equal(effective.find(p=>p.category==='Unisex').price50,catalog.find(p=>p.category==='Unisex').price50);assert.deepEqual(restored.materials,state.materials);assert.deepEqual(restored.salesNotes,state.salesNotes);assert.deepEqual(restored.movements,state.movements);assert.deepEqual(restored.ready,state.ready);assert.equal(JSON.stringify(state),before);
});
test('la baja en materia prima oculta el perfume del catálogo y bloquea cambios de precio',()=>{
 const state=discontinueMaterial(initialState(catalog),'ess-01'),effective=catalogForState(catalog,state);assert.equal(effective.find(p=>p.id==='01').discontinued,true);assert.equal(catalogPriceTargets(effective,'individual','01').length,0);assert.throws(()=>setCatalogPrices(state,{scope:'individual',id:'01',price50:100,price100:200},catalog));
});
test('el editor integra perfumes nuevos y permite ajustar su precio individual sin cambiar el saldo',()=>{
 const state=registerMaterial(initialState(catalog),input,catalog),id=state.customProducts[0].id;const next=setCatalogPrices(state,{scope:'individual',id,price50:444,price100:666},catalog),restored=validateBackup(next,catalog),effective=catalogForState(catalog,restored);assert.equal(effective.find(p=>p.id===id).price100,666);assert.equal(restored.materials.find(m=>m.id==='ess-'+id).stock,250);assert.equal(restored.customProducts[0].price100,599);
});
test('valida ambos precios y detecta cambios concurrentes antes de modificar el catálogo',()=>{
 const state=initialState(catalog),base={scope:'individual',id:'01',price50:'100',price100:'200'},before=JSON.stringify(state);
 for(const price50 of ['',undefined,null,'abc',-1,Infinity,'1.001',1000001])assert.throws(()=>setCatalogPrices(state,{...base,price50},catalog));
 const expected=catalogPriceTargets(catalog,'individual','01').map(({id,price50,price100})=>({id,price50,price100}));const updated=setCatalogPrices(state,base,catalog);assert.throws(()=>setCatalogPrices(updated,{...base,price50:300,expected},catalog),/otra sesión/);assert.equal(JSON.stringify(state),before);
 assert.throws(()=>validateBackup({...state,catalogPriceOverrides:{'999':{price50:1,price100:2}}},catalog));assert.throws(()=>validateBackup({...state,catalogPriceOverrides:{'01':{price50:'bad',price100:2}}},catalog));
});
