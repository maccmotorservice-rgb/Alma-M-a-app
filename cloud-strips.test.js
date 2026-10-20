import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudInventory} from './cloud.js';
import {emptyStripLibrary,STRIP_ASSET_PART_BYTES} from './strip-library-data.js';
const clone=value=>structuredClone(value);
const png=(size=50)=>{const bytes=new Uint8Array(size);bytes.set([137,80,78,71,13,10,26,10]);for(let index=12;index<size;index++)bytes[index]=index%251;return new Blob([bytes],{type:'image/png'});};
const record=(id,asset)=>({id,filename:id+'.png',name:'Nombre',size:100,width:946,height:5100,source:'generated',warning:'',productId:null,design:{name:'Nombre',size:100,color:'#29272e',category:'Unisex'},asset});
function fixture(){
 const db={row:{id:true,revision:1,data:{version:1,materials:[],ready:{perfume:2},movements:[],stripLibrary:emptyStripLibrary()}},objects:new Map(),mutations:new Set(),conflict:false,loseReply:false,uploads:0,failUploadAt:0,rpcCalls:0};
 function make(user='luis'){
  let seq=0;const updates=[],client={auth:{getSession:async()=>({data:{session:{user:{id:user}}}})},from(table){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{display_name:user==='luis'?'Luis':'Ximena'}}),single:async()=>({data:clone(db.row)})}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},storage:{from(bucket){assert.equal(bucket,'strip-library');return {async upload(path,blob,options){db.uploads++;assert.equal(options.upsert,false);if(db.uploads===db.failUploadAt)return {error:{message:'missing bucket'}};db.objects.set(path,blob);return {}},async download(path){const data=db.objects.get(path);return data?{data}:{error:{message:'not found'}}},async remove(paths){paths.forEach(path=>db.objects.delete(path));return {}}}}},async rpc(_,p){db.rpcCalls++;if(db.conflict){db.conflict=false;db.row.revision++;db.row.data.ready.perfume=7;db.row.data.stripLibrary.entries.push(record('from-other-user',{bucket:'strip-library',path:'ximena/shared/image.png',type:'image/png',size:50}));return {error:{message:'INVENTORY_CONFLICT'}};}if(db.mutations.has(p.mutation_id))return {data:[clone(db.row)]};if(p.expected_revision!==db.row.revision)return {error:{message:'INVENTORY_CONFLICT'}};db.mutations.add(p.mutation_id);db.row={...db.row,revision:db.row.revision+1,data:clone(p.new_data)};if(db.loseReply){db.loseReply=false;return {error:{message:'response lost'}};}return {data:[clone(db.row)]}}};
  const cloud=new CloudInventory({storage:{getItem:()=>JSON.stringify({url:'https://example.supabase.co',key:'sb_publishable_test',activated:true}),setItem(){}},clientFactory:()=>client,validate:clone,onData:value=>updates.push(value),idFactory:()=> 'object-'+(++seq)});
  return {cloud,client,updates};
 }
 return {db,make};
}
test('large original bytes are uploaded as private parts and shared across Luis and Ximena',async t=>{
 const f=fixture(),a=f.make(),b=f.make('ximena');t.after(()=>{a.cloud.stop();b.cloud.stop()});await a.cloud.start();await b.cloud.start();
 const original=png(STRIP_ASSET_PART_BYTES+42),ref=await a.cloud.uploadStripAsset(original,'large');
 assert.equal(ref.parts.length,2);assert.match(ref.sha256,/^[a-f0-9]{64}$/);assert.equal(f.db.objects.size,2);
 const saved=await a.cloud.changeStripLibrary({upsert:[record('large',ref)]});assert.equal(saved.entries.length,1);await b.cloud.pull();
 assert.deepEqual(b.updates.at(-1).stripLibrary,saved);const download=await b.cloud.downloadStripAsset(saved.entries[0].asset);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),new Uint8Array(await original.arrayBuffer()));
 await b.cloud.changeStripLibrary({remove:['large']});await a.cloud.pull();assert.equal(a.updates.at(-1).stripLibrary.entries.length,0);assert.equal(a.updates.at(-1).stripLibrary.deleted[0].deletedBy,'Ximena');assert.equal(f.db.row.data.ready.perfume,2);
});
test('failed partial uploads never publish metadata and clean up their own objects',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();f.db.failUploadAt=2;
 await assert.rejects(a.cloud.uploadStripAsset(png(STRIP_ASSET_PART_BYTES+42),'large'),/04-biblioteca/);assert.equal(f.db.objects.size,0);assert.equal(f.db.rpcCalls,0);assert.equal(f.db.row.data.stripLibrary.entries.length,0);
 await assert.rejects(a.cloud.uploadStripAsset(new Blob(['not png'],{type:'image/png'}),'bad'),/formato/);assert.equal(f.db.uploads,2);
});
test('library conflict retries merge the latest stock and other member artwork',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();const ref=await a.cloud.uploadStripAsset(png(),'one');f.db.conflict=true;f.db.loseReply=true;
 const lib=await a.cloud.changeStripLibrary({upsert:[record('mine',ref)]});assert.equal(lib.entries.length,2);assert.equal(f.db.row.data.ready.perfume,7);assert.equal(f.db.row.revision,3);assert.equal(f.db.mutations.size,1,'lost reply retry uses the same mutation');
});
test('queued library edits wait for another write and preserve both artwork operations',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();const ref=await a.cloud.uploadStripAsset(png(),'one');a.cloud.saving=true;
 const first=a.cloud.changeStripLibrary({upsert:[record('one',ref)]}),second=a.cloud.changeStripLibrary({upsert:[record('two',ref)]});
 setTimeout(()=>{f.db.row.data.ready.perfume=8;f.db.row.revision++;a.cloud.saving=false;},60);
 await Promise.all([first,second]);assert.equal(f.db.row.data.stripLibrary.entries.length,2);assert.equal(f.db.row.data.ready.perfume,8);
});
test('logout or cancellation during upload prevents metadata publication and stale UI updates',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();let cancelled=false;const uploader=a.client.storage.from;
 a.client.storage.from=bucket=>{const store=uploader(bucket);return {...store,async upload(...args){const response=await store.upload(...args);cancelled=true;return response;}}};
 await assert.rejects(a.cloud.uploadStripAsset(png(),'one',{cancelled:()=>cancelled}),/cancelada/);assert.equal(f.db.row.revision,1);assert.equal(f.db.objects.size,0);
 cancelled=false;const originalRpc=a.client.rpc;a.client.rpc=async(...args)=>{const result=await originalRpc(...args);a.cloud.lockSession();return result;};
 const before=a.updates.length;await assert.rejects(a.cloud.changeStripLibrary({upsert:[record('one',{bucket:'strip-library',path:'luis/example/image.png',type:'image/png',size:50})]}),/Inicia sesión/);assert.equal(a.updates.length,before,'a finished old request does not unlock or update the signed-out UI');
});
test('download verifies the original digest and rejects corrupt bytes',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();const ref=await a.cloud.uploadStripAsset(png(),'one');const bad=new Uint8Array(await png().arrayBuffer());bad[20]^=1;f.db.objects.set(ref.path,new Blob([bad]));await assert.rejects(a.cloud.downloadStripAsset(ref),/no coincide/);
});

