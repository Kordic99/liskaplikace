import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,ArrowRight,Check,Database,Download,Library,LoaderCircle,Pencil,Plus,RefreshCw,Search,Upload} from "lucide-react";
import type {BookCatalogProps} from "./catalog-mode";
import {asCatalogBook,blankEdition,editionFields,findOwnEditions,type OwnEdition,type EditionFields} from "./own-catalog";
import {exportOwnCatalog,importOwnCatalog,loadOwnCatalog,saveOwnEdition,MAX_CATALOG_BACKUP_BYTES} from "./own-catalog-store";
import {normalizeIsbn} from "./catalog";

const languageNames:Record<string,string>={cs:"Čeština",sk:"Slovenština",en:"Angličtina",de:"Němčina",fr:"Francouzština",pl:"Polština"};
const message=(error:unknown)=>error instanceof Error?("issues" in error?"Zkontroluj formát a údaje katalogu.":error.message):"Katalog se nepodařilo načíst.";
export default function OwnBookCatalog({onPick,onManual,renderCover}:BookCatalogProps){
 const [books,setBooks]=useState<OwnEdition[]>([]),[query,setQuery]=useState(""),[limit,setLimit]=useState(40);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [editor,setEditor]=useState<OwnEdition|"new"|null>(null),input=useRef<HTMLInputElement>(null),mounted=useRef(true);
 const filtered=useMemo(()=>findOwnEditions(books,query),[books,query]);
 async function refresh(){setLoading(true);setError("");try{const data=await loadOwnCatalog();if(mounted.current)setBooks(data)}catch(error){if(mounted.current)setError(message(error))}finally{if(mounted.current)setLoading(false)}}
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false}},[]);
 useEffect(()=>{if(editor)return;const focus=()=>void refresh();window.addEventListener("focus",focus);return()=>window.removeEventListener("focus",focus)},[editor]);
 async function backup(){setBusy(true);setError("");try{
  const data=await exportOwnCatalog(),blob=new Blob([JSON.stringify(data)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="liskaplikace-test-katalog-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("Záloha obsahuje ruční záznamy a opravy katalogu. Osobní knihovnu zálohuj zvlášť.");
 }catch(error){setError(message(error))}finally{setBusy(false)}}
 async function restore(file:File){setBusy(true);setError("");setNotice("");try{
  if(file.size>MAX_CATALOG_BACKUP_BYTES)throw new Error("Záloha katalogu může mít nejvýše 5 MB.");
  let data:unknown;try{data=JSON.parse(await file.text())}catch{throw new Error("Vyber platnou JSON zálohu katalogu.")}
  const result=await importOwnCatalog(data);await refresh();setNotice(`Obnoveno ${result.added} záznamů; přeskočeno ${result.skipped}. Existující opravy se nepřepisují.`);
 }catch(error){setError(message(error))}finally{setBusy(false)}}
 async function save(fields:EditionFields,useBook:boolean){
  const current=editor==="new"?undefined:editor;if(!current&&editor!=="new")return;
  const book=await saveOwnEdition(current?.id??`manual:${crypto.randomUUID()}`,fields,current?.revision??0);
  await refresh();setEditor(null);setQuery(book.title);setLimit(40);setNotice("Záznam je uložený v katalogu tohoto prohlížeče.");
  if(useBook)onPick({...asCatalogBook(book),series:book.series});
 }
 if(editor)return <EditionEditor key={editor==="new"?"new":editor.id} book={editor==="new"?undefined:editor} onCancel={()=>setEditor(null)} onSave={save}/>;
 return <div className="own-catalog">
  <div className="own-catalog-intro"><span className="own-catalog-icon"><Database size={24}/></span><div><h3>Vlastní knižní katalog</h3><p>Najdi další příběh nebo přidej knihu, která tu zatím chybí.</p></div><span className="own-catalog-badge">TEST</span></div>
  <form className="catalog-search" onSubmit={event=>{event.preventDefault();setLimit(40)}}>
   <label className="search-box"><Search size={18}/><input autoFocus value={query} onChange={event=>{setQuery(event.target.value);setLimit(40)}} maxLength={200} placeholder="Název, autor, ISBN nebo nakladatel" aria-label="Hledat ve vlastním katalogu"/></label>
   <button className="button primary" disabled={loading||busy}><Search size={17}/> Hledat</button>
  </form>
  <div className="own-catalog-toolbar"><button className="button subtle" disabled={busy||loading} onClick={()=>setEditor("new")}><Plus size={16}/> Nový záznam</button><button className="text-button" disabled={busy||loading} onClick={onManual}>Jen do mé knihovny <ArrowRight size={13}/></button></div>
  <details className="own-catalog-info"><summary>Záloha katalogu</summary><p>Přidané knihy a úpravy katalogu se ukládají v tomto prohlížeči. Zálohuj si je před vymazáním jeho dat nebo přechodem na jiné zařízení.</p><div className="own-catalog-backups"><button className="button subtle" disabled={busy||loading} onClick={()=>void backup()}><Download size={15}/> Zálohovat katalog</button><button className="button subtle" disabled={busy||loading} onClick={()=>input.current?.click()}><Upload size={15}/> Obnovit katalog</button><button className="text-button" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={14}/> Obnovit zobrazení</button></div><small>Osobní knihovnu se zápisky, hodnocením a vlastními obálkami zálohuj zvlášť v nastavení.</small></details>
  <input ref={input} type="file" hidden accept=".json,application/json" aria-label="Obnovit zálohu vlastního katalogu" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(file)void restore(file)}}/>
  {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="catalog-notice" role="status">{notice}</p>}
  {loading?<div className="search-placeholder" role="status"><LoaderCircle className="spin" size={28}/><p>Otevírám vlastní katalog…</p></div>:<>
   <p className="catalog-count" role="status">{filtered.length} nalezených vydání{filtered.length>limit?` · zobrazeno ${limit}`:""}</p>
   <div className="search-results own-catalog-results">{filtered.slice(0,limit).map(book=><div className="catalog-result own-catalog-result" key={book.id}>
    <button className="search-result" disabled={busy} onClick={()=>onPick({...asCatalogBook(book),series:book.series})} aria-label={`Přidat do knihovny: ${book.title}`}>
     {renderCover(asCatalogBook(book))}<span><strong>{book.title}</strong><small>{book.author||"Autor neuveden"}</small><small>{[languageNames[book.language]??book.language,book.year,book.pages?`${book.pages} stran`:null].filter(Boolean).join(" · ")}</small>{book.publisher&&<small>{book.publisher}</small>}{book.edition&&<small>{book.edition}</small>}{book.publicationStatus==="announced"&&<small>Chystá se</small>}{book.isbns[0]&&<small>ISBN {book.isbns[0]}</small>}</span><Plus size={18}/>
    </button><div className="own-catalog-result-actions"><button className="text-button" disabled={busy} onClick={()=>setEditor(book)} aria-label={`Upravit záznam: ${book.title}`}><Pencil size={13}/> Upravit záznam</button></div>
   </div>)}</div>
   {!filtered.length&&<div className="search-placeholder"><Library size={34}/><h3>Tahle kniha v našem katalogu zatím není.</h3><p>Zkus kratší název nebo ji přidej jako vlastní záznam. ISBN není povinné.</p><button className="button primary" onClick={()=>setEditor("new")}><Plus size={16}/> Přidat chybějící knihu</button></div>}
   {filtered.length>limit&&<button className="button subtle own-catalog-more" onClick={()=>setLimit(value=>value+40)}>Zobrazit dalších {Math.min(40,filtered.length-limit)} vydání</button>}
  </>}
 </div>;
}

