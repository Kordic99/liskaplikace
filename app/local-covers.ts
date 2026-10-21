import {validateCoverBlob} from "./cover-files";
export async function localCover(namespace:string,operation:"read"|"write",path:string,value?:Blob):Promise<Blob|void>{
 if(typeof indexedDB==="undefined")throw new Error("Prohlížeč nepovolil úložiště obrázků.");
 const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(namespace+"-covers",1);request.onupgradeneeded=()=>request.result.createObjectStore("images");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error("Úložiště obrázků se nepodařilo otevřít."))});
 try{return await new Promise<Blob|void>((resolve,reject)=>{const tx=database.transaction("images",operation==="read"?"readonly":"readwrite"),store=tx.objectStore("images");let result:Blob|undefined;
  const request=operation==="read"?store.get(path):store.put(value,path);request.onsuccess=()=>{if(operation==="read")result=request.result};
  tx.oncomplete=()=>{if(operation==="read"&&!result)reject(new Error("Vlastní obálku v tomto prohlížeči nemáme."));else resolve(result)};
  tx.onerror=()=>reject(new Error("Obrázek se nepodařilo uložit. Úložiště může být plné."));tx.onabort=tx.onerror;
 })}finally{database.close()}
}
export async function saveLocalCover(namespace:string,value:unknown){const blob=await validateCoverBlob(value),path=`local/${crypto.randomUUID()}.jpg`;await localCover(namespace,"write",path,blob);return {path}}