test('strip uploads repair mislabeled PNG, JPEG and WebP without changing image bytes',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();
 const writes=[],from=a.client.storage.from;
 a.client.storage.from=bucket=>{const store=from(bucket);return {...store,async upload(path,blob,options){writes.push({path,contentType:options.contentType});return store.upload(path,blob,options);}};};
 const cases=[
  {bytes:new Uint8Array([137,80,78,71,13,10,26,10,9,8,7,6]),type:'image/png',label:'image/jpeg',extension:'png'},
  {bytes:new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1]),type:'image/jpeg',label:'image/png',extension:'jpg'},
  {bytes:new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80]),type:'image/webp',label:'image/png',extension:'webp'}
 ];
 for(const [index,item] of cases.entries()){
  const ref=await a.cloud.uploadStripAsset(new Blob([item.bytes],{type:item.label}),'mislabeled-'+index);
  assert.equal(ref.type,item.type);assert.ok(ref.path.endsWith('/image.'+item.extension));assert.equal(writes.at(-1).contentType,item.type);
  const copy=await a.cloud.downloadStripAsset(ref);assert.equal(copy.type,item.type);assert.deepEqual(new Uint8Array(await copy.arrayBuffer()),item.bytes);
 }
 const before=f.db.uploads;
 await assert.rejects(a.cloud.uploadStripAsset(new Blob(['broken image'],{type:'image/png'}),'bad'),error=>error.code==='STRIP_IMAGE_FORMAT');
 assert.equal(f.db.uploads,before);assert.equal(f.db.rpcCalls,0);
});

