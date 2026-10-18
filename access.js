export const defaultCloudConfig={url:'https://mjtgceliongqpbqzwkno.supabase.co',key:'sb_publishable_8KO7ivfDMFtLdrtCKEvcnA_cZikAYNs',activated:true};
export function hasAppAccess(cloud){return Boolean(cloud?.mode==='ready'&&cloud.connected&&cloud.user&&['Luis','Ximena'].includes(cloud.member?.display_name));}
export function clearBusinessCache(storage){for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key==='alma-mia-inventory-v1'||key?.startsWith('alma-mia-before-cloud-'))storage.removeItem(key);}}
