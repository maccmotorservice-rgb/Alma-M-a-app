import {cloneData} from './clone-data.js?v=94';
export const printSupplyItems=[{id:'strips-100',name:'Tiras de 100 ml',kind:'Tiras',size:100},{id:'strips-50',name:'Tiras de 50 ml',kind:'Tiras',size:50},{id:'labels-100',name:'Etiquetas de 100 ml',kind:'Etiquetas',size:100},{id:'labels-50',name:'Etiquetas de 50 ml',kind:'Etiquetas',size:50}];
export function validatePrintStock(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.entries(input).some(([id,stock])=>!printSupplyItems.some(item=>item.id===id)||(stock!==null&&(!Number.isSafeInteger(stock)||stock<0))))throw Error('Stock de tiras y etiquetas inválido.');
 return {...input};
}
export function applyPrintStock(state,{id,type,amount,note='',expectedStock}){
 const item=printSupplyItems.find(item=>item.id===id),before=state.printSupplyStock?.[id]??null;
 if(!item||!['adjust','entry','exit'].includes(type))throw Error('Selecciona el artículo y un movimiento válido.');
 if(amount===undefined||amount===null||String(amount).trim()===''||!Number.isSafeInteger(Number(amount))||Number(amount)<(type==='adjust'?0:1))throw Error('Indica una cantidad entera válida de unidades.');
 if(expectedStock!==undefined&&expectedStock!==before)throw Error('El stock cambió en otra sesión. Revisa el conteo antes de guardar.');
 if(before===null&&type!=='adjust')throw Error('Registra primero el conteo inicial de este artículo.');
 const qty=Number(amount),stock=type==='adjust'?qty:before+(type==='entry'?qty:-qty);
 if(!Number.isSafeInteger(stock)||stock<0)throw Error('No hay suficientes unidades disponibles.');
 if(typeof note!=='string'||note.length>200)throw Error('La nota debe tener un máximo de 200 caracteres.');
 const next=cloneData(state);next.printSupplyStock={...(next.printSupplyStock??{}),[id]:stock};next.movements.unshift({date:new Date().toISOString(),label:item.name,detail:(type==='adjust'?'Conteo de existencias':type==='entry'?'Entrada de stock':'Salida de stock')+(note.trim()?' · '+note.trim():''),delta:stock-(before??0),unit:'unidades'});return next;
}
