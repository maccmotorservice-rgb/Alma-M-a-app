import {inspectStripImageBlob} from './strip-image-format.js?v=78';
// Print geometry is in millimetres; previews and PDFs share this renderer.
// This module only creates artwork. It never changes stock or business records.
export const STRIP_DESIGN_SIZES=Object.freeze({
  50:Object.freeze({w:71.9,h:390}),
  100:Object.freeze({w:80.1,h:431.8})
});
const CATEGORIES=['Dama','Caballero','Unisex'];
const CREAM='#e0e0d4',FONT='AlmaStrip';

export function validateStripDesign(input){
  if(!input||typeof input!=='object')throw Error('Completa los datos de la tira.');
  if(typeof input.name!=='string')throw Error('Escribe el nombre del perfume.');
  const name=input.name.normalize('NFC').replace(/\s+/gu,' ').trim();
  if(!name||Array.from(name).length>80||/[\u0000-\u001f\u007f]/u.test(name))throw Error('El nombre debe tener entre 1 y 80 caracteres.');
  const size=Number(input.size);
  if(!STRIP_DESIGN_SIZES[size])throw Error('Selecciona una presentación de 50 o 100 ml.');
  if(typeof input.color!=='string'||!/^#[0-9a-f]{6}$/i.test(input.color))throw Error('Selecciona un color válido para la tira.');
  const textColor=input.textColor??'auto';
  if(textColor!=='auto'&&(typeof textColor!=='string'||!/^#[0-9a-f]{6}$/i.test(textColor)))throw Error('Selecciona un color válido para el texto.');
  const textScale=input.textScale===undefined?1:Number(input.textScale);
  if(!Number.isFinite(textScale)||textScale<.5||textScale>1.6)throw Error('El tamaño del texto debe estar entre 50 % y 160 %.');
  const textPosition=input.textPosition===undefined?50:Number(input.textPosition);
  if(!Number.isFinite(textPosition)||textPosition<0||textPosition>100)throw Error('La altura del texto debe estar entre 0 % y 100 %.');
  // v74 stored personalization as a category. Read those designs without losing artwork.
  const legacyPersonalized=input.category==='Personalizada';
  const category=legacyPersonalized?'Unisex':input.category??'Unisex';
  if(!CATEGORIES.includes(category))throw Error('Selecciona Dama, Caballero o Unisex.');
  if(input.personalized!==undefined&&typeof input.personalized!=='boolean')throw Error('La opción Personalizada debe estar activada o desactivada.');
  const qty=input.qty===undefined?1:Number(input.qty);
  if(!Number.isInteger(qty)||qty<1||qty>999)throw Error('La cantidad debe ser un número entero entre 1 y 999.');
  const design={name,color:input.color.toLowerCase(),textColor:textColor.toLowerCase(),textScale,textPosition,size,category,qty};
  if(input.personalized===true||legacyPersonalized){design.personalized=true;design.custom=validateStripCustomization(input.custom);}
  for(const key of ['id','productId'])if(input[key]!==undefined&&input[key]!==null)design[key]=String(input[key]);
  return design;
}

export const MAX_STRIP_DESIGN_IMAGE_BYTES=20*1024*1024;
export const defaultStripCustomization=()=>({logo:{x:100,y:0},capacity:{x:0,y:100},message:'',imageFit:'cover'});
function validateStripCustomization(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Las opciones de la tira personalizada no son válidas.');
 const custom=defaultStripCustomization();
 for(const part of ['logo','capacity']){
  const point=input[part]??custom[part];
  if(!point||typeof point!=='object'||['x','y'].some(axis=>point[axis]===''||!Number.isFinite(Number(point[axis]))||Number(point[axis])<0||Number(point[axis])>100))throw Error('La posición del logotipo y la capacidad debe estar entre 0 % y 100 %.');
  custom[part]={x:Number(point.x),y:Number(point.y)};
 }
 if(input.message!==undefined&&typeof input.message!=='string')throw Error('Escribe un mensaje válido.');
 custom.message=(input.message??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\t/g,' ').trim();
 if(Array.from(custom.message).length>240||custom.message.split('\n').length>8||/[\u0000-\u0009\u000b-\u001f\u007f]/u.test(custom.message))throw Error('El mensaje admite hasta 240 caracteres y 8 líneas.');
 custom.imageFit=input.imageFit??'cover';if(!['cover','contain'].includes(custom.imageFit))throw Error('Selecciona cómo ajustar la imagen al recuadro.');
 if(input.image!==undefined){
  const image=input.image;
  if(!image||typeof image.name!=='string'||!image.name.trim()||image.name.length>120||/[\u0000-\u001f\u007f]/u.test(image.name)||!['image/png','image/jpeg','image/webp'].includes(image.type)||!Number.isSafeInteger(image.size)||image.size<1||image.size>MAX_STRIP_DESIGN_IMAGE_BYTES||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||image.width<1||image.height<1||image.width*image.height>40000000||typeof image.sha256!=='string'||!/^[a-f0-9]{64}$/.test(image.sha256)||typeof image.averageColor!=='string'||!/^#[0-9a-f]{6}$/i.test(image.averageColor))throw Error('La imagen personalizada no es válida. Importa un PNG, JPG o WebP de hasta 20 MB y 40 megapíxeles.');
  custom.image={name:image.name,type:image.type,size:image.size,width:image.width,height:image.height,sha256:image.sha256,averageColor:image.averageColor.toLowerCase()};
 }
 return custom;
}

// Positions are percentages of the safe travel interval, so elements never
// leave the printable rectangle when presentation or image changes.
export function stripCustomPlacement(w,h,logoW,logoH,custom=defaultStripCustomization(),capacityWidth=30){
 const sx=w/73.32,sy=h/90,place=(point,min,max)=>min+(max-min)*point/100;
 return {
  logo:{x:place(custom.logo.x,3.5*sx,w-logoW-3.5*sx),y:place(custom.logo.y,7*sy,h-logoH-4.75*sy)},
  capacity:{x:place(custom.capacity.x,4*sx,Math.max(4*sx,w-capacityWidth-4*sx)),y:place(custom.capacity.y,7*sy+1.68*sx,85.25*sy)}
 };
}
export function stripImagePlacement(imageWidth,imageHeight,w,h,fit='cover'){
 if(![imageWidth,imageHeight,w,h].every(v=>Number.isFinite(v)&&v>0)||!['cover','contain'].includes(fit))throw Error('No se puede ajustar la imagen al recuadro.');
 const scale=(fit==='cover'?Math.max:Math.min)(w/imageWidth,h/imageHeight),width=imageWidth*scale,height=imageHeight*scale;
 return {x:(w-width)/2,y:(h-height)/2,w:width,h:height};
}
export function fitStripMessage(message,maxWidth,measure,{maxSize=3.4,minSize=.6,maxHeight=16}={}){
 if(typeof message!=='string'||!message.trim()||!Number.isFinite(maxWidth)||maxWidth<=0||typeof measure!=='function'||!Number.isFinite(maxHeight)||maxHeight<=0)throw Error('No se puede ajustar el mensaje a la tira.');
 if(!Number.isFinite(maxSize)||!Number.isFinite(minSize)||minSize<=0||maxSize<minSize)throw Error('El tamaño del mensaje no es válido.');
 const at=size=>{
  const lines=[];
  for(const paragraph of message.split('\n')){
   let line='';
   for(const word of paragraph.trim().split(/\s+/u)){
    if(!word)continue;
    if(line&&measure(line+' '+word,size)<=maxWidth){line+=' '+word;continue;}
    if(line){lines.push(line);line='';}
    for(const char of Array.from(word)){if(line&&measure(line+char,size)>maxWidth){lines.push(line);line='';}line+=char;}
   }
   lines.push(line);
  }
  return {lines,size,lineHeight:size*1.25};
 };
 const fits=value=>value.lines.length*value.lineHeight<=maxHeight&&value.lines.every(line=>measure(line,value.size)<=maxWidth+.00001);
 let best=at(minSize);if(!fits(best))throw Error('Acorta el mensaje para que se pueda imprimir completo.');
 let low=minSize,high=maxSize;for(let i=0;i<18;i++){const middle=(low+high)/2,result=at(middle);if(fits(result)){best=result;low=middle;}else high=middle;}
 return best;
}

const customImageCache=new WeakMap();
async function readStripDesignImage(blob){
 if(!blob||typeof blob.arrayBuffer!=='function'||blob.size<1||blob.size>MAX_STRIP_DESIGN_IMAGE_BYTES)throw Error('Importa una imagen PNG, JPG o WebP de hasta 20 MB para este diseño.');
 if(customImageCache.has(blob))return customImageCache.get(blob);
 const pending=(async()=>{
  const checked=await inspectStripImageBlob(blob),url=URL.createObjectURL(checked);let image;
  try{image=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(Error('No se pudo leer la imagen. Prueba otro archivo PNG, JPG o WebP.'));element.src=url;});}finally{URL.revokeObjectURL(url);}
  const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height||width*height>40000000)throw Error('La imagen no debe superar 40 megapíxeles.');
  const sample=document.createElement('canvas');sample.width=sample.height=1;const ctx=sample.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1,1);ctx.drawImage(image,0,0,1,1);const pixel=ctx.getImageData(0,0,1,1).data;
  const averageColor='#'+Array.from(pixel.subarray(0,3),v=>v.toString(16).padStart(2,'0')).join('');
  const digest=await crypto.subtle.digest('SHA-256',await checked.arrayBuffer()),sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  return {image,width,height,sha256,averageColor,type:checked.type,size:checked.size};
 })().catch(error=>{customImageCache.delete(blob);throw error;});customImageCache.set(blob,pending);return pending;
}
export async function prepareStripDesignImage(file){
 const data=await readStripDesignImage(file),name=String(file.name??'Imagen personalizada').normalize('NFC').replace(/[\u0000-\u001f\u007f]/gu,'').trim().slice(0,120)||'Imagen personalizada';
 return {blob:file,metadata:{name,type:data.type,size:data.size,width:data.width,height:data.height,sha256:data.sha256,averageColor:data.averageColor}};
}

