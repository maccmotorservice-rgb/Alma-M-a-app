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
  const category=input.category??'Unisex';
  if(!CATEGORIES.includes(category))throw Error('Selecciona Dama, Caballero o Unisex.');
  const qty=input.qty===undefined?1:Number(input.qty);
  if(!Number.isInteger(qty)||qty<1||qty>999)throw Error('La cantidad debe ser un número entero entre 1 y 999.');
  const design={name,color:input.color.toLowerCase(),textColor:textColor.toLowerCase(),textScale,textPosition,size,category,qty};
  for(const key of ['id','productId'])if(input[key]!==undefined&&input[key]!==null)design[key]=String(input[key]);
  return design;
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

function drawFace(ctx,rect,design,cloth,logo,inverted){
  const {x,y,w,h}=rect,sx=w/73.32,sy=h/90;
  ctx.save();
  if(inverted){ctx.translate(x+w,y+h);ctx.rotate(Math.PI);}else ctx.translate(x,y);
  roundedPath(ctx,0,0,w,h,4.05*sx);ctx.clip();
  ctx.drawImage(cloth,0,0,w,h);
  ctx.fillStyle=design.textColor==='auto'?stripInkColor(design.color):design.textColor;
  const logoW=30.1*sx,logoH=logoW*logo.height/logo.width;
  ctx.drawImage(logo,w-logoW-3.5*sx,7.0*sy,logoW,logoH);
  // Keep every name on the left, vertically adjustable inside the gap between
  // the brand and the capacity. Resizing keeps the same requested centre.
  const nameTop=7*sy+logoH+6*sy,nameBottom=79.5*sy;
  drawName(ctx,design.name,{x:3.5*sx,y:nameTop,w:w-7*sx,h:nameBottom-nameTop},{maxSize:12.1*sx,minSize:.25*sx,lineHeight:1.19,scale:design.textScale,position:design.textPosition/100,align:'left'});
  ctx.font=`400 ${1.68*sx}px "${FONT}", sans-serif`;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.fillText(`EDP | ${design.size} ml | ${design.size===50?'1.7':'3.4'} FL.OZ`,4* sx,85.25*sy);
  ctx.restore();
}

export async function renderStripDesign(input,{dpi=150}={}){
  const design=validateStripDesign(input);
  if(!Number.isFinite(dpi)||dpi<72||dpi>300)throw Error('La resolución debe estar entre 72 y 300 ppp.');
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
  const ink=design.textColor==='auto'?stripInkColor(design.color):design.textColor;
  const mark=tintedLogo(logo,ink);
  try{
    drawFace(ctx,geometry.back,design,cloth,mark,true);
    drawFace(ctx,geometry.front,design,cloth,mark,false);
    const pill=geometry.pill;
    ctx.save();roundedPath(ctx,pill.x,pill.y,pill.w,pill.h,pill.h*.34);ctx.clip();ctx.drawImage(cloth,pill.x,pill.y,pill.w,pill.h);
    ctx.fillStyle=ink;
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
