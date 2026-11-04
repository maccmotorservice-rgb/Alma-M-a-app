import test from 'node:test';import assert from 'node:assert/strict';import {labelLayout,labelName,fitLabelName} from './labels.js';
test('label rows keep physical sizes, spacing, pairs and pagination',()=>{const {rows,pages}=labelLayout(112);assert.equal(pages,13);assert.equal(rows.length,224);for(let i=0;i<rows.length;i+=2){const a=rows[i],b=rows[i+1];assert.equal(a.page,b.page);assert.ok(Math.abs(b.y-a.y-a.h-10)<1e-9);assert.equal(a.copies,7);assert.equal(b.copies,8);assert.ok(b.y+b.h<=944.901);assert.ok(a.x>0&&b.x>0);assert.equal(a.w,69.6);assert.equal(b.w,59.8);}assert.throws(()=>labelLayout(0));});
test('multiword label names always put the first word above all remaining words',()=>{
 const measure=(text,size)=>text.length*size/3;
 assert.deepEqual(fitLabelName('American Apple Gloss',200,measure,9),{lines:['American','apple gloss'],size:9});
 assert.deepEqual(fitLabelName('  Ambered   milk  ',200,measure,9).lines,['Ambered','milk']);
 assert.deepEqual(fitLabelName('EMBER & PETAL',200,measure,9).lines,['Ember','& petal']);
 assert.deepEqual(fitLabelName('A Very Long Perfume Name',200,measure,9).lines,['A','very long perfume name']);
});
test('long second lines shrink without changing the required word distribution',()=>{
 const fitted=fitLabelName('American Apple Gloss',15,(text,size)=>text.length*size/3,9);
 assert.deepEqual(fitted.lines,['American','apple gloss']);assert.ok(fitted.size<9);
 assert.ok(fitted.lines.every(line=>line.length*fitted.size/3<=15));
});
test('single-word names stay on one line and unsupported lengths still fail clearly',()=>{
 assert.deepEqual(fitLabelName('Sasheer',100,(text,size)=>text.length*size/3,9),{lines:['Sasheer'],size:9});
 assert.throws(()=>fitLabelName('A name that cannot fit',1,(text,size)=>text.length*size/3,9),/demasiado largo/);
 assert.equal(labelName('EMBER & PETAL'),'Ember & petal');
});
