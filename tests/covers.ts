import assert from "node:assert/strict";
import {blankBook,bookSchema,type Book} from "../app/model";
import {supabaseLibrary} from "../app/supabase-library";
import {createCoverBackup,restoreCoverBackup} from "../app/cover-backup";
import {COVER_BUCKET,MAX_COVER_BYTES,customCoverSchema,validateCoverBlob} from "../app/cover-files";
import {enableLocal,enableStaticRouting,appHref,localApi} from "../app/local";
import {spawnSync} from "node:child_process";
const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002";
const images=new Map<string,Blob>(),blob=new Blob([new Uint8Array([255,216,255,0,255,217])],{type:"image/jpeg"});let downloads=0;
function client(user:string):any{return {storage:{from(bucket:string){assert.equal(bucket,COVER_BUCKET);return {
 async upload(path:string,value:Blob,options:any){assert.ok(path.startsWith(user+"/"));assert.equal(options.upsert,false);assert.equal(options.contentType,"image/jpeg");images.set(path,value);return {error:null}},
 async download(path:string){downloads++;assert.ok(path.startsWith(user+"/"));return {data:images.get(path),error:images.has(path)?null:{code:"404"}}}
}}}}}
const pc=supabaseLibrary(client(a),a),phone=supabaseLibrary(client(a),a),other=supabaseLibrary(client(b),b);
const uploaded=await pc("/api/covers","POST",blob);
assert.ok(customCoverSchema.safeParse(uploaded.path).success);assert.ok(uploaded.path.startsWith(a+"/"));
assert.deepEqual(new Uint8Array(await (await phone("/api/covers?path="+uploaded.path,"GET")).arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
const before=downloads;await assert.rejects(()=>other("/api/covers?path="+uploaded.path,"GET"),{status:403});assert.equal(downloads,before);
await assert.rejects(()=>pc("/api/covers?path=../secret","GET"),{status:403});
await assert.rejects(()=>pc("/api/books","POST",{...blankBook(),title:"Foreign cover",customCover:`${b}/${crypto.randomUUID()}.jpg`}),{status:403});
await assert.rejects(()=>pc("/api/covers","POST",new Blob(["<svg/>"],{type:"image/svg+xml"})));
await assert.rejects(()=>validateCoverBlob(new Blob([new Uint8Array(MAX_COVER_BYTES+1)],{type:"image/jpeg"})));
assert.equal(bookSchema.parse({...blankBook(),title:"Old record",customCover:undefined}).customCover,"");
console.log("PASS private cover upload/download, PC/phone access, account ownership and file validation");

const book:Book={...blankBook(),id:crypto.randomUUID(),revision:0,title:"Moje vydání",cover:"https://example.com/original.jpg",customCover:uploaded.path};
const backup=JSON.parse(await createCoverBackup([book],path=>phone("/api/covers?path="+path,"GET")));
assert.ok(backup.coverImages[uploaded.path].startsWith("data:image/jpeg;base64,"));
const restored=await restoreCoverBackup(backup,[book],image=>other("/api/covers","POST",image),path=>path.startsWith(b+"/"));
assert.ok(restored.books[0].customCover.startsWith(b+"/"));assert.equal(restored.books[0].cover,book.cover);assert.equal(restored.missingCovers,0);
assert.notEqual(restored.books[0].customCover,book.customCover);
const missing=await restoreCoverBackup({format:"draci-archiv-v1"},[book],()=>{throw new Error("Must not upload")},()=>false);assert.equal(missing.missingCovers,1);assert.equal(missing.books[0].customCover,"");
await assert.rejects(()=>restoreCoverBackup({coverImages:{[uploaded.path]:"data:image/jpeg;base64,QUJDRA=="}},[book],image=>other("/api/covers","POST",image),()=>false));
console.log("PASS portable backups include image bytes and restore them under the destination account");

const memory=new Map<string,string>();(globalThis as any).localStorage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)};
const production=await localApi("/api/books","POST",{...blankBook(),title:"Existing offline library"}),stored=memory.get("draci-archiv-local-v1");
enableLocal("test");assert.deepEqual(await localApi("/api/books","GET"),[]);
await localApi("/api/books","POST",{...blankBook(),title:"Only TEST"});
assert.equal(memory.get("draci-archiv-local-v1"),stored);assert.equal((await localApi("/api/books","GET"))[0].title,"Only TEST");assert.notEqual((await localApi("/api/books","GET"))[0].id,production.id);
await localApi("/api/preferences","PUT",{themeId:"forest",showSticker:false,revision:0});assert.equal(memory.has("liskaplikace-preferences-v1"),false);
(globalThis as any).window={location:{href:"https://kordic99.github.io/liskaplikace/test/",protocol:"https:"}};enableStaticRouting("/liskaplikace/test/");assert.equal(appHref("/kniha/"+book.id),"https://kordic99.github.io/liskaplikace/test/?book="+book.id);
console.log("PASS TEST uses separate book/theme keys and routes, without touching existing local data");

const unsafe=spawnSync(process.execPath,["tools/build-pages.mjs"],{env:{...process.env,APP_ENV:"test",VITE_SUPABASE_URL:"https://production.supabase.co",VITE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture"},encoding:"utf8"});
assert.notEqual(unsafe.status,0);assert.match(unsafe.stderr,/TEST must never receive/);
console.log("PASS TEST build refuses production database configuration");
