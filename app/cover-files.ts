import {z} from "zod";
export const MAX_COVER_BYTES=256*1024;
export const COVER_BUCKET="book-covers";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const customCoverSchema=z.string().max(100).regex(new RegExp(`^(?:|(?:local|${uuid})/${uuid}\\.jpg)$`)).default("");
export function ownedCover(path:string,userId:string){return customCoverSchema.safeParse(path).success&&path.startsWith(userId+"/")}
export async function validateCoverBlob(value:unknown):Promise<Blob>{
 if(!(value instanceof Blob)||value.type!=="image/jpeg"||value.size>MAX_COVER_BYTES||value.size<4)throw new Error("Obálka musí být zpracovaný JPEG do 256 kB.");
 const bytes=new Uint8Array(await value.arrayBuffer());
 if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error("Obrázek obálky není platný JPEG.");
 return value;
}
export async function prepareCover(file:File):Promise<Blob>{
 if(file.size>20*1024*1024)throw new Error("Vyber obrázek do 20 MB.");
 if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type))throw new Error("Vyber JPG, PNG, WebP nebo fotografii HEIC.");
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Obrázek se nepodařilo otevřít. Zkus ho uložit jako JPG nebo PNG."));image.src=url});
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height||width*height>50000000)throw new Error("Obrázek má příliš velké rozměry. Zmenši ho a zkus to znovu.");
  const scale=Math.min(1,600/width,900/height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("Prohlížeč nemůže zpracovat obrázek.");
  context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.86,.72,.56,.4]){const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Obrázek nelze zpracovat.")),"image/jpeg",quality));if(blob.size<=MAX_COVER_BYTES)return validateCoverBlob(blob)}
  throw new Error("Obrázek nelze dostatečně zmenšit. Zkus jinou obálku.");
 }finally{URL.revokeObjectURL(url)}
}
