import assert from "node:assert/strict";
import {completeCatalogBook,descriptionText,mergeCatalogBooks,normalizeIsbn,searchCatalog,type CatalogBook} from "../app/catalog";
import {bookSchema,blankBook} from "../app/model";

const isbn="9780375840548",isbn10="0375840540",otherIsbn="9780140328721";
const google=(id="google",overrides:Record<string,unknown>={})=>({id,volumeInfo:{title:"Eragon",authors:["Christopher Paolini"],language:"cs",industryIdentifiers:[{type:"ISBN_13",identifier:isbn}],pageCount:528,publisher:"Testovací nakladatel",description:"<p>Příběh &amp; draci.</p>",...overrides}});
const open=(id="OL22650690M",overrides:Record<string,unknown>={})=>({key:"/works/OL59819W",title:"Work title",author_name:["Christopher Paolini"],isbn:[otherIsbn],number_of_pages_median:999,first_publish_year:1900,cover_i:123,editions:{docs:[{key:"/books/"+id,title:"Eragon",language:["cze"],isbn:[isbn10],cover_i:14829791,publish_date:["2005"],...overrides}]}});
function fetcher(handler:(url:URL)=>unknown|Promise<unknown>):typeof fetch{
 return (async input=>{
  const result=await handler(new URL(String(input)));
  return result instanceof Response?result:Response.json(result);
 }) as typeof fetch;
}
const from=(g:unknown[],o:unknown[])=>fetcher(url=>url.hostname==="openlibrary.org"?{docs:o}:{totalItems:g.length,items:g});
const names=(books:CatalogBook[])=>books.map(b=>b.key);

assert.equal(normalizeIsbn(isbn10),isbn);
assert.equal(normalizeIsbn("ISBN-13: 978-0-375-84054-8"),isbn);
assert.equal(normalizeIsbn("9780375840549"),"");
assert.equal(normalizeIsbn("037584054X"),"");
assert.equal(normalizeIsbn("Eragon"),"");
assert.equal(normalizeIsbn(otherIsbn),otherIsbn);
assert.equal(descriptionText("<p>A &amp; B</p><script>bad()</script><p>&#268;eský příběh</p>"),"A & B\n\nČeský příběh");
console.log("PASS checked ISBN-10/13 identities and plain-text annotations");

const calls:URL[]=[];
const response=await searchCatalog(" Eragon ",{googleBooksKey:"test-key",fetcher:fetcher(url=>{
 calls.push(url);
 return url.hostname==="openlibrary.org"?{docs:[open(),open("OL123M",{isbn:[otherIsbn],language:["eng"]})]}:{totalItems:2,items:[google("second",{title:"Další titul",industryIdentifiers:[]}),google("first")]};
})});
assert.equal(calls.length,2);
assert.equal(calls.find(url=>url.hostname==="books.googleapis.com")?.searchParams.get("langRestrict"),"cs");
assert.equal(calls.find(url=>url.hostname==="openlibrary.org")?.searchParams.get("lang"),"cs");
assert.deepEqual(names(response.results),["google-books:second","google-books:first","open-library:/books/OL123M"]);
assert.deepEqual(response.results[1].sources,["google-books"]);
assert.equal(response.results[1].editionId,"/books/OL22650690M");
assert.equal(response.results[1].pages,528);
assert.equal(response.results[1].description,"Příběh & draci.");
assert.equal(response.warnings.length,0);
assert.equal(response.googleLanguage,"cs");
console.log("PASS both catalogs, Czech preference, Google order and exact-ISBN duplicate handling");

const editions=await searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:from([],[open("OL1M",{isbn:[isbn]}),open("OL2M",{isbn:[otherIsbn]}),open("OL3M",{isbn:[isbn],language:["eng"]})])});
assert.equal(editions.results.length,3);
assert.equal(editions.results[0].year,2005);
assert.equal(editions.results[0].pages,0);
assert.equal(editions.results[0].isbn,isbn);
assert.equal(editions.results[0].cover.includes("14829791"),true);
const noEdition=await searchCatalog("Eragon",{googleBooksKey:"",fetcher:from([],[{...open(),editions:undefined}])});
assert.equal(noEdition.results[0].isbn,"");
assert.equal(noEdition.results[0].pages,0);
assert.equal(noEdition.results[0].year,null);
assert.equal(noEdition.results[0].cover,"");
console.log("PASS different editions/languages stay separate; aggregate work metadata is never imported as edition data");

let fallbackCalls=0;
const fallback=await searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:fetcher(url=>{
 if(url.hostname==="openlibrary.org")return {docs:[]};
 fallbackCalls++;
 return url.searchParams.has("langRestrict")?{totalItems:0}:{totalItems:1,items:[google("english",{language:"en"})]};
})});
assert.equal(fallbackCalls,2);
assert.equal(fallback.googleLanguage,"all");
assert.equal(fallback.results.length,1);
const all=await searchCatalog("Eragon",{googleBooksKey:"test-key",allLanguages:true,fetcher:fetcher(url=>{
 if(url.hostname==="openlibrary.org")return {docs:[]};
 assert.equal(url.searchParams.has("langRestrict"),false);return {totalItems:1,items:[google()]};
})});
assert.equal(all.googleLanguage,"all");
console.log("PASS foreign-language fallback and explicit all-language search");
let transientCalls=0;
const transient=await searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:fetcher(url=>{
 if(url.hostname==="openlibrary.org")return {docs:[]};transientCalls++;
 return url.searchParams.has("langRestrict")?new Response("Unavailable",{status:503}):{totalItems:1,items:[google()]};
})});
assert.equal(transient.results.length,1);assert.equal(transient.googleLanguage,"all");assert.equal(transientCalls,3);
console.log("PASS bounded transient-error retry and fallback from failing Czech filter");