export function stripDesignIdentity(input){
 const design=validateStripDesign(input),fields=[design.name,design.size,design.category,design.color];
 if(design.textColor!=='auto'||design.textScale!==1)fields.push(design.textColor,design.textScale);
 if(design.textPosition!==50)fields.push('height',design.textPosition);
 if(design.personalized)fields.push('custom',design.custom);
 return JSON.stringify(fields);
}

export function stripDesignPrintSize(input){
  const size=Number(typeof input==='object'&&input!==null?input.size:input),physical=STRIP_DESIGN_SIZES[size];
  if(!physical)throw Error('Selecciona una presentación de 50 o 100 ml.');
  return {...physical};
}

export function stripDesignGeometry(size){
  const physical=stripDesignPrintSize(size),sx=physical.w/80.1,sy=physical.h/431.8;
  const rect=(x,y,w,h)=>({x:x*sx,y:y*sy,w:w*sx,h:h*sy});
  return {
    physical,
    back:rect(3.41,9.14,73.32,90),
    front:rect(3.41,213.19,73.32,90),
    pill:rect(13.32,146.9,51.3,12.1),
    genderY:164.8*sy,
    foldLines:[6.18,101.77,107.43,203.81,210.24,305.84,311.64,408.51].map(y=>y*sy)
  };
}

