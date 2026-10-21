import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {applyChange,asCatalogBook,blankEdition,buildChange,catalogBackupSchema,catalogSeed,findOwnEditions} from "../app/own-catalog";
import {configureBookCatalog} from "../app/catalog-mode";
import {enableLocal,localApi} from "../app/local";

const seed=catalogSeed();
assert.equal(seed.editions.length,500);
assert.equal(new Set(seed.editions.map(book=>book.id)).size,500);
assert.equal(seed.source.license,"CC0-1.0");
assert(seed.source.receipts.length>0);
for(const book of seed.editions){assert.equal(book.origin.license,"CC0-1.0");assert.equal(book.id,"cnb:"+book.origin.recordId);assert(!("cover" in book));assert(!("description" in book));assert(!("notes" in book))}
console.log("PASS 500 unique CC0 editions with provenance and no imported covers, annotations or private data");

const base=seed.editions[0],patch=buildChange(base.id,{...base,title:"Opravený název"},base,0);
assert.deepEqual(patch.fields,{title:"Opravený název"});
const newer={...base,title:"Nový importovaný název",publisher:"Doplněný nakladatel"};
const repaired=applyChange(newer,patch);
assert.equal(repaired.title,"Opravený název");assert.equal(repaired.publisher,"Doplněný nakladatel");assert.equal(repaired.origin?.license,"CC0-1.0");
assert.deepEqual(buildChange(base.id,{...base},base,1).fields,{});
console.log("PASS per-field manual corrections survive seed updates while untouched fields are enriched");

const id="manual:00000000-0000-4000-8000-000000000001";
const manual=applyChange(undefined,buildChange(id,{...blankEdition(),title:"Liščí příběh",author:"Neznámá Autorka",publicationStatus:"announced"},undefined,0));
assert.equal(manual.isbns.length,0);assert.equal(manual.year,null);assert.equal(manual.pages,0);assert.equal(manual.origin,undefined);
assert.equal(findOwnEditions([manual],"lisci pribeh")[0].id,id);
assert.equal(findOwnEditions([manual],"AUTORKA liščí")[0].id,id);
assert.equal(findOwnEditions([manual],"neexistující").length,0);
const isbnBook={...manual,id:id.replace(/1$/,"2"),isbns:["9780375840548"]};
assert.equal(findOwnEditions([manual,isbnBook],"ISBN 0-375-84054-0")[0].id,isbnBook.id);
assert.equal(findOwnEditions([manual,isbnBook],"978-0-375-84054-8")[0].id,isbnBook.id);
const anotherEdition={...isbnBook,id:id.replace(/1$/,"3"),language:"en",year:2026};
assert.equal(findOwnEditions([isbnBook,anotherEdition],"Liščí").length,2);
assert.equal(asCatalogBook(isbnBook).cover,"");assert.equal(asCatalogBook(isbnBook).description,"");assert.deepEqual(asCatalogBook(isbnBook).sources,[]);
assert.throws(()=>buildChange(id,{...blankEdition(),title:"Kniha",isbns:["9780375840549"]},undefined,0));
assert.throws(()=>applyChange(undefined,{id,revision:1,fields:{title:"Neúplný import"}}));
assert.throws(()=>catalogBackupSchema.parse({format:"liskaplikace-own-catalog-v1",seedVersion:seed.version,changes:[{id,revision:1,fields:{title:"Kniha",description:"Cizí anotace"}}]}));
assert.throws(()=>catalogBackupSchema.parse({format:"draci-archiv-v1",books:[]}));
console.log("PASS unknown and upcoming books without ISBN; accent-insensitive title/author search; ISBN-10/13; separate editions; strict imports");

const savedFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw new Error("External requests forbidden")};
try{
 configureBookCatalog(()=>null,async query=>({results:findOwnEditions([manual,isbnBook],query).map(asCatalogBook),warnings:[],googleLanguage:"cs"}));
 enableLocal("test");const result=await localApi("/api/search?q=lisci","GET");assert.equal(result.results.length,2);assert.equal(requests,0);
}finally{globalThis.fetch=savedFetch}
const build=await readFile("tools/build-pages.mjs","utf8"),entry=await readFile("tools/cloud-entry.tsx","utf8");
assert(build.includes("const googleBooksKey=test?'':"));assert(build.includes("if(!test&&!googleBooksKey)"));assert(!entry.includes("OwnBookCatalog"));
console.log("PASS TEST search bypasses external APIs and does not require Google credentials; PROD entry retains existing providers");
