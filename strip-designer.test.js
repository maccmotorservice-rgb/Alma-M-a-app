import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStripDesign,stripDesignPrintSize,stripDesignGeometry,stripInkColor,fitStripName} from './strip-designer.js';

const design={name:'Mi nuevo perfume',color:'#286b60',size:100,category:'Unisex',qty:1};

test('a new perfume can be designed without belonging to the catalog',()=>{
  assert.deepEqual(validateStripDesign({...design,name:'  Azahar   del Mar  ',color:'#ABCDEF',size:'50',qty:'3'}),{name:'Azahar del Mar',color:'#abcdef',size:50,category:'Unisex',qty:3});
  assert.equal(validateStripDesign({...design,name:'Ámbar & <Edición especial>'}).name,'Ámbar & <Edición especial>');
  assert.equal(validateStripDesign({...design,name:'A'.repeat(80)}).name.length,80);
  assert.equal(validateStripDesign({...design,productId:12}).productId,'12');
  for(const value of ['', 'A'.repeat(81)])assert.throws(()=>validateStripDesign({...design,name:value}),/nombre/);
  for(const value of [0,1.5,1000,NaN])assert.throws(()=>validateStripDesign({...design,qty:value}),/cantidad/);
  for(const change of [{size:75},{category:'Otra'},{color:'red'},{color:'#123456;'}])assert.throws(()=>validateStripDesign({...design,...change}));
});

test('50 and 100 ml keep their official distinct dimensions and corresponding panel geometry',()=>{
  assert.deepEqual(stripDesignPrintSize(50),{w:71.9,h:390});
  assert.deepEqual(stripDesignPrintSize({size:100}),{w:80.1,h:431.8});
  assert.throws(()=>stripDesignPrintSize(75));
  const small=stripDesignGeometry(50),large=stripDesignGeometry(100);
  assert.deepEqual(large.front,{x:3.41,y:213.19,w:73.32,h:90});
  for(const g of [small,large])for(const box of [g.front,g.back,g.pill]){
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=g.physical.w&&box.y+box.h<=g.physical.h);
  }
  assert.ok(small.front.w<large.front.w&&small.front.h<large.front.h);
  assert.ok(Math.abs(small.front.w/large.front.w-71.9/80.1)<1e-12);
  assert.ok(Math.abs(small.front.h/large.front.h-390/431.8)<1e-12);
});

test('names use the first word above and all remaining words together below',()=>{
  const measure=(text,size)=>Array.from(text).length*size*.56;
  assert.deepEqual(fitStripName('American Apple Gloss',60,measure).lines,['American','Apple Gloss']);
  assert.deepEqual(fitStripName('  Ámbar  del  océano  ',60,measure).lines,['Ámbar','del océano']);
  assert.deepEqual(fitStripName('Sasheer',60,measure).lines,['Sasheer']);
  for(const name of ['Ámbar del océano edición especial de verano','É'.repeat(80),'American Apple Gloss']){
    const fit=fitStripName(name,60,measure,{maxHeight:43});
    assert.ok(fit.lines.length<=2);
    assert.ok(fit.lines.every(line=>measure(line,fit.size)<=60.00001));
    assert.ok(fit.lines.length*fit.lineHeight<=43);
    assert.equal(fit.lines.join('').replace(/ /g,''),name.replace(/ /g,''));
  }
  const pill=fitStripName('Primer '+ 'A'.repeat(73),44,measure,{maxSize:4.55,maxHeight:9,lineHeight:1.1});
  assert.deepEqual(pill.lines,['Primer','A'.repeat(73)]);
  assert.ok(pill.lines.every(line=>measure(line,pill.size)<=44.00001));
  assert.throws(()=>fitStripName('Nombre',0,measure));
});

test('ink remains readable for dark and pale colour choices',()=>{
  assert.equal(stripInkColor('#000000'),'#ffffff');
  assert.equal(stripInkColor('#163e3c'),'#ffffff');
  assert.equal(stripInkColor('#ffffff'),'#211f1c');
  assert.equal(stripInkColor('#ffffcc'),'#211f1c');
  assert.throws(()=>stripInkColor('transparent'));
});
