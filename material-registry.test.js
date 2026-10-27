import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,validateBackup,applyMovement,produceBatch} from './inventory.js';
import {registerMaterial,discontinueMaterial,catalogForState,essenceDirectory} from './material-registry.js';
import {createEssenceDirectoryPdf,materialsQuoteEssences} from './materials-pdf.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const input={kind:'Esencia',name:'Aurora Nueva',reference:'Original Nuevo',brand:'Casa Nueva',category:'Unisex',line:'Nicho',stock:'457.25',price50:'400',price100:'600'};

test('alta exige nombre comercial y existencias explícitas, sin modificar nada en caso de error',()=>{
 const state=initialState(catalog),before=JSON.stringify(state);
 for(const patch of [{name:''},{name:'   '},{stock:''},{stock:undefined},{stock:' '},{stock:-1},{stock:'abc'},{reference:''},{brand:''},{category:''},{line:''},{name:catalog[0].name},{price50:-1}])assert.throws(()=>registerMaterial(state,{...input,...patch},catalog));
 assert.equal(JSON.stringify(state),before);
 const zero=registerMaterial(state,{...input,stock:'0'},catalog);assert.equal(zero.materials.at(-1).stock,0);
});
test('altas sucesivas conservan IDs únicos, saldo y catálogo después de respaldar y volver a cargar',()=>{
 const original=initialState(catalog),before=JSON.stringify(original);
 let state=registerMaterial(original,input,catalog);state=registerMaterial(state,{...input,name:'Otra Esencia'},catalog);state=registerMaterial(state,{kind:'Base',name:'Base Nueva',stock:'750'},catalog);
 const restored=validateBackup(JSON.parse(JSON.stringify(state)),catalog),effective=catalogForState(catalog,restored);
 assert.deepEqual(restored.materials,state.materials);assert.deepEqual(restored.movements,state.movements);assert.equal(restored.customProducts.length,2);assert.equal(restored.customBaseMaterials.length,1);assert.equal(new Set(effective.map(p=>p.id)).size,effective.length);assert.equal(effective.find(p=>p.name===input.name).reference,input.reference);assert.equal(JSON.stringify(original),before);
 assert.throws(()=>validateBackup({...state,customProducts:[...state.customProducts,state.customProducts[0]]},catalog));
 assert.throws(()=>validateBackup({...state,discontinuedMaterialIds:['ess-999']},catalog));
});
test('una esencia nueva funciona en cotización y producción y su historial sobrevive la descontinuación',()=>{
 let state=registerMaterial(initialState(catalog),input,catalog),effective=catalogForState(catalog,state);const id=effective.find(p=>p.name===input.name).id;
 for(const material of ['alcohol','galaxolide'])state=applyMovement(state,{id:material,type:'entry',amount:1000});
 state=produceBatch(state,[{id,size:50,qty:1}],effective);const before=JSON.stringify(state),stock=state.materials.find(m=>m.id==='ess-'+id).stock;
 assert.equal(stock,442.25);assert.equal(state.ready[id+'-50'],1);assert.equal(materialsQuoteEssences(state,effective,{selectedIds:['ess-'+id]})[0].house,input.brand);
 const retired=discontinueMaterial(state,'ess-'+id),restored=validateBackup(retired,catalog);effective=catalogForState(catalog,restored);
 assert.equal(restored.materials.find(m=>m.id==='ess-'+id).stock,stock);assert.deepEqual(restored.ready,state.ready);assert.deepEqual(restored.batches,state.batches);assert.deepEqual(restored.salesNotes,state.salesNotes);assert.equal(restored.movements.length,state.movements.length+1);assert.equal(effective.find(p=>p.id===id).discontinued,true);assert.equal(JSON.stringify(state),before);
 assert.throws(()=>produceBatch(restored,[{id,size:50,qty:1}],effective));assert.throws(()=>applyMovement(restored,{id:'ess-'+id,type:'entry',amount:1}));assert.throws(()=>discontinueMaterial(state,'alcohol'));
});
test('K de Dolce & Gabbana se descontinúa conservando el saldo e historial de un respaldo anterior',()=>{
 const legacy=catalog.map(p=>p.id==='13'?{...p,discontinued:false}:p);let state=initialState(legacy);state=applyMovement(state,{id:'ess-13',type:'entry',amount:375});state.ready['13-50']=2;
 const restored=validateBackup(state,catalog);assert.equal(restored.materials.find(m=>m.id==='ess-13').discontinued,true);assert.equal(restored.materials.find(m=>m.id==='ess-13').stock,375);assert.deepEqual(restored.ready,state.ready);assert.deepEqual(restored.movements,state.movements);assert.equal(catalog.find(p=>p.id==='13').brand,'Dolce & Gabbana');
});
test('una base personalizada y sus existencias se conservan después de descontinuarla',()=>{
 let state=registerMaterial(initialState(catalog),{kind:'Fijador',name:'Fijador Nuevo',stock:'800'},catalog);const id=state.materials.at(-1).id;state=discontinueMaterial(state,id);const restored=validateBackup(state,catalog);assert.equal(restored.materials.find(m=>m.id===id).stock,800);assert.equal(restored.materials.find(m=>m.id===id).discontinued,true);assert.equal(essenceDirectory(restored,catalog).some(item=>item.name==='Fijador Nuevo'),false);
});
test('PDF imprimible enumera todas las esencias y descontinuadas, sin capacidad, existencias ni mínimos',async()=>{
 let state=registerMaterial(initialState(catalog),input,catalog);state=registerMaterial(state,{...input,name:'Retirada Nueva',reference:'Otra Original'},catalog);const id=state.customProducts.at(-1).id;state=discontinueMaterial(state,'ess-'+id);const effective=catalogForState(catalog,state),before=JSON.stringify(state),rows=essenceDirectory(state,effective);
 assert.equal(rows.length,catalog.length+2);assert.ok(rows.some(row=>row.discontinued&&row.reference==='K (King)'));assert.ok(rows.some(row=>row.discontinued&&row.reference==='Ralph Fresh'));assert.ok(rows.some(row=>row.discontinued&&row.name==='Retirada Nueva'));
 const result=await createEssenceDirectoryPdf(state,effective),pdf=await result.blob.text();assert.match(pdf,/^%PDF-/);assert.match(pdf,/Aurora Nueva/);assert.match(pdf,/Retirada Nueva/);assert.match(pdf,/Descontinuadas/);assert.match(pdf,/Original Nuevo/);assert.match(pdf,/Casa Nueva/);assert.doesNotMatch(pdf,/457\.25|Existencias|Capacidad|\bml\b|Galaxolide|Alcohol/);assert.equal(JSON.stringify(state),before);
});
