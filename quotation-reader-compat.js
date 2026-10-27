import {cloneDataFallback} from './clone-data.js?v=94';
export function installQuotationReaderCompatibility(){
 if(typeof globalThis.structuredClone!=='function')globalThis.structuredClone=value=>cloneDataFallback(value);
 if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};};
}
installQuotationReaderCompatibility();
