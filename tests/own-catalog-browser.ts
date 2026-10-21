// Run only on a fresh disposable localhost preview origin. Not part of the app build.
import {blankEdition,catalogSeed} from "../app/own-catalog";
import {exportOwnCatalog,importOwnCatalog,loadOwnCatalog,saveOwnEdition} from "../app/own-catalog-store";
const output=document.getElementById("results")!;
const checks:string[]=[];
function check(condition:unknown,label:string){if(!condition)throw new Error(label);checks.push("PASS "+label);output.textContent=checks.join("\n")}
async function run(){
 const before=await loadOwnCatalog(),library=localStorage.getItem("liskaplikace-test-v1-books"),id=`manual:${crypto.randomUUID()}`;
 const saved=await saveOwnEdition(id,{...blankEdition(),title:"Browser QA book without ISBN",author:"QA",publicationStatus:"announced"},0);
 check(saved.revision===1&&!saved.isbns.length,"IndexedDB persists an upcoming book without ISBN");
 const concurrent=await Promise.allSettled([saveOwnEdition(id,{...saved,title:"Winning edit A"},1),saveOwnEdition(id,{...saved,title:"Winning edit B"},1)]);
 check(concurrent.filter(item=>item.status==="fulfilled").length===1&&concurrent.filter(item=>item.status==="rejected").length===1,"Concurrent editors reject one stale write instead of overwriting");
 const original=await exportOwnCatalog(),current=(await loadOwnCatalog()).find(book=>book.id===id)!;
 const repeat=await importOwnCatalog(original);
 check(repeat.added===0&&(await loadOwnCatalog()).find(book=>book.id===id)?.title===current.title,"Restoring an existing backup does not overwrite current edits");
 const restoredId=`manual:${crypto.randomUUID()}`,manual=original.changes.find(change=>change.id===id)!;
 const result=await importOwnCatalog({...original,changes:[{...manual,id:restoredId}]});
 check(result.added===1&&(await loadOwnCatalog()).find(book=>book.id===restoredId)?.title===current.title,"Backup restore creates a separate valid manual record");
 const base=catalogSeed().editions[0];await saveOwnEdition(base.id,{...base,title:"QA verified manual correction"},(await loadOwnCatalog()).find(book=>book.id===base.id)!.revision);
 // Force the normal seed-version migration, keeping the application's own change store.
 await new Promise<void>((resolve,reject)=>{const request=indexedDB.open("liskaplikace-test-v1-catalog",1);request.onsuccess=()=>{const db=request.result,tx=db.transaction("meta","readwrite");tx.objectStore("meta").put("previous-seed","version");tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}};request.onerror=()=>reject(request.error)});
 const reloaded=await loadOwnCatalog();
 check(reloaded.filter(book=>book.origin).length===500&&reloaded.find(book=>book.id===base.id)?.title==="QA verified manual correction"&&!!reloaded.find(book=>book.id===restoredId),"Seed replacement preserves per-field corrections and manual records");
 const count=reloaded.length;let rejected=false;
 try{await importOwnCatalog({...original,changes:[{...manual,id:`manual:${crypto.randomUUID()}`,fields:{...manual.fields,cover:"https://example.invalid/unlicensed.jpg"}}]})}catch{rejected=true}
 check(rejected&&(await loadOwnCatalog()).length===count,"Invalid or disallowed backup fields leave the database unchanged");
 check(localStorage.getItem("liskaplikace-test-v1-books")===library,"Catalog operations do not change the personal library");
 check(reloaded.length===before.length+2,"Existing preview catalog entries survive all operations");
 document.title="PASS — own catalog browser checks";document.body.dataset.result="pass";
}
void run().catch(error=>{output.textContent+="\nFAIL "+String(error);document.title="FAIL — own catalog browser checks";document.body.dataset.result="fail"});
