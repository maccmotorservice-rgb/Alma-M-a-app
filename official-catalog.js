// Based on Catalogo_Alma_Mia_2026_LISTA_OFICIAL.pdf supplied by the owner.
// Product IDs remain stable internally; numbers printed in the catalog are sequential.
const sections=[['Caballero','Diseñador'],['Caballero','Nicho'],['Dama','Diseñador'],['Dama','Nicho'],['Unisex','Diseñador'],['Unisex','Nicho']];
export function catalogPrice(value){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:Number(value)%1?2:0,maximumFractionDigits:2}).format(value);}
function wrap(text,width,size,bold,measure){
 const lines=[];let line='';
 for(const word of String(text).split(/\s+/)){
  if(line&&measure(line+' '+word,size,bold)>width){lines.push(line);line='';}
  for(const char of word){if(line&&measure(line+char,size,bold)>width){lines.push(line);line='';}line+=char;}
  line+=' ';
 }
 if(line.trim())lines.push(line.trim());return lines.map(line=>line.trim());
}
export function catalogPrintPages(catalog,{measure=(text,size)=>text.length*size*.59}={}){
 const pages=[];let number=0;
 for(const [category,line] of sections){
  const products=catalog.filter(p=>!p.discontinued&&p.category===category&&p.line===line).sort((a,b)=>a.brand.localeCompare(b.brand,'es')||Number(a.id)-Number(b.id));
  const groupPages=[];let page=null,y=382,lastBrand='';
  for(const product of products){
   const nameLines=wrap(product.name,574,19,true,measure),referenceLines=wrap('Inspirado en '+product.reference,574,13,false,measure),height=Math.max(84,39+nameLines.length*23+referenceLines.length*17);
   let brandHeight=lastBrand!==product.brand?31:0;
   if(!page||page.rows.length>=13||y+brandHeight+height>1818){page={category,line,rows:[]};groupPages.push(page);y=382;lastBrand='';brandHeight=31;}
   if(height+31>1436)throw Error('El nombre o referencia del perfume es demasiado largo para el catálogo.');
   y+=brandHeight;page.rows.push({product,number:++number,y,height,showBrand:brandHeight>0,nameLines,referenceLines});y+=height+8;lastBrand=product.brand;
  }
  groupPages.forEach((page,index)=>{page.groupPage=index+1;page.groupPages=groupPages.length;pages.push(page);});
 }
 return pages;
}
let assetsPromise;
async function loadAssets(){
 if(!assetsPromise)assetsPromise=(async()=>{
  const binary=async name=>{const response=await fetch(new URL('./assets/catalog/'+name,import.meta.url));if(!response.ok)throw Error('No se pudo cargar el diseño del catálogo.');const bytes=new Uint8Array(await response.arrayBuffer());let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
  const [cover,brand,normal,bold]=await Promise.all(['cover.png','brand.png','DejaVuSans.ttf','DejaVuSans-Bold.ttf'].map(binary));return {cover,brand,normal,bold};
 })().catch(error=>{assetsPromise=null;throw error;});return assetsPromise;
}
export async function createOfficialCatalogPdf(catalog,{assets}={}){
 const [{jsPDF},images]=await Promise.all([import('./assets/pdf-client.js'),assets?Promise.resolve(assets):loadAssets()]);
 const doc=new jsPDF({unit:'pt',format:[1080,1920],orientation:'portrait',compress:true});
 doc.addFileToVFS('DejaVuSans.ttf',images.normal);doc.addFont('DejaVuSans.ttf','Catalog','normal');doc.addFileToVFS('DejaVuSans-Bold.ttf',images.bold);doc.addFont('DejaVuSans-Bold.ttf','Catalog','bold');
 const font=(size=13,bold=false,color=[33,33,36])=>{doc.setFont('Catalog',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);};
 const plan=catalogPrintPages(catalog,{measure:(text,size,bold)=>{font(size,bold);return doc.getTextWidth(text);}}),total=plan.length+1;
 doc.setProperties({title:'Catálogo Alma Mía 2026',author:'Alma Mía',subject:'Catálogo de perfumes y precios vigentes'});
 doc.addImage('data:image/png;base64,'+images.cover,'PNG',0,0,1080,1920,'official-cover','FAST');
 const gray=[121,126,139],lineColor=[216,218,224];
 for(const [index,page] of plan.entries()){
  doc.addPage([1080,1920]);doc.setFillColor(245,245,247);doc.rect(0,0,1080,1920,'F');doc.addImage('data:image/png;base64,'+images.brand,'PNG',58,40,162,38.602,'official-brand','FAST');
  font(16,false,gray);doc.text(`${index+2}/${total}`,1022,59,{align:'right'});doc.setDrawColor(...lineColor);doc.setLineWidth(1);doc.line(58,82,1022,82);
  font(43,true);doc.text('Catalogo Alma Mía 2026',58,155);font(23,false,gray);doc.text(`${page.category} · ${page.line}${page.groupPages>1?' · '+page.groupPage+'/'+page.groupPages:''}`,58,210);
  doc.setFillColor(239,240,243);doc.roundedRect(58,236,105,32,16,16,'F');font(14,false,gray);doc.text(page.category,74,258);
  const chipWidth=page.line==='Diseñador'?140:120;doc.setFillColor(0,122,255);doc.roundedRect(168,236,chipWidth,32,16,16,'F');font(14,true,[255,255,255]);doc.text(page.line,184,258);font(13,false,gray);doc.text('Autores en orden alfabético',168+chipWidth+17,258);
  doc.setFillColor(255,255,255);doc.setDrawColor(...lineColor);doc.roundedRect(58,303,964,51,20,20,'FD');font(14,true,gray);doc.text('PERFUME',118,339);
  for(const [x,label] of [[737,'50 ml'],[866,'100 ml']]){doc.setFillColor(239,240,243);doc.roundedRect(x,311,105,35,18,18,'F');font(18,true);doc.text(label,x+52.5,336,{align:'center'});}
  for(const row of page.rows){
   const {product:p,y,height}=row;
   if(row.showBrand){font(16,true,gray);doc.text(p.brand.toLocaleUpperCase('es'),58,y-11);}
   doc.setFillColor(255,255,255);doc.setDrawColor(...lineColor);doc.roundedRect(58,y,964,height,20,20,'FD');font(11,false,gray);doc.text(String(row.number).padStart(2,'0'),74,y+20);
   font(19,true);doc.text(row.nameLines,118,y+38,{lineHeightFactor:23/19});font(13,false,gray);doc.text(row.referenceLines,118,y+63+(row.nameLines.length-1)*23,{lineHeightFactor:17/13});
   for(const [price,x] of [[p.price50,789.5],[p.price100,918.5]]){const label=catalogPrice(price);let size=22;font(size,true);while(doc.getTextWidth(label)>112&&size>12){size--;font(size,true);}doc.text(label,x,y+54,{align:'center'});}
  }
  doc.setDrawColor(...lineColor);doc.line(58,1848,1022,1848);font(11,false,gray);doc.text('Las marcas mencionadas se utilizan únicamente como referencia olfativa.',58,1872);doc.text('Precios en MXN',1022,1872,{align:'right'});
 }
 return {blob:doc.output('blob'),filename:'Catalogo-Alma-Mia-2026.pdf',pages:total,products:plan.reduce((n,page)=>n+page.rows.length,0)};
}
