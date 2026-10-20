import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudInventory,validateCloudConfig} from './cloud.js';
const clone=x=>structuredClone(x),initial={version:1,materials:[],movements:[],ready:{}};
function fixture(){
 const db={row:{id:true,revision:0,data:null},mutations:new Set(),offline:false,loseReply:false};
 function client(){const result=table=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{display_name:'Luis'}}),single:async()=>db.offline?{error:{message:'offline'}}:{data:clone(db.row)}});return {auth:{getSession:async()=>({data:{session:{user:{id:'luis'}}}}),signOut:async()=>({})},from:result,channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){},rpc:async(_,p)=>{if(db.offline)return{error:{message:'offline'}};if(db.mutations.has(p.mutation_id))return{data:[clone(db.row)]};if(p.expected_revision!==db.row.revision)return{error:{message:'INVENTORY_CONFLICT'}};db.row={...db.row,revision:db.row.revision+1,data:clone(p.new_data)};db.mutations.add(p.mutation_id);if(db.loseReply){db.loseReply=false;return{error:{message:'lost response'}}}return{data:[clone(db.row)]}}};}
 const make=()=>{const map=new Map([['alma-mia-cloud-config',JSON.stringify({url:'https://example.supabase.co',key:'sb_publishable_test'})]]);const updates=[];const cloud=new CloudInventory({storage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},clientFactory:client,onData:d=>updates.push(d),validate:d=>clone(d)});return {cloud,updates}};
 return{db,make};
}
test('configuración rechaza claves secretas y direcciones ajenas',()=>{assert.throws(()=>validateCloudConfig({url:'https://example.supabase.co',key:'sb_secret_abc'}));assert.throws(()=>validateCloudConfig({url:'https://example.com',key:'sb_publishable_abc'}));assert.equal(validateCloudConfig({url:'https://example.supabase.co',key:'sb_publishable_abc'}).url,'https://example.supabase.co')});
test('subida inicial y otro dispositivo comparten cambios',async t=>{const f=fixture(),a=f.make(),b=f.make();t.after(()=>{a.cloud.stop();b.cloud.stop()});await a.cloud.start();assert.equal(a.cloud.mode,'empty');await a.cloud.initialize(initial);await b.cloud.start();assert.equal(b.cloud.mode,'choice');await b.cloud.acceptRemote();await a.cloud.save({...initial,ready:{perfume:2}});await b.cloud.pull();assert.equal(b.updates.at(-1).ready.perfume,2);assert.equal(b.cloud.revision,2)});
test('conflicto de dos sesiones conserva la versión ya guardada',async t=>{const f=fixture(),a=f.make(),b=f.make();t.after(()=>{a.cloud.stop();b.cloud.stop()});await a.cloud.start();await a.cloud.initialize(initial);await b.cloud.start();await b.cloud.acceptRemote();await a.cloud.save({...initial,ready:{perfume:3}});await assert.rejects(b.cloud.save({...initial,ready:{perfume:9}}),/Otra sesión/);assert.equal(f.db.row.data.ready.perfume,3);assert.equal(b.updates.at(-1).ready.perfume,3);assert.equal(b.cloud.failedSave.ready.perfume,9)});
test('reintento con misma operación no duplica la revisión',async t=>{const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();await a.cloud.initialize(initial);f.db.loseReply=true;await a.cloud.save({...initial,ready:{perfume:4}});assert.equal(f.db.row.revision,2);assert.equal(f.db.mutations.size,2)});
test('sin conexión bloquea cambios y recupera al reconectar',async t=>{const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();await a.cloud.initialize(initial);f.db.offline=true;await a.cloud.pull();assert.equal(a.cloud.connected,false);await assert.rejects(a.cloud.save(initial),/No se ha aplicado/);f.db.offline=false;await a.cloud.pull();assert.equal(a.cloud.connected,true)});
test('subida inicial no sobrescribe datos de otro dispositivo',async t=>{const f=fixture(),a=f.make();t.after(()=>a.cloud.stop());await a.cloud.start();f.db.row={id:true,revision:1,data:initial};await assert.rejects(a.cloud.initialize({...initial,ready:{wrong:1}}),/Otro dispositivo/);assert.deepEqual(f.db.row.data,initial)});