export function stripInkColor(color){
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Color no válido.');
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  // Choose the stronger of white and dark ink, including very pale colours.
  return luminance>.179?'#211f1c':'#ffffff';
}

export function fitStripName(name,maxWidth,measure,{maxSize=12,minSize=.25,maxHeight=Infinity,lineHeight=1.18,lineMode='first-word',scale=1}={}){
  if(typeof name!=='string'||!name.trim()||!Number.isFinite(maxWidth)||maxWidth<=0||typeof measure!=='function')throw Error('No se puede ajustar el nombre a la tira.');
  if(!Number.isFinite(maxSize)||!Number.isFinite(minSize)||minSize<=0||maxSize<minSize||!Number.isFinite(lineHeight)||lineHeight<1||!(maxHeight>0))throw Error('Las medidas del texto no son válidas.');
  if(!['first-word','single'].includes(lineMode)||!Number.isFinite(scale)||scale<.5||scale>1.6)throw Error('El ajuste del texto no es válido.');
  const text=name.replace(/\s+/gu,' ').trim(),words=text.split(' ');
  // Faces keep the first word above the rest; the central capsule is always
  // one line. Adjusting size never changes the prescribed line break.
  const lines=lineMode==='single'||words.length===1?[text]:[words[0],words.slice(1).join(' ')];
  const at=size=>({lines:[...lines],size,lineHeight:size*lineHeight});
  const fits=result=>result.lines.length*result.lineHeight<=maxHeight&&result.lines.every(line=>measure(line,result.size)<=maxWidth+.00001);
  let best=at(minSize);
  if(!fits(best))throw Error('El nombre es demasiado largo para la tira. Usa un nombre más breve.');
  let low=minSize,high=maxSize;
  for(let step=0;step<18;step++){
    const size=(low+high)/2,candidate=at(size);
    if(fits(candidate)){best=candidate;low=size;}else high=size;
  }
  // Scale the size that actually fitted, so even a long name can get smaller.
  // Enlargement stops at the available width/height rather than clipping.
  const desired=best.size*scale;
  if(fits(at(desired)))return at(desired);
  low=best.size;high=desired;
  for(let step=0;step<18;step++){
    const size=(low+high)/2,candidate=at(size);
    if(fits(candidate)){best=candidate;low=size;}else high=size;
  }
  return best;
}