function EditionEditor({book,onCancel,onSave}:{book?:OwnEdition;onCancel:()=>void;onSave:(fields:EditionFields,useBook:boolean)=>Promise<void>}){
 const [draft,setDraft]=useState<EditionFields>(book?editionFields(book):blankEdition()),[isbn,setIsbn]=useState(book?.isbns.join(", ")??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const change=(key:keyof EditionFields,value:unknown)=>setDraft(current=>({...current,[key]:value}));
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const submitter=(event.nativeEvent as SubmitEvent).submitter,useBook=submitter instanceof HTMLButtonElement&&submitter.value==="pick";setBusy(true);setError("");try{
  const raw=isbn.split(/[,;\n]/).map(value=>value.trim()).filter(Boolean),ids=raw.map(normalizeIsbn);
  if(ids.some(value=>!value))throw new Error("ISBN má neplatný kontrolní součet. Oprav ho, nebo ponech pole prázdné.");
  await onSave({...draft,isbns:[...new Set(ids)]},useBook);
 }catch(error){setError(message(error));setBusy(false)}}
 return <form className="own-edition-editor" onSubmit={submit}>
  <button className="text-button" type="button" disabled={busy} onClick={onCancel}><ArrowLeft size={14}/> Zpět do katalogu</button><h3>{book?"Upravit záznam knihy":"Nová kniha do katalogu"}</h3><p className="muted">{book?"Doplň nebo oprav údaje o knize.":"Pro novinku, samonáklad i knihu bez ISBN. Vyplň jen údaje, které znáš."}</p>
  <div className="form-fields"><label>Název knihy *<input autoFocus required maxLength={300} value={draft.title} onChange={event=>change("title",event.target.value)}/></label><label>Autor<input maxLength={300} value={draft.author} onChange={event=>change("author",event.target.value)}/></label><div className="field-row"><label>Rok vydání<input type="number" min={1400} max={2200} placeholder="Neuvedeno" value={draft.year??""} onChange={event=>change("year",event.target.value?Number(event.target.value):null)}/></label><label>Jazyk<select value={draft.language} onChange={event=>change("language",event.target.value)}>{!Object.hasOwn(languageNames,draft.language)&&<option value={draft.language}>{draft.language||"Neuvedeno"}</option>}{Object.entries(languageNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div><label>Nakladatel<input maxLength={300} value={draft.publisher} onChange={event=>change("publisher",event.target.value)}/></label><div className="field-row"><label>Vydání / formát<input maxLength={200} placeholder="Např. 1. vydání, paperback" value={draft.edition} onChange={event=>change("edition",event.target.value)}/></label><label>Počet stran<input type="number" min={0} max={100000} placeholder="Neuvedeno" value={draft.pages||""} onChange={event=>change("pages",Number(event.target.value))}/></label></div><label>ISBN <span className="muted">(nepovinné)</span><input maxLength={420} placeholder="Více čísel odděl čárkou" value={isbn} onChange={event=>setIsbn(event.target.value)}/></label><label>Série<input maxLength={200} value={draft.series} onChange={event=>change("series",event.target.value)}/></label><label>Vydání knihy<select value={draft.publicationStatus} onChange={event=>change("publicationStatus",event.target.value)}><option value="unknown">Zatím neověřeno</option><option value="announced">Chystá se</option><option value="published">Již vyšlo</option></select></label></div>
  <p className="catalog-notice">Do katalogu patří bibliografické údaje. Soukromé zápisky, hodnocení a vlastní obálku přidej až ve své knihovně.</p>{error&&<p className="form-error" role="alert">{error}</p>}
  <div className="form-actions"><button type="button" className="button subtle" disabled={busy} onClick={onCancel}>Zrušit</button><button className="button subtle" disabled={busy}><Check size={16}/> Uložit záznam</button>{!book&&<button className="button primary" value="pick" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Uložit a vybrat knihu</button>}</div>
 </form>;
}
