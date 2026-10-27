import './quotation-reader-compat.js?v=93';
// Local document reader: no document contents leave the browser.
export function linesFromPdfItems(items,viewport,page){
 const groups=[];
 for(const item of items){if(!item.str?.trim()||!item.transform)continue;const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]),height=Math.abs(item.height||10)*viewport.scale;let line=groups.find(g=>Math.abs(g.top-y)<Math.max(3,height*.3));if(!line){line={top:y,height,parts:[]};groups.push(line);}line.parts.push({x,text:item.str});}
 return groups.sort((a,b)=>a.top-b.top).map(g=>({page,y:Math.max(0,Math.min(1,(g.top-g.height*.35)/viewport.height)),text:g.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')}));
}
export function linesFromTsv(tsv,page,height){
 const groups=new Map();for(const line of String(tsv??'').split('\n').slice(1)){const parts=line.split('\t');if(parts[0]!=='5'||!parts[11]?.trim())continue;const key=parts.slice(1,5).join('-'),top=Number(parts[7]),h=Number(parts[9]);if(!Number.isFinite(top)||!Number.isFinite(h))continue;let group=groups.get(key);if(!group){group={top,height:h,words:[]};groups.set(key,group);}group.words.push(parts.slice(11).join('\t'));}
 return [...groups.values()].sort((a,b)=>a.top-b.top).map(g=>({page,y:Math.max(0,Math.min(1,(g.top+g.height/2)/height)),text:g.words.join(' ')}));
}
export function createQuotationReader(){
 let generation=0,pdfTask=null,worker=null;
 async function cancel(){generation++;const task=pdfTask,w=worker;pdfTask=null;worker=null;await Promise.allSettled([task?.destroy(),w?.terminate()]);}
 async function read(file,onProgress=()=>{}){
  await cancel();const token=generation,pages=[],lines=[];let pixels=0;
  const check=()=>{if(token!==generation)throw Error('Lectura cancelada.');};
  if(!file||file.size>20*1024*1024||!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)||/^image\/(png|jpeg|webp)$/.test(file.type)))throw Error('Carga un PDF, JPG, PNG o WebP de hasta 20 MB.');
  const ocr=async(canvas,page)=>{check();onProgress(`Leyendo imagen de la página ${page}…`);if(!worker){const {default:Tesseract}=await import('./assets/ocr/tesseract.esm.min.js');check();const base=new URL('./assets/ocr/',import.meta.url).href,created=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base+'tesseract-core-lstm.wasm.js',langPath:base,workerBlobURL:false,logger:m=>{if(token===generation&&m.status==='recognizing text')onProgress(`Leyendo página ${page}: ${Math.round((m.progress??0)*100)} %`);}});if(token!==generation){await created.terminate();check();}worker=created;await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});}const {data}=await worker.recognize(canvas,{}, {text:true,tsv:true});check();return linesFromTsv(data.tsv,page,canvas.height);};
  const append=async(canvas,page,textLines)=>{check();pixels+=canvas.width*canvas.height;if(pixels>24000000)throw Error('El documento tiene demasiadas imágenes. Divide la cotización en archivos más pequeños.');pages.push({page,width:canvas.width,height:canvas.height,image:canvas.toDataURL('image/jpeg',.9)});lines.push(...(textLines?.some(l=>l.text.trim().length>5)?textLines:await ocr(canvas,page)));canvas.width=canvas.height=1;};
  try{
   if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
    // PDF.js legacy build also supports Safari without Promise.withResolvers.
    if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};};
    const pdfjs=await import('./assets/quote-reader/pdf.mjs?v=93');check();pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/quote-reader/pdf.worker.mjs?v=93',import.meta.url).href;
    const bytes=new Uint8Array(await file.arrayBuffer());check();const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true,stopAtErrors:true});pdfTask=task;
    const doc=await task.promise;check();if(doc.numPages>15)throw Error('Carga hasta 15 páginas por cotización.');
    for(let n=1;n<=doc.numPages;n++){check();onProgress(`Abriendo página ${n} de ${doc.numPages}…`);const page=await doc.getPage(n),base=page.getViewport({scale:1}),scale=Math.min(2,1600/base.width,2000/base.height),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;check();const content=await page.getTextContent();await append(canvas,n,linesFromPdfItems(content.items,viewport,n));page.cleanup();}
   }else{
    const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();check();if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('Usa una imagen de hasta 40 megapíxeles.');const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);await append(canvas,1,null);}finally{URL.revokeObjectURL(url);}
   }
   check();return {name:file.name,pages,lines};
  }finally{if(token===generation){const task=pdfTask,w=worker;pdfTask=null;worker=null;await Promise.allSettled([task?.destroy(),w?.terminate()]);}}
 }
 return {read,cancel};
}