test('dos dispositivos no guardan dos notas vigentes del mismo lote',async t=>{const {buildSalesNote,insertSalesNote,cancelSalesNote}=await import('./sales.js');const f=fixture(),a=f.make(),b=f.make();t.after(()=>{a.cloud.stop();b.cloud.stop()});const base={...initial,batches:[{id:'lot-1'}],salesNotes:[]},draft={customer:'Cliente',date:'2026-10-18',sourceBatch:{id:'lot-1',number:1,type:'stock'},items:[{name:'Perfume',reference:'Referencia',category:'Perfumes de dama - Diseñador',size:100,qty:1,price:649}]},one=buildSalesNote(draft,{id:'one',createdBy:'Luis'}),two=buildSalesNote(draft,{id:'two',createdBy:'Ximena'});await a.cloud.start();await a.cloud.initialize(base);await b.cloud.start();await b.cloud.acceptRemote();const aChange=insertSalesNote(a.updates.at(-1),one),bChange=insertSalesNote(b.updates.at(-1),two);await a.cloud.save(aChange);await assert.rejects(b.cloud.save(bChange),/Otra sesión/);assert.equal(f.db.row.data.salesNotes.length,1);assert.throws(()=>insertSalesNote(b.updates.at(-1),two),/vigente/);await a.cloud.save(cancelSalesNote(a.updates.at(-1),'one',{actor:'Luis',expectedRevision:0,reason:'Pedido corregido'}));await b.cloud.pull();await b.cloud.save(insertSalesNote(b.updates.at(-1),two));assert.equal(f.db.row.data.salesNotes.filter(n=>n.status!=='cancelled').length,1);assert.equal(f.db.row.data.salesNotes.length,2);});

test('comprobantes privados: upload sin sobrescribir y enlace temporal; fallos no guardan abonos',async()=>{const calls=[],cloud=new CloudInventory({storage:{getItem(){return null}},idFactory:()=> 'file'});cloud.mode='ready';cloud.connected=true;cloud.user={id:'luis'};let fail=false;cloud.client={storage:{from(bucket){assert.equal(bucket,'payment-evidence');return {async upload(path,file,options){calls.push({path,options});return {error:fail?{message:'denied'}:null}},async createSignedUrl(path,seconds){assert.equal(seconds,120);return fail?{error:{message:'denied'}}:{data:{signedUrl:'https://example.supabase.co/private?token=temporary'}}}}}}};const file=new File(['%PDF-1.4\nproof'],'pago.pdf',{type:'application/pdf'}),evidence=await cloud.uploadPaymentEvidence(file,'payment');assert.equal(evidence.path,'luis/payment/file.pdf');assert.deepEqual(calls[0].options,{contentType:'application/pdf',upsert:false});assert.match(await cloud.paymentEvidenceUrl(evidence),/token=temporary/);fail=true;await assert.rejects(cloud.uploadPaymentEvidence(file,'payment'),/03-comprobantes/);await assert.rejects(cloud.paymentEvidenceUrl(evidence),/permisos/);cloud.connected=false;await assert.rejects(cloud.uploadPaymentEvidence(file,'payment'),/Conecta/);assert.equal(calls.length,2);});

// Authentication startup must work with the same guarded storage used by the
// app, and late network replies must never reopen a signed-out session.
function accessFixture(factory){
 const map=new Map([['alma-mia-cloud-config',JSON.stringify({url:'https://example.supabase.co',key:'sb_publishable_test',activated:true})]]),updates=[],statuses=[];
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const cloud=new CloudInventory({storage,clientFactory:factory,onData:data=>updates.push(data),onStatus:()=>statuses.push(cloud.message),validate:clone});
 return {cloud,storage,updates,statuses,map};
}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
const flushAccess=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('authentication receives guarded app storage and an empty session opens the login form',async()=>{
 let options;const f=accessFixture((url,key,value)=>{options=value;return {auth:{getSession:async()=>({data:{session:null}})}};});
 await f.cloud.start();assert.equal(options.auth.storage,f.storage);assert.equal(options.auth.persistSession,true);assert.equal(f.cloud.mode,'auth');assert.equal(f.cloud.connected,false);assert.equal(f.updates.length,0);assert.equal(f.map.size,1);
});