test('multipart strip upload uses the real image type while preserving chunked bytes',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();
 const bytes=new Uint8Array(STRIP_ASSET_PART_BYTES+4);bytes.set([255,216,255,224]);bytes[bytes.length-1]=17;
 const ref=await a.cloud.uploadStripAsset(new Blob([bytes],{type:'image/png'}),'mislabeled-large');
 assert.equal(ref.type,'image/jpeg');assert.equal(ref.parts.length,2);
 assert.deepEqual(new Uint8Array(await (await a.cloud.downloadStripAsset(ref)).arrayBuffer()),bytes);
});

test('a delayed library reply never replaces a newer revision received by an in-flight pull',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();
 let holdNext=true,release;const from=a.client.from;
 a.client.from=table=>{const query=from(table);if(table==='shared_inventory'){const single=query.single;query.single=async()=>{if(holdNext){holdNext=false;return new Promise(resolve=>{release=()=>resolve({data:clone(f.db.row)})});}return single();};}return query;};
 const pendingPull=a.cloud.pull(),rpc=a.client.rpc;
 a.client.rpc=async(...args)=>{const saved=await rpc(...args);f.db.row.revision++;f.db.row.data.ready.perfume=42;release();await pendingPull;return saved;};
 const library=await a.cloud.changeStripLibrary({upsert:[record('one',{bucket:'strip-library',path:'luis/example/image.png',type:'image/png',size:50})]});
 assert.equal(library.entries.length,1);assert.equal(a.cloud.revision,3);assert.equal(a.updates.at(-1).ready.perfume,42);assert.equal(a.cloud.remote.revision,3);
});

test('manual strip refresh receives the latest shared artwork and stock without any writes',async t=>{
 const f=fixture(),a=f.make('ximena');t.after(()=>a.cloud.stop());await a.cloud.start();
 f.db.row.revision=2;f.db.row.data.ready.perfume=9;
 f.db.row.data.stripLibrary.entries.push(record('from-luis',{bucket:'strip-library',path:'luis/shared/image.png',type:'image/png',size:50}));
 const library=await a.cloud.refreshStripLibrary();
 assert.equal(library.entries[0].id,'from-luis');assert.equal(a.cloud.revision,2);assert.equal(a.cloud.remote.revision,2);assert.equal(a.updates.at(-1).ready.perfume,9);
 const count=a.updates.length;await a.cloud.refreshStripLibrary();assert.equal(a.updates.length,count,'unchanged metadata does not trigger another full render');
 assert.equal(f.db.rpcCalls,0);assert.equal(f.db.uploads,0);assert.equal(f.db.objects.size,0);
});

test('manual strip refresh refuses cancellation and never updates a signed-out session',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();
 await assert.rejects(a.cloud.refreshStripLibrary({cancelled:()=>true}),/cancelada/);
 const from=a.client.from;a.client.from=table=>{const query=from(table);if(table==='shared_inventory'){const single=query.single;query.single=async()=>{const row=await single();a.cloud.lockSession();return row;};}return query;};
 f.db.row.revision++;const count=a.updates.length;
 await assert.rejects(a.cloud.refreshStripLibrary(),/Inicia sesión/);assert.equal(a.updates.length,count);assert.equal(a.cloud.mode,'auth');assert.equal(f.db.rpcCalls,0);
});

test('a delayed manual strip refresh cannot roll back a newer inventory or library',async t=>{
 const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();
 f.db.row.revision=2;f.db.row.data.stripLibrary.entries.push(record('first',{bucket:'strip-library',path:'luis/shared/image.png',type:'image/png',size:50}));
 let hold=true,release;const from=a.client.from;
 a.client.from=table=>{const query=from(table);if(table==='shared_inventory'){const single=query.single;query.single=async()=>{if(hold){hold=false;const old=clone(f.db.row);return new Promise(resolve=>{release=()=>resolve({data:old});});}return single();};}return query;};
 const refresh=a.cloud.refreshStripLibrary();
 f.db.row.revision=3;f.db.row.data.ready.perfume=42;f.db.row.data.stripLibrary.entries.push(record('latest',{bucket:'strip-library',path:'ximena/new/image.png',type:'image/png',size:50}));
 await a.cloud.pull();const count=a.updates.length;release();const library=await refresh;
 assert.equal(library.entries.length,2);assert.equal(a.cloud.revision,3);assert.equal(a.cloud.remote.revision,3);assert.equal(a.updates.at(-1).ready.perfume,42);assert.equal(a.updates.length,count);assert.equal(f.db.rpcCalls,0);
});
