import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStripDesign,defaultStripCustomization,stripCustomPlacement,stripImagePlacement,fitStripMessage,stripDesignIdentity,MAX_STRIP_DESIGN_IMAGE_BYTES} from './strip-designer.js';
import {validateStripRecord} from './strip-library-data.js';
import {initialState,validateBackup} from './inventory.js';
const base={name:'Para ti',color:'#d5a617',size:100,category:'Unisex',personalized:true};
const image={name:'Regalo.png',type:'image/png',size:1000,width:400,height:200,sha256:'a'.repeat(64),averageColor:'#804080'};

test('Personalizada adds optional controls without changing legacy design data or identity',()=>{
 const classic={...base,personalized:false},checked=validateStripDesign(classic);assert.equal(checked.custom,undefined);assert.equal(stripDesignIdentity(classic),JSON.stringify(['Para ti',100,'Unisex','#d5a617']));
 assert.deepEqual(validateStripDesign(base).custom,defaultStripCustomization());const changed=validateStripDesign({...base,custom:{logo:{x:0,y:100},capacity:{x:100,y:0},message:'  Feliz cumpleaños, mamá!  ',imageFit:'contain',image}});assert.equal(changed.custom.message,'Feliz cumpleaños, mamá!');assert.deepEqual(changed.custom.logo,{x:0,y:100});assert.deepEqual(changed.custom.image,image);
});
test('custom image metadata is bounded and cannot contain raw images or arbitrary URLs in shared inventory',()=>{
 const custom=validateStripDesign({...base,custom:{image:{...image,dataUrl:'data:image/png;base64,large',url:'https://example.org/private',blob:'binary'}}}).custom;assert.deepEqual(custom.image,image);
 for(const patch of [{size:MAX_STRIP_DESIGN_IMAGE_BYTES+1},{type:'image/svg+xml'},{sha256:'invalid'},{width:0},{width:40001,height:1000},{averageColor:'red'},{name:'bad\u0000.png'}])assert.throws(()=>validateStripDesign({...base,custom:{image:{...image,...patch}}}),/imagen/);
});
test('position and message validation rejects invalid inputs while preserving accents and line breaks',()=>{
 for(const point of [{x:-1,y:0},{x:101,y:0},{x:0,y:NaN},{x:'',y:100}])for(const part of ['logo','capacity'])assert.throws(()=>validateStripDesign({...base,custom:{[part]:point}}),/posición/);
 for(const message of ['A'.repeat(241),'line\n'.repeat(9),'bad\u0000'])assert.throws(()=>validateStripDesign({...base,custom:{message}}),/mensaje/);
 assert.equal(validateStripDesign({...base,custom:{message:' Para mamá\r\nCon amor 🎁 '}}).custom.message,'Para mamá\nCon amor 🎁');assert.throws(()=>validateStripDesign({...base,custom:{imageFit:'stretch'}}),/ajustar/);
});
test('Reacomodar uses original placements and manual positions stay inside both official face sizes',()=>{
 for(const [w,h] of [[73.32,90],[73.32*71.9/80.1,90*390/431.8]]){
  const sx=w/73.32,sy=h/90,logoW=30.1*sx,logoH=9*sy,capacityW=28*sx,defaults=stripCustomPlacement(w,h,logoW,logoH);
  assert.ok(Math.abs(defaults.logo.x-(w-logoW-3.5*sx))<1e-10);assert.ok(Math.abs(defaults.logo.y-7*sy)<1e-10);assert.ok(Math.abs(defaults.capacity.x-4*sx)<1e-10);assert.ok(Math.abs(defaults.capacity.y-85.25*sy)<1e-10);
  for(const x of [0,50,100])for(const y of [0,50,100]){const layout=stripCustomPlacement(w,h,logoW,logoH,{logo:{x,y},capacity:{x,y}},capacityW);assert.ok(layout.logo.x>=0&&layout.logo.x+logoW<=w);assert.ok(layout.logo.y>=0&&layout.logo.y+logoH<=h);assert.ok(layout.capacity.x>=0&&layout.capacity.x+capacityW<=w);assert.ok(layout.capacity.y>0&&layout.capacity.y<h);}
 }
});
test('image cover and contain preserve proportions with centered cropping or margins',()=>{
 const cover=stripImagePlacement(400,200,70,90,'cover');assert.equal(cover.w,180);assert.equal(cover.h,90);assert.equal(cover.x,-55);assert.equal(cover.y,0);
 const contain=stripImagePlacement(400,200,70,90,'contain');assert.equal(contain.w,70);assert.equal(contain.h,35);assert.equal(contain.x,0);assert.equal(contain.y,27.5);assert.throws(()=>stripImagePlacement(0,200,70,90));
});
test('gift messages wrap and fit without silently truncating long words, accents or paragraphs',()=>{
 const measure=(text,size)=>Array.from(text).length*size*.56;
 for(const message of ['Feliz cumpleaños, mamá!','Para ti\nCon todo mi amor','🎁'.repeat(100),'A'.repeat(240)]){
  const fit=fitStripMessage(message,58,measure);assert.ok(fit.lines.every(line=>measure(line,fit.size)<=58.00001));assert.ok(fit.lines.length*fit.lineHeight<=16);assert.equal(fit.lines.join('').replace(/\s/gu,''),message.replace(/\s/gu,''));
 }
});
test('distinct photos, messages and positions produce separate variants and do not overwrite previous designs',()=>{
 const input={...base,custom:{image,message:'Para ti'}},identity=stripDesignIdentity(input);
 for(const custom of [{image:{...image,sha256:'b'.repeat(64)},message:'Para ti'},{image,message:'Con amor'},{image,message:'Para ti',logo:{x:0,y:100}},{image,message:'Para ti',capacity:{x:50,y:50}},{image,message:'Para ti',imageFit:'contain'}])assert.notEqual(stripDesignIdentity({...base,custom}),identity);
 assert.equal(stripDesignIdentity(input),identity);assert.notEqual(identity,stripDesignIdentity({...base,personalized:false}));
});
test('shared records and backups retain personalization and existing inventory without embedding image bytes',()=>{
 const design=validateStripDesign({...base,custom:{image,message:'Con amor',logo:{x:30,y:70}}}),record={id:'created-custom',filename:'Regalo.png',name:design.name,size:100,category:design.category,productId:null,warning:'',width:946,height:5100,source:'generated',asset:{bucket:'strip-library',path:'luis/asset-1/image.png',type:'image/png',size:20000},design};
 assert.deepEqual(validateStripRecord(record).design,design);const state=initialState([]),before=JSON.stringify(state.materials);state.stripLibrary.entries=[record];const restored=validateBackup(JSON.parse(JSON.stringify(state)),[]);assert.deepEqual(restored.stripLibrary.entries[0].design,design);assert.equal(JSON.stringify(restored.materials),before);assert.ok(JSON.stringify(restored).length<5000);
});


