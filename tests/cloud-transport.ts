import assert from 'node:assert/strict';
import {supabaseLibrary} from '../app/supabase-library';
import {blankBook} from '../app/model';
import {enableStaticRouting,appHref,assetHref} from '../app/local';

async function main(){
 const database:any[]=[];
 function client(userId:string):any{return {from(table:string){assert.equal(table,'archive_books');let op='read',values:any,filters:any[]=[],start=0,end=499;
  const query:any={
   select(){return query},eq(k:string,v:any){filters.push([k,v]);return query},order(){return query},range(a:number,b:number){start=a;end=b;return query},
   insert(v:any){op='insert';values=v;return query},update(v:any){op='update';values=v;return query},delete(){op='delete';return query},upsert(v:any,options:any){assert.equal(options.ignoreDuplicates,true);assert.equal(options.onConflict,'user_id,id');op='import';values=v;return query},
   async single(){const r=await run();return {...r,data:r.data?.[0]??null}},async maybeSingle(){return query.single()},then(resolve:any,reject:any){return run().then(resolve,reject)}
  };
  async function run(){
   let result:any[]=[];
   const eligible=()=>database.filter(row=>row.user_id===userId&&filters.every(([k,v])=>row[k]===v));
   if(op==='read')result=eligible().slice(start,end+1);
   if(op==='insert'||op==='import')for(const row of Array.isArray(values)?values:[values]){assert.equal(row.user_id,userId);if(database.some(r=>r.user_id===userId&&r.id===row.id)){if(op==='insert')throw Error('duplicate');continue}database.push(structuredClone(row));result.push(row)}
   if(op==='update'){assert.ok(filters.some(([k])=>k==='revision'),'Writes must compare the snapshot revision');for(const row of eligible()){assert.equal(values.revision,row.revision+1);Object.assign(row,structuredClone(values));result.push(row)}}
   if(op==='delete'){assert.ok(filters.some(([k])=>k==='revision'),'Deletes must compare the snapshot revision');for(const row of eligible()){database.splice(database.indexOf(row),1);result.push({id:row.id})}}
   return {data:structuredClone(result),error:null};
  }
  return query;
 }}}
 const pc=supabaseLibrary(client('reader-a'),'reader-a'),phone=supabaseLibrary(client('reader-a'),'reader-a'),stranger=supabaseLibrary(client('reader-b'),'reader-b');
 const created=await pc('/api/books','POST',{...blankBook(),title:'Strážce příběhů'});
 const before=(await phone('/api/books','GET'))[0];assert.equal(before.id,created.id);
 const updated=await phone('/api/books','PUT',{...before,wantToBuy:true,rating:5,notes:[{id:'note',type:'note',title:'Telefon',content:'Sdílený zápisek',page:4,spoiler:false,createdAt:new Date().toISOString()}]});
 assert.equal((await pc('/api/books','GET'))[0].notes[0].content,'Sdílený zápisek');
 await assert.rejects(()=>pc('/api/books','PUT',{...before,rating:1}),{status:409});
 await assert.rejects(()=>pc(`/api/books?id=${before.id}&revision=${before.revision}`,'DELETE'),{status:409});
 assert.equal((await pc('/api/books','GET'))[0].rating,5);
 assert.deepEqual(await stranger('/api/books','GET'),[]);
 const backup={format:'draci-archiv-v1',books:[{...before,id:created.id},{...blankBook(),id:crypto.randomUUID(),title:'Kniha ze zálohy'}]};
 assert.deepEqual(await pc('/api/import','POST',backup),{added:1,skipped:1});
 assert.deepEqual(await phone('/api/import','POST',backup),{added:0,skipped:2});
 assert.equal((await pc('/api/books','GET')).find((b:any)=>b.id===created.id).notes.length,1);
 await assert.rejects(()=>pc('/api/import','POST',{format:'bad',books:[]}));
 await assert.rejects(()=>pc('/api/books','POST',{...blankBook(),title:''}));
 await phone(`/api/books?id=${updated.id}&revision=${updated.revision}`,'DELETE');
 assert.equal((await pc('/api/books','GET')).length,1);
 (globalThis as any).window={location:{href:'https://example.github.io/draci-archiv/?view=tbr',protocol:'https:'}};
 enableStaticRouting('/draci-archiv/');
 assert.equal(appHref('/kniha/'+created.id),'https://example.github.io/draci-archiv/?book='+created.id);
 assert.equal(appHref('/?view=shopping'),'https://example.github.io/draci-archiv/?view=shopping');
 assert.equal(assetHref('/images/reading-sticker.webp'),'/draci-archiv/images/reading-sticker.webp');
 console.log('PASS shared cloud transport, protected revisions, repeatable import and GitHub Pages routes');
}
void main().catch(error=>{console.error(error);process.exitCode=1});
