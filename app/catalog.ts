export type CatalogSource = "google-books" | "open-library";
export const catalogNames:Record<CatalogSource,string> = {"google-books":"Google Books","open-library":"Open Library"};
export type CatalogBook = {
 key:string; title:string; author:string; cover:string; pages:number; isbn:string;
 isbns:string[]; year:number|null; language:string; publisher:string; description:string;
 sources:CatalogSource[]; editionId?:string; series?:string;
};
export type CatalogResponse = {results:CatalogBook[]; warnings:string[]; googleLanguage:"cs"|"all"};
type Options = {googleBooksKey?:string; fetcher?:typeof fetch; allLanguages?:boolean};
declare const __GOOGLE_BOOKS_KEY__:string;
const configuredKey = ()=>typeof __GOOGLE_BOOKS_KEY__!=="undefined"?__GOOGLE_BOOKS_KEY__:"";
export const googleBooksConfigured = ()=>!!configuredKey();
const text = (value:unknown,max=300)=>typeof value==="string"?value.trim().slice(0,max):"";
const strings = (value:unknown)=>Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[];
const pages = (value:unknown)=>typeof value==="number"&&Number.isInteger(value)&&value>0&&value<=100000?value:0;
const year = (value:unknown):number|null=>{
 for(const date of Array.isArray(value)?value:[value]){const match=text(date).match(/\b([12]\d{3})\b/);if(match)return Number(match[1])}
 return null;
};
const language = (value:unknown)=>({cze:"cs",ces:"cs",eng:"en",ger:"de",deu:"de",fre:"fr",fra:"fr",slo:"sk",slk:"sk"}[text(value)]??text(value,10));
const normalize = (value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("cs").replace(/[^\p{L}\p{N}]+/gu," ").trim();
function httpsCover(value:unknown){
 try{const url=new URL(text(value,2000));if(url.protocol==="http:")url.protocol="https:";return url.protocol==="https:"?url.href:""}catch{return ""}
}
export function descriptionText(value:unknown):string{
 const raw=typeof value==="object"&&value!==null&&"value" in value?value.value:value;
 return text(raw,100000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"")
  .replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi,"\n").replace(/<[^>]*>/g,"")
  .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity:string)=>{
   if(entity.startsWith("#")){const n=entity[1].toLowerCase()==="x"?parseInt(entity.slice(2),16):Number(entity.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):""}
   return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "} as Record<string,string>)[entity.toLowerCase()]??"";
  }).replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim().slice(0,30000);
}
/** ISBN-10 and ISBN-13 of the same edition share one checked ISBN-13 identity. */
export function normalizeIsbn(value:string):string{
 let isbn=value.replace(/^ISBN(?:-1[03])?:?\s*/i,"").replace(/[\s-]/g,"").toUpperCase();
 if(/^\d{9}[\dX]$/.test(isbn)){
  const sum=[...isbn].reduce((s,c,i)=>s+(c==="X"?10:Number(c))*(10-i),0);
  if(sum%11)return "";
  isbn="978"+isbn.slice(0,9);
  isbn+=String((10-[...isbn].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10)%10);
 }
 if(!/^97[89]\d{10}$/.test(isbn))return "";
 return [...isbn].reduce((s,c,i)=>s+Number(c)*(i%2?3:1),0)%10===0?isbn:"";
}
const isbns = (values:string[])=>[...new Set(values.map(normalizeIsbn).filter(Boolean))];
function googleBook(item:any):CatalogBook|null{
 const v=item?.volumeInfo,id=text(item?.id,100),title=text(v?.title);
 if(!v||!id||!title)return null;
 const ids=isbns((Array.isArray(v.industryIdentifiers)?v.industryIdentifiers:[]).filter((i:any)=>i?.type==="ISBN_13"||i?.type==="ISBN_10").map((i:any)=>text(i.identifier,40)));
 return {key:"google-books:"+id,title,author:strings(v.authors).join(", ").slice(0,300),cover:httpsCover(v.imageLinks?.thumbnail??v.imageLinks?.smallThumbnail),pages:pages(v.pageCount),isbn:ids[0]??"",isbns:ids,year:year(v.publishedDate),language:language(v.language),publisher:text(v.publisher),description:descriptionText(v.description),sources:["google-books"]};
}
function openLibraryBook(work:any):CatalogBook|null{
 const edition=work?.editions?.docs?.[0],id=text(edition?.key),workId=text(work?.key),title=text(edition?.title??work?.title);
 if(!title||!/^\/works\/OL\d+W$/.test(workId))return null;
 // Work-level ISBNs, page medians, cover and first publication year can belong to other editions.
 const ids=isbns(strings(edition?.isbn)),cover=edition?.cover_i;
 return {key:"open-library:"+(id||workId),title,author:strings(work.author_name).join(", ").slice(0,300),cover:Number.isInteger(cover)&&cover>0?`https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false`:"",pages:pages(edition?.number_of_pages),isbn:ids[0]??"",isbns:ids,year:year(edition?.publish_date),language:language(strings(edition?.language)[0]),publisher:strings(edition?.publisher).join(", ").slice(0,300),description:"",sources:["open-library"],...(/^\/books\/OL\d+M$/.test(id)?{editionId:id}:{})};
}
class CatalogUnavailable extends Error{constructor(public status:number){super("Catalog unavailable")}}
async function json(fetcher:typeof fetch,url:URL){
 let response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
 if(url.hostname==="books.googleapis.com"&&[502,503,504].includes(response.status)){
  await new Promise(resolve=>setTimeout(resolve,400));
  response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
 }
 if(!response.ok)throw new CatalogUnavailable(response.status);
 return response.json();
}
async function googleSearch(query:string,key:string,fetcher:typeof fetch,onlyCzech:boolean){
 const url=new URL("https://books.googleapis.com/books/v1/volumes");
 url.search=new URLSearchParams({q:normalizeIsbn(query)?"isbn:"+normalizeIsbn(query):query,key,printType:"books",maxResults:"16",fields:"items(id,volumeInfo(title,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,language,imageLinks)),totalItems",...(onlyCzech?{langRestrict:"cs"}:{})}).toString();
 const data=await json(fetcher,url);
 if(data.error||(!Array.isArray(data.items)&&data.totalItems!==0))throw new Error("Invalid catalog response");
 return (data.items??[]).map(googleBook).filter((book:CatalogBook|null):book is CatalogBook=>!!book);
}
async function openLibrarySearch(query:string,fetcher:typeof fetch){
 const url=new URL("https://openlibrary.org/search.json");
 url.search=new URLSearchParams({q:normalizeIsbn(query)?"isbn:"+normalizeIsbn(query):query,lang:"cs",limit:"16",fields:"key,title,author_name,editions,editions.key,editions.title,editions.cover_i,editions.language,editions.isbn,editions.number_of_pages,editions.publish_date,editions.publisher"}).toString();
 const data=await json(fetcher,url);
 if(!Array.isArray(data.docs))throw new Error("Invalid catalog response");
 return data.docs.map(openLibraryBook).filter((book:CatalogBook|null):book is CatalogBook=>!!book);
}
export function mergeCatalogBooks(books:CatalogBook[],query:string):CatalogBook[]{
 const google=books.filter(book=>book.sources.includes("google-books"));
 books=books.filter(book=>!book.sources.includes("google-books"));
 const merged:CatalogBook[]=[],needle=normalize(query),isbn=normalizeIsbn(query);
 for(const book of books){
  if(isbn&&!book.isbns.includes(isbn))continue;
  const current=merged.find(existing=>existing.key===book.key||existing.isbns.some(id=>book.isbns.includes(id))&&(!existing.language||!book.language||existing.language===book.language));
  if(!current){merged.push({...book,isbns:[...book.isbns],sources:[...book.sources]});continue}
  current.sources=[...new Set([...current.sources,...book.sources])];
  current.isbns=[...new Set([...current.isbns,...book.isbns])];
  for(const field of ["author","cover","isbn","language","publisher","description"] as const)if(!current[field])current[field]=book[field];
  if(!current.pages)current.pages=book.pages;
  if(!current.year)current.year=book.year;
  if(!current.editionId)current.editionId=book.editionId;
 }
 const score=(book:CatalogBook)=>{
  const title=normalize(book.title),author=normalize(book.author);
  return (book.language==="cs"?1000:0)+(isbn&&book.isbns.includes(isbn)?2000:0)+(title===needle?300:title.includes(needle)?150:0)+(author.includes(needle)?75:0);
 };
 // Preserve Google's results and order in their own group. Only Open Library duplicates are hidden.
 const remaining=merged.filter(book=>{
  const same=google.find(g=>g.isbns.some(id=>book.isbns.includes(id))&&(!g.language||!book.language||g.language===book.language));
  if(same&&book.editionId)same.editionId=book.editionId;
  return !same;
 });
 return [...google,...remaining.map((book,index)=>({book,index})).sort((a,b)=>score(b.book)-score(a.book)||a.index-b.index).map(({book})=>book)];
}
const cache=new Map<string,{expires:number;response:CatalogResponse}>();
export async function searchCatalog(rawQuery:string,options:Options={}):Promise<CatalogResponse>{
 const query=rawQuery.trim();
 if(query.length<2||query.length>200)throw new Error("Zadej 2–200 znaků.");
 const key=options.googleBooksKey??configuredKey(),fetcher=options.fetcher??fetch;
 const cacheKey=key+"\n"+!!options.allLanguages+"\n"+query.toLocaleLowerCase("cs");
 const hit=!options.fetcher&&cache.get(cacheKey);
 if(hit&&hit.expires>Date.now())return hit.response;
 let googleLanguage:"cs"|"all"=options.allLanguages||normalizeIsbn(query)?"all":"cs";
 const [google,open]=await Promise.allSettled([
  key?(async()=>{
   let preferred:CatalogBook[];
   try{preferred=await googleSearch(query,key,fetcher,googleLanguage==="cs")}
   catch(error){if(googleLanguage!=="cs"||!(error instanceof CatalogUnavailable)||error.status<500)throw error;preferred=[]}
   if(preferred.length||googleLanguage==="all")return preferred;
   googleLanguage="all";return googleSearch(query,key,fetcher,false);
  })():Promise.reject(new Error("Not configured")),
  openLibrarySearch(query,fetcher),
 ]);
 const warnings:string[]=[],books:CatalogBook[]=[];
 let available=0;
 if(google.status==="fulfilled"){
  available++;books.push(...google.value);
 }else warnings.push(key?"Google Books právě neodpovídá. Zobrazujeme výsledky z Open Library.":"Google Books zatím není připojený. Zobrazujeme výsledky z Open Library.");
 if(open.status==="fulfilled"){available++;books.push(...open.value)}
 else warnings.push("Open Library právě neodpovídá. Zobrazujeme výsledky z Google Books.");
 if(!available)throw new Error("Katalogy právě neodpovídají. Zkus hledat znovu nebo přidej knihu ručně.");
 const response={results:mergeCatalogBooks(books,query),warnings,googleLanguage};
 // Keep successful searches briefly in memory; outages are retried on the next search.
 if(!warnings.length&&!options.fetcher){if(cache.size>=30)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{expires:Date.now()+300000,response})}
 return response;
}
/** Load metadata of the selected Open Library edition, never an aggregate work. */
export async function completeCatalogBook(book:CatalogBook,fetcher:typeof fetch=fetch):Promise<CatalogBook>{
 if(!book.editionId||!/^\/books\/OL\d+M$/.test(book.editionId))return book;
 const data=await json(fetcher,new URL("https://openlibrary.org"+book.editionId+".json"));
 if(data.key!==book.editionId)throw new Error("Edition mismatch");
 const ids=isbns([...strings(data.isbn_13),...strings(data.isbn_10)]);
 // A merged record may only be enriched when the selected edition still matches by ISBN.
 if(book.sources.includes("google-books")&&!book.isbns.some(id=>ids.includes(id)))return book;
 const cover=Array.isArray(data.covers)?data.covers.find((id:unknown)=>typeof id==="number"&&id>0):undefined;
 return {...book,isbns:book.isbns.length?book.isbns:ids,isbn:book.isbn||ids[0]||"",pages:book.pages||pages(data.number_of_pages),year:book.year||year(data.publish_date),publisher:book.publisher||strings(data.publishers).join(", ").slice(0,300),description:book.description||descriptionText(data.description),cover:book.cover||(cover?`https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false`:"")};
}
