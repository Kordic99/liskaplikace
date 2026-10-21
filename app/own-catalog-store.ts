import {applyChange,buildChange,catalogSeed,catalogBackupSchema,changeSchema,type OwnEdition,type EditionFields,type CatalogChange} from "./own-catalog";

const DB="liskaplikace-test-v1-catalog";
export const MAX_CATALOG_BACKUP_BYTES=5*1024*1024;
const errorMessage="Katalog nelze uložit. Zkontroluj volné místo a povolení úložiště prohlížeče.";
function backupPayload(changes:CatalogChange[]){
 if(changes.length>2000)throw new Error("Prototyp podporuje nejvýše 2 000 vlastních záznamů a oprav.");
 const data={format:"liskaplikace-own-catalog-v1",seedVersion:catalogSeed().version,changes};
 if(new TextEncoder().encode(JSON.stringify(data)).byteLength>MAX_CATALOG_BACKUP_BYTES)throw new Error("Katalog by překročil limit zálohy 5 MB. Zkrať doplňované údaje.");
 return data;
}
async function openDatabase(){
 if(typeof indexedDB==="undefined")throw new Error("Prohlížeč nepovolil místní databázi katalogu.");
 const database=await new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore("seed",{keyPath:"id"});request.result.createObjectStore("changes",{keyPath:"id"});request.result.createObjectStore("meta")};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error(errorMessage));
  request.onblocked=()=>reject(new Error("Zavři ostatní okna TESTu a otevři katalog znovu."));
 });
 database.onversionchange=()=>database.close();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=database.transaction(["seed","meta"],"readwrite"),meta=tx.objectStore("meta"),request=meta.get("version");
  request.onsuccess=()=>{const seed=catalogSeed();if(request.result!==seed.version){const store=tx.objectStore("seed");store.clear();seed.editions.forEach(book=>store.put(book));meta.put(seed.version,"version")}};
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error(errorMessage));
 });return database}catch(error){database.close();throw error}
}
async function readChanges(database:IDBDatabase){return new Promise<CatalogChange[]>((resolve,reject)=>{const tx=database.transaction("changes"),request=tx.objectStore("changes").getAll();tx.oncomplete=()=>{try{resolve(request.result.map((item:unknown)=>changeSchema.parse(item)))}catch{reject(new Error("Místní katalog má neplatná data; nic nebylo přepsáno."))}};tx.onabort=tx.onerror=()=>reject(new Error("Katalog se nepodařilo načíst."))})}
export async function loadOwnCatalog():Promise<OwnEdition[]>{
 const db=await openDatabase();try{const changes=await readChanges(db),seed=catalogSeed(),bases=new Map(seed.editions.map(book=>[book.id,book])),patches=new Map(changes.map(change=>[change.id,change]));
  return [...seed.editions.map(book=>applyChange(book,patches.get(book.id))),...changes.filter(change=>change.id.startsWith("manual:")&&!bases.has(change.id)).map(change=>applyChange(undefined,change))];
 }finally{db.close()}
}
export async function saveOwnEdition(id:string,fields:EditionFields,revision:number){
 const base=catalogSeed().editions.find(book=>book.id===id);if(!base&&!id.startsWith("manual:"))throw new Error("Záznam už není v tomto vzorku ČNB.");
 const next=buildChange(id,fields,base,revision),db=await openDatabase();
 try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("changes","readwrite"),store=tx.objectStore("changes"),request=store.getAll();let reason=errorMessage;
  request.onsuccess=()=>{try{const changes:CatalogChange[]=request.result,current=changes.find(change=>change.id===id);if((current?.revision??0)!==revision)throw new Error("Záznam se změnil v jiném okně. Zavři editor a načti jej znovu.");backupPayload([...changes.filter(change=>change.id!==id),next]);store.put(next)}catch(error){reason=(error as Error).message;tx.abort()}};
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error(reason));
 });return applyChange(base,next)}finally{db.close()}
}
export async function exportOwnCatalog(){const db=await openDatabase();try{return backupPayload(await readChanges(db))}finally{db.close()}}
export async function importOwnCatalog(input:unknown){
 const backup=catalogBackupSchema.parse(input),bases=new Map(catalogSeed().editions.map(book=>[book.id,book])),unique=new Map<string,CatalogChange>();let skipped=0;
 for(const change of backup.changes){const base=bases.get(change.id);if(!base&&!change.id.startsWith("manual:")){skipped++;continue}applyChange(base,change);if(unique.has(change.id))throw new Error("Záloha obsahuje opakované identifikátory.");unique.set(change.id,change)}
 const db=await openDatabase();let added=0;try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("changes","readwrite"),store=tx.objectStore("changes"),request=store.getAll();let reason=errorMessage;
  request.onsuccess=()=>{try{const existing:CatalogChange[]=request.result,ids=new Set(existing.map(change=>change.id)),incoming:CatalogChange[]=[];for(const change of unique.values()){if(ids.has(change.id)){skipped++;continue}incoming.push({...change,revision:1})}backupPayload([...existing,...incoming]);incoming.forEach(change=>store.put(change));added=incoming.length}catch(error){reason=(error as Error).message;tx.abort()}};
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error(reason))
 });return {added,skipped}}finally{db.close()}
}