test('startup session timeout is bounded without AbortSignal and ignores late replies before a clean retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const slow=deferred();let instances=0,reads=0,oldAuthListener;
 const f=accessFixture(()=>({auth:{onAuthStateChange(callback){oldAuthListener??=callback;return {data:{subscription:{unsubscribe(){}}}};},getSession:()=>++instances===1?slow.promise:Promise.resolve({data:{session:null}})},from(){reads++;throw Error('must not read a late session');}}));
 const start=f.cloud.start();await flushAccess();t.mock.timers.tick(11999);await flushAccess();assert.equal(f.cloud.mode,'loading');
 t.mock.timers.tick(1);await start;assert.equal(f.cloud.mode,'error');assert.match(f.cloud.message,/sesión tardó demasiado/);assert.equal(f.cloud.connected,false);
 slow.resolve({data:{session:{user:{id:'late'}}}});await flushAccess();assert.equal(reads,0);assert.equal(f.updates.length,0);assert.equal(f.cloud.user,null);
 await f.cloud.start();assert.equal(f.cloud.mode,'auth');const epoch=f.cloud.accessEpoch;oldAuthListener('SIGNED_OUT');assert.equal(f.cloud.accessEpoch,epoch,'a listener belonging to an old client cannot change the current session');
});

test('logout during membership lookup blocks the late member and inventory response',async()=>{
 const membership=deferred();let reads=0,signedOut=0;
 const f=accessFixture(()=>({auth:{getSession:async()=>({data:{session:{user:{id:'luis'}}}}),signOut:async()=>{signedOut++;return {};}},from(table){assert.equal(table,'inventory_members');return {select(){return this;},eq(){return this;},maybeSingle(){reads++;return membership.promise;}}},removeChannel(){}}));
 const start=f.cloud.start();await flushAccess();assert.equal(reads,1);assert.equal(f.cloud.mode,'loading');
 await f.cloud.signOut();membership.resolve({data:{display_name:'Luis'}});await start;
 assert.equal(signedOut,1);assert.equal(reads,1);assert.equal(f.cloud.mode,'auth');assert.equal(f.cloud.user,null);assert.equal(f.cloud.member,null);assert.equal(f.cloud.remote,null);assert.equal(f.cloud.connected,false);assert.equal(f.updates.length,0);
});

test('membership timeout reports an error and cannot accept a delayed authorization',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const membership=deferred();let inventoryReads=0;
 const f=accessFixture(()=>({auth:{getSession:async()=>({data:{session:{user:{id:'luis'}}}})},from(table){if(table!=='inventory_members')inventoryReads++;return {select(){return this;},eq(){return this;},maybeSingle:()=>membership.promise};}}));
 const start=f.cloud.start();await flushAccess();t.mock.timers.tick(12000);await start;
 assert.equal(f.cloud.mode,'error');assert.match(f.cloud.message,/verificación de acceso tardó demasiado/);membership.resolve({data:{display_name:'Luis'}});await flushAccess();assert.equal(inventoryReads,0);assert.equal(f.cloud.member,null);assert.equal(f.cloud.connected,false);assert.equal(f.updates.length,0);
});

test('logout during accepting inventory prevents late data and activation writes',async()=>{
 const row=deferred();const f=accessFixture(()=>({auth:{getSession:async()=>({data:{session:null}})}}));
 await f.cloud.start();f.cloud.user={id:'luis'};f.cloud.member={display_name:'Luis'};f.cloud.mode='choice';const before=f.storage.getItem('alma-mia-cloud-config');
 f.cloud.read=()=>row.promise;const accepting=f.cloud.acceptRemote();f.cloud.lockSession();row.resolve({revision:9,data:initial});await accepting;
 assert.equal(f.cloud.mode,'auth');assert.equal(f.cloud.user,null);assert.equal(f.cloud.remote,null);assert.equal(f.storage.getItem('alma-mia-cloud-config'),before);assert.equal(f.updates.length,0);
});
