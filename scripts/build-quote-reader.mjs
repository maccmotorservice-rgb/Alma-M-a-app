import {mkdir,copyFile,chmod,readFile,writeFile} from 'node:fs/promises';
const dest=new URL('../assets/quote-reader/',import.meta.url);await mkdir(dest,{recursive:true});
for(const [source,target] of [['legacy/build/pdf.mjs','pdf.mjs'],['legacy/build/pdf.worker.mjs','pdf.worker.mjs'],['LICENSE','LICENSE.txt']]){await copyFile(new URL('../node_modules/pdfjs-dist/'+source,import.meta.url),new URL(target,dest));await chmod(new URL(target,dest),0o644);}

const worker=new URL('pdf.worker.mjs',dest);await writeFile(worker,"import '../../quotation-reader-compat.js?v=86';\n"+await readFile(worker,'utf8'));
