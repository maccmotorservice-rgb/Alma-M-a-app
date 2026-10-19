import {mkdir,copyFile,chmod} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dest=new URL('assets/ocr/',root);await mkdir(dest,{recursive:true});
for(const [source,target] of [
 ['node_modules/tesseract.js/dist/tesseract.esm.min.js','tesseract.esm.min.js'],
 ['node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'],
 ['node_modules/tesseract.js/dist/worker.min.js','worker.min.js'],
 ['node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'],
 ['node_modules/tesseract.js/LICENSE.md','TESSERACT-LICENSE.txt'],
 ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm.js'],
 ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm','tesseract-core-lstm.wasm'],
 ['node_modules/tesseract.js-core/LICENSE','CORE-LICENSE.txt'],
 ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','eng.traineddata.gz'],
 ['node_modules/@tesseract.js-data/eng/README.md','DATA-README.md']]){await copyFile(new URL(source,root),new URL(target,dest));await chmod(new URL(target,dest),0o644);}
console.log('Lector OCR y modelo copiados a assets/ocr.');
