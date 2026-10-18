import {test} from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{initialState,applyMovement,produce,readyMovement,validateBackup}from'./inventory.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url))),id=catalog[0].id;
test('catálogo oficial completo con IDs únicos y precios',()=>{assert.equal(catalog.length,112);assert.equal(new Set(catalog.map(p=>p.id)).size,112);for(const p of catalog){assert.ok(p.price50>0&&p.price100>p.price50);}});
test('entrada, producción y entrega conservan cantidades',()=>{let s=initialState(catalog);for(const[id,amount]of[['alcohol',1000],['galaxolide',100],['ess-'+catalog[0].id,100]])s=applyMovement(s,{type:'entry',id,amount});s=produce(s,{id,size:100,qty:2,essence:25,fixative:5},catalog);assert.equal(s.materials.find(m=>m.id==='alcohol').stock,860);assert.equal(s.materials.find(m=>m.id==='galaxolide').stock,90);assert.equal(s.materials.find(m=>m.id==='ess-'+id).stock,50);assert.equal(s.ready[id+'-100'],2);s=readyMovement(s,{id,size:100,qty:1,type:'delivery'},catalog);assert.equal(s.ready[id+'-100'],1);assert.equal(s.movements.length,5);assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s)),catalog),s);});
test('rechaza consumos sin stock sin modificar el inventario',()=>{const s=initialState(catalog),before=JSON.stringify(s);assert.throws(()=>produce(s,{id,size:50,qty:1,essence:25,fixative:5},catalog));assert.throws(()=>applyMovement(s,{type:'exit',id:'alcohol',amount:1}));assert.throws(()=>readyMovement(s,{id,size:50,qty:1,type:'delivery'},catalog));assert.equal(JSON.stringify(s),before);});
test('ingreso de perfumes existentes no consume materias primas',()=>{const s=initialState(catalog);const next=readyMovement(s,{id,size:50,qty:3,type:'entry'},catalog);assert.equal(next.ready[id+'-50'],3);assert.deepEqual(next.materials,s.materials);});
test('rechaza fórmulas y respaldos inválidos',()=>{const s=initialState(catalog);assert.throws(()=>produce(s,{id,size:50,qty:1,essence:90,fixative:20},catalog));assert.throws(()=>applyMovement(s,{type:'entry',id:'alcohol',amount:NaN}));s.materials[0].stock=-1;assert.throws(()=>validateBackup(s,catalog));});

test('lote de varios perfumes y tamaños descuenta el total de cada materia prima',async()=>{
 const{produceBatch}=await import('./inventory.js');let s=initialState(catalog);
 for(const[id,amount]of[['alcohol',4000],['galaxolide',1000],['ess-'+catalog[0].id,250],['ess-'+catalog[1].id,250]])s=applyMovement(s,{type:'entry',id,amount});
 const next=produceBatch(s,[{id:catalog[0].id,size:100,qty:2},{id:catalog[1].id,size:50,qty:3},{id:catalog[0].id,size:50,qty:1}],{essence:25,fixative:5},catalog);
 assert.equal(next.ready[catalog[0].id+'-100'],2);assert.equal(next.ready[catalog[1].id+'-50'],3);assert.equal(next.ready[catalog[0].id+'-50'],1);
 assert.equal(next.materials[0].stock,3720);assert.equal(next.materials[1].stock,980);assert.equal(next.materials[2].stock,187.5);assert.equal(next.materials[3].stock,212.5);
 assert.equal(s.materials[0].stock,4000);
});
test('un fallo tardío en el lote no guarda las filas anteriores',async()=>{
 const{produceBatch}=await import('./inventory.js');let s=initialState(catalog);
 for(const[id,amount]of[['alcohol',4000],['galaxolide',1000],['ess-'+catalog[0].id,250]])s=applyMovement(s,{type:'entry',id,amount});
 const before=JSON.stringify(s);assert.throws(()=>produceBatch(s,[{id:catalog[0].id,size:100,qty:1},{id:catalog[1].id,size:100,qty:1}],{essence:25,fixative:5},catalog));assert.equal(JSON.stringify(s),before);
 assert.throws(()=>produceBatch(s,[],{essence:25,fixative:5},catalog));
});
test('actualiza saldos absolutos en cuartos, galones y ml y conserva respaldos antiguos',async()=>{
 const{setMaterialStock}=await import('./inventory.js');let s=initialState(catalog);
 s=setMaterialStock(s,{id:'ess-'+id,amount:3,factor:62.5,unit:'cuartos'});assert.equal(s.materials[2].stock,187.5);
 s=setMaterialStock(s,{id:'ess-'+id,amount:1,factor:62.5,unit:'cuartos'});assert.equal(s.materials[2].stock,62.5);assert.equal(s.movements[0].delta,-125);
 s=setMaterialStock(s,{id:'alcohol',amount:1.5,factor:4000,unit:'galones'});assert.equal(s.materials[0].stock,6000);
 s=setMaterialStock(s,{id:'galaxolide',amount:125});assert.equal(s.materials[1].stock,125);
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s)),catalog),s);const old=structuredClone(s);delete old.unitSettings;assert.equal(validateBackup(old,catalog).materials[0].stock,6000);assert.equal(validateBackup(old,catalog).unitSettings.quarterMl,62.5);
});
test('ingreso múltiple de perfumes terminados no descuenta materia prima',async()=>{
 const{readyBatch}=await import('./inventory.js'),s=initialState(catalog);const next=readyBatch(s,[{id,size:50,qty:2},{id:catalog[1].id,size:100,qty:3}],catalog);assert.deepEqual(next.materials,s.materials);assert.equal(next.ready[id+'-50'],2);assert.equal(next.ready[catalog[1].id+'-100'],3);
});