test('Personalizada is independent of gender and disabling it preserves standard rendering and identities',()=>{
 for(const category of ['Dama','Caballero','Unisex']){
  const design=validateStripDesign({...base,category,textScale:.75,custom:{message:'Regalo'}});assert.equal(design.category,category);assert.equal(design.personalized,true);assert.equal(design.custom.message,'Regalo');assert.equal(design.textScale,.75);
  const normal=validateStripDesign({...design,personalized:false});assert.equal(normal.category,category);assert.equal(normal.custom,undefined);assert.equal(normal.personalized,undefined);
 }
 assert.throws(()=>validateStripDesign({...base,personalized:'yes'}),/Personalizada/);
});
test('previous personalized categories remain readable without losing their picture, message, positions or saved asset',()=>{
 const old={...base,category:'Personalizada',personalized:undefined,custom:{image,message:'Anterior',logo:{x:20,y:80}}},design=validateStripDesign(old);assert.equal(design.personalized,true);assert.equal(design.category,'Unisex');assert.deepEqual(design.custom.image,image);assert.equal(design.custom.message,'Anterior');assert.deepEqual(design.custom.logo,{x:20,y:80});
 const asset={bucket:'strip-library',path:'luis/asset-1/image.png',type:'image/png',size:20000},record={id:'previous-custom',filename:'Previous.png',name:design.name,size:100,category:'Personalizada',productId:null,warning:'',width:946,height:5100,source:'generated',asset,design:old},checked=validateStripRecord(record);assert.equal(checked.id,record.id);assert.deepEqual(checked.asset,asset);assert.equal(checked.design.custom.message,'Anterior');
});
