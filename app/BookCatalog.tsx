import {useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowRight,Library,LoaderCircle,Plus,Search} from "lucide-react";
import {api} from "./client-api";
import {catalogNames,completeCatalogBook,googleBooksConfigured,type CatalogBook,type CatalogResponse} from "./catalog";
import {ownCatalogComponent,type BookCatalogProps} from "./catalog-mode";

const languages:Record<string,string>={cs:"Čeština",sk:"Slovenština",en:"Angličtina",de:"Němčina",fr:"Francouzština",es:"Španělština",pl:"Polština"};
export default function BookCatalog(props:BookCatalogProps){const OwnCatalog=ownCatalogComponent();return OwnCatalog?<OwnCatalog {...props}/>:<ExternalBookCatalog {...props}/>}
function ExternalBookCatalog({onPick,onManual,renderCover}:BookCatalogProps){
 const [query,setQuery]=useState(""),[results,setResults]=useState<CatalogBook[]>([]),[warnings,setWarnings]=useState<string[]>([]);
 const [searched,setSearched]=useState(false),[searching,setSearching]=useState(false),[selecting,setSelecting]=useState<string|null>(null),[error,setError]=useState("");
 const [allLanguages,setAllLanguages]=useState(false),[googleLanguage,setGoogleLanguage]=useState<"cs"|"all">("cs");
 const request=useRef(0),busy=searching||selecting!==null;
 const googleEnabled=googleBooksConfigured();
 useEffect(()=>()=>{request.current++},[]);
 async function search(event:FormEvent){
  event.preventDefault();if(busy||query.trim().length<2)return;
  const id=++request.current;setSearching(true);setError("");setWarnings([]);setResults([]);setSearched(false);
  try{const data:CatalogResponse=await api(`/api/search?q=${encodeURIComponent(query.trim())}${allLanguages?"&languages=all":""}`);if(request.current!==id)return;setResults(data.results);setWarnings(data.warnings??[]);setGoogleLanguage(data.googleLanguage);setSearched(true)}
  catch(error){if(request.current===id)setError((error as Error).message)}
  finally{if(request.current===id)setSearching(false)}
 }
 async function pick(book:CatalogBook){
  if(busy)return;const id=++request.current;setSelecting(book.key);
  try{const complete=await completeCatalogBook(book);if(request.current===id)onPick(complete)}
  catch{if(request.current===id)onPick(book,"Podrobnosti vydání se nepodařilo načíst. Dostupné údaje můžeš doplnit ručně.")}
  finally{if(request.current===id)setSelecting(null)}
 }
 const resultCard=(book:CatalogBook)=><div key={book.key} className="catalog-result">
  <button className="search-result" disabled={busy} onClick={()=>pick(book)}>
   {renderCover(book)}<span><strong>{book.title}</strong><small>{book.author}</small>
    <small>{[languages[book.language]??book.language,book.year,book.pages?`${book.pages} stran`:null].filter(Boolean).join(" · ")}</small>
    {book.publisher&&<small>{book.publisher}</small>}
    <small className="catalog-result-source">{book.sources.map(source=>catalogNames[source]).join(" + ")}{book.isbn?` · ISBN ${book.isbn}`:""}</small>
   </span>{selecting===book.key?<LoaderCircle className="spin" size={18}/>:<Plus size={18}/>}
  </button>
  {book.sources.includes("google-books")&&<a className="catalog-book-link" href={`https://books.google.com/books?id=${encodeURIComponent(book.key.slice("google-books:".length))}`} target="_blank" rel="noopener noreferrer">Zobrazit v Google Books <ArrowRight size={12}/></a>}
 </div>;
 return <>
  <form onSubmit={search} className="catalog-search">
   <label className="search-box"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} disabled={busy} placeholder="Například Eragon nebo Christopher Paolini" minLength={2} maxLength={200} required aria-label="Hledat v knižním katalogu"/></label>
   <button className="button primary" disabled={busy}>{searching?<LoaderCircle className="spin" size={17}/>:<Search size={17}/>} Hledat</button>
  </form>
  {googleEnabled&&<div className="catalog-options"><label><input type="checkbox" checked={allLanguages} disabled={busy} onChange={event=>{setAllLanguages(event.target.checked);setResults([]);setSearched(false);setWarnings([])}}/> Hledat i v jiných jazycích</label><a href="https://books.google.com/" target="_blank" rel="noopener noreferrer"><img src="https://books.google.com/googlebooks/images/poweredby.png" alt="Powered by Google" width={62} height={30}/></a></div>}
  <div className="catalog-source"><span>{googleEnabled?"Google Books + Open Library":"Open Library"} · přednostně česká vydání</span><button className="text-button" disabled={busy} onClick={onManual}>Přidat ručně <ArrowRight size={13}/></button></div>
  {warnings.length>0&&<div className="catalog-notice" role="status">{warnings.map(warning=><p key={warning}>{warning}</p>)}</div>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {searched&&<p className="catalog-count" role="status">{results.length} výsledků · různá vydání jsou uvedena samostatně</p>}
  <div className="search-results" aria-busy={busy}>
   {results.some(book=>book.sources.includes("google-books"))&&<section className="catalog-group" aria-label="Výsledky Google Books"><h3>Google Books <span>{googleLanguage==="cs"?"Česká vydání":"Všechny jazyky"}</span></h3>{results.filter(book=>book.sources.includes("google-books")).map(resultCard)}</section>}
   {results.some(book=>!book.sources.includes("google-books"))&&<section className="catalog-group" aria-label="Výsledky Open Library"><h3>Open Library <span>Další výsledky</span></h3>{results.filter(book=>!book.sources.includes("google-books")).map(resultCard)}</section>}
   {!searching&&!results.length&&!error&&<div className="search-placeholder"><Library size={36}/><h3>{searched?"Tuhle knihu katalogy nenašly.":"Který příběh si přineseš domů?"}</h3><p>{searched?"Zkus originální název, ISBN nebo ruční přidání.":"Předvyplníme dostupné údaje, obálku i anotaci."}</p></div>}
   {searching&&<div className="search-placeholder" role="status"><LoaderCircle className="spin" size={30}/><p>Hledáme v knižních katalozích…</p></div>}
  </div>
 </>;
}
