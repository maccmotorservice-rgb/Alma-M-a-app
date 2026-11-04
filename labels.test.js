import test from 'node:test';import assert from 'node:assert/strict';import {labelLayout,labelName,fitLabelName,labelRowCounts} from './labels.js';
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
test('row quantities default to one per presentation and accept only explicit nonempty integer selections',()=>{
 assert.deepEqual(labelRowCounts(),{rows100:1,rows50:1});
 assert.deepEqual(labelRowCounts({rows100:3,rows50:0}),{rows100:3,rows50:0});
 for(const input of [{rows100:0,rows50:0},{rows100:-1},{rows100:1.5},{rows50:'2'},{rows100:101},{rows50:null}])assert.throws(()=>labelRowCounts(input));
 assert.throws(()=>labelLayout([]));assert.throws(()=>labelLayout(new Array(113).fill({})));
 assert.throws(()=>labelLayout([{rows100:0,rows50:0}]));
});
test('custom rows preserve perfume order, label counts and each presentation dimensions',()=>{
 const result=labelLayout([{rows100:2,rows50:3},{rows100:0,rows50:2},{rows100:1,rows50:0}]);
 assert.equal(result.totalRows,8);assert.equal(result.totalLabels,61);assert.equal(result.pages,1);
 assert.deepEqual(result.rows.map(row=>[row.index,row.size]),[[0,100],[0,100],[0,50],[0,50],[0,50],[1,50],[1,50],[2,100]]);
 for(const row of result.rows){assert.equal(row.w,row.size===100?69.6:59.8);assert.equal(row.h,row.size===100?46.9:35.3);assert.equal(row.copies,row.size===100?7:8);}
 for(let i=1;i<result.rows.length;i++)assert.ok(Math.abs(result.rows[i].y-result.rows[i-1].y-result.rows[i-1].h-10)<1e-9);
});
test('large row groups continue across sheets without clipping or changing physical sizes',()=>{
 for(const [selection,firstPageRows]of [[{rows100:17,rows50:0},16],[{rows100:0,rows50:21},20]]){
  const result=labelLayout([selection]);assert.equal(result.pages,2);assert.equal(result.rows.filter(row=>row.page===0).length,firstPageRows);
  assert.equal(result.rows.find(row=>row.page===1).y,35.1);
  for(const row of result.rows){assert.ok(row.y>=35.1);assert.ok(row.y+row.h<=944.901);assert.ok(row.x>=0);assert.ok(row.x+row.copies*row.w+(row.copies-1)*10<=580);}
 }
 const many=labelLayout([{rows100:100,rows50:100},{rows100:2,rows50:1}]);
 assert.equal(many.totalRows,203);assert.equal(many.totalLabels,1522);
 for(let i=1;i<many.rows.length;i++){const before=many.rows[i-1],row=many.rows[i];assert.ok(row.page===before.page||row.page===before.page+1);if(row.page===before.page)assert.ok(row.y>=before.y+before.h+9.999);}
});
test('default array plans retain the original paired pagination and totals',()=>{
 const legacy=labelLayout(112),explicit=labelLayout(Array.from({length:112},()=>({rows100:1,rows50:1})));
 assert.deepEqual(explicit,legacy);assert.equal(explicit.totalRows,224);assert.equal(explicit.totalLabels,1680);assert.equal(explicit.pages,13);
});
