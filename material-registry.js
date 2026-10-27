import {cloneData,randomId} from './clone-data.js?v=92';
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const validPrice=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*100-Math.round(value*100))<.000001;
const text=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>120)throw Error('Indica '+label+' (máximo 120 caracteres).');return value.trim();};

export function materialRegistry(state={},baseCatalog=[]){
 const products=state.customProducts??[],bases=state.customBaseMaterials??[],discontinued=state.discontinuedMaterialIds??[];
 if(!Array.isArray(products)||products.length>800||!Array.isArray(bases)||bases.length>100||!Array.isArray(discontinued)||new Set(discontinued).size!==discontinued.length||discontinued.some(id=>typeof id!=='string'))throw Error('Registro de materias primas inválido.');
 const ids=new Set(baseCatalog.filter(p=>!p.custom).map(p=>p.id)),names=new Set();
 for(const p of products){
  if(!p||!/^\d{3}$/.test(p.id)||Number(p.id)<200||ids.has(p.id)||p.custom!==true||!['Dama','Caballero','Unisex'].includes(p.category)||!['Diseñador','Nicho'].includes(p.line)||![p.price50,p.price100].every(n=>Number.isFinite(n)&&n>=0))throw Error('Esencia personalizada inválida.');
  text(p.name,'el nombre comercial');text(p.reference,'el nombre original');text(p.brand,'la casa productora');
  if(names.has(norm(p.name)))throw Error('Hay nombres comerciales repetidos.');ids.add(p.id);names.add(norm(p.name));
 }
 const baseIds=new Set(['alcohol','galaxolide']);
 for(const m of bases){if(!m||typeof m.id!=='string'||!/^raw-[a-zA-Z0-9-]+$/.test(m.id)||baseIds.has(m.id)||!['Base','Fijador'].includes(m.kind))throw Error('Materia prima personalizada inválida.');text(m.name,'el nombre comercial');if(names.has(norm(m.name)))throw Error('Hay nombres comerciales repetidos.');names.add(norm(m.name));baseIds.add(m.id);}
 for(const id of discontinued)if(!(id.startsWith('ess-')?ids.has(id.slice(4)):baseIds.has(id)))throw Error('Materia prima descontinuada desconocida.');
 const prices=state.catalogPriceOverrides??{};
 if(!prices||typeof prices!=='object'||Array.isArray(prices)||Object.entries(prices).some(([id,value])=>!ids.has(id)||!value||!validPrice(value.price50)||!validPrice(value.price100)))throw Error('Precios personalizados del catálogo inválidos.');
 return {products:cloneData(products),bases:cloneData(bases),discontinued:[...discontinued],prices:cloneData(prices)};
}
export function catalogForState(baseCatalog,state={}){
 const registry=materialRegistry(state,baseCatalog),retired=new Set(registry.discontinued);
 return [...baseCatalog.filter(p=>!p.custom),...registry.products].map(p=>({...p,...registry.prices[p.id],...(retired.has('ess-'+p.id)?{discontinued:true}:{})}));
}
export function registerMaterial(state,input,catalog){
 catalog=catalogForState(catalog,state);
 const name=text(input.name,'el nombre comercial'),kind=input.kind;
 if(!['Esencia','Base','Fijador'].includes(kind))throw Error('Selecciona el tipo de materia prima.');
 if(state.materials.some(m=>norm(m.name)===norm(name)))throw Error('Ese nombre comercial ya está registrado, incluso entre descontinuados.');
 if(input.stock===undefined||input.stock===null||String(input.stock).trim()===''||!Number.isFinite(Number(input.stock))||Number(input.stock)<0)throw Error('Indica cuánto tienes actualmente en ml (puede ser cero).');
 const stock=Number(input.stock),next=cloneData(state);let id;
 if(kind==='Esencia'){
  const reference=text(input.reference,'el nombre original'),brand=text(input.brand,'la casa productora');
  if(!['Dama','Caballero','Unisex'].includes(input.category)||!['Diseñador','Nicho'].includes(input.line))throw Error('Selecciona la categoría y colección de la esencia.');
  const price50=input.price50===''||input.price50===undefined?0:Number(input.price50),price100=input.price100===''||input.price100===undefined?0:Number(input.price100);
  if(![price50,price100].every(n=>Number.isFinite(n)&&n>=0))throw Error('Los precios deben ser cero o mayores.');
  const used=new Set(catalog.map(p=>p.id));id=Array.from({length:800},(_,i)=>String(i+200)).find(id=>!used.has(id));if(!id)throw Error('Se alcanzó el límite de esencias personalizadas.');
  const p={id,name,reference,brand,category:input.category,line:input.line,price50,price100,custom:true,family:'Sin clasificar',description:'',notes:{top:[],heart:[],base:[]},guideReference:brand+' / '+reference,displayReference:reference+' — '+brand+' · '+input.category};
  next.customProducts=[...(next.customProducts??[]),p];id='ess-'+id;
 }else{id='raw-'+randomId();next.customBaseMaterials=[...(next.customBaseMaterials??[]),{id,name,kind}];}
 next.materials.push({id,name,kind,stock,min:kind==='Esencia'?30:0});
 next.movements.unshift({date:new Date().toISOString(),label:name,detail:'Alta de materia prima · Existencias iniciales',delta:stock,unit:'ml'});
 return next;
}
export function discontinueMaterial(state,id){
 const material=state.materials.find(m=>m.id===id);if(!material||material.discontinued)throw Error('Materia prima no disponible.');
 if(['alcohol','galaxolide'].includes(id))throw Error('Alcohol y galaxolide se requieren para la fórmula de producción.');
 const next=cloneData(state);next.discontinuedMaterialIds=[...new Set([...(next.discontinuedMaterialIds??[]),id])];next.materials.find(m=>m.id===id).discontinued=true;
 next.movements.unshift({date:new Date().toISOString(),label:material.name,detail:'Materia prima descontinuada · Se conservan existencias e historial',delta:0,unit:'ml'});return next;
}
export function essenceDirectory(state,catalog){
 return state.materials.filter(m=>m.kind==='Esencia').map(m=>{const p=catalog.find(p=>p.id===m.id.slice(4));return {name:m.name,reference:p?.reference??'',brand:p?.brand??'',category:p?.category??'',discontinued:Boolean(m.discontinued||p?.discontinued)};}).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));
}

