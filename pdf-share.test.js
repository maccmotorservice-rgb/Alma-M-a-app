import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfFilename,canSharePdfFile,sharePdfFile} from './pdf-share.js';

test('PDF filenames retain the customer name and have a safe PDF extension',()=>{
 assert.equal(pdfFilename('Nota de Ximena.pdf'),'Nota de Ximena.pdf');
 assert.equal(pdfFilename('path/Nota: "Cliente".PDF'),'Nota- -Cliente-.pdf');
 assert.equal(pdfFilename(''),'Alma-Mia.pdf');
 assert.equal(pdfFilename('Reporte'),'Reporte.pdf');
 assert.ok(pdfFilename('a'.repeat(400)).length<180);
});

test('file sharing passes the actual PDF File and starts within the click call',async()=>{
 const file={name:'Lista.pdf',type:'application/pdf'},calls=[];
 const navigator={canShare(data){calls.push(['canShare',data]);return true;},share(data){calls.push(['share',data]);return Promise.resolve();}};
 const result=sharePdfFile(file,{navigator,title:'Lista de producción'});
 assert.equal(calls.at(-1)[0],'share','share must run before the first await yields');
 assert.deepEqual(calls.at(-1)[1],{files:[file],title:'Lista de producción'});
 assert.deepEqual(await result,{status:'shared'});
});

test('unsupported devices do not pretend to share a file and cancellation is silent',async()=>{
 const file={name:'Lista.pdf'};
 assert.equal(canSharePdfFile(file,{}),false);
 assert.equal(canSharePdfFile(file,{share(){},canShare(){throw Error('unsupported')}}),false);
 assert.deepEqual(await sharePdfFile(file,{navigator:{share(){throw Error('must not run')}}}),{status:'unsupported'});
 assert.deepEqual(await sharePdfFile(file,{navigator:{canShare:()=>true,share:()=>Promise.reject({name:'AbortError'})}}),{status:'cancelled'});
 const failure=Error('blocked');
 assert.deepEqual(await sharePdfFile(file,{navigator:{canShare:()=>true,share:()=>Promise.reject(failure)}}),{status:'failed',error:failure});
});
