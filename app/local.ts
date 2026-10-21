import { bookSchema, type Book } from "./model";
import {parseBackup,mergeBackup,MAX_BACKUP_BYTES} from "./backup";
import {defaultPreferences,preferencesSchema} from "./preferences";
import {searchCatalog} from "./catalog";
import {localCover,saveLocalCover} from "./local-covers";
import {customCoverSchema} from "./cover-files";
import {restoreCoverBackup} from "./cover-backup";
import {ownCatalogSearch} from "./catalog-mode";
let standalone=false;
let staticBase:string|undefined;
export const enableStaticRouting=(base:string)=>{staticBase=base};
export const assetHref=(path:string)=>staticBase&&path.startsWith("/")?staticBase+path.slice(1):path;
let namespace="draci-archiv";
export const enableLocal=(scope?:"test")=>{standalone=true;if(scope)namespace="liskaplikace-test-v1"};
export const isLocal=()=>standalone||typeof window!=="undefined"&&window.location.protocol==="file:";
export function appHref(path:string){
 if(!isLocal()&&!staticBase)return path;
 const url=new URL(window.location.href);url.hash="";url.search="";
 if(path.startsWith("/kniha/"))url.searchParams.set("book",path.slice(7));
 else if(path.includes("?"))url.search=path.slice(path.indexOf("?"));
 return url.href;
}
const bookKey=()=>namespace==="draci-archiv"?"draci-archiv-local-v1":namespace+"-books";
const preferencesKey=()=>namespace==="draci-archiv"?"liskaplikace-preferences-v1":namespace+"-preferences";
function read():Book[]{
 let raw;try{raw=localStorage.getItem(bookKey())}catch{throw new Error("Prohlížeč nepovolil místní ukládání. Otevři soubor v běžném okně Edge nebo Chrome.")}
 if(!raw)return [];
 try{const data=JSON.parse(raw);if(!Array.isArray(data))throw new Error();return data.map((book:any)=>book.status==="paused"?{...book,status:"tbr"}:book)}catch{throw new Error("Místní knihovnu nelze přečíst. Existující data nebyla přepsána.")}
}
function write(books:Book[]){try{localStorage.setItem(bookKey(),JSON.stringify(books))}catch{throw new Error("Knihovnu nelze uložit. Úložiště prohlížeče může být plné nebo zakázané.")}}
export async function localApi(path:string,method:string,body?:any):Promise<any>{
 const url=new URL(path,"https://local.invalid");
 if(url.pathname==="/api/covers"){
  if(method==="POST")return saveLocalCover(namespace,body);
  const path=url.searchParams.get("path")??"";
  if(method!=="GET"||!path.startsWith("local/")||!customCoverSchema.safeParse(path).success)throw new Error("Neplatná místní obálka.");
  return localCover(namespace,"read",path);
 }
 if(url.pathname==="/api/preferences"){
  const key=preferencesKey(),raw=localStorage.getItem(key),current=raw?preferencesSchema.parse(JSON.parse(raw)):defaultPreferences();
  if(method==="GET")return current;
  if(method!=="PUT")throw new Error("Neznámá operace.");
  const next=preferencesSchema.parse(body);
  if(next.revision!==current.revision)throw new Error("Nastavení se mezitím změnilo v jiném okně. Vyber motiv znovu.");
  const saved={...next,revision:current.revision+1};localStorage.setItem(key,JSON.stringify(saved));return saved;
 }
 if(url.pathname==="/api/import"&&method==="POST"){
  if(new TextEncoder().encode(JSON.stringify(body)).byteLength>MAX_BACKUP_BYTES)throw new Error("Záloha může mít nejvýše 5 MB.");
  const existing=read(),incoming=parseBackup(body),ids=new Set(existing.map(book=>book.id));
  const restored=await restoreCoverBackup(body,[...new Map(incoming.filter(book=>!ids.has(book.id)).map(book=>[book.id,book])).values()],blob=>saveLocalCover(namespace,blob),path=>path.startsWith("local/"));
  const result=mergeBackup(existing,restored.books);write(result.books);return {added:result.added,skipped:incoming.length-result.added,...(restored.missingCovers?{missingCovers:restored.missingCovers}:{})};
 }
 if(url.pathname==="/api/search")return namespace==="liskaplikace-test-v1"?ownCatalogSearch(url.searchParams.get("q")??""):searchCatalog(url.searchParams.get("q")??"",{allLanguages:url.searchParams.get("languages")==="all"});
 if(url.pathname!=="/api/books")throw new Error("Neznámá operace.");
 const books=read();if(method==="GET")return books;
 if(method==="DELETE"){
  const id=url.searchParams.get("id"),rawRevision=url.searchParams.get("revision"),revision=Number(rawRevision),current=books.find(b=>b.id===id);
  if(rawRevision===null||!Number.isInteger(revision)||revision<0)throw new Error("Chybí platná verze knihy.");
  if(!current||current.revision!==revision)throw new Error("Kniha se mezitím změnila. Před odstraněním obnov knihovnu a zkontroluj její obsah.");
  write(books.filter(b=>b.id!==id));return {ok:true};
 }
 const parsed=bookSchema.safeParse(body);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message??"Neplatné údaje o knize.");
 if(method==="POST"){const book={...parsed.data,id:crypto.randomUUID(),revision:0};write([...books,book]);return book}
 if(method==="PUT"){const current=books.find(b=>b.id===body.id);if(!current||current.revision!==body.revision)throw new Error("Kniha se mezitím změnila. Obnov stránku a zkus změnu znovu.");const book={...parsed.data,id:current.id,revision:current.revision+1};write(books.map(b=>b.id===book.id?book:b));return book}
 throw new Error("Neznámá operace.");
}
