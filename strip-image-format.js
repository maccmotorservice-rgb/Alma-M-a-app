// ZIP filenames and browser Blob.type can disagree. Detect the original bytes;
// correcting the MIME label must never re-encode or alter the printed artwork.
export function detectStripImageType(header) {
 const bytes=header instanceof Uint8Array?header:new Uint8Array(header??0);
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function inspectStripImageBlob(blob) {
 const invalid=()=>{const error=Error('La imagen de la tira no tiene un formato PNG, JPG o WebP válido.');error.code='STRIP_IMAGE_FORMAT';return error;};
 if(!blob||typeof blob.slice!=='function'||!Number.isSafeInteger(blob.size)||blob.size<1)throw invalid();
 const type=detectStripImageType(new Uint8Array(await blob.slice(0,12).arrayBuffer()));
 if(!type)throw invalid();
 return blob.type===type?blob:new Blob([blob],{type});
}
