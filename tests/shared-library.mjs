import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
async function client(){
 const login=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
 const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 assert.ok(cookie,'local authentication');
 return async(path,method='GET',body)=>{
  const response=await fetch(origin+path,{method,headers:{cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{throw new Error('Non-JSON API response: '+response.status+' '+text.slice(0,140))}
  return {status:response.status,data};
 };
}
const computer=await client(),phone=await client(),ids=new Set();
const base=()=>({title:'Test sdílení – dočasná kniha',author:'Ověření aplikace',cover:'',isbn:'',pages:100,currentPage:12,status:'reading',rating:0,priority:'high',wantToBuy:true,tags:['test'],series:'',description:'',notes:[],characters:[],addedAt:new Date().toISOString(),startedAt:'',finishedAt:''});
const note={id:crypto.randomUUID(),type:'note',title:'Zápisek z telefonu',content:'Uloženo z druhého přihlášeného klienta.',page:12,spoiler:true,createdAt:new Date().toISOString()};
try{
 assert.equal((await fetch(origin+'/api/books')).status,401);
 assert.equal((await fetch(origin+'/api/import',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
 console.log('PASS anonymous read/import rejected');
 const created=await computer('/api/books','POST',base());assert.equal(created.status,201);ids.add(created.data.id);
 assert.ok((await phone('/api/books')).data.some(b=>b.id===created.data.id));
 const changed=await phone('/api/books','PUT',{...created.data,rating:4,notes:[note]});assert.equal(changed.status,200);
 const onComputer=(await computer('/api/books')).data.find(b=>b.id===created.data.id);
 assert.equal(onComputer.rating,4);assert.equal(onComputer.notes[0].content,note.content);assert.equal(onComputer.wantToBuy,true);
 console.log('PASS independent clients share reading progress, rating, notes and shopping list through the database');
 assert.equal((await computer('/api/books','PUT',{...created.data,rating:1})).status,409);
 assert.equal((await computer(`/api/books?id=${created.data.id}&revision=${created.data.revision}`,'DELETE')).status,409);
 assert.ok((await computer('/api/books')).data.some(b=>b.id===created.data.id&&b.rating===4));
 console.log('PASS stale edits and stale deletions cannot erase newer phone data');
 const importedId=crypto.randomUUID();ids.add(importedId);
 const legacy={...base(),id:importedId,status:'tbr',currentPage:0,notes:[note]};delete legacy.wantToBuy;
 const backup={format:'draci-archiv-v1',books:[legacy]};
 const imported=await computer('/api/import','POST',backup);assert.equal(imported.status,200);assert.equal(imported.data.added,1);
 const onPhone=(await phone('/api/books')).data.find(b=>b.id===importedId);assert.equal(onPhone.notes[0].spoiler,true);assert.equal(onPhone.wantToBuy,false);
 const newer=await phone('/api/books','PUT',{...onPhone,wantToBuy:true,notes:[{...note,content:'Novější zápisek v telefonu.'}]});assert.equal(newer.status,200);
 const repeated=await computer('/api/import','POST',backup);assert.equal(repeated.data.added,0);assert.equal(repeated.data.skipped,1);
 const afterImport=(await computer('/api/books')).data.find(b=>b.id===importedId);assert.equal(afterImport.notes[0].content,'Novější zápisek v telefonu.');assert.equal(afterImport.wantToBuy,true);
 assert.equal((await computer('/api/import','POST',{format:'draci-archiv-v1',books:[{...legacy,pages:-1}]})).status,400);
 console.log('PASS legacy backup import preserves notes, is repeatable and never overwrites newer cloud records');
 const manifest=await fetch(origin+'/manifest.webmanifest');assert.equal(manifest.status,200);assert.equal((await manifest.json()).display,'standalone');
 const icon=await fetch(origin+'/apple-touch-icon.png');assert.equal(icon.status,200);assert.ok((await icon.arrayBuffer()).byteLength>100);
 console.log('PASS web-app manifest and iPhone icon served');
}finally{
 const all=(await computer('/api/books')).data;
 for(const book of all.filter(b=>ids.has(b.id)))assert.equal((await computer(`/api/books?id=${book.id}&revision=${book.revision}`,'DELETE')).status,200);
 console.log('Temporary test records removed.');
}