const googleDown=await searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:fetcher(url=>url.hostname==="openlibrary.org"?{docs:[open()]}:new Response("Quota exceeded",{status:429}))});
assert.equal(googleDown.results.length,1);assert.match(googleDown.warnings[0],/Google Books/);
const openDown=await searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:fetcher(url=>{
 if(url.hostname==="openlibrary.org")throw new TypeError("Network failure");
 return {totalItems:1,items:[google()]};
})});
assert.equal(openDown.results.length,1);assert.match(openDown.warnings[0],/Open Library/);
await assert.rejects(()=>searchCatalog("Eragon",{googleBooksKey:"test-key",fetcher:fetcher(()=>new Response("Unavailable",{status:503}))}),/Katalogy právě neodpovídají/);
const empty=await searchCatalog("Nenalezená kniha",{googleBooksKey:"test-key",fetcher:from([],[])});
assert.equal(empty.results.length,0);assert.equal(empty.warnings.length,0);
const withoutKey=await searchCatalog("Eragon",{googleBooksKey:"",fetcher:fetcher(url=>{assert.equal(url.hostname,"openlibrary.org");return {docs:[open()]}})});
assert.equal(withoutKey.results.length,1);assert.match(withoutKey.warnings[0],/zatím není připojený/);
console.log("PASS quota/network failures, both sources down, empty results and absent key");

const isbnResult=await searchCatalog(isbn10,{googleBooksKey:"test-key",fetcher:fetcher(url=>{
 assert.equal(url.searchParams.get("q"),"isbn:"+isbn);assert.equal(url.searchParams.has("langRestrict"),false);
 return url.hostname==="openlibrary.org"?{docs:[open(),open("OL999M",{isbn:[otherIsbn]})]}:{totalItems:1,items:[google()]};
})});
assert.equal(isbnResult.results.length,1);
assert.equal(isbnResult.googleLanguage,"all");
await assert.rejects(()=>searchCatalog("x",{fetcher:from([],[])}),/2–200/);
await assert.rejects(()=>searchCatalog("x".repeat(201),{fetcher:from([],[])}),/2–200/);
console.log("PASS exact-ISBN queries and input validation");

const selected=await completeCatalogBook(editions.results[0],fetcher(url=>{
 assert.equal(url.href,"https://openlibrary.org/books/OL1M.json");
 return {key:"/books/OL1M",number_of_pages:456,isbn_13:[isbn],description:{value:"Popis vydání."}};
}));
assert.equal(selected.pages,456);assert.equal(selected.description,"Popis vydání.");
const googleSelected={...response.results[1],pages:0};
const completed=await completeCatalogBook(googleSelected,fetcher(()=>({key:"/books/OL22650690M",isbn_13:[isbn],number_of_pages:456})));
assert.equal(completed.pages,456);
const wrongEdition=await completeCatalogBook(googleSelected,fetcher(()=>({key:"/books/OL22650690M",isbn_13:[otherIsbn],number_of_pages:777})));
assert.equal(wrongEdition.pages,0);
await assert.rejects(()=>completeCatalogBook(googleSelected,fetcher(()=>({key:"/books/OL999M",isbn_13:[isbn]}))),/Edition mismatch/);
assert.equal(bookSchema.safeParse({...blankBook(),title:selected.title,author:selected.author,cover:selected.cover,isbn:selected.isbn,pages:selected.pages,description:selected.description}).success,true);
console.log("PASS edition detail, ISBN-guarded enrichment and compatibility with saved books");
const legacyBook={...blankBook(),title:"Eragon"};delete (legacyBook as Partial<typeof legacyBook>).googleBooksId;
assert.equal(bookSchema.parse(legacyBook).googleBooksId,"");
assert.equal(bookSchema.parse({...blankBook(),title:"Eragon",googleBooksId:"abc-_123"}).googleBooksId,"abc-_123");
assert.equal(bookSchema.safeParse({...blankBook(),title:"Eragon",googleBooksId:"<script>"}).success,false);

// Successful responses use a small memory cache; a failed provider is retried immediately.
const originalFetch=globalThis.fetch;let cachedCalls=0;
try{
 globalThis.fetch=fetcher(url=>{cachedCalls++;return url.hostname==="openlibrary.org"?{docs:[]}:{totalItems:1,items:[google()]}});
 await searchCatalog("Cache test",{googleBooksKey:"cache-key"});
 await searchCatalog("Cache test",{googleBooksKey:"cache-key"});
 assert.equal(cachedCalls,2);
 await searchCatalog("Cache test",{googleBooksKey:"cache-key",allLanguages:true});
 assert.equal(cachedCalls,4);
}finally{globalThis.fetch=originalFetch}
console.log("PASS successful-search cache separates language options");