let assetsPromise;
async function loadAssets(){
  if(!assetsPromise)assetsPromise=(async()=>{
    if(typeof document==='undefined'||typeof Image==='undefined')throw Error('Abre el generador en un navegador para crear las tiras.');
    if(typeof FontFace==='undefined'||!document.fonts)throw Error('Actualiza tu navegador para cargar la tipografía de impresión.');
    const font=new FontFace(FONT,`url(${new URL('./assets/fonts/manrope-latin-wght-400-800.woff2',import.meta.url).href})`,{weight:'400 800',style:'normal'});
    try{await font.load();}catch{throw Error('No se pudo cargar la tipografía de impresión. Comprueba tu conexión y vuelve a intentarlo.');}
    document.fonts.add(font);
    const logo=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(Error('No se pudo cargar el logotipo oficial. Recarga la página e inténtalo de nuevo.'));
      image.src=new URL('./assets/logo.png',import.meta.url).href;
    });
    return {logo};
  })().catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}

function roundedPath(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);
  ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);
  ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
}

// Soft diagonal folds and a fine woven texture are generated locally from the
// chosen colour. No reference photograph is altered or sent to another service.
function satinCanvas(color,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height),pixels=image.data;
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const darkInk=stripInkColor(color)!=='#ffffff',shadow=darkInk?.24:.58,light=darkInk?.19:.14;
  let seed=1831565813;
  for(let y=0;y<height;y++){
    const v=y/(height-1),bend=.052*Math.sin(v*5.7)+.028*Math.cos(v*10.2);
    for(let x=0;x<width;x++){
      const u=x/(width-1),diagonal=u*.91+v*.87+bend+.035*Math.sin(u*5.1+v*2.3);
      let shade=0,shine=0;
      for(const [centre,spread,depth] of [[.27,.1,.64],[.93,.145,1],[1.61,.12,.8]]){
        const d=(diagonal-centre)/spread,h=(diagonal-(centre-.13))/(spread*.8);
        shade+=Math.exp(-d*d*1.7)*depth;
        shine+=Math.exp(-h*h*1.8)*depth;
      }
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const grain=((seed>>>24)/255-.5)*.026;
      const thread=Math.sin((x+y*.72)*2.45)*.008;
      const brightness=1-shadow*Math.min(1,shade)+grain+thread;
      const highlight=light*Math.min(1,shine);
      const offset=(y*width+x)*4;
      for(let c=0;c<3;c++)pixels[offset+c]=Math.max(0,Math.min(255,rgb[c]*brightness+(255-rgb[c])*highlight));
      pixels[offset+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  return canvas;
}

function tintedLogo(logo,ink){
  const canvas=document.createElement('canvas');canvas.width=logo.naturalWidth;canvas.height=logo.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.drawImage(logo,0,0);
  ctx.globalCompositeOperation='source-in';ctx.fillStyle=ink;ctx.fillRect(0,0,canvas.width,canvas.height);
  return canvas;
}

function drawName(ctx,name,area,options){
  const measure=(text,size)=>{ctx.font=`400 ${size}px "${FONT}", sans-serif`;return ctx.measureText(text).width;};
  const fit=fitStripName(name,area.w,measure,{maxHeight:area.h,...options});
  ctx.font=`400 ${fit.size}px "${FONT}", sans-serif`;
  ctx.textBaseline='middle';ctx.textAlign=options.align??'left';
  const blockHeight=fit.lines.length*fit.lineHeight,position=options.position??.5;
  const top=Math.max(area.y,Math.min(area.y+area.h-blockHeight,area.y+area.h*position-blockHeight/2));
  const y=top+fit.lineHeight/2;
  for(let i=0;i<fit.lines.length;i++)ctx.fillText(fit.lines[i],area.x+(options.align==='center'?area.w/2:0),y+i*fit.lineHeight);
}

function drawFace(ctx,rect,design,cloth,logo,inverted,background){
  const {x,y,w,h}=rect,sx=w/73.32,sy=h/90;
  ctx.save();
  if(inverted){ctx.translate(x+w,y+h);ctx.rotate(Math.PI);}else ctx.translate(x,y);
  roundedPath(ctx,0,0,w,h,4.05*sx);ctx.clip();
  ctx.drawImage(cloth,0,0,w,h);
  if(background){const crop=stripImagePlacement(background.naturalWidth,background.naturalHeight,w,h,design.custom.imageFit);ctx.drawImage(background,crop.x,crop.y,crop.w,crop.h);}
  ctx.fillStyle=design.textColor==='auto'?stripInkColor(design.custom?.image?.averageColor??design.color):design.textColor;
  const logoW=30.1*sx,logoH=logoW*logo.height/logo.width;
  const layout=stripCustomPlacement(w,h,logoW,logoH,design.custom);
  ctx.drawImage(logo,layout.logo.x,layout.logo.y,logoW,logoH);
  // Keep every name on the left, vertically adjustable inside the gap between
  // the brand and the capacity. Resizing keeps the same requested centre.
  const nameTop=7*sy+logoH+6*sy,nameBottom=design.custom?.message?58*sy:79.5*sy;
  drawName(ctx,design.name,{x:3.5*sx,y:nameTop,w:w-7*sx,h:nameBottom-nameTop},{maxSize:12.1*sx,minSize:.25*sx,lineHeight:1.19,scale:design.textScale,position:design.textPosition/100,align:'left'});
  ctx.font=`400 ${1.68*sx}px "${FONT}", sans-serif`;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  const capacity=`EDP | ${design.size} ml | ${design.size===50?'1.7':'3.4'} FL.OZ`,capacityWidth=ctx.measureText(capacity).width;
  const info=stripCustomPlacement(w,h,logoW,logoH,design.custom,capacityWidth).capacity;
  ctx.fillText(capacity,info.x,info.y);
  if(design.custom?.message){
    const area={x:4*sx,y:62*sy,w:w-8*sx,h:16*sy};
    const measure=(text,size)=>{ctx.font=`400 ${size}px "${FONT}", sans-serif`;return ctx.measureText(text).width;};
    const fit=fitStripMessage(design.custom.message,area.w,measure,{maxSize:3.4*sx,maxHeight:area.h});
    ctx.font=`400 ${fit.size}px "${FONT}", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const top=area.y+(area.h-fit.lines.length*fit.lineHeight)/2;
    fit.lines.forEach((line,index)=>ctx.fillText(line,w/2,top+(index+.5)*fit.lineHeight));
  }
  ctx.restore();
}

export async function renderStripDesign(input,{dpi=150,backgroundImage}={}){
  const design=validateStripDesign(input);
  if(!Number.isFinite(dpi)||dpi<72||dpi>300)throw Error('La resolución debe estar entre 72 y 300 ppp.');
  const image=design.custom?.image?await readStripDesignImage(backgroundImage):null;
  if(image&&(image.sha256!==design.custom.image.sha256||image.width!==design.custom.image.width||image.height!==design.custom.image.height))throw Error('La imagen seleccionada no corresponde al diseño. Vuelve a importarla.');
  const {logo}=await loadAssets(),geometry=stripDesignGeometry(design.size),{physical}=geometry;
  const canvas=document.createElement('canvas');canvas.width=Math.round(physical.w/25.4*dpi);canvas.height=Math.round(physical.h/25.4*dpi);
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Este navegador no permite generar las tiras.');
  const scaleX=canvas.width/physical.w,scaleY=canvas.height/physical.h;
  ctx.setTransform(scaleX,0,0,scaleY,0,0);ctx.fillStyle=CREAM;ctx.fillRect(0,0,physical.w,physical.h);
  ctx.strokeStyle='#cdd0c4';ctx.lineWidth=.12;ctx.beginPath();
  for(const y of geometry.foldLines){ctx.moveTo(4.9*physical.w/80.1,y);ctx.lineTo(physical.w-4.9*physical.w/80.1,y);}
  ctx.stroke();
  const cloth=satinCanvas(design.color,Math.round(geometry.front.w*scaleX),Math.round(geometry.front.h*scaleY));
  const ink=design.textColor==='auto'?stripInkColor(design.custom?.image?.averageColor??design.color):design.textColor;
  const mark=tintedLogo(logo,ink);
  try{
    drawFace(ctx,geometry.back,design,cloth,mark,true,image?.image);
    drawFace(ctx,geometry.front,design,cloth,mark,false,image?.image);
    const pill=geometry.pill;
    ctx.save();roundedPath(ctx,pill.x,pill.y,pill.w,pill.h,pill.h*.34);ctx.clip();ctx.drawImage(cloth,pill.x,pill.y,pill.w,pill.h);
    ctx.fillStyle=design.textColor==='auto'?stripInkColor(design.color):design.textColor;
    drawName(ctx,design.name,{x:pill.x+2.1,y:pill.y+1.1,w:pill.w-4.2,h:pill.h-2.2},{maxSize:4.55*physical.w/80.1,minSize:.25,lineHeight:1.1,lineMode:'single',scale:design.textScale,align:'center'});
    ctx.restore();
    ctx.fillStyle='#565954';ctx.font=`400 ${2.68*physical.w/80.1}px "${FONT}", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(design.category==='Unisex'?'Perfume unisex':`Perfume de ${design.category.toLowerCase()}`,physical.w/2,geometry.genderY);
  }finally{
    cloth.width=cloth.height=1;mark.width=mark.height=1;
  }
  const f=geometry.front;
  return {canvas,width:canvas.width,height:canvas.height,physical,geometry,faceRect:{x:f.x*scaleX,y:f.y*scaleY,w:f.w*scaleX,h:f.h*scaleY}};
}

const PNG_SIGNATURE=new Uint8Array([137,80,78,71,13,10,26,10]);
const PNG_CRC_TABLE=Uint32Array.from({length:256},(_,value)=>{
  let crc=value;
  for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;
  return crc>>>0;
});
function pngCrc(bytes,start,end){
  let crc=0xffffffff;
  for(let index=start;index<end;index++)crc=PNG_CRC_TABLE[(crc^bytes[index])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

// Browsers normally write 96 ppp into canvas PNGs. Replace only that metadata;
// the compressed image data and every pixel remain unchanged.
export async function encodeStripDesignPng(canvas,{dpi=300}={}){
  if(!canvas||typeof canvas.toBlob!=='function'||!Number.isInteger(canvas.width)||!Number.isInteger(canvas.height)||canvas.width<1||canvas.height<1)throw Error('No se pudo preparar la imagen de la tira.');
  if(!Number.isFinite(dpi)||dpi<72||dpi>1200)throw Error('La resolución del PNG debe estar entre 72 y 1200 ppp.');
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('No se pudo crear la imagen PNG.')),'image/png'));
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
  const invalid=()=>Error('El navegador no generó una imagen PNG válida.');
  if(bytes.length<8||!PNG_SIGNATURE.every((value,index)=>bytes[index]===value))throw invalid();
  const ppm=Math.round(dpi/.0254),physical=new Uint8Array(21),physicalView=new DataView(physical.buffer);
  physicalView.setUint32(0,9);physical.set([112,72,89,115],4);
  physicalView.setUint32(8,ppm);physicalView.setUint32(12,ppm);physical[16]=1;
  physicalView.setUint32(17,pngCrc(physical,4,17));
  const parts=[bytes.subarray(0,8)];let header=false,image=false,end=false;
  for(let offset=8;offset<bytes.length;){
    if(offset+12>bytes.length||end)throw invalid();
    const length=view.getUint32(offset),next=offset+length+12;
    if(length>0x7fffffff||next>bytes.length)throw invalid();
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(view.getUint32(offset+length+8)!==pngCrc(bytes,offset+4,offset+length+8))throw invalid();
    if(!header){
      if(type!=='IHDR'||length!==13||view.getUint32(offset+8)!==canvas.width||view.getUint32(offset+12)!==canvas.height)throw invalid();
      header=true;parts.push(bytes.subarray(offset,next),physical);
    }else{
      if(type==='IHDR'||(type==='pHYs'&&length!==9))throw invalid();
      if(type==='IDAT')image=true;
      if(type==='IEND'){if(length!==0||!image||next!==bytes.length)throw invalid();end=true;}
      if(type!=='pHYs')parts.push(bytes.subarray(offset,next));
    }
    offset=next;
  }
  if(!header||!image||!end)throw invalid();
  return new Blob(parts,{type:'image/png'});
}
