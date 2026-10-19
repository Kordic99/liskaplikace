import { bookSchema, type Book } from "./model";
import {parseBackup,mergeBackup,MAX_BACKUP_BYTES} from "./backup";
let standalone=false;
let staticBase:string|undefined;
export const enableStaticRouting=(base:string)=>{staticBase=base};
export const assetHref=(path:string)=>staticBase&&path.startsWith("/")?staticBase+path.slice(1):path;
export const enableLocal=()=>{standalone=true};
export const isLocal=()=>standalone||typeof window!=="undefined"&&window.location.protocol==="file:";
export function appHref(path:string){
 if(!isLocal()&&!staticBase)return path;
 const url=new URL(window.location.href);url.hash="";url.search="";
 if(path.startsWith("/kniha/"))url.searchParams.set("book",path.slice(7));
 else if(path.includes("?"))url.search=path.slice(path.indexOf("?"));
 return url.href;
}
const key="draci-archiv-local-v1";
function read():Book[]{
 let raw;try{raw=localStorage.getItem(key)}catch{throw new Error("Prohlížeč nepovolil místní ukládání. Otevři soubor v běžném okně Edge nebo Chrome.")}
 if(!raw)return [];
 try{const data=JSON.parse(raw);if(!Array.isArray(data))throw new Error();return data}catch{throw new Error("Místní knihovnu nelze přečíst. Existující data nebyla přepsána.")}
}
function write(books:Book[]){try{localStorage.setItem(key,JSON.stringify(books))}catch{throw new Error("Knihovnu nelze uložit. Úložiště prohlížeče může být plné nebo zakázané.")}}
export async function localApi(path:string,method:string,body?:any):Promise<any>{
 const url=new URL(path,"https://local.invalid");
 if(url.pathname==="/api/import"&&method==="POST"){
  if(new TextEncoder().encode(JSON.stringify(body)).byteLength>MAX_BACKUP_BYTES)throw new Error("Záloha může mít nejvýše 5 MB.");
  const result=mergeBackup(read(),parseBackup(body));write(result.books);return {added:result.added,skipped:result.skipped};
 }
 if(url.pathname==="/api/search"){
 const q=url.searchParams.get("q")?.trim()??"";
 const target=new URL("https://openlibrary.org/search.json");target.search=new URLSearchParams({q,lang:"cs",limit:"12",fields:"key,title,author_name,cover_i,number_of_pages_median,isbn,first_publish_year,editions,editions.title,editions.cover_i"}).toString();
 try{const res=await fetch(target,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw new Error();const data:any=await res.json();return {results:data.docs.map((d:any)=>{const e=d.editions?.docs?.[0],cover=e?.cover_i??d.cover_i;return {key:d.key,title:e?.title??d.title,author:(d.author_name??[]).join(", "),pages:d.number_of_pages_median??0,isbn:d.isbn?.[0]??"",year:d.first_publish_year??null,cover:cover?`https://covers.openlibrary.org/b/id/${cover}-L.jpg`:""}})}}catch{throw new Error("Katalog neodpovídá. Připoj se k internetu nebo přidej knihu ručně.")}
 }
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
