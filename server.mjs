import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!['index.html','app.js','inventory.js','dictation.js','cloud.js','cancellation.js','evidence.js','catalog-tools.js','sales.js','sales-panel.js','sales-pdf.js','assets/pdf-client.js','assets/pdf-client.js.LEGAL.txt','assets/supabase-client.js','assets/supabase-client.js.LEGAL.txt','style.css','layout.css','catalog.json','assets/logo.png'].includes(path.relative(root,file))){res.writeHead(404);return res.end('No encontrado');}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('No encontrado');}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Alma Mía iniciada en puerto '+(process.env.PORT||3000)));
