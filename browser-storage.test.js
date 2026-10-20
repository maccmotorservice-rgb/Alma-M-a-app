import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserStorage} from './browser-storage.js';

function fixture(initial={}) {
 const values=new Map(Object.entries(initial)),blocked=new Set();
 const check=operation=>{if(blocked.has(operation))throw new DOMException('Storage denied','SecurityError');};
 const source={
  getItem(key){check('get');return values.get(key)??null;},
  setItem(key,value){check('set');values.set(key,value);},
  removeItem(key){check('remove');values.delete(key);},
  key(index){check('key');return [...values.keys()][index]??null;},
  get length(){check('length');return values.size;}
 };
 let reads=0;
 const store=createBrowserStorage('localStorage',{getStorage:()=>{reads++;check('storage');return source;}});
 return {values,blocked,store,get reads(){return reads;}};
}

test('Storage is resolved lazily and successful operations preserve real browser data',()=>{
 const f=fixture({original:'keep'});assert.equal(f.reads,0);
 assert.equal(f.store.getItem('original'),'keep');
 f.store.setItem('new',42);assert.equal(f.values.get('new'),'42');
 assert.equal(f.store.length,2);assert.equal(f.store.key(0),'original');
 f.store.removeItem('new');assert.equal(f.values.has('new'),false);assert.equal(f.store.length,1);
 assert.equal(f.values.get('original'),'keep');
});

test('a denied browser Storage getter supports per-page writes, removals and enumeration',()=>{
 const f=fixture({untouched:'existing'});f.blocked.add('storage');
 assert.equal(f.store.getItem('missing'),null);assert.equal(f.store.length,0);
 f.store.setItem('first','one');f.store.setItem('second','two');
 assert.equal(f.store.getItem('first'),'one');assert.equal(f.store.length,2);
 assert.equal(f.store.key(0),'first');assert.equal(f.store.key(1),'second');assert.equal(f.store.key(2),null);
 f.store.removeItem('first');assert.equal(f.store.getItem('first'),null);assert.equal(f.store.length,1);
 assert.equal(f.values.get('untouched'),'existing');assert.equal(f.values.has('first'),false);
});

test('failed writes remain visible over the old real value without overwriting other data',()=>{
 const f=fixture({changed:'before',other:'keep'});f.blocked.add('set');
 f.store.setItem('changed','after');f.store.setItem('new','pending');
 assert.equal(f.store.getItem('changed'),'after');assert.equal(f.values.get('changed'),'before');
 assert.equal(f.store.getItem('new'),'pending');assert.equal(f.store.length,3);
 assert.equal(f.values.get('other'),'keep');
 f.blocked.delete('set');f.store.setItem('changed','saved');
 assert.equal(f.store.getItem('changed'),'saved');assert.equal(f.values.get('changed'),'saved');
});

test('failed removal hides the old value and key instead of restoring a signed-out session',()=>{
 const f=fixture({session:'old-token',other:'keep'});f.blocked.add('remove');
 assert.equal(f.store.getItem('session'),'old-token');f.store.removeItem('session');
 assert.equal(f.values.get('session'),'old-token');assert.equal(f.store.getItem('session'),null);
 assert.equal(f.store.length,1);assert.equal(f.store.key(0),'other');
 f.blocked.add('set');f.store.setItem('session','new-token');
 assert.equal(f.store.getItem('session'),'new-token');assert.equal(f.store.length,2);
 f.store.removeItem('session');assert.equal(f.store.getItem('session'),null);assert.equal(f.store.length,1);
});

test('reads observe other tabs and retain only known values when reading becomes blocked',()=>{
 const f=fixture({shared:'one'});assert.equal(f.store.getItem('shared'),'one');
 f.values.set('shared','two');assert.equal(f.store.getItem('shared'),'two');
 f.blocked.add('get');assert.equal(f.store.getItem('shared'),'two');assert.equal(f.store.getItem('unknown'),null);
 f.blocked.delete('get');f.values.delete('shared');assert.equal(f.store.getItem('shared'),null);
 f.blocked.add('get');assert.equal(f.store.getItem('shared'),null);
});

test('enumeration failures use known values plus pending changes and exclusions',()=>{
 for(const operation of ['key','length']){
  const f=fixture({cached:'value',removed:'value'});
  f.store.getItem('cached');f.store.getItem('removed');
  f.blocked.add(operation);f.blocked.add('set');f.blocked.add('remove');
  f.store.setItem('pending','value');f.store.removeItem('removed');
  assert.equal(f.store.length,2);assert.equal(f.store.key(0),'cached');assert.equal(f.store.key(1),'pending');
  assert.equal(f.store.key(-1),null);assert.equal(f.store.key(3),null);
 }
});

test('local and session fallback instances stay independent',()=>{
 const denied=()=>{throw new DOMException('Storage denied','SecurityError');};
 const local=createBrowserStorage('localStorage',{getStorage:denied}),session=createBrowserStorage('sessionStorage',{getStorage:denied});
 local.setItem('user','Luis');session.setItem('user','Ximena');
 assert.equal(local.getItem('user'),'Luis');assert.equal(session.getItem('user'),'Ximena');
});
