import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStripLibrary,validateStripLibrary,validateStripRecord,validateStripAsset,mergeStripLibrary,STRIP_ASSET_PART_BYTES} from './strip-library-data.js';
import {initialState,validateBackup} from './inventory.js';
const asset={bucket:'strip-library',path:'luis/asset-1/image.png',type:'image/png',size:100};
const imported=(id='original/Nombre 02.png')=>({id,filename:id,name:'Nombre',size:100,productId:null,warning:'',width:946,height:5100,source:'imported',resolution:{x:300,y:300,source:'imagen'},asset});
const generated=(id='created-one')=>({...imported(id),source:'generated',design:{name:'Nombre',size:100,color:'#29272e',category:'Unisex'}});
test('strip manifest only retains private asset metadata; paths and duplicate identities are validated',()=>{
 const raw={...imported(),blob:'binary',thumb:'data:image/png;base64,AAAA'},result=validateStripLibrary({version:1,entries:[raw],deleted:[]});
 assert.equal(result.entries[0].blob,undefined);assert.equal(result.entries[0].thumb,undefined);
 assert.throws(()=>validateStripAsset({...asset,path:'https://example.com/public.png'}));assert.throws(()=>validateStripAsset({...asset,bucket:'public'}));
 assert.throws(()=>validateStripLibrary({version:1,entries:[raw,raw],deleted:[]}));
 assert.throws(()=>validateStripLibrary({version:1,entries:[raw],deleted:[{id:raw.id,deletedAt:'2026-10-20'}]}));
 assert.throws(()=>validateStripRecord({...raw,width:80000001,height:1}));
});
test('multipart refs reconstruct one bounded original in a fixed private folder',()=>{
 const parts=[{path:'luis/large/part-000.bin',size:STRIP_ASSET_PART_BYTES},{path:'luis/large/part-001.bin',size:15}],ref={...asset,path:parts[0].path,size:STRIP_ASSET_PART_BYTES+15,parts};
 assert.deepEqual(validateStripAsset(ref).parts,parts);
 assert.throws(()=>validateStripAsset({...ref,size:ref.size+1}));
 assert.throws(()=>validateStripAsset({...ref,parts:[parts[0],{...parts[1],path:'ximena/other/part-001.bin'}]}));
 assert.throws(()=>validateStripAsset({...ref,parts:[{...parts[0],size:100},parts[1]],size:115}));
});
test('shared edits merge entries and tombstones; deletions cannot resurrect through older backups',()=>{
 let lib=mergeStripLibrary(emptyStripLibrary(),{upsert:[generated()]},{actor:'Luis',now:'2026-10-20T10:00:00Z'});
 lib=mergeStripLibrary(lib,{upsert:[generated('created-two')]},{actor:'Ximena',now:'2026-10-20T10:10:00Z'});
 assert.deepEqual(lib.entries.map(r=>r.createdBy),['Luis','Ximena']);
 lib=mergeStripLibrary(lib,{remove:['created-one']},{actor:'Ximena',now:'2026-10-20T10:20:00Z'});
 assert.equal(lib.entries.length,1);assert.equal(lib.deleted[0].deletedBy,'Ximena');
 assert.deepEqual(mergeStripLibrary(lib,{remove:['created-one']},{actor:'Luis'}).deleted,lib.deleted,'repeat removal keeps the original tombstone');
 const pending=mergeStripLibrary(lib,{upsert:[{...generated(),updatedAt:'2026-10-20T10:15:00Z'}]},{actor:'Luis'});assert.equal(pending.entries.length,1,'pending upload cannot undo a newer deletion');
 const restored=mergeStripLibrary(lib,{upsert:[{...generated(),updatedAt:'2026-10-20T10:30:00Z'}]},{actor:'Luis'});assert.equal(restored.entries.length,2);assert.equal(restored.deleted.length,0,'explicit recreation is allowed');
 assert.throws(()=>mergeStripLibrary({version:1,entries:[imported()],deleted:[]},{remove:[imported().id]},{actor:'Luis'}),/Solo puedes eliminar/);
});
test('inventory validation keeps the shared library and old backups start without one',()=>{
 const catalog=[{id:'98',name:'Nombre',category:'Unisex',line:'Nicho',reference:'Nombre'}],state=initialState(catalog);
 state.stripLibrary=mergeStripLibrary(undefined,{upsert:[imported()]},{actor:'Luis'});
 assert.deepEqual(validateBackup(state,catalog).stripLibrary,state.stripLibrary);
 delete state.stripLibrary;assert.deepEqual(validateBackup(state,catalog).stripLibrary,emptyStripLibrary());
});