// Unisex is its own group, so group price changes never overlap.
export const catalogPriceGroups=[['designer','Diseñador'],['niche','Nicho'],['unisex','Unisex']];
export function catalogPriceTargets(catalog,scope,id){
 const active=catalog.filter(p=>!p.discontinued);
 if(scope==='individual')return active.filter(p=>p.id===id);
 if(scope==='group')return active.filter(p=>id==='unisex'?p.category==='Unisex':id==='designer'?p.category!=='Unisex'&&p.line==='Diseñador':id==='niche'?p.category!=='Unisex'&&p.line==='Nicho':false);
 return [];
}
export function setCatalogPrices(state,{scope,id,price50,price100,expected},catalog){
 catalog=catalogForState(catalog,state);
 const number=value=>{if(value===null||value===undefined||String(value).trim()===''||!validPrice(Number(value)))throw Error('Indica ambos precios en MXN, con un máximo de dos decimales y entre 0 y 1,000,000.');return Number(value);};
 const prices={price50:number(price50),price100:number(price100)},targets=catalogPriceTargets(catalog,scope,id);
 if(!targets.length)throw Error('Selecciona perfumes activos para cambiar sus precios.');
 if(expected&&JSON.stringify(targets.map(p=>({id:p.id,price50:p.price50,price100:p.price100})))!==JSON.stringify(expected))throw Error('El catálogo cambió en otra sesión. Revisa los perfumes y vuelve a confirmar.');
 const next=cloneData(state);next.catalogPriceOverrides={...(next.catalogPriceOverrides??{})};
 for(const p of targets)next.catalogPriceOverrides[p.id]={...prices};
 return next;
}
