import {z} from "zod";
import {MAX_COVER_BYTES,customCoverSchema,validateCoverBlob} from "./cover-files";
import {MAX_BACKUP_BYTES} from "./backup";
import type {Book} from "./model";
const imagesSchema=z.record(customCoverSchema.refine(value=>!!value),z.string().max(Math.ceil(MAX_COVER_BYTES/3)*4+30).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).default({});
async function encode(blob:Blob){const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return "data:image/jpeg;base64,"+btoa(binary)}
async function decode(value:string){const binary=atob(value.slice(value.indexOf(",")+1));return validateCoverBlob(new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:"image/jpeg"}))}
export async function createCoverBackup(books:Book[],load:(path:string)=>Promise<Blob>){
 const coverImages:Record<string,string>={};
 for(const book of books)if(book.customCover&&!coverImages[book.customCover])coverImages[book.customCover]=await encode(await load(book.customCover));
 const backup={format:"draci-archiv-v1",exportedAt:new Date().toISOString(),books,coverImages};
 const text=JSON.stringify(backup);if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)throw new Error("Záloha s obrázky přesahuje 5 MB. Knihovna zůstala beze změny.");
 return text;
}
export async function restoreCoverBackup(input:unknown,books:Book[],save:(blob:Blob)=>Promise<{path:string}>,canKeep:(path:string)=>boolean){
 const images=imagesSchema.parse((input as any)?.coverImages),saved=new Map<string,string>();let missingCovers=0;
 const result:Book[]=[];
 for(const book of books){let path=book.customCover;if(path){if(images[path]){if(!saved.has(path))saved.set(path,(await save(await decode(images[path]))).path);path=saved.get(path)!}else if(!canKeep(path)){path="";missingCovers++}}result.push({...book,customCover:path})}
 return {books:result,missingCovers};
}
