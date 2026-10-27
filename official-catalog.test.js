import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {catalogPrintPages,catalogPrice,createOfficialCatalogPdf} from './official-catalog.js';
import {initialState,validateBackup} from './inventory.js';import {registerMaterial,discontinueMaterial,catalogForState,setCatalogPrices} from './material-registry.js';
const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url)));
const input={kind:'Esencia',name:'Nueva Aurora',reference:'Original Aurora',brand:'Casa Aurora',category:'Unisex',line:'Nicho',stock:0,price50:450,price100:650};
test('catálogo conserva el formato vertical oficial, 110 perfumes activos, orden por casa y numeración continua',()=>{
 const pages=catalogPrintPages(catalog),rows=pages.flatMap(page=>page.rows);assert.equal(pages.length+1,12);assert.equal(rows.length,110);assert.deepEqual(rows.map(row=>row.number),Array.from({length:110},(_,i)=>i+1));assert.equal(new Set(rows.map(row=>row.product.id)).size,110);assert.ok(rows.every(row=>!row.product.discontinued));assert.ok(!rows.some(row=>['13','75'].includes(row.product.id)));
 for(const page of pages){assert.ok(page.rows.length<=13);assert.ok(page.rows.every(row=>row.y>=413&&row.y+row.height<=1818));for(let i=1;i<page.rows.length;i++)assert.ok(page.rows[i].y>=page.rows[i-1].y+page.rows[i-1].height+8);}
 assert.equal(rows.find(row=>row.number===13).product.id,'14');assert.equal(rows.find(row=>row.product.id==='94').number,92);
});
test('el PDF se recompone con altas, bajas y precios vigentes sin mostrar descontinuados',()=>{
 let state=registerMaterial(initialState(catalog),input,catalog);const id=state.customProducts[0].id;state=setCatalogPrices(state,{scope:'individual',id,price50:450.5,price100:650.75},catalog);state=discontinueMaterial(state,'ess-01');const effective=catalogForState(catalog,validateBackup(state,catalog)),rows=catalogPrintPages(effective).flatMap(page=>page.rows);
 assert.equal(rows.length,110);assert.equal(rows.find(row=>row.product.id===id).product.price50,450.5);assert.ok(!rows.some(row=>row.product.id==='01'));assert.equal(catalogPrice(450.5),'$450.50');assert.equal(catalogPrice(429),'$429');
});
test('nombres largos y referencias se ajustan dentro de las tarjetas sin invadir precios ni pie de página',()=>{
 const products=Array.from({length:50},(_,i)=>({...catalog[0],id:String(i+200),name:'Fragancia de nombre comercial especialmente extenso '.repeat(2).slice(0,120),reference:'Una referencia original con caracteres acentuados y palabras largas '.repeat(2).slice(0,120)}));const pages=catalogPrintPages(products),rows=pages.flatMap(page=>page.rows);assert.equal(rows.length,50);assert.ok(rows.every(row=>row.nameLines.length>1&&row.height>84&&row.y+row.height<=1818));
});
test('genera PDF completo con portada del archivo oficial y fuentes de texto editado',async()=>{
 const assets=Object.fromEntries([['cover','cover.png'],['brand','brand.png'],['normal','DejaVuSans.ttf'],['bold','DejaVuSans-Bold.ttf']].map(([key,name])=>[key,readFileSync(new URL('./assets/catalog/'+name,import.meta.url)).toString('base64')]));
 const before=JSON.stringify(catalog),result=await createOfficialCatalogPdf(catalog,{assets});assert.equal(result.products,110);assert.equal(result.pages,12);assert.equal(result.filename,'Catalogo-Alma-Mia-2026.pdf');assert.match(await result.blob.slice(0,8).text(),/^%PDF-/);assert.ok(result.blob.size>300000);assert.equal(JSON.stringify(catalog),before);
});
