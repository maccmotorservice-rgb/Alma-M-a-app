import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';
import {initialState,validateBackup,attributeSessionChanges}from'./inventory.js';
import {printSupplyItems,validatePrintStock,applyPrintStock}from'./print-stock.js';
import {workspaceAreas,workspaceAreaHtml}from'./aura.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
test('stock de tiras y etiquetas empieza sin conteos inventados y conserva compatibilidad con respaldos antiguos',()=>{
 const state=initialState(catalog);assert.equal(state.printSupplyStock,undefined);assert.equal(printSupplyItems.length,4);assert.deepEqual(printSupplyItems.map(item=>item.id).sort(),['labels-100','labels-50','strips-100','strips-50']);assert.equal(validateBackup(state,catalog).printSupplyStock,undefined);
});
test('conteo inicial, entradas y salidas se conservan al recargar con responsable y sin cambiar materias, perfumes o ventas',()=>{
 const state=initialState(catalog),before=JSON.stringify(state);let next=applyPrintStock(state,{id:'strips-100',type:'adjust',amount:100,expectedStock:null});next=applyPrintStock(next,{id:'strips-100',type:'entry',amount:20,expectedStock:100});next=applyPrintStock(next,{id:'strips-100',type:'exit',amount:35,note:'Uso físico',expectedStock:120});next=applyPrintStock(next,{id:'labels-50',type:'adjust',amount:0});next=attributeSessionChanges(state,next,'Luis');const restored=validateBackup(JSON.parse(JSON.stringify(next)),catalog);
 assert.deepEqual(restored.printSupplyStock,{'strips-100':85,'labels-50':0});assert.ok(restored.movements.every(m=>m.unit==='unidades'&&m.performedBy==='Luis'));assert.equal(restored.movements[1].delta,-35);assert.deepEqual(restored.materials,state.materials);assert.deepEqual(restored.ready,state.ready);assert.deepEqual(restored.salesNotes,state.salesNotes);assert.equal(JSON.stringify(state),before);
});
test('stock físico rechaza negativos, fracciones, salidas excesivas, conteos vacíos y cambios concurrentes',()=>{
 const state=initialState(catalog),base={id:'labels-100',type:'adjust',amount:5};for(const amount of ['',undefined,null,-1,1.5,'x',Infinity])assert.throws(()=>applyPrintStock(state,{...base,amount}));assert.throws(()=>applyPrintStock(state,{...base,type:'entry'}));const counted=applyPrintStock(state,base);assert.throws(()=>applyPrintStock(counted,{...base,type:'exit',amount:6}));assert.throws(()=>applyPrintStock(counted,{...base,expectedStock:null}),/otra sesión/);assert.throws(()=>validatePrintStock({'not-a-supply':1}));assert.throws(()=>validateBackup({...state,printSupplyStock:{'labels-50':1.2}},catalog));
});
test('menús y áreas contienen exactamente la organización solicitada y accesos grandes sin formularios abiertos',()=>{
 assert.deepEqual(workspaceAreas.map(area=>area.name),['Inventario','Producción','Ventas','Compras','Diseño','Imprimir','Catálogo']);assert.deepEqual(workspaceAreas.find(area=>area.id==='inventory').items.map(([route])=>route),['materials','ready','print-stock']);assert.deepEqual(workspaceAreas.find(area=>area.id==='production').items.map(([route])=>route),['batches','sales-new']);assert.deepEqual(workspaceAreas.find(area=>area.id==='print').items.map(([route])=>route),['labels','strips']);
 for(const area of workspaceAreas){const html=workspaceAreaHtml(area.id);assert.equal((html.match(/class="card workspace-area-action"/g)||[]).length,area.items.length);assert.doesNotMatch(html,/<form|<input/);for(const [route]of area.items)assert.ok(html.includes('data-view="'+route+'"'));}assert.match(workspaceAreaHtml('design'),/Pendiente/);
});
