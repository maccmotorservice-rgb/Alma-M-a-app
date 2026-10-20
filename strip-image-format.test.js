import test from 'node:test';
import assert from 'node:assert/strict';
import {detectStripImageType,inspectStripImageBlob} from './strip-image-format.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const jpeg=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1]);
const webp=new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80]);
test('strip image type follows complete binary signatures rather than an extension',()=>{
 assert.equal(detectStripImageType(png),'image/png');
 assert.equal(detectStripImageType(jpeg),'image/jpeg');
 assert.equal(detectStripImageType(webp),'image/webp');
 for(const invalid of [undefined,new Uint8Array(),png.subarray(0,7),new Uint8Array([137,80,78,71,0,0,0,0]),jpeg.subarray(0,2),webp.subarray(0,11),new TextEncoder().encode('<html>not an image</html>')])assert.equal(detectStripImageType(invalid),null);
});
test('repairing a mislabeled strip keeps all original bytes and retains correctly labeled blobs',async()=>{
 for(const [bytes,type,wrong] of [[png,'image/png','image/jpeg'],[jpeg,'image/jpeg','image/png'],[webp,'image/webp','application/octet-stream']]){
  const original=new Blob([bytes],{type:wrong}),repaired=await inspectStripImageBlob(original);
  assert.equal(repaired.type,type);assert.deepEqual(new Uint8Array(await repaired.arrayBuffer()),bytes);assert.equal(original.type,wrong);
  const correct=new Blob([bytes],{type});assert.equal(await inspectStripImageBlob(correct),correct);
 }
});
test('unsupported or corrupt strip contents remain errors with an identifiable code',async()=>{
 for(const invalid of [null,new Blob([],{type:'image/png'}),new Blob(['not png'],{type:'image/png'})])await assert.rejects(inspectStripImageBlob(invalid),error=>error.code==='STRIP_IMAGE_FORMAT');
});
