import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {labelNamePlacement} from './label-name-metrics.js';
import {fitLabelName,labelName} from './labels.js';
import {jsPDF} from './assets/pdf-client.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
function centered(result){
 close(result.top-result.logoBottom,result.infoTop-result.bottom);
 close((result.top+result.bottom)/2,result.center);
 assert.ok(result.top>result.logoBottom);assert.ok(result.bottom<result.infoTop);
}

test('visible name ink has equal space to logo and product information in both templates',()=>{
 for(const capacity of [50,100])for(const lines of [['Manhattan','midnight'],['American','apple gloss'],['Bitter','grapefruit & rosemary'],['Citrus','mist'],['Momentum']])centered(labelNamePlacement(lines,15,capacity));
});

test('descenders move the baselines up while keeping the same visible middle',()=>{
 for(const capacity of [50,100]){
  const plain=labelNamePlacement(['Manhattan','mist'],15,capacity),descending=labelNamePlacement(['Manhattan','midnight'],15,capacity);
  assert.ok(descending.first<plain.first);close(plain.center,descending.center);
  close(plain.lineHeight,descending.lineHeight);centered(plain);centered(descending);
 }
});

test('one-line names are centered by their ink rather than a fixed baseline allowance',()=>{
 const cap=labelNamePlacement(['Momentum'],15,50),lower=labelNamePlacement(['midnight'],15,50);
 assert.ok(lower.first<cap.first);close(cap.center,lower.center);
 close(cap.bottom-cap.top,(718+15)*15*25.4/72/1000);
 close(lower.bottom-lower.top,(718+220)*15*25.4/72/1000);
 centered(cap);centered(lower);
});

test('font sizes can shrink without changing the template center or relative line spacing',()=>{
 for(const capacity of [50,100]){
  const small=labelNamePlacement(['American','apple gloss'],12,capacity),large=labelNamePlacement(['American','apple gloss'],15,capacity);
  close(small.center,large.center);close(small.lineHeight,12*25.4/72*1.12);
  close((small.bottom-small.top)/(large.bottom-large.top),12/15);centered(small);centered(large);
 }
});

test('accented names, symbols and unknown Unicode have safe bounded placement',()=>{
 for(const capacity of [50,100])for(const lines of [['Ámbar','& café'],['No.','5'],['Æther'],['新香'],['Aurora','🌙']]){
  const result=labelNamePlacement(lines,15,capacity);centered(result);
  for(const value of Object.values(result))assert.ok(Number.isFinite(value));
 }
});

test('all official catalog names fit centered in both print sizes using the real PDF font',()=>{
 const catalog=JSON.parse(readFileSync(new URL('./catalog.json',import.meta.url))),pdf=new jsPDF({unit:'mm'});pdf.setFont('helvetica','normal');
 let checked=0;
 for(const product of catalog)for(const [capacity,width] of [[100,69.6],[50,59.8]]){
  const left=(capacity===100?104/822:113/751)*width,base=64/(capacity===100?822:751)*width*72/25.4;
  const fit=fitLabelName(product.name,width-left-7,(text,size)=>{pdf.setFontSize(size);return pdf.getTextWidth(text);},base);
  const expectedWords=labelName(product.name).split(/\s+/);assert.deepEqual(fit.lines,expectedWords.length>1?[expectedWords[0],expectedWords.slice(1).join(' ')]:expectedWords);
  centered(labelNamePlacement(fit.lines,fit.size,capacity));checked++;
 }
 assert.equal(checked,catalog.length*2);
});

test('placement never changes input lines or exposes a horizontal offset',()=>{
 const lines=Object.freeze(['Manhattan','midnight']),result=labelNamePlacement(lines,15,50);
 assert.deepEqual(lines,['Manhattan','midnight']);assert.equal('x' in result,false);assert.equal('left' in result,false);
 assert.deepEqual(Object.keys(result).sort(),['bottom','center','first','infoTop','lineHeight','logoBottom','top']);
});

test('invalid or overflowing text cannot create a nonfinite or overlapping position',()=>{
 for(const lines of [[],[''],['   '],['A','B','C'],[123],null])assert.throws(()=>labelNamePlacement(lines,15,50));
 for(const size of [0,-1,NaN,Infinity,'15'])assert.throws(()=>labelNamePlacement(['A'],size,50));
 for(const capacity of [0,51,'50','__proto__'])assert.throws(()=>labelNamePlacement(['A'],15,capacity));
 assert.throws(()=>labelNamePlacement(['American','apple gloss'],999,50),/no cabe/);
});
