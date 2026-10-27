import {cloneData} from './clone-data.js?v=86';
import {validateSalesNotes,salesPaymentSummary} from './sales.js?v=86';
import {historicalSignature} from './sales-analytics.js?v=86';
export function historicalMatch(existing,note,catalog){return existing.find(n=>n.importSource?.sha256===note.importSource?.sha256||n.id===note.id||historicalSignature(n,catalog)===historicalSignature(note,catalog));}
export function mergeHistoricalSales(state,incoming,catalog,actor,at=new Date().toISOString()){
 if(!['Luis','Ximena'].includes(actor))throw Error('Inicia sesión antes de cargar las notas.');
 const next=cloneData(state);next.salesNotes??=[];let added=0,linked=0;
 for(const source of incoming){const candidate={...cloneData(source),createdAt:at,createdBy:actor,paymentType:'cash',payments:[]};delete candidate.pdfBase64;if(!candidate.sourcePdf||!candidate.importSource)throw Error('Falta el PDF original de una nota histórica.');validateSalesNotes([candidate]);const existing=historicalMatch(next.salesNotes,candidate,catalog);
  if(existing){if(!existing.importSource){if(existing.status==='cancelled'||salesPaymentSummary(existing).status!=='paid')throw Error('Ya existe una nota coincidente cancelada o pendiente: '+existing.customer+'. Revísala antes de importar.');existing.importSource=candidate.importSource;existing.sourcePdf=candidate.sourcePdf;linked++;}continue;}
  next.salesNotes.push(candidate);added++;
 }
 next.salesNotes.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));return {state:next,added,linked};
}
