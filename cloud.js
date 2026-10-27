import {cloneData,randomId} from './clone-data.js?v=93';
import {STRIP_LIBRARY_BUCKET,MAX_STRIP_ASSET_BYTES,STRIP_ASSET_PART_BYTES,validateStripAsset,validateStripLibrary,mergeStripLibrary} from './strip-library-data.js?v=93';
import {EVIDENCE_BUCKET,validateEvidenceFile,validateEvidenceMetadata} from './evidence.js?v=93';
import {inspectStripImageBlob} from './strip-image-format.js?v=93';
export function validateCloudConfig(value){
 const url=new URL(String(value.url??'').trim());if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.pathname!=='/')throw Error('Usa la Project URL de Supabase: https://tu-proyecto.supabase.co');
 const key=String(value.key??'').trim();if(key.startsWith('sb_secret_'))throw Error('Usa la clave publicable o anon. Nunca una clave secreta ni service_role.');
 let valid=key.startsWith('sb_publishable_');if(!valid){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));valid=payload.role==='anon';}catch{}}
 if(!valid)throw Error('La clave debe ser publicable (sb_publishable_) o la antigua clave anon. No pegues contraseñas.');return {url:url.origin,key,activated:Boolean(value.activated)};
}
const waitForAccess=(request,message)=>{let timer;return Promise.race([Promise.resolve(request),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),12000);})]).finally(()=>clearTimeout(timer));};
const timed=request=>globalThis.AbortSignal?.timeout&&request.abortSignal?request.abortSignal(AbortSignal.timeout(12000)):request;
export class CloudInventory{
 constructor({storage,onData,onStatus,validate,clientFactory,idFactory=()=>randomId()}){this.storage=storage;this.onData=onData;this.onStatus=onStatus;this.validate=validate;this.factory=clientFactory;this.idFactory=idFactory;this.mode='local';this.config=null;this.client=null;this.member=null;this.user=null;this.authSubscription=null;this.revision=0;this.remote=null;this.connected=false;this.saving=false;this.message='Solo en este navegador';this.timer=null;this.channel=null;this.failedSave=null;this.stripQueue=Promise.resolve();this.accessEpoch=0;try{const raw=storage.getItem('alma-mia-cloud-config');if(raw)this.config=validateCloudConfig(JSON.parse(raw));}catch{this.message='La configuración de nube no es válida. Revísala en Conexión.';}}
 get enabled(){return Boolean(this.config);}
 status(message){if(message)this.message=message;this.onStatus?.();}
 async configure(value){const config=validateCloudConfig(value);this.accessEpoch++;this.stop();await this.client?.auth.signOut({scope:'local'});this.config={...config,activated:false};this.storage.setItem('alma-mia-cloud-config',JSON.stringify(this.config));return this.start();}
 accessGuard(){const epoch=this.accessEpoch,config=this.config,client=this.client;return()=>epoch===this.accessEpoch&&config===this.config&&client===this.client;}
 async start(){
  if(!this.config)return;
  const epoch=++this.accessEpoch,config=this.config,current=()=>epoch===this.accessEpoch&&config===this.config;
  this.stop();this.authSubscription?.unsubscribe();this.authSubscription=null;this.user=null;this.member=null;this.remote=null;this.connected=false;this.mode='loading';this.status('Conectando…');
  try{
   const factory=this.factory??(await waitForAccess(import('./assets/supabase-client.js'),'La carga del acceso tardó demasiado. Vuelve a conectar.')).createClient;
   if(!current())return;
   this.factory=factory;const client=this.factory(config.url,config.key,{auth:{storage:this.storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});this.client=client;
   const active=()=>current()&&client===this.client;
   this.authSubscription=client.auth.onAuthStateChange?.(event=>{if(client===this.client&&config===this.config&&event==='SIGNED_OUT')this.lockSession();})?.data?.subscription;
   const{data,error}=await waitForAccess(client.auth.getSession(),'La comprobación de la sesión tardó demasiado. Vuelve a conectar.');
   if(!active())return;
   if(error)throw error;
   if(!data?.session){this.lockSession();return;}
   await this.loadSession(data.session,{active});
  }catch(error){if(!current())return;this.accessEpoch++;this.user=null;this.member=null;this.remote=null;this.mode='error';this.connected=false;this.status('No se pudo conectar: '+error.message);}
 }
 async signIn(email,password){
  if(!this.client)await this.start();
  if(!this.client)throw Error('No se pudo cargar el acceso. Vuelve a conectar.');
  this.accessEpoch++;const active=this.accessGuard(),client=this.client;
  try{
   const{data,error}=await client.auth.signInWithPassword({email,password});
   if(!active())return;
   if(error)throw Error('No se pudo iniciar sesión. Revisa el correo, la contraseña y que la cuenta exista en Supabase.');
   await this.loadSession(data.session,{active});
  }catch(error){if(!active())return;this.accessEpoch++;this.user=null;this.member=null;this.remote=null;this.mode='error';this.connected=false;this.status(error.message);throw error;}
 }
 async loadSession(session,{active=this.accessGuard()}={}){
  if(!active())return;
  if(!session?.user?.id)throw Error('No se pudo comprobar la sesión. Vuelve a iniciar sesión.');
  this.member=null;this.connected=false;this.mode='loading';this.status('Verificando acceso…');this.user=session.user;
  const current=()=>active()&&this.user?.id===session.user.id;
  const{data,error}=await waitForAccess(this.client.from('inventory_members').select('display_name').eq('user_id',session.user.id).maybeSingle(),'La verificación de acceso tardó demasiado. Vuelve a conectar.');
  if(!current())return;
  if(error||!data||!['Luis','Ximena'].includes(data.display_name)){this.mode='auth';this.connected=false;this.status('Esta cuenta no tiene acceso. Completa el archivo de miembros en Supabase.');return;}
  this.member=data;const remote=await waitForAccess(this.read(),'La lectura del inventario tardó demasiado. Vuelve a conectar.');
  if(!current())return;
  this.remote=remote;this.revision=Number(remote.revision);this.connected=true;
  if(!remote.data){this.mode='empty';this.status('Conectado; falta subir el inventario inicial');}
  else if(this.config.activated)await this.acceptRemote({active:current});
  else{this.mode='choice';this.status('Inventario compartido disponible');}
 }
 async read(){const{data,error}=await timed(this.client.from('shared_inventory').select('*').eq('id',true).single());if(error)throw Error('No se pudo leer la nube. Comprueba la conexión y los permisos SQL.');if(!data)throw Error('Falta ejecutar la configuración SQL.');if(data.data)this.validate(data.data);return data;}
 async acceptRemote({active=this.accessGuard()}={}){
  const userId=this.user?.id,remote=await waitForAccess(this.read(),'La lectura del inventario tardó demasiado. Vuelve a conectar.');
  if(!active()||this.user?.id!==userId)return;
  if(!remote.data)throw Error('Todavía no hay inventario en la nube. Súbelo primero desde tu computadora.');
  this.remote=remote;this.revision=Number(remote.revision);this.config.activated=true;this.storage.setItem('alma-mia-cloud-config',JSON.stringify(this.config));this.mode='ready';this.connected=true;this.onData(this.validate(remote.data));this.status('Sincronizado · '+this.member.display_name);this.subscribe();
 }
 subscribe(){this.stop();this.channel=this.client.channel('alma-mia-inventory').on('postgres_changes',{event:'UPDATE',schema:'public',table:'shared_inventory'},()=>{if(!this.saving)this.pull();}).subscribe();this.timer=setInterval(()=>{if(!globalThis.document?.hidden)this.pull();},4000);}
 stop(){clearInterval(this.timer);this.timer=null;if(this.channel&&this.client)this.client.removeChannel(this.channel);this.channel=null;}
 async pull(){if(this.mode!=='ready'||this.saving)return;try{const row=await this.read();this.connected=true;if(Number(row.revision)>this.revision){this.remote=row;this.revision=Number(row.revision);this.onData(this.validate(row.data));}this.status('Sincronizado · '+this.member.display_name);}catch{this.connected=false;this.status('Sin conexión. No se guardarán cambios hasta reconectar.');}}
 async save(data){if(this.mode!=='ready'||!this.connected)throw Error('Conecta e inicia sesión en Nube antes de guardar. No se ha aplicado el cambio.');return this.write(data);}
 async write(data){if(this.saving)throw Error('Espera a que termine el guardado anterior.');this.validate(data);this.saving=true;this.status('Guardando en la nube…');const mutation=this.idFactory(),expected=this.revision;try{const request=()=>timed(this.client.rpc('save_shared_inventory',{expected_revision:expected,new_data:data,mutation_id:mutation}));let result=await request();if(result.error&&!String(result.error.message).includes('INVENTORY_'))result=await request();if(result.error){if(String(result.error.message).includes('INVENTORY_CONFLICT')){const row=await this.read();this.remote=row;this.revision=Number(row.revision);if(row.data)this.onData(this.validate(row.data));throw Error('Otra sesión guardó cambios antes. Se cargó la versión más reciente; revisa y vuelve a registrar tu acción.');}throw Error('No se confirmó el guardado en la nube. Revisa la conexión y los permisos antes de intentarlo otra vez.');}const row=result.data?.[0];if(!row?.data)throw Error('La nube no confirmó un inventario válido.');this.remote=row;this.revision=Number(row.revision);this.connected=true;this.failedSave=null;this.onData(this.validate(row.data));this.status('Sincronizado · '+this.member.display_name);return this.validate(row.data);}catch(e){this.failedSave=cloneData(data);this.status(e.message);throw e;}finally{this.saving=false;}}
 async initialize(data){if(this.mode!=='empty')throw Error('El inventario compartido ya existe. Ábrelo; no subas una copia encima.');const row=await this.read();if(row.data){this.remote=row;this.mode='choice';this.status('Otro dispositivo ya subió el inventario. Abre la copia compartida.');throw Error(this.message);}this.revision=Number(row.revision);await this.write(data);this.config.activated=true;this.storage.setItem('alma-mia-cloud-config',JSON.stringify(this.config));this.mode='ready';this.subscribe();this.status('Sincronizado · '+this.member.display_name);}
 async uploadPaymentEvidence(file,paymentId){if(this.mode!=='ready'||!this.connected||!this.user)throw Error('Conecta Supabase e inicia sesión para compartir el comprobante.');const info=await validateEvidenceFile(file),path=`${this.user.id}/${paymentId}/${this.idFactory()}.${info.extension}`;const{error}=await this.client.storage.from(EVIDENCE_BUCKET).upload(path,file,{contentType:info.type,upsert:false});if(error)throw Error('No se pudo subir el comprobante. Comprueba la conexión y ejecuta la configuración 03-comprobantes.sql en Supabase.');return validateEvidenceMetadata({bucket:EVIDENCE_BUCKET,path,name:info.name,type:info.type,size:info.size});}
 async paymentEvidenceUrl(evidence){validateEvidenceMetadata(evidence);if(this.mode!=='ready'||!this.connected)throw Error('Inicia sesión y conecta la nube para consultar el comprobante.');const{data,error}=await this.client.storage.from(EVIDENCE_BUCKET).createSignedUrl(evidence.path,120);if(error||!data?.signedUrl)throw Error('No se pudo abrir el comprobante. Revisa la conexión y los permisos de almacenamiento.');return data.signedUrl;}
 // Strip assets stay private and immutable. Metadata is saved separately so a
 // partial upload can never publish an image that another device cannot read.
 stripAccess(userId=this.user?.id,client=this.client,cancelled=()=>false){
  if(cancelled())throw Error('Sincronización de tiras cancelada.');
  if(this.mode!=='ready'||!this.connected||!this.user||this.user.id!==userId||this.client!==client||!['Luis','Ximena'].includes(this.member?.display_name))throw Error('Inicia sesión con Luis o Ximena para sincronizar las tiras.');
 }
 async uploadStripAsset(blob,id,{thumbnail=false,cancelled=()=>false}={}){
  const userId=this.user?.id,client=this.client;this.stripAccess(userId,client,cancelled);
  const limit=thumbnail?1024*1024:MAX_STRIP_ASSET_BYTES;
  if(typeof id!=='string'||!id||id.length>1024||!blob||!Number.isSafeInteger(blob.size)||blob.size<1||blob.size>limit)throw Error(thumbnail?'La vista previa de la tira no es válida.':'La tira debe ser una imagen PNG, JPG o WebP de hasta 80 MB.');
  blob=await inspectStripImageBlob(blob);this.stripAccess(userId,client,cancelled);
  const bytes=await blob.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  this.stripAccess(userId,client,cancelled);
  const assetId=this.idFactory(),folder=`${userId}/${assetId}`,extension=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
  if(!/^[a-zA-Z0-9-]+$/.test(userId)||!/^[a-zA-Z0-9-]+$/.test(assetId))throw Error('No se pudo identificar el archivo de la tira.');
  const multipart=blob.size>STRIP_ASSET_PART_BYTES,uploaded=[],parts=[];
  try{
   for(let offset=0,index=0;offset<blob.size;offset+=STRIP_ASSET_PART_BYTES,index++){
    this.stripAccess(userId,client,cancelled);
    const part=blob.slice(offset,Math.min(offset+STRIP_ASSET_PART_BYTES,blob.size)),path=`${folder}/${multipart?'part-'+String(index).padStart(3,'0')+'.bin':(thumbnail?'thumb':'image')+'.'+extension}`;
    const {error}=await client.storage.from(STRIP_LIBRARY_BUCKET).upload(path,part,{contentType:multipart?'application/octet-stream':blob.type,upsert:false});
    if(error){
     const detail=String(error.message??'')+' '+String(error.statusCode??error.status??'');
     const setup=/bucket.*(?:not found|does not exist)|(?:missing|not found|does not exist).*bucket|row.level.security|\brls\b|not authorized|unauthorized|permission|\b403\b/i.test(detail);
     const quota=/quota|storage.*limit|exceed|too large|\b413\b/i.test(detail);
     const failure=Error(setup?'Activa la biblioteca compartida ejecutando 04-biblioteca-tiras.sql en Supabase.':quota?'No se pudo compartir la tira porque el almacenamiento no tiene espacio disponible. Revisa el uso del proyecto en Supabase.':'No se pudo compartir la tira. Revisa la conexión y vuelve a sincronizar.');
     if(setup)failure.code='STRIP_LIBRARY_SETUP';throw failure;
    }
    uploaded.push(path);parts.push({path,size:part.size});this.stripAccess(userId,client,cancelled);
   }
   return validateStripAsset({bucket:STRIP_LIBRARY_BUCKET,path:parts[0].path,type:blob.type,size:blob.size,sha256,...(multipart?{parts}:{})},{thumbnail});
  }catch(error){
   // Remove only the new objects from this attempt, never an existing image.
   if(uploaded.length&&this.user?.id===userId&&this.client===client){try{await client.storage.from(STRIP_LIBRARY_BUCKET).remove(uploaded);}catch{}}
   throw error;
  }
 }
 async downloadStripAsset(input,{cancelled=()=>false}={}){
  const ref=validateStripAsset(input),userId=this.user?.id,client=this.client;this.stripAccess(userId,client,cancelled);
  const blobs=[];
  for(const part of ref.parts??[{path:ref.path,size:ref.size}]){
   this.stripAccess(userId,client,cancelled);
   const {data,error}=await client.storage.from(STRIP_LIBRARY_BUCKET).download(part.path);this.stripAccess(userId,client,cancelled);
   if(error||!data||data.size!==part.size)throw Error('No se pudo descargar una tira compartida. Revisa la conexión y la configuración de la biblioteca.');
   blobs.push(data);
  }
  const blob=new Blob(blobs,{type:ref.type});
  if(blob.size!==ref.size)throw Error('La tira descargada está incompleta. Vuelve a sincronizar la biblioteca.');
  if(ref.sha256){const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()),hex=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');if(hex!==ref.sha256)throw Error('La tira descargada no coincide con el original. Vuelve a sincronizar la biblioteca.');}
  this.stripAccess(userId,client,cancelled);return blob;
 }
 async refreshStripLibrary({cancelled=()=>false}={}){
  const userId=this.user?.id,client=this.client;this.stripAccess(userId,client,cancelled);
  const row=await this.read();this.stripAccess(userId,client,cancelled);
  if(!row.data)throw Error('Primero abre el inventario compartido para consultar las tiras.');
  // This read may finish after another read or save. Keep the latest complete
  // inventory and return its library, without writing to the database or Storage.
  const latest=this.remote?.data&&Number(this.remote.revision)>Number(row.revision)?this.remote:row;
  const saved=this.validate(latest.data),library=validateStripLibrary(saved.stripLibrary);
  if(Number(latest.revision)>this.revision){this.remote=latest;this.revision=Number(latest.revision);this.onData(saved);}
  return library;
 }
 changeStripLibrary({upsert=[],remove=[],cancelled=()=>false}={}){
  const userId=this.user?.id,client=this.client,patch=cloneData({upsert,remove});
  const work=this.stripQueue.catch(()=>{}).then(async()=>{
   this.stripAccess(userId,client,cancelled);
   const waitingUntil=Date.now()+15000;
   while(this.saving){if(Date.now()>waitingUntil)throw Error('Espera a que termine el guardado antes de sincronizar las tiras.');await new Promise(resolve=>setTimeout(resolve,30));this.stripAccess(userId,client,cancelled);}
   this.saving=true;
   try{
    for(let attempt=0;attempt<3;attempt++){
     this.stripAccess(userId,client,cancelled);
     const latest=await this.read();this.stripAccess(userId,client,cancelled);
     if(!latest.data)throw Error('Primero abre el inventario compartido para sincronizar las tiras.');
     const base=this.validate(latest.data),library=mergeStripLibrary(base.stripLibrary,patch,{actor:this.member.display_name}),data={...base,stripLibrary:library};
     this.validate(data);
     const mutation=this.idFactory(),request=()=>timed(client.rpc('save_shared_inventory',{expected_revision:Number(latest.revision),new_data:data,mutation_id:mutation}));
     let result=await request();this.stripAccess(userId,client,cancelled);
     if(result.error&&!String(result.error.message).includes('INVENTORY_')){result=await request();this.stripAccess(userId,client,cancelled);}
     if(result.error){if(String(result.error.message).includes('INVENTORY_CONFLICT'))continue;throw Error('No se confirmó la biblioteca compartida. Revisa la conexión antes de volver a intentar.');}
     const row=result.data?.[0];if(!row?.data)throw Error('La nube no confirmó la biblioteca de tiras.');
     // A pull already in flight may have received a later revision while this
     // RPC reply travelled back. Never replace that newer shared inventory.
     const newer=this.remote?.data&&Number(this.remote.revision)>Number(row.revision);
     const saved=this.validate(newer?this.remote.data:row.data),savedLibrary=validateStripLibrary(saved.stripLibrary);
     if(!newer){this.remote=row;this.revision=Number(row.revision);this.onData(saved);}
     this.connected=true;this.status('Sincronizado · '+this.member.display_name);return savedLibrary;
    }
    throw Error('Otra sesión está guardando cambios. La biblioteca local se conserva; vuelve a sincronizar en unos segundos.');
   }finally{this.saving=false;}
  });
  this.stripQueue=work.catch(()=>{});return work;
 }
 lockSession(){this.accessEpoch++;this.stop();this.member=null;this.user=null;this.remote=null;this.failedSave=null;this.connected=false;this.mode='auth';this.status('Inicia sesión para acceder a Alma Mía.');}
 async signOut(){const client=this.client;this.lockSession();await client?.auth.signOut({scope:'local'});}
}
